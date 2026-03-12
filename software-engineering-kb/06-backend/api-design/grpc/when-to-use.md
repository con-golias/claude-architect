# gRPC Decision Framework

> **AI Plugin Directive:** When recommending API technology choices, evaluating gRPC adoption, or designing system communication patterns, APPLY the decision framework in this document. USE the comparison matrices, decision trees, and readiness assessments to make informed technology choices. NEVER recommend gRPC where it is contraindicated. NEVER dismiss gRPC where it is the optimal choice.

**Core Rule: ALWAYS evaluate gRPC against REST, GraphQL, WebSockets, and message queues using the structured decision framework below. NEVER choose a communication protocol based on hype or familiarity alone. ALWAYS consider browser support, team readiness, debugging requirements, and infrastructure constraints before committing to gRPC.**

---

## 1. gRPC vs REST

### 1.1 Comprehensive Comparison Matrix

| Dimension | gRPC | REST (HTTP/JSON) | Winner |
|-----------|------|-------------------|--------|
| **Serialization** | Protocol Buffers (binary) | JSON (text) | gRPC — 3-10x smaller payloads |
| **Transport** | HTTP/2 required | HTTP/1.1 or HTTP/2 | gRPC — multiplexing, header compression |
| **Latency** | ~1-5ms typical inter-service | ~5-20ms typical inter-service | gRPC — binary parsing, connection reuse |
| **Throughput** | High — binary + multiplexing | Moderate — text parsing overhead | gRPC — 5-10x higher in benchmarks |
| **Schema** | .proto files (strict contract) | OpenAPI/Swagger (optional) | gRPC — enforced contract |
| **Code generation** | First-class, multi-language | Optional (openapi-generator) | gRPC — native, reliable |
| **Streaming** | 4 patterns (unary, server, client, bidi) | SSE, WebSocket (separate protocol) | gRPC — native bidirectional |
| **Browser support** | gRPC-Web (limited) or gRPC-Gateway | Native | REST — universal browser support |
| **Debugging** | grpcurl, Postman (limited), custom tools | curl, Postman, browser DevTools | REST — richer tool ecosystem |
| **Caching** | No native HTTP caching | HTTP cache headers, CDN, proxies | REST — built-in cacheability |
| **Human readability** | Binary — requires tooling | JSON — human readable | REST — readable without tools |
| **Error model** | 17 status codes + rich error details | HTTP status codes + custom bodies | Tie — both are capable |
| **Discoverability** | Reflection API, proto files | Hypermedia (HATEOAS), OpenAPI UI | REST — self-documenting possible |
| **Ecosystem maturity** | Growing rapidly | Decades of tooling | REST — mature ecosystem |
| **Load balancing** | Requires L7 / client-side LB | Standard L4/L7 LB | REST — simpler infrastructure |
| **Firewall/proxy** | May be blocked (HTTP/2, binary) | Universally supported | REST — no firewall issues |

### 1.2 Code Comparison

**REST (Express + JSON):**
```typescript
// Server
app.get("/api/v1/users/:id", async (req, res) => {
  const user = await db.findUser(req.params.id);
  if (!user) return res.status(404).json({ error: "not found" });
  res.json(user);
});

// Client
const res = await fetch("https://api.example.com/v1/users/123");
const user = await res.json();
```

**gRPC (Go):**
```go
// Server
func (s *server) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    user, err := s.db.FindUser(ctx, req.GetUserId())
    if err != nil {
        return nil, status.Error(codes.NotFound, "user not found")
    }
    return user, nil
}

// Client
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()
user, err := client.GetUser(ctx, &pb.GetUserRequest{UserId: "123"})
```

### 1.3 When to Choose gRPC over REST

- Inter-service communication in microservices
- High-throughput, low-latency requirements
- Streaming data (real-time updates, event streams)
- Polyglot environments (multiple languages need consistent contracts)
- Mobile clients on constrained networks (smaller payloads)
- Strong schema enforcement is required

### 1.4 When to Choose REST over gRPC

- Public-facing APIs consumed by third-party developers
- Browser-only applications without a backend proxy
- Simple CRUD applications with basic requirements
- Teams without protobuf/gRPC experience and tight deadlines
- HTTP caching is critical (CDN, browser cache)
- Maximum debugging simplicity is required

---

## 2. gRPC vs GraphQL

### 2.1 Comparison Matrix

| Dimension | gRPC | GraphQL | Winner |
|-----------|------|---------|--------|
| **Query flexibility** | Fixed schema — server defines exactly what's returned | Client chooses exact fields | GraphQL — client-driven queries |
| **Over-fetching** | Possible without field masks | Eliminated by design | GraphQL — precise data fetching |
| **Under-fetching** | Multiple RPCs for related data | Single query for nested data | GraphQL — resolve relationships in one request |
| **Performance** | Binary, multiplexed, very fast | JSON, single endpoint, resolver overhead | gRPC — raw speed |
| **Streaming** | Native bidirectional | Subscriptions (WebSocket-based) | gRPC — more mature streaming |
| **Schema** | Protobuf (strict, versioned) | GraphQL SDL (strict, introspectable) | Tie — both are strongly typed |
| **Code generation** | protoc / buf — multi-language | graphql-codegen, Relay compiler | Tie — both generate types |
| **Caching** | No HTTP caching | Apollo Cache, persisted queries | GraphQL — client-side caching |
| **N+1 problem** | Not applicable (explicit RPCs) | Major concern — needs DataLoader | gRPC — no N+1 by design |
| **Learning curve** | Moderate (protobuf, HTTP/2) | Moderate (SDL, resolvers, client cache) | Tie |
| **Browser support** | gRPC-Web or Gateway required | Native — single HTTP endpoint | GraphQL — universal browser support |
| **Backend complexity** | Simple handlers | Resolver graph, DataLoader, caching | gRPC — simpler backend |

### 2.2 Decision Logic

```
Need flexible client queries? ────────▶ GraphQL
    │
    NO
    │
Multiple frontend teams with          ────────▶ GraphQL
different data needs?
    │
    NO
    │
Backend-to-backend communication? ────▶ gRPC
    │
    NO
    │
Need streaming? ──────────────────────▶ gRPC
    │
    NO
    │
Need maximum performance? ────────────▶ gRPC
    │
    NO
    │
Public API for third-party? ──────────▶ REST or GraphQL (not gRPC)
```

### 2.3 When to Choose gRPC over GraphQL

- Backend microservice-to-microservice calls
- High-throughput data pipelines
- Real-time bidirectional streaming
- Performance-critical paths
- Strict versioned contracts between teams

### 2.4 When to Choose GraphQL over gRPC

- Multiple frontend clients (web, mobile, TV) with different data needs
- API aggregation layer (BFF — Backend for Frontend)
- Rapid frontend iteration without backend changes
- Public APIs where discoverability matters
- Replacing multiple REST endpoints with a unified query layer

---

## 3. gRPC vs WebSocket

### 3.1 Comparison Matrix

| Dimension | gRPC (Bidirectional Streaming) | WebSocket | Winner |
|-----------|-------------------------------|-----------|--------|
| **Protocol** | HTTP/2 streams | Upgraded HTTP/1.1 → WS | Tie — different trade-offs |
| **Framing** | Length-prefixed protobuf | Application-defined | gRPC — structured framing |
| **Schema** | Protobuf (strong types) | None (usually JSON) | gRPC — type safety |
| **Multiplexing** | Multiple streams per connection | One logical channel per connection | gRPC — native multiplexing |
| **Browser support** | gRPC-Web (limited bidi) | Native in all browsers | WebSocket — full browser support |
| **Load balancing** | L7 LB distributes streams | Sticky sessions required | gRPC — better LB integration |
| **Reconnection** | Channel handles reconnect | Manual reconnection logic | gRPC — built-in resilience |
| **Backpressure** | HTTP/2 flow control | No built-in mechanism | gRPC — transport-level backpressure |
| **Middleware** | Interceptors (auth, logging, tracing) | Manual per-connection | gRPC — standardized middleware |
| **Debugging** | grpcurl, interceptor logging | WebSocket inspectors | Tie |

### 3.2 When to Choose gRPC over WebSocket

- Backend service-to-service streaming
- Need structured protobuf contracts for stream messages
- Need multiple independent streams per connection (multiplexing)
- Load balancing is a concern (HTTP/2 LB > sticky sessions)
- Interceptor chain needed for auth, tracing, logging

### 3.3 When to Choose WebSocket over gRPC

- Browser-to-server bidirectional communication
- Existing WebSocket infrastructure
- Simple pub/sub patterns without complex typing needs
- Gaming with browser clients requiring minimal latency
- Chat applications with browser-first requirements

---

## 4. gRPC vs Message Queues

### 4.1 Comparison Matrix

| Dimension | gRPC | Message Queue (Kafka, RabbitMQ, NATS) | Winner |
|-----------|------|--------------------------------------|--------|
| **Communication** | Synchronous (request-response) | Asynchronous (fire-and-forget) | Depends on use case |
| **Coupling** | Tight (client knows server) | Loose (producer doesn't know consumer) | MQ — loose coupling |
| **Delivery** | At-most-once (unless retried) | At-least-once, exactly-once (Kafka) | MQ — delivery guarantees |
| **Ordering** | Per-stream | Per-partition (Kafka) | MQ — partition ordering |
| **Buffering** | No — fails if server is down | Yes — messages persist in queue | MQ — resilience to failures |
| **Latency** | ~1-5ms | ~10-100ms | gRPC — lower latency |
| **Fan-out** | Client calls each service | Queue delivers to all subscribers | MQ — native fan-out |
| **Backpressure** | HTTP/2 flow control | Consumer-driven pull | Both handle backpressure |
| **Observability** | Distributed tracing (OpenTelemetry) | Queue monitoring + tracing | Tie |

### 4.2 Decision Logic

```
Does the caller need an immediate response? ──▶ gRPC
    │
    NO
    │
Can the operation be processed later? ────────▶ Message Queue
    │
    │
Need to decouple producer from consumer? ────▶ Message Queue
    │
    NO
    │
Need fan-out to multiple consumers? ──────────▶ Message Queue
    │
    NO
    │
Need guaranteed delivery despite failures? ──▶ Message Queue
    │
    NO
    │
Performance-critical synchronous path? ──────▶ gRPC
```

### 4.3 Common Hybrid Pattern

USE both — gRPC for synchronous paths, message queues for asynchronous workflows.

```
┌────────────────────────────────────────────────────────┐
│                 Hybrid Architecture                     │
│                                                        │
│  Mobile App                                            │
│      │                                                 │
│      │ gRPC (synchronous)                              │
│      ▼                                                 │
│  ┌───────────┐    gRPC     ┌──────────────┐            │
│  │ API       │────────────▶│ Payment      │            │
│  │ Gateway   │             │ Service      │            │
│  └───────────┘             └──────┬───────┘            │
│      │                            │                    │
│      │ gRPC                       │ Publish            │
│      ▼                            ▼                    │
│  ┌───────────┐          ┌─────────────────┐            │
│  │ User      │          │  Kafka / NATS   │            │
│  │ Service   │          │  (async events) │            │
│  └───────────┘          └────┬───────┬────┘            │
│                              │       │                 │
│                    Subscribe │       │ Subscribe       │
│                              ▼       ▼                 │
│                     ┌──────────┐ ┌──────────┐          │
│                     │Inventory │ │ Email    │          │
│                     │Service   │ │ Service  │          │
│                     └──────────┘ └──────────┘          │
└────────────────────────────────────────────────────────┘
```

### 4.4 When to Use gRPC vs Message Queues

- **gRPC:** Caller needs immediate response, low latency critical, direct service-to-service
- **Message Queue:** Fire-and-forget, fan-out, guaranteed delivery, temporal decoupling

---

## 5. Master Decision Tree

USE this decision tree to choose the right communication protocol.

```
START: What type of communication do you need?
    │
    ├─ Browser client to server?
    │    │
    │    ├─ Need flexible queries / multiple frontends? ──▶ GraphQL
    │    │
    │    ├─ Real-time bidirectional? ─────────────────────▶ WebSocket
    │    │
    │    ├─ Standard CRUD + caching? ─────────────────────▶ REST
    │    │
    │    └─ High performance + willing to use gRPC-Web? ─▶ gRPC-Web + Envoy
    │
    ├─ Service-to-service (backend)?
    │    │
    │    ├─ Synchronous request-response?
    │    │    │
    │    │    ├─ Need strong contracts + performance? ────▶ gRPC ✓
    │    │    │
    │    │    └─ Simple, few services, REST already works?▶ REST
    │    │
    │    ├─ Real-time streaming?
    │    │    │
    │    │    ├─ Server → Client stream? ─────────────────▶ gRPC server streaming
    │    │    │
    │    │    ├─ Bidirectional stream? ───────────────────▶ gRPC bidi streaming
    │    │    │
    │    │    └─ Event sourcing / log? ──────────────────▶ Kafka / NATS
    │    │
    │    └─ Asynchronous / fire-and-forget?
    │         │
    │         ├─ Need guaranteed delivery? ──────────────▶ Kafka / RabbitMQ
    │         │
    │         ├─ Need fan-out to many consumers? ────────▶ Kafka / NATS
    │         │
    │         └─ Simple async task? ─────────────────────▶ Redis Streams / SQS
    │
    ├─ Mobile client to server?
    │    │
    │    ├─ Low bandwidth / high performance needed? ────▶ gRPC (protobuf is small)
    │    │
    │    └─ Standard app with good connectivity? ────────▶ REST or GraphQL
    │
    └─ Public API for third-party developers?
         │
         ├─ Maximum adoption / simplicity? ──────────────▶ REST
         │
         ├─ Complex data with relationships? ────────────▶ GraphQL
         │
         └─ Internal partners with strong contracts? ───▶ gRPC + gRPC-Gateway
```

---

## 6. Ideal Use Cases for gRPC

### 6.1 Microservice Communication

gRPC is the default choice for service-to-service calls in microservice architectures.

```
┌──────────┐  gRPC  ┌──────────┐  gRPC  ┌──────────┐
│  Order   │───────▶│ Payment  │───────▶│ Billing  │
│ Service  │        │ Service  │        │ Service  │
└──────────┘        └──────────┘        └──────────┘
     │ gRPC              │ gRPC
     ▼                   ▼
┌──────────┐        ┌──────────┐
│Inventory │        │Notification│
│ Service  │        │  Service  │
└──────────┘        └───────────┘
```

**Why:** Strong contracts, code generation, low latency, multiplexing.

### 6.2 Real-Time Data Streaming

```protobuf
service MarketDataService {
  rpc StreamPrices(StreamPricesRequest) returns (stream PriceUpdate);
  rpc StreamOrderBook(StreamOrderBookRequest) returns (stream OrderBookSnapshot);
}
```

**Why:** Native server streaming, backpressure, efficient binary encoding.

### 6.3 Mobile Applications on Constrained Networks

**Why:** Protobuf is 3-10x smaller than JSON. HTTP/2 header compression reduces overhead. Multiplexing avoids connection setup latency.

### 6.4 Polyglot Environments

When services are written in Go, Java, Python, TypeScript, Rust, C++ — gRPC provides a single `.proto` definition that generates correct code for all languages.

### 6.5 Real Companies Using gRPC

| Company | Use Case | Why gRPC |
|---------|----------|----------|
| **Google** | All internal services | Created gRPC, billions of RPCs/day |
| **Netflix** | Inter-service communication | Performance, polyglot (Java/Go/Python) |
| **Uber** | 1000+ microservices | Low latency, strong contracts |
| **Slack** | Backend services | Migrated from REST for performance |
| **Square** | Payment processing | Strong typing, streaming, performance |
| **Dropbox** | Internal services | Migrated from Apache Thrift |
| **CoreOS/etcd** | Distributed KV store API | Streaming watch, performance |
| **Cockroach Labs** | CockroachDB inter-node communication | Performance-critical distributed DB |
| **Lyft** | Service mesh with Envoy | gRPC + Envoy for all inter-service |
| **Spotify** | Backend microservices | Polyglot environment, performance |

---

## 7. When NOT to Use gRPC

### 7.1 Contraindications

| Scenario | Why NOT gRPC | Use Instead |
|----------|-------------|-------------|
| **Browser-only app, no backend proxy** | gRPC requires HTTP/2 end-to-end; browsers don't support gRPC natively | REST or GraphQL |
| **Public API for unknown consumers** | Third-party devs expect REST + JSON; gRPC has higher adoption barrier | REST with OpenAPI |
| **Simple CRUD app (5-10 endpoints)** | Overhead of protobuf toolchain not justified | REST |
| **Heavy HTTP caching needed** | gRPC has no HTTP caching semantics | REST with Cache-Control headers |
| **Team has zero protobuf experience + tight deadline** | Learning curve + toolchain setup takes time | REST (ship first, migrate later) |
| **Debugging must be trivial** | Binary protocol harder to inspect than JSON | REST |
| **Infrastructure doesn't support HTTP/2** | Some older proxies, firewalls, CDNs strip HTTP/2 | REST over HTTP/1.1 |
| **One-off scripts / CLI tools** | curl + JSON is simpler for ad-hoc calls | REST |
| **Serverless functions (cold starts)** | gRPC connection setup overhead during cold starts | REST or lightweight RPC |

### 7.2 Red Flags for gRPC Adoption

```
IF any of these are true, THINK CAREFULLY before choosing gRPC:

  □ Your primary clients are web browsers
  □ Your team has never used Protocol Buffers
  □ Your deadline is < 2 weeks and you're starting from scratch
  □ Your infrastructure team hasn't approved HTTP/2
  □ Your API needs to be cacheable at the HTTP layer
  □ Your consumers are external third-party developers
  □ You only have 3-5 simple endpoints
  □ Your monitoring/debugging tools don't support gRPC
```

---

## 8. gRPC-Gateway & gRPC-Web

USE these bridge technologies when you need gRPC internally but must support REST/browser clients externally.

### 8.1 gRPC-Gateway (gRPC ↔ REST)

Generates a reverse proxy that translates REST/JSON to gRPC.

```
┌─────────────┐     REST/JSON     ┌───────────────┐     gRPC      ┌──────────┐
│   Browser    │─────────────────▶│  gRPC-Gateway  │─────────────▶│  gRPC    │
│   Mobile     │  GET /v1/users/1 │  (reverse proxy)│  GetUser()   │  Server  │
│   3rd Party  │                  │                 │              │          │
│   curl       │◀─────────────────│                 │◀─────────────│          │
│              │  200 OK + JSON   │  Translates     │  User proto  │          │
└─────────────┘                   └───────────────┘              └──────────┘
```

**Proto Annotations for REST Mapping:**
```protobuf
import "google/api/annotations.proto";

service UserService {
  rpc GetUser(GetUserRequest) returns (User) {
    option (google.api.http) = {
      get: "/v1/users/{user_id}"     // Maps to GET /v1/users/123
    };
  }

  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse) {
    option (google.api.http) = {
      get: "/v1/users"               // Maps to GET /v1/users?page_size=10
    };
  }

  rpc CreateUser(CreateUserRequest) returns (User) {
    option (google.api.http) = {
      post: "/v1/users"
      body: "user"                   // JSON body maps to the 'user' field
    };
  }

  rpc UpdateUser(UpdateUserRequest) returns (User) {
    option (google.api.http) = {
      patch: "/v1/users/{user.id}"
      body: "user"
    };
  }

  rpc DeleteUser(DeleteUserRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = {
      delete: "/v1/users/{user_id}"
    };
  }
}
```

### 8.2 gRPC-Web

Allows browser JavaScript to call gRPC services through an Envoy proxy.

```
┌─────────────┐   gRPC-Web      ┌──────────────┐    gRPC       ┌──────────┐
│   Browser    │───────────────▶│    Envoy     │─────────────▶│  gRPC    │
│  (JS/TS)    │  HTTP/1.1 +    │    Proxy     │  HTTP/2      │  Server  │
│             │  base64 proto  │              │              │          │
└─────────────┘                └──────────────┘              └──────────┘
```

**Limitations of gRPC-Web:**
- Unary and server-streaming only — NO client streaming or bidirectional
- Requires Envoy or similar proxy
- Larger payload than native gRPC (base64 encoding)

**TypeScript Client (Connect-Web):**
```typescript
import { createPromiseClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { UserService } from "./gen/user_service_connect";

const transport = createGrpcWebTransport({
  baseUrl: "https://api.example.com",
});
const client = createPromiseClient(UserService, transport);

const user = await client.getUser({ userId: "123" });
```

### 8.3 Bridge Technology Rules

- **USE** gRPC-Gateway when you need REST compatibility for external consumers
- **USE** gRPC-Web when browser clients need direct gRPC access
- **PREFER** gRPC-Gateway over gRPC-Web for public APIs — REST is more universally understood
- **ALWAYS** add `google.api.http` annotations when using gRPC-Gateway
- **KNOW** gRPC-Web does NOT support client streaming or bidirectional streaming
- **ALWAYS** run gRPC-Gateway/gRPC-Web proxy behind TLS termination

---

## 9. Migration Strategy: REST to gRPC

### 9.1 Incremental Migration Pattern

NEVER do a big-bang migration. ALWAYS migrate incrementally.

```
Phase 1: Dual-Stack (REST + gRPC)
┌──────────────────────────────────────────┐
│                Service                    │
│                                          │
│  ┌──────────┐      ┌──────────────────┐  │
│  │ REST     │      │  gRPC Handler    │  │
│  │ Handler  │──┐   │  (new)           │  │
│  │ (legacy) │  │   └────────┬─────────┘  │
│  └──────────┘  │            │            │
│                ▼            ▼            │
│         ┌─────────────────────────┐      │
│         │   Shared Business Logic │      │
│         └─────────────────────────┘      │
└──────────────────────────────────────────┘

Phase 2: Migrate clients one by one
  Client A ──── REST ────▶ Service     (unchanged)
  Client B ──── gRPC ────▶ Service     (migrated)
  Client C ──── REST ────▶ Service     (not yet)

Phase 3: Deprecate REST endpoints
  All clients ─── gRPC ──▶ Service
  REST endpoints marked deprecated, then removed
```

### 9.2 Migration Steps

1. **Define .proto schemas** for existing REST endpoints
2. **Generate gRPC server code** and implement handlers using shared business logic
3. **Run dual-stack** — both REST and gRPC serve the same service
4. **Migrate internal clients first** (services you control)
5. **Add gRPC-Gateway** for external clients that still need REST
6. **Monitor both paths** — compare latency, error rates, throughput
7. **Deprecate REST** endpoints after all clients have migrated
8. **Remove REST** code after deprecation period

### 9.3 Migration Rules

- **NEVER** do a big-bang migration — always run dual-stack
- **ALWAYS** migrate internal services first, external last
- **MUST** maintain REST endpoints until all consumers have migrated
- **USE** gRPC-Gateway to provide REST compatibility during transition
- **ALWAYS** compare metrics between REST and gRPC paths
- **DO NOT** change business logic during migration — only transport

---

## 10. Cost-Benefit Analysis

### 10.1 Benefits

| Benefit | Impact | Evidence |
|---------|--------|----------|
| **Reduced latency** | 2-10x faster than REST/JSON | Binary serialization + HTTP/2 multiplexing |
| **Reduced bandwidth** | 3-10x smaller payloads | Protobuf binary encoding vs JSON text |
| **Type safety** | Fewer runtime errors | Compile-time contract validation |
| **Code generation** | Less boilerplate | Consistent client/server code across languages |
| **Streaming** | Real-time capabilities | Native bidirectional streaming |
| **Contract-first** | Better API governance | .proto files as single source of truth |
| **Backwards compatibility** | Safer evolution | Protobuf wire format handles unknown fields |

### 10.2 Costs

| Cost | Impact | Mitigation |
|------|--------|------------|
| **Learning curve** | 1-4 weeks for team | Invest in training before adoption |
| **Toolchain setup** | protoc/buf, plugins, CI/CD changes | Use buf for simpler tooling |
| **Debugging complexity** | Binary protocol harder to inspect | Use grpcurl, Postman gRPC, logging interceptors |
| **Browser incompatibility** | No native browser gRPC support | gRPC-Gateway or gRPC-Web + Envoy |
| **Infrastructure changes** | Need L7 load balancer, HTTP/2 | Envoy or service mesh (Istio/Linkerd) |
| **No HTTP caching** | Cannot use CDN caching for gRPC | Implement application-level caching |
| **Smaller talent pool** | Fewer developers know gRPC | Growing rapidly, but REST is more common |

### 10.3 Break-Even Analysis

```
gRPC is worth the investment when:

  ✓ You have ≥ 5 microservices communicating
  ✓ Latency is a business-critical metric
  ✓ You operate in a polyglot environment
  ✓ You need streaming capabilities
  ✓ Your team has bandwidth for 2-4 weeks learning curve

gRPC is NOT worth it when:

  ✗ You have < 3 services
  ✗ Your API is browser-facing only
  ✗ Your team is under time pressure with no gRPC experience
  ✗ Your infrastructure doesn't support HTTP/2
  ✗ Simple REST is meeting all your requirements
```

---

## 11. Team Readiness Assessment

EVALUATE team readiness before adopting gRPC. Score each item 0-2 (0=no, 1=partial, 2=yes).

### 11.1 Technical Skills

| Skill | Score | Notes |
|-------|-------|-------|
| Protocol Buffers schema design | 0-2 | Can team members write .proto files? |
| HTTP/2 understanding | 0-2 | Does team understand multiplexing, streams? |
| Code generation toolchain | 0-2 | Can team run protoc/buf and integrate into CI? |
| Streaming patterns | 0-2 | Does team understand backpressure, flow control? |
| gRPC error model | 0-2 | Can team implement rich error details? |
| Testing gRPC services | 0-2 | Can team write integration tests with bufconn? |

### 11.2 Infrastructure Readiness

| Requirement | Score | Notes |
|-------------|-------|-------|
| L7 load balancer (Envoy/Linkerd) | 0-2 | gRPC requires L7 LB |
| HTTP/2 support end-to-end | 0-2 | No HTTP/1.1-only proxies in path |
| Service discovery (DNS/K8s) | 0-2 | gRPC needs resolver for client-side LB |
| Monitoring tools support gRPC | 0-2 | Grafana, Datadog, etc. can parse gRPC metrics |
| CI/CD proto generation | 0-2 | Proto → code generation in build pipeline |

### 11.3 Scoring

```
Total Score (out of 22):

18-22: READY — proceed with gRPC adoption
12-17: PARTIAL — invest in training and infrastructure first
 0-11: NOT READY — build foundational skills, use REST for now
```

### 11.4 Readiness Rules

- **MUST** score ≥ 12 before starting gRPC adoption in production
- **ALWAYS** invest in team training before production deployment
- **MUST** have L7 load balancing in place before gRPC goes to production
- **ALWAYS** start with a non-critical service as a pilot project
- **NEVER** adopt gRPC without monitoring and observability infrastructure

---

## 12. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Choosing gRPC for a public API | Third-party developers can't easily integrate | Use REST for public APIs, gRPC for internal |
| gRPC without L7 load balancer | All traffic goes to one backend | Deploy Envoy or use client-side LB |
| Big-bang REST→gRPC migration | Service outages, integration failures | Migrate incrementally with dual-stack |
| gRPC in browser without proxy | Connections fail silently | Use gRPC-Web + Envoy or gRPC-Gateway |
| Choosing gRPC based on hype | Team struggles, productivity drops | Evaluate against REST using this decision framework |
| Ignoring learning curve | Poorly implemented gRPC worse than REST | Budget 2-4 weeks training per team |
| Using gRPC for everything | Some use cases are better with REST/MQ | Use the master decision tree for each communication |
| No fallback for gRPC failures | System has no graceful degradation | Implement circuit breakers and fallback to REST |
| Skipping proto schema design | Frequent breaking changes, client failures | Invest in schema design upfront, run `buf breaking` in CI |
| gRPC with serverless (cold start heavy) | Connection setup on every invocation | Use REST for serverless functions, gRPC for long-running services |

---

## 13. Enforcement Checklist

- [ ] Technology choice evaluated using the master decision tree
- [ ] gRPC vs REST comparison documented with specific reasons
- [ ] Browser client requirements assessed (gRPC-Web / gRPC-Gateway if needed)
- [ ] Team readiness score calculated (≥12 for production adoption)
- [ ] Infrastructure supports HTTP/2 end-to-end
- [ ] L7 load balancer configured (Envoy, Linkerd, or client-side)
- [ ] Migration plan is incremental (no big-bang)
- [ ] Dual-stack (REST + gRPC) running during migration period
- [ ] Monitoring and observability tools configured for gRPC
- [ ] Proto schema design reviewed before implementation
- [ ] `buf lint` and `buf breaking` integrated in CI
- [ ] Non-critical pilot service identified for initial adoption
- [ ] Fallback strategy defined for gRPC service failures
- [ ] Team training completed before production deployment
