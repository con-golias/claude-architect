# Messaging Patterns

> **AI Plugin Directive — Event-Driven Patterns, CQRS & Transactional Outbox**
> You are an AI coding assistant. When generating, reviewing, or refactoring messaging
> patterns, follow EVERY rule in this document. Incorrect patterns cause data inconsistency,
> lost events, and tight coupling. Treat each section as non-negotiable.

**Core Rule: ALWAYS use the transactional outbox pattern for reliable event publishing. ALWAYS prefer event-carried state transfer over event notification for cross-service data. ALWAYS use idempotency keys for consumer deduplication. NEVER publish events outside the database transaction.**

---

## 1. Core Messaging Patterns

```
┌──────────────────────────────────────────────────────────────┐
│              Messaging Patterns                                │
│                                                               │
│  POINT-TO-POINT (Task Queue)                                │
│  ├── One producer → one consumer                            │
│  ├── Message consumed by exactly one worker                 │
│  └── Use case: background jobs, work distribution           │
│                                                               │
│  PUBLISH-SUBSCRIBE (Fan-Out)                                │
│  ├── One producer → many consumers                          │
│  ├── Every subscriber gets every message                    │
│  └── Use case: event notifications, audit logging           │
│                                                               │
│  REQUEST-REPLY                                               │
│  ├── Producer sends request, waits for response            │
│  ├── Consumer processes and replies to reply queue          │
│  └── Use case: async RPC, orchestration                    │
│                                                               │
│  EVENT SOURCING                                              │
│  ├── Store events as source of truth                        │
│  ├── Rebuild state by replaying events                      │
│  └── Use case: audit trail, temporal queries               │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Transactional Outbox Pattern

```typescript
// Problem: publishing event + updating DB must be atomic
// Solution: write event to outbox table in same DB transaction

// Step 1: Save entity + outbox event in one transaction
async function createOrder(data: CreateOrderInput): Promise<Order> {
  return db.transaction(async (tx) => {
    // Save order
    const order = await tx.orders.create(data);

    // Save event to outbox (same transaction!)
    await tx.outbox.create({
      id: randomUUID(),
      aggregateType: "Order",
      aggregateId: order.id,
      eventType: "order.created",
      payload: JSON.stringify({ orderId: order.id, ...data }),
      createdAt: new Date(),
      published: false,
    });

    return order;
  });
}

// Step 2: Outbox relay — polls outbox table and publishes
async function outboxRelay(): Promise<void> {
  const unpublished = await db.outbox.findMany({
    where: { published: false },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  for (const event of unpublished) {
    try {
      await messageQueue.publish(event.eventType, JSON.parse(event.payload));
      await db.outbox.update(event.id, { published: true, publishedAt: new Date() });
    } catch (err) {
      logger.error("Outbox publish failed", { eventId: event.id, error: (err as Error).message });
      break; // Preserve ordering
    }
  }
}

// Run relay as scheduled job (every 1-5 seconds)
```

```go
// Go: transactional outbox
func CreateOrder(ctx context.Context, tx *sql.Tx, data OrderInput) (*Order, error) {
    order, err := insertOrder(ctx, tx, data)
    if err != nil {
        return nil, err
    }

    payload, _ := json.Marshal(map[string]any{"orderId": order.ID, "amount": data.Amount})
    _, err = tx.ExecContext(ctx,
        `INSERT INTO outbox (id, aggregate_type, aggregate_id, event_type, payload)
         VALUES ($1, $2, $3, $4, $5)`,
        uuid.New(), "Order", order.ID, "order.created", payload)
    if err != nil {
        return nil, fmt.Errorf("insert outbox: %w", err)
    }

    return order, nil
}
```

- ALWAYS write events to outbox table within the same database transaction
- ALWAYS run outbox relay as a separate process (polling or CDC)
- NEVER publish events directly from application code outside a transaction

---

## 3. Idempotent Consumer

```typescript
// Every consumer MUST be idempotent
// Use message ID + processed set

async function processMessage(message: Message): Promise<void> {
  // Check if already processed
  const key = `processed:${message.id}`;
  const alreadyProcessed = await redis.set(key, "1", "NX", "EX", 86400); // 24h TTL
  if (!alreadyProcessed) {
    logger.info("Duplicate message skipped", { messageId: message.id });
    return;
  }

  try {
    await handleOrderCreated(message.data);
  } catch (error) {
    // Remove processed key on failure (allow retry)
    await redis.del(key);
    throw error;
  }
}
```

```go
func ProcessMessage(ctx context.Context, rdb *redis.Client, msg Message, handler func(any) error) error {
    key := fmt.Sprintf("processed:%s", msg.ID)
    set, err := rdb.SetNX(ctx, key, "1", 24*time.Hour).Result()
    if err != nil {
        return fmt.Errorf("dedup check: %w", err)
    }
    if !set {
        slog.Info("duplicate skipped", "messageId", msg.ID)
        return nil
    }

    if err := handler(msg.Data); err != nil {
        rdb.Del(ctx, key) // Allow retry
        return err
    }
    return nil
}
```

---

## 4. Event-Carried State Transfer

```typescript
// WRONG: event notification (receiver must query back)
interface OrderCreatedEvent {
  orderId: string;
  // Consumer must call Order Service to get details
}

// RIGHT: event-carried state transfer (self-contained)
interface OrderCreatedEvent {
  orderId: string;
  userId: string;
  items: Array<{ productId: string; name: string; quantity: number; price: number }>;
  total: number;
  shippingAddress: Address;
  createdAt: string;
}
// Consumer has everything needed — no callback required
```

- ALWAYS include sufficient data in events for consumers to process without callbacks
- ALWAYS version event schemas for backward compatibility

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Publish outside transaction | Lost events on DB rollback | Transactional outbox |
| No idempotency | Duplicate processing, double charges | Dedup by message ID |
| Callback on event | Tight coupling, extra network calls | Event-carried state transfer |
| No event versioning | Breaking consumer changes | Version field + schema evolution |
| Synchronous publish + wait | Defeats async purpose | Fire and forget with outbox |
| No ordering guarantee | Events processed out of order | Partition by entity ID |

---

## 6. Enforcement Checklist

- [ ] Transactional outbox for all event publishing
- [ ] Consumer idempotency via dedup check (message ID)
- [ ] Events carry sufficient data (no callback needed)
- [ ] Event schemas versioned for backward compatibility
- [ ] Outbox relay runs as separate process
- [ ] Ordering preserved per entity (partition key)
