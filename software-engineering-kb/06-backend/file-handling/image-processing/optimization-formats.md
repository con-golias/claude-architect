# Image Optimization & Formats

> **AI Plugin Directive — Image Format Selection, Compression & CDN Delivery**
> You are an AI coding assistant. When generating, reviewing, or refactoring image optimization
> code, follow EVERY rule in this document. Unoptimized images are the #1 cause of slow web
> performance. Treat each section as non-negotiable.

**Core Rule: ALWAYS serve WebP (or AVIF) with JPEG/PNG fallback. ALWAYS compress images to target quality (80-90% for photos, lossless for graphics). ALWAYS use responsive images with appropriate sizes for each viewport. ALWAYS serve images through CDN with proper cache headers.**

---

## 1. Format Selection Guide

```
┌──────────────────────────────────────────────────────────────┐
│              Image Format Decision Tree                       │
│                                                               │
│  What type of image?                                         │
│  ├── Photograph / complex scene                              │
│  │   ├── Browser supports AVIF? → AVIF (50% smaller)       │
│  │   ├── Browser supports WebP? → WebP (30% smaller)       │
│  │   └── Fallback → JPEG (universal)                        │
│  │                                                           │
│  ├── Graphics / logos / screenshots                          │
│  │   ├── Needs transparency? → WebP or PNG                  │
│  │   ├── Simple colors (<256) → PNG-8 or SVG               │
│  │   └── Complex graphics → WebP lossless                   │
│  │                                                           │
│  ├── Animation                                               │
│  │   ├── Short (<5s) → WebP animated or AVIF               │
│  │   └── Long → MP4 video (NOT animated GIF)               │
│  │                                                           │
│  └── Icons / vector graphics → SVG (ALWAYS)                 │
└──────────────────────────────────────────────────────────────┘
```

| Format | Best For | Compression | Transparency | Browser Support |
|--------|---------|-------------|-------------|----------------|
| **AVIF** | Photos | 50% smaller than JPEG | Yes | Chrome, Firefox, Safari 16+ |
| **WebP** | All-purpose | 30% smaller than JPEG | Yes | All modern browsers |
| **JPEG** | Photos (fallback) | Good, lossy | No | Universal |
| **PNG** | Graphics, screenshots | Lossless | Yes | Universal |
| **SVG** | Icons, logos | Vector (tiny) | Yes | Universal |
| **GIF** | Never use | Terrible | 1-bit only | Deprecated for images |

---

## 2. Compression Configuration

```typescript
import sharp from "sharp";

// JPEG: quality 80-85 for web, 90 for high-quality
async function optimizeJPEG(input: Buffer, quality = 82): Promise<Buffer> {
  return sharp(input)
    .jpeg({
      quality,
      mozjpeg: true,           // Use mozjpeg encoder (better compression)
      chromaSubsampling: "4:2:0", // Standard for web
    })
    .toBuffer();
}

// WebP: quality 80 for lossy, lossless for graphics
async function optimizeWebP(input: Buffer, quality = 80): Promise<Buffer> {
  return sharp(input)
    .webp({
      quality,
      effort: 4,               // 0-6, higher = slower but smaller
      smartSubsample: true,
    })
    .toBuffer();
}

// AVIF: quality 60-70 (perceptually equivalent to JPEG 80-85)
async function optimizeAVIF(input: Buffer, quality = 63): Promise<Buffer> {
  return sharp(input)
    .avif({
      quality,
      effort: 4,               // 0-9, higher = much slower
      chromaSubsampling: "4:2:0",
    })
    .toBuffer();
}

// PNG: lossless with maximum compression
async function optimizePNG(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .png({
      compressionLevel: 9,     // Max compression
      palette: true,           // Quantize to palette if possible
      effort: 10,
    })
    .toBuffer();
}
```

---

## 3. Go Compression

```go
import (
    "github.com/disintegration/imaging"
    "github.com/chai2010/webp"
    "image/jpeg"
    "image/png"
)

func OptimizeJPEG(img image.Image, quality int) ([]byte, error) {
    var buf bytes.Buffer
    err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality})
    return buf.Bytes(), err
}

func OptimizeWebP(img image.Image, quality float32) ([]byte, error) {
    var buf bytes.Buffer
    err := webp.Encode(&buf, img, &webp.Options{
        Lossless: false,
        Quality:  quality,
    })
    return buf.Bytes(), err
}

// Generate all format variants
func GenerateFormats(img image.Image) (map[string][]byte, error) {
    results := make(map[string][]byte)

    jpegData, err := OptimizeJPEG(img, 82)
    if err != nil {
        return nil, fmt.Errorf("jpeg: %w", err)
    }
    results["jpeg"] = jpegData

    webpData, err := OptimizeWebP(img, 80)
    if err != nil {
        return nil, fmt.Errorf("webp: %w", err)
    }
    results["webp"] = webpData

    return results, nil
}
```

---

## 4. Python Compression

```python
from PIL import Image
import pillow_avif  # AVIF support
import io

def optimize_jpeg(img: Image.Image, quality: int = 82) -> bytes:
    buf = io.BytesIO()
    img.convert("RGB").save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    return buf.getvalue()

def optimize_webp(img: Image.Image, quality: int = 80) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=quality, method=4)
    return buf.getvalue()

def optimize_avif(img: Image.Image, quality: int = 63) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "AVIF", quality=quality, speed=6)
    return buf.getvalue()

def optimize_png(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()
```

---

## 5. CDN & Cache Headers

```typescript
// Image serving with CDN-optimized headers
function getImageCacheHeaders(isProcessed: boolean): Record<string, string> {
  if (isProcessed) {
    return {
      "Cache-Control": "public, max-age=31536000, immutable", // 1 year
      "Vary": "Accept",  // Different cache per Accept header (WebP vs JPEG)
    };
  }
  return {
    "Cache-Control": "public, max-age=3600", // 1 hour for unprocessed
  };
}

// CloudFront function for content negotiation
// Deploy as CloudFront Function or Lambda@Edge
const contentNegotiation = `
function handler(event) {
  var request = event.request;
  var accept = request.headers.accept ? request.headers.accept.value : '';

  if (accept.includes('image/avif')) {
    request.uri = request.uri.replace(/\\.jpeg$/, '.avif');
  } else if (accept.includes('image/webp')) {
    request.uri = request.uri.replace(/\\.jpeg$/, '.webp');
  }

  return request;
}
`;
```

- ALWAYS set `Cache-Control: public, max-age=31536000, immutable` for processed images
- ALWAYS set `Vary: Accept` when serving format-negotiated images
- ALWAYS use content-hash or version in URL for cache busting
- ALWAYS serve through CDN for edge caching

---

## 6. Responsive Image URLs

```typescript
// Generate srcset-compatible URLs for responsive images
function getResponsiveImageUrls(imageId: string, variants: Record<string, string>): {
  src: string;
  srcset: string;
  sizes: string;
} {
  const baseUrl = `${CDN_URL}/images`;

  return {
    src: `${baseUrl}/${variants.medium_jpeg}`, // Default fallback
    srcset: [
      `${baseUrl}/${variants.thumbnail_webp} 150w`,
      `${baseUrl}/${variants.medium_webp} 600w`,
      `${baseUrl}/${variants.large_webp} 1200w`,
    ].join(", "),
    sizes: "(max-width: 640px) 150px, (max-width: 1024px) 600px, 1200px",
  };
}
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Serve only JPEG | 30% larger than needed | WebP + AVIF with negotiation |
| Quality 100% for web | Huge files, no visual gain | 80-85% JPEG, 60-70% AVIF |
| No CDN for images | Slow global delivery | CloudFront/Cloud CDN |
| Animated GIF for video | Massive files, no controls | MP4 video instead |
| Single size for all viewports | Mobile downloads desktop image | Responsive sizes + srcset |
| No cache headers | CDN re-fetches on every request | immutable + long max-age |
| Upscale then compress | Larger file, worse quality | Serve original if smaller than target |

---

## 8. Enforcement Checklist

- [ ] WebP generated for all images alongside JPEG
- [ ] AVIF generated where supported (optional, high CPU)
- [ ] JPEG quality: 80-85% (mozjpeg preferred)
- [ ] WebP quality: 75-80%
- [ ] PNG used only for graphics needing transparency
- [ ] SVG used for all icons and logos
- [ ] CDN serves images with `Cache-Control: immutable`
- [ ] `Vary: Accept` header set for format negotiation
- [ ] Responsive sizes generated (thumbnail, medium, large)
- [ ] Content negotiation at CDN edge (CloudFront Function / Lambda@Edge)
