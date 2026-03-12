# Font Loading — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to load fonts?", "font-display values", "FOUT vs FOIT", "preload fonts", "variable fonts", "Google Fonts performance", "font CLS", "self-host fonts", or any font loading question, ALWAYS consult this directive. Fonts are render-blocking by default and cause layout shifts (CLS) when they swap. Use `font-display: swap` for critical text, `font-display: optional` for zero CLS. ALWAYS preload critical fonts. Self-host for best performance. Use variable fonts to reduce file count.

**Core Rule: Web fonts cause TWO performance problems: 1) They block text rendering (FOIT) or cause text reflow (FOUT/CLS), and 2) They add download weight. Fix both by: preloading critical fonts (`<link rel="preload">`), using `font-display: swap` or `optional`, self-hosting (no third-party DNS/connection overhead), using variable fonts (one file for all weights), and matching fallback metrics with `size-adjust`. NEVER load more than 2-3 font families. ALWAYS subset fonts to include only needed characters.**

---

## 1. Font Loading Behavior

```
FONT LOADING TIMELINE:

  Page Load → Font Request → Font Download → Font Applied
       │           │              │              │
       ▼           ▼              ▼              ▼
  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐
  │ HTML    │ │ CSS     │ │ Download │ │ Font swap    │
  │ parsed  │ │ parsed, │ │ in       │ │ (text        │
  │         │ │ font    │ │ progress │ │  reflows if  │
  │         │ │ needed  │ │          │ │  metrics     │
  │         │ │         │ │          │ │  differ)     │
  └─────────┘ └─────────┘ └──────────┘ └──────────────┘


  FOIT (Flash of Invisible Text) — DEFAULT BROWSER BEHAVIOR:
  ┌──────────┬─────────────────────┬──────────────────────┐
  │  0-3s    │ Text is INVISIBLE   │ Font loads → visible │
  │          │ (blank space)       │ (or falls back)      │
  └──────────┴─────────────────────┴──────────────────────┘
  Problem: Users see blank text for up to 3 seconds!

  FOUT (Flash of Unstyled Text) — WITH font-display: swap:
  ┌──────────┬─────────────────────┬──────────────────────┐
  │  0ms     │ Fallback font shown │ Web font loads →     │
  │          │ immediately         │ text reflows (CLS!)  │
  └──────────┴─────────────────────┴──────────────────────┘
  Problem: Text shifts when web font replaces fallback!

  IDEAL — font-display: optional + preload:
  ┌──────────┬──────────────────────────────────────────────┐
  │  0ms     │ Fallback shown immediately. If font cached,  │
  │          │ web font used. If not cached, fallback used.  │
  │          │ NO layout shift. NO invisible text.           │
  └──────────┴──────────────────────────────────────────────┘
```

---

## 2. font-display Values

```css
/* font-display controls behavior during font loading */

@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom.woff2') format('woff2');

  /* ═══ SWAP ═══ */
  font-display: swap;
  /* Fallback shown IMMEDIATELY. Swaps to web font when loaded.
     GOOD: Text is always visible.
     BAD: May cause layout shift (CLS) when font swaps.
     USE FOR: Body text, critical headings.
     MOST COMMON CHOICE for readable content. */

  /* ═══ OPTIONAL ═══ */
  font-display: optional;
  /* Fallback shown IMMEDIATELY. Web font used ONLY if it loads
     within ~100ms (typically from cache). No swap on slow loads.
     GOOD: ZERO layout shift. ZERO invisible text.
     BAD: First-time visitors may not see web font.
     USE FOR: Branding fonts where CLS = 0 is critical. */

  /* ═══ FALLBACK ═══ */
  font-display: fallback;
  /* Invisible for ~100ms. If font hasn't loaded, show fallback.
     Swap to web font if it loads within ~3s.
     GOOD: Short invisible period + limited swap window.
     BAD: Still possible CLS within 3s window.
     USE FOR: Compromise between swap and optional. */

  /* ═══ BLOCK ═══ */
  font-display: block;
  /* Invisible for up to 3 seconds. Then fallback.
     GOOD: No FOUT.
     BAD: Text invisible for up to 3 seconds (FOIT)!
     USE FOR: Icon fonts (where fallback text is meaningless).
     NEVER use for body text. */

  /* ═══ AUTO ═══ */
  font-display: auto;
  /* Browser decides (usually behaves like 'block').
     NEVER use explicitly — always specify your strategy. */
}
```

```
FONT-DISPLAY DECISION TREE:

  START
    │
    ├── Is this an icon font?
    │   YES → font-display: block (fallback text is meaningless)
    │
    ├── Is CLS = 0 absolutely critical? (e.g., core web vitals focus)
    │   YES → font-display: optional (zero shift, first-timers get fallback)
    │
    ├── Is readability the top priority? (body text, articles)
    │   YES → font-display: swap (always readable, accept possible shift)
    │
    └── Want a compromise?
        YES → font-display: fallback (short block + limited swap window)

  RECOMMENDED DEFAULTS:
  • Body text: swap (with size-adjust fallback matching)
  • Headings: swap (with preload to minimize swap delay)
  • Icon fonts: block
  • Decorative/brand fonts: optional (zero CLS, graceful degradation)
```

---

## 3. Preloading Fonts

```html
<!-- PRELOAD critical fonts in <head> -->
<!-- This tells the browser to fetch the font IMMEDIATELY -->
<!-- without waiting for CSS to be parsed -->

<link
  rel="preload"
  as="font"
  href="/fonts/inter-var.woff2"
  type="font/woff2"
  crossorigin
/>
<!-- crossorigin is REQUIRED even for same-origin fonts! -->
<!-- Without it, the font is fetched twice (preload + @font-face) -->

<!-- Preload only the CRITICAL fonts (1-2 max) -->
<!-- ✅ Preload: Primary body font -->
<link rel="preload" as="font" href="/fonts/inter-var.woff2"
      type="font/woff2" crossorigin />

<!-- ✅ Preload: Primary heading font (if different) -->
<link rel="preload" as="font" href="/fonts/display-bold.woff2"
      type="font/woff2" crossorigin />

<!-- ❌ DON'T preload every weight/style — only the critical ones -->
<!-- ❌ DON'T preload more than 2-3 fonts (diminishes other preloads) -->


<!-- PRECONNECT to font CDN (if not self-hosting) -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

```typescript
// Next.js — Automatic font optimization (BEST approach)
// next/font handles preloading, subsetting, and zero-CLS automatically

import { Inter, Playfair_Display } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
});

// Layout:
export default function RootLayout({ children }) {
  return (
    <html className={`${inter.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}

// WHAT next/font DOES AUTOMATICALLY:
// 1. Self-hosts Google Fonts (no external request)
// 2. Generates optimized @font-face with size-adjust fallback
// 3. Preloads the font file
// 4. Subsets to only used characters
// 5. Creates CSS variable for easy use
// 6. Zero CLS — fallback font metrics matched automatically
```

---

## 4. Variable Fonts

```
VARIABLE FONTS — ONE FILE, ALL WEIGHTS/STYLES:

  STATIC FONTS (old way):
  ┌───────────────────────────┐
  │ inter-regular.woff2  20KB │
  │ inter-medium.woff2   20KB │
  │ inter-semibold.woff2 20KB │
  │ inter-bold.woff2     20KB │
  │ inter-italic.woff2   20KB │
  │                            │
  │ TOTAL: 100KB (5 files)    │
  └───────────────────────────┘

  VARIABLE FONT (new way):
  ┌───────────────────────────┐
  │ inter-var.woff2      35KB │
  │                            │
  │ Includes ALL weights       │
  │ (100-900) and styles       │
  │ in ONE file                │
  │                            │
  │ TOTAL: 35KB (1 file)      │
  │ SAVINGS: 65KB + 4 requests│
  └───────────────────────────┘

  RULE: If you use 3+ weights of the same font,
  a variable font is SMALLER than static files.
```

```css
/* Variable font @font-face */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2-variations');
  font-weight: 100 900;     /* Range of available weights */
  font-style: normal;
  font-display: swap;
}

/* Italic axis (separate file for Inter) */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var-italic.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-style: italic;
  font-display: swap;
}

/* USE any weight continuously (not just 400, 700 etc.) */
h1 { font-weight: 800; }
h2 { font-weight: 650; }    /* Non-standard weight — only with variable fonts */
body { font-weight: 400; }
.light { font-weight: 300; }

/* Variable font axes (optical size, width, etc.) */
.fancy-heading {
  font-variation-settings: 'wght' 750, 'opsz' 48;
}

/* Animation with variable fonts */
@keyframes weight-pulse {
  0% { font-weight: 400; }
  50% { font-weight: 700; }
  100% { font-weight: 400; }
}
.loading-text {
  animation: weight-pulse 2s ease-in-out infinite;
}
```

---

## 5. Self-Hosting vs CDN

```
SELF-HOSTING vs GOOGLE FONTS CDN:

  GOOGLE FONTS CDN:
  ┌──────────────────────────────────────────────────────┐
  │ PROS:                                                │
  │ • Easy setup (one <link> tag)                        │
  │ • Free, reliable CDN                                 │
  │ • Automatic format negotiation                       │
  │                                                      │
  │ CONS:                                                │
  │ • Extra DNS lookup + TLS connection (~100-300ms)     │
  │ • No shared cache (since Chrome 86 partitioned cache)│
  │ • GDPR concerns (user IP sent to Google)             │
  │ • No control over cache headers                      │
  │ • Requires preconnect for acceptable performance     │
  │ • Third-party dependency                             │
  └──────────────────────────────────────────────────────┘

  SELF-HOSTING (RECOMMENDED):
  ┌──────────────────────────────────────────────────────┐
  │ PROS:                                                │
  │ • Same origin = no extra DNS/TLS overhead            │
  │ • Full control over cache headers (immutable)        │
  │ • GDPR compliant (no data sent to Google)            │
  │ • Works with preload (same origin)                   │
  │ • Served from your CDN alongside other assets        │
  │ • Can subset to exact characters needed              │
  │                                                      │
  │ CONS:                                                │
  │ • Must manage font files yourself                    │
  │ • Must generate @font-face CSS                       │
  │ • Must handle format negotiation                     │
  └──────────────────────────────────────────────────────┘

  VERDICT: ALWAYS self-host in production.
  • Performance: ~100-300ms faster (no extra connection)
  • Privacy: GDPR compliant
  • Control: Custom subsetting, caching, preloading

  TOOLS FOR SELF-HOSTING:
  • google-webfonts-helper: Download + generate @font-face
  • fontsource (npm): npm install @fontsource-variable/inter
  • next/font: Auto self-hosts Google Fonts
```

```typescript
// FONTSOURCE — npm packages for every Google Font
// npm install @fontsource-variable/inter

// Import in your entry point
import '@fontsource-variable/inter'; // Includes CSS + font files
// or import specific weights:
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';

// CSS:
// body { font-family: 'Inter Variable', sans-serif; }
```

---

## 6. Font Subsetting

```css
/* UNICODE-RANGE SUBSETTING — Load only needed character sets */

/* Latin characters only (most Western languages) */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC,
                 U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074,
                 U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215,
                 U+FEFF, U+FFFD;
  font-display: swap;
}

/* Greek characters (loaded only if page uses Greek text) */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-greek.woff2') format('woff2');
  unicode-range: U+0370-03FF;
  font-display: swap;
}

/* Cyrillic characters */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-cyrillic.woff2') format('woff2');
  unicode-range: U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
  font-display: swap;
}

/*
  HOW unicode-range WORKS:
  1. Browser parses CSS, sees @font-face with unicode-range
  2. Browser checks if the page uses ANY characters in that range
  3. ONLY downloads the font file if characters are needed
  4. Result: English-only pages download only latin subset (~15KB vs 70KB)
*/
```

```bash
# GLYPHHANGER — Subset fonts to only characters used on your site
# npm install -g glyphhanger

# Analyze which characters your site uses
glyphhanger https://example.com

# Create a subset font file with only needed characters
glyphhanger --whitelist="ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz0123456789.,!?'" \
  --subset=inter.woff2

# Or subset to specific unicode ranges
glyphhanger --unicode="U+0000-00FF" --subset=inter.woff2

# PYFTSUBSET (fonttools) — More precise control
pip install fonttools brotli
pyftsubset inter.ttf \
  --unicodes="U+0000-00FF" \
  --layout-features="kern,liga" \
  --flavor="woff2" \
  --output-file="inter-latin.woff2"
```

---

## 7. Fallback Font Matching (Zero CLS)

```css
/* SIZE-ADJUST — Match fallback font metrics to web font */
/* This eliminates CLS when the web font loads and swaps */

/* Step 1: Define web font */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2');
  font-display: swap;
}

/* Step 2: Define adjusted fallback font */
@font-face {
  font-family: 'Inter Fallback';
  src: local('Arial');
  size-adjust: 107.64%;        /* Scale fallback to match web font width */
  ascent-override: 90.49%;     /* Match ascent metric */
  descent-override: 22.48%;    /* Match descent metric */
  line-gap-override: 0%;       /* Match line gap */
}

/* Step 3: Use with fallback chain */
body {
  font-family: 'Inter', 'Inter Fallback', system-ui, sans-serif;
}

/*
  HOW THIS WORKS:
  1. On first load: 'Inter Fallback' (adjusted Arial) is shown immediately
  2. 'Inter' downloads in background
  3. When Inter loads: browser swaps fonts
  4. Because metrics match, NO LAYOUT SHIFT occurs
  5. CLS from font loading = 0

  TOOLS TO CALCULATE OVERRIDES:
  • next/font: Calculates automatically
  • fontaine: npm package for automated fallback generation
  • @capsizecss/metrics: Font metric database
  • https://screenspan.net/fallback: Online calculator
*/


/* FONTAINE — Automatic fallback generation */
/* npm install fontaine */
/* vite.config.ts */
// import { FontaineTransform } from 'fontaine';
// export default defineConfig({
//   plugins: [FontaineTransform.vite({ fallbacks: ['Arial'] })],
// });
// Automatically generates size-adjust, ascent-override, etc.
```

---

## 8. System Font Stacks

```css
/* SYSTEM FONT STACKS — Zero download, zero CLS, maximum performance */

/* Modern system font stack */
body {
  font-family:
    system-ui,                  /* Modern system font (San Francisco, Segoe UI, etc.) */
    -apple-system,              /* Older Safari/iOS */
    BlinkMacSystemFont,         /* Older Chrome on macOS */
    'Segoe UI',                 /* Windows */
    Roboto,                     /* Android */
    'Helvetica Neue', Helvetica, /* Older macOS */
    Arial,                      /* Universal fallback */
    sans-serif;                 /* Generic */
}

/* Monospace system stack */
code, pre {
  font-family:
    ui-monospace,               /* Modern system monospace */
    'Cascadia Code',            /* Windows Terminal */
    'Source Code Pro',          /* Adobe */
    Menlo,                      /* macOS */
    Consolas,                   /* Windows */
    'Liberation Mono',          /* Linux */
    monospace;
}

/* Serif system stack */
.serif {
  font-family:
    ui-serif,                   /* Modern system serif */
    Georgia,
    'Times New Roman',
    Times,
    serif;
}

/*
  WHEN TO USE SYSTEM FONTS:
  • Internal tools and dashboards (speed > branding)
  • Documentation sites
  • Performance-critical applications
  • When CLS = 0 is mandatory and custom fonts aren't worth the cost
  • As fallback in font stack (always include system fonts last)
*/
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Loading too many font families** | 5+ font files, slow page load, render blocking | Limit to 2-3 font families maximum; use variable fonts |
| **Not preloading critical fonts** | Font discovered late (after CSS parse), FOIT/FOUT delay | `<link rel="preload" as="font" crossorigin>` in `<head>` |
| **Missing crossorigin on preload** | Font fetched twice (preload + @font-face mismatch) | ALWAYS add `crossorigin` attribute on font preloads |
| **Using Google Fonts CDN in production** | Extra DNS + TLS overhead (~100-300ms), GDPR risk | Self-host fonts; use next/font, fontsource, or manual hosting |
| **font-display: auto or block for text** | Invisible text for up to 3 seconds (FOIT) | Use `swap` for body text, `optional` for zero CLS |
| **No fallback font matching** | CLS when web font loads (text reflows) | Use `size-adjust`, `ascent-override`, `descent-override` on fallback |
| **Loading all weights as static files** | 6 font files × 20KB = 120KB | Use variable font (one file, all weights, ~35KB) |
| **Not subsetting fonts** | Full font file with 2000+ glyphs when page uses 200 | Subset with unicode-range, glyphhanger, or pyftsubset |
| **Inline font as base64 in CSS** | Bloated CSS file, not cacheable separately, blocks render | Serve font as external file with proper cache headers |
| **Loading fonts for below-fold text** | Fonts loaded for content user may never scroll to | Use `font-display: optional` or defer non-critical font loading |

---

## 10. Enforcement Checklist

### Font Strategy
- [ ] Maximum 2-3 font families loaded per page
- [ ] Variable fonts used when 3+ weights of same family needed
- [ ] Fonts self-hosted (not loaded from Google Fonts CDN)
- [ ] WOFF2 format used (best compression, 97%+ browser support)

### Loading Performance
- [ ] Critical fonts preloaded: `<link rel="preload" as="font" crossorigin>`
- [ ] `font-display` explicitly set (never `auto`)
- [ ] Body text uses `font-display: swap` or `optional`
- [ ] Icon fonts use `font-display: block`
- [ ] Framework font optimization used (next/font, fontaine)

### CLS Prevention
- [ ] Fallback font metrics matched with `size-adjust` + overrides
- [ ] No visible layout shift when web font loads (CLS = 0 from fonts)
- [ ] System font stack included as final fallback

### Optimization
- [ ] Fonts subsetted to only needed character sets (latin, etc.)
- [ ] `unicode-range` used in @font-face for multi-script sites
- [ ] Font files cached with immutable/long-lived cache headers
- [ ] Total font weight < 100KB (all files combined)
