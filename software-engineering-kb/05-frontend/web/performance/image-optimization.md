# Image Optimization — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to optimize images?", "WebP vs AVIF?", "responsive images", "lazy loading images", "Next.js Image component", "image CDN", "reduce image size", "fix LCP with images", or any image optimization question, ALWAYS consult this directive. Images are typically the LARGEST assets on a page and the most common LCP element. Use modern formats (WebP/AVIF), responsive srcset, lazy loading for below-fold, and fetchpriority="high" for hero images. NEVER serve unoptimized images in production. ALWAYS use a framework image component or image CDN.

**Core Rule: Images account for 50%+ of page weight on average and are the #1 LCP element. ALWAYS serve modern formats (WebP with AVIF progressive enhancement), use responsive srcset with correct sizes attribute, lazy load below-the-fold images, and preload the hero image with fetchpriority="high". Use framework image components (Next.js Image, NuxtImg, NgOptimizedImage) or image CDNs (Cloudinary, imgix) — they handle format negotiation, resizing, and optimization automatically. NEVER serve images wider than the container they display in.**

---

## 1. Image Format Comparison

```
         MODERN IMAGE FORMATS

  ┌────────────┬──────────┬──────────┬──────────┬──────────────────┐
  │ Format     │ Savings  │ Quality  │ Browser  │ Best For         │
  │            │ vs JPEG  │          │ Support  │                  │
  ├────────────┼──────────┼──────────┼──────────┼──────────────────┤
  │ JPEG       │ baseline │ Good     │ 100%     │ Photos (legacy)  │
  │ PNG        │ larger   │ Lossless │ 100%     │ Transparency,    │
  │            │          │          │          │ screenshots      │
  │ WebP       │ 25-35%   │ Very good│ 97%+    │ Photos, graphics │
  │            │ smaller  │          │          │ (default choice) │
  │ AVIF       │ 40-50%   │ Excellent│ 92%+    │ Photos (best     │
  │            │ smaller  │          │          │ compression)     │
  │ SVG        │ N/A      │ Vector   │ 100%     │ Icons, logos,    │
  │            │          │          │          │ illustrations    │
  │ GIF        │ N/A      │ Limited  │ 100%     │ AVOID — use      │
  │            │          │ (256     │          │ video or AVIF    │
  │            │          │  colors) │          │ animation        │
  └────────────┴──────────┴──────────┴──────────┴──────────────────┘

  SIZE COMPARISON (same 1200x800 photo, similar visual quality):
  ┌──────────┬──────────┬────────────────┐
  │ Format   │ Size     │ Savings        │
  ├──────────┼──────────┼────────────────┤
  │ JPEG     │ 180 KB   │ baseline       │
  │ WebP     │ 125 KB   │ 30% smaller    │
  │ AVIF     │ 95 KB    │ 47% smaller    │
  └──────────┴──────────┴────────────────┘

  ENCODING SPEED (tradeoff):
  JPEG: Fastest encoding
  WebP: Fast encoding
  AVIF: SLOW encoding (2-10x slower than WebP)
  → Use AVIF for build-time/CDN optimization (pre-encoded)
  → Use WebP for real-time/on-the-fly encoding

  DECISION:
  • Default to WebP for all photos and complex graphics
  • Use AVIF as progressive enhancement (with WebP fallback)
  • Use SVG for icons, logos, simple illustrations
  • Use PNG only for images requiring transparency + lossless
  • NEVER use GIF — use <video> or animated WebP/AVIF
```

---

## 2. Responsive Images

### 2.1 srcset and sizes

```html
<!-- RESPONSIVE IMAGES — Serve right size for device -->

<!-- srcset with width descriptors (most common) -->
<img
  src="/hero-800.webp"
  srcset="
    /hero-400.webp   400w,
    /hero-800.webp   800w,
    /hero-1200.webp 1200w,
    /hero-1600.webp 1600w,
    /hero-2000.webp 2000w
  "
  sizes="
    (max-width: 640px) 100vw,
    (max-width: 1024px) 75vw,
    50vw
  "
  alt="Hero image"
  width="2000"
  height="1000"
  fetchpriority="high"
/>

<!--
  HOW THE BROWSER USES THIS:
  1. Reads 'sizes' to determine display width
     - On 375px phone: 100vw = 375px
     - On 768px tablet: 75vw = 576px
     - On 1440px desktop: 50vw = 720px

  2. Multiplies by device pixel ratio (DPR)
     - 375px × 2 DPR = needs ~750w image
     - 576px × 2 DPR = needs ~1152w image
     - 720px × 2 DPR = needs ~1440w image

  3. Picks closest srcset candidate
     - Phone: selects hero-800.webp
     - Tablet: selects hero-1200.webp
     - Desktop: selects hero-1600.webp
-->


<!-- Art direction with <picture> element -->
<!-- Different crops/compositions for different viewports -->
<picture>
  <!-- Mobile: square crop (portrait-friendly) -->
  <source
    media="(max-width: 640px)"
    srcset="/hero-mobile-400.avif 400w, /hero-mobile-800.avif 800w"
    sizes="100vw"
    type="image/avif"
  />
  <source
    media="(max-width: 640px)"
    srcset="/hero-mobile-400.webp 400w, /hero-mobile-800.webp 800w"
    sizes="100vw"
    type="image/webp"
  />

  <!-- Desktop: wide crop (landscape) -->
  <source
    srcset="/hero-desktop-1200.avif 1200w, /hero-desktop-2000.avif 2000w"
    sizes="100vw"
    type="image/avif"
  />
  <source
    srcset="/hero-desktop-1200.webp 1200w, /hero-desktop-2000.webp 2000w"
    sizes="100vw"
    type="image/webp"
  />

  <!-- Fallback (JPEG for ancient browsers) -->
  <img
    src="/hero-desktop-1200.jpg"
    alt="Hero"
    width="2000"
    height="1000"
    fetchpriority="high"
  />
</picture>
```

### 2.2 Common Responsive Image Breakpoints

```
RECOMMENDED srcset WIDTHS:

  For full-width hero images:
  400, 800, 1200, 1600, 2000, 2400

  For content images (max ~800px display):
  300, 600, 900, 1200

  For thumbnails:
  150, 300, 450

  RULE OF THUMB:
  • Start at smallest display width
  • Increment by ~400px
  • Go up to 2x the maximum display width (for Retina)
  • Each step should save at least 20KB vs the next size up
  • Don't create more than 5-6 sizes (diminishing returns)
```

---

## 3. Loading Strategies

### 3.1 Lazy Loading

```html
<!-- NATIVE LAZY LOADING (recommended) -->
<!-- Below-fold images: load when near viewport -->
<img
  src="/product.webp"
  alt="Product"
  loading="lazy"
  width="400"
  height="400"
  decoding="async"
/>

<!-- HERO IMAGE: Never lazy load! -->
<img
  src="/hero.webp"
  alt="Hero"
  loading="eager"
  fetchpriority="high"
  width="1200"
  height="600"
/>

<!--
  loading="lazy"  → Defers loading until near viewport
  loading="eager" → Loads immediately (default)
  decoding="async" → Decode off main thread (reduces INP impact)
  fetchpriority="high" → Prioritize this over other resources
  fetchpriority="low"  → Deprioritize (below-fold, decorative)
-->
```

```typescript
// Intersection Observer (custom lazy loading with effects)
function lazyLoadWithFade(images: NodeListOf<HTMLImageElement>) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          img.src = img.dataset.src!;
          img.classList.add('loaded'); // CSS: .loaded { opacity: 1; }
          observer.unobserve(img);
        }
      });
    },
    {
      rootMargin: '200px', // Start loading 200px before viewport
      threshold: 0,
    }
  );

  images.forEach(img => observer.observe(img));
}
```

### 3.2 Priority Hints

```html
<!-- fetchpriority tells the browser how important a resource is -->

<!-- HERO IMAGE — highest priority (LCP element) -->
<img src="/hero.webp" fetchpriority="high" />

<!-- BELOW-FOLD IMAGES — lower priority -->
<img src="/footer-logo.webp" fetchpriority="low" loading="lazy" />

<!-- PRELOAD with priority -->
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />

<!-- BACKGROUND IMAGE preload -->
<link rel="preload" as="image"
      href="/hero-bg.webp"
      imagesrcset="/hero-bg-800.webp 800w, /hero-bg-1600.webp 1600w"
      imagesizes="100vw" />

<!--
  PRIORITY RULES:
  1. Above-fold LCP image: fetchpriority="high" + NO lazy loading
  2. Above-fold non-LCP images: default priority
  3. Below-fold images: loading="lazy" + fetchpriority="low"
  4. Decorative images: loading="lazy" + fetchpriority="low"
-->
```

---

## 4. Framework Image Components

### 4.1 Next.js Image

```typescript
import Image from 'next/image';

// BASIC USAGE — automatic optimization
export function ProductCard({ product }: { product: Product }) {
  return (
    <Image
      src={product.imageUrl}
      alt={product.name}
      width={400}
      height={400}
      // Automatic: WebP/AVIF, responsive srcset, lazy loading
    />
  );
}

// HERO IMAGE — priority loading
export function Hero() {
  return (
    <Image
      src="/hero.webp"
      alt="Hero"
      width={1920}
      height={1080}
      priority          // Disables lazy loading, preloads
      sizes="100vw"     // Full width
      quality={85}
      placeholder="blur" // Show blur placeholder while loading
      blurDataURL={blurHash} // Base64 blur placeholder
    />
  );
}

// FILL MODE — fills parent container
export function BackgroundImage() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '400px' }}>
      <Image
        src="/background.webp"
        alt="Background"
        fill                    // Fills parent container
        style={{ objectFit: 'cover' }}
        sizes="100vw"
        quality={75}
      />
    </div>
  );
}

// REMOTE IMAGES — configure domains
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.example.com' },
      { protocol: 'https', hostname: '**.cloudinary.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

// WHAT NEXT/IMAGE DOES AUTOMATICALLY:
// 1. Generates responsive srcset with multiple sizes
// 2. Serves WebP/AVIF based on browser Accept header
// 3. Lazy loads by default (below fold)
// 4. Prevents CLS by requiring width/height
// 5. Optimizes quality on the fly
// 6. Caches optimized images
```

### 4.2 Nuxt Image

```vue
<template>
  <!-- NuxtImg — automatic optimization -->
  <NuxtImg
    src="/hero.jpg"
    alt="Hero"
    width="1200"
    height="600"
    format="webp"
    quality="85"
    sizes="sm:100vw md:75vw lg:50vw"
    preload
  />

  <!-- NuxtPicture — format negotiation with <picture> -->
  <NuxtPicture
    src="/product.jpg"
    alt="Product"
    width="400"
    height="400"
    sizes="sm:50vw md:33vw"
    format="avif,webp"
    :imgAttrs="{ class: 'product-image' }"
  />

  <!-- With provider (Cloudinary, imgix, etc.) -->
  <NuxtImg
    provider="cloudinary"
    src="/products/shoe.jpg"
    width="400"
    height="400"
    fit="fill"
    :modifiers="{ roundCorner: 16 }"
  />
</template>

<script setup>
// nuxt.config.ts
// export default defineNuxtConfig({
//   image: {
//     provider: 'cloudinary',
//     cloudinary: { baseURL: 'https://res.cloudinary.com/demo/image/upload/' },
//     screens: { xs: 320, sm: 640, md: 768, lg: 1024, xl: 1280 },
//   },
// });
</script>
```

### 4.3 Angular NgOptimizedImage

```typescript
// Angular 15+ built-in image optimization

import { NgOptimizedImage } from '@angular/common';

@Component({
  standalone: true,
  imports: [NgOptimizedImage],
  template: `
    <!-- Basic usage -->
    <img ngSrc="/hero.webp" width="1200" height="600"
         priority />

    <!-- Responsive with srcset generation -->
    <img ngSrc="/product.webp" width="400" height="400"
         sizes="(max-width: 768px) 100vw, 50vw" />

    <!-- Fill mode -->
    <div style="position: relative; width: 100%; height: 300px;">
      <img ngSrc="/background.webp" fill />
    </div>

    <!-- With image loader (CDN) -->
    <img ngSrc="products/shoe.jpg" width="400" height="400" />
  `,
  providers: [
    provideCloudinaryLoader('https://res.cloudinary.com/demo'),
  ],
})
export class ProductComponent {}

// WHAT NgOptimizedImage DOES:
// 1. Enforces width/height (prevents CLS)
// 2. Auto-generates srcset for responsive images
// 3. Lazy loads by default
// 4. priority attribute for LCP images (preload hint)
// 5. Warns about missing alt text, oversized images
// 6. Supports image CDN loaders (Cloudinary, imgix, etc.)
```

---

## 5. Placeholder Strategies

```
PLACEHOLDER STRATEGIES — Perceived Performance

  NO PLACEHOLDER          LQIP               BLURHASH
  ┌────────────┐          ┌────────────┐      ┌────────────┐
  │            │          │ ░░░░░░░░░░ │      │ ▓▓▓▓▒▒▒▒░░ │
  │   Empty    │          │ ░░░░░░░░░░ │      │ ▓▓▓▒▒▒░░░░ │
  │   Space    │          │ ░░░░░░░░░░ │      │ ▓▒▒░░░░░░░ │
  │            │          │  (blurry   │      │  (colorful │
  │            │          │   tiny     │      │   gradient │
  │   (blank)  │          │   JPEG)    │      │   from     │
  │            │          │  ~1-2KB    │      │   hash)    │
  └────────────┘          └────────────┘      └────────────┘
       ❌ Bad               ✅ Good             ✅ Better

  DOMINANT COLOR         SKELETON             SQIP (SVG)
  ┌────────────┐          ┌────────────┐      ┌────────────┐
  │ ██████████ │          │ ┌────────┐ │      │ /\  ____   │
  │ ██████████ │          │ │        │ │      │/  \/    \  │
  │ ██████████ │          │ │ ~~~~~~ │ │      │     ____/  │
  │  (single   │          │ │ ~~~~~~ │ │      │  (SVG      │
  │   color    │          │ └────────┘ │      │   trace    │
  │   fill)    │          │  (CSS      │      │   of       │
  │  ~0 bytes  │          │   shimmer) │      │   image)   │
  └────────────┘          └────────────┘      └────────────┘
       ✅ Simple            ✅ Clean             ✅ Artistic
```

```typescript
// BLURHASH — Compact image placeholder (4-6 bytes hash → colorful blur)
// npm install blurhash

// Server-side: Generate hash
import { encode } from 'blurhash';
const hash = encode(imageData, width, height, 4, 3); // e.g., "LEHV6nWB2yk8pyo0adR*.7kCMdnj"

// Client-side: Decode hash to canvas/CSS
import { decode } from 'blurhash';
const pixels = decode(hash, 32, 32); // Returns Uint8ClampedArray

// React component with BlurHash
function BlurHashImage({ src, hash, alt, width, height }: Props) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div style={{ position: 'relative', width, height }}>
      {!loaded && <Blurhash hash={hash} width={width} height={height} />}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
      />
    </div>
  );
}


// LQIP — Low Quality Image Placeholder (tiny blurred JPEG)
// Generate: sharp input.jpg -resize 20 -blur 5 -quality 20 output-lqip.jpg
// Result: ~500 bytes, can be base64 inlined

// Next.js built-in:
<Image
  src="/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQ..." // Tiny base64 JPEG
/>


// DOMINANT COLOR — Extract and use as background
// CSS approach (zero network cost):
<div style="background-color: #2a6b3f; aspect-ratio: 16/9;">
  <img src="/forest.webp" alt="Forest"
       loading="lazy" style="opacity: 0; transition: opacity 0.3s;"
       onload="this.style.opacity=1" />
</div>
```

---

## 6. SVG Optimization

```
SVG USE CASES:
  ✅ Icons, logos, simple illustrations
  ✅ Diagrams, charts, graphs
  ✅ Animations (CSS/SMIL)
  ✅ Responsive graphics (scale perfectly)
  ❌ Photos (use JPEG/WebP/AVIF)
  ❌ Complex illustrations with many gradients (may be larger than raster)
```

```typescript
// SVGO — SVG Optimizer
// npm install -D svgo

// svgo.config.js
module.exports = {
  plugins: [
    'removeDoctype',
    'removeComments',
    'removeMetadata',
    'removeEditorsNSData',
    'cleanupAttrs',
    'mergeStyles',
    'inlineStyles',
    'minifyStyles',
    'removeUselessDefs',
    'cleanupNumericValues',
    'convertColors',
    'removeUnknownsAndDefaults',
    'removeNonInheritableGroupAttrs',
    'removeUselessStrokeAndFill',
    'cleanupIds',
    'removeEmptyContainers',
    'mergePaths',
    'convertPathData',
    'convertTransform',
    // DO NOT use these on accessible SVGs:
    // 'removeTitle',
    // 'removeDesc',
  ],
};

// Run: npx svgo input.svg -o output.svg
// Typical savings: 30-60% file size reduction

// INLINE SVG for icons (no extra HTTP request)
function IconCheck({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2"
         className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// SVG SPRITE (many icons, one request)
// icons.svg
// <svg xmlns="http://www.w3.org/2000/svg">
//   <symbol id="icon-check" viewBox="0 0 24 24">
//     <polyline points="20 6 9 17 4 12" />
//   </symbol>
//   <symbol id="icon-close" viewBox="0 0 24 24">
//     <line x1="18" y1="6" x2="6" y2="18" />
//     <line x1="6" y1="6" x2="18" y2="18" />
//   </symbol>
// </svg>

// Usage:
// <svg class="icon"><use href="/icons.svg#icon-check" /></svg>
```

---

## 7. Image CDN Services

```
IMAGE CDN COMPARISON:

  ┌──────────────────┬──────────────────────────────────────────────┐
  │ Service          │ Features                                     │
  ├──────────────────┼──────────────────────────────────────────────┤
  │ Cloudinary       │ Transformation URL API, AI cropping, video,  │
  │                  │ DAM, generous free tier, largest feature set │
  ├──────────────────┼──────────────────────────────────────────────┤
  │ imgix            │ Real-time processing, excellent CDN, fast,   │
  │                  │ URL-based API, great documentation           │
  ├──────────────────┼──────────────────────────────────────────────┤
  │ Cloudflare Images│ Part of Cloudflare ecosystem, cheap at       │
  │                  │ scale, variants system, Image Resizing       │
  ├──────────────────┼──────────────────────────────────────────────┤
  │ Vercel OG Image  │ Dynamic social images, Edge Function based,  │
  │                  │ React component → image at the edge          │
  ├──────────────────┼──────────────────────────────────────────────┤
  │ AWS CloudFront + │ Lambda@Edge for transformations, S3 origin,  │
  │ Lambda@Edge      │ most control, complex setup                  │
  ├──────────────────┼──────────────────────────────────────────────┤
  │ Bunny CDN        │ Built-in optimization, cheap, fast global    │
  │ Optimizer        │ CDN, simple setup                            │
  └──────────────────┴──────────────────────────────────────────────┘

  TRANSFORMATION URL PATTERN (Cloudinary example):
  https://res.cloudinary.com/demo/image/upload/
    w_400,h_400,c_fill,q_auto,f_auto/
    products/shoe.jpg

  URL segments:
  w_400     → Width 400px
  h_400     → Height 400px
  c_fill    → Crop to fill (like object-fit: cover)
  q_auto    → Automatic quality (varies per format)
  f_auto    → Automatic format (AVIF > WebP > JPEG based on browser)
```

---

## 8. Build-Time Image Optimization

```typescript
// SHARP — High-performance Node.js image processing
// npm install sharp

import sharp from 'sharp';

// Optimize and convert to multiple formats
async function optimizeImage(inputPath: string, outputDir: string) {
  const image = sharp(inputPath);
  const metadata = await image.metadata();

  const widths = [400, 800, 1200, 1600, 2000];
  const formats = ['webp', 'avif'] as const;

  for (const width of widths) {
    if (width > (metadata.width ?? Infinity)) continue;

    for (const format of formats) {
      await image
        .resize(width)
        .toFormat(format, {
          quality: format === 'avif' ? 70 : 80,
          effort: format === 'avif' ? 4 : 6, // AVIF encoding effort (0-9)
        })
        .toFile(`${outputDir}/image-${width}.${format}`);
    }
  }
}

// VITE PLUGIN for automatic image optimization
// npm install vite-imagetools
// vite.config.ts
import { imagetools } from 'vite-imagetools';

export default defineConfig({
  plugins: [
    imagetools({
      defaultDirectives: (url) => {
        if (url.searchParams.has('hero')) {
          return new URLSearchParams('w=400;800;1200;1600&format=webp;avif');
        }
        return new URLSearchParams();
      },
    }),
  ],
});

// Usage in code:
// import heroSrcset from './hero.jpg?w=400;800;1200;1600&format=webp&as=srcset';
// <img srcset={heroSrcset} sizes="100vw" />
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Serving unoptimized images** | 2MB JPEG hero image, LCP > 5s, page weight > 5MB | Use image CDN or build-time optimization; target < 200KB per image |
| **Missing width/height on images** | CLS > 0.25 as images load and push content | ALWAYS set width/height attributes or CSS aspect-ratio |
| **Lazy loading hero image** | LCP delayed — browser waits until viewport check | Use `loading="eager"` + `fetchpriority="high"` on hero/LCP image |
| **Not using modern formats** | Serving JPEG/PNG when WebP/AVIF saves 30-50% | Use `<picture>` with AVIF + WebP sources, JPEG fallback |
| **Same image for all screen sizes** | 2000px image on 375px phone, wasting bandwidth | Use srcset with multiple sizes matching actual display widths |
| **No placeholder strategy** | Blank space → sudden image pop-in (poor perceived performance) | Use BlurHash, LQIP, or dominant color placeholder |
| **Oversized images for containers** | 4000px image in a 400px container | NEVER serve images wider than 2x the display container width |
| **Base64 inlining large images** | Images > 2KB embedded in HTML/CSS, bloating document size | Only inline images < 1KB; use external files for anything larger |
| **Too many image requests** | 50+ unoptimized images loading simultaneously | Lazy load below-fold, use sprites for icons, consolidate small images |
| **Using GIF for animations** | 5MB GIF file, poor quality, slow loading | Use `<video>` with WebM/MP4 or animated WebP/AVIF |
| **Not using fetchpriority** | LCP image competes with other resources for bandwidth | Set `fetchpriority="high"` on LCP image, `"low"` on decorative |

---

## 10. Enforcement Checklist

### Format & Quality
- [ ] WebP used as default format for all photographic images
- [ ] AVIF served as progressive enhancement where supported
- [ ] SVG used for icons, logos, and simple illustrations
- [ ] Image quality set to 75-85 (not 100 — diminishing returns)
- [ ] No GIF files — replaced with `<video>` or animated WebP

### Responsive Images
- [ ] `srcset` with width descriptors on all content images
- [ ] `sizes` attribute accurately describes display width per breakpoint
- [ ] Images never wider than 2x their maximum display width
- [ ] `<picture>` used for art direction (different crops per viewport)
- [ ] Framework image component used (Next.js Image, NuxtImg, NgOptimizedImage)

### Loading Strategy
- [ ] Hero/LCP image: `loading="eager"` + `fetchpriority="high"` + preloaded
- [ ] Below-fold images: `loading="lazy"` + `decoding="async"`
- [ ] Placeholder strategy implemented (BlurHash, LQIP, or dominant color)
- [ ] `<link rel="preload">` for critical above-fold images

### Dimensions & CLS
- [ ] ALL `<img>` tags have explicit `width` and `height` attributes
- [ ] CSS `aspect-ratio` used where dimensions are dynamic
- [ ] No images without dimensions in the entire codebase

### Infrastructure
- [ ] Image CDN or build-time optimization pipeline configured
- [ ] Automatic format negotiation (f_auto or Accept header based)
- [ ] Image sizes cached and served from CDN edge
- [ ] SVGs optimized with SVGO before deployment
