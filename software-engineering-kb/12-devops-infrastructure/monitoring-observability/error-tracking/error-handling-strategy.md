# Error Handling Strategy — Systematic Error Tracking for Production Systems

| Attribute     | Value                                                                                          |
|---------------|------------------------------------------------------------------------------------------------|
| Domain        | DevOps > Observability > Error Tracking                                                        |
| Importance    | High                                                                                           |
| Last Updated  | 2026-03                                                                                        |
| Cross-ref     | [Sentry](sentry.md), [Alerting](../metrics/alerting.md), [Incident Response](../../incident-management/incident-response.md) |

> **Directive:** Implement dedicated error tracking as a distinct observability signal separate from logging. Capture, deduplicate, group, and prioritize errors systematically. Correlate errors with deployments, traces, and user impact. Define error budgets and alert on burn rate, not individual occurrences.

---

## 1. Error Tracking vs Logging

```
WHY DEDICATED ERROR TRACKING (not just grep logs for "ERROR"):

LOGGING:                              ERROR TRACKING:
  ├── Append-only stream               ├── Grouped issues (deduplicated)
  ├── Every log line is equal           ├── Prioritized by frequency × impact
  ├── No deduplication                  ├── Stack trace fingerprinting
  ├── Manual search required            ├── Automatic alerting on new issues
  ├── No release correlation            ├── First/last seen per release
  ├── No user impact tracking           ├── Affected user count
  └── No regression detection           └── Resolved → re-opened detection

ERROR TRACKING ANSWERS:
  - "What are the top 5 errors affecting users right now?"
  - "Did last deploy introduce new errors?"
  - "How many users are affected by this bug?"
  - "Is this error getting worse or better?"
  - "Was this error previously fixed and now regressed?"
```

---

## 2. Error Classification

### By Expectedness

```
EXPECTED ERRORS (handled):
  ├── Validation failures (400 Bad Request)
  ├── Authentication failures (401 Unauthorized)
  ├── Resource not found (404)
  ├── Rate limiting (429 Too Many Requests)
  └── Business rule violations ("insufficient balance")
  → LOG at WARN level, track in metrics, do NOT alert

UNEXPECTED ERRORS (unhandled):
  ├── Null pointer / undefined reference
  ├── Database connection failures
  ├── Out of memory
  ├── Unhandled promise rejections
  └── Panic / segfault
  → CAPTURE in error tracker, ALERT, investigate
```

### By Transience

```
TRANSIENT ERRORS:
  ├── Network timeout (retry will likely succeed)
  ├── Database deadlock (retry at transaction level)
  ├── Rate-limited upstream API (back off and retry)
  └── DNS resolution failure (temporary)
  → RETRY with exponential backoff; alert if retry budget exhausted

PERMANENT ERRORS:
  ├── Invalid configuration (won't fix itself)
  ├── Missing required field in request
  ├── Incompatible API version
  └── Corrupted data
  → DO NOT RETRY; capture immediately for investigation
```

### By Origin

```
USER ERRORS:       validation, bad input, expired session → 4xx
SYSTEM ERRORS:     bugs, crashes, resource exhaustion → 5xx, unhandled exceptions
DEPENDENCY ERRORS: upstream timeout, third-party API down → circuit break, fallback
INFRASTRUCTURE:    disk full, OOM kill, node failure → platform alerting
```

---

## 3. Error Tracking Workflow

```
LIFECYCLE:
  CAPTURE → DEDUPLICATE → GROUP → ENRICH → ALERT → ASSIGN → RESOLVE → MONITOR

  1. CAPTURE
     SDK intercepts unhandled exceptions and explicit error reports.
     Collects stack trace, environment, request context, breadcrumbs.

  2. DEDUPLICATE
     Backend identifies same error occurring multiple times.
     Uses fingerprinting (stack trace hash + error type + location).

  3. GROUP (Issue)
     Multiple error events grouped into a single "Issue."
     Issue has: first seen, last seen, event count, affected users.

  4. ENRICH
     Attach context: user info, request data, release version,
     environment, tags, breadcrumbs (recent user actions).

  5. ALERT
     Notify on: new issue, regression (resolved → re-opened),
     spike in error rate, error budget burn rate exceeded.

  6. ASSIGN
     Route to responsible team/individual based on:
     code ownership (CODEOWNERS), service name, or alert rules.

  7. RESOLVE
     Mark issue as resolved in specific release version.
     Error tracker watches for recurrence in future releases.

  8. MONITOR
     Track error rate trends, new vs resolved issues per release,
     error budget consumption, mean time to resolution (MTTR).
```

---

## 4. Error Context Enrichment

### Capturing Rich Context

```typescript
// TypeScript — structured error context
interface ErrorContext {
  // User context (pseudonymized)
  user: {
    id: string;           // hashed or pseudonymized
    tier: string;         // "free" | "pro" | "enterprise"
    sessionId: string;
  };

  // Request context
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;  // sanitized — no auth tokens
    body?: unknown;                   // sanitized — no PII
    ip: string;
  };

  // Environment context
  environment: {
    service: string;
    version: string;
    region: string;
    nodeId: string;
    runtime: string;      // "node 22.5.0"
  };

  // Trace correlation
  tracing: {
    traceId: string;
    spanId: string;
  };

  // Breadcrumbs (recent actions leading to the error)
  breadcrumbs: Array<{
    timestamp: string;
    category: string;     // "http" | "navigation" | "user" | "console"
    message: string;
    level: string;
    data?: Record<string, unknown>;
  }>;

  // Custom tags for filtering
  tags: Record<string, string>;
}
```

### Breadcrumbs

```python
# Python — breadcrumb trail leading to an error
# Most error tracking SDKs capture breadcrumbs automatically:
#   - HTTP requests (outgoing)
#   - Database queries
#   - Log messages
#   - UI interactions (frontend)

# Manual breadcrumb
import sentry_sdk

sentry_sdk.add_breadcrumb(
    category="payment",
    message=f"Processing payment for order {order_id}",
    level="info",
    data={"amount": amount, "currency": currency},
)

# When an error is captured, the last 100 breadcrumbs are attached,
# providing a timeline of events leading to the failure.
```

---

## 5. Source Maps for Frontend Errors

```
PROBLEM:
  Production JavaScript is minified and bundled.
  Error: "TypeError: Cannot read property 'a' of undefined at e.js:1:12345"
  This is useless for debugging.

SOLUTION:
  Upload source maps to the error tracking service during build.
  Error tracker maps minified stack traces back to original source.

FLOW:
  1. Build produces: bundle.js + bundle.js.map
  2. CI/CD uploads .map files to error tracker (Sentry, Bugsnag, etc.)
  3. Deploy bundle.js to CDN (WITHOUT .map files — security)
  4. When error occurs, tracker uses uploaded maps to show original source

SECURITY:
  - NEVER serve .map files publicly (reveals source code)
  - Upload maps only to error tracking service via authenticated API
  - Delete .map files after upload (do not include in deployment artifact)
```

```bash
# Sentry CLI — upload source maps during CI/CD build
sentry-cli releases new "$RELEASE_VERSION"
sentry-cli releases files "$RELEASE_VERSION" upload-sourcemaps \
  --url-prefix "~/static/js" \
  ./build/static/js/
sentry-cli releases finalize "$RELEASE_VERSION"
sentry-cli releases deploys "$RELEASE_VERSION" new -e production
```

---

## 6. Error Grouping Strategies

```
FINGERPRINTING:
  Error tracker assigns a "fingerprint" to each error event.
  Events with the same fingerprint are grouped into one Issue.

DEFAULT GROUPING (stack-trace based):
  Hash of: exception type + top N stack frames (minus line numbers)
  ├── Same function, same file → same issue
  ├── Line number changes (new release) → still same issue
  └── Different function path → different issue

CUSTOM FINGERPRINTING:
  Override when default grouping is wrong:
  ├── Group by error message pattern (ignoring variable parts)
  ├── Group by business context (order_id, payment_provider)
  └── Split a noisy group into sub-groups by endpoint
```

```typescript
// TypeScript — custom fingerprinting in Sentry
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'https://key@sentry.io/123',
  beforeSend(event) {
    // Group all "connection refused" errors together regardless of service
    if (event.exception?.values?.[0]?.value?.includes('ECONNREFUSED')) {
      event.fingerprint = ['connection-refused', event.tags?.service || 'unknown'];
    }

    // Group all rate limit errors by provider
    if (event.tags?.error_type === 'rate_limited') {
      event.fingerprint = ['rate-limited', event.tags?.provider || 'unknown'];
    }

    return event;
  },
});
```

---

## 7. Error Prioritization

```
PRIORITY MATRIX:
  Priority = Frequency × Impact × Severity

  ┌──────────────┬──────────────┬──────────────┬──────────────┐
  │              │ Low Freq     │ Medium Freq  │ High Freq    │
  │              │ (< 10/day)   │ (10-100/day) │ (> 100/day)  │
  ├──────────────┼──────────────┼──────────────┼──────────────┤
  │ High Impact  │ P2 — Plan    │ P1 — Urgent  │ P0 — Critical│
  │ (data loss,  │              │              │              │
  │  payment)    │              │              │              │
  ├──────────────┼──────────────┼──────────────┼──────────────┤
  │ Medium Impact│ P3 — Backlog │ P2 — Plan    │ P1 — Urgent  │
  │ (degraded UX)│              │              │              │
  ├──────────────┼──────────────┼──────────────┼──────────────┤
  │ Low Impact   │ P4 — Monitor │ P3 — Backlog │ P2 — Plan    │
  │ (cosmetic)   │              │              │              │
  └──────────────┴──────────────┴──────────────┴──────────────┘

AFFECTED USERS:
  Adjust priority up when unique affected user count is high.
  100 errors from 1 user = lower priority than 100 errors from 100 users.
```

---

## 8. Release Tracking

```
CORRELATING ERRORS WITH DEPLOYMENTS:
  ┌────────────────────────────────────────────────────────┐
  │ v1.4.2 deployed at 14:00                               │
  │ ├── New issue: NullPointerException in OrderService     │
  │ │   └── First seen: 14:02 (2 min after deploy)         │
  │ ├── Existing issue: TimeoutException (pre-existing)     │
  │ │   └── No change in frequency                         │
  │ └── Regression: PaymentError (was resolved in v1.4.0)   │
  │     └── Re-opened automatically                        │
  └────────────────────────────────────────────────────────┘

RELEASE HEALTH METRICS:
  - Crash-free sessions: % of sessions without unhandled errors
  - Crash-free users: % of users without unhandled errors
  - New issues introduced: count of issues first seen in this release
  - Regressions: count of previously-resolved issues that re-appeared
  - Error count delta: change in total error rate vs previous release
```

```python
# Python — release tracking in error SDK
import sentry_sdk

sentry_sdk.init(
    dsn="https://key@sentry.io/123",
    release="order-service@1.4.2",     # match git tag or CI version
    environment="production",
    traces_sample_rate=0.1,
)

# After deploy, notify error tracker
# sentry-cli releases deploys order-service@1.4.2 new -e production
```

---

## 9. Error Regression Detection

```
REGRESSION WORKFLOW:
  1. Developer resolves issue in error tracker
  2. Issue is marked "resolved in release v1.4.1"
  3. When v1.4.2 deploys, error tracker monitors for recurrence
  4. If same fingerprint appears in v1.4.2 → issue REOPENED
  5. Alert sent: "Regression: PaymentError returned in v1.4.2"

BENEFITS:
  - Catches incomplete fixes automatically
  - Prevents resolved bugs from silently returning
  - Creates accountability — regression tied to specific release
```

---

## 10. Error Tracking in CI/CD

```yaml
# GitHub Actions — fail deploy if error rate spikes
- name: Deploy to production
  run: kubectl rollout restart deployment/order-service

- name: Monitor error rate post-deploy
  run: |
    sleep 300  # wait 5 minutes for errors to surface
    ERROR_RATE=$(curl -s "https://sentry.io/api/0/projects/org/project/stats/" \
      -H "Authorization: Bearer $SENTRY_TOKEN" | jq '.error_rate')
    BASELINE=$(curl -s "https://sentry.io/api/0/projects/org/project/stats/?period=1h" \
      -H "Authorization: Bearer $SENTRY_TOKEN" | jq '.error_rate')
    if (( $(echo "$ERROR_RATE > $BASELINE * 2" | bc -l) )); then
      echo "Error rate doubled after deploy — rolling back"
      kubectl rollout undo deployment/order-service
      exit 1
    fi
```

```go
// Go — error budget gate in deployment pipeline
package deploy

// CheckErrorBudget verifies remaining error budget before allowing deploy.
func CheckErrorBudget(ctx context.Context, service string) error {
    budget, err := sloClient.GetErrorBudget(ctx, service)
    if err != nil {
        return fmt.Errorf("failed to check error budget: %w", err)
    }

    if budget.RemainingPercent < 10.0 {
        return fmt.Errorf(
            "error budget too low for %s: %.1f%% remaining (minimum 10%%)",
            service, budget.RemainingPercent,
        )
    }

    return nil // safe to deploy
}
```

---

## 11. Cross-Service Error Correlation

```
TRACE ID LINKING:
  When an error occurs in Service B, the error event includes the trace_id.
  This allows:
  ├── Click from error → full distributed trace
  ├── See which upstream service triggered the error
  ├── See if the error cascaded to downstream services
  └── Correlate errors across services for the same user request

IMPLEMENTATION:
  1. OTel SDK automatically adds trace_id to error events (if configured)
  2. Error tracking SDK reads active span context
  3. Error event stored with trace_id tag
  4. UI provides "View Trace" link from error detail page
```

```typescript
// Ensure trace context is attached to error events
import * as Sentry from '@sentry/node';
import { trace } from '@opentelemetry/api';

Sentry.init({
  dsn: 'https://key@sentry.io/123',
  integrations: [Sentry.openTelemetryIntegration()],
  beforeSend(event) {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      const ctx = activeSpan.spanContext();
      event.tags = {
        ...event.tags,
        trace_id: ctx.traceId,
        span_id: ctx.spanId,
      };
      event.contexts = {
        ...event.contexts,
        trace: {
          trace_id: ctx.traceId,
          span_id: ctx.spanId,
        },
      };
    }
    return event;
  },
});
```

---

## 12. Error SLOs and Error Budgets

```
ERROR BUDGET:
  Based on SLO definition:
  SLO: 99.9% of requests succeed (error-free)
  Error budget: 0.1% of requests can fail per 30-day window

  At 1M requests/day → 30M/month → 30,000 errors allowed per month
  Current: 12,000 errors used → 18,000 remaining (60% budget left)

BURN RATE ALERTING:
  Instead of alerting on "error count > threshold":
  Alert on how fast the error budget is being consumed.

  Burn rate = actual error rate / budgeted error rate
  ├── Burn rate 1.0 = consuming at exactly the budget pace
  ├── Burn rate 10.0 = will exhaust budget in 3 days (alert!)
  └── Burn rate 50.0 = will exhaust budget in 14 hours (page!)

MULTI-WINDOW BURN RATE ALERTS (Google SRE approach):
  ┌───────────┬───────────────┬──────────────┬─────────────┐
  │ Severity  │ Long Window   │ Short Window │ Burn Rate   │
  ├───────────┼───────────────┼──────────────┼─────────────┤
  │ Page      │ 1 hour        │ 5 minutes    │ 14.4x       │
  │ Page      │ 6 hours       │ 30 minutes   │ 6x          │
  │ Ticket    │ 1 day         │ 2 hours      │ 3x          │
  │ Ticket    │ 3 days        │ 6 hours      │ 1x          │
  └───────────┴───────────────┴──────────────┴─────────────┘
```

```yaml
# Prometheus alerting rule — error budget burn rate
groups:
  - name: error-budget-alerts
    rules:
      - alert: HighErrorBudgetBurn
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[1h]))
            /
            sum(rate(http_requests_total[1h]))
          ) > (14.4 * 0.001)
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Error budget burning at 14.4x rate"
          description: "Service {{ $labels.service }} will exhaust 30-day error budget in ~3 days"

      - alert: ErrorBudgetNearlyExhausted
        expr: |
          1 - (
            sum_over_time(
              (sum(rate(http_requests_total{status!~"5.."}[5m])) / sum(rate(http_requests_total[5m])))[30d:]
            ) / (30 * 24 * 12)
          ) > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "90% of error budget consumed"
```

---

## Best Practices

| #  | Practice                                      | Description                                                                                       |
|----|-----------------------------------------------|---------------------------------------------------------------------------------------------------|
| 1  | Separate error tracking from logging           | Use a dedicated error tracking tool (Sentry, Bugsnag) — do not rely on log search for errors.     |
| 2  | Classify errors by expectedness               | Only track unexpected errors in the error tracker. Log expected errors at WARN level.              |
| 3  | Enrich errors with context                    | Attach user ID, request data, breadcrumbs, trace ID, and release version to every error event.     |
| 4  | Upload source maps in CI/CD                   | Automate source map upload during build. Never serve source maps publicly.                         |
| 5  | Customize fingerprinting for noisy errors     | Override default grouping when error messages contain variable data (IDs, timestamps).             |
| 6  | Track errors per release                      | Correlate new errors and regressions with specific deployments. Enable crash-free session metrics.  |
| 7  | Alert on burn rate, not count                 | Use multi-window burn rate alerts instead of static thresholds. Catches both sudden and slow burns. |
| 8  | Link errors to traces                         | Include trace_id in error events for cross-service debugging. Enable "View Trace" from error UI.   |
| 9  | Gate deployments on error budget              | Block deploys when error budget is below 10%. Prevent deploying into an already-degraded state.    |
| 10 | Review error trends weekly                    | Triage top-10 errors weekly. Track new/resolved/regressed issues per release.                      |

---

## Anti-Patterns

| #  | Anti-Pattern                              | Problem                                                       | Fix                                                           |
|----|-------------------------------------------|---------------------------------------------------------------|---------------------------------------------------------------|
| 1  | Tracking all errors equally               | Noise drowns signal; team ignores error alerts                | Classify by severity and impact; only alert on unexpected errors |
| 2  | No error deduplication                    | Same error generates 10K alerts per hour                      | Use error tracking tool with fingerprinting and issue grouping  |
| 3  | Missing source maps                       | Frontend errors show minified stack traces — undebuggable     | Automate source map upload in CI/CD pipeline                    |
| 4  | PII in error context                      | User emails, tokens stored in error tracking database         | Sanitize request headers and bodies; use scrubbing middleware   |
| 5  | No release correlation                    | Cannot tell if deploy caused new errors                       | Set release version in SDK init; create releases in CI/CD       |
| 6  | Alerting on every error occurrence        | Alert fatigue; on-call ignores pages after first hour         | Alert on burn rate and new issues, not individual occurrences   |
| 7  | Resolving errors without root cause       | Same error reopens repeatedly                                 | Require root cause analysis before marking resolved             |
| 8  | Ignoring regression detection             | Previously-fixed bugs silently return in new releases         | Enable regression alerts; review reopened issues after deploys  |

---

## Enforcement Checklist

```
ERROR CAPTURE:
  [ ] Error tracking SDK installed on all services (frontend + backend)
  [ ] Unhandled exceptions captured automatically
  [ ] Expected errors (4xx) excluded from error tracker (logged only)
  [ ] Error context includes user ID, request data, environment, breadcrumbs
  [ ] Trace ID attached to error events for cross-service correlation

SOURCE MAPS:
  [ ] Source maps uploaded to error tracker during CI/CD build
  [ ] Source maps NOT served publicly (security)
  [ ] Source map upload verified — minified stack traces resolve correctly

RELEASE TRACKING:
  [ ] SDK configured with release version (matches git tag / CI version)
  [ ] Release created in error tracker during deploy
  [ ] Regression detection enabled (resolved issues auto-reopen)
  [ ] Crash-free session/user metrics tracked per release

ALERTING:
  [ ] Alert on new issues (first occurrence of a new fingerprint)
  [ ] Alert on regressions (previously-resolved issues return)
  [ ] Alert on error budget burn rate (multi-window approach)
  [ ] No alerts on individual expected error occurrences

PROCESS:
  [ ] Weekly error triage meeting (review top-10 errors)
  [ ] Error SLO defined (e.g., 99.9% error-free requests)
  [ ] Deploy gate checks error budget before allowing release
  [ ] MTTR tracked for error resolution
```
