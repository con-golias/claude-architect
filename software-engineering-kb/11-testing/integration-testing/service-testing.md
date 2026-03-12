# Service and Component Testing

| Attribute      | Value                                                    |
|----------------|----------------------------------------------------------|
| Domain         | Testing > Integration Testing                            |
| Importance     | High                                                     |
| Last Updated   | 2026-03-10                                               |
| Cross-ref      | `06-backend/testing/api-testing/endpoint-testing.md`     |

---

## Core Concepts

### Component Testing vs Full Integration Testing

Component testing isolates a single microservice and verifies its behavior with external
dependencies replaced by test doubles. Full integration testing exercises multiple services
together. Both are necessary; component tests provide faster feedback while full integration tests
catch inter-service contract failures.

| Scope               | What Runs Real                | What Is Mocked/Stubbed          |
|----------------------|-------------------------------|---------------------------------|
| Component test       | One service + its database    | External HTTP APIs, queues, caches |
| Service integration  | Two or more services          | External third-party APIs only  |
| End-to-end           | All services                  | Nothing (or only payment gateways) |

### External Dependency Mocking Tools

| Tool        | Language    | Mechanism                              | Best For                         |
|-------------|-------------|----------------------------------------|----------------------------------|
| MSW         | TypeScript  | Intercepts `fetch`/XHR at network level | Browser and Node.js API mocking  |
| WireMock    | JVM / Any   | Standalone HTTP stub server            | Language-agnostic service stubs  |
| MockServer  | JVM / Any   | HTTP/HTTPS expectation-based mock      | Complex multi-step API flows     |
| responses   | Python      | Patches `requests` library             | Synchronous HTTP client mocking  |
| respx       | Python      | Patches `httpx` library                | Async HTTP client mocking        |
| httptest    | Go          | In-process HTTP test server            | Go handler and client testing    |

### Service Boundary Testing

Test contracts at the edges of each service:

- **Incoming contracts** -- Validate that the service correctly handles all documented request formats, including edge cases and malformed input.
- **Outgoing contracts** -- Verify that the service sends correctly formatted requests to its dependencies. Record and replay patterns (consumer-driven contract tests) strengthen this.
- **Error propagation** -- Confirm that downstream errors translate to appropriate upstream error responses (e.g., a 503 from a dependency becomes a 502 or a graceful fallback).

### Testing Message Queue Consumers

Message-driven services require testing the full consumer lifecycle:

1. **Message deserialization** -- Verify that the consumer correctly parses message payloads.
2. **Idempotency** -- Deliver the same message twice and confirm no duplicate side effects.
3. **Error handling** -- Send malformed messages and verify dead-letter queue routing.
4. **Ordering** -- When ordering matters, test that out-of-order messages are handled correctly.

### Docker Compose for Multi-Service Integration

Use `docker-compose.test.yml` to orchestrate multi-service test environments:

- Define service dependencies explicitly with `depends_on` and health checks.
- Use network aliases so services discover each other by name.
- Mount test configuration files that point services at test databases and mock endpoints.
- Tear down the entire stack after the test suite completes.

---

## Code Examples

### TypeScript: MSW for External API Mocking

```typescript
// tests/integration/order-service.test.ts
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import request from "supertest";
import { app } from "../../src/app";
import { db } from "../../src/database";

// Mock the external payment gateway
const paymentServer = setupServer(
  http.post("https://api.payments.example.com/charges", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;

    if (body.amount === 0) {
      return HttpResponse.json(
        { error: { code: "INVALID_AMOUNT" } },
        { status: 400 },
      );
    }

    return HttpResponse.json({
      id: "ch_test_123",
      status: "succeeded",
      amount: body.amount,
      currency: body.currency,
    }, { status: 201 });
  }),

  http.get("https://api.payments.example.com/charges/:id", ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      status: "succeeded",
      amount: 5000,
      currency: "usd",
    });
  }),

  // Catch unhandled requests to external services
  http.all("https://api.payments.example.com/*", () => {
    return HttpResponse.json(
      { error: "Unhandled mock endpoint" },
      { status: 500 },
    );
  }),
);

describe("Order Service - Payment Integration", () => {
  beforeAll(() => paymentServer.listen({ onUnhandledRequest: "error" }));
  afterEach(() => paymentServer.resetHandlers());
  afterAll(() => paymentServer.close());

  beforeEach(async () => {
    await db.raw("TRUNCATE TABLE orders CASCADE");
  });

  it("creates an order and processes payment", async () => {
    const res = await request(app)
      .post("/orders")
      .send({
        items: [{ productId: "prod-1", quantity: 2, price: 2500 }],
        currency: "usd",
      })
      .expect(201);

    expect(res.body.paymentStatus).toBe("succeeded");
    expect(res.body.paymentId).toBe("ch_test_123");
    expect(res.body.totalAmount).toBe(5000);
  });

  it("handles payment gateway failure gracefully", async () => {
    // Override the default handler for this test
    paymentServer.use(
      http.post("https://api.payments.example.com/charges", () => {
        return HttpResponse.json(
          { error: { code: "GATEWAY_TIMEOUT" } },
          { status: 504 },
        );
      }),
    );

    const res = await request(app)
      .post("/orders")
      .send({
        items: [{ productId: "prod-1", quantity: 1, price: 1000 }],
        currency: "usd",
      })
      .expect(502);

    expect(res.body.error.code).toBe("PAYMENT_FAILED");
  });

  it("handles payment validation error", async () => {
    const res = await request(app)
      .post("/orders")
      .send({
        items: [{ productId: "prod-1", quantity: 1, price: 0 }],
        currency: "usd",
      })
      .expect(400);

    expect(res.body.error.code).toBe("INVALID_PAYMENT");
  });
});
```

### Go: httptest Server as Mock Dependency

```go
// service/order_service_test.go
package service_test

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "myapp/service"
    "myapp/testutil"
)

func TestOrderService_CreateOrder(t *testing.T) {
    db := testutil.SetupTestDB(t)

    // Create a mock payment gateway
    paymentMock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        switch {
        case r.Method == http.MethodPost && r.URL.Path == "/charges":
            var body map[string]interface{}
            json.NewDecoder(r.Body).Decode(&body)

            if body["amount"].(float64) <= 0 {
                w.WriteHeader(http.StatusBadRequest)
                json.NewEncoder(w).Encode(map[string]interface{}{
                    "error": map[string]string{"code": "INVALID_AMOUNT"},
                })
                return
            }

            w.WriteHeader(http.StatusCreated)
            json.NewEncoder(w).Encode(map[string]interface{}{
                "id":     "ch_mock_123",
                "status": "succeeded",
                "amount": body["amount"],
            })

        default:
            w.WriteHeader(http.StatusNotFound)
        }
    }))
    defer paymentMock.Close()

    // Inject mock URL into service configuration
    orderSvc := service.NewOrderService(db, service.Config{
        PaymentAPIURL: paymentMock.URL,
    })

    t.Run("creates order with successful payment", func(t *testing.T) {
        tx := testutil.BeginTx(t, db)
        defer tx.Rollback(t)

        order, err := orderSvc.CreateOrder(t.Context(), service.CreateOrderInput{
            Items: []service.OrderItem{
                {ProductID: "prod-1", Quantity: 2, Price: 2500},
            },
            Currency: "usd",
        })

        require.NoError(t, err)
        assert.Equal(t, "succeeded", order.PaymentStatus)
        assert.Equal(t, int64(5000), order.TotalAmount)
    })

    t.Run("returns error when payment fails", func(t *testing.T) {
        tx := testutil.BeginTx(t, db)
        defer tx.Rollback(t)

        _, err := orderSvc.CreateOrder(t.Context(), service.CreateOrderInput{
            Items: []service.OrderItem{
                {ProductID: "prod-1", Quantity: 1, Price: 0},
            },
            Currency: "usd",
        })

        require.Error(t, err)
        assert.Contains(t, err.Error(), "payment failed")
    })
}

func TestOrderService_PaymentGatewayDown(t *testing.T) {
    db := testutil.SetupTestDB(t)

    // Simulate a completely unreachable payment service
    orderSvc := service.NewOrderService(db, service.Config{
        PaymentAPIURL: "http://127.0.0.1:1", // connection refused
    })

    _, err := orderSvc.CreateOrder(t.Context(), service.CreateOrderInput{
        Items: []service.OrderItem{
            {ProductID: "prod-1", Quantity: 1, Price: 1000},
        },
        Currency: "usd",
    })

    require.Error(t, err)
    assert.Contains(t, err.Error(), "connection refused")
}
```

### Python: respx for Async HTTP Mocking

```python
# tests/integration/test_order_service.py
import pytest
import respx
from httpx import Response

from app.services.order_service import OrderService
from app.config import settings


@pytest.fixture
def payment_mock():
    with respx.mock(base_url=settings.PAYMENT_API_URL) as mock:
        # Default: successful charge
        mock.post("/charges").mock(return_value=Response(
            201,
            json={
                "id": "ch_mock_456",
                "status": "succeeded",
                "amount": 5000,
                "currency": "usd",
            },
        ))
        mock.get("/charges/ch_mock_456").mock(return_value=Response(
            200,
            json={"id": "ch_mock_456", "status": "succeeded"},
        ))
        yield mock


@pytest.fixture
def order_service(session):
    return OrderService(session=session)


@pytest.mark.asyncio
class TestOrderService:
    async def test_create_order_with_payment(self, order_service, payment_mock):
        order = await order_service.create_order(
            items=[{"product_id": "prod-1", "quantity": 2, "price": 2500}],
            currency="usd",
        )

        assert order.payment_status == "succeeded"
        assert order.payment_id == "ch_mock_456"
        assert order.total_amount == 5000
        assert payment_mock["post"].called

    async def test_payment_gateway_500_returns_error(self, order_service):
        with respx.mock(base_url=settings.PAYMENT_API_URL) as mock:
            mock.post("/charges").mock(return_value=Response(
                500, json={"error": "internal_error"},
            ))

            with pytest.raises(Exception, match="payment.*failed"):
                await order_service.create_order(
                    items=[{"product_id": "prod-1", "quantity": 1, "price": 1000}],
                    currency="usd",
                )

    async def test_payment_timeout_handled_gracefully(self, order_service):
        with respx.mock(base_url=settings.PAYMENT_API_URL) as mock:
            mock.post("/charges").mock(side_effect=TimeoutError("read timed out"))

            with pytest.raises(Exception, match="timeout"):
                await order_service.create_order(
                    items=[{"product_id": "prod-1", "quantity": 1, "price": 1000}],
                    currency="usd",
                )
```

### Docker Compose Multi-Service Integration Test

```yaml
# docker-compose.test.yml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: test_db
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test -d test_db"]
      interval: 2s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 5s
      retries: 10

  order-service:
    build:
      context: ./services/order
      dockerfile: Dockerfile.test
    environment:
      DATABASE_URL: postgres://test:test@postgres:5432/test_db
      REDIS_URL: redis://redis:6379
      PAYMENT_API_URL: http://payment-mock:8080
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      payment-mock:
        condition: service_started

  payment-mock:
    image: wiremock/wiremock:3.3.1
    volumes:
      - ./tests/wiremock:/home/wiremock
    ports:
      - "8080:8080"

  test-runner:
    build:
      context: .
      dockerfile: Dockerfile.test-runner
    environment:
      ORDER_SERVICE_URL: http://order-service:3000
    depends_on:
      order-service:
        condition: service_started
    command: ["npm", "run", "test:integration"]
```

---

## 10 Best Practices

1. **Mock at the network boundary, not at the code level** -- Use tools like MSW, httptest, and respx that intercept HTTP traffic rather than replacing internal modules. This tests serialization, headers, and error handling.
2. **Fail tests on unhandled external requests** -- Configure mocking libraries to throw on unexpected outbound requests. This prevents tests from silently hitting real external services.
3. **Test dependency failure modes explicitly** -- Simulate 500s, timeouts, connection refused, and malformed responses from every external dependency. Verify graceful degradation.
4. **Use per-test handler overrides for error scenarios** -- Define happy-path mocks as defaults and override them in specific tests for failure cases. Reset handlers between tests.
5. **Test idempotency of message consumers** -- Deliver every message type at least twice and verify that duplicate processing does not corrupt state.
6. **Define service contracts as machine-readable schemas** -- Use OpenAPI, Protobuf, or AsyncAPI to define service boundaries. Generate test stubs from these schemas.
7. **Isolate component tests from full integration tests** -- Run component tests (one service + mocks) in the fast feedback loop. Reserve multi-service Docker Compose tests for CI.
8. **Pin mock response payloads to real API versions** -- When mocking external APIs, keep response fixtures synchronized with the actual API version the service depends on.
9. **Use health checks in Docker Compose** -- Never use `sleep` or fixed delays to wait for services. Use Docker health checks with `depends_on: condition: service_healthy`.
10. **Test circuit breaker and retry behavior** -- Verify that transient failures trigger retries, and sustained failures trip circuit breakers with correct fallback behavior.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Mocking at the import/module level instead of the network level | Bypasses serialization, headers, and middleware; misses real integration bugs | Use network-level mocking (MSW, httptest, respx) |
| Allowing tests to hit real external services | Flaky tests, rate limiting, cost, data mutation in external systems | Block all outbound traffic and use mock servers |
| Hardcoding mock server ports | Port conflicts in CI, parallel test failures | Use dynamic port allocation (port 0) or in-process mocking |
| Testing only the happy path of external calls | Timeout, 5xx, and malformed response bugs ship to production | Write dedicated tests for every failure mode |
| Using `sleep()` to wait for async service startup | Slow, flaky, wastes CI minutes | Use health check polling with exponential backoff |
| Sharing mock state across test cases | Order-dependent tests, non-deterministic failures | Reset mock handlers and state in `beforeEach`/test setup |
| Skipping dead-letter queue testing for consumers | Poison messages crash consumers in production | Send malformed messages and verify DLQ routing |
| Running multi-service tests in the fast feedback loop | Slow developer experience, tests get skipped | Separate component tests (fast) from integration tests (CI) |

---

## Enforcement Checklist

- [ ] Every external HTTP dependency has a corresponding mock configuration
- [ ] Mock libraries are configured to reject unhandled outbound requests
- [ ] Failure modes tested: 4xx, 5xx, timeout, connection refused, malformed response
- [ ] Message consumers are tested for idempotency (duplicate message delivery)
- [ ] Dead-letter queue routing is verified for malformed and unprocessable messages
- [ ] Docker Compose test environment uses health checks, not sleep delays
- [ ] Component tests run in under 30 seconds; multi-service tests run in CI only
- [ ] Service contracts are defined in machine-readable schemas (OpenAPI, Protobuf, AsyncAPI)
- [ ] Mock response payloads are versioned and updated when external APIs change
- [ ] Circuit breaker and retry logic have dedicated test cases
- [ ] All test mocks are reset between test cases to prevent state leakage
- [ ] CI pipeline runs both component tests and full integration tests
