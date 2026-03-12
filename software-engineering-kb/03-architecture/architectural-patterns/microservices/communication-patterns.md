# Microservices: Communication Patterns — Complete Specification

> **AI Plugin Directive:** Communication between microservices is the MOST CRITICAL architectural decision. Choose WRONG and you get a distributed monolith with all the downsides of both architectures. DEFAULT to asynchronous event-driven communication. Use synchronous calls ONLY when you need an immediate response AND the caller cannot proceed without it.

---

## 1. The Core Rule

**Prefer asynchronous communication (events) over synchronous communication (HTTP/gRPC). Synchronous calls create temporal coupling — if the callee is down, the caller fails. Asynchronous events create eventual consistency but allow services to operate independently.**

```
SYNCHRONOUS = Temporal Coupling (both must be running)
  Service A ──HTTP──► Service B
  If B is down → A fails

ASYNCHRONOUS = Temporal Decoupling (can operate independently)
  Service A ──event──► Message Broker ──event──► Service B
  If B is down → event waits in broker → B processes when it comes back
```

---

## 2. Synchronous Communication Patterns

### REST over HTTP

```typescript
// Use for: Simple CRUD queries, when caller NEEDS immediate response
// Pros: Simple, well-understood, tooling support
// Cons: Tight coupling, no built-in retry, performance overhead

// ✅ CORRECT: Client with resilience built in
class CatalogHttpClient implements CatalogPort {
  constructor(
    private readonly http: HttpClient,
    private readonly config: { baseUrl: string; timeoutMs: number },
  ) {}

  async getProduct(productId: string): Promise<ProductInfo> {
    const response = await this.http.get<CatalogProductResponse>(
      `${this.config.baseUrl}/api/v1/products/${productId}`,
      {
        timeout: this.config.timeoutMs,
        headers: {
          'Accept': 'application/json',
          'X-Trace-Id': AsyncLocalStorage.getStore()?.traceId,
        },
      },
    );

    // Anti-Corruption Layer: Map external model to internal domain model
    return this.mapToProductInfo(response.data);
  }

  private mapToProductInfo(external: CatalogProductResponse): ProductInfo {
    return {
      productId: ProductId.from(external.id),
      name: external.title,  // Catalog calls it "title", we call it "name"
      price: Money.of(external.pricing.base_amount, external.pricing.currency_code),
      available: external.stock.quantity > 0,
    };
  }
}
```

### gRPC

```protobuf
// Use for: High-performance service-to-service calls, streaming
// Pros: Binary protocol (fast), strong typing, code generation, streaming
// Cons: More complex setup, not browser-friendly, harder to debug

// catalog.proto
syntax = "proto3";
package catalog;

service CatalogService {
  // Unary: simple request-response
  rpc GetProduct(GetProductRequest) returns (ProductResponse);

  // Server streaming: catalog sends a stream of products
  rpc ListProducts(ListProductsRequest) returns (stream ProductResponse);

  // Client streaming: bulk product update
  rpc BulkUpdatePrices(stream PriceUpdateRequest) returns (BulkUpdateResponse);

  // Bidirectional streaming: real-time inventory sync
  rpc SyncInventory(stream InventoryUpdate) returns (stream InventoryStatus);
}

message GetProductRequest {
  string product_id = 1;
}

message ProductResponse {
  string id = 1;
  string name = 2;
  Price price = 3;
  int32 stock_quantity = 4;
}

message Price {
  int64 amount_cents = 1;  // Store money as cents to avoid floating point
  string currency = 2;
}
```

```typescript
// gRPC client implementation
class CatalogGrpcClient implements CatalogPort {
  private readonly client: CatalogServiceClient;

  constructor(address: string, credentials: ChannelCredentials) {
    this.client = new CatalogServiceClient(address, credentials);
  }

  async getProduct(productId: string): Promise<ProductInfo> {
    return new Promise((resolve, reject) => {
      const deadline = new Date(Date.now() + 3000); // 3s timeout

      this.client.getProduct(
        { productId },
        { deadline },
        (error, response) => {
          if (error) {
            if (error.code === grpc.status.NOT_FOUND) {
              reject(new ProductNotFoundError(productId));
            } else if (error.code === grpc.status.DEADLINE_EXCEEDED) {
              reject(new ServiceTimeoutError('catalog', 3000));
            } else {
              reject(new ServiceUnavailableError('catalog', error.message));
            }
            return;
          }
          resolve(this.mapToProductInfo(response));
        },
      );
    });
  }
}
```

### GraphQL (BFF Pattern)

```typescript
// Use for: Backend-for-Frontend (BFF) that aggregates multiple services
// Pros: Client gets exactly the data it needs, reduces over-fetching
// Cons: Complexity, N+1 queries, caching challenges
// Rule: GraphQL at the EDGE (BFF), NOT between services

// ❌ WRONG: GraphQL between microservices
// OrderService ──GraphQL──► CatalogService ──GraphQL──► PricingService

// ✅ CORRECT: GraphQL as BFF, services use REST/gRPC/events internally
//
// Mobile App ──GraphQL──► BFF Gateway ──REST/gRPC──► OrderService
//                                     ──REST/gRPC──► CatalogService
//                                     ──REST/gRPC──► UserService

// BFF resolver that aggregates from multiple services
const resolvers = {
  Query: {
    orderDetails: async (_, { orderId }, { dataSources }) => {
      const [order, customer] = await Promise.all([
        dataSources.orderService.getOrder(orderId),
        dataSources.orderService.getOrder(orderId)
          .then(o => dataSources.customerService.getCustomer(o.customerId)),
      ]);

      return { ...order, customer };
    },
  },
  Order: {
    // Resolved lazily only if client requests items
    items: async (order, _, { dataSources }) => {
      const items = await dataSources.orderService.getOrderItems(order.id);
      // Batch-fetch product details using DataLoader (avoids N+1)
      return Promise.all(
        items.map(async (item) => ({
          ...item,
          product: await dataSources.catalogLoader.load(item.productId),
        })),
      );
    },
  },
};
```

---

## 3. Asynchronous Communication Patterns

### Event-Driven (Publish-Subscribe)

```typescript
// Use for: Notifications, data sync, decoupled workflows
// The publisher does NOT know who listens. Subscribers are independent.

// Event schema with versioning
interface OrderPlacedEvent {
  metadata: {
    eventId: string;           // Unique, idempotent key
    eventType: 'order.placed';
    version: '1.0';
    timestamp: string;         // ISO 8601
    source: 'ordering-service';
    correlationId: string;     // Links related events
    causationId: string;       // What caused this event
  };
  payload: {
    orderId: string;
    customerId: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      currency: string;
    }>;
    totalAmount: number;
    currency: string;
    shippingAddress: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    };
  };
}

// Publisher — Ordering Service
class OrderEventPublisher {
  constructor(private readonly kafka: KafkaProducer) {}

  async publishOrderPlaced(order: Order): Promise<void> {
    const event: OrderPlacedEvent = {
      metadata: {
        eventId: uuid(),
        eventType: 'order.placed',
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: 'ordering-service',
        correlationId: AsyncLocalStorage.getStore()?.correlationId ?? uuid(),
        causationId: AsyncLocalStorage.getStore()?.spanId ?? uuid(),
      },
      payload: {
        orderId: order.id.value,
        customerId: order.customerId.value,
        items: order.items.map(item => ({
          productId: item.productId.value,
          quantity: item.quantity.value,
          unitPrice: item.price.amount,
          currency: item.price.currency,
        })),
        totalAmount: order.totalAmount.amount,
        currency: order.totalAmount.currency,
        shippingAddress: order.shippingAddress.toPlainObject(),
      },
    };

    await this.kafka.send({
      topic: 'ordering.events',
      messages: [{
        key: order.id.value,     // Partition by orderId for ordering guarantee
        value: JSON.stringify(event),
        headers: {
          'event-type': 'order.placed',
          'event-version': '1.0',
          'correlation-id': event.metadata.correlationId,
        },
      }],
    });
  }
}

// Subscriber — Fulfillment Service (completely independent)
class OrderPlacedHandler {
  constructor(private readonly createShipment: CreateShipmentUseCase) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    await this.createShipment.execute({
      referenceOrderId: event.payload.orderId,
      items: event.payload.items,
      destination: event.payload.shippingAddress,
    });
  }
}

// Subscriber — Notification Service (also independent)
class OrderPlacedNotifier {
  constructor(private readonly emailSender: EmailSender) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    await this.emailSender.send({
      to: event.payload.customerId, // Resolved via customer lookup
      template: 'order-confirmation',
      data: {
        orderId: event.payload.orderId,
        totalAmount: `${event.payload.currency} ${event.payload.totalAmount}`,
      },
    });
  }
}
```

### Command-Based (Point-to-Point)

```typescript
// Use for: Directed work assignment where exactly ONE consumer must process
// Unlike events (broadcast), commands are sent to a SPECIFIC service

// ❌ Event (broadcast): "An order was placed" — anyone can listen
// ✅ Command (targeted): "Process this payment" — only payment service handles it

// Command message
interface ProcessPaymentCommand {
  metadata: {
    commandId: string;
    commandType: 'payment.process';
    timestamp: string;
    correlationId: string;
    replyTo: string;           // Queue for the response
  };
  payload: {
    orderId: string;
    amount: number;
    currency: string;
    paymentMethod: {
      type: 'credit_card' | 'bank_transfer' | 'wallet';
      token: string;            // Tokenized payment info
    };
  };
}

// Ordering service sends command to payment queue
class PaymentCommandSender {
  async requestPayment(order: Order, paymentMethod: PaymentMethod): Promise<void> {
    await this.messageBroker.sendToQueue('payment.commands', {
      metadata: {
        commandId: uuid(),
        commandType: 'payment.process',
        timestamp: new Date().toISOString(),
        correlationId: getCorrelationId(),
        replyTo: 'ordering.payment-results',
      },
      payload: {
        orderId: order.id.value,
        amount: order.totalAmount.amount,
        currency: order.totalAmount.currency,
        paymentMethod: {
          type: paymentMethod.type,
          token: paymentMethod.token,
        },
      },
    });
  }
}
```

### Request-Reply (Async)

```typescript
// Use for: When you need a response but can wait for it asynchronously
// Combines the decoupling of async with the response pattern of sync

class AsyncPaymentRequest {
  constructor(
    private readonly messageBroker: MessageBroker,
    private readonly correlationStore: CorrelationStore,
  ) {}

  async requestPaymentAndWait(
    command: ProcessPaymentCommand,
    timeoutMs: number = 30000,
  ): Promise<PaymentResult> {
    const correlationId = command.metadata.commandId;

    // Create a promise that resolves when we get the reply
    const resultPromise = this.correlationStore.waitForReply<PaymentResult>(
      correlationId,
      timeoutMs,
    );

    // Send the command
    await this.messageBroker.sendToQueue('payment.commands', command);

    // Wait for the reply (with timeout)
    try {
      return await resultPromise;
    } catch (error) {
      if (error instanceof TimeoutError) {
        // Payment service didn't respond in time
        // Don't assume it failed — it might still process!
        throw new PaymentResponseTimeoutError(correlationId);
      }
      throw error;
    }
  }
}

// Payment service sends reply back
class PaymentResultPublisher {
  async publishResult(correlationId: string, result: PaymentResult): Promise<void> {
    await this.messageBroker.sendToQueue('ordering.payment-results', {
      correlationId,
      payload: result,
    });
  }
}
```

---

## 4. Message Broker Selection Guide

```
┌─────────────────┬──────────────────────┬──────────────────────┐
│ Feature         │ Apache Kafka         │ RabbitMQ             │
├─────────────────┼──────────────────────┼──────────────────────┤
│ Model           │ Log-based (pull)     │ Queue-based (push)   │
│ Ordering        │ Per-partition         │ Per-queue            │
│ Message replay  │ ✅ Yes (retention)    │ ❌ No (consumed)      │
│ Throughput      │ Very high (millions)  │ High (tens of k)    │
│ Latency         │ Low (batch optimized) │ Very low (per msg)  │
│ Consumer groups │ ✅ Built-in           │ ✅ Via exchanges     │
│ Best for        │ Event streaming,      │ Task queues,        │
│                 │ event sourcing,       │ RPC, routing,       │
│                 │ high throughput       │ short-lived messages│
├─────────────────┼──────────────────────┼──────────────────────┤
│ USE WHEN:       │ Event-driven arch,   │ Command processing,  │
│                 │ audit log needed,    │ work distribution,   │
│                 │ replay needed,       │ complex routing,     │
│                 │ high volume          │ lower volume         │
└─────────────────┴──────────────────────┴──────────────────────┘
```

### Kafka Topic Design Rules

```
Topic Naming Convention:
  {domain}.{entity}.{event-type}

  Examples:
    ordering.order.placed
    ordering.order.confirmed
    ordering.order.cancelled
    payment.payment.captured
    payment.payment.failed
    catalog.product.created
    catalog.product.price-changed

Partitioning Rules:
  - Partition by entity ID (e.g., orderId) for ordering guarantee
  - All events for the same order go to the same partition
  - Never partition by event type (breaks ordering)
  - Number of partitions = max number of concurrent consumers

Consumer Group Rules:
  - Each microservice = one consumer group
  - Group ID: {service-name}-{purpose}
  - Example: fulfillment-service-order-handler
  - Multiple instances of the same service share the same group
  - Each partition is consumed by exactly ONE instance in a group
```

---

## 5. Event Schema Management

### Schema Evolution Rules

```
RULE: Events are contracts. Changing them can break consumers.
ALWAYS use backward-compatible changes.

✅ ALLOWED (backward-compatible):
  - Adding new optional fields
  - Adding new event types
  - Adding default values to new fields

❌ FORBIDDEN (breaking):
  - Removing fields
  - Renaming fields
  - Changing field types
  - Changing field semantics
  - Removing event types
```

### Schema Registry Pattern

```typescript
// Use a schema registry (Confluent, AWS Glue, custom) to version event schemas

// Version 1.0
interface OrderPlacedV1 {
  orderId: string;
  customerId: string;
  totalAmount: number;
  currency: string;
}

// Version 1.1 — backward compatible (added optional field)
interface OrderPlacedV1_1 extends OrderPlacedV1 {
  loyaltyPoints?: number;    // New optional field — old consumers ignore it
}

// Version 2.0 — breaking change, needs new topic or migration
interface OrderPlacedV2 {
  orderId: string;
  customerId: string;
  total: {                   // Changed from flat to nested — BREAKING
    amount: number;
    currency: string;
  };
  loyaltyPoints: number;    // Made required — BREAKING for V1 producers
}

// ✅ CORRECT: Handle multiple versions in consumer
class OrderPlacedConsumer {
  async handle(rawEvent: unknown): Promise<void> {
    const version = (rawEvent as any).metadata?.version;

    switch (version) {
      case '1.0':
        return this.handleV1(rawEvent as OrderPlacedV1);
      case '1.1':
        return this.handleV1_1(rawEvent as OrderPlacedV1_1);
      default:
        this.logger.warn(`Unknown event version: ${version}`, { rawEvent });
        // Don't throw — unknown versions should be skipped, not block the queue
    }
  }
}
```

---

## 6. Idempotent Message Handling

```typescript
// EVERY message handler MUST be idempotent.
// Messages can be delivered more than once (at-least-once delivery).

// ✅ CORRECT: Idempotent handler with deduplication
class OrderPlacedHandler {
  constructor(
    private readonly idempotencyStore: IdempotencyStore,
    private readonly shipmentService: ShipmentService,
  ) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    const eventId = event.metadata.eventId;

    // Check if we already processed this event
    if (await this.idempotencyStore.exists(eventId)) {
      this.logger.info('Duplicate event detected, skipping', { eventId });
      return;
    }

    try {
      // Process the event
      await this.shipmentService.createShipment({
        orderId: event.payload.orderId,
        items: event.payload.items,
        destination: event.payload.shippingAddress,
      });

      // Mark as processed AFTER successful handling
      await this.idempotencyStore.markProcessed(eventId, {
        processedAt: new Date(),
        result: 'shipment_created',
      });
    } catch (error) {
      // Don't mark as processed — allow retry
      this.logger.error('Failed to handle OrderPlaced event', { eventId, error });
      throw error; // Re-throw to trigger message retry
    }
  }
}

// Idempotency store implementation
class PostgresIdempotencyStore implements IdempotencyStore {
  async exists(eventId: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT 1 FROM processed_events WHERE event_id = $1',
      [eventId],
    );
    return result.rowCount > 0;
  }

  async markProcessed(eventId: string, metadata: ProcessingMetadata): Promise<void> {
    await this.db.query(
      `INSERT INTO processed_events (event_id, processed_at, result)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, metadata.processedAt, metadata.result],
    );
  }
}
```

---

## 7. Communication Anti-Patterns

| Anti-Pattern | Description | Fix |
|-------------|-------------|-----|
| **Synchronous Chain** | A→B→C→D sync calls; total latency = sum of all | Break chain with events; max 2 sync hops |
| **Chatty Communication** | 20+ calls between services for one operation | Batch API, event carry state transfer, or merge services |
| **Temporal Coupling** | Service A cannot function when B is down | Use async events with local cache fallback |
| **Event Soup** | Hundreds of fine-grained events with no schema | Define event catalog, use schema registry, version events |
| **Smart Pipes** | Business logic in ESB/middleware transforms | Dumb pipes (Kafka/RabbitMQ), smart endpoints (services) |
| **Distributed Transactions** | Two-phase commit across services | Saga pattern with compensating transactions |
| **Missing Dead Letter Queue** | Failed messages disappear silently | Always configure DLQ, monitor and re-process |
| **No Correlation ID** | Cannot trace a request across services | Generate correlation ID at entry point, propagate everywhere |
| **Payload Coupling** | Consumer depends on every field of producer's event | Consumer reads only fields it needs, ignore unknown fields |
| **Missing Idempotency** | Duplicate messages cause duplicate operations | Idempotency key in every handler |

---

## 8. Communication Pattern Decision Guide

```
Do you need an immediate response?
├── YES: Is it a query (read-only)?
│   ├── YES: Use synchronous REST/gRPC
│   │   └── Add circuit breaker + cache fallback
│   └── NO (command): Can the caller proceed without confirmation?
│       ├── YES: Use async command (message queue)
│       └── NO: Use sync REST/gRPC with timeout
│           └── Keep the call chain ≤ 2 hops
└── NO: Use async event (pub/sub)
    ├── Is ordering important?
    │   ├── YES: Kafka (partition by entity ID)
    │   └── NO: RabbitMQ (fan-out exchange)
    ├── Do you need replay/audit?
    │   ├── YES: Kafka (log retention)
    │   └── NO: Either works
    └── Is this a broadcast notification?
        ├── YES: Pub/sub (topic exchange in RabbitMQ, topic in Kafka)
        └── NO: Point-to-point (work queue in RabbitMQ, single consumer group in Kafka)
```

---

## 9. Enforcement Checklist

- [ ] **Default to async** — Every new inter-service communication starts as event-driven unless proven otherwise
- [ ] **Max 2 sync hops** — No synchronous call chains deeper than 2 services
- [ ] **Circuit breakers on ALL sync calls** — timeout + retry + fallback
- [ ] **Correlation ID everywhere** — Generated at API gateway, propagated through all services
- [ ] **Events have schemas** — Versioned, backward-compatible, in a schema registry
- [ ] **Idempotent handlers** — Every message handler checks for duplicate processing
- [ ] **Dead Letter Queues** — Failed messages go to DLQ, monitored and alerted
- [ ] **Message ordering by entity** — Partition by entity ID, not by event type
- [ ] **Anti-Corruption Layer** — Map external service responses to internal domain models
- [ ] **Contract tests** — Consumer-driven contract tests for all sync calls
- [ ] **No synchronous writes across services** — If Service A needs to write to Service B's data, use events
- [ ] **Monitor message lag** — Alert when consumer falls behind producer
