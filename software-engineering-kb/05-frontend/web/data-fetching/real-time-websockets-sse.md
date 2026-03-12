# Real-Time Communication — Complete Specification

> **AI Plugin Directive:** When a developer asks "WebSocket vs SSE?", "how to implement real-time?", "Socket.IO", "server-sent events", "real-time notifications", "live updates", "chat implementation", "WebSocket scaling", or any real-time communication question, ALWAYS consult this directive. Use SSE for server-to-client streaming (notifications, live feeds, AI responses). Use WebSocket for bidirectional communication (chat, gaming, collaboration). Use Socket.IO only when you need fallback transport and rooms/namespaces. NEVER use WebSocket when SSE suffices — SSE is simpler, works with HTTP/2, and auto-reconnects.

**Core Rule: Choose the SIMPLEST real-time technology that meets your needs. Server-Sent Events (SSE) for unidirectional server→client streaming (notifications, feeds, LLM token streaming). WebSocket for bidirectional real-time (chat, collaboration, gaming). Long polling ONLY as a fallback for environments that block WebSocket. ALWAYS implement reconnection logic, heartbeat/ping-pong, and message queuing for offline resilience. Consider scaling implications early — WebSockets require sticky sessions or a pub/sub layer (Redis).**

---

## 1. Technology Comparison

```
         REAL-TIME TECHNOLOGIES

  ┌──────────────────┬──────────────────┬──────────────────┐
  │ SSE              │ WEBSOCKET        │ LONG POLLING     │
  │ (Server-Sent     │                  │                  │
  │  Events)         │                  │                  │
  ├──────────────────┼──────────────────┼──────────────────┤
  │ Unidirectional   │ Bidirectional    │ Simulated push   │
  │ Server → Client  │ Client ↔ Server │ Client polls     │
  │                  │                  │                  │
  │ HTTP/1.1 or      │ WebSocket        │ HTTP             │
  │ HTTP/2           │ protocol (ws://) │ (repeated GETs)  │
  │                  │                  │                  │
  │ Auto-reconnect   │ Manual reconnect │ No disconnect    │
  │ Event types      │ Raw messages     │ Standard HTTP    │
  │ Text only        │ Text + Binary    │ Any content      │
  │                  │                  │                  │
  │ Simple           │ Complex          │ Simplest         │
  │                  │                  │ (but wasteful)   │
  └──────────────────┴──────────────────┴──────────────────┘

  PROTOCOL COMPARISON:

  SSE:
  Client ───GET /events───→ Server
  Client ←──event: data──── Server  (HTTP stream stays open)
  Client ←──event: data──── Server
  Client ←──event: data──── Server
  (If disconnected, EventSource auto-reconnects)

  WEBSOCKET:
  Client ──HTTP Upgrade──→ Server
  Client ←──101 Switch───── Server
  Client ←──message──────── Server  (Persistent TCP connection)
  Client ───message──────→ Server
  Client ←──message──────── Server
  (Full duplex — both sides send anytime)

  LONG POLLING:
  Client ───GET /poll────→ Server (holds request open)
  Client ←──response──── Server  (responds when data available)
  Client ───GET /poll────→ Server (immediately polls again)
  Client ←──response──── Server
  (Simulates push via repeated requests)
```

---

## 2. Server-Sent Events (SSE)

```typescript
// SERVER — Node.js SSE endpoint
// Express example
import express from 'express';

const app = express();

app.get('/api/events', (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection event
  res.write('event: connected\ndata: {"status":"ok"}\n\n');

  // Send periodic updates
  const interval = setInterval(() => {
    const data = JSON.stringify({
      timestamp: Date.now(),
      value: Math.random(),
    });
    res.write(`data: ${data}\n\n`);
  }, 1000);

  // Send named events
  function sendNotification(notification: Notification) {
    res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
  }

  // Send event with ID (for reconnection resume)
  function sendWithId(id: string, data: unknown) {
    res.write(`id: ${id}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});


// SSE MESSAGE FORMAT:
// event: eventType\n       ← Optional: event name
// id: uniqueId\n           ← Optional: event ID (for resume)
// retry: 5000\n            ← Optional: reconnect delay in ms
// data: {"key":"value"}\n  ← Required: payload (can be multiline)
// \n                       ← Required: blank line terminates message


// CLIENT — EventSource API
const eventSource = new EventSource('/api/events');

// Default 'message' event (when no event type specified)
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Message:', data);
};

// Named events
eventSource.addEventListener('notification', (event) => {
  const notification = JSON.parse(event.data);
  showNotification(notification);
});

eventSource.addEventListener('connected', (event) => {
  console.log('Connected to SSE stream');
});

// Error handling (includes auto-reconnect)
eventSource.onerror = (event) => {
  if (eventSource.readyState === EventSource.CONNECTING) {
    console.log('Reconnecting...');
    // EventSource automatically reconnects!
  } else if (eventSource.readyState === EventSource.CLOSED) {
    console.log('Connection closed permanently');
  }
};

// Close connection
eventSource.close();


// SSE WITH AUTHENTICATION (EventSource doesn't support headers)
// Option 1: Query parameter (less secure)
const es = new EventSource('/api/events?token=abc123');

// Option 2: Cookie-based auth (recommended)
// Server sets HttpOnly cookie, EventSource sends it automatically

// Option 3: Use fetch with ReadableStream (more control)
async function sseWithFetch(url: string, token: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    // Parse SSE format manually
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        handleEvent(data);
      }
    }
  }
}
```

### 2.1 SSE for AI/LLM Token Streaming

```typescript
// Streaming LLM responses (ChatGPT-style token-by-token)

// Server — Stream AI response
app.post('/api/chat', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  const { messages } = req.body;

  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

// Client — Display streaming tokens
async function streamChat(messages: Message[]) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n').filter(l => l.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') return fullText;

      const { content } = JSON.parse(data);
      fullText += content;
      updateUI(fullText); // Update text character by character
    }
  }

  return fullText;
}
```

---

## 3. WebSocket

```typescript
// SERVER — WebSocket with ws library
import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

// Track connected clients
const clients = new Map<string, WebSocket>();

wss.on('connection', (ws, request) => {
  const userId = getUserFromRequest(request);
  clients.set(userId, ws);

  console.log(`Client connected: ${userId}`);

  // Handle incoming messages
  ws.on('message', (rawData) => {
    try {
      const message = JSON.parse(rawData.toString());

      switch (message.type) {
        case 'chat':
          broadcastToRoom(message.roomId, {
            type: 'chat',
            userId,
            text: message.text,
            timestamp: Date.now(),
          });
          break;

        case 'typing':
          broadcastToRoom(message.roomId, {
            type: 'typing',
            userId,
          }, [userId]); // Exclude sender
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    clients.delete(userId);
    console.log(`Client disconnected: ${userId}`);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${userId}:`, error);
    clients.delete(userId);
  });

  // Send welcome message
  ws.send(JSON.stringify({ type: 'welcome', userId }));
});

// Broadcast to all clients in a room
function broadcastToRoom(roomId: string, data: unknown, exclude: string[] = []) {
  const message = JSON.stringify(data);
  for (const [userId, ws] of clients) {
    if (!exclude.includes(userId) && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

// Heartbeat — detect dead connections
setInterval(() => {
  for (const [userId, ws] of clients) {
    if (ws.readyState !== WebSocket.OPEN) {
      clients.delete(userId);
      continue;
    }
    ws.ping(); // Client auto-responds with pong
  }
}, 30000);


// CLIENT — WebSocket with reconnection
class ReconnectingWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private messageQueue: string[] = [];
  private handlers = new Map<string, Set<(data: any) => void>>();

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;

      // Flush queued messages
      while (this.messageQueue.length > 0) {
        this.ws!.send(this.messageQueue.shift()!);
      }
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const handlers = this.handlers.get(message.type);
      handlers?.forEach(handler => handler(message));
    };

    this.ws.onclose = () => {
      this.reconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }

  on(type: string, handler: (data: any) => void) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  send(data: unknown) {
    const message = JSON.stringify(data);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      this.messageQueue.push(message); // Queue if disconnected
    }
  }

  close() {
    this.maxReconnectAttempts = 0; // Prevent reconnection
    this.ws?.close();
  }
}

// Usage
const socket = new ReconnectingWebSocket('wss://api.example.com/ws');

socket.on('chat', (data) => {
  displayMessage(data.userId, data.text);
});

socket.on('typing', (data) => {
  showTypingIndicator(data.userId);
});

socket.send({ type: 'chat', roomId: 'general', text: 'Hello!' });
```

---

## 4. Socket.IO

```typescript
// Socket.IO adds: rooms, namespaces, auto-reconnect, fallback transport

// SERVER
import { Server } from 'socket.io';

const io = new Server(httpServer, {
  cors: { origin: 'https://example.com' },
  pingInterval: 25000,   // Heartbeat every 25s
  pingTimeout: 20000,    // Consider dead after 20s no pong
});

// Namespaces (virtual separation)
const chatNs = io.of('/chat');
const adminNs = io.of('/admin');

// Authentication middleware
chatNs.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    socket.data.user = verifyToken(token);
    next();
  } catch {
    next(new Error('Authentication failed'));
  }
});

chatNs.on('connection', (socket) => {
  const user = socket.data.user;

  // Join a room
  socket.on('join-room', (roomId: string) => {
    socket.join(roomId);
    chatNs.to(roomId).emit('user-joined', { userId: user.id, name: user.name });
  });

  // Send message to room
  socket.on('message', (data: { roomId: string; text: string }) => {
    chatNs.to(data.roomId).emit('message', {
      userId: user.id,
      name: user.name,
      text: data.text,
      timestamp: Date.now(),
    });
  });

  // Typing indicator (broadcast to room except sender)
  socket.on('typing', (roomId: string) => {
    socket.to(roomId).emit('typing', { userId: user.id, name: user.name });
  });

  // Acknowledgments (request-response pattern)
  socket.on('send-message', (data, callback) => {
    const saved = saveMessage(data);
    callback({ status: 'ok', id: saved.id }); // Confirm to sender
  });

  socket.on('disconnect', (reason) => {
    console.log(`${user.name} disconnected: ${reason}`);
  });
});


// CLIENT
import { io } from 'socket.io-client';

const socket = io('https://api.example.com/chat', {
  auth: { token: getAuthToken() },
  reconnection: true,           // Auto-reconnect
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  socket.emit('join-room', 'general');
});

socket.on('message', (data) => {
  displayMessage(data);
});

// With acknowledgment
socket.emit('send-message', { roomId: 'general', text: 'Hi!' }, (response) => {
  console.log('Server confirmed:', response.id);
});

socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    socket.connect(); // Server disconnected — reconnect manually
  }
  // Otherwise Socket.IO auto-reconnects
});
```

---

## 5. Scaling WebSockets

```
SCALING WEBSOCKETS — THE CHALLENGE:

  PROBLEM: WebSocket connections are STATEFUL.
  Each connection lives on ONE server.
  Load balancer can't route messages between servers.

  SINGLE SERVER:
  ┌──────────────────────┐
  │ Server A             │
  │ User 1 ──ws──┐       │
  │ User 2 ──ws──┤ Room 1│  ← All users on same server: works fine
  │ User 3 ──ws──┘       │
  └──────────────────────┘

  MULTIPLE SERVERS (PROBLEM):
  ┌──────────────────────┐   ┌──────────────────────┐
  │ Server A             │   │ Server B             │
  │ User 1 ──ws── Room 1│   │ User 2 ──ws── Room 1│
  │ User 3 ──ws── Room 1│   │ User 4 ──ws── Room 1│
  └──────────────────────┘   └──────────────────────┘
  User 1 sends message → Only User 3 receives (same server)
  User 2 and User 4 MISS the message! ❌

  SOLUTION: Redis Pub/Sub as message broker
  ┌──────────────────────┐   ┌──────────────────────┐
  │ Server A             │   │ Server B             │
  │ User 1 ──ws──┐       │   │ User 2 ──ws──┐       │
  │ User 3 ──ws──┘       │   │ User 4 ──ws──┘       │
  └─────────┬────────────┘   └─────────┬────────────┘
            │                           │
            └─────────┬────────────────┘
                      │
              ┌───────▼───────┐
              │    REDIS      │
              │   Pub/Sub     │
              └───────────────┘
  User 1 sends → Server A publishes to Redis →
  Server B subscribes → delivers to User 2 & User 4 ✅
```

```typescript
// Socket.IO with Redis adapter (horizontal scaling)
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: 'redis://redis:6379' });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

const io = new Server(httpServer);
io.adapter(createAdapter(pubClient, subClient));

// Now io.to('room').emit() works across ALL server instances!
// Redis pub/sub handles cross-server message delivery

// STICKY SESSIONS (Alternative for simpler setups)
// Load balancer routes same client to same server
// Nginx: ip_hash; or cookie-based routing
// Simpler but limits scaling flexibility
```

---

## 6. Decision Tree

```
REAL-TIME TECHNOLOGY DECISION:

  START: What direction does data flow?
    │
    ├── Server → Client only (notifications, feeds, LLM streaming)
    │   └── SSE ✅ (simplest, auto-reconnect, HTTP/2 multiplexing)
    │
    ├── Client ↔ Server (chat, collaboration, gaming)
    │   │
    │   ├── Need rooms, namespaces, fallback transport?
    │   │   YES → Socket.IO ✅
    │   │   NO → Native WebSocket ✅ (less overhead)
    │   │
    │   └── Need binary data? (files, audio, video)
    │       YES → WebSocket ✅ (supports binary frames)
    │       SSE: Text only
    │
    └── Environments blocking WebSocket? (corporate proxies, old infra)
        YES → Long Polling or Socket.IO (auto-fallback)


  COMMON USE CASES:
  ┌──────────────────────────┬──────────────────────┐
  │ Use Case                 │ Best Technology       │
  ├──────────────────────────┼──────────────────────┤
  │ Notifications            │ SSE                   │
  │ Live feed / activity     │ SSE                   │
  │ LLM token streaming      │ SSE (fetch + stream)  │
  │ Stock prices / live data │ SSE or WebSocket      │
  │ Chat                     │ WebSocket / Socket.IO │
  │ Collaborative editing    │ WebSocket + CRDT      │
  │ Multiplayer gaming       │ WebSocket             │
  │ File transfer            │ WebSocket (binary)    │
  │ IoT device communication │ WebSocket / MQTT      │
  │ Dashboard real-time      │ SSE (polling ok too)  │
  └──────────────────────────┴──────────────────────┘
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **WebSocket when SSE suffices** | Unnecessary complexity for unidirectional data flow | Use SSE for server→client streaming (simpler, auto-reconnect, HTTP/2) |
| **No reconnection logic** | Client disconnects and never recovers; user refreshes page | Implement exponential backoff reconnection (or use SSE/Socket.IO auto-reconnect) |
| **No heartbeat/ping-pong** | Dead connections consuming resources; messages lost silently | Implement ping-pong every 30s; terminate connections that don't respond |
| **Sending unbounded data** | Memory exhaustion on client or server from infinite stream | Implement backpressure, rate limiting, and message size limits |
| **No message queuing** | Messages lost during brief disconnections | Queue messages and replay on reconnect (with message IDs) |
| **WebSocket without SSL** | Connection blocked by proxies, intercepted, insecure | ALWAYS use `wss://` (WebSocket Secure) in production |
| **Scaling WebSocket without pub/sub** | Messages don't reach users on different server instances | Use Redis pub/sub adapter (Socket.IO adapter, or manual pub/sub) |
| **Polling for real-time in modern apps** | High latency, wasted bandwidth, unnecessary server load | Use SSE or WebSocket — polling only as last resort fallback |
| **Not handling backpressure** | Server sends faster than client can process; OOM | Monitor client buffer, pause sending when client falls behind |

---

## 8. Enforcement Checklist

### SSE
- [ ] `text/event-stream` Content-Type set correctly
- [ ] `Cache-Control: no-cache` set to prevent caching
- [ ] Event IDs sent for reconnection resume
- [ ] `retry` field configured for reconnection delay
- [ ] Named events used for different message types
- [ ] Connection cleanup on client disconnect

### WebSocket
- [ ] `wss://` used in production (SSL required)
- [ ] Reconnection with exponential backoff implemented
- [ ] Heartbeat/ping-pong every 30 seconds
- [ ] Message validation on server (never trust client data)
- [ ] Connection limits per user/IP configured
- [ ] Message size limits enforced

### Scaling
- [ ] Redis pub/sub or equivalent for multi-server message delivery
- [ ] Sticky sessions OR pub/sub adapter configured at load balancer
- [ ] Connection count monitored and alerting configured
- [ ] Graceful shutdown drains connections before server stops

### General
- [ ] Authentication handled at connection time (not per-message)
- [ ] Rate limiting applied to prevent abuse
- [ ] Offline message queue with replay on reconnect
- [ ] Error handling and logging for connection failures
- [ ] Client-side connection status indicator (connected/reconnecting/offline)
