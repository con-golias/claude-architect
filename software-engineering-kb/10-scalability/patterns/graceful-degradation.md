# Graceful Degradation

| Field          | Value                          |
|----------------|--------------------------------|
| Domain         | Scalability > Patterns         |
| Importance     | High                           |
| Last Updated   | 2026-03-10                     |

> **Scalability Focus**: This document covers graceful degradation as a **capacity preservation
> strategy** -- systematically reducing feature scope to maintain core functionality under
> extreme load or partial system failure.

---

## 1. Core Concepts

### 1.1 Degradation Levels

Define explicit levels that map to system health:

| Level | Name         | Trigger                          | Action                                    |
|-------|--------------|----------------------------------|-------------------------------------------|
| 0     | Normal       | All systems healthy              | Full feature set enabled                  |
| 1     | Reduced      | Non-critical dependency degraded | Disable recommendations, analytics        |
| 2     | Limited      | Core dependency under stress     | Serve cached data, disable search filters |
| 3     | Essential    | Major outage in progress         | Read-only mode, static fallbacks          |
| 4     | Survival     | Cascading failures               | Health check + maintenance page only      |

### 1.2 Feature Priority Tiers

Classify every feature into a tier before the system is under stress:

- **Tier 1 (Critical)**: Authentication, checkout, payment processing -- never disabled.
- **Tier 2 (Important)**: Product search, order history, account settings -- last to degrade.
- **Tier 3 (Enhancement)**: Personalized recommendations, reviews, wish lists -- first to disable.
- **Tier 4 (Optional)**: Analytics tracking, A/B experiments, social features -- disable immediately.

### 1.3 SLA Tiers and Degradation Policies

| Tier     | Degradation Level 1      | Level 2               | Level 3              |
|----------|--------------------------|------------------------|----------------------|
| Premium  | Full features            | Minor feature reduction | Cached + core only   |
| Standard | Tier 4 features disabled | Tier 3+4 disabled      | Read-only mode       |
| Free     | Tier 3+4 disabled        | Rate limited + cached  | Maintenance page     |

---

## 2. Code Examples

### 2.1 TypeScript -- Degradation Controller with Feature Flags

```typescript
enum DegradationLevel {
  Normal = 0,
  Reduced = 1,
  Limited = 2,
  Essential = 3,
  Survival = 4,
}

interface FeatureConfig {
  name: string;
  tier: 1 | 2 | 3 | 4;
  fallback?: () => Promise<unknown>;
}

class DegradationController {
  private level = DegradationLevel.Normal;
  private features: Map<string, FeatureConfig> = new Map();
  private healthScores: Map<string, number> = new Map();

  registerFeature(config: FeatureConfig): void {
    this.features.set(config.name, config);
  }

  updateHealthScore(dependency: string, score: number): void {
    this.healthScores.set(dependency, score);
    this.recalculateLevel();
  }

  isFeatureEnabled(featureName: string): boolean {
    const feature = this.features.get(featureName);
    if (!feature) return false;

    switch (this.level) {
      case DegradationLevel.Normal:
        return true;
      case DegradationLevel.Reduced:
        return feature.tier <= 3;
      case DegradationLevel.Limited:
        return feature.tier <= 2;
      case DegradationLevel.Essential:
        return feature.tier === 1;
      case DegradationLevel.Survival:
        return false;
    }
  }

  async executeWithDegradation<T>(
    featureName: string,
    primaryFn: () => Promise<T>,
    options?: { fallbackValue?: T }
  ): Promise<T | undefined> {
    const feature = this.features.get(featureName);
    if (!feature) throw new Error(`Unknown feature: ${featureName}`);

    if (!this.isFeatureEnabled(featureName)) {
      if (feature.fallback) return feature.fallback() as Promise<T>;
      return options?.fallbackValue;
    }

    try {
      return await primaryFn();
    } catch {
      if (feature.fallback) return feature.fallback() as Promise<T>;
      return options?.fallbackValue;
    }
  }

  private recalculateLevel(): void {
    const scores = Array.from(this.healthScores.values());
    if (scores.length === 0) return;

    const avgHealth = scores.reduce((a, b) => a + b, 0) / scores.length;
    const minHealth = Math.min(...scores);

    if (minHealth < 0.1) this.level = DegradationLevel.Survival;
    else if (avgHealth < 0.3) this.level = DegradationLevel.Essential;
    else if (avgHealth < 0.6) this.level = DegradationLevel.Limited;
    else if (avgHealth < 0.8) this.level = DegradationLevel.Reduced;
    else this.level = DegradationLevel.Normal;
  }

  getCurrentLevel(): DegradationLevel {
    return this.level;
  }
}

// Usage
const controller = new DegradationController();

controller.registerFeature({
  name: "recommendations",
  tier: 3,
  fallback: async () => getCachedTopProducts(),
});

controller.registerFeature({
  name: "checkout",
  tier: 1,
});

controller.registerFeature({
  name: "analytics",
  tier: 4,
  fallback: async () => { /* noop -- drop analytics event */ },
});
```

### 2.2 Go -- Health-Aware Degradation Middleware

```go
package degradation

import (
    "encoding/json"
    "net/http"
    "sync"
    "sync/atomic"
    "time"
)

type Level int32

const (
    Normal    Level = 0
    Reduced   Level = 1
    Limited   Level = 2
    Essential Level = 3
    Survival  Level = 4
)

type Manager struct {
    level        atomic.Int32
    healthScores sync.Map // string -> float64
    cache        CacheProvider
}

type CacheProvider interface {
    Get(key string) ([]byte, bool)
}

func NewManager(cache CacheProvider) *Manager {
    m := &Manager{cache: cache}
    m.level.Store(int32(Normal))
    return m
}

func (m *Manager) UpdateHealth(service string, score float64) {
    m.healthScores.Store(service, score)
    m.recalculate()
}

func (m *Manager) Level() Level {
    return Level(m.level.Load())
}

func (m *Manager) Middleware(tier int) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            currentLevel := m.Level()

            maxTier := tierForLevel(currentLevel)
            if tier > maxTier {
                // Feature disabled at current degradation level
                m.serveFallback(w, r)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}

func tierForLevel(l Level) int {
    switch l {
    case Normal:
        return 4
    case Reduced:
        return 3
    case Limited:
        return 2
    case Essential:
        return 1
    default:
        return 0
    }
}

func (m *Manager) serveFallback(w http.ResponseWriter, r *http.Request) {
    cacheKey := "fallback:" + r.URL.Path
    if data, ok := m.cache.Get(cacheKey); ok {
        w.Header().Set("X-Degraded", "true")
        w.Header().Set("X-Cache", "fallback")
        w.WriteHeader(http.StatusOK)
        w.Write(data)
        return
    }
    w.Header().Set("X-Degraded", "true")
    w.WriteHeader(http.StatusServiceUnavailable)
    json.NewEncoder(w).Encode(map[string]string{
        "status":  "degraded",
        "message": "feature temporarily unavailable",
    })
}

func (m *Manager) recalculate() {
    var sum, count float64
    var min float64 = 1.0
    m.healthScores.Range(func(_, value any) bool {
        s := value.(float64)
        sum += s
        count++
        if s < min { min = s }
        return true
    })
    if count == 0 { return }
    avg := sum / count

    var newLevel Level
    switch {
    case min < 0.1:
        newLevel = Survival
    case avg < 0.3:
        newLevel = Essential
    case avg < 0.6:
        newLevel = Limited
    case avg < 0.8:
        newLevel = Reduced
    default:
        newLevel = Normal
    }
    m.level.Store(int32(newLevel))
}
```

### 2.3 Client-Side Degradation Strategies

```typescript
// Stale-while-revalidate pattern for client-side degradation
interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  maxAgeMs: number;
  staleWhileRevalidateMs: number;
}

class StaleWhileRevalidateCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private pending = new Map<string, Promise<T>>();

  async get(
    key: string,
    fetcher: () => Promise<T>,
    maxAgeMs = 60_000,
    staleMs = 300_000
  ): Promise<T> {
    const entry = this.cache.get(key);
    const now = Date.now();

    if (entry) {
      const age = now - entry.fetchedAt;
      if (age < maxAgeMs) return entry.data; // Fresh
      if (age < maxAgeMs + staleMs) {
        this.revalidateInBackground(key, fetcher, maxAgeMs, staleMs);
        return entry.data; // Stale but usable
      }
    }

    // No cache or expired: fetch synchronously
    try {
      const data = await fetcher();
      this.cache.set(key, { data, fetchedAt: now, maxAgeMs, staleWhileRevalidateMs: staleMs });
      return data;
    } catch (err) {
      if (entry) return entry.data; // Return stale data on error
      throw err;
    }
  }

  private revalidateInBackground(
    key: string,
    fetcher: () => Promise<T>,
    maxAgeMs: number,
    staleMs: number
  ): void {
    if (this.pending.has(key)) return;
    const promise = fetcher()
      .then((data) => {
        this.cache.set(key, {
          data, fetchedAt: Date.now(), maxAgeMs, staleWhileRevalidateMs: staleMs,
        });
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, promise as Promise<T>);
  }
}
```

---

## 3. Best Practices

1. **Define degradation levels before incidents occur** -- document which features disable at each level.
2. **Classify every feature into a priority tier** -- unclassified features are impossible to shed systematically.
3. **Automate degradation triggers** -- use health scores and thresholds, not manual intervention.
4. **Provide cached or static fallbacks** -- disabling a feature should return useful data, not an error.
5. **Add response headers indicating degraded state** -- `X-Degraded: true` lets clients and monitors detect degradation.
6. **Test degradation transitions regularly** -- run game days that force each degradation level.
7. **Implement per-SLA-tier policies** -- premium customers should experience degradation last.
8. **Make degradation reversible and fast** -- recovery from Level 3 to Level 0 must be automated.
9. **Log every degradation transition with context** -- capture which health scores triggered the change.
10. **Use feature flags backed by a remote config service** -- enable manual override of degradation decisions.

---

## 4. Anti-Patterns

| #  | Anti-Pattern                            | Problem                                                 | Correction                                              |
|----|-----------------------------------------|---------------------------------------------------------|---------------------------------------------------------|
| 1  | Binary on/off with no middle ground     | System goes from full features to complete outage        | Define 3-5 graduated degradation levels                 |
| 2  | Manual-only degradation triggers        | Humans are too slow to react during cascading failures   | Automate triggers with health score thresholds          |
| 3  | No fallback content for disabled features | Users see empty sections or raw errors                 | Pre-cache fallback content for every degradable feature |
| 4  | Degrading critical features first       | Payment processing disabled before analytics            | Enforce tier ordering: shed lowest priority first       |
| 5  | No recovery automation                  | System stays degraded after the incident resolves        | Auto-recover when health scores exceed thresholds       |
| 6  | Testing degradation only in production  | Unknown behavior during degradation discovered live      | Test every level in staging with chaos engineering      |
| 7  | Same degradation policy for all tenants | Premium customers experience same outage as free tier    | Implement SLA-aware degradation policies                |
| 8  | Silent degradation with no observability | No one knows the system is running in degraded mode     | Emit metrics and alerts for every level transition      |

---

## 5. Enforcement Checklist

- [ ] All features are classified into priority tiers (1-4) in a central registry.
- [ ] Degradation levels (0-4) are defined with specific feature disablement per level.
- [ ] Health scores from all critical dependencies feed into the degradation controller.
- [ ] Automated triggers transition between levels based on health score thresholds.
- [ ] Fallback responses (cached, static, or reduced) exist for every Tier 2-4 feature.
- [ ] Response headers (`X-Degraded`, `X-Degradation-Level`) are set during degradation.
- [ ] Degradation level changes are logged with full context and trigger details.
- [ ] Recovery is automated: system returns to Normal when health scores stabilize.
- [ ] Game days validate each degradation level at least once per quarter.
- [ ] SLA-tier-specific policies are configured for multi-tenant deployments.
