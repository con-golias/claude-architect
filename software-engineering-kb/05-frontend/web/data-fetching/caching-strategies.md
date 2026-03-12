# Caching Strategies — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to cache API responses?", "Cache-Control headers", "stale-while-revalidate", "CDN caching", "TanStack Query caching", "service worker cache", "cache invalidation", "ISR vs SSG", or any caching question, ALWAYS consult this directive. Caching exists at MULTIPLE layers — browser, CDN, application, server — and each layer has different strategies. Use HTTP Cache-Control for static assets, TanStack Query/SWR for client-side server state, CDN caching for global distribution, and ISR for dynamic content that changes periodically. NEVER cache authentication-sensitive data without proper Vary headers.

**Core Rule: Caching is the SINGLE most impactful performance optimization. Cache at EVERY layer: HTTP headers for browser/CDN caching, TanStack Query for client-side server state, Redis for server-side data, and ISR for pre-rendered pages. The hardest problem in caching is INVALIDATION — always define when and how cached data becomes stale. Use `stale-while-revalidate` as the default strategy: serve stale content immediately while fetching fresh data in background.**

---

## 1. Caching Layers

```
         THE CACHING STACK

  USER REQUEST
       │
       ▼
  ┌─────────────────────────────────────┐
  │ BROWSER CACHE                       │ Layer 1
  │ Cache-Control, ETag, Service Worker │
  │ Latency: 0ms (instant)             │
  └──────────────┬──────────────────────┘
                 │ Cache miss
                 ▼
  ┌─────────────────────────────────────┐
  │ CDN / EDGE CACHE                   │ Layer 2
  │ Cloudflare, Vercel, CloudFront     │
  │ Latency: 5-50ms (nearest POP)     │
  └──────────────┬──────────────────────┘
                 │ Cache miss
                 ▼
  ┌─────────────────────────────────────┐
  │ APPLICATION CACHE                   │ Layer 3
  │ TanStack Query, SWR, Apollo Cache  │
  │ In-memory, normalized              │
  │ Latency: 0ms (client-side)         │
  └──────────────┬──────────────────────┘
                 │ Cache miss
                 ▼
  ┌─────────────────────────────────────┐
  │ SERVER CACHE                       │ Layer 4
  │ Redis, Memcached, in-memory        │
  │ ISR (Incremental Static Regen)     │
  │ Latency: 1-10ms                    │
  └──────────────┬──────────────────────┘
                 │ Cache miss
                 ▼
  ┌─────────────────────────────────────┐
  │ DATA SOURCE                        │ Layer 5
  │ Database, external API             │
  │ Latency: 10-500ms                  │
  └─────────────────────────────────────┘
```

---

## 2. HTTP Caching (Cache-Control)

```
CACHE-CONTROL DIRECTIVES:

  ┌────────────────────────┬─────────────────────────────────────────┐
  │ Directive              │ Meaning                                 │
  ├────────────────────────┼─────────────────────────────────────────┤
  │ max-age=3600           │ Cache for 3600s (1 hour) in browser     │
  │ s-maxage=86400         │ Cache for 86400s (1 day) in CDN/proxy   │
  │ no-cache               │ Cache but REVALIDATE every time         │
  │ no-store               │ NEVER cache (sensitive data)            │
  │ immutable              │ NEVER revalidate (content won't change) │
  │ must-revalidate        │ Stale cache MUST revalidate             │
  │ stale-while-revalidate │ Serve stale while fetching fresh        │
  │ stale-if-error         │ Serve stale if origin returns error     │
  │ private                │ Only browser can cache (not CDN)        │
  │ public                 │ CDN and browser can cache               │
  └────────────────────────┴─────────────────────────────────────────┘
```

```typescript
// COMMON CACHING PATTERNS

// STATIC ASSETS (CSS, JS, images with content hash)
// Cache forever — file hash in URL means new URL = new content
// Cache-Control: public, max-age=31536000, immutable
// Example: /assets/app.a1b2c3.js

// API RESPONSES (dynamic data)
// Cache for 5 minutes, CDN for 1 hour, serve stale while revalidating
// Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400

// HTML PAGES (SSR/SSG)
// Always revalidate, but serve stale while checking
// Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400

// PRIVATE DATA (user-specific)
// Cache in browser only, not CDN
// Cache-Control: private, max-age=300, no-cache

// SENSITIVE DATA (auth tokens, PII)
// Never cache anywhere
// Cache-Control: no-store


// NEXT.JS ROUTE HANDLER CACHING
// app/api/products/route.ts
export async function GET() {
  const products = await getProducts();

  return Response.json(products, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

// NEXT.JS FETCH CACHING (built-in)
// Server Components automatically cache fetch requests
const products = await fetch('https://api.example.com/products', {
  next: { revalidate: 3600 }, // Revalidate every hour (ISR)
});

const user = await fetch('https://api.example.com/user', {
  cache: 'no-store', // Never cache (dynamic per-request)
});


// ETAG — Conditional requests
// Server sends: ETag: "abc123"
// Client sends: If-None-Match: "abc123"
// Server responds: 304 Not Modified (no body) or 200 with new data

// LAST-MODIFIED — Time-based validation
// Server sends: Last-Modified: Wed, 01 Jan 2025 00:00:00 GMT
// Client sends: If-Modified-Since: Wed, 01 Jan 2025 00:00:00 GMT


// VARY HEADER — Cache per request variant
// Vary: Accept-Encoding     → Different cache for gzip vs brotli
// Vary: Accept              → Different cache for JSON vs HTML
// Vary: Cookie              → Different cache per user (CAREFUL: low hit rate)
// Vary: Accept-Language     → Different cache per language
```

### 2.1 stale-while-revalidate Pattern

```
stale-while-revalidate IN ACTION:

  Cache-Control: max-age=60, stale-while-revalidate=3600

  Timeline:
  ┌────────────┬────────────────────────────────┬────────────────┐
  │ 0-60s      │ 60s-3660s                      │ After 3660s    │
  │ FRESH      │ STALE (serve + revalidate)     │ EXPIRED        │
  ├────────────┼────────────────────────────────┼────────────────┤
  │ Serve from │ Serve stale IMMEDIATELY        │ Must fetch     │
  │ cache      │ + fetch fresh in background    │ fresh (slow)   │
  │ instantly  │ → Next request gets fresh data │                │
  └────────────┴────────────────────────────────┴────────────────┘

  BENEFITS:
  • User always gets instant response (stale or fresh)
  • Background revalidation keeps data relatively fresh
  • No loading spinners or perceived delay

  THIS IS THE DEFAULT STRATEGY FOR:
  • TanStack Query (staleTime + gcTime)
  • SWR (Stale-While-Revalidate)
  • Next.js ISR (revalidate period)
  • HTTP Cache-Control header
```

---

## 3. Client-Side Caching (TanStack Query)

```typescript
// TANSTACK QUERY — Client-side server state caching
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

// Configure cache defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // Data fresh for 5 minutes
      gcTime: 30 * 60 * 1000,        // Keep in garbage-collectible cache 30 min
      refetchOnWindowFocus: true,     // Revalidate when user returns to tab
      refetchOnReconnect: true,       // Revalidate on network reconnect
      retry: 3,                       // Retry failed requests 3 times
    },
  },
});


// QUERY KEY DESIGN — Cache identity and invalidation target
// ┌──────────────────────────────────────────────────────────┐
// │ Key Structure: [entity, filters/params]                  │
// │                                                          │
// │ ['users']                  → All users queries           │
// │ ['users', 'list']          → User list queries           │
// │ ['users', 'list', {page:1}]→ Page 1 of user list        │
// │ ['users', 'detail', '123'] → User 123 detail             │
// │ ['users', '123', 'posts']  → Posts of user 123           │
// │                                                          │
// │ Invalidation:                                            │
// │ invalidateQueries(['users'])      → All user queries     │
// │ invalidateQueries(['users','123'])→ User 123 + children  │
// └──────────────────────────────────────────────────────────┘

function useUserList(page: number) {
  return useQuery({
    queryKey: ['users', 'list', { page }],
    queryFn: () => fetchUsers(page),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData, // Show previous page while loading next
  });
}

function useUserDetail(userId: string) {
  return useQuery({
    queryKey: ['users', 'detail', userId],
    queryFn: () => fetchUser(userId),
    staleTime: 5 * 60 * 1000,
  });
}


// CACHE INVALIDATION AFTER MUTATION
function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      // Invalidate all user lists (forces refetch)
      queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
    },
  });
}


// OPTIMISTIC UPDATES — Update cache BEFORE server confirms
function useToggleTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleTodo,
    onMutate: async (todoId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      // Snapshot current cache
      const previousTodos = queryClient.getQueryData(['todos']);

      // Optimistically update cache
      queryClient.setQueryData(['todos'], (old: Todo[]) =>
        old.map(t => t.id === todoId ? { ...t, done: !t.done } : t)
      );

      return { previousTodos }; // Return snapshot for rollback
    },
    onError: (err, todoId, context) => {
      // Rollback on error
      queryClient.setQueryData(['todos'], context?.previousTodos);
    },
    onSettled: () => {
      // Refetch to ensure server and client are in sync
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}
```

---

## 4. CDN Caching

```
CDN CACHING ARCHITECTURE:

                    ┌──────────┐
                    │  ORIGIN  │
                    │  SERVER  │
                    └────┬─────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
       ┌────▼───┐  ┌────▼───┐  ┌────▼───┐
       │ POP    │  │ POP    │  │ POP    │
       │ US-East│  │ EU-West│  │ APAC   │
       └────┬───┘  └────┬───┘  └────┬───┘
            │            │            │
       Users in     Users in     Users in
       Americas     Europe       Asia

  CACHE HIT:  User → POP → Cached response (5ms)
  CACHE MISS: User → POP → Origin → Response → Cache at POP → User (200ms)

  NEXT REQUEST: User → POP → Cached response (5ms) ✅
```

```typescript
// VERCEL EDGE CACHING
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/products',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};


// CLOUDFLARE CACHE RULES (via Workers)
// worker.js
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Cache API responses at edge
    if (url.pathname.startsWith('/api/')) {
      const cacheKey = new Request(url.toString(), request);
      const cache = caches.default;

      let response = await cache.match(cacheKey);
      if (!response) {
        response = await fetch(request);
        response = new Response(response.body, response);
        response.headers.set('Cache-Control', 's-maxage=3600');
        await cache.put(cacheKey, response.clone());
      }
      return response;
    }

    return fetch(request);
  },
};
```

---

## 5. Server-Side Caching

```typescript
// ISR — Incremental Static Regeneration (Next.js)

// Option 1: Time-based revalidation
// app/products/page.tsx
export const revalidate = 3600; // Revalidate every hour

async function ProductsPage() {
  const products = await getProducts(); // Cached, revalidated hourly
  return <ProductList products={products} />;
}

// Option 2: On-demand revalidation (webhook/event triggered)
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  const { secret, path, tag } = await request.json();

  if (secret !== process.env.REVALIDATION_SECRET) {
    return Response.json({ error: 'Invalid secret' }, { status: 401 });
  }

  if (path) revalidatePath(path);      // Revalidate specific page
  if (tag) revalidateTag(tag);          // Revalidate by cache tag

  return Response.json({ revalidated: true });
}

// Tag-based caching
async function getProducts() {
  const res = await fetch('https://api.example.com/products', {
    next: { tags: ['products'] }, // Tag for targeted invalidation
  });
  return res.json();
}
// Webhook calls: revalidateTag('products') → all product pages refresh


// REDIS CACHING (server-side)
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<T> {
  // Check cache
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  // Fetch fresh data
  const data = await fetcher();

  // Store in cache
  await redis.setex(key, ttlSeconds, JSON.stringify(data));

  return data;
}

// Usage
const products = await getCachedData(
  'products:featured',
  () => db.product.findMany({ where: { featured: true } }),
  1800 // 30 minutes
);
```

---

## 6. Service Worker Caching

```typescript
// SERVICE WORKER — Offline-first caching in the browser

// Cache-first strategy (for static assets)
self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.destination === 'image' ||
      event.request.destination === 'style' ||
      event.request.destination === 'script') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open('static-v1').then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});

// Network-first strategy (for API data)
self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open('api-v1').then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request)) // Fallback to cache if offline
    );
  }
});

// Stale-while-revalidate strategy (best of both)
self.addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        caches.open('dynamic-v1').then(cache =>
          cache.put(event.request, response.clone())
        );
        return response;
      });

      return cached || fetchPromise; // Return cached immediately, update in background
    })
  );
});
```

---

## 7. Cache Invalidation Strategies

```
CACHE INVALIDATION — "The two hardest problems in CS"

  TIME-BASED (TTL):
  ┌─────────────────────────────────────────────┐
  │ Set expiry: Cache for 1 hour, then refetch  │
  │ Simple, predictable, but data may be stale  │
  │ Use for: Products, blog posts, config       │
  │ Cache-Control: max-age=3600                 │
  └─────────────────────────────────────────────┘

  EVENT-BASED (Webhook/Mutation):
  ┌─────────────────────────────────────────────┐
  │ CMS publishes post → webhook → invalidate   │
  │ User updates profile → mutation → invalidate │
  │ Precise, but requires event infrastructure   │
  │ Use for: CMS content, user data, inventory  │
  │ Next.js: revalidatePath('/blog')            │
  │ TanStack: invalidateQueries(['posts'])      │
  └─────────────────────────────────────────────┘

  TAG-BASED:
  ┌─────────────────────────────────────────────┐
  │ Tag related data: products, product-123     │
  │ Invalidate by tag: all 'products' caches    │
  │ Flexible grouping of related cached data    │
  │ Use for: Categories, related content        │
  │ Next.js: fetch(url, { next: { tags: [...] }})│
  │ Cloudflare: Cache-Tag header                │
  └─────────────────────────────────────────────┘

  OPTIMISTIC (Update before confirmation):
  ┌─────────────────────────────────────────────┐
  │ Update cache immediately on user action     │
  │ Rollback if server confirms failure         │
  │ Best UX — feels instant                     │
  │ Use for: Toggles, likes, simple mutations   │
  │ TanStack: onMutate + onError rollback       │
  └─────────────────────────────────────────────┘
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **No caching at all** | Every request hits origin server, slow TTFB, high server load | Add Cache-Control headers; use TanStack Query for client-side caching |
| **Cache everything with no invalidation** | Stale data served indefinitely, users see outdated content | Define TTL for every cached resource; implement invalidation strategy |
| **Vary: Cookie on CDN** | Near-zero cache hit rate (different cache per user) | Use `private` for user-specific data; remove Vary: Cookie from public content |
| **Cache-Control: no-cache for static assets** | Assets re-downloaded on every page load despite being unchanged | Use `immutable` + content hash in filename for static assets |
| **Caching auth-sensitive data publicly** | User A sees User B's data via CDN cache | Use `private` or `no-store` for auth-sensitive responses; add Vary: Authorization |
| **Not using stale-while-revalidate** | Users see loading spinner while cache revalidates | Add `stale-while-revalidate` to Cache-Control; use TanStack Query defaults |
| **Invalidating too broadly** | Clearing entire cache on single item update; cache thrashing | Use targeted invalidation (tags, specific keys, exact paths) |
| **Caching errors** | 500 error cached at CDN, served to all users for TTL duration | Set `no-cache` or short `max-age` for error responses |
| **No cache key strategy (TanStack Query)** | Stale data across different views, wrong data displayed | Design hierarchical query keys: `[entity, scope, params]` |
| **Premature optimization with Redis** | Adding Redis for data that changes every request | Cache only data that's expensive to compute AND doesn't change frequently |

---

## 9. Enforcement Checklist

### HTTP Caching
- [ ] Static assets cached with `immutable` + content hash in filename
- [ ] API responses have explicit `Cache-Control` headers (never implicit)
- [ ] `stale-while-revalidate` used for non-critical data
- [ ] `no-store` used for sensitive/auth data
- [ ] ETag or Last-Modified configured for conditional requests
- [ ] Vary header set correctly (Accept-Encoding, not Cookie)

### CDN
- [ ] CDN configured and serving static assets
- [ ] `s-maxage` set for CDN-cacheable responses
- [ ] Cache purging mechanism tested and documented
- [ ] Geographic distribution verified with latency monitoring

### Client-Side (TanStack Query / SWR)
- [ ] `staleTime` configured per query (not all default)
- [ ] Query keys follow hierarchical convention
- [ ] Mutations invalidate related queries
- [ ] Optimistic updates used for user-facing mutations
- [ ] `gcTime` set to prevent stale data accumulation

### Server-Side
- [ ] ISR or on-demand revalidation configured for dynamic pages
- [ ] Redis/cache layer for expensive database queries
- [ ] Cache invalidation hooked to CMS/data update events
- [ ] Cache warming for critical pages after deployment

### Monitoring
- [ ] Cache hit ratio monitored (target > 90% for static, > 50% for dynamic)
- [ ] Cache-related latency tracked (TTFB improvement measured)
- [ ] Stale data incidents tracked and reviewed
