## Error Handling & Logging Standards

### Error Handling Principles
- Fail fast: validate inputs at function entry with specific error types
- Use SPECIFIC exception/error types — never bare catch(error)/except Exception in production
- Never swallow exceptions silently — every catch must: handle, log+rethrow, or translate
- Translate infrastructure errors to domain errors at boundary crossings
- Return user-friendly messages to clients — log technical details server-side
- Include correlation/request IDs in all error responses for traceability

### Error Type Hierarchy
Define a standard error hierarchy for the application:
```
AppError (base)
├── ValidationError     (400 — invalid input)
├── AuthenticationError (401 — not authenticated)
├── AuthorizationError  (403 — not authorized)
├── NotFoundError       (404 — resource not found)
├── ConflictError       (409 — duplicate/version conflict)
├── BusinessRuleError   (422 — valid input, business rule violation)
├── ExternalServiceError(502 — third-party service failure)
└── InternalError       (500 — unexpected system error)
```
- Each error type carries: code (machine-readable), message (human-readable), details (optional)
- Controllers map error types to HTTP status codes automatically
- Use cases throw domain/application errors — never HTTP-specific errors

### Logging Standards
- Use structured logging (JSON format) — never unstructured console.log in production
- Required fields: timestamp, level, service, message, correlationId
- Log levels used correctly:
  - ERROR: requires immediate human attention (system failure, data corruption)
  - WARN: handled anomaly, potential problem (retry succeeded, deprecation warning)
  - INFO: significant business events (user registered, order placed, payment processed)
  - DEBUG: diagnostic details (query parameters, function entry/exit, cache hit/miss)
- DEBUG level disabled in production by default

### What to Log (System Boundaries)
- ALL incoming HTTP requests: method, path, status, duration, requestId
- ALL outgoing HTTP calls: target, method, status, duration
- ALL database operations: query type, table, duration (NOT the data itself)
- ALL errors with full context: error type, message, stack trace, relevant IDs
- ALL authentication events: login success/failure, token refresh, logout
- ALL authorization failures: userId, attempted resource, action

### What to NEVER Log
- Passwords, tokens, API keys, secrets
- Credit card numbers, SSNs, or any PII beyond what's necessary
- Full request/response bodies in production (use DEBUG level only)
- SQL query parameters containing user data

### Correlation ID Flow
- Generate unique requestId at API gateway/entry point
- Pass correlationId through ALL downstream calls (headers, context)
- Include correlationId in ALL log entries for request tracing
- Return requestId in API error responses
- Store correlationId in async job metadata for background processing

### Global Error Handler
- Implement a global error handler/middleware that catches all unhandled errors
- Log the full error with stack trace
- Return standardized error response format to client
- Send alerts for 500-level errors in production
- Never expose stack traces or internal details to clients
