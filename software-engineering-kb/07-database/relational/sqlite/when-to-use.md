# SQLite: When to Use

> **Domain:** Database > Relational > SQLite
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

SQLite is either the perfect choice or a terrible one — there is no middle ground. Choosing SQLite for the wrong use case leads to write contention and data loss. Choosing PostgreSQL when SQLite would suffice adds infrastructure complexity, operational overhead, and latency. The decision depends on concurrency requirements, deployment model, and data access patterns. This guide provides a clear framework for making that decision.

---

## How It Works

### Decision Matrix

| Criterion | Use SQLite | Use PostgreSQL/MySQL |
|-----------|-----------|---------------------|
| **Deployment** | Single server, embedded, edge | Multi-server, microservices |
| **Write concurrency** | Low (< 100 writes/sec) | High (1000+ writes/sec) |
| **Read concurrency** | Any (unlimited readers in WAL) | Any |
| **Data size** | < 100 GB practical | Any size |
| **Network access** | Same machine only | Remote clients needed |
| **Replication** | Not built-in (Litestream/LiteFS) | Built-in, mature |
| **Team size** | 1-5 developers | Any |
| **Operational cost** | Zero (file on disk) | Database server + monitoring |
| **Backup** | Copy file or Litestream | pg_dump, PITR, streaming replica |
| **Advanced SQL** | Most SQL-92 | Full SQL standard + extensions |

### Decision Flowchart

```
Is the application embedded/mobile?
├── YES → SQLite ✓
└── NO
    │
    Is it a single-server web application?
    ├── NO → PostgreSQL ✓ (multi-server needs network DB)
    └── YES
        │
        Does it need > 100 concurrent writes/sec?
        ├── YES → PostgreSQL ✓
        └── NO
            │
            Does it need advanced features (RLS, JSONB ops, FTS ranking)?
            ├── YES → PostgreSQL ✓
            └── NO
                │
                Does it need replicas for read scaling?
                ├── YES → PostgreSQL ✓ (or Turso/LiteFS for edge)
                └── NO → SQLite ✓
```

---

### Ideal Use Cases for SQLite

#### 1. Mobile Applications

```
┌──────────────┐
│ Mobile App   │
│              │
│ ┌──────────┐ │    Sync    ┌─────────┐
│ │ SQLite   │─┼───────────►│ Backend │
│ │ (local)  │ │            │ Server  │
│ └──────────┘ │            └─────────┘
│              │
│ Offline-first│
│ Low latency  │
└──────────────┘
```
- Every iOS/Android app with local data
- Offline-first architecture
- Chat message storage (WhatsApp, Signal)
- Browser storage (Web SQL, IndexedDB backed by SQLite)

#### 2. Desktop Applications

- Configuration storage
- Application state/preferences
- Document databases (Adobe Lightroom catalog)
- Development tools (VS Code settings, Git internals)

#### 3. Edge Computing / CDN

```
┌─────────────────────────────────────────────────┐
│            Edge Locations (Fly.io, Cloudflare)   │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Edge    │  │  Edge    │  │  Edge    │      │
│  │ NYC     │  │ London  │  │ Tokyo   │      │
│  │ SQLite  │  │ SQLite  │  │ SQLite  │      │
│  │ replica │  │ replica │  │ replica │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       └──────────────┼──────────────┘             │
│                      │                             │
│              ┌───────▼───────┐                    │
│              │  Primary      │                    │
│              │  SQLite       │                    │
│              │  (writable)   │                    │
│              └───────────────┘                    │
└─────────────────────────────────────────────────┘

Reads: < 1 ms (local edge)
Writes: routed to primary
```

#### 4. Single-Server Web Applications

- Personal projects, internal tools, small SaaS
- Blog platforms, CMS systems
- API backends with moderate traffic
- Prototypes and MVPs

#### 5. Testing & Development

```go
// Go — use SQLite for tests, PostgreSQL for production
func NewTestDB(t *testing.T) *sql.DB {
    db, err := sql.Open("sqlite3", ":memory:")
    require.NoError(t, err)
    t.Cleanup(func() { db.Close() })

    // Run migrations
    migrate(db)
    return db
}
```

#### 6. Data Analysis & ETL

- Exploratory data analysis (DuckDB is better for OLAP, but SQLite works)
- Data pipeline intermediate storage
- Log analysis and aggregation
- Configuration file replacement (structured config in SQLite)

---

### When NOT to Use SQLite

#### 1. High Write Concurrency
SQLite allows only one writer at a time. Under heavy concurrent writes, transactions queue up and timeout.

```
PostgreSQL: 10 concurrent writers → all proceed in parallel
SQLite:     10 concurrent writers → 1 writes, 9 wait (SQLITE_BUSY)
```

**Threshold:** If your application regularly exceeds 100 writes/second from concurrent connections, use PostgreSQL.

#### 2. Multi-Server Deployments
SQLite is a file on disk. If your application runs on multiple servers, they cannot share one SQLite file (network filesystems like NFS are unreliable with SQLite).

```
BAD: Multiple servers sharing SQLite over NFS
┌────────┐    NFS    ┌──────────┐
│Server A│───────────│ SQLite   │  ← Corruption risk!
│Server B│───────────│ on NFS   │
└────────┘           └──────────┘

OK: Each server has its own SQLite (no shared state)
OK: Use Turso/LiteFS for distributed SQLite
OK: Use PostgreSQL for shared state
```

#### 3. Complex Access Control
SQLite has no built-in user authentication, roles, or row-level security. All access control must be in application code.

#### 4. Large Write-Heavy Datasets
While SQLite can handle 100+ GB databases, write-heavy workloads on large datasets benefit from PostgreSQL's parallel write capabilities, partial indexes, and advanced optimizer.

---

### Modern SQLite Production Stack

```
┌──────────────────────────────────────────────────────┐
│              Modern SQLite Stack                      │
│                                                       │
│  Application                                          │
│  ├── better-sqlite3 (Node.js) or                     │
│  │   go-sqlite3 / modernc-sqlite (Go) or             │
│  │   sqlite3 (Python)                                │
│  │                                                    │
│  SQLite Engine                                        │
│  ├── WAL mode enabled                                │
│  ├── STRICT tables                                   │
│  ├── Foreign keys ON                                 │
│  │                                                    │
│  Backup & Replication                                │
│  ├── Litestream → S3 (continuous backup)             │
│  └── LiteFS (distributed read replicas)              │
│                                                       │
│  Monitoring                                           │
│  ├── PRAGMA integrity_check                          │
│  ├── PRAGMA wal_checkpoint                           │
│  └── File size monitoring                            │
│                                                       │
│  Migration                                            │
│  ├── golang-migrate / dbmate / Atlas                 │
│  └── .sql migration files                            │
└──────────────────────────────────────────────────────┘
```

---

### SQLite vs Alternatives Comparison

| Feature | SQLite | PostgreSQL | MySQL | DuckDB |
|---------|--------|------------|-------|--------|
| **Primary use** | Embedded/edge | General OLTP | General OLTP | Analytics/OLAP |
| **Deployment** | Library | Server | Server | Library |
| **Concurrency** | 1 writer | Many writers | Many writers | 1 writer |
| **Best for reads** | Excellent | Excellent | Excellent | Excellent (columnar) |
| **Best for writes** | Low concurrency | High concurrency | High concurrency | Batch only |
| **JSON support** | json_extract() | JSONB (rich) | JSON (functional) | JSON |
| **Full-text search** | FTS5 module | tsvector (rich) | FULLTEXT | Limited |
| **Geospatial** | SpatiaLite | PostGIS | Spatial | Limited |
| **Vector search** | sqlite-vss | pgvector | No | No |
| **Ops overhead** | Zero | Medium | Medium | Zero |
| **Cloud managed** | Turso | RDS, Supabase | RDS, PlanetScale | MotherDuck |

---

## Best Practices

1. **ALWAYS evaluate SQLite first** for single-server applications — simplest wins
2. **ALWAYS use WAL mode + busy_timeout** when choosing SQLite — prevents blocking
3. **ALWAYS use Litestream** for production SQLite backup — continuous S3 replication
4. **ALWAYS use STRICT tables** — eliminate SQLite's dynamic typing surprise
5. **ALWAYS benchmark write concurrency** before choosing SQLite — test with realistic load
6. **ALWAYS have a PostgreSQL migration path** — design your schema to be portable
7. **NEVER use SQLite over network filesystems (NFS, SMB)** — causes corruption
8. **NEVER ignore the single-writer limitation** — queue writes or use connection serialization
9. **NEVER use SQLite for multi-server stateful applications** — unless using Turso/LiteFS
10. **NEVER choose PostgreSQL just because it is "more serious"** — SQLite is production-ready for the right use case

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| SQLite for high write concurrency | SQLITE_BUSY errors, timeouts | Use PostgreSQL for > 100 writes/sec |
| SQLite over NFS | Database corruption, lock errors | Local filesystem only |
| Choosing PostgreSQL for small single-server app | Unnecessary operational complexity | Evaluate SQLite first |
| No WAL mode | Readers blocked during writes | PRAGMA journal_mode = WAL |
| No backup strategy | Single point of failure | Litestream to S3 |
| Assuming dynamic typing is fine | '42' stored as TEXT in INTEGER column | Use STRICT tables |
| Multiple write connections | Lock contention, busy errors | Single writer + connection pool |
| Using SQLite for microservices | Each service needs its own DB | Use PostgreSQL for shared state |
| Ignoring foreign_keys = OFF default | Orphaned records | PRAGMA foreign_keys = ON |
| Not testing write throughput | Discover limitations in production | Benchmark before deploying |

---

## Real-world Examples

### Fly.io
- LiteFS for distributed SQLite across edge servers
- SQLite as primary database for applications deployed on Fly
- Demonstrated SQLite handling production web application workloads

### Turso (LibSQL)
- Fork of SQLite with built-in replication and edge distribution
- Embedded replicas: SQLite file synced to every application instance
- Used by production applications for low-latency edge reads

### Expensify
- SQLite as primary database for web application
- Millions of users, billions of transactions
- Single-server architecture with SQLite

### Tailscale
- SQLite for coordination server state
- Embedded database eliminates infrastructure dependencies
- WAL mode for concurrent access

### Signal
- SQLite with SQLCipher (encryption) for local message storage
- Every Signal client has its own encrypted SQLite database
- Most security-sensitive use of SQLite at scale

---

## Enforcement Checklist

- [ ] Write concurrency requirements evaluated (< 100 writes/sec for SQLite)
- [ ] Deployment model confirmed (single server for SQLite)
- [ ] WAL mode enabled if SQLite chosen
- [ ] Litestream or equivalent backup configured for production SQLite
- [ ] STRICT tables used for type safety
- [ ] PostgreSQL migration path considered in schema design
- [ ] Network filesystem usage prohibited for SQLite
- [ ] Write connection serialization configured
- [ ] Foreign keys enabled per connection
- [ ] Load testing performed with realistic concurrency
