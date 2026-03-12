# Database Access Control

> **Domain:** Database > Security > Access Control
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Database access control is the first line of defense against unauthorized data access, privilege escalation, and insider threats. A misconfigured database that allows broad access — superuser credentials in application code, public-facing database ports, no role-based permissions — is the most common vector for data breaches. Every production database must implement the principle of least privilege: each user, application, and service should have the minimum permissions required to perform its function, nothing more.

---

## How It Works

### Access Control Layers

```
Defense in Depth:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Layer 1: Network Access                              │
│  ┌────────────────────────────────────────┐           │
│  │ Firewall / Security Group              │           │
│  │ • Only allow port 5432 from app subnet │           │
│  │ • Block all public access              │           │
│  │ • VPC peering for cross-service access │           │
│  └────────────────────────────────────────┘           │
│                                                        │
│  Layer 2: Authentication                              │
│  ┌────────────────────────────────────────┐           │
│  │ Who are you?                           │           │
│  │ • Username + password (scram-sha-256)  │           │
│  │ • Client certificates (mTLS)          │           │
│  │ • IAM authentication (cloud)          │           │
│  │ • LDAP / Active Directory             │           │
│  └────────────────────────────────────────┘           │
│                                                        │
│  Layer 3: Authorization                               │
│  ┌────────────────────────────────────────┐           │
│  │ What can you do?                       │           │
│  │ • Role-based access (GRANT/REVOKE)    │           │
│  │ • Schema-level permissions            │           │
│  │ • Table/column-level permissions      │           │
│  │ • Row-level security (RLS)            │           │
│  └────────────────────────────────────────┘           │
│                                                        │
│  Layer 4: Auditing                                    │
│  ┌────────────────────────────────────────┐           │
│  │ What did you do?                       │           │
│  │ • Query logging (pgAudit)             │           │
│  │ • Connection logging                  │           │
│  │ • DDL change tracking                 │           │
│  └────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────┘
```

---

### PostgreSQL Authentication (pg_hba.conf)

```bash
# pg_hba.conf: authentication rules (order matters — first match wins)
# TYPE    DATABASE    USER         ADDRESS          METHOD

# Local connections (Unix socket)
local   all         postgres                      peer        # OS user = DB user
local   all         all                           scram-sha-256

# Application connections (from app subnet only)
host    mydb        app_user     10.0.1.0/24      scram-sha-256
host    mydb        app_readonly 10.0.1.0/24      scram-sha-256

# Replication connections
host    replication  replicator  10.0.2.0/24      scram-sha-256

# Admin connections (specific IP only)
host    all         admin_user   10.0.0.5/32      scram-sha-256

# Certificate-based authentication
hostssl mydb        cert_user    10.0.1.0/24      cert clientcert=verify-full

# Block everything else
host    all         all          0.0.0.0/0        reject
```

---

### Role-Based Access Control (PostgreSQL)

```sql
-- Create roles (groups)
CREATE ROLE app_readwrite;
CREATE ROLE app_readonly;
CREATE ROLE app_admin;

-- Grant schema permissions
GRANT USAGE ON SCHEMA public TO app_readwrite, app_readonly;
GRANT CREATE ON SCHEMA public TO app_admin;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_readwrite;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_admin;

-- Future tables inherit permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_readwrite;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO app_readonly;

-- Grant sequence permissions (for serial/identity columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_readwrite;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_readwrite;

-- Create application users with roles
CREATE USER app_service WITH PASSWORD 'strong-password-here';
GRANT app_readwrite TO app_service;

CREATE USER analytics_user WITH PASSWORD 'another-strong-password';
GRANT app_readonly TO analytics_user;

CREATE USER dba_user WITH PASSWORD 'admin-password';
GRANT app_admin TO dba_user;

-- Restrict specific operations
REVOKE DELETE ON sensitive_table FROM app_readwrite;
-- App can INSERT/UPDATE but not DELETE from sensitive_table

-- Column-level permissions
GRANT SELECT (id, name, email) ON users TO app_readonly;
-- Cannot SELECT password_hash, ssn, etc.

-- Prevent schema changes by application user
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
-- Only app_admin can create/alter tables
```

---

### Row-Level Security (RLS)

```sql
-- RLS: rows visible depend on WHO is querying
-- Critical for multi-tenant applications

-- Enable RLS on table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: users see only their own orders
CREATE POLICY user_orders ON orders
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::bigint);

-- Policy: admins see all orders
CREATE POLICY admin_all_orders ON orders
    FOR ALL
    TO app_admin
    USING (true);

-- Multi-tenant: tenant isolation
ALTER TABLE customer_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customer_data
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Force RLS even for table owner
ALTER TABLE customer_data FORCE ROW LEVEL SECURITY;
```

```go
// Go — Set RLS context per request
func QueryWithTenantContext(ctx context.Context, pool *pgxpool.Pool, tenantID string) ([]Order, error) {
    conn, err := pool.Acquire(ctx)
    if err != nil {
        return nil, err
    }
    defer conn.Release()

    // Set tenant context for RLS
    _, err = conn.Exec(ctx,
        "SET LOCAL app.tenant_id = $1", tenantID)
    if err != nil {
        return nil, err
    }

    // Query — RLS automatically filters by tenant
    rows, err := conn.Query(ctx,
        "SELECT id, total, status FROM orders ORDER BY created_at DESC LIMIT 50")
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var orders []Order
    for rows.Next() {
        var o Order
        if err := rows.Scan(&o.ID, &o.Total, &o.Status); err != nil {
            return nil, err
        }
        orders = append(orders, o)
    }
    return orders, nil
}
```

---

### MySQL Access Control

```sql
-- MySQL: user and privilege management

-- Create users with specific host restrictions
CREATE USER 'app_user'@'10.0.1.%' IDENTIFIED BY 'strong-password';
CREATE USER 'analytics'@'10.0.2.%' IDENTIFIED BY 'another-password';

-- Grant database-level permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON mydb.* TO 'app_user'@'10.0.1.%';
GRANT SELECT ON mydb.* TO 'analytics'@'10.0.2.%';

-- Table-level restrictions
GRANT SELECT ON mydb.public_data TO 'analytics'@'10.0.2.%';
REVOKE DELETE ON mydb.audit_log FROM 'app_user'@'10.0.1.%';

-- Column-level permissions
GRANT SELECT (id, name, email) ON mydb.users TO 'analytics'@'10.0.2.%';

-- View current grants
SHOW GRANTS FOR 'app_user'@'10.0.1.%';

-- Revoke all and start fresh
REVOKE ALL PRIVILEGES ON *.* FROM 'app_user'@'10.0.1.%';

-- MySQL roles (8.0+)
CREATE ROLE 'app_readwrite', 'app_readonly';
GRANT SELECT, INSERT, UPDATE, DELETE ON mydb.* TO 'app_readwrite';
GRANT SELECT ON mydb.* TO 'app_readonly';
GRANT 'app_readwrite' TO 'app_user'@'10.0.1.%';
SET DEFAULT ROLE 'app_readwrite' TO 'app_user'@'10.0.1.%';
```

---

### Auditing

```sql
-- PostgreSQL: pgAudit extension
CREATE EXTENSION pgaudit;

-- postgresql.conf
-- pgaudit.log = 'write, ddl'         -- log writes and schema changes
-- pgaudit.log_catalog = off           -- don't log system catalog queries
-- pgaudit.log_level = 'log'           -- log level
-- pgaudit.log_statement_once = on     -- log statement once, not per row

-- Role-based auditing (audit specific roles)
-- pgaudit.role = 'auditor'
CREATE ROLE auditor;
GRANT SELECT ON sensitive_data TO auditor;
-- Any query matching auditor's grants gets logged

-- MySQL: audit log (Enterprise or Percona)
-- Or: general_log = ON (all queries, high overhead)
-- Or: slow_query_log = ON (queries > long_query_time)

-- Minimal audit with triggers (any database)
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by TEXT DEFAULT current_user,
    changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (table_name, operation, old_data, new_data)
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_audit
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

---

## Best Practices

1. **ALWAYS use separate database users** for each application/service — never share credentials
2. **ALWAYS implement least privilege** — grant minimum permissions required
3. **ALWAYS use strong authentication** — scram-sha-256 (not md5), rotate passwords regularly
4. **ALWAYS restrict network access** — database port accessible only from application subnet
5. **ALWAYS use RLS for multi-tenant** applications — tenant isolation at the database level
6. **ALWAYS enable auditing** for sensitive data — pgAudit or equivalent
7. **ALWAYS revoke PUBLIC privileges** — PostgreSQL grants CREATE on public schema by default
8. **NEVER use superuser credentials** in application code — create dedicated app user
9. **NEVER expose database port** to the public internet — use VPC, security groups
10. **NEVER store database passwords** in code — use secrets manager (Vault, AWS Secrets Manager)

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Superuser in application | Any SQL injection = full database access | Dedicated app user with limited perms |
| Database exposed to internet | Port scans find open 5432/3306 | VPC, security groups, no public access |
| Shared credentials across services | Cannot revoke one service without affecting others | Per-service database users |
| No RLS for multi-tenant | Tenant data leak via SQL injection | Enable RLS with tenant_id policy |
| md5 authentication | Weak hash, vulnerable to replay | Use scram-sha-256 |
| Passwords in source code | Credentials in git history | Use secrets manager |
| No audit logging | Cannot detect unauthorized access | Enable pgAudit or equivalent |
| PUBLIC has CREATE privilege | Any user can create objects in public schema | REVOKE CREATE ON SCHEMA public FROM PUBLIC |
| No password rotation | Compromised credentials remain valid | Rotate quarterly, use IAM auth |

---

## Real-world Examples

### Supabase
- Row-Level Security as core feature for multi-tenant SaaS
- JWT-based authentication integrated with RLS policies
- pgAudit for compliance logging

### AWS RDS
- IAM database authentication (no passwords)
- Security groups for network isolation
- Encryption at rest (KMS) and in transit (TLS)

### Stripe
- Per-service database credentials with least privilege
- Audit logging for all data access
- Regular credential rotation via secrets management

---

## Enforcement Checklist

- [ ] Dedicated application database user (not superuser)
- [ ] Least privilege permissions granted (only needed tables/operations)
- [ ] Network access restricted (VPC/security group, no public access)
- [ ] Strong authentication configured (scram-sha-256, not md5)
- [ ] pg_hba.conf reviewed (restrictive, deny by default)
- [ ] RLS enabled for multi-tenant data
- [ ] PUBLIC privileges revoked on schemas
- [ ] Audit logging enabled for sensitive operations
- [ ] Passwords stored in secrets manager (not code)
- [ ] Password rotation policy in place
- [ ] Column-level permissions for sensitive fields (SSN, credit card)
- [ ] Default privileges set for future objects
