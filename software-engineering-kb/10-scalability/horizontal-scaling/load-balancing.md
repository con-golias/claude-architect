# Load Balancing

> **Domain:** Scalability > Horizontal Scaling
> **Importance:** Critical
> **Last Updated:** 2025

## Layer 4 vs Layer 7 Load Balancing

### Layer 4 (Transport)

Operates at TCP/UDP level. Routes based on IP and port without inspecting content.

```
Client → L4 LB (TCP passthrough) → Backend Server
         5-tuple hash: src_ip, dst_ip, src_port, dst_port, protocol
```

- **Throughput:** 10-40 Gbps per instance
- **Latency:** <1ms added
- **Use case:** High-throughput TCP, database connections, non-HTTP protocols
- **Limitation:** Cannot route based on URL, headers, or cookies

### Layer 7 (Application)

Inspects HTTP content. Routes based on URL path, headers, cookies, query parameters.

```
Client → L7 LB (TLS termination, HTTP inspection) → Backend Server
         Route by: path, host, header, cookie, method
```

- **Throughput:** 1-10 Gbps (TLS overhead)
- **Latency:** 1-5ms added
- **Use case:** HTTP APIs, microservices, A/B testing, canary deployments

## Load Balancing Algorithms

| Algorithm | Distribution | Session Affinity | Use Case |
|-----------|-------------|-----------------|----------|
| Round Robin | Equal | No | Homogeneous servers |
| Weighted Round Robin | Proportional | No | Mixed server capacity |
| Least Connections | Dynamic | No | Variable request duration |
| IP Hash | Deterministic | Yes | Session-dependent apps |
| Consistent Hashing | Deterministic | Yes | Cache-friendly, minimal redistribution |
| Least Response Time | Dynamic | No | Latency-sensitive APIs |
| Random with Two Choices | Near-optimal | No | Large server pools |

### NGINX Configuration

```nginx
upstream api_backend {
    # Least connections with weights
    least_conn;

    server 10.0.1.10:8080 weight=3 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:8080 weight=2 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:8080 weight=1 backup;

    keepalive 32;
}

server {
    listen 443 ssl http2;

    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Health check
        proxy_next_upstream error timeout http_502 http_503;
        proxy_next_upstream_tries 2;
    }
}
```

### HAProxy Configuration

```haproxy
frontend http_front
    bind *:443 ssl crt /etc/ssl/cert.pem
    default_backend api_servers

    # Route by path
    acl is_api path_beg /api
    acl is_static path_beg /static
    use_backend api_servers if is_api
    use_backend static_servers if is_static

backend api_servers
    balance leastconn
    option httpchk GET /health
    http-check expect status 200

    server api1 10.0.1.10:8080 check inter 5s fall 3 rise 2 weight 100
    server api2 10.0.1.11:8080 check inter 5s fall 3 rise 2 weight 100
    server api3 10.0.1.12:8080 check inter 5s fall 3 rise 2 weight 50

    # Connection draining
    option redispatch
    retries 3
```

## Health Checks

### Active Health Checks

Load balancer periodically probes backends:

```yaml
# Kubernetes Service with readiness probe
apiVersion: v1
kind: Service
metadata:
  name: api-service
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: api
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 20
```

### Passive Health Checks

Monitor real traffic for failures. Remove servers after N consecutive errors.

## Global Server Load Balancing (GSLB)

Distributes traffic across geographic regions using DNS:

```
User (EU) → DNS query → GSLB
                         ├── EU region: api-eu.example.com (latency: 20ms)
                         ├── US region: api-us.example.com (latency: 120ms)
                         └── APAC region: api-apac.example.com (latency: 180ms)
                         → Returns EU IP (lowest latency)
```

**Methods:** GeoDNS, latency-based routing, weighted DNS, failover DNS.

### AWS Global Accelerator

```hcl
resource "aws_globalaccelerator_accelerator" "api" {
  name            = "api-accelerator"
  ip_address_type = "IPV4"
  enabled         = true
}

resource "aws_globalaccelerator_endpoint_group" "us" {
  listener_arn = aws_globalaccelerator_listener.api.id
  endpoint_group_region = "us-east-1"

  endpoint_configuration {
    endpoint_id = aws_lb.us_alb.arn
    weight      = 100
  }

  health_check_path = "/health"
  health_check_interval_seconds = 10
  threshold_count = 3
}
```

## Connection Draining

Gracefully remove servers from rotation:

```go
// Go graceful shutdown with drain period
func main() {
    srv := &http.Server{Addr: ":8080", Handler: router}

    go func() { srv.ListenAndServe() }()

    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGTERM)
    <-quit

    // Stop accepting new connections, finish existing
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    srv.Shutdown(ctx)
}
```

## Sticky Sessions

Use only when stateless is impossible. Prefer externalized state.

```nginx
upstream api {
    ip_hash;  # Simple but breaks behind NAT
    # OR
    hash $cookie_session consistent;  # Cookie-based, more reliable
    server 10.0.1.10:8080;
    server 10.0.1.11:8080;
}
```

**Trade-offs:** Uneven load distribution, failover loses session, limits scaling.

## Blue-Green and Canary with Load Balancer

```nginx
# Canary: 5% traffic to new version
upstream api {
    server 10.0.1.10:8080 weight=95;  # stable
    server 10.0.2.10:8080 weight=5;   # canary
}
```

## Best Practices

1. **Use Layer 7 for HTTP services** — enables path routing, header inspection, TLS termination
2. **Implement both active and passive health checks** — active for proactive removal, passive for fast failure detection
3. **Use least-connections for variable-duration requests** — round-robin only for homogeneous, fast requests
4. **Configure connection draining** — 30s minimum drain period before removing servers
5. **Use consistent hashing for cache-friendly routing** — minimizes cache invalidation on scale events
6. **Deploy GSLB for multi-region** — latency-based routing with health-check failover
7. **Set max_fails and fail_timeout** — prevent routing to unhealthy backends
8. **Enable keepalive connections to backends** — reduce TCP handshake overhead
9. **Use separate LBs for internal and external traffic** — different security and routing requirements
10. **Monitor LB metrics** — active connections, request rate, error rate, latency per backend

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|-------------|--------|-----|
| Single load balancer (no HA) | Single point of failure | Deploy LB pair with failover |
| Sticky sessions as default | Uneven load, limits scaling | Externalize state to Redis/JWT |
| No health checks | Traffic sent to dead servers | Configure active + passive checks |
| Round-robin for heterogeneous servers | Overloaded small servers | Use weighted or least-connections |
| No connection limits | Backend overwhelm | Set max_conns per backend |
| Ignoring LB capacity | LB becomes bottleneck | Monitor and scale LB tier |
| No drain on deploy | Dropped requests during deploy | Enable connection draining |
| Layer 4 for HTTP services | Cannot route by path/header | Use Layer 7 for HTTP |

## Enforcement Checklist

- [ ] Load balancer deployed in HA pair (active-passive or active-active)
- [ ] Health checks configured with appropriate intervals and thresholds
- [ ] Connection draining enabled with minimum 30s timeout
- [ ] Backend connection limits set
- [ ] TLS termination at LB with modern cipher suites
- [ ] Monitoring dashboards for LB metrics (connections, latency, errors)
- [ ] GSLB configured for multi-region deployments
- [ ] Load test validates LB capacity matches expected peak traffic
