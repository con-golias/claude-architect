# HTTP/2 and HTTP/3 Protocol Performance

> **Domain:** Network Performance · **Importance:** Critical

---

## Overview

HTTP/2 and HTTP/3 eliminate the performance bottlenecks of HTTP/1.1 through multiplexing, header compression, and improved connection management. HTTP/2 uses TCP with binary framing; HTTP/3 replaces TCP with QUIC (UDP-based) to eliminate head-of-line blocking at the transport layer. Adopt HTTP/2 as the baseline for all production services. Migrate to HTTP/3 for mobile-heavy, high-latency, or lossy-network audiences.

---

## HTTP/2 Core Concepts

### Binary Framing and Multiplexing

HTTP/2 replaces HTTP/1.1 text-based parsing with a binary framing layer. Multiple requests and responses share a single TCP connection as interleaved frames, eliminating the need for multiple connections or domain sharding.

| Feature | HTTP/1.1 | HTTP/2 |
|---------|----------|--------|
| Connections per origin | 6-8 (browser limit) | 1 (multiplexed) |
| Head-of-line blocking | Per connection | Per stream (TCP-level remains) |
| Header format | Text, repeated | Binary, HPACK compressed |
| Server push | Not available | Available (deprecated in Chrome) |
| Prioritization | None | Stream dependencies + weights |

### HPACK Header Compression

HPACK uses a static table (61 common headers), a dynamic table (connection-specific), and Huffman encoding to compress headers. Repeated headers across requests (cookies, user-agent, authorization) are sent as table indices instead of full strings.

```
# First request: full header sent, added to dynamic table
:method: GET
:path: /api/users
authorization: Bearer eyJhbGci...long-token

# Subsequent request: authorization sent as table index (1-2 bytes)
:method: GET
:path: /api/orders
[index 62]  <- references authorization from dynamic table
```

### Early Hints (103) — Replacing Server Push

HTTP/2 Server Push is deprecated in Chrome 106+. Use `103 Early Hints` to instruct the browser to preload critical resources while the server generates the response.

```typescript
// Node.js — send Early Hints before main response
import { createServer } from "node:http";

const server = createServer((req, res) => {
  // Send 103 Early Hints immediately
  res.writeEarlyHints({
    link: [
      "</styles/main.css>; rel=preload; as=style",
      "</scripts/app.js>; rel=preload; as=script",
      "</fonts/inter.woff2>; rel=preload; as=font; crossorigin",
    ],
  });

  // Expensive DB query / SSR render happens here
  const html = renderPage(req.url);
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
});
```

```nginx
# Nginx — Early Hints with http2_push_preload
location / {
    add_header Link "</css/main.css>; rel=preload; as=style" always;
    add_header Link "</js/app.js>; rel=preload; as=script" always;
    proxy_pass http://backend;
}
```

---

## HTTP/3 and QUIC

### Architecture

HTTP/3 runs over QUIC, a UDP-based transport protocol with built-in TLS 1.3. QUIC eliminates TCP head-of-line blocking by making each HTTP stream independent at the transport layer — a lost packet in one stream does not stall others.

| Feature | HTTP/2 (TCP) | HTTP/3 (QUIC) |
|---------|-------------|---------------|
| Transport | TCP | UDP (QUIC) |
| TLS | Separate handshake | Integrated (always TLS 1.3) |
| Handshake RTTs | 2-3 RTT (TCP + TLS) | 1 RTT (0-RTT resumption) |
| HoL blocking | TCP-level (all streams) | Per-stream only |
| Connection migration | Breaks on IP change | Survives IP/network change |
| Header compression | HPACK | QPACK |

### 0-RTT Connection Resumption

QUIC supports 0-RTT resumption: the client sends application data with its first packet on reconnection. This eliminates the handshake latency entirely for returning visitors.

```
First connection:     Client ──SYN──> Server ──SYN-ACK──> Client ──ACK+TLS──> (2-3 RTT)
QUIC first visit:     Client ──CHLO──> Server ──SHLO──> Client ──Data──> (1 RTT)
QUIC 0-RTT resumption: Client ──CHLO+Data──> Server (0 RTT for first request)
```

**0-RTT risk:** Replay attacks. 0-RTT data can be replayed by an attacker. Only use 0-RTT for idempotent requests (GET). Never allow 0-RTT for state-changing operations (POST, PUT, DELETE).

### Connection Migration

When a mobile device switches from Wi-Fi to cellular, TCP connections break (different IP address). QUIC connections survive because they are identified by a Connection ID, not by the IP/port tuple.

---

## ALPN Negotiation and Alt-Svc

### ALPN (Application-Layer Protocol Negotiation)

ALPN negotiates the application protocol during the TLS handshake, avoiding an extra round trip.

```
# TLS ClientHello includes:
ALPN: h2, http/1.1

# Server selects highest supported:
ALPN: h2
```

```bash
# Verify ALPN negotiation
curl -vso /dev/null https://example.com 2>&1 | grep 'ALPN'
# * ALPN: server accepted h2

# Test HTTP/3 support
curl --http3 -I https://example.com
```

### Alt-Svc Header (HTTP/3 Discovery)

Browsers discover HTTP/3 support via the `Alt-Svc` response header. The first request uses HTTP/2; subsequent requests upgrade to HTTP/3.

```nginx
# Nginx — advertise HTTP/3 via Alt-Svc
add_header Alt-Svc 'h3=":443"; ma=86400' always;
```

```
# Caddy — HTTP/3 enabled by default, Alt-Svc sent automatically
example.com {
    reverse_proxy localhost:8080
}
```

---

## Server Configuration

### Nginx HTTP/2

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name example.com;

    ssl_certificate /etc/ssl/certs/example.com.pem;
    ssl_certificate_key /etc/ssl/private/example.com.key;

    # HTTP/2 tuning
    http2_max_concurrent_streams 128;
    http2_initial_window_size 65535;

    # Advertise HTTP/3 (if using nginx-quic build)
    add_header Alt-Svc 'h3=":443"; ma=86400' always;

    # Keep-alive for upstream connections
    upstream backend {
        server 127.0.0.1:8080;
        keepalive 64;
    }

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}
```

### Caddy HTTP/3

```
example.com {
    # HTTP/3 is enabled automatically in Caddy 2.6+
    # TLS is automatic via Let's Encrypt

    encode gzip zstd

    reverse_proxy localhost:8080 {
        transport http {
            keepalive 30s
            keepalive_idle_conns 64
        }
    }
}
```

---

## Protocol Selection Decision Matrix

| Scenario | Recommendation |
|----------|---------------|
| General web application | HTTP/2 (universal support) |
| Mobile-first application | HTTP/3 (connection migration, 0-RTT) |
| High-latency networks (satellite, rural) | HTTP/3 (fewer RTTs, no HoL blocking) |
| Internal microservices (low latency LAN) | HTTP/2 or gRPC over HTTP/2 |
| API-only service | HTTP/2 (header compression, multiplexing) |
| Streaming / real-time | HTTP/3 (independent stream loss recovery) |
| Legacy client support required | HTTP/2 with HTTP/1.1 fallback |
| UDP blocked by corporate firewall | HTTP/2 (QUIC falls back to HTTP/2 automatically) |

---

## Programmatic HTTP/2 Clients

```typescript
// Node.js — HTTP/2 client
import http2 from "node:http2";

const client = http2.connect("https://api.example.com");

// Multiplexed requests on single connection
const req1 = client.request({ ":path": "/api/users", ":method": "GET" });
const req2 = client.request({ ":path": "/api/orders", ":method": "GET" });

for (const req of [req1, req2]) {
  let data = "";
  req.on("data", (chunk) => (data += chunk));
  req.on("end", () => console.log(JSON.parse(data)));
}
```

```go
// Go — HTTP/2 is default for HTTPS in net/http
package main

import (
    "fmt"
    "net/http"
    "golang.org/x/net/http2"
)

func main() {
    transport := &http2.Transport{}
    client := &http.Client{Transport: transport}

    resp, err := client.Get("https://api.example.com/users")
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()
    fmt.Println("Protocol:", resp.Proto) // "HTTP/2.0"
}
```

```python
# Python — HTTP/2 with httpx
import httpx

# HTTP/2 requires h2 package: pip install httpx[http2]
async with httpx.AsyncClient(http2=True) as client:
    responses = await asyncio.gather(
        client.get("https://api.example.com/users"),
        client.get("https://api.example.com/orders"),
    )
    for r in responses:
        print(r.http_version)  # "HTTP/2"
```

---

## Best Practices

1. **Enable HTTP/2 on all production servers.** HTTP/2 provides 20-50% latency improvement over HTTP/1.1 with zero application code changes. Configure at the reverse proxy layer.
2. **Stop domain sharding.** HTTP/1.1 workarounds like splitting assets across subdomains actively harm HTTP/2 by preventing multiplexing and inflating DNS lookups.
3. **Advertise HTTP/3 via Alt-Svc header.** Set `Alt-Svc: h3=":443"; ma=86400` to enable progressive HTTP/3 adoption without breaking HTTP/2 clients.
4. **Use Early Hints (103) instead of Server Push.** Server Push is deprecated. Early Hints provide the same preloading benefit without the complexity and cache-invalidation problems.
5. **Restrict 0-RTT to idempotent requests.** Configure servers to reject 0-RTT data for POST/PUT/DELETE to prevent replay attacks.
6. **Tune `max_concurrent_streams` to match workload.** Default of 100-128 is appropriate for most web apps. Increase for API gateways handling many parallel requests.
7. **Maintain persistent connections to upstream services.** Configure keepalive pools (e.g., Nginx `keepalive 64`) to avoid per-request TCP handshake overhead.
8. **Monitor QUIC/UDP firewall compatibility.** Corporate firewalls and some ISPs block UDP 443. Ensure HTTP/2 TCP fallback works seamlessly.
9. **Set HPACK dynamic table size appropriately.** Default 4096 bytes handles most use cases. Increase for APIs with large custom headers.
10. **Measure protocol distribution in analytics.** Track HTTP/1.1 vs HTTP/2 vs HTTP/3 usage to identify clients stuck on older protocols and quantify upgrade impact.

---

## Anti-Patterns

1. **Bundling all assets into one file for HTTP/2.** HTTP/2 multiplexing makes multiple small files efficient. Over-bundling prevents granular caching and increases invalidation scope.
2. **Inlining all CSS/JS.** Inlined resources cannot be cached independently. With HTTP/2 multiplexing, external files with cache headers outperform inlining.
3. **Using Server Push in new projects.** Server Push is removed from Chrome and poorly supported. Pushed resources that are already cached waste bandwidth.
4. **Opening multiple HTTP/2 connections to the same origin.** This defeats multiplexing. Browsers use a single connection per origin by design.
5. **Ignoring HTTP/2 stream prioritization.** Not setting priority hints causes the browser to download low-priority resources before critical ones. Use `fetchpriority="high"` on critical resources.
6. **Deploying HTTP/3 without HTTP/2 fallback.** QUIC uses UDP which may be blocked. Always serve HTTP/2 on TCP as the fallback path.
7. **Allowing 0-RTT for all request methods.** 0-RTT data is replayable. Permitting state-changing operations in 0-RTT enables replay attacks.
8. **Not testing with packet loss.** HTTP/3's advantage over HTTP/2 is most visible under packet loss (2-5%). Test with `tc netem` to validate real-world gains.

---

## Enforcement Checklist

- [ ] HTTP/2 is enabled on all production reverse proxies and load balancers.
- [ ] ALPN negotiation is configured and verified with `curl -vso /dev/null`.
- [ ] `Alt-Svc` header advertises HTTP/3 with appropriate `ma` (max-age).
- [ ] Domain sharding is removed; all assets served from a single origin.
- [ ] Server Push is not used; Early Hints (103) is implemented for critical resources.
- [ ] 0-RTT is restricted to safe/idempotent methods only.
- [ ] Upstream keepalive pools are configured (Nginx `keepalive`, Caddy `keepalive_idle_conns`).
- [ ] HTTP/2 fallback works when UDP/QUIC is blocked.
- [ ] Protocol distribution (h1/h2/h3) is tracked in server metrics or analytics.
- [ ] `max_concurrent_streams` is tuned for the workload profile.
- [ ] Load tests are run under simulated packet loss to validate HTTP/3 benefits.
- [ ] gRPC services use HTTP/2 transport with proper flow control settings.
