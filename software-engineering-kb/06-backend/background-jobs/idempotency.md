# Idempotency

> **AI Plugin Directive — Idempotency & Exactly-Once Processing**
> You are an AI coding assistant. When generating, reviewing, or refactoring code that processes
> jobs, handles webhooks, or mutates state, follow EVERY rule in this document. Without idempotency,
> retries cause duplicate charges, duplicate emails, and corrupted data. Treat each section as non-negotiable.

**Core Rule: EVERY job handler, webhook processor, and state-mutating operation MUST be idempotent — calling it multiple times with the same input MUST produce the same result as calling it once. ALWAYS use an idempotency key to detect and deduplicate repeated requests.**

---

## 1. Idempotency Fundamentals

```
┌──────────────────────────────────────────────────────────────┐
│                 Idempotency Explained                         │
│                                                               │
│  Idempotent:     f(x) = f(f(x))                             │
│  Same input → Same output, no additional side effects        │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Naturally Idempotent Operations:                      │    │
│  │ ├── SET user.email = "new@email.com"   (same result) │    │
│  │ ├── DELETE FROM orders WHERE id = 123  (same result) │    │
│  │ ├── PUT /users/123 { name: "Alice" }   (same result) │    │
│  │ └── GET /users/123                     (read-only)    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ NOT Naturally Idempotent (need protection):           │    │
│  │ ├── INSERT INTO orders (...)           (duplicate)    │    │
│  │ ├── balance += 100                     (double credit)│    │
│  │ ├── POST /payments/charge              (double charge)│    │
│  │ ├── sendEmail(to, subject, body)       (double send)  │    │
│  │ └── counter++                          (double count) │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

| HTTP Method | Naturally Idempotent | Notes |
|-------------|---------------------|-------|
| GET | YES | Read-only, no side effects |
| PUT | YES | Full replacement — same input = same state |
| DELETE | YES | Deleting already-deleted = no change |
| HEAD | YES | Same as GET without body |
| OPTIONS | YES | Metadata only |
| **POST** | **NO** | Creates new resource each time |
| **PATCH** | **NO** | Partial update may have side effects |

ALWAYS make POST and PATCH handlers idempotent using idempotency keys.

---

## 2. Idempotency Key Pattern

### 2.1 How It Works

```
┌──────────────────────────────────────────────────────────────┐
│              Idempotency Key Flow                             │
│                                                               │
│  Client                    Server                    DB       │
│    │                         │                        │       │
│    │── POST /payments ─────►│                        │       │
│    │   Idempotency-Key: abc  │                        │       │
│    │   { amount: 100 }       │                        │       │
│    │                         │── Check key exists? ──►│       │
│    │                         │◄── No ────────────────│       │
│    │                         │                        │       │
│    │                         │── Process payment     │       │
│    │                         │── Store result ──────►│       │
│    │                         │   key=abc,            │       │
│    │                         │   status=200,          │       │
│    │                         │   body={...}           │       │
│    │                         │                        │       │
│    │◄── 200 { id: pay_123 } │                        │       │
│    │                         │                        │       │
│    │── POST /payments ─────►│  (retry/duplicate)     │       │
│    │   Idempotency-Key: abc  │                        │       │
│    │   { amount: 100 }       │                        │       │
│    │                         │── Check key exists? ──►│       │
│    │                         │◄── Yes (cached) ──────│       │
│    │                         │                        │       │
│    │◄── 200 { id: pay_123 } │  (same response,      │       │
│    │                         │   NO re-processing)    │       │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Database Schema

```sql
CREATE TABLE idempotency_keys (
    key         VARCHAR(255) PRIMARY KEY,
    user_id     UUID NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'processing',
    -- 'processing', 'completed', 'error'
    request_path VARCHAR(500) NOT NULL,
    request_body JSONB,
    response_code INT,
    response_body JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',

    INDEX idx_idempotency_expires (expires_at) WHERE status != 'processing'
);

-- Cleanup expired keys (run daily)
DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

### 2.3 Implementation

**TypeScript**
```typescript
interface IdempotencyRecord {
  key: string;
  userId: string;
  status: "processing" | "completed" | "error";
  requestPath: string;
  requestBody: any;
  responseCode?: number;
  responseBody?: any;
  createdAt: Date;
  expiresAt: Date;
}

class IdempotencyService {
  constructor(private db: Pool) {}

  async executeIdempotent<T>(
    key: string,
    userId: string,
    requestPath: string,
    requestBody: any,
    fn: () => Promise<{ statusCode: number; body: T }>
  ): Promise<{ statusCode: number; body: T; cached: boolean }> {
    // 1. Try to insert idempotency record (atomic check-and-set)
    try {
      await this.db.query(`
        INSERT INTO idempotency_keys (key, user_id, status, request_path, request_body, expires_at)
        VALUES ($1, $2, 'processing', $3, $4, NOW() + INTERVAL '24 hours')
      `, [key, userId, requestPath, JSON.stringify(requestBody)]);
    } catch (error: any) {
      if (error.code === "23505") { // Unique constraint violation
        // Key exists — check status
        const existing = await this.db.query<IdempotencyRecord>(
          `SELECT * FROM idempotency_keys WHERE key = $1`,
          [key]
        );

        const record = existing.rows[0];

        if (record.status === "processing") {
          // Still processing — return 409 Conflict
          return {
            statusCode: 409,
            body: { error: "Request is still being processed" } as any,
            cached: false,
          };
        }

        // Return cached response
        return {
          statusCode: record.responseCode!,
          body: record.responseBody as T,
          cached: true,
        };
      }
      throw error;
    }

    // 2. Execute the operation
    try {
      const result = await fn();

      // 3. Store the result
      await this.db.query(`
        UPDATE idempotency_keys
        SET status = 'completed', response_code = $2, response_body = $3
        WHERE key = $1
      `, [key, result.statusCode, JSON.stringify(result.body)]);

      return { ...result, cached: false };
    } catch (error) {
      // Store error result
      await this.db.query(`
        UPDATE idempotency_keys
        SET status = 'error', response_code = 500,
            response_body = $2
        WHERE key = $1
      `, [key, JSON.stringify({ error: (error as Error).message })]);

      throw error;
    }
  }
}

// Middleware
function idempotencyMiddleware(service: IdempotencyService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers["idempotency-key"] as string;

    if (!key) {
      // No idempotency key — proceed normally (warn in logs)
      return next();
    }

    // Validate key format (UUIDv4)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
      return res.status(400).json({ error: "Invalid Idempotency-Key format (use UUIDv4)" });
    }

    req.idempotencyKey = key;
    next();
  };
}

// Usage in handler
app.post("/api/payments", idempotencyMiddleware(idempotencyService), async (req, res) => {
  const result = await idempotencyService.executeIdempotent(
    req.idempotencyKey,
    req.user.sub,
    req.path,
    req.body,
    async () => {
      const payment = await chargePayment(req.body);
      return { statusCode: 201, body: payment };
    }
  );

  if (result.cached) {
    res.set("X-Idempotency-Replayed", "true");
  }

  res.status(result.statusCode).json(result.body);
});
```

**Go**
```go
func (s *IdempotencyService) Execute(
    ctx context.Context,
    key, userID, path string,
    body json.RawMessage,
    fn func() (int, json.RawMessage, error),
) (int, json.RawMessage, bool, error) {

    // Try insert (atomic)
    _, err := s.db.Exec(ctx, `
        INSERT INTO idempotency_keys (key, user_id, status, request_path, request_body, expires_at)
        VALUES ($1, $2, 'processing', $3, $4, NOW() + INTERVAL '24 hours')
    `, key, userID, path, body)

    if err != nil {
        // Check for duplicate key
        var pgErr *pgconn.PgError
        if errors.As(err, &pgErr) && pgErr.Code == "23505" {
            var record IdempotencyRecord
            s.db.QueryRow(ctx,
                `SELECT status, response_code, response_body FROM idempotency_keys WHERE key = $1`,
                key,
            ).Scan(&record.Status, &record.ResponseCode, &record.ResponseBody)

            if record.Status == "processing" {
                return 409, nil, false, fmt.Errorf("request still processing")
            }

            return record.ResponseCode, record.ResponseBody, true, nil
        }
        return 0, nil, false, err
    }

    // Execute operation
    code, respBody, err := fn()
    if err != nil {
        s.db.Exec(ctx, `UPDATE idempotency_keys SET status = 'error' WHERE key = $1`, key)
        return 0, nil, false, err
    }

    s.db.Exec(ctx, `
        UPDATE idempotency_keys SET status = 'completed', response_code = $2, response_body = $3
        WHERE key = $1
    `, key, code, respBody)

    return code, respBody, false, nil
}
```

---

## 3. Job Handler Idempotency Patterns

### 3.1 Database-Level Idempotency

Use database constraints and conditional operations:

```typescript
// Pattern 1: UPSERT (INSERT ON CONFLICT)
async function processOrder(orderId: string) {
  // Idempotent — re-running with same orderId does nothing
  await db.query(`
    INSERT INTO processed_orders (order_id, processed_at)
    VALUES ($1, NOW())
    ON CONFLICT (order_id) DO NOTHING
  `, [orderId]);

  // Check if we actually inserted (first time)
  const result = await db.query(
    `SELECT * FROM processed_orders WHERE order_id = $1`,
    [orderId]
  );

  if (result.rowCount === 0) {
    return; // Already processed — skip
  }

  // Process the order...
}

// Pattern 2: Conditional UPDATE
async function creditBalance(userId: string, transactionId: string, amount: number) {
  // Idempotent — uses transactionId to prevent double credit
  const result = await db.query(`
    UPDATE wallets
    SET balance = balance + $3
    WHERE user_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM transactions WHERE id = $2
      )
    RETURNING balance
  `, [userId, transactionId, amount]);

  if (result.rowCount > 0) {
    // Record the transaction (prevents future duplicates)
    await db.query(`
      INSERT INTO transactions (id, user_id, amount, type)
      VALUES ($1, $2, $3, 'credit')
    `, [transactionId, userId, amount]);
  }
}
```

### 3.2 State Machine Idempotency

Use state transitions to prevent repeated processing:

```typescript
// Only process if in expected state
async function fulfillOrder(orderId: string) {
  const result = await db.query(`
    UPDATE orders
    SET status = 'fulfilling',
        fulfillment_started_at = NOW()
    WHERE id = $1
      AND status = 'paid'  -- Only transition from 'paid'
    RETURNING *
  `, [orderId]);

  if (result.rowCount === 0) {
    // Order not in 'paid' state — already processed or invalid
    const order = await db.query(`SELECT status FROM orders WHERE id = $1`, [orderId]);
    if (order.rows[0]?.status === "fulfilling" || order.rows[0]?.status === "fulfilled") {
      return; // Already processed — idempotent success
    }
    throw new Error(`Order ${orderId} in unexpected state: ${order.rows[0]?.status}`);
  }

  // Proceed with fulfillment...
}
```

```
State Machine Idempotency:
┌──────────────────────────────────────────────────┐
│                                                   │
│  created ──► paid ──► fulfilling ──► fulfilled   │
│                                         │         │
│  Each transition is guarded by current state:    │
│  UPDATE ... WHERE status = 'expected_state'      │
│                                                   │
│  If job runs twice:                               │
│  1st run: status=paid → fulfilling (processes)   │
│  2nd run: status=fulfilling → WHERE fails (skip) │
└──────────────────────────────────────────────────┘
```

### 3.3 External Service Call Idempotency

```typescript
// Use provider's idempotency key when available
async function chargePayment(orderId: string, amount: number) {
  // Stripe accepts idempotency key — retrying is safe
  const charge = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    metadata: { orderId },
  }, {
    idempotencyKey: `charge-${orderId}`, // Stripe deduplicates
  });

  return charge;
}

// For services WITHOUT idempotency support:
// 1. Check if external call was already made
// 2. If yes, return stored result
// 3. If no, make call and store result
async function sendSMS(userId: string, messageId: string, text: string) {
  const existing = await db.query(
    `SELECT result FROM sent_messages WHERE message_id = $1`,
    [messageId]
  );

  if (existing.rows[0]) {
    return existing.rows[0].result; // Already sent
  }

  const result = await smsProvider.send({ to: userId, text });

  await db.query(
    `INSERT INTO sent_messages (message_id, result) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [messageId, JSON.stringify(result)]
  );

  return result;
}
```

---

## 4. Webhook Idempotency

ALWAYS deduplicate incoming webhooks — providers may deliver the same event multiple times:

```typescript
async function handleWebhook(req: Request, res: Response) {
  const eventId = req.headers["x-webhook-id"] as string;
  const signature = req.headers["x-webhook-signature"] as string;

  // 1. Verify signature
  if (!verifySignature(req.body, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // 2. Deduplicate by event ID
  try {
    await db.query(`
      INSERT INTO processed_webhooks (event_id, received_at)
      VALUES ($1, NOW())
    `, [eventId]);
  } catch (error: any) {
    if (error.code === "23505") {
      // Already processed — return 200 to prevent redelivery
      return res.status(200).json({ status: "already_processed" });
    }
    throw error;
  }

  // 3. Process webhook
  const event = JSON.parse(req.body);
  await processWebhookEvent(event);

  // 4. Respond immediately
  res.status(200).json({ status: "processed" });
}
```

- ALWAYS use the provider's event ID for deduplication
- ALWAYS respond 200 for already-processed events (prevents redelivery)
- ALWAYS store processed event IDs with TTL (clean up after 7-30 days)

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No idempotency key on POST | Duplicate charges, duplicate records | Require `Idempotency-Key` header |
| INSERT without ON CONFLICT | Duplicate rows on retry | Use UPSERT or check-then-insert |
| balance += amount without guard | Double credit on retry | Use transaction ID + conditional update |
| No webhook deduplication | Same event processed multiple times | Store processed event IDs |
| Idempotency key per session | Same key reused across requests | One unique key per operation |
| No idempotency key expiry | Table grows forever | 24-hour TTL with cleanup job |
| Checking key in application only | Race condition between check and insert | Use database constraint (atomic) |
| Non-deterministic job results | Same input → different output on retry | Use fixed timestamps, deterministic IDs |
| Sending email without dedup | Duplicate emails on retry | Track sent messages by ID |
| No state machine for workflows | Multi-step process repeated from start | Guard transitions with current state |

---

## 6. Enforcement Checklist

- [ ] Every POST/PATCH handler supports `Idempotency-Key` header
- [ ] Idempotency keys stored in database with unique constraint
- [ ] Idempotency records expire after 24 hours (cleanup job)
- [ ] Job handlers use database constraints (UPSERT, conditional UPDATE)
- [ ] External service calls use provider idempotency keys when available
- [ ] Balance/counter mutations use transaction IDs to prevent doubles
- [ ] Webhook handlers deduplicate by provider event ID
- [ ] State machine transitions guarded by current state (WHERE status = ?)
- [ ] Already-processed requests return cached response (not re-processed)
- [ ] Idempotency check is atomic (database constraint, not app-level check)
- [ ] `X-Idempotency-Replayed: true` header set on cached responses
- [ ] No non-deterministic operations in idempotent handlers (fixed seeds, timestamps)
