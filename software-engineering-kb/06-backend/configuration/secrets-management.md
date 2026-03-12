# Secrets Management

> **AI Plugin Directive — Secrets Management & Secure Configuration**
> You are an AI coding assistant. When generating, reviewing, or refactoring secrets management
> code, follow EVERY rule in this document. Exposed secrets cause data breaches, unauthorized
> access, and catastrophic security incidents. Treat each section as non-negotiable.

**Core Rule: NEVER hardcode secrets in source code, config files, or container images. ALWAYS load secrets from a secure vault or encrypted environment at runtime. ALWAYS rotate secrets on a schedule — assume every secret will eventually leak.**

---

## 1. Secrets Classification

```
┌──────────────────────────────────────────────────────────────┐
│              Secret Types & Sensitivity                        │
│                                                               │
│  CRITICAL (breach = catastrophic)                            │
│  ├── Database master credentials                             │
│  ├── Encryption keys (AES, RSA private keys)                 │
│  ├── JWT signing keys                                        │
│  ├── Cloud provider root credentials (AWS root, GCP SA)      │
│  └── Payment processor API keys (Stripe secret key)          │
│                                                               │
│  HIGH (breach = significant damage)                          │
│  ├── Third-party API keys (SendGrid, Twilio)                 │
│  ├── OAuth client secrets                                    │
│  ├── SSH keys and certificates                               │
│  └── Service-to-service auth tokens                          │
│                                                               │
│  MODERATE (breach = limited impact)                          │
│  ├── Internal service URLs (non-public endpoints)            │
│  ├── Monitoring/logging API keys                             │
│  └── Non-production credentials                              │
│                                                               │
│  ALL secrets: NEVER in code. NEVER in git. NEVER in logs.   │
└──────────────────────────────────────────────────────────────┘
```

| Secret Type | Rotation Frequency | Storage | Access Pattern |
|-------------|-------------------|---------|----------------|
| Database credentials | 90 days | Vault / AWS Secrets Manager | Inject at startup |
| JWT signing keys | 90 days (overlap) | Vault / KMS | JWKS endpoint |
| API keys (external) | 180 days | Vault / SSM | Inject at startup |
| Encryption keys | 365 days (overlap) | KMS (never export) | API call to KMS |
| TLS certificates | Auto-renew (Let's Encrypt) | Cert manager | Mount as file |
| Service tokens | 30-90 days | Vault dynamic secrets | Lease-based |

---

## 2. Secret Storage Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Secrets Management Architecture                   │
│                                                               │
│  Application                                                  │
│  ┌─────────────────────────────┐                             │
│  │  Secrets Client             │                             │
│  │  ├── Load on startup        │                             │
│  │  ├── Cache in memory        │                             │
│  │  └── Refresh on rotation    │                             │
│  └─────────┬───────────────────┘                             │
│             │                                                 │
│  ┌──────────▼──────────────────────────────────────┐         │
│  │  Secrets Backend (one of)                        │         │
│  │                                                   │         │
│  │  ┌──────────────┐  ┌────────────────────────┐   │         │
│  │  │ HashiCorp    │  │ AWS Secrets Manager    │   │         │
│  │  │ Vault        │  │ / Parameter Store      │   │         │
│  │  └──────────────┘  └────────────────────────┘   │         │
│  │                                                   │         │
│  │  ┌──────────────┐  ┌────────────────────────┐   │         │
│  │  │ GCP Secret   │  │ Azure Key Vault        │   │         │
│  │  │ Manager      │  │                        │   │         │
│  │  └──────────────┘  └────────────────────────┘   │         │
│  │                                                   │         │
│  │  ┌──────────────┐                                │         │
│  │  │ K8s Secrets  │  (for simple setups,           │         │
│  │  │ + SOPS       │   NOT recommended as           │         │
│  │  └──────────────┘   sole solution for prod)      │         │
│  └──────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

| Backend | Best For | Auto-Rotation | Dynamic Secrets | Audit Log |
|---------|----------|---------------|-----------------|-----------|
| **HashiCorp Vault** | Multi-cloud, enterprise | YES | YES (DB creds) | YES |
| **AWS Secrets Manager** | AWS-native | YES | NO | CloudTrail |
| **AWS SSM Parameter Store** | AWS, simple config+secrets | NO | NO | CloudTrail |
| **GCP Secret Manager** | GCP-native | YES | NO | Cloud Audit |
| **Azure Key Vault** | Azure-native | YES | NO | YES |
| **SOPS + Git** | GitOps, small teams | Manual | NO | Git history |
| **K8s Secrets** | Simple K8s deployments | Manual | NO | K8s audit |

---

## 3. Secret Loading Patterns

### 3.1 TypeScript

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

interface AppSecrets {
  dbPassword: string;
  jwtSecret: string;
  stripeSecretKey: string;
  sendgridApiKey: string;
}

class SecretLoader {
  private client: SecretsManagerClient;
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();
  private cacheTTL = 300_000; // 5 min cache

  constructor(region: string) {
    this.client = new SecretsManagerClient({ region });
  }

  async getSecret(secretId: string): Promise<string> {
    // Check cache
    const cached = this.cache.get(secretId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    // Fetch from Secrets Manager
    const command = new GetSecretValueCommand({ SecretId: secretId });
    const response = await this.client.send(command);
    const value = response.SecretString!;

    // Cache in memory
    this.cache.set(secretId, { value, expiresAt: Date.now() + this.cacheTTL });
    return value;
  }

  async loadAppSecrets(): Promise<AppSecrets> {
    const raw = await this.getSecret("myapp/production/secrets");
    return JSON.parse(raw);
  }
}

// Startup
const secretLoader = new SecretLoader("us-east-1");
const secrets = await secretLoader.loadAppSecrets();

// Construct config with secrets injected
const dbConfig = {
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT!),
  password: secrets.dbPassword, // From vault, NOT env var
};
```

### 3.2 Go

```go
import (
    "context"
    "github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

type SecretLoader struct {
    client *secretsmanager.Client
    cache  sync.Map
}

type AppSecrets struct {
    DBPassword     string `json:"dbPassword"`
    JWTSecret      string `json:"jwtSecret"`
    StripeKey      string `json:"stripeSecretKey"`
    SendgridAPIKey string `json:"sendgridApiKey"`
}

func (s *SecretLoader) GetSecret(ctx context.Context, secretID string) (string, error) {
    // Check cache
    if cached, ok := s.cache.Load(secretID); ok {
        entry := cached.(*cacheEntry)
        if time.Now().Before(entry.ExpiresAt) {
            return entry.Value, nil
        }
    }

    input := &secretsmanager.GetSecretValueInput{SecretId: &secretID}
    result, err := s.client.GetSecretValue(ctx, input)
    if err != nil {
        return "", fmt.Errorf("failed to load secret %s: %w", secretID, err)
    }

    value := *result.SecretString
    s.cache.Store(secretID, &cacheEntry{Value: value, ExpiresAt: time.Now().Add(5 * time.Minute)})
    return value, nil
}

func (s *SecretLoader) LoadAppSecrets(ctx context.Context) (*AppSecrets, error) {
    raw, err := s.GetSecret(ctx, "myapp/production/secrets")
    if err != nil {
        return nil, err
    }

    var secrets AppSecrets
    if err := json.Unmarshal([]byte(raw), &secrets); err != nil {
        return nil, fmt.Errorf("invalid secret format: %w", err)
    }
    return &secrets, nil
}
```

### 3.3 Python

```python
import boto3, json
from functools import lru_cache

class SecretLoader:
    def __init__(self, region: str = "us-east-1"):
        self._client = boto3.client("secretsmanager", region_name=region)
        self._cache: dict[str, tuple[str, float]] = {}
        self._cache_ttl = 300  # 5 min

    def get_secret(self, secret_id: str) -> str:
        cached = self._cache.get(secret_id)
        if cached and time.time() < cached[1]:
            return cached[0]

        response = self._client.get_secret_value(SecretId=secret_id)
        value = response["SecretString"]
        self._cache[secret_id] = (value, time.time() + self._cache_ttl)
        return value

    def load_app_secrets(self) -> dict:
        raw = self.get_secret("myapp/production/secrets")
        return json.loads(raw)

# Startup
loader = SecretLoader()
secrets = loader.load_app_secrets()
```

- ALWAYS load secrets at startup — NEVER lazy-load on first request (fail fast)
- ALWAYS cache secrets in memory — minimize vault API calls
- ALWAYS refresh cached secrets periodically (5-15 min TTL)
- NEVER log secret values — log only the secret ID/name

---

## 4. Kubernetes Secrets Integration

```yaml
# External Secrets Operator — sync from vault to K8s Secret
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
spec:
  refreshInterval: 5m
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: app-secrets
    creationPolicy: Owner
  data:
    - secretKey: DB_PASSWORD
      remoteRef:
        key: myapp/production/secrets
        property: dbPassword
    - secretKey: JWT_SECRET
      remoteRef:
        key: myapp/production/secrets
        property: jwtSecret
---
# Pod using the synced secret
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: api
          envFrom:
            - secretRef:
                name: app-secrets
```

```yaml
# SOPS — encrypted secrets in git (GitOps pattern)
# Encrypt: sops --encrypt --in-place secrets.yaml
# Decrypt: sops --decrypt secrets.yaml

apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
stringData:
  DB_PASSWORD: ENC[AES256_GCM,data:encrypted_value...]
  JWT_SECRET: ENC[AES256_GCM,data:encrypted_value...]
sops:
  kms:
    - arn: arn:aws:kms:us-east-1:123:key/abc-def
  version: 3.7.3
```

- ALWAYS use External Secrets Operator to sync vault secrets to K8s Secrets
- ALWAYS set `refreshInterval` to detect rotated secrets automatically
- ALWAYS use SOPS for encrypted secrets in GitOps workflows
- NEVER store plaintext secrets in Kubernetes manifests committed to git

---

## 5. Secret Rotation

```
┌──────────────────────────────────────────────────────────────┐
│              Zero-Downtime Secret Rotation                     │
│                                                               │
│  Phase 1: Prepare (new secret created alongside old)         │
│  ├── Generate new credential                                 │
│  ├── Store new + old in vault (dual-active)                  │
│  └── Both old and new are valid                              │
│                                                               │
│  Phase 2: Propagate (applications pick up new secret)        │
│  ├── Applications refresh cache (5-15 min)                   │
│  ├── New connections use new credential                      │
│  └── Old connections still work (old still valid)            │
│                                                               │
│  Phase 3: Retire (old secret invalidated)                    │
│  ├── Wait for all instances to refresh (2x cache TTL)        │
│  ├── Revoke old credential                                   │
│  └── Remove old secret from vault                            │
│                                                               │
│  Timeline: Phase 1 → wait 1h → Phase 2 → wait 1h → Phase 3 │
└──────────────────────────────────────────────────────────────┘
```

```typescript
// Application supports dual credentials during rotation
class RotatableDBConnection {
  private primary: DatabasePool;
  private fallback?: DatabasePool;

  async query(sql: string, params: any[]): Promise<any> {
    try {
      return await this.primary.query(sql, params);
    } catch (err) {
      if (this.isAuthError(err) && this.fallback) {
        logger.warn("Primary credential failed, using fallback");
        // Swap: fallback becomes primary
        [this.primary, this.fallback] = [this.fallback, this.primary];
        return await this.primary.query(sql, params);
      }
      throw err;
    }
  }
}

// AWS Secrets Manager auto-rotation Lambda
// The secret has "AWSCURRENT" and "AWSPENDING" stages
// 1. createSecret → generate new password
// 2. setSecret → update DB with new password
// 3. testSecret → verify new password works
// 4. finishSecret → promote AWSPENDING to AWSCURRENT
```

- ALWAYS use overlap periods during rotation — both old and new credentials valid simultaneously
- ALWAYS test new credentials before revoking old ones
- ALWAYS automate rotation — manual rotation gets skipped
- NEVER rotate all secrets at the same time — stagger to limit blast radius

---

## 6. Encryption at Rest

```typescript
import { KMSClient, EncryptCommand, DecryptCommand } from "@aws-sdk/client-kms";

class EnvelopeEncryption {
  private kms: KMSClient;
  private keyId: string;

  constructor(keyId: string, region: string) {
    this.kms = new KMSClient({ region });
    this.keyId = keyId;
  }

  // Envelope encryption: KMS encrypts a data key, data key encrypts the data
  async encrypt(plaintext: string): Promise<{ ciphertext: string; encryptedKey: string }> {
    // Generate data encryption key (DEK) via KMS
    const generateCmd = new GenerateDataKeyCommand({
      KeyId: this.keyId,
      KeySpec: "AES_256",
    });
    const { Plaintext: dekPlain, CiphertextBlob: dekEncrypted } = await this.kms.send(generateCmd);

    // Encrypt data with DEK (local, fast)
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-gcm", dekPlain!, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Clear DEK from memory immediately
    dekPlain!.fill(0);

    return {
      ciphertext: Buffer.concat([iv, tag, encrypted]).toString("base64"),
      encryptedKey: Buffer.from(dekEncrypted!).toString("base64"),
    };
  }

  async decrypt(ciphertext: string, encryptedKey: string): Promise<string> {
    // Decrypt DEK via KMS
    const decryptCmd = new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedKey, "base64"),
    });
    const { Plaintext: dekPlain } = await this.kms.send(decryptCmd);

    // Decrypt data with DEK (local, fast)
    const data = Buffer.from(ciphertext, "base64");
    const iv = data.subarray(0, 16);
    const tag = data.subarray(16, 32);
    const encrypted = data.subarray(32);

    const decipher = createDecipheriv("aes-256-gcm", dekPlain!, iv);
    decipher.setAuthTag(tag);
    const result = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");

    dekPlain!.fill(0);
    return result;
  }
}
```

- ALWAYS use envelope encryption — KMS encrypts the data key, data key encrypts the data
- ALWAYS clear decrypted key material from memory after use
- ALWAYS use AES-256-GCM for symmetric encryption (authenticated encryption)
- NEVER export KMS master keys — use KMS API for all key operations

---

## 7. Secret Leak Prevention

```
Prevention Layers:
├── Pre-commit hooks (git-secrets, gitleaks)
├── CI/CD pipeline scanning
├── Runtime log sanitization
├── .gitignore for secret files
└── Code review checklists

# Install git-secrets
git secrets --install
git secrets --register-aws  # Detect AWS keys

# Install gitleaks (pre-commit hook)
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

```typescript
// Log sanitizer — redact secrets from logs
function sanitizeLogData(data: Record<string, any>): Record<string, any> {
  const sensitiveKeys = /password|secret|token|api_key|apikey|authorization|credential/i;
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.test(key)) {
      sanitized[key] = "***REDACTED***";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
```

- ALWAYS install pre-commit hooks to prevent secret commits (gitleaks, git-secrets)
- ALWAYS scan CI/CD pipelines for leaked secrets
- ALWAYS sanitize logs — redact any field matching `password|secret|token|key`
- ALWAYS have an incident response plan for leaked secrets (rotate immediately)

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Secrets in source code | Credentials in git history forever | Use vault, rotate immediately if found |
| Secrets in env vars on CLI | Visible in `ps`, shell history | Use vault injection or secret files |
| Shared secrets across environments | Prod breach from dev leak | Unique secrets per environment |
| No rotation schedule | Same credentials for years | Automate rotation (90 days max) |
| Secrets in Docker image layers | Extractable from image | Multi-stage build, runtime injection |
| Logging secrets | Credentials in log aggregator | Sanitize all log output |
| No audit trail | Cannot detect unauthorized access | Use vault with audit logging |
| Manual rotation | Rotation skipped, forgotten | Automate with Secrets Manager / Vault |
| Plaintext secrets in K8s manifests | Secrets visible in git | SOPS encryption or External Secrets |
| Single KMS key for everything | Key compromise = total breach | Separate KMS keys per purpose |

---

## 9. Enforcement Checklist

- [ ] No secrets in source code (verified by pre-commit hooks)
- [ ] All secrets stored in vault (Secrets Manager, Vault, or encrypted K8s Secrets)
- [ ] Secrets loaded at application startup, cached in memory
- [ ] Secret rotation automated (90 days for critical, 180 for moderate)
- [ ] Zero-downtime rotation with overlap period implemented
- [ ] Envelope encryption used for data at rest
- [ ] KMS master keys never exported — API-only access
- [ ] Log sanitization removes all sensitive fields
- [ ] Pre-commit hooks installed (gitleaks / git-secrets)
- [ ] CI/CD pipeline scans for leaked secrets
- [ ] Separate secrets per environment (dev/staging/prod)
- [ ] Audit trail enabled on vault for all secret access
- [ ] Incident response plan documented for secret leaks
- [ ] `.gitignore` includes all secret file patterns (*.pem, *.key, .env.local)
