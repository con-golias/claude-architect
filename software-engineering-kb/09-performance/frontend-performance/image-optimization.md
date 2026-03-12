# Image Optimization — Performance Engineering

> **Domain:** Frontend Performance > Asset Optimization
> **Importance:** CRITICAL
> **Cross-ref:** 05-frontend/web/performance/image-optimization.md (format details, framework components)

> **Directive:** When optimizing image delivery, choosing formats, setting up image pipelines, or fixing LCP caused by images, consult this guide. See 05-frontend for framework-specific image component usage (Next.js Image, etc.).

---

## 1. Format Decision Matrix

```
IMAGE FORMAT SELECTION FLOWCHART:
  Is it a vector graphic (icon, logo, illustration)?
  ├── YES → SVG (infinite scale, tiny size, CSS-styleable)
  │         Compress with SVGO. Inline if < 2KB.
  └── NO → Is it a photograph or complex raster?
      ├── YES → Does browser support AVIF?
      │   ├── YES → AVIF (40-50% smaller than JPEG)
      │   └── NO → WebP (25-35% smaller than JPEG)
      │   Use <picture> with fallback chain: AVIF > WebP > JPEG
      └── NO → Is transparency needed?
          ├── YES → WebP or PNG (WebP is 26% smaller for alpha)
          └── NO → Is it an animation?
              ├── YES → Use <video> (90% smaller than GIF)
              │         Or animated WebP/AVIF
              └── NO → WebP as default

COMPRESSION QUALITY TARGETS:
┌──────────┬───────────┬──────────────────────────────────┐
│ Format   │ Quality   │ Notes                            │
├──────────┼───────────┼──────────────────────────────────┤
│ JPEG     │ 75-85     │ Below 70 = visible artifacts     │
│ WebP     │ 75-80     │ Perceptually better at same q    │
│ AVIF     │ 50-65     │ Lower numbers still look great   │
│ PNG      │ N/A       │ Lossless; use optipng/pngquant   │
└──────────┴───────────┴──────────────────────────────────┘
```

## 2. Responsive Image Strategy

```html
<!-- FULL RESPONSIVE IMAGE IMPLEMENTATION -->
<picture>
  <!-- AVIF: best compression, modern browsers -->
  <source
    type="image/avif"
    srcset="hero-400.avif 400w, hero-800.avif 800w, hero-1200.avif 1200w"
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 800px"
  />
  <!-- WebP: good compression, wide support -->
  <source
    type="image/webp"
    srcset="hero-400.webp 400w, hero-800.webp 800w, hero-1200.webp 1200w"
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 800px"
  />
  <!-- JPEG fallback -->
  <img
    src="hero-800.jpg"
    srcset="hero-400.jpg 400w, hero-800.jpg 800w, hero-1200.jpg 1200w"
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 800px"
    alt="Hero image description"
    width="1200"
    height="675"
    loading="eager"
    fetchpriority="high"
    decoding="async"
  />
</picture>

<!-- SIZES ATTRIBUTE COMMON PATTERNS -->
<!-- Full-width mobile, half-width tablet, fixed desktop -->
<!-- sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 800px" -->
<!-- Grid: 1-col mobile, 2-col tablet, 3-col desktop -->
<!-- sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" -->
```

## 3. Image CDN Pipeline

```typescript
// image-cdn-url-builder.ts — Generate optimized image CDN URLs
interface ImageParams {
  src: string;
  width: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg';
  fit?: 'cover' | 'contain' | 'fill';
  dpr?: number;
}

// Cloudinary URL builder
function cloudinaryUrl(params: ImageParams): string {
  const transforms = [
    `w_${params.width}`,
    `q_${params.quality ?? 'auto'}`,
    `f_${params.format ?? 'auto'}`,
    `c_${params.fit ?? 'fill'}`,
    params.dpr ? `dpr_${params.dpr}` : null,
  ].filter(Boolean).join(',');
  return `https://res.cloudinary.com/CLOUD/image/upload/${transforms}/${params.src}`;
}

// imgix URL builder
function imgixUrl(params: ImageParams): string {
  const query = new URLSearchParams({
    w: String(params.width),
    q: String(params.quality ?? 75),
    auto: 'format,compress',
    fit: params.fit === 'cover' ? 'crop' : 'clip',
    dpr: String(params.dpr ?? 1),
  });
  return `https://DOMAIN.imgix.net/${params.src}?${query}`;
}

// Generate srcset for responsive images
function generateSrcset(
  builder: (p: ImageParams) => string,
  src: string,
  widths: number[] = [400, 800, 1200, 1600]
): string {
  return widths
    .map(w => `${builder({ src, width: w })} ${w}w`)
    .join(', ');
}
```

```python
# image_pipeline.py — Build-time image optimization pipeline
from pathlib import Path
import subprocess
from concurrent.futures import ProcessPoolExecutor

WIDTHS = [400, 800, 1200, 1600]
FORMATS = {
    "avif": {"quality": "55", "speed": "6"},
    "webp": {"quality": "80"},
    "jpg":  {"quality": "80"},
}

def optimize_image(src: Path, output_dir: Path) -> list[Path]:
    """Generate all responsive variants for a single source image."""
    outputs = []
    for width in WIDTHS:
        for fmt, opts in FORMATS.items():
            out = output_dir / f"{src.stem}-{width}.{fmt}"
            cmd = ["sharp-cli", str(src)]
            cmd += ["--width", str(width)]
            if fmt == "avif":
                cmd += ["--format", "avif", "--quality", opts["quality"]]
            elif fmt == "webp":
                cmd += ["--format", "webp", "--quality", opts["quality"]]
            else:
                cmd += ["--format", "jpeg", "--quality", opts["quality"]]
            cmd += ["--output", str(out)]
            subprocess.run(cmd, check=True)
            outputs.append(out)
    return outputs

def batch_optimize(src_dir: str, output_dir: str, workers: int = 4) -> None:
    """Process all images in parallel."""
    src_path = Path(src_dir)
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    images = list(src_path.glob("*.{jpg,jpeg,png}"))
    with ProcessPoolExecutor(max_workers=workers) as pool:
        pool.map(lambda img: optimize_image(img, out_path), images)
```

## 4. Placeholder Strategies

```typescript
// placeholder-strategies.ts — Prevent CLS and improve perceived performance

// BlurHash: Compact blur representation (20-30 bytes)
// Generate server-side, decode client-side
import { decode } from 'blurhash';

function blurhashToDataURL(hash: string, width = 32, height = 18): string {
  const pixels = decode(hash, width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

// LQIP: Low Quality Image Placeholder (inline base64, ~800 bytes)
// Generated at build time: tiny JPEG (20x15px) → base64
function lqipStyle(base64: string): Record<string, string> {
  return {
    backgroundImage: `url(data:image/jpeg;base64,${base64})`,
    backgroundSize: 'cover',
    filter: 'blur(10px)',
    transform: 'scale(1.05)',  // Hide blur edges
  };
}

// Dominant color: Simplest, smallest (7 bytes hex)
// CSS: background-color: #3a7bc8;
// Best for: Product images, thumbnails where blur adds no value

// SQIP: SVG-based placeholder (primitive shapes, ~1KB)
// Generates SVG with geometric shapes approximating the image
```

## 5. LCP Image Optimization

```html
<!-- HERO IMAGE: LCP optimization checklist -->
<!-- 1. Preload with high priority -->
<link rel="preload" as="image" href="hero.webp"
      imagesrcset="hero-400.webp 400w, hero-800.webp 800w, hero-1200.webp 1200w"
      imagesizes="100vw"
      fetchpriority="high" />

<!-- 2. Render with explicit dimensions (prevent CLS) -->
<img src="hero-800.webp"
     srcset="hero-400.webp 400w, hero-800.webp 800w, hero-1200.webp 1200w"
     sizes="100vw"
     width="1200" height="675"
     alt="Product showcase"
     loading="eager"
     fetchpriority="high"
     decoding="async" />

<!-- NEVER lazy-load the LCP image -->
<!-- NEVER use loading="lazy" on hero/above-the-fold images -->
```

## 6. Image Audit Automation

```typescript
// image-audit.ts — Automated checks for image optimization
interface ImageAuditResult {
  url: string;
  issues: string[];
  savings: number; // estimated bytes saved
}

function auditImages(): ImageAuditResult[] {
  const images = document.querySelectorAll('img');
  const results: ImageAuditResult[] = [];

  images.forEach(img => {
    const issues: string[] = [];
    let savings = 0;

    // Check: explicit dimensions (CLS prevention)
    if (!img.width || !img.height) {
      issues.push('Missing width/height attributes — causes CLS');
    }
    // Check: oversized images
    const displayWidth = img.clientWidth * window.devicePixelRatio;
    if (img.naturalWidth > displayWidth * 1.5) {
      issues.push(`Oversized: serving ${img.naturalWidth}px, displaying ${Math.round(displayWidth)}px`);
      savings += (img.naturalWidth - displayWidth) * 0.5; // rough estimate
    }
    // Check: format
    const src = img.currentSrc || img.src;
    if (src.match(/\.(jpg|jpeg|png)$/i) && !src.includes('svg')) {
      issues.push('Not using modern format (WebP/AVIF)');
    }
    // Check: lazy loading on below-fold images
    const rect = img.getBoundingClientRect();
    if (rect.top > window.innerHeight && img.loading !== 'lazy') {
      issues.push('Below-fold image without loading="lazy"');
    }
    // Check: above-fold image with lazy loading
    if (rect.top < window.innerHeight && img.loading === 'lazy') {
      issues.push('Above-fold image with loading="lazy" — delays LCP');
    }

    if (issues.length > 0) {
      results.push({ url: src, issues, savings });
    }
  });
  return results;
}
```

---

## 10 Best Practices

1. **Serve AVIF with WebP fallback** — use `<picture>` for format negotiation
2. **Set explicit width and height** — on every `<img>` to prevent CLS
3. **Use image CDN** — automatic format negotiation, resizing, and compression
4. **Preload LCP image** — `fetchpriority="high"` + `<link rel="preload">`
5. **Generate responsive srcset** — serve 400w, 800w, 1200w, 1600w variants minimum
6. **Set correct sizes attribute** — wrong sizes means browser picks wrong variant
7. **Use placeholders for perceived speed** — BlurHash or dominant color during load
8. **Compress SVGs** — run SVGO; inline small SVGs (< 2KB) to eliminate requests
9. **Lazy load below-fold images** — `loading="lazy"` or Intersection Observer
10. **Automate optimization in CI** — sharp/imagemin in build pipeline, reject unoptimized images

## 8 Anti-Patterns

1. **Serving original uploads** — uncompressed 4MB JPEG as hero image
2. **Missing sizes attribute** — browser downloads largest srcset image for all viewports
3. **Lazy loading LCP image** — delays the largest contentful paint by 200-500ms
4. **Using CSS background-image for LCP** — invisible to preload scanner; use `<img>`
5. **PNG for photographs** — 3-5x larger than JPEG/WebP for photos
6. **Animated GIFs** — 10-50x larger than equivalent `<video>` with autoplay
7. **No responsive images** — serving 2000px image on 375px mobile screen
8. **Client-side image resizing** — downloading full image then scaling in CSS wastes bandwidth

## Enforcement Checklist

- [ ] All images served in WebP/AVIF with fallback chain
- [ ] Every `<img>` has explicit width and height attributes
- [ ] LCP image preloaded with `fetchpriority="high"`
- [ ] Image CDN configured for automatic format and size negotiation
- [ ] srcset + sizes implemented for all content images
- [ ] No images above 150KB (hero) / 80KB (content) gzipped
- [ ] Below-fold images use `loading="lazy"`
- [ ] Build pipeline rejects unoptimized images over size budget
