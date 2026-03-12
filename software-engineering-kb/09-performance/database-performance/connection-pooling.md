# Connection Pool Performance Engineering

> **Domain:** Performance > Database Performance > Connection Pooling
> **Importance:** CRITICAL
> **Perspective:** Pool sizing, utilization measurement, leak detection, throughput optimization
> **Cross-ref:** 07-database/query-optimization/connection-pooling.md

## Pool Sizing Theory

### The Formula

```
Optimal pool size = (CPU cores * 2) + effective_spindle_count

Where:
  CPU cores   = database server cores (not app server)
  spindles    = 1 for SSD, count per disk for HDD RAID

Examples:
  4-core  + SSD: (4 * 2) + 1 = 9 connections
  8-core  + SSD: (8 * 2) + 1 = 17 connections
  16-core + SSD: (16 * 2) + 1 = 33 connections
  32-core + SSD: (32 * 2) + 1 = 65 connections
```

### Why Fewer Connections = Higher Throughput

```
Counterintuitive truth:
  A pool of 10 connections outperforms 200 direct connections.

  With 200 connections:
    - 200 OS processes (PG) each consuming 10MB RAM
    - CPU context switches between 200 processes
    - Lock contention increases with connection count
    - Result: 800 QPS at 250ms avg latency

  With 10 connections + pool queue:
    - 10 OS processes, 100MB RAM total
    - Minimal context switching
    - Reduced lock contention
    - Result: 2400 QPS at 4ms avg latency (3x throughput)

  The pool queue serializes access, reducing contention.
```

### Multi-Instance Pool Budget

```
Total budget = DB max_connections - reserved_connections (admin/monitoring)

Per-instance pool = budget / number_of_app_instances

Example:
  max_connections = 100, reserved = 10, 5 app instances
  Per-instance pool = (100 - 10) / 5 = 18 connections

With external pooler (PgBouncer/ProxySQL):
  PgBouncer → DB: 50 connections (fixed)
  N app instances → PgBouncer: unlimited client connections
  DB sees exactly 50 connections regardless of app scaling
```

## Pool Configuration by Technology

### PgBouncer (PostgreSQL)

```ini
[pgbouncer]
pool_mode = transaction             ; ALWAYS use transaction mode for web apps

; Core sizing
default_pool_size = 20              ; per user/db pair
min_pool_size = 5                   ; keep warm connections
reserve_pool_size = 5               ; burst capacity
max_client_conn = 2000              ; client-side limit
max_db_connections = 50             ; hard limit to database

; Timeouts (critical for pool health)
server_idle_timeout = 300           ; reclaim idle server conns (5 min)
client_idle_timeout = 600           ; drop idle clients (10 min)
query_wait_timeout = 30             ; max wait for available conn
server_connect_timeout = 10         ; fail fast on DB unreachable
server_login_retry = 3              ; retry on connect failure

; Health
server_check_query = SELECT 1
server_check_delay = 30
server_lifetime = 3600              ; recycle connections hourly
```

### ProxySQL (MySQL)

```sql
-- ProxySQL admin interface (port 6032)
-- Connection pool settings
UPDATE mysql_servers SET
  max_connections = 50,           -- per backend server
  max_replication_lag = 5         -- seconds; route reads away from lagging replicas
WHERE hostgroup_id IN (0, 1);

-- Multiplexing settings
UPDATE global_variables SET variable_value = 2048
WHERE variable_name = 'mysql-max_connections';
UPDATE global_variables SET variable_value = 10000
WHERE variable_name = 'mysql-connection_max_age_ms';  -- recycle after 10s
UPDATE global_variables SET variable_value = 1000
WHERE variable_name = 'mysql-ping_timeout_server';

LOAD MYSQL SERVERS TO RUNTIME; SAVE MYSQL SERVERS TO DISK;
```

### HikariCP (JVM)

```yaml
# application.yml (Spring Boot)
spring:
  datasource:
    hikari:
      maximum-pool-size: 20          # cores * 2 + 1
      minimum-idle: 5                # keep warm
      idle-timeout: 300000           # 5 minutes
      max-lifetime: 1800000          # 30 minutes (must be < DB wait_timeout)
      connection-timeout: 5000       # fail after 5s
      leak-detection-threshold: 30000 # warn if conn held > 30s
      validation-timeout: 3000       # health check timeout
      connection-test-query: SELECT 1
```

### Application-Level Pools

```typescript
// node-postgres Pool with performance tuning
import { Pool } from 'pg';

const pool = new Pool({
  max: 20,                       // match formula
  min: 5,
  idleTimeoutMillis: 30000,      // release idle after 30s
  connectionTimeoutMillis: 5000, // fail if no conn in 5s
  maxUses: 7500,                 // recycle after N uses (prevents leaks)
  allowExitOnIdle: false,
});

// CRITICAL: handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
  // Do NOT crash — pool recovers automatically
});
```

```go
// pgxpool with optimal settings
config, _ := pgxpool.ParseConfig(dsn)
config.MaxConns = 20
config.MinConns = 5
config.MaxConnLifetime = 30 * time.Minute
config.MaxConnIdleTime = 5 * time.Minute
config.HealthCheckPeriod = 30 * time.Second
```

```python
# SQLAlchemy pool configuration
engine = create_engine(dsn,
    pool_size=20,
    max_overflow=10,           # burst: up to 30 total
    pool_timeout=5,            # wait max 5s for connection
    pool_recycle=1800,         # recycle after 30 min
    pool_pre_ping=True,        # validate before checkout
)
```

## Transaction vs Session Pooling

```
Transaction Mode (recommended for 90% of apps):
  Connection assigned per transaction only.
  Between transactions → connection returned to pool.
  Multiplexing ratio: 100:1 possible.

  Limitations:
    - No LISTEN/NOTIFY
    - No server-side prepared statements (protocol-level OK)
    - No SET/session variables persisting across transactions
    - No temporary tables persisting across transactions
    - No advisory locks spanning transactions

Session Mode (required when):
  - Using LISTEN/NOTIFY
  - Using temp tables across transactions
  - Using SET that must persist across queries
  Multiplexing ratio: ~1:1 (minimal benefit)

Decision: Use transaction mode UNLESS you need session features.
```

## Connection Leak Detection

```typescript
// Connection leak detector with stack traces
class LeakDetectingPool {
  private outstanding = new Map<string, { stack: string; ts: number }>();
  private readonly maxHoldMs: number;

  constructor(private pool: Pool, maxHoldMs = 30_000) {
    this.maxHoldMs = maxHoldMs;
    setInterval(() => this.checkLeaks(), 10_000);
  }

  async connect(): Promise<PoolClient> {
    const client = await this.pool.connect();
    const id = crypto.randomUUID();
    this.outstanding.set(id, { stack: new Error().stack!, ts: Date.now() });
    const origRelease = client.release.bind(client);
    client.release = () => { this.outstanding.delete(id); return origRelease(); };
    return client;
  }

  private checkLeaks() {
    const now = Date.now();
    for (const [id, info] of this.outstanding) {
      if (now - info.ts > this.maxHoldMs) {
        console.error(`LEAK: connection held for ${(now - info.ts) / 1000}s\n${info.stack}`);
      }
    }
  }
}
```

```go
// Go: context-based timeout prevents leaks automatically
func query(ctx context.Context, pool *pgxpool.Pool) error {
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel() // connection released even if query hangs

    rows, err := pool.Query(ctx, "SELECT ...")
    if err != nil { return err }
    defer rows.Close() // ALWAYS close rows
    // ...
    return nil
}
```

```sql
-- PostgreSQL: find leaked connections
SELECT pid, usename, state, query,
  NOW() - state_change AS held_duration
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND NOW() - state_change > INTERVAL '5 minutes'
ORDER BY held_duration DESC;

-- Kill leaked connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND NOW() - state_change > INTERVAL '30 minutes';

-- Prevent via PostgreSQL setting
ALTER SYSTEM SET idle_in_transaction_session_timeout = '60s';
SELECT pg_reload_conf();
```

## Pool Utilization Monitoring

```typescript
// Prometheus metrics for pool health
import { Gauge, Histogram } from 'prom-client';

const metrics = {
  total: new Gauge({ name: 'db_pool_total', help: 'Total pool connections' }),
  idle: new Gauge({ name: 'db_pool_idle', help: 'Idle connections' }),
  waiting: new Gauge({ name: 'db_pool_waiting', help: 'Queued requests' }),
  checkoutMs: new Histogram({
    name: 'db_pool_checkout_ms', help: 'Connection checkout latency',
    buckets: [1, 5, 10, 50, 100, 500, 1000, 5000],
  }),
};

setInterval(() => {
  metrics.total.set(pool.totalCount);
  metrics.idle.set(pool.idleCount);
  metrics.waiting.set(pool.waitingCount);
}, 5000);

// Alert thresholds:
//   waiting > 0 for >30s  → pool exhaustion imminent
//   idle == 0 for >60s    → pool too small
//   checkout_ms P99 > 100 → pool contention
```

```sql
-- PgBouncer: pool utilization query
SHOW POOLS;
-- Key columns: cl_active, cl_waiting, sv_active, sv_idle
-- cl_waiting > 0 means clients are queueing for connections

SHOW STATS;
-- total_query_count, total_query_time, avg_query_time

-- PostgreSQL: connection utilization
SELECT count(*) AS total,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle') AS idle,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_tx,
  current_setting('max_connections')::int AS max_conn
FROM pg_stat_activity WHERE backend_type = 'client backend';
```

---

## 10 Best Practices

1. **Size pools with the formula** — `(cores * 2) + spindles`, never arbitrary large numbers.
2. **Use an external pooler** (PgBouncer/ProxySQL) with 3+ app instances.
3. **Use transaction pooling mode** unless LISTEN/NOTIFY or temp tables required.
4. **Set connection checkout timeout to 5s** — fail fast, do not queue indefinitely.
5. **Set idle_in_transaction_session_timeout** — kill leaked transactions at 60s.
6. **Monitor pool waiting count** — any sustained waiting signals pool exhaustion.
7. **Recycle connections periodically** — `max_lifetime = 30min` prevents stale connections.
8. **Use pool_pre_ping** (SQLAlchemy) or health checks — validate before checkout.
9. **Budget total connections across all instances** — sum of all pools < max_connections.
10. **Release connections in finally/defer** — never rely on garbage collection.

---

## 8 Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Pool size = 200 "for safety" | CPU contention, lower throughput | Use formula: (cores * 2) + 1 |
| No external pooler at scale | N instances x pool = connection explosion | Deploy PgBouncer/ProxySQL |
| Session pooling mode | 1:1 ratio, no multiplexing benefit | Switch to transaction mode |
| No checkout timeout | Requests hang forever on exhausted pool | Set 5s timeout, return 503 |
| Holding connection during HTTP calls | Pool starvation during external I/O | Release before non-DB work |
| No pool metrics | Exhaustion discovered via user complaints | Export pool gauges to Prometheus |
| Creating pool per request | Defeats entire purpose of pooling | Single pool per application lifecycle |
| No idle_in_transaction_timeout | Leaked transactions block forever | Set to 60s in postgresql.conf |

---

## Enforcement Checklist

- [ ] Pool size calculated from formula, documented per service
- [ ] External pooler deployed for multi-instance services
- [ ] Transaction pooling mode configured (justify if using session)
- [ ] Connection checkout timeout set (max 5s for web, 30s for batch)
- [ ] idle_in_transaction_session_timeout set to 60s
- [ ] Pool metrics exported: total, idle, waiting, checkout latency
- [ ] Alerting on sustained waiting count > 0
- [ ] Connection leak detection enabled in development
- [ ] max_connections budget documented across all services
- [ ] Connection recycling configured (max_lifetime 30 min)
