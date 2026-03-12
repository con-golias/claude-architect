# System Design: Idempotency — Complete Specification

> **AI Plugin Directive:** Idempotency means that performing the same operation multiple times produces the SAME result as performing it once. In distributed systems, EVERY write operation MUST be idempotent because retries are INEVITABLE — network timeouts, client crashes, message redelivery, and worker restarts all cause duplicate execution. Without idempotency, retries create duplicate charges, duplicate orders, duplicate emails, and data corruption. This is not optional — it is a REQUIREMENT for any reliable system.

---

## 1. Why Idempotency is Non-Negotiable

```
THE PROBLEM — RETRIES ARE INEVITABLE:

  Scenario 1: Network timeout
    Client → Server: "Charge $50"
    Server processes payment ✅
    Server → Client: response gets lost (network timeout)
    Client retries: "Charge $50" (AGAIN)
    Without idempotency: Customer charged $100 ❌

  Scenario 2: Message queue redelivery
    Queue delivers message: "Send welcome email"
    Worker processes and sends email ✅
    Worker crashes before acknowledging the message
    Queue redelivers: "Send welcome email" (AGAIN)
    Without idempotency: Customer gets 2 welcome emails ❌

  Scenario 3: Distributed saga
    Step 1: Reserve inventory ✅
    Step 2: Charge payment ✅
    Step 3: Create shipping label → TIMEOUT
    Orchestrator retries Step 3: "Create shipping label"
    Without idempotency: Two shipping labels created ❌

RULE: If an operation can be called more than once (and it WILL be),
      it MUST be idempotent. This applies to:
  - ALL API mutation endpoints (POST, PUT, PATCH, DELETE)
  - ALL message queue consumers
  - ALL saga/workflow steps
  - ALL webhook handlers
  - ALL cron jobs and scheduled tasks
```

---

## 2. Naturally Idempotent vs Needs Idempotency

```
NATURALLY IDEMPOTENT (safe to retry as-is):

  HTTP GET:    Reading data. Multiple reads = same result.
  HTTP PUT:    Replace entire resource. Doing it twice = same state.
  HTTP DELETE: Delete resource. Already deleted = still gone (return 204 or 404).
  SET x = 5:  Setting absolute value. Doing it twice = same value.
  UPSERT:     Insert or update. Doing it twice = same row.

NOT NATURALLY IDEMPOTENT (MUST add idempotency):

  HTTP POST:     Create resource. Doing it twice = two resources.
  INCREMENT:     x = x + 1. Doing it twice = x + 2.
  APPEND:        list.push(item). Doing it twice = item appears twice.
  SEND EMAIL:    Side effect. Doing it twice = two emails sent.
  CHARGE PAYMENT: Side effect. Doing it twice = double charge.
  QUEUE MESSAGE:  Publishing event. Doing it twice = event processed twice.

RULE: Convert non-idempotent operations to idempotent:
  INCREMENT x → SET x = specific_value (using optimistic locking)
  APPEND item → UPSERT item with unique ID
  POST → POST with Idempotency-Key header
  SEND EMAIL → Check "already sent" flag before sending
  CHARGE → Check "already charged" with idempotency key
```

---

## 3. The Idempotency Key Pattern

```
The STANDARD pattern for making any operation idempotent:

1. Client generates a UNIQUE idempotency key (UUID v4)
2. Client sends key with the request (header or body)
3. Server checks if key was already processed:
   a. If YES → return the stored response (do NOT re-execute)
   b. If NO → process the request, store key + response, return response
4. Client can safely retry with the SAME key

KEY RULES:
  - Client generates the key (NOT the server)
  - Key is unique per INTENDED operation (same operation = same key)
  - Keys expire after a TTL (24 hours is common)
  - Server stores: key, response, status (processing/completed/failed)
  - Processing state prevents concurrent duplicate execution
```

```typescript
// Idempotency key implementation — production-ready
interface IdempotencyRecord {
  key: string;
  status: 'processing' | 'completed' | 'failed';
  responseCode: number | null;
  responseBody: string | null;
  createdAt: Date;
  expiresAt: Date;
}

class IdempotencyStore {
  constructor(private readonly db: Database) {}

  // Try to acquire the idempotency key
  // Returns null if acquired (proceed with operation)
  // Returns stored response if already processed
  async tryAcquire(key: string, ttlHours: number = 24): Promise<IdempotencyRecord | null> {
    try {
      // Atomic insert — only succeeds if key doesn't exist
      await this.db.query(
        `INSERT INTO idempotency_keys (key, status, created_at, expires_at)
         VALUES ($1, 'processing', NOW(), NOW() + INTERVAL '${ttlHours} hours')`,
        [key],
      );
      return null; // Key acquired — proceed with operation
    } catch (error) {
      if (error.code === '23505') { // Unique violation — key exists
        const existing = await this.db.query(
          `SELECT * FROM idempotency_keys WHERE key = $1`,
          [key],
        );

        if (existing.rows[0].status === 'processing') {
          // Another request is currently processing with this key
          // Return 409 Conflict to let client retry later
          throw new ConflictError('Request is already being processed');
        }

        return existing.rows[0]; // Return stored response
      }
      throw error;
    }
  }

  async complete(
    key: string,
    responseCode: number,
    responseBody: any,
  ): Promise<void> {
    await this.db.query(
      `UPDATE idempotency_keys
       SET status = 'completed',
           response_code = $2,
           response_body = $3
       WHERE key = $1`,
      [key, responseCode, JSON.stringify(responseBody)],
    );
  }

  async fail(key: string): Promise<void> {
    // On failure, DELETE the key so the operation can be retried
    // A failed operation should NOT block future retries
    await this.db.query(
      `DELETE FROM idempotency_keys WHERE key = $1`,
      [key],
    );
  }
}

// Database schema
/*
CREATE TABLE idempotency_keys (
  key           VARCHAR(255) PRIMARY KEY,
  status        VARCHAR(20) NOT NULL DEFAULT 'processing',
  response_code INTEGER,
  response_body JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,

  -- Auto-cleanup expired keys
  CONSTRAINT valid_status CHECK (status IN ('processing', 'completed', 'failed'))
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys (expires_at);

-- Periodic cleanup job:
-- DELETE FROM idempotency_keys WHERE expires_at < NOW();
*/
```

```typescript
// Idempotency middleware for Express/Fastify
function idempotencyMiddleware(store: IdempotencyStore) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only apply to mutating requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers['idempotency-key'] as string;

    // POST requests REQUIRE an idempotency key
    if (req.method === 'POST' && !idempotencyKey) {
      return res.status(400).json({
        error: 'Missing Idempotency-Key header',
        message: 'POST requests require an Idempotency-Key header (UUID v4)',
      });
    }

    if (!idempotencyKey) {
      return next(); // PUT/DELETE are naturally idempotent
    }

    // Check if this key was already processed
    try {
      const existing = await store.tryAcquire(idempotencyKey);

      if (existing) {
        // Already processed — return stored response
        res.status(existing.responseCode!);
        res.set('Idempotent-Replayed', 'true'); // Signal this is a replay
        return res.json(JSON.parse(existing.responseBody!));
      }
    } catch (error) {
      if (error instanceof ConflictError) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'This request is currently being processed. Please retry.',
        });
      }
      throw error;
    }

    // Not yet processed — let the handler execute
    // Intercept the response to store it
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // Store the response for future replay
      store.complete(idempotencyKey, res.statusCode, body).catch(err => {
        console.error('Failed to store idempotency response', err);
      });
      return originalJson(body);
    };

    // If the handler throws, clean up the key
    try {
      await next();
    } catch (error) {
      await store.fail(idempotencyKey);
      throw error;
    }
  };
}
```

---

## 4. Database-Level Idempotency

### 4.1 Unique Constraints

```typescript
// The simplest form of idempotency: unique constraints prevent duplicates

// INSTEAD OF:
await db.query('INSERT INTO orders (user_id, product_id, quantity) VALUES ($1, $2, $3)',
  [userId, productId, quantity]);
// Problem: Retry creates duplicate order

// USE:
await db.query(
  `INSERT INTO orders (id, user_id, product_id, quantity)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (id) DO NOTHING`,  // Idempotent: second insert is a no-op
  [orderId, userId, productId, quantity],
);
// Client generates orderId (UUID) — same orderId on retry = no duplicate

// FOR NATURAL KEYS:
await db.query(
  `INSERT INTO subscriptions (user_id, plan_id, period_start)
   VALUES ($1, $2, $3)
   ON CONFLICT (user_id, plan_id, period_start) DO NOTHING`,
  [userId, planId, periodStart],
);
// Natural unique key prevents duplicate subscription for same period
```

### 4.2 Optimistic Locking for Updates

```typescript
// Prevent lost updates and ensure idempotent modifications

// INSTEAD OF (not idempotent):
await db.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2',
  [amount, accountId]);
// Problem: Retry deducts twice

// USE (idempotent with version check):
class IdempotentAccountRepository {
  async debit(accountId: string, amount: number, transactionId: string): Promise<boolean> {
    // 1. Check if this transaction was already processed
    const existing = await this.db.query(
      'SELECT id FROM transactions WHERE id = $1',
      [transactionId],
    );
    if (existing.rowCount > 0) {
      return true; // Already processed — idempotent success
    }

    // 2. Debit with optimistic locking
    const result = await this.db.transaction(async (tx) => {
      const account = await tx.query(
        'SELECT balance, version FROM accounts WHERE id = $1 FOR UPDATE',
        [accountId],
      );

      if (account.rows[0].balance < amount) {
        throw new InsufficientFundsError();
      }

      // Update with version check
      const updated = await tx.query(
        `UPDATE accounts
         SET balance = balance - $1, version = version + 1
         WHERE id = $2 AND version = $3`,
        [amount, accountId, account.rows[0].version],
      );

      if (updated.rowCount === 0) {
        throw new OptimisticLockError('Account was modified concurrently');
      }

      // Record the transaction for idempotency
      await tx.query(
        'INSERT INTO transactions (id, account_id, amount, type) VALUES ($1, $2, $3, $4)',
        [transactionId, accountId, amount, 'debit'],
      );

      return true;
    });

    return result;
  }
}
```

### 4.3 Conditional Writes (Compare-and-Set)

```typescript
// Atomic conditional update — prevents duplicate state transitions

class OrderStateMachine {
  async transitionOrder(
    orderId: string,
    fromStatus: string,
    toStatus: string,
    transitionId: string, // Idempotency key for this transition
  ): Promise<boolean> {
    // Check if this transition was already applied
    const existing = await this.db.query(
      'SELECT id FROM order_transitions WHERE id = $1',
      [transitionId],
    );
    if (existing.rowCount > 0) {
      return true; // Already transitioned — idempotent
    }

    // Conditional update: only transitions if in expected state
    const result = await this.db.transaction(async (tx) => {
      const updated = await tx.query(
        `UPDATE orders SET status = $1, updated_at = NOW()
         WHERE id = $2 AND status = $3`,
        [toStatus, orderId, fromStatus],
      );

      if (updated.rowCount === 0) {
        // Either order doesn't exist or status already changed
        const order = await tx.query('SELECT status FROM orders WHERE id = $1', [orderId]);
        if (order.rows[0]?.status === toStatus) {
          return true; // Already in target state — idempotent
        }
        throw new InvalidStateTransitionError(
          `Order ${orderId} is in state ${order.rows[0]?.status}, expected ${fromStatus}`,
        );
      }

      // Record transition for idempotency and audit
      await tx.query(
        `INSERT INTO order_transitions (id, order_id, from_status, to_status, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [transitionId, orderId, fromStatus, toStatus],
      );

      return true;
    });

    return result;
  }
}
```

---

## 5. Message Processing Idempotency

### 5.1 Deduplication Store

```typescript
// Message queue consumer with deduplication
class IdempotentMessageHandler {
  constructor(
    private readonly db: Database,
    private readonly redis: Redis,
  ) {}

  async handleMessage(message: QueueMessage): Promise<void> {
    const messageId = message.id; // Every message MUST have a unique ID

    // LAYER 1: Fast check in Redis (catch most duplicates cheaply)
    const seen = await this.redis.get(`msg:${messageId}`);
    if (seen) {
      console.log(`Message ${messageId} already processed (Redis cache hit)`);
      return; // Acknowledge and skip
    }

    // LAYER 2: Authoritative check in database (handles Redis eviction)
    const processed = await this.db.query(
      'SELECT id FROM processed_messages WHERE message_id = $1',
      [messageId],
    );
    if (processed.rowCount > 0) {
      // Update Redis cache for future fast lookups
      await this.redis.setex(`msg:${messageId}`, 86400, '1');
      console.log(`Message ${messageId} already processed (DB check)`);
      return;
    }

    // LAYER 3: Process with transactional deduplication
    await this.db.transaction(async (tx) => {
      // Insert deduplication record FIRST (acts as a lock)
      try {
        await tx.query(
          `INSERT INTO processed_messages (message_id, processed_at)
           VALUES ($1, NOW())`,
          [messageId],
        );
      } catch (error) {
        if (error.code === '23505') { // Unique violation — race condition
          return; // Another worker got it first
        }
        throw error;
      }

      // Process the message within the same transaction
      await this.processMessage(tx, message);
    });

    // Update Redis cache
    await this.redis.setex(`msg:${messageId}`, 86400, '1');
  }

  private async processMessage(tx: Transaction, message: QueueMessage): Promise<void> {
    // Business logic here — all within the transaction
    switch (message.type) {
      case 'ORDER_PLACED':
        await this.handleOrderPlaced(tx, message.payload);
        break;
      case 'PAYMENT_RECEIVED':
        await this.handlePaymentReceived(tx, message.payload);
        break;
      // ...
    }
  }
}

/*
CREATE TABLE processed_messages (
  message_id  VARCHAR(255) PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_processed_messages_date ON processed_messages (processed_at);

-- Cleanup: DELETE FROM processed_messages WHERE processed_at < NOW() - INTERVAL '7 days';
*/
```

### 5.2 Exactly-Once Processing Pattern

```
TRUE "EXACTLY ONCE" IS IMPOSSIBLE in distributed systems.
What we achieve is "EFFECTIVELY ONCE" through:
  At-least-once delivery + Idempotent processing = Effectively once

THREE APPROACHES:

1. TRANSACTIONAL OUTBOX + DEDUP:
   - Producer: Write to outbox table in same DB transaction
   - Consumer: Dedup by message ID before processing
   - MOST RELIABLE. Use for critical business operations.

2. KAFKA EXACTLY-ONCE SEMANTICS (EOS):
   - enable.idempotence = true (producer)
   - isolation.level = read_committed (consumer)
   - Transactions span produce + consume
   - KAFKA-SPECIFIC. Only works within Kafka ecosystem.

3. IDEMPOTENT CONSUMER PATTERN:
   - Consumer checks "already processed" before executing
   - Business logic is designed to be naturally idempotent
   - UNIVERSAL. Works with any message broker.
```

```typescript
// Kafka consumer with exactly-once semantics
class ExactlyOnceKafkaConsumer {
  async processMessage(message: KafkaMessage): Promise<void> {
    const key = `${message.topic}:${message.partition}:${message.offset}`;

    await this.db.transaction(async (tx) => {
      // 1. Check if already processed (by topic+partition+offset)
      const exists = await tx.query(
        `SELECT 1 FROM consumer_offsets
         WHERE consumer_group = $1 AND topic = $2
         AND partition = $3 AND offset >= $4`,
        [this.consumerGroup, message.topic, message.partition, message.offset],
      );

      if (exists.rowCount > 0) {
        return; // Already processed at this or higher offset
      }

      // 2. Process the business logic
      await this.handleBusinessLogic(tx, message);

      // 3. Store the consumer offset in the SAME transaction
      await tx.query(
        `INSERT INTO consumer_offsets (consumer_group, topic, partition, offset, processed_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (consumer_group, topic, partition)
         DO UPDATE SET offset = EXCLUDED.offset, processed_at = NOW()`,
        [this.consumerGroup, message.topic, message.partition, message.offset],
      );
    });

    // 4. Commit Kafka offset AFTER database transaction succeeds
    await this.consumer.commitOffsets([{
      topic: message.topic,
      partition: message.partition,
      offset: (message.offset + 1).toString(),
    }]);
  }
}
```

---

## 6. API Idempotency by HTTP Method

```
METHOD-BY-METHOD IDEMPOTENCY RULES:

GET, HEAD, OPTIONS:
  Naturally idempotent (read-only).
  Safe to retry unlimited times.
  NEVER modify state on GET requests.

PUT:
  Naturally idempotent (full replacement).
  PUT /users/123 { name: "Alice" } — always results in same state.
  ENSURE: PUT replaces ENTIRE resource, not partial update.

DELETE:
  Naturally idempotent (delete is delete).
  DELETE /users/123 — first call deletes, second call returns 404 (or 204).
  BOTH are valid success responses.
  ENSURE: Return 204 (or 200) on first delete, 404 on subsequent.

PATCH:
  NOT naturally idempotent.
  PATCH /users/123 { age: +1 } — increments each time.
  ENSURE: Use absolute values (set age = 30, not age += 1).
  Or: Use Idempotency-Key header.

POST:
  NEVER naturally idempotent.
  POST /orders { ... } — creates new order each time.
  ALWAYS require Idempotency-Key header for POST requests.
  Or: Use client-generated IDs (POST with UUID).
```

```typescript
// Making POST idempotent with client-generated ID
class OrderController {
  // APPROACH 1: Client-generated ID in body
  async createOrder(req: Request, res: Response): Promise<void> {
    const { orderId, items, shippingAddress } = req.body;

    // orderId is generated by the client (UUID v4)
    // Using UPSERT makes this idempotent
    const result = await this.db.query(
      `INSERT INTO orders (id, user_id, items, shipping_address, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [orderId, req.user.id, JSON.stringify(items), JSON.stringify(shippingAddress)],
    );

    if (result.rowCount === 0) {
      // Already exists — return the existing order
      const existing = await this.db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
      res.status(200).json(existing.rows[0]); // 200, not 201 — it's a replay
      return;
    }

    // New order created
    await this.eventBus.publish('OrderCreated', { orderId, items });
    res.status(201).json(result.rows[0]);
  }

  // APPROACH 2: Idempotency-Key header
  async createPayment(req: Request, res: Response): Promise<void> {
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) {
      res.status(400).json({ error: 'Idempotency-Key header is required' });
      return;
    }

    // Handled by idempotency middleware (see Section 3)
    const payment = await this.paymentService.charge({
      orderId: req.body.orderId,
      amount: req.body.amount,
      currency: req.body.currency,
    });

    res.status(201).json(payment);
  }
}
```

---

## 7. Side Effect Idempotency

```
Side effects (emails, SMS, webhooks, third-party API calls)
are the HARDEST to make idempotent because you can't roll them back.

STRATEGIES:

1. CHECK-BEFORE-EXECUTE:
   Record that the side effect was triggered.
   Before triggering, check the record.

2. EXTERNAL IDEMPOTENCY KEY:
   Pass your idempotency key to the external service.
   (Stripe, PayPal, etc. support this natively.)

3. OUTBOX + DEDUPLICATION:
   Write side effect intent to outbox table.
   Separate processor reads outbox and deduplicates.

4. IDEMPOTENT EXTERNAL CALLS:
   Design external calls to be naturally idempotent.
   Use PUT instead of POST where possible.
```

```typescript
// Idempotent email sending
class IdempotentEmailService {
  constructor(
    private readonly db: Database,
    private readonly emailProvider: EmailProvider,
  ) {}

  async sendEmail(emailId: string, to: string, template: string, data: any): Promise<void> {
    // 1. Check if already sent
    const existing = await this.db.query(
      'SELECT status FROM sent_emails WHERE id = $1',
      [emailId],
    );

    if (existing.rows[0]?.status === 'sent') {
      return; // Already sent — skip silently
    }

    if (existing.rows[0]?.status === 'sending') {
      // Another process is sending — wait or skip
      return;
    }

    // 2. Mark as sending (claim the work)
    await this.db.query(
      `INSERT INTO sent_emails (id, recipient, template, status, created_at)
       VALUES ($1, $2, $3, 'sending', NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'sending'
       WHERE sent_emails.status != 'sent'`,
      [emailId, to, template],
    );

    // 3. Send the email
    try {
      await this.emailProvider.send({
        to,
        template,
        data,
        // Pass our ID as external reference for provider-level dedup
        headers: { 'X-Idempotency-Key': emailId },
      });

      // 4. Mark as sent
      await this.db.query(
        `UPDATE sent_emails SET status = 'sent', sent_at = NOW() WHERE id = $1`,
        [emailId],
      );
    } catch (error) {
      // Mark as failed — can be retried
      await this.db.query(
        `UPDATE sent_emails SET status = 'failed', error = $2 WHERE id = $1`,
        [emailId, error.message],
      );
      throw error;
    }
  }
}

// Idempotent payment with Stripe's built-in idempotency
class IdempotentPaymentService {
  async chargeCustomer(
    paymentId: string,  // Our idempotency key
    customerId: string,
    amount: number,
    currency: string,
  ): Promise<PaymentResult> {
    // 1. Check if already processed locally
    const existing = await this.db.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId],
    );
    if (existing.rows[0]?.status === 'succeeded') {
      return existing.rows[0];
    }

    // 2. Call Stripe with idempotency key
    // Stripe will return the same result for duplicate keys
    const charge = await stripe.paymentIntents.create(
      {
        amount,
        currency,
        customer: customerId,
        metadata: { paymentId },
      },
      {
        idempotencyKey: paymentId, // Stripe's native idempotency
      },
    );

    // 3. Store result locally
    await this.db.query(
      `INSERT INTO payments (id, stripe_id, amount, currency, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET
         stripe_id = EXCLUDED.stripe_id,
         status = EXCLUDED.status`,
      [paymentId, charge.id, amount, currency, charge.status],
    );

    return { id: paymentId, stripeId: charge.id, status: charge.status };
  }
}
```

---

## 8. Idempotency in Event-Driven Systems

```typescript
// Event handler with idempotency
class IdempotentEventHandler {
  constructor(
    private readonly db: Database,
    private readonly redis: Redis,
  ) {}

  // Decorator pattern for idempotent handling
  idempotent<T>(
    handler: (event: DomainEvent, tx: Transaction) => Promise<T>,
  ): (event: DomainEvent) => Promise<T | null> {
    return async (event: DomainEvent): Promise<T | null> => {
      const eventId = event.id;

      // Fast path: check Redis
      if (await this.redis.exists(`event:${eventId}`)) {
        return null; // Already handled
      }

      // Process within a transaction
      return await this.db.transaction(async (tx) => {
        // Authoritative dedup check + claim
        try {
          await tx.query(
            `INSERT INTO handled_events (event_id, handler_name, started_at)
             VALUES ($1, $2, NOW())`,
            [eventId, handler.name],
          );
        } catch (error) {
          if (error.code === '23505') return null; // Already handled
          throw error;
        }

        // Execute the handler
        const result = await handler(event, tx);

        // Mark complete
        await tx.query(
          `UPDATE handled_events SET completed_at = NOW() WHERE event_id = $1 AND handler_name = $2`,
          [eventId, handler.name],
        );

        // Cache in Redis for fast future checks
        await this.redis.setex(`event:${eventId}`, 86400, '1');

        return result;
      });
    };
  }
}

// Usage
class OrderEventHandlers {
  constructor(private readonly idempotency: IdempotentEventHandler) {}

  handleOrderPlaced = this.idempotency.idempotent(
    async (event: OrderPlacedEvent, tx: Transaction) => {
      // This handler is guaranteed to execute AT MOST ONCE per event
      await tx.query(
        'INSERT INTO order_analytics (order_id, amount, created_at) VALUES ($1, $2, NOW())',
        [event.orderId, event.totalAmount],
      );
      await this.notificationService.sendOrderConfirmation(event.orderId);
    },
  );

  handlePaymentFailed = this.idempotency.idempotent(
    async (event: PaymentFailedEvent, tx: Transaction) => {
      await tx.query(
        `UPDATE orders SET status = 'payment_failed' WHERE id = $1 AND status = 'pending'`,
        [event.orderId],
      );
    },
  );
}
```

---

## 9. Idempotency Key Generation

```
CLIENT-SIDE KEY GENERATION RULES:

1. USE UUID v4 for independent operations:
   const idempotencyKey = crypto.randomUUID();
   Each new INTENDED operation gets a new UUID.
   Retries of the SAME operation use the SAME UUID.

2. USE DETERMINISTIC KEYS for naturally unique operations:
   const key = `order:${userId}:${cartId}:${timestamp}`;
   Same inputs always generate the same key.
   Use when the operation has a natural unique identifier.

3. NEVER use sequential IDs (predictable, guessable).

4. NEVER let the server generate the key (defeats the purpose).

5. STORE the key on the client until the operation succeeds.
   If response is ambiguous (timeout), retry with SAME key.
   Only generate a NEW key for a NEW operation.

COMMON PATTERNS:
  Payment:    key = `pay:${orderId}`           (one payment per order)
  Email:      key = `email:${type}:${userId}:${date}`  (one per type per day)
  Webhook:    key = webhook's event ID          (provided by the source)
  Order:      key = UUID v4                     (client generates)
  Transfer:   key = `xfer:${fromId}:${toId}:${amount}:${nonce}` (deterministic)
```

```typescript
// Client-side idempotency key management
class IdempotentApiClient {
  private pendingKeys: Map<string, string> = new Map();

  async createOrder(orderData: CreateOrderRequest): Promise<Order> {
    // Generate key for this operation (or reuse if retrying)
    const operationId = `order:${orderData.cartId}`;
    let idempotencyKey = this.pendingKeys.get(operationId);

    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID();
      this.pendingKeys.set(operationId, idempotencyKey);
    }

    try {
      const response = await this.httpClient.post('/orders', orderData, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });

      // Success — clear the pending key
      this.pendingKeys.delete(operationId);
      return response.data;
    } catch (error) {
      if (error.status === 409) {
        // Request in progress — wait and retry with same key
        await this.sleep(2000);
        return this.createOrder(orderData); // Retry with SAME key
      }
      if (error.isNetworkError || error.isTimeout) {
        // Ambiguous result — retry with SAME key
        return this.createOrder(orderData); // Retry with SAME key
      }
      // Clear error (4xx) — clear key, don't retry
      this.pendingKeys.delete(operationId);
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 10. Testing Idempotency

```typescript
// Every idempotent operation MUST be tested for idempotency

describe('Payment idempotency', () => {
  it('should charge exactly once even with duplicate requests', async () => {
    const idempotencyKey = uuid();
    const chargeRequest = { amount: 5000, currency: 'USD', customerId: 'cust_123' };

    // First request — should succeed
    const result1 = await paymentService.charge(idempotencyKey, chargeRequest);
    expect(result1.status).toBe('succeeded');

    // Same request with same key — should return same result, NOT charge again
    const result2 = await paymentService.charge(idempotencyKey, chargeRequest);
    expect(result2.status).toBe('succeeded');
    expect(result2.id).toBe(result1.id); // Same payment ID

    // Verify only one charge was made
    const charges = await db.query(
      'SELECT * FROM payments WHERE idempotency_key = $1',
      [idempotencyKey],
    );
    expect(charges.rowCount).toBe(1);
  });

  it('should handle concurrent duplicate requests', async () => {
    const idempotencyKey = uuid();
    const chargeRequest = { amount: 5000, currency: 'USD', customerId: 'cust_123' };

    // Send two identical requests SIMULTANEOUSLY
    const [result1, result2] = await Promise.allSettled([
      paymentService.charge(idempotencyKey, chargeRequest),
      paymentService.charge(idempotencyKey, chargeRequest),
    ]);

    // One should succeed, one should either succeed with same result or get 409
    const succeeded = [result1, result2].filter(r => r.status === 'fulfilled');
    expect(succeeded.length).toBeGreaterThanOrEqual(1);

    // Verify only one charge
    const charges = await db.query('SELECT COUNT(*) FROM payments WHERE idempotency_key = $1',
      [idempotencyKey]);
    expect(parseInt(charges.rows[0].count)).toBe(1);
  });

  it('should allow retry after failure', async () => {
    const idempotencyKey = uuid();

    // First attempt — simulate failure
    mockPaymentProvider.failNext();
    await expect(
      paymentService.charge(idempotencyKey, { amount: 5000 }),
    ).rejects.toThrow();

    // Retry with SAME key — should work (key was cleaned up on failure)
    mockPaymentProvider.succeedNext();
    const result = await paymentService.charge(idempotencyKey, { amount: 5000 });
    expect(result.status).toBe('succeeded');
  });

  it('should reject mismatched request body for same key', async () => {
    const idempotencyKey = uuid();

    // First request
    await paymentService.charge(idempotencyKey, { amount: 5000 });

    // Same key but DIFFERENT amount — should reject
    await expect(
      paymentService.charge(idempotencyKey, { amount: 10000 }),
    ).rejects.toThrow('Idempotency key reused with different parameters');
  });
});
```

---

## 11. Anti-Patterns

| Anti-Pattern | Description | Fix |
|-------------|-------------|-----|
| **No Idempotency on POST** | POST endpoints create duplicates on retry | Require Idempotency-Key header or client-generated IDs |
| **Server-Generated Keys** | Server creates the idempotency key | Client MUST generate and send the key |
| **No Dedup on Queue Consumers** | Message redelivery causes duplicate processing | Dedup store (DB + Redis) before processing |
| **Increment Without Dedup** | `balance += amount` on retry charges twice | Use absolute values or transaction ID check |
| **Side Effects Without Guard** | Retry sends duplicate emails/webhooks | Check "already sent" flag before side effects |
| **Ignoring Concurrent Duplicates** | Race condition: two identical requests process simultaneously | Use DB unique constraint or distributed lock |
| **Never Expiring Keys** | Idempotency key table grows forever | TTL + cleanup job (24-hour expiry is common) |
| **Failing Closed on Dedup Store Down** | Dedup store unavailable → reject all requests | Fail open with logging, or use local fallback |
| **Not Testing Idempotency** | Assume it works without explicit tests | Test: duplicate calls, concurrent calls, retry after failure |
| **Different Response for Replay** | Replay returns 201, should return 200 | Stored responses return exact same result + "Replayed" header |

---

## 12. Enforcement Checklist

- [ ] **Every POST endpoint has idempotency** — via Idempotency-Key header or client-generated IDs
- [ ] **Every message consumer has deduplication** — check before process, within same transaction
- [ ] **Every saga step is idempotent** — retries produce same result
- [ ] **Side effects are guarded** — emails, payments, webhooks check "already done" before executing
- [ ] **Database writes use UPSERT or unique constraints** — prevent duplicate rows
- [ ] **Idempotency keys expire** — cleanup job removes keys older than TTL
- [ ] **Concurrent duplicates handled** — unique constraints or distributed locks prevent race conditions
- [ ] **Failed operations clean up keys** — allow retry after transient failure
- [ ] **Replay returns stored response** — not re-execution, with "Idempotent-Replayed" header
- [ ] **Idempotency is tested** — duplicate calls, concurrent calls, retry-after-failure all covered
- [ ] **Client retries use same key** — new key only for new intended operation
