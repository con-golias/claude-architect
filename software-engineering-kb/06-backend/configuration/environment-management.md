# Environment Management

> **AI Plugin Directive — Environment Configuration & Management**
> You are an AI coding assistant. When generating, reviewing, or refactoring environment
> configuration code, follow EVERY rule in this document. Misconfigured environments cause
> production outages, data leaks, and silent failures. Treat each section as non-negotiable.

**Core Rule: ALWAYS load configuration from environment variables — NEVER hardcode values. ALWAYS validate ALL configuration on application startup — fail fast on missing or invalid config. ALWAYS maintain strict environment parity between staging and production.**

---

## 1. Configuration Hierarchy

```
┌──────────────────────────────────────────────────────────────┐
│              Configuration Source Priority                     │
│              (highest precedence wins)                         │
│                                                               │
│  1. CLI arguments / flags           ← highest precedence     │
│  2. Environment variables           ← primary config source  │
│  3. .env.local (gitignored)         ← developer overrides    │
│  4. .env.{environment}              ← per-env defaults       │
│  5. .env                            ← shared defaults        │
│  6. Application defaults (code)     ← lowest precedence      │
│                                                               │
│  12-Factor App Rule (Factor III):                            │
│  "Store config in the environment"                           │
│  ├── Config varies between deploys (dev/staging/prod)        │
│  ├── Code does NOT vary between deploys                      │
│  └── If it differs per environment → it's config, NOT code  │
└──────────────────────────────────────────────────────────────┘
```

| Source | Checked Into Git | Use Case |
|--------|-----------------|----------|
| `.env` | YES | Shared defaults, documentation of all vars |
| `.env.development` | YES | Dev-specific defaults |
| `.env.production` | YES | Prod-specific non-secret defaults |
| `.env.local` | NO (.gitignore) | Developer-specific overrides |
| `.env.*.local` | NO (.gitignore) | Per-env local overrides |
| Environment variables | N/A (runtime) | CI/CD, containers, production |

- ALWAYS use environment variables as the primary configuration source
- ALWAYS provide defaults in `.env` for documentation and local development
- NEVER commit `.env.local` or any file containing secrets — add to `.gitignore`
- ALWAYS let environment variables override `.env` files (higher precedence)

---

## 2. Environment Variable Naming

```
Convention: APP_SECTION_KEY

Examples:
  APP_PORT=3000
  APP_HOST=0.0.0.0
  APP_LOG_LEVEL=info

  DB_HOST=localhost
  DB_PORT=5432
  DB_NAME=myapp
  DB_USER=postgres
  DB_PASSWORD=secret
  DB_SSL_MODE=require
  DB_POOL_SIZE=20

  REDIS_URL=redis://localhost:6379
  REDIS_PASSWORD=secret
  REDIS_TLS_ENABLED=true

  AUTH_JWT_SECRET=...
  AUTH_JWT_EXPIRY=3600
  AUTH_OAUTH_CLIENT_ID=...
  AUTH_OAUTH_CLIENT_SECRET=...

  AWS_REGION=us-east-1
  AWS_S3_BUCKET=myapp-uploads

  FEATURE_NEW_CHECKOUT=true
  FEATURE_DARK_MODE=false

Rules:
  ├── UPPER_SNAKE_CASE
  ├── Prefix with app name or section (DB_, REDIS_, AUTH_)
  ├── Boolean: true/false (NOT 1/0, yes/no)
  ├── Lists: comma-separated (CORS_ORIGINS=a.com,b.com)
  ├── Duration: seconds as integer (AUTH_JWT_EXPIRY=3600)
  └── NEVER include environment name in var name
      ❌ PROD_DB_HOST     ✅ DB_HOST (set differently per env)
```

- ALWAYS use UPPER_SNAKE_CASE for environment variable names
- ALWAYS prefix related variables with a common section (DB_, REDIS_, AUTH_)
- NEVER embed environment name in variable names — the environment IS the differentiator
- ALWAYS document every variable in `.env.example` or `.env`

---

## 3. Configuration Loading

### 3.1 TypeScript

```typescript
import { z } from "zod";
import "dotenv/config"; // Load .env files

// Define schema with Zod (see validation-schemas.md)
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Database
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_SSL_MODE: z.enum(["disable", "require", "verify-full"]).default("require"),
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(20),

  // Redis
  REDIS_URL: z.string().url(),
  REDIS_PASSWORD: z.string().optional(),

  // Auth
  AUTH_JWT_SECRET: z.string().min(32),
  AUTH_JWT_EXPIRY: z.coerce.number().int().default(3600),
});

// Validate on startup — fail fast
function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment configuration:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1); // FAIL FAST — do not start with bad config
  }

  return Object.freeze(result.data); // Immutable config object
}

export const config = loadConfig();

// Usage — type-safe, validated
// config.PORT → number (not string)
// config.DB_HOST → string (guaranteed non-empty)
```

### 3.2 Go

```go
import (
    "github.com/caarlos0/env/v10"
    "github.com/joho/godotenv"
)

type Config struct {
    // App
    Env      string `env:"APP_ENV" envDefault:"development"`
    Port     int    `env:"PORT" envDefault:"3000"`
    Host     string `env:"HOST" envDefault:"0.0.0.0"`
    LogLevel string `env:"LOG_LEVEL" envDefault:"info"`

    // Database
    DBHost     string `env:"DB_HOST,required"`
    DBPort     int    `env:"DB_PORT" envDefault:"5432"`
    DBName     string `env:"DB_NAME,required"`
    DBUser     string `env:"DB_USER,required"`
    DBPassword string `env:"DB_PASSWORD,required"`
    DBSSLMode  string `env:"DB_SSL_MODE" envDefault:"require"`
    DBPoolSize int    `env:"DB_POOL_SIZE" envDefault:"20"`

    // Redis
    RedisURL      string `env:"REDIS_URL,required"`
    RedisPassword string `env:"REDIS_PASSWORD"`

    // Auth
    JWTSecret string `env:"AUTH_JWT_SECRET,required"`
    JWTExpiry int    `env:"AUTH_JWT_EXPIRY" envDefault:"3600"`
}

func LoadConfig() (*Config, error) {
    // Load .env file (ignore error — file may not exist in production)
    _ = godotenv.Load()

    cfg := &Config{}
    if err := env.Parse(cfg); err != nil {
        return nil, fmt.Errorf("invalid configuration: %w", err)
    }

    // Custom validation
    if cfg.DBPoolSize < 1 || cfg.DBPoolSize > 100 {
        return nil, fmt.Errorf("DB_POOL_SIZE must be between 1 and 100, got %d", cfg.DBPoolSize)
    }
    if len(cfg.JWTSecret) < 32 {
        return nil, fmt.Errorf("AUTH_JWT_SECRET must be at least 32 characters")
    }

    return cfg, nil
}

// main.go
func main() {
    cfg, err := LoadConfig()
    if err != nil {
        log.Fatalf("Configuration error: %v", err)  // FAIL FAST
    }
    // Use cfg.Port, cfg.DBHost, etc.
}
```

### 3.3 Python

```python
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator

class Config(BaseSettings):
    # App
    app_env: str = Field(default="development", alias="APP_ENV")
    port: int = Field(default=3000, ge=1, le=65535)
    host: str = Field(default="0.0.0.0")
    log_level: str = Field(default="info")

    # Database
    db_host: str = Field(..., min_length=1)  # ... = required
    db_port: int = Field(default=5432)
    db_name: str = Field(..., min_length=1)
    db_user: str = Field(..., min_length=1)
    db_password: str = Field(..., min_length=1)
    db_ssl_mode: str = Field(default="require")
    db_pool_size: int = Field(default=20, ge=1, le=100)

    # Redis
    redis_url: str = Field(...)
    redis_password: str | None = Field(default=None)

    # Auth
    auth_jwt_secret: str = Field(..., min_length=32)
    auth_jwt_expiry: int = Field(default=3600)

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        allowed = {"debug", "info", "warn", "error"}
        if v not in allowed:
            raise ValueError(f"log_level must be one of {allowed}")
        return v

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

# Fail fast on startup
try:
    config = Config()
except ValidationError as e:
    print(f"Configuration error:\n{e}")
    sys.exit(1)
```

- ALWAYS validate config on startup — NEVER defer validation to first use
- ALWAYS use typed config objects — NEVER access `process.env` directly throughout code
- ALWAYS make config objects immutable after loading (freeze/readonly)
- ALWAYS fail fast with clear error messages listing ALL invalid variables

---

## 4. Environment Parity

```
┌──────────────────────────────────────────────────────────────┐
│              Environment Pipeline                              │
│                                                               │
│  Development ──► Test/CI ──► Staging ──► Production          │
│                                                               │
│  What SHOULD differ:                                         │
│  ├── Connection strings (DB_HOST, REDIS_URL)                 │
│  ├── Secrets (JWT_SECRET, API keys)                          │
│  ├── Feature flags (FEATURE_X=true/false)                    │
│  ├── Performance tuning (DB_POOL_SIZE, WORKER_COUNT)         │
│  └── Logging verbosity (LOG_LEVEL)                           │
│                                                               │
│  What MUST NOT differ:                                       │
│  ├── Application code                                        │
│  ├── Dependency versions                                     │
│  ├── Database schema                                         │
│  ├── Configuration structure (same keys, different values)   │
│  └── Container images                                        │
└──────────────────────────────────────────────────────────────┘
```

| Environment | LOG_LEVEL | DB_SSL | FEATURE_FLAGS | Secrets Source |
|-------------|-----------|--------|---------------|----------------|
| Development | debug | disable | All enabled | `.env.local` |
| Test/CI | warn | disable | Controlled | CI env vars |
| Staging | info | require | Mirror prod | Vault/SSM |
| Production | info | verify-full | Controlled rollout | Vault/SSM |

- ALWAYS keep staging as close to production as possible
- ALWAYS use the same config keys across all environments — only values differ
- NEVER have environment-specific code paths (`if env === "production"`) — use config values
- ALWAYS test with production-like config in staging before deploying

---

## 5. Container & Kubernetes Configuration

```yaml
# Docker Compose — development
services:
  api:
    build: .
    env_file:
      - .env              # Shared defaults
      - .env.development  # Dev overrides
    environment:
      - DB_HOST=postgres  # Override for Docker network
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
```

```yaml
# Kubernetes — ConfigMap for non-secret config
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  APP_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "info"
  DB_HOST: "postgres.database.svc.cluster.local"
  DB_PORT: "5432"
  DB_NAME: "myapp"
  DB_SSL_MODE: "verify-full"
  DB_POOL_SIZE: "20"
---
# Kubernetes — Pod using ConfigMap + Secrets
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  template:
    spec:
      containers:
        - name: api
          image: myapp:latest
          envFrom:
            - configMapRef:
                name: app-config    # Non-secret config
            - secretRef:
                name: app-secrets   # Secrets (see secrets-management.md)
          env:
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: password
```

- ALWAYS use ConfigMap for non-secret configuration in Kubernetes
- ALWAYS use Secrets (or external vault) for sensitive values
- ALWAYS use `envFrom` to inject ConfigMap as environment variables
- NEVER bake configuration into container images — images must be environment-agnostic

---

## 6. .env File Management

```
# .env.example — Committed to git, documents ALL variables
# Copy to .env.local and fill in values for local development

# App
APP_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=debug

# Database (required)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp_dev
DB_USER=postgres
DB_PASSWORD=         # REQUIRED — set in .env.local
DB_SSL_MODE=disable
DB_POOL_SIZE=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=      # Optional for local dev

# Auth (required)
AUTH_JWT_SECRET=      # REQUIRED — min 32 chars, set in .env.local
AUTH_JWT_EXPIRY=3600

# External Services
AWS_REGION=us-east-1
AWS_S3_BUCKET=myapp-dev-uploads

# Feature Flags
FEATURE_NEW_CHECKOUT=true
FEATURE_DARK_MODE=false
```

```gitignore
# .gitignore
.env.local
.env.*.local
.env.production   # If it contains secrets
*.pem
*.key
```

- ALWAYS maintain `.env.example` as documentation of all config variables
- ALWAYS include comments explaining each variable and whether it's required
- NEVER commit files containing actual secrets — only templates with empty values
- ALWAYS add `.env.local` and `*.local` to `.gitignore`

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Hardcoded config values | Must redeploy to change config | Use environment variables |
| No validation on startup | Runtime crashes from missing config | Validate ALL config at startup, fail fast |
| `process.env` scattered in code | No type safety, hard to track usage | Centralized typed config object |
| Env name in variable name | `PROD_DB_HOST` exists alongside `DEV_DB_HOST` | Same key (`DB_HOST`), different values per env |
| Secrets in `.env` committed to git | Credentials exposed in repo history | `.env.local` (gitignored), vault for prod |
| Config baked into Docker images | Different image per environment | Inject config via env vars at runtime |
| No `.env.example` | New devs don't know required vars | Maintain `.env.example` with all vars |
| Boolean as "1"/"yes"/"on" | Inconsistent parsing across languages | Standardize on "true"/"false" |
| No environment parity | "Works in staging, breaks in prod" | Mirror prod config structure in staging |
| Mutable config object | Config changed at runtime, unpredictable | Freeze config after loading |

---

## 8. Enforcement Checklist

- [ ] All configuration loaded from environment variables (12-Factor compliant)
- [ ] Configuration validated on startup — application fails fast on invalid config
- [ ] Typed, immutable config object used throughout application
- [ ] `process.env` / `os.Getenv` accessed ONLY in config loading module
- [ ] `.env.example` documents every variable with comments
- [ ] `.env.local` and secret files in `.gitignore`
- [ ] UPPER_SNAKE_CASE naming convention for all env vars
- [ ] No environment name embedded in variable names
- [ ] Kubernetes uses ConfigMap (non-secret) + Secret (sensitive)
- [ ] Container images are environment-agnostic
- [ ] Staging mirrors production configuration structure
- [ ] All config values have sensible defaults where appropriate
