# Accessibility (a11y) — Complete Specification

> **AI Plugin Directive:** When a developer asks "how do I make this accessible?", "what ARIA attributes should I use?", "how do I handle keyboard navigation?", "how do I manage focus in a modal?", "what is focus trap?", "how do I test accessibility?", "what is WCAG 2.2?", "what color contrast ratio do I need?", or "how do I make an accessible form?", use this directive. Accessibility is NOT optional — it is a LEGAL REQUIREMENT in most jurisdictions (ADA, EAA, AODA, Section 508). ALWAYS build for WCAG 2.2 Level AA minimum. NEVER treat accessibility as a post-launch fix — it MUST be built in from the first component. Every interactive element MUST be keyboard accessible. Every image MUST have alt text. Every form control MUST have a label. NO EXCEPTIONS.

---

## 1. The Core Rule

**Every component MUST be perceivable, operable, understandable, and robust (POUR) per WCAG 2.2 Level AA. This means: all content has text alternatives, all functionality works via keyboard, all content is readable and predictable, and all markup is valid and compatible with assistive technologies. NEVER ship a component that fails any of these four principles.**

```
WCAG 2.2 FOUR PRINCIPLES (POUR)

  ┌────────────────────────────────────────────────────────┐
  │                    PERCEIVABLE                         │
  │  Can users PERCEIVE all content?                       │
  │  - Text alternatives for images                        │
  │  - Captions for video/audio                            │
  │  - Sufficient color contrast                           │
  │  - Content reflows at 400% zoom                        │
  │  - No information conveyed by color alone              │
  ├────────────────────────────────────────────────────────┤
  │                     OPERABLE                           │
  │  Can users OPERATE all interactive elements?           │
  │  - All functionality via keyboard                      │
  │  - No keyboard traps (except intentional focus traps)  │
  │  - Sufficient time to read/interact                    │
  │  - No content that causes seizures                     │
  │  - Skip navigation links                              │
  │  - Focus visible on all interactive elements           │
  ├────────────────────────────────────────────────────────┤
  │                   UNDERSTANDABLE                       │
  │  Can users UNDERSTAND the content and UI?              │
  │  - Language of page is set                             │
  │  - Labels and instructions for forms                   │
  │  - Consistent navigation                               │
  │  - Error identification and suggestions                │
  ├────────────────────────────────────────────────────────┤
  │                       ROBUST                           │
  │  Is the markup ROBUST for assistive technologies?      │
  │  - Valid HTML semantics                                │
  │  - ARIA used correctly (not overused)                  │
  │  - Status messages programmatically determined          │
  │  - Compatible with current and future AT               │
  └────────────────────────────────────────────────────────┘
```

---

## 2. WCAG 2.2 Compliance Levels

| Level | Target | What It Covers | Required? |
|-------|--------|----------------|-----------|
| **A** | Minimum | Basic accessibility — alt text, keyboard access, no auto-playing media | YES — absolute minimum |
| **AA** | Standard | Color contrast (4.5:1), resize text (200%), focus visible, error identification | YES — this is the LEGAL STANDARD (ADA, EAA) |
| **AAA** | Enhanced | Extended contrast (7:1), sign language, reading level, no timing | NICE TO HAVE — not legally required |

**RULE: ALWAYS target Level AA. Implement Level A criteria as non-negotiable. Add Level AAA criteria for critical user paths (checkout, onboarding).**

### WCAG 2.2 New Success Criteria (beyond 2.1)

| Criterion | Level | What It Requires |
|-----------|-------|-----------------|
| **2.4.11 Focus Not Obscured (Minimum)** | AA | Focused element is not entirely hidden by sticky headers/footers/overlays |
| **2.4.12 Focus Not Obscured (Enhanced)** | AAA | Focused element is fully visible (not even partially hidden) |
| **2.4.13 Focus Appearance** | AAA | Focus indicator has minimum area (2px outline) and contrast ratio |
| **2.5.7 Dragging Movements** | AA | Any dragging operation has a single-pointer alternative (click, tap) |
| **2.5.8 Target Size (Minimum)** | AA | Interactive targets are at least 24x24 CSS pixels |
| **3.2.6 Consistent Help** | A | Help mechanisms appear in consistent location across pages |
| **3.3.7 Redundant Entry** | A | Previously entered info is auto-populated or selectable |
| **3.3.8 Accessible Authentication (Minimum)** | AA | No cognitive function test (CAPTCHA) without alternative |
| **3.3.9 Accessible Authentication (Enhanced)** | AAA | No object/content recognition test for auth |

---

## 3. ARIA Roles, States, and Properties

### The First Rule of ARIA

**Use native HTML elements FIRST. ARIA is a LAST RESORT. A native `<button>` is ALWAYS better than `<div role="button">`. NEVER use ARIA to fix what correct HTML semantics would handle.**

```
ARIA DECISION TREE

  START: You need an interactive element
    │
    ├─ Does a native HTML element exist? (<button>, <input>, <select>, <a>, etc.)
    │   YES → USE IT. Do NOT add ARIA. You are done.
    │   NO ↓
    │
    ├─ Does a native HTML element exist but needs enhancement?
    │   (e.g., <div> used as a tab panel, custom dropdown)
    │   YES → Add ARIA roles, states, and properties
    │   NO ↓
    │
    └─ Building a fully custom widget?
        YES → Follow WAI-ARIA Authoring Practices for that widget pattern
```

### Essential ARIA Roles

| Role | When to Use | Native Alternative |
|------|------------|-------------------|
| `role="button"` | Custom clickable div/span | `<button>` (ALWAYS prefer) |
| `role="link"` | Custom navigation element | `<a href>` (ALWAYS prefer) |
| `role="tab"` | Tab trigger in tabbed interface | None — ARIA required |
| `role="tablist"` | Container for tabs | None — ARIA required |
| `role="tabpanel"` | Tab content panel | None — ARIA required |
| `role="dialog"` | Modal dialog | `<dialog>` (ALWAYS prefer) |
| `role="alertdialog"` | Modal requiring user action | None — ARIA required |
| `role="alert"` | Important, time-sensitive message | None — ARIA required |
| `role="status"` | Advisory information (not time-sensitive) | `<output>` |
| `role="menu"` | Navigation/action menu | None — ARIA required |
| `role="menuitem"` | Item within a menu | None — ARIA required |
| `role="listbox"` | Custom select dropdown list | `<select>` (ALWAYS prefer) |
| `role="option"` | Item within a listbox | `<option>` (ALWAYS prefer) |
| `role="combobox"` | Input with popup suggestions | None — ARIA required |
| `role="tree"` | Hierarchical list (file tree) | None — ARIA required |
| `role="treeitem"` | Item within a tree | None — ARIA required |
| `role="grid"` | Interactive data grid | `<table>` (for non-interactive) |
| `role="progressbar"` | Progress indicator | `<progress>` (ALWAYS prefer) |
| `role="tooltip"` | Tooltip popup | None — ARIA required |
| `role="region"` | Important page section | `<section>` with heading |
| `role="navigation"` | Navigation section | `<nav>` (ALWAYS prefer) |
| `role="main"` | Main content area | `<main>` (ALWAYS prefer) |
| `role="presentation"` / `role="none"` | Remove semantics from element | Use when decorative only |

### Essential ARIA States and Properties

| Attribute | Type | Values | When to Use |
|-----------|------|--------|------------|
| `aria-expanded` | State | `true` / `false` | Disclosure, accordion, dropdown trigger |
| `aria-selected` | State | `true` / `false` | Tabs, listbox options, grid cells |
| `aria-checked` | State | `true` / `false` / `mixed` | Checkboxes, toggles, switches |
| `aria-pressed` | State | `true` / `false` | Toggle buttons |
| `aria-disabled` | State | `true` / `false` | Disabled elements (prefer `disabled` attribute) |
| `aria-hidden` | State | `true` / `false` | Hide from AT (decorative icons, duplicated text) |
| `aria-invalid` | State | `true` / `false` | Form fields with validation errors |
| `aria-busy` | State | `true` / `false` | Content being updated (loading states) |
| `aria-current` | State | `page` / `step` / `location` / `date` / `true` | Active nav item, wizard step, breadcrumb |
| `aria-label` | Property | String | Accessible name when no visible text exists |
| `aria-labelledby` | Property | ID reference(s) | Points to visible text that labels this element |
| `aria-describedby` | Property | ID reference(s) | Points to text that describes this element |
| `aria-controls` | Property | ID reference | Points to element this one controls (tab → panel) |
| `aria-owns` | Property | ID reference(s) | Establishes parent-child when DOM order differs |
| `aria-live` | Property | `off` / `polite` / `assertive` | Region where content updates should be announced |
| `aria-atomic` | Property | `true` / `false` | Whether entire region should be announced on change |
| `aria-relevant` | Property | `additions` / `removals` / `text` / `all` | What types of changes should be announced |
| `aria-haspopup` | Property | `true` / `menu` / `listbox` / `dialog` | Element triggers a popup |
| `aria-orientation` | Property | `horizontal` / `vertical` | Orientation of tablist, listbox, slider |
| `aria-sort` | Property | `ascending` / `descending` / `none` | Sort direction of table column |
| `aria-required` | Property | `true` / `false` | Form field is required (prefer `required` attribute) |
| `aria-activedescendant` | Property | ID reference | Currently active/focused descendant in composite widget |
| `aria-roledescription` | Property | String | Custom role description (use sparingly) |
| `aria-valuemin/max/now/text` | Property | Number/String | Range widget values (slider, progress) |

---

## 4. Keyboard Navigation Patterns

### 4.1 Focus Management

```typescript
// ─── useFocusManagement hook ────────────────────────────────
import { useRef, useCallback, useEffect } from 'react';

/**
 * Manages focus movement to a specific element.
 *
 * RULES:
 * - ALWAYS move focus to new content when it appears (modals, alerts)
 * - ALWAYS return focus to trigger when content closes
 * - NEVER trap focus unintentionally
 */
export function useFocusManagement() {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  /** Save the currently focused element before moving focus */
  const saveFocus = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
  }, []);

  /** Restore focus to the previously focused element */
  const restoreFocus = useCallback(() => {
    if (previousFocusRef.current && previousFocusRef.current.focus) {
      previousFocusRef.current.focus();
    }
  }, []);

  /** Move focus to a specific element */
  const moveFocusTo = useCallback((element: HTMLElement | null) => {
    if (element) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        element.focus();
      });
    }
  }, []);

  return { saveFocus, restoreFocus, moveFocusTo };
}
```

### 4.2 Focus Trap (for Modals/Dialogs)

```typescript
// ─── useFocusTrap hook ──────────────────────────────────────
import { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
  'audio[controls]',
  'video[controls]',
  'details > summary',
].join(',');

/**
 * Traps focus within a container element.
 *
 * RULES:
 * - MUST trap focus in modals, dialogs, and drawers
 * - MUST allow Escape to close (unless alertdialog)
 * - MUST return focus to trigger element on close
 * - Tab cycles through focusable elements within container
 * - Shift+Tab cycles backward
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  isActive: boolean
) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    ).filter((el) => {
      // Filter out hidden elements
      return el.offsetParent !== null && !el.hasAttribute('aria-hidden');
    });
  }, [containerRef]);

  useEffect(() => {
    if (!isActive) return;

    // Save current focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Move focus into the trap
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      requestAnimationFrame(() => {
        focusableElements[0].focus();
      });
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus on cleanup
      if (previousFocusRef.current?.focus) {
        previousFocusRef.current.focus();
      }
    };
  }, [isActive, getFocusableElements]);
}
```

### 4.3 Roving Tabindex (for Toolbars, Tab Lists, Menus)

```typescript
// ─── useRovingTabindex hook ─────────────────────────────────
import { useState, useCallback, type KeyboardEvent } from 'react';

/**
 * Implements roving tabindex for composite widgets.
 *
 * HOW IT WORKS:
 * - Only ONE item in the group has tabindex="0" (the active one)
 * - All other items have tabindex="-1"
 * - Arrow keys move the active item
 * - Tab exits the group entirely (to next focusable element)
 *
 * USED FOR: Tablists, toolbars, menu bars, radio groups, tree items
 */
export function useRovingTabindex(
  itemCount: number,
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
  } = {}
) {
  const { orientation = 'horizontal', loop = true } = options;
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent, index: number) => {
      const nextKey =
        orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
      const prevKey =
        orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';

      let nextIndex = index;

      switch (e.key) {
        case nextKey:
          e.preventDefault();
          nextIndex = index + 1;
          if (nextIndex >= itemCount) {
            nextIndex = loop ? 0 : itemCount - 1;
          }
          break;
        case prevKey:
          e.preventDefault();
          nextIndex = index - 1;
          if (nextIndex < 0) {
            nextIndex = loop ? itemCount - 1 : 0;
          }
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = itemCount - 1;
          break;
        default:
          return; // Don't update for other keys
      }

      setActiveIndex(nextIndex);
    },
    [itemCount, orientation, loop]
  );

  /**
   * Returns the tabIndex for an item at the given index.
   * ONLY the active item gets tabIndex 0; all others get -1.
   */
  const getTabIndex = useCallback(
    (index: number): 0 | -1 => {
      return index === activeIndex ? 0 : -1;
    },
    [activeIndex]
  );

  return { activeIndex, setActiveIndex, handleKeyDown, getTabIndex };
}
```

### Keyboard Pattern Reference

```
KEYBOARD PATTERNS BY WIDGET TYPE

┌────────────────┬──────────────────────────────────────────────────┐
│ Widget         │ Keyboard Behavior                                │
├────────────────┼──────────────────────────────────────────────────┤
│ Button         │ Enter/Space → activate                           │
│                │ (native <button> does this automatically)        │
├────────────────┼──────────────────────────────────────────────────┤
│ Link           │ Enter → follow link                              │
│                │ (native <a> does this automatically)             │
├────────────────┼──────────────────────────────────────────────────┤
│ Checkbox       │ Space → toggle checked                           │
│                │ (native <input type="checkbox"> automatic)       │
├────────────────┼──────────────────────────────────────────────────┤
│ Tabs           │ Arrow Left/Right → move between tabs (horizontal)│
│                │ Arrow Up/Down → move between tabs (vertical)     │
│                │ Home → first tab / End → last tab                │
│                │ Tab key → exit tablist into tab panel             │
│                │ Roving tabindex: only active tab in tab order    │
├────────────────┼──────────────────────────────────────────────────┤
│ Menu           │ Arrow Down/Up → navigate items                   │
│                │ Enter/Space → activate item                      │
│                │ Escape → close menu, return focus to trigger     │
│                │ Home → first item / End → last item              │
│                │ Type-ahead: type letter → jump to matching item  │
├────────────────┼──────────────────────────────────────────────────┤
│ Dialog/Modal   │ Tab/Shift+Tab → cycle through focusable elements │
│                │ Escape → close dialog                            │
│                │ Focus trapped inside dialog                      │
│                │ Focus moves to first focusable on open           │
│                │ Focus returns to trigger on close                │
├────────────────┼──────────────────────────────────────────────────┤
│ Listbox/Select │ Arrow Down/Up → navigate options                 │
│                │ Enter/Space → select option                      │
│                │ Escape → close dropdown                          │
│                │ Home → first option / End → last option          │
│                │ Type-ahead → jump to matching option             │
├────────────────┼──────────────────────────────────────────────────┤
│ Accordion      │ Enter/Space → expand/collapse section            │
│                │ Arrow Down/Up → move between headers             │
│                │ Home → first header / End → last header          │
├────────────────┼──────────────────────────────────────────────────┤
│ Tree View      │ Arrow Down/Up → navigate items                   │
│                │ Arrow Right → expand node / move to child        │
│                │ Arrow Left → collapse node / move to parent      │
│                │ Enter → activate item                            │
│                │ Home → first item / End → last item              │
├────────────────┼──────────────────────────────────────────────────┤
│ Slider         │ Arrow Right/Up → increase value                  │
│                │ Arrow Left/Down → decrease value                 │
│                │ Page Up → increase by large step                 │
│                │ Page Down → decrease by large step               │
│                │ Home → minimum / End → maximum                   │
├────────────────┼──────────────────────────────────────────────────┤
│ Data Table     │ Arrow keys → navigate cells                      │
│                │ Enter → activate cell / enter edit mode           │
│                │ Escape → exit edit mode                          │
│                │ Tab → move to next interactive element            │
└────────────────┴──────────────────────────────────────────────────┘
```

---

## 5. Screen Reader Announcements

### aria-live Regions

```typescript
// ─── LiveRegion component ───────────────────────────────────

interface LiveRegionProps {
  /** The message to announce */
  message: string;
  /**
   * politeness:
   * - "polite": announced after current speech finishes (DEFAULT)
   * - "assertive": interrupts current speech (use SPARINGLY)
   */
  politeness?: 'polite' | 'assertive';
  /**
   * Whether to announce the entire region or only changes.
   * true = announce entire region content
   * false = announce only changed nodes (default)
   */
  atomic?: boolean;
}

/**
 * LiveRegion — announces dynamic content changes to screen readers.
 *
 * RULES:
 * - MUST be in the DOM BEFORE content changes (not conditionally rendered)
 * - Use "polite" for non-urgent updates (search results, status changes)
 * - Use "assertive" ONLY for errors and time-critical alerts
 * - NEVER use assertive for loading states or success messages
 */
export function LiveRegion({
  message,
  politeness = 'polite',
  atomic = true,
}: LiveRegionProps) {
  return (
    <div
      aria-live={politeness}
      aria-atomic={atomic}
      role={politeness === 'assertive' ? 'alert' : 'status'}
      className="sr-only"
    >
      {message}
    </div>
  );
}
```

```typescript
// ─── useAnnounce hook ───────────────────────────────────────
import { useState, useCallback, useRef } from 'react';

/**
 * Hook for programmatic screen reader announcements.
 *
 * USAGE:
 *   const { announce, AnnouncementRegion } = useAnnounce();
 *   announce('3 results found');
 *   // In JSX: <AnnouncementRegion />
 */
export function useAnnounce() {
  const [message, setMessage] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout>();

  const announce = useCallback((text: string, politeness: 'polite' | 'assertive' = 'polite') => {
    // Clear then set — ensures re-announcement of same message
    setMessage('');
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setMessage(text), 100);
  }, []);

  const AnnouncementRegion = useCallback(
    () => (
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    ),
    [message]
  );

  return { announce, AnnouncementRegion };
}

// ─── Usage in search results ────────────────────────────────

function SearchResults({ results, query }: { results: Item[]; query: string }) {
  const { announce, AnnouncementRegion } = useAnnounce();

  useEffect(() => {
    announce(`${results.length} results found for "${query}"`);
  }, [results.length, query, announce]);

  return (
    <div>
      <AnnouncementRegion />
      <ul>
        {results.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 6. Color Contrast Ratios

```
COLOR CONTRAST REQUIREMENTS (WCAG 2.2)

  ┌──────────────────────────┬──────────┬──────────┐
  │ Content Type             │ Level AA │ Level AAA│
  ├──────────────────────────┼──────────┼──────────┤
  │ Normal text (<18px)      │  4.5:1   │   7:1    │
  │ Large text (>=18px bold  │  3:1     │   4.5:1  │
  │   or >=24px regular)     │          │          │
  │ UI components & graphics │  3:1     │   N/A    │
  │ Focus indicators         │  3:1     │   N/A    │
  │ Disabled elements        │  None    │   None   │
  │ Decorative elements      │  None    │   None   │
  │ Logos/brand text          │  None    │   None   │
  └──────────────────────────┴──────────┴──────────┘

  RULES:
  - ALWAYS test contrast ratios during design, not after
  - NEVER rely on color alone to convey information
  - ALWAYS provide a secondary indicator (icon, text, pattern)
  - Test with grayscale filter to verify non-color indicators
```

```typescript
// Contrast checking utility (for design token validation)
function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hex1);
  const lum2 = getRelativeLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ALWAYS validate design tokens at build time:
const tokens = {
  textPrimary: '#1a1a1a',
  background: '#ffffff',
};

const ratio = getContrastRatio(tokens.textPrimary, tokens.background);
if (ratio < 4.5) {
  throw new Error(
    `Contrast ratio ${ratio.toFixed(2)}:1 between textPrimary and background ` +
    `fails WCAG AA (minimum 4.5:1)`
  );
}
```

---

## 7. Accessible Forms

```typescript
// ─── Accessible Form — Complete React Example ──────────────

import { useId, type FormEvent, useState } from 'react';

interface FormErrors {
  name?: string;
  email?: string;
  role?: string;
}

/**
 * Accessible form implementing ALL required patterns:
 * - Every input has a visible <label> linked via htmlFor/id
 * - Required fields are indicated with both visual (*) and aria-required
 * - Errors are linked via aria-describedby and announced with role="alert"
 * - Descriptions are linked via aria-describedby
 * - Form has accessible name via aria-labelledby or aria-label
 * - Submit button has clear action label
 * - Error summary at top with links to each field (for >3 errors)
 */
export function AccessibleForm() {
  const formId = useId();
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const nameId = `${formId}-name`;
  const emailId = `${formId}-email`;
  const roleId = `${formId}-role`;

  const validate = (formData: FormData): FormErrors => {
    const errors: FormErrors = {};
    if (!formData.get('name')) errors.name = 'Name is required.';
    if (!formData.get('email')) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.get('email') as string)) {
      errors.email = 'Enter a valid email address (e.g., user@example.com).';
    }
    if (!formData.get('role')) errors.role = 'Please select a role.';
    return errors;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newErrors = validate(formData);
    setErrors(newErrors);
    setSubmitted(true);

    if (Object.keys(newErrors).length === 0) {
      // Success
    } else {
      // MUST: Focus the error summary for screen readers
      document.getElementById(`${formId}-error-summary`)?.focus();
    }
  };

  const errorCount = Object.keys(errors).length;

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby={`${formId}-heading`}
      noValidate // Use custom validation, not browser default
    >
      <h2 id={`${formId}-heading`}>Create Account</h2>

      {/* Error Summary — shown when there are errors after submit */}
      {submitted && errorCount > 0 && (
        <div
          id={`${formId}-error-summary`}
          role="alert"
          tabIndex={-1}
          className="mb-4 rounded-md border border-destructive bg-destructive/10 p-4"
        >
          <h3 className="font-medium text-destructive">
            {errorCount} {errorCount === 1 ? 'error' : 'errors'} found:
          </h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-destructive">
            {errors.name && (
              <li>
                <a href={`#${nameId}`} className="underline">
                  Name: {errors.name}
                </a>
              </li>
            )}
            {errors.email && (
              <li>
                <a href={`#${emailId}`} className="underline">
                  Email: {errors.email}
                </a>
              </li>
            )}
            {errors.role && (
              <li>
                <a href={`#${roleId}`} className="underline">
                  Role: {errors.role}
                </a>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Name Field */}
      <div className="mb-4">
        <label htmlFor={nameId} className="block text-sm font-medium">
          Full Name <span aria-hidden="true" className="text-destructive">*</span>
        </label>
        <input
          id={nameId}
          name="name"
          type="text"
          aria-required="true"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? `${nameId}-error` : undefined}
          className="mt-1 block w-full rounded-md border px-3 py-2"
          autoComplete="name"
        />
        {errors.name && (
          <p id={`${nameId}-error`} className="mt-1 text-sm text-destructive" role="alert">
            {errors.name}
          </p>
        )}
      </div>

      {/* Email Field */}
      <div className="mb-4">
        <label htmlFor={emailId} className="block text-sm font-medium">
          Email Address <span aria-hidden="true" className="text-destructive">*</span>
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={
            [errors.email ? `${emailId}-error` : '', `${emailId}-hint`]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className="mt-1 block w-full rounded-md border px-3 py-2"
          autoComplete="email"
        />
        <p id={`${emailId}-hint`} className="mt-1 text-xs text-muted-foreground">
          We will never share your email.
        </p>
        {errors.email && (
          <p id={`${emailId}-error`} className="mt-1 text-sm text-destructive" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      {/* Role Select */}
      <div className="mb-4">
        <label htmlFor={roleId} className="block text-sm font-medium">
          Role <span aria-hidden="true" className="text-destructive">*</span>
        </label>
        <select
          id={roleId}
          name="role"
          aria-required="true"
          aria-invalid={!!errors.role}
          aria-describedby={errors.role ? `${roleId}-error` : undefined}
          className="mt-1 block w-full rounded-md border px-3 py-2"
        >
          <option value="">Select a role...</option>
          <option value="developer">Developer</option>
          <option value="designer">Designer</option>
          <option value="manager">Manager</option>
        </select>
        {errors.role && (
          <p id={`${roleId}-error`} className="mt-1 text-sm text-destructive" role="alert">
            {errors.role}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
      >
        Create Account
      </button>
    </form>
  );
}
```

---

## 8. Accessible Modal/Dialog

```typescript
// src/components/organisms/Dialog/Dialog.tsx
import {
  useEffect,
  useRef,
  useCallback,
  useId,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { cn } from '@/utils/cn';

export interface DialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when dialog should close */
  onClose: () => void;
  /** Dialog title — REQUIRED for aria-labelledby */
  title: string;
  /** Optional description */
  description?: string;
  /** Dialog content */
  children: ReactNode;
  /** Whether clicking overlay closes dialog (false for alertdialog) */
  closeOnOverlayClick?: boolean;
  /** Whether Escape closes dialog (false for alertdialog) */
  closeOnEscape?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

/**
 * Accessible Dialog — implements WAI-ARIA Dialog pattern.
 *
 * ACCESSIBILITY REQUIREMENTS:
 * 1. role="dialog" (or role="alertdialog" for confirmations)
 * 2. aria-modal="true" — prevents AT from accessing background
 * 3. aria-labelledby pointing to the title
 * 4. aria-describedby pointing to description (if provided)
 * 5. Focus trap — Tab/Shift+Tab cycle within dialog
 * 6. Focus moves to first focusable element on open
 * 7. Focus returns to trigger element on close
 * 8. Escape key closes the dialog (unless alertdialog)
 * 9. Background scroll is prevented
 * 10. Background content has aria-hidden="true" (via inert)
 */
export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  size = 'md',
}: DialogProps) {
  const dialogId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;

  // Focus trap
  useFocusTrap(dialogRef, isOpen);

  // Prevent background scroll
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // Set inert on background content
  useEffect(() => {
    if (!isOpen) return;

    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.setAttribute('inert', '');
      mainContent.setAttribute('aria-hidden', 'true');
    }

    return () => {
      if (mainContent) {
        mainContent.removeAttribute('inert');
        mainContent.removeAttribute('aria-hidden');
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-[90vw]',
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 animate-in fade-in-0"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'relative z-50 w-full rounded-lg bg-background p-6 shadow-lg',
          'animate-in fade-in-0 zoom-in-95',
          sizeClasses[size]
        )}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Close dialog"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Title — MUST be present */}
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>

        {/* Description — optional */}
        {description && (
          <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
            {description}
          </p>
        )}

        {/* Content */}
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
```

---

## 9. Accessible Data Tables

```typescript
// ─── Accessible DataTable Requirements ──────────────────────

/**
 * RULES FOR ACCESSIBLE DATA TABLES:
 *
 * 1. MUST use <table>, <thead>, <tbody>, <tr>, <th>, <td>
 *    NEVER use div-based grids for tabular data
 *
 * 2. MUST have <caption> (visible or sr-only)
 *    Screen readers announce the caption when entering the table
 *
 * 3. MUST use <th scope="col"> for column headers
 *    MUST use <th scope="row"> for row headers (if applicable)
 *
 * 4. For sortable columns: MUST use aria-sort="ascending|descending|none"
 *
 * 5. For interactive tables (role="grid"):
 *    - Arrow keys navigate cells
 *    - Enter activates cell content
 *    - Focusable elements within cells use roving tabindex
 *
 * 6. For complex headers: use headers="" attribute to link
 *    data cells to multiple header cells
 */

interface AccessibleTableProps<T extends Record<string, unknown>> {
  data: T[];
  columns: {
    key: keyof T & string;
    header: string;
    sortable?: boolean;
  }[];
  caption: string;
  /** Whether caption is visually hidden */
  captionHidden?: boolean;
  sortColumn?: string;
  sortDirection?: 'ascending' | 'descending';
  onSort?: (column: string) => void;
}

function AccessibleTable<T extends Record<string, unknown>>({
  data,
  columns,
  caption,
  captionHidden = false,
  sortColumn,
  sortDirection,
  onSort,
}: AccessibleTableProps<T>) {
  return (
    <table role="table">
      {/* ALWAYS include a caption */}
      <caption className={captionHidden ? 'sr-only' : 'text-sm text-muted-foreground mb-2'}>
        {caption}
      </caption>

      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              scope="col"
              // MUST indicate sort state
              aria-sort={
                sortColumn === col.key ? sortDirection : col.sortable ? 'none' : undefined
              }
            >
              {col.sortable ? (
                <button
                  onClick={() => onSort?.(col.key)}
                  aria-label={`Sort by ${col.header}${
                    sortColumn === col.key
                      ? sortDirection === 'ascending'
                        ? ', currently sorted ascending'
                        : ', currently sorted descending'
                      : ''
                  }`}
                >
                  {col.header}
                </button>
              ) : (
                col.header
              )}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((col) => (
              <td key={col.key}>{String(row[col.key] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## 10. Accessible Drag and Drop

```typescript
// ─── Accessible Drag and Drop ───────────────────────────────

/**
 * WCAG 2.2 Criterion 2.5.7: Dragging Movements (Level AA)
 *
 * RULE: Every drag operation MUST have a single-pointer alternative.
 * Users who cannot perform dragging (motor disabilities, screen readers)
 * MUST be able to achieve the same result via:
 * - Click to pick up → Click to place
 * - Arrow keys to move
 * - Move Up/Move Down buttons
 *
 * NEVER make drag-and-drop the ONLY way to reorder or move items.
 */

interface ReorderableListProps {
  items: { id: string; label: string }[];
  onReorder: (fromIndex: number, toIndex: number) => void;
}

function ReorderableList({ items, onReorder }: ReorderableListProps) {
  const { announce, AnnouncementRegion } = useAnnounce();

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    onReorder(index, newIndex);
    announce(
      `${items[index].label} moved ${direction} to position ${newIndex + 1} of ${items.length}`
    );
  };

  return (
    <div>
      <AnnouncementRegion />
      <ul role="listbox" aria-label="Reorderable items">
        {items.map((item, index) => (
          <li
            key={item.id}
            role="option"
            aria-selected={false}
            className="flex items-center justify-between p-2 border-b"
          >
            <span>{item.label}</span>

            {/* KEYBOARD/POINTER ALTERNATIVE — required by WCAG 2.5.7 */}
            <div className="flex gap-1" role="group" aria-label={`Reorder ${item.label}`}>
              <button
                onClick={() => moveItem(index, 'up')}
                disabled={index === 0}
                aria-label={`Move ${item.label} up`}
                className="p-1 rounded hover:bg-muted disabled:opacity-30"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M18 15l-6-6-6 6" />
                </svg>
              </button>
              <button
                onClick={() => moveItem(index, 'down')}
                disabled={index === items.length - 1}
                aria-label={`Move ${item.label} down`}
                className="p-1 rounded hover:bg-muted disabled:opacity-30"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 11. Testing Accessibility

### 11.1 jest-axe (Unit Test Level)

```typescript
// ─── Setup ──────────────────────────────────────────────────
// npm install --save-dev jest-axe @testing-library/react

// src/test/setup.ts
import 'jest-axe/extend-expect';
```

```typescript
// ─── Component accessibility test ───────────────────────────
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AccessibleForm } from './AccessibleForm';

expect.extend(toHaveNoViolations);

describe('AccessibleForm', () => {
  it('MUST have no accessibility violations', async () => {
    const { container } = render(<AccessibleForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('MUST have labels linked to all inputs', () => {
    const { getByLabelText } = render(<AccessibleForm />);

    // Every input MUST be findable by its label
    expect(getByLabelText(/full name/i)).toBeInTheDocument();
    expect(getByLabelText(/email address/i)).toBeInTheDocument();
    expect(getByLabelText(/role/i)).toBeInTheDocument();
  });

  it('MUST show errors with role="alert"', async () => {
    const { getByRole, getAllByRole } = render(<AccessibleForm />);

    // Submit empty form
    const submitButton = getByRole('button', { name: /create account/i });
    await userEvent.click(submitButton);

    // Error messages MUST have role="alert"
    const alerts = getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('MUST link errors to inputs via aria-describedby', async () => {
    const { getByLabelText, getByRole } = render(<AccessibleForm />);

    await userEvent.click(getByRole('button', { name: /create account/i }));

    const nameInput = getByLabelText(/full name/i);
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAttribute('aria-describedby');

    // The describedby ID should point to an error message
    const describedbyId = nameInput.getAttribute('aria-describedby');
    const errorElement = document.getElementById(describedbyId!);
    expect(errorElement).toHaveTextContent(/required/i);
  });

  it('MUST support keyboard-only form submission', async () => {
    const { getByLabelText, getByRole } = render(<AccessibleForm />);

    // Tab to name field and type
    await userEvent.tab();
    await userEvent.type(getByLabelText(/full name/i), 'John Doe');

    // Tab to email and type
    await userEvent.tab();
    await userEvent.type(getByLabelText(/email/i), 'john@example.com');

    // Tab to role and select
    await userEvent.tab();
    await userEvent.selectOptions(getByLabelText(/role/i), 'developer');

    // Tab to submit and press Enter
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');

    // Form should submit successfully
  });
});
```

### 11.2 Dialog Accessibility Tests

```typescript
describe('Dialog accessibility', () => {
  it('MUST trap focus inside dialog', async () => {
    const { getByRole, getByLabelText } = render(
      <Dialog isOpen={true} onClose={jest.fn()} title="Test Dialog">
        <input aria-label="First input" />
        <button>Action</button>
      </Dialog>
    );

    // Focus should start inside dialog
    const firstInput = getByLabelText('First input');
    expect(firstInput).toHaveFocus();

    // Tab should cycle within dialog
    await userEvent.tab(); // to Action button
    await userEvent.tab(); // to Close button
    await userEvent.tab(); // back to First input (trapped)
    expect(firstInput).toHaveFocus();
  });

  it('MUST close on Escape and return focus', async () => {
    const onClose = jest.fn();
    const triggerRef = { current: document.createElement('button') };

    render(
      <Dialog isOpen={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Dialog>
    );

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('MUST have proper ARIA attributes', () => {
    const { getByRole } = render(
      <Dialog isOpen={true} onClose={jest.fn()} title="Confirm Delete" description="This action cannot be undone.">
        <button>Delete</button>
      </Dialog>
    );

    const dialog = getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');

    // Title text should match
    const titleId = dialog.getAttribute('aria-labelledby');
    expect(document.getElementById(titleId!)).toHaveTextContent('Confirm Delete');
  });
});
```

### 11.3 eslint-plugin-jsx-a11y Configuration

```json
{
  "extends": ["plugin:jsx-a11y/strict"],
  "plugins": ["jsx-a11y"],
  "rules": {
    "jsx-a11y/alt-text": "error",
    "jsx-a11y/anchor-has-content": "error",
    "jsx-a11y/anchor-is-valid": "error",
    "jsx-a11y/aria-activedescendant-has-tabindex": "error",
    "jsx-a11y/aria-props": "error",
    "jsx-a11y/aria-proptypes": "error",
    "jsx-a11y/aria-role": "error",
    "jsx-a11y/aria-unsupported-elements": "error",
    "jsx-a11y/click-events-have-key-events": "error",
    "jsx-a11y/heading-has-content": "error",
    "jsx-a11y/html-has-lang": "error",
    "jsx-a11y/img-redundant-alt": "error",
    "jsx-a11y/interactive-supports-focus": "error",
    "jsx-a11y/label-has-associated-control": ["error", {
      "required": { "some": ["nesting", "id"] }
    }],
    "jsx-a11y/media-has-caption": "error",
    "jsx-a11y/mouse-events-have-key-events": "error",
    "jsx-a11y/no-access-key": "error",
    "jsx-a11y/no-autofocus": ["error", { "ignoreNonDOM": true }],
    "jsx-a11y/no-distracting-elements": "error",
    "jsx-a11y/no-interactive-element-to-noninteractive-role": "error",
    "jsx-a11y/no-noninteractive-element-interactions": "error",
    "jsx-a11y/no-noninteractive-element-to-interactive-role": "error",
    "jsx-a11y/no-noninteractive-tabindex": "error",
    "jsx-a11y/no-redundant-roles": "error",
    "jsx-a11y/no-static-element-interactions": "error",
    "jsx-a11y/role-has-required-aria-props": "error",
    "jsx-a11y/role-supports-aria-props": "error",
    "jsx-a11y/scope": "error",
    "jsx-a11y/tabindex-no-positive": "error"
  }
}
```

### 11.4 Lighthouse Accessibility Audit

```
LIGHTHOUSE ACCESSIBILITY CHECKS (automated in CI):

  Category                    What It Tests
  ─────────────────────────── ──────────────────────────────────
  Aria                        ARIA attributes used correctly
  Color Contrast              Text meets 4.5:1 ratio
  Document                    html lang, title, meta viewport
  Forms                       Labels, autocomplete, fieldsets
  Keyboard                    Tabindex, focus order, focus visible
  Language                    Valid lang attributes
  Names                       Buttons/links have accessible names
  Navigation                  Skip links, heading order
  Tables                      Proper th/td, caption, scope
  Timing                      No auto-refresh, adjustable timing

  INTEGRATION IN CI (GitHub Actions):

  - name: Run Lighthouse
    uses: treosh/lighthouse-ci-action@v11
    with:
      urls: |
        http://localhost:3000/
        http://localhost:3000/login
        http://localhost:3000/dashboard
      budgetPath: ./lighthouse-budget.json
      configPath: ./lighthouserc.json

  # lighthouserc.json
  {
    "ci": {
      "assert": {
        "assertions": {
          "categories:accessibility": ["error", { "minScore": 0.95 }]
        }
      }
    }
  }
```

### 11.5 Testing Tools Reference

| Tool | Level | What It Catches | Integration |
|------|-------|----------------|-------------|
| **eslint-plugin-jsx-a11y** | Static analysis | Missing alt, label, ARIA misuse | ESLint (pre-commit) |
| **axe-core / jest-axe** | Unit test | 50+ WCAG violations | Jest / Vitest |
| **@axe-core/react** | Dev overlay | Runtime ARIA issues | Console warnings |
| **Lighthouse** | Audit | 35+ automated checks | CI pipeline |
| **Pa11y** | Audit | WCAG 2.1 violations, HTML CodeSniffer | CI pipeline |
| **Playwright/Cypress axe** | E2E | Full-page violations | E2E test suite |
| **WAVE** | Browser extension | Visual a11y analysis | Manual review |
| **VoiceOver/NVDA/JAWS** | Screen reader | Real AT experience | Manual testing |
| **Stark (Figma)** | Design | Contrast, typography, touch targets | Design phase |

```typescript
// ─── Playwright axe integration ─────────────────────────────
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('accessibility', () => {
  test('homepage has no a11y violations', async ({ page }) => {
    await page.goto('/');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('login page has no a11y violations', async ({ page }) => {
    await page.goto('/login');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .exclude('.third-party-widget')  // Exclude third-party code you cannot fix
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('dashboard with data has no a11y violations', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Navigate to dashboard
    await page.waitForURL('/dashboard');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
```

---

## 12. The Screen-Reader-Only (sr-only) Utility

```css
/* ALWAYS include this utility class in your CSS */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* When element receives focus, make it visible (skip links) */
.sr-only-focusable:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

```typescript
// ─── Skip Navigation Link — REQUIRED on every page ─────────

function SkipNav() {
  return (
    <a
      href="#main-content"
      className="sr-only sr-only-focusable fixed top-0 left-0 z-[100] bg-background p-4 text-foreground"
    >
      Skip to main content
    </a>
  );
}

// In your App layout:
// <SkipNav />
// <Header />
// <main id="main-content">...</main>
```

---

## 13. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **`<div onClick>`** | Div used as button — no keyboard access, no role | Use `<button>`. If impossible: add `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space |
| **Missing alt text** | `<img src="..." />` without alt | ALWAYS add `alt`. For decorative images: `alt=""` + `role="presentation"` |
| **Color-only indicators** | Error shown only in red, status only as colored dot | Add icon + text alongside color. NEVER use color as sole indicator |
| **tabIndex > 0** | `tabIndex={5}` to "fix" focus order | NEVER use positive tabIndex. Fix DOM order instead. Only `0` and `-1` are valid |
| **aria-label on non-interactive** | `<p aria-label="Description">` | aria-label is for interactive elements. Use visible text or aria-labelledby for static content |
| **Autoplaying media** | Video/audio starts without user action | NEVER autoplay with sound. If autoplay needed: muted + controls visible |
| **Missing focus styles** | `outline: none` without replacement | NEVER remove outline without adding equivalent focus indicator |
| **Inaccessible custom select** | Custom dropdown with no ARIA, no keyboard nav | Use native `<select>` or implement full ARIA combobox/listbox pattern |
| **Modal without focus trap** | Tab key moves focus behind the modal | ALWAYS implement focus trap. See useFocusTrap in Section 4.2 |
| **ARIA overuse** | `<button role="button" aria-pressed="false">` | Do NOT add ARIA that duplicates native semantics. Native `<button>` already has button role |
| **Live region rendered conditionally** | `{error && <div aria-live="assertive">{error}</div>}` | Live region MUST be in DOM BEFORE content changes. Render region always, change inner text |
| **Missing heading hierarchy** | Page jumps from h1 to h4, skipping h2 and h3 | Headings MUST be sequential: h1 → h2 → h3. NEVER skip levels |
| **Touch target too small** | 16x16 icon button | WCAG 2.2: minimum 24x24 CSS pixels. Target 44x44 for mobile |
| **Missing form error links** | Error summary without links to fields | Error summary MUST link to each invalid field. See Section 7 |
| **Placeholder as label** | `<input placeholder="Email" />` (no label) | Placeholder is NOT a label. ALWAYS provide `<label>` or `aria-label` |

---

## 14. Enforcement Checklist

```
PRE-COMMIT / CODE REVIEW CHECKLIST:

PERCEIVABLE:
[ ] All images have alt text (decorative: alt="")
[ ] All videos have captions/transcripts
[ ] Color contrast meets 4.5:1 for text, 3:1 for UI components
[ ] No information conveyed by color alone
[ ] Content readable at 200% zoom without horizontal scroll
[ ] Focus indicator visible on all interactive elements (3:1 contrast)

OPERABLE:
[ ] All functionality accessible via keyboard
[ ] Tab order follows logical reading order
[ ] No keyboard traps (except intentional focus traps in modals)
[ ] Skip navigation link present on every page
[ ] Focus moves to modals on open, returns to trigger on close
[ ] Escape closes modals, dropdowns, and overlays
[ ] Interactive targets >= 24x24 CSS pixels (WCAG 2.2)
[ ] All drag operations have single-pointer alternatives (WCAG 2.2)

UNDERSTANDABLE:
[ ] <html lang="en"> (or appropriate language) is set
[ ] Every form control has a visible label
[ ] Required fields marked with both visual (*) and aria-required
[ ] Error messages linked to inputs via aria-describedby
[ ] Error summary with links to invalid fields
[ ] Consistent navigation across pages

ROBUST:
[ ] Valid semantic HTML used (no div buttons, no div links)
[ ] ARIA roles used only when no native HTML equivalent
[ ] All ARIA attributes are valid and correctly used
[ ] aria-live regions present for dynamic content updates
[ ] No duplicate IDs in the document
[ ] Compound components implement full ARIA patterns

TESTING:
[ ] eslint-plugin-jsx-a11y enabled with "strict" config
[ ] jest-axe tests for every component
[ ] Lighthouse accessibility score >= 95 in CI
[ ] axe-core Playwright/Cypress tests for critical flows
[ ] Manual screen reader testing (VoiceOver/NVDA) for complex widgets
[ ] Keyboard-only navigation tested for all interactive flows
```
