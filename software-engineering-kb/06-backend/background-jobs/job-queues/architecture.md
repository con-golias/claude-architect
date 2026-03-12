# Job Queue Architecture

> **AI Plugin Directive — Job Queue Architecture & Design Patterns**
> You are an AI coding assistant. When generating, reviewing, or refactoring background job
> processing code, follow EVERY rule in this document. Improperly designed job queues cause
> data loss, duplicate processing, and cascading failures. Treat each section as non-negotiable.

**Core Rule: EVERY job MUST be idempotent — assume it will execute at least once, possibly multiple times. ALWAYS persist jobs to durable storage before acknowledging to the producer. NEVER process jobs in the request path — offload to background workers.**

---

## 1. Job Queue Fundamentals

```
┌──────────────────────────────────────────────────────────────────┐
│                   Job Queue Architecture                          │
│                                                                   │
│  ┌──────────┐     ┌───────────────┐     ┌──────────────┐        │
│  │ Producer │────►│  Queue/Broker │────►│   Worker     │        │
│  │ (API)    │     │  (Persistent) │     │  (Consumer)  │        │
│  └──────────┘     └───────────────┘     └──────────────┘        │
│       │                  │                     │                  │
│  Enqueues job      Stores durably        Processes job           │
│  Returns 202       Delivers once+        Acks on success         │
│  immediately       Retries on fail       NACKs on failure        │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                    Job Lifecycle                            │   │
│  │                                                            │   │
│  │  PENDING ──► ACTIVE ──► COMPLETED                         │   │
│  │     │          │                                           │   │
│  │     │          ├──► FAILED ──► RETRY ──► ACTIVE           │   │
│  │     │          │                  │                        │   │
│  │     │          │                  └──► DEAD (DLQ)          │   │
│  │     │          │                                           │   │
│  │     └──► DELAYED ──► PENDING (after delay)                │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 1.1 When to Use Job Queues

| Scenario | Use Queue? | Why |
|----------|-----------|-----|
| Send email after signup | YES | Slow I/O, user doesn't need to wait |
| Generate PDF report | YES | CPU-intensive, takes seconds/minutes |
| Process payment webhook | YES | Must be reliable, retryable |
| Resize uploaded image | YES | CPU-intensive, can be async |
| Log analytics event | YES | Non-critical, fire-and-forget |
| Validate user input | NO | Must be synchronous, fast |
| Read from cache | NO | Sub-millisecond, no need to defer |
| Simple DB query | NO | Fast enough for request path |

ALWAYS offload work to a queue when:
- The operation takes > 500ms
- The operation involves external API calls
- The operation is non-critical to the response
- The operation needs retry guarantees
- The operation is CPU/memory intensive

---

## 2. Queue Semantics

### 2.1 Delivery Guarantees

| Guarantee | Description | Systems | Trade-off |
|-----------|-------------|---------|-----------|
| **At-most-once** | Message delivered 0 or 1 times | Redis (no persistence) | Fast but may lose messages |
| **At-least-once** | Message delivered 1+ times | RabbitMQ, SQS, BullMQ | Requires idempotent consumers |
| **Exactly-once** | Message delivered exactly 1 time | Kafka (with transactions) | Complex, performance overhead |

ALWAYS design for at-least-once delivery. NEVER assume exactly-once unless the queue system explicitly guarantees it with transactions. This means EVERY job handler MUST be idempotent.

### 2.2 Ordering Guarantees

| Guarantee | Description | Systems |
|-----------|-------------|---------|
| **FIFO (strict)** | Messages processed in exact order | SQS FIFO, Kafka (per partition) |
| **FIFO (best-effort)** | Mostly ordered, no guarantee | Redis lists, RabbitMQ |
| **Priority** | Higher priority jobs processed first | BullMQ, RabbitMQ (priority queue) |
| **Unordered** | No ordering guarantee | SQS standard, most pub/sub |

ALWAYS use FIFO ONLY when order matters (e.g., event sourcing). For most workloads, unordered queues provide better throughput and scalability.

---

## 3. Job Design

### 3.1 Job Payload

ALWAYS include these fields in every job:

```typescript
interface Job<T = unknown> {
  // Identity
  id: string;              // Unique job ID (UUIDv4)
  type: string;            // Job type: "email.send", "report.generate"

  // Payload
  data: T;                 // Job-specific data (serializable)

  // Metadata
  createdAt: string;       // ISO 8601 timestamp
  attempts: number;        // Current attempt number
  maxAttempts: number;     // Maximum retry attempts

  // Tracing
  correlationId: string;   // Request correlation ID
  traceId?: string;        // Distributed trace ID

  // Scheduling
  delay?: number;          // Delay in milliseconds
  priority?: number;       // Priority (higher = processed first)

  // Dead letter
  failedReason?: string;   // Last failure reason
  stackTrace?: string;     // Last failure stack trace
}
```

### 3.2 Job Payload Rules

- ALWAYS store IDs, NEVER store full objects — fetch fresh data in the worker
- ALWAYS keep payloads small (< 64 KB) — store large data in object storage, pass URL
- ALWAYS include correlation/trace IDs for observability
- ALWAYS make payloads JSON-serializable — no functions, dates as ISO strings, no circular refs
- NEVER store sensitive data (passwords, tokens) in job payloads — pass encrypted references

```typescript
// GOOD — minimal payload with IDs ✅
const job = {
  type: "order.process",
  data: {
    orderId: "order-123",
    userId: "user-456",
  },
};

// BAD — full objects in payload ❌
const job = {
  type: "order.process",
  data: {
    order: { id: "123", items: [...], total: 99.99, ... }, // Stale data risk
    user: { id: "456", email: "...", address: {...}, ... }, // Too large
  },
};
```

---

## 4. Worker Patterns

### 4.1 Concurrency Control

```
┌──────────────────────────────────────────────────────────────┐
│                Worker Concurrency Models                      │
│                                                               │
│  Single Worker (concurrency=1):                               │
│  ├── Jobs processed sequentially                              │
│  ├── Simplest model, no race conditions                       │
│  └── Use for: ordered processing, resource-constrained jobs   │
│                                                               │
│  Concurrent Workers (concurrency=N):                          │
│  ├── N jobs processed in parallel per worker                  │
│  ├── Must handle shared resource contention                   │
│  └── Use for: independent I/O-bound jobs                      │
│                                                               │
│  Multi-Process Workers:                                       │
│  ├── Multiple worker processes (Kubernetes pods)              │
│  ├── Best scalability, horizontal scaling                     │
│  └── Use for: high-throughput systems                         │
│                                                               │
│  Rate-Limited Workers:                                        │
│  ├── Process N jobs per time window                           │
│  ├── Protects downstream services                             │
│  └── Use for: API rate limits, payment processing             │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Graceful Shutdown

ALWAYS implement graceful shutdown — finish active jobs before stopping:

```typescript
class WorkerManager {
  private activeJobs = new Set<string>();
  private shuttingDown = false;

  async start() {
    process.on("SIGTERM", () => this.shutdown());
    process.on("SIGINT", () => this.shutdown());

    while (!this.shuttingDown) {
      const job = await this.queue.dequeue();
      if (job) await this.processJob(job);
    }
  }

  private async shutdown() {
    console.log("Graceful shutdown initiated...");
    this.shuttingDown = true;

    // Wait for active jobs to complete (max 30s)
    const timeout = setTimeout(() => {
      console.error("Shutdown timeout — forcing exit");
      process.exit(1);
    }, 30_000);

    while (this.activeJobs.size > 0) {
      console.log(`Waiting for ${this.activeJobs.size} active jobs...`);
      await new Promise((r) => setTimeout(r, 1000));
    }

    clearTimeout(timeout);
    console.log("All jobs completed. Exiting.");
    process.exit(0);
  }
}
```

```go
func (w *Worker) Start(ctx context.Context) error {
    ctx, cancel := context.WithCancel(ctx)
    defer cancel()

    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)

    var wg sync.WaitGroup

    go func() {
        <-sigCh
        log.Println("Shutdown signal received")
        cancel() // Stop accepting new jobs
    }()

    for {
        select {
        case <-ctx.Done():
            log.Println("Waiting for active jobs to finish...")
            wg.Wait()
            return nil
        default:
            job, err := w.queue.Dequeue(ctx)
            if err != nil {
                continue
            }
            wg.Add(1)
            go func() {
                defer wg.Done()
                w.processJob(ctx, job)
            }()
        }
    }
}
```

---

## 5. Dead Letter Queue (DLQ)

ALWAYS configure a DLQ for jobs that exhaust all retries:

```
┌──────────────────────────────────────────────────────────────┐
│                  Dead Letter Queue Flow                        │
│                                                               │
│  Job fails → Retry 1 → Retry 2 → ... → Retry N → DLQ       │
│                                                               │
│  DLQ Processing:                                              │
│  ├── Alert operations team (PagerDuty, Slack)                │
│  ├── Log full job payload + error for debugging              │
│  ├── Dashboard for manual inspection                          │
│  ├── Option to retry (after fixing root cause)               │
│  └── Option to discard (with audit log)                       │
│                                                               │
│  DLQ Rules:                                                   │
│  ├── NEVER auto-retry DLQ jobs without human review          │
│  ├── ALWAYS alert on DLQ accumulation                        │
│  ├── ALWAYS set retention policy (7-30 days)                 │
│  └── ALWAYS provide manual retry/discard tooling             │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Queue Selection Guide

| Queue | Type | Best For | Persistence | Ordering | Throughput |
|-------|------|----------|-------------|----------|------------|
| **Redis + BullMQ** | In-memory + disk | Node.js apps, rapid dev | AOF/RDB | Priority + FIFO | High |
| **RabbitMQ** | Message broker | Complex routing, multi-consumer | Disk | FIFO per queue | High |
| **AWS SQS** | Managed | AWS ecosystem, zero-ops | Managed | Standard or FIFO | Very high |
| **Kafka** | Event log | Event streaming, replay | Disk | Per partition | Highest |
| **PostgreSQL (SKIP LOCKED)** | Database | Simple apps, no extra infra | Transactional | FIFO | Moderate |
| **GCP Pub/Sub** | Managed | GCP ecosystem | Managed | Unordered | Very high |
| **NATS JetStream** | Lightweight | Microservices, low latency | Disk | Per stream | Very high |

### 6.1 Decision Tree

```
┌────────────────────────────────────────────────────┐
│           Queue Selection Decision                  │
│                                                     │
│  Need event replay / audit log?                     │
│    │        │                                       │
│   YES       NO                                      │
│    │        │                                       │
│  Kafka    Need complex routing                      │
│           (fan-out, topic exchange)?                 │
│             │        │                              │
│            YES       NO                              │
│             │        │                              │
│         RabbitMQ   Using AWS?                        │
│                      │        │                     │
│                     YES       NO                     │
│                      │        │                     │
│                    SQS      Node.js app?             │
│                              │        │             │
│                             YES       NO             │
│                              │        │             │
│                           BullMQ    Want zero        │
│                           (Redis)   extra infra?     │
│                                      │      │       │
│                                     YES     NO       │
│                                      │      │       │
│                                    Postgres  NATS    │
│                                    SKIP      or      │
│                                    LOCKED    RabbitMQ │
└────────────────────────────────────────────────────┘
```

---

## 7. Monitoring & Observability

ALWAYS monitor these metrics for job queues:

| Metric | Alert Threshold | Meaning |
|--------|----------------|---------|
| Queue depth | > 10K pending | Workers can't keep up |
| Processing latency (p95) | > 60s | Jobs taking too long |
| Failure rate | > 5% | Jobs failing excessively |
| DLQ depth | > 0 (alert) | Jobs permanently failing |
| Worker utilization | > 80% | Need more workers |
| Job age (oldest pending) | > 5 min | Queue is backing up |
| Retry rate | > 20% | Flaky dependencies |

```typescript
// Emit metrics from worker
async function processWithMetrics(job: Job) {
  const startTime = Date.now();
  metrics.increment("jobs.started", { type: job.type });

  try {
    await processJob(job);

    const duration = Date.now() - startTime;
    metrics.histogram("jobs.duration_ms", duration, { type: job.type });
    metrics.increment("jobs.completed", { type: job.type });
  } catch (error) {
    metrics.increment("jobs.failed", { type: job.type });
    throw error;
  }
}
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Processing in request path | Slow API responses, timeouts | Enqueue job, return 202 Accepted |
| Non-idempotent jobs | Duplicate charges, duplicate emails | Design every job to be idempotent |
| Full objects in payload | Stale data, large queue memory | Store IDs only, fetch fresh data in worker |
| No DLQ | Failed jobs silently lost | ALWAYS configure DLQ + alerting |
| No graceful shutdown | Jobs interrupted mid-processing | Handle SIGTERM, finish active jobs |
| Unbounded concurrency | OOM, connection pool exhaustion | Set worker concurrency limits |
| No monitoring | Queue fills up unnoticed | Track depth, latency, failure rate |
| Synchronous queue calls | Producer blocked if queue is slow | Use async enqueue with timeouts |
| No correlation IDs | Cannot trace job back to request | Pass request ID through to job |
| Queue as database | Querying jobs by status, joining data | Use a database for state, queue for work |
| No backpressure | Producer overwhelms workers | Rate limit producers or use bounded queues |
| Secrets in payload | Credentials exposed in logs/DLQ | Pass encrypted references, fetch in worker |

---

## 9. Enforcement Checklist

- [ ] Every job is idempotent (safe to process multiple times)
- [ ] Job payloads contain IDs only — fetch fresh data in worker
- [ ] Job payloads are JSON-serializable and < 64 KB
- [ ] Correlation ID and trace ID included in every job
- [ ] DLQ configured with alerting (PagerDuty/Slack)
- [ ] Graceful shutdown handles SIGTERM/SIGINT
- [ ] Worker concurrency bounded (not unlimited goroutines/promises)
- [ ] Queue depth, latency, and failure rate monitored
- [ ] No sensitive data in job payloads
- [ ] Jobs return 202 Accepted — NEVER block the request path
- [ ] At-least-once delivery assumed — handlers are idempotent
- [ ] Retry strategy configured (see retry-strategies.md)
- [ ] Queue selection justified (Redis/RabbitMQ/SQS/Kafka/Postgres)
