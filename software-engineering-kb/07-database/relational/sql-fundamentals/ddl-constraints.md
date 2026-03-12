# DDL, Constraints & Schema Objects

> **Domain:** Database > Relational > SQL Fundamentals
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Data Definition Language (DDL) defines your database structure — tables, columns, constraints, indexes, views. Constraints are your last line of defense against invalid data: they enforce rules at the database level regardless of which application, script, or admin tool writes data. A NOT NULL constraint prevents null emails. A CHECK constraint prevents negative prices. A foreign key prevents orphaned records. Without constraints, data integrity depends entirely on application code — and application code has bugs.

---

## How It Works

### Table Creation

```sql
-- Complete table definition with all constraint types
CREATE TABLE products (
    -- Column constraints
    id              BIGSERIAL PRIMARY KEY,                       -- auto-increment PK
    sku             VARCHAR(50) NOT NULL UNIQUE,                  -- required, unique
    name            VARCHAR(200) NOT NULL,
    description     TEXT,                                         -- nullable (optional)
    price           DECIMAL(10,2) NOT NULL CHECK (price >= 0),   -- non-negative
    compare_price   DECIMAL(10,2) CHECK (compare_price >= price),-- must be >= price
    stock           INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    category_id     INTEGER REFERENCES categories(id)
                    ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'archived')),
    weight_kg       DECIMAL(8,3),
    tags            TEXT[] DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Table constraints (span multiple columns)
    CONSTRAINT uq_product_name_category UNIQUE (name, category_id),
    CONSTRAINT chk_compare_price CHECK (compare_price IS NULL OR compare_price >= price)
);

-- Comments for documentation
COMMENT ON TABLE products IS 'Product catalog';
COMMENT ON COLUMN products.sku IS 'Stock Keeping Unit - unique product identifier';
COMMENT ON COLUMN products.compare_price IS 'Original price shown as strikethrough';
```

### Column Types Reference

| Category | Type | Use Case | Example |
|----------|------|----------|---------|
| **Integer** | `SMALLINT` | Small numbers (±32K) | Age, quantity |
| | `INTEGER` | Standard numbers (±2B) | IDs, counts |
| | `BIGINT` | Large numbers (±9.2×10¹⁸) | Timestamps, large IDs |
| | `SERIAL/BIGSERIAL` | Auto-increment | Primary keys |
| **Decimal** | `DECIMAL(p,s)` | Exact precision | Money (DECIMAL(10,2)) |
| | `REAL/DOUBLE` | Approximate | Scientific calculations |
| **String** | `VARCHAR(n)` | Variable-length with limit | Name, email |
| | `TEXT` | Unlimited text | Description, body |
| | `CHAR(n)` | Fixed-length | Country code ('US') |
| **Boolean** | `BOOLEAN` | True/false | is_active, is_verified |
| **Date/Time** | `TIMESTAMPTZ` | Timestamp with timezone | created_at |
| | `DATE` | Date only | birth_date |
| | `TIME` | Time only | opening_time |
| | `INTERVAL` | Duration | '30 days', '2 hours' |
| **Binary** | `BYTEA` | Binary data | Small files, hashes |
| **UUID** | `UUID` | Universally unique ID | gen_random_uuid() |
| **JSON** | `JSONB` | Structured flexible data | Metadata, settings |
| **Array** | `TEXT[]`, `INT[]` | Lists of values | Tags, categories |
| **Network** | `INET`, `CIDR` | IP addresses | Client IP logging |

---

### Constraint Types

#### PRIMARY KEY

```sql
-- Single column
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY
);

-- Composite primary key
CREATE TABLE order_items (
    order_id   INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    PRIMARY KEY (order_id, product_id)
);
```

#### NOT NULL

```sql
-- Column level
CREATE TABLE users (
    email VARCHAR(255) NOT NULL  -- cannot be NULL
);

-- Add to existing column
ALTER TABLE users ALTER COLUMN name SET NOT NULL;

-- Remove constraint
ALTER TABLE users ALTER COLUMN name DROP NOT NULL;
```

#### UNIQUE

```sql
-- Single column
CREATE TABLE users (
    email VARCHAR(255) NOT NULL UNIQUE
);

-- Multi-column unique (composite)
ALTER TABLE products
ADD CONSTRAINT uq_product_tenant
UNIQUE (tenant_id, sku);

-- Partial unique (PostgreSQL) — unique only for active records
CREATE UNIQUE INDEX uq_users_email_active
ON users(email) WHERE deleted_at IS NULL;
```

#### CHECK

```sql
-- Value constraints
ALTER TABLE products ADD CONSTRAINT chk_positive_price CHECK (price > 0);
ALTER TABLE users ADD CONSTRAINT chk_valid_email CHECK (email LIKE '%@%');
ALTER TABLE orders ADD CONSTRAINT chk_valid_status
    CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled'));

-- Multi-column check
ALTER TABLE events ADD CONSTRAINT chk_date_range
    CHECK (end_date > start_date);

-- PostgreSQL: CHECK with function (custom validation)
CREATE OR REPLACE FUNCTION is_valid_phone(phone TEXT) RETURNS BOOLEAN AS $$
BEGIN
    RETURN phone ~ '^\+[1-9]\d{1,14}$';  -- E.164 format
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE users ADD CONSTRAINT chk_phone CHECK (is_valid_phone(phone));
```

#### FOREIGN KEY

```sql
-- Basic FK
ALTER TABLE orders
ADD CONSTRAINT fk_orders_customer
FOREIGN KEY (customer_id) REFERENCES customers(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Self-referencing FK
ALTER TABLE employees
ADD CONSTRAINT fk_employees_manager
FOREIGN KEY (manager_id) REFERENCES employees(id)
ON DELETE SET NULL;

-- Deferrable FK (checked at COMMIT, not at each statement)
ALTER TABLE table_a
ADD CONSTRAINT fk_circular
FOREIGN KEY (ref_id) REFERENCES table_b(id)
DEFERRABLE INITIALLY DEFERRED;
-- Useful for circular references or bulk loading
```

#### EXCLUSION

```sql
-- PostgreSQL-specific: prevent overlapping ranges
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE reservations (
    id         SERIAL PRIMARY KEY,
    room_id    INTEGER NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time   TIMESTAMPTZ NOT NULL,
    EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    )
);
-- Prevents overlapping bookings for the same room
```

---

### ALTER TABLE Operations

```sql
-- Add column
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- Add column with default (instant in PostgreSQL 11+)
ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Rename column
ALTER TABLE users RENAME COLUMN name TO full_name;

-- Change column type
ALTER TABLE products ALTER COLUMN price TYPE DECIMAL(12,2);

-- Add constraint
ALTER TABLE users ADD CONSTRAINT chk_age CHECK (age >= 0 AND age <= 150);

-- Drop constraint
ALTER TABLE users DROP CONSTRAINT chk_age;

-- Drop column
ALTER TABLE users DROP COLUMN IF EXISTS legacy_field;

-- Rename table
ALTER TABLE users RENAME TO accounts;
```

---

### Views

```sql
-- Regular view (virtual table — query runs every time)
CREATE VIEW active_products AS
SELECT id, name, price, category_id
FROM products
WHERE status = 'active' AND stock > 0;

-- Updatable view (PostgreSQL)
CREATE VIEW my_orders AS
SELECT * FROM orders WHERE user_id = current_user_id();
-- Can INSERT/UPDATE/DELETE through the view (with restrictions)

-- View with security barrier (prevent information leakage)
CREATE VIEW public_users WITH (security_barrier = true) AS
SELECT id, name, avatar_url FROM users WHERE is_public = TRUE;
```

---

### Triggers

```sql
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_timestamp
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Prevent deletion trigger
CREATE OR REPLACE FUNCTION prevent_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Deletion not allowed on table %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_delete();

-- Notification trigger (LISTEN/NOTIFY)
CREATE OR REPLACE FUNCTION notify_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('table_changes',
        json_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'id', COALESCE(NEW.id, OLD.id)
        )::text
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_orders
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_change();
```

---

### Generated Columns

```sql
-- PostgreSQL 12+: computed columns stored on disk
CREATE TABLE products (
    id             SERIAL PRIMARY KEY,
    price          DECIMAL(10,2) NOT NULL,
    tax_rate       DECIMAL(5,4) NOT NULL DEFAULT 0.20,
    price_with_tax DECIMAL(10,2) GENERATED ALWAYS AS (price * (1 + tax_rate)) STORED,
    search_text    TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', name || ' ' || COALESCE(description, ''))
    ) STORED
);

CREATE INDEX idx_products_search ON products USING GIN (search_text);
```

---

## Best Practices

1. **ALWAYS add NOT NULL to required columns** — nullable by default is a common source of bugs
2. **ALWAYS use constraints** — enforce data integrity at the database level, not just application
3. **ALWAYS use TIMESTAMPTZ** (with timezone) instead of TIMESTAMP — avoid timezone bugs
4. **ALWAYS use DECIMAL for money** — never FLOAT/DOUBLE (precision errors)
5. **ALWAYS add created_at and updated_at** to every table with triggers
6. **ALWAYS use CHECK constraints for enum-like values** — prevent typos in status fields
7. **ALWAYS use BIGSERIAL/BIGINT for primary keys** — INTEGER overflows at 2 billion
8. **NEVER use TEXT without length limits** for user input — add CHECK constraint
9. **NEVER use triggers for business logic** — only for cross-cutting concerns (timestamps, audit)
10. **ALWAYS use DEFERRABLE constraints for circular references** or bulk loading

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No NOT NULL on required columns | Null emails, null names in production | Add NOT NULL to all required columns |
| FLOAT for money | $10.00 * 3 = $29.999999999 | Use DECIMAL(10,2) |
| TIMESTAMP without timezone | Time confusion across regions | Use TIMESTAMPTZ |
| No CHECK on status columns | Invalid statuses like 'delvered' | CHECK (status IN (...)) |
| INTEGER for primary key | Key overflow at 2B rows | Use BIGSERIAL |
| Business logic in triggers | Impossible to debug, hidden side effects | Move business logic to application |
| No default on created_at | Application must set it every time | DEFAULT NOW() |
| VARCHAR(255) for everything | Wasted space, no real validation | Choose appropriate sizes, add CHECK |

---

## Real-world Examples

### PostgreSQL Extensions Used in Production
- **pgcrypto** — gen_random_uuid() for UUID primary keys
- **btree_gist** — EXCLUSION constraints for range overlaps (booking systems)
- **pg_trgm** — trigram similarity indexes (fuzzy search)
- **ltree** — hierarchical data (category trees)

### Stripe's Schema Approach
- BIGSERIAL for all primary keys (high-volume inserts)
- NOT NULL on virtually every column (explicit about optional fields)
- CHECK constraints for all status/enum columns
- Generated columns for computed fields (tax calculations)

---

## Enforcement Checklist

- [ ] Every column has appropriate NOT NULL constraint
- [ ] DECIMAL used for all monetary values (never FLOAT)
- [ ] TIMESTAMPTZ used for all timestamps (never TIMESTAMP)
- [ ] CHECK constraints on all status/enum columns
- [ ] BIGSERIAL/BIGINT used for primary keys
- [ ] Foreign keys created for all relationships
- [ ] created_at / updated_at on every table with auto-update trigger
- [ ] EXCLUSION constraints for range-based uniqueness (bookings, schedules)
- [ ] Comments added to tables and non-obvious columns
- [ ] All constraints named explicitly (not auto-generated names)
