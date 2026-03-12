# File Streaming

> **AI Plugin Directive — Streaming File I/O, Downloads & Transformations**
> You are an AI coding assistant. When generating, reviewing, or refactoring file streaming
> code, follow EVERY rule in this document. Loading entire files into memory causes OOM errors,
> high latency, and unscalable architectures. Treat each section as non-negotiable.

**Core Rule: ALWAYS use streaming I/O for file operations — NEVER load entire files into memory. ALWAYS pipe streams from source to destination without intermediate buffering. ALWAYS handle backpressure in stream pipelines. ALWAYS set Content-Length or use chunked transfer encoding for downloads.**

---

## 1. Streaming Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              File Streaming Patterns                          │
│                                                               │
│  WRONG (buffering):                                          │
│  S3 → [entire file in memory] → HTTP Response               │
│  Memory: O(file_size) — 1 GB file = 1 GB RAM                │
│                                                               │
│  RIGHT (streaming):                                          │
│  S3 → [stream pipe] → HTTP Response                         │
│  Memory: O(chunk_size) — 1 GB file = 64 KB RAM              │
│                                                               │
│  Stream pipeline:                                            │
│  Source → Transform (optional) → Destination                 │
│  ├── Source: file, S3, database BLOB, HTTP response         │
│  ├── Transform: gzip, encrypt, parse CSV, resize image     │
│  └── Destination: HTTP response, file, S3, another stream  │
│                                                               │
│  Backpressure: If destination is slow, source pauses        │
│  Result: Constant memory regardless of file size            │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript Implementation (Node.js Streams)

```typescript
import { pipeline } from "stream/promises";
import { createReadStream, createWriteStream } from "fs";
import { createGzip, createGunzip } from "zlib";

// Stream file download from S3 → HTTP response
async function streamDownload(req: Request, res: Response): Promise<void> {
  const key = req.params.key;

  const { Body, ContentType, ContentLength } = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
  );

  res.set({
    "Content-Type": ContentType ?? "application/octet-stream",
    "Content-Length": String(ContentLength),
    "Content-Disposition": `attachment; filename="${sanitizeFilename(key)}"`,
    "Cache-Control": "private, max-age=3600",
  });

  // Pipe S3 stream directly to HTTP response — zero buffering
  await pipeline(Body as Readable, res);
}

// Stream with gzip compression
async function streamCompressedDownload(req: Request, res: Response): Promise<void> {
  const fileStream = createReadStream(filePath);

  res.set({
    "Content-Type": "application/octet-stream",
    "Content-Encoding": "gzip",
    "Transfer-Encoding": "chunked", // Size unknown after compression
  });

  await pipeline(fileStream, createGzip(), res);
}

// Stream file upload: request body → S3
async function streamUpload(req: Request, res: Response): Promise<void> {
  const key = `uploads/${req.user.id}/${uuid()}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: req, // Express request IS a readable stream
    ContentType: req.headers["content-type"],
    ServerSideEncryption: "AES256",
  }));

  res.status(201).json({ key });
}

// Stream CSV processing line by line
import { createInterface } from "readline";

async function processCSV(filePath: string): Promise<number> {
  const stream = createReadStream(filePath);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let rowCount = 0;
  for await (const line of rl) {
    const fields = line.split(",");
    await processRow(fields);
    rowCount++;
  }
  return rowCount;
}
```

---

## 3. Go Implementation

```go
// Stream download: S3 → HTTP response
func StreamDownload(w http.ResponseWriter, r *http.Request) {
    key := chi.URLParam(r, "key")

    result, err := s3Client.GetObject(r.Context(), &s3.GetObjectInput{
        Bucket: aws.String(bucket),
        Key:    aws.String(key),
    })
    if err != nil {
        writeError(w, 500, "Download failed")
        return
    }
    defer result.Body.Close()

    w.Header().Set("Content-Type", aws.ToString(result.ContentType))
    w.Header().Set("Content-Length", strconv.FormatInt(aws.ToInt64(result.ContentLength), 10))
    w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filepath.Base(key)))

    // Stream directly — io.Copy uses 32 KB buffer
    if _, err := io.Copy(w, result.Body); err != nil {
        slog.Error("stream download failed", "key", key, "error", err)
    }
}

// Stream upload: HTTP request → S3
func StreamUpload(w http.ResponseWriter, r *http.Request) {
    r.Body = http.MaxBytesReader(w, r.Body, 100<<20) // 100 MB limit

    key := fmt.Sprintf("uploads/%s/%s", userID, uuid.New().String())

    _, err := s3Client.PutObject(r.Context(), &s3.PutObjectInput{
        Bucket:               aws.String(bucket),
        Key:                  aws.String(key),
        Body:                 r.Body, // Stream request body directly
        ContentType:          aws.String(r.Header.Get("Content-Type")),
        ServerSideEncryption: types.ServerSideEncryptionAes256,
    })
    if err != nil {
        writeError(w, 500, "Upload failed")
        return
    }

    writeJSON(w, 201, map[string]string{"key": key})
}

// Stream with transformation (gzip)
func StreamCompressed(w http.ResponseWriter, r *http.Request, reader io.Reader) {
    w.Header().Set("Content-Encoding", "gzip")
    w.Header().Set("Transfer-Encoding", "chunked")

    gz := gzip.NewWriter(w)
    defer gz.Close()

    io.Copy(gz, reader) // Stream through gzip → response
}

// Process large file line by line
func ProcessLargeFile(ctx context.Context, path string) error {
    f, err := os.Open(path)
    if err != nil {
        return err
    }
    defer f.Close()

    scanner := bufio.NewScanner(f)
    scanner.Buffer(make([]byte, 1024*1024), 1024*1024) // 1 MB line buffer

    for scanner.Scan() {
        if err := processLine(ctx, scanner.Text()); err != nil {
            return fmt.Errorf("process line: %w", err)
        }
    }
    return scanner.Err()
}
```

---

## 4. Python Implementation

```python
import aiofiles
from starlette.responses import StreamingResponse

# Stream download from S3
async def stream_download(key: str) -> StreamingResponse:
    obj = s3_client.get_object(Bucket=settings.S3_BUCKET, Key=key)

    async def generate():
        for chunk in obj["Body"].iter_chunks(chunk_size=64 * 1024):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type=obj["ContentType"],
        headers={
            "Content-Length": str(obj["ContentLength"]),
            "Content-Disposition": f'attachment; filename="{os.path.basename(key)}"',
        },
    )

# Stream upload
@app.post("/api/files/stream")
async def stream_upload(request: Request):
    key = f"uploads/{uuid4()}"
    tmp_path = f"/tmp/{uuid4()}"

    # Stream request body to temp file
    async with aiofiles.open(tmp_path, "wb") as f:
        async for chunk in request.stream():
            await f.write(chunk)

    # Upload to S3
    s3_client.upload_file(tmp_path, settings.S3_BUCKET, key)
    os.unlink(tmp_path)

    return {"key": key}

# Process large file without loading into memory
async def process_large_csv(file_path: str) -> int:
    count = 0
    async with aiofiles.open(file_path, "r") as f:
        async for line in f:
            fields = line.strip().split(",")
            await process_row(fields)
            count += 1
    return count
```

---

## 5. Range Requests (Partial Downloads)

```typescript
// Support Range header for video/audio streaming and download resume
async function handleRangeRequest(req: Request, res: Response, key: string): Promise<void> {
  const { ContentLength } = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  const totalSize = ContentLength!;
  const range = req.headers.range;

  if (range) {
    const [startStr, endStr] = range.replace("bytes=", "").split("-");
    const start = parseInt(startStr);
    const end = endStr ? parseInt(endStr) : totalSize - 1;
    const chunkSize = end - start + 1;

    const { Body } = await s3.send(new GetObjectCommand({
      Bucket: BUCKET, Key: key,
      Range: `bytes=${start}-${end}`,
    }));

    res.status(206).set({
      "Content-Range": `bytes ${start}-${end}/${totalSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": String(chunkSize),
      "Content-Type": "video/mp4",
    });

    await pipeline(Body as Readable, res);
  } else {
    res.set({ "Accept-Ranges": "bytes", "Content-Length": String(totalSize) });
    const { Body } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    await pipeline(Body as Readable, res);
  }
}
```

- ALWAYS support Range requests for video/audio files
- ALWAYS return `Accept-Ranges: bytes` header
- ALWAYS return 206 Partial Content for range requests

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| `readFileSync` / `readFile` for large files | OOM, high memory | Use `createReadStream` |
| `Buffer.concat()` on upload chunks | Entire file in memory | Pipe stream directly |
| No Content-Length header | Client cannot show progress | Set from source metadata |
| No backpressure handling | Memory spikes, data loss | Use `pipeline()`, not `.pipe()` |
| Intermediate temp file for every transfer | Unnecessary disk I/O | Pipe source → destination |
| No Range request support | Video cannot seek | Support Range + 206 |
| No download size limit | Abuse via huge files | Validate before streaming |

---

## 7. Enforcement Checklist

- [ ] All file operations use streaming I/O, never full-file buffering
- [ ] `pipeline()` used instead of `.pipe()` for proper error handling
- [ ] Content-Length set on download responses
- [ ] Range requests supported for media files
- [ ] Backpressure handled correctly in all stream pipelines
- [ ] Upload size limited via `MaxBytesReader` or equivalent
- [ ] Temp files cleaned up in finally/defer blocks
- [ ] Stream errors logged with file key and operation context
