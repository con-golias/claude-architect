# API Integration Testing

| Attribute      | Value                                                    |
|----------------|----------------------------------------------------------|
| Domain         | Testing > Integration Testing                            |
| Importance     | Critical                                                 |
| Last Updated   | 2026-03-10                                               |
| Cross-ref      | `06-backend/testing/api-testing/endpoint-testing.md`     |

---

## Core Concepts

### What API Integration Testing Covers

API integration tests verify that HTTP endpoints behave correctly when the full request-response
cycle executes against a running server. Unlike unit tests that mock transport layers, these tests
exercise routing, middleware, serialization, validation, authentication, and database interactions
as a single integrated flow.

### REST API Testing Dimensions

Target these verification areas in every REST API test suite:

- **Status codes** -- Confirm correct codes for success (200, 201, 204), client errors (400, 401, 403, 404, 409, 422), and server errors (500, 502, 503).
- **Response schemas** -- Validate the shape and types of JSON responses against a contract (JSON Schema, Zod, OpenAPI).
- **Headers** -- Verify `Content-Type`, `Cache-Control`, `X-Request-Id`, CORS headers, and pagination headers.
- **Auth flows** -- Test unauthenticated access, expired tokens, insufficient scopes, and valid credentials.
- **Idempotency** -- Confirm that retrying `PUT` or `DELETE` with the same payload produces the same result.
- **Content negotiation** -- Test `Accept` header handling and correct `Content-Type` in responses.

### GraphQL Testing Dimensions

- **Queries** -- Validate data shape, nested resolvers, pagination, and field-level authorization.
- **Mutations** -- Verify create, update, delete operations and their side effects.
- **Subscriptions** -- Test WebSocket connection lifecycle, message delivery, and reconnection.
- **Error handling** -- Confirm structured `errors` array with correct codes, paths, and messages.
- **Complexity limits** -- Ensure query depth and cost limits reject abusive queries.

### Test Organization Strategies

Organize API tests using one of these approaches:

| Strategy        | Structure                         | Best For                        |
|-----------------|-----------------------------------|---------------------------------|
| Per-resource    | `users.test.ts`, `orders.test.ts` | CRUD-heavy REST APIs            |
| Per-scenario    | `checkout-flow.test.ts`           | Multi-step business workflows   |
| Per-concern     | `auth.test.ts`, `pagination.test.ts` | Cross-cutting API behaviors  |

---

## Code Examples

### TypeScript: Supertest with Express (Full CRUD Test Suite)

```typescript
// tests/integration/users.test.ts
import request from "supertest";
import { app } from "../../src/app";
import { db } from "../../src/database";
import { z } from "zod";

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.string().datetime(),
});

const ErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

describe("Users API", () => {
  let authToken: string;
  let createdUserId: string;

  beforeAll(async () => {
    await db.migrate.latest();
    // Obtain a valid JWT for authenticated requests
    const res = await request(app)
      .post("/auth/token")
      .send({ clientId: "test-client", secret: process.env.TEST_SECRET });
    authToken = res.body.token;
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.raw("TRUNCATE TABLE users CASCADE");
  });

  describe("POST /users", () => {
    it("creates a user and returns 201 with valid schema", async () => {
      const res = await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ email: "jane@example.com", name: "Jane Doe" })
        .expect(201)
        .expect("Content-Type", /json/);

      const parsed = UserSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);
      createdUserId = res.body.id;
    });

    it("returns 400 for missing required fields", async () => {
      const res = await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ email: "no-name@example.com" })
        .expect(400);

      const parsed = ErrorSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 409 for duplicate email", async () => {
      const payload = { email: "dup@example.com", name: "First" };
      await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${authToken}`)
        .send(payload)
        .expect(201);

      await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${authToken}`)
        .send(payload)
        .expect(409);
    });

    it("returns 401 without authentication", async () => {
      await request(app)
        .post("/users")
        .send({ email: "anon@example.com", name: "Anon" })
        .expect(401);
    });
  });

  describe("GET /users/:id", () => {
    it("returns 200 with user data for existing user", async () => {
      const created = await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ email: "fetch@example.com", name: "Fetch User" });

      const res = await request(app)
        .get(`/users/${created.body.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.email).toBe("fetch@example.com");
    });

    it("returns 404 for non-existent user", async () => {
      await request(app)
        .get("/users/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe("DELETE /users/:id", () => {
    it("returns 204 and subsequent GET returns 404", async () => {
      const created = await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ email: "delete@example.com", name: "Delete Me" });

      await request(app)
        .delete(`/users/${created.body.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(204);

      await request(app)
        .get(`/users/${created.body.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
```

### Go: httptest Package for HTTP Handler Testing

```go
// handlers/users_test.go
package handlers_test

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "myapp/handlers"
    "myapp/middleware"
    "myapp/testutil"
)

func TestUsersAPI(t *testing.T) {
    db := testutil.SetupTestDB(t)
    router := handlers.NewRouter(db)

    authHeader := "Bearer " + testutil.GenerateTestToken(t, "admin")

    t.Run("POST /users returns 201 with valid payload", func(t *testing.T) {
        testutil.TruncateTables(t, db, "users")

        body, _ := json.Marshal(map[string]string{
            "email": "gopher@example.com",
            "name":  "Gopher",
        })

        req := httptest.NewRequest(http.MethodPost, "/users", bytes.NewReader(body))
        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("Authorization", authHeader)
        rec := httptest.NewRecorder()

        router.ServeHTTP(rec, req)

        assert.Equal(t, http.StatusCreated, rec.Code)
        assert.Contains(t, rec.Header().Get("Content-Type"), "application/json")

        var resp map[string]interface{}
        err := json.Unmarshal(rec.Body.Bytes(), &resp)
        require.NoError(t, err)
        assert.NotEmpty(t, resp["id"])
        assert.Equal(t, "gopher@example.com", resp["email"])
    })

    t.Run("POST /users returns 400 for invalid JSON", func(t *testing.T) {
        req := httptest.NewRequest(http.MethodPost, "/users",
            bytes.NewReader([]byte(`{invalid`)))
        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("Authorization", authHeader)
        rec := httptest.NewRecorder()

        router.ServeHTTP(rec, req)

        assert.Equal(t, http.StatusBadRequest, rec.Code)
    })

    t.Run("GET /users/:id returns 404 for missing user", func(t *testing.T) {
        testutil.TruncateTables(t, db, "users")

        req := httptest.NewRequest(http.MethodGet,
            "/users/00000000-0000-0000-0000-000000000000", nil)
        req.Header.Set("Authorization", authHeader)
        rec := httptest.NewRecorder()

        router.ServeHTTP(rec, req)

        assert.Equal(t, http.StatusNotFound, rec.Code)
    })

    t.Run("DELETE /users/:id is idempotent", func(t *testing.T) {
        testutil.TruncateTables(t, db, "users")
        id := testutil.SeedUser(t, db, "del@example.com", "Del")

        for i := 0; i < 2; i++ {
            req := httptest.NewRequest(http.MethodDelete, "/users/"+id, nil)
            req.Header.Set("Authorization", authHeader)
            rec := httptest.NewRecorder()

            router.ServeHTTP(rec, req)

            // First call 204, second call 204 or 404 depending on design
            assert.Contains(t, []int{204, 404}, rec.Code)
        }
    })
}
```

### Python: pytest with httpx for FastAPI Testing

```python
# tests/integration/test_users_api.py
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.main import app
from app.database import get_db
from app.config import settings


@pytest.fixture(scope="module")
async def engine():
    eng = create_async_engine(settings.TEST_DATABASE_URL)
    yield eng
    await eng.dispose()


@pytest.fixture(autouse=True)
async def clean_db(engine):
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE TABLE users CASCADE"))
    yield


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    resp = await client.post("/auth/token", json={
        "client_id": "test-client",
        "secret": settings.TEST_CLIENT_SECRET,
    })
    return {"Authorization": f"Bearer {resp.json()['token']}"}


@pytest.mark.asyncio
class TestUsersAPI:
    async def test_create_user_returns_201(self, client, auth_headers):
        resp = await client.post(
            "/users",
            json={"email": "py@example.com", "name": "Pythonista"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["email"] == "py@example.com"

    async def test_create_user_validates_email(self, client, auth_headers):
        resp = await client.post(
            "/users",
            json={"email": "not-an-email", "name": "Bad"},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_get_nonexistent_user_returns_404(self, client, auth_headers):
        resp = await client.get(
            "/users/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_unauthorized_request_returns_401(self, client):
        resp = await client.post(
            "/users",
            json={"email": "anon@example.com", "name": "Anon"},
        )
        assert resp.status_code == 401

    async def test_delete_then_get_returns_404(self, client, auth_headers):
        create_resp = await client.post(
            "/users",
            json={"email": "del@example.com", "name": "Del"},
            headers=auth_headers,
        )
        user_id = create_resp.json()["id"]

        del_resp = await client.delete(
            f"/users/{user_id}", headers=auth_headers,
        )
        assert del_resp.status_code == 204

        get_resp = await client.get(
            f"/users/{user_id}", headers=auth_headers,
        )
        assert get_resp.status_code == 404
```

### JSON Schema Validation for Response Contracts

```typescript
// tests/helpers/schema-validator.ts
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const userListSchema = {
  type: "object",
  required: ["data", "meta"],
  properties: {
    data: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "email", "name", "createdAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          name: { type: "string", minLength: 1 },
          createdAt: { type: "string", format: "date-time" },
        },
        additionalProperties: false,
      },
    },
    meta: {
      type: "object",
      required: ["total", "page", "pageSize"],
      properties: {
        total: { type: "integer", minimum: 0 },
        page: { type: "integer", minimum: 1 },
        pageSize: { type: "integer", minimum: 1 },
      },
    },
  },
};

// Usage in tests
const validate = ajv.compile(userListSchema);
const valid = validate(responseBody);
if (!valid) {
  throw new Error(`Schema mismatch: ${JSON.stringify(validate.errors)}`);
}
```

---

## 10 Best Practices

1. **Test against a real server process** -- Use in-process server bootstrapping (Supertest, httptest, ASGITransport) rather than mocking HTTP. This catches routing, middleware, and serialization bugs.
2. **Validate response schemas, not just status codes** -- Assert on the full shape of response bodies using JSON Schema, Zod, or Pydantic. Status 200 with a broken payload is still a bug.
3. **Test every documented error code** -- Write explicit tests for 400, 401, 403, 404, 409, 422, and 500 responses. Error paths carry the most production risk.
4. **Isolate test data per test** -- Truncate or rollback between tests. Never rely on ordering or shared state between test cases.
5. **Use factory functions for request payloads** -- Centralize payload construction so schema changes require updates in one place.
6. **Assert on headers, not just bodies** -- Verify `Content-Type`, caching directives, CORS headers, and rate-limit headers.
7. **Test auth at the API layer, not just middleware** -- Verify that endpoints correctly propagate 401/403 when tokens are missing, expired, or lack required scopes.
8. **Pin external API contracts with snapshot tests** -- When testing against third-party APIs, record and replay responses to detect upstream contract changes.
9. **Keep API tests under 30 seconds total** -- Parallelize test suites, use connection pooling, and avoid unnecessary sleeps. Slow tests get skipped.
10. **Run API tests in CI on every pull request** -- Never gate API integration tests behind manual triggers. Automate them alongside unit tests.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Testing through the UI instead of direct API calls | Slow, flaky, masks API-layer bugs | Hit endpoints directly with an HTTP client |
| Hardcoding base URLs and ports | Tests break across environments | Use environment variables or in-process server binding |
| Sharing mutable state between test cases | Order-dependent failures, non-deterministic results | Isolate with truncation or transaction rollback per test |
| Asserting only on status codes | Misses broken response bodies, missing fields | Add schema validation to every response assertion |
| Using `sleep()` to wait for async side effects | Slow and flaky | Poll with timeout or use event-driven assertions |
| Testing only the happy path | Error handling regressions go unnoticed | Write dedicated tests for every error code in the API spec |
| Ignoring response headers | Cache, CORS, and security header bugs ship to production | Assert on critical headers in dedicated test cases |
| Copying full JSON responses as expected values | Tests break on any additive change, brittle | Assert on required fields and structure, ignore optional additions |

---

## Enforcement Checklist

- [ ] Every REST endpoint has at least one test for each documented status code
- [ ] Response body schemas are validated programmatically (JSON Schema, Zod, or equivalent)
- [ ] Auth tests cover: missing token, expired token, insufficient scope, valid token
- [ ] Test data is isolated per test case (truncate, rollback, or ephemeral database)
- [ ] No hardcoded URLs, ports, or credentials in test files
- [ ] API tests execute in CI on every pull request
- [ ] Total API test suite completes in under 60 seconds
- [ ] Error response structure matches API documentation
- [ ] GraphQL tests cover queries, mutations, and error responses
- [ ] Factory functions or fixtures generate all test payloads
- [ ] Header assertions cover Content-Type, CORS, and security headers
- [ ] Test coverage report includes integration test results
