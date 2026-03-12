# Load Testing

| Attribute      | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| Domain         | Testing > Performance Testing                                      |
| Importance     | Critical                                                           |
| Last Updated   | 2026-03-10                                                         |
| Cross-ref      | `09-performance/benchmarking/load-testing.md` (performance engineering perspective) |

---

## Core Concepts

### What Load Testing Is

Load testing validates that a system meets its performance requirements under **expected and peak production traffic**. It differs from functional testing by measuring *how fast* and *how reliably* the system responds, not merely whether it produces correct results.

### The Load Testing Lifecycle

1. **Define Scenarios** -- Model real user journeys (login, browse, checkout) with realistic think times and data variation.
2. **Set Thresholds** -- Establish pass/fail criteria before execution: P95 latency < 300 ms, error rate < 0.1 %, throughput >= 500 RPS.
3. **Execute** -- Run tests from infrastructure that mirrors production network topology.
4. **Analyze** -- Correlate metrics with system telemetry (CPU, memory, DB connections, queue depth).
5. **Report & Regress** -- Store results as baselines; flag regressions in CI.

### Key Metrics

| Metric              | Description                                       | Healthy Target (example)  |
| ------------------- | ------------------------------------------------- | ------------------------- |
| Requests Per Second | Sustained throughput the system can handle         | >= design capacity        |
| P50 Latency         | Median response time                               | < 100 ms                  |
| P95 Latency         | 95th percentile -- experienced by 1 in 20 users   | < 300 ms                  |
| P99 Latency         | 99th percentile -- tail latency                    | < 1 000 ms                |
| Error Rate          | Percentage of non-2xx responses                    | < 0.1 %                   |
| Throughput (bytes)  | Network bandwidth consumed                         | Within NIC/LB limits      |

### Tools Comparison

| Tool      | Language   | Protocol Support           | Scripting        | Distributed | Cloud SaaS |
| --------- | ---------- | -------------------------- | ---------------- | ----------- | ---------- |
| k6        | Go (JS API)| HTTP, gRPC, WebSocket      | JavaScript/TS    | Yes (k6-operator) | Grafana Cloud k6 |
| Artillery | Node.js    | HTTP, WebSocket, Socket.io | YAML + JS hooks  | Yes         | Artillery Cloud |
| Gatling   | Scala/Java | HTTP, JMS, MQTT            | Scala DSL        | Yes         | Gatling Enterprise |
| JMeter    | Java       | HTTP, JDBC, LDAP, FTP      | XML + BeanShell  | Yes         | BlazeMeter |
| Locust    | Python     | HTTP (extensible)          | Python           | Yes         | No (self-host) |

**Recommendation:** Use **k6** for API-level load tests in CI pipelines. Use **Locust** when teams prefer Python and need rapid prototyping. Reserve **Gatling** or **JMeter** for protocol-diverse enterprise environments.

---

## Code Examples

### TypeScript/JavaScript -- k6 Load Test

```js
// load-test.js -- k6 script with stages, thresholds, and checks
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('custom_latency');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // ramp up to 50 VUs
    { duration: '5m', target: 50 },   // hold at 50 VUs
    { duration: '2m', target: 200 },  // ramp up to 200 VUs (peak)
    { duration: '5m', target: 200 },  // hold at peak
    { duration: '2m', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<1000'],
    errors: ['rate<0.01'],            // < 1 % error rate
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://api.staging.example.com';

export default function () {
  // Scenario: browse products then view detail
  const listRes = http.get(`${BASE_URL}/api/products?page=1`);
  check(listRes, {
    'list status 200': (r) => r.status === 200,
    'list latency < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  latency.add(listRes.timings.duration);

  const products = listRes.json('data');
  if (products && products.length > 0) {
    const id = products[Math.floor(Math.random() * products.length)].id;
    const detailRes = http.get(`${BASE_URL}/api/products/${id}`);
    check(detailRes, {
      'detail status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
    latency.add(detailRes.timings.duration);
  }

  sleep(Math.random() * 3 + 1); // think time 1-4 seconds
}
```

### Python -- Locust Load Test

```python
# locustfile.py -- Locust load test with custom user behavior
from locust import HttpUser, task, between, events
import logging
import random

class ProductUser(HttpUser):
    """Simulates a user browsing the product catalog."""
    wait_time = between(1, 4)  # realistic think time
    host = "https://api.staging.example.com"

    def on_start(self):
        """Authenticate once per virtual user."""
        resp = self.client.post("/auth/login", json={
            "email": "loadtest@example.com",
            "password": "test-password",
        })
        if resp.status_code == 200:
            self.token = resp.json()["token"]
            self.client.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            logging.error("Authentication failed: %s", resp.status_code)

    @task(5)
    def browse_products(self):
        page = random.randint(1, 10)
        with self.client.get(
            f"/api/products?page={page}",
            name="/api/products?page=[n]",  # group in stats
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Got status {resp.status_code}")
            elif resp.elapsed.total_seconds() > 0.5:
                resp.failure("Latency exceeded 500 ms")

    @task(2)
    def view_product_detail(self):
        product_id = random.randint(1, 1000)
        self.client.get(
            f"/api/products/{product_id}",
            name="/api/products/[id]",
        )

    @task(1)
    def search_products(self):
        queries = ["laptop", "keyboard", "monitor", "headset"]
        self.client.get(
            f"/api/products/search?q={random.choice(queries)}",
            name="/api/products/search",
        )
```

### YAML -- Artillery Scenario

```yaml
# artillery-config.yaml -- Artillery load test with phases and custom metrics
config:
  target: "https://api.staging.example.com"
  phases:
    - name: "Warm up"
      duration: 60
      arrivalRate: 5
    - name: "Sustained load"
      duration: 300
      arrivalRate: 50
    - name: "Peak load"
      duration: 300
      arrivalRate: 200
  defaults:
    headers:
      Content-Type: "application/json"
  ensure:
    thresholds:
      - http.response_time.p95: 300
      - http.response_time.p99: 1000
      - http.codes.500: 0
  plugins:
    metrics-by-endpoint:
      useOnlyRequestNames: true

scenarios:
  - name: "Browse and purchase"
    flow:
      - get:
          url: "/api/products?page=1"
          capture:
            - json: "$.data[0].id"
              as: "productId"
      - think: 2
      - get:
          url: "/api/products/{{ productId }}"
          expect:
            - statusCode: 200
      - think: 1
      - post:
          url: "/api/cart"
          json:
            productId: "{{ productId }}"
            quantity: 1
          expect:
            - statusCode: 201
```

---

## Baseline Testing and Regression Detection

1. **Establish baselines** on a known-good release by running the same load test 3-5 times and averaging.
2. **Store baselines** as JSON artifacts in the repository or a metrics store (InfluxDB, Prometheus).
3. **Compare** each CI run against the baseline with tolerance bands (e.g., P95 must not regress more than 10 %).
4. **Alert** on statistically significant regressions using Mann-Whitney U or Kolmogorov-Smirnov tests rather than simple threshold comparisons.

---

## CI Integration

```yaml
# .github/workflows/load-test.yaml
name: Load Test
on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * 1-5'  # nightly on weekdays

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
            --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
            | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update && sudo apt-get install -y k6
      - name: Run load test
        run: k6 run --out json=results.json tests/load/load-test.js
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: results.json
```

---

## 10 Best Practices

1. **Test in production-like environments** -- use the same instance types, network topology, and data volumes as production.
2. **Parameterize test data** -- avoid caching effects by using realistic, varied inputs from a CSV or data generator.
3. **Include think times** -- simulate realistic user pauses; omitting them produces unrealistic throughput numbers.
4. **Set explicit pass/fail thresholds** -- never run a load test without predefined SLO-based criteria.
5. **Run from distributed load generators** -- a single machine saturates its own CPU and network before stressing the target.
6. **Monitor the system under test** -- correlate application metrics, infrastructure metrics, and load test results in a single dashboard.
7. **Version control test scripts** -- treat load tests as production code with reviews, linting, and CI.
8. **Isolate test environments** -- do not run load tests against shared staging without coordination.
9. **Warm up the system** -- include a ramp-up phase so JIT compilers, connection pools, and caches reach steady state.
10. **Automate regression detection** -- compare every run against stored baselines and fail the build on significant regressions.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
| --- | --- | --- |
| Testing only happy paths | Misses error-handling performance; 4xx/5xx paths may be slower | Include error scenarios (bad auth, missing resources, validation failures) |
| Running from a single region | Masks network latency and CDN behavior | Use distributed load generators across regions matching user distribution |
| Hardcoded test data | Cache hit rates are unrealistically high; database hotspots hidden | Generate or shuffle unique data per virtual user iteration |
| No ramp-up phase | Connection storms cause false failures unrelated to application code | Always include a gradual ramp-up stage before sustained load |
| Ignoring client-side bottlenecks | Load generator CPU/memory saturation produces invalid metrics | Monitor load generator resources; scale out when utilization exceeds 70 % |
| Testing only throughput, ignoring latency distribution | P99 problems go undetected while averages look fine | Always measure and threshold P50, P95, and P99 latencies |
| Running load tests post-release only | Performance bugs reach production; expensive rollbacks | Integrate load tests into CI for every significant change |
| No baseline comparisons | Cannot detect gradual degradation across releases | Store baselines and automate statistical regression detection |

---

## Enforcement Checklist

- [ ] Load test scripts are version-controlled alongside application code
- [ ] Pass/fail thresholds are defined for P95 latency, P99 latency, error rate, and throughput
- [ ] Tests use realistic, parameterized data -- not a single hardcoded payload
- [ ] Think times are included between requests to simulate real user behavior
- [ ] Load generators are monitored to ensure they are not the bottleneck
- [ ] CI pipeline runs load tests on every PR or nightly at minimum
- [ ] Results are stored as artifacts and compared against baselines
- [ ] Dashboards correlate load test metrics with APM and infrastructure telemetry
- [ ] Test environments match production configuration (instance types, DB size, connection limits)
- [ ] Runbook exists for investigating load test failures and escalating regressions
