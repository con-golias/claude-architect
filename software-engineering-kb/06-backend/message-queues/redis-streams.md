# Redis Streams

> **AI Plugin Directive — Redis Streams for Lightweight Message Processing**
> You are an AI coding assistant. When generating, reviewing, or refactoring Redis Streams
> code, follow EVERY rule in this document. Redis Streams are powerful but require proper
> consumer group management and acknowledgement. Treat each section as non-negotiable.

**Core Rule: ALWAYS use consumer groups (XREADGROUP) for reliable processing. ALWAYS acknowledge messages (XACK) after processing. ALWAYS handle pending messages (XPENDING + XCLAIM) for crashed consumers. ALWAYS set MAXLEN or MINID to prevent unbounded stream growth.**

---

## 1. Redis Streams Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Redis Streams                                     │
│                                                               │
│  Stream "orders"                                             │
│  ├── 1709000001-0: {userId: "u1", amount: 100}             │
│  ├── 1709000002-0: {userId: "u2", amount: 200}             │
│  └── 1709000003-0: {userId: "u1", amount: 150}             │
│                                                               │
│  Consumer Group "order-processors"                           │
│  ├── Consumer A: assigned 1709000001-0 (acknowledged)       │
│  ├── Consumer B: assigned 1709000002-0 (pending)            │
│  └── Consumer C: assigned 1709000003-0 (processing)         │
│                                                               │
│  Commands:                                                   │
│  ├── XADD: publish message to stream                        │
│  ├── XREADGROUP: consume from group                         │
│  ├── XACK: acknowledge processed message                    │
│  ├── XPENDING: list unacknowledged messages                 │
│  ├── XCLAIM: reassign stuck messages                        │
│  └── XTRIM: limit stream length                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript Implementation (ioredis)

```typescript
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

// Publish to stream
async function publish(stream: string, data: Record<string, string>): Promise<string> {
  return redis.xadd(stream, "MAXLEN", "~", "10000", "*", ...Object.entries(data).flat());
}

// Create consumer group
async function setupGroup(stream: string, group: string): Promise<void> {
  try {
    await redis.xgroup("CREATE", stream, group, "0", "MKSTREAM");
  } catch (err) {
    if (!(err as Error).message.includes("BUSYGROUP")) throw err;
  }
}

// Consumer loop
async function consume(
  stream: string, group: string, consumer: string,
  handler: (id: string, data: Record<string, string>) => Promise<void>,
): Promise<void> {
  await setupGroup(stream, group);

  while (true) {
    // Read new messages
    const results = await redis.xreadgroup(
      "GROUP", group, consumer,
      "COUNT", "10",
      "BLOCK", "5000",       // Block 5s waiting for messages
      "STREAMS", stream, ">", // ">" = new messages only
    );

    if (!results) continue;

    for (const [, messages] of results) {
      for (const [id, fields] of messages) {
        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          data[fields[i]] = fields[i + 1];
        }

        try {
          await handler(id, data);
          await redis.xack(stream, group, id); // ACK after success
        } catch (error) {
          logger.error("Processing failed", { stream, id, error: (error as Error).message });
          // Will show in XPENDING for recovery
        }
      }
    }
  }
}

// Recover pending messages from crashed consumers
async function recoverPending(stream: string, group: string, consumer: string): Promise<void> {
  const pending = await redis.xpending(stream, group, "-", "+", "100");

  for (const [id, owner, idleTime] of pending) {
    if (idleTime > 60_000) { // Idle > 60 seconds
      const claimed = await redis.xclaim(stream, group, consumer, 60_000, id);
      if (claimed.length > 0) {
        logger.info("Claimed pending message", { stream, id, previousOwner: owner });
      }
    }
  }
}
```

---

## 3. Go Implementation (go-redis)

```go
func Publish(ctx context.Context, rdb *redis.Client, stream string, data map[string]any) (string, error) {
    return rdb.XAdd(ctx, &redis.XAddArgs{
        Stream: stream,
        MaxLen: 10000,
        Approx: true,
        Values: data,
    }).Result()
}

func Consume(ctx context.Context, rdb *redis.Client, stream, group, consumer string, handler func(redis.XMessage) error) error {
    // Create group
    rdb.XGroupCreateMkStream(ctx, stream, group, "0")

    for {
        select {
        case <-ctx.Done():
            return nil
        default:
        }

        results, err := rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
            Group:    group,
            Consumer: consumer,
            Streams:  []string{stream, ">"},
            Count:    10,
            Block:    5 * time.Second,
        }).Result()
        if err != nil {
            if errors.Is(err, redis.Nil) { continue }
            return fmt.Errorf("xreadgroup: %w", err)
        }

        for _, stream := range results {
            for _, msg := range stream.Messages {
                if err := handler(msg); err != nil {
                    slog.Error("processing failed", "id", msg.ID, "error", err)
                    continue
                }
                rdb.XAck(ctx, stream.Stream, group, msg.ID)
            }
        }
    }
}
```

---

## 4. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No MAXLEN | Unbounded stream growth, OOM | `MAXLEN ~ 10000` |
| No XACK | Pending list grows forever | Acknowledge after processing |
| No pending recovery | Crashed consumer messages stuck | XPENDING + XCLAIM cron |
| XREAD without group | No consumer coordination | XREADGROUP for reliability |
| No BLOCK | CPU spinning on empty stream | `BLOCK 5000` (5s) |
| Single consumer without group | No fault tolerance | Consumer group even for 1 consumer |

---

## 5. Enforcement Checklist

- [ ] Consumer groups used for all stream consumption
- [ ] Messages acknowledged (XACK) after successful processing
- [ ] MAXLEN configured to prevent unbounded growth
- [ ] Pending message recovery (XPENDING + XCLAIM) runs as cron
- [ ] BLOCK used in XREADGROUP to prevent CPU spinning
- [ ] Consumer name unique per instance
- [ ] Stream depth monitored with alerting
