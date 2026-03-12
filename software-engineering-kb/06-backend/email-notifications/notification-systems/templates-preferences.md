# Notification Templates & User Preferences

> **AI Plugin Directive — Template Rendering & Preference Management**
> You are an AI coding assistant. When generating, reviewing, or refactoring notification
> template and preference code, follow EVERY rule in this document. Poor templates cause broken
> emails and ignored preferences violate user trust and regulations. Treat each section as non-negotiable.

**Core Rule: ALWAYS use a template engine with auto-escaping for notification content. ALWAYS respect user notification preferences — NEVER send notifications to channels the user has disabled (except critical security alerts). ALWAYS provide an unsubscribe mechanism.**

---

## 1. Template Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Notification Template System                      │
│                                                               │
│  Template Types (per notification, per channel):             │
│  ├── email/order-confirmed.html    (HTML email)              │
│  ├── email/order-confirmed.txt     (Plaintext fallback)      │
│  ├── push/order-confirmed.json     (Title + body + data)     │
│  ├── sms/order-confirmed.txt       (160 chars max)           │
│  └── in_app/order-confirmed.json   (Feed item)               │
│                                                               │
│  Template Data Flow:                                         │
│  Event Data ──► Template Engine ──► Rendered Content         │
│                     │                                        │
│                     ├── Variable interpolation               │
│                     ├── Conditional sections                 │
│                     ├── Localization (i18n)                  │
│                     └── Auto-escaping (XSS prevention)       │
└──────────────────────────────────────────────────────────────┘
```

```typescript
// Template engine with i18n support
class TemplateEngine {
  private templates: Map<string, CompiledTemplate> = new Map();

  async render(
    eventType: string,
    channel: string,
    data: Record<string, unknown>,
    locale: string = "en"
  ): Promise<RenderedContent> {
    const templateKey = `${channel}/${eventType}/${locale}`;
    const template = this.templates.get(templateKey)
      ?? this.templates.get(`${channel}/${eventType}/en`); // Fallback to English

    if (!template) {
      throw new Error(`Template not found: ${templateKey}`);
    }

    return template.render({
      ...data,
      appName: "MyApp",
      supportEmail: "support@myapp.com",
      currentYear: new Date().getFullYear(),
    });
  }
}

// Email template example (Handlebars/MJML)
const orderConfirmedEmail = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>Hi {{customerName}},</mj-text>
        <mj-text>Your order #{{orderId}} has been confirmed.</mj-text>
        <mj-table>
          {{#each items}}
          <tr>
            <td>{{this.name}}</td>
            <td>{{this.quantity}}</td>
            <td>{{this.price}}</td>
          </tr>
          {{/each}}
        </mj-table>
        <mj-text>Total: {{total}}</mj-text>
        <mj-button href="{{orderUrl}}">View Order</mj-button>
      </mj-column>
    </mj-section>
    <mj-section>
      <mj-text font-size="12px">
        <a href="{{unsubscribeUrl}}">Unsubscribe</a> |
        <a href="{{preferencesUrl}}">Notification Preferences</a>
      </mj-text>
    </mj-section>
  </mj-body>
</mjml>
`;

// Push template
const orderConfirmedPush = {
  title: "Order Confirmed!",
  body: "Your order #{{orderId}} for {{total}} has been confirmed.",
  data: { orderId: "{{orderId}}", deepLink: "/orders/{{orderId}}" },
};

// SMS template (160 char limit)
const orderConfirmedSMS = "MyApp: Order #{{orderId}} confirmed. Total: {{total}}. Track: {{shortUrl}}";
```

---

## 2. User Preferences

```typescript
// Preference schema
interface UserNotificationPreferences {
  userId: string;
  globalEnabled: boolean; // Master switch
  channels: {
    email: { enabled: boolean; frequency: "instant" | "daily_digest" | "weekly_digest" };
    push: { enabled: boolean; quietHours: { start: string; end: string } | null };
    sms: { enabled: boolean }; // SMS opt-in only
    in_app: { enabled: boolean };
  };
  categories: {
    marketing: boolean;       // Opt-in
    product_updates: boolean; // Opt-in
    order_updates: boolean;   // Defaults to true
    security: boolean;        // ALWAYS true, cannot disable
    social: boolean;          // Comments, mentions
  };
  locale: string;
  timezone: string;
}

// Default preferences (new users)
const DEFAULT_PREFERENCES: Omit<UserNotificationPreferences, "userId"> = {
  globalEnabled: true,
  channels: {
    email: { enabled: true, frequency: "instant" },
    push: { enabled: true, quietHours: null },
    sms: { enabled: false },  // SMS is opt-in
    in_app: { enabled: true },
  },
  categories: {
    marketing: false,       // Off by default
    product_updates: true,
    order_updates: true,
    security: true,         // Cannot be disabled
    social: true,
  },
  locale: "en",
  timezone: "UTC",
};

// API endpoints for preferences
app.get("/api/notifications/preferences", auth, async (req, res) => {
  const prefs = await preferencesRepo.get(req.user.id);
  res.json(prefs ?? DEFAULT_PREFERENCES);
});

app.put("/api/notifications/preferences", auth, validateBody(prefsSchema), async (req, res) => {
  // NEVER allow disabling security notifications
  if (req.body.categories?.security === false) {
    return res.status(400).json({
      error: "Security notifications cannot be disabled",
    });
  }
  const prefs = await preferencesRepo.upsert(req.user.id, req.body);
  res.json(prefs);
});

// Unsubscribe via token (no auth required — email link)
app.get("/api/notifications/unsubscribe", async (req, res) => {
  const { token, category } = req.query;
  const userId = verifyUnsubscribeToken(token as string);
  if (!userId) return res.status(400).send("Invalid or expired link");

  await preferencesRepo.disableCategory(userId, category as string);
  res.send("You have been unsubscribed from these notifications.");
});
```

---

## 3. Quiet Hours & Digest

```typescript
// Respect quiet hours for push notifications
class QuietHoursFilter {
  shouldDelay(prefs: UserNotificationPreferences, priority: string): boolean {
    if (priority === "critical") return false; // Critical bypasses quiet hours

    const quietHours = prefs.channels.push.quietHours;
    if (!quietHours) return false;

    const now = new Date().toLocaleTimeString("en-US", {
      hour12: false, timeZone: prefs.timezone,
    });

    const current = parseInt(now.replace(":", ""));
    const start = parseInt(quietHours.start.replace(":", ""));
    const end = parseInt(quietHours.end.replace(":", ""));

    if (start < end) {
      return current >= start && current < end;
    }
    return current >= start || current < end; // Wraps midnight
  }
}

// Email digest — batch notifications into daily/weekly summary
class DigestService {
  async processDigest(frequency: "daily" | "weekly"): Promise<void> {
    const users = await preferencesRepo.getUsersByDigestFrequency(frequency);

    for (const userId of users) {
      const pending = await notificationRepo.getPendingDigest(userId, frequency);
      if (pending.length === 0) continue;

      await emailQueue.add("digest", {
        to: await getUserEmail(userId),
        templateId: `${frequency}-digest`,
        data: { notifications: pending, count: pending.length },
      });

      await notificationRepo.markDigested(pending.map((n) => n.id));
    }
  }
}

// Schedule digests
// Daily: 8:00 AM user's timezone
// Weekly: Monday 8:00 AM user's timezone
```

---

## 4. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No plaintext email fallback | Broken in text-only clients | Always include text version |
| No unsubscribe mechanism | GDPR/CAN-SPAM violation | Token-based unsubscribe link |
| Security notifications disableable | User misses account compromise | Always enforce security category |
| SMS enabled by default | Cost explosion, user complaints | SMS is opt-in only |
| No quiet hours | Push at 3 AM | Quiet hours per user timezone |
| No locale/i18n | English-only templates | Template per locale with fallback |
| Hardcoded template strings | Templates require code deploy | External template storage/engine |
| No digest option | User gets 30 emails daily | Daily/weekly digest aggregation |

---

## 5. Enforcement Checklist

- [ ] Templates defined per channel per notification type
- [ ] Email includes both HTML and plaintext versions
- [ ] All templates use auto-escaping (XSS prevention)
- [ ] User preferences stored and respected on every notification
- [ ] Security notifications cannot be disabled by users
- [ ] SMS channel requires explicit opt-in
- [ ] Unsubscribe link included in every non-critical email
- [ ] Quiet hours respected for push notifications
- [ ] Digest option available (daily/weekly email summary)
- [ ] Templates support localization (i18n) with English fallback
