---
paths:
  - "src/**/*.ts"
  - "src/**/*.js"
  - "src/**/*.py"
---
## Resilience & Fault Tolerance Patterns

### Circuit Breaker
- Wrap ALL calls to external services (APIs, databases, caches) in a circuit breaker
- Configure three states: Closed (normal), Open (failing — reject immediately), Half-Open (testing recovery)
- Track failure rate over a rolling window — open the circuit at a defined threshold (e.g., 50% failures in 60s)
- In Open state: return cached/fallback response or a clear error — never hang waiting
- In Half-Open state: allow a limited number of probe requests to test recovery
- Log every circuit state transition with service name, failure count, and duration

### Retry with Backoff
- Retry ONLY on transient failures (network timeout, 503, 429) — never on 4xx client errors
- Use exponential backoff with jitter: `delay = min(base * 2^attempt + random_jitter, max_delay)`
- Set a maximum retry count (3-5 attempts) — never retry indefinitely
- Make retried operations idempotent — retries MUST NOT create duplicate side effects
- Log each retry attempt with attempt number, delay, and error reason

### Timeout Management
- Set explicit timeouts on EVERY external call — connect timeout + read timeout separately
- Define timeout budgets per request: total request time minus already-elapsed time for downstream calls
- Timeouts MUST be shorter than the caller's timeout to prevent cascading hangs
- Use deadline propagation: pass remaining time budget to downstream services via headers
- NEVER use infinite timeouts — default to a conservative value and tune from metrics

### Bulkhead Isolation
- Isolate critical services into separate thread pools, connection pools, or process boundaries
- A failure in a non-critical dependency MUST NOT exhaust resources needed by critical paths
- Limit concurrent requests per downstream service — reject excess requests with 503
- Use separate connection pools for read vs write database operations

### Fallback Strategies
- Define a fallback for every external dependency: cached data, default value, degraded feature, or graceful error
- Document fallback behavior for each service dependency in the module README
- Fallback responses MUST be clearly distinguishable from live data (e.g., metadata flag)
- Test fallback paths explicitly — they are production code, not afterthoughts

### Graceful Degradation
- Identify feature tiers: Critical (must work), Important (degrade), Nice-to-have (disable under load)
- Implement feature flags to disable non-critical features during incidents
- Serve stale cached data with a staleness indicator rather than returning errors
- Design UIs to hide or grey out features backed by unavailable services

### Health Checks & Readiness
- Liveness probe: confirms the process is running and not deadlocked — MUST be lightweight
- Readiness probe: confirms all critical dependencies are reachable — used for traffic routing
- NEVER include non-critical dependencies in readiness checks — a slow cache should not block traffic
- Health checks MUST complete within 2 seconds — set hard timeout on dependency checks
- Include dependency status in readiness response: `{ "db": "up", "cache": "degraded", "search": "down" }`

### Chaos & Failure Testing
- Test failure scenarios in staging: kill dependencies, inject latency, simulate network partitions
- Verify circuit breakers trip and recover correctly under simulated failure
- Verify graceful degradation by disabling non-critical services and confirming user impact is minimal
