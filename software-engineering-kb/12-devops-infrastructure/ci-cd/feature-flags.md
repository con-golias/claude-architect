# Feature Flags

| Attribute      | Value                                                        |
|---------------|--------------------------------------------------------------|
| Domain        | DevOps > CI/CD                                               |
| Importance    | High                                                         |
| Last Updated  | 2026-03-10                                                   |
| Cross-ref     | [Deployment Strategies](deployment-strategies.md), [Fundamentals](fundamentals.md) |

---

## Core Concepts

### What Feature Flags Are

A feature flag (feature toggle) is a mechanism to change system behavior without deploying
new code. Flags decouple **deployment** (pushing code to production) from **release**
(exposing functionality to users). This separation is the foundation of trunk-based
development and progressive delivery.

```
Traditional:  Code Change → Deploy → All Users See It
With Flags:   Code Change → Deploy (flag OFF) → Enable for 1% → 10% → 100%
                                                       ↑
                                              Instant rollback: disable flag
```

### Feature Flag Types

| Type           | Purpose                                  | Lifetime    | Example                              |
|---------------|------------------------------------------|-------------|--------------------------------------|
| **Release**   | Gate incomplete features in trunk         | Short (days-weeks) | `new-checkout-flow`            |
| **Ops**       | Runtime operational controls (kill switches) | Long (permanent) | `disable-recommendations-engine` |
| **Experiment**| A/B testing and metric-driven decisions   | Medium (weeks) | `checkout-single-page-variant`    |
| **Permission**| Entitlement-based access control          | Long (permanent) | `premium-analytics-dashboard`   |

**Key rule:** Every flag must have a designated type. The type determines its lifecycle,
ownership, and cleanup strategy.

### Feature Flag Lifecycle

```
CREATE          ENABLE           MEASURE          CLEAN UP
  │               │                │                │
  ▼               ▼                ▼                ▼
Define flag   Roll out to      Collect metrics   Remove flag
with type     segments/        and decide:       code paths,
and owner     percentages      keep or kill      delete flag
              ┌───────┐                           definition
              │ 1%    │
              │ 10%   │        A/B analysis
              │ 50%   │        shows +3%
              │ 100%  │        conversion
              └───────┘
```

**Enforce cleanup:** Set a creation date and expiration date on every release flag.
Alert when flags exceed their intended lifetime. Stale flags are technical debt.

### Implementation Patterns

#### Simple Boolean Flag (TypeScript)

```typescript
// Basic flag evaluation with type safety
interface FeatureFlags {
  'new-checkout-flow': boolean;
  'dark-mode': boolean;
  'disable-recommendations': boolean;
}

class FeatureFlagService {
  private flags: Map<string, FeatureFlagConfig> = new Map();

  async isEnabled<K extends keyof FeatureFlags>(
    flagName: K,
    context?: EvaluationContext
  ): Promise<boolean> {
    const flag = this.flags.get(flagName);
    if (!flag) return false;  // Unknown flags default to OFF

    // Check kill switch first
    if (flag.killed) return false;

    // Evaluate targeting rules
    return this.evaluate(flag, context);
  }

  private evaluate(flag: FeatureFlagConfig, ctx?: EvaluationContext): boolean {
    // 1. User allowlist
    if (ctx?.userId && flag.allowlist?.includes(ctx.userId)) return true;

    // 2. Segment targeting
    if (ctx && flag.segments) {
      for (const segment of flag.segments) {
        if (this.matchesSegment(ctx, segment)) return true;
      }
    }

    // 3. Percentage rollout
    if (flag.percentage !== undefined && ctx?.userId) {
      return this.isInPercentage(ctx.userId, flag.percentage);
    }

    // 4. Global default
    return flag.defaultValue;
  }

  private isInPercentage(userId: string, percentage: number): boolean {
    // Deterministic hash: same user always gets same result
    const hash = this.murmurHash(userId) % 100;
    return hash < percentage;
  }

  private murmurHash(key: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  private matchesSegment(ctx: EvaluationContext, segment: Segment): boolean {
    return segment.rules.every(rule => {
      const value = ctx[rule.attribute as keyof EvaluationContext];
      switch (rule.operator) {
        case 'eq': return value === rule.value;
        case 'in': return (rule.value as string[]).includes(value as string);
        case 'gte': return (value as number) >= (rule.value as number);
        default: return false;
      }
    });
  }
}

interface EvaluationContext {
  userId: string;
  email?: string;
  country?: string;
  plan?: 'free' | 'pro' | 'enterprise';
  attributes?: Record<string, unknown>;
}

interface FeatureFlagConfig {
  name: string;
  type: 'release' | 'ops' | 'experiment' | 'permission';
  defaultValue: boolean;
  killed: boolean;
  percentage?: number;
  allowlist?: string[];
  segments?: Segment[];
  createdAt: Date;
  expiresAt?: Date;
  owner: string;
}

interface Segment {
  name: string;
  rules: Array<{
    attribute: string;
    operator: 'eq' | 'in' | 'gte' | 'lte' | 'contains';
    value: unknown;
  }>;
}
```

#### Percentage Rollout (TypeScript)

```typescript
// Gradual rollout controller
class RolloutController {
  constructor(private flagService: FeatureFlagService) {}

  async startRollout(flagName: string, schedule: RolloutStep[]): Promise<void> {
    for (const step of schedule) {
      await this.flagService.setPercentage(flagName, step.percentage);
      console.log(`[${flagName}] Rolled out to ${step.percentage}%`);

      // Wait and evaluate metrics
      await this.waitAndEvaluate(flagName, step);
    }
  }

  private async waitAndEvaluate(
    flagName: string,
    step: RolloutStep
  ): Promise<void> {
    await sleep(step.bakeTime);

    const metrics = await this.getMetrics(flagName);
    if (metrics.errorRate > step.maxErrorRate) {
      console.error(`[${flagName}] Error rate ${metrics.errorRate} exceeds threshold`);
      await this.flagService.setPercentage(flagName, 0);
      throw new Error(`Rollout aborted: error rate exceeded at ${step.percentage}%`);
    }

    if (metrics.p99Latency > step.maxP99Latency) {
      console.error(`[${flagName}] P99 latency ${metrics.p99Latency}ms exceeds threshold`);
      await this.flagService.setPercentage(flagName, 0);
      throw new Error(`Rollout aborted: latency exceeded at ${step.percentage}%`);
    }
  }

  private async getMetrics(flagName: string): Promise<RolloutMetrics> {
    // Query Prometheus/Datadog for flag-specific metrics
    return { errorRate: 0.001, p99Latency: 120 };
  }
}

interface RolloutStep {
  percentage: number;
  bakeTime: number;       // ms to wait before evaluation
  maxErrorRate: number;    // threshold for auto-rollback
  maxP99Latency: number;  // ms
}
```

#### User Targeting (Python)

```python
# Python feature flag implementation with user targeting
from dataclasses import dataclass, field
from enum import Enum
from typing import Any
import hashlib


class FlagType(Enum):
    RELEASE = "release"
    OPS = "ops"
    EXPERIMENT = "experiment"
    PERMISSION = "permission"


@dataclass
class EvaluationContext:
    user_id: str
    email: str = ""
    country: str = ""
    plan: str = "free"
    attributes: dict[str, Any] = field(default_factory=dict)


@dataclass
class TargetingRule:
    attribute: str
    operator: str  # eq, in, gte, lte, contains, regex
    value: Any


@dataclass
class FlagConfig:
    name: str
    flag_type: FlagType
    default_value: bool = False
    killed: bool = False
    percentage: float | None = None
    allowlist: list[str] = field(default_factory=list)
    targeting_rules: list[TargetingRule] = field(default_factory=list)
    owner: str = ""
    expires_at: str | None = None


class FeatureFlagClient:
    """Server-side feature flag client with local cache and remote sync."""

    def __init__(self, config_source: str):
        self._flags: dict[str, FlagConfig] = {}
        self._load_config(config_source)

    def is_enabled(self, flag_name: str, context: EvaluationContext) -> bool:
        flag = self._flags.get(flag_name)
        if not flag:
            return False

        if flag.killed:
            return False

        # User allowlist (beta testers, internal users)
        if context.user_id in flag.allowlist:
            return True

        # Targeting rules (e.g., enterprise plan, specific country)
        if flag.targeting_rules and self._matches_rules(context, flag.targeting_rules):
            return True

        # Percentage rollout (deterministic by user ID)
        if flag.percentage is not None:
            return self._in_percentage(context.user_id, flag.name, flag.percentage)

        return flag.default_value

    def _in_percentage(self, user_id: str, flag_name: str, percentage: float) -> bool:
        """Deterministic: same user + flag always yields same bucket."""
        key = f"{flag_name}:{user_id}"
        hash_val = int(hashlib.sha256(key.encode()).hexdigest()[:8], 16)
        bucket = hash_val % 100
        return bucket < percentage

    def _matches_rules(
        self, context: EvaluationContext, rules: list[TargetingRule]
    ) -> bool:
        for rule in rules:
            value = getattr(context, rule.attribute, None)
            if value is None:
                value = context.attributes.get(rule.attribute)
            if not self._evaluate_rule(value, rule.operator, rule.value):
                return False
        return True

    @staticmethod
    def _evaluate_rule(actual: Any, operator: str, expected: Any) -> bool:
        match operator:
            case "eq": return actual == expected
            case "in": return actual in expected
            case "gte": return actual >= expected
            case "lte": return actual <= expected
            case "contains": return expected in str(actual)
            case _: return False


# Usage
flags = FeatureFlagClient("https://flags.example.com/api/config")
ctx = EvaluationContext(
    user_id="user-123",
    email="alice@example.com",
    country="US",
    plan="enterprise"
)

if flags.is_enabled("new-billing-engine", ctx):
    result = new_billing_engine.calculate(order)
else:
    result = legacy_billing.calculate(order)
```

### Client-Side vs Server-Side Evaluation

| Aspect            | Server-Side SDK                   | Client-Side SDK                   |
|-------------------|-----------------------------------|-----------------------------------|
| Evaluation        | On the server, full context       | On the device, limited context    |
| Latency           | Microseconds (in-memory cache)    | Milliseconds (fetches flag state) |
| Security          | Rules not exposed to users        | Only final boolean sent to client |
| Use case          | API logic, backend features       | UI toggles, frontend experiments  |
| Architecture      | Full ruleset cached locally       | Evaluated remotely, result cached |

**Server-side SDKs** download the full flag configuration and evaluate locally. They never
make network calls during evaluation. **Client-side SDKs** call the service with user
context and receive pre-evaluated results (never exposing targeting rules).

### Feature Flag Platforms

| Platform       | Type           | Strengths                                     | Pricing Model     |
|---------------|----------------|-----------------------------------------------|-------------------|
| LaunchDarkly  | SaaS           | Enterprise RBAC, audit logs, experimentation  | Per seat + MAU    |
| Unleash       | Open source    | Self-hosted, simple, proxy for client SDKs    | Free (OSS) + paid|
| Flagsmith     | Open source    | Remote config + flags, self-hosted or cloud   | Free tier + paid  |
| ConfigCat     | SaaS           | Simple, fast setup, generous free tier        | Per config calls  |
| OpenFeature   | Standard       | Vendor-neutral SDK specification              | N/A (spec only)   |
| Custom        | Self-built     | Full control, no vendor dependency            | Engineering time  |

**OpenFeature** is the CNCF standard for feature flag evaluation. Use it as an abstraction
layer to avoid vendor lock-in. All major platforms provide OpenFeature providers.

```typescript
// OpenFeature vendor-neutral approach
import { OpenFeature } from '@openfeature/server-sdk';
import { LaunchDarklyProvider } from '@launchdarkly/openfeature-node-server';

// Initialize once -- swap provider without changing application code
OpenFeature.setProvider(new LaunchDarklyProvider('sdk-key'));

const client = OpenFeature.getClient();

// Evaluate flags through standard API
const showNewDashboard = await client.getBooleanValue(
  'new-dashboard',
  false,  // default
  { targetingKey: user.id, email: user.email }
);
```

### Flag-Driven Testing

Use feature flags to test both code paths in CI/CD.

```typescript
// Test both flag states explicitly
describe('checkout flow', () => {
  it('handles new checkout when flag is ON', async () => {
    flagService.override('new-checkout-flow', true);
    const result = await handleCheckout(mockRequest);
    expect(result.template).toBe('checkout-v2');
  });

  it('handles legacy checkout when flag is OFF', async () => {
    flagService.override('new-checkout-flow', false);
    const result = await handleCheckout(mockRequest);
    expect(result.template).toBe('checkout-v1');
  });

  afterEach(() => {
    flagService.clearOverrides();
  });
});
```

### Technical Debt and Flag Cleanup

Stale flags are one of the most common sources of hidden complexity. Every flag doubles
the code paths that must be tested and maintained.

**Cleanup strategy:**

```typescript
// Flag metadata for lifecycle tracking
const FLAG_REGISTRY: Record<string, FlagMetadata> = {
  'new-checkout-flow': {
    type: 'release',
    createdAt: '2026-01-15',
    expiresAt: '2026-03-15',      // 2-month max for release flags
    owner: 'checkout-team',
    jiraTicket: 'FEAT-1234',
    cleanupTicket: 'TECH-5678',   // Pre-created cleanup ticket
  },
  'disable-recommendations': {
    type: 'ops',
    createdAt: '2025-06-01',
    expiresAt: undefined,          // Ops flags can be permanent
    owner: 'platform-team',
  },
};

// Automated staleness detection (run in CI)
function detectStaleFlags(): string[] {
  const stale: string[] = [];
  const now = new Date();

  for (const [name, meta] of Object.entries(FLAG_REGISTRY)) {
    if (meta.expiresAt && new Date(meta.expiresAt) < now) {
      stale.push(`STALE: ${name} expired on ${meta.expiresAt} (owner: ${meta.owner})`);
    }

    // Release flags older than 90 days are always stale
    if (meta.type === 'release') {
      const age = (now.getTime() - new Date(meta.createdAt).getTime()) / 86400000;
      if (age > 90) {
        stale.push(`OVERDUE: ${name} is ${Math.floor(age)} days old (release flags max 90d)`);
      }
    }
  }
  return stale;
}
```

**Cleanup automation:**
- CI step that fails the build when release flags exceed their expiration date
- Weekly Slack digest listing all flags older than their expected lifetime
- Code search that detects flag references removed from the platform but still in source
- Linting rule that warns on nested flag checks (flag depending on another flag)

### Trunk-Based Development with Flags

Feature flags enable trunk-based development by letting incomplete features exist in
`main` behind disabled flags. This eliminates long-lived feature branches.

```
Traditional branching:
main ────────────────────────────────────────
  └── feature/new-checkout (3 weeks) ──merge→  Merge conflicts

Trunk-based with flags:
main ──[commit]──[commit]──[commit]──[commit]──
        ↑          ↑          ↑          ↑
     flag:OFF   flag:OFF   flag:OFF   flag:ON (release)
     skeleton   core logic  polish     enable for 5%
```

### Kill Switches for Operations

Ops flags act as circuit breakers for non-critical features. In an incident, disable
non-essential functionality to preserve core service capacity.

```typescript
// Kill switch pattern
class RecommendationService {
  async getRecommendations(userId: string): Promise<Product[]> {
    // Kill switch: disable during incidents to shed load
    if (await flags.isEnabled('disable-recommendations')) {
      return [];  // Return empty gracefully, don't error
    }

    // Normal expensive operation
    return this.mlEngine.predict(userId);
  }
}

// Pre-define kill switches for all non-critical features
const KILL_SWITCHES = [
  'disable-recommendations',
  'disable-search-suggestions',
  'disable-analytics-tracking',
  'disable-notification-emails',
  'disable-image-processing',
] as const;
```

### A/B Testing Integration

Feature flags are the delivery mechanism for experiments. The flag system handles
assignment; the analytics system measures impact.

```typescript
// Experiment flag with variant assignment
interface ExperimentConfig {
  name: string;
  variants: Array<{
    name: string;
    weight: number;     // Percentage allocation
    payload: unknown;   // Variant-specific config
  }>;
}

const checkoutExperiment: ExperimentConfig = {
  name: 'checkout-layout-experiment',
  variants: [
    { name: 'control',    weight: 50, payload: { layout: 'multi-step' } },
    { name: 'treatment',  weight: 50, payload: { layout: 'single-page' } },
  ],
};

// Assignment + tracking
const variant = flags.getVariant('checkout-layout-experiment', userContext);
analytics.track('experiment_exposure', {
  experiment: 'checkout-layout-experiment',
  variant: variant.name,
  userId: userContext.userId,
});

// Render based on variant
if (variant.payload.layout === 'single-page') {
  renderSinglePageCheckout();
} else {
  renderMultiStepCheckout();
}
```

### Flag Dependencies and Conflicts

Prevent conflicting flags from being active simultaneously.

```typescript
// Flag dependency and conflict rules
const FLAG_RULES = {
  'new-checkout-flow': {
    requires: ['new-payment-service'],      // Must also be enabled
    conflicts: ['legacy-checkout-banner'],   // Must be disabled
  },
  'new-payment-service': {
    requires: [],
    conflicts: ['old-payment-gateway'],
  },
};

function validateFlagState(flags: Record<string, boolean>): string[] {
  const violations: string[] = [];

  for (const [flag, enabled] of Object.entries(flags)) {
    if (!enabled) continue;
    const rules = FLAG_RULES[flag];
    if (!rules) continue;

    for (const req of rules.requires) {
      if (!flags[req]) {
        violations.push(`${flag} requires ${req} to be enabled`);
      }
    }
    for (const conflict of rules.conflicts) {
      if (flags[conflict]) {
        violations.push(`${flag} conflicts with ${conflict} (both enabled)`);
      }
    }
  }
  return violations;
}
```

---

## Best Practices

1. **Assign a type to every flag.** Release, ops, experiment, or permission. The type
   determines lifecycle expectations, ownership, and cleanup urgency.

2. **Set expiration dates on release flags.** Release flags should live no longer than
   90 days. Create a cleanup Jira ticket at flag creation time, not after.

3. **Use deterministic hashing for percentage rollouts.** Hash `userId + flagName` to
   ensure the same user consistently sees the same flag state. Never use `Math.random()`.

4. **Default to OFF for new flags.** Flags should be safe to deploy. A new flag defaults
   to disabled; enable it deliberately through the flag management platform.

5. **Test both flag states in CI.** Every feature behind a flag needs tests for both
   ON and OFF. Missing this is the most common source of flag-related production bugs.

6. **Use OpenFeature for vendor abstraction.** Adopt the CNCF OpenFeature specification
   as your evaluation interface. Swap providers (LaunchDarkly, Unleash, custom) without
   changing application code.

7. **Pre-define kill switches for non-critical features.** Before an incident, know exactly
   which flags to disable to shed load. Document them in the runbook.

8. **Implement flag dependency validation.** Prevent conflicting flags from being enabled
   simultaneously. Validate flag state in CI or at flag change time.

9. **Monitor flag evaluation metrics.** Track evaluation count, latency, and error rate
   per flag. Alert when a flag is evaluated zero times (dead code) or excessively.

10. **Clean up aggressively.** Run a weekly CI job or Slack bot that reports stale flags.
    Block merges when release flags exceed 90 days. Treat flag debt like any other tech debt.

---

## Anti-Patterns

| Anti-Pattern                           | Impact                                          | Fix                                                     |
|----------------------------------------|-------------------------------------------------|---------------------------------------------------------|
| Flags with no expiration date          | Accumulates dead code; testing combinatorics explode | Set max lifetime per type; automate staleness alerts  |
| Nested flag checks (flag-in-flag)      | Exponential code paths; untestable combinations  | Refactor to single flag; use flag dependencies instead |
| Using flags for permanent config       | Flag system becomes a config store               | Use environment config for permanent settings          |
| Non-deterministic percentage rollout   | User sees different behavior on each request     | Hash userId + flagName; never use random               |
| Client-side evaluation of sensitive rules | Targeting rules exposed to end users          | Use server-side SDK; send only evaluated result        |
| No flag cleanup process                | Hundreds of stale flags; cognitive overload      | CI enforcement + weekly reports + cleanup tickets      |
| Testing only one flag state            | Bugs in the OFF (or ON) path discovered in prod  | Require tests for both states in CI                    |
| Flag owner leaves, nobody maintains    | Orphan flags rot indefinitely                    | Assign team ownership; alert on ownerless flags        |

---

## Enforcement Checklist

- [ ] Every flag has a type (release/ops/experiment/permission) and owner
- [ ] Release flags have an expiration date set at creation time
- [ ] Cleanup ticket is pre-created for every release and experiment flag
- [ ] CI tests both ON and OFF states for every flagged feature
- [ ] Percentage rollouts use deterministic hashing (not random)
- [ ] OpenFeature or equivalent abstraction is used (no direct vendor SDK calls)
- [ ] Kill switches are documented in the incident response runbook
- [ ] Flag dependency/conflict rules are validated before flag state changes
- [ ] Weekly stale-flag report is sent to engineering leads
- [ ] CI fails when release flags exceed 90-day maximum lifetime
- [ ] Flag evaluation metrics (count, latency, errors) are monitored
- [ ] Client-side SDKs never receive full targeting rules (server-evaluated only)
