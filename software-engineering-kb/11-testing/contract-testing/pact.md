# Pact Framework

| Attribute      | Value                                      |
|----------------|--------------------------------------------|
| Domain         | Testing > Contract Testing                 |
| Importance     | High                                       |
| Last Updated   | 2026-03-10                                 |
| Cross-ref      | `11-testing/contract-testing/api-contract-testing.md` |

---

## Core Concepts

### The Pact Workflow

```
Consumer Test → Pact File (JSON) → Pact Broker → Provider Verification → can-i-deploy → Deploy
```

1. **Consumer test** runs against a Pact mock server and generates a pact file.
2. **Pact file** is published to the Pact Broker with a version and branch tag.
3. **Provider verification** fetches pacts from the broker, replays interactions against the real provider, and publishes results.
4. **can-i-deploy** checks the broker's verification matrix to determine deployment safety.

### Pact Specification Versions

| Version | Key Features |
|---------|-------------|
| v2      | Basic HTTP interactions, regex/type matchers, query strings |
| v3      | Multiple provider states with parameters, generators, improved matchers |
| v4      | Plugin framework, V4 interaction types (sync HTTP, async messages, sync messages), combined pact files |

Use **v4** for all new projects. It is backward-compatible and supports both HTTP and message interactions in a single pact file.

### Matchers and Generators

**Matchers** define flexible expectations for contract verification:
- `like(value)` -- match by type, not exact value
- `eachLike(value)` -- array where each element matches the given structure
- `regex(pattern, example)` -- match against a regular expression
- `integer(example)` -- must be an integer
- `decimal(example)` -- must be a decimal
- `timestamp(format, example)` -- ISO timestamp matching

**Generators** produce dynamic values during provider verification:
- `providerState(expression)` -- inject values from provider state
- `uuid()` -- generate a random UUID
- `date(format)` -- generate a date in the given format

### Message Pact for Async Communication

Message pacts verify contracts for event-driven systems (Kafka, RabbitMQ, SNS). Instead of HTTP request/response, message pacts define the structure of messages that a provider publishes and a consumer expects.

---

## Code Examples

### TypeScript: Full Pact Consumer Test (PactV4) with Matchers

```typescript
// order-service.consumer.pact.test.ts
import { PactV4, MatchersV3 } from "@pact-foundation/pact";
import { resolve } from "path";
import { ProductApiClient } from "../clients/product-api-client";

const { like, eachLike, regex, integer, string, boolean, timestamp } =
  MatchersV3;

const provider = new PactV4({
  consumer: "OrderService",
  provider: "ProductService",
  dir: resolve(process.cwd(), "pacts"),
  logLevel: "warn",
});

describe("ProductService Contract", () => {
  describe("GET /api/products/:id", () => {
    it("returns a product with inventory", async () => {
      await provider
        .addInteraction()
        .given("product SKU-001 exists with stock", {
          sku: "SKU-001",
          stock: 50,
        })
        .uponReceiving("a request for product SKU-001")
        .withRequest("GET", "/api/products/SKU-001", (builder) => {
          builder.headers({
            Accept: "application/json",
            Authorization: regex(/^Bearer .+$/, "Bearer test-token"),
          });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ "Content-Type": "application/json" })
            .jsonBody({
              sku: string("SKU-001"),
              name: string("Widget Pro"),
              price: {
                amount: integer(2999),
                currency: string("USD"),
              },
              inStock: boolean(true),
              categories: eachLike(string("electronics")),
              updatedAt: timestamp(
                "yyyy-MM-dd'T'HH:mm:ss.SSSX",
                "2025-06-01T12:00:00.000Z"
              ),
            });
        })
        .executeTest(async (mockServer) => {
          const client = new ProductApiClient(mockServer.url);
          const product = await client.getProduct("SKU-001");

          expect(product.sku).toBe("SKU-001");
          expect(product.price.amount).toBeGreaterThan(0);
          expect(product.inStock).toBe(true);
        });
    });
  });

  describe("POST /api/products/search", () => {
    it("returns matching products", async () => {
      await provider
        .addInteraction()
        .given("products exist in electronics category")
        .uponReceiving("a product search request")
        .withRequest("POST", "/api/products/search", (builder) => {
          builder
            .headers({ "Content-Type": "application/json" })
            .jsonBody({
              category: string("electronics"),
              minPrice: integer(1000),
              maxPrice: integer(5000),
            });
        })
        .willRespondWith(200, (builder) => {
          builder.jsonBody({
            results: eachLike({
              sku: string("SKU-001"),
              name: string("Widget Pro"),
              price: like({ amount: integer(2999), currency: string("USD") }),
            }),
            total: integer(1),
          });
        })
        .executeTest(async (mockServer) => {
          const client = new ProductApiClient(mockServer.url);
          const results = await client.searchProducts({
            category: "electronics",
            minPrice: 1000,
            maxPrice: 5000,
          });

          expect(results.results.length).toBeGreaterThan(0);
          expect(results.total).toBeGreaterThanOrEqual(1);
        });
    });
  });
});
```

### TypeScript: Pact Provider Verification with State Handlers

```typescript
// product-service.provider.pact.test.ts
import { Verifier } from "@pact-foundation/pact";
import { app } from "../app";
import { seedProduct, clearProducts } from "../test-utils/db-seeder";

describe("ProductService Provider Verification", () => {
  let server: ReturnType<typeof app.listen>;
  const port = 4567;

  beforeAll(() => {
    server = app.listen(port);
  });

  afterAll(() => {
    server.close();
  });

  it("validates all consumer contracts", async () => {
    const verifier = new Verifier({
      providerBaseUrl: `http://localhost:${port}`,
      provider: "ProductService",
      pactBrokerUrl: process.env.PACT_BROKER_URL!,
      pactBrokerToken: process.env.PACT_BROKER_TOKEN,
      publishVerificationResult: process.env.CI === "true",
      providerVersion: process.env.GIT_COMMIT,
      providerVersionBranch: process.env.GIT_BRANCH,
      consumerVersionSelectors: [
        { mainBranch: true },
        { deployedOrReleased: true },
      ],
      enablePending: true,
      stateHandlers: {
        "product SKU-001 exists with stock": async (params) => {
          await clearProducts();
          await seedProduct({
            sku: params?.sku ?? "SKU-001",
            name: "Widget Pro",
            priceAmount: 2999,
            currency: "USD",
            stock: params?.stock ?? 50,
            categories: ["electronics"],
          });
        },
        "products exist in electronics category": async () => {
          await clearProducts();
          await seedProduct({
            sku: "SKU-001",
            name: "Widget Pro",
            priceAmount: 2999,
            currency: "USD",
            stock: 50,
            categories: ["electronics"],
          });
        },
      },
    });

    await verifier.verifyProvider();
  });
});
```

### Go: Pact Consumer and Provider Examples

```go
// product_consumer_test.go
package consumer

import (
	"testing"

	"github.com/pact-foundation/pact-go/v2/consumer"
	"github.com/pact-foundation/pact-go/v2/matchers"
	"github.com/stretchr/testify/assert"
)

func TestProductConsumerPact(t *testing.T) {
	mockProvider, err := consumer.NewV4Pact(consumer.MockHTTPProviderConfig{
		Consumer: "OrderService",
		Provider: "ProductService",
		PactDir:  "./pacts",
	})
	assert.NoError(t, err)

	err = mockProvider.
		AddInteraction().
		Given("product SKU-001 exists").
		UponReceiving("a request for product SKU-001").
		WithRequestPathStringMatcher("GET",
			matchers.Regex("/api/products/SKU-001", `^/api/products/[A-Z]+-\d+$`)).
		WillRespondWith(200, func(b *consumer.V4ResponseBuilder) {
			b.Header("Content-Type", matchers.String("application/json"))
			b.JSONBody(matchers.Map{
				"sku":     matchers.String("SKU-001"),
				"name":    matchers.String("Widget Pro"),
				"inStock": matchers.Boolean(true),
				"price": matchers.Like(matchers.Map{
					"amount":   matchers.Integer(2999),
					"currency": matchers.String("USD"),
				}),
			})
		}).
		ExecuteTest(t, func(config consumer.MockServerConfig) error {
			client := NewProductClient(config.URL())
			product, err := client.GetProduct("SKU-001")
			assert.NoError(t, err)
			assert.Equal(t, "SKU-001", product.SKU)
			assert.True(t, product.InStock)
			return nil
		})

	assert.NoError(t, err)
}
```

```go
// product_provider_test.go
package provider

import (
	"fmt"
	"os"
	"testing"

	"github.com/pact-foundation/pact-go/v2/provider"
)

func TestProductProviderVerification(t *testing.T) {
	verifier := provider.NewVerifier()

	err := verifier.VerifyProvider(t, provider.VerifyRequest{
		ProviderBaseURL:            fmt.Sprintf("http://localhost:%d", testServerPort),
		Provider:                   "ProductService",
		BrokerURL:                  os.Getenv("PACT_BROKER_URL"),
		BrokerToken:                os.Getenv("PACT_BROKER_TOKEN"),
		PublishVerificationResults: os.Getenv("CI") == "true",
		ProviderVersion:            os.Getenv("GIT_COMMIT"),
		ProviderBranch:             os.Getenv("GIT_BRANCH"),
		ConsumerVersionSelectors: []provider.Selector{
			{MainBranch: true},
			{DeployedOrReleased: true},
		},
		EnablePending: true,
		StateHandlers: map[string]provider.StateHandlerFunc{
			"product SKU-001 exists": func(setup bool, s provider.ProviderState) (map[string]interface{}, error) {
				if setup {
					return nil, seedProduct("SKU-001", "Widget Pro", 2999, true)
				}
				return nil, clearProducts()
			},
		},
	})

	if err != nil {
		t.Fatalf("Provider verification failed: %v", err)
	}
}
```

### TypeScript: Message Pact for Kafka Events

```typescript
// order-created.consumer.pact.test.ts
import { PactV4, MatchersV3 } from "@pact-foundation/pact";
import { resolve } from "path";
import { OrderCreatedHandler } from "../handlers/order-created-handler";

const { like, string, integer, uuid, timestamp } = MatchersV3;

const provider = new PactV4({
  consumer: "ShippingService",
  provider: "OrderService",
  dir: resolve(process.cwd(), "pacts"),
});

describe("OrderCreated Message Contract", () => {
  it("processes an OrderCreated event", async () => {
    await provider
      .addAsynchronousInteraction()
      .given("an order has been placed")
      .uponReceiving("an OrderCreated event")
      .withPluginContents("application/json", {
        orderId: uuid("f47ac10b-58cc-4372-a567-0e02b2c3d479"),
        customerId: integer(1001),
        items: [
          like({
            sku: string("SKU-001"),
            quantity: integer(2),
            unitPrice: integer(2999),
          }),
        ],
        totalAmount: integer(5998),
        createdAt: timestamp(
          "yyyy-MM-dd'T'HH:mm:ss.SSSX",
          "2025-06-15T14:30:00.000Z"
        ),
      })
      .executeTest(async (message) => {
        const handler = new OrderCreatedHandler();
        const result = await handler.handle(JSON.parse(message.contents));

        expect(result.shipmentCreated).toBe(true);
      });
  });
});
```

### Pact Broker: Versioning and Can-I-Deploy

```bash
# Publish pacts with version and branch
pact-broker publish ./pacts \
  --consumer-app-version=$(git rev-parse HEAD) \
  --branch=$(git branch --show-current) \
  --broker-base-url=https://broker.example.com \
  --broker-token=$PACT_BROKER_TOKEN

# Record deployment to an environment
pact-broker record-deployment \
  --pacticipant=OrderService \
  --version=$(git rev-parse HEAD) \
  --environment=production

# Check if a version can be deployed
pact-broker can-i-deploy \
  --pacticipant=OrderService \
  --version=$(git rev-parse HEAD) \
  --to-environment=production \
  --retry-while-unknown=12 \
  --retry-interval=10
```

---

## 10 Best Practices

1. **Use PactV4 specification for all new contracts.** V4 supports HTTP and message interactions in one file and enables the plugin framework.
2. **Publish pacts with Git SHA as the version.** This creates a unique, traceable link between code and contract.
3. **Use consumer version selectors instead of tags.** Selectors like `mainBranch` and `deployedOrReleased` are more expressive and less error-prone than manual tags.
4. **Enable pending pacts.** Prevent new consumer contracts from blocking provider builds while the contract stabilizes.
5. **Implement teardown in state handlers.** Always clean up test data in the teardown phase to prevent state leakage between interactions.
6. **Use parameterized provider states.** Pass dynamic values via state parameters instead of hardcoding data in state handler names.
7. **Set up webhooks for automatic provider verification.** Trigger provider builds when new pacts are published to keep the verification matrix current.
8. **Record deployments and releases in the broker.** Use `record-deployment` and `record-release` so `can-i-deploy` checks real environment state.
9. **Run provider verification against both main branch and deployed consumers.** Use `ConsumerVersionSelectors` with `mainBranch: true` and `deployedOrReleased: true`.
10. **Keep message pacts focused on payload structure.** Do not encode transport-specific concerns (topic names, partition keys) in the pact itself.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Using Pact for end-to-end testing | Slow, brittle tests that duplicate integration suites | Restrict Pact to interface shape verification only |
| Hardcoding exact values without matchers | Contracts break on every data change | Use `like`, `eachLike`, `regex`, `integer` matchers |
| Sharing the Pact Broker token in client-side code | Security breach of contract infrastructure | Store tokens in CI secrets; restrict access per team |
| Not implementing provider states | Verification fails unpredictably based on existing data | Write deterministic state handlers for every `given` clause |
| Publishing pacts without a version | Broker cannot track compatibility over time | Always publish with `--consumer-app-version=$(git rev-parse HEAD)` |
| Running provider verification only on demand | Stale verification matrix; `can-i-deploy` returns unknown | Automate via webhooks and scheduled CI runs |
| Including internal implementation details in contracts | Tight coupling between consumer and provider internals | Contract only public API surface: URLs, headers, body shapes |
| Skipping `can-i-deploy` before production releases | Incompatible versions deployed, causing runtime failures | Make `can-i-deploy` a required CI/CD gate |

---

## Enforcement Checklist

- [ ] All consumer teams write and maintain Pact consumer tests
- [ ] Pact files are published to a centralized Pact Broker with Git SHA versions
- [ ] Provider verification runs in CI and publishes results back to the broker
- [ ] `can-i-deploy` is a required gate before every deployment
- [ ] Webhooks trigger provider verification on new pact publication
- [ ] PactV4 specification is used for all new contracts
- [ ] Message pacts exist for every async integration (Kafka, RabbitMQ, SNS)
- [ ] Provider state handlers have both setup and teardown logic
- [ ] Pending pacts are enabled for all provider verification configurations
- [ ] Consumer version selectors use `mainBranch` and `deployedOrReleased`
- [ ] Pact Broker tokens are stored securely in CI/CD secret management
- [ ] Deployments and releases are recorded in the broker with `record-deployment`
