# Microservices Performance

> **Domain:** Performance > Backend Performance > Microservices Performance
> **Importance:** Critical
> **Last Updated:** 2026-03-10

## Core Concepts

Microservices introduce network overhead, serialization costs, and coordination complexity that monoliths avoid. Every service boundary adds 0.5-5ms latency. A request touching 10 services accumulates 5-50ms of pure overhead before any business logic runs.

```
Latency Tax per Service Hop:
┌──────────────────────────┬───────────┬──────────────────────┐
│ Component                 │ Cost      │ Cumulative (10 hops) │
├──────────────────────────┼───────────┼──────────────────────┤
│ DNS resolution (cached)   │ ~0.1ms   │ 1ms                  │
│ TCP + TLS setup           │ ~0ms     │ 0ms (keep-alive)     │
│ Serialization (JSON)      │ ~0.5ms   │ 5ms                  │
│ Serialization (protobuf)  │ ~0.05ms  │ 0.5ms                │
│ Network transit (same AZ) │ ~0.3ms   │ 3ms                  │
│ Sidecar proxy (Envoy)     │ ~0.5ms   │ 5ms                  │
│ Deserialization            │ ~0.5ms   │ 5ms                  │
├──────────────────────────┼───────────┼──────────────────────┤
│ Total per hop (JSON+mesh) │ ~2ms     │ 20ms                 │
│ Total per hop (proto+mesh)│ ~1ms     │ 10ms                 │
│ Total per hop (gRPC, no mesh)│ ~0.5ms│ 5ms                  │
└──────────────────────────┴───────────┴──────────────────────┘
```

---

## Inter-Service Communication

### gRPC vs REST vs Messaging

```
Protocol Comparison:
┌──────────┬──────────┬──────────┬───────────┬──────────────────┐
│ Protocol  │ Latency  │ Payload  │ Streaming │ Use Case          │
├──────────┼──────────┼──────────┼───────────┼──────────────────┤
│ gRPC     │ ~0.5ms  │ Small    │ Yes       │ Internal sync RPC │
│ REST/JSON│ ~2ms    │ Large    │ No        │ Public APIs       │
│ Kafka    │ ~5-50ms │ Flexible │ Yes       │ Async, event-driven│
│ NATS     │ ~0.5ms  │ Small    │ Yes       │ Low-latency async │
│ RabbitMQ │ ~1-5ms  │ Flexible │ No        │ Task queues       │
└──────────┴──────────┴──────────┴───────────┴──────────────────┘

Rule: Use gRPC for synchronous internal calls.
      Use messaging for asynchronous workflows.
      Use REST only for external/public APIs.
```

```go
// Go: high-performance gRPC service
import (
    "google.golang.org/grpc"
    "google.golang.org/grpc/keepalive"
)

func NewGRPCServer() *grpc.Server {
    return grpc.NewServer(
        grpc.KeepaliveParams(keepalive.ServerParameters{
            MaxConnectionIdle:     5 * time.Minute,
            MaxConnectionAge:      30 * time.Minute,  // force reconnect for load balancing
            MaxConnectionAgeGrace: 10 * time.Second,
            Time:                  10 * time.Second,   // ping idle clients
            Timeout:               3 * time.Second,
        }),
        grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
            MinTime:             5 * time.Second,
            PermitWithoutStream: true,
        }),
        grpc.MaxRecvMsgSize(16 << 20),  // 16MB max receive
        grpc.MaxSendMsgSize(16 << 20),
        grpc.MaxConcurrentStreams(200),
        // Interceptors for metrics, tracing, auth
        grpc.ChainUnaryInterceptor(
            metricsInterceptor,
            tracingInterceptor,
            authInterceptor,
        ),
    )
}
```

```typescript
// Node.js: gRPC client with keepalive and timeout
import * as grpc from '@grpc/grpc-js';

const client = new proto.UserService('user-service:50051', grpc.credentials.createInsecure(), {
  'grpc.keepalive_time_ms': 10000,
  'grpc.keepalive_timeout_ms': 5000,
  'grpc.max_receive_message_length': 16 * 1024 * 1024,
  'grpc.initial_reconnect_backoff_ms': 1000,
  'grpc.max_reconnect_backoff_ms': 30000,
});

// ALWAYS set deadline on every call
function getUser(userId: string): Promise<User> {
  const deadline = new Date(Date.now() + 5000); // 5s timeout
  return new Promise((resolve, reject) => {
    client.GetUser({ user_id: userId }, { deadline }, (err: any, res: any) =>
      err ? reject(err) : resolve(res));
  });
}
```

---

## Protocol Buffers Optimization

```protobuf
// Efficient protobuf schema design
syntax = "proto3";

message User {
  // Use fixed-size types when values are large (>2^28)
  string id = 1;           // field numbers 1-15 use 1 byte (use for frequent fields)
  string name = 2;
  string email = 3;
  int64 created_at = 4;    // unix timestamp, not google.protobuf.Timestamp (smaller)

  // Field numbers 16-2047 use 2 bytes — ok for less frequent fields
  optional string bio = 16;
  optional string avatar_url = 17;

  // Use enums instead of strings for known value sets
  UserStatus status = 5;   // 1 byte vs ~8 bytes for string "active"
}

enum UserStatus {
  USER_STATUS_UNSPECIFIED = 0;
  USER_STATUS_ACTIVE = 1;
  USER_STATUS_SUSPENDED = 2;
}

// Use repeated + message for nested arrays (not map for ordered data)
message OrderList {
  repeated Order orders = 1;
  string next_cursor = 2;
}
```

```
Protobuf vs JSON Size Comparison:
┌────────────────────┬────────────┬────────────┬─────────┐
│ Payload             │ JSON       │ Protobuf   │ Savings │
├────────────────────┼────────────┼────────────┼─────────┤
│ Single user object  │ 250 bytes  │ 85 bytes   │ 66%     │
│ 100 users list      │ 25 KB      │ 8.5 KB     │ 66%     │
│ Complex nested obj  │ 4 KB       │ 1.2 KB     │ 70%     │
│ Simple key-value    │ 50 bytes   │ 30 bytes   │ 40%     │
└────────────────────┴────────────┴────────────┴─────────┘
```

---

## Service Mesh Overhead

```
Sidecar Proxy Overhead (Envoy/Istio):
┌──────────────────────────┬────────────────────────────────┐
│ Metric                    │ Impact                          │
├──────────────────────────┼────────────────────────────────┤
│ Added latency (p50)       │ +0.3-0.5ms per hop             │
│ Added latency (p99)       │ +1-3ms per hop                 │
│ Memory per sidecar        │ 50-100MB (Envoy)               │
│ CPU per sidecar           │ 50-200m cores                   │
│ At 100 services           │ +5-10GB RAM, +5-20 CPU cores   │
└──────────────────────────┴────────────────────────────────┘
```

```yaml
# Istio sidecar resource tuning — reduce default overhead
apiVersion: networking.istio.io/v1beta1
kind: Sidecar
metadata:
  name: api-gateway
spec:
  egress:
    # CRITICAL: limit service discovery scope — default imports ALL services
    - hosts:
        - "./user-service.default.svc.cluster.local"
        - "./order-service.default.svc.cluster.local"
        # Only services this pod actually calls
  workloadSelector:
    labels:
      app: api-gateway
---
# Envoy proxy resource limits
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
spec:
  meshConfig:
    defaultConfig:
      concurrency: 2  # Envoy worker threads (default: all CPUs)
  values:
    global:
      proxy:
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 128Mi
```

```
Linkerd: lighter alternative — 0.2-0.5ms latency overhead, 20-30MB memory per proxy.
Consider Linkerd over Istio when you need mTLS + observability without full feature set.
```

---

## Message Queue Optimization

### Kafka Performance Tuning

```java
// Kafka producer tuning for throughput
Properties props = new Properties();
props.put("bootstrap.servers", "kafka:9092");
props.put("key.serializer", StringSerializer.class);
props.put("value.serializer", ByteArraySerializer.class);

// Batching: accumulate messages before sending (throughput vs latency trade-off)
props.put("batch.size", 65536);        // 64KB batch (default: 16KB)
props.put("linger.ms", 5);            // wait up to 5ms to fill batch
props.put("buffer.memory", 67108864);  // 64MB total buffer

// Compression: compress batches before sending
props.put("compression.type", "zstd"); // best ratio + speed for Kafka

// Reliability vs performance
props.put("acks", "1");                // leader ack only (faster, slight risk)
// props.put("acks", "all");           // all replicas ack (safest, slower)

// Idempotent producer (exactly-once within partition)
props.put("enable.idempotence", true);
props.put("max.in.flight.requests.per.connection", 5);

KafkaProducer<String, byte[]> producer = new KafkaProducer<>(props);
```

```java
// Kafka consumer tuning — key settings
props.put("fetch.min.bytes", 1024);           // wait for 1KB before returning
props.put("fetch.max.wait.ms", 500);          // or 500ms max wait
props.put("max.poll.records", 500);            // batch size per poll
props.put("enable.auto.commit", false);        // manual commit for at-least-once
```

### NATS for Low-Latency Messaging

```go
// Go: NATS for ultra-low-latency internal messaging (~0.5ms round trip)
import "github.com/nats-io/nats.go"

nc, _ := nats.Connect("nats://nats:4222",
    nats.MaxReconnects(-1), nats.ReconnectWait(time.Second))

// Request-reply: synchronous RPC over async infrastructure
msg, err := nc.Request("user.get", []byte(userId), 5*time.Second)

// JetStream: persistent messaging with pull-based consumers (backpressure)
js, _ := nc.JetStream()
js.Publish("orders.created", orderBytes)
sub, _ := js.PullSubscribe("orders.>", "processor", nats.MaxAckPending(100))
msgs, _ := sub.Fetch(10, nats.MaxWait(5*time.Second))
```

---

## Request Collapsing (Deduplication)

```typescript
// Collapse identical in-flight requests into one
class RequestCollapser {
  private inflight = new Map<string, Promise<any>>();

  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing; // reuse in-flight request

    const promise = fetcher().finally(() => {
      this.inflight.delete(key); // clean up after completion
    });

    this.inflight.set(key, promise);
    return promise;
  }
}

// Usage: 100 concurrent requests for same user → 1 DB query
const collapser = new RequestCollapser();

app.get('/api/users/:id', async (req, res) => {
  const user = await collapser.get(
    `user:${req.params.id}`,
    () => db.query('SELECT * FROM users WHERE id = $1', [req.params.id]),
  );
  res.json(user);
});
```

```go
// Go: singleflight for request collapsing
import "golang.org/x/sync/singleflight"

var group singleflight.Group

func GetUser(ctx context.Context, id string) (*User, error) {
    key := "user:" + id
    result, err, shared := group.Do(key, func() (any, error) {
        return db.GetUser(ctx, id) // only one DB call even if 100 concurrent requests
    })
    if shared {
        log.Printf("Request for %s was shared with %d callers", key, 0)
    }
    return result.(*User), err
}
```

---

## Bulkhead Pattern

```go
// Go: bulkhead via semaphore — isolates failures per downstream service
type Bulkhead struct {
    sem  chan struct{}
    name string
}

func NewBulkhead(name string, max int) *Bulkhead {
    return &Bulkhead{sem: make(chan struct{}, max), name: name}
}

func (b *Bulkhead) Execute(ctx context.Context, fn func() error) error {
    select {
    case b.sem <- struct{}{}: defer func() { <-b.sem }(); return fn()
    case <-ctx.Done(): return ctx.Err()
    default: return fmt.Errorf("bulkhead %s: rejected", b.name)
    }
}

// Separate bulkheads: payment-service slow → only its 10 slots consumed
var (
    userBulkhead    = NewBulkhead("user", 20)
    paymentBulkhead = NewBulkhead("payment", 10)
)
```

---

## Best Practices

1. **Use gRPC + protobuf for internal communication** — 3-5x faster serialization, 60-70% smaller payloads than REST/JSON
2. **ALWAYS set deadlines/timeouts on every RPC call** — prevent cascading slowdowns across services
3. **Limit service mesh sidecar scope** — configure Sidecar resources to only discover needed services
4. **Use request collapsing** (singleflight) for high-read endpoints — deduplicate identical concurrent requests
5. **Implement bulkhead pattern** — isolate connection pools per downstream service to contain failures
6. **Use Zstandard compression** for Kafka messages — best compression ratio at high throughput
7. **Tune Kafka batch size and linger.ms** — balance throughput vs latency per use case
8. **Minimize synchronous service chains** — fan-out via messaging instead of sequential RPC calls
9. **Use NATS for low-latency internal messaging** — sub-millisecond pub/sub when Kafka's durability is unnecessary
10. **Profile inter-service overhead** — measure serialization, network, and proxy costs separately

---

## Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| REST/JSON for internal services | 3-5x slower than gRPC, 3x larger payloads | Switch to gRPC + protobuf |
| No timeout on downstream calls | One slow service stalls everything | Context timeout on every RPC |
| All services in one bulkhead | Slow service exhausts all threads | Per-service bulkhead isolation |
| Synchronous chain of 10 services | p99 = sum of all service p99s | Fan-out, async where possible |
| Default Istio sidecar config | All services imported, high memory | Scope sidecar to needed services |
| No request collapsing on hot keys | Same DB query 100x/second | singleflight / request dedup |
| Kafka without compression | 2-3x more network + disk usage | Enable zstd compression |
| Same protocol for all communication | Using Kafka where NATS suffices | Right tool: Kafka (durable), NATS (fast) |

---

## Enforcement Checklist

- [ ] gRPC used for synchronous internal service communication
- [ ] Deadlines/timeouts set on every inter-service call
- [ ] Bulkhead pattern isolates connection pools per downstream
- [ ] Request collapsing (singleflight) on high-read endpoints
- [ ] Service mesh sidecar scoped to required services only
- [ ] Sidecar proxy resource limits configured
- [ ] Kafka producer batching and compression configured
- [ ] Inter-service latency monitored per hop (p50, p95, p99)
- [ ] Protobuf schemas use field numbers 1-15 for frequent fields
- [ ] Async messaging used for non-latency-critical workflows
