# Visual Regression Testing — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to do visual regression testing?", "Chromatic setup?", "screenshot testing", "Playwright visual comparisons", "Percy vs Chromatic", "CSS regression", "visual diff", "snapshot testing for UI", "design system visual QA", "catch unintended CSS changes", or any visual regression question, ALWAYS consult this directive. Visual regression testing captures screenshots of components/pages and compares them against baselines to detect unintended visual changes. ALWAYS use Chromatic for Storybook-based projects — it is purpose-built for component visual testing. ALWAYS handle dynamic content (dates, avatars, animations) before screenshot capture. NEVER rely solely on visual tests — they complement functional tests, not replace them.

**Core Rule: Visual regression tests MUST catch unintended CSS and layout changes before they reach production. Use Chromatic for component-level visual testing (integrates with Storybook). Use Playwright `toHaveScreenshot()` for page-level visual testing. ALWAYS stabilize dynamic content (freeze time, mock images, disable animations) before capturing screenshots. EVERY visual test must have a deterministic baseline — flaky visual tests are WORSE than no visual tests because they train developers to blindly approve changes.**

---

## 1. Visual Regression Testing Overview

```
  VISUAL REGRESSION TESTING FLOW

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  1. CAPTURE BASELINE                                 │
  │     ┌────────────────────────────────────────────┐   │
  │     │  First run: screenshots saved as baseline  │   │
  │     │  Stored in: git, cloud, or artifact store  │   │
  │     └────────────────────────────────────────────┘   │
  │                          │                           │
  │                          ▼                           │
  │  2. CAPTURE NEW SCREENSHOT                           │
  │     ┌────────────────────────────────────────────┐   │
  │     │  PR/branch run: new screenshots captured   │   │
  │     └────────────────────────────────────────────┘   │
  │                          │                           │
  │                          ▼                           │
  │  3. COMPARE (pixel diff)                             │
  │     ┌────────────────────────────────────────────┐   │
  │     │  baseline vs new → diff image generated    │   │
  │     │                                            │   │
  │     │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
  │     │  │ Baseline │ │   New    │ │   Diff   │   │   │
  │     │  │          │ │          │ │  (red =  │   │   │
  │     │  │          │ │          │ │  changed)│   │   │
  │     │  └──────────┘ └──────────┘ └──────────┘   │   │
  │     └────────────────────────────────────────────┘   │
  │                          │                           │
  │                          ▼                           │
  │  4. DECISION                                         │
  │     ┌────────────────────────────────────────────┐   │
  │     │  NO DIFF    → Test passes ✅                │   │
  │     │  EXPECTED   → Approve new baseline ✅       │   │
  │     │  UNEXPECTED → Fix CSS/layout bug 🔧         │   │
  │     └────────────────────────────────────────────┘   │
  │                                                      │
  └──────────────────────────────────────────────────────┘
```

### 1.1 Tools Comparison

| Feature | Chromatic | Playwright Screenshots | Percy | BackstopJS |
|---|---|---|---|---|
| **Best for** | Storybook components | Full pages, E2E flows | Cross-browser visual | CSS regression (open source) |
| **Integration** | Storybook-native | Any test framework | CI/CD pipelines | Standalone or CI |
| **Browser** | Chromium | Chromium, Firefox, WebKit | Chrome, Firefox, Safari, Edge | Chromium (Puppeteer) |
| **Approval UI** | Web dashboard (excellent) | Git-stored snapshots | Web dashboard | HTML report |
| **TurboSnap** | Yes (only tests changed components) | N/A | N/A | N/A |
| **Pricing** | Free tier (5,000 snapshots/mo) | Free (built-in) | Free tier (5,000/mo) | Free (open source) |
| **Setup effort** | Low (2 lines of config) | Medium | Medium | High |
| **CI integration** | GitHub/GitLab checks | Any CI | GitHub/GitLab checks | Any CI |

**VERDICT:** Use Chromatic for Storybook component libraries and design systems. Use Playwright `toHaveScreenshot()` for page-level and E2E visual regression. Use both together for comprehensive coverage.

---

## 2. Chromatic — Component Visual Testing

```
  CHROMATIC WORKFLOW

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Developer pushes PR                                 │
  │         │                                            │
  │         ▼                                            │
  │  CI runs: npx chromatic --project-token=xxx          │
  │         │                                            │
  │         ▼                                            │
  │  Chromatic captures screenshots of ALL stories       │
  │         │                                            │
  │         ├── No changes detected → PR check passes ✅ │
  │         │                                            │
  │         └── Changes detected → Review required 🔍    │
  │                     │                                │
  │                     ▼                                │
  │         ┌───────────────────────────────────┐        │
  │         │   CHROMATIC REVIEW UI             │        │
  │         │                                   │        │
  │         │   [Baseline]    [New]    [Diff]   │        │
  │         │   ┌─────────┐ ┌─────────┐ ┌────┐ │        │
  │         │   │ Before  │ │ After   │ │ 🔴 │ │        │
  │         │   │         │ │         │ │    │ │        │
  │         │   └─────────┘ └─────────┘ └────┘ │        │
  │         │                                   │        │
  │         │   [Accept ✅]  [Deny ❌]          │        │
  │         └───────────────────────────────────┘        │
  │                     │                                │
  │                     ▼                                │
  │         Approved → New baseline saved → PR passes    │
  │         Denied → Developer fixes issue               │
  └──────────────────────────────────────────────────────┘
```

### 2.1 Chromatic Setup

```bash
# Install
npm install --save-dev chromatic

# First run — creates project and baselines
npx chromatic --project-token=chpt_xxxxx

# CI configuration
npx chromatic --project-token=$CHROMATIC_PROJECT_TOKEN --exit-zero-on-changes
```

```yaml
# .github/workflows/chromatic.yml
name: Chromatic

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0        # REQUIRED for TurboSnap

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Run Chromatic
        uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          autoAcceptChanges: main     # auto-accept on main (baseline)
          exitZeroOnChanges: true     # don't fail CI — require review
          onlyChanged: true           # TurboSnap: only test changed stories
```

### 2.2 Chromatic Configuration

```typescript
// .storybook/main.ts — Chromatic-specific config
const config: StorybookConfig = {
  // ... other config

  // Enable Chromatic modes for responsive testing
  features: {
    buildStoriesJson: true,
  },
};
```

```typescript
// .storybook/preview.ts — Chromatic parameters
const preview: Preview = {
  parameters: {
    // Chromatic: test at multiple viewports
    chromatic: {
      viewports: [375, 768, 1440],      // mobile, tablet, desktop
      // diffThreshold: 0.063,           // sensitivity (0-1, lower = stricter)
    },
  },
};
```

### 2.3 Per-Story Chromatic Configuration

```tsx
// Component with specific Chromatic settings
export const HeroSection: Story = {
  parameters: {
    chromatic: {
      viewports: [375, 1440],           // only test mobile + desktop
      delay: 500,                        // wait 500ms before capture
      diffThreshold: 0.05,              // stricter diff for this component
    },
  },
};

// Skip visual testing for a story
export const AnimatedComponent: Story = {
  parameters: {
    chromatic: { disableSnapshot: true }, // skip — animation makes it flaky
  },
};

// Test with different themes
export const DarkMode: Story = {
  parameters: {
    chromatic: {
      modes: {
        light: { theme: 'light' },
        dark: { theme: 'dark' },
      },
    },
  },
};
```

### 2.4 TurboSnap — Only Test What Changed

```
  TURBOSNAP — INTELLIGENT SNAPSHOT SELECTION

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Full Storybook: 500 stories                         │
  │                                                      │
  │  Git diff shows changes in:                          │
  │  • Button.tsx                                        │
  │  • Button.module.css                                 │
  │  • theme.ts (imported by 50 components)              │
  │                                                      │
  │  TurboSnap traces dependency graph:                  │
  │  ┌──────────────────────────────────────────┐        │
  │  │  Button.tsx → 3 stories                  │        │
  │  │  theme.ts → 50 components → 150 stories  │        │
  │  │  Total: 153 stories (not 500)            │        │
  │  └──────────────────────────────────────────┘        │
  │                                                      │
  │  Result: 70% fewer snapshots → faster, cheaper       │
  └──────────────────────────────────────────────────────┘

  REQUIRES: fetch-depth: 0 in git checkout (full history)
```

---

## 3. Playwright Visual Comparisons

### 3.1 Basic Screenshot Testing

```typescript
// e2e/visual.spec.ts
import { test, expect } from '@playwright/test';

test('homepage matches screenshot', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Full page screenshot
  await expect(page).toHaveScreenshot('homepage.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.01,         // allow 1% pixel difference
  });
});

test('login form matches screenshot', async ({ page }) => {
  await page.goto('/login');

  // Element-level screenshot
  const form = page.getByRole('form', { name: 'Login' });
  await expect(form).toHaveScreenshot('login-form.png');
});

test('navigation dropdown matches screenshot', async ({ page }) => {
  await page.goto('/');

  // Open dropdown first
  await page.getByRole('button', { name: 'Account' }).click();
  const dropdown = page.getByRole('menu');
  await expect(dropdown).toBeVisible();

  // Screenshot of open dropdown
  await expect(dropdown).toHaveScreenshot('account-dropdown.png');
});
```

### 3.2 Screenshot Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  expect: {
    toHaveScreenshot: {
      // Default threshold for all screenshot assertions
      maxDiffPixelRatio: 0.01,          // 1% pixel diff allowed
      maxDiffPixels: 100,               // OR max 100 different pixels
      threshold: 0.2,                   // per-pixel color threshold (0-1)
      animations: 'disabled',           // CRITICAL: disable CSS animations
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.01,
    },
  },

  // Store snapshots per-project (browser-specific baselines)
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{testFilePath}/{arg}{-projectName}{ext}',

  projects: [
    {
      name: 'chromium',
      use: {
        // Consistent rendering
        deviceScaleFactor: 1,
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
```

### 3.3 Updating Baselines

```bash
# Generate initial baselines
npx playwright test --update-snapshots

# Update specific test baselines
npx playwright test visual.spec.ts --update-snapshots

# Review changes
git diff --stat  # see which screenshots changed
```

### 3.4 Multi-Theme Visual Testing

```typescript
// e2e/theme-visual.spec.ts
import { test, expect } from '@playwright/test';

const themes = ['light', 'dark'] as const;

for (const theme of themes) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      // Set theme via localStorage or cookie
      await page.addInitScript((t) => {
        window.localStorage.setItem('theme', t);
      }, theme);
    });

    test(`dashboard - ${theme}`, async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot(`dashboard-${theme}.png`, {
        fullPage: true,
      });
    });

    test(`settings page - ${theme}`, async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot(`settings-${theme}.png`, {
        fullPage: true,
      });
    });
  });
}
```

---

## 4. Handling Dynamic Content

```
  DYNAMIC CONTENT — STABILIZATION STRATEGIES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  PROBLEM: Dynamic content causes false positives     │
  │                                                      │
  │  ┌──────────────────────────────────────────────┐    │
  │  │  Dates/Times     → Mock clock                │    │
  │  │  Random avatars  → Mock images               │    │
  │  │  Animations      → Disable CSS animations    │    │
  │  │  Cursor blinking → Hide carets               │    │
  │  │  Loading states  → Wait for stable render    │    │
  │  │  User-generated  → Seed test data            │    │
  │  │  Ads / embeds    → Block external resources  │    │
  │  │  Scrollbar styles→ Consistent viewport       │    │
  │  └──────────────────────────────────────────────┘    │
  │                                                      │
  │  RULE: If any pixel can change between runs          │
  │  without code changes, STABILIZE it or MASK it.      │
  └──────────────────────────────────────────────────────┘
```

### 4.1 Freezing Time

```typescript
// Freeze date/time for consistent screenshots
test('dashboard with fixed time', async ({ page }) => {
  // Set fixed date
  await page.addInitScript(() => {
    const fixedDate = new Date('2024-06-15T10:30:00Z');
    const OriginalDate = Date;

    // @ts-ignore
    globalThis.Date = class extends OriginalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(fixedDate.getTime());
        } else {
          // @ts-ignore
          super(...args);
        }
      }

      static now() {
        return fixedDate.getTime();
      }
    };
  });

  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard.png');
});

// Or use Playwright clock
test('dashboard with clock', async ({ page }) => {
  await page.clock.install({ time: new Date('2024-06-15T10:30:00Z') });
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard.png');
});
```

### 4.2 Disabling Animations

```typescript
// playwright.config.ts — global animation disable
use: {
  // Disable CSS animations and transitions
  contextOptions: {
    reducedMotion: 'reduce',
  },
}

// Or inject CSS to disable animations
test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
});
```

### 4.3 Masking Dynamic Regions

```typescript
test('page with dynamic ad banner', async ({ page }) => {
  await page.goto('/');

  // Mask specific elements that change between runs
  await expect(page).toHaveScreenshot('homepage.png', {
    mask: [
      page.getByTestId('ad-banner'),           // mask ad
      page.getByTestId('live-clock'),           // mask clock
      page.locator('.user-avatar'),             // mask dynamic avatar
    ],
    maskColor: '#FF00FF',                        // visible mask for debugging
  });
});
```

### 4.4 Mocking Images

```typescript
test('profile page with consistent avatar', async ({ page }) => {
  // Replace all external images with placeholder
  await page.route('**/*.{png,jpg,jpeg,webp,avif}', (route) => {
    // Return a consistent 1x1 placeholder
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      ),
    });
  });

  await page.goto('/profile');
  await expect(page).toHaveScreenshot('profile.png');
});

// Or route to consistent test fixtures
await page.route('/api/avatar/**', (route) => {
  route.fulfill({
    status: 200,
    contentType: 'image/png',
    path: 'e2e/fixtures/test-avatar.png',       // local consistent image
  });
});
```

### 4.5 Waiting for Stable Render

```typescript
test('chart renders completely', async ({ page }) => {
  await page.goto('/analytics');

  // Wait for chart library to finish rendering
  await page.waitForFunction(() => {
    const chart = document.querySelector('.recharts-wrapper');
    return chart && chart.querySelector('.recharts-surface');
  });

  // Extra delay for SVG rendering to stabilize
  await page.waitForTimeout(500);  // OK here — visual stabilization

  await expect(page.locator('.chart-container')).toHaveScreenshot('chart.png');
});

// Wait for fonts to load
test('page with custom fonts', async ({ page }) => {
  await page.goto('/');

  // Wait for all fonts to be loaded
  await page.waitForFunction(() => document.fonts.ready.then(() => true));

  await expect(page).toHaveScreenshot('homepage-with-fonts.png');
});
```

---

## 5. Visual Testing in CI/CD

### 5.1 Playwright Visual Tests in CI

```yaml
# .github/workflows/visual.yml
name: Visual Regression

on:
  pull_request:
    branches: [main]

jobs:
  visual-test:
    runs-on: ubuntu-latest
    container:
      # CRITICAL: Use consistent container for rendering
      image: mcr.microsoft.com/playwright:v1.42.0-jammy

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Run visual tests
        run: npx playwright test --project=chromium e2e/visual/

      - name: Upload diff artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-diffs
          path: test-results/
          retention-days: 7
```

### 5.2 Consistent Rendering Environment

```
  VISUAL TEST CONSISTENCY REQUIREMENTS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  PROBLEM: Screenshots differ between environments    │
  │                                                      │
  │  macOS:   Subpixel rendering, different fonts        │
  │  Linux:   No subpixel AA, different font metrics     │
  │  Windows: ClearType rendering, different DPI         │
  │                                                      │
  │  SOLUTION: Run visual tests in CONSISTENT container  │
  │                                                      │
  │  ┌──────────────────────────────────────────────┐    │
  │  │  1. Use Docker container in CI:              │    │
  │  │     mcr.microsoft.com/playwright:v1.42.0     │    │
  │  │                                              │    │
  │  │  2. Generate baselines IN the container:     │    │
  │  │     docker run ... npx playwright test       │    │
  │  │       --update-snapshots                     │    │
  │  │                                              │    │
  │  │  3. Commit baselines generated in container  │    │
  │  │                                              │    │
  │  │  4. CI runs in SAME container → consistent   │    │
  │  └──────────────────────────────────────────────┘    │
  │                                                      │
  │  NEVER generate baselines on macOS and test on Linux │
  └──────────────────────────────────────────────────────┘
```

```bash
# Generate baselines in Docker (same as CI)
docker run --rm \
  -v $(pwd):/app \
  -w /app \
  mcr.microsoft.com/playwright:v1.42.0-jammy \
  npx playwright test --update-snapshots
```

---

## 6. Visual Testing Strategy

### 6.1 What to Visually Test

```
  VISUAL TESTING DECISION TREE

  START: Should I add a visual test for this?
    │
    ├── Is it a design system component?
    │   └── YES → Visual test EVERY variant (Chromatic)
    │
    ├── Is it a critical page (landing, pricing, checkout)?
    │   └── YES → Full page visual test (Playwright)
    │
    ├── Does it have complex CSS (grid, flexbox, responsive)?
    │   └── YES → Visual test at key breakpoints
    │
    ├── Has CSS broken here before?
    │   └── YES → Visual test as regression guard
    │
    ├── Is it purely functional (form logic, API integration)?
    │   └── YES → Skip visual test — use functional test
    │
    └── Is it internal/admin UI with low visual standards?
        └── YES → Skip visual test — not worth the maintenance
```

### 6.2 Component-Level vs Page-Level

| Level | Tool | What to Test | When |
|---|---|---|---|
| **Component** | Chromatic / Storybook | Design system atoms, molecules | Every PR touching components |
| **Page** | Playwright screenshots | Full page layout, integration | Every PR, critical pages |
| **Flow** | Playwright screenshots | Multi-step flows at key states | Critical paths only |

### 6.3 Responsive Visual Testing

```typescript
// e2e/responsive-visual.spec.ts
const viewports = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const vp of viewports) {
  test.describe(`${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('homepage', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`homepage-${vp.name}.png`, {
        fullPage: true,
      });
    });

    test('product listing', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`products-${vp.name}.png`, {
        fullPage: true,
      });
    });
  });
}
```

---

## 7. Diff Algorithms and Thresholds

### 7.1 Pixel Comparison Methods

```
  DIFF ALGORITHMS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  PIXEL-BY-PIXEL (default):                           │
  │  Compare each pixel's RGB values                     │
  │  Pro: Simple, fast                                   │
  │  Con: Sensitive to anti-aliasing, subpixel rendering │
  │                                                      │
  │  PERCEPTUAL (SSIM/CIEDE2000):                        │
  │  Compare perceived visual similarity                 │
  │  Pro: Ignores imperceptible differences              │
  │  Con: May miss subtle but intentional changes        │
  │                                                      │
  │  PLAYWRIGHT DEFAULT: pixelmatch algorithm             │
  │  • Anti-aliasing detection                           │
  │  • Per-pixel threshold (color distance)              │
  │  • Overall pixel ratio threshold                     │
  └──────────────────────────────────────────────────────┘
```

### 7.2 Threshold Configuration

```typescript
// Strict — for design system components
await expect(component).toHaveScreenshot('button.png', {
  maxDiffPixelRatio: 0,      // zero tolerance
  threshold: 0.1,            // strict per-pixel threshold
});

// Normal — for page-level screenshots
await expect(page).toHaveScreenshot('dashboard.png', {
  maxDiffPixelRatio: 0.01,   // 1% pixel diff allowed
  threshold: 0.2,            // moderate per-pixel threshold
});

// Lenient — for pages with minor rendering differences
await expect(page).toHaveScreenshot('blog-post.png', {
  maxDiffPixelRatio: 0.05,   // 5% pixel diff allowed
  threshold: 0.3,            // relaxed per-pixel threshold
});
```

| Use Case | `maxDiffPixelRatio` | `threshold` | Rationale |
|---|---|---|---|
| Design tokens (colors, spacing) | 0 | 0.1 | Zero tolerance for design system |
| Component variants | 0.005 | 0.15 | Very strict, minor AA differences ok |
| Full page screenshots | 0.01 | 0.2 | Account for content variations |
| Charts/graphs | 0.03 | 0.25 | SVG rendering varies slightly |
| User-generated content pages | 0.05 | 0.3 | Content changes expected |

---

## 8. Percy — Cross-Browser Visual Testing

### 8.1 Percy Setup

```bash
npm install --save-dev @percy/cli @percy/playwright
```

```typescript
// e2e/percy-visual.spec.ts
import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

test('homepage visual test', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await percySnapshot(page, 'Homepage', {
    widths: [375, 768, 1440],         // capture at multiple widths
    minHeight: 1024,
  });
});

test('product page visual test', async ({ page }) => {
  await page.goto('/products/1');

  await percySnapshot(page, 'Product Detail', {
    widths: [375, 1440],
    percyCSS: `
      .dynamic-banner { visibility: hidden; }
      .timestamp { visibility: hidden; }
    `,
  });
});
```

```yaml
# .github/workflows/percy.yml
- name: Percy visual tests
  run: npx percy exec -- npx playwright test e2e/percy-visual/
  env:
    PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}
```

### 8.2 Percy vs Chromatic Decision

```
  PERCY vs CHROMATIC DECISION

  START
    │
    ├── Using Storybook for component development?
    │   ├── YES → Chromatic (native Storybook integration, TurboSnap)
    │   └── NO → Percy (works with any test framework)
    │
    ├── Need cross-browser visual testing?
    │   ├── YES → Percy (Chrome + Firefox + Safari + Edge)
    │   └── NO → Chromatic (Chromium only, but TurboSnap saves cost)
    │
    ├── Budget-sensitive?
    │   ├── YES → Playwright toHaveScreenshot() (free, unlimited)
    │   └── NO → Chromatic or Percy (better workflow, approval UI)
    │
    └── Design system with 500+ components?
        ├── YES → Chromatic with TurboSnap (only tests changed stories)
        └── NO → Any option works
```

---

## 9. BackstopJS — Open Source Alternative

### 9.1 BackstopJS Setup

```javascript
// backstop.config.js
module.exports = {
  id: 'my-app',
  viewports: [
    { label: 'mobile', width: 375, height: 667 },
    { label: 'tablet', width: 768, height: 1024 },
    { label: 'desktop', width: 1440, height: 900 },
  ],
  scenarios: [
    {
      label: 'Homepage',
      url: 'http://localhost:3000',
      selectors: ['document'],
      delay: 1000,
      misMatchThreshold: 0.1,
      requireSameDimensions: true,
    },
    {
      label: 'Login Page',
      url: 'http://localhost:3000/login',
      selectors: ['form'],
      delay: 500,
    },
    {
      label: 'Dashboard - logged in',
      url: 'http://localhost:3000/dashboard',
      cookiePath: 'backstop_data/cookies.json',
      delay: 2000,
      hideSelectors: ['.dynamic-banner', '.timestamp'],
    },
  ],
  paths: {
    bitmaps_reference: 'backstop_data/bitmaps_reference',
    bitmaps_test: 'backstop_data/bitmaps_test',
    html_report: 'backstop_data/html_report',
  },
  engine: 'playwright',
  engineOptions: {
    browser: 'chromium',
    args: ['--no-sandbox'],
  },
  asyncCaptureLimit: 5,
  asyncCompareLimit: 50,
};
```

```bash
# Generate baselines
npx backstop reference

# Run tests
npx backstop test

# Approve changes (update baselines)
npx backstop approve

# Open HTML report
open backstop_data/html_report/index.html
```

---

## 10. Design System Visual QA

### 10.1 Comprehensive Component Visual Matrix

```tsx
// design-system/Button.stories.tsx — complete visual matrix
const variants = ['primary', 'secondary', 'danger', 'ghost'] as const;
const sizes = ['sm', 'md', 'lg'] as const;
const states = ['default', 'hover', 'focus', 'disabled'] as const;

// Generate story for every combination
export const VisualMatrix: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {variants.map((variant) => (
        <div key={variant}>
          <h3>{variant}</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {sizes.map((size) => (
              <Button key={size} variant={variant} size={size}>
                {size.toUpperCase()}
              </Button>
            ))}
            <Button variant={variant} disabled>
              Disabled
            </Button>
            <Button variant={variant} loading>
              Loading
            </Button>
          </div>
        </div>
      ))}
    </div>
  ),
  parameters: {
    chromatic: {
      viewports: [1440],
      // Strict diff for design system
      diffThreshold: 0,
    },
  },
};
```

### 10.2 Token Change Detection

```tsx
// tokens/ColorPalette.stories.tsx
import { tokens } from '../tokens';

export const ColorPalette: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
      {Object.entries(tokens.colors).map(([name, value]) => (
        <div key={name} style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              backgroundColor: value,
              borderRadius: 8,
              border: '1px solid #ccc',
              margin: '0 auto',
            }}
          />
          <code style={{ fontSize: 12 }}>{name}</code>
          <div style={{ fontSize: 11, color: '#666' }}>{value}</div>
        </div>
      ))}
    </div>
  ),
  parameters: {
    chromatic: { diffThreshold: 0 },  // zero tolerance for color changes
  },
};
```

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Flaky baselines** | Screenshots differ between macOS and CI Linux — constant false positives | Generate baselines in CI container (Docker); commit those baselines |
| **Testing everything visually** | 500 visual tests take 20 minutes and cost $200/month — many are redundant | Visually test design system components and critical pages only |
| **No dynamic content stabilization** | Tests fail because clock shows different time or avatars are random | Freeze time, mock images, disable animations, mask dynamic regions |
| **Blind approvals** | Developer approves all visual diffs without reviewing — bugs slip through | Require 2 reviewers for visual changes; treat diffs like code review |
| **No threshold configuration** | Strict pixel-perfect comparison — anti-aliasing differences cause failures | Set appropriate `maxDiffPixelRatio` and `threshold` per test type |
| **Baselines not in version control** | Baselines stored locally — different for each developer, no history | Commit baselines to git (Playwright) or use cloud service (Chromatic) |
| **Visual-only testing** | Visual tests pass but component is functionally broken (button does nothing) | Visual tests complement functional tests — NEVER replace them |
| **No responsive testing** | Desktop visual test passes but mobile layout is broken | Test at 2-3 viewports minimum (mobile, tablet, desktop) |
| **Screenshots of full pages with dynamic data** | Every run produces different screenshots — tests are permanently red | Mock API data, use seeded test fixtures, mask dynamic regions |
| **Ignoring font loading** | Screenshots inconsistent because fonts hadn't loaded when captured | Wait for `document.fonts.ready` before capturing |

---

## 12. Enforcement Checklist

### Tool Setup
- [ ] Chromatic configured for Storybook components (if using Storybook)
- [ ] Playwright `toHaveScreenshot()` configured for page-level tests
- [ ] Animations disabled globally (`reducedMotion: 'reduce'` or CSS override)
- [ ] Consistent rendering environment (Docker container in CI)
- [ ] Baselines generated in CI environment (not developer machine)

### Test Quality
- [ ] Dynamic content stabilized: time frozen, images mocked, animations disabled
- [ ] Appropriate thresholds set per test type (strict for design system, lenient for pages)
- [ ] Masking used for genuinely dynamic regions (ads, live data, user avatars)
- [ ] Responsive testing covers mobile + tablet + desktop viewports
- [ ] Font loading awaited before screenshot capture

### CI/CD Integration
- [ ] Visual regression runs on every PR
- [ ] Diff artifacts uploaded for failed tests (Playwright report / Chromatic link)
- [ ] Review workflow established — visual diffs require explicit approval
- [ ] TurboSnap enabled (Chromatic) to minimize snapshot count
- [ ] Visual test suite completes in < 5 minutes

### Coverage
- [ ] All design system components have visual tests
- [ ] Critical pages tested at key breakpoints
- [ ] Dark/light theme tested for themed applications
- [ ] Visual tests complement (not replace) functional and a11y tests
- [ ] No visual test is permanently flaky — fix or delete
