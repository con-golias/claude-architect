# Shift-Left and Shift-Right Testing

| Attribute      | Value                                                        |
|---------------|--------------------------------------------------------------|
| Domain        | Testing > Philosophy                                         |
| Importance    | High                                                         |
| Last Updated  | 2026-03-10                                                   |
| Cross-ref     | [Testing Pyramid](testing-pyramid.md), [What to Test](what-to-test.md), [Chaos Engineering](../performance-testing/chaos-engineering.md) |

---

## Core Concepts

### Shift-Left: Move Testing Earlier

Catch defects as early as possible — during design, planning, and pre-commit
rather than post-deployment.

```
Traditional:  Design -> Code -> Build -> [Test] -> Deploy -> Monitor
Shift-Left:  [Design] -> [Code] -> [Build] -> Test -> Deploy -> Monitor
```

**Techniques:** static analysis at save time, pre-commit hooks (lint, format,
unit tests), design reviews for testability, threat modeling, contract-first
API design, pair programming as real-time review.

### Shift-Right: Test in Production

Extend test activities into production to catch issues that only manifest
under real-world conditions.

```
Traditional:  Design -> Code -> Build -> [Test] -> Deploy -> Monitor
Shift-Right:  Design -> Code -> Build -> Test -> [Deploy] -> [Monitor]
```

**Techniques:** feature flags, canary deployments, A/B testing, dark launches,
shadow traffic, chaos engineering, synthetic monitoring.

### The Full Spectrum

```
  SHIFT LEFT                                    SHIFT RIGHT
  <------------------------------------------------------------->

  Design    Pre-commit   CI/CD      Staging     Production
  ------    ----------   -----      -------     ----------
  Threat    Lint         Unit       Smoke       Feature flags
  model     Type-check   Integ      Perf        Canary deploy
  API-first Format       E2E        Contract    Chaos tests
  Review    Unit test    Security   Pen test    Synthetic mon.
            Secrets scan SAST/DAST  Load test   Shadow traffic
```

---

## Shift-Left: Pre-Commit Hooks

### TypeScript: Husky + lint-staged Configuration

```json
// package.json
{
  "scripts": {
    "prepare": "husky",
    "lint": "eslint --max-warnings 0 .",
    "typecheck": "tsc --noEmit",
    "test:unit": "jest --selectProjects unit --bail",
    "format:check": "prettier --check ."
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --max-warnings 0 --fix",
      "prettier --write"
    ],
    "*.{json,md,yml}": [
      "prettier --write"
    ]
  }
}
```

```typescript
// .husky/pre-commit  -> npx lint-staged
// .husky/pre-push    -> npm run typecheck && npm run test:unit
```

```typescript
// eslint.config.ts — Enforce quality at save time
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      'no-console': 'error',
      'no-debugger': 'error',
    },
  },
);
```

### Go: Pre-Commit Quality Gates

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/golangci/golangci-lint
    rev: v1.57.0
    hooks:
      - id: golangci-lint
        args: ['--timeout=3m']
  - repo: local
    hooks:
      - id: go-vet
        name: go vet
        entry: go vet ./...
        language: system
        types: [go]
      - id: go-test-short
        name: go test (short)
        entry: go test -short -count=1 -timeout 60s ./...
        language: system
        types: [go]
```

```makefile
# Makefile — Enforce quality gates locally
.PHONY: pre-commit ci

pre-commit: lint vet test-short
	@echo "All pre-commit checks passed"

lint:
	golangci-lint run --timeout 3m ./...

vet:
	go vet ./...

test-short:
	go test -short -count=1 -timeout 60s ./...

ci: lint vet test-all security-scan
	@echo "CI pipeline passed"

test-all:
	go test -count=1 -race -timeout 5m ./...

security-scan:
	gosec ./...
	govulncheck ./...
```

---

## Shift-Right: Testing in Production

### Go: Feature Flags for Progressive Rollouts

```go
// feature/flags.go — Feature flag evaluator
package feature

import "context"

type Flag struct {
    Name       string
    Enabled    bool
    Percentage int // 0-100: percentage of users who see this feature
}

type FlagStore interface {
    Get(ctx context.Context, name string) (Flag, error)
}

type FlagEvaluator struct {
    store FlagStore
}

func NewFlagEvaluator(store FlagStore) *FlagEvaluator {
    return &FlagEvaluator{store: store}
}

func (e *FlagEvaluator) IsEnabled(ctx context.Context, flagName, userID string) bool {
    flag, err := e.store.Get(ctx, flagName)
    if err != nil {
        return false // Fail closed: feature off if flag unreadable
    }
    if !flag.Enabled {
        return false
    }
    if flag.Percentage >= 100 {
        return true
    }
    return hashUserToPercentage(userID, flagName) < flag.Percentage
}
```

```go
// api/handler.go — Feature flags with shadow comparison
package api

import (
    "encoding/json"
    "net/http"
)

type CheckoutHandler struct {
    flags       *feature.FlagEvaluator
    oldCheckout CheckoutService
    newCheckout CheckoutService
}

func (h *CheckoutHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value("userID").(string)
    var result OrderResult
    var err error

    if h.flags.IsEnabled(r.Context(), "new-checkout-flow", userID) {
        result, err = h.newCheckout.Process(r.Context(), r.Body)
        // Shadow comparison: run old path, log discrepancies
        if h.flags.IsEnabled(r.Context(), "checkout-shadow-compare", userID) {
            go h.shadowCompare(r.Context(), r.Body, result)
        }
    } else {
        result, err = h.oldCheckout.Process(r.Context(), r.Body)
    }

    if err != nil {
        http.Error(w, "checkout failed", http.StatusInternalServerError)
        return
    }
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(result)
}
```

### Canary Deployments

```yaml
# kubernetes/canary-deployment.yaml — Argo Rollouts canary strategy
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: checkout-service
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 5
        - pause: { duration: 10m }
        - analysis:
            templates:
              - templateName: error-rate-check
        - setWeight: 25
        - pause: { duration: 15m }
        - analysis:
            templates:
              - templateName: error-rate-check
              - templateName: latency-check
        - setWeight: 50
        - pause: { duration: 15m }
        - setWeight: 100
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: error-rate-check
spec:
  metrics:
    - name: error-rate
      interval: 60s
      successCondition: result[0] < 0.01
      provider:
        prometheus:
          query: |
            sum(rate(http_requests_total{status=~"5..",service="checkout"}[5m]))
            / sum(rate(http_requests_total{service="checkout"}[5m]))
```

### Dark Launches and Shadow Traffic

```typescript
// src/middleware/shadow-traffic.ts
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

interface ShadowConfig {
  enabled: boolean;
  targetUrl: string;
  sampleRate: number; // 0.0 to 1.0
}

export function shadowTraffic(config: ShadowConfig) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!config.enabled || Math.random() > config.sampleRate) {
      return next();
    }
    // Fire-and-forget: clone request to shadow service
    void axios({
      method: req.method,
      url: `${config.targetUrl}${req.originalUrl}`,
      headers: { ...req.headers, 'x-shadow-traffic': 'true', host: undefined },
      data: req.body,
      timeout: 5000,
    }).catch((err) => {
      console.warn('Shadow traffic error:', err.message);
    });
    next();
  };
}
```

### Synthetic Monitoring

```typescript
// src/monitoring/synthetic-probes.ts
async function runProbe(name: string, fn: () => Promise<void>): Promise<ProbeResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, success: true, durationMs: Date.now() - start };
  } catch (err) {
    return { name, success: false, durationMs: Date.now() - start,
             error: err instanceof Error ? err.message : String(err) };
  }
}

const probes = [
  () => runProbe('homepage-loads', async () => {
    const res = await fetch('https://myapp.com/');
    if (!res.ok) throw new Error(`Status: ${res.status}`);
  }),
  () => runProbe('api-health', async () => {
    const res = await fetch('https://api.myapp.com/health');
    const body = await res.json();
    if (body.status !== 'healthy') throw new Error(`Unhealthy: ${body.status}`);
  }),
  () => runProbe('checkout-flow', async () => {
    const cart = await fetch('https://api.myapp.com/carts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SYNTHETIC_USER_TOKEN}` },
      body: JSON.stringify({ items: [{ sku: 'PROBE-ITEM', quantity: 1 }] }),
    });
    if (!cart.ok) throw new Error(`Cart creation failed: ${cart.status}`);
  }),
];
// Schedule probes every 5 minutes via cron or Kubernetes CronJob
```

### Chaos Engineering as Shift-Right Testing

> For a comprehensive treatment, see [Chaos Engineering](../performance-testing/chaos-engineering.md).

Chaos engineering validates system resilience by deliberately injecting failures.
Define a hypothesis, constrain the blast radius, inject, validate, and roll back.

```go
// chaos/experiment.go — Chaos experiment structure
package chaos

import (
    "context"
    "fmt"
    "log"
    "time"
)

type Experiment struct {
    Name        string
    Hypothesis  string
    BlastRadius float64 // 0.0-1.0
    Duration    time.Duration
    Inject      func(ctx context.Context) error
    Rollback    func(ctx context.Context) error
    Validate    func(ctx context.Context) (bool, error)
}

func (e *Experiment) Run(ctx context.Context) error {
    log.Printf("CHAOS: Starting %q — %s", e.Name, e.Hypothesis)
    if err := e.Inject(ctx); err != nil {
        return fmt.Errorf("injection failed: %w", err)
    }
    select {
    case <-time.After(e.Duration):
    case <-ctx.Done():
        return e.Rollback(ctx)
    }
    passed, _ := e.Validate(ctx)
    _ = e.Rollback(ctx)
    if passed {
        log.Printf("CHAOS: %q PASSED", e.Name)
    } else {
        log.Printf("CHAOS: %q FAILED — system is NOT resilient", e.Name)
    }
    return nil
}
```

### Monitoring-Driven Development

Write alerting rules during feature development, not after deployment.

```yaml
# monitoring/alerts/checkout-alerts.yaml
groups:
  - name: checkout-service
    rules:
      - alert: CheckoutErrorRateHigh
        expr: |
          sum(rate(http_requests_total{service="checkout",status=~"5.."}[5m]))
          / sum(rate(http_requests_total{service="checkout"}[5m])) > 0.01
        for: 5m
        labels: { severity: critical }
        annotations: { summary: "Checkout error rate exceeds 1%" }
      - alert: CheckoutLatencyP99High
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket{service="checkout"}[5m])) by (le)
          ) > 2.0
        for: 5m
        labels: { severity: warning }
        annotations: { summary: "Checkout p99 latency exceeds 2 seconds" }
```

---

## 10 Best Practices

1. **Enforce pre-commit hooks project-wide.** Use husky (JS/TS), pre-commit
   (Python), or Makefiles (Go) — never rely on developer discipline alone.
2. **Fail fast on static analysis.** Run type checking and linting before any
   test execution. These are the cheapest quality gates.
3. **Gate PRs on unit + integration tests.** Never merge code that has not passed
   at least two test layers in CI.
4. **Use feature flags for every non-trivial production change.** Decouple
   deployment from release to enable safe shift-right testing.
5. **Implement automated canary analysis.** Compare error rates and latencies
   between canary and baseline — never rely on manual observation.
6. **Run synthetic monitoring on all critical paths.** Automated probes every
   5 minutes catch outages before customers do.
7. **Shadow test new implementations before cutover.** Dark launches with result
   comparison validate correctness without user impact.
8. **Write alerting rules during feature development.** If you cannot alert on
   a feature's health, it is not ready to ship.
9. **Track mean time to detection (MTTD).** Shift-right testing should reduce
   MTTD. Measure it and set targets.
10. **Conduct chaos experiments regularly.** Start with non-critical services in
    staging, graduate to production with tight blast radius controls.

---

## Anti-Patterns

| Anti-Pattern                            | Impact                                        | Fix                                                       |
|-----------------------------------------|-----------------------------------------------|-----------------------------------------------------------|
| No pre-commit hooks ("trust developers") | Lint errors and type bugs reach CI; slow feedback | Enforce hooks via prepare scripts and CI validation      |
| Skipping hooks with --no-verify         | Bypasses all quality gates                     | CI runs all checks independently; hooks are a convenience |
| Feature flags without cleanup           | Flag debt accumulates; dead code paths linger  | Set expiration dates; alert on flags older than 30 days   |
| Canary without automated rollback       | Bad deployments soak until a human notices     | Automate rollback on metric threshold breach              |
| Shadow traffic affecting production     | Shadow calls mutate state or consume resources | Shadow traffic must be read-only; isolate write paths     |
| Monitoring added after incidents        | Reactive, not proactive; same class recurs     | Require monitoring PR review before feature merges        |
| Chaos experiments without hypothesis    | Random breakage with no learning outcome       | Define hypothesis, blast radius, and rollback before start|
| Testing only in staging, never prod     | Staging does not replicate real traffic patterns | Complement staging with synthetic probes and canary      |

---

## Enforcement Checklist

- [ ] Pre-commit hooks are installed automatically via `prepare` scripts
- [ ] CI pipeline validates that pre-commit hooks are not bypassed
- [ ] Static analysis (types, lint, format) runs in under 30 seconds locally
- [ ] Feature flag system is in place with dashboard and audit log
- [ ] Feature flags have mandatory expiration dates (max 30 days for experiments)
- [ ] Canary deployment pipeline includes automated metric analysis
- [ ] Automated rollback triggers are configured for error rate and latency
- [ ] Synthetic monitoring probes run every 5 minutes on critical paths
- [ ] Alerting rules are reviewed as part of feature PRs
- [ ] Shadow traffic comparison reports are generated for new service versions
- [ ] Chaos experiments are scheduled monthly (staging) or quarterly (production)
- [ ] MTTD and MTTR metrics are tracked and reviewed in incident retrospectives
