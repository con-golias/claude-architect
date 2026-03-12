# LLM API Integration Patterns

| Attribute | Value |
|-----------|-------|
| Domain | AI Integration > LLM Integration |
| Importance | Critical |
| Last Updated | 2026-03-10 |
| Cross-ref | [Prompt Engineering](prompt-engineering.md), [Cost Optimization](cost-optimization.md) |

---

## API Provider Landscape

| Provider | Models | Strengths | SDK |
|----------|--------|-----------|-----|
| Anthropic | Claude Opus, Sonnet, Haiku | Reasoning, safety, 200K context | `@anthropic-ai/sdk` |
| OpenAI | GPT-4.1, o3, o4-mini | Ecosystem, vision, function calling | `openai` |
| Google | Gemini 2.5 Pro/Flash | Multimodal, 1M context | `@google/genai` |
| Open-source | Llama 3, Mistral, DeepSeek | Privacy, cost control, customization | Ollama, vLLM |

---

## SDK Integration

### Anthropic SDK (TypeScript)

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // ANTHROPIC_API_KEY env var

async function generateCode(prompt: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0.1,
    system: 'You are a senior TypeScript developer. Write clean, typed code.',
    messages: [{ role: 'user', content: prompt }],
  });
  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text ?? '';
}
```

### Anthropic SDK (Python)

```python
import anthropic

client = anthropic.Anthropic()  # ANTHROPIC_API_KEY env var

def generate_code(prompt: str) -> str:
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        temperature=0.1,
        system="You are a senior Python developer. Write clean, typed code.",
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text
```

### OpenAI SDK (TypeScript)

```typescript
import OpenAI from 'openai';

const client = new OpenAI(); // OPENAI_API_KEY env var

async function generateCode(prompt: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: 'gpt-4.1',
    temperature: 0.1,
    messages: [
      { role: 'system', content: 'You are a senior TypeScript developer.' },
      { role: 'user', content: prompt },
    ],
  });
  return response.choices[0]?.message?.content ?? '';
}
```

### Vercel AI SDK (Provider-Agnostic)

```typescript
import { generateText, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  // model: openai('gpt-4.1'),  // swap provider with one line
  prompt: 'Write a TypeScript email validation function',
});
```

---

## Streaming Responses

### Anthropic Streaming (TypeScript)

```typescript
async function streamResponse(prompt: string): Promise<void> {
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  stream.on('text', (text) => process.stdout.write(text));
  const finalMessage = await stream.finalMessage();
  console.log('\nTokens:', finalMessage.usage);
}
```

### Anthropic Streaming (Python)

```python
def stream_response(prompt: str) -> str:
    parts = []
    with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
            parts.append(text)
    return "".join(parts)
```

### Server-to-Client Streaming (Next.js)

```typescript
// app/api/chat/route.ts
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({ model: anthropic('claude-sonnet-4-20250514'), messages });
  return result.toDataStreamResponse();
}
```

---

## Error Handling and Resilience

### Exponential Backoff with Jitter

```typescript
async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3, baseDelay = 1000, maxDelay = 30000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const isRetryable =
        error instanceof Anthropic.RateLimitError ||
        error instanceof Anthropic.InternalServerError ||
        error instanceof Anthropic.APIConnectionError;
      if (!isRetryable) throw error;

      const delay = Math.min(baseDelay * 2 ** attempt + Math.random() * 1000, maxDelay);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Unreachable');
}
```

### Fallback Provider Chain

```typescript
class FallbackChain {
  constructor(private providers: LLMProvider[]) {}

  async generate(prompt: string): Promise<{ text: string; provider: string }> {
    for (const provider of this.providers) {
      try {
        const text = await provider.generate(prompt);
        return { text, provider: provider.name };
      } catch (error) {
        console.warn(`${provider.name} failed:`, error);
        continue;
      }
    }
    throw new Error('All providers exhausted');
  }
}

// Primary -> secondary -> local fallback
const chain = new FallbackChain([
  new AnthropicProvider('claude-sonnet-4-20250514'),
  new OpenAIProvider('gpt-4.1'),
  new OllamaProvider('llama3:70b'),
]);
```

### Circuit Breaker

Wrap LLM calls in a circuit breaker (threshold: 5 failures, reset: 60s). Track consecutive failures; when threshold is exceeded, open the circuit and reject calls immediately. After the reset interval, allow one trial request (half-open). On success, close the circuit. This prevents cascading failures when a provider is degraded. See [10-scalability/patterns/circuit-breaker.md](../../10-scalability/patterns/circuit-breaker.md) for full implementation.

---

## Caching Strategies

### Anthropic Prompt Caching

```typescript
// Cache large system prompts -- 90% cost reduction on cached tokens
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  system: [{
    type: 'text',
    text: longSystemPrompt, // 10K+ tokens cached across requests
    cache_control: { type: 'ephemeral' },
  }],
  messages: [{ role: 'user', content: userQuery }],
});
```

### Response Caching (Redis)

```typescript
import { createHash } from 'crypto';
import Redis from 'ioredis';
const redis = new Redis();

function hashPrompt(model: string, messages: unknown[]): string {
  return createHash('sha256').update(JSON.stringify({ model, messages })).digest('hex');
}

async function cachedGenerate(
  model: string,
  messages: Array<{ role: string; content: string }>,
  ttl = 3600
): Promise<string> {
  const key = `llm:${hashPrompt(model, messages)}`;
  const cached = await redis.get(key);
  if (cached) return cached;

  const response = await client.messages.create({ model, max_tokens: 4096, messages });
  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  await redis.setex(key, ttl, text);
  return text;
}
```

### Semantic Caching

Semantic caching stores responses keyed by embedding similarity rather than exact prompt match. Use `sentence-transformers` to encode prompts, compare cosine similarity (threshold ~0.95), and return cached responses for semantically equivalent queries. This reduces redundant calls when users rephrase the same question.

---

## Middleware: Cost Tracking

```typescript
class CostTracker {
  private totalCost = 0;
  private pricing: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
    'claude-haiku-4-20250514': { input: 0.25, output: 1.25 },
  };

  track(model: string, usage: { input_tokens: number; output_tokens: number }): void {
    const price = this.pricing[model];
    if (!price) return;
    const cost = (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1e6;
    this.totalCost += cost;
    console.log(`Cost: $${cost.toFixed(6)} | Total: $${this.totalCost.toFixed(4)}`);
  }
}
```

---

## Multi-Provider Abstraction

**LiteLLM** -- Call 100+ LLM APIs with one interface. Use `litellm.completion(model="claude-sonnet-4-20250514", ...)` for Anthropic, `model="gpt-4.1"` for OpenAI, or `model="ollama/llama3:70b"` for local models. Same function signature, swap providers by changing the model string.

**Vercel AI SDK** -- Framework-agnostic TypeScript SDK. Swap `anthropic('claude-sonnet-4-20250514')` with `openai('gpt-4.1')` with a single line change.

**AI Gateway** -- Deploy an API gateway (LiteLLM Proxy, Portkey, Helicone) in front of all providers for unified logging, rate limiting, cost tracking, and automatic failover.

---

## Batch Processing

### Anthropic Batch API (50% Cost Reduction)

```python
import anthropic, time

client = anthropic.Anthropic()

batch = client.messages.batches.create(
    requests=[
        {
            "custom_id": f"review-{i}",
            "params": {
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 2048,
                "messages": [{"role": "user", "content": f"Review:\n{code}"}],
            },
        }
        for i, code in enumerate(code_files)
    ]
)

while batch.processing_status != "ended":
    time.sleep(30)
    batch = client.messages.batches.retrieve(batch.id)

for result in client.messages.batches.results(batch.id):
    print(f"{result.custom_id}: {result.result.message.content[0].text[:100]}")
```

### Queue-Based Processing

Use BullMQ, Celery, or SQS to queue LLM requests. Configure rate limiter (`max: 10, duration: 60_000`) and concurrency to stay within API limits. Workers dequeue jobs, call the LLM, and store results. This decouples request submission from processing and handles backpressure automatically.

---

## 10 Best Practices

1. **Use provider SDKs, not raw HTTP.** Official SDKs handle auth, retries, streaming, and type safety.

2. **Implement exponential backoff with jitter.** Rate limits are inevitable. Combine exponential delay with random jitter to avoid thundering herd.

3. **Cache deterministic requests aggressively.** Same model + messages at temperature 0 = same output. Cache to reduce cost and latency.

4. **Use Anthropic prompt caching for large system prompts.** Mark static content with `cache_control` for 90% cost reduction on repeated context.

5. **Stream responses for user-facing applications.** Time-to-first-token matters. Stream to UI rather than waiting for full response.

6. **Track token usage and costs per endpoint.** Instrument every call with token counts and cost. Set budget alerts and per-feature limits.

7. **Build provider-agnostic abstractions.** Wrap SDKs behind a common interface for fallback chains, A/B testing, and migration.

8. **Use batch APIs for non-real-time workloads.** Anthropic/OpenAI batch APIs offer 50% cost reduction for bulk processing.

9. **Implement circuit breakers for LLM calls.** Prevent cascading failures. Fall back to cache or alternative providers when one is down.

10. **Validate all LLM outputs before use.** Parse with schema validation (Zod, Pydantic). Never trust raw output for SQL, shell, or code execution.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| No retry logic | Transient errors cause user failures | Exponential backoff with jitter |
| Single hardcoded provider | Vendor lock-in, no failover | Provider-agnostic abstraction layer |
| Ignoring token costs | Surprise bills, budget overruns | Per-request cost tracking with alerts |
| Synchronous batch processing | Slow, expensive, blocks resources | Batch APIs or queue-based async |
| No response caching | Unnecessary cost and latency | Hash prompts, cache with TTL |
| Full context every request | Wasted tokens, high cost | Prompt caching, conversation summarization |
| No timeouts on LLM calls | Hung requests consume resources | 30-120s timeouts based on task |
| Logging prompts with PII | Privacy/compliance violations | Redact PII, log metadata only |

---

## Enforcement Checklist

- [ ] Official SDK used for each LLM provider
- [ ] Retry logic with exponential backoff and jitter
- [ ] Circuit breaker wraps all external LLM calls
- [ ] Token usage and cost tracked per request with alerting
- [ ] Response caching for deterministic requests
- [ ] Streaming enabled for user-facing responses
- [ ] Provider-agnostic interface allows fallback and model swapping
- [ ] Batch API used for non-real-time bulk processing
- [ ] All LLM outputs validated against schemas before use
- [ ] Request timeouts configured (30-120s)
