# Stress and Soak Testing

| Attribute      | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| Domain         | Testing > Performance Testing                                      |
| Importance     | High                                                               |
| Last Updated   | 2026-03-10                                                         |
| Cross-ref      | `09-performance/benchmarking/stress-testing.md`                    |

---

## Core Concepts

### Stress Testing

Stress testing pushes a system **beyond its designed capacity** to identify the breaking point and understand failure behavior. The goal is not to prove the system works under normal load (that is load testing) but to answer:

- At what concurrency or throughput does the system degrade unacceptably?
- Does it fail gracefully (shed load, return 503) or catastrophically (OOM kill, data corruption)?
- Which component fails first -- application, database, network, or external dependency?

### Spike Testing

Spike testing is a specialized form of stress testing that applies **sudden, extreme traffic surges** followed by rapid drop-off. It validates:

- Auto-scaling reaction time
- Connection pool behavior under burst allocation
- Queue backpressure and circuit breaker activation
- CDN and cache warm-up under cold-start conditions

### Soak (Endurance) Testing

Soak testing sustains a **moderate-to-high load over an extended period** (hours to days) to expose:

- Memory leaks in application processes
- Connection leaks (DB, HTTP, gRPC)
- File descriptor exhaustion
- Storage growth (logs, temp files, DB bloat)
- Garbage collection pauses that worsen over time
- Certificate or token expiration during long runs

### Recovery Testing

After a system is stressed to failure, recovery testing verifies:

- Does the system return to healthy state without manual intervention?
- How long does recovery take?
- Is data consistent after recovery?
- Do auto-scaling policies scale back down appropriately?

---

## Degradation Curves

A properly instrumented stress test produces a degradation curve:

```
Latency (ms)
  |
  |                                    *** (failure zone)
  |                              ****
  |                         ****
  |                     ***
  |              ******
  | ************                        <-- linear phase
  +-----------------------------------------> Load (RPS)
       100   200   300   400   500   600
                          ^
                    saturation point
```

Identify three zones:
1. **Linear zone** -- latency is stable; throughput scales with load.
2. **Saturation zone** -- latency increases non-linearly; throughput plateaus.
3. **Failure zone** -- errors spike; latency is unbounded or requests timeout.

Record the RPS and VU count at each transition point.

---

## Code Examples

### TypeScript/JavaScript -- k6 Stress Test

```js
// stress-test.js -- k6 stress test ramping to breaking point
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const failRate = new Rate('failed_requests');

export const options = {
  stages: [
    // Ramp through increasing load levels
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },   // baseline
    { duration: '2m', target: 300 },
    { duration: '5m', target: 300 },   // moderate stress
    { duration: '2m', target: 600 },
    { duration: '5m', target: 600 },   // heavy stress
    { duration: '2m', target: 1000 },
    { duration: '5m', target: 1000 },  // extreme stress
    { duration: '5m', target: 0 },     // recovery
  ],
  thresholds: {
    // Stress tests use relaxed thresholds -- goal is to find limits, not pass
    http_req_duration: ['p(95)<5000'],  // fail only on total breakdown
    failed_requests: ['rate<0.5'],       // accept up to 50 % errors at peak
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://api.staging.example.com';

export default function () {
  const res = http.get(`${BASE_URL}/api/products?page=1`);

  const passed = check(res, {
    'status is 200 or 503': (r) => r.status === 200 || r.status === 503,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  if (!passed) {
    failRate.add(1);
  }

  sleep(0.5); // minimal think time for stress
}

// Spike test variant -- use as separate script or toggle via env
export const spikeOptions = {
  stages: [
    { duration: '30s', target: 10 },    // warm up
    { duration: '10s', target: 1500 },   // sudden spike
    { duration: '3m', target: 1500 },    // hold spike
    { duration: '10s', target: 10 },     // sudden drop
    { duration: '3m', target: 10 },      // recovery observation
  ],
};
```

### TypeScript/JavaScript -- k6 Soak Test

```js
// soak-test.js -- sustained load over 2 hours
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const memoryTrend = new Trend('app_memory_mb');

export const options = {
  stages: [
    { duration: '5m', target: 100 },    // ramp up
    { duration: '110m', target: 100 },   // sustain for ~2 hours
    { duration: '5m', target: 0 },       // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://api.staging.example.com';

export default function () {
  const res = http.get(`${BASE_URL}/api/products?page=1`);
  check(res, { 'status 200': (r) => r.status === 200 });

  // Poll application health endpoint for memory usage
  if (__ITER % 100 === 0) {
    const health = http.get(`${BASE_URL}/healthz`);
    if (health.status === 200) {
      const mem = health.json('memory_mb');
      if (mem) memoryTrend.add(mem);
    }
  }

  sleep(Math.random() * 2 + 1);
}
```

### Python -- Locust Soak Test with Resource Monitoring

```python
# soak_test.py -- Locust soak test with long duration and resource monitoring
import time
import logging
import psutil
from locust import HttpUser, task, between, events
from locust.runners import MasterRunner

logger = logging.getLogger(__name__)

class SoakUser(HttpUser):
    """Virtual user for soak testing over extended periods."""
    wait_time = between(1, 3)
    host = "https://api.staging.example.com"

    @task(3)
    def browse_catalog(self):
        self.client.get("/api/products?page=1", name="/api/products")

    @task(1)
    def create_order(self):
        self.client.post("/api/orders", json={
            "product_id": 42,
            "quantity": 1,
        }, name="/api/orders")

    @task(1)
    def health_check(self):
        """Periodically check server health metrics."""
        with self.client.get("/healthz", catch_response=True) as resp:
            if resp.status_code == 200:
                data = resp.json()
                mem_mb = data.get("memory_mb", 0)
                open_conns = data.get("open_connections", 0)
                if mem_mb > 2048:
                    logger.warning("Memory exceeds 2 GB: %d MB", mem_mb)
                if open_conns > 500:
                    logger.warning("Open connections: %d", open_conns)


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Log system baseline at test start."""
    logger.info("Soak test started -- recording baseline")
    logger.info("System memory: %.1f%%", psutil.virtual_memory().percent)


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """Flag slow responses during soak testing."""
    if response_time and response_time > 2000:
        logger.warning("Slow response: %s %s -- %d ms", request_type, name, response_time)


# Run: locust -f soak_test.py --users 100 --spawn-rate 10 --run-time 4h --headless
```

---

## Analyzing Results

### Identifying Degradation Patterns

| Pattern | Symptom | Root Cause |
| --- | --- | --- |
| Linear latency increase | P95 rises steadily with time, not load | Memory leak or GC pressure |
| Sudden latency spike | Flat line then vertical jump | Resource exhaustion (connections, file descriptors) |
| Sawtooth pattern | Periodic spikes and recoveries | GC cycles, cron jobs, or log rotation |
| Error rate plateau | Errors stabilize at a fixed percentage | Load balancer or rate limiter shedding excess traffic |
| Cascading failure | One service fails, then others follow | Missing circuit breakers or timeout propagation |

### Recovery Metrics

Track these after removing stress:

- **Time to recovery (TTR):** seconds until P95 returns to baseline.
- **Error tail:** how long errors continue after load drops.
- **Resource release:** time for connections, memory, and threads to return to baseline.
- **Data consistency:** verify no corrupt or orphaned records.

---

## 10 Best Practices

1. **Start with load testing** -- establish a healthy baseline before introducing stress.
2. **Increment load in steps** -- use 2-5 minute plateaus at each level to distinguish saturation from transient startup effects.
3. **Monitor the entire stack** -- instrument application, database, message queue, cache, and network during stress runs.
4. **Automate soak tests on a schedule** -- run nightly or weekly; memory leaks only appear over hours.
5. **Use separate thresholds for stress vs load tests** -- stress tests are expected to produce errors; do not apply production SLOs.
6. **Record the breaking point** -- document the exact RPS/VU where degradation begins for capacity planning.
7. **Include a recovery phase** -- always observe the system for several minutes after removing load.
8. **Test auto-scaling policies** -- verify that scaling triggers fire at the correct thresholds and that scale-down does not cause disruption.
9. **Inject realistic failure modes** -- combine stress testing with dependency failures (slow DB, timeout upstream) for compound scenarios.
10. **Review results with the team** -- stress test findings inform architecture decisions; share degradation curves in design reviews.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
| --- | --- | --- |
| Ramping to maximum instantly | Causes connection storms that mask real bottlenecks | Use graduated ramp-up stages with hold periods |
| Running soak tests for only 30 minutes | Misses slow memory leaks and GC degradation | Run soak tests for a minimum of 2 hours; prefer 4-8 hours |
| Ignoring the recovery phase | Unknown whether the system self-heals or requires restart | Always include a ramp-down phase and monitor for 5-10 minutes after |
| Using production SLO thresholds for stress tests | Every stress test "fails" -- results are ignored | Define stress-specific thresholds that identify the breaking point |
| Stress testing in shared environments without notice | Degrades other teams' testing; creates false alerts | Coordinate via calendar and alerting silences; prefer isolated environments |
| Testing only the web tier | Database or message queue is the real bottleneck but goes unobserved | Instrument and monitor every component in the request path |
| Running soak tests without resource monitoring | Detects that "something is slow" but cannot pinpoint the cause | Export memory, CPU, connection pool, and GC metrics alongside load test data |
| Never acting on results | Stress test reports pile up but no fixes are prioritized | Create tickets for each finding; track resolution before the next test cycle |

---

## Enforcement Checklist

- [ ] Stress test exists for every critical user journey and is version-controlled
- [ ] Stress test stages include incremental ramp-up with hold periods at each level
- [ ] Spike test covers sudden 10x traffic surge and immediate drop-off
- [ ] Soak test runs for a minimum of 2 hours under sustained moderate load
- [ ] Resource monitoring (memory, CPU, connections, file descriptors) is active during all soak tests
- [ ] Recovery phase is included in every stress test with post-load observation
- [ ] Breaking point (RPS and VU count at saturation) is documented per release
- [ ] Auto-scaling behavior is validated: scale-up triggers, scale-down stability
- [ ] Results are compared across releases to detect degradation trends
- [ ] Findings are triaged into tickets with severity and assigned owners
