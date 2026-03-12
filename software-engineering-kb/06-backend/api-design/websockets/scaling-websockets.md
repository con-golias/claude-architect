# Scaling WebSockets

> **AI Plugin Directive:** When designing WebSocket infrastructure for production, scaling beyond a single server, or deploying WebSocket services to Kubernetes, APPLY every rule in this document. USE the horizontal scaling patterns, Redis pub/sub backplane, sticky session configuration, and capacity planning guidelines defined here. NEVER deploy WebSocket services without a message broadcast layer, connection draining strategy, or monitoring.

**Core Rule: ALWAYS use a message backplane (Redis Pub/Sub, NATS, or equivalent) for horizontal scaling. ALWAYS configure sticky sessions at the load balancer. ALWAYS plan for OS-level connection limits and per-process memory budgets. NEVER assume a single server can handle all connections. NEVER deploy without graceful shutdown and connection draining.**

---

## 1. The Single-Server Problem

A single WebSocket server holds all connections in memory. Scaling requires distributing connections across multiple servers while maintaining the ability to broadcast messages to any connected client.

### 1.1 Why WebSockets Are Hard to Scale

```
SINGLE SERVER (works fine):
┌─────────┐     ┌──────────────────────┐
│Client A │────▶│                      │
│Client B │────▶│   Server (1 process) │  All connections in memory
│Client C │────▶│   All state local    │  Broadcast = iterate local set
│Client D │────▶│                      │
└─────────┘     └──────────────────────┘

MULTIPLE SERVERS (broken without backplane):
┌─────────┐     ┌────────────────┐
│Client A │────▶│  Server 1      │  Client A is here
│Client B │────▶│  (knows A, B)  │  Client C is NOT here
└─────────┘     └────────────────┘
                                      If A sends message to C:
┌─────────┐     ┌────────────────┐    Server 1 doesn't have C's
│Client C │────▶│  Server 2      │    connection → message lost!
│Client D │────▶│  (knows C, D)  │
└─────────┘     └────────────────┘
```

### 1.2 Scaling Challenges

| Challenge | Why It's Hard | Solution |
|-----------|-------------|----------|
| **Message broadcast** | Server A can't send to Client on Server B | Message backplane (Redis, NATS) |
| **Session affinity** | Client must reconnect to same server for state | Sticky sessions at load balancer |
| **Shared state** | Room membership, presence across servers | External state store (Redis) |
| **Connection limits** | OS file descriptor limits, memory per connection | Horizontal scaling + OS tuning |
| **Graceful deploys** | Can't kill connections during deploy | Connection draining with SIGTERM handler |
| **Monitoring** | Connection count spread across servers | Centralized metrics (Prometheus) |

---

## 2. Horizontal Scaling Architecture

### 2.1 The Backplane Pattern

```
┌─────────┐     ┌────────────────┐
│Client A │────▶│                │──publish──┐
│Client B │────▶│   Server 1     │           │
│         │◀────│                │◀─subscribe─┤
└─────────┘     └────────────────┘           │
                                              │
              ┌──────────────────────────┐   │
              │     MESSAGE BACKPLANE     │───┘
              │  (Redis Pub/Sub / NATS)  │───┐
              └──────────────────────────┘   │
                                              │
┌─────────┐     ┌────────────────┐           │
│Client C │────▶│                │──publish──┘
│Client D │────▶│   Server 2     │
│         │◀────│                │◀─subscribe─
└─────────┘     └────────────────┘

Flow: Client A sends message to channel "orders"
  1. Server 1 receives message from Client A
  2. Server 1 publishes to Redis channel "orders"
  3. Redis delivers to ALL subscribers (Server 1 + Server 2)
  4. Server 1 sends to local Client B (if subscribed)
  5. Server 2 sends to local Clients C, D (if subscribed)
```

### 2.2 Redis Pub/Sub Backplane (Node.js)

```typescript
import { createClient, RedisClientType } from "redis";
import { WebSocketServer, WebSocket } from "ws";

class ScaledPubSubHub {
  private publisher: RedisClientType;
  private subscriber: RedisClientType;
  private localSubs = new Map<string, Set<WebSocket>>();

  async init(redisUrl: string): Promise<void> {
    this.publisher = createClient({ url: redisUrl });
    this.subscriber = this.publisher.duplicate();

    await this.publisher.connect();
    await this.subscriber.connect();

    // Listen for messages from other servers
    this.subscriber.pSubscribe("ws:*", (message, channel) => {
      const wsChannel = channel.replace("ws:", "");
      this.deliverLocal(wsChannel, message);
    });
  }

  subscribe(channel: string, ws: WebSocket): void {
    // Track locally
    if (!this.localSubs.has(channel)) {
      this.localSubs.set(channel, new Set());
    }
    this.localSubs.get(channel)!.add(ws);
  }

  unsubscribe(channel: string, ws: WebSocket): void {
    this.localSubs.get(channel)?.delete(ws);
    if (this.localSubs.get(channel)?.size === 0) {
      this.localSubs.delete(channel);
    }
  }

  unsubscribeAll(ws: WebSocket): void {
    for (const [channel, subs] of this.localSubs) {
      subs.delete(ws);
      if (subs.size === 0) {
        this.localSubs.delete(channel);
      }
    }
  }

  async publish(channel: string, event: string, data: unknown): Promise<void> {
    const message = JSON.stringify({
      type: "event",
      id: generateId(),
      timestamp: Date.now(),
      payload: { channel, event, data },
    });

    // Publish to Redis — ALL servers receive this
    await this.publisher.publish(`ws:${channel}`, message);
  }

  private deliverLocal(channel: string, message: string): void {
    const subscribers = this.localSubs.get(channel);
    if (!subscribers) return;

    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      } else {
        subscribers.delete(ws);
      }
    }
  }

  async shutdown(): Promise<void> {
    await this.subscriber.quit();
    await this.publisher.quit();
  }
}
```

### 2.3 Redis Pub/Sub Backplane (Go)

```go
import "github.com/redis/go-redis/v9"

type ScaledHub struct {
    rdb       *redis.Client
    localSubs map[string]map[*Connection]bool
    mu        sync.RWMutex
}

func NewScaledHub(redisAddr string) *ScaledHub {
    hub := &ScaledHub{
        rdb: redis.NewClient(&redis.Options{
            Addr: redisAddr,
        }),
        localSubs: make(map[string]map[*Connection]bool),
    }
    go hub.subscribeRedis()
    return hub
}

func (h *ScaledHub) subscribeRedis() {
    ctx := context.Background()
    pubsub := h.rdb.PSubscribe(ctx, "ws:*")
    defer pubsub.Close()

    for msg := range pubsub.Channel() {
        channel := strings.TrimPrefix(msg.Channel, "ws:")
        h.deliverLocal(channel, []byte(msg.Payload))
    }
}

func (h *ScaledHub) Publish(ctx context.Context, channel string, msg []byte) error {
    return h.rdb.Publish(ctx, "ws:"+channel, msg).Err()
}

func (h *ScaledHub) Subscribe(channel string, conn *Connection) {
    h.mu.Lock()
    defer h.mu.Unlock()
    if _, ok := h.localSubs[channel]; !ok {
        h.localSubs[channel] = make(map[*Connection]bool)
    }
    h.localSubs[channel][conn] = true
}

func (h *ScaledHub) deliverLocal(channel string, msg []byte) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    for conn := range h.localSubs[channel] {
        select {
        case conn.send <- msg:
        default:
            close(conn.send)
        }
    }
}
```

### 2.4 NATS as Backplane Alternative

```go
import "github.com/nats-io/nats.go"

type NATSHub struct {
    nc        *nats.Conn
    localSubs map[string]map[*Connection]bool
    mu        sync.RWMutex
}

func NewNATSHub(natsURL string) (*NATSHub, error) {
    nc, err := nats.Connect(natsURL)
    if err != nil {
        return nil, err
    }

    hub := &NATSHub{
        nc:        nc,
        localSubs: make(map[string]map[*Connection]bool),
    }

    // Subscribe to all ws.* subjects
    nc.Subscribe("ws.>", func(msg *nats.Msg) {
        channel := strings.TrimPrefix(msg.Subject, "ws.")
        hub.deliverLocal(channel, msg.Data)
    })

    return hub, nil
}

func (h *NATSHub) Publish(channel string, msg []byte) error {
    return h.nc.Publish("ws."+channel, msg)
}
```

### 2.5 Backplane Comparison

| Backplane | Latency | Throughput | Persistence | Complexity |
|-----------|---------|------------|-------------|------------|
| **Redis Pub/Sub** | ~1ms | High | No (fire-and-forget) | Low |
| **Redis Streams** | ~2ms | High | Yes (replay) | Medium |
| **NATS** | <1ms | Very High | Optional (JetStream) | Low |
| **Kafka** | ~5-20ms | Very High | Yes (replay, ordering) | High |
| **RabbitMQ** | ~2-5ms | High | Yes (queue durability) | Medium |

**Decision:**
- **USE** Redis Pub/Sub for most WebSocket scaling — simple, fast, widely available
- **USE** NATS for ultra-low-latency or very high throughput
- **USE** Redis Streams or Kafka when you need message replay (missed messages during reconnect)
- **DO NOT** use Kafka for real-time WebSocket backplane — latency is too high for interactive applications

### 2.6 Backplane Rules

- **ALWAYS** use a message backplane for multi-server WebSocket deployments
- **NEVER** rely on local-only pub/sub when running more than one server
- **ALWAYS** subscribe to the backplane at server startup
- **MUST** handle backplane disconnection gracefully — reconnect and re-subscribe
- **PREFER** Redis Pub/Sub for simplicity unless you need message persistence
- **KNOW** that Redis Pub/Sub is fire-and-forget — messages are lost if no subscriber is listening

---

## 3. Load Balancing

### 3.1 Sticky Sessions Requirement

WebSocket connections are stateful. The load balancer MUST route subsequent requests from the same client to the same server (at least until the connection is established).

```
WITHOUT sticky sessions (broken):
  Client → LB → Server 1 (HTTP upgrade) ✓
  Client → LB → Server 2 (WebSocket frames) ✗ wrong server!

WITH sticky sessions (correct):
  Client → LB → Server 1 (HTTP upgrade) ✓
  Client → LB → Server 1 (WebSocket frames) ✓ same server
```

### 3.2 Nginx Configuration

```nginx
upstream websocket_backend {
    # Sticky sessions via IP hash
    ip_hash;

    server ws-server-1:8080;
    server ws-server-2:8080;
    server ws-server-3:8080;
}

server {
    listen 443 ssl;
    server_name ws.example.com;

    ssl_certificate /etc/ssl/certs/ws.example.com.crt;
    ssl_certificate_key /etc/ssl/private/ws.example.com.key;

    location /ws {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;

        # WebSocket upgrade headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Preserve client IP
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts — MUST be longer than ping interval
        proxy_read_timeout 3600s;   # 1 hour
        proxy_send_timeout 3600s;

        # Buffering — disable for WebSocket
        proxy_buffering off;
    }
}
```

### 3.3 HAProxy Configuration

```haml
frontend ws_frontend
    bind *:443 ssl crt /etc/ssl/certs/ws.example.com.pem
    default_backend ws_backend

backend ws_backend
    balance source                  # sticky sessions by source IP
    # OR use cookie-based sticky sessions:
    # cookie SERVERID insert indirect nocache

    option httpchk GET /health      # health check endpoint
    http-check expect status 200

    timeout tunnel 3600s            # MUST be long for WebSocket
    timeout client 3600s
    timeout server 3600s

    server ws1 ws-server-1:8080 check cookie ws1
    server ws2 ws-server-2:8080 check cookie ws2
    server ws3 ws-server-3:8080 check cookie ws3
```

### 3.4 AWS ALB / Cloud Load Balancers

```yaml
# AWS ALB — supports WebSocket natively
# Enable sticky sessions via target group
Resource:
  TargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Protocol: HTTP
      Port: 8080
      TargetType: ip
      HealthCheckPath: /health
      HealthCheckIntervalSeconds: 30
      TargetGroupAttributes:
        - Key: stickiness.enabled
          Value: "true"
        - Key: stickiness.type
          Value: lb_cookie
        - Key: stickiness.lb_cookie.duration_seconds
          Value: "86400"           # 24 hours
        - Key: deregistration_delay.timeout_seconds
          Value: "300"             # 5 min drain time
```

### 3.5 Load Balancing Rules

- **ALWAYS** enable sticky sessions for WebSocket backends
- **MUST** set proxy timeouts LONGER than the WebSocket ping interval (at least 2x)
- **ALWAYS** pass `Upgrade` and `Connection` headers through the proxy
- **MUST** disable proxy buffering for WebSocket connections
- **ALWAYS** configure health checks on WebSocket servers
- **USE** `ip_hash` (Nginx) or `balance source` (HAProxy) for sticky sessions
- **PREFER** cookie-based stickiness over IP-based — it handles NAT/proxy scenarios better
- **ALWAYS** set deregistration delay for graceful connection draining during deploys

---

## 4. Connection Limits & OS Tuning

### 4.1 File Descriptor Limits

EVERY WebSocket connection uses one file descriptor. The OS default is usually 1024 — far too low for production.

```bash
# Check current limits
ulimit -n          # soft limit (per process)
ulimit -Hn         # hard limit (max the soft limit can be raised to)
cat /proc/sys/fs/file-max   # system-wide maximum

# Set limits for production
# /etc/security/limits.conf
*    soft    nofile    1000000
*    hard    nofile    1000000

# /etc/sysctl.conf
fs.file-max = 2000000
fs.nr_open = 2000000
net.ipv4.ip_local_port_range = 1024 65535
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.core.netdev_max_backlog = 65535

# Apply without reboot
sysctl -p
```

### 4.2 Memory Budget Per Connection

| Component | Memory | Notes |
|-----------|--------|-------|
| TCP socket buffer | ~4-8 KB | read + write kernel buffers |
| WebSocket connection object | ~1-5 KB | language runtime overhead |
| Application state | ~1-10 KB | subscriptions, user info, buffers |
| permessage-deflate | ~300 KB | if compression enabled |
| **Total without compression** | **~10-25 KB** | |
| **Total with compression** | **~310-325 KB** | |

### 4.3 Capacity Planning Table

| Server RAM | Without Compression | With Compression |
|-----------|-------------------|-----------------|
| 1 GB | ~40,000 connections | ~3,000 connections |
| 4 GB | ~160,000 connections | ~12,000 connections |
| 8 GB | ~320,000 connections | ~24,000 connections |
| 16 GB | ~640,000 connections | ~48,000 connections |
| 32 GB | ~1,280,000 connections | ~96,000 connections |

**Note:** These are theoretical maximums. Leave 30-50% headroom for application logic, GC, and bursts.

### 4.4 Connection Pool Configuration

```typescript
// Node.js — configure max connections
const wss = new WebSocketServer({
  port: 8080,
  maxPayload: 1 * 1024 * 1024,       // 1MB max message
  backlog: 512,                        // TCP connection backlog
  perMessageDeflate: false,            // DISABLE for max connections
  clientTracking: true,                // track connected clients
});

// Monitor connection count
setInterval(() => {
  console.log(`Active connections: ${wss.clients.size}`);
  if (wss.clients.size > 50_000) {
    console.warn("Connection count exceeding threshold");
  }
}, 10_000);
```

```go
// Go — configure for high connection count
func main() {
    // Increase Go runtime limits
    debug.SetMaxThreads(100_000)

    // Use epoll-based server for > 100k connections
    // Consider libraries like gobwas/ws or nhooyr.io/websocket
    // for lower per-connection overhead than gorilla/websocket
}
```

### 4.5 Capacity Rules

- **ALWAYS** increase `nofile` limit to at least 1,000,000 for production WebSocket servers
- **MUST** tune kernel TCP parameters for high connection counts
- **ALWAYS** calculate memory budget per connection before capacity planning
- **DISABLE** `perMessageDeflate` if maximizing connection count is the priority
- **LEAVE** 30-50% memory headroom for application logic and GC pressure
- **MONITOR** connection count, memory usage, and file descriptor usage continuously
- **PLAN** for N+1 redundancy — if you need 3 servers, deploy 4

---

## 5. Shared State Management

### 5.1 Room Membership Across Servers

When rooms span multiple servers, membership must be stored externally.

```typescript
// Redis-backed room membership
class DistributedRoomManager {
  private redis: RedisClientType;

  async joinRoom(roomId: string, userId: string, serverId: string): Promise<void> {
    const pipeline = this.redis.multi();

    // Add user to room members set
    pipeline.sAdd(`room:${roomId}:members`, userId);

    // Track which server holds this user's connection
    pipeline.hSet(`room:${roomId}:servers`, userId, serverId);

    // Track user's rooms for cleanup
    pipeline.sAdd(`user:${userId}:rooms`, roomId);

    // Set TTL for auto-cleanup if server dies
    pipeline.expire(`room:${roomId}:members`, 3600);
    pipeline.expire(`room:${roomId}:servers`, 3600);

    await pipeline.exec();
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const pipeline = this.redis.multi();
    pipeline.sRem(`room:${roomId}:members`, userId);
    pipeline.hDel(`room:${roomId}:servers`, userId);
    pipeline.sRem(`user:${userId}:rooms`, roomId);
    await pipeline.exec();
  }

  async leaveAllRooms(userId: string): Promise<string[]> {
    const rooms = await this.redis.sMembers(`user:${userId}:rooms`);
    for (const roomId of rooms) {
      await this.leaveRoom(roomId, userId);
    }
    return rooms;
  }

  async getRoomMembers(roomId: string): Promise<string[]> {
    return this.redis.sMembers(`room:${roomId}:members`);
  }

  async getMemberCount(roomId: string): Promise<number> {
    return this.redis.sCard(`room:${roomId}:members`);
  }
}
```

### 5.2 Distributed Presence

```typescript
// Redis-backed presence with TTL for auto-cleanup
class DistributedPresence {
  private redis: RedisClientType;
  private serverId: string;
  private heartbeatInterval: ReturnType<typeof setInterval>;

  constructor(redis: RedisClientType, serverId: string) {
    this.redis = redis;
    this.serverId = serverId;

    // Refresh presence TTL every 30s
    this.heartbeatInterval = setInterval(() => this.refreshAll(), 30_000);
  }

  async setOnline(userId: string, metadata: Record<string, string>): Promise<void> {
    const key = `presence:${userId}`;
    await this.redis.hSet(key, {
      status: "online",
      serverId: this.serverId,
      lastSeen: Date.now().toString(),
      ...metadata,
    });
    await this.redis.expire(key, 60); // TTL: 60s, refreshed by heartbeat
  }

  async setOffline(userId: string): Promise<void> {
    await this.redis.del(`presence:${userId}`);
  }

  async getPresence(userId: string): Promise<Record<string, string> | null> {
    const data = await this.redis.hGetAll(`presence:${userId}`);
    return Object.keys(data).length > 0 ? data : null;
  }

  async getOnlineUsers(userIds: string[]): Promise<string[]> {
    const pipeline = this.redis.multi();
    for (const id of userIds) {
      pipeline.exists(`presence:${id}`);
    }
    const results = await pipeline.exec();
    return userIds.filter((_, i) => results[i] === 1);
  }

  private async refreshAll(): Promise<void> {
    // Refresh TTL for all users connected to this server
    // Implementation depends on local connection tracking
  }

  shutdown(): void {
    clearInterval(this.heartbeatInterval);
  }
}
```

### 5.3 Shared State Rules

- **ALWAYS** store room membership in Redis when running multiple servers
- **USE** Redis Sets for room membership — O(1) add/remove/check
- **ALWAYS** set TTL on state keys for auto-cleanup if a server crashes
- **MUST** track user→rooms mapping for cleanup on disconnect
- **USE** Redis pipelines for multi-key operations to reduce round trips
- **ALWAYS** refresh TTLs with a heartbeat to prevent premature expiry

---

## 6. Graceful Shutdown & Deployments

### 6.1 Rolling Deployment Strategy

```
Time 0: Deploy starts
  Server 1: RUNNING (500 connections)
  Server 2: RUNNING (500 connections)
  Server 3: RUNNING (500 connections)

Time 1: Signal Server 1 to drain
  Server 1: DRAINING (500 connections, no new ones)
    - Send close frame 1012 (Service Restart) to all clients
    - Clients reconnect → LB routes to Server 2 or 3
  Server 2: RUNNING (receiving reconnections)
  Server 3: RUNNING (receiving reconnections)

Time 2: Server 1 drained, deploy new version
  Server 1: STARTING (new version, 0 connections)
  Server 2: RUNNING (~750 connections)
  Server 3: RUNNING (~750 connections)

Time 3: Server 1 ready, signal Server 2 to drain
  Server 1: RUNNING (receiving reconnections)
  Server 2: DRAINING → clients reconnect to Server 1 or 3
  Server 3: RUNNING

... repeat for Server 3
```

### 6.2 Node.js Graceful Shutdown

```typescript
class GracefulShutdown {
  private wss: WebSocketServer;
  private isShuttingDown = false;

  constructor(wss: WebSocketServer) {
    this.wss = wss;

    process.on("SIGTERM", () => this.shutdown());
    process.on("SIGINT", () => this.shutdown());
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log("Starting graceful shutdown...");

    // 1. Stop accepting new connections
    this.wss.close();

    // 2. Mark as unhealthy (health check endpoint returns 503)
    setHealthy(false);

    // 3. Wait for LB to detect unhealthy (health check interval)
    await sleep(10_000); // 10s — wait for LB to stop routing

    // 4. Send close to all connected clients
    const closePromises: Promise<void>[] = [];
    this.wss.clients.forEach((ws) => {
      closePromises.push(
        new Promise<void>((resolve) => {
          ws.on("close", resolve);
          ws.close(1012, "Server restarting");

          // Force close after timeout
          setTimeout(() => {
            if (ws.readyState !== WebSocket.CLOSED) {
              ws.terminate();
            }
            resolve();
          }, 10_000);
        })
      );
    });

    // 5. Wait for all connections to close
    await Promise.all(closePromises);

    // 6. Clean up resources
    await cleanupRedis();
    await cleanupDatabase();

    console.log("Graceful shutdown complete");
    process.exit(0);
  }
}
```

### 6.3 Go Graceful Shutdown

```go
func main() {
    server := &http.Server{Addr: ":8080"}
    hub := NewScaledHub(redisAddr)

    http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
        handleWebSocket(w, r, hub)
    })

    // Start server in goroutine
    go func() {
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            log.Fatalf("server error: %v", err)
        }
    }()

    // Wait for shutdown signal
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
    <-quit

    log.Println("Starting graceful shutdown...")

    // 1. Mark unhealthy
    setHealthy(false)

    // 2. Wait for LB to detect
    time.Sleep(10 * time.Second)

    // 3. Close all WebSocket connections with 1012
    hub.CloseAll(websocket.CloseServiceRestart, "server restarting")

    // 4. Wait for connections to drain
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    if err := server.Shutdown(ctx); err != nil {
        log.Printf("forced shutdown: %v", err)
    }

    // 5. Cleanup
    hub.Shutdown()
    log.Println("Shutdown complete")
}
```

### 6.4 Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: websocket-server
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1           # add 1 new pod before removing old
      maxUnavailable: 0     # never have fewer than desired replicas
  template:
    spec:
      terminationGracePeriodSeconds: 60  # MUST be > drain time
      containers:
        - name: ws-server
          image: myapp/ws-server:latest
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 10"]  # wait for LB to drain
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "2Gi"
              cpu: "2000m"
---
apiVersion: v1
kind: Service
metadata:
  name: websocket-server
  annotations:
    # Enable sticky sessions for WebSocket
    service.beta.kubernetes.io/aws-load-balancer-stickiness-enabled: "true"
    service.beta.kubernetes.io/aws-load-balancer-stickiness-type: "lb_cookie"
spec:
  type: LoadBalancer
  sessionAffinity: ClientIP         # Sticky sessions
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 3600          # 1 hour
  ports:
    - port: 443
      targetPort: 8080
  selector:
    app: websocket-server
```

### 6.5 Deployment Rules

- **ALWAYS** implement graceful shutdown: mark unhealthy → wait → close connections → exit
- **MUST** set `terminationGracePeriodSeconds` longer than your drain timeout
- **ALWAYS** send close code 1012 (Service Restart) so clients reconnect immediately
- **MUST** wait for the load balancer to stop routing before closing connections
- **USE** `maxUnavailable: 0` to prevent connection loss during deploys
- **ALWAYS** add `preStop` hook to wait for LB health check to detect the pod going away
- **NEVER** kill WebSocket servers without draining connections

---

## 7. Monitoring & Observability

### 7.1 Key Metrics

| Metric | Type | Purpose | Alert Threshold |
|--------|------|---------|-----------------|
| `ws_connections_total` | Gauge | Active connection count | > 80% capacity |
| `ws_connections_rate` | Counter | New connections per second | Sudden spike |
| `ws_disconnections_rate` | Counter | Disconnections per second | Spike = problem |
| `ws_messages_sent_total` | Counter | Messages sent by server | Throughput monitoring |
| `ws_messages_received_total` | Counter | Messages received from clients | Throughput monitoring |
| `ws_message_size_bytes` | Histogram | Message size distribution | > expected max |
| `ws_backplane_latency_ms` | Histogram | Redis/NATS publish latency | > 10ms |
| `ws_rooms_active` | Gauge | Active room count | Unexpected growth |
| `ws_subscriptions_per_connection` | Histogram | Subs per connection | > limit |
| `ws_send_buffer_size` | Gauge | Pending messages per connection | Growing = slow consumer |

### 7.2 Prometheus Metrics (Node.js)

```typescript
import { Gauge, Counter, Histogram } from "prom-client";

const wsConnectionsGauge = new Gauge({
  name: "ws_connections_total",
  help: "Total active WebSocket connections",
  labelNames: ["server_id"],
});

const wsMessagesCounter = new Counter({
  name: "ws_messages_total",
  help: "Total WebSocket messages",
  labelNames: ["direction", "type"],
});

const wsMessageSizeHistogram = new Histogram({
  name: "ws_message_size_bytes",
  help: "WebSocket message size in bytes",
  labelNames: ["direction"],
  buckets: [64, 256, 1024, 4096, 16384, 65536, 262144],
});

// Track on connection/disconnection
wss.on("connection", (ws) => {
  wsConnectionsGauge.inc({ server_id: SERVER_ID });

  ws.on("message", (data: Buffer) => {
    wsMessagesCounter.inc({ direction: "received", type: "data" });
    wsMessageSizeHistogram.observe({ direction: "received" }, data.length);
  });

  ws.on("close", () => {
    wsConnectionsGauge.dec({ server_id: SERVER_ID });
  });
});
```

### 7.3 Prometheus Metrics (Go)

```go
import "github.com/prometheus/client_golang/prometheus"

var (
    wsConnections = prometheus.NewGauge(prometheus.GaugeOpts{
        Name: "ws_connections_total",
        Help: "Total active WebSocket connections",
    })
    wsMessages = prometheus.NewCounterVec(prometheus.CounterOpts{
        Name: "ws_messages_total",
        Help: "Total WebSocket messages",
    }, []string{"direction", "type"})
    wsMessageSize = prometheus.NewHistogramVec(prometheus.HistogramOpts{
        Name:    "ws_message_size_bytes",
        Help:    "WebSocket message size in bytes",
        Buckets: []float64{64, 256, 1024, 4096, 16384, 65536},
    }, []string{"direction"})
)

func init() {
    prometheus.MustRegister(wsConnections, wsMessages, wsMessageSize)
}
```

### 7.4 Health Check Endpoint

```typescript
// Health check — separate from WebSocket endpoint
app.get("/health", (req, res) => {
  if (!isHealthy) {
    return res.status(503).json({ status: "draining" });
  }

  const checks = {
    connections: wss.clients.size,
    redis: redisClient.isOpen,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  const healthy = checks.redis && checks.connections < MAX_CONNECTIONS;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "healthy" : "unhealthy",
    ...checks,
  });
});
```

### 7.5 Monitoring Rules

- **ALWAYS** expose connection count as a Prometheus gauge
- **MUST** track message throughput (sent/received) as counters
- **ALWAYS** monitor message size distribution with histograms
- **MUST** alert when connection count exceeds 80% of capacity
- **ALWAYS** monitor backplane (Redis) latency — spikes affect all clients
- **MUST** implement a health check endpoint separate from the WebSocket path
- **ALWAYS** include server_id label in metrics for per-instance monitoring
- **TRACK** disconnection rate — sudden spikes indicate infrastructure issues

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No message backplane | Clients on different servers can't communicate | Use Redis Pub/Sub or NATS |
| Local-only state | Room membership lost on server restart | Store in Redis with TTL |
| No sticky sessions | WebSocket frames routed to wrong server | Configure LB with ip_hash or cookie |
| Default file descriptor limit (1024) | "Too many open files" errors | Increase to 1,000,000+ in ulimit/sysctl |
| No capacity planning | Server OOM at unexpected load | Calculate memory per connection, plan capacity |
| Big-bang deploys (kill all servers) | All clients disconnect simultaneously | Rolling deploy with drain strategy |
| No graceful shutdown | Connections dropped mid-message | SIGTERM handler with close frames and drain |
| No health check | LB routes to dead/draining servers | HTTP health endpoint checked by LB |
| Compression with high connection count | RAM exhaustion (~300KB per connection) | Disable permessage-deflate for max connections |
| No monitoring | Blind to connection leaks and degradation | Prometheus metrics for connections, messages, latency |
| Single Redis instance for backplane | Redis failure kills all real-time features | Redis Sentinel or Redis Cluster |
| No connection draining on deploy | Clients reconnect to a server about to die | Mark unhealthy, wait for LB, then close |

---

## 9. Enforcement Checklist

- [ ] Message backplane (Redis Pub/Sub or NATS) configured for multi-server deployment
- [ ] Sticky sessions enabled at load balancer level
- [ ] Load balancer passes `Upgrade` and `Connection` headers
- [ ] LB proxy timeout > 2x WebSocket ping interval
- [ ] File descriptor limit set to ≥ 1,000,000
- [ ] Kernel TCP parameters tuned (somaxconn, tcp_max_syn_backlog)
- [ ] Memory budget per connection calculated and capacity planned
- [ ] Graceful shutdown handles SIGTERM with connection draining
- [ ] Close code 1012 sent to clients during server restart
- [ ] Rolling deployment with `maxUnavailable: 0`
- [ ] `terminationGracePeriodSeconds` > drain timeout
- [ ] Health check endpoint returns 503 during shutdown
- [ ] Room membership stored in Redis (not local-only)
- [ ] Presence TTL auto-cleans stale entries
- [ ] Prometheus metrics: connections, messages, message size, backplane latency
- [ ] Alerts configured for > 80% connection capacity
- [ ] Redis Sentinel or Cluster for backplane high availability
- [ ] Backplane reconnection logic handles Redis/NATS outages
