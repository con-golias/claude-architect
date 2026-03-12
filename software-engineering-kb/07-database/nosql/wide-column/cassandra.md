# Apache Cassandra

> **Domain:** Database > NoSQL > Wide-Column
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Apache Cassandra is the go-to database for massive write-heavy workloads requiring multi-datacenter replication with zero single points of failure. Unlike PostgreSQL or MongoDB which have a primary node bottleneck, Cassandra is masterless — every node can accept reads and writes. It scales linearly: double the nodes, double the throughput. Apple runs 150,000+ Cassandra nodes. Netflix stores trillions of rows. Discord handles millions of messages per second. Cassandra trades query flexibility for write performance and availability — it excels at known access patterns with massive data volume but is a poor choice for ad-hoc queries or transactions.

---

## How It Works

### Architecture

```
┌──────────────────────────────────────────────────────┐
│          Cassandra Ring (Peer-to-Peer)                │
│                                                       │
│              ┌──────┐                                │
│         ┌────│Node 1│────┐                           │
│         │    │Token: │    │                           │
│    ┌────▼──┐ │0-25%  │ ┌──▼─────┐                   │
│    │Node 4 │ └──────┘ │ Node 2 │                    │
│    │Token: │           │ Token: │                    │
│    │75-100%│           │ 25-50% │                    │
│    └────┬──┘           └──┬─────┘                   │
│         │    ┌──────┐     │                           │
│         └────│Node 3│─────┘                           │
│              │Token: │                                │
│              │50-75% │                                │
│              └──────┘                                │
│                                                       │
│  No master node — all nodes are equal                │
│  Data distributed by partition key hash              │
│  Each piece of data replicated to RF nodes           │
│  Consistent hashing determines data placement        │
└──────────────────────────────────────────────────────┘
```

### Data Model

```sql
-- Cassandra CQL (Cassandra Query Language)
-- Looks like SQL but is fundamentally different

CREATE KEYSPACE my_app WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'us-east': 3,
  'eu-west': 3
};

USE my_app;

-- Table design driven by queries (not entities)
-- Each table serves ONE specific query pattern

-- Query: "Get all messages in a channel, ordered by time"
CREATE TABLE messages_by_channel (
    channel_id  UUID,
    message_id  TIMEUUID,
    user_id     UUID,
    content     TEXT,
    created_at  TIMESTAMP,
    PRIMARY KEY ((channel_id), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);

-- Partition key: channel_id (determines which node stores data)
-- Clustering key: message_id (sorts data within partition)

-- Query: "Get all channels for a user"
CREATE TABLE channels_by_user (
    user_id     UUID,
    channel_id  UUID,
    channel_name TEXT,
    joined_at   TIMESTAMP,
    PRIMARY KEY ((user_id), joined_at, channel_id)
) WITH CLUSTERING ORDER BY (joined_at DESC);
```

**Key concepts:**

```
PRIMARY KEY ((partition_key), clustering_key1, clustering_key2)
              │                │
              │                └── Sorts data WITHIN a partition
              └── Determines WHICH node stores the data

Partition:
┌─────────────────────────────────────────────┐
│  Partition: channel_id = abc-123             │
│                                              │
│  message_id (clustering) │ content           │
│  ────────────────────────┼──────────         │
│  2024-06-15 14:30:00     │ "Hello!"         │
│  2024-06-15 14:25:00     │ "Hi there"       │
│  2024-06-15 14:20:00     │ "Good morning"   │
│  (sorted by clustering key)                  │
└─────────────────────────────────────────────┘
```

---

### CRUD Operations

```sql
-- INSERT (also used for upsert — no distinction in Cassandra)
INSERT INTO messages_by_channel (channel_id, message_id, user_id, content, created_at)
VALUES (uuid(), now(), uuid(), 'Hello World!', toTimestamp(now()));

-- INSERT with TTL (auto-delete after N seconds)
INSERT INTO sessions (session_id, user_id, data)
VALUES ('abc123', uuid(), '{"role": "admin"}')
USING TTL 3600;  -- expires in 1 hour

-- SELECT (MUST include partition key)
SELECT * FROM messages_by_channel
WHERE channel_id = abc-123-uuid
ORDER BY message_id DESC
LIMIT 50;

-- Range query within partition
SELECT * FROM messages_by_channel
WHERE channel_id = abc-123-uuid
  AND message_id > minTimeuuid('2024-06-01')
  AND message_id < maxTimeuuid('2024-06-30');

-- UPDATE (creates or overwrites — same as INSERT internally)
UPDATE messages_by_channel
SET content = 'Updated message'
WHERE channel_id = abc-123-uuid AND message_id = some-timeuuid;

-- DELETE
DELETE FROM messages_by_channel
WHERE channel_id = abc-123-uuid AND message_id = some-timeuuid;

-- Lightweight transactions (compare-and-set — expensive, use sparingly)
INSERT INTO users (user_id, email, name)
VALUES (uuid(), 'alice@example.com', 'Alice')
IF NOT EXISTS;

UPDATE users SET email = 'newalice@example.com'
WHERE user_id = some-uuid
IF email = 'alice@example.com';
```

---

### Consistency Levels

```sql
-- Per-query consistency (tunable)
CONSISTENCY QUORUM;
SELECT * FROM messages_by_channel WHERE channel_id = ?;

-- Or in application code:
-- query.setConsistencyLevel(ConsistencyLevel.QUORUM)
```

| Level | Reads/Writes | Use Case |
|-------|-------------|----------|
| `ONE` | 1 replica | Fast, eventual consistency |
| `QUORUM` | Majority (RF/2 + 1) | Strong consistency (recommended) |
| `LOCAL_QUORUM` | Majority in local DC | Multi-DC strong consistency |
| `ALL` | All replicas | Slowest, highest consistency |
| `ANY` (write only) | 1 replica or coordinator | Maximum availability, risk of data loss |

**Strong consistency formula:** `R + W > N` (reads + writes > replication factor)
- `QUORUM` reads + `QUORUM` writes → strong consistency
- `ONE` reads + `ALL` writes → strong consistency
- `ONE` reads + `ONE` writes → eventually consistent

---

### Data Modeling Patterns

```sql
-- Pattern 1: Denormalization (write data to multiple tables for different queries)
-- When a message is sent, write to BOTH tables:
INSERT INTO messages_by_channel (...) VALUES (...);
INSERT INTO messages_by_user (...) VALUES (...);

-- Pattern 2: Materialized Views (automatic denormalization)
CREATE MATERIALIZED VIEW messages_by_user AS
    SELECT * FROM messages_by_channel
    WHERE user_id IS NOT NULL AND channel_id IS NOT NULL AND message_id IS NOT NULL
    PRIMARY KEY ((user_id), message_id, channel_id);
-- WARNING: MVs add write overhead, use sparingly

-- Pattern 3: Counter tables (atomic counters)
CREATE TABLE page_views (
    page_url TEXT,
    date     DATE,
    views    COUNTER,
    PRIMARY KEY ((page_url), date)
);

UPDATE page_views SET views = views + 1
WHERE page_url = '/home' AND date = '2024-06-15';

-- Pattern 4: Time-windowed partitions (prevent unbounded partitions)
CREATE TABLE sensor_data (
    sensor_id  TEXT,
    day        DATE,            -- partition by day
    reading_at TIMESTAMP,
    value      DOUBLE,
    PRIMARY KEY ((sensor_id, day), reading_at)
) WITH CLUSTERING ORDER BY (reading_at DESC);
-- Each partition = one sensor's data for one day (bounded size)
```

---

### Compaction & Tombstones

```
Write path:
Client → Commit Log (sequential write) → Memtable (memory) → SSTable (disk flush)

Read path:
Client → Memtable + SSTables (merge) → Bloom Filter (skip SSTables) → Result

Compaction:
SSTable 1 ─┐
SSTable 2 ─┤→ Merged SSTable (remove tombstones, duplicates)
SSTable 3 ─┘
```

```yaml
# Compaction strategies
# SizeTieredCompactionStrategy (STCS) — default, write-optimized
# LeveledCompactionStrategy (LCS) — read-optimized, more I/O
# TimeWindowCompactionStrategy (TWCS) — time-series data

# cassandra.yaml or per-table:
# ALTER TABLE messages_by_channel
#   WITH compaction = {
#     'class': 'TimeWindowCompactionStrategy',
#     'compaction_window_size': 1,
#     'compaction_window_unit': 'DAYS'
#   };
```

---

## Best Practices

1. **ALWAYS model tables for query patterns** — one table per query, denormalize aggressively
2. **ALWAYS use QUORUM or LOCAL_QUORUM** for consistency — ONE is too risky for most use cases
3. **ALWAYS bound partition sizes** — use composite partition keys (sensor_id, day) to prevent hot partitions
4. **ALWAYS use TIMEUUID** for time-ordered data — provides uniqueness + ordering
5. **ALWAYS use TTL** for temporary data — prevents tombstone accumulation
6. **ALWAYS use NetworkTopologyStrategy** for production — never SimpleStrategy
7. **ALWAYS use prepared statements** — prevents CQL injection, improves performance
8. **NEVER do full table scans** (SELECT * without partition key) — use Spark for analytics
9. **NEVER use lightweight transactions (LWT) frequently** — 4x slower than normal writes
10. **NEVER delete large amounts of data without understanding tombstones** — causes read latency spikes

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Relational data modeling | Queries require multiple reads, slow | Model per query pattern, denormalize |
| Unbounded partitions | Partition too large (>100 MB), slow reads | Add time bucket to partition key |
| SELECT * without partition key | Full cluster scan, timeout | Always include partition key |
| Heavy use of LWT (IF NOT EXISTS) | High latency, Paxos overhead | Use only when absolutely necessary |
| Mass deletes creating tombstones | Read latency spikes, GC pressure | Use TTL, time-windowed compaction |
| SimpleStrategy in production | No datacenter awareness | Use NetworkTopologyStrategy |
| Too many secondary indexes | Scatter-gather queries, slow | Denormalize into separate table |
| Counter column in regular table | Counter semantics broken | Dedicated counter tables only |
| Consistency level ALL | Availability reduced, latency spikes | Use QUORUM or LOCAL_QUORUM |
| No data model review | Schema impossible to change later | Review data model before deployment |

---

## Real-world Examples

### Apple
- 150,000+ Cassandra nodes (one of the largest deployments)
- iCloud, Siri, Maps data storage
- Multi-datacenter replication for global availability

### Netflix
- Trillions of rows across thousands of Cassandra nodes
- Viewing history, user preferences, recommendation data
- Multi-region active-active architecture

### Discord
- Cassandra for message storage (billions of messages)
- Migrated to ScyllaDB for better performance (see scylladb.md)
- Time-bucketed partitions for message history

### Instagram
- Cassandra for fraud detection and user activity feeds
- Time-series data for analytics pipelines

---

## Enforcement Checklist

- [ ] Data model designed per query pattern (one table per query)
- [ ] Partition sizes bounded (< 100 MB, use time bucketing)
- [ ] Consistency level set to QUORUM or LOCAL_QUORUM for critical data
- [ ] NetworkTopologyStrategy used (not SimpleStrategy)
- [ ] TTL set on temporary data
- [ ] Compaction strategy chosen per table (STCS, LCS, TWCS)
- [ ] Prepared statements used for all queries
- [ ] No full table scans in application code
- [ ] LWT usage minimized and justified
- [ ] Tombstone accumulation monitored
- [ ] Replication factor ≥ 3 per datacenter
