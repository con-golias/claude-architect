# LLM Cost Optimization

| Attribute | Value |
|-----------|-------|
| Domain | AI Integration > LLM Integration |
| Importance | Critical |
| Last Updated | 2026-03-10 |
| Cross-ref | [API Integration Patterns](api-integration-patterns.md), [Evaluation](evaluation.md) |

---

## Cost Model Fundamentals

### Token Pricing (per 1M tokens, March 2026)

| Provider | Model | Input | Output | Notes |
|----------|-------|-------|--------|-------|
| Anthropic | Claude Opus 4.6 | $5.00 | $25.00 | Most capable |
| Anthropic | Claude Sonnet 4.6 | $3.00 | $15.00 | Best balance |
| Anthropic | Claude Haiku 4.5 | $1.00 | $5.00 | Fastest, cheapest |
| OpenAI | GPT-5.4 | $2.50 | $10.00 | General purpose |
| OpenAI | GPT-4.1 mini | $0.40 | $1.60 | Budget option |
| Google | Gemini 2.5 Pro | $1.25 | $10.00 | Long context (1M) |
| Google | Gemini 2.5 Flash | $0.15 | $0.60 | Ultra-cheap |
| DeepSeek | DeepSeek-V3 | $0.14 | $0.28 | Open-weight leader |

**Key insight:** Output tokens cost 2-5x more than input tokens. Optimize output length aggressively.

### Cost Estimation

```python
def estimate_cost(input_tok, output_tok, in_price, out_price, reqs_per_day):
    daily = (input_tok * reqs_per_day / 1e6) * in_price + \
            (output_tok * reqs_per_day / 1e6) * out_price
    return {"daily": daily, "monthly": daily * 30, "per_request": daily / reqs_per_day}

# 2000 input + 500 output, 10K req/day, Claude Sonnet ($3/$15 per 1M)
# => $135/day, $4,050/month, $0.0135/request
```

---

## Token Optimization

### Prompt Compression

```python
# Before (850 tokens): verbose, repetitive instructions
VERBOSE = """You are an expert customer support agent working for Acme Corp.
Your job is to help customers with their questions about our products.
You should be polite, professional, and thorough in your responses..."""

# After (180 tokens, 79% reduction): same behavior, fewer tokens
COMPRESSED = """You are Acme Corp support. Answer accurately and concisely.
If unsure, say so. Question:"""
```

### Control Output Length

```typescript
// Force concise structured output instead of verbose prose
const response = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 256, // Hard cap on output tokens
  messages: [{ role: "user", content: query }],
  system: `Respond in JSON only: {"answer": "...", "confidence": 0-1}`,
});
```

### Context Window Management

```python
def manage_context(messages: list[dict], max_tokens: int = 8000) -> list[dict]:
    """Summarize old messages when context exceeds budget."""
    total = sum(count_tokens(m["content"]) for m in messages)
    if total <= max_tokens:
        return messages
    # Summarize older half, keep recent messages verbatim
    mid = len(messages) // 2
    summary = summarize_conversation(messages[:mid])
    return [{"role": "user", "content": f"[Context: {summary}]"}] + messages[mid:]
```

---

## Caching Strategies

### Prompt Caching (Anthropic)

Anthropic prompt caching reduces input token costs by 90% for repeated context:

```python
from anthropic import Anthropic

client = Anthropic()

# The large system prompt is cached across requests
response = client.messages.create(
    model="claude-sonnet-4-5-20250514",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": large_system_prompt,  # 5000+ tokens
            "cache_control": {"type": "ephemeral"},  # Cache this block
        }
    ],
    messages=[{"role": "user", "content": user_query}],
)
# First request: full price. Subsequent: 90% off cached portion.
# Cache TTL: 5 minutes (refreshed on use)
```

### Semantic Caching

Cache responses based on semantic similarity, not exact string match:

```python
class SemanticCache:
    def __init__(self, vector_store, embed_fn, threshold: float = 0.95):
        self.store = vector_store
        self.embed = embed_fn
        self.threshold = threshold

    async def get(self, query: str) -> str | None:
        results = await self.store.search(await self.embed(query), limit=1)
        if results and results[0].score >= self.threshold:
            return results[0].payload["response"]
        return None

    async def set(self, query: str, response: str) -> None:
        await self.store.upsert(
            id=hashlib.sha256(query.encode()).hexdigest(),
            vector=await self.embed(query),
            payload={"query": query, "response": response},
        )
# Achieves 30-60% hit rates for FAQ/support patterns
```

### Cache-Friendly Prompt Design

```
# BAD: Unique per request, uncacheable
"The current time is 2026-03-10T14:32:07Z. User John (ID: 12345) asks: ..."

# GOOD: Static prefix cached, dynamic suffix appended
[CACHED] System prompt + instructions + few-shot examples (5000 tokens)
[DYNAMIC] "User asks: ..." (50 tokens)
```

---

## Model Routing

### Route by Complexity

```typescript
function routeRequest(context: RequestContext): string {
  if (context.taskType === "classification" || context.taskType === "extraction")
    return "claude-haiku-4-5";     // ~$0.001/req

  if (context.taskType === "code-generation" || context.requiresReasoning)
    return "claude-sonnet-4-5";    // ~$0.015/req

  if (context.taskType === "research" || context.requiresMultiStep)
    return "claude-opus-4-6";      // ~$0.05/req

  return "claude-sonnet-4-5";      // Default
}
```

### Model Cascading

Try a cheap model first; escalate to a more capable model if confidence is low:

```python
async def cascade_query(query: str) -> str:
    # Stage 1: Fast, cheap model
    fast_response = await call_llm("claude-haiku-4-5", query)
    confidence = await assess_confidence(fast_response)

    if confidence >= 0.85:
        return fast_response.text  # Cost: ~$0.001

    # Stage 2: Escalate to more capable model
    detailed_response = await call_llm("claude-sonnet-4-5", query)
    return detailed_response.text  # Cost: ~$0.015

    # Result: If 70% of queries resolve at stage 1,
    # effective cost = 0.7 * $0.001 + 0.3 * $0.016 = $0.0055 (63% savings)
```

---

## Batching

### Batch API (50% Cost Reduction)

Process non-urgent requests asynchronously at half price:

```python
from anthropic import Anthropic

client = Anthropic()

# Create batch of requests
batch = client.batches.create(
    requests=[
        {
            "custom_id": f"eval-{i}",
            "params": {
                "model": "claude-sonnet-4-5-20250514",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": q}],
            },
        }
        for i, q in enumerate(questions)
    ]
)
# batch.id -> poll for completion (up to 24h)
# Cost: 50% of standard pricing
```

### When to Batch

| Scenario | Batch? | Reason |
|----------|--------|--------|
| Evaluation pipelines | Yes | Not time-sensitive, high volume |
| Content generation | Yes | Can wait hours for results |
| Nightly report generation | Yes | Scheduled, bulk processing |
| Real-time chat | No | Requires immediate response |
| Interactive coding assistant | No | Latency-critical |

---

## Fine-Tuning vs. Prompting

### Decision Framework

| Factor | Prompting | Fine-Tuning |
|--------|-----------|-------------|
| Setup cost | $0 | $50-500+ (training) |
| Per-request cost | Higher (long prompts) | Lower (shorter prompts) |
| Break-even volume | < 10K requests/month | > 50K requests/month |
| Flexibility | Change anytime | Requires retraining |
| Quality ceiling | Limited by prompt length | Can exceed base model on domain |
| Maintenance | Update prompts | Retrain on new data |

Fine-tune when: high volume, consistent task, prompt is 70%+ static context, and quality must exceed what prompting achieves.

---

## Cost Monitoring

### Per-Feature Cost Tracking

```typescript
interface LLMUsageEvent {
  feature: string;    // "chat", "code-review", "summarize"
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
  userId: string;
  timestamp: Date;
}

class CostTracker {
  async track(event: LLMUsageEvent): Promise<void> {
    await this.metricsDb.insert("llm_usage", event);
    const dailySpend = await this.getDailySpend(event.feature);
    const budget = await this.getBudget(event.feature);
    if (dailySpend > budget * 0.8) {
      await this.alert(`${event.feature} at ${Math.round(dailySpend/budget*100)}% of budget`);
    }
  }
}
```

### Budget Circuit Breakers

```python
class CostCircuitBreaker:
    def __init__(self, hourly_limit: float, daily_limit: float):
        self.hourly_limit = hourly_limit
        self.daily_limit = daily_limit

    async def check(self, feature: str) -> bool:
        if await self.get_hourly_spend(feature) > self.hourly_limit:
            raise CostLimitExceeded(f"{feature}: hourly limit exceeded")
        if await self.get_daily_spend(feature) > self.daily_limit:
            raise CostLimitExceeded(f"{feature}: daily limit exceeded")
        return True
```

---

## Open-Source Alternatives

### Self-Hosted vs. API

| Factor | API (Claude, GPT) | Self-Hosted (Llama, Mistral) |
|--------|-------------------|-------------------------------|
| Upfront cost | $0 | $5K-50K+ (GPU infrastructure) |
| Per-request cost | $0.001-0.05 | Near-zero marginal |
| Break-even | < 500K requests/month | > 500K requests/month |
| Quality | Frontier | 80-95% of frontier |
| Latency | 1-5s (network + inference) | 0.5-2s (local inference) |
| Data privacy | Data sent to provider | Full control |
| Maintenance | None | MLOps team required |

Self-host when: data cannot leave infrastructure (regulation), volume exceeds 1M requests/day, or latency-critical local inference is required.

---

## Rate Limiting and Queue Management

### Smoothing Traffic

```typescript
import { RateLimiter } from "limiter";

// Anthropic rate limits: 4000 RPM for Sonnet
const limiter = new RateLimiter({
  tokensPerInterval: 4000,
  interval: "minute",
});

async function callWithRateLimit(request: LLMRequest): Promise<LLMResponse> {
  await limiter.removeTokens(1);
  return callLLM(request);
}
```

### Priority Queues

```python
from enum import IntEnum

class Priority(IntEnum):
    CRITICAL = 0  # Real-time user-facing
    HIGH = 1      # Interactive, can wait 2-3s
    NORMAL = 2    # Background processing
    LOW = 3       # Batch, eval, non-urgent

# Use asyncio.PriorityQueue to process high-priority requests first
# Workers dequeue (priority, timestamp, request) and call LLM with rate limiting
```

---

## 10 Best Practices

1. **Track cost per feature, not just total spend.** Attribute every LLM call to a product feature. Identify which features drive 80% of cost and optimize those first.
2. **Use prompt caching for repeated context.** System prompts, few-shot examples, and static instructions should be cached. Anthropic prompt caching saves 90% on cached tokens.
3. **Route by task complexity.** Use Haiku/Flash for classification, extraction, and simple Q&A. Reserve Sonnet/GPT-4 for reasoning. Reserve Opus for frontier tasks. This alone saves 50-80%.
4. **Cap output tokens aggressively.** Set `max_tokens` to the minimum needed. Use structured output (JSON) to prevent verbose prose. Output tokens cost 2-5x more than input.
5. **Batch non-urgent requests.** Evaluation, content generation, and reports can use batch APIs at 50% discount. Design systems to separate real-time from async workloads.
6. **Implement semantic caching.** For high-overlap query patterns (customer support, FAQ), semantic caching with 0.95 threshold can achieve 30-60% cache hit rates.
7. **Set budget alerts and circuit breakers.** Configure hourly and daily spend limits per feature. Circuit breakers prevent cost spikes from bugs or traffic surges.
8. **Compress prompts without losing quality.** Remove filler words, use concise instructions, and reference documentation by ID instead of including full text. Measure quality after compression.
9. **Summarize long conversations.** Replace old message history with summaries to prevent context growth. Keep only the last 5-10 messages verbatim.
10. **Re-evaluate model choices quarterly.** Pricing changes rapidly. A model that was cost-optimal three months ago may not be today. Re-benchmark regularly.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Using frontier model for all tasks | 10-50x overspend on simple tasks | Route by complexity, cascade models |
| No max_tokens limit | Model generates verbose outputs | Set max_tokens to minimum needed |
| Full conversation history in every request | Context grows unbounded, cost scales linearly | Summarize old messages, use sliding window |
| No caching layer | Identical queries re-processed at full cost | Add semantic cache with vector similarity |
| Ignoring batch API for async workloads | Paying full price for non-urgent processing | Use batch API for eval, reports, generation |
| No cost monitoring | Budget overruns discovered on invoice | Track per-feature spend with real-time alerts |
| Embedding full documents in prompts | Massive input token costs | Use RAG to retrieve only relevant chunks |
| No rate limiting | Hitting provider limits, 429 errors | Implement rate limiter and priority queue |

---

## Enforcement Checklist

- [ ] Cost tracking implemented per feature with attribution
- [ ] Budget alerts configured (hourly and daily thresholds)
- [ ] Circuit breaker stops requests when budget exceeded
- [ ] Model routing logic implemented (cheap for simple, expensive for complex)
- [ ] Prompt caching enabled for system prompts and static context
- [ ] Semantic caching evaluated for high-overlap query patterns
- [ ] max_tokens set explicitly on every LLM call
- [ ] Batch API used for all non-real-time workloads
- [ ] Conversation summarization prevents unbounded context growth
- [ ] Rate limiting configured per provider rate limits
- [ ] Monthly cost review with model/pricing re-evaluation
- [ ] Cost-per-quality metric tracked alongside quality metrics
