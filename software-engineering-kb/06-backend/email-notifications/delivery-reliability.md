# Delivery Reliability

> **AI Plugin Directive — Notification Delivery Reliability & Monitoring**
> You are an AI coding assistant. When generating, reviewing, or refactoring notification
> delivery code, follow EVERY rule in this document. Unreliable delivery means missed alerts,
> lost revenue, and user churn. Treat each section as non-negotiable.

**Core Rule: ALWAYS process delivery webhooks (bounces, complaints, deliveries) from email providers. ALWAYS implement retry with exponential backoff for failed sends. ALWAYS track delivery metrics and alert on anomalies. ALWAYS handle bounces by suppressing future sends to invalid addresses.**

---

## 1. Delivery Pipeline Reliability

```
┌──────────────────────────────────────────────────────────────┐
│              Reliable Delivery Pipeline                        │
│                                                               │
│  Application ──► Job Queue ──► Provider API                  │
│                     │              │                           │
│                     │         ┌────▼────┐                     │
│                     │         │ Status   │                     │
│                     │         │ Webhooks │                     │
│                     │         └────┬────┘                     │
│                     │              │                           │
│                retry on fail       │                           │
│                (3 attempts,        ▼                           │
│                 exp backoff)   Process:                        │
│                               ├── delivered → log             │
│                               ├── bounced → suppress address  │
│                               ├── complained → unsubscribe    │
│                               └── failed → alert + retry      │
│                                                               │
│  Delivery States:                                            │
│  queued → sent → delivered                                   │
│           │                                                   │
│           ├── bounced (hard) → suppress permanently          │
│           ├── bounced (soft) → retry 3x, then suppress       │
│           ├── complained → auto-unsubscribe + suppress       │
│           └── dropped → check suppression list               │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Webhook Processing

```typescript
// SendGrid Event Webhook handler
app.post("/webhooks/sendgrid", verifyWebhookSignature, async (req, res) => {
  const events: SendGridEvent[] = req.body;

  for (const event of events) {
    switch (event.event) {
      case "delivered":
        await notificationRepo.updateStatus(event.sg_message_id, "delivered");
        metrics.increment("email.delivered");
        break;

      case "bounce":
        await handleBounce(event);
        break;

      case "spamreport":
        await handleComplaint(event);
        break;

      case "dropped":
        logger.warn("Email dropped", {
          email: event.email,
          reason: event.reason,
        });
        metrics.increment("email.dropped");
        break;

      case "open":
        await notificationRepo.trackOpen(event.sg_message_id);
        break;

      case "click":
        await notificationRepo.trackClick(event.sg_message_id, event.url);
        break;
    }
  }

  res.status(200).end(); // ALWAYS return 200 quickly
});

async function handleBounce(event: SendGridEvent): Promise<void> {
  const isHard = event.type === "bounce" && event.bounce_classification === "permanent";

  if (isHard) {
    // Hard bounce: permanently suppress this address
    await suppressionList.add(event.email, "hard_bounce");
    await notificationRepo.updateStatus(event.sg_message_id, "bounced_hard");
    logger.warn("Hard bounce — address suppressed", { email: event.email });
  } else {
    // Soft bounce: increment counter, suppress after 3
    const count = await bounceCounter.increment(event.email);
    if (count >= 3) {
      await suppressionList.add(event.email, "soft_bounce_limit");
    }
  }
  metrics.increment("email.bounced", { type: isHard ? "hard" : "soft" });
}

async function handleComplaint(event: SendGridEvent): Promise<void> {
  // CRITICAL: auto-unsubscribe on complaint (ISP requirement)
  await suppressionList.add(event.email, "complaint");
  await preferencesRepo.disableChannel(event.email, "email");
  logger.warn("Spam complaint — user unsubscribed", { email: event.email });
  metrics.increment("email.complaint");
}
```

```go
func (h *WebhookHandler) HandleSendGridEvents(w http.ResponseWriter, r *http.Request) {
    var events []SendGridEvent
    json.NewDecoder(r.Body).Decode(&events)

    for _, event := range events {
        switch event.Event {
        case "delivered":
            h.repo.UpdateStatus(r.Context(), event.MessageID, "delivered")
        case "bounce":
            h.handleBounce(r.Context(), event)
        case "spamreport":
            h.handleComplaint(r.Context(), event)
        }
    }

    w.WriteHeader(http.StatusOK)
}
```

---

## 3. Suppression List

```typescript
class SuppressionList {
  constructor(private redis: Redis, private db: Database) {}

  async add(email: string, reason: string): Promise<void> {
    const normalized = email.toLowerCase().trim();

    // Fast check in Redis
    await this.redis.sadd("suppression:emails", normalized);

    // Persistent storage
    await this.db.suppressionList.upsert({
      where: { email: normalized },
      create: { email: normalized, reason, suppressedAt: new Date() },
      update: { reason, suppressedAt: new Date() },
    });
  }

  async isSuppressed(email: string): Promise<boolean> {
    return this.redis.sismember("suppression:emails", email.toLowerCase().trim()) === 1;
  }

  async remove(email: string): Promise<void> {
    const normalized = email.toLowerCase().trim();
    await this.redis.srem("suppression:emails", normalized);
    await this.db.suppressionList.delete({ where: { email: normalized } });
  }
}

// Check BEFORE sending any email
async function sendEmail(options: EmailOptions): Promise<void> {
  if (await suppressionList.isSuppressed(options.to)) {
    logger.info("Email suppressed", { to: options.to, reason: "on suppression list" });
    metrics.increment("email.suppressed");
    return; // Do NOT send
  }

  // Proceed with send...
}
```

- ALWAYS check suppression list before sending ANY email
- ALWAYS add hard bounces to suppression list permanently
- ALWAYS add complaint addresses to suppression list
- ALWAYS provide admin API to review and manage suppression list

---

## 4. Retry Strategy

```typescript
// Email job with retry configuration
const emailWorker = new Worker("email", async (job) => {
  const { to, templateId, data } = job.data;

  // Pre-flight checks
  if (await suppressionList.isSuppressed(to)) {
    return { status: "suppressed" };
  }

  try {
    await emailProvider.send({ to, templateId, data });
    return { status: "sent" };
  } catch (error) {
    if (isRateLimitError(error)) {
      // Provider rate limit — retry with longer delay
      throw new DelayedError("Rate limited", 60_000);
    }
    if (isPermanentError(error)) {
      // Invalid address, authentication error — don't retry
      logger.error("Permanent email error", { to, error: error.message });
      return { status: "permanent_failure" };
    }
    // Transient error — retry (handled by BullMQ)
    throw error;
  }
}, {
  connection: redis,
  concurrency: 10,
  limiter: { max: 100, duration: 1000 }, // 100 emails/sec provider limit
});
```

| Error Type | Retry? | Action |
|-----------|--------|--------|
| Rate limited (429) | YES | Retry with increased delay |
| Server error (5xx) | YES | Exponential backoff (3 attempts) |
| Invalid address (400) | NO | Suppress address, log |
| Auth error (401/403) | NO | Alert ops, check credentials |
| Network timeout | YES | Retry with backoff |

---

## 5. Delivery Metrics

```typescript
// Key metrics to track
const EMAIL_METRICS = {
  sent: "email.sent",             // Total sent
  delivered: "email.delivered",   // Successfully delivered
  bounced: "email.bounced",       // Bounced (hard + soft)
  complained: "email.complained", // Spam reports
  opened: "email.opened",        // Opened (if tracking enabled)
  clicked: "email.clicked",      // Clicked (if tracking enabled)
  suppressed: "email.suppressed", // Blocked by suppression list
  failed: "email.failed",        // Failed after all retries
};
```

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Delivery rate | > 95% | < 90% |
| Bounce rate | < 3% | > 5% |
| Complaint rate | < 0.1% | > 0.3% (ISP will block) |
| Suppression rate | Trending down | Trending up |
| Send latency (p99) | < 5 sec | > 30 sec |

- ALWAYS monitor bounce rate — ISPs block senders above 5%
- ALWAYS monitor complaint rate — above 0.3% triggers provider suspension
- ALWAYS alert on delivery rate drops below 90%
- ALWAYS track sending latency for SLA compliance

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No webhook processing | Unaware of bounces/complaints | Process all provider webhooks |
| Sending to bounced addresses | Reputation damage, provider ban | Suppression list checked before send |
| No retry on transient failure | Lost emails | Exponential backoff with 3 retries |
| Retrying permanent errors | Wasted resources | Classify errors, skip permanent |
| No complaint handling | ISP blocks sender domain | Auto-unsubscribe on complaint |
| No delivery metrics | Cannot detect delivery problems | Track delivery, bounce, complaint rates |
| No rate limiting to provider | 429 errors, temporary ban | Respect provider rate limits |

---

## 7. Enforcement Checklist

- [ ] Delivery webhooks processed (delivered, bounced, complained)
- [ ] Hard bounces permanently suppressed
- [ ] Soft bounces suppressed after 3 occurrences
- [ ] Complaints trigger auto-unsubscribe
- [ ] Suppression list checked before every email send
- [ ] Retry with exponential backoff for transient errors
- [ ] Permanent errors not retried
- [ ] Provider rate limits respected
- [ ] Delivery rate monitored (target > 95%)
- [ ] Bounce rate monitored (alert > 5%)
- [ ] Complaint rate monitored (alert > 0.3%)
- [ ] Webhook signatures verified for authenticity
