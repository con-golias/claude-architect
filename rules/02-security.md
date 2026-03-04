## Security Rules (ALWAYS ENFORCED — No Exceptions)

### Input Validation
- Validate ALL input server-side: type, length, format, range, business rules
- Use ALLOWLIST validation (define what IS allowed), never BLOCKLIST
- Validate at the controller/API boundary BEFORE passing to use cases
- Use schema validation libraries (Zod, Joi, Pydantic, marshmallow) — never manual checks
- Reject unexpected fields — do not silently ignore extra input

### SQL & Data Access
- NEVER construct SQL via string concatenation or template literals with user data
- Use parameterized queries / prepared statements ONLY
- Use ORM query builders for complex queries — never raw SQL with user input
- Apply principle of least privilege to database accounts (read-only where possible)

### Authentication & Session
- Hash passwords with bcrypt/argon2 — NEVER store plaintext or MD5/SHA
- Use short-lived JWT access tokens (15-30 min) + longer refresh tokens
- Validate JWT signature, expiration, issuer, and audience on every request
- Implement token revocation for logout and password changes
- Set secure cookie flags: HttpOnly, Secure, SameSite=Strict
- Rate-limit login attempts — implement exponential backoff or account lockout

### Authorization
- Authorize EVERY request server-side — never trust client-side checks
- Default deny: start with no permissions, explicitly grant
- Implement RBAC (Role-Based Access Control) as minimum baseline
- Check resource ownership: users can only access their own data unless explicitly authorized
- Log all authorization failures with user ID and attempted resource

### Secrets & Configuration
- NEVER hardcode secrets, API keys, passwords, or tokens in source code
- Use environment variables or a secrets manager (Vault, AWS Secrets Manager)
- Validate ALL required secrets exist at application startup — fail fast if missing
- Rotate secrets regularly — design for zero-downtime rotation
- Never log secrets, tokens, passwords, PII, or credit card numbers

### HTTP Security Headers (Set on EVERY response)
- Content-Security-Policy: restrict resource loading
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY (or SAMEORIGIN if iframes needed)
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: restrict browser features

### Output Encoding
- Never use dangerouslySetInnerHTML / v-html / innerHTML with user content
- Sanitize all user-generated content before rendering
- Use context-appropriate encoding (HTML, URL, JS, CSS)
- Never expose stack traces, SQL errors, or internal state in error messages
- Return generic error messages to clients — log details server-side

### File Upload Security
- Validate file type by content (magic bytes), not just extension
- Limit file size with hard server-side limits
- Store uploads outside web root — serve via controlled endpoint
- Scan uploaded files for malware when possible
- Generate random filenames — never use user-provided filenames directly

### API Security
- Use HTTPS everywhere — redirect HTTP to HTTPS
- Implement rate limiting on all public endpoints
- Use CORS with explicit origin allowlist — never allow *
- Include request IDs in responses for traceability
- Implement request size limits
