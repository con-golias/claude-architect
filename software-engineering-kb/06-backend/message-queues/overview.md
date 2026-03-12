# Message Queues Overview

> **AI Plugin Directive — Asynchronous Messaging Architecture & Broker Selection**
> You are an AI coding assistant. When generating, reviewing, or refactoring message queue
> code, follow EVERY rule in this document. Incorrect messaging implementation causes message
> loss, duplicate processing, and cascading failures. Treat each section as non-negotiable.

**Core Rule: ALWAYS use message queues for asynchronous, decoupled communication between services. ALWAYS ensure consumers are idempotent. ALWAYS configure dead-letter queues for failed messages. ALWAYS use acknowledgements — NEVER auto-ack before processing completes. ALWAYS monitor queue depth and consumer lag.**

---

## 1. Messaging Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Message Queue Architecture                       │
│                                                               │
│  Producer → Broker → Consumer                                │
│                                                               │
│  Delivery Guarantees:                                        │
│  ├── At-most-once: fire and forget (may lose)               │
│  ├── At-least-once: retry until acked (may duplicate)       │
│  └── Exactly-once: dedup + idempotent (hardest)            │
│                                                               │
│  ALWAYS target at-least-once + idempotent consumers         │
│  This gives practical exactly-once semantics                │
│                                                               │
│  Message Flow:                                               │
│  ├── 1. Producer serializes message                         │
│  ├── 2. Broker persists to disk                             │
│  ├── 3. Consumer receives message                           │
│  ├── 4. Consumer processes message                          │
│  ├── 5. Consumer acknowledges (ACK)                         │
│  └── 6. Broker removes message                              │
│                                                               │
│  If step 4 fails:                                            │
│  ├── Message is NACKed → redelivered                        │
│  ├── After N retries → dead-letter queue                    │
│  └── Dead-letter queue → manual investigation               │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Broker Comparison

| Feature | Kafka | RabbitMQ | SQS/SNS | Redis Streams |
|---------|-------|----------|---------|---------------|
| **Model** | Log-based | Queue-based | Managed queue | Log-based |
| **Ordering** | Per-partition | Per-queue | Best-effort (FIFO available) | Per-stream |
| **Throughput** | Millions/sec | Tens of thousands/sec | Unlimited (managed) | Hundreds of thousands/sec |
| **Retention** | Configurable (days/weeks) | Until consumed | 14 days max | Configurable |
| **Replay** | Yes (offset seek) | No | No | Yes (ID seek) |
| **Consumer groups** | Built-in | Manual | Auto | Built-in (XREADGROUP) |
| **Dead-letter** | Manual topic | Built-in (DLX) | Built-in (DLQ) | Manual |
| **Ops complexity** | High (ZK/KRaft) | Medium | None (managed) | Low (if Redis exists) |
| **Best for** | Event streaming, high volume | Task queues, routing | AWS-native, serverless | Simple queues, existing Redis |

---

## 3. Message Structure

```typescript
// Standard message envelope
interface Message<T> {
  id: string;              // Unique message ID (for dedup)
  type: string;            // Event type: "order.created"
  source: string;          // Producing service
  timestamp: string;       // ISO 8601
  correlationId: string;   // Request tracing
  data: T;                 // Payload
  metadata: {
    version: number;       // Schema version
    retryCount?: number;
  };
}

// ALWAYS include:
// - Unique ID for deduplication
// - Type for routing
// - Timestamp for ordering/debugging
// - CorrelationId for tracing
```

```go
type Message[T any] struct {
    ID            string    `json:"id"`
    Type          string    `json:"type"`
    Source        string    `json:"source"`
    Timestamp     time.Time `json:"timestamp"`
    CorrelationID string    `json:"correlationId"`
    Data          T         `json:"data"`
    Metadata      Metadata  `json:"metadata"`
}

type Metadata struct {
    Version    int `json:"version"`
    RetryCount int `json:"retryCount,omitempty"`
}
```

---

## 4. Decision Guide

```
┌──────────────────────────────────────────────────────────────┐
│              Which Message Broker?                             │
│                                                               │
│  Need event streaming / replay?                              │
│  └── YES → Kafka                                            │
│                                                               │
│  Need complex routing (topic, fanout, headers)?             │
│  └── YES → RabbitMQ                                         │
│                                                               │
│  AWS-native / serverless?                                    │
│  └── YES → SQS + SNS                                       │
│                                                               │
│  Already have Redis / simple task queue?                     │
│  └── YES → Redis Streams or BullMQ                          │
│                                                               │
│  High volume + multi-consumer + ordering?                    │
│  └── Kafka                                                  │
│                                                               │
│  Task queue with priorities + delays?                        │
│  └── RabbitMQ or BullMQ                                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Auto-ack before processing | Message loss on crash | Ack after successful processing |
| No dead-letter queue | Failed messages disappear | DLQ with alerting |
| Non-idempotent consumers | Duplicates cause side effects | Idempotency key + dedup check |
| No message ID | Cannot deduplicate | UUID per message |
| Synchronous publish + consume | Tight coupling, defeats purpose | Fully async pipeline |
| No queue depth monitoring | Undetected consumer lag | Alert on depth thresholds |
| Giant message payloads | Broker overwhelmed | Store payload in S3, send reference |
| No schema versioning | Breaking consumer changes | Version field + backward compat |

---

## 6. Enforcement Checklist

- [ ] Messages have unique ID, type, timestamp, correlationId
- [ ] At-least-once delivery with idempotent consumers
- [ ] Dead-letter queue configured for all queues
- [ ] Manual acknowledgement after processing (never auto-ack)
- [ ] Queue depth and consumer lag monitored with alerting
- [ ] Message schemas versioned for backward compatibility
- [ ] Large payloads stored externally (S3), reference in message
- [ ] Retry with backoff before dead-letter routing
