# Schema Design Patterns

> **Domain:** Database > Data Modeling
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Real-world schemas do not fit neatly into textbook normalization examples. You need patterns for multi-tenant SaaS, polymorphic content types, products with wildly different attributes, status machines, and event-driven histories. These patterns solve recurring schema challenges that every production database faces. Using the wrong pattern leads to schemas that cannot evolve, queries that do not scale, and migrations that require downtime.

---

## How It Works

### Pattern 1: Single Table Inheritance (STI)

All subtypes stored in one table with a type discriminator column. Unused columns are NULL.

```sql
CREATE TABLE vehicles (
    id            SERIAL PRIMARY KEY,
    type          VARCHAR(20) NOT NULL CHECK (type IN ('car', 'truck', 'motorcycle')),
    make          VARCHAR(50) NOT NULL,
    model         VARCHAR(50) NOT NULL,
    year          INTEGER NOT NULL,
    -- Car-specific
    num_doors     INTEGER,          -- NULL for trucks, motorcycles
    trunk_size_l  INTEGER,          -- NULL for trucks, motorcycles
    -- Truck-specific
    payload_kg    INTEGER,          -- NULL for cars, motorcycles
    num_axles     INTEGER,          -- NULL for cars, motorcycles
    -- Motorcycle-specific
    engine_cc     INTEGER           -- NULL for cars, trucks
);

CREATE INDEX idx_vehicles_type ON vehicles(type);
```

**When to use STI:**
- Few subtypes (2-5)
- Subtypes share most columns
- Queries often span all subtypes
- Simple and fast (no JOINs needed)

**When NOT to use STI:**
- Many subtypes with different columns → table becomes very wide
- Subtypes have almost no shared columns
- Need strict constraints per subtype (CHECK constraints become complex)

---

### Pattern 2: Class Table Inheritance (CTI)

Base table + separate table per subtype. JOINs required to get full entity.

```sql
-- Base table: common columns
CREATE TABLE vehicles (
    id    SERIAL PRIMARY KEY,
    type  VARCHAR(20) NOT NULL,
    make  VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year  INTEGER NOT NULL
);

-- Subtype tables: specific columns
CREATE TABLE cars (
    id           INTEGER PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
    num_doors    INTEGER NOT NULL,
    trunk_size_l INTEGER
);

CREATE TABLE trucks (
    id          INTEGER PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
    payload_kg  INTEGER NOT NULL,
    num_axles   INTEGER NOT NULL
);

-- Query: get all cars with their common fields
SELECT v.*, c.num_doors, c.trunk_size_l
FROM vehicles v
JOIN cars c ON c.id = v.id;
```

**When to use CTI:**
- Subtypes have many different columns
- Need strict constraints per subtype
- Queries usually target one subtype at a time
- Schema must be extensible (add new subtypes easily)

---

### Pattern 3: Entity-Attribute-Value (EAV)

Flexible schema where attributes are stored as rows instead of columns.

```sql
CREATE TABLE entities (
    id    SERIAL PRIMARY KEY,
    type  VARCHAR(50) NOT NULL,
    name  VARCHAR(200) NOT NULL
);

CREATE TABLE entity_attributes (
    entity_id   INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    attribute   VARCHAR(100) NOT NULL,
    value       TEXT,
    PRIMARY KEY (entity_id, attribute)
);

-- Insert a laptop with flexible attributes
INSERT INTO entities (id, type, name) VALUES (1, 'product', 'MacBook Pro');
INSERT INTO entity_attributes VALUES
    (1, 'brand', 'Apple'),
    (1, 'cpu', 'M3 Pro'),
    (1, 'ram_gb', '18'),
    (1, 'price', '1999.00'),
    (1, 'screen_size', '14.2');

-- Insert a T-shirt with completely different attributes
INSERT INTO entities (id, type, name) VALUES (2, 'product', 'Basic T-Shirt');
INSERT INTO entity_attributes VALUES
    (2, 'brand', 'Uniqlo'),
    (2, 'size', 'M'),
    (2, 'color', 'Navy'),
    (2, 'material', '100% Cotton'),
    (2, 'price', '14.90');
```

**EAV tradeoffs:**

| Pro | Con |
|-----|-----|
| Infinite flexibility | No type safety (everything is TEXT) |
| No schema changes needed | Complex queries (pivot required) |
| Any entity can have any attribute | No constraints on attribute values |
| | Terrible query performance at scale |

**Modern alternative:** JSONB column (see denormalization.md) provides flexibility without EAV's query complexity.

---

### Pattern 4: Multi-Tenant Schema Design

#### Shared Database, Shared Schema (row-level isolation)

```sql
-- Simplest multi-tenant approach: tenant_id on every table
CREATE TABLE tenants (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name  VARCHAR(200) NOT NULL,
    plan  VARCHAR(20) DEFAULT 'free'
);

CREATE TABLE products (
    id          SERIAL PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    name        VARCHAR(200) NOT NULL,
    price       DECIMAL(10,2) NOT NULL
);

-- CRITICAL: Every query MUST filter by tenant_id
CREATE INDEX idx_products_tenant ON products(tenant_id);

-- Row-Level Security (PostgreSQL)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON products
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Set tenant context per request
SET app.current_tenant = 'uuid-of-tenant-123';
SELECT * FROM products;  -- automatically filtered by RLS
```

#### Shared Database, Schema-per-Tenant

```sql
-- Each tenant gets their own schema
CREATE SCHEMA tenant_abc123;
CREATE TABLE tenant_abc123.products (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(200) NOT NULL
);

-- Query routes to correct schema
SET search_path TO tenant_abc123;
SELECT * FROM products;  -- queries tenant_abc123.products
```

**Multi-tenant comparison:**

| Strategy | Isolation | Complexity | Scale | Cost |
|----------|-----------|------------|-------|------|
| **Row-level** (tenant_id) | Low | Low | High (millions of tenants) | Cheapest |
| **Schema-per-tenant** | Medium | Medium | Medium (thousands) | Moderate |
| **Database-per-tenant** | Highest | High | Low (hundreds) | Most expensive |

---

### Pattern 5: State Machine / Status Pattern

```sql
CREATE TABLE orders (
    id          SERIAL PRIMARY KEY,
    status      VARCHAR(20) NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','pending','paid','shipped','delivered','cancelled','refunded')),
    user_id     INTEGER NOT NULL REFERENCES users(id),
    total       DECIMAL(10,2) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Status transition history (audit trail)
CREATE TABLE order_status_history (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status VARCHAR(20),
    to_status   VARCHAR(20) NOT NULL,
    changed_by  INTEGER REFERENCES users(id),
    reason      TEXT,
    changed_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_status_history ON order_status_history(order_id, changed_at);
```

```
Valid transitions:
draft ──► pending ──► paid ──► shipped ──► delivered
               │         │
               └──► cancelled
                         └──► refunded
```

```go
// Go — enforce valid state transitions
var validTransitions = map[string][]string{
    "draft":     {"pending", "cancelled"},
    "pending":   {"paid", "cancelled"},
    "paid":      {"shipped", "refunded"},
    "shipped":   {"delivered"},
    "delivered": {},
    "cancelled": {},
    "refunded":  {},
}

func TransitionOrder(ctx context.Context, db *sql.DB, orderID int, newStatus string) error {
    tx, err := db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()

    var currentStatus string
    err = tx.QueryRowContext(ctx,
        "SELECT status FROM orders WHERE id = $1 FOR UPDATE", orderID,
    ).Scan(&currentStatus)
    if err != nil {
        return err
    }

    allowed := validTransitions[currentStatus]
    if !slices.Contains(allowed, newStatus) {
        return fmt.Errorf("invalid transition: %s → %s", currentStatus, newStatus)
    }

    _, err = tx.ExecContext(ctx,
        "UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2",
        newStatus, orderID)
    if err != nil {
        return err
    }

    _, err = tx.ExecContext(ctx,
        `INSERT INTO order_status_history (order_id, from_status, to_status)
         VALUES ($1, $2, $3)`,
        orderID, currentStatus, newStatus)
    if err != nil {
        return err
    }

    return tx.Commit()
}
```

---

### Pattern 6: Tagging / Labeling

```sql
-- Tags table
CREATE TABLE tags (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(50) NOT NULL UNIQUE,
    slug  VARCHAR(50) NOT NULL UNIQUE
);

-- Junction table for M:N tagging
CREATE TABLE post_tags (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_post_tags_tag ON post_tags(tag_id);

-- Find posts with ALL specified tags (intersection)
SELECT p.id, p.title
FROM posts p
JOIN post_tags pt ON pt.post_id = p.id
WHERE pt.tag_id IN (1, 2, 3)
GROUP BY p.id, p.title
HAVING COUNT(DISTINCT pt.tag_id) = 3;  -- must have all 3 tags

-- Alternative: PostgreSQL array + GIN index
CREATE TABLE posts_v2 (
    id      SERIAL PRIMARY KEY,
    title   TEXT NOT NULL,
    tags    TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_posts_tags ON posts_v2 USING GIN (tags);

-- Contains all specified tags
SELECT * FROM posts_v2 WHERE tags @> ARRAY['javascript', 'react'];
```

---

### Pattern 7: Temporal / Bi-Temporal Data

Track data changes over time — when facts were true and when they were recorded.

```sql
-- System-versioned temporal table (SQL:2011 standard)
-- PostgreSQL approach using triggers:
CREATE TABLE employees (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    salary       DECIMAL(10,2) NOT NULL,
    department   VARCHAR(50),
    valid_from   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to     TIMESTAMPTZ NOT NULL DEFAULT 'infinity'::timestamptz,
    EXCLUDE USING gist (id WITH =, tstzrange(valid_from, valid_to) WITH &&)
);

-- Current employees
CREATE VIEW current_employees AS
SELECT * FROM employees WHERE valid_to = 'infinity'::timestamptz;

-- Update = close old record + insert new record
-- "Alice gets a raise on 2024-06-01"
UPDATE employees SET valid_to = '2024-06-01' WHERE id = 1 AND valid_to = 'infinity';
INSERT INTO employees (id, name, salary, department, valid_from)
VALUES (1, 'Alice', 95000, 'Engineering', '2024-06-01');

-- Query: what was Alice's salary on 2024-03-15?
SELECT * FROM employees
WHERE id = 1
  AND valid_from <= '2024-03-15'
  AND valid_to > '2024-03-15';
```

---

## Best Practices

1. **ALWAYS start with the simplest pattern** that meets your requirements
2. **ALWAYS use JSONB over EAV** for flexible attributes in PostgreSQL
3. **ALWAYS use RLS for multi-tenant isolation** when using shared schema approach
4. **ALWAYS include tenant_id in every index** for multi-tenant shared schema
5. **ALWAYS store state transition history** — you will need it for debugging and audit
6. **ALWAYS enforce valid state transitions** in application code, not just CHECK constraints
7. **NEVER use EAV in new projects** — JSONB provides the same flexibility with better performance
8. **NEVER forget to filter by tenant_id** in shared schema — data leaks are critical security bugs
9. **ALWAYS use temporal patterns** for data with regulatory audit requirements
10. **ALWAYS add created_at and updated_at** to every table — you will need them

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| EAV for everything | Impossibly complex queries, no type safety | Use JSONB or proper typed columns |
| STI with 50+ subtypes | Table has 200 columns, 90% NULL | Switch to CTI or JSONB |
| No tenant_id index | Full table scans on multi-tenant queries | Composite index: (tenant_id, other_columns) |
| Status as free-text | Typos create invalid states ('shiped', 'delvered') | Use ENUM or CHECK constraint |
| No status history | Cannot audit when/why status changed | Add status_history table |
| Temporal data without exclusion constraint | Overlapping date ranges for same entity | Use EXCLUDE constraint (PostgreSQL) |
| Multi-tenant without RLS | Forgetting WHERE tenant_id = ... leaks data | Enable Row Level Security |
| Mixing patterns arbitrarily | Inconsistent schema, hard to maintain | Choose one pattern per entity type |

---

## Real-world Examples

### Shopify
- Multi-tenant shared schema with tenant_id on every table
- STI for discount types (percentage, fixed amount, buy-X-get-Y)
- State machine pattern for order lifecycle (20+ possible states)
- JSONB for product metafields (flexible merchant-defined attributes)

### GitHub
- CTI for event types (PushEvent, PullRequestEvent, etc.)
- Tagging pattern for issue labels (junction table)
- State machine for PR status (open → review → merged/closed)
- Temporal data for contribution graphs (daily snapshots)

### Salesforce
- EAV-inspired "custom fields" system (enterprise multi-tenant)
- Multi-tenant with schema-per-org approach
- Bi-temporal data for record history tracking
- Polymorphic relationships for custom objects

---

## Enforcement Checklist

- [ ] Inheritance strategy chosen (STI, CTI, or JSONB) with justification
- [ ] Multi-tenant isolation enforced (RLS, schema, or application-level)
- [ ] tenant_id included in all relevant indexes for multi-tenant apps
- [ ] Status fields use CHECK constraint or ENUM
- [ ] State transitions enforced in application code
- [ ] Status change history table exists for auditable entities
- [ ] EAV avoided — JSONB used instead for flexible attributes
- [ ] Temporal tables implemented for audit-required data
- [ ] created_at and updated_at on every table
