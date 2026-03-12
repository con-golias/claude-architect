# SQLite Overview & Architecture

> **Domain:** Database > Relational > SQLite
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

SQLite is the most deployed database engine in the world — it runs on every smartphone, every browser, every Mac, and every Windows machine. Unlike client-server databases (PostgreSQL, MySQL), SQLite is an embedded database — a single file, no daemon, no configuration, zero administration. It handles millions of read operations per second on modern hardware. With WAL mode and recent improvements, SQLite now handles concurrent read/write workloads that previously required a full database server. Tools like Litestream (streaming replication), LiteFS (distributed SQLite), and Turso (edge SQLite) have transformed SQLite from "embedded only" to a legitimate production backend database for certain architectures.

---

## How It Works

### Architecture

```
┌──────────────────────────────────────────────────┐
│                Application Process                │
│                                                   │
│  ┌─────────────┐     ┌─────────────────────┐    │
│  │ Application │     │   SQLite Library     │    │
│  │ Code        │────►│                      │    │
│  │ (Go/TS/Py)  │     │ ┌─────────────────┐ │    │
│  └─────────────┘     │ │ SQL Compiler    │ │    │
│                       │ │ (Parser, Planner│ │    │
│                       │ │  Code Generator)│ │    │
│                       │ └────────┬────────┘ │    │
│                       │          │           │    │
│                       │ ┌────────▼────────┐ │    │
│                       │ │ Virtual Machine │ │    │
│                       │ │ (VDBE)          │ │    │
│                       │ └────────┬────────┘ │    │
│                       │          │           │    │
│                       │ ┌────────▼────────┐ │    │
│                       │ │ B-Tree Module   │ │    │
│                       │ │ (Page cache)    │ │    │
│                       │ └────────┬────────┘ │    │
│                       │          │           │    │
│                       │ ┌────────▼────────┐ │    │
│                       │ │ Pager / OS      │ │    │
│                       │ │ Interface       │ │    │
│                       │ └────────┬────────┘ │    │
│                       └──────────┼──────────┘    │
│                                  │                │
└──────────────────────────────────┼────────────────┘
                                   │
                          ┌────────▼────────┐
                          │  Single File    │
                          │  database.db    │
                          │  (+ WAL file)   │
                          └─────────────────┘

No separate server process
No network protocol
No configuration
Single file = entire database
```

### Key Characteristics

| Feature | SQLite | PostgreSQL / MySQL |
|---------|--------|-------------------|
| **Deployment** | Embedded library | Client-server daemon |
| **Configuration** | Zero (PRAGMA commands) | postgresql.conf / my.cnf |
| **Concurrency** | Single writer, multiple readers (WAL mode) | Multiple writers, multiple readers |
| **File format** | Single file (.db + .db-wal + .db-shm) | Directory with many files |
| **Max DB size** | 281 TB (theoretical), practical ~1 TB | Unlimited (practical) |
| **Max row size** | 1 GB (default 1 MB) | Unlimited (TOAST in PG) |
| **Type system** | Dynamic (flexible affinity) | Static (strict types) |
| **Full SQL** | Most of SQL-92 | Full SQL standard |
| **Transactions** | ACID with WAL or journal | ACID with WAL |
| **Network access** | Not built-in | Built-in |
| **Backup** | Copy file (or .backup API) | pg_dump, pg_basebackup |

---

### WAL Mode (Write-Ahead Logging)

```sql
-- Enable WAL mode (do this once, persists across connections)
PRAGMA journal_mode = WAL;

-- Default is DELETE mode (rollback journal)
-- DELETE mode: one writer blocks all readers
-- WAL mode: one writer + multiple concurrent readers
```

```
DELETE mode (default):              WAL mode:
┌────────┐    ┌────────┐          ┌────────┐    ┌────────┐
│ Writer │    │ Reader │          │ Writer │    │ Reader │
│ BLOCKS │──X─│ WAITS  │          │ WRITES │    │ READS  │
└────────┘    └────────┘          │ to WAL │    │from DB │
                                  └────────┘    └────────┘
One at a time                     Concurrent!
```

```sql
-- WAL mode configuration
PRAGMA journal_mode = WAL;        -- enable WAL
PRAGMA wal_autocheckpoint = 1000; -- checkpoint after 1000 pages (default)
PRAGMA wal_checkpoint(TRUNCATE);  -- manual checkpoint + truncate WAL file

-- Busy timeout (wait for lock instead of failing immediately)
PRAGMA busy_timeout = 5000;       -- wait up to 5 seconds for write lock
```

---

### Essential PRAGMAs

```sql
-- Performance PRAGMAs (set on every connection)
PRAGMA journal_mode = WAL;         -- concurrent reads during writes
PRAGMA busy_timeout = 5000;        -- 5s wait for write lock
PRAGMA synchronous = NORMAL;       -- safe with WAL mode (FULL is default)
PRAGMA cache_size = -64000;        -- 64 MB page cache (negative = KB)
PRAGMA foreign_keys = ON;          -- enforce FK constraints (OFF by default!)
PRAGMA temp_store = MEMORY;        -- temp tables in memory
PRAGMA mmap_io = 268435456;        -- memory-map 256 MB of database file

-- STRICT mode (SQLite 3.37+, 2021)
CREATE TABLE users (
    id    INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    age   INTEGER NOT NULL
) STRICT;
-- Enforces type checking (rejects '42' into INTEGER column)
-- Without STRICT: any value can go into any column

-- Check current settings
PRAGMA journal_mode;
PRAGMA foreign_keys;
PRAGMA synchronous;
```

**Important:** `PRAGMA foreign_keys = ON` must be set PER CONNECTION. SQLite does NOT enforce foreign keys by default.

---

### Connection & Concurrency Patterns

```go
// Go — production SQLite configuration
func OpenSQLite(path string) (*sql.DB, error) {
    db, err := sql.Open("sqlite3", path+"?_journal_mode=WAL&_busy_timeout=5000&_foreign_keys=ON&_synchronous=NORMAL")
    if err != nil {
        return nil, err
    }

    // Single writer connection (prevent SQLITE_BUSY)
    db.SetMaxOpenConns(1)  // for write-heavy
    // OR for read-heavy:
    // db.SetMaxOpenConns(10)  // readers can parallelize

    // PRAGMAs
    db.Exec("PRAGMA cache_size = -64000")      // 64 MB cache
    db.Exec("PRAGMA temp_store = MEMORY")
    db.Exec("PRAGMA mmap_size = 268435456")    // 256 MB mmap

    return db, nil
}
```

```typescript
// TypeScript — better-sqlite3 (synchronous, fastest Node.js driver)
import Database from 'better-sqlite3';

const db = new Database('app.db');

// Set PRAGMAs
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000');
db.pragma('foreign_keys = ON');
db.pragma('temp_store = MEMORY');

// Transactions (20-50x faster than individual statements)
const insertMany = db.transaction((users: Array<{name: string, email: string}>) => {
  const insert = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
  for (const user of users) {
    insert.run(user.name, user.email);
  }
});

insertMany(users);  // All inserts in single transaction
```

```python
# Python — sqlite3 standard library
import sqlite3

conn = sqlite3.connect('app.db')
conn.execute("PRAGMA journal_mode = WAL")
conn.execute("PRAGMA busy_timeout = 5000")
conn.execute("PRAGMA synchronous = NORMAL")
conn.execute("PRAGMA cache_size = -64000")
conn.execute("PRAGMA foreign_keys = ON")

# Use context manager for transactions
with conn:
    conn.execute("INSERT INTO users (name, email) VALUES (?, ?)",
                 ('Alice', 'alice@example.com'))
# Auto-commits on exit, auto-rolls-back on exception
```

---

### Batch Performance

```sql
-- Individual INSERTs: ~50 inserts/sec (disk sync per statement)
-- Batched in transaction: ~100,000+ inserts/sec

-- Always batch writes in transactions:
BEGIN TRANSACTION;
INSERT INTO events (type, data) VALUES ('click', '{"page": "/home"}');
INSERT INTO events (type, data) VALUES ('click', '{"page": "/about"}');
-- ... thousands more ...
COMMIT;
```

---

### Backup Strategies

```sql
-- Online backup API (safe, consistent snapshot)
-- sqlite3 CLI:
.backup main backup.db

-- Programmatic backup (copies while database is in use)
-- Go: db.Backup()
-- Python: conn.backup(dest_conn)
```

```
Litestream (continuous replication to S3):
┌──────────┐    WAL stream    ┌──────────┐    S3 upload    ┌──────┐
│ SQLite   │─────────────────►│Litestream│────────────────►│  S3  │
│ app.db   │                  │ (daemon) │                  │bucket│
└──────────┘                  └──────────┘                  └──────┘

Recovery:
litestream restore -o app.db s3://bucket/db
Point-in-time recovery with WAL segments
```

---

### SQLite Limitations

| Limitation | Impact | Workaround |
|-----------|--------|------------|
| Single writer at a time | Write contention under load | Queue writes, use WAL mode |
| No built-in network access | Cannot query remotely | Use Turso, LiteFS, or HTTP wrapper |
| No built-in replication | No read replicas | Litestream to S3, LiteFS |
| Dynamic typing (by default) | Any type in any column | Use STRICT tables (3.37+) |
| Limited ALTER TABLE | Cannot drop/rename columns (< 3.35) | Recreate table or use 3.35+ |
| No stored procedures | Complex logic in SQL limited | Handle in application code |
| No LISTEN/NOTIFY | No real-time notifications | Poll or file watchers |
| Foreign keys OFF by default | Orphaned records silently created | PRAGMA foreign_keys = ON per connection |
| No parallel writes | Cannot scale write throughput | Accept limitation or use PostgreSQL |

---

## Best Practices

1. **ALWAYS enable WAL mode** — concurrent reads during writes, better performance
2. **ALWAYS set PRAGMA foreign_keys = ON** per connection — OFF by default is a trap
3. **ALWAYS set PRAGMA busy_timeout** — prevent immediate SQLITE_BUSY errors
4. **ALWAYS batch writes in transactions** — 100,000x performance difference
5. **ALWAYS use STRICT tables** (SQLite 3.37+) — prevent type confusion
6. **ALWAYS set PRAGMA synchronous = NORMAL** with WAL — safe and faster than FULL
7. **ALWAYS use parameterized queries** — prevent SQL injection (same as any database)
8. **ALWAYS use Litestream** for production backups — continuous replication to S3
9. **NEVER open multiple write connections** — SQLite supports one writer at a time
10. **NEVER use SQLite for high-concurrency write workloads** — use PostgreSQL instead

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| DELETE journal mode (default) | Readers blocked during writes | PRAGMA journal_mode = WAL |
| Foreign keys OFF | Orphaned records, no referential integrity | PRAGMA foreign_keys = ON per connection |
| No busy_timeout | SQLITE_BUSY errors under concurrency | PRAGMA busy_timeout = 5000 |
| Individual INSERTs without transaction | 50 inserts/sec instead of 100K | Wrap in BEGIN/COMMIT |
| Dynamic typing without STRICT | String '42' stored in INTEGER column | Use STRICT tables |
| Multiple write connections | SQLITE_BUSY, lock contention | Single writer connection |
| No backup strategy | Data loss risk | Use Litestream or periodic .backup |
| Using SQLite for high write concurrency | Lock contention, timeouts | Use PostgreSQL or MySQL |
| synchronous = OFF | Data corruption on power loss | Use NORMAL (safe with WAL) |
| Not setting cache_size | Default 2 MB cache, excessive disk reads | Set -64000 (64 MB) or more |

---

## Real-world Examples

### Apple
- SQLite on every iPhone, iPad, Mac (Core Data backend)
- iMessage, Photos, Safari history all use SQLite
- Billions of SQLite databases across Apple devices

### WhatsApp
- SQLite for local message storage on mobile devices
- Chat history, media metadata stored in SQLite
- Synced with server-side database for backup/restore

### Signal
- SQLite with encryption (SQLCipher) for secure message storage
- All message history stored locally in encrypted SQLite database

### Fly.io / Turso
- LiteFS: distributed SQLite with primary-replica topology
- Turso: edge SQLite service (libSQL fork) with embedded replicas
- SQLite at the edge for low-latency reads worldwide

### Expensify
- SQLite as primary database for web application
- Handles millions of transactions with single-server architecture
- Demonstrates SQLite can power production web applications

---

## Enforcement Checklist

- [ ] WAL mode enabled (PRAGMA journal_mode = WAL)
- [ ] Foreign keys enforced (PRAGMA foreign_keys = ON per connection)
- [ ] Busy timeout set (PRAGMA busy_timeout = 5000)
- [ ] Synchronous set to NORMAL (with WAL mode)
- [ ] Cache size increased from default (PRAGMA cache_size = -64000)
- [ ] STRICT tables used for type safety (SQLite 3.37+)
- [ ] All writes wrapped in transactions
- [ ] Single writer connection configured
- [ ] Backup strategy in place (Litestream or periodic backup)
- [ ] Parameterized queries used (no string concatenation)
