# Monitoring & Logging — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to set up Sentry?", "error tracking frontend", "frontend monitoring", "source maps production", "session replay", "LogRocket setup", "web vitals monitoring", "error alerting", "structured logging", "custom error classes", or any monitoring/logging question, ALWAYS consult this directive. Monitoring is how you discover bugs BEFORE users report them. ALWAYS use Sentry for error tracking — it is the industry standard for frontend applications. ALWAYS upload source maps to Sentry but NEVER expose them publicly. ALWAYS capture user context and breadcrumbs with errors. NEVER log PII (emails, passwords) in error reports.

**Core Rule: EVERY production frontend MUST have error monitoring (Sentry) with source maps, breadcrumbs, and user context. Errors MUST be categorized by severity (fatal, error, warning, info) and aggregated with alert thresholds. ALWAYS upload source maps to Sentry during build — NEVER serve source maps publicly. EVERY error report MUST include: error message, stack trace, breadcrumbs (user actions before error), browser/OS info, and user ID (NOT email/name — protect PII).**

---

## 1. Error Monitoring Architecture

```
  FRONTEND MONITORING STACK

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  BROWSER                                             │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Sentry SDK                                   │  │
  │  │  ┌──────────────────┐ ┌──────────────────┐    │  │
  │  │  │ Error Tracking   │ │ Performance      │    │  │
  │  │  │ • Exceptions     │ │ • Web Vitals     │    │  │
  │  │  │ • Unhandled      │ │ • Transaction    │    │  │
  │  │  │   rejections     │ │   traces         │    │  │
  │  │  │ • Console errors │ │ • Resource timing│    │  │
  │  │  └──────────────────┘ └──────────────────┘    │  │
  │  │  ┌──────────────────┐ ┌──────────────────┐    │  │
  │  │  │ Breadcrumbs      │ │ Session Replay   │    │  │
  │  │  │ • Clicks         │ │ • DOM recording  │    │  │
  │  │  │ • Navigation     │ │ • Network log    │    │  │
  │  │  │ • XHR/fetch      │ │ • Console log    │    │  │
  │  │  │ • Console logs   │ │ • User actions   │    │  │
  │  │  └──────────────────┘ └──────────────────┘    │  │
  │  └────────────────────────────────────────────────┘  │
  │                          │                           │
  │                          ▼                           │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  SENTRY SERVER                                │  │
  │  │  ┌────────────┐ ┌────────────┐ ┌───────────┐  │  │
  │  │  │ Issue      │ │ Source Map │ │ Alerts    │  │  │
  │  │  │ Grouping   │ │ Symbolica-│ │ (Slack,   │  │  │
  │  │  │ & Dedup    │ │ tion      │ │  Email,   │  │  │
  │  │  │            │ │            │ │  PagerDuty)│  │  │
  │  │  └────────────┘ └────────────┘ └───────────┘  │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

---

## 2. Sentry Setup

### 2.1 React + Sentry

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.VITE_APP_VERSION,           // e.g., "1.2.3"

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay
  replaysSessionSampleRate: 0.1,                   // 10% of sessions
  replaysOnErrorSampleRate: 1.0,                   // 100% of error sessions

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,                          // mask PII
      blockAllMedia: false,
      maskAllInputs: true,                         // ALWAYS mask input values
    }),
    Sentry.feedbackIntegration({
      colorScheme: 'system',
    }),
  ],

  // Filter noise
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error exception captured',
    'Non-Error promise rejection captured',
    /Loading chunk \d+ failed/,                    // lazy load failures
    /Network request failed/,                      // transient network issues
  ],

  // Don't send errors in development
  enabled: process.env.NODE_ENV === 'production',

  beforeSend(event) {
    // Scrub PII
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    return event;
  },
});
```

### 2.2 Next.js + Sentry

```typescript
// sentry.client.config.ts (Next.js)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration(),
  ],
});
```

```typescript
// next.config.js
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(nextConfig, {
  org: 'my-org',
  project: 'my-frontend',
  silent: true,

  // Source maps
  widenClientFileUpload: true,
  hideSourceMaps: true,               // IMPORTANT: don't expose source maps
  disableLogger: true,
  automaticVercelMonitors: true,
});
```

### 2.3 Sentry Error Boundary Integration

```tsx
import * as Sentry from '@sentry/react';
import { ErrorBoundary } from 'react-error-boundary';

function App() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        Sentry.withScope((scope) => {
          scope.setTag('error_boundary', 'app');
          scope.setExtra('componentStack', errorInfo.componentStack);
          Sentry.captureException(error);
        });
      }}
    >
      <AppContent />
    </ErrorBoundary>
  );
}

// Or use Sentry's built-in error boundary
function AppWithSentryBoundary() {
  return (
    <Sentry.ErrorBoundary
      fallback={<ErrorFallback />}
      showDialog                        // show feedback dialog on error
    >
      <AppContent />
    </Sentry.ErrorBoundary>
  );
}
```

---

## 3. Source Maps in Production

```
  SOURCE MAP SECURITY

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  BUILD OUTPUT:                                       │
  │  app.js          ← minified code (PUBLIC)            │
  │  app.js.map      ← source map (PRIVATE!)             │
  │                                                      │
  │  WRONG: Serve source maps publicly                   │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  //# sourceMappingURL=app.js.map              │  │
  │  │  → Anyone can download your original source!   │  │
  │  │  → Exposes business logic, API keys, comments  │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RIGHT: Upload to Sentry, strip from production      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  1. Build with source maps                    │  │
  │  │  2. Upload maps to Sentry (CI/CD)             │  │
  │  │  3. Delete .map files from deployment         │  │
  │  │  4. Sentry uses maps to symbolicate errors    │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

```bash
# Upload source maps to Sentry in CI
npx @sentry/cli sourcemaps upload \
  --org my-org \
  --project my-frontend \
  --release $APP_VERSION \
  ./dist

# Delete source maps from deployment
rm -rf ./dist/**/*.map
```

```yaml
# GitHub Actions: upload source maps
- name: Build
  run: npm run build

- name: Upload source maps to Sentry
  run: npx @sentry/cli sourcemaps upload --release ${{ github.sha }} ./dist
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: my-org
    SENTRY_PROJECT: my-frontend

- name: Remove source maps from deployment
  run: find ./dist -name "*.map" -delete

- name: Deploy
  run: # deploy dist/ without .map files
```

---

## 4. Structured Error Tracking

### 4.1 Custom Error Classes

```typescript
// errors/index.ts
export class AppError extends Error {
  public readonly code: string;
  public readonly severity: 'fatal' | 'error' | 'warning' | 'info';
  public readonly context: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    severity: 'fatal' | 'error' | 'warning' | 'info' = 'error',
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.severity = severity;
    this.context = context;
  }
}

export class NetworkError extends AppError {
  constructor(url: string, status: number, message?: string) {
    super(
      message || `Network request failed: ${status}`,
      'NETWORK_ERROR',
      status >= 500 ? 'error' : 'warning',
      { url, status }
    );
    this.name = 'NetworkError';
  }
}

export class ValidationError extends AppError {
  constructor(field: string, message: string) {
    super(message, 'VALIDATION_ERROR', 'warning', { field });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTH_ERROR', 'warning');
    this.name = 'AuthenticationError';
  }
}
```

### 4.2 Error Reporting with Context

```typescript
// Capture errors with rich context
import * as Sentry from '@sentry/react';
import { AppError } from './errors';

export function reportError(error: Error, extra?: Record<string, unknown>) {
  if (error instanceof AppError) {
    Sentry.withScope((scope) => {
      scope.setLevel(error.severity);
      scope.setTag('error_code', error.code);
      scope.setContext('error_context', error.context);

      if (extra) {
        scope.setExtras(extra);
      }

      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error, { extra });
  }
}

// Set user context (for all subsequent errors)
export function setUserContext(user: { id: string; role: string }) {
  Sentry.setUser({
    id: user.id,                                    // OK to include
    // email: user.email,                           // NEVER include PII
    // name: user.name,                             // NEVER include PII
  });

  Sentry.setTag('user_role', user.role);
}

// Add breadcrumbs for user actions
export function trackUserAction(action: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    category: 'user_action',
    message: action,
    data,
    level: 'info',
  });
}
```

### 4.3 API Error Handling

```typescript
// api/client.ts
import { NetworkError, AuthenticationError } from '../errors';
import { reportError } from '../monitoring';

async function apiClient<T>(url: string, options?: RequestInit): Promise<T> {
  // Add breadcrumb
  Sentry.addBreadcrumb({
    category: 'http',
    message: `${options?.method || 'GET'} ${url}`,
    level: 'info',
  });

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new AuthenticationError();
      }

      const body = await response.json().catch(() => ({}));
      throw new NetworkError(url, response.status, body.message);
    }

    return response.json();
  } catch (error) {
    if (error instanceof AppError) {
      reportError(error);
      throw error;
    }

    // Network failure (no response)
    const networkError = new NetworkError(url, 0, 'Network request failed');
    reportError(networkError);
    throw networkError;
  }
}
```

---

## 5. Performance Monitoring

### 5.1 Web Vitals to Sentry

```typescript
// Report Core Web Vitals to Sentry
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';
import * as Sentry from '@sentry/react';

function reportWebVitals() {
  onCLS((metric) => {
    Sentry.metrics.distribution('web_vital.cls', metric.value, {
      tags: { page: window.location.pathname },
    });
  });

  onINP((metric) => {
    Sentry.metrics.distribution('web_vital.inp', metric.value, {
      tags: { page: window.location.pathname },
    });
  });

  onLCP((metric) => {
    Sentry.metrics.distribution('web_vital.lcp', metric.value, {
      tags: { page: window.location.pathname },
    });
  });

  onFCP((metric) => {
    Sentry.metrics.distribution('web_vital.fcp', metric.value, {
      tags: { page: window.location.pathname },
    });
  });

  onTTFB((metric) => {
    Sentry.metrics.distribution('web_vital.ttfb', metric.value, {
      tags: { page: window.location.pathname },
    });
  });
}

// Call once on app initialization
reportWebVitals();
```

### 5.2 Custom Performance Spans

```typescript
// Track custom operations
async function loadDashboardData() {
  const transaction = Sentry.startTransaction({
    name: 'dashboard.load',
    op: 'page.load',
  });

  try {
    const usersSpan = transaction.startChild({
      op: 'http.client',
      description: 'GET /api/users',
    });
    const users = await fetchUsers();
    usersSpan.finish();

    const metricsSpan = transaction.startChild({
      op: 'http.client',
      description: 'GET /api/metrics',
    });
    const metrics = await fetchMetrics();
    metricsSpan.finish();

    return { users, metrics };
  } finally {
    transaction.finish();
  }
}
```

---

## 6. Session Replay

```
  SESSION REPLAY — WHAT IT CAPTURES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  DOM Changes:   Every mutation recorded as patches   │
  │  Network:       All XHR/fetch requests + responses   │
  │  Console:       console.log, error, warn             │
  │  User Actions:  Clicks, input, scrolls, navigation   │
  │                                                      │
  │  PRIVACY:                                            │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ✓ Input values masked by default             │  │
  │  │  ✓ Text can be masked (maskAllText: true)     │  │
  │  │  ✓ Media blocked if needed                    │  │
  │  │  ✓ Custom CSS selectors for masking           │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  SAMPLING:                                           │
  │  replaysSessionSampleRate: 0.1   (10% of sessions)  │
  │  replaysOnErrorSampleRate: 1.0   (100% of errors)   │
  │                                                      │
  │  USE CASE: See EXACTLY what user did before error    │
  └──────────────────────────────────────────────────────┘
```

```typescript
// Sentry Replay configuration
Sentry.replayIntegration({
  maskAllText: false,                  // set true for strict PII requirements
  maskAllInputs: true,                 // ALWAYS mask input values
  blockAllMedia: false,

  // Custom masking
  mask: ['.pii-field', '[data-sentry-mask]'],
  block: ['.video-player', 'iframe'],

  // Network body capture (careful with PII)
  networkDetailAllowUrls: ['/api/'],
  networkDetailDenyUrls: ['/api/auth/'],
  networkCaptureBodies: true,
  networkRequestHeaders: ['X-Request-Id'],
  networkResponseHeaders: ['X-Request-Id'],
});
```

---

## 7. Alerting Strategy

```
  ALERT SEVERITY LEVELS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  P1 — CRITICAL (PagerDuty, immediate)                │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • Error rate > 5% of requests                │  │
  │  │  • Auth system failures                       │  │
  │  │  • Payment processing errors                  │  │
  │  │  • App crash rate > 1%                        │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  P2 — HIGH (Slack alert, respond within 1 hour)      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • New error type with 50+ occurrences        │  │
  │  │  • API error rate > 1%                        │  │
  │  │  • Web Vitals regression (LCP > 4s)           │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  P3 — MEDIUM (Slack, respond within 1 day)           │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • New error type with 10+ occurrences        │  │
  │  │  • Console errors in production               │  │
  │  │  • Deprecation warnings                       │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  P4 — LOW (Weekly digest)                            │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • Rare errors (< 10 occurrences/week)        │  │
  │  │  • Browser compatibility issues               │  │
  │  │  • Performance suggestions                    │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

---

## 8. Development Logging

```typescript
// logger.ts — structured console logging for development
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_STYLES: Record<LogLevel, string> = {
  debug: 'color: #8B8B8B',
  info: 'color: #2196F3',
  warn: 'color: #FF9800',
  error: 'color: #F44336; font-weight: bold',
};

class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  debug(message: string, data?: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`%c[${this.context}] ${message}`, LOG_STYLES.debug, data ?? '');
    }
  }

  info(message: string, data?: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.info(`%c[${this.context}] ${message}`, LOG_STYLES.info, data ?? '');
    }
  }

  warn(message: string, data?: unknown) {
    console.warn(`[${this.context}] ${message}`, data ?? '');
    Sentry.addBreadcrumb({ category: this.context, message, level: 'warning' });
  }

  error(message: string, error?: Error, data?: unknown) {
    console.error(`[${this.context}] ${message}`, error, data ?? '');
    if (error) {
      reportError(error, { context: this.context, message, ...data as object });
    }
  }
}

// Usage
const logger = new Logger('AuthService');
logger.info('Login attempt', { email: 'user@***' });
logger.error('Login failed', new Error('Invalid credentials'));
```

---

## 9. Privacy Considerations

```
  PII IN ERROR REPORTS — WHAT TO PROTECT

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  NEVER LOG:                                          │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ✗ Email addresses                            │  │
  │  │  ✗ Full names                                 │  │
  │  │  ✗ Phone numbers                              │  │
  │  │  ✗ Passwords / tokens                         │  │
  │  │  ✗ Credit card numbers                        │  │
  │  │  ✗ IP addresses (debatable — check GDPR)      │  │
  │  │  ✗ Session cookies                            │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  OK TO LOG:                                          │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ✓ User ID (opaque identifier)                │  │
  │  │  ✓ User role (admin, editor, viewer)          │  │
  │  │  ✓ Page URL (without query params)            │  │
  │  │  ✓ Browser / OS / device info                 │  │
  │  │  ✓ Error messages and stack traces            │  │
  │  │  ✓ Request paths (without sensitive params)   │  │
  │  │  ✓ Feature flags / experiment groups          │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

```typescript
// Scrub PII from Sentry events
Sentry.init({
  beforeSend(event) {
    // Remove cookies
    if (event.request?.cookies) {
      delete event.request.cookies;
    }

    // Scrub query parameters
    if (event.request?.query_string) {
      event.request.query_string = '[REDACTED]';
    }

    // Mask email patterns in breadcrumbs
    event.breadcrumbs = event.breadcrumbs?.map(crumb => ({
      ...crumb,
      message: crumb.message?.replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        '[EMAIL]'
      ),
    }));

    return event;
  },

  beforeBreadcrumb(breadcrumb) {
    // Don't capture input values in breadcrumbs
    if (breadcrumb.category === 'ui.input') {
      delete breadcrumb.data;
    }
    return breadcrumb;
  },
});
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **No error monitoring in production** | Bugs discovered only when users complain — days later | Set up Sentry with error boundaries on day 1 |
| **Source maps served publicly** | Anyone can download original source code via `//# sourceMappingURL` | Upload to Sentry, delete `.map` files from deployment |
| **Logging PII in errors** | User emails, names appear in Sentry reports — GDPR violation | Use `beforeSend` to scrub PII; log user ID only |
| **No error filtering** | Sentry flooded with ResizeObserver noise and browser extension errors | Configure `ignoreErrors` and `denyUrls` for known noise |
| **100% session replay sampling** | Bandwidth cost explodes; privacy risk increases | Use 10% session sampling, 100% error replay |
| **No alerting configured** | Errors pile up in Sentry but nobody checks until outage | Set up P1-P4 alert rules with Slack/PagerDuty integration |
| **Console.log in production** | `console.log('debug:', data)` ships to production — leaks info | Use structured logger; strip console.log in production build |
| **No breadcrumbs** | Error reports show exception but no context of what user was doing | Sentry auto-captures breadcrumbs; add custom ones for business actions |
| **Catching and swallowing errors** | `catch (e) { /* ignore */ }` — bugs never surface | ALWAYS log caught errors; re-throw or report to Sentry |
| **No performance monitoring** | No visibility into slow pages or regressions until users complain | Enable Sentry performance with Web Vitals integration |

---

## 11. Enforcement Checklist

### Error Monitoring Setup
- [ ] Sentry SDK installed and initialized for the correct framework
- [ ] DSN stored as environment variable (not hardcoded)
- [ ] Source maps uploaded to Sentry in CI/CD pipeline
- [ ] Source maps NOT served publicly (deleted from deployment)
- [ ] `release` set to app version/commit hash for tracking

### Error Quality
- [ ] Custom error classes for domain errors (NetworkError, AuthError)
- [ ] Errors include context: user ID, page, action that caused error
- [ ] `beforeSend` scrubs PII (emails, cookies, query params)
- [ ] `ignoreErrors` filters known noise (ResizeObserver, extensions)
- [ ] Error boundaries report to Sentry via `onError` callback

### Alerting
- [ ] P1 alerts configured for critical errors (auth, payment, crash rate)
- [ ] P2 alerts configured for high-frequency new errors
- [ ] Alert notifications sent to Slack/Teams/PagerDuty
- [ ] Weekly error digest reviewed by engineering team

### Performance
- [ ] Web Vitals (LCP, INP, CLS) reported to monitoring
- [ ] Performance sampling rate configured (10% production)
- [ ] Slow transaction alerts configured
- [ ] Session replay enabled for error sessions (100%)

### Privacy
- [ ] No PII in error reports (emails, names, passwords)
- [ ] Input values masked in session replay
- [ ] Cookie data excluded from error reports
- [ ] Data retention policy configured in Sentry
