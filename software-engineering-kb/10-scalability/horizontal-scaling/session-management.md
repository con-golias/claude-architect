# Session Management at Scale

> **Domain:** Scalability > Horizontal Scaling
> **Importance:** High
> **Last Updated:** 2025

## Session Storage Strategies

### Comparison Matrix

| Strategy | Latency | Consistency | Scalability | Complexity |
|----------|---------|-------------|-------------|------------|
| In-memory (single server) | <1ms | Strong | None | Low |
| Sticky sessions | <1ms | Per-server | Limited | Low |
| Redis/Memcached | 1-3ms | Strong | High | Medium |
| Database-backed | 5-20ms | Strong | Medium | Medium |
| JWT (stateless) | 0ms (no lookup) | N/A | Unlimited | Low |
| Signed cookies | 0ms (no lookup) | N/A | Unlimited | Low |

## Distributed Session Store (Redis)

```typescript
import session from 'express-session';
import RedisStore from 'connect-redis';
import { Redis } from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

app.use(session({
  store: new RedisStore({
    client: redis,
    prefix: 'sess:',
    ttl: 1800,          // 30 minutes
    disableTouch: false, // Refresh TTL on access
  }),
  name: 'sid',
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 1800000,
  },
}));
```

```go
// Go: Redis session middleware
type SessionStore struct {
    redis *redis.Client
    ttl   time.Duration
}

func (s *SessionStore) Get(ctx context.Context, sessionID string) (*Session, error) {
    data, err := s.redis.Get(ctx, "sess:"+sessionID).Bytes()
    if err == redis.Nil {
        return nil, ErrSessionNotFound
    }
    var session Session
    json.Unmarshal(data, &session)
    // Refresh TTL on access
    s.redis.Expire(ctx, "sess:"+sessionID, s.ttl)
    return &session, nil
}

func (s *SessionStore) Set(ctx context.Context, sessionID string, session *Session) error {
    data, _ := json.Marshal(session)
    return s.redis.Set(ctx, "sess:"+sessionID, data, s.ttl).Err()
}

func (s *SessionStore) Delete(ctx context.Context, sessionID string) error {
    return s.redis.Del(ctx, "sess:"+sessionID).Err()
}
```

## JWT-Based Sessions (Stateless)

No server-side storage needed. Scales infinitely.

```typescript
import jwt from 'jsonwebtoken';

// Create session token
function createSession(user: User): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: '15m', algorithm: 'RS256' }
  );
  const refreshToken = jwt.sign(
    { sub: user.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d', algorithm: 'RS256' }
  );
  // Store refresh token hash in DB for revocation
  db.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, hash(refreshToken), new Date(Date.now() + 7 * 86400000)]);

  return { accessToken, refreshToken };
}

// Middleware: verify on every request, no external lookup
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  try {
    req.user = jwt.verify(token!, process.env.JWT_SECRET!) as User;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

**JWT limitations:**
- Cannot revoke individual tokens before expiry
- Payload visible (base64, not encrypted)
- Token size grows with claims (header overhead)

**Mitigation:** Short access token (15m), refresh token rotation, revocation list in Redis for critical logouts.

## Sticky Sessions (Session Affinity)

Route same client to same server. **Use only as last resort.**

```nginx
# NGINX: Cookie-based sticky sessions
upstream backend {
    sticky cookie srv_id expires=1h domain=.example.com path=/;
    server 10.0.1.10:8080;
    server 10.0.1.11:8080;
    server 10.0.1.12:8080;
}
```

```yaml
# Kubernetes: Session affinity
apiVersion: v1
kind: Service
metadata:
  name: api-service
spec:
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 1800
  ports:
    - port: 80
      targetPort: 8080
```

**Problems with sticky sessions:**
- Server failure loses all pinned sessions
- Uneven load distribution
- Cannot scale down without session loss
- Auto-scaling becomes ineffective

## Session Migration During Deployments

```typescript
// Strategy: Dual-read during migration
class MigratingSessionStore {
  constructor(
    private oldStore: SessionStore,  // e.g., Memcached
    private newStore: SessionStore,  // e.g., Redis
    private migrationActive: boolean = true,
  ) {}

  async get(sessionId: string): Promise<Session | null> {
    // Try new store first
    let session = await this.newStore.get(sessionId);
    if (session) return session;

    if (this.migrationActive) {
      // Fallback to old store, migrate on read
      session = await this.oldStore.get(sessionId);
      if (session) {
        await this.newStore.set(sessionId, session);
        return session;
      }
    }
    return null;
  }

  async set(sessionId: string, session: Session): Promise<void> {
    // Always write to new store
    await this.newStore.set(sessionId, session);
    // Optionally write to old during migration
    if (this.migrationActive) {
      await this.oldStore.set(sessionId, session);
    }
  }
}
```

## Session Security at Scale

```typescript
// Secure session configuration
const sessionConfig = {
  // Cryptographically random session IDs (128 bits minimum)
  genid: () => crypto.randomBytes(32).toString('hex'),

  // Rotate session ID on privilege change
  regenerateOnAuth: true,

  // Absolute timeout (force re-auth)
  absoluteTimeout: 8 * 60 * 60 * 1000, // 8 hours

  // Idle timeout (sliding window)
  idleTimeout: 30 * 60 * 1000, // 30 minutes

  // Concurrent session limit
  maxConcurrentSessions: 5,
};
```

```python
# Python: Session fixation prevention
from flask import session, request

@app.route('/login', methods=['POST'])
def login():
    user = authenticate(request.form['username'], request.form['password'])
    if user:
        # Regenerate session ID on login (prevent fixation)
        session.clear()
        session.regenerate()
        session['user_id'] = user.id
        session['login_time'] = time.time()
        return redirect('/dashboard')
```

## Redis Cluster for Session HA

```yaml
# Redis Sentinel for session store HA
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-sentinel-config
data:
  sentinel.conf: |
    sentinel monitor mymaster redis-master 6379 2
    sentinel down-after-milliseconds mymaster 5000
    sentinel failover-timeout mymaster 10000
    sentinel parallel-syncs mymaster 1
```

## Best Practices

1. **Prefer JWT for stateless APIs** — eliminates session store dependency
2. **Use Redis for server-side sessions** — sub-millisecond latency, built-in TTL
3. **Set absolute and idle timeouts** — prevent session fixation attacks
4. **Regenerate session ID on authentication** — prevent session fixation
5. **Store minimal data in sessions** — user ID and role, not full objects
6. **Use Redis Sentinel or Cluster for HA** — single Redis is SPOF
7. **Encrypt sensitive session data** — even in Redis (defense in depth)
8. **Implement concurrent session limits** — prevent credential sharing abuse
9. **Plan session migration for store changes** — dual-read strategy
10. **Monitor session store metrics** — memory usage, hit rate, eviction count

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|-------------|--------|-----|
| In-memory sessions | Lost on restart | Redis or JWT |
| Sticky sessions as default | Limits scaling, uneven load | Externalize state |
| No session timeout | Unlimited session lifetime | Absolute + idle timeouts |
| Storing large objects in session | Memory pressure, slow serialization | Store IDs, fetch on demand |
| Single Redis without HA | Session store SPOF | Redis Sentinel or Cluster |
| No session regeneration on login | Session fixation vulnerability | Regenerate on auth change |
| JWT with long expiry | Cannot revoke compromised tokens | Short expiry (15m) + refresh rotation |
| Session in URL query params | Leaks via referrer, logs, bookmarks | Cookie or Authorization header only |

## Enforcement Checklist

- [ ] Session store is external (Redis/JWT), not in-memory
- [ ] Session IDs are cryptographically random (128+ bits)
- [ ] Session regeneration on authentication/privilege change
- [ ] Absolute timeout (8h max) and idle timeout (30m) configured
- [ ] Secure cookie flags set (HttpOnly, Secure, SameSite)
- [ ] Session store has HA configuration (Sentinel/Cluster)
- [ ] Concurrent session limits enforced
- [ ] Session data is minimal (IDs and roles only)
