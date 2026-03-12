# Migration Tools

> **Domain:** Database > Migrations > Tools
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Choosing the right migration tool determines how safely and efficiently your team manages schema changes. Each tool has different philosophies (imperative vs declarative, SQL vs code), different ecosystem support, and different production safety features. Using the wrong tool leads to migration failures, data loss, and development friction. Using the right tool makes schema changes routine, reviewable, and safe. Every project MUST select a migration tool during initial setup — retrofitting one later is painful.

---

## How It Works

### Tool Landscape

```
Migration Tool Categories:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  LANGUAGE-AGNOSTIC (SQL-based)                            │
│  ├── Flyway         — Java/JVM, SQL migrations            │
│  ├── Liquibase      — Java/JVM, XML/YAML/SQL             │
│  └── golang-migrate — Go, raw SQL files                  │
│                                                            │
│  ORM-INTEGRATED                                            │
│  ├── Prisma Migrate — Node.js, schema-first declarative  │
│  ├── Alembic        — Python, SQLAlchemy integration      │
│  ├── TypeORM        — Node.js, decorator-based           │
│  ├── Drizzle Kit    — Node.js, TypeScript schemas        │
│  ├── GORM AutoMigrate — Go (dev only, NOT for prod)     │
│  └── Ent Migrate    — Go, code-generated schemas         │
│                                                            │
│  MODERN / DECLARATIVE                                     │
│  ├── Atlas          — Go, declarative HCL/SQL            │
│  ├── Sqitch         — Perl, dependency-based             │
│  └── dbmate         — Go, lightweight SQL migrations     │
│                                                            │
│  MYSQL ONLINE DDL                                         │
│  ├── gh-ost         — GitHub, binary log based           │
│  └── pt-osc         — Percona, trigger-based             │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### golang-migrate

```
Best for: Go projects, raw SQL control, language-agnostic

Features:
  ✅ Pure SQL migrations (no Go code required)
  ✅ CLI + Go library usage
  ✅ Supports 20+ databases
  ✅ Dirty state detection
  ✅ Docker image available
  ❌ No declarative schema diffing
  ❌ No automatic migration generation
```

```bash
# Installation
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Create migration
migrate create -ext sql -dir migrations -seq create_users

# This creates:
# migrations/000001_create_users.up.sql
# migrations/000001_create_users.down.sql
```

```sql
-- migrations/000001_create_users.up.sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- migrations/000001_create_users.down.sql
DROP TABLE IF EXISTS users;
```

```bash
# Apply all pending migrations
migrate -path migrations -database "postgresql://user:pass@localhost/mydb?sslmode=require" up

# Apply N migrations
migrate -path migrations -database $DB_URL up 2

# Rollback last migration
migrate -path migrations -database $DB_URL down 1

# Force version (fix dirty state)
migrate -path migrations -database $DB_URL force 1

# Show current version
migrate -path migrations -database $DB_URL version
```

```go
// Go — golang-migrate library usage
package main

import (
    "github.com/golang-migrate/migrate/v4"
    _ "github.com/golang-migrate/migrate/v4/database/postgres"
    _ "github.com/golang-migrate/migrate/v4/source/file"
)

func RunMigrations(dbURL string) error {
    m, err := migrate.New("file://migrations", dbURL)
    if err != nil {
        return err
    }
    defer m.Close()

    if err := m.Up(); err != nil && err != migrate.ErrNoChange {
        return err
    }
    return nil
}
```

### Prisma Migrate

```
Best for: Node.js/TypeScript projects using Prisma ORM

Features:
  ✅ Declarative schema (schema.prisma)
  ✅ Auto-generates SQL migrations from schema diff
  ✅ Type-safe — migrations match Prisma Client
  ✅ Shadow database for safe diffing
  ✅ Migration history in _prisma_migrations table
  ❌ Tied to Prisma ecosystem
  ❌ Shadow database requires CREATE DATABASE permission
```

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  role      Role     @default(USER)
  orders    Order[]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
  @@index([createdAt])
}

model Order {
  id        String      @id @default(uuid())
  userId    String      @map("user_id")
  user      User        @relation(fields: [userId], references: [id])
  total     Decimal     @db.Decimal(10, 2)
  status    OrderStatus @default(PENDING)
  items     OrderItem[]
  createdAt DateTime    @default(now()) @map("created_at")

  @@map("orders")
  @@index([userId, createdAt])
}

enum Role {
  USER
  ADMIN
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
}
```

```bash
# Generate migration from schema changes
npx prisma migrate dev --name add_phone_column
# 1. Diffs schema.prisma against current database
# 2. Generates SQL migration file
# 3. Applies migration
# 4. Regenerates Prisma Client

# Generated file: prisma/migrations/20260310_add_phone_column/migration.sql

# Apply migrations in production (no interactive prompts)
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

```sql
-- Generated migration: prisma/migrations/20260310_add_phone_column/migration.sql
-- This file is auto-generated but can be manually edited before applying

ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(20);
```

### Alembic (SQLAlchemy)

```
Best for: Python projects using SQLAlchemy

Features:
  ✅ Auto-generates from SQLAlchemy model changes
  ✅ Branch and merge support (parallel development)
  ✅ Python migration scripts (full language power)
  ✅ Offline mode (generate SQL without connecting)
  ❌ Requires SQLAlchemy models
  ❌ Auto-generation may miss some changes
```

```bash
# Initialize Alembic
alembic init alembic

# Generate migration from model changes
alembic revision --autogenerate -m "add phone column"

# Apply all pending
alembic upgrade head

# Rollback one step
alembic downgrade -1

# Show current revision
alembic current

# Show migration history
alembic history
```

```python
# alembic/versions/abc123_add_phone_column.py
"""add phone column

Revision ID: abc123
Revises: def456
Create Date: 2026-03-10 12:00:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'abc123'
down_revision = 'def456'

def upgrade():
    op.add_column('users', sa.Column('phone', sa.String(20), nullable=True))

def downgrade():
    op.drop_column('users', 'phone')
```

```python
# Advanced Alembic: data migration with batch processing
def upgrade():
    # Schema change
    op.add_column('users',
        sa.Column('normalized_email', sa.String(255), nullable=True))

    # Data migration in batches
    conn = op.get_bind()
    while True:
        result = conn.execute(sa.text("""
            UPDATE users SET normalized_email = LOWER(email)
            WHERE normalized_email IS NULL
            AND id IN (
                SELECT id FROM users WHERE normalized_email IS NULL LIMIT 1000
            )
        """))
        if result.rowcount == 0:
            break

    # Add constraint after backfill
    op.create_check_constraint(
        'ck_users_normalized_email_not_null',
        'users',
        'normalized_email IS NOT NULL'
    )

def downgrade():
    op.drop_constraint('ck_users_normalized_email_not_null', 'users')
    op.drop_column('users', 'normalized_email')
```

### Drizzle Kit

```
Best for: TypeScript projects using Drizzle ORM

Features:
  ✅ TypeScript schema definitions
  ✅ Auto-generates SQL from schema diff
  ✅ Drizzle Studio (visual browser)
  ✅ Lightweight, SQL-first philosophy
  ❌ Newer tool, smaller ecosystem
  ❌ Less mature than Prisma Migrate
```

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

```bash
# Generate migration
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# Push schema directly (development only, no migration files)
npx drizzle-kit push

# Open Drizzle Studio
npx drizzle-kit studio
```

### Atlas

```
Best for: Declarative schema management, CI/CD integration

Features:
  ✅ Declarative HCL or SQL schema
  ✅ Auto-generates safe migrations from diff
  ✅ Lint migrations for safety (destructive changes)
  ✅ CI/CD integration with GitHub Actions
  ✅ Schema visualization
  ❌ Newer tool, learning curve for HCL syntax
  ❌ Some features require paid plan
```

```hcl
// schema.hcl — Atlas declarative schema
schema "public" {}

table "users" {
  schema = schema.public
  column "id" {
    type = uuid
    default = sql("gen_random_uuid()")
  }
  column "email" {
    type = varchar(255)
    null = false
  }
  column "name" {
    type = varchar(255)
    null = false
  }
  column "created_at" {
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_users_email" {
    columns = [column.email]
    unique  = true
  }
}
```

```bash
# Generate migration from schema diff
atlas migrate diff add_phone \
  --dir "file://migrations" \
  --to "file://schema.hcl" \
  --dev-url "postgresql://localhost/dev?sslmode=disable"

# Apply migrations
atlas migrate apply \
  --dir "file://migrations" \
  --url "postgresql://localhost/myapp?sslmode=require"

# Lint migrations for safety
atlas migrate lint \
  --dir "file://migrations" \
  --dev-url "postgresql://localhost/dev?sslmode=disable" \
  --latest 1

# Output (warns about destructive operations):
# Destructive changes detected:
#   L3: Dropping column "old_field" — data will be lost
```

```yaml
# GitHub Actions — Atlas CI/CD
name: Atlas Migration CI
on: pull_request

jobs:
  lint:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: dev
          POSTGRES_PASSWORD: pass
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - uses: ariga/setup-atlas@v0
      - name: Lint migrations
        run: |
          atlas migrate lint \
            --dir "file://migrations" \
            --dev-url "postgresql://postgres:pass@localhost/dev?sslmode=disable" \
            --latest 1
```

### Flyway

```
Best for: Java/JVM projects, enterprise environments

Features:
  ✅ SQL or Java migrations
  ✅ Versioned + repeatable migrations
  ✅ Schema validation on startup
  ✅ Callbacks (before/after migrate)
  ✅ Teams edition: undo, dry-run, cherry-pick
  ❌ JVM dependency (even for CLI)
  ❌ Advanced features require paid license
```

```bash
# Flyway directory structure
flyway/
├── conf/
│   └── flyway.conf
└── sql/
    ├── V1__create_users.sql          # Versioned
    ├── V2__create_orders.sql         # Versioned
    ├── V3__add_user_phone.sql        # Versioned
    └── R__create_views.sql           # Repeatable (re-run on change)

# Apply migrations
flyway -url=jdbc:postgresql://localhost/mydb migrate

# Show info
flyway info

# Validate (check applied migrations match files)
flyway validate

# Repair (fix failed migration state)
flyway repair
```

```sql
-- V1__create_users.sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- R__create_views.sql (repeatable — re-applied whenever file changes)
CREATE OR REPLACE VIEW active_users AS
SELECT * FROM users WHERE active = true;
```

### dbmate

```
Best for: Simple projects, Docker/containers, framework-agnostic

Features:
  ✅ Single binary (no runtime dependencies)
  ✅ Raw SQL migrations only
  ✅ Database creation support
  ✅ Schema dump (schema.sql)
  ✅ Tiny Docker image
  ❌ No auto-generation from models
  ❌ No declarative schema management
```

```bash
# Install
brew install dbmate  # macOS
# or download binary from GitHub releases

# Create migration
dbmate new add_users_table

# Apply pending migrations
dbmate up

# Rollback last migration
dbmate down

# Dump schema
dbmate dump

# Migration files:
# db/migrations/20260310120000_add_users_table.sql
```

```sql
-- db/migrations/20260310120000_add_users_table.sql
-- migrate:up
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- migrate:down
DROP TABLE users;
```

### Tool Comparison Matrix

```
┌─────────────────┬──────────┬──────────┬──────────┬─────────┬──────────┐
│ Feature          │ golang-  │ Prisma   │ Alembic  │ Atlas   │ Flyway   │
│                  │ migrate  │ Migrate  │          │         │          │
├─────────────────┼──────────┼──────────┼──────────┼─────────┼──────────┤
│ Language         │ Go/Any   │ Node.js  │ Python   │ Go/Any  │ JVM/Any  │
│ Migration Type   │ SQL      │ Decl+SQL │ Python   │ HCL/SQL │ SQL/Java │
│ Auto-generate    │ No       │ Yes      │ Yes      │ Yes     │ No       │
│ Declarative      │ No       │ Yes      │ No       │ Yes     │ No       │
│ Rollback         │ Yes      │ No*      │ Yes      │ No*     │ Paid     │
│ CI/CD Support    │ CLI      │ CLI      │ CLI      │ GitHub  │ CLI      │
│ Safety Lint      │ No       │ No       │ No       │ Yes     │ No       │
│ Transactional DDL│ DB-dep   │ DB-dep   │ DB-dep   │ DB-dep  │ DB-dep   │
│ Learning Curve   │ Low      │ Low      │ Medium   │ Medium  │ Low      │
│ Multi-database   │ 20+      │ 4        │ Many     │ Many    │ Many     │
│ Maturity         │ High     │ High     │ Very High│ Growing │ Very High│
│ License          │ MIT      │ Apache   │ MIT      │ Apache* │ Apache*  │
└─────────────────┴──────────┴──────────┴──────────┴─────────┴──────────┘

* Prisma: uses "forward-only" approach, creates new migration to fix
* Atlas: prefers forward-only, diff-based corrections
* Atlas/Flyway: some features in paid tier
```

### Selection Guide

```
Decision Tree for Migration Tool Selection:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  Using Prisma ORM?                                        │
│  └── YES → Prisma Migrate                                │
│                                                            │
│  Using SQLAlchemy?                                        │
│  └── YES → Alembic                                       │
│                                                            │
│  Using Drizzle ORM?                                       │
│  └── YES → Drizzle Kit                                   │
│                                                            │
│  Using TypeORM?                                           │
│  └── YES → TypeORM migrations                            │
│                                                            │
│  Go project without ORM?                                  │
│  └── YES → golang-migrate (simple) or Atlas (declarative)│
│                                                            │
│  JVM/Java project?                                        │
│  └── YES → Flyway                                        │
│                                                            │
│  Polyglot team / language-agnostic needed?                │
│  └── YES → Atlas or golang-migrate or dbmate             │
│                                                            │
│  Want migration safety linting in CI?                     │
│  └── YES → Atlas                                         │
│                                                            │
│  Simplest possible tool?                                  │
│  └── YES → dbmate                                        │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## Best Practices

1. **ALWAYS choose a migration tool at project start** — retrofitting is painful
2. **ALWAYS use your ORM's migration tool** if available — Prisma Migrate, Alembic, Drizzle Kit
3. **ALWAYS store migrations in version control** — migrations are part of the codebase
4. **ALWAYS review generated migrations** before applying — auto-generation can produce unsafe DDL
5. **ALWAYS test migrations on staging** with production-like data before production deploy
6. **ALWAYS have a CI step** that validates migration files (lint, syntax, safety)
7. **NEVER use ORM auto-migrate** (GORM AutoMigrate, Prisma db push) in production — no versioning
8. **NEVER mix migration tools** in one project — one tool per database
9. **NEVER manually edit applied migration files** — create new migrations for changes
10. **NEVER skip migration code review** — schema changes deserve the same scrutiny as application code

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No migration tool | Manual DDL, schema drift | Adopt tool at project start |
| AutoMigrate in production | No versioning, no rollback | Use proper migration tool |
| Not reviewing generated SQL | Unsafe DDL in production | Always review before applying |
| Multiple migration tools | Conflicting state tracking | One tool per database |
| Skipping staging test | Unknown migration duration | Test on production-sized data |
| No CI validation | Bad migrations reach production | Add lint/validate to CI pipeline |
| Editing applied migrations | Checksum mismatches | Create new migration |
| No rollback strategy | Stuck on failed migration | Write DOWN migrations or forward-fix plan |
| Tool mismatch for ecosystem | Integration friction | Use ORM-native tool when available |
| Manual production migrations | No audit trail, human error | Automate through CI/CD |

---

## Enforcement Checklist

- [ ] Migration tool selected and documented in project README
- [ ] Migration tool matches ORM/framework ecosystem
- [ ] All migrations stored in version control
- [ ] Generated migrations reviewed before merging
- [ ] CI pipeline validates migration files
- [ ] Migrations tested on staging with production data volume
- [ ] Rollback strategy defined (DOWN migrations or forward-fix)
- [ ] Migration execution automated in deployment pipeline
- [ ] No manual DDL in any environment
- [ ] Team trained on migration workflow
