# Database Normalization

> **Domain:** Database > Data Modeling
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Normalization eliminates data redundancy and ensures data integrity. Without it, updating a customer's address means updating it in every order row where it appears — miss one and you have inconsistent data. Normalization organizes data so that each fact is stored exactly once. This reduces storage, prevents update anomalies, and enforces referential integrity through foreign keys. Every backend engineer must understand normal forms because they are the foundation of relational schema design — even when you choose to denormalize later, you must know what you are denormalizing from.

---

## How It Works

### Functional Dependencies

The foundation of normalization: a functional dependency X → Y means that the value of X uniquely determines the value of Y.

```
student_id → student_name       (student ID determines student name)
{student_id, course_id} → grade (student + course determines grade)
zip_code → city                 (zip code determines city)
```

### The Normal Forms Progression

```
┌────────────────────────────────────────────────────────────┐
│                NORMALIZATION PROGRESSION                     │
│                                                             │
│  Unnormalized ──► 1NF ──► 2NF ──► 3NF ──► BCNF ──► 4NF   │
│                                                             │
│  Each form INCLUDES all guarantees of the previous form.   │
│                                                             │
│  Most production systems target 3NF or BCNF.              │
│  4NF and 5NF are rarely needed in practice.               │
└────────────────────────────────────────────────────────────┘
```

---

### Unnormalized Form (UNF)

```
┌───────────────────────────────────────────────────────────────┐
│ order_id │ customer │ address        │ items                   │
├───────────────────────────────────────────────────────────────┤
│ 1        │ Alice    │ 123 Main St    │ Widget($10), Gadget($20)│
│ 2        │ Bob      │ 456 Oak Ave    │ Widget($10)             │
│ 3        │ Alice    │ 123 Main St    │ Gadget($20), Tool($15)  │
└───────────────────────────────────────────────────────────────┘

Problems:
- "items" column contains multiple values (not atomic)
- Customer data repeated in every order
- Updating Alice's address requires changing multiple rows
```

---

### First Normal Form (1NF)

**Rule:** Every column contains only atomic (indivisible) values. No repeating groups, no arrays.

```sql
-- Convert to 1NF: one row per item
CREATE TABLE order_items_1nf (
    order_id     INTEGER,
    customer     VARCHAR(100),
    address      VARCHAR(200),
    item_name    VARCHAR(100),
    item_price   DECIMAL(10,2),
    PRIMARY KEY (order_id, item_name)
);
```

```
┌──────────┬──────────┬───────────────┬───────────┬────────────┐
│ order_id │ customer │ address       │ item_name │ item_price │
├──────────┼──────────┼───────────────┼───────────┼────────────┤
│ 1        │ Alice    │ 123 Main St   │ Widget    │ 10.00      │
│ 1        │ Alice    │ 123 Main St   │ Gadget    │ 20.00      │
│ 2        │ Bob      │ 456 Oak Ave   │ Widget    │ 10.00      │
│ 3        │ Alice    │ 123 Main St   │ Gadget    │ 20.00      │
│ 3        │ Alice    │ 123 Main St   │ Tool      │ 15.00      │
└──────────┴──────────┴───────────────┴───────────┴────────────┘

✓ Every cell contains exactly one value
✗ Customer data still repeated (redundancy)
✗ Item prices repeated across orders
```

---

### Second Normal Form (2NF)

**Rule:** Must be in 1NF AND every non-key column depends on the ENTIRE primary key (no partial dependencies).

```
PK: {order_id, item_name}

Partial dependencies (violate 2NF):
  order_id → customer, address     (depends only on part of PK)
  item_name → item_price           (depends only on part of PK)

Full dependency (OK):
  {order_id, item_name} → quantity (depends on full PK)
```

```sql
-- Split into tables to remove partial dependencies:

-- Table 1: Orders (depends on order_id only)
CREATE TABLE orders (
    order_id   INTEGER PRIMARY KEY,
    customer   VARCHAR(100),
    address    VARCHAR(200)
);

-- Table 2: Products (depends on item_name only)
CREATE TABLE products (
    product_id   SERIAL PRIMARY KEY,
    item_name    VARCHAR(100) UNIQUE,
    item_price   DECIMAL(10,2)
);

-- Table 3: Order Items (depends on full composite key)
CREATE TABLE order_items (
    order_id    INTEGER REFERENCES orders(order_id),
    product_id  INTEGER REFERENCES products(product_id),
    quantity    INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (order_id, product_id)
);
```

```
orders:                    products:
┌──────────┬────────┬──────┐  ┌────────────┬───────────┬────────┐
│ order_id │customer│address│  │ product_id │ item_name │ price  │
├──────────┼────────┼──────┤  ├────────────┼───────────┼────────┤
│ 1        │ Alice  │ 123  │  │ 1          │ Widget    │ 10.00  │
│ 2        │ Bob    │ 456  │  │ 2          │ Gadget    │ 20.00  │
│ 3        │ Alice  │ 123  │  │ 3          │ Tool      │ 15.00  │
└──────────┴────────┴──────┘  └────────────┴───────────┴────────┘

✓ No partial dependencies
✗ Alice's address still repeated in orders table
  (customer → address is a transitive dependency)
```

---

### Third Normal Form (3NF)

**Rule:** Must be in 2NF AND no transitive dependencies (non-key column depends on another non-key column).

```
Transitive dependency (violates 3NF):
  order_id → customer → address
  (address depends on customer, not directly on order_id)
```

```sql
-- Split customers into their own table:

CREATE TABLE customers (
    customer_id  SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    address      VARCHAR(200) NOT NULL
);

CREATE TABLE orders (
    order_id     INTEGER PRIMARY KEY,
    customer_id  INTEGER REFERENCES customers(customer_id),
    order_date   DATE NOT NULL
);

CREATE TABLE products (
    product_id   SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    price        DECIMAL(10,2) NOT NULL
);

CREATE TABLE order_items (
    order_id    INTEGER REFERENCES orders(order_id),
    product_id  INTEGER REFERENCES products(product_id),
    quantity    INTEGER NOT NULL,
    unit_price  DECIMAL(10,2) NOT NULL,  -- price at time of order
    PRIMARY KEY (order_id, product_id)
);
```

```
customers:            orders:              products:
┌────┬───────┬──────┐  ┌────────┬─────┬─────┐  ┌────┬────────┬───────┐
│ id │ name  │ addr │  │order_id│c_id │ date│  │ id │ name   │ price │
├────┼───────┼──────┤  ├────────┼─────┼─────┤  ├────┼────────┼───────┤
│ 1  │ Alice │ 123  │  │ 1      │  1  │ Jan │  │ 1  │ Widget │ 10.00 │
│ 2  │ Bob   │ 456  │  │ 2      │  2  │ Feb │  │ 2  │ Gadget │ 20.00 │
└────┴───────┴──────┘  │ 3      │  1  │ Mar │  │ 3  │ Tool   │ 15.00 │
                        └────────┴─────┴─────┘  └────┴────────┴───────┘

✓ Each fact stored exactly once
✓ Update Alice's address = 1 row change
✓ No transitive dependencies
✓ Referential integrity via foreign keys
```

**NOTE:** `unit_price` in `order_items` is NOT redundancy — it captures the price at the time of order. Product prices change; order prices must not.

---

### Boyce-Codd Normal Form (BCNF)

**Rule:** Must be in 3NF AND every determinant is a candidate key.

BCNF is stricter than 3NF. The difference appears when a non-key attribute is part of a candidate key:

```
Table: student_courses
┌────────────┬──────────┬────────────┐
│ student_id │ course   │ professor  │
├────────────┼──────────┼────────────┤
│ S1         │ Database │ Dr. Smith  │
│ S2         │ Database │ Dr. Smith  │
│ S1         │ Networks │ Dr. Jones  │
│ S3         │ Database │ Dr. Brown  │
└────────────┴──────────┴────────────┘

Candidate key: {student_id, course}
FD: professor → course  (each professor teaches exactly one course)

This violates BCNF because professor is NOT a candidate key
but determines course.

Fix: Split into two tables:
  professor_courses: {professor, course}
  student_professors: {student_id, professor}
```

**In practice:** Most real schemas that satisfy 3NF also satisfy BCNF. The edge case above is rare.

---

### Fourth Normal Form (4NF)

**Rule:** Must be in BCNF AND no multi-valued dependencies.

```
Table: employee_skills_languages (violates 4NF)
┌──────────┬────────────┬──────────┐
│ employee │ skill      │ language │
├──────────┼────────────┼──────────┤
│ Alice    │ Python     │ English  │
│ Alice    │ Python     │ French   │
│ Alice    │ Go         │ English  │
│ Alice    │ Go         │ French   │  ← Every combo must exist!
└──────────┴────────────┴──────────┘

employee →→ skill  (independent of language)
employee →→ language (independent of skill)

Fix: Split into:
  employee_skills: {employee, skill}
  employee_languages: {employee, language}
```

**In practice:** 4NF violations are uncommon if you design tables around single concepts.

---

### Normal Form Summary

| Normal Form | Eliminates | Key Rule | Target |
|-------------|-----------|----------|--------|
| **1NF** | Repeating groups | Atomic values only | Always |
| **2NF** | Partial dependencies | Full key dependence | Always |
| **3NF** | Transitive dependencies | No non-key → non-key | Standard target |
| **BCNF** | All non-trivial FD violations | Every determinant is candidate key | Preferred target |
| **4NF** | Multi-valued dependencies | No independent multi-valued facts | Rarely needed |
| **5NF** | Join dependencies | Cannot decompose further | Academic |

---

## Best Practices

1. **ALWAYS normalize to 3NF as the starting point** — then denormalize strategically where needed
2. **ALWAYS store each fact exactly once** — the fundamental principle of normalization
3. **ALWAYS use foreign keys** to enforce relationships between normalized tables
4. **ALWAYS capture time-sensitive data separately** — store price-at-time-of-order in order_items, not just a FK to products
5. **ALWAYS use surrogate keys (SERIAL/UUID)** for primary keys — natural keys change
6. **NEVER normalize just because "it is the rule"** — understand WHY each normalization helps your specific case
7. **NEVER go beyond BCNF** unless you have a specific, measured problem
8. **ALWAYS document denormalization decisions** — when you break normalization rules, explain why

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Skipping normalization entirely | Massive data duplication, update anomalies | Start with 3NF, denormalize intentionally |
| Normalizing everything to 5NF | 20-table JOINs for simple queries | Target 3NF/BCNF, denormalize hot paths |
| Comma-separated values in column | Cannot query individual values, violates 1NF | Create junction table |
| JSON blobs instead of proper tables | No constraints, no foreign keys, no type safety | Use proper relational tables for structured data |
| Not storing historical prices | Order totals change when product prices update | Store unit_price in order_items |
| Natural keys as primary keys | Email changes break all foreign keys | Use surrogate keys (id SERIAL) |
| Repeating column groups | product_1, product_2, product_3 columns | Create separate table with FK |
| Normalizing configuration data | Tiny tables with 1-2 rows, unnecessary JOINs | Keep small static config in single table |

---

## Real-world Examples

### Stripe
- Heavily normalized payment data (charges, refunds, disputes separate tables)
- Historical price capture in line items (not just product FK)
- Audit trail tables for every state change

### Shopify
- Normalized product catalog (products, variants, options, images)
- Denormalized order snapshot (captures product state at order time)
- Separate normalized table for inventory across locations

### GitHub
- Normalized repository data (repos, commits, branches, PRs all separate)
- Issues and comments normalized with proper FKs
- Denormalized search indexes built from normalized source

---

## Enforcement Checklist

- [ ] Every table is in at least 3NF
- [ ] No column contains comma-separated or array values for structured data
- [ ] Every non-key column depends on the primary key, the whole key, and nothing but the key
- [ ] Foreign keys enforce all relationships
- [ ] Time-sensitive values (prices, addresses) stored as snapshots where needed
- [ ] Surrogate keys used for primary keys (not natural keys)
- [ ] Any intentional denormalization is documented with justification
- [ ] No repeating column groups (col_1, col_2, col_3)
