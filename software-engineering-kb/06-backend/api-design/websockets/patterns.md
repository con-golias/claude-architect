# WebSocket Design Patterns

> **AI Plugin Directive:** When designing WebSocket message protocols, implementing pub/sub systems, building chat or real-time features, or reviewing WebSocket application architecture, APPLY every pattern and rule in this document. USE the message format standards, room/channel patterns, reconnection strategies, and error handling defined here. NEVER build WebSocket applications without structured message protocols, proper reconnection, or authentication flows.

**Core Rule: ALWAYS define a structured message protocol with type discriminators. ALWAYS implement reconnection with exponential backoff on the client. ALWAYS use the pub/sub pattern for multi-consumer scenarios. NEVER send unstructured messages. NEVER assume connections are permanent.**

---

## 1. Message Protocol Design

EVERY WebSocket application needs a structured message format. Without it, the system becomes unmaintainable.

### 1.1 Standard Message Envelope

```typescript
// CORRECT — typed message envelope
interface WebSocketMessage {
  type: string;          // message type discriminator
  id?: string;           // unique message ID (for request-response correlation)
  timestamp?: number;    // Unix epoch ms
  payload: unknown;      // type-specific data
}

// Examples:
{ "type": "subscribe", "id": "msg-1", "payload": { "channel": "orders" } }
{ "type": "message",   "id": "msg-2", "payload": { "text": "hello", "room": "general" } }
{ "type": "error",     "id": "msg-1", "payload": { "code": "NOT_FOUND", "detail": "Channel not found" } }
```

```
// WRONG — unstructured messages
"hello"                                         // ✗ no type, no structure
{ "action": "sub", "ch": "orders" }             // ✗ inconsistent naming
{ "subscribe": true, "channel": "orders" }      // ✗ no type discriminator
```

### 1.2 Message Type Taxonomy

CATEGORIZE messages by direction and purpose.

```
┌──────────────────────────────────────────────────────────┐
│                  MESSAGE TAXONOMY                         │
├──────────────────┬───────────────────────────────────────┤
│ CLIENT → SERVER  │ Commands (imperative actions)          │
│                  │  subscribe, unsubscribe, send,         │
│                  │  join, leave, typing, ping             │
├──────────────────┼───────────────────────────────────────┤
│ SERVER → CLIENT  │ Events (things that happened)          │
│                  │  message, joined, left, error,         │
│                  │  subscribed, unsubscribed, pong        │
├──────────────────┼───────────────────────────────────────┤
│ BIDIRECTIONAL    │ Data frames (both directions)          │
│                  │  cursor_move, state_update,            │
│                  │  presence_update                       │
└──────────────────┴───────────────────────────────────────┘
```

### 1.3 Complete Protocol Definition

```typescript
// ═══════ Client → Server Messages ═══════

interface SubscribeMessage {
  type: "subscribe";
  id: string;
  payload: { channel: string; filter?: string };
}

interface UnsubscribeMessage {
  type: "unsubscribe";
  id: string;
  payload: { channel: string };
}

interface SendMessage {
  type: "send";
  id: string;
  payload: { channel: string; data: unknown };
}

interface PingMessage {
  type: "ping";
  id: string;
  payload: {};
}

type ClientMessage = SubscribeMessage | UnsubscribeMessage | SendMessage | PingMessage;

// ═══════ Server → Client Messages ═══════

interface EventMessage {
  type: "event";
  id: string;
  timestamp: number;
  payload: { channel: string; event: string; data: unknown };
}

interface AckMessage {
  type: "ack";
  id: string;          // correlates to client message ID
  payload: {};
}

interface ErrorMessage {
  type: "error";
  id: string;          // correlates to client message ID (if applicable)
  payload: { code: string; message: string; detail?: unknown };
}

interface PongMessage {
  type: "pong";
  id: string;
  payload: {};
}

type ServerMessage = EventMessage | AckMessage | ErrorMessage | PongMessage;
```

### 1.4 Message Router (Server-Side)

```typescript
// TypeScript — message dispatcher
function handleMessage(ws: WebSocket, raw: string): void {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    sendError(ws, "", "PARSE_ERROR", "Invalid JSON");
    return;
  }

  if (!msg.type) {
    sendError(ws, "", "INVALID_MESSAGE", "Missing type field");
    return;
  }

  switch (msg.type) {
    case "subscribe":
      handleSubscribe(ws, msg);
      break;
    case "unsubscribe":
      handleUnsubscribe(ws, msg);
      break;
    case "send":
      handleSend(ws, msg);
      break;
    case "ping":
      ws.send(JSON.stringify({ type: "pong", id: msg.id, payload: {} }));
      break;
    default:
      sendError(ws, msg.id, "UNKNOWN_TYPE", `Unknown message type: ${msg.type}`);
  }
}

function sendError(ws: WebSocket, id: string, code: string, message: string): void {
  ws.send(JSON.stringify({
    type: "error",
    id,
    payload: { code, message },
  }));
}
```

```go
// Go — message dispatcher
type ClientMessage struct {
    Type    string          `json:"type"`
    ID      string          `json:"id"`
    Payload json.RawMessage `json:"payload"`
}

func handleMessage(conn *Connection, raw []byte) {
    var msg ClientMessage
    if err := json.Unmarshal(raw, &msg); err != nil {
        sendError(conn, "", "PARSE_ERROR", "Invalid JSON")
        return
    }

    switch msg.Type {
    case "subscribe":
        var payload SubscribePayload
        json.Unmarshal(msg.Payload, &payload)
        handleSubscribe(conn, msg.ID, payload)
    case "unsubscribe":
        var payload UnsubscribePayload
        json.Unmarshal(msg.Payload, &payload)
        handleUnsubscribe(conn, msg.ID, payload)
    case "send":
        var payload SendPayload
        json.Unmarshal(msg.Payload, &payload)
        handleSend(conn, msg.ID, payload)
    case "ping":
        sendPong(conn, msg.ID)
    default:
        sendError(conn, msg.ID, "UNKNOWN_TYPE", "Unknown message type")
    }
}
```

### 1.5 Message Protocol Rules

- **ALWAYS** include a `type` field as message discriminator
- **ALWAYS** include a unique `id` for request-response correlation
- **MUST** acknowledge client commands with `ack` or `error` responses
- **ALWAYS** include error codes (not just messages) for machine-readable errors
- **NEVER** send unstructured strings — always use typed JSON envelopes
- **MUST** handle unknown message types gracefully — send error, do not crash
- **USE** `camelCase` for JSON field names (consistent with JavaScript conventions)
- **KEEP** message payloads as small as possible — minimize unnecessary fields

---

## 2. Pub/Sub Pattern

The most common WebSocket pattern. Clients subscribe to channels and receive events published to those channels.

### 2.1 Architecture

```
┌──────────┐  subscribe("orders")   ┌──────────────────┐
│ Client A │───────────────────────▶│                  │
│          │◀── order.created ──────│                  │
│          │◀── order.updated ──────│                  │
├──────────┤                        │   PUB/SUB HUB    │
│ Client B │  subscribe("orders")   │                  │
│          │───────────────────────▶│                  │
│          │◀── order.created ──────│                  │
│          │◀── order.updated ──────│                  │
├──────────┤                        │                  │
│ Client C │  subscribe("users")    │                  │
│          │───────────────────────▶│                  │
│          │◀── user.login ─────────│                  │
└──────────┘                        └──────────────────┘
                                          ▲
                                          │ publish("orders", event)
                                    ┌─────┴──────┐
                                    │  Backend   │
                                    │  Service   │
                                    └────────────┘
```

### 2.2 TypeScript Implementation

```typescript
class PubSubHub {
  private subscriptions = new Map<string, Set<WebSocket>>();

  subscribe(channel: string, ws: WebSocket): void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(ws);
  }

  unsubscribe(channel: string, ws: WebSocket): void {
    this.subscriptions.get(channel)?.delete(ws);
    // Clean up empty channels
    if (this.subscriptions.get(channel)?.size === 0) {
      this.subscriptions.delete(channel);
    }
  }

  unsubscribeAll(ws: WebSocket): void {
    for (const [channel, subscribers] of this.subscriptions) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        this.subscriptions.delete(channel);
      }
    }
  }

  publish(channel: string, event: string, data: unknown): void {
    const message = JSON.stringify({
      type: "event",
      id: generateId(),
      timestamp: Date.now(),
      payload: { channel, event, data },
    });

    const subscribers = this.subscriptions.get(channel);
    if (!subscribers) return;

    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      } else {
        subscribers.delete(ws); // clean up dead connections
      }
    }
  }

  getChannelCount(): number {
    return this.subscriptions.size;
  }

  getSubscriberCount(channel: string): number {
    return this.subscriptions.get(channel)?.size ?? 0;
  }
}
```

### 2.3 Go Implementation

```go
type PubSubHub struct {
    mu   sync.RWMutex
    subs map[string]map[*Connection]bool
}

func NewPubSubHub() *PubSubHub {
    return &PubSubHub{
        subs: make(map[string]map[*Connection]bool),
    }
}

func (h *PubSubHub) Subscribe(channel string, conn *Connection) {
    h.mu.Lock()
    defer h.mu.Unlock()
    if _, ok := h.subs[channel]; !ok {
        h.subs[channel] = make(map[*Connection]bool)
    }
    h.subs[channel][conn] = true
}

func (h *PubSubHub) Unsubscribe(channel string, conn *Connection) {
    h.mu.Lock()
    defer h.mu.Unlock()
    if subscribers, ok := h.subs[channel]; ok {
        delete(subscribers, conn)
        if len(subscribers) == 0 {
            delete(h.subs, channel)
        }
    }
}

func (h *PubSubHub) UnsubscribeAll(conn *Connection) {
    h.mu.Lock()
    defer h.mu.Unlock()
    for channel, subscribers := range h.subs {
        delete(subscribers, conn)
        if len(subscribers) == 0 {
            delete(h.subs, channel)
        }
    }
}

func (h *PubSubHub) Publish(channel string, msg []byte) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    for conn := range h.subs[channel] {
        select {
        case conn.send <- msg:
        default:
            // buffer full — slow consumer
            close(conn.send)
        }
    }
}
```

### 2.4 Channel Authorization

```typescript
// ALWAYS check permissions before subscribing
function handleSubscribe(ws: WebSocket, msg: SubscribeMessage): void {
  const { channel } = msg.payload;
  const user = getUser(ws);

  // Check channel access
  if (!canAccess(user, channel)) {
    sendError(ws, msg.id, "FORBIDDEN", `No access to channel: ${channel}`);
    return;
  }

  // Check subscription limits
  const currentSubs = getUserSubscriptionCount(ws);
  if (currentSubs >= MAX_SUBSCRIPTIONS_PER_USER) {
    sendError(ws, msg.id, "LIMIT_EXCEEDED", "Maximum subscriptions reached");
    return;
  }

  hub.subscribe(channel, ws);
  sendAck(ws, msg.id);
}
```

### 2.5 Pub/Sub Rules

- **ALWAYS** clean up subscriptions when a connection closes — call `unsubscribeAll()`
- **ALWAYS** check authorization before allowing subscription to a channel
- **MUST** limit subscriptions per connection to prevent resource abuse
- **ALWAYS** check `readyState === OPEN` before sending to a subscriber
- **MUST** handle slow consumers — drop messages or close the connection
- **NEVER** let the subscription map grow unbounded — clean up empty channels

---

## 3. Room Pattern

An extension of pub/sub where rooms have state (member lists, room metadata, permissions).

### 3.1 Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Room: "team-alpha"                │
│                                                     │
│  Members:                                           │
│    ┌─────────┐ ┌─────────┐ ┌─────────┐             │
│    │ Alice   │ │  Bob    │ │ Carol   │             │
│    │(admin)  │ │(member) │ │(member) │             │
│    └─────────┘ └─────────┘ └─────────┘             │
│                                                     │
│  State:                                             │
│    { name: "Team Alpha", topic: "Sprint planning" } │
│                                                     │
│  Events:                                            │
│    member_joined, member_left, message,              │
│    room_updated, typing                              │
└─────────────────────────────────────────────────────┘
```

### 3.2 Room Implementation

```typescript
interface RoomMember {
  ws: WebSocket;
  userId: string;
  displayName: string;
  role: "admin" | "member" | "viewer";
  joinedAt: Date;
}

class Room {
  readonly id: string;
  private members = new Map<string, RoomMember>();
  private metadata: Record<string, unknown>;

  constructor(id: string, metadata: Record<string, unknown> = {}) {
    this.id = id;
    this.metadata = metadata;
  }

  join(member: RoomMember): void {
    this.members.set(member.userId, member);
    this.broadcast("member_joined", {
      userId: member.userId,
      displayName: member.displayName,
      memberCount: this.members.size,
    });
  }

  leave(userId: string): void {
    const member = this.members.get(userId);
    if (!member) return;
    this.members.delete(userId);
    this.broadcast("member_left", {
      userId,
      displayName: member.displayName,
      memberCount: this.members.size,
    });
  }

  sendMessage(senderId: string, content: unknown): void {
    const sender = this.members.get(senderId);
    if (!sender) return;
    if (sender.role === "viewer") return; // viewers can't send

    this.broadcast("message", {
      senderId,
      senderName: sender.displayName,
      content,
      sentAt: Date.now(),
    });
  }

  broadcast(event: string, data: unknown, excludeUserId?: string): void {
    const message = JSON.stringify({
      type: "event",
      id: generateId(),
      timestamp: Date.now(),
      payload: { channel: `room:${this.id}`, event, data },
    });

    for (const [userId, member] of this.members) {
      if (userId === excludeUserId) continue;
      if (member.ws.readyState === WebSocket.OPEN) {
        member.ws.send(message);
      }
    }
  }

  getMemberList(): Array<{ userId: string; displayName: string; role: string }> {
    return Array.from(this.members.values()).map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      role: m.role,
    }));
  }

  get size(): number {
    return this.members.size;
  }

  get isEmpty(): boolean {
    return this.members.size === 0;
  }
}

class RoomManager {
  private rooms = new Map<string, Room>();

  getOrCreate(roomId: string, metadata?: Record<string, unknown>): Room {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Room(roomId, metadata));
    }
    return this.rooms.get(roomId)!;
  }

  remove(roomId: string): void {
    this.rooms.delete(roomId);
  }

  // Clean up when user disconnects from ALL rooms
  removeUser(userId: string): void {
    for (const [roomId, room] of this.rooms) {
      room.leave(userId);
      if (room.isEmpty) {
        this.rooms.delete(roomId);
      }
    }
  }
}
```

### 3.3 Room Rules

- **ALWAYS** broadcast `member_joined` and `member_left` events to room members
- **ALWAYS** send the current member list to a user when they join a room
- **MUST** clean up all room memberships when a connection drops
- **MUST** delete empty rooms to prevent memory leaks
- **ALWAYS** enforce role-based permissions (who can send, who can only view)
- **LIMIT** room size to prevent broadcast storms

---

## 4. Request-Response Over WebSocket

USE when the client needs to wait for a specific server response. Correlate by message ID.

### 4.1 Pattern

```
Client                                Server
  │                                     │
  │  { type: "rpc",                     │
  │    id: "req-42",                    │
  │    method: "getUser",               │
  │    params: { userId: "abc" } }      │
  │────────────────────────────────────▶│
  │                                     │
  │  { type: "rpc_response",            │
  │    id: "req-42",       ← same ID   │
  │    result: { name: "Alice" } }      │
  │◀────────────────────────────────────│
  │                                     │
```

### 4.2 Client Implementation

```typescript
class WebSocketRPC {
  private ws: WebSocket;
  private pending = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private nextId = 0;

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "rpc_response" || msg.type === "rpc_error") {
        this.handleResponse(msg);
      }
    });
  }

  call(method: string, params: unknown, timeoutMs = 5000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = `rpc-${++this.nextId}`;

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      this.ws.send(JSON.stringify({
        type: "rpc",
        id,
        payload: { method, params },
      }));
    });
  }

  private handleResponse(msg: { type: string; id: string; payload: unknown }): void {
    const pending = this.pending.get(msg.id);
    if (!pending) return; // response for unknown request (timeout already fired)

    clearTimeout(pending.timer);
    this.pending.delete(msg.id);

    if (msg.type === "rpc_error") {
      pending.reject(new Error((msg.payload as any).message));
    } else {
      pending.resolve(msg.payload);
    }
  }
}

// Usage
const rpc = new WebSocketRPC(ws);

try {
  const user = await rpc.call("getUser", { userId: "abc" });
  console.log(user);
} catch (err) {
  console.error("RPC failed:", err.message);
}
```

### 4.3 Server-Side Handler

```typescript
// Server — handle RPC requests
async function handleRPC(ws: WebSocket, msg: RPCMessage): Promise<void> {
  const { method, params } = msg.payload;

  try {
    let result: unknown;
    switch (method) {
      case "getUser":
        result = await getUser(params.userId);
        break;
      case "listChannels":
        result = await listChannels(params);
        break;
      default:
        throw new RPCError("METHOD_NOT_FOUND", `Unknown method: ${method}`);
    }

    ws.send(JSON.stringify({
      type: "rpc_response",
      id: msg.id,
      payload: result,
    }));
  } catch (err) {
    ws.send(JSON.stringify({
      type: "rpc_error",
      id: msg.id,
      payload: {
        code: err instanceof RPCError ? err.code : "INTERNAL_ERROR",
        message: err instanceof RPCError ? err.message : "Internal server error",
      },
    }));
  }
}
```

### 4.4 Request-Response Rules

- **ALWAYS** include a unique `id` in requests and echo it in responses
- **ALWAYS** set a timeout on the client — server may never respond
- **MUST** clean up pending requests on connection close
- **ALWAYS** send either `rpc_response` or `rpc_error` — never leave requests unanswered
- **PREFER** REST/HTTP for request-response patterns — use WebSocket RPC only when the connection is already open
- **LIMIT** concurrent pending requests to prevent memory leaks

---

## 5. Reconnection Strategy

CONNECTIONS WILL DROP. Network glitches, deploys, load balancer timeouts — disconnections are inevitable. ALWAYS implement reconnection.

### 5.1 Exponential Backoff with Jitter

```
Attempt 1: wait 1s    + random(0-500ms)
Attempt 2: wait 2s    + random(0-500ms)
Attempt 3: wait 4s    + random(0-500ms)
Attempt 4: wait 8s    + random(0-500ms)
Attempt 5: wait 16s   + random(0-500ms)
Attempt 6: wait 30s   + random(0-500ms)  ← cap at 30s
Attempt 7: wait 30s   + random(0-500ms)
...
```

### 5.2 Full Reconnection Client

```typescript
class ReconnectingWebSocket {
  private url: string;
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private maxReconnectDelay = 30_000;   // 30s cap
  private baseDelay = 1_000;             // 1s base
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private subscriptions = new Set<string>();  // track for re-subscribe

  onOpen?: () => void;
  onMessage?: (data: string) => void;
  onClose?: (code: number, reason: string) => void;
  onReconnecting?: (attempt: number, delay: number) => void;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.addEventListener("open", () => {
      this.reconnectAttempt = 0; // reset on successful connect
      this.resubscribe();        // re-subscribe to channels
      this.onOpen?.();
    });

    this.ws.addEventListener("message", (event) => {
      this.onMessage?.(event.data);
    });

    this.ws.addEventListener("close", (event) => {
      this.onClose?.(event.code, event.reason);

      if (!this.intentionallyClosed) {
        this.scheduleReconnect();
      }
    });

    this.ws.addEventListener("error", () => {
      // error event always fires before close event — reconnect happens in close handler
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempt++;
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempt - 1),
      this.maxReconnectDelay,
    );
    const jitter = Math.random() * 500;
    const totalDelay = delay + jitter;

    this.onReconnecting?.(this.reconnectAttempt, totalDelay);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, totalDelay);
  }

  private resubscribe(): void {
    // Re-subscribe to all channels after reconnect
    for (const channel of this.subscriptions) {
      this.send(JSON.stringify({
        type: "subscribe",
        id: generateId(),
        payload: { channel },
      }));
    }
  }

  subscribe(channel: string): void {
    this.subscriptions.add(channel);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send(JSON.stringify({
        type: "subscribe",
        id: generateId(),
        payload: { channel },
      }));
    }
  }

  send(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  close(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close(1000, "Client closing");
  }
}
```

### 5.3 Reconnection Rules

- **ALWAYS** implement reconnection with exponential backoff + jitter
- **MUST** cap the maximum reconnect delay (recommended: 30 seconds)
- **MUST** reset the backoff counter on successful reconnection
- **ALWAYS** re-subscribe to channels after reconnection
- **MUST** add jitter to prevent thundering herd when server restarts
- **TRACK** subscriptions client-side for re-subscription after reconnect
- **ALWAYS** distinguish intentional close from unexpected disconnect
- **SHOW** reconnection state to the user (connecting, reconnecting, connected)

---

## 6. Presence Pattern

TRACK which users are online/active in a channel or room.

### 6.1 Presence Architecture

```
┌──────────────────────────────────────────────────┐
│                 Presence System                    │
│                                                  │
│  Channel: "team-alpha"                           │
│  ┌──────────────────────────────────────────┐    │
│  │  Online: Alice (active), Bob (idle)      │    │
│  │  Last seen: Carol (2 min ago)            │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Events:                                         │
│    presence_join  → Alice joined                 │
│    presence_leave → Carol left                   │
│    presence_update → Bob went idle               │
└──────────────────────────────────────────────────┘
```

### 6.2 Implementation

```typescript
interface PresenceInfo {
  userId: string;
  displayName: string;
  status: "active" | "idle" | "away";
  lastSeen: number;
}

class PresenceManager {
  private presence = new Map<string, Map<string, PresenceInfo>>(); // channel → userId → info

  join(channel: string, info: PresenceInfo): void {
    if (!this.presence.has(channel)) {
      this.presence.set(channel, new Map());
    }
    this.presence.get(channel)!.set(info.userId, info);
  }

  leave(channel: string, userId: string): void {
    this.presence.get(channel)?.delete(userId);
    if (this.presence.get(channel)?.size === 0) {
      this.presence.delete(channel);
    }
  }

  updateStatus(channel: string, userId: string, status: PresenceInfo["status"]): void {
    const info = this.presence.get(channel)?.get(userId);
    if (info) {
      info.status = status;
      info.lastSeen = Date.now();
    }
  }

  getPresence(channel: string): PresenceInfo[] {
    return Array.from(this.presence.get(channel)?.values() ?? []);
  }

  leaveAll(userId: string): string[] {
    const channels: string[] = [];
    for (const [channel, members] of this.presence) {
      if (members.has(userId)) {
        members.delete(userId);
        channels.push(channel);
        if (members.size === 0) {
          this.presence.delete(channel);
        }
      }
    }
    return channels; // return affected channels for broadcasting
  }
}
```

### 6.3 Typing Indicators

```typescript
// Client → Server
{ "type": "typing_start", "payload": { "channel": "room:general" } }
{ "type": "typing_stop",  "payload": { "channel": "room:general" } }

// Server → Other clients in channel
{ "type": "event", "payload": {
    "channel": "room:general",
    "event": "typing",
    "data": { "userId": "alice", "displayName": "Alice", "isTyping": true }
}}

// Server-side: auto-expire typing after 5 seconds of no typing_start
class TypingTracker {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  startTyping(channel: string, userId: string, broadcast: () => void, stopBroadcast: () => void): void {
    const key = `${channel}:${userId}`;

    // Clear existing timer
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);

    // Broadcast typing start (only if not already typing)
    if (!this.timers.has(key)) {
      broadcast();
    }

    // Auto-stop after 5s
    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key);
      stopBroadcast();
    }, 5_000));
  }

  stopTyping(channel: string, userId: string): void {
    const key = `${channel}:${userId}`;
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}
```

### 6.4 Presence Rules

- **ALWAYS** send presence list to a user when they join a channel
- **MUST** broadcast `presence_leave` when a connection drops (not just explicit leave)
- **USE** a timeout to detect idle users (e.g., no activity for 5 minutes → status = idle)
- **ALWAYS** auto-expire typing indicators after 5 seconds of no update
- **NEVER** rely on the client to send "leave" — connections drop without warning
- **LIMIT** presence updates frequency to prevent message storms

---

## 7. Error Handling

### 7.1 Error Message Format

```typescript
// Standard error response
interface ErrorPayload {
  code: string;           // machine-readable error code
  message: string;        // human-readable description
  detail?: unknown;       // additional context (optional)
  retryable?: boolean;    // can the client retry?
}

// Error codes
const ERROR_CODES = {
  PARSE_ERROR:      "Message could not be parsed as JSON",
  INVALID_MESSAGE:  "Message does not match expected schema",
  UNKNOWN_TYPE:     "Unknown message type",
  UNAUTHORIZED:     "Authentication required or token expired",
  FORBIDDEN:        "Insufficient permissions for this action",
  NOT_FOUND:        "Requested resource not found",
  RATE_LIMITED:     "Too many messages, slow down",
  INTERNAL_ERROR:   "Server encountered an unexpected error",
  SERVICE_UNAVAILABLE: "Backend service temporarily unavailable",
} as const;
```

### 7.2 Error Handling Rules

- **ALWAYS** return structured error responses with machine-readable codes
- **NEVER** crash the server on malformed client messages
- **ALWAYS** include `retryable` flag to tell clients if they should retry
- **MUST** handle JSON parse errors gracefully — send error response, do not close
- **CLOSE** the connection only for protocol-level violations (non-UTF-8 text, invalid frames)
- **LOG** all errors server-side with connection ID and user ID for debugging

---

## 8. Binary Protocol Design

USE binary protocols for high-throughput, low-latency applications (games, financial data, IoT).

### 8.1 When to Use Binary vs JSON

| Criterion | JSON | Binary (MessagePack/Protobuf/Custom) |
|-----------|------|-------------------------------------|
| Debugging ease | Easy — human readable | Hard — requires tooling |
| Message size | Larger (~2-5x) | Smaller |
| Parse speed | Slower (string parsing) | Faster (typed decoding) |
| Schema enforcement | Runtime only | Compile-time (protobuf) |
| Browser tooling | DevTools readable | Opaque in DevTools |
| Development speed | Fast iteration | Requires schema tooling |

**Decision:**
- **USE** JSON for most applications — debugging ease outweighs size savings
- **USE** binary (protobuf/MessagePack) for high-frequency updates (>100 msg/s) or bandwidth-constrained environments
- **USE** custom binary for ultra-low-latency applications (games with <5ms frame time)

### 8.2 MessagePack Example

```typescript
import * as msgpack from "@msgpack/msgpack";

// Send binary
const data = { type: "position", x: 42.5, y: 100.3, ts: Date.now() };
ws.send(msgpack.encode(data));

// Receive binary
ws.binaryType = "arraybuffer";
ws.addEventListener("message", (event) => {
  if (event.data instanceof ArrayBuffer) {
    const decoded = msgpack.decode(new Uint8Array(event.data));
    console.log(decoded); // { type: "position", x: 42.5, y: 100.3, ts: ... }
  }
});
```

### 8.3 Binary Protocol Rules

- **ALWAYS** set `ws.binaryType = "arraybuffer"` on the client
- **NEVER** mix text and binary frames in the same protocol without clear framing
- **USE** MessagePack for easy migration from JSON (same structure, binary encoding)
- **USE** Protobuf for strict schema enforcement and multi-language support
- **ALWAYS** version your binary protocol — include a version byte in the header

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No message type discriminator | Cannot route or validate messages | ALWAYS include `type` field in every message |
| No request-response correlation | Client cannot match responses to requests | Include unique `id` in requests, echo in response |
| No reconnection logic | Users permanently disconnected on glitches | Implement exponential backoff reconnection |
| No re-subscription after reconnect | Client reconnects but misses events | Track subscriptions, re-subscribe on reconnect |
| Typing indicator without auto-expire | "User is typing..." shown forever | Auto-expire typing after 5s of no update |
| No slow consumer handling | Memory grows, server OOMs | Drop messages or close slow connections |
| Unstructured string messages | Impossible to extend, validate, or route | Use typed JSON envelope with type/id/payload |
| No authorization on subscribe | Users access restricted channels | Check permissions before allowing subscription |
| No acknowledgment of commands | Client doesn't know if action succeeded | Send ack/error for every client command |
| REST for everything + WS for nothing | Over-engineering or under-utilizing | Use WS for pub/sub, use REST for CRUD |
| No presence cleanup on disconnect | Ghost users shown as online | Detect disconnect, broadcast presence_leave |

---

## 10. Enforcement Checklist

- [ ] Message protocol uses typed envelope with `type`, `id`, `payload`
- [ ] Server acknowledges every client command with `ack` or `error`
- [ ] Error responses include machine-readable `code` and `retryable` flag
- [ ] Pub/sub subscriptions cleaned up on connection close
- [ ] Channel authorization checked before allowing subscription
- [ ] Subscription count limited per connection
- [ ] Reconnection implemented with exponential backoff + jitter
- [ ] Client re-subscribes to all channels after reconnect
- [ ] Presence events broadcast on join, leave, and disconnect
- [ ] Typing indicators auto-expire after 5 seconds
- [ ] Message router handles unknown types gracefully
- [ ] Slow consumers detected and handled (drop messages or close)
- [ ] Room memberships cleaned up when user disconnects
- [ ] Request-response pattern uses unique ID correlation
- [ ] RPC calls have client-side timeout
