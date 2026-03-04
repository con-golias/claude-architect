---
paths:
  - "src/**/controllers/**"
  - "src/**/routes/**"
  - "src/**/api/**"
---
## REST API Design Standards

### URL Structure
- Use nouns (resources), NEVER verbs: GET /api/v1/users NOT GET /api/v1/getUsers
- Plural resource names: /users, /orders, /products
- Nested resources for ownership: /users/{id}/orders
- kebab-case for multi-word resources: /order-items
- Always lowercase URLs
- Version in URL path: /api/v1/, /api/v2/

### HTTP Methods
- GET: retrieve (idempotent, cacheable)
- POST: create new resource → return 201 + Location header
- PUT: full replacement of resource → return 200 or 204
- PATCH: partial update → return 200
- DELETE: remove → return 204 (idempotent)

### Standardized Response Format
Success:
```json
{
  "data": { },
  "meta": { "requestId": "uuid", "timestamp": "ISO8601" }
}
```
Error:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": [
      { "field": "email", "message": "Invalid format" }
    ],
    "requestId": "uuid"
  }
}
```

### Status Codes (Use Consistently)
- 200: Success with body
- 201: Created (include Location header)
- 204: Success with no body (DELETE, some PUT)
- 400: Bad request / validation error
- 401: Unauthenticated (missing or invalid credentials)
- 403: Forbidden (authenticated but not authorized)
- 404: Resource not found
- 409: Conflict (duplicate, version mismatch)
- 422: Unprocessable entity (valid JSON, invalid business logic)
- 429: Rate limit exceeded (include Retry-After header)
- 500: Internal server error (never expose implementation details)

### Pagination (Mandatory for list endpoints)
- Use cursor-based pagination for large/real-time datasets
- Use offset-based (page/limit) for simple cases
- Default page size: 20, max: 100
- Include pagination metadata: total, page, pageSize, hasNext, cursor
- Never return unbounded results

### Filtering, Sorting, Field Selection
- Filter via query params: ?status=active&role=admin
- Sort: ?sort=createdAt:desc,name:asc
- Field selection: ?fields=id,name,email
- Search: ?q=search+term

### Versioning Strategy
- URL path versioning: /api/v1/ (chosen for simplicity and clarity)
- Breaking changes = new major version
- Non-breaking additions (new optional fields) = same version
- Deprecation: minimum 6 months notice with Sunset header
- Document all versions in API changelog

### Idempotency
- PUT and DELETE are idempotent by design
- Implement idempotency keys for POST operations (via Idempotency-Key header)
- Retries must not create duplicate resources

### API Documentation
- OpenAPI/Swagger spec generated from code annotations
- Every endpoint: description, request schema, response schema, error cases
- Include example requests and responses
- Document rate limits and authentication requirements
