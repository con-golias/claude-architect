# Session Management

> **Domain:** Security > Secure Coding > Session Management
> **Difficulty:** Intermediate to Advanced
> **Last Updated:** --

## Why It Matters

Session management is the mechanism that binds an authenticated user to a sequence of HTTP requests. HTTP is stateless -- every request arrives with no memory of the previous one. Sessions bridge this gap by issuing a token (session ID) after authentication and requiring it on every subsequent request. If session management is broken, authentication is broken. An attacker who steals, predicts, or fixates a session ID inherits the victim's identity, permissions, and access -- without ever knowing the password.

Session vulnerabilities consistently appear in the OWASP Top 10. Session hijacking, session fixation, cross-site request forgery, and insecure token storage are attack vectors that bypass even the strongest authentication. A system with multi-factor authentication and Argon2id password hashing is worthless if the session ID is transmitted over plain HTTP, stored in localStorage accessible to XSS, or never expires.

This guide covers every aspect of secure session management: generation, transport, storage, lifecycle, and destruction.

---

## Session Security Concepts

### 1. Session ID Security

A session ID is the single credential that represents an authenticated user for the duration of their session. If an attacker can guess, predict, or brute-force a session ID, they gain full access. Session IDs must be generated using a Cryptographically Secure Pseudo-Random Number Generator (CSPRNG) with a minimum of 128 bits of entropy.

```
Session ID Requirements:
  +-----------------------+-----------------------------------------------+
  | Property              | Requirement                                   |
  +-----------------------+-----------------------------------------------+
  | Entropy source        | CSPRNG (not Math.random, not time-based)      |
  | Minimum entropy       | 128 bits (256 bits recommended)               |
  | Character set         | Alphanumeric or hex (avoid special chars)     |
  | Minimum length        | 32 hex chars (128 bits) or 43 base64 chars    |
  | Predictability        | Must pass statistical randomness tests        |
  | Uniqueness            | Collision probability must be negligible       |
  +-----------------------+-----------------------------------------------+
```

**TypeScript -- Generating a session ID with crypto.randomBytes:**

```typescript
import crypto from "crypto";

// SECURE: 256 bits of entropy from Node.js CSPRNG
function generateSessionId(): string {
  return crypto.randomBytes(32).toString("hex"); // 64 hex characters
}

// SECURE: URL-safe base64 variant
function generateSessionIdBase64(): string {
  return crypto.randomBytes(32).toString("base64url"); // 43 characters
}

// INSECURE -- NEVER DO THIS:
// Math.random() is not cryptographically secure
// function generateSessionId(): string {
//   return Math.random().toString(36).substring(2); // Predictable, low entropy
// }
```

**Go -- Generating a session ID with crypto/rand:**

```go
package session

import (
    "crypto/rand"
    "encoding/hex"
    "fmt"
)

// SECURE: 256 bits from crypto/rand (reads from /dev/urandom on Linux)
func GenerateSessionID() (string, error) {
    b := make([]byte, 32)
    _, err := rand.Read(b)
    if err != nil {
        return "", fmt.Errorf("failed to generate session ID: %w", err)
    }
    return hex.EncodeToString(b), nil
}

// INSECURE -- NEVER DO THIS:
// import "math/rand"
// func GenerateSessionID() string {
//     return fmt.Sprintf("%d", rand.Int63()) // Predictable PRNG
// }
```

**Python -- Generating a session ID with the secrets module:**

```python
import secrets

# SECURE: 256 bits from the secrets module (uses os.urandom internally)
def generate_session_id() -> str:
    return secrets.token_hex(32)  # 64 hex characters, 256 bits

# SECURE: URL-safe base64 variant
def generate_session_id_urlsafe() -> str:
    return secrets.token_urlsafe(32)  # 43 characters, 256 bits

# INSECURE -- NEVER DO THIS:
# import random
# def generate_session_id():
#     return str(random.randint(0, 999999999))  # Predictable, low entropy
```

**Java -- Generating a session ID with SecureRandom:**

```java
import java.security.SecureRandom;
import java.util.HexFormat;

public class SessionIdGenerator {
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int SESSION_ID_BYTES = 32; // 256 bits

    // SECURE: SecureRandom backed by platform CSPRNG
    public static String generateSessionId() {
        byte[] bytes = new byte[SESSION_ID_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    // INSECURE -- NEVER DO THIS:
    // public static String generateSessionId() {
    //     return String.valueOf(new Random().nextLong()); // Predictable
    // }
}
```

---

### 2. Cookie Security Attributes

Session IDs are transported via HTTP cookies. Every security attribute on the cookie header exists to prevent a specific attack. Omitting any attribute opens a corresponding attack vector.

```
Cookie Security Attributes:
  +-------------+--------------------------------------------------------------+
  | Attribute   | Purpose                                                      |
  +-------------+--------------------------------------------------------------+
  | HttpOnly    | Prevents JavaScript from reading the cookie (blocks XSS      |
  |             | from stealing session IDs via document.cookie)               |
  | Secure      | Cookie is only sent over HTTPS (prevents interception        |
  |             | on unencrypted HTTP connections)                             |
  | SameSite    | Controls when the cookie is sent with cross-origin requests  |
  |             | (primary defense against CSRF)                               |
  | Path        | Restricts cookie to a specific URL path                      |
  | Domain      | Restricts cookie to a specific domain                        |
  | Max-Age     | Sets cookie lifetime in seconds (prefer over Expires)        |
  | __Host-     | Prefix that enforces Secure + Path=/ + no Domain attribute   |
  | __Secure-   | Prefix that enforces Secure attribute                        |
  +-------------+--------------------------------------------------------------+
```

**SameSite values -- when to use each:**

```
SameSite=Strict:
  - Cookie is NEVER sent on cross-site requests
  - Use for: session cookies on applications where users always navigate directly
  - Caveat: breaks incoming links from other sites (user appears logged out)

SameSite=Lax:
  - Cookie is sent on top-level navigation GET requests from other sites
  - Cookie is NOT sent on cross-site POST, iframe, or AJAX requests
  - Use for: session cookies on most web applications (recommended default)
  - Balances security and usability

SameSite=None:
  - Cookie is sent on ALL cross-site requests
  - REQUIRES Secure attribute
  - Use for: third-party integrations, embedded widgets, OAuth flows
  - Must be combined with other CSRF protections
```

**TypeScript (Express) -- Setting secure cookie attributes:**

```typescript
import express from "express";
import session from "express-session";
import RedisStore from "connect-redis";
import { createClient } from "redis";

const app = express();
const redisClient = createClient({ url: process.env.REDIS_URL });

app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    name: "__Host-sid", // __Host- prefix enforces Secure + Path=/
    secret: process.env.SESSION_SECRET!, // Used to sign the session ID cookie
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,     // JavaScript cannot read this cookie
      secure: true,       // Only sent over HTTPS
      sameSite: "lax",    // Sent on top-level navigations, blocked on cross-site POST
      path: "/",          // Available on all paths
      maxAge: 3600_000,   // 1 hour in milliseconds
      // domain is intentionally omitted -- __Host- prefix forbids it
    },
    genid: () => {
      // Override default session ID generator with CSPRNG
      return crypto.randomBytes(32).toString("hex");
    },
  })
);
```

**Go -- Setting secure cookie attributes:**

```go
import (
    "net/http"
    "time"
)

func setSessionCookie(w http.ResponseWriter, sessionID string) {
    http.SetCookie(w, &http.Cookie{
        Name:     "__Host-sid",
        Value:    sessionID,
        Path:     "/",
        // Domain is intentionally omitted -- __Host- prefix requires this
        MaxAge:   3600,             // 1 hour
        HttpOnly: true,             // Not accessible via JavaScript
        Secure:   true,             // HTTPS only
        SameSite: http.SameSiteLaxMode,
    })
}
```

**Python (Flask) -- Setting secure cookie attributes:**

```python
from flask import Flask

app = Flask(__name__)
app.config.update(
    SESSION_COOKIE_NAME="__Host-sid",
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_PATH="/",
    PERMANENT_SESSION_LIFETIME=3600,  # 1 hour
)
```

**Python (Django) -- Setting secure cookie attributes:**

```python
# settings.py
SESSION_COOKIE_NAME = "__Host-sid"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_PATH = "/"
SESSION_COOKIE_AGE = 3600  # 1 hour
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "Lax"
```

**Java (Spring) -- Setting secure cookie attributes:**

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration
public class SessionConfig {

    @Bean
    public CookieSerializer cookieSerializer() {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setCookieName("__Host-sid");
        serializer.setUseHttpOnlyCookie(true);
        serializer.setUseSecureCookie(true);
        serializer.setSameSite("Lax");
        serializer.setCookiePath("/");
        serializer.setCookieMaxAge(3600); // 1 hour
        return serializer;
    }
}
```

---

### 3. Session Storage

Session data can be stored server-side or client-side. Server-side storage is the default recommendation because the server retains full control over session state, including the ability to revoke sessions instantly.

```
Session Storage Comparison:

  Server-Side (Recommended)
  +-------------------+---------------------------+---------------------------+
  | Store             | Pros                      | Cons                      |
  +-------------------+---------------------------+---------------------------+
  | Redis             | Fast, TTL support,        | External dependency,      |
  |                   | atomic operations,        | requires HA setup for     |
  |                   | built-in expiration       | production                |
  +-------------------+---------------------------+---------------------------+
  | Database          | Durable, queryable,       | Slower, requires cleanup  |
  | (PostgreSQL, etc) | no extra infrastructure   | of expired sessions       |
  +-------------------+---------------------------+---------------------------+
  | In-Memory         | Fastest, no dependencies  | Lost on restart, cannot   |
  |                   |                           | scale horizontally        |
  +-------------------+---------------------------+---------------------------+

  Client-Side (Use with caution)
  +-------------------+---------------------------+---------------------------+
  | Store             | Pros                      | Cons                      |
  +-------------------+---------------------------+---------------------------+
  | JWT               | Stateless, no server      | Cannot revoke instantly,  |
  |                   | storage needed, scales    | size grows with claims,   |
  |                   | horizontally              | token theft = full access |
  +-------------------+---------------------------+---------------------------+
  | Encrypted Cookie  | Stateless, tamper-proof   | 4KB size limit, cannot    |
  |                   | if encrypted properly     | revoke without blacklist  |
  +-------------------+---------------------------+---------------------------+
```

**TypeScript -- Redis session store implementation:**

```typescript
import { createClient, RedisClientType } from "redis";
import crypto from "crypto";

interface SessionData {
  userId: string;
  roles: string[];
  createdAt: number;
  lastActivity: number;
  ipAddress: string;
  userAgent: string;
}

class RedisSessionStore {
  private client: RedisClientType;
  private prefix = "session:";
  private absoluteTimeout = 8 * 3600;  // 8 hours maximum session lifetime
  private idleTimeout = 1800;          // 30 minutes idle timeout

  constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async create(data: Omit<SessionData, "createdAt" | "lastActivity">): Promise<string> {
    const sessionId = crypto.randomBytes(32).toString("hex");
    const sessionData: SessionData = {
      ...data,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    // Store with absolute timeout as TTL
    await this.client.set(
      this.prefix + sessionId,
      JSON.stringify(sessionData),
      { EX: this.absoluteTimeout }
    );

    // Track active sessions per user (for concurrent session control)
    await this.client.sAdd(`user_sessions:${data.userId}`, sessionId);

    return sessionId;
  }

  async get(sessionId: string): Promise<SessionData | null> {
    const raw = await this.client.get(this.prefix + sessionId);
    if (!raw) return null;

    const data: SessionData = JSON.parse(raw);

    // Check idle timeout
    const idleTime = (Date.now() - data.lastActivity) / 1000;
    if (idleTime > this.idleTimeout) {
      await this.destroy(sessionId, data.userId);
      return null;
    }

    // Update last activity (sliding window)
    data.lastActivity = Date.now();
    const remainingTTL = await this.client.ttl(this.prefix + sessionId);
    await this.client.set(
      this.prefix + sessionId,
      JSON.stringify(data),
      { EX: remainingTTL > 0 ? remainingTTL : this.absoluteTimeout }
    );

    return data;
  }

  async destroy(sessionId: string, userId: string): Promise<void> {
    await this.client.del(this.prefix + sessionId);
    await this.client.sRem(`user_sessions:${userId}`, sessionId);
  }

  async destroyAllForUser(userId: string): Promise<number> {
    const sessionIds = await this.client.sMembers(`user_sessions:${userId}`);
    if (sessionIds.length === 0) return 0;

    const keys = sessionIds.map((id) => this.prefix + id);
    await this.client.del(keys);
    await this.client.del(`user_sessions:${userId}`);
    return sessionIds.length;
  }

  async rotate(oldSessionId: string, userId: string): Promise<string> {
    const data = await this.get(oldSessionId);
    if (!data) throw new Error("Session not found");

    // Destroy old session and create new one atomically
    await this.destroy(oldSessionId, userId);
    return this.create({
      userId: data.userId,
      roles: data.roles,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });
  }
}
```

**Go -- Redis session store with scs:**

```go
package main

import (
    "net/http"
    "time"

    "github.com/alexedwards/scs/redisstore"
    "github.com/alexedwards/scs/v2"
    "github.com/gomodule/redigo/redis"
)

func main() {
    pool := &redis.Pool{
        MaxIdle: 10,
        Dial: func() (redis.Conn, error) {
            return redis.Dial("tcp", "localhost:6379")
        },
    }

    sessionManager := scs.New()
    sessionManager.Store = redisstore.New(pool)
    sessionManager.Lifetime = 8 * time.Hour            // Absolute timeout
    sessionManager.IdleTimeout = 30 * time.Minute       // Idle timeout
    sessionManager.Cookie.Name = "__Host-sid"
    sessionManager.Cookie.HttpOnly = true
    sessionManager.Cookie.Secure = true
    sessionManager.Cookie.SameSite = http.SameSiteLaxMode
    sessionManager.Cookie.Path = "/"

    mux := http.NewServeMux()
    mux.HandleFunc("/login", loginHandler(sessionManager))

    // Wrap entire mux with session middleware
    http.ListenAndServeTLS(":443", "cert.pem", "key.pem", sessionManager.LoadAndSave(mux))
}
```

---

### 4. Session Lifecycle

Every session must follow a strict lifecycle: creation, validation, renewal, and destruction. Skipping any stage introduces vulnerabilities.

```
Session Lifecycle:

  Login Request        Authenticated Requests       Privilege Change        Logout
  ┌─────────┐         ┌──────────────────┐         ┌───────────────┐     ┌──────────┐
  │ Verify   │         │ Validate session │         │ Regenerate    │     │ Destroy  │
  │ creds    │────>    │ on EVERY request │────>    │ session ID    │     │ session  │
  │ Create   │         │ Check timeouts   │         │ Keep data     │     │ Clear    │
  │ session  │         │ Update activity  │         │ Destroy old   │     │ cookie   │
  └─────────┘         └──────────────────┘         └───────────────┘     └──────────┘
       |                      |                           |                    |
  Set cookie            Return 401 if               After password       Invalidate
  with session ID       session invalid             change, role         server-side
                                                    escalation, MFA      session data
```

**TypeScript (Express) -- Complete session lifecycle:**

```typescript
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

// CREATION: After successful authentication
async function loginHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const user = await authenticateUser(email, password);

  if (!user) {
    // Generic error -- do not reveal whether email exists
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Destroy any pre-authentication session to prevent fixation
  if (req.session) {
    await destroySession(req.sessionID);
  }

  // Create new session with fresh ID
  const sessionId = crypto.randomBytes(32).toString("hex");
  await sessionStore.create(sessionId, {
    userId: user.id,
    roles: user.roles,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] || "unknown",
  });

  setSessionCookie(res, sessionId);
  res.json({ success: true });
}

// VALIDATION: On every request via middleware
async function sessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const sessionId = req.cookies["__Host-sid"];
  if (!sessionId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const session = await sessionStore.get(sessionId);
  if (!session) {
    // Session expired or does not exist -- clear the stale cookie
    clearSessionCookie(res);
    res.status(401).json({ error: "Session expired" });
    return;
  }

  // Attach session data to request for downstream handlers
  req.session = session;
  req.sessionID = sessionId;
  next();
}

// RENEWAL: After privilege changes
async function changeRoleHandler(req: Request, res: Response): Promise<void> {
  // Regenerate session ID to prevent fixation after privilege escalation
  const newSessionId = await sessionStore.rotate(req.sessionID, req.session.userId);
  setSessionCookie(res, newSessionId);
  res.json({ success: true });
}

// DESTRUCTION: On logout
async function logoutHandler(req: Request, res: Response): Promise<void> {
  await sessionStore.destroy(req.sessionID, req.session.userId);
  clearSessionCookie(res);
  res.json({ success: true });
}

function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie("__Host-sid", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600_000,
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie("__Host-sid", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
}
```

**Go -- Session validation middleware:**

```go
func SessionMiddleware(store SessionStore) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            cookie, err := r.Cookie("__Host-sid")
            if err != nil {
                http.Error(w, `{"error":"authentication required"}`, http.StatusUnauthorized)
                return
            }

            session, err := store.Get(r.Context(), cookie.Value)
            if err != nil || session == nil {
                // Clear stale cookie
                http.SetCookie(w, &http.Cookie{
                    Name:     "__Host-sid",
                    Value:    "",
                    Path:     "/",
                    MaxAge:   -1,
                    HttpOnly: true,
                    Secure:   true,
                    SameSite: http.SameSiteLaxMode,
                })
                http.Error(w, `{"error":"session expired"}`, http.StatusUnauthorized)
                return
            }

            // Attach session to context
            ctx := context.WithValue(r.Context(), sessionKey, session)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

---

### 5. Session Fixation Prevention

Session fixation occurs when an attacker sets (fixes) a session ID on the victim's browser before the victim authenticates. After the victim logs in, the attacker uses the same session ID to impersonate the victim.

```
Session Fixation Attack:

  1. Attacker obtains a valid session ID (e.g., visits the login page)
     Attacker gets: session_id = "abc123"

  2. Attacker tricks victim into using that session ID
     (via URL parameter, XSS, or meta tag injection)
     Victim's browser now has: session_id = "abc123"

  3. Victim authenticates (logs in) with session_id = "abc123"
     Server associates "abc123" with the victim's account

  4. Attacker uses session_id = "abc123" -- now authenticated as the victim

  Defense: REGENERATE the session ID after authentication
  -------
  After login, old "abc123" is invalidated.
  New session ID "xyz789" is issued.
  Attacker's "abc123" is now worthless.
```

**TypeScript -- Session fixation defense:**

```typescript
async function loginHandler(req: Request, res: Response): Promise<void> {
  const user = await authenticateUser(req.body.email, req.body.password);
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // CRITICAL: Destroy the pre-authentication session
  const oldSessionId = req.cookies["__Host-sid"];
  if (oldSessionId) {
    await sessionStore.destroy(oldSessionId);
  }

  // CRITICAL: Issue a completely new session ID after authentication
  const newSessionId = crypto.randomBytes(32).toString("hex");
  await sessionStore.create(newSessionId, {
    userId: user.id,
    roles: user.roles,
    authenticatedAt: Date.now(),
  });

  setSessionCookie(res, newSessionId);
  res.json({ success: true });
}
```

**Python (Flask) -- Session regeneration:**

```python
from flask import session, request
import secrets

@app.route("/login", methods=["POST"])
def login():
    user = authenticate(request.form["email"], request.form["password"])
    if not user:
        return {"error": "Invalid email or password"}, 401

    # CRITICAL: Regenerate session to prevent fixation
    # Flask does not do this automatically -- you must clear and recreate
    session.clear()
    session.regenerate()  # Or: session.sid = secrets.token_hex(32)

    session["user_id"] = user.id
    session["roles"] = user.roles
    session["authenticated_at"] = time.time()
    session.permanent = True

    return {"success": True}
```

**Java (Spring) -- Session fixation protection:**

```java
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .sessionManagement(session -> session
                // Create a new session after authentication, migrate attributes
                .sessionFixation().migrateSession()
                // Alternative: .newSession() -- creates new session, does NOT migrate
                .maximumSessions(3)
                .maxSessionsPreventsLogin(false) // Expire oldest session
            );
        return http.build();
    }
}
```

---

### 6. Session Hijacking Prevention

Session hijacking occurs when an attacker obtains a valid session ID through network interception, XSS, or malware. Defense is layered: TLS enforcement prevents interception, HttpOnly cookies prevent XSS theft, and fingerprinting detects stolen tokens used from a different context.

**TLS enforcement:**

```typescript
import express from "express";
import helmet from "helmet";

const app = express();

// Enforce HTTPS via HSTS
app.use(
  helmet.hsts({
    maxAge: 31536000,       // 1 year
    includeSubDomains: true,
    preload: true,
  })
);

// Redirect HTTP to HTTPS
app.use((req, res, next) => {
  if (req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect(301, `https://${req.hostname}${req.url}`);
  }
  next();
});
```

**Session fingerprinting -- binding sessions to client characteristics:**

```typescript
import crypto from "crypto";

// Generate a fingerprint from stable client characteristics
function generateSessionFingerprint(req: Request): string {
  // Use characteristics that are stable for a legitimate user
  // but differ for an attacker
  const components = [
    req.headers["user-agent"] || "",
    req.headers["accept-language"] || "",
    req.headers["accept-encoding"] || "",
  ];

  return crypto
    .createHash("sha256")
    .update(components.join("|"))
    .digest("hex");
}

// Validate fingerprint on every request
async function validateSessionFingerprint(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const session = req.session;
  const currentFingerprint = generateSessionFingerprint(req);

  if (session.fingerprint && session.fingerprint !== currentFingerprint) {
    // Fingerprint mismatch -- possible hijacking
    logger.warn("Session fingerprint mismatch", {
      sessionId: req.sessionID,
      userId: session.userId,
      expectedFingerprint: session.fingerprint,
      actualFingerprint: currentFingerprint,
      ip: req.ip,
    });

    // Destroy the potentially hijacked session
    await sessionStore.destroy(req.sessionID, session.userId);
    clearSessionCookie(res);
    res.status(401).json({ error: "Session invalidated" });
    return;
  }

  next();
}
```

**IP binding -- use with caution:**

```typescript
// IP binding can break for legitimate users behind:
// - Mobile networks (IP changes as user moves between towers)
// - Corporate proxies (shared IP for many users)
// - VPNs (IP changes when connection drops and reconnects)
//
// Recommendation: log IP changes, do NOT automatically invalidate.
// Require re-authentication only for sensitive operations from a new IP.

async function checkIpConsistency(req: Request, session: SessionData): Promise<void> {
  if (session.ipAddress !== req.ip) {
    logger.info("Session IP changed", {
      sessionId: req.sessionID,
      userId: session.userId,
      originalIp: session.ipAddress,
      currentIp: req.ip,
    });

    // Update the stored IP but flag the session
    session.ipChanged = true;
    session.ipAddress = req.ip;
    await sessionStore.update(req.sessionID, session);

    // For sensitive operations, require re-authentication
    // Do NOT invalidate the entire session
  }
}
```

---

### 7. Concurrent Session Control

Control how many active sessions a user can have. Without limits, a compromised account can have unlimited active sessions across many devices, making revocation difficult.

**TypeScript -- Concurrent session manager:**

```typescript
class ConcurrentSessionManager {
  private maxSessionsPerUser = 5;

  async onLogin(userId: string, newSessionId: string): Promise<void> {
    const activeSessions = await sessionStore.getSessionsForUser(userId);

    if (activeSessions.length >= this.maxSessionsPerUser) {
      // Evict the oldest session (FIFO)
      const oldest = activeSessions.sort(
        (a, b) => a.createdAt - b.createdAt
      )[0];
      await sessionStore.destroy(oldest.sessionId, userId);

      logger.info("Evicted oldest session due to limit", {
        userId,
        evictedSessionId: oldest.sessionId,
        activeCount: activeSessions.length,
      });
    }
  }

  async listSessions(userId: string): Promise<SessionInfo[]> {
    const sessions = await sessionStore.getSessionsForUser(userId);
    return sessions.map((s) => ({
      sessionId: maskSessionId(s.sessionId), // Show only last 8 chars
      createdAt: s.createdAt,
      lastActivity: s.lastActivity,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      isCurrent: false, // Caller sets this
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await sessionStore.destroy(sessionId, userId);
    logger.info("Session revoked by user", { userId, sessionId });
  }

  async revokeAllSessions(userId: string, exceptCurrent?: string): Promise<number> {
    const sessions = await sessionStore.getSessionsForUser(userId);
    let revokedCount = 0;

    for (const session of sessions) {
      if (session.sessionId !== exceptCurrent) {
        await sessionStore.destroy(session.sessionId, userId);
        revokedCount++;
      }
    }

    logger.info("All sessions revoked", {
      userId,
      revokedCount,
      keptCurrent: !!exceptCurrent,
    });

    return revokedCount;
  }
}

// API endpoints
app.get("/api/sessions", sessionMiddleware, async (req, res) => {
  const sessions = await concurrentManager.listSessions(req.session.userId);
  // Mark the current session
  const result = sessions.map((s) => ({
    ...s,
    isCurrent: s.sessionId === maskSessionId(req.sessionID),
  }));
  res.json(result);
});

app.delete("/api/sessions/:sessionId", sessionMiddleware, async (req, res) => {
  await concurrentManager.revokeSession(req.session.userId, req.params.sessionId);
  res.json({ success: true });
});

app.post("/api/sessions/revoke-all", sessionMiddleware, async (req, res) => {
  const count = await concurrentManager.revokeAllSessions(
    req.session.userId,
    req.sessionID // Keep current session active
  );
  res.json({ revokedCount: count });
});
```

**Java (Spring Session) -- Concurrent session control:**

```java
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .sessionManagement(session -> session
                .maximumSessions(5)
                .maxSessionsPreventsLogin(false) // Evict oldest
                .expiredSessionStrategy(event -> {
                    event.getResponse().setStatus(401);
                    event.getResponse().getWriter()
                        .write("{\"error\":\"Session expired by concurrent login\"}");
                })
            );
        return http.build();
    }
}
```

---

### 8. Cross-Site Request Forgery (CSRF) via Sessions

CSRF exploits the fact that browsers automatically attach cookies to requests. An attacker tricks the victim's browser into making a request to the target application, and the session cookie is sent automatically. SameSite cookies are the primary defense, but additional patterns provide defense in depth.

**SameSite cookies (primary defense):**

Covered in Section 2 above. Use `SameSite=Lax` as the default. This blocks cross-site POST requests, which are the primary CSRF vector.

**Synchronizer token pattern:**

```typescript
import crypto from "crypto";

// Generate a CSRF token and store it in the session
function generateCsrfToken(session: SessionData): string {
  const token = crypto.randomBytes(32).toString("hex");
  session.csrfToken = token;
  return token;
}

// Validate the CSRF token on state-changing requests
function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip for safe methods (GET, HEAD, OPTIONS)
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const sessionToken = req.session?.csrfToken;
  const requestToken =
    req.headers["x-csrf-token"] || req.body?._csrf;

  if (!sessionToken || !requestToken) {
    res.status(403).json({ error: "CSRF token missing" });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  const valid = crypto.timingSafeEqual(
    Buffer.from(sessionToken),
    Buffer.from(requestToken)
  );

  if (!valid) {
    logger.warn("CSRF token mismatch", {
      userId: req.session?.userId,
      ip: req.ip,
      referer: req.headers.referer,
    });
    res.status(403).json({ error: "CSRF token invalid" });
    return;
  }

  next();
}
```

**Double-submit cookie pattern:**

```typescript
// Alternative when server-side session storage for CSRF tokens is impractical

function setDoubleCsrfCookie(res: Response): string {
  const token = crypto.randomBytes(32).toString("hex");

  // Set as a cookie (NOT HttpOnly -- JavaScript must read it)
  res.cookie("__Host-csrf", token, {
    httpOnly: false,   // JavaScript must read this to include in request header
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600_000,
  });

  return token;
}

function validateDoubleCsrf(req: Request, res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies["__Host-csrf"];
  const headerToken = req.headers["x-csrf-token"];

  if (!cookieToken || !headerToken) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }

  const valid = crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(String(headerToken))
  );

  if (!valid) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }

  next();
}
```

**Custom header validation:**

```typescript
// Simplest CSRF defense for AJAX-only APIs
// Browsers do not allow cross-origin custom headers without CORS preflight

function requireCustomHeader(req: Request, res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Verify that a custom header is present -- browsers block cross-origin
  // custom headers unless the server explicitly allows them via CORS
  if (!req.headers["x-requested-with"]) {
    res.status(403).json({ error: "Missing required header" });
    return;
  }

  next();
}
```

---

### 9. Distributed Session Management

In distributed systems with multiple application instances, session data must be accessible from any instance. There are several strategies, each with trade-offs.

```
Distributed Session Strategies:

  Sticky Sessions (Affinity)
  +-----------+     +-------------+     +-----------+
  | Client A  |---->| Load        |---->| Server 1  | (always serves Client A)
  | Client B  |---->| Balancer    |---->| Server 2  | (always serves Client B)
  +-----------+     +-------------+     +-----------+
  Pro: Simple, no shared storage needed
  Con: Server failure loses all sessions on that server. Uneven load distribution.

  Centralized Store (Recommended)
  +-----------+     +-------------+     +-----------+
  | Client    |---->| Load        |---->| Server 1  |--+
  |           |     | Balancer    |---->| Server 2  |--+--> Redis / Database
  |           |     |             |---->| Server 3  |--+
  +-----------+     +-------------+     +-----------+
  Pro: Any server handles any request. Server failure is transparent.
  Con: External dependency. Redis must be highly available.

  Session Replication
  +-----------+     +-----------+     +-----------+
  | Server 1  |<--->| Server 2  |<--->| Server 3  |
  | (full     |     | (full     |     | (full     |
  |  copy)    |     |  copy)    |     |  copy)    |
  +-----------+     +-----------+     +-----------+
  Pro: No external store. Any server has all data.
  Con: Network overhead grows quadratically. Does not scale beyond ~5 nodes.
```

**TypeScript -- Redis with Sentinel for high availability:**

```typescript
import { createClient } from "redis";

// Production Redis setup with Sentinel for automatic failover
const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error("Redis connection failed after 10 retries");
        return new Error("Redis unavailable");
      }
      return Math.min(retries * 100, 3000); // Exponential backoff, max 3s
    },
    connectTimeout: 5000,
  },
});

redisClient.on("error", (err) => {
  logger.error("Redis client error", { error: err.message });
});

redisClient.on("reconnecting", () => {
  logger.warn("Redis client reconnecting");
});
```

**Go -- Session serialization for distributed stores:**

```go
import (
    "encoding/json"
    "time"
)

type Session struct {
    ID           string    `json:"id"`
    UserID       string    `json:"user_id"`
    Roles        []string  `json:"roles"`
    CreatedAt    time.Time `json:"created_at"`
    LastActivity time.Time `json:"last_activity"`
    IPAddress    string    `json:"ip_address"`
    UserAgent    string    `json:"user_agent"`
    Fingerprint  string    `json:"fingerprint"`
}

// Serialize for storage -- use JSON for readability and cross-language compatibility
func (s *Session) Marshal() ([]byte, error) {
    return json.Marshal(s)
}

func UnmarshalSession(data []byte) (*Session, error) {
    var s Session
    if err := json.Unmarshal(data, &s); err != nil {
        return nil, fmt.Errorf("unmarshal session: %w", err)
    }
    return &s, nil
}
```

---

### 10. Stateless Sessions (JWT)

JSON Web Tokens (JWT) store session state in the token itself, eliminating the need for server-side storage. This provides horizontal scalability but introduces challenges around revocation, token size, and security.

**When to use JWT vs server-side sessions:**

```
Use Server-Side Sessions When:
  - You need instant session revocation (logout, password change, account lock)
  - Session data is large or changes frequently
  - You have fewer than ~100,000 concurrent users per server
  - Security requirements are strict (banking, healthcare)

Use JWT When:
  - You need stateless horizontal scaling across many services
  - You have a microservices architecture with many resource servers
  - Token revocation latency of minutes is acceptable
  - You pair JWTs with a refresh token rotation mechanism
```

**TypeScript -- Secure JWT implementation:**

```typescript
import jwt from "jsonwebtoken";
import crypto from "crypto";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

class JwtSessionManager {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenTTL = "15m";    // Short-lived access token
  private refreshTokenTTL = "7d";    // Longer-lived refresh token

  constructor() {
    this.accessTokenSecret = process.env.ACCESS_TOKEN_SECRET!;
    this.refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET!;
  }

  createTokenPair(userId: string, roles: string[]): TokenPair {
    const jti = crypto.randomUUID(); // Unique token ID for revocation tracking

    const accessToken = jwt.sign(
      {
        sub: userId,
        roles,
        type: "access",
      },
      this.accessTokenSecret,
      {
        algorithm: "HS256",      // Use RS256 for multi-service architectures
        expiresIn: this.accessTokenTTL,
        issuer: "auth.myapp.com",
        audience: "api.myapp.com",
        jwtid: jti,
      }
    );

    const refreshToken = jwt.sign(
      {
        sub: userId,
        type: "refresh",
        family: crypto.randomUUID(), // Token family for rotation detection
      },
      this.refreshTokenSecret,
      {
        algorithm: "HS256",
        expiresIn: this.refreshTokenTTL,
        issuer: "auth.myapp.com",
        jwtid: crypto.randomUUID(),
      }
    );

    // Store refresh token hash in database for revocation
    // NEVER store the raw refresh token server-side
    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    refreshTokenStore.save({
      userId,
      tokenHash: refreshTokenHash,
      family: jwt.decode(refreshToken)!.family,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
    });

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): JwtPayload {
    // CRITICAL: Always specify allowed algorithms to prevent algorithm confusion
    return jwt.verify(token, this.accessTokenSecret, {
      algorithms: ["HS256"],      // Reject "none", RS256, etc.
      issuer: "auth.myapp.com",   // Reject tokens from other issuers
      audience: "api.myapp.com",  // Reject tokens for other audiences
    }) as JwtPayload;
  }

  async rotateRefreshToken(oldRefreshToken: string): Promise<TokenPair> {
    const payload = jwt.verify(oldRefreshToken, this.refreshTokenSecret, {
      algorithms: ["HS256"],
    }) as JwtPayload;

    // Check if this refresh token has been revoked
    const oldHash = crypto
      .createHash("sha256")
      .update(oldRefreshToken)
      .digest("hex");

    const storedToken = await refreshTokenStore.findByHash(oldHash);
    if (!storedToken) {
      // Token reuse detected -- possible theft
      // Revoke ALL tokens in this family
      await refreshTokenStore.revokeFamily(payload.family);
      logger.warn("Refresh token reuse detected -- family revoked", {
        userId: payload.sub,
        family: payload.family,
      });
      throw new Error("Token reuse detected");
    }

    // Revoke old refresh token
    await refreshTokenStore.revoke(oldHash);

    // Issue new token pair
    return this.createTokenPair(payload.sub, payload.roles);
  }
}
```

**JWT security checklist:**

```
JWT Security Requirements:
  +--------------------------------+----------------------------------------------+
  | Requirement                    | Why                                          |
  +--------------------------------+----------------------------------------------+
  | Validate algorithm (alg)       | Prevents "none" algorithm and key confusion  |
  | Check expiration (exp)         | Prevents use of expired tokens               |
  | Validate issuer (iss)          | Prevents tokens from untrusted issuers       |
  | Validate audience (aud)        | Prevents tokens meant for other services     |
  | Use short expiration (15 min)  | Limits damage window if token is stolen      |
  | Implement refresh token        | Allows short access tokens with longer        |
  | rotation                       | session lifetime                             |
  | Store refresh token hash only  | Prevents database breach from exposing tokens|
  | Detect token family reuse      | Detects stolen refresh tokens                |
  +--------------------------------+----------------------------------------------+
```

---

### 11. Session Security in Single-Page Applications (SPAs)

SPAs face unique session challenges because they run entirely in the browser. The choice of token storage location directly impacts security.

```
Token Storage Options for SPAs:

  +-------------------+------------+------------+----------------------------------+
  | Storage           | XSS Safe?  | CSRF Safe? | Recommendation                   |
  +-------------------+------------+------------+----------------------------------+
  | HttpOnly Cookie   | YES        | Needs      | RECOMMENDED -- use with          |
  |                   |            | SameSite   | SameSite=Lax                     |
  +-------------------+------------+------------+----------------------------------+
  | localStorage      | NO -- XSS  | YES        | NEVER for session tokens         |
  |                   | can read   |            |                                  |
  +-------------------+------------+------------+----------------------------------+
  | sessionStorage    | NO -- XSS  | YES        | NEVER for session tokens         |
  |                   | can read   |            |                                  |
  +-------------------+------------+------------+----------------------------------+
  | In-memory (JS     | Partial    | YES        | Lost on refresh. Use only with   |
  | variable)         |            |            | silent refresh mechanism         |
  +-------------------+------------+------------+----------------------------------+

  Rule: ALWAYS use HttpOnly cookies for session tokens in SPAs.
        JavaScript should NEVER have access to session credentials.
```

**BFF (Backend For Frontend) pattern -- recommended for SPAs:**

```typescript
// The BFF pattern keeps tokens on the server side.
// The SPA communicates only with its BFF, which manages sessions.

// BFF server (Express)
const app = express();

// SPA calls BFF login endpoint
app.post("/bff/login", async (req, res) => {
  const { email, password } = req.body;

  // BFF authenticates against the identity provider
  const tokenResponse = await identityProvider.authenticate(email, password);

  // BFF stores tokens server-side in session -- never sent to browser
  const sessionId = crypto.randomBytes(32).toString("hex");
  await sessionStore.create(sessionId, {
    userId: tokenResponse.userId,
    accessToken: tokenResponse.accessToken,   // Stored server-side only
    refreshToken: tokenResponse.refreshToken, // Stored server-side only
    expiresAt: tokenResponse.expiresAt,
  });

  // Only the session cookie goes to the browser
  res.cookie("__Host-sid", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600_000,
  });

  res.json({ success: true });
});

// SPA calls BFF to proxy API requests
app.use("/bff/api", sessionMiddleware, async (req, res) => {
  // BFF attaches the access token from the session to the upstream request
  const session = req.session;

  // Refresh token if expired
  if (Date.now() > session.expiresAt) {
    const newTokens = await identityProvider.refresh(session.refreshToken);
    session.accessToken = newTokens.accessToken;
    session.refreshToken = newTokens.refreshToken;
    session.expiresAt = newTokens.expiresAt;
    await sessionStore.update(req.sessionID, session);
  }

  // Forward request to upstream API with access token
  const response = await fetch(`${UPSTREAM_API}${req.path}`, {
    method: req.method,
    headers: {
      "Authorization": `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
  });

  const data = await response.json();
  res.status(response.status).json(data);
});
```

**Silent refresh (for applications not using BFF):**

```typescript
// Client-side silent refresh using a hidden iframe or fetch
// Access token stored in memory (not localStorage), refresh via HttpOnly cookie

class SilentRefreshManager {
  private accessToken: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    // On page load, attempt silent refresh to get a new access token
    await this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      // The refresh endpoint uses the HttpOnly cookie for authentication
      const response = await fetch("/auth/refresh", {
        method: "POST",
        credentials: "include", // Send cookies
      });

      if (!response.ok) {
        // Refresh failed -- redirect to login
        this.accessToken = null;
        window.location.href = "/login";
        return;
      }

      const data = await response.json();
      this.accessToken = data.accessToken; // Store in memory only

      // Schedule next refresh before expiration
      const expiresIn = data.expiresIn * 1000; // Convert to ms
      const refreshAt = expiresIn - 60_000;    // Refresh 1 minute before expiry
      this.refreshTimer = setTimeout(() => this.refresh(), refreshAt);
    } catch (error) {
      console.error("Silent refresh failed", error);
      window.location.href = "/login";
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  logout(): void {
    this.accessToken = null;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
  }
}
```

---

## Best Practices

1. **ALWAYS generate session IDs using a CSPRNG with at least 128 bits of entropy** -- use crypto.randomBytes (Node.js), crypto/rand (Go), secrets (Python), or SecureRandom (Java). Never use Math.random, time-based seeds, or sequential counters.

2. **ALWAYS set all security attributes on session cookies** -- HttpOnly (prevents XSS theft), Secure (HTTPS only), SameSite=Lax (blocks cross-site POST), Path=/ (scope the cookie). Use the __Host- cookie prefix to enforce Secure and Path=/ at the browser level.

3. **ALWAYS regenerate the session ID after authentication** -- destroy the pre-authentication session and issue a new session ID upon login. This eliminates session fixation attacks entirely.

4. **ALWAYS enforce both absolute and idle timeouts** -- absolute timeout (e.g., 8 hours) limits the maximum session lifetime regardless of activity. Idle timeout (e.g., 30 minutes) destroys sessions after inactivity. Apply both.

5. **ALWAYS store session data server-side when instant revocation is required** -- use Redis or a database. Client-side tokens (JWT) cannot be revoked instantly without maintaining a server-side blacklist, which negates the stateless benefit.

6. **ALWAYS invalidate the session completely on logout** -- delete the server-side session data, remove the session from the user's active session list, and clear the session cookie. Do not rely solely on cookie deletion.

7. **ALWAYS validate JWT algorithm, issuer, audience, and expiration** -- never accept algorithm "none." Explicitly specify the allowed algorithm in the verification call. Check iss, aud, and exp on every token validation.

8. **ALWAYS use the BFF pattern or HttpOnly cookies for SPA session tokens** -- never store session tokens, access tokens, or refresh tokens in localStorage or sessionStorage. These are accessible to any JavaScript running on the page, including XSS payloads.

9. **ALWAYS implement refresh token rotation** -- issue a new refresh token with every use and revoke the old one. If a revoked refresh token is used again, revoke the entire token family to contain stolen tokens.

10. **ALWAYS limit concurrent sessions per user and provide session management UI** -- enforce a maximum number of active sessions. Provide users with the ability to list active sessions and revoke them individually or globally ("logout everywhere").

---

## Anti-Patterns

### 1. Predictable Session IDs

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Session IDs generated with Math.random(), sequential counters, or timestamps | Attacker predicts valid session IDs and impersonates users | Use CSPRNG: crypto.randomBytes, crypto/rand, secrets.token_hex, SecureRandom |

### 2. Missing Cookie Security Attributes

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Session cookie set without HttpOnly, Secure, or SameSite | XSS steals session ID via document.cookie. Cookie sent over HTTP in cleartext. CSRF attacks succeed on cross-site POST | Set HttpOnly=true, Secure=true, SameSite=Lax on every session cookie. Use __Host- prefix |

### 3. No Session Regeneration After Login

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Session ID remains the same before and after authentication | Attacker performs session fixation: sets a known session ID on the victim, waits for login, then uses that session ID | Destroy the pre-auth session and issue a new session ID immediately after successful authentication |

### 4. Sessions That Never Expire

| Problem | Consequence | Fix |
|---------|-------------|-----|
| No absolute timeout or idle timeout configured | Stolen session remains valid indefinitely. Shared computers remain logged in | Enforce absolute timeout (max 8 hours) and idle timeout (max 30 minutes). Require re-authentication for sensitive operations |

### 5. Storing Tokens in localStorage

| Problem | Consequence | Fix |
|---------|-------------|-----|
| JWT or session token stored in localStorage or sessionStorage | Any XSS vulnerability exposes the token. localStorage is accessible to all scripts on the same origin | Store session tokens exclusively in HttpOnly cookies. Use the BFF pattern for SPAs |

### 6. Accepting JWT Algorithm "none"

| Problem | Consequence | Fix |
|---------|-------------|-----|
| JWT verification does not restrict the accepted algorithm | Attacker crafts a token with alg:"none" and an empty signature, bypassing verification entirely | Explicitly specify allowed algorithms in the verify call: algorithms: ["RS256"] or algorithms: ["HS256"] |

### 7. No Logout Invalidation

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Logout only deletes the cookie but does not destroy the server-side session | Attacker who has a copy of the session ID can continue using it after the user "logs out" | On logout: delete server-side session data, remove from active session list, clear cookie |

### 8. Shared Session Secret Across Environments

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Same SESSION_SECRET or JWT signing key used in development, staging, and production | Tokens created in development are valid in production. Developer can forge production sessions | Use distinct secrets per environment. Store in a secrets manager. Rotate on a defined schedule |

---

## Enforcement Checklist

### Session ID Generation
- [ ] Session IDs are generated using a CSPRNG (not Math.random, not time-based)
- [ ] Session IDs have at least 128 bits of entropy (256 bits preferred)
- [ ] Session IDs are not sequential, predictable, or based on user data

### Cookie Security
- [ ] HttpOnly attribute is set on all session cookies
- [ ] Secure attribute is set on all session cookies
- [ ] SameSite attribute is set to Lax (or Strict where appropriate)
- [ ] __Host- cookie prefix is used to enforce Secure and Path=/
- [ ] Cookie domain is not overly broad (do not set Domain unless necessary)
- [ ] Max-Age or Expires is set to enforce cookie lifetime

### Session Lifecycle
- [ ] Session ID is regenerated after successful authentication
- [ ] Pre-authentication session is destroyed on login
- [ ] Absolute timeout is enforced (maximum 8 hours recommended)
- [ ] Idle timeout is enforced (maximum 30 minutes recommended)
- [ ] Session is fully destroyed on logout (server-side data + cookie)
- [ ] Session ID is regenerated after privilege escalation (role change, MFA)

### Session Hijacking Prevention
- [ ] All traffic is served over HTTPS with HSTS enabled
- [ ] Session fingerprinting validates User-Agent and other stable headers
- [ ] IP changes are logged and flagged (not necessarily blocked)
- [ ] Concurrent session count is limited per user

### CSRF Protection
- [ ] SameSite=Lax is set on session cookies (primary defense)
- [ ] State-changing operations use POST/PUT/DELETE (not GET)
- [ ] Synchronizer token pattern or double-submit cookie is implemented as defense in depth
- [ ] CSRF tokens are compared using constant-time comparison

### Distributed Sessions
- [ ] Centralized session store (Redis or database) is used instead of in-memory storage
- [ ] Session store has high availability (Redis Sentinel, replication)
- [ ] Session data is serializable and does not contain non-portable types
- [ ] Session store connection uses TLS and authentication

### JWT (If Used)
- [ ] Algorithm is explicitly specified and validated (never accept "none")
- [ ] Issuer (iss) is validated on every token verification
- [ ] Audience (aud) is validated on every token verification
- [ ] Expiration (exp) is validated and access tokens are short-lived (15 minutes)
- [ ] Refresh token rotation is implemented
- [ ] Refresh token reuse detection revokes the entire token family
- [ ] Refresh token hashes (not raw tokens) are stored server-side

### SPA Session Security
- [ ] Session tokens are stored in HttpOnly cookies (not localStorage)
- [ ] BFF pattern is used for applications with sensitive operations
- [ ] Silent refresh mechanism handles token expiration without page reload
- [ ] Access tokens are stored in memory only (never persisted to disk in browser)

### Session Monitoring and Revocation
- [ ] Users can view their active sessions (device, IP, last activity)
- [ ] Users can revoke individual sessions
- [ ] "Logout everywhere" functionality is available
- [ ] Session creation and destruction events are logged for audit
- [ ] Anomalous session activity triggers alerts (multiple concurrent geolocations, rapid IP changes)
