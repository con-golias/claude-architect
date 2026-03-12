# Soft Deletes & Audit Trails

> **Domain:** Database > Data Modeling
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Hard deletes (DELETE FROM) permanently destroy data. Once deleted, you cannot answer "who deleted this?", "when was it deleted?", "what did it look like before?", or "can we restore it?". Soft deletes mark records as inactive instead of removing them, enabling recovery, audit trails, and legal compliance (GDPR right to erasure requires knowing what existed). Audit logging tracks every change — who modified what, when, and what the previous value was. Together, soft deletes and audit trails are essential for any system handling financial, medical, legal, or user data.

---

## How It Works

### Soft Delete Strategies

#### Strategy 1: Boolean Flag

```sql
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    name        VARCHAR(100) NOT NULL,
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- "Delete" = set flag
UPDATE users SET is_deleted = TRUE, updated_at = NOW() WHERE id = 42;

-- All queries MUST filter by is_deleted
CREATE INDEX idx_users_active ON users(id) WHERE NOT is_deleted;

-- Application queries always add filter
SELECT * FROM users WHERE NOT is_deleted AND email = 'alice@example.com';
```

**Problem:** Easy to forget `WHERE NOT is_deleted` and leak "deleted" records.

#### Strategy 2: Timestamp Column (Preferred)

```sql
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    name        VARCHAR(100) NOT NULL,
    deleted_at  TIMESTAMPTZ,  -- NULL = active, timestamp = deleted
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- "Delete" = set timestamp
UPDATE users SET deleted_at = NOW() WHERE id = 42;

-- Restore = clear timestamp
UPDATE users SET deleted_at = NULL WHERE id = 42;

-- Partial index for active records only
CREATE INDEX idx_users_active ON users(email) WHERE deleted_at IS NULL;

-- View for convenience
CREATE VIEW active_users AS
SELECT * FROM users WHERE deleted_at IS NULL;
```

**Timestamp advantages over boolean:**
- Know WHEN the record was deleted
- Can implement retention policies (`DELETE FROM users WHERE deleted_at < NOW() - INTERVAL '90 days'`)
- Sortable by deletion date

#### Strategy 3: Status Column

```sql
CREATE TABLE accounts (
    id      SERIAL PRIMARY KEY,
    email   VARCHAR(255) NOT NULL,
    status  VARCHAR(20) NOT NULL DEFAULT 'active'
            CHECK (status IN ('active', 'suspended', 'deleted', 'archived')),
    -- ...
);

-- More nuanced than binary active/deleted
-- "suspended" accounts can be reactivated, "deleted" cannot
```

---

### Handling Unique Constraints with Soft Deletes

```sql
-- PROBLEM: email must be unique for active users, but a deleted user
-- should not block a new user with the same email.

-- BAD: Simple unique constraint blocks reuse
ALTER TABLE users ADD CONSTRAINT uq_email UNIQUE (email);
-- After soft-deleting alice@example.com, new Alice cannot sign up!

-- GOOD: Partial unique index (PostgreSQL)
CREATE UNIQUE INDEX uq_users_email_active
ON users(email)
WHERE deleted_at IS NULL;
-- Only active records must have unique emails
-- Deleted records can share email with active records

-- ALTERNATIVE: Move email on soft delete
UPDATE users
SET email = email || '::deleted::' || id::text,
    deleted_at = NOW()
WHERE id = 42;
-- Original email freed for reuse, deleted record keeps modified reference
```

---

### Soft Delete in Application Code

```typescript
// TypeScript — Prisma middleware for soft deletes
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Middleware: intercept delete operations
prisma.$use(async (params, next) => {
  if (params.action === 'delete') {
    // Change delete to soft delete
    params.action = 'update';
    params.args.data = { deletedAt: new Date() };
  }

  if (params.action === 'deleteMany') {
    params.action = 'updateMany';
    if (params.args.data !== undefined) {
      params.args.data.deletedAt = new Date();
    } else {
      params.args.data = { deletedAt: new Date() };
    }
  }

  // Auto-filter deleted records on find operations
  if (params.action === 'findFirst' || params.action === 'findMany') {
    if (!params.args.where) params.args.where = {};
    if (params.args.where.deletedAt === undefined) {
      params.args.where.deletedAt = null; // only active records
    }
  }

  return next(params);
});
```

```go
// Go — soft delete with GORM
type BaseModel struct {
    ID        uint           `gorm:"primarykey"`
    CreatedAt time.Time
    UpdatedAt time.Time
    DeletedAt gorm.DeletedAt `gorm:"index"` // GORM built-in soft delete
}

type User struct {
    BaseModel
    Email string `gorm:"uniqueIndex:idx_email_active,where:deleted_at IS NULL"`
    Name  string
}

// GORM automatically adds WHERE deleted_at IS NULL to all queries
db.Find(&users)         // SELECT * FROM users WHERE deleted_at IS NULL
db.Delete(&user, 42)    // UPDATE users SET deleted_at=NOW() WHERE id=42
db.Unscoped().Find(&users) // SELECT * FROM users (includes deleted)
```

```python
# Python — SQLAlchemy soft delete mixin
from datetime import datetime
from sqlalchemy import Column, DateTime, event
from sqlalchemy.orm import Query

class SoftDeleteMixin:
    deleted_at = Column(DateTime, nullable=True, index=True)

    def soft_delete(self):
        self.deleted_at = datetime.utcnow()

    def restore(self):
        self.deleted_at = None

    @property
    def is_deleted(self):
        return self.deleted_at is not None

class SoftDeleteQuery(Query):
    def __new__(cls, *args, **kwargs):
        obj = super().__new__(cls)
        obj._with_deleted = kwargs.pop('_with_deleted', False)
        return obj

    def __init__(self, *args, **kwargs):
        kwargs.pop('_with_deleted', None)
        super().__init__(*args, **kwargs)

    def _execute(self):
        if not self._with_deleted:
            self = self.filter_by(deleted_at=None)
        return super()._execute()

class User(Base, SoftDeleteMixin):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    email = Column(String, nullable=False)
    name = Column(String, nullable=False)
```

---

### Audit Trail Patterns

#### Pattern 1: History Table (Mirror Table)

```sql
-- Main table
CREATE TABLE products (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    price       DECIMAL(10,2) NOT NULL,
    category    VARCHAR(50),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- History table (mirrors main table + audit columns)
CREATE TABLE products_history (
    history_id      SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL,  -- FK not enforced (product may be deleted)
    name            VARCHAR(200),
    price           DECIMAL(10,2),
    category        VARCHAR(50),
    operation       VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    changed_by      INTEGER,           -- user who made the change
    changed_at      TIMESTAMPTZ DEFAULT NOW(),
    old_values      JSONB,             -- previous values (for UPDATE)
    new_values      JSONB              -- new values (for INSERT/UPDATE)
);

CREATE INDEX idx_products_history_product ON products_history(product_id, changed_at);

-- Trigger for automatic audit logging
CREATE OR REPLACE FUNCTION audit_products()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO products_history (product_id, operation, new_values, changed_at)
        VALUES (NEW.id, 'INSERT', to_jsonb(NEW), NOW());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO products_history (product_id, name, price, category, operation,
                                      old_values, new_values, changed_at)
        VALUES (NEW.id, NEW.name, NEW.price, NEW.category, 'UPDATE',
                to_jsonb(OLD), to_jsonb(NEW), NOW());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO products_history (product_id, operation, old_values, changed_at)
        VALUES (OLD.id, 'DELETE', to_jsonb(OLD), NOW());
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_products
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW
    EXECUTE FUNCTION audit_products();
```

#### Pattern 2: Event Sourcing Table

```sql
-- All changes stored as immutable events
CREATE TABLE entity_events (
    id            BIGSERIAL PRIMARY KEY,
    entity_type   VARCHAR(50) NOT NULL,
    entity_id     VARCHAR(100) NOT NULL,
    event_type    VARCHAR(50) NOT NULL,
    payload       JSONB NOT NULL,
    metadata      JSONB DEFAULT '{}',  -- user_id, ip, request_id
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entity_events_lookup
    ON entity_events(entity_type, entity_id, created_at);

-- Example events:
-- {entity_type:'user', entity_id:'42', event_type:'UserCreated', payload:{name:'Alice'}}
-- {entity_type:'user', entity_id:'42', event_type:'EmailChanged', payload:{old:'a@x.com', new:'a@y.com'}}
-- {entity_type:'user', entity_id:'42', event_type:'UserDeleted', payload:{reason:'Account closed'}}

-- Reconstruct current state by replaying events
SELECT * FROM entity_events
WHERE entity_type = 'user' AND entity_id = '42'
ORDER BY created_at;
```

#### Pattern 3: Change Data Capture (CDC)

```
┌──────────────┐    WAL/Binlog    ┌──────────┐    Events    ┌──────────┐
│  PostgreSQL  │─────────────────►│ Debezium │────────────►│  Kafka   │
│              │                  │  (CDC)   │             │  (audit  │
│  WAL captures│                  │          │             │   topic) │
│  every change│                  └──────────┘             └──────────┘
└──────────────┘

CDC captures changes from the database transaction log.
No triggers needed. No application changes. Zero overhead on writes.
Events delivered to Kafka for audit storage, analytics, replication.
```

---

### Data Retention & Hard Delete

```sql
-- Retention policy: hard delete soft-deleted records after 90 days
-- Run as scheduled job (cron/pg_cron)
DELETE FROM users
WHERE deleted_at IS NOT NULL
  AND deleted_at < NOW() - INTERVAL '90 days';

-- For GDPR right to erasure: anonymize instead of delete
UPDATE users
SET name = 'Deleted User',
    email = 'deleted-' || id || '@example.com',
    phone = NULL,
    address = NULL,
    deleted_at = NOW()
WHERE id = 42;
```

---

## Best Practices

1. **ALWAYS use `deleted_at` timestamp** over boolean for soft deletes — you need to know WHEN
2. **ALWAYS use partial unique indexes** to handle uniqueness with soft deletes
3. **ALWAYS create a view for active records** — prevents forgetting the filter
4. **ALWAYS implement audit logging for sensitive data** (financial, medical, PII)
5. **ALWAYS include who made the change** in audit records (user ID, IP address)
6. **ALWAYS use triggers for audit logging** — application code can be bypassed
7. **ALWAYS plan a retention policy** — soft-deleted data cannot accumulate forever
8. **NEVER hard delete without a soft delete period** — unless the data is truly ephemeral
9. **NEVER forget to filter soft-deleted records** in application queries
10. **ALWAYS use CDC over triggers** for high-throughput systems — zero write overhead

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Forgetting WHERE deleted_at IS NULL | "Deleted" users appear in search results | Use views or ORM middleware |
| No partial unique index | Cannot reuse email after soft delete | CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL |
| No audit logging | Cannot determine who changed what | Add history table with trigger |
| Audit in application code only | Direct SQL changes not captured | Use triggers or CDC |
| No retention policy | Soft-deleted data grows forever | Schedule hard delete after retention period |
| Boolean soft delete | Cannot tell when record was deleted | Use timestamptz deleted_at |
| Audit table without indexes | Slow audit queries | Index on (entity_id, changed_at) |
| Hard delete for GDPR | Cannot prove data was deleted if asked | Soft delete + anonymize + audit trail |

---

## Real-world Examples

### Stripe
- Soft deletes on all financial entities (charges, customers, subscriptions)
- Full audit trail for every state change (PCI DSS requirement)
- Events API exposes change history to merchants
- 7-year retention for financial records

### GitHub
- Soft delete on repositories (30-day recovery window)
- Audit log for enterprise customers (who did what, when)
- Git reflog provides history of all branch changes
- CDC-based system for event streaming

### Slack
- Soft delete on messages (can be "undeleted" briefly)
- Full audit trail for Enterprise Grid (compliance requirement)
- Retention policies configurable per workspace
- Data export for legal holds

---

## Enforcement Checklist

- [ ] Soft delete strategy chosen (deleted_at timestamp preferred)
- [ ] Partial unique indexes created for unique constraints with soft deletes
- [ ] Active-record views or ORM middleware preventing leaked deleted records
- [ ] Audit trail implemented for sensitive/regulated data
- [ ] Audit trigger captures INSERT, UPDATE, DELETE with old/new values
- [ ] Audit records include changed_by (user ID) and metadata
- [ ] Retention policy defined (how long to keep soft-deleted data)
- [ ] GDPR erasure process documented (anonymize + audit)
- [ ] Hard delete job scheduled for expired soft-deleted records
- [ ] Audit table indexed for efficient history queries
