# Database Security

## Comprehensive Guide to Securing Database Systems

Category: Data Security
Scope: Access control, authentication, encryption, audit, hardening, and injection prevention
Last Updated: 2025-12-01
Status: Living Document

---

## Table of Contents

1. Principle of Least Privilege
2. Authentication Methods
3. Network Security
4. Connection Encryption
5. Row-Level Security (RLS)
6. Column-Level Encryption
7. Audit Logging
8. SQL Injection Prevention
9. Database Firewall and Proxy
10. Backup Encryption
11. Privilege Escalation Prevention
12. Default Credential Removal
13. Database Hardening (CIS Benchmarks)
14. Transparent Data Encryption (TDE)
15. Code Examples
16. Best Practices
17. Anti-Patterns
18. Enforcement Checklist

---

## 1. Principle of Least Privilege

### Concept

Every database user, application, and service should have only the minimum permissions
required to perform its function. No more, no less.

### Separate Database Users Per Service

Create distinct database users for each application, service, or function. Never share
a single database user across multiple services.

```sql
-- PostgreSQL: Create application-specific users
-- Read-write user for the main application
CREATE ROLE app_readwrite LOGIN PASSWORD 'strong_password_here';
GRANT CONNECT ON DATABASE myapp TO app_readwrite;
GRANT USAGE ON SCHEMA public TO app_readwrite;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_readwrite;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_readwrite;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_readwrite;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO app_readwrite;

-- Read-only user for reporting
CREATE ROLE app_readonly LOGIN PASSWORD 'another_strong_password';
GRANT CONNECT ON DATABASE myapp TO app_readonly;
GRANT USAGE ON SCHEMA public TO app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO app_readonly;

-- Migration user (schema changes only -- no data access in production)
CREATE ROLE app_migrations LOGIN PASSWORD 'migration_password';
GRANT CONNECT ON DATABASE myapp TO app_migrations;
GRANT CREATE ON SCHEMA public TO app_migrations;
GRANT ALL ON SCHEMA public TO app_migrations;

-- Analytics user (limited to specific tables)
CREATE ROLE analytics_reader LOGIN PASSWORD 'analytics_password';
GRANT CONNECT ON DATABASE myapp TO analytics_reader;
GRANT USAGE ON SCHEMA public TO analytics_reader;
GRANT SELECT ON TABLE events, page_views, sessions TO analytics_reader;
-- Explicitly do NOT grant access to users, payments, or other sensitive tables
```

```sql
-- MySQL: Create application-specific users
-- Read-write application user
CREATE USER 'app_readwrite'@'10.0.%' IDENTIFIED BY 'strong_password_here';
GRANT SELECT, INSERT, UPDATE, DELETE ON myapp.* TO 'app_readwrite'@'10.0.%';

-- Read-only reporting user
CREATE USER 'app_readonly'@'10.0.%' IDENTIFIED BY 'readonly_password';
GRANT SELECT ON myapp.* TO 'app_readonly'@'10.0.%';

-- Restrict to specific tables
CREATE USER 'analytics'@'10.0.%' IDENTIFIED BY 'analytics_password';
GRANT SELECT ON myapp.events TO 'analytics'@'10.0.%';
GRANT SELECT ON myapp.page_views TO 'analytics'@'10.0.%';

-- Apply privilege changes
FLUSH PRIVILEGES;
```

### Revoke Unnecessary Privileges

```sql
-- PostgreSQL: Revoke public schema access (security hardening)
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Revoke superuser-like privileges from application users
REVOKE ALL PRIVILEGES ON DATABASE myapp FROM app_readwrite;
GRANT CONNECT ON DATABASE myapp TO app_readwrite;

-- Review current grants
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
ORDER BY grantee, table_name;
```

### Temporal Privilege Elevation

```sql
-- PostgreSQL: Grant temporary elevated access with SET ROLE
-- Create a privileged role (no login)
CREATE ROLE data_admin NOLOGIN;
GRANT ALL ON ALL TABLES IN SCHEMA public TO data_admin;

-- Allow specific users to assume the role temporarily
GRANT data_admin TO support_user;

-- Support user must explicitly assume the role
SET ROLE data_admin;
-- Perform privileged operations
RESET ROLE;  -- Return to normal permissions
```

---

## 2. Authentication Methods

### Password Authentication

```sql
-- PostgreSQL: Use scram-sha-256 (strongest built-in method)
-- pg_hba.conf
-- TYPE  DATABASE  USER        ADDRESS       METHOD
host    all       all         10.0.0.0/8    scram-sha-256

-- Enforce scram-sha-256 globally
-- postgresql.conf
-- password_encryption = scram-sha-256

-- Set password with expiry
ALTER ROLE app_user PASSWORD 'new_secure_password'
  VALID UNTIL '2025-12-31T23:59:59Z';
```

### Certificate Authentication

```sql
-- PostgreSQL: Certificate-based authentication (pg_hba.conf)
-- TYPE     DATABASE  USER        ADDRESS       METHOD    OPTIONS
hostssl    all       app_user    10.0.0.0/8    cert      clientcert=verify-full

-- MySQL: Certificate authentication
CREATE USER 'app_user'@'%'
  IDENTIFIED BY 'password'
  REQUIRE X509;

-- Require specific certificate attributes
CREATE USER 'secure_user'@'%'
  REQUIRE SUBJECT '/CN=app-service/O=MyCompany'
  AND ISSUER '/CN=Internal CA/O=MyCompany';
```

### IAM Authentication (Cloud Databases)

```typescript
// AWS RDS IAM Authentication -- no password needed
import { RDS } from '@aws-sdk/client-rds';
import { Pool } from 'pg';

async function createIAMAuthPool(): Promise<Pool> {
  const rds = new RDS({ region: 'us-east-1' });

  // Generate IAM auth token (valid for 15 minutes)
  const token = await rds.generateAuthToken({
    hostname: 'mydb.abc123.us-east-1.rds.amazonaws.com',
    port: 5432,
    username: 'iam_db_user'
  });

  return new Pool({
    host: 'mydb.abc123.us-east-1.rds.amazonaws.com',
    port: 5432,
    user: 'iam_db_user',
    password: token,
    database: 'myapp',
    ssl: {
      rejectUnauthorized: true,
      ca: readFileSync('/etc/ssl/rds-combined-ca-bundle.pem').toString()
    }
  });
}
```

```python
# AWS RDS IAM Authentication in Python
import boto3
import psycopg2
import ssl


def get_iam_connection():
    """Create PostgreSQL connection using IAM authentication."""
    rds_client = boto3.client('rds', region_name='us-east-1')

    token = rds_client.generate_db_auth_token(
        DBHostname='mydb.abc123.us-east-1.rds.amazonaws.com',
        Port=5432,
        DBUsername='iam_db_user',
        Region='us-east-1'
    )

    conn = psycopg2.connect(
        host='mydb.abc123.us-east-1.rds.amazonaws.com',
        port=5432,
        database='myapp',
        user='iam_db_user',
        password=token,
        sslmode='verify-full',
        sslrootcert='/etc/ssl/rds-combined-ca-bundle.pem'
    )

    return conn
```

```go
// AWS RDS IAM Authentication in Go
package database

import (
    "context"
    "database/sql"
    "fmt"

    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/feature/rds/auth"
    _ "github.com/lib/pq"
)

func NewIAMConnection(ctx context.Context) (*sql.DB, error) {
    cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion("us-east-1"))
    if err != nil {
        return nil, fmt.Errorf("load AWS config: %w", err)
    }

    endpoint := "mydb.abc123.us-east-1.rds.amazonaws.com:5432"
    token, err := auth.BuildAuthToken(
        ctx, endpoint, "us-east-1", "iam_db_user", cfg.Credentials,
    )
    if err != nil {
        return nil, fmt.Errorf("build auth token: %w", err)
    }

    connStr := fmt.Sprintf(
        "host=%s port=5432 user=iam_db_user password=%s dbname=myapp sslmode=verify-full sslrootcert=/etc/ssl/rds-combined-ca-bundle.pem",
        "mydb.abc123.us-east-1.rds.amazonaws.com",
        token,
    )

    return sql.Open("postgres", connStr)
}
```

---

## 3. Network Security

### Private Subnets

Place databases in private subnets with no direct internet access.

```
+-------------------------------------------------------------+
|  VPC (10.0.0.0/16)                                           |
|                                                               |
|  +-------------------+     +-------------------+             |
|  | Public Subnet     |     | Public Subnet     |             |
|  | 10.0.1.0/24       |     | 10.0.2.0/24       |             |
|  | - ALB             |     | - NAT Gateway     |             |
|  +-------------------+     +-------------------+             |
|           |                         |                         |
|  +-------------------+     +-------------------+             |
|  | Private Subnet    |     | Private Subnet    |             |
|  | 10.0.10.0/24      |     | 10.0.11.0/24      |             |
|  | - App Servers     |     | - App Servers     |             |
|  +-------------------+     +-------------------+             |
|           |                         |                         |
|  +-------------------+     +-------------------+             |
|  | Data Subnet       |     | Data Subnet       |             |
|  | 10.0.20.0/24      |     | 10.0.21.0/24      |             |
|  | - RDS Primary     |     | - RDS Replica     |             |
|  | NO internet route |     | NO internet route |             |
|  +-------------------+     +-------------------+             |
+-------------------------------------------------------------+
```

### Security Groups

```hcl
# Terraform: Database security group
resource "aws_security_group" "database" {
  name_prefix = "database-"
  vpc_id      = var.vpc_id

  # Allow PostgreSQL only from application security group
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.application.id]
    description     = "PostgreSQL from application servers"
  }

  # Allow PostgreSQL from bastion for emergency access
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion.id]
    description     = "PostgreSQL from bastion host"
  }

  # NO egress to internet (databases should not make outbound connections)
  # Exception: AWS services via VPC endpoints
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.s3_vpc_endpoint_cidr]
    description = "S3 via VPC endpoint for backups"
  }

  tags = {
    Name = "database-sg"
  }
}
```

### No Public Access

```hcl
# Terraform: RDS with no public access
resource "aws_db_instance" "main" {
  identifier        = "myapp-production"
  engine            = "postgres"
  engine_version    = "15.4"
  instance_class    = "db.r6g.large"
  allocated_storage = 100

  # CRITICAL: No public access
  publicly_accessible    = false
  db_subnet_group_name   = aws_db_subnet_group.private.name
  vpc_security_group_ids = [aws_security_group.database.id]

  # Encryption
  storage_encrypted = true
  kms_key_id        = aws_kms_key.database.arn

  # Backup
  backup_retention_period = 30
  backup_window           = "03:00-04:00"

  # Multi-AZ for production
  multi_az = true

  # Delete protection
  deletion_protection = true

  # Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  # Performance Insights
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.database.arn

  tags = {
    Environment = "production"
  }
}
```

---

## 4. Connection Encryption

### PostgreSQL: Require TLS

```ini
# postgresql.conf
ssl = on
ssl_cert_file = '/etc/postgresql/server.crt'
ssl_key_file = '/etc/postgresql/server.key'
ssl_ca_file = '/etc/postgresql/ca.crt'
ssl_min_protocol_version = 'TLSv1.2'
ssl_ciphers = 'HIGH:!aNULL:!MD5:!3DES:!RC4:!DES'

# pg_hba.conf -- ONLY allow SSL connections
# TYPE     DATABASE  USER  ADDRESS       METHOD
hostssl    all       all   10.0.0.0/8    scram-sha-256
hostnossl  all       all   0.0.0.0/0     reject
```

### SSL Mode Comparison

```
+------------------------------------------------------------------+
| sslmode         | Encrypted | Verifies Cert | Verifies Hostname  |
|------------------------------------------------------------------+
| disable         | No        | No            | No                 |
| allow           | Maybe     | No            | No                 |
| prefer          | Maybe     | No            | No                 |
| require         | Yes       | No            | No                 |
| verify-ca       | Yes       | Yes           | No                 |
| verify-full     | Yes       | Yes           | Yes  <-- USE THIS  |
+------------------------------------------------------------------+
```

Always use `sslmode=verify-full` in production. Using `require` without verification
is vulnerable to man-in-the-middle attacks because the client does not verify the
server's identity.

### Application Connection Configuration

```typescript
// TypeScript: Database connection with full SSL verification
import { Pool, PoolConfig } from 'pg';
import fs from 'fs';

function createSecurePool(): Pool {
  const config: PoolConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: {
      rejectUnauthorized: true,  // NEVER set to false in production
      ca: fs.readFileSync('/etc/ssl/ca.crt').toString(),
      cert: fs.readFileSync('/etc/ssl/client.crt').toString(),
      key: fs.readFileSync('/etc/ssl/client.key').toString(),
      // Minimum TLS version
      minVersion: 'TLSv1.2'
    }
  };

  return new Pool(config);
}
```

---

## 5. Row-Level Security (RLS)

### Multi-Tenancy with RLS

RLS enforces data isolation at the database level, preventing one tenant from
accessing another tenant's data even if the application has a bug.

```sql
-- PostgreSQL: Enable RLS for multi-tenant table
CREATE TABLE tenant_data (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  data_content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable row-level security
ALTER TABLE tenant_data ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owner
ALTER TABLE tenant_data FORCE ROW LEVEL SECURITY;

-- Create policy: users can only see their tenant's data
CREATE POLICY tenant_isolation ON tenant_data
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Create separate policies for different operations
CREATE POLICY tenant_select ON tenant_data
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY tenant_insert ON tenant_data
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY tenant_update ON tenant_data
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant')::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY tenant_delete ON tenant_data
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

### Application Integration

```typescript
// Set tenant context before queries
class TenantAwareRepository {
  constructor(private pool: Pool) {}

  async withTenant<T>(
    tenantId: string,
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      // Set the tenant context for RLS
      await client.query(
        "SET app.current_tenant = $1",
        [tenantId]
      );

      const result = await callback(client);

      // Reset tenant context
      await client.query("RESET app.current_tenant");

      return result;
    } finally {
      client.release();
    }
  }

  async getData(tenantId: string): Promise<any[]> {
    return this.withTenant(tenantId, async (client) => {
      // RLS automatically filters by tenant_id
      const result = await client.query(
        "SELECT * FROM tenant_data ORDER BY created_at DESC"
      );
      return result.rows;
    });
  }
}
```

```go
// Go: Tenant-aware database queries
package database

import (
    "context"
    "database/sql"
    "fmt"
)

type TenantDB struct {
    db *sql.DB
}

func (tdb *TenantDB) WithTenant(
    ctx context.Context,
    tenantID string,
    fn func(tx *sql.Tx) error,
) error {
    tx, err := tdb.db.BeginTx(ctx, nil)
    if err != nil {
        return fmt.Errorf("begin transaction: %w", err)
    }
    defer tx.Rollback()

    // Set tenant context for RLS
    _, err = tx.ExecContext(ctx,
        "SET LOCAL app.current_tenant = $1", tenantID)
    if err != nil {
        return fmt.Errorf("set tenant: %w", err)
    }

    if err := fn(tx); err != nil {
        return err
    }

    return tx.Commit()
}

func (tdb *TenantDB) GetTenantData(
    ctx context.Context,
    tenantID string,
) ([]TenantData, error) {
    var results []TenantData

    err := tdb.WithTenant(ctx, tenantID, func(tx *sql.Tx) error {
        rows, err := tx.QueryContext(ctx,
            "SELECT id, data_content, created_at FROM tenant_data")
        if err != nil {
            return err
        }
        defer rows.Close()

        for rows.Next() {
            var d TenantData
            if err := rows.Scan(&d.ID, &d.Content, &d.CreatedAt); err != nil {
                return err
            }
            results = append(results, d)
        }
        return rows.Err()
    })

    return results, err
}
```

---

## 6. Column-Level Encryption

### Encrypt Sensitive Columns

```sql
-- PostgreSQL: Column-level encryption with pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create table with encrypted columns
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  -- Encrypted columns stored as bytea
  email_encrypted BYTEA,
  ssn_encrypted BYTEA,
  phone_encrypted BYTEA,
  -- Blind indexes for searching
  email_index VARCHAR(64),
  -- Non-sensitive metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert with encryption
INSERT INTO customers (name, email_encrypted, ssn_encrypted, email_index)
VALUES (
  'John Doe',
  pgp_sym_encrypt('john@example.com', current_setting('app.encryption_key')),
  pgp_sym_encrypt('123-45-6789', current_setting('app.encryption_key')),
  encode(hmac('john@example.com', current_setting('app.index_key'), 'sha256'), 'hex')
);

-- Select with decryption
SELECT
  name,
  pgp_sym_decrypt(email_encrypted, current_setting('app.encryption_key')) AS email,
  pgp_sym_decrypt(ssn_encrypted, current_setting('app.encryption_key')) AS ssn
FROM customers
WHERE id = 1;

-- Search using blind index
SELECT
  name,
  pgp_sym_decrypt(email_encrypted, current_setting('app.encryption_key')) AS email
FROM customers
WHERE email_index = encode(
  hmac('john@example.com', current_setting('app.index_key'), 'sha256'),
  'hex'
);
```

### Application-Level Column Encryption

```typescript
// Encrypt at application level before storing
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

interface EncryptedField {
  ciphertext: string;
  nonce: string;
  tag: string;
  v: number;
}

class ColumnEncryption {
  private key: Buffer;
  private indexKey: Buffer;

  constructor(key: Buffer, indexKey: Buffer) {
    this.key = key;
    this.indexKey = indexKey;
  }

  encrypt(plaintext: string): EncryptedField {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);
    return {
      ciphertext: ciphertext.toString('base64'),
      nonce: nonce.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      v: 1
    };
  }

  decrypt(field: EncryptedField): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(field.nonce, 'base64')
    );
    decipher.setAuthTag(Buffer.from(field.tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(field.ciphertext, 'base64')),
      decipher.final()
    ]).toString('utf8');
  }

  createIndex(value: string): string {
    return createHmac('sha256', this.indexKey)
      .update(value.toLowerCase().trim())
      .digest('hex');
  }
}

// Usage in repository
class CustomerRepository {
  constructor(
    private db: Pool,
    private encryption: ColumnEncryption
  ) {}

  async create(customer: {
    name: string;
    email: string;
    ssn: string;
  }): Promise<void> {
    const encEmail = this.encryption.encrypt(customer.email);
    const encSSN = this.encryption.encrypt(customer.ssn);
    const emailIndex = this.encryption.createIndex(customer.email);

    await this.db.query(`
      INSERT INTO customers
        (name, email_encrypted, ssn_encrypted, email_index)
      VALUES ($1, $2, $3, $4)
    `, [
      customer.name,
      JSON.stringify(encEmail),
      JSON.stringify(encSSN),
      emailIndex
    ]);
  }

  async findByEmail(email: string): Promise<any | null> {
    const emailIndex = this.encryption.createIndex(email);

    const result = await this.db.query(
      'SELECT * FROM customers WHERE email_index = $1',
      [emailIndex]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...row,
      email: this.encryption.decrypt(JSON.parse(row.email_encrypted)),
      ssn: this.encryption.decrypt(JSON.parse(row.ssn_encrypted))
    };
  }
}
```

---

## 7. Audit Logging

### PostgreSQL: pgAudit

```sql
-- Install pgAudit extension
CREATE EXTENSION IF NOT EXISTS pgaudit;

-- postgresql.conf configuration
-- pgaudit.log = 'read, write, ddl, role'
-- pgaudit.log_catalog = on
-- pgaudit.log_client = on
-- pgaudit.log_level = log
-- pgaudit.log_parameter = on
-- pgaudit.log_statement_once = off

-- Object-level audit for sensitive tables
ALTER TABLE customers SET (pgaudit.log = 'all');
ALTER TABLE payments SET (pgaudit.log = 'all');
ALTER TABLE audit_logs SET (pgaudit.log = 'all');

-- Role-based auditing: Audit all actions by specific roles
ALTER ROLE app_admin SET pgaudit.log = 'all';
ALTER ROLE dba SET pgaudit.log = 'all';
```

### MySQL: Audit Plugin

```sql
-- Install MySQL Enterprise Audit Plugin
INSTALL PLUGIN audit_log SONAME 'audit_log.so';

-- Configure audit logging
SET GLOBAL audit_log_policy = 'ALL';
SET GLOBAL audit_log_format = 'JSON';
SET GLOBAL audit_log_file = '/var/log/mysql/audit.log';

-- Filter audit events
SET GLOBAL audit_log_include_accounts = 'app_admin@%,dba@%';
SET GLOBAL audit_log_exclude_commands = 'ping,statistics';
```

### Application-Level Audit Logging

```typescript
interface AuditEntry {
  timestamp: Date;
  action: string;
  tableName: string;
  recordId: string;
  userId: string;
  ipAddress: string;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  query: string;
}

class DatabaseAuditLogger {
  constructor(private auditDb: Pool) {}

  async logAccess(entry: AuditEntry): Promise<void> {
    // Scrub sensitive values before logging
    const scrubbed = this.scrubSensitiveFields(entry);

    await this.auditDb.query(`
      INSERT INTO database_audit_log
        (timestamp, action, table_name, record_id, user_id,
         ip_address, old_values, new_values)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      scrubbed.timestamp,
      scrubbed.action,
      scrubbed.tableName,
      scrubbed.recordId,
      scrubbed.userId,
      scrubbed.ipAddress,
      scrubbed.oldValues ? JSON.stringify(scrubbed.oldValues) : null,
      scrubbed.newValues ? JSON.stringify(scrubbed.newValues) : null
    ]);
  }

  private scrubSensitiveFields(entry: AuditEntry): AuditEntry {
    const sensitiveFields = ['password', 'ssn', 'credit_card', 'token'];
    const scrub = (obj: Record<string, any> | null) => {
      if (!obj) return null;
      const result = { ...obj };
      for (const field of sensitiveFields) {
        if (field in result) {
          result[field] = '[REDACTED]';
        }
      }
      return result;
    };

    return {
      ...entry,
      oldValues: scrub(entry.oldValues),
      newValues: scrub(entry.newValues)
    };
  }
}
```

### PostgreSQL Trigger-Based Audit

```sql
-- Create audit table
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by TEXT DEFAULT current_user,
  changed_at TIMESTAMP DEFAULT NOW(),
  client_ip INET DEFAULT inet_client_addr(),
  application_name TEXT DEFAULT current_setting('application_name', true)
);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data)
    VALUES (TG_TABLE_NAME, NEW.id::TEXT, 'INSERT', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data)
    VALUES (TG_TABLE_NAME, NEW.id::TEXT, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data)
    VALUES (TG_TABLE_NAME, OLD.id::TEXT, 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to sensitive tables
CREATE TRIGGER audit_customers
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

---

## 8. SQL Injection Prevention

### Parameterized Queries (Prepared Statements)

The primary defense against SQL injection. NEVER concatenate user input into SQL.

```typescript
// TypeScript: Parameterized queries
import { Pool } from 'pg';

const pool = new Pool();

// SAFE: Parameterized query
async function getUserByEmail(email: string) {
  const result = await pool.query(
    'SELECT id, name, email FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];
}

// SAFE: Multiple parameters
async function searchUsers(name: string, minAge: number, limit: number) {
  const result = await pool.query(
    'SELECT * FROM users WHERE name ILIKE $1 AND age >= $2 LIMIT $3',
    [`%${name}%`, minAge, limit]
  );
  return result.rows;
}

// DANGEROUS: String concatenation -- NEVER do this
async function getUserByEmail_VULNERABLE(email: string) {
  // This is vulnerable to SQL injection!
  const result = await pool.query(
    `SELECT * FROM users WHERE email = '${email}'`  // DO NOT DO THIS
  );
  return result.rows[0];
}
// An attacker could pass: email = "' OR '1'='1'; DROP TABLE users; --"
```

```go
// Go: Parameterized queries
package database

import (
    "context"
    "database/sql"
)

func GetUserByEmail(ctx context.Context, db *sql.DB, email string) (*User, error) {
    var user User

    // SAFE: Parameterized query with $1 placeholder
    err := db.QueryRowContext(ctx,
        "SELECT id, name, email FROM users WHERE email = $1",
        email,
    ).Scan(&user.ID, &user.Name, &user.Email)

    if err == sql.ErrNoRows {
        return nil, nil
    }
    return &user, err
}

// SAFE: Multiple parameters
func SearchUsers(ctx context.Context, db *sql.DB, name string, minAge int) ([]User, error) {
    rows, err := db.QueryContext(ctx,
        "SELECT id, name, email FROM users WHERE name ILIKE $1 AND age >= $2",
        "%"+name+"%", minAge,
    )
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var users []User
    for rows.Next() {
        var u User
        if err := rows.Scan(&u.ID, &u.Name, &u.Email); err != nil {
            return nil, err
        }
        users = append(users, u)
    }
    return users, rows.Err()
}
```

```python
# Python: Parameterized queries
import psycopg2

def get_user_by_email(cursor, email: str) -> dict | None:
    # SAFE: Parameterized query
    cursor.execute(
        "SELECT id, name, email FROM users WHERE email = %s",
        (email,)
    )
    row = cursor.fetchone()
    if row:
        return {"id": row[0], "name": row[1], "email": row[2]}
    return None


def search_users(cursor, name: str, min_age: int) -> list[dict]:
    # SAFE: Multiple parameters
    cursor.execute(
        "SELECT id, name, email FROM users WHERE name ILIKE %s AND age >= %s",
        (f"%{name}%", min_age)
    )
    return [
        {"id": r[0], "name": r[1], "email": r[2]}
        for r in cursor.fetchall()
    ]

# DANGEROUS: String formatting -- NEVER do this
def get_user_VULNERABLE(cursor, email: str):
    cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")  # DO NOT DO THIS
```

### Stored Procedures

```sql
-- PostgreSQL: Stored procedure with type-safe parameters
CREATE OR REPLACE FUNCTION get_user_by_email(p_email VARCHAR)
RETURNS TABLE(id INTEGER, name VARCHAR, email VARCHAR) AS $$
BEGIN
  RETURN QUERY
    SELECT u.id, u.name, u.email
    FROM users u
    WHERE u.email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission only
REVOKE ALL ON FUNCTION get_user_by_email FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_by_email TO app_readwrite;

-- Call from application
-- SELECT * FROM get_user_by_email('john@example.com');
```

### ORM Safety

```typescript
// ORMs generally handle parameterization, but beware of raw queries

// Prisma (safe by default)
const user = await prisma.user.findFirst({
  where: { email: userInput }  // Automatically parameterized
});

// Sequelize (safe by default for standard queries)
const user = await User.findOne({
  where: { email: userInput }  // Automatically parameterized
});

// Sequelize raw query (MUST parameterize manually)
const users = await sequelize.query(
  'SELECT * FROM users WHERE email = :email',
  {
    replacements: { email: userInput },
    type: QueryTypes.SELECT
  }
);

// DANGEROUS Sequelize raw query
const users = await sequelize.query(
  `SELECT * FROM users WHERE email = '${userInput}'`  // DO NOT DO THIS
);
```

---

## 9. Database Firewall and Proxy

### PgBouncer (Connection Pooling with Security)

```ini
# pgbouncer.ini
[databases]
myapp = host=db-primary.internal port=5432 dbname=myapp

[pgbouncer]
# Listen only on internal network
listen_addr = 10.0.10.5
listen_port = 6432

# Connection pooling mode
pool_mode = transaction

# Authentication
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

# TLS for client connections
client_tls_sslmode = require
client_tls_cert_file = /etc/ssl/pgbouncer.crt
client_tls_key_file = /etc/ssl/pgbouncer.key
client_tls_ca_file = /etc/ssl/ca.crt

# TLS for server connections
server_tls_sslmode = verify-full
server_tls_ca_file = /etc/ssl/ca.crt

# Connection limits
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5

# Query timeout (prevent long-running queries)
query_timeout = 30

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
```

### ProxySQL (MySQL Proxy with Firewall)

```sql
-- ProxySQL: Query rules for SQL firewall
-- Block dangerous patterns
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, error_msg, apply)
VALUES
  (1, 1, '.*DROP TABLE.*', 'DROP TABLE is not allowed', 1),
  (2, 1, '.*DROP DATABASE.*', 'DROP DATABASE is not allowed', 1),
  (3, 1, '.*TRUNCATE.*', 'TRUNCATE is not allowed', 1),
  (4, 1, '.*INTO OUTFILE.*', 'INTO OUTFILE is not allowed', 1),
  (5, 1, '.*LOAD_FILE.*', 'LOAD_FILE is not allowed', 1),
  (6, 1, '.*UNION.*SELECT.*', 'UNION SELECT pattern blocked', 1);

-- Route read queries to replicas
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, destination_hostgroup, apply)
VALUES
  (10, 1, '^SELECT', 20, 1);   -- Hostgroup 20 = read replicas

-- Route write queries to primary
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, destination_hostgroup, apply)
VALUES
  (11, 1, '^(INSERT|UPDATE|DELETE)', 10, 1);  -- Hostgroup 10 = primary

LOAD MYSQL QUERY RULES TO RUNTIME;
SAVE MYSQL QUERY RULES TO DISK;
```

---

## 10. Backup Encryption

### Encrypted Backups

```bash
# PostgreSQL: Encrypted backup with pg_dump
pg_dump -h db.internal -U backup_user myapp | \
  gpg --symmetric --cipher-algo AES256 \
  --compress-algo none \
  -o /backups/myapp-$(date +%Y%m%d).sql.gpg

# Restore from encrypted backup
gpg --decrypt /backups/myapp-20241201.sql.gpg | \
  psql -h db.internal -U restore_user myapp

# PostgreSQL: Encrypted backup with openssl
pg_dump -h db.internal -U backup_user -Fc myapp | \
  openssl enc -aes-256-cbc -salt \
  -pass file:/etc/backup/encryption.key \
  -out /backups/myapp-$(date +%Y%m%d).dump.enc

# Restore from openssl-encrypted backup
openssl enc -d -aes-256-cbc \
  -pass file:/etc/backup/encryption.key \
  -in /backups/myapp-20241201.dump.enc | \
  pg_restore -h db.internal -U restore_user -d myapp
```

### AWS RDS Automated Backup Encryption

```hcl
# Terraform: RDS with encrypted backups
resource "aws_db_instance" "production" {
  # Storage encryption (encrypts backups automatically)
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds_backup.arn

  # Backup configuration
  backup_retention_period = 30
  backup_window           = "03:00-04:00"
  copy_tags_to_snapshot   = true

  # Enable automated backups to S3 (for cross-region)
  # AWS automatically encrypts snapshots with the same KMS key
}

# Cross-region encrypted snapshot copy
resource "aws_db_snapshot_copy" "cross_region" {
  source_db_snapshot_identifier = aws_db_snapshot.production.id
  target_db_snapshot_identifier = "production-dr-copy"
  kms_key_id                    = aws_kms_key.dr_region_key.arn
}
```

### Backup Verification

```python
import subprocess
import hashlib
from datetime import datetime


class BackupVerifier:
    """Verify backup integrity and restorability."""

    def verify_backup(self, backup_path: str) -> dict:
        """Verify a backup file is valid and restorable."""
        result = {
            "path": backup_path,
            "timestamp": datetime.utcnow().isoformat(),
            "checks": {}
        }

        # Check file exists and is non-empty
        import os
        if not os.path.exists(backup_path):
            result["checks"]["exists"] = False
            return result
        result["checks"]["exists"] = True
        result["checks"]["size_bytes"] = os.path.getsize(backup_path)

        # Verify checksum
        sha256 = hashlib.sha256()
        with open(backup_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        result["checks"]["sha256"] = sha256.hexdigest()

        # Test restore to a temporary database
        try:
            restore_result = subprocess.run([
                'pg_restore', '--list', backup_path
            ], capture_output=True, text=True, timeout=60)

            result["checks"]["valid_format"] = (
                restore_result.returncode == 0
            )
        except subprocess.TimeoutExpired:
            result["checks"]["valid_format"] = False

        return result
```

---

## 11. Privilege Escalation Prevention

### Prevent SUPERUSER Abuse

```sql
-- PostgreSQL: Restrict superuser access
-- Create non-superuser DBA role for daily operations
CREATE ROLE dba_ops NOSUPERUSER CREATEDB CREATEROLE LOGIN
  PASSWORD 'dba_password';

-- Grant necessary privileges without superuser
GRANT pg_monitor TO dba_ops;       -- Monitoring access
GRANT pg_signal_backend TO dba_ops; -- Kill queries

-- Restrict superuser login to specific hosts (pg_hba.conf)
-- TYPE  DATABASE  USER      ADDRESS           METHOD
local   all       postgres                    peer
host    all       postgres  127.0.0.1/32      reject
host    all       postgres  10.0.0.0/8        reject
```

### Prevent Function Abuse

```sql
-- Use SECURITY INVOKER (default) instead of SECURITY DEFINER
-- SECURITY DEFINER runs with the function owner's privileges
-- SECURITY INVOKER runs with the caller's privileges

-- SAFE: Function runs with caller's privileges
CREATE FUNCTION get_my_data()
RETURNS TABLE(id INT, data TEXT) AS $$
BEGIN
  RETURN QUERY SELECT d.id, d.data FROM data d;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- CAUTION: Only use SECURITY DEFINER when absolutely necessary
-- And restrict search_path to prevent function injection
CREATE FUNCTION admin_get_data(p_user_id INT)
RETURNS TABLE(id INT, data TEXT) AS $$
BEGIN
  RETURN QUERY SELECT d.id, d.data FROM public.data d
    WHERE d.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp;  -- Prevent search_path injection
```

### Prevent Role Escalation

```sql
-- Prevent users from granting roles to themselves
-- Use NOINHERIT for sensitive roles
CREATE ROLE sensitive_data_access NOINHERIT NOLOGIN;
GRANT SELECT ON sensitive_table TO sensitive_data_access;

-- Users must explicitly SET ROLE to use privileges
GRANT sensitive_data_access TO app_user;

-- app_user must run:
-- SET ROLE sensitive_data_access;
-- before accessing the sensitive table
-- This provides audit trail of privilege escalation
```

---

## 12. Default Credential Removal

### PostgreSQL Defaults to Remove

```sql
-- Change default postgres user password immediately
ALTER USER postgres WITH PASSWORD 'new_strong_password_here';

-- Or better: disable password login for postgres entirely
-- Use peer authentication (local socket only)
-- pg_hba.conf:
-- local  all  postgres  peer

-- Remove the default 'template1' public access
REVOKE ALL ON DATABASE template1 FROM PUBLIC;

-- Remove default public schema privileges
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Remove pg_read_all_data and pg_write_all_data defaults
REVOKE pg_read_all_data FROM PUBLIC;
REVOKE pg_write_all_data FROM PUBLIC;
```

### MySQL Defaults to Remove

```sql
-- Remove anonymous users
DELETE FROM mysql.user WHERE User = '';

-- Remove test database
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db = 'test' OR Db = 'test\\_%';

-- Secure the root account
ALTER USER 'root'@'localhost'
  IDENTIFIED WITH caching_sha2_password BY 'new_root_password';

-- Remove remote root access
DROP USER IF EXISTS 'root'@'%';
DROP USER IF EXISTS 'root'@'::1';

-- Flush privileges
FLUSH PRIVILEGES;

-- Run mysql_secure_installation for automated hardening
-- mysql_secure_installation
```

---

## 13. Database Hardening (CIS Benchmarks)

### PostgreSQL CIS Benchmark Highlights

```sql
-- 1. Ensure log_connections is enabled
ALTER SYSTEM SET log_connections = 'on';

-- 2. Ensure log_disconnections is enabled
ALTER SYSTEM SET log_disconnections = 'on';

-- 3. Ensure log_duration is enabled for long queries
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- 1 second

-- 4. Ensure log_line_prefix contains useful information
ALTER SYSTEM SET log_line_prefix = '%m [%p] %q%u@%d ';

-- 5. Ensure log_statement captures DDL
ALTER SYSTEM SET log_statement = 'ddl';

-- 6. Ensure SSL is enabled
ALTER SYSTEM SET ssl = 'on';
ALTER SYSTEM SET ssl_min_protocol_version = 'TLSv1.2';

-- 7. Ensure password_encryption uses scram-sha-256
ALTER SYSTEM SET password_encryption = 'scram-sha-256';

-- 8. Limit connection attempts
ALTER SYSTEM SET authentication_timeout = '1min';

-- 9. Set appropriate shared_preload_libraries
ALTER SYSTEM SET shared_preload_libraries = 'pgaudit,pg_stat_statements';

-- 10. Reload configuration
SELECT pg_reload_conf();
```

```ini
# postgresql.conf hardening
# File permissions
unix_socket_permissions = 0700

# Connection settings
max_connections = 100
superuser_reserved_connections = 3

# SSL
ssl = on
ssl_min_protocol_version = 'TLSv1.2'
ssl_ciphers = 'HIGH:!aNULL:!MD5:!3DES:!RC4'

# Logging
log_connections = on
log_disconnections = on
log_duration = off
log_min_duration_statement = 1000
log_statement = 'ddl'
log_line_prefix = '%m [%p] %q%u@%d '
log_hostname = off

# Security
password_encryption = scram-sha-256
row_security = on
```

### MySQL CIS Benchmark Highlights

```ini
# my.cnf hardening
[mysqld]
# Disable local file loading (prevents LOAD DATA INFILE attacks)
local-infile = 0

# Disable symbolic links (prevents symlink attacks)
symbolic-links = 0

# Require secure authentication
default-authentication-plugin = caching_sha2_password

# Enable TLS
require-secure-transport = ON
tls-version = TLSv1.2,TLSv1.3

# Logging
general-log = 0
log-error = /var/log/mysql/error.log
slow-query-log = 1
slow-query-log-file = /var/log/mysql/slow.log
long-query-time = 2

# Disable dangerous features
skip-symbolic-links
skip-show-database  # Users can only see databases they have access to

# File permissions
secure-file-priv = /var/lib/mysql-files  # Restrict file operations

# Memory and connection limits
max-connections = 100
max-user-connections = 50
```

---

## 14. Transparent Data Encryption (TDE)

### PostgreSQL TDE with pg_tde Extension

```sql
-- Note: Native TDE support in PostgreSQL is evolving
-- Check current version support. The community version may use
-- third-party extensions or enterprise distributions.

-- Using pgcrypto for column-level encryption (available today)
-- See Section 6 (Column-Level Encryption) for examples
```

### MySQL InnoDB TDE

```sql
-- Enable InnoDB tablespace encryption
-- Requires keyring plugin configured in my.cnf

-- Encrypt existing tablespace
ALTER TABLE customers ENCRYPTION = 'Y';
ALTER TABLE payments ENCRYPTION = 'Y';

-- Create new encrypted table
CREATE TABLE sensitive_data (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENCRYPTION = 'Y';

-- Verify encryption status
SELECT TABLE_SCHEMA, TABLE_NAME, CREATE_OPTIONS
FROM INFORMATION_SCHEMA.TABLES
WHERE CREATE_OPTIONS LIKE '%ENCRYPTION%';

-- Check encryption progress
SELECT * FROM INFORMATION_SCHEMA.INNODB_TABLESPACE_ENCRYPTION;
```

### SQL Server TDE

```sql
-- Enable TDE on SQL Server (see encryption-at-rest.md for full example)
USE master;

-- Create master key
CREATE MASTER KEY ENCRYPTION BY PASSWORD = 'StrongP@ssw0rd!';

-- Create certificate
CREATE CERTIFICATE TDECert WITH SUBJECT = 'TDE Certificate';

-- Enable on database
USE MyDatabase;
CREATE DATABASE ENCRYPTION KEY
WITH ALGORITHM = AES_256
ENCRYPTION BY SERVER CERTIFICATE TDECert;

ALTER DATABASE MyDatabase SET ENCRYPTION ON;

-- Verify
SELECT name, is_encrypted FROM sys.databases;
```

---

## 15. Code Examples

### Python: Comprehensive Database Security Wrapper

```python
import psycopg2
import psycopg2.pool
import logging
import ssl
from contextlib import contextmanager
from functools import wraps

logger = logging.getLogger(__name__)


class SecureDatabaseConnection:
    """Database connection with security best practices."""

    def __init__(self, config: dict):
        # Validate SSL configuration
        if config.get('sslmode') not in ('verify-ca', 'verify-full'):
            raise ValueError(
                "sslmode must be 'verify-ca' or 'verify-full' for production"
            )

        self.pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=config.get('max_connections', 20),
            host=config['host'],
            port=config.get('port', 5432),
            dbname=config['database'],
            user=config['user'],
            password=config['password'],
            sslmode=config.get('sslmode', 'verify-full'),
            sslcert=config.get('sslcert'),
            sslkey=config.get('sslkey'),
            sslrootcert=config.get('sslrootcert'),
            options=f"-c statement_timeout={config.get('statement_timeout', 30000)}",
            application_name=config.get('application_name', 'myapp')
        )

    @contextmanager
    def get_connection(self, tenant_id: str = None):
        """Get a connection from the pool with optional tenant context."""
        conn = self.pool.getconn()
        try:
            if tenant_id:
                with conn.cursor() as cur:
                    cur.execute(
                        "SET app.current_tenant = %s", (tenant_id,)
                    )
            yield conn
        finally:
            if tenant_id:
                with conn.cursor() as cur:
                    cur.execute("RESET app.current_tenant")
            self.pool.putconn(conn)

    def execute_query(
        self,
        query: str,
        params: tuple = None,
        tenant_id: str = None
    ) -> list[dict]:
        """Execute a parameterized query safely."""
        with self.get_connection(tenant_id) as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)  # Always parameterized
                if cur.description:
                    columns = [col.name for col in cur.description]
                    return [dict(zip(columns, row)) for row in cur.fetchall()]
                conn.commit()
                return []

    def close(self):
        """Close the connection pool."""
        self.pool.closeall()


# Usage
db = SecureDatabaseConnection({
    'host': 'db.internal.example.com',
    'database': 'myapp',
    'user': 'app_readwrite',
    'password': secret_manager.get('db_password'),
    'sslmode': 'verify-full',
    'sslrootcert': '/etc/ssl/ca.crt',
    'statement_timeout': 30000,
    'application_name': 'myapp-api'
})

# Safe parameterized query with tenant isolation
users = db.execute_query(
    "SELECT id, name FROM users WHERE status = %s",
    ('active',),
    tenant_id='tenant-123'
)
```

### Go: Secure Database Client

```go
package database

import (
    "context"
    "crypto/tls"
    "crypto/x509"
    "database/sql"
    "fmt"
    "os"
    "time"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/jackc/pgx/v5/stdlib"
)

type SecureDB struct {
    pool *pgxpool.Pool
}

func NewSecureDB(ctx context.Context, config Config) (*SecureDB, error) {
    // Load CA certificate
    caCert, err := os.ReadFile(config.SSLRootCert)
    if err != nil {
        return nil, fmt.Errorf("read CA cert: %w", err)
    }

    caCertPool := x509.NewCertPool()
    if !caCertPool.AppendCertsFromPEM(caCert) {
        return nil, fmt.Errorf("failed to add CA certificate")
    }

    connStr := fmt.Sprintf(
        "postgres://%s:%s@%s:%d/%s?sslmode=verify-full&sslrootcert=%s"+
            "&statement_timeout=%d&application_name=%s",
        config.User, config.Password,
        config.Host, config.Port, config.Database,
        config.SSLRootCert,
        config.StatementTimeoutMs,
        config.ApplicationName,
    )

    poolConfig, err := pgxpool.ParseConfig(connStr)
    if err != nil {
        return nil, fmt.Errorf("parse config: %w", err)
    }

    poolConfig.MaxConns = int32(config.MaxConnections)
    poolConfig.MinConns = int32(config.MinConnections)
    poolConfig.MaxConnLifetime = 30 * time.Minute
    poolConfig.MaxConnIdleTime = 5 * time.Minute

    pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
    if err != nil {
        return nil, fmt.Errorf("create pool: %w", err)
    }

    // Verify connection
    if err := pool.Ping(ctx); err != nil {
        return nil, fmt.Errorf("ping database: %w", err)
    }

    return &SecureDB{pool: pool}, nil
}

func (db *SecureDB) WithTenant(
    ctx context.Context,
    tenantID string,
    fn func(ctx context.Context, tx pgx.Tx) error,
) error {
    tx, err := db.pool.Begin(ctx)
    if err != nil {
        return fmt.Errorf("begin tx: %w", err)
    }
    defer tx.Rollback(ctx)

    // Set tenant context for RLS
    _, err = tx.Exec(ctx, "SET LOCAL app.current_tenant = $1", tenantID)
    if err != nil {
        return fmt.Errorf("set tenant: %w", err)
    }

    if err := fn(ctx, tx); err != nil {
        return err
    }

    return tx.Commit(ctx)
}

func (db *SecureDB) Close() {
    db.pool.Close()
}
```

### TypeScript: Query Builder with Injection Protection

```typescript
// Safe query builder that prevents SQL injection
class SafeQueryBuilder {
  private conditions: string[] = [];
  private params: any[] = [];
  private paramIndex = 1;

  constructor(private tableName: string) {
    // Whitelist table names to prevent injection via table name
    const allowedTables = ['users', 'orders', 'products', 'sessions'];
    if (!allowedTables.includes(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
  }

  where(column: string, operator: string, value: any): this {
    // Whitelist operators
    const allowedOperators = ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'ILIKE', 'IN'];
    if (!allowedOperators.includes(operator.toUpperCase())) {
      throw new Error(`Invalid operator: ${operator}`);
    }

    // Whitelist column names against schema
    this.validateColumn(column);

    if (operator.toUpperCase() === 'IN' && Array.isArray(value)) {
      const placeholders = value.map(() => `$${this.paramIndex++}`).join(', ');
      this.conditions.push(`${column} IN (${placeholders})`);
      this.params.push(...value);
    } else {
      this.conditions.push(`${column} ${operator} $${this.paramIndex++}`);
      this.params.push(value);
    }

    return this;
  }

  build(): { query: string; params: any[] } {
    let query = `SELECT * FROM ${this.tableName}`;
    if (this.conditions.length > 0) {
      query += ` WHERE ${this.conditions.join(' AND ')}`;
    }
    return { query, params: this.params };
  }

  private validateColumn(column: string): void {
    // Only allow alphanumeric and underscore
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error(`Invalid column name: ${column}`);
    }
  }
}

// Usage
const builder = new SafeQueryBuilder('users');
const { query, params } = builder
  .where('status', '=', 'active')
  .where('age', '>=', 18)
  .where('role', 'IN', ['user', 'admin'])
  .build();

// query:  "SELECT * FROM users WHERE status = $1 AND age >= $2 AND role IN ($3, $4)"
// params: ['active', 18, 'user', 'admin']

const result = await pool.query(query, params);
```

---

## 16. Best Practices

### 1. Enforce Least Privilege for All Database Users

Create separate database users for each application and function. Grant only the
minimum permissions needed. Never use the superuser account for application queries.
Review grants quarterly.

### 2. Use sslmode=verify-full for All Database Connections

Configure full certificate verification for all database connections. Verify both
the server certificate chain and the hostname. Never set sslmode=disable or
rejectUnauthorized=false in production.

### 3. Implement Row-Level Security for Multi-Tenant Systems

Use PostgreSQL RLS to enforce tenant isolation at the database level. This provides
a safety net even if application code has bugs. Set tenant context per connection.

### 4. Use Parameterized Queries Exclusively

Never concatenate user input into SQL strings. Use parameterized queries with
positional or named parameters. This applies to all database interactions including
ORM raw queries.

### 5. Enable Audit Logging for Sensitive Tables

Deploy pgAudit or equivalent audit plugins. Log all access to tables containing PII,
financial data, or security-relevant data. Store audit logs separately from the
database with tamper protection.

### 6. Place Databases in Private Subnets

Never expose databases to the internet. Use security groups to restrict access to
only application servers and bastion hosts. Use VPC endpoints for AWS service access.

### 7. Encrypt Backups and Verify Restorability

Encrypt all database backups. Test backup restoration regularly (at least monthly).
Verify that encrypted backups can be successfully restored.

### 8. Remove Default Credentials and Harden Configuration

Change all default passwords immediately. Remove anonymous users, test databases,
and unnecessary privileges. Follow CIS benchmarks for database hardening.

### 9. Implement Connection Timeouts and Statement Limits

Set statement_timeout to prevent long-running queries from consuming resources.
Configure connection timeouts. Use connection pooling with appropriate limits.

### 10. Use IAM Authentication for Cloud Databases

Prefer IAM authentication over password-based authentication for cloud databases
(AWS RDS, GCP Cloud SQL). IAM tokens are short-lived and tie into existing identity
management.

---

## 17. Anti-Patterns

### 1. Using a Single Database User for All Applications

One shared database user means every application and service has every permission.
A compromised service gains access to all data. Create separate users per service.

### 2. Connecting Without TLS (sslmode=disable)

Unencrypted database connections expose credentials and data to network eavesdropping.
Always use TLS with certificate verification.

### 3. Concatenating User Input into SQL Queries

String concatenation is the root cause of SQL injection vulnerabilities. Use
parameterized queries without exception. This includes dynamic table/column names.

### 4. Granting SUPERUSER to Application Users

Application users should never have superuser privileges. SUPERUSER bypasses all
access controls, RLS policies, and audit restrictions.

### 5. Storing Database Credentials in Source Code

Hardcoded credentials in code or configuration files are exposed through version
control, container images, and process listings. Use secrets managers.

### 6. Exposing Databases to the Public Internet

Databases with public IP addresses are constantly scanned and attacked. Place them
in private subnets and access via VPN, bastion hosts, or private endpoints.

### 7. Disabling Row-Level Security for Convenience

Bypassing RLS with SECURITY DEFINER functions or superuser access negates the
security controls. Design applications to work within RLS constraints.

### 8. No Backup Encryption or Testing

Unencrypted backups are a common target for data theft. Untested backups may fail
when restoration is critical. Encrypt and test regularly.

---

## 18. Enforcement Checklist

### Access Control

- [ ] Separate database users created for each application/service
- [ ] Least privilege grants applied (no unnecessary SELECT/INSERT/UPDATE/DELETE)
- [ ] No application users have SUPERUSER or DBA privileges
- [ ] Default postgres/root credentials changed or login disabled
- [ ] Anonymous users removed (MySQL)
- [ ] Test database removed (MySQL)
- [ ] PUBLIC schema privileges revoked (PostgreSQL)
- [ ] Privilege grants reviewed quarterly

### Authentication

- [ ] scram-sha-256 (PostgreSQL) or caching_sha2_password (MySQL) enforced
- [ ] Certificate authentication or IAM authentication configured
- [ ] Password expiry policies set where applicable
- [ ] Failed login attempt monitoring enabled

### Network Security

- [ ] Database in private subnet (no public IP)
- [ ] Security groups restrict access to application servers only
- [ ] No inbound rules from 0.0.0.0/0
- [ ] VPC endpoints used for AWS service access
- [ ] Bastion host or VPN required for administrative access

### Connection Encryption

- [ ] TLS enabled on database server
- [ ] TLS 1.2 minimum version enforced
- [ ] sslmode=verify-full used in all application connections
- [ ] Plaintext connections rejected (hostnossl reject in pg_hba.conf)
- [ ] Weak cipher suites disabled

### Row-Level Security (if multi-tenant)

- [ ] RLS enabled on all tenant-scoped tables
- [ ] RLS policies tested for each operation (SELECT, INSERT, UPDATE, DELETE)
- [ ] FORCE ROW LEVEL SECURITY set on sensitive tables
- [ ] Tenant context set at connection level

### Encryption

- [ ] TDE enabled for database storage
- [ ] Column-level encryption for sensitive fields (SSN, credit cards)
- [ ] Encryption keys stored in KMS (not in database)
- [ ] Backup encryption enabled

### Audit and Monitoring

- [ ] pgAudit or equivalent audit plugin installed and configured
- [ ] Audit logging enabled for sensitive tables
- [ ] Audit logs stored separately with tamper protection
- [ ] Long-running query monitoring enabled
- [ ] Failed authentication attempt alerts configured
- [ ] Database performance monitoring enabled

### SQL Injection Prevention

- [ ] All queries use parameterized statements (no string concatenation)
- [ ] ORM raw queries use parameterized syntax
- [ ] Input validation applied at application layer
- [ ] Database firewall rules configured (if using proxy)
- [ ] Web Application Firewall (WAF) rules include SQL injection patterns

### Backup and Recovery

- [ ] Automated backups configured
- [ ] Backups encrypted with KMS-managed keys
- [ ] Backup restoration tested monthly
- [ ] Cross-region backup replication enabled (for DR)
- [ ] Backup retention period meets compliance requirements
- [ ] Point-in-time recovery tested

### Hardening

- [ ] CIS benchmark applied for database platform
- [ ] Unnecessary features disabled (LOCAL_INFILE, LOAD_FILE)
- [ ] Statement timeout configured
- [ ] Connection limits set appropriately
- [ ] Database version is current and supported
- [ ] Security patches applied within SLA
