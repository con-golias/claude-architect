# Server-Sent Events (SSE)

> **AI Plugin Directive — SSE Implementation for Server-to-Client Streaming**
> You are an AI coding assistant. When generating, reviewing, or refactoring SSE code,
> follow EVERY rule in this document. SSE provides simple, reliable server-to-client push
> with automatic reconnection. Treat each section as non-negotiable.

**Core Rule: ALWAYS use SSE when communication is server-to-client only (no client-to-server needed). ALWAYS set correct headers (Content-Type: text/event-stream). ALWAYS include event IDs for reconnection resume. ALWAYS handle client disconnection and clean up resources.**

---

## 1. SSE vs WebSocket Decision

```
┌──────────────────────────────────────────────────────────────┐
│              When to Use SSE vs WebSocket                     │
│                                                               │
│  SSE (Server-Sent Events):                                  │
│  ├── Server → Client only (unidirectional)                 │
│  ├── Auto-reconnection built into browser                   │
│  ├── Works with HTTP/2 multiplexing                         │
│  ├── Text-only (no binary)                                  │
│  ├── Use cases: notifications, live feeds, dashboards       │
│  └── Simpler than WebSocket                                 │
│                                                               │
│  WebSocket:                                                  │
│  ├── Bidirectional (client ↔ server)                       │
│  ├── Binary + text support                                  │
│  ├── Lower latency for frequent messages                    │
│  └── Use cases: chat, gaming, collaboration                 │
│                                                               │
│  Rule: If server-to-client only → SSE                       │
│  Rule: If bidirectional needed → WebSocket                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript Implementation

```typescript
// SSE endpoint
app.get("/api/events", authMiddleware, (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // Disable nginx buffering
  });

  const userId = req.user.id;
  let eventId = 0;

  // Resume from last event ID (automatic reconnection)
  const lastId = req.headers["last-event-id"];
  if (lastId) {
    // Send missed events since lastId
    sendMissedEvents(res, userId, parseInt(lastId));
  }

  // Send event helper
  function sendEvent(type: string, data: unknown): void {
    eventId++;
    res.write(`id: ${eventId}\n`);
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  // Send heartbeat every 30s (keeps connection alive)
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`); // Comment line (ignored by client)
  }, 30_000);

  // Subscribe to events for this user
  const unsubscribe = eventBus.subscribe(userId, (event) => {
    sendEvent(event.type, event.data);
  });

  // Cleanup on disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    sseClients.delete(userId);
  });

  sseClients.set(userId, { res, sendEvent });
});
```

---

## 3. Go Implementation

```go
func (h *SSEHandler) Events(w http.ResponseWriter, r *http.Request) {
    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "Streaming not supported", 500)
        return
    }

    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")

    userID := auth.GetUserID(r.Context())
    eventCh := h.eventBus.Subscribe(userID)
    defer h.eventBus.Unsubscribe(userID, eventCh)

    // Heartbeat ticker
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()

    eventID := 0
    for {
        select {
        case <-r.Context().Done():
            return // Client disconnected
        case <-ticker.C:
            fmt.Fprintf(w, ": heartbeat\n\n")
            flusher.Flush()
        case event := <-eventCh:
            eventID++
            fmt.Fprintf(w, "id: %d\nevent: %s\ndata: %s\n\n",
                eventID, event.Type, event.Data)
            flusher.Flush()
        }
    }
}
```

---

## 4. Python Implementation

```python
from starlette.responses import StreamingResponse

@app.get("/api/events")
async def sse_events(request: Request, user: User = Depends(require_auth)):
    async def event_stream():
        event_id = 0
        queue = asyncio.Queue()
        event_bus.subscribe(user.id, queue)

        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    event_id += 1
                    yield f"id: {event_id}\nevent: {event['type']}\ndata: {json.dumps(event['data'])}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"

                if await request.is_disconnected():
                    break
        finally:
            event_bus.unsubscribe(user.id, queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No event IDs | Cannot resume on reconnect | Include `id:` field |
| No heartbeat | Connection drops silently | Comment heartbeat every 30s |
| Proxy buffering enabled | Events delayed or batched | `X-Accel-Buffering: no` |
| No cleanup on disconnect | Resource leak | Clean up on `req.close` |
| SSE for bidirectional | Client cannot send messages | Use WebSocket instead |

---

## 6. Enforcement Checklist

- [ ] Content-Type: text/event-stream header set
- [ ] Event IDs included for reconnection resume
- [ ] Heartbeat comment sent every 30 seconds
- [ ] Proxy buffering disabled (X-Accel-Buffering: no)
- [ ] Resources cleaned up on client disconnect
- [ ] Last-Event-ID header handled for missed events
- [ ] Authentication performed before SSE stream starts
