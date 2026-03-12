# Visual Regression Testing

| Attribute      | Value                                      |
|----------------|--------------------------------------------|
| Domain         | Testing > E2E Testing                      |
| Importance     | High                                       |
| Last Updated   | 2026-03-10                                 |
| Cross-ref      | [Playwright](playwright.md), [Cypress](cypress.md), [E2E Overview](overview.md) |

---

## Core Concepts

### Pixel Comparison vs DOM Snapshot Comparison

Two fundamentally different approaches exist for detecting visual regressions:

| Approach           | How It Works                                    | Strengths                                | Weaknesses                               |
|--------------------|-------------------------------------------------|------------------------------------------|------------------------------------------|
| Pixel comparison   | Captures screenshot, diffs against baseline pixel-by-pixel | Catches any visible change (fonts, spacing, color) | Sensitive to anti-aliasing, subpixel rendering, OS differences |
| DOM snapshot       | Serializes the DOM/CSS state, diffs the structure | Deterministic, no rendering variance     | Misses visual issues caused by browser rendering quirks |

**Recommendation**: Use pixel comparison for final visual sign-off. Use DOM snapshots (Storybook + snapshot tests) for fast feedback during development. Combine both in CI.

### Tool Landscape

| Tool             | Type              | Integration          | Hosting       | Key Feature                        |
|------------------|-------------------|----------------------|---------------|------------------------------------|
| Playwright       | Pixel comparison  | Built-in             | Self-hosted   | `toHaveScreenshot()`, auto-threshold |
| Percy            | Pixel comparison  | CI plugin            | SaaS          | Cross-browser rendering, review UI |
| Chromatic        | Pixel + DOM       | Storybook native     | SaaS          | Component-level visual review      |
| Applitools       | AI-powered diff   | Multi-framework      | SaaS          | Visual AI reduces false positives  |
| BackstopJS       | Pixel comparison  | Puppeteer-based      | Self-hosted   | Config-driven, Docker support      |

---

## Code Examples

### Playwright Visual Comparison

```typescript
// tests/visual/homepage.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Homepage visual tests', () => {
  test.beforeEach(async ({ page }) => {
    // Freeze time to prevent dynamic timestamps from causing diffs
    await page.addInitScript(() => {
      const fixedDate = new Date('2026-01-15T10:00:00Z');
      // @ts-ignore
      Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) super(fixedDate);
          else super(...args);
        }
        static now() { return fixedDate.getTime(); }
      };
    });
  });

  test('hero section matches baseline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="hero-section"]')).toHaveScreenshot(
      'hero-section.png',
      {
        maxDiffPixelRatio: 0.01,
        animations: 'disabled',
      },
    );
  });

  test('full page matches baseline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('homepage-full.png', {
      fullPage: true,
      maxDiffPixels: 100,
      animations: 'disabled',
      mask: [
        page.locator('[data-testid="live-chat-widget"]'),
        page.locator('[data-testid="cookie-banner"]'),
      ],
    });
  });

  test('matches across multiple viewports', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 812, name: 'mobile' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot(`homepage-${vp.name}.png`, {
        maxDiffPixelRatio: 0.01,
        animations: 'disabled',
      });
    }
  });
});
```

### Advanced Playwright Screenshot Configuration

```typescript
// playwright.config.ts — visual regression settings
import { defineConfig } from '@playwright/test';

export default defineConfig({
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.01,
    },
  },
  // Separate project for visual tests to control browser precisely
  projects: [
    {
      name: 'visual-chromium',
      testMatch: /visual\/.*\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
        // Consistent rendering across platforms
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
  ],
  // Update baselines: npx playwright test --update-snapshots
});
```

### Storybook + Chromatic Workflow

```typescript
// src/components/Button/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    chromatic: {
      // Capture at multiple viewports
      viewports: [320, 768, 1200],
      // Delay capture to let animations settle
      delay: 300,
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary', label: 'Submit' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', label: 'Cancel' },
};

export const Disabled: Story = {
  args: { variant: 'primary', label: 'Submit', disabled: true },
};

export const Loading: Story = {
  args: { variant: 'primary', label: 'Submit', isLoading: true },
  parameters: {
    chromatic: {
      // Pause animations for deterministic capture
      pauseAnimationAtEnd: true,
    },
  },
};
```

```yaml
# .github/workflows/chromatic.yml
name: Chromatic Visual Review
on: pull_request

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for Chromatic baseline detection
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          exitZeroOnChanges: true  # Don't fail CI; require manual review
          autoAcceptChanges: main  # Auto-accept on main branch merges
```

### Percy Integration (Alternative SaaS Approach)

```typescript
// tests/visual/percy-checkout.spec.ts
import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

test('checkout page visual review', async ({ page }) => {
  await page.goto('/checkout');
  await page.waitForLoadState('networkidle');

  // Percy handles cross-browser rendering and baseline management
  await percySnapshot(page, 'Checkout Page', {
    widths: [375, 768, 1280],
    minHeight: 1024,
  });
});
```

### BackstopJS Configuration (Self-Hosted)

```json
// backstop.json
{
  "id": "app-visual-regression",
  "viewports": [
    { "label": "phone", "width": 375, "height": 812 },
    { "label": "tablet", "width": 768, "height": 1024 },
    { "label": "desktop", "width": 1280, "height": 800 }
  ],
  "scenarios": [
    {
      "label": "Homepage",
      "url": "http://localhost:3000",
      "selectors": ["document"],
      "hideSelectors": [".live-chat-widget"],
      "delay": 1000,
      "misMatchThreshold": 0.1
    },
    {
      "label": "Login Page",
      "url": "http://localhost:3000/login",
      "selectors": ["[data-testid='login-form']"],
      "misMatchThreshold": 0.1
    }
  ],
  "engine": "playwright",
  "engineOptions": { "browser": "chromium" },
  "report": ["browser"],
  "paths": {
    "bitmaps_reference": "backstop_data/bitmaps_reference",
    "bitmaps_test": "backstop_data/bitmaps_test",
    "html_report": "backstop_data/html_report"
  }
}
```

---

## Baseline Management

### Updating Baselines

```bash
# Playwright — update all baselines
npx playwright test --update-snapshots

# Playwright — update baselines for a specific test file
npx playwright test tests/visual/homepage.spec.ts --update-snapshots

# BackstopJS — approve current test images as new baselines
npx backstop approve
```

### Review Workflow

1. Developer changes UI code and pushes to feature branch.
2. CI runs visual tests; diffs are detected.
3. **SaaS tools (Percy, Chromatic)**: Review diffs in the web UI. Approve or request changes.
4. **Self-hosted (Playwright, BackstopJS)**: Developer runs `--update-snapshots` locally, reviews the diff in git, and commits updated baselines.
5. Reviewer checks updated baseline images in the pull request diff viewer.

### Baseline Storage Strategy

| Strategy                     | Pros                              | Cons                              |
|------------------------------|-----------------------------------|-----------------------------------|
| Git LFS                      | Version-controlled, reviewable    | Repo bloat over time              |
| SaaS service (Percy/Chromatic) | No local storage, built-in review | Vendor lock-in, cost              |
| CI artifact storage          | No repo impact                    | Baselines not in version control  |

**Recommendation**: Use Git LFS for Playwright baselines. Use the SaaS review UI for Percy/Chromatic workflows. Never commit raw PNG files directly to git without LFS.

---

## Handling Dynamic Content

Mask, freeze, or replace dynamic elements to prevent false positives:

```typescript
// Mask dynamic regions
await expect(page).toHaveScreenshot('dashboard.png', {
  mask: [
    page.locator('[data-testid="current-time"]'),
    page.locator('[data-testid="random-avatar"]'),
    page.locator('[data-testid="ad-banner"]'),
  ],
});

// Disable animations globally via config
// playwright.config.ts
export default defineConfig({
  use: {
    // Disables CSS animations, transitions, and Web Animations API
    // for all tests in this project
  },
  expect: {
    toHaveScreenshot: { animations: 'disabled' },
  },
});

// Freeze animated content with CSS injection
await page.addStyleTag({
  content: `
    *, *::before, *::after {
      animation-duration: 0s !important;
      transition-duration: 0s !important;
      animation-delay: 0s !important;
      transition-delay: 0s !important;
    }
  `,
});
```

---

## 10 Best Practices

1. **Set a diff threshold, never zero.** Use `maxDiffPixelRatio: 0.01` or `maxDiffPixels: 50–100`. Subpixel rendering varies across machines.
2. **Disable animations in visual tests.** Use `animations: 'disabled'` in Playwright or inject CSS that zeroes all durations.
3. **Mask dynamic content.** Timestamps, avatars, ads, and live data must be masked or frozen to prevent false positives.
4. **Test at multiple viewports.** Capture at minimum: mobile (375px), tablet (768px), desktop (1280px).
5. **Run visual tests on a single, controlled browser.** Chromium on Linux in CI produces the most deterministic results. Do not compare baselines across OSes.
6. **Store baselines in Git LFS.** Keep baselines version-controlled and reviewable in PRs without bloating the repository.
7. **Review visual diffs in every PR.** Treat baseline updates as intentional changes. Require explicit approval from a reviewer.
8. **Separate visual tests from functional tests.** Use a dedicated project or test directory. Visual tests run slower and require different configuration.
9. **Freeze time for date-dependent renders.** Override `Date` or use a fixed mock clock to prevent calendar or timestamp diffs.
10. **Use component-level visual tests for design systems.** Storybook + Chromatic catches component regressions without full E2E overhead.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Setting diff threshold to zero | Every subpixel difference fails the test; constant false positives | Set `maxDiffPixelRatio: 0.01` or a reasonable `maxDiffPixels` value |
| Comparing baselines across different OSes | Font rendering and anti-aliasing differ; tests always fail | Run visual tests on a single OS (Linux in CI) with pinned browser version |
| Not masking dynamic content | Timestamps, random data, and ads cause spurious diffs every run | Use `mask` option or `hideSelectors` to exclude volatile regions |
| Storing raw PNGs in git without LFS | Repository size grows unbounded; clone times increase | Configure Git LFS for `*.png` in the snapshot directory |
| Running visual tests with animations enabled | Captured frame varies with timing; intermittent failures | Set `animations: 'disabled'` globally in config |
| Auto-approving all visual changes in CI | Regressions silently pass; visual review is bypassed | Require manual review and approval for baseline updates |
| Testing every component at full-page level | Slow, brittle, unscalable; one change breaks many tests | Use component-level visual tests (Storybook + Chromatic) for isolated components |
| Not pinning browser version in CI | Browser update changes rendering; all baselines break simultaneously | Pin the Playwright/browser version in `package.json` and Docker image tag |

---

## Enforcement Checklist

- [ ] Visual regression tests exist for all critical pages (homepage, checkout, dashboard)
- [ ] `maxDiffPixelRatio` or `maxDiffPixels` is set — no zero-threshold comparisons
- [ ] `animations: 'disabled'` is configured globally for visual test projects
- [ ] Dynamic content (timestamps, avatars, ads) is masked in all visual tests
- [ ] Baselines are stored in Git LFS — no raw PNGs committed directly
- [ ] Visual tests run on a single browser (Chromium) and OS (Linux) in CI
- [ ] Browser and Playwright versions are pinned in `package.json` and CI config
- [ ] Multiple viewports are tested: mobile, tablet, desktop at minimum
- [ ] Baseline updates require explicit reviewer approval in pull requests
- [ ] Component-level visual tests exist for the design system (Storybook + Chromatic or equivalent)
- [ ] Visual test project is separated from functional E2E tests in `playwright.config.ts`
- [ ] CI uploads diff artifacts (actual, expected, diff images) on failure for debugging
