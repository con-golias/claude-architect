# HTTP Caching

> **AI Plugin Directive — HTTP Caching & CDN Directives**
> You are an AI coding assistant. When generating, reviewing, or refactoring HTTP caching headers
> and CDN configuration, follow EVERY rule in this document. Incorrect HTTP caching serves stale
> content, leaks private data, or prevents updates from reaching users. Treat each section as non-negotiable.

**Core Rule: ALWAYS set explicit `Cache-Control` headers on EVERY response — NEVER rely on browser defaults. ALWAYS use `private` for user-specific content. ALWAYS use `no-store` for sensitive data. ALWAYS include cache-busting hashes in static asset filenames.**

---

## 1. Cache-Control Directive

```
┌──────────────────────────────────────────────────────────────┐
│             Cache-Control Header Syntax                       │
│                                                               │
│  Cache-Control: <directive>, <directive>, ...                │
│                                                               │
│  Cacheability:                                                │
│  ├── public        CDN + browser can cache                   │
│  ├── private       ONLY browser can cache (user-specific)    │
│  ├── no-cache      Cache but REVALIDATE before every use     │
│  └── no-store      NEVER cache (sensitive data)              │
│                                                               │
│  Expiration:                                                  │
│  ├── max-age=N        Fresh for N seconds                    │
│  ├── s-maxage=N       CDN fresh for N seconds (overrides)    │
│  └── must-revalidate  Revalidate when stale (not before)     │
│                                                               │
│  Advanced:                                                    │
│  ├── stale-while-revalidate=N   Serve stale, refresh async  │
│  ├── stale-if-error=N           Serve stale on origin error  │
│  ├── immutable                   Never revalidate            │
│  └── no-transform               Don't modify content         │
└──────────────────────────────────────────────────────────────┘
```

### 1.1 Common Patterns

| Resource Type | Cache-Control | Why |
|---------------|---------------|-----|
| Static assets (hashed) | `public, max-age=31536000, immutable` | Hash changes on content change |
| HTML pages | `no-cache` or `private, max-age=0` | Always revalidate for fresh content |
| API responses (public) | `public, max-age=60, s-maxage=300, stale-while-revalidate=60` | CDN caches longer, SWR for UX |
| API responses (private) | `private, max-age=60` | User-specific, browser only |
| Auth endpoints | `no-store` | NEVER cache credentials |
| Health checks | `no-store` | Must be real-time |
| User profile page | `private, no-cache` | User-specific, always revalidate |
| Product listing | `public, max-age=60, stale-while-revalidate=300` | Public data, serve stale while refreshing |

### 1.2 Implementation

**TypeScript (Express)**
```typescript
// Middleware for cache headers
function cacheControl(options: {
  public?: boolean;
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  noCache?: boolean;
  noStore?: boolean;
  immutable?: boolean;
  mustRevalidate?: boolean;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const directives: string[] = [];

    if (options.noStore) {
      directives.push("no-store");
    } else if (options.noCache) {
      directives.push("no-cache");
    } else {
      directives.push(options.public ? "public" : "private");
      if (options.maxAge !== undefined) directives.push(`max-age=${options.maxAge}`);
      if (options.sMaxAge !== undefined) directives.push(`s-maxage=${options.sMaxAge}`);
      if (options.staleWhileRevalidate !== undefined)
        directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
      if (options.staleIfError !== undefined)
        directives.push(`stale-if-error=${options.staleIfError}`);
      if (options.immutable) directives.push("immutable");
      if (options.mustRevalidate) directives.push("must-revalidate");
    }

    res.set("Cache-Control", directives.join(", "));
    next();
  };
}

// Static assets with content hash in filename
app.use("/assets", cacheControl({
  public: true, maxAge: 31536000, immutable: true,
}));

// API: public, cacheable with SWR
app.get("/api/products", cacheControl({
  public: true, maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 60,
}), listProducts);

// API: user-specific
app.get("/api/me/profile", cacheControl({
  public: false, maxAge: 0, noCache: true,
}), getProfile);

// Auth: never cache
app.post("/api/auth/login", cacheControl({ noStore: true }), login);
```

**Go**
```go
func CacheControl(next http.Handler, opts CacheOptions) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        var directives []string

        if opts.NoStore {
            directives = append(directives, "no-store")
        } else if opts.NoCache {
            directives = append(directives, "no-cache")
        } else {
            if opts.Public {
                directives = append(directives, "public")
            } else {
                directives = append(directives, "private")
            }
            if opts.MaxAge > 0 {
                directives = append(directives, fmt.Sprintf("max-age=%d", opts.MaxAge))
            }
            if opts.SMaxAge > 0 {
                directives = append(directives, fmt.Sprintf("s-maxage=%d", opts.SMaxAge))
            }
        }

        w.Header().Set("Cache-Control", strings.Join(directives, ", "))
        next.ServeHTTP(w, r)
    })
}
```

---

## 2. Conditional Requests (ETag & Last-Modified)

```
┌──────────────────────────────────────────────────────────────┐
│            Conditional Request Flow                           │
│                                                               │
│  First Request:                                               │
│  Client ──► Server                                           │
│  Server ──► 200 OK                                           │
│              ETag: "abc123"                                   │
│              Last-Modified: Mon, 09 Mar 2026 12:00:00 GMT    │
│              Cache-Control: private, no-cache                 │
│                                                               │
│  Subsequent Request:                                          │
│  Client ──► Server                                           │
│              If-None-Match: "abc123"                          │
│              If-Modified-Since: Mon, 09 Mar 2026 12:00:00    │
│                                                               │
│  If unchanged:                                                │
│  Server ──► 304 Not Modified (no body — saves bandwidth)     │
│                                                               │
│  If changed:                                                  │
│  Server ──► 200 OK (new body + new ETag)                     │
└──────────────────────────────────────────────────────────────┘
```

**TypeScript**
```typescript
import { createHash } from "crypto";

function generateETag(content: string | Buffer): string {
  return `"${createHash("md5").update(content).digest("hex")}"`;
}

app.get("/api/products/:id", async (req, res) => {
  const product = await getProduct(req.params.id);
  const body = JSON.stringify(product);
  const etag = generateETag(body);
  const lastModified = product.updatedAt;

  // Check conditional headers
  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end(); // Not Modified
  }

  const ifModifiedSince = req.headers["if-modified-since"];
  if (ifModifiedSince && new Date(ifModifiedSince) >= lastModified) {
    return res.status(304).end(); // Not Modified
  }

  res.set("ETag", etag);
  res.set("Last-Modified", lastModified.toUTCString());
  res.set("Cache-Control", "private, no-cache");
  res.json(product);
});
```

- ALWAYS prefer ETag over Last-Modified (more precise)
- ALWAYS use weak ETags (`W/"abc"`) for semantically equivalent responses
- ALWAYS use strong ETags (`"abc"`) for byte-identical responses
- ALWAYS return 304 with NO body — the entire point is saving bandwidth

---

## 3. Vary Header

ALWAYS use `Vary` to tell caches which request headers affect the response:

```typescript
// Different response based on Accept-Language
app.get("/api/content", (req, res) => {
  res.set("Vary", "Accept-Language, Accept-Encoding");
  // CDN will cache separate versions for each language
  const lang = req.headers["accept-language"];
  const content = getLocalizedContent(lang);
  res.json(content);
});

// Different response based on Authorization (user-specific)
app.get("/api/feed", (req, res) => {
  res.set("Vary", "Authorization");
  res.set("Cache-Control", "private, max-age=60");
  // Each user gets their own cached version
});
```

| Vary Header | Use Case |
|-------------|----------|
| `Accept-Encoding` | gzip vs brotli vs identity |
| `Accept-Language` | Localized content |
| `Authorization` | Per-user content |
| `Accept` | JSON vs XML vs HTML (content negotiation) |
| `Origin` | CORS responses |

- NEVER use `Vary: *` — it effectively disables caching
- ALWAYS include `Accept-Encoding` in Vary when serving compressed content
- ALWAYS include `Authorization` in Vary for user-specific responses

---

## 4. CDN Caching

```
┌──────────────────────────────────────────────────────────────┐
│                  CDN Caching Architecture                      │
│                                                               │
│  User (NYC) ──► CDN Edge (NYC) ──► Origin Server (us-east)  │
│                     │                                         │
│                  Cache HIT?                                   │
│                  YES → Serve from edge (< 10ms)              │
│                  NO  → Fetch from origin, cache, serve       │
│                                                               │
│  CDN uses s-maxage (overrides max-age for shared caches):    │
│  Cache-Control: public, max-age=60, s-maxage=3600            │
│  ├── Browser caches for 60 seconds                           │
│  └── CDN caches for 3600 seconds (1 hour)                    │
│                                                               │
│  CDN-specific headers (Cloudflare example):                  │
│  ├── CDN-Cache-Control: max-age=86400                        │
│  ├── Cloudflare-CDN-Cache-Control: max-age=86400             │
│  └── Surrogate-Control: max-age=86400 (Fastly/Varnish)      │
└──────────────────────────────────────────────────────────────┘
```

### 4.1 CDN Cache Purging

```typescript
// Cloudflare cache purge
async function purgeCloudflareCache(urls: string[]): Promise<void> {
  await fetch(
    `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: urls }),
    }
  );
}

// Purge by cache tag (preferred — more targeted)
async function purgeByCacheTag(tags: string[]): Promise<void> {
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

// Tag responses for targeted purging
app.get("/api/products/:id", (req, res) => {
  res.set("Cache-Tag", `product-${req.params.id}, products`);
  res.set("Cache-Control", "public, s-maxage=3600");
  // ...
});

// When product changes, purge by tag
await purgeByCacheTag([`product-${productId}`]);
```

- ALWAYS use cache tags for targeted CDN purging (NOT full cache purges)
- ALWAYS set `s-maxage` separately from `max-age` for CDN caching
- ALWAYS use `stale-while-revalidate` to avoid user-facing latency spikes
- NEVER cache responses with `Set-Cookie` headers at the CDN

---

## 5. Static Asset Caching

ALWAYS use content-hash filenames for static assets (cache busting):

```
# Build output with content hashes:
/assets/
├── main.a1b2c3d4.js         # Hash changes when content changes
├── styles.e5f6g7h8.css      # Old files become orphaned
├── logo.i9j0k1l2.png        # New filename → cache miss → fresh file
└── vendor.m3n4o5p6.js       # Unchanged files keep same hash → cache hit

# Nginx configuration
location /assets/ {
    # Hashed filenames: cache forever
    add_header Cache-Control "public, max-age=31536000, immutable";
    # Enable compression
    gzip_static on;
    brotli_static on;
}

location / {
    # HTML: always revalidate (it references hashed assets)
    add_header Cache-Control "no-cache";
}
```

- ALWAYS use `immutable` for hashed static assets — prevents revalidation requests
- ALWAYS set `max-age=31536000` (1 year) for hashed assets
- ALWAYS use `no-cache` for HTML files that reference hashed assets
- NEVER cache HTML with long max-age — users cannot receive updates

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No Cache-Control header | Browser uses heuristic caching | ALWAYS set explicit Cache-Control |
| `max-age` on HTML files | Users stuck on old version | Use `no-cache` for HTML |
| Caching with Set-Cookie | CDN serves other users' cookies | NEVER cache responses with Set-Cookie |
| `public` on user data | CDN caches user-specific data | Use `private` for user-specific responses |
| No Vary header | CDN serves wrong language/encoding | Set Vary for content negotiation headers |
| No ETag on API responses | Full response sent even when unchanged | Generate ETag, return 304 |
| Full CDN purge on changes | Unnecessary origin load | Purge by tag or URL |
| No content hash in asset URLs | Users stuck on cached old assets | Hash in filename, not query string |
| Using query string for cache busting | Some CDNs ignore query strings | Use filename hashing instead |
| `no-cache` confused with `no-store` | Sensitive data cached on disk | Use `no-store` for sensitive data |

---

## 7. Enforcement Checklist

- [ ] `Cache-Control` set on EVERY HTTP response
- [ ] `no-store` used for authentication and sensitive endpoints
- [ ] `private` used for user-specific responses
- [ ] `public, immutable, max-age=31536000` for hashed static assets
- [ ] `no-cache` for HTML pages (always revalidate)
- [ ] `s-maxage` set separately for CDN vs browser caching
- [ ] `stale-while-revalidate` used for latency-sensitive public content
- [ ] ETag generated and conditional responses (304) supported
- [ ] `Vary` header set for content negotiation (Accept-Encoding, Accept-Language)
- [ ] CDN cache tags used for targeted purging
- [ ] Static assets use content-hash filenames (NOT query strings)
- [ ] No responses with `Set-Cookie` cached at CDN
