# Performance

Comprehensive performance engineering knowledge base covering frontend, backend, database, caching, network optimization, benchmarking, profiling, and performance culture. This section provides the performance-first perspective — measurement, optimization methodology, tools, and metrics — for building fast software at any scale.

## Contents

### Frontend Performance
Optimizing user-facing performance across all web applications.
- [Core Web Vitals](frontend-performance/core-web-vitals.md) — LCP/INP/CLS measurement, CrUX, field vs lab, business impact
- [Critical Rendering Path](frontend-performance/critical-rendering-path.md) — DOM, CSSOM, render tree, FCP optimization
- [Bundle Optimization](frontend-performance/bundle-optimization.md) — Size budgets, analysis tools, splitting, tree shaking
- [Image Optimization](frontend-performance/image-optimization.md) — Format matrix, compression, responsive, CDN pipeline
- [Font Optimization](frontend-performance/font-optimization.md) — font-display, subsetting, WOFF2, variable fonts
- [JavaScript Performance](frontend-performance/javascript-performance.md) — Main thread, long tasks, Web Workers, memory leaks
- [Lazy Loading](frontend-performance/lazy-loading.md) — Images, components, routes, facades, Intersection Observer
- [Rendering Performance](frontend-performance/rendering-performance.md) — GPU compositing, CSS containment, virtual scrolling
- [Resource Hints](frontend-performance/resource-hints.md) — preload, prefetch, preconnect, fetchpriority, Speculation Rules
- [Rendering Strategies](frontend-performance/rendering-strategies.md) — SSR/SSG/ISR/CSR, hydration, islands, streaming

### Backend Performance
Server-side optimization for throughput, latency, and resource efficiency.
- [Async & Concurrency](backend-performance/async-concurrency.md) — Event loops, goroutines, virtual threads, backpressure
- [Memory Management](backend-performance/memory-management.md) — GC tuning, leak detection, object pooling, zero-copy
- [Connection Management](backend-performance/connection-management.md) — Pooling, keep-alive, timeouts, graceful shutdown
- [API Optimization](backend-performance/api-optimization.md) — Pagination, batch APIs, DataLoader, conditional requests
- [Profiling](backend-performance/profiling.md) — Flame graphs, USE/RED methods, continuous profiling
- [Response Compression](backend-performance/response-compression.md) — Gzip vs Brotli vs Zstandard, pre-compression
- [Microservices Performance](backend-performance/microservices-performance.md) — gRPC, service mesh, Kafka, request collapsing

### Database Performance
Query optimization, indexing, and database-level performance tuning.
- [Query Optimization](database-performance/query-optimization.md) — EXPLAIN analysis, rewriting, batch operations, N+1 detection
- [Indexing Deep Dive](database-performance/indexing-deep-dive.md) — B-Tree/Hash/GIN/GiST/BRIN selection, composite, covering
- [Connection Pooling](database-performance/connection-pooling.md) — Pool sizing formula, PgBouncer, HikariCP, leak detection
- [Read Replicas](database-performance/read-replicas.md) — Read/write splitting, replication lag, consistency models
- [Partitioning & Sharding](database-performance/partitioning-sharding.md) — Range/list/hash, pruning, shard keys, resharding
- [Configuration Tuning](database-performance/configuration-tuning.md) — PostgreSQL/MySQL memory, WAL, autovacuum, I/O

### Caching Strategies
Multi-tier caching for latency reduction and throughput scaling.
- [Overview](caching-strategies/overview.md) — Caching hierarchy, taxonomy, decision framework, hit ratio targets
- [Browser Caching](caching-strategies/browser-caching.md) — Cache-Control, ETags, Service Workers, bfcache
- [CDN Caching](caching-strategies/cdn-caching.md) — Edge rules, cache keys, purge APIs, origin shield
- [Application Caching](caching-strategies/application-caching.md) — In-memory, distributed, request-scoped, memoization
- [Redis & Memcached](caching-strategies/redis-memcached.md) — Data structures, cluster, eviction policies, persistence
- [Cache Invalidation](caching-strategies/cache-invalidation.md) — TTL, event-driven, tag-based, stampede prevention
- [Caching Patterns](caching-strategies/caching-patterns.md) — Cache-aside, read/write-through, write-behind, multi-tier

### Network Performance
Protocol-level and infrastructure optimization for low-latency delivery.
- [HTTP/2 & HTTP/3](network-performance/http2-http3.md) — Multiplexing, QUIC, 0-RTT, Early Hints, protocol selection
- [Compression](network-performance/compression.md) — Gzip vs Brotli vs Zstd, pre-compression, nginx/Caddy config
- [DNS Optimization](network-performance/dns-optimization.md) — Prefetching, DoH/DoT, Happy Eyeballs, failover
- [Edge Computing](network-performance/edge-computing.md) — Edge functions, edge databases, geo-routing, A/B testing
- [TLS Performance](network-performance/tls-performance.md) — TLS 1.3, 0-RTT, session tickets, OCSP stapling, ciphers

### Benchmarking
Performance testing methodology and execution.
- [Methodology](benchmarking/methodology.md) — Statistical significance, percentiles, Amdahl's/Little's law, CI regression
- [Load Testing](benchmarking/load-testing.md) — Traffic simulation, capacity planning, scenarios, scripts as code
- [Stress Testing](benchmarking/stress-testing.md) — Breaking points, soak testing, spike testing, chaos engineering
- [Tools: k6, Artillery, JMeter](benchmarking/tools-k6-artillery-jmeter.md) — Tool comparison, k6/JMeter/Gatling/Artillery/Locust

### Profiling Tools
Measurement and diagnostic tools for performance analysis.
- [Chrome DevTools](profiling-tools/chrome-devtools.md) — Performance panel, Memory panel, Coverage, Network throttling
- [Lighthouse](profiling-tools/lighthouse.md) — Scoring, CI integration, budgets, custom audits, user flows
- [Backend Profilers](profiling-tools/backend-profilers.md) — pprof, async-profiler, py-spy, clinic.js, flame graphs
- [APM Tools](profiling-tools/apm-tools.md) — Datadog, New Relic, Grafana Cloud, OpenTelemetry integration
- [Distributed Tracing](profiling-tools/distributed-tracing.md) — OpenTelemetry, W3C Trace Context, sampling, Jaeger/Tempo
- [Real User Monitoring](profiling-tools/real-user-monitoring.md) — Performance API, RUM tools, synthetic vs RUM, CrUX

### Performance Culture
Organizational practices for sustained performance excellence.
- [Performance Budgets](performance-culture/performance-budgets.md) — Budget types, Lighthouse CI, bundlesize, ratcheting, CI gates
- [SLI, SLO, SLA](performance-culture/sli-slo-sla.md) — Service levels, error budgets, burn-rate alerting, Google SRE
- [Observability as Code](performance-culture/observability-as-code.md) — Dashboards/alerts/SLOs as code, golden signals, cost management

## How This Section Connects

- **05-frontend/** — Implementation-level frontend performance (React/Vue/Angular optimization, framework-specific patterns)
- **06-backend/** — Implementation-level caching (cache-aside code, Redis setup), rate limiting, resilience patterns
- **07-database/** — Implementation-level database optimization (ORM patterns, migration strategies, DB-specific guides)
- **03-architecture/** — System design patterns affecting performance (CQRS, event sourcing, microservices)
- **08-security/** — Rate limiting from security perspective, DDoS mitigation

This section provides the **performance engineering perspective**: how to measure, analyze, optimize, and maintain performance across the full stack using rigorous methodology and tooling.
