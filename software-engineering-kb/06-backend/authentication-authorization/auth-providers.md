# Auth Providers

> **AI Plugin Directive — Authentication Providers & Identity Platforms**
> You are an AI coding assistant. When generating, reviewing, or refactoring code that integrates
> with authentication providers, follow EVERY rule in this document. Provider selection and integration
> patterns determine the security posture of the entire application. Treat each section as a non-negotiable requirement.

**Core Rule: NEVER build your own authentication system from scratch when a proven provider exists. ALWAYS evaluate build vs buy based on team expertise, compliance requirements, and maintenance cost. ALWAYS abstract provider-specific code behind an adapter interface for portability.**

---

## 1. Provider Categories

```
┌──────────────────────────────────────────────────────────────────┐
│                Authentication Provider Landscape                  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Managed (BaaS)                                             │ │
│  │  ├── Auth0 (Okta)      ← Enterprise SSO, B2B               │ │
│  │  ├── Firebase Auth     ← Mobile-first, Google ecosystem     │ │
│  │  ├── AWS Cognito       ← AWS ecosystem                      │ │
│  │  ├── Supabase Auth     ← Open source, PostgreSQL-based      │ │
│  │  └── Clerk             ← Developer-first, pre-built UI      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Self-Hosted                                                │ │
│  │  ├── Keycloak          ← Enterprise SSO, SAML, full OIDC   │ │
│  │  ├── Authentik         ← Modern, Python-based               │ │
│  │  ├── Ory (Kratos/Hydra)← Cloud-native, API-first           │ │
│  │  └── FusionAuth        ← Full-featured, Java-based          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Libraries (DIY)                                            │ │
│  │  ├── NextAuth.js       ← Next.js specific                  │ │
│  │  ├── Passport.js       ← Node.js middleware                 │ │
│  │  ├── Lucia             ← Lightweight, framework-agnostic    │ │
│  │  └── Spring Security   ← Java/Spring ecosystem              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Provider Comparison Matrix

| Feature | Auth0 | Firebase | Cognito | Keycloak | Supabase | Clerk |
|---------|-------|----------|---------|----------|----------|-------|
| **Pricing** | Per MAU | Free tier generous | Per MAU | Free (self-host) | Free tier | Per MAU |
| **SSO (SAML)** | YES | NO | YES | YES | NO | YES |
| **Social Login** | 30+ providers | Google, Apple, GitHub, etc. | Google, Apple, Amazon, FB | Configurable | Google, GitHub, etc. | 20+ providers |
| **MFA** | Full | Phone, TOTP | SMS, TOTP, FIDO2 | Full | TOTP | Full |
| **Custom UI** | Lock widget + custom | FirebaseUI + custom | Hosted + custom | Themes + custom | Pre-built + custom | Pre-built + custom |
| **OIDC/OAuth2** | Full | Partial | Full | Full | Partial | Full |
| **Machine-to-Machine** | YES | Limited | YES | YES | NO | YES |
| **RBAC** | Built-in | Custom claims | Groups | Full | RLS | Organizations |
| **Multi-tenant** | Organizations | Firebase projects | User pools | Realms | RLS | Organizations |
| **Self-hosted** | NO | NO | NO | YES | YES | NO |
| **Vendor lock-in** | Medium | HIGH | HIGH | LOW | LOW | Medium |
| **Compliance** | SOC2, HIPAA | SOC2 | SOC2, HIPAA, FedRAMP | Self-managed | SOC2 | SOC2 |
| **Best for** | Enterprise B2B | Mobile, startups | AWS apps | Enterprise, on-prem | Supabase ecosystem | Dev experience |

---

## 3. Build vs Buy Decision

```
┌──────────────────────────────────────────────────────────────┐
│                  Build vs Buy Decision Tree                   │
│                                                               │
│  START                                                        │
│    │                                                          │
│    ▼                                                          │
│  Do you need Enterprise SSO (SAML/OIDC)?                     │
│    │         │                                                │
│   YES        NO                                               │
│    │         │                                                │
│    ▼         ▼                                                │
│  Auth0 or  Do you have dedicated                              │
│  Keycloak  security engineers?                                │
│            │         │                                        │
│           YES        NO                                       │
│            │         │                                        │
│            ▼         ▼                                        │
│         Consider   Use managed                                │
│         self-host  provider                                   │
│         (Keycloak) (Auth0/Clerk/                              │
│                    Firebase)                                   │
│                                                               │
│  Factors favoring BUY:                                        │
│  ├── Team < 10 engineers                                      │
│  ├── Auth is not core product                                 │
│  ├── Need compliance (SOC2, HIPAA) quickly                   │
│  ├── Need SSO, social login, MFA out-of-box                  │
│  └── Want to focus on product, not auth infrastructure        │
│                                                               │
│  Factors favoring BUILD:                                      │
│  ├── Auth IS the core product                                 │
│  ├── Dedicated security team                                  │
│  ├── Unique auth requirements (biometrics, hardware tokens)   │
│  ├── Strict data sovereignty (no third-party data storage)   │
│  └── Cost sensitivity at scale (> 100k MAU)                   │
└──────────────────────────────────────────────────────────────┘
```

ALWAYS buy/use a managed provider unless you have a specific reason to build. The cost of building and maintaining authentication infrastructure is typically 10-50x the cost of a managed service.

---

## 4. Provider Abstraction Layer

ALWAYS abstract provider-specific code behind an interface. This enables switching providers without rewriting application code:

**TypeScript**
```typescript
// Auth provider interface — implement per provider
interface AuthProvider {
  // User management
  createUser(data: CreateUserData): Promise<AuthUser>;
  getUserById(id: string): Promise<AuthUser | null>;
  getUserByEmail(email: string): Promise<AuthUser | null>;
  updateUser(id: string, data: UpdateUserData): Promise<AuthUser>;
  deleteUser(id: string): Promise<void>;

  // Authentication
  verifyToken(token: string): Promise<TokenPayload>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
  revokeToken(token: string): Promise<void>;

  // Password
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
  resetPassword(email: string): Promise<void>;

  // Social / OAuth
  getAuthorizationUrl(provider: string, state: string): string;
  handleCallback(provider: string, code: string): Promise<AuthUser>;

  // MFA
  enrollMFA(userId: string, type: MFAType): Promise<MFAEnrollment>;
  verifyMFA(userId: string, code: string): Promise<boolean>;
}

interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
  roles: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  lastLoginAt?: Date;
}

interface TokenPayload {
  sub: string;
  email: string;
  roles: string[];
  exp: number;
  iss: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
```

### 4.1 Auth0 Implementation

```typescript
import { ManagementClient, AuthenticationClient } from "auth0";

class Auth0Provider implements AuthProvider {
  private mgmt: ManagementClient;
  private auth: AuthenticationClient;

  constructor(config: Auth0Config) {
    this.mgmt = new ManagementClient({
      domain: config.domain,
      clientId: config.mgmtClientId,
      clientSecret: config.mgmtClientSecret,
    });

    this.auth = new AuthenticationClient({
      domain: config.domain,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    // Auth0 uses RS256 — verify against JWKS
    const payload = await jwtVerify(token, jwks, {
      issuer: `https://${this.domain}/`,
      audience: this.audience,
      algorithms: ["RS256"],
    });

    return {
      sub: payload.payload.sub!,
      email: payload.payload.email as string,
      roles: (payload.payload["https://myapp.com/roles"] as string[]) || [],
      exp: payload.payload.exp!,
      iss: payload.payload.iss!,
    };
  }

  async createUser(data: CreateUserData): Promise<AuthUser> {
    const user = await this.mgmt.users.create({
      email: data.email,
      password: data.password,
      connection: "Username-Password-Authentication",
      email_verified: false,
    });

    return this.mapUser(user);
  }

  async handleCallback(provider: string, code: string): Promise<AuthUser> {
    const tokens = await this.auth.oauth.authorizationCodeGrant({
      code,
      redirect_uri: this.redirectUri,
    });

    const userInfo = await this.auth.users.getInfo(tokens.data.access_token);
    return this.mapUserInfo(userInfo.data);
  }

  private mapUser(auth0User: any): AuthUser {
    return {
      id: auth0User.user_id,
      email: auth0User.email,
      emailVerified: auth0User.email_verified,
      name: auth0User.name,
      picture: auth0User.picture,
      roles: auth0User.app_metadata?.roles ?? [],
      metadata: auth0User.user_metadata ?? {},
      createdAt: new Date(auth0User.created_at),
      lastLoginAt: auth0User.last_login ? new Date(auth0User.last_login) : undefined,
    };
  }
}
```

### 4.2 Keycloak Implementation

```typescript
import KcAdminClient from "@keycloak/keycloak-admin-client";

class KeycloakProvider implements AuthProvider {
  private admin: KcAdminClient;

  constructor(private config: KeycloakConfig) {
    this.admin = new KcAdminClient({
      baseUrl: config.baseUrl,
      realmName: config.realm,
    });
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    const payload = await jwtVerify(token, jwks, {
      issuer: `${this.config.baseUrl}/realms/${this.config.realm}`,
      algorithms: ["RS256"],
    });

    return {
      sub: payload.payload.sub!,
      email: payload.payload.email as string,
      roles: (payload.payload.realm_access as any)?.roles ?? [],
      exp: payload.payload.exp!,
      iss: payload.payload.iss!,
    };
  }

  async createUser(data: CreateUserData): Promise<AuthUser> {
    await this.admin.auth({
      clientId: this.config.adminClientId,
      clientSecret: this.config.adminClientSecret,
      grantType: "client_credentials",
    });

    const user = await this.admin.users.create({
      email: data.email,
      enabled: true,
      emailVerified: false,
      credentials: [{
        type: "password",
        value: data.password,
        temporary: false,
      }],
    });

    return this.getUserById(user.id);
  }
}
```

### 4.3 Firebase Implementation

```typescript
import { getAuth } from "firebase-admin/auth";

class FirebaseProvider implements AuthProvider {
  private auth = getAuth();

  async verifyToken(token: string): Promise<TokenPayload> {
    const decoded = await this.auth.verifyIdToken(token);

    return {
      sub: decoded.uid,
      email: decoded.email!,
      roles: (decoded.roles as string[]) ?? [],
      exp: decoded.exp,
      iss: decoded.iss,
    };
  }

  async createUser(data: CreateUserData): Promise<AuthUser> {
    const user = await this.auth.createUser({
      email: data.email,
      password: data.password,
      emailVerified: false,
    });

    return {
      id: user.uid,
      email: user.email!,
      emailVerified: user.emailVerified,
      name: user.displayName,
      picture: user.photoURL,
      roles: [],
      metadata: {},
      createdAt: new Date(user.metadata.creationTime),
      lastLoginAt: user.metadata.lastSignInTime
        ? new Date(user.metadata.lastSignInTime)
        : undefined,
    };
  }
}
```

---

## 5. Provider Selection Guide

### 5.1 By Use Case

| Use Case | Recommended Provider | Why |
|----------|---------------------|-----|
| **Startup / MVP** | Firebase Auth or Clerk | Quick setup, generous free tier |
| **B2B SaaS** | Auth0 or Keycloak | Enterprise SSO, organizations, RBAC |
| **Enterprise on-prem** | Keycloak or Authentik | Self-hosted, full control |
| **AWS ecosystem** | Cognito | Native AWS integration |
| **Supabase project** | Supabase Auth | Integrated with Supabase, RLS |
| **Mobile-first** | Firebase Auth | Best mobile SDKs |
| **Next.js app** | Clerk or NextAuth.js | Best DX, pre-built components |
| **Microservices** | Keycloak or Auth0 | Service accounts, M2M tokens |
| **High compliance** | Auth0 or Keycloak | SOC2, HIPAA, FedRAMP |
| **Data sovereignty** | Keycloak or Ory | Self-hosted in your region |

### 5.2 By Scale

| Scale | Recommended | Cost Consideration |
|-------|-------------|-------------------|
| < 1K MAU | Any (free tier) | All providers free at this scale |
| 1K - 10K MAU | Clerk, Auth0, Firebase | $0-200/month |
| 10K - 100K MAU | Auth0, Cognito, self-host | $200-2000/month managed |
| 100K - 1M MAU | Self-host (Keycloak) or negotiate | Managed becomes expensive |
| > 1M MAU | Self-host or custom | Managed pricing prohibitive |

---

## 6. Migration Between Providers

### 6.1 Migration Strategy

```
┌──────────────────────────────────────────────────────────────────┐
│                Provider Migration Strategy                        │
│                                                                   │
│  Phase 1: Preparation (2-4 weeks)                                │
│  ├── Implement provider abstraction layer                        │
│  ├── Write new provider adapter                                   │
│  ├── Set up new provider environment                              │
│  └── Map user attributes between providers                       │
│                                                                   │
│  Phase 2: Dual-Write (2-4 weeks)                                 │
│  ├── New registrations go to BOTH providers                      │
│  ├── Authentication still against OLD provider                    │
│  ├── Batch migrate existing users to new provider                │
│  └── Verify user counts match                                    │
│                                                                   │
│  Phase 3: Switch (1 week)                                         │
│  ├── Authentication switches to NEW provider                      │
│  ├── Old provider as fallback (lazy migration)                   │
│  ├── Users who haven't migrated: forced password reset           │
│  └── Monitor error rates closely                                  │
│                                                                   │
│  Phase 4: Cleanup (1-2 weeks)                                    │
│  ├── Remove old provider adapter                                  │
│  ├── Delete data from old provider                                │
│  ├── Update documentation                                         │
│  └── Remove old provider SDK dependencies                        │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Password Migration

NEVER export password hashes — most providers do not allow this. Use lazy migration:

```typescript
class LazyMigrationProvider implements AuthProvider {
  constructor(
    private newProvider: AuthProvider,
    private oldProvider: AuthProvider
  ) {}

  async verifyCredentials(email: string, password: string): Promise<AuthUser | null> {
    // 1. Try new provider first
    try {
      return await this.newProvider.verifyCredentials(email, password);
    } catch {
      // Not in new provider yet
    }

    // 2. Try old provider
    try {
      const user = await this.oldProvider.verifyCredentials(email, password);
      if (user) {
        // 3. Migrate user to new provider on successful login
        await this.newProvider.createUser({
          email: user.email,
          password, // We have the plaintext password during login
          name: user.name,
          metadata: user.metadata,
        });

        // Mark as migrated
        await db.migrationLog.create({
          userId: user.id,
          migratedAt: new Date(),
        });

        return await this.newProvider.verifyCredentials(email, password);
      }
    } catch {
      // Not in old provider either
    }

    return null;
  }
}
```

- ALWAYS implement lazy migration for password-based accounts
- ALWAYS provide a forced password reset for users who haven't logged in during migration
- ALWAYS maintain the provider abstraction layer for future migrations
- NEVER delete data from the old provider until migration is fully verified
- ALWAYS test migration with a subset of users before full rollout

---

## 7. Webhook Integration

ALWAYS handle provider webhooks for real-time event processing:

```typescript
// Common webhook events across providers
type AuthWebhookEvent =
  | { type: "user.created"; data: { userId: string; email: string } }
  | { type: "user.updated"; data: { userId: string; changes: Record<string, any> } }
  | { type: "user.deleted"; data: { userId: string } }
  | { type: "user.login"; data: { userId: string; ip: string; timestamp: string } }
  | { type: "user.login.failed"; data: { email: string; ip: string; reason: string } }
  | { type: "password.changed"; data: { userId: string } }
  | { type: "mfa.enabled"; data: { userId: string; type: string } };

// Webhook handler
async function handleAuthWebhook(req: Request, res: Response) {
  // 1. Verify webhook signature — CRITICAL
  const isValid = verifyWebhookSignature(
    req.body,
    req.headers["x-webhook-signature"] as string,
    WEBHOOK_SECRET
  );

  if (!isValid) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // 2. Process event
  const event: AuthWebhookEvent = req.body;

  switch (event.type) {
    case "user.created":
      await syncUserToLocalDB(event.data);
      break;
    case "user.deleted":
      await removeUserFromLocalDB(event.data.userId);
      break;
    case "user.login.failed":
      await alertOnSuspiciousActivity(event.data);
      break;
    case "password.changed":
      await invalidateAllSessions(event.data.userId);
      break;
  }

  // 3. Respond quickly (< 5 seconds)
  res.status(200).json({ received: true });
}
```

- ALWAYS verify webhook signatures — NEVER trust unverified webhook payloads
- ALWAYS respond to webhooks within 5 seconds — use async processing for long tasks
- ALWAYS implement idempotency — webhooks may be delivered multiple times
- ALWAYS sync critical user data from webhook events to your local database
- ALWAYS handle `user.deleted` events to comply with data deletion requirements

---

## 8. Social Login Integration

### 8.1 Provider-Specific Configuration

| Provider | Scopes | ID Claim | Notes |
|----------|--------|----------|-------|
| **Google** | `openid profile email` | `sub` | Use `hd` param for Workspace domains |
| **GitHub** | `user:email` | `id` (numeric) | Email may require separate API call |
| **Microsoft** | `openid profile email` | `sub` or `oid` | Use `oid` for stable ID |
| **Apple** | `name email` | `sub` (team-scoped) | Name returned ONLY on first auth |
| **Facebook** | `email public_profile` | `id` | Requires app review for additional data |
| **Discord** | `identify email` | `id` | Common for gaming/community apps |
| **LinkedIn** | `openid profile email` | `sub` | Business-oriented profiles |

### 8.2 Social Login Rules

- ALWAYS request minimum scopes — only `email` and `profile` for login
- ALWAYS handle the case where email is NOT returned (GitHub private emails)
- ALWAYS verify email ownership before account linking
- ALWAYS support account unlinking (user removes social connection)
- ALWAYS store provider-specific user ID (not just email) for identity matching
- NEVER assume social email is verified unless the provider explicitly confirms it
- ALWAYS handle provider API rate limits gracefully

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No provider abstraction | Vendor lock-in, migration impossible | Implement AuthProvider interface |
| Hardcoded provider SDK calls | Provider change requires full rewrite | Abstract behind adapter layer |
| Building auth from scratch | Security vulnerabilities, maintenance burden | Use proven provider or library |
| Ignoring webhook signatures | Accepting forged webhook events | ALWAYS verify signatures |
| No lazy migration plan | Users lose access during provider switch | Implement gradual migration |
| Provider SDK in business logic | Auth concerns leak into domain | Isolate in infrastructure layer |
| Single social login provider | Users locked out if provider has outage | Support 2+ social providers |
| No local user record | App fully depends on provider API for user data | Sync user data to local DB |
| Ignoring provider rate limits | API calls fail under load | Cache tokens, batch operations |
| Same credentials all environments | Dev/staging can access production | Separate apps per environment |

---

## 10. Enforcement Checklist

- [ ] Provider abstraction layer implemented (AuthProvider interface)
- [ ] Provider-specific code isolated in adapter classes
- [ ] Webhook signatures verified on ALL incoming webhook events
- [ ] User data synced to local database (not solely dependent on provider API)
- [ ] Social login supports 2+ providers minimum
- [ ] Email verification checked before account linking
- [ ] Migration strategy documented (lazy migration for passwords)
- [ ] Separate provider applications per environment (dev/staging/prod)
- [ ] Provider API rate limits handled with caching and retry logic
- [ ] Webhook events processed idempotently (duplicate delivery safe)
- [ ] Provider token storage encrypted at rest
- [ ] Minimum scopes requested for social login
- [ ] Build vs buy decision documented with rationale
- [ ] Provider SLA and uptime history reviewed before selection
