# Message Queues for Scale

> **Domain:** Scalability > Async Processing
> **Importance:** Critical
> **Last Updated:** 2026-03-10
> **Cross-references:**
> - `06-backend/message-queues/overview.md` — foundational queue concepts
> - `06-backend/message-queues/kafka.md` — Kafka fundamentals
> - `10-scalability/horizontal-scaling/` — general horizontal scaling patterns

---

## Core Concepts

### Queue-Based Decoupling for Horizontal Scaling

Use message queues as the backbone for decoupling producers from consumers. This
decoupling enables independent scaling of each side: add more producers without
touching consumers and vice versa. The broker absorbs load spikes, acting as a
buffer that converts synchronous pressure into manageable asynchronous work.

**Scaling dimensions enabled by queues:**

| Dimension | Mechanism | Effect |
|---|---|---|
| Producer throughput | Multiple producers write concurrently | Linear write scaling |
| Consumer throughput | Consumer groups / competing consumers | Linear read scaling |
| Message capacity | Partitioning / sharding across brokers | Storage scaling |
| Fault tolerance | Replication across broker nodes | Availability |

### Broker Comparison at Scale

| Feature | Kafka | RabbitMQ | NATS JetStream | AWS SQS |
|---|---|---|---|---|
| Throughput | 1M+ msg/s | ~50K msg/s | 500K+ msg/s | ~3K msg/s per queue |
| Ordering | Per-partition | Per-queue | Per-stream | Best-effort (FIFO available) |
| Retention | Configurable (days/size) | Until consumed | Configurable | 14 days max |
| Consumer model | Pull-based | Push-based | Push/Pull | Pull-based |
| Horizontal scaling | Partition-based | Clustering + sharding | Clustering | Managed/automatic |
| Ops complexity | High | Medium | Low | None (managed) |
| Best for at scale | Event streaming, log aggregation | Task distribution, RPC | Microservice messaging | Serverless workloads |

### Partitioned Queues

Scale consumers by increasing partition count. Each partition is an ordered,
append-only log consumed by exactly one consumer within a group.

**Partition count guidelines:**

- Set partition count >= expected max consumer count.
- Over-partition slightly (2-3x expected consumers) to allow growth without repartitioning.
- Never reduce partition count in Kafka — plan ahead.
- Use consistent hashing on a partition key to co-locate related messages.

---

## Code Examples

### TypeScript: BullMQ Worker Pool with Concurrency Control

```typescript
import { Queue, Worker, QueueScheduler } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
  host: "redis-cluster.internal",
  port: 6379,
  maxRetriesPerRequest: null,
});

// Create a queue with rate limiting for backpressure
const orderQueue = new Queue("order-processing", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400 },
  },
});

// Scale workers with concurrency control per instance
const worker = new Worker(
  "order-processing",
  async (job) => {
    const { orderId, items } = job.data;

    // Update progress for monitoring
    await job.updateProgress(10);
    const validated = await validateInventory(orderId, items);

    await job.updateProgress(50);
    const result = await processPayment(orderId, validated);

    await job.updateProgress(100);
    return { orderId, status: "completed", transactionId: result.txId };
  },
  {
    connection,
    concurrency: 10,          // 10 concurrent jobs per worker instance
    limiter: {
      max: 100,               // max 100 jobs
      duration: 1000,         // per second across all workers
    },
    lockDuration: 60_000,     // 60s lock to prevent double-processing
    stalledInterval: 30_000,  // check for stalled jobs every 30s
  }
);

worker.on("failed", (job, err) => {
  metrics.increment("queue.job.failed", { queue: "order-processing" });
  logger.error({ jobId: job?.id, error: err.message }, "Job failed");
});

worker.on("completed", (job) => {
  metrics.increment("queue.job.completed", { queue: "order-processing" });
});

// Horizontally scale by deploying N instances of this worker process
// BullMQ uses Redis-based distributed locking for coordination
```

### Go: NATS JetStream Consumer with Exactly-Once Processing

```go
package main

import (
    "context"
    "log"
    "os"
    "os/signal"
    "sync"
    "time"

    "github.com/nats-io/nats.go"
    "github.com/nats-io/nats.go/jetstream"
)

func main() {
    nc, err := nats.Connect(
        os.Getenv("NATS_URL"),
        nats.MaxReconnects(-1),
        nats.ReconnectWait(2*time.Second),
    )
    if err != nil {
        log.Fatal(err)
    }
    defer nc.Close()

    js, _ := jetstream.New(nc)

    // Create stream with replicas for fault tolerance
    stream, _ := js.CreateOrUpdateStream(context.Background(), jetstream.StreamConfig{
        Name:      "ORDERS",
        Subjects:  []string{"orders.>"},
        Retention: jetstream.WorkQueuePolicy,
        Storage:   jetstream.FileStorage,
        Replicas:  3,
        MaxAge:    24 * time.Hour,
    })

    // Create durable consumer group — scale by running multiple instances
    consumer, _ := stream.CreateOrUpdateConsumer(context.Background(), jetstream.ConsumerConfig{
        Durable:       "order-processor",
        AckPolicy:     jetstream.AckExplicitPolicy,
        AckWait:       30 * time.Second,
        MaxDeliver:    3,
        MaxAckPending: 100,   // control backpressure per consumer
        FilterSubject: "orders.created",
    })

    ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
    defer cancel()

    // Fan-out to worker goroutines
    var wg sync.WaitGroup
    workerCount := 5

    for i := 0; i < workerCount; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            for {
                msg, err := consumer.Next(jetstream.FetchMaxWait(5 * time.Second))
                if err != nil {
                    if ctx.Err() != nil {
                        return
                    }
                    continue
                }
                if err := processMessage(ctx, msg); err != nil {
                    log.Printf("worker %d: processing failed: %v", id, err)
                    msg.Nak()                   // negative ack — redelivery
                } else {
                    msg.DoubleAck(ctx)          // exactly-once: ack + wait for server confirm
                }
            }
        }(i)
    }

    <-ctx.Done()
    cancel()
    wg.Wait()
}

func processMessage(ctx context.Context, msg jetstream.Msg) error {
    // Implement idempotent processing with deduplication key
    // from message metadata to achieve exactly-once semantics
    return nil
}
```

### Dead Letter Queue Handling at Scale

```typescript
import { Queue, Worker, FlowProducer } from "bullmq";

// Dedicated DLQ with its own processing pipeline
const dlq = new Queue("order-processing-dlq", { connection });

const mainWorker = new Worker(
  "order-processing",
  async (job) => {
    try {
      return await processOrder(job.data);
    } catch (err) {
      if (job.attemptsMade >= 2) {
        // Move to DLQ on final retry with full context
        await dlq.add("failed-order", {
          originalJob: job.data,
          error: err.message,
          failedAt: new Date().toISOString(),
          attempts: job.attemptsMade + 1,
        });
      }
      throw err; // let BullMQ handle retry
    }
  },
  { connection, concurrency: 10 }
);

// Separate DLQ processor — runs at lower concurrency, with alerts
const dlqWorker = new Worker(
  "order-processing-dlq",
  async (job) => {
    await alertOncall("DLQ message", job.data);
    // Attempt recovery logic or manual review queue
    const canRetry = await diagnoseFailure(job.data);
    if (canRetry) {
      await orderQueue.add("order-retry", job.data.originalJob);
    }
  },
  { connection, concurrency: 2 }
);
```

---

## 10 Best Practices

1. **Set partition count to at least 2x expected peak consumer count** to allow
   scaling headroom without repartitioning.
2. **Use consumer groups for competing consumers** — never have multiple
   independent consumers reading the same partition without coordination.
3. **Implement idempotent message processing** — use a deduplication key stored
   in a fast lookup (Redis, database unique constraint) before processing.
4. **Configure dead letter queues for every production queue** — set max retry
   count (typically 3-5) and route failures to DLQ with full context.
5. **Tune prefetch/batch size to match processing time** — high prefetch for
   fast handlers (100-500), low prefetch for slow handlers (1-10).
6. **Monitor consumer lag as the primary scaling signal** — auto-scale consumer
   count when lag exceeds threshold for sustained period (>5 min).
7. **Use explicit acknowledgment, never auto-ack in production** — auto-ack
   loses messages on consumer crash.
8. **Apply backpressure at the producer level** when queues approach capacity —
   return HTTP 429 or circuit-break upstream rather than dropping messages.
9. **Separate high-priority and low-priority work into distinct queues** — a
   single queue with priority levels still suffers from head-of-line blocking.
10. **Run consumer health checks on a dedicated endpoint** — expose queue depth,
    processing rate, and error rate for observability.

---

## Anti-Patterns

| # | Anti-Pattern | Problem | Correct Approach |
|---|---|---|---|
| 1 | Unbounded queue growth | Memory exhaustion crashes the broker | Set max queue length + backpressure on producers |
| 2 | Single-partition bottleneck | One consumer maxes out, others idle | Partition by a high-cardinality key (e.g., user ID) |
| 3 | Fat messages (>1 MB payload) | Increases broker memory pressure and network I/O | Store payload in object storage, pass reference in message |
| 4 | Synchronous RPC over queues | Adds latency, defeats async benefits | Use queues for async work; use gRPC/HTTP for sync calls |
| 5 | No dead letter queue | Poison messages block the entire queue forever | Always configure DLQ with max retry count |
| 6 | Consumer doing I/O in ack window | Ack timeout causes redelivery and duplicate processing | Extend ack deadline or process then ack |
| 7 | Sharing one queue across unrelated domains | Noisy neighbor problem; one domain's spike starves others | One queue per bounded context or workload type |
| 8 | Ignoring consumer rebalancing latency | Kafka rebalances cause processing pauses (stop-the-world) | Use cooperative sticky assignor; tune `session.timeout.ms` |

---

## Enforcement Checklist

- [ ] Every production queue has a configured dead letter queue
- [ ] Consumer lag monitoring and alerting is in place (warn at 1K, critical at 10K)
- [ ] Message processing is idempotent (verified by replay tests)
- [ ] Partition key distributes load evenly (no hot partitions >2x average)
- [ ] Explicit acknowledgment mode is enabled (auto-ack disabled)
- [ ] Backpressure mechanism exists on producer side (rate limiting or circuit breaker)
- [ ] Queue depth dashboards are visible in the team's monitoring system
- [ ] Consumer concurrency is tunable via environment variable, not hardcoded
- [ ] Message schema includes version field for forward compatibility
- [ ] Retry policy configured: max attempts, exponential backoff, DLQ routing
- [ ] Load test validates throughput at 2x expected peak before production deploy
- [ ] Consumer group scaling runbook exists and has been tested
