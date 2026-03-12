# Real-Time at Scale

> **AI Plugin Directive — Scaling Real-Time Systems, Pub/Sub & Presence**
> You are an AI coding assistant. When generating, reviewing, or refactoring scalable real-time
> systems, follow EVERY rule in this document. Single-server real-time breaks when you scale
> to multiple instances. Treat each section as non-negotiable.

**Core Rule: ALWAYS use a pub/sub backbone (Redis Pub/Sub, NATS) to distribute events across server instances. ALWAYS implement sticky sessions or a shared connection registry. ALWAYS track presence with heartbeat-based TTL. NEVER assume all connected clients are on the same server instance.**

---

## 1. Scaling Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Multi-Instance Real-Time                          │
│                                                               │
│  Problem: User A on Server 1, User B on Server 2            │
│  A sends message to B — Server 1 doesn't have B's socket    │
│                                                               │
│  Solution: Pub/Sub backbone                                  │
│                                                               │
│  Server 1 ──┐                                                │
│  Server 2 ──┼── Redis Pub/Sub ──► All servers receive       │
│  Server 3 ──┘                                                │
│                                                               │
│  Flow:                                                       │
│  1. User A sends message on Server 1                        │
│  2. Server 1 publishes to Redis channel "room:123"          │
│  3. All servers subscribed to "room:123" receive it         │
│  4. Server 2 (where B is connected) delivers to B          │
│                                                               │
│  Alternatives: NATS, Kafka, RabbitMQ                        │
│  For extreme scale: Dedicated WebSocket gateway service     │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript — Redis Pub/Sub Adapter

```typescript
import Redis from "ioredis";

const pub = new Redis(process.env.REDIS_URL);
const sub = new Redis(process.env.REDIS_URL);

class ScalableEventBus {
  private localSubscribers = new Map<string, Set<(data: any) => void>>();

  constructor() {
    sub.on("message", (channel, message) => {
      const subscribers = this.localSubscribers.get(channel);
      if (!subscribers) return;
      const data = JSON.parse(message);
      for (const callback of subscribers) {
        callback(data);
      }
    });
  }

  async publish(channel: string, data: unknown): Promise<void> {
    await pub.publish(channel, JSON.stringify(data));
  }

  subscribe(channel: string, callback: (data: any) => void): () => void {
    if (!this.localSubscribers.has(channel)) {
      this.localSubscribers.set(channel, new Set());
      sub.subscribe(channel);
    }
    this.localSubscribers.get(channel)!.add(callback);

    return () => {
      const subs = this.localSubscribers.get(channel);
      subs?.delete(callback);
      if (subs?.size === 0) {
        this.localSubscribers.delete(channel);
        sub.unsubscribe(channel);
      }
    };
  }
}
```

---

## 3. Presence Tracking

```typescript
// Track online users with Redis TTL
class PresenceService {
  private readonly TTL = 60; // seconds

  async setOnline(userId: string, serverId: string): Promise<void> {
    await redis.set(`presence:${userId}`, serverId, "EX", this.TTL);
    await redis.sadd("online_users", userId);
  }

  async heartbeat(userId: string): Promise<void> {
    await redis.expire(`presence:${userId}`, this.TTL);
  }

  async setOffline(userId: string): Promise<void> {
    await redis.del(`presence:${userId}`);
    await redis.srem("online_users", userId);
  }

  async isOnline(userId: string): Promise<boolean> {
    return await redis.exists(`presence:${userId}`) === 1;
  }

  async getOnlineCount(): Promise<number> {
    return redis.scard("online_users");
  }
}

// Cleanup: expired presence entries
async function cleanupPresence(): Promise<void> {
  const members = await redis.smembers("online_users");
  for (const userId of members) {
    const exists = await redis.exists(`presence:${userId}`);
    if (!exists) await redis.srem("online_users", userId);
  }
}
```

---

## 4. Connection Registry

```typescript
// Track which server holds each user's connection
class ConnectionRegistry {
  async register(userId: string, serverId: string): Promise<void> {
    await redis.hset(`connections:${userId}`, serverId, Date.now().toString());
    await redis.expire(`connections:${userId}`, 120);
  }

  async unregister(userId: string, serverId: string): Promise<void> {
    await redis.hdel(`connections:${userId}`, serverId);
  }

  async getServers(userId: string): Promise<string[]> {
    const servers = await redis.hgetall(`connections:${userId}`);
    return Object.keys(servers);
  }
}
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| In-memory event bus only | Events don't reach other instances | Redis Pub/Sub backbone |
| No presence TTL | Ghost users appear online | Heartbeat + TTL expiry |
| Global broadcast | All servers process all events | Channel/room-scoped pub/sub |
| No sticky sessions + no registry | Cannot find user's server | Sticky sessions or connection registry |
| Single Redis Pub/Sub subscriber | Bottleneck | Multiple subscribers, sharded channels |

---

## 6. Enforcement Checklist

- [ ] Pub/sub backbone for multi-instance event distribution
- [ ] Presence tracking with heartbeat TTL (60s)
- [ ] Connection registry tracks user→server mapping
- [ ] Room/channel-scoped pub/sub (not global broadcast)
- [ ] Sticky sessions or connection registry for routing
- [ ] Presence cleanup job removes expired entries
- [ ] Online user count tracked as metric
- [ ] Pub/sub reconnection handled on Redis disconnect
