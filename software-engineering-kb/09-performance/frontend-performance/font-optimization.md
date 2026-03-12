# Font Optimization — Performance Engineering

> **Domain:** Frontend Performance > Web Fonts
> **Importance:** HIGH
> **Cross-ref:** 05-frontend/web/performance/font-loading.md (font-display values, loading strategies)

> **Directive:** When optimizing font loading, preventing font-related CLS, choosing between self-hosting and CDN, or subsetting fonts, consult this guide. See 05-frontend for detailed font-display strategy comparison.

---

## 1. Font Loading Impact

```
FONT LOADING TIMELINE:
  HTML parsed → CSSOM built → Font reference discovered → Font request sent → Font downloaded
  │                                                                           │
  │                        200-500ms wasted                                   │
  │                    (font not discoverable until CSSOM)                     │

  WITHOUT optimization:
  ┌──────────────────────────────────────────────────────────────────────┐
  │ FOIT (Flash of Invisible Text) — text invisible until font loads    │
  │ FOUT (Flash of Unstyled Text) — system font then swap to web font  │
  │ CLS  (Layout Shift) — web font metrics differ from fallback        │
  └──────────────────────────────────────────────────────────────────────┘

  GOAL: Preload fonts, use font-display: swap + size-adjust, WOFF2 only

FONT SIZE BENCHMARKS:
┌───────────────────────┬───────────┬─────────────────────────┐
│ Font                  │ Full Size │ Subset (Latin)          │
├───────────────────────┼───────────┼─────────────────────────┤
│ Inter (Regular)       │ 310 KB    │ 22 KB WOFF2             │
│ Roboto (Regular)      │ 170 KB    │ 15 KB WOFF2             │
│ Inter Variable        │ 820 KB    │ 95 KB WOFF2 (all axes)  │
│ Noto Sans JP (CJK)   │ 4.2 MB    │ Requires unicode-range  │
└───────────────────────┴───────────┴─────────────────────────┘
```

## 2. font-display Strategy Selection

```css
/* font-display decision matrix:
   swap   → Best for body text (shows fallback immediately, swaps when ready)
   optional → Best for non-critical text (no swap if not cached; zero CLS)
   fallback → Compromise: 100ms block, 3s swap window, then keeps fallback
   block    → AVOID for body text (3s invisible text); acceptable for icon fonts
*/

/* RECOMMENDED: swap for primary font, optional for secondary */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var-latin.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+2000-206F;
}

@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var-latin-ext.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
  unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB;
}
```

## 3. CLS Prevention with size-adjust

```css
/* FALLBACK FONT MATCHING — eliminates layout shift on font swap */
/* Tool: https://screenspan.net/fallback or fontaine npm package */

/* Step 1: Define adjusted fallback that matches web font metrics */
@font-face {
  font-family: 'Inter Fallback';
  src: local('Arial');
  size-adjust: 107.64%;
  ascent-override: 90.49%;
  descent-override: 22.56%;
  line-gap-override: 0%;
}

/* Step 2: Use fallback in font stack */
body {
  font-family: 'Inter', 'Inter Fallback', system-ui, sans-serif;
}

/* When Inter loads, metrics match Arial → zero CLS */
```

```typescript
// fontaine-config.ts — Automatic fallback font generation at build time
// npm install fontaine

// Vite plugin
import { FontaineTransform } from 'fontaine';

export default defineConfig({
  plugins: [
    FontaineTransform.vite({
      fallbacks: ['Arial', 'Helvetica Neue'],
      resolvePath: (id) => new URL(`./public${id}`, import.meta.url),
    }),
  ],
});

// Next.js — built-in support
// next/font automatically handles size-adjust
import { Inter } from 'next/font/google';
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  // Generates optimal fallback metrics automatically
});
```

## 4. Font Subsetting

```bash
# Subset to Latin characters only (reduces 300KB → 20KB)
# Install: pip install fonttools brotli

# Basic Latin subset
pyftsubset Inter-Regular.ttf \
  --output-file=inter-latin.woff2 \
  --flavor=woff2 \
  --layout-features='kern,liga,calt' \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"

# Custom subset: only characters used in your UI
pyftsubset Inter-Regular.ttf \
  --text-file=used-characters.txt \
  --output-file=inter-custom.woff2 \
  --flavor=woff2

# glyphhanger: auto-detect used characters from URLs
npx glyphhanger https://example.com --subset=Inter-Regular.ttf --formats=woff2
```

```python
# font_subset_audit.py — Verify fonts are properly subsetted
from pathlib import Path
from fontTools.ttLib import TTFont

MAX_SUBSET_SIZE_KB = 30  # Budget per font file

def audit_font_file(font_path: str) -> dict:
    """Check font file size and glyph count."""
    path = Path(font_path)
    size_kb = path.stat().st_size / 1024

    font = TTFont(str(path))
    glyph_count = len(font.getGlyphOrder())
    has_kern = "kern" in font or "GPOS" in font

    return {
        "file": path.name,
        "size_kb": round(size_kb, 1),
        "within_budget": size_kb <= MAX_SUBSET_SIZE_KB,
        "glyph_count": glyph_count,
        "has_kerning": has_kern,
        "format": "WOFF2" if path.suffix == ".woff2" else path.suffix,
        "recommendation": (
            "OK" if size_kb <= MAX_SUBSET_SIZE_KB
            else f"Subset needed: {glyph_count} glyphs, consider Latin-only"
        ),
    }
```

## 5. Preloading Fonts

```html
<!-- Preload critical fonts in <head> — discovered before CSSOM -->
<!-- ONLY preload fonts actually used above the fold (1-2 max) -->
<link rel="preload"
      href="/fonts/inter-var-latin.woff2"
      as="font"
      type="font/woff2"
      crossorigin />
<!-- crossorigin is REQUIRED even for same-origin fonts -->
<!-- type attribute prevents download if format unsupported -->

<!-- DO NOT preload all font weights — only the primary weight -->
<!-- Preloading too many fonts wastes bandwidth -->
```

```typescript
// font-preload-audit.ts — Verify font preloading is correct
function auditFontPreloads(): { issues: string[]; preloaded: string[] } {
  const issues: string[] = [];
  const preloaded: string[] = [];

  // Check preload links
  const preloadLinks = document.querySelectorAll('link[rel="preload"][as="font"]');
  preloadLinks.forEach(link => {
    const href = link.getAttribute('href') ?? '';
    preloaded.push(href);

    if (!link.hasAttribute('crossorigin')) {
      issues.push(`Missing crossorigin on preload: ${href}`);
    }
    if (!href.endsWith('.woff2')) {
      issues.push(`Preloading non-WOFF2 font: ${href}`);
    }
    if (!link.getAttribute('type')) {
      issues.push(`Missing type attribute on preload: ${href}`);
    }
  });

  if (preloadLinks.length > 3) {
    issues.push(`Too many font preloads (${preloadLinks.length}): competing for bandwidth`);
  }

  // Check fonts used but not preloaded
  const fontFaces = document.fonts;
  fontFaces.forEach(face => {
    if (face.status === 'loaded') {
      const isPreloaded = preloaded.some(p => face.family.toLowerCase().includes(
        p.split('/').pop()?.split('.')[0]?.toLowerCase() ?? ''
      ));
      if (!isPreloaded) {
        issues.push(`Font "${face.family}" loaded but not preloaded`);
      }
    }
  });

  return { issues, preloaded };
}
```

## 6. Variable Fonts vs Static Fonts

```
VARIABLE FONT DECISION:
  Using 3+ weights/styles of the same family?
  ├── YES → Variable font (single file, all weights)
  │         Inter Variable (95KB) vs 6 static files (6 × 22KB = 132KB)
  │         Savings: fewer requests + smaller total size
  └── NO → Static fonts (1-2 weights only)
            Single static file is smaller than variable file

VARIABLE FONT USAGE:
  @font-face {
    font-family: 'Inter';
    src: url('inter-var.woff2') format('woff2-variations');
    font-weight: 100 900;      /* Full weight range */
    font-stretch: 75% 125%;    /* Optional: width axis */
    font-display: swap;
  }

  /* Use any weight without additional downloads */
  h1 { font-weight: 800; }
  p  { font-weight: 400; }
  small { font-weight: 300; }
```

## 7. Self-Hosting vs CDN

```
SELF-HOSTING (RECOMMENDED):
  Pros:
  ├── No third-party DNS lookup (saves 50-200ms)
  ├── Same-origin: reuses existing connection
  ├── Full control over subsetting and caching
  ├── No privacy concerns (no Google Fonts tracking)
  └── Preloadable (preload requires same-origin or CORS)

  Cons:
  └── Must manage font files and updates

GOOGLE FONTS CDN:
  Cons:
  ├── Third-party connection: DNS + TCP + TLS = 200-500ms
  ├── Cross-origin: separate cache partition (Chrome 86+)
  │   → Users do NOT benefit from "cached on other sites"
  ├── Cannot preload cross-origin without CORS issues
  └── Privacy: sends referrer to Google

RECOMMENDATION: Self-host with google-webfonts-helper or fontsource
  npm install @fontsource/inter   # Includes WOFF2, optimized subsets
```

---

## 10 Best Practices

1. **Self-host fonts** — eliminates third-party DNS/connection overhead; use fontsource packages
2. **WOFF2 only** — 30% smaller than WOFF; 97%+ browser support; drop all other formats
3. **Subset to used character sets** — Latin subset reduces 300KB to 20KB
4. **Preload primary font only** — one `<link rel="preload">` for the body text font weight
5. **Use font-display: swap** — shows text immediately with fallback, swaps when font loads
6. **Match fallback metrics** — use size-adjust/ascent-override to prevent CLS on swap
7. **Variable fonts for 3+ weights** — single file replaces multiple static font files
8. **Limit font families to 2** — each additional family adds latency; one serif + one sans max
9. **Include crossorigin on preload** — required even for same-origin font preloads
10. **Cache fonts aggressively** — `Cache-Control: public, max-age=31536000, immutable`

## 8 Anti-Patterns

1. **Loading all weights eagerly** — importing 6 weights when only 2 are used above the fold
2. **Google Fonts via CSS @import** — adds extra request chain; use `<link>` at minimum
3. **Serving TTF/OTF/EOT** — legacy formats; WOFF2 covers all modern browsers
4. **No font-display value** — defaults to `auto` (most browsers block text for 3s)
5. **Preloading fonts not used above fold** — wastes bandwidth and delays critical resources
6. **Missing crossorigin on font preload** — causes double download (one preload, one from CSS)
7. **No unicode-range splitting** — CJK fonts should use unicode-range for on-demand loading
8. **Using font-display: block for body text** — 3s invisible text destroys user experience

## Enforcement Checklist

- [ ] All fonts self-hosted in WOFF2 format
- [ ] Fonts subsetted to required character ranges
- [ ] Primary font preloaded with crossorigin attribute
- [ ] font-display: swap (or optional) set on all @font-face rules
- [ ] Fallback font metrics matched with size-adjust (zero CLS)
- [ ] No more than 2 font families loaded
- [ ] Total font payload under 100KB (all files combined)
- [ ] Font files cached with immutable Cache-Control headers
