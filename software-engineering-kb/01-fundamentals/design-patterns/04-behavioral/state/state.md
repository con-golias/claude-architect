# State Pattern

> **Domain:** Fundamentals > Design Patterns > Behavioral
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The State pattern allows an object to **change its behavior when its internal state changes**. The object appears to change its class. Instead of large `if/else` or `switch` statements checking the current state, each state becomes its own class with specific behavior.

**GoF Intent:** "Allow an object to alter its behavior when its internal state changes. The object will appear to change its class."

## How It Works

```typescript
// State interface
interface OrderState {
  next(order: Order): void;
  cancel(order: Order): void;
  toString(): string;
}

// Concrete states
class PendingState implements OrderState {
  next(order: Order) { order.setState(new ProcessingState()); }
  cancel(order: Order) { order.setState(new CancelledState()); }
  toString() { return "PENDING"; }
}

class ProcessingState implements OrderState {
  next(order: Order) { order.setState(new ShippedState()); }
  cancel(order: Order) { order.setState(new CancelledState()); }
  toString() { return "PROCESSING"; }
}

class ShippedState implements OrderState {
  next(order: Order) { order.setState(new DeliveredState()); }
  cancel(order: Order) { throw new Error("Cannot cancel shipped order"); }
  toString() { return "SHIPPED"; }
}

class DeliveredState implements OrderState {
  next(order: Order) { throw new Error("Order already delivered"); }
  cancel(order: Order) { throw new Error("Cannot cancel delivered order"); }
  toString() { return "DELIVERED"; }
}

class CancelledState implements OrderState {
  next(order: Order) { throw new Error("Order is cancelled"); }
  cancel(order: Order) { throw new Error("Already cancelled"); }
  toString() { return "CANCELLED"; }
}

// Context
class Order {
  private state: OrderState = new PendingState();

  setState(state: OrderState): void { this.state = state; }
  next(): void { this.state.next(this); }
  cancel(): void { this.state.cancel(this); }
  getStatus(): string { return this.state.toString(); }
}

// Usage
const order = new Order();
order.getStatus();   // "PENDING"
order.next();        // → PROCESSING
order.next();        // → SHIPPED
order.cancel();      // Error: Cannot cancel shipped order
```

### State vs Strategy

```
State:     Behavior changes as internal state changes (state-driven)
Strategy:  Behavior selected by the client (client-driven)

State transitions: managed internally by the state objects
Strategy selection: managed externally by the client
```

## Real-world Examples

- **TCP connection** — `LISTEN`, `SYN_SENT`, `ESTABLISHED`, `CLOSED` states.
- **Media player** — `Playing`, `Paused`, `Stopped` states with different button behaviors.
- **Workflow engines** — document approval (`Draft` → `Review` → `Approved` → `Published`).
- **XState** — JavaScript state machine library for UI state management.
- **Game AI** — NPC states (`Idle`, `Patrol`, `Chase`, `Attack`).

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 305-313.
- [Refactoring.Guru — State](https://refactoring.guru/design-patterns/state)
