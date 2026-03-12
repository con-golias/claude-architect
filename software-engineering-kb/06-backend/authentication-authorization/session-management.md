# Session Management

> **AI Plugin Directive — Session Management**
> You are an AI coding assistant. When generating, reviewing, or refactoring session management
> code, follow EVERY rule in this document. Session mismanagement is a critical vulnerability class
> (OWASP A07:2021). Treat each numbered section as a non-negotiable production requirement.

**Core Rule: ALWAYS generate session IDs with cryptographic randomness (128+ bits of entropy). ALWAYS store sessions server-side — the session ID is an opaque reference, NEVER a data container. ALWAYS regenerate session IDs after authentication state changes.**

---

## 1. Session Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   Session Architecture                            │
│                                                                   │
│  Browser                     Server                    Store      │
│    │                           │                         │        │
│    │── POST /login ──────────►│                         │        │
│    │   (credentials)          │                         │        │
│    │                          │── Verify credentials ──►│        │
│    │                          │                         │        │
│    │                          │── Generate session ID   │        │
│    │                          │   sid = random(256 bit) │        │
│    │                          │                         │        │
│    │                          │── Store session ───────►│        │
│    │                          │   key: SHA256(sid)      │        │
│    │                          │   val: {userId, roles,  │        │
│    │                          │         createdAt, ...} │        │
│    │                          │   TTL: 30 minutes       │        │
│    │                          │                         │        │
│    │◄── Set-Cookie: ─────────│                         │        │
│    │    sid=<session_id>;     │                         │        │
│    │    HttpOnly; Secure;    │                         │        │
│    │    SameSite=Lax;        │                         │        │
│    │    Path=/;              │                         │        │
│    │    Max-Age=1800         │                         │        │
│    │                          │                         │        │
│    │── GET /api/data ────────►│                         │        │
│    │   Cookie: sid=<sid>      │── Lookup session ─────►│        │
│    │                          │◄── Session data ───────│        │
│    │                          │                         │        │
│    │◄── Response ─────────── │                         │        │
└──────────────────────────────────────────────────────────────────┘
```

### 1.1 Session vs JWT Comparison

| Dimension | Server Sessions | JWT |
|-----------|----------------|-----|
| State | Server-side (Redis/DB) | Client-side (self-contained) |
| Revocation | Instant (delete from store) | Difficult (needs blacklist) |
| Scalability | Requires shared store | No shared state needed |
| Size | Small cookie (session ID) | Large cookie (full payload) |
| Security | Server controls data | Client can decode payload |
| Complexity | Moderate | Higher (key management) |
| Best for | Traditional web apps, high-security | APIs, microservices, mobile |

---

## 2. Session ID Generation

ALWAYS generate session IDs with sufficient entropy to prevent brute-force guessing:

```
Session ID Requirements:
├── Entropy:  128 bits minimum (256 bits recommended)
├── Source:   CSPRNG (crypto.randomBytes, crypto/rand)
├── Format:   Hex or Base64url (no special characters)
├── Length:   32-64 characters
├── Content:  ZERO information about the user
└── Storage:  Hash before storing (SHA-256)
```

**TypeScript**
```typescript
import crypto from "crypto";

function generateSessionId(): string {
  // 32 bytes = 256 bits of entropy
  return crypto.randomBytes(32).toString("hex");
  // Produces: "a3f2b1c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0"
}

function hashSessionId(sessionId: string): string {
  // ALWAYS hash before storing — prevents session theft via DB leak
  return crypto.createHash("sha256").update(sessionId).digest("hex");
}
```

**Go**
```go
package session

import (
    "crypto/rand"
    "crypto/sha256"
    "encoding/hex"
)

func GenerateSessionID() (string, error) {
    bytes := make([]byte, 32) // 256 bits
    if _, err := rand.Read(bytes); err != nil {
        return "", err
    }
    return hex.EncodeToString(bytes), nil
}

func HashSessionID(sessionID string) string {
    hash := sha256.Sum256([]byte(sessionID))
    return hex.EncodeToString(hash[:])
}
```

**Python**
```python
import secrets
import hashlib

def generate_session_id() -> str:
    return secrets.token_hex(32)  # 256 bits

def hash_session_id(session_id: str) -> str:
    return hashlib.sha256(session_id.encode()).hexdigest()
```

- ALWAYS use CSPRNG — NEVER use `Math.random()`, `rand()`, or UUIDs for session IDs
- ALWAYS hash session IDs before storing in the session store (SHA-256)
- NEVER embed user information in session IDs (no username, no timestamp)
- NEVER use sequential or predictable session ID formats

---

## 3. Session Cookie Configuration

ALWAYS set ALL security attributes on session cookies:

```typescript
import { CookieOptions } from "express";

const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,     // ALWAYS — prevents JavaScript access (XSS protection)
  secure: true,       // ALWAYS — HTTPS only (prevents network interception)
  sameSite: "lax",    // "lax" for navigation, "strict" for maximum protection
  path: "/",          // Scope to entire application
  maxAge: 30 * 60 * 1000, // 30 minutes (sliding window)
  domain: ".myapp.com",   // Restrict to your domain
  // NEVER set "expires" to a date far in the future
};

function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie("sid", sessionId, SESSION_COOKIE_OPTIONS);
}

function clearSessionCookie(res: Response): void {
  res.clearCookie("sid", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
}
```

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `HttpOnly` | `true` | Prevents JavaScript access — mitigates XSS |
| `Secure` | `true` | Cookie sent only over HTTPS |
| `SameSite` | `Lax` or `Strict` | Prevents CSRF attacks |
| `Path` | `/` | Scope to application root |
| `Max-Age` | `1800` (30 min) | Session timeout |
| `Domain` | `.myapp.com` | Restrict to your domain |

### 3.1 SameSite Values

| Value | Behavior | Use Case |
|-------|----------|----------|
| `Strict` | Cookie sent ONLY on same-site requests | Banking, high-security apps |
| `Lax` | Cookie sent on top-level navigation + same-site | Default for most apps |
| `None` | Cookie sent on all requests (requires `Secure`) | Cross-site embeds, iframes |

ALWAYS use `Lax` as minimum. Use `Strict` for sensitive applications. NEVER use `None` unless cross-site functionality is explicitly required (and add CSRF tokens).

---

## 4. Session Store

### 4.1 Store Comparison

| Store | Speed | Scalability | Persistence | Use Case |
|-------|-------|-------------|-------------|----------|
| **Redis** | Fastest | Horizontal (cluster) | Configurable | PREFERRED for production |
| **PostgreSQL** | Fast | Vertical + read replicas | YES | Audit trail, compliance |
| **DynamoDB** | Fast | Automatic | YES | AWS ecosystem |
| **Memcached** | Fastest | Horizontal | NO | Ephemeral, no persistence |
| In-memory | Fastest | Single process | NO | Development only |
| File system | Slow | Single server | YES | NEVER in production |

ALWAYS use Redis for session storage in production. Use PostgreSQL when audit trail / compliance requires durable session records.

### 4.2 Redis Session Store

**TypeScript**
```typescript
import Redis from "ioredis";

interface SessionData {
  userId: string;
  roles: string[];
  createdAt: number;
  lastActivity: number;
  ip: string;
  userAgent: string;
  deviceId?: string;
}

class RedisSessionStore {
  private prefix = "session:";
  private ttl = 1800; // 30 minutes

  constructor(private redis: Redis) {}

  async create(sessionId: string, data: SessionData): Promise<void> {
    const hashedId = hashSessionId(sessionId);
    await this.redis.setex(
      `${this.prefix}${hashedId}`,
      this.ttl,
      JSON.stringify(data)
    );
  }

  async get(sessionId: string): Promise<SessionData | null> {
    const hashedId = hashSessionId(sessionId);
    const raw = await this.redis.get(`${this.prefix}${hashedId}`);
    if (!raw) return null;

    // Sliding window: refresh TTL on access
    await this.redis.expire(`${this.prefix}${hashedId}`, this.ttl);

    return JSON.parse(raw);
  }

  async update(sessionId: string, data: Partial<SessionData>): Promise<void> {
    const hashedId = hashSessionId(sessionId);
    const existing = await this.get(sessionId);
    if (!existing) throw new Error("Session not found");

    await this.redis.setex(
      `${this.prefix}${hashedId}`,
      this.ttl,
      JSON.stringify({ ...existing, ...data, lastActivity: Date.now() })
    );
  }

  async destroy(sessionId: string): Promise<void> {
    const hashedId = hashSessionId(sessionId);
    await this.redis.del(`${this.prefix}${hashedId}`);
  }

  async destroyAllForUser(userId: string): Promise<void> {
    // Use a secondary index: user:{userId}:sessions → Set of session hashes
    const sessionKeys = await this.redis.smembers(
      `user:${userId}:sessions`
    );
    if (sessionKeys.length > 0) {
      await this.redis.del(...sessionKeys.map((k) => `${this.prefix}${k}`));
      await this.redis.del(`user:${userId}:sessions`);
    }
  }

  // Track sessions per user for "active sessions" UI
  async trackSession(userId: string, sessionId: string): Promise<void> {
    const hashedId = hashSessionId(sessionId);
    await this.redis.sadd(`user:${userId}:sessions`, hashedId);
    await this.redis.expire(`user:${userId}:sessions`, 30 * 24 * 3600); // 30 days
  }
}
```

**Go**
```go
type RedisSessionStore struct {
    rdb    *redis.Client
    prefix string
    ttl    time.Duration
}

func NewRedisSessionStore(rdb *redis.Client) *RedisSessionStore {
    return &RedisSessionStore{
        rdb:    rdb,
        prefix: "session:",
        ttl:    30 * time.Minute,
    }
}

func (s *RedisSessionStore) Create(ctx context.Context, sid string, data *SessionData) error {
    hashedID := HashSessionID(sid)
    encoded, err := json.Marshal(data)
    if err != nil {
        return err
    }
    return s.rdb.SetEx(ctx, s.prefix+hashedID, string(encoded), s.ttl).Err()
}

func (s *RedisSessionStore) Get(ctx context.Context, sid string) (*SessionData, error) {
    hashedID := HashSessionID(sid)
    raw, err := s.rdb.Get(ctx, s.prefix+hashedID).Result()
    if err == redis.Nil {
        return nil, nil
    }
    if err != nil {
        return nil, err
    }

    // Sliding window: refresh TTL
    s.rdb.Expire(ctx, s.prefix+hashedID, s.ttl)

    var data SessionData
    return &data, json.Unmarshal([]byte(raw), &data)
}

func (s *RedisSessionStore) Destroy(ctx context.Context, sid string) error {
    hashedID := HashSessionID(sid)
    return s.rdb.Del(ctx, s.prefix+hashedID).Err()
}
```

---

## 5. Session Lifecycle

### 5.1 Session Creation (Login)

```typescript
async function login(req: Request, res: Response) {
  const { username, password } = req.body;

  // 1. Authenticate user
  const user = await authenticate(username, password);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // 2. Regenerate session ID (prevent session fixation)
  const sessionId = generateSessionId();

  // 3. Create session
  await sessionStore.create(sessionId, {
    userId: user.id,
    roles: user.roles,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    ip: req.ip,
    userAgent: req.headers["user-agent"] || "",
  });

  // 4. Track session for user
  await sessionStore.trackSession(user.id, sessionId);

  // 5. Set cookie
  setSessionCookie(res, sessionId);

  // 6. Log security event
  await auditLog.record({
    event: "login",
    userId: user.id,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ user: { id: user.id, name: user.name } });
}
```

### 5.2 Session Validation (Middleware)

```typescript
async function sessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const sessionId = req.cookies.sid;
  if (!sessionId) {
    return res.status(401).json({ error: "No session" });
  }

  const session = await sessionStore.get(sessionId);
  if (!session) {
    clearSessionCookie(res);
    return res.status(401).json({ error: "Session expired" });
  }

  // Absolute timeout check (e.g., 8 hours max)
  const MAX_SESSION_AGE = 8 * 60 * 60 * 1000;
  if (Date.now() - session.createdAt > MAX_SESSION_AGE) {
    await sessionStore.destroy(sessionId);
    clearSessionCookie(res);
    return res.status(401).json({ error: "Session expired" });
  }

  // Optional: IP binding (strict mode)
  // if (session.ip !== req.ip) {
  //   await sessionStore.destroy(sessionId);
  //   return res.status(401).json({ error: "Session invalid" });
  // }

  // Update last activity
  await sessionStore.update(sessionId, { lastActivity: Date.now() });

  req.session = session;
  next();
}
```

### 5.3 Session Regeneration

ALWAYS regenerate the session ID after any authentication state change:

```typescript
async function regenerateSession(
  req: Request,
  res: Response,
  additionalData?: Partial<SessionData>
): Promise<string> {
  const oldSessionId = req.cookies.sid;

  // 1. Get existing session data
  const existingSession = oldSessionId
    ? await sessionStore.get(oldSessionId)
    : null;

  // 2. Destroy old session
  if (oldSessionId) {
    await sessionStore.destroy(oldSessionId);
  }

  // 3. Generate new session ID
  const newSessionId = generateSessionId();

  // 4. Create new session with merged data
  await sessionStore.create(newSessionId, {
    ...existingSession,
    ...additionalData,
    lastActivity: Date.now(),
  });

  // 5. Set new cookie
  setSessionCookie(res, newSessionId);

  return newSessionId;
}
```

ALWAYS regenerate sessions on:
- Successful login
- Privilege escalation (user → admin)
- Password change
- MFA verification
- OAuth account linking

### 5.4 Logout

```typescript
async function logout(req: Request, res: Response) {
  const sessionId = req.cookies.sid;

  if (sessionId) {
    const session = await sessionStore.get(sessionId);

    // Destroy session
    await sessionStore.destroy(sessionId);

    // Log security event
    if (session) {
      await auditLog.record({
        event: "logout",
        userId: session.userId,
        ip: req.ip,
      });
    }
  }

  // Clear cookie
  clearSessionCookie(res);

  res.json({ message: "Logged out" });
}

// Logout from ALL devices
async function logoutAll(req: Request, res: Response) {
  const session = req.session;

  // Destroy all sessions for this user
  await sessionStore.destroyAllForUser(session.userId);

  // Clear cookie
  clearSessionCookie(res);

  await auditLog.record({
    event: "logout_all_devices",
    userId: session.userId,
    ip: req.ip,
  });

  res.json({ message: "Logged out from all devices" });
}
```

---

## 6. Session Timeout Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                 Session Timeout Strategy                       │
│                                                               │
│  Idle Timeout (Sliding Window):                               │
│  ├── Timer resets on EVERY request                            │
│  ├── Default: 30 minutes                                      │
│  ├── Sensitive apps: 15 minutes                               │
│  └── Low-risk apps: 60 minutes                                │
│                                                               │
│  Absolute Timeout (Hard Limit):                               │
│  ├── Timer starts at login, NEVER resets                      │
│  ├── Default: 8 hours                                         │
│  ├── Sensitive apps: 4 hours                                  │
│  └── Forces re-authentication regardless of activity          │
│                                                               │
│  Timeline:                                                    │
│  ├── Login at 9:00 AM                                         │
│  ├── Active until 12:00 PM (idle timeout keeps resetting)     │
│  ├── Lunch break 12:00 - 1:00 PM                              │
│  ├── 12:30 PM: Idle timeout expires (30 min inactivity)       │
│  └── Even if active, session expires at 5:00 PM (8h absolute) │
│                                                               │
│  ┌──────────────────────────────────────┐                     │
│  │ 9AM        12PM  12:30  1PM    5PM   │                     │
│  │  ├──active──┤     │              │    │                     │
│  │  │  idle resets    │ idle expired │    │                     │
│  │  ├────────absolute timeout────────┤    │                     │
│  └──────────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

| Application Type | Idle Timeout | Absolute Timeout |
|-----------------|-------------|------------------|
| Banking / Financial | 5-15 min | 4 hours |
| Healthcare / Medical | 15 min | 8 hours |
| Enterprise / Internal | 30 min | 8-12 hours |
| E-commerce | 60 min | 24 hours |
| Social / Low-risk | 60 min | 30 days |

- ALWAYS implement BOTH idle and absolute timeouts
- ALWAYS use the idle timeout as the Redis TTL (sliding window via `EXPIRE` on access)
- ALWAYS check absolute timeout in application code (`createdAt` + max age)
- ALWAYS warn users before session expiry (e.g., 2 minutes before idle timeout)

---

## 7. Active Sessions Management

ALWAYS provide users with visibility and control over their active sessions:

```typescript
// GET /api/sessions — List active sessions
async function listActiveSessions(req: Request, res: Response) {
  const sessions = await sessionStore.getUserSessions(req.session.userId);

  res.json({
    sessions: sessions.map((s) => ({
      id: s.id, // Truncated/hashed — NEVER expose full session ID
      current: s.id === hashSessionId(req.cookies.sid),
      ip: s.ip,
      userAgent: s.userAgent,
      location: await geolocate(s.ip), // Optional
      createdAt: s.createdAt,
      lastActivity: s.lastActivity,
    })),
  });
}

// DELETE /api/sessions/:id — Revoke a specific session
async function revokeSession(req: Request, res: Response) {
  const { id } = req.params;
  const session = await sessionStore.getByHashedId(id);

  if (!session || session.userId !== req.session.userId) {
    return res.status(404).json({ error: "Session not found" });
  }

  await sessionStore.destroyByHashedId(id);

  await auditLog.record({
    event: "session_revoked",
    userId: req.session.userId,
    targetSessionId: id,
    ip: req.ip,
  });

  res.json({ message: "Session revoked" });
}
```

- ALWAYS allow users to see all active sessions (device, IP, last activity)
- ALWAYS allow users to revoke individual sessions
- ALWAYS allow users to revoke ALL sessions except the current one
- ALWAYS mark the current session distinctly in the list
- NEVER expose the raw session ID in the API — use the hashed version

---

## 8. Session Fixation Prevention

Session fixation attacks occur when an attacker sets a known session ID before the victim authenticates:

```
Session Fixation Attack:
┌──────────────────────────────────────────────────────────┐
│                                                           │
│  1. Attacker gets a valid session ID (visits the app)    │
│     sid = "attacker-known-session-id"                    │
│                                                           │
│  2. Attacker tricks victim into using this session ID    │
│     (via URL param, XSS, or cookie injection)            │
│                                                           │
│  3. Victim logs in using the attacker's session ID       │
│     (session now has authenticated user data)            │
│                                                           │
│  4. Attacker uses the SAME session ID to access          │
│     the victim's authenticated session                   │
│                                                           │
│  PREVENTION:                                              │
│  ├── ALWAYS regenerate session ID after login            │
│  ├── ALWAYS reject session IDs from URL parameters       │
│  ├── ALWAYS bind session to initial client fingerprint   │
│  └── ALWAYS use HttpOnly cookies (not URL-based SIDs)    │
└──────────────────────────────────────────────────────────┘
```

- ALWAYS regenerate the session ID after successful authentication
- NEVER accept session IDs from URL parameters or POST data
- NEVER accept session IDs that were not generated by the server
- ALWAYS validate that the session was created by the server (check existence in store)

---

## 9. CSRF Protection with Sessions

When using cookie-based sessions, ALWAYS implement CSRF protection:

### 9.1 Synchronizer Token Pattern

```typescript
import crypto from "crypto";

// Generate CSRF token and store in session
function generateCSRFToken(session: SessionData): string {
  const token = crypto.randomBytes(32).toString("hex");
  session.csrfToken = token;
  return token;
}

// Middleware to validate CSRF token
function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip for safe methods (GET, HEAD, OPTIONS)
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const csrfToken =
    req.headers["x-csrf-token"] ||
    req.body._csrf;

  if (!csrfToken || csrfToken !== req.session.csrfToken) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  next();
}

// Send CSRF token to client
app.get("/api/csrf-token", sessionMiddleware, (req, res) => {
  const token = generateCSRFToken(req.session);
  res.json({ csrfToken: token });
});
```

### 9.2 Double Submit Cookie Pattern

```typescript
// Set CSRF token as a separate non-HttpOnly cookie
function setCSRFCookie(res: Response): string {
  const token = crypto.randomBytes(32).toString("hex");
  res.cookie("csrf-token", token, {
    httpOnly: false,  // JavaScript must read this
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 60 * 1000,
  });
  return token;
}

// Client sends token in both cookie AND header
// Middleware validates they match
function doubleSubmitCSRF(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies["csrf-token"];
  const headerToken = req.headers["x-csrf-token"];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "CSRF validation failed" });
  }

  next();
}
```

- ALWAYS implement CSRF protection for cookie-based sessions
- ALWAYS use `SameSite=Lax` or `Strict` as the primary CSRF defense
- ALWAYS add a synchronizer token OR double-submit cookie as a secondary defense
- NEVER rely solely on `SameSite` — older browsers may not support it

---

## 10. Distributed Sessions

### 10.1 Redis Cluster for Sessions

```typescript
import Redis from "ioredis";

// Redis Cluster for high availability
const redis = new Redis.Cluster([
  { host: "redis-1.example.com", port: 6379 },
  { host: "redis-2.example.com", port: 6379 },
  { host: "redis-3.example.com", port: 6379 },
], {
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
    tls: {}, // ALWAYS use TLS in production
  },
  scaleReads: "slave", // Read from replicas for performance
});
```

### 10.2 Session Affinity (Sticky Sessions)

```nginx
# Nginx — sticky sessions via cookie
upstream app_servers {
    hash $cookie_sid consistent;
    server app1:3000;
    server app2:3000;
    server app3:3000;
}
```

- ALWAYS use Redis Cluster or Redis Sentinel for high availability
- ALWAYS enable TLS for Redis connections in production
- ALWAYS configure Redis persistence (AOF or RDB) for session durability
- NEVER use sticky sessions as a replacement for shared session storage
- ALWAYS handle Redis connection failures gracefully (fallback to re-authentication)

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Session data in cookie | Cookie contains user data, tamperable | Store data server-side, cookie holds only session ID |
| Predictable session IDs | Sequential IDs allow session guessing | Use CSPRNG with 256-bit entropy |
| No session regeneration | Session fixation attacks succeed | Regenerate session ID on login/privilege change |
| Session ID in URL | Session leaked via Referer, bookmarks, logs | Use HttpOnly cookies only |
| No idle timeout | Abandoned sessions stay valid forever | 30-minute sliding window |
| No absolute timeout | Sessions valid for months | 8-hour hard limit |
| In-memory store (prod) | Sessions lost on restart/deploy | Use Redis or database |
| Missing HttpOnly | XSS can steal session cookies | ALWAYS set HttpOnly |
| Missing Secure flag | Session cookie sent over HTTP | ALWAYS set Secure |
| No SameSite | CSRF attacks succeed | Set SameSite=Lax minimum |
| Session ID not hashed | DB leak exposes all sessions | Hash (SHA-256) before storing |
| No session revocation API | Users can't log out other devices | Provide active sessions UI |
| No CSRF protection | Cookie-based sessions vulnerable to CSRF | Synchronizer token + SameSite |
| Storing sensitive data in session | Session store compromise exposes secrets | Store only IDs and references |

---

## 12. Enforcement Checklist

- [ ] Session IDs generated with CSPRNG (256-bit entropy minimum)
- [ ] Session IDs hashed (SHA-256) before storing in session store
- [ ] Session cookie: `HttpOnly=true`, `Secure=true`, `SameSite=Lax`
- [ ] Session cookie `Path` restricted appropriately
- [ ] Session regenerated after login, privilege escalation, password change
- [ ] Idle timeout implemented (30 min default, sliding window)
- [ ] Absolute timeout implemented (8 hours default, hard limit)
- [ ] Redis used as session store in production (with TLS)
- [ ] CSRF protection implemented (synchronizer token or double submit)
- [ ] Active sessions list available to users
- [ ] Individual session revocation supported
- [ ] "Logout all devices" functionality available
- [ ] Session fixation prevention (reject external session IDs)
- [ ] No session data in URL parameters
- [ ] Session data stored server-side — cookie contains ONLY session ID
- [ ] Security events logged (login, logout, session revocation)
- [ ] Graceful handling of session store failures
