# Chaos Engineering

| Attribute      | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| Domain         | Testing > Performance Testing                                      |
| Importance     | High                                                               |
| Last Updated   | 2026-03-10                                                         |
| Cross-ref      | `10-scalability/patterns/circuit-breaker.md`, `10-scalability/patterns/graceful-degradation.md` |

---

## Core Concepts

### What Chaos Engineering Is

Chaos engineering is the discipline of **experimenting on a distributed system to build confidence in its ability to withstand turbulent conditions in production**. It does not aim to break things for fun -- it systematically uncovers weaknesses before they cause outages.

### The Four Principles

1. **Start with a steady-state hypothesis** -- Define what "normal" looks like using business metrics (order rate, login success rate), not just technical metrics. The experiment succeeds if the steady state is maintained despite the injected fault.
2. **Vary real-world events** -- Simulate failures that actually happen: server crashes, network partitions, disk full, DNS failures, clock skew, dependency slowdowns.
3. **Run experiments in production** -- Staging environments lack the traffic patterns, data volumes, and configuration drift that cause real failures. Progress toward production experiments as maturity increases.
4. **Minimize blast radius** -- Start small. Target a single pod, a single availability zone, or a canary cohort. Expand scope only after building confidence.

### Chaos Maturity Model

| Level | Description | Example |
| ----- | ----------- | ------- |
| 0 -- Ad hoc | Manual kill of a process during an incident retrospective | `kill -9` on a staging node |
| 1 -- Repeatable | Scripted experiments in staging with rollback plans | Scheduled pod kill via CronJob |
| 2 -- Automated | Chaos experiments run in CI/CD with automated rollback | LitmusChaos in pipeline |
| 3 -- Continuous | Continuous chaos in production with real-time blast radius control | Gremlin running against canary fleet |

### Tools Overview

| Tool | Target | Injection Types | Platform |
| --- | --- | --- | --- |
| LitmusChaos | Kubernetes | Pod kill, network loss, CPU hog, disk fill | Open-source, CNCF |
| Gremlin | Any (agent-based) | Process, network, state, resource | Commercial SaaS |
| Chaos Monkey | Cloud VMs | Instance termination | Netflix OSS |
| Toxiproxy | Network layer | Latency, bandwidth, timeout, slicer | Open-source (Shopify) |
| AWS FIS | AWS services | EC2 stop, AZ impairment, RDS failover | AWS-native |
| Chaos Mesh | Kubernetes | Pod, network, I/O, time, JVM, kernel | Open-source, CNCF |

---

## Code Examples

### YAML -- LitmusChaos Pod Kill Experiment

```yaml
# litmus-pod-kill.yaml -- Kill a random pod in the target deployment
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: api-pod-kill
  namespace: staging
spec:
  engineState: active
  appinfo:
    appns: staging
    applabel: app=api-server
    appkind: deployment
  chaosServiceAccount: litmus-admin
  experiments:
    - name: pod-delete
      spec:
        components:
          env:
            - name: TOTAL_CHAOS_DURATION
              value: "60"           # seconds of chaos
            - name: CHAOS_INTERVAL
              value: "15"           # kill a pod every 15 seconds
            - name: FORCE
              value: "false"        # graceful termination
            - name: PODS_AFFECTED_PERC
              value: "50"           # affect 50% of matching pods
        probe:
          - name: api-health-probe
            type: httpProbe
            mode: Continuous
            httpProbe/inputs:
              url: "http://api-server.staging.svc:8080/healthz"
              method:
                get:
                  criteria: "=="
                  responseCode: "200"
            runProperties:
              probeTimeout: 5s
              interval: 5s
              retry: 3
---
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosSchedule
metadata:
  name: weekly-pod-kill
  namespace: staging
spec:
  schedule:
    type: repeat
    repeat:
      timeRange:
        startTime: "2026-01-01T09:00:00Z"
      properties:
        minChaosInterval: 168h   # weekly
  engineTemplateSpec:
    engineState: active
    appinfo:
      appns: staging
      applabel: app=api-server
      appkind: deployment
    experiments:
      - name: pod-delete
```

### Go -- Toxiproxy Network Fault Injection in Tests

```go
// chaos_test.go -- Inject network faults into integration tests using Toxiproxy
package chaos_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	toxiproxy "github.com/Shopify/toxiproxy/v2/client"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var (
	toxiClient *toxiproxy.Client
	dbProxy    *toxiproxy.Proxy
)

func setupToxiproxy(t *testing.T) {
	t.Helper()
	toxiClient = toxiproxy.NewClient("localhost:8474")

	var err error
	dbProxy, err = toxiClient.CreateProxy(
		"postgres",
		"localhost:15432",       // listen address (app connects here)
		"postgres-host:5432",    // upstream (real database)
	)
	require.NoError(t, err)
	t.Cleanup(func() { _ = dbProxy.Delete() })
}

func TestAPIReturns503WhenDBLatencyHigh(t *testing.T) {
	setupToxiproxy(t)

	// Inject 3-second latency on database responses
	_, err := dbProxy.AddToxic("db_latency", "latency", "downstream", 1.0, toxiproxy.Attributes{
		"latency": 3000,
		"jitter":  500,
	})
	require.NoError(t, err)
	defer dbProxy.RemoveToxic("db_latency")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "http://localhost:8080/api/products", nil)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	// Application should timeout and return 503, not hang indefinitely
	assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)
}

func TestAPIRecoveryAfterDBPartition(t *testing.T) {
	setupToxiproxy(t)

	// Simulate complete network partition
	_, err := dbProxy.AddToxic("partition", "timeout", "downstream", 1.0, toxiproxy.Attributes{
		"timeout": 1,  // 1 ms timeout = effectively dropped
	})
	require.NoError(t, err)

	// Verify degraded behavior
	resp, err := http.Get("http://localhost:8080/api/products")
	require.NoError(t, err)
	assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)
	resp.Body.Close()

	// Remove partition
	err = dbProxy.RemoveToxic("partition")
	require.NoError(t, err)

	// Verify recovery within 10 seconds
	deadline := time.Now().Add(10 * time.Second)
	recovered := false
	for time.Now().Before(deadline) {
		resp, err = http.Get("http://localhost:8080/api/products")
		if err == nil && resp.StatusCode == http.StatusOK {
			resp.Body.Close()
			recovered = true
			break
		}
		if resp != nil {
			resp.Body.Close()
		}
		time.Sleep(500 * time.Millisecond)
	}
	assert.True(t, recovered, "API did not recover within 10 seconds after partition healed")
}
```

### TypeScript -- Chaos Test Framework with Injectable Failures

```typescript
// chaos-framework.ts -- Injectable failure middleware for chaos testing
import { Request, Response, NextFunction } from 'express';

interface ChaosConfig {
  enabled: boolean;
  failureRate: number;       // 0.0 to 1.0
  latencyMs: number;         // additional latency to inject
  latencyJitterMs: number;   // randomized jitter
  targetPaths: string[];     // paths to affect (empty = all)
  errorCode: number;         // HTTP status to return on failure
}

const defaultConfig: ChaosConfig = {
  enabled: false,
  failureRate: 0,
  latencyMs: 0,
  latencyJitterMs: 0,
  targetPaths: [],
  errorCode: 500,
};

let chaosConfig: ChaosConfig = { ...defaultConfig };

export function setChaosConfig(config: Partial<ChaosConfig>): void {
  chaosConfig = { ...defaultConfig, ...config };
}

export function chaosMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!chaosConfig.enabled) {
    next();
    return;
  }

  // Check if this path is targeted
  if (
    chaosConfig.targetPaths.length > 0 &&
    !chaosConfig.targetPaths.some((p) => req.path.startsWith(p))
  ) {
    next();
    return;
  }

  // Inject failure
  if (Math.random() < chaosConfig.failureRate) {
    res.status(chaosConfig.errorCode).json({
      error: 'Chaos injection: simulated failure',
      chaosExperiment: true,
    });
    return;
  }

  // Inject latency
  if (chaosConfig.latencyMs > 0) {
    const jitter = Math.random() * chaosConfig.latencyJitterMs;
    const delay = chaosConfig.latencyMs + jitter;
    setTimeout(() => next(), delay);
    return;
  }

  next();
}

// ---------- Test usage ----------
// chaos.test.ts
import request from 'supertest';
import { app } from '../src/app';
import { setChaosConfig } from '../src/chaos-framework';

describe('Resilience under chaos', () => {
  afterEach(() => setChaosConfig({ enabled: false }));

  it('returns cached data when upstream injects 50% failures', async () => {
    // Pre-warm cache
    await request(app).get('/api/products').expect(200);

    // Enable chaos on upstream dependency
    setChaosConfig({
      enabled: true,
      failureRate: 0.5,
      targetPaths: ['/upstream'],
      errorCode: 503,
    });

    // Application should serve from cache despite upstream failures
    const results = await Promise.all(
      Array.from({ length: 20 }, () => request(app).get('/api/products'))
    );

    const successCount = results.filter((r) => r.status === 200).length;
    expect(successCount).toBeGreaterThanOrEqual(18); // 90% success minimum
  });
});
```

---

## Game Days

### Planning a Game Day

1. **Select a hypothesis** -- e.g., "If one AZ goes down, latency increases < 20 % and zero requests are dropped."
2. **Define scope and blast radius** -- target environment, affected services, percentage of traffic.
3. **Prepare rollback** -- automated kill switch to disable the experiment within seconds.
4. **Notify stakeholders** -- on-call, SRE, dependent teams, and management.
5. **Execute and observe** -- run the experiment during business hours with full team present.
6. **Document findings** -- record what happened, what surprised the team, and action items.

### Game Day Cadence

- **Monthly** in staging for new experiments.
- **Quarterly** in production for validated experiments.
- **After every major architecture change** regardless of schedule.

---

## Observability Requirements

Chaos engineering without observability is reckless. Verify the following before running any experiment:

- **Distributed tracing** is active and captures cross-service latency.
- **Dashboards** display request rate, error rate, and latency per service.
- **Alerts** fire within 60 seconds of SLO breach.
- **Logs** are aggregated and searchable with < 30-second delay.
- **On-call** is staffed and aware of the experiment window.

---

## 10 Best Practices

1. **Start in staging** -- build confidence and tooling before approaching production.
2. **Automate the kill switch** -- every experiment must have a one-command abort mechanism.
3. **Observe, do not guess** -- if you cannot measure the steady-state metric, the experiment is meaningless.
4. **Run during business hours** -- have the team present to observe and react; do not run chaos at 3 AM.
5. **One variable at a time** -- inject a single fault per experiment to isolate cause and effect.
6. **Increase scope gradually** -- kill one pod before killing an entire node; drop 1 % of traffic before 50 %.
7. **Document every experiment** -- hypothesis, procedure, results, and follow-up actions.
8. **Fix findings before adding new experiments** -- do not accumulate unresolved vulnerabilities.
9. **Include chaos in incident reviews** -- ask "would chaos testing have caught this?" after every post-mortem.
10. **Celebrate findings** -- a failed hypothesis is a success; the team found a weakness before customers did.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
| --- | --- | --- |
| Running chaos without observability | Cannot determine if the system was affected; experiment is worthless | Verify dashboards, alerts, and tracing before any experiment |
| Skipping the hypothesis step | Random destruction with no learning; team loses trust in the practice | Write a formal hypothesis and success criteria before executing |
| Starting in production on day one | Outage risk with immature tooling and no practiced runbooks | Begin in staging; graduate to production after 3+ successful staging runs |
| No kill switch | Experiment runs beyond intended scope; real user impact | Implement automated abort triggered by SLO breach or manual button |
| Testing only infrastructure failures | Misses application-level faults: bad deployments, config drift, data corruption | Include application chaos: bad config, certificate expiry, feature flag failures |
| Running chaos without team awareness | On-call wastes hours investigating a known experiment | Announce experiments in advance; silence expected alerts with annotations |
| Never increasing scope | Staying at one-pod-kill forever; never tests realistic multi-failure scenarios | Progressively expand: pod, node, AZ, region as maturity grows |
| Treating chaos as a one-time event | Resilience degrades as architecture evolves; regressions go undetected | Schedule recurring experiments and integrate into CI/CD |

---

## Enforcement Checklist

- [ ] Steady-state hypothesis is documented for every chaos experiment
- [ ] Kill switch exists and has been tested independently before each experiment
- [ ] Observability (tracing, dashboards, alerts) is verified as operational before experiments
- [ ] Experiments start in staging and graduate to production through a defined maturity process
- [ ] Blast radius is explicitly scoped and limited for each experiment
- [ ] Stakeholders (on-call, SRE, dependent teams) are notified before production experiments
- [ ] Game days are scheduled at least quarterly with documented findings and action items
- [ ] Findings are tracked as tickets with severity, owner, and resolution deadline
- [ ] Chaos experiments are version-controlled and peer-reviewed like application code
- [ ] Post-incident reviews evaluate whether chaos testing would have detected the issue
