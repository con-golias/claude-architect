---
mode: auto
paths:
  - "src/**/*.tsx"
  - "src/**/*.jsx"
  - "src/**/*.vue"
  - "src/**/*.html"
  - "src/**/*.svelte"
---
## Accessibility — WCAG 2.2 Level AA

### Semantic HTML
- Use native HTML elements for their intended purpose: `<button>` for actions, `<a>` for navigation, `<nav>`, `<main>`, `<section>`, `<article>` for structure
- NEVER use `<div>` or `<span>` for interactive elements — use the correct semantic element and style it
- Use heading levels (`<h1>`-`<h6>`) in sequential order — never skip levels for styling purposes
- Use `<ul>`/`<ol>` for lists — screen readers announce list length and position
- Use `<table>` with `<th>`, `<caption>`, and `scope` attributes for tabular data — never for layout

### ARIA Attributes
- NEVER use ARIA when a native HTML element provides the same semantics (first rule of ARIA)
- Add `aria-label` or `aria-labelledby` to interactive elements that lack visible text labels
- Use `aria-live="polite"` for dynamic content updates that screen readers should announce
- Use `aria-expanded`, `aria-haspopup`, and `aria-controls` for disclosure widgets (dropdowns, accordions)
- Mark decorative images with `aria-hidden="true"` and empty `alt=""`
- Use `role="alert"` for error messages that require immediate attention

### Keyboard Navigation
- ALL interactive elements MUST be reachable and operable via keyboard alone (Tab, Enter, Space, Escape, Arrow keys)
- Maintain a logical tab order that matches visual reading order — NEVER use positive `tabindex` values
- Implement keyboard shortcuts for complex widgets following WAI-ARIA Authoring Practices (arrow keys for menus, Escape to close)
- Ensure custom components trap focus correctly in modal dialogs — Tab cycles within the modal until dismissed
- Provide a visible skip link as the first focusable element: "Skip to main content"

### Focus Management
- NEVER remove the default focus outline without providing a clearly visible custom alternative
- When content changes dynamically (SPA navigation, modal open, inline edit), move focus to the relevant new content
- After closing a modal or popover, return focus to the element that triggered it
- Focus indicators MUST have a minimum contrast ratio of 3:1 against adjacent colors (WCAG 2.2 Focus Appearance)
- Focused elements MUST NOT be fully obscured by sticky headers, footers, or overlays (WCAG 2.2 Focus Not Obscured)

### Color & Contrast
- Text MUST meet minimum contrast ratios: 4.5:1 for normal text, 3:1 for large text (18px+ or 14px+ bold)
- UI components and graphical objects MUST have 3:1 contrast against adjacent colors
- NEVER use color as the only means of conveying information — supplement with icons, text, or patterns
- Support `prefers-reduced-motion` media query — disable or reduce animations for users who request it
- Support `prefers-color-scheme` — ensure accessible contrast in both light and dark themes

### Form Accessibility
- Every form input MUST have a programmatically associated `<label>` — never rely on placeholder text alone
- Group related form controls with `<fieldset>` and `<legend>`
- Display error messages adjacent to the invalid field and reference them with `aria-describedby`
- Mark required fields with both visual indicators and `aria-required="true"` or the `required` attribute
- Provide clear instructions before the form for any unusual input format requirements

### Interactive Target Size
- Touch targets MUST be at least 24x24 CSS pixels (WCAG 2.2 Target Size Minimum)
- Provide adequate spacing between adjacent targets to prevent accidental activation
- For any action requiring dragging, provide a single-pointer alternative (WCAG 2.2 Dragging Movements)

### Alternative Text & Media
- ALL informative images MUST have descriptive `alt` text that conveys the image's purpose — not its appearance
- Complex images (charts, diagrams) MUST have extended descriptions via `aria-describedby` or adjacent text
- Video content MUST have captions; audio content MUST have transcripts
- Decorative images: use empty `alt=""` and `aria-hidden="true"` — do not describe them

### Testing & Validation
- Run automated accessibility checks (axe-core, Lighthouse) in CI — block merge on new violations
- Manually test keyboard navigation for every new interactive component
- Test with at least one screen reader (NVDA, VoiceOver) before releasing user-facing features
- Include users with disabilities in usability testing when possible
