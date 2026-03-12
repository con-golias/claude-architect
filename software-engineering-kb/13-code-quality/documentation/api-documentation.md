# API Documentation

| Attribute     | Value                                                                                   |
|---------------|-----------------------------------------------------------------------------------------|
| Domain        | Code Quality > Documentation                                                            |
| Importance    | High                                                                                    |
| Last Updated  | 2026-03                                                                                 |
| Cross-ref     | [Code Documentation](code-documentation.md), [06-backend/api-design](../../06-backend/api-design/) |

---

## 1. OpenAPI/Swagger Specification (3.1)

OpenAPI 3.1 aligns fully with JSON Schema 2020-12. Define every API surface in a single source of truth.

```yaml
# openapi.yaml
openapi: 3.1.0
info:
  title: Order Service API
  version: 2.4.0
  description: Manages order lifecycle from creation to fulfillment.
  contact:
    name: Platform Team
    email: platform@company.com
  license:
    identifier: Apache-2.0

servers:
  - url: https://api.example.com/v2
    description: Production
  - url: https://staging-api.example.com/v2
    description: Staging

paths:
  /orders:
    post:
      operationId: createOrder
      summary: Create a new order
      description: |
        Submit a new order for processing. The order enters `pending` state
        and triggers inventory reservation. Idempotent when `Idempotency-Key`
        header is provided.
      tags: [Orders]
      security:
        - BearerAuth: []
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
            examples:
              standardOrder:
                summary: Standard domestic order
                value:
                  customerId: "cust_abc123"
                  items:
                    - sku: "WIDGET-001"
                      quantity: 2
                      unitPrice: 29.99
                  shippingAddress:
                    country: "US"
                    zip: "94105"
      responses:
        '201':
          description: Order created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '409':
          description: Duplicate order (idempotency conflict)
        '422':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key

  parameters:
    IdempotencyKey:
      name: Idempotency-Key
      in: header
      required: false
      schema:
        type: string
        format: uuid
      description: Prevents duplicate order creation on retries.

  schemas:
    CreateOrderRequest:
      type: object
      required: [customerId, items]
      properties:
        customerId:
          type: string
          description: Unique customer identifier
          examples: ["cust_abc123"]
```

## 2. Writing Good API Descriptions

Provide clear operation summaries (verb + noun), parameter descriptions with constraints, and realistic response examples. Every field must document its purpose, format, and edge cases.

```yaml
# Good descriptions pattern
paths:
  /users/{userId}/preferences:
    patch:
      summary: Update user preferences
      description: |
        Merge-patch user notification and display preferences.
        Omitted fields retain their current values.
        Changes propagate to active sessions within 30 seconds.
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            pattern: '^usr_[a-zA-Z0-9]{12}$'
          description: >
            User identifier in `usr_` prefixed format.
            Obtain from the authentication token's `sub` claim.
```

## 3. Auto-Generating Docs from Code

### Express + swagger-jsdoc

```typescript
// routes/orders.ts
/**
 * @openapi
 * /orders:
 *   get:
 *     summary: List orders for current user
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, shipped, delivered]
 *     responses:
 *       200:
 *         description: Paginated order list
 */
router.get("/orders", authMiddleware, listOrders);
```

### FastAPI (auto-docs built-in)

```python
from fastapi import FastAPI, Query
from pydantic import BaseModel, Field

app = FastAPI(title="Order Service", version="2.4.0")

class OrderItem(BaseModel):
    sku: str = Field(..., description="Stock keeping unit", examples=["WIDGET-001"])
    quantity: int = Field(..., gt=0, description="Number of units")

@app.post("/orders", status_code=201, summary="Create a new order")
async def create_order(order: CreateOrderRequest) -> Order:
    """Submit a new order. Idempotent with Idempotency-Key header."""
    ...
```

### Go with swaggo

```go
// @Summary Create a new order
// @Description Submit order for processing. Idempotent with Idempotency-Key.
// @Tags Orders
// @Accept json
// @Produce json
// @Param order body CreateOrderRequest true "Order payload"
// @Success 201 {object} Order
// @Failure 422 {object} ProblemDetail
// @Router /orders [post]
func (h *Handler) CreateOrder(w http.ResponseWriter, r *http.Request) {
    // ...
}
```

## 4. Documentation Tools Comparison

| Tool       | Strengths                              | Best For                        |
|------------|----------------------------------------|---------------------------------|
| Swagger UI | Interactive try-it-out, industry standard | Internal dev portals           |
| Redocly    | Beautiful 3-panel layout, search, SEO  | Public-facing API docs          |
| Stoplight  | Visual editor, mock servers, governance | Design-first API workflow       |
| Mintlify   | MDX-based, AI search, versioning       | Developer experience-focused docs |

## 5. AsyncAPI for Event-Driven APIs

```yaml
asyncapi: 3.0.0
info:
  title: Order Events
  version: 1.0.0
channels:
  orderCreated:
    address: orders.created
    messages:
      OrderCreated:
        payload:
          type: object
          properties:
            orderId:
              type: string
            status:
              type: string
              enum: [pending]
            createdAt:
              type: string
              format: date-time
operations:
  publishOrderCreated:
    action: send
    channel:
      $ref: '#/channels/orderCreated'
    summary: Publish when a new order is created
```

## 6. GraphQL Schema Documentation

```graphql
"""
Represents a customer order in the system.
Orders transition through: pending -> confirmed -> shipped -> delivered.
"""
type Order {
  "Unique order identifier (prefixed with `ord_`)"
  id: ID!

  "Current order status"
  status: OrderStatus!

  "Line items in this order"
  items: [OrderItem!]!

  "ISO 8601 creation timestamp"
  createdAt: DateTime!

  "Use `items` field instead — returns flat product list"
  products: [Product!]! @deprecated(reason: "Use `items` field. Removed in v3.")
}
```

## 7. API Changelog and Versioning Docs

```markdown
## API Changelog

### v2.4.0 (2026-03-01)
#### Added
- `PATCH /users/{id}/preferences` — merge-patch user preferences
- `Idempotency-Key` header support on `POST /orders`

#### Deprecated
- `GET /orders?customer=` — use `GET /customers/{id}/orders` instead
  (removal target: v3.0.0, 2026-09-01)

#### Fixed
- `GET /orders` pagination cursor now stable across concurrent writes
```

## 8. Postman/Bruno Collections as Documentation

Store API collections (Postman JSON or Bruno `.bru` files) in the repository alongside OpenAPI specs. Each request includes documentation, example payloads, and test assertions. Export collections to serve as runnable API tutorials for new consumers.

## 9. CI Validation and Spectral Linting

```yaml
# .spectral.yaml
extends: ["spectral:oas", "spectral:asyncapi"]
rules:
  operation-description:
    severity: error
    message: Every operation must have a description.
  oas3-valid-schema-example:
    severity: error
  contact-properties:
    severity: warn
  info-license:
    severity: warn
  paths-kebab-case:
    severity: error
    given: "$.paths[*]~"
    then:
      function: pattern
      functionOptions:
        match: "^\/[a-z0-9\\-\\/{}]+$"
```

```yaml
# .github/workflows/api-docs.yml
name: API Docs Validation
on:
  pull_request:
    paths: ['openapi/**', 'asyncapi/**']

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx @stoplight/spectral-cli lint openapi/openapi.yaml
      - run: npx @redocly/cli lint openapi/openapi.yaml
      - run: |
          # Verify spec matches running server
          npx oasdiff breaking openapi/openapi.yaml \
            https://staging-api.example.com/openapi.json
```

## 10. SDK and Multi-Language Examples

```yaml
# openapi.yaml — x-codeSamples extension
paths:
  /orders:
    post:
      x-codeSamples:
        - lang: TypeScript
          label: Node.js
          source: |
            const order = await client.orders.create({
              customerId: "cust_abc123",
              items: [{ sku: "WIDGET-001", quantity: 2 }],
            });
        - lang: Python
          source: |
            order = client.orders.create(
                customer_id="cust_abc123",
                items=[{"sku": "WIDGET-001", "quantity": 2}],
            )
        - lang: Go
          source: |
            order, err := client.Orders.Create(ctx, &CreateOrderParams{
                CustomerID: "cust_abc123",
                Items: []OrderItem{{SKU: "WIDGET-001", Quantity: 2}},
            })
```

---

## Best Practices

1. **Adopt design-first workflow** — write the OpenAPI spec before implementing endpoints; use it as the contract between frontend and backend teams.
2. **Provide realistic examples for every schema** — use `examples` in OpenAPI 3.1 schemas; never use placeholder values like `"string"` or `0`.
3. **Lint specs in CI** — run Spectral and Redocly CLI on every pull request that touches API definitions.
4. **Document error responses exhaustively** — every endpoint must document 4xx/5xx responses with Problem Detail (RFC 9457) schemas.
5. **Version your API docs alongside the API** — store OpenAPI files in the same repository; tag docs with the same version as the release.
6. **Generate SDKs from the spec** — use openapi-generator or Stainless to produce typed clients; never hand-write SDK code that drifts from the spec.
7. **Include authentication examples** — show complete curl/SDK examples including auth headers, not just the happy-path body.
8. **Detect breaking changes automatically** — run oasdiff or optic in CI to block PRs that introduce unannounced breaking changes.
9. **Maintain a changelog with deprecation timelines** — every deprecation must include the removal target date and migration path.
10. **Provide a sandbox environment** — expose a staging endpoint or mock server where consumers can test without side effects.

---

## Anti-Patterns

| #  | Anti-Pattern                        | Problem                                                    | Fix                                                   |
|----|-------------------------------------|------------------------------------------------------------|-------------------------------------------------------|
| 1  | Spec-less API                       | No machine-readable contract; consumers guess the shape    | Adopt OpenAPI 3.1 as the single source of truth       |
| 2  | Stale examples                      | Code samples show v1 payloads while API is on v3           | Generate examples from tests or contract tests        |
| 3  | Code-first only, no review          | Auto-generated specs contain internal types and leaky abstractions | Review generated specs; use design-first for public APIs |
| 4  | Missing error documentation         | Consumers discover 429/503 responses only in production    | Document every possible error code per endpoint       |
| 5  | Wiki-hosted API docs                | Docs drift from code; no version history                   | Co-locate specs in the repo; deploy docs from CI      |
| 6  | No deprecation policy               | Fields/endpoints removed without notice                    | Add `deprecated` flags with sunset dates and migration guides |
| 7  | Authentication assumed obvious      | Docs skip auth setup; new consumers cannot onboard         | Dedicated auth section with token acquisition flow    |
| 8  | One giant spec file                 | 10,000-line YAML impossible to review                      | Split into `$ref` components; use Redocly bundle      |

---

## Enforcement Checklist

- [ ] OpenAPI 3.1 spec exists for every REST API and is stored in the repository
- [ ] AsyncAPI spec exists for every event-driven API
- [ ] Spectral lint passes with zero errors in CI
- [ ] Every operation has `summary`, `description`, and at least one response example
- [ ] Breaking change detection runs on every PR (oasdiff / optic)
- [ ] SDK generation pipeline produces typed clients from the spec
- [ ] Sandbox / mock server is available for every documented API
- [ ] API changelog is updated with every release
- [ ] Deprecations include removal date and migration guide
- [ ] GraphQL schemas include field-level descriptions and `@deprecated` directives
