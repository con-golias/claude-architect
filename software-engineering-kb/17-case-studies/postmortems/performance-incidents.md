# Performance Incident Case Studies

| Attribute | Value |
|-----------|-------|
| Domain | Case Studies > Postmortems |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Performance Section](../../09-performance/), [Database Performance](../../09-performance/database-performance/), [Caching Strategies](../../09-performance/caching-strategies/) |

---

## Core Concepts

Performance failures are distinct from availability outages -- the system remains "up" but becomes unusable. These case studies show how scaling limits, resource exhaustion, and architectural bottlenecks create degraded experiences, and what engineering teams did to fix them.

### 1. Twitter's Fail Whale Era (2007-2012)

**Symptoms:** The iconic "Fail Whale" error page appeared whenever Twitter's infrastructure could not handle request volume. During peak events (elections, Super Bowl, major news), Twitter became effectively unusable. At its worst, Twitter experienced multiple outages per week.

**Root cause:** Twitter was built on Ruby on Rails, which introduced several scaling limitations at their request volume:

```text
Ruby on Rails Scaling Limits at Twitter's Scale:
  1. Global Interpreter Lock (GIL/GVL)
     - Ruby MRI could only execute one thread at a time
     - Each Rails process handled one request at a time
     - Scaling required spawning more processes (high memory overhead)

  2. Garbage Collection
     - Ruby's stop-the-world GC caused multi-hundred-millisecond pauses
     - Under high load, GC pauses cascaded across processes
     - Twitter even built a custom generational GC for Ruby ("Kiji")

  3. Monolithic Architecture
     - Single Rails app handled tweets, timelines, search, and API
     - One slow feature degraded everything
     - Database (MySQL) was the shared bottleneck

  4. Fan-out Problem
     - A tweet from a user with millions of followers required
       writing to millions of timeline caches simultaneously
     - Ruby could not handle this write amplification efficiently
```

**Investigation process:** Twitter's engineering team identified that the core problem was not Rails itself but the mismatch between Ruby's concurrency model and Twitter's workload. They needed async I/O, efficient memory usage, and better concurrency primitives.

**Solution:** Multi-year migration from Ruby on Rails to JVM-based stack:

```text
Migration Strategy:
  Phase 1: Extract critical services from the monolith
    - Timeline service → Scala on JVM
    - Search → Java (Lucene-based)
    - Tweet storage → Scala service

  Phase 2: Build custom infrastructure
    - Finagle: async RPC framework (Scala, open-sourced)
    - Manhattan: distributed key-value store
    - Snowflake: distributed unique ID generator

  Phase 3: Optimize hot paths
    - Timeline fanout redesigned (push vs. pull model based on follower count)
    - Memcached layer for timeline caching
    - MySQL sharding for tweet storage

  Result:
    - 2012 US Election: 327,452 tweets/minute handled without issues
    - Fail Whale retired in 2013
    - The Fail Whale image was officially retired in 2015
```

**Prevention measures:**
- Choose language runtimes that match your concurrency requirements
- Extract hot-path services early before the monolith becomes unmanageable
- Build custom infrastructure only when off-the-shelf solutions cannot meet requirements
- Load test with realistic traffic patterns (fan-out from high-follower accounts)

---

### 2. Reddit's "Hug of Death" Scaling Patterns (Ongoing)

**Symptoms:** When a post on Reddit goes viral, the linked website receives a massive traffic spike ("Reddit hug of death"). Reddit itself also faced internal scaling challenges as traffic grew from a single Python server to serving millions of concurrent users.

**Root cause:** Reddit's initial architecture was a single Python (Pylons) application with a PostgreSQL database. As traffic grew, every component became a bottleneck:

```text
Reddit's Scaling Journey:
  2005: Single Python server, single PostgreSQL database
  2007: Added Memcached for caching, split read/write databases
  2009: Migrated from bare metal to AWS EC2
  2010: Introduced Cassandra for high-write workloads (votes, views)
  2012: Implemented queue-based processing for async operations
  2015-2017: Migrated core services to Go and Java

Key Caching Architecture (what saved Reddit):
  ┌──────────┐    ┌──────────────┐    ┌────────────┐
  │ CDN Edge │ →  │ Application  │ →  │ Memcached  │
  │ (Fastly) │    │ Cache Layer  │    │ Cluster    │
  └──────────┘    └──────────────┘    └────────────┘
                         ↓
                  ┌──────────────┐    ┌────────────┐
                  │ PostgreSQL   │    │ Cassandra  │
                  │ (comments,   │    │ (votes,    │
                  │  posts)      │    │  views)    │
                  └──────────────┘    └────────────┘
```

**Solution:** Multi-tier caching strategy that served increasingly hot content from faster layers:

```text
Caching Hierarchy:
  Tier 1: CDN (Fastly) - static assets, rendered pages for logged-out users
  Tier 2: Application-level cache - computed listings, rendered markdown
  Tier 3: Memcached - database query results, user sessions
  Tier 4: Database - source of truth, accessed only on cache miss

Cache Invalidation Strategy:
  - Time-based expiration for listings (60-300 seconds)
  - Event-driven invalidation for user-specific data
  - Stale-while-revalidate for high-traffic pages
  - Pre-warming caches for predictable traffic spikes (AMAs, events)
```

**Prevention measures:**
- Implement multi-tier caching from the start for read-heavy workloads
- Use CDN edge caching aggressively for logged-out and public content
- Separate high-write workloads (votes, views) from read-heavy workloads (comments, posts)
- Design for graceful degradation: serve slightly stale data rather than failing entirely

---

### 3. Slack's Memory and Performance Challenges

**Symptoms:** Slack experienced performance degradation as workspaces grew larger. Desktop client memory usage could exceed 1 GB+ for users in multiple large workspaces. Backend Go services exhibited latency spikes correlated with garbage collection pauses.

**Root cause:** Multiple contributing factors across client and server:

```text
Client-Side Issues:
  - Electron-based desktop app loaded entire workspace data
  - Each workspace channel maintained its own DOM and state
  - Users in 10+ workspaces experienced compounding memory usage
  - Image and file previews cached aggressively without eviction

Server-Side Issues (Go Services):
  - Large heap sizes in Go services triggered long GC pauses
  - Go's GC targets low latency but struggles with heaps > 10 GB
  - Connection-per-user model created millions of WebSocket connections
  - Message fanout for large channels (10,000+ members) caused memory spikes

Latency Spike Pattern:
  Normal operation: p99 latency ~50ms
  During GC pause: p99 latency spikes to 200-500ms
  Under load + GC: p99 can exceed 1 second
```

**Solution:** Multi-pronged optimization across client and server:

```text
Client Optimizations:
  - Lazy loading: only load visible workspace data
  - Virtual scrolling: render only visible messages
  - Memory budgets per workspace with LRU eviction
  - Image lazy loading with placeholder skeletons
  - Migration from Electron to native components for critical paths

Server Optimizations:
  - Go GC tuning: GOGC parameter adjustment for heap/latency tradeoff
  - Heap size reduction: off-heap storage for large data structures
  - Connection multiplexing: reduce per-user connection overhead
  - Message fanout optimization: batched delivery for large channels
  - Sharding by workspace to limit per-instance heap size

Go GC Tuning:
  GOGC=100 (default): GC triggers when heap doubles
  GOGC=50: GC triggers at 50% growth (more frequent, shorter pauses)
  GOMEMLIMIT: Set hard memory limit to prevent OOM while allowing GC to adapt

  Trade-off: Lower GOGC = shorter pauses but higher CPU usage for GC
```

**Prevention measures:**
- Set memory budgets for client applications and enforce them with eviction policies
- Tune GC parameters based on your specific heap size and latency requirements
- Shard services so that per-instance heap sizes stay within GC's efficient range
- Profile GC behavior under production-like conditions, not just functional tests
- Consider off-heap data structures for large datasets that do not need GC tracking

---

### 4. LinkedIn Feed Ranking Latency Optimization

**Symptoms:** LinkedIn's feed ranking system, serving personalized content to 900M+ members, experienced increasing latency as the ML model complexity grew. Real-time inference for feed ranking needed to complete within strict latency budgets (low hundreds of milliseconds) while evaluating thousands of candidate posts per request.

**Root cause:** Feed ranking uses multi-stage ML models that grew in complexity over time:

```text
Feed Ranking Pipeline:
  Request arrives → Candidate generation (1000s of posts)
    → First-pass ranking (lightweight model, narrow down to 100s)
      → Second-pass ranking (heavy model, score and rank top results)
        → Blending and business rules
          → Response (< 200ms total budget)

Latency Challenges:
  1. Model size: Transformer-based models with billions of parameters
  2. Feature computation: Real-time feature extraction from user activity
  3. Candidate volume: Evaluating 1000+ candidates per request
  4. Infrastructure: GPU inference at scale with consistent latency
```

**Solution:** LinkedIn's LiRank framework and infrastructure optimizations:

```text
Optimization Strategies:
  1. Model Architecture (TransAct):
     - 2 encoder layers (reduced from deeper models)
     - Feed-forward dimension = 0.5x embedding size
     - Sequence length capped at 50
     - Result: ~40% latency reduction with minimal quality loss

  2. Embedding Compression:
     - Quantize embeddings from float32 to int8
     - Use product quantization for large embedding tables
     - Cache frequently accessed embeddings in-memory

  3. Multi-Objective Optimization:
     - Single model predicts multiple objectives (engagement, relevance, quality)
     - Isotonic calibration layers for balanced predictions
     - Avoids running separate models per objective

  4. Infrastructure:
     - Espresso (LinkedIn's data store) built on MySQL with auto-sharding
     - Vitess for horizontal MySQL scaling with minimal application changes
     - Pre-computed features cached in Redis for sub-millisecond access
     - Batched GPU inference to maximize throughput
```

**Prevention measures:**
- Define latency budgets upfront and make them a constraint in model design
- Use multi-stage ranking to avoid running expensive models on all candidates
- Cache pre-computed features rather than computing them at inference time
- Compress embeddings and quantize models for serving (training can use full precision)
- Monitor latency distributions (p50, p99, p999), not just averages

---

### 5. Pinterest's Database Scaling Journey

**Symptoms:** Pinterest experienced exponential growth in pins, boards, and user interactions. MySQL, their primary database, could not handle the write volume or data size. Queries that took milliseconds at launch took seconds at scale. Sharding became necessary but introduced significant engineering complexity.

**Root cause:** Rapid data growth on a single MySQL instance:

```text
Growth Timeline:
  2011: Single MySQL instance, millions of pins
  2012: MySQL replication lag growing, write bottlenecks
  2013: Sharding required, but application-level sharding in Python is complex
  2014+: Dedicated data services replacing direct MySQL access

Data Characteristics:
  - Pins: billions of records, mostly reads
  - User feeds: write-heavy (every pin creates feed entries for followers)
  - Boards: complex relationships, many-to-many with users and pins
  - Search: full-text search on pin descriptions, board names
```

**Solution:** Application-level sharding with dedicated data services:

```text
Pinterest Sharding Strategy:
  1. Shard by object ID (pins, users, boards each sharded independently)
  2. Object IDs encode shard information:
     ID = [shard_id (16 bits) | type (4 bits) | local_id (44 bits)]
     - Any service can determine the shard from the object ID alone
     - No central lookup required for routing

  3. Dedicated Services:
     Pin Service → Read/write pins from sharded MySQL
     User Service → User data with caching layer
     Board Service → Board-pin relationships
     Feed Service → Separate from MySQL (moved to custom store)
     Search Service → Elasticsearch (replaced MySQL full-text search)

  Performance Results:
     - 50% more throughput with 60% less latency variance
     - MySQL query latency stabilized regardless of data growth
     - Each shard remains small enough for efficient indexing
     - New shards added without application changes
```

**Prevention measures:**
- Design shard-aware object IDs from the start (encode routing info in the ID)
- Build dedicated data access services rather than letting every application query MySQL directly
- Separate write-heavy workloads (feeds) from read-heavy workloads (pin lookups)
- Move full-text search to dedicated search infrastructure (Elasticsearch) early
- Monitor per-shard query latency to detect hot shards before they impact users

---

### 6. Spotify's Audio Streaming Latency Optimization

**Symptoms:** Audio streaming has unique latency requirements -- users expect playback to start within 200ms of pressing play. Any perceivable delay feels like a broken experience. As Spotify scaled to 500M+ users across 180+ markets, maintaining consistent low-latency playback worldwide became a core engineering challenge.

**Root cause:** Audio streaming latency has multiple components:

```text
Playback Latency Budget (target: < 200ms):
  DNS resolution:        10-50ms
  TCP + TLS handshake:   30-100ms
  CDN edge lookup:       5-20ms
  First audio bytes:     10-30ms
  Audio buffer fill:     50-100ms
  ────────────────────────────────
  Total target:          < 200ms

Challenges at Scale:
  - 100M+ tracks in the catalog (long-tail content rarely cached at edge)
  - 180+ markets with varying network quality
  - Mobile users with intermittent connectivity
  - Transitions between tracks must be gapless
```

**Solution:** Multi-layer CDN and caching architecture:

```text
Spotify CDN Architecture:
  Tier 1: Edge Nodes (200+ locations worldwide)
    - Popular tracks cached at edge (covers 90% of requests)
    - Geo-routing to nearest edge node
    - Fastly's VCL for intelligent caching logic

  Tier 2: Regional Storage Nodes
    - Catalog segments cached per region
    - Pre-populated based on regional listening patterns
    - Handles cache misses from edge nodes

  Tier 3: Origin Storage
    - Complete catalog stored in cloud object storage
    - Multiple replicas across regions
    - Only accessed for true cache misses (< 10% of requests)

Latency Optimization Techniques:
  1. Predictive pre-fetching: When a user listens to track N,
     pre-fetch track N+1 to edge cache
  2. Adaptive bitrate: Start with low quality for instant playback,
     upgrade to high quality as buffer fills
  3. Persistent connections: Keep TCP/TLS connections alive between
     client and edge node to eliminate handshake latency
  4. Client-side cache: Recently played tracks cached on device
  5. Edge computing: Use Fastly VCL to customize caching per
     user location, device type, and listening history
```

**Prevention measures:**
- Implement multi-tier caching with edge, regional, and origin layers
- Pre-fetch predictable next requests (next track, next page, next action)
- Use adaptive quality to prioritize time-to-first-byte over initial quality
- Maintain persistent connections to eliminate repeated handshake costs
- Cache aggressively at the client level for recently accessed content
- Monitor latency by geographic region, not just global averages

---

## 10 Key Lessons

1. **Match your runtime to your concurrency model.** Twitter's Ruby GIL could not support their concurrent workload. Choose languages and runtimes whose concurrency primitives match your traffic patterns.

2. **Caching is the most effective scaling technique for read-heavy workloads.** Reddit survived viral traffic spikes through multi-tier caching. Implement caching at every layer: CDN, application, in-memory, and client.

3. **Garbage collection tuning is not optional at scale.** Slack's Go services and Twitter's Ruby processes both suffered GC-induced latency spikes. Profile GC behavior under production conditions and tune parameters (GOGC, heap size) accordingly.

4. **Set latency budgets as engineering constraints.** LinkedIn's feed ranking team designed ML models to fit within a 200ms latency budget. Make latency a first-class constraint, not an afterthought.

5. **Shard-aware object IDs simplify horizontal scaling.** Pinterest's approach of encoding shard routing information directly in object IDs eliminated the need for centralized lookup services and simplified every data access path.

6. **Pre-fetch predictable next actions.** Spotify pre-fetches the next track before the current one finishes. Wherever user behavior is predictable, pre-fetch to hide latency.

7. **Separate workloads by access pattern.** Pinterest separated read-heavy pin lookups from write-heavy feed updates. Reddit separated high-write workloads (votes) from read-heavy workloads (comments). Match infrastructure to access patterns.

8. **Monitor latency distributions, not averages.** p99 and p999 latencies reveal problems that averages hide. A system with 10ms average latency but 5-second p99 is broken for 1% of users.

9. **Client-side optimization compounds.** Slack's memory budgets, Spotify's device caching, and Twitter's timeline caching all show that client-side optimization reduces server load while improving user experience.

10. **Graceful degradation over hard failure.** Reddit serves slightly stale cached data during traffic spikes rather than returning errors. Design every system to degrade gracefully when capacity is exceeded.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Wrong runtime for the workload | Twitter: Ruby GIL limited concurrency | Choose runtimes matching concurrency needs; extract hot paths to appropriate languages |
| No caching strategy | Reddit hug of death overwhelms databases | Multi-tier caching: CDN → application → in-memory → database |
| Ignoring GC at scale | Slack: latency spikes from Go GC pauses | Tune GC parameters, limit heap sizes, consider off-heap storage |
| Latency as afterthought | LinkedIn: model complexity grew without latency constraints | Define latency budgets upfront; make them a model design constraint |
| Single database for all workloads | Pinterest: MySQL became bottleneck for reads, writes, and search | Separate databases by access pattern; dedicated services per data domain |
| Global latency averages only | Hidden p99 problems affecting user experience | Monitor p50, p95, p99, p999 per region and per endpoint |
| No pre-fetching | Every user action incurs full network round-trip | Pre-fetch predictable next actions (next track, next page) |
| Unbounded client memory | Slack: Electron client consumed 1GB+ RAM | Set memory budgets with LRU eviction and lazy loading |
