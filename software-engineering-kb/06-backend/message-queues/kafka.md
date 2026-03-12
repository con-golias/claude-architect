# Apache Kafka

> **AI Plugin Directive — Kafka Producers, Consumers & Operational Patterns**
> You are an AI coding assistant. When generating, reviewing, or refactoring Kafka code,
> follow EVERY rule in this document. Incorrect Kafka configuration causes message loss,
> consumer lag, and rebalance storms. Treat each section as non-negotiable.

**Core Rule: ALWAYS use consumer groups for parallel consumption. ALWAYS commit offsets AFTER successful processing. ALWAYS configure `acks=all` for producers (no message loss). ALWAYS use idempotent producers. ALWAYS partition by business key for ordering.**

---

## 1. Kafka Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Kafka Architecture                                │
│                                                               │
│  Producer → Topic (partitioned) → Consumer Group             │
│                                                               │
│  Topic: "orders"                                             │
│  ├── Partition 0: [msg1, msg4, msg7, ...]  → Consumer A    │
│  ├── Partition 1: [msg2, msg5, msg8, ...]  → Consumer B    │
│  └── Partition 2: [msg3, msg6, msg9, ...]  → Consumer C    │
│                                                               │
│  Key concepts:                                               │
│  ├── Partition = unit of parallelism + ordering             │
│  ├── Consumer group = load balancing across consumers       │
│  ├── Offset = position in partition (consumer tracks)       │
│  ├── Replication = fault tolerance (RF=3 minimum)           │
│  └── Retention = how long messages are kept                 │
│                                                               │
│  Ordering: guaranteed WITHIN a partition only                │
│  Scale: add partitions = add consumers (up to N)            │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript Implementation (kafkajs)

```typescript
import { Kafka, Partitioners } from "kafkajs";

const kafka = new Kafka({
  clientId: "order-service",
  brokers: (process.env.KAFKA_BROKERS ?? "").split(","),
  retry: { retries: 5 },
});

// Producer
const producer = kafka.producer({
  idempotent: true,                    // ALWAYS enable
  maxInFlightRequests: 5,
  allowAutoTopicCreation: false,       // NEVER in production
});

async function publishOrderCreated(order: Order): Promise<void> {
  await producer.send({
    topic: "orders",
    messages: [{
      key: order.userId,              // Partition by userId for ordering
      value: JSON.stringify({
        id: randomUUID(),
        type: "order.created",
        timestamp: new Date().toISOString(),
        data: order,
      }),
      headers: {
        "correlation-id": order.requestId,
        "event-type": "order.created",
      },
    }],
    acks: -1,                         // acks=all — wait for all replicas
  });
}

// Consumer
const consumer = kafka.consumer({
  groupId: "order-processor",
  sessionTimeout: 30_000,
  heartbeatInterval: 3_000,
  maxBytesPerPartition: 1_048_576,    // 1 MB
});

async function startConsumer(): Promise<void> {
  await consumer.subscribe({ topic: "orders", fromBeginning: false });

  await consumer.run({
    autoCommit: false,                 // ALWAYS manual commit
    eachMessage: async ({ topic, partition, message }) => {
      const event = JSON.parse(message.value!.toString());

      try {
        // Idempotency check
        if (await isProcessed(event.id)) {
          await consumer.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
          return;
        }

        await processOrder(event.data);
        await markProcessed(event.id);

        // Commit AFTER successful processing
        await consumer.commitOffsets([{
          topic, partition,
          offset: (BigInt(message.offset) + 1n).toString(),
        }]);
      } catch (error) {
        logger.error("Failed to process message", {
          topic, partition, offset: message.offset, error: (error as Error).message,
        });
        // Message will be redelivered (offset not committed)
      }
    },
  });
}
```

---

## 3. Go Implementation (confluent-kafka-go)

```go
import "github.com/confluentinc/confluent-kafka-go/v2/kafka"

func NewProducer() (*kafka.Producer, error) {
    return kafka.NewProducer(&kafka.ConfigMap{
        "bootstrap.servers":   os.Getenv("KAFKA_BROKERS"),
        "acks":                "all",
        "enable.idempotence":  true,
        "max.in.flight":       5,
        "retries":             5,
        "linger.ms":           10,
        "compression.type":    "lz4",
    })
}

func PublishEvent(p *kafka.Producer, topic string, key string, event any) error {
    value, err := json.Marshal(event)
    if err != nil {
        return fmt.Errorf("marshal event: %w", err)
    }

    deliveryChan := make(chan kafka.Event, 1)
    err = p.Produce(&kafka.Message{
        TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
        Key:            []byte(key),
        Value:          value,
        Headers:        []kafka.Header{{Key: "event-type", Value: []byte("order.created")}},
    }, deliveryChan)

    e := <-deliveryChan
    m := e.(*kafka.Message)
    if m.TopicPartition.Error != nil {
        return fmt.Errorf("delivery failed: %w", m.TopicPartition.Error)
    }
    return nil
}

func StartConsumer(ctx context.Context, handler func([]byte) error) error {
    c, _ := kafka.NewConsumer(&kafka.ConfigMap{
        "bootstrap.servers":  os.Getenv("KAFKA_BROKERS"),
        "group.id":           "order-processor",
        "auto.offset.reset":  "latest",
        "enable.auto.commit": false, // ALWAYS manual
        "session.timeout.ms": 30000,
    })
    c.Subscribe("orders", nil)

    for {
        select {
        case <-ctx.Done():
            c.Close()
            return nil
        default:
            msg, err := c.ReadMessage(100 * time.Millisecond)
            if err != nil {
                continue
            }
            if err := handler(msg.Value); err != nil {
                slog.Error("processing failed", "error", err, "offset", msg.TopicPartition.Offset)
                continue // Will be reprocessed
            }
            c.CommitMessage(msg) // Commit after success
        }
    }
}
```

---

## 4. Topic Design

| Topic | Partition Key | Partitions | Retention |
|-------|--------------|------------|-----------|
| `orders` | `userId` | 12 | 7 days |
| `payments` | `orderId` | 6 | 14 days |
| `notifications` | `userId` | 6 | 3 days |
| `audit-log` | `entityId` | 12 | 30 days |
| DLT: `orders.DLT` | original key | 3 | 30 days |

- ALWAYS partition by business key that requires ordering
- ALWAYS create separate dead-letter topic (DLT) per source topic
- ALWAYS set retention based on replay/audit requirements
- NEVER use more partitions than consumers in a group

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| `acks=1` or `acks=0` | Message loss on broker failure | `acks=all` always |
| Auto-commit offsets | Message loss on crash | Manual commit after processing |
| Random partition key | No ordering guarantee | Business key (userId, orderId) |
| Too many partitions | Rebalance storms | Start with 6-12, scale up |
| No idempotent producer | Duplicate messages on retry | `enable.idempotence=true` |
| Consumer processing too slow | Growing lag | Batch processing, more partitions |

---

## 6. Enforcement Checklist

- [ ] `acks=all` configured on producer
- [ ] Idempotent producer enabled
- [ ] Manual offset commit after successful processing
- [ ] Consumer idempotency via dedup check
- [ ] Partition key = business key for ordering
- [ ] Dead-letter topic configured for failed messages
- [ ] Consumer lag monitored with alerting
- [ ] Topic retention configured based on requirements
- [ ] Compression enabled (lz4 or snappy)
