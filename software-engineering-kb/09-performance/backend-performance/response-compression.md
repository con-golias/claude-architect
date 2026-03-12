# Response Compression

> **Domain:** Performance > Backend Performance > Response Compression
> **Importance:** High
> **Last Updated:** 2026-03-10

## Core Concepts

Compression reduces response payload size by 60-90% for text-based content (JSON, HTML, CSS, JS). This directly reduces bandwidth costs, improves latency on slow networks, and reduces time-to-interactive for web applications.

```
Compression Algorithm Comparison:
┌────────────┬──────────┬────────────┬───────────┬────────────────────┐
│ Algorithm   │ Ratio    │ Compress   │ Decompress│ Best For           │
├────────────┼──────────┼────────────┼───────────┼────────────────────┤
│ gzip (zlib) │ 70-80%  │ ~150 MB/s  │ ~400 MB/s │ Universal compat   │
│ Brotli      │ 75-85%  │ ~30 MB/s*  │ ~400 MB/s │ Static assets, web │
│ Zstandard   │ 75-85%  │ ~500 MB/s  │ ~1500MB/s │ API, logs, internal│
│ Deflate     │ 65-75%  │ ~200 MB/s  │ ~400 MB/s │ Legacy systems     │
│ LZ4         │ 50-60%  │ ~3000MB/s  │ ~5000MB/s │ Real-time, logging │
│ Snappy      │ 50-60%  │ ~2500MB/s  │ ~3000MB/s │ Internal, RPC      │
└────────────┴──────────┴────────────┴───────────┴────────────────────┘
* Brotli level 4-6. Level 11 is ~5 MB/s (offline only).
  Ratio = size reduction from original. Higher = better.
  Speed at default compression levels on modern hardware.
```

```
Decision Matrix:
┌─────────────────────────┬────────────────────────────────────┐
│ Scenario                 │ Algorithm + Level                   │
├─────────────────────────┼────────────────────────────────────┤
│ Static assets (CDN)      │ Brotli 11 (pre-compressed)         │
│ Dynamic API responses    │ gzip 4-6 or Zstd 3                │
│ Internal service calls   │ Zstd 1-3 or LZ4                   │
│ Log shipping             │ Zstd 3 or LZ4                     │
│ Real-time streaming      │ LZ4 or no compression             │
│ Mobile API (slow network)│ Brotli 4-6                        │
│ Legacy browser support   │ gzip 6                            │
└─────────────────────────┴────────────────────────────────────┘
```

---

## Compression Level Tuning

```
Compression Level vs Speed Trade-off (gzip):
Level │ Ratio │ Speed    │ Use Case
──────┼───────┼──────────┼─────────────────────
  1   │ 60%  │ 300 MB/s │ Real-time, high throughput
  4   │ 72%  │ 180 MB/s │ Dynamic API (recommended default)
  6   │ 76%  │ 100 MB/s │ Default gzip level
  9   │ 78%  │ 30 MB/s  │ Pre-compression only (+2% over 6, 3x slower)

Compression Level vs Speed Trade-off (Brotli):
Level │ Ratio │ Speed    │ Use Case
──────┼───────┼──────────┼─────────────────────
  1   │ 65%  │ 200 MB/s │ Real-time responses
  4   │ 78%  │ 80 MB/s  │ Dynamic API responses
  6   │ 82%  │ 30 MB/s  │ Important dynamic content
 11   │ 86%  │ 5 MB/s   │ Static assets only (pre-compress at build)

Key insight: Going from level 4→9 gains 3-5% more compression
             but costs 3-6x more CPU. Almost never worth it for
             dynamic content. Pre-compress static assets at max level.
```

---

## Content-Type Based Decisions

```typescript
// Node.js Express: content-aware compression
import compression from 'compression';
import zlib from 'zlib';

app.use(compression({
  // Only compress compressible content types
  filter: (req, res) => {
    const contentType = res.getHeader('Content-Type') as string || '';
    // Already-compressed formats: images, video, archives
    if (/image|video|audio|zip|gzip|br|zstd/.test(contentType)) {
      return false; // skip — already compressed, re-compression wastes CPU
    }
    // Compress text-based content
    return /json|text|javascript|css|xml|html|svg|font/.test(contentType);
  },
  threshold: 1024,    // skip responses < 1KB (overhead exceeds benefit)
  level: 4,           // gzip level 4: good balance for dynamic content
}));
```

```
Content-Type Compression Guide:
┌───────────────────────────┬────────────┬────────────────────┐
│ Content-Type               │ Compress?  │ Typical Savings    │
├───────────────────────────┼────────────┼────────────────────┤
│ application/json           │ YES        │ 70-90%             │
│ text/html                  │ YES        │ 60-80%             │
│ text/css                   │ YES        │ 70-85%             │
│ application/javascript     │ YES        │ 65-80%             │
│ image/svg+xml              │ YES        │ 50-70%             │
│ text/csv                   │ YES        │ 80-95%             │
│ application/xml            │ YES        │ 70-85%             │
├───────────────────────────┼────────────┼────────────────────┤
│ image/png, image/jpeg      │ NO         │ 0-2% (already comp)│
│ image/webp, image/avif     │ NO         │ 0% (already comp)  │
│ video/*, audio/*           │ NO         │ 0% (already comp)  │
│ application/zip            │ NO         │ 0% (already comp)  │
│ application/octet-stream   │ NO         │ varies             │
│ application/protobuf       │ MAYBE      │ 20-40%             │
└───────────────────────────┴────────────┴────────────────────┘
```

---

## Accept-Encoding Negotiation

```typescript
// Proper content negotiation with priority
import { createBrotliCompress, createGzip, createDeflate } from 'zlib';
import { Request, Response, NextFunction } from 'express';

function negotiateEncoding(req: Request): 'br' | 'gzip' | 'deflate' | 'identity' {
  const accept = req.headers['accept-encoding'] || '';
  // Prefer Brotli > gzip > deflate > none
  if (accept.includes('br')) return 'br';
  if (accept.includes('gzip')) return 'gzip';
  if (accept.includes('deflate')) return 'deflate';
  return 'identity';
}

function compressMiddleware(req: Request, res: Response, next: NextFunction): void {
  const encoding = negotiateEncoding(req);
  if (encoding === 'identity') return next();

  const originalEnd = res.end.bind(res);
  const chunks: Buffer[] = [];

  res.write = function(chunk: any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  } as any;

  res.end = function(chunk?: any) {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const body = Buffer.concat(chunks);

    if (body.length < 1024) {
      return originalEnd(body); // skip compression for small bodies
    }

    res.setHeader('Content-Encoding', encoding);
    res.removeHeader('Content-Length'); // length changes after compression
    res.setHeader('Vary', 'Accept-Encoding'); // CRITICAL for caching

    const compressor = encoding === 'br'
      ? createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } })
      : encoding === 'gzip'
        ? createGzip({ level: 4 })
        : createDeflate({ level: 4 });

    const compressed: Buffer[] = [];
    compressor.on('data', (c: Buffer) => compressed.push(c));
    compressor.on('end', () => originalEnd(Buffer.concat(compressed)));
    compressor.end(body);
  } as any;

  next();
}
```

```go
// Go: content negotiation with Brotli + gzip
import (
    "github.com/andybalholm/brotli"
    "compress/gzip"
    "strings"
)

func CompressHandler(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        accept := r.Header.Get("Accept-Encoding")

        if strings.Contains(accept, "br") {
            w.Header().Set("Content-Encoding", "br")
            w.Header().Set("Vary", "Accept-Encoding")
            brw := brotli.NewWriterLevel(w, 4) // level 4 for dynamic
            defer brw.Close()
            next.ServeHTTP(&compressWriter{ResponseWriter: w, Writer: brw}, r)
            return
        }

        if strings.Contains(accept, "gzip") {
            w.Header().Set("Content-Encoding", "gzip")
            w.Header().Set("Vary", "Accept-Encoding")
            gw, _ := gzip.NewWriterLevel(w, 4)
            defer gw.Close()
            next.ServeHTTP(&compressWriter{ResponseWriter: w, Writer: gw}, r)
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

---

## Pre-Compression of Static Assets

```bash
# Build-time pre-compression: compress once, serve many times
# Use maximum compression levels since this is offline

# Brotli (level 11 — max compression, slow but done once)
find ./dist -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.svg" \) \
  -exec brotli -Z -k {} \;  # -Z = max level, -k = keep original

# Gzip (level 9 — for clients that don't support Brotli)
find ./dist -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.svg" \) \
  -exec gzip -9 -k {} \;

# Result: dist/app.js, dist/app.js.br, dist/app.js.gz
```

```nginx
# Nginx: serve pre-compressed files
server {
    gzip_static on;        # serve .gz files if they exist
    brotli_static on;      # serve .br files if they exist (ngx_brotli module)

    # Fallback: dynamic compression for non-pre-compressed content
    gzip on;
    gzip_comp_level 4;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml application/xml+rss text/javascript
               image/svg+xml application/wasm;
    gzip_vary on;  # Add Vary: Accept-Encoding header

    # Brotli dynamic (for API responses)
    brotli on;
    brotli_comp_level 4;
    brotli_types text/plain text/css application/json application/javascript
                 text/xml application/xml image/svg+xml;
}
```

---

## Streaming Compression

```typescript
// Node.js: streaming compression for large responses
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';

app.get('/api/export', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Transfer-Encoding', 'chunked');

  const gzipStream = createGzip({ level: 4 });
  gzipStream.pipe(res);

  gzipStream.write('[');
  let first = true;

  const cursor = db.queryCursor('SELECT * FROM events ORDER BY id');
  for await (const row of cursor) {
    if (!first) gzipStream.write(',');
    first = false;
    gzipStream.write(JSON.stringify(row));
    // Compressed chunks sent as they're ready — constant memory
  }
  gzipStream.write(']');
  gzipStream.end();
});
```

```go
// Go: streaming gzip for large responses
func ExportHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.Header().Set("Content-Encoding", "gzip")

    gw, _ := gzip.NewWriterLevel(w, 4)
    defer gw.Close()

    enc := json.NewEncoder(gw)
    gw.Write([]byte("["))

    rows, _ := db.QueryContext(r.Context(), "SELECT data FROM events")
    defer rows.Close()

    first := true
    for rows.Next() {
        var data json.RawMessage
        rows.Scan(&data)
        if !first { gw.Write([]byte(",")) }
        first = false
        enc.Encode(data)
        gw.Flush() // flush compressed chunks periodically
    }
    gw.Write([]byte("]"))
}
```

---

## Zstandard for Internal Services

```python
# Python: Zstandard for inter-service communication
import zstandard as zstd

# Compression with dictionary (trained on sample data — 2-5x better ratio for small payloads)
dict_data = zstd.train_dictionary(65536, training_samples)  # train on sample payloads
compressor = zstd.ZstdCompressor(level=3, dict_data=dict_data)

# Compress response
compressed = compressor.compress(json_bytes)  # 70-90% reduction, 500+ MB/s

# Decompress
decompressor = zstd.ZstdDecompressor(dict_data=dict_data)
original = decompressor.decompress(compressed)

# Streaming compression
with open('output.zst', 'wb') as fout:
    cctx = zstd.ZstdCompressor(level=3)
    with cctx.stream_writer(fout) as compressor:
        for chunk in data_generator():
            compressor.write(chunk)
```

```go
// Go: Zstandard with klauspost/compress (fastest Go implementation)
import "github.com/klauspost/compress/zstd"

var (
    encoder, _ = zstd.NewWriter(nil, zstd.WithEncoderLevel(zstd.SpeedDefault))
    decoder, _ = zstd.NewReader(nil)
)

func CompressPayload(data []byte) []byte {
    return encoder.EncodeAll(data, make([]byte, 0, len(data)/2))
}

func DecompressPayload(data []byte) ([]byte, error) {
    return decoder.DecodeAll(data, nil)
}
```

---

## Best Practices

1. **ALWAYS compress text-based responses** > 1KB — JSON, HTML, CSS, JS, SVG, CSV
2. **NEVER re-compress already-compressed formats** — images, video, archives waste CPU for 0% gain
3. **ALWAYS set `Vary: Accept-Encoding` header** — prevents caches from serving wrong encoding
4. **Pre-compress static assets at build time** with max levels (Brotli 11, gzip 9) — compress once, serve millions
5. **Use compression level 4-6 for dynamic content** — levels 7-9 cost 3-6x more CPU for 2-3% more compression
6. **Use Zstandard for internal services** — 3x faster than gzip at same ratio, trainable dictionaries
7. **Stream-compress large responses** — avoid buffering entire response in memory before compressing
8. **Set minimum size threshold** (1KB) — compression overhead exceeds benefit for small payloads
9. **Benchmark compression CPU cost** against your throughput targets — compression trades CPU for bandwidth
10. **Use Brotli for web-facing APIs** when clients support it — 15-25% better ratio than gzip

---

## Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| No compression on API responses | High bandwidth, slow mobile clients | Enable gzip/brotli middleware |
| Compressing images/video | CPU wasted, 0% size reduction | Skip already-compressed content types |
| gzip level 9 for dynamic content | CPU bottleneck, 2% better than level 4 | Use level 4-6 for dynamic |
| Missing Vary header | CDN serves gzip to non-gzip client | Always set `Vary: Accept-Encoding` |
| Compression without threshold | 100B response becomes 120B (overhead) | Set 1KB minimum threshold |
| Dynamic Brotli at level 11 | 200ms+ per response for compression | Level 4-6 for dynamic, 11 only for static |
| Not pre-compressing static assets | CPU spent compressing same file repeatedly | Build-time Brotli 11 + gzip 9 |
| Ignoring Zstandard for internal | Using gzip at 3x the CPU cost | Zstd for service-to-service communication |

---

## Enforcement Checklist

- [ ] Compression middleware enabled on all API servers
- [ ] Content-type filtering: only compress text-based content
- [ ] Minimum threshold set (1KB) to skip tiny responses
- [ ] Dynamic compression level 4-6 (not max)
- [ ] Static assets pre-compressed at build time (Brotli 11 + gzip 9)
- [ ] `Vary: Accept-Encoding` header set on all compressed responses
- [ ] Accept-Encoding negotiation handles br > gzip > identity
- [ ] Nginx/CDN configured for static gzip/brotli serving
- [ ] Compression CPU overhead monitored (should be <5% of total)
- [ ] Zstandard evaluated for internal service communication
