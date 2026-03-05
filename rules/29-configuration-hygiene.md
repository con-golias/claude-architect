## Configuration Hygiene

### No Magic Values
- NEVER hardcode URLs, ports, timeouts, retry counts, batch sizes, or thresholds in source code
- Extract every tunable value to configuration — even if there is only one environment today
- Name configuration variables descriptively: `ORDER_PROCESSING_TIMEOUT_MS`, not `TIMEOUT`
- Group related variables with a common prefix: `DB_HOST`, `DB_PORT`, `DB_MAX_CONNECTIONS`
- Document units in the variable name or comment: `_MS` for milliseconds, `_BYTES` for bytes, `_COUNT` for quantities

### Configuration Layering & Precedence
- Apply configuration in this order (later overrides earlier):
  - Hardcoded defaults in config schema (safe fallbacks for non-critical settings)
  - Configuration file (`config.yaml`, `config.json`) — environment-specific, gitignored
  - Environment variables — standard for containers and CI
  - Command-line arguments — for one-off overrides during debugging
- Document the precedence order in the project README or config module
- NEVER mix configuration sources silently — log which source each value was resolved from at startup (DEBUG level)

### Startup Validation
- Validate ALL configuration at application startup — before any server starts listening
- Use a typed config schema (Zod, Joi, Pydantic, JSON Schema) that:
  - Declares every variable with its type, constraints, and default
  - Rejects unknown variables to catch typos early
  - Returns ALL validation errors at once — not one at a time
- Fail fast with a clear, actionable error listing every invalid or missing variable
- NEVER silently fall back to defaults for required production values (database URL, API keys)
- Export a typed config object consumed by the rest of the application — never read `process.env` directly outside the config module

### Secrets vs Configuration Separation
- Secrets (API keys, DB passwords, signing keys) MUST be stored in a secrets manager — not in config files
- Non-secret configuration (feature flags, timeouts, URLs) can live in config files or environment variables
- NEVER mix secrets and non-secrets in the same file or store
- Access secrets through a dedicated secrets module that handles caching and rotation
- Log configuration values at startup — NEVER log secret values (mask with `***`)
- Implement zero-downtime secret rotation: accept old and new values during a transition window

### Feature Flags (Lifecycle Management)
- Every feature flag MUST have: owner, creation date, expected removal date, and description
- Default ALL flags to OFF — explicitly enable per environment
- Support targeting: enable per user, percentage rollout, or environment
- Implement kill switches: critical features MUST be disableable without a deployment
- Clean up flags within 30 days of full rollout — track in backlog with a deadline
- NEVER nest feature flags (flag A depends on flag B) — each flag is independent

### Configuration Change Auditing
- Log every configuration change with: who, when, old value, new value
- For runtime-reloadable config, emit an event or log entry when values change
- Store configuration snapshots per deployment for rollback comparison
- Document every configuration variable: purpose, valid values, impact of misconfiguration
- Review configuration drift between environments as part of release checklist
