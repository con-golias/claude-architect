# Graceful Shutdown

> **AI Plugin Directive — Graceful Shutdown, Signal Handling & Connection Draining**
> You are an AI coding assistant. When generating, reviewing, or refactoring shutdown logic,
> follow EVERY rule in this document. Abrupt process termination causes dropped requests,
> data corruption, and broken connections. Treat each section as non-negotiable.

**Core Rule: ALWAYS handle SIGTERM and SIGINT signals for graceful shutdown. ALWAYS stop accepting new requests before draining existing ones. ALWAYS set a maximum shutdown timeout to prevent zombie processes. ALWAYS close resources in reverse order of initialization (connections last, servers first).**

---

## 1. Shutdown Sequence

```
┌──────────────────────────────────────────────────────────────┐
│              Graceful Shutdown Sequence                        │
│                                                               │
│  1. Receive SIGTERM (from Kubernetes, process manager)       │
│  2. Stop accepting new connections                           │
│     ├── Set readiness probe to unhealthy                    │
│     ├── Stop HTTP server listener                           │
│     └── Stop consuming from message queues                  │
│  3. Wait for in-flight requests to complete                  │
│     ├── HTTP requests drain (connection draining)           │
│     ├── Background jobs finish current task                  │
│     └── WebSocket connections close gracefully              │
│  4. Flush buffered data                                      │
│     ├── Flush logs                                          │
│     ├── Flush metrics                                       │
│     └── Commit pending transactions                         │
│  5. Close connections                                        │
│     ├── Close database pool                                 │
│     ├── Close Redis connections                             │
│     ├── Close message queue connections                     │
│     └── Close external service connections                  │
│  6. Exit process                                             │
│                                                               │
│  TIMEOUT: If step 3-5 takes > 30s → force exit             │
│  Kubernetes: terminationGracePeriodSeconds = 30              │
│  Rule: preStop hook = 5s → then SIGTERM → 25s drain        │
└──────────────────────────────────────────────────────────────┘
```

| Phase | Timeout | Action on Timeout |
|-------|---------|------------------|
| **Stop accepting** | Immediate | — |
| **Drain requests** | 20s | Force close connections |
| **Flush & close** | 10s | Force exit |
| **Total** | 30s | SIGKILL from Kubernetes |

---

## 2. TypeScript Implementation

```typescript
class GracefulShutdown {
  private shuttingDown = false;
  private server: Server;
  private connections = new Set<Socket>();

  constructor(app: Express, private resources: Closeable[]) {
    this.server = app.listen(PORT, () => logger.info("Server started", { port: PORT }));

    // Track active connections
    this.server.on("connection", (conn) => {
      this.connections.add(conn);
      conn.on("close", () => this.connections.delete(conn));
    });

    // Register signal handlers
    process.on("SIGTERM", () => this.shutdown("SIGTERM"));
    process.on("SIGINT", () => this.shutdown("SIGINT"));
  }

  private async shutdown(signal: string): Promise<void> {
    if (this.shuttingDown) return; // Prevent double shutdown
    this.shuttingDown = true;

    logger.info("Shutdown initiated", { signal });

    // 1. Set readiness to unhealthy (Kubernetes stops routing)
    this.markUnready();

    // 2. Stop accepting new connections
    this.server.close(() => logger.info("HTTP server closed"));

    // 3. Drain existing connections with timeout
    const drainTimeout = setTimeout(() => {
      logger.warn("Force closing connections", { remaining: this.connections.size });
      for (const conn of this.connections) {
        conn.destroy();
      }
    }, 20_000);

    // 4. Close resources in reverse order
    try {
      for (const resource of [...this.resources].reverse()) {
        try {
          await resource.close();
          logger.info("Resource closed", { name: resource.name });
        } catch (err) {
          logger.error("Failed to close resource", {
            name: resource.name, error: (err as Error).message,
          });
        }
      }
    } finally {
      clearTimeout(drainTimeout);
    }

    logger.info("Shutdown complete");
    process.exit(0);
  }

  private markUnready(): void {
    this.shuttingDown = true;
  }
}

// Usage
const shutdown = new GracefulShutdown(app, [
  { name: "job-queue", close: () => jobQueue.close() },
  { name: "redis", close: () => redis.quit() },
  { name: "database", close: () => db.destroy() },
]);
```

---

## 3. Go Implementation

```go
func StartServer(ctx context.Context, handler http.Handler, db *sql.DB, rdb *redis.Client) error {
    srv := &http.Server{
        Addr:              ":8080",
        Handler:           handler,
        ReadHeaderTimeout: 10 * time.Second,
    }

    go func() {
        slog.Info("server starting", "addr", srv.Addr)
        if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
            slog.Error("server error", "error", err)
        }
    }()

    // Wait for shutdown signal
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
    sig := <-quit
    slog.Info("shutdown signal received", "signal", sig)

    // Shutdown with timeout
    shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    // Stop accepting + drain connections
    if err := srv.Shutdown(shutdownCtx); err != nil {
        slog.Error("server shutdown error", "error", err)
    }
    slog.Info("http server stopped")

    // Close resources in reverse order
    if err := rdb.Close(); err != nil {
        slog.Error("redis close error", "error", err)
    }
    if err := db.Close(); err != nil {
        slog.Error("database close error", "error", err)
    }

    slog.Info("shutdown complete")
    return nil
}
```

---

## 4. Python Implementation

```python
import signal
import asyncio

class GracefulShutdown:
    def __init__(self):
        self.shutting_down = False

    def setup(self, app):
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, lambda s=sig: asyncio.create_task(self.shutdown(s, app)))

    async def shutdown(self, sig, app):
        if self.shutting_down:
            return
        self.shutting_down = True
        logger.info("Shutdown initiated", extra={"signal": sig.name})

        # Mark not ready
        app.state.ready = False

        # Cancel outstanding tasks
        tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
        done, pending = await asyncio.wait(tasks, timeout=20.0)
        if pending:
            logger.warning(f"Force cancelling {len(pending)} tasks")
            for task in pending:
                task.cancel()

        # Close resources
        await redis_client.close()
        await db_pool.close()
        logger.info("Shutdown complete")

# FastAPI lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    await db_pool.connect()
    await redis_client.connect()
    shutdown = GracefulShutdown()
    shutdown.setup(app)
    yield
```

---

## 5. Kubernetes Configuration

```yaml
spec:
  terminationGracePeriodSeconds: 30
  containers:
    - name: api
      lifecycle:
        preStop:
          exec:
            command: ["sleep", "5"]  # Wait for LB deregistration
```

- ALWAYS set `terminationGracePeriodSeconds` ≥ application drain timeout
- ALWAYS use `preStop` hook with `sleep 5` for LB deregistration delay
- ALWAYS ensure readiness probe fails immediately on SIGTERM

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No signal handler | Dropped requests on deploy | Handle SIGTERM + SIGINT |
| `process.exit(0)` immediately | Connections dropped mid-request | Drain first, then exit |
| No shutdown timeout | Zombie process never exits | Force exit after 30s |
| Close DB before server | Requests fail during drain | Close server first, DB last |
| No preStop hook in K8s | Requests during LB deregistration | `sleep 5` preStop |
| Double shutdown | Race condition on cleanup | Guard with boolean flag |

---

## 7. Enforcement Checklist

- [ ] SIGTERM and SIGINT signals handled
- [ ] New connections stopped before draining existing
- [ ] Readiness probe returns unhealthy during shutdown
- [ ] In-flight requests allowed to complete (20s timeout)
- [ ] Resources closed in reverse initialization order
- [ ] Force exit after maximum shutdown timeout (30s)
- [ ] Kubernetes `terminationGracePeriodSeconds` matches app timeout
- [ ] preStop hook delays SIGTERM for load balancer deregistration
- [ ] Shutdown progress logged at each phase
- [ ] Background job workers finish current job before stopping
