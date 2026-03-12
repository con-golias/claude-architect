# WebSocket Patterns

> **AI Plugin Directive — WebSocket Server Implementation & Connection Management**
> You are an AI coding assistant. When generating, reviewing, or refactoring WebSocket code,
> follow EVERY rule in this document. Poorly implemented WebSockets cause connection leaks,
> memory exhaustion, and message loss. Treat each section as non-negotiable.

**Core Rule: ALWAYS authenticate on connection (not per-message). ALWAYS implement heartbeat/ping-pong. ALWAYS handle reconnection gracefully. ALWAYS limit concurrent connections per user. ALWAYS use rooms/channels for targeted broadcasting.**

---

## 1. WebSocket Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│              WebSocket Connection Lifecycle                    │
│                                                               │
│  1. HTTP Upgrade request (include auth token)               │
│  2. Server validates auth → accept or reject                │
│  3. Connection established                                   │
│  4. Heartbeat: server sends PING every 30s                  │
│     └── Client responds PONG within 10s or disconnect       │
│  5. Messages exchanged (JSON with type field)               │
│  6. Connection closed (clean or unexpected)                  │
│     ├── Clean: close frame → cleanup                        │
│     └── Unexpected: heartbeat timeout → cleanup             │
│  7. Client reconnects with exponential backoff              │
│                                                               │
│  ALWAYS authenticate during upgrade (step 2)                │
│  NEVER authenticate per-message                              │
│  ALWAYS clean up resources on disconnect                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript Implementation (ws)

```typescript
import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ noServer: true });

// Authenticate during HTTP upgrade
server.on("upgrade", async (req, socket, head) => {
  try {
    const token = new URL(req.url!, `http://${req.headers.host}`).searchParams.get("token");
    const user = await verifyToken(token!);

    wss.handleUpgrade(req, socket, head, (ws) => {
      (ws as any).userId = user.id;
      (ws as any).isAlive = true;
      wss.emit("connection", ws, req);
    });
  } catch {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

// Heartbeat: ping every 30s, drop dead connections
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!(ws as any).isAlive) { ws.terminate(); return; }
    (ws as any).isAlive = false;
    ws.ping();
  });
}, 30_000);

wss.on("connection", (ws) => {
  ws.on("pong", () => { (ws as any).isAlive = true; });

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    switch (msg.type) {
      case "subscribe": joinRoom(ws, msg.room); break;
      case "unsubscribe": leaveRoom(ws, msg.room); break;
      case "message": broadcastToRoom(msg.room, msg.data, ws); break;
    }
  });

  ws.on("close", () => { cleanupConnection(ws); });
});

// Room management
const rooms = new Map<string, Set<WebSocket>>();

function broadcastToRoom(room: string, data: unknown, exclude?: WebSocket): void {
  const members = rooms.get(room);
  if (!members) return;
  const payload = JSON.stringify({ type: "message", room, data });
  for (const ws of members) {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}
```

---

## 3. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Auth per message | Wasted CPU, can be bypassed | Auth on upgrade only |
| No heartbeat | Dead connections accumulate | Ping/pong every 30s |
| No connection limit | Memory exhaustion | Max connections per user |
| Broadcast to all | Wasted bandwidth | Room/channel targeting |
| No reconnection backoff | Reconnect storm | Exponential backoff |
| No message type field | Cannot route messages | `{ type, data }` envelope |

---

## 4. Enforcement Checklist

- [ ] Authentication performed during HTTP upgrade
- [ ] Heartbeat ping/pong every 30 seconds
- [ ] Dead connections terminated on missed pong
- [ ] Room/channel system for targeted broadcasting
- [ ] Max concurrent connections per user enforced
- [ ] Clean resource cleanup on disconnect
- [ ] Message envelope with type field for routing
- [ ] Reconnection with exponential backoff on client
