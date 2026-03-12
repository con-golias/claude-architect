# Health Checks

> **AI Plugin Directive — Health Check Endpoints, Liveness & Readiness Probes**
> You are an AI coding assistant. When generating, reviewing, or refactoring health check
> code, follow EVERY rule in this document. Without proper health checks, orchestrators cannot
> detect failures, load balancers route to dead instances, and outages go undetected. Treat each section as non-negotiable.

**Core Rule: ALWAYS implement separate liveness and readiness endpoints. ALWAYS check critical dependencies in readiness probes. NEVER include expensive operations in liveness probes. ALWAYS return structured JSON with dependency status. NEVER expose sensitive information in health responses.**

---

## 1. Health Check Types

```
┌──────────────────────────────────────────────────────────────┐
│              Health Check Types                                │
│                                                               │
│  LIVENESS (/healthz or /health/live)                        │
│  ├── "Is the process alive and not deadlocked?"             │
│  ├── MUST be fast (<100ms)                                   │
│  ├── MUST NOT check external dependencies                    │
│  ├── Failure → Kubernetes RESTARTS the pod                  │
│  └── Checks: process alive, not deadlocked, memory OK       │
│                                                               │
│  READINESS (/readyz or /health/ready)                       │
│  ├── "Can this instance handle requests?"                   │
│  ├── Can be slower (<3s)                                     │
│  ├── MUST check critical dependencies                       │
│  ├── Failure → Kubernetes REMOVES from load balancer        │
│  └── Checks: DB connected, cache reachable, disk space OK   │
│                                                               │
│  STARTUP (/startupz or /health/startup)                     │
│  ├── "Has the app finished initializing?"                   │
│  ├── Used for slow-starting apps                             │
│  ├── Failure → Kubernetes waits (no restart yet)            │
│  └── Checks: migrations done, cache warmed, config loaded   │
│                                                               │
│  Rule: Liveness NEVER checks dependencies                    │
│  Rule: Readiness ALWAYS checks dependencies                  │
│  Rule: Startup runs ONCE during initialization               │
└──────────────────────────────────────────────────────────────┘
```

| Probe | Path | Timeout | Period | Failure Threshold | Action |
|-------|------|---------|--------|------------------|--------|
| **Liveness** | `/health/live` | 1s | 10s | 3 failures | Restart pod |
| **Readiness** | `/health/ready` | 3s | 5s | 3 failures | Remove from LB |
| **Startup** | `/health/startup` | 5s | 5s | 30 failures | Kill pod |

---

## 2. TypeScript Implementation

```typescript
interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  checks: Record<string, {
    status: "up" | "down";
    latencyMs?: number;
    message?: string;
  }>;
  version: string;
  uptime: number;
}

class HealthService {
  private startTime = Date.now();

  // Liveness: process alive, not deadlocked
  async liveness(): Promise<{ status: "ok" }> {
    return { status: "ok" }; // If this responds, the process is alive
  }

  // Readiness: all dependencies available
  async readiness(): Promise<HealthStatus> {
    const checks: HealthStatus["checks"] = {};
    let allHealthy = true;

    // Check database
    const dbStart = Date.now();
    try {
      await db.raw("SELECT 1");
      checks.database = { status: "up", latencyMs: Date.now() - dbStart };
    } catch (err) {
      checks.database = { status: "down", message: "Connection failed" };
      allHealthy = false;
    }

    // Check Redis
    const redisStart = Date.now();
    try {
      await redis.ping();
      checks.redis = { status: "up", latencyMs: Date.now() - redisStart };
    } catch (err) {
      checks.redis = { status: "down", message: "Connection failed" };
      allHealthy = false;
    }

    // Check external service
    const extStart = Date.now();
    try {
      await fetch(`${PAYMENT_SERVICE_URL}/health/live`, {
        signal: AbortSignal.timeout(2000),
      });
      checks.paymentService = { status: "up", latencyMs: Date.now() - extStart };
    } catch (err) {
      checks.paymentService = { status: "down", message: "Unreachable" };
      // Non-critical: don't set allHealthy = false
    }

    // Check disk space
    const diskUsage = await checkDiskUsage("/");
    if (diskUsage.percentUsed > 90) {
      checks.disk = { status: "down", message: `${diskUsage.percentUsed}% used` };
      allHealthy = false;
    } else {
      checks.disk = { status: "up" };
    }

    return {
      status: allHealthy ? "healthy" : "unhealthy",
      checks,
      version: process.env.APP_VERSION ?? "unknown",
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}

// Routes
app.get("/health/live", async (_req, res) => {
  res.json(await healthService.liveness());
});

app.get("/health/ready", async (_req, res) => {
  const health = await healthService.readiness();
  res.status(health.status === "healthy" ? 200 : 503).json(health);
});
```

---

## 3. Go Implementation

```go
type HealthCheck struct {
    db        *sql.DB
    redis     *redis.Client
    startTime time.Time
    version   string
}

type CheckResult struct {
    Status    string `json:"status"`
    LatencyMs int64  `json:"latencyMs,omitempty"`
    Message   string `json:"message,omitempty"`
}

type HealthResponse struct {
    Status  string                  `json:"status"`
    Checks  map[string]CheckResult  `json:"checks"`
    Version string                  `json:"version"`
    Uptime  int64                   `json:"uptime"`
}

func (h *HealthCheck) LivenessHandler(w http.ResponseWriter, r *http.Request) {
    writeJSON(w, 200, map[string]string{"status": "ok"})
}

func (h *HealthCheck) ReadinessHandler(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
    defer cancel()

    checks := make(map[string]CheckResult)
    healthy := true

    // Database check
    dbStart := time.Now()
    if err := h.db.PingContext(ctx); err != nil {
        checks["database"] = CheckResult{Status: "down", Message: "Connection failed"}
        healthy = false
    } else {
        checks["database"] = CheckResult{Status: "up", LatencyMs: time.Since(dbStart).Milliseconds()}
    }

    // Redis check
    redisStart := time.Now()
    if err := h.redis.Ping(ctx).Err(); err != nil {
        checks["redis"] = CheckResult{Status: "down", Message: "Connection failed"}
        healthy = false
    } else {
        checks["redis"] = CheckResult{Status: "up", LatencyMs: time.Since(redisStart).Milliseconds()}
    }

    status := "healthy"
    code := http.StatusOK
    if !healthy {
        status = "unhealthy"
        code = http.StatusServiceUnavailable
    }

    writeJSON(w, code, HealthResponse{
        Status:  status,
        Checks:  checks,
        Version: h.version,
        Uptime:  int64(time.Since(h.startTime).Seconds()),
    })
}
```

---

## 4. Python Implementation (FastAPI)

```python
from datetime import datetime

class HealthService:
    def __init__(self):
        self.start_time = datetime.utcnow()

    async def liveness(self) -> dict:
        return {"status": "ok"}

    async def readiness(self) -> tuple[dict, int]:
        checks = {}
        healthy = True

        # Database
        try:
            start = time.monotonic()
            await db.execute("SELECT 1")
            checks["database"] = {"status": "up", "latencyMs": int((time.monotonic() - start) * 1000)}
        except Exception:
            checks["database"] = {"status": "down", "message": "Connection failed"}
            healthy = False

        # Redis
        try:
            start = time.monotonic()
            await redis_client.ping()
            checks["redis"] = {"status": "up", "latencyMs": int((time.monotonic() - start) * 1000)}
        except Exception:
            checks["redis"] = {"status": "down", "message": "Connection failed"}
            healthy = False

        response = {
            "status": "healthy" if healthy else "unhealthy",
            "checks": checks,
            "version": settings.APP_VERSION,
            "uptime": int((datetime.utcnow() - self.start_time).total_seconds()),
        }
        return response, 200 if healthy else 503

@app.get("/health/live")
async def liveness():
    return await health_service.liveness()

@app.get("/health/ready")
async def readiness():
    data, status = await health_service.readiness()
    return JSONResponse(content=data, status_code=status)
```

---

## 5. Kubernetes Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: api
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 1
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 0
            periodSeconds: 5
            timeoutSeconds: 5
            failureThreshold: 30   # 30 × 5s = 150s max startup
```

- ALWAYS set `initialDelaySeconds` to allow app startup
- ALWAYS set `failureThreshold` ≥ 3 to avoid false positives
- ALWAYS use startup probe for slow-starting applications
- NEVER set liveness `timeoutSeconds` > 1s (indicates a problem)

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Liveness checks dependencies | Pod restart loop when DB is down | Liveness = process only |
| Single `/health` endpoint | Cannot differentiate live vs ready | Separate liveness + readiness |
| No readiness probe | Traffic sent to unready pods | Readiness checks dependencies |
| Expensive health check | Health endpoint itself causes load | Lightweight checks, cache results |
| Health check exposes secrets | Credential leak in response | Never include connection strings |
| No timeout on dependency check | Health check hangs | 1-3s timeout per check |
| Always return 200 | Orchestrator thinks everything is fine | Return 503 when unhealthy |

---

## 7. Enforcement Checklist

- [ ] Separate liveness and readiness endpoints implemented
- [ ] Liveness probe does NOT check external dependencies
- [ ] Readiness probe checks database, cache, critical services
- [ ] Health response includes structured JSON with per-check status
- [ ] No sensitive information in health responses
- [ ] Kubernetes probes configured with appropriate thresholds
- [ ] Startup probe configured for slow-starting applications
- [ ] Health check timeout configured (1-3s)
- [ ] Health check metrics tracked (response time, status)
- [ ] 503 returned when any critical dependency is down
