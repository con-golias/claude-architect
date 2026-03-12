# CDN Fundamentals for Scale

> **Domain:** Scalability > CDN and Edge
> **Importance:** High
> **Last Updated:** 2025
> **Cross-ref:** [09-performance/caching-strategies/cdn-caching.md](../../09-performance/caching-strategies/cdn-caching.md) (performance-focused CDN caching); this document covers the **scalability architecture** of CDN: global distribution, cache hierarchy, and origin protection at scale.

---

## 1. CDN Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│  CDN Request Flow                                                  │
│                                                                    │
│  Client ──► DNS ──► Nearest Edge PoP ──► [Cache HIT?] ──► Client  │
│                          │                                         │
│                     [Cache MISS]                                   │
│                          │                                         │
│                    L2 Regional Hub ──► [Cache HIT?] ──► Edge       │
│                          │                                         │
│                     [Cache MISS]                                   │
│                          │                                         │
│                    Origin Shield ──► Origin Server ──► Shield      │
│                                                      ──► Edge     │
│                                                      ──► Client   │
│                                                                    │
│  Each layer absorbs traffic:                                       │
│    L1 Edge:        serves ~85-95% of requests                     │
│    L2 Regional:    serves ~3-10% (misses from L1)                 │
│    Origin Shield:  serves ~1-3% (misses from L2)                  │
│    Origin:         receives ~0.5-2% of total traffic              │
└────────────────────────────────────────────────────────────────────┘
```

## 2. Provider Comparison

| Feature | CloudFront | Cloudflare | Fastly | Akamai |
|---------|-----------|------------|--------|--------|
| PoPs | 600+ | 310+ | 90+ | 4100+ |
| Edge Compute | Lambda@Edge, Functions | Workers (V8 isolates) | Compute@Edge (Wasm) | EdgeWorkers |
| Purge Speed | 5-10s (path), instant (tag) | ~30s global | <150ms (instant purge) | 5-7s |
| Origin Shield | Yes (regional edge cache) | Tiered Cache (free) | Shielding (per backend) | SureRoute |
| Pricing Model | Request + transfer | Flat rate (most plans) | Request-based | Contract-based |
| Best For | AWS-native stacks | General purpose, DDoS | Real-time purge needs | Enterprise, media |

## 3. Cache Hierarchy: L1 Edge, L2 Regional, Origin Shield

```
┌──────────────────────────────────────────────────────────┐
│  Three-Tier Cache Hierarchy                               │
│                                                          │
│  Tier      │  PoP Count  │  TTL Strategy  │  Hit Rate   │
│  ──────────┼─────────────┼────────────────┼──────────── │
│  L1 Edge   │  200-600    │  Short (60s)   │  85-95%     │
│  L2 Region │  10-30      │  Medium (5m)   │  3-10%      │
│  Shield    │  1-3        │  Long (1h)     │  1-3%       │
│  Origin    │  1          │  N/A           │  <2%        │
│                                                          │
│  L1 miss → L2 check (same continent)                    │
│  L2 miss → Shield check (single convergence point)      │
│  Shield miss → Origin fetch (only source of truth)      │
└──────────────────────────────────────────────────────────┘
```

## 4. Terraform: CloudFront Distribution with Origin Shield

```hcl
# CloudFront distribution with origin shield and cache policies
resource "aws_cloudfront_distribution" "app" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = ["app.example.com"]
  price_class         = "PriceClass_All"  # All edge locations globally

  origin {
    domain_name = aws_lb.app.dns_name
    origin_id   = "app-origin"

    origin_shield {
      enabled              = true
      origin_shield_region = "us-east-1"  # Collapse all misses here
    }

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "app-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id            = aws_cloudfront_cache_policy.optimized.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.forward_headers.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # Immutable assets: long TTL, versioned by hash
  ordered_cache_behavior {
    path_pattern           = "/assets/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "app-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    min_ttl                = 86400
    default_ttl            = 2592000   # 30 days
    max_ttl                = 31536000  # 1 year
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.app.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

resource "aws_cloudfront_cache_policy" "optimized" {
  name        = "optimized-cache-policy"
  default_ttl = 60
  max_ttl     = 86400
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    headers_config {
      header_behavior = "whitelist"
      headers { items = ["Accept-Encoding", "Accept"] }
    }
    query_strings_config {
      query_string_behavior = "whitelist"
      query_strings { items = ["page", "limit", "sort"] }
    }
    cookies_config { cookie_behavior = "none" }
  }
}
```

## 5. Cloudflare Workers: Cache Key Normalization

```typescript
// Normalize cache keys to maximize hit ratio at scale
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Strip tracking parameters that do not affect content
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign",
      "utm_term", "utm_content", "fbclid", "gclid", "ref",
    ];
    trackingParams.forEach((p) => url.searchParams.delete(p));

    // Sort remaining query params for deterministic keys
    url.searchParams.sort();

    // Normalize path: lowercase, strip trailing slash
    url.pathname = url.pathname.toLowerCase().replace(/\/+$/, "") || "/";

    const cacheKey = new Request(url.toString(), request);
    const cache = caches.default;

    let response = await cache.match(cacheKey);
    if (!response) {
      response = await fetch(request);
      response = new Response(response.body, response);
      response.headers.set("Cache-Tag", `path:${url.pathname}`);
      if (response.ok) {
        await cache.put(cacheKey, response.clone());
      }
    }
    return response;
  },
};
```

## 6. Cache Invalidation Strategies

```typescript
// Strategy 1: Versioned URLs (preferred for assets)
// /assets/app.a1b2c3d4.js — content-hash in filename
// No purge needed: new deploy = new URL = new cache entry

// Strategy 2: Tag-based purge (preferred for API/HTML)
async function purgeByTag(tags: string[]): Promise<void> {
  await fetch(
    `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tags }),
    }
  );
}

// Strategy 3: Stale-while-revalidate (preferred for dynamic content)
// CDN serves stale immediately while refetching in background
function setCacheHeaders(res: Response, ttlSeconds: number): void {
  res.headers.set(
    "Cache-Control",
    `public, max-age=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 5}`
  );
  res.headers.set(
    "CDN-Cache-Control",
    `max-age=${ttlSeconds * 10}, stale-if-error=86400`
  );
}
```

## 7. Origin Protection: Request Coalescing

```go
// Go origin server — collapse concurrent cache misses for the same key
package main

import (
	"net/http"
	"sync"
	"time"
)

type coalescer struct {
	mu      sync.Mutex
	inflight map[string]*call
}

type call struct {
	wg  sync.WaitGroup
	val []byte
	err error
}

var coal = &coalescer{inflight: make(map[string]*call)}

func (c *coalescer) Do(key string, fn func() ([]byte, error)) ([]byte, error) {
	c.mu.Lock()
	if existing, ok := c.inflight[key]; ok {
		c.mu.Unlock()
		existing.wg.Wait() // Wait for the in-flight request
		return existing.val, existing.err
	}
	entry := &call{}
	entry.wg.Add(1)
	c.inflight[key] = entry
	c.mu.Unlock()

	entry.val, entry.err = fn()
	entry.wg.Done()

	// Remove after brief window to allow coalescing
	time.AfterFunc(100*time.Millisecond, func() {
		c.mu.Lock()
		delete(c.inflight, key)
		c.mu.Unlock()
	})
	return entry.val, entry.err
}

func handler(w http.ResponseWriter, r *http.Request) {
	data, err := coal.Do(r.URL.Path, func() ([]byte, error) {
		return fetchFromDatabase(r.URL.Path)
	})
	if err != nil {
		http.Error(w, "internal error", 500)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=60")
	w.Write(data)
}
```

## 8. Monitoring: Cache Hit Ratio and TTFB

```python
# Python — monitor CDN cache performance from analytics API
import httpx
from datetime import datetime, timedelta

class CDNMonitor:
    def __init__(self, zone_id: str, api_token: str):
        self.zone_id = zone_id
        self.api_token = api_token
        self.base_url = "https://api.cloudflare.com/client/v4"

    async def get_cache_hit_ratio(self, hours: int = 24) -> dict:
        """Fetch cache hit ratio by region. Target: >90% static, >60% API."""
        since = (datetime.utcnow() - timedelta(hours=hours)).isoformat() + "Z"
        query = """
        query {
          viewer {
            zones(filter: {zoneTag: "%s"}) {
              httpRequestsAdaptiveGroups(
                filter: {datetime_gt: "%s"}
                limit: 10000
              ) {
                dimensions { coloCode }
                sum { cachedRequests requests }
              }
            }
          }
        }
        """ % (self.zone_id, since)

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/graphql",
                headers={"Authorization": f"Bearer {self.api_token}"},
                json={"query": query},
            )
            data = resp.json()

        results = {}
        for group in data["data"]["viewer"]["zones"][0]["httpRequestsAdaptiveGroups"]:
            colo = group["dimensions"]["coloCode"]
            total = group["sum"]["requests"]
            cached = group["sum"]["cachedRequests"]
            ratio = cached / total if total > 0 else 0
            results[colo] = {"hit_ratio": round(ratio, 3), "total": total}

            # Alert on low hit ratio
            if ratio < 0.6 and total > 1000:
                print(f"ALERT: {colo} cache hit ratio {ratio:.1%} below threshold")

        return results
```

---

## 9. Best Practices

1. **Enable origin shield on every CDN distribution.** Collapse N edge-miss requests into a single origin fetch; reduce origin load by 80-95%.
2. **Use versioned URLs for all static assets.** Content-hash filenames (`app.a3f2.js`) eliminate purge operations entirely; set CDN TTL to 30 days.
3. **Separate CDN TTL from browser TTL.** Use `CDN-Cache-Control` for long edge caching and `Cache-Control` for short browser caching.
4. **Normalize cache keys aggressively.** Strip tracking parameters, sort query strings, and lowercase paths to prevent duplicate cache entries.
5. **Prefer tag-based purge over URL-based or zone-wide purge.** Tag purge invalidates only related content without collateral cache eviction.
6. **Set `stale-while-revalidate` on every cacheable response.** Serve instantly from edge while refetching in the background; eliminates synchronous origin waits.
7. **Set `stale-if-error=86400` to survive origin outages.** The CDN serves stale content for up to 24 hours when the origin returns 5xx or is unreachable.
8. **Implement request coalescing at the origin.** When cache expires, N simultaneous edge misses create a thundering herd; collapse them into a single backend call.
9. **Monitor cache hit ratio per PoP region.** Aggregate ratios mask region-specific misconfigurations; target >90% for static and >60% for API endpoints.
10. **Whitelist only content-affecting query parameters in the cache key.** Forwarding all query strings to the cache key destroys hit ratio with irrelevant variation.

---

## 10. Anti-Patterns

| # | Anti-Pattern | Problem | Correct Approach |
|---|-------------|---------|-----------------|
| 1 | Full zone purge on every deploy | Evicts all cached content globally; origin load spikes 10-50x | Use tag-based purge or versioned URLs |
| 2 | No origin shield configured | Each of 300+ PoPs independently fetches on cache miss; origin overwhelmed | Enable origin shield or tiered caching |
| 3 | Same TTL for CDN and browser | Cannot cache long at edge while keeping browser fresh; either stale browsers or low CDN hit ratio | Use CDN-Cache-Control separately |
| 4 | Caching responses with Set-Cookie | CDN serves one user's session cookie to all subsequent users | Never cache responses that set cookies; mark as `private` |
| 5 | Tracking params in cache key | `?utm_source=a` and `?utm_source=b` create separate entries for identical content | Strip non-content query parameters |
| 6 | No stale-if-error directive | Origin failure causes CDN to forward 5xx errors to all users | Set `stale-if-error=86400` on cacheable responses |
| 7 | Hard purge on high-traffic paths | Simultaneous miss storm after purge overwhelms origin | Use soft purge (stale-while-revalidate) |
| 8 | Ignoring Vary header explosion | `Vary: *` or `Vary: Cookie` creates a cache entry per unique user | Vary only on `Accept-Encoding` and content-negotiation headers |

---

## 11. Enforcement Checklist

- [ ] Origin shield or tiered caching enabled on CDN distribution
- [ ] Static assets use content-hash filenames with TTL >= 30 days
- [ ] CDN-Cache-Control is set separately from browser Cache-Control
- [ ] Cache key strips tracking parameters (utm_*, fbclid, gclid)
- [ ] Query parameters are sorted for deterministic cache keys
- [ ] Cache-Tag header set on all cacheable responses for targeted purge
- [ ] `stale-while-revalidate` set on dynamic cacheable endpoints
- [ ] `stale-if-error=86400` set for origin failure resilience
- [ ] Request coalescing implemented at origin for thundering-herd protection
- [ ] Cache hit ratio monitored per PoP with alert threshold <60%
- [ ] Vary header limited to `Accept-Encoding` (no `Cookie`, no `*`)
- [ ] No Set-Cookie present on CDN-cached responses
- [ ] Terraform/IaC manages CDN distribution configuration
