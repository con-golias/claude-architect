# Chaos Engineering

> **AI Plugin Directive — Chaos Testing, Failure Injection & Resilience Validation**
> You are an AI coding assistant. When generating, reviewing, or refactoring chaos engineering
> code, follow EVERY rule in this document. Resilience patterns that are never tested under
> real failure conditions will fail when they matter most. Treat each section as non-negotiable.

**Core Rule: ALWAYS validate resilience patterns with controlled failure injection. ALWAYS run chaos experiments in staging before production. ALWAYS define steady state, hypothesis, and blast radius before running experiments. NEVER run chaos experiments without monitoring and rollback capability.**

---

## 1. Chaos Engineering Process

```
┌──────────────────────────────────────────────────────────────┐
│              Chaos Experiment Lifecycle                        │
│                                                               │
│  1. Define Steady State                                      │
│     ├── "99.9% of requests succeed"                         │
│     ├── "P95 latency < 200ms"                               │
│     └── "Error rate < 0.1%"                                  │
│                                                               │
│  2. Form Hypothesis                                          │
│     └── "If payment service goes down, orders degrade       │
│          gracefully with 'pending' status"                   │
│                                                               │
│  3. Define Blast Radius                                      │
│     ├── Which service/pod/region                            │
│     ├── What percentage of traffic                          │
│     └── Duration and abort conditions                       │
│                                                               │
│  4. Run Experiment                                           │
│     ├── Inject failure (latency, errors, partition)         │
│     ├── Monitor dashboards in real-time                     │
│     └── Auto-abort if metrics exceed thresholds             │
│                                                               │
│  5. Analyze Results                                          │
│     ├── Did system behave as hypothesized?                  │
│     ├── Were alerts triggered correctly?                    │
│     └── Did fallbacks activate?                             │
│                                                               │
│  6. Fix & Iterate                                            │
│     └── Address any unexpected failures found               │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Failure Injection Patterns

```typescript
// Middleware: inject failures in non-production environments
class ChaosMiddleware {
  constructor(private config: ChaosConfig) {}

  middleware(): RequestHandler {
    return async (req, res, next) => {
      if (!this.config.enabled) return next();

      // Latency injection
      if (this.config.latencyMs && Math.random() < this.config.latencyRate) {
        const delay = this.config.latencyMs + Math.random() * this.config.latencyJitter;
        await sleep(delay);
        metrics.increment("chaos.latency_injected");
      }

      // Error injection
      if (this.config.errorRate && Math.random() < this.config.errorRate) {
        metrics.increment("chaos.error_injected");
        return res.status(this.config.errorStatus ?? 500).json({
          error: { type: "CHAOS_INJECTED", message: "Injected failure" },
        });
      }

      next();
    };
  }
}

interface ChaosConfig {
  enabled: boolean;
  latencyMs?: number;
  latencyJitter?: number;
  latencyRate?: number;     // 0.0 - 1.0
  errorRate?: number;       // 0.0 - 1.0
  errorStatus?: number;
}
```

```go
// Go: chaos injection via HTTP client wrapper
type ChaosHTTPClient struct {
    inner      *http.Client
    errorRate  float64
    latencyMs  int
    enabled    bool
}

func (c *ChaosHTTPClient) Do(req *http.Request) (*http.Response, error) {
    if c.enabled {
        if rand.Float64() < c.errorRate {
            metrics.Increment("chaos.error_injected")
            return nil, fmt.Errorf("chaos: injected error")
        }
        if c.latencyMs > 0 {
            delay := time.Duration(c.latencyMs) * time.Millisecond
            time.Sleep(delay + time.Duration(rand.Intn(c.latencyMs))*time.Millisecond)
        }
    }
    return c.inner.Do(req)
}
```

---

## 3. Common Experiments

| Experiment | Method | What It Tests |
|-----------|--------|--------------|
| **Service down** | Kill pod/container | Circuit breaker + fallback |
| **Latency spike** | Add 5s delay | Timeout configuration |
| **Network partition** | Block traffic between services | Isolation, fallback |
| **CPU stress** | `stress --cpu 4` | Load shedding, autoscaling |
| **Memory pressure** | `stress --vm 2 --vm-bytes 512M` | OOM handling, graceful degradation |
| **Disk full** | Fill disk | Error handling, alerting |
| **DNS failure** | Block DNS resolution | DNS caching, error handling |
| **Clock skew** | Adjust system clock | Token validation, TTL handling |
| **Dependency slow** | Inject latency on specific service | Per-dependency timeout + bulkhead |

---

## 4. Tools & Frameworks

| Tool | Scope | Platform |
|------|-------|----------|
| **Chaos Monkey** | Random instance termination | AWS/Netflix |
| **Litmus Chaos** | Kubernetes-native experiments | Kubernetes |
| **Gremlin** | Enterprise chaos platform | Any |
| **Chaos Mesh** | Kubernetes fault injection | Kubernetes |
| **Toxiproxy** | Network-level failure injection | Any (TCP proxy) |
| **tc / iptables** | Linux network manipulation | Linux |

```yaml
# Litmus Chaos — pod kill experiment
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: payment-chaos
spec:
  appinfo:
    appns: production
    applabel: "app=payment-service"
  chaosServiceAccount: litmus-admin
  experiments:
    - name: pod-delete
      spec:
        components:
          env:
            - name: TOTAL_CHAOS_DURATION
              value: "60"
            - name: CHAOS_INTERVAL
              value: "10"
            - name: FORCE
              value: "false"
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No chaos testing | Resilience patterns untested | Regular chaos experiments |
| Production chaos without staging | Real outages | Always test in staging first |
| No abort conditions | Experiment causes outage | Auto-abort on metric thresholds |
| No hypothesis | Random destruction | Define expected behavior first |
| Chaos in all environments | Dev environment instability | Feature flag per environment |
| No monitoring during chaos | Cannot observe impact | Dashboard + alerting active |

---

## 6. Enforcement Checklist

- [ ] Steady state metrics defined (success rate, latency, error rate)
- [ ] Hypothesis documented before each experiment
- [ ] Blast radius limited (single service, N% of traffic)
- [ ] Auto-abort configured on metric threshold breach
- [ ] Experiments run in staging before production
- [ ] Chaos injection disabled by default (feature flag)
- [ ] Results documented and shared with team
- [ ] Fix actions tracked for every unexpected failure found
