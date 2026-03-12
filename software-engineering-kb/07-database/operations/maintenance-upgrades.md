# Database Maintenance & Upgrades

> **Domain:** Database > Operations > Maintenance & Upgrades
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Databases require ongoing maintenance to prevent performance degradation, data corruption, and security vulnerabilities. Table bloat from dead tuples, index bloat from frequent updates, stale statistics from data changes, and transaction ID wraparound are all ticking time bombs without regular maintenance. Major version upgrades bring performance improvements, security patches, and new features — but require careful planning to avoid downtime. Every production database MUST have a maintenance schedule and an upgrade strategy.

---

## How It Works

### PostgreSQL Maintenance Operations

```
PostgreSQL Maintenance Tasks:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  VACUUM (Dead Tuple Cleanup)                              │
│  ├── Regular VACUUM — marks dead tuples as reusable      │
│  │   Does NOT reclaim disk space                         │
│  │   Does NOT lock the table                             │
│  │   Should run frequently (autovacuum handles this)     │
│  │                                                        │
│  ├── VACUUM FULL — rewrites table, reclaims disk space   │
│  │   ⚠ EXCLUSIVE LOCK — blocks all reads and writes     │
│  │   Use only when table is severely bloated             │
│  │   Alternative: pg_repack (no lock)                    │
│  │                                                        │
│  └── VACUUM FREEZE — prevents transaction ID wraparound  │
│      Marks tuples as "frozen" (visible to all future txs)│
│      Required to prevent catastrophic XID wraparound     │
│                                                            │
│  ANALYZE (Statistics Update)                              │
│  ├── Updates planner statistics for query optimization    │
│  ├── Run after bulk data changes (imports, migrations)   │
│  └── Autovacuum includes autoanalyze                     │
│                                                            │
│  REINDEX (Index Rebuild)                                  │
│  ├── Rebuilds bloated indexes                            │
│  ├── REINDEX CONCURRENTLY (PG 12+) — no lock            │
│  └── Monitor index bloat to determine when needed        │
│                                                            │
│  CLUSTER (Physical Reordering)                            │
│  ├── Reorders table data to match index order            │
│  ├── Improves range scan performance                     │
│  ├── ⚠ EXCLUSIVE LOCK                                   │
│  └── Rarely needed, one-time benefit                     │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

```sql
-- Autovacuum tuning (postgresql.conf)
-- Default settings are conservative — tune for production

-- Global autovacuum settings
autovacuum = on
autovacuum_max_workers = 3                -- Parallel vacuum workers
autovacuum_naptime = 60                   -- Check interval (seconds)
autovacuum_vacuum_threshold = 50          -- Min dead tuples before vacuum
autovacuum_vacuum_scale_factor = 0.1      -- % of table that triggers vacuum
autovacuum_analyze_threshold = 50         -- Min changes before analyze
autovacuum_analyze_scale_factor = 0.05    -- % of table that triggers analyze
autovacuum_vacuum_cost_delay = 2          -- Cost-based delay (ms)
autovacuum_vacuum_cost_limit = 1000       -- Work budget per round

-- Per-table autovacuum tuning (for high-traffic tables)
ALTER TABLE orders SET (
    autovacuum_vacuum_scale_factor = 0.01,    -- Vacuum at 1% dead tuples
    autovacuum_vacuum_threshold = 1000,        -- Minimum threshold
    autovacuum_analyze_scale_factor = 0.005,   -- Analyze at 0.5% changes
    autovacuum_vacuum_cost_delay = 0           -- No delay (aggressive vacuum)
);

-- Monitor autovacuum activity
SELECT
    schemaname || '.' || relname AS table_name,
    n_live_tup,
    n_dead_tup,
    ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    autovacuum_count,
    vacuum_count
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 20;

-- Check for tables needing vacuum
SELECT
    schemaname || '.' || relname AS table_name,
    n_dead_tup,
    pg_size_pretty(pg_total_relation_size(relid)) AS size,
    last_autovacuum,
    now() - last_autovacuum AS since_last_vacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC;
```

### Index Maintenance

```sql
-- Detect index bloat (PostgreSQL)
-- Index bloat = wasted space from deleted/updated rows
SELECT
    schemaname || '.' || tablename AS table_name,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS times_used,
    CASE WHEN idx_scan = 0 THEN 'UNUSED — consider dropping'
         ELSE 'ACTIVE'
    END AS status
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

-- Rebuild bloated index (non-blocking)
REINDEX INDEX CONCURRENTLY idx_orders_user_id;

-- Rebuild all indexes on a table (non-blocking, PG 14+)
REINDEX TABLE CONCURRENTLY orders;

-- Alternative: create replacement index, drop old one
CREATE INDEX CONCURRENTLY idx_orders_user_id_new ON orders (user_id);
DROP INDEX idx_orders_user_id;
ALTER INDEX idx_orders_user_id_new RENAME TO idx_orders_user_id;

-- pg_repack — repack tables and indexes without locks
-- Install: CREATE EXTENSION pg_repack;
-- Usage (command-line):
-- pg_repack -d mydb -t orders          -- repack table (no lock)
-- pg_repack -d mydb -t orders -x       -- repack indexes only
-- pg_repack -d mydb                    -- repack all bloated tables
```

### Transaction ID Wraparound Prevention

```sql
-- PostgreSQL uses 32-bit transaction IDs (4.2 billion max)
-- When approaching limit, database enters read-only mode (emergency)
-- VACUUM FREEZE prevents this by marking old tuples as "frozen"

-- Check XID age (wraparound risk)
SELECT
    datname,
    age(datfrozenxid) AS xid_age,
    ROUND(age(datfrozenxid) * 100.0 / 2147483647, 2) AS pct_to_wraparound,
    CASE
        WHEN age(datfrozenxid) > 1500000000 THEN 'CRITICAL'
        WHEN age(datfrozenxid) > 1000000000 THEN 'WARNING'
        ELSE 'OK'
    END AS status
FROM pg_database
ORDER BY age(datfrozenxid) DESC;

-- Tables with oldest XID (most urgent need for freeze)
SELECT
    schemaname || '.' || relname AS table_name,
    age(relfrozenxid) AS xid_age,
    pg_size_pretty(pg_total_relation_size(oid)) AS size,
    last_autovacuum
FROM pg_class
JOIN pg_stat_user_tables USING (relname)
WHERE relkind = 'r'
ORDER BY age(relfrozenxid) DESC
LIMIT 10;

-- Manual freeze for urgent tables
VACUUM FREEZE orders;
```

### Major Version Upgrades

```
PostgreSQL Major Version Upgrade Methods:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  1. pg_upgrade (In-Place, Fastest)                       │
│     ├── Copies/links data files to new version           │
│     ├── Requires brief downtime (minutes for link mode)  │
│     ├── --link mode: seconds of downtime                 │
│     ├── --clone mode (PG 17+): fastest, no extra space   │
│     └── Recommended for most upgrades                    │
│                                                            │
│  2. Logical Replication (Minimal Downtime)               │
│     ├── Set up logical replication from old to new       │
│     ├── Let replica catch up                             │
│     ├── Switch application to new server                 │
│     ├── Downtime: seconds (DNS/proxy switch)             │
│     └── Recommended for large databases                  │
│                                                            │
│  3. pg_dump / pg_restore (Simplest)                      │
│     ├── Dump from old, restore to new                    │
│     ├── Extended downtime (hours for large DBs)          │
│     └── Use only for small databases                     │
│                                                            │
│  4. Managed Service Upgrade (AWS RDS, Cloud SQL)         │
│     ├── Provider handles upgrade                         │
│     ├── Brief downtime (varies by provider)              │
│     ├── Blue-green deployment option (RDS)               │
│     └── Recommended for managed databases                │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

```bash
# pg_upgrade — in-place major version upgrade
# Example: PostgreSQL 15 → 16

# Step 1: Install new version alongside old
sudo apt install postgresql-16

# Step 2: Stop both servers
sudo systemctl stop postgresql@15-main
sudo systemctl stop postgresql@16-main

# Step 3: Run pg_upgrade (link mode for speed)
sudo -u postgres pg_upgrade \
  --old-datadir=/var/lib/postgresql/15/main \
  --new-datadir=/var/lib/postgresql/16/main \
  --old-bindir=/usr/lib/postgresql/15/bin \
  --new-bindir=/usr/lib/postgresql/16/bin \
  --link \
  --check  # Dry run first!

# If check passes, run for real (remove --check)
sudo -u postgres pg_upgrade \
  --old-datadir=/var/lib/postgresql/15/main \
  --new-datadir=/var/lib/postgresql/16/main \
  --old-bindir=/usr/lib/postgresql/15/bin \
  --new-bindir=/usr/lib/postgresql/16/bin \
  --link

# Step 4: Start new version
sudo systemctl start postgresql@16-main

# Step 5: Update statistics (IMPORTANT)
sudo -u postgres /usr/lib/postgresql/16/bin/vacuumdb \
  --all --analyze-in-stages

# Step 6: Delete old cluster (after validation)
sudo -u postgres ./delete_old_cluster.sh
```

### Maintenance Schedule

```
Recommended Maintenance Schedule:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  CONTINUOUS (Autovacuum)                                  │
│  ├── VACUUM — dead tuple cleanup                         │
│  ├── ANALYZE — statistics update                         │
│  └── Handled automatically, monitor for lag              │
│                                                            │
│  DAILY                                                    │
│  ├── Check backup success                                │
│  ├── Check replication lag                                │
│  ├── Review slow query log                               │
│  └── Check disk space usage                              │
│                                                            │
│  WEEKLY                                                   │
│  ├── Review pg_stat_statements top queries               │
│  ├── Check for unused indexes                            │
│  ├── Review connection count trends                      │
│  ├── Check autovacuum effectiveness                      │
│  └── Review error logs                                   │
│                                                            │
│  MONTHLY                                                  │
│  ├── Check index bloat, REINDEX if needed                │
│  ├── Review table sizes and growth                       │
│  ├── Verify XID age (wraparound risk)                    │
│  ├── Review and rotate logs                              │
│  └── Test backup restore procedure                       │
│                                                            │
│  QUARTERLY                                                │
│  ├── Remove unused indexes                               │
│  ├── Review and update autovacuum settings               │
│  ├── Performance benchmark comparison                    │
│  ├── Security audit (users, permissions)                 │
│  └── Evaluate minor version upgrade                      │
│                                                            │
│  ANNUALLY                                                 │
│  ├── Major version upgrade evaluation                    │
│  ├── Hardware/capacity planning review                   │
│  ├── DR drill (full failover test)                       │
│  └── Security penetration test                           │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## Best Practices

1. **ALWAYS let autovacuum run** — never disable it in production
2. **ALWAYS tune autovacuum** for high-traffic tables — default settings are too conservative
3. **ALWAYS monitor XID age** — wraparound puts database in read-only mode
4. **ALWAYS use pg_repack** over VACUUM FULL — no exclusive lock required
5. **ALWAYS use REINDEX CONCURRENTLY** — non-blocking index rebuilds
6. **ALWAYS test upgrades** on staging with production data before production
7. **ALWAYS run ANALYZE after bulk imports** — keep planner statistics current
8. **NEVER disable autovacuum** — even temporarily for "performance"
9. **NEVER skip major version upgrades** for more than 2 versions — support ends
10. **NEVER upgrade without tested backup** — have a rollback plan

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Disabled autovacuum | Table bloat, slow queries | Enable and tune autovacuum |
| No XID monitoring | Database enters read-only mode | Monitor age(), alert at 50% |
| VACUUM FULL in production | Exclusive lock, extended downtime | Use pg_repack instead |
| Never rebuilding indexes | Index bloat, wasted I/O | Monthly REINDEX CONCURRENTLY |
| Skipping version upgrades | Missing security patches, features | Upgrade annually |
| No upgrade testing | Upgrade fails in production | Test on staging first |
| No maintenance schedule | Issues accumulate until crisis | Implement scheduled checks |
| Not tuning per-table vacuum | High-traffic tables not vacuumed enough | Set per-table autovacuum parameters |

---

## Enforcement Checklist

- [ ] Autovacuum enabled and tuned for production workload
- [ ] High-traffic tables have per-table autovacuum settings
- [ ] XID age monitored and alerted (> 50% of wraparound)
- [ ] Index bloat checked monthly
- [ ] pg_repack installed for non-blocking table maintenance
- [ ] Major version upgrade plan documented
- [ ] Upgrades tested on staging before production
- [ ] Maintenance schedule documented and followed
- [ ] Backup verified before any maintenance operation
- [ ] ANALYZE run after bulk data changes
