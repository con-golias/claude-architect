# Config Management

> **Domain:** Project Structure
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03-08

## Ti einai (What it is)

Config management is the practice of externalizing application behavior from code into configuration -- environment variables, config files, feature flags, and secrets vaults. It determines how an application adapts to different environments (development, staging, production) without code changes. Proper config management is a security concern, an operational concern, and an architectural concern simultaneously.

## Giati einai simantiko (Why it matters)

- **Security**: Hardcoded secrets in source code are the #1 cause of credential leaks (GitHub scans detect millions per year)
- **Deployment flexibility**: Same artifact deploys to dev, staging, and production with different configs
- **Compliance**: SOC 2, HIPAA, PCI-DSS all require secrets to be managed outside application code
- **Operational agility**: Change feature flags, connection strings, and rate limits without redeploying
- **12-Factor App compliance**: Config is Factor III -- the foundation of cloud-native applications
- **Team safety**: Developers cannot accidentally commit production database credentials

---

## 1. The 12-Factor App: Config (Factor III)

The 12-Factor App methodology (originally by Heroku, now an industry standard) states:

> **"Store config in the environment."**

Config is everything that varies between deploys (staging, production, developer environments). This includes:
- Database URLs and credentials
- API keys for external services (Stripe, AWS, SendGrid)
- Feature flag values
- Per-deploy values like canonical hostname

Config does NOT include:
- Internal application wiring (routes, DI container config, middleware pipeline)
- Constants that don't change between deploys

### The Litmus Test

> "Could this codebase be made open source at any moment without compromising any credentials?"
> If yes, your config management is correct.

### 12-Factor Config Rules

1. **Never store config as constants in code**
2. **Never use config files that get committed** (like `config/production.json` with real values)
3. **Use environment variables** for all config that varies between deploys
4. **Config files (committed) should only contain defaults and structure** -- never real credentials
5. **Group related config into named groups** (database URL, not separate host/port/user/pass/dbname)

---

## 2. Environment Variable (.env) Management

### The .env File Hierarchy

```
project-root/
  .env                    # Default values (shared, committed OR not -- see below)
  .env.local              # Local overrides (NEVER committed, in .gitignore)
  .env.development        # Development-specific defaults
  .env.staging            # Staging-specific defaults
  .env.production         # Production-specific defaults (NO real secrets!)
  .env.test               # Test environment defaults
  .env.example            # Template with placeholder values (ALWAYS committed)
```

### Loading Order (by framework)

**Vite:**
```
.env                  # loaded in all cases
.env.local            # loaded in all cases, ignored by git
.env.[mode]           # loaded in specified mode (development, production, test)
.env.[mode].local     # loaded in specified mode, ignored by git
```
Priority: `.env.[mode].local` > `.env.[mode]` > `.env.local` > `.env`

**Next.js:**
```
.env                  # loaded in all environments
.env.local            # loaded in all environments (NOT in CI when test)
.env.[environment]    # environment-specific
.env.[environment].local  # environment-specific local overrides
```

**Create React App (legacy):**
```
.env.development.local > .env.development > .env.local > .env
.env.production.local > .env.production > .env.local > .env
.env.test.local > .env.test > .env
```

**Python (python-dotenv):**
```python
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()  # loads from .env by default
# or
load_dotenv('.env.local')  # specific file
# or with override
load_dotenv('.env.local', override=True)

DATABASE_URL = os.getenv('DATABASE_URL')
```

**Go (godotenv):**
```go
import "github.com/joho/godotenv"

func init() {
    // Load .env file if it exists
    godotenv.Load()  // does NOT override existing env vars
    // or
    godotenv.Overload(".env.local")  // overrides existing
}
```

### .env.example -- The Committed Template

**This file MUST always be committed.** It serves as documentation for required environment variables.

```bash
# .env.example -- committed to version control
# Copy this file to .env.local and fill in the values

# =============================================================================
# Application
# =============================================================================
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# =============================================================================
# Database
# =============================================================================
DATABASE_URL=postgresql://user:password@localhost:5432/myapp_dev
DATABASE_POOL_SIZE=10

# =============================================================================
# Authentication
# =============================================================================
JWT_SECRET=your-secret-key-here-minimum-32-characters
JWT_EXPIRY=3600
SESSION_SECRET=your-session-secret-here

# =============================================================================
# External Services
# =============================================================================
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
SENDGRID_API_KEY=SG.your_key_here
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET=myapp-uploads-dev

# =============================================================================
# Feature Flags
# =============================================================================
FEATURE_NEW_CHECKOUT=false
FEATURE_BETA_DASHBOARD=false

# =============================================================================
# Redis
# =============================================================================
REDIS_URL=redis://localhost:6379
```

### .gitignore Rules (CRITICAL)

```gitignore
# Environment variables
.env
.env.local
.env.*.local
.env.development
.env.staging
.env.production

# KEEP these committed:
# .env.example
# .env.test (if it contains no secrets, only test defaults)
```

**Decision: Should `.env` be committed?**

| Approach | When | Example |
|----------|------|---------|
| **Commit `.env` with defaults** | Open source projects, when `.env` contains only non-secret defaults | `PORT=3000`, `LOG_LEVEL=info` |
| **Do NOT commit `.env`** | Enterprise/private projects, when any value could be sensitive | Most production applications |
| **Always commit `.env.example`** | Always | Template with placeholder values |
| **Always commit `.env.test`** | When test config has no secrets | `DATABASE_URL=sqlite:///:memory:` |

### Client-Side vs Server-Side Environment Variables

**CRITICAL SECURITY CONCERN**: Some frameworks expose env vars to the browser.

| Framework | Server-only | Client-exposed | Mechanism |
|-----------|------------|----------------|-----------|
| **Next.js** | All env vars | Only `NEXT_PUBLIC_*` | Build-time replacement |
| **Vite** | All env vars | Only `VITE_*` | Build-time replacement via `import.meta.env` |
| **Create React App** | All env vars | Only `REACT_APP_*` | Build-time replacement |
| **Nuxt** | `runtimeConfig` | `runtimeConfig.public` | Runtime config system |
| **Angular** | N/A (use `environment.ts`) | `environment.ts` | File replacement at build |

```typescript
// Vite -- SAFE (server only, not in bundle)
const dbPassword = process.env.DB_PASSWORD;

// Vite -- EXPOSED TO CLIENT (in browser JS bundle!)
const apiUrl = import.meta.env.VITE_API_URL;

// NEVER DO THIS:
const secret = import.meta.env.VITE_SECRET_KEY;  // this is in the browser bundle!
```

```typescript
// Next.js -- SAFE (server only)
// In API routes or getServerSideProps:
const dbUrl = process.env.DATABASE_URL;

// Next.js -- EXPOSED TO CLIENT
const analyticsId = process.env.NEXT_PUBLIC_ANALYTICS_ID;  // in browser bundle

// NEVER prefix secrets with NEXT_PUBLIC_!
```

---

## 3. Config File Organization

### Where Config Files Live: Root vs Config Directory

#### Pattern A: Root-level configs (most common for tooling)

```
project-root/
  .editorconfig
  .eslintrc.js              # or eslint.config.js (flat config)
  .prettierrc
  .prettierignore
  babel.config.js
  jest.config.ts
  tsconfig.json
  tsconfig.build.json
  vite.config.ts
  vitest.config.ts
  tailwind.config.ts
  postcss.config.js
  next.config.js
  package.json
  docker-compose.yml
  Dockerfile
  Makefile
```

#### Pattern B: Config directory for application config

```
project-root/
  config/
    database.ts             # Database connection config
    auth.ts                 # Auth/JWT config
    cache.ts                # Redis/cache config
    mail.ts                 # Email service config
    storage.ts              # File storage config
    queue.ts                # Message queue config
    index.ts                # Aggregates and validates all config
  # Tool configs stay at root (framework requirement)
  tsconfig.json
  vite.config.ts
  package.json
```

#### Pattern C: Environment-based config files

```
config/
  default.ts                # Base config (all environments)
  development.ts            # Dev overrides
  staging.ts                # Staging overrides
  production.ts             # Production overrides (NO secrets!)
  test.ts                   # Test overrides
  custom-environment-variables.ts  # Maps env vars to config keys
```

### Typed Config with Validation (Recommended Approach)

#### TypeScript with Zod

```typescript
// config/schema.ts
import { z } from 'zod';

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_SSL: z.coerce.boolean().default(false),

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRY_SECONDS: z.coerce.number().int().positive().default(3600),

  // External Services
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  SENDGRID_API_KEY: z.string().startsWith('SG.'),

  // Redis
  REDIS_URL: z.string().url().startsWith('redis://').default('redis://localhost:6379'),

  // Feature Flags
  FEATURE_NEW_CHECKOUT: z.coerce.boolean().default(false),
  FEATURE_BETA_DASHBOARD: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

// config/index.ts
import { envSchema } from './schema';

function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.format());
    process.exit(1);  // FAIL FAST -- do not start with bad config
  }

  return result.data;
}

// Singleton -- parsed once at startup
export const config = loadConfig();

// Usage in application:
import { config } from '@/config';

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.DATABASE_POOL_SIZE,
  ssl: config.DATABASE_SSL,
});
```

#### Python with Pydantic Settings

```python
# config/settings.py
from pydantic_settings import BaseSettings
from pydantic import Field, PostgresDsn, RedisDsn
from typing import Literal
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    environment: Literal["development", "staging", "production", "test"] = "development"
    port: int = Field(default=8000, ge=1, le=65535)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    debug: bool = False

    # Database
    database_url: PostgresDsn
    database_pool_size: int = Field(default=10, ge=1, le=100)

    # Auth
    jwt_secret: str = Field(min_length=32)
    jwt_expiry_seconds: int = Field(default=3600, ge=60)

    # External Services
    stripe_secret_key: str = Field(pattern=r'^sk_')
    sendgrid_api_key: str = Field(pattern=r'^SG\.')

    # Redis
    redis_url: RedisDsn = "redis://localhost:6379"

    # Feature Flags
    feature_new_checkout: bool = False
    feature_beta_dashboard: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False  # DATABASE_URL -> database_url


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()


# Usage:
from config.settings import get_settings

settings = get_settings()
print(settings.database_url)
```

#### Go with envconfig and validation

```go
// config/config.go
package config

import (
    "fmt"
    "log"

    "github.com/kelseyhightower/envconfig"
)

type Config struct {
    // Application
    Environment string `envconfig:"ENVIRONMENT" default:"development"`
    Port        int    `envconfig:"PORT" default:"8080"`
    LogLevel    string `envconfig:"LOG_LEVEL" default:"info"`

    // Database
    DatabaseURL      string `envconfig:"DATABASE_URL" required:"true"`
    DatabasePoolSize int    `envconfig:"DATABASE_POOL_SIZE" default:"10"`

    // Auth
    JWTSecret        string `envconfig:"JWT_SECRET" required:"true"`
    JWTExpirySeconds int    `envconfig:"JWT_EXPIRY_SECONDS" default:"3600"`

    // Redis
    RedisURL string `envconfig:"REDIS_URL" default:"redis://localhost:6379"`

    // Feature Flags
    FeatureNewCheckout   bool `envconfig:"FEATURE_NEW_CHECKOUT" default:"false"`
    FeatureBetaDashboard bool `envconfig:"FEATURE_BETA_DASHBOARD" default:"false"`
}

func (c *Config) Validate() error {
    if len(c.JWTSecret) < 32 {
        return fmt.Errorf("JWT_SECRET must be at least 32 characters, got %d", len(c.JWTSecret))
    }
    if c.Port < 1 || c.Port > 65535 {
        return fmt.Errorf("PORT must be between 1 and 65535, got %d", c.Port)
    }
    validEnvs := map[string]bool{"development": true, "staging": true, "production": true, "test": true}
    if !validEnvs[c.Environment] {
        return fmt.Errorf("ENVIRONMENT must be one of development, staging, production, test; got %s", c.Environment)
    }
    return nil
}

func Load() (*Config, error) {
    var cfg Config
    if err := envconfig.Process("", &cfg); err != nil {
        return nil, fmt.Errorf("failed to load config: %w", err)
    }
    if err := cfg.Validate(); err != nil {
        return nil, fmt.Errorf("config validation failed: %w", err)
    }
    return &cfg, nil
}

// main.go
func main() {
    cfg, err := config.Load()
    if err != nil {
        log.Fatalf("Failed to load configuration: %v", err)
    }
    // ...
}
```

#### C# with Options Pattern and Data Annotations

```csharp
// Config/DatabaseOptions.cs
public class DatabaseOptions
{
    public const string SectionName = "Database";

    [Required]
    [Url]
    public string ConnectionString { get; set; } = string.Empty;

    [Range(1, 100)]
    public int PoolSize { get; set; } = 10;

    public bool UseSsl { get; set; } = false;
}

// Config/AuthOptions.cs
public class AuthOptions
{
    public const string SectionName = "Auth";

    [Required]
    [MinLength(32)]
    public string JwtSecret { get; set; } = string.Empty;

    [Range(60, 86400)]
    public int JwtExpirySeconds { get; set; } = 3600;
}

// Program.cs
builder.Services
    .AddOptions<DatabaseOptions>()
    .Bind(builder.Configuration.GetSection(DatabaseOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();  // Fail fast at startup

builder.Services
    .AddOptions<AuthOptions>()
    .Bind(builder.Configuration.GetSection(AuthOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

// Usage via DI:
public class UserService
{
    private readonly DatabaseOptions _dbOptions;

    public UserService(IOptions<DatabaseOptions> dbOptions)
    {
        _dbOptions = dbOptions.Value;
    }
}

// appsettings.json (committed -- contains defaults, NOT secrets)
{
  "Database": {
    "PoolSize": 10,
    "UseSsl": false
  },
  "Auth": {
    "JwtExpirySeconds": 3600
  }
}

// Secrets via environment variables or User Secrets:
// Database__ConnectionString=postgresql://...
// Auth__JwtSecret=my-super-secret-key
// (double underscore __ maps to section nesting in .NET)
```

---

## 4. Secrets Management

### What NEVER Goes in Code

| Category | Examples | Where It Should Live |
|----------|---------|---------------------|
| **Database credentials** | Connection strings, passwords | Vault / env vars |
| **API keys** | Stripe, AWS, SendGrid, Twilio | Vault / env vars |
| **Encryption keys** | JWT secrets, AES keys | Vault / KMS |
| **OAuth secrets** | Client secrets, tokens | Vault / env vars |
| **TLS certificates** | Private keys, cert files | Cert manager / vault |
| **SSH keys** | Private keys | SSH agent / vault |
| **Webhook secrets** | Signing keys | Vault / env vars |
| **Internal service tokens** | Service-to-service auth | Vault / service mesh |
| **PII encryption keys** | Keys for encrypting user data | KMS / HSM |

### Secrets Management Tiers

#### Tier 1: Environment Variables (Minimum viable)

```bash
# Set via CI/CD platform (GitHub Actions, GitLab CI, etc.)
# Never stored in files that are committed

# GitHub Actions
# Settings > Secrets and variables > Actions
DATABASE_URL: ${{ secrets.DATABASE_URL }}

# Docker Compose (using .env file NOT committed)
services:
  app:
    environment:
      - DATABASE_URL=${DATABASE_URL}
```

#### Tier 2: Platform Secrets (Good for most teams)

```yaml
# GitHub Actions -- using repository/environment secrets
name: Deploy
on: push
jobs:
  deploy:
    environment: production  # ties to GitHub Environment with secrets
    steps:
      - name: Deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          STRIPE_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
        run: npm run deploy
```

```yaml
# Kubernetes Secrets
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
data:
  database-url: cG9zdGdyZXNxbDovLy4uLg==  # base64 encoded (NOT encryption!)
  jwt-secret: c3VwZXItc2VjcmV0LWtleQ==

# Reference in deployment:
spec:
  containers:
    - name: app
      envFrom:
        - secretRef:
            name: app-secrets
```

#### Tier 3: Dedicated Secrets Vault (Enterprise)

**HashiCorp Vault:**
```bash
# Store a secret
vault kv put secret/myapp/production \
  database_url="postgresql://prod:password@db.internal:5432/myapp" \
  stripe_key="sk_live_xxxxx" \
  jwt_secret="super-secure-jwt-secret-key-here"

# Read a secret
vault kv get -field=database_url secret/myapp/production
```

```typescript
// Node.js with Vault client
import Vault from 'node-vault';

const vault = Vault({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN,
});

async function loadSecrets(): Promise<AppSecrets> {
  const result = await vault.read('secret/data/myapp/production');
  return {
    databaseUrl: result.data.data.database_url,
    stripeKey: result.data.data.stripe_key,
    jwtSecret: result.data.data.jwt_secret,
  };
}
```

**AWS Secrets Manager:**
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

async function getSecret(secretName: string): Promise<Record<string, string>> {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return JSON.parse(response.SecretString!);
}

// Usage:
const secrets = await getSecret('myapp/production');
const dbUrl = secrets.database_url;
```

**Azure Key Vault:**
```csharp
// C# with Azure Key Vault
builder.Configuration.AddAzureKeyVault(
    new Uri($"https://{vaultName}.vault.azure.net/"),
    new DefaultAzureCredential()
);

// Secrets are automatically mapped to configuration keys:
var dbConnection = builder.Configuration["DatabaseConnectionString"];
```

**GCP Secret Manager:**
```python
# Python with GCP Secret Manager
from google.cloud import secretmanager

def get_secret(project_id: str, secret_id: str, version: str = "latest") -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{project_id}/secrets/{secret_id}/versions/{version}"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")

database_url = get_secret("my-project", "database-url")
```

### Secrets Management Decision Table

| Team Size | Infrastructure | Recommendation | Tools |
|-----------|---------------|----------------|-------|
| 1-5 devs | Simple deploy | Tier 1: `.env.local` + CI secrets | dotenv, GitHub Secrets |
| 5-20 devs | Cloud-native | Tier 2: Platform secrets | K8s Secrets, AWS Parameter Store |
| 20-100 devs | Multi-service | Tier 3: Dedicated vault | HashiCorp Vault, AWS Secrets Manager |
| 100+ devs | Enterprise | Tier 3 + rotation + audit | Vault + HSM, Azure Key Vault, GCP Secret Manager |

### Secret Rotation

```typescript
// Config that supports secret rotation (watch for changes)
import { watch } from 'fs';

class SecretManager {
  private secrets: Map<string, string> = new Map();
  private refreshInterval: NodeJS.Timeout;

  constructor(private readonly refreshMs: number = 300_000) { // 5 minutes
    this.refresh();
    this.refreshInterval = setInterval(() => this.refresh(), this.refreshMs);
  }

  private async refresh(): Promise<void> {
    // Re-fetch from vault/secrets manager
    const freshSecrets = await fetchFromVault();
    this.secrets = new Map(Object.entries(freshSecrets));
  }

  get(key: string): string {
    const value = this.secrets.get(key);
    if (!value) throw new Error(`Secret ${key} not found`);
    return value;
  }

  destroy(): void {
    clearInterval(this.refreshInterval);
  }
}
```

### OWASP Secrets Management Checklist

1. **Never hardcode secrets** in source code, config files, or CI scripts
2. **Never log secrets** -- mask them in log output
3. **Never expose secrets in error messages** or stack traces
4. **Rotate secrets regularly** -- automate rotation
5. **Use least privilege** -- each service gets only the secrets it needs
6. **Audit access** -- log who accessed which secrets when
7. **Encrypt at rest** -- secrets in vaults must be encrypted
8. **Encrypt in transit** -- TLS for all secret retrieval
9. **Scan for leaks** -- use tools like `git-secrets`, `truffleHog`, `gitleaks`
10. **Revoke immediately** -- if a secret leaks, rotate it within minutes

```bash
# Install and use gitleaks to scan for secrets
gitleaks detect --source . --verbose

# Pre-commit hook to prevent secret commits
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

---

## 5. Feature Flags

### Why Feature Flags

Feature flags decouple deployment from release. You deploy code with the flag off, then turn it on when ready -- or for specific users, regions, or percentages.

### Implementation Patterns

#### Simple Config-Based Flags (Small teams)

```typescript
// config/feature-flags.ts
import { z } from 'zod';

const featureFlagSchema = z.object({
  NEW_CHECKOUT: z.boolean().default(false),
  BETA_DASHBOARD: z.boolean().default(false),
  AI_RECOMMENDATIONS: z.boolean().default(false),
  DARK_MODE: z.boolean().default(true),
  MAX_UPLOAD_SIZE_MB: z.number().default(10),  // operational flag
});

export type FeatureFlags = z.infer<typeof featureFlagSchema>;

export const features: FeatureFlags = featureFlagSchema.parse({
  NEW_CHECKOUT: process.env.FEATURE_NEW_CHECKOUT === 'true',
  BETA_DASHBOARD: process.env.FEATURE_BETA_DASHBOARD === 'true',
  AI_RECOMMENDATIONS: process.env.FEATURE_AI_RECOMMENDATIONS === 'true',
  DARK_MODE: process.env.FEATURE_DARK_MODE !== 'false',
  MAX_UPLOAD_SIZE_MB: Number(process.env.FEATURE_MAX_UPLOAD_SIZE_MB) || 10,
});

// Usage:
if (features.NEW_CHECKOUT) {
  return <NewCheckoutFlow />;
} else {
  return <LegacyCheckoutFlow />;
}
```

#### LaunchDarkly (Enterprise feature flag service)

```typescript
// config/launch-darkly.ts
import * as LaunchDarkly from 'launchdarkly-node-server-sdk';

const client = LaunchDarkly.init(process.env.LAUNCHDARKLY_SDK_KEY!);

await client.waitForInitialization();

// Evaluate a flag for a specific user
const user: LaunchDarkly.LDContext = {
  kind: 'user',
  key: userId,
  email: userEmail,
  custom: {
    plan: 'enterprise',
    region: 'eu',
  },
};

const showNewCheckout = await client.variation('new-checkout', user, false);
// LaunchDarkly supports:
// - Percentage rollouts (10% of users see new feature)
// - User targeting (specific users or segments)
// - Rule-based targeting (enterprise plan users only)
// - Kill switches (instantly disable a feature)
```

#### Unleash (Open-source feature flag service)

```typescript
import { initialize, isEnabled } from 'unleash-client';

const unleash = initialize({
  url: process.env.UNLEASH_API_URL!,
  appName: 'my-app',
  customHeaders: {
    Authorization: process.env.UNLEASH_API_KEY!,
  },
});

// Simple boolean check
if (unleash.isEnabled('new-checkout')) {
  // new feature
}

// With context (user targeting)
const context = {
  userId: user.id,
  properties: {
    plan: user.plan,
    region: user.region,
  },
};

if (unleash.isEnabled('beta-dashboard', context)) {
  // show beta dashboard
}
```

### Feature Flag Decision Table

| Need | Solution | Cost | Complexity |
|------|----------|------|------------|
| Simple on/off per environment | Environment variables | Free | Low |
| Percentage rollouts | LaunchDarkly, Unleash, Flagsmith | $-$$$ | Medium |
| User targeting (beta users) | LaunchDarkly, Unleash, Flagsmith | $-$$$ | Medium |
| A/B testing | LaunchDarkly, Optimizely, Statsig | $$-$$$ | High |
| Open-source self-hosted | Unleash, Flagsmith, Flipt | Free (hosting cost) | Medium |
| Feature flags as code | Config files + CI/CD | Free | Low |

### Feature Flag Best Practices

1. **Clean up old flags** -- stale flags are technical debt. Set expiry dates.
2. **Use descriptive flag names** -- `enable-new-checkout-v2` not `flag_123`
3. **Default to OFF** for new features (safe deployment)
4. **Log flag evaluations** for debugging
5. **Test both paths** -- test with flag on AND off
6. **Don't nest flags** -- `if (flagA && flagB && !flagC)` is unmaintainable

---

## 6. Build Configuration File Placement

### Decision Table: Where Config Files Live

| Config File | Must Be at Root? | Can Be in Config Dir? | Notes |
|-------------|------------------|-----------------------|-------|
| `package.json` | YES | No | npm requirement |
| `tsconfig.json` | YES (convention) | Yes (with path) | Can use `--project` flag |
| `tsconfig.build.json` | YES | Yes | Extends base tsconfig |
| `vite.config.ts` | YES (default) | Yes (with `--config`) | Default lookup is root |
| `next.config.js` | YES | No | Next.js requirement |
| `webpack.config.js` | YES (default) | Yes (with `--config`) | Default lookup is root |
| `.eslintrc.*` / `eslint.config.*` | YES | No | ESLint looks up from files |
| `.prettierrc` | YES | No | Prettier looks up from files |
| `babel.config.js` | YES | No | Babel project-wide config |
| `jest.config.ts` | YES (default) | Yes (with `--config`) | |
| `vitest.config.ts` | YES (default) | Yes (with `--config`) | |
| `tailwind.config.ts` | YES (default) | Yes (with `--config`) | |
| `postcss.config.js` | YES | No | PostCSS looks up from root |
| `docker-compose.yml` | YES (default) | Yes (with `-f`) | |
| `Dockerfile` | YES (default) | Yes (with `-f`) | |
| `.editorconfig` | YES | No | Editor looks up from file |
| `Makefile` | YES | No | `make` expects it at root |
| `.github/` | YES | No | GitHub requirement |
| `.husky/` | YES | No | Husky requirement |

### Reducing Root Clutter

Many teams feel root-level config clutter is a problem. Here are strategies:

#### Strategy 1: Use `package.json` for small configs

```json
{
  "name": "my-app",
  "prettier": {
    "semi": true,
    "singleQuote": true,
    "trailingComma": "es5"
  },
  "eslintConfig": {
    "extends": ["next/core-web-vitals"]
  },
  "browserslist": {
    "production": [">0.2%", "not dead"],
    "development": ["last 1 chrome version"]
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

#### Strategy 2: ESLint Flat Config (consolidate)

```typescript
// eslint.config.ts (new flat config format -- replaces .eslintrc.*)
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': typescript },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
    },
  },
  prettier,  // must be last
];
```

#### Strategy 3: TypeScript Project References (monorepo)

```json
// tsconfig.json (root -- references only)
{
  "files": [],
  "references": [
    { "path": "./packages/api" },
    { "path": "./packages/web" },
    { "path": "./packages/shared" }
  ]
}

// packages/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../shared" }
  ]
}
```

---

## 7. Config Validation -- Fail Fast

### The Principle

> **"If the config is wrong, the application should not start."**

Never let an application start with missing or invalid configuration and then crash at runtime when the bad config is first used. Validate ALL config at startup.

### Implementation by Ecosystem

#### TypeScript (Zod -- recommended)

```typescript
// config/index.ts
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535),
  databaseUrl: z.string().url(),
  jwtSecret: z.string().min(32),
  nodeEnv: z.enum(['development', 'staging', 'production', 'test']),
  corsOrigins: z.string().transform(s => s.split(',')).pipe(z.array(z.string().url())),
  rateLimitRpm: z.coerce.number().int().positive().default(100),
});

type Config = z.infer<typeof configSchema>;

function loadAndValidateConfig(): Config {
  const raw = {
    port: process.env.PORT,
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    nodeEnv: process.env.NODE_ENV,
    corsOrigins: process.env.CORS_ORIGINS,
    rateLimitRpm: process.env.RATE_LIMIT_RPM,
  };

  const result = configSchema.safeParse(raw);

  if (!result.success) {
    const formatted = result.error.issues
      .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error(`\nConfiguration validation failed:\n${formatted}\n`);
    console.error('Check your .env file or environment variables.');
    process.exit(1);
  }

  // Freeze to prevent runtime modification
  return Object.freeze(result.data);
}

export const config = loadAndValidateConfig();
```

#### Alternative: Joi (older but battle-tested)

```typescript
import Joi from 'joi';

const schema = Joi.object({
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: 'postgresql' }).required(),
  JWT_SECRET: Joi.string().min(32).required(),
  NODE_ENV: Joi.string().valid('development', 'staging', 'production', 'test').default('development'),
}).unknown(true);  // allow other env vars

const { error, value } = schema.validate(process.env, {
  abortEarly: false,  // report ALL errors, not just the first
});

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}
```

#### Python (Pydantic -- fail fast by default)

```python
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
import sys


class AppSettings(BaseSettings):
    port: int = Field(default=8000, ge=1, le=65535)
    database_url: str
    jwt_secret: str = Field(min_length=32)
    environment: str = Field(default="development", pattern=r'^(development|staging|production|test)$')
    cors_origins: list[str] = Field(default_factory=list)

    @field_validator('cors_origins', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v

    class Config:
        env_file = ".env"


# This will raise ValidationError and stop the app if config is invalid
try:
    settings = AppSettings()
except Exception as e:
    print(f"Configuration error: {e}")
    sys.exit(1)
```

#### Go (fail fast pattern)

```go
func Load() (*Config, error) {
    var cfg Config
    if err := envconfig.Process("", &cfg); err != nil {
        return nil, fmt.Errorf("loading config: %w", err)
    }
    if err := cfg.Validate(); err != nil {
        return nil, fmt.Errorf("validating config: %w", err)
    }
    return &cfg, nil
}

// main.go
func main() {
    cfg, err := config.Load()
    if err != nil {
        log.Fatalf("FATAL: %v", err)  // exit immediately
    }
    server := NewServer(cfg)
    server.Run()
}
```

---

## 8. Docker and Container Config

### Docker .env Best Practices

```yaml
# docker-compose.yml
services:
  app:
    build: .
    env_file:
      - .env                    # base defaults
      - .env.local              # local overrides (in .gitignore)
    environment:
      - NODE_ENV=production     # explicit override
    ports:
      - "${PORT:-3000}:3000"    # default to 3000 if PORT not set

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: ${DB_NAME:-myapp}
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD}  # REQUIRED -- no default
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

### Multi-Stage Docker Config

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser
USER appuser

# Only copy built assets -- no .env files, no source code
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

# Config comes from environment, not files
# ENV vars set by orchestrator (K8s, ECS, docker-compose)
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### Terraform Variables and Secrets

```hcl
# variables.tf -- variable declarations (committed)
variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true  # prevents showing in plan output
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

# terraform.tfvars (NOT committed -- in .gitignore)
db_password = "actual-password-here"
environment = "prod"

# Or use environment variables:
# TF_VAR_db_password="actual-password-here"
# TF_VAR_environment="prod"

# Or use a secrets backend:
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "myapp/prod/db-password"
}

resource "aws_db_instance" "main" {
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
}
```

---

## Best Practices Summary

### Config Management Golden Rules

1. **Validate at startup** -- fail fast, fail loud, fail with clear error messages
2. **Type your config** -- use Zod, Pydantic, typed structs -- never raw `process.env.THING`
3. **Never commit secrets** -- use `.env.example` for documentation, `.env.local` for values
4. **Use the 12-Factor approach** -- environment variables for all deploy-varying config
5. **Separate config from code** -- config is not constants; constants are not config
6. **Support all environments** -- dev, test, staging, production must all work
7. **Document every variable** -- `.env.example` with comments for every variable
8. **Scan for leaks** -- use `gitleaks`, `truffleHog`, or GitHub secret scanning
9. **Rotate secrets regularly** -- automate rotation, never share secrets via Slack/email
10. **Freeze config after load** -- prevent runtime mutation of config objects

### Config File Checklist for New Projects

```
project-root/
  .env.example              # COMMITTED -- template with all variables documented
  .env.local                # GITIGNORED -- developer's local values
  .env.test                 # COMMITTED -- test defaults (no secrets)
  .gitignore                # Includes .env, .env.local, .env.*.local
  config/
    index.ts                # Main config loader with validation
    schema.ts               # Zod/Joi schema definition
    database.ts             # Database-specific config
    auth.ts                 # Auth-specific config
    feature-flags.ts        # Feature flag definitions
```

---

## Anti-patterns / Common Mistakes

### Anti-pattern 1: Hardcoded Secrets

```typescript
// BAD -- secret in source code (will be in git history forever)
const stripe = new Stripe('sk_live_abc123realkey');

// GOOD -- from environment
const stripe = new Stripe(config.stripeSecretKey);
```

### Anti-pattern 2: No Validation (Crash at Runtime)

```typescript
// BAD -- crashes when someone tries to use the database 10 minutes after startup
const dbUrl = process.env.DATABASE_URL;  // could be undefined!
// ... 500 lines later ...
const pool = new Pool({ connectionString: dbUrl });  // TypeError at runtime

// GOOD -- crashes at startup with clear message
const config = configSchema.parse(process.env);  // ZodError: DATABASE_URL is required
```

### Anti-pattern 3: Boolean String Bugs

```typescript
// BAD -- classic boolean bug
const isDebug = process.env.DEBUG;  // This is the STRING "false", which is truthy!
if (isDebug) { /* THIS RUNS even when DEBUG=false */ }

// GOOD -- explicit parsing
const isDebug = process.env.DEBUG === 'true';
// or with Zod:
const schema = z.object({
  DEBUG: z.coerce.boolean().default(false),  // handles "true"/"false"/1/0
});
```

### Anti-pattern 4: Config Sprawl (Config Everywhere)

```typescript
// BAD -- config access scattered throughout codebase
// In file1.ts:
const timeout = parseInt(process.env.REQUEST_TIMEOUT || '5000');
// In file2.ts:
const timeout = Number(process.env.REQUEST_TIMEOUT) || 3000;  // different default!
// In file3.ts:
const timeout = process.env.REQUEST_TIMEOUT;  // string, not number!

// GOOD -- single source of truth
// config/index.ts
export const config = configSchema.parse(process.env);
// Everywhere else:
import { config } from '@/config';
const timeout = config.requestTimeout;  // always a number, always consistent
```

### Anti-pattern 5: Committing .env with Real Values

```bash
# BAD -- real production values in git history
# .env (committed)
DATABASE_URL=postgresql://admin:RealPr0dP@ssw0rd@prod-db.internal:5432/myapp
STRIPE_SECRET_KEY=sk_live_realkey123

# GOOD -- only structure and placeholders committed
# .env.example (committed)
DATABASE_URL=postgresql://user:password@localhost:5432/myapp_dev
STRIPE_SECRET_KEY=sk_test_your_key_here

# .env.local (gitignored) -- developer fills this in
DATABASE_URL=postgresql://dev:devpass@localhost:5432/myapp_dev
STRIPE_SECRET_KEY=sk_test_mydevkey123
```

### Anti-pattern 6: Different Config Shapes per Environment

```typescript
// BAD -- different config structure per environment
if (process.env.NODE_ENV === 'production') {
  config.db = { connectionString: process.env.DATABASE_URL };
} else {
  config.db = {
    host: 'localhost',
    port: 5432,
    user: 'dev',
    password: 'dev',
    database: 'myapp_dev',
  };
}
// This means production and development code paths are different!

// GOOD -- same shape everywhere, only values change
const config = {
  db: {
    connectionString: process.env.DATABASE_URL, // same in all environments
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
  },
};
```

### Anti-pattern 7: Feature Flags Without Cleanup

```typescript
// BAD -- flag added 2 years ago, never cleaned up
if (features.NEW_CHECKOUT_2023) {     // is this still needed?
  if (features.CHECKOUT_V2_HOTFIX) {  // nested flags!
    if (!features.DISABLE_CHECKOUT_ANALYTICS) {  // triple nesting!
      // actual code buried under 3 flags
    }
  }
}

// GOOD -- flags have expiry dates and are regularly cleaned
// config/feature-flags.ts
export const FEATURE_FLAGS = {
  NEW_CHECKOUT: {
    enabled: process.env.FEATURE_NEW_CHECKOUT === 'true',
    description: 'New checkout flow with multi-step wizard',
    owner: 'payments-team',
    addedDate: '2025-01-15',
    expiryDate: '2025-04-15',  // must be removed by this date
    jiraTicket: 'PAY-1234',
  },
};
```

---

## Real-world Examples

### Full Config Setup: NestJS Enterprise Application

```
project-root/
  .env.example                 # Committed template
  .env.local                   # Gitignored -- real local values
  .env.test                    # Committed -- test config (no secrets)
  src/
    config/
      config.module.ts         # NestJS config module
      config.schema.ts         # Joi/Zod validation
      database.config.ts       # DB config factory
      auth.config.ts           # Auth config factory
      redis.config.ts          # Redis config factory
      feature-flags.config.ts  # Feature flags
    app.module.ts              # Imports ConfigModule.forRoot()
```

### Full Config Setup: FastAPI Application

```
project-root/
  .env.example
  .env
  app/
    config/
      __init__.py
      settings.py              # Pydantic BaseSettings
      database.py              # DB config
      logging_config.py        # Logging configuration
    main.py                    # settings = get_settings()
  tests/
    conftest.py                # Override settings for tests
```

---

## Sources

- **12-Factor App -- Config**: https://12factor.net/config -- The foundational methodology for config management
- **OWASP Secrets Management Cheat Sheet**: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- **Vite Environment Variables**: https://vitejs.dev/guide/env-and-mode
- **Next.js Environment Variables**: https://nextjs.org/docs/app/building-your-application/configuring/environment-variables
- **HashiCorp Vault Documentation**: https://developer.hashicorp.com/vault/docs
- **AWS Secrets Manager**: https://docs.aws.amazon.com/secretsmanager/
- **Pydantic Settings**: https://docs.pydantic.dev/latest/concepts/pydantic_settings/
- **Zod**: https://zod.dev/ -- TypeScript-first schema validation
- **LaunchDarkly Docs**: https://docs.launchdarkly.com/ -- Feature flag management
- **Unleash (open-source)**: https://docs.getunleash.io/ -- Open-source feature flags
- **Docker Compose Environment Variables**: https://docs.docker.com/compose/environment-variables/
- **Terraform Variables**: https://developer.hashicorp.com/terraform/language/values/variables
- **gitleaks**: https://github.com/gitleaks/gitleaks -- Secret scanning tool
- **NestJS Configuration**: https://docs.nestjs.com/techniques/configuration
- **.NET Options Pattern**: https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/options
- **Go envconfig**: https://github.com/kelseyhightower/envconfig
