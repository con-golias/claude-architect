# Sentry — Error Tracking and Performance Monitoring Platform

| Attribute     | Value                                                                                          |
|---------------|------------------------------------------------------------------------------------------------|
| Domain        | DevOps > Observability > Error Tracking                                                        |
| Importance    | High                                                                                           |
| Last Updated  | 2026-03                                                                                        |
| Cross-ref     | [Error Handling Strategy](error-handling-strategy.md), [Structured Logging](../logging/structured-logging.md) |

> **Directive:** Deploy Sentry as the primary error tracking platform for frontend and backend services. Configure SDK initialization, source map uploads, release tracking, and alert rules as part of the standard service deployment pipeline. Use Sentry's performance monitoring to complement distributed tracing, not replace it.

---

## 1. Sentry Concepts

```
CORE MODEL:
  EVENT:  A single error occurrence (exception, message, transaction)
  ISSUE:  A group of similar events (deduplicated by fingerprint)
  BREADCRUMB:  Timestamped log of actions before the error
  CONTEXT:  Structured data attached to events (user, device, OS)
  TAG:  Indexed key-value pair for filtering (environment, service, region)
  SCOPE:  Current context container (user, tags, breadcrumbs) — per-request

HIERARCHY:
  Organization → Project → Issue → Event
  ├── Organization: company-level (billing, teams)
  ├── Project: one per deployable service (order-service, web-frontend)
  ├── Issue: grouped errors (fingerprint-based)
  └── Event: individual error occurrence with full context

ISSUE LIFECYCLE:
  New → Ongoing → Resolved → Regressed (auto-reopened) → Archived/Ignored
  ├── Resolved: "fixed in release X" — watched for regression
  ├── Ignored: known issue, not actionable (with optional timer/count)
  └── Archived: old issue, no longer relevant
```

---

## 2. SDK Setup

### TypeScript / Node.js (Express)

```typescript
// src/instrument.ts — MUST be imported before any other module
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.RELEASE_VERSION,      // e.g., "order-service@1.4.2"
  environment: process.env.NODE_ENV,          // "production" | "staging"
  tracesSampleRate: 0.1,                      // 10% of transactions for performance
  profilesSampleRate: 0.1,                    // 10% of transactions profiled

  // Scrub sensitive data
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },

  // Filter noisy errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Network request failed',
    /^Loading chunk \d+ failed/,
  ],

  integrations: [
    Sentry.extraErrorDataIntegration(),
    Sentry.localVariablesIntegration(),       // capture local variables in stack
  ],
});

// src/app.ts
import './instrument';  // must be first import
import express from 'express';

const app = express();

// Sentry request handler — creates transaction per request
Sentry.setupExpressErrorHandler(app);

// Routes
app.get('/api/orders/:id', async (req, res) => {
  // Sentry automatically captures unhandled errors in route handlers
  const order = await orderService.getById(req.params.id);
  res.json(order);
});

// Manual error capture with context
app.post('/api/orders', async (req, res) => {
  try {
    const order = await orderService.create(req.body);
    res.status(201).json(order);
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag('order.type', req.body.type);
      scope.setContext('order', { items: req.body.items?.length });
      scope.setUser({ id: req.user.id });
      Sentry.captureException(err);
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fastify alternative
import Fastify from 'fastify';
import { fastifySentryPlugin } from '@sentry/node';

const fastify = Fastify();
fastify.register(fastifySentryPlugin);
```

### Python (Django / Flask)

```python
# settings.py (Django)
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

sentry_sdk.init(
    dsn=os.environ["SENTRY_DSN"],
    release=os.environ.get("RELEASE_VERSION", "unknown"),
    environment=os.environ.get("DJANGO_ENV", "production"),
    traces_sample_rate=0.1,
    profiles_sample_rate=0.1,
    integrations=[DjangoIntegration()],
    # Scrub sensitive data
    before_send=scrub_event,
    # Send PII only if explicitly needed
    send_default_pii=False,
)

def scrub_event(event, hint):
    """Remove sensitive data from events before sending."""
    if "request" in event and "headers" in event["request"]:
        headers = event["request"]["headers"]
        for sensitive in ["Authorization", "Cookie", "X-Api-Key"]:
            headers.pop(sensitive, None)
    return event

# Flask alternative
from flask import Flask
from sentry_sdk.integrations.flask import FlaskIntegration

app = Flask(__name__)
sentry_sdk.init(
    dsn=os.environ["SENTRY_DSN"],
    integrations=[FlaskIntegration()],
    traces_sample_rate=0.1,
)

@app.errorhandler(500)
def handle_500(error):
    sentry_sdk.capture_exception(error)
    return {"error": "Internal server error"}, 500

# Manual context and capture
@app.route("/api/payments", methods=["POST"])
def process_payment():
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("payment.provider", "stripe")
        scope.set_context("payment", {"amount": request.json["amount"]})
        scope.set_user({"id": g.user_id})
        try:
            result = payment_service.charge(request.json)
            return jsonify(result), 200
        except PaymentError as e:
            sentry_sdk.capture_exception(e)
            return jsonify({"error": str(e)}), 402
```

### Go (HTTP Service)

```go
package main

import (
    "fmt"
    "net/http"
    "os"
    "time"

    "github.com/getsentry/sentry-go"
    sentryhttp "github.com/getsentry/sentry-go/http"
)

func main() {
    err := sentry.Init(sentry.ClientOptions{
        Dsn:              os.Getenv("SENTRY_DSN"),
        Release:          os.Getenv("RELEASE_VERSION"),
        Environment:      os.Getenv("GO_ENV"),
        TracesSampleRate: 0.1,
        // Scrub sensitive headers
        BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
            if event.Request != nil {
                delete(event.Request.Headers, "Authorization")
                delete(event.Request.Headers, "Cookie")
            }
            return event
        },
    })
    if err != nil {
        panic(fmt.Sprintf("sentry init failed: %v", err))
    }
    defer sentry.Flush(2 * time.Second)

    // Wrap HTTP handler with Sentry middleware
    handler := sentryhttp.New(sentryhttp.Options{
        Repanic: true, // re-panic after capture so recovery middleware works
    })

    mux := http.NewServeMux()
    mux.HandleFunc("GET /api/orders/{id}", getOrder)
    mux.HandleFunc("POST /api/orders", createOrder)

    http.ListenAndServe(":8080", handler.Handle(mux))
}

func getOrder(w http.ResponseWriter, r *http.Request) {
    // Sentry middleware automatically captures panics and creates transactions
    hub := sentry.GetHubFromContext(r.Context())
    if hub == nil {
        hub = sentry.CurrentHub().Clone()
    }

    hub.Scope().SetTag("order.id", r.PathValue("id"))
    hub.Scope().SetUser(sentry.User{ID: getUserID(r)})

    order, err := orderService.GetByID(r.Context(), r.PathValue("id"))
    if err != nil {
        hub.CaptureException(err)
        http.Error(w, "Internal server error", http.StatusInternalServerError)
        return
    }
    writeJSON(w, order)
}
```

---

## 3. Frontend Integration

### React ErrorBoundary

```typescript
// React — Sentry ErrorBoundary and browser SDK
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  release: process.env.REACT_APP_VERSION,
  environment: process.env.NODE_ENV,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({        // Session Replay — records DOM changes
      maskAllText: false,
      blockAllMedia: false,
      maskAllInputs: true,            // mask form inputs by default
    }),
    Sentry.feedbackIntegration(),      // user feedback widget
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.01,     // 1% of sessions recorded
  replaysOnErrorSampleRate: 1.0,      // 100% of error sessions recorded
  tracePropagationTargets: [
    'localhost',
    /^https:\/\/api\.example\.com/,   // propagate trace to API
  ],
});

// Wrap app with ErrorBoundary
function App() {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div><h2>Something went wrong</h2><button onClick={resetError}>Try again</button></div>
      )}
      showDialog={true}
    >
      <Router><Routes /></Router>
    </Sentry.ErrorBoundary>
  );
}
```

### Web Vitals and Custom Spans

```typescript
// browserTracingIntegration auto-captures: LCP, INP, CLS, TTFB, FCP

// Custom performance spans for business operations
function checkout() {
  return Sentry.startSpan({ name: 'checkout.process', op: 'business' }, async (span) => {
    await validateCart();
    span.setData('cart.items', cartItems.length);
    await Sentry.startSpan({ name: 'checkout.payment', op: 'http.client' }, () => processPayment());
  });
}
```

---

## 4. Performance Monitoring

```
SENTRY PERFORMANCE = lightweight APM built into the error tracking platform.

TRANSACTIONS:
  Top-level spans representing a complete operation.
  ├── HTTP request (backend): "GET /api/orders/{id}"
  ├── Page load (frontend): "/checkout"
  ├── Background job: "process_refund"
  └── Cron job: "daily_report"

SPANS:
  Child operations within a transaction.
  ├── Database query
  ├── HTTP client call
  ├── Cache lookup
  └── Custom business logic

WHEN TO USE SENTRY PERFORMANCE vs OTEL TRACING:
  Sentry performance: quick setup, integrated with error context,
                      good for teams not yet running full OTel stack.
  OTel tracing:       standard, vendor-neutral, full distributed tracing,
                      tail-based sampling, multiple backend export.
  RECOMMENDATION:     Use OTel for tracing; feed traces to Sentry via OTLP
                      for unified error + trace correlation.
```

---

## 5. Release Management

### Release Creation in CI/CD

```yaml
# GitHub Actions — Sentry release workflow
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      SENTRY_ORG: my-org
      SENTRY_PROJECT: order-service
      SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
      VERSION: ${{ github.sha }}
    steps:
      - uses: actions/checkout@v4

      - name: Build
        run: npm run build

      - name: Create Sentry release
        run: |
          npx @sentry/cli releases new "$VERSION"
          npx @sentry/cli releases set-commits "$VERSION" --auto

      - name: Upload source maps
        run: |
          npx @sentry/cli releases files "$VERSION" upload-sourcemaps \
            --url-prefix "~/static/js" \
            ./build/static/js/
          # Delete source maps from build output (do not deploy them)
          find ./build -name "*.map" -delete

      - name: Deploy
        run: kubectl set image deployment/order-service app=order-service:$VERSION

      - name: Finalize release and mark deploy
        run: |
          npx @sentry/cli releases finalize "$VERSION"
          npx @sentry/cli releases deploys "$VERSION" new \
            -e production \
            --started "$(date -u +%s)"
```

### Deploy Tracking

```
DEPLOY MARKERS IN SENTRY:
  Each deploy is recorded with timestamp and environment.
  Sentry shows vertical deploy lines on error frequency charts.
  Enables:
  ├── "Errors started after this deploy" visual correlation
  ├── "New issues in this release" filtered view
  ├── Crash-free sessions/users per release
  └── Automatic regression detection (resolved → reopened)
```

---

## 6. Issue Management

```
RESOLVE STATES:
  ┌──────────────────────────────────────────────────────────────┐
  │ Resolve → Resolved (watches for regression)                  │
  │ Resolve in Next Release → resolved when next release ships   │
  │ Resolve in Commit → resolved when specific commit deploys    │
  │ Ignore → snoozed (reappears after time/count threshold)      │
  │ Archive → permanently hidden from default views              │
  └──────────────────────────────────────────────────────────────┘

AUTO-ASSIGNMENT:
  Configure ownership rules based on file paths or URL patterns:
  ┌─────────────────────────────────────────────────────────────┐
  │ # Ownership Rules                                           │
  │ path:src/payments/*     team:payments                       │
  │ path:src/orders/*       team:orders                         │
  │ url:/api/auth/*         user:alice@company.com              │
  │ tags.service:checkout   team:checkout                       │
  └─────────────────────────────────────────────────────────────┘

SUSPECT COMMITS:
  Sentry identifies which commit likely introduced the error
  by matching stack trace file paths to recent git commits.
  Requires: set-commits during release creation (see CI/CD section).
```

---

## 7. Alert Rules

### Issue Alerts

```yaml
# Sentry alert rule — notify on new high-severity issues
Type: Issue Alert
Conditions:
  - Event is first seen
  - Event level is ERROR or FATAL
  - Event attribute service NOT IN [batch-jobs, cron]
Actions:
  - Send Slack notification to #errors-production
  - Assign to suggested owner (based on ownership rules)
```

### Metric Alerts

```yaml
# Sentry metric alert — error rate spike detection
Type: Metric Alert
Metric: count() of events with level:error
Threshold:
  Critical: > 50 events in 5 minutes (resolve when < 20)
  Warning: > 20 events in 5 minutes (resolve when < 10)
Trigger Actions:
  Critical: PagerDuty escalation
  Warning: Slack notification to #errors-production
```

### Spike Detection

```
SENTRY SPIKE PROTECTION:
  Automatically detects when error volume spikes abnormally.
  ├── Compares current rate to historical baseline
  ├── Drops events that exceed the spike threshold
  ├── Prevents a single incident from consuming the entire quota
  └── Sends notification about the spike

CUSTOM SPIKE ALERT:
  Metric alert on "percent change" — triggers when error rate
  increases by > 200% compared to same period last week.
```

---

## 8. Sentry + OpenTelemetry Integration

```typescript
// Feed OTel traces to Sentry (recommended approach in 2025+)
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Sentry SDK acts as OTel-compatible trace provider
  // Spans and transactions appear in Sentry Performance
  instrumenter: 'otel',   // use OTel as the instrumentation source
  tracesSampleRate: 1.0,  // let OTel sampler handle sampling
});

// Alternative: export OTel traces to Sentry via OTLP
// Configure OTel Collector to export to Sentry's OTLP endpoint
```

```yaml
# OTel Collector — export traces to Sentry via OTLP
exporters:
  otlp/sentry:
    endpoint: "https://sentry.io/api/PROJECT_ID/envelope/"
    headers:
      "sentry-key": "${SENTRY_DSN_PUBLIC_KEY}"
    compression: gzip

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp/sentry, otlp/tempo]  # dual export
```

---

## 9. Alternatives Comparison

| Feature                 | Sentry          | Bugsnag         | Rollbar         | Datadog ET       | Highlight.io     |
|-------------------------|-----------------|-----------------|-----------------|------------------|------------------|
| Open source             | Yes (self-host) | No              | No              | No               | Yes              |
| Error tracking          | Excellent       | Excellent       | Good            | Good             | Good             |
| Performance monitoring  | Good            | Basic           | No              | Excellent (APM)  | Good             |
| Session replay          | Yes             | No              | No              | Yes              | Yes              |
| Source maps             | Yes             | Yes             | Yes             | Yes              | Yes              |
| Release tracking        | Excellent       | Good            | Good            | Good             | Basic            |
| OTel integration        | Yes (native)    | Limited         | Limited         | Yes (native)     | Yes              |
| Frontend SDK quality    | Excellent       | Good            | Good            | Good             | Excellent        |
| Pricing model           | Events-based    | Events-based    | Events-based    | Host-based (+)   | Sessions-based   |
| Self-hosted option      | Yes             | No              | No              | No               | Yes              |

```
WHEN TO CHOOSE:
  Sentry:       Best all-around error tracking. Strong frontend + backend.
                Self-hosted option. OTel-native.
  Bugsnag:      Mobile-first teams. Strong React Native / iOS / Android.
  Datadog ET:   Already using Datadog APM. Unified platform value.
  Highlight.io: Open-source alternative. Session replay + errors + logs.
  Rollbar:      Simple setup, good for smaller teams.
```

---

## 10. Self-Hosted Sentry

```
WHEN TO SELF-HOST:
  ├── Data sovereignty (GDPR, healthcare, government)
  ├── Air-gapped environments | Cost optimization at >100M events/month

REQUIREMENTS: PostgreSQL, Redis, Kafka, ClickHouse, Snuba
  Minimum: 16GB RAM, 4 CPU, 100GB SSD
  Deploy: git clone getsentry/self-hosted → ./install.sh → docker compose up -d
  Maintain: upgrade monthly, monitor disk, configure retention (default 90d)
```

---

## 11. Cost Optimization

```
STRATEGIES:
  1. CLIENT-SIDE SAMPLING: tracesSampleRate 0.01-0.1 (errors always captured)
  2. BEFORE-SEND FILTERING: return null for non-actionable errors (not billed)
  3. INBOUND FILTERS: filter by browser, OS, release in Sentry UI
  4. RATE LIMITING: per-project caps prevent single service consuming quota
  5. RELEASE-BASED SAMPLING: higher rate for new releases, lower for stable
```

```typescript
// Client-side filtering — drop non-actionable events before sending
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  beforeSend(event, hint) {
    const error = hint.originalException as Error;
    if (error?.message?.includes('ResizeObserver loop')) return null;
    if (error?.message?.includes('Load failed')) return null;
    const ua = event.request?.headers?.['user-agent'] || '';
    if (/bot|crawler|spider/i.test(ua)) return null;
    return event;
  },
});
```

---

## Best Practices

| #  | Practice                                      | Description                                                                                       |
|----|-----------------------------------------------|---------------------------------------------------------------------------------------------------|
| 1  | Initialize SDK before all other imports        | SDK must load first to capture early errors and instrument modules.                                |
| 2  | Set release and environment on every SDK       | Required for regression detection, deploy correlation, and environment filtering.                   |
| 3  | Upload source maps in CI/CD                   | Automate upload with `sentry-cli`. Delete `.map` files before deployment.                          |
| 4  | Scrub PII in `beforeSend`                     | Remove authorization headers, cookies, and personal data before events leave the client.           |
| 5  | Configure ownership rules                     | Auto-assign issues to the correct team based on file paths, URLs, or tags.                         |
| 6  | Use `ignoreErrors` for known noise            | Filter browser noise (ResizeObserver, chunk loading) to keep issue list actionable.                 |
| 7  | Enable Session Replay on error sessions       | Set `replaysOnErrorSampleRate: 1.0` to capture DOM replay for every error. Invaluable for frontend.|
| 8  | Integrate with OTel for backend tracing       | Use Sentry's OTel integration or export OTel traces to Sentry for unified error + trace view.      |
| 9  | Set up metric alerts, not just issue alerts   | Issue alerts catch new errors. Metric alerts catch volume spikes in existing errors.                |
| 10 | Review quota usage weekly                     | Monitor events consumed vs plan limit. Adjust sampling and filters to avoid overages.              |

---

## Anti-Patterns

| #  | Anti-Pattern                              | Problem                                                        | Fix                                                            |
|----|-------------------------------------------|----------------------------------------------------------------|----------------------------------------------------------------|
| 1  | Capturing expected errors (4xx)           | Noise overwhelms real errors; quota consumed by non-bugs       | Only capture unexpected errors; log expected errors separately  |
| 2  | No `beforeSend` scrubbing                 | PII (tokens, emails) stored in Sentry — compliance violation   | Implement `beforeSend` to strip sensitive headers and data      |
| 3  | Missing source maps                       | Minified stack traces are undebuggable                         | Add `sentry-cli` source map upload to every CI/CD build         |
| 4  | SDK initialized too late                  | Early startup errors not captured                              | Import Sentry instrumentation as the very first module          |
| 5  | One Sentry project for all services       | Cannot filter, assign, or manage issues per service            | Create one Sentry project per deployable service                |
| 6  | Ignoring Sentry alerts (alert fatigue)    | Real errors missed because team stopped checking               | Tune alert rules; suppress noise; use escalation policies       |
| 7  | No release tracking configured            | Cannot correlate errors with deploys; no regression detection  | Set `release` in SDK init; run `sentry-cli releases` in CI/CD   |
| 8  | Self-hosting without maintenance plan     | Database fills up; upgrades skipped; security patches missed   | Assign ownership; schedule monthly upgrades; monitor disk usage |

---

## Enforcement Checklist

```
SDK SETUP:
  [ ] Sentry SDK initialized as first import in every service
  [ ] DSN configured via environment variable (not hardcoded)
  [ ] release set to CI version / git SHA
  [ ] environment set (production, staging, development)
  [ ] beforeSend scrubs PII (auth headers, cookies, personal data)
  [ ] ignoreErrors filters known non-actionable browser errors
  [ ] tracesSampleRate set (0.01-0.1 for production)

FRONTEND:
  [ ] ErrorBoundary wraps top-level React/Vue/Angular component
  [ ] Session Replay enabled (1% normal, 100% on error)
  [ ] tracePropagationTargets configured for API endpoints
  [ ] Source maps uploaded in CI/CD; NOT deployed to production

BACKEND:
  [ ] Framework middleware installed (Express, Django, Fastify, etc.)
  [ ] Unhandled exceptions captured automatically
  [ ] Manual capture with context for business-critical errors
  [ ] OTel integration configured for trace correlation

RELEASES:
  [ ] sentry-cli creates release in CI/CD pipeline
  [ ] Source maps uploaded to release
  [ ] Commits associated with release (set-commits --auto)
  [ ] Deploy marker created after successful deployment

ALERTS:
  [ ] Issue alert for new high-severity errors
  [ ] Metric alert for error rate spikes
  [ ] Ownership rules configured for auto-assignment
  [ ] PagerDuty / Slack integration for critical alerts

OPERATIONS:
  [ ] Quota usage monitored and reviewed weekly
  [ ] Rate limits set per project to prevent quota exhaustion
  [ ] Inbound filters enabled for bots, old browsers, known noise
  [ ] Self-hosted: upgrade schedule, backup plan, disk monitoring
```
