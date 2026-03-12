# Product Analytics & Metrics

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Analytics & Telemetry |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [A/B Testing](ab-testing.md), [Data-Driven Development](data-driven-development.md) |

---

## Core Concepts

### Key Product Metrics

Track metrics that directly measure product health and user value.

**Engagement Metrics:**
- **DAU/MAU (Daily/Monthly Active Users):** Measure breadth of engagement. DAU/MAU ratio (stickiness) above 20% is good; above 50% is exceptional (e.g., messaging apps).
- **Session Duration & Frequency:** How long and how often users engage.
- **Feature Adoption Rate:** Percentage of users using a specific feature within a time window.

**Retention & Churn:**
- **Retention Curve:** Plot percentage of users returning on Day 1, 7, 14, 30. A flattening curve indicates product-market fit.
- **Churn Rate:** `(Users lost in period) / (Users at start of period)`. Track both voluntary and involuntary churn.
- **Net Revenue Retention (NRR):** For SaaS: `(Starting MRR + Expansion - Contraction - Churn) / Starting MRR`. Above 120% is best-in-class.

**Satisfaction Metrics:**
- **NPS (Net Promoter Score):** "How likely are you to recommend?" (0-10). Promoters (9-10) minus Detractors (0-6).
- **CSAT (Customer Satisfaction Score):** Direct satisfaction rating, typically 1-5 scale.
- **CES (Customer Effort Score):** How easy was it to accomplish a task.

### Pirate Metrics (AARRR Framework)

| Stage | Metric | Example |
|-------|--------|---------|
| **Acquisition** | Where do users come from? | Channel conversion rates, CAC |
| **Activation** | Do users reach the "aha moment"? | Onboarding completion, first key action |
| **Retention** | Do users come back? | D7/D30 retention, cohort curves |
| **Revenue** | Do users pay? | ARPU, LTV, conversion to paid |
| **Referral** | Do users invite others? | Viral coefficient, referral rate |

### Event Tracking Architecture

Define a structured event taxonomy before implementing any tracking.

**Event Naming Convention:**
```
<object>_<action> (snake_case)
```

Examples: `page_viewed`, `button_clicked`, `checkout_completed`, `subscription_upgraded`.

**Tracking Plan Structure:**

| Event Name | Trigger | Properties | Owner |
|------------|---------|------------|-------|
| `signup_completed` | User finishes registration | `method`, `referral_source` | Growth |
| `feature_used` | User interacts with feature | `feature_name`, `context` | Product |
| `purchase_completed` | Payment succeeds | `plan`, `amount`, `currency` | Revenue |

### Implementing Event Tracking (TypeScript)

```typescript
// analytics/tracker.ts - Unified analytics interface
interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp?: Date;
  userId?: string;
}

interface AnalyticsProvider {
  identify(userId: string, traits?: Record<string, unknown>): void;
  track(event: AnalyticsEvent): void;
  page(name: string, properties?: Record<string, unknown>): void;
}

// PostHog implementation
import posthog from "posthog-js";

class PostHogProvider implements AnalyticsProvider {
  constructor(apiKey: string, host: string) {
    posthog.init(apiKey, { api_host: host });
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    posthog.identify(userId, traits);
  }

  track(event: AnalyticsEvent): void {
    posthog.capture(event.name, event.properties);
  }

  page(name: string, properties?: Record<string, unknown>): void {
    posthog.capture("$pageview", { page_name: name, ...properties });
  }
}

// Amplitude implementation
import * as amplitude from "@amplitude/analytics-browser";

class AmplitudeProvider implements AnalyticsProvider {
  constructor(apiKey: string) {
    amplitude.init(apiKey);
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    amplitude.setUserId(userId);
    if (traits) {
      const identifyEvent = new amplitude.Identify();
      Object.entries(traits).forEach(([k, v]) =>
        identifyEvent.set(k, v as string)
      );
      amplitude.identify(identifyEvent);
    }
  }

  track(event: AnalyticsEvent): void {
    amplitude.track(event.name, event.properties);
  }

  page(name: string, properties?: Record<string, unknown>): void {
    amplitude.track("Page Viewed", { page_name: name, ...properties });
  }
}

// Multi-provider tracker with consent management
class AnalyticsTracker {
  private providers: AnalyticsProvider[] = [];
  private consentGiven = false;
  private eventQueue: AnalyticsEvent[] = [];

  addProvider(provider: AnalyticsProvider): void {
    this.providers.push(provider);
  }

  setConsent(granted: boolean): void {
    this.consentGiven = granted;
    if (granted) this.flushQueue();
  }

  track(event: AnalyticsEvent): void {
    if (!this.consentGiven) {
      this.eventQueue.push(event);
      return;
    }
    this.providers.forEach((p) => p.track(event));
  }

  private flushQueue(): void {
    this.eventQueue.forEach((event) =>
      this.providers.forEach((p) => p.track(event))
    );
    this.eventQueue = [];
  }
}
```

### Server-Side Event Tracking (Python)

```python
# analytics/tracker.py
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
import httpx
import asyncio

@dataclass
class AnalyticsEvent:
    name: str
    user_id: str
    properties: dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

class ServerAnalytics:
    """Batch events and flush periodically for efficiency."""

    def __init__(self, api_key: str, endpoint: str, batch_size: int = 50):
        self.api_key = api_key
        self.endpoint = endpoint
        self.batch_size = batch_size
        self._buffer: list[AnalyticsEvent] = []

    def track(self, event: AnalyticsEvent) -> None:
        self._buffer.append(event)
        if len(self._buffer) >= self.batch_size:
            asyncio.create_task(self.flush())

    async def flush(self) -> None:
        if not self._buffer:
            return
        batch, self._buffer = self._buffer[:], []
        payload = [
            {
                "event": e.name,
                "user_id": e.user_id,
                "properties": e.properties,
                "timestamp": e.timestamp.isoformat(),
            }
            for e in batch
        ]
        async with httpx.AsyncClient() as client:
            await client.post(
                self.endpoint,
                json={"batch": payload},
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
```

### Cohort Analysis & Funnel Analysis

**Cohort Analysis:** Group users by shared characteristic (signup week, acquisition channel) and track behavior over time. Identify which cohorts retain better and why.

**Funnel Analysis:** Define a sequence of steps (e.g., Landing -> Signup -> Onboarding -> First Action -> Paid). Measure drop-off at each step to identify friction points.

```typescript
// Example: Define a funnel in PostHog (declarative)
const onboardingFunnel = {
  name: "User Onboarding",
  steps: [
    { event: "signup_completed" },
    { event: "profile_created" },
    { event: "first_project_created" },
    { event: "team_member_invited" },
  ],
  conversionWindow: { value: 7, unit: "days" },
};
```

### Privacy-First Analytics

| Principle | Implementation |
|-----------|---------------|
| Consent before tracking | Show cookie banner; queue events until consent granted |
| Data minimization | Track only what is needed; avoid PII in event properties |
| Anonymization | Hash or pseudonymize user IDs for analytics |
| Cookieless tracking | Use server-side analytics or fingerprint-free session IDs |
| Data retention | Auto-delete raw events after retention period (e.g., 13 months) |
| Right to erasure | Implement user data deletion API for GDPR/CCPA requests |

### Analytics Tools Comparison

| Tool | Type | Strengths | Pricing Model |
|------|------|-----------|---------------|
| **Amplitude** | Cloud SaaS | Behavioral analytics, strong cohort analysis | Free tier + usage-based |
| **Mixpanel** | Cloud SaaS | Funnel & retention analysis, interactive reports | Free tier + usage-based |
| **PostHog** | Open-source / Cloud | All-in-one (analytics, flags, replays), self-hostable | Free tier + usage-based |
| **Google Analytics 4** | Cloud SaaS | Web traffic, acquisition, free tier generous | Free + GA360 paid |
| **Heap** | Cloud SaaS | Auto-capture everything, retroactive analysis | Usage-based |
| **Plausible** | Open-source / Cloud | Privacy-first, lightweight, GDPR-compliant | Flat monthly |

---

## Best Practices

1. **Define a tracking plan before writing code.** Document every event, its trigger, properties, and owner. Treat the tracking plan as a living specification reviewed quarterly.
2. **Use a consistent naming convention.** Adopt `object_action` in snake_case across all events. Inconsistent naming leads to duplicate or unmatchable events.
3. **Track activation metrics first.** Identify the "aha moment" (the action that correlates with long-term retention) and instrument it before optimizing acquisition.
4. **Separate identity from behavior.** Use `identify()` for user traits (plan, role, company) and `track()` for actions. Never mix demographic data into event properties.
5. **Validate events in CI/CD.** Use schema validation (JSON Schema or TypeScript types) to catch tracking regressions before deployment.
6. **Implement server-side tracking for critical events.** Revenue events, subscription changes, and backend actions must not rely on client-side tracking that ad-blockers can suppress.
7. **Respect user privacy by default.** Collect the minimum data needed; never track PII in event properties; honor Do Not Track and consent preferences.
8. **Build dashboards for each AARRR stage.** Give every team visibility into their stage of the funnel with real-time or near-real-time dashboards.
9. **Review data quality monthly.** Check for null properties, unexpected event volumes, and tracking gaps. Assign a data quality owner.
10. **Version your tracking plan.** When event schemas change, version them (e.g., `checkout_completed_v2`) to avoid breaking historical analysis.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Track everything without a plan | Noise drowns signal; storage costs spike | Define a tracking plan; track only what informs decisions |
| PII in event properties | GDPR/CCPA violations; legal liability | Strip PII at ingestion; use pseudonymous IDs |
| Client-only tracking | 30-40% data loss from ad-blockers | Use server-side tracking for critical events |
| Vanity metrics focus | DAU without context misleads stakeholders | Pair vanity metrics with actionable metrics (retention, activation) |
| No event schema validation | Broken tracking goes unnoticed for weeks | Add CI checks for event schema compliance |
| Inconsistent naming | Duplicate events, broken funnels | Enforce naming convention via linter or SDK wrapper |
| Ignoring data retention | Storage bloat; compliance risk | Set auto-deletion policies; archive aggregated data |
| One dashboard for all audiences | Executives see noise; engineers miss detail | Build role-specific dashboards (exec, team, operational) |

---

## Enforcement Checklist

- [ ] Tracking plan documented and reviewed by product and engineering
- [ ] Event naming convention defined and enforced via SDK wrapper
- [ ] Consent management implemented (cookie banner, preference center)
- [ ] Server-side tracking in place for revenue and critical backend events
- [ ] Event schema validation running in CI/CD pipeline
- [ ] AARRR dashboards created and accessible to all stakeholders
- [ ] Data retention policy configured (auto-delete after N months)
- [ ] User data deletion endpoint implemented for GDPR/CCPA
- [ ] Monthly data quality review scheduled with assigned owner
- [ ] Analytics provider failover or multi-provider strategy in place
