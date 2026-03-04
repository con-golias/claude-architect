---
paths:
  - "src/**/*.ts"
  - "src/**/*.py"
  - "src/**/*.js"
---
## Performance Rules

### Database Performance (Critical)
- NEVER execute database queries inside loops — this causes N+1 problems
  - Use eager loading (JOIN/include) or batch queries (WHERE id IN [...])
- ALWAYS add indexes for columns used in WHERE, JOIN, ORDER BY, GROUP BY
- Use EXPLAIN/ANALYZE before deploying queries on tables with >10K rows
- Use SELECT only the columns needed — never SELECT *
- Implement database connection pooling — never open/close per request
- Set query timeouts — no query should run indefinitely
- Cache frequently read, rarely changed data with explicit TTL

### API & Network Performance
- ALWAYS paginate list endpoints — default 20, max 100 items
- Implement response compression (gzip/brotli)
- Set appropriate Cache-Control headers for static and dynamic content
- Use ETags for conditional requests where appropriate
- Set explicit timeouts on ALL external HTTP calls (connect + read)
- Implement circuit breakers for unreliable external services
- Use async/concurrent processing for independent I/O operations

### Memory & Computation
- Stream large files — never load entire file into memory
- Use pagination/cursors for processing large datasets
- Implement lazy loading for non-critical resources and heavy computations
- Clean up event listeners, timers, and subscriptions to prevent memory leaks
- Avoid deep object cloning — use immutable patterns or structural sharing
- Profile before optimizing — never guess where bottlenecks are

### Caching Strategy
- Cache with explicit TTL — never cache indefinitely without invalidation strategy
- Use cache-aside pattern: check cache → if miss, load from source → store in cache
- Implement graceful degradation when cache is unavailable
- Cache key naming: {service}:{entity}:{id}:{version}
- Document what is cached, TTL values, and invalidation triggers
- Never cache sensitive data (tokens, PII) without encryption

### Frontend Performance (When Applicable)
- Lazy-load routes and heavy components
- Optimize images: correct format (WebP), appropriate size, lazy loading
- Minimize bundle size — analyze with bundle analyzer before releases
- Use code splitting for routes and large dependencies
- Debounce/throttle frequent events (scroll, resize, input)
- Avoid layout thrashing — batch DOM reads and writes

### Monitoring Performance
- Track and log slow queries (>100ms)
- Track and log slow API responses (>500ms)
- Set performance budgets for page load, API response time, bundle size
- Alert on performance degradation — don't wait for user complaints
