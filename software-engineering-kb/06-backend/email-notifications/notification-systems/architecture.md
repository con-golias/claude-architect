# Notification System Architecture

> **AI Plugin Directive — Multi-Channel Notification Architecture**
> You are an AI coding assistant. When generating, reviewing, or refactoring notification
> system code, follow EVERY rule in this document. Poorly designed notification systems cause
> alert fatigue, missed critical alerts, and user churn. Treat each section as non-negotiable.

**Core Rule: ALWAYS decouple notification dispatch from business logic via events. ALWAYS route notifications through a central notification service. ALWAYS respect user preferences and rate limits — NEVER spam users.**

---

## 1. Notification System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Notification Service Architecture                 │
│                                                               │
│  Business Event                                              │
│  (order.shipped, payment.failed, comment.received)           │
│       │                                                       │
│       ▼                                                       │
│  ┌──────────────────────────────────────┐                    │
│  │  Notification Service                 │                    │
│  │  ├── Resolve recipients               │                    │
│  │  ├── Check user preferences          │                    │
│  │  ├── Apply rate limits               │                    │
│  │  ├── Select channels (email/push/sms)│                    │
│  │  ├── Render templates                │                    │
│  │  └── Dispatch to channel providers   │                    │
│  └──────┬─────────┬──────────┬──────────┘                    │
│         │         │          │                                │
│    ┌────▼──┐ ┌───▼───┐ ┌───▼───┐                            │
│    │ Email │ │ Push  │ │  SMS  │  ┌────────┐ ┌────────┐     │
│    │ Queue │ │ Queue │ │ Queue │  │In-App  │ │ Slack/ │     │
│    └───┬───┘ └───┬───┘ └───┬───┘  │Queue   │ │Webhook │     │
│        │         │         │       └────────┘ └────────┘     │
│        ▼         ▼         ▼                                  │
│    SendGrid    FCM/APNs   Twilio                             │
└──────────────────────────────────────────────────────────────┘
```

| Channel | Latency | Cost | Best For |
|---------|---------|------|----------|
| **In-App** | Instant | Free | Activity feeds, updates |
| **Push (FCM/APNs)** | Seconds | Free | Time-sensitive, mobile users |
| **Email** | Minutes | $0.001-0.01 | Detailed content, receipts |
| **SMS** | Seconds | $0.01-0.05 | Critical alerts, 2FA |
| **Slack/Teams** | Seconds | Free | Team notifications, ops alerts |
| **Webhook** | Seconds | Free | System integrations |

---

## 2. Implementation

```typescript
// Notification service — central dispatch
interface NotificationEvent {
  type: string;          // "order.shipped"
  recipientId: string;   // User ID
  data: Record<string, unknown>; // Template data
  priority: "critical" | "high" | "normal" | "low";
  channels?: string[];   // Override default channels
}

class NotificationService {
  constructor(
    private preferences: PreferencesRepository,
    private rateLimiter: NotificationRateLimiter,
    private dispatchers: Map<string, ChannelDispatcher>,
    private templateEngine: TemplateEngine,
  ) {}

  async send(event: NotificationEvent): Promise<void> {
    // 1. Resolve channels from user preferences
    const prefs = await this.preferences.get(event.recipientId);
    const channels = event.channels ?? this.resolveChannels(event.type, prefs);

    // 2. Check rate limits
    for (const channel of channels) {
      if (await this.rateLimiter.isLimited(event.recipientId, channel)) {
        logger.warn("Notification rate limited", {
          userId: event.recipientId, channel,
        });
        channels.splice(channels.indexOf(channel), 1);
      }
    }

    // 3. Dispatch to each channel
    for (const channel of channels) {
      const dispatcher = this.dispatchers.get(channel);
      if (!dispatcher) continue;

      const rendered = await this.templateEngine.render(
        event.type, channel, event.data
      );

      await dispatcher.dispatch({
        recipientId: event.recipientId,
        content: rendered,
        priority: event.priority,
      });
    }
  }

  private resolveChannels(eventType: string, prefs: UserPreferences): string[] {
    const config = NOTIFICATION_CONFIG[eventType];
    if (!config) return [];

    return config.channels.filter((ch) => {
      // Critical notifications bypass preferences
      if (config.priority === "critical") return true;
      return prefs.channels[ch]?.enabled !== false;
    });
  }
}
```

```go
type NotificationService struct {
    preferences PreferencesRepo
    rateLimiter *RateLimiter
    dispatchers map[string]ChannelDispatcher
    templates   *TemplateEngine
}

func (s *NotificationService) Send(ctx context.Context, event NotificationEvent) error {
    prefs, _ := s.preferences.Get(ctx, event.RecipientID)
    channels := s.resolveChannels(event.Type, prefs)

    for _, ch := range channels {
        if s.rateLimiter.IsLimited(ctx, event.RecipientID, ch) {
            continue
        }

        dispatcher, ok := s.dispatchers[ch]
        if !ok {
            continue
        }

        content, _ := s.templates.Render(event.Type, ch, event.Data)
        if err := dispatcher.Dispatch(ctx, DispatchRequest{
            RecipientID: event.RecipientID,
            Content:     content,
            Priority:    event.Priority,
        }); err != nil {
            slog.Error("notification dispatch failed", "channel", ch, "err", err)
        }
    }
    return nil
}
```

---

## 3. Notification Configuration

```typescript
// Define notification routing per event type
const NOTIFICATION_CONFIG: Record<string, NotificationConfig> = {
  "order.confirmed": {
    channels: ["email", "push", "in_app"],
    priority: "high",
    templates: {
      email: "order-confirmation",
      push: "order-confirmed-push",
      in_app: "order-confirmed-feed",
    },
  },
  "payment.failed": {
    channels: ["email", "push", "sms"],
    priority: "critical",
    templates: {
      email: "payment-failed",
      push: "payment-failed-push",
      sms: "payment-failed-sms",
    },
  },
  "comment.received": {
    channels: ["push", "in_app"],
    priority: "normal",
    templates: {
      push: "new-comment-push",
      in_app: "new-comment-feed",
    },
  },
  "security.login_new_device": {
    channels: ["email", "push"],
    priority: "critical",
    templates: {
      email: "new-device-login",
      push: "security-alert-push",
    },
  },
};
```

---

## 4. Rate Limiting Notifications

```typescript
class NotificationRateLimiter {
  constructor(private redis: Redis) {}

  async isLimited(userId: string, channel: string): Promise<boolean> {
    const limits = RATE_LIMITS[channel];
    if (!limits) return false;

    const key = `notif_rate:${userId}:${channel}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, limits.windowSeconds);
    }

    return count > limits.maxPerWindow;
  }
}

const RATE_LIMITS: Record<string, { maxPerWindow: number; windowSeconds: number }> = {
  email: { maxPerWindow: 10, windowSeconds: 3600 },     // 10/hour
  push:  { maxPerWindow: 20, windowSeconds: 3600 },     // 20/hour
  sms:   { maxPerWindow: 5, windowSeconds: 3600 },      // 5/hour
  in_app: { maxPerWindow: 100, windowSeconds: 3600 },   // 100/hour
};
```

- ALWAYS rate limit notifications per user per channel
- ALWAYS bypass rate limits for critical/security notifications
- ALWAYS log rate-limited notifications for monitoring

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Notification logic in business code | Tight coupling, hard to modify | Event-driven, central notification service |
| No rate limiting | User gets 50 emails in 1 hour | Per-user per-channel rate limits |
| No user preferences | Users cannot control notifications | Preference system with channel toggles |
| Same template for all channels | Push message is 2000 chars | Channel-specific templates |
| Synchronous dispatch | API blocked waiting for email | Async via job queues |
| No priority levels | Marketing notifications delay 2FA | Priority queues, critical bypasses limits |

---

## 6. Enforcement Checklist

- [ ] Central notification service handles all dispatch
- [ ] Business logic emits events, not notification calls
- [ ] User preferences respected (except critical/security)
- [ ] Rate limits enforced per user per channel
- [ ] Channel-specific templates for each notification type
- [ ] Critical notifications bypass preferences and rate limits
- [ ] All notification dispatch is asynchronous (job queues)
- [ ] Notification events logged for debugging and analytics
