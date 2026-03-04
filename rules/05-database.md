---
paths:
  - "src/**/repositories/**"
  - "src/**/migrations/**"
  - "src/**/models/**"
  - "src/**/entities/**"
  - "src/**/database/**"
---
## Database & Migration Rules

### Migration Standards
- Every schema change = versioned migration script (never manual DB changes)
- Migrations are IMMUTABLE after deployment — never edit deployed migrations
- One change per migration — atomic, focused, debuggable
- Naming: YYYYMMDDHHMMSS_descriptive_name (e.g., 20250304120000_add_users_email_index)
- Every migration MUST have a rollback/down script
- Test migrations in staging before production — always

### Backward-Compatible Migrations (Enforced)
Phase approach for breaking changes:
1. ADD new column/table (nullable or with default) — deploy
2. DUAL WRITE to old and new — deploy application
3. MIGRATE existing data
4. READ from new source — deploy application
5. DROP old column/table — only after confirming stability
- NEVER drop columns/tables in the same release they stop being used
- NEVER rename columns directly — add new, migrate, drop old

### Query Rules
- NEVER construct SQL via string concatenation — parameterized queries only
- NEVER execute queries inside loops — use eager loading, batch queries, or JOINs
- ALWAYS use database indexes for columns in WHERE, JOIN, ORDER BY
- ALWAYS paginate — no query should return unbounded results
- Use EXPLAIN/ANALYZE for queries touching large tables
- Set query timeouts — no query should run indefinitely

### Connection Management
- Use connection pooling — never open/close connections per request
- Set maximum pool size appropriate for the database server
- Handle connection failures gracefully — implement retry with exponential backoff
- Close connections in finally/cleanup blocks

### Schema Design
- Every table has: id (primary key), created_at (timestamp), updated_at (timestamp)
- Use UUIDs for public-facing IDs — auto-increment for internal only
- Define foreign keys with appropriate CASCADE/SET NULL behavior
- Add CHECK constraints for business rules at database level
- Use appropriate data types — don't store numbers as strings
- Add comments to tables and columns explaining business purpose

### Data Integrity
- Use database transactions for multi-step operations
- Implement optimistic locking for concurrent updates (version column)
- Validate data at application level AND database level (constraints)
- Never trust application-level uniqueness — enforce with unique indexes

### Seeding & Test Data
- Seed files for reference data (types, statuses, categories)
- Separate seed scripts for development vs production
- Test fixtures use factories — never hardcode IDs
- Never seed sensitive data in version control
