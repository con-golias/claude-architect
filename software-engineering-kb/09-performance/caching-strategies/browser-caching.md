# Browser Caching Performance

> Domain: Performance Engineering > Browser Caching
> Importance: CRITICAL
> Complements: 06-backend/caching/http-caching.md (header syntax) — this doc covers performance tuning, Service Workers, bfcache, and optimization strategies

**Core Rule: ALWAYS hash static asset filenames and cache them immutably. ALWAYS use `stale-while-revalidate` for dynamic content. ALWAYS instrument cache hit ratios in the browser. Service Worker caching MUST have a versioned update strategy.**

---

## 1. Cache-Control Performance Directives

```
┌────────────────────────────────────────────────────────────────┐
│  Performance-Optimized Cache-Control Recipes                   │
│                                                                │
│  IMMUTABLE ASSETS (JS/CSS/fonts with content hash):            │
│  Cache-Control: public, max-age=31536000, immutable           │
│  → Zero revalidation requests. Saves 1 RTT per asset load.   │
│                                                                │
│  HTML DOCUMENTS:                                               │
│  Cache-Control: no-cache                                      │
│  ETag: "v2-abc123"                                            │
│  → Always revalidates. 304 saves bandwidth, not latency.     │
│                                                                │
│  API RESPONSES (public):                                       │
│  Cache-Control: public, max-age=10, stale-while-revalidate=30│
│  → Fresh for 10s, serve stale + background refresh for 30s.  │
│  → Eliminates visible latency for 40 seconds per cache entry. │
│                                                                │
│  API RESPONSES (private):                                      │
│  Cache-Control: private, max-age=0, must-revalidate           │
│  ETag: "user-specific-hash"                                   │
│  → Forces revalidation; 304 saves bandwidth for large payloads│
│                                                                │
│  SENSITIVE DATA (auth, PII):                                   │
│  Cache-Control: no-store                                      │
│  → Never written to disk. No performance benefit possible.    │
└────────────────────────────────────────────────────────────────┘
```

### 1.1 stale-while-revalidate Performance Impact

```typescript
// Server: SWR eliminates visible latency for users within the stale window
app.get("/api/feed", (req, res) => {
  // Fresh 5s, stale-but-servable for 55s, total 60s coverage
  res.set("Cache-Control", "public, max-age=5, stale-while-revalidate=55");
  // Impact: 92% of requests within 60s window see zero latency
  // Only the first request after 60s hits origin synchronously
  res.json(feedData);
});

// Measure SWR effectiveness: track how often browsers revalidate vs serve stale
app.use((req, res, next) => {
  // Browsers send If-None-Match during background revalidation
  const isRevalidation = !!req.headers["if-none-match"];
  metrics.increment("browser_request", {
    type: isRevalidation ? "revalidation" : "fresh",
    path: req.path,
  });
  next();
});
```

## 2. Conditional Requests — Performance Optimization

```typescript
// Strong ETag: byte-identical responses. Use for API JSON.
// Weak ETag: semantically equivalent. Use when serialization varies.
import { createHash } from "crypto";

function optimizedETag(req: Request, res: Response, body: Buffer): void {
  const etag = `"${createHash("sha256").update(body).digest("hex").slice(0, 16)}"`;

  // Check If-None-Match BEFORE serialization work
  if (req.headers["if-none-match"] === etag) {
    res.status(304).end(); // Saves: serialization CPU + bandwidth
    return;
  }
  res.set("ETag", etag);
  res.set("Cache-Control", "private, no-cache");
  res.send(body);
}

// Performance impact of 304 responses:
// - 200 response: ~50KB body, ~80ms total
// - 304 response: ~0.2KB headers only, ~20ms total
// - Savings: 99.6% bandwidth, 75% latency per conditional hit
```

```go
func ConditionalResponse(w http.ResponseWriter, r *http.Request, data []byte) {
    hash := sha256.Sum256(data)
    etag := fmt.Sprintf(`"%x"`, hash[:8])

    if r.Header.Get("If-None-Match") == etag {
        w.WriteHeader(http.StatusNotModified)
        return
    }
    w.Header().Set("ETag", etag)
    w.Header().Set("Cache-Control", "private, no-cache")
    w.Write(data)
}
```

## 3. Cache Busting with Content Hashing

```typescript
// Webpack/Vite output config — content hash in filenames
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Deterministic content hashes: file changes = new hash = cache miss
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});

// Performance impact:
// Without hashing: max-age=0 or short TTL → revalidation on every page load
// With hashing: max-age=31536000, immutable → ZERO network requests for cached assets
// On 20-asset page: saves 20 RTTs * ~30ms = ~600ms on repeat visits
```

```
# Nginx — serve hashed assets with immutable caching
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    # Pre-compressed: serve .br or .gz if available
    gzip_static on;
    brotli_static on;
    # Savings: no revalidation requests ever sent for unchanged assets
}

location / {
    add_header Cache-Control "no-cache";
    # HTML always revalidates — it references hashed asset URLs
}
```

## 4. Service Worker Caching (Cache API)

```typescript
// sw.ts — Performance-optimized Service Worker
const CACHE_VERSION = "v3";
const PRECACHE = `precache-${CACHE_VERSION}`;
const RUNTIME = `runtime-${CACHE_VERSION}`;

// Precache critical assets at install — eliminates network dependency
self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) =>
      cache.addAll([
        "/", "/app.js", "/styles.css", "/manifest.json",
        "/offline.html", // Fallback page
      ])
    )
  );
  self.skipWaiting(); // Activate immediately
});

// Clean old caches on activation
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== PRECACHE && name !== RUNTIME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Stale-while-revalidate for API, cache-first for assets
self.addEventListener("fetch", (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
    // SWR: return cache immediately, fetch update in background
    event.respondWith(staleWhileRevalidate(request, RUNTIME, 300));
  } else if (url.pathname.startsWith("/assets/")) {
    // Cache-first: hashed assets never change
    event.respondWith(cacheFirst(request, PRECACHE));
  } else {
    // Network-first: HTML pages
    event.respondWith(networkFirst(request, RUNTIME, 60));
  }
});

async function staleWhileRevalidate(
  request: Request, cacheName: string, maxAgeSec: number
): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });

  if (cached) {
    const cachedDate = cached.headers.get("date");
    const age = cachedDate ? (Date.now() - new Date(cachedDate).getTime()) / 1000 : Infinity;
    if (age < maxAgeSec) return cached; // Fresh enough
    // Stale: return cached, update in background
    fetchPromise.catch(() => {}); // Fire-and-forget
    return cached;
  }
  return fetchPromise; // No cache — wait for network
}

async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);
  return cached || fetch(request);
}

async function networkFirst(request: Request, cacheName: string, ttl: number): Promise<Response> {
  try {
    const response = await fetch(request);
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match("/offline.html") as Promise<Response>;
  }
}
```

## 5. Back/Forward Cache (bfcache)

```
bfcache stores entire page state in memory for instant back/forward navigation.
Performance: page restore < 10ms vs full page load 1-5 seconds.

Pages BLOCKED from bfcache:
├── unload event listener (use pagehide instead)
├── open WebSocket/WebRTC connections
├── Cache-Control: no-store (prevents bfcache on some browsers)
├── Unfinished IndexedDB transactions
└── In-progress fetch() with keepalive
```

```typescript
// Ensure bfcache eligibility — massive perf win for navigation
// WRONG: unload blocks bfcache
window.addEventListener("unload", () => { /* analytics */ }); // BLOCKS bfcache

// CORRECT: pagehide is bfcache-compatible
window.addEventListener("pagehide", (event) => {
  if (event.persisted) {
    // Page going into bfcache — clean up non-serializable state
  }
  navigator.sendBeacon("/analytics", JSON.stringify({ event: "leave" }));
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    // Restored from bfcache — refresh stale data
    refreshUserSession();
    updateTimestamps();
    reconnectWebSocket();
  }
});

// Audit bfcache eligibility
// Chrome DevTools > Application > Back/forward cache > Test
// Or programmatically:
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    // Mark analytics timestamp — compare with pageshow to measure bfcache usage
    performance.mark("page-hidden");
  }
});
```

## 6. Measuring Browser Cache Performance

```typescript
// Use Performance API to measure cache effectiveness
function analyzeCachePerformance(): void {
  const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];

  let cacheHits = 0, networkFetches = 0, totalSaved = 0;
  for (const entry of entries) {
    if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
      cacheHits++; // Served from cache (disk or memory)
      totalSaved += entry.decodedBodySize;
    } else {
      networkFetches++;
    }
  }
  const hitRatio = cacheHits / (cacheHits + networkFetches);
  console.log(`Cache hit ratio: ${(hitRatio * 100).toFixed(1)}%`);
  console.log(`Bandwidth saved: ${(totalSaved / 1024).toFixed(0)} KB`);

  // Report to analytics
  navigator.sendBeacon("/analytics/cache", JSON.stringify({
    hitRatio, cacheHits, networkFetches, totalSavedBytes: totalSaved,
  }));
}
// Run after page fully loaded
window.addEventListener("load", () => setTimeout(analyzeCachePerformance, 1000));
```

---

## 7. Best Practices

1. **Use immutable + max-age=1yr for all hashed assets** — eliminates revalidation overhead entirely.
2. **Apply stale-while-revalidate on API responses** — eliminates visible latency during stale window.
3. **Generate strong ETags from content hash** — enables 304 responses saving 95%+ bandwidth.
4. **Version Service Worker caches** — prevent stale SW serving outdated assets indefinitely.
5. **Preserve bfcache eligibility** — use `pagehide` not `unload`, avoid `no-store` on navigable pages.
6. **Precache critical-path assets** — Service Worker install event ensures offline and instant loads.
7. **Measure cache hit ratio in the browser** — use Performance API `transferSize === 0` detection.
8. **Separate mutable from immutable** — HTML uses `no-cache`, assets use `immutable`; never mix.
9. **Compress before caching** — Brotli/gzip static pre-compression reduces cache storage and transfer.
10. **Set Vary correctly** — incorrect Vary fragments cache, correct Vary prevents wrong-content serving.

## 8. Anti-Patterns

1. **No content hash in asset filenames** — forces short max-age; users re-download unchanged files.
2. **`max-age` on HTML** — users stuck on old version; cannot bust without hash in HTML filename.
3. **`no-store` on cacheable content** — disables browser cache AND bfcache; use `no-cache` instead.
4. **Unversioned Service Worker cache** — stale SW serves old assets forever with no update path.
5. **`unload` event listener** — blocks bfcache on most browsers; 1-5 second penalty on back navigation.
6. **Query string cache busting** (?v=2) — CDNs may ignore query strings; filename hashing is reliable.
7. **No ETag on large API responses** — full response re-sent on every request; wastes bandwidth.
8. **Mixing private data into public cache** — user A sees user B's data from CDN; use `private` directive.

## 9. Enforcement Checklist

- [ ] All hashed static assets: `public, max-age=31536000, immutable`
- [ ] HTML documents: `no-cache` with ETag
- [ ] API responses: `stale-while-revalidate` set for latency-sensitive endpoints
- [ ] Sensitive endpoints: `no-store` (and only those endpoints)
- [ ] Service Worker cache versioned and old versions cleaned on activate
- [ ] No `unload` event listeners — `pagehide` used instead (bfcache safe)
- [ ] Browser cache hit ratio measured via Performance API
- [ ] Content hashing in build pipeline for JS, CSS, images, fonts
- [ ] ETags generated for all non-trivial API responses
- [ ] Vary header set correctly (Accept-Encoding, Accept-Language where needed)
