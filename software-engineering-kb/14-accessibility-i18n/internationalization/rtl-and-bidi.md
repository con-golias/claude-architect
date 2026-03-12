# RTL and Bidirectional Text

| Attribute      | Value                                                        |
|---------------|--------------------------------------------------------------|
| Domain        | i18n > RTL                                                   |
| Importance    | High                                                         |
| Last Updated  | 2026-03-11                                                   |
| Cross-ref     | [05-frontend i18n](../../05-frontend/web/i18n/internationalization.md), [Advanced Formatting](advanced-locale-formatting.md) |

---

## Core Concepts

### RTL Languages Overview

Right-to-left languages serve over 450 million native speakers. Applications targeting global markets must support RTL.

| Language | Script | Speakers | Code |
|----------|--------|----------|------|
| Arabic | Arabic | ~310M native | `ar` |
| Hebrew | Hebrew | ~9M native | `he` |
| Persian (Farsi) | Arabic | ~70M native | `fa` |
| Urdu | Arabic (Nastaliq) | ~70M native | `ur` |
| Pashto | Arabic | ~40M native | `ps` |

Set the `dir` attribute at the `<html>` level. This governs text alignment, flexbox direction, and CSS logical property resolution.

```html
<!-- RTL page -->
<html lang="ar" dir="rtl">

<!-- LTR page -->
<html lang="en" dir="ltr">

<!-- Per-element override for mixed content -->
<p dir="rtl">مرحبا <span dir="ltr">example.com</span> مرحبا</p>

<!-- Auto-detect direction from content (user-generated text) -->
<p dir="auto">User entered text here</p>
```

### CSS Logical Properties — Complete Reference

Replace all physical properties (`left`, `right`, `top`, `bottom`) with logical equivalents. Logical properties adapt automatically to `dir` and `writing-mode`.

| Physical Property | Logical Property | RTL Effect |
|---|---|---|
| `margin-left` | `margin-inline-start` | Maps to right in RTL |
| `margin-right` | `margin-inline-end` | Maps to left in RTL |
| `margin-top` | `margin-block-start` | Unchanged |
| `margin-bottom` | `margin-block-end` | Unchanged |
| `padding-left` | `padding-inline-start` | Maps to right in RTL |
| `padding-right` | `padding-inline-end` | Maps to left in RTL |
| `border-left` | `border-inline-start` | Maps to right in RTL |
| `border-right` | `border-inline-end` | Maps to left in RTL |
| `left` | `inset-inline-start` | Maps to right in RTL |
| `right` | `inset-inline-end` | Maps to left in RTL |
| `top` | `inset-block-start` | Unchanged |
| `bottom` | `inset-block-end` | Unchanged |
| `text-align: left` | `text-align: start` | Aligns right in RTL |
| `text-align: right` | `text-align: end` | Aligns left in RTL |
| `float: left` | `float: inline-start` | Floats right in RTL |
| `float: right` | `float: inline-end` | Floats left in RTL |
| `width` | `inline-size` | Unchanged (but semantic) |
| `height` | `block-size` | Unchanged (but semantic) |
| `min-width` | `min-inline-size` | Unchanged |
| `max-height` | `max-block-size` | Unchanged |
| `border-top-left-radius` | `border-start-start-radius` | Mirrors in RTL |
| `border-top-right-radius` | `border-start-end-radius` | Mirrors in RTL |
| `border-bottom-left-radius` | `border-end-start-radius` | Mirrors in RTL |
| `border-bottom-right-radius` | `border-end-end-radius` | Mirrors in RTL |

```css
/* WRONG — physical properties break in RTL */
.sidebar {
  margin-left: 16px;
  padding-right: 24px;
  border-left: 2px solid #ccc;
  text-align: left;
  float: left;
}

/* CORRECT — logical properties adapt automatically */
.sidebar {
  margin-inline-start: 16px;
  padding-inline-end: 24px;
  border-inline-start: 2px solid #ccc;
  text-align: start;
  float: inline-start;
}
```

### Flexbox and Grid in RTL

Flexbox `row` direction reverses automatically when `dir="rtl"` is set. No code changes needed if using logical properties.

```css
/* Flexbox: row direction reverses in RTL automatically */
.nav {
  display: flex;
  flex-direction: row;          /* LTR: left→right, RTL: right→left */
  gap: 16px;
}

/* Grid: column ordering reverses in RTL */
.layout {
  display: grid;
  grid-template-columns: 250px 1fr 300px;  /* Mirrors in RTL */
}

/* CAUTION: explicit order breaks in RTL if not intentional */
/* Use logical placement instead */
.layout {
  grid-template-areas: "sidebar main aside";
  /* In RTL, "sidebar" renders on the right, "aside" on the left */
}
```

### Unicode Bidirectional Algorithm (BiDi)

The Unicode BiDi algorithm determines text rendering direction for mixed-direction content. Understand embedding levels and isolation.

**Key concepts:**

- **Base direction** — set by `dir` attribute; determines paragraph direction
- **Strong characters** — letters with inherent direction (Arabic = RTL, Latin = LTR)
- **Weak characters** — digits, punctuation; direction from surrounding context
- **Neutral characters** — spaces, some symbols; direction from neighbors

```html
<!-- Problem: punctuation at boundary renders in wrong position -->
<!-- "Price: $50" in RTL context renders as "50$ :Price" without isolation -->

<!-- Solution: use <bdi> (bidirectional isolate) for embedded LTR in RTL -->
<p dir="rtl">السعر: <bdi>$50</bdi></p>

<!-- For user-generated content, always use dir="auto" or <bdi> -->
<ul dir="rtl">
  <li><bdi>John Smith</bdi> — مدير</li>
  <li><bdi>أحمد محمد</bdi> — مهندس</li>
</ul>
```

**Unicode control characters** (use sparingly — prefer HTML/CSS):

| Character | Code | Purpose |
|-----------|------|---------|
| LRM (Left-to-Right Mark) | U+200E | Force LTR direction at boundary |
| RLM (Right-to-Left Mark) | U+200F | Force RTL direction at boundary |
| LRI (Left-to-Right Isolate) | U+2066 | Begin LTR isolation |
| RLI (Right-to-Left Isolate) | U+2067 | Begin RTL isolation |
| PDI (Pop Directional Isolate) | U+2069 | End isolation |

```typescript
// Insert LRM/RLM in dynamic strings when HTML is not available
// (e.g., plain-text emails, log messages)
const LRM = '\u200E';
const RLM = '\u200F';

function formatPriceInRTL(price: string): string {
  return `${RLM}السعر: ${LRM}${price}${RLM}`;
}
```

### Mixed-Direction Content

Common scenarios where LTR content appears in RTL pages:

```css
/* URLs, code, and brand names stay LTR in RTL context */
.url, .code, .brand {
  direction: ltr;
  unicode-bidi: isolate;  /* Isolate from surrounding RTL text */
}

/* Numbers with units — keep number+unit together */
.measurement {
  unicode-bidi: isolate;
  direction: ltr;
}
```

```html
<!-- Brand names and technical terms stay LTR -->
<p dir="rtl">
  قم بتحميل <bdi class="brand">Visual Studio Code</bdi> من الموقع
  <bdi class="url">https://code.visualstudio.com</bdi>
</p>
```

### Icon and Image Mirroring

| Mirror in RTL | Do NOT Mirror |
|--------------|---------------|
| Back/forward arrows | Checkmarks |
| Chevrons (navigation) | Clocks and timers |
| Progress bars | Media playback (play/pause) |
| Sliders and toggles | Search icons |
| Text alignment icons | Download/upload arrows |
| Chat bubbles (tail side) | Logos and brand marks |
| Undo/redo arrows | Mathematical symbols (+, -, =) |
| Breadcrumb separators | Lock/unlock icons |

```css
/* Mirror specific icons in RTL using CSS transform */
[dir="rtl"] .icon-arrow-forward {
  transform: scaleX(-1);
}

/* Or use logical icon classes */
.icon-inline-start { /* navigates "back" in reading direction */ }
.icon-inline-end   { /* navigates "forward" in reading direction */ }

[dir="rtl"] .icon-inline-start { transform: scaleX(-1); }
[dir="rtl"] .icon-inline-end   { transform: scaleX(-1); }
```

### RTL-Aware Component Development

```typescript
// React: useDirection hook
import { createContext, useContext, type ReactNode } from 'react';

type Direction = 'ltr' | 'rtl';

const DirectionContext = createContext<Direction>('ltr');

export function DirectionProvider({
  locale,
  children,
}: { locale: string; children: ReactNode }) {
  const dir = RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr';
  return (
    <DirectionContext.Provider value={dir}>
      <div dir={dir}>{children}</div>
    </DirectionContext.Provider>
  );
}

const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'yi', 'dv']);

export function useDirection(): Direction {
  return useContext(DirectionContext);
}

export function useIsRTL(): boolean {
  return useContext(DirectionContext) === 'rtl';
}

// Usage in components
function Sidebar() {
  const isRTL = useIsRTL();
  return (
    <nav
      style={{
        // Prefer CSS logical properties over JS-based direction
        borderInlineEnd: '1px solid #ccc',
        paddingInlineStart: '16px',
      }}
    >
      <ChevronIcon style={{ transform: isRTL ? 'scaleX(-1)' : undefined }} />
      <span>Menu</span>
    </nav>
  );
}
```

### RTL Testing

```typescript
// Playwright: RTL visual regression tests
import { test, expect } from '@playwright/test';

const RTL_LOCALES = ['ar', 'he', 'fa'];

for (const locale of RTL_LOCALES) {
  test(`homepage renders correctly in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', locale);

    // Visual regression snapshot
    await expect(page).toHaveScreenshot(`homepage-${locale}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
}

// Verify logical properties are used (no physical left/right in styles)
test('no physical direction properties in computed styles', async ({ page }) => {
  await page.goto('/ar');
  const sidebar = page.locator('.sidebar');
  const styles = await sidebar.evaluate(el => {
    const cs = getComputedStyle(el);
    return {
      marginLeft: cs.marginLeft,
      marginRight: cs.marginRight,
      marginInlineStart: cs.marginInlineStart,
    };
  });
  // In RTL, margin-inline-start should map to margin-right
  expect(styles.marginRight).not.toBe('0px');
});
```

### CSS Frameworks RTL Support

```html
<!-- Tailwind CSS v3+ — rtl: and ltr: variants -->
<div class="flex flex-row">
  <div class="ml-4 rtl:mr-4 rtl:ml-0">
    <!-- Tailwind approach with rtl: prefix -->
  </div>
</div>

<!-- Better: use Tailwind's logical property utilities (ms = margin-start) -->
<div class="flex flex-row">
  <div class="ms-4"><!-- margin-inline-start: 1rem --></div>
  <div class="me-4"><!-- margin-inline-end: 1rem --></div>
  <div class="ps-2"><!-- padding-inline-start: 0.5rem --></div>
  <div class="pe-2"><!-- padding-inline-end: 0.5rem --></div>
  <div class="text-start"><!-- text-align: start --></div>
  <div class="float-start"><!-- float: inline-start --></div>
  <div class="rounded-ss-lg"><!-- border-start-start-radius --></div>
</div>
```

### Converting Existing Apps to RTL

**Migration checklist:**

1. Audit all CSS for physical `left`/`right`/`top`/`bottom` properties
2. Replace with logical equivalents (`inline-start`, `inline-end`, `block-start`, `block-end`)
3. Replace `text-align: left/right` with `text-align: start/end`
4. Replace `float: left/right` with `float: inline-start/inline-end`
5. Audit icon/image usage for mirroring requirements
6. Replace `margin/padding-left/right` with `margin/padding-inline-start/end`
7. Test flexbox and grid layouts — they auto-reverse, verify correct behavior
8. Add `dir="rtl"` support to root layout component
9. Wrap user-generated content in `<bdi>` or use `dir="auto"`
10. Run visual regression tests comparing LTR and RTL screenshots

```bash
# CI audit: find physical direction properties in CSS/SCSS/TSX
grep -rn "margin-left\|margin-right\|padding-left\|padding-right\|text-align:\s*left\|text-align:\s*right\|float:\s*left\|float:\s*right" \
  --include="*.css" --include="*.scss" --include="*.tsx" src/
```

---

## Best Practices

1. **Use CSS logical properties exclusively** — never write `margin-left` or `padding-right`; always use `margin-inline-start` and `padding-inline-end`.
2. **Set `dir` attribute on `<html>`** — drives flexbox reversal, logical property mapping, and text alignment for the entire document.
3. **Use `<bdi>` for user-generated content** — isolates bidirectional text to prevent layout corruption from mixed-direction strings.
4. **Mirror navigational icons but not universal icons** — arrows and chevrons must flip; checkmarks, clocks, and playback controls must not.
5. **Test RTL with real Arabic/Hebrew text** — pseudo-RTL catches layout issues but misses text rendering problems (ligatures, letter joining, vowel marks).
6. **Use Tailwind logical utilities (`ms-`, `me-`, `ps-`, `pe-`)** — they map to logical properties and eliminate the need for `rtl:` prefixes.
7. **Run visual regression tests for both LTR and RTL** — catch mirroring regressions, overflow issues, and alignment problems automatically.
8. **Never use `direction: rtl` in CSS for layout** — use the HTML `dir` attribute; CSS `direction` does not affect HTML semantics or accessibility.
9. **Isolate embedded LTR content** — URLs, code snippets, and brand names need `unicode-bidi: isolate` or `<bdi>` in RTL contexts.
10. **Audit for physical properties in CI** — grep for `left`/`right` in CSS files and fail the build if logical equivalents are not used.

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Using `margin-left`/`margin-right` for spacing | Layout breaks when switching to RTL | Use `margin-inline-start`/`margin-inline-end` |
| Applying `direction: rtl` in CSS instead of HTML `dir` | Does not affect form elements, accessibility tree | Use `<html dir="rtl">` attribute |
| Mirroring all icons globally with `transform: scaleX(-1)` | Clocks, checkmarks, playback icons should not flip | Mirror only navigational and directional icons |
| Hardcoding arrow characters (`→`, `←`) in text | Shows wrong direction in RTL | Use mirrored icon components or CSS-based arrows |
| Not isolating user content with `<bdi>` | Mixed LTR/RTL usernames corrupt paragraph direction | Wrap all user-generated text in `<bdi>` |
| Testing RTL only with mirrored English text | Misses ligature rendering, letter joining, and glyph issues | Test with real Arabic and Hebrew text |
| Using `left: 0` for absolute positioning | Element appears on wrong side in RTL | Use `inset-inline-start: 0` |
| Ignoring number formatting in RTL locales | Arabic-Indic digits may be expected; numbers need isolation | Use `Intl.NumberFormat` and `<bdi>` for numeric values |

---

## Enforcement Checklist

- [ ] `<html>` element has `dir` attribute set dynamically based on locale
- [ ] Zero CSS rules use physical `left`/`right` properties (CI grep check)
- [ ] All spacing uses `inline-start`/`inline-end` and `block-start`/`block-end`
- [ ] User-generated content is wrapped in `<bdi>` or uses `dir="auto"`
- [ ] Icon mirroring list is documented and only navigational icons are flipped
- [ ] Visual regression tests run for at least one RTL locale (Arabic recommended)
- [ ] Flexbox and grid layouts verified in both LTR and RTL
- [ ] Tailwind logical utilities (`ms-`, `me-`, `ps-`, `pe-`) used instead of directional classes
- [ ] Embedded LTR content (URLs, code, brands) uses `unicode-bidi: isolate`
- [ ] RTL testing includes real Arabic or Hebrew text, not just mirrored English
