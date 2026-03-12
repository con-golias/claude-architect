# MySQL Overview & Architecture

> **Domain:** Database > Relational > MySQL
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

MySQL powers a massive portion of the internet — WordPress, Facebook, Uber, Airbnb, Shopify, and GitHub all run on MySQL. While PostgreSQL is the more feature-rich database, MySQL dominates in deployment count, managed service availability, and ecosystem maturity. Its pluggable storage engine architecture (InnoDB, MyISAM, NDB) offers flexibility, and InnoDB's mature MVCC implementation delivers strong transactional guarantees. Understanding MySQL's architecture — its thread model, InnoDB storage engine, replication topology, and unique SQL behaviors — is essential for the majority of production applications.

---

## How It Works

### Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                     MySQL Server                        │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │             Connection Layer                      │   │
│  │  Thread Pool / Thread-per-Connection              │   │
│  │  Authentication, SSL/TLS                          │   │
│  └─────────────────────┬───────────────────────────┘   │
│                        │                                │
│  ┌─────────────────────▼───────────────────────────┐   │
│  │              SQL Layer                            │   │
│  │  Parser → Optimizer → Executor                    │   │
│  │  Query Cache (removed in 8.0)                     │   │
│  │  Prepared Statements                              │   │
│  └─────────────────────┬───────────────────────────┘   │
│                        │                                │
│  ┌─────────────────────▼───────────────────────────┐   │
│  │            Storage Engine API                     │   │
│  │                                                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │   │
│  │  │ InnoDB   │  │ MyISAM   │  │  NDB Cluster │   │   │
│  │  │ (default)│  │ (legacy) │  │  (distributed│   │   │
│  │  │          │  │          │  │     cluster)  │   │   │
│  │  └──────────┘  └──────────┘  └──────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

### MySQL vs PostgreSQL Thread Model

```
PostgreSQL:                        MySQL:
Process-per-connection             Thread-per-connection

┌──────────┐                      ┌──────────┐
│Postmaster│                      │  mysqld   │ (single process)
└────┬─────┘                      └────┬─────┘
     │ fork()                          │ pthread_create()
┌────▼─────┐                      ┌───▼────┐
│ Process  │ ~5-10 MB             │ Thread │ ~256 KB-1 MB
│ (Client) │                      │(Client)│
└──────────┘                      └────────┘

MySQL: Lower per-connection overhead
PostgreSQL: Better crash isolation (process crash ≠ server crash)
```

---

### InnoDB Storage Engine

InnoDB is the default and only recommended storage engine for production MySQL.

```
┌──────────────────────────────────────────────┐
│              InnoDB Architecture              │
│                                               │
│  ┌──────────────────────────┐                │
│  │    Buffer Pool (memory)  │                │
│  │                          │                │
│  │  Data pages + Index pages│                │
│  │  Change Buffer           │                │
│  │  Adaptive Hash Index     │                │
│  └────────────┬─────────────┘                │
│               │                               │
│  ┌────────────▼─────────────┐                │
│  │    Log Buffer            │                │
│  │    (redo log buffer)     │                │
│  └────────────┬─────────────┘                │
│               │                               │
│  ─────────────┼───────── Disk ────────────── │
│               │                               │
│  ┌────────────▼──────┐  ┌──────────────┐    │
│  │  Redo Log Files   │  │ Undo         │    │
│  │  (ib_logfile0/1)  │  │ Tablespace   │    │
│  └───────────────────┘  │ (undo logs)  │    │
│                          └──────────────┘    │
│  ┌───────────────────┐  ┌──────────────┐    │
│  │  Tablespace Files │  │ System       │    │
│  │  (.ibd per table) │  │ Tablespace   │    │
│  └───────────────────┘  └──────────────┘    │
└──────────────────────────────────────────────┘
```

**InnoDB key features:**
- **MVCC** via undo logs (old versions stored in undo tablespace, not heap like PostgreSQL)
- **Clustered index** — data stored in primary key order (B+ tree leaf = actual row data)
- **Row-level locking** with record locks, gap locks, next-key locks
- **Crash recovery** via redo log (WAL equivalent)
- **Foreign key support** (only InnoDB, not MyISAM)
- **Change buffer** — batches secondary index updates for non-unique indexes

### Clustered Index (InnoDB-specific)

```
                        Primary Key B+ Tree
                    ┌──────────────────────┐
                    │     Root Node        │
                    │     [50]             │
                    └──────────┬───────────┘
                 ┌─────────────┴──────────────┐
          ┌──────▼──────┐              ┌──────▼──────┐
          │ [10, 25, 40]│              │ [60, 75, 90]│
          └──────┬──────┘              └──────┬──────┘
                 │                            │
          ┌──────▼──────────────────────────────────┐
          │  Leaf Node = ACTUAL ROW DATA            │
          │  id=10: {name:'Alice', email:'a@x.com'} │
          │  id=25: {name:'Bob', email:'b@x.com'}   │
          └─────────────────────────────────────────┘

Consequence: table data IS the primary key index
- Primary key lookups are fastest possible
- Secondary indexes store PK value (not row pointer)
- Secondary index lookup = 2 B+ tree traversals
- Random PK (UUID) causes page splits → use auto-increment or ORDERED UUID
```

---

### Replication Topologies

```
Source-Replica (most common):
┌────────┐    binlog     ┌──────────┐
│ Source  │──────────────►│ Replica  │
│ (R/W)  │               │ (R/O)    │
└────────┘               └──────────┘

Multi-Source:
┌────────┐                ┌──────────┐
│Source A │───────────────►│          │
└────────┘                │ Replica  │
┌────────┐                │ (merge)  │
│Source B │───────────────►│          │
└────────┘                └──────────┘

Group Replication (MySQL InnoDB Cluster):
┌────────┐    ┌────────┐    ┌────────┐
│ Node 1 │◄──►│ Node 2 │◄──►│ Node 3 │
│ (R/W)  │    │ (R/W)  │    │ (R/W)  │
└────────┘    └────────┘    └────────┘
Multi-primary: all nodes accept writes
Single-primary: one primary, others read-only
```

```sql
-- Check replication status (on replica)
SHOW REPLICA STATUS\G

-- Key fields:
-- Replica_IO_Running: Yes
-- Replica_SQL_Running: Yes
-- Seconds_Behind_Source: 0  (replication lag)

-- GTID-based replication (recommended over position-based)
-- Source configuration:
-- gtid_mode = ON
-- enforce_gtid_consistency = ON

-- Check GTID position
SELECT @@global.gtid_executed;
```

**Replication formats:**

| Format | How | Use Case |
|--------|-----|----------|
| **Statement-based (SBR)** | Replicates SQL statements | Compact, but non-deterministic functions break |
| **Row-based (RBR)** | Replicates actual row changes | Safe, deterministic, larger binlog |
| **Mixed** | Statement by default, row when needed | Best of both (default in 8.0+) |

---

### MySQL-Specific SQL Behaviors

```sql
-- AUTO_INCREMENT (MySQL equivalent of PostgreSQL SERIAL)
CREATE TABLE users (
    id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name  VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- UPSERT (MySQL syntax)
INSERT INTO products (sku, name, price, stock)
VALUES ('SKU-001', 'Widget', 29.99, 100)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    price = VALUES(price),
    stock = stock + VALUES(stock);

-- JSON support (MySQL 8.0+)
CREATE TABLE events (
    id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    payload JSON NOT NULL,
    INDEX idx_event_type ((CAST(payload->>'$.type' AS CHAR(50))))
);

INSERT INTO events (payload) VALUES (
    '{"type": "purchase", "amount": 99.99, "items": ["a", "b"]}'
);

SELECT
    payload->>'$.type' AS event_type,
    payload->>'$.amount' AS amount,
    JSON_LENGTH(payload->'$.items') AS item_count
FROM events
WHERE payload->>'$.type' = 'purchase';

-- Window functions (MySQL 8.0+)
SELECT name, department, salary,
       ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS dept_rank
FROM employees;

-- CTE (MySQL 8.0+)
WITH active_users AS (
    SELECT * FROM users WHERE status = 'active'
)
SELECT * FROM active_users WHERE created_at > '2024-01-01';

-- EXPLAIN FORMAT=TREE (MySQL 8.0.16+, similar to PostgreSQL EXPLAIN)
EXPLAIN FORMAT=TREE
SELECT * FROM orders WHERE user_id = 42;

-- Generated columns
CREATE TABLE products (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    price        DECIMAL(10,2) NOT NULL,
    tax_rate     DECIMAL(5,4) DEFAULT 0.08,
    total_price  DECIMAL(10,2) AS (price * (1 + tax_rate)) STORED,
    search_key   VARCHAR(200) AS (CONCAT(sku, ' ', LOWER(name))) STORED
);
```

---

### MySQL vs PostgreSQL Key Differences

| Feature | MySQL (InnoDB) | PostgreSQL |
|---------|---------------|------------|
| **Process model** | Thread-per-connection | Process-per-connection |
| **MVCC storage** | Undo logs (separate) | In-heap (xmin/xmax) |
| **Clustered index** | Yes (data = PK index) | No (heap + separate indexes) |
| **VACUUM needed** | No (undo purge automatic) | Yes (dead tuple cleanup) |
| **JSON** | JSON type (functional indexes) | JSONB (binary, GIN indexable) |
| **Full-text search** | FULLTEXT index (InnoDB) | tsvector/tsquery + GIN |
| **Partial indexes** | Not supported | Supported (WHERE clause) |
| **RLS** | Not supported | Row-Level Security |
| **EXCLUSION constraint** | Not supported | Supported (range overlaps) |
| **Extensions** | Limited (plugins) | Rich ecosystem (pgvector, PostGIS) |
| **Replication** | Binlog-based (mature) | WAL-based (streaming + logical) |
| **Connection overhead** | Low (threads) | High (processes) |
| **Default charset** | utf8mb4 (use this!) | UTF-8 |

---

### Character Set Pitfall

```sql
-- ALWAYS use utf8mb4, NEVER utf8 in MySQL
-- MySQL's "utf8" is actually utf8mb3 (3 bytes, no emoji support)
-- utf8mb4 is true UTF-8 (4 bytes, supports emoji and all Unicode)

CREATE TABLE posts (
    id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    content TEXT NOT NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;  -- case-insensitive, accent-insensitive

-- Check database charset
SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
FROM INFORMATION_SCHEMA.SCHEMATA
WHERE SCHEMA_NAME = 'mydb';

-- Convert existing table
ALTER TABLE posts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## Best Practices

1. **ALWAYS use InnoDB** — never MyISAM for new tables
2. **ALWAYS use utf8mb4** charset — never utf8 (which is utf8mb3 in MySQL)
3. **ALWAYS use BIGINT UNSIGNED AUTO_INCREMENT** for primary keys — INT overflows at 2B
4. **ALWAYS use GTID-based replication** — easier failover and topology changes
5. **ALWAYS use row-based replication (RBR)** — deterministic, safe
6. **ALWAYS define explicit ENGINE=InnoDB** — never rely on server defaults
7. **ALWAYS use connection pooling** (ProxySQL, MySQL Router, or application-level)
8. **ALWAYS use EXPLAIN FORMAT=TREE** to analyze queries (8.0.16+)
9. **NEVER use MySQL's utf8** — it truncates 4-byte characters (emoji, some CJK)
10. **NEVER use UUID as primary key** without ordered UUID (uuid_to_bin with swap flag) — causes random page splits

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Using utf8 instead of utf8mb4 | Emoji and special characters truncated | Convert to utf8mb4 |
| MyISAM tables | No transactions, no FK, table-level locking | Convert to InnoDB |
| Random UUID primary key | Slow inserts, page splits, fragmentation | Use auto-increment or ordered UUID |
| No connection pooling | "Too many connections" errors | Use ProxySQL or MySQL Router |
| Statement-based replication | Non-deterministic functions break replicas | Use ROW-based replication |
| INT primary key | Overflow at ~2 billion rows | Use BIGINT UNSIGNED |
| Not setting sql_mode strictly | Silent data truncation, invalid dates | Set sql_mode = 'STRICT_TRANS_TABLES' |
| No binlog monitoring | Disk fills with binlogs | Set expire_logs_days / binlog_expire_logs_seconds |
| Implicit charset defaults | Mix of latin1 and utf8 tables | Explicit charset on every table |
| SELECT * in production | Fetches unnecessary columns, breaks clustered index | Select only needed columns |

---

## Real-world Examples

### Facebook
- One of the largest MySQL deployments globally (thousands of shards)
- Custom storage engine (MyRocks — LSM-tree based) for write-heavy workloads
- Multi-region replication with custom failover automation
- Schema changes via gh-ost (online schema migration tool)

### Uber
- MySQL with Schemaless storage layer on top (Document store over MySQL)
- Migrated from PostgreSQL to MySQL for better replication and connection handling
- Thousands of MySQL instances with automated shard management

### Shopify
- MySQL at massive scale with Vitess for horizontal scaling
- ProxySQL for connection pooling and query routing
- GTID-based replication across availability zones
- Online schema changes with gh-ost for zero-downtime deployments

### GitHub
- MySQL for most persistent data (repositories, issues, pull requests)
- gh-ost developed internally for online schema changes
- Orchestrator for automated failover and topology management
- ProxySQL for read/write splitting

---

## Enforcement Checklist

- [ ] All tables use InnoDB engine
- [ ] All tables use utf8mb4 charset with utf8mb4_unicode_ci collation
- [ ] Primary keys use BIGINT UNSIGNED AUTO_INCREMENT
- [ ] GTID-based replication configured
- [ ] Row-based replication format (binlog_format = ROW)
- [ ] Connection pooling configured (ProxySQL or application-level)
- [ ] sql_mode includes STRICT_TRANS_TABLES
- [ ] EXPLAIN used for query optimization
- [ ] Binlog expiration configured
- [ ] Replica lag monitored with alerting
