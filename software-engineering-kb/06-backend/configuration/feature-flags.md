# Feature Flags

> **AI Plugin Directive — Feature Flag Management & Rollout Strategies**
> You are an AI coding assistant. When generating, reviewing, or refactoring feature flag
> code, follow EVERY rule in this document. Poorly managed feature flags cause inconsistent
> behavior, stale toggles that accumulate as tech debt, and production incidents from uncontrolled
> rollouts. Treat each section as non-negotiable.

**Core Rule: ALWAYS evaluate feature flags at runtime — NEVER use build-time constants for feature toggling. ALWAYS have a kill switch for every new feature. ALWAYS clean up feature flags within 30 days of full rollout — stale flags are tech debt.**

---

## 1. Feature Flag Types

```
┌──────────────────────────────────────────────────────────────┐
│              Feature Flag Taxonomy                             │
│                                                               │
│  ┌──────────────────┐                                        │
│  │ Release Toggle   │  Gate incomplete features              │
│  │ (short-lived)    │  Remove after rollout complete         │
│  │ Lifespan: days   │  Example: new checkout flow            │
│  └──────────────────┘                                        │
│                                                               │
│  ┌──────────────────┐                                        │
│  │ Experiment Toggle│  A/B tests and experiments             │
│  │ (short-lived)    │  Remove after experiment concludes     │
│  │ Lifespan: weeks  │  Example: pricing page variant         │
│  └──────────────────┘                                        │
│                                                               │
│  ┌──────────────────┐                                        │
│  │ Ops Toggle       │  Operational control (kill switch)     │
│  │ (long-lived)     │  Keep as circuit breaker               │
│  │ Lifespan: months │  Example: disable payment provider     │
│  └──────────────────┘                                        │
│                                                               │
│  ┌──────────────────┐                                        │
│  │ Permission Toggle│  Entitlement / plan-based access       │
│  │ (permanent)      │  Part of business logic                │
│  │ Lifespan: forever│  Example: premium features             │
│  └──────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘
```

| Type | Lifespan | Dynamic? | Who Controls | Cleanup Required |
|------|----------|----------|-------------|------------------|
| **Release** | Days-weeks | Yes | Engineering | YES — remove after rollout |
| **Experiment** | Weeks | Yes | Product/Data | YES — remove after conclusion |
| **Ops** | Months-permanent | Yes | Ops/SRE | Review quarterly |
| **Permission** | Permanent | Yes | Business logic | NO — part of product |

---

## 2. Flag Evaluation Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Feature Flag Evaluation Flow                      │
│                                                               │
│  Application                                                  │
│  ┌─────────────────────────────────────────┐                 │
│  │  Flag SDK (in-process)                   │                 │
│  │  ┌───────────┐  ┌────────────────────┐  │                 │
│  │  │ Local     │  │ Evaluation Engine  │  │                 │
│  │  │ Cache     │◄─┤                    │  │                 │
│  │  │ (flags)   │  │ Context + Rules    │  │                 │
│  │  └───────────┘  │ → Boolean result   │  │                 │
│  │       ▲         └────────────────────┘  │                 │
│  └───────┼─────────────────────────────────┘                 │
│          │ SSE / Polling (sync flags)                         │
│  ┌───────┴──────────────────────────────────┐                │
│  │  Flag Management Service                  │                │
│  │  ├── Flag definitions                     │                │
│  │  ├── Targeting rules                      │                │
│  │  ├── Percentage rollouts                  │                │
│  │  └── Audit log                            │                │
│  └──────────────────────────────────────────┘                │
│                                                               │
│  Evaluation is LOCAL (in-process, ~1μs)                      │
│  Flag sync is BACKGROUND (SSE stream or periodic poll)       │
│  ➡ No latency added to request path                         │
└──────────────────────────────────────────────────────────────┘
```

- ALWAYS evaluate flags in-process (local cache) — NEVER make network calls per evaluation
- ALWAYS sync flag definitions in the background (SSE or polling every 10-30s)
- ALWAYS provide a default value when evaluating — if flag service is unavailable, use safe default
- NEVER add latency to the request path for flag evaluation

---

## 3. Implementation Patterns

### 3.1 TypeScript

```typescript
interface FlagContext {
  userId: string;
  email?: string;
  plan?: "free" | "pro" | "enterprise";
  country?: string;
  percentage?: number; // 0-100, deterministic per user
}

interface FlagDefinition {
  key: string;
  enabled: boolean;
  rules: TargetingRule[];
  percentageRollout?: number; // 0-100
  defaultValue: boolean;
}

interface TargetingRule {
  attribute: keyof FlagContext;
  operator: "eq" | "in" | "not_in" | "contains" | "gte" | "lte";
  value: any;
  result: boolean;
}

class FeatureFlagClient {
  private flags: Map<string, FlagDefinition> = new Map();

  async initialize(): Promise<void> {
    await this.syncFlags();
    // Background sync every 30 seconds
    setInterval(() => this.syncFlags(), 30_000);
  }

  isEnabled(flagKey: string, context: FlagContext, defaultValue = false): boolean {
    const flag = this.flags.get(flagKey);
    if (!flag) {
      logger.warn("Unknown feature flag", { flagKey });
      return defaultValue;
    }

    if (!flag.enabled) return false;

    // Evaluate targeting rules (first match wins)
    for (const rule of flag.rules) {
      if (this.matchesRule(context, rule)) {
        return rule.result;
      }
    }

    // Percentage rollout (deterministic by userId)
    if (flag.percentageRollout !== undefined) {
      const bucket = this.hashToBucket(context.userId, flagKey);
      return bucket < flag.percentageRollout;
    }

    return flag.defaultValue;
  }

  private hashToBucket(userId: string, flagKey: string): number {
    // Deterministic: same user always gets same bucket for same flag
    const hash = createHash("sha256").update(`${flagKey}:${userId}`).digest();
    return hash.readUInt16BE(0) % 100;
  }

  private matchesRule(context: FlagContext, rule: TargetingRule): boolean {
    const value = context[rule.attribute];
    switch (rule.operator) {
      case "eq": return value === rule.value;
      case "in": return Array.isArray(rule.value) && rule.value.includes(value);
      case "not_in": return Array.isArray(rule.value) && !rule.value.includes(value);
      default: return false;
    }
  }
}

// Usage
const flags = new FeatureFlagClient();
await flags.initialize();

app.get("/checkout", (req, res) => {
  const context: FlagContext = {
    userId: req.user.id,
    email: req.user.email,
    plan: req.user.plan,
  };

  if (flags.isEnabled("new_checkout_flow", context)) {
    return handleNewCheckout(req, res);
  }
  return handleLegacyCheckout(req, res);
});
```

### 3.2 Go

```go
type FlagContext struct {
    UserID  string
    Email   string
    Plan    string
    Country string
}

type FeatureFlagClient struct {
    flags sync.Map
    mu    sync.RWMutex
}

func (c *FeatureFlagClient) IsEnabled(flagKey string, ctx FlagContext, defaultValue bool) bool {
    raw, ok := c.flags.Load(flagKey)
    if !ok {
        slog.Warn("unknown feature flag", "key", flagKey)
        return defaultValue
    }

    flag := raw.(*FlagDefinition)
    if !flag.Enabled {
        return false
    }

    // Evaluate targeting rules
    for _, rule := range flag.Rules {
        if matchesRule(ctx, rule) {
            return rule.Result
        }
    }

    // Percentage rollout
    if flag.PercentageRollout != nil {
        bucket := hashToBucket(ctx.UserID, flagKey)
        return bucket < *flag.PercentageRollout
    }

    return flag.DefaultValue
}

func hashToBucket(userID, flagKey string) int {
    h := sha256.Sum256([]byte(flagKey + ":" + userID))
    return int(binary.BigEndian.Uint16(h[:2])) % 100
}

// Usage
if flags.IsEnabled("new_checkout_flow", ctx, false) {
    handleNewCheckout(w, r)
} else {
    handleLegacyCheckout(w, r)
}
```

### 3.3 Python

```python
import hashlib, struct

class FeatureFlagClient:
    def __init__(self):
        self._flags: dict[str, FlagDefinition] = {}

    def is_enabled(self, flag_key: str, context: FlagContext, default: bool = False) -> bool:
        flag = self._flags.get(flag_key)
        if not flag:
            logger.warning("Unknown feature flag", extra={"key": flag_key})
            return default

        if not flag.enabled:
            return False

        for rule in flag.rules:
            if self._matches_rule(context, rule):
                return rule.result

        if flag.percentage_rollout is not None:
            bucket = self._hash_to_bucket(context.user_id, flag_key)
            return bucket < flag.percentage_rollout

        return flag.default_value

    @staticmethod
    def _hash_to_bucket(user_id: str, flag_key: str) -> int:
        h = hashlib.sha256(f"{flag_key}:{user_id}".encode()).digest()
        return struct.unpack(">H", h[:2])[0] % 100
```

---

## 4. Gradual Rollout Strategy

```
┌──────────────────────────────────────────────────────────────┐
│              Gradual Rollout Stages                            │
│                                                               │
│  Stage 1: Internal (1%)                                      │
│  ├── Target: employees only (email domain rule)              │
│  ├── Duration: 1-2 days                                      │
│  └── Validate: no errors, correct behavior                   │
│                                                               │
│  Stage 2: Beta (5-10%)                                       │
│  ├── Target: opted-in beta users                             │
│  ├── Duration: 3-5 days                                      │
│  └── Validate: metrics, user feedback                        │
│                                                               │
│  Stage 3: Canary (25%)                                       │
│  ├── Target: random 25% of users                             │
│  ├── Duration: 3-7 days                                      │
│  └── Validate: error rates, latency, business metrics        │
│                                                               │
│  Stage 4: Broad (50%)                                        │
│  ├── Target: random 50% of users                             │
│  ├── Duration: 3-7 days                                      │
│  └── Validate: at-scale performance                          │
│                                                               │
│  Stage 5: Full (100%)                                        │
│  ├── Target: all users                                       │
│  ├── Duration: 7 days (monitoring)                           │
│  └── Then: REMOVE the flag (cleanup)                         │
│                                                               │
│  At ANY stage: kill switch → 0% instantly                    │
└──────────────────────────────────────────────────────────────┘
```

| Metric to Monitor | Threshold | Action |
|-------------------|-----------|--------|
| Error rate | > 1% increase | Roll back to previous stage |
| Latency (p99) | > 20% increase | Investigate before proceeding |
| Conversion rate | > 5% decrease | Pause rollout, analyze |
| User complaints | Any spike | Investigate immediately |

- ALWAYS start rollouts at 1% (internal users) before expanding
- ALWAYS have a kill switch — ability to disable to 0% instantly
- ALWAYS use deterministic hashing for percentage rollouts — same user always sees same variant
- ALWAYS monitor key metrics at each stage before advancing

---

## 5. Flag Providers

| Provider | Type | Strengths | Best For |
|----------|------|-----------|----------|
| **LaunchDarkly** | SaaS | Enterprise features, SDKs, targeting | Large teams, complex rules |
| **Unleash** | Self-hosted/Cloud | Open source, GDPR-friendly | Privacy-conscious, budget |
| **Flagsmith** | Self-hosted/Cloud | Open source, remote config | Startups, full control |
| **Split** | SaaS | Experimentation focus | A/B testing heavy |
| **ConfigCat** | SaaS | Simple, affordable | Small teams |
| **Environment vars** | Manual | Zero dependencies | Simple on/off toggles |
| **Database** | Custom | Full control, no vendor | Custom requirements |

### 5.1 Provider Abstraction

```typescript
// Abstract provider — swap implementations without code changes
interface FeatureFlagProvider {
  initialize(): Promise<void>;
  isEnabled(key: string, context: FlagContext, defaultValue: boolean): boolean;
  getVariant(key: string, context: FlagContext, defaultValue: string): string;
  close(): Promise<void>;
}

// Environment variable implementation (simple)
class EnvFeatureFlags implements FeatureFlagProvider {
  async initialize(): Promise<void> {}

  isEnabled(key: string, _context: FlagContext, defaultValue: boolean): boolean {
    const envKey = `FEATURE_${key.toUpperCase().replace(/\./g, "_")}`;
    const value = process.env[envKey];
    if (value === undefined) return defaultValue;
    return value === "true";
  }

  getVariant(key: string, _context: FlagContext, defaultValue: string): string {
    const envKey = `FEATURE_${key.toUpperCase().replace(/\./g, "_")}`;
    return process.env[envKey] ?? defaultValue;
  }

  async close(): Promise<void> {}
}

// LaunchDarkly implementation
class LaunchDarklyFlags implements FeatureFlagProvider {
  private client: LDClient;

  async initialize(): Promise<void> {
    this.client = ld.init(process.env.LAUNCHDARKLY_SDK_KEY!);
    await this.client.waitForInitialization();
  }

  isEnabled(key: string, context: FlagContext, defaultValue: boolean): boolean {
    return this.client.variation(key, this.toLDContext(context), defaultValue);
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
```

- ALWAYS abstract the flag provider behind an interface
- ALWAYS start with environment variable flags for simple use cases
- ALWAYS migrate to a dedicated provider when you need targeting rules or gradual rollouts

---

## 6. Flag Lifecycle & Hygiene

```
┌──────────────────────────────────────────────────────────────┐
│              Feature Flag Lifecycle                            │
│                                                               │
│  CREATE                                                      │
│  ├── Define flag key, type, owner, and expiry date           │
│  ├── Document purpose in flag description                    │
│  └── Add cleanup task to backlog                             │
│                                                               │
│  ROLLOUT                                                     │
│  ├── Gradual: 1% → 10% → 25% → 50% → 100%                │
│  ├── Monitor metrics at each stage                           │
│  └── Kill switch ready at all times                          │
│                                                               │
│  FULL ROLLOUT                                                │
│  ├── Flag at 100% for 7+ days with no issues                │
│  └── Schedule cleanup sprint                                 │
│                                                               │
│  CLEANUP (within 30 days of full rollout)                    │
│  ├── Remove flag checks from code                            │
│  ├── Delete the old code path                                │
│  ├── Remove flag definition from provider                    │
│  └── Remove flag from tests                                  │
│                                                               │
│  ⚠ Stale flags after 90 days = mandatory cleanup            │
└──────────────────────────────────────────────────────────────┘
```

```typescript
// Flag metadata for tracking lifecycle
interface FlagMetadata {
  key: string;
  type: "release" | "experiment" | "ops" | "permission";
  owner: string;                // Team or person responsible
  createdAt: string;            // ISO date
  expectedRemovalDate: string;  // When flag should be cleaned up
  description: string;          // Why this flag exists
  jiraTicket?: string;          // Cleanup ticket
}

// Stale flag detector (run in CI or scheduled job)
function detectStaleFlags(flags: FlagMetadata[]): FlagMetadata[] {
  const now = new Date();
  return flags.filter((flag) => {
    if (flag.type === "permission" || flag.type === "ops") return false; // Long-lived
    const removal = new Date(flag.expectedRemovalDate);
    return now > removal; // Past expected removal date
  });
}
```

- ALWAYS set an expiry/removal date when creating release and experiment flags
- ALWAYS create a cleanup ticket in the backlog when creating a flag
- ALWAYS remove the flag AND the old code path during cleanup — not just the flag check
- NEVER let release flags live longer than 90 days after full rollout

---

## 7. Testing with Feature Flags

```typescript
// ALWAYS make flags injectable for testing
class OrderService {
  constructor(private flags: FeatureFlagProvider) {}

  async checkout(order: Order, context: FlagContext): Promise<Result> {
    if (this.flags.isEnabled("new_checkout_flow", context)) {
      return this.newCheckout(order);
    }
    return this.legacyCheckout(order);
  }
}

// Test both code paths
describe("OrderService.checkout", () => {
  it("uses new flow when flag is enabled", async () => {
    const flags = new MockFlagProvider({ "new_checkout_flow": true });
    const service = new OrderService(flags);
    const result = await service.checkout(order, context);
    expect(result.flow).toBe("new");
  });

  it("uses legacy flow when flag is disabled", async () => {
    const flags = new MockFlagProvider({ "new_checkout_flow": false });
    const service = new OrderService(flags);
    const result = await service.checkout(order, context);
    expect(result.flow).toBe("legacy");
  });
});
```

- ALWAYS test BOTH code paths (flag on AND flag off) in unit tests
- ALWAYS use dependency injection for the flag provider — NEVER import a global singleton in tests
- ALWAYS test the default value behavior (flag unknown/unavailable)

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Build-time flags (`#ifdef`) | Must rebuild to toggle | Runtime evaluation with SDK |
| Network call per evaluation | Added latency to every request | In-process cache with background sync |
| No default value | Crash when flag service is down | ALWAYS provide safe defaults |
| Stale flags never removed | Code full of dead paths, confusion | 30-day cleanup rule with backlog tickets |
| Non-deterministic rollout | User sees different variant on refresh | Deterministic hash of userId + flagKey |
| Flag in global scope | Cannot test both paths | Dependency injection, mock in tests |
| No kill switch | Cannot disable broken feature quickly | ALWAYS have instant disable capability |
| Nested flag conditions | Complex, untestable logic | Flatten flag checks, max 1 level deep |
| Flag naming inconsistency | Hard to find and manage | Convention: `feature.section.name` |
| No monitoring during rollout | Issues not caught before 100% | Monitor error rate, latency, conversions |

---

## 9. Enforcement Checklist

- [ ] Flags evaluated at runtime (NOT build-time constants)
- [ ] Flag evaluation is in-process (~microseconds, no network call)
- [ ] Safe default value provided for every flag evaluation
- [ ] Kill switch available for every new feature flag
- [ ] Gradual rollout used: 1% → 10% → 25% → 50% → 100%
- [ ] Percentage rollout is deterministic (hash of userId + flagKey)
- [ ] Key metrics monitored during rollout (error rate, latency, conversions)
- [ ] Flag provider abstracted behind interface (swappable)
- [ ] Both code paths tested (flag on + flag off) in unit tests
- [ ] Flag metadata includes: owner, type, creation date, expected removal date
- [ ] Release flags cleaned up within 30 days of full rollout
- [ ] Stale flag detection automated (CI or scheduled job)
- [ ] Old code path removed during cleanup (not just the flag check)
