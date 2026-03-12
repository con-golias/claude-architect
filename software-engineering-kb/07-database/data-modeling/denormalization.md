# Denormalization Strategies

> **Domain:** Database > Data Modeling
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Normalization eliminates redundancy. Denormalization reintroduces it — on purpose. When your normalized schema requires 8-table JOINs to render a dashboard, when your read-heavy API is too slow because every request triggers complex queries, denormalization is the solution. The key: you must normalize FIRST, then denormalize specific hot paths with full awareness of the tradeoffs. Denormalization trades storage and write complexity for read performance. Done right, it makes your application fast. Done wrong, it creates a maintenance nightmare with inconsistent data everywhere.

---

## How It Works

### When to Denormalize

```
┌─────────────────────────────────────────────────────────┐
│              DENORMALIZATION DECISION TREE                │
│                                                          │
│  Is the query slow?                                     │
│  ├── NO → Do NOT denormalize                            │
│  └── YES                                                │
│       ├── Can you add an index?                         │
│       │   ├── YES → Add index first                     │
│       │   └── NO                                        │
│       ├── Can you use a materialized view?              │
│       │   ├── YES → Prefer materialized view            │
│       │   └── NO                                        │
│       ├── Is the data read-heavy (>90% reads)?          │
│       │   ├── YES → Denormalize                         │
│       │   └── NO → Consider caching instead             │
│       └── Can you tolerate stale data?                  │
│           ├── YES → Async denormalization (event-driven) │
│           └── NO → Sync denormalization (triggers/app)   │
└─────────────────────────────────────────────────────────┘
```

---

### Strategy 1: Duplicating Columns

Store frequently-accessed data from related tables directly in the querying table.

```sql
-- NORMALIZED: 3 JOINs needed to show order list
SELECT o.id, o.total, c.name AS customer_name, c.email,
       COUNT(oi.id) AS item_count
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id, o.total, c.name, c.email;

-- DENORMALIZED: customer_name stored in orders table
ALTER TABLE orders ADD COLUMN customer_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN customer_email VARCHAR(200);
ALTER TABLE orders ADD COLUMN item_count INTEGER DEFAULT 0;

-- Now: single table scan, no JOINs
SELECT id, total, customer_name, customer_email, item_count
FROM orders
WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 50;
```

**Keeping it in sync:**

```sql
-- Option A: Application-level sync
-- Update denormalized columns when source changes

-- Option B: Database trigger
CREATE OR REPLACE FUNCTION sync_customer_name()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE orders
    SET customer_name = NEW.name,
        customer_email = NEW.email
    WHERE customer_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_customer_name
    AFTER UPDATE OF name, email ON customers
    FOR EACH ROW
    EXECUTE FUNCTION sync_customer_name();
```

---

### Strategy 2: Pre-computed Aggregates

Store calculated values instead of computing on every read.

```sql
-- NORMALIZED: count orders per customer on every request
SELECT customer_id, COUNT(*) as order_count, SUM(total) as lifetime_value
FROM orders
GROUP BY customer_id;
-- Scans entire orders table every time

-- DENORMALIZED: pre-computed aggregates
ALTER TABLE customers ADD COLUMN order_count INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN lifetime_value DECIMAL(12,2) DEFAULT 0;

-- Update on new order (application-level or trigger)
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE customers
        SET order_count = order_count + 1,
            lifetime_value = lifetime_value + NEW.total
        WHERE id = NEW.customer_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE customers
        SET order_count = order_count - 1,
            lifetime_value = lifetime_value - OLD.total
        WHERE id = OLD.customer_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_customer_stats
    AFTER INSERT OR DELETE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_stats();
```

---

### Strategy 3: Materialized Views

Database-managed denormalization — the database handles the duplication.

```sql
-- Materialized view: pre-computed dashboard data
CREATE MATERIALIZED VIEW mv_product_stats AS
SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.category,
    COUNT(DISTINCT oi.order_id) AS total_orders,
    SUM(oi.quantity) AS total_units_sold,
    SUM(oi.quantity * oi.unit_price) AS total_revenue,
    AVG(r.rating) AS avg_rating,
    COUNT(DISTINCT r.id) AS review_count
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN reviews r ON r.product_id = p.id
GROUP BY p.id, p.name, p.category;

-- Create index on materialized view
CREATE UNIQUE INDEX idx_mv_product_stats_id ON mv_product_stats(product_id);
CREATE INDEX idx_mv_product_stats_category ON mv_product_stats(category);

-- Refresh periodically (not real-time)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_stats;
-- CONCURRENTLY allows reads during refresh (requires unique index)
```

```go
// Go — refresh materialized view on schedule
func refreshProductStats(ctx context.Context, db *sql.DB) {
    ticker := time.NewTicker(5 * time.Minute)
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            _, err := db.ExecContext(ctx,
                "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_stats")
            if err != nil {
                log.Printf("Failed to refresh mv_product_stats: %v", err)
            }
        }
    }
}
```

**Materialized view vs manual denormalization:**

| Aspect | Materialized View | Manual Denormalization |
|--------|-------------------|----------------------|
| Refresh | REFRESH command (batch) | Per-write (real-time) |
| Staleness | Minutes (refresh interval) | None (immediate) |
| Write overhead | None on writes, batch refresh | Every write updates extra columns |
| Complexity | Low (SQL only) | High (triggers or app logic) |
| Best for | Dashboards, reports, analytics | Real-time reads, API responses |

---

### Strategy 4: Summary Tables

Separate tables that aggregate data for specific query patterns.

```sql
-- Summary table: daily revenue by product category
CREATE TABLE daily_category_revenue (
    date        DATE NOT NULL,
    category    VARCHAR(50) NOT NULL,
    order_count INTEGER NOT NULL DEFAULT 0,
    total_units INTEGER NOT NULL DEFAULT 0,
    revenue     DECIMAL(12,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (date, category)
);

-- Populate/update via batch job or trigger
INSERT INTO daily_category_revenue (date, category, order_count, total_units, revenue)
SELECT
    DATE(o.created_at),
    p.category,
    COUNT(DISTINCT o.id),
    SUM(oi.quantity),
    SUM(oi.quantity * oi.unit_price)
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
WHERE DATE(o.created_at) = CURRENT_DATE
GROUP BY DATE(o.created_at), p.category
ON CONFLICT (date, category) DO UPDATE SET
    order_count = EXCLUDED.order_count,
    total_units = EXCLUDED.total_units,
    revenue = EXCLUDED.revenue;

-- Query is now instant (no JOINs, no aggregation)
SELECT * FROM daily_category_revenue
WHERE date BETWEEN '2024-01-01' AND '2024-12-31'
ORDER BY date, category;
```

---

### Strategy 5: Embedding Related Data (JSON)

Store related data as JSONB instead of separate tables.

```sql
-- NORMALIZED: separate tables for product attributes
CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT);
CREATE TABLE product_attributes (
    product_id INTEGER REFERENCES products(id),
    key TEXT, value TEXT,
    PRIMARY KEY (product_id, key)
);
-- Requires JOIN + pivot to read all attributes

-- DENORMALIZED: JSONB column for flexible attributes
CREATE TABLE products (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    price       DECIMAL(10,2) NOT NULL,
    attributes  JSONB DEFAULT '{}'::jsonb
);

-- Insert with attributes
INSERT INTO products (name, price, attributes)
VALUES ('Laptop', 999.99, '{
    "brand": "Dell",
    "cpu": "Intel i7",
    "ram_gb": 16,
    "screen_size": "15.6",
    "color": ["Silver", "Black"]
}');

-- Query on JSONB (uses GIN index)
CREATE INDEX idx_products_attributes ON products USING GIN (attributes);

SELECT * FROM products
WHERE attributes->>'brand' = 'Dell'
  AND (attributes->>'ram_gb')::int >= 16;
```

**When to use JSONB vs separate tables:**

| Use JSONB When | Use Separate Tables When |
|---------------|-------------------------|
| Attributes vary per row (EAV pattern) | Attributes are consistent across all rows |
| You rarely query on individual attributes | You frequently filter/JOIN on attributes |
| Schema changes frequently | Schema is stable |
| Data is read as a whole | Data is queried/updated partially |

---

### Strategy 6: Event-Driven Denormalization

Use events to keep denormalized data in sync asynchronously.

```
┌────────────┐    Event        ┌─────────────┐    Update     ┌──────────┐
│ Customer   │───────────────►│ Event Bus   │──────────────►│ Order    │
│ Service    │  CustomerUpdated│ (Kafka/SQS) │              │ Service  │
│            │                │             │              │          │
│ UPDATE     │                │             │  UPDATE orders│          │
│ customers  │                │             │  SET customer_│          │
│ SET name=  │                │             │  name = ...  │          │
└────────────┘                └─────────────┘              └──────────┘

Pros: Services decoupled, no triggers, no distributed transactions
Cons: Eventual consistency — brief window of stale data
```

---

## Best Practices

1. **ALWAYS normalize first, then denormalize** — you cannot denormalize what was never normalized
2. **ALWAYS measure before denormalizing** — use EXPLAIN ANALYZE, not guesses
3. **ALWAYS document which fields are denormalized** and their source of truth
4. **ALWAYS have a single source of truth** — denormalized copies reference the canonical source
5. **ALWAYS choose a sync strategy** — triggers, application-level, events, or materialized views
6. **NEVER denormalize write-heavy data** — every write must update all copies
7. **NEVER denormalize data that changes frequently** — sync cost outweighs read benefit
8. **ALWAYS consider caching first** — Redis/Memcached may solve the problem without schema changes
9. **ALWAYS add NOT NULL constraints** to denormalized columns — stale nulls cause bugs
10. **ALWAYS monitor denormalized data for drift** — periodically verify consistency

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Denormalize everything from the start | Data inconsistency everywhere, high write cost | Normalize first, profile, then denormalize hot paths |
| No sync strategy | Denormalized data diverges from source | Implement triggers, events, or scheduled sync |
| Denormalize write-heavy data | Writes 5x slower (updating all copies) | Keep write-heavy tables normalized, cache reads |
| Materialized view never refreshed | Dashboard shows data from weeks ago | Schedule refresh, monitor staleness |
| Trigger cascades | One update triggers chain of 10 triggers | Limit trigger depth, prefer application-level sync |
| No source of truth documented | Nobody knows which table has the "real" data | Document canonical source for every field |
| Over-using JSONB | Entire schema in JSON, no type safety, no constraints | Use JSONB for truly flexible data only |
| No consistency checks | Denormalized data slowly drifts from source | Run periodic reconciliation jobs |

---

## Real-world Examples

### Twitter/X
- Denormalized timeline: each user's home timeline is pre-computed
- When you tweet, it is "fanned out" to all followers' timelines
- Trade: massive write amplification for instant read performance
- Summary tables for tweet engagement (likes, retweets, views)

### Instagram
- Denormalized user feed pre-computed in Cassandra
- Pre-computed aggregates: follower_count, following_count on user profile
- Materialized views for Explore page recommendations

### Amazon
- Product pages combine data from dozens of services
- Each service denormalizes what it needs locally
- Event-driven sync between services (SNS/SQS)
- Pre-computed "customers also bought" recommendations

---

## Enforcement Checklist

- [ ] Schema is normalized to 3NF as the baseline
- [ ] Denormalization decisions documented with performance justification
- [ ] Source of truth identified for every denormalized field
- [ ] Sync mechanism implemented (trigger, event, scheduled job, or materialized view)
- [ ] Materialized views have scheduled refresh with monitoring
- [ ] Periodic reconciliation job verifies consistency of denormalized data
- [ ] Write impact assessed before denormalizing (how many copies to update?)
- [ ] Caching considered as an alternative before schema changes
