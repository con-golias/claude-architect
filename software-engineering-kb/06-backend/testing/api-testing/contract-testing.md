# Contract Testing & API Compatibility

> **Domain:** Backend > Testing
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

In microservice architectures, each service is both a producer AND consumer of APIs. When the producer changes its response format, the consumer breaks -- but this only becomes apparent after you deploy. Contract testing solves this: the consumer defines what it expects (contract), the producer verifies that it fulfills the contract. If the producer breaks a contract, CI fails BEFORE the deploy. Companies like Atlassian and Spotify use contract testing as a gatekeeper for every deployment.

---

## How It Works

### Contract Testing Flow

```
┌──────────────┐                     ┌──────────────┐
│   Consumer   │                     │   Producer   │
│   Service    │                     │   Service    │
└──────┬───────┘                     └──────┬───────┘
       │                                    │
       │  1. Consumer writes                │
       │     contract (expectations)        │
       │                                    │
       ▼                                    │
┌──────────────┐                            │
│   Contract   │   2. Contract published    │
│   Broker     │◄───────────────────────────│
│   (Pact/     │                            │
│    Pactflow) │   3. Producer verifies     │
│              │──────────────────────────▶ │
└──────────────┘                            ▼
                                    ┌──────────────┐
                                    │  Verification │
                                    │  Pass / Fail  │
                                    └──────────────┘
```

### Consumer-Driven Contract Testing (Pact)

```typescript
// TypeScript — Consumer Side (Pact)
import { PactV3, MatchersV3 } from "@pact-foundation/pact";
import { describe, it, expect } from "vitest";
import { OrderClient } from "./order-client";

const { like, eachLike, string, integer, iso8601DateTimeWithMillis } =
  MatchersV3;

const provider = new PactV3({
  consumer: "PaymentService",
  provider: "OrderService",
  dir: "./pacts",
});

describe("OrderService API contract", () => {
  it("should return order by ID", async () => {
    // Define expected interaction
    provider
      .given("an order with ID ord_123 exists")
      .uponReceiving("a request to get order ord_123")
      .withRequest({
        method: "GET",
        path: "/api/v1/orders/ord_123",
        headers: {
          Authorization: "Bearer valid-token",
          Accept: "application/json",
        },
      })
      .willRespondWith({
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: like({
          id: string("ord_123"),
          status: string("completed"),
          total: integer(5000),
          currency: string("EUR"),
          items: eachLike({
            product_id: string("prod_1"),
            quantity: integer(2),
            price: integer(2500),
          }),
          created_at: iso8601DateTimeWithMillis(
            "2024-03-15T10:30:00.000Z"
          ),
        }),
      });

    // Execute test against mock provider
    await provider.executeTest(async (mockService) => {
      const client = new OrderClient({
        baseUrl: mockService.url,
        token: "valid-token",
      });

      const order = await client.getOrder("ord_123");

      expect(order.id).toBe("ord_123");
      expect(order.status).toBe("completed");
      expect(order.total).toBe(5000);
      expect(order.items).toHaveLength(1);
    });
  });

  it("should return 404 for non-existent order", async () => {
    provider
      .given("no order with ID ord_999 exists")
      .uponReceiving("a request to get non-existent order")
      .withRequest({
        method: "GET",
        path: "/api/v1/orders/ord_999",
        headers: {
          Authorization: "Bearer valid-token",
        },
      })
      .willRespondWith({
        status: 404,
        body: like({
          error: string("Order not found"),
        }),
      });

    await provider.executeTest(async (mockService) => {
      const client = new OrderClient({
        baseUrl: mockService.url,
        token: "valid-token",
      });

      await expect(client.getOrder("ord_999")).rejects.toThrow(
        "Order not found"
      );
    });
  });

  it("should create order with items", async () => {
    provider
      .given("products exist")
      .uponReceiving("a request to create an order")
      .withRequest({
        method: "POST",
        path: "/api/v1/orders",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: {
          items: [
            { product_id: "prod_1", quantity: 2 },
          ],
        },
      })
      .willRespondWith({
        status: 201,
        headers: {
          "Content-Type": "application/json",
        },
        body: like({
          id: string("ord_new"),
          status: string("pending"),
          items: eachLike({
            product_id: string("prod_1"),
            quantity: integer(2),
          }),
        }),
      });

    await provider.executeTest(async (mockService) => {
      const client = new OrderClient({
        baseUrl: mockService.url,
        token: "valid-token",
      });

      const order = await client.createOrder({
        items: [{ product_id: "prod_1", quantity: 2 }],
      });

      expect(order.id).toBeDefined();
      expect(order.status).toBe("pending");
    });
  });
});
```

```typescript
// TypeScript — Provider Side (Verification)
import { Verifier } from "@pact-foundation/pact";
import { describe, it, beforeAll, afterAll } from "vitest";
import { createApp } from "./app";
import { seedTestData } from "./test-helpers";

describe("OrderService provider verification", () => {
  let app: any;
  let server: any;

  beforeAll(async () => {
    app = await createApp({ database: testDb });
    server = app.listen(0); // Random port
  });

  afterAll(() => {
    server.close();
  });

  it("should satisfy PaymentService contract", async () => {
    const verifier = new Verifier({
      providerBaseUrl: `http://localhost:${server.address().port}`,
      provider: "OrderService",

      // Load contracts from broker
      pactBrokerUrl: "https://pact-broker.example.com",
      pactBrokerToken: process.env.PACT_BROKER_TOKEN,

      // Or load from local files
      // pactUrls: ["./pacts/PaymentService-OrderService.json"],

      // Provider states — setup test data for each "given"
      stateHandlers: {
        "an order with ID ord_123 exists": async () => {
          await seedTestData({
            orders: [
              {
                id: "ord_123",
                status: "completed",
                total: 5000,
                currency: "EUR",
                items: [
                  { product_id: "prod_1", quantity: 2, price: 2500 },
                ],
              },
            ],
          });
        },
        "no order with ID ord_999 exists": async () => {
          // Clean state — no seeding needed
          await cleanTestData();
        },
        "products exist": async () => {
          await seedTestData({
            products: [{ id: "prod_1", name: "Widget", price: 2500 }],
          });
        },
      },

      // Request filter — add auth token for provider
      requestFilter: (req) => {
        req.headers["Authorization"] = "Bearer valid-token";
        return req;
      },

      publishVerificationResult: process.env.CI === "true",
      consumerVersionSelectors: [
        { mainBranch: true },
        { deployedOrReleased: true },
      ],
    });

    await verifier.verifyProvider();
  });
});
```

### Go — Pact Provider Verification

```go
// Go — Provider Verification
package contract_test

import (
    "fmt"
    "net/http"
    "testing"

    "github.com/pact-foundation/pact-go/v2/provider"

    "myapp/handler"
    "myapp/testutil"
)

func TestOrderServicePactVerification(t *testing.T) {
    // Start the provider
    router := handler.NewRouter(handler.Config{
        Database: testutil.SetupTestDB(t),
    })
    server := &http.Server{Handler: router}
    go server.ListenAndServe()
    defer server.Close()

    verifier := provider.NewVerifier()

    err := verifier.VerifyProvider(t, provider.VerifyRequest{
        ProviderBaseURL: "http://localhost:8080",
        Provider:        "OrderService",
        BrokerURL:       "https://pact-broker.example.com",
        BrokerToken:     testutil.GetPactBrokerToken(),

        // State handlers
        StateHandlers: provider.StateHandlers{
            "an order with ID ord_123 exists": func(setup bool, state provider.ProviderState) (provider.ProviderStateResponse, error) {
                if setup {
                    testutil.SeedOrder(t, "ord_123", "completed")
                } else {
                    testutil.CleanOrders(t)
                }
                return nil, nil
            },
            "no order with ID ord_999 exists": func(setup bool, _ provider.ProviderState) (provider.ProviderStateResponse, error) {
                if setup {
                    testutil.CleanOrders(t)
                }
                return nil, nil
            },
        },

        PublishVerificationResults: true,
        ProviderVersion:           testutil.GitSHA(),
    })

    if err != nil {
        t.Fatalf("pact verification failed: %v", err)
    }
}
```

---

## Schema Validation Testing

### JSON Schema Validation

```typescript
// TypeScript — Validate API responses against JSON Schema
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const orderSchema = {
  type: "object",
  required: ["id", "status", "total", "currency", "items", "created_at"],
  properties: {
    id: { type: "string", pattern: "^ord_" },
    status: {
      type: "string",
      enum: ["pending", "confirmed", "completed", "cancelled"],
    },
    total: { type: "integer", minimum: 0 },
    currency: { type: "string", pattern: "^[A-Z]{3}$" },
    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["product_id", "quantity", "price"],
        properties: {
          product_id: { type: "string" },
          quantity: { type: "integer", minimum: 1 },
          price: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
    },
    created_at: { type: "string", format: "date-time" },
  },
  additionalProperties: false,
};

const validateOrder = ajv.compile(orderSchema);

describe("Order API schema compliance", () => {
  it("GET /orders/:id response matches schema", async () => {
    const response = await request(app)
      .get("/api/v1/orders/ord_123")
      .set("Authorization", `Bearer ${token}`);

    const valid = validateOrder(response.body);
    if (!valid) {
      console.error("Schema errors:", validateOrder.errors);
    }
    expect(valid).toBe(true);
  });

  it("GET /orders list response matches schema", async () => {
    const response = await request(app)
      .get("/api/v1/orders")
      .set("Authorization", `Bearer ${token}`);

    const listSchema = {
      type: "object",
      required: ["data", "meta"],
      properties: {
        data: {
          type: "array",
          items: orderSchema,
        },
        meta: {
          type: "object",
          required: ["total", "page", "per_page"],
          properties: {
            total: { type: "integer", minimum: 0 },
            page: { type: "integer", minimum: 1 },
            per_page: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
      },
    };

    const validate = ajv.compile(listSchema);
    expect(validate(response.body)).toBe(true);
  });
});
```

---

## Backward Compatibility Testing

```typescript
// TypeScript — Snapshot-based API compatibility
describe("API backward compatibility", () => {
  it("GET /orders/:id response should not remove fields", async () => {
    const response = await request(app)
      .get("/api/v1/orders/ord_123")
      .set("Authorization", `Bearer ${token}`);

    // These fields MUST always be present (never removed)
    const requiredFields = [
      "id",
      "status",
      "total",
      "currency",
      "items",
      "created_at",
    ];

    requiredFields.forEach((field) => {
      expect(response.body).toHaveProperty(field);
    });

    // Snapshot test — detect any structural changes
    expect(Object.keys(response.body).sort()).toMatchSnapshot();
  });

  // Verify deprecated fields still work
  it("should still accept deprecated 'amount' field as alias for 'total'", async () => {
    const response = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productId: "prod_1", quantity: 1 }],
        amount: 1000, // Deprecated, should still work
      });

    expect(response.status).toBe(201);
  });
});
```

### OpenAPI Spec Validation

```typescript
// TypeScript — Validate responses against OpenAPI spec
import SwaggerParser from "@apidevtools/swagger-parser";
import { OpenAPIResponseValidator } from "openapi-response-validator";

describe("OpenAPI compliance", () => {
  let spec: any;

  beforeAll(async () => {
    spec = await SwaggerParser.validate("./openapi.yaml");
  });

  it("GET /orders/:id matches OpenAPI spec", async () => {
    const response = await request(app)
      .get("/api/v1/orders/ord_123")
      .set("Authorization", `Bearer ${token}`);

    const validator = new OpenAPIResponseValidator({
      responses: spec.paths["/api/v1/orders/{id}"].get.responses,
      definitions: spec.definitions,
    });

    const errors = validator.validateResponse(
      response.status,
      response.body
    );

    expect(errors).toBeUndefined();
  });
});
```

---

## Event Contract Testing

### Messaging Contracts (Pact for Messages)

```typescript
// TypeScript — Message Consumer Contract
import { MessageConsumerPact, MatchersV3 } from "@pact-foundation/pact";

const messagePact = new MessageConsumerPact({
  consumer: "NotificationService",
  provider: "OrderService",
  dir: "./pacts",
});

describe("OrderService message contracts", () => {
  it("should handle order.completed event", async () => {
    await messagePact
      .expectsToReceive("an order completed event")
      .withContent(
        MatchersV3.like({
          id: MatchersV3.string("evt_123"),
          type: "order.completed",
          data: {
            order_id: MatchersV3.string("ord_123"),
            customer_id: MatchersV3.string("cust_456"),
            total: MatchersV3.integer(5000),
          },
        })
      )
      .withMetadata({ "content-type": "application/json" })
      .verify(async (message) => {
        // Consumer processes the message
        const event = JSON.parse(message.contents.toString());
        const result = await notificationHandler.handleOrderCompleted(event);

        expect(result.notificationSent).toBe(true);
      });
  });
});
```

---

## CI/CD Integration

```yaml
# GitHub Actions — Contract Testing Pipeline
name: Contract Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  consumer-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:contract:consumer
      - name: Publish pacts to broker
        if: github.ref == 'refs/heads/main'
        run: npx pact-broker publish ./pacts
          --consumer-app-version=${{ github.sha }}
          --broker-base-url=${{ secrets.PACT_BROKER_URL }}
          --broker-token=${{ secrets.PACT_BROKER_TOKEN }}

  provider-verification:
    runs-on: ubuntu-latest
    needs: consumer-tests
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:contract:provider
        env:
          PACT_BROKER_URL: ${{ secrets.PACT_BROKER_URL }}
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}

  can-i-deploy:
    runs-on: ubuntu-latest
    needs: [consumer-tests, provider-verification]
    steps:
      - name: Check deployment safety
        run: npx pact-broker can-i-deploy
          --pacticipant OrderService
          --version ${{ github.sha }}
          --to-environment production
          --broker-base-url=${{ secrets.PACT_BROKER_URL }}
          --broker-token=${{ secrets.PACT_BROKER_TOKEN }}
```

---

## Best Practices

1. **ALWAYS write contracts from consumer perspective** — consumer knows what it needs
2. **ALWAYS use matchers, not exact values** — `like()`, `eachLike()`, not literals
3. **ALWAYS set up provider states** — seed data to match "given" clauses
4. **ALWAYS run contract tests in CI** — gate deployments on verification
5. **ALWAYS use `can-i-deploy`** — automated deployment safety check
6. **ALWAYS version contracts** — tie to git SHA for traceability
7. **NEVER over-specify contracts** — only assert fields the consumer actually uses
8. **NEVER share databases between contract tests** — isolated test data per state
9. **NEVER skip provider verification** — unverified contracts = false confidence
10. **NEVER test business logic in contracts** — contracts test interface structure only

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| Over-specified contracts | Tests break on non-breaking changes | Use matchers, test only fields you use |
| No provider states | Provider can't satisfy contract scenarios | Implement stateHandlers for each "given" |
| Consumer tests exact values | Brittle, fail on any data change | Use Pact matchers (like, regex, etc.) |
| No CI integration | Contracts drift from reality | Run in pipeline, gate deployments |
| Testing business logic in contracts | Slow, out of scope | Contracts = structure only |
| No pact broker | Manual contract sharing | Centralized broker (Pactflow, self-hosted) |
| Skipping can-i-deploy | Deploy breaks despite passing contracts | Always run before deploy |
| Single giant contract file | Hard to maintain | Split by resource/capability |

---

## Real-world Examples

### Atlassian
- 500+ microservices using Pact
- Pactflow as centralized broker
- `can-i-deploy` gates every production deployment
- Reduced integration test failures by 80%

### Spotify
- Consumer-driven contracts for 100+ backend services
- Automated contract generation from TypeScript types
- Event contracts for Kafka message schemas
- Monthly contract compliance reports

### ING Bank
- Contract testing for all inter-service APIs
- Combined with schema validation (OpenAPI)
- Regulatory compliance: contracts as documentation
- Zero breaking changes in production for 2+ years
