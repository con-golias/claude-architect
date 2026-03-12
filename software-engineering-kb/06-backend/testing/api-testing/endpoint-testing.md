# API Endpoint Testing

> **Domain:** Backend > Testing
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

API endpoint testing tests the full request-response cycle: routing, middleware, validation, authentication, business logic, serialization. It is the most reliable form of testing for backend -- if an endpoint test passes, the consumer can trust that the API works. Unit tests catch logic bugs, but endpoint tests catch integration bugs: wrong status codes, missing headers, broken serialization, auth bypasses. Every endpoint should have tests for happy path, validation errors, auth errors, and edge cases.

---

## How It Works

### Test Layers

```
┌──────────────────────────────────────────┐
│             Endpoint Test                │
│                                          │
│  HTTP Request → Full Middleware Stack →   │
│  Router → Controller → Service (mocked)  │
│  → Response                              │
│                                          │
│  Tests: routing, status codes, headers,  │
│  validation, auth, serialization         │
└──────────────────────────────────────────┘
```

### TypeScript — Supertest (Express) & Fastify Inject

```typescript
// TypeScript — Express with Supertest
import request from "supertest";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createApp } from "./app";
import { generateTestToken } from "./test-helpers";

describe("POST /api/v1/orders", () => {
  let app: Express.Application;
  let authToken: string;

  beforeAll(async () => {
    app = await createApp({
      database: testDatabase,
      cache: testCache,
    });
    authToken = generateTestToken({ userId: "user_123", role: "customer" });
  });

  describe("Authentication", () => {
    it("should return 401 without auth token", async () => {
      const response = await request(app)
        .post("/api/v1/orders")
        .send({ items: [{ productId: "prod_1", quantity: 1 }] });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Authentication required");
    });

    it("should return 401 with expired token", async () => {
      const expiredToken = generateTestToken({
        userId: "user_123",
        expiresIn: -3600, // Expired 1h ago
      });

      const response = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${expiredToken}`)
        .send({ items: [{ productId: "prod_1", quantity: 1 }] });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Token expired");
    });

    it("should return 403 for insufficient role", async () => {
      const guestToken = generateTestToken({
        userId: "guest_1",
        role: "guest",
      });

      const response = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ items: [{ productId: "prod_1", quantity: 1 }] });

      expect(response.status).toBe(403);
    });
  });

  describe("Validation", () => {
    it("should return 400 for empty items array", async () => {
      const response = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ items: [] });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "items",
            message: expect.stringContaining("at least 1"),
          }),
        ])
      );
    });

    it("should return 400 for negative quantity", async () => {
      const response = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          items: [{ productId: "prod_1", quantity: -1 }],
        });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].field).toBe("items.0.quantity");
    });

    it("should return 400 for missing required fields", async () => {
      const response = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({}); // No items field

      expect(response.status).toBe(400);
    });

    it("should strip unknown fields", async () => {
      const response = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          items: [{ productId: "prod_1", quantity: 1 }],
          _malicious: "DROP TABLE orders", // Unknown field
        });

      // Should succeed — unknown fields stripped
      expect(response.status).toBe(201);
    });
  });

  describe("Success", () => {
    it("should create order and return 201", async () => {
      const response = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          items: [
            { productId: "prod_1", quantity: 2 },
            { productId: "prod_2", quantity: 1 },
          ],
          shippingAddress: {
            street: "123 Main St",
            city: "Athens",
            country: "GR",
          },
        });

      expect(response.status).toBe(201);
      expect(response.headers["content-type"]).toMatch(/json/);
      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.stringMatching(/^ord_/),
          status: "pending",
          items: expect.arrayContaining([
            expect.objectContaining({
              productId: "prod_1",
              quantity: 2,
            }),
          ]),
          createdAt: expect.any(String),
        })
      );

      // Verify Location header
      expect(response.headers["location"]).toMatch(
        /\/api\/v1\/orders\/ord_/
      );
    });
  });

  describe("Error handling", () => {
    it("should return 404 for non-existent product", async () => {
      const response = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          items: [{ productId: "prod_nonexistent", quantity: 1 }],
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("Product not found");
    });

    it("should return 409 for insufficient stock", async () => {
      const response = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          items: [{ productId: "prod_1", quantity: 99999 }],
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain("Insufficient stock");
    });

    it("should return 500 errors without leaking internals", async () => {
      // Force internal error (e.g., DB down)
      mockDatabase.simulateError("connection refused");

      const response = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          items: [{ productId: "prod_1", quantity: 1 }],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Internal server error");
      // NEVER leak stack traces, SQL queries, etc.
      expect(response.body).not.toHaveProperty("stack");
      expect(JSON.stringify(response.body)).not.toMatch(/SELECT|INSERT|postgres/i);
    });
  });
});
```

```typescript
// TypeScript — Fastify inject (no HTTP overhead)
import Fastify from "fastify";
import { describe, it, expect, beforeAll } from "vitest";
import { orderRoutes } from "./routes/orders";

describe("GET /api/v1/orders/:id", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();
    app.register(orderRoutes, { prefix: "/api/v1" });
    await app.ready(); // No listen() needed!
  });

  it("should return order by ID", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/orders/ord_123",
      headers: {
        authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBe("ord_123");
  });

  it("should return 404 for non-existent order", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/orders/ord_nonexistent",
      headers: { authorization: `Bearer ${testToken}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
```

### Go — httptest

```go
// Go — httptest for Gin/Chi/stdlib
package handler_test

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "myapp/handler"
    "myapp/middleware"
    "myapp/testutil"
)

func setupRouter() http.Handler {
    router := handler.NewRouter(handler.Config{
        OrderService: mockOrderService,
        AuthService:  testutil.NewTestAuthService(),
    })
    return router
}

func TestCreateOrder_Success(t *testing.T) {
    router := setupRouter()

    body := map[string]interface{}{
        "items": []map[string]interface{}{
            {"product_id": "prod_1", "quantity": 2},
        },
    }
    jsonBody, _ := json.Marshal(body)

    req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewReader(jsonBody))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+testutil.GenerateToken("user_123"))

    rec := httptest.NewRecorder()
    router.ServeHTTP(rec, req)

    if rec.Code != http.StatusCreated {
        t.Errorf("status = %d, want 201", rec.Code)
    }

    var resp map[string]interface{}
    json.NewDecoder(rec.Body).Decode(&resp)

    if resp["status"] != "pending" {
        t.Errorf("status = %v, want pending", resp["status"])
    }

    location := rec.Header().Get("Location")
    if location == "" {
        t.Error("missing Location header")
    }
}

func TestCreateOrder_Unauthorized(t *testing.T) {
    router := setupRouter()

    body := []byte(`{"items":[{"product_id":"prod_1","quantity":1}]}`)
    req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    // No Authorization header

    rec := httptest.NewRecorder()
    router.ServeHTTP(rec, req)

    if rec.Code != http.StatusUnauthorized {
        t.Errorf("status = %d, want 401", rec.Code)
    }
}

func TestCreateOrder_ValidationErrors(t *testing.T) {
    tests := []struct {
        name       string
        body       string
        wantStatus int
        wantError  string
    }{
        {
            name:       "empty items",
            body:       `{"items":[]}`,
            wantStatus: 400,
            wantError:  "at least 1 item",
        },
        {
            name:       "negative quantity",
            body:       `{"items":[{"product_id":"prod_1","quantity":-1}]}`,
            wantStatus: 400,
            wantError:  "quantity",
        },
        {
            name:       "missing items field",
            body:       `{}`,
            wantStatus: 400,
            wantError:  "items",
        },
        {
            name:       "invalid JSON",
            body:       `{invalid`,
            wantStatus: 400,
            wantError:  "invalid",
        },
    }

    router := setupRouter()
    token := testutil.GenerateToken("user_123")

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            req := httptest.NewRequest(http.MethodPost, "/api/v1/orders",
                bytes.NewReader([]byte(tt.body)))
            req.Header.Set("Content-Type", "application/json")
            req.Header.Set("Authorization", "Bearer "+token)

            rec := httptest.NewRecorder()
            router.ServeHTTP(rec, req)

            if rec.Code != tt.wantStatus {
                t.Errorf("status = %d, want %d", rec.Code, tt.wantStatus)
            }
        })
    }
}
```

### Python — httpx (FastAPI) & APITestCase (Django)

```python
# Python — FastAPI TestClient (httpx-based)
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.auth import create_test_token

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

@pytest.fixture
def auth_headers():
    token = create_test_token(user_id="user_123", role="customer")
    return {"Authorization": f"Bearer {token}"}

class TestCreateOrder:
    async def test_creates_order_returns_201(self, client, auth_headers):
        response = await client.post(
            "/api/v1/orders",
            json={
                "items": [
                    {"product_id": "prod_1", "quantity": 2},
                    {"product_id": "prod_2", "quantity": 1},
                ],
            },
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["id"].startswith("ord_")
        assert data["status"] == "pending"
        assert len(data["items"]) == 2

    async def test_returns_401_without_auth(self, client):
        response = await client.post(
            "/api/v1/orders",
            json={"items": [{"product_id": "prod_1", "quantity": 1}]},
        )
        assert response.status_code == 401

    async def test_returns_400_for_empty_items(self, client, auth_headers):
        response = await client.post(
            "/api/v1/orders",
            json={"items": []},
            headers=auth_headers,
        )
        assert response.status_code == 422  # FastAPI validation
        errors = response.json()["detail"]
        assert any("items" in str(e) for e in errors)

    @pytest.mark.parametrize(
        "payload,expected_status",
        [
            ({"items": [{"product_id": "", "quantity": 1}]}, 422),
            ({"items": [{"product_id": "p1", "quantity": 0}]}, 422),
            ({"items": [{"product_id": "p1", "quantity": -1}]}, 422),
            ({}, 422),
            ("not json", 422),
        ],
    )
    async def test_validation_errors(
        self, client, auth_headers, payload, expected_status
    ):
        response = await client.post(
            "/api/v1/orders",
            json=payload if isinstance(payload, dict) else None,
            content=payload if isinstance(payload, str) else None,
            headers=auth_headers,
        )
        assert response.status_code == expected_status
```

```python
# Python — Django REST Framework
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()

class OrderAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="john@example.com",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_order(self):
        response = self.client.post(
            "/api/v1/orders/",
            data={
                "items": [
                    {"product_id": "prod_1", "quantity": 2},
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "pending")

    def test_unauthenticated_returns_401(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            "/api/v1/orders/",
            data={"items": [{"product_id": "prod_1", "quantity": 1}]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
```

---

## Testing Response Headers & Content Types

```typescript
// TypeScript — Header verification
it("should set correct response headers", async () => {
  const response = await request(app)
    .get("/api/v1/orders")
    .set("Authorization", `Bearer ${authToken}`);

  // Content type
  expect(response.headers["content-type"]).toMatch(/application\/json/);

  // Security headers
  expect(response.headers["x-content-type-options"]).toBe("nosniff");
  expect(response.headers["x-frame-options"]).toBe("DENY");

  // Cache control for authenticated endpoints
  expect(response.headers["cache-control"]).toContain("no-store");

  // Pagination headers
  expect(response.headers["x-total-count"]).toBeDefined();
  expect(response.headers["link"]).toContain("rel=\"next\"");
});

// CORS preflight
it("should handle CORS preflight correctly", async () => {
  const response = await request(app)
    .options("/api/v1/orders")
    .set("Origin", "https://app.example.com")
    .set("Access-Control-Request-Method", "POST")
    .set("Access-Control-Request-Headers", "Authorization,Content-Type");

  expect(response.status).toBe(204);
  expect(response.headers["access-control-allow-origin"]).toBe(
    "https://app.example.com"
  );
  expect(response.headers["access-control-allow-methods"]).toContain("POST");
  expect(response.headers["access-control-max-age"]).toBeDefined();
});
```

---

## Testing Pagination

```typescript
// TypeScript — Pagination tests
describe("GET /api/v1/orders (pagination)", () => {
  beforeEach(async () => {
    // Create 50 test orders
    for (let i = 0; i < 50; i++) {
      await createTestOrder(`ord_${String(i).padStart(3, "0")}`);
    }
  });

  it("should return default page size of 20", async () => {
    const response = await request(app)
      .get("/api/v1/orders")
      .set("Authorization", `Bearer ${authToken}`);

    expect(response.body.data).toHaveLength(20);
    expect(response.body.meta.total).toBe(50);
    expect(response.body.meta.page).toBe(1);
    expect(response.body.meta.per_page).toBe(20);
    expect(response.body.meta.total_pages).toBe(3);
  });

  it("should return second page", async () => {
    const response = await request(app)
      .get("/api/v1/orders?page=2&per_page=20")
      .set("Authorization", `Bearer ${authToken}`);

    expect(response.body.data).toHaveLength(20);
    expect(response.body.meta.page).toBe(2);
  });

  it("should return last page with remaining items", async () => {
    const response = await request(app)
      .get("/api/v1/orders?page=3&per_page=20")
      .set("Authorization", `Bearer ${authToken}`);

    expect(response.body.data).toHaveLength(10);
    expect(response.body.meta.page).toBe(3);
  });

  it("should cap per_page at 100", async () => {
    const response = await request(app)
      .get("/api/v1/orders?per_page=500")
      .set("Authorization", `Bearer ${authToken}`);

    expect(response.body.data.length).toBeLessThanOrEqual(100);
  });

  it("should return empty array for page beyond total", async () => {
    const response = await request(app)
      .get("/api/v1/orders?page=99")
      .set("Authorization", `Bearer ${authToken}`);

    expect(response.body.data).toHaveLength(0);
  });
});
```

---

## Testing File Uploads

```typescript
// TypeScript — Multipart upload test
describe("POST /api/v1/uploads", () => {
  it("should accept image upload", async () => {
    const response = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("file", Buffer.from("fake-image-data"), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      })
      .field("type", "avatar");

    expect(response.status).toBe(201);
    expect(response.body.url).toMatch(/^https:\/\//);
    expect(response.body.size).toBeGreaterThan(0);
  });

  it("should reject files exceeding size limit", async () => {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

    const response = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("file", largeBuffer, "large.jpg");

    expect(response.status).toBe(413);
  });

  it("should reject disallowed file types", async () => {
    const response = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("file", Buffer.from("#!/bin/bash\nrm -rf /"), {
        filename: "evil.sh",
        contentType: "application/x-sh",
      });

    expect(response.status).toBe(415);
  });
});
```

---

## Best Practices

1. **ALWAYS test the full middleware stack** — auth, validation, rate limiting, error handling
2. **ALWAYS test all HTTP status codes** — 200, 201, 400, 401, 403, 404, 409, 500
3. **ALWAYS verify response body structure** — fields, types, nesting
4. **ALWAYS test both valid and invalid inputs** — boundary values, empty strings, null
5. **ALWAYS test authentication/authorization** — missing token, expired, wrong role
6. **ALWAYS verify error responses don't leak internals** — no SQL, stack traces, or secrets
7. **ALWAYS test response headers** — content-type, cache-control, CORS, pagination
8. **NEVER hardcode test tokens** — generate with helper that matches real auth flow
9. **NEVER test business logic in endpoint tests** — that's unit test territory
10. **NEVER rely on test execution order** — each test must be independent

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| Only testing happy path | Validation bugs, auth bypasses | Test every error scenario |
| Hardcoded auth tokens | Tokens expire, tests break | Generate in test setup |
| Testing business logic in API tests | Slow, duplicated tests | Keep API tests thin, unit test logic |
| No response body assertions | Wrong data returned unnoticed | Assert structure + values |
| Ignoring response headers | Missing CORS, cache, security headers | Assert relevant headers |
| Sharing state between tests | Flaky, order-dependent | Clean DB between tests |
| Not testing 500 error sanitization | Stack traces in production responses | Assert no internals leaked |
| Giant test files | Hard to navigate, slow | Group by resource/endpoint |

---

## Real-world Examples

### Stripe API Testing
- Every endpoint has test matrix: auth × validation × success × error
- Uses recording/playback for external API calls
- >10,000 endpoint tests across API surface
- Custom assertion library for consistent error format

### GitHub API
- OpenAPI spec-driven test generation
- Validates every response against JSON Schema
- Tests for rate limit headers on every endpoint
- Backward compatibility tests against previous API versions
