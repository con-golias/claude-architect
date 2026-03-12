# Read Replicas & Load Distribution

> **Domain:** Database > Scaling > Read Replicas & Load Distribution
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Most database workloads are read-heavy — 80-95% of operations are SELECT queries. Read replicas allow distributing this read load across multiple servers while the primary handles writes. Combined with connection pooling and caching, read replicas can scale a database from handling 1,000 to 100,000+ queries per second without sharding complexity. This is the most cost-effective and operationally simple scaling strategy, and should be exhausted before considering sharding or distributed databases.

---

## How It Works

### Read Replica Architecture

```
Read Replica Scaling:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Application Layer                                     │
│  ┌─────────────────────────────────┐                  │
│  │ Read/Write Splitting Logic      │                  │
│  │                                  │                  │
│  │ INSERT/UPDATE/DELETE → Primary   │                  │
│  │ SELECT → Replica (round-robin)  │                  │
│  └─────────┬───────────────┬───────┘                  │
│            │               │                           │
│     Writes │        Reads  │                           │
│            ▼               ▼                           │
│  ┌──────────────┐  ┌──────────────┐                   │
│  │   Primary    │  │ Load Balancer│                   │
│  │  (read/write)│  │ (HAProxy,   │                   │
│  │              │  │  pgpool)    │                   │
│  └──────┬───────┘  └──────┬──────┘                   │
│         │                  │                           │
│    repl │     ┌────────────┼────────────┐              │
│         │     │            │            │              │
│         ▼     ▼            ▼            ▼              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │Replica 1 │ │Replica 2 │ │Replica 3 │              │
│  │(read-only)│ │(read-only)│ │(read-only)│             │
│  └──────────┘ └──────────┘ └──────────┘              │
│                                                        │
│  Scaling: add more replicas for more read throughput  │
│  Each replica can serve 2,000-10,000+ QPS             │
│  3 replicas = 3x read capacity                        │
└──────────────────────────────────────────────────────┘
```

### Read/Write Splitting

```go
// Go — Read/Write splitting with multiple replicas
type DBRouter struct {
    primary  *sql.DB
    replicas []*sql.DB
    counter  atomic.Uint64
}

func NewDBRouter(primaryDSN string, replicaDSNs []string) (*DBRouter, error) {
    primary, err := sql.Open("postgres", primaryDSN)
    if err != nil {
        return nil, err
    }

    var replicas []*sql.DB
    for _, dsn := range replicaDSNs {
        replica, err := sql.Open("postgres", dsn)
        if err != nil {
            return nil, err
        }
        replicas = append(replicas, replica)
    }

    return &DBRouter{primary: primary, replicas: replicas}, nil
}

// Write operations always go to primary
func (r *DBRouter) Primary() *sql.DB {
    return r.primary
}

// Read operations round-robin across replicas
func (r *DBRouter) Replica() *sql.DB {
    if len(r.replicas) == 0 {
        return r.primary // fallback
    }
    idx := r.counter.Add(1) % uint64(len(r.replicas))
    return r.replicas[idx]
}

// Usage
func GetUserOrders(ctx context.Context, db *DBRouter, userID string) ([]Order, error) {
    rows, err := db.Replica().QueryContext(ctx,
        "SELECT id, total, status FROM orders WHERE user_id = $1", userID)
    // ...
}

func CreateOrder(ctx context.Context, db *DBRouter, order Order) error {
    _, err := db.Primary().ExecContext(ctx,
        "INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3)",
        order.UserID, order.Total, order.Status)
    return err
}
```

```python
# Python — SQLAlchemy read/write splitting
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from contextlib import contextmanager

class ReadWriteRouter:
    def __init__(self, primary_url: str, replica_urls: list[str]):
        self.primary = create_engine(primary_url, pool_size=20)
        self.replicas = [
            create_engine(url, pool_size=20)
            for url in replica_urls
        ]
        self._counter = 0

    @contextmanager
    def write_session(self):
        with Session(self.primary) as session:
            yield session

    @contextmanager
    def read_session(self):
        engine = self.replicas[self._counter % len(self.replicas)]
        self._counter += 1
        with Session(engine) as session:
            yield session

# Usage
router = ReadWriteRouter(
    primary_url="postgresql://primary:5432/db",
    replica_urls=[
        "postgresql://replica1:5432/db",
        "postgresql://replica2:5432/db",
    ],
)

# Read from replica
with router.read_session() as session:
    orders = session.query(Order).filter_by(user_id=user_id).all()

# Write to primary
with router.write_session() as session:
    session.add(Order(user_id=user_id, total=99.99))
    session.commit()
```

---

### Connection Pooling

```
Connection Pooling Architecture:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Without Pooling:                                     │
│  500 app workers → 500 DB connections → OOM           │
│  Each connection: 5-10 MB memory on database server  │
│  Most connections idle 95% of the time               │
│                                                        │
│  With Pooling (PgBouncer):                            │
│  500 app workers → PgBouncer → 50 DB connections     │
│  10x connection reduction                             │
│  Connections reused across requests                   │
│                                                        │
│  ┌──────────────┐     ┌──────────┐    ┌─────────┐   │
│  │ 500 App      │     │PgBouncer │    │ PG      │   │
│  │ Workers      │────►│ 50 pool  │───►│ 50 conns│   │
│  │ (short-lived │     │ conns    │    │ (real)  │   │
│  │  connections)│     │          │    │         │   │
│  └──────────────┘     └──────────┘    └─────────┘   │
│                                                        │
│  Pool Modes (PgBouncer):                              │
│  • session: conn held for entire client session       │
│    (least multiplexing, most compatible)               │
│  • transaction: conn returned after COMMIT            │
│    (best multiplexing, most common)                   │
│  • statement: conn returned after each query          │
│    (most multiplexing, limited — no multi-statement)  │
└──────────────────────────────────────────────────────┘
```

```ini
; PgBouncer configuration (pgbouncer.ini)
[databases]
mydb = host=primary port=5432 dbname=mydb
mydb_replica = host=replica1 port=5432 dbname=mydb

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0

; Pool mode
pool_mode = transaction

; Pool sizes
default_pool_size = 25        ; connections per user/database pair
max_client_conn = 1000        ; max client connections to PgBouncer
min_pool_size = 5             ; keep minimum connections warm
reserve_pool_size = 5         ; emergency connections

; Timeouts
server_idle_timeout = 600     ; close idle server connections (seconds)
client_idle_timeout = 0       ; 0 = never close idle clients
query_timeout = 30            ; kill queries longer than 30s

; Authentication
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
```

---

### Caching Layer Integration

```
Multi-Layer Caching with Read Replicas:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Request Flow:                                         │
│  1. Check application cache (in-memory, <1ms)         │
│  2. Check Redis cache (<5ms)                           │
│  3. Query read replica (<20ms)                        │
│  4. Fall back to primary (if replica unavailable)     │
│                                                        │
│  ┌──────┐  miss  ┌───────┐  miss  ┌────────┐  miss  │
│  │L1    │──────►│ Redis │──────►│Replica │──────►│  │
│  │Cache │       │ Cache │       │ (read) │      │PG│  │
│  │(local)│◄─────│       │◄─────│        │◄─────│  │  │
│  └──────┘  fill  └───────┘  fill └────────┘  fill │  │
│                                                   │  │
│  Cache invalidation:                              │PRI│
│  • Write to primary → invalidate Redis cache     │  │
│  • Or: set TTL and accept slight staleness       └──┘  │
│  • Or: CDC (listen to WAL) for real-time invalidation │
└──────────────────────────────────────────────────────┘
```

```typescript
// TypeScript — Multi-layer read with cache
class CachedDBReader {
  constructor(
    private redis: Redis,
    private replica: Pool,
    private primary: Pool,
    private cacheTTL = 300 // 5 minutes
  ) {}

  async getUser(userId: string): Promise<User | null> {
    // Layer 1: Redis cache
    const cached = await this.redis.get(`user:${userId}`);
    if (cached) return JSON.parse(cached);

    // Layer 2: Read replica
    const result = await this.replica.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      // Populate cache
      await this.redis.setex(
        `user:${userId}`,
        this.cacheTTL,
        JSON.stringify(user)
      );
      return user;
    }

    return null;
  }

  async updateUser(userId: string, data: Partial<User>): Promise<void> {
    // Write to primary
    await this.primary.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3',
      [data.name, data.email, userId]
    );

    // Invalidate cache
    await this.redis.del(`user:${userId}`);
  }
}
```

---

### Managed Read Replicas

| Provider | Service | Max Replicas | Lag | Cross-Region |
|----------|---------|-------------|-----|--------------|
| **AWS RDS** | Read Replica | 15 | <1s | Yes |
| **AWS Aurora** | Aurora Replica | 15 | <100ms | Yes (Global DB) |
| **GCP Cloud SQL** | Read Replica | 10 | <1s | Yes |
| **GCP AlloyDB** | Read Pool | 20 | <10ms | Yes |
| **Azure** | Read Replica | 5 | <1s | Yes (Hyperscale) |
| **Supabase** | Read Replica | varies | <1s | No |
| **Neon** | Read Replica | varies | <100ms | Yes |

---

### Scaling Strategy Ladder

```
Progressive Scaling (follow this order):
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Stage 1: Single Server (1,000-5,000 QPS)             │
│  ┌──────────────┐                                     │
│  │ PostgreSQL   │ + proper indexes                    │
│  │ (single node)│ + query optimization                │
│  └──────────────┘ + connection pooling (PgBouncer)    │
│                                                        │
│  Stage 2: Read Replicas (5,000-50,000 QPS)            │
│  ┌──────────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Primary     │  │ Replica  │  │ Replica  │       │
│  │  (writes)    │  │ (reads)  │  │ (reads)  │       │
│  └──────────────┘  └──────────┘  └──────────┘       │
│  + Read/write splitting                               │
│  + Application caching (Redis)                        │
│                                                        │
│  Stage 3: Vertical Scaling (50,000-100,000+ QPS)      │
│  Bigger servers (more CPU, RAM, NVMe)                 │
│  + More read replicas (up to 15)                      │
│  + Table partitioning                                 │
│                                                        │
│  Stage 4: Sharding / Distributed SQL (100,000+ QPS)   │
│  Citus, Vitess, CockroachDB, TiDB                    │
│  ONLY when stages 1-3 exhausted                       │
└──────────────────────────────────────────────────────┘
```

---

## Best Practices

1. **ALWAYS add read replicas before considering sharding** — 10x capacity with minimal complexity
2. **ALWAYS use connection pooling** (PgBouncer/ProxySQL) — reduce connection overhead 10x
3. **ALWAYS implement read/write splitting** at application level — framework-agnostic, explicit
4. **ALWAYS combine replicas with caching** — Redis for hot data, replicas for cold queries
5. **ALWAYS monitor replica lag** — route critical reads to primary if lag exceeds threshold
6. **ALWAYS use transaction pool mode** in PgBouncer — best multiplexing ratio
7. **NEVER send writes to replicas** — replicas are read-only
8. **NEVER read from replica immediately after write** — use primary for read-after-write
9. **NEVER skip connection pooling** — direct connections waste memory
10. **NEVER scale replicas beyond 15** without evaluating architecture — replication overhead grows

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No read replicas | Primary overloaded with reads | Add 1-3 read replicas |
| No connection pooling | 1000+ connections, memory waste | Deploy PgBouncer/ProxySQL |
| Session pool mode | Poor multiplexing | Use transaction pool mode |
| Reading from replica after write | User sees stale data | Route read-after-write to primary |
| All reads to primary | Replicas idle, primary overloaded | Implement read/write splitting |
| No caching layer | Every request hits database | Add Redis cache for hot data |
| No replica lag monitoring | Serving severely stale data | Monitor and alert on lag |
| Skipping to sharding | Unnecessary complexity | Exhaust replicas + cache first |
| Static connection pool size | Under-utilized or exhausted | Tune pool size for workload |

---

## Real-world Examples

### Shopify
- Read replicas for 80% of database queries
- ProxySQL for read/write splitting
- Redis caching for product catalog

### GitHub
- Read replicas for code search and browsing
- Connection multiplexing for thousands of workers
- Multi-tier caching (memcached + Redis)

### Basecamp (Hey.com)
- PgBouncer for PostgreSQL connection pooling
- Read replicas for read-heavy email workloads
- Explicit read/write splitting in Rails

---

## Enforcement Checklist

- [ ] Read replicas deployed for production (at least 1)
- [ ] Connection pooling configured (PgBouncer/ProxySQL)
- [ ] Read/write splitting implemented in application
- [ ] Read-after-write consistency handled
- [ ] Replica lag monitored with alerting
- [ ] Caching layer integrated (Redis for hot data)
- [ ] Pool mode set to transaction (not session)
- [ ] Pool sizes tuned for workload
- [ ] Failover to primary configured if all replicas fail
- [ ] Scaling ladder documented (when to add replicas vs shard)
