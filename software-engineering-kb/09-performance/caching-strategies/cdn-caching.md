# CDN Caching Performance

> Domain: Performance Engineering > CDN Edge Caching
> Importance: CRITICAL
> Complements: 06-backend/caching/http-caching.md (headers) — this doc covers edge performance tuning, cache key optimization, multi-CDN, origin shielding

**Core Rule: ALWAYS set CDN-specific cache headers separately from browser cache headers. ALWAYS use origin shield to reduce origin load. ALWAYS purge by tag or key — NEVER purge entire zones. ALWAYS measure cache hit ratio at the edge.**

---

## 1. CDN Cache-Control Layering

```
┌────────────────────────────────────────────────────────────────┐
│  Cache-Control Header Precedence at CDN Edge                   │
│                                                                │
│  CDN-Cache-Control (or Surrogate-Control)                     │
│    ↓ overrides                                                │
│  s-maxage in Cache-Control                                    │
│    ↓ overrides                                                │
│  max-age in Cache-Control                                     │
│                                                                │
│  CDN-Cache-Control: max-age=86400          ← CDN: 24 hours   │
│  Cache-Control: public, max-age=60         ← Browser: 60 sec │
│                                                                │
│  CDN strips CDN-Cache-Control before forwarding to browser.   │
│  Browser only sees: Cache-Control: public, max-age=60         │
└────────────────────────────────────────────────────────────────┘
```

```typescript
// Express middleware: separate CDN and browser cache lifetimes
function cdnCache(opts: { cdnMaxAge: number; browserMaxAge: number; swr?: number }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const directives = [`public`, `max-age=${opts.browserMaxAge}`];
    if (opts.swr) directives.push(`stale-while-revalidate=${opts.swr}`);
    res.set("Cache-Control", directives.join(", "));
    // CDN-specific: longer TTL at edge, stripped before browser
    res.set("CDN-Cache-Control", `max-age=${opts.cdnMaxAge}`);
    // Surrogate-Control for Varnish/Fastly
    res.set("Surrogate-Control", `max-age=${opts.cdnMaxAge}`);
    next();
  };
}

// Static assets: CDN 7 days, browser 1 year (immutable with hash)
app.use("/assets", cdnCache({ cdnMaxAge: 604800, browserMaxAge: 31536000 }));

// API: CDN 5 min, browser 10 sec, SWR 30 sec
app.get("/api/products", cdnCache({ cdnMaxAge: 300, browserMaxAge: 10, swr: 30 }), handler);

// HTML: CDN 60 sec, browser always revalidates
app.get("/*", (req, res, next) => {
  res.set("Cache-Control", "no-cache");
  res.set("CDN-Cache-Control", "max-age=60");
  next();
}, renderPage);
```

## 2. Cache Rules by Content Type

| Content Type | CDN TTL | Browser TTL | SWR | Cache Key | Notes |
|-------------|---------|-------------|-----|-----------|-------|
| Hashed JS/CSS/fonts | 30 days | 1 year, immutable | N/A | URL path | Hash changes = new URL |
| Images (hashed) | 30 days | 1 year, immutable | N/A | URL path | Content-addressed |
| HTML pages | 60s | no-cache | 30s | URL + cookies=none | Revalidate always |
| Public API (lists) | 5 min | 10s | 60s | URL + query params | Vary: Accept-Encoding |
| User API (private) | DO NOT cache at CDN | private, no-cache | N/A | N/A | Pass-through to origin |
| Video/media | 7 days | 1 day | N/A | URL path | Large; minimize origin |

## 3. Cache Key Customization

```typescript
// Cache key = what the CDN uses to identify unique cached responses
// Default: scheme + host + path + query string
// Customize to INCREASE hit ratio by removing irrelevant variation

// Cloudflare Workers — custom cache key
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Normalize cache key: remove tracking params, lowercase
    const cacheUrl = new URL(request.url);
    // Strip analytics parameters that don't change content
    ["utm_source", "utm_medium", "utm_campaign", "fbclid", "gclid"].forEach(
      (p) => cacheUrl.searchParams.delete(p)
    );
    // Sort remaining params for deterministic cache keys
    cacheUrl.searchParams.sort();

    const cacheKey = new Request(cacheUrl.toString(), request);

    const cache = caches.default;
    let response = await cache.match(cacheKey);

    if (!response) {
      response = await fetch(request);
      response = new Response(response.body, response);
      response.headers.set("Cache-Control", "public, max-age=300");
      // Tag for targeted purging
      response.headers.set("Cache-Tag", `products, page-${url.pathname}`);
      await cache.put(cacheKey, response.clone());
    }
    return response;
  },
};
```

```go
// Go — generate normalized cache key for Varnish/Nginx
func NormalizeCacheKey(r *http.Request) string {
    u := *r.URL
    q := u.Query()
    // Remove tracking params
    for _, p := range []string{"utm_source", "utm_medium", "fbclid"} {
        q.Del(p)
    }
    // Sort for determinism
    u.RawQuery = sortQueryParams(q)
    return u.String()
}

func sortQueryParams(q url.Values) string {
    keys := make([]string, 0, len(q))
    for k := range q { keys = append(keys, k) }
    sort.Strings(keys)
    var buf strings.Builder
    for i, k := range keys {
        if i > 0 { buf.WriteByte('&') }
        buf.WriteString(url.QueryEscape(k) + "=" + url.QueryEscape(q.Get(k)))
    }
    return buf.String()
}
```

## 4. Instant Purge and Invalidation APIs

```typescript
// Tag-based purging — O(1) invalidation of related content
// On content publish: purge all pages referencing that content

// Set cache tags on response
app.get("/api/products/:id", (req, res) => {
  const productId = req.params.id;
  // Multiple tags: purge by product, by category, by all products
  res.set("Cache-Tag", `product-${productId}, category-${product.categoryId}, all-products`);
  res.set("CDN-Cache-Control", "max-age=3600");
  res.json(product);
});

// Purge by tag on mutation
async function purgeProductCache(productId: string, categoryId: string): Promise<void> {
  // Cloudflare: purge by cache tag
  await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tags: [`product-${productId}`] }),
  });

  // Fastly: surrogate key purge (instant, soft purge preferred)
  await fetch(`https://api.fastly.com/service/${SERVICE_ID}/purge/${`product-${productId}`}`, {
    method: "POST",
    headers: { "Fastly-Key": FASTLY_TOKEN, "Fastly-Soft-Purge": "1" },
  });
}

// Soft purge vs hard purge:
// Hard purge: immediately removes cached content. Next request MUST hit origin.
// Soft purge: marks content as stale. CDN serves stale while fetching fresh from origin.
// ALWAYS prefer soft purge — it prevents origin load spikes.
```

## 5. Origin Shield / Mid-Tier Caching

```
┌────────────────────────────────────────────────────────────────┐
│  Without Origin Shield          With Origin Shield             │
│                                                                │
│  Edge NYC ──┐                  Edge NYC ──┐                   │
│  Edge LON ──┤──► Origin        Edge LON ──┤──► Shield ──► Origin
│  Edge TKY ──┤                  Edge TKY ──┤    (us-east)      │
│  Edge SYD ──┘                  Edge SYD ──┘                   │
│                                                                │
│  N edges × cache miss =        N misses collapse to 1 origin  │
│  N origin requests             request via shield              │
│                                                                │
│  Origin load: HIGH             Origin load: LOW                │
│  Shield reduces origin traffic by 80-95% for cacheable content│
└────────────────────────────────────────────────────────────────┘
```

```typescript
// Cloudflare: origin shield is "Tiered Cache" — enable in dashboard
// Fastly: shield POP configured per backend
// Custom: implement mid-tier cache with Varnish or Nginx

// Nginx as origin shield (reverse proxy cache)
/*
proxy_cache_path /var/cache/nginx/shield levels=1:2 keys_zone=shield:100m
                 max_size=10g inactive=24h use_temp_path=off;

server {
    location / {
        proxy_cache shield;
        proxy_cache_valid 200 1h;
        proxy_cache_valid 404 1m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503;
        proxy_cache_lock on;           # Collapse concurrent requests for same key
        proxy_cache_lock_timeout 5s;
        add_header X-Cache-Status $upstream_cache_status;
        proxy_pass http://origin;
    }
}
*/
```

## 6. Multi-CDN Strategy

```typescript
// Multi-CDN: use different CDNs for redundancy and geo-optimization
// DNS-based routing: GeoDNS or latency-based routing to select CDN

interface CDNConfig {
  name: string;
  purgeEndpoint: string;
  headers: Record<string, string>;
}

class MultiCDNPurger {
  constructor(private cdns: CDNConfig[]) {}

  async purge(tags: string[]): Promise<void> {
    // Purge ALL CDNs in parallel — consistency across edges
    const results = await Promise.allSettled(
      this.cdns.map((cdn) =>
        fetch(cdn.purgeEndpoint, {
          method: "POST",
          headers: { ...cdn.headers, "Content-Type": "application/json" },
          body: JSON.stringify({ tags }),
        })
      )
    );

    for (const [i, result] of results.entries()) {
      if (result.status === "rejected") {
        logger.error(`Purge failed on ${this.cdns[i].name}`, { error: result.reason });
        // Queue for retry — stale data on one CDN is worse than delayed purge
        await retryQueue.add({ cdn: this.cdns[i].name, tags });
      }
    }
  }
}

// CDN selection for multi-CDN:
// 1. Primary CDN for 80% traffic (best price/performance)
// 2. Secondary CDN for failover and specific geo regions
// 3. DNS health checks auto-failover on CDN outage
```

## 7. Stale-While-Revalidate at Edge

```typescript
// Edge-side SWR: CDN serves stale content while fetching fresh in background
// This is the MOST IMPORTANT CDN performance directive

app.get("/api/catalog", (req, res) => {
  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
  // Behavior at CDN edge:
  // 0-30s:   serve fresh cached response (HIT)
  // 30-330s: serve stale cached response (STALE), fetch fresh in background
  // 330s+:   cache expired, synchronous origin fetch (MISS)
  //
  // Result: 91% of the 330s window serves instantly from edge
  // Only first request after full expiry experiences origin latency
  res.json(catalog);
});

// stale-if-error: serve stale when origin is DOWN
app.get("/api/products", (req, res) => {
  res.set("Cache-Control",
    "public, max-age=60, stale-while-revalidate=300, stale-if-error=86400");
  // If origin returns 5xx or is unreachable, serve stale for up to 24 hours
  // Prevents CDN from serving errors during origin outages
  res.json(products);
});
```

## 8. Measuring CDN Cache Performance

```typescript
// Add cache status header to track HIT/MISS/STALE at origin
app.use((req, res, next) => {
  res.on("finish", () => {
    // CDNs typically set these headers:
    // X-Cache: HIT | MISS | STALE | EXPIRED
    // CF-Cache-Status: HIT | MISS | DYNAMIC | EXPIRED | STALE
    // X-Cache-Hits: 42 (number of times served from cache)
    const cacheStatus = req.headers["x-cache"] || req.headers["cf-cache-status"];
    metrics.increment("cdn.request", {
      status: cacheStatus || "origin",
      path: req.route?.path || "unknown",
    });
  });
  next();
});

// Monitor CDN hit ratio from CDN analytics API
async function getCDNHitRatio(): Promise<number> {
  // Cloudflare GraphQL Analytics API
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${CF_TOKEN}` },
    body: JSON.stringify({
      query: `{ viewer { zones(filter: {zoneTag: "${ZONE_ID}"}) {
        httpRequestsAdaptiveGroups(filter: {date_gt: "${yesterday}"}, limit: 1) {
          sum { cachedRequests requests }
        }
      }}}`,
    }),
  });
  const data = await response.json();
  const { cachedRequests, requests } = data.data.viewer.zones[0].httpRequestsAdaptiveGroups[0].sum;
  return cachedRequests / requests; // Target: > 0.90
}
```

---

## 9. Best Practices

1. **Use CDN-Cache-Control to decouple edge TTL from browser TTL** — edge caches longer, browser shorter.
2. **Enable origin shield** — collapses N edge misses into 1 origin request; 80-95% origin traffic reduction.
3. **Tag every cacheable response** — enables instant, targeted purge without full zone invalidation.
4. **Prefer soft purge over hard purge** — serves stale during revalidation, prevents origin load spike.
5. **Strip tracking query params from cache key** — utm_*, fbclid, gclid fragment cache unnecessarily.
6. **Use stale-while-revalidate at edge** — covers 90%+ of the cache window with zero-latency responses.
7. **Set stale-if-error=86400** — CDN serves stale during origin outages instead of 5xx to users.
8. **Measure cache hit ratio from CDN analytics** — target > 90% for static, > 60% for dynamic API.
9. **Sort query parameters in cache key** — `?a=1&b=2` and `?b=2&a=1` should hit the same cache entry.
10. **Add X-Cache-Status header** — enables client-side and monitoring-side cache performance tracking.

## 10. Anti-Patterns

1. **Full zone purge on content change** — invalidates everything; use tag-based or URL-based purge.
2. **No origin shield** — every edge POP misses independently; origin gets N times the expected load.
3. **Caching Set-Cookie responses at CDN** — one user's session cookie served to other users.
4. **Same max-age for CDN and browser** — misses the opportunity to cache longer at edge with shorter browser TTL.
5. **Tracking params in cache key** — utm_source variations create N cache entries for identical content.
6. **No stale-if-error** — origin outage causes CDN to forward 5xx errors instead of serving stale.
7. **Hard purge on high-traffic content** — simultaneous miss storm overwhelms origin; use soft purge.
8. **No cache hit ratio monitoring** — cannot detect regressions or misconfigured cache rules.

## 11. Enforcement Checklist

- [ ] CDN-Cache-Control set separately from browser Cache-Control
- [ ] Origin shield / tiered caching enabled
- [ ] Cache-Tag header set on all cacheable responses
- [ ] Purge strategy uses tags (not full zone purge)
- [ ] Tracking params stripped from cache key normalization
- [ ] stale-while-revalidate set on dynamic cacheable content
- [ ] stale-if-error set for origin failure resilience
- [ ] CDN cache hit ratio monitored (target > 90% static, > 60% API)
- [ ] Vary header set minimally (only Accept-Encoding for most content)
- [ ] No Set-Cookie on CDN-cached responses
