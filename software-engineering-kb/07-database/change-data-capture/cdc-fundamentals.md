# Change Data Capture (CDC) Fundamentals

> **Domain:** Database > Change Data Capture > Fundamentals
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Change Data Capture (CDC) streams database changes (INSERT, UPDATE, DELETE) as events to downstream systems in real-time. Without CDC, keeping search indexes, caches, analytics databases, and other services synchronized requires polling (inefficient), dual writes (inconsistent), or batch ETL (delayed). CDC captures changes directly from the database's transaction log (WAL/binlog), providing reliable, ordered, and complete change streams without impacting application code. Every system that needs real-time data synchronization between databases or services MUST use CDC.

---

## How It Works

### CDC Architecture

```
CDC Data Flow:
┌──────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
│           │     │           │     │           │     │           │
│ PostgreSQL│────>│  CDC      │────>│  Kafka    │────>│ Consumers │
│ (WAL)     │     │ (Debezium)│     │ (Events)  │     │           │
│           │     │           │     │           │     │ • Elastic │
└──────────┘     └───────────┘     └───────────┘     │ • Redis   │
                                                       │ • DWH     │
  Source DB         Capture           Transport        │ • Service │
  writes data       reads WAL         streams events   └───────────┘
  normally          no app changes    durable, ordered    react to
                                                          changes
```

### CDC Methods

```
CDC Implementation Approaches:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  1. Log-Based CDC (Recommended)                           │
│     Source: Database transaction log (WAL, binlog)        │
│     ✅ No application changes required                   │
│     ✅ Captures ALL changes (even direct SQL)            │
│     ✅ Minimal performance impact on source DB           │
│     ✅ Guaranteed ordering and completeness              │
│     Tool: Debezium, AWS DMS, pglogical                    │
│                                                            │
│  2. Trigger-Based CDC                                     │
│     Source: Database triggers fire on data changes        │
│     ✅ Works with any database                           │
│     ❌ Performance overhead on every write               │
│     ❌ Complex trigger logic                             │
│     ❌ Tight coupling to schema                          │
│     Tool: Custom triggers, audit tables                   │
│                                                            │
│  3. Timestamp-Based CDC (Polling)                         │
│     Source: Poll for rows WHERE updated_at > last_check  │
│     ✅ Simple to implement                               │
│     ❌ Cannot detect deletes                             │
│     ❌ Delay between change and detection                │
│     ❌ Misses changes if updated_at not set              │
│     Tool: Custom polling, Airbyte incremental            │
│                                                            │
│  4. Application-Level CDC (Outbox Pattern)               │
│     Source: Application writes events to outbox table    │
│     ✅ Full control over event schema                    │
│     ✅ Transactional with business operation             │
│     ❌ Requires application code changes                 │
│     ❌ Only captures changes from application            │
│     Tool: Debezium outbox connector, custom              │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### PostgreSQL Logical Decoding

```sql
-- PostgreSQL: Enable logical replication (prerequisite for CDC)
-- postgresql.conf:
--   wal_level = logical
--   max_replication_slots = 10
--   max_wal_senders = 10

-- Create a replication slot (captures WAL changes)
SELECT pg_create_logical_replication_slot('my_slot', 'pgoutput');

-- Create publication (specify which tables to track)
CREATE PUBLICATION my_publication FOR TABLE users, orders;

-- Or track all tables
CREATE PUBLICATION my_publication FOR ALL TABLES;

-- View changes from the slot (for debugging)
SELECT * FROM pg_logical_slot_peek_changes('my_slot', NULL, NULL);

-- Consume changes (advances the slot)
SELECT * FROM pg_logical_slot_get_changes('my_slot', NULL, NULL);

-- Monitor replication slot lag
SELECT
    slot_name,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS lag_size,
    active
FROM pg_replication_slots;
```

### Change Event Schema

```json
// Debezium change event (Kafka message)
{
  "schema": { "...": "..." },
  "payload": {
    "before": {
      "id": 1,
      "email": "alice@example.com",
      "name": "Alice",
      "role": "user"
    },
    "after": {
      "id": 1,
      "email": "alice@example.com",
      "name": "Alice Smith",
      "role": "admin"
    },
    "source": {
      "version": "2.5.0",
      "connector": "postgresql",
      "name": "myapp",
      "ts_ms": 1710028800000,
      "db": "mydb",
      "schema": "public",
      "table": "users",
      "lsn": 123456789,
      "txId": 42
    },
    "op": "u",
    "ts_ms": 1710028800100,
    "transaction": {
      "id": "42",
      "total_order": 3,
      "data_collection_order": 1
    }
  }
}

// Operation types:
// "c" = CREATE (INSERT)
// "u" = UPDATE
// "d" = DELETE
// "r" = READ (snapshot)
// "t" = TRUNCATE
```

### CDC Consumers

```typescript
// TypeScript — Kafka CDC consumer for Elasticsearch sync
import { Kafka, EachMessagePayload } from 'kafkajs';
import { Client as ESClient } from '@elastic/elasticsearch';

const kafka = new Kafka({ brokers: ['kafka:9092'] });
const consumer = kafka.consumer({ groupId: 'es-sync' });
const es = new ESClient({ node: 'http://elasticsearch:9200' });

async function startCDCConsumer() {
  await consumer.connect();
  await consumer.subscribe({
    topics: ['myapp.public.users', 'myapp.public.orders'],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }: EachMessagePayload) => {
      const event = JSON.parse(message.value!.toString());
      const { op, before, after } = event.payload;
      const table = event.payload.source.table;

      switch (op) {
        case 'c': // INSERT
        case 'r': // SNAPSHOT READ
          await es.index({
            index: table,
            id: after.id.toString(),
            body: after,
          });
          break;

        case 'u': // UPDATE
          await es.update({
            index: table,
            id: after.id.toString(),
            body: { doc: after },
          });
          break;

        case 'd': // DELETE
          await es.delete({
            index: table,
            id: before.id.toString(),
          }).catch(() => {}); // Ignore if already deleted
          break;
      }

      console.log(`[${table}] ${op}: id=${(after || before).id}`);
    },
  });
}
```

```go
// Go — CDC consumer for cache invalidation
package cdc

import (
    "context"
    "encoding/json"
    "fmt"

    "github.com/redis/go-redis/v9"
    "github.com/segmentio/kafka-go"
)

type ChangeEvent struct {
    Payload struct {
        Op     string          `json:"op"`
        Before json.RawMessage `json:"before"`
        After  json.RawMessage `json:"after"`
        Source struct {
            Table string `json:"table"`
        } `json:"source"`
    } `json:"payload"`
}

func StartCacheInvalidator(ctx context.Context, rdb *redis.Client) error {
    reader := kafka.NewReader(kafka.ReaderConfig{
        Brokers:  []string{"kafka:9092"},
        GroupID:  "cache-invalidator",
        Topic:    "myapp.public.users",
        MinBytes: 1,
        MaxBytes: 10e6,
    })
    defer reader.Close()

    for {
        msg, err := reader.ReadMessage(ctx)
        if err != nil {
            return fmt.Errorf("read message: %w", err)
        }

        var event ChangeEvent
        if err := json.Unmarshal(msg.Value, &event); err != nil {
            continue
        }

        // Extract ID from before or after
        var record map[string]interface{}
        if event.Payload.After != nil {
            json.Unmarshal(event.Payload.After, &record)
        } else if event.Payload.Before != nil {
            json.Unmarshal(event.Payload.Before, &record)
        }

        if id, ok := record["id"]; ok {
            key := fmt.Sprintf("user:%v", id)
            rdb.Del(ctx, key) // Invalidate cache
            fmt.Printf("Cache invalidated: %s (op=%s)\n", key, event.Payload.Op)
        }
    }
}
```

### Outbox Pattern with CDC

```
Outbox Pattern Architecture:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  Application writes business data + outbox event          │
│  in a SINGLE transaction:                                 │
│                                                            │
│  BEGIN;                                                    │
│    INSERT INTO orders (...) VALUES (...);                 │
│    INSERT INTO outbox (                                  │
│      aggregate_type, aggregate_id, event_type, payload   │
│    ) VALUES (                                            │
│      'Order', '123', 'OrderCreated', '{"total": 99.99}' │
│    );                                                    │
│  COMMIT;                                                  │
│                                                            │
│  Debezium reads outbox table via CDC:                     │
│  outbox → Kafka → consumers                              │
│                                                            │
│  ✅ Guaranteed consistency (same transaction)             │
│  ✅ Custom event schema (not raw DB changes)             │
│  ✅ Decoupled from application publishing logic          │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

```sql
-- Outbox table schema
CREATE TABLE outbox (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(100) NOT NULL,   -- e.g., 'Order', 'User'
    aggregate_id   VARCHAR(100) NOT NULL,   -- e.g., order ID
    event_type     VARCHAR(100) NOT NULL,   -- e.g., 'OrderCreated'
    payload        JSONB NOT NULL,          -- event data
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Debezium reads this table, publishes to Kafka, and
-- the outbox connector automatically deletes processed rows
```

### CDC vs Other Approaches

```
┌────────────────┬────────────┬────────────┬──────────────┬──────────┐
│ Dimension       │ CDC (WAL)  │ Dual Write │ Polling      │ ETL Batch│
├────────────────┼────────────┼────────────┼──────────────┼──────────┤
│ Latency         │ Seconds    │ Immediate  │ Minutes      │ Hours    │
│ Consistency     │ Guaranteed │ Eventual*  │ Eventual     │ Eventual │
│ Captures DELETEs│ Yes        │ Yes        │ No           │ Partial  │
│ App changes     │ None       │ Required   │ Minimal      │ None     │
│ DB impact       │ Minimal    │ 2x writes  │ Read load    │ Read load│
│ Ordering        │ Guaranteed │ No         │ No           │ No       │
│ Complexity      │ Medium     │ High       │ Low          │ Medium   │
│ Failure mode    │ Lag/catch-up│ Inconsist.│ Missing data │ Stale    │
│ Schema evolution│ Automatic  │ Manual     │ Manual       │ Manual   │
└────────────────┴────────────┴────────────┴──────────────┴──────────┘

* Dual write: if one write fails, data is inconsistent
```

---

## Best Practices

1. **ALWAYS use log-based CDC** over trigger-based or polling — lowest impact, most reliable
2. **ALWAYS use the outbox pattern** for domain events — transactional consistency with messaging
3. **ALWAYS monitor replication slot lag** — growing lag means consumers are falling behind
4. **ALWAYS handle schema evolution** in CDC consumers — add/remove columns gracefully
5. **ALWAYS set appropriate WAL retention** — enough to recover from consumer downtime
6. **ALWAYS idempotent consumers** — CDC events may be replayed during recovery
7. **NEVER use dual writes** as a synchronization strategy — one write can fail silently
8. **NEVER ignore CDC lag** — growing lag leads to WAL disk exhaustion on source DB
9. **NEVER modify CDC events** in transit — consumers should handle raw events
10. **NEVER rely on polling for DELETE detection** — polling cannot detect deleted rows

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Dual writes for sync | Inconsistent data between systems | Use CDC or outbox pattern |
| Polling for changes | Missing deletes, high latency | Use log-based CDC |
| Ignoring replication lag | WAL disk fills up, DB crashes | Monitor and alert on lag |
| Non-idempotent consumers | Duplicate processing on replay | Make consumers idempotent |
| No schema evolution handling | Consumers break on schema change | Handle unknown fields gracefully |
| Trigger-based CDC at scale | Performance degradation | Switch to log-based CDC (Debezium) |
| No dead letter queue | Failed events lost forever | Route failures to DLQ |
| Unbounded WAL retention | Disk exhaustion | Set max_slot_wal_keep_size |

---

## Enforcement Checklist

- [ ] Log-based CDC used (not triggers or polling)
- [ ] Replication slots monitored for lag
- [ ] WAL retention configured with safety limits
- [ ] Outbox pattern used for domain events
- [ ] CDC consumers are idempotent
- [ ] Schema evolution handled in consumers
- [ ] Dead letter queue for failed events
- [ ] CDC pipeline tested in staging environment
