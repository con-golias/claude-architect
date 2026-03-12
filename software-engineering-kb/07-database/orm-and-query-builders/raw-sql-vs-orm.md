# Raw SQL vs ORM

> **Domain:** Database > ORM & Query Builders
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

The choice between raw SQL, query builders, and ORMs fundamentally shapes how your application interacts with the database. Raw SQL gives maximum control and performance but sacrifices type safety and portability. ORMs provide object-relational mapping with code-first development but can generate inefficient queries and hide database complexity. Query builders sit in the middle — SQL-like syntax with type safety and composability. Understanding the tradeoffs, and when to use each approach (often mixing them in the same application), prevents both the performance disasters of ORM misuse and the maintenance burden of raw SQL strings scattered through business logic.

---

## How It Works

### The Spectrum

```
Control & Performance ◄──────────────────────► Productivity & Safety

Raw SQL          Query Builder        Active Record        Data Mapper
(pg, mysql2)     (Knex, Drizzle)     (Sequelize, TypeORM) (Prisma, SQLAlchemy)

More control                                           More abstraction
More performance                                       More type safety
More SQL knowledge                                     More productivity
More maintenance                                       More magic
```

### Comparison Matrix

| Feature | Raw SQL | Query Builder | ORM |
|---------|---------|--------------|-----|
| **Type safety** | None | Partial-Full | Full |
| **SQL knowledge required** | Expert | Moderate | Minimal |
| **Performance control** | Maximum | High | Variable |
| **N+1 prevention** | Manual | Manual | Framework-dependent |
| **Migration support** | Manual | Built-in (some) | Built-in |
| **Database portability** | None | High | High |
| **Complex queries** | Easy | Moderate | Difficult |
| **Learning curve** | SQL only | Low | Medium-High |
| **Debugging** | See exact SQL | See generated SQL | Magic/opaque |
| **Best for** | Performance-critical, complex | Most applications | Rapid development |

---

### Raw SQL

```typescript
// TypeScript — Raw SQL with pg
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Simple query — clean and direct
async function getUserOrders(userId: string) {
  const result = await pool.query(
    `SELECT o.id, o.total, o.status, o.created_at,
            json_agg(json_build_object('id', oi.id, 'name', p.name, 'qty', oi.quantity)) AS items
     FROM orders o
     JOIN order_items oi ON o.id = oi.order_id
     JOIN products p ON oi.product_id = p.id
     WHERE o.user_id = $1
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT 20`,
    [userId]
  );
  return result.rows;
}

// ✅ Pros: exact control, use any SQL feature, maximum performance
// ❌ Cons: no type safety, SQL strings in code, manual param binding
```

```go
// Go — Raw SQL with sqlx (adds struct scanning)
import "github.com/jmoiron/sqlx"

type OrderWithItems struct {
    ID        string    `db:"id"`
    Total     float64   `db:"total"`
    Status    string    `db:"status"`
    CreatedAt time.Time `db:"created_at"`
    Items     string    `db:"items"` // JSON string
}

func GetUserOrders(ctx context.Context, db *sqlx.DB, userID string) ([]OrderWithItems, error) {
    var orders []OrderWithItems
    err := db.SelectContext(ctx, &orders, `
        SELECT o.id, o.total, o.status, o.created_at,
               json_agg(json_build_object('id', oi.id, 'name', p.name)) AS items
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        WHERE o.user_id = $1
        GROUP BY o.id
        ORDER BY o.created_at DESC`, userID)
    return orders, err
}
```

---

### Query Builder

```typescript
// TypeScript — Knex.js query builder
import knex from 'knex';

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
});

// Composable, type-safe-ish queries
async function getUserOrders(userId: string, status?: string) {
  let query = db('orders')
    .select('orders.id', 'orders.total', 'orders.status')
    .where('orders.user_id', userId)
    .orderBy('orders.created_at', 'desc')
    .limit(20);

  // Conditional filtering (composable!)
  if (status) {
    query = query.where('orders.status', status);
  }

  return query;
}

// Complex query with JOIN
async function getOrderSummary(startDate: string, endDate: string) {
  return db('orders')
    .select('users.name')
    .sum('orders.total as revenue')
    .count('orders.id as order_count')
    .join('users', 'orders.user_id', 'users.id')
    .whereBetween('orders.created_at', [startDate, endDate])
    .groupBy('users.id', 'users.name')
    .orderBy('revenue', 'desc');
}
```

---

### When to Use Each

```
Decision Guide:
┌─────────────────────────────────────────────────┐
│                                                   │
│  Need complex SQL (CTEs, window functions,        │
│  lateral joins, custom aggregations)?             │
│  ├── YES → Raw SQL (or raw mode in ORM)          │
│  └── NO                                           │
│      │                                             │
│      Need maximum performance control?            │
│      ├── YES → Raw SQL or Query Builder           │
│      └── NO                                        │
│          │                                          │
│          Need type-safe schema + migrations?       │
│          ├── YES → ORM (Prisma, Drizzle)           │
│          └── NO → Query Builder (Knex)             │
│                                                    │
│  RECOMMENDED: Use ORM for CRUD, drop to raw SQL   │
│  for complex queries. Most ORMs support raw mode.  │
└─────────────────────────────────────────────────┘

The Pragmatic Approach:
  • 80% of queries: ORM/query builder (CRUD operations)
  • 15% of queries: query builder with raw fragments
  • 5% of queries: full raw SQL (complex analytics, reports)
```

---

## Best Practices

1. **ALWAYS use parameterized queries** — prevent SQL injection regardless of approach
2. **ALWAYS mix approaches** — ORM for CRUD, raw SQL for complex queries
3. **ALWAYS log generated SQL** during development — understand what the ORM generates
4. **ALWAYS use query builders** for dynamic filtering — composable, safe, readable
5. **ALWAYS type your results** — even raw SQL should map to typed structs/interfaces
6. **NEVER concatenate user input into SQL strings** — parameterized queries always
7. **NEVER use ORM for complex analytics** — the generated SQL will be horrible
8. **NEVER choose ORM to avoid learning SQL** — you must understand SQL to debug ORM issues
9. **NEVER use raw SQL for simple CRUD** — boilerplate without benefit

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| String concatenation in SQL | SQL injection vulnerability | Use parameterized queries ($1, ?) |
| ORM for complex analytics | N+1 queries, slow JOINs | Drop to raw SQL for complex queries |
| Raw SQL for simple CRUD | Boilerplate, no type safety | Use ORM for standard operations |
| Avoiding SQL entirely | Cannot debug ORM-generated queries | Learn SQL fundamentals |
| Not logging generated SQL | Hidden performance issues | Enable query logging in development |
| Over-abstracting data access | Cannot optimize queries | Keep data access close to SQL |

---

## Enforcement Checklist

- [ ] SQL injection prevented (parameterized queries everywhere)
- [ ] ORM used for CRUD operations (type safety, migrations)
- [ ] Raw SQL used for complex queries (CTEs, window functions, analytics)
- [ ] Generated SQL logged in development for review
- [ ] Query performance monitored (regardless of approach)
- [ ] Team understands SQL fundamentals (not just ORM API)
