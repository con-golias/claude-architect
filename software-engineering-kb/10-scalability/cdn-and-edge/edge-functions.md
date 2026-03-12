# Edge Functions and Compute

> **Domain:** Scalability > CDN and Edge
> **Importance:** High
> **Last Updated:** 2025
> **Cross-ref:** [09-performance/network-performance/edge-computing.md](../../09-performance/network-performance/edge-computing.md) (latency-focused edge patterns); this document covers **edge compute for scalability**: distributing application logic to 200+ PoPs to absorb global traffic without scaling origin infrastructure.

---

## 1. Edge Compute Platform Comparison

| Platform | Runtime | Cold Start | CPU Limit | Memory | PoPs | KV Storage |
|----------|---------|-----------|-----------|--------|------|-----------|
| Cloudflare Workers | V8 isolates | 0ms | 10ms free / 30s paid | 128MB | 310+ | KV, R2, D1, Durable Objects |
| AWS Lambda@Edge | Node.js, Python | 50-200ms | 5s (viewer) / 30s (origin) | 128MB / 10GB | 600+ | DynamoDB (origin-side) |
| CloudFront Functions | JavaScript | 0ms | 1ms | 2MB | 600+ | None (pure compute) |
| Deno Deploy | Deno (V8) | 0ms | 50ms default | 512MB | 35+ | Deno KV |
| Vercel Edge Functions | V8 isolates | 0ms | 25s | 128MB | 30+ | Vercel KV |
| Fastly Compute | Wasm | <1ms | 60s | 128MB | 90+ | KV Store, Object Store |

## 2. Edge vs Origin: Decision Framework

```
┌────────────────────────────────────────────────────────────────┐
│  RUN AT EDGE when:                RUN AT ORIGIN when:          │
│                                                                │
│  - Stateless request routing      - Database transactions      │
│  - JWT/API key validation         - Complex business logic     │
│  - A/B test assignment            - Large file processing      │
│  - Geolocation-based routing      - ML model inference (GPU)   │
│  - Rate limiting / bot blocking   - Writes to primary DB       │
│  - Header/cookie manipulation     - Payment processing         │
│  - Response transformation        - Multi-step workflows       │
│  - Content personalization (KV)   - Stateful sessions          │
│  - Redirect rules                 - File uploads >100MB        │
│  - Feature flag evaluation        - Long-running computations  │
│                                                                │
│  Rule: if it reads data and transforms requests, run at edge.  │
│  Rule: if it writes data or requires strong consistency, run   │
│        at origin.                                              │
└────────────────────────────────────────────────────────────────┘
```

## 3. TypeScript: A/B Testing at Edge with Persistent Assignment

```typescript
// Cloudflare Worker — A/B test with KV-backed sticky assignment
interface Env {
  AB_STORE: KVNamespace;   // Persistent variant assignments
  AB_CONFIG: KVNamespace;  // Experiment configurations
}

interface Experiment {
  id: string;
  variants: { name: string; weight: number; origin: string }[];
  enabled: boolean;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const experimentId = "homepage-redesign-v2";

    // Load experiment config from edge KV (cached, sub-ms read)
    const config = await env.AB_CONFIG.get<Experiment>(experimentId, "json");
    if (!config || !config.enabled) {
      return fetch(request); // Pass through to default origin
    }

    // Determine user identity for sticky assignment
    const userId =
      request.headers.get("Cookie")?.match(/uid=([^;]+)/)?.[1] ||
      crypto.randomUUID();

    // Check for existing assignment in KV
    const assignmentKey = `${experimentId}:${userId}`;
    let variant = await env.AB_STORE.get(assignmentKey);

    if (!variant) {
      // Weighted random assignment
      const rand = Math.random();
      let cumulative = 0;
      for (const v of config.variants) {
        cumulative += v.weight;
        if (rand < cumulative) {
          variant = v.name;
          break;
        }
      }
      variant = variant || config.variants[0].name;
      // Persist assignment for 30 days
      await env.AB_STORE.put(assignmentKey, variant, { expirationTtl: 2592000 });
    }

    // Route to variant-specific origin
    const target = config.variants.find((v) => v.name === variant);
    const originUrl = `${target!.origin}${url.pathname}${url.search}`;
    const response = await fetch(originUrl, {
      headers: request.headers,
    });

    const result = new Response(response.body, response);
    result.headers.set("X-Experiment", experimentId);
    result.headers.set("X-Variant", variant);
    result.headers.set(
      "Set-Cookie",
      `uid=${userId}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`
    );
    return result;
  },
};
```

## 4. TypeScript: Edge-Side Rendering with Streaming

```typescript
// Cloudflare Worker — stream HTML from edge with dynamic personalization
interface Env {
  CONTENT_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const country = request.headers.get("CF-IPCountry") || "US";
    const lang = request.headers.get("Accept-Language")?.split(",")[0] || "en";

    // Build streaming HTML response at edge
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start streaming immediately — TTFB is near-zero at edge
    const streamResponse = async () => {
      // Shell: cached in KV, served instantly
      const shell = await env.CONTENT_KV.get("page-shell", "text");
      await writer.write(encoder.encode(shell || "<!DOCTYPE html><html><body>"));

      // Personalized content: inject locale config inline
      const config = JSON.stringify({ country, lang, ts: Date.now() });
      await writer.write(
        encoder.encode(`<script>window.__EDGE_CONFIG__=${config}</script>`)
      );

      // Fetch dynamic content from origin in parallel
      const [nav, content] = await Promise.all([
        fetch(`https://origin.example.com/fragments/nav?lang=${lang}`),
        fetch(`https://origin.example.com/fragments/content?country=${country}`),
      ]);

      await writer.write(encoder.encode(await nav.text()));
      await writer.write(encoder.encode(await content.text()));
      await writer.write(encoder.encode("</body></html>"));
      await writer.close();
    };

    streamResponse().catch(() => writer.abort());

    return new Response(readable, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        "X-Edge-Country": country,
      },
    });
  },
};
```

## 5. Edge Auth Gateway: JWT Validation at Scale

```typescript
// Validate JWT at edge — reject 99% of unauthorized requests
// before they reach origin. Scales to millions of RPS across PoPs.
import { importSPKI, jwtVerify } from "jose";

interface Env {
  JWT_PUBLIC_KEY: string;  // RSA/EC public key (stored as secret)
  RATE_LIMIT: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Skip auth for public paths
    if (url.pathname.startsWith("/public/") || url.pathname === "/health") {
      return fetch(request);
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = authHeader.slice(7);
    try {
      const publicKey = await importSPKI(env.JWT_PUBLIC_KEY, "RS256");
      const { payload } = await jwtVerify(token, publicKey, {
        issuer: "auth.example.com",
        audience: "api.example.com",
      });

      // Rate limit per user at edge using KV
      const rateKey = `rate:${payload.sub}:${Math.floor(Date.now() / 60000)}`;
      const count = parseInt((await env.RATE_LIMIT.get(rateKey)) || "0");
      if (count > 100) {
        return new Response(JSON.stringify({ error: "rate limited" }), {
          status: 429,
          headers: { "Retry-After": "60" },
        });
      }
      await env.RATE_LIMIT.put(rateKey, String(count + 1), { expirationTtl: 120 });

      // Forward validated identity to origin
      const headers = new Headers(request.headers);
      headers.set("X-User-ID", payload.sub as string);
      headers.set("X-User-Roles", (payload.roles as string[]).join(","));
      headers.delete("Authorization"); // Do not forward raw token

      return fetch(new Request(request, { headers }));
    } catch {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
```

## 6. KV Storage at Edge: Cloudflare KV and Durable Objects

```typescript
// Cloudflare KV — globally replicated key-value store
// Read latency: <10ms at edge. Write propagation: ~60s eventual consistency.
// Use for: feature flags, config, A/B assignments, cached data.

// Durable Objects — strongly consistent, single-instance coordination
// Use for: counters, rate limiters, WebSocket rooms, distributed locks.

// Example: global rate limiter using Durable Objects
export class RateLimiter implements DurableObject {
  private counts: Map<string, { count: number; resetAt: number }> = new Map();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const key = url.searchParams.get("key") || "default";
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const windowMs = parseInt(url.searchParams.get("window") || "60000");

    const now = Date.now();
    let entry = this.counts.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      this.counts.set(key, entry);
    }

    entry.count++;
    const allowed = entry.count <= limit;

    return Response.json({
      allowed,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.resetAt,
    });
  }
}

// Worker dispatches to nearest Durable Object
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    // Durable Object ID derived from user identity — same user always
    // hits the same instance for consistent counting
    const id = env.RATE_LIMITER.idFromName(clientIP);
    const stub = env.RATE_LIMITER.get(id);
    return stub.fetch(request);
  },
};
```

## 7. Edge Compute Limitations

| Constraint | Cloudflare Workers | Lambda@Edge | CloudFront Functions |
|-----------|-------------------|-------------|---------------------|
| CPU time | 10ms free / 30s paid | 5s viewer / 30s origin | 1ms |
| Memory | 128MB | 128MB viewer / 10GB origin | 2MB |
| Package size | 10MB (compressed) | 50MB (origin) / 1MB (viewer) | 10KB |
| Network I/O | Unlimited subrequests | 0 (viewer) / origin only | None |
| Cold start | 0ms (V8 isolates) | 50-200ms (containers) | 0ms |
| Runtime | JavaScript, Wasm | Node.js 18+, Python 3.9+ | JavaScript (ES 5.1) |
| Secrets | Wrangler secrets | SSM Parameter Store | None |

---

## 8. Geolocation Routing at Edge

```typescript
// Route users to nearest regional API based on edge geolocation
interface Env {
  REGION_CONFIG: KVNamespace;
}

const REGION_MAP: Record<string, string> = {
  US: "https://api-us.example.com",
  CA: "https://api-us.example.com",
  GB: "https://api-eu.example.com",
  DE: "https://api-eu.example.com",
  FR: "https://api-eu.example.com",
  JP: "https://api-ap.example.com",
  AU: "https://api-ap.example.com",
  SG: "https://api-ap.example.com",
};

const DEFAULT_REGION = "https://api-us.example.com";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const country = request.headers.get("CF-IPCountry") || "US";
    const regionOrigin = REGION_MAP[country] || DEFAULT_REGION;

    const url = new URL(request.url);
    const originUrl = `${regionOrigin}${url.pathname}${url.search}`;

    const response = await fetch(originUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    const result = new Response(response.body, response);
    result.headers.set("X-Routed-Region", regionOrigin);
    result.headers.set("X-User-Country", country);
    return result;
  },
};
```

---

## 9. Best Practices

1. **Use V8-isolate platforms (Workers, Deno Deploy) for latency-critical paths.** Zero cold start vs 50-200ms on container-based Lambda@Edge; choose isolates for auth, routing, and personalization.
2. **Keep edge function CPU time under 5ms for request-path logic.** Edge platforms enforce strict limits; offload computation-heavy work to origin and use edge for routing and transformation.
3. **Store frequently read configuration in edge KV.** Feature flags, A/B configs, and routing tables served from edge KV in <10ms; accept 60s eventual consistency for config propagation.
4. **Validate authentication tokens at edge before forwarding to origin.** JWT verification is a stateless CPU operation; reject unauthorized traffic at the edge to protect origin from load.
5. **Use Durable Objects or equivalent for globally consistent edge state.** Rate limiting, distributed counters, and coordination require strong consistency; regular KV is eventually consistent.
6. **Stream responses from edge to minimize TTFB.** Start sending the HTML shell immediately while fetching dynamic fragments from origin in parallel.
7. **Implement graceful fallback when origin is unreachable.** Serve cached content, a static fallback page, or a degraded response from edge rather than returning 502 to users.
8. **Pin write operations to origin; fan out reads to edge.** Edge functions scale reads across 200+ PoPs but cannot safely coordinate writes without a single source of truth.
9. **Bundle edge function dependencies under the platform size limit.** Tree-shake aggressively; prefer Web API built-ins over npm packages to stay under 1-10MB compressed limits.
10. **Monitor edge function error rates and latency per PoP.** A single misconfigured PoP can degrade an entire region; track p50/p99 latency and error rate at the PoP level.

---

## 10. Anti-Patterns

| # | Anti-Pattern | Problem | Correct Approach |
|---|-------------|---------|-----------------|
| 1 | Running database queries from edge functions | Every edge invocation opens a new connection; 200+ PoPs create connection storms on the database | Use edge KV for reads; proxy writes through origin with connection pooling |
| 2 | Duplicating full business logic at edge and origin | Two codebases drift apart; bugs appear in one but not the other | Keep edge functions thin (routing, auth, transform); single source of truth at origin |
| 3 | Storing secrets in edge function source code | Code deployed to 200+ PoPs worldwide; secret rotation requires redeploy | Use platform secret stores (Wrangler secrets, SSM, Vercel env) |
| 4 | Using Lambda@Edge for latency-critical auth checks | 50-200ms cold starts negate the benefit of edge proximity | Use CloudFront Functions or Cloudflare Workers (0ms cold start) |
| 5 | Writing to eventually-consistent KV and reading immediately | Read-after-write inconsistency; user sees stale data after mutation | Use Durable Objects for read-after-write consistency, or route writes to origin |
| 6 | No timeout or fallback on origin fetch from edge | Edge function hangs waiting for slow origin; user sees timeout | Set fetch timeout (5-10s) and return cached/fallback response on timeout |
| 7 | Edge function per-route without consolidation | Hundreds of tiny edge functions create deployment and debugging complexity | Use a single edge router function with path-based dispatch logic |
| 8 | Ignoring edge compute billing model | Unlimited subrequests or KV reads can generate unexpected costs at scale | Set budgets; monitor request counts and KV operations per billing period |

---

## 11. Enforcement Checklist

- [ ] Authentication and authorization checks run at edge (JWT validation, API key check)
- [ ] Edge function CPU time profiled and confirmed under 5ms for request-path operations
- [ ] A/B test assignment persisted in edge KV with sticky user assignment
- [ ] Geolocation routing implemented at edge for multi-region backends
- [ ] Edge functions use platform-native secrets management (not hardcoded)
- [ ] Streaming responses enabled for HTML rendering at edge
- [ ] Graceful fallback implemented for origin unreachable scenarios
- [ ] Durable Objects or equivalent used for any edge state requiring consistency
- [ ] Edge function error rate and latency monitored per PoP with alerting
- [ ] All database writes routed to origin; edge handles reads only
- [ ] Edge function bundle size verified under platform limits
- [ ] Rate limiting implemented at edge to protect origin from traffic spikes
