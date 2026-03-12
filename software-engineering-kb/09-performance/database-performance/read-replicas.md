# Read Replica Performance Engineering

> **Domain:** Performance > Database Performance > Read Replicas
> **Importance:** HIGH
> **Perspective:** Replication lag measurement, consistency trade-offs, routing strategies
> **Cross-ref:** 07-database/scaling/read-replicas-load.md, 07-database/scaling/replication.md

## Read/Write Splitting Strategies

### Architecture Decision Framework

```
Workload Analysis → Splitting Strategy:
┌─────────────────────────────────────────────────────────────┐
│ Read/Write Ratio    │ Strategy                              │
├─────────────────────┼───────────────────────────────────────┤
│ < 70% reads         │ Single primary, no replicas needed    │
│ 70-90% reads        │ 1-2 replicas, application-level split │
│ 90-99% reads        │ 2-5 replicas, proxy-based split       │
│ > 99% reads         │ 5+ replicas, heavy caching layer      │
└─────────────────────┴───────────────────────────────────────┘
```

### Application-Level Routing

```typescript
// TypeScript: context-aware read/write router
import { Pool } from 'pg';

interface DBRouter {
  primary: Pool;
  replica: () => Pool;
  readAfterWrite: (userId: string) => Pool;
}

function createRouter(primaryDsn: string, replicaDsns: string[]): DBRouter {
  const primary = new Pool({ connectionString: primaryDsn, max: 20 });
  const replicas = replicaDsns.map(dsn => new Pool({ connectionString: dsn, max: 20 }));
  let counter = 0;

  // Track recent writes for read-after-write consistency
  const recentWrites = new Map<string, number>(); // userId → timestamp
  const RAW_WINDOW_MS = 5000; // 5 second read-after-write window

  return {
    primary,
    replica: () => replicas[counter++ % replicas.length],
    readAfterWrite: (userId: string) => {
      const lastWrite = recentWrites.get(userId);
      if (lastWrite && Date.now() - lastWrite < RAW_WINDOW_MS) {
        return primary; // route to primary within RAW window
      }
      return replicas[counter++ % replicas.length];
    },
  };
}

// Usage patterns
async function getOrders(db: DBRouter, userId: string) {
  // Reads: go to replica with RAW check
  return db.readAfterWrite(userId).query(
    'SELECT * FROM orders WHERE user_id = $1', [userId]
  );
}
async function createOrder(db: DBRouter, userId: string, total: number) {
  // Writes: always primary
  return db.primary.query(
    'INSERT INTO orders (user_id, total) VALUES ($1, $2)', [userId, total]
  );
}
```

```go
// Go: middleware-based read/write routing
type ReadWriteDB struct {
    Primary  *pgxpool.Pool
    Replicas []*pgxpool.Pool
    counter  atomic.Uint64
    rawCache sync.Map // userId → writeTimestamp
}

func (db *ReadWriteDB) Replica() *pgxpool.Pool {
    idx := db.counter.Add(1) % uint64(len(db.Replicas))
    return db.Replicas[idx]
}

func (db *ReadWriteDB) ForRead(ctx context.Context, userID string) *pgxpool.Pool {
    if ts, ok := db.rawCache.Load(userID); ok {
        if time.Since(ts.(time.Time)) < 5*time.Second {
            return db.Primary // read-after-write consistency
        }
        db.rawCache.Delete(userID)
    }
    return db.Replica()
}

func (db *ReadWriteDB) MarkWrite(userID string) {
    db.rawCache.Store(userID, time.Now())
}
```

```python
# Python: Django database router
class ReadWriteRouter:
    def db_for_read(self, model, **hints):
        # Route analytics models to dedicated analytics replica
        if model._meta.app_label == 'analytics':
            return 'analytics_replica'
        return 'replica'

    def db_for_write(self, model, **hints):
        return 'primary'

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        return db == 'primary'

# settings.py
DATABASES = {
    'primary': {'ENGINE': 'django.db.backends.postgresql', 'HOST': 'primary.db'},
    'replica': {'ENGINE': 'django.db.backends.postgresql', 'HOST': 'replica1.db'},
    'analytics_replica': {'ENGINE': 'django.db.backends.postgresql', 'HOST': 'replica2.db'},
}
DATABASE_ROUTERS = ['myapp.routers.ReadWriteRouter']
```

### Proxy-Based Routing

```sql
-- ProxySQL: automatic read/write splitting
INSERT INTO mysql_query_rules (rule_id, match_digest, destination_hostgroup, apply)
VALUES
  (1, '^SELECT.*FOR UPDATE', 0, 1),   -- SELECT FOR UPDATE → primary
  (2, '^SELECT', 1, 1),                -- SELECT → replica hostgroup
  (3, '.*', 0, 1);                     -- everything else → primary
LOAD MYSQL QUERY RULES TO RUNTIME;

-- HAProxy: TCP-level routing (PostgreSQL)
-- haproxy.cfg
-- frontend pg_write
--   bind *:5432
--   default_backend pg_primary
-- frontend pg_read
--   bind *:5433
--   default_backend pg_replicas
-- backend pg_replicas
--   balance roundrobin
--   server replica1 replica1:5432 check
--   server replica2 replica2:5432 check
```

## Replication Lag Monitoring

```sql
-- PostgreSQL: check lag on PRIMARY
SELECT client_addr, state,
  pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn) AS send_lag_bytes,
  pg_wal_lsn_diff(pg_current_wal_lsn(), write_lsn) AS write_lag_bytes,
  pg_wal_lsn_diff(pg_current_wal_lsn(), flush_lsn) AS flush_lag_bytes,
  pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS replay_lag_bytes,
  pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS replay_lag
FROM pg_stat_replication;

-- PostgreSQL: check lag on REPLICA (PG 10+)
SELECT CASE WHEN pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn()
  THEN 0
  ELSE EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp())
END AS lag_seconds;

-- MySQL: check lag on replica
SHOW REPLICA STATUS\G
-- Key fields: Seconds_Behind_Source, Relay_Log_Space
-- Seconds_Behind_Source = NULL means replication broken
```

### Lag-Aware Routing

```typescript
// Route reads based on acceptable lag tolerance
interface LagAwareRouter {
  query(sql: string, params: any[], opts?: { maxLagMs?: number }): Promise<any>;
}

class LagAwarePool implements LagAwareRouter {
  private lagMs = new Map<string, number>(); // replica → current lag

  constructor(
    private primary: Pool,
    private replicas: { pool: Pool; host: string }[]
  ) {
    // Poll lag every 5 seconds
    setInterval(() => this.updateLag(), 5000);
  }

  private async updateLag() {
    for (const r of this.replicas) {
      try {
        const { rows } = await r.pool.query(`
          SELECT EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp()) * 1000 AS lag_ms
        `);
        this.lagMs.set(r.host, rows[0]?.lag_ms ?? Infinity);
      } catch { this.lagMs.set(r.host, Infinity); }
    }
  }

  async query(sql: string, params: any[], opts?: { maxLagMs?: number }) {
    const maxLag = opts?.maxLagMs ?? 5000; // default 5s tolerance
    const eligible = this.replicas.filter(
      r => (this.lagMs.get(r.host) ?? Infinity) <= maxLag
    );
    if (eligible.length === 0) return this.primary.query(sql, params);
    const chosen = eligible[Math.floor(Math.random() * eligible.length)];
    return chosen.pool.query(sql, params);
  }
}

// Usage: strict consistency requirement
await router.query('SELECT balance FROM accounts WHERE id=$1', [id], { maxLagMs: 0 });
// Usage: dashboard tolerates 10s lag
await router.query('SELECT COUNT(*) FROM orders', [], { maxLagMs: 10000 });
```

## Consistency Models

```
Eventual Consistency (default with async replication):
  Replica may be 0-N seconds behind primary.
  Acceptable for: dashboards, analytics, search, browsing.
  Latency: lowest (no coordination).

Read-After-Write Consistency:
  After a write, subsequent reads by SAME USER see the write.
  Implementation: route to primary within N-second window.
  Acceptable for: user profile updates, order confirmation.

Strong Consistency (synchronous replication):
  All replicas have latest data before commit returns.
  Implementation: synchronous_commit = 'remote_apply' (PG).
  Acceptable for: financial transactions, inventory.
  Cost: write latency includes replica apply time.
```

```sql
-- PostgreSQL: synchronous replication config
ALTER SYSTEM SET synchronous_standby_names = 'FIRST 1 (replica1, replica2)';
-- Write waits for at least 1 replica to confirm
-- Trade-off: write latency increases by network RTT + apply time

-- Per-transaction consistency level
BEGIN;
SET LOCAL synchronous_commit = 'remote_apply'; -- strong for this TX
UPDATE accounts SET balance = balance - 100 WHERE id = 42;
COMMIT; -- waits for replica to apply

BEGIN;
SET LOCAL synchronous_commit = 'local'; -- eventual for this TX
INSERT INTO page_views (url) VALUES ('/home');
COMMIT; -- returns immediately, async to replicas
```

## Directing Analytics to Replicas

```sql
-- Dedicated analytics replica with different configuration
-- On analytics replica postgresql.conf:
-- max_parallel_workers_per_gather = 8    (higher than OLTP)
-- work_mem = 512MB                       (larger for aggregations)
-- statement_timeout = 600s               (allow long reports)
-- shared_buffers = 50% of RAM            (more for cold reads)
```

```typescript
// Separate pool for analytics with higher timeouts
const analyticsPool = new Pool({
  connectionString: process.env.ANALYTICS_REPLICA_URL,
  max: 10,
  statement_timeout: 120000, // 2 min for reports
});

// Route by query type
function getPool(queryType: 'oltp' | 'analytics'): Pool {
  return queryType === 'analytics' ? analyticsPool : router.replica();
}
```

## Cross-Region Replicas

```
┌──────────────┐          ┌──────────────┐
│  US-East     │ ──WAL──> │  EU-West     │
│  Primary     │  ~80ms   │  Replica     │
│  (writes)    │          │  (reads)     │
└──────────────┘          └──────────────┘
                              │
  EU users read from EU replica: ~5ms
  EU users read from US primary: ~80ms
  16x latency improvement for reads
```

```
Monitor cross-region lag: 50-500ms same-region, 200ms-5s cross-region.
```

## Failover and Promotion

```sql
-- PostgreSQL: promote replica to primary
SELECT pg_promote(); -- PG 12+
-- Or: pg_ctl promote -D /var/lib/postgresql/data

-- Pre-promotion checklist:
-- 1. Verify replica is caught up (replay_lag = 0)
-- 2. Stop writes to old primary
-- 3. Wait for replay to complete
-- 4. Promote replica
-- 5. Update application connection strings
-- 6. Reconfigure remaining replicas to follow new primary
```

```typescript
// Health-check based failover in application
class FailoverRouter {
  private primaryHealthy = true;

  constructor(private primary: Pool, private replicas: Pool[]) {
    setInterval(() => this.checkPrimary(), 5000);
  }

  private async checkPrimary() {
    try {
      await this.primary.query('SELECT 1');
      this.primaryHealthy = true;
    } catch {
      this.primaryHealthy = false;
      console.error('PRIMARY UNREACHABLE — reads falling back to replicas');
    }
  }

  getWritePool(): Pool {
    if (!this.primaryHealthy) throw new Error('Primary unavailable');
    return this.primary;
  }

  getReadPool(): Pool {
    if (this.replicas.length === 0) return this.primary;
    return this.replicas[Math.floor(Math.random() * this.replicas.length)];
  }
}
```

---

## 10 Best Practices

1. **Add read replicas before sharding** — 10x read capacity with minimal complexity.
2. **Implement read-after-write consistency** — route reads to primary within 5s of a write.
3. **Monitor replication lag continuously** — alert at >1s for OLTP, >30s for analytics.
4. **Use lag-aware routing** — exclude replicas exceeding acceptable lag threshold.
5. **Dedicate an analytics replica** — configure it with higher work_mem and parallelism.
6. **Deploy cross-region replicas** for global latency — 10-50x read latency reduction.
7. **Use synchronous replication only for critical paths** — financial, inventory writes.
8. **Route SELECT FOR UPDATE to primary** — these are write-intent queries.
9. **Test failover procedures quarterly** — promote replica, verify app reconnection.
10. **Separate connection pools per replica** — monitor health and lag independently.

---

## 8 Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Reading from primary for all queries | Primary overloaded, replicas idle | Route reads to replicas |
| No read-after-write handling | Users see stale data after updates | Track writes, route to primary in window |
| Ignoring replication lag | Serving seconds-stale data silently | Monitor lag, route away from lagging replicas |
| Synchronous replication everywhere | 2-5x write latency increase | Use sync only for critical transactions |
| No failover plan | Multi-hour outage on primary failure | Automate promotion, test quarterly |
| All reads to one replica | Unbalanced load, single point of failure | Round-robin across replicas |
| Analytics queries on OLTP replicas | Long queries block replication apply | Dedicate analytics replica |
| Cross-region replica without lag budget | Unexpected consistency issues | Set explicit maxLagMs per query type |

---

## Enforcement Checklist

- [ ] Read replicas deployed (minimum 1 for production)
- [ ] Read/write splitting implemented in application or proxy
- [ ] Read-after-write consistency handled for user-facing flows
- [ ] Replication lag monitored with alerting (threshold: 1s OLTP, 30s analytics)
- [ ] Lag-aware routing excludes lagging replicas from read pool
- [ ] Analytics queries directed to dedicated replica
- [ ] Failover procedure documented and tested quarterly
- [ ] Cross-region replicas deployed for global user base
- [ ] Separate connection pools configured per replica
- [ ] SELECT FOR UPDATE routed to primary
