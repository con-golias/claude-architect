# Transactional Email

> **AI Plugin Directive — Transactional Email Architecture & Delivery**
> You are an AI coding assistant. When generating, reviewing, or refactoring transactional email
> code, follow EVERY rule in this document. Poorly implemented email causes lost messages,
> spam folder delivery, and compliance violations. Treat each section as non-negotiable.

**Core Rule: ALWAYS send transactional emails asynchronously via a job queue — NEVER in the request path. ALWAYS use a dedicated email service provider (SendGrid, SES, Postmark) — NEVER run your own SMTP server. ALWAYS implement email authentication (SPF, DKIM, DMARC).**

---

## 1. Transactional Email Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Transactional Email Pipeline                      │
│                                                               │
│  Application Event                                           │
│  (user.registered, order.confirmed, password.reset)          │
│       │                                                       │
│       ▼                                                       │
│  Job Queue (async)                                           │
│  ├── Render template with data                               │
│  ├── Apply rate limits                                       │
│  └── Enqueue email job                                       │
│       │                                                       │
│       ▼                                                       │
│  Email Service Provider                                      │
│  (SendGrid, SES, Postmark)                                   │
│  ├── DKIM signing                                            │
│  ├── SPF alignment                                           │
│  ├── Delivery optimization                                   │
│  └── Bounce/complaint handling                               │
│       │                                                       │
│       ▼                                                       │
│  Recipient Inbox                                             │
│       │                                                       │
│       ▼                                                       │
│  Webhooks back to application                                │
│  (delivered, opened, clicked, bounced, complained)           │
└──────────────────────────────────────────────────────────────┘
```

| Provider | Best For | Pricing Model | Key Feature |
|----------|----------|---------------|-------------|
| **SendGrid** | General purpose, high volume | Per-email | Template engine, analytics |
| **AWS SES** | AWS-native, cost-sensitive | $0.10/1000 emails | Cheapest at scale |
| **Postmark** | Transactional focus, deliverability | Per-email | Best inbox delivery rates |
| **Mailgun** | Developer-focused, API-first | Per-email | Powerful routing rules |
| **Resend** | Modern DX, React Email | Per-email | React Email templates |

---

## 2. Implementation

### 2.1 TypeScript (SendGrid)

```typescript
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

interface EmailOptions {
  to: string;
  subject: string;
  templateId: string;
  dynamicData: Record<string, unknown>;
  replyTo?: string;
  category?: string[];
}

async function sendEmail(options: EmailOptions): Promise<void> {
  await sgMail.send({
    to: options.to,
    from: {
      email: "noreply@myapp.com",
      name: "MyApp",
    },
    replyTo: options.replyTo ?? "support@myapp.com",
    subject: options.subject,
    templateId: options.templateId,
    dynamicTemplateData: options.dynamicData,
    categories: options.category,
    trackingSettings: {
      clickTracking: { enable: false },  // Disable for security emails
      openTracking: { enable: false },   // GDPR compliance
    },
  });
}

// ALWAYS send via job queue — NEVER in request handler
import { Queue } from "bullmq";

const emailQueue = new Queue("email", { connection: redis });

// Enqueue email job (async, reliable)
async function queueEmail(options: EmailOptions): Promise<void> {
  await emailQueue.add("send", options, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  });
}

// Worker processes email jobs
const emailWorker = new Worker("email", async (job) => {
  await sendEmail(job.data);
  logger.info("Email sent", {
    to: job.data.to,
    template: job.data.templateId,
  });
}, { connection: redis, concurrency: 5 });
```

### 2.2 Go (AWS SES)

```go
import (
    "github.com/aws/aws-sdk-go-v2/service/sesv2"
    "github.com/aws/aws-sdk-go-v2/service/sesv2/types"
)

type EmailService struct {
    client *sesv2.Client
    from   string
}

func (s *EmailService) SendTemplatedEmail(ctx context.Context, opts EmailOptions) error {
    templateData, _ := json.Marshal(opts.DynamicData)

    _, err := s.client.SendEmail(ctx, &sesv2.SendEmailInput{
        FromEmailAddress: &s.from,
        Destination: &types.Destination{
            ToAddresses: []string{opts.To},
        },
        Content: &types.EmailContent{
            Template: &types.Template{
                TemplateName: &opts.TemplateID,
                TemplateData: aws.String(string(templateData)),
            },
        },
        EmailTags: []types.MessageTag{
            {Name: aws.String("category"), Value: aws.String(opts.Category)},
        },
    })
    return err
}
```

### 2.3 Python (Resend)

```python
import resend

resend.api_key = os.environ["RESEND_API_KEY"]

async def send_email(options: EmailOptions) -> None:
    resend.Emails.send({
        "from": "MyApp <noreply@myapp.com>",
        "to": options.to,
        "subject": options.subject,
        "html": render_template(options.template_id, options.data),
        "reply_to": "support@myapp.com",
        "tags": [{"name": "category", "value": options.category}],
    })
```

---

## 3. Email Types & Templates

| Email Type | Trigger | Priority | Tracking |
|-----------|---------|----------|----------|
| **Welcome** | user.registered | Normal | Open only |
| **Email Verification** | user.registered | High | None (security) |
| **Password Reset** | password.reset.requested | Critical | None (security) |
| **Order Confirmation** | order.confirmed | High | Open + click |
| **Shipping Update** | order.shipped | Normal | Open + click |
| **Invoice** | payment.completed | Normal | Open only |
| **2FA Code** | auth.2fa.requested | Critical | None (security) |
| **Account Locked** | auth.lockout | Critical | None |

- ALWAYS disable click tracking on security emails (password reset, 2FA)
- ALWAYS send security emails with highest priority
- ALWAYS include unsubscribe link on marketing-adjacent emails (CAN-SPAM)
- NEVER include sensitive data (passwords, full tokens) in email body

---

## 4. Email Authentication (DNS)

```
SPF Record:
  v=spf1 include:sendgrid.net include:amazonses.com ~all

DKIM Record:
  selector._domainkey.myapp.com IN TXT "v=DKIM1; k=rsa; p=..."

DMARC Record:
  _dmarc.myapp.com IN TXT "v=DMARC1; p=reject; rua=mailto:dmarc@myapp.com; pct=100"

  DMARC Policy:
  ├── p=none      → Monitor only (start here)
  ├── p=quarantine → Spam folder for failures
  └── p=reject    → Reject failures (goal)
```

- ALWAYS configure SPF, DKIM, and DMARC for your sending domain
- ALWAYS start with `p=none` DMARC policy, then escalate to `p=reject`
- ALWAYS use a dedicated subdomain for transactional email (e.g., `mail.myapp.com`)
- ALWAYS separate transactional and marketing email domains/IPs

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Sending in request path | Slow API responses, lost emails | Async via job queue |
| Running own SMTP server | Spam folder, maintenance burden | Use ESP (SendGrid, SES, Postmark) |
| No SPF/DKIM/DMARC | Emails land in spam | Configure DNS authentication |
| Sensitive data in emails | Security breach if intercepted | Links to secure pages, not data |
| No retry on send failure | Lost emails | Job queue with exponential backoff |
| Single send for bulk | Rate limiting, provider block | Batch API or queue individual jobs |
| No unsubscribe link | CAN-SPAM/GDPR violation | Always include unsubscribe |
| Same domain for marketing + transactional | Marketing spam affects transactional delivery | Separate domains/IPs |

---

## 6. Enforcement Checklist

- [ ] Transactional emails sent asynchronously via job queue
- [ ] Dedicated ESP used (SendGrid, SES, Postmark)
- [ ] SPF, DKIM, and DMARC configured on sending domain
- [ ] Dedicated subdomain for transactional email
- [ ] Security emails have click/open tracking disabled
- [ ] Retry logic with exponential backoff for failed sends
- [ ] No sensitive data (passwords, tokens) in email body
- [ ] Unsubscribe link on applicable emails
- [ ] Bounce and complaint webhooks processed
- [ ] Email send events logged for debugging
