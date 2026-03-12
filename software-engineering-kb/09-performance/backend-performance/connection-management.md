# Connection Management Performance

> **Domain:** Performance > Backend Performance > Connection Management
> **Importance:** Critical
> **Last Updated:** 2026-03-10

## Core Concepts

Every network connection has creation cost (TCP handshake + TLS + auth), maintenance cost (memory, file descriptors), and teardown cost. Optimizing connection lifecycle is essential for high-throughput systems.

```
Connection Lifecycle Costs:
┌──────────────────────────────────────────────────────┐
│ Phase              │ TCP Only  │ TCP + TLS  │ gRPC   │
├────────────────────┼───────────┼────────────┼────────┤
│ Connection setup   │ ~1-3ms   │ ~5-30ms   │ ~10-50ms│
│ First request      │ +0ms     │ +0ms      │ +5ms   │
│ Keep-alive request │ ~0.01ms  │ ~0.01ms   │ ~0.01ms│
│ Memory per conn    │ ~10KB    │ ~50KB     │ ~30KB  │
│ File descriptors   │ 1        │ 1         │ 1      │
└──────────────────────────────────────────────────────┘
At 10K connections: 500MB RAM for TLS alone.
```

---

## Connection Pooling Patterns

### HTTP Client Connection Pools

```typescript
// Node.js: configure HTTP agent for connection reuse
import http from 'http';
import https from 'https';

const httpAgent = new http.Agent({
  keepAlive: true,          // reuse connections
  keepAliveMsecs: 30000,    // TCP keepalive probe interval
  maxSockets: 50,           // max connections per host
  maxTotalSockets: 200,     // max connections across all hosts
  maxFreeSockets: 10,       // max idle connections to keep
  timeout: 30000,           // socket timeout
  scheduling: 'fifo',       // reuse least-recently-used connection (better for keep-alive)
});

// Use with fetch/axios/got
import axios from 'axios';
const client = axios.create({
  httpAgent,
  httpsAgent: new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    rejectUnauthorized: true,
  }),
  timeout: 10000,
});
```

```go
// Go: http.Client with transport tuning
import "net/http"

var httpClient = &http.Client{
    Timeout: 30 * time.Second,
    Transport: &http.Transport{
        MaxIdleConns:        200,              // total idle connections
        MaxIdleConnsPerHost: 50,               // idle connections per host
        MaxConnsPerHost:     100,              // max connections per host
        IdleConnTimeout:     90 * time.Second, // close idle connections after 90s
        TLSHandshakeTimeout: 10 * time.Second,
        DisableCompression:  false,
        ForceAttemptHTTP2:   true,             // enable HTTP/2 multiplexing
    },
}

// CRITICAL: always read and close response body — otherwise connection is NOT reused
func fetch(url string) ([]byte, error) {
    resp, err := httpClient.Get(url)
    if err != nil { return nil, err }
    defer resp.Body.Close()
    return io.ReadAll(resp.Body) // must fully read body for conn reuse
}
```

```python
# Python: httpx connection pooling (async)
import httpx

# Connection pool with limits
limits = httpx.Limits(
    max_connections=100,       # total connections
    max_keepalive_connections=20,  # idle connections to keep
    keepalive_expiry=30.0,     # close idle connections after 30s
)

async with httpx.AsyncClient(
    limits=limits,
    timeout=httpx.Timeout(10.0, connect=5.0),
    http2=True,  # enable HTTP/2 multiplexing
) as client:
    response = await client.get("https://api.example.com/data")
```

### gRPC Connection Management

```go
// Go gRPC: connection with keepalive and pooling
import (
    "google.golang.org/grpc"
    "google.golang.org/grpc/keepalive"
)

conn, err := grpc.Dial(
    "service:50051",
    grpc.WithTransportCredentials(creds),
    grpc.WithKeepaliveParams(keepalive.ClientParameters{
        Time:                10 * time.Second,  // ping if no activity for 10s
        Timeout:             3 * time.Second,   // wait 3s for ping ack
        PermitWithoutStream: true,              // ping even with no active RPCs
    }),
    grpc.WithDefaultCallOptions(
        grpc.MaxCallRecvMsgSize(16*1024*1024), // 16MB max message
    ),
)

// gRPC uses HTTP/2 multiplexing — single connection handles many concurrent RPCs
// For very high throughput, use a connection pool:
type GRPCPool struct {
    conns []*grpc.ClientConn
    idx   uint64
}

func (p *GRPCPool) Get() *grpc.ClientConn {
    i := atomic.AddUint64(&p.idx, 1)
    return p.conns[i%uint64(len(p.conns))] // round-robin
}
```

---

## Keep-Alive Tuning

```
HTTP Keep-Alive Decision Matrix:
┌────────────────────────────┬────────────────────────────────┐
│ Scenario                    │ Recommendation                  │
├────────────────────────────┼────────────────────────────────┤
│ Internal microservice calls │ keep-alive=ON, timeout=30-60s │
│ External API clients        │ keep-alive=ON, timeout=15-30s │
│ Load balancer → backend    │ keep-alive=ON, timeout > LB    │
│ One-shot webhook calls     │ keep-alive=OFF                 │
│ Long-polling connections   │ keep-alive=ON, timeout=300s    │
└────────────────────────────┴────────────────────────────────┘

CRITICAL: Backend keep-alive timeout MUST be longer than
          load balancer/proxy timeout to prevent race conditions.
  nginx proxy_read_timeout: 60s → backend timeout: 65s
  ALB idle_timeout: 60s        → backend timeout: 65s
```

```typescript
// Express.js keep-alive configuration
const server = app.listen(3000);
server.keepAliveTimeout = 65000;  // 65s — must exceed ALB's 60s idle timeout
server.headersTimeout = 66000;    // slightly above keepAliveTimeout
```

---

## Timeout Configuration

```
Timeout Layers (outermost → innermost):
┌──────────────────────────────────────────────────────────┐
│ Client Request Timeout: 30s                                │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Load Balancer Timeout: 25s                          │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │ App Server Request Timeout: 20s               │  │   │
│  │  │  ┌────────────────────────────────────────┐  │  │   │
│  │  │  │ Downstream Service Call: 5s             │  │  │   │
│  │  │  │  ┌──────────────────────────────────┐  │  │  │   │
│  │  │  │  │ DB Query Timeout: 3s              │  │  │  │   │
│  │  │  │  └──────────────────────────────────┘  │  │  │   │
│  │  │  └────────────────────────────────────────┘  │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
Rule: Each inner layer timeout < outer layer timeout.
```

```typescript
// TypeScript: per-service timeout configuration
const client = axios.create({
  baseURL, timeout: 5000,
  httpAgent: new http.Agent({ timeout: 3000, keepAlive: true }),
});
```

```go
// Go: context-based timeout — propagates cancellation through call chain
func callService(ctx context.Context, url string) (*http.Response, error) {
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()
    req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
    return httpClient.Do(req)
}
```

---

## Graceful Shutdown & Connection Draining

```go
// Go: graceful shutdown with connection draining
func main() {
    srv := &http.Server{Addr: ":8080", Handler: router}

    go func() {
        if err := srv.ListenAndServe(); err != http.ErrServerClosed {
            log.Fatal(err)
        }
    }()

    // Wait for interrupt signal
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
    <-quit

    log.Println("Shutting down: stop accepting new connections")

    // Phase 1: Stop accepting new requests, drain in-flight
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    if err := srv.Shutdown(ctx); err != nil {
        log.Printf("Forced shutdown: %v", err)
    }
    log.Println("Server stopped")
}
```

```typescript
// Node.js: graceful shutdown
import { Server } from 'http';

function gracefulShutdown(server: Server, timeout = 30000): void {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
      console.log('All connections drained. Exiting.');
      process.exit(0);
    });

    // Health check returns 503 during drain
    // (middleware checks shuttingDown flag)

    // Force exit after timeout
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, timeout).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
```

---

## Connection Multiplexing (HTTP/2, gRPC)

```
HTTP/1.1: sequential requests per connection (head-of-line blocking), 6 conns per host
HTTP/2:   multiplexed streams on single TCP connection, 100+ concurrent requests
gRPC:     built on HTTP/2, single connection → 100+ concurrent RPCs, bidirectional streaming
```

```go
// Go: h2c (HTTP/2 cleartext) for internal services — no TLS overhead
import "golang.org/x/net/http2/h2c"
import "golang.org/x/net/http2"

h2s := &http2.Server{MaxConcurrentStreams: 250}
srv := &http.Server{Addr: ":8080", Handler: h2c.NewHandler(mux, h2s)}
// HTTP/2 with TLS is automatic when using ListenAndServeTLS
```

---

## Retry with Exponential Backoff

```typescript
// TypeScript: retry with jitter — prevents thundering herd
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: Set<number>;
}

async function fetchWithRetry(
  url: string,
  config: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 200,
    maxDelayMs: 10000,
    retryableStatuses: new Set([408, 429, 500, 502, 503, 504]),
  },
): Promise<Response> {
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!config.retryableStatuses.has(response.status)) return response;
      if (attempt === config.maxRetries) return response;
    } catch (err) {
      if (attempt === config.maxRetries) throw err;
    }

    // Exponential backoff with full jitter
    const backoff = Math.min(
      config.maxDelayMs,
      config.baseDelayMs * Math.pow(2, attempt),
    );
    const jitter = Math.random() * backoff; // full jitter
    await new Promise(r => setTimeout(r, jitter));
  }
  throw new Error('Unreachable');
}
```

---

## Best Practices

1. **ALWAYS reuse connections** via pooling — never create per-request connections for DB, HTTP, or gRPC
2. **ALWAYS set timeouts at every layer** — connect, read, write, total — with inner < outer
3. **ALWAYS implement graceful shutdown** — drain in-flight requests before terminating
4. **ALWAYS close/drain HTTP response bodies** (Go) — otherwise connections are leaked from the pool
5. **ALWAYS set backend keep-alive timeout > load balancer timeout** — prevents connection reset races
6. **ALWAYS use exponential backoff with jitter** for retries — prevent thundering herd on recovery
7. **Use HTTP/2 or gRPC** for internal service communication — single connection multiplexes many requests
8. **ALWAYS monitor connection pool metrics** — size, idle, waiting, checkout latency
9. **Set connection limits per host** — prevent one slow upstream from exhausting all connections
10. **Pre-warm connection pools** on startup — avoid cold-start latency on first requests

---

## Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| Per-request connection creation | High latency, connection storms | Connection pooling with reuse |
| No timeout on downstream calls | Thread/goroutine leak, cascading failure | Set context timeout on every call |
| Backend timeout < LB timeout | Sporadic 502s (connection reset) | Backend timeout = LB timeout + 5s |
| Not reading response body (Go) | Pool exhaustion, FD leak | `defer resp.Body.Close()` + `io.ReadAll` |
| Retry without backoff | Amplifies failures, thundering herd | Exponential backoff with full jitter |
| No graceful shutdown | In-flight requests get 502/reset | SIGTERM handler with connection draining |
| Unbounded connection pools | FD exhaustion, memory OOM | Set maxSockets / MaxIdleConnsPerHost |
| Same timeout for all endpoints | Slow endpoint blocks fast ones | Per-endpoint timeout configuration |

---

## Enforcement Checklist

- [ ] Connection pooling configured for all outbound connections (DB, HTTP, gRPC)
- [ ] Timeouts set at every layer (connect, read, write, total)
- [ ] Backend keep-alive timeout > load balancer idle timeout
- [ ] Graceful shutdown implemented with connection draining
- [ ] Retry logic uses exponential backoff with jitter
- [ ] Connection pool metrics exported (size, utilization, wait time)
- [ ] Response bodies always closed/drained
- [ ] HTTP/2 enabled for internal service communication
- [ ] Per-host connection limits prevent single-upstream exhaustion
- [ ] Connection pool pre-warming on service startup
