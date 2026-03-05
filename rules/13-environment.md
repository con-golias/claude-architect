---
mode: auto
---
## Environment & Configuration Management

### Environment Hierarchy
- development: local developer machine, debug enabled, mock external services
- test: CI/CD pipeline, test database, deterministic data
- staging: production-like, real services (sandbox accounts), manual QA
- production: live environment, real data, monitoring active

### Configuration Rules
- ALL configuration via environment variables — never in source code
- Use .env files for local development ONLY — never commit to Git
- Provide .env.example with all required variables (no real values)
- Validate ALL required config at application startup — fail fast with clear errors
- Type-check configuration values: numbers parsed as numbers, booleans as booleans
- Group related config: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

### Configuration Schema (Required)
Define a configuration schema/validator that:
- Lists every environment variable the application needs
- Specifies type, required/optional, default value
- Validates on startup and throws descriptive errors
- Documents purpose of each variable

### Environment Parity
- Development must mirror production as closely as possible
- Use same database type in development as production (not SQLite vs PostgreSQL)
- Use Docker/containers for local development dependencies
- Document ALL external service dependencies and how to set up locally

### Feature Flags
- Use feature flags for gradual rollouts and A/B testing
- Store flags in configuration/database — not hardcoded if/else
- Default: feature OFF — explicitly enable
- Clean up feature flags after full rollout (add removal date)
- Log feature flag state for debugging

### Secrets Hierarchy
- Local development: .env file (gitignored)
- CI/CD: pipeline secret variables
- Staging/Production: secrets manager (Vault, AWS Secrets Manager, GCP Secret Manager)
- Rotate secrets on schedule — design for zero-downtime rotation
- Audit secret access

### Docker / Container Standards (When Applicable)
- Use multi-stage builds for smaller images
- Run as non-root user inside containers
- Pin base image versions — never use :latest
- Health check in Dockerfile
- .dockerignore mirrors .gitignore + excludes docs, tests, dev files
