# Pagination

> **Domain:** Backend > API > REST
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2025-03

## What It Is

Pagination is the mechanism for dividing large datasets into smaller "pages" for efficient data retrieval via API. Three main strategies: **offset-based**, **cursor-based**, and **keyset pagination**. Each has trade-offs in performance, consistency, and complexity. The right choice depends on the use case, data size, and mutation frequency.

## Why It Matters

- **Performance:** Without pagination, a `GET /users` on a table with 10M records will crash the server or timeout
- **Memory:** Full result sets can be GBs — the server, client, and network cannot handle them
- **UX:** Infinite scroll, load more, paginated tables — all require pagination
- **Database Health:** `SELECT * FROM users` without `LIMIT` = full table scan = database lock
- **Cost:** Over-fetching increases bandwidth costs, compute time, and client processing
- **Consistency:** Proper pagination pattern prevents duplicate/missing records during mutations

---

## How It Works

### 1. Offset-Based Pagination

The simplest method. The client asks "give me the records starting from position X, Y items."

#### Request Format

```http
GET /api/users?page=2&per_page=20 HTTP/1.1
```

or alternatively:

```http
GET /api/users?offset=20&limit=20 HTTP/1.1
```

#### Response Format

```http
HTTP/1.1 200 OK
Content-Type: application/json
Link: <https://api.example.com/users?page=3&per_page=20>; rel="next",
      <https://api.example.com/users?page=1&per_page=20>; rel="prev",
      <https://api.example.com/users?page=1&per_page=20>; rel="first",
      <https://api.example.com/users?page=50&per_page=20>; rel="last"

{
  "data": [
    { "id": 21, "name": "User 21", "email": "user21@example.com" },
    { "id": 22, "name": "User 22", "email": "user22@example.com" }
  ],
  "meta": {
    "page": 2,
    "per_page": 20,
    "total": 1000,
    "total_pages": 50,
    "has_next": true,
    "has_prev": true
  },
  "links": {
    "self": "/api/users?page=2&per_page=20",
    "next": "/api/users?page=3&per_page=20",
    "prev": "/api/users?page=1&per_page=20",
    "first": "/api/users?page=1&per_page=20",
    "last": "/api/users?page=50&per_page=20"
  }
}
```

#### SQL Implementation

```sql
-- Page 2, 20 items per page
-- offset = (page - 1) * per_page = (2-1) * 20 = 20
SELECT id, name, email
FROM users
WHERE active = true
ORDER BY created_at DESC, id DESC  -- MUST have deterministic order
LIMIT 20
OFFSET 20;

-- Total count (separate query)
SELECT COUNT(*) FROM users WHERE active = true;
```

#### TypeScript Implementation

```typescript
// services/pagination.ts
interface OffsetPaginationParams {
  page: number;
  perPage: number;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  links: {
    self: string;
    next: string | null;
    prev: string | null;
    first: string;
    last: string;
  };
}

async function paginateOffset<T>(
  baseUrl: string,
  queryBuilder: SelectQueryBuilder<T>,
  params: OffsetPaginationParams,
): Promise<PaginatedResponse<T>> {
  const { page, perPage } = params;
  const offset = (page - 1) * perPage;

  // Execute both queries in parallel
  const [data, total] = await Promise.all([
    queryBuilder
      .clone()
      .limit(perPage)
      .offset(offset)
      .execute(),
    queryBuilder
      .clone()
      .count()
      .executeTakeFirstOrThrow(),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return {
    data,
    meta: {
      page,
      per_page: perPage,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
    links: {
      self: `${baseUrl}?page=${page}&per_page=${perPage}`,
      next: page < totalPages ? `${baseUrl}?page=${page + 1}&per_page=${perPage}` : null,
      prev: page > 1 ? `${baseUrl}?page=${page - 1}&per_page=${perPage}` : null,
      first: `${baseUrl}?page=1&per_page=${perPage}`,
      last: `${baseUrl}?page=${totalPages}&per_page=${perPage}`,
    },
  };
}
```

#### Python Implementation (FastAPI + SQLAlchemy)

```python
# services/pagination.py
from dataclasses import dataclass
from typing import TypeVar, Generic, Sequence
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")

@dataclass
class PaginationMeta:
    page: int
    per_page: int
    total: int
    total_pages: int
    has_next: bool
    has_prev: bool

@dataclass
class PaginatedResult(Generic[T]):
    data: Sequence[T]
    meta: PaginationMeta

async def paginate_offset(
    session: AsyncSession,
    query,
    page: int = 1,
    per_page: int = 20,
) -> PaginatedResult:
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar_one()

    # Fetch page
    offset = (page - 1) * per_page
    items = (
        await session.execute(
            query.limit(per_page).offset(offset)
        )
    ).scalars().all()

    total_pages = -(-total // per_page)  # ceiling division

    return PaginatedResult(
        data=items,
        meta=PaginationMeta(
            page=page,
            per_page=per_page,
            total=total,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1,
        ),
    )
```

#### Advantages of Offset-Based

- Simple to implement
- The client can jump to any page (jump to page 50)
- Easy UI rendering (page numbers)
- Total count gives the user context ("1000 results")

#### Disadvantages of Offset-Based — Page Drift Problem

**CRITICAL:** Offset pagination breaks when data changes between requests.

```
Scenario: User is on page 1, sees items 1-20

Before loading page 2:
  - Item 5 is deleted
  - Now items 1-19 become the "first 19"
  - Page 2 (OFFSET 20) starts from item 22
  - Item 21 is NEVER shown to the user (skipped!)

Conversely, if an INSERT happens:
  - A new item is inserted at position 3
  - Page 2 (OFFSET 20) shows item 20 again (duplicate!)
```

**SQL Performance Problem:**

```sql
-- Page 1: Fast
SELECT * FROM users ORDER BY id LIMIT 20 OFFSET 0;
-- DB reads 20 rows

-- Page 500: SLOW
SELECT * FROM users ORDER BY id LIMIT 20 OFFSET 9980;
-- DB reads 10,000 rows, discards the first 9,980, returns 20
-- O(offset + limit) complexity!
```

**Benchmark (PostgreSQL, 10M rows):**

| Page | Offset | Execution Time |
|------|--------|---------------|
| 1 | 0 | ~2ms |
| 100 | 1,980 | ~15ms |
| 1,000 | 19,980 | ~120ms |
| 10,000 | 199,980 | ~800ms |
| 100,000 | 1,999,980 | ~5,000ms |

---

### 2. Cursor-Based Pagination

Instead of "give me page N", it says "give me the items after THIS point." The cursor is an opaque token that encodes the position in the dataset.

#### Request Format

```http
# First page (no cursor)
GET /api/users?limit=20 HTTP/1.1

# Next page
GET /api/users?cursor=eyJpZCI6MjAsImNyZWF0ZWRfYXQiOiIyMDI1LTAzLTE1VDEwOjMwOjAwWiJ9&limit=20 HTTP/1.1
```

#### Response Format

```http
HTTP/1.1 200 OK
Content-Type: application/json
Link: <https://api.example.com/users?cursor=eyJpZCI6NDAsImNyZ...&limit=20>; rel="next"

{
  "data": [
    { "id": 21, "name": "User 21", "email": "user21@example.com" },
    { "id": 22, "name": "User 22", "email": "user22@example.com" }
  ],
  "meta": {
    "has_next": true,
    "has_prev": true,
    "next_cursor": "eyJpZCI6NDAsImNyZWF0ZWRfYXQiOiIyMDI1LTAzLTE1VDEwOjMwOjAwWiJ9",
    "prev_cursor": "eyJpZCI6MjEsImNyZWF0ZWRfYXQiOiIyMDI1LTAzLTE1VDEwOjMxOjAwWiJ9"
  }
}
```

**Note:** There is NO `total` count or `total_pages`. This is by design.

#### Opaque vs Transparent Cursors

| Type | Example | Advantages | Disadvantages |
|-------|------------|---------------|---------------|
| **Opaque (base64)** | `eyJpZCI6MjB9` | Client cannot tamper, versioning-friendly | Harder to debug |
| **Transparent** | `after_id=20` | Simple, readable | Client can go stale, breaking change risk |
| **Signed** | `eyJ...`.`hmac_sig` | Tamper-proof | More complex |

**Recommendation:** Opaque cursors (base64-encoded JSON). The client MUST treat them as opaque strings.

#### TypeScript Cursor Implementation

```typescript
// services/cursor-pagination.ts
interface CursorPaginationParams {
  cursor?: string;
  limit: number;
  direction?: 'forward' | 'backward';
}

interface CursorPaginatedResponse<T> {
  data: T[];
  meta: {
    has_next: boolean;
    has_prev: boolean;
    next_cursor: string | null;
    prev_cursor: string | null;
  };
}

// Cursor encoding/decoding
function encodeCursor(values: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(values)).toString('base64url');
}

function decodeCursor(cursor: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
  } catch {
    throw new AppError('INVALID_CURSOR', 400, 'Bad Request', 'Invalid pagination cursor.');
  }
}

async function paginateCursor<T extends { id: string; created_at: Date }>(
  queryBuilder: SelectQueryBuilder<T>,
  params: CursorPaginationParams,
): Promise<CursorPaginatedResponse<T>> {
  const { cursor, limit, direction = 'forward' } = params;

  let query = queryBuilder.clone();

  if (cursor) {
    const decoded = decodeCursor(cursor);
    const { id, created_at } = decoded as { id: string; created_at: string };

    if (direction === 'forward') {
      // Records AFTER this cursor
      query = query.where(({ or, and, cmpr }) =>
        or([
          cmpr('created_at', '<', created_at),
          and([
            cmpr('created_at', '=', created_at),
            cmpr('id', '<', id),
          ]),
        ])
      );
    } else {
      // Records BEFORE this cursor
      query = query.where(({ or, and, cmpr }) =>
        or([
          cmpr('created_at', '>', created_at),
          and([
            cmpr('created_at', '=', created_at),
            cmpr('id', '>', id),
          ]),
        ])
      );
    }
  }

  // Fetch limit + 1 to determine has_next
  const rows = await query
    .orderBy('created_at', direction === 'forward' ? 'desc' : 'asc')
    .orderBy('id', direction === 'forward' ? 'desc' : 'asc')
    .limit(limit + 1)
    .execute();

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  // Reverse if backward pagination
  if (direction === 'backward') {
    data.reverse();
  }

  const firstItem = data[0];
  const lastItem = data[data.length - 1];

  return {
    data,
    meta: {
      has_next: direction === 'forward' ? hasMore : true,
      has_prev: direction === 'forward' ? !!cursor : hasMore,
      next_cursor: lastItem
        ? encodeCursor({ id: lastItem.id, created_at: lastItem.created_at })
        : null,
      prev_cursor: firstItem
        ? encodeCursor({ id: firstItem.id, created_at: firstItem.created_at })
        : null,
    },
  };
}
```

#### Python Cursor Implementation

```python
# services/cursor_pagination.py
import base64
import json
from dataclasses import dataclass
from typing import TypeVar, Generic, Sequence, Any
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")

def encode_cursor(values: dict[str, Any]) -> str:
    """Encode cursor values to base64url string."""
    return base64.urlsafe_b64encode(
        json.dumps(values, default=str).encode()
    ).decode().rstrip("=")

def decode_cursor(cursor: str) -> dict[str, Any]:
    """Decode base64url cursor string to dict."""
    # Add back padding
    padding = 4 - len(cursor) % 4
    if padding != 4:
        cursor += "=" * padding
    try:
        return json.loads(base64.urlsafe_b64decode(cursor))
    except (ValueError, json.JSONDecodeError) as e:
        raise ValueError("Invalid cursor") from e

@dataclass
class CursorPage(Generic[T]):
    data: Sequence[T]
    has_next: bool
    has_prev: bool
    next_cursor: str | None
    prev_cursor: str | None

async def paginate_cursor(
    session: AsyncSession,
    model,
    base_query,
    *,
    cursor: str | None = None,
    limit: int = 20,
    sort_column="created_at",
    sort_direction="desc",
) -> CursorPage:
    query = base_query

    if cursor:
        decoded = decode_cursor(cursor)
        sort_val = decoded[sort_column]
        cursor_id = decoded["id"]

        if sort_direction == "desc":
            query = query.where(
                or_(
                    getattr(model, sort_column) < sort_val,
                    and_(
                        getattr(model, sort_column) == sort_val,
                        model.id < cursor_id,
                    ),
                )
            )
        else:
            query = query.where(
                or_(
                    getattr(model, sort_column) > sort_val,
                    and_(
                        getattr(model, sort_column) == sort_val,
                        model.id > cursor_id,
                    ),
                )
            )

    # Fetch limit + 1 to check for more
    order_fn = getattr(getattr(model, sort_column), sort_direction)
    rows = (
        await session.execute(
            query.order_by(order_fn(), model.id.desc())
            .limit(limit + 1)
        )
    ).scalars().all()

    has_more = len(rows) > limit
    data = rows[:limit] if has_more else rows

    last = data[-1] if data else None
    first = data[0] if data else None

    return CursorPage(
        data=data,
        has_next=has_more,
        has_prev=cursor is not None,
        next_cursor=(
            encode_cursor({"id": last.id, sort_column: getattr(last, sort_column)})
            if last and has_more
            else None
        ),
        prev_cursor=(
            encode_cursor({"id": first.id, sort_column: getattr(first, sort_column)})
            if first
            else None
        ),
    )
```

#### SQL Behind Cursor Pagination

```sql
-- First page: no cursor
SELECT id, name, created_at
FROM users
WHERE active = true
ORDER BY created_at DESC, id DESC
LIMIT 21;  -- limit + 1 to check has_next

-- Next page: cursor = {created_at: "2025-03-15T10:30:00Z", id: 42}
SELECT id, name, created_at
FROM users
WHERE active = true
  AND (
    created_at < '2025-03-15T10:30:00Z'
    OR (created_at = '2025-03-15T10:30:00Z' AND id < 42)
  )
ORDER BY created_at DESC, id DESC
LIMIT 21;

-- This uses the index (created_at DESC, id DESC) efficiently
-- NO OFFSET = O(limit) complexity regardless of position!
```

**Required index:**

```sql
CREATE INDEX idx_users_cursor ON users (created_at DESC, id DESC)
WHERE active = true;  -- partial index if filter is common
```

#### Advantages of Cursor-Based

- **Constant performance** — O(limit) regardless of position in dataset
- **No page drift** — No lost/duplicate records during mutations
- **Ideal for real-time data** — Feeds, timelines, chat messages
- **Works in distributed systems** — Does not depend on global offset

#### Disadvantages of Cursor-Based

- **Cannot "jump to page 50"** — Sequential traversal only
- **No total count** — The client does not know how many results exist (unless you run an extra query)
- **Complexity** — Cursor encoding/decoding, composite sort keys
- **Backward pagination is more complex** — Requires reverse order + reverse results

---

### 3. Keyset Pagination

A variant of cursor-based that uses transparent, human-readable keys instead of opaque tokens.

#### Request Format

```http
# First page
GET /api/users?limit=20 HTTP/1.1

# Next page — using the last item's values
GET /api/users?after_id=42&after_created_at=2025-03-15T10:30:00Z&limit=20 HTTP/1.1
```

#### Composite Key Implementation

```sql
-- Sort by multiple columns: created_at DESC, name ASC, id DESC
-- Keyset condition for "next page after" (created_at=X, name=Y, id=Z):

SELECT * FROM users
WHERE active = true
  AND (
    created_at < '2025-03-15T10:30:00Z'
    OR (created_at = '2025-03-15T10:30:00Z' AND name > 'John')
    OR (created_at = '2025-03-15T10:30:00Z' AND name = 'John' AND id < 42)
  )
ORDER BY created_at DESC, name ASC, id DESC
LIMIT 20;
```

**Recommendation:** For composite keys, use cursor-based (opaque) instead of keyset (transparent). The query parameters become too complex.

#### PostgreSQL Row Value Comparison (Cleaner)

```sql
-- PostgreSQL supports row value comparisons — MUCH cleaner
SELECT * FROM users
WHERE active = true
  AND (created_at, id) < ('2025-03-15T10:30:00Z', 42)
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- This is semantically identical to the OR-chain above
-- BUT: only works when ALL columns have the same sort direction
```

---

### 4. Total Count Performance Problem

`COUNT(*)` on large tables is **extremely slow** in many databases.

#### Benchmarks

```
PostgreSQL (InnoDB equivalent, MVCC):
  - 1K rows:   COUNT(*) ≈ 0.1ms
  - 100K rows:  COUNT(*) ≈ 5ms
  - 1M rows:   COUNT(*) ≈ 50ms
  - 10M rows:  COUNT(*) ≈ 400ms
  - 100M rows: COUNT(*) ≈ 4,000ms

MySQL (InnoDB):
  - Similar to PostgreSQL — full table scan for filtered COUNT(*)
  - Unfiltered COUNT(*) on InnoDB: still slow (MVCC)
  - Unfiltered COUNT(*) on MyISAM: instant (stored metadata)
```

#### Strategies

**Strategy 1: Do not provide total count**

```json
{
  "data": [...],
  "meta": {
    "has_next": true,
    "next_cursor": "abc123"
  }
}
```

Use `has_next` (fetch limit+1 items, if you get limit+1, has_next=true). Perfect for infinite scroll.

**Strategy 2: Approximate count**

```sql
-- PostgreSQL: fast approximate count from statistics
SELECT reltuples::bigint AS approximate_count
FROM pg_class
WHERE relname = 'users';

-- MySQL: fast approximate count
SELECT TABLE_ROWS
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME = 'users';
```

```json
{
  "meta": {
    "total": 1043289,
    "total_is_approximate": true
  }
}
```

**Strategy 3: Cached count**

```typescript
// Cache total count with TTL
async function getCachedCount(cacheKey: string, countFn: () => Promise<number>): Promise<number> {
  const cached = await redis.get(cacheKey);
  if (cached) return parseInt(cached, 10);

  const count = await countFn();
  await redis.setex(cacheKey, 60, count.toString()); // TTL 60s
  return count;
}
```

**Strategy 4: Optional count via query parameter**

```http
# Default: no count (fast)
GET /api/users?page=1&per_page=20

# Explicit request for count (slower)
GET /api/users?page=1&per_page=20&include_total=true
```

```typescript
// Controller
async function listUsers(req: Request, res: Response) {
  const includeTotal = req.query.include_total === 'true';
  const result = await paginate(query, {
    page: req.query.page,
    perPage: req.query.per_page,
    includeTotal, // skip COUNT(*) if false
  });
  res.json(result);
}
```

**Strategy 5: Count with upper bound cap**

```sql
-- Stop counting after 10,000 — "10,000+" is good enough for UI
SELECT COUNT(*) FROM (
  SELECT 1 FROM users WHERE active = true LIMIT 10001
) t;
```

---

### 5. Page Size Limits

```typescript
// validation/pagination.ts
const PAGINATION_DEFAULTS = {
  DEFAULT_PAGE_SIZE: 20,
  MIN_PAGE_SIZE: 1,
  MAX_PAGE_SIZE: 100,
  ABSOLUTE_MAX_PAGE_SIZE: 200, // admin endpoints only
} as const;

function validatePageSize(requested: number | undefined, isAdmin = false): number {
  const max = isAdmin
    ? PAGINATION_DEFAULTS.ABSOLUTE_MAX_PAGE_SIZE
    : PAGINATION_DEFAULTS.MAX_PAGE_SIZE;

  if (!requested) return PAGINATION_DEFAULTS.DEFAULT_PAGE_SIZE;
  if (requested < PAGINATION_DEFAULTS.MIN_PAGE_SIZE) return PAGINATION_DEFAULTS.MIN_PAGE_SIZE;
  if (requested > max) return max; // Cap silently, or return 422
  return requested;
}
```

**Rules:**
- Default: **20** (industry standard — GitHub, Stripe, Slack)
- Maximum: **100** (industry standard)
- Minimum: **1**
- Document the limits in API docs
- If the client requests per_page > max, EITHER cap silently OR return 422

---

### 6. RFC 8288 Link Headers

RFC 8288 defines the `Link` HTTP header for expressing relationships between resources. Standard pagination relations:

```http
Link: <https://api.example.com/users?page=3&per_page=20>; rel="next",
      <https://api.example.com/users?page=1&per_page=20>; rel="prev",
      <https://api.example.com/users?page=1&per_page=20>; rel="first",
      <https://api.example.com/users?page=50&per_page=20>; rel="last"
```

For cursor-based:

```http
Link: <https://api.example.com/users?cursor=abc123&limit=20>; rel="next",
      <https://api.example.com/users?cursor=xyz789&limit=20>; rel="prev"
```

#### TypeScript Link Header Builder

```typescript
function buildLinkHeader(links: Record<string, string | null>): string {
  return Object.entries(links)
    .filter(([, url]) => url !== null)
    .map(([rel, url]) => `<${url}>; rel="${rel}"`)
    .join(', ');
}

// Usage
res.set('Link', buildLinkHeader({
  next: nextUrl,
  prev: prevUrl,
  first: firstUrl,
  last: lastUrl,
}));
```

#### Link Header Parsing (Client-side)

```typescript
// Client-side link header parser
function parseLinkHeader(header: string): Record<string, string> {
  const links: Record<string, string> = {};
  const parts = header.split(',');

  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      links[match[2]] = match[1];
    }
  }

  return links;
}

// Usage
const response = await fetch('/api/users?page=2&per_page=20');
const linkHeader = response.headers.get('Link');
if (linkHeader) {
  const links = parseLinkHeader(linkHeader);
  console.log(links.next); // "https://api.example.com/users?page=3&per_page=20"
}
```

**Recommendation:** Send pagination info BOTH in the Link header AND in the response body. The Link header is standard, the body is more convenient.

---

### 7. Sorting + Pagination Interaction

**CRITICAL:** The sort MUST be **deterministic** (stable). If two records have the same value in the sort field, their order is undefined — they may appear on different pages depending on the DB mood.

**Fix:** ALWAYS add a unique tiebreaker (e.g., `id`) to the ORDER BY.

```sql
-- BAD: non-deterministic
SELECT * FROM users ORDER BY name LIMIT 20 OFFSET 0;
-- If 5 users are named "John", which ones will appear on which page?

-- GOOD: deterministic with tiebreaker
SELECT * FROM users ORDER BY name ASC, id ASC LIMIT 20 OFFSET 0;
-- Now even if name="John" for 5, their order is determined by id
```

#### Sort Parameter Format

```http
# Single sort
GET /api/users?sort=created_at&order=desc

# Multiple sorts (comma-separated)
GET /api/users?sort=name,-created_at
# name ASC, created_at DESC (prefix "-" = descending)

# Alternative: sort[field]=direction
GET /api/users?sort[name]=asc&sort[created_at]=desc
```

**Recommendation:** Use prefix `-` for descending (JSON:API spec convention):

```typescript
function parseSortParam(sort: string): Array<{ field: string; direction: 'asc' | 'desc' }> {
  return sort.split(',').map(s => {
    const trimmed = s.trim();
    if (trimmed.startsWith('-')) {
      return { field: trimmed.slice(1), direction: 'desc' };
    }
    return { field: trimmed, direction: 'asc' };
  });
}

// Whitelist allowed sort fields to prevent SQL injection
const ALLOWED_SORT_FIELDS = new Set(['name', 'created_at', 'email', 'updated_at']);

function validateSortFields(fields: Array<{ field: string; direction: string }>): void {
  for (const { field } of fields) {
    if (!ALLOWED_SORT_FIELDS.has(field)) {
      throw new AppError('VALIDATION_ERROR', 422, 'Validation Error',
        `Invalid sort field: ${field}. Allowed: ${[...ALLOWED_SORT_FIELDS].join(', ')}`);
    }
  }
}
```

---

### 8. Filtering + Pagination

**Rule: ALWAYS filter BEFORE paginating.** Pagination is applied to the filtered results.

```http
GET /api/users?status=active&role=admin&page=1&per_page=20 HTTP/1.1
```

```sql
-- Filter first, then paginate
SELECT * FROM users
WHERE status = 'active'
  AND role = 'admin'
ORDER BY created_at DESC, id DESC
LIMIT 20 OFFSET 0;

-- Count is on filtered results
SELECT COUNT(*) FROM users
WHERE status = 'active'
  AND role = 'admin';
```

**IMPORTANT for cursor pagination:** If filters change between requests, the cursor becomes invalid. The client MUST restart pagination from scratch if filters change.

```typescript
// Encode filters in cursor to detect changes
function encodeCursorWithFilters(
  values: Record<string, unknown>,
  filters: Record<string, unknown>
): string {
  const filterHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(filters))
    .digest('hex')
    .slice(0, 8);

  return encodeCursor({ ...values, _fh: filterHash });
}

function decodeCursorAndValidateFilters(
  cursor: string,
  currentFilters: Record<string, unknown>
): Record<string, unknown> {
  const decoded = decodeCursor(cursor);
  const currentHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(currentFilters))
    .digest('hex')
    .slice(0, 8);

  if (decoded._fh !== currentHash) {
    throw new AppError('INVALID_CURSOR', 400, 'Bad Request',
      'Filters changed since cursor was created. Start pagination from the beginning.');
  }

  const { _fh, ...values } = decoded;
  return values;
}
```

---

### 9. Backward Pagination (Previous Page with Cursors)

```http
# Forward (next page)
GET /api/users?cursor=abc123&limit=20&direction=forward HTTP/1.1

# Backward (previous page)
GET /api/users?cursor=xyz789&limit=20&direction=backward HTTP/1.1
```

```sql
-- Forward: items AFTER cursor, ordered DESC
SELECT * FROM users
WHERE (created_at, id) < ('2025-03-15', 42)
ORDER BY created_at DESC, id DESC
LIMIT 21;

-- Backward: items BEFORE cursor, ordered ASC (reversed)
SELECT * FROM (
  SELECT * FROM users
  WHERE (created_at, id) > ('2025-03-10', 21)
  ORDER BY created_at ASC, id ASC
  LIMIT 21
) sub
ORDER BY created_at DESC, id DESC;
-- Fetch in ASC, then reverse to maintain DESC display order
```

---

### 10. Pagination in Nested Resources

```http
# Parent with paginated children
GET /api/orders/123/items?page=1&per_page=10 HTTP/1.1

# Alternative: include paginated children in parent response
GET /api/orders/123?include=items&items.page=1&items.per_page=10 HTTP/1.1
```

```json
{
  "id": 123,
  "status": "shipped",
  "items": {
    "data": [
      { "id": 1, "product": "Widget A", "quantity": 2 },
      { "id": 2, "product": "Widget B", "quantity": 1 }
    ],
    "meta": {
      "page": 1,
      "per_page": 10,
      "total": 25,
      "has_next": true
    }
  }
}
```

**Rule:** Pagination of nested resources MUST be done via a separate endpoint (`/orders/123/items?page=2`), NOT via query params on the parent. Otherwise the URLs become unmanageable.

---

### 11. Infinite Scroll Support Patterns

Cursor-based pagination is ideal for infinite scroll. Patterns:

```typescript
// Client-side infinite scroll with cursor pagination
class InfiniteScroller {
  private nextCursor: string | null = null;
  private isLoading = false;
  private hasMore = true;

  async loadMore(): Promise<void> {
    if (this.isLoading || !this.hasMore) return;
    this.isLoading = true;

    try {
      const params = new URLSearchParams({ limit: '20' });
      if (this.nextCursor) params.set('cursor', this.nextCursor);

      const response = await fetch(`/api/feed?${params}`);
      const result = await response.json();

      this.appendItems(result.data);
      this.nextCursor = result.meta.next_cursor;
      this.hasMore = result.meta.has_next;
    } finally {
      this.isLoading = false;
    }
  }

  // Intersection Observer for auto-loading
  setupObserver(sentinelElement: HTMLElement): void {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          this.loadMore();
        }
      },
      { rootMargin: '200px' } // Pre-load 200px before visible
    );
    observer.observe(sentinelElement);
  }
}
```

---

### 12. Pagination in GraphQL vs REST

#### GraphQL: Relay Cursor Connection Spec

```graphql
type Query {
  users(
    first: Int
    after: String
    last: Int
    before: String
    filter: UserFilter
  ): UserConnection!
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

```graphql
# Query
query {
  users(first: 20, after: "abc123") {
    edges {
      node {
        id
        name
        email
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

**Comparison:**

| Aspect | REST | GraphQL (Relay) |
|-------|------|-----------------|
| Specification | No standard (conventions) | Relay Connection Spec |
| Cursor location | Response meta/headers | Per-edge cursor |
| Total count | Optional in meta | `totalCount` field |
| Bi-directional | `direction` param | `first/after` + `last/before` |
| Nested pagination | Separate endpoint | Inline in query |

---

### 13. Performance Comparison

#### Benchmark Setup: PostgreSQL 15, 10M rows, indexed

| Method | Page 1 | Page 100 | Page 10,000 | Page 100,000 |
|--------|--------|----------|-------------|--------------|
| **Offset** | 2ms | 15ms | 800ms | 5,000ms |
| **Cursor** | 2ms | 2ms | 2ms | 2ms |
| **Keyset** | 2ms | 2ms | 2ms | 2ms |
| **+COUNT(*)** | +400ms | +400ms | +400ms | +400ms |

**Conclusion:** Cursor/keyset is **O(limit)** constant time. Offset is **O(offset + limit)** linear degradation.

```sql
-- EXPLAIN ANALYZE comparison (10M rows)

-- Offset: Page 100,000
EXPLAIN ANALYZE
SELECT * FROM events ORDER BY created_at DESC, id DESC
LIMIT 20 OFFSET 1999980;
-- Execution Time: 4,823ms
-- Seq Scan on events (rows examined: 2,000,000)

-- Cursor: Same logical position
EXPLAIN ANALYZE
SELECT * FROM events
WHERE (created_at, id) < ('2020-01-15', 42)
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- Execution Time: 0.8ms
-- Index Scan using idx_events_cursor (rows examined: 20)
```

---

### 14. OpenAPI Pagination Schema Definitions

```yaml
# openapi.yaml
components:
  parameters:
    PageParam:
      name: page
      in: query
      schema:
        type: integer
        minimum: 1
        default: 1
      description: Page number (1-indexed)

    PerPageParam:
      name: per_page
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20
      description: Number of items per page (max 100)

    CursorParam:
      name: cursor
      in: query
      schema:
        type: string
      description: Opaque pagination cursor from a previous response

    LimitParam:
      name: limit
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20
      description: Maximum number of items to return

    SortParam:
      name: sort
      in: query
      schema:
        type: string
        default: "-created_at"
      description: |
        Comma-separated sort fields. Prefix with `-` for descending.
        Example: `name,-created_at`

  schemas:
    OffsetPaginationMeta:
      type: object
      properties:
        page:
          type: integer
          example: 2
        per_page:
          type: integer
          example: 20
        total:
          type: integer
          example: 1000
        total_pages:
          type: integer
          example: 50
        has_next:
          type: boolean
          example: true
        has_prev:
          type: boolean
          example: true

    CursorPaginationMeta:
      type: object
      properties:
        has_next:
          type: boolean
          example: true
        has_prev:
          type: boolean
          example: true
        next_cursor:
          type: string
          nullable: true
          example: "eyJpZCI6NDJ9"
        prev_cursor:
          type: string
          nullable: true
          example: "eyJpZCI6MjF9"

    PaginationLinks:
      type: object
      properties:
        self:
          type: string
          format: uri
        next:
          type: string
          format: uri
          nullable: true
        prev:
          type: string
          format: uri
          nullable: true
        first:
          type: string
          format: uri
        last:
          type: string
          format: uri
          nullable: true

# Usage in paths
paths:
  /users:
    get:
      parameters:
        - $ref: '#/components/parameters/PageParam'
        - $ref: '#/components/parameters/PerPageParam'
        - $ref: '#/components/parameters/SortParam'
      responses:
        '200':
          description: Paginated list of users
          headers:
            Link:
              schema:
                type: string
              description: RFC 8288 pagination links
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
                  meta:
                    $ref: '#/components/schemas/OffsetPaginationMeta'
                  links:
                    $ref: '#/components/schemas/PaginationLinks'
```

---

## Best Practices

1. **Use cursor-based pagination** as the default for new APIs — offset only if you need "jump to page"
2. **ALWAYS use deterministic sort** — add `id` as a tiebreaker to the ORDER BY
3. **ALWAYS set page size limits** — default 20, max 100
4. **ALWAYS include Link headers** (RFC 8288) AND pagination info in the body
5. **Do not provide total count by default** — make it opt-in via `?include_total=true` or use approximate count
6. **Opaque cursors** — base64url-encoded JSON, the client MUST treat them as opaque strings
7. **Fetch limit+1** instead of a separate COUNT query for `has_next`
8. **Filter BEFORE paginating** — ALWAYS
9. **Cursor invalidation** — if filters/sort change, the cursor is no longer valid
10. **Document page size limits** — in the OpenAPI spec and API docs
11. **Return empty array, not error** if there are no results: `{ "data": [], "meta": { "total": 0 } }`
12. **NEVER allow unbounded queries** — always enforce max limit even if the client does not send page params

---

## Anti-patterns / Common Mistakes

1. **Offset pagination on large datasets** — Page 10,000 on a table with 10M rows = 5+ seconds query
2. **Non-deterministic sort** — `ORDER BY created_at` without tiebreaker = random order on ties = duplicate/missing records
3. **Total count on every request** — COUNT(*) on 10M rows = 400ms overhead on EVERY paginated request
4. **Unbounded page size** — `?per_page=1000000` = out of memory / timeout
5. **No pagination at all** — `GET /users` returns 10M records
6. **Returning `null` instead of empty array** — `{ "data": null }` instead of `{ "data": [] }` — breaks client iteration
7. **Changing cursor format without versioning** — Breaks existing clients
8. **Non-URL-safe cursors** — Use `base64url` (RFC 4648), NOT standard `base64` (contains `+`, `/`, `=`)
9. **Exposing internal IDs in transparent cursors** — Security: attacker can enumerate
10. **Mixing offset and cursor params** — `?page=2&cursor=abc` — mutually exclusive
11. **1-indexed vs 0-indexed confusion** — Pick one (1-indexed is standard for pages), document it
12. **Pagination inside POST body** — Pagination params should be query parameters, not body
13. **Ignoring sort direction in cursor** — If the sort changes, the cursor gives wrong results

---

## Real-world Examples

### GitHub API Pagination (Offset + Link Header)

```http
GET https://api.github.com/repos/facebook/react/issues?page=2&per_page=30
Authorization: Bearer ghp_xxxx

HTTP/1.1 200 OK
Link: <https://api.github.com/repos/facebook/react/issues?page=3&per_page=30>; rel="next",
      <https://api.github.com/repos/facebook/react/issues?page=167>; rel="last",
      <https://api.github.com/repos/facebook/react/issues?page=1&per_page=30>; rel="first",
      <https://api.github.com/repos/facebook/react/issues?page=1&per_page=30>; rel="prev"
```

- Default page size: 30
- Max page size: 100
- Uses Link headers (no body pagination meta)
- 1-indexed pages

### Stripe API Pagination (Cursor-based)

```http
GET https://api.stripe.com/v1/customers?limit=10&starting_after=cus_abc123
Authorization: Bearer sk_test_xxxx

HTTP/1.1 200 OK
{
  "object": "list",
  "url": "/v1/customers",
  "has_more": true,
  "data": [
    { "id": "cus_def456", "name": "John Doe", ... },
    { "id": "cus_ghi789", "name": "Jane Doe", ... }
  ]
}
```

- Uses `starting_after` (forward) and `ending_before` (backward)
- Cursor is the `id` of the last/first item (transparent)
- `has_more` boolean instead of `next_cursor`
- Default limit: 10, Max limit: 100
- No total count

### Slack API Pagination (Cursor-based)

```http
GET https://slack.com/api/conversations.list?cursor=dXNlcjpVMDYxTkZUVDI&limit=20
Authorization: Bearer xoxb-xxxx

HTTP/1.1 200 OK
{
  "ok": true,
  "channels": [...],
  "response_metadata": {
    "next_cursor": "dGVhbTpDMDYxRkRVUDAw"
  }
}
```

- Cursor in `response_metadata.next_cursor`
- Empty string `""` means no more pages
- Default limit: 100, Max limit: 1000
- Opaque base64 cursors

### Twitter/X API v2 Pagination (Cursor-based)

```http
GET https://api.twitter.com/2/tweets/search/recent?query=from:elonmusk&max_results=10&pagination_token=abc123

HTTP/1.1 200 OK
{
  "data": [...],
  "meta": {
    "newest_id": "1234567890",
    "oldest_id": "1234567880",
    "result_count": 10,
    "next_token": "def456"
  }
}
```

- Uses `next_token` / `pagination_token`
- `result_count` in meta (not total, just current page count)
- Max results: 100

---

## Sources

- [RFC 8288 — Web Linking](https://www.rfc-editor.org/rfc/rfc8288) (Link headers)
- [RFC 4648 — Base Encodings](https://www.rfc-editor.org/rfc/rfc4648) (base64url for cursors)
- [Relay Cursor Connections Specification](https://relay.dev/graphql/connections.htm)
- [Stripe API Pagination](https://stripe.com/docs/api/pagination)
- [GitHub API Pagination](https://docs.github.com/en/rest/guides/using-pagination-in-the-rest-api)
- [Slack API Pagination](https://api.slack.com/docs/pagination)
- [JSON:API Specification — Pagination](https://jsonapi.org/format/#fetching-pagination)
- [Use The Index, Luke — Pagination Done The Right Way](https://use-the-index-luke.com/no-offset)
- [Zalando RESTful API Guidelines — Pagination](https://opensource.zalando.com/restful-api-guidelines/#pagination)
- [Google Cloud API Design Guide — List Pagination](https://cloud.google.com/apis/design/design_patterns#list_pagination)
- [Microsoft REST API Guidelines — Collections](https://github.com/microsoft/api-guidelines/blob/vNext/Guidelines.md)
- [Markus Winand — "We need tool support for keyset pagination"](https://use-the-index-luke.com/blog/2019-04/we-need-tool-support-for-keyset-pagination)
