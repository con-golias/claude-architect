# Table Partitioning

> **Domain:** Scalability > Database Scaling
> **Importance:** High
> **Last Updated:** 2025
> **Cross-ref:** 07-database/scaling/sharding-partitioning.md

## Partitioning vs Sharding

```
Partitioning: Single database, multiple physical segments
  → Same server, shared resources, transparent to app
  → Managed by the database engine

Sharding: Multiple databases, each holds a subset
  → Different servers, independent resources, app-aware routing
  → Managed by application or proxy
```

**Rule:** Partition before you shard. Partitioning gives 80% of the benefit at 10% of the complexity.

## Partition Strategies

### Range Partitioning

Best for time-series data and sequential access patterns.

```sql
-- PostgreSQL: Range partition by date
CREATE TABLE events (
    id          BIGSERIAL,
    created_at  TIMESTAMPTZ NOT NULL,
    event_type  TEXT NOT NULL,
    payload     JSONB,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2025_q1 PARTITION OF events
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
CREATE TABLE events_2025_q2 PARTITION OF events
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
CREATE TABLE events_2025_q3 PARTITION OF events
    FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');
CREATE TABLE events_2025_q4 PARTITION OF events
    FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

-- Default partition catches anything outside ranges
CREATE TABLE events_default PARTITION OF events DEFAULT;
```

```sql
-- MySQL: Range partition
CREATE TABLE orders (
    id          BIGINT AUTO_INCREMENT,
    created_at  DATETIME NOT NULL,
    customer_id BIGINT NOT NULL,
    total       DECIMAL(10,2),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (YEAR(created_at)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION pmax  VALUES LESS THAN MAXVALUE
);
```

### List Partitioning

Best for categorical data (status, region, type).

```sql
-- PostgreSQL: List partition by region
CREATE TABLE customers (
    id      BIGSERIAL,
    region  TEXT NOT NULL,
    name    TEXT NOT NULL,
    email   TEXT NOT NULL,
    PRIMARY KEY (id, region)
) PARTITION BY LIST (region);

CREATE TABLE customers_eu PARTITION OF customers FOR VALUES IN ('EU', 'UK');
CREATE TABLE customers_us PARTITION OF customers FOR VALUES IN ('US', 'CA');
CREATE TABLE customers_apac PARTITION OF customers FOR VALUES IN ('JP', 'AU', 'SG');
```

### Hash Partitioning

Best for even distribution when no natural range/list exists.

```sql
-- PostgreSQL: Hash partition for even distribution
CREATE TABLE user_sessions (
    id      UUID DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL,
    data    JSONB,
    PRIMARY KEY (id, user_id)
) PARTITION BY HASH (user_id);

CREATE TABLE user_sessions_0 PARTITION OF user_sessions FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE user_sessions_1 PARTITION OF user_sessions FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE user_sessions_2 PARTITION OF user_sessions FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE user_sessions_3 PARTITION OF user_sessions FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

## Partition Pruning

The database skips irrelevant partitions during query execution. **Critical for performance.**

```sql
-- GOOD: Partition key in WHERE clause → pruning occurs
EXPLAIN ANALYZE SELECT * FROM events
WHERE created_at BETWEEN '2025-01-01' AND '2025-03-31';
-- Output: Scans only events_2025_q1 (partition pruning)

-- BAD: No partition key → scans ALL partitions
EXPLAIN ANALYZE SELECT * FROM events WHERE event_type = 'click';
-- Output: Scans ALL partitions (no pruning possible)

-- BAD: Function on partition key prevents pruning
EXPLAIN ANALYZE SELECT * FROM events
WHERE EXTRACT(YEAR FROM created_at) = 2025;
-- Output: Scans ALL partitions (function hides key from optimizer)

-- GOOD: Rewrite to enable pruning
EXPLAIN ANALYZE SELECT * FROM events
WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01';
-- Output: Scans only 2025 partitions
```

## Partition Lifecycle Management

```sql
-- Detach old partition (instant, no data copy)
ALTER TABLE events DETACH PARTITION events_2023_q1;

-- Archive to cheaper storage or drop
-- Option A: Move to archive tablespace
ALTER TABLE events_2023_q1 SET TABLESPACE archive_storage;

-- Option B: Export and drop
COPY events_2023_q1 TO '/backup/events_2023_q1.csv' WITH CSV;
DROP TABLE events_2023_q1;

-- Create future partitions proactively
CREATE TABLE events_2026_q1 PARTITION OF events
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
```

```python
# Automated partition management with pg_partman
# Or custom script:
from datetime import datetime, timedelta
import psycopg2

def manage_partitions(conn, months_ahead=3, months_retain=24):
    """Create future partitions, detach old ones."""
    cur = conn.cursor()
    now = datetime.now()

    # Create future partitions
    for i in range(months_ahead):
        month = now + timedelta(days=30 * i)
        start = month.replace(day=1).strftime('%Y-%m-%d')
        end = (month.replace(day=1) + timedelta(days=32)).replace(day=1).strftime('%Y-%m-%d')
        name = f"events_{month.strftime('%Y_%m')}"
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS {name}
            PARTITION OF events FOR VALUES FROM ('{start}') TO ('{end}')
        """)

    # Detach old partitions
    cutoff = now - timedelta(days=30 * months_retain)
    cur.execute("""
        SELECT partition_name FROM pg_partitions
        WHERE parent_table = 'events' AND range_end < %s
    """, (cutoff,))
    for row in cur.fetchall():
        cur.execute(f"ALTER TABLE events DETACH PARTITION {row[0]}")

    conn.commit()
```

## Composite Partitioning

```sql
-- PostgreSQL: Range + Hash (multi-level)
CREATE TABLE logs (
    id         BIGSERIAL,
    created_at TIMESTAMPTZ NOT NULL,
    user_id    BIGINT NOT NULL,
    message    TEXT,
    PRIMARY KEY (id, created_at, user_id)
) PARTITION BY RANGE (created_at);

CREATE TABLE logs_2025_q1 PARTITION OF logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01')
    PARTITION BY HASH (user_id);

CREATE TABLE logs_2025_q1_p0 PARTITION OF logs_2025_q1
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
-- ... (create remainder 1, 2, 3)
```

## Per-Partition Indexes

```sql
-- Indexes are created per-partition automatically
CREATE INDEX ON events (event_type, created_at);
-- Creates: events_2025_q1_event_type_created_at_idx
--          events_2025_q2_event_type_created_at_idx ...

-- Per-partition unique constraints
-- Unique key MUST include partition key
CREATE UNIQUE INDEX ON events (id, created_at);  -- Works
-- CREATE UNIQUE INDEX ON events (id);           -- ERROR: must include partition key
```

## Best Practices

1. **Partition before sharding** — 80% benefit at 10% complexity
2. **Include partition key in WHERE clauses** — enables partition pruning
3. **Never apply functions to partition key in queries** — breaks pruning
4. **Automate partition creation** — create future partitions proactively (3+ months ahead)
5. **Use DETACH for old data** — instant operation, no long locks
6. **Partition key must be in primary key** — PostgreSQL/MySQL requirement
7. **Keep partition count reasonable** — 100-1000 partitions, not 10,000+
8. **Monitor partition sizes** — alert on uneven distribution
9. **Use range for time-series, hash for even distribution** — match strategy to access pattern
10. **Test partition pruning with EXPLAIN** — verify queries actually skip partitions

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|-------------|--------|-----|
| Too many partitions (10K+) | Planning overhead, slow DDL | Fewer, larger partitions |
| Queries without partition key | Full table scan across all partitions | Always include partition key |
| Functions on partition key | Partition pruning disabled | Use direct comparisons |
| No partition maintenance | Unbounded growth | Automate detach/archive |
| Forgetting default partition | Inserts fail for unexpected values | Always create DEFAULT |
| Unique index without partition key | Cannot create cross-partition unique | Include partition key in PK |
| Over-partitioning small tables | Overhead exceeds benefit | Only partition tables >10 GB |
| Manual partition creation | Missed partitions, insert failures | Automate with cron/pg_partman |

## Enforcement Checklist

- [ ] Tables >10 GB evaluated for partitioning
- [ ] Partition strategy matches query patterns (range for time-series, hash for even)
- [ ] Partition pruning verified with EXPLAIN on common queries
- [ ] Automated partition creation for future periods
- [ ] Partition retention policy defined and automated
- [ ] Primary key includes partition key
- [ ] Default partition exists for unexpected values
- [ ] Partition count monitored (<1000)
