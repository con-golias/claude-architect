# Notification Channels & Routing

> **AI Plugin Directive — Channel Integration & Smart Routing**
> You are an AI coding assistant. When generating, reviewing, or refactoring notification
> channel code, follow EVERY rule in this document. Wrong channel selection and poor routing
> cause missed critical alerts and user frustration. Treat each section as non-negotiable.

**Core Rule: ALWAYS implement each channel as an independent provider behind a common interface. ALWAYS route based on notification priority, user preferences, and channel availability. ALWAYS have a fallback channel for critical notifications.**

---

## 1. Channel Provider Interface

```typescript
interface ChannelDispatcher {
  channel: string;
  dispatch(request: DispatchRequest): Promise<DispatchResult>;
  isAvailable(recipientId: string): Promise<boolean>;
}

interface DispatchRequest {
  recipientId: string;
  content: RenderedContent;
  priority: "critical" | "high" | "normal" | "low";
  metadata?: Record<string, string>;
}

interface DispatchResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

---

## 2. Push Notifications (FCM/APNs)

```typescript
import admin from "firebase-admin";

class PushDispatcher implements ChannelDispatcher {
  channel = "push";

  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    const tokens = await this.getDeviceTokens(request.recipientId);
    if (tokens.length === 0) {
      return { success: false, error: "No device tokens" };
    }

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: request.content.title,
        body: request.content.body,
      },
      data: request.content.data,
      android: {
        priority: request.priority === "critical" ? "high" : "normal",
        notification: { channelId: request.priority },
      },
      apns: {
        payload: {
          aps: {
            sound: request.priority === "critical" ? "critical_alert.caf" : "default",
            "interruption-level": request.priority === "critical" ? "critical" : "active",
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Handle invalid tokens
    response.responses.forEach((resp, idx) => {
      if (resp.error?.code === "messaging/registration-token-not-registered") {
        this.removeToken(tokens[idx]); // Cleanup stale tokens
      }
    });

    return {
      success: response.successCount > 0,
      messageId: response.responses[0]?.messageId,
    };
  }

  async isAvailable(recipientId: string): Promise<boolean> {
    const tokens = await this.getDeviceTokens(recipientId);
    return tokens.length > 0;
  }
}
```

```go
type PushDispatcher struct {
    client *messaging.Client
    tokens TokenRepository
}

func (d *PushDispatcher) Dispatch(ctx context.Context, req DispatchRequest) (*DispatchResult, error) {
    tokens, _ := d.tokens.GetByUser(ctx, req.RecipientID)
    if len(tokens) == 0 {
        return &DispatchResult{Success: false, Error: "no device tokens"}, nil
    }

    msg := &messaging.MulticastMessage{
        Tokens: tokens,
        Notification: &messaging.Notification{
            Title: req.Content.Title,
            Body:  req.Content.Body,
        },
    }

    resp, err := d.client.SendEachForMulticast(ctx, msg)
    if err != nil {
        return nil, err
    }
    return &DispatchResult{Success: resp.SuccessCount > 0}, nil
}
```

---

## 3. SMS Notifications

```typescript
import twilio from "twilio";

class SMSDispatcher implements ChannelDispatcher {
  channel = "sms";
  private client: twilio.Twilio;

  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
  }

  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    const phone = await this.getPhoneNumber(request.recipientId);
    if (!phone) {
      return { success: false, error: "No phone number" };
    }

    const message = await this.client.messages.create({
      to: phone,
      from: process.env.TWILIO_FROM_NUMBER!,
      body: request.content.body, // SMS: plain text, max 160 chars for 1 segment
    });

    return { success: true, messageId: message.sid };
  }
}
```

- ALWAYS limit SMS to critical notifications (cost + user annoyance)
- ALWAYS keep SMS under 160 characters per segment
- ALWAYS verify phone numbers before sending (E.164 format)

---

## 4. In-App Notifications

```typescript
class InAppDispatcher implements ChannelDispatcher {
  channel = "in_app";

  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    // Store in database
    const notification = await db.notifications.create({
      userId: request.recipientId,
      type: request.content.type,
      title: request.content.title,
      body: request.content.body,
      data: request.content.data,
      read: false,
      createdAt: new Date(),
    });

    // Push real-time update via WebSocket/SSE
    await realtimeService.send(request.recipientId, "notification:new", {
      id: notification.id,
      title: request.content.title,
      body: request.content.body,
    });

    return { success: true, messageId: notification.id };
  }
}

// API: Get user notifications
app.get("/api/notifications", auth, async (req, res) => {
  const notifications = await db.notifications.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ data: notifications, unreadCount: notifications.filter((n) => !n.read).length });
});

// API: Mark as read
app.patch("/api/notifications/:id/read", auth, async (req, res) => {
  await db.notifications.update({ where: { id: req.params.id }, data: { read: true } });
  res.status(204).end();
});

// API: Mark all as read
app.post("/api/notifications/read-all", auth, async (req, res) => {
  await db.notifications.updateMany({
    where: { userId: req.user.id, read: false },
    data: { read: true },
  });
  res.status(204).end();
});
```

---

## 5. Smart Routing & Fallback

```typescript
// Route notification through channels with fallback
class SmartRouter {
  private dispatchers: Map<string, ChannelDispatcher>;

  async route(event: NotificationEvent, channels: string[]): Promise<void> {
    const results: Map<string, DispatchResult> = new Map();

    for (const channel of channels) {
      const dispatcher = this.dispatchers.get(channel);
      if (!dispatcher) continue;

      // Check if channel is available for this user
      if (!(await dispatcher.isAvailable(event.recipientId))) {
        logger.debug("Channel not available", { channel, userId: event.recipientId });
        continue;
      }

      const result = await dispatcher.dispatch({
        recipientId: event.recipientId,
        content: event.renderedContent[channel],
        priority: event.priority,
      });

      results.set(channel, result);

      // For critical: if primary channel succeeds, still send backup
      // For normal: stop after first success
      if (result.success && event.priority !== "critical") {
        break;
      }
    }

    // Fallback: if all channels failed for critical notification
    if (event.priority === "critical" && ![...results.values()].some((r) => r.success)) {
      logger.error("CRITICAL notification delivery failed on all channels", {
        userId: event.recipientId,
        type: event.type,
      });
      // Trigger escalation (PagerDuty, on-call, etc.)
      await this.escalate(event);
    }
  }
}
```

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Hardcoded channel per event | Cannot change routing without code deploy | Config-driven channel routing |
| No channel availability check | Sending push to users without app | Check `isAvailable` before dispatch |
| No fallback for critical alerts | Critical alert lost if one channel fails | Multi-channel with fallback chain |
| Stale push tokens | FCM errors, wasted API calls | Clean up invalid tokens on error |
| SMS for non-critical notifications | High cost, user opt-out | Reserve SMS for critical only |
| No in-app notification storage | Users miss notifications when offline | Persist + real-time push |
| Same message for all channels | 2000-char email body as push text | Channel-specific content rendering |

---

## 7. Enforcement Checklist

- [ ] Each channel implemented as independent provider behind common interface
- [ ] Channel availability checked before dispatch
- [ ] Critical notifications sent on multiple channels with fallback
- [ ] Push tokens cleaned up on delivery error (stale token removal)
- [ ] SMS reserved for critical notifications only
- [ ] In-app notifications persisted in database
- [ ] Real-time delivery via WebSocket/SSE for in-app notifications
- [ ] Channel routing configurable per event type
