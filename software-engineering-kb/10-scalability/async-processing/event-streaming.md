# Event Streaming at Scale

> **Domain:** Scalability > Async Processing
> **Importance:** High
> **Last Updated:** 2026-03-10
> **Cross-references:**
> - `06-backend/message-queues/kafka.md` — Kafka fundamentals
> - `10-scalability/async-processing/message-queues.md` — queue-based scaling
> - `03-architecture/architectural-patterns/event-driven/overview.md` — event-driven architecture

---

## Core Concepts

### Event Streaming vs Message Queuing

| Characteristic | Event Streaming | Message Queuing |
|---|---|---|
| Retention | Persistent (days/weeks/indefinite) | Until consumed |
| Consumers | Multiple independent readers (replay) | Competing consumers (one delivery) |
| Ordering | Per-partition guaranteed | Per-queue guaranteed |
| Use case | Event sourcing, analytics, audit logs | Task distribution, work queues |
| Scaling model | Add partitions + consumer groups | Add consumers to queue |

**Use event streaming when:** multiple services need the same event, events must
be replayable, or you need a durable event log.

**Use message queuing when:** work must be processed exactly once by one worker
or you need priority-based processing.

### Kafka Architecture for Scale

**Partitions** are the unit of parallelism. Throughput scales linearly with partition count.
**Consumer groups** enable horizontal scaling. Each partition is assigned to exactly one
consumer within a group. **In-Sync Replicas (ISR)** determine write durability. Configure
`min.insync.replicas=2` with `acks=all` to survive single-broker failure without data loss.

### Event Schema Evolution

Use a schema registry (Confluent Schema Registry, Apicurio) with Avro or Protobuf.

| Mode | Add field | Remove field | Change type |
|---|---|---|---|
| BACKWARD | Yes (with default) | Yes | No |
| FORWARD | Yes | Yes (with default) | No |
| FULL | Yes (with default) | Yes (with default) | No |

Choose FULL compatibility for maximum safety in production topics.

---

## Code Examples

### TypeScript: KafkaJS Producer with Partitioning Strategy

```typescript
import { Kafka, Partitioners, CompressionTypes } from "kafkajs";

const kafka = new Kafka({
  clientId: "order-service",
  brokers: process.env.KAFKA_BROKERS!.split(","),
  ssl: true,
  sasl: { mechanism: "scram-sha-256", username: process.env.KAFKA_USER!, password: process.env.KAFKA_PASS! },
});

const producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner,
  idempotent: true,
  maxInFlightRequests: 5,
  transactionalId: "order-producer-1",
});

async function publishOrderEvents(orders: OrderEvent[]): Promise<void> {
  await producer.connect();
  const messages = orders.map((order) => ({
    key: order.customerId,
    value: JSON.stringify(order),
    headers: {
      "event-type": order.type,
      "schema-version": "2",
      "correlation-id": order.correlationId,
    },
  }));

  const transaction = await producer.transaction();
  try {
    await transaction.send({ topic: "orders.events", compression: CompressionTypes.LZ4, messages });
    await transaction.send({
      topic: "orders.analytics",
      compression: CompressionTypes.LZ4,
      messages: messages.map((m) => ({ ...m, value: JSON.stringify({ summary: true, key: m.key }) })),
    });
    await transaction.commit();
  } catch (err) {
    await transaction.abort();
    throw err;
  }
}
```

### Go: Confluent Kafka Consumer with Offset Management

```go
package main

import (
    "context"
    "encoding/json"
    "log"
    "os"
    "os/signal"
    "time"
    "github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

func main() {
    consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
        "bootstrap.servers":             os.Getenv("KAFKA_BROKERS"),
        "group.id":                      "order-processor",
        "auto.offset.reset":             "earliest",
        "enable.auto.commit":            false,
        "max.poll.interval.ms":          300000,
        "session.timeout.ms":            30000,
        "partition.assignment.strategy":  "cooperative-sticky",
        "fetch.min.bytes":               1024,
    })
    if err != nil {
        log.Fatal(err)
    }
    defer consumer.Close()
    consumer.SubscribeTopics([]string{"orders.events"}, rebalanceCallback)

    ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
    defer cancel()

    batch := make([]*kafka.Message, 0, 100)
    ticker := time.NewTicker(5 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            flushBatch(consumer, batch)
            return
        case <-ticker.C:
            if len(batch) > 0 { flushBatch(consumer, batch); batch = batch[:0] }
        default:
            msg, err := consumer.ReadMessage(100 * time.Millisecond)
            if err != nil { continue }
            batch = append(batch, msg)
            if len(batch) >= 100 { flushBatch(consumer, batch); batch = batch[:0] }
        }
    }
}

func flushBatch(c *kafka.Consumer, batch []*kafka.Message) {
    for _, msg := range batch {
        var event OrderEvent
        if err := json.Unmarshal(msg.Value, &event); err != nil { continue }
        if err := processEvent(event); err != nil { return } // do not commit on failure
    }
    c.Commit()
}

func rebalanceCallback(c *kafka.Consumer, event kafka.Event) error {
    if _, ok := event.(kafka.RevokedPartitions); ok { c.Commit() }
    return nil
}
```

### Python: Faust Stream Processing for Real-Time Aggregations

```python
import faust
from datetime import timedelta
from dataclasses import dataclass

app = faust.App("order-analytics", broker="kafka://kafka-cluster:9092",
                store="rocksdb://", topic_partitions=12)

@dataclass
class OrderEvent(faust.Record):
    order_id: str
    customer_id: str
    amount: float
    region: str

orders_topic = app.topic("orders.events", value_type=OrderEvent)

region_revenue = app.Table(
    "region-revenue", default=float, partitions=12,
).tumbling(timedelta(minutes=5), expires=timedelta(hours=1))

@app.agent(orders_topic, concurrency=4)
async def process_orders(stream):
    async for event in stream:
        region_revenue[event.region] += event.amount
        await enriched_topic.send(key=event.customer_id, value={
            "order_id": event.order_id, "amount": event.amount,
            "region": event.region, "window_total": region_revenue[event.region].current(),
        })

enriched_topic = app.topic("orders.enriched", value_type=dict)

@app.timer(interval=60.0)
async def report_lag():
    for tp in app.consumer.assignment():
        highwater = app.consumer.highwater(tp)
        position = await app.consumer.position(tp)
        if highwater and position:
            metrics.gauge("faust.consumer.lag", highwater - position,
                          tags={"topic": tp.topic, "partition": str(tp.partition)})
```

### Exactly-Once Semantics: Key Configuration

| Side | Setting | Value |
|---|---|---|
| Producer | `enable.idempotence` | `true` |
| Producer | `acks` | `all` |
| Producer | `transactional.id` | unique per instance |
| Broker | `min.insync.replicas` | `2` |
| Broker | `unclean.leader.election.enable` | `false` |
| Consumer | `isolation.level` | `read_committed` |
| Consumer | `enable.auto.commit` | `false` |

### Multi-Datacenter Replication (MirrorMaker 2)

| Parameter | Recommended Value | Rationale |
|---|---|---|
| `replication.factor` | 3 | Match source cluster durability |
| `sync.topic.configs.enabled` | true | Keep topic configs in sync |
| `emit.heartbeats.enabled` | true | Monitor replication health |
| `tasks.max` | >= partition count | Parallelism for replication |

---

## 10 Best Practices

1. **Use a schema registry for all production topics** — enforce compatibility
   checks on every schema change before deployment.
2. **Set partition count based on target throughput** — calculate as
   `target_throughput / per_partition_throughput` and round up.
3. **Enable idempotent producers in every producer instance** — prevents
   duplicate messages from retries at zero performance cost.
4. **Commit offsets after processing, never before** — manual offset commit
   ensures no message loss on consumer failure.
5. **Use LZ4 compression for high-throughput topics** — best compression/speed
   ratio; reduces network and storage costs by 60-80%.
6. **Monitor ISR shrink events as a critical alert** — ISR shrinkage indicates
   broker health issues that threaten data durability.
7. **Set `max.poll.interval.ms` higher than worst-case processing time** — prevents
   spurious rebalances that cause processing pauses.
8. **Include correlation ID and timestamp in every event header** — enables
   end-to-end tracing and latency measurement across services.
9. **Use cooperative-sticky partition assignment** — minimizes rebalance
   disruption by only reassigning partitions that must move.
10. **Retain events for at least 7 days in production** — enables consumer
    replay for debugging and reprocessing without separate backup.

---

## Anti-Patterns

| # | Anti-Pattern | Problem | Correct Approach |
|---|---|---|---|
| 1 | Auto-commit offsets with slow processing | Data loss on crash | Manual commit after successful processing |
| 2 | Single partition for ordered topic | No horizontal scaling | Use partition key for logical ordering; increase partitions |
| 3 | No schema registry | Breaking changes corrupt consumers | Enforce compatibility via registry in CI/CD |
| 4 | Unbounded consumer group rebalances | Stop-the-world pauses | Use static group membership and cooperative assignor |
| 5 | Side effects in Kafka transaction | Non-Kafka effects cannot roll back | Use outbox pattern or idempotent side effects |
| 6 | Enormous events (>1 MB) | Broker memory pressure; slow replication | Store large payloads externally; reference by URI |
| 7 | Consumer group for broadcast | Defeats broadcast intent | Use separate consumer groups per service |
| 8 | No consumer lag monitoring | Silent processing delays | Alert on lag > threshold; auto-scale consumers |

---

## Enforcement Checklist

- [ ] Schema registry deployed; all topics have registered schemas
- [ ] Schema compatibility mode set to BACKWARD or FULL
- [ ] Idempotent producer enabled (`enable.idempotence=true`)
- [ ] Manual offset commit configured (auto-commit disabled)
- [ ] Consumer lag monitoring alerts configured per consumer group
- [ ] ISR shrink alerts set at warning level
- [ ] Replication factor >= 3 and `min.insync.replicas` >= 2
- [ ] Compression enabled (LZ4 or Snappy) on high-throughput topics
- [ ] Event headers include correlation-id, schema-version, and timestamp
- [ ] Multi-datacenter replication validated with failover drill quarterly
- [ ] Load test confirms throughput at 3x expected peak before production
