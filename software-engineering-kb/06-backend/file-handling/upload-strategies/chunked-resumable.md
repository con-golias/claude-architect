# Chunked & Resumable Uploads

> **AI Plugin Directive — Chunked Upload, Resumable Upload & Multipart S3 Upload**
> You are an AI coding assistant. When generating, reviewing, or refactoring chunked or
> resumable upload code, follow EVERY rule in this document. Large file uploads fail on
> unstable networks without resumability. Treat each section as non-negotiable.

**Core Rule: ALWAYS use chunked uploads for files > 100 MB. ALWAYS support resumability — clients MUST be able to continue from the last successful chunk. ALWAYS use S3 multipart upload (or GCS resumable upload) for files > 100 MB. ALWAYS clean up incomplete multipart uploads.**

---

## 1. Chunked Upload Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Resumable Chunked Upload Flow                    │
│                                                               │
│  1. Client → Backend: POST /api/uploads/multipart/initiate  │
│     → Returns: uploadId, partSize, totalParts               │
│                                                               │
│  2. Client splits file into chunks (5-100 MB each)          │
│     For each chunk:                                          │
│     ├── Backend generates presigned URL for part N           │
│     ├── Client uploads chunk directly to S3                  │
│     └── Client records ETag from response                    │
│                                                               │
│  3. If upload interrupted:                                   │
│     ├── Client → Backend: GET /api/uploads/:id/status       │
│     ├── Backend returns list of completed parts              │
│     └── Client resumes from first missing chunk              │
│                                                               │
│  4. All chunks uploaded:                                     │
│     ├── Client → Backend: POST /api/uploads/:id/complete    │
│     ├── Backend calls S3 CompleteMultipartUpload             │
│     └── S3 assembles parts into single object               │
│                                                               │
│  Supports: Files up to 5 TB (10,000 parts × 500 MB)        │
│  Chunk size: 5 MB minimum, 5 GB maximum per part            │
└──────────────────────────────────────────────────────────────┘
```

| Parameter | Recommended | Constraint |
|-----------|------------|------------|
| **Min chunk size** | 5 MB | S3 minimum (except last part) |
| **Default chunk size** | 10-50 MB | Balance: fewer requests vs memory |
| **Max parts** | 10,000 | S3/GCS hard limit |
| **Max total size** | 5 TB | S3 limit |
| **Upload timeout** | 24-72 hours | Cleanup incomplete after |

---

## 2. TypeScript Implementation

```typescript
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand,
         CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB

// Step 1: Initiate multipart upload
async function initiateMultipartUpload(
  userId: string,
  filename: string,
  contentType: string,
  totalSize: number,
): Promise<MultipartUploadSession> {
  const key = `uploads/${userId}/${uuid()}/${sanitizeFilename(filename)}`;
  const totalParts = Math.ceil(totalSize / CHUNK_SIZE);

  // Create S3 multipart upload
  const { UploadId } = await s3.send(new CreateMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ServerSideEncryption: "AES256",
  }));

  // Store session in database
  const session = await db.multipartUploads.create({
    userId,
    s3UploadId: UploadId,
    key,
    totalSize,
    totalParts,
    chunkSize: CHUNK_SIZE,
    completedParts: [],
    status: "in_progress",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  });

  return session;
}

// Step 2: Generate presigned URL for a specific part
async function getPartUploadUrl(
  uploadId: string,
  partNumber: number,
  userId: string,
): Promise<string> {
  const session = await db.multipartUploads.findById(uploadId);
  if (!session || session.userId !== userId) throw new NotFoundError("Upload", uploadId);

  const command = new UploadPartCommand({
    Bucket: BUCKET,
    Key: session.key,
    UploadId: session.s3UploadId,
    PartNumber: partNumber,
  });

  return getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour per part
}

// Step 3: Record completed part
async function recordCompletedPart(
  uploadId: string,
  partNumber: number,
  etag: string,
): Promise<void> {
  await db.multipartUploads.addCompletedPart(uploadId, { partNumber, etag });
}

// Step 4: Complete multipart upload
async function completeMultipartUpload(uploadId: string, userId: string): Promise<FileRecord> {
  const session = await db.multipartUploads.findById(uploadId);
  if (!session || session.userId !== userId) throw new NotFoundError("Upload", uploadId);

  if (session.completedParts.length !== session.totalParts) {
    throw new ValidationError([{
      field: "parts",
      message: `${session.totalParts - session.completedParts.length} parts missing`,
    }]);
  }

  // Complete S3 multipart upload
  await s3.send(new CompleteMultipartUploadCommand({
    Bucket: BUCKET,
    Key: session.key,
    UploadId: session.s3UploadId,
    MultipartUpload: {
      Parts: session.completedParts
        .sort((a, b) => a.partNumber - b.partNumber)
        .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
    },
  }));

  await db.multipartUploads.update(uploadId, { status: "completed" });

  // Queue post-processing
  await jobQueue.add("process-upload", { key: session.key });

  return { id: uploadId, key: session.key, status: "completed" };
}

// Cleanup: abort expired incomplete uploads (run as cron job)
async function cleanupIncompleteUploads(): Promise<void> {
  const expired = await db.multipartUploads.findExpired();
  for (const session of expired) {
    await s3.send(new AbortMultipartUploadCommand({
      Bucket: BUCKET,
      Key: session.key,
      UploadId: session.s3UploadId,
    }));
    await db.multipartUploads.delete(session.id);
    logger.info("Aborted incomplete upload", { uploadId: session.id, key: session.key });
  }
}
```

---

## 3. Go Implementation

```go
func (h *MultipartHandler) Initiate(w http.ResponseWriter, r *http.Request) {
    var input struct {
        Filename    string `json:"filename"`
        ContentType string `json:"contentType"`
        TotalSize   int64  `json:"totalSize"`
    }
    json.NewDecoder(r.Body).Decode(&input)

    userID := auth.GetUserID(r.Context())
    key := fmt.Sprintf("uploads/%s/%s/%s", userID, uuid.New(), sanitizeFilename(input.Filename))
    chunkSize := int64(10 << 20) // 10 MB
    totalParts := int((input.TotalSize + chunkSize - 1) / chunkSize)

    // Create S3 multipart upload
    result, err := h.s3Client.CreateMultipartUpload(r.Context(), &s3.CreateMultipartUploadInput{
        Bucket:               aws.String(h.bucket),
        Key:                  aws.String(key),
        ContentType:          aws.String(input.ContentType),
        ServerSideEncryption: types.ServerSideEncryptionAes256,
    })
    if err != nil {
        writeError(w, 500, "Failed to initiate upload")
        return
    }

    session := &MultipartSession{
        UserID:     userID,
        S3UploadID: *result.UploadId,
        Key:        key,
        TotalSize:  input.TotalSize,
        TotalParts: totalParts,
        ChunkSize:  chunkSize,
        Status:     "in_progress",
        ExpiresAt:  time.Now().Add(24 * time.Hour),
    }
    h.repo.Create(r.Context(), session)

    writeJSON(w, 200, map[string]any{
        "uploadId":   session.ID,
        "totalParts": totalParts,
        "chunkSize":  chunkSize,
    })
}

func (h *MultipartHandler) GetPartURL(w http.ResponseWriter, r *http.Request) {
    uploadID := chi.URLParam(r, "uploadId")
    partNumber, _ := strconv.Atoi(chi.URLParam(r, "partNumber"))

    session, _ := h.repo.FindByID(r.Context(), uploadID)

    presignClient := s3.NewPresignClient(h.s3Client)
    presigned, _ := presignClient.PresignUploadPart(r.Context(), &s3.UploadPartInput{
        Bucket:     aws.String(h.bucket),
        Key:        aws.String(session.Key),
        UploadId:   aws.String(session.S3UploadID),
        PartNumber: aws.Int32(int32(partNumber)),
    }, s3.WithPresignExpires(1*time.Hour))

    writeJSON(w, 200, map[string]string{"uploadUrl": presigned.URL})
}
```

---

## 4. GCS Resumable Upload

```python
# GCS has built-in resumable upload protocol
from google.cloud import storage
from google.resumable_media.requests import ResumableUpload

def create_resumable_upload(key: str, content_type: str, total_size: int) -> str:
    """Returns a resumable upload URI — client uploads directly."""
    bucket = gcs.bucket(settings.GCS_BUCKET)
    blob = bucket.blob(key)

    # Initiate resumable upload — returns URI
    url = blob.create_resumable_upload_session(
        content_type=content_type,
        size=total_size,
        timeout=3600,
    )
    return url

# Client uploads chunks to the returned URI with Content-Range header
# GCS handles resumability automatically
# If interrupted: send PUT with Content-Range: bytes */total to get status
```

---

## 5. S3 Lifecycle Rule for Cleanup

```json
{
  "Rules": [
    {
      "ID": "abort-incomplete-multipart",
      "Status": "Enabled",
      "Filter": { "Prefix": "uploads/" },
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 3
      }
    }
  ]
}
```

- ALWAYS configure S3 lifecycle rule to abort incomplete multipart uploads
- ALWAYS set expiration to 1-7 days
- ALWAYS have a cron job as backup cleanup alongside lifecycle rules

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No cleanup of incomplete uploads | Storage costs accumulate | S3 lifecycle rule + cron cleanup |
| Fixed chunk size for all files | Tiny files = overhead, huge = slow | Dynamic chunk size based on total |
| No resume support | Upload restarts from scratch on failure | Track completed parts, resume from gap |
| Sequential chunk upload | Slow — one chunk at a time | Parallel upload (3-5 concurrent) |
| No upload session expiry | Zombie sessions accumulate | 24-72 hour expiration |
| Client assembles file | Server must re-process | S3 CompleteMultipartUpload assembles |

---

## 7. Enforcement Checklist

- [ ] Files > 100 MB use multipart/chunked upload
- [ ] Chunk size: 5-50 MB (minimum 5 MB per S3 requirement)
- [ ] Upload session stored with completed parts list
- [ ] Resume supported: client queries completed parts and continues
- [ ] S3 lifecycle rule aborts incomplete uploads (3 days)
- [ ] Application cron job cleans up expired sessions
- [ ] Presigned URLs per part with 1-hour expiry
- [ ] CompleteMultipartUpload called with sorted parts + ETags
- [ ] AbortMultipartUpload called on cancellation
