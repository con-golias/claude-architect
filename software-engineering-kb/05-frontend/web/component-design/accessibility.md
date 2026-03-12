# Component Accessibility — Complete Specification

> **AI Plugin Directive:** When building ANY user-facing component, implementing keyboard navigation, adding ARIA attributes, or auditing accessibility compliance, ALWAYS consult this guide. Apply these accessibility rules to ensure components are usable by ALL users including those using screen readers, keyboard navigation, switch devices, and other assistive technologies. This guide covers WCAG 2.2, ARIA patterns, keyboard interaction, focus management, color contrast, and automated testing.

**Core Rule: EVERY interactive component MUST be fully keyboard accessible, have proper ARIA semantics, maintain visible focus indicators, and meet WCAG 2.2 Level AA contrast ratios. Accessibility is NOT optional — it is a legal requirement in most jurisdictions (ADA, EAA, Section 508). NEVER remove focus outlines without providing an alternative. NEVER use `div` or `span` for interactive elements — use semantic HTML elements (`button`, `a`, `input`, `select`).**

---

## 1. WCAG 2.2 Principles (POUR)

```
                    WCAG 2.2 PRINCIPLES

  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │  P — PERCEIVABLE                                       │
  │  ├── Text alternatives for non-text content             │
  │  ├── Captions and audio descriptions                   │
  │  ├── Content adaptable to different presentations      │
  │  └── Sufficient color contrast                         │
  │                                                         │
  │  O — OPERABLE                                          │
  │  ├── All functionality available from keyboard          │
  │  ├── Enough time to read and use content               │
  │  ├── No content that causes seizures                   │
  │  ├── Navigable — help users find content               │
  │  └── Input modalities beyond keyboard                  │
  │                                                         │
  │  U — UNDERSTANDABLE                                    │
  │  ├── Readable text content                             │
  │  ├── Predictable — pages operate predictably           │
  │  └── Input assistance — help users avoid errors        │
  │                                                         │
  │  R — ROBUST                                            │
  │  ├── Compatible with current and future tools          │
  │  └── Proper semantic markup for assistive technology   │
  │                                                         │
  │  CONFORMANCE LEVELS:                                   │
  │  A   = Minimum (must meet)                             │
  │  AA  = Standard (legal requirement in most cases)      │
  │  AAA = Enhanced (aspire to where possible)             │
  └─────────────────────────────────────────────────────────┘
```

---

## 2. Semantic HTML — The Foundation

### 2.1 Element Selection Rules

```
  ALWAYS use semantic HTML elements FIRST.
  ARIA is a REPAIR mechanism for when HTML semantics are insufficient.

  ┌───────────────────────┬──────────────────────────────────┐
  │ Need                  │ Use                              │
  ├───────────────────────┼──────────────────────────────────┤
  │ Clickable action      │ <button>                         │
  │ Navigation link       │ <a href="...">                   │
  │ Text input            │ <input type="text">              │
  │ Selection             │ <select> or <input type="radio"> │
  │ Toggle                │ <input type="checkbox">          │
  │ Form                  │ <form>                           │
  │ Navigation region     │ <nav>                            │
  │ Main content          │ <main>                           │
  │ Section heading       │ <h1>–<h6>                        │
  │ Figure with caption   │ <figure> + <figcaption>          │
  │ Data presentation     │ <table> with <th> and scope      │
  │ List of items         │ <ul>/<ol> + <li>                 │
  │ Description list      │ <dl> + <dt>/<dd>                 │
  │ Time/date             │ <time datetime="...">            │
  │ Abbreviation          │ <abbr title="...">               │
  │ Quotation             │ <blockquote> or <q>              │
  └───────────────────────┴──────────────────────────────────┘
```

### 2.2 Common Mistakes

```typescript
// ❌ BAD: div as button
<div onClick={handleClick} className="btn">Click me</div>
// Problems: No keyboard support, no focus, no role, no announcement

// ✅ GOOD: semantic button
<button onClick={handleClick} className="btn">Click me</button>
// Gets: focus, Enter/Space activation, role="button", announcement

// ❌ BAD: span as link
<span onClick={() => navigate('/page')} className="link">Go to page</span>

// ✅ GOOD: semantic link
<a href="/page" className="link">Go to page</a>

// ❌ BAD: div for navigation
<div className="nav">
  <div onClick={...}>Home</div>
  <div onClick={...}>About</div>
</div>

// ✅ GOOD: semantic navigation
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>
```

---

## 3. ARIA Attributes Reference

### 3.1 Roles

```
  ARIA ROLES BY CATEGORY:

  LANDMARK ROLES (page structure):
  ├── banner        → <header> (page-level)
  ├── navigation    → <nav>
  ├── main          → <main>
  ├── complementary → <aside>
  ├── contentinfo   → <footer> (page-level)
  ├── search        → <search> or <form role="search">
  ├── form          → <form> (when labeled)
  └── region        → <section> (when labeled)

  WIDGET ROLES (interactive):
  ├── button        → <button>
  ├── link          → <a href>
  ├── checkbox      → <input type="checkbox">
  ├── radio         → <input type="radio">
  ├── textbox       → <input type="text"> / <textarea>
  ├── combobox      → Auto-complete input
  ├── listbox       → <select>
  ├── option        → <option>
  ├── slider        → <input type="range">
  ├── spinbutton    → <input type="number">
  ├── switch        → Toggle switch
  ├── tab           → Tab button
  ├── tabpanel      → Tab content panel
  ├── menu          → Dropdown/context menu
  ├── menuitem      → Menu item
  ├── dialog        → Modal dialog
  ├── alertdialog   → Alert requiring action
  ├── tree          → Tree view
  ├── treeitem      → Tree node
  ├── grid          → Data grid
  ├── gridcell      → Grid cell
  └── tooltip       → Tooltip popup

  DOCUMENT STRUCTURE ROLES:
  ├── article       → <article>
  ├── heading       → <h1>-<h6>
  ├── list          → <ul>/<ol>
  ├── listitem      → <li>
  ├── table         → <table>
  ├── row           → <tr>
  ├── cell          → <td>
  ├── columnheader  → <th scope="col">
  ├── rowheader     → <th scope="row">
  ├── img           → <img>
  ├── figure        → <figure>
  └── separator     → <hr>
```

### 3.2 States and Properties

| Attribute | Purpose | Values | Use With |
|-----------|---------|--------|----------|
| `aria-label` | Accessible name (invisible) | string | Any element needing a label |
| `aria-labelledby` | Accessible name from another element | ID reference | Complex labeled elements |
| `aria-describedby` | Additional description | ID reference | Form fields with hints/errors |
| `aria-expanded` | Expandable state | true/false | Accordion, dropdown triggers |
| `aria-selected` | Selection state | true/false | Tabs, listbox options |
| `aria-checked` | Check state | true/false/mixed | Checkboxes, switches |
| `aria-pressed` | Toggle button state | true/false | Toggle buttons |
| `aria-disabled` | Disabled state | true/false | Disabled controls |
| `aria-hidden` | Hidden from AT | true/false | Decorative elements |
| `aria-live` | Live region updates | polite/assertive/off | Dynamic content updates |
| `aria-atomic` | Announce whole region | true/false | With aria-live |
| `aria-current` | Current item in set | page/step/location/date/true | Navigation, breadcrumbs |
| `aria-invalid` | Invalid input state | true/false/grammar/spelling | Form validation |
| `aria-required` | Required field | true/false | Form fields |
| `aria-controls` | Element this controls | ID reference | Triggers for panels |
| `aria-owns` | Parent-child relationship | ID reference | When DOM order differs |
| `aria-haspopup` | Has popup | true/menu/listbox/tree/grid/dialog | Menu triggers |
| `aria-modal` | Modal dialog | true/false | Dialog/modal |
| `aria-busy` | Loading state | true/false | Loading regions |
| `aria-errormessage` | Error message element | ID reference | Invalid form fields |
| `aria-roledescription` | Custom role text | string | Custom widgets (sparingly) |

---

## 4. Keyboard Navigation Patterns

### 4.1 Standard Keyboard Interactions

```
  KEYBOARD INTERACTION PATTERNS (WAI-ARIA Authoring Practices):

  ┌──────────────────┬──────────────────────────────────────┐
  │ Component        │ Keyboard Behavior                    │
  ├──────────────────┼──────────────────────────────────────┤
  │ Button           │ Enter/Space: activate                │
  │                  │ Tab: move focus to/from              │
  │                  │                                      │
  │ Link             │ Enter: follow link                   │
  │                  │ Tab: move focus to/from              │
  │                  │                                      │
  │ Tab List         │ Arrow Left/Right: switch tabs        │
  │                  │ Home/End: first/last tab             │
  │                  │ Tab: move focus out of tab list      │
  │                  │                                      │
  │ Menu             │ Arrow Down/Up: navigate items        │
  │                  │ Enter/Space: activate item           │
  │                  │ Escape: close menu                   │
  │                  │ Home/End: first/last item            │
  │                  │ Type-ahead: jump to matching item    │
  │                  │                                      │
  │ Dialog/Modal     │ Tab: cycle through focusable items   │
  │                  │ Escape: close dialog                 │
  │                  │ Focus trapped within dialog          │
  │                  │                                      │
  │ Listbox/Select   │ Arrow Down/Up: navigate options      │
  │                  │ Enter/Space: select option           │
  │                  │ Type-ahead: jump to matching option  │
  │                  │                                      │
  │ Tree View        │ Arrow Down/Up: navigate items        │
  │                  │ Arrow Right: expand / enter child    │
  │                  │ Arrow Left: collapse / go to parent  │
  │                  │                                      │
  │ Slider           │ Arrow Right/Up: increase value       │
  │                  │ Arrow Left/Down: decrease value      │
  │                  │ Home/End: min/max value              │
  │                  │ Page Up/Down: large step             │
  │                  │                                      │
  │ Accordion        │ Enter/Space: toggle panel            │
  │                  │ Arrow Down/Up: next/prev trigger     │
  │                  │ Home/End: first/last trigger         │
  └──────────────────┴──────────────────────────────────────┘
```

### 4.2 Roving TabIndex Pattern

```typescript
// Tab list — only ONE tab is in the tab order at a time
// Arrow keys move focus between tabs
// ONLY the active tab has tabIndex={0}, all others have tabIndex={-1}

function TabList({ tabs, activeIndex, onSelect }: TabListProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    let nextIndex: number;

    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    onSelect(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div role="tablist">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={el => { tabRefs.current[index] = el; }}
          role="tab"
          aria-selected={index === activeIndex}
          tabIndex={index === activeIndex ? 0 : -1}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onClick={() => onSelect(index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

### 4.3 Focus Trap for Modals

```typescript
// Focus trap — MUST trap Tab key within modal while open
// MUST return focus to trigger element on close

function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Save previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus first focusable element in container
    const focusable = getFocusableElements(containerRef.current);
    if (focusable.length > 0) {
      (focusable[0] as HTMLElement).focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements(containerRef.current!);
      if (focusable.length === 0) return;

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Return focus to trigger element
      previousFocusRef.current?.focus();
    };
  }, [isActive]);

  return containerRef;
}

function getFocusableElements(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), ' +
    'input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
    '[tabindex]:not([tabindex="-1"]), [contenteditable]'
  );
}

// Usage
function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const containerRef = useFocusTrap(isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Dialog */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative z-50 bg-white rounded-lg p-6 max-w-md w-full"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <h2 id="modal-title">{title}</h2>
        {children}
        <button onClick={onClose} aria-label="Close dialog">
          <XIcon />
        </button>
      </div>
    </div>
  );
}
```

---

## 5. Focus Management

### 5.1 Focus Indicator Rules

```css
/* NEVER remove focus outlines without providing an alternative */

/* ❌ BAD: Removes focus indicator entirely */
*:focus {
  outline: none;
}

/* ✅ GOOD: Custom focus indicator */
*:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

/* ✅ GOOD: Only suppress for mouse users, keep for keyboard */
/* :focus-visible fires ONLY for keyboard navigation */
button:focus:not(:focus-visible) {
  outline: none;
}

button:focus-visible {
  outline: 2px solid #4285f4;
  outline-offset: 2px;
  border-radius: 4px;
}

/* ─── Focus indicator requirements (WCAG 2.2) ─── */
/*
 * Minimum contrast: 3:1 against adjacent colors
 * Minimum area: 2px solid outline (or equivalent)
 * Must enclose the component (not just one side)
 * Must be visible in both light and dark modes
 */

/* Adaptive focus ring */
:focus-visible {
  outline: 2px solid var(--focus-ring-color);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(66, 133, 244, 0.3);
}

/* Dark mode adaptation */
@media (prefers-color-scheme: dark) {
  :root {
    --focus-ring-color: #8ab4f8;
  }
}
```

### 5.2 Skip Navigation Link

```html
<!-- MUST be the first focusable element on the page -->
<body>
  <a href="#main-content" class="skip-link">
    Skip to main content
  </a>

  <header><!-- Navigation --></header>

  <main id="main-content" tabindex="-1">
    <!-- Main content -->
  </main>
</body>

<style>
  .skip-link {
    position: absolute;
    top: -100%;
    left: 0;
    z-index: 100;
    padding: 1rem;
    background: var(--bg);
    color: var(--text);
    font-weight: bold;
    text-decoration: underline;
  }

  .skip-link:focus {
    top: 0;
  }
</style>
```

---

## 6. Color and Contrast

### 6.1 Contrast Ratio Requirements

```
  WCAG 2.2 CONTRAST RATIOS:

  ┌──────────────────────────────────────────────────────────┐
  │ Level AA (Required):                                     │
  │ ├── Normal text (<18pt or <14pt bold): 4.5:1 minimum     │
  │ ├── Large text (≥18pt or ≥14pt bold):  3:1 minimum       │
  │ ├── UI components and graphics:         3:1 minimum       │
  │ └── Focus indicators:                   3:1 minimum       │
  │                                                          │
  │ Level AAA (Enhanced):                                    │
  │ ├── Normal text: 7:1 minimum                             │
  │ └── Large text:  4.5:1 minimum                           │
  │                                                          │
  │ EXCEPTIONS:                                              │
  │ ├── Logos and brand text                                 │
  │ ├── Incidental text (not important)                      │
  │ └── Disabled controls (but make it clear they're disabled)│
  └──────────────────────────────────────────────────────────┘
```

### 6.2 Color Independence

```typescript
// NEVER rely on color alone to convey information

// ❌ BAD: Status only indicated by color
<span className={status === 'error' ? 'text-red-500' : 'text-green-500'}>
  {status}
</span>

// ✅ GOOD: Color + icon + text
<span className={cn('flex items-center gap-1', statusColors[status])}>
  {status === 'error' ? <XCircle aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
  <span>{status === 'error' ? 'Error: Failed to save' : 'Saved successfully'}</span>
</span>

// ❌ BAD: Form error only by red border
<input className={error ? 'border-red-500' : 'border-gray-300'} />

// ✅ GOOD: Red border + error icon + error text
<div>
  <input
    className={error ? 'border-red-500' : 'border-gray-300'}
    aria-invalid={!!error}
    aria-describedby={error ? 'email-error' : undefined}
  />
  {error && (
    <p id="email-error" className="text-red-500 flex items-center gap-1 mt-1" role="alert">
      <AlertIcon aria-hidden="true" className="h-4 w-4" />
      {error}
    </p>
  )}
</div>
```

---

## 7. Forms Accessibility

### 7.1 Accessible Form Pattern

```typescript
// Complete accessible form component

function AccessibleForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
      onSubmit={handleSubmit}
      noValidate  // Use custom validation, not browser default
      aria-label="Registration form"
    >
      {/* Group related fields */}
      <fieldset>
        <legend>Personal Information</legend>

        {/* Text field with label, hint, and error */}
        <div>
          <label htmlFor="email">
            Email address
            <span aria-hidden="true" className="text-red-500"> *</span>
          </label>
          <input
            id="email"
            type="email"
            required
            aria-required="true"
            aria-invalid={!!errors.email}
            aria-describedby={cn(
              'email-hint',
              errors.email && 'email-error'
            )}
            autoComplete="email"
          />
          <p id="email-hint" className="text-sm text-gray-500">
            We'll never share your email with anyone.
          </p>
          {errors.email && (
            <p id="email-error" className="text-sm text-red-500" role="alert">
              {errors.email}
            </p>
          )}
        </div>

        {/* Password with requirements */}
        <div>
          <label htmlFor="password">Password <span aria-hidden="true">*</span></label>
          <input
            id="password"
            type="password"
            required
            aria-required="true"
            aria-invalid={!!errors.password}
            aria-describedby="password-requirements"
            autoComplete="new-password"
            minLength={8}
          />
          <div id="password-requirements" className="text-sm text-gray-500">
            <p>Password must contain:</p>
            <ul>
              <li aria-label={hasUppercase ? 'Met: uppercase letter' : 'Not met: uppercase letter'}>
                {hasUppercase ? '✓' : '○'} At least one uppercase letter
              </li>
              <li aria-label={hasNumber ? 'Met: number' : 'Not met: number'}>
                {hasNumber ? '✓' : '○'} At least one number
              </li>
              <li aria-label={hasMinLength ? 'Met: 8 characters' : 'Not met: 8 characters'}>
                {hasMinLength ? '✓' : '○'} At least 8 characters
              </li>
            </ul>
          </div>
        </div>
      </fieldset>

      {/* Radio group */}
      <fieldset>
        <legend>Notification Preferences</legend>
        <div role="radiogroup" aria-labelledby="notif-legend">
          <label>
            <input type="radio" name="notifications" value="all" />
            All notifications
          </label>
          <label>
            <input type="radio" name="notifications" value="important" />
            Important only
          </label>
          <label>
            <input type="radio" name="notifications" value="none" />
            None
          </label>
        </div>
      </fieldset>

      {/* Error summary — shown after failed submission */}
      {Object.keys(errors).length > 0 && (
        <div role="alert" aria-label="Form errors" className="bg-red-50 border border-red-200 p-4 rounded">
          <h3 className="font-bold text-red-800">Please fix the following errors:</h3>
          <ul>
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>
                <a href={`#${field}`} className="text-red-600 underline">
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="submit">
        Create Account
      </button>
    </form>
  );
}
```

### 7.2 Form Accessibility Rules

```
  FORM ACCESSIBILITY RULES:
  ┌──────────────────────────────────────────────────────────┐
  │ ✅ EVERY input MUST have a visible <label>               │
  │ ✅ Labels MUST use htmlFor matching input id              │
  │ ✅ Required fields marked with aria-required="true"      │
  │ ✅ Error messages linked with aria-describedby           │
  │ ✅ Error messages announced with role="alert"            │
  │ ✅ Error summary with links to invalid fields            │
  │ ✅ Focus moved to first invalid field on submit          │
  │ ✅ Group related fields with <fieldset> + <legend>       │
  │ ✅ Use autocomplete attributes for known field types     │
  │ ✅ Password requirements described with aria-describedby │
  │                                                          │
  │ ❌ NEVER use placeholder as the only label               │
  │ ❌ NEVER use title attribute as the only label           │
  │ ❌ NEVER rely solely on color to indicate errors         │
  │ ❌ NEVER disable submit until all fields valid (confusing)│
  └──────────────────────────────────────────────────────────┘
```

---

## 8. Live Regions

```typescript
// Live regions announce dynamic content updates to screen readers

// ─── Polite: Waits for user to finish current task ───
<div aria-live="polite" aria-atomic="true">
  {searchResults.length} results found
</div>

// ─── Assertive: Interrupts immediately (use sparingly) ───
<div role="alert">
  {/* role="alert" implies aria-live="assertive" */}
  Error: Payment failed. Please try again.
</div>

// ─── Status: Polite status updates ───
<div role="status">
  {/* role="status" implies aria-live="polite" */}
  Loading... 45% complete
</div>

// ─── Toast/Snackbar Implementation ───
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 space-y-2"
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={cn('rounded-lg p-4 shadow-lg', toastStyles[toast.type])}
        >
          <p className="font-medium">{toast.title}</p>
          {toast.description && <p className="text-sm">{toast.description}</p>}
          <button
            onClick={() => dismissToast(toast.id)}
            aria-label={`Dismiss: ${toast.title}`}
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 9. Images and Media

```html
<!-- ─── Informative images: descriptive alt ─── -->
<img src="chart.png" alt="Sales increased 40% from Q1 to Q2 2025" />

<!-- ─── Decorative images: empty alt ─── -->
<img src="decorative-border.png" alt="" role="presentation" />

<!-- ─── Complex images: longer description ─── -->
<figure>
  <img
    src="org-chart.png"
    alt="Organization chart showing CEO at top with three VP reports"
    aria-describedby="org-chart-desc"
  />
  <figcaption id="org-chart-desc">
    Full organization chart: CEO Jane Smith oversees VP Engineering (Bob),
    VP Marketing (Alice), and VP Sales (Charlie). Each VP manages 3-5 team leads.
  </figcaption>
</figure>

<!-- ─── Icon buttons: aria-label required ─── -->
<button aria-label="Close dialog">
  <XIcon aria-hidden="true" />
</button>

<!-- ─── SVG accessibility ─── -->
<svg role="img" aria-labelledby="chart-title chart-desc">
  <title id="chart-title">Monthly Revenue Chart</title>
  <desc id="chart-desc">Bar chart showing revenue growth from $10K to $50K over 6 months</desc>
  <!-- chart content -->
</svg>

<!-- ─── Video with captions ─── -->
<video controls>
  <source src="demo.mp4" type="video/mp4" />
  <track kind="captions" src="demo-captions.vtt" srclang="en" label="English" default />
  <track kind="descriptions" src="demo-descriptions.vtt" srclang="en" label="Audio descriptions" />
</video>
```

---

## 10. Motion and Reduced Motion

```css
/* ALWAYS respect prefers-reduced-motion */

/* Default: animations enabled */
.animated-element {
  transition: transform 0.3s ease, opacity 0.3s ease;
  animation: slide-in 0.5s ease;
}

/* Reduced motion: disable or replace with instant transitions */
@media (prefers-reduced-motion: reduce) {
  .animated-element {
    transition: none;
    animation: none;
  }

  /* OR provide a subtle alternative */
  .animated-element {
    transition: opacity 0.1s ease; /* Keep opacity, remove transform */
    animation: fade-in 0.1s ease;  /* Simple fade instead of slide */
  }
}
```

```typescript
// React hook for reduced motion preference
function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}

// Usage
function AnimatedComponent() {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReduced ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.3 }}
    >
      Content
    </motion.div>
  );
}
```

---

## 11. Component-Specific Accessibility Patterns

### 11.1 Accessible Data Table

```typescript
function DataTable({ columns, data, caption }: DataTableProps) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto">
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.id}
                scope="col"
                aria-sort={col.sorted ? col.sortDirection : undefined}
              >
                {col.sortable ? (
                  <button
                    onClick={() => onSort(col.id)}
                    aria-label={`Sort by ${col.label}, currently ${col.sortDirection || 'unsorted'}`}
                  >
                    {col.label}
                    <SortIcon direction={col.sortDirection} aria-hidden="true" />
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.id}>
              {columns.map((col, colIndex) => (
                <td
                  key={col.id}
                  headers={columns[colIndex].id}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 11.2 Accessible Tooltip

```typescript
function Tooltip({ content, children }: { content: string; children: ReactElement }) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {cloneElement(children, {
        'aria-describedby': isVisible ? tooltipId : undefined,
      })}
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute z-50 px-2 py-1 text-xs bg-gray-900 text-white rounded"
        >
          {content}
        </div>
      )}
    </div>
  );
}
```

---

## 12. Testing Accessibility

### 12.1 Automated Testing

```typescript
// Jest + Testing Library + jest-axe
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Button accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(
      <Button onClick={() => {}}>Click me</Button>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('is focusable and activatable via keyboard', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    const button = screen.getByRole('button');
    button.focus();
    expect(button).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();

    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('communicates disabled state to screen readers', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('communicates loading state', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });
});

// ─── Playwright Accessibility Audit ───
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('homepage has no accessibility violations', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('form is accessible', async ({ page }) => {
  await page.goto('/register');

  // Tab through all form fields
  await page.keyboard.press('Tab');
  const firstInput = await page.evaluate(() => document.activeElement?.tagName);
  expect(firstInput).toBe('INPUT');

  // Check that labels are associated
  const labels = await page.$$eval('label[for]', els =>
    els.every(el => document.getElementById(el.htmlFor))
  );
  expect(labels).toBe(true);
});
```

### 12.2 Manual Testing Checklist

```
  MANUAL ACCESSIBILITY TESTING CHECKLIST:

  KEYBOARD:
  ├── [ ] Tab through entire page — logical focus order?
  ├── [ ] All interactive elements reachable via Tab?
  ├── [ ] Focus indicator visible on EVERY focused element?
  ├── [ ] Escape closes modals/popups and returns focus?
  ├── [ ] Arrow keys work in menus, tabs, radio groups?
  ├── [ ] Enter/Space activates buttons and links?
  └── [ ] No keyboard traps (can always Tab out)?

  SCREEN READER (test with NVDA/JAWS/VoiceOver):
  ├── [ ] All images have meaningful alt text?
  ├── [ ] Headings create logical document outline?
  ├── [ ] Form fields announced with label + type + state?
  ├── [ ] Error messages announced when they appear?
  ├── [ ] Dynamic content updates announced (live regions)?
  ├── [ ] Decorative images hidden from screen readers?
  └── [ ] ARIA roles and states correct?

  VISUAL:
  ├── [ ] Text meets 4.5:1 contrast ratio (AA)?
  ├── [ ] Large text meets 3:1 contrast ratio?
  ├── [ ] UI components meet 3:1 contrast ratio?
  ├── [ ] Content readable at 200% zoom?
  ├── [ ] Content readable at 400% zoom (reflow)?
  ├── [ ] No information conveyed by color alone?
  └── [ ] Focus indicators visible in both light/dark mode?

  MOTION:
  ├── [ ] Animations respect prefers-reduced-motion?
  ├── [ ] No auto-playing video/animation without controls?
  └── [ ] No flashing content (>3 flashes per second)?
```

---

## 13. Screen Reader Utility Classes

```css
/* Visually hidden but accessible to screen readers */
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

/* Becomes visible on focus (for skip links) */
.sr-only-focusable:focus,
.sr-only-focusable:active {
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
// React component for screen reader announcements
function ScreenReaderOnly({ children, as: Component = 'span' }: {
  children: ReactNode;
  as?: ElementType;
}) {
  return <Component className="sr-only">{children}</Component>;
}

// Usage
<button>
  <TrashIcon aria-hidden="true" />
  <ScreenReaderOnly>Delete item</ScreenReaderOnly>
</button>
```

---

## 14. Accessibility in Framework Components

### 14.1 React Accessibility Features

```typescript
// React provides built-in accessibility support

// Fragment avoids unnecessary wrapper divs
<>{items.map(item => <Item key={item.id} />)}</>

// htmlFor ← React alias for "for" attribute
<label htmlFor="email">Email</label>

// tabIndex ← React camelCase
<div tabIndex={0}>Focusable div</div>

// aria-* attributes pass through unchanged
<input aria-label="Search" aria-describedby="search-hint" />

// Event handlers include keyboard events
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Custom button (prefer <button> instead)
</div>
```

### 14.2 Vue Accessibility

```vue
<template>
  <!-- Vue passes aria-* and role attributes natively -->
  <button
    :aria-expanded="isOpen"
    :aria-controls="panelId"
    @click="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <slot />
  </button>
</template>
```

---

## 15. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| `<div onClick>` as button | No keyboard access, no role, no focus | Use `<button>` element |
| `outline: none` without alternative | Keyboard users can't see focus | Use `:focus-visible` with custom ring |
| Placeholder as only label | Label disappears on input, not accessible | Add visible `<label>` element |
| Color-only error indication | Color-blind users miss errors | Add icon + text + aria-invalid |
| Auto-playing media without controls | Can't be paused, disruptive | Add controls, respect prefers-reduced-motion |
| Missing alt text on informative images | Screen reader says "image" or filename | Add descriptive alt text |
| Empty alt on informative images | Screen reader skips important image | Write meaningful alt describing the content |
| `tabIndex > 0` | Breaks natural tab order | Use `tabIndex={0}` or `tabIndex={-1}` only |
| Missing aria-label on icon-only buttons | Screen reader says nothing or "button" | Add `aria-label="Close"` or visible text |
| No live region for dynamic content | Screen reader misses updates | Add `aria-live="polite"` or `role="status"` |
| Focus not trapped in modal | Tab moves behind modal, confusing | Implement focus trap with Tab key handling |
| Focus not returned after modal close | Focus lost, user disoriented | Return focus to trigger element |
| Missing heading hierarchy | Screen reader users can't navigate by headings | Use h1→h2→h3 in order, never skip levels |
| ARIA role on semantic element | Redundant, may cause issues | Remove role from `<button role="button">` |

---

## 16. Enforcement Checklist

- [ ] ALL interactive elements are keyboard accessible (focusable + activatable)
- [ ] Focus indicators are visible on EVERY focusable element (`:focus-visible`)
- [ ] Skip navigation link is the first focusable element on the page
- [ ] Semantic HTML is used before ARIA (button, a, input, nav, main, etc.)
- [ ] ALL images have appropriate `alt` text (descriptive or empty for decorative)
- [ ] ALL form inputs have visible `<label>` elements with `htmlFor`
- [ ] Form errors use `aria-invalid`, `aria-describedby`, and `role="alert"`
- [ ] Modals trap focus and return focus to trigger on close
- [ ] Color contrast meets WCAG AA (4.5:1 normal text, 3:1 large/UI)
- [ ] Color is NOT the only means of conveying information
- [ ] `prefers-reduced-motion` is respected for all animations
- [ ] Dynamic content updates use `aria-live` regions
- [ ] Heading hierarchy is sequential (h1 → h2 → h3, no skipping)
- [ ] Page language declared with `<html lang="en">`
- [ ] `tabIndex` values are only 0 or -1 (NEVER positive values)
- [ ] Keyboard interactions follow WAI-ARIA Authoring Practices patterns
- [ ] Automated accessibility tests run in CI (axe-core, jest-axe, Playwright)
- [ ] Manual screen reader testing performed (VoiceOver, NVDA, or JAWS)
- [ ] Landmark regions defined (header/nav/main/footer)
- [ ] No keyboard traps exist anywhere in the application
- [ ] Touch targets are at least 24x24px (WCAG 2.2 Level AA)
- [ ] Text content is readable at 200% browser zoom without horizontal scroll
