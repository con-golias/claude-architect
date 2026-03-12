# Data-Driven Development & Product Decisions

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Analytics & Telemetry |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Product Analytics](product-analytics.md), [A/B Testing](ab-testing.md) |

---

## Core Concepts

### Data-Informed vs Data-Driven

| Approach | Description | When to Use |
|----------|-------------|-------------|
| **Data-Driven** | Metrics dictate the decision; follow the numbers | Optimization (conversion funnels, pricing), well-understood domains |
| **Data-Informed** | Data is one input alongside intuition, UX research, strategy | New product areas, brand/design decisions, ethical considerations |
| **Opinion-Driven** | Decision based on experience/authority without data | Emergency response, zero-data situations, artistic direction |

Use data to **validate or invalidate** hypotheses, not to replace product judgment. The best teams are data-informed: they use quantitative signals alongside qualitative insights (user interviews, support tickets, domain expertise).

### Building a Metrics Culture

**North Star Metric:** A single metric that best captures the core value your product delivers to customers. Examples:
- Spotify: "Time spent listening"
- Slack: "Messages sent in team channels"
- Airbnb: "Nights booked"

**Leading vs Lagging Indicators:**

| Type | Definition | Examples |
|------|-----------|----------|
| **Leading** | Predictive; signals future outcomes | Feature adoption rate, onboarding completion, engagement frequency |
| **Lagging** | Historical; confirms past performance | Revenue, churn rate, NPS |

Focus engineering effort on leading indicators since they are actionable. Lagging indicators confirm whether leading indicator improvements translate to business outcomes.

**OKR Integration:**

```
Objective: Improve new user activation
  KR1: Increase onboarding completion from 45% to 65%    (leading)
  KR2: Increase D7 retention from 30% to 40%             (leading)
  KR3: Reduce time-to-first-value from 8 min to 3 min    (leading)
  KR4: Increase MAU from 50K to 75K                      (lagging)
```

### Instrumentation Strategy

Define what to track based on user journey stages and business questions.

**Event Schema Design (TypeScript):**

```typescript
// analytics/schema.ts
// Type-safe event definitions prevent tracking drift

interface EventMap {
  page_viewed: {
    page_name: string;
    referrer?: string;
    duration_ms?: number;
  };
  feature_used: {
    feature_name: string;
    action: "started" | "completed" | "abandoned";
    context: string;
  };
  search_performed: {
    query: string;
    results_count: number;
    filters_applied: string[];
  };
  error_encountered: {
    error_code: string;
    error_message: string;
    page: string;
    user_action: string;
  };
}

// Type-safe track function
function track<K extends keyof EventMap>(
  event: K,
  properties: EventMap[K]
): void {
  // Validate at compile time; send to analytics provider
  analyticsProvider.track({ name: event, properties });
}

// Usage - TypeScript enforces correct properties
track("feature_used", {
  feature_name: "export_csv",
  action: "completed",
  context: "dashboard",
});
```

**Data Quality Validation (Python):**

```python
# analytics/validation.py
from pydantic import BaseModel, validator
from datetime import datetime
from typing import Optional

class BaseEvent(BaseModel):
    event_name: str
    user_id: str
    timestamp: datetime
    session_id: str
    platform: str

    @validator("event_name")
    def validate_event_name(cls, v: str) -> str:
        """Enforce snake_case naming convention."""
        if not v.replace("_", "").isalnum() or v != v.lower():
            raise ValueError(
                f"Event name must be snake_case: got '{v}'"
            )
        return v

    @validator("platform")
    def validate_platform(cls, v: str) -> str:
        allowed = {"web", "ios", "android", "api", "server"}
        if v not in allowed:
            raise ValueError(f"Platform must be one of {allowed}")
        return v

class FeatureUsedEvent(BaseEvent):
    feature_name: str
    action: str
    context: Optional[str] = None

    @validator("action")
    def validate_action(cls, v: str) -> str:
        allowed = {"started", "completed", "abandoned"}
        if v not in allowed:
            raise ValueError(f"Action must be one of {allowed}")
        return v

# Validate incoming events at ingestion layer
def validate_event(raw: dict) -> BaseEvent:
    event_type = raw.get("event_name", "")
    registry = {
        "feature_used": FeatureUsedEvent,
    }
    model = registry.get(event_type, BaseEvent)
    return model(**raw)  # Raises ValidationError on bad data
```

### Analytics Engineering

Transform raw event data into analysis-ready datasets using modern data stack patterns.

**dbt Model for Funnel Analysis:**

```sql
-- models/funnels/onboarding_funnel.sql
-- dbt model: build daily onboarding funnel from raw events

WITH signup AS (
    SELECT user_id, MIN(timestamp) AS signup_at
    FROM {{ ref('stg_events') }}
    WHERE event_name = 'signup_completed'
    GROUP BY user_id
),
profile_created AS (
    SELECT user_id, MIN(timestamp) AS profile_at
    FROM {{ ref('stg_events') }}
    WHERE event_name = 'profile_created'
    GROUP BY user_id
),
first_action AS (
    SELECT user_id, MIN(timestamp) AS action_at
    FROM {{ ref('stg_events') }}
    WHERE event_name = 'first_key_action'
    GROUP BY user_id
)

SELECT
    s.user_id,
    s.signup_at,
    p.profile_at,
    f.action_at,
    CASE WHEN p.user_id IS NOT NULL THEN 1 ELSE 0 END AS completed_profile,
    CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END AS completed_first_action,
    DATEDIFF('minute', s.signup_at, f.action_at) AS time_to_value_minutes
FROM signup s
LEFT JOIN profile_created p ON s.user_id = p.user_id
LEFT JOIN first_action f ON s.user_id = f.user_id
```

### Dashboards

Build layered dashboards for different audiences.

| Dashboard Type | Audience | Content | Refresh Rate |
|---------------|----------|---------|-------------|
| **Executive** | C-suite, board | North Star, revenue, growth rate, NRR | Weekly |
| **Product** | PMs, designers | Funnels, activation, feature adoption, experiments | Daily |
| **Engineering** | Engineers, SRE | Error rates, latency, deployment frequency, DORA metrics | Real-time |
| **Operational** | Support, ops | Ticket volume, response time, user-reported issues | Real-time |

**Dashboard Design Principles:**
- One key metric per dashboard section (avoid wall-of-numbers)
- Always show trend over time (not just current snapshot)
- Include comparison period (week-over-week, month-over-month)
- Add annotations for deployments, incidents, and experiments
- Link from high-level metrics to drill-down views

### Decision Frameworks

**ICE Scoring:** Rate each initiative on Impact, Confidence, and Ease (1-10). Score = I * C * E.

```typescript
// decisions/ice.ts
interface Initiative {
  name: string;
  impact: number;     // 1-10: How much will this move the metric?
  confidence: number;  // 1-10: How sure are we about the impact?
  ease: number;        // 1-10: How easy is it to implement?
}

function iceScore(init: Initiative): number {
  return init.impact * init.confidence * init.ease;
}

function prioritize(initiatives: Initiative[]): Initiative[] {
  return [...initiatives].sort(
    (a, b) => iceScore(b) - iceScore(a)
  );
}

// Example
const backlog: Initiative[] = [
  { name: "Simplify onboarding",   impact: 9, confidence: 7, ease: 5 },
  { name: "Add dark mode",         impact: 3, confidence: 9, ease: 8 },
  { name: "Revamp search",         impact: 8, confidence: 5, ease: 3 },
  { name: "One-click export",      impact: 6, confidence: 8, ease: 9 },
];

prioritize(backlog);
// 1. One-click export (432), 2. Simplify onboarding (315),
// 3. Add dark mode (216), 4. Revamp search (120)
```

**RICE Scoring:** Reach * Impact * Confidence / Effort. Better for teams that need to account for how many users are affected.

**Opportunity Scoring (Outcome-Driven Innovation):**
Plot importance vs satisfaction for user needs. High importance + low satisfaction = biggest opportunity.

### Avoiding Data Pitfalls

| Pitfall | Description | Defense |
|---------|-------------|---------|
| **Confirmation Bias** | Seeking data that confirms pre-existing beliefs | Pre-register hypotheses; have skeptics review analysis |
| **Vanity Metrics** | Metrics that look good but do not drive decisions (total signups, page views) | Focus on actionable metrics (activation rate, retention) |
| **Goodhart's Law** | "When a measure becomes a target, it ceases to be a good measure" | Use balanced scorecards; rotate metrics; add guardrails |
| **Survivorship Bias** | Analyzing only successful users; ignoring churned ones | Include churned/inactive users in analysis |
| **Simpson's Paradox** | Aggregate trends reverse when data is segmented | Always segment by key dimensions before concluding |
| **Correlation vs Causation** | Assuming correlation implies causation | Use A/B tests for causal claims; be explicit about correlations |
| **Anchoring** | Over-relying on the first data point encountered | Present multiple data points; use statistical ranges |
| **Small Sample Fallacy** | Drawing conclusions from too little data | Define minimum sample sizes; use confidence intervals |

### Data Pipeline Architecture

```
[Client Events] --> [Event Collector API]
                         |
                    [Message Queue] (Kafka / SQS)
                         |
                  [Stream Processor] (Flink / Lambda)
                     /          \
            [Data Warehouse]   [Real-time Store]
            (BigQuery/         (Redis / ClickHouse)
             Snowflake)              |
                 |              [Live Dashboards]
            [dbt Models]
                 |
          [BI / Analytics]
          (Looker / Metabase)
```

---

## Best Practices

1. **Define your North Star metric and input metrics.** Align the entire product team around one metric that captures user value, with 3-5 input metrics that drive it.
2. **Instrument before you build.** Add tracking requirements to every feature spec. No feature is "done" until analytics are verified in production.
3. **Validate data at ingestion.** Use schema validation (Pydantic, JSON Schema) at the event collector to reject malformed events before they pollute the warehouse.
4. **Separate data collection from analysis.** Collect raw events immutably; transform them in dbt or analytics layer. Never modify raw data in place.
5. **Build self-serve dashboards.** Empower product managers and designers to answer their own questions without filing data requests.
6. **Review metrics in a weekly rhythm.** Hold a metrics review meeting where teams examine trends, anomalies, and experiment results against OKRs.
7. **Guard against Goodhart's Law.** Never optimize a single metric in isolation. Pair every target metric with guardrail metrics that must not degrade.
8. **Use leading indicators for roadmap prioritization.** Leading indicators are actionable; lagging indicators confirm strategy. Prioritize features that move leading indicators.
9. **Document data lineage.** For every dashboard metric, document the source events, transformations, and assumptions. This prevents "which number is right?" debates.
10. **Treat the tracking plan as a product.** Version it, review changes, assign an owner. A degraded tracking plan degrades every decision downstream.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Ship features without instrumentation | No way to measure impact; blind product decisions | Include tracking in Definition of Done |
| Dashboard overload (50+ metrics on one screen) | Analysis paralysis; nobody reads the dashboard | One key metric per section; layered drill-downs |
| Using only lagging indicators | Reactive instead of proactive; too late to course-correct | Pair each lagging metric with 2-3 leading indicators |
| Optimizing a single metric without guardrails | Gaming the metric degrades overall experience (Goodhart's Law) | Require guardrail metrics for every optimization |
| No data quality monitoring | Broken tracking goes undetected for weeks | Set up alerts for event volume anomalies and schema violations |
| HiPPO decisions (Highest Paid Person's Opinion) | Data investment wasted; decisions driven by authority, not evidence | Require data review in decision-making process |
| Copy-pasting SQL for every analysis | Inconsistent metric definitions; duplicated effort | Use dbt models as single source of truth for metrics |
| Treating all data as equally trustworthy | Bad data leads to bad decisions with false confidence | Label data quality tiers; flag metrics with known gaps |

---

## Enforcement Checklist

- [ ] North Star metric defined and visible to all teams
- [ ] OKRs include both leading and lagging indicators
- [ ] Tracking plan documented, versioned, and reviewed quarterly
- [ ] Type-safe event schemas enforced at compile time or ingestion
- [ ] dbt models (or equivalent) define canonical metric calculations
- [ ] Dashboards exist for executive, product, and engineering audiences
- [ ] Weekly metrics review meeting on the team calendar
- [ ] Data quality alerts configured for event volume and schema violations
- [ ] ICE/RICE scoring applied to prioritize backlog items
- [ ] All feature specs include instrumentation requirements
