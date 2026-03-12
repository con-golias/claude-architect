# Cognitive Accessibility

| Property       | Value                                                                |
|---------------|----------------------------------------------------------------------|
| Domain        | Accessibility > Cognitive                                            |
| Importance    | Medium                                                               |
| Audience      | Frontend engineers, UX designers, content writers                    |
| Cross-ref     | [05-frontend accessibility](../../05-frontend/web/component-design/accessibility.md) (covers form labels, error messages, live regions, motion preferences) |

---

## WCAG 2.2 Cognitive Criteria

WCAG 2.2 introduced several criteria specifically addressing cognitive accessibility. These apply at Level AA.

### 2.4.11 Focus Not Obscured (Minimum) — AA

Ensure the focused element is not entirely hidden behind sticky headers, footers, or overlays.

```css
/* Prevent sticky header from covering focused elements */
:focus {
  scroll-margin-top: 80px; /* Height of sticky header + buffer */
  scroll-margin-bottom: 60px; /* Height of sticky footer + buffer */
}

/* Ensure sticky elements do not obscure content */
.sticky-header {
  position: sticky;
  top: 0;
  z-index: 100;
}
```

### 2.5.7 Dragging Movements — AA

Provide a single-pointer alternative for every drag operation.

```tsx
function SortableList({ items, onReorder }: SortableListProps) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={item.id} draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDrop={(e) => handleDrop(e, index)}>
          <span>{item.label}</span>
          {/* Non-dragging alternatives (WCAG 2.5.7) */}
          <button onClick={() => moveItem(index, -1)}
                  aria-label={`Move ${item.label} up`}
                  disabled={index === 0}>
            Move up
          </button>
          <button onClick={() => moveItem(index, 1)}
                  aria-label={`Move ${item.label} down`}
                  disabled={index === items.length - 1}>
            Move down
          </button>
        </li>
      ))}
    </ul>
  );
}
```

### 2.5.8 Target Size (Minimum) — AA

Interactive targets must be at least 24x24 CSS pixels, or have sufficient spacing from adjacent targets.

```css
/* Minimum 24x24px target size */
button, a, input, select, textarea {
  min-height: 24px;
  min-width: 24px;
}

/* Recommended: 44x44px for comfortable use */
.primary-action {
  min-height: 44px;
  min-width: 44px;
  padding: 10px 16px;
}
```

### 3.2.6 Consistent Help — AA

Place help mechanisms (contact info, chat, FAQ links) in the same relative location on every page.

```html
<!-- Consistent help location in footer across all pages -->
<footer>
  <nav aria-label="Help">
    <a href="/help">Help center</a>
    <a href="/contact">Contact support</a>
    <button id="chat-trigger">Chat with us</button>
  </nav>
</footer>
```

### 3.3.7 Redundant Entry — AA

Do not require users to re-enter information they have already provided in the same session.

```tsx
function CheckoutFlow() {
  const [billingAddress, setBillingAddress] = useState<Address>();

  return (
    <form>
      <BillingAddressForm onComplete={setBillingAddress} />
      <ShippingAddressForm>
        {/* Pre-fill or offer "same as billing" option */}
        <label>
          <input type="checkbox"
                 onChange={(e) => {
                   if (e.target.checked) prefillShipping(billingAddress);
                 }} />
          Same as billing address
        </label>
      </ShippingAddressForm>
    </form>
  );
}
```

### 3.3.8 Accessible Authentication (Minimum) — AA

Do not require cognitive function tests (memorize password, solve puzzle) without alternatives.

```tsx
function LoginForm() {
  return (
    <form>
      {/* Allow password managers to fill credentials */}
      <input type="email" name="email" autoComplete="email" />
      <input type="password" name="password" autoComplete="current-password" />

      {/* Support passkeys / WebAuthn as an alternative */}
      <button type="button" onClick={authenticateWithPasskey}>
        Sign in with passkey
      </button>

      {/* If CAPTCHA is required, use accessible alternatives */}
      {/* Do NOT use image recognition or text transcription CAPTCHAs */}
      {/* Use invisible reCAPTCHA or audio alternatives */}
    </form>
  );
}
```

---

## Plain Language Guidelines

### Reading Level Targets

Target an 8th-grade reading level (US) / age 13-14 for general audiences. Use tools like Hemingway Editor or Flesch-Kincaid scoring.

| Metric | Target |
|--------|--------|
| Flesch-Kincaid Grade Level | 6-8 |
| Flesch Reading Ease | 60-70+ |
| Average sentence length | 15-20 words |
| Passive voice usage | Less than 10% |

### Writing Rules

| Rule | Before | After |
|------|--------|-------|
| Use short sentences | "In order to facilitate the completion of your registration process, please fill out all required fields." | "Fill out all required fields to register." |
| Avoid jargon | "An authentication error has occurred." | "Your username or password is incorrect." |
| Use active voice | "Your order has been placed by the system." | "We placed your order." |
| Be specific | "An error occurred." | "We could not save your file. The disk is full." |
| Front-load key info | "If you want to reset your password, click the link below." | "Reset your password: click the link below." |

---

## Consistent Navigation Patterns

### Predictable Layout

```html
<!-- Consistent page structure across all pages -->
<body>
  <a href="#main" class="skip-link">Skip to main content</a>
  <header role="banner">
    <!-- Logo always top-left, nav always top-right -->
    <nav aria-label="Main navigation"><!-- Same order on every page --></nav>
  </header>
  <main id="main" role="main">
    <nav aria-label="Breadcrumb"><!-- Consistent breadcrumb --></nav>
    <!-- Page content -->
  </main>
  <aside role="complementary"><!-- Sidebar in consistent location --></aside>
  <footer role="contentinfo">
    <nav aria-label="Help"><!-- Help always in footer --></nav>
  </footer>
</body>
```

### Consistent Controls

- Same icon = same action everywhere (trash icon always means delete)
- Same label = same function (do not use "Submit" and "Send" for the same action)
- Navigation order does not change between pages unless user customizes it

---

## Error Prevention and Recovery

### Clear Error Messages

```tsx
function FormField({ error }: { error?: ValidationError }) {
  if (!error) return null;

  return (
    <div role="alert" className="error-message">
      {/* State the problem + provide a fix */}
      <strong>Error:</strong> {error.message}
      {error.suggestion && (
        <p className="suggestion">Try: {error.suggestion}</p>
      )}
    </div>
  );
}

// Error messages with actionable suggestions
const errorMessages = {
  email: {
    message: "This email address is not valid.",
    suggestion: 'Include an "@" sign and a domain (e.g., name@example.com).',
  },
  password: {
    message: "Password must be at least 8 characters.",
    suggestion: "Add more characters. Current length: 5.",
  },
  date: {
    message: "This date is not valid.",
    suggestion: "Use the format MM/DD/YYYY (e.g., 03/15/2026).",
  },
};
```

### Confirmation for Destructive Actions

```tsx
function DeleteButton({ itemName, onConfirm }: DeleteButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  return showConfirm ? (
    <div role="alertdialog" aria-labelledby="confirm-title"
         aria-describedby="confirm-desc">
      <p id="confirm-title">Delete {itemName}?</p>
      <p id="confirm-desc">
        This action cannot be undone. All data for {itemName} will be
        permanently removed.
      </p>
      <button onClick={onConfirm}>Yes, delete</button>
      <button onClick={() => setShowConfirm(false)} autoFocus>
        Cancel
      </button>
    </div>
  ) : (
    <button onClick={() => setShowConfirm(true)}>Delete {itemName}</button>
  );
}
```

### Undo Capability

Provide an undo window (10+ seconds) with `aria-live="polite"` status announcement for non-destructive reversals. Use `role="alertdialog"` confirmation for irreversible actions.

---

## Reducing Cognitive Load

### Key Strategies

| Strategy | Implementation |
|----------|---------------|
| **Chunking** | Break long forms into multi-step wizards with progress indicator (`aria-current="step"`) |
| **Progressive disclosure** | Use `<details>`/`<summary>` to hide secondary content behind expandable sections |
| **Visual hierarchy** | Use heading levels, whitespace, and grouping to guide scanning order |
| **Whitespace** | Adequate spacing between sections reduces visual clutter and improves comprehension |
| **Reading patterns** | Place key actions and info along F-pattern (left-to-right, top-heavy) scan paths |

---

## Timeout Handling (WCAG 2.2.1)

```tsx
function SessionTimeout({ timeoutMs = 30 * 60_000 }: { timeoutMs?: number }) {
  const WARNING_BEFORE = 2 * 60_000; // Warn 2 minutes before timeout
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const warningTimer = setTimeout(
      () => setShowWarning(true),
      timeoutMs - WARNING_BEFORE
    );
    return () => clearTimeout(warningTimer);
  }, [timeoutMs]);

  function extendSession() {
    setShowWarning(false);
    // Call API to extend session, reset timer
    fetch("/api/extend-session", { method: "POST" });
  }

  if (!showWarning) return null;

  return (
    <div role="alertdialog" aria-labelledby="timeout-title"
         aria-describedby="timeout-desc">
      <h2 id="timeout-title">Session expiring soon</h2>
      <p id="timeout-desc">
        Your session will expire in 2 minutes. Unsaved changes will be lost.
      </p>
      <button onClick={extendSession} autoFocus>
        Extend session by 30 minutes
      </button>
      <button onClick={() => saveAndLogout()}>
        Save and log out
      </button>
    </div>
  );
}
```

Requirements (WCAG 2.2.1):
- Warn the user before timeout occurs
- Allow the user to extend the timeout at least 10 times
- Allow the user to turn off the timeout (if possible)
- Auto-save data before session expires

---

## Animation and Motion

### prefers-reduced-motion

```css
/* Default: include animations */
.card-enter {
  animation: slideIn 300ms ease-out;
}

/* Respect user preference for reduced motion */
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
```

Use `window.matchMedia("(prefers-reduced-motion: reduce)")` in JavaScript to detect the preference and disable animation libraries (Framer Motion, GSAP) accordingly.

### Auto-Play Prevention

- Never auto-play video or audio with sound
- Provide pause, stop, and hide controls for any auto-moving content
- Moving content that starts automatically must stop within 5 seconds or have a pause mechanism (WCAG 2.2.2)

---

## Notification Management

| Priority | Examples | `aria-live` | Delivery |
|----------|----------|------------|----------|
| **Critical** | Security alerts, data loss | `assertive` + `role="alert"` | Immediate interruption |
| **Important** | New messages, task completion | `polite` + `role="status"` | Announced at next pause |
| **Informational** | Tips, promotions | None | User discovers in notification inbox |

Group notifications to prevent overwhelming users. Provide a do-not-disturb mode and allow users to configure which notification levels they receive.

---

## Best Practices

1. **Write error messages that state the problem and suggest a fix** — "Email address is not valid. Include @ and a domain (e.g., name@example.com)."
2. **Respect `prefers-reduced-motion`** by disabling or reducing all animations and transitions for users who opt out.
3. **Break long forms into clearly labeled steps** with a progress indicator showing current position and total steps.
4. **Warn users before session timeouts** with at least 2 minutes notice and an option to extend at least 10 times.
5. **Place help mechanisms in the same location on every page** — footer help links, chat buttons, and contact info must be consistent.
6. **Do not require users to re-enter information** already provided in the same session — pre-fill or offer "same as" options.
7. **Provide confirmation dialogs for destructive actions** (delete, cancel, discard) with a clear description of consequences.
8. **Use progressive disclosure** to hide secondary content behind expandable sections, reducing initial cognitive load.
9. **Support accessible authentication** — allow password managers (proper `autocomplete` attributes), passkeys, and avoid cognitive CAPTCHAs.
10. **Limit notification frequency and provide priority levels** — reserve `assertive` announcements for critical alerts only.

---

## Anti-Patterns

| # | Anti-Pattern | Problem | Correct Approach |
|---|-------------|---------|------------------|
| 1 | Displaying all form fields on one long page | Users feel overwhelmed; high abandonment rate | Chunk into multi-step form with progress indicator |
| 2 | Error messages without suggestions | User knows something is wrong but not how to fix it | "Invalid date" becomes "Use format MM/DD/YYYY (e.g., 03/15/2026)" |
| 3 | Session timeout without warning | Users lose unsaved work; form data vanishes | Warn 2+ minutes before timeout with extend option |
| 4 | Requiring CAPTCHA with no accessible alternative | Cognitive and visual barriers prevent some users from authenticating | Use invisible CAPTCHA, passkeys, or email verification |
| 5 | Auto-playing video/audio with sound | Startles users; interferes with screen readers; vestibular triggers | Default to paused; require explicit user action to play |
| 6 | Inconsistent navigation between pages | Users must re-learn interface on every page; increases cognitive load | Keep nav order, labels, and help locations consistent |
| 7 | Using `assertive` live region for non-critical updates | Screen reader interrupts current task for low-priority info | Use `polite` for non-critical; `assertive` only for blocking alerts |
| 8 | No undo for destructive actions | Users who accidentally click Delete have no recovery path | Provide undo window (10+ seconds) or confirmation dialog |

---

## Enforcement Checklist

- [ ] `prefers-reduced-motion` respected in all CSS animations and JavaScript transitions
- [ ] Error messages include a specific suggestion for how to fix the problem
- [ ] Multi-step forms have a progress indicator announcing current step and total
- [ ] Session timeout warning appears at least 2 minutes before expiration with extend option
- [ ] Help links and contact mechanisms appear in the same location on every page
- [ ] Destructive actions require confirmation or provide an undo mechanism
- [ ] Authentication flow supports password managers (`autocomplete` attributes) and passkeys
- [ ] No cognitive CAPTCHA without an accessible alternative
- [ ] `aria-live` regions use appropriate priority: `assertive` for critical, `polite` for informational
- [ ] Content reviewed for plain language: Flesch-Kincaid grade level 8 or below for general audiences
