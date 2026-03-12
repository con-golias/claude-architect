# Advanced SQL Features

> **Domain:** Database > Relational > SQL Fundamentals
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Basic SELECT-JOIN-WHERE queries handle 70% of application needs. The remaining 30% — dynamic pivoting, full-text search, JSON manipulation, upserts, lateral joins, stored procedures — separate production-ready engineers from tutorial-level ones. These features eliminate the need to pull data into application code for processing, reducing network round-trips, memory usage, and latency. A single advanced SQL query often replaces hundreds of lines of application code and runs 10-100x faster because the database engine optimizes data access internally.

---

## How It Works

### UPSERT (INSERT ... ON CONFLICT)

Insert a row or update it if it already exists — atomic, no race conditions.

```sql
-- PostgreSQL: INSERT ... ON CONFLICT
INSERT INTO products (sku, name, price, stock)
VALUES ('SKU-001', 'Widget', 29.99, 100)
ON CONFLICT (sku)
DO UPDATE SET
    name  = EXCLUDED.name,
    price = EXCLUDED.price,
    stock = products.stock + EXCLUDED.stock,  -- add to existing stock
    updated_at = NOW();

-- Upsert multiple rows
INSERT INTO daily_stats (date, page, views, unique_visitors)
VALUES
    ('2024-06-01', '/home', 1500, 800),
    ('2024-06-01', '/about', 300, 200),
    ('2024-06-01', '/pricing', 750, 500)
ON CONFLICT (date, page)
DO UPDATE SET
    views = daily_stats.views + EXCLUDED.views,
    unique_visitors = GREATEST(daily_stats.unique_visitors, EXCLUDED.unique_visitors);

-- ON CONFLICT DO NOTHING (skip duplicates silently)
INSERT INTO email_subscriptions (email, subscribed_at)
VALUES ('alice@example.com', NOW())
ON CONFLICT (email) DO NOTHING;

-- MySQL: INSERT ... ON DUPLICATE KEY UPDATE
INSERT INTO products (sku, name, price)
VALUES ('SKU-001', 'Widget', 29.99)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    price = VALUES(price);

-- PostgreSQL: MERGE (SQL standard, PostgreSQL 15+)
MERGE INTO products AS target
USING staging_products AS source
ON target.sku = source.sku
WHEN MATCHED AND source.price <> target.price THEN
    UPDATE SET price = source.price, updated_at = NOW()
WHEN NOT MATCHED THEN
    INSERT (sku, name, price) VALUES (source.sku, source.name, source.price);
```

---

### LATERAL JOIN

Subquery that can reference columns from preceding FROM items — like a correlated subquery in FROM clause but more powerful.

```sql
-- Top 3 orders per customer (cannot do with regular JOIN)
SELECT c.name, recent.id, recent.total, recent.created_at
FROM customers c
CROSS JOIN LATERAL (
    SELECT o.id, o.total, o.created_at
    FROM orders o
    WHERE o.customer_id = c.id
    ORDER BY o.created_at DESC
    LIMIT 3
) AS recent;

-- Without LATERAL: would need window function + filter
SELECT name, id, total, created_at FROM (
    SELECT c.name, o.id, o.total, o.created_at,
           ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY o.created_at DESC) AS rn
    FROM customers c
    JOIN orders o ON o.customer_id = c.id
) sub
WHERE rn <= 3;

-- LATERAL with set-returning function
SELECT u.name, addr.*
FROM users u
CROSS JOIN LATERAL unnest(u.addresses) AS addr;

-- LATERAL for dependent aggregation
SELECT d.name AS department,
       stats.employee_count,
       stats.avg_salary,
       stats.max_salary
FROM departments d
CROSS JOIN LATERAL (
    SELECT COUNT(*) AS employee_count,
           AVG(salary) AS avg_salary,
           MAX(salary) AS max_salary
    FROM employees e
    WHERE e.department_id = d.id
) AS stats;
```

**When to use LATERAL:**
- Top-N per group queries
- Calling set-returning functions per row
- Complex dependent subqueries in FROM clause
- When correlated subquery in SELECT returns multiple columns

---

### JSON Operations

#### PostgreSQL JSONB

```sql
-- Create table with JSONB column
CREATE TABLE events (
    id         BIGSERIAL PRIMARY KEY,
    type       VARCHAR(50) NOT NULL,
    payload    JSONB NOT NULL DEFAULT '{}',
    metadata   JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert JSON data
INSERT INTO events (type, payload, metadata) VALUES (
    'purchase',
    '{"customer_id": 42, "items": [{"sku": "A1", "qty": 2}, {"sku": "B3", "qty": 1}], "total": 89.99}',
    '{"ip": "192.168.1.1", "user_agent": "Mozilla/5.0"}'
);

-- Access operators
SELECT
    payload->>'customer_id' AS customer_id,        -- text extraction (->>)
    payload->'items' AS items_array,                -- JSON extraction (->)
    payload->'items'->0->>'sku' AS first_item_sku,  -- nested access
    payload#>>'{items,0,sku}' AS first_sku_alt,     -- path extraction
    jsonb_array_length(payload->'items') AS item_count
FROM events
WHERE type = 'purchase';

-- Containment operators (use GIN index)
SELECT * FROM events WHERE payload @> '{"customer_id": 42}';       -- contains
SELECT * FROM events WHERE payload ? 'customer_id';                 -- key exists
SELECT * FROM events WHERE payload ?| array['refund', 'discount'];  -- any key exists
SELECT * FROM events WHERE payload ?& array['customer_id', 'total']; -- all keys exist

-- GIN index for JSONB (supports @>, ?, ?|, ?& operators)
CREATE INDEX idx_events_payload ON events USING GIN (payload);

-- Partial GIN index on specific path
CREATE INDEX idx_events_customer ON events USING GIN ((payload->'customer_id'));

-- B-tree index on extracted value (for equality/range queries)
CREATE INDEX idx_events_total ON events ((payload->>'total'));

-- JSONB modification functions
UPDATE events SET payload = payload || '{"status": "completed"}'     -- merge
WHERE id = 1;

UPDATE events SET payload = payload - 'temp_field'                    -- remove key
WHERE id = 1;

UPDATE events SET payload = jsonb_set(payload, '{items,0,qty}', '5') -- set nested value
WHERE id = 1;

-- Aggregate JSON
SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name)) AS users_json
FROM users;

-- Expand JSON array to rows
SELECT e.id, item->>'sku' AS sku, (item->>'qty')::int AS qty
FROM events e,
     jsonb_array_elements(e.payload->'items') AS item
WHERE e.type = 'purchase';
```

#### JSON_TABLE (PostgreSQL 17+, MySQL 8.0+)

```sql
-- Convert JSON array to relational rows (SQL standard)
SELECT e.id, jt.*
FROM events e,
     JSON_TABLE(
         e.payload, '$.items[*]'
         COLUMNS (
             item_index FOR ORDINALITY,
             sku        VARCHAR(50) PATH '$.sku',
             quantity   INTEGER     PATH '$.qty',
             price      DECIMAL     PATH '$.price' DEFAULT '0' ON EMPTY
         )
     ) AS jt
WHERE e.type = 'purchase';
```

#### JSONB vs JSON Comparison

| Feature | `JSON` | `JSONB` |
|---------|--------|---------|
| Storage | Text (as-is) | Binary decomposed |
| Insert speed | Faster (no parsing) | Slower (parse + decompose) |
| Query speed | Slower (re-parse each query) | Much faster |
| Indexing | Not supported | GIN, B-tree on expressions |
| Key ordering | Preserved | Not preserved |
| Duplicate keys | Allowed | Last value wins |
| Operators | Basic | Full (@>, ?, path) |
| **Recommendation** | Never use | Always use |

---

### Full-Text Search

#### PostgreSQL Full-Text Search

```sql
-- tsvector: preprocessed document (stems, positions, stop words removed)
SELECT to_tsvector('english', 'The quick brown foxes jumped over the lazy dogs');
-- Result: 'brown':3 'dog':9 'fox':4 'jump':5 'lazi':8 'quick':2

-- tsquery: search query
SELECT to_tsquery('english', 'quick & brown');       -- AND
SELECT to_tsquery('english', 'quick | fast');         -- OR
SELECT to_tsquery('english', '!slow');                -- NOT
SELECT to_tsquery('english', 'jump <-> over');        -- FOLLOWED BY
SELECT plainto_tsquery('english', 'quick brown fox'); -- simple text → AND query
SELECT websearch_to_tsquery('english', '"quick brown" OR fox -lazy'); -- web-style search

-- Basic full-text search
SELECT title, body
FROM articles
WHERE to_tsvector('english', title || ' ' || body) @@ to_tsquery('english', 'database & optimization');

-- Stored tsvector column (generated column — PostgreSQL 12+)
ALTER TABLE articles ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(body, '')), 'B')
    ) STORED;

-- GIN index on search vector
CREATE INDEX idx_articles_search ON articles USING GIN (search_vector);

-- Weighted search with ranking
SELECT
    title,
    ts_rank(search_vector, query) AS rank,
    ts_headline('english', body, query,
        'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
    ) AS snippet
FROM articles,
     to_tsquery('english', 'database & performance') AS query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 20;

-- Search with phrase matching
SELECT * FROM articles
WHERE search_vector @@ phraseto_tsquery('english', 'connection pooling');

-- Trigram similarity for fuzzy matching (typo tolerance)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);

SELECT name, similarity(name, 'postgresql') AS sim
FROM products
WHERE name % 'postgresql'    -- similarity > threshold (default 0.3)
ORDER BY sim DESC;

-- Combined: full-text search + trigram fallback
SELECT id, title, ts_rank(search_vector, query) AS rank
FROM articles, to_tsquery('english', 'databse') AS query  -- typo
WHERE search_vector @@ query
UNION ALL
SELECT id, title, similarity(title, 'databse') AS rank
FROM articles
WHERE title % 'databse'
ORDER BY rank DESC
LIMIT 10;
```

#### MySQL Full-Text Search

```sql
-- Create FULLTEXT index
ALTER TABLE articles ADD FULLTEXT INDEX ft_articles (title, body);

-- Natural language mode (default)
SELECT title, MATCH(title, body) AGAINST('database optimization') AS score
FROM articles
WHERE MATCH(title, body) AGAINST('database optimization')
ORDER BY score DESC;

-- Boolean mode (AND, OR, NOT, phrase)
SELECT * FROM articles
WHERE MATCH(title, body) AGAINST('+database +optimization -mysql' IN BOOLEAN MODE);

-- Query expansion mode (finds related terms)
SELECT * FROM articles
WHERE MATCH(title, body) AGAINST('database' WITH QUERY EXPANSION);
```

---

### Stored Procedures & Functions

```sql
-- PostgreSQL: PL/pgSQL function (returns a value)
CREATE OR REPLACE FUNCTION calculate_order_total(p_order_id INTEGER)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_subtotal DECIMAL(10,2);
    v_tax_rate DECIMAL(5,4) := 0.08;
    v_discount DECIMAL(10,2) := 0;
BEGIN
    SELECT SUM(quantity * unit_price)
    INTO v_subtotal
    FROM order_items
    WHERE order_id = p_order_id;

    IF v_subtotal IS NULL THEN
        RAISE EXCEPTION 'Order % not found or has no items', p_order_id;
    END IF;

    IF v_subtotal > 100 THEN
        v_discount := v_subtotal * 0.10;  -- 10% discount over $100
    END IF;

    RETURN (v_subtotal - v_discount) * (1 + v_tax_rate);
END;
$$ LANGUAGE plpgsql;

SELECT calculate_order_total(42);

-- Function returning a table (set-returning function)
CREATE OR REPLACE FUNCTION get_customer_summary(p_customer_id INTEGER)
RETURNS TABLE (
    total_orders   BIGINT,
    total_spent    DECIMAL(10,2),
    avg_order      DECIMAL(10,2),
    last_order_at  TIMESTAMPTZ,
    favorite_category VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(o.id),
        COALESCE(SUM(o.total), 0),
        COALESCE(AVG(o.total), 0),
        MAX(o.created_at),
        (SELECT c.name
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         JOIN categories c ON c.id = p.category_id
         JOIN orders o2 ON o2.id = oi.order_id
         WHERE o2.customer_id = p_customer_id
         GROUP BY c.name
         ORDER BY COUNT(*) DESC
         LIMIT 1)
    FROM orders o
    WHERE o.customer_id = p_customer_id;
END;
$$ LANGUAGE plpgsql STABLE;

SELECT * FROM get_customer_summary(42);

-- PostgreSQL: Procedure (no return value, can manage transactions)
CREATE OR REPLACE PROCEDURE transfer_funds(
    p_from_account INTEGER,
    p_to_account   INTEGER,
    p_amount       DECIMAL(10,2)
)
LANGUAGE plpgsql AS $$
DECLARE
    v_balance DECIMAL(10,2);
BEGIN
    -- Lock both accounts in consistent order to prevent deadlock
    SELECT balance INTO v_balance
    FROM accounts
    WHERE id = LEAST(p_from_account, p_to_account)
    FOR UPDATE;

    SELECT balance INTO v_balance
    FROM accounts
    WHERE id = GREATEST(p_from_account, p_to_account)
    FOR UPDATE;

    -- Check sufficient funds
    SELECT balance INTO v_balance FROM accounts WHERE id = p_from_account;
    IF v_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient funds: balance=%, amount=%', v_balance, p_amount;
    END IF;

    -- Execute transfer
    UPDATE accounts SET balance = balance - p_amount WHERE id = p_from_account;
    UPDATE accounts SET balance = balance + p_amount WHERE id = p_to_account;

    -- Audit log
    INSERT INTO transfers (from_account, to_account, amount, transferred_at)
    VALUES (p_from_account, p_to_account, p_amount, NOW());

    COMMIT;
END;
$$;

CALL transfer_funds(1, 2, 500.00);
```

**Function vs Procedure:**

| Feature | Function | Procedure |
|---------|----------|-----------|
| Returns value | Yes (RETURNS) | No |
| Transaction control | No (runs inside caller's TX) | Yes (COMMIT/ROLLBACK inside) |
| Called with | SELECT func() | CALL proc() |
| Used in expressions | Yes (WHERE, SELECT) | No |
| Best for | Calculations, data retrieval | Multi-step operations, batch jobs |

---

### Array Operations (PostgreSQL)

```sql
-- Array column and operations
CREATE TABLE users (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(100) NOT NULL,
    roles TEXT[] NOT NULL DEFAULT '{}',
    scores INTEGER[]
);

INSERT INTO users (name, roles, scores) VALUES
    ('Alice', ARRAY['admin', 'editor'], ARRAY[95, 88, 92]),
    ('Bob', ARRAY['viewer'], ARRAY[72, 68, 80]),
    ('Carol', ARRAY['editor', 'moderator'], ARRAY[85, 90, 78]);

-- Array operators
SELECT * FROM users WHERE 'admin' = ANY(roles);      -- contains element
SELECT * FROM users WHERE roles @> ARRAY['editor'];   -- contains all
SELECT * FROM users WHERE roles && ARRAY['admin', 'moderator']; -- overlap (any match)
SELECT * FROM users WHERE array_length(roles, 1) > 1; -- array length

-- Array functions
SELECT
    name,
    array_length(scores, 1) AS num_scores,
    array_to_string(roles, ', ') AS roles_str,
    (SELECT AVG(s) FROM unnest(scores) s) AS avg_score
FROM users;

-- Unnest: expand array to rows
SELECT u.name, role
FROM users u, unnest(u.roles) AS role;

-- Array aggregation
SELECT department, ARRAY_AGG(name ORDER BY name) AS members
FROM employees
GROUP BY department;

-- GIN index for array containment queries
CREATE INDEX idx_users_roles ON users USING GIN (roles);
```

---

### Common Table Expressions — Advanced Patterns

```sql
-- Recursive CTE: generate date series (gap-free reporting)
WITH RECURSIVE date_series AS (
    SELECT DATE '2024-01-01' AS date
    UNION ALL
    SELECT date + INTERVAL '1 day'
    FROM date_series
    WHERE date < DATE '2024-12-31'
)
SELECT ds.date, COALESCE(SUM(o.total), 0) AS daily_revenue
FROM date_series ds
LEFT JOIN orders o ON o.created_at::date = ds.date
GROUP BY ds.date
ORDER BY ds.date;

-- Recursive CTE: bill of materials (product assembly tree)
WITH RECURSIVE bom AS (
    -- Base: top-level assembly
    SELECT component_id, component_name, quantity, 1 AS level,
           ARRAY[component_name] AS path
    FROM bill_of_materials
    WHERE assembly_id = 100  -- top-level product

    UNION ALL

    -- Recursive: sub-components
    SELECT b.component_id, b.component_name,
           b.quantity * bom.quantity AS quantity,  -- multiply quantities down
           bom.level + 1,
           bom.path || b.component_name
    FROM bill_of_materials b
    JOIN bom ON bom.component_id = b.assembly_id
    WHERE bom.level < 20  -- depth limit
)
SELECT level, component_name, quantity, array_to_string(path, ' → ') AS assembly_path
FROM bom
ORDER BY path;

-- CTE with INSERT (data pipeline)
WITH new_customers AS (
    INSERT INTO customers (email, name, source)
    SELECT email, name, 'import'
    FROM staging_customers
    WHERE email NOT IN (SELECT email FROM customers)
    RETURNING id, email, name
),
welcome_emails AS (
    INSERT INTO email_queue (customer_id, template, status)
    SELECT id, 'welcome', 'pending'
    FROM new_customers
    RETURNING customer_id
)
SELECT COUNT(*) AS imported FROM new_customers;

-- CTE for pagination with total count
WITH filtered AS (
    SELECT * FROM products
    WHERE category_id = 5 AND price > 10
),
counted AS (
    SELECT COUNT(*) AS total FROM filtered
)
SELECT f.*, c.total
FROM filtered f, counted c
ORDER BY f.created_at DESC
LIMIT 20 OFFSET 0;
```

---

### Conditional Expressions & Pattern Matching

```sql
-- CASE expressions
SELECT
    name,
    price,
    CASE
        WHEN price < 10 THEN 'budget'
        WHEN price < 50 THEN 'mid-range'
        WHEN price < 200 THEN 'premium'
        ELSE 'luxury'
    END AS tier,
    CASE status
        WHEN 'active' THEN 'Available'
        WHEN 'draft' THEN 'Coming Soon'
        WHEN 'archived' THEN 'Discontinued'
    END AS display_status
FROM products;

-- COALESCE: first non-null value
SELECT COALESCE(nickname, first_name, email) AS display_name FROM users;

-- NULLIF: return NULL if values are equal (avoid division by zero)
SELECT total / NULLIF(count, 0) AS average FROM stats;

-- GREATEST / LEAST
SELECT GREATEST(price, min_price) AS effective_price FROM products;
SELECT LEAST(requested_qty, stock) AS fulfillable_qty FROM order_requests;

-- FILTER clause for conditional aggregation (PostgreSQL)
SELECT
    date_trunc('month', created_at) AS month,
    COUNT(*) AS total_orders,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'refunded') AS refunded,
    SUM(total) FILTER (WHERE status = 'completed') AS revenue
FROM orders
GROUP BY 1
ORDER BY 1;

-- Regular expressions (PostgreSQL)
SELECT * FROM users WHERE email ~ '^[a-z]+@company\.com$';     -- case-sensitive regex match
SELECT * FROM users WHERE email ~* '^admin@';                    -- case-insensitive
SELECT regexp_matches('2024-06-15', '(\d{4})-(\d{2})-(\d{2})'); -- extract groups
SELECT regexp_replace('Hello   World', '\s+', ' ', 'g');         -- replace pattern

-- SIMILAR TO (SQL standard regex, between LIKE and full regex)
SELECT * FROM products WHERE sku SIMILAR TO '[A-Z]{3}-[0-9]{3}';
```

---

### Dynamic SQL & EXECUTE

```sql
-- PostgreSQL: dynamic SQL in PL/pgSQL
CREATE OR REPLACE FUNCTION search_table(
    p_table   TEXT,
    p_column  TEXT,
    p_value   TEXT
) RETURNS SETOF RECORD AS $$
BEGIN
    -- NEVER concatenate user input directly (SQL injection)
    -- Use format() with %I for identifiers and %L for literals
    RETURN QUERY EXECUTE format(
        'SELECT * FROM %I WHERE %I = %L',
        p_table, p_column, p_value
    );
END;
$$ LANGUAGE plpgsql;

-- Dynamic pivot table
CREATE OR REPLACE FUNCTION generate_sales_pivot(p_year INTEGER)
RETURNS TEXT AS $$
DECLARE
    v_sql TEXT;
    v_months TEXT;
BEGIN
    SELECT string_agg(
        format('SUM(CASE WHEN month = %L THEN revenue END) AS %I',
               m, 'month_' || m),
        ', '
    )
    INTO v_months
    FROM generate_series(1, 12) AS m;

    v_sql := format(
        'SELECT product_id, %s FROM monthly_sales WHERE year = %s GROUP BY product_id',
        v_months, p_year
    );

    RETURN v_sql;
END;
$$ LANGUAGE plpgsql;

-- Prepared statements (application-level parameterized queries)
-- PostgreSQL protocol-level prepared statements:
PREPARE get_user(INTEGER) AS
    SELECT id, name, email FROM users WHERE id = $1;

EXECUTE get_user(42);

DEALLOCATE get_user;
```

**Security rule:** NEVER use string concatenation for dynamic SQL with user input. Always use parameterized queries or `format('%I', identifier)` / `format('%L', literal)` for escaping.

---

### Set Operations

```sql
-- UNION: combine results, remove duplicates
SELECT email FROM customers
UNION
SELECT email FROM newsletter_subscribers;

-- UNION ALL: combine results, keep duplicates (faster — no dedup sort)
SELECT id, 'order' AS source, total AS amount, created_at FROM orders
UNION ALL
SELECT id, 'refund' AS source, -amount AS amount, created_at FROM refunds
ORDER BY created_at;

-- INTERSECT: rows in both queries
SELECT email FROM customers
INTERSECT
SELECT email FROM newsletter_subscribers;
-- Customers who are also newsletter subscribers

-- EXCEPT: rows in first but not second
SELECT email FROM newsletter_subscribers
EXCEPT
SELECT email FROM unsubscribed;
-- Active newsletter subscribers
```

---

### Materialized Views & Refresh Strategies

```sql
-- Materialized view: precomputed query results stored on disk
CREATE MATERIALIZED VIEW mv_product_stats AS
SELECT
    p.id AS product_id,
    p.name,
    p.category_id,
    COUNT(oi.id) AS total_orders,
    SUM(oi.quantity) AS total_units_sold,
    SUM(oi.quantity * oi.unit_price) AS total_revenue,
    AVG(r.rating) AS avg_rating,
    COUNT(DISTINCT r.id) AS review_count
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN reviews r ON r.product_id = p.id
GROUP BY p.id, p.name, p.category_id
WITH DATA;  -- populate immediately (WITH NO DATA to defer)

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_mv_product_stats_id ON mv_product_stats(product_id);
CREATE INDEX idx_mv_product_stats_category ON mv_product_stats(category_id);

-- Refresh strategies
REFRESH MATERIALIZED VIEW mv_product_stats;               -- blocks reads
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_stats;  -- no blocking (requires unique index)

-- Scheduled refresh (pg_cron extension)
SELECT cron.schedule('refresh-product-stats', '*/15 * * * *',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_stats');
```

```go
// Go — materialized view refresh with monitoring
func RefreshMaterializedView(ctx context.Context, db *sql.DB, viewName string) error {
    start := time.Now()

    _, err := db.ExecContext(ctx, fmt.Sprintf(
        "REFRESH MATERIALIZED VIEW CONCURRENTLY %s",
        pgx.Identifier{viewName}.Sanitize(),
    ))
    if err != nil {
        return fmt.Errorf("refresh %s failed: %w", viewName, err)
    }

    duration := time.Since(start)
    log.Printf("Refreshed %s in %s", viewName, duration)

    // Alert if refresh takes too long
    if duration > 30*time.Second {
        log.Printf("WARNING: %s refresh exceeded 30s threshold", viewName)
    }

    return nil
}
```

---

### Table Partitioning

```sql
-- PostgreSQL declarative partitioning (10+)
-- Range partitioning: time-series data
CREATE TABLE events (
    id         BIGSERIAL,
    event_type VARCHAR(50) NOT NULL,
    payload    JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE events_2024_q1 PARTITION OF events
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
CREATE TABLE events_2024_q2 PARTITION OF events
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');
CREATE TABLE events_2024_q3 PARTITION OF events
    FOR VALUES FROM ('2024-07-01') TO ('2024-10-01');
CREATE TABLE events_2024_q4 PARTITION OF events
    FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');

-- Default partition (catches unmatched rows)
CREATE TABLE events_default PARTITION OF events DEFAULT;

-- List partitioning: by category
CREATE TABLE orders (
    id      BIGSERIAL,
    region  VARCHAR(20) NOT NULL,
    total   DECIMAL(10,2),
    status  VARCHAR(20)
) PARTITION BY LIST (region);

CREATE TABLE orders_us PARTITION OF orders FOR VALUES IN ('us-east', 'us-west');
CREATE TABLE orders_eu PARTITION OF orders FOR VALUES IN ('eu-west', 'eu-central');
CREATE TABLE orders_asia PARTITION OF orders FOR VALUES IN ('asia-east', 'asia-south');

-- Hash partitioning: even distribution
CREATE TABLE sessions (
    id      UUID NOT NULL,
    user_id INTEGER NOT NULL,
    data    JSONB
) PARTITION BY HASH (user_id);

CREATE TABLE sessions_p0 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE sessions_p1 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE sessions_p2 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE sessions_p3 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- Partition maintenance
-- Detach old partition (instant, no data movement)
ALTER TABLE events DETACH PARTITION events_2024_q1;

-- Drop old data (instant — drop entire partition instead of DELETE)
DROP TABLE events_2024_q1;

-- Attach existing table as partition
ALTER TABLE events ATTACH PARTITION events_2024_q1
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

-- Auto-create partitions (pg_partman extension)
CREATE EXTENSION IF NOT EXISTS pg_partman;
SELECT partman.create_parent(
    p_parent_table := 'public.events',
    p_control := 'created_at',
    p_type := 'range',
    p_interval := '1 month',
    p_premake := 3  -- create 3 future partitions
);
```

**Partitioning comparison:**

| Strategy | Use Case | Key Advantage |
|----------|----------|---------------|
| **Range** | Time-series, logs, events | Fast partition pruning by date range |
| **List** | Region, category, tenant | Logical data separation |
| **Hash** | Even distribution, no natural range | Uniform partition sizes |

---

## Best Practices

1. **ALWAYS use UPSERT (ON CONFLICT) over SELECT-then-INSERT** — atomic, no race conditions
2. **ALWAYS use LATERAL JOIN for top-N per group** — cleaner than window function workaround
3. **ALWAYS use JSONB over JSON** in PostgreSQL — better performance, indexing, operators
4. **ALWAYS use GIN indexes on JSONB and array columns** — enables containment queries
5. **ALWAYS use generated tsvector columns with GIN indexes** for full-text search — avoid per-query to_tsvector()
6. **ALWAYS use parameterized queries** — never concatenate user input into SQL strings
7. **ALWAYS use format('%I', identifier)** for dynamic SQL in PL/pgSQL — prevents SQL injection
8. **ALWAYS use UNION ALL over UNION** when duplicates are not possible — avoids unnecessary sort
9. **ALWAYS use CONCURRENTLY when refreshing materialized views** in production — prevents read blocking
10. **NEVER use stored procedures for business logic** — use for database-level operations (transfers, cleanup, ETL)

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| SELECT-then-INSERT race condition | Duplicate key errors under concurrency | Use INSERT ... ON CONFLICT |
| JSON column without GIN index | Full table scan on JSON queries | CREATE INDEX USING GIN |
| Using JSON instead of JSONB | Cannot index, slow queries | Always use JSONB |
| to_tsvector() in WHERE without index | Full table scan per search query | Use generated column + GIN index |
| String concatenation in dynamic SQL | SQL injection vulnerability | Use format('%I', '%L') or parameterized queries |
| No depth limit on recursive CTE | Infinite loop, OOM | Add WHERE depth < N |
| UNION when UNION ALL suffices | Unnecessary sort/dedup overhead | Use UNION ALL for disjoint sets |
| Materialized view without CONCURRENTLY | Blocks all reads during refresh | Add unique index, use CONCURRENTLY |
| Storing arrays in TEXT columns | Cannot query, no type safety | Use proper array types (TEXT[], INT[]) |
| No partition pruning awareness | Queries scan all partitions | Always include partition key in WHERE |

---

## Real-world Examples

### Shopify
- JSONB for product metafields (merchant-defined custom attributes)
- Full-text search with tsvector for product catalog search
- Partitioned tables for order event logs (billions of rows, range by date)
- UPSERT for inventory level updates (concurrent stock changes)

### GitHub
- LATERAL JOIN for top-N recent activities per repository
- Materialized views for contribution statistics and heatmaps
- Recursive CTEs for fork tree traversal
- JSONB for flexible webhook payload storage

### Stripe
- Table partitioning by created_at for transaction history (multi-year retention)
- Stored procedures for balance transfer operations (atomicity critical)
- Full-text search for payment description and metadata queries
- MERGE operations for reconciliation with external payment processors

---

## Enforcement Checklist

- [ ] UPSERT used instead of SELECT-then-INSERT for idempotent operations
- [ ] LATERAL JOIN used for top-N per group queries
- [ ] JSONB used (never JSON) with appropriate GIN indexes
- [ ] Full-text search uses generated tsvector column with GIN index
- [ ] All dynamic SQL uses parameterized queries or format('%I'/'%L')
- [ ] Recursive CTEs have depth limits
- [ ] Materialized views refreshed with CONCURRENTLY (unique index present)
- [ ] Table partitioning used for tables exceeding 100M rows
- [ ] Partition key included in all queries for partition pruning
- [ ] UNION ALL used instead of UNION when duplicates impossible
- [ ] Stored procedures limited to database-level operations (not business logic)
- [ ] Array and JSONB columns have GIN indexes for containment queries
