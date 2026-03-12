# Multipart File Uploads

> **AI Plugin Directive — Multipart Upload Handling & Validation**
> You are an AI coding assistant. When generating, reviewing, or refactoring file upload
> code, follow EVERY rule in this document. Incorrect upload handling causes security
> vulnerabilities, memory exhaustion, and data corruption. Treat each section as non-negotiable.

**Core Rule: ALWAYS validate file type by content (magic bytes), NOT by extension or MIME header. ALWAYS enforce file size limits BEFORE buffering the entire file. ALWAYS stream uploads to disk or object storage — NEVER buffer entire files in memory. ALWAYS sanitize filenames.**

---

## 1. Upload Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Multipart Upload Pipeline                         │
│                                                               │
│  Client                                                      │
│  └── multipart/form-data POST                                │
│      └── API Gateway (max body size)                         │
│          └── Backend Server                                  │
│              ├── 1. Parse multipart stream                   │
│              ├── 2. Validate filename (sanitize)             │
│              ├── 3. Validate content type (magic bytes)      │
│              ├── 4. Enforce size limit (stream counter)      │
│              ├── 5. Virus scan (ClamAV / external)          │
│              ├── 6. Stream to storage (S3/GCS/local)        │
│              ├── 7. Store metadata in database               │
│              └── 8. Return file reference                    │
│                                                               │
│  NEVER: Load entire file into memory                         │
│  NEVER: Trust client-provided Content-Type                   │
│  NEVER: Use original filename without sanitization           │
└──────────────────────────────────────────────────────────────┘
```

| Limit | Recommended Default | Purpose |
|-------|-------------------|---------|
| **Max file size** | 10-50 MB (configurable) | Prevent resource exhaustion |
| **Max files per request** | 10 | Prevent abuse |
| **Max filename length** | 255 characters | Filesystem compatibility |
| **Allowed types** | Explicit allowlist | Prevent malicious files |
| **Max total request size** | 100 MB | Gateway protection |

---

## 2. TypeScript Implementation (Express/Multer)

```typescript
import multer from "multer";
import { v4 as uuid } from "uuid";
import path from "path";
import { fileTypeFromBuffer } from "file-type";

// ALWAYS use disk storage for production — NEVER memoryStorage
const storage = multer.diskStorage({
  destination: "/tmp/uploads",
  filename: (_req, file, cb) => {
    const ext = path.extname(sanitizeFilename(file.originalname));
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,    // 50 MB
    files: 10,                      // Max 10 files
    fields: 20,                     // Max 20 non-file fields
  },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
    if (!allowed.has(file.mimetype)) {
      cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE"));
      return;
    }
    cb(null, true);
  },
});

// Filename sanitization — ALWAYS apply
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")   // Remove special chars
    .replace(/\.{2,}/g, ".")              // Prevent path traversal
    .replace(/^\.+/, "")                  // No leading dots
    .slice(0, 255);                       // Length limit
}

// Content validation by magic bytes — ALWAYS validate after upload
async function validateFileContent(filePath: string): Promise<string> {
  const buffer = Buffer.alloc(4100);
  const fd = await fs.open(filePath, "r");
  await fd.read(buffer, 0, 4100, 0);
  await fd.close();

  const type = await fileTypeFromBuffer(buffer);
  if (!type) throw new ValidationError([{ field: "file", message: "Unknown file type" }]);

  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  if (!allowed.has(type.mime)) {
    throw new ValidationError([{ field: "file", message: `File type ${type.mime} not allowed` }]);
  }

  return type.mime;
}

// Route handler
app.post("/api/files",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) throw new ValidationError([{ field: "file", message: "File required" }]);

    // Validate content by magic bytes (NOT extension)
    const actualType = await validateFileContent(req.file.path);

    // Upload to cloud storage
    const key = `uploads/${req.user.id}/${req.file.filename}`;
    await s3.upload(req.file.path, key);

    // Store metadata
    const fileRecord = await db.files.create({
      userId: req.user.id,
      key,
      originalName: sanitizeFilename(req.file.originalname),
      mimeType: actualType,
      size: req.file.size,
    });

    // Clean up temp file
    await fs.unlink(req.file.path);

    res.status(201).json({ fileId: fileRecord.id, url: fileRecord.url });
  },
);
```

---

## 3. Go Implementation

```go
func (h *FileHandler) Upload(w http.ResponseWriter, r *http.Request) {
    // Limit total request body
    r.Body = http.MaxBytesReader(w, r.Body, 50<<20) // 50 MB

    // Parse multipart
    if err := r.ParseMultipartForm(10 << 20); err != nil { // 10 MB buffer
        if errors.Is(err, &http.MaxBytesError{}) {
            writeError(w, http.StatusRequestEntityTooLarge, "File too large")
            return
        }
        writeError(w, http.StatusBadRequest, "Invalid multipart form")
        return
    }
    defer r.MultipartForm.RemoveAll()

    file, header, err := r.FormFile("file")
    if err != nil {
        writeError(w, http.StatusBadRequest, "File field required")
        return
    }
    defer file.Close()

    // Validate content type by magic bytes
    buf := make([]byte, 512)
    n, _ := file.Read(buf)
    contentType := http.DetectContentType(buf[:n])
    file.Seek(0, io.SeekStart) // Reset reader

    allowed := map[string]bool{
        "image/jpeg": true, "image/png": true,
        "image/webp": true, "application/pdf": true,
    }
    if !allowed[contentType] {
        writeError(w, http.StatusBadRequest, "File type not allowed")
        return
    }

    // Generate safe filename
    ext := filepath.Ext(sanitizeFilename(header.Filename))
    filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)

    // Stream to temp file
    tmp, err := os.CreateTemp("", "upload-*")
    if err != nil {
        writeError(w, http.StatusInternalServerError, "Upload failed")
        return
    }
    defer os.Remove(tmp.Name())
    defer tmp.Close()

    written, err := io.Copy(tmp, io.LimitReader(file, 50<<20))
    if err != nil {
        writeError(w, http.StatusInternalServerError, "Upload failed")
        return
    }

    // Upload to S3
    key := fmt.Sprintf("uploads/%s/%s", userID, filename)
    if err := h.storage.Upload(r.Context(), key, tmp.Name()); err != nil {
        writeError(w, http.StatusInternalServerError, "Storage upload failed")
        return
    }

    // Store metadata
    record := &FileRecord{
        UserID:       userID,
        Key:          key,
        OriginalName: sanitizeFilename(header.Filename),
        MimeType:     contentType,
        Size:         written,
    }
    if err := h.repo.Create(r.Context(), record); err != nil {
        writeError(w, http.StatusInternalServerError, "Failed to save metadata")
        return
    }

    writeJSON(w, http.StatusCreated, record)
}

func sanitizeFilename(name string) string {
    name = filepath.Base(name) // Remove directory components
    name = regexp.MustCompile(`[^a-zA-Z0-9._-]`).ReplaceAllString(name, "_")
    if len(name) > 255 {
        name = name[:255]
    }
    return name
}
```

---

## 4. Python Implementation (FastAPI)

```python
from fastapi import UploadFile, File
import magic
import uuid
import re

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

def sanitize_filename(name: str) -> str:
    name = os.path.basename(name)
    name = re.sub(r"[^a-zA-Z0-9._-]", "_", name)
    name = re.sub(r"\.{2,}", ".", name)
    return name[:255]

@app.post("/api/files")
async def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    # Read first chunk for type detection
    header = await file.read(8192)
    detected_type = magic.from_buffer(header, mime=True)

    if detected_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"File type {detected_type} not allowed")

    # Stream to temp file with size check
    safe_name = sanitize_filename(file.filename or "upload")
    ext = os.path.splitext(safe_name)[1]
    filename = f"{uuid.uuid4()}{ext}"
    tmp_path = f"/tmp/uploads/{filename}"

    total_size = len(header)
    async with aiofiles.open(tmp_path, "wb") as f:
        await f.write(header)
        while chunk := await file.read(64 * 1024):
            total_size += len(chunk)
            if total_size > MAX_FILE_SIZE:
                os.unlink(tmp_path)
                raise HTTPException(413, "File too large")
            await f.write(chunk)

    # Upload to cloud storage
    key = f"uploads/{user.id}/{filename}"
    await storage.upload(tmp_path, key)
    os.unlink(tmp_path)

    record = await db.files.create(
        user_id=user.id, key=key, original_name=safe_name,
        mime_type=detected_type, size=total_size,
    )
    return {"file_id": record.id, "url": record.url}
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Buffer entire file in memory | OOM on large uploads | Stream to disk/storage |
| Trust Content-Type header | Malicious files bypass filter | Validate by magic bytes |
| Use original filename | Path traversal, overwrites | UUID + sanitized extension |
| No file size limit | Disk/memory exhaustion | Enforce before buffering |
| Validate only extension | `.exe` renamed to `.jpg` | Magic bytes detection |
| No temp file cleanup | Disk space leak | Delete after processing |
| Synchronous virus scan | Upload endpoint blocks | Async scan after upload |

---

## 6. Enforcement Checklist

- [ ] File type validated by magic bytes, not extension or MIME header
- [ ] File size limit enforced during streaming (not after full buffer)
- [ ] Filenames sanitized (UUID + safe extension)
- [ ] Temp files cleaned up after processing
- [ ] Allowed types defined as explicit allowlist
- [ ] Total request body size limited at gateway level
- [ ] Upload streamed to disk or cloud storage, never buffered in memory
- [ ] File metadata stored in database with user association
