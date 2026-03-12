# Stateless Services

> **Domain:** Scalability > Horizontal Scaling
> **Importance:** Critical
> **Last Updated:** 2025

## Stateless Design Principles

A stateless service stores no client context between requests. Every request contains all information needed for processing.

```
Stateful:  Client → Server (holds session in memory) → Response
Stateless: Client → Any Server (state externalized) → Response
```

**Why stateless scales:** Any instance can handle any request. Add/remove instances freely. No coordination needed between instances.

## Shared-Nothing Architecture

Each server operates independently with no shared memory or disk.

```
                    ┌─── Server A (no local state)
Client → LB ───────┼─── Server B (no local state)
                    └─── Server C (no local state)
                              │
                         External State
                    ┌─────────┼─────────┐
                  Redis    Database    S3
```

### Externalized State

```typescript
// BAD: In-memory state (dies with process)
const sessions = new Map<string, UserSession>();
app.get('/profile', (req, res) => {
  const session = sessions.get(req.cookies.sid);  // Lost on restart/scale
});

// GOOD: Externalized state (survives scaling)
import { Redis } from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

app.get('/profile', async (req, res) => {
  const session = await redis.get(`session:${req.cookies.sid}`);
  const user = JSON.parse(session!);
  res.json(user);
});
```

```go
// Go: Externalized state with Redis
func GetProfile(w http.ResponseWriter, r *http.Request) {
    sid, _ := r.Cookie("sid")
    session, err := redisClient.Get(ctx, "session:"+sid.Value).Result()
    if err == redis.Nil {
        http.Error(w, "Unauthorized", 401)
        return
    }
    var user User
    json.Unmarshal([]byte(session), &user)
    json.NewEncoder(w).Encode(user)
}
```

## Token-Based Authentication

Replace server-side sessions with self-contained tokens:

```typescript
// JWT: State encoded in token, no server lookup
import jwt from 'jsonwebtoken';

function authenticate(req: Request): User {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const payload = jwt.verify(token!, process.env.JWT_SECRET!);
  return payload as User;  // No database/cache lookup needed
}
```

**JWT trade-offs:**
- Stateless (scales infinitely) but cannot be revoked instantly
- Mitigation: Short expiry (15 min) + refresh token rotation + revocation list in Redis

## 12-Factor App Methodology (Scale-Relevant)

| Factor | Stateless Requirement |
|--------|----------------------|
| III. Config | Environment variables, not files |
| VI. Processes | Stateless, share-nothing |
| VII. Port binding | Self-contained, no runtime injection |
| VIII. Concurrency | Scale out via process model |
| IX. Disposability | Fast startup, graceful shutdown |
| XI. Logs | Write to stdout, aggregate externally |

## Idempotent Operations

Critical for stateless services — requests may be retried on any instance:

```typescript
// Idempotent payment processing
async function processPayment(idempotencyKey: string, amount: number) {
  // Check if already processed (any instance can check)
  const existing = await db.query(
    'SELECT * FROM payments WHERE idempotency_key = $1',
    [idempotencyKey]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0]; // Return cached result
  }

  const result = await db.query(
    `INSERT INTO payments (idempotency_key, amount, status)
     VALUES ($1, $2, 'completed')
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING *`,
    [idempotencyKey, amount]
  );
  return result.rows[0];
}
```

## Containerization for Stateless

```dockerfile
# Stateless container: no volumes, no local storage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/

FROM node:20-alpine
RUN adduser -D appuser
USER appuser
WORKDIR /app
COPY --from=build /app .
# No VOLUME — all state is external
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

```yaml
# Kubernetes: stateless deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 0
  template:
    spec:
      containers:
        - name: api
          image: api:v1.2.3
          env:
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: redis-secret
                  key: url
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 1000m
              memory: 512Mi
```

## Migration: Stateful to Stateless

```
Phase 1: Identify state → in-memory sessions, local file uploads, caches
Phase 2: Externalize → Redis for sessions, S3 for files, CDN for cache
Phase 3: Validate → Run 2+ instances behind LB, kill one, verify no data loss
Phase 4: Scale test → Auto-scale 1→10→1 instances, verify all requests succeed
```

### State Migration Checklist

| State Type | Stateful Location | Stateless Location |
|-----------|-------------------|-------------------|
| Sessions | Memory/files | Redis/JWT |
| File uploads | Local disk | S3/GCS/Azure Blob |
| Caches | Local memory | Redis/Memcached |
| Scheduled jobs | In-process timers | External scheduler (cron, CloudWatch) |
| WebSocket state | In-memory maps | Redis Pub/Sub + external registry |
| Rate limit counters | In-memory | Redis (distributed) |

## Best Practices

1. **Store zero state in the application process** — externalize everything
2. **Use JWT or token-based auth** — eliminates session server dependency
3. **Make all operations idempotent** — safe retries across any instance
4. **Write logs to stdout** — aggregate externally, never to local files
5. **Use environment variables for config** — never local config files
6. **Design for instant disposability** — fast startup (<5s), graceful shutdown
7. **Use connection pooling for external state** — Redis, database connections
8. **Test by killing random instances** — verify no user impact
9. **Avoid in-process caches for shared data** — use distributed cache or accept stale
10. **Version container images immutably** — never `:latest`, always specific tag

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|-------------|--------|-----|
| In-memory sessions | Lost on restart/scale | Redis or JWT |
| Local file storage | Files unavailable on other instances | S3/GCS object storage |
| In-process cron jobs | Duplicate execution on scale-out | External scheduler |
| Sticky sessions dependency | Limits scaling, uneven load | Externalize state |
| Local cache as source of truth | Inconsistent across instances | Cache-aside with Redis |
| Hardcoded instance addresses | Cannot add/remove instances | Service discovery |
| Startup data loading | Slow scaling, cold start | Lazy loading or external cache |
| Process-level singletons for shared state | Breaks with multiple instances | Distributed locks (Redis/etcd) |

## Enforcement Checklist

- [ ] No in-memory session storage — Redis or JWT verified
- [ ] No local file storage — S3/GCS for uploads and artifacts
- [ ] All operations are idempotent
- [ ] Application starts in <10 seconds
- [ ] Graceful shutdown handles in-flight requests
- [ ] Load test passes with random instance termination
- [ ] Environment variables for all configuration
- [ ] Logs written to stdout/stderr only
