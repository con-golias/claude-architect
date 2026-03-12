# Message Error Handling & Dead-Letter Queues

> **AI Plugin Directive — Failed Message Handling, DLQ Management & Poison Message Prevention**
> You are an AI coding assistant. When generating, reviewing, or refactoring message error
> handling, follow EVERY rule in this document. Without proper error handling, failed messages
> disappear or loop forever. Treat each section as non-negotiable.

**Core Rule: ALWAYS configure a dead-letter queue (DLQ) for every queue. ALWAYS retry with backoff before sending to DLQ. ALWAYS alert on DLQ depth. ALWAYS provide a way to replay DLQ messages after fixing the issue.**

---

## 1. Error Handling Flow

```
┌──────────────────────────────────────────────────────────────┐
│              Message Error Handling Flow                       │
│                                                               │
│  Message received                                            │
│  ├── Process succeeds → ACK                                 │
│  ├── Process fails (transient) → retry with backoff         │
│  │   ├── Retry 1: 1s delay                                  │
│  │   ├── Retry 2: 5s delay                                  │
│  │   ├── Retry 3: 30s delay                                 │
│  │   └── Max retries exceeded → DLQ                        │
│  ├── Process fails (permanent) → DLQ immediately           │
│  │   ├── Validation error (bad message format)              │
│  │   ├── Business rule violation                            │
│  │   └── Missing required data                              │
│  └── Process fails (poison message) → DLQ + alert          │
│      └── Message that crashes consumer repeatedly           │
│                                                               │
│  DLQ Management:                                             │
│  ├── Monitor: alert when DLQ depth > 0                      │
│  ├── Investigate: read message, identify root cause         │
│  ├── Fix: deploy fix or data correction                     │
│  └── Replay: move messages from DLQ back to main queue     │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript Implementation

```typescript
interface RetryableMessage {
  originalMessage: unknown;
  retryCount: number;
  lastError: string;
  firstFailedAt: string;
}

async function processWithRetry(
  message: unknown,
  handler: (msg: unknown) => Promise<void>,
  queue: MessageQueue,
  dlqTopic: string,
  maxRetries = 3,
): Promise<void> {
  const retryCount = (message as any).metadata?.retryCount ?? 0;

  try {
    await handler(message);
  } catch (error) {
    const err = error as Error;

    // Permanent failure — DLQ immediately
    if (isPermanentError(err)) {
      await queue.publish(dlqTopic, {
        originalMessage: message,
        error: err.message,
        reason: "permanent_error",
        timestamp: new Date().toISOString(),
      });
      logger.error("Message sent to DLQ (permanent)", { error: err.message });
      metrics.increment("dlq.messages", { reason: "permanent" });
      return;
    }

    // Transient failure — retry or DLQ
    if (retryCount >= maxRetries) {
      await queue.publish(dlqTopic, {
        originalMessage: message,
        error: err.message,
        reason: "max_retries_exceeded",
        retryCount,
        timestamp: new Date().toISOString(),
      });
      logger.error("Message sent to DLQ (max retries)", { retryCount, error: err.message });
      metrics.increment("dlq.messages", { reason: "max_retries" });
      return;
    }

    // Retry with backoff
    const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s, 8s...
    await sleep(delay);
    (message as any).metadata = { ...(message as any).metadata, retryCount: retryCount + 1 };
    await queue.publish((message as any).type, message); // Re-enqueue
    logger.warn("Message retry scheduled", { retryCount: retryCount + 1, delay });
  }
}

function isPermanentError(err: Error): boolean {
  if (err instanceof ValidationError) return true;
  if (err instanceof NotFoundError) return true;
  if (err.message.includes("invalid format")) return true;
  return false;
}
```

---

## 3. DLQ Replay Tool

```typescript
// Admin endpoint to replay DLQ messages
async function replayDLQ(dlqTopic: string, targetTopic: string, limit: number): Promise<number> {
  const messages = await queue.consume(dlqTopic, limit);
  let replayed = 0;

  for (const msg of messages) {
    try {
      const original = msg.originalMessage;
      // Reset retry count
      original.metadata = { ...original.metadata, retryCount: 0 };
      await queue.publish(targetTopic, original);
      await queue.ack(msg);
      replayed++;
    } catch (err) {
      logger.error("Replay failed", { messageId: msg.id, error: (err as Error).message });
      break;
    }
  }

  logger.info("DLQ replay complete", { replayed, total: messages.length });
  return replayed;
}
```

```go
func ReplayDLQ(ctx context.Context, consumer *kafka.Consumer, producer *kafka.Producer, dlqTopic, targetTopic string, limit int) (int, error) {
    replayed := 0
    for i := 0; i < limit; i++ {
        msg, err := consumer.ReadMessage(1 * time.Second)
        if err != nil {
            break
        }

        err = producer.Produce(&kafka.Message{
            TopicPartition: kafka.TopicPartition{Topic: &targetTopic, Partition: kafka.PartitionAny},
            Key:            msg.Key,
            Value:          msg.Value,
        }, nil)
        if err != nil {
            return replayed, fmt.Errorf("replay publish: %w", err)
        }

        consumer.CommitMessage(msg)
        replayed++
    }
    return replayed, nil
}
```

---

## 4. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No DLQ | Failed messages lost or loop forever | DLQ per queue with monitoring |
| No retry before DLQ | Transient errors sent to DLQ | 3 retries with backoff first |
| No DLQ monitoring | Failed messages pile up unnoticed | Alert when DLQ depth > 0 |
| No replay mechanism | DLQ messages stuck forever | Admin tool to replay to main queue |
| Retry permanent errors | Wasted retries | Classify: transient vs permanent |
| No error context in DLQ | Cannot debug failed messages | Include original message + error |

---

## 5. Enforcement Checklist

- [ ] Dead-letter queue configured for every main queue
- [ ] Retry with exponential backoff (3 attempts) before DLQ
- [ ] Permanent errors sent to DLQ immediately (no retry)
- [ ] DLQ messages include original message, error, timestamp
- [ ] DLQ depth monitored with alerting (threshold: > 0)
- [ ] DLQ replay tool available for operators
- [ ] Poison message detection (same message fails N times)
- [ ] DLQ retention configured (30+ days)
