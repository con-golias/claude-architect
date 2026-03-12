# HTTP Compression: Gzip, Brotli, and Zstandard

> **Domain:** Network Performance · **Importance:** Critical

---

## Overview

HTTP compression reduces transfer sizes by 60-90% for text-based assets (HTML, CSS, JS, JSON, SVG). The server compresses response bodies and indicates the algorithm via `Content-Encoding`. The browser decompresses transparently. Choose the right algorithm, tune compression levels, pre-compress at build time, and filter by content type to maximize bandwidth savings without wasting CPU.

---

## Algorithm Comparison

| Property | Gzip | Brotli | Zstandard (zstd) |
|----------|------|--------|-----------------|
| RFC | RFC 1952 | RFC 7932 | RFC 8878 |
| Compression ratio | Baseline | 15-25% better than gzip | 10-20% better than gzip |
| Compression speed | Fast | Slow (high levels) | Very fast |
| Decompression speed | Fast | Fast | Very fast |
| Browser support | Universal (99%+) | 97%+ (all modern) | Chrome 123+, Firefox 126+ |
| Content-Encoding | `gzip` | `br` | `zstd` |
| Best use case | Fallback / legacy | Static assets (pre-compressed) | Dynamic content, streaming |
| Levels | 1-9 | 0-11 | 1-22 |
| Recommended level (dynamic) | 6 | 4-5 | 3-6 |
| Recommended level (static) | 9 | 11 | 19 |

### Compression Ratio Benchmarks (typical JS bundle, 500KB uncompressed)

```
Uncompressed:  500 KB
Gzip (6):      125 KB  (75% reduction)
Gzip (9):      120 KB  (76% reduction)
Brotli (4):    110 KB  (78% reduction)
Brotli (11):    95 KB  (81% reduction) — static pre-compression only
Zstd (3):      112 KB  (78% reduction)
Zstd (19):      98 KB  (80% reduction) — static pre-compression only
```

---

## Content-Encoding Negotiation

The browser sends `Accept-Encoding` to declare supported algorithms. The server selects the best match and responds with `Content-Encoding`.

```
# Request
GET /app.js HTTP/2
Accept-Encoding: zstd, br, gzip, deflate

# Response (server picks best available)
HTTP/2 200
Content-Encoding: br
Content-Type: application/javascript
Vary: Accept-Encoding
```

**Always include `Vary: Accept-Encoding`** in compressed responses. Without it, CDNs and proxies may serve a compressed response to a client that does not support that encoding.

---

## Pre-Compression at Build Time

Pre-compress static assets at maximum compression levels during the build process. Serving pre-compressed files eliminates CPU overhead at request time.

```typescript
// Vite / Rollup — vite-plugin-compression
import viteCompression from "vite-plugin-compression";

export default defineConfig({
  plugins: [
    // Generate .br files at max compression
    viteCompression({
      algorithm: "brotliCompress",
      ext: ".br",
      threshold: 1024, // Only compress files > 1KB
      compressionOptions: { level: 11 },
    }),
    // Generate .gz fallback
    viteCompression({
      algorithm: "gzip",
      ext: ".gz",
      threshold: 1024,
      compressionOptions: { level: 9 },
    }),
  ],
});
```

```python
# Python build script — pre-compress with brotli and gzip
import brotli, gzip, os, glob

for filepath in glob.glob("dist/**/*", recursive=True):
    if not os.path.isfile(filepath):
        continue
    if not filepath.endswith((".js", ".css", ".html", ".svg", ".json")):
        continue

    with open(filepath, "rb") as f:
        data = f.read()

    # Brotli at max quality
    with open(filepath + ".br", "wb") as f:
        f.write(brotli.compress(data, quality=11))

    # Gzip at max level
    with gzip.open(filepath + ".gz", "wb", compresslevel=9) as f:
        f.write(data)

    print(f"{filepath}: {len(data)} -> br:{os.path.getsize(filepath + '.br')} "
          f"gz:{os.path.getsize(filepath + '.gz')}")
```

```go
// Go — pre-compress at build time
package main

import (
    "compress/gzip"
    "os"
    "github.com/andybalholm/brotli"
)

func preCompress(inputPath string) error {
    data, err := os.ReadFile(inputPath)
    if err != nil {
        return err
    }

    // Brotli (quality 11)
    brFile, _ := os.Create(inputPath + ".br")
    brWriter := brotli.NewWriterLevel(brFile, brotli.BestCompression)
    brWriter.Write(data)
    brWriter.Close()
    brFile.Close()

    // Gzip (level 9)
    gzFile, _ := os.Create(inputPath + ".gz")
    gzWriter, _ := gzip.NewWriterLevel(gzFile, gzip.BestCompression)
    gzWriter.Write(data)
    gzWriter.Close()
    gzFile.Close()

    return nil
}
```

---

## Server Configuration

### Nginx — On-the-Fly + Pre-Compressed

```nginx
http {
    # === Gzip (dynamic, on-the-fly) ===
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;          # Balance speed vs ratio
    gzip_min_length 1024;       # Skip tiny responses
    gzip_proxied any;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        image/svg+xml
        application/wasm;

    # === Brotli (requires ngx_brotli module) ===
    brotli on;
    brotli_comp_level 4;        # 4-5 for dynamic (fast enough)
    brotli_min_length 1024;
    brotli_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        image/svg+xml
        application/wasm;

    server {
        listen 443 ssl http2;

        # Serve pre-compressed static files (.br, .gz)
        location /static/ {
            root /var/www;
            gzip_static on;      # Serve .gz if exists
            brotli_static on;    # Serve .br if exists (ngx_brotli)

            add_header Cache-Control "public, max-age=31536000, immutable";
            add_header Vary "Accept-Encoding" always;
        }

        # Dynamic API responses — on-the-fly compression
        location /api/ {
            proxy_pass http://backend;
        }
    }
}
```

### Caddy

```
example.com {
    # Caddy enables gzip and zstd by default with encode directive
    encode zstd gzip {
        minimum_length 1024
        match {
            header Content-Type text/*
            header Content-Type application/json*
            header Content-Type application/javascript*
            header Content-Type application/xml*
            header Content-Type image/svg+xml*
            header Content-Type application/wasm*
        }
    }

    # Static files with pre-compressed variants
    handle /static/* {
        root * /var/www
        file_server {
            precompressed zstd br gzip
        }
        header Cache-Control "public, max-age=31536000, immutable"
    }

    reverse_proxy localhost:8080
}
```

---

## Application-Level Compression

### Express.js Middleware

```typescript
import express from "express";
import compression from "compression";

const app = express();

app.use(
  compression({
    level: 6,
    threshold: 1024, // Don't compress < 1KB
    filter: (req, res) => {
      // Skip already-compressed formats
      const type = res.getHeader("Content-Type") as string;
      if (/image\/(png|jpeg|webp|gif)|video|audio|font/.test(type)) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);
```

### Go — Middleware with Content-Type Filtering

```go
package main

import (
    "net/http"
    "strings"
    "github.com/klauspost/compress/gzhttp"
)

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/api/data", handleData)

    // Wrap with gzip; only compress compressible types
    handler := gzhttp.GzipHandler(mux,
        gzhttp.MinSize(1024),
        gzhttp.ContentTypes([]string{
            "application/json",
            "text/html",
            "text/css",
            "application/javascript",
        }),
    )

    http.ListenAndServe(":8080", handler)
}
```

### Python — FastAPI with GZipMiddleware

```python
from fastapi import FastAPI
from starlette.middleware.gzip import GZipMiddleware

app = FastAPI()
app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=6)

@app.get("/api/large-dataset")
async def get_data():
    # Response auto-compressed if Accept-Encoding matches
    return {"records": [{"id": i, "value": f"item-{i}"} for i in range(10000)]}
```

---

## Streaming Compression

For large responses or server-sent events, use streaming compression to avoid buffering the entire response in memory.

```typescript
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createReadStream } from "node:fs";
import http from "node:http";

const server = http.createServer(async (req, res) => {
  const acceptEncoding = req.headers["accept-encoding"] || "";

  if (acceptEncoding.includes("gzip")) {
    res.writeHead(200, {
      "Content-Encoding": "gzip",
      "Content-Type": "application/json",
      "Transfer-Encoding": "chunked",
    });
    const gzip = createGzip({ level: 4 }); // Lower level for speed
    await pipeline(createReadStream("large-data.json"), gzip, res);
  } else {
    res.writeHead(200, { "Content-Type": "application/json" });
    await pipeline(createReadStream("large-data.json"), res);
  }
});
```

---

## Compression Level Tuning Guide

| Context | Algorithm | Level | Rationale |
|---------|-----------|-------|-----------|
| Build-time static assets | Brotli | 11 | Maximum ratio, CPU cost is one-time |
| Build-time static assets | Gzip | 9 | Maximum ratio fallback |
| Dynamic API (low latency) | Gzip | 4-6 | Balanced CPU vs ratio |
| Dynamic API (low latency) | Brotli | 3-4 | Fast enough for real-time |
| Streaming / SSE | Gzip | 1-3 | Minimize buffer delay |
| Log shipping / ETL | Zstd | 3-6 | Best speed-to-ratio for bulk data |

---

## Content Types to Compress vs Skip

**Compress:** `text/html`, `text/css`, `text/javascript`, `application/javascript`, `application/json`, `application/xml`, `image/svg+xml`, `application/wasm`, `text/plain`

**Never compress:** `image/png`, `image/jpeg`, `image/webp`, `video/*`, `audio/*`, `font/woff2`, `application/zip` — already compressed. Re-compressing wastes CPU and can increase size.

---

## Best Practices

1. **Pre-compress static assets at build time with Brotli 11 and Gzip 9.** Serve pre-compressed files via `gzip_static` and `brotli_static` to eliminate runtime CPU cost.
2. **Always set `Vary: Accept-Encoding`.** Without it, CDNs cache a single encoding variant and serve it to all clients, breaking decompression for unsupported browsers.
3. **Set a minimum compression threshold of 1024 bytes.** Compressing tiny responses adds CPU and latency with negligible size savings. Headers and framing overhead can exceed the savings.
4. **Filter content types — never compress binary media.** Images, video, audio, and fonts are already compressed. Double-compression wastes CPU and may increase size.
5. **Use Gzip 4-6 for dynamic content.** Levels 7-9 yield diminishing returns (1-2% smaller) at 3-5x more CPU. Reserve maximum levels for build-time pre-compression.
6. **Deploy Brotli behind a reverse proxy with TLS.** Brotli is only supported over HTTPS. Ensure your proxy terminates TLS before applying Brotli encoding.
7. **Enable Zstandard for modern audiences.** Zstd offers Brotli-level ratios at gzip-level speed. Supported in Chrome 123+ and Firefox 126+; use gzip as fallback.
8. **Use streaming compression for large responses.** Avoid buffering entire response bodies. Stream with chunked transfer encoding and low compression levels (1-3).
9. **Monitor compression ratio in production.** Track `Content-Length` vs actual transfer size in access logs. Alert if ratio drops below expected thresholds.
10. **Test decompression on all target clients.** Verify mobile browsers, API clients (curl, axios, fetch), and CDN edge nodes all handle your chosen encoding.

---

## Anti-Patterns

1. **Compressing already-compressed formats.** Applying gzip to JPEG, PNG, WOFF2, or ZIP files wastes CPU and can increase transfer size by 1-5%.
2. **Using Brotli 11 for dynamic responses.** Brotli level 11 is 100x slower than level 4. Only use maximum compression for pre-compressed static files.
3. **Missing `Vary: Accept-Encoding` header.** CDNs serve cached Brotli to clients that only support gzip, causing failures.
4. **Compressing responses under 150 bytes.** After framing overhead, compressed output may be larger than the original.
5. **Not providing gzip fallback.** Brotli and Zstd lack universal support. Always serve gzip for older clients.
6. **Compressing WebSocket frames with per-message compression globally.** Per-message deflate adds latency and memory per connection. Enable selectively only.
7. **Ignoring `Content-Encoding` in API clients.** Clients that skip `Accept-Encoding` receive uncompressed responses, wasting bandwidth on server-to-server calls.
8. **Setting compression level to maximum for all content.** Gzip-9 JSON takes 5x longer than Gzip-4 with only 2% size improvement.

---

## Enforcement Checklist

- [ ] Static assets are pre-compressed at build time (`.br` at level 11, `.gz` at level 9).
- [ ] Reverse proxy serves pre-compressed files (`gzip_static on`, `brotli_static on`).
- [ ] Dynamic responses use on-the-fly compression at moderate levels (gzip 4-6, brotli 3-4).
- [ ] `Vary: Accept-Encoding` is set on all compressed responses.
- [ ] `Content-Type` filtering excludes binary/media formats from compression.
- [ ] Minimum size threshold is set (1024 bytes or higher).
- [ ] Gzip fallback exists for clients that do not support Brotli or Zstd.
