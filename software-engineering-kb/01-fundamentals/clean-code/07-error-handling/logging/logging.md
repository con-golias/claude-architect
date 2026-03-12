# Logging

> **Domain:** Fundamentals > Clean Code > Error Handling
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Logging is the practice of recording events, state changes, and errors during program execution. In clean code, logging is a **cross-cutting concern** that should be handled systematically, not sprinkled ad-hoc throughout business logic.

Modern logging has evolved from simple `console.log` to **structured logging** (JSON format) integrated with **observability platforms** (the three pillars: logs, metrics, traces).

### Log Levels

| Level | Purpose | Example |
|-------|---------|---------|
| **TRACE** | Extremely detailed diagnostic info | Method entry/exit, variable values |
| **DEBUG** | Diagnostic info for developers | SQL queries, cache hits/misses |
| **INFO** | General operational events | Server started, user registered |
| **WARN** | Potential issues, not failures | Deprecated API called, slow query |
| **ERROR** | Failures that need attention | Payment failed, DB connection lost |
| **FATAL** | Application cannot continue | Out of memory, config missing |

## Why It Matters

Logs are often the only way to understand what happened in production. Poor logging means hours of blind debugging. Good logging means finding the root cause in minutes.

## How It Works

### Structured Logging (JSON)

```typescript
// BAD: Unstructured — hard to parse, search, and filter
console.log(`User ${userId} placed order ${orderId} for $${total}`);

// GOOD: Structured — machine-parseable, searchable
logger.info('Order placed', {
  userId: userId,
  orderId: orderId,
  total: total,
  currency: 'USD',
  itemCount: items.length,
  correlationId: req.headers['x-correlation-id'],
});
// Output: {"level":"info","message":"Order placed","userId":"u-123","orderId":"o-456",...}
```

### Correlation IDs for Distributed Systems

```typescript
// Middleware that propagates correlation IDs
function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}

// Every log entry includes the correlation ID
logger.info('Processing payment', {
  correlationId: req.correlationId,
  orderId: order.id,
});
```

### What to Log and What NOT to Log

**DO Log:**
- Request/response metadata (method, path, status, duration)
- Business events (order created, payment processed, user registered)
- Errors with full context (stack trace, request data, user ID)
- Performance data (query duration, cache hit rates)

**NEVER Log:**
- Passwords, API keys, tokens, secrets
- PII (email, phone, address) unless legally required and encrypted
- Full credit card numbers (PCI compliance)
- Health data (HIPAA compliance)

### Logging Frameworks

| Language | Framework |
|----------|-----------|
| Node.js | Winston, Pino, Bunyan |
| Python | logging (stdlib), structlog |
| Java | SLF4J + Logback, Log4j2 |
| C# | Serilog, NLog, Microsoft.Extensions.Logging |
| Go | zerolog, zap |

## Best Practices

1. **Use structured logging** (JSON). Plain text logs are for local development only.
2. **Use appropriate log levels.** Don't use ERROR for warnings or INFO for debug data.
3. **Include context** — correlation IDs, user IDs, request IDs, operation names.
4. **Never log sensitive data.** PII, passwords, tokens, credit cards.
5. **Log at boundaries** — entry/exit of APIs, external service calls, message consumers.
6. **Centralize log aggregation** — use ELK Stack, Grafana Loki, Datadog, or CloudWatch.

## Anti-patterns / Common Mistakes

- **Console.log debugging in production.** Use a proper logging framework.
- **Logging everything.** Excessive logging creates noise and increases storage costs.
- **No log levels.** Everything at INFO makes it impossible to filter.
- **Logging sensitive data.** Passwords, tokens, PII in logs is a security incident.

## Sources

- [Logging Best Practices (BetterStack)](https://betterstack.com/community/guides/logging/logging-best-practices/)
- [Structured Logging Best Practices (Uptrace)](https://uptrace.dev/glossary/structured-logging)
- [9 Logging Best Practices (Dash0)](https://www.dash0.com/guides/logging-best-practices)
