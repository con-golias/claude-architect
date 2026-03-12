# Database Relationships

> **Domain:** Database > Data Modeling
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Relationships are the backbone of relational database design. Every real-world domain has entities connected to other entities — users have orders, orders have items, items belong to categories. Modeling these relationships correctly with foreign keys, junction tables, and proper constraints determines whether your database maintains integrity or silently allows orphaned records, duplicate relationships, and corrupted data. Getting relationships wrong leads to bugs that are expensive to fix after the schema is in production.

---

## How It Works

### Relationship Types Overview

```
┌──────────────────────────────────────────────────────────┐
│              RELATIONSHIP TYPES                           │
│                                                           │
│  One-to-One (1:1)     One-to-Many (1:N)                 │
│  ┌────┐    ┌────┐     ┌────┐    ┌────┐                  │
│  │ A  │────│ B  │     │ A  │────│ B  │                  │
│  └────┘    └────┘     └────┘  ┌─│ B  │                  │
│  user ── profile      user  ──┤ │ B  │                  │
│                               └─└────┘                   │
│                       user ── orders                     │
│                                                           │
│  Many-to-Many (M:N)   Self-Referential                  │
│  ┌────┐    ┌────┐     ┌────┐                             │
│  │ A  │─┬──│ B  │     │ A  │──┐                          │
│  │ A  │─┤  │ B  │     │ A  │──┤ (parent/child)          │
│  │ A  │─┘  │ B  │     │ A  │──┘                          │
│  └────┘    └────┘     └────┘                             │
│  students ── courses  employees ── manager               │
└──────────────────────────────────────────────────────────┘
```

---

### One-to-One (1:1)

Each record in Table A relates to exactly one record in Table B.

```sql
-- Example: User has exactly one profile
CREATE TABLE users (
    id       SERIAL PRIMARY KEY,
    email    VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE user_profiles (
    user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100),
    avatar_url   TEXT,
    bio          TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
-- user_id is both PK and FK → enforces 1:1
```

**When to use 1:1:**
- Separating rarely-accessed data from frequently-accessed data (split wide tables)
- Isolating sensitive data (passwords, SSN in separate table with stricter access)
- Optional extensions (not every user has a profile)
- Subtype tables (vehicles → cars / trucks with type-specific columns)

**1:1 enforcement options:**

| Method | How | Guarantee |
|--------|-----|-----------|
| FK as PK | `user_id INTEGER PRIMARY KEY REFERENCES users(id)` | Perfect 1:1 |
| UNIQUE FK | `user_id INTEGER UNIQUE REFERENCES users(id)` | At most 1 (allows null) |
| Check constraint | Application-level | Weaker, can have bugs |

---

### One-to-Many (1:N)

Each record in Table A relates to zero or more records in Table B.

```sql
-- Example: User has many orders
CREATE TABLE orders (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total       DECIMAL(10,2) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index on the FK column — ALWAYS
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

**FK constraint actions:**

```sql
-- ON DELETE options:
REFERENCES users(id) ON DELETE CASCADE     -- delete orders when user deleted
REFERENCES users(id) ON DELETE RESTRICT    -- prevent user deletion if orders exist
REFERENCES users(id) ON DELETE SET NULL    -- set user_id = NULL on orders
REFERENCES users(id) ON DELETE SET DEFAULT -- set user_id to default value
REFERENCES users(id) ON DELETE NO ACTION   -- same as RESTRICT (default)

-- ON UPDATE options (rarely needed with surrogate keys):
REFERENCES users(id) ON UPDATE CASCADE     -- update FK when PK changes
```

**Which ON DELETE to use:**

| Action | When |
|--------|------|
| `CASCADE` | Child cannot exist without parent (order_items → order) |
| `RESTRICT` | Parent should not be deleted if children exist (user → orders) |
| `SET NULL` | Child is valid without parent (comment.user_id when user deletes account) |
| `NO ACTION` | Same as RESTRICT, but checked at end of transaction |

---

### Many-to-Many (M:N)

Each record in A relates to many in B, and vice versa. Requires a junction table.

```sql
-- Example: Students enrolled in courses
CREATE TABLE students (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(100) NOT NULL
);

CREATE TABLE courses (
    id    SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL
);

-- Junction table (also called: join table, association table, bridge table)
CREATE TABLE enrollments (
    student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    grade       VARCHAR(2),
    PRIMARY KEY (student_id, course_id)
);

-- Indexes for both directions of the relationship
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
-- student_id already indexed by being first column in composite PK
```

**Junction table with extra attributes:**

```sql
-- When the relationship itself has data
CREATE TABLE order_items (
    id          SERIAL PRIMARY KEY,  -- surrogate PK (allows duplicates)
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    unit_price  DECIMAL(10,2) NOT NULL,  -- price at time of order
    discount    DECIMAL(5,2) DEFAULT 0,
    UNIQUE (order_id, product_id)  -- or allow same product twice with different options
);
```

---

### Self-Referential Relationships

A table references itself — common for hierarchies and trees.

```sql
-- Example: Employee → Manager hierarchy
CREATE TABLE employees (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    manager_id  INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    department  VARCHAR(50)
);

CREATE INDEX idx_employees_manager ON employees(manager_id);

-- Find direct reports
SELECT * FROM employees WHERE manager_id = 5;

-- Find all ancestors (recursive CTE)
WITH RECURSIVE management_chain AS (
    -- Base case: start with the employee
    SELECT id, name, manager_id, 0 AS depth
    FROM employees
    WHERE id = 42

    UNION ALL

    -- Recursive case: walk up to manager
    SELECT e.id, e.name, e.manager_id, mc.depth + 1
    FROM employees e
    JOIN management_chain mc ON e.id = mc.manager_id
)
SELECT * FROM management_chain ORDER BY depth;
```

```sql
-- Example: Category tree (e-commerce)
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    parent_id   INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    sort_order  INTEGER DEFAULT 0
);

-- Alternative: Materialized Path (for faster reads)
CREATE TABLE categories_mp (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(100) NOT NULL,
    path  TEXT NOT NULL  -- e.g., '/1/5/12/' (ancestor IDs)
);

-- Find all descendants of category 5:
SELECT * FROM categories_mp WHERE path LIKE '/5/%';

-- Alternative: ltree extension (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS ltree;

CREATE TABLE categories_ltree (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(100) NOT NULL,
    path  ltree NOT NULL
);

CREATE INDEX idx_categories_path ON categories_ltree USING GIST (path);

-- Find all children of 'electronics.phones':
SELECT * FROM categories_ltree WHERE path <@ 'electronics.phones';
```

**Tree storage strategies:**

| Strategy | Reads | Writes | Moving Nodes | Best For |
|----------|-------|--------|-------------|----------|
| **Adjacency List** (parent_id FK) | Recursive CTE needed | Simple INSERT | Easy | Small trees, frequent writes |
| **Materialized Path** (`/1/5/12/`) | Fast LIKE query | Update all descendants | Hard (rename paths) | Read-heavy, deep trees |
| **Nested Sets** (lft/rgt integers) | Fast range query | Recalculate entire tree | Very hard | Read-only trees (categories) |
| **Closure Table** (ancestor/descendant pairs) | Fast any-depth query | Insert O(depth) rows | Moderate | Any-depth queries needed |
| **ltree** (PostgreSQL extension) | Fast with GiST index | Simple | Moderate | PostgreSQL-only, flexible |

---

### Polymorphic Relationships

One table references different types of parent tables.

```sql
-- OPTION A: Polymorphic FK (application-enforced, no DB constraint)
CREATE TABLE comments (
    id              SERIAL PRIMARY KEY,
    commentable_type VARCHAR(50) NOT NULL,  -- 'Post', 'Article', 'Video'
    commentable_id   INTEGER NOT NULL,
    body            TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- WARNING: No FK constraint possible — DB cannot enforce integrity
CREATE INDEX idx_comments_poly ON comments(commentable_type, commentable_id);

-- OPTION B: Separate FK columns (nullable — DB enforced)
CREATE TABLE comments (
    id          SERIAL PRIMARY KEY,
    post_id     INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    article_id  INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    video_id    INTEGER REFERENCES videos(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    -- Exactly one FK must be set
    CHECK (
        (post_id IS NOT NULL)::int +
        (article_id IS NOT NULL)::int +
        (video_id IS NOT NULL)::int = 1
    )
);

-- OPTION C: Shared parent table (best for DB integrity)
CREATE TABLE commentable_items (
    id    SERIAL PRIMARY KEY,
    type  VARCHAR(50) NOT NULL
);

CREATE TABLE posts (
    id   INTEGER PRIMARY KEY REFERENCES commentable_items(id),
    title TEXT
);

CREATE TABLE comments (
    id              SERIAL PRIMARY KEY,
    commentable_id  INTEGER NOT NULL REFERENCES commentable_items(id) ON DELETE CASCADE,
    body            TEXT NOT NULL
);
```

**Recommendation:** Option B (separate nullable FKs) for small number of types. Option C (shared parent) for extensible systems. Avoid Option A in production — no referential integrity.

---

## Best Practices

1. **ALWAYS create an index on foreign key columns** — without it, JOINs and cascading deletes scan entire tables
2. **ALWAYS use ON DELETE CASCADE for true child records** (order_items when order is deleted)
3. **ALWAYS use ON DELETE RESTRICT for business-critical references** (prevent deleting user with orders)
4. **ALWAYS use junction tables for M:N relationships** — never store comma-separated IDs
5. **ALWAYS name foreign key columns clearly** — `user_id`, `manager_id`, not just `id` or `ref`
6. **ALWAYS use surrogate keys (SERIAL/UUID) for junction tables with attributes**
7. **NEVER use polymorphic FKs (type + id) without careful consideration** — they break referential integrity
8. **NEVER store parent IDs in arrays or JSON** for relational data — use proper tables
9. **ALWAYS add NOT NULL to required FK columns** — nullable FKs mean optional relationships
10. **ALWAYS prefer ltree or closure table** over nested sets for trees that change

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No index on FK column | Slow JOINs, slow cascading deletes | CREATE INDEX on every FK column |
| Comma-separated IDs | Cannot JOIN, no constraints, no integrity | Use junction table for M:N |
| Missing ON DELETE action | Orphaned records after parent deletion | Choose CASCADE, RESTRICT, or SET NULL |
| Polymorphic FK without constraints | Orphaned comments pointing to deleted posts | Use separate nullable FKs or shared parent table |
| Circular foreign keys | Cannot INSERT into either table | Use deferred constraints or nullable FKs |
| Recursive CTE without depth limit | Infinite loop on cyclic data | Add `WHERE depth < 100` to recursive CTE |
| FK to non-indexed column | Slow constraint checking | FK target must be PRIMARY KEY or UNIQUE |
| ON DELETE CASCADE everywhere | Deleting one user wipes all related data | Use RESTRICT for business-critical data |

---

## Real-world Examples

### GitHub
- Users → Repositories (1:N with ON DELETE RESTRICT)
- Repositories → Branches → Commits (1:N chain)
- Pull Requests → Reviews → Comments (nested 1:N)
- Users ↔ Repositories (M:N via stars, watchers — junction tables)
- Issues → Labels (M:N junction table)

### Shopify
- Products → Variants (1:N)
- Products ↔ Collections (M:N junction)
- Categories (self-referential tree with materialized path)
- Orders → Line Items → Products (1:N chains with historical snapshots)

### Reddit
- Comments (self-referential tree: parent_comment_id)
- Users ↔ Subreddits (M:N junction for subscriptions)
- Posts → Comments (1:N)
- Polymorphic votes (upvote/downvote on posts AND comments)

---

## Enforcement Checklist

- [ ] Every FK column has a corresponding index
- [ ] ON DELETE action specified for every FK (not relying on default NO ACTION)
- [ ] M:N relationships use junction tables (no comma-separated IDs)
- [ ] Self-referential tables use recursive CTE or extension (ltree) for tree queries
- [ ] Polymorphic relationships use separate nullable FKs or shared parent table
- [ ] FK naming convention followed (table_name_id or entity_id)
- [ ] NOT NULL on required FK columns (optional relationships use nullable)
- [ ] Tree depth limits set in recursive queries
