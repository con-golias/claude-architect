# gRPC Architecture & Production Patterns

> **AI Plugin Directive:** When generating, reviewing, or debugging gRPC service code, APPLY every rule in this document. USE the HTTP/2 transport model, communication patterns, interceptor chains, error model, and production patterns defined here. NEVER generate gRPC code that violates these directives. This is the master reference for all gRPC implementation decisions.

**Core Rule: ALWAYS design gRPC services with proper channel management, deadline propagation, rich error handling, and interceptor-based cross-cutting concerns. NEVER expose gRPC internals to clients, NEVER skip health checking, NEVER ignore backpressure in streaming RPCs.**

---

## 1. gRPC Architecture & HTTP/2 Transport

gRPC is a high-performance RPC framework built on HTTP/2 and Protocol Buffers. UNDERSTAND the transport layer — it determines every design decision.

### 1.1 HTTP/2 Foundation

gRPC REQUIRES HTTP/2. Every gRPC call maps to an HTTP/2 stream.

```
┌─────────────────────────────────────────────────────────┐
│                    HTTP/2 CONNECTION                     │
│                  (Single TCP Socket)                     │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Stream 1 │  │ Stream 3 │  │ Stream 5 │  ...          │
│  │ (RPC A)  │  │ (RPC B)  │  │ (RPC C)  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │              BINARY FRAMING LAYER                │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │    │
│  │  │HEADERS │ │  DATA  │ │HEADERS │ │  DATA  │   │    │
│  │  │Frame 1 │ │Frame 1 │ │Frame 3 │ │Frame 3 │   │    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  HPACK Header Compression    Flow Control per Stream    │
│  Server Push (unused by gRPC) Prioritization            │
└─────────────────────────────────────────────────────────┘
```

### 1.2 How a gRPC Call Maps to HTTP/2

EVERY gRPC call follows this exact wire format:

```
CLIENT REQUEST:
  HEADERS frame:
    :method = POST
    :scheme = https
    :path = /package.ServiceName/MethodName
    :authority = server:port
    content-type = application/grpc
    te = trailers
    grpc-timeout = 5S                    ← deadline
    grpc-encoding = gzip                 ← compression
    authorization = Bearer <token>       ← metadata
  DATA frame:
    ┌───────────────┬────────────────────┐
    │ Compressed (1)│ Message Length (4)  │  ← Length-Prefixed Message
    │    0 or 1     │   big-endian u32   │
    ├───────────────┴────────────────────┤
    │     Protobuf-encoded message       │
    └────────────────────────────────────┘

SERVER RESPONSE:
  HEADERS frame:
    :status = 200
    content-type = application/grpc
  DATA frame:
    [Length-Prefixed Message]             ← same format as request
  TRAILERS frame:
    grpc-status = 0                      ← status code
    grpc-message = OK                    ← human-readable
    grpc-status-details-bin = <base64>   ← rich error details
```

### 1.3 Key HTTP/2 Properties for gRPC

| Property | Impact on gRPC | Rule |
|----------|---------------|------|
| **Multiplexing** | Multiple RPCs share one TCP connection | NEVER create connection-per-request |
| **Binary framing** | Efficient parsing, no text overhead | ALWAYS use binary protobuf, not JSON |
| **Header compression** | HPACK reduces repeated header overhead | KEEP metadata keys short and reusable |
| **Flow control** | Per-stream and connection-level | MUST handle backpressure in streaming |
| **Server push** | Not used by gRPC | DO NOT rely on server push |
| **Stream priority** | Not reliably supported | DO NOT depend on priority ordering |

### 1.4 Transport Rules

- **ALWAYS** use TLS in production — gRPC over plaintext is for development only
- **NEVER** assume HTTP/1.1 compatibility — gRPC requires HTTP/2 end-to-end
- **MUST** configure proper keepalive to detect dead connections (see Section 13)
- **DO NOT** put gRPC behind HTTP/1.1-only proxies — use Envoy, Nginx with gRPC module, or Traefik

---

## 2. Communication Patterns

gRPC supports four communication patterns. CHOOSE the right pattern for each use case.

### 2.1 Pattern Overview

```
┌──────────────────┬────────────────────┬────────────────────┐
│                  │  Server sends ONE  │ Server sends MANY  │
├──────────────────┼────────────────────┼────────────────────┤
│ Client sends ONE │  Unary             │ Server Streaming   │
│                  │  req → ← res       │ req → ← res₁      │
│                  │                    │        ← res₂      │
│                  │                    │        ← res₃      │
├──────────────────┼────────────────────┼────────────────────┤
│ Client sends MANY│  Client Streaming  │ Bidirectional      │
│                  │  req₁ →            │ req₁ → ← res₁     │
│                  │  req₂ →    ← res   │ req₂ → ← res₂     │
│                  │  req₃ →            │ req₃ → ← res₃     │
└──────────────────┴────────────────────┴────────────────────┘
```

### 2.2 Unary RPC

USE for request-response interactions. This is the most common pattern — equivalent to a function call.

```protobuf
service UserService {
  rpc GetUser(GetUserRequest) returns (User);
}

message GetUserRequest {
  string user_id = 1;
}
```

**Go Server:**
```go
func (s *server) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    if req.GetUserId() == "" {
        return nil, status.Error(codes.InvalidArgument, "user_id is required")
    }
    user, err := s.store.FindUser(ctx, req.GetUserId())
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to fetch user: %v", err)
    }
    if user == nil {
        return nil, status.Error(codes.NotFound, "user not found")
    }
    return user, nil
}
```

**TypeScript Client (nice-grpc):**
```typescript
const client = createClient(UserServiceDefinition, channel);

try {
  const user = await client.getUser({ userId: "abc-123" });
  console.log(user.name);
} catch (err) {
  if (err instanceof ClientError) {
    if (err.code === Status.NOT_FOUND) {
      console.error("User not found");
    }
  }
}
```

**Python Client:**
```python
stub = UserServiceStub(channel)

try:
    user = stub.GetUser(GetUserRequest(user_id="abc-123"))
    print(user.name)
except grpc.RpcError as e:
    if e.code() == grpc.StatusCode.NOT_FOUND:
        print("User not found")
```

### 2.3 Server Streaming RPC

USE when the server produces a sequence of responses. IDEAL for real-time feeds, large result sets, event streams.

```protobuf
service OrderService {
  rpc WatchOrders(WatchOrdersRequest) returns (stream OrderEvent);
}
```

**Go Server:**
```go
func (s *server) WatchOrders(req *pb.WatchOrdersRequest, stream pb.OrderService_WatchOrdersServer) error {
    ctx := stream.Context()
    ch := s.orderStore.Subscribe(req.GetUserId())
    defer s.orderStore.Unsubscribe(ch)

    for {
        select {
        case <-ctx.Done():
            return status.Error(codes.Canceled, "client disconnected")
        case event, ok := <-ch:
            if !ok {
                return nil // channel closed, stream complete
            }
            if err := stream.Send(event); err != nil {
                return err // client disconnected or error
            }
        }
    }
}
```

**TypeScript Client:**
```typescript
for await (const event of client.watchOrders({ userId: "abc-123" })) {
  console.log(`Order ${event.orderId}: ${event.status}`);
}
```

**Python Client:**
```python
for event in stub.WatchOrders(WatchOrdersRequest(user_id="abc-123")):
    print(f"Order {event.order_id}: {event.status}")
```

### 2.4 Client Streaming RPC

USE when the client sends a sequence of messages and the server responds once. IDEAL for file uploads, batch operations, aggregations.

```protobuf
service AnalyticsService {
  rpc RecordEvents(stream AnalyticsEvent) returns (RecordSummary);
}
```

**Go Server:**
```go
func (s *server) RecordEvents(stream pb.AnalyticsService_RecordEventsServer) error {
    var count int64
    for {
        event, err := stream.Recv()
        if err == io.EOF {
            return stream.SendAndClose(&pb.RecordSummary{
                EventsReceived: count,
                ProcessedAt:    timestamppb.Now(),
            })
        }
        if err != nil {
            return err
        }
        if err := s.store.Insert(stream.Context(), event); err != nil {
            return status.Errorf(codes.Internal, "failed to store event: %v", err)
        }
        count++
    }
}
```

### 2.5 Bidirectional Streaming RPC

USE when both client and server send sequences independently. IDEAL for chat, collaborative editing, real-time sync.

```protobuf
service ChatService {
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);
}
```

**Go Server:**
```go
func (s *server) Chat(stream pb.ChatService_ChatServer) error {
    ctx := stream.Context()
    room := s.getRoom(ctx)

    // Receive loop in goroutine
    go func() {
        for {
            msg, err := stream.Recv()
            if err != nil {
                return // client done or error
            }
            room.Broadcast(msg)
        }
    }()

    // Send loop
    ch := room.Subscribe()
    defer room.Unsubscribe(ch)
    for {
        select {
        case <-ctx.Done():
            return nil
        case msg := <-ch:
            if err := stream.Send(msg); err != nil {
                return err
            }
        }
    }
}
```

### 2.6 Pattern Selection Rules

| Use Case | Pattern | Rationale |
|----------|---------|-----------|
| CRUD operations | Unary | Simple request-response |
| Real-time feeds | Server streaming | Server pushes updates |
| File upload | Client streaming | Client sends chunks |
| Batch ingest | Client streaming | Client sends many items |
| Chat / gaming | Bidirectional | Both sides send freely |
| Long-running query results | Server streaming | Progressive delivery |
| IoT telemetry | Client streaming | Device sends measurements |
| Collaborative editing | Bidirectional | Real-time sync |

**Rules:**
- **ALWAYS** prefer unary for simple operations — DO NOT use streaming when unary suffices
- **ALWAYS** handle `context.Done()` / cancellation in streaming loops
- **MUST** implement backpressure — if consumer is slow, producer must slow down or buffer
- **NEVER** assume message ordering across different streams
- **MUST** handle `io.EOF` on `Recv()` to detect stream completion

---

## 3. Channel Management & Connection Lifecycle

A gRPC **channel** is the core abstraction. It represents a virtual connection to an endpoint and manages one or more HTTP/2 connections underneath.

### 3.1 Connection State Machine

```
                    ┌──────────┐
         ┌─────────│   IDLE   │←────────────────┐
         │         └────┬─────┘                 │
         │              │ RPC attempt           │ No RPCs for idle_timeout
         │              ▼                       │
         │         ┌──────────┐                 │
         │         │CONNECTING│─────────┐       │
         │         └────┬─────┘         │       │
         │              │ Success       │ Fail  │
         │              ▼               ▼       │
         │         ┌──────────┐  ┌───────────┐  │
         │         │  READY   │  │TRANSIENT  │──┘
         │         └────┬─────┘  │ FAILURE   │
         │              │        └───────────┘
         │              │ Connection lost     ▲
         │              └────────────────────┘
         │
         │         ┌──────────┐
         └────────▶│ SHUTDOWN │
                   └──────────┘
```

### 3.2 Channel Creation Rules

**Go:**
```go
// CORRECT — use DialContext with options
conn, err := grpc.DialContext(ctx, "dns:///myservice.example.com:443",
    grpc.WithTransportCredentials(creds),
    grpc.WithDefaultServiceConfig(`{
        "loadBalancingConfig": [{"round_robin": {}}],
        "healthCheckConfig": {"serviceName": "myservice"}
    }`),
    grpc.WithKeepaliveParams(keepalive.ClientParameters{
        Time:                10 * time.Second,
        Timeout:             3 * time.Second,
        PermitWithoutStream: true,
    }),
)
if err != nil {
    log.Fatalf("failed to dial: %v", err)
}
defer conn.Close()

// WRONG — creating connection per request
func getUser(id string) (*pb.User, error) {
    conn, _ := grpc.Dial("localhost:50051") // ✗ connection per call
    defer conn.Close()
    client := pb.NewUserServiceClient(conn)
    return client.GetUser(context.Background(), &pb.GetUserRequest{UserId: id})
}
```

**TypeScript (@grpc/grpc-js):**
```typescript
// CORRECT — reuse channel
const channel = createChannel("dns:///myservice:443", ChannelCredentials.createSsl());
const client = createClient(UserServiceDefinition, channel);

// WRONG — channel per request
async function getUser(id: string) {
  const ch = createChannel("localhost:50051"); // ✗ new channel per call
  const cl = createClient(UserServiceDefinition, ch);
  return cl.getUser({ userId: id });
}
```

### 3.3 Channel Rules

- **ALWAYS** create channels at application startup and reuse them
- **NEVER** create a channel per RPC call — this defeats HTTP/2 multiplexing
- **ALWAYS** use `dns:///` scheme for service discovery in production
- **MUST** call `Close()` / `close()` on shutdown to drain connections gracefully
- **ALWAYS** configure keepalive parameters to detect dead connections
- **DO NOT** assume a channel is "connected" — channels connect lazily on first RPC

---

## 4. Interceptors & Middleware

Interceptors are gRPC's middleware mechanism. They execute before and after each RPC call.

### 4.1 Interceptor Architecture

```
Client Call
    │
    ▼
┌──────────────┐
│  Interceptor │  ← Logging
│      1       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Interceptor │  ← Auth Token Injection
│      2       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Interceptor │  ← Metrics / Tracing
│      3       │
└──────┬───────┘
       │
       ▼
  gRPC Transport  ────────▶  Server
                              │
                         ┌────┴─────┐
                         │Interceptor│ ← Auth Validation
                         │    1      │
                         └────┬──────┘
                              │
                         ┌────┴──────┐
                         │Interceptor│ ← Logging
                         │    2      │
                         └────┬──────┘
                              │
                         ┌────┴──────┐
                         │Interceptor│ ← Recovery (panic)
                         │    3      │
                         └────┬──────┘
                              │
                          Handler
```

### 4.2 Go Interceptors

**Unary Server Interceptor:**
```go
func loggingInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    start := time.Now()

    // Pre-processing
    log.Printf("RPC: %s started", info.FullMethod)

    // Call the handler
    resp, err := handler(ctx, req)

    // Post-processing
    duration := time.Since(start)
    code := status.Code(err)
    log.Printf("RPC: %s completed | code=%s | duration=%s", info.FullMethod, code, duration)

    return resp, err
}

func recoveryInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (resp interface{}, err error) {
    defer func() {
        if r := recover(); r != nil {
            log.Printf("panic recovered in %s: %v\n%s", info.FullMethod, r, debug.Stack())
            err = status.Errorf(codes.Internal, "internal server error")
        }
    }()
    return handler(ctx, req)
}
```

**Stream Server Interceptor:**
```go
func streamLoggingInterceptor(
    srv interface{},
    ss grpc.ServerStream,
    info *grpc.StreamServerInfo,
    handler grpc.StreamHandler,
) error {
    start := time.Now()
    log.Printf("Stream RPC: %s started | client_stream=%v server_stream=%v",
        info.FullMethod, info.IsClientStream, info.IsServerStream)

    err := handler(srv, ss)

    log.Printf("Stream RPC: %s completed | duration=%s | error=%v",
        info.FullMethod, time.Since(start), err)
    return err
}
```

**Chaining Interceptors (Go):**
```go
server := grpc.NewServer(
    grpc.ChainUnaryInterceptor(
        recoveryInterceptor,     // 1st: catch panics (outermost)
        loggingInterceptor,      // 2nd: log request/response
        authInterceptor,         // 3rd: validate authentication
        metricsInterceptor,      // 4th: record metrics
    ),
    grpc.ChainStreamInterceptor(
        streamRecoveryInterceptor,
        streamLoggingInterceptor,
        streamAuthInterceptor,
    ),
)
```

### 4.3 TypeScript Interceptors (@grpc/grpc-js)

```typescript
// Client interceptor
const loggingInterceptor: Interceptor = (options, nextCall) => {
  const method = options.method_definition.path;
  const start = Date.now();

  return new InterceptingCall(nextCall(options), {
    start(metadata, listener, next) {
      console.log(`RPC ${method} started`);
      next(metadata, {
        onReceiveStatus(status, next) {
          const duration = Date.now() - start;
          console.log(`RPC ${method} completed | code=${status.code} | ${duration}ms`);
          next(status);
        },
      });
    },
  });
};

const client = new UserServiceClient("localhost:50051", credentials, {
  interceptors: [loggingInterceptor],
});
```

### 4.4 Python Interceptors

```python
class LoggingInterceptor(grpc.ServerInterceptor):
    def intercept_service(self, continuation, handler_call_details):
        method = handler_call_details.method
        start = time.time()
        print(f"RPC {method} started")

        response = continuation(handler_call_details)

        duration = time.time() - start
        print(f"RPC {method} completed | {duration:.3f}s")
        return response

server = grpc.server(
    futures.ThreadPoolExecutor(max_workers=10),
    interceptors=[LoggingInterceptor()],
)
```

### 4.5 Interceptor Rules

- **ALWAYS** add a recovery/panic interceptor as the outermost server interceptor
- **ALWAYS** add logging and metrics interceptors to every gRPC server
- **MUST** chain interceptors in correct order: recovery → logging → auth → business logic
- **NEVER** perform blocking I/O in interceptors without timeout
- **DO NOT** modify the request object in interceptors — create new context values instead
- **ALWAYS** propagate the context through the interceptor chain

---

## 5. Metadata & Context Propagation

Metadata is gRPC's equivalent of HTTP headers. USE metadata for cross-cutting concerns — authentication, tracing, request context.

### 5.1 Metadata Types

| Type | Key Format | Value | Use Case |
|------|-----------|-------|----------|
| **ASCII** | lowercase, no `grpc-` prefix | printable ASCII string | Auth tokens, request IDs, routing |
| **Binary** | suffix `-bin` | arbitrary bytes (base64 on wire) | Serialized protos, binary trace context |

### 5.2 Go Metadata Operations

```go
// CLIENT — sending metadata
md := metadata.Pairs(
    "authorization", "Bearer "+token,
    "x-request-id", uuid.New().String(),
    "x-trace-bin", string(traceBytes), // binary with -bin suffix
)
ctx := metadata.NewOutgoingContext(ctx, md)
resp, err := client.GetUser(ctx, req)

// CLIENT — reading response metadata
var header, trailer metadata.MD
resp, err := client.GetUser(ctx, req,
    grpc.Header(&header),
    grpc.Trailer(&trailer),
)
rateLimit := header.Get("x-ratelimit-remaining")

// SERVER — reading request metadata
func (s *server) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    md, ok := metadata.FromIncomingContext(ctx)
    if !ok {
        return nil, status.Error(codes.Internal, "no metadata")
    }

    authHeader := md.Get("authorization")
    if len(authHeader) == 0 {
        return nil, status.Error(codes.Unauthenticated, "missing authorization")
    }

    requestID := md.Get("x-request-id")

    // SERVER — sending response metadata
    grpc.SetHeader(ctx, metadata.Pairs("x-request-id", requestID[0]))
    grpc.SetTrailer(ctx, metadata.Pairs("x-processing-time", "42ms"))

    return s.store.FindUser(ctx, req.GetUserId())
}
```

### 5.3 TypeScript Metadata

```typescript
// CLIENT — sending metadata
const metadata = new Metadata();
metadata.set("authorization", `Bearer ${token}`);
metadata.set("x-request-id", uuidv4());

const user = await client.getUser({ userId: "abc" }, { metadata });

// SERVER (nice-grpc) — reading metadata
const server = createServer();
server.add(UserServiceDefinition, {
  async getUser(request, context) {
    const auth = context.metadata.get("authorization");
    const requestId = context.metadata.get("x-request-id");

    // Send response metadata
    context.header.set("x-request-id", requestId);
    context.trailer.set("x-processing-time", "42ms");

    return { id: request.userId, name: "Alice" };
  },
});
```

### 5.4 Python Metadata

```python
# CLIENT — sending metadata
metadata = [
    ("authorization", f"Bearer {token}"),
    ("x-request-id", str(uuid.uuid4())),
]
response = stub.GetUser(request, metadata=metadata)

# SERVER — reading metadata
class UserService(UserServiceServicer):
    def GetUser(self, request, context):
        metadata = dict(context.invocation_metadata())
        auth = metadata.get("authorization", "")
        request_id = metadata.get("x-request-id", "")

        # Send response metadata
        context.set_trailing_metadata([
            ("x-request-id", request_id),
        ])
        return User(id=request.user_id, name="Alice")
```

### 5.5 Metadata Rules

- **ALWAYS** use lowercase keys — gRPC normalizes to lowercase
- **ALWAYS** suffix binary metadata keys with `-bin`
- **NEVER** use the `grpc-` prefix for custom metadata — it is reserved
- **MUST** propagate request IDs and trace context across service boundaries
- **KEEP** metadata values small — they are sent with every RPC
- **DO NOT** put large payloads in metadata — use the request message instead

---

## 6. Deadlines & Cancellation

Deadlines are gRPC's timeout mechanism. They propagate across service boundaries automatically. ALWAYS set deadlines.

### 6.1 Deadline Propagation

```
Client (deadline: 5s)
    │
    ├──▶ Service A (remaining: 5s)
    │        │
    │        ├──▶ Service B (remaining: 4.2s)
    │        │        │
    │        │        ├──▶ Service C (remaining: 3.5s)
    │        │        │        │
    │        │        │     DEADLINE EXCEEDED
    │        │        │        │
    │        │        │◀── CANCELLED ──┘
    │        │        │
    │        │◀── CANCELLED ──┘
    │        │
    │◀── DEADLINE_EXCEEDED ──┘
```

### 6.2 Setting Deadlines

**Go:**
```go
// CORRECT — always set a deadline
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
resp, err := client.GetUser(ctx, req)

// CORRECT — propagate remaining deadline
func (s *server) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    // ctx already has the client's deadline — pass it to downstream calls
    profile, err := s.profileClient.GetProfile(ctx, &pb.GetProfileRequest{UserId: req.UserId})
    if err != nil {
        return nil, err
    }
    return &pb.User{Name: profile.Name}, nil
}

// CORRECT — set a tighter deadline for downstream call
func (s *server) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    downstreamCtx, cancel := context.WithTimeout(ctx, 2*time.Second) // tighter budget
    defer cancel()
    profile, err := s.profileClient.GetProfile(downstreamCtx, &pb.GetProfileRequest{})
    // ...
}

// WRONG — no deadline
resp, err := client.GetUser(context.Background(), req) // ✗ no deadline — can hang forever
```

**TypeScript:**
```typescript
// nice-grpc
const user = await client.getUser(
  { userId: "abc" },
  { deadline: new Date(Date.now() + 5000) } // 5s deadline
);

// @grpc/grpc-js
const deadline = new Date(Date.now() + 5000);
client.getUser({ userId: "abc" }, { deadline }, (err, resp) => { ... });
```

**Python:**
```python
# Set timeout (deadline is computed automatically)
user = stub.GetUser(GetUserRequest(user_id="abc"), timeout=5.0)
```

### 6.3 Handling Cancellation

**Go — Check context in long operations:**
```go
func (s *server) ProcessBatch(ctx context.Context, req *pb.BatchRequest) (*pb.BatchResponse, error) {
    results := make([]*pb.Result, 0, len(req.Items))

    for _, item := range req.Items {
        // CHECK context before each expensive operation
        select {
        case <-ctx.Done():
            return nil, status.Error(codes.Canceled, "request canceled")
        default:
        }

        result, err := s.processItem(ctx, item)
        if err != nil {
            return nil, err
        }
        results = append(results, result)
    }
    return &pb.BatchResponse{Results: results}, nil
}
```

### 6.4 Deadline Rules

- **ALWAYS** set deadlines on every RPC call — no exceptions
- **NEVER** use `context.Background()` for RPC calls in production
- **MUST** propagate the incoming context to downstream RPCs
- **ALWAYS** check `ctx.Done()` in long-running server handlers
- **SET** shorter deadlines for downstream calls than the incoming deadline
- **DO NOT** set deadlines longer than 30 seconds for unary RPCs without justification
- Default deadline recommendations:
  - Unary RPCs: 1-5 seconds
  - Server streaming: 30-60 seconds (or no deadline for infinite streams)
  - Client streaming: 30-60 seconds depending on payload size

---

## 7. Status Codes & Error Model

gRPC has 17 status codes. USE the correct code for every error scenario. NEVER return `codes.Internal` for client errors.

### 7.1 Status Code Reference

| Code | Number | When to Use | HTTP Equivalent |
|------|--------|-------------|-----------------|
| `OK` | 0 | Success | 200 |
| `CANCELLED` | 1 | Client cancelled the request | 499 |
| `UNKNOWN` | 2 | Unknown error (avoid — be specific) | 500 |
| `INVALID_ARGUMENT` | 3 | Client sent invalid field values | 400 |
| `DEADLINE_EXCEEDED` | 4 | Deadline expired before completion | 504 |
| `NOT_FOUND` | 5 | Requested resource does not exist | 404 |
| `ALREADY_EXISTS` | 6 | Resource already exists (create conflict) | 409 |
| `PERMISSION_DENIED` | 7 | Caller lacks permission (authenticated but unauthorized) | 403 |
| `RESOURCE_EXHAUSTED` | 8 | Rate limit or quota exceeded | 429 |
| `FAILED_PRECONDITION` | 9 | System not in required state for operation | 400 |
| `ABORTED` | 10 | Concurrency conflict (retry at higher level) | 409 |
| `OUT_OF_RANGE` | 11 | Operation attempted past valid range | 400 |
| `UNIMPLEMENTED` | 12 | Method not implemented | 501 |
| `INTERNAL` | 13 | Invariant violated — internal server error | 500 |
| `UNAVAILABLE` | 14 | Service temporarily unavailable (retry) | 503 |
| `DATA_LOSS` | 15 | Unrecoverable data loss or corruption | 500 |
| `UNAUTHENTICATED` | 16 | No valid authentication credentials | 401 |

### 7.2 Status Code Decision Tree

```
Request received
    │
    ├─ Invalid fields? ──────────────▶ INVALID_ARGUMENT
    │
    ├─ No auth credentials? ─────────▶ UNAUTHENTICATED
    │
    ├─ Auth valid but no permission? ▶ PERMISSION_DENIED
    │
    ├─ Resource not found? ──────────▶ NOT_FOUND
    │
    ├─ Resource already exists? ─────▶ ALREADY_EXISTS
    │
    ├─ Rate limit exceeded? ─────────▶ RESOURCE_EXHAUSTED
    │
    ├─ Wrong system state? ──────────▶ FAILED_PRECONDITION
    │
    ├─ Concurrency conflict? ────────▶ ABORTED
    │
    ├─ Deadline exceeded? ───────────▶ DEADLINE_EXCEEDED
    │
    ├─ Downstream unavailable? ──────▶ UNAVAILABLE
    │
    └─ Internal bug? ────────────────▶ INTERNAL
```

### 7.3 Rich Error Model (google.rpc.Status)

USE the rich error model for machine-readable error details. ALWAYS include structured error information for client errors.

**Proto Definition:**
```protobuf
// google/rpc/status.proto (standard)
message Status {
  int32 code = 1;                    // gRPC status code
  string message = 2;               // developer-facing message
  repeated google.protobuf.Any details = 3; // structured details
}
```

**Standard Error Detail Types:**

| Type | Use Case |
|------|----------|
| `BadRequest` | Field-level validation errors |
| `RetryInfo` | Retry delay recommendation |
| `DebugInfo` | Stack traces (dev only) |
| `QuotaFailure` | Which quota was exceeded |
| `PreconditionFailure` | Which precondition failed |
| `ErrorInfo` | Domain, reason, metadata map |
| `RequestInfo` | Request ID for support tickets |
| `ResourceInfo` | Which resource was affected |
| `Help` | Links to documentation |

**Go — Returning Rich Errors:**
```go
import (
    "google.golang.org/genproto/googleapis/rpc/errdetails"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"
)

func (s *server) CreateUser(ctx context.Context, req *pb.CreateUserRequest) (*pb.User, error) {
    // Validate fields
    var violations []*errdetails.BadRequest_FieldViolation

    if req.GetEmail() == "" {
        violations = append(violations, &errdetails.BadRequest_FieldViolation{
            Field:       "email",
            Description: "email is required",
        })
    }
    if !isValidEmail(req.GetEmail()) {
        violations = append(violations, &errdetails.BadRequest_FieldViolation{
            Field:       "email",
            Description: "email format is invalid",
        })
    }

    if len(violations) > 0 {
        st := status.New(codes.InvalidArgument, "validation failed")
        detailed, err := st.WithDetails(&errdetails.BadRequest{
            FieldViolations: violations,
        })
        if err != nil {
            return nil, st.Err()
        }
        return nil, detailed.Err()
    }

    // Return retry info for rate limiting
    if s.rateLimiter.IsExceeded(ctx) {
        st := status.New(codes.ResourceExhausted, "rate limit exceeded")
        detailed, _ := st.WithDetails(&errdetails.RetryInfo{
            RetryDelay: durationpb.New(30 * time.Second),
        })
        return nil, detailed.Err()
    }

    return s.store.CreateUser(ctx, req)
}
```

**Go — Reading Rich Errors (Client):**
```go
user, err := client.CreateUser(ctx, req)
if err != nil {
    st := status.Convert(err)
    for _, detail := range st.Details() {
        switch d := detail.(type) {
        case *errdetails.BadRequest:
            for _, v := range d.GetFieldViolations() {
                fmt.Printf("Field %s: %s\n", v.GetField(), v.GetDescription())
            }
        case *errdetails.RetryInfo:
            fmt.Printf("Retry after: %s\n", d.GetRetryDelay().AsDuration())
        }
    }
}
```

**Python — Rich Errors:**
```python
from google.rpc import error_details_pb2, status_pb2
from grpc_status import rpc_status

def CreateUser(self, request, context):
    if not request.email:
        detail = error_details_pb2.BadRequest(
            field_violations=[
                error_details_pb2.BadRequest.FieldViolation(
                    field="email",
                    description="email is required",
                ),
            ]
        )
        status_proto = status_pb2.Status(
            code=code_pb2.INVALID_ARGUMENT,
            message="validation failed",
            details=[any_pb2.Any().Pack(detail)],
        )
        context.abort_with_status(rpc_status.to_status(status_proto))
```

### 7.4 Error Handling Rules

- **ALWAYS** return the most specific status code — NEVER use `UNKNOWN` or `INTERNAL` for known errors
- **ALWAYS** include a human-readable message in the status
- **MUST** use `BadRequest` details for validation errors with per-field violations
- **MUST** use `RetryInfo` when returning `RESOURCE_EXHAUSTED` or `UNAVAILABLE`
- **NEVER** expose stack traces or internal details in production error messages
- **ALWAYS** include `RequestInfo` with a request ID for supportability
- **DO NOT** return `INTERNAL` for downstream service failures — return `UNAVAILABLE`
- **MUST** translate downstream gRPC errors — do not blindly propagate status codes

---

## 8. Health Checking Protocol

ALWAYS implement the gRPC health checking protocol. It enables Kubernetes probes, load balancer health checks, and client-side health monitoring.

### 8.1 Health Check Service Definition

```protobuf
// grpc.health.v1 (standard — do not redefine)
service Health {
  rpc Check(HealthCheckRequest) returns (HealthCheckResponse);   // unary
  rpc Watch(HealthCheckRequest) returns (stream HealthCheckResponse); // streaming
}

message HealthCheckRequest {
  string service = 1;  // empty = overall server health
}

message HealthCheckResponse {
  enum ServingStatus {
    UNKNOWN = 0;
    SERVING = 1;
    NOT_SERVING = 2;
    SERVICE_UNKNOWN = 3;
  }
  ServingStatus status = 1;
}
```

### 8.2 Go Implementation

```go
import (
    "google.golang.org/grpc/health"
    healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

func main() {
    server := grpc.NewServer()

    // Register the health service
    healthServer := health.NewServer()
    healthpb.RegisterHealthServer(server, healthServer)

    // Set initial status
    healthServer.SetServingStatus("myservice", healthpb.HealthCheckResponse_SERVING)

    // Register your service
    pb.RegisterUserServiceServer(server, &userServer{})

    // Update health when dependencies fail
    go func() {
        for {
            if err := checkDatabase(); err != nil {
                healthServer.SetServingStatus("myservice", healthpb.HealthCheckResponse_NOT_SERVING)
            } else {
                healthServer.SetServingStatus("myservice", healthpb.HealthCheckResponse_SERVING)
            }
            time.Sleep(10 * time.Second)
        }
    }()

    lis, _ := net.Listen("tcp", ":50051")
    server.Serve(lis)
}
```

### 8.3 Kubernetes Integration

```yaml
# CORRECT — use grpc health probe
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: myservice
          ports:
            - containerPort: 50051
          livenessProbe:
            grpc:
              port: 50051
              service: "myservice"
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            grpc:
              port: 50051
              service: "myservice"
            initialDelaySeconds: 5
            periodSeconds: 5
          startupProbe:
            grpc:
              port: 50051
            failureThreshold: 30
            periodSeconds: 2
```

### 8.4 Health Check Rules

- **ALWAYS** register the `grpc.health.v1.Health` service on every gRPC server
- **MUST** update health status when critical dependencies (DB, cache, downstream services) fail
- **ALWAYS** configure Kubernetes `readinessProbe` with gRPC health checks
- **MUST** set health to `NOT_SERVING` during graceful shutdown before draining connections
- **NEVER** return `SERVING` if the service cannot fulfill its core responsibility
- **USE** the `Watch` RPC for client-side health monitoring — it is more efficient than polling

---

## 9. Load Balancing

gRPC over HTTP/2 creates a challenge: all RPCs multiplex over a single TCP connection. This breaks traditional L4 load balancers.

### 9.1 The HTTP/2 Load Balancing Problem

```
BROKEN — L4 Load Balancer:
┌────────┐     ┌─────────┐     ┌────────────┐
│ Client │────▶│  L4 LB  │────▶│ Server A ◄─── ALL traffic
│        │     │(TCP/IP) │     ├────────────┤
│        │     │         │     │ Server B      (idle)
│        │     └─────────┘     ├────────────┤
│        │                     │ Server C      (idle)
└────────┘                     └────────────┘
  HTTP/2 creates ONE TCP connection → L4 sends ALL to same backend

CORRECT — L7 Load Balancer:
┌────────┐     ┌─────────┐     ┌────────────┐
│ Client │────▶│  L7 LB  │──┬─▶│ Server A ◄── 33%
│        │     │(Envoy)  │  ├─▶│ Server B ◄── 33%
│        │     │         │  └─▶│ Server C ◄── 33%
└────────┘     └─────────┘     └────────────┘
  L7 terminates HTTP/2, routes individual RPCs
```

### 9.2 Load Balancing Strategies

| Strategy | How It Works | Best For | Drawback |
|----------|-------------|----------|----------|
| **Client-side (pick_first)** | Pick first resolved address | Simple single-server | No balancing |
| **Client-side (round_robin)** | Rotate across resolved addresses | Small clusters, K8s headless svc | No load awareness |
| **L7 Proxy (Envoy)** | Proxy terminates + routes each RPC | Large clusters, heterogeneous clients | Extra hop latency |
| **L7 Proxy (Linkerd)** | Sidecar proxy per pod | Service mesh environments | Sidecar overhead |
| **Lookaside (xDS)** | External control plane provides routing | Google-scale, complex routing | High complexity |

### 9.3 Client-Side Load Balancing (Go)

```go
// Round-robin via DNS
conn, err := grpc.Dial(
    "dns:///myservice.default.svc.cluster.local:50051",
    grpc.WithDefaultServiceConfig(`{"loadBalancingConfig": [{"round_robin": {}}]}`),
    grpc.WithTransportCredentials(insecure.NewCredentials()),
)
```

**Kubernetes Headless Service (required for client-side LB):**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: myservice
spec:
  clusterIP: None    # ← headless — returns pod IPs directly
  selector:
    app: myservice
  ports:
    - port: 50051
      targetPort: 50051
```

### 9.4 Envoy Proxy Configuration

```yaml
static_resources:
  listeners:
    - name: grpc_listener
      address:
        socket_address: { address: 0.0.0.0, port_value: 8080 }
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                codec_type: AUTO
                stat_prefix: grpc
                route_config:
                  name: local_route
                  virtual_hosts:
                    - name: grpc_service
                      domains: ["*"]
                      routes:
                        - match: { prefix: "/" }
                          route:
                            cluster: grpc_backend
                            timeout: 5s
                http_filters:
                  - name: envoy.filters.http.router
  clusters:
    - name: grpc_backend
      type: STRICT_DNS
      lb_policy: ROUND_ROBIN
      typed_extension_protocol_options:
        envoy.extensions.upstreams.http.v3.HttpProtocolOptions:
          "@type": type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions
          explicit_http_config:
            http2_protocol_options: {}
      load_assignment:
        cluster_name: grpc_backend
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address: { address: myservice, port_value: 50051 }
```

### 9.5 Load Balancing Rules

- **NEVER** use L4 (TCP) load balancers with gRPC — they cannot distribute RPCs
- **ALWAYS** use L7 load balancing (Envoy, Linkerd, Traefik, or client-side)
- **USE** headless Kubernetes Services for client-side load balancing
- **USE** Envoy or service mesh for proxy-based load balancing
- **MUST** configure `http2_protocol_options` in Envoy for gRPC backends
- **ALWAYS** enable health checking on the load balancer

---

## 10. Security

ALWAYS use TLS in production. NEVER transmit credentials over plaintext gRPC.

### 10.1 TLS Configuration

**Go Server:**
```go
creds, err := credentials.NewServerTLSFromFile("server.crt", "server.key")
if err != nil {
    log.Fatalf("failed to load TLS: %v", err)
}
server := grpc.NewServer(grpc.Creds(creds))
```

**Go Client:**
```go
creds, err := credentials.NewClientTLSFromFile("ca.crt", "myservice.example.com")
if err != nil {
    log.Fatalf("failed to load TLS: %v", err)
}
conn, err := grpc.Dial("myservice:443", grpc.WithTransportCredentials(creds))
```

### 10.2 Mutual TLS (mTLS)

USE mTLS for service-to-service authentication in zero-trust environments.

```go
// Server — require client certificate
cert, _ := tls.LoadX509KeyPair("server.crt", "server.key")
caCert, _ := os.ReadFile("ca.crt")
caPool := x509.NewCertPool()
caPool.AppendCertsFromPEM(caCert)

tlsConfig := &tls.Config{
    Certificates: []tls.Certificate{cert},
    ClientAuth:   tls.RequireAndVerifyClientCert,
    ClientCAs:    caPool,
}
creds := credentials.NewTLS(tlsConfig)
server := grpc.NewServer(grpc.Creds(creds))

// Client — present client certificate
clientCert, _ := tls.LoadX509KeyPair("client.crt", "client.key")
caCert, _ := os.ReadFile("ca.crt")
caPool := x509.NewCertPool()
caPool.AppendCertsFromPEM(caCert)

tlsConfig := &tls.Config{
    Certificates: []tls.Certificate{clientCert},
    RootCAs:      caPool,
}
creds := credentials.NewTLS(tlsConfig)
conn, _ := grpc.Dial("myservice:443", grpc.WithTransportCredentials(creds))
```

### 10.3 JWT / Token-Based Authentication

**Go — Per-RPC Credentials:**
```go
// Client — attach token to every RPC automatically
type tokenAuth struct {
    token string
}

func (t *tokenAuth) GetRequestMetadata(ctx context.Context, uri ...string) (map[string]string, error) {
    return map[string]string{
        "authorization": "Bearer " + t.token,
    }, nil
}

func (t *tokenAuth) RequireTransportSecurity() bool { return true }

conn, _ := grpc.Dial("myservice:443",
    grpc.WithTransportCredentials(creds),
    grpc.WithPerRPCCredentials(&tokenAuth{token: jwtToken}),
)

// Server — auth interceptor
func authInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
    md, ok := metadata.FromIncomingContext(ctx)
    if !ok {
        return nil, status.Error(codes.Unauthenticated, "no metadata")
    }

    authHeader := md.Get("authorization")
    if len(authHeader) == 0 {
        return nil, status.Error(codes.Unauthenticated, "missing authorization header")
    }

    token := strings.TrimPrefix(authHeader[0], "Bearer ")
    claims, err := validateJWT(token)
    if err != nil {
        return nil, status.Error(codes.Unauthenticated, "invalid token")
    }

    // Inject claims into context
    ctx = context.WithValue(ctx, claimsKey{}, claims)
    return handler(ctx, req)
}
```

### 10.4 Authorization (RBAC)

```go
func rbacInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
    claims := ctx.Value(claimsKey{}).(*Claims)

    // Method-level RBAC
    requiredRole, ok := methodRoles[info.FullMethod]
    if ok && !claims.HasRole(requiredRole) {
        return nil, status.Errorf(codes.PermissionDenied,
            "role %q required for %s", requiredRole, info.FullMethod)
    }

    return handler(ctx, req)
}

var methodRoles = map[string]string{
    "/user.v1.UserService/DeleteUser": "admin",
    "/user.v1.UserService/UpdateUser": "editor",
    "/user.v1.UserService/GetUser":    "viewer",
}
```

### 10.5 Security Rules

- **ALWAYS** use TLS in production — no exceptions
- **USE** mTLS for service-to-service communication in zero-trust environments
- **ALWAYS** validate JWT tokens in a server interceptor — not in individual handlers
- **NEVER** log authentication tokens or credentials
- **MUST** return `UNAUTHENTICATED` (16) for missing/invalid credentials
- **MUST** return `PERMISSION_DENIED` (7) for valid credentials with insufficient permissions
- **NEVER** put secrets in protobuf message fields — use metadata
- **ALWAYS** set `RequireTransportSecurity() = true` on per-RPC credentials

---

## 11. Service Design Patterns

FOLLOW Google's API Design Guide (AIP) conventions for consistent, predictable gRPC APIs.

### 11.1 Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Package | `company.service.version` | `acme.user.v1` |
| Service | PascalCase + `Service` suffix | `UserService` |
| RPC method | PascalCase verb-noun | `GetUser`, `ListUsers`, `CreateUser` |
| Request message | Method name + `Request` | `GetUserRequest` |
| Response message | Method name + `Response` or resource | `User` (for Get), `ListUsersResponse` |

**Standard Method Patterns:**
```protobuf
service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc UpdateUser(UpdateUserRequest) returns (User);
  rpc DeleteUser(DeleteUserRequest) returns (google.protobuf.Empty);
}
```

### 11.2 Pagination (AIP-158)

ALWAYS paginate list operations that can return unbounded results.

```protobuf
message ListUsersRequest {
  int32 page_size = 1;         // max items per page (server may return fewer)
  string page_token = 2;       // opaque token from previous response
  string filter = 3;           // optional: CEL filter expression
  string order_by = 4;         // optional: "name asc, created_at desc"
}

message ListUsersResponse {
  repeated User users = 1;
  string next_page_token = 2;  // empty = no more pages
  int32 total_size = 3;        // optional: total count (expensive, omit if possible)
}
```

**Rules:**
- **ALWAYS** use opaque page tokens — NEVER use offset-based pagination
- **MUST** let the server cap `page_size` (e.g., max 100)
- **MUST** return empty `next_page_token` on the last page
- **NEVER** return total_size unless explicitly needed — it forces a COUNT query

### 11.3 Field Masks

USE field masks for partial updates and response filtering.

```protobuf
import "google/protobuf/field_mask.proto";

message UpdateUserRequest {
  User user = 1;
  google.protobuf.FieldMask update_mask = 2;  // which fields to update
}

// Client: update only name and email
// update_mask: { paths: ["name", "email"] }
```

**Go Implementation:**
```go
func (s *server) UpdateUser(ctx context.Context, req *pb.UpdateUserRequest) (*pb.User, error) {
    existing, err := s.store.FindUser(ctx, req.GetUser().GetId())
    if err != nil {
        return nil, status.Error(codes.NotFound, "user not found")
    }

    // Apply field mask
    mask := req.GetUpdateMask()
    if mask == nil || len(mask.GetPaths()) == 0 {
        return nil, status.Error(codes.InvalidArgument, "update_mask is required")
    }

    for _, path := range mask.GetPaths() {
        switch path {
        case "name":
            existing.Name = req.GetUser().GetName()
        case "email":
            existing.Email = req.GetUser().GetEmail()
        default:
            return nil, status.Errorf(codes.InvalidArgument, "unknown field: %s", path)
        }
    }

    return s.store.UpdateUser(ctx, existing)
}
```

### 11.4 Long-Running Operations (AIP-151)

USE for operations that take longer than a typical RPC deadline (>30s).

```protobuf
import "google/longrunning/operations.proto";

service ExportService {
  rpc ExportData(ExportDataRequest) returns (google.longrunning.Operation);
}

// The Operation wraps your result
// Operation.metadata = ExportProgress (percentage, stage)
// Operation.result = ExportDataResponse (download URL)
```

**Pattern:**
```
Client                         Server
  │                              │
  ├── ExportData(req) ──────────▶│
  │                              ├── Start async job
  │◀── Operation{name, meta} ────┤
  │                              │
  │── GetOperation(name) ───────▶│
  │◀── Operation{meta: 50%} ─────┤
  │                              │
  │── GetOperation(name) ───────▶│
  │◀── Operation{done, result} ──┤
  │                              │
```

### 11.5 Versioning

```protobuf
// CORRECT — version in package name
package acme.user.v1;

service UserService { ... }

// v2 is a separate package
package acme.user.v2;

service UserService { ... }
```

**Rules:**
- **ALWAYS** version in the protobuf package name: `company.service.v1`
- **NEVER** break backwards compatibility within a version
- **MUST** maintain both versions simultaneously during migration
- **USE** v2 only when breaking changes are unavoidable

### 11.6 Service Design Rules

- **ALWAYS** follow verb-noun naming for RPCs: `GetUser`, `ListOrders`, `CreatePayment`
- **NEVER** use generic names: `Process`, `Handle`, `Execute`
- **ALWAYS** paginate list operations — no unbounded responses
- **MUST** require `update_mask` on update operations
- **USE** `google.longrunning.Operation` for anything that takes >30 seconds
- **ALWAYS** return the created/updated resource from Create/Update RPCs

---

## 12. Observability

ALWAYS instrument gRPC services with distributed tracing, metrics, and structured logging.

### 12.1 OpenTelemetry Integration

**Go — Server & Client Instrumentation:**
```go
import (
    "go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
)

// Server
server := grpc.NewServer(
    grpc.StatsHandler(otelgrpc.NewServerHandler()),
)

// Client
conn, err := grpc.Dial(target,
    grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
)
```

### 12.2 Key Metrics to Collect

| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `grpc_server_handled_total` | Counter | method, code | Request rate and error rate |
| `grpc_server_handling_seconds` | Histogram | method | Latency distribution |
| `grpc_server_msg_received_total` | Counter | method | Messages received (streaming) |
| `grpc_server_msg_sent_total` | Counter | method | Messages sent (streaming) |
| `grpc_client_handled_total` | Counter | method, code | Client-side error tracking |
| `grpc_client_handling_seconds` | Histogram | method | Client-observed latency |

### 12.3 Structured Logging Interceptor

```go
func loggingInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
    start := time.Now()

    // Extract trace context
    span := trace.SpanFromContext(ctx)
    traceID := span.SpanContext().TraceID().String()

    // Extract metadata
    md, _ := metadata.FromIncomingContext(ctx)
    requestID := ""
    if vals := md.Get("x-request-id"); len(vals) > 0 {
        requestID = vals[0]
    }

    resp, err := handler(ctx, req)

    duration := time.Since(start)
    code := status.Code(err)

    // Structured log
    slog.Info("gRPC request",
        "method", info.FullMethod,
        "code", code.String(),
        "duration_ms", duration.Milliseconds(),
        "trace_id", traceID,
        "request_id", requestID,
    )

    return resp, err
}
```

### 12.4 Observability Rules

- **ALWAYS** use OpenTelemetry `StatsHandler` — it captures traces and metrics automatically
- **MUST** propagate trace context through metadata across service boundaries
- **ALWAYS** log: method, status code, duration, trace ID, request ID
- **NEVER** log request/response bodies in production — they may contain PII
- **MUST** set up alerts on `grpc_server_handled_total{code!="OK"}` error rate
- **ALWAYS** create dashboards for p50/p95/p99 latency per method

---

## 13. Performance Optimization

### 13.1 Keepalive Configuration

Keepalive prevents idle connections from being silently dropped by middleboxes (load balancers, firewalls, NAT).

**Client Keepalive Parameters:**

| Parameter | Default | Recommended | Description |
|-----------|---------|-------------|-------------|
| `Time` | ∞ (disabled) | 10-30s | Send ping after this idle time |
| `Timeout` | 20s | 5s | Wait this long for ping response |
| `PermitWithoutStream` | false | true | Send pings even without active RPCs |

**Server Keepalive Parameters:**

| Parameter | Default | Recommended | Description |
|-----------|---------|-------------|-------------|
| `MaxConnectionIdle` | ∞ | 5m | Close idle connections after this time |
| `MaxConnectionAge` | ∞ | 30m-2h | Max connection lifetime (for rolling restarts) |
| `MaxConnectionAgeGrace` | ∞ | 10s | Grace period after MaxConnectionAge |
| `Time` | 2h | 1m | Server-to-client ping interval |
| `Timeout` | 20s | 5s | Ping response timeout |

**Go Configuration:**
```go
// Server
server := grpc.NewServer(
    grpc.KeepaliveParams(keepalive.ServerParameters{
        MaxConnectionIdle:  5 * time.Minute,
        MaxConnectionAge:   2 * time.Hour,
        MaxConnectionAgeGrace: 10 * time.Second,
        Time:    1 * time.Minute,
        Timeout: 5 * time.Second,
    }),
    grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
        MinTime:             10 * time.Second, // min time between client pings
        PermitWithoutStream: true,
    }),
)

// Client
conn, _ := grpc.Dial(target,
    grpc.WithKeepaliveParams(keepalive.ClientParameters{
        Time:                10 * time.Second,
        Timeout:             5 * time.Second,
        PermitWithoutStream: true,
    }),
)
```

### 13.2 Compression

USE compression for large messages. ALWAYS measure — compression adds CPU overhead.

```go
// Go — server accepts gzip automatically
// Go — client request with gzip
import "google.golang.org/grpc/encoding/gzip"

resp, err := client.GetUser(ctx, req, grpc.UseCompressor(gzip.Name))
```

```typescript
// TypeScript
const client = createClient(UserServiceDefinition, channel, {
  "*": { requestCompression: compressionGzip },
});
```

```python
# Python
channel = grpc.insecure_channel("localhost:50051",
    options=[("grpc.default_compression_algorithm", grpc.Compression.Gzip)])
```

### 13.3 Message Size Limits

```go
// Server
server := grpc.NewServer(
    grpc.MaxRecvMsgSize(10 * 1024 * 1024), // 10MB (default 4MB)
    grpc.MaxSendMsgSize(10 * 1024 * 1024),
)

// Client
conn, _ := grpc.Dial(target,
    grpc.WithDefaultCallOptions(
        grpc.MaxCallRecvMsgSize(10 * 1024 * 1024),
        grpc.MaxCallSendMsgSize(10 * 1024 * 1024),
    ),
)
```

### 13.4 Connection Pooling

When a single HTTP/2 connection saturates (typically ~100 concurrent streams), USE connection pooling.

```go
// Simple pool — create N connections and round-robin
type Pool struct {
    conns []*grpc.ClientConn
    next  atomic.Uint64
}

func NewPool(target string, size int, opts ...grpc.DialOption) (*Pool, error) {
    pool := &Pool{conns: make([]*grpc.ClientConn, size)}
    for i := 0; i < size; i++ {
        conn, err := grpc.Dial(target, opts...)
        if err != nil {
            return nil, err
        }
        pool.conns[i] = conn
    }
    return pool, nil
}

func (p *Pool) Get() *grpc.ClientConn {
    idx := p.next.Add(1)
    return p.conns[idx%uint64(len(p.conns))]
}
```

### 13.5 Performance Rules

- **ALWAYS** configure keepalive to detect dead connections
- **MUST** set `MaxConnectionAge` on servers for graceful rolling updates
- **MUST** set `EnforcementPolicy.MinTime` to prevent clients from pinging too aggressively
- **USE** compression only for messages > 1KB — compression overhead dominates small messages
- **ALWAYS** set explicit message size limits — the default 4MB may be too small for some use cases
- **NEVER** send messages > 4MB without increasing limits on both client and server
- **USE** streaming instead of large unary messages when possible
- **MONITOR** HTTP/2 stream count per connection — pool connections if consistently > 100

---

## 14. Testing gRPC Services

### 14.1 Unit Testing (Go — bufconn)

USE `bufconn` for in-process testing without network overhead.

```go
import (
    "google.golang.org/grpc/test/bufconn"
)

func setupTest(t *testing.T) (pb.UserServiceClient, func()) {
    lis := bufconn.Listen(1024 * 1024)

    srv := grpc.NewServer()
    pb.RegisterUserServiceServer(srv, &userServer{store: newMockStore()})

    go func() {
        if err := srv.Serve(lis); err != nil {
            t.Errorf("server exited: %v", err)
        }
    }()

    conn, err := grpc.DialContext(context.Background(), "bufnet",
        grpc.WithContextDialer(func(ctx context.Context, s string) (net.Conn, error) {
            return lis.Dial()
        }),
        grpc.WithTransportCredentials(insecure.NewCredentials()),
    )
    if err != nil {
        t.Fatalf("failed to dial: %v", err)
    }

    client := pb.NewUserServiceClient(conn)
    cleanup := func() {
        conn.Close()
        srv.GracefulStop()
    }
    return client, cleanup
}

func TestGetUser(t *testing.T) {
    client, cleanup := setupTest(t)
    defer cleanup()

    // Test success
    user, err := client.GetUser(context.Background(), &pb.GetUserRequest{UserId: "123"})
    require.NoError(t, err)
    assert.Equal(t, "Alice", user.GetName())

    // Test not found
    _, err = client.GetUser(context.Background(), &pb.GetUserRequest{UserId: "nonexistent"})
    require.Error(t, err)
    assert.Equal(t, codes.NotFound, status.Code(err))
}
```

### 14.2 Testing Rules

- **ALWAYS** use `bufconn` (Go) or in-process servers for unit tests — avoid real network
- **MUST** test all error paths — verify correct status codes
- **MUST** test with deadlines to catch slow handlers
- **ALWAYS** test streaming RPCs: empty stream, single message, multiple messages, cancellation
- **USE** integration tests with real gRPC connections for critical paths
- **NEVER** mock the gRPC transport layer — test the actual handler with a real server

---

## 15. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Connection per request | High latency, TCP handshake overhead | Create channel at startup, reuse across RPCs |
| No deadlines | Requests hang forever, resource leaks | ALWAYS set `context.WithTimeout()` |
| Using `codes.Internal` for everything | Clients cannot differentiate errors | Use specific status codes (NotFound, InvalidArgument, etc.) |
| L4 load balancer with gRPC | All traffic goes to one backend | Use L7 load balancer (Envoy) or client-side LB |
| No health checking | Dead instances receive traffic | Implement `grpc.health.v1.Health` service |
| Ignoring backpressure in streams | Memory exhaustion, OOM | Check `ctx.Done()`, respect flow control |
| Plaintext gRPC in production | Credential theft, MITM attacks | ALWAYS use TLS |
| Giant unary messages (>4MB) | `ResourceExhausted` errors | Use streaming or increase limits on both sides |
| Logging full request/response bodies | PII exposure, log volume explosion | Log method, status, duration only |
| No interceptors | Cross-cutting concerns in every handler | Add logging, metrics, auth, recovery interceptors |
| Exposing internal errors to clients | Security vulnerability, confusing clients | Translate errors, never expose stack traces |
| No retry logic on clients | Transient failures cause user errors | Add retry interceptor with backoff for `UNAVAILABLE` |
| Blocking in streaming `Send()` without context check | Goroutine leaks on client disconnect | Always `select` on `ctx.Done()` and `Send()` |

---

## 16. Enforcement Checklist

- [ ] Every gRPC server registers `grpc.health.v1.Health` service
- [ ] TLS is configured for all production gRPC connections
- [ ] Every RPC call has a deadline set via `context.WithTimeout()`
- [ ] Interceptor chain includes: recovery, logging, metrics, auth
- [ ] Status codes match the error scenario (not `Internal` for everything)
- [ ] Rich error model used for validation errors (`BadRequest` details)
- [ ] `RetryInfo` included with `ResourceExhausted` and `Unavailable` errors
- [ ] Metadata propagates request ID and trace context across services
- [ ] Load balancing uses L7 (Envoy/Linkerd) or client-side round_robin
- [ ] Keepalive configured on both client and server
- [ ] `MaxConnectionAge` set on servers for graceful rolling updates
- [ ] Health status updates when critical dependencies fail
- [ ] Kubernetes readinessProbe uses gRPC health check
- [ ] Streaming RPCs check `ctx.Done()` in every loop iteration
- [ ] Message size limits configured explicitly on client and server
- [ ] Pagination implemented for all list operations
- [ ] `update_mask` required on all update operations
- [ ] OpenTelemetry `StatsHandler` registered for tracing and metrics
- [ ] Structured logging includes: method, code, duration, trace_id, request_id
- [ ] Channels are created once at startup and reused — never per-request
- [ ] Server interceptors chain in order: recovery → logging → auth → business
- [ ] Compression enabled for messages > 1KB where bandwidth matters
