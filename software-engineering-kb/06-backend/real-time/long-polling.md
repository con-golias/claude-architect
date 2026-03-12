# Long Polling

> **AI Plugin Directive — Long Polling Implementation & Patterns**
> You are an AI coding assistant. When generating, reviewing, or refactoring long polling
> code, follow EVERY rule in this document. Long polling is the simplest real-time pattern
> but requires careful timeout and resource management. Treat each section as non-negotiable.

**Core Rule: ALWAYS set a server-side timeout (30s) to return empty responses and allow reconnection. ALWAYS include a version/timestamp for change detection. ALWAYS clean up resources when the client disconnects. Use long polling ONLY when SSE and WebSocket are not available.**

---

## 1. Long Polling Flow

```
┌──────────────────────────────────────────────────────────────┐
│              Long Polling                                      │
│                                                               │
│  Client → GET /api/updates?since=1709000000                 │
│  Server holds request open until:                            │
│  ├── New data available → respond immediately               │
│  ├── Timeout (30s) → respond with empty/no-change           │
│  └── Client disconnects → cleanup                           │
│  Client immediately sends next request                       │
│                                                               │
│  Pros: Works everywhere (HTTP), simple                       │
│  Cons: Higher latency, more connections, more overhead       │
│                                                               │
│  Use ONLY when:                                              │
│  ├── SSE not supported (old browsers/proxies)               │
│  ├── WebSocket not available                                │
│  └── Simple change detection needed                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript Implementation

```typescript
app.get("/api/updates", authMiddleware, async (req, res) => {
  const since = parseInt(req.query.since as string) || 0;
  const timeoutMs = 30_000;

  // Check for immediate data
  const data = await getUpdatesSince(req.user.id, since);
  if (data.length > 0) {
    return res.json({ updates: data, timestamp: Date.now() });
  }

  // Wait for new data or timeout
  const cleanup = new AbortController();
  const timeout = setTimeout(() => cleanup.abort(), timeoutMs);

  const unsubscribe = eventBus.subscribe(req.user.id, (event) => {
    clearTimeout(timeout);
    unsubscribe();
    res.json({ updates: [event], timestamp: Date.now() });
  });

  // Client disconnect
  req.on("close", () => {
    clearTimeout(timeout);
    unsubscribe();
  });

  // Timeout: return empty
  cleanup.signal.addEventListener("abort", () => {
    unsubscribe();
    if (!res.headersSent) {
      res.json({ updates: [], timestamp: Date.now() });
    }
  });
});
```

---

## 3. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No server timeout | Connections hang forever | 30s timeout with empty response |
| Short polling pretending to be long | High request rate, wasted resources | Hold connection open |
| No change detection token | Client requests duplicate data | Include `since` timestamp/version |
| No cleanup on disconnect | Resource leaks | Handle `req.close` event |
| Long polling when SSE available | Unnecessary complexity | Prefer SSE for server→client push |

---

## 4. Enforcement Checklist

- [ ] Server-side timeout configured (30 seconds)
- [ ] Change detection via timestamp or version parameter
- [ ] Resources cleaned up on client disconnect
- [ ] Empty response on timeout (not error)
- [ ] SSE or WebSocket preferred when available
- [ ] Connection count limited per user
