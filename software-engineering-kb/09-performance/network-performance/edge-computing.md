# Edge Computing for Performance

> **Domain:** Network Performance · **Importance:** High

---

## Overview

Edge computing moves application logic from centralized origin servers to distributed points of presence (PoPs) close to end users. Instead of every request traveling to a single data center (50-300ms round trip), edge functions execute at the nearest PoP (5-50ms). Use edge computing for latency-sensitive operations: personalization, A/B testing, authentication checks, geographic routing, and API response transformation.

---

## Latency Comparison: Edge vs Origin

```
User in Tokyo requesting from:
  Origin (us-east-1):     ~180ms RTT
  Edge (Tokyo PoP):       ~10ms  RTT
  Savings:                ~170ms per request

User in London requesting from:
  Origin (us-east-1):     ~85ms  RTT
  Edge (London PoP):      ~8ms   RTT
  Savings:                ~77ms  per request
```

| Architecture | Cold Start | Execution Latency | Use Case |
|-------------|------------|-------------------|----------|
| Origin server (single region) | 0ms (always warm) | 50-300ms (network) | Complex business logic |
| Edge function | 0-5ms (V8 isolates) | 5-50ms (near user) | Request routing, auth, A/B |
| Lambda@Edge | 50-200ms (cold start) | 30-100ms | CloudFront transformations |
| CDN cache hit | 0ms | 1-10ms | Static/cached content |

---

## Edge Function Platforms

### Cloudflare Workers

V8 isolate-based. No cold start. 200+ PoPs worldwide. 10ms CPU limit (free), 30s (paid).

```typescript
// Cloudflare Worker — A/B test at edge
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Determine variant from cookie or assign new
    const cookie = request.headers.get("Cookie") || "";
    let variant = cookie.match(/ab_variant=(\w+)/)?.[1];

    if (!variant) {
      variant = Math.random() < 0.5 ? "control" : "treatment";
    }

    // Route to different origin based on variant
    const origin =
      variant === "treatment"
        ? "https://new-feature.example.com"
        : "https://www.example.com";

    const response = await fetch(`${origin}${url.pathname}`, {
      headers: request.headers,
    });

    // Clone response to modify headers
    const newResponse = new Response(response.body, response);
    newResponse.headers.set(
      "Set-Cookie",
      `ab_variant=${variant}; Path=/; Max-Age=86400; SameSite=Lax`
    );
    newResponse.headers.set("X-AB-Variant", variant);

    return newResponse;
  },
};
```

### Vercel Edge Functions

Built on Cloudflare Workers runtime. Integrated with Next.js middleware.

```typescript
// middleware.ts — Next.js Edge Middleware
import { NextRequest, NextResponse } from "next/server";

export const config = { matcher: ["/api/:path*", "/app/:path*"] };

export function middleware(request: NextRequest) {
  // Geolocation-based routing
  const country = request.geo?.country || "US";
  const city = request.geo?.city || "Unknown";

  // Block restricted regions
  const blockedCountries = ["KP", "IR", "CU"];
  if (blockedCountries.includes(country)) {
    return new NextResponse("Service not available in your region", {
      status: 451,
    });
  }

  // Add geo headers for downstream services
  const response = NextResponse.next();
  response.headers.set("X-User-Country", country);
  response.headers.set("X-User-City", city);

  // Rewrite to regional API endpoint
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const region = country === "US" ? "us" : country === "JP" ? "ap" : "eu";
    response.headers.set("X-Origin-Region", region);
  }

  return response;
}
```

### AWS Lambda@Edge

Runs at CloudFront edge locations. Node.js/Python runtime. Higher cold start than V8 isolates.

```typescript
// Lambda@Edge — Origin Request (viewer -> origin)
import { CloudFrontRequestEvent, CloudFrontRequestResult } from "aws-lambda";

export const handler = async (
  event: CloudFrontRequestEvent
): Promise<CloudFrontRequestResult> => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;

  // Personalize origin based on device type
  const userAgent = headers["user-agent"]?.[0]?.value || "";
  const isMobile = /Mobile|Android|iPhone/i.test(userAgent);

  if (isMobile) {
    request.origin = {
      custom: {
        domainName: "mobile-api.example.com",
        port: 443,
        protocol: "https",
        path: "",
        sslProtocols: ["TLSv1.2"],
        readTimeout: 30,
        keepaliveTimeout: 5,
      },
    };
    request.headers["host"] = [
      { key: "Host", value: "mobile-api.example.com" },
    ];
  }

  return request;
};
```

### Deno Deploy

Built on Deno runtime. Globally distributed. Native TypeScript support.

```typescript
// Deno Deploy — edge API with caching
Deno.serve(async (request: Request) => {
  const url = new URL(request.url);

  if (url.pathname === "/api/products") {
    // Check edge cache first
    const cache = await caches.open("api-cache");
    const cached = await cache.match(request);
    if (cached) return cached;

    // Fetch from origin
    const origin = await fetch("https://origin.example.com/api/products");
    const data = await origin.json();

    // Build response with cache headers
    const response = new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=60",
      },
    });

    // Store in edge cache
    await cache.put(request, response.clone());
    return response;
  }

  return new Response("Not Found", { status: 404 });
});
```

---

## Edge Databases

Edge databases replicate data to PoPs worldwide, enabling sub-30ms reads from edge functions.

| Database | Type | Read Latency | Write Model | Best For |
|----------|------|-------------|-------------|----------|
| Turso (libSQL) | Relational | 1-5ms (edge) | Single primary, replicas | Read-heavy apps |
| Neon | PostgreSQL | 10-30ms (serverless) | Single region | Serverless Postgres |
| PlanetScale | MySQL | 5-15ms (edge) | Vitess-based sharding | Global MySQL |
| Cloudflare D1 | SQLite | 1-5ms (edge) | Per-region primary | Worker-native apps |
| Upstash Redis | Key-value | 1-5ms (edge) | Global replication | Sessions, rate limiting |

```typescript
// Cloudflare Worker with D1 edge database
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const productId = url.searchParams.get("id");

    // Query runs at the nearest edge PoP — sub-5ms
    const result = await env.DB.prepare(
      "SELECT id, name, price FROM products WHERE id = ?"
    )
      .bind(productId)
      .first();

    if (!result) {
      return new Response("Not found", { status: 404 });
    }

    return Response.json(result, {
      headers: { "Cache-Control": "public, s-maxage=300" },
    });
  },
};
```

```typescript
// Turso edge database from Deno Deploy / Cloudflare Workers
import { createClient } from "@libsql/client/web";

const db = createClient({
  url: "libsql://mydb-myorg.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Read from nearest replica (1-5ms)
const result = await db.execute("SELECT * FROM users WHERE id = ?", [userId]);

// Write goes to primary, replicates async
await db.execute("INSERT INTO sessions (user_id, token) VALUES (?, ?)", [
  userId,
  token,
]);
```

---

## Edge-Side Includes (ESI)

ESI assembles pages from cached fragments at the edge. Static page shell is cached; dynamic fragments are fetched per-request.

```html
<!-- Page template cached at CDN edge -->
<html>
<head><title>Dashboard</title></head>
<body>
  <!-- Static navigation — cached for 1 hour -->
  <esi:include src="/fragments/nav" />

  <!-- Personalized greeting — fetched per-request -->
  <esi:include src="/fragments/user-greeting" />

  <!-- Product recommendations — cached 5 min per user segment -->
  <esi:include src="/fragments/recommendations?segment=returning" />

  <!-- Static footer — cached for 24 hours -->
  <esi:include src="/fragments/footer" />
</body>
</html>
```

Modern alternative: use edge functions to assemble fragments programmatically.

```typescript
// Edge function — manual fragment assembly
export default {
  async fetch(request: Request): Promise<Response> {
    // Fetch fragments in parallel
    const [nav, greeting, content] = await Promise.all([
      fetch("https://origin.example.com/fragments/nav"),
      fetch("https://origin.example.com/fragments/greeting", {
        headers: { Cookie: request.headers.get("Cookie") || "" },
      }),
      fetch("https://origin.example.com/fragments/content"),
    ]);

    const html = `
      <html><body>
        ${await nav.text()}
        ${await greeting.text()}
        ${await content.text()}
      </body></html>
    `;

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  },
};
```

---

## Personalization at Edge

```typescript
// Edge personalization — no origin roundtrip for basic personalization
export default {
  async fetch(request: Request): Promise<Response> {
    const country = request.headers.get("CF-IPCountry") || "US";
    const lang = request.headers.get("Accept-Language")?.split(",")[0] || "en";

    // Currency and locale mapping at edge
    const config: Record<string, { currency: string; locale: string }> = {
      US: { currency: "USD", locale: "en-US" },
      GB: { currency: "GBP", locale: "en-GB" },
      JP: { currency: "JPY", locale: "ja-JP" },
      DE: { currency: "EUR", locale: "de-DE" },
    };

    const userConfig = config[country] || config["US"];

    // Inject configuration into HTML response
    const origin = await fetch(request);
    const html = (await origin.text()).replace(
      "</head>",
      `<script>window.__CONFIG__=${JSON.stringify(userConfig)}</script></head>`
    );

    return new Response(html, {
      headers: { "Content-Type": "text/html", Vary: "Accept-Language" },
    });
  },
};
```

---

## Edge vs Origin Decision Matrix

| Task | Edge | Origin | Why |
|------|------|--------|-----|
| A/B test routing | Yes | No | Cookie check + redirect, no compute needed |
| Auth token validation (JWT) | Yes | No | Stateless verification, sub-ms at edge |
| Rate limiting | Yes | No | Block bad traffic before it hits origin |
| Geo-based redirects | Yes | No | IP geolocation available at edge |
| Database transactions | No | Yes | Strong consistency requires single region |
| Complex business logic | No | Yes | Edge CPU limits (10-50ms) too restrictive |
| File uploads | No | Yes | Edge has body size limits (typically 100MB) |
| ML model inference | Depends | Yes | Small models OK at edge; large models need GPU |
| Session creation | No | Yes | State mutation needs authoritative store |
| Cache invalidation | Edge | Origin triggers | Edge serves stale; origin purges cache |

---

## Best Practices

1. **Move latency-sensitive read operations to edge.** Authentication checks, A/B routing, geo-redirects, and feature flags execute in 1-5ms at edge vs 50-200ms at origin.
2. **Keep edge functions under 5ms CPU time.** Edge platforms enforce strict CPU limits. Offload heavy computation to origin; use edge for routing and transformation only.
3. **Use edge databases for read-heavy workloads.** Turso, D1, and Upstash Redis provide sub-5ms reads at edge. Accept eventual consistency for non-critical data.
4. **Cache aggressively at edge with short TTLs.** Even 60-second caching at 200+ PoPs eliminates thousands of origin requests per minute.
5. **Implement graceful origin fallback.** If the origin is unreachable, serve stale cache or a static fallback page from the edge.
6. **Use `Vary` headers to avoid serving wrong cached variant.** When personalizing at edge, set `Vary: Accept-Language, Cookie` to prevent CDN cache collisions.
7. **Validate JWT tokens at edge, not origin.** JWT verification is a pure CPU operation (signature check). Reject invalid tokens at edge to protect origin.
8. **Parallelize fragment fetches with `Promise.all`.** When assembling pages from multiple origins, fetch all fragments concurrently to minimize total latency.
9. **Measure edge vs origin latency with real-user monitoring.** Use Server-Timing headers to report edge processing time separately from origin fetch time.
10. **Pin stateful operations to origin.** Database writes, payment processing, and inventory updates require strong consistency — always route to origin.

---

## Anti-Patterns

1. **Running complex business logic at edge.** Edge functions have 10-50ms CPU limits. Database joins, ML inference, and complex validation time out or hit memory limits.
2. **Writing to a single-region database from edge functions.** Every write crosses the network to the primary region. Latency is worse than origin-direct for write-heavy workloads.
3. **Caching personalized responses without Vary.** Without proper Vary headers, one user's personalized content is served to another user from CDN cache.
4. **Cold-starting Lambda@Edge for every request.** Lambda@Edge has 50-200ms cold starts. Use Cloudflare Workers or Deno Deploy (V8 isolates, 0ms cold start) for latency-critical paths.
5. **Duplicating origin logic at edge.** Maintaining two copies of business logic (edge + origin) creates drift and bugs. Keep edge functions thin — routing and transformation only.
6. **Ignoring edge function error rates.** Edge functions fail silently if not monitored. Track error rates, latency percentiles, and cold start frequency per PoP.
7. **Storing secrets in edge function code.** Edge functions are deployed to 200+ PoPs. Use platform-provided secrets management (Wrangler secrets, Vercel env vars) instead of hardcoding.
8. **Over-fragmenting ESI templates.** Each ESI include is a separate HTTP fetch. More than 5-6 fragments per page add latency from serial fetch chains.

---

## Enforcement Checklist

- [ ] Authentication token validation runs at edge (JWT signature check).
- [ ] A/B test routing is implemented at edge, not origin.
- [ ] Geo-based redirects and content selection happen at edge.
- [ ] Edge functions stay under 5ms CPU time (profiled and monitored).
- [ ] Edge database reads are used for latency-sensitive queries.
- [ ] All database writes go to origin (single-region primary).
- [ ] `Vary` headers are set correctly for personalized/geo-varied responses.
- [ ] Origin fallback returns stale cache or static page on origin failure.
- [ ] Edge function error rates and latency are monitored per PoP.
- [ ] Secrets are stored in platform-native secret stores, not in code.
- [ ] Edge cache TTLs are set per route based on content freshness needs.
