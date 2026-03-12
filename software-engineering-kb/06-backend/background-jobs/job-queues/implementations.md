# Job Queue Implementations

> **AI Plugin Directive — Job Queue Implementation Patterns**
> You are an AI coding assistant. When generating, reviewing, or refactoring job queue implementations,
> follow EVERY rule in this document. Use the correct patterns for each queue technology.
> Treat each numbered section as a non-negotiable production requirement.

**Core Rule: ALWAYS use the official client library for your queue technology. ALWAYS acknowledge jobs AFTER successful processing — NEVER before. ALWAYS configure persistence, retries, and dead letter queues in production.**

---

## 1. BullMQ (Redis)

The PREFERRED queue for Node.js/TypeScript applications.

### 1.1 Setup & Configuration

```typescript
import { Queue, Worker, QueueScheduler, Job } from "bullmq";
import Redis from "ioredis";

// ALWAYS use a dedicated Redis connection for the queue
const connection = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});

// Define queues by domain
const emailQueue = new Queue("email", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 86400, count: 1000 }, // Keep 24h or 1000 jobs
    removeOnFail: { age: 604800 },                 // Keep failed 7 days
  },
});

const reportQueue = new Queue("report", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5000 },
    timeout: 300_000, // 5 minute timeout
  },
});
```

### 1.2 Producer (Enqueuing Jobs)

```typescript
// Simple job
await emailQueue.add("send-welcome", {
  userId: "user-123",
  templateId: "welcome-email",
}, {
  priority: 1, // Higher = processed first
});

// Delayed job
await emailQueue.add("send-reminder", {
  userId: "user-123",
  templateId: "trial-ending",
}, {
  delay: 24 * 60 * 60 * 1000, // 24 hours
});

// Bulk enqueue
await emailQueue.addBulk([
  { name: "send-digest", data: { userId: "user-1" } },
  { name: "send-digest", data: { userId: "user-2" } },
  { name: "send-digest", data: { userId: "user-3" } },
]);

// Rate-limited queue
const rateLimitedQueue = new Queue("api-calls", {
  connection,
  limiter: {
    max: 100,       // 100 jobs
    duration: 60_000, // per 60 seconds
  },
});
```

### 1.3 Worker (Processing Jobs)

```typescript
const emailWorker = new Worker("email", async (job: Job) => {
  switch (job.name) {
    case "send-welcome":
      await sendWelcomeEmail(job.data.userId, job.data.templateId);
      break;
    case "send-reminder":
      await sendReminderEmail(job.data.userId, job.data.templateId);
      break;
    case "send-digest":
      await sendDigestEmail(job.data.userId);
      break;
    default:
      throw new Error(`Unknown job name: ${job.name}`);
  }

  // Return value stored as job result
  return { sent: true, timestamp: new Date().toISOString() };
}, {
  connection,
  concurrency: 10,    // Process 10 jobs in parallel
  limiter: {
    max: 50,
    duration: 60_000,  // Max 50 emails/min
  },
});

// Event handlers
emailWorker.on("completed", (job) => {
  metrics.increment("email.sent", { name: job.name });
});

emailWorker.on("failed", (job, error) => {
  logger.error("Job failed", {
    jobId: job?.id,
    name: job?.name,
    error: error.message,
    attempts: job?.attemptsMade,
  });
  metrics.increment("email.failed", { name: job?.name });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await emailWorker.close(); // Waits for active jobs to finish
  process.exit(0);
});
```

### 1.4 Flow (Job Dependencies)

```typescript
import { FlowProducer } from "bullmq";

const flowProducer = new FlowProducer({ connection });

// Parent job waits for all children to complete
await flowProducer.add({
  name: "generate-report",
  queueName: "report",
  data: { reportId: "report-123" },
  children: [
    {
      name: "fetch-sales-data",
      queueName: "data-fetch",
      data: { source: "sales", reportId: "report-123" },
    },
    {
      name: "fetch-user-data",
      queueName: "data-fetch",
      data: { source: "users", reportId: "report-123" },
    },
    {
      name: "fetch-analytics",
      queueName: "data-fetch",
      data: { source: "analytics", reportId: "report-123" },
    },
  ],
});
```

---

## 2. PostgreSQL (SKIP LOCKED)

Use when you need a job queue WITHOUT additional infrastructure. Postgres itself becomes the queue.

### 2.1 Schema

```sql
CREATE TABLE job_queue (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue       VARCHAR(100) NOT NULL DEFAULT 'default',
    type        VARCHAR(200) NOT NULL,
    payload     JSONB NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority    INT NOT NULL DEFAULT 0,
    attempts    INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    run_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at  TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at   TIMESTAMPTZ,
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Efficient dequeue index
    INDEX idx_job_dequeue (queue, status, priority DESC, run_at ASC)
      WHERE status = 'pending'
);
```

### 2.2 Dequeue with SKIP LOCKED

```sql
-- Atomic dequeue: fetch and lock one job
-- SKIP LOCKED prevents multiple workers from grabbing the same job
WITH next_job AS (
    SELECT id
    FROM job_queue
    WHERE queue = 'default'
      AND status = 'pending'
      AND run_at <= NOW()
    ORDER BY priority DESC, run_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
UPDATE job_queue
SET status = 'active',
    started_at = NOW(),
    attempts = attempts + 1
FROM next_job
WHERE job_queue.id = next_job.id
RETURNING job_queue.*;
```

**Go Implementation**
```go
type PgQueue struct {
    db *pgxpool.Pool
}

func (q *PgQueue) Dequeue(ctx context.Context, queueName string) (*Job, error) {
    var job Job
    err := q.db.QueryRow(ctx, `
        WITH next_job AS (
            SELECT id FROM job_queue
            WHERE queue = $1 AND status = 'pending' AND run_at <= NOW()
            ORDER BY priority DESC, run_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        )
        UPDATE job_queue SET status = 'active', started_at = NOW(), attempts = attempts + 1
        FROM next_job WHERE job_queue.id = next_job.id
        RETURNING job_queue.id, job_queue.type, job_queue.payload, job_queue.attempts
    `, queueName).Scan(&job.ID, &job.Type, &job.Payload, &job.Attempts)

    if err == pgx.ErrNoRows {
        return nil, nil // No jobs available
    }
    return &job, err
}

func (q *PgQueue) Complete(ctx context.Context, jobID string) error {
    _, err := q.db.Exec(ctx,
        `UPDATE job_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        jobID,
    )
    return err
}

func (q *PgQueue) Fail(ctx context.Context, jobID string, errMsg string) error {
    _, err := q.db.Exec(ctx, `
        UPDATE job_queue SET
            status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'pending' END,
            failed_at = NOW(),
            error = $2,
            run_at = NOW() + (INTERVAL '1 second' * POWER(2, attempts))
        WHERE id = $1
    `, jobID, errMsg)
    return err
}
```

**TypeScript Implementation**
```typescript
class PgQueue {
  constructor(private pool: Pool) {}

  async dequeue(queue: string = "default"): Promise<Job | null> {
    const result = await this.pool.query(`
      WITH next_job AS (
        SELECT id FROM job_queue
        WHERE queue = $1 AND status = 'pending' AND run_at <= NOW()
        ORDER BY priority DESC, run_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE job_queue SET status = 'active', started_at = NOW(), attempts = attempts + 1
      FROM next_job WHERE job_queue.id = next_job.id
      RETURNING job_queue.*
    `, [queue]);

    return result.rows[0] ?? null;
  }

  async enqueue(type: string, payload: object, options?: {
    queue?: string;
    priority?: number;
    delay?: number;
  }): Promise<string> {
    const result = await this.pool.query(`
      INSERT INTO job_queue (queue, type, payload, priority, run_at)
      VALUES ($1, $2, $3, $4, NOW() + ($5 || ' milliseconds')::INTERVAL)
      RETURNING id
    `, [
      options?.queue ?? "default",
      type,
      JSON.stringify(payload),
      options?.priority ?? 0,
      String(options?.delay ?? 0),
    ]);

    return result.rows[0].id;
  }
}
```

### 2.3 When to Use Postgres Queue

- Application already uses PostgreSQL
- Job volume is moderate (< 10K jobs/hour)
- No need for complex routing or fan-out
- Want transactional enqueue (enqueue job in same transaction as business logic)
- Want to avoid additional infrastructure

---

## 3. RabbitMQ (AMQP)

Use for complex routing, multi-consumer patterns, and cross-language systems.

### 3.1 Exchange & Queue Topology

```
┌──────────────────────────────────────────────────────────────┐
│                RabbitMQ Topology                              │
│                                                               │
│  Producer ──► Exchange ──► Queue ──► Consumer                │
│                                                               │
│  Exchange Types:                                              │
│  ├── direct:  route by exact routing key                     │
│  ├── topic:   route by pattern (order.*.created)             │
│  ├── fanout:  broadcast to all bound queues                  │
│  └── headers: route by message headers                       │
│                                                               │
│  Example:                                                     │
│  ┌──────────┐     ┌────────────┐     ┌──────────┐           │
│  │ API      │────►│  "orders"  │────►│ process  │           │
│  │ Server   │     │  (topic)   │────►│ notify   │           │
│  └──────────┘     └────────────┘────►│ analytics│           │
│                                       └──────────┘           │
│  Routing keys:                                                │
│  order.created → process, notify, analytics                  │
│  order.paid    → process, analytics                          │
│  order.shipped → notify, analytics                           │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Go Implementation

```go
import amqp "github.com/rabbitmq/amqp091-go"

func setupRabbitMQ(conn *amqp.Connection) (*amqp.Channel, error) {
    ch, err := conn.Channel()
    if err != nil {
        return nil, err
    }

    // Declare exchange
    err = ch.ExchangeDeclare("orders", "topic", true, false, false, false, nil)
    if err != nil {
        return nil, err
    }

    // Declare queue with DLQ
    args := amqp.Table{
        "x-dead-letter-exchange":    "orders.dlx",
        "x-dead-letter-routing-key": "dead",
        "x-message-ttl":             int32(86400000), // 24h
    }
    _, err = ch.QueueDeclare("order-processing", true, false, false, false, args)
    if err != nil {
        return nil, err
    }

    // Bind queue to exchange
    ch.QueueBind("order-processing", "order.created", "orders", false, nil)
    ch.QueueBind("order-processing", "order.paid", "orders", false, nil)

    // Prefetch: 1 message at a time per consumer (backpressure)
    ch.Qos(1, 0, false)

    return ch, nil
}

// Consumer
func consumeOrders(ch *amqp.Channel) {
    msgs, _ := ch.Consume("order-processing", "", false, false, false, false, nil)

    for msg := range msgs {
        err := processOrder(msg.Body)
        if err != nil {
            // NACK + requeue (limited by max retries via x-death header)
            msg.Nack(false, shouldRequeue(msg))
        } else {
            msg.Ack(false)
        }
    }
}

// Publisher
func publishOrder(ch *amqp.Channel, routingKey string, payload []byte) error {
    return ch.PublishWithContext(context.Background(),
        "orders",    // exchange
        routingKey,  // routing key
        true,        // mandatory (return if unroutable)
        false,       // immediate
        amqp.Publishing{
            DeliveryMode: amqp.Persistent, // ALWAYS persist
            ContentType:  "application/json",
            Body:         payload,
            MessageId:    uuid.NewString(),
            Timestamp:    time.Now(),
        },
    )
}
```

---

## 4. AWS SQS

Use for AWS-native applications with zero-ops queue management.

```typescript
import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({ region: "us-east-1" });
const QUEUE_URL = process.env.SQS_QUEUE_URL!;

// Send message
async function enqueue(type: string, data: object): Promise<void> {
  await sqs.send(new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify({ type, data, timestamp: new Date().toISOString() }),
    MessageGroupId: type,                // Required for FIFO queues
    MessageDeduplicationId: randomUUID(), // Required for FIFO queues
    MessageAttributes: {
      Type: { DataType: "String", StringValue: type },
    },
  }));
}

// Receive and process (long polling)
async function poll(): Promise<void> {
  const response = await sqs.send(new ReceiveMessageCommand({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20,          // Long polling (ALWAYS use)
    VisibilityTimeout: 300,       // 5 min processing window
    MessageAttributeNames: ["All"],
  }));

  for (const message of response.Messages ?? []) {
    try {
      const body = JSON.parse(message.Body!);
      await processJob(body);

      // Delete AFTER successful processing
      await sqs.send(new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle!,
      }));
    } catch (error) {
      // Don't delete — message returns to queue after visibility timeout
      logger.error("Job failed", { messageId: message.MessageId, error });
    }
  }
}
```

- ALWAYS use long polling (`WaitTimeSeconds: 20`) — reduces costs and latency
- ALWAYS delete messages AFTER successful processing
- ALWAYS configure DLQ with `maxReceiveCount` (default: 3)
- ALWAYS set appropriate `VisibilityTimeout` (longer than processing time)

---

## 5. Transactional Outbox Pattern

ALWAYS use the outbox pattern when you need to update a database AND enqueue a job atomically:

```
┌──────────────────────────────────────────────────────────────┐
│              Transactional Outbox Pattern                      │
│                                                               │
│  Problem: DB write + queue publish are NOT atomic             │
│  ├── DB commits, queue publish fails → lost job              │
│  └── Queue publishes, DB rolls back → ghost job              │
│                                                               │
│  Solution:                                                    │
│  1. Write business data + outbox row in SAME transaction     │
│  2. Separate process polls outbox and publishes to queue     │
│  3. Mark outbox rows as published after successful publish   │
│                                                               │
│  ┌─────────┐    ┌───────────────┐    ┌──────────┐           │
│  │  API    │──► │  DB (single   │──► │  Outbox  │           │
│  │ Handler │    │  transaction) │    │  Poller  │           │
│  └─────────┘    │  ├── orders   │    └────┬─────┘           │
│                  │  └── outbox   │         │                  │
│                  └───────────────┘         ▼                  │
│                                      ┌──────────┐           │
│                                      │  Queue   │           │
│                                      └──────────┘           │
└──────────────────────────────────────────────────────────────┘
```

```sql
-- Outbox table
CREATE TABLE outbox (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  VARCHAR(200) NOT NULL,
    payload     JSONB NOT NULL,
    published   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,

    INDEX idx_outbox_unpublished (created_at ASC) WHERE published = FALSE
);

-- Business logic + outbox in ONE transaction
BEGIN;
  INSERT INTO orders (id, user_id, total) VALUES ($1, $2, $3);
  INSERT INTO outbox (event_type, payload) VALUES ('order.created', $4);
COMMIT;
```

```go
// Outbox poller (runs on interval or CDC)
func (p *OutboxPoller) Poll(ctx context.Context) error {
    tx, _ := p.db.Begin(ctx)
    defer tx.Rollback(ctx)

    rows, _ := tx.Query(ctx, `
        SELECT id, event_type, payload FROM outbox
        WHERE published = FALSE
        ORDER BY created_at ASC
        LIMIT 100
        FOR UPDATE SKIP LOCKED
    `)

    for rows.Next() {
        var id, eventType string
        var payload []byte
        rows.Scan(&id, &eventType, &payload)

        // Publish to queue
        if err := p.queue.Publish(ctx, eventType, payload); err != nil {
            return err
        }

        tx.Exec(ctx, `UPDATE outbox SET published = TRUE, published_at = NOW() WHERE id = $1`, id)
    }

    return tx.Commit(ctx)
}
```

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| ACK before processing | Lost jobs on worker crash | ACK only AFTER successful processing |
| No persistence in Redis | Jobs lost on Redis restart | Enable AOF persistence |
| No DLQ configured | Failed jobs vanish | Configure DLQ on every queue |
| Polling too fast (SQS) | High costs, empty receives | Use long polling (20s) |
| No prefetch limit (RabbitMQ) | Worker OOM with large messages | Set `Qos(prefetch=1)` |
| DB write + queue publish without outbox | Lost or ghost jobs | Use transactional outbox pattern |
| Shared Redis for cache + queue | Cache eviction deletes jobs | Separate Redis instances |
| No message TTL | Old irrelevant jobs processed | Set TTL per queue |
| No visibility timeout (SQS) | Same job processed by multiple workers | Set appropriate timeout |
| Blocking queue operations in request | API blocked when queue is slow | Async enqueue with timeout |

---

## 7. Enforcement Checklist

- [ ] Queue technology selected and justified (BullMQ/RabbitMQ/SQS/Postgres/Kafka)
- [ ] Jobs acknowledged AFTER successful processing — NEVER before
- [ ] Queue persistence enabled (Redis AOF, RabbitMQ durable, Postgres transactional)
- [ ] DLQ configured with alerting on every queue
- [ ] Transactional outbox used when DB write + enqueue must be atomic
- [ ] Long polling enabled for SQS (WaitTimeSeconds=20)
- [ ] Worker concurrency bounded and configurable
- [ ] Graceful shutdown implemented (finish active jobs on SIGTERM)
- [ ] Separate Redis instances for cache and queues (if using Redis)
- [ ] Message TTL configured per queue
- [ ] Prefetch/concurrency limits set (RabbitMQ Qos, BullMQ concurrency)
