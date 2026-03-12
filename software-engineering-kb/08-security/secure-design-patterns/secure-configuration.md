# Secure Configuration Patterns Guide

## Overview

Category: Secure Design Patterns
Scope: Application configuration security, secrets management, environment isolation
Audience: Backend engineers, DevOps engineers, platform engineers, SREs
Last Updated: 2025-06

## Purpose

Configuration is a critical attack surface. Misconfigured applications expose
debug endpoints, use weak encryption, connect to wrong databases, or leak
secrets through logs. This guide covers patterns for loading, validating,
storing, and managing configuration securely. The core principle: configuration
must be validated at startup, secrets must be separated from regular config,
and drift from expected state must be detected and alerted.

---

## Pattern 1: Environment-Based Configuration

### Theory

Follow the 12-Factor App methodology: store configuration in the environment.
Configuration differs between deployments (development, staging, production),
but code does not. Use environment variables for deployment-specific values,
configuration files for structured defaults, and environment-specific overrides
for per-environment customization.

Priority order (highest to lowest):
1. Environment variables (deployment-specific)
2. Environment-specific config files (staging.yaml, production.yaml)
3. Default config file (default.yaml)
4. Hardcoded defaults in code (only for safe defaults)

### TypeScript -- Configuration Loading with Validation

```typescript
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Define the complete configuration schema
const ConfigSchema = z.object({
  server: z.object({
    port: z.number().int().min(1).max(65535).default(8080),
    host: z.string().default('0.0.0.0'),
    shutdownTimeout: z.number().int().min(1000).max(60000).default(15000),
  }),
  database: z.object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535).default(5432),
    name: z.string().min(1),
    user: z.string().min(1),
    sslMode: z.enum(['disable', 'require', 'verify-ca', 'verify-full']).default('verify-full'),
    maxConnections: z.number().int().min(1).max(100).default(20),
    connectionTimeout: z.number().int().min(1000).max(30000).default(5000),
  }),
  redis: z.object({
    url: z.string().url(),
    tls: z.boolean().default(true),
    maxRetries: z.number().int().min(0).max(10).default(3),
  }),
  auth: z.object({
    tokenExpiry: z.number().int().min(300).max(86400).default(3600),
    refreshTokenExpiry: z.number().int().min(3600).max(2592000).default(604800),
    bcryptRounds: z.number().int().min(10).max(16).default(12),
    maxLoginAttempts: z.number().int().min(3).max(10).default(5),
    lockoutDuration: z.number().int().min(60).max(3600).default(900),
  }),
  cors: z.object({
    allowedOrigins: z.array(z.string().url()).min(1),
    maxAge: z.number().int().min(0).max(86400).default(600),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'text']).default('json'),
    redactPII: z.boolean().default(true),
  }),
  features: z.object({
    debugEndpoints: z.boolean().default(false),
    swaggerUI: z.boolean().default(false),
    profiling: z.boolean().default(false),
  }),
});

type AppConfig = z.infer<typeof ConfigSchema>;

function loadConfig(): AppConfig {
  const env = process.env.NODE_ENV || 'production';

  // Load default config file
  let fileConfig: Record<string, any> = {};
  const defaultConfigPath = path.join(__dirname, 'config', 'default.yaml');
  if (fs.existsSync(defaultConfigPath)) {
    fileConfig = yaml.load(fs.readFileSync(defaultConfigPath, 'utf8')) as Record<string, any>;
  }

  // Load environment-specific overrides
  const envConfigPath = path.join(__dirname, 'config', `${env}.yaml`);
  if (fs.existsSync(envConfigPath)) {
    const envConfig = yaml.load(fs.readFileSync(envConfigPath, 'utf8')) as Record<string, any>;
    fileConfig = deepMerge(fileConfig, envConfig);
  }

  // Override with environment variables
  const envOverrides: Record<string, any> = {
    server: {
      port: maybeInt(process.env.PORT),
      host: process.env.HOST,
    },
    database: {
      host: process.env.DB_HOST,
      port: maybeInt(process.env.DB_PORT),
      name: process.env.DB_NAME,
      user: process.env.DB_USER,
      sslMode: process.env.DB_SSL_MODE,
    },
    redis: {
      url: process.env.REDIS_URL,
    },
    cors: {
      allowedOrigins: process.env.CORS_ORIGINS?.split(','),
    },
    logging: {
      level: process.env.LOG_LEVEL,
    },
  };

  const merged = deepMerge(fileConfig, removeUndefined(envOverrides));

  // Validate the complete configuration -- fail fast
  const result = ConfigSchema.safeParse(merged);
  if (!result.success) {
    console.error('FATAL: Configuration validation failed:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  const config = result.data;

  // Production safety checks
  if (env === 'production') {
    if (config.features.debugEndpoints) {
      console.error('FATAL: Debug endpoints cannot be enabled in production');
      process.exit(1);
    }
    if (config.features.profiling) {
      console.error('FATAL: Profiling cannot be enabled in production');
      process.exit(1);
    }
    if (config.database.sslMode === 'disable') {
      console.error('FATAL: Database SSL cannot be disabled in production');
      process.exit(1);
    }
    if (config.logging.level === 'debug') {
      console.error('FATAL: Debug logging cannot be enabled in production');
      process.exit(1);
    }
  }

  return config;
}

function maybeInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

function removeUndefined(obj: Record<string, any>): Record<string, any> {
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
```

### Go -- Configuration with Validation

```go
package config

import (
    "fmt"
    "log"
    "os"
    "strconv"
    "strings"
    "time"

    "gopkg.in/yaml.v3"
)

type Config struct {
    Server   ServerConfig   `yaml:"server"`
    Database DatabaseConfig `yaml:"database"`
    Redis    RedisConfig    `yaml:"redis"`
    Auth     AuthConfig     `yaml:"auth"`
    CORS     CORSConfig     `yaml:"cors"`
    Logging  LoggingConfig  `yaml:"logging"`
    Features FeatureConfig  `yaml:"features"`
}

type ServerConfig struct {
    Port            int           `yaml:"port"`
    Host            string        `yaml:"host"`
    ShutdownTimeout time.Duration `yaml:"shutdown_timeout"`
}

type DatabaseConfig struct {
    Host           string `yaml:"host"`
    Port           int    `yaml:"port"`
    Name           string `yaml:"name"`
    User           string `yaml:"user"`
    SSLMode        string `yaml:"ssl_mode"`
    MaxConnections int    `yaml:"max_connections"`
}

type RedisConfig struct {
    URL        string `yaml:"url"`
    TLS        bool   `yaml:"tls"`
    MaxRetries int    `yaml:"max_retries"`
}

type AuthConfig struct {
    TokenExpiry       time.Duration `yaml:"token_expiry"`
    RefreshExpiry     time.Duration `yaml:"refresh_expiry"`
    BcryptRounds      int           `yaml:"bcrypt_rounds"`
    MaxLoginAttempts  int           `yaml:"max_login_attempts"`
    LockoutDuration   time.Duration `yaml:"lockout_duration"`
}

type CORSConfig struct {
    AllowedOrigins []string `yaml:"allowed_origins"`
    MaxAge         int      `yaml:"max_age"`
}

type LoggingConfig struct {
    Level     string `yaml:"level"`
    Format    string `yaml:"format"`
    RedactPII bool   `yaml:"redact_pii"`
}

type FeatureConfig struct {
    DebugEndpoints bool `yaml:"debug_endpoints"`
    SwaggerUI      bool `yaml:"swagger_ui"`
    Profiling      bool `yaml:"profiling"`
}

func Load() *Config {
    env := os.Getenv("APP_ENV")
    if env == "" {
        env = "production" // Default to production (safe)
    }

    cfg := &Config{}

    // Load default config
    loadYAML(cfg, "config/default.yaml")

    // Load environment-specific overrides
    envFile := fmt.Sprintf("config/%s.yaml", env)
    loadYAML(cfg, envFile)

    // Override with environment variables
    applyEnvOverrides(cfg)

    // Validate configuration
    if err := validate(cfg, env); err != nil {
        log.Fatalf("FATAL: Configuration validation failed: %v", err)
    }

    return cfg
}

func validate(cfg *Config, env string) error {
    var errors []string

    if cfg.Server.Port < 1 || cfg.Server.Port > 65535 {
        errors = append(errors, fmt.Sprintf("server.port: must be 1-65535, got %d", cfg.Server.Port))
    }
    if cfg.Database.Host == "" {
        errors = append(errors, "database.host: required")
    }
    if cfg.Database.Name == "" {
        errors = append(errors, "database.name: required")
    }
    if cfg.Database.User == "" {
        errors = append(errors, "database.user: required")
    }
    if len(cfg.CORS.AllowedOrigins) == 0 {
        errors = append(errors, "cors.allowed_origins: at least one origin required")
    }

    // Production safety checks
    if env == "production" {
        if cfg.Features.DebugEndpoints {
            errors = append(errors, "features.debug_endpoints: cannot be enabled in production")
        }
        if cfg.Features.Profiling {
            errors = append(errors, "features.profiling: cannot be enabled in production")
        }
        if cfg.Database.SSLMode == "disable" {
            errors = append(errors, "database.ssl_mode: cannot be 'disable' in production")
        }
        if cfg.Logging.Level == "debug" {
            errors = append(errors, "logging.level: cannot be 'debug' in production")
        }
        if !cfg.Redis.TLS {
            errors = append(errors, "redis.tls: must be enabled in production")
        }
    }

    if len(errors) > 0 {
        return fmt.Errorf("validation errors:\n  %s", strings.Join(errors, "\n  "))
    }
    return nil
}

func applyEnvOverrides(cfg *Config) {
    if v := os.Getenv("PORT"); v != "" {
        if port, err := strconv.Atoi(v); err == nil {
            cfg.Server.Port = port
        }
    }
    if v := os.Getenv("DB_HOST"); v != "" {
        cfg.Database.Host = v
    }
    if v := os.Getenv("DB_PORT"); v != "" {
        if port, err := strconv.Atoi(v); err == nil {
            cfg.Database.Port = port
        }
    }
    if v := os.Getenv("DB_NAME"); v != "" {
        cfg.Database.Name = v
    }
    if v := os.Getenv("DB_USER"); v != "" {
        cfg.Database.User = v
    }
    if v := os.Getenv("DB_SSL_MODE"); v != "" {
        cfg.Database.SSLMode = v
    }
    if v := os.Getenv("REDIS_URL"); v != "" {
        cfg.Redis.URL = v
    }
    if v := os.Getenv("LOG_LEVEL"); v != "" {
        cfg.Logging.Level = v
    }
    if v := os.Getenv("CORS_ORIGINS"); v != "" {
        cfg.CORS.AllowedOrigins = strings.Split(v, ",")
    }
}

func loadYAML(cfg *Config, path string) {
    data, err := os.ReadFile(path)
    if err != nil {
        return // File not found is OK for optional overrides
    }
    if err := yaml.Unmarshal(data, cfg); err != nil {
        log.Fatalf("Failed to parse %s: %v", path, err)
    }
}
```

### Python -- Configuration with Pydantic

```python
import os
import sys
from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic_settings import BaseSettings


class ServerConfig(BaseModel):
    port: int = Field(default=8080, ge=1, le=65535)
    host: str = '0.0.0.0'
    shutdown_timeout: int = Field(default=15, ge=1, le=60)


class DatabaseConfig(BaseModel):
    host: str = Field(min_length=1)
    port: int = Field(default=5432, ge=1, le=65535)
    name: str = Field(min_length=1)
    user: str = Field(min_length=1)
    ssl_mode: str = Field(default='verify-full')
    max_connections: int = Field(default=20, ge=1, le=100)

    @field_validator('ssl_mode')
    @classmethod
    def validate_ssl_mode(cls, v: str) -> str:
        allowed = ['disable', 'require', 'verify-ca', 'verify-full']
        if v not in allowed:
            raise ValueError(f'ssl_mode must be one of {allowed}')
        return v


class RedisConfig(BaseModel):
    url: str
    tls: bool = True
    max_retries: int = Field(default=3, ge=0, le=10)


class AuthConfig(BaseModel):
    token_expiry: int = Field(default=3600, ge=300, le=86400)
    refresh_expiry: int = Field(default=604800, ge=3600, le=2592000)
    bcrypt_rounds: int = Field(default=12, ge=10, le=16)
    max_login_attempts: int = Field(default=5, ge=3, le=10)
    lockout_duration: int = Field(default=900, ge=60, le=3600)


class CORSConfig(BaseModel):
    allowed_origins: list[str] = Field(min_length=1)
    max_age: int = Field(default=600, ge=0, le=86400)


class LoggingConfig(BaseModel):
    level: str = 'info'
    format: str = 'json'
    redact_pii: bool = True

    @field_validator('level')
    @classmethod
    def validate_level(cls, v: str) -> str:
        allowed = ['debug', 'info', 'warn', 'error']
        if v not in allowed:
            raise ValueError(f'level must be one of {allowed}')
        return v


class FeatureConfig(BaseModel):
    debug_endpoints: bool = False
    swagger_ui: bool = False
    profiling: bool = False


class AppConfig(BaseModel):
    server: ServerConfig = ServerConfig()
    database: DatabaseConfig
    redis: RedisConfig
    auth: AuthConfig = AuthConfig()
    cors: CORSConfig
    logging: LoggingConfig = LoggingConfig()
    features: FeatureConfig = FeatureConfig()


def load_config() -> AppConfig:
    env = os.getenv('APP_ENV', 'production')

    # Load default YAML config
    config_data = {}
    default_path = Path('config/default.yaml')
    if default_path.exists():
        config_data = yaml.safe_load(default_path.read_text()) or {}

    # Load environment-specific overrides
    env_path = Path(f'config/{env}.yaml')
    if env_path.exists():
        env_data = yaml.safe_load(env_path.read_text()) or {}
        config_data = deep_merge(config_data, env_data)

    # Apply environment variable overrides
    env_overrides = {
        'server': {'port': _maybe_int(os.getenv('PORT'))},
        'database': {
            'host': os.getenv('DB_HOST'),
            'port': _maybe_int(os.getenv('DB_PORT')),
            'name': os.getenv('DB_NAME'),
            'user': os.getenv('DB_USER'),
            'ssl_mode': os.getenv('DB_SSL_MODE'),
        },
        'redis': {'url': os.getenv('REDIS_URL')},
        'logging': {'level': os.getenv('LOG_LEVEL')},
        'cors': {
            'allowed_origins': (
                os.getenv('CORS_ORIGINS', '').split(',')
                if os.getenv('CORS_ORIGINS') else None
            ),
        },
    }
    config_data = deep_merge(config_data, _remove_none(env_overrides))

    # Validate -- fail fast
    try:
        config = AppConfig(**config_data)
    except Exception as e:
        print(f'FATAL: Configuration validation failed: {e}', file=sys.stderr)
        sys.exit(1)

    # Production safety checks
    if env == 'production':
        errors = []
        if config.features.debug_endpoints:
            errors.append('debug_endpoints cannot be enabled in production')
        if config.features.profiling:
            errors.append('profiling cannot be enabled in production')
        if config.database.ssl_mode == 'disable':
            errors.append('database SSL cannot be disabled in production')
        if config.logging.level == 'debug':
            errors.append('debug logging cannot be enabled in production')
        if not config.redis.tls:
            errors.append('Redis TLS must be enabled in production')

        if errors:
            for err in errors:
                print(f'FATAL: {err}', file=sys.stderr)
            sys.exit(1)

    return config


def _maybe_int(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _remove_none(d: dict) -> dict:
    return {
        k: _remove_none(v) if isinstance(v, dict) else v
        for k, v in d.items()
        if v is not None
    }


def deep_merge(base: dict, override: dict) -> dict:
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result
```

---

## Pattern 2: External Configuration Stores

### Theory

External configuration stores centralize configuration management across
services. They support versioning, access control, encryption, and audit
logging. Use them for shared configuration and non-secret settings that
need to be updated without redeployment.

### AWS SSM Parameter Store

```typescript
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';

class SSMConfigLoader {
  private ssm: SSMClient;

  constructor(region: string) {
    this.ssm = new SSMClient({ region });
  }

  async loadConfig(prefix: string): Promise<Record<string, string>> {
    const config: Record<string, string> = {};
    let nextToken: string | undefined;

    do {
      const response = await this.ssm.send(new GetParametersByPathCommand({
        Path: prefix,
        Recursive: true,
        WithDecryption: true,  // Decrypt SecureString parameters
        NextToken: nextToken,
      }));

      for (const param of response.Parameters || []) {
        if (param.Name && param.Value) {
          // Convert /app/production/database/host to database.host
          const key = param.Name
            .replace(prefix, '')
            .replace(/^\//, '')
            .replace(/\//g, '.');
          config[key] = param.Value;
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return config;
  }
}

// Usage
const loader = new SSMConfigLoader('us-east-1');
const config = await loader.loadConfig('/myapp/production/');
// Returns: { 'database.host': 'db.example.com', 'database.port': '5432', ... }
```

### HashiCorp Consul

```go
package config

import (
    "encoding/json"
    "fmt"
    "strings"

    "github.com/hashicorp/consul/api"
)

type ConsulConfigLoader struct {
    client *api.Client
    prefix string
}

func NewConsulConfigLoader(address, prefix string) (*ConsulConfigLoader, error) {
    cfg := api.DefaultConfig()
    cfg.Address = address

    client, err := api.NewClient(cfg)
    if err != nil {
        return nil, err
    }

    return &ConsulConfigLoader{client: client, prefix: prefix}, nil
}

func (c *ConsulConfigLoader) LoadConfig() (map[string]string, error) {
    kv := c.client.KV()
    pairs, _, err := kv.List(c.prefix, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to load config from Consul: %w", err)
    }

    config := make(map[string]string)
    for _, pair := range pairs {
        key := strings.TrimPrefix(pair.Key, c.prefix)
        key = strings.ReplaceAll(key, "/", ".")
        config[key] = string(pair.Value)
    }

    return config, nil
}

// Watch for config changes
func (c *ConsulConfigLoader) Watch(key string, callback func(value string)) {
    kv := c.client.KV()
    var lastIndex uint64

    for {
        pair, meta, err := kv.Get(c.prefix+key, &api.QueryOptions{
            WaitIndex: lastIndex,
            WaitTime:  60 * time.Second,
        })
        if err != nil {
            time.Sleep(5 * time.Second)
            continue
        }

        if meta.LastIndex != lastIndex {
            lastIndex = meta.LastIndex
            if pair != nil {
                callback(string(pair.Value))
            }
        }
    }
}
```

---

## Pattern 3: Configuration Validation at Startup

### Theory

Validate all configuration when the application starts. If any required value
is missing, any value is out of range, or any connection string is malformed,
the application must refuse to start. This is the "fail fast" principle.
A misconfigured application running is worse than no application running.

### TypeScript -- Startup Validation

```typescript
interface ValidationRule {
  path: string;
  type: 'required' | 'range' | 'url' | 'enum' | 'connection' | 'custom';
  params?: any;
  message: string;
}

const validationRules: ValidationRule[] = [
  { path: 'database.host', type: 'required', message: 'Database host is required' },
  { path: 'database.port', type: 'range', params: { min: 1, max: 65535 },
    message: 'Database port must be 1-65535' },
  { path: 'database.sslMode', type: 'enum',
    params: { values: ['disable', 'require', 'verify-ca', 'verify-full'] },
    message: 'Invalid SSL mode' },
  { path: 'redis.url', type: 'url', message: 'Redis URL must be a valid URL' },
  { path: 'auth.bcryptRounds', type: 'range', params: { min: 10, max: 16 },
    message: 'Bcrypt rounds must be 10-16' },
];

async function validateConfigAtStartup(config: AppConfig): Promise<void> {
  const errors: string[] = [];

  // Schema validation (covered by Zod above)

  // Connection validation -- verify we can actually connect
  try {
    await testDatabaseConnection(config.database);
  } catch (err) {
    errors.push(`Database connection failed: ${(err as Error).message}`);
  }

  try {
    await testRedisConnection(config.redis);
  } catch (err) {
    errors.push(`Redis connection failed: ${(err as Error).message}`);
  }

  // Verify external service URLs are reachable
  for (const origin of config.cors.allowedOrigins) {
    try {
      new URL(origin);
    } catch {
      errors.push(`Invalid CORS origin: ${origin}`);
    }
  }

  if (errors.length > 0) {
    console.error('FATAL: Configuration validation failed:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('Configuration validated successfully');
}
```

### Go -- Connection Validation at Startup

```go
package config

import (
    "context"
    "database/sql"
    "fmt"
    "net"
    "net/url"
    "time"

    "github.com/redis/go-redis/v9"
)

func ValidateConnections(cfg *Config) error {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    var errors []string

    // Test database connectivity
    dsn := fmt.Sprintf(
        "host=%s port=%d user=%s dbname=%s sslmode=%s",
        cfg.Database.Host, cfg.Database.Port,
        cfg.Database.User, cfg.Database.Name, cfg.Database.SSLMode,
    )
    db, err := sql.Open("postgres", dsn)
    if err != nil {
        errors = append(errors, fmt.Sprintf("database: %v", err))
    } else {
        defer db.Close()
        if err := db.PingContext(ctx); err != nil {
            errors = append(errors, fmt.Sprintf("database ping: %v", err))
        }
    }

    // Test Redis connectivity
    redisURL, err := url.Parse(cfg.Redis.URL)
    if err != nil {
        errors = append(errors, fmt.Sprintf("redis URL: %v", err))
    } else {
        rdb := redis.NewClient(&redis.Options{
            Addr: redisURL.Host,
        })
        defer rdb.Close()
        if err := rdb.Ping(ctx).Err(); err != nil {
            errors = append(errors, fmt.Sprintf("redis ping: %v", err))
        }
    }

    // Validate CORS origins are valid URLs
    for _, origin := range cfg.CORS.AllowedOrigins {
        if _, err := url.ParseRequestURI(origin); err != nil {
            errors = append(errors, fmt.Sprintf("invalid CORS origin %s: %v", origin, err))
        }
    }

    if len(errors) > 0 {
        return fmt.Errorf("connection validation failed:\n  %s",
            strings.Join(errors, "\n  "))
    }

    return nil
}
```

---

## Pattern 4: Feature Flag Security

### Theory

Feature flags control which features are active in a deployment. Security
requirements:
1. Evaluate flags server-side, never client-side
2. Audit all flag changes
3. Support emergency kill switches for instant rollback
4. Use targeting rules for gradual rollout

### TypeScript -- Secure Feature Flag System

```typescript
interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  targetingRules: TargetingRule[];
  killSwitch: boolean;          // Override: force disable
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

interface TargetingRule {
  attribute: string;            // 'userId', 'tenantId', 'role', 'percentage'
  operator: 'eq' | 'in' | 'lt' | 'gt' | 'percentage';
  value: any;
}

interface EvaluationContext {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  attributes: Record<string, any>;
}

class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private cache: Map<string, { value: boolean; expiresAt: number }> = new Map();
  private auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  // SERVER-SIDE evaluation only -- never expose flag logic to clients
  evaluate(flagName: string, context: EvaluationContext): boolean {
    const flag = this.flags.get(flagName);

    // Unknown flag: default to disabled (fail closed)
    if (!flag) {
      return false;
    }

    // Kill switch overrides everything
    if (flag.killSwitch) {
      return false;
    }

    // Base enabled check
    if (!flag.enabled) {
      return false;
    }

    // Evaluate targeting rules
    if (flag.targetingRules.length > 0) {
      return flag.targetingRules.some(rule => this.evaluateRule(rule, context));
    }

    return true;
  }

  private evaluateRule(rule: TargetingRule, ctx: EvaluationContext): boolean {
    const value = this.resolveAttribute(rule.attribute, ctx);

    switch (rule.operator) {
      case 'eq':
        return value === rule.value;
      case 'in':
        return Array.isArray(rule.value) && rule.value.includes(value);
      case 'percentage':
        // Consistent hashing for stable percentage rollout
        const hash = this.consistentHash(ctx.userId, rule.attribute);
        return hash < (rule.value as number);
      default:
        return false;
    }
  }

  private resolveAttribute(attr: string, ctx: EvaluationContext): any {
    switch (attr) {
      case 'userId': return ctx.userId;
      case 'tenantId': return ctx.tenantId;
      case 'role': return ctx.role;
      default: return ctx.attributes[attr];
    }
  }

  private consistentHash(userId: string, salt: string): number {
    const hash = crypto.createHash('sha256')
      .update(`${userId}:${salt}`)
      .digest();
    return (hash.readUInt32BE(0) % 100) / 100;
  }

  // Emergency kill switch -- instant disable
  async activateKillSwitch(flagName: string, activatedBy: string): Promise<void> {
    const flag = this.flags.get(flagName);
    if (!flag) throw new Error(`Flag ${flagName} not found`);

    flag.killSwitch = true;
    flag.updatedAt = new Date();
    flag.updatedBy = activatedBy;

    // Persist change
    await this.saveFlag(flag);

    // Audit log
    await this.auditLogger.log({
      eventType: 'feature_flag.kill_switch',
      actor: activatedBy,
      resource: flagName,
      details: { action: 'activated' },
    });

    // Clear all cached evaluations for this flag
    this.invalidateCache(flagName);
  }
}
```

---

## Pattern 5: Configuration as Code

### Theory

All configuration changes must be version-controlled, reviewed, and approved
before deployment. Use PR-based workflows for configuration changes just like
code changes.

```yaml
# config/production.yaml -- version controlled
# All changes require PR review from security team

server:
  port: 8080
  host: "0.0.0.0"
  shutdown_timeout: 15000

database:
  port: 5432
  ssl_mode: "verify-full"
  max_connections: 20

auth:
  token_expiry: 3600
  bcrypt_rounds: 12
  max_login_attempts: 5
  lockout_duration: 900

cors:
  allowed_origins:
    - "https://app.example.com"
    - "https://admin.example.com"
  max_age: 600

logging:
  level: "info"
  format: "json"
  redact_pii: true

features:
  debug_endpoints: false    # NEVER true in production
  swagger_ui: false         # NEVER true in production
  profiling: false          # NEVER true in production
```

```yaml
# .github/CODEOWNERS -- require security review for config changes
/config/production.yaml @security-team
/config/*.yaml @platform-team
```

---

## Pattern 6: Secrets vs Configuration Separation

### Theory

Secrets (passwords, API keys, private keys, connection strings with
credentials) must be stored separately from regular configuration. They
require different storage backends, different access controls, different
rotation policies, and different audit logging.

### TypeScript -- Secrets Manager Integration

```typescript
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

class SecretsLoader {
  private client: SecretsManagerClient;
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();
  private cacheTTL = 300_000; // 5 minutes

  constructor(region: string) {
    this.client = new SecretsManagerClient({ region });
  }

  async getSecret(name: string): Promise<string> {
    // Check cache (short TTL)
    const cached = this.cache.get(name);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const response = await this.client.send(
      new GetSecretValueCommand({ SecretId: name })
    );

    const value = response.SecretString;
    if (!value) {
      throw new Error(`Secret ${name} is empty`);
    }

    // Cache with short TTL
    this.cache.set(name, {
      value,
      expiresAt: Date.now() + this.cacheTTL,
    });

    return value;
  }

  async getSecretJSON<T>(name: string): Promise<T> {
    const value = await this.getSecret(name);
    return JSON.parse(value) as T;
  }
}

// Usage -- secrets loaded separately from config
async function initializeApp() {
  // Regular configuration from files/environment
  const config = loadConfig();

  // Secrets from secrets manager
  const secrets = new SecretsLoader('us-east-1');

  const dbPassword = await secrets.getSecret('production/database/password');
  const jwtSecret = await secrets.getSecret('production/auth/jwt-secret');
  const apiKeys = await secrets.getSecretJSON<Record<string, string>>(
    'production/integrations/api-keys'
  );

  // NEVER log secrets
  // console.log(dbPassword);  // NEVER DO THIS
  // NEVER put secrets in regular config files
  // NEVER commit secrets to version control
}
```

### Python -- Vault Integration

```python
import hvac
import os
from functools import lru_cache


class VaultSecretsLoader:
    def __init__(self):
        self.client = hvac.Client(
            url=os.environ['VAULT_ADDR'],
            token=os.environ['VAULT_TOKEN'],
        )

        if not self.client.is_authenticated():
            raise RuntimeError('Vault authentication failed')

    def get_secret(self, path: str, key: str) -> str:
        """Get a single secret value from Vault."""
        response = self.client.secrets.kv.v2.read_secret_version(
            path=path,
            mount_point='secret',
        )
        value = response['data']['data'].get(key)
        if value is None:
            raise KeyError(f'Secret key "{key}" not found at path "{path}"')
        return value

    def get_database_credentials(self, role: str) -> dict:
        """Get dynamic database credentials from Vault."""
        response = self.client.secrets.database.generate_credentials(
            name=role,
        )
        return {
            'username': response['data']['username'],
            'password': response['data']['password'],
            'lease_id': response['lease_id'],
            'lease_duration': response['lease_duration'],
        }


# Usage
vault = VaultSecretsLoader()

# Static secrets
jwt_secret = vault.get_secret('myapp/production', 'jwt_secret')

# Dynamic database credentials (auto-rotating)
db_creds = vault.get_database_credentials('myapp-production-readonly')
```

---

## Pattern 7: Configuration Drift Detection

### Theory

Configuration drift occurs when the actual configuration of a running system
diverges from the expected configuration. This can happen through manual
changes, failed deployments, or environment-specific overrides that were not
tracked. Detect drift by comparing running configuration against the expected
state and alerting on differences.

### TypeScript -- Drift Detection

```typescript
interface DriftReport {
  timestamp: string;
  service: string;
  environment: string;
  drifts: DriftItem[];
  status: 'clean' | 'drifted';
}

interface DriftItem {
  path: string;
  expected: any;
  actual: any;
  severity: 'critical' | 'warning' | 'info';
}

// Security-critical settings that trigger alerts when drifted
const CRITICAL_SETTINGS = new Set([
  'database.sslMode',
  'features.debugEndpoints',
  'features.profiling',
  'logging.redactPII',
  'auth.bcryptRounds',
  'cors.allowedOrigins',
]);

function detectConfigDrift(
  expected: Record<string, any>,
  actual: Record<string, any>,
  prefix: string = '',
): DriftItem[] {
  const drifts: DriftItem[] = [];

  for (const key of Object.keys(expected)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const expectedVal = expected[key];
    const actualVal = actual[key];

    if (typeof expectedVal === 'object' && expectedVal !== null && !Array.isArray(expectedVal)) {
      drifts.push(...detectConfigDrift(expectedVal, actualVal || {}, path));
      continue;
    }

    if (JSON.stringify(expectedVal) !== JSON.stringify(actualVal)) {
      drifts.push({
        path,
        expected: expectedVal,
        actual: actualVal,
        severity: CRITICAL_SETTINGS.has(path) ? 'critical' : 'warning',
      });
    }
  }

  return drifts;
}

// Run drift detection periodically
async function runDriftCheck(): Promise<DriftReport> {
  // Load expected configuration from version control
  const expected = await loadExpectedConfig();

  // Load actual running configuration
  const actual = await loadRunningConfig();

  const drifts = detectConfigDrift(expected, actual);

  const report: DriftReport = {
    timestamp: new Date().toISOString(),
    service: 'api-server',
    environment: process.env.NODE_ENV || 'unknown',
    drifts,
    status: drifts.length === 0 ? 'clean' : 'drifted',
  };

  // Alert on critical drifts
  const criticalDrifts = drifts.filter(d => d.severity === 'critical');
  if (criticalDrifts.length > 0) {
    await alertSecurityTeam({
      title: 'Critical configuration drift detected',
      details: criticalDrifts,
    });
  }

  return report;
}
```

---

## Pattern 8: Environment Isolation

### Theory

Each environment (development, staging, production) must use completely
separate credentials, separate network access, and separate data stores.
A compromised development environment must not provide access to production
systems.

```typescript
// Validate environment isolation at startup
function validateEnvironmentIsolation(config: AppConfig): void {
  const env = process.env.NODE_ENV || 'production';
  const errors: string[] = [];

  if (env === 'production') {
    // Production must not use development or staging resources
    if (config.database.host.includes('dev') || config.database.host.includes('staging')) {
      errors.push('Production cannot use dev/staging database');
    }
    if (config.redis.url.includes('dev') || config.redis.url.includes('staging')) {
      errors.push('Production cannot use dev/staging Redis');
    }
  }

  if (env === 'development') {
    // Development must not use production resources
    if (config.database.host.includes('prod')) {
      errors.push('Development cannot use production database');
    }
    if (config.redis.url.includes('prod')) {
      errors.push('Development cannot use production Redis');
    }
  }

  if (errors.length > 0) {
    console.error('FATAL: Environment isolation violation:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
}
```

### Go -- Environment Isolation Check

```go
func validateEnvironmentIsolation(cfg *Config, env string) error {
    var errors []string

    if env == "production" {
        if strings.Contains(cfg.Database.Host, "dev") ||
            strings.Contains(cfg.Database.Host, "staging") {
            errors = append(errors, "production cannot use dev/staging database")
        }
        if strings.Contains(cfg.Redis.URL, "dev") ||
            strings.Contains(cfg.Redis.URL, "staging") {
            errors = append(errors, "production cannot use dev/staging Redis")
        }
    }

    if env == "development" {
        if strings.Contains(cfg.Database.Host, "prod") {
            errors = append(errors, "development cannot use production database")
        }
    }

    if len(errors) > 0 {
        return fmt.Errorf("environment isolation violations:\n  %s",
            strings.Join(errors, "\n  "))
    }
    return nil
}
```

---

## Pattern 9: Immutable Configuration

### Theory

Once an application is deployed, its configuration must not change at runtime.
If configuration needs to change, redeploy the application. This prevents
configuration tampering and ensures that the running state matches the
deployed state.

### TypeScript -- Frozen Configuration

```typescript
function loadImmutableConfig(): Readonly<AppConfig> {
  const config = loadConfig();

  // Deep freeze the configuration object
  const frozen = deepFreeze(config);

  // Log the configuration hash for audit
  const configHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(frozen))
    .digest('hex');

  logger.info('Configuration loaded', {
    hash: configHash,
    environment: process.env.NODE_ENV,
  });

  return frozen;
}

function deepFreeze<T extends Record<string, any>>(obj: T): Readonly<T> {
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const value = (obj as any)[key];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

// The config singleton -- set once, never modified
let _config: Readonly<AppConfig> | null = null;

export function getConfig(): Readonly<AppConfig> {
  if (!_config) {
    _config = loadImmutableConfig();
  }
  return _config;
}

// Any attempt to modify will throw:
// getConfig().server.port = 9999; // TypeError: Cannot assign to read only property
```

### Go -- Immutable Configuration via Interface

```go
package config

// ConfigReader provides read-only access to configuration
type ConfigReader interface {
    ServerPort() int
    ServerHost() string
    DatabaseHost() string
    DatabasePort() int
    DatabaseName() string
    DatabaseSSLMode() string
    RedisURL() string
    LogLevel() string
    IsDebugEnabled() bool
}

// immutableConfig implements ConfigReader with no setters
type immutableConfig struct {
    cfg Config
}

func (c *immutableConfig) ServerPort() int         { return c.cfg.Server.Port }
func (c *immutableConfig) ServerHost() string      { return c.cfg.Server.Host }
func (c *immutableConfig) DatabaseHost() string    { return c.cfg.Database.Host }
func (c *immutableConfig) DatabasePort() int       { return c.cfg.Database.Port }
func (c *immutableConfig) DatabaseName() string    { return c.cfg.Database.Name }
func (c *immutableConfig) DatabaseSSLMode() string { return c.cfg.Database.SSLMode }
func (c *immutableConfig) RedisURL() string        { return c.cfg.Redis.URL }
func (c *immutableConfig) LogLevel() string        { return c.cfg.Logging.Level }
func (c *immutableConfig) IsDebugEnabled() bool    { return c.cfg.Features.DebugEndpoints }

// LoadImmutable loads config and returns a read-only interface
func LoadImmutable() ConfigReader {
    cfg := Load()
    return &immutableConfig{cfg: *cfg}
}
```

---

## Pattern 10: Default Configuration Security

### Theory

Every configuration option must have a secure default. If a developer does not
explicitly set a value, the application must use the most restrictive safe
option. Document all security-relevant settings so developers understand the
impact of overriding defaults.

```typescript
// Document security impact of each setting
const SECURITY_RELEVANT_SETTINGS = {
  'database.sslMode': {
    default: 'verify-full',
    impact: 'Controls TLS verification for database connections. ' +
      'Setting to "disable" allows plaintext connections. ' +
      'Setting to "require" allows unverified TLS.',
    recommendation: 'Always use "verify-full" in production.',
  },
  'features.debugEndpoints': {
    default: false,
    impact: 'Enables /debug/pprof and /debug/vars endpoints. ' +
      'These expose memory profiles, goroutine dumps, and internal metrics.',
    recommendation: 'Never enable in production. Use separate monitoring.',
  },
  'auth.bcryptRounds': {
    default: 12,
    impact: 'Controls password hashing cost. Lower values are faster to crack. ' +
      'Each increment doubles computation time.',
    recommendation: 'Use 12+ in production. Adjust based on hardware.',
  },
  'logging.redactPII': {
    default: true,
    impact: 'Controls automatic redaction of PII in logs. ' +
      'When disabled, emails, IPs, and other PII may appear in logs.',
    recommendation: 'Always enable. GDPR/CCPA compliance requirement.',
  },
  'cors.allowedOrigins': {
    default: '(none -- must be explicitly set)',
    impact: 'Controls which domains can make cross-origin requests. ' +
      'Setting to ["*"] allows any website to make authenticated requests.',
    recommendation: 'List specific, trusted origins only.',
  },
};
```

---

## Best Practices

1. **Validate all configuration at startup**: The application must refuse to
   start if any required configuration is missing, out of range, or invalid.
   A misconfigured running application is worse than a stopped one.

2. **Separate secrets from configuration**: Store secrets in a secrets manager
   (Vault, AWS Secrets Manager, etc.) and regular configuration in config
   files or environment variables. Different storage, different access
   controls.

3. **Default to the most secure option**: Every configuration option must
   have a secure default. Debug mode off, TLS required, PII redaction
   enabled, strict CORS -- all by default.

4. **Version-control all configuration**: Configuration files must be in
   version control with PR-based review workflows. Security-relevant
   changes must be reviewed by the security team.

5. **Prevent dangerous settings in production**: Add explicit guards that
   prevent debug mode, profiling, disabled TLS, and verbose logging from
   being enabled in production -- even if a developer tries.

6. **Isolate environments completely**: Development, staging, and production
   must use separate credentials, networks, and data stores. Validate
   isolation at startup.

7. **Detect configuration drift**: Periodically compare running configuration
   against expected state. Alert on deviations, especially for
   security-critical settings.

8. **Make configuration immutable after startup**: Freeze the configuration
   object to prevent runtime modification. If configuration needs to change,
   redeploy.

9. **Cache secrets with short TTL**: When loading secrets from external
   stores, cache them briefly (5 minutes) to reduce latency, but expire
   quickly to pick up rotations.

10. **Audit all configuration changes**: Log who changed what configuration,
    when, and through which mechanism (PR, API, manual). This is essential
    for incident investigation.

---

## Anti-Patterns

1. **Hardcoded secrets**: Embedding passwords, API keys, or tokens directly
   in source code. These end up in version control history and are nearly
   impossible to fully remove.

2. **Shared credentials across environments**: Using the same database password
   for development and production. A compromised development environment
   immediately compromises production.

3. **No startup validation**: Applications that start successfully with
   missing or invalid configuration, then fail at runtime when the
   misconfigured feature is first used.

4. **Configuration via code changes**: Requiring code changes and deployments
   to update configuration values. Configuration should be external to
   the codebase.

5. **Unrestricted environment variable access**: Any code in the application
   can read any environment variable. Instead, load configuration once at
   startup and inject through dependency injection.

6. **No configuration documentation**: Security-relevant settings without
   documentation about their impact. Developers override defaults without
   understanding the security consequences.

7. **Mutable configuration**: Configuration objects that can be modified at
   runtime. A bug or vulnerability could change security settings while
   the application is running.

8. **Long-lived secret caches**: Caching secrets for hours or days. When
   secrets are rotated (e.g., after a breach), the application continues
   using the compromised secret until the cache expires.

---

## Enforcement Checklist

### Configuration Loading
- [ ] Configuration loaded from files + environment variables
- [ ] Environment-specific overrides are supported
- [ ] Configuration is validated at startup (fail fast)
- [ ] All required fields are checked
- [ ] Value ranges are validated
- [ ] URLs and connection strings are validated

### Secrets Management
- [ ] Secrets stored in a dedicated secrets manager (not config files)
- [ ] Secrets never logged or exposed in error messages
- [ ] Secrets never committed to version control
- [ ] Secret rotation is supported without downtime
- [ ] Each environment has separate secrets

### Production Safety
- [ ] Debug mode cannot be enabled in production
- [ ] Profiling cannot be enabled in production
- [ ] Database SSL cannot be disabled in production
- [ ] Debug logging cannot be enabled in production
- [ ] CORS is restricted to specific origins

### Feature Flags
- [ ] Flags evaluated server-side only
- [ ] Kill switches available for emergency disable
- [ ] Flag changes are audit logged
- [ ] Unknown flags default to disabled

### Operational
- [ ] Configuration is version-controlled
- [ ] Security-relevant changes require security review
- [ ] Configuration drift is detected and alerted
- [ ] Configuration is immutable after startup
- [ ] Environment isolation is validated at startup
- [ ] Configuration hash is logged for audit
