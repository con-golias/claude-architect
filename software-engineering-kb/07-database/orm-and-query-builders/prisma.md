# Prisma ORM

> **Domain:** Database > ORM & Query Builders > Prisma
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Prisma is the most popular TypeScript ORM, providing type-safe database access with a declarative schema, auto-generated client, and built-in migrations. Unlike traditional ORMs that map objects to tables (Active Record/Data Mapper), Prisma generates a fully typed client from a schema file — every query returns precisely typed results, and invalid queries are caught at compile time. Prisma is the default choice for TypeScript/Node.js applications that prioritize developer experience and type safety.

---

## How It Works

### Prisma Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  role      Role     @default(USER)
  posts     Post[]
  profile   Profile?
  orders    Order[]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
  @@index([email])
}

model Post {
  id        String   @id @default(uuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String   @map("author_id")
  tags      Tag[]
  createdAt DateTime @default(now()) @map("created_at")

  @@map("posts")
  @@index([authorId])
}

model Profile {
  id     String @id @default(uuid())
  bio    String?
  avatar String?
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId String @unique @map("user_id")

  @@map("profiles")
}

model Order {
  id        String      @id @default(uuid())
  total     Decimal     @db.Decimal(10, 2)
  status    OrderStatus @default(PENDING)
  user      User        @relation(fields: [userId], references: [id])
  userId    String      @map("user_id")
  items     OrderItem[]
  createdAt DateTime    @default(now()) @map("created_at")

  @@map("orders")
  @@index([userId, createdAt(sort: Desc)])
}

model OrderItem {
  id        String @id @default(uuid())
  order     Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId   String @map("order_id")
  productId String @map("product_id")
  quantity  Int
  price     Decimal @db.Decimal(10, 2)

  @@map("order_items")
}

model Tag {
  id    String @id @default(uuid())
  name  String @unique
  posts Post[]

  @@map("tags")
}

enum Role {
  USER
  ADMIN
  MODERATOR
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}
```

### CRUD Operations

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// CREATE
const user = await prisma.user.create({
  data: {
    email: 'alice@example.com',
    name: 'Alice',
    profile: {
      create: { bio: 'Software engineer' },  // nested create
    },
  },
  include: { profile: true },  // include relation in result
});

// READ — find unique
const foundUser = await prisma.user.findUnique({
  where: { email: 'alice@example.com' },
  include: {
    posts: { where: { published: true }, orderBy: { createdAt: 'desc' } },
    profile: true,
  },
});

// READ — find many with filtering
const users = await prisma.user.findMany({
  where: {
    role: 'USER',
    posts: { some: { published: true } },  // filter by relation
    createdAt: { gte: new Date('2024-01-01') },
  },
  select: {   // select specific fields (not include)
    id: true,
    name: true,
    email: true,
    _count: { select: { posts: true } },
  },
  orderBy: { createdAt: 'desc' },
  skip: 0,
  take: 20,
});

// UPDATE
const updated = await prisma.user.update({
  where: { id: user.id },
  data: {
    name: 'Alice Smith',
    profile: {
      update: { bio: 'Senior software engineer' },
    },
  },
});

// UPSERT
const upserted = await prisma.user.upsert({
  where: { email: 'bob@example.com' },
  create: { email: 'bob@example.com', name: 'Bob' },
  update: { name: 'Bob Updated' },
});

// DELETE
await prisma.user.delete({ where: { id: user.id } });

// DELETE many
await prisma.post.deleteMany({
  where: { published: false, createdAt: { lt: new Date('2023-01-01') } },
});
```

### Transactions

```typescript
// Interactive transaction
const [order, updatedUser] = await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({
    data: {
      userId: 'user-123',
      total: 99.99,
      items: {
        create: [
          { productId: 'prod-1', quantity: 2, price: 29.99 },
          { productId: 'prod-2', quantity: 1, price: 40.01 },
        ],
      },
    },
  });

  const updatedUser = await tx.user.update({
    where: { id: 'user-123' },
    data: { updatedAt: new Date() },
  });

  return [order, updatedUser];
});

// Sequential transaction (batch)
const [users, posts] = await prisma.$transaction([
  prisma.user.findMany({ where: { role: 'ADMIN' } }),
  prisma.post.count({ where: { published: true } }),
]);
```

### Raw SQL (escape hatch)

```typescript
// Raw SQL when Prisma API is insufficient
const result = await prisma.$queryRaw<{ month: string; revenue: number }[]>`
  SELECT
    DATE_TRUNC('month', created_at) AS month,
    SUM(total)::float AS revenue
  FROM orders
  WHERE created_at > ${startDate}
  GROUP BY month
  ORDER BY month DESC
`;

// Raw execute (INSERT, UPDATE, DELETE)
await prisma.$executeRaw`
  UPDATE orders SET status = 'CANCELLED'
  WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '30 days'
`;
```

### Migrations

```bash
# Generate migration from schema changes
npx prisma migrate dev --name add_user_role

# Apply migrations in production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Generate Prisma Client (after schema changes)
npx prisma generate

# Introspect existing database → generate schema
npx prisma db pull
```

---

## Best Practices

1. **ALWAYS use `select` or `include`** — never fetch all fields and relations by default
2. **ALWAYS use transactions** for multi-table operations — atomic consistency
3. **ALWAYS use `$queryRaw`** for complex analytics — Prisma API struggles with CTEs, window functions
4. **ALWAYS map to snake_case** with `@@map` and `@map` — match database conventions
5. **ALWAYS add indexes** in schema for query performance — `@@index([field])`
6. **NEVER use `findMany` without pagination** — unbounded queries on large tables
7. **NEVER eager-load deeply nested relations** — causes N+1 or huge queries
8. **NEVER skip `prisma generate`** after schema changes — client will be out of sync

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No select/include | Fetching all columns and relations | Use select for specific fields |
| findMany without take/skip | Unbounded result sets | Always paginate |
| Deep nested includes | N+1 queries, slow response | Limit depth, use raw SQL for complex |
| No @@index in schema | Slow queries, missing DB indexes | Add indexes for filtered/sorted fields |
| Using Prisma for analytics | Slow, complex generated SQL | Use $queryRaw for reports |
| Not running prisma generate | Type errors, stale client | Run after every schema change |

---

## Enforcement Checklist

- [ ] Prisma schema defines all models with proper types
- [ ] @@map and @map used for snake_case database columns
- [ ] Indexes defined for frequently queried fields
- [ ] Select/include used (no implicit full-fetch)
- [ ] Pagination (take/skip) on all findMany
- [ ] Transactions used for multi-table writes
- [ ] Raw SQL used for complex queries
- [ ] Migrations tracked in version control
