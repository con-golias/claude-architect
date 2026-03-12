# Event-Driven Programming

> **Domain:** Fundamentals > Programming Paradigms > Reactive
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Event-Driven Programming (EDP) structures programs around **events** — signals that something has happened. The program flow is determined by events such as user actions, sensor outputs, messages, or timer expirations. Event handlers (callbacks/listeners) respond to these events. This is the dominant paradigm for GUIs, web applications, and real-time systems.

## How It Works

```typescript
// Browser — DOM event model
const button = document.querySelector("#submit");

// Event listener
button.addEventListener("click", (event: MouseEvent) => {
  event.preventDefault();
  console.log(`Clicked at (${event.clientX}, ${event.clientY})`);
});

// Event delegation — handle events on parent, not each child
document.querySelector(".todo-list")!.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (target.matches(".delete-btn")) {
    const todoId = target.closest("[data-id]")?.getAttribute("data-id");
    deleteTodo(todoId!);
  }
  if (target.matches(".toggle-btn")) {
    const todoId = target.closest("[data-id]")?.getAttribute("data-id");
    toggleTodo(todoId!);
  }
});

// Event propagation: capture (down) → target → bubble (up)
// <div> (captures) → <ul> (captures) → <li> (target) → <ul> (bubbles) → <div> (bubbles)

// Custom events
const customEvent = new CustomEvent("order:placed", {
  detail: { orderId: "123", total: 99.99 },
  bubbles: true,
});
element.dispatchEvent(customEvent);
element.addEventListener("order:placed", (e: CustomEvent) => {
  console.log(e.detail.orderId);  // "123"
});
```

```typescript
// Node.js — EventEmitter
import { EventEmitter } from "events";

class OrderSystem extends EventEmitter {
  placeOrder(order: Order): void {
    // Business logic
    const savedOrder = this.saveToDatabase(order);

    // Emit events — decoupled side effects
    this.emit("order:placed", savedOrder);
    if (savedOrder.total > 1000) {
      this.emit("order:high-value", savedOrder);
    }
  }
}

const system = new OrderSystem();

// Listeners — loosely coupled modules
system.on("order:placed", (order) => {
  emailService.sendConfirmation(order);
});

system.on("order:placed", (order) => {
  analyticsService.track("order_placed", { total: order.total });
});

system.on("order:high-value", (order) => {
  slackService.notifyChannel("#sales", `High-value order: $${order.total}`);
});

// once — listener auto-removes after first invocation
system.once("order:placed", () => console.log("First order of the day!"));
```

```python
# Python — event-driven with asyncio
import asyncio

class EventBus:
    def __init__(self):
        self._handlers: dict[str, list] = {}

    def on(self, event: str, handler):
        self._handlers.setdefault(event, []).append(handler)
        return lambda: self._handlers[event].remove(handler)

    async def emit(self, event: str, *args, **kwargs):
        for handler in self._handlers.get(event, []):
            if asyncio.iscoroutinefunction(handler):
                await handler(*args, **kwargs)
            else:
                handler(*args, **kwargs)

bus = EventBus()

async def on_user_signup(user):
    await send_welcome_email(user["email"])

bus.on("user:signup", on_user_signup)
bus.on("user:signup", lambda u: print(f"New user: {u['name']}"))

await bus.emit("user:signup", {"name": "Alice", "email": "alice@test.com"})
```

### Event Loop Architecture

```
┌─────────────────────────────────────┐
│           Event Queue               │
│  [click] [timer] [fetch] [keydown]  │
└─────────────┬───────────────────────┘
              │
              ↓
┌─────────────────────────────────────┐
│           Event Loop                │
│  while (queue.hasEvents()) {        │
│    event = queue.dequeue();         │
│    handler = findHandler(event);    │
│    handler(event);                  │
│  }                                  │
└─────────────────────────────────────┘

Single-threaded, non-blocking:
  - Never blocks waiting for I/O
  - Processes one event at a time
  - Long handlers freeze the loop → use async or workers
```

### Event-Driven vs Request-Response

```
Request-Response:                Event-Driven:
Client → Server → Response       Publisher → Event → Subscribers
Synchronous                      Asynchronous
Tightly coupled                  Loosely coupled
Known recipient                  Unknown recipients
Point-to-point                   Broadcast / multicast
```

## Real-world Examples

- **Browser DOM** — click, keydown, scroll, resize, load events.
- **Node.js** — everything is event-driven (HTTP, filesystem, streams).
- **React** — `onClick`, `onChange`, `onSubmit` event handlers.
- **WebSocket** — `onmessage`, `onopen`, `onclose` events.
- **AWS Lambda** — functions triggered by events (S3 upload, API Gateway, SQS).
- **Game engines** — input events, collision events, timer events.
- **IoT** — sensor events, MQTT message events.

## Sources

- [MDN — Introduction to Events](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events)
- [Node.js — Events](https://nodejs.org/api/events.html)
