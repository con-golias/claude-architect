# Presigned URL Uploads

> **AI Plugin Directive — Direct-to-Cloud Upload with Presigned URLs**
> You are an AI coding assistant. When generating, reviewing, or refactoring presigned URL
> upload patterns, follow EVERY rule in this document. Presigned URLs bypass the backend for
> large file uploads, reducing server load and enabling massive file support. Treat each section as non-negotiable.

**Core Rule: ALWAYS generate presigned URLs with expiration (5-15 minutes). ALWAYS restrict presigned URLs to specific content types and size limits. ALWAYS verify the upload completed via callback or webhook. NEVER expose cloud credentials to the client.**

---

## 1. Presigned Upload Flow

```
┌──────────────────────────────────────────────────────────────┐
│              Presigned URL Upload Flow                         │
│                                                               │
│  1. Client → Backend: POST /api/uploads/initiate             │
│     { filename: "photo.jpg", contentType: "image/jpeg",      │
│       size: 5242880 }                                        │
│                                                               │
│  2. Backend validates request, generates presigned URL        │
│     ├── Validate type + size are allowed                     │
│     ├── Generate unique storage key                          │
│     ├── Create presigned PUT URL (expires 15min)             │
│     └── Store pending upload record in database              │
│                                                               │
│  3. Backend → Client: { uploadUrl, uploadId, fields }        │
│                                                               │
│  4. Client → S3/GCS: PUT file directly (no backend proxy)   │
│     ├── File travels: Client → Cloud Storage                 │
│     └── Backend is NOT in the data path                      │
│                                                               │
│  5. Client → Backend: POST /api/uploads/:id/complete         │
│     OR S3 Event Notification → Lambda/Cloud Function         │
│                                                               │
│  6. Backend verifies upload, processes file                   │
│     ├── Verify file exists in storage                        │
│     ├── Validate content type by magic bytes                 │
│     ├── Run virus scan                                       │
│     ├── Generate thumbnails (if image)                       │
│     └── Mark upload as complete                              │
│                                                               │
│  Benefit: Server handles 0 bytes of file data               │
│  Benefit: Supports files up to 5 GB (single PUT)            │
│  Benefit: Client uploads directly to CDN edge               │
└──────────────────────────────────────────────────────────────┘
```

| Parameter | Recommendation | Purpose |
|-----------|---------------|---------|
| **URL expiration** | 5-15 minutes | Prevent reuse of stale URLs |
| **Max file size** | Per content-length condition | Enforce at storage level |
| **Content type** | Exact match condition | Prevent type spoofing |
| **ACL** | private | Never public by default |
| **Encryption** | AES256 or aws:kms | At-rest encryption |

---

## 2. TypeScript Implementation (AWS S3)

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });

interface InitiateUploadRequest {
  filename: string;
  contentType: string;
  size: number;
}

async function initiateUpload(
  userId: string,
  input: InitiateUploadRequest,
): Promise<{ uploadId: string; uploadUrl: string; key: string }> {
  // Validate content type
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  if (!allowedTypes.has(input.contentType)) {
    throw new ValidationError([{ field: "contentType", message: "Type not allowed" }]);
  }

  // Validate size
  const maxSize = 50 * 1024 * 1024; // 50 MB
  if (input.size > maxSize) {
    throw new ValidationError([{ field: "size", message: "File too large" }]);
  }

  // Generate unique key
  const ext = path.extname(sanitizeFilename(input.filename));
  const key = `uploads/${userId}/${uuid()}${ext}`;

  // Create presigned PUT URL
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: input.contentType,
    ContentLength: input.size,
    ServerSideEncryption: "AES256",
    Metadata: { "user-id": userId },
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min

  // Store pending upload record
  const upload = await db.uploads.create({
    userId,
    key,
    status: "pending",
    contentType: input.contentType,
    size: input.size,
    expiresAt: new Date(Date.now() + 900_000),
  });

  return { uploadId: upload.id, uploadUrl, key };
}

// Client calls after direct-to-S3 upload completes
async function completeUpload(uploadId: string, userId: string): Promise<FileRecord> {
  const upload = await db.uploads.findById(uploadId);
  if (!upload || upload.userId !== userId) throw new NotFoundError("Upload", uploadId);
  if (upload.status !== "pending") throw new ConflictError("Upload", "status");

  // Verify file exists in S3
  try {
    const head = await s3.send(new HeadObjectCommand({
      Bucket: process.env.S3_BUCKET, Key: upload.key,
    }));
    // Verify size matches
    if (head.ContentLength !== upload.size) {
      throw new ValidationError([{ field: "size", message: "Size mismatch" }]);
    }
  } catch (err) {
    if ((err as any).name === "NotFound") {
      throw new ValidationError([{ field: "file", message: "File not uploaded" }]);
    }
    throw err;
  }

  // Queue post-processing (virus scan, thumbnails)
  await jobQueue.add("process-upload", { uploadId, key: upload.key });

  // Mark as complete
  await db.uploads.update(uploadId, { status: "processing" });

  return { id: uploadId, key: upload.key, status: "processing" };
}
```

---

## 3. Go Implementation (AWS S3)

```go
func (h *UploadHandler) InitiateUpload(w http.ResponseWriter, r *http.Request) {
    var input struct {
        Filename    string `json:"filename"`
        ContentType string `json:"contentType"`
        Size        int64  `json:"size"`
    }
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        writeError(w, http.StatusBadRequest, "Invalid request")
        return
    }

    // Validate
    allowed := map[string]bool{"image/jpeg": true, "image/png": true, "application/pdf": true}
    if !allowed[input.ContentType] {
        writeError(w, http.StatusBadRequest, "Content type not allowed")
        return
    }
    if input.Size > 50<<20 {
        writeError(w, http.StatusBadRequest, "File too large")
        return
    }

    userID := auth.GetUserID(r.Context())
    ext := filepath.Ext(sanitizeFilename(input.Filename))
    key := fmt.Sprintf("uploads/%s/%s%s", userID, uuid.New().String(), ext)

    // Generate presigned PUT URL
    presignClient := s3.NewPresignClient(h.s3Client)
    presigned, err := presignClient.PresignPutObject(r.Context(), &s3.PutObjectInput{
        Bucket:               aws.String(h.bucket),
        Key:                  aws.String(key),
        ContentType:          aws.String(input.ContentType),
        ContentLength:        aws.Int64(input.Size),
        ServerSideEncryption: types.ServerSideEncryptionAes256,
    }, s3.WithPresignExpires(15*time.Minute))
    if err != nil {
        writeError(w, http.StatusInternalServerError, "Failed to generate upload URL")
        return
    }

    // Store pending record
    upload := &Upload{
        UserID:      userID,
        Key:         key,
        Status:      "pending",
        ContentType: input.ContentType,
        Size:        input.Size,
        ExpiresAt:   time.Now().Add(15 * time.Minute),
    }
    if err := h.repo.Create(r.Context(), upload); err != nil {
        writeError(w, http.StatusInternalServerError, "Failed to create upload record")
        return
    }

    writeJSON(w, http.StatusOK, map[string]any{
        "uploadId":  upload.ID,
        "uploadUrl": presigned.URL,
        "key":       key,
    })
}
```

---

## 4. Python Implementation (boto3)

```python
import boto3
from botocore.config import Config

s3_client = boto3.client("s3", config=Config(signature_version="s3v4"))

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_SIZE = 50 * 1024 * 1024

@app.post("/api/uploads/initiate")
async def initiate_upload(
    request: InitiateUploadRequest,
    user: User = Depends(get_current_user),
):
    if request.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Content type not allowed")
    if request.size > MAX_SIZE:
        raise HTTPException(400, "File too large")

    ext = os.path.splitext(sanitize_filename(request.filename))[1]
    key = f"uploads/{user.id}/{uuid4()}{ext}"

    # Generate presigned URL
    url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.S3_BUCKET,
            "Key": key,
            "ContentType": request.content_type,
            "ContentLength": request.size,
            "ServerSideEncryption": "AES256",
        },
        ExpiresIn=900,  # 15 minutes
    )

    # Store pending upload
    upload = await db.uploads.create(
        user_id=user.id, key=key, status="pending",
        content_type=request.content_type, size=request.size,
        expires_at=datetime.utcnow() + timedelta(minutes=15),
    )

    return {"upload_id": upload.id, "upload_url": url, "key": key}

@app.post("/api/uploads/{upload_id}/complete")
async def complete_upload(
    upload_id: str,
    user: User = Depends(get_current_user),
):
    upload = await db.uploads.get(upload_id)
    if not upload or upload.user_id != user.id:
        raise HTTPException(404, "Upload not found")

    # Verify file exists
    try:
        head = s3_client.head_object(Bucket=settings.S3_BUCKET, Key=upload.key)
    except s3_client.exceptions.NoSuchKey:
        raise HTTPException(400, "File not uploaded")

    # Queue processing
    await job_queue.enqueue("process-upload", upload_id=upload.id)
    await db.uploads.update(upload_id, status="processing")

    return {"upload_id": upload.id, "status": "processing"}
```

---

## 5. GCS Presigned URLs

```typescript
// Google Cloud Storage — signed URLs
import { Storage } from "@google-cloud/storage";

const storage = new Storage();

async function generateGCSUploadUrl(key: string, contentType: string): Promise<string> {
  const [url] = await storage.bucket(process.env.GCS_BUCKET!).file(key).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType,
  });
  return url;
}
```

```python
# GCS presigned URL
from google.cloud import storage

gcs = storage.Client()

def generate_gcs_upload_url(key: str, content_type: str) -> str:
    blob = gcs.bucket(settings.GCS_BUCKET).blob(key)
    return blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=15),
        method="PUT",
        content_type=content_type,
    )
```

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No URL expiration | Reusable upload URLs leaked | Always set 5-15 min expiry |
| No content type restriction | Any file type uploaded | Lock content-type in presigned URL |
| No size restriction | Massive files uploaded | Content-length condition |
| Skip upload verification | Files never confirmed uploaded | Complete endpoint + S3 events |
| No pending upload cleanup | Orphaned records accumulate | Cron job: delete expired pending |
| Expose storage credentials | Credential leak | Presigned URLs only |
| No post-upload validation | Malicious files stored | Virus scan + magic bytes after upload |

---

## 7. Enforcement Checklist

- [ ] Presigned URLs expire in 5-15 minutes
- [ ] Content type locked in presigned URL parameters
- [ ] File size validated before URL generation
- [ ] Upload completion verified (HEAD object or S3 event)
- [ ] Post-upload validation (virus scan, magic bytes) queued as job
- [ ] Pending uploads cleaned up after expiration (cron)
- [ ] Storage credentials never exposed to client
- [ ] Server-side encryption configured (AES256 or KMS)
- [ ] Unique storage keys (UUID) prevent overwrites
