# Connection Pooling

> **Domain:** Database > Query Optimization > Connection Pooling
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Database connections are expensive. Each PostgreSQL connection spawns a new OS process (~10MB RAM). Each MySQL connection spawns a new OS thread (~1MB). Opening a connection requires TCP handshake, TLS negotiation, authentication, and session setup — 20-100ms per connection. Without pooling, a web server handling 1,000 concurrent requests opens 1,000 database connections, consuming 10GB of RAM on PostgreSQL alone. Connection pooling maintains a fixed set of reusable connections, reducing connection overhead from milliseconds to microseconds and limiting database resource consumption. Every production application MUST use connection pooling.

---

## How It Works

### The Problem Without Pooling

```
Without Connection Pooling:
┌─────────────┐     ┌──────────────────────────────┐
│  App Server  │     │         Database              │
│  (1000 req)  │────>│  1000 connections = 10GB RAM  │
│              │     │  Connection overhead: 50ms     │
│              │     │  Max connections: 100 default  │
└─────────────┘     └──────────────────────────────┘
  → Connections exhausted after 100 requests
  → Remaining 900 requests fail with "too many connections"

With Connection Pooling:
┌─────────────┐     ┌──────────┐     ┌────────────────────┐
│  App Server  │     │  Pool    │     │     Database        │
│  (1000 req)  │────>│  (20     │────>│  20 connections     │
│              │     │  conns)  │     │  = 200MB RAM        │
│              │     │          │     │  Reused instantly    │
└─────────────┘     └──────────┘     └────────────────────┘
  → 1000 requests share 20 connections
  → Requests queue when all connections busy
  → Total throughput: higher with less resources
```

### Connection Lifecycle Cost

```
Connection Creation Steps:
1. TCP 3-way handshake           ~1-3ms (local), ~50ms (cross-region)
2. TLS negotiation               ~5-30ms
3. Authentication                 ~2-10ms
4. Session initialization        ~1-5ms
5. Backend process fork (PG)     ~5-20ms
   ─────────────────────────────────────
   Total:                         ~15-70ms per connection

Connection Reuse from Pool:
1. Checkout from pool            ~0.01ms
   ─────────────────────────────────────
   Total:                         ~0.01ms (1000x faster)
```

### Pool Architecture Types

```
Architecture Type 1: Application-Level Pool (Built-in)
┌──────────────────────────┐     ┌──────────┐
│  Application              │     │ Database  │
│  ┌──────────────────┐    │     │           │
│  │  Connection Pool  │───────>│  N conns  │
│  │  (HikariCP, pgx)  │    │     │           │
│  └──────────────────┘    │     └──────────┘
│  - Per-process pool       │
│  - Language-specific      │
│  - No external dependency │
└──────────────────────────┘

Architecture Type 2: External Proxy Pool (PgBouncer, ProxySQL)
┌─────────────┐     ┌─────────────┐     ┌──────────┐
│  App 1       │────>│             │     │          │
│  App 2       │────>│  PgBouncer  │────>│ Database │
│  App 3       │────>│  (proxy)    │     │ (50 conn)│
│  App N       │────>│             │     │          │
└─────────────┘     └─────────────┘     └──────────┘
  - Shared across all application instances
  - Connection multiplexing
  - Database sees fewer connections
  - Independent scaling

Architecture Type 3: Sidecar Pool (Cloud-Native)
┌─────────────────────────────────┐     ┌──────────┐
│  Pod                             │     │          │
│  ┌──────────┐  ┌──────────────┐ │     │ Database │
│  │   App    │──│ Cloud SQL    │───────│          │
│  │          │  │ Auth Proxy   │ │     │          │
│  └──────────┘  └──────────────┘ │     └──────────┘
│  - Runs as sidecar container     │
│  - Handles auth + pooling        │
│  - Cloud-native pattern          │
└─────────────────────────────────┘
```

### Application-Level Pooling

```typescript
// TypeScript — pg Pool (node-postgres)
import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: 'myapp',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Pool sizing
  max: 20,                    // Maximum connections in pool
  min: 5,                     // Minimum idle connections maintained
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail if can't get connection in 5s

  // Connection validation
  allowExitOnIdle: false,     // Keep pool alive even when idle
});

// Basic query (auto-checkout and return)
const result = await pool.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// Explicit checkout for transactions
const client: PoolClient = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
  await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release(); // ALWAYS release back to pool
}

// Pool monitoring
pool.on('connect', () => console.log('New connection created'));
pool.on('acquire', () => console.log('Connection checked out'));
pool.on('release', () => console.log('Connection returned'));
pool.on('error', (err) => console.error('Pool error:', err));

// Health check
const poolStatus = {
  total: pool.totalCount,     // Total connections
  idle: pool.idleCount,       // Available connections
  waiting: pool.waitingCount, // Queued requests
};
```

```python
# Python — SQLAlchemy connection pool
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    "postgresql+asyncpg://user:pass@localhost/mydb",

    # Pool sizing
    pool_size=20,              # Maintained connections
    max_overflow=10,           # Extra connections under load (total: 30)
    pool_timeout=30,           # Seconds to wait for connection
    pool_recycle=1800,         # Recycle connections after 30 minutes
    pool_pre_ping=True,        # Validate connection before use (SELECT 1)

    poolclass=QueuePool,       # Default pool implementation
)

# Connection usage
with engine.connect() as conn:
    result = conn.execute(text("SELECT * FROM users WHERE id = :id"), {"id": user_id})
    # Connection automatically returned to pool on exit

# Async with asyncpg (FastAPI)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

async_engine = create_async_engine(
    "postgresql+asyncpg://user:pass@localhost/mydb",
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

AsyncSessionLocal = sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False
)

# FastAPI dependency
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session  # Connection returned to pool on exit
```

```go
// Go — pgx connection pool (recommended for PostgreSQL)
package main

import (
    "context"
    "time"
    "github.com/jackc/pgx/v5/pgxpool"
)

func NewPool(ctx context.Context) (*pgxpool.Pool, error) {
    config, err := pgxpool.ParseConfig(
        "postgres://user:pass@localhost:5432/mydb?sslmode=require",
    )
    if err != nil {
        return nil, err
    }

    // Pool sizing
    config.MaxConns = 20                          // Maximum connections
    config.MinConns = 5                           // Minimum idle connections
    config.MaxConnLifetime = 30 * time.Minute     // Max connection age
    config.MaxConnIdleTime = 5 * time.Minute      // Max idle time
    config.HealthCheckPeriod = 30 * time.Second   // Background health check interval

    // Connection validation
    config.ConnConfig.ConnectTimeout = 5 * time.Second

    pool, err := pgxpool.NewWithConfig(ctx, config)
    if err != nil {
        return nil, err
    }

    return pool, nil
}

// Usage — automatic checkout/return
func GetUser(ctx context.Context, pool *pgxpool.Pool, id string) (User, error) {
    var user User
    err := pool.QueryRow(ctx,
        "SELECT id, email, name FROM users WHERE id = $1", id,
    ).Scan(&user.ID, &user.Email, &user.Name)
    return user, err // connection returned automatically
}

// Transaction — explicit checkout
func Transfer(ctx context.Context, pool *pgxpool.Pool, from, to string, amount float64) error {
    tx, err := pool.Begin(ctx)
    if err != nil {
        return err
    }
    defer tx.Rollback(ctx) // no-op if committed

    _, err = tx.Exec(ctx,
        "UPDATE accounts SET balance = balance - $1 WHERE id = $2", amount, from)
    if err != nil {
        return err
    }
    _, err = tx.Exec(ctx,
        "UPDATE accounts SET balance = balance + $1 WHERE id = $2", amount, to)
    if err != nil {
        return err
    }

    return tx.Commit(ctx)
}

// Pool statistics
func LogPoolStats(pool *pgxpool.Pool) {
    stat := pool.Stat()
    log.Printf("Pool stats: total=%d idle=%d acquired=%d constructing=%d",
        stat.TotalConns(),
        stat.IdleConns(),
        stat.AcquiredConns(),
        stat.ConstructingConns(),
    )
}
```

### External Connection Poolers

```
PgBouncer (PostgreSQL):
┌─────────────────────────────────────────────────────────┐
│  3 Pooling Modes:                                        │
│                                                           │
│  1. SESSION Mode (default)                               │
│     Connection assigned for entire client session         │
│     Client disconnect → connection returns to pool       │
│     Compatible with all PostgreSQL features               │
│     Connection ratio: ~1:1 (minimal benefit)             │
│                                                           │
│  2. TRANSACTION Mode (recommended)                       │
│     Connection assigned per transaction only              │
│     Between transactions → connection returned           │
│     High multiplexing ratio (100:1 possible)             │
│     ⚠ No prepared statements, LISTEN/NOTIFY, temp tables│
│                                                           │
│  3. STATEMENT Mode (rare)                                │
│     Connection assigned per statement                     │
│     No multi-statement transactions                      │
│     Highest multiplexing but most restrictive            │
└─────────────────────────────────────────────────────────┘
```

```ini
; PgBouncer configuration — pgbouncer.ini
[databases]
mydb = host=127.0.0.1 port=5432 dbname=mydb

[pgbouncer]
; Listening
listen_addr = 0.0.0.0
listen_port = 6432

; Pool mode
pool_mode = transaction          ; transaction mode for high multiplexing

; Pool sizing
default_pool_size = 20           ; connections per user/database pair
min_pool_size = 5                ; minimum idle connections
reserve_pool_size = 5            ; extra connections for burst
reserve_pool_timeout = 3         ; seconds before using reserve pool
max_client_conn = 1000           ; max client connections to PgBouncer
max_db_connections = 50          ; max connections to actual database

; Timeouts
server_idle_timeout = 600        ; close idle server connections after 10m
client_idle_timeout = 0          ; no client timeout (app handles it)
client_login_timeout = 60        ; max time for client auth
query_timeout = 0                ; no query timeout (app handles it)
query_wait_timeout = 120         ; max time waiting for connection

; Connection validation
server_check_query = SELECT 1    ; health check query
server_check_delay = 30          ; seconds between health checks
server_lifetime = 3600           ; recycle connections after 1 hour
server_connect_timeout = 15      ; timeout for new backend connections

; Auth
auth_type = hba                  ; use pg_hba.conf style auth
auth_hba_file = /etc/pgbouncer/pg_hba.conf
auth_file = /etc/pgbouncer/userlist.txt

; Logging
log_connections = 0              ; reduce log noise in production
log_disconnections = 0
stats_period = 60                ; log stats every 60 seconds

; Admin
admin_users = pgbouncer_admin
stats_users = pgbouncer_stats
```

```ini
; ProxySQL configuration (MySQL)
; /etc/proxysql.cnf

datadir="/var/lib/proxysql"

admin_variables=
{
    admin_credentials="admin:admin"
    mysql_ifaces="0.0.0.0:6032"
}

mysql_variables=
{
    threads=4
    max_connections=2048
    default_query_delay=0
    default_query_timeout=36000000   ; 10 hours
    interfaces="0.0.0.0:6033"
    server_version="8.0.35"
    connect_timeout_server=3000
    monitor_username="monitor"
    monitor_password="monitor_pass"
    ping_interval_server_msec=10000
    ping_timeout_server=500
    connection_max_age_ms=0
}

mysql_servers =
(
    {
        address="primary.db.local"
        port=3306
        hostgroup=0            ; writer hostgroup
        max_connections=50
        weight=1
    },
    {
        address="replica1.db.local"
        port=3306
        hostgroup=1            ; reader hostgroup
        max_connections=100
        weight=1
    },
    {
        address="replica2.db.local"
        port=3306
        hostgroup=1            ; reader hostgroup
        max_connections=100
        weight=1
    }
)

mysql_query_rules =
(
    {
        rule_id=1
        match_pattern="^SELECT .* FOR UPDATE$"
        destination_hostgroup=0  ; route to writer
        apply=1
    },
    {
        rule_id=2
        match_pattern="^SELECT"
        destination_hostgroup=1  ; route to readers
        apply=1
    }
)
```

### Pool Sizing Formula

```
Optimal Pool Size Calculation:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  PostgreSQL Rule of Thumb:                                │
│                                                            │
│  pool_size = (cores * 2) + effective_spindle_count        │
│                                                            │
│  Where:                                                    │
│    cores = number of CPU cores on database server         │
│    effective_spindle_count = number of disks               │
│      (SSD counts as 1, HDD RAID counts per disk)         │
│                                                            │
│  Examples:                                                 │
│    4-core server with SSD: (4 * 2) + 1 = 9               │
│    8-core server with SSD: (8 * 2) + 1 = 17              │
│    16-core server with SSD: (16 * 2) + 1 = 33            │
│                                                            │
│  Key Insight:                                              │
│    A pool of 20 connections can serve 10,000 concurrent   │
│    users if average query time is 5ms and average user    │
│    makes 1 query per second:                              │
│    20 conns × (1000ms / 5ms) = 4,000 queries/second      │
│                                                            │
│  ⚠ MORE connections ≠ BETTER performance                 │
│    Beyond optimal: CPU contention, context switching,     │
│    lock contention → throughput DECREASES                 │
│                                                            │
│  Total connections across all app instances:              │
│    max_connections = pool_size × num_app_instances        │
│    Example: 20 × 10 instances = 200 connections           │
│    PostgreSQL default max_connections = 100               │
│    → MUST increase or use PgBouncer                      │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

```
Multi-Instance Pool Calculation:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  Scenario: 3 app instances, DB max_connections = 100     │
│                                                            │
│  Reserved for admin/monitoring: 10                        │
│  Available for application: 90                            │
│  Per-instance pool_size: 90 / 3 = 30                     │
│                                                            │
│  With PgBouncer (external pool):                          │
│    PgBouncer → DB: 50 connections                         │
│    App instances → PgBouncer: 300 connections each        │
│    PgBouncer multiplexes 900 → 50 (18:1 ratio)           │
│    DB sees only 50 connections regardless of app scale   │
│                                                            │
│  Rule: When scaling beyond 3 app instances,              │
│  ALWAYS use an external connection pooler                │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Connection Pool Monitoring

```typescript
// TypeScript — Pool health monitoring middleware
import { Pool } from 'pg';
import { Histogram, Gauge } from 'prom-client';

const poolSize = new Gauge({
  name: 'db_pool_size_total',
  help: 'Total connections in pool',
});
const poolIdle = new Gauge({
  name: 'db_pool_idle_total',
  help: 'Idle connections in pool',
});
const poolWaiting = new Gauge({
  name: 'db_pool_waiting_total',
  help: 'Requests waiting for connection',
});
const checkoutDuration = new Histogram({
  name: 'db_pool_checkout_duration_seconds',
  help: 'Time to checkout connection from pool',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

// Periodic stats collection
setInterval(() => {
  poolSize.set(pool.totalCount);
  poolIdle.set(pool.idleCount);
  poolWaiting.set(pool.waitingCount);
}, 5000);

// Checkout timing wrapper
async function queryWithMetrics<T>(
  pool: Pool,
  sql: string,
  params?: any[]
): Promise<T[]> {
  const checkoutStart = performance.now();
  const client = await pool.connect();
  const checkoutMs = (performance.now() - checkoutStart) / 1000;
  checkoutDuration.observe(checkoutMs);

  if (checkoutMs > 1) {
    console.warn(`Slow pool checkout: ${checkoutMs.toFixed(0)}ms — pool may be exhausted`);
  }

  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}
```

```sql
-- PostgreSQL: monitor active connections
SELECT
    datname AS database,
    usename AS username,
    state,
    COUNT(*) AS connections,
    COUNT(*) FILTER (WHERE state = 'active') AS active,
    COUNT(*) FILTER (WHERE state = 'idle') AS idle,
    COUNT(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_tx,
    COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL) AS waiting
FROM pg_stat_activity
WHERE backend_type = 'client backend'
GROUP BY datname, usename, state
ORDER BY connections DESC;

-- Check max connections vs current usage
SELECT
    setting::int AS max_connections,
    (SELECT COUNT(*) FROM pg_stat_activity) AS current_connections,
    setting::int - (SELECT COUNT(*) FROM pg_stat_activity) AS available;
FROM pg_settings WHERE name = 'max_connections';

-- Find long-running idle-in-transaction connections (pool leak indicator)
SELECT
    pid,
    usename,
    state,
    query,
    now() - state_change AS idle_duration
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND now() - state_change > interval '5 minutes'
ORDER BY idle_duration DESC;

-- Kill leaked connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND now() - state_change > interval '30 minutes';
```

### Connection Leak Prevention

```typescript
// TypeScript — Connection leak detection
class PoolWithLeakDetection {
  private pool: Pool;
  private activeConnections = new Map<string, { stack: string; time: number }>();
  private leakTimeoutMs = 30000; // 30 seconds

  constructor(config: PoolConfig) {
    this.pool = new Pool(config);
    this.startLeakDetector();
  }

  async connect(): Promise<PoolClient> {
    const client = await this.pool.connect();
    const id = crypto.randomUUID();
    const stack = new Error().stack || '';

    this.activeConnections.set(id, {
      stack,
      time: Date.now(),
    });

    const originalRelease = client.release.bind(client);
    client.release = () => {
      this.activeConnections.delete(id);
      return originalRelease();
    };

    return client;
  }

  private startLeakDetector(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [id, info] of this.activeConnections) {
        if (now - info.time > this.leakTimeoutMs) {
          console.error(
            `CONNECTION LEAK DETECTED! Checked out ${(now - info.time) / 1000}s ago`,
            `\nCheckout location:\n${info.stack}`
          );
        }
      }
    }, 10000);
  }
}
```

```go
// Go — Context-based connection timeout
func GetUserWithTimeout(ctx context.Context, pool *pgxpool.Pool, id string) (User, error) {
    // Context with timeout prevents connection hoarding
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()

    var user User
    err := pool.QueryRow(ctx,
        "SELECT id, email, name FROM users WHERE id = $1", id,
    ).Scan(&user.ID, &user.Email, &user.Name)

    if errors.Is(err, context.DeadlineExceeded) {
        return User{}, fmt.Errorf("query timed out — possible pool exhaustion")
    }
    return user, err
}
```

### Cloud-Native Connection Pooling

```
Kubernetes Connection Pooling Architecture:
┌────────────────────────────────────────────────────────┐
│  Kubernetes Cluster                                      │
│                                                           │
│  ┌─────────────────────┐  ┌─────────────────────┐      │
│  │  Pod 1               │  │  Pod 2               │      │
│  │  ┌─────┐ ┌────────┐ │  │  ┌─────┐ ┌────────┐ │      │
│  │  │ App │→│PgBouncer│ │  │  │ App │→│PgBouncer│ │      │
│  │  └─────┘ └───┬────┘ │  │  └─────┘ └───┬────┘ │      │
│  └──────────────┼──────┘  └──────────────┼──────┘      │
│                  │                         │              │
│  Option A: PgBouncer as sidecar (per-pod)               │
│  Option B: PgBouncer as separate deployment (shared)    │
│                  │                         │              │
│                  └────────┬───────────────┘              │
│                           ▼                               │
│              ┌─────────────────────┐                     │
│              │  PostgreSQL Primary  │                     │
│              │  max_connections=100 │                     │
│              └─────────────────────┘                     │
└────────────────────────────────────────────────────────┘
```

```yaml
# Kubernetes — PgBouncer sidecar deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  replicas: 5
  template:
    spec:
      containers:
        - name: api
          image: myapp/api:latest
          env:
            - name: DATABASE_URL
              value: "postgresql://user:pass@localhost:6432/mydb"  # → PgBouncer
          ports:
            - containerPort: 8080

        - name: pgbouncer
          image: bitnami/pgbouncer:latest
          ports:
            - containerPort: 6432
          env:
            - name: PGBOUNCER_DATABASE
              value: mydb
            - name: POSTGRESQL_HOST
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: host
            - name: PGBOUNCER_POOL_MODE
              value: transaction
            - name: PGBOUNCER_DEFAULT_POOL_SIZE
              value: "10"
            - name: PGBOUNCER_MAX_CLIENT_CONN
              value: "200"
            - name: PGBOUNCER_MAX_DB_CONNECTIONS
              value: "20"
          resources:
            requests:
              memory: "64Mi"
              cpu: "50m"
            limits:
              memory: "128Mi"
              cpu: "100m"
```

---

## Best Practices

1. **ALWAYS use connection pooling** in production — direct connections do not scale
2. **ALWAYS set pool size based on formula** — `(cores * 2) + spindles`, not arbitrary large numbers
3. **ALWAYS use external pooler** (PgBouncer/ProxySQL) when running 3+ app instances
4. **ALWAYS enable pool_pre_ping** (or equivalent) — detect stale connections before use
5. **ALWAYS set connection timeouts** — prevent indefinite waits for pool checkout
6. **ALWAYS release connections in finally blocks** — prevent connection leaks
7. **ALWAYS monitor pool metrics** — total, idle, waiting, checkout latency
8. **NEVER set pool size larger than database max_connections** — causes connection refused errors
9. **NEVER hold connections during non-database work** — checkout, use, release immediately
10. **NEVER use session pool mode** with PgBouncer in high-concurrency apps — use transaction mode

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No connection pooling | Connection refused under load | Add pool (built-in or PgBouncer) |
| Pool too large | CPU contention, slower throughput | Use sizing formula: (cores * 2) + 1 |
| Pool too small | Long queue wait times | Increase pool or add PgBouncer |
| Connection leak | Pool exhaustion over time | Always release in finally/defer |
| No checkout timeout | Requests hang forever | Set connectionTimeoutMillis |
| Idle-in-transaction | Connections blocked indefinitely | Set idle_in_transaction_session_timeout |
| No pool monitoring | Undetected exhaustion | Export pool metrics to Prometheus |
| Direct connections + many pods | Exceeds max_connections | Use PgBouncer between apps and DB |
| Session mode PgBouncer | Minimal multiplexing benefit | Use transaction mode |
| No connection validation | Errors on stale connections | Enable pool_pre_ping / health checks |
| Opening pool per request | Defeats purpose of pooling | Share single pool across app lifecycle |
| Not accounting for replicas | All load on primary | Route reads to replica pool |

---

## Enforcement Checklist

- [ ] Connection pooling enabled (built-in or external)
- [ ] Pool size calculated using formula, not arbitrary
- [ ] External pooler used when running multiple app instances
- [ ] Connection checkout timeout configured
- [ ] Connection leak detection in place
- [ ] Pool metrics exported and monitored
- [ ] idle_in_transaction_session_timeout set in PostgreSQL
- [ ] Connection validation enabled (pre_ping / health check)
- [ ] All connections released in finally/defer blocks
- [ ] PgBouncer in transaction mode for high-concurrency
- [ ] Total pool size across instances < database max_connections
- [ ] Cloud-native pooling pattern used in Kubernetes
