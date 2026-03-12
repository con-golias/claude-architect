# Webhook Delivery & Reliability

> **Domain:** Backend > Webhooks
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Webhook delivery is the most unreliable thing in distributed computing: you send an HTTP request to a server you do not control, over a network that can fail, to a consumer that may be down. Without robust retry logic, dead letter queues, and delivery guarantees, webhooks become "fire and pray". Stripe, GitHub, and Shopify invest enormous engineering effort in delivery reliability — you should too.

---

## How It Works

### Delivery Lifecycle

```
Event Created
    │
    ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Enqueue  │────▶│ Deliver  │────▶│ Consumer │
│ to Queue │     │ HTTP POST│     │ Response │
└──────────┘     └──────────┘     └─────┬────┘
                                        │
                      ┌─────────────────┼──────────────────┐
                      │                 │                  │
                      ▼                 ▼                  ▼
                 ┌─────────┐     ┌───────────┐     ┌───────────┐
                 │ 2xx OK  │     │ 4xx/5xx   │     │ Timeout   │
                 │ Success │     │ Fail      │     │ / Network │
                 └─────────┘     └─────┬─────┘     └─────┬─────┘
                                       │                 │
                                       ▼                 ▼
                                 ┌───────────┐     ┌───────────┐
                                 │ Retry w/  │     │ Retry w/  │
                                 │ Backoff   │     │ Backoff   │
                                 └─────┬─────┘     └───────────┘
                                       │
                            ┌──────────┼──────────┐
                            │          │          │
                            ▼          ▼          ▼
                       ┌────────┐ ┌────────┐ ┌────────┐
                       │Success │ │Max     │ │Dead    │
                       │        │ │Retries │ │Letter  │
                       │        │ │→ DLQ   │ │Queue   │
                       └────────┘ └────────┘ └────────┘
```

### Retry Strategy — Exponential Backoff

```
Attempt 1:  Immediate          (t = 0)
Attempt 2:  1 minute later     (t = 1m)
Attempt 3:  5 minutes later    (t = 6m)
Attempt 4:  30 minutes later   (t = 36m)
Attempt 5:  2 hours later      (t = 2h 36m)
Attempt 6:  8 hours later      (t = 10h 36m)
Attempt 7:  24 hours later     (t = 34h 36m)
─────────────────────────────────────────────
Max:        7 attempts over ~35 hours
```

### Retry Implementation

```typescript
// TypeScript — Retry Logic with Exponential Backoff + Jitter
interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;  // 0-1, randomness to prevent thundering herd
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 7,
  baseDelayMs: 60_000,        // 1 minute
  maxDelayMs: 86_400_000,     // 24 hours
  backoffMultiplier: 3,
  jitterFactor: 0.2,
};

function calculateDelay(attempt: number, config: RetryConfig): number {
  // Exponential: base * multiplier^(attempt - 1)
  const exponentialDelay =
    config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);

  // Cap at max
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter: ±jitterFactor
  const jitterRange = cappedDelay * config.jitterFactor;
  const jitter = (Math.random() * 2 - 1) * jitterRange;

  return Math.max(0, Math.floor(cappedDelay + jitter));
}

// Determine if error is retryable
function isRetryable(statusCode: number): boolean {
  // 4xx = client error, don't retry (except 408, 429)
  if (statusCode === 408) return true;  // Request Timeout
  if (statusCode === 429) return true;  // Too Many Requests
  if (statusCode >= 400 && statusCode < 500) return false;

  // 5xx = server error, always retry
  if (statusCode >= 500) return true;

  return false;
}

// Process with retry awareness
async function deliverWithRetry(
  job: WebhookJob,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<DeliveryResult> {
  const { event, url, secret } = job;
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = computeHMAC(payload, secret, timestamp);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-ID": event.id,
        "X-Webhook-Timestamp": timestamp.toString(),
        "X-Webhook-Signature": `v1=${signature}`,
        "X-Webhook-Attempt": job.attempt.toString(),
      },
      body: payload,
      signal: AbortSignal.timeout(30_000),
    });

    const result: DeliveryResult = {
      event_id: event.id,
      subscription_id: job.subscription_id,
      status_code: response.status,
      attempt: job.attempt,
      success: response.ok,
      timestamp: new Date(),
    };

    await logDeliveryResult(result);

    if (!response.ok && isRetryable(response.status)) {
      if (job.attempt < config.maxAttempts) {
        const delay = calculateDelay(job.attempt, config);
        await scheduleRetry(job, delay);
      } else {
        await moveToDeadLetterQueue(job, `Max retries exceeded: ${response.status}`);
      }
    } else if (!response.ok) {
      // Non-retryable error (4xx except 408/429)
      await moveToDeadLetterQueue(job, `Non-retryable: ${response.status}`);
    }

    return result;
  } catch (error) {
    // Network error, timeout — always retry
    if (job.attempt < config.maxAttempts) {
      const delay = calculateDelay(job.attempt, config);
      await scheduleRetry(job, delay);
    } else {
      await moveToDeadLetterQueue(job, `Network error: ${error}`);
    }

    return {
      event_id: event.id,
      subscription_id: job.subscription_id,
      status_code: 0,
      attempt: job.attempt,
      success: false,
      error: String(error),
      timestamp: new Date(),
    };
  }
}
```

```go
// Go — Retry Logic
package webhooks

import (
    "context"
    "fmt"
    "math"
    "math/rand"
    "net/http"
    "time"
)

type RetryConfig struct {
    MaxAttempts       int
    BaseDelay         time.Duration
    MaxDelay          time.Duration
    BackoffMultiplier float64
    JitterFactor      float64
}

var DefaultRetryConfig = RetryConfig{
    MaxAttempts:       7,
    BaseDelay:         1 * time.Minute,
    MaxDelay:          24 * time.Hour,
    BackoffMultiplier: 3.0,
    JitterFactor:      0.2,
}

func CalculateDelay(attempt int, cfg RetryConfig) time.Duration {
    exponential := float64(cfg.BaseDelay) * math.Pow(cfg.BackoffMultiplier, float64(attempt-1))
    capped := math.Min(exponential, float64(cfg.MaxDelay))

    jitterRange := capped * cfg.JitterFactor
    jitter := (rand.Float64()*2 - 1) * jitterRange

    delay := time.Duration(math.Max(0, capped+jitter))
    return delay
}

func IsRetryable(statusCode int) bool {
    switch {
    case statusCode == 408, statusCode == 429:
        return true
    case statusCode >= 400 && statusCode < 500:
        return false
    case statusCode >= 500:
        return true
    default:
        return false
    }
}

type DeliveryResult struct {
    EventID        string    `json:"event_id"`
    SubscriptionID string    `json:"subscription_id"`
    StatusCode     int       `json:"status_code"`
    Attempt        int       `json:"attempt"`
    Success        bool      `json:"success"`
    Error          string    `json:"error,omitempty"`
    Timestamp      time.Time `json:"timestamp"`
    Duration       time.Duration `json:"duration_ms"`
}

func (d *Dispatcher) DeliverWithRetry(ctx context.Context, job DeliveryJob, cfg RetryConfig) DeliveryResult {
    start := time.Now()

    result := d.deliver(ctx, job)
    result.Duration = time.Since(start)

    if !result.Success && IsRetryable(result.StatusCode) {
        if job.Attempt < cfg.MaxAttempts {
            delay := CalculateDelay(job.Attempt, cfg)
            job.Attempt++
            d.queue.EnqueueWithDelay(ctx, job, delay)
        } else {
            d.dlq.Enqueue(ctx, job, fmt.Sprintf("max retries: %d", result.StatusCode))
        }
    } else if !result.Success {
        d.dlq.Enqueue(ctx, job, fmt.Sprintf("non-retryable: %d", result.StatusCode))
    }

    return result
}
```

```python
# Python — Retry Logic
import math
import random
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
import httpx

@dataclass
class RetryConfig:
    max_attempts: int = 7
    base_delay_seconds: float = 60.0
    max_delay_seconds: float = 86400.0
    backoff_multiplier: float = 3.0
    jitter_factor: float = 0.2

def calculate_delay(attempt: int, config: RetryConfig) -> float:
    exponential = config.base_delay_seconds * (
        config.backoff_multiplier ** (attempt - 1)
    )
    capped = min(exponential, config.max_delay_seconds)
    jitter_range = capped * config.jitter_factor
    jitter = random.uniform(-jitter_range, jitter_range)
    return max(0, capped + jitter)

def is_retryable(status_code: int) -> bool:
    if status_code in (408, 429):
        return True
    if 400 <= status_code < 500:
        return False
    if status_code >= 500:
        return True
    return False

@dataclass
class DeliveryResult:
    event_id: str
    subscription_id: str
    status_code: int
    attempt: int
    success: bool
    error: str | None = None
    timestamp: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    duration_ms: float = 0.0

class WebhookDeliverer:
    def __init__(self, queue, dlq, config: RetryConfig | None = None):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.queue = queue
        self.dlq = dlq
        self.config = config or RetryConfig()

    async def deliver_with_retry(self, job: dict) -> DeliveryResult:
        start = time.monotonic()

        try:
            timestamp = int(time.time())
            signature = compute_hmac(job["payload"], job["secret"], timestamp)

            response = await self.client.post(
                job["url"],
                content=job["payload"],
                headers={
                    "Content-Type": "application/json",
                    "X-Webhook-ID": job["event_id"],
                    "X-Webhook-Timestamp": str(timestamp),
                    "X-Webhook-Signature": f"v1={signature}",
                    "X-Webhook-Attempt": str(job["attempt"]),
                },
            )

            result = DeliveryResult(
                event_id=job["event_id"],
                subscription_id=job["subscription_id"],
                status_code=response.status_code,
                attempt=job["attempt"],
                success=response.is_success,
                duration_ms=(time.monotonic() - start) * 1000,
            )

            if not response.is_success and is_retryable(response.status_code):
                await self._schedule_retry_or_dlq(job, f"HTTP {response.status_code}")
            elif not response.is_success:
                await self.dlq.enqueue(job, f"non-retryable: {response.status_code}")

            return result

        except (httpx.TimeoutException, httpx.ConnectError) as e:
            result = DeliveryResult(
                event_id=job["event_id"],
                subscription_id=job["subscription_id"],
                status_code=0,
                attempt=job["attempt"],
                success=False,
                error=str(e),
                duration_ms=(time.monotonic() - start) * 1000,
            )
            await self._schedule_retry_or_dlq(job, f"network: {e}")
            return result

    async def _schedule_retry_or_dlq(self, job: dict, reason: str):
        if job["attempt"] < self.config.max_attempts:
            delay = calculate_delay(job["attempt"], self.config)
            job["attempt"] += 1
            await self.queue.enqueue_with_delay(job, timedelta(seconds=delay))
        else:
            await self.dlq.enqueue(job, f"max retries: {reason}")
```

---

## Dead Letter Queue (DLQ)

### DLQ Architecture

```
┌──────────────┐     Max retries     ┌──────────────┐
│   Webhook    │────────────────────▶│  Dead Letter  │
│   Queue      │     exceeded        │  Queue        │
└──────────────┘                     └──────┬───────┘
                                            │
                              ┌─────────────┼──────────────┐
                              │             │              │
                              ▼             ▼              ▼
                         ┌─────────┐  ┌──────────┐  ┌──────────┐
                         │  Alert  │  │  Manual  │  │  Auto    │
                         │  Ops    │  │  Replay  │  │  Replay  │
                         │  Team   │  │  UI      │  │  (cron)  │
                         └─────────┘  └──────────┘  └──────────┘
```

### DLQ Implementation

```typescript
// TypeScript — Dead Letter Queue
interface DeadLetterEntry {
  id: string;
  original_job: WebhookJob;
  failure_reason: string;
  total_attempts: number;
  first_attempt_at: Date;
  last_attempt_at: Date;
  created_at: Date;
  status: "pending" | "replayed" | "discarded";
}

class DeadLetterQueue {
  constructor(private db: Database) {}

  async enqueue(job: WebhookJob, reason: string): Promise<void> {
    const entry: DeadLetterEntry = {
      id: `dlq_${crypto.randomUUID()}`,
      original_job: job,
      failure_reason: reason,
      total_attempts: job.attempt,
      first_attempt_at: job.event.created_at,
      last_attempt_at: new Date(),
      created_at: new Date(),
      status: "pending",
    };

    await this.db.deadLetterEntries.insert(entry);

    // Alert if DLQ is growing
    const pendingCount = await this.db.deadLetterEntries
      .count({ status: "pending" });
    if (pendingCount > 100) {
      await alertOpsTeam("DLQ growing", {
        pending_count: pendingCount,
        latest_reason: reason,
      });
    }
  }

  // Manual replay — re-enqueue specific entries
  async replay(entryIds: string[]): Promise<ReplayResult> {
    const entries = await this.db.deadLetterEntries
      .findMany({ id: { $in: entryIds }, status: "pending" });

    let replayed = 0;
    let failed = 0;

    for (const entry of entries) {
      try {
        // Reset attempt count for replay
        const job = { ...entry.original_job, attempt: 1 };
        await webhookQueue.add(`replay-${entry.id}`, job);
        await this.db.deadLetterEntries.update(entry.id, {
          status: "replayed",
        });
        replayed++;
      } catch (error) {
        failed++;
      }
    }

    return { replayed, failed, total: entries.length };
  }

  // Batch replay — replay all pending from last N hours
  async replayRecent(hours: number): Promise<ReplayResult> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const entries = await this.db.deadLetterEntries.findMany({
      status: "pending",
      created_at: { $gte: since },
    });

    return this.replay(entries.map((e) => e.id));
  }
}
```

---

## Delivery Logging & Monitoring

### Delivery Log Schema

```sql
-- PostgreSQL — Webhook Delivery Log
CREATE TABLE webhook_delivery_logs (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id        TEXT NOT NULL,
    subscription_id TEXT NOT NULL,
    url             TEXT NOT NULL,
    status_code     INT,
    attempt         INT NOT NULL,
    success         BOOLEAN NOT NULL,
    error_message   TEXT,
    request_headers JSONB,
    response_body   TEXT,  -- First 1KB only
    duration_ms     INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_delivery_logs_event ON webhook_delivery_logs(event_id);
CREATE INDEX idx_delivery_logs_sub ON webhook_delivery_logs(subscription_id);
CREATE INDEX idx_delivery_logs_created ON webhook_delivery_logs(created_at DESC);
CREATE INDEX idx_delivery_logs_failed ON webhook_delivery_logs(success, created_at DESC)
    WHERE NOT success;

-- Partitioning by month for large-scale systems
-- (optional, for >10M deliveries/month)
CREATE TABLE webhook_delivery_logs_partitioned (
    LIKE webhook_delivery_logs INCLUDING ALL
) PARTITION BY RANGE (created_at);
```

### Monitoring Metrics

```typescript
// TypeScript — Delivery Metrics
import { Counter, Histogram, Gauge } from "prom-client";

// Delivery success/failure rate
const webhookDeliveryTotal = new Counter({
  name: "webhook_delivery_total",
  help: "Total webhook deliveries",
  labelNames: ["status", "event_type", "subscription_id"],
});

// Delivery latency
const webhookDeliveryDuration = new Histogram({
  name: "webhook_delivery_duration_seconds",
  help: "Webhook delivery duration",
  labelNames: ["event_type"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

// Queue depth
const webhookQueueDepth = new Gauge({
  name: "webhook_queue_depth",
  help: "Number of webhook jobs in queue",
  labelNames: ["queue"],
});

// DLQ size
const webhookDLQSize = new Gauge({
  name: "webhook_dlq_size",
  help: "Number of entries in dead letter queue",
});

// Track metrics in delivery flow
function trackDelivery(result: DeliveryResult, eventType: string): void {
  webhookDeliveryTotal.inc({
    status: result.success ? "success" : "failure",
    event_type: eventType,
    subscription_id: result.subscription_id,
  });

  webhookDeliveryDuration.observe(
    { event_type: eventType },
    result.duration_ms / 1000
  );
}
```

### Key Alerts

| Metric | Threshold | Action |
|--------|-----------|--------|
| Delivery success rate | < 95% over 15min | Page on-call |
| DLQ size | > 100 entries | Alert ops channel |
| Queue depth | > 10,000 jobs | Scale workers |
| P99 delivery latency | > 10s | Investigate slow consumers |
| Consecutive failures per subscription | > 10 | Auto-disable subscription |
| Failed delivery rate per URL | > 50% over 1h | Notify subscription owner |

---

## At-Least-Once Delivery Guarantee

### Idempotency on Consumer Side

Webhooks ALWAYS deliver **at-least-once** — duplicates WILL happen. Consumers MUST handle this.

```typescript
// TypeScript — Idempotent Consumer
import { Redis } from "ioredis";

const redis = new Redis();

async function handleWebhook(req: Request, res: Response): Promise<void> {
  const eventId = req.headers["x-webhook-id"] as string;

  // Check if already processed
  const alreadyProcessed = await redis.set(
    `webhook:processed:${eventId}`,
    "1",
    "EX", 86400 * 7,  // 7 days TTL
    "NX"               // Only set if not exists
  );

  if (!alreadyProcessed) {
    // Already processed — return 200 to stop retries
    res.status(200).json({ status: "already_processed" });
    return;
  }

  try {
    await processEvent(req.body);
    res.status(200).json({ status: "processed" });
  } catch (error) {
    // Delete idempotency key so retry can reprocess
    await redis.del(`webhook:processed:${eventId}`);
    res.status(500).json({ status: "error" });
  }
}
```

```go
// Go — Idempotent Consumer
func (h *WebhookHandler) HandleWebhook(c *gin.Context) {
    eventID := c.GetHeader("X-Webhook-ID")
    if eventID == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "missing event ID"})
        return
    }

    // Atomic check-and-set with Redis
    set, err := h.redis.SetNX(c.Request.Context(),
        fmt.Sprintf("webhook:processed:%s", eventID),
        "1",
        7*24*time.Hour,
    ).Result()
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "dedup check failed"})
        return
    }

    if !set {
        // Already processed
        c.JSON(http.StatusOK, gin.H{"status": "already_processed"})
        return
    }

    var event WebhookEvent[json.RawMessage]
    if err := c.ShouldBindJSON(&event); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    if err := h.processEvent(c.Request.Context(), event); err != nil {
        // Remove idempotency key so retry works
        h.redis.Del(c.Request.Context(),
            fmt.Sprintf("webhook:processed:%s", eventID))
        c.JSON(http.StatusInternalServerError, gin.H{"error": "processing failed"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"status": "processed"})
}
```

### Event Ordering

Webhooks do NOT guarantee ordering. Consumer strategies:

| Strategy | How | When |
|----------|-----|------|
| **Timestamp comparison** | Ignore events older than last processed | Simple counters, status updates |
| **Sequence numbers** | Process only if seq = last_seq + 1 | Critical ordering requirements |
| **Last-write-wins** | Always apply latest timestamp | Non-critical updates |
| **Event sourcing** | Store all events, replay in order | Audit, financial systems |

---

## Automatic Subscription Disabling

```typescript
// TypeScript — Auto-disable failing subscriptions
interface SubscriptionHealth {
  subscription_id: string;
  consecutive_failures: number;
  last_success_at: Date | null;
  last_failure_at: Date | null;
  disabled_at: Date | null;
  disable_reason: string | null;
}

async function checkSubscriptionHealth(
  subscriptionId: string,
  deliverySuccess: boolean
): Promise<void> {
  const health = await getSubscriptionHealth(subscriptionId);

  if (deliverySuccess) {
    // Reset failure counter on success
    await updateSubscriptionHealth(subscriptionId, {
      consecutive_failures: 0,
      last_success_at: new Date(),
    });
    return;
  }

  // Increment failure counter
  const failures = health.consecutive_failures + 1;
  await updateSubscriptionHealth(subscriptionId, {
    consecutive_failures: failures,
    last_failure_at: new Date(),
  });

  // Auto-disable after threshold
  if (failures >= 50) {
    await disableSubscription(subscriptionId, {
      reason: `${failures} consecutive delivery failures`,
      disabled_at: new Date(),
    });

    // Notify subscription owner
    await sendNotification(subscriptionId, {
      type: "webhook.disabled",
      reason: "Too many consecutive failures",
      failures,
      last_success: health.last_success_at,
    });
  } else if (failures >= 10) {
    // Warning at 10 failures
    await sendNotification(subscriptionId, {
      type: "webhook.failing",
      reason: "Multiple consecutive failures",
      failures,
    });
  }
}
```

---

## Polling Fallback — Events API

NEVER rely only on webhooks. ALWAYS provide a polling endpoint as backup.

```typescript
// TypeScript — Events API for Polling Fallback
router.get("/events", async (req, res) => {
  const {
    type,           // Filter by event type
    after,          // Cursor: event ID to start after
    since,          // ISO timestamp to start from
    limit = 25,     // Max events per page (max 100)
  } = req.query;

  const query: EventQuery = {
    organization_id: req.auth.organizationId,
  };

  if (type) query.type = type as string;
  if (after) query.after_id = after as string;
  if (since) query.since = new Date(since as string);

  const maxLimit = Math.min(Number(limit), 100);
  const events = await getEvents(query, maxLimit + 1);

  const hasMore = events.length > maxLimit;
  const data = events.slice(0, maxLimit);

  res.json({
    data,
    has_more: hasMore,
    next_cursor: hasMore ? data[data.length - 1].id : null,
  });
});
```

This allows consumers to:
1. **Initial sync** — fetch all events from beginning
2. **Catch-up** — fetch missed events after downtime
3. **Verification** — confirm webhook data matches source
4. **Debugging** — investigate specific events

---

## Best Practices

1. **ALWAYS implement exponential backoff with jitter** — prevents thundering herd on recovery
2. **ALWAYS set 30s delivery timeout** — don't block on slow consumers forever
3. **ALWAYS log every delivery attempt** — status code, duration, attempt number
4. **ALWAYS provide DLQ with manual replay** — failed webhooks must be recoverable
5. **ALWAYS auto-disable subscriptions after N failures** — prevent wasting resources
6. **ALWAYS provide Events API as polling fallback** — webhooks alone are insufficient
7. **ALWAYS include attempt number in headers** — consumer knows if it's first or retry
8. **NEVER retry 4xx errors (except 408, 429)** — they indicate client misconfiguration
9. **NEVER delete failed events** — retain in DLQ for at least 30 days
10. **NEVER assume ordered delivery** — consumers must handle out-of-order events

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| Fixed retry intervals | Thundering herd on service recovery | Exponential backoff + jitter |
| No retry limit | Infinite retries waste resources | 5-7 attempts max, then DLQ |
| Retrying 4xx errors | Permanent loop on bad requests | Only retry 5xx, 408, 429, network errors |
| No delivery logging | Impossible to debug failures | Log every attempt with full context |
| No DLQ | Failed events permanently lost | DLQ with replay capability |
| Synchronous processing by consumer | Slow processing = timeout = retry storm | Consumer: acknowledge fast, process async |
| No idempotency | Duplicate processing on retries | Consumer: check event ID before processing |
| No polling fallback | Missed webhooks = missed data forever | Provide GET /events endpoint |
| No subscription health tracking | Dead endpoints waste delivery resources | Auto-disable after consecutive failures |
| Giant payloads | Timeouts, memory issues | Max 256KB payload, use thin events + API link |
| No timeout on delivery | Worker stuck on hanging connection | 30s timeout per delivery |
| Shared retry queue | Slow consumer blocks all deliveries | Per-subscription or per-URL queues |

---

## Real-world Examples

### Stripe Retry Schedule
- 8 retry attempts over 3 days
- Schedule: immediately, 1h, 2h, 4h, 8h, 24h, 48h, 72h
- Auto-disables endpoint after all retries fail
- Dashboard shows delivery attempts with status codes
- Manual retry button per event

### GitHub Webhook Delivery
- 3 retry attempts within hours
- Shows full request/response in UI per delivery
- `Recent Deliveries` tab in webhook settings
- Redeliver button per delivery
- Ping endpoint for testing

### Shopify Webhooks
- 19 retry attempts over 48 hours
- Removes webhook subscription after consecutive failures
- Mandatory `200 OK` response within 5 seconds
- Provides both REST and GraphQL event APIs as fallback
