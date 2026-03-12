# SDK Structure

> **AI Plugin Directive:** When creating or structuring a software development kit (SDK) — a client library for an API or platform — ALWAYS use this structure. Apply per-language idiomatic patterns, code generation where possible, versioned APIs, and comprehensive error handling. This guide covers SDKs published for external developers to integrate with your API or platform.

**Core Rule: An SDK is NOT a REST client wrapper — it is the developer experience of your API. It MUST be idiomatic to each target language, auto-generated where possible, strongly typed, and versioned independently per language. NEVER hand-write SDKs for multiple languages when OpenAPI codegen is available.**

---

## 1. SDK Repository Structure

```
Single-language SDK:

my-api-sdk-python/
├── src/
│   └── my_api/
│       ├── __init__.py                    # Version, public API
│       ├── client.py                      # Main SDK client
│       ├── resources/                     # API resource classes
│       │   ├── __init__.py
│       │   ├── users.py                   # users.list(), users.get(), users.create()
│       │   ├── projects.py
│       │   └── billing.py
│       ├── types/                         # Request/response types
│       │   ├── __init__.py
│       │   ├── user.py
│       │   ├── project.py
│       │   └── shared.py                  # Pagination, errors
│       ├── _http.py                       # HTTP client wrapper
│       ├── _auth.py                       # Authentication handling
│       ├── _errors.py                     # SDK-specific exceptions
│       ├── _pagination.py                 # Auto-pagination helpers
│       ├── _streaming.py                  # Server-sent events / streaming
│       └── _compat.py                     # Python version compatibility
│
├── tests/
│   ├── conftest.py
│   ├── test_client.py
│   ├── test_users.py
│   └── cassettes/                         # VCR recorded responses
│       └── test_users_list.yaml
│
├── examples/
│   ├── basic_usage.py
│   ├── pagination.py
│   ├── streaming.py
│   └── error_handling.py
│
├── pyproject.toml
├── README.md
├── CHANGELOG.md
└── LICENSE
```

```
Multi-language SDK monorepo:

my-api-sdks/
├── openapi/                               # API specification (source of truth)
│   ├── openapi.yaml                       # OpenAPI 3.1 spec
│   └── components/
│       ├── schemas/
│       └── paths/
│
├── generator/                             # Code generation config
│   ├── config.yaml                        # Generator settings
│   ├── templates/                         # Custom Mustache/Handlebars templates
│   │   ├── python/
│   │   ├── typescript/
│   │   └── go/
│   └── scripts/
│       └── generate.sh                    # Generate all SDKs
│
├── sdks/
│   ├── python/                            # Python SDK
│   │   ├── src/my_api/
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── README.md
│   ├── typescript/                        # TypeScript SDK
│   │   ├── src/
│   │   ├── tests/
│   │   ├── package.json
│   │   └── README.md
│   ├── go/                                # Go SDK
│   │   ├── *.go
│   │   ├── go.mod
│   │   └── README.md
│   └── java/                              # Java SDK
│       ├── src/main/java/
│       ├── build.gradle.kts
│       └── README.md
│
├── docs/                                  # SDK documentation
│   ├── getting-started.md
│   ├── authentication.md
│   ├── pagination.md
│   ├── error-handling.md
│   └── migration-guide.md
│
└── .github/
    └── workflows/
        ├── generate.yml                   # Regenerate on spec change
        ├── test-python.yml
        ├── test-typescript.yml
        ├── publish-python.yml
        └── publish-typescript.yml
```

---

## 2. Client Design Pattern

```typescript
// TypeScript SDK — Client class

export class MyApiClient {
  private readonly httpClient: HttpClient;

  /** API resource namespaces */
  readonly users: UsersResource;
  readonly projects: ProjectsResource;
  readonly billing: BillingResource;

  constructor(options: ClientOptions) {
    validateOptions(options);

    this.httpClient = new HttpClient({
      baseUrl: options.baseUrl ?? "https://api.myservice.com/v1",
      apiKey: options.apiKey,
      timeout: options.timeout ?? 30_000,
      maxRetries: options.maxRetries ?? 2,
      headers: options.defaultHeaders,
    });

    // Initialize resource namespaces
    this.users = new UsersResource(this.httpClient);
    this.projects = new ProjectsResource(this.httpClient);
    this.billing = new BillingResource(this.httpClient);
  }
}

// Usage — idiomatic and discoverable:
const client = new MyApiClient({ apiKey: "sk-..." });
const user = await client.users.get("usr_123");
const projects = await client.projects.list({ status: "active" });
```

```python
# Python SDK — Client class

class MyApiClient:
    """Client for the MyAPI service."""

    users: UsersResource
    projects: ProjectsResource
    billing: BillingResource

    def __init__(
        self,
        api_key: str | None = None,
        *,
        base_url: str = "https://api.myservice.com/v1",
        timeout: float = 30.0,
        max_retries: int = 2,
        default_headers: dict[str, str] | None = None,
    ) -> None:
        api_key = api_key or os.environ.get("MY_API_KEY")
        if not api_key:
            raise AuthenticationError("API key required")

        self._http = HttpClient(
            base_url=base_url,
            api_key=api_key,
            timeout=timeout,
            max_retries=max_retries,
            default_headers=default_headers or {},
        )

        self.users = UsersResource(self._http)
        self.projects = ProjectsResource(self._http)
        self.billing = BillingResource(self._http)

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
```

---

## 3. Resource Class Pattern

```typescript
// TypeScript — Resource class

export class UsersResource {
  constructor(private readonly http: HttpClient) {}

  /** List all users with pagination */
  async list(
    params?: UserListParams
  ): Promise<PaginatedResponse<User>> {
    return this.http.get<PaginatedResponse<User>>("/users", {
      query: params,
    });
  }

  /** Get a single user by ID */
  async get(userId: string): Promise<User> {
    return this.http.get<User>(`/users/${userId}`);
  }

  /** Create a new user */
  async create(data: UserCreateParams): Promise<User> {
    return this.http.post<User>("/users", { body: data });
  }

  /** Update a user */
  async update(
    userId: string,
    data: UserUpdateParams
  ): Promise<User> {
    return this.http.patch<User>(`/users/${userId}`, { body: data });
  }

  /** Delete a user */
  async delete(userId: string): Promise<void> {
    return this.http.delete(`/users/${userId}`);
  }
}
```

```
Resource naming conventions:

TypeScript/JavaScript:
  client.users.list()
  client.users.get(id)
  client.users.create(data)
  client.users.update(id, data)
  client.users.delete(id)

Python:
  client.users.list()
  client.users.retrieve(id)     ← "get" is a builtin, use "retrieve"
  client.users.create(**data)
  client.users.update(id, **data)
  client.users.delete(id)

Go:
  client.Users.List(ctx, params)
  client.Users.Get(ctx, id)
  client.Users.New(ctx, params)  ← "Create" or "New"
  client.Users.Update(ctx, id, params)
  client.Users.Delete(ctx, id)

Java:
  client.users().list(params)
  client.users().get(id)
  client.users().create(params)
  client.users().update(id, params)
  client.users().delete(id)
```

---

## 4. Type Definitions

```typescript
// TypeScript — Request/response types

/** User object returned by the API */
export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member" | "viewer";
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
  metadata: Record<string, unknown> | null;
}

/** Parameters for listing users */
export interface UserListParams {
  /** Filter by role */
  role?: "admin" | "member" | "viewer";
  /** Number of results per page (1-100, default 20) */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
  /** Sort order */
  orderBy?: "created_at" | "name" | "email";
}

/** Parameters for creating a user */
export interface UserCreateParams {
  email: string;
  name: string;
  role?: "admin" | "member" | "viewer";
  metadata?: Record<string, unknown>;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  nextCursor: string | null;
  total: number;
}
```

---

## 5. Error Handling

```typescript
// TypeScript — Error hierarchy

export class MyApiError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly requestId: string | undefined;

  constructor(
    message: string,
    status?: number,
    code?: string,
    requestId?: string
  ) {
    super(message);
    this.name = "MyApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export class AuthenticationError extends MyApiError {
  constructor(message = "Invalid API key") {
    super(message, 401, "authentication_error");
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends MyApiError {
  readonly retryAfter: number;

  constructor(retryAfter: number, requestId?: string) {
    super(`Rate limited. Retry after ${retryAfter}s`, 429, "rate_limit", requestId);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class NotFoundError extends MyApiError {
  constructor(resource: string, id: string, requestId?: string) {
    super(`${resource} '${id}' not found`, 404, "not_found", requestId);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends MyApiError {
  readonly errors: FieldError[];

  constructor(errors: FieldError[], requestId?: string) {
    super("Validation failed", 422, "validation_error", requestId);
    this.name = "ValidationError";
    this.errors = errors;
  }
}

export class InternalServerError extends MyApiError {
  constructor(requestId?: string) {
    super("Internal server error", 500, "internal_error", requestId);
    this.name = "InternalServerError";
  }
}
```

```
Error mapping:

HTTP Status → SDK Error
  401       → AuthenticationError
  403       → PermissionError
  404       → NotFoundError
  409       → ConflictError
  422       → ValidationError
  429       → RateLimitError (with retryAfter)
  500-599   → InternalServerError

ALWAYS include:
  - requestId — for debugging with support
  - Typed error codes — "rate_limit", "not_found"
  - Human-readable message
  - Structured field errors for 422

NEVER expose raw HTTP details to SDK consumers.
```

---

## 6. Auto-Pagination

```typescript
// TypeScript — Auto-pagination iterator

export class AutoPaginatingList<T> implements AsyncIterable<T> {
  constructor(
    private readonly fetchPage: (cursor?: string) => Promise<PaginatedResponse<T>>
  ) {}

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let cursor: string | undefined;

    do {
      const page = await this.fetchPage(cursor);
      for (const item of page.data) {
        yield item;
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }

  /** Collect all items into an array */
  async toArray(): Promise<T[]> {
    const items: T[] = [];
    for await (const item of this) {
      items.push(item);
    }
    return items;
  }
}

// Usage:
for await (const user of client.users.list({ role: "admin" })) {
  console.log(user.name);
}
// Or collect all:
const allUsers = await client.users.list().toArray();
```

```python
# Python — Auto-pagination

class SyncPage(Generic[T]):
    data: list[T]
    has_more: bool
    next_cursor: str | None

    def __iter__(self) -> Iterator[T]:
        yield from self.data
        while self.has_more:
            page = self._fetch_next()
            yield from page.data

# Usage:
for user in client.users.list(role="admin"):
    print(user.name)
```

---

## 7. Retry and Timeout

```typescript
// TypeScript — Built-in retry with backoff

class HttpClient {
  private readonly maxRetries: number;
  private readonly timeout: number;

  async request<T>(config: RequestConfig): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetch(config);

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get("retry-after") || "1");
          if (attempt < this.maxRetries) {
            await sleep(retryAfter * 1000);
            continue;
          }
          throw new RateLimitError(retryAfter);
        }

        if (response.status >= 500 && attempt < this.maxRetries) {
          await sleep(this.backoff(attempt));
          continue;
        }

        return this.handleResponse<T>(response);
      } catch (error) {
        lastError = error as Error;
        if (!this.isRetryable(error) || attempt === this.maxRetries) {
          throw lastError;
        }
        await sleep(this.backoff(attempt));
      }
    }

    throw lastError!;
  }

  private backoff(attempt: number): number {
    return Math.min(1000 * 2 ** attempt + Math.random() * 100, 30_000);
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof MyApiError) {
      return error.status !== undefined && (
        error.status === 429 || error.status >= 500
      );
    }
    return error instanceof TypeError; // Network errors
  }
}
```

```
Retry rules:
  ✅ Retry on: 429 (rate limit), 500+ (server error), network errors
  ❌ NEVER retry: 400, 401, 403, 404, 422 (client errors)
  - Use exponential backoff with jitter
  - Respect Retry-After header for 429
  - Default max retries: 2 (3 total attempts)
  - Default timeout: 30 seconds
  - Make retry count and timeout configurable
```

---

## 8. Code Generation

```yaml
# generator/config.yaml (OpenAPI Generator / Stainless / Fern)

# Using OpenAPI Generator
generators:
  python:
    generator: python
    output: ./sdks/python
    config:
      packageName: my_api
      projectName: my-api-python
      library: httpx              # Use httpx, not requests

  typescript:
    generator: typescript-fetch
    output: ./sdks/typescript
    config:
      npmName: "@myorg/my-api"
      supportsES6: true
      withInterfaces: true

  go:
    generator: go
    output: ./sdks/go
    config:
      packageName: myapi
      generateInterfaces: true
```

```
Code generation strategies:

1. OpenAPI Generator (open source, many languages)
   ✅ Free, wide language support
   ❌ Generated code quality varies, templates need customization

2. Stainless (commercial, premium quality)
   ✅ Produces SDKs like Stripe/OpenAI quality
   ✅ Handles pagination, streaming, retries
   ❌ Commercial license

3. Fern (commercial, multi-language)
   ✅ Fern Definition Language or OpenAPI input
   ✅ Good TypeScript/Python/Go/Java output
   ❌ Commercial license

4. Hand-written
   ✅ Maximum control, perfect API design
   ❌ N × effort for N languages
   Use ONLY for 1-2 languages with simple APIs

Decision:
  1-2 languages, simple API → Hand-write
  3+ languages OR complex API → Use code generation
  Premium DX required → Stainless or Fern
  Budget-constrained → OpenAPI Generator + custom templates
```

---

## 9. Versioning Strategy

```
SDK versioning is INDEPENDENT of API versioning.

API version: v1, v2 (breaking changes to the HTTP API)
SDK version: 1.2.3, 2.0.0 (package version on npm/PyPI)

SDK v1.0.0 → talks to API v1
SDK v1.5.0 → talks to API v1 (new SDK features, same API)
SDK v2.0.0 → talks to API v2 (or SDK breaking changes)

Package naming with API version:
  @myorg/my-api           ← Latest API version (v1)
  @myorg/my-api           ← SDK v2.0.0 may target API v2

  my-api                  ← Python: my_api (targets latest API)

Base URL encodes API version:
  https://api.myservice.com/v1/users
  https://api.myservice.com/v2/users

NEVER mix API versioning into SDK package names.
The SDK constructor accepts baseUrl which includes the API version.
```

---

## 10. Testing Strategy

```typescript
// TypeScript — Testing with recorded responses

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { MyApiClient } from "../src";

const server = setupServer(
  http.get("https://api.myservice.com/v1/users", () => {
    return HttpResponse.json({
      data: [{ id: "usr_1", name: "Alice", email: "alice@example.com", role: "admin" }],
      hasMore: false,
      nextCursor: null,
      total: 1,
    });
  }),

  http.get("https://api.myservice.com/v1/users/:id", ({ params }) => {
    if (params.id === "usr_404") {
      return HttpResponse.json(
        { error: { code: "not_found", message: "User not found" } },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      id: params.id, name: "Alice", email: "alice@example.com", role: "admin",
    });
  })
);

beforeAll(() => server.listen());
afterAll(() => server.close());

describe("UsersResource", () => {
  const client = new MyApiClient({ apiKey: "test-key" });

  it("lists users", async () => {
    const result = await client.users.list();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("Alice");
  });

  it("gets a user by ID", async () => {
    const user = await client.users.get("usr_1");
    expect(user.name).toBe("Alice");
  });

  it("throws NotFoundError for missing user", async () => {
    await expect(client.users.get("usr_404"))
      .rejects.toThrow(NotFoundError);
  });
});
```

```
SDK testing layers:

1. Unit tests — mock HTTP, test SDK logic
   - Error mapping
   - Pagination assembly
   - Request building (headers, query params)
   - Retry behavior

2. Contract tests — validate against OpenAPI spec
   - Request shapes match spec
   - Response shapes match spec
   - Use Prism mock server

3. Integration tests — hit staging API
   - Run in CI nightly (not on every PR)
   - Use test API keys
   - Verify real API responses match types

4. Example tests — verify examples compile and run
   - Include examples/ in CI test suite
   - Ensure docs stay up to date
```

---

## 11. Documentation

```
SDK documentation structure:

README.md
  ├── Installation (1 command)
  ├── Quick Start (5 lines)
  ├── Authentication
  └── Link to full docs

docs/
  ├── getting-started.md     ← Install + first API call
  ├── authentication.md      ← API keys, OAuth, tokens
  ├── pagination.md          ← Auto-pagination, manual paging
  ├── error-handling.md      ← Error types, retry behavior
  ├── streaming.md           ← SSE, websocket patterns
  ├── configuration.md       ← Timeouts, retries, proxy
  ├── api-reference/         ← Auto-generated from types
  │   ├── client.md
  │   ├── users.md
  │   └── projects.md
  └── migration-guide.md     ← v1 → v2 migration

Every example MUST be copy-pasteable and runnable.
Every error message MUST include the requestId.
Every type MUST have JSDoc/docstring descriptions.
```

---

## 12. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Raw HTTP responses exposed | Consumers parse JSON manually | Return typed objects |
| No retry logic | Transient failures crash apps | Built-in retry with backoff |
| No auto-pagination | Consumers write pagination loops | AsyncIterator / generator |
| Manual multi-language SDKs | Inconsistent APIs across languages | Use code generation |
| No error hierarchy | `catch (e)` with no type info | Typed error classes with codes |
| Missing requestId | Can't debug with support | Include in all errors |
| No timeout default | Requests hang forever | Default 30s timeout |
| Bundling HTTP client | Conflicts with consumer's client | Accept custom HTTP client option |
| No examples | Users can't get started | examples/ directory with runnable code |
| API version in package name | Confusing versioning | Separate API version (URL) from SDK version (package) |

---

## 13. Enforcement Checklist

- [ ] Resource-namespaced API — `client.resource.method()` pattern
- [ ] Idiomatic per language — follow language conventions for naming, errors, async
- [ ] Typed request/response — NEVER use `any` or untyped dicts
- [ ] Error hierarchy — base error + specific errors (auth, rate limit, not found, validation)
- [ ] requestId in ALL errors — for support debugging
- [ ] Auto-pagination — async iterator / generator
- [ ] Built-in retry — exponential backoff, respect Retry-After
- [ ] Configurable timeout — default 30s
- [ ] Auto-generated from OpenAPI — if 3+ languages
- [ ] Examples directory — runnable, tested examples
- [ ] SDK version independent of API version
- [ ] Context manager / close method — for connection cleanup
- [ ] Environment variable fallback — `MY_API_KEY` env var
- [ ] Comprehensive docs — getting started, auth, pagination, errors, API reference
