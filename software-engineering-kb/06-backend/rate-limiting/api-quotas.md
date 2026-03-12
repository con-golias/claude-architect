# API Quotas & Tiered Rate Limits

> **AI Plugin Directive — API Quota Management, Tiered Limits & Usage Tracking**
> You are an AI coding assistant. When generating, reviewing, or refactoring API quota code,
> follow EVERY rule in this document. Without quotas, heavy users degrade service for everyone
> and cost management becomes impossible. Treat each section as non-negotiable.

**Core Rule: ALWAYS enforce per-user/per-API-key quotas alongside rate limits. ALWAYS track usage for billing and analytics. ALWAYS communicate quota limits in response headers. ALWAYS provide quota status endpoints for clients.**

---

## 1. Quotas vs Rate Limits

```
┌──────────────────────────────────────────────────────────────┐
│              Quotas vs Rate Limits                             │
│                                                               │
│  RATE LIMIT: requests per second/minute (burst protection)  │
│  ├── Prevents overload in short timeframes                  │
│  ├── Example: 100 requests per minute                       │
│  └── Resets: every window (rolling)                         │
│                                                               │
│  QUOTA: total requests per day/month (usage cap)            │
│  ├── Prevents excessive usage over time                     │
│  ├── Example: 10,000 API calls per day                      │
│  └── Resets: daily/monthly (calendar)                       │
│                                                               │
│  Both are needed:                                            │
│  Rate limit protects the system                              │
│  Quota protects the business                                 │
└──────────────────────────────────────────────────────────────┘
```

| Tier | Rate Limit | Daily Quota | Monthly Quota | Price |
|------|-----------|-------------|---------------|-------|
| **Free** | 10 req/min | 1,000/day | 10,000/month | $0 |
| **Basic** | 60 req/min | 10,000/day | 100,000/month | $29 |
| **Pro** | 300 req/min | 100,000/day | 1,000,000/month | $99 |
| **Enterprise** | Custom | Custom | Custom | Custom |

---

## 2. TypeScript Implementation

```typescript
interface QuotaConfig {
  rateLimit: { requests: number; windowMs: number };
  dailyQuota: number;
  monthlyQuota: number;
}

const TIER_CONFIGS: Record<string, QuotaConfig> = {
  free:       { rateLimit: { requests: 10, windowMs: 60_000 }, dailyQuota: 1_000, monthlyQuota: 10_000 },
  basic:      { rateLimit: { requests: 60, windowMs: 60_000 }, dailyQuota: 10_000, monthlyQuota: 100_000 },
  pro:        { rateLimit: { requests: 300, windowMs: 60_000 }, dailyQuota: 100_000, monthlyQuota: 1_000_000 },
  enterprise: { rateLimit: { requests: 1000, windowMs: 60_000 }, dailyQuota: Infinity, monthlyQuota: Infinity },
};

class QuotaService {
  async checkQuota(apiKey: string): Promise<{
    allowed: boolean;
    remaining: { rate: number; daily: number; monthly: number };
    retryAfter?: number;
  }> {
    const user = await this.getApiKeyOwner(apiKey);
    const config = TIER_CONFIGS[user.tier];

    // Check rate limit
    const rateResult = await this.rateLimiter.isAllowed(apiKey);
    if (!rateResult.allowed) {
      return { allowed: false, remaining: { rate: 0, daily: 0, monthly: 0 }, retryAfter: rateResult.retryAfter };
    }

    // Check daily quota
    const dailyKey = `quota:daily:${apiKey}:${this.todayKey()}`;
    const dailyUsed = await this.redis.incr(dailyKey);
    if (dailyUsed === 1) await this.redis.expire(dailyKey, 86400);

    if (dailyUsed > config.dailyQuota) {
      return { allowed: false, remaining: { rate: rateResult.remaining, daily: 0, monthly: 0 } };
    }

    // Check monthly quota
    const monthlyKey = `quota:monthly:${apiKey}:${this.monthKey()}`;
    const monthlyUsed = await this.redis.incr(monthlyKey);
    if (monthlyUsed === 1) await this.redis.expire(monthlyKey, 86400 * 31);

    if (monthlyUsed > config.monthlyQuota) {
      return { allowed: false, remaining: { rate: rateResult.remaining, daily: config.dailyQuota - dailyUsed, monthly: 0 } };
    }

    return {
      allowed: true,
      remaining: {
        rate: rateResult.remaining,
        daily: config.dailyQuota - dailyUsed,
        monthly: config.monthlyQuota - monthlyUsed,
      },
    };
  }

  private todayKey(): string { return new Date().toISOString().slice(0, 10); }
  private monthKey(): string { return new Date().toISOString().slice(0, 7); }
}

// Middleware
app.use(async (req, res, next) => {
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey) throw new UnauthorizedError("API key required");

  const quota = await quotaService.checkQuota(apiKey);

  res.set("X-RateLimit-Limit", String(config.rateLimit.requests));
  res.set("X-RateLimit-Remaining", String(quota.remaining.rate));
  res.set("X-Quota-Daily-Remaining", String(quota.remaining.daily));
  res.set("X-Quota-Monthly-Remaining", String(quota.remaining.monthly));

  if (!quota.allowed) {
    if (quota.retryAfter) res.set("Retry-After", String(quota.retryAfter));
    return res.status(429).json({
      error: { type: "QUOTA_EXCEEDED", message: "API quota exceeded" },
    });
  }

  next();
});
```

---

## 3. Usage Tracking

```typescript
// Track API usage for billing and analytics
async function trackUsage(apiKey: string, endpoint: string, statusCode: number): Promise<void> {
  const event = {
    apiKey,
    endpoint: normalizeEndpoint(endpoint),
    statusCode,
    timestamp: new Date().toISOString(),
  };

  // Async: don't block request
  await usageQueue.add("track-usage", event);
}

// Aggregated usage query
async function getUsageSummary(apiKey: string, period: "day" | "month"): Promise<UsageSummary> {
  return db.apiUsage.aggregate({
    where: { apiKey, period },
    _sum: { requestCount: true },
    _count: { endpoint: true },
  });
}
```

---

## 4. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Rate limit only (no quota) | Heavy users run up costs | Daily/monthly quotas per tier |
| No usage tracking | Cannot bill, no analytics | Track every request async |
| Same limits for all users | Free users abuse, paying users throttled | Tiered quota system |
| No quota headers | Clients cannot track usage | X-Quota-*-Remaining headers |
| Quota check blocks request | Latency increase | Redis atomic operations |
| No quota status endpoint | Clients discover limits by hitting them | GET /api/quota/status |

---

## 5. Enforcement Checklist

- [ ] Rate limits AND quotas enforced (both needed)
- [ ] Tiered limits configured per subscription level
- [ ] Usage tracked per API key for billing
- [ ] Response headers include rate limit + quota remaining
- [ ] Quota status endpoint available for clients
- [ ] Monthly quota alerts at 80% and 100% usage
- [ ] Graceful degradation when quota exceeded (not hard block for critical paths)
