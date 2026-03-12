# Batch Processing at Scale

> **Domain:** Scalability > Async Processing
> **Importance:** High
> **Last Updated:** 2026-03-10
> **Cross-references:**
> - `10-scalability/async-processing/message-queues.md` — queue-based async patterns
> - `10-scalability/async-processing/event-streaming.md` — stream processing comparison
> - `07-database/` — database access patterns for batch reads/writes

---

## Core Concepts

### Batch vs Stream Processing

| Dimension | Batch Processing | Stream Processing |
|---|---|---|
| Latency | Minutes to hours | Milliseconds to seconds |
| Throughput | Very high (optimized for bulk) | High (per-event overhead) |
| Data scope | Complete dataset or large window | Individual events or micro-batches |
| Fault recovery | Restart from last checkpoint | Resume from last committed offset |
| Use cases | ETL, reports, ML training, migrations | Real-time analytics, alerting |

**Choose batch when:** latency tolerance is minutes+, you need full-dataset joins,
the workload is periodic, or the processing logic requires global aggregation.

### Modern Frameworks

| Framework | Best For | Scaling Model |
|---|---|---|
| Spark | Large-scale ETL, ML pipelines | Cluster (driver + executors) |
| Flink | Unified batch + stream | Cluster (task managers) |
| Temporal | Workflow orchestration | Worker-based |
| AWS Step Functions | Serverless orchestration | Managed, per-execution |
| Airflow | DAG scheduling, dependency mgmt | Scheduler + workers |

### Job Scheduling Patterns

**Cron-based:** Simple time-based triggers. Risk of overlapping executions.
**DAG-based (Airflow, Dagster):** Task dependencies as directed acyclic graphs
with built-in retry, alerting, and backfill support.
**Workflow-based (Temporal, Step Functions):** Durable workflows with automatic
retry, state persistence, and human-in-the-loop support.

---

## Code Examples

### Python: Chunked Database Processing with Cursor-Based Pagination

```python
import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import AsyncIterator
import asyncpg

@dataclass
class BatchConfig:
    chunk_size: int = 1000
    max_concurrent_chunks: int = 5
    checkpoint_table: str = "batch_checkpoints"

async def chunked_processor(pool: asyncpg.Pool, config: BatchConfig, job_id: str) -> int:
    """Process records in chunks with cursor-based pagination and checkpointing."""
    checkpoint = await load_checkpoint(pool, config, job_id)
    last_cursor = checkpoint["last_cursor"] if checkpoint else ""
    total_processed = checkpoint["processed_count"] if checkpoint else 0
    semaphore = asyncio.Semaphore(config.max_concurrent_chunks)

    async for chunk in fetch_chunks(pool, last_cursor, config.chunk_size):
        if not chunk:
            break
        async with semaphore:
            processed = await process_chunk(pool, chunk)
            total_processed += processed
            last_cursor = chunk[-1]["id"]
            await save_checkpoint(pool, config, job_id, last_cursor, total_processed)
    return total_processed

async def fetch_chunks(pool: asyncpg.Pool, after_cursor: str,
                       chunk_size: int) -> AsyncIterator[list[dict]]:
    """Yield chunks using keyset pagination — avoids OFFSET performance cliff."""
    cursor = after_cursor
    while True:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, email, status, data FROM users
                   WHERE id > $1 AND status = 'pending_migration'
                   ORDER BY id ASC LIMIT $2""",
                cursor, chunk_size,
            )
        if not rows:
            return
        chunk = [dict(row) for row in rows]
        cursor = chunk[-1]["id"]
        yield chunk

async def process_chunk(pool: asyncpg.Pool, chunk: list[dict]) -> int:
    """Process a single chunk with bulk operations."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            ids = [r["id"] for r in chunk]
            results = [transform(r) for r in chunk]
            await conn.execute(
                """UPDATE users SET status = 'migrated', data = batch.new_data, updated_at = NOW()
                   FROM unnest($1::text[], $2::jsonb[]) AS batch(id, new_data)
                   WHERE users.id = batch.id""",
                ids, results,
            )
    return len(chunk)

async def save_checkpoint(pool, config, job_id, cursor, count) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            f"""INSERT INTO {config.checkpoint_table} (job_id, last_cursor, processed_count, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (job_id) DO UPDATE
                SET last_cursor = $2, processed_count = $3, updated_at = NOW()""",
            job_id, cursor, count,
        )
```

### Go: Fan-Out/Fan-In Worker Pool for Parallel Batch Processing

```go
package main

import (
    "context"
    "fmt"
    "log"
    "runtime"
    "sync"
    "sync/atomic"
    "time"
)

type Job struct {
    ID   int
    Data []byte
}

type BatchProcessor struct {
    workerCount int
    processed   atomic.Int64
    failed      atomic.Int64
}

func NewBatchProcessor(workerCount int) *BatchProcessor {
    if workerCount <= 0 { workerCount = runtime.NumCPU() }
    return &BatchProcessor{workerCount: workerCount}
}

func (bp *BatchProcessor) Run(ctx context.Context, jobs []Job) (int64, int64) {
    jobsCh := make(chan Job, 1000)
    var wg sync.WaitGroup

    // Fan-out: launch worker goroutines
    for i := 0; i < bp.workerCount; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            for job := range jobsCh {
                select {
                case <-ctx.Done():
                    return
                default:
                    if err := bp.processJob(ctx, job); err != nil {
                        bp.failed.Add(1)
                        log.Printf("worker %d: job %d failed: %v", id, job.ID, err)
                    } else {
                        bp.processed.Add(1)
                    }
                }
            }
        }(i)
    }

    // Fan-in: feed jobs into the channel
    for _, job := range jobs {
        select {
        case jobsCh <- job:
        case <-ctx.Done():
            break
        }
    }
    close(jobsCh)
    wg.Wait()
    return bp.processed.Load(), bp.failed.Load()
}

func (bp *BatchProcessor) processJob(ctx context.Context, job Job) error {
    time.Sleep(10 * time.Millisecond) // simulate work
    return nil
}

func main() {
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
    defer cancel()

    jobs := make([]Job, 100_000)
    for i := range jobs { jobs[i] = Job{ID: i, Data: []byte(fmt.Sprintf("payload-%d", i))} }

    bp := NewBatchProcessor(runtime.NumCPU() * 2)
    start := time.Now()
    processed, failed := bp.Run(ctx, jobs)
    log.Printf("processed=%d failed=%d duration=%v rate=%.0f/s",
        processed, failed, time.Since(start), float64(processed)/time.Since(start).Seconds())
}
```

### TypeScript: AWS Step Functions State Machine for Batch Orchestration

```typescript
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

const stateMachineDefinition = {
  Comment: "Batch processing with parallel fan-out and error handling",
  StartAt: "SplitIntoChunks",
  States: {
    SplitIntoChunks: {
      Type: "Task",
      Resource: "arn:aws:lambda:us-east-1:123456789:function:split-chunks",
      ResultPath: "$.chunks",
      Next: "ProcessChunksMap",
      Retry: [{ ErrorEquals: ["States.ALL"], MaxAttempts: 2, BackoffRate: 2 }],
    },
    ProcessChunksMap: {
      Type: "Map",
      ItemsPath: "$.chunks",
      MaxConcurrency: 10,
      Iterator: {
        StartAt: "ProcessChunk",
        States: {
          ProcessChunk: {
            Type: "Task",
            Resource: "arn:aws:lambda:us-east-1:123456789:function:process-chunk",
            Retry: [{ ErrorEquals: ["RetryableError"], MaxAttempts: 3, IntervalSeconds: 5, BackoffRate: 2 }],
            Catch: [{ ErrorEquals: ["States.ALL"], ResultPath: "$.error", Next: "RecordFailure" }],
            End: true,
          },
          RecordFailure: {
            Type: "Task",
            Resource: "arn:aws:lambda:us-east-1:123456789:function:record-failure",
            End: true,
          },
        },
      },
      Next: "NotifyComplete",
    },
    NotifyComplete: {
      Type: "Task",
      Resource: "arn:aws:states:::sns:publish",
      Parameters: { TopicArn: "arn:aws:sns:us-east-1:123456789:batch-notifications", Message: "Done" },
      End: true,
    },
  },
};

async function startBatch(inputData: Record<string, unknown>): Promise<string> {
  const sfn = new SFNClient({ region: "us-east-1" });
  const result = await sfn.send(new StartExecutionCommand({
    stateMachineArn: process.env.STATE_MACHINE_ARN!,
    input: JSON.stringify(inputData),
    name: `batch-${Date.now()}`,
  }));
  return result.executionArn!;
}
```

---

## Checkpoint, Resume, and Resource Management

| Resource | Control Mechanism | Guideline |
|---|---|---|
| Memory | Chunk size limit | Keep working set < 50% available RAM |
| CPU | Worker/goroutine count | 2x cores for I/O-bound; 1x for CPU-bound |
| DB connections | Connection pool limit | Max connections = worker_count + 2 |
| Network | Concurrent request limit | Use semaphore; respect API rate limits |

---

## 10 Best Practices

1. **Use keyset (cursor-based) pagination instead of OFFSET** — OFFSET scans
   and discards rows, degrading performance as offset grows.
2. **Implement checkpointing for all batch jobs over 5 minutes** — store last
   processed cursor in a durable checkpoint table.
3. **Make every batch step idempotent** — re-running the same chunk with the
   same data must produce the same result without side effects.
4. **Set explicit resource limits (memory, CPU, connections)** — prevent batch
   jobs from starving online services of resources.
5. **Process data in chunks of 500-5000 records** — too small wastes overhead;
   too large risks memory exhaustion and long retry windows.
6. **Run batch jobs during off-peak hours** — schedule with timezone awareness
   and verify production traffic patterns before choosing windows.
7. **Emit progress metrics every chunk** — report processed count, error count,
   estimated time remaining for operational visibility.
8. **Use bulk/batch database operations** — prefer multi-row `INSERT ... VALUES`
   or `unnest()` over row-by-row inserts.
9. **Implement graceful shutdown** — on SIGTERM, finish current chunk, save
   checkpoint, then exit cleanly.
10. **Test batch jobs with production-scale data volumes** — performance
    characteristics change dramatically between 1K and 10M rows.

---

## Anti-Patterns

| # | Anti-Pattern | Problem | Correct Approach |
|---|---|---|---|
| 1 | No checkpointing | Hours of work lost on failure | Checkpoint after every chunk; resume from last position |
| 2 | OFFSET pagination | O(n^2) performance degradation | Keyset pagination (WHERE id > last_id ORDER BY id) |
| 3 | Row-by-row DB operations | 1000x slower than bulk | Batch INSERT/UPDATE with parameterized bulk queries |
| 4 | Unbounded worker count | OOM kills, connection pool exhaustion | Set worker count based on resource profiling |
| 5 | Shared connection pool with API | Batch saturates pool, API fails | Separate connection pool or database replica for batch |
| 6 | No execution timeout | Zombie jobs hold locks indefinitely | Set max execution time; alert if exceeded |
| 7 | No downstream backpressure | Overwhelms downstream services | Rate-limit output; use semaphore for concurrent calls |
| 8 | Overlapping batch runs | Duplicates or conflicts | Distributed lock or ensure previous run completed first |

---

## Enforcement Checklist

- [ ] Every batch job has a checkpoint/resume mechanism
- [ ] Keyset pagination is used (no OFFSET for large datasets)
- [ ] Chunk size is configurable via environment variable (default 1000)
- [ ] Resource limits (memory, CPU, connections) are explicitly set
- [ ] Batch operations use bulk database queries (no row-by-row)
- [ ] Idempotency verified: re-running a completed batch produces no side effects
- [ ] Graceful shutdown handler saves checkpoint on SIGTERM
- [ ] Progress metrics emitted (processed count, error rate, ETA)
- [ ] Batch schedule avoids peak traffic windows (documented and reviewed)
- [ ] Timeout configured for maximum execution duration
- [ ] Separate connection pool or database replica used for batch workloads
- [ ] End-to-end test with production-scale data volume before deployment
