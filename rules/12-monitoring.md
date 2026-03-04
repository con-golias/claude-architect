## Monitoring, Observability & Health Checks

### Health Check Endpoints
- GET /health — basic liveness check (returns 200 if process is running)
- GET /health/ready — readiness check (database connected, dependencies reachable)
- Health checks must NOT require authentication
- Ready check should verify: database connection, cache connection, critical external services
- Return structured response: { "status": "healthy|degraded|unhealthy", "checks": {...} }

### Application Metrics (Track These)
- Request rate: requests per second by endpoint
- Error rate: 4xx and 5xx responses by endpoint
- Response time: p50, p95, p99 latency by endpoint
- Database: query count, slow query count, connection pool usage
- Cache: hit rate, miss rate, eviction rate
- Queue: depth, processing time, failure rate (if using queues)
- Business metrics: signups, orders, key conversion events

### Structured Logging (Repeating for Emphasis)
- JSON format in production — human-readable in development
- Required fields: timestamp, level, service, message, correlationId, environment
- Add contextual fields: userId, tenantId, featureFlag, endpoint
- Ship logs to centralized system (ELK, CloudWatch, Datadog)
- Set log retention policies: 30 days hot, 90 days cold minimum

### Alerting Rules
- Alert on: error rate spike, response time degradation, health check failures
- Alert on: disk space >80%, memory usage >85%, CPU sustained >90%
- Alert on: database connection pool exhaustion, queue depth growing
- Alert on: certificate expiration (<30 days), dependency failures
- Use severity levels: critical (page), warning (notify), info (log)
- Avoid alert fatigue: tune thresholds, no duplicate alerts

### Distributed Tracing
- Generate trace ID at entry point — propagate through all services
- Use standard headers: traceparent (W3C Trace Context)
- Record spans for: HTTP requests, database queries, cache operations, external calls
- Include trace ID in error responses and log entries
- Sample traces in production (10-20%) to manage volume

### Uptime & SLA Monitoring
- Monitor critical user journeys end-to-end (synthetic checks)
- Track uptime percentage and report against SLA targets
- Implement status page for public-facing services
- Post-incident reviews for any availability impact
