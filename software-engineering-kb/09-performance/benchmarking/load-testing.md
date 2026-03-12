# Load Testing

> **Domain:** Performance > Benchmarking > Load Testing
> **Importance:** Critical
> **Last Updated:** 2026-03-10

## Why It Matters

Load testing validates that a system handles expected traffic volumes while meeting latency and error rate SLOs. Without load testing, capacity limits are discovered in production during traffic spikes -- causing outages, revenue loss, and SLA violations. Load testing answers: "Can our system serve N users at acceptable performance?" It is distinct from stress testing (which finds breaking points) and focuses on confirming behavior under normal-to-peak expected load.

---

## Core Concepts

### Virtual Users vs Requests Per Second

**Virtual Users (VUs):** Simulate concurrent users, each executing a scripted journey with think time between actions. Models real user behavior. Use for session-based applications.

**Requests Per Second (RPS):** Constant request rate regardless of response time. Models API traffic, microservice-to-microservice calls. Use for stateless APIs.

```
Relationship (Little's Law):
  RPS = VUs / (avg_response_time + think_time)

  100 VUs, 200ms response, 2s think time:
  RPS = 100 / (0.2 + 2.0) = 45.5 req/s

  To hit 500 RPS at 200ms response + 2s think:
  VUs = 500 * 2.2 = 1100 virtual users needed
```

### Think Time

Think time simulates the pause between user actions (reading a page, filling a form). Without think time, each VU hammers the server in a tight loop -- unrealistic and overstates load.

```javascript
// k6: Realistic think time with randomization
import { sleep } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export default function () {
  // Browse product page
  http.get('https://api.example.com/products/42');
  sleep(randomIntBetween(2, 5));  // 2-5s reading

  // Add to cart
  http.post('https://api.example.com/cart', JSON.stringify({ productId: 42 }));
  sleep(randomIntBetween(1, 3));  // 1-3s deciding

  // Checkout
  http.post('https://api.example.com/checkout', JSON.stringify({ cartId: 'abc' }));
  sleep(randomIntBetween(3, 8));  // 3-8s entering payment info
}
```

## Load Test Scenarios

### Ramp-Up, Steady State, Ramp-Down

```javascript
// k6: Standard load test profile
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 VUs over 2 min
    { duration: '5m', target: 50 },   // Steady state at 50 VUs for 5 min
    { duration: '2m', target: 100 },  // Ramp to peak at 100 VUs
    { duration: '5m', target: 100 },  // Steady state at peak for 5 min
    { duration: '2m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],   // Error rate under 1%
  },
};
```

```yaml
# Artillery: Same profile in YAML
config:
  target: "https://api.example.com"
  phases:
    - duration: 120
      arrivalRate: 5
      rampTo: 25
      name: "Ramp up"
    - duration: 300
      arrivalRate: 25
      name: "Steady state"
    - duration: 120
      arrivalRate: 25
      rampTo: 50
      name: "Ramp to peak"
    - duration: 300
      arrivalRate: 50
      name: "Peak steady state"
    - duration: 120
      arrivalRate: 50
      rampTo: 0
      name: "Ramp down"
  ensure:
    p95: 500
    maxErrorRate: 1

scenarios:
  - name: "Browse and purchase"
    flow:
      - get:
          url: "/products/{{ productId }}"
      - think: 3
      - post:
          url: "/cart"
          json:
            productId: "{{ productId }}"
      - think: 2
      - post:
          url: "/checkout"
```

### Constant Request Rate (Open Model)

```javascript
// k6: Fixed RPS using constant-arrival-rate executor
export const options = {
  scenarios: {
    api_test: {
      executor: 'constant-arrival-rate',
      rate: 500,              // 500 requests per second
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 200,   // Pre-allocate 200 VUs
      maxVUs: 500,            // Allow up to 500 VUs if response slows
    },
  },
};
```

## Capacity Planning

```python
# Capacity planning calculator
def capacity_plan(
    peak_rps: float,
    avg_response_ms: float,
    target_utilization: float = 0.7,  # 70% target -- leave headroom
    safety_factor: float = 1.5,       # 1.5x for unexpected spikes
):
    """Calculate required infrastructure for target load."""
    concurrent = peak_rps * (avg_response_ms / 1000)  # Little's Law
    required_capacity = peak_rps * safety_factor
    instances_needed = required_capacity / (1000 / avg_response_ms * target_utilization)
    connection_pool = int(concurrent * safety_factor)

    return {
        "peak_rps": peak_rps,
        "concurrent_requests": round(concurrent),
        "required_capacity_rps": round(required_capacity),
        "instances_at_70pct_util": round(instances_needed),
        "connection_pool_size": connection_pool,
        "thread_pool_size": connection_pool,
    }

# Example: 2000 RPS peak, 50ms avg response
plan = capacity_plan(peak_rps=2000, avg_response_ms=50)
# {'peak_rps': 2000, 'concurrent_requests': 100, 'required_capacity_rps': 3000,
#  'instances_at_70pct_util': 4, 'connection_pool_size': 150, 'thread_pool_size': 150}
```

## Load Test Data Management

Never use hardcoded test data. Production-like data distributions matter.

```javascript
// k6: External data file for realistic test data
import { SharedArray } from 'k6/data';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';

// SharedArray: loaded once, shared across all VUs (memory-efficient)
const users = new SharedArray('users', function () {
  return papaparse.parse(open('./test-data/users.csv'), { header: true }).data;
});

const products = new SharedArray('products', function () {
  return JSON.parse(open('./test-data/products.json'));
});

export default function () {
  const user = users[Math.floor(Math.random() * users.length)];
  const product = products[Math.floor(Math.random() * products.length)];

  // Login with unique user to avoid cache hits on single user
  const loginRes = http.post('https://api.example.com/login', JSON.stringify({
    email: user.email,
    password: user.password,
  }));
  const token = loginRes.json('token');

  // Browse with varied products
  http.get(`https://api.example.com/products/${product.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

## Environment Parity

| Factor | Production | Load Test Environment |
|--------|-----------|----------------------|
| Database size | 500GB, 50M rows | Must match: 50M rows (use production snapshot) |
| Connection pool | 20 per instance | Must match: 20 per instance |
| Caching | Redis cluster, warm | Must match: same cache config, pre-warmed |
| Network | Same region, <1ms | Must match: same region or simulate latency |
| Instance type | c5.2xlarge x 8 | Same type OR scale down proportionally |
| External deps | Payment gateway, email | Use stubs/mocks with realistic latency |

```typescript
// Stub external dependencies with realistic latency
class PaymentGatewayStub {
  async charge(amount: number): Promise<{ success: boolean; latency: number }> {
    const latency = 150 + Math.random() * 100; // 150-250ms like production
    await new Promise(r => setTimeout(r, latency));
    const success = Math.random() > 0.02; // 2% failure rate like production
    return { success, latency };
  }
}
```

## Load Test Scripts as Code

Store load test scripts in version control alongside application code.

```
repo/
  src/
  tests/
    unit/
    integration/
    load/
      scenarios/
        browse-and-buy.js        # k6 scenario
        api-stress.js             # k6 stress test
        checkout-flow.yaml        # Artillery scenario
      data/
        users.csv                 # Test user pool
        products.json             # Product catalog
      thresholds.json             # SLO thresholds
      Makefile                    # Run targets
```

```makefile
# Makefile for load test execution
.PHONY: load-test smoke-test

smoke-test:
	k6 run --vus 5 --duration 30s scenarios/browse-and-buy.js

load-test:
	k6 run --out json=results/$(shell date +%Y%m%d-%H%M%S).json \
	  scenarios/browse-and-buy.js

load-test-ci:
	k6 run --out json=results.json scenarios/browse-and-buy.js && \
	  python3 scripts/check-regression.py results.json baseline.json
```

## Baseline Metrics Collection

```javascript
// k6: Custom metrics for business-level tracking
import { Counter, Trend, Rate } from 'k6/metrics';

const checkoutDuration = new Trend('checkout_duration', true);
const checkoutSuccess = new Rate('checkout_success');
const ordersPlaced = new Counter('orders_placed');

export default function () {
  const start = Date.now();

  const res = http.post('https://api.example.com/checkout', payload, params);

  checkoutDuration.add(Date.now() - start);
  checkoutSuccess.add(res.status === 200);
  if (res.status === 200) ordersPlaced.add(1);
}

export const options = {
  thresholds: {
    checkout_duration: ['p(95)<2000'],  // Checkout under 2s at p95
    checkout_success: ['rate>0.98'],    // 98% success rate
  },
};
```

## Production Traffic Replay

```python
# Convert production access logs to load test scenarios
import json, re
from collections import Counter

def parse_access_log(log_file: str) -> list[dict]:
    """Parse nginx access log to extract request patterns."""
    pattern = re.compile(
        r'(?P<method>GET|POST|PUT|DELETE) (?P<path>\S+) .* (?P<status>\d{3}) .* (?P<duration>\d+\.\d+)'
    )
    requests = []
    for line in open(log_file):
        m = pattern.search(line)
        if m:
            requests.append(m.groupdict())
    return requests

def generate_traffic_profile(requests: list[dict]) -> dict:
    """Generate weighted traffic profile from production logs."""
    path_counts = Counter(r['path'] for r in requests)
    total = sum(path_counts.values())
    return {
        path: round(count / total * 100, 1)
        for path, count in path_counts.most_common(20)
    }
    # Output: {"/api/products": 35.2, "/api/cart": 22.1, "/api/checkout": 8.5, ...}
```

## Correlating Metrics During Load Tests

Monitor these during every load test:
- **Application:** response time (p50/p95/p99), error rate, throughput
- **Infrastructure:** CPU%, memory%, disk I/O, network I/O
- **Database:** query time, connection pool usage, lock waits, replication lag
- **Dependencies:** external API latency, circuit breaker trips

```javascript
// k6: Tag requests for granular analysis
export default function () {
  http.get('https://api.example.com/products', {
    tags: { type: 'read', endpoint: 'products_list' },
  });
  http.post('https://api.example.com/cart', payload, {
    tags: { type: 'write', endpoint: 'cart_add' },
  });
}
// In Grafana: filter by tags to see per-endpoint latency under load
```

---

## Best Practices

1. **Model real user behavior with think time.** Without think time, 100 VUs generate 10-50x more load than 100 real users. Use 2-5s think time for browsing, 1-3s for API interactions.
2. **Use the open model (constant arrival rate) for API testing.** Closed model (fixed VUs) reduces load as latency increases -- masking the exact moment the system degrades.
3. **Ramp up gradually.** Jump from 0 to 1000 VUs triggers connection storms. Ramp over 2-5 minutes to let connection pools, JIT, and caches warm.
4. **Sustain peak load for at least 10 minutes.** Short tests miss memory leaks, connection pool exhaustion, and GC pressure that appears only under sustained load.
5. **Use production-sized data sets.** A test database with 100 rows performs differently from 50M rows. Query plans, index usage, and I/O patterns change with data volume.
6. **Randomize test data access patterns.** Hitting the same 10 records tests the cache, not the system. Use zipfian or uniform distributions over the full data set.
7. **Run load tests in CI/CD on every release.** Detect regressions before they reach production. Compare against stored baselines with automated threshold checks.
8. **Stub external dependencies with realistic latency and error rates.** A payment gateway stub that responds in 0ms makes your checkout look 5x faster than production.
9. **Store load test scripts in version control.** Scripts are code. They need reviews, versioning, and maintenance like any other test suite.
10. **Correlate application metrics with infrastructure metrics.** A p99 latency spike without CPU saturation points to lock contention or external dependency. Context determines root cause.

---

## Anti-Patterns

1. **Testing without think time.** Each VU sends requests as fast as the server responds, generating 100-500 RPS per VU instead of realistic 0.5 RPS per VU. Results are meaningless for capacity planning.
2. **Using a single test user account.** All requests hit the same cache entries, same database rows, same session. Real traffic has diverse access patterns that stress different code paths.
3. **Testing against a toy database.** 100-row test database fits in L2 cache. Every query is a cache hit. Production with 50M rows has different query plans and I/O patterns.
4. **Running load tests from the same machine as the server.** Client and server compete for CPU, memory, and network bandwidth. Results reflect resource contention, not server capacity.
5. **Ignoring error rates during load tests.** 10,000 RPS means nothing if 15% of requests return 500. Track error rate as a primary metric alongside latency and throughput.
6. **Testing only the happy path.** Real traffic includes 404s, validation failures, retries, and timeouts. Include error paths in test scenarios.
7. **Comparing results across different environments.** A load test on 2-core VMs cannot predict behavior on 16-core production instances. Compare results only within the same environment configuration.
8. **Running load tests without monitoring infrastructure metrics.** Without CPU, memory, and connection pool metrics, you cannot diagnose why latency increased. The load test only reveals symptoms; infrastructure metrics reveal causes.

---

## Enforcement Checklist

- [ ] Load test scenarios model realistic user journeys with think time
- [ ] Test data uses production-scale volume and realistic distributions
- [ ] Environment matches production: same instance types, DB size, cache config
- [ ] Ramp-up period is at least 2 minutes; steady state runs 10+ minutes
- [ ] Thresholds defined for p95 latency, p99 latency, error rate, and throughput
- [ ] External dependencies are stubbed with production-like latency and error rates
- [ ] Load test scripts are version-controlled alongside application code
- [ ] CI pipeline runs smoke load tests on every merge; full load tests weekly
- [ ] Results are stored with environment metadata for historical comparison
- [ ] Infrastructure metrics (CPU, memory, DB connections) are captured during every run
