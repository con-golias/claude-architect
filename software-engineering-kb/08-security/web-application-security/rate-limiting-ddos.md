# Rate Limiting and DDoS Protection Guide

## Table of Contents

1. [Overview](#overview)
2. [Rate Limiting Algorithms](#rate-limiting-algorithms)
3. [Rate Limiting Strategies](#rate-limiting-strategies)
4. [Distributed Rate Limiting](#distributed-rate-limiting)
5. [Rate Limit Headers and Responses](#rate-limit-headers-and-responses)
6. [Application-Layer DDoS Attacks](#application-layer-ddos-attacks)
7. [Defense Layers](#defense-layers)
8. [Bot Detection and CAPTCHA Integration](#bot-detection-and-captcha-integration)
9. [Geo-Blocking and IP Reputation](#geo-blocking-and-ip-reputation)
10. [Code Examples](#code-examples)
11. [Best Practices](#best-practices)
12. [Anti-Patterns](#anti-patterns)
13. [Enforcement Checklist](#enforcement-checklist)

---

## Overview

Rate limiting and DDoS protection are essential defensive mechanisms that control the
volume of requests a system accepts. Rate limiting protects individual API endpoints from
abuse, while DDoS protection defends the entire infrastructure from volumetric and
application-layer attacks. This guide covers algorithms, implementation patterns, attack
types, and a multi-layer defense architecture for production systems.

---

## Rate Limiting Algorithms

### Fixed Window Counter

The simplest algorithm. Divide time into fixed windows (e.g., 1 minute) and count requests
per window. Reset the counter at the start of each window.

**How it works:**

1. Define a window size (e.g., 60 seconds) and a limit (e.g., 100 requests).
2. For each incoming request, determine the current window (e.g., `floor(timestamp / 60)`).
3. Increment the counter for that window.
4. If the counter exceeds the limit, reject the request.

**Advantages:**

- Simple to implement and understand.
- Low memory usage (one counter per key per window).
- Easy to implement in Redis with `INCR` and `EXPIRE`.

**Disadvantages:**

- Burst problem at window boundaries: a client can send up to 2x the limit by timing
  requests at the end of one window and the beginning of the next. For example, 100 requests
  at second 59 and 100 requests at second 61 produces 200 requests in 2 seconds while
  respecting a 100/minute limit.

### Sliding Window Log

Track the exact timestamp of each request and count requests within a sliding time window.

**How it works:**

1. Store the timestamp of every request in a sorted set.
2. For each new request, remove timestamps older than `now - window_size`.
3. Count the remaining timestamps.
4. If the count exceeds the limit, reject the request.

**Advantages:**

- Precise rate limiting with no boundary issues.
- Smooth distribution of allowed requests.

**Disadvantages:**

- High memory usage: stores every request timestamp.
- More expensive to compute (sorted set operations per request).
- Not practical for high-volume APIs.

### Sliding Window Counter

A hybrid approach that combines fixed windows with weighted interpolation to approximate a
sliding window without storing individual timestamps.

**How it works:**

1. Maintain counters for the current and previous fixed windows.
2. For each new request, calculate the weighted count:
   `weighted = prev_count * (1 - elapsed/window_size) + current_count`
3. If the weighted count exceeds the limit, reject the request.

**Advantages:**

- Smooths the boundary burst problem.
- Low memory usage (two counters per key).
- Good balance between accuracy and efficiency.

**Disadvantages:**

- Approximation, not exact.
- Slightly more complex than fixed window.

### Token Bucket

A bucket holds tokens up to a maximum capacity. Tokens are added at a fixed rate. Each
request consumes one (or more) tokens. If the bucket is empty, the request is rejected.

**How it works:**

1. Initialize the bucket with `max_tokens` tokens.
2. Tokens are added at `refill_rate` tokens per second, up to `max_tokens`.
3. Each request attempts to consume one token.
4. If tokens are available, allow the request and decrement the count.
5. If no tokens remain, reject the request.

**Advantages:**

- Allows controlled bursts (up to `max_tokens` requests).
- Smooth rate limiting over time.
- Simple to reason about: refill rate is the sustained rate, bucket size is the burst size.

**Disadvantages:**

- Requires tracking both the token count and the last refill timestamp.
- More state than a simple counter.

**Use cases:**

- API rate limiting where bursts are acceptable.
- Network traffic shaping.
- Systems where users need occasional burst capacity.

### Leaky Bucket

Requests enter a queue (bucket) and are processed at a constant rate. If the queue is full,
new requests are rejected.

**How it works:**

1. Maintain a queue with a maximum size (bucket capacity).
2. Incoming requests are added to the queue.
3. Requests are removed from the queue at a fixed rate and processed.
4. If the queue is full when a new request arrives, reject the request.

**Advantages:**

- Produces a perfectly smooth output rate.
- Prevents any bursts from reaching the backend.
- Good for protecting services with strict throughput limits.

**Disadvantages:**

- Introduces latency (requests wait in the queue).
- No burst allowance -- legitimate traffic spikes are queued or dropped.
- More complex to implement than counter-based approaches.

**Use cases:**

- Protecting backend services with fixed capacity.
- Network traffic policing.
- Systems that require a constant processing rate.

### Algorithm Comparison

| Algorithm              | Memory     | Burst Handling   | Accuracy | Complexity |
|------------------------|------------|------------------|----------|------------|
| Fixed Window Counter   | Very Low   | Boundary bursts  | Low      | Very Low   |
| Sliding Window Log     | High       | None             | Exact    | Medium     |
| Sliding Window Counter | Low        | Smoothed         | Good     | Low        |
| Token Bucket           | Low        | Controlled burst | Good     | Medium     |
| Leaky Bucket           | Medium     | No bursts        | Exact    | Medium     |

---

## Rate Limiting Strategies

### Per-User Rate Limiting

Identify users by their authenticated session or API key and apply limits per user.

**When to use:**

- Authenticated APIs where each user has a clear identity.
- Subscription tiers with different rate limits (free: 100/min, pro: 1000/min).
- Preventing individual account abuse without affecting other users.

**Implementation key:** Use the user ID or API key as the rate limit key.

### Per-IP Rate Limiting

Identify clients by their IP address.

**When to use:**

- Unauthenticated endpoints (login, registration, public APIs).
- Defense against brute-force attacks.
- Fallback when user identity is not available.

**Caveats:**

- Multiple users behind a NAT or corporate proxy share one IP address.
- Set limits high enough to accommodate shared IPs.
- Consider using `X-Forwarded-For` to get the real client IP (but validate it -- only trust
  the value set by your own load balancer).

### Per-API-Key Rate Limiting

Assign rate limits to each API key, independent of the user or IP.

**When to use:**

- Third-party API integrations.
- Multi-tenant platforms where each tenant has a key.
- Service-to-service communication with different priority levels.

### Composite Rate Limiting

Combine multiple strategies for defense in depth:

1. **Per-IP:** 1000 requests/minute (protects against unauthenticated abuse).
2. **Per-User:** 200 requests/minute (protects against authenticated abuse).
3. **Per-Endpoint:** 50 requests/minute on `/api/export` (protects expensive operations).
4. **Global:** 50,000 requests/minute total (protects overall system capacity).

Apply limits in order from most specific (per-endpoint) to least specific (global).

---

## Distributed Rate Limiting

### Why Distributed Rate Limiting

In a multi-instance deployment (multiple application servers behind a load balancer),
local in-memory rate limiting is insufficient because:

- Each instance tracks only its own requests.
- A client hitting different instances gets N times the intended limit.
- Horizontal scaling undermines local rate limiting.

### Redis-Based Rate Limiting

Redis is the most common backing store for distributed rate limiting due to its atomic
operations, low latency, and built-in expiry.

#### Fixed Window with Redis

```
-- Redis commands (pseudocode)
key = "ratelimit:{user_id}:{window}"
count = INCR key
if count == 1:
    EXPIRE key window_size
if count > limit:
    REJECT
```

#### Sliding Window with Redis Sorted Sets

```
-- Redis commands (pseudocode)
key = "ratelimit:{user_id}"
now = current_timestamp_ms
window_start = now - window_size_ms

ZREMRANGEBYSCORE key 0 window_start   -- Remove old entries
ZADD key now now                       -- Add current request
count = ZCARD key                      -- Count entries in window
EXPIRE key window_size_seconds         -- Set expiry for cleanup

if count > limit:
    REJECT
```

#### Token Bucket with Redis

```
-- Redis Lua script for atomic token bucket
local key = KEYS[1]
local max_tokens = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])  -- tokens per second
local now = tonumber(ARGV[3])

local data = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(data[1]) or max_tokens
local last_refill = tonumber(data[2]) or now

-- Calculate token refill
local elapsed = now - last_refill
local new_tokens = math.min(max_tokens, tokens + (elapsed * refill_rate))

if new_tokens >= 1 then
    new_tokens = new_tokens - 1
    redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
    redis.call('EXPIRE', key, math.ceil(max_tokens / refill_rate) * 2)
    return 1  -- ALLOW
else
    redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
    redis.call('EXPIRE', key, math.ceil(max_tokens / refill_rate) * 2)
    return 0  -- REJECT
end
```

### Redis Cluster Considerations

- Use hash tags in keys (e.g., `{user_id}:ratelimit`) to ensure all rate limit data for
  a user lands on the same Redis shard.
- Accept slight inaccuracy during network partitions -- rate limiting does not need to be
  perfectly consistent.
- Set reasonable TTLs on all keys to prevent memory leaks.
- Use Redis Lua scripts for atomic multi-step operations.

### Alternatives to Redis

- **Memcached:** Simpler but lacks Lua scripting and sorted sets.
- **Database counters:** Higher latency, suitable for low-volume rate limiting.
- **In-memory with gossip protocol:** Approximate distributed counting without external
  dependencies.
- **Token bucket in application memory with periodic sync:** Reduces Redis calls at the
  cost of accuracy.

---

## Rate Limit Headers and Responses

### Standard Rate Limit Headers

Use the IETF draft standard headers to communicate rate limit status to clients:

```
RateLimit-Limit: 100
RateLimit-Remaining: 42
RateLimit-Reset: 1625097600
```

| Header                | Description                                           |
|-----------------------|-------------------------------------------------------|
| `RateLimit-Limit`     | Maximum number of requests allowed in the window      |
| `RateLimit-Remaining` | Number of requests remaining in the current window    |
| `RateLimit-Reset`     | Unix timestamp (seconds) when the window resets       |
| `Retry-After`         | Seconds to wait before retrying (on 429 responses)    |

### 429 Too Many Requests Response

When a client exceeds the rate limit, respond with HTTP 429:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 1625097600
Retry-After: 30

{
    "error": {
        "code": "RATE_LIMIT_EXCEEDED",
        "message": "Too many requests. Please retry after 30 seconds.",
        "retry_after": 30
    }
}
```

### Guidelines for Rate Limit Responses

- Always include `Retry-After` in 429 responses so clients know when to retry.
- Include `RateLimit-*` headers on successful responses so clients can self-regulate.
- Return a JSON error body with a machine-readable error code.
- Do not leak internal implementation details (algorithm type, Redis key structure).
- Log rate-limited requests for monitoring and alerting.

---

## Application-Layer DDoS Attacks

Application-layer (Layer 7) DDoS attacks target the application logic rather than the
network infrastructure. They are harder to detect because they use legitimate-looking
HTTP requests.

### Slowloris

Slowloris opens many connections to the server and keeps them open by sending partial
HTTP requests (incomplete headers). Each connection consumes a server thread or socket.

**How it works:**

1. Open hundreds of connections to the target.
2. Send partial HTTP headers: `GET / HTTP/1.1\r\nHost: target.com\r\n`.
3. Periodically send additional header lines to keep the connection alive.
4. Never complete the request.
5. The server eventually exhausts its connection pool.

**Defense:**

- Set strict `client_header_timeout` and `client_body_timeout` in Nginx.
- Use a reverse proxy that buffers requests before forwarding to the backend.
- Limit the maximum number of concurrent connections per IP.
- Use connection-oriented load balancers that detect idle connections.

### HTTP Flood

A volumetric attack that sends a high volume of legitimate-looking HTTP requests.

**Variants:**

- **GET flood:** High volume of GET requests to resource-intensive pages.
- **POST flood:** High volume of POST requests with large payloads.
- **Randomized flood:** Requests with random URLs, headers, and user agents to evade
  pattern-based detection.

**Defense:**

- Rate limiting per IP and per user.
- CAPTCHA challenges for suspicious traffic patterns.
- CDN and WAF with DDoS mitigation capabilities.
- JavaScript challenge pages that require browser execution.

### API Abuse

Attackers target expensive API endpoints to maximize resource consumption:

- GraphQL queries with deeply nested fields or large result sets.
- Search endpoints with complex queries (e.g., regex searches, wildcard queries).
- Export/report generation endpoints.
- File upload endpoints with large payloads.

**Defense:**

- Set per-endpoint rate limits based on resource cost.
- Implement query complexity analysis for GraphQL.
- Limit query depth and breadth in GraphQL schemas.
- Set maximum payload sizes on all endpoints.
- Use pagination with reasonable page size limits.

### Resource Exhaustion

Attacks that cause the server to consume excessive CPU, memory, or disk:

- **CPU exhaustion:** Sending inputs that trigger expensive computations (e.g., complex
  regular expressions, cryptographic operations, image processing).
- **Memory exhaustion:** Sending large payloads, triggering memory leaks, or causing
  excessive caching.
- **Disk exhaustion:** Uploading large files, triggering excessive logging, filling
  temporary directories.

### Regex DoS (ReDoS)

Regular expressions with catastrophic backtracking can consume CPU exponentially:

```
# Vulnerable regex: (a+)+$
# Input: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaX"
# The regex engine backtracks exponentially trying to match
```

**Vulnerable regex patterns:**

- Nested quantifiers: `(a+)+`, `(a*)*`, `(a+)*`
- Overlapping alternations: `(a|a)+`
- Repetition of groups with repetition: `(\d+\.)+\d+`

**Defense:**

- Use regex engines with linear-time guarantees (RE2, Rust regex crate).
- Set timeout limits on regex execution.
- Avoid user-supplied regex patterns.
- Test regex patterns with ReDoS detection tools.
- Prefer simple string operations over complex regex where possible.

### Hash Collision DoS

Hash collision attacks exploit the worst-case O(n) behavior of hash tables. By sending
keys that all hash to the same bucket, the attacker causes hash table operations to
degrade from O(1) to O(n), consuming CPU proportional to n^2 for n insertions.

**Attack surface:**

- POST parameter parsing (PHP, Java, Python frameworks parse form data into hash maps).
- JSON parsing (object keys are stored in hash maps).
- Cookie parsing.

**Defense:**

- Use hash functions with randomized seeds (SipHash, used by default in Rust, Python 3.3+,
  Ruby 2.0+).
- Limit the maximum number of POST parameters.
- Limit the maximum depth and size of JSON objects.
- Use language versions that include hash collision mitigation.

---

## Defense Layers

### Layer 1: CDN and WAF

Deploy a CDN with DDoS mitigation capabilities as the first line of defense.

#### Cloudflare

- **Rate Limiting Rules:** Define rate limits per URL path, method, and client characteristics.
- **Bot Management:** Machine learning-based bot detection.
- **DDoS Protection:** Automatic L3/L4/L7 DDoS mitigation.
- **WAF Rules:** Managed rulesets for OWASP Top 10, known attack signatures.
- **Challenge Pages:** JavaScript challenges and CAPTCHAs for suspicious traffic.
- **Under Attack Mode:** Emergency mode that challenges all visitors.

#### AWS Shield

- **Shield Standard:** Automatic L3/L4 DDoS protection (included with all AWS services).
- **Shield Advanced:** Enhanced L7 DDoS protection, DDoS response team, cost protection.
- **AWS WAF:** Web application firewall with rate-based rules.
- **AWS WAF Rate-Based Rules:** Block IPs that exceed a specified request rate.

#### Akamai

- **Prolexic:** DDoS mitigation for network-layer attacks.
- **Kona Site Defender:** WAF and DDoS protection for web applications.
- **Bot Manager:** Advanced bot detection and management.

### Layer 2: Reverse Proxy Rate Limiting

#### Nginx limit_req Module

```nginx
# Define rate limiting zones
http {
    # Zone: per-IP rate limiting (10 requests/second)
    limit_req_zone $binary_remote_addr zone=per_ip:10m rate=10r/s;

    # Zone: per-server rate limiting (1000 requests/second total)
    limit_req_zone $server_name zone=per_server:10m rate=1000r/s;

    # Zone: per-IP rate limiting on login endpoint (5 requests/minute)
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    server {
        listen 443 ssl;

        # Apply per-IP limit with burst allowance
        location / {
            limit_req zone=per_ip burst=20 nodelay;
            limit_req_status 429;
            proxy_pass http://backend;
        }

        # Strict rate limiting on login
        location /api/auth/login {
            limit_req zone=login burst=5 nodelay;
            limit_req_status 429;
            proxy_pass http://backend;
        }

        # Connection limiting
        limit_conn_zone $binary_remote_addr zone=conn_per_ip:10m;
        location / {
            limit_conn conn_per_ip 50;
        }
    }
}
```

**Configuration parameters:**

- `rate`: Requests per second (r/s) or per minute (r/m).
- `burst`: Number of excess requests to allow in a burst.
- `nodelay`: Process burst requests immediately instead of queuing.
- `zone`: Shared memory zone for storing state (format: `name:size`).
- `limit_req_status`: HTTP status code to return (default 503, change to 429).

#### Nginx Additional Protections

```nginx
# Slowloris protection
client_header_timeout 10s;
client_body_timeout 10s;
send_timeout 10s;
keepalive_timeout 15s;

# Maximum request body size
client_max_body_size 10m;

# Maximum number of requests per keep-alive connection
keepalive_requests 100;

# Limit connections per IP
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
limit_conn conn_limit 100;
```

### Layer 3: API Gateway Rate Limiting

API gateways (Kong, AWS API Gateway, Apigee) provide centralized rate limiting:

- **Kong Rate Limiting Plugin:**
  ```yaml
  plugins:
    - name: rate-limiting
      config:
        minute: 100
        hour: 1000
        policy: redis
        redis_host: redis.internal
        redis_port: 6379
  ```

- **AWS API Gateway:**
  Configure throttling at the stage, resource, or method level:
  - Default: 10,000 requests/second, 5,000 burst.
  - Per-method: Custom limits for expensive operations.
  - Usage plans: Per-API-key limits for tiered access.

### Layer 4: Application-Level Rate Limiting

Implement fine-grained rate limiting in the application for business-logic-aware controls:

- Different limits for different user tiers.
- Endpoint-specific limits based on resource cost.
- Adaptive rate limiting based on server load.
- Rate limiting based on request complexity (e.g., GraphQL query cost).

### Layer 5: Circuit Breakers

Circuit breakers protect downstream services from cascading failures:

**States:**

1. **Closed:** Requests flow normally. Track failure rate.
2. **Open:** All requests are immediately rejected. Wait for timeout.
3. **Half-Open:** Allow a limited number of test requests. If they succeed, close the
   circuit. If they fail, re-open.

**When to use:**

- Protecting calls to external APIs that may be slow or unavailable.
- Preventing cascade failures in microservice architectures.
- Giving overloaded services time to recover.

---

## Bot Detection and CAPTCHA Integration

### Bot Detection Signals

Use multiple signals to distinguish bots from legitimate users:

- **Request rate:** Abnormally high request frequency.
- **User agent analysis:** Missing, outdated, or inconsistent user agents.
- **TLS fingerprinting (JA3/JA4):** Bot frameworks have distinct TLS fingerprints.
- **JavaScript execution:** Bots that do not execute JavaScript fail challenge pages.
- **Mouse/keyboard behavior:** Bots lack human-like interaction patterns.
- **IP reputation:** Known bot network IPs, data center IPs, Tor exit nodes.
- **Header anomalies:** Missing standard headers, unusual header ordering.
- **Session behavior:** No cookie support, no referrer, linear navigation patterns.

### CAPTCHA Integration

Deploy CAPTCHAs progressively based on risk level:

1. **No CAPTCHA:** Low-risk requests from known-good users.
2. **Invisible CAPTCHA:** Background risk analysis (reCAPTCHA v3, Cloudflare Turnstile).
3. **Interactive CAPTCHA:** Visual challenge for medium-risk requests.
4. **Blocking:** Reject high-risk requests outright.

**CAPTCHA placement:**

- Login and registration forms.
- Password reset flows.
- Contact forms and comment sections.
- API endpoints that are frequently abused.

**Important considerations:**

- Do not require CAPTCHAs on every request -- this destroys user experience.
- Use progressive challenges: start with invisible, escalate to interactive.
- Provide accessibility alternatives for visual CAPTCHAs.
- Rate limit CAPTCHA verification endpoints to prevent brute-force solving.

---

## Geo-Blocking and IP Reputation

### Geo-Blocking

Restrict access based on the geographic origin of requests:

- Block traffic from countries where the application has no users.
- Apply stricter rate limits to regions with high attack traffic.
- Use MaxMind GeoIP or similar databases for IP geolocation.

**Caveats:**

- Legitimate users with VPNs may be blocked.
- Geo-IP databases have accuracy limitations.
- Attackers use residential proxies to bypass geo-blocking.
- Geo-blocking alone is not a sufficient defense.

### IP Reputation

Use IP reputation lists to identify known malicious sources:

- **Threat intelligence feeds:** AbuseIPDB, Spamhaus, Project Honeypot.
- **Cloud provider IP ranges:** Flag or block requests from hosting provider IPs
  (legitimate users rarely access web applications from EC2 or GCP instances).
- **Tor exit node lists:** Flag or challenge requests from Tor exit nodes.
- **VPN/proxy detection:** Use services like IPQualityScore or MaxMind.

### Implementation

```nginx
# Nginx: Block specific countries using GeoIP2 module
geoip2 /usr/share/GeoIP/GeoLite2-Country.mmdb {
    auto_reload 60m;
    $geoip2_country_code default=XX source=$remote_addr country iso_code;
}

map $geoip2_country_code $blocked_country {
    default 0;
    XX      1;  # Unknown
    # Add countries to block
}

server {
    if ($blocked_country) {
        return 403;
    }
}
```

---

## Code Examples

### TypeScript -- Token Bucket Rate Limiter with Redis

```typescript
import Redis from "ioredis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number | null;
}

interface RateLimitConfig {
  maxTokens: number;      // Bucket capacity (burst size)
  refillRate: number;     // Tokens added per second
  keyPrefix: string;      // Redis key prefix
}

const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local max_tokens = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local data = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(data[1])
local last_refill = tonumber(data[2])

if tokens == nil then
    tokens = max_tokens
    last_refill = now
end

-- Refill tokens
local elapsed = math.max(0, now - last_refill)
tokens = math.min(max_tokens, tokens + (elapsed * refill_rate))

local allowed = 0
local remaining = math.floor(tokens)

if tokens >= 1 then
    tokens = tokens - 1
    allowed = 1
    remaining = math.floor(tokens)
end

redis.call('HMSET', key, 'tokens', tostring(tokens), 'last_refill', tostring(now))
redis.call('EXPIRE', key, math.ceil(max_tokens / refill_rate) * 2)

return {allowed, remaining}
`;

export class TokenBucketRateLimiter {
  private redis: Redis;
  private config: RateLimitConfig;

  constructor(redis: Redis, config: RateLimitConfig) {
    this.redis = redis;
    this.config = config;
  }

  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const now = Date.now() / 1000; // seconds

    const result = await this.redis.eval(
      TOKEN_BUCKET_SCRIPT,
      1,
      key,
      this.config.maxTokens,
      this.config.refillRate,
      now
    ) as [number, number];

    const allowed = result[0] === 1;
    const remaining = result[1];

    // Calculate reset time (time until bucket is full)
    const tokensNeeded = this.config.maxTokens - remaining;
    const resetAt = Math.ceil(now + tokensNeeded / this.config.refillRate);
    const retryAfter = allowed ? null : Math.ceil(1 / this.config.refillRate);

    return { allowed, remaining, resetAt, retryAfter };
  }
}

// Express middleware
import { Request, Response, NextFunction } from "express";

export function rateLimitMiddleware(
  limiter: TokenBucketRateLimiter,
  identifierFn: (req: Request) => string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = identifierFn(req);
    const result = await limiter.checkLimit(identifier);

    // Always set rate limit headers
    res.setHeader("RateLimit-Limit", limiter["config"].maxTokens.toString());
    res.setHeader("RateLimit-Remaining", result.remaining.toString());
    res.setHeader("RateLimit-Reset", result.resetAt.toString());

    if (!result.allowed) {
      res.setHeader("Retry-After", result.retryAfter!.toString());
      res.status(429).json({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please retry later.",
          retry_after: result.retryAfter,
        },
      });
      return;
    }

    next();
  };
}

// Usage
// const redis = new Redis({ host: "redis.internal", port: 6379 });
// const limiter = new TokenBucketRateLimiter(redis, {
//   maxTokens: 100,
//   refillRate: 10,  // 10 requests per second sustained
//   keyPrefix: "rl:api",
// });
//
// app.use("/api", rateLimitMiddleware(limiter, (req) => {
//   return req.user?.id || req.ip;
// }));
```

### TypeScript -- Sliding Window Counter

```typescript
import Redis from "ioredis";

interface SlidingWindowConfig {
  windowMs: number;   // Window size in milliseconds
  maxRequests: number; // Maximum requests per window
  keyPrefix: string;
}

const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local window_ms = tonumber(ARGV[1])
local max_requests = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local window_start = now - window_ms

-- Remove expired entries
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- Count current entries
local count = redis.call('ZCARD', key)

if count < max_requests then
    -- Add the new request
    redis.call('ZADD', key, now, now .. ':' .. math.random(1000000))
    redis.call('PEXPIRE', key, window_ms)
    return {1, max_requests - count - 1}  -- allowed, remaining
else
    redis.call('PEXPIRE', key, window_ms)
    return {0, 0}  -- rejected, remaining
end
`;

export class SlidingWindowRateLimiter {
  private redis: Redis;
  private config: SlidingWindowConfig;

  constructor(redis: Redis, config: SlidingWindowConfig) {
    this.redis = redis;
    this.config = config;
  }

  async checkLimit(identifier: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const now = Date.now();

    const result = await this.redis.eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      key,
      this.config.windowMs,
      this.config.maxRequests,
      now
    ) as [number, number];

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      resetAt: Math.ceil((now + this.config.windowMs) / 1000),
    };
  }
}
```

### Go -- Token Bucket with Redis

```go
package ratelimit

import (
    "context"
    "fmt"
    "net/http"
    "strconv"
    "time"

    "github.com/redis/go-redis/v9"
)

// TokenBucketLimiter implements distributed rate limiting using the token bucket
// algorithm with Redis as the backing store.
type TokenBucketLimiter struct {
    redis      *redis.Client
    maxTokens  float64
    refillRate float64  // tokens per second
    keyPrefix  string
}

// RateLimitResult contains the result of a rate limit check.
type RateLimitResult struct {
    Allowed    bool
    Remaining  int
    ResetAt    int64
    RetryAfter int
}

const tokenBucketScript = `
local key = KEYS[1]
local max_tokens = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local data = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(data[1]) or max_tokens
local last_refill = tonumber(data[2]) or now

local elapsed = math.max(0, now - last_refill)
tokens = math.min(max_tokens, tokens + (elapsed * refill_rate))

local allowed = 0
local remaining = math.floor(tokens)

if tokens >= 1 then
    tokens = tokens - 1
    allowed = 1
    remaining = math.floor(tokens)
end

redis.call('HMSET', key, 'tokens', tostring(tokens), 'last_refill', tostring(now))
redis.call('EXPIRE', key, math.ceil(max_tokens / refill_rate) * 2)

return {allowed, remaining}
`

// NewTokenBucketLimiter creates a new distributed token bucket rate limiter.
func NewTokenBucketLimiter(rdb *redis.Client, maxTokens, refillRate float64, keyPrefix string) *TokenBucketLimiter {
    return &TokenBucketLimiter{
        redis:      rdb,
        maxTokens:  maxTokens,
        refillRate: refillRate,
        keyPrefix:  keyPrefix,
    }
}

// Check performs a rate limit check for the given identifier.
func (l *TokenBucketLimiter) Check(ctx context.Context, identifier string) (*RateLimitResult, error) {
    key := fmt.Sprintf("%s:%s", l.keyPrefix, identifier)
    now := float64(time.Now().UnixMilli()) / 1000.0

    result, err := l.redis.Eval(ctx, tokenBucketScript, []string{key},
        l.maxTokens, l.refillRate, now).Int64Slice()
    if err != nil {
        return nil, fmt.Errorf("rate limit check failed: %w", err)
    }

    allowed := result[0] == 1
    remaining := int(result[1])
    tokensNeeded := l.maxTokens - float64(remaining)
    resetAt := int64(now + tokensNeeded/l.refillRate)

    var retryAfter int
    if !allowed {
        retryAfter = int(1.0 / l.refillRate)
        if retryAfter < 1 {
            retryAfter = 1
        }
    }

    return &RateLimitResult{
        Allowed:    allowed,
        Remaining:  remaining,
        ResetAt:    resetAt,
        RetryAfter: retryAfter,
    }, nil
}

// Middleware returns an HTTP middleware that applies rate limiting.
func (l *TokenBucketLimiter) Middleware(identifierFn func(*http.Request) string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            identifier := identifierFn(r)
            result, err := l.Check(r.Context(), identifier)
            if err != nil {
                // On Redis failure, allow the request (fail open) or reject (fail closed)
                // depending on your risk tolerance
                http.Error(w, "Internal server error", http.StatusInternalServerError)
                return
            }

            // Set rate limit headers
            w.Header().Set("RateLimit-Limit", strconv.FormatFloat(l.maxTokens, 'f', 0, 64))
            w.Header().Set("RateLimit-Remaining", strconv.Itoa(result.Remaining))
            w.Header().Set("RateLimit-Reset", strconv.FormatInt(result.ResetAt, 10))

            if !result.Allowed {
                w.Header().Set("Retry-After", strconv.Itoa(result.RetryAfter))
                w.WriteHeader(http.StatusTooManyRequests)
                w.Write([]byte(`{"error":{"code":"RATE_LIMIT_EXCEEDED","message":"Too many requests"}}`))
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
```

### Go -- Circuit Breaker

```go
package circuitbreaker

import (
    "errors"
    "sync"
    "time"
)

// State represents the current state of the circuit breaker.
type State int

const (
    StateClosed   State = iota // Normal operation
    StateOpen                  // All requests rejected
    StateHalfOpen              // Testing recovery
)

var (
    ErrCircuitOpen = errors.New("circuit breaker is open")
)

// CircuitBreaker implements the circuit breaker pattern.
type CircuitBreaker struct {
    mu              sync.Mutex
    state           State
    failureCount    int
    successCount    int
    failureThreshold int
    successThreshold int
    timeout         time.Duration
    lastFailure     time.Time
}

// New creates a new CircuitBreaker.
func New(failureThreshold, successThreshold int, timeout time.Duration) *CircuitBreaker {
    return &CircuitBreaker{
        state:            StateClosed,
        failureThreshold: failureThreshold,
        successThreshold: successThreshold,
        timeout:          timeout,
    }
}

// Execute runs the given function through the circuit breaker.
func (cb *CircuitBreaker) Execute(fn func() error) error {
    cb.mu.Lock()

    switch cb.state {
    case StateOpen:
        if time.Since(cb.lastFailure) > cb.timeout {
            cb.state = StateHalfOpen
            cb.successCount = 0
            cb.mu.Unlock()
        } else {
            cb.mu.Unlock()
            return ErrCircuitOpen
        }
    case StateClosed, StateHalfOpen:
        cb.mu.Unlock()
    }

    err := fn()

    cb.mu.Lock()
    defer cb.mu.Unlock()

    if err != nil {
        cb.failureCount++
        cb.lastFailure = time.Now()
        if cb.failureCount >= cb.failureThreshold {
            cb.state = StateOpen
        }
        return err
    }

    if cb.state == StateHalfOpen {
        cb.successCount++
        if cb.successCount >= cb.successThreshold {
            cb.state = StateClosed
            cb.failureCount = 0
        }
    } else {
        cb.failureCount = 0
    }

    return nil
}
```

### Python -- Sliding Window Rate Limiter with Redis

```python
import time
import redis
from typing import Optional


class SlidingWindowRateLimiter:
    """Distributed sliding window rate limiter using Redis sorted sets."""

    SLIDING_WINDOW_SCRIPT = """
    local key = KEYS[1]
    local window_ms = tonumber(ARGV[1])
    local max_requests = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local window_start = now - window_ms

    -- Remove expired entries
    redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

    -- Count current entries
    local count = redis.call('ZCARD', key)

    if count < max_requests then
        redis.call('ZADD', key, now, now .. ':' .. tostring(math.random(1000000)))
        redis.call('PEXPIRE', key, window_ms)
        return {1, max_requests - count - 1}
    else
        redis.call('PEXPIRE', key, window_ms)
        return {0, 0}
    end
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        window_seconds: int,
        max_requests: int,
        key_prefix: str = "rl",
    ):
        self.redis = redis_client
        self.window_ms = window_seconds * 1000
        self.max_requests = max_requests
        self.key_prefix = key_prefix
        self._script = self.redis.register_script(self.SLIDING_WINDOW_SCRIPT)

    def check_limit(self, identifier: str) -> dict:
        """
        Check if the request should be allowed.

        Args:
            identifier: The rate limit key (user ID, IP address, API key).

        Returns:
            dict with keys: allowed (bool), remaining (int), reset_at (int),
            retry_after (int or None).
        """
        key = f"{self.key_prefix}:{identifier}"
        now = int(time.time() * 1000)

        result = self._script(
            keys=[key],
            args=[self.window_ms, self.max_requests, now],
        )

        allowed = result[0] == 1
        remaining = result[1]
        reset_at = int((now + self.window_ms) / 1000)
        retry_after = None if allowed else int(self.window_ms / 1000)

        return {
            "allowed": allowed,
            "remaining": remaining,
            "reset_at": reset_at,
            "retry_after": retry_after,
        }


# Flask middleware example
from functools import wraps
from flask import Flask, request, jsonify, g


def rate_limit(limiter: SlidingWindowRateLimiter, key_func=None):
    """Flask decorator for rate limiting."""

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            identifier = key_func(request) if key_func else request.remote_addr
            result = limiter.check_limit(identifier)

            # Set headers on the response
            g.rate_limit_headers = {
                "RateLimit-Limit": str(limiter.max_requests),
                "RateLimit-Remaining": str(result["remaining"]),
                "RateLimit-Reset": str(result["reset_at"]),
            }

            if not result["allowed"]:
                response = jsonify({
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": "Too many requests. Please retry later.",
                        "retry_after": result["retry_after"],
                    }
                })
                response.status_code = 429
                response.headers["Retry-After"] = str(result["retry_after"])
                for key, value in g.rate_limit_headers.items():
                    response.headers[key] = value
                return response

            return f(*args, **kwargs)

        return wrapper
    return decorator


# Usage:
# r = redis.Redis(host="redis.internal", port=6379)
# limiter = SlidingWindowRateLimiter(r, window_seconds=60, max_requests=100)
#
# @app.route("/api/data")
# @rate_limit(limiter, key_func=lambda req: req.headers.get("X-API-Key", req.remote_addr))
# def get_data():
#     return jsonify({"data": "..."})
```

### Python -- Adaptive Rate Limiting

```python
import psutil
import time


class AdaptiveRateLimiter:
    """
    Adjusts rate limits based on server load.
    Reduces limits when CPU or memory usage is high.
    """

    def __init__(
        self,
        base_limiter: SlidingWindowRateLimiter,
        cpu_threshold: float = 80.0,
        memory_threshold: float = 85.0,
        reduction_factor: float = 0.5,
        check_interval: int = 10,
    ):
        self.base_limiter = base_limiter
        self.cpu_threshold = cpu_threshold
        self.memory_threshold = memory_threshold
        self.reduction_factor = reduction_factor
        self.check_interval = check_interval
        self._last_check = 0
        self._load_factor = 1.0

    def _update_load_factor(self):
        now = time.time()
        if now - self._last_check < self.check_interval:
            return

        self._last_check = now
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory_percent = psutil.virtual_memory().percent

        if cpu_percent > self.cpu_threshold or memory_percent > self.memory_threshold:
            self._load_factor = self.reduction_factor
        else:
            self._load_factor = 1.0

    def check_limit(self, identifier: str) -> dict:
        self._update_load_factor()

        # Temporarily adjust max_requests based on load
        original_max = self.base_limiter.max_requests
        self.base_limiter.max_requests = int(original_max * self._load_factor)
        result = self.base_limiter.check_limit(identifier)
        self.base_limiter.max_requests = original_max

        return result
```

---

## Best Practices

### BP-1: Apply Rate Limiting at Multiple Layers

Implement rate limiting at the CDN/WAF, reverse proxy, API gateway, and application level.
Each layer catches different types of abuse and provides redundancy if one layer fails.

### BP-2: Use Different Limits for Different Endpoints

Set rate limits based on the resource cost of each endpoint. A search endpoint that triggers
database queries should have a lower limit than a static content endpoint. Expensive operations
(export, report generation, bulk operations) should have the strictest limits.

### BP-3: Return Standard Rate Limit Headers

Always include `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers on
successful responses. Include `Retry-After` on 429 responses. This allows well-behaved clients
to self-regulate.

### BP-4: Use Redis for Distributed Rate Limiting

Use Redis with Lua scripts for atomic rate limit operations across multiple application
instances. Use hash tags for consistent key placement in Redis Cluster. Set appropriate TTLs
on all keys.

### BP-5: Implement Composite Rate Limiting Keys

Combine per-IP, per-user, per-API-key, and per-endpoint rate limits. Apply them in order
from most specific to most general. A request must pass all applicable limits.

### BP-6: Protect Against Slowloris and Slow Attacks

Set strict timeouts for client connections: `client_header_timeout`, `client_body_timeout`,
`send_timeout`, and `keepalive_timeout`. Use a reverse proxy that buffers requests before
forwarding to the application server.

### BP-7: Use Linear-Time Regex Engines

Use RE2, Rust's regex crate, or equivalent linear-time regex engines for any user-supplied
pattern matching. Set execution timeouts on all regex operations. Never allow users to
supply arbitrary regex patterns directly.

### BP-8: Implement Circuit Breakers for External Dependencies

Wrap calls to external APIs, databases, and microservices with circuit breakers. When a
downstream service fails repeatedly, open the circuit to prevent cascade failures and give
the service time to recover.

### BP-9: Deploy Progressive Bot Detection

Start with invisible CAPTCHA (reCAPTCHA v3, Turnstile) and escalate to interactive challenges
only for suspicious traffic. Combine CAPTCHA with TLS fingerprinting, behavioral analysis,
and IP reputation for comprehensive bot detection.

### BP-10: Plan for Fail-Open vs. Fail-Closed

Decide how rate limiting should behave when the backing store (Redis) is unavailable.
Fail-open allows all requests through (maintains availability, loses protection). Fail-closed
rejects all requests (maintains protection, loses availability). Choose based on your risk
profile and implement fallback logic.

---

## Anti-Patterns

### AP-1: Rate Limiting Only at the Application Level

**Wrong:** Implement rate limiting only in application code with no infrastructure-level
protection.
**Problem:** The application server is already processing the request before rate limiting
is checked. Volumetric attacks can overwhelm the server before the rate limiter runs.

### AP-2: Using In-Memory Rate Limiting in a Multi-Instance Deployment

**Wrong:** Use a local in-memory counter for rate limiting behind a load balancer.
**Problem:** Each instance tracks only its own requests. With N instances, clients get
N times the intended limit.

### AP-3: Applying Uniform Rate Limits Across All Endpoints

**Wrong:** Set the same rate limit (e.g., 100/minute) for every endpoint.
**Problem:** Expensive endpoints (search, export, report generation) need lower limits
than lightweight endpoints (health check, static content). A single limit either starves
normal traffic or under-protects expensive operations.

### AP-4: Not Returning Rate Limit Headers

**Wrong:** Return 429 without `Retry-After` or rate limit headers.
**Problem:** Clients cannot self-regulate. They retry immediately, causing more load.
Without `Retry-After`, client retry logic becomes unpredictable.

### AP-5: Rate Limiting by IP Only, Without Considering Shared IPs

**Wrong:** Set aggressive per-IP limits without considering NAT, corporate proxies, and
shared hosting.
**Problem:** All users behind a corporate proxy share one IP. Aggressive per-IP limits
block legitimate users.

### AP-6: Using System.currentTimeMillis or Date.now for Window Boundaries

**Wrong:** Use the application server's local clock for rate limit window calculations in
a distributed system.
**Problem:** Clock skew between servers causes inconsistent rate limiting. Use Redis server
time or a monotonic clock source.

### AP-7: Ignoring Application-Layer DDoS Vectors

**Wrong:** Focus only on volumetric DDoS protection (L3/L4) and ignore application-layer
attacks.
**Problem:** Slowloris, ReDoS, hash collision attacks, and API abuse bypass L3/L4
protections. Application-layer attacks require application-level defenses.

### AP-8: Hardcoding Rate Limits Without Configuration

**Wrong:** Embed rate limit values directly in application code.
**Problem:** Changing limits requires code deployment. Rate limits need to be adjusted
dynamically based on traffic patterns, incidents, and business requirements. Store limits
in configuration (environment variables, configuration service, feature flags).

---

## Enforcement Checklist

### Rate Limiting Infrastructure

- [ ] Rate limiting is implemented at multiple layers (CDN, reverse proxy, application).
- [ ] A distributed backing store (Redis) is used for rate limiting state.
- [ ] Redis Lua scripts are used for atomic rate limit operations.
- [ ] Rate limit keys use hash tags for Redis Cluster compatibility.
- [ ] All rate limit keys have appropriate TTLs to prevent memory leaks.
- [ ] Fail-open or fail-closed behavior is explicitly configured for Redis failures.

### Rate Limit Configuration

- [ ] Different endpoints have different rate limits based on resource cost.
- [ ] Rate limits are configurable without code deployment.
- [ ] Per-IP, per-user, and per-API-key limits are implemented.
- [ ] Rate limits account for shared IPs (NAT, proxies) with reasonable per-IP limits.
- [ ] Login and authentication endpoints have strict rate limits.
- [ ] Expensive operations (search, export, bulk) have low rate limits.

### Response Headers

- [ ] `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` headers are set on
      all successful API responses.
- [ ] 429 responses include `Retry-After` header.
- [ ] 429 responses include a JSON body with error code and retry information.
- [ ] Rate limit headers do not leak internal implementation details.

### DDoS Protection

- [ ] A CDN with DDoS mitigation is deployed (Cloudflare, AWS Shield, Akamai).
- [ ] Nginx or reverse proxy has `limit_req` and `limit_conn` configured.
- [ ] Slowloris protection is in place (strict timeouts for headers, body, and keepalive).
- [ ] Maximum request body size is configured.
- [ ] Maximum number of concurrent connections per IP is limited.

### Application-Layer Defenses

- [ ] Regex patterns are evaluated with linear-time engines or have execution timeouts.
- [ ] Maximum POST parameter count is limited.
- [ ] Maximum JSON depth and size are limited.
- [ ] GraphQL queries have depth and complexity limits.
- [ ] File upload sizes are limited.
- [ ] Pagination enforces maximum page sizes.
- [ ] Circuit breakers are implemented for external service calls.

### Bot Detection

- [ ] Bot detection is implemented using multiple signals (rate, fingerprinting, behavior).
- [ ] CAPTCHA is deployed progressively (invisible first, interactive for suspicious traffic).
- [ ] CAPTCHA verification endpoints are rate limited.
- [ ] IP reputation lists are integrated and updated regularly.
- [ ] Tor exit nodes and hosting provider IPs are flagged or challenged.

### Monitoring and Alerting

- [ ] Rate-limited requests (429 responses) are logged and monitored.
- [ ] Alerts fire on sudden spikes in 429 responses (indicates potential attack).
- [ ] Alerts fire on sudden spikes in overall request volume.
- [ ] Rate limit metrics are available in dashboards (requests/second, rejection rate).
- [ ] Geo-distribution of traffic is monitored for anomalies.
- [ ] Circuit breaker state changes are logged and alerted on.

### Testing

- [ ] Load tests verify rate limiting behavior under high traffic.
- [ ] Tests confirm 429 responses include correct headers and body.
- [ ] Tests confirm rate limiting works across multiple application instances.
- [ ] Chaos engineering tests verify behavior when Redis is unavailable.
- [ ] DDoS simulation exercises are conducted periodically.
- [ ] ReDoS vulnerability scanning is part of the CI/CD pipeline.

---

## References

- IETF RFC 6585: Additional HTTP Status Codes (429 Too Many Requests)
  https://datatracker.ietf.org/doc/html/rfc6585
- IETF Draft: RateLimit Header Fields for HTTP
  https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
- OWASP: Denial of Service Cheat Sheet
  https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html
- Cloudflare: Rate Limiting Documentation
  https://developers.cloudflare.com/waf/rate-limiting-rules/
- Nginx: Rate Limiting Documentation
  https://www.nginx.com/blog/rate-limiting-nginx/
- Redis: Distributed Locks and Rate Limiting
  https://redis.io/docs/manual/patterns/
- OWASP: ReDoS
  https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS
