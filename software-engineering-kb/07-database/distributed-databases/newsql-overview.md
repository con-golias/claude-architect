# NewSQL & Distributed SQL Databases

> **Domain:** Database > Distributed Databases > NewSQL
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Traditional relational databases (PostgreSQL, MySQL) scale vertically — bigger machines, faster disks. When a single node can no longer handle the workload, you face a painful choice: shard manually (losing JOINs, transactions, and SQL semantics) or switch to NoSQL (losing ACID guarantees). NewSQL databases eliminate this trade-off by providing the full SQL interface and ACID transactions of a relational database with the horizontal scalability of a distributed system. They automatically shard data across nodes, replicate for fault tolerance, and present a single logical database to the application — no application-level sharding logic required.

---

## How It Works

### The NewSQL Promise

```
Traditional Tradeoff:
┌─────────────────────────┐     ┌─────────────────────────┐
│   Relational (SQL)      │     │   NoSQL                 │
│                         │     │                         │
│ ✅ ACID transactions    │     │ ❌ Limited transactions │
│ ✅ SQL queries          │     │ ❌ Limited queries      │
│ ✅ Strong consistency   │     │ ❌ Eventual consistency │
│ ❌ Single-node scale    │     │ ✅ Horizontal scale     │
│ ❌ Manual sharding      │     │ ✅ Auto-sharding        │
│ ❌ Failover complexity  │     │ ✅ Built-in replication │
└─────────────────────────┘     └─────────────────────────┘

NewSQL: Best of Both
┌─────────────────────────────────────────┐
│   NewSQL / Distributed SQL              │
│                                         │
│ ✅ Full ACID transactions               │
│ ✅ Standard SQL (JOINs, CTEs, etc.)     │
│ ✅ Strong consistency (serializable)    │
│ ✅ Horizontal scalability               │
│ ✅ Automatic sharding & rebalancing     │
│ ✅ Built-in replication & failover      │
│ ✅ PostgreSQL/MySQL wire compatibility  │
└─────────────────────────────────────────┘
```

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│              Distributed SQL Architecture                     │
│                                                               │
│  Application Layer (standard SQL drivers)                    │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│  │  App Pod   │  │  App Pod   │  │  App Pod   │              │
│  │  (pg/mysql │  │  (pg/mysql │  │  (pg/mysql │              │
│  │   driver)  │  │   driver)  │  │   driver)  │              │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘              │
│        │               │               │                      │
│  ──────┼───────────────┼───────────────┼──────── SQL Layer    │
│        │               │               │                      │
│  ┌─────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐             │
│  │  SQL Node  │  │  SQL Node  │  │  SQL Node  │             │
│  │  (query    │  │  (query    │  │  (query    │             │
│  │  planning) │  │  planning) │  │  planning) │             │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘             │
│        │               │               │                      │
│  ──────┼───────────────┼───────────────┼──────── Storage     │
│        │               │               │                      │
│  ┌─────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐             │
│  │ Storage    │  │ Storage    │  │ Storage    │             │
│  │ Node 1    │  │ Node 2    │  │ Node 3    │             │
│  │ Range A-G │  │ Range H-N │  │ Range O-Z │             │
│  │ (leader)  │  │ (leader)  │  │ (leader)  │             │
│  │           │  │           │  │           │             │
│  │ + replicas│  │ + replicas│  │ + replicas│             │
│  └───────────┘  └───────────┘  └───────────┘             │
│                                                               │
│  Data split into ranges (CockroachDB) or regions (TiDB)     │
│  Each range: Raft consensus group with leader + followers    │
│  Any SQL node can route queries to any storage node          │
└──────────────────────────────────────────────────────────────┘
```

---

### CockroachDB

```
CockroachDB Architecture:
┌──────────────────────────────────────────────────┐
│  ┌────────────┐                                   │
│  │ SQL Layer  │ PostgreSQL wire protocol          │
│  │            │ Parse → Plan → Optimize → Execute │
│  └─────┬──────┘                                   │
│        │                                           │
│  ┌─────▼──────┐                                   │
│  │Distribution │ KV ranges (64MB default)         │
│  │ Layer      │ Range splits & merges             │
│  │            │ Lease holder (reads)              │
│  └─────┬──────┘                                   │
│        │                                           │
│  ┌─────▼──────┐                                   │
│  │Replication │ Raft consensus per range          │
│  │ Layer      │ 3 or 5 replicas                   │
│  └─────┬──────┘                                   │
│        │                                           │
│  ┌─────▼──────┐                                   │
│  │ Storage    │ Pebble (LSM-tree, RocksDB fork)  │
│  │ Layer      │ MVCC timestamps                   │
│  └────────────┘                                   │
└──────────────────────────────────────────────────┘
```

```sql
-- CockroachDB SQL (PostgreSQL-compatible)
-- Create table with automatic distribution
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    region TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_customer (customer_id),
    INDEX idx_status_region (status, region)
);

-- Multi-region table (data locality)
ALTER DATABASE shop SET PRIMARY REGION = 'us-east1';
ALTER DATABASE shop ADD REGION 'eu-west1';
ALTER DATABASE shop ADD REGION 'ap-southeast1';

ALTER TABLE orders SET LOCALITY REGIONAL BY ROW;
-- Each row stored in the region specified by its crdb_region column

-- Regional by table (entire table in one region)
ALTER TABLE user_profiles SET LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

-- Global table (replicated everywhere, fast reads globally)
ALTER TABLE currencies SET LOCALITY GLOBAL;

-- Distributed transaction (automatic, no special syntax)
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 'alice';
UPDATE accounts SET balance = balance + 100 WHERE id = 'bob';
-- Works even if alice and bob are on different nodes/ranges
COMMIT;

-- Change data capture
CREATE CHANGEFEED FOR TABLE orders
INTO 'kafka://broker:9092'
WITH updated, resolved;

-- Follower reads (stale but fast reads from nearest replica)
SET TRANSACTION AS OF SYSTEM TIME '-5s';
SELECT * FROM orders WHERE customer_id = $1;

-- Show range distribution
SHOW RANGES FROM TABLE orders;
```

```go
// Go — CockroachDB with pgx (PostgreSQL driver)
import (
    "context"
    "github.com/jackc/pgx/v5/pgxpool"
)

func NewCockroachPool(ctx context.Context, connStr string) (*pgxpool.Pool, error) {
    config, err := pgxpool.ParseConfig(connStr)
    if err != nil {
        return nil, err
    }

    config.MaxConns = 20
    config.MinConns = 5

    pool, err := pgxpool.NewWithConfig(ctx, config)
    if err != nil {
        return nil, err
    }

    return pool, nil
}

// Retry on serialization errors (CockroachDB recommendation)
func ExecuteWithRetry(ctx context.Context, pool *pgxpool.Pool, fn func(ctx context.Context, tx pgx.Tx) error) error {
    for retries := 0; retries < 3; retries++ {
        tx, err := pool.Begin(ctx)
        if err != nil {
            return err
        }

        err = fn(ctx, tx)
        if err != nil {
            tx.Rollback(ctx)
            // Check for serialization error (40001)
            var pgErr *pgconn.PgError
            if errors.As(err, &pgErr) && pgErr.Code == "40001" {
                continue // retry
            }
            return err
        }

        return tx.Commit(ctx)
    }
    return fmt.Errorf("transaction failed after 3 retries")
}
```

---

### TiDB

```
TiDB Architecture:
┌──────────────────────────────────────────────────┐
│                                                    │
│  ┌────────────┐  ┌────────────┐                   │
│  │ TiDB Server│  │ TiDB Server│  Stateless SQL    │
│  │ (MySQL     │  │ (MySQL     │  layer             │
│  │  protocol) │  │  protocol) │  Scale by adding   │
│  └─────┬──────┘  └─────┬──────┘  more TiDB nodes  │
│        │               │                           │
│  ┌─────▼───────────────▼──────┐                   │
│  │       PD (Placement        │  Metadata store    │
│  │       Driver) Cluster      │  TSO (timestamp    │
│  │       (3 or 5 nodes)       │  oracle)           │
│  └─────┬──────────────────────┘  Scheduling        │
│        │                                           │
│  ┌─────▼──────┐  ┌───────────┐  ┌───────────┐    │
│  │ TiKV Node  │  │ TiKV Node │  │ TiKV Node │    │
│  │ (Raft      │  │ (Raft     │  │ (Raft     │    │
│  │  groups)   │  │  groups)  │  │  groups)  │    │
│  └────────────┘  └───────────┘  └───────────┘    │
│                                                    │
│  Optional: TiFlash (columnar analytics replicas)  │
│  ┌───────────┐  ┌───────────┐                     │
│  │ TiFlash   │  │ TiFlash   │  Column-store for   │
│  │ Node      │  │ Node      │  OLAP queries        │
│  └───────────┘  └───────────┘                     │
└──────────────────────────────────────────────────┘
```

```sql
-- TiDB SQL (MySQL-compatible)
-- Standard MySQL syntax works
CREATE TABLE orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'processing', 'shipped', 'delivered'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_customer (customer_id),
    INDEX idx_status (status)
);

-- TiDB-specific: clustered index (co-locate row with PK)
CREATE TABLE users (
    id BIGINT PRIMARY KEY CLUSTERED,  -- store data sorted by PK
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE
);

-- TiDB-specific: placement rules (data locality)
CREATE PLACEMENT POLICY us_east PRIMARY_REGION="us-east" REGIONS="us-east,us-west";
CREATE TABLE us_orders (
    id BIGINT PRIMARY KEY,
    -- ...
) PLACEMENT POLICY = us_east;

-- TiFlash: add columnar replica for analytics
ALTER TABLE orders SET TIFLASH REPLICA 2;

-- Analytical query (automatically routed to TiFlash)
SELECT
    DATE_FORMAT(created_at, '%Y-%m') AS month,
    status,
    COUNT(*) AS order_count,
    SUM(total) AS revenue
FROM orders
WHERE created_at >= '2024-01-01'
GROUP BY month, status
ORDER BY month;

-- Stale read (read from follower, no leader round-trip)
SET TRANSACTION READ ONLY AS OF TIMESTAMP TIDB_BOUNDED_STALENESS(NOW() - INTERVAL 5 SECOND, NOW());
SELECT * FROM orders WHERE customer_id = 123;
```

```typescript
// TypeScript — TiDB with mysql2 (MySQL driver)
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'tidb-server',
  port: 4000,          // TiDB default port
  user: 'root',
  database: 'shop',
  waitForConnections: true,
  connectionLimit: 20,
  ssl: { rejectUnauthorized: true },
});

async function transferFunds(fromId: string, toId: string, amount: number) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Pessimistic locking (TiDB default since v3.0.8)
    const [rows] = await conn.execute(
      'SELECT balance FROM accounts WHERE id = ? FOR UPDATE',
      [fromId]
    );

    if (rows[0].balance < amount) {
      throw new Error('Insufficient funds');
    }

    await conn.execute(
      'UPDATE accounts SET balance = balance - ? WHERE id = ?',
      [amount, fromId]
    );
    await conn.execute(
      'UPDATE accounts SET balance = balance + ? WHERE id = ?',
      [amount, toId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
```

---

### YugabyteDB

```sql
-- YugabyteDB (PostgreSQL-compatible)
-- Uses YSQL (PostgreSQL wire protocol) or YCQL (Cassandra-like)

-- Standard PostgreSQL SQL works
CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    region TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- Tablespace for geo-partitioning
CREATE TABLESPACE us_east WITH (
    replica_placement = '{"num_replicas": 3, "placement_blocks":
    [{"cloud":"aws","region":"us-east-1","zone":"us-east-1a","min_num_replicas":1},
     {"cloud":"aws","region":"us-east-1","zone":"us-east-1b","min_num_replicas":1},
     {"cloud":"aws","region":"us-east-1","zone":"us-east-1c","min_num_replicas":1}]}'
);

-- Colocated tables (small tables on same tablet)
CREATE DATABASE mydb WITH COLOCATION = true;
-- All tables in this database share tablets (reduces overhead for small tables)

-- Row-level geo-partitioning
CREATE TABLE user_data (
    id UUID,
    region TEXT,
    data JSONB,
    PRIMARY KEY (id, region)
) PARTITION BY LIST (region);

CREATE TABLE user_data_us PARTITION OF user_data
    FOR VALUES IN ('us') TABLESPACE us_east;
CREATE TABLE user_data_eu PARTITION OF user_data
    FOR VALUES IN ('eu') TABLESPACE eu_west;
```

---

### Comparison Matrix

| Feature | CockroachDB | TiDB | YugabyteDB | Spanner |
|---------|-------------|------|------------|---------|
| **Wire protocol** | PostgreSQL | MySQL | PostgreSQL + Cassandra | Proprietary |
| **Consensus** | Raft (per range) | Raft (per region) | Raft (per tablet) | Paxos (per split) |
| **Storage engine** | Pebble (LSM) | TiKV (RocksDB) | DocDB (RocksDB) | Colossus |
| **HTAP** | No | Yes (TiFlash) | No | No |
| **Isolation** | Serializable | Snapshot (SI) / RC | Snapshot / Serializable | External consistency |
| **Geo-partitioning** | Built-in | Placement policies | Tablespaces | Instance configs |
| **License** | BSL → Apache | Apache 2.0 | Apache 2.0 | Proprietary |
| **Managed cloud** | CockroachDB Cloud | TiDB Cloud | YugabyteDB Managed | Google Cloud |
| **Minimum nodes** | 3 | 6 (3 PD + 3 TiKV) | 3 | 3 |
| **Best for** | PostgreSQL teams, multi-region | MySQL teams, HTAP | PostgreSQL + Cassandra migration | Google ecosystem |

---

### When to Use Distributed SQL

```
Decision Framework:
┌─────────────────────────────────────────────────┐
│                                                   │
│  Do you need horizontal write scalability?        │
│  ├── NO → PostgreSQL / MySQL (single node)       │
│  └── YES                                          │
│      │                                             │
│      Do you need ACID transactions?               │
│      ├── NO → Consider NoSQL (Cassandra, DynamoDB)│
│      └── YES                                       │
│          │                                          │
│          Do you need SQL (JOINs, complex queries)? │
│          ├── NO → Consider DynamoDB, Cassandra     │
│          └── YES → Distributed SQL                 │
│              │                                      │
│              Which SQL dialect?                     │
│              ├── PostgreSQL → CockroachDB /         │
│              │               YugabyteDB             │
│              ├── MySQL → TiDB                       │
│              └── Google Cloud → Spanner              │
└─────────────────────────────────────────────────┘
```

| Scenario | Use Distributed SQL | Use Single-Node PostgreSQL |
|----------|--------------------|-----------------------------|
| Write throughput > 10K TPS | Yes | No (will bottleneck) |
| Multi-region low latency | Yes | No (single-region only) |
| Data > 1 TB with complex queries | Yes | Maybe (depends on workload) |
| 99.999% uptime required | Yes | No (failover has downtime) |
| Simple CRUD, < 5K TPS | No (over-engineered) | Yes |
| Single region, moderate load | No | Yes |
| Small team, limited ops | No | Yes |
| Budget-constrained | No (expensive) | Yes |

---

## Best Practices

1. **ALWAYS start with PostgreSQL/MySQL** — only move to distributed SQL when single-node limits are proven
2. **ALWAYS use PostgreSQL-compatible distributed SQL** (CockroachDB, YugabyteDB) if your team knows PostgreSQL
3. **ALWAYS design for serialization retry** — distributed transactions may abort on conflict, retry in application
4. **ALWAYS benchmark with realistic workloads** — distributed SQL adds latency per query (consensus overhead)
5. **ALWAYS use follower/stale reads** for read-heavy workloads that tolerate slight staleness
6. **ALWAYS co-locate related data** — multi-range transactions are expensive, keep hot data together
7. **NEVER assume single-node PostgreSQL performance** — distributed SQL has higher per-query latency
8. **NEVER use distributed SQL for < 1 TB or < 5K TPS** — overhead not justified
9. **NEVER ignore consensus overhead** — every write requires 3-node Raft agreement
10. **NEVER use auto-increment PKs in distributed SQL** — causes hot-spot on single range, use UUIDs

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Distributed SQL for small workloads | Higher latency, operational complexity, no benefit | Use PostgreSQL/MySQL single-node |
| Auto-increment primary keys | Write hot-spot on single range/tablet | Use UUID or hash-sharded sequences |
| No retry on serialization errors | Transactions fail silently | Implement application-level retry with backoff |
| Cross-region transactions | 200-500ms latency per commit | Co-locate data with geo-partitioning |
| Treating as drop-in PostgreSQL | Performance surprises on JOINs, aggregations | Benchmark critical queries, optimize for distributed |
| Not configuring replication factor | Data loss risk if node fails | 3 replicas minimum for production |
| Large transactions (many rows) | Lock contention, timeouts | Break into smaller batches |
| Full table scans | Scan hits all nodes, slow | Ensure queries use indexes, limit result sets |
| Ignoring data locality | Reads route to distant regions | Use geo-partitioning, regional tables |
| Skipping connection pooling | Too many connections across nodes | Use PgBouncer or built-in connection limits |

---

## Real-world Examples

### DoorDash (CockroachDB)
- Migrated from Aurora PostgreSQL to CockroachDB
- Multi-region deployment for low-latency order processing
- Handles millions of delivery transactions daily

### PingCAP Customers (TiDB)
- Zhihu (China's Quora): 100+ TiDB nodes, HTAP workloads
- BookMyShow: ticket booking with peak burst traffic
- PayPay (Japan): financial transactions with TiDB + TiFlash analytics

### Yugabyte Customers (YugabyteDB)
- Kroger: retail inventory management across regions
- Wells Fargo: financial services requiring PostgreSQL compatibility

### Google Cloud Spanner
- Google Ads: trillions of rows, globally consistent
- Snap: Snapchat message storage and delivery

---

## Enforcement Checklist

- [ ] Single-node PostgreSQL/MySQL proven insufficient before choosing distributed SQL
- [ ] Wire protocol compatibility matches team expertise (PostgreSQL vs MySQL)
- [ ] Serialization retry logic implemented in application
- [ ] UUID or random primary keys used (no auto-increment hot-spots)
- [ ] Replication factor set to 3+ for production
- [ ] Geo-partitioning configured for multi-region deployments
- [ ] Follower reads enabled for read-heavy, staleness-tolerant queries
- [ ] Connection pooling configured
- [ ] Critical query paths benchmarked against distributed overhead
- [ ] Monitoring configured for consensus latency, range distribution, hot-spots
- [ ] Backup and point-in-time recovery configured
- [ ] Node failure scenarios tested (kill node, verify availability)
