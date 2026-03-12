# Secrets Management

## Comprehensive Guide to Storing, Distributing, and Rotating Secrets

Category: Data Security
Scope: Secret types, storage backends, injection patterns, rotation, scanning, and prevention
Last Updated: 2025-12-01
Status: Living Document

---

## Table of Contents

1. Secret Types and Classification
2. Secret Storage Backends
3. Secret Injection Patterns
4. Secret Rotation
5. Secret Scanning and Leak Prevention
6. .env File Security
7. Kubernetes Secrets
8. Docker Secrets
9. The Secret Zero Problem
10. Code Examples
11. Best Practices
12. Anti-Patterns
13. Enforcement Checklist

---

## 1. Secret Types and Classification

### Classification by Type

```
+----------------------------------------------------------------------+
| Type                   | Examples                    | Sensitivity   |
|----------------------------------------------------------------------+
| Database credentials   | Username/password, conn str | Critical      |
| API keys               | Stripe, SendGrid, Twilio    | High-Critical |
| Encryption keys        | AES keys, RSA private keys  | Critical      |
| TLS certificates       | Private keys, PFX files     | Critical      |
| OAuth tokens           | Access tokens, refresh tok  | High          |
| Service account keys   | GCP SA JSON, AWS access key | Critical      |
| Webhook secrets        | GitHub webhook HMAC secret  | High          |
| JWT signing keys       | HMAC secret, RSA private    | Critical      |
| SSH keys               | Private keys for deployment | Critical      |
| Password hashes/salts  | bcrypt hashes, salt values  | High          |
+----------------------------------------------------------------------+
```

### Classification by Sensitivity

**Critical**: Compromise leads to full system access, data breach, or financial loss.
Examples: database root credentials, master encryption keys, TLS private keys.

**High**: Compromise leads to significant but bounded impact. Examples: API keys
with spending limits, OAuth tokens with limited scope, service-specific credentials.

**Medium**: Compromise leads to limited impact. Examples: third-party API keys with
read-only access, internal service tokens with narrow permissions.

### Secret Properties

Every secret has these attributes to track:

```
- Identifier: Unique name or path for the secret
- Owner: Team or individual responsible
- Created: When the secret was created
- Expires: When the secret expires or must be rotated
- Scope: What systems/services use this secret
- Access: Who/what has permission to read this secret
- Rotation: How and how often the secret is rotated
- Classification: Sensitivity level
```

---

## 2. Secret Storage Backends

### HashiCorp Vault

Vault is the most comprehensive open-source secrets management solution.

#### KV Secrets Engine (Static Secrets)

```bash
# Enable KV v2 secrets engine
vault secrets enable -version=2 kv

# Store a secret
vault kv put kv/myapp/database \
  username="app_user" \
  password="s3cureP@ss!" \
  host="db.internal.example.com" \
  port="5432"

# Read a secret
vault kv get kv/myapp/database

# Read specific field
vault kv get -field=password kv/myapp/database

# List secrets
vault kv list kv/myapp/

# Delete a secret (soft delete in v2)
vault kv delete kv/myapp/database

# Permanently destroy a version
vault kv destroy -versions=1 kv/myapp/database
```

#### Dynamic Secrets (Generated On-Demand)

```bash
# Enable database secrets engine
vault secrets enable database

# Configure PostgreSQL connection
vault write database/config/myapp-db \
  plugin_name=postgresql-database-plugin \
  allowed_roles="readonly,readwrite" \
  connection_url="postgresql://{{username}}:{{password}}@db.internal:5432/myapp" \
  username="vault_admin" \
  password="vault_admin_pass"

# Create a role for read-only access
vault write database/roles/readonly \
  db_name=myapp-db \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"

# Generate dynamic credentials (new user/password each time)
vault read database/creds/readonly
# Returns: username=v-token-readonly-xxxx, password=A1B2C3D4..., lease_id=...

# Revoke credentials when done
vault lease revoke database/creds/readonly/lease-id-here
```

#### Vault Policies

```hcl
# Policy: Allow read-only access to myapp secrets
path "kv/data/myapp/*" {
  capabilities = ["read", "list"]
}

# Policy: Allow database credential generation
path "database/creds/readonly" {
  capabilities = ["read"]
}

# Policy: Deny access to admin secrets
path "kv/data/admin/*" {
  capabilities = ["deny"]
}
```

### AWS Secrets Manager

```typescript
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  CreateSecretCommand,
  RotateSecretCommand,
  PutSecretValueCommand
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

// Create a secret
await client.send(new CreateSecretCommand({
  Name: 'myapp/database/credentials',
  SecretString: JSON.stringify({
    username: 'app_user',
    password: 'securePassword123!',
    host: 'db.example.com',
    port: 5432,
    dbname: 'myapp'
  }),
  Tags: [
    { Key: 'Application', Value: 'myapp' },
    { Key: 'Environment', Value: 'production' }
  ]
}));

// Retrieve a secret
async function getSecret(secretName: string): Promise<Record<string, string>> {
  const response = await client.send(new GetSecretValueCommand({
    SecretId: secretName,
    VersionStage: 'AWSCURRENT'
  }));

  if (response.SecretString) {
    return JSON.parse(response.SecretString);
  }

  throw new Error('Secret is binary, not string');
}

// Enable automatic rotation
await client.send(new RotateSecretCommand({
  SecretId: 'myapp/database/credentials',
  RotationLambdaARN: 'arn:aws:lambda:us-east-1:123456789:function:RotateSecret',
  RotationRules: {
    AutomaticallyAfterDays: 30
  }
}));
```

### AWS Secrets Manager Cross-Account Access

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::987654321098:role/CrossAccountSecretReader"
      },
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "secretsmanager:ResourceTag/SharedWith": "account-987654321098"
        }
      }
    }
  ]
}
```

### GCP Secret Manager

```python
from google.cloud import secretmanager


def create_secret(project_id: str, secret_id: str, payload: str):
    """Create a secret in GCP Secret Manager."""
    client = secretmanager.SecretManagerServiceClient()
    parent = f"projects/{project_id}"

    # Create the secret
    secret = client.create_secret(
        request={
            "parent": parent,
            "secret_id": secret_id,
            "secret": {
                "replication": {
                    "automatic": {}
                },
                "labels": {
                    "application": "myapp",
                    "environment": "production"
                }
            }
        }
    )

    # Add the secret version (actual value)
    client.add_secret_version(
        request={
            "parent": secret.name,
            "payload": {
                "data": payload.encode("utf-8")
            }
        }
    )

    return secret


def access_secret(
    project_id: str,
    secret_id: str,
    version_id: str = "latest"
) -> str:
    """Access a secret version."""
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"

    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("utf-8")
```

### Azure Key Vault

```python
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient


def setup_azure_secrets():
    """Configure Azure Key Vault for secrets management."""
    credential = DefaultAzureCredential()
    vault_url = "https://my-vault.vault.azure.net"
    client = SecretClient(vault_url=vault_url, credential=credential)

    # Create a secret
    client.set_secret(
        name="myapp-database-password",
        value="securePassword123!",
        content_type="text/plain",
        tags={
            "application": "myapp",
            "environment": "production"
        }
    )

    # Retrieve a secret
    secret = client.get_secret("myapp-database-password")
    print(f"Value: {secret.value}")

    # List secrets
    for secret_properties in client.list_properties_of_secrets():
        print(f"Secret: {secret_properties.name}")

    # Soft delete a secret
    poller = client.begin_delete_secret("myapp-database-password")
    deleted_secret = poller.result()

    return client
```

### Infisical and Doppler

```typescript
// Infisical SDK
import { InfisicalClient } from '@infisical/sdk';

const infisical = new InfisicalClient({
  token: process.env.INFISICAL_TOKEN!
});

const secret = await infisical.getSecret({
  environment: 'production',
  projectId: 'project-id',
  path: '/',
  secretName: 'DATABASE_URL'
});

console.log(secret.secretValue);
```

```typescript
// Doppler SDK
// Doppler injects secrets as environment variables
// Configure via doppler.yaml:
// setup:
//   project: myapp
//   config: production
//
// Run with: doppler run -- node app.js
// All secrets available as process.env.*

// Or use the API
const response = await fetch('https://api.doppler.com/v3/configs/config/secrets', {
  headers: {
    Authorization: `Bearer ${DOPPLER_TOKEN}`,
    'Content-Type': 'application/json'
  }
});
const secrets = await response.json();
```

---

## 3. Secret Injection Patterns

### Pattern 1: Environment Variables

The simplest but least secure pattern. Use only for non-sensitive configuration.

```typescript
// Reading secrets from environment variables
const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) {
  throw new Error('DB_PASSWORD environment variable is required');
}

// Limitations:
// - Visible in process listings (ps aux, /proc/PID/environ)
// - Logged in crash dumps and error reports
// - Inherited by child processes
// - No audit trail of access
// - No rotation support
// - No encryption at rest
```

### Pattern 2: File Mounting

Mount secrets as files in the container filesystem. More secure than environment
variables because file permissions can restrict access.

```yaml
# Kubernetes: Mount secret as file
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
    - name: app
      image: myapp:latest
      volumeMounts:
        - name: db-credentials
          mountPath: /etc/secrets/db
          readOnly: true
  volumes:
    - name: db-credentials
      secret:
        secretName: db-credentials
        defaultMode: 0400  # Read-only for owner
```

```typescript
// Read secret from mounted file
import { readFileSync } from 'fs';

function readSecretFile(path: string): string {
  try {
    return readFileSync(path, 'utf8').trim();
  } catch (err) {
    throw new Error(`Failed to read secret from ${path}: ${err}`);
  }
}

const dbPassword = readSecretFile('/etc/secrets/db/password');
const dbUsername = readSecretFile('/etc/secrets/db/username');
```

### Pattern 3: Init Container

Fetch secrets during initialization before the application starts.

```yaml
# Kubernetes: Init container fetches secrets from Vault
apiVersion: v1
kind: Pod
metadata:
  name: myapp
  annotations:
    vault.hashicorp.com/agent-inject: "true"
    vault.hashicorp.com/role: "myapp"
    vault.hashicorp.com/agent-inject-secret-db: "kv/data/myapp/database"
    vault.hashicorp.com/agent-inject-template-db: |
      {{- with secret "kv/data/myapp/database" -}}
      {
        "username": "{{ .Data.data.username }}",
        "password": "{{ .Data.data.password }}",
        "host": "{{ .Data.data.host }}"
      }
      {{- end -}}
spec:
  serviceAccountName: myapp
  containers:
    - name: app
      image: myapp:latest
      # Secret available at /vault/secrets/db
```

### Pattern 4: SDK Fetching

Fetch secrets directly from the secrets manager at runtime.

```typescript
import {
  SecretsManagerClient,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager';

class SecretService {
  private client: SecretsManagerClient;
  private cache: Map<string, { value: string; expiry: number }>;
  private cacheTTL: number;

  constructor(region: string, cacheTTLMs: number = 300000) {
    this.client = new SecretsManagerClient({ region });
    this.cache = new Map();
    this.cacheTTL = cacheTTLMs;
  }

  async getSecret(secretName: string): Promise<string> {
    // Check cache first
    const cached = this.cache.get(secretName);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    // Fetch from Secrets Manager
    const response = await this.client.send(new GetSecretValueCommand({
      SecretId: secretName
    }));

    const value = response.SecretString!;

    // Cache the result
    this.cache.set(secretName, {
      value,
      expiry: Date.now() + this.cacheTTL
    });

    return value;
  }

  async getDatabaseConfig(secretName: string): Promise<{
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  }> {
    const secretString = await this.getSecret(secretName);
    return JSON.parse(secretString);
  }
}
```

```go
// Go: Fetch secrets from AWS Secrets Manager
package secrets

import (
    "context"
    "encoding/json"
    "fmt"
    "sync"
    "time"

    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

type SecretCache struct {
    client *secretsmanager.Client
    cache  map[string]cachedSecret
    mu     sync.RWMutex
    ttl    time.Duration
}

type cachedSecret struct {
    value  string
    expiry time.Time
}

func NewSecretCache(ctx context.Context, region string, ttl time.Duration) (*SecretCache, error) {
    cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
    if err != nil {
        return nil, fmt.Errorf("load AWS config: %w", err)
    }

    return &SecretCache{
        client: secretsmanager.NewFromConfig(cfg),
        cache:  make(map[string]cachedSecret),
        ttl:    ttl,
    }, nil
}

func (sc *SecretCache) GetSecret(ctx context.Context, name string) (string, error) {
    sc.mu.RLock()
    if cached, ok := sc.cache[name]; ok && time.Now().Before(cached.expiry) {
        sc.mu.RUnlock()
        return cached.value, nil
    }
    sc.mu.RUnlock()

    output, err := sc.client.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{
        SecretId: &name,
    })
    if err != nil {
        return "", fmt.Errorf("get secret %s: %w", name, err)
    }

    value := *output.SecretString

    sc.mu.Lock()
    sc.cache[name] = cachedSecret{
        value:  value,
        expiry: time.Now().Add(sc.ttl),
    }
    sc.mu.Unlock()

    return value, nil
}
```

---

## 4. Secret Rotation

### Automated Rotation Architecture

```
+--------------------------------------------------+
|                Rotation Process                   |
|                                                   |
|  1. Secrets Manager triggers rotation Lambda      |
|  2. Lambda creates new credential in target       |
|  3. Lambda stores new credential as AWSPENDING    |
|  4. Lambda tests new credential                   |
|  5. Lambda promotes AWSPENDING to AWSCURRENT      |
|  6. Applications fetch new secret on next call    |
+--------------------------------------------------+
```

### Zero-Downtime Rotation Pattern

```python
import boto3
import json
import logging

logger = logging.getLogger()


def lambda_handler(event, context):
    """AWS Secrets Manager rotation Lambda."""
    secret_arn = event['SecretId']
    token = event['ClientRequestToken']
    step = event['Step']

    sm_client = boto3.client('secretsmanager')

    if step == 'createSecret':
        create_secret(sm_client, secret_arn, token)
    elif step == 'setSecret':
        set_secret(sm_client, secret_arn, token)
    elif step == 'testSecret':
        test_secret(sm_client, secret_arn, token)
    elif step == 'finishSecret':
        finish_secret(sm_client, secret_arn, token)
    else:
        raise ValueError(f"Invalid step: {step}")


def create_secret(client, arn, token):
    """Create the new secret version."""
    # Get current secret
    current = client.get_secret_value(
        SecretId=arn, VersionStage='AWSCURRENT'
    )
    current_secret = json.loads(current['SecretString'])

    # Generate new password
    import secrets
    import string
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    new_password = ''.join(
        secrets.choice(alphabet) for _ in range(32)
    )

    # Create new secret version
    new_secret = {**current_secret, 'password': new_password}
    client.put_secret_value(
        SecretId=arn,
        ClientRequestToken=token,
        SecretString=json.dumps(new_secret),
        VersionStages=['AWSPENDING']
    )


def set_secret(client, arn, token):
    """Set the new credential in the target system."""
    # Get the pending secret
    pending = client.get_secret_value(
        SecretId=arn,
        VersionId=token,
        VersionStage='AWSPENDING'
    )
    new_secret = json.loads(pending['SecretString'])

    # Get current secret for existing credentials
    current = client.get_secret_value(
        SecretId=arn,
        VersionStage='AWSCURRENT'
    )
    current_secret = json.loads(current['SecretString'])

    # Update password in database
    import psycopg2
    conn = psycopg2.connect(
        host=current_secret['host'],
        port=current_secret['port'],
        user='admin',  # Use admin credentials for password change
        password=get_admin_password(),
        dbname=current_secret['dbname']
    )
    with conn.cursor() as cur:
        cur.execute(
            "ALTER USER %s WITH PASSWORD %s",
            (current_secret['username'], new_secret['password'])
        )
    conn.commit()
    conn.close()


def test_secret(client, arn, token):
    """Test the new credential works."""
    pending = client.get_secret_value(
        SecretId=arn,
        VersionId=token,
        VersionStage='AWSPENDING'
    )
    new_secret = json.loads(pending['SecretString'])

    # Test connection with new credentials
    import psycopg2
    conn = psycopg2.connect(
        host=new_secret['host'],
        port=new_secret['port'],
        user=new_secret['username'],
        password=new_secret['password'],
        dbname=new_secret['dbname']
    )
    conn.close()
    logger.info("New credentials verified successfully")


def finish_secret(client, arn, token):
    """Promote the pending secret to current."""
    # Get current version
    metadata = client.describe_secret(SecretId=arn)
    current_version = None

    for version_id, stages in metadata['VersionIdsToStages'].items():
        if 'AWSCURRENT' in stages:
            current_version = version_id
            break

    # Move AWSCURRENT to the new version
    client.update_secret_version_stage(
        SecretId=arn,
        VersionStage='AWSCURRENT',
        MoveToVersionId=token,
        RemoveFromVersionId=current_version
    )

    logger.info(f"Secret rotated successfully. New version: {token}")
```

### Application-Side Rotation Handling

```typescript
class RotationAwareSecretService {
  private currentSecret: string | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(
    private secretsManager: SecretsManagerClient,
    private secretName: string,
    private refreshIntervalMs: number = 300000 // 5 minutes
  ) {}

  async start(): Promise<void> {
    // Initial fetch
    await this.refresh();

    // Periodic refresh to pick up rotated secrets
    this.refreshInterval = setInterval(
      () => this.refresh().catch(console.error),
      this.refreshIntervalMs
    );
  }

  private async refresh(): Promise<void> {
    try {
      const response = await this.secretsManager.send(
        new GetSecretValueCommand({ SecretId: this.secretName })
      );
      const newSecret = response.SecretString!;

      if (newSecret !== this.currentSecret) {
        this.currentSecret = newSecret;
        this.emit('secretRotated', newSecret);
      }
    } catch (error) {
      console.error(`Failed to refresh secret: ${error}`);
      // Continue using cached secret
    }
  }

  getSecret(): string {
    if (!this.currentSecret) {
      throw new Error('Secret not yet loaded. Call start() first.');
    }
    return this.currentSecret;
  }

  stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}
```

---

## 5. Secret Scanning and Leak Prevention

### Pre-Commit Hooks

Prevent secrets from being committed to version control.

```bash
# Install git-secrets (AWS)
git secrets --install
git secrets --register-aws

# Install detect-secrets (Yelp)
pip install detect-secrets
detect-secrets scan > .secrets.baseline
detect-secrets audit .secrets.baseline
```

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']

  - repo: https://github.com/awslabs/git-secrets
    rev: master
    hooks:
      - id: git-secrets

  - repo: https://github.com/zricethezav/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

### CI Pipeline Scanning

```yaml
# GitHub Actions: Secret scanning with gitleaks
name: Secret Scanning
on: [push, pull_request]

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for scanning

      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

```yaml
# GitLab CI: Secret detection
secret_detection:
  stage: test
  image: registry.gitlab.com/gitlab-org/security-products/analyzers/secrets:latest
  script:
    - /analyzer run
  artifacts:
    reports:
      secret_detection: gl-secret-detection-report.json
```

### TruffleHog (Deep Scanning)

```bash
# Scan Git repository history
trufflehog git file://. --since-commit HEAD~50

# Scan entire repository
trufflehog git https://github.com/org/repo.git

# Scan filesystem
trufflehog filesystem /path/to/code

# Scan with specific detectors only
trufflehog git file://. --only-verified
```

### GitHub Secret Scanning

```yaml
# GitHub: Configure secret scanning alerts
# Repository Settings > Code security and analysis > Secret scanning

# Custom patterns (.github/secret_scanning.yml)
patterns:
  - name: "Internal API Key"
    pattern: "INTERNAL_[A-Z]+_KEY_[a-zA-Z0-9]{32}"
    description: "Internal API key format"
```

### Entropy-Based Detection

```python
import math
import re


def calculate_entropy(data: str) -> float:
    """Calculate Shannon entropy of a string."""
    if not data:
        return 0.0

    entropy = 0.0
    for x in range(256):
        p_x = data.count(chr(x)) / len(data)
        if p_x > 0:
            entropy -= p_x * math.log2(p_x)

    return entropy


def scan_for_secrets(content: str, threshold: float = 4.5) -> list[dict]:
    """Scan content for high-entropy strings that may be secrets."""
    findings = []

    # Split into tokens
    tokens = re.findall(r'[A-Za-z0-9+/=_\-]{20,}', content)

    for token in tokens:
        entropy = calculate_entropy(token)
        if entropy > threshold:
            findings.append({
                'token': token[:10] + '...',
                'entropy': round(entropy, 2),
                'length': len(token),
                'likely_type': classify_secret(token)
            })

    return findings


def classify_secret(token: str) -> str:
    """Classify a potential secret by pattern."""
    patterns = {
        r'^AKIA[0-9A-Z]{16}$': 'AWS Access Key',
        r'^ghp_[a-zA-Z0-9]{36}$': 'GitHub Personal Access Token',
        r'^sk-[a-zA-Z0-9]{48}$': 'OpenAI API Key',
        r'^sk_live_[a-zA-Z0-9]+$': 'Stripe Secret Key',
        r'^xox[baprs]-[a-zA-Z0-9-]+$': 'Slack Token',
    }

    for pattern, name in patterns.items():
        if re.match(pattern, token):
            return name

    return 'Unknown high-entropy string'
```

---

## 6. .env File Security

### Rules for .env Files

1. NEVER commit .env files to version control
2. Always add `.env` to `.gitignore`
3. Provide a `.env.example` with placeholder values
4. Use different .env files per environment
5. Restrict file permissions to the application user only

```bash
# .gitignore -- MUST include these
.env
.env.local
.env.production
.env.*.local
*.key
*.pem
credentials.json
service-account.json
```

```bash
# .env.example (safe to commit -- contains NO real values)
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
DB_USER=your_username
DB_PASSWORD=your_password

# API Keys
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
SENDGRID_API_KEY=SG.xxxxxxxxxxxx

# Encryption
ENCRYPTION_KEY=generate-with-openssl-rand-base64-32
```

```bash
# Set restrictive file permissions on .env
chmod 600 .env
chown appuser:appuser .env
```

### Verify .env is Not Tracked

```bash
# Check if .env is tracked by git
git ls-files --error-unmatch .env 2>/dev/null && echo "WARNING: .env is tracked!"

# Remove .env from tracking if accidentally committed
git rm --cached .env
echo ".env" >> .gitignore
git commit -m "Remove .env from tracking"

# WARNING: The .env content is still in git history!
# Use BFG Repo-Cleaner or git filter-branch to remove from history
# Then rotate ALL secrets that were exposed
```

---

## 7. Kubernetes Secrets

### Base64 is NOT Encryption

Kubernetes secrets store values as base64 encoding, which is trivially reversible.
Base64 provides zero security.

```bash
# Kubernetes secret -- base64 encoded, NOT encrypted
echo -n "mypassword" | base64
# Output: bXlwYXNzd29yZA==

echo "bXlwYXNzd29yZA==" | base64 -d
# Output: mypassword

# Anyone with RBAC access to read secrets can decode them
```

### Sealed Secrets (Bitnami)

Sealed Secrets encrypts secrets with a cluster-specific key. Only the controller
in the cluster can decrypt them, making it safe to store in Git.

```yaml
# Install sealed-secrets controller
# helm install sealed-secrets sealed-secrets/sealed-secrets -n kube-system

# Create a SealedSecret from a regular secret
# kubeseal --format yaml < secret.yaml > sealed-secret.yaml

apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: db-credentials
  namespace: production
spec:
  encryptedData:
    username: AgBz+3Y...encrypted...
    password: AgCw+7X...encrypted...
```

### External Secrets Operator

```yaml
# ExternalSecret: Sync from AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: production
spec:
  refreshInterval: 5m
  secretStoreRef:
    name: aws-secret-store
    kind: SecretStore
  target:
    name: db-credentials
    creationPolicy: Owner
  data:
    - secretKey: username
      remoteRef:
        key: myapp/database/credentials
        property: username
    - secretKey: password
      remoteRef:
        key: myapp/database/credentials
        property: password

---
# SecretStore: AWS Secrets Manager backend
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secret-store
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
```

### Vault CSI Provider

```yaml
# Vault CSI Provider: Mount Vault secrets as volumes
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: vault-db-credentials
spec:
  provider: vault
  parameters:
    vaultAddress: "https://vault.internal:8200"
    roleName: "myapp"
    objects: |
      - objectName: "db-username"
        secretPath: "kv/data/myapp/database"
        secretKey: "username"
      - objectName: "db-password"
        secretPath: "kv/data/myapp/database"
        secretKey: "password"

---
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  serviceAccountName: myapp
  containers:
    - name: app
      image: myapp:latest
      volumeMounts:
        - name: secrets
          mountPath: /mnt/secrets
          readOnly: true
  volumes:
    - name: secrets
      csi:
        driver: secrets-store.csi.k8s.io
        readOnly: true
        volumeAttributes:
          secretProviderClass: vault-db-credentials
```

---

## 8. Docker Secrets

### Docker Swarm Secrets

```bash
# Create a secret
echo "s3cureP@ssw0rd" | docker secret create db_password -

# Create secret from file
docker secret create tls_cert server.crt

# Use secret in a service
docker service create \
  --name myapp \
  --secret db_password \
  --secret tls_cert \
  myapp:latest

# Secret is available at /run/secrets/db_password inside the container
```

```yaml
# Docker Compose with secrets
version: '3.8'

services:
  app:
    image: myapp:latest
    secrets:
      - db_password
      - api_key
    environment:
      DB_PASSWORD_FILE: /run/secrets/db_password
      API_KEY_FILE: /run/secrets/api_key

secrets:
  db_password:
    file: ./secrets/db_password.txt  # Local file
  api_key:
    external: true  # Pre-created docker secret
```

### Docker Build Secrets

```dockerfile
# Dockerfile: Use build secrets (never baked into image layers)
# syntax=docker/dockerfile:1.4

FROM node:20-alpine

WORKDIR /app
COPY package*.json ./

# Use build secret for private npm registry
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) \
    npm install --production

COPY . .

# Build command:
# docker build --secret id=npm_token,src=.npmrc .
```

---

## 9. The Secret Zero Problem

### The Problem

To retrieve secrets from a vault, the application needs credentials to authenticate
to the vault. But those credentials are themselves secrets. This creates a circular
dependency: how do you authenticate to get the first secret?

### Solutions

```
+------------------------------------------------------------+
| Method                  | Security  | Complexity | Platform |
|------------------------------------------------------------|
| Cloud IAM roles         | High      | Low        | Cloud    |
| Kubernetes SA + OIDC    | High      | Medium     | K8s      |
| Vault AppRole           | High      | Medium     | Any      |
| Vault Agent auto-auth   | High      | Low        | Any      |
| Trusted platform ID     | High      | Low        | Cloud    |
| Token wrapping          | High      | Medium     | Vault    |
+------------------------------------------------------------+
```

### Cloud IAM Roles (Recommended for Cloud)

```
No secret needed! The cloud provider's metadata service provides
temporary credentials based on the instance/pod identity.

EC2 Instance -> IAM Role -> Temporary Credentials -> Secrets Manager
EKS Pod -> ServiceAccount -> IRSA/OIDC -> Temporary Credentials -> Secrets Manager
GKE Pod -> Workload Identity -> GCP SA -> Secret Manager
```

```typescript
// AWS: No hardcoded credentials needed
// The SDK automatically uses the IAM role attached to the EC2/EKS/Lambda
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });
// Authentication happens automatically via IAM role
const secret = await client.send(new GetSecretValueCommand({
  SecretId: 'myapp/database'
}));
```

### Vault AppRole

```bash
# Configure AppRole auth method
vault auth enable approle

# Create role for the application
vault write auth/approle/role/myapp \
  token_ttl=1h \
  token_max_ttl=4h \
  secret_id_ttl=10m \
  secret_id_num_uses=1 \
  token_policies="myapp-policy"

# Get RoleID (not sensitive, can be baked into config)
vault read auth/approle/role/myapp/role-id

# Generate SecretID (sensitive, delivered securely)
vault write -f auth/approle/role/myapp/secret-id

# Application authenticates with RoleID + SecretID
vault write auth/approle/login \
  role_id="role-id-here" \
  secret_id="secret-id-here"
# Returns a Vault token for accessing secrets
```

### Vault Agent Auto-Auth

```hcl
# vault-agent-config.hcl
auto_auth {
  method "kubernetes" {
    mount_path = "auth/kubernetes"
    config = {
      role = "myapp"
    }
  }

  sink "file" {
    config = {
      path = "/vault/token"
      mode = 0400
    }
  }
}

cache {
  use_auto_auth_token = true
}

listener "tcp" {
  address     = "127.0.0.1:8200"
  tls_disable = true
}

template {
  source      = "/vault/templates/db-config.tpl"
  destination = "/vault/secrets/db-config.json"
}
```

---

## 10. Code Examples

### TypeScript: Complete Secret Management Service

```typescript
import {
  SecretsManagerClient,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager';

interface SecretConfig {
  region: string;
  cacheTTLMs: number;
  prefix: string;
}

interface CachedSecret {
  value: string;
  fetchedAt: number;
}

class SecretManager {
  private client: SecretsManagerClient;
  private cache: Map<string, CachedSecret>;
  private config: SecretConfig;

  constructor(config: SecretConfig) {
    this.client = new SecretsManagerClient({ region: config.region });
    this.cache = new Map();
    this.config = config;
  }

  async get(name: string): Promise<string> {
    const fullName = `${this.config.prefix}/${name}`;

    // Check cache
    const cached = this.cache.get(fullName);
    if (cached && Date.now() - cached.fetchedAt < this.config.cacheTTLMs) {
      return cached.value;
    }

    // Fetch from Secrets Manager
    const response = await this.client.send(new GetSecretValueCommand({
      SecretId: fullName
    }));

    if (!response.SecretString) {
      throw new Error(`Secret ${fullName} has no string value`);
    }

    // Update cache
    this.cache.set(fullName, {
      value: response.SecretString,
      fetchedAt: Date.now()
    });

    return response.SecretString;
  }

  async getJSON<T>(name: string): Promise<T> {
    const raw = await this.get(name);
    return JSON.parse(raw) as T;
  }

  invalidateCache(name?: string): void {
    if (name) {
      this.cache.delete(`${this.config.prefix}/${name}`);
    } else {
      this.cache.clear();
    }
  }
}

// Usage
const secrets = new SecretManager({
  region: 'us-east-1',
  cacheTTLMs: 300000,  // 5 minutes
  prefix: 'production/myapp'
});

interface DbConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

const dbConfig = await secrets.getJSON<DbConfig>('database');
```

### Python: Vault Client with Auto-Renewal

```python
import hvac
import time
import threading
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)


class VaultSecretManager:
    """HashiCorp Vault client with token renewal and caching."""

    def __init__(
        self,
        vault_addr: str,
        auth_method: str = "kubernetes",
        role: str = "myapp",
        mount_point: str = "kubernetes",
    ):
        self.client = hvac.Client(url=vault_addr)
        self._authenticate(auth_method, role, mount_point)
        self._start_renewal_thread()

    def _authenticate(
        self, method: str, role: str, mount_point: str
    ):
        """Authenticate to Vault."""
        if method == "kubernetes":
            with open(
                "/var/run/secrets/kubernetes.io/serviceaccount/token"
            ) as f:
                jwt = f.read()

            self.client.auth.kubernetes.login(
                role=role, jwt=jwt, mount_point=mount_point
            )
        elif method == "approle":
            import os
            self.client.auth.approle.login(
                role_id=os.environ["VAULT_ROLE_ID"],
                secret_id=os.environ["VAULT_SECRET_ID"],
            )

        logger.info("Authenticated to Vault successfully")

    def _start_renewal_thread(self):
        """Start background thread for token renewal."""
        def renew():
            while True:
                try:
                    token_info = self.client.auth.token.lookup_self()
                    ttl = token_info["data"]["ttl"]
                    # Renew at 75% of TTL
                    sleep_time = max(ttl * 0.75, 60)
                    time.sleep(sleep_time)
                    self.client.auth.token.renew_self()
                    logger.info("Vault token renewed")
                except Exception as e:
                    logger.error(f"Token renewal failed: {e}")
                    time.sleep(30)

        thread = threading.Thread(target=renew, daemon=True)
        thread.start()

    def get_secret(self, path: str) -> dict:
        """Read a secret from Vault KV v2."""
        response = self.client.secrets.kv.v2.read_secret_version(
            path=path
        )
        return response["data"]["data"]

    def get_dynamic_credentials(self, role: str) -> dict:
        """Get dynamic database credentials."""
        response = self.client.secrets.database.generate_credentials(
            name=role
        )
        return {
            "username": response["data"]["username"],
            "password": response["data"]["password"],
            "lease_id": response["lease_id"],
            "lease_duration": response["lease_duration"],
        }
```

### Go: Multi-Backend Secret Manager

```go
package secrets

import (
    "context"
    "encoding/json"
    "fmt"
    "os"
    "sync"
    "time"
)

// SecretBackend defines the interface for secret storage backends
type SecretBackend interface {
    GetSecret(ctx context.Context, name string) (string, error)
    SetSecret(ctx context.Context, name string, value string) error
}

// SecretManager provides cached access to secrets
type SecretManager struct {
    backend SecretBackend
    cache   map[string]cachedValue
    mu      sync.RWMutex
    ttl     time.Duration
}

type cachedValue struct {
    value  string
    expiry time.Time
}

func NewSecretManager(backend SecretBackend, cacheTTL time.Duration) *SecretManager {
    return &SecretManager{
        backend: backend,
        cache:   make(map[string]cachedValue),
        ttl:     cacheTTL,
    }
}

func (sm *SecretManager) Get(ctx context.Context, name string) (string, error) {
    sm.mu.RLock()
    if cached, ok := sm.cache[name]; ok && time.Now().Before(cached.expiry) {
        sm.mu.RUnlock()
        return cached.value, nil
    }
    sm.mu.RUnlock()

    value, err := sm.backend.GetSecret(ctx, name)
    if err != nil {
        return "", fmt.Errorf("get secret %s: %w", name, err)
    }

    sm.mu.Lock()
    sm.cache[name] = cachedValue{
        value:  value,
        expiry: time.Now().Add(sm.ttl),
    }
    sm.mu.Unlock()

    return value, nil
}

func (sm *SecretManager) GetJSON(ctx context.Context, name string, target interface{}) error {
    value, err := sm.Get(ctx, name)
    if err != nil {
        return err
    }
    return json.Unmarshal([]byte(value), target)
}

func (sm *SecretManager) InvalidateCache(name string) {
    sm.mu.Lock()
    delete(sm.cache, name)
    sm.mu.Unlock()
}

// EnvBackend reads secrets from environment (development only)
type EnvBackend struct {
    prefix string
}

func (e *EnvBackend) GetSecret(ctx context.Context, name string) (string, error) {
    key := fmt.Sprintf("%s_%s", e.prefix, name)
    value := os.Getenv(key)
    if value == "" {
        return "", fmt.Errorf("environment variable %s not set", key)
    }
    return value, nil
}

func (e *EnvBackend) SetSecret(ctx context.Context, name string, value string) error {
    return fmt.Errorf("cannot set environment variables at runtime")
}
```

---

## 11. Best Practices

### 1. Never Store Secrets in Source Code or Version Control

Use secret scanning in pre-commit hooks and CI pipelines. Treat any secret that has
been committed as compromised, even if removed in a subsequent commit.

### 2. Use a Dedicated Secrets Manager

Adopt HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager, or Azure Key Vault.
These provide encryption at rest, access control, audit logging, and rotation support.

### 3. Implement Automated Secret Rotation

Configure automatic rotation for database credentials, API keys, and certificates.
Design applications to handle rotation gracefully (periodic refresh, connection retry).

### 4. Solve Secret Zero with Platform Identity

Use cloud IAM roles, Kubernetes service accounts with OIDC, or Vault auto-auth to
eliminate the need for a bootstrap secret.

### 5. Cache Secrets with Short TTL

Cache secrets in memory with a TTL of 5-15 minutes to reduce API calls and latency.
Implement cache invalidation on rotation events.

### 6. Prefer Dynamic Secrets Over Static Credentials

Use Vault dynamic secrets or IAM-authenticated database access to generate short-lived
credentials on demand rather than long-lived static passwords.

### 7. Implement Secret Scanning at Multiple Layers

Deploy pre-commit hooks, CI pipeline scanning, and repository-level scanning.
Use both pattern-based and entropy-based detection.

### 8. Restrict Secret Access with Least Privilege

Grant secret access only to the services that need them. Use IAM policies, Vault
policies, and RBAC to enforce minimum necessary permissions.

### 9. Monitor and Alert on Secret Access

Enable audit logging for all secret access. Alert on unusual access patterns
(unexpected services, unusual times, high-frequency access).

### 10. Use Separate Secrets Per Environment

Never share secrets between development, staging, and production environments.
Each environment should have independently managed, unique secrets.

---

## 12. Anti-Patterns

### 1. Committing Secrets to Version Control

Even after removal, secrets remain in Git history forever. Use BFG Repo-Cleaner
to remove them, then rotate all affected secrets immediately.

### 2. Using Environment Variables for Sensitive Secrets

Environment variables are visible in process listings, crash dumps, and container
orchestration APIs. Use file mounting or SDK-based fetching instead.

### 3. Sharing Secrets via Chat, Email, or Tickets

Secrets shared through communication channels persist in logs and backups. Use
a secrets manager with sharing capabilities or one-time secret sharing tools.

### 4. Using Long-Lived Static Credentials

Credentials that never expire accumulate risk over time. Implement rotation schedules
or use dynamic credentials with short TTLs.

### 5. Treating Kubernetes Secrets as Encrypted

Kubernetes secrets use base64 encoding, not encryption. Anyone with RBAC access to
read secrets can decode them. Use Sealed Secrets or External Secrets Operator.

### 6. Hardcoding Secrets in Container Images

Secrets baked into Docker images are extractable from image layers. Use Docker secrets,
runtime injection, or volume mounts instead.

### 7. Using the Same Secret Across Multiple Services

Shared secrets mean that rotating for one service requires coordinating across all
services. Use unique secrets per service.

### 8. No Audit Trail for Secret Access

Without logging, you cannot detect unauthorized access or investigate incidents.
Enable audit logging on all secret storage backends.

---

## 13. Enforcement Checklist

### Secret Storage

- [ ] All secrets stored in a dedicated secrets manager (not env vars or config files)
- [ ] No secrets in source code (verified by pre-commit hooks)
- [ ] No secrets in container images (verified by image scanning)
- [ ] No secrets in CI/CD pipeline logs (verified by log review)
- [ ] .env files excluded from version control (.gitignore)
- [ ] Secret storage encrypted at rest

### Secret Access Control

- [ ] Least privilege access to secrets (per-service permissions)
- [ ] Separate secrets per environment (dev/staging/prod)
- [ ] Audit logging enabled for all secret access
- [ ] Alert on anomalous secret access patterns
- [ ] Regular access review (quarterly)

### Secret Rotation

- [ ] Automated rotation configured for database credentials
- [ ] Automated rotation configured for API keys (where supported)
- [ ] Certificate rotation automated (ACME/certbot)
- [ ] Applications handle secret rotation gracefully
- [ ] Rotation tested in non-production environments

### Secret Scanning

- [ ] Pre-commit hooks installed (detect-secrets, git-secrets, gitleaks)
- [ ] CI pipeline scanning configured (gitleaks, trufflehog)
- [ ] GitHub/GitLab native secret scanning enabled
- [ ] Entropy-based detection configured
- [ ] Custom patterns defined for organization-specific secrets
- [ ] Alert and response process for detected secrets

### Secret Zero

- [ ] Cloud IAM roles used instead of static credentials (where applicable)
- [ ] Kubernetes workload identity configured
- [ ] Vault auto-auth or AppRole configured
- [ ] No bootstrap secrets stored insecurely

### Kubernetes (if applicable)

- [ ] Base64 Kubernetes secrets not treated as encrypted
- [ ] Sealed Secrets or External Secrets Operator deployed
- [ ] RBAC restricts secret read access
- [ ] Secrets mounted as files, not environment variables
- [ ] etcd encryption enabled for Kubernetes secrets at rest

### Incident Response

- [ ] Secret leak response procedure documented
- [ ] Immediate rotation capability for all critical secrets
- [ ] Communication plan for secret compromise
- [ ] Post-incident review process
- [ ] Git history cleanup procedures documented
