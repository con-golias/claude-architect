# WebSocket Protocol & Fundamentals

> **AI Plugin Directive:** When implementing, reviewing, or debugging WebSocket connections, APPLY every rule in this document. USE the correct upgrade handshake, frame format, ping/pong heartbeat, and close procedures defined here. NEVER generate WebSocket code that skips origin validation, ignores close handshakes, or mishandles binary frames. This is the master reference for all WebSocket protocol decisions.

**Core Rule: ALWAYS validate the Origin header on upgrade. ALWAYS implement ping/pong heartbeat to detect dead connections. ALWAYS handle the close handshake gracefully. NEVER send unbounded messages without flow control. NEVER store session state only in-memory without a persistence/broadcast layer for horizontal scaling.**

---

## 1. WebSocket Protocol Architecture

WebSocket (RFC 6455) provides full-duplex communication over a single TCP connection. It starts as an HTTP/1.1 upgrade request and then switches to a persistent binary frame protocol.

### 1.1 Protocol Stack

```
┌─────────────────────────────────────────────────┐
│                APPLICATION                       │
│         (your messages — JSON, binary)           │
├─────────────────────────────────────────────────┤
│              WEBSOCKET FRAMING                   │
│    ┌────────┬────────┬──────────┬──────────┐    │
│    │ FIN(1) │OPC(4)  │MASK(1)  │LENGTH    │    │
│    │        │        │         │(7/16/64) │    │
│    ├────────┴────────┴──────────┴──────────┤    │
│    │          PAYLOAD DATA                  │    │
│    └────────────────────────────────────────┘    │
├─────────────────────────────────────────────────┤
│                   TLS (wss://)                   │
├─────────────────────────────────────────────────┤
│                     TCP                          │
└─────────────────────────────────────────────────┘
```

### 1.2 WebSocket vs HTTP Comparison

| Aspect | HTTP | WebSocket |
|--------|------|-----------|
| **Direction** | Client → Server (request-response) | Full-duplex (both directions simultaneously) |
| **Connection** | New connection per request (HTTP/1.1) or multiplexed (HTTP/2) | Single persistent TCP connection |
| **Overhead** | Headers on every request (~200-2000 bytes) | 2-14 bytes per frame after upgrade |
| **Initiation** | Client always initiates | Either side can send at any time |
| **State** | Stateless by design | Stateful — connection persists |
| **Protocol** | Text-based (HTTP/1.1) or binary (HTTP/2) | Binary framing |
| **Caching** | Built-in (Cache-Control, ETag) | Not cacheable |
| **URL scheme** | `http://` / `https://` | `ws://` / `wss://` |

### 1.3 When WebSocket Is the Right Choice

```
Need real-time, bidirectional, low-latency communication?
    │
    ├─ Server needs to push to client? ─────┐
    │                                        │
    ├─ Client needs to send frequently? ─────┤
    │                                        ├──▶ WebSocket ✓
    ├─ Both sides send independently? ───────┤
    │                                        │
    ├─ Sub-100ms latency required? ──────────┘
    │
    └─ None of the above? ──────────────────▶ Use HTTP/SSE instead
```

---

## 2. The Upgrade Handshake

EVERY WebSocket connection starts as an HTTP/1.1 request with an `Upgrade` header. UNDERSTAND this handshake — it is where authentication and validation happen.

### 2.1 Handshake Sequence

```
Client                                          Server
  │                                               │
  │  GET /ws HTTP/1.1                              │
  │  Host: example.com                             │
  │  Upgrade: websocket                            │
  │  Connection: Upgrade                           │
  │  Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==  │
  │  Sec-WebSocket-Version: 13                     │
  │  Sec-WebSocket-Protocol: graphql-ws            │
  │  Origin: https://app.example.com               │
  │ ──────────────────────────────────────────────▶│
  │                                               │
  │  HTTP/1.1 101 Switching Protocols              │
  │  Upgrade: websocket                            │
  │  Connection: Upgrade                           │
  │  Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRb │
  │  Sec-WebSocket-Protocol: graphql-ws            │
  │◀──────────────────────────────────────────────│
  │                                               │
  │  ═══════ WebSocket frames ═══════              │
  │◀═════════════════════════════════════════════▶│
  │                                               │
```

### 2.2 Key Handshake Headers

| Header | Direction | Purpose | Required |
|--------|-----------|---------|----------|
| `Upgrade: websocket` | Request | Signal protocol switch | Yes |
| `Connection: Upgrade` | Request | Signal connection upgrade | Yes |
| `Sec-WebSocket-Key` | Request | Random 16-byte base64 nonce | Yes |
| `Sec-WebSocket-Version` | Request | Protocol version (MUST be 13) | Yes |
| `Sec-WebSocket-Protocol` | Request | Subprotocol negotiation | No |
| `Sec-WebSocket-Extensions` | Request | Extension negotiation (permessage-deflate) | No |
| `Origin` | Request | Client origin for CORS-like validation | Yes (browsers) |
| `Sec-WebSocket-Accept` | Response | SHA-1 hash proving server understood key | Yes |
| `Sec-WebSocket-Protocol` | Response | Selected subprotocol | If requested |

### 2.3 Sec-WebSocket-Accept Calculation

The server MUST compute this value correctly — clients reject connections otherwise.

```
Sec-WebSocket-Accept = Base64(SHA-1(Sec-WebSocket-Key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
```

**The GUID `258EAFA5-E914-47DA-95CA-C5AB0DC85B11` is a fixed magic string defined in RFC 6455.**

### 2.4 Subprotocol Negotiation

USE subprotocols to define the application-level message format.

```
Client request:
  Sec-WebSocket-Protocol: graphql-ws, graphql-transport-ws

Server response (picks one):
  Sec-WebSocket-Protocol: graphql-transport-ws
```

Common subprotocols:
- `graphql-ws` — legacy GraphQL over WebSocket
- `graphql-transport-ws` — modern GraphQL over WebSocket
- `mqtt` — MQTT over WebSocket
- `stomp` — STOMP messaging protocol
- `wamp` — Web Application Messaging Protocol

### 2.5 Handshake Rules

- **ALWAYS** validate the `Origin` header — reject connections from unauthorized origins
- **MUST** respond with HTTP 101 and correct `Sec-WebSocket-Accept` hash
- **MUST** use `Sec-WebSocket-Version: 13` — it is the only standard version
- **ALWAYS** authenticate during the handshake (via cookies, tokens in query string, or first message)
- **NEVER** accept WebSocket upgrades on arbitrary paths — define explicit upgrade endpoints
- **USE** subprotocol negotiation when multiple message formats are possible

---

## 3. Frame Format

UNDERSTAND the wire format — it determines performance characteristics and security behavior.

### 3.1 Frame Structure

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
├─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┤
│F│R│R│R│  Opcode │M│    Payload Length    │  Extended Payload      │
│I│S│S│S│  (4)    │A│       (7)           │  Length (16 or 64)     │
│N│V│V│V│         │S│                     │  (if payload len       │
│ │1│2│3│         │K│                     │   == 126 or 127)       │
├─┴─┴─┴─┴─────────┼─┴─────────────────────┴────────────────────────┤
│                  │  Masking Key (0 or 4 bytes)                    │
│                  │  (present if MASK bit is 1)                    │
├──────────────────┴────────────────────────────────────────────────┤
│                       Payload Data                                │
│                    (Extension data + Application data)            │
└───────────────────────────────────────────────────────────────────┘
```

### 3.2 Opcodes

| Opcode | Hex | Type | Purpose |
|--------|-----|------|---------|
| 0 | 0x0 | Continuation | Continues a fragmented message |
| 1 | 0x1 | Text | UTF-8 text data |
| 2 | 0x2 | Binary | Binary data |
| 3-7 | — | Reserved | Reserved for future non-control frames |
| 8 | 0x8 | Close | Connection close |
| 9 | 0x9 | Ping | Heartbeat ping |
| 10 | 0xA | Pong | Heartbeat pong |
| 11-15 | — | Reserved | Reserved for future control frames |

### 3.3 Payload Length Encoding

```
If payload length (7 bits) = 0-125:
    Actual length = value
    Total header = 2 bytes (+ 4 if masked)

If payload length = 126:
    Next 2 bytes = actual length (16-bit unsigned)
    Max: 65,535 bytes
    Total header = 4 bytes (+ 4 if masked)

If payload length = 127:
    Next 8 bytes = actual length (64-bit unsigned)
    Max: 2^63 bytes (practically unlimited)
    Total header = 10 bytes (+ 4 if masked)
```

### 3.4 Masking

```
CLIENT → SERVER:  MUST be masked   (MASK bit = 1, 4-byte masking key)
SERVER → CLIENT:  MUST NOT be masked (MASK bit = 0)

Masking algorithm:
  masked_byte[i] = original_byte[i] XOR masking_key[i % 4]

Purpose: Prevent proxy cache poisoning attacks
```

### 3.5 Message Fragmentation

Large messages can be split across multiple frames.

```
First fragment:   FIN=0, opcode=text(1) or binary(2), payload
Continuation:     FIN=0, opcode=continuation(0), payload
Final fragment:   FIN=1, opcode=continuation(0), payload
```

### 3.6 Frame Rules

- **MUST** mask all client-to-server frames — unmasked client frames cause server to close connection
- **MUST NOT** mask server-to-client frames
- **ALWAYS** set FIN=1 for complete single-frame messages
- **MUST** support receiving fragmented messages
- **CONTROL** frames (ping, pong, close) MUST NOT be fragmented
- **CONTROL** frames MUST have payload ≤ 125 bytes
- **MUST** respond to ping with pong containing the same payload

---

## 4. Ping/Pong Heartbeat

ALWAYS implement heartbeat. Without it, dead connections accumulate and leak resources.

### 4.1 Heartbeat Architecture

```
Client                           Server
  │                                │
  │                                │── Ping (every 30s)
  │◀── Ping ───────────────────────│
  │                                │
  │── Pong ───────────────────────▶│   ← client MUST respond
  │                                │
  │         ... 30 seconds ...     │
  │                                │── Ping
  │◀── Ping ───────────────────────│
  │                                │
  │    (no pong within 10s)        │
  │                                │── Connection considered dead
  │                                │── Close connection
  │                                │
```

### 4.2 Node.js Implementation (ws)

```typescript
import WebSocket, { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

// Track alive status
wss.on("connection", (ws: WebSocket) => {
  (ws as any).isAlive = true;

  ws.on("pong", () => {
    (ws as any).isAlive = true; // received pong — connection is alive
  });

  ws.on("message", (data: Buffer) => {
    // handle messages
  });
});

// Heartbeat interval — ping every 30 seconds
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if ((ws as any).isAlive === false) {
      // No pong received since last ping — terminate
      return ws.terminate();
    }

    (ws as any).isAlive = false; // reset — will be set true by pong
    ws.ping(); // send ping frame
  });
}, 30_000);

wss.on("close", () => {
  clearInterval(heartbeat);
});
```

### 4.3 Go Implementation (gorilla/websocket)

```go
const (
    pingInterval = 30 * time.Second
    pongTimeout  = 10 * time.Second
    writeTimeout = 10 * time.Second
)

func handleConnection(conn *websocket.Conn) {
    defer conn.Close()

    // Set pong handler — resets read deadline on pong
    conn.SetReadDeadline(time.Now().Add(pingInterval + pongTimeout))
    conn.SetPongHandler(func(string) error {
        conn.SetReadDeadline(time.Now().Add(pingInterval + pongTimeout))
        return nil
    })

    // Ping ticker
    ticker := time.NewTicker(pingInterval)
    defer ticker.Stop()

    // Read loop
    go func() {
        for {
            _, message, err := conn.ReadMessage()
            if err != nil {
                return // connection closed or error
            }
            handleMessage(message)
        }
    }()

    // Write loop — sends pings
    for {
        select {
        case <-ticker.C:
            conn.SetWriteDeadline(time.Now().Add(writeTimeout))
            if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
                return // connection dead
            }
        }
    }
}
```

### 4.4 Python Implementation (websockets)

```python
import asyncio
import websockets

async def handler(websocket):
    # websockets library handles ping/pong automatically
    # Configure via ping_interval and ping_timeout
    async for message in websocket:
        await process_message(websocket, message)

async def main():
    async with websockets.serve(
        handler,
        "0.0.0.0",
        8080,
        ping_interval=30,    # send ping every 30s
        ping_timeout=10,     # wait 10s for pong
    ) as server:
        await asyncio.Future()  # run forever

asyncio.run(main())
```

### 4.5 Heartbeat Rules

- **ALWAYS** implement server-side ping at regular intervals (recommended: 25-30 seconds)
- **MUST** terminate connections that fail to respond to ping within timeout (recommended: 10 seconds)
- **NEVER** rely solely on TCP keepalive — many middleboxes drop idle WebSocket connections
- **KEEP** ping interval below proxy/load balancer idle timeout (typically 60s)
- **MUST** respond to pings with pong containing the same application data
- **TRACK** last pong time per connection for monitoring and debugging

---

## 5. Close Handshake

The WebSocket close is a two-step handshake. ALWAYS close gracefully — abrupt termination loses data.

### 5.1 Close Sequence

```
Initiator                         Responder
  │                                  │
  │── Close Frame ──────────────────▶│
  │   (status code + reason)         │
  │                                  │── Process remaining messages
  │◀── Close Frame ──────────────────│
  │   (echoed or own status code)    │
  │                                  │
  │   TCP connection closed          │
  │                                  │
```

### 5.2 Close Status Codes

| Code | Name | Meaning |
|------|------|---------|
| 1000 | Normal Closure | Endpoint fulfilled its purpose — clean close |
| 1001 | Going Away | Server shutting down or client navigating away |
| 1002 | Protocol Error | Protocol violation detected |
| 1003 | Unsupported Data | Received data type not supported |
| 1005 | No Status Received | No close code was present (reserved — MUST NOT send) |
| 1006 | Abnormal Closure | Connection closed without close frame (reserved — MUST NOT send) |
| 1007 | Invalid Payload | Text frame contained non-UTF-8 data |
| 1008 | Policy Violation | Generic policy violation |
| 1009 | Message Too Big | Message exceeds size limit |
| 1010 | Mandatory Extension | Client expected extension negotiation |
| 1011 | Internal Error | Server encountered unexpected condition |
| 1012 | Service Restart | Server restarting — client should reconnect |
| 1013 | Try Again Later | Server overloaded — client should reconnect with backoff |
| 1014 | Bad Gateway | Gateway/proxy received invalid response |
| 1015 | TLS Handshake | TLS handshake failure (reserved — MUST NOT send) |
| 4000-4999 | Application-defined | Custom codes for your application |

### 5.3 Graceful Server Shutdown

```typescript
// Node.js — graceful shutdown
function gracefulShutdown(wss: WebSocketServer): void {
  // 1. Stop accepting new connections
  wss.close();

  // 2. Send close to all connected clients
  wss.clients.forEach((ws) => {
    ws.close(1012, "Server restarting");
  });

  // 3. Wait for clients to close (with timeout)
  const forceCloseTimeout = setTimeout(() => {
    wss.clients.forEach((ws) => {
      ws.terminate(); // force close remaining connections
    });
  }, 10_000); // 10s grace period

  wss.on("close", () => {
    clearTimeout(forceCloseTimeout);
    process.exit(0);
  });
}

process.on("SIGTERM", () => gracefulShutdown(wss));
process.on("SIGINT", () => gracefulShutdown(wss));
```

```go
// Go — graceful shutdown
func gracefulShutdown(connections map[*websocket.Conn]bool) {
    closeMsg := websocket.FormatCloseMessage(
        websocket.CloseServiceRestart, "server restarting",
    )
    for conn := range connections {
        conn.WriteControl(
            websocket.CloseMessage, closeMsg,
            time.Now().Add(5*time.Second),
        )
    }
    time.Sleep(5 * time.Second)
    for conn := range connections {
        conn.Close()
    }
}
```

### 5.4 Close Rules

- **ALWAYS** send a close frame before terminating — never just drop TCP
- **MUST** respond to a received close frame with a close frame
- **ALWAYS** include a meaningful status code (1000 for normal, 1001 for going away, etc.)
- **USE** codes 4000-4999 for application-specific close reasons
- **NEVER** send codes 1005, 1006, or 1015 — they are reserved for reporting only
- **MUST** implement graceful shutdown: stop new connections → close existing → force after timeout

---

## 6. Browser WebSocket API

UNDERSTAND the browser API — it is the primary client interface.

### 6.1 Basic Usage

```typescript
// Create connection
const ws = new WebSocket("wss://api.example.com/ws");

// Connection opened
ws.addEventListener("open", () => {
  console.log("Connected");
  ws.send(JSON.stringify({ type: "subscribe", channel: "orders" }));
});

// Message received
ws.addEventListener("message", (event: MessageEvent) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data);
});

// Connection closed
ws.addEventListener("close", (event: CloseEvent) => {
  console.log(`Closed: code=${event.code} reason=${event.reason} clean=${event.wasClean}`);
});

// Error occurred
ws.addEventListener("error", (event: Event) => {
  console.error("WebSocket error:", event);
});
```

### 6.2 ReadyState Values

| Value | Constant | Meaning |
|-------|----------|---------|
| 0 | `WebSocket.CONNECTING` | Connection not yet established |
| 1 | `WebSocket.OPEN` | Connection established, ready to send |
| 2 | `WebSocket.CLOSING` | Close handshake in progress |
| 3 | `WebSocket.CLOSED` | Connection closed or could not be opened |

### 6.3 Sending Data

```typescript
// Send text
ws.send(JSON.stringify({ type: "message", text: "Hello" }));

// Send binary
const buffer = new ArrayBuffer(8);
const view = new DataView(buffer);
view.setFloat64(0, 42.0);
ws.send(buffer);

// Send Blob
const blob = new Blob(["data"], { type: "application/octet-stream" });
ws.send(blob);

// CHECK readyState before sending
function safeSend(ws: WebSocket, data: string): boolean {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(data);
    return true;
  }
  return false;
}
```

### 6.4 Binary Data Handling

```typescript
// Set binary type BEFORE receiving binary data
ws.binaryType = "arraybuffer"; // or "blob" (default)

ws.addEventListener("message", (event: MessageEvent) => {
  if (typeof event.data === "string") {
    // Text frame
    handleTextMessage(JSON.parse(event.data));
  } else if (event.data instanceof ArrayBuffer) {
    // Binary frame (when binaryType = "arraybuffer")
    handleBinaryMessage(new DataView(event.data));
  } else if (event.data instanceof Blob) {
    // Binary frame (when binaryType = "blob")
    event.data.arrayBuffer().then((buf) => handleBinaryMessage(new DataView(buf)));
  }
});
```

### 6.5 Browser API Rules

- **ALWAYS** check `ws.readyState === WebSocket.OPEN` before calling `send()`
- **ALWAYS** add `error` event listener — unhandled WS errors are silent
- **SET** `ws.binaryType = "arraybuffer"` for binary protocols — it is more efficient than Blob
- **NEVER** call `ws.send()` in the `open` event of a different WebSocket instance
- **ALWAYS** handle the `close` event for reconnection logic
- **USE** `event.wasClean` to determine if the close was graceful

---

## 7. Server Implementations

### 7.1 Node.js (ws library)

```typescript
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { parse } from "url";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const { query } = parse(req.url || "", true);
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  console.log(`New connection from ${ip}`);

  ws.on("message", (data: Buffer, isBinary: boolean) => {
    if (isBinary) {
      handleBinary(ws, data);
    } else {
      handleText(ws, data.toString("utf8"));
    }
  });

  ws.on("close", (code: number, reason: Buffer) => {
    console.log(`Connection closed: ${code} ${reason.toString()}`);
  });

  ws.on("error", (err: Error) => {
    console.error("Connection error:", err.message);
  });
});

// Configure server options
const wssConfigured = new WebSocketServer({
  port: 8080,
  maxPayload: 1 * 1024 * 1024,    // 1MB max message size
  backlog: 100,                     // TCP backlog
  perMessageDeflate: {              // compression
    zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 3 },
    threshold: 1024,                // compress messages > 1KB
  },
  verifyClient: (info, callback) => {
    // Origin validation
    const origin = info.origin;
    const allowed = ["https://app.example.com", "https://admin.example.com"];
    if (!allowed.includes(origin)) {
      callback(false, 403, "Forbidden origin");
      return;
    }

    // Token validation
    const { query } = parse(info.req.url || "", true);
    const token = query.token as string;
    if (!validateToken(token)) {
      callback(false, 401, "Unauthorized");
      return;
    }

    callback(true);
  },
});
```

### 7.2 Go (gorilla/websocket)

```go
package main

import (
    "log"
    "net/http"
    "github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
    CheckOrigin: func(r *http.Request) bool {
        origin := r.Header.Get("Origin")
        allowed := map[string]bool{
            "https://app.example.com":   true,
            "https://admin.example.com": true,
        }
        return allowed[origin]
    },
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
    // Authenticate before upgrade
    token := r.URL.Query().Get("token")
    if !validateToken(token) {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    // Upgrade to WebSocket
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Printf("upgrade error: %v", err)
        return
    }
    defer conn.Close()

    // Set limits
    conn.SetReadLimit(1024 * 1024) // 1MB max message

    // Read loop
    for {
        messageType, message, err := conn.ReadMessage()
        if err != nil {
            if websocket.IsUnexpectedCloseError(err,
                websocket.CloseGoingAway,
                websocket.CloseNormalClosure,
            ) {
                log.Printf("unexpected close: %v", err)
            }
            return
        }
        handleMessage(conn, messageType, message)
    }
}

func main() {
    http.HandleFunc("/ws", wsHandler)
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

### 7.3 Python (websockets library)

```python
import asyncio
import json
import websockets
from websockets.server import serve, WebSocketServerProtocol

ALLOWED_ORIGINS = {"https://app.example.com", "https://admin.example.com"}

class AuthWebSocketServerProtocol(WebSocketServerProtocol):
    async def process_request(self, path, headers):
        origin = headers.get("Origin", "")
        if origin not in ALLOWED_ORIGINS:
            return (403, [], b"Forbidden origin\n")

        from urllib.parse import urlparse, parse_qs
        query = parse_qs(urlparse(path).query)
        token = query.get("token", [None])[0]
        if not validate_token(token):
            return (401, [], b"Unauthorized\n")

        return None  # proceed with handshake

async def handler(websocket: WebSocketServerProtocol):
    try:
        async for message in websocket:
            data = json.loads(message)
            response = await process_message(data)
            await websocket.send(json.dumps(response))
    except websockets.ConnectionClosed as e:
        print(f"Connection closed: {e.code} {e.reason}")

async def main():
    async with serve(
        handler,
        "0.0.0.0",
        8080,
        create_protocol=AuthWebSocketServerProtocol,
        max_size=1_048_576,      # 1MB max message
        ping_interval=30,
        ping_timeout=10,
        compression="deflate",
    ):
        await asyncio.Future()

asyncio.run(main())
```

### 7.4 Server Implementation Rules

- **ALWAYS** set `maxPayload` / `max_size` / `SetReadLimit()` — prevent memory exhaustion
- **ALWAYS** implement `verifyClient` / `CheckOrigin` / `process_request` — validate origins
- **ALWAYS** authenticate before or during the upgrade handshake
- **MUST** handle connection errors gracefully — log and clean up resources
- **NEVER** block the read loop — offload expensive processing to worker threads/goroutines
- **USE** `perMessageDeflate` / compression for text-heavy protocols (>1KB messages)

---

## 8. Security

### 8.1 Origin Validation

ALWAYS validate the Origin header. This is the primary defense against Cross-Site WebSocket Hijacking (CSWSH).

```
Attack: Cross-Site WebSocket Hijacking

  Victim's browser visits attacker's site
      │
      │  attacker's JS: new WebSocket("wss://victim-api.com/ws")
      │
      ▼
  Browser sends WebSocket upgrade to victim-api.com
  WITH the victim's cookies automatically attached
      │
      ▼
  If server doesn't check Origin:
    → Attacker has full WebSocket access with victim's credentials
```

**Defense:**
```typescript
// CORRECT — whitelist allowed origins
verifyClient: (info, callback) => {
  const allowed = new Set(["https://app.example.com"]);
  if (!allowed.has(info.origin)) {
    callback(false, 403, "Origin not allowed");
    return;
  }
  callback(true);
}
```

```go
// WRONG — accept all origins
CheckOrigin: func(r *http.Request) bool {
    return true  // ✗ NEVER do this in production
}
```

### 8.2 Authentication Strategies

| Strategy | How It Works | Pros | Cons |
|----------|-------------|------|------|
| **Token in query string** | `wss://api.com/ws?token=JWT` | Simple, works everywhere | Token in URL logs, referrer headers |
| **Token in first message** | Connect, then send `{type: "auth", token: "JWT"}` | Token not in URL | Unauthenticated window before first message |
| **Cookie-based** | Browser sends cookies on upgrade | Automatic, no JS needed | Vulnerable to CSWSH without Origin check |
| **Ticket-based** | REST endpoint issues one-time ticket, WS uses ticket | Secure, short-lived | Extra HTTP roundtrip |

**Recommended: Ticket-based authentication**

```
Client                    REST API                WebSocket Server
  │                         │                          │
  │ POST /api/ws-ticket     │                          │
  │ Authorization: Bearer JWT                          │
  │────────────────────────▶│                          │
  │                         │ Generate one-time ticket │
  │◀────────────────────────│ { ticket: "abc123" }     │
  │                         │                          │
  │ new WebSocket("wss://ws.example.com/ws?ticket=abc123")
  │─────────────────────────────────────────────────────▶│
  │                         │                          │ Validate ticket
  │                         │                          │ (one-time use)
  │◀═══════════ Connected ══════════════════════════════│
```

**Go — Ticket-based Implementation:**
```go
func issueTicket(w http.ResponseWriter, r *http.Request) {
    claims, err := validateJWT(r.Header.Get("Authorization"))
    if err != nil {
        http.Error(w, "Unauthorized", 401)
        return
    }

    ticket := generateRandomString(32)
    ticketStore.Set(ticket, claims.UserID, 30*time.Second) // expires in 30s

    json.NewEncoder(w).Encode(map[string]string{"ticket": ticket})
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
    ticket := r.URL.Query().Get("ticket")
    userID, ok := ticketStore.GetAndDelete(ticket) // one-time use
    if !ok {
        http.Error(w, "Invalid ticket", 401)
        return
    }

    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        return
    }
    // conn is now authenticated as userID
}
```

### 8.3 Rate Limiting

```typescript
// Per-connection message rate limiting
const MESSAGE_LIMIT = 100;  // max messages per window
const WINDOW_MS = 60_000;   // 1 minute window

class RateLimiter {
  private counts = new Map<WebSocket, { count: number; resetAt: number }>();

  check(ws: WebSocket): boolean {
    const now = Date.now();
    let entry = this.counts.get(ws);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + WINDOW_MS };
      this.counts.set(ws, entry);
    }

    entry.count++;
    if (entry.count > MESSAGE_LIMIT) {
      ws.close(1008, "Rate limit exceeded");
      return false;
    }
    return true;
  }

  remove(ws: WebSocket): void {
    this.counts.delete(ws);
  }
}
```

### 8.4 Input Validation

```typescript
// ALWAYS validate incoming messages
function handleMessage(ws: WebSocket, raw: string): void {
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    ws.close(1007, "Invalid JSON");
    return;
  }

  if (!isValidMessage(msg)) {
    ws.send(JSON.stringify({ error: "invalid_message", detail: "Unknown message type" }));
    return;
  }

  if (raw.length > 65_536) {
    ws.close(1009, "Message too big");
    return;
  }

  processValidMessage(ws, msg as AppMessage);
}
```

### 8.5 Security Rules

- **ALWAYS** use `wss://` (TLS) in production — NEVER `ws://`
- **ALWAYS** validate Origin header — whitelist allowed origins
- **ALWAYS** authenticate before or immediately after upgrade
- **PREFER** ticket-based authentication over token-in-query-string
- **MUST** rate-limit messages per connection
- **MUST** validate and sanitize all incoming message payloads
- **MUST** set maximum message size limits
- **NEVER** trust client-provided data without validation
- **NEVER** echo raw client data to other clients (XSS prevention)
- **NEVER** set `CheckOrigin` to always return true in production

---

## 9. Connection Lifecycle Management

### 9.1 Server-Side Connection Tracking

```typescript
interface ConnectionInfo {
  ws: WebSocket;
  userId: string;
  connectedAt: Date;
  lastActivity: Date;
  ip: string;
  subscriptions: Set<string>;
}

class ConnectionManager {
  private connections = new Map<string, ConnectionInfo>();

  add(id: string, info: ConnectionInfo): void {
    this.connections.set(id, info);
  }

  remove(id: string): void {
    this.connections.delete(id);
  }

  getByUserId(userId: string): ConnectionInfo[] {
    return Array.from(this.connections.values())
      .filter((c) => c.userId === userId);
  }

  broadcast(channel: string, message: string): void {
    for (const [, info] of this.connections) {
      if (info.subscriptions.has(channel) && info.ws.readyState === WebSocket.OPEN) {
        info.ws.send(message);
      }
    }
  }

  get count(): number {
    return this.connections.size;
  }
}
```

### 9.2 Go Connection Tracking

```go
type ConnectionManager struct {
    mu          sync.RWMutex
    connections map[string]*Connection
}

type Connection struct {
    Conn         *websocket.Conn
    UserID       string
    ConnectedAt  time.Time
    LastActivity time.Time
    Subs         map[string]bool
    send         chan []byte
}

func NewConnectionManager() *ConnectionManager {
    return &ConnectionManager{
        connections: make(map[string]*Connection),
    }
}

func (cm *ConnectionManager) Add(id string, conn *Connection) {
    cm.mu.Lock()
    defer cm.mu.Unlock()
    cm.connections[id] = conn
}

func (cm *ConnectionManager) Remove(id string) {
    cm.mu.Lock()
    defer cm.mu.Unlock()
    delete(cm.connections, id)
}

func (cm *ConnectionManager) Broadcast(channel string, msg []byte) {
    cm.mu.RLock()
    defer cm.mu.RUnlock()
    for _, conn := range cm.connections {
        if conn.Subs[channel] {
            select {
            case conn.send <- msg:
            default:
                close(conn.send)
            }
        }
    }
}
```

### 9.3 Lifecycle Rules

- **ALWAYS** track all active connections with metadata (userId, connectedAt, IP, subscriptions)
- **MUST** clean up connection state on disconnect (remove from maps, unsubscribe from channels)
- **ALWAYS** use a write buffer channel (Go) or queue to prevent blocking on slow clients
- **MUST** close slow consumers that can't keep up — they cause memory leaks
- **NEVER** iterate all connections for a single-user operation — index by userId
- **ALWAYS** log connection/disconnection events with connection ID and userId

---

## 10. WebSocket Extensions

### 10.1 permessage-deflate

The most important extension — compresses WebSocket messages.

```
Client request:
  Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits

Server response:
  Sec-WebSocket-Extensions: permessage-deflate; server_max_window_bits=15
```

| Setting | Effect | Trade-off |
|---------|--------|-----------|
| `server_max_window_bits` | LZ77 window size (8-15) | Higher = better compression, more memory |
| `client_max_window_bits` | Client-side window size | Higher = better decompression, more memory |
| `server_no_context_takeover` | Reset compression per message | Less memory, worse ratio |
| `client_no_context_takeover` | Reset decompression per message | Less memory, worse ratio |

**When to Enable:**
- Messages > 1KB of text (JSON, XML)
- High message volume
- Bandwidth is constrained

**When to Disable:**
- Messages < 128 bytes (overhead exceeds savings)
- Already compressed data (images, video, protobuf)
- CPU is the bottleneck
- Per-connection memory is a concern (~300KB per connection for compression context)

### 10.2 Extension Rules

- **USE** `permessage-deflate` for text-heavy protocols with messages > 1KB
- **DISABLE** compression for binary protocols or already-compressed data
- **SET** `server_no_context_takeover` when memory per connection matters
- **KNOW** that compression adds ~300KB memory per connection — factor into capacity planning
- **MEASURE** before enabling — compression may not help for small or binary messages

---

## 11. WebSocket vs Alternatives

### 11.1 Comparison Matrix

| Feature | WebSocket | Server-Sent Events (SSE) | Long Polling | gRPC Streaming |
|---------|-----------|--------------------------|-------------|----------------|
| **Direction** | Full-duplex | Server → Client only | Simulated server push | Full-duplex |
| **Transport** | TCP (upgraded HTTP) | HTTP/1.1 or HTTP/2 | HTTP requests | HTTP/2 |
| **Framing** | Binary frames | UTF-8 text events | HTTP responses | Length-prefixed protobuf |
| **Browser support** | Universal | Universal (except old IE) | Universal | gRPC-Web only |
| **Reconnection** | Manual | Automatic (EventSource) | Manual | Channel reconnect |
| **HTTP/2 multiplexing** | No (own TCP connection) | Yes | Yes | Yes |
| **Proxy/firewall** | Can be blocked | Passes through HTTP infra | Passes through HTTP infra | Requires HTTP/2 |
| **Compression** | permessage-deflate | HTTP compression (gzip) | HTTP compression | protobuf binary |
| **Caching** | Not possible | HTTP caching possible | HTTP caching possible | Not possible |
| **Connection overhead** | Single persistent TCP | Single persistent HTTP | Repeated TCP+HTTP | Single HTTP/2 stream |
| **Max connections** | ~65k per IP | ~6 per domain (HTTP/1.1) | ~6 per domain | Multiplexed |

### 11.2 Decision Tree

```
Do you need bidirectional communication?
    │
    ├─ YES ──▶ WebSocket or gRPC Streaming
    │           │
    │           ├─ Browser client? ──▶ WebSocket
    │           └─ Backend-to-backend? ──▶ gRPC Streaming
    │
    └─ NO (server → client only)
         │
         ├─ Simple event stream? ──▶ Server-Sent Events (SSE)
         │
         ├─ Need HTTP caching? ──▶ SSE or Long Polling
         │
         └─ Legacy browser support? ──▶ Long Polling (fallback)
```

### 11.3 Alternative Selection Rules

- **USE** WebSocket when both client and server need to send messages independently
- **USE** SSE when only the server pushes updates (notifications, feeds, dashboards)
- **USE** Long Polling only as a fallback when WebSocket and SSE are not available
- **USE** gRPC streaming for backend-to-backend real-time communication
- **PREFER** SSE over WebSocket for server-push-only scenarios — simpler and HTTP-native
- **KNOW** that SSE is limited to ~6 connections per domain in HTTP/1.1 — use HTTP/2

---

## 12. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No Origin validation | Cross-Site WebSocket Hijacking attacks | ALWAYS whitelist allowed origins |
| No heartbeat (ping/pong) | Dead connections accumulate, resource leaks | Implement server-side ping every 25-30s |
| No message size limit | Memory exhaustion from giant messages | Set maxPayload / SetReadLimit |
| Token in URL without expiry | Token leaks via logs, referrer headers | Use ticket-based auth with short TTL |
| No reconnection logic (client) | Permanent disconnects on network glitches | Implement reconnect with exponential backoff |
| Blocking the read loop | Other clients' messages delayed | Offload processing to worker thread/goroutine |
| No rate limiting | DoS via message flood | Limit messages per connection per minute |
| Using `ws://` in production | Man-in-the-middle attacks | ALWAYS use `wss://` (TLS) |
| No close handshake | Data loss on disconnect | Send close frame with status code |
| Echoing raw client data | XSS attacks on other connected clients | Sanitize and validate all incoming data |
| No connection tracking | Cannot manage, debug, or broadcast | Track all connections with metadata |
| WebSocket for server-push only | Unnecessary complexity | Use SSE instead — simpler, HTTP-native |
| No graceful shutdown | Client connections dropped on deploy | Send 1012 close, wait for drain, then terminate |

---

## 13. Enforcement Checklist

- [ ] All production WebSocket connections use `wss://` (TLS)
- [ ] Origin header validated against whitelist on every upgrade request
- [ ] Authentication performed during or immediately after handshake
- [ ] Ping/pong heartbeat implemented (25-30s interval, 10s timeout)
- [ ] Maximum message size enforced (maxPayload / SetReadLimit)
- [ ] Per-connection rate limiting in place
- [ ] All incoming messages validated (JSON parsing, schema, size)
- [ ] Connection tracking with metadata (userId, IP, subscriptions)
- [ ] Graceful shutdown implemented (close frames → drain → terminate)
- [ ] Reconnection with exponential backoff on client side
- [ ] Close handshake uses appropriate status codes (1000, 1001, 1012)
- [ ] Raw client data never echoed without sanitization
- [ ] Compression configured appropriately (enabled for text >1KB)
- [ ] Connection/disconnection events logged with identifiers
- [ ] Dead connection cleanup runs periodically
- [ ] `CheckOrigin` / `verifyClient` is NOT set to accept all origins
