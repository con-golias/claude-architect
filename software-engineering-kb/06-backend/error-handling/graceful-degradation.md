# Graceful Degradation

> **AI Plugin Directive — Graceful Degradation & Fallback Patterns**
> You are an AI coding assistant. When generating, reviewing, or refactoring degradation
> logic, follow EVERY rule in this document. Without graceful degradation, a single failing
> dependency causes total system failure. Treat each section as non-negotiable.

**Core Rule: ALWAYS provide fallback behavior when dependencies fail. ALWAYS isolate failures to the failing component — NEVER let one dependency failure cascade to unrelated features. ALWAYS use the bulkhead pattern to limit blast radius. ALWAYS communicate degraded state to callers.**

---

## 1. Degradation Strategy

```
┌──────────────────────────────────────────────────────────────┐
│              Degradation Decision Tree                         │
│                                                               │
│  Dependency failed                                           │
│  ├── Is there cached data?                                   │
│  │   ├── YES → Serve stale cache (mark as degraded)         │
│  │   └── NO → Continue ↓                                    │
│  │                                                           │
│  ├── Is there a simpler fallback?                            │
│  │   ├── YES → Use fallback (default value, static data)    │
│  │   └── NO → Continue ↓                                    │
│  │                                                           │
│  ├── Is the feature critical to the request?                 │
│  │   ├── YES → Return error (503 + retry guidance)          │
│  │   └── NO → Omit feature, serve partial response          │
│  │                                                           │
│  Key principle:                                              │
│  Return SOMETHING useful rather than NOTHING                 │
│  A degraded response beats an error page                     │
└──────────────────────────────────────────────────────────────┘
```

| Strategy | When to Use | Example |
|----------|------------|---------|
| **Stale cache** | Data can be slightly outdated | Product catalog from cache |
| **Default value** | Missing data has safe default | Default currency = USD |
| **Feature toggle off** | Non-critical feature fails | Disable recommendations |
| **Partial response** | Some data available | Return order without reviews |
| **Queue for later** | Write path fails | Queue payment for retry |
| **Static fallback** | Dynamic content unavailable | Serve static landing page |

---

## 2. TypeScript Implementation

```typescript
interface DegradationResult<T> {
  data: T;
  degraded: boolean;
  degradedServices: string[];
  message?: string;
}

class GracefulService {
  async getProductPage(productId: string): Promise<DegradationResult<ProductPage>> {
    const degradedServices: string[] = [];

    // Critical — MUST succeed
    const product = await this.productService.getById(productId);
    if (!product) throw new NotFoundError("Product", productId);

    // Non-critical — degrade gracefully
    const [reviews, recommendations, inventory] = await Promise.allSettled([
      this.reviewService.getForProduct(productId),
      this.recommendationService.getSimilar(productId),
      this.inventoryService.getStock(productId),
    ]);

    const reviewData = unwrapOrDefault(reviews, [], "review-service", degradedServices);
    const recsData = unwrapOrDefault(recommendations, [], "recommendation-service", degradedServices);
    const stockData = unwrapOrDefault(inventory, { inStock: true, quantity: null }, "inventory-service", degradedServices);

    return {
      data: { product, reviews: reviewData, recommendations: recsData, inventory: stockData },
      degraded: degradedServices.length > 0,
      degradedServices,
      message: degradedServices.length > 0
        ? `Partial response: ${degradedServices.join(", ")} unavailable`
        : undefined,
    };
  }
}

function unwrapOrDefault<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  serviceName: string,
  degraded: string[],
): T {
  if (result.status === "fulfilled") return result.value;
  logger.warn("Service degraded", { service: serviceName, error: result.reason?.message });
  metrics.increment("degradation.fallback_used", { service: serviceName });
  degraded.push(serviceName);
  return fallback;
}
```

---

## 3. Go Implementation

```go
type DegradedResponse[T any] struct {
    Data             T        `json:"data"`
    Degraded         bool     `json:"degraded"`
    DegradedServices []string `json:"degradedServices,omitempty"`
}

func (s *ProductService) GetProductPage(ctx context.Context, id string) (*DegradedResponse[ProductPage], error) {
    product, err := s.productRepo.GetByID(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("get product: %w", err)
    }

    var degraded []string
    page := ProductPage{Product: product}

    // Non-critical calls with fallback
    var wg sync.WaitGroup
    var mu sync.Mutex

    wg.Add(3)

    go func() {
        defer wg.Done()
        reviews, err := s.reviewClient.GetForProduct(ctx, id)
        mu.Lock()
        defer mu.Unlock()
        if err != nil {
            slog.Warn("review service degraded", "error", err)
            degraded = append(degraded, "review-service")
            page.Reviews = []Review{} // empty fallback
        } else {
            page.Reviews = reviews
        }
    }()

    go func() {
        defer wg.Done()
        recs, err := s.recClient.GetSimilar(ctx, id)
        mu.Lock()
        defer mu.Unlock()
        if err != nil {
            slog.Warn("recommendation service degraded", "error", err)
            degraded = append(degraded, "recommendation-service")
            page.Recommendations = []Product{}
        } else {
            page.Recommendations = recs
        }
    }()

    go func() {
        defer wg.Done()
        stock, err := s.inventoryClient.GetStock(ctx, id)
        mu.Lock()
        defer mu.Unlock()
        if err != nil {
            slog.Warn("inventory service degraded", "error", err)
            degraded = append(degraded, "inventory-service")
            page.Inventory = &Inventory{InStock: true} // optimistic default
        } else {
            page.Inventory = stock
        }
    }()

    wg.Wait()

    return &DegradedResponse[ProductPage]{
        Data:             page,
        Degraded:         len(degraded) > 0,
        DegradedServices: degraded,
    }, nil
}
```

---

## 4. Python Implementation

```python
from dataclasses import dataclass, field
import asyncio

@dataclass
class DegradedResponse(Generic[T]):
    data: T
    degraded: bool = False
    degraded_services: list[str] = field(default_factory=list)

async def safe_call(
    coro, fallback, service_name: str, degraded: list[str],
):
    """Execute with fallback on failure."""
    try:
        return await coro
    except Exception as e:
        logger.warning("Service degraded", extra={
            "service": service_name, "error": str(e),
        })
        metrics.increment("degradation.fallback_used", tags={"service": service_name})
        degraded.append(service_name)
        return fallback

async def get_product_page(product_id: str) -> DegradedResponse[ProductPage]:
    product = await product_repo.get_by_id(product_id)
    if not product:
        raise NotFoundError("Product", product_id)

    degraded: list[str] = []

    reviews, recs, stock = await asyncio.gather(
        safe_call(review_client.get_for_product(product_id), [], "review-service", degraded),
        safe_call(rec_client.get_similar(product_id), [], "recommendation-service", degraded),
        safe_call(inventory_client.get_stock(product_id), {"in_stock": True}, "inventory-service", degraded),
    )

    return DegradedResponse(
        data=ProductPage(product=product, reviews=reviews, recommendations=recs, inventory=stock),
        degraded=len(degraded) > 0,
        degraded_services=degraded,
    )
```

---

## 5. Bulkhead Pattern

```typescript
// Isolate dependencies into separate resource pools
// Failure in one pool cannot exhaust resources for others

class Bulkhead {
  private active = 0;

  constructor(
    private readonly name: string,
    private readonly maxConcurrent: number,
    private readonly maxQueue: number,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent + this.maxQueue) {
      metrics.increment("bulkhead.rejected", { name: this.name });
      throw new Error(`Bulkhead ${this.name} full`);
    }

    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
    }
  }
}

// Separate bulkheads per dependency
const paymentBulkhead = new Bulkhead("payment", 10, 5);
const inventoryBulkhead = new Bulkhead("inventory", 20, 10);
const emailBulkhead = new Bulkhead("email", 5, 50); // low concurrency, high queue

async function chargePayment(order: Order): Promise<PaymentResult> {
  return paymentBulkhead.execute(() => paymentClient.charge(order));
}
```

```go
// Go: use semaphore for bulkhead
type Bulkhead struct {
    name string
    sem  chan struct{}
}

func NewBulkhead(name string, maxConcurrent int) *Bulkhead {
    return &Bulkhead{
        name: name,
        sem:  make(chan struct{}, maxConcurrent),
    }
}

func (b *Bulkhead) Execute(ctx context.Context, fn func() error) error {
    select {
    case b.sem <- struct{}{}:
        defer func() { <-b.sem }()
        return fn()
    case <-ctx.Done():
        return ctx.Err()
    default:
        metrics.Increment("bulkhead.rejected", map[string]string{"name": b.name})
        return fmt.Errorf("bulkhead %s: max concurrency reached", b.name)
    }
}
```

---

## 6. Stale Cache Fallback

```typescript
class StaleCacheService {
  constructor(
    private cache: Redis,
    private ttlSeconds: number,
    private staleTtlSeconds: number, // Extended TTL for fallback
  ) {}

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
  ): Promise<{ data: T; stale: boolean }> {
    // Try fresh fetch
    try {
      const fresh = await fetcher();
      // Store with extended TTL
      await this.cache.set(key, JSON.stringify(fresh), "EX", this.staleTtlSeconds);
      await this.cache.set(`${key}:fresh_until`, Date.now() + this.ttlSeconds * 1000);
      return { data: fresh, stale: false };
    } catch (error) {
      // Fetch failed — try stale cache
      const cached = await this.cache.get(key);
      if (cached) {
        logger.warn("Serving stale cache", { key, error: (error as Error).message });
        metrics.increment("cache.stale_served", { key });
        return { data: JSON.parse(cached), stale: true };
      }
      // No cache at all — must fail
      throw error;
    }
  }
}
```

- ALWAYS store cache entries with an extended "stale" TTL beyond the fresh TTL
- ALWAYS mark stale responses so callers know data may be outdated
- ALWAYS track stale cache hits as a metric

---

## 7. Feature Flags for Degradation

```typescript
// Use feature flags to quickly disable non-critical features
class DegradationFlags {
  async isEnabled(feature: string): Promise<boolean> {
    try {
      return await this.flagService.isEnabled(feature);
    } catch {
      // Flag service itself failed — degrade to defaults
      return this.defaults.get(feature) ?? true;
    }
  }
}

// In request handler
async function getHomePage(req: Request, res: Response) {
  const page: HomePage = { products: await productService.getFeatured() };

  if (await degradationFlags.isEnabled("recommendations")) {
    page.recommendations = await safeCall(
      () => recService.getPersonalized(req.user.id),
      [],
    );
  }

  if (await degradationFlags.isEnabled("live-chat")) {
    page.chatConfig = await safeCall(
      () => chatService.getConfig(),
      null,
    );
  }

  res.json(page);
}
```

- ALWAYS have a kill switch for every non-critical feature
- ALWAYS default to "enabled" when the flag service itself is down
- ALWAYS log when features are disabled due to degradation

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| All-or-nothing responses | One service down → entire page fails | `Promise.allSettled` + fallbacks |
| No fallback values | Error propagates to user | Default values for non-critical data |
| Silent degradation | Users unaware of missing data | Mark response as degraded |
| No isolation between dependencies | Payment failure blocks browsing | Bulkhead pattern per dependency |
| Stale cache without TTL | Serving ancient data forever | Extended stale TTL with limit |
| Cascading timeouts | Slow dependency blocks all requests | Separate timeout + bulkhead |
| No metrics on degradation | Cannot track reliability | Track fallback usage rate |
| Degradation without recovery | Service stays degraded after recovery | Circuit breaker half-open test |

---

## 9. Enforcement Checklist

- [ ] Every non-critical dependency has a fallback value
- [ ] `Promise.allSettled` (or equivalent) used for parallel non-critical calls
- [ ] Bulkhead pattern isolates each dependency's resource pool
- [ ] Stale cache fallback configured for read-heavy services
- [ ] Degraded responses marked with `degraded: true` flag
- [ ] Feature flags enable quick disable of failing features
- [ ] Degradation events logged with service name and error
- [ ] Degradation rate tracked as metrics per service
- [ ] Circuit breaker combined with degradation for automatic recovery
- [ ] Critical vs non-critical dependencies explicitly classified
