# Drizzle ORM

> **Domain:** Database > ORM & Query Builders > Drizzle
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Drizzle is a TypeScript ORM that provides type-safe SQL without abstracting away from SQL. Unlike Prisma (which generates a client from a schema file) or TypeORM (which uses decorators), Drizzle defines schemas in TypeScript and provides a query builder that maps 1:1 to SQL. If you know SQL, you know Drizzle. This "SQL-like" approach means generated queries are predictable, performant, and debuggable. Drizzle supports PostgreSQL, MySQL, SQLite, and is designed for edge runtimes (Cloudflare Workers, Vercel Edge) due to its lightweight runtime.

---

## How It Works

### Schema Definition

```typescript
// src/db/schema.ts
import {
  pgTable, uuid, text, timestamp, boolean,
  integer, decimal, pgEnum, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum
export const roleEnum = pgEnum('role', ['user', 'admin', 'moderator']);
export const orderStatusEnum = pgEnum('order_status',
  ['pending', 'processing', 'shipped', 'delivered', 'cancelled']);

// Tables
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: roleEnum('role').default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
}));

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: text('content'),
  published: boolean('published').default(false).notNull(),
  authorId: uuid('author_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  authorIdx: index('posts_author_idx').on(table.authorId),
}));

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userCreatedIdx: index('orders_user_created_idx').on(table.userId, table.createdAt),
}));

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
});

// Relations (for relational queries)
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  orders: many(orders),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));
```

### CRUD Operations

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, gte, desc, sql, count, sum } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// INSERT
const [newUser] = await db.insert(schema.users)
  .values({ email: 'alice@example.com', name: 'Alice' })
  .returning();

// INSERT many
await db.insert(schema.orders).values([
  { userId: newUser.id, total: '99.99' },
  { userId: newUser.id, total: '149.99' },
]);

// SELECT with filter (SQL-like API)
const activeUsers = await db.select()
  .from(schema.users)
  .where(eq(schema.users.role, 'admin'))
  .orderBy(desc(schema.users.createdAt))
  .limit(20);

// SELECT with JOIN
const userOrders = await db.select({
  userName: schema.users.name,
  orderTotal: schema.orders.total,
  orderStatus: schema.orders.status,
})
  .from(schema.orders)
  .innerJoin(schema.users, eq(schema.orders.userId, schema.users.id))
  .where(eq(schema.users.id, userId))
  .orderBy(desc(schema.orders.createdAt));

// Relational queries (Prisma-like API)
const userWithPosts = await db.query.users.findFirst({
  where: eq(schema.users.id, userId),
  with: {
    posts: {
      where: eq(schema.posts.published, true),
      orderBy: [desc(schema.posts.createdAt)],
      limit: 10,
    },
    orders: { with: { items: true } },
  },
});

// UPDATE
await db.update(schema.users)
  .set({ name: 'Alice Smith', updatedAt: new Date() })
  .where(eq(schema.users.id, userId));

// UPSERT (ON CONFLICT)
await db.insert(schema.users)
  .values({ email: 'bob@example.com', name: 'Bob' })
  .onConflictDoUpdate({
    target: schema.users.email,
    set: { name: 'Bob Updated', updatedAt: new Date() },
  });

// DELETE
await db.delete(schema.posts)
  .where(and(
    eq(schema.posts.published, false),
    gte(schema.posts.createdAt, new Date('2023-01-01'))
  ));

// Aggregation
const stats = await db.select({
  status: schema.orders.status,
  orderCount: count(),
  totalRevenue: sum(schema.orders.total),
})
  .from(schema.orders)
  .groupBy(schema.orders.status);

// Raw SQL (escape hatch)
const result = await db.execute(sql`
  SELECT DATE_TRUNC('month', created_at) AS month,
         SUM(total) AS revenue
  FROM orders
  WHERE created_at > ${startDate}
  GROUP BY month
  ORDER BY month DESC
`);
```

### Transactions

```typescript
// Transaction
await db.transaction(async (tx) => {
  const [order] = await tx.insert(schema.orders)
    .values({ userId, total: '99.99' })
    .returning();

  await tx.insert(schema.orderItems).values([
    { orderId: order.id, productId: 'prod-1', quantity: 2, price: '29.99' },
    { orderId: order.id, productId: 'prod-2', quantity: 1, price: '40.01' },
  ]);
});
```

### Migrations

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# Push schema directly (development, no migration files)
npx drizzle-kit push

# Open Drizzle Studio (visual database browser)
npx drizzle-kit studio
```

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

### Drizzle vs Prisma

| Feature | Drizzle | Prisma |
|---------|---------|--------|
| **Schema** | TypeScript files | .prisma schema file |
| **Query style** | SQL-like (select, join) | Object-based (findMany, include) |
| **Generated SQL** | Predictable, 1:1 | Opaque, sometimes suboptimal |
| **Bundle size** | ~50 KB | ~15 MB (engine binary) |
| **Edge runtime** | Yes (Cloudflare, Vercel) | Limited (Prisma Accelerate) |
| **Raw SQL** | First-class (`sql` tagged template) | $queryRaw (escape hatch) |
| **Migrations** | drizzle-kit | prisma migrate |
| **Studio** | Drizzle Studio | Prisma Studio |
| **Learning curve** | Low (if you know SQL) | Low (if you know ORMs) |
| **Best for** | SQL-savvy teams, edge | Rapid development, beginners |

---

## Best Practices

1. **ALWAYS define relations** in schema — enables relational query API
2. **ALWAYS use the SQL-like API** for complex queries — more control than relational API
3. **ALWAYS add indexes** in schema definition — not just migration
4. **ALWAYS use transactions** for multi-table writes
5. **NEVER fetch all columns** when you only need a few — use select with specific fields

---

## Enforcement Checklist

- [ ] Schema defined in TypeScript with proper types
- [ ] Relations defined for all foreign keys
- [ ] Indexes defined in schema (not just migrations)
- [ ] Migrations tracked in version control
- [ ] Transactions used for multi-table operations
- [ ] Raw SQL used for complex analytics queries
