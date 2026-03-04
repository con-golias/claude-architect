---
paths:
  - "src/**/auth/**"
  - "src/**/authentication/**"
  - "src/**/authorization/**"
  - "src/**/middleware/**"
---
## Authentication & Authorization Patterns

### Authentication Architecture
- Centralize authentication logic — single auth service/module
- Use OAuth 2.0 + OpenID Connect for third-party authentication
- JWTs for stateless API authentication:
  - Short-lived access tokens (15-30 minutes)
  - Longer-lived refresh tokens (7-30 days, stored securely)
  - Sign with RS256 (asymmetric) — never HS256 in production with shared secrets
  - Validate: signature, exp, iss, aud on EVERY request
- Implement token refresh flow transparently in API client
- Handle token expiration gracefully in frontend

### Password Security
- Hash with bcrypt (cost factor 12+) or argon2id — NEVER MD5/SHA/plaintext
- Enforce minimum password complexity: 12+ characters
- Check against breached password lists (HaveIBeenPwned API)
- Implement rate limiting on login: max 5 attempts per 15 minutes
- Use constant-time comparison for password verification
- Never reveal whether email or password was wrong: "Invalid credentials"

### Authorization Model (RBAC Baseline)
- Define roles: each role has explicit permissions
- Default DENY: no access unless explicitly granted
- Check permissions at:
  1. API middleware (route-level: does this role have access to this endpoint?)
  2. Use case level (business-level: can this user perform this action on this resource?)
  3. Data level (row-level: does this user own this resource?)
- Store roles and permissions in database — not hardcoded
- Audit trail: log all permission changes

### Session Security
- Set cookie flags: HttpOnly, Secure, SameSite=Strict
- Implement CSRF protection for cookie-based auth
- Session timeout: idle timeout (30 min) + absolute timeout (24 hours)
- Invalidate all sessions on password change
- Limit concurrent sessions per user (configurable)

### API Key Management (For Service-to-Service)
- Use API keys for server-to-server authentication
- Scope API keys to specific permissions — never use master keys
- Support key rotation without downtime (accept old + new during transition)
- Store API keys hashed in database — show to user only once on creation
- Set expiration dates on API keys

### Multi-Tenancy Security
- Tenant isolation at database query level — EVERY query must include tenant filter
- Never rely on application logic alone for tenant isolation
- Validate tenant context on every request
- Prevent cross-tenant data access in all API endpoints
- Test tenant isolation explicitly in integration tests
