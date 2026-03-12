# Publish-Subscribe (Pub/Sub) Pattern

> **Domain:** Fundamentals > Design Patterns > Modern
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Pub/Sub is a messaging pattern where **publishers emit messages to topics** without knowing who will receive them, and **subscribers listen to topics** without knowing who published the messages. A **message broker** mediates between the two, providing full decoupling. Unlike the Observer pattern, publishers and subscribers have no direct reference to each other.

**Key Distinction from Observer:** In Observer, the subject knows its observers. In Pub/Sub, an intermediary (broker/bus/channel) decouples them completely.

## How It Works

```
Publisher A ──→ ┌───────────────┐ ──→ Subscriber 1
Publisher B ──→ │  Message      │ ──→ Subscriber 2
Publisher C ──→ │  Broker       │ ──→ Subscriber 3
                │  (topics)     │
                └───────────────┘

Publishers and subscribers are completely unaware of each other.
The broker handles routing, filtering, and delivery.
```

### In-Process Event Bus

```typescript
// Generic typed event bus
type EventMap = Record<string, any>;

class EventBus<Events extends EventMap> {
  private handlers = new Map<keyof Events, Set<(data: any) => void>>();

  publish<K extends keyof Events>(topic: K, data: Events[K]): void {
    const subscribers = this.handlers.get(topic);
    if (subscribers) {
      subscribers.forEach(handler => handler(data));
    }
  }

  subscribe<K extends keyof Events>(
    topic: K,
    handler: (data: Events[K]) => void
  ): () => void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
    }
    this.handlers.get(topic)!.add(handler);

    // Return unsubscribe function
    return () => this.handlers.get(topic)?.delete(handler);
  }
}

// Usage — typed events
interface AppEvents {
  "user:registered": { userId: string; email: string };
  "user:deleted": { userId: string };
  "order:placed": { orderId: string; total: number };
  "order:shipped": { orderId: string; trackingNumber: string };
}

const bus = new EventBus<AppEvents>();

// Subscribers — independent modules
const unsub1 = bus.subscribe("user:registered", ({ email }) => {
  sendWelcomeEmail(email);
});

bus.subscribe("user:registered", ({ userId }) => {
  analytics.track("signup", { userId });
});

bus.subscribe("order:placed", ({ orderId, total }) => {
  if (total > 1000) notifyManager(orderId);
});

// Publisher — doesn't know about subscribers
class UserService {
  constructor(private bus: EventBus<AppEvents>) {}

  async register(email: string, password: string): Promise<void> {
    const user = await db.createUser(email, password);
    this.bus.publish("user:registered", { userId: user.id, email });
  }
}
```

### Distributed Pub/Sub with Redis

```typescript
import Redis from "ioredis";

class RedisPubSub {
  private publisher: Redis;
  private subscriber: Redis;

  constructor(redisUrl: string) {
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
  }

  async publish(channel: string, message: object): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  subscribe(channel: string, handler: (message: object) => void): void {
    this.subscriber.subscribe(channel);
    this.subscriber.on("message", (ch, msg) => {
      if (ch === channel) {
        handler(JSON.parse(msg));
      }
    });
  }
}

// Service A (Publisher) — Order Service
const pubsub = new RedisPubSub("redis://localhost:6379");
await pubsub.publish("orders", {
  type: "order.placed",
  orderId: "123",
  items: [{ sku: "ABC", qty: 2 }],
});

// Service B (Subscriber) — Inventory Service (different process)
pubsub.subscribe("orders", (msg: any) => {
  if (msg.type === "order.placed") {
    msg.items.forEach(item => reserveStock(item.sku, item.qty));
  }
});

// Service C (Subscriber) — Notification Service (different process)
pubsub.subscribe("orders", (msg: any) => {
  if (msg.type === "order.placed") {
    sendOrderConfirmation(msg.orderId);
  }
});
```

```python
# Python — Pub/Sub with topic filtering
from collections import defaultdict
from typing import Callable, Any
import re

class MessageBroker:
    def __init__(self):
        self._subscribers: dict[str, list[Callable]] = defaultdict(list)

    def subscribe(self, pattern: str, handler: Callable[[str, Any], None]):
        """Subscribe with wildcard support: 'order.*' matches 'order.placed'"""
        self._subscribers[pattern].append(handler)

    def publish(self, topic: str, data: Any):
        for pattern, handlers in self._subscribers.items():
            if self._matches(pattern, topic):
                for handler in handlers:
                    handler(topic, data)

    def _matches(self, pattern: str, topic: str) -> bool:
        regex = pattern.replace(".", r"\.").replace("*", r"[^.]+").replace("#", r".+")
        return bool(re.fullmatch(regex, topic))

broker = MessageBroker()

# Subscribe to all order events
broker.subscribe("order.*", lambda topic, data: print(f"Audit: {topic} → {data}"))

# Subscribe to specific event
broker.subscribe("order.placed", lambda _, data: print(f"New order: {data['id']}"))

# Publish
broker.publish("order.placed", {"id": "123", "total": 99.99})
# Audit: order.placed → {'id': '123', 'total': 99.99}
# New order: 123
```

### Observer vs Pub/Sub

```
Observer:                          Pub/Sub:
subject.subscribe(observer)        bus.subscribe("topic", handler)
subject.notify(data)               bus.publish("topic", data)

Direct reference                   No direct reference
Subject knows observers            Publisher doesn't know subscribers
Same process                       Can cross process/network boundaries
Tight coupling to subject          Fully decoupled via broker

Observer:  1 subject → N observers (1-to-many)
Pub/Sub:   M publishers → broker → N subscribers (many-to-many)
```

## Real-world Examples

- **Apache Kafka** — distributed event streaming with topics, partitions, and consumer groups.
- **RabbitMQ** — AMQP message broker with exchanges, queues, and routing keys.
- **Redis Pub/Sub** — lightweight in-memory pub/sub for real-time communication.
- **Google Cloud Pub/Sub** — fully managed messaging service with at-least-once delivery.
- **AWS SNS + SQS** — SNS topics fan out to SQS queues for reliable pub/sub.
- **MQTT** — lightweight pub/sub protocol for IoT devices.
- **WebSocket rooms** — Socket.io rooms are pub/sub channels for real-time web apps.
- **DOM `CustomEvent`** — `dispatchEvent`/`addEventListener` on a shared target.

## Sources

- Hohpe, G. & Woolf, B. (2003). *Enterprise Integration Patterns*. Addison-Wesley. Chapter 3.
- [CloudEvents Specification](https://cloudevents.io/) — standard for event data format.
- [Kafka Documentation — Design](https://kafka.apache.org/documentation/#design)
