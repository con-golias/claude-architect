# A/B Testing & Experimentation

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Analytics & Telemetry |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Product Analytics](product-analytics.md), [Feature Flags](../../12-devops-infrastructure/ci-cd/feature-flags.md) |

---

## Core Concepts

### Experimentation Fundamentals

A/B testing compares two or more variants against a control to measure the causal impact of a change on a target metric.

**Key Statistical Concepts:**

| Concept | Definition | Typical Value |
|---------|-----------|---------------|
| **Null Hypothesis (H0)** | No difference between control and variant | -- |
| **Statistical Significance** | Probability the result is not due to chance | p < 0.05 (95% confidence) |
| **P-value** | Probability of observing the result if H0 is true | Lower = stronger evidence |
| **Confidence Interval** | Range within which the true effect likely falls | 95% CI is standard |
| **Statistical Power** | Probability of detecting a real effect | 80% minimum recommended |
| **Minimum Detectable Effect (MDE)** | Smallest effect size worth detecting | Business-dependent |
| **Type I Error (False Positive)** | Declare a winner when there is none | Alpha = 5% |
| **Type II Error (False Negative)** | Miss a real effect | Beta = 20% |

### Sample Size Calculation

Calculate required sample size **before** starting an experiment.

```python
# sample_size.py - Calculate minimum sample size per variant
import math
from scipy import stats

def min_sample_size(
    baseline_rate: float,
    mde: float,            # Minimum detectable effect (relative)
    alpha: float = 0.05,   # Significance level
    power: float = 0.80,   # Statistical power
) -> int:
    """Calculate minimum sample size per variant for a two-proportion z-test."""
    p1 = baseline_rate
    p2 = baseline_rate * (1 + mde)
    pooled = (p1 + p2) / 2

    z_alpha = stats.norm.ppf(1 - alpha / 2)
    z_beta = stats.norm.ppf(power)

    numerator = (
        z_alpha * math.sqrt(2 * pooled * (1 - pooled))
        + z_beta * math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))
    ) ** 2
    denominator = (p2 - p1) ** 2

    return math.ceil(numerator / denominator)

# Example: 5% baseline conversion, detect 10% relative lift
n = min_sample_size(baseline_rate=0.05, mde=0.10)
print(f"Need {n} users per variant")  # ~31,234 per variant
```

### Test Types

| Type | Description | Use When |
|------|-------------|----------|
| **A/B Test** | One control vs one variant | Testing a single change |
| **A/B/n Test** | One control vs multiple variants | Comparing several alternatives |
| **Multivariate (MVT)** | Test combinations of multiple variables | Optimizing several elements together |
| **Multi-Armed Bandit** | Dynamically shift traffic to winning variant | Minimizing opportunity cost during test |
| **Interleaving** | Mix results from both variants in one view | Ranking/recommendation experiments |

### Server-Side Experiment Assignment (TypeScript)

```typescript
// experiments/assignment.ts
import crypto from "node:crypto";

interface Experiment {
  id: string;
  name: string;
  variants: Variant[];
  trafficAllocation: number; // 0-1, percentage of users in experiment
  status: "draft" | "running" | "paused" | "completed";
}

interface Variant {
  id: string;
  name: string;
  weight: number; // 0-1, sums to 1.0 across variants
}

interface Assignment {
  experimentId: string;
  variantId: string;
  userId: string;
  assignedAt: Date;
}

class ExperimentEngine {
  private experiments: Map<string, Experiment> = new Map();

  registerExperiment(experiment: Experiment): void {
    this.experiments.set(experiment.id, experiment);
  }

  /**
   * Deterministic assignment using hash-based bucketing.
   * Same userId + experimentId always returns the same variant.
   */
  assign(userId: string, experimentId: string): Assignment | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "running") return null;

    // Determine if user is in experiment (traffic allocation)
    const trafficHash = this.hashToFloat(
      `${experimentId}:traffic:${userId}`
    );
    if (trafficHash > experiment.trafficAllocation) return null;

    // Assign to variant based on weight
    const variantHash = this.hashToFloat(
      `${experimentId}:variant:${userId}`
    );
    let cumulative = 0;
    for (const variant of experiment.variants) {
      cumulative += variant.weight;
      if (variantHash <= cumulative) {
        return {
          experimentId,
          variantId: variant.id,
          userId,
          assignedAt: new Date(),
        };
      }
    }
    return null;
  }

  private hashToFloat(input: string): number {
    const hash = crypto.createHash("sha256").update(input).digest("hex");
    return parseInt(hash.slice(0, 8), 16) / 0xffffffff;
  }
}

// Usage
const engine = new ExperimentEngine();
engine.registerExperiment({
  id: "exp-checkout-v2",
  name: "New Checkout Flow",
  status: "running",
  trafficAllocation: 0.5, // 50% of users
  variants: [
    { id: "control", name: "Current Checkout", weight: 0.5 },
    { id: "variant-a", name: "Simplified Checkout", weight: 0.5 },
  ],
});

const assignment = engine.assign("user-123", "exp-checkout-v2");
// assignment is deterministic: same user always gets same variant
```

### Feature Flag Integration (Go)

```go
// experiments/flag.go
package experiments

import (
    "context"
    "crypto/sha256"
    "encoding/binary"
    "fmt"
    "math"
)

type FeatureFlagExperiment struct {
    FlagKey          string
    ExperimentID     string
    TrafficPercent   float64
    Variants         map[string]float64 // variant_name -> weight
}

func (e *FeatureFlagExperiment) GetVariant(
    ctx context.Context, userID string,
) (string, bool) {
    // Hash-based deterministic bucketing
    bucket := hashToBucket(
        fmt.Sprintf("%s:%s", e.ExperimentID, userID),
    )

    if bucket > e.TrafficPercent {
        return "", false // User not in experiment
    }

    variantBucket := hashToBucket(
        fmt.Sprintf("%s:v:%s", e.ExperimentID, userID),
    )

    cumulative := 0.0
    for name, weight := range e.Variants {
        cumulative += weight
        if variantBucket <= cumulative {
            return name, true
        }
    }
    return "", false
}

func hashToBucket(input string) float64 {
    h := sha256.Sum256([]byte(input))
    num := binary.BigEndian.Uint32(h[:4])
    return float64(num) / float64(math.MaxUint32)
}
```

### Experiment Lifecycle

```
1. DESIGN
   - State hypothesis: "Changing X will improve Y by Z%"
   - Choose primary metric and guardrail metrics
   - Calculate sample size and expected duration

2. INSTRUMENT
   - Implement variants behind feature flags
   - Add event tracking for primary and guardrail metrics
   - QA both control and variant experiences

3. RUN
   - Launch to calculated traffic percentage
   - Monitor guardrail metrics for regressions
   - Do NOT peek at results before reaching sample size

4. ANALYZE
   - Check statistical significance (p < 0.05)
   - Evaluate practical significance (is the effect meaningful?)
   - Review guardrail metrics for unexpected side effects
   - Segment results (platform, geography, user cohort)

5. DECIDE
   - Ship the winner (or declare inconclusive)
   - Document learnings regardless of outcome
   - Update product backlog based on insights

6. CLEAN UP
   - Remove losing variant code
   - Remove feature flag (reduce tech debt)
   - Archive experiment results for institutional knowledge
```

### Results Analysis (Python)

```python
# experiments/analysis.py
from dataclasses import dataclass
from scipy import stats
import numpy as np

@dataclass
class VariantResult:
    name: str
    visitors: int
    conversions: int

    @property
    def rate(self) -> float:
        return self.conversions / self.visitors if self.visitors > 0 else 0

def analyze_experiment(
    control: VariantResult, variant: VariantResult
) -> dict:
    """Analyze A/B test results using a two-proportion z-test."""
    # Pooled proportion
    p_pool = (control.conversions + variant.conversions) / (
        control.visitors + variant.visitors
    )
    se = np.sqrt(
        p_pool * (1 - p_pool)
        * (1 / control.visitors + 1 / variant.visitors)
    )

    z_score = (variant.rate - control.rate) / se if se > 0 else 0
    p_value = 2 * (1 - stats.norm.cdf(abs(z_score)))

    # Relative lift
    lift = (
        (variant.rate - control.rate) / control.rate
        if control.rate > 0
        else 0
    )

    # 95% confidence interval for the difference
    diff = variant.rate - control.rate
    margin = 1.96 * se

    return {
        "control_rate": round(control.rate, 4),
        "variant_rate": round(variant.rate, 4),
        "relative_lift": round(lift, 4),
        "p_value": round(p_value, 4),
        "significant": p_value < 0.05,
        "ci_lower": round(diff - margin, 4),
        "ci_upper": round(diff + margin, 4),
    }

# Example usage
result = analyze_experiment(
    control=VariantResult("Control", visitors=15000, conversions=750),
    variant=VariantResult("Variant A", visitors=15000, conversions=825),
)
# { significant: True, relative_lift: 0.10, p_value: 0.033, ... }
```

### Common Pitfalls

| Pitfall | Description | Mitigation |
|---------|-------------|------------|
| **Peeking Problem** | Checking results before sample size reached inflates false positives | Pre-commit to sample size; use sequential testing if early stopping needed |
| **Multiple Comparisons** | Testing many variants without correction increases false positive rate | Apply Bonferroni or Benjamini-Hochberg correction |
| **Novelty Effect** | Users engage with new UI simply because it is new | Run experiment for 2+ weeks; exclude first few days |
| **Selection Bias** | Non-random assignment skews results | Use hash-based deterministic assignment |
| **Simpson's Paradox** | Aggregate result reverses when segmented | Always check key segments (device, country, user type) |
| **Interference/Network Effects** | Users in different groups interact with each other | Use cluster randomization for social features |

### Tools Comparison

| Tool | Type | Strengths | Best For |
|------|------|-----------|----------|
| **LaunchDarkly** | Cloud SaaS | Feature flags + experiments, SDKs | Enterprise teams |
| **Statsig** | Cloud SaaS | Strong stats engine, warehouse-native | Data-savvy teams |
| **Optimizely** | Cloud SaaS | Visual editor, full-stack | Marketing + engineering |
| **GrowthBook** | Open-source | Warehouse-native, Bayesian stats | Self-hosted, data teams |
| **Eppo** | Cloud SaaS | Warehouse-native, CUPED | Analytics-heavy orgs |

---

## Best Practices

1. **State a hypothesis before every experiment.** "We believe [change] will [impact] [metric] by [amount] because [reasoning]." Without a hypothesis, experiments produce noise.
2. **Calculate sample size upfront.** Use a power calculator before launch; never start an experiment hoping traffic will be "enough."
3. **Define guardrail metrics.** Beyond the primary metric, monitor metrics that must not degrade (page load time, error rate, revenue per user).
4. **Use hash-based deterministic assignment.** Ensure the same user always sees the same variant, even across sessions and devices.
5. **Never peek at results.** Pre-commit to the sample size and duration. If you must look early, use sequential testing methods (e.g., always-valid p-values).
6. **Run experiments for at least one full business cycle.** A minimum of 1-2 weeks accounts for day-of-week effects and user behavior patterns.
7. **Clean up experiment code promptly.** After a decision, remove the losing variant and the feature flag within 2 sprints to prevent tech debt accumulation.
8. **Log every experiment.** Maintain a searchable experiment registry with hypothesis, results, and decision. This builds institutional learning.
9. **Segment results before declaring a winner.** Aggregate results can mask that a variant helps one segment while hurting another.
10. **Start with high-impact, low-risk experiments.** Build experimentation muscle on UI tweaks before testing core flow changes.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Running experiments without hypothesis | No learning; wasted effort | Require hypothesis in experiment design doc |
| Stopping experiments early on first positive signal | Inflated false positive rate (up to 30%) | Lock in duration; use sequential testing |
| Testing too many things at once | Cannot attribute effect to any single change | Change one variable per experiment |
| Not accounting for multiple comparisons | False positives multiply across variants | Apply statistical corrections |
| Ignoring practical significance | Statistically significant but meaningless 0.1% lift ships complexity | Define minimum practical effect size upfront |
| Keeping dead experiment code | Codebase bloats with branching logic | Mandate flag cleanup SLA (e.g., 2 weeks post-decision) |
| Only testing conversion rate | Miss downstream effects on retention or revenue | Include guardrail and secondary metrics |
| No experiment review process | Poorly designed experiments waste traffic | Require peer review of experiment design |

---

## Enforcement Checklist

- [ ] Experiment design template with hypothesis, metrics, and sample size
- [ ] Hash-based deterministic assignment implemented
- [ ] Guardrail metrics defined and monitored for every experiment
- [ ] Sample size calculator available and used before launch
- [ ] Sequential testing or fixed-horizon policy documented
- [ ] Experiment registry tracking all past and current experiments
- [ ] Feature flag cleanup SLA defined (max 2 weeks after decision)
- [ ] Statistical review process for experiment results
- [ ] Segmentation analysis performed before shipping winners
- [ ] Experiment code removed and results documented post-decision
