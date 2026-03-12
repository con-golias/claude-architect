# Observer Pattern

> **Domain:** Fundamentals > Design Patterns > Behavioral
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Observer pattern defines a **one-to-many dependency** between objects so that when one object (the subject) changes state, all its dependents (observers) are notified and updated automatically. It is the foundation of event-driven programming and reactive systems.

**GoF Intent:** "Define a one-to-many dependency between objects so that when one object changes state, all its dependents are notified and updated automatically."

## How It Works

```typescript
// Subject (Observable)
class EventEmitter<T> {
  private listeners = new Map<string, ((data: T) => void)[]>();

  on(event: string, callback: (data: T) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (data: T) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      this.listeners.set(event, callbacks.filter(cb => cb !== callback));
    }
  }

  emit(event: string, data: T): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }
}

// Usage
class StockMarket extends EventEmitter<{ symbol: string; price: number }> {
  updatePrice(symbol: string, price: number): void {
    this.emit("priceChange", { symbol, price });
  }
}

const market = new StockMarket();
market.on("priceChange", ({ symbol, price }) => {
  console.log(`UI: ${symbol} = $${price}`);
});
market.on("priceChange", ({ symbol, price }) => {
  if (price > 150) console.log(`ALERT: ${symbol} above threshold!`);
});

market.updatePrice("AAPL", 155);
// UI: AAPL = $155
// ALERT: AAPL above threshold!
```

```python
# Python — property-based observer
class Observable:
    def __init__(self):
        self._observers: list[callable] = []

    def subscribe(self, observer: callable):
        self._observers.append(observer)
        return lambda: self._observers.remove(observer)  # returns unsubscribe fn

    def notify(self, *args, **kwargs):
        for observer in self._observers:
            observer(*args, **kwargs)

class User(Observable):
    def __init__(self, name: str):
        super().__init__()
        self._name = name

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        old = self._name
        self._name = value
        self.notify("name", old, value)

user = User("Alice")
unsubscribe = user.subscribe(lambda prop, old, new: print(f"{prop}: {old} → {new}"))
user.name = "Bob"  # prints: name: Alice → Bob
unsubscribe()      # removes the observer
```

### Push vs Pull Model

```
Push: Subject sends data to observers       → subject.notify(data)
Pull: Subject notifies, observers query     → observer.update(); observer.getState()

Push: simpler, but observers receive data they may not need
Pull: more flexible, observers fetch only what they need
```

## Real-world Examples

- **DOM events** — `element.addEventListener("click", handler)`.
- **React `useState` + re-rendering** — state change triggers component re-render.
- **Vue.js reactivity** — `ref()` and `reactive()` use observer/proxy internally.
- **RxJS Observables** — reactive programming with streams of events.
- **Node.js `EventEmitter`** — built-in observer pattern.
- **Webhooks** — HTTP callbacks when events occur in external services.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 293-303.
- [Refactoring.Guru — Observer](https://refactoring.guru/design-patterns/observer)
