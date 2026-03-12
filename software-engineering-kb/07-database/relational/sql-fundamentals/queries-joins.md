# SQL Queries & JOINs

> **Domain:** Database > Relational > SQL Fundamentals
> **Difficulty:** Beginner
> **Last Updated:** —

## Why It Matters

SQL is the lingua franca of data. Every backend engineer writes SQL — directly or through an ORM. Understanding SELECT, JOINs, subqueries, CTEs, and window functions is not optional. ORMs generate SQL; when that generated SQL is slow, you need to understand what it produces and how to optimize it. The difference between a junior and senior engineer often comes down to SQL fluency — can you write a single query that replaces 10 application-level loops?

---

## How It Works

### SELECT Fundamentals

```sql
-- Execution order (NOT the written order):
-- 1. FROM / JOIN    (gather tables)
-- 2. WHERE          (filter rows)
-- 3. GROUP BY       (aggregate)
-- 4. HAVING         (filter groups)
-- 5. SELECT         (choose columns)
-- 6. DISTINCT       (remove duplicates)
-- 7. ORDER BY       (sort results)
-- 8. LIMIT / OFFSET (paginate)

SELECT
    c.name AS customer_name,          -- 5. select columns
    COUNT(o.id) AS order_count,       -- 5. aggregate
    SUM(o.total) AS total_spent       -- 5. aggregate
FROM customers c                      -- 1. start with customers
JOIN orders o ON o.customer_id = c.id -- 1. join orders
WHERE c.created_at > '2024-01-01'     -- 2. filter rows
GROUP BY c.id, c.name                 -- 3. group by customer
HAVING COUNT(o.id) > 3                -- 4. only customers with >3 orders
ORDER BY total_spent DESC             -- 7. sort by spending
LIMIT 10;                             -- 8. top 10 only
```

---

### JOIN Types

```
TABLE A (users)        TABLE B (orders)
┌────┬───────┐         ┌────┬─────────┬────────┐
│ id │ name  │         │ id │ user_id │ total  │
├────┼───────┤         ├────┼─────────┼────────┤
│ 1  │ Alice │         │ 10 │ 1       │ 100.00 │
│ 2  │ Bob   │         │ 11 │ 1       │ 50.00  │
│ 3  │ Carol │         │ 12 │ 2       │ 75.00  │
│ 4  │ Dave  │         │ 13 │ NULL    │ 25.00  │
└────┴───────┘         └────┴─────────┴────────┘
```

#### INNER JOIN — Only matching rows from both tables

```sql
SELECT u.name, o.total
FROM users u
INNER JOIN orders o ON o.user_id = u.id;

-- Result: Alice (100), Alice (50), Bob (75)
-- Carol excluded (no orders), Dave excluded (no orders)
-- Order 13 excluded (no matching user)
```

#### LEFT JOIN — All rows from left table + matches from right

```sql
SELECT u.name, o.total
FROM users u
LEFT JOIN orders o ON o.user_id = u.id;

-- Result: Alice (100), Alice (50), Bob (75), Carol (NULL), Dave (NULL)
-- ALL users included, even without orders

-- Find users WITHOUT orders:
SELECT u.name
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.id IS NULL;  -- Carol, Dave
```

#### RIGHT JOIN — All rows from right table + matches from left

```sql
SELECT u.name, o.total
FROM users u
RIGHT JOIN orders o ON o.user_id = u.id;

-- Result: Alice (100), Alice (50), Bob (75), NULL (25)
-- ALL orders included, even without matching user
```

#### FULL OUTER JOIN — All rows from both tables

```sql
SELECT u.name, o.total
FROM users u
FULL OUTER JOIN orders o ON o.user_id = u.id;

-- Result: Alice (100), Alice (50), Bob (75), Carol (NULL), Dave (NULL), NULL (25)
-- Everything from both tables
```

#### CROSS JOIN — Cartesian product

```sql
SELECT u.name, s.size
FROM users u
CROSS JOIN sizes s;
-- Every user × every size = if 4 users and 3 sizes = 12 rows
-- Rarely used intentionally
```

#### Self JOIN — Table joined to itself

```sql
-- Find employee and their manager
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id;
```

**JOIN visual summary:**

```
INNER JOIN:    LEFT JOIN:     RIGHT JOIN:    FULL OUTER:
  ┌───┐          ┌───┐          ┌───┐          ┌───┐
 ╱A∩B ╲        ╱█████╲        ╱     ╲        ╱█████╲
│ ███ │       │ █████ │      │ ███ │       │ █████ │
│ ███ │       │ ███████      █████ │       │ ███████
 ╲███╱         ╲█████╱        ╲█████╱        ╲█████╱
  └───┘          └───┘          └───┘          └───┘
Only overlap   All left       All right      Everything
```

---

### Subqueries

```sql
-- Scalar subquery (returns single value)
SELECT name, salary,
       (SELECT AVG(salary) FROM employees) AS company_avg
FROM employees;

-- IN subquery (returns a set of values)
SELECT * FROM products
WHERE category_id IN (
    SELECT id FROM categories WHERE active = TRUE
);

-- EXISTS subquery (checks if rows exist — often faster than IN)
SELECT * FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.id
    AND o.total > 1000
);

-- Correlated subquery (references outer query — runs once per row)
SELECT e.name, e.salary,
    (SELECT COUNT(*) FROM employees e2
     WHERE e2.department = e.department) AS dept_size
FROM employees e;
```

---

### Common Table Expressions (CTEs)

```sql
-- CTE: named temporary result set (readable subquery)
WITH high_value_customers AS (
    SELECT customer_id, SUM(total) AS lifetime_value
    FROM orders
    GROUP BY customer_id
    HAVING SUM(total) > 10000
),
recent_orders AS (
    SELECT customer_id, COUNT(*) AS recent_count
    FROM orders
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY customer_id
)
SELECT
    c.name,
    hvc.lifetime_value,
    COALESCE(ro.recent_count, 0) AS recent_orders
FROM high_value_customers hvc
JOIN customers c ON c.id = hvc.customer_id
LEFT JOIN recent_orders ro ON ro.customer_id = hvc.customer_id
ORDER BY hvc.lifetime_value DESC;

-- Recursive CTE: for trees and hierarchies
WITH RECURSIVE category_tree AS (
    -- Base case: root categories
    SELECT id, name, parent_id, 0 AS depth, name::text AS path
    FROM categories
    WHERE parent_id IS NULL

    UNION ALL

    -- Recursive case: children
    SELECT c.id, c.name, c.parent_id, ct.depth + 1,
           ct.path || ' > ' || c.name
    FROM categories c
    JOIN category_tree ct ON ct.id = c.parent_id
    WHERE ct.depth < 10  -- prevent infinite loops
)
SELECT * FROM category_tree ORDER BY path;
```

---

### Window Functions

Window functions compute values across a set of rows related to the current row — WITHOUT collapsing rows like GROUP BY.

```sql
-- ROW_NUMBER: sequential numbering within partition
SELECT
    department,
    name,
    salary,
    ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS rank
FROM employees;
-- Ranks employees within each department by salary

-- RANK vs DENSE_RANK vs ROW_NUMBER:
-- salary: 100, 100, 80, 70
-- ROW_NUMBER: 1, 2, 3, 4  (always unique)
-- RANK:       1, 1, 3, 4  (skip after tie)
-- DENSE_RANK: 1, 1, 2, 3  (no skip)

-- Running total
SELECT
    order_date,
    total,
    SUM(total) OVER (ORDER BY order_date) AS running_total
FROM orders;

-- Moving average (last 7 days)
SELECT
    order_date,
    total,
    AVG(total) OVER (
        ORDER BY order_date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS moving_avg_7d
FROM daily_revenue;

-- LAG / LEAD: access previous/next row
SELECT
    month,
    revenue,
    LAG(revenue) OVER (ORDER BY month) AS prev_month,
    revenue - LAG(revenue) OVER (ORDER BY month) AS growth
FROM monthly_revenue;

-- FIRST_VALUE / LAST_VALUE
SELECT
    name,
    department,
    salary,
    FIRST_VALUE(name) OVER (
        PARTITION BY department ORDER BY salary DESC
    ) AS highest_paid_in_dept
FROM employees;

-- Percentile / NTILE
SELECT
    name,
    salary,
    NTILE(4) OVER (ORDER BY salary) AS salary_quartile,
    PERCENT_RANK() OVER (ORDER BY salary) AS percentile
FROM employees;
```

---

### Aggregate Functions

```sql
-- Basic aggregates
SELECT
    COUNT(*) AS total_rows,           -- count all rows
    COUNT(DISTINCT category) AS categories,  -- count unique values
    SUM(price) AS total,
    AVG(price) AS average,
    MIN(price) AS cheapest,
    MAX(price) AS most_expensive,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS median
FROM products;

-- Conditional aggregation
SELECT
    COUNT(*) AS total_orders,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
    SUM(total) FILTER (WHERE status = 'completed') AS completed_revenue
FROM orders;

-- STRING_AGG / ARRAY_AGG
SELECT
    department,
    STRING_AGG(name, ', ' ORDER BY name) AS members,
    ARRAY_AGG(name ORDER BY name) AS member_array
FROM employees
GROUP BY department;

-- GROUPING SETS, CUBE, ROLLUP (for multi-dimensional aggregation)
SELECT
    COALESCE(category, 'ALL') AS category,
    COALESCE(region, 'ALL') AS region,
    SUM(revenue) AS total_revenue
FROM sales
GROUP BY ROLLUP (category, region);
-- Produces: category+region, category totals, grand total
```

---

## Best Practices

1. **ALWAYS use explicit JOIN syntax** — never comma-separated FROM clauses
2. **ALWAYS alias tables** in multi-table queries (u, o, p — short and clear)
3. **ALWAYS prefer EXISTS over IN** for correlated subqueries — usually faster
4. **ALWAYS use CTEs for complex queries** — readability over cleverness
5. **ALWAYS add LIMIT to development queries** — prevent accidental full table scans
6. **ALWAYS specify column names in SELECT** — never use SELECT * in production code
7. **NEVER use OFFSET for deep pagination** — use keyset/cursor pagination instead
8. **NEVER use DISTINCT to mask a bad JOIN** — if you get duplicates, fix the JOIN
9. **ALWAYS use window functions instead of correlated subqueries** when possible — better performance
10. **ALWAYS add depth limits to recursive CTEs** — prevent infinite loops

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| SELECT * in production | Fetching unnecessary data, breaks when columns added | Select only needed columns |
| Implicit JOIN (comma in FROM) | Hard to read, easy to miss join conditions | Use explicit JOIN ... ON |
| N+1 queries in application | 100 queries instead of 1 | Use JOINs or batch loading |
| DISTINCT to fix duplicate rows | Masking a cartesian product | Fix the JOIN condition |
| OFFSET for deep pagination | Slow at page 1000 (scans 10000 rows) | Use WHERE id > last_id (keyset) |
| Subquery in SELECT list | Runs once per row, extremely slow | Use JOIN or window function |
| GROUP BY without aggregate | Confusing results, arbitrary row selection | Every non-aggregated column must be in GROUP BY |
| ORDER BY RANDOM() | Full table scan + sort, does not scale | Use TABLESAMPLE or application-level random |

---

## Real-world Examples

### GitHub
- Window functions for contribution statistics (streak calculations)
- Recursive CTEs for repository fork trees
- Complex JOINs across repos, users, PRs, reviews, comments
- CTEs for trending repository calculations

### Stripe
- Aggregate functions for revenue reporting dashboards
- Window functions for running balance calculations
- Complex JOINs for subscription lifecycle queries
- FILTER clause for conditional revenue aggregation

---

## Enforcement Checklist

- [ ] All production queries use explicit column lists (no SELECT *)
- [ ] All JOINs use explicit syntax (JOIN ... ON, not comma-separated FROM)
- [ ] CTEs used for queries with more than 2 subqueries
- [ ] Recursive CTEs have depth limits
- [ ] Window functions used instead of correlated subqueries where possible
- [ ] OFFSET pagination replaced with keyset pagination for large datasets
- [ ] EXPLAIN ANALYZE used to verify query plan before deployment
