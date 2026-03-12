# WebSocket Security

Category: Application Security / API Security
Severity: Critical
Last Updated: 2025-12
Tags: websocket, real-time, cswsh, authentication, rate-limiting

---

## Overview

WebSockets provide full-duplex communication between clients and servers, enabling real-time features such as chat, live updates, and collaborative editing. Unlike HTTP, WebSocket connections are long-lived and stateful, creating a unique security surface. The initial HTTP upgrade request is the only point where standard HTTP security mechanisms (cookies, headers) apply. After the upgrade, all security must be enforced at the application level. This guide covers origin validation, authentication, per-message authorization, input validation, encryption, connection management, and channel-level access control.

---

## Origin Validation (CSWSH Prevention)

### Cross-Site WebSocket Hijacking (CSWSH)

CSWSH is the WebSocket equivalent of CSRF. If a user is authenticated via cookies, a malicious website can open a WebSocket connection to the target server, and the browser will automatically include the session cookie. The server cannot distinguish this from a legitimate connection unless it validates the `Origin` header.

**TypeScript (ws library)**:

```typescript
import { WebSocketServer } from 'ws';

const ALLOWED_ORIGINS = new Set([
  'https://app.example.com',
  'https://admin.example.com',
]);

const wss = new WebSocketServer({
  server: httpServer,
  verifyClient: (info, callback) => {
    const origin = info.origin || info.req.headers.origin;

    // Always validate origin
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      callback(false, 403, 'Origin not allowed');
      return;
    }

    // Additional checks can go here (IP allowlist, etc.)
    callback(true);
  },
});
```

**Go (gorilla/websocket)**:

```go
import "github.com/gorilla/websocket"

var allowedOrigins = map[string]bool{
    "https://app.example.com":   true,
    "https://admin.example.com": true,
}

var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
    CheckOrigin: func(r *http.Request) bool {
        origin := r.Header.Get("Origin")
        if origin == "" {
            return false // Reject connections without Origin
        }
        return allowedOrigins[origin]
    },
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Printf("upgrade failed: %v", err)
        return
    }
    defer conn.Close()
    // Handle connection...
}
```

**Go (nhooyr/websocket)**:

```go
import "nhooyr.io/websocket"

func wsHandler(w http.ResponseWriter, r *http.Request) {
    conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
        OriginPatterns: []string{
            "app.example.com",
            "admin.example.com",
        },
        // Do NOT use InsecureSkipVerify in production
    })
    if err != nil {
        log.Printf("accept failed: %v", err)
        return
    }
    defer conn.Close(websocket.StatusNormalClosure, "")
    // Handle connection...
}
```

**Python (websockets library)**:

```python
import websockets
from urllib.parse import urlparse

ALLOWED_ORIGINS = {
    "https://app.example.com",
    "https://admin.example.com",
}

async def handler(websocket):
    origin = websocket.request_headers.get("Origin", "")
    if origin not in ALLOWED_ORIGINS:
        await websocket.close(4003, "Origin not allowed")
        return
    # Handle connection...

async def main():
    async with websockets.serve(
        handler,
        "0.0.0.0",
        8765,
        origins=ALLOWED_ORIGINS,  # Built-in origin checking
    ):
        await asyncio.Future()  # Run forever
```

**Python (FastAPI WebSocket)**:

```python
from fastapi import FastAPI, WebSocket, WebSocketException

app = FastAPI()

ALLOWED_ORIGINS = {"https://app.example.com", "https://admin.example.com"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    origin = websocket.headers.get("origin", "")
    if origin not in ALLOWED_ORIGINS:
        await websocket.close(code=4003, reason="Origin not allowed")
        return

    await websocket.accept()
    # Handle connection...
```

---

## Ticket-Based Authentication

WebSocket connections cannot set custom headers during the browser-initiated handshake (the `new WebSocket()` constructor does not support custom headers). Sending tokens in query parameters is insecure because URLs are logged. The recommended pattern is ticket-based authentication.

### Pattern

1. Client authenticates via normal HTTP (POST /auth/ws-ticket) with their Bearer token.
2. Server generates a short-lived, single-use ticket.
3. Client connects to WebSocket with the ticket.
4. Server validates and consumes the ticket during the upgrade.

**TypeScript (Express + ws)**:

```typescript
import crypto from 'crypto';

// Step 1: Issue a WebSocket ticket via authenticated HTTP endpoint
const wsTickets = new Map<string, { userId: string; createdAt: number }>();

app.post('/api/auth/ws-ticket', authenticate, (req, res) => {
  const ticket = crypto.randomBytes(32).toString('base64url');
  wsTickets.set(ticket, {
    userId: req.user.id,
    createdAt: Date.now(),
  });

  // Auto-expire tickets after 30 seconds
  setTimeout(() => wsTickets.delete(ticket), 30000);

  res.json({ ticket, expiresIn: 30 });
});

// Step 2: Validate ticket during WebSocket upgrade
const wss = new WebSocketServer({
  server: httpServer,
  verifyClient: (info, callback) => {
    const origin = info.origin;
    if (!ALLOWED_ORIGINS.has(origin)) {
      callback(false, 403, 'Origin not allowed');
      return;
    }

    const url = new URL(info.req.url!, `https://${info.req.headers.host}`);
    const ticket = url.searchParams.get('ticket');

    if (!ticket) {
      callback(false, 401, 'Missing ticket');
      return;
    }

    const ticketData = wsTickets.get(ticket);
    if (!ticketData) {
      callback(false, 401, 'Invalid or expired ticket');
      return;
    }

    // Check ticket age (additional safety check)
    if (Date.now() - ticketData.createdAt > 30000) {
      wsTickets.delete(ticket);
      callback(false, 401, 'Ticket expired');
      return;
    }

    // Consume ticket (single-use)
    wsTickets.delete(ticket);

    // Attach user info to the request for later access
    (info.req as any).userId = ticketData.userId;
    callback(true);
  },
});

wss.on('connection', (ws, req) => {
  const userId = (req as any).userId;
  ws.userId = userId;
  console.log(`User ${userId} connected via WebSocket`);
});
```

**Go (gorilla/websocket ticket auth)**:

```go
type WSTicket struct {
    UserID    string
    CreatedAt time.Time
}

var (
    ticketStore = sync.Map{}
)

// HTTP endpoint to issue tickets
func issueWSTicket(w http.ResponseWriter, r *http.Request) {
    user := getUserFromContext(r.Context()) // From JWT middleware
    if user == nil {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    ticket := generateSecureToken(32)
    ticketStore.Store(ticket, &WSTicket{
        UserID:    user.ID,
        CreatedAt: time.Now(),
    })

    // Auto-expire
    time.AfterFunc(30*time.Second, func() {
        ticketStore.Delete(ticket)
    })

    json.NewEncoder(w).Encode(map[string]interface{}{
        "ticket":    ticket,
        "expiresIn": 30,
    })
}

// WebSocket handler with ticket validation
func wsHandler(w http.ResponseWriter, r *http.Request) {
    ticket := r.URL.Query().Get("ticket")
    if ticket == "" {
        http.Error(w, "Missing ticket", http.StatusUnauthorized)
        return
    }

    val, ok := ticketStore.LoadAndDelete(ticket) // Single-use: load and delete atomically
    if !ok {
        http.Error(w, "Invalid ticket", http.StatusUnauthorized)
        return
    }

    wsTicket := val.(*WSTicket)
    if time.Since(wsTicket.CreatedAt) > 30*time.Second {
        http.Error(w, "Ticket expired", http.StatusUnauthorized)
        return
    }

    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        return
    }
    defer conn.Close()

    handleConnection(conn, wsTicket.UserID)
}
```

**Python (websockets ticket auth)**:

```python
import secrets
from datetime import datetime, timedelta

# In-memory ticket store (use Redis in production)
ws_tickets: dict[str, dict] = {}

# HTTP endpoint to issue ticket
@app.post("/api/auth/ws-ticket")
async def issue_ws_ticket(user=Depends(get_current_user)):
    ticket = secrets.token_urlsafe(32)
    ws_tickets[ticket] = {
        "user_id": user.id,
        "created_at": datetime.utcnow(),
    }

    # Schedule cleanup
    asyncio.get_event_loop().call_later(30, lambda: ws_tickets.pop(ticket, None))

    return {"ticket": ticket, "expires_in": 30}

# WebSocket handler
@app.websocket("/ws")
async def websocket_handler(websocket: WebSocket, ticket: str = Query(...)):
    ticket_data = ws_tickets.pop(ticket, None)  # Single-use
    if not ticket_data:
        await websocket.close(code=4001, reason="Invalid ticket")
        return

    if datetime.utcnow() - ticket_data["created_at"] > timedelta(seconds=30):
        await websocket.close(code=4001, reason="Ticket expired")
        return

    await websocket.accept()
    user_id = ticket_data["user_id"]
    await handle_connection(websocket, user_id)
```

---

## Per-Message Authorization

After the connection is established, every incoming message must be authorized. Different message types may require different permissions.

**TypeScript**:

```typescript
interface WSMessage {
  type: string;
  payload: any;
}

// Message type to required permission mapping
const MESSAGE_PERMISSIONS: Record<string, string[]> = {
  'chat:send': ['chat:write'],
  'chat:delete': ['chat:admin'],
  'channel:join': ['channel:read'],
  'channel:create': ['channel:admin'],
  'user:status': ['user:read'],
};

async function handleMessage(ws: WebSocket, userId: string, raw: string) {
  let message: WSMessage;
  try {
    message = JSON.parse(raw);
  } catch {
    ws.send(JSON.stringify({ type: 'error', payload: 'Invalid JSON' }));
    return;
  }

  // Validate message type
  if (!message.type || typeof message.type !== 'string') {
    ws.send(JSON.stringify({ type: 'error', payload: 'Missing message type' }));
    return;
  }

  // Check permissions
  const requiredPermissions = MESSAGE_PERMISSIONS[message.type];
  if (!requiredPermissions) {
    ws.send(JSON.stringify({ type: 'error', payload: 'Unknown message type' }));
    return;
  }

  const userPermissions = await getUserPermissions(userId);
  const hasPermission = requiredPermissions.every(p => userPermissions.includes(p));

  if (!hasPermission) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: 'Insufficient permissions for this action',
    }));
    return;
  }

  // Process the authorized message
  await processMessage(ws, userId, message);
}

wss.on('connection', (ws, req) => {
  const userId = (req as any).userId;

  ws.on('message', async (data) => {
    try {
      await handleMessage(ws, userId, data.toString());
    } catch (err) {
      logger.error({ userId, error: err }, 'WebSocket message handling error');
      ws.send(JSON.stringify({ type: 'error', payload: 'Internal error' }));
    }
  });
});
```

---

## Input Validation for WebSocket Messages

WebSocket messages bypass all HTTP middleware (body parsers, validators, WAF rules). Every message must be validated at the application level.

**TypeScript (with Zod)**:

```typescript
import { z } from 'zod';

const ChatMessageSchema = z.object({
  type: z.literal('chat:send'),
  payload: z.object({
    channelId: z.string().uuid(),
    content: z.string().min(1).max(4000),
    replyTo: z.string().uuid().optional(),
  }),
});

const ChannelJoinSchema = z.object({
  type: z.literal('channel:join'),
  payload: z.object({
    channelId: z.string().uuid(),
  }),
});

const MessageSchema = z.discriminatedUnion('type', [
  ChatMessageSchema,
  ChannelJoinSchema,
  // Add more message types...
]);

async function handleMessage(ws: WebSocket, userId: string, raw: string) {
  // Length check before parsing
  if (raw.length > 16384) {
    ws.send(JSON.stringify({ type: 'error', payload: 'Message too large' }));
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    ws.send(JSON.stringify({ type: 'error', payload: 'Invalid JSON' }));
    return;
  }

  const result = MessageSchema.safeParse(parsed);
  if (!result.success) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: 'Invalid message format',
      // Do NOT send result.error.issues in production
    }));
    return;
  }

  // result.data is now type-safe and validated
  await processValidatedMessage(ws, userId, result.data);
}
```

**Go (validation)**:

```go
type WSMessage struct {
    Type    string          `json:"type"`
    Payload json.RawMessage `json:"payload"`
}

type ChatSendPayload struct {
    ChannelID string `json:"channel_id"`
    Content   string `json:"content"`
    ReplyTo   string `json:"reply_to,omitempty"`
}

func validateAndHandle(conn *websocket.Conn, userID string, raw []byte) error {
    // Size check
    if len(raw) > 16384 {
        return sendError(conn, "message too large")
    }

    var msg WSMessage
    if err := json.Unmarshal(raw, &msg); err != nil {
        return sendError(conn, "invalid JSON")
    }

    switch msg.Type {
    case "chat:send":
        var payload ChatSendPayload
        if err := json.Unmarshal(msg.Payload, &payload); err != nil {
            return sendError(conn, "invalid payload")
        }
        if !isValidUUID(payload.ChannelID) {
            return sendError(conn, "invalid channel_id")
        }
        if len(payload.Content) == 0 || len(payload.Content) > 4000 {
            return sendError(conn, "content must be 1-4000 characters")
        }
        return handleChatSend(conn, userID, payload)

    default:
        return sendError(conn, "unknown message type")
    }
}
```

---

## WSS Encryption

Always use `wss://` (WebSocket Secure) in production. Never use plaintext `ws://` connections.

**TypeScript (server with TLS)**:

```typescript
import https from 'https';
import fs from 'fs';
import { WebSocketServer } from 'ws';

const httpsServer = https.createServer({
  cert: fs.readFileSync('/certs/server.crt'),
  key: fs.readFileSync('/certs/server.key'),
  minVersion: 'TLSv1.3',
});

const wss = new WebSocketServer({ server: httpsServer });

httpsServer.listen(443, () => {
  console.log('WSS server listening on port 443');
});
```

**Go**:

```go
func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/ws", wsHandler)

    tlsConfig := &tls.Config{
        MinVersion: tls.VersionTLS13,
    }

    server := &http.Server{
        Addr:      ":443",
        Handler:   mux,
        TLSConfig: tlsConfig,
    }

    log.Fatal(server.ListenAndServeTLS("/certs/server.crt", "/certs/server.key"))
}
```

**Client-side enforcement**:

```typescript
// Client: Always use wss:// in production
function connectWebSocket(ticket: string): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

  if (protocol === 'ws:' && window.location.hostname !== 'localhost') {
    throw new Error('WebSocket connections require HTTPS in production');
  }

  return new WebSocket(`${protocol}//${window.location.host}/ws?ticket=${ticket}`);
}
```

---

## Connection Limits Per User

Prevent a single user from opening too many WebSocket connections, which could exhaust server resources.

**TypeScript**:

```typescript
const MAX_CONNECTIONS_PER_USER = 5;
const userConnections = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws, req) => {
  const userId = (req as any).userId;

  // Check connection limit
  const connections = userConnections.get(userId) || new Set();
  if (connections.size >= MAX_CONNECTIONS_PER_USER) {
    ws.close(4008, 'Too many connections');
    return;
  }

  connections.add(ws);
  userConnections.set(userId, connections);

  ws.on('close', () => {
    const conns = userConnections.get(userId);
    if (conns) {
      conns.delete(ws);
      if (conns.size === 0) {
        userConnections.delete(userId);
      }
    }
  });
});
```

**Go**:

```go
var (
    connectionCounts = sync.Map{}
    maxConnsPerUser  = 5
)

func wsHandler(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value("userID").(string)

    // Increment connection count atomically
    countVal, _ := connectionCounts.LoadOrStore(userID, new(int32))
    count := countVal.(*int32)
    current := atomic.AddInt32(count, 1)

    if current > int32(maxConnsPerUser) {
        atomic.AddInt32(count, -1)
        http.Error(w, "Too many connections", http.StatusTooManyRequests)
        return
    }

    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        atomic.AddInt32(count, -1)
        return
    }

    defer func() {
        conn.Close()
        atomic.AddInt32(count, -1)
    }()

    handleConnection(conn, userID)
}
```

---

## Message Rate Limiting

Unlike HTTP, where each request is independent, WebSocket messages flow over a persistent connection. Rate limiting must happen at the message level.

**TypeScript**:

```typescript
interface RateLimitState {
  tokens: number;
  lastRefill: number;
}

class TokenBucketLimiter {
  private buckets = new Map<string, RateLimitState>();
  private maxTokens: number;
  private refillRate: number; // tokens per second

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
  }

  consume(key: string, cost: number = 1): boolean {
    const now = Date.now();
    let state = this.buckets.get(key);

    if (!state) {
      state = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(key, state);
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - state.lastRefill) / 1000;
    state.tokens = Math.min(this.maxTokens, state.tokens + elapsed * this.refillRate);
    state.lastRefill = now;

    if (state.tokens >= cost) {
      state.tokens -= cost;
      return true;
    }

    return false;
  }
}

const messageLimiter = new TokenBucketLimiter(
  30,   // Max 30 tokens (burst)
  10,   // Refill 10 tokens per second
);

wss.on('connection', (ws, req) => {
  const userId = (req as any).userId;

  ws.on('message', (data) => {
    if (!messageLimiter.consume(userId)) {
      ws.send(JSON.stringify({
        type: 'error',
        payload: 'Rate limit exceeded. Slow down.',
      }));
      return;
    }

    handleMessage(ws, userId, data.toString());
  });
});
```

**Python**:

```python
import time
from collections import defaultdict

class TokenBucket:
    def __init__(self, max_tokens: int, refill_rate: float):
        self.max_tokens = max_tokens
        self.refill_rate = refill_rate
        self.buckets: dict[str, dict] = {}

    def consume(self, key: str, cost: int = 1) -> bool:
        now = time.monotonic()
        if key not in self.buckets:
            self.buckets[key] = {"tokens": self.max_tokens, "last_refill": now}

        state = self.buckets[key]
        elapsed = now - state["last_refill"]
        state["tokens"] = min(self.max_tokens, state["tokens"] + elapsed * self.refill_rate)
        state["last_refill"] = now

        if state["tokens"] >= cost:
            state["tokens"] -= cost
            return True
        return False

message_limiter = TokenBucket(max_tokens=30, refill_rate=10)

@app.websocket("/ws")
async def websocket_handler(websocket: WebSocket, ticket: str = Query(...)):
    user_id = await validate_ticket(ticket)
    await websocket.accept()

    try:
        while True:
            raw = await websocket.receive_text()
            if not message_limiter.consume(user_id):
                await websocket.send_json({
                    "type": "error",
                    "payload": "Rate limit exceeded",
                })
                continue
            await handle_message(websocket, user_id, raw)
    except WebSocketDisconnect:
        pass
```

---

## Maximum Message Size

Enforce maximum message sizes to prevent memory exhaustion.

**TypeScript (ws)**:

```typescript
const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: 64 * 1024, // 64KB max message size
});
```

**Go (gorilla/websocket)**:

```go
func handleConnection(conn *websocket.Conn, userID string) {
    conn.SetReadLimit(64 * 1024) // 64KB max message size

    for {
        _, message, err := conn.ReadMessage()
        if err != nil {
            if websocket.IsCloseError(err, websocket.CloseNormalClosure) {
                return
            }
            // ReadMessage returns error if message exceeds limit
            log.Printf("read error for user %s: %v", userID, err)
            return
        }
        handleMessage(conn, userID, message)
    }
}
```

**Go (nhooyr/websocket)**:

```go
func handleConnection(conn *websocket.Conn, userID string) {
    conn.SetReadLimit(64 * 1024) // 64KB

    for {
        _, reader, err := conn.Reader(context.Background())
        if err != nil {
            return
        }
        data, err := io.ReadAll(io.LimitReader(reader, 64*1024))
        if err != nil {
            return
        }
        handleMessage(conn, userID, data)
    }
}
```

**Python (websockets)**:

```python
async with websockets.serve(
    handler,
    "0.0.0.0",
    8765,
    max_size=64 * 1024,  # 64KB
) as server:
    await asyncio.Future()
```

---

## Heartbeat / Ping-Pong

Heartbeats detect dead connections that did not close properly (network drops, client crashes). Without heartbeats, dead connections accumulate and exhaust server resources.

**TypeScript (ws)**:

```typescript
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 10000;  // 10 seconds to respond

wss.on('connection', (ws, req) => {
  let isAlive = true;
  let heartbeatTimer: NodeJS.Timeout;

  ws.on('pong', () => {
    isAlive = true;
  });

  heartbeatTimer = setInterval(() => {
    if (!isAlive) {
      // Client did not respond to last ping
      ws.terminate();
      return;
    }
    isAlive = false;
    ws.ping();
  }, HEARTBEAT_INTERVAL);

  ws.on('close', () => {
    clearInterval(heartbeatTimer);
  });
});
```

**Go (gorilla/websocket)**:

```go
const (
    heartbeatInterval = 30 * time.Second
    heartbeatTimeout  = 10 * time.Second
)

func handleConnection(conn *websocket.Conn, userID string) {
    conn.SetReadDeadline(time.Now().Add(heartbeatInterval + heartbeatTimeout))

    conn.SetPongHandler(func(string) error {
        conn.SetReadDeadline(time.Now().Add(heartbeatInterval + heartbeatTimeout))
        return nil
    })

    // Ping goroutine
    go func() {
        ticker := time.NewTicker(heartbeatInterval)
        defer ticker.Stop()
        for range ticker.C {
            if err := conn.WriteControl(
                websocket.PingMessage,
                nil,
                time.Now().Add(heartbeatTimeout),
            ); err != nil {
                return
            }
        }
    }()

    // Read loop
    for {
        _, message, err := conn.ReadMessage()
        if err != nil {
            return
        }
        processMessage(conn, userID, message)
    }
}
```

---

## Reconnection Security

When a WebSocket connection drops, the client must re-authenticate. Never allow reconnection with a previously used ticket or stale session.

**TypeScript (client-side)**:

```typescript
class SecureWebSocketClient {
  private ws: WebSocket | null = null;
  private apiToken: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseDelay = 1000;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  async connect(): Promise<void> {
    // Get a fresh ticket for every connection attempt
    const response = await fetch('/api/auth/ws-ticket', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiToken}` },
    });

    if (!response.ok) {
      throw new Error('Failed to obtain WebSocket ticket');
    }

    const { ticket } = await response.json();
    this.ws = new WebSocket(`wss://${location.host}/ws?ticket=${ticket}`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0; // Reset on successful connection
    };

    this.ws.onclose = (event) => {
      if (event.code === 4001) {
        // Authentication failure -- do not reconnect
        console.error('Authentication failed, not reconnecting');
        return;
      }

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        // Exponential backoff with jitter
        const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts)
          + Math.random() * 1000;
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), delay);
      }
    };
  }
}
```

---

## Broadcasting Authorization (Channel-Level Access Control)

When broadcasting messages to multiple clients, ensure each recipient is authorized to receive the message.

**TypeScript**:

```typescript
interface Channel {
  id: string;
  type: 'public' | 'private' | 'direct';
  members: Set<string>;
}

class SecureChannelManager {
  private channels = new Map<string, Channel>();
  private userSockets = new Map<string, Set<WebSocket>>();

  async joinChannel(userId: string, channelId: string, ws: WebSocket): Promise<boolean> {
    const channel = this.channels.get(channelId);
    if (!channel) return false;

    // Authorization check
    if (channel.type === 'private' || channel.type === 'direct') {
      const hasAccess = await this.checkChannelAccess(userId, channelId);
      if (!hasAccess) return false;
    }

    channel.members.add(userId);

    const sockets = this.userSockets.get(userId) || new Set();
    sockets.add(ws);
    this.userSockets.set(userId, sockets);

    return true;
  }

  async broadcast(channelId: string, message: any, senderId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    // Verify sender is a member
    if (!channel.members.has(senderId)) return;

    const payload = JSON.stringify({
      type: 'channel:message',
      payload: {
        channelId,
        senderId,
        ...message,
        timestamp: Date.now(),
      },
    });

    for (const memberId of channel.members) {
      const sockets = this.userSockets.get(memberId);
      if (!sockets) continue;

      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }
  }

  private async checkChannelAccess(userId: string, channelId: string): Promise<boolean> {
    const membership = await db.channelMembers.findOne({
      channelId,
      userId,
      status: 'active',
    });
    return membership !== null;
  }
}
```

**TypeScript (Socket.io rooms with authorization)**:

```typescript
import { Server } from 'socket.io';

const io = new Server(httpServer, {
  cors: {
    origin: ['https://app.example.com'],
    credentials: true,
  },
  maxHttpBufferSize: 64 * 1024, // 64KB max message
  pingInterval: 25000,
  pingTimeout: 10000,
});

// Authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const user = await validateToken(token);
    socket.data.userId = user.id;
    socket.data.roles = user.roles;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.data.userId;

  // Authorized room joining
  socket.on('join:channel', async (channelId, callback) => {
    const hasAccess = await checkChannelAccess(userId, channelId);
    if (!hasAccess) {
      return callback({ error: 'Access denied' });
    }

    socket.join(`channel:${channelId}`);
    callback({ success: true });
  });

  // Broadcast to authorized room members only
  socket.on('chat:message', async (data) => {
    const { channelId, content } = data;

    // Verify sender is in the room
    if (!socket.rooms.has(`channel:${channelId}`)) {
      socket.emit('error', { message: 'Not a member of this channel' });
      return;
    }

    // Broadcast to room
    io.to(`channel:${channelId}`).emit('chat:message', {
      channelId,
      senderId: userId,
      content,
      timestamp: Date.now(),
    });
  });
});
```

---

## Best Practices

1. **Always validate the Origin header** -- Reject WebSocket upgrade requests from unknown origins to prevent CSWSH attacks.

2. **Use ticket-based authentication** -- Authenticate via HTTP, issue a short-lived single-use ticket, and validate it during the WebSocket upgrade. Never pass tokens in URL parameters for long-lived use.

3. **Validate every message** -- WebSocket messages bypass HTTP middleware. Validate type, structure, and content of every incoming message using a schema validator.

4. **Enforce per-user connection limits** -- Prevent resource exhaustion by capping the number of simultaneous WebSocket connections per user.

5. **Rate limit at the message level** -- Use token bucket or sliding window algorithms to limit the rate of messages per user per connection.

6. **Always use WSS (TLS)** -- Plaintext WebSocket connections expose all messages to eavesdropping. Enforce WSS in all non-local environments.

7. **Implement heartbeat/ping-pong** -- Detect and close dead connections to prevent resource leaks.

8. **Re-authenticate on reconnection** -- Issue a new ticket for every connection attempt. Never reuse expired or consumed tickets.

9. **Authorize channel subscriptions** -- Verify that users have access to a channel before adding them. Verify membership before broadcasting.

10. **Set maximum message sizes** -- Configure `maxPayload` or `SetReadLimit` to prevent memory exhaustion from oversized messages.

---

## Anti-Patterns

1. **Not validating the Origin header** -- Allows any website to open WebSocket connections on behalf of authenticated users (CSWSH).

2. **Sending JWT tokens in URL query parameters** -- URLs are logged by proxies, load balancers, and browsers. Tokens in URLs are leaked.

3. **Trusting WebSocket messages without validation** -- All HTTP security middleware is bypassed. Messages must be validated at the application layer.

4. **No connection limits per user** -- A single user can open thousands of connections and exhaust server memory.

5. **No message rate limiting** -- Allows message flooding that impacts all connected users.

6. **Allowing ws:// in production** -- Plaintext WebSocket connections can be intercepted and modified.

7. **Broadcasting without checking channel membership** -- Users may receive messages from channels they should not access.

8. **Reusing authentication tickets** -- Tickets must be single-use and short-lived. Reusable tickets can be replayed by attackers.

---

## Enforcement Checklist

- [ ] Origin header is validated against an allowlist on every upgrade request
- [ ] Ticket-based authentication is implemented (HTTP auth, issue ticket, WS connect)
- [ ] Tickets are single-use and expire within 30 seconds
- [ ] Every WebSocket message is validated against a schema
- [ ] Per-message authorization checks are enforced based on message type
- [ ] Per-user connection limits are enforced
- [ ] Message rate limiting is implemented (token bucket or sliding window)
- [ ] Maximum message size is configured (server-side enforcement)
- [ ] WSS (TLS) is required for all non-localhost connections
- [ ] Heartbeat/ping-pong is configured with appropriate timeouts
- [ ] Reconnection requires fresh authentication (new ticket)
- [ ] Channel/room joining requires authorization verification
- [ ] Broadcasting verifies sender membership before delivery
- [ ] Dead connections are detected and cleaned up
- [ ] WebSocket errors do not expose internal server details
