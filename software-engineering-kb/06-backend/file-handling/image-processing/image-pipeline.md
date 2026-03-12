# Image Processing Pipeline

> **AI Plugin Directive — Image Upload, Processing & Transformation Pipeline**
> You are an AI coding assistant. When generating, reviewing, or refactoring image processing
> code, follow EVERY rule in this document. Naive image processing causes memory exhaustion,
> slow responses, and broken user experiences. Treat each section as non-negotiable.

**Core Rule: ALWAYS process images asynchronously via job queue — NEVER in the request handler. ALWAYS generate multiple sizes (thumbnail, medium, large) on upload. ALWAYS strip EXIF metadata before serving (privacy). ALWAYS validate image dimensions and file size before processing.**

---

## 1. Image Processing Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Image Processing Pipeline                        │
│                                                               │
│  1. Upload (request handler)                                 │
│     ├── Validate: type (magic bytes), size, dimensions      │
│     ├── Store original in S3: originals/{id}.jpg            │
│     └── Enqueue job: "process-image"                        │
│                                                               │
│  2. Process (background job worker)                          │
│     ├── Download original from S3                            │
│     ├── Strip EXIF metadata                                  │
│     ├── Auto-orient based on EXIF rotation                  │
│     ├── Generate variants:                                   │
│     │   ├── thumbnail: 150×150 (crop center)                │
│     │   ├── medium: 600×600 (fit within, no crop)           │
│     │   ├── large: 1200×1200 (fit within, no crop)          │
│     │   └── webp: same sizes in WebP format                 │
│     ├── Upload variants to S3: processed/{id}/{size}.{fmt}  │
│     └── Update database: mark processing complete            │
│                                                               │
│  3. Serve                                                    │
│     ├── CDN with cache headers                               │
│     ├── Content negotiation: WebP if Accept supports it     │
│     └── Responsive: serve size matching client viewport     │
│                                                               │
│  NEVER: Process images synchronously in request handler     │
│  NEVER: Serve original uploaded image without processing    │
│  NEVER: Serve images with EXIF data (contains GPS, device)  │
└──────────────────────────────────────────────────────────────┘
```

| Variant | Dimensions | Quality | Use Case |
|---------|-----------|---------|----------|
| **thumbnail** | 150×150 | 80% | List views, avatars |
| **medium** | 600×600 | 85% | Card views, previews |
| **large** | 1200×1200 | 90% | Detail views |
| **original** | Unchanged | 100% | Download, admin |

---

## 2. TypeScript Implementation (Sharp)

```typescript
import sharp from "sharp";

interface ImageVariant {
  name: string;
  width: number;
  height: number;
  quality: number;
  fit: "cover" | "inside"; // cover = crop, inside = fit
}

const VARIANTS: ImageVariant[] = [
  { name: "thumbnail", width: 150, height: 150, quality: 80, fit: "cover" },
  { name: "medium", width: 600, height: 600, quality: 85, fit: "inside" },
  { name: "large", width: 1200, height: 1200, quality: 90, fit: "inside" },
];

const FORMATS = ["jpeg", "webp"] as const;

// Background job: process uploaded image
async function processImage(jobData: { imageId: string; key: string }): Promise<void> {
  const { imageId, key } = jobData;

  // Download original from S3
  const original = await storageService.downloadBuffer(key);

  // Get metadata
  const metadata = await sharp(original).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image: no dimensions");
  }

  // Validate dimensions
  if (metadata.width > 10000 || metadata.height > 10000) {
    await db.images.update(imageId, { status: "rejected", reason: "Dimensions too large" });
    return;
  }

  const variants: Record<string, string> = {};

  // Generate each variant in each format
  for (const variant of VARIANTS) {
    for (const format of FORMATS) {
      const buffer = await sharp(original)
        .rotate()                    // Auto-orient from EXIF
        .resize(variant.width, variant.height, {
          fit: variant.fit,
          withoutEnlargement: true, // Don't upscale small images
        })
        .removeAlpha()               // Remove alpha for JPEG
        [format]({ quality: variant.quality })
        .toBuffer();

      const variantKey = `processed/${imageId}/${variant.name}.${format}`;
      await storageService.upload(variantKey, buffer, `image/${format}`);
      variants[`${variant.name}_${format}`] = variantKey;
    }
  }

  // Update database with variant URLs
  await db.images.update(imageId, {
    status: "processed",
    variants,
    width: metadata.width,
    height: metadata.height,
  });
}

// Strip EXIF from any image
async function stripExif(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()           // Apply EXIF rotation before stripping
    .withMetadata({     // Keep only essential metadata
      orientation: undefined,
    })
    .toBuffer();
}
```

---

## 3. Go Implementation (imaging library)

```go
import (
    "github.com/disintegration/imaging"
    "github.com/rwcarlsen/goexif/exif"
)

type Variant struct {
    Name    string
    Width   int
    Height  int
    Quality int
    Fit     string // "cover" or "inside"
}

var variants = []Variant{
    {Name: "thumbnail", Width: 150, Height: 150, Quality: 80, Fit: "cover"},
    {Name: "medium", Width: 600, Height: 600, Quality: 85, Fit: "inside"},
    {Name: "large", Width: 1200, Height: 1200, Quality: 90, Fit: "inside"},
}

func ProcessImage(ctx context.Context, imageID, key string) error {
    // Download original
    reader, err := storage.Download(ctx, key)
    if err != nil {
        return fmt.Errorf("download original: %w", err)
    }
    defer reader.Close()

    src, err := imaging.Decode(reader, imaging.AutoOrientation(true))
    if err != nil {
        return fmt.Errorf("decode image: %w", err)
    }

    bounds := src.Bounds()
    if bounds.Dx() > 10000 || bounds.Dy() > 10000 {
        return fmt.Errorf("image too large: %dx%d", bounds.Dx(), bounds.Dy())
    }

    variantKeys := make(map[string]string)

    for _, v := range variants {
        var resized image.Image
        if v.Fit == "cover" {
            resized = imaging.Fill(src, v.Width, v.Height, imaging.Center, imaging.Lanczos)
        } else {
            resized = imaging.Fit(src, v.Width, v.Height, imaging.Lanczos)
        }

        // JPEG variant
        var jpegBuf bytes.Buffer
        if err := imaging.Encode(&jpegBuf, resized, imaging.JPEG,
            imaging.JPEGQuality(v.Quality)); err != nil {
            return fmt.Errorf("encode jpeg: %w", err)
        }

        jpegKey := fmt.Sprintf("processed/%s/%s.jpeg", imageID, v.Name)
        if err := storage.Upload(ctx, jpegKey, &jpegBuf, "image/jpeg"); err != nil {
            return fmt.Errorf("upload %s: %w", jpegKey, err)
        }
        variantKeys[v.Name+"_jpeg"] = jpegKey

        // WebP variant
        var webpBuf bytes.Buffer
        if err := webp.Encode(&webpBuf, resized, &webp.Options{Quality: float32(v.Quality)}); err != nil {
            return fmt.Errorf("encode webp: %w", err)
        }

        webpKey := fmt.Sprintf("processed/%s/%s.webp", imageID, v.Name)
        if err := storage.Upload(ctx, webpKey, &webpBuf, "image/webp"); err != nil {
            return fmt.Errorf("upload %s: %w", webpKey, err)
        }
        variantKeys[v.Name+"_webp"] = webpKey
    }

    return db.UpdateImage(ctx, imageID, "processed", variantKeys)
}
```

---

## 4. Python Implementation (Pillow)

```python
from PIL import Image, ImageOps
import io

VARIANTS = [
    {"name": "thumbnail", "width": 150, "height": 150, "quality": 80, "fit": "cover"},
    {"name": "medium", "width": 600, "height": 600, "quality": 85, "fit": "inside"},
    {"name": "large", "width": 1200, "height": 1200, "quality": 90, "fit": "inside"},
]

async def process_image(image_id: str, key: str) -> None:
    original_bytes = await storage.download_bytes(key)
    img = Image.open(io.BytesIO(original_bytes))

    # Auto-orient from EXIF
    img = ImageOps.exif_transpose(img)

    # Strip EXIF
    data = list(img.getdata())
    clean = Image.new(img.mode, img.size)
    clean.putdata(data)
    img = clean

    if img.width > 10000 or img.height > 10000:
        await db.images.update(image_id, status="rejected", reason="Too large")
        return

    variants = {}
    for v in VARIANTS:
        if v["fit"] == "cover":
            resized = ImageOps.fit(img, (v["width"], v["height"]), Image.LANCZOS)
        else:
            img_copy = img.copy()
            img_copy.thumbnail((v["width"], v["height"]), Image.LANCZOS)
            resized = img_copy

        # JPEG
        jpeg_buf = io.BytesIO()
        resized.convert("RGB").save(jpeg_buf, "JPEG", quality=v["quality"])
        jpeg_key = f"processed/{image_id}/{v['name']}.jpeg"
        await storage.upload(jpeg_key, jpeg_buf.getvalue(), "image/jpeg")
        variants[f"{v['name']}_jpeg"] = jpeg_key

        # WebP
        webp_buf = io.BytesIO()
        resized.save(webp_buf, "WEBP", quality=v["quality"])
        webp_key = f"processed/{image_id}/{v['name']}.webp"
        await storage.upload(webp_key, webp_buf.getvalue(), "image/webp")
        variants[f"{v['name']}_webp"] = webp_key

    await db.images.update(image_id, status="processed", variants=variants)
```

---

## 5. Content Negotiation for Serving

```typescript
// Serve best format based on Accept header
async function serveImage(req: Request, res: Response): Promise<void> {
  const { imageId, size } = req.params; // e.g., /images/abc/medium

  const image = await db.images.findById(imageId);
  if (!image || image.status !== "processed") throw new NotFoundError("Image", imageId);

  // Content negotiation: prefer WebP if supported
  const acceptWebP = req.headers.accept?.includes("image/webp");
  const format = acceptWebP ? "webp" : "jpeg";
  const variantKey = image.variants[`${size}_${format}`];

  if (!variantKey) throw new NotFoundError("Image variant", `${size}_${format}`);

  const url = await storageService.getDownloadUrl(variantKey, 86400); // 24h
  res.redirect(302, url); // Redirect to CDN/presigned URL
}
```

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Process images in request handler | Slow uploads, timeout | Async job queue |
| Serve original without resize | Bandwidth waste, slow loads | Generate and serve variants |
| Serve with EXIF data | Privacy leak (GPS location) | Strip EXIF before serving |
| Generate on-demand (no cache) | CPU spikes on every request | Pre-generate, store in S3/CDN |
| Single format (JPEG only) | Larger files than needed | WebP + JPEG with content negotiation |
| No dimension limits | Memory bomb (50000×50000 pixel) | Validate max dimensions |
| Upscale small images | Blurry, larger file | `withoutEnlargement: true` |

---

## 7. Enforcement Checklist

- [ ] Images processed asynchronously via background job
- [ ] Multiple sizes generated (thumbnail, medium, large)
- [ ] WebP variants generated alongside JPEG
- [ ] EXIF metadata stripped before serving
- [ ] Auto-orientation applied from EXIF rotation
- [ ] Dimension limits validated before processing (max 10000×10000)
- [ ] Content negotiation serves WebP when supported
- [ ] Processed images served via CDN with cache headers
- [ ] Original images stored separately (never served directly)
- [ ] Small images not upscaled (withoutEnlargement)
