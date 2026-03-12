# Responsive Design — Complete Specification

> **AI Plugin Directive:** When implementing responsive layouts, choosing breakpoint strategies, using container queries, implementing fluid typography, or optimizing responsive images, ALWAYS consult this guide. Apply these responsive design patterns to create layouts that work across all viewport sizes and device capabilities. This guide covers mobile-first methodology, breakpoints, container queries, fluid typography, responsive images, and layout techniques.

**Core Rule: ALWAYS design mobile-first — base styles target the smallest viewport, then progressively enhance with min-width media queries. NEVER use max-width media queries as the primary strategy. Use container queries (@container) for component-level responsiveness. Use clamp() for fluid typography and spacing. ALWAYS provide responsive images with srcset and sizes — NEVER serve desktop images to mobile devices.**

---

## 1. Mobile-First Methodology

```
                    MOBILE-FIRST vs DESKTOP-FIRST

  MOBILE-FIRST (CORRECT):
  ┌─────────────────────────────────────────────────────────┐
  │  Base CSS → Mobile styles (no media query)              │
  │  @media (min-width: 768px) → Tablet enhancements        │
  │  @media (min-width: 1024px) → Desktop enhancements       │
  │                                                         │
  │  Progressive enhancement: ADD complexity as space grows  │
  │  Smaller CSS (mobile styles don't need media queries)    │
  │  Forces you to prioritize content                        │
  └─────────────────────────────────────────────────────────┘

  DESKTOP-FIRST (AVOID):
  ┌─────────────────────────────────────────────────────────┐
  │  Base CSS → Desktop styles (no media query)             │
  │  @media (max-width: 1023px) → Tablet overrides           │
  │  @media (max-width: 767px) → Mobile overrides             │
  │                                                         │
  │  Graceful degradation: REMOVE features as space shrinks  │
  │  More CSS (overriding desktop styles for mobile)         │
  │  Temptation to "hide things" on mobile                   │
  └─────────────────────────────────────────────────────────┘

  WHY MOBILE-FIRST:
  ├── Performance: Mobile devices parse less CSS
  ├── Content priority: Forces hierarchy decisions early
  ├── Progressive enhancement: Works on lowest-capability devices
  ├── Smaller base CSS: No media query needed for mobile
  ├── Natural flow: HTML is already single-column by default
  └── Future-proof: New devices tend toward smaller, not larger
```

### 1.1 Mobile-First CSS Pattern

```css
/* Base styles — Mobile (no media query) */
.container {
  padding: 1rem;
  max-width: 100%;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.hero-title {
  font-size: 1.75rem;
  line-height: 1.2;
}

.sidebar {
  display: none; /* Hidden on mobile — content first */
}

/* Tablet — min-width: 768px */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
    max-width: 768px;
    margin: 0 auto;
  }

  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .hero-title {
    font-size: 2.5rem;
  }

  .sidebar {
    display: block; /* Show on tablet+ */
  }
}

/* Desktop — min-width: 1024px */
@media (min-width: 1024px) {
  .container {
    max-width: 1024px;
  }

  .grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
  }

  .hero-title {
    font-size: 3.5rem;
  }
}

/* Large desktop — min-width: 1280px */
@media (min-width: 1280px) {
  .container {
    max-width: 1200px;
  }

  .grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

---

## 2. Breakpoint Systems

```
                    COMMON BREAKPOINT SYSTEMS

  Tailwind CSS:
  ┌──────────┬──────────┬──────────────────┐
  │ Token    │ Width    │ Target            │
  ├──────────┼──────────┼──────────────────┤
  │ sm       │ 640px    │ Large phones      │
  │ md       │ 768px    │ Tablets           │
  │ lg       │ 1024px   │ Laptops           │
  │ xl       │ 1280px   │ Desktops          │
  │ 2xl      │ 1536px   │ Large screens     │
  └──────────┴──────────┴──────────────────┘

  Bootstrap 5:
  ┌──────────┬──────────┬──────────────────┐
  │ Token    │ Width    │ Target            │
  ├──────────┼──────────┼──────────────────┤
  │ sm       │ 576px    │ Phones landscape  │
  │ md       │ 768px    │ Tablets           │
  │ lg       │ 992px    │ Desktops          │
  │ xl       │ 1200px   │ Large desktops    │
  │ xxl      │ 1400px   │ Huge screens      │
  └──────────┴──────────┴──────────────────┘

  BREAKPOINT BEST PRACTICES:
  ├── Use rem or em for breakpoints (respects user font-size prefs)
  ├── 3-5 breakpoints is sufficient for most projects
  ├── NEVER create breakpoints targeting specific devices
  ├── Base breakpoints on content needs, not device widths
  ├── Test at breakpoint boundaries AND between breakpoints
  └── Consider using container queries instead for components
```

### 2.1 Breakpoints in CSS Custom Properties

```css
/* tokens.css — Breakpoint tokens */
:root {
  /* These are for JavaScript reference only — CSS can't use vars in media queries */
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}

/* Breakpoint mixins (SCSS/PostCSS) */
/* @custom-media --sm (min-width: 640px); */
/* @custom-media --md (min-width: 768px); */
/* @custom-media --lg (min-width: 1024px); */
/* @custom-media --xl (min-width: 1280px); */
```

```typescript
// hooks/useMediaQuery.ts — Breakpoints in JavaScript
import { useEffect, useState } from 'react';

const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    function listener(event: MediaQueryListEvent) {
      setMatches(event.matches);
    }

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

export function useBreakpoint(bp: keyof typeof breakpoints): boolean {
  return useMediaQuery(`(min-width: ${breakpoints[bp]})`);
}

// Usage
function Sidebar() {
  const isDesktop = useBreakpoint('lg');
  if (!isDesktop) return null;
  return <aside>...</aside>;
}
```

---

## 3. Container Queries (@container)

```
                    CONTAINER QUERIES vs MEDIA QUERIES

  Media Queries:
  ┌─────────────────────────────────────────────────────┐
  │  Query the VIEWPORT size                             │
  │  A sidebar component at 300px in a 1920px viewport   │
  │  → media query says "desktop" but component is tiny  │
  │  Problem: Components don't know their own size       │
  └─────────────────────────────────────────────────────┘

  Container Queries:
  ┌─────────────────────────────────────────────────────┐
  │  Query the CONTAINER (parent) size                   │
  │  A sidebar component at 300px → query says "narrow"  │
  │  Same component in main area at 800px → "wide"       │
  │  Components adapt to where they're placed            │
  └─────────────────────────────────────────────────────┘

  WHEN TO USE:
  ├── Media queries  → Page layout, overall structure
  ├── Container queries → Component-level responsiveness
  └── Both → Combined for comprehensive responsive design

  BROWSER SUPPORT (2024+):
  ├── Chrome 105+ ✓
  ├── Firefox 110+ ✓
  ├── Safari 16+ ✓
  └── ~95% global support
```

### 3.1 Container Query Implementation

```css
/* Container query setup */

/* Step 1: Define a containment context */
.card-grid {
  container-type: inline-size;  /* Query width of this container */
  container-name: card-grid;     /* Optional: name for targeted queries */
}

/* Shorthand */
.sidebar {
  container: sidebar / inline-size;
}

/* Step 2: Write container queries */
.card {
  /* Base: single column layout */
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
}

/* When container is at least 400px wide */
@container (min-width: 400px) {
  .card {
    flex-direction: row;
    padding: 1.5rem;
  }
}

/* When container is at least 700px wide */
@container (min-width: 700px) {
  .card {
    gap: 1.5rem;
    padding: 2rem;
  }

  .card-title {
    font-size: 1.5rem;
  }
}

/* Named container query (targets specific container) */
@container sidebar (max-width: 250px) {
  .nav-item {
    /* Collapse to icon-only when sidebar is narrow */
    padding: 0.5rem;
  }

  .nav-label {
    display: none;
  }
}

/* Container query units */
.hero-text {
  /* cqi = 1% of container's inline size (width in horizontal writing) */
  font-size: clamp(1rem, 4cqi, 2.5rem);
}

.spacing {
  padding: 2cqi;           /* 2% of container width */
  gap: max(1rem, 2cqi);   /* At least 1rem, scales with container */
}
```

### 3.2 Container Queries with CSS Modules

```css
/* ProductCard.module.css */
.container {
  container-type: inline-size;
}

.card {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 8px;
  background: var(--color-surface);
}

.image {
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  object-fit: cover;
  width: 100%;
}

.title {
  font-size: 1rem;
  font-weight: 600;
}

.price {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-primary);
}

/* Horizontal layout when container is wide enough */
@container (min-width: 500px) {
  .card {
    grid-template-columns: 200px 1fr;
    grid-template-rows: auto auto;
  }

  .image {
    grid-row: 1 / -1;
    aspect-ratio: 1;
    height: 100%;
  }

  .title {
    font-size: 1.25rem;
  }
}
```

```tsx
// ProductCard.tsx
import styles from './ProductCard.module.css';

function ProductCard({ product }: { product: Product }) {
  return (
    <div className={styles.container}>
      <article className={styles.card}>
        <img className={styles.image} src={product.image} alt={product.name} />
        <h3 className={styles.title}>{product.name}</h3>
        <span className={styles.price}>${product.price}</span>
      </article>
    </div>
  );
}

// Works in any layout — card adapts to available space
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
  <ProductCard product={p} /> {/* Narrow — vertical layout */}
</div>
<div style={{ maxWidth: '800px' }}>
  <ProductCard product={p} /> {/* Wide — horizontal layout */}
</div>
```

### 3.3 Container Queries with Tailwind (v3 plugin / v4 native)

```tsx
// Tailwind v3 with @tailwindcss/container-queries plugin
<div className="@container">
  <div className="flex flex-col @md:flex-row @lg:gap-6">
    <img className="w-full @md:w-48" />
    <div className="@lg:text-xl">Content</div>
  </div>
</div>

// Named containers
<div className="@container/sidebar">
  <nav className="@[200px]/sidebar:flex-col">
    {/* Uses named container */}
  </nav>
</div>
```

---

## 4. Fluid Typography (clamp())

```
                    FLUID TYPOGRAPHY CONCEPT

  Fixed Typography:
  ┌─────────────────────────────────────────────────────┐
  │  font-size: 16px;                ← Same on all screens│
  │  @media (min-width: 768px) { font-size: 18px; }    │
  │  @media (min-width: 1024px) { font-size: 20px; }   │
  │  Problem: Jumps between sizes at breakpoints         │
  └─────────────────────────────────────────────────────┘

  Fluid Typography:
  ┌─────────────────────────────────────────────────────┐
  │  font-size: clamp(1rem, 0.5rem + 1.5vw, 1.5rem);  │
  │  Smoothly scales between min and max                │
  │  No breakpoints needed for typography               │
  │                                                     │
  │  clamp(MINIMUM, PREFERRED, MAXIMUM)                 │
  │  ├── MINIMUM: Floor (accessibility — never too small)│
  │  ├── PREFERRED: Scales with viewport (vw-based)     │
  │  └── MAXIMUM: Ceiling (never too large)             │
  └─────────────────────────────────────────────────────┘

  FORMULA:
  clamp(min, preferred, max)
  preferred = (min_rem) + (max_rem - min_rem) * (100vw - min_vw) / (max_vw - min_vw)

  SIMPLIFIED: Use a calculator or these common patterns
```

### 4.1 Fluid Typography Scale

```css
/* Fluid type scale — scales from 320px to 1280px viewport */
:root {
  /* Body text: 16px → 18px */
  --text-body: clamp(1rem, 0.957rem + 0.21vw, 1.125rem);

  /* Small text: 14px → 16px */
  --text-sm: clamp(0.875rem, 0.832rem + 0.21vw, 1rem);

  /* H4: 18px → 22px */
  --text-lg: clamp(1.125rem, 1.039rem + 0.43vw, 1.375rem);

  /* H3: 22px → 28px */
  --text-xl: clamp(1.375rem, 1.246rem + 0.64vw, 1.75rem);

  /* H2: 28px → 40px */
  --text-2xl: clamp(1.75rem, 1.493rem + 1.28vw, 2.5rem);

  /* H1: 36px → 60px */
  --text-3xl: clamp(2.25rem, 1.736rem + 2.57vw, 3.75rem);

  /* Display: 48px → 80px */
  --text-4xl: clamp(3rem, 2.314rem + 3.43vw, 5rem);

  /* Fluid spacing */
  --space-sm: clamp(0.5rem, 0.414rem + 0.43vw, 0.75rem);
  --space-md: clamp(1rem, 0.829rem + 0.85vw, 1.5rem);
  --space-lg: clamp(1.5rem, 1.157rem + 1.71vw, 2.5rem);
  --space-xl: clamp(2rem, 1.486rem + 2.57vw, 3.5rem);
}

/* Usage */
h1 { font-size: var(--text-3xl); }
h2 { font-size: var(--text-2xl); }
h3 { font-size: var(--text-xl); }
p  { font-size: var(--text-body); }

.section {
  padding: var(--space-xl) var(--space-lg);
}
```

### 4.2 Fluid Typography in Tailwind

```tsx
// Using arbitrary values for fluid type
<h1 className="text-[clamp(2.25rem,1.736rem+2.57vw,3.75rem)]">
  Fluid Heading
</h1>

// Better: Define in theme
// tailwind.config.ts
export default {
  theme: {
    extend: {
      fontSize: {
        'fluid-sm': 'clamp(0.875rem, 0.832rem + 0.21vw, 1rem)',
        'fluid-base': 'clamp(1rem, 0.957rem + 0.21vw, 1.125rem)',
        'fluid-lg': 'clamp(1.125rem, 1.039rem + 0.43vw, 1.375rem)',
        'fluid-xl': 'clamp(1.375rem, 1.246rem + 0.64vw, 1.75rem)',
        'fluid-2xl': 'clamp(1.75rem, 1.493rem + 1.28vw, 2.5rem)',
        'fluid-3xl': 'clamp(2.25rem, 1.736rem + 2.57vw, 3.75rem)',
        'fluid-4xl': 'clamp(3rem, 2.314rem + 3.43vw, 5rem)',
      },
    },
  },
};

// Usage
<h1 className="text-fluid-3xl font-bold">Scales Smoothly</h1>
```

---

## 5. aspect-ratio

```css
/* Modern aspect-ratio property */
.video-container {
  aspect-ratio: 16 / 9;
  width: 100%;
}

.square-avatar {
  aspect-ratio: 1;            /* Same as 1 / 1 */
  width: 100%;
  max-width: 200px;
  border-radius: 50%;
  object-fit: cover;
}

.card-image {
  aspect-ratio: 4 / 3;
  width: 100%;
  object-fit: cover;
  border-radius: 8px;
}

/* Responsive aspect ratios */
.hero-image {
  aspect-ratio: 16 / 9;
  width: 100%;
  object-fit: cover;
}

@media (min-width: 768px) {
  .hero-image {
    aspect-ratio: 21 / 9;    /* Wider on desktop */
  }
}

/* Tailwind */
/* aspect-video → 16/9, aspect-square → 1/1, aspect-[4/3] → custom */
```

---

## 6. Responsive Images

```
                    RESPONSIVE IMAGE STRATEGY

  ┌────────────────────────────────────────────────────────┐
  │  srcset + sizes = Resolution Switching                  │
  │  ├── Same image, different file sizes                  │
  │  ├── Browser picks optimal size based on viewport      │
  │  └── Use for MOST responsive images                    │
  │                                                        │
  │  <picture> + <source> = Art Direction                  │
  │  ├── Different crops/images for different viewports    │
  │  ├── Use when image composition changes per size       │
  │  └── Also used for format switching (WebP, AVIF)       │
  └────────────────────────────────────────────────────────┘
```

### 6.1 srcset and sizes

```html
<!-- Resolution switching: Same image, different sizes -->
<img
  src="hero-800.jpg"
  srcset="
    hero-400.jpg   400w,
    hero-800.jpg   800w,
    hero-1200.jpg  1200w,
    hero-1600.jpg  1600w,
    hero-2400.jpg  2400w
  "
  sizes="
    (min-width: 1280px) 1200px,
    (min-width: 768px) calc(100vw - 4rem),
    calc(100vw - 2rem)
  "
  alt="Hero image"
  loading="lazy"
  decoding="async"
  fetchpriority="high"
/>

<!--
  HOW sizes WORKS:
  ├── Browser evaluates media conditions LEFT to RIGHT
  ├── First match determines the display size
  ├── Browser then picks the best srcset image for that size
  ├── Considers device pixel ratio (DPR) automatically
  │   └── On 2x display, 800px display size → picks 1600w image
  └── sizes MUST accurately reflect CSS layout width

  sizes="
    (min-width: 1280px) 1200px,        ← At 1280px+, image is 1200px
    (min-width: 768px) calc(100vw - 4rem), ← At 768px+, full width minus padding
    calc(100vw - 2rem)                     ← Default (mobile), full width minus padding
  "
-->

<!-- Pixel density switching (for fixed-size images like logos) -->
<img
  src="logo-200.png"
  srcset="
    logo-200.png 1x,
    logo-400.png 2x,
    logo-600.png 3x
  "
  alt="Company Logo"
  width="200"
  height="50"
/>
```

### 6.2 Picture Element (Art Direction + Format Switching)

```html
<!-- Art Direction: Different crops per viewport -->
<picture>
  <!-- Desktop: wide landscape crop -->
  <source
    media="(min-width: 1024px)"
    srcset="hero-desktop-1600.webp 1600w, hero-desktop-2400.webp 2400w"
    sizes="100vw"
    type="image/webp"
  />
  <source
    media="(min-width: 1024px)"
    srcset="hero-desktop-1600.jpg 1600w, hero-desktop-2400.jpg 2400w"
    sizes="100vw"
  />

  <!-- Tablet: standard landscape -->
  <source
    media="(min-width: 768px)"
    srcset="hero-tablet-800.webp 800w, hero-tablet-1200.webp 1200w"
    sizes="100vw"
    type="image/webp"
  />

  <!-- Mobile: portrait crop (different composition) -->
  <source
    srcset="hero-mobile-400.webp 400w, hero-mobile-800.webp 800w"
    sizes="100vw"
    type="image/webp"
  />

  <!-- Fallback -->
  <img
    src="hero-desktop-1600.jpg"
    alt="Hero image"
    loading="eager"
    decoding="async"
    fetchpriority="high"
    width="1600"
    height="900"
  />
</picture>

<!-- Format switching only (same image, modern formats) -->
<picture>
  <source srcset="photo.avif" type="image/avif" />
  <source srcset="photo.webp" type="image/webp" />
  <img src="photo.jpg" alt="Photo" loading="lazy" />
</picture>
```

### 6.3 Responsive Images in Next.js

```tsx
import Image from 'next/image';

// Next.js Image component handles responsive images automatically
function HeroImage() {
  return (
    <Image
      src="/hero.jpg"
      alt="Hero"
      width={1600}
      height={900}
      sizes="(min-width: 1280px) 1200px, (min-width: 768px) calc(100vw - 4rem), calc(100vw - 2rem)"
      priority           // LCP image — disable lazy loading
      quality={85}
      placeholder="blur" // Show blur while loading
      blurDataURL="..."  // Base64 blur placeholder
    />
  );
}

// Fill mode — image fills its container
function CardImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div style={{ position: 'relative', aspectRatio: '16/9' }}>
      <Image
        src={src}
        alt={alt}
        fill                    // Fills parent container
        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
        style={{ objectFit: 'cover' }}
        loading="lazy"
      />
    </div>
  );
}
```

---

## 7. Media Queries Best Practices

```
                    MEDIA QUERY PATTERNS

  STANDARD BREAKPOINTS (Mobile-First):
  @media (min-width: 640px)  { /* sm  */ }
  @media (min-width: 768px)  { /* md  */ }
  @media (min-width: 1024px) { /* lg  */ }
  @media (min-width: 1280px) { /* xl  */ }

  INTERACTION QUERIES (important for accessibility):
  @media (hover: hover) { /* Device has hover capability */ }
  @media (hover: none) { /* Touch-only device */ }
  @media (pointer: coarse) { /* Imprecise pointer (touch) */ }
  @media (pointer: fine) { /* Precise pointer (mouse) */ }

  PREFERENCE QUERIES:
  @media (prefers-color-scheme: dark) { /* Dark mode */ }
  @media (prefers-reduced-motion: reduce) { /* Reduce animations */ }
  @media (prefers-contrast: more) { /* High contrast */ }
  @media (prefers-reduced-transparency: reduce) { /* Less transparency */ }
  @media (forced-colors: active) { /* Windows High Contrast */ }

  DISPLAY QUERIES:
  @media (display-mode: standalone) { /* Installed PWA */ }
  @media (orientation: landscape) { /* Landscape orientation */ }
  @media (resolution >= 2dppx) { /* High-DPI display */ }

  RANGE SYNTAX (modern — Chrome 104+, Firefox 63+, Safari 16.4+):
  @media (640px <= width < 1024px) { /* Between sm and lg */ }
  @media (width >= 768px) { /* Same as min-width: 768px */ }
```

```css
/* Comprehensive responsive patterns */

/* Hover styles only on devices that support hover */
.button {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  background: var(--color-primary);
  color: white;
  transition: background 0.2s;
}

@media (hover: hover) {
  .button:hover {
    background: var(--color-primary-hover);
  }
}

/* Larger tap targets on touch devices */
@media (pointer: coarse) {
  .button {
    min-height: 44px;  /* Apple HIG minimum */
    min-width: 44px;
    padding: 0.875rem 1.75rem;
  }

  .link {
    padding: 0.5rem 0;  /* Add padding for larger tap target */
  }
}

/* Respect reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* High contrast mode */
@media (prefers-contrast: more) {
  :root {
    --color-border: black;
    --color-on-surface: black;
    --color-surface: white;
  }

  .button {
    border: 2px solid currentColor;
  }
}
```

---

## 8. Responsive Layouts (Grid and Flexbox)

```
                    LAYOUT STRATEGY DECISION

  ┌─────────────────────────────────────────┐
  │  One dimension (row OR column)?          │
  │  └── Use FLEXBOX                         │
  │                                          │
  │  Two dimensions (rows AND columns)?      │
  │  └── Use CSS GRID                        │
  │                                          │
  │  Content determines size?                │
  │  └── Use FLEXBOX                         │
  │                                          │
  │  Layout determines size?                 │
  │  └── Use CSS GRID                        │
  └─────────────────────────────────────────┘
```

### 8.1 Responsive Grid Patterns

```css
/* Auto-responsive grid — NO media queries needed */
.auto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
  gap: 1.5rem;
}
/*
  auto-fill: Creates as many columns as fit
  minmax(min(300px, 100%), 1fr):
  ├── min(300px, 100%): Prevents overflow on small screens
  ├── 300px minimum column width
  └── 1fr maximum (equal distribution of remaining space)
*/

/* Named grid areas — responsive layout restructuring */
.page-layout {
  display: grid;
  grid-template-areas:
    "header"
    "main"
    "sidebar"
    "footer";
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 768px) {
  .page-layout {
    grid-template-areas:
      "header  header"
      "main    sidebar"
      "footer  footer";
    grid-template-columns: 1fr 300px;
    gap: 1.5rem;
  }
}

@media (min-width: 1280px) {
  .page-layout {
    grid-template-areas:
      "header  header  header"
      "nav     main    sidebar"
      "footer  footer  footer";
    grid-template-columns: 200px 1fr 300px;
    gap: 2rem;
  }
}

.header  { grid-area: header; }
.main    { grid-area: main; }
.sidebar { grid-area: sidebar; }
.footer  { grid-area: footer; }

/* Subgrid — child aligns to parent grid */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
}

.card {
  display: grid;
  grid-template-rows: subgrid;  /* Aligns to parent's row tracks */
  grid-row: span 3;             /* Card spans 3 rows: image, title, body */
}
```

### 8.2 Responsive Flexbox Patterns

```css
/* Responsive navigation */
.nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

@media (min-width: 768px) {
  .nav {
    flex-direction: row;
    align-items: center;
    gap: 2rem;
  }
}

/* Flex wrap for card layouts */
.card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.card-list > * {
  flex: 1 1 300px;     /* Grow, shrink, min 300px before wrapping */
  max-width: 100%;     /* Prevent overflow on mobile */
}

/* Holy grail with flexbox */
.holy-grail {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.holy-grail-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

@media (min-width: 768px) {
  .holy-grail-main {
    flex-direction: row;
  }

  .holy-grail-content {
    flex: 1;
  }

  .holy-grail-sidebar {
    flex: 0 0 300px;
    order: -1;         /* Sidebar on left despite coming after in HTML */
  }
}

/* Responsive spacing with gap */
.stack {
  display: flex;
  flex-direction: column;
  gap: clamp(1rem, 2vw, 2rem);  /* Fluid gap */
}
```

---

## 9. Anti-Patterns

```
RESPONSIVE DESIGN ANTI-PATTERNS — NEVER DO THESE:

1. Desktop-first media queries
   BAD:  @media (max-width: 768px) { .sidebar { display: none; } }
   GOOD: .sidebar { display: none; } @media (min-width: 768px) { .sidebar { display: block; } }

2. Device-specific breakpoints
   BAD:  @media (width: 375px) { /* iPhone 12 */ }
   GOOD: @media (min-width: 768px) { /* Tablet and up */ }

3. Fixed widths on responsive elements
   BAD:  .container { width: 1200px; }
   GOOD: .container { max-width: 1200px; width: 100%; }

4. Horizontal scroll caused by overflow
   BAD:  .row { display: flex; } (no flex-wrap, items overflow)
   GOOD: .row { display: flex; flex-wrap: wrap; }

5. Not testing between breakpoints
   BAD:  Checking only 375px, 768px, and 1440px
   GOOD: Test at 500px, 650px, 900px, etc. — between breakpoints

6. Using only viewport units for typography
   BAD:  font-size: 3vw; (too small on mobile, too large on desktop)
   GOOD: font-size: clamp(1rem, 0.5rem + 1.5vw, 2rem);

7. Not providing sizes attribute on responsive images
   BAD:  <img srcset="..." /> (browser assumes 100vw)
   GOOD: <img srcset="..." sizes="(min-width: 768px) 50vw, 100vw" />

8. Serving large images to mobile devices
   BAD:  <img src="hero-2400.jpg" /> (everyone downloads 2400px)
   GOOD: Use srcset/sizes so mobile gets appropriately sized image

9. Hover-dependent interactions on touch devices
   BAD:  Dropdown only shows on :hover (touch users can't access)
   GOOD: @media (hover: hover) { } for hover-only styles, tap/click for touch

10. Hiding content instead of restructuring
    BAD:  .features { display: none; } on mobile
    GOOD: Restructure layout to show content differently
```
