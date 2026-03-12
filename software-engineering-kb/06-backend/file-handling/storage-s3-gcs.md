# Cloud Object Storage (S3 / GCS)

> **AI Plugin Directive — Cloud Storage Operations, Security & Lifecycle**
> You are an AI coding assistant. When generating, reviewing, or refactoring cloud storage
> code, follow EVERY rule in this document. Misconfigured cloud storage causes data breaches,
> cost overruns, and data loss. Treat each section as non-negotiable.

**Core Rule: ALWAYS use private ACLs by default — NEVER make buckets or objects public unless explicitly required. ALWAYS enable server-side encryption. ALWAYS use presigned URLs for temporary access. ALWAYS configure lifecycle rules for cost management.**

---

## 1. Storage Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Cloud Storage Architecture                       │
│                                                               │
│  Application                                                 │
│  ├── Upload path:                                            │
│  │   ├── Presigned URL → Direct client upload               │
│  │   └── Server proxy → Stream through backend              │
│  │                                                           │
│  ├── Download path:                                          │
│  │   ├── Presigned GET URL → Direct client download         │
│  │   ├── CDN (CloudFront/Cloud CDN) → Cached edge          │
│  │   └── Server proxy → Stream through backend              │
│  │                                                           │
│  ├── Storage tiers:                                          │
│  │   ├── Standard → Frequently accessed                     │
│  │   ├── Infrequent Access → 30+ days old                  │
│  │   ├── Glacier / Archive → 90+ days old                  │
│  │   └── Delete → 365+ days old (if policy allows)         │
│  │                                                           │
│  └── Security:                                               │
│      ├── Private ACL (default)                              │
│      ├── Server-side encryption (AES-256 or KMS)            │
│      ├── Bucket policy (least privilege)                     │
│      └── VPC endpoint (no public internet)                  │
└──────────────────────────────────────────────────────────────┘
```

| Feature | AWS S3 | Google Cloud Storage |
|---------|--------|---------------------|
| **Storage classes** | Standard, IA, Glacier, Deep Archive | Standard, Nearline, Coldline, Archive |
| **Max object size** | 5 TB | 5 TB |
| **Presigned URLs** | `getSignedUrl` | `generateSignedUrl` |
| **Server-side encryption** | SSE-S3, SSE-KMS, SSE-C | Google-managed, CMEK, CSEK |
| **Event notifications** | S3 Events → SNS/SQS/Lambda | Pub/Sub notifications |
| **Versioning** | Object versioning | Object versioning |
| **Lifecycle rules** | Transition + expiration | Transition + deletion |

---

## 2. TypeScript Implementation

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand,
         DeleteObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.S3_BUCKET!;

class StorageService {
  // Upload from server (stream, not buffer)
  async upload(key: string, stream: Readable, contentType: string): Promise<string> {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: stream,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    }));
    return key;
  }

  // Download as stream
  async download(key: string): Promise<Readable> {
    const { Body } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return Body as Readable;
  }

  // Generate presigned download URL
  async getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn });
  }

  // Delete object
  async delete(key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  }

  // Copy (for moving between paths/buckets)
  async copy(sourceKey: string, destKey: string): Promise<void> {
    await s3.send(new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${sourceKey}`,
      Key: destKey,
      ServerSideEncryption: "AES256",
    }));
  }

  // List objects with prefix
  async list(prefix: string): Promise<string[]> {
    const { Contents } = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      MaxKeys: 1000,
    }));
    return (Contents ?? []).map((obj) => obj.Key!);
  }
}
```

---

## 3. Go Implementation

```go
type StorageService struct {
    client *s3.Client
    bucket string
}

func (s *StorageService) Upload(ctx context.Context, key string, reader io.Reader, contentType string) error {
    _, err := s.client.PutObject(ctx, &s3.PutObjectInput{
        Bucket:               aws.String(s.bucket),
        Key:                  aws.String(key),
        Body:                 reader,
        ContentType:          aws.String(contentType),
        ServerSideEncryption: types.ServerSideEncryptionAes256,
    })
    return err
}

func (s *StorageService) Download(ctx context.Context, key string) (io.ReadCloser, error) {
    result, err := s.client.GetObject(ctx, &s3.GetObjectInput{
        Bucket: aws.String(s.bucket),
        Key:    aws.String(key),
    })
    if err != nil {
        return nil, fmt.Errorf("download %s: %w", key, err)
    }
    return result.Body, nil
}

func (s *StorageService) GetDownloadURL(ctx context.Context, key string, expiry time.Duration) (string, error) {
    presignClient := s3.NewPresignClient(s.client)
    presigned, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
        Bucket: aws.String(s.bucket),
        Key:    aws.String(key),
    }, s3.WithPresignExpires(expiry))
    if err != nil {
        return "", err
    }
    return presigned.URL, nil
}

func (s *StorageService) Delete(ctx context.Context, key string) error {
    _, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
        Bucket: aws.String(s.bucket),
        Key:    aws.String(key),
    })
    return err
}
```

---

## 4. Python Implementation

```python
import boto3
from botocore.config import Config

class StorageService:
    def __init__(self):
        self.s3 = boto3.client("s3", config=Config(
            retries={"max_attempts": 3, "mode": "adaptive"},
        ))
        self.bucket = settings.S3_BUCKET

    async def upload(self, key: str, file_path: str, content_type: str) -> str:
        self.s3.upload_file(
            file_path, self.bucket, key,
            ExtraArgs={
                "ContentType": content_type,
                "ServerSideEncryption": "AES256",
            },
        )
        return key

    def get_download_url(self, key: str, expires_in: int = 3600) -> str:
        return self.s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    def delete(self, key: str) -> None:
        self.s3.delete_object(Bucket=self.bucket, Key=key)

    def bulk_delete(self, keys: list[str]) -> None:
        """Delete up to 1000 objects in a single API call."""
        self.s3.delete_objects(
            Bucket=self.bucket,
            Delete={"Objects": [{"Key": k} for k in keys[:1000]]},
        )
```

---

## 5. Bucket Security Configuration

```typescript
// S3 bucket policy — ALWAYS restrict access
const bucketPolicy = {
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "DenyPublicAccess",
      Effect: "Deny",
      Principal: "*",
      Action: "s3:GetObject",
      Resource: `arn:aws:s3:::${BUCKET}/*`,
      Condition: {
        StringNotEquals: { "aws:PrincipalAccount": ACCOUNT_ID },
      },
    },
    {
      Sid: "EnforceEncryption",
      Effect: "Deny",
      Principal: "*",
      Action: "s3:PutObject",
      Resource: `arn:aws:s3:::${BUCKET}/*`,
      Condition: {
        StringNotEquals: { "s3:x-amz-server-side-encryption": "AES256" },
      },
    },
  ],
};
```

- ALWAYS block public access at bucket level
- ALWAYS enforce encryption in bucket policy
- ALWAYS use VPC endpoints for private access
- ALWAYS enable access logging for audit trail

---

## 6. Lifecycle Rules

```json
{
  "Rules": [
    {
      "ID": "transition-to-ia",
      "Status": "Enabled",
      "Filter": { "Prefix": "uploads/" },
      "Transitions": [
        { "Days": 30, "StorageClass": "STANDARD_IA" },
        { "Days": 90, "StorageClass": "GLACIER" }
      ]
    },
    {
      "ID": "expire-temp-files",
      "Status": "Enabled",
      "Filter": { "Prefix": "tmp/" },
      "Expiration": { "Days": 1 }
    },
    {
      "ID": "cleanup-old-versions",
      "Status": "Enabled",
      "Filter": {},
      "NoncurrentVersionExpiration": { "NoncurrentDays": 30 }
    }
  ]
}
```

- ALWAYS configure lifecycle rules to manage storage costs
- ALWAYS transition infrequently accessed data to cheaper tiers
- ALWAYS expire temporary files automatically
- ALWAYS clean up old object versions

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Public bucket ACL | Data breach, exposed files | Private ACL + presigned URLs |
| No encryption | Compliance violation | SSE-S3 or SSE-KMS always on |
| No lifecycle rules | Unbounded storage costs | Transition + expiration rules |
| Buffer file in memory before upload | OOM on large files | Stream directly |
| Hardcoded bucket names | Environment mismatch | Config/env variable |
| No access logging | No audit trail | Enable server access logging |
| Single bucket for everything | Blast radius, permission complexity | Separate buckets by concern |

---

## 8. Enforcement Checklist

- [ ] All buckets private by default (block public access enabled)
- [ ] Server-side encryption enabled on all buckets
- [ ] Presigned URLs used for client access (never direct public URLs)
- [ ] Lifecycle rules configured for cost management
- [ ] Bucket policy enforces encryption on writes
- [ ] VPC endpoint configured for private access
- [ ] Access logging enabled for audit trail
- [ ] CORS configured only for required origins
- [ ] Versioning enabled for critical data buckets
- [ ] Files streamed (not buffered) during upload/download
