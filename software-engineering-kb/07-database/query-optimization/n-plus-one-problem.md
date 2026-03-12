# The N+1 Query Problem

> **Domain:** Database > Query Optimization > N+1
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

The N+1 query problem is the most common performance issue in web applications using ORMs. It occurs when code fetches a list of N items, then executes a separate query for each item to load related data — resulting in 1 + N database round trips instead of 1 or 2. For 100 users with orders, this means 101 queries instead of 2. At scale, N+1 queries are the #1 cause of slow API responses and database overload. Every ORM provides mechanisms to prevent N+1, but developers must use them explicitly.

---

## How It Works

### The Problem

```
N+1 Example: Load users and their orders

BAD (N+1 queries — 101 round trips):
  Query 1: SELECT * FROM users LIMIT 100;           -- 1 query
  Query 2: SELECT * FROM orders WHERE user_id = 1;   -- +1
  Query 3: SELECT * FROM orders WHERE user_id = 2;   -- +1
  Query 4: SELECT * FROM orders WHERE user_id = 3;   -- +1
  ...
  Query 101: SELECT * FROM orders WHERE user_id = 100; -- +1
  Total: 101 queries, 101 database round trips

GOOD (2 queries — 2 round trips):
  Query 1: SELECT * FROM users LIMIT 100;
  Query 2: SELECT * FROM orders WHERE user_id IN (1,2,3,...,100);
  Total: 2 queries, 2 database round trips

Or BEST (1 query — 1 round trip):
  Query 1: SELECT u.*, o.*
           FROM users u
           LEFT JOIN orders o ON u.id = o.user_id
           LIMIT 100;
  Total: 1 query, 1 database round trip
```

### ORM Solutions

```typescript
// Prisma — N+1 prevention

// BAD: N+1 (sequential queries)
const users = await prisma.user.findMany({ take: 100 });
for (const user of users) {
  const orders = await prisma.order.findMany({
    where: { userId: user.id }, // N extra queries!
  });
}

// GOOD: include (single query with JOIN)
const users = await prisma.user.findMany({
  take: 100,
  include: { orders: true }, // Prisma generates JOIN
});

// GOOD: select with nested (2 queries, batched)
const users = await prisma.user.findMany({
  take: 100,
  include: {
    orders: {
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    },
  },
});
```

```typescript
// Drizzle — N+1 prevention

// GOOD: relational query (batch loading)
const users = await db.query.users.findMany({
  limit: 100,
  with: { orders: true },
});

// GOOD: explicit JOIN
const results = await db.select()
  .from(schema.users)
  .leftJoin(schema.orders, eq(schema.users.id, schema.orders.userId))
  .limit(100);
```

```python
# SQLAlchemy — N+1 prevention

# BAD: lazy loading (default — N+1!)
users = session.query(User).limit(100).all()
for user in users:
    print(user.orders)  # triggers N queries!

# GOOD: selectinload (2 queries)
from sqlalchemy.orm import selectinload
users = session.scalars(
    select(User)
    .options(selectinload(User.orders))
    .limit(100)
).all()

# GOOD: joinedload (1 query with JOIN)
from sqlalchemy.orm import joinedload
users = session.scalars(
    select(User)
    .options(joinedload(User.orders))
    .limit(100)
).unique().all()

# GOOD: subqueryload (2 queries, subquery in second)
from sqlalchemy.orm import subqueryload
users = session.scalars(
    select(User)
    .options(subqueryload(User.orders))
    .limit(100)
).all()
```

```go
// GORM — N+1 prevention

// BAD: no preload
var users []User
db.Limit(100).Find(&users)
for _, user := range users {
    var orders []Order
    db.Where("user_id = ?", user.ID).Find(&orders) // N queries!
}

// GOOD: Preload (2 queries)
var users []User
db.Preload("Orders").Limit(100).Find(&users)

// GOOD: Joins (1 query)
var users []User
db.Joins("Orders").Limit(100).Find(&users)
```

### Detecting N+1

```typescript
// Detection: log query count per request
let queryCount = 0;
const originalQuery = pool.query.bind(pool);
pool.query = (...args: any[]) => {
  queryCount++;
  return originalQuery(...args);
};

// In middleware:
app.use((req, res, next) => {
  queryCount = 0;
  res.on('finish', () => {
    if (queryCount > 10) {
      console.warn(`⚠️ ${req.path}: ${queryCount} queries (possible N+1)`);
    }
  });
  next();
});
```

---

### DataLoader Pattern (GraphQL)

```typescript
// DataLoader: batch + cache individual lookups
import DataLoader from 'dataloader';

// Create loader (batches individual loads into one query)
const userLoader = new DataLoader(async (userIds: readonly string[]) => {
  const users = await db.query(
    `SELECT * FROM users WHERE id = ANY($1)`,
    [userIds]
  );
  // Must return in same order as input IDs
  const userMap = new Map(users.rows.map(u => [u.id, u]));
  return userIds.map(id => userMap.get(id) || null);
});

// Usage: these individual calls are batched into ONE query
const user1 = await userLoader.load('user-1'); // batched
const user2 = await userLoader.load('user-2'); // batched
const user3 = await userLoader.load('user-3'); // batched
// Result: 1 query: SELECT * FROM users WHERE id IN ('user-1','user-2','user-3')
```

---

## Best Practices

1. **ALWAYS use eager loading** (include, Preload, selectinload) — prevent N+1 by default
2. **ALWAYS monitor query count per request** — alert on > 10 queries
3. **ALWAYS use DataLoader** for GraphQL APIs — batch individual loads
4. **ALWAYS prefer batch loading** (IN clause) over individual queries
5. **NEVER rely on lazy loading** in production — it's N+1 by design
6. **NEVER load relations inside loops** — this is always N+1
7. **NEVER ignore N+1 warnings** from query loggers — fix them immediately

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Lazy loading in loop | 100+ queries per request | Use eager loading (include/Preload) |
| No query monitoring | N+1 undetected | Log query count per request |
| GraphQL without DataLoader | N+1 per resolver | Implement DataLoader for all loaders |
| Over-eager loading | Loading unused relations | Load only relations used in response |
| Nested N+1 (A→B→C) | Exponential queries | Eager load all levels |

---

## Enforcement Checklist

- [ ] Eager loading used for all list endpoints with relations
- [ ] Query count per request monitored (alert > 10)
- [ ] DataLoader used in GraphQL resolvers
- [ ] Lazy loading disabled or warnings enabled
- [ ] No relation loading inside loops
- [ ] N+1 detection in integration tests
