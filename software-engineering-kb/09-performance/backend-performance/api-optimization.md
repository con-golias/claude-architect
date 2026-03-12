# API Optimization

> **Domain:** Performance > Backend Performance > API Optimization
> **Importance:** High
> **Last Updated:** 2026-03-10

## Core Concepts

API performance directly impacts user experience and infrastructure costs. Every unnecessary byte transferred, every redundant query executed, and every unneeded field serialized wastes compute, bandwidth, and latency.

```
API Response Time Budget (p95):
┌─────────────────────────────────────────────┐
│ Component           │ Budget  │ Typical      │
├─────────────────────┼─────────┼──────────────┤
│ Network (client→LB) │ 20ms   │ 10-50ms      │
│ TLS handshake       │ 0ms    │ keep-alive    │
│ Load balancer       │ 2ms    │ 1-5ms        │
│ App processing      │ 30ms   │ 10-100ms     │
│ DB queries          │ 20ms   │ 5-50ms       │
│ Serialization       │ 5ms    │ 2-20ms       │
│ Compression         │ 3ms    │ 1-10ms       │
│ Network (LB→client) │ 20ms   │ 10-50ms      │
├─────────────────────┼─────────┼──────────────┤
│ Total target        │ 100ms  │              │
└─────────────────────┴─────────┴──────────────┘
```

---

## Response Payload Optimization

### Field Selection (Sparse Fieldsets)

```typescript
// TypeScript: field selection reduces payload by 60-90%
// GET /api/users?fields=id,name,email

import { Request, Response } from 'express';

function selectFields<T extends Record<string, unknown>>(
  data: T,
  fields: string[] | undefined,
): Partial<T> {
  if (!fields || fields.length === 0) return data;
  const result: Partial<T> = {};
  for (const field of fields) {
    if (field in data) {
      (result as any)[field] = data[field];
    }
  }
  return result;
}

app.get('/api/users', async (req: Request, res: Response) => {
  const fields = (req.query.fields as string)?.split(',');
  const users = await db.query('SELECT * FROM users LIMIT 100');
  // Full response: ~2KB per user → with fields=id,name: ~100B per user
  res.json(users.map(u => selectFields(u, fields)));
});
```

```go
// Go: field selection with struct tags and reflection (or manual)
// Faster approach: select only needed columns from DB
func GetUsers(w http.ResponseWriter, r *http.Request) {
    fields := r.URL.Query().Get("fields") // "id,name,email"
    columns := "id, name, email, avatar, bio, created_at" // default: all
    if fields != "" {
        // Validate against allowed fields to prevent SQL injection
        columns = validateAndBuildColumns(fields, allowedUserFields)
    }
    query := fmt.Sprintf("SELECT %s FROM users LIMIT 100", columns)
    // Fetch only requested columns — less DB I/O, less serialization
    rows, err := db.QueryContext(r.Context(), query)
    // ...
}
```

---

## Pagination Strategies

```
Comparison:
┌─────────────┬──────────────┬───────────────┬──────────────────┐
│ Strategy     │ Consistency  │ Performance   │ Use Case          │
├─────────────┼──────────────┼───────────────┼──────────────────┤
│ Offset/Limit│ Inconsistent │ O(offset) !   │ Simple UI tables  │
│ Cursor-based│ Consistent   │ O(1)          │ Infinite scroll   │
│ Keyset      │ Consistent   │ O(1)          │ Large datasets    │
└─────────────┴──────────────┴───────────────┴──────────────────┘
```

```typescript
// BAD: offset pagination — degrades at depth (OFFSET 100000 scans 100K rows)
app.get('/api/posts', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = (page - 1) * limit;
  const posts = await db.query(
    'SELECT * FROM posts ORDER BY created_at DESC OFFSET $1 LIMIT $2',
    [offset, limit], // OFFSET 100000 → scans 100K rows then discards them
  );
  res.json({ data: posts, page, limit });
});

// GOOD: cursor-based pagination — constant performance regardless of depth
app.get('/api/posts', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const cursor = req.query.cursor as string | undefined;

  let query = 'SELECT * FROM posts';
  const params: any[] = [limit + 1]; // fetch one extra to detect hasMore

  if (cursor) {
    const { id, createdAt } = decodeCursor(cursor);
    query += ' WHERE (created_at, id) < ($2, $3)';
    params.push(createdAt, id);
  }
  query += ' ORDER BY created_at DESC, id DESC LIMIT $1';

  const posts = await db.query(query, params);
  const hasMore = posts.length > limit;
  if (hasMore) posts.pop();

  const nextCursor = hasMore
    ? encodeCursor({ id: posts[posts.length - 1].id, createdAt: posts[posts.length - 1].created_at })
    : null;

  res.json({ data: posts, nextCursor });
});

function encodeCursor(data: { id: string; createdAt: string }): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}
function decodeCursor(cursor: string): { id: string; createdAt: string } {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString());
}
```

---

## Batch APIs

```typescript
// Batch endpoint: single request for multiple operations
// POST /api/batch
// Body: [{ method: "GET", path: "/users/1" }, { method: "GET", path: "/users/2" }]

interface BatchRequest {
  method: string;
  path: string;
  body?: unknown;
}

interface BatchResponse {
  status: number;
  body: unknown;
}

app.post('/api/batch', async (req: Request, res: Response) => {
  const requests: BatchRequest[] = req.body;
  if (requests.length > 20) {
    return res.status(400).json({ error: 'Max 20 operations per batch' });
  }

  const responses: BatchResponse[] = await Promise.all(
    requests.map(async (r) => {
      try {
        const result = await routeInternal(r.method, r.path, r.body);
        return { status: 200, body: result };
      } catch (err: any) {
        return { status: err.status || 500, body: { error: err.message } };
      }
    }),
  );
  res.json(responses);
});
// 20 individual requests: 20 round trips × 50ms = 1000ms
// 1 batch request: 1 round trip × 50ms + processing = ~100ms
```

---

## GraphQL DataLoader

```typescript
// DataLoader solves N+1 problem in GraphQL resolvers
import DataLoader from 'dataloader';

// Without DataLoader: N+1 queries
// Query { users { posts { author { name } } } }
// → 1 query for users + N queries for posts + N queries for authors

// With DataLoader: batched into 3 queries total
const userLoader = new DataLoader<string, User>(async (ids) => {
  const users = await db.query(
    'SELECT * FROM users WHERE id = ANY($1)',
    [ids],
  );
  // MUST return results in same order as input ids
  const userMap = new Map(users.map(u => [u.id, u]));
  return ids.map(id => userMap.get(id) || new Error(`User ${id} not found`));
});

// Resolver
const resolvers = {
  Post: {
    author: (post: Post) => userLoader.load(post.authorId),
    // Multiple calls within same tick are batched into single DB query
  },
};

// CRITICAL: create new DataLoader per request to avoid cross-request caching
app.use((req, res, next) => {
  req.loaders = {
    user: new DataLoader(batchGetUsers),
    post: new DataLoader(batchGetPosts),
  };
  next();
});
```

---

## ETag / Conditional Requests

```typescript
// ETag: avoid sending unchanged data — saves bandwidth
import { createHash } from 'crypto';

app.get('/api/products/:id', async (req, res) => {
  const product = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  const body = JSON.stringify(product);
  const etag = `"${createHash('md5').update(body).digest('hex')}"`;

  // If client has current version, return 304 (no body)
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end(); // 0 bytes transferred
  }

  res.set('ETag', etag);
  res.set('Cache-Control', 'private, max-age=0, must-revalidate');
  res.json(product); // full response only if changed
});

// For collections: use Last-Modified header
app.get('/api/products', async (req, res) => {
  const lastModified = await db.query(
    'SELECT MAX(updated_at) as last_update FROM products',
  );
  const ifModifiedSince = req.headers['if-modified-since'];

  if (ifModifiedSince && new Date(ifModifiedSince) >= lastModified) {
    return res.status(304).end();
  }

  const products = await db.query('SELECT * FROM products');
  res.set('Last-Modified', lastModified.toUTCString());
  res.json(products);
});
```

---

## Partial Responses (Range Requests)

```go
// Go: support range requests for large responses
func HandleLargeExport(w http.ResponseWriter, r *http.Request) {
    // http.ServeContent handles Range header automatically
    data := generateExport()
    reader := bytes.NewReader(data)
    http.ServeContent(w, r, "export.json", time.Now(), reader)
    // Client sends: Range: bytes=0-1023
    // Server responds: 206 Partial Content + Content-Range: bytes 0-1023/50000
}
```

---

## API Response Compression

```typescript
// Express.js compression middleware (see response-compression.md for details)
import compression from 'compression';

app.use(compression({
  filter: (req, res) => {
    // Only compress text-based responses
    const contentType = res.getHeader('Content-Type') as string;
    return /json|text|javascript|css|xml|html/.test(contentType);
  },
  threshold: 1024,  // don't compress responses < 1KB
  level: 4,         // balanced speed/ratio (1=fast, 9=max compression)
}));
```

---

## Response Serialization Performance

```go
// Go: fast JSON serialization with sonic or json-iterator
import jsoniter "github.com/json-iterator/go"

var json = jsoniter.ConfigFastest // 3-5x faster than encoding/json

func WriteJSON(w http.ResponseWriter, data any) {
    w.Header().Set("Content-Type", "application/json")
    stream := json.BorrowStream(w) // streaming serialization, no buffer copy
    defer json.ReturnStream(stream)
    stream.WriteVal(data)
    stream.Flush()
}
```

```typescript
// Node.js: streaming JSON for large arrays (avoid building full string)
import { Readable } from 'stream';

app.get('/api/export', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.write('[');

  let first = true;
  const cursor = db.queryCursor('SELECT * FROM events');

  for await (const row of cursor) {
    if (!first) res.write(',');
    first = false;
    res.write(JSON.stringify(row));
  }

  res.write(']');
  res.end();
  // Streams rows as they're fetched — constant memory regardless of dataset size
});
```

---

## Best Practices

1. **ALWAYS implement field selection** — let clients request only needed fields, reducing payload by 60-90%
2. **ALWAYS use cursor-based pagination** for large datasets — offset pagination degrades at O(offset)
3. **ALWAYS implement ETags** on frequently-read, rarely-changed resources — saves bandwidth on 304s
4. **ALWAYS use DataLoader pattern** in GraphQL resolvers — eliminates N+1 queries automatically
5. **ALWAYS set response size limits** — max page size, max batch size, max field count
6. **Provide batch endpoints** for operations clients commonly do in sequence — reduces round trips by 10-20x
7. **Stream large responses** instead of buffering — constant memory, faster time-to-first-byte
8. **Use fast serializers** (sonic, json-iterator, simdjson) — 2-5x faster than standard library
9. **Compress responses** above 1KB threshold — 60-80% bandwidth savings for JSON
10. **Profile serialization cost** — for hot endpoints, serialization can be 30-50% of total response time

---

## Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| Returning all fields always | 10KB responses when client needs 200B | Field selection / sparse fieldsets |
| Offset pagination on large tables | Timeout at page 5000, full table scan | Cursor/keyset pagination |
| N+1 queries in GraphQL | 100 DB queries for 1 GraphQL query | DataLoader batching |
| No compression on API responses | High bandwidth costs, slow mobile clients | gzip/brotli compression middleware |
| Building full response in memory | OOM on large exports | Streaming serialization |
| No conditional requests (ETag) | Redundant data transfer on every poll | ETag + If-None-Match → 304 |
| Unbounded list endpoints | Client fetches 100K rows, OOM | Mandatory pagination with max limit |
| Serializing with reflection in hot paths | CPU bottleneck on serialization | Code-generated or optimized serializers |

---

## Enforcement Checklist

- [ ] Field selection supported on list endpoints
- [ ] Cursor-based pagination used for all list endpoints
- [ ] Maximum page size enforced (e.g., 100)
- [ ] ETags implemented on frequently-read resources
- [ ] DataLoader used in GraphQL resolvers
- [ ] Batch API available for multi-operation flows
- [ ] Response compression enabled for text-based content > 1KB
- [ ] Large exports use streaming serialization
- [ ] API response time budget defined and monitored (p50, p95, p99)
- [ ] Serialization performance benchmarked for high-traffic endpoints
