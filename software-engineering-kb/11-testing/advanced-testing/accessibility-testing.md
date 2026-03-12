# Accessibility Testing

| Attribute      | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| Domain         | Testing > Advanced Testing                                         |
| Importance     | High                                                               |
| Last Updated   | 2026-03-10                                                         |
| Cross-ref      | `11-testing/e2e-testing/`, `08-security/compliance/`               |

---

## Core Concepts

### Why Accessibility Testing Matters

Accessibility (a11y) testing verifies that applications are usable by people with disabilities, including visual, auditory, motor, and cognitive impairments. It is both a **legal requirement** and an **engineering quality standard**.

- **1 billion+ people worldwide** live with some form of disability.
- Accessible interfaces improve usability for *all* users (keyboard power users, situational impairments, slow connections).
- Non-compliance exposes organizations to lawsuits and regulatory fines.

### WCAG 2.2 Compliance Levels

| Level | Description | Scope |
| ----- | ----------- | ----- |
| **A** | Minimum accessibility | Basic keyboard access, text alternatives for images, form labels |
| **AA** | Standard compliance target | Color contrast ratios, resize support, focus visibility, error identification |
| **AAA** | Enhanced accessibility | Sign language for video, extended audio descriptions, simplified reading level |

**Target AA as the baseline for all web applications.** AAA is aspirational for most teams; A alone is insufficient.

### Key WCAG Principles (POUR)

1. **Perceivable** -- Information must be presentable in ways users can perceive (alt text, captions, contrast).
2. **Operable** -- UI components must be operable via keyboard, have sufficient time, avoid seizure triggers.
3. **Understandable** -- Content must be readable; UI must be predictable and help users avoid errors.
4. **Robust** -- Content must be compatible with assistive technologies (valid HTML, ARIA roles).

### European Accessibility Act (EAA) 2025

The EAA mandates accessibility for digital products and services sold in the EU, effective June 2025. Key requirements:

- All e-commerce, banking, transport, and telecom services must meet EN 301 549 (aligned with WCAG 2.1 AA).
- Applies to both EU-based companies and non-EU companies selling into the EU market.
- Non-compliance penalties are set by each member state but can include fines and market withdrawal.
- Existing products have transition periods; new products must comply immediately.

### Tools Overview

| Tool | Type | Integration | Scope |
| --- | --- | --- | --- |
| axe-core | Engine/library | Playwright, Cypress, Jest, Storybook | DOM analysis, WCAG rules |
| Pa11y | CLI/CI tool | CI pipelines, dashboards | Page-level scanning |
| Lighthouse | Audit tool | Chrome, CI (via lighthouse-ci) | Performance + a11y scoring |
| WAVE | Browser extension | Manual review | Visual overlay of issues |
| axe DevTools | Browser extension | Manual review | Interactive issue exploration |

**Automated tools catch approximately 30-50 % of accessibility issues.** The remainder requires manual testing with assistive technologies.

---

## Code Examples

### TypeScript -- axe-core with Playwright

```typescript
// a11y.spec.ts -- Automated accessibility testing with Playwright and axe-core
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('home page has no critical a11y violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .exclude('.third-party-widget') // exclude elements you do not control
      .analyze();

    // Log violations for debugging
    for (const violation of results.violations) {
      console.log(`[${violation.impact}] ${violation.id}: ${violation.description}`);
      for (const node of violation.nodes) {
        console.log(`  - ${node.html}`);
        console.log(`    Fix: ${node.failureSummary}`);
      }
    }

    expect(results.violations).toEqual([]);
  });

  test('login form is keyboard accessible', async ({ page }) => {
    await page.goto('/login');

    // Tab through form elements and verify focus order
    await page.keyboard.press('Tab');
    const emailFocused = await page.locator('#email').evaluate(
      (el) => document.activeElement === el,
    );
    expect(emailFocused).toBe(true);

    await page.keyboard.press('Tab');
    const passwordFocused = await page.locator('#password').evaluate(
      (el) => document.activeElement === el,
    );
    expect(passwordFocused).toBe(true);

    await page.keyboard.press('Tab');
    const submitFocused = await page.locator('button[type="submit"]').evaluate(
      (el) => document.activeElement === el,
    );
    expect(submitFocused).toBe(true);

    // Verify Enter submits the form
    await page.locator('#email').fill('user@example.com');
    await page.locator('#password').fill('password123');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('modal dialog traps focus correctly', async ({ page }) => {
    await page.goto('/products');
    await page.click('[data-testid="open-filter-modal"]');

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Focus should be inside the modal
    const activeInModal = await modal.evaluate((el) =>
      el.contains(document.activeElement),
    );
    expect(activeInModal).toBe(true);

    // Tab should cycle within modal, not escape to background
    const focusableElements = await modal.locator(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
    ).count();

    for (let i = 0; i < focusableElements + 1; i++) {
      await page.keyboard.press('Tab');
      const stillInModal = await modal.evaluate((el) =>
        el.contains(document.activeElement),
      );
      expect(stillInModal).toBe(true);
    }

    // Escape closes the modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('images have meaningful alt text', async ({ page }) => {
    await page.goto('/products');
    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');

      // Images must have alt text or role="presentation" for decorative images
      const hasAlt = alt !== null && alt.trim().length > 0;
      const isDecorative = role === 'presentation' || alt === '';

      expect(
        hasAlt || isDecorative,
        `Image ${i} missing alt text: ${await img.evaluate((el) => el.outerHTML)}`,
      ).toBe(true);
    }
  });
});
```

### TypeScript -- Storybook a11y Addon

```typescript
// .storybook/main.ts -- Enable a11y addon
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-essentials',
  ],
  framework: '@storybook/react-vite',
};

export default config;

// src/components/Button/Button.stories.tsx -- Component with a11y checks
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'button-name', enabled: true },
        ],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    children: 'Submit Order',
    variant: 'primary',
  },
};

export const IconOnly: Story = {
  args: {
    children: <SearchIcon />,
    'aria-label': 'Search products',  // required for icon-only buttons
    variant: 'icon',
  },
};

// Bad example -- will fail a11y check in Storybook
export const MissingLabel: Story = {
  args: {
    children: <SearchIcon />,
    variant: 'icon',
    // No aria-label -- axe will flag "button-name" violation
  },
};
```

### YAML -- CI Pipeline with Lighthouse a11y Audit

```yaml
# .github/workflows/a11y.yaml -- Lighthouse accessibility audit in CI
name: Accessibility Audit
on:
  pull_request:
    branches: [main]
    paths:
      - 'src/**'
      - 'public/**'

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Build application
        run: npm run build
      - name: Start server
        run: npm run preview &
        env:
          PORT: 3000
      - name: Wait for server
        run: npx wait-on http://localhost:3000 --timeout 30000
      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v12
        with:
          configPath: .lighthouserc.json
          uploadArtifacts: true

  axe-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Build and start
        run: npm run build && npm run preview &
        env:
          PORT: 3000
      - name: Wait for server
        run: npx wait-on http://localhost:3000 --timeout 30000
      - name: Run axe scan
        run: |
          npx @axe-core/cli http://localhost:3000 \
            http://localhost:3000/login \
            http://localhost:3000/products \
            --tags wcag2a,wcag2aa,wcag22aa \
            --exit
```

```jsonc
// .lighthouserc.json -- Lighthouse CI configuration with a11y thresholds
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/",
        "http://localhost:3000/login",
        "http://localhost:3000/products",
        "http://localhost:3000/checkout"
      ],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:accessibility": ["error", { "minScore": 0.9 }],
        "categories:best-practices": ["warn", { "minScore": 0.8 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

---

## Common Violations and Fixes

| Violation | WCAG Criterion | Impact | Fix |
| --- | --- | --- | --- |
| Missing alt text on images | 1.1.1 Non-text Content | Screen readers announce "image" with no context | Add descriptive `alt`; use `alt=""` for decorative images |
| Missing form labels | 1.3.1 Info and Relationships | Users cannot identify form fields | Associate `<label>` with `for` attribute or use `aria-label` |
| Insufficient color contrast | 1.4.3 Contrast (Minimum) | Text unreadable for low-vision users | Ensure 4.5:1 ratio for normal text, 3:1 for large text |
| No visible focus indicator | 2.4.7 Focus Visible | Keyboard users cannot track position | Maintain or enhance default focus styles; never use `outline: none` |
| Missing skip navigation link | 2.4.1 Bypass Blocks | Keyboard users must tab through nav on every page | Add a "Skip to main content" link as first focusable element |
| Incorrect ARIA roles | 4.1.2 Name, Role, Value | Assistive tech misinterprets element purpose | Use native HTML elements first; apply ARIA only when necessary |
| Auto-playing media | 1.4.2 Audio Control | Disorienting for screen reader users | Never auto-play; provide pause/stop controls |
| Missing page language | 3.1.1 Language of Page | Screen readers use wrong pronunciation | Add `lang` attribute to `<html>` element |

---

## Manual Testing Checklist

Automated tools miss many issues. Perform these manual checks:

### Keyboard Navigation
- Tab through every interactive element in logical order.
- Verify all functionality is reachable without a mouse.
- Confirm focus is never trapped (except in modal dialogs by design).
- Test `Enter` and `Space` on buttons, links, and custom controls.

### Screen Reader Testing
- Test with NVDA (Windows), VoiceOver (macOS/iOS), TalkBack (Android).
- Verify all content is announced in a meaningful order.
- Confirm form errors are announced when they appear.
- Check that dynamic content updates are communicated via live regions.

### Color and Contrast
- Use a contrast checker (browser devtools or WAVE) on every text element.
- Verify information is not conveyed by color alone (add icons, patterns, or text).
- Test with simulated color blindness (Chrome DevTools > Rendering > Emulate vision deficiencies).

### Zoom and Reflow
- Zoom to 200 % and verify no content is cut off or overlapping.
- Verify the page reflows to a single column at 320 px width (WCAG 1.4.10).

---

## 10 Best Practices

1. **Automate axe-core scans in CI** -- catch the 30-50 % of issues that are machine-detectable on every PR.
2. **Use semantic HTML before ARIA** -- a `<button>` is more accessible than `<div role="button" tabindex="0">`.
3. **Test with real assistive technology** -- automated tools cannot replace screen reader testing; schedule monthly manual audits.
4. **Enforce Lighthouse a11y score >= 90** -- set it as a CI gate; treat regressions as bugs.
5. **Add a11y checks to Storybook** -- catch component-level issues during development, before integration.
6. **Design with accessibility from the start** -- retrofitting is 10x more expensive than building accessible components from day one.
7. **Include disabled users in usability testing** -- no amount of automated testing replaces real user feedback.
8. **Document accessibility patterns** -- create a component library with pre-approved, tested accessible patterns.
9. **Train the entire team** -- designers, developers, QA, and product managers all share responsibility for accessibility.
10. **Track violation trends** -- measure total violations per page over time; target zero critical and serious issues.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
| --- | --- | --- |
| Using `outline: none` without a replacement focus style | Keyboard users cannot see where focus is | Remove the rule or replace with a visible custom focus indicator |
| Adding ARIA roles to native HTML elements | Conflicting semantics confuse assistive tech | Use `<button>`, `<nav>`, `<main>` instead of `<div role="button">` |
| Relying only on color to convey information | Color-blind users miss critical context (error states, required fields) | Add icons, text labels, or patterns alongside color |
| Suppressing axe violations with global ignores | Violations accumulate; compliance erodes | Fix violations at the source; ignore only after documented justification |
| Testing only with automated tools | Misses 50-70 % of real accessibility barriers | Combine automated scans with manual keyboard and screen reader testing |
| Hiding content with `display: none` instead of visually-hidden class | Screen readers cannot access content meant for them | Use `.sr-only` / `visually-hidden` CSS class for screen-reader-only content |
| Building custom widgets without keyboard support | Mouse-only functionality excludes keyboard and switch-device users | Implement full keyboard interaction per WAI-ARIA Authoring Practices |
| Treating accessibility as a final QA gate | Late discovery of issues; expensive rework | Shift left: integrate a11y into design reviews, component development, and CI |

---

## Enforcement Checklist

- [ ] axe-core is integrated into the E2E test suite and runs on every PR
- [ ] Lighthouse CI enforces a minimum accessibility score of 90
- [ ] Storybook a11y addon is enabled and violations block component approval
- [ ] All images have meaningful `alt` text or are marked as decorative
- [ ] All form inputs have associated labels (via `<label>`, `aria-label`, or `aria-labelledby`)
- [ ] Color contrast meets WCAG AA ratios: 4.5:1 for normal text, 3:1 for large text
- [ ] Keyboard navigation works for all interactive elements without mouse dependency
- [ ] Focus indicators are visible on all focusable elements
- [ ] Manual screen reader audit is performed at least once per quarter
- [ ] The team has completed accessibility training and follows documented a11y component patterns
