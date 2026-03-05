---
paths:
  - "src/**/*.ts"
  - "src/**/*.js"
  - "src/**/*.py"
  - "src/**/*.java"
---
## Advanced API Patterns

### Rate Limiting
- Implement rate limiting on ALL public-facing endpoints — not just authentication
- Use token bucket or sliding window algorithm — never fixed window (it allows bursts at boundaries)
- Return rate limit headers on every response:
  - `X-RateLimit-Limit`: max requests per window
  - `X-RateLimit-Remaining`: requests left in current window
  - `X-RateLimit-Reset`: UTC epoch seconds when window resets
- Return `429 Too Many Requests` with `Retry-After` header when limit is exceeded
- Apply different limits per tier: unauthenticated < free < paid < internal
- Rate limit by API key or authenticated user — never by IP alone (NAT, proxies)

### Idempotency
- Require `Idempotency-Key` header on ALL non-idempotent mutations (POST, PATCH with side effects)
- Store idempotency key + response for at least 24 hours — return stored response on replay
- Keys MUST be client-generated UUIDs — never server-generated
- On duplicate key with different request body, return `422 Unprocessable Entity`
- Idempotency applies to the full side-effect chain: if a payment was created, replaying returns that payment — never creates a second one

### Cursor-Based Pagination
- Use opaque, encoded cursors (base64 of keyset values) — never expose raw IDs or offsets
- Cursor pagination MUST guarantee consistency: no skipped or duplicated items on concurrent writes
- Return `next_cursor` and `has_more` — omit `next_cursor` when `has_more` is false
- Support `first`/`after` (forward) and `last`/`before` (backward) for bidirectional traversal
- NEVER use OFFSET/LIMIT for datasets exceeding 10K rows — keyset pagination only

### Bulk Operations
- Provide batch endpoints for operations that clients frequently call in loops: `POST /api/v1/users/batch`
- Accept an array of operations, return an array of results in the same order
- Each item in the batch response MUST include its own status code and error (partial success is valid)
- Set a hard limit on batch size (max 100 items) — return `400` if exceeded
- Process batch items within a single database transaction when atomicity is required

### Partial Responses & Conditional Requests
- Support field selection via `?fields=id,name,email` — return only requested fields
- Use `ETag` headers for cacheable resources — generate from content hash or version number
- Honor `If-None-Match` — return `304 Not Modified` with empty body when ETag matches
- Honor `If-Modified-Since` for time-based caching on resources with reliable timestamps
- Use `If-Match` for optimistic concurrency control on PUT/PATCH — return `412 Precondition Failed` on mismatch

### Webhooks
- Sign webhook payloads with HMAC-SHA256 using a per-subscriber secret
- Include signature in `X-Signature-256` header — document verification algorithm
- Retry failed deliveries with exponential backoff: 1min, 5min, 30min, 2hr, 24hr — then disable
- Send a `ping` event type on subscription creation for subscriber validation
- Log all delivery attempts (status code, latency, retry count) for troubleshooting
- NEVER include secrets or full credentials in webhook payloads — use resource IDs for lookup

### Long-Running Operations
- For operations exceeding 30 seconds, return `202 Accepted` with a status endpoint URL
- Status endpoint returns: `pending`, `processing`, `completed`, `failed` with progress percentage
- Include `Retry-After` header indicating when to poll next
- On completion, include the result inline or a link to the final resource
- Support optional callback URL (webhook) so clients can avoid polling
