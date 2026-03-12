# Debezium & CDC Pipelines

> **Domain:** Database > Change Data Capture > Debezium & Pipelines
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Debezium is the industry-standard open-source CDC platform, supporting PostgreSQL, MySQL, MongoDB, SQL Server, and more. It runs as a Kafka Connect connector, reading the database transaction log and publishing structured change events to Kafka topics. Understanding Debezium configuration, deployment patterns, and operational concerns is essential for building reliable data pipelines. Most production CDC implementations use Debezium — it handles the hard problems of snapshotting, schema evolution, exactly-once delivery, and failure recovery.

---

## How It Works

### Debezium Architecture

```
Debezium Deployment Architecture:
┌────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌──────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │PostgreSQL │     │ Kafka Connect│     │    Kafka      │   │
│  │           │────>│  + Debezium  │────>│              │   │
│  │  (WAL)    │     │  Connector   │     │  Topics:     │   │
│  └──────────┘     └──────────────┘     │  • myapp.    │   │
│                                          │    public.   │   │
│  ┌──────────┐     ┌──────────────┐     │    users     │   │
│  │  MySQL    │────>│  Debezium    │────>│  • myapp.    │   │
│  │ (binlog)  │     │  MySQL Conn. │     │    public.   │   │
│  └──────────┘     └──────────────┘     │    orders    │   │
│                                          └──────┬───────┘   │
│                                                  │           │
│                    ┌─────────────────────────────┘           │
│                    ▼                                          │
│  ┌────────────────────────────────────────────────┐         │
│  │  Kafka Consumers                                │         │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐ │         │
│  │  │Elastic   │ │Redis     │ │Data Warehouse  │ │         │
│  │  │Search    │ │Cache     │ │(BigQuery/       │ │         │
│  │  │Sync      │ │Invalidate│ │Snowflake)      │ │         │
│  │  └──────────┘ └──────────┘ └────────────────┘ │         │
│  └────────────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────────┘
```

### Debezium PostgreSQL Connector

```json
// Debezium PostgreSQL connector configuration
// POST to Kafka Connect REST API: http://connect:8083/connectors
{
  "name": "myapp-postgres-connector",
  "config": {
    // Connector class
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",

    // Database connection
    "database.hostname": "postgres-primary",
    "database.port": "5432",
    "database.user": "debezium",
    "database.password": "${file:/secrets/db-password.txt}",
    "database.dbname": "myapp",

    // Logical decoding
    "plugin.name": "pgoutput",
    "slot.name": "debezium_myapp",
    "publication.name": "dbz_publication",

    // Topic naming
    "topic.prefix": "myapp",
    // Topics: myapp.public.users, myapp.public.orders, etc.

    // Table selection
    "table.include.list": "public.users,public.orders,public.order_items",

    // Column filtering (exclude sensitive data)
    "column.exclude.list": "public.users.password_hash,public.users.ssn",

    // Snapshot mode
    "snapshot.mode": "initial",
    // "initial" = snapshot existing data, then stream changes
    // "never" = only stream new changes
    // "when_needed" = snapshot if slot is missing

    // Schema history
    "schema.history.internal.kafka.bootstrap.servers": "kafka:9092",
    "schema.history.internal.kafka.topic": "myapp.schema-history",

    // Transforms — flatten Debezium envelope
    "transforms": "unwrap",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
    "transforms.unwrap.drop.tombstones": "false",
    "transforms.unwrap.delete.handling.mode": "rewrite",
    "transforms.unwrap.add.fields": "op,table,source.ts_ms",

    // Error handling
    "errors.tolerance": "all",
    "errors.log.enable": "true",
    "errors.deadletterqueue.topic.name": "myapp.dlq",

    // Performance
    "max.batch.size": "2048",
    "poll.interval.ms": "500",

    // Heartbeat (prevent slot lag during idle periods)
    "heartbeat.interval.ms": "30000",
    "heartbeat.action.query": "INSERT INTO debezium_heartbeat (ts) VALUES (NOW()) ON CONFLICT (id) DO UPDATE SET ts = NOW()"
  }
}
```

### Debezium MySQL Connector

```json
{
  "name": "myapp-mysql-connector",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "database.hostname": "mysql-primary",
    "database.port": "3306",
    "database.user": "debezium",
    "database.password": "${file:/secrets/db-password.txt}",
    "database.server.id": "184054",

    "topic.prefix": "myapp",
    "database.include.list": "myapp",
    "table.include.list": "myapp.users,myapp.orders",

    "schema.history.internal.kafka.bootstrap.servers": "kafka:9092",
    "schema.history.internal.kafka.topic": "myapp.schema-history",

    "snapshot.mode": "initial",
    "include.schema.changes": "true",

    "database.ssl.mode": "required"
  }
}
```

### Debezium Outbox Connector

```json
// Outbox Event Router — transforms outbox table rows into domain events
{
  "name": "myapp-outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres-primary",
    "database.port": "5432",
    "database.user": "debezium",
    "database.password": "${file:/secrets/db-password.txt}",
    "database.dbname": "myapp",

    "plugin.name": "pgoutput",
    "slot.name": "debezium_outbox",
    "table.include.list": "public.outbox",

    "topic.prefix": "myapp",

    // Outbox Event Router transform
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.table.field.event.id": "id",
    "transforms.outbox.table.field.event.key": "aggregate_id",
    "transforms.outbox.table.field.event.type": "event_type",
    "transforms.outbox.table.field.event.payload": "payload",
    "transforms.outbox.route.by.field": "aggregate_type",
    "transforms.outbox.route.topic.regex": "(.+)",
    "transforms.outbox.route.topic.replacement": "events.$1",
    // Routes to topics like: events.Order, events.User

    // Auto-delete processed outbox rows
    "transforms.outbox.table.expand.json.payload": "true"
  }
}
```

### Docker Compose Setup

```yaml
# docker-compose.yml — Complete CDC pipeline
version: '3.8'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    command:
      - "postgres"
      - "-c"
      - "wal_level=logical"
      - "-c"
      - "max_replication_slots=5"
      - "-c"
      - "max_wal_senders=5"
    ports:
      - "5432:5432"

  zookeeper:
    image: confluentinc/cp-zookeeper:7.6.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  kafka:
    image: confluentinc/cp-kafka:7.6.0
    depends_on: [zookeeper]
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    ports:
      - "9092:9092"

  kafka-connect:
    image: debezium/connect:2.5
    depends_on: [kafka, postgres]
    environment:
      BOOTSTRAP_SERVERS: kafka:9092
      GROUP_ID: connect-cluster
      CONFIG_STORAGE_TOPIC: connect-configs
      OFFSET_STORAGE_TOPIC: connect-offsets
      STATUS_STORAGE_TOPIC: connect-statuses
      CONFIG_STORAGE_REPLICATION_FACTOR: 1
      OFFSET_STORAGE_REPLICATION_FACTOR: 1
      STATUS_STORAGE_REPLICATION_FACTOR: 1
    ports:
      - "8083:8083"

  # Optional: Debezium UI
  debezium-ui:
    image: debezium/debezium-ui:2.5
    depends_on: [kafka-connect]
    environment:
      KAFKA_CONNECT_URIS: http://kafka-connect:8083
    ports:
      - "8080:8080"
```

### Monitoring Debezium

```bash
# Check connector status
curl -s http://kafka-connect:8083/connectors/myapp-postgres-connector/status | jq .

# List all connectors
curl -s http://kafka-connect:8083/connectors | jq .

# Restart failed connector
curl -X POST http://kafka-connect:8083/connectors/myapp-postgres-connector/restart

# Restart failed task
curl -X POST http://kafka-connect:8083/connectors/myapp-postgres-connector/tasks/0/restart

# Delete connector
curl -X DELETE http://kafka-connect:8083/connectors/myapp-postgres-connector
```

```sql
-- PostgreSQL: Monitor replication slot health
SELECT
    slot_name,
    plugin,
    slot_type,
    active,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS lag,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS pending
FROM pg_replication_slots
WHERE slot_type = 'logical';

-- CRITICAL: If lag grows beyond WAL retention, slot becomes invalid
-- Set safety limit:
-- postgresql.conf: max_slot_wal_keep_size = 10GB
```

```typescript
// Prometheus metrics for Debezium monitoring
// Key JMX metrics exposed by Debezium:

// debezium_metrics_MilliSecondsBehindSource
//   → How far behind real-time the connector is
//   → Alert if > 60000 (1 minute behind)

// debezium_metrics_NumberOfEventsFiltered
//   → Events filtered by include/exclude rules

// debezium_metrics_TotalNumberOfEventsSeen
//   → Total events processed since connector start

// debezium_metrics_LastEvent
//   → Timestamp of last event processed

// debezium_metrics_SnapshotCompleted
//   → Whether initial snapshot is complete

// Grafana alert rules:
// ALERT: debezium_lag_critical
//   expr: debezium_metrics_MilliSecondsBehindSource > 300000
//   for: 5m
//   severity: critical
//   description: "Debezium connector is more than 5 minutes behind source"

// ALERT: replication_slot_lag
//   expr: pg_replication_slot_lag_bytes > 1073741824
//   for: 10m
//   severity: warning
//   description: "Replication slot lag exceeds 1GB"
```

### Debezium Server (Kafka-less)

```
Debezium Server (without Kafka):
┌──────────┐     ┌──────────────┐     ┌───────────┐
│PostgreSQL │────>│ Debezium     │────>│ Sink      │
│  (WAL)    │     │ Server       │     │           │
└──────────┘     │ (standalone) │     │ • HTTP    │
                  │              │     │ • Redis   │
                  │ No Kafka     │     │ • Pub/Sub │
                  │ required     │     │ • Kinesis │
                  └──────────────┘     │ • Pulsar  │
                                        └───────────┘

Use when: Kafka is too heavy for your use case
```

```properties
# application.properties — Debezium Server
debezium.source.connector.class=io.debezium.connector.postgresql.PostgresConnector
debezium.source.offset.storage.file.filename=/data/offsets.dat
debezium.source.offset.flush.interval.ms=60000

debezium.source.database.hostname=postgres
debezium.source.database.port=5432
debezium.source.database.user=debezium
debezium.source.database.password=secret
debezium.source.database.dbname=myapp
debezium.source.topic.prefix=myapp
debezium.source.plugin.name=pgoutput

# Sink to HTTP endpoint
debezium.sink.type=http
debezium.sink.http.url=http://my-service:8080/events

# Or sink to Redis Streams
debezium.sink.type=redis
debezium.sink.redis.address=redis:6379
```

### Schema Evolution Handling

```typescript
// TypeScript — Handle schema evolution in CDC consumer
interface CDCEvent {
  payload: {
    op: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    source: { table: string; ts_ms: number };
  };
}

function handleUserEvent(event: CDCEvent): void {
  const { op, after } = event.payload;

  if (op === 'd') {
    // Delete: use before
    handleDelete(event.payload.before!);
    return;
  }

  // Handle schema evolution — new fields may appear, old fields may disappear
  const user = {
    id: after!.id as string,
    email: after!.email as string,
    name: after!.name as string,
    // Handle new field (may not exist in older events)
    phone: (after!.phone as string) ?? null,
    // Handle renamed field (support both old and new name)
    displayName: (after!.display_name ?? after!.name) as string,
  };

  syncToElasticsearch(user);
}

// Key rules for schema evolution in CDC consumers:
// 1. ALWAYS handle missing fields with defaults
// 2. ALWAYS handle unknown fields (ignore them)
// 3. NEVER require specific field presence
// 4. ALWAYS version your event schemas if using outbox
```

---

## Best Practices

1. **ALWAYS use Debezium** for production CDC — battle-tested, widely adopted
2. **ALWAYS monitor replication slot lag** — growing lag can crash the database (WAL disk full)
3. **ALWAYS set max_slot_wal_keep_size** — prevent unbounded WAL growth
4. **ALWAYS use heartbeat queries** — prevent slot lag during idle periods
5. **ALWAYS configure dead letter queues** — capture events that fail processing
6. **ALWAYS filter sensitive columns** — column.exclude.list for passwords, PII
7. **ALWAYS test CDC pipeline** in staging before production — with realistic data volume
8. **NEVER expose database credentials** in connector config — use secret providers
9. **NEVER ignore connector failures** — restart automatically and alert on repeated failures
10. **NEVER modify CDC events in transit** — transform at consumer level

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No replication slot monitoring | WAL disk fills up, DB crashes | Alert on slot lag > threshold |
| No max_slot_wal_keep_size | Unbounded WAL growth | Set PostgreSQL parameter |
| No heartbeat queries | Slot lag grows during idle periods | Configure heartbeat.interval.ms |
| Sensitive data in CDC events | PII leaked to Kafka | Use column.exclude.list |
| No dead letter queue | Failed events lost | Configure DLQ topic |
| Manual connector management | Connector drift, no versioning | Infrastructure-as-code for connectors |
| No schema evolution handling | Consumers break on schema change | Handle missing/unknown fields gracefully |
| Snapshot on every restart | Massive initial load repeated | Use "initial" mode (only first time) |

---

## Enforcement Checklist

- [ ] Debezium connector deployed and monitored
- [ ] Replication slot lag alerts configured
- [ ] max_slot_wal_keep_size set in PostgreSQL
- [ ] Heartbeat queries configured for idle detection
- [ ] Sensitive columns excluded from CDC events
- [ ] Dead letter queue configured for failures
- [ ] Consumer idempotency guaranteed
- [ ] Schema evolution handled in all consumers
- [ ] CDC pipeline tested in staging environment
- [ ] Connector configuration managed as code (version controlled)
