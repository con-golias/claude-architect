# Strategy Pattern

> **Domain:** Fundamentals > Design Patterns > Behavioral
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Strategy pattern defines a **family of algorithms**, encapsulates each one, and makes them interchangeable. It lets the algorithm vary independently from the clients that use it. The client selects which strategy to use at runtime.

**GoF Intent:** "Define a family of algorithms, encapsulate each one, and make them interchangeable. Strategy lets the algorithm vary independently from clients that use it."

## How It Works

```typescript
// Strategy interface
interface CompressionStrategy {
  compress(data: Buffer): Buffer;
}

// Concrete strategies
class GzipStrategy implements CompressionStrategy {
  compress(data: Buffer): Buffer { return gzip(data); }
}

class BrotliStrategy implements CompressionStrategy {
  compress(data: Buffer): Buffer { return brotli(data); }
}

class NoCompressionStrategy implements CompressionStrategy {
  compress(data: Buffer): Buffer { return data; }
}

// Context
class FileCompressor {
  constructor(private strategy: CompressionStrategy) {}

  setStrategy(strategy: CompressionStrategy): void {
    this.strategy = strategy;
  }

  compressFile(path: string): Buffer {
    const data = readFile(path);
    return this.strategy.compress(data);
  }
}

// Usage — swap algorithms at runtime
const compressor = new FileCompressor(new GzipStrategy());
compressor.compressFile("data.json");

compressor.setStrategy(new BrotliStrategy());
compressor.compressFile("data.json");  // now uses Brotli
```

```python
# Python — strategies as functions (first-class functions)
from typing import Callable

PricingStrategy = Callable[[float], float]

def regular_pricing(price: float) -> float:
    return price

def premium_discount(price: float) -> float:
    return price * 0.8  # 20% off

def black_friday(price: float) -> float:
    return price * 0.5  # 50% off

class ShoppingCart:
    def __init__(self, pricing: PricingStrategy = regular_pricing):
        self.pricing = pricing
        self.items: list[float] = []

    def add(self, price: float):
        self.items.append(price)

    def total(self) -> float:
        return sum(self.pricing(item) for item in self.items)

cart = ShoppingCart(pricing=black_friday)
cart.add(100.0)
cart.total()  # 50.0
```

### Strategy vs Conditional Logic

```
Without Strategy:                    With Strategy:
if algo == "bubble":                 sorter = get_strategy(algo)
    bubble_sort(data)                sorter.sort(data)
elif algo == "merge":
    merge_sort(data)                 // Adding new algorithm:
elif algo == "quick":                // Just add a new class
    quick_sort(data)                 // No modification needed
// Adding new: modify this file       (Open/Closed Principle)
```

## Real-world Examples

- **`Array.sort(compareFn)`** — the comparator is a strategy.
- **Spring `@Qualifier`** — inject different implementations of the same interface.
- **Payment processing** — Stripe, PayPal, Square as interchangeable payment strategies.
- **Routing algorithms** — Google Maps switches between driving, walking, transit.
- **`java.util.Comparator`** — sorting strategy for collections.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 315-323.
- [Refactoring.Guru — Strategy](https://refactoring.guru/design-patterns/strategy)
