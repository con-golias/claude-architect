# Animation Patterns — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to animate in React?", "Framer Motion", "CSS animations vs JS animations", "page transitions", "FLIP technique", "spring animations", "scroll-driven animations", "animation performance", "View Transitions API", "reduce motion", or any animation question, ALWAYS consult this directive. Animations enhance UX when used purposefully — loading states, transitions, feedback, and delight. ALWAYS prefer CSS animations for simple effects — they run on the compositor thread. ALWAYS use Framer Motion for React component animations. ALWAYS respect `prefers-reduced-motion`. NEVER animate layout properties (width, height, top, left) — animate transform and opacity only.

**Core Rule: Animate ONLY `transform` and `opacity` — these are compositor-only properties that run at 60fps without triggering layout or paint. Use CSS transitions for simple hover/focus effects. Use Framer Motion for React component enter/exit/layout animations. Use the FLIP technique for layout changes. EVERY animation MUST respect `prefers-reduced-motion: reduce` — disable or simplify animations for users who request it. NEVER use animation as the only way to convey information.**

---

## 1. Animation Performance Model

```
  BROWSER RENDERING PIPELINE — ANIMATION COST

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  LAYOUT PROPERTIES (EXPENSIVE — triggers reflow):    │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  width, height, top, left, right, bottom      │  │
  │  │  margin, padding, border-width                │  │
  │  │  font-size, line-height                       │  │
  │  │                                                │  │
  │  │  → Recalculates layout of ALL affected elements│  │
  │  │  → NEVER animate these                        │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  PAINT PROPERTIES (MODERATE — triggers repaint):     │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  color, background-color, box-shadow          │  │
  │  │  border-color, outline                        │  │
  │  │                                                │  │
  │  │  → Repaints affected pixels                   │  │
  │  │  → OK for small areas, avoid for large areas  │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  COMPOSITE PROPERTIES (CHEAP — GPU only):            │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  transform (translate, scale, rotate)         │  │
  │  │  opacity                                      │  │
  │  │  filter (blur, brightness)                    │  │
  │  │                                                │  │
  │  │  → Runs on GPU compositor thread              │  │
  │  │  → ALWAYS use these for animations            │  │
  │  │  → 60fps guaranteed (if not overloaded)       │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘

  RULE: Animate transform + opacity. Use will-change sparingly.
```

---

## 2. CSS Animations and Transitions

### 2.1 CSS Transitions

```css
/* Simple hover transition — CSS is the right tool */
.button {
  background-color: #3b82f6;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  transition: background-color 150ms ease, transform 150ms ease;
}

.button:hover {
  background-color: #2563eb;
  transform: translateY(-1px);
}

.button:active {
  transform: translateY(0);
}

/* Focus transition */
.input {
  border: 2px solid #e5e7eb;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  outline: none;
}
```

### 2.2 CSS Keyframe Animations

```css
/* Loading spinner */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Skeleton loading pulse */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.skeleton {
  background-color: #e5e7eb;
  border-radius: 0.375rem;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-in {
  animation: fadeIn 300ms ease-out forwards;
}

/* Staggered list animation */
.list-item {
  opacity: 0;
  animation: fadeIn 300ms ease-out forwards;
}

.list-item:nth-child(1) { animation-delay: 0ms; }
.list-item:nth-child(2) { animation-delay: 50ms; }
.list-item:nth-child(3) { animation-delay: 100ms; }
.list-item:nth-child(4) { animation-delay: 150ms; }
```

---

## 3. Framer Motion (React)

### 3.1 Basic Animations

```tsx
import { motion, AnimatePresence } from 'framer-motion';

// Fade in on mount
function FadeIn({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// Enter + Exit animation
function Modal({ isOpen, onClose, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal content */}
          <motion.div
            className="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

### 3.2 List Animations

```tsx
// Animated list with stagger
function AnimatedList({ items }: { items: Item[] }) {
  return (
    <motion.ul
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: { staggerChildren: 0.05 },
        },
      }}
    >
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <motion.li
            key={item.id}
            variants={{
              hidden: { opacity: 0, x: -20 },
              visible: { opacity: 1, x: 0 },
            }}
            exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
            layout                                    // animate layout shifts
          >
            {item.name}
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}
```

### 3.3 Layout Animations

```tsx
// Shared layout animation (expanding card)
import { motion, LayoutGroup } from 'framer-motion';

function ExpandableCard({ id, title, content }: CardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      layout                                          // animate layout changes
      onClick={() => setIsExpanded(!isExpanded)}
      style={{
        borderRadius: 12,
        cursor: 'pointer',
      }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      <motion.h3 layout="position">{title}</motion.h3>

      <AnimatePresence>
        {isExpanded && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {content}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

### 3.4 Spring Physics

```tsx
// Spring animation — natural, physics-based motion
<motion.div
  animate={{ x: 100 }}
  transition={{
    type: 'spring',
    stiffness: 300,       // spring tension (higher = faster)
    damping: 20,          // friction (higher = less bouncy)
    mass: 1,              // weight (higher = more inertia)
  }}
/>

// Common spring presets
const springs = {
  gentle: { type: 'spring', stiffness: 120, damping: 14 },
  snappy: { type: 'spring', stiffness: 300, damping: 25 },
  bouncy: { type: 'spring', stiffness: 400, damping: 10 },
  slow:   { type: 'spring', stiffness: 100, damping: 20 },
} as const;

<motion.div
  animate={{ scale: 1 }}
  initial={{ scale: 0 }}
  transition={springs.snappy}
/>
```

---

## 4. FLIP Technique

```
  FLIP — First, Last, Invert, Play

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  PROBLEM: Animating layout changes (reorder, resize) │
  │  is expensive because it triggers reflow.            │
  │                                                      │
  │  SOLUTION: FLIP                                      │
  │                                                      │
  │  F — FIRST:  Record element's initial position       │
  │  L — LAST:   Apply layout change (DOM update)        │
  │  I — INVERT: Calculate delta, apply inverse transform│
  │              (element appears in FIRST position)      │
  │  P — PLAY:   Remove inverse transform with animation │
  │              (element smoothly moves to LAST position)│
  │                                                      │
  │  RESULT: Layout change animated with TRANSFORM only  │
  │  (compositor thread — 60fps guaranteed)               │
  └──────────────────────────────────────────────────────┘
```

```typescript
// Manual FLIP implementation
function animateLayoutChange(element: HTMLElement, callback: () => void) {
  // FIRST: Record initial position
  const first = element.getBoundingClientRect();

  // LAST: Apply the layout change
  callback();

  // Measure new position
  const last = element.getBoundingClientRect();

  // INVERT: Calculate delta
  const deltaX = first.left - last.left;
  const deltaY = first.top - last.top;
  const deltaW = first.width / last.width;
  const deltaH = first.height / last.height;

  // Apply inverse transform (element appears at FIRST position)
  element.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`;
  element.style.transformOrigin = 'top left';

  // PLAY: Animate to final position (remove transform)
  requestAnimationFrame(() => {
    element.style.transition = 'transform 300ms ease';
    element.style.transform = '';

    element.addEventListener('transitionend', () => {
      element.style.transition = '';
      element.style.transformOrigin = '';
    }, { once: true });
  });
}

// Framer Motion handles FLIP automatically with layout prop
<motion.div layout>  {/* FLIP animation handled internally */}
```

---

## 5. Scroll-Driven Animations

### 5.1 CSS Scroll-Driven Animations

```css
/* Scroll-linked progress bar (CSS only, no JS) */
.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: #3b82f6;
  transform-origin: left;
  animation: scaleProgress auto linear;
  animation-timeline: scroll();
}

@keyframes scaleProgress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

/* Element reveal on scroll */
.reveal {
  animation: reveal auto linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}

@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 5.2 Intersection Observer for Scroll Animations

```tsx
// Scroll-triggered animation hook
import { useEffect, useRef, useState } from 'react';

function useInView(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.unobserve(element);        // trigger once only
      }
    }, { threshold: 0.1, ...options });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, isInView };
}

// Usage
function FadeInOnScroll({ children }: { children: React.ReactNode }) {
  const { ref, isInView } = useInView();

  return (
    <div
      ref={ref}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}
    >
      {children}
    </div>
  );
}
```

---

## 6. View Transitions API

```typescript
// Page transitions (SPA navigation)
// Available in Chrome 111+, progressive enhancement
async function navigateWithTransition(url: string) {
  if (!document.startViewTransition) {
    // Fallback: instant navigation
    window.location.href = url;
    return;
  }

  document.startViewTransition(async () => {
    // Update the DOM (e.g., render new page)
    await loadAndRenderPage(url);
  });
}
```

```css
/* View Transition CSS customization */
::view-transition-old(root) {
  animation: fade-out 200ms ease-out;
}

::view-transition-new(root) {
  animation: fade-in 200ms ease-in;
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Named transitions for specific elements */
.hero-image {
  view-transition-name: hero;
}

::view-transition-old(hero) {
  animation: scale-down 300ms ease-out;
}

::view-transition-new(hero) {
  animation: scale-up 300ms ease-in;
}
```

---

## 7. Accessibility — prefers-reduced-motion

```css
/* ALWAYS respect user preference */
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

/* Or selectively reduce */
@media (prefers-reduced-motion: reduce) {
  .fade-in {
    animation: none;
    opacity: 1;
  }

  .hero-parallax {
    transform: none;
  }

  /* Keep essential animations (loading spinners) */
  .spinner {
    animation-duration: 1.5s;          /* slower, not removed */
  }
}
```

```tsx
// React: Check reduced motion preference
import { useReducedMotion } from 'framer-motion';

function AnimatedComponent() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.3,
      }}
    >
      Content
    </motion.div>
  );
}

// Custom hook
function usePrefersReducedMotion(): boolean {
  const [reduces, setReduces] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduces(mq.matches);

    const handler = (e: MediaQueryListEvent) => setReduces(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduces;
}
```

---

## 8. Animation Timing Guide

| Use Case | Duration | Easing | Property |
|---|---|---|---|
| Button hover | 150ms | ease | background-color, transform |
| Focus ring | 150ms | ease | box-shadow, border-color |
| Tooltip show | 200ms | ease-out | opacity, transform |
| Modal enter | 300ms | spring (snappy) | opacity, scale, y |
| Modal exit | 200ms | ease-in | opacity, scale |
| Page transition | 300-400ms | ease-in-out | opacity |
| List item enter | 200ms + stagger | ease-out | opacity, x |
| Sidebar toggle | 300ms | ease-in-out | transform |
| Notification slide | 400ms | spring (gentle) | transform |
| Loading spinner | 800ms | linear | transform (rotate) |

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Animating width/height** | Jank, 30fps, layout thrashing on every frame | Use `transform: scale()` instead; use `layout` prop in Framer Motion |
| **No prefers-reduced-motion** | Users with vestibular disorders experience nausea/seizures | Add `@media (prefers-reduced-motion: reduce)` for ALL animations |
| **Animation as info carrier** | Red pulse means error — not perceivable without animation | Use text, icons, and color in ADDITION to animation |
| **Too many simultaneous animations** | Page feels chaotic; GPU overloaded; dropped frames | Limit to 2-3 concurrent animations; stagger others |
| **Blocking interactions during animation** | Button unclickable during 500ms entrance animation | Keep interactive elements immediately usable |
| **Long animation durations** | 1-2 second animations feel sluggish — user waits | Keep most animations under 400ms; 150ms for micro-interactions |
| **will-change on everything** | `will-change: transform` on every element — wastes GPU memory | Use will-change ONLY on elements that actually animate |
| **jQuery/GSAP for simple effects** | 50KB library for a hover transition | Use CSS transitions for simple effects; JS only for complex |
| **No AnimatePresence** | Elements disappear instantly instead of animating out | Wrap conditional renders in `<AnimatePresence>` for exit animations |
| **Easing mismatch** | Enter uses `ease-in` (slow start) — feels laggy | Use `ease-out` for enter (fast start, slow end), `ease-in` for exit |

---

## 10. Enforcement Checklist

### Performance
- [ ] Animations use ONLY transform and opacity (no width, height, top, left)
- [ ] `will-change` used sparingly (only on actively animating elements)
- [ ] Animation frame rate tested in DevTools Performance panel
- [ ] No layout thrashing during animations

### Accessibility
- [ ] `prefers-reduced-motion: reduce` respected for ALL animations
- [ ] Animations do not convey information that isn't available otherwise
- [ ] No flashing/strobing content (WCAG 2.3.1)
- [ ] Loading spinners use `role="status"` and `aria-label`

### Implementation
- [ ] CSS transitions used for simple hover/focus effects
- [ ] Framer Motion (or equivalent) used for component enter/exit/layout
- [ ] `AnimatePresence` wraps conditional renders for exit animations
- [ ] Spring physics used instead of duration-based easing where appropriate
- [ ] Stagger applied to list animations (50-100ms between items)

### Timing
- [ ] Micro-interactions: 100-200ms
- [ ] Content transitions: 200-400ms
- [ ] Page transitions: 300-500ms
- [ ] No animation exceeds 1 second without clear purpose
