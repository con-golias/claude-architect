# DNS Optimization

> **Domain:** Network Performance · **Importance:** High

---

## Overview

Every HTTP request begins with a DNS lookup. Each lookup adds 20-120ms of latency depending on DNS provider, cache state, geographic distance, and resolver chain. A single page load may trigger 10-30 DNS lookups across different domains (CDN, analytics, fonts, APIs, ads). Reduce the number of unique domains, pre-resolve critical domains, choose low-latency DNS providers, and leverage DNS caching to eliminate this hidden tax on every user interaction.

---

## DNS Resolution Latency

```
User types URL
  └─> Browser DNS cache (0ms if cached)
       └─> OS DNS cache (0ms if cached)
            └─> Router cache (0-5ms)
                 └─> ISP recursive resolver (5-30ms)
                      └─> Root nameserver (20-50ms)
                           └─> TLD nameserver (20-50ms)
                                └─> Authoritative nameserver (20-80ms)

Cold lookup total: 60-200ms
Cached lookup: 0-5ms
```

### Measuring DNS Latency

```bash
# Measure DNS resolution time
dig example.com | grep "Query time"
# ;; Query time: 23 msec

# Detailed timing with curl
curl -w "dns: %{time_namelookup}s\nconnect: %{time_connect}s\ntls: %{time_appconnect}s\ntotal: %{time_total}s\n" -o /dev/null -s https://example.com
# dns: 0.024s
# connect: 0.048s
# tls: 0.091s
# total: 0.142s

# Compare DNS providers
for ns in 8.8.8.8 1.1.1.1 9.9.9.9; do
  echo "=== $ns ==="
  dig @$ns example.com | grep "Query time"
done
```

---

## DNS Prefetch and Preconnect

### dns-prefetch

The `dns-prefetch` hint tells the browser to resolve a domain's IP address before the resource is needed. Zero cost if the domain is not used; saves 20-120ms if it is.

```html
<head>
  <!-- Prefetch DNS for third-party domains used on this page -->
  <link rel="dns-prefetch" href="//cdn.example.com">
  <link rel="dns-prefetch" href="//api.example.com">
  <link rel="dns-prefetch" href="//fonts.googleapis.com">
  <link rel="dns-prefetch" href="//analytics.example.com">
</head>
```

### preconnect

`preconnect` goes further: DNS + TCP + TLS handshake. Use for critical third-party origins. Limit to 4-6 domains — each preconnect consumes a socket.

```html
<head>
  <!-- Full connection setup for critical origins -->
  <link rel="preconnect" href="https://cdn.example.com" crossorigin>
  <link rel="preconnect" href="https://api.example.com">

  <!-- dns-prefetch as fallback for browsers that don't support preconnect -->
  <link rel="dns-prefetch" href="//cdn.example.com">
  <link rel="dns-prefetch" href="//api.example.com">
</head>
```

### Programmatic Prefetch

```typescript
// Dynamically add dns-prefetch for lazy-loaded domains
function prefetchDNS(domain: string): void {
  const link = document.createElement("link");
  link.rel = "dns-prefetch";
  link.href = `//${domain}`;
  document.head.appendChild(link);
}

// Prefetch on hover over links to external domains
document.addEventListener("pointerover", (e) => {
  const anchor = (e.target as HTMLElement).closest("a");
  if (anchor?.hostname && anchor.hostname !== location.hostname) {
    prefetchDNS(anchor.hostname);
  }
});
```

---

## Reducing DNS Lookups

Every unique domain on a page requires a separate DNS lookup. Consolidate resources to minimize domain count.

| Strategy | Impact |
|----------|--------|
| Self-host fonts instead of Google Fonts | -1 DNS lookup (20-80ms) |
| Self-host analytics (Plausible, Umami) | -1 DNS lookup |
| Use same domain for API (`/api/` path) | -1 DNS lookup + no CORS overhead |
| Single CDN domain for all assets | Consolidates 3-5 lookups into 1 |
| Avoid ad networks / third-party widgets | -5-15 DNS lookups each |

```typescript
// Next.js — proxy API calls through same domain (eliminates API DNS lookup)
// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://api.internal.example.com/:path*",
      },
    ];
  },
};
```

---

## DNS Provider Selection

### Key Criteria

| Criteria | Why It Matters |
|----------|---------------|
| Anycast network | Routes queries to nearest PoP, reduces latency |
| Global PoP count | More PoPs = lower latency worldwide |
| Query latency (p50/p99) | Direct impact on every page load |
| DNSSEC support | Prevents DNS spoofing (adds ~10ms) |
| DoH/DoT support | Encrypted DNS prevents ISP interception |
| Low TTL support | Enables fast failover and traffic shifting |
| API for automation | Terraform, CI/CD integration |

### Provider Comparison

| Provider | Anycast PoPs | Avg Latency | DoH/DoT | Notes |
|----------|-------------|-------------|---------|-------|
| Cloudflare (1.1.1.1) | 300+ | ~11ms | Yes | Fastest public resolver |
| Google (8.8.8.8) | 100+ | ~22ms | Yes | Most widely used |
| Quad9 (9.9.9.9) | 200+ | ~20ms | Yes | Malware blocking built-in |
| AWS Route 53 | 100+ | Varies | No | Deep AWS integration |
| Cloudflare DNS (auth) | 300+ | ~10ms | N/A | Authoritative DNS hosting |

---

## DNS-over-HTTPS (DoH) and DNS-over-TLS (DoT)

Traditional DNS is unencrypted — ISPs, networks, and attackers can intercept and modify queries. DoH and DoT encrypt DNS traffic.

| Protocol | Port | Transport | Use Case |
|----------|------|-----------|----------|
| DNS (traditional) | 53 | UDP/TCP | Default, unencrypted |
| DoT | 853 | TLS over TCP | System-level encrypted DNS |
| DoH | 443 | HTTPS | Application-level, bypasses network filtering |

```typescript
// Node.js — DNS-over-HTTPS query
async function dohQuery(domain: string): Promise<string[]> {
  const url = `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`;
  const resp = await fetch(url, {
    headers: { Accept: "application/dns-json" },
  });
  const data = await resp.json();
  return data.Answer?.map((a: { data: string }) => a.data) ?? [];
}

const ips = await dohQuery("example.com");
// ["93.184.216.34"]
```

```go
// Go — DNS-over-HTTPS using custom resolver
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
)

type DoHResponse struct {
    Answer []struct {
        Data string `json:"data"`
    } `json:"Answer"`
}

func dohLookup(domain string) ([]string, error) {
    url := fmt.Sprintf("https://1.1.1.1/dns-query?name=%s&type=A", domain)
    req, _ := http.NewRequest("GET", url, nil)
    req.Header.Set("Accept", "application/dns-json")

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result DoHResponse
    json.NewDecoder(resp.Body).Decode(&result)

    ips := make([]string, len(result.Answer))
    for i, a := range result.Answer {
        ips[i] = a.Data
    }
    return ips, nil
}
```

---

## DNS Caching and TTL Strategy

| TTL Value | Use Case | Trade-off |
|-----------|----------|-----------|
| 30-60s | Active failover, blue-green deploys | High DNS query volume |
| 300s (5min) | Standard web apps | Good balance |
| 3600s (1hr) | Stable services, CDN origins | Fewer queries, slower failover |
| 86400s (1 day) | Static infrastructure | Minimal DNS load, very slow updates |

```python
# Python — DNS caching with TTL awareness
import dns.resolver
from functools import lru_cache
from time import time

class DNSCache:
    def __init__(self):
        self._cache: dict[str, tuple[list[str], float]] = {}

    def resolve(self, domain: str) -> list[str]:
        if domain in self._cache:
            ips, expires = self._cache[domain]
            if time() < expires:
                return ips

        answers = dns.resolver.resolve(domain, "A")
        ips = [rdata.address for rdata in answers]
        ttl = answers.rrset.ttl
        self._cache[domain] = (ips, time() + ttl)
        return ips

dns_cache = DNSCache()
ips = dns_cache.resolve("api.example.com")
```

---

## Happy Eyeballs Algorithm (RFC 8305)

Happy Eyeballs resolves both A (IPv4) and AAAA (IPv6) records simultaneously and races the connection attempts. The first successful connection wins. This avoids delays when one address family is broken or slow.

```
1. Send A and AAAA queries simultaneously
2. Start IPv6 connection attempt immediately
3. After 250ms, if IPv6 hasn't connected, start IPv4 in parallel
4. Use whichever connects first
5. Cache the winning address family for future connections
```

Modern browsers and language runtimes implement Happy Eyeballs automatically. Ensure your infrastructure supports both IPv4 and IPv6 to benefit.

```go
// Go — net.Dialer implements Happy Eyeballs by default
dialer := &net.Dialer{
    Timeout:       5 * time.Second,
    FallbackDelay: 250 * time.Millisecond, // Happy Eyeballs delay
    DualStack:     true,
}
conn, err := dialer.DialContext(ctx, "tcp", "example.com:443")
```

---

## DNS Failover

### Multi-Provider DNS

Use multiple authoritative DNS providers for resilience. If one provider goes down, the other continues serving.

```
; Zone file with multiple NS records pointing to different providers
example.com.  IN  NS  ns1.cloudflare.com.
example.com.  IN  NS  ns2.cloudflare.com.
example.com.  IN  NS  ns1.route53.amazonaws.com.
example.com.  IN  NS  ns2.route53.amazonaws.com.
```

### Health-Check-Based DNS Failover

```
# Route 53 health check failover
Primary:   A record -> 203.0.113.10 (us-east-1)
Secondary: A record -> 203.0.113.20 (eu-west-1)
Health check: HTTP GET /health every 30s
Failover: If primary fails 3 consecutive checks, switch to secondary
Recovery: Automatic when primary passes health checks again
```

---

## Best Practices

1. **Add `dns-prefetch` for all third-party domains used on the page.** Include CDNs, API endpoints, font providers, and analytics domains. Cost is negligible; savings are 20-120ms per domain.
2. **Use `preconnect` for the 2-4 most critical third-party origins.** Preconnect performs DNS + TCP + TLS. Limit count to avoid opening unused sockets.
3. **Consolidate domains to reduce total DNS lookups.** Self-host fonts, proxy APIs through your domain, use a single CDN origin. Each eliminated domain saves one lookup.
4. **Choose an Anycast DNS provider with global PoP coverage.** Anycast routes queries to the nearest server. Providers with 200+ PoPs deliver sub-20ms resolution worldwide.
5. **Set TTLs based on change frequency.** Use 300s for standard services, 30-60s during migrations or failover scenarios, 3600s+ for stable infrastructure.
6. **Enable DNSSEC on authoritative zones.** DNSSEC prevents cache poisoning and spoofing. The 5-10ms overhead is acceptable for the security benefit.
7. **Deploy dual-stack (IPv4 + IPv6).** Happy Eyeballs races both address families. Dual-stack prevents delays when one family is unreachable.
8. **Monitor DNS resolution latency from multiple regions.** Use synthetic monitoring (Datadog, Pingdom, Catchpoint) to detect DNS slowdowns before users notice.
9. **Use DNS-over-HTTPS for privacy-sensitive applications.** DoH prevents ISP inspection of DNS queries. Enable in application-level HTTP clients for server-to-server calls.
10. **Configure multi-provider DNS for critical domains.** Use two authoritative providers to survive single-provider outages (e.g., the 2016 Dyn attack).

---

## Anti-Patterns

1. **Using dozens of third-party domains on a single page.** Each domain adds a DNS lookup. Pages with 30+ unique domains add 500ms+ to cold load times from DNS alone.
2. **Setting extremely low TTLs (< 30s) without reason.** Very low TTLs generate excessive DNS traffic, increase resolver load, and provide no benefit for stable services.
3. **Preconnecting to 10+ domains.** Each preconnect opens a full connection (DNS + TCP + TLS). Excessive preconnects consume sockets and compete with actual resource downloads.
4. **Ignoring DNS in performance budgets.** Teams measure TTFB but forget that 50-200ms of it is DNS resolution. Include DNS latency in performance analysis.
5. **Using a single DNS provider for critical infrastructure.** A DNS provider outage makes your entire service unreachable. Always configure a secondary provider.
6. **Hardcoding IP addresses to skip DNS.** Bypasses failover, load balancing, and geo-routing. When the IP changes, the application breaks silently.
7. **Not warming DNS caches after deployments.** After changing DNS records, the old TTL must expire before clients see new records. Plan deploys around TTL windows.
8. **Forgetting `dns-prefetch` on lazy-loaded content.** Resources loaded after user interaction (modals, below-fold images) still need DNS. Prefetch their domains early.

---

## Enforcement Checklist

- [ ] All third-party domains have `<link rel="dns-prefetch">` tags in `<head>`.
- [ ] Top 2-4 critical origins use `<link rel="preconnect">` with dns-prefetch fallback.
- [ ] Total unique domains per page is measured and minimized (target: < 10).
- [ ] DNS provider uses Anycast with global PoP coverage.
- [ ] TTL values match operational requirements (300s default, lower for failover).
- [ ] DNSSEC is enabled on authoritative zones.
- [ ] Dual-stack (IPv4 + IPv6) is configured on all public-facing services.
- [ ] DNS resolution latency is monitored via synthetic tests from multiple regions.
- [ ] Multi-provider DNS is configured for critical domains.
- [ ] `curl -w "%{time_namelookup}"` is used in CI/CD to catch DNS regressions.
- [ ] Fonts, analytics, and other third-party assets are self-hosted where feasible.
