# Webhook Events & Event-Driven Notifications

> **AI Plugin Directive — Webhook Design & Event-Driven Notification Triggers**
> You are an AI coding assistant. When generating, reviewing, or refactoring webhook and
> event-driven notification code, follow EVERY rule in this document. Poorly designed webhooks
> cause missed events, duplicate processing, and security vulnerabilities. Treat each section as non-negotiable.

**Core Rule: ALWAYS verify webhook signatures before processing. ALWAYS process webhooks idempotently (safe to receive the same event twice). ALWAYS respond to webhooks within 5 seconds — do heavy processing asynchronously.**

---

## 1. Outgoing Webhooks (Your App → External Systems)

```
┌──────────────────────────────────────────────────────────────┐
│              Outgoing Webhook Architecture                     │
│                                                               │
│  Domain Event (order.created)                                │
│       │                                                       │
│       ▼                                                       │
│  Webhook Dispatcher                                          │
│  ├── Find subscribers for event type                         │
│  ├── Serialize payload                                       │
│  ├── Sign payload (HMAC-SHA256)                              │
│  └── Enqueue delivery jobs                                   │
│       │                                                       │
│       ▼                                                       │
│  Delivery Worker                                             │
│  ├── POST payload to subscriber URL                          │
│  ├── Verify 2xx response                                     │
│  ├── Retry on failure (exp backoff)                          │
│  └── Disable endpoint after N consecutive failures           │
└──────────────────────────────────────────────────────────────┘
```

```typescript
import { createHmac } from "crypto";

class WebhookDispatcher {
  async dispatch(event: DomainEvent): Promise<void> {
    const subscribers = await this.getSubscribers(event.type);

    for (const subscriber of subscribers) {
      const payload = JSON.stringify({
        id: randomUUID(),          // Unique event ID (for idempotency)
        type: event.type,          // "order.created"
        timestamp: new Date().toISOString(),
        data: event.data,
      });

      const signature = createHmac("sha256", subscriber.secret)
        .update(payload)
        .digest("hex");

      await webhookQueue.add("deliver", {
        url: subscriber.url,
        payload,
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `sha256=${signature}`,
          "X-Webhook-ID": event.id,
          "X-Webhook-Timestamp": Date.now().toString(),
        },
      }, {
        attempts: 5,
        backoff: { type: "exponential", delay: 10_000 }, // 10s, 20s, 40s, 80s, 160s
      });
    }
  }
}

// Delivery worker
const webhookWorker = new Worker("webhook", async (job) => {
  const { url, payload, headers } = job.data;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: payload,
    signal: AbortSignal.timeout(10_000), // 10s timeout
  });

  if (!response.ok) {
    throw new Error(`Webhook delivery failed: ${response.status}`);
  }
}, { connection: redis, concurrency: 20 });
```

```go
func (d *WebhookDispatcher) Dispatch(ctx context.Context, event DomainEvent) error {
    subscribers, _ := d.repo.GetSubscribers(ctx, event.Type)

    for _, sub := range subscribers {
        payload, _ := json.Marshal(WebhookPayload{
            ID:        uuid.New().String(),
            Type:      event.Type,
            Timestamp: time.Now().Format(time.RFC3339),
            Data:      event.Data,
        })

        mac := hmac.New(sha256.New, []byte(sub.Secret))
        mac.Write(payload)
        signature := "sha256=" + hex.EncodeToString(mac.Sum(nil))

        // Enqueue for reliable delivery
        d.queue.Enqueue(ctx, WebhookJob{
            URL:       sub.URL,
            Payload:   string(payload),
            Signature: signature,
        })
    }
    return nil
}
```

---

## 2. Incoming Webhooks (External Systems → Your App)

```typescript
// Verify webhook signature before processing
function verifyWebhookSignature(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers["x-webhook-signature"] as string;
    const timestamp = req.headers["x-webhook-timestamp"] as string;

    if (!signature || !timestamp) {
      return res.status(401).json({ error: "Missing signature" });
    }

    // Prevent replay attacks (reject if older than 5 minutes)
    const age = Date.now() - parseInt(timestamp);
    if (age > 300_000) {
      return res.status(401).json({ error: "Webhook too old" });
    }

    // Verify HMAC
    const expected = createHmac("sha256", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    const provided = signature.replace("sha256=", "");
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    next();
  };
}

// Idempotent webhook handler
app.post("/webhooks/stripe", verifyStripeSignature, async (req, res) => {
  const event = req.body;

  // Check if already processed (idempotency)
  const processed = await redis.get(`webhook:processed:${event.id}`);
  if (processed) {
    return res.status(200).json({ status: "already_processed" });
  }

  // Mark as processing (prevent concurrent handling)
  const lock = await redis.set(`webhook:lock:${event.id}`, "1", "PX", 30000, "NX");
  if (!lock) {
    return res.status(200).json({ status: "processing" });
  }

  try {
    // Process asynchronously — respond quickly
    await eventQueue.add("webhook", event);
    await redis.setex(`webhook:processed:${event.id}`, 86400, "1"); // 24h dedup
    res.status(200).json({ status: "accepted" });
  } finally {
    await redis.del(`webhook:lock:${event.id}`);
  }
});
```

---

## 3. Event-Driven Notification Triggers

```typescript
// Domain events trigger notifications
class EventNotificationBridge {
  private handlers: Map<string, (event: DomainEvent) => Promise<void>> = new Map();

  constructor(private notificationService: NotificationService) {
    this.register("user.registered", this.onUserRegistered.bind(this));
    this.register("order.confirmed", this.onOrderConfirmed.bind(this));
    this.register("payment.failed", this.onPaymentFailed.bind(this));
    this.register("security.new_device_login", this.onNewDeviceLogin.bind(this));
  }

  private async onUserRegistered(event: DomainEvent): Promise<void> {
    await this.notificationService.send({
      type: "user.registered",
      recipientId: event.data.userId,
      data: {
        name: event.data.name,
        verificationUrl: event.data.verificationUrl,
      },
      priority: "high",
    });
  }

  private async onOrderConfirmed(event: DomainEvent): Promise<void> {
    await this.notificationService.send({
      type: "order.confirmed",
      recipientId: event.data.customerId,
      data: {
        orderId: event.data.orderId,
        items: event.data.items,
        total: event.data.total,
      },
      priority: "high",
    });
  }

  private async onPaymentFailed(event: DomainEvent): Promise<void> {
    await this.notificationService.send({
      type: "payment.failed",
      recipientId: event.data.customerId,
      data: {
        orderId: event.data.orderId,
        reason: event.data.reason,
        retryUrl: event.data.retryUrl,
      },
      priority: "critical",
    });
  }
}
```

---

## 4. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No signature verification | Accepting forged webhooks | HMAC-SHA256 signature verification |
| No replay protection | Processing old/replayed events | Timestamp check (reject > 5 min old) |
| No idempotency | Duplicate processing on retry | Dedup by event ID (Redis set + TTL) |
| Slow webhook response | Provider times out, retries | Respond 200 immediately, process async |
| No retry for outgoing | Subscriber misses events | Exponential backoff (5 attempts) |
| No endpoint health tracking | Sending to dead endpoints | Disable after N consecutive failures |
| No event ID in payload | Cannot deduplicate | Include unique ID in every event |

---

## 5. Enforcement Checklist

- [ ] Outgoing webhooks signed with HMAC-SHA256
- [ ] Incoming webhooks verified via signature before processing
- [ ] Replay attacks prevented (timestamp within 5 minutes)
- [ ] Webhook processing is idempotent (dedup by event ID)
- [ ] Webhook endpoint responds within 5 seconds (async processing)
- [ ] Outgoing webhooks retried with exponential backoff (5 attempts)
- [ ] Dead endpoints disabled after consecutive failures
- [ ] Every webhook payload includes unique event ID and timestamp
- [ ] Webhook events logged for debugging and audit
- [ ] Domain events cleanly mapped to notification triggers
