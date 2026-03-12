# PostgreSQL Advanced Features

> **Domain:** Database > Relational > PostgreSQL
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

PostgreSQL is not just a relational database — it is an extensible data platform. Features like LISTEN/NOTIFY replace message queues for simple pub/sub. Row-Level Security eliminates application-level tenant filtering. PostGIS turns PostgreSQL into a geospatial engine. pgvector enables AI-powered semantic search without a separate vector database. Table inheritance, custom types, and foreign data wrappers extend PostgreSQL beyond what any other open-source database offers. These features reduce infrastructure complexity by consolidating multiple specialized systems into one.

---

## How It Works

### LISTEN/NOTIFY — Real-Time Event System

PostgreSQL has built-in pub/sub messaging — no Redis or Kafka needed for simple cases.

```sql
-- Session 1: Listen for events
LISTEN order_updates;

-- Session 2: Send notification
NOTIFY order_updates, '{"order_id": 42, "status": "shipped"}';

-- Or using pg_notify() function (dynamic channel names)
SELECT pg_notify('order_updates', json_build_object(
    'order_id', 42,
    'status', 'shipped',
    'updated_at', NOW()
)::text);
```

```go
// Go — listen for PostgreSQL notifications
func ListenForOrders(ctx context.Context, connString string) error {
    conn, err := pgx.Connect(ctx, connString)
    if err != nil {
        return err
    }
    defer conn.Close(ctx)

    _, err = conn.Exec(ctx, "LISTEN order_updates")
    if err != nil {
        return err
    }

    for {
        notification, err := conn.WaitForNotification(ctx)
        if err != nil {
            return err
        }

        var payload struct {
            OrderID int    `json:"order_id"`
            Status  string `json:"status"`
        }
        json.Unmarshal([]byte(notification.Payload), &payload)

        log.Printf("Order %d → %s", payload.OrderID, payload.Status)
    }
}
```

```typescript
// TypeScript — pg LISTEN/NOTIFY
import { Client } from 'pg';

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

client.on('notification', (msg) => {
  const payload = JSON.parse(msg.payload || '{}');
  console.log(`Channel: ${msg.channel}, Order: ${payload.order_id}`);
});

await client.query('LISTEN order_updates');
```

**LISTEN/NOTIFY characteristics:**
- Payload limit: 8000 bytes per message
- Messages lost if no listener is connected (no persistence)
- All listeners on same channel receive the message (fan-out)
- Works across connections within the same PostgreSQL cluster
- Notifications delivered at COMMIT (not during transaction)

**When to use:** Cache invalidation, real-time dashboards, microservice coordination. When NOT to use: message durability required, high throughput (>1000 msg/sec), cross-database messaging.

---

### Row-Level Security (RLS)

Database-enforced access control — queries automatically filtered by policy.

```sql
-- Enable RLS on table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owner
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

-- Policy: users see only their own documents
CREATE POLICY user_documents ON documents
    FOR ALL
    TO app_user
    USING (owner_id = current_setting('app.user_id')::integer)
    WITH CHECK (owner_id = current_setting('app.user_id')::integer);

-- Policy: admins see everything
CREATE POLICY admin_full_access ON documents
    FOR ALL
    TO app_admin
    USING (true)
    WITH CHECK (true);

-- Multi-tenant isolation
CREATE POLICY tenant_isolation ON orders
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Per-operation policies
CREATE POLICY select_own ON documents
    FOR SELECT USING (owner_id = current_setting('app.user_id')::int);

CREATE POLICY insert_own ON documents
    FOR INSERT WITH CHECK (owner_id = current_setting('app.user_id')::int);

CREATE POLICY update_own ON documents
    FOR UPDATE
    USING (owner_id = current_setting('app.user_id')::int)
    WITH CHECK (owner_id = current_setting('app.user_id')::int);

CREATE POLICY delete_own ON documents
    FOR DELETE USING (owner_id = current_setting('app.user_id')::int);
```

```go
// Go — set RLS context per request
func SetTenantContext(ctx context.Context, db *sql.DB, tenantID string) error {
    _, err := db.ExecContext(ctx,
        "SET LOCAL app.tenant_id = $1", tenantID)
    return err
}

// Middleware pattern
func TenantMiddleware(db *sql.DB) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            tenantID := r.Header.Get("X-Tenant-ID")
            tx, _ := db.BeginTx(r.Context(), nil)
            tx.ExecContext(r.Context(),
                "SET LOCAL app.tenant_id = $1", tenantID)
            // Store tx in context for handlers
            ctx := context.WithValue(r.Context(), "tx", tx)
            next.ServeHTTP(w, r.WithContext(ctx))
            tx.Commit()
        })
    }
}
```

**RLS important details:**
- `USING` clause: filters rows for SELECT, UPDATE, DELETE (which rows can be seen)
- `WITH CHECK` clause: validates rows for INSERT, UPDATE (which rows can be written)
- SET LOCAL: setting scoped to current transaction only (thread-safe)
- Superusers and table owners bypass RLS unless FORCE is enabled
- RLS policies are combined with OR (any matching policy allows access)

---

### Advisory Locks

Application-level locks managed by PostgreSQL — not tied to any table or row.

```sql
-- Session-level advisory lock (held until session ends or explicit unlock)
SELECT pg_advisory_lock(12345);        -- blocks if lock held by another session
SELECT pg_try_advisory_lock(12345);    -- returns false instead of blocking
SELECT pg_advisory_unlock(12345);      -- explicit release

-- Transaction-level advisory lock (released at end of transaction)
SELECT pg_advisory_xact_lock(12345);   -- auto-released on COMMIT/ROLLBACK

-- Two-key advisory lock (for namespaced locking)
SELECT pg_advisory_lock(1, 42);        -- namespace 1, key 42
SELECT pg_advisory_lock(2, 42);        -- namespace 2, key 42 (different lock)
```

```go
// Go — advisory lock for singleton job processing
func ProcessJob(ctx context.Context, db *sql.DB, jobType int) error {
    tx, err := db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()

    // Try to acquire lock (non-blocking)
    var acquired bool
    err = tx.QueryRowContext(ctx,
        "SELECT pg_try_advisory_xact_lock($1)", jobType).Scan(&acquired)
    if err != nil {
        return err
    }
    if !acquired {
        return nil // another worker is processing
    }

    // Process job (lock held for duration of transaction)
    // ... job processing logic ...

    return tx.Commit() // lock auto-released
}
```

**Use cases:** Singleton job processing, rate limiting, distributed mutex, preventing concurrent migrations.

---

### Foreign Data Wrappers (FDW)

Query external data sources as if they were local PostgreSQL tables.

```sql
-- postgres_fdw: query another PostgreSQL database
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

CREATE SERVER remote_db
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (host 'remote-host', dbname 'analytics', port '5432');

CREATE USER MAPPING FOR app_user
    SERVER remote_db
    OPTIONS (user 'readonly_user', password 'secret');

-- Import remote tables
IMPORT FOREIGN SCHEMA public
    FROM SERVER remote_db
    INTO remote_schema;

-- Or create foreign table manually
CREATE FOREIGN TABLE remote_users (
    id    INTEGER,
    name  VARCHAR(100),
    email VARCHAR(255)
)
SERVER remote_db
OPTIONS (schema_name 'public', table_name 'users');

-- Query as if it were local
SELECT l.name, r.email
FROM local_accounts l
JOIN remote_users r ON r.id = l.remote_user_id;

-- Other FDW examples:
-- file_fdw: query CSV/log files as tables
-- mysql_fdw: query MySQL databases
-- mongo_fdw: query MongoDB collections
-- redis_fdw: query Redis keys
-- s3_fdw: query S3 files (Parquet, CSV)
```

---

### Custom Types & Domains

```sql
-- Domain: constrained type (reusable validation)
CREATE DOMAIN email AS VARCHAR(255)
    CHECK (VALUE ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');

CREATE DOMAIN positive_amount AS DECIMAL(10,2)
    CHECK (VALUE > 0);

CREATE DOMAIN phone_number AS VARCHAR(20)
    CHECK (VALUE ~ '^\+[1-9]\d{1,14}$');  -- E.164 format

CREATE TABLE users (
    id    SERIAL PRIMARY KEY,
    email email NOT NULL UNIQUE,
    phone phone_number
);

-- Composite type
CREATE TYPE address AS (
    street  VARCHAR(200),
    city    VARCHAR(100),
    state   VARCHAR(50),
    zip     VARCHAR(20),
    country VARCHAR(2)
);

CREATE TABLE customers (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100),
    billing_addr    address,
    shipping_addr   address
);

INSERT INTO customers (name, billing_addr) VALUES (
    'Alice',
    ROW('123 Main St', 'Springfield', 'IL', '62701', 'US')
);

SELECT (billing_addr).city FROM customers WHERE id = 1;

-- Enum type
CREATE TYPE order_status AS ENUM (
    'draft', 'pending', 'paid', 'shipped', 'delivered', 'cancelled'
);

CREATE TABLE orders (
    id     SERIAL PRIMARY KEY,
    status order_status NOT NULL DEFAULT 'draft'
);

-- Adding values to enum (safe in production)
ALTER TYPE order_status ADD VALUE 'refunded' AFTER 'delivered';
-- WARNING: Cannot remove enum values — only add
```

---

### Table Inheritance

```sql
-- Parent table
CREATE TABLE audit_events (
    id          BIGSERIAL PRIMARY KEY,
    event_type  VARCHAR(50) NOT NULL,
    actor_id    INTEGER,
    payload     JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Child tables inherit all columns and constraints
CREATE TABLE auth_events (
    login_ip    INET,
    user_agent  TEXT
) INHERITS (audit_events);

CREATE TABLE data_events (
    table_name  VARCHAR(100),
    record_id   INTEGER,
    old_values  JSONB,
    new_values  JSONB
) INHERITS (audit_events);

-- Query parent table: includes all child rows
SELECT * FROM audit_events WHERE created_at > NOW() - INTERVAL '1 hour';

-- Query child table only
SELECT * FROM ONLY audit_events;     -- only parent, not children
SELECT * FROM auth_events;            -- only auth events
```

**Note:** Table inheritance is largely superseded by **declarative partitioning** (PostgreSQL 10+) for most use cases. Use partitioning for performance; inheritance for polymorphic data models only.

---

### pgvector — AI Vector Search

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Store embeddings alongside regular data
CREATE TABLE documents (
    id        SERIAL PRIMARY KEY,
    title     TEXT NOT NULL,
    content   TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI ada-002 dimension
    metadata  JSONB DEFAULT '{}'
);

-- Create HNSW index (fast approximate nearest neighbor)
CREATE INDEX idx_documents_embedding ON documents
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Similarity search: find 10 most similar documents
SELECT id, title,
       1 - (embedding <=> $1::vector) AS similarity  -- cosine similarity
FROM documents
ORDER BY embedding <=> $1::vector  -- <=> is cosine distance
LIMIT 10;

-- Combined semantic + metadata filtering
SELECT id, title,
       1 - (embedding <=> $1::vector) AS similarity
FROM documents
WHERE metadata->>'category' = 'engineering'
  AND 1 - (embedding <=> $1::vector) > 0.7  -- similarity threshold
ORDER BY embedding <=> $1::vector
LIMIT 10;

-- Distance operators:
-- <=>  Cosine distance (most common for text embeddings)
-- <->  L2 (Euclidean) distance
-- <#>  Inner product (negative, for maximum inner product search)
```

```python
# Python — insert and query with pgvector
import openai
import psycopg2
from pgvector.psycopg2 import register_vector

conn = psycopg2.connect(dsn)
register_vector(conn)
cur = conn.cursor()

# Generate embedding
response = openai.embeddings.create(
    model="text-embedding-ada-002",
    input="How to optimize PostgreSQL queries"
)
embedding = response.data[0].embedding

# Insert
cur.execute(
    "INSERT INTO documents (title, content, embedding) VALUES (%s, %s, %s)",
    ("Query Optimization", "Full content here...", embedding)
)

# Search
cur.execute(
    "SELECT id, title, 1 - (embedding <=> %s::vector) AS similarity "
    "FROM documents ORDER BY embedding <=> %s::vector LIMIT 5",
    (embedding, embedding)
)
results = cur.fetchall()
```

---

### PostGIS — Geospatial Queries

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE locations (
    id    SERIAL PRIMARY KEY,
    name  TEXT NOT NULL,
    geom  GEOGRAPHY(POINT, 4326)  -- WGS84 coordinate system
);

CREATE INDEX idx_locations_geom ON locations USING GiST (geom);

-- Insert with longitude, latitude
INSERT INTO locations (name, geom) VALUES
    ('Times Square', ST_MakePoint(-73.9857, 40.7580)::geography),
    ('Central Park', ST_MakePoint(-73.9654, 40.7829)::geography);

-- Find locations within 2km of a point
SELECT name,
       ST_Distance(geom, ST_MakePoint(-73.99, 40.75)::geography) AS distance_meters
FROM locations
WHERE ST_DWithin(geom, ST_MakePoint(-73.99, 40.75)::geography, 2000)
ORDER BY distance_meters;

-- Find nearest N locations
SELECT name,
       ST_Distance(geom, ST_MakePoint(-73.99, 40.75)::geography) AS distance_meters
FROM locations
ORDER BY geom <-> ST_MakePoint(-73.99, 40.75)::geography
LIMIT 5;

-- Bounding box query (fast pre-filter)
SELECT * FROM locations
WHERE geom && ST_MakeEnvelope(-74.0, 40.7, -73.9, 40.8, 4326)::geography;
```

---

### Logical Decoding & Change Data Capture

```sql
-- Enable logical decoding
-- postgresql.conf: wal_level = logical

-- Create replication slot
SELECT pg_create_logical_replication_slot('my_slot', 'pgoutput');

-- View changes (for debugging/testing)
SELECT * FROM pg_logical_slot_get_changes('my_slot', NULL, NULL);

-- In production: use Debezium to stream changes to Kafka
-- Or use pg_recvlogical CLI tool:
-- pg_recvlogical -d mydb --slot my_slot --start -f -
```

**Logical decoding enables:**
- Change Data Capture (CDC) without triggers
- Real-time data streaming to Kafka, Elasticsearch, data warehouses
- Cross-database replication (PostgreSQL → MySQL, PostgreSQL → BigQuery)
- Event sourcing from existing tables (no schema changes needed)

---

### Advanced Configuration

```sql
-- Session-level settings (per-connection overrides)
SET work_mem = '256MB';              -- for complex sorts/aggregations
SET statement_timeout = '30s';       -- kill queries after 30s
SET lock_timeout = '5s';             -- kill lock waits after 5s
SET idle_in_transaction_session_timeout = '60s';  -- kill idle transactions

-- Per-function settings
CREATE FUNCTION heavy_report() RETURNS SETOF RECORD AS $$
    -- This function gets more memory for sorting
    SET LOCAL work_mem = '512MB';
    -- ... report query ...
$$ LANGUAGE plpgsql
SET work_mem = '512MB';  -- alternative: function-level setting

-- Per-role settings
ALTER ROLE reporting_user SET work_mem = '256MB';
ALTER ROLE reporting_user SET statement_timeout = '300s';

-- Per-database settings
ALTER DATABASE analytics SET work_mem = '128MB';
ALTER DATABASE analytics SET max_parallel_workers_per_gather = 4;
```

---

## Best Practices

1. **ALWAYS use LISTEN/NOTIFY for simple real-time needs** — before adding Redis pub/sub
2. **ALWAYS use RLS for multi-tenant isolation** — never rely only on application WHERE clauses
3. **ALWAYS use SET LOCAL** for RLS context — scoped to transaction, thread-safe
4. **ALWAYS use domains for reusable validation** — enforce email format, phone format at DB level
5. **ALWAYS use pgvector with HNSW index** — not IVFFlat, for production similarity search
6. **ALWAYS use declarative partitioning** over table inheritance for performance
7. **ALWAYS use GEOGRAPHY type** in PostGIS for earth-surface distance calculations
8. **ALWAYS use logical decoding for CDC** — not triggers (zero write overhead)
9. **NEVER store passwords in USER MAPPING** in production — use .pgpass or certificate auth
10. **NEVER use table inheritance for partitioning** — use declarative partitioning instead

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Application-level tenant filtering only | Data leaks when filter forgotten | Use RLS with SET LOCAL |
| Redis pub/sub for simple notifications | Extra infrastructure for simple case | Use LISTEN/NOTIFY |
| Separate vector database for small datasets | Infrastructure complexity | Use pgvector in PostgreSQL |
| GEOMETRY instead of GEOGRAPHY for earth distances | Incorrect distance calculations | Use GEOGRAPHY(POINT, 4326) |
| Trigger-based CDC | Write overhead, fragile | Use logical decoding + Debezium |
| Enum without planning for removal | Cannot remove enum values | Use CHECK constraint if values may change |
| Advisory locks without timeout | Potential deadlock | Use pg_try_advisory_lock or lock_timeout |
| RLS with SET (not SET LOCAL) | Leaks context across transactions | Always use SET LOCAL in transactions |
| FDW without connection limits | Remote database overwhelmed | Set fetch_size, use_remote_estimate |
| pgvector without HNSW index | Exact search on large datasets is slow | Create HNSW or IVFFlat index |

---

## Real-world Examples

### Supabase
- RLS as the primary authorization mechanism (replaces middleware)
- LISTEN/NOTIFY for real-time subscriptions
- PostgREST translates HTTP to SQL with RLS enforcement
- pgvector for AI-powered search features

### Neon
- Logical decoding for serverless branching (copy-on-write)
- Custom storage engine separated from PostgreSQL compute
- Connection pooling with built-in PgBouncer

### Timescale
- TimescaleDB extension for time-series hypertables
- Continuous aggregates (auto-refreshing materialized views)
- Compression for historical time-series data (90%+ compression)

### Crunchy Data
- pgvector in production for enterprise AI search
- PostGIS for fleet tracking and location services
- Logical replication for zero-downtime upgrades
- pgaudit for SOC 2 compliance

---

## Enforcement Checklist

- [ ] RLS enabled for multi-tenant tables with SET LOCAL context
- [ ] LISTEN/NOTIFY evaluated before adding external message queue
- [ ] Domains created for reusable validation patterns (email, phone, URL)
- [ ] pgvector with HNSW index for vector similarity search
- [ ] PostGIS with GEOGRAPHY type for geospatial queries
- [ ] Logical decoding configured for CDC (not triggers)
- [ ] Advisory locks use transaction-level variant or explicit timeout
- [ ] Enum types used only for values that will never be removed
- [ ] FDW connections configured with fetch_size limits
- [ ] Statement timeout and lock timeout set per role
