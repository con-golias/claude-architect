# Webhook Design

> **Domain:** Backend > Webhooks
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Webhooks are the fundamental mechanism for event-driven communication between services. Instead of the consumer polling every X seconds (wasting bandwidth, adding latency), the producer sends an HTTP POST to the consumer as soon as something happens. Stripe, GitHub, Twilio, Shopify — every serious API uses webhooks. Poor design means lost events, duplicate processing, and broken integrations.

---

## How It Works

### Webhook System Architecture

```
┌─────────────┐     Event      ┌──────────────┐    HTTP POST    ┌──────────────┐
│   Source     │───────────────▶│   Webhook    │───────────────▶│   Consumer   │
│   System     │                │   Dispatcher  │                │   Endpoint   │
│  (e.g. DB   │                │              │                │              │
│   change)   │                │  ┌─────────┐ │   200 OK       │  ┌─────────┐ │
│             │                │  │ Queue   │ │◀───────────────│  │ Handler │ │
│             │                │  │ + Retry │ │                │  │ + Ack   │ │
│             │                │  └─────────┘ │                │  └─────────┘ │
└─────────────┘                └──────────────┘                └──────────────┘
```

### Basic Flow

1. **Event occurs** — an action in the system (payment completed, user created)
2. **Event captured** — stored in event store / queue
3. **Webhook dispatched** — HTTP POST to the registered consumer URL
4. **Consumer acknowledges** — 2xx response = success
5. **Retry on failure** — non-2xx or timeout triggers exponential backoff retry

### Event Payload Design

Two approaches:

| Approach | Description | Advantage | Disadvantage |
|----------|-----------|-------------|-------------|
| **Fat payload** | Entire resource in body | One request is enough | Larger payload, stale data risk |
| **Thin payload** | Only event type + resource ID | Small, secure | Consumer must make GET for details |
| **Hybrid** | Event type + key fields + link | Balanced | More complex schema |

**Recommendation:** Hybrid approach — send the key fields + link to full resource.

---

## Webhook Event Schema

### Standard Event Envelope

```typescript
// TypeScript — Event Schema
interface WebhookEvent<T = unknown> {
  id: string;              // Unique event ID (idempotency key)
  type: string;            // Event type: "order.completed"
  api_version: string;     // API version: "2024-01-15"
  created_at: string;      // ISO 8601 timestamp
  data: T;                 // Event-specific payload
  metadata?: {
    source: string;        // Service that generated the event
    correlation_id: string; // Trace correlation
    attempt: number;        // Delivery attempt number
  };
}

// Example: Order completed event
interface OrderCompletedData {
  order_id: string;
  customer_id: string;
  total_amount: number;
  currency: string;
  items_count: number;
  // Link to full resource
  resource_url: string;
}

// Concrete event
const event: WebhookEvent<OrderCompletedData> = {
  id: "evt_01HX7Y8Z9ABCDEF",
  type: "order.completed",
  api_version: "2024-01-15",
  created_at: "2024-03-15T10:30:00Z",
  data: {
    order_id: "ord_123",
    customer_id: "cust_456",
    total_amount: 9999,
    currency: "EUR",
    items_count: 3,
    resource_url: "https://api.example.com/v1/orders/ord_123",
  },
  metadata: {
    source: "order-service",
    correlation_id: "trace-abc-123",
    attempt: 1,
  },
};
```

```go
// Go — Event Schema
package webhooks

import "time"

type WebhookEvent[T any] struct {
    ID         string    `json:"id"`
    Type       string    `json:"type"`
    APIVersion string    `json:"api_version"`
    CreatedAt  time.Time `json:"created_at"`
    Data       T         `json:"data"`
    Metadata   *Metadata `json:"metadata,omitempty"`
}

type Metadata struct {
    Source        string `json:"source"`
    CorrelationID string `json:"correlation_id"`
    Attempt       int    `json:"attempt"`
}

type OrderCompletedData struct {
    OrderID     string `json:"order_id"`
    CustomerID  string `json:"customer_id"`
    TotalAmount int64  `json:"total_amount"`
    Currency    string `json:"currency"`
    ItemsCount  int    `json:"items_count"`
    ResourceURL string `json:"resource_url"`
}

// Usage
func NewOrderCompletedEvent(data OrderCompletedData) WebhookEvent[OrderCompletedData] {
    return WebhookEvent[OrderCompletedData]{
        ID:         generateEventID(),
        Type:       "order.completed",
        APIVersion: "2024-01-15",
        CreatedAt:  time.Now().UTC(),
        Data:       data,
    }
}
```

```python
# Python — Event Schema
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from typing import Optional, Generic, TypeVar
import uuid

T = TypeVar("T")

class EventMetadata(BaseModel):
    source: str
    correlation_id: str
    attempt: int = 1

class WebhookEvent(BaseModel, Generic[T]):
    id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex[:16]}")
    type: str
    api_version: str = "2024-01-15"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data: T
    metadata: Optional[EventMetadata] = None

class OrderCompletedData(BaseModel):
    order_id: str
    customer_id: str
    total_amount: int
    currency: str
    items_count: int
    resource_url: str

# Usage
event = WebhookEvent[OrderCompletedData](
    type="order.completed",
    data=OrderCompletedData(
        order_id="ord_123",
        customer_id="cust_456",
        total_amount=9999,
        currency="EUR",
        items_count=3,
        resource_url="https://api.example.com/v1/orders/ord_123",
    ),
    metadata=EventMetadata(
        source="order-service",
        correlation_id="trace-abc-123",
    ),
)
```

### Event Type Naming Conventions

```
resource.action          → order.completed, user.created
resource.sub.action      → payment.refund.initiated
resource.action.result   → invoice.payment.failed
```

| Convention | Example | Usage |
|-----------|------------|-------|
| `resource.action` | `order.created` | Standard CRUD events |
| `resource.sub_resource.action` | `subscription.invoice.paid` | Nested resource events |
| Past tense | `order.completed` | Event already happened |
| Dot-separated | `payment.method.updated` | Hierarchical namespace |

**NEVER** use camelCase or slashes in event types. ALWAYS use dot-separated lowercase.

---

## Subscription Management

### Registration API

```typescript
// TypeScript — Webhook Registration
import express from "express";
import crypto from "crypto";

interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];         // ["order.*", "payment.completed"]
  secret: string;           // HMAC signing secret
  active: boolean;
  created_at: Date;
  metadata?: Record<string, string>;
}

const router = express.Router();

// Create subscription
router.post("/webhooks", async (req, res) => {
  const { url, events, metadata } = req.body;

  // Validate URL is HTTPS
  if (!url.startsWith("https://")) {
    return res.status(400).json({
      error: "Webhook URL must use HTTPS",
    });
  }

  // Validate events exist
  const validEvents = await getValidEventTypes();
  const invalidEvents = events.filter(
    (e: string) => !validEvents.some((v) => matchesPattern(v, e))
  );
  if (invalidEvents.length > 0) {
    return res.status(400).json({
      error: `Invalid event types: ${invalidEvents.join(", ")}`,
    });
  }

  // Generate signing secret
  const secret = `whsec_${crypto.randomBytes(32).toString("hex")}`;

  const subscription: WebhookSubscription = {
    id: `wh_${crypto.randomUUID()}`,
    url,
    events,
    secret,
    active: true,
    created_at: new Date(),
    metadata,
  };

  await saveSubscription(subscription);

  // Return secret ONLY on creation — never again
  res.status(201).json({
    id: subscription.id,
    url: subscription.url,
    events: subscription.events,
    secret: subscription.secret,  // Only returned once!
    active: subscription.active,
    created_at: subscription.created_at,
  });
});

// Verify endpoint ownership (optional but recommended)
router.post("/webhooks/:id/verify", async (req, res) => {
  const sub = await getSubscription(req.params.id);
  const challenge = crypto.randomBytes(32).toString("hex");

  // Send verification request to webhook URL
  const response = await fetch(sub.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "webhook.verification",
      challenge,
    }),
  });

  const body = await response.json();
  if (body.challenge === challenge) {
    await markSubscriptionVerified(sub.id);
    return res.json({ verified: true });
  }

  res.status(400).json({ verified: false });
});

// Wildcard matching: "order.*" matches "order.created", "order.completed"
function matchesPattern(pattern: string, eventType: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return eventType.startsWith(prefix + ".");
  }
  return pattern === eventType;
}
```

```go
// Go — Webhook Registration
package webhooks

import (
    "crypto/rand"
    "encoding/hex"
    "net/http"
    "net/url"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
)

type Subscription struct {
    ID        string            `json:"id" db:"id"`
    URL       string            `json:"url" db:"url"`
    Events    []string          `json:"events" db:"events"`
    Secret    string            `json:"secret,omitempty" db:"secret"`
    Active    bool              `json:"active" db:"active"`
    CreatedAt time.Time         `json:"created_at" db:"created_at"`
    Metadata  map[string]string `json:"metadata,omitempty" db:"metadata"`
}

type CreateWebhookRequest struct {
    URL      string            `json:"url" binding:"required"`
    Events   []string          `json:"events" binding:"required,min=1"`
    Metadata map[string]string `json:"metadata,omitempty"`
}

func (h *Handler) CreateWebhook(c *gin.Context) {
    var req CreateWebhookRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Validate HTTPS
    parsed, err := url.Parse(req.URL)
    if err != nil || parsed.Scheme != "https" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "URL must use HTTPS"})
        return
    }

    // Generate secret
    secretBytes := make([]byte, 32)
    if _, err := rand.Read(secretBytes); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate secret"})
        return
    }
    secret := "whsec_" + hex.EncodeToString(secretBytes)

    sub := Subscription{
        ID:        "wh_" + uuid.NewString(),
        URL:       req.URL,
        Events:    req.Events,
        Secret:    secret,
        Active:    true,
        CreatedAt: time.Now().UTC(),
        Metadata:  req.Metadata,
    }

    if err := h.repo.SaveSubscription(c.Request.Context(), sub); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save"})
        return
    }

    c.JSON(http.StatusCreated, sub) // Secret returned only on creation
}

func MatchesPattern(pattern, eventType string) bool {
    if pattern == "*" {
        return true
    }
    if strings.HasSuffix(pattern, ".*") {
        prefix := strings.TrimSuffix(pattern, ".*")
        return strings.HasPrefix(eventType, prefix+".")
    }
    return pattern == eventType
}
```

```python
# Python — Webhook Registration
import secrets
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
import fnmatch

router = APIRouter()

class CreateWebhookRequest(BaseModel):
    url: HttpUrl
    events: list[str]
    metadata: dict[str, str] | None = None

class WebhookSubscription(BaseModel):
    id: str
    url: str
    events: list[str]
    secret: str | None = None  # Only on creation
    active: bool = True
    created_at: datetime

@router.post("/webhooks", status_code=201)
async def create_webhook(req: CreateWebhookRequest) -> WebhookSubscription:
    # Validate HTTPS
    parsed = urlparse(str(req.url))
    if parsed.scheme != "https":
        raise HTTPException(400, "Webhook URL must use HTTPS")

    # Validate events
    valid_events = await get_valid_event_types()
    for event in req.events:
        if not any(matches_pattern(v, event) for v in valid_events):
            raise HTTPException(400, f"Invalid event type: {event}")

    secret = f"whsec_{secrets.token_hex(32)}"

    sub = WebhookSubscription(
        id=f"wh_{uuid.uuid4().hex[:12]}",
        url=str(req.url),
        events=req.events,
        secret=secret,
        created_at=datetime.now(timezone.utc),
    )

    await save_subscription(sub)
    return sub  # Secret returned only on creation


def matches_pattern(pattern: str, event_type: str) -> bool:
    if pattern == "*":
        return True
    if pattern.endswith(".*"):
        prefix = pattern[:-2]
        return event_type.startswith(f"{prefix}.")
    return pattern == event_type
```

---

## Versioning Strategy

### API Version in Event

```json
{
  "id": "evt_abc123",
  "type": "order.completed",
  "api_version": "2024-01-15",
  "data": { }
}
```

- Each subscription is locked to the version at creation time
- New versions change payload structure
- Old subscriptions continue to receive the old format
- Consumer can upgrade manually

### Version Migration

```
v2024-01-15:  { "amount": 1000 }          ← cents integer
v2024-06-01:  { "amount": { "value": 1000, "currency": "EUR" } }  ← object
```

NEVER change an existing field type without a new version. This breaks ALL consumers.

---

## Webhook Dispatcher Architecture

### Queue-Based Dispatch

```
┌────────┐    ┌──────────┐    ┌──────────────┐    ┌───────────┐
│ Event  │───▶│  Event   │───▶│   Webhook    │───▶│  HTTP     │
│ Source │    │  Queue   │    │  Worker Pool │    │  Delivery │
└────────┘    │ (Redis/  │    │              │    │           │
              │  SQS/    │    │  Matches     │    │  POST to  │
              │  Kafka)  │    │  events →    │    │  consumer │
              └──────────┘    │  subscriptions│    │  URLs     │
                              └──────────────┘    └───────────┘
```

```typescript
// TypeScript — Webhook Dispatcher
import { Queue, Worker } from "bullmq";

interface WebhookJob {
  event: WebhookEvent;
  subscription_id: string;
  url: string;
  secret: string;
  attempt: number;
}

// Producer: enqueue webhook deliveries
async function dispatchEvent(event: WebhookEvent): Promise<void> {
  const subscriptions = await getActiveSubscriptions();
  const matching = subscriptions.filter((sub) =>
    sub.events.some((pattern) => matchesPattern(pattern, event.type))
  );

  const jobs = matching.map((sub) => ({
    name: `deliver-${event.id}-${sub.id}`,
    data: {
      event,
      subscription_id: sub.id,
      url: sub.url,
      secret: sub.secret,
      attempt: 1,
    } satisfies WebhookJob,
    opts: {
      jobId: `${event.id}:${sub.id}`,  // Deduplication
      attempts: 5,
      backoff: {
        type: "exponential" as const,
        delay: 60_000,  // 1min, 2min, 4min, 8min, 16min
      },
      removeOnComplete: { age: 86400 },  // Keep 24h
      removeOnFail: { age: 604800 },     // Keep 7 days
    },
  }));

  await webhookQueue.addBulk(jobs);
}

// Consumer: process webhook deliveries
const worker = new Worker<WebhookJob>("webhooks", async (job) => {
  const { event, url, secret, subscription_id } = job.data;

  const payload = JSON.stringify(event);
  const signature = computeSignature(payload, secret);
  const timestamp = Math.floor(Date.now() / 1000);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-ID": event.id,
      "X-Webhook-Timestamp": timestamp.toString(),
      "X-Webhook-Signature": `v1=${signature}`,
      "User-Agent": "MyApp-Webhooks/1.0",
    },
    body: payload,
    signal: AbortSignal.timeout(30_000),  // 30s timeout
  });

  if (!response.ok) {
    // Log failure and let BullMQ retry
    await logDeliveryAttempt(event.id, subscription_id, {
      status: response.status,
      attempt: job.attemptsMade,
      success: false,
    });
    throw new Error(`Webhook delivery failed: ${response.status}`);
  }

  await logDeliveryAttempt(event.id, subscription_id, {
    status: response.status,
    attempt: job.attemptsMade,
    success: true,
  });
}, { concurrency: 50 });
```

```go
// Go — Webhook Dispatcher
package webhooks

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "log/slog"
    "net/http"
    "time"
)

type Dispatcher struct {
    client       *http.Client
    repo         Repository
    queue        Queue
    maxWorkers   int
    logger       *slog.Logger
}

func NewDispatcher(repo Repository, queue Queue, logger *slog.Logger) *Dispatcher {
    return &Dispatcher{
        client: &http.Client{
            Timeout: 30 * time.Second,
            Transport: &http.Transport{
                MaxIdleConns:        100,
                MaxIdleConnsPerHost: 10,
                IdleConnTimeout:     90 * time.Second,
            },
        },
        repo:       repo,
        queue:      queue,
        maxWorkers: 50,
        logger:     logger,
    }
}

type DeliveryJob struct {
    EventID        string          `json:"event_id"`
    SubscriptionID string          `json:"subscription_id"`
    URL            string          `json:"url"`
    Secret         string          `json:"secret"`
    Payload        json.RawMessage `json:"payload"`
    Attempt        int             `json:"attempt"`
}

func (d *Dispatcher) DispatchEvent(ctx context.Context, event WebhookEvent[json.RawMessage]) error {
    subs, err := d.repo.GetActiveSubscriptions(ctx)
    if err != nil {
        return fmt.Errorf("get subscriptions: %w", err)
    }

    payload, err := json.Marshal(event)
    if err != nil {
        return fmt.Errorf("marshal event: %w", err)
    }

    for _, sub := range subs {
        if !sub.MatchesEvent(event.Type) {
            continue
        }
        job := DeliveryJob{
            EventID:        event.ID,
            SubscriptionID: sub.ID,
            URL:            sub.URL,
            Secret:         sub.Secret,
            Payload:        payload,
            Attempt:        1,
        }
        if err := d.queue.Enqueue(ctx, job); err != nil {
            d.logger.Error("failed to enqueue webhook",
                "event_id", event.ID,
                "subscription_id", sub.ID,
                "error", err,
            )
        }
    }
    return nil
}

func (d *Dispatcher) Deliver(ctx context.Context, job DeliveryJob) error {
    timestamp := time.Now().Unix()
    signature := ComputeSignature(job.Payload, job.Secret, timestamp)

    req, err := http.NewRequestWithContext(ctx, http.MethodPost, job.URL,
        bytes.NewReader(job.Payload))
    if err != nil {
        return fmt.Errorf("create request: %w", err)
    }

    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-Webhook-ID", job.EventID)
    req.Header.Set("X-Webhook-Timestamp", fmt.Sprintf("%d", timestamp))
    req.Header.Set("X-Webhook-Signature", fmt.Sprintf("v1=%s", signature))
    req.Header.Set("User-Agent", "MyApp-Webhooks/1.0")

    resp, err := d.client.Do(req)
    if err != nil {
        return fmt.Errorf("deliver webhook: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode >= 200 && resp.StatusCode < 300 {
        return nil
    }

    return fmt.Errorf("webhook returned status %d", resp.StatusCode)
}
```

---

## Best Practices

1. **ALWAYS use unique event IDs** — consumers use these for idempotency
2. **ALWAYS include timestamp** — consumers need to know when it happened
3. **ALWAYS version your events** — payload changes without versioning = broken integrations
4. **NEVER send sensitive data in webhook payloads** — send resource ID + link
5. **ALWAYS validate webhook URLs are HTTPS** — HTTP = plaintext credentials
6. **ALWAYS set timeouts (30s max)** — slow consumers should not block the dispatcher
7. **ALWAYS use queue-based dispatch** — synchronous dispatch = single point of failure
8. **ALWAYS support wildcard subscriptions** — `order.*` instead of forcing exact matches
9. **ALWAYS return signing secret ONLY once** — at creation time, never again
10. **ALWAYS log every delivery attempt** — audit trail for debugging

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| Synchronous dispatch | Event processing blocks on slow consumer | Queue-based async dispatch |
| No event IDs | Duplicate processing, no idempotency | Unique ID per event (UUIDv7) |
| Mutable payloads | Consumer gets different data on retry | Snapshot payload at creation time |
| HTTP webhook URLs | Credentials leaked in transit | Require HTTPS, reject HTTP |
| Unbounded payload | Consumer memory exhaustion | Max payload size limit (256KB) |
| No versioning | Breaking changes affect all consumers | api_version field, per-subscription pinning |
| Polling fallback missing | Lost webhooks = permanently lost data | Provide GET /events endpoint as backup |
| No subscription verification | Webhook to arbitrary URLs (SSRF) | Challenge-response verification |
| Shared secrets | One compromised consumer leaks all | Unique secret per subscription |
| God events | Single event type with huge payload | Fine-grained event types |

---

## Real-world Examples

### Stripe Webhook Events

Stripe uses **fat payload** + **versioning per account**:
- Event types: `payment_intent.succeeded`, `invoice.paid`, `customer.subscription.updated`
- Each account is locked to an API version
- Payload contains full object + `previous_attributes` for changes
- Signing: `Stripe-Signature` header with `t=timestamp,v1=signature`

### GitHub Webhooks

GitHub uses **fat payload** + **per-event headers**:
- `X-GitHub-Event`: event type (push, pull_request, issues)
- `X-Hub-Signature-256`: HMAC-SHA256 signature
- `X-GitHub-Delivery`: unique delivery GUID
- Payload contains `action` field (opened, closed, synchronize)

### Shopify Webhooks

- `X-Shopify-Topic`: event type
- `X-Shopify-Hmac-Sha256`: Base64 HMAC
- `X-Shopify-Shop-Domain`: tenant identifier
- Mandatory webhook verification + automatic retry (19 times over 48h)

### Twilio Status Callbacks

- Form-encoded (not JSON) — `application/x-www-form-urlencoded`
- Signature validation via `X-Twilio-Signature`
- Includes `AccountSid` for multi-tenant verification
- Status transitions: `queued → sending → sent → delivered / failed`
