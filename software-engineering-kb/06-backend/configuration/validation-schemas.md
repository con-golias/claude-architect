# Configuration Validation & Schemas

> **AI Plugin Directive — Configuration Validation & Type-Safe Loading**
> You are an AI coding assistant. When generating, reviewing, or refactoring configuration
> validation code, follow EVERY rule in this document. Unvalidated configuration causes
> silent failures, runtime crashes, and security vulnerabilities. Treat each section as non-negotiable.

**Core Rule: ALWAYS define a schema for ALL configuration. ALWAYS validate the ENTIRE configuration on application startup — fail fast with ALL errors, not just the first one. NEVER access raw environment variables outside the config module.**

---

## 1. Fail-Fast Validation Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Configuration Loading Pipeline                    │
│                                                               │
│  1. Load sources                                             │
│     .env files → env vars → CLI args → defaults              │
│                                                               │
│  2. Parse & coerce types                                     │
│     "3000" → 3000 (number)                                   │
│     "true" → true (boolean)                                  │
│     "a,b,c" → ["a","b","c"] (array)                         │
│                                                               │
│  3. Validate against schema                                  │
│     Required fields present?                                 │
│     Types correct?                                           │
│     Values within constraints? (min, max, enum)              │
│                                                               │
│  4. Result                                                   │
│     ✅ Valid → Frozen config object (immutable)              │
│     ❌ Invalid → Print ALL errors → process.exit(1)         │
│                                                               │
│  NEVER partially valid. NEVER deferred validation.           │
│  Application MUST NOT start with invalid configuration.      │
└──────────────────────────────────────────────────────────────┘
```

| Principle | Rule |
|-----------|------|
| **Fail fast** | Validate ALL config at startup, not on first use |
| **All errors** | Report every validation error, not just the first |
| **Type safety** | Config object is fully typed — no `any`, no `string` for numbers |
| **Immutable** | Config is frozen after validation — no runtime mutations |
| **Single source** | One module loads and exports config — no scattered `process.env` |
| **Coercion** | Env vars are strings — coerce to proper types in schema |

---

## 2. TypeScript (Zod)

```typescript
import { z } from "zod";
import "dotenv/config";

// Helper: comma-separated string → array
const csvArray = z.string().transform((s) => s.split(",").map((v) => v.trim()).filter(Boolean));

// Helper: string → boolean
const envBoolean = z.enum(["true", "false"]).transform((v) => v === "true");

// Helper: string → duration in ms
const durationMs = z.string().regex(/^\d+(ms|s|m|h)$/).transform((v) => {
  const num = parseInt(v);
  if (v.endsWith("ms")) return num;
  if (v.endsWith("s")) return num * 1000;
  if (v.endsWith("m")) return num * 60_000;
  if (v.endsWith("h")) return num * 3_600_000;
  return num;
});

const configSchema = z.object({
  // App
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Database
  DB_HOST: z.string().min(1, "DB_HOST is required"),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_NAME: z.string().min(1, "DB_NAME is required"),
  DB_USER: z.string().min(1, "DB_USER is required"),
  DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),
  DB_SSL_MODE: z.enum(["disable", "require", "verify-full"]).default("require"),
  DB_POOL_MIN: z.coerce.number().int().min(0).default(2),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),

  // Redis
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL"),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS_ENABLED: envBoolean.default("false"),

  // Auth
  AUTH_JWT_SECRET: z.string().min(32, "AUTH_JWT_SECRET must be at least 32 characters"),
  AUTH_JWT_EXPIRY: z.coerce.number().int().min(60).default(3600),
  AUTH_BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  // CORS
  CORS_ORIGINS: csvArray.default("http://localhost:3000"),
  CORS_CREDENTIALS: envBoolean.default("true"),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().default(100),
}).refine(
  (data) => data.DB_POOL_MIN <= data.DB_POOL_MAX,
  { message: "DB_POOL_MIN must be <= DB_POOL_MAX", path: ["DB_POOL_MIN"] }
);

// Infer the type from the schema
type Config = z.infer<typeof configSchema>;

// Load and validate
function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    console.error("\n=== CONFIGURATION ERROR ===");
    console.error("Application cannot start with invalid configuration:\n");
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      console.error(`  ${path}: ${issue.message}`);
    }
    console.error("\n===========================\n");
    process.exit(1);
  }

  return Object.freeze(result.data);
}

export const config = loadConfig();

// Type-safe usage throughout the app:
// config.PORT         → number (not string)
// config.CORS_ORIGINS → string[] (not comma-separated string)
// config.REDIS_TLS_ENABLED → boolean (not "true"/"false")
```

### 2.1 Nested Config Structure

```typescript
// For complex apps, organize config into logical groups
const appSchema = z.object({
  env: z.enum(["development", "production", "test"]).default("development"),
  port: z.coerce.number().default(3000),
  host: z.string().default("0.0.0.0"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const dbSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().default(5432),
  name: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
  sslMode: z.enum(["disable", "require", "verify-full"]).default("require"),
  poolMin: z.coerce.number().default(2),
  poolMax: z.coerce.number().default(20),
});

// Map env vars to nested structure
function loadConfig(): Config {
  const env = process.env;

  const app = appSchema.parse({
    env: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    logLevel: env.LOG_LEVEL,
  });

  const db = dbSchema.parse({
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    sslMode: env.DB_SSL_MODE,
    poolMin: env.DB_POOL_MIN,
    poolMax: env.DB_POOL_MAX,
  });

  return Object.freeze({ app, db });
}

// Usage: config.app.port, config.db.host
```

---

## 3. Go (Struct Tags + Custom Validation)

```go
import (
    "github.com/caarlos0/env/v10"
    "github.com/go-playground/validator/v10"
)

type Config struct {
    App   AppConfig   `envPrefix:"APP_"`
    DB    DBConfig    `envPrefix:"DB_"`
    Redis RedisConfig `envPrefix:"REDIS_"`
    Auth  AuthConfig  `envPrefix:"AUTH_"`
}

type AppConfig struct {
    Env      string `env:"ENV" envDefault:"development" validate:"oneof=development production test"`
    Port     int    `env:"PORT" envDefault:"3000" validate:"min=1,max=65535"`
    Host     string `env:"HOST" envDefault:"0.0.0.0"`
    LogLevel string `env:"LOG_LEVEL" envDefault:"info" validate:"oneof=debug info warn error"`
}

type DBConfig struct {
    Host     string `env:"HOST,required" validate:"required,min=1"`
    Port     int    `env:"PORT" envDefault:"5432" validate:"min=1,max=65535"`
    Name     string `env:"NAME,required" validate:"required,min=1"`
    User     string `env:"USER,required" validate:"required,min=1"`
    Password string `env:"PASSWORD,required" validate:"required,min=1"`
    SSLMode  string `env:"SSL_MODE" envDefault:"require" validate:"oneof=disable require verify-full"`
    PoolMin  int    `env:"POOL_MIN" envDefault:"2" validate:"min=0,ltefield=PoolMax"`
    PoolMax  int    `env:"POOL_MAX" envDefault:"20" validate:"min=1,max=100"`
}

type RedisConfig struct {
    URL        string `env:"URL,required" validate:"required,url"`
    Password   string `env:"PASSWORD"`
    TLSEnabled bool   `env:"TLS_ENABLED" envDefault:"false"`
}

type AuthConfig struct {
    JWTSecret    string `env:"JWT_SECRET,required" validate:"required,min=32"`
    JWTExpiry    int    `env:"JWT_EXPIRY" envDefault:"3600" validate:"min=60"`
    BcryptRounds int    `env:"BCRYPT_ROUNDS" envDefault:"12" validate:"min=10,max=15"`
}

func LoadConfig() (*Config, error) {
    _ = godotenv.Load() // Optional .env file

    cfg := &Config{}
    if err := env.Parse(cfg); err != nil {
        return nil, fmt.Errorf("environment parsing failed: %w", err)
    }

    // Validate constraints
    validate := validator.New()
    if err := validate.Struct(cfg); err != nil {
        var validationErrors validator.ValidationErrors
        if errors.As(err, &validationErrors) {
            var msgs []string
            for _, e := range validationErrors {
                msgs = append(msgs, fmt.Sprintf("  %s: failed %s validation (value: %v)",
                    e.Namespace(), e.Tag(), e.Value()))
            }
            return nil, fmt.Errorf("configuration validation failed:\n%s", strings.Join(msgs, "\n"))
        }
        return nil, err
    }

    return cfg, nil
}

// main.go
func main() {
    cfg, err := LoadConfig()
    if err != nil {
        log.Fatalf("CONFIGURATION ERROR:\n%v", err)
    }
    // Use cfg.App.Port, cfg.DB.Host, etc.
}
```

---

## 4. Python (Pydantic)

```python
from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic_settings import BaseSettings
from typing import Literal
import sys

class AppConfig(BaseModel):
    env: Literal["development", "production", "test"] = "development"
    port: int = Field(default=3000, ge=1, le=65535)
    host: str = "0.0.0.0"
    log_level: Literal["debug", "info", "warn", "error"] = "info"

class DBConfig(BaseModel):
    host: str = Field(..., min_length=1)
    port: int = Field(default=5432, ge=1, le=65535)
    name: str = Field(..., min_length=1)
    user: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    ssl_mode: Literal["disable", "require", "verify-full"] = "require"
    pool_min: int = Field(default=2, ge=0)
    pool_max: int = Field(default=20, ge=1, le=100)

    @model_validator(mode="after")
    def validate_pool_range(self):
        if self.pool_min > self.pool_max:
            raise ValueError("pool_min must be <= pool_max")
        return self

class RedisConfig(BaseModel):
    url: str = Field(...)
    password: str | None = None
    tls_enabled: bool = False

class AuthConfig(BaseModel):
    jwt_secret: str = Field(..., min_length=32)
    jwt_expiry: int = Field(default=3600, ge=60)
    bcrypt_rounds: int = Field(default=12, ge=10, le=15)

class Config(BaseSettings):
    app: AppConfig = Field(default_factory=AppConfig)
    db: DBConfig
    redis: RedisConfig
    auth: AuthConfig

    model_config = {
        "env_file": ".env",
        "env_nested_delimiter": "__",  # DB__HOST → db.host
    }

# Load and validate — fail fast
try:
    config = Config()
except ValidationError as e:
    print("\n=== CONFIGURATION ERROR ===")
    for error in e.errors():
        field = " → ".join(str(loc) for loc in error["loc"])
        print(f"  {field}: {error['msg']}")
    print("===========================\n")
    sys.exit(1)

# Usage: config.app.port, config.db.host
```

---

## 5. Cross-Field Validation

```typescript
// Complex validation rules that span multiple fields
const configSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  DB_SSL_MODE: z.enum(["disable", "require", "verify-full"]),
  REDIS_TLS_ENABLED: envBoolean,
  AUTH_JWT_SECRET: z.string(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
}).superRefine((data, ctx) => {
  // Production MUST use SSL
  if (data.NODE_ENV === "production" && data.DB_SSL_MODE === "disable") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "DB_SSL_MODE cannot be 'disable' in production",
      path: ["DB_SSL_MODE"],
    });
  }

  // Production MUST use TLS for Redis
  if (data.NODE_ENV === "production" && !data.REDIS_TLS_ENABLED) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "REDIS_TLS_ENABLED must be true in production",
      path: ["REDIS_TLS_ENABLED"],
    });
  }

  // Production MUST NOT use debug logging
  if (data.NODE_ENV === "production" && data.LOG_LEVEL === "debug") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "LOG_LEVEL should not be 'debug' in production (performance impact)",
      path: ["LOG_LEVEL"],
    });
  }

  // JWT secret must be strong in production
  if (data.NODE_ENV === "production" && data.AUTH_JWT_SECRET.length < 64) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "AUTH_JWT_SECRET should be at least 64 characters in production",
      path: ["AUTH_JWT_SECRET"],
    });
  }
});
```

```go
// Cross-field validation in Go
func (c *Config) Validate() error {
    var errs []string

    if c.App.Env == "production" {
        if c.DB.SSLMode == "disable" {
            errs = append(errs, "DB_SSL_MODE cannot be 'disable' in production")
        }
        if !c.Redis.TLSEnabled {
            errs = append(errs, "REDIS_TLS_ENABLED must be true in production")
        }
        if len(c.Auth.JWTSecret) < 64 {
            errs = append(errs, "AUTH_JWT_SECRET must be >= 64 chars in production")
        }
        if c.App.LogLevel == "debug" {
            errs = append(errs, "LOG_LEVEL should not be 'debug' in production")
        }
    }

    if len(errs) > 0 {
        return fmt.Errorf("config validation:\n  %s", strings.Join(errs, "\n  "))
    }
    return nil
}
```

- ALWAYS enforce production-specific constraints (SSL, TLS, strong secrets)
- ALWAYS validate cross-field dependencies (pool_min <= pool_max)
- ALWAYS report ALL validation errors at once — not one at a time
- ALWAYS make production stricter than development

---

## 6. Config Module Pattern

```typescript
// src/config/index.ts — THE ONLY file that reads process.env
import { z } from "zod";
import "dotenv/config";

const schema = z.object({ /* ... */ });
export type Config = z.infer<typeof schema>;
export const config = loadAndValidate(schema);

// src/db/connection.ts — receives config, NEVER reads env
import { config } from "../config";

export function createDBPool() {
  return new Pool({
    host: config.DB_HOST,
    port: config.DB_PORT,     // Already a number
    password: config.DB_PASSWORD,
  });
}

// NEVER do this in application code:
// ❌ const host = process.env.DB_HOST;       // No validation
// ❌ const port = parseInt(process.env.PORT); // No type safety
// ❌ if (process.env.NODE_ENV === "prod")     // Scattered access
```

```go
// pkg/config/config.go — THE ONLY package that reads os.Getenv
func LoadConfig() (*Config, error) { /* ... */ }

// internal/db/connection.go — receives config
func NewPool(cfg *config.DBConfig) (*pgxpool.Pool, error) {
    connStr := fmt.Sprintf("host=%s port=%d dbname=%s user=%s password=%s sslmode=%s",
        cfg.Host, cfg.Port, cfg.Name, cfg.User, cfg.Password, cfg.SSLMode)
    return pgxpool.New(ctx, connStr)
}

// NEVER do this:
// ❌ host := os.Getenv("DB_HOST")  // No validation, scattered
```

- ALWAYS have ONE config module that loads, validates, and exports configuration
- NEVER access `process.env`, `os.Getenv`, or `os.environ` outside the config module
- ALWAYS pass config as a dependency — NEVER import env vars in business logic
- ALWAYS export a frozen/immutable config object

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No schema validation | Runtime crashes from missing vars | Define schema, validate at startup |
| First-error-only reporting | Must restart N times to find N errors | Report ALL errors at once |
| `process.env` scattered in code | No type safety, hard to audit | Single config module pattern |
| String types for everything | `"3000" + 1 = "30001"` | Coerce to proper types in schema |
| No defaults for optional values | Crashes in development | Provide sensible defaults |
| Mutable config | Config changed at runtime | Freeze config object after validation |
| No production-specific validation | Weak secrets in prod | Cross-field rules for production |
| Lazy validation (on first use) | App starts, then crashes minutes later | Validate ALL at startup |
| No `.env.example` | New devs don't know required vars | Maintain documented example |
| Config in multiple modules | Duplicate loading, inconsistent | One config module, import everywhere |

---

## 8. Enforcement Checklist

- [ ] Configuration schema defined for ALL environment variables
- [ ] ALL config validated at startup — application fails fast on invalid config
- [ ] ALL validation errors reported at once (not one at a time)
- [ ] Types coerced from strings (numbers, booleans, arrays, durations)
- [ ] Cross-field validation enforced (pool ranges, production constraints)
- [ ] Production-specific rules (SSL required, strong secrets, no debug logging)
- [ ] Config object is immutable (frozen) after validation
- [ ] Single config module — no `process.env` / `os.Getenv` elsewhere in code
- [ ] `.env.example` documents all variables with comments
- [ ] Sensible defaults for optional config values
- [ ] Config passed as dependency — not imported as global in business logic
