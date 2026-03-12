# Interactive Application Security Testing (IAST) and Runtime Application Self-Protection (RASP)

## Metadata
- **Category:** Security Testing
- **Scope:** Instrumentation-based security testing and runtime protection
- **Audience:** Software engineers, security engineers, DevSecOps practitioners
- **Prerequisites:** Application architecture, middleware/agent concepts, SAST/DAST basics
- **Last Updated:** 2025-01

---

## 1. Overview

IAST and RASP are agent-based security technologies that operate inside the
application runtime. IAST instruments the application during testing to detect
vulnerabilities with high accuracy. RASP instruments the application in production
to detect and block attacks in real-time.

```
Development   -->   Testing/QA     -->   Staging        -->   Production
   SAST              IAST                 DAST                 RASP
   (code)            (instrumented)       (black-box)          (runtime)
```

Both technologies share a common foundation: a lightweight agent deployed alongside
the application that monitors code execution, data flow, and security-relevant events
from within the runtime environment.

---

## 2. IAST (Interactive Application Security Testing)

### 2.1 How IAST Works

IAST inserts an agent (sensor) into the application runtime that monitors code
execution during normal testing activities (QA, integration tests, manual testing).
The agent observes actual data flow from request to response, identifying
vulnerabilities with precise source and sink information.

```
Test Request --> Application Runtime (with IAST Agent)
                    |
                    +-- Agent observes:
                    |   - HTTP request parameters
                    |   - Data flow through functions
                    |   - Database queries executed
                    |   - File system operations
                    |   - External API calls
                    |   - Cryptographic operations
                    |
                    +-- Agent reports:
                        - Vulnerability type (e.g., SQL Injection)
                        - Exact source code location (file:line)
                        - Full data flow trace
                        - HTTP request that triggered it
                        - Affected framework/library
```

### 2.2 IAST Architecture

```
+-------------------------------------------------------------------+
|  Application Server (Tomcat, Express, Django, etc.)                |
|                                                                    |
|  +-------------------------------------------------------------+  |
|  |  Application Code                                            |  |
|  |                                                              |  |
|  |  request.getParameter("q")  --> vulnerable_function(q)       |  |
|  |       ^                              ^                       |  |
|  |       |                              |                       |  |
|  |  IAST Agent hooks (bytecode instrumentation / monkey-patch)  |  |
|  |       |                              |                       |  |
|  |       v                              v                       |  |
|  |  [Observe input]            [Observe sink reached]           |  |
|  +-------------------------------------------------------------+  |
|                          |                                         |
|                          v                                         |
|                   IAST Server / Dashboard                          |
|                   - Correlates observations                        |
|                   - Reports vulnerabilities                        |
|                   - Provides remediation guidance                  |
+-------------------------------------------------------------------+
```

### 2.3 IAST Instrumentation Methods

**Bytecode instrumentation (Java, .NET):**

The IAST agent modifies bytecode at class load time to insert monitoring hooks
around security-relevant methods (database queries, file I/O, HTTP responses,
cryptographic operations).

```bash
# Java agent attachment
java -javaagent:/path/to/iast-agent.jar \
  -Dagent.server=https://iast-server.example.com \
  -Dagent.token=${IAST_TOKEN} \
  -jar my-application.jar
```

```xml
<!-- Tomcat configuration: catalina.properties -->
CATALINA_OPTS="-javaagent:/opt/iast/agent.jar
  -Dagent.config=/opt/iast/agent.properties"
```

**Monkey-patching (Python, Node.js, Ruby):**

The IAST agent replaces or wraps built-in functions and framework methods at import
time to observe their execution.

```python
# Python IAST agent initialization (conceptual)
# The agent patches functions like:
#   - sqlite3.Cursor.execute (SQL sink)
#   - subprocess.run (command injection sink)
#   - flask.request.args.get (taint source)
#   - os.path.join (path traversal sink)

# In requirements.txt or agent setup:
# contrast-agent==5.x.x

# Application startup with agent:
# contrast-python run -- python app.py
```

```javascript
// Node.js IAST agent (conceptual)
// Agent is required before application code:
// node -r @contrast/agent app.js

// The agent hooks:
// - require('mysql').query (SQL sink)
// - require('child_process').exec (command injection sink)
// - express request.query/body/params (taint source)
// - fs.readFile (path traversal sink)
```

### 2.4 IAST Advantages

| Advantage | Explanation |
|---|---|
| Low false positive rate | Observes actual execution, not theoretical paths |
| Exact code location | Reports file name, line number, function name |
| Full data flow trace | Shows how tainted data reaches the sink |
| No separate scan step | Runs during existing QA/integration tests |
| Finds complex vulnerabilities | Detects issues across framework layers |
| Language-aware | Understands framework-specific patterns |
| Configuration vulnerabilities | Detects insecure settings in frameworks |

### 2.5 IAST Tools

**Contrast Security Assess:**

```bash
# Java agent deployment
java -javaagent:contrast.jar \
  -Dcontrast.api.url=https://app.contrastsecurity.com \
  -Dcontrast.api.api_key=${CONTRAST_API_KEY} \
  -Dcontrast.api.service_key=${CONTRAST_SERVICE_KEY} \
  -Dcontrast.api.user_name=${CONTRAST_USERNAME} \
  -jar my-app.jar
```

```yaml
# contrast_security.yaml (agent configuration)
api:
  url: https://app.contrastsecurity.com
  api_key: ${CONTRAST_API_KEY}
  service_key: ${CONTRAST_SERVICE_KEY}
  user_name: ${CONTRAST_USERNAME}

agent:
  java:
    standalone_app_name: my-application
  logger:
    level: WARN
    path: /var/log/contrast/

assess:
  enable: true
  tags: qa-environment
  stacktraces: ALL
  rules:
    disabled_rules: ""
  sampling:
    enable: true
    baseline: 5
    request_frequency: 10
    window_ms: 180000
```

**Hdiv Security (now part of Datadog):**

```xml
<!-- Spring Boot integration -->
<dependency>
  <groupId>org.hdiv</groupId>
  <artifactId>hdiv-spring-boot-starter</artifactId>
  <version>3.x.x</version>
</dependency>
```

```yaml
# application.yml
hdiv:
  security:
    mode: detect  # detect or block
    excluded-urls:
      - /health
      - /metrics
    protection:
      sql-injection: true
      xss: true
      path-traversal: true
      command-injection: true
```

**Checkmarx IAST (CxIAST):**

```bash
# Deploy CxIAST agent alongside application
# Java
java -javaagent:/opt/cxiast/cxiast-java-agent.jar \
  -DCxIAST.serverUrl=https://cxiast-server.example.com \
  -DCxIAST.projectName=my-project \
  -jar my-app.jar

# .NET
dotnet my-app.dll
# Agent configured via environment variables:
# CXIAST_SERVER_URL=https://cxiast-server.example.com
# CXIAST_PROJECT_NAME=my-project
```

### 2.6 Integrating IAST with Testing

IAST requires test traffic to discover vulnerabilities. The more code paths exercised
by tests, the more vulnerabilities IAST can find.

```yaml
# CI pipeline with IAST during integration tests
# .github/workflows/iast.yml
name: IAST Integration Testing
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  iast-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: testdb
          POSTGRES_PASSWORD: testpass
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Build application with IAST agent
        run: |
          docker build -t my-app:iast \
            --build-arg IAST_AGENT=true \
            -f Dockerfile.iast .

      - name: Start application with IAST
        run: |
          docker run -d --name my-app \
            -p 8080:8080 \
            -e IAST_SERVER_URL=${{ secrets.IAST_SERVER_URL }} \
            -e IAST_API_KEY=${{ secrets.IAST_API_KEY }} \
            --network host \
            my-app:iast
          sleep 15  # Wait for application startup

      - name: Run integration tests
        run: |
          # Integration tests exercise code paths
          # IAST agent monitors execution during tests
          npm run test:integration

      - name: Run API tests
        run: |
          # API tests exercise API endpoints
          npm run test:api

      - name: Retrieve IAST results
        run: |
          curl -s -H "Authorization: Bearer ${{ secrets.IAST_API_KEY }}" \
            "${{ secrets.IAST_SERVER_URL }}/api/v1/projects/my-project/vulnerabilities" \
            -o iast-results.json

      - name: Check for critical findings
        run: |
          CRITICAL=$(jq '[.[] | select(.severity == "CRITICAL")] | length' iast-results.json)
          if [ "$CRITICAL" -gt 0 ]; then
            echo "IAST found $CRITICAL critical vulnerabilities!"
            jq '.[] | select(.severity == "CRITICAL")' iast-results.json
            exit 1
          fi
```

---

## 3. RASP (Runtime Application Self-Protection)

### 3.1 How RASP Works

RASP embeds a security agent inside the production application runtime. Unlike
a WAF (which inspects traffic at the network perimeter), RASP has full visibility
into application internals and can make context-aware blocking decisions.

```
External Request
    |
    v
[WAF / API Gateway] -- Network-level inspection
    |
    v
[Load Balancer]
    |
    v
[Application Server with RASP Agent]
    |
    +-- RASP observes:
    |   - Input parameters and their flow through code
    |   - SQL queries being constructed
    |   - File paths being accessed
    |   - Commands being executed
    |   - Deserialization operations
    |
    +-- RASP decisions:
        - ALLOW: Normal operation, no threat detected
        - LOG: Suspicious activity, log for investigation
        - BLOCK: Attack detected, return error response
        - THROW: Raise exception within application code
```

### 3.2 RASP vs WAF

| Aspect | WAF | RASP |
|---|---|---|
| Position | Network perimeter (before application) | Inside application runtime |
| Visibility | HTTP request/response only | Full application context |
| Protocol support | HTTP/HTTPS (primarily) | All protocols the app uses |
| False positives | Higher (no application context) | Lower (sees actual code execution) |
| SQL injection detection | Pattern matching on request | Sees actual query construction |
| Encrypted traffic | Requires TLS termination | Sees decrypted data natively |
| Performance impact | Minimal (separate infrastructure) | Moderate (in-process) |
| Deployment | Infrastructure team | Application team |
| Bypass risk | Encoding tricks, protocol-level | Much harder (inside the runtime) |
| Scalability | Independent scaling | Scales with application |
| Zero-day protection | Limited (signature-based) | Better (behavior-based) |

### 3.3 RASP Protection Capabilities

```
Attack Type              | RASP Detection Method
-------------------------|-----------------------------------------------
SQL Injection            | Monitor query construction; detect user input
                         | in query syntax (not just parameter values)
Cross-Site Scripting     | Monitor response construction; detect unescaped
                         | user input in HTML output
Command Injection        | Monitor process execution calls; detect user
                         | input in command strings
Path Traversal           | Monitor file system calls; detect directory
                         | traversal sequences in file paths
Deserialization Attacks  | Monitor deserialization calls; block known
                         | dangerous gadget chains
SSRF                     | Monitor outbound HTTP calls; detect internal
                         | IP addresses or restricted hosts
XXE                      | Monitor XML parser configuration; block
                         | external entity resolution
Log Injection            | Monitor logging calls; detect CRLF injection
                         | or JNDI lookup patterns
```

### 3.4 RASP Tools

**Contrast Security Protect:**

```yaml
# contrast_security.yaml (RASP mode)
api:
  url: https://app.contrastsecurity.com
  api_key: ${CONTRAST_API_KEY}
  service_key: ${CONTRAST_SERVICE_KEY}
  user_name: ${CONTRAST_USERNAME}

agent:
  java:
    standalone_app_name: my-production-app
  logger:
    level: ERROR
    path: /var/log/contrast/

protect:
  enable: true
  rules:
    sql-injection:
      mode: BLOCK
    cmd-injection:
      mode: BLOCK
    path-traversal:
      mode: BLOCK
    xss:
      mode: BLOCK
    xxe:
      mode: BLOCK
    unsafe-deserialization:
      mode: BLOCK
    ssrf:
      mode: BLOCK_AT_PERIMETER
    untrusted-deserialization:
      mode: BLOCK
  bot-blocker:
    enable: true
  ip-allowlist:
    enable: false
```

**Imperva RASP:**

```bash
# Imperva RASP agent installation (Java)
java -javaagent:/opt/imperva/rasp-agent.jar \
  -Dimperva.config=/opt/imperva/rasp-config.json \
  -jar my-app.jar
```

```json
{
  "server_url": "https://rasp-management.example.com",
  "api_key": "${IMPERVA_API_KEY}",
  "application_name": "my-production-app",
  "protection_mode": "block",
  "rules": {
    "sql_injection": { "enabled": true, "mode": "block" },
    "xss": { "enabled": true, "mode": "block" },
    "rce": { "enabled": true, "mode": "block" },
    "path_traversal": { "enabled": true, "mode": "block" },
    "ssrf": { "enabled": true, "mode": "block" }
  },
  "performance": {
    "sampling_rate": 100,
    "max_stack_depth": 50
  },
  "logging": {
    "level": "warn",
    "destination": "syslog"
  }
}
```

**Signal Sciences / Fastly Next-Gen WAF (Hybrid WAF+RASP):**

```bash
# Signal Sciences agent installation
# Runs as a sidecar process alongside the application
sigsci-agent --config /etc/sigsci/agent.conf
```

```ini
# /etc/sigsci/agent.conf
accesskeyid = SIGSCI_ACCESS_KEY
secretaccesskey = SIGSCI_SECRET_KEY
server-hostname = my-production-app
server-identifier = production-1

# Module configuration varies by web server
# Apache: LoadModule signalsciences_module /path/to/mod_signalsciences.so
# Nginx: load_module /path/to/ngx_http_sigsci_module.so
# Go/Node.js: Language-specific module wraps HTTP handler
```

---

## 4. IAST vs SAST vs DAST Comparison

```
+------------------+-------------+-------------+-------------+
| Feature          | SAST        | DAST        | IAST        |
+------------------+-------------+-------------+-------------+
| Analyzes         | Source code | Running app | Running app |
|                  |             | (external)  | (internal)  |
+------------------+-------------+-------------+-------------+
| Requires         | Source code | Deployed    | Deployed    |
|                  | access      | application | app + agent |
+------------------+-------------+-------------+-------------+
| False positives  | High        | Moderate    | Low         |
+------------------+-------------+-------------+-------------+
| False negatives  | Moderate    | Moderate    | Low-Moderate|
|                  |             |             | (depends on |
|                  |             |             | test cover) |
+------------------+-------------+-------------+-------------+
| Code location    | Yes (exact) | No          | Yes (exact) |
+------------------+-------------+-------------+-------------+
| Data flow trace  | Theoretical | No          | Actual      |
+------------------+-------------+-------------+-------------+
| Runtime context  | No          | Partial     | Full        |
+------------------+-------------+-------------+-------------+
| Config issues    | Limited     | Yes         | Yes         |
+------------------+-------------+-------------+-------------+
| Business logic   | No          | Limited     | Limited     |
+------------------+-------------+-------------+-------------+
| Speed            | Fast        | Slow        | Fast (runs  |
|                  | (minutes)   | (hours)     | with tests) |
+------------------+-------------+-------------+-------------+
| CI integration   | Easy        | Moderate    | Moderate    |
+------------------+-------------+-------------+-------------+
| Language support  | Broad       | Any (HTTP)  | Limited to  |
|                  |             |             | agent langs |
+------------------+-------------+-------------+-------------+
| Cost             | Free-$$     | Free-$$     | $$$         |
+------------------+-------------+-------------+-------------+
```

---

## 5. Performance Impact Considerations

### 5.1 IAST Performance Impact

IAST runs during testing, so performance impact is acceptable:

```
Typical IAST overhead:
  - CPU: 5-15% additional usage
  - Memory: 50-200 MB additional heap
  - Latency: 5-20% increase per request
  - Startup: 10-30 seconds additional startup time

Acceptable because:
  - Testing environments are not user-facing
  - Test execution time increase is marginal
  - Overhead does not affect production
```

### 5.2 RASP Performance Impact

RASP runs in production, so performance impact must be minimized:

```
Typical RASP overhead:
  - CPU: 2-5% additional usage (well-tuned)
  - Memory: 30-100 MB additional heap
  - Latency: 1-5 ms additional per request
  - Startup: 5-15 seconds additional startup time

Mitigation strategies:
  - Sampling: Analyze a percentage of requests (e.g., 10%)
  - Async reporting: Send findings asynchronously
  - Warm-up: Pre-compile rules during startup
  - Selective monitoring: Only monitor high-risk functions
  - Performance testing: Load test with RASP enabled
```

### 5.3 Performance Testing with RASP

```bash
# Load test comparison with and without RASP
# Step 1: Baseline without RASP
k6 run --out json=baseline.json load-test.js

# Step 2: With RASP enabled
k6 run --out json=with-rasp.json load-test.js

# Step 3: Compare results
# p95 latency increase should be < 5ms
# Throughput decrease should be < 5%
```

```javascript
// k6 load test script (load-test.js)
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  let res = http.get('https://my-app.example.com/api/data');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

---

## 6. Deployment Patterns

### 6.1 IAST Deployment (QA/Staging)

```yaml
# Docker Compose for IAST-enabled testing environment
# docker-compose.iast.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - JAVA_TOOL_OPTIONS=-javaagent:/opt/iast/agent.jar
      - IAST_SERVER_URL=https://iast-server.internal.com
      - IAST_API_KEY=${IAST_API_KEY}
      - IAST_PROJECT=my-app-qa
    volumes:
      - ./iast-agent:/opt/iast:ro
    ports:
      - "8080:8080"

  test-runner:
    build:
      context: ./tests
    environment:
      - APP_URL=http://app:8080
    depends_on:
      - app
    command: npm run test:integration
```

### 6.2 RASP Deployment (Production)

```yaml
# Kubernetes deployment with RASP agent
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      initContainers:
        - name: rasp-agent-init
          image: contrast/java-agent:latest
          command: ['cp', '/opt/contrast/contrast-agent.jar', '/opt/agent/']
          volumeMounts:
            - name: agent-volume
              mountPath: /opt/agent

      containers:
        - name: my-app
          image: my-app:latest
          env:
            - name: JAVA_TOOL_OPTIONS
              value: "-javaagent:/opt/agent/contrast-agent.jar"
            - name: CONTRAST__API__URL
              value: "https://app.contrastsecurity.com"
            - name: CONTRAST__API__API_KEY
              valueFrom:
                secretKeyRef:
                  name: contrast-secrets
                  key: api-key
            - name: CONTRAST__API__SERVICE_KEY
              valueFrom:
                secretKeyRef:
                  name: contrast-secrets
                  key: service-key
            - name: CONTRAST__PROTECT__ENABLE
              value: "true"
          volumeMounts:
            - name: agent-volume
              mountPath: /opt/agent
              readOnly: true
          resources:
            requests:
              cpu: "500m"
              memory: "768Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"

      volumes:
        - name: agent-volume
          emptyDir: {}
```

### 6.3 Gradual RASP Rollout

```
Phase 1: Monitor Mode (2-4 weeks)
  - Deploy RASP in detect-only mode
  - Agent logs potential attacks without blocking
  - Measure performance impact
  - Tune rules to reduce false positives
  - Verify application behavior is unchanged

Phase 2: Block Critical Attacks (2-4 weeks)
  - Enable blocking for highest-confidence rules
  - SQL injection, command injection, deserialization
  - Monitor for false positive blocks
  - Keep less-certain rules in detect mode

Phase 3: Full Protection (ongoing)
  - Enable blocking for all configured rules
  - Continuous monitoring and tuning
  - Regular performance benchmarks
  - Quarterly rule review and update
```

---

## 7. Language Support Matrix

```
+------------------+------+------+--------+------+------+------+
| Language         | SAST | DAST | IAST   | RASP | SCA  | Fuzz |
+------------------+------+------+--------+------+------+------+
| Java             | +++  | +++  | +++    | +++  | +++  | ++   |
| C# / .NET        | +++  | +++  | ++     | ++   | +++  | ++   |
| JavaScript/TS    | +++  | +++  | ++     | ++   | +++  | +    |
| Python           | +++  | +++  | ++     | +    | +++  | ++   |
| Go               | +++  | +++  | +      | +    | +++  | +++  |
| Ruby             | ++   | +++  | ++     | +    | +++  | +    |
| PHP              | ++   | +++  | +      | +    | ++   | +    |
| Rust             | ++   | +++  | -      | -    | +++  | +++  |
| C/C++            | ++   | +++  | -      | -    | ++   | +++  |
+------------------+------+------+--------+------+------+------+

Legend: +++ = Excellent support  ++ = Good support
        +  = Limited support    -  = No/minimal support
```

---

## 8. When to Use IAST vs RASP

### 8.1 Use IAST When

```
- Running integration tests or QA testing
- You want precise vulnerability locations with data flow traces
- Reducing SAST false positives by validating findings at runtime
- Testing new features before release
- Measuring security test coverage
- Regulatory requirements mandate security testing in QA
```

### 8.2 Use RASP When

```
- Protecting production applications from known attack patterns
- Providing defense-in-depth alongside WAF
- Needing virtual patching for vulnerabilities that cannot be fixed immediately
- Monitoring for zero-day exploitation patterns
- Protecting legacy applications that cannot be easily modified
- Meeting compliance requirements for runtime protection
```

### 8.3 Using Both Together

```
Development   Testing/QA          Staging            Production
    |              |                  |                    |
   SAST          IAST              DAST                 RASP
    |              |                  |                    |
    v              v                  v                    v
Find vulns    Verify + find      Find runtime        Block attacks
in code       more vulns with    config issues        in real-time
              precise location                        + virtual patch

IAST findings in QA --> Inform RASP rules in production
RASP blocked attacks in production --> Inform SAST/IAST rules
```

---

## 9. Agent-Based vs Agentless Approaches

### 9.1 Agent-Based (Traditional IAST/RASP)

```
Advantages:
  - Full runtime visibility
  - Precise data flow tracking
  - Low false positive rate
  - Can block attacks in real-time (RASP)

Disadvantages:
  - Must be deployed with each application instance
  - Language/framework-specific agents
  - Performance overhead
  - Agent maintenance and updates
  - Potential compatibility issues
```

### 9.2 Agentless / Sidecar Approaches

```
Advantages:
  - No modification to application code or startup
  - Language-agnostic (works with any application)
  - Easier deployment in containerized environments
  - Simpler maintenance

Disadvantages:
  - Limited visibility into application internals
  - Cannot track data flow within the application
  - Higher false positive rate
  - Cannot provide exact code location
  - Essentially a smarter WAF, not true IAST/RASP
```

---

## 10. Best Practices

1. **Deploy IAST in QA environments, not production.** IAST adds meaningful overhead
   and is designed for testing environments. Use RASP (not IAST) for production
   protection. Never enable IAST's vulnerability detection in production.

2. **Maximize test coverage to maximize IAST value.** IAST only finds vulnerabilities
   in code paths exercised by tests. Invest in comprehensive integration and API
   tests to ensure IAST covers the full attack surface.

3. **Start RASP in monitor/detect mode before enabling blocking.** Deploy RASP in
   detect-only mode for at least two weeks. Analyze logs for false positives and
   tune rules before enabling blocking to avoid disrupting legitimate traffic.

4. **Load test with RASP enabled.** Measure the performance impact of RASP under
   realistic production load. Ensure p95 latency increase stays below 5ms and
   throughput decrease stays below 5%. Adjust sampling if needed.

5. **Use RASP as defense-in-depth, not a replacement for fixing vulnerabilities.**
   RASP blocks known attack patterns but does not fix the underlying vulnerability.
   Always prioritize fixing the root cause. Use RASP as a virtual patch while the
   fix is being developed.

6. **Integrate IAST findings into the same vulnerability management system.** IAST
   findings should flow into the same tracker as SAST, DAST, and SCA findings.
   Deduplicate across tools to avoid reporting the same vulnerability multiple times.

7. **Keep IAST and RASP agents updated.** Agents require regular updates for new
   vulnerability patterns, performance improvements, and compatibility with new
   framework versions. Automate agent updates in your deployment pipeline.

8. **Configure RASP alerts to feed into SIEM/SOC.** RASP attack detections are
   security events that should be monitored by the security operations team.
   Integrate RASP with your SIEM for real-time alerting and incident response.

9. **Use IAST to validate SAST findings.** When SAST reports a potential
   vulnerability, check if IAST confirms it during testing. Confirmed findings
   get higher priority; unconfirmed findings may be false positives.

10. **Plan for agent compatibility across framework upgrades.** When upgrading
    application frameworks or language runtimes, verify IAST/RASP agent
    compatibility first. Agent incompatibility can cause application crashes or
    silent security coverage gaps.

---

## 11. Anti-Patterns

1. **Deploying IAST in production as if it were RASP.** IAST is designed for testing
   environments and adds significant overhead. Running IAST in production degrades
   performance without providing the blocking capabilities of RASP.

2. **Enabling RASP blocking on day one without tuning.** Blocking legitimate requests
   due to false positives causes production incidents. Always run in detect mode
   first and tune rules based on observed traffic patterns.

3. **Using RASP as an excuse to skip vulnerability remediation.** RASP is a
   compensating control, not a fix. Teams that rely on RASP to "protect" known
   vulnerabilities accumulate technical debt and risk RASP bypass techniques.

4. **Ignoring RASP performance impact during capacity planning.** RASP agents
   consume CPU and memory. Failing to account for this overhead leads to
   under-provisioned production environments and degraded user experience.

5. **Not testing IAST/RASP agent compatibility with application updates.** Agent
   libraries hook into framework internals. Major framework or runtime version
   upgrades can break agent functionality silently, leaving the application
   unmonitored.

6. **Treating IAST as a replacement for SAST and DAST.** IAST complements but does
   not replace SAST (which finds issues without running code) or DAST (which tests
   the deployed application from an external perspective). All three provide
   different coverage.

7. **Running IAST with minimal test coverage and expecting comprehensive results.**
   IAST can only analyze code paths that are actually executed during testing. Low
   test coverage means low IAST coverage. Invest in tests first.

8. **Deploying a single RASP rule set across all applications.** Different
   applications have different risk profiles and legitimate usage patterns. A
   rule that is appropriate for a public API may cause false positives on an
   internal admin tool. Customize per application.

---

## 12. Enforcement Checklist

```
IAST/RASP ENFORCEMENT CHECKLIST
================================

IAST Configuration:
[ ] IAST agent selected and licensed for all supported languages
[ ] IAST agent deployed in QA/staging environments
[ ] IAST integrated with CI pipeline (runs during integration tests)
[ ] IAST findings fed into vulnerability management system
[ ] Performance baseline measured with IAST enabled
[ ] IAST coverage correlated with test coverage
[ ] False positive feedback loop established

RASP Configuration:
[ ] RASP agent selected and licensed for production use
[ ] RASP deployed in monitor/detect mode initially (minimum 2 weeks)
[ ] Performance impact measured under production-like load
[ ] RASP rules tuned to minimize false positives
[ ] Blocking enabled after tuning period
[ ] Rollback plan documented (disable RASP without redeployment)
[ ] RASP alerts integrated with SIEM/SOC

Operational:
[ ] Agent update process automated or scheduled
[ ] Agent compatibility verified before framework/runtime upgrades
[ ] RASP attack logs reviewed weekly by security team
[ ] IAST findings reviewed in sprint planning
[ ] Cross-tool deduplication configured (SAST + IAST + DAST)
[ ] Performance benchmarks run quarterly with RASP enabled

Governance:
[ ] IAST/RASP configuration version-controlled
[ ] RASP rule changes go through change management process
[ ] Vendor support contracts maintained
[ ] License compliance verified (agent count, application count)
[ ] IAST/RASP effectiveness metrics reported in security reviews
```
