# Performance Testing Tools

> **Domain:** Performance > Benchmarking > Tools
> **Importance:** Critical
> **Last Updated:** 2026-03-10

## Why It Matters

Choosing the wrong performance testing tool wastes weeks. Each tool has distinct strengths: k6 for developer-friendly scripting with low overhead, JMeter for protocol breadth, Gatling for high-concurrency Scala-based testing, Artillery for serverless and WebSocket workloads, Locust for Python-native distributed testing. Matching tool to workload, team skills, and infrastructure determines whether load testing is adopted or abandoned.

---

## Comparison Matrix

| Feature | k6 | JMeter | Gatling | Artillery | Locust |
|---------|-----|--------|---------|-----------|--------|
| Language | JavaScript/TS | Java (GUI/XML) | Scala/Java | YAML + JS | Python |
| Runtime | Go binary | JVM | JVM (Akka) | Node.js | Python |
| Memory per 1K VUs | ~256MB | ~1-4GB | ~500MB | ~300MB | ~200MB |
| Protocol | HTTP/1.1, HTTP/2, WS, gRPC | HTTP, JDBC, LDAP, FTP, SOAP, JMS | HTTP, WS, JMS, MQTT | HTTP, WS, Socket.io, Kinesis | HTTP, custom |
| Scripting | JS modules, ES6 | GUI drag-drop or XML | Scala DSL | YAML + JS hooks | Python classes |
| CI/CD Integration | Native CLI | CLI via JMX | CLI + Maven/Gradle | CLI + npm | CLI |
| Cloud/Distributed | k6 Cloud, xk6-distributed | Remote JMeter agents | Gatling Enterprise | Artillery Pro | Built-in distributed |
| Best For | API testing, DevOps teams | Enterprise, multi-protocol | High-concurrency HTTP | Serverless, WebSocket | Python teams, custom protocols |

## Lightweight CLI Tools

| Tool | Language | Use Case | Command |
|------|----------|----------|---------|
| wrk | C | HTTP throughput measurement | `wrk -t12 -c400 -d30s URL` |
| wrk2 | C | Constant-rate load with HDR histograms | `wrk2 -t4 -c100 -R2000 -d60s URL` |
| hey | Go | Quick HTTP load test | `hey -n 10000 -c 100 URL` |
| vegeta | Go | Constant-rate HTTP attack | `echo "GET URL" \| vegeta attack -rate=500 -duration=30s \| vegeta report` |
| autocannon | Node.js | HTTP/1.1 benchmarking | `autocannon -c 100 -d 30 URL` |

---

## k6

Go-based runtime executing JavaScript test scripts. Low memory footprint (~256MB for 1000 VUs). No browser, no Node.js -- a custom JS runtime purpose-built for load testing.

```javascript
// k6: Complete load test with checks, thresholds, and custom metrics
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const loginDuration = new Trend('login_duration', true);
const loginFailRate = new Rate('login_failures');

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 0 },
      ],
      exec: 'browseProducts',
    },
    purchase: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '9m',
      preAllocatedVUs: 20,
      maxVUs: 50,
      exec: 'purchaseFlow',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.01'],
    login_duration: ['p(95)<1000'],
    login_failures: ['rate<0.05'],
  },
};

export function browseProducts() {
  const res = http.get('https://api.example.com/products', {
    tags: { type: 'browse' },
  });
  check(res, { 'products 200': (r) => r.status === 200 });
  sleep(Math.random() * 3 + 1);
}

export function purchaseFlow() {
  const start = Date.now();
  const res = http.post('https://api.example.com/login',
    JSON.stringify({ email: 'test@example.com', password: 'test123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  loginDuration.add(Date.now() - start);
  loginFailRate.add(res.status !== 200);
  if (res.status !== 200) return;
  const token = res.json('token');

  const cartRes = http.post('https://api.example.com/cart',
    JSON.stringify({ productId: 42, qty: 1 }),
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  check(cartRes, { 'cart 200': (r) => r.status === 200 });
  sleep(2);

  const orderRes = http.post('https://api.example.com/checkout',
    JSON.stringify({ cartId: cartRes.json('id') }),
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  check(orderRes, { 'order 200': (r) => r.status === 200 });
}
```

```bash
# k6: Run with JSON output for CI analysis
k6 run --out json=results.json load-test.js

# k6: Run with Prometheus remote-write for Grafana dashboards
k6 run --out experimental-prometheus-rw load-test.js

# k6: Run distributed via k6-operator on Kubernetes
kubectl apply -f k6-test-resource.yaml
```

## JMeter

Java-based, broadest protocol support. GUI for test design, CLI for execution. Memory-heavy (~1-4GB per 1K VUs). Only tool supporting JDBC, LDAP, FTP, JMS, SOAP natively.

```xml
<!-- JMeter: Minimal test plan (JMX) -- design in GUI, run in CLI -->
<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testname="API Load Test"/>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testname="Users">
        <intProp name="ThreadGroup.num_threads">100</intProp>
        <intProp name="ThreadGroup.ramp_time">60</intProp>
        <boolProp name="ThreadGroup.scheduler">true</boolProp>
        <stringProp name="ThreadGroup.duration">600</stringProp>
      </ThreadGroup>
      <hashTree>
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testname="Get Products">
          <stringProp name="HTTPSampler.domain">api.example.com</stringProp>
          <stringProp name="HTTPSampler.protocol">https</stringProp>
          <stringProp name="HTTPSampler.path">/products</stringProp>
          <stringProp name="HTTPSampler.method">GET</stringProp>
        </HTTPSamplerProxy>
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>
```

```bash
# CLI execution (NEVER use GUI for tests -- it skews results)
jmeter -n -t test-plan.jmx -l results.jtl -Jthreads=200 -Jrampup=120 -Jduration=600 -e -o report/
# Distributed mode
jmeter -n -t test-plan.jmx -R agent1:1099,agent2:1099 -l results.jtl
```

## Gatling

Scala-based, Akka actor model. Excellent HTML reports. Lower memory than JMeter.

```scala
// Gatling: Simulation in Scala DSL
import io.gatling.core.Predef._; import io.gatling.http.Predef._
import scala.concurrent.duration._

class ApiSimulation extends Simulation {
  val httpConf = http.baseUrl("https://api.example.com").acceptHeader("application/json")
  val feeder = csv("users.csv").random

  val browse = scenario("Browse")
    .exec(http("List").get("/products").check(status.is(200), jsonPath("$[0].id").saveAs("pid")))
    .pause(2, 5)
    .exec(http("Detail").get("/products/${pid}").check(status.is(200)))

  val purchase = scenario("Purchase").feed(feeder)
    .exec(http("Login").post("/login")
      .body(StringBody("""{"email":"${email}","password":"${password}"}"""))
      .check(status.is(200), jsonPath("$.token").saveAs("token")))
    .exec(http("Cart").post("/cart").header("Authorization", "Bearer ${token}")
      .body(StringBody("""{"productId":42,"qty":1}""")).check(status.is(200)))

  setUp(browse.inject(rampUsers(200).during(2.minutes)),
    purchase.inject(constantUsersPerSec(5).during(10.minutes))
  ).protocols(httpConf).assertions(global.responseTime.percentile3.lt(1000))
}
```

## Artillery

Node.js-based. YAML config with JS hooks. Strong WebSocket/Socket.io support. Artillery Pro runs distributed on AWS Lambda.

```yaml
# Artillery: HTTP load test with validation and thresholds
config:
  target: "https://api.example.com"
  phases:
    - { duration: 120, arrivalRate: 5, rampTo: 30, name: "Ramp up" }
    - { duration: 600, arrivalRate: 30, name: "Sustained load" }
  payload: { path: "users.csv", fields: ["email", "password"] }
  plugins: { expect: {} }
  ensure:
    thresholds: [{ "http.response_time.p95": 500 }, { "http.response_time.p99": 1500 }]

scenarios:
  - name: "Browse and buy"
    flow:
      - post:
          url: "/login"
          json: { email: "{{ email }}", password: "{{ password }}" }
          capture: [{ json: "$.token", as: "token" }]
          expect: [{ statusCode: 200 }]
      - think: 2
      - get: { url: "/products", headers: { Authorization: "Bearer {{ token }}" } }
      - think: 3
      - post: { url: "/cart", headers: { Authorization: "Bearer {{ token }}" }, json: { productId: 42 } }
```

```yaml
# Artillery: WebSocket load test
config:
  target: "wss://ws.example.com"
  phases: [{ duration: 300, arrivalRate: 50 }]
  engines: { ws: {} }
scenarios:
  - engine: ws
    flow:
      - send: '{"type":"subscribe","channel":"prices"}'
      - think: 5
      - send: '{"type":"unsubscribe","channel":"prices"}'
```

```bash
artillery run load-test.yaml --output results.json  # Run and capture results
artillery report results.json --output report.html   # Generate HTML report
artillery run-lambda --region us-east-1 --count 50 load-test.yaml  # Artillery Pro: Lambda
```

## Locust

Python-based. Write test scenarios as Python classes. Built-in distributed mode.

```python
# Locust: Load test with weighted user types
from locust import HttpUser, task, between, tag
import random

class BrowseUser(HttpUser):
    wait_time = between(2, 5)
    weight = 7  # 70% of traffic

    def on_start(self):
        res = self.client.post("/login", json={
            "email": f"user{random.randint(1, 10000)}@test.com", "password": "test123"})
        self.token = res.json().get("token", "")

    @task(5)
    def list_products(self):
        self.client.get("/products",
            headers={"Authorization": f"Bearer {self.token}"}, name="/products")

    @task(2)
    def product_detail(self):
        self.client.get(f"/products/{random.randint(1, 1000)}",
            headers={"Authorization": f"Bearer {self.token}"}, name="/products/[id]")

    @task(1)
    def add_to_cart(self):
        self.client.post("/cart", json={"productId": random.randint(1, 1000), "qty": 1},
            headers={"Authorization": f"Bearer {self.token}"})
```

```bash
# Locust: CLI execution (headless mode for CI)
locust -f locustfile.py --headless -u 500 -r 50 -t 10m \
  --host https://api.example.com --csv=results

# Locust: Distributed mode
locust -f locustfile.py --master --expect-workers=4
locust -f locustfile.py --worker --master-host=master-ip
```

## wrk2 and vegeta

Quick HTTP-only measurements. wrk2 maintains constant request rate; vegeta produces detailed latency reports.

```bash
# wrk2: Constant-rate load with accurate latency histogram
wrk2 -t4 -c100 -R2000 -d60s --latency https://api.example.com/products

# vegeta: Constant-rate attack with text report
echo "GET https://api.example.com/products" | \
  vegeta attack -rate=500/s -duration=60s | vegeta report -type=text

# vegeta: Generate latency plot
echo "GET https://api.example.com/products" | \
  vegeta attack -rate=500/s -duration=60s | vegeta plot > latency.html

# hey: Quick 10K request test with 100 concurrency
hey -n 10000 -c 100 -m GET https://api.example.com/products
```

## Playwright for Browser Performance

HTTP load tools cannot measure Core Web Vitals. Use Playwright for real browser rendering.

```typescript
// Playwright: Measure LCP, CLS, TTFB
import { test, expect } from '@playwright/test';

test('page load performance', async ({ page }) => {
  await page.goto('https://www.example.com/products');
  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      const r: Record<string, number> = {};
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.entryType === 'largest-contentful-paint') r.lcp = e.startTime;
          if (e.entryType === 'layout-shift' && !(e as any).hadRecentInput)
            r.cls = (r.cls || 0) + (e as any).value;
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      r.ttfb = nav.responseStart - nav.requestStart;
      setTimeout(() => resolve(r), 3000);
    });
  });
  expect(metrics.lcp).toBeLessThan(2500);
  expect(metrics.cls).toBeLessThan(0.1);
  expect(metrics.ttfb).toBeLessThan(800);
});
```

## Tool Selection Decision Tree

```
Is it HTTP/HTTPS only?
  Yes -> Need full scripting or quick measurement?
    Quick: wrk2, hey, vegeta
    Full:  JS/TS team -> k6 | Python team -> Locust
           Scala/Java -> Gatling | YAML-first -> Artillery
  No -> What protocols?
    WebSocket/Socket.io: Artillery or k6 (xk6-websockets)
    gRPC: k6 (xk6-grpc) or ghz
    JDBC/LDAP/JMS/FTP: JMeter (only multi-protocol option)
    Browser rendering: Playwright or Lighthouse CI

Enterprise features needed?
  Yes: JMeter (free) or Gatling Enterprise / k6 Cloud (paid)
  No:  k6 or Artillery (open source)
```

---

## Best Practices

1. **Use k6 as the default for HTTP/gRPC API testing.** Lowest memory overhead, best developer experience, native CI/CD integration, Go-based binary with no runtime dependencies.
2. **Use JMeter only when you need protocols beyond HTTP.** JDBC, LDAP, FTP, JMS, SOAP -- JMeter is the only tool covering all of these. For HTTP-only tests, its JVM overhead is wasteful.
3. **Never use JMeter GUI for executing tests.** GUI mode adds rendering overhead and skews results. Design in GUI, execute with `jmeter -n -t plan.jmx`.
4. **Run load generators on separate machines from the system under test.** Load generator CPU and network contention pollute measurements.
5. **Use constant-arrival-rate (open model) for API tests.** k6 `constant-arrival-rate`, wrk2 `-R`, vegeta `-rate` maintain consistent RPS regardless of response time.
6. **Store test scripts in version control next to application code.** Load tests are code -- they need reviews, CI integration, and maintenance.
7. **Use wrk2 or vegeta for quick sanity checks.** Before scripting a full k6 test, verify basic throughput with a 30-second wrk2 run.
8. **Use Playwright/Lighthouse for frontend performance.** HTTP load tools cannot measure LCP, CLS, or FID. Browser-based tools capture what users experience.
9. **Configure output to Prometheus/Grafana for real-time dashboards.** k6 supports `--out experimental-prometheus-rw`. JMeter has the Backend Listener.
10. **Match the tool to team expertise.** Python teams adopt Locust faster. JS/TS teams adopt k6 faster. Forcing a mismatched tool ensures abandonment.

---

## Anti-Patterns

1. **Using JMeter GUI for 1000+ VU tests.** GUI rendering consumes 30-50% of CPU, corrupting results and limiting max VU count. Always use CLI mode.
2. **Running k6 with `--vus 10000` on a single machine.** Each VU maintains connection state. Beyond ~5000 VUs, use distributed mode or k6 Cloud. Check `ulimit -n` for file descriptor limits.
3. **Ignoring load generator resource saturation.** If the load generator hits 90% CPU, it cannot send requests at the target rate. Monitor load generator resources, not just the target.
4. **Writing load tests without assertions/checks.** A test without response validation measures throughput of error responses. Always check status codes and response bodies.
5. **Hardcoding test data in scripts.** Single user, single product -- this tests the cache, not the system. Use external data files with realistic distributions.
6. **Comparing results from different tools.** k6 and wrk2 measure latency differently (k6 includes connection setup, wrk2 does not). Compare within the same tool only.
7. **Using Artillery for 10,000+ VU tests on a single machine.** Node.js single-threaded event loop saturates. Use Artillery Pro (Lambda) or switch to k6.
8. **Skipping tool evaluation and defaulting to JMeter.** JMeter's XML config, JVM overhead, and GUI-centric design slow modern DevOps workflows. Evaluate k6, Gatling, or Artillery first.

---

## Enforcement Checklist

- [ ] Tool selected based on protocol requirements, team skills, and scale needs
- [ ] Load generator runs on dedicated infrastructure, not the system under test
- [ ] Scripts stored in version control with CI/CD integration
- [ ] All tests include response validation (status codes, body checks)
- [ ] Test data externalized in CSV/JSON files, not hardcoded
- [ ] Results exported to monitoring system (Prometheus, Grafana, InfluxDB)
- [ ] CLI mode used for execution (never GUI for actual measurements)
- [ ] Load generator resource usage monitored during tests
- [ ] Results include tool version, configuration, and environment metadata
- [ ] Team trained on selected tool with documented runbooks
