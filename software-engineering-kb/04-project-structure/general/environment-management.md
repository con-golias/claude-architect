# Environment Management — Complete Specification

> **AI Plugin Directive:** When a developer asks "how do I manage different environments?", "how do I set up dev/staging/prod?", or "how do I achieve environment parity?", use this directive. Environment management is the practice of maintaining multiple deployment targets (development, staging, production, testing) with CONSISTENT configuration structure but DIFFERENT values. The goal is environment parity — your dev environment should mirror production as closely as possible. Differences between environments cause bugs that only appear in production.

---

## 1. The Core Rule

**Every environment MUST use the SAME configuration structure, the SAME code, and the SAME infrastructure topology. The ONLY things that change between environments are VALUES — connection strings, API keys, feature flags, and scaling parameters. If code behaves differently in dev vs prod due to structural config differences, your environment management is BROKEN.**

```
❌ WRONG: Different config structure per environment
// development
config = { db: { host: 'localhost', port: 5432, user: 'dev' } }

// production (different structure!)
config = { db: { connectionString: 'postgresql://prod:xxx@db.internal:5432/app' } }

✅ CORRECT: Same structure, different values
// development
DATABASE_URL=postgresql://dev:dev@localhost:5432/myapp_dev

// production
DATABASE_URL=postgresql://prod:xxx@db.internal:5432/myapp_prod
```

---

## 2. The Standard Environments

```
┌──────────────────┬────────────────────────────────────────────────────────┐
│ Environment      │ Purpose                                                │
├──────────────────┼────────────────────────────────────────────────────────┤
│ development      │ Local developer machine. Fast iteration, debugging.    │
│ (local)          │ Uses local services (Docker Compose) or mocks.         │
│                  │ NEVER connects to production data.                     │
├──────────────────┼────────────────────────────────────────────────────────┤
│ test             │ Automated test execution. CI/CD pipelines.             │
│ (ci)             │ In-memory databases, mocked external services.         │
│                  │ Must be deterministic and fast.                        │
├──────────────────┼────────────────────────────────────────────────────────┤
│ staging          │ Pre-production validation. Mirrors production topology.│
│ (pre-prod)       │ Real databases, real services, synthetic data.         │
│                  │ Used for QA, integration testing, performance testing. │
├──────────────────┼────────────────────────────────────────────────────────┤
│ production       │ Live user-facing environment. Real data, real traffic. │
│ (prod)           │ Maximum security, monitoring, alerting.                │
│                  │ Zero tolerance for config errors.                      │
├──────────────────┼────────────────────────────────────────────────────────┤
│ preview          │ Per-PR ephemeral environments (Vercel, Netlify).       │
│ (pr-preview)     │ Auto-deployed on PR creation, auto-destroyed on merge.│
│                  │ Uses staging-like config with isolated resources.      │
└──────────────────┴────────────────────────────────────────────────────────┘
```

---

## 3. Environment Parity (The 12-Factor Principle)

### The Three Gaps That Kill You

```
┌─────────────────┬──────────────────────────────────────────────────────┐
│ Gap             │ Problem                                              │
├─────────────────┼──────────────────────────────────────────────────────┤
│ Time Gap        │ Dev works on code for weeks before it reaches prod.  │
│                 │ FIX: Deploy frequently (daily or continuous).         │
├─────────────────┼──────────────────────────────────────────────────────┤
│ Personnel Gap   │ Devs write code, ops deploy it. Different knowledge. │
│                 │ FIX: DevOps culture. Devs own deployment.            │
├─────────────────┼──────────────────────────────────────────────────────┤
│ Tools Gap       │ Dev uses SQLite, prod uses PostgreSQL.               │
│                 │ Dev uses macOS, prod uses Linux.                     │
│                 │ FIX: Same backing services in all environments.      │
└─────────────────┴──────────────────────────────────────────────────────┘

RULE: NEVER use a different database in dev than production.
  ❌ Dev: SQLite    → Prod: PostgreSQL  (different SQL dialects!)
  ❌ Dev: H2        → Prod: MySQL       (different behavior!)
  ✅ Dev: PostgreSQL → Prod: PostgreSQL  (same engine, same behavior)

RULE: Use Docker Compose to run production-equivalent services locally.
```

### Docker Compose for Local Environment Parity

```yaml
# docker-compose.yml — matches production service topology
services:
  db:
    image: postgres:16-alpine        # Same major version as production
    environment:
      POSTGRES_DB: myapp_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine            # Same as production
    ports:
      - "6379:6379"

  localstack:                        # Mock AWS services locally
    image: localstack/localstack
    ports:
      - "4566:4566"
    environment:
      SERVICES: s3,sqs,ses

  mailhog:                           # Local email testing (no real emails sent)
    image: mailhog/mailhog
    ports:
      - "1025:1025"                  # SMTP
      - "8025:8025"                  # Web UI

volumes:
  postgres_data:
```

---

## 4. Environment-Specific Configuration Files

### Node.js / TypeScript

```
project/
├── .env                    ← Shared defaults (committed)
├── .env.development        ← Dev-specific (committed, no secrets)
├── .env.staging            ← Staging-specific (committed, no secrets)
├── .env.production         ← Prod-specific (committed, no secrets)
├── .env.test               ← Test-specific (committed, no secrets)
├── .env.local              ← Local overrides (gitignored)
└── .env.example            ← Template (committed)
```

```bash
# .env (shared defaults)
LOG_FORMAT=json
FEATURE_NEW_CHECKOUT=false

# .env.development
LOG_LEVEL=debug
LOG_FORMAT=pretty
API_RATE_LIMIT=1000
DATABASE_POOL_SIZE=5

# .env.staging
LOG_LEVEL=info
API_RATE_LIMIT=100
DATABASE_POOL_SIZE=10

# .env.production
LOG_LEVEL=warn
API_RATE_LIMIT=50
DATABASE_POOL_SIZE=25
DATABASE_SSL=true

# .env.test
LOG_LEVEL=error
DATABASE_URL=postgresql://test:test@localhost:5432/myapp_test
REDIS_URL=redis://localhost:6379/1
```

### Python / Django

```python
# config/settings/base.py — shared settings
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SECRET_KEY = os.environ['DJANGO_SECRET_KEY']
INSTALLED_APPS = [...]
MIDDLEWARE = [...]

# config/settings/development.py
from .base import *

DEBUG = True
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'HOST': os.environ.get('DATABASE_HOST', 'localhost'),
        'PORT': os.environ.get('DATABASE_PORT', '5432'),
        'NAME': os.environ.get('DATABASE_NAME', 'myapp_dev'),
        'USER': os.environ.get('DATABASE_USER', 'dev'),
        'PASSWORD': os.environ.get('DATABASE_PASSWORD', 'dev'),
    }
}
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# config/settings/production.py
from .base import *

DEBUG = False
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'HOST': os.environ['DATABASE_HOST'],
        'PORT': os.environ.get('DATABASE_PORT', '5432'),
        'NAME': os.environ['DATABASE_NAME'],
        'USER': os.environ['DATABASE_USER'],
        'PASSWORD': os.environ['DATABASE_PASSWORD'],
        'OPTIONS': {'sslmode': 'require'},
    }
}
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

```bash
# Set environment via DJANGO_SETTINGS_MODULE
export DJANGO_SETTINGS_MODULE=config.settings.development
# or
export DJANGO_SETTINGS_MODULE=config.settings.production
```

### Spring Boot

```yaml
# application.yml — shared defaults
spring:
  application:
    name: my-service
server:
  port: 8080

---
# application-dev.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/myapp_dev
    username: dev
    password: dev
  jpa:
    show-sql: true
    hibernate:
      ddl-auto: update

---
# application-staging.yml
spring:
  datasource:
    url: ${DATABASE_URL}
    username: ${DATABASE_USER}
    password: ${DATABASE_PASSWORD}
  jpa:
    show-sql: false
    hibernate:
      ddl-auto: validate

---
# application-prod.yml
spring:
  datasource:
    url: ${DATABASE_URL}
    username: ${DATABASE_USER}
    password: ${DATABASE_PASSWORD}
    hikari:
      maximum-pool-size: 25
  jpa:
    show-sql: false
    hibernate:
      ddl-auto: none
```

```bash
# Activate profile
java -jar app.jar --spring.profiles.active=dev
# or
SPRING_PROFILES_ACTIVE=prod java -jar app.jar
```

### .NET

```json
// appsettings.json — shared defaults
{
  "Logging": { "LogLevel": { "Default": "Information" } },
  "AllowedHosts": "*"
}

// appsettings.Development.json
{
  "Logging": { "LogLevel": { "Default": "Debug" } },
  "ConnectionStrings": {
    "Default": "Host=localhost;Database=myapp_dev;Username=dev;Password=dev"
  }
}

// appsettings.Staging.json
{
  "Logging": { "LogLevel": { "Default": "Information" } }
}

// appsettings.Production.json (no secrets!)
{
  "Logging": { "LogLevel": { "Default": "Warning" } }
}
```

```csharp
// Program.cs — .NET environment resolution
var builder = WebApplication.CreateBuilder(args);
// Automatically loads: appsettings.json → appsettings.{ASPNETCORE_ENVIRONMENT}.json
// Set via: ASPNETCORE_ENVIRONMENT=Production
```

---

## 5. Environment Detection

### How to Determine the Current Environment

```typescript
// Node.js — the NODE_ENV convention
const env = process.env.NODE_ENV || 'development';

// RULE: NEVER use NODE_ENV for application config decisions
//       NODE_ENV is for frameworks (React build modes, Express optimizations)
//       Use a separate APP_ENV or ENVIRONMENT variable for your app

// ❌ WRONG: Business logic depends on NODE_ENV
if (process.env.NODE_ENV === 'production') {
  enableRateLimiting();  // What about staging? Test?
}

// ✅ CORRECT: Business logic depends on config values
if (config.rateLimiting.enabled) {
  enableRateLimiting();
}
```

```python
# Python — ENVIRONMENT variable
import os

ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')

# Django uses DJANGO_SETTINGS_MODULE
# Flask uses FLASK_ENV (deprecated) or FLASK_DEBUG
# FastAPI uses custom ENVIRONMENT variable
```

```go
// Go — explicit environment variable
env := os.Getenv("ENVIRONMENT")
if env == "" {
    env = "development"
}
```

### Environment Variable Naming

```
┌──────────────────────────┬─────────────────────────────────┐
│ Convention               │ Framework                        │
├──────────────────────────┼─────────────────────────────────┤
│ NODE_ENV                 │ Node.js / Express / React        │
│ RAILS_ENV                │ Ruby on Rails                    │
│ FLASK_ENV (deprecated)   │ Flask (use FLASK_DEBUG instead)  │
│ DJANGO_SETTINGS_MODULE   │ Django                           │
│ ASPNETCORE_ENVIRONMENT   │ .NET / ASP.NET Core              │
│ SPRING_PROFILES_ACTIVE   │ Spring Boot                      │
│ MIX_ENV                  │ Elixir / Phoenix                 │
│ ENVIRONMENT              │ Custom / generic                 │
│ APP_ENV                  │ Laravel / custom                 │
└──────────────────────────┴─────────────────────────────────┘
```

---

## 6. CI/CD Environment Configuration

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main, staging]

jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    environment: staging              # Links to GitHub Environment "staging"
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Staging
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}      # From staging environment
          STRIPE_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          ENVIRONMENT: staging
        run: ./deploy.sh

  deploy-production:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://myapp.com
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Production
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}      # From production environment
          STRIPE_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          ENVIRONMENT: production
        run: ./deploy.sh
```

### Kubernetes — Per-Environment Namespaces

```yaml
# k8s/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    spec:
      containers:
        - name: myapp
          image: myapp:latest
          envFrom:
            - configMapRef:
                name: myapp-config
            - secretRef:
                name: myapp-secrets

---
# k8s/overlays/staging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: staging
bases:
  - ../../base
patchesStrategicMerge:
  - deployment-patch.yaml
configMapGenerator:
  - name: myapp-config
    literals:
      - ENVIRONMENT=staging
      - LOG_LEVEL=info
      - DATABASE_POOL_SIZE=10

---
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: production
bases:
  - ../../base
patchesStrategicMerge:
  - deployment-patch.yaml
configMapGenerator:
  - name: myapp-config
    literals:
      - ENVIRONMENT=production
      - LOG_LEVEL=warn
      - DATABASE_POOL_SIZE=25
```

---

## 7. Preview Environments (Per-PR)

### Vercel / Netlify Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│ Branch         │ Environment      │ URL                          │
├─────────────────────────────────────────────────────────────────┤
│ main           │ Production       │ https://myapp.com            │
│ staging        │ Staging          │ https://staging.myapp.com    │
│ feature/xyz    │ Preview          │ https://feature-xyz.myapp.com│
│ PR #123        │ Preview          │ https://pr-123.myapp.com     │
└─────────────────────────────────────────────────────────────────┘

RULE: Preview environments use staging-like config with isolated resources.
RULE: Preview databases are ephemeral — destroyed when PR is merged/closed.
RULE: Preview environments NEVER share databases with staging or production.
```

```typescript
// next.config.ts — environment-aware configuration
const config = {
  // Vercel provides VERCEL_ENV: 'production' | 'preview' | 'development'
  env: {
    API_URL: process.env.VERCEL_ENV === 'production'
      ? 'https://api.myapp.com'
      : process.env.VERCEL_ENV === 'preview'
        ? `https://api-preview.myapp.com`
        : 'http://localhost:3001',
  },
};
```

---

## 8. Environment Comparison Matrix

```
┌──────────────────────┬────────────┬────────────┬────────────┬────────────┐
│ Aspect               │ Dev        │ Test       │ Staging    │ Production │
├──────────────────────┼────────────┼────────────┼────────────┼────────────┤
│ Database             │ Local PG   │ In-memory  │ Real PG    │ Real PG    │
│                      │ (Docker)   │ or test PG │ (isolated) │ (managed)  │
│ External APIs        │ Mocks/stubs│ Mocks      │ Sandbox    │ Live       │
│ Email                │ Mailhog    │ /dev/null  │ Sandbox    │ Real SMTP  │
│ File storage         │ Local disk │ /tmp       │ S3 bucket  │ S3 bucket  │
│ Queue                │ In-memory  │ In-memory  │ Real SQS   │ Real SQS   │
│ SSL/TLS              │ Self-signed│ None       │ Real cert  │ Real cert  │
│ Debug logging        │ ON         │ OFF        │ OFF        │ OFF        │
│ Source maps          │ ON         │ OFF        │ ON         │ OFF        │
│ Error detail         │ Full stack │ Assertions │ Full stack │ Generic    │
│ Rate limiting        │ OFF        │ OFF        │ ON (loose) │ ON (strict)│
│ Replicas             │ 1          │ 1          │ 2          │ 3+         │
│ Auto-scaling         │ OFF        │ OFF        │ OFF        │ ON         │
│ Monitoring/alerting  │ OFF        │ OFF        │ ON         │ ON         │
│ Data                 │ Seed data  │ Fixtures   │ Synthetic  │ Real users │
└──────────────────────┴────────────┴────────────┴────────────┴────────────┘
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **"Works on my machine"** | Bug only appears in production, not locally | Use Docker Compose for parity; same DB, same OS |
| **Different DBs per env** | SQLite in dev, PostgreSQL in prod | ALWAYS use production database engine locally |
| **No staging environment** | Code goes directly from dev to production | Add staging as mandatory step before production |
| **Shared staging database** | Multiple devs' branches corrupt staging data | Isolated databases per environment/PR |
| **Env-specific code paths** | `if (env === 'production')` in business logic | Use config values and feature flags, not env checks |
| **Manual environment setup** | New dev spends 2 days setting up local env | Docker Compose + `.env.example` + setup script |
| **Config drift** | Staging has vars that production doesn't | Use same `.env.example` for all environments |
| **No preview environments** | QA tests on shared staging, blocking releases | Per-PR preview environments (Vercel, Render, etc.) |
| **Hardcoded URLs** | `fetch('https://api.myapp.com')` in frontend | Use `API_URL` environment variable |
| **Missing test environment** | Tests run against dev database, destroying data | Separate test database, reset between test runs |

---

## 10. Enforcement Checklist

- [ ] **Same config structure** — all environments use identical config schema
- [ ] **Same backing services** — dev uses same database engine as production
- [ ] **Docker Compose for local** — all dependencies run via `docker compose up`
- [ ] **Setup script exists** — new dev runs one command to set up local env
- [ ] **.env.example maintained** — documents ALL required environment variables
- [ ] **No env-specific code** — no `if (NODE_ENV === 'production')` in business logic
- [ ] **Staging mirrors production** — same topology, services, and config structure
- [ ] **Preview environments** — PR-based ephemeral environments for QA
- [ ] **Secrets per environment** — production secrets NEVER shared with staging/dev
- [ ] **Environment variable for detection** — `ENVIRONMENT` or framework equivalent set
- [ ] **CI/CD per environment** — separate deployment pipelines for staging and production
- [ ] **Monitoring in staging** — same alerting rules as production (less strict thresholds)
