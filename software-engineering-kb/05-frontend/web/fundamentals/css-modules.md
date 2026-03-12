# CSS Modules — Complete Specification

> **AI Plugin Directive:** When implementing scoped component-level CSS, deciding between CSS approaches, or configuring CSS Modules in build tools, ALWAYS consult this guide. Apply these CSS Module patterns to achieve reliable style isolation without runtime overhead. This guide covers CSS Module syntax, composition, TypeScript integration, naming conventions, framework integration, and theming.

**Core Rule: CSS Modules provide LOCAL scope by default — every class name is automatically unique per file. ALWAYS use camelCase imports in TypeScript. NEVER use global selectors inside CSS Modules unless intentionally escaping scope with :global(). Use :composes for style reuse WITHIN CSS Modules — NEVER duplicate rule sets. Pair with TypeScript typed modules for type-safe class references.**

---

## 1. Core Concepts

```
                    CSS MODULES ARCHITECTURE

  Source (Button.module.css):          Compiled Output:
  ┌──────────────────────┐           ┌─────────────────────────────────┐
  │ .root {              │    ──►    │ .Button_root_x7ks2 {            │
  │   display: flex;     │           │   display: flex;                │
  │ }                    │           │ }                               │
  │ .label {             │    ──►    │ .Button_label_a3mn7 {           │
  │   font-weight: bold; │           │   font-weight: bold;            │
  │ }                    │           │ }                               │
  └──────────────────────┘           └─────────────────────────────────┘

  Import in Component:
  ┌──────────────────────────────────────────────┐
  │ import styles from './Button.module.css';     │
  │                                               │
  │ styles.root  → "Button_root_x7ks2"           │
  │ styles.label → "Button_label_a3mn7"           │
  │                                               │
  │ <div className={styles.root}>                 │
  │   <span className={styles.label}>Click</span> │
  │ </div>                                        │
  └──────────────────────────────────────────────┘

  HOW IT WORKS:
  ├── Build tool (Webpack/Vite) intercepts .module.css imports
  ├── Each class name is hashed to a unique identifier
  ├── A JavaScript object mapping original → hashed is exported
  ├── Zero runtime cost — all transformation happens at build time
  └── Hash format is configurable (e.g., [name]__[local]__[hash:5])
```

### 1.1 Basic Usage

```css
/* Card.module.css */
.root {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  padding: 1.5rem;
  background-color: var(--color-surface);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
  transition: box-shadow 0.2s ease;
}

.root:hover {
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
}

.header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-on-surface);
}

.body {
  flex: 1;
  color: var(--color-on-surface-secondary);
  line-height: 1.6;
}

/* Variants using data attributes or modifier classes */
.elevated {
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
}

.outlined {
  box-shadow: none;
  border: 1px solid var(--color-border);
}
```

```tsx
// Card.tsx
import styles from './Card.module.css';
import { cn } from '@/lib/utils';

interface CardProps {
  title: string;
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined';
  className?: string;
}

function Card({ title, children, variant, className }: CardProps) {
  return (
    <article
      className={cn(
        styles.root,
        variant === 'elevated' && styles.elevated,
        variant === 'outlined' && styles.outlined,
        className
      )}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
      </header>
      <div className={styles.body}>{children}</div>
    </article>
  );
}
```

---

## 2. Composition (:composes)

```
                    COMPOSITION PATTERNS

  :composes imports styles from OTHER modules:
  ┌──────────────────────────────────────────────────────────┐
  │ .base {                                                  │
  │   display: flex;                                         │
  │   padding: 0.5rem 1rem;                                  │
  │ }                                                        │
  │                                                          │
  │ .primary {                                               │
  │   composes: base;                ← Same-file composition │
  │   background: blue;                                      │
  │ }                                                        │
  │                                                          │
  │ .button {                                                │
  │   composes: reset from './reset.module.css';  ← Cross-file│
  │   composes: base;                                        │
  │ }                                                        │
  └──────────────────────────────────────────────────────────┘

  HOW COMPOSES WORKS:
  ├── Does NOT copy CSS rules (unlike @apply in Tailwind)
  ├── Adds MULTIPLE class names to the JavaScript export
  ├── styles.primary → "Card_base_x1 Card_primary_y2"
  ├── Result: element gets both classes
  └── More efficient than duplicating CSS rules

  RULES:
  ├── composes MUST be the first declaration in a rule
  ├── Can compose from multiple sources
  ├── Cannot compose from global scope
  └── Cross-file composition must reference .module.css files
```

```css
/* typography.module.css — Shared composition source */
.heading {
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.body {
  font-weight: 400;
  line-height: 1.6;
}

.caption {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

```css
/* PageHeader.module.css */
.title {
  composes: heading from './typography.module.css';
  font-size: 2.5rem;
  color: var(--color-on-surface);
  margin-bottom: 0.5rem;
}

.subtitle {
  composes: body from './typography.module.css';
  font-size: 1.125rem;
  color: var(--color-on-surface-secondary);
}

.tag {
  composes: caption from './typography.module.css';
  color: var(--color-primary);
  background: var(--color-primary-subtle);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}
```

---

## 3. TypeScript Typed CSS Modules

```
                    TYPE SAFETY OPTIONS

  Option 1: Declaration file (manual)
  ┌────────────────────────────────────┐
  │  Button.module.css.d.ts            │
  │  Manually maintained               │
  │  Tedious, often out of date        │
  └────────────────────────────────────┘

  Option 2: typed-css-modules (CLI tool)
  ┌────────────────────────────────────┐
  │  npx tcm src/                      │
  │  Auto-generates .d.ts files        │
  │  Run as pre-build step or watch    │
  └────────────────────────────────────┘

  Option 3: typescript-plugin-css-modules
  ┌────────────────────────────────────┐
  │  IDE-only type checking            │
  │  No generated files                │
  │  Configured in tsconfig.json       │
  │  RECOMMENDED for most projects     │
  └────────────────────────────────────┘

  Option 4: Vite plugin (vite-plugin-css-modules-types)
  ┌────────────────────────────────────┐
  │  Auto-generates during dev/build   │
  │  Works with Vite's CSS module      │
  │  processing pipeline               │
  └────────────────────────────────────┘
```

### 3.1 Setup: typescript-plugin-css-modules

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "typescript-plugin-css-modules",
        "options": {
          "classnameTransform": "camelCaseOnly",
          "customMatcher": "\\.module\\.(css|scss|less)$"
        }
      }
    ]
  }
}
```

```jsonc
// .vscode/settings.json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

### 3.2 Setup: typed-css-modules (generated .d.ts)

```bash
# Install
npm install -D typed-css-modules

# Generate types for all CSS modules
npx tcm src/

# Watch mode during development
npx tcm src/ --watch

# Add to package.json scripts
# "css-types": "tcm src/",
# "css-types:watch": "tcm src/ --watch",
# "prebuild": "tcm src/"
```

```typescript
// Generated: Button.module.css.d.ts
declare const styles: {
  readonly root: string;
  readonly label: string;
  readonly icon: string;
  readonly primary: string;
  readonly secondary: string;
  readonly disabled: string;
};
export default styles;
```

### 3.3 Global Type Declaration (fallback)

```typescript
// src/types/css-modules.d.ts
// Generic declaration — provides basic typing without per-file types
// Use this as a FALLBACK only; prefer per-file typing for safety

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
```

---

## 4. Naming Conventions

```
                    NAMING STRATEGIES

  ┌────────────────┬──────────────────┬──────────────────────────┐
  │ Convention     │ CSS file         │ TypeScript import         │
  ├────────────────┼──────────────────┼──────────────────────────┤
  │ camelCase      │ .submitButton {} │ styles.submitButton       │
  │ kebab-case     │ .submit-button {}│ styles['submit-button']   │
  │ BEM-like       │ .card__title {}  │ styles['card__title']     │
  │ Single-word    │ .root .title {}  │ styles.root styles.title  │
  └────────────────┴──────────────────┴──────────────────────────┘

  RECOMMENDATION: Use camelCase in CSS files
  ├── Allows dot notation: styles.submitButton
  ├── No bracket notation needed
  ├── TypeScript autocomplete works naturally
  ├── Matches JavaScript naming conventions
  └── Most CSS-in-JS libraries use camelCase

  ALTERNATIVE: Use kebab-case with camelCase transform
  ├── Vite: css.modules.localsConvention: 'camelCaseOnly'
  ├── Webpack: modules.exportLocalsConvention: 'camelCaseOnly'
  ├── Write CSS naturally, import as camelCase
  └── styles.submitButton works even if CSS has .submit-button

  CLASS NAMING WITHIN MODULES:
  ├── .root — The component's root element (ALWAYS)
  ├── .header, .body, .footer — Structural sections
  ├── .title, .label, .icon — Content elements
  ├── .primary, .secondary — Variant modifiers
  ├── .disabled, .active, .loading — State modifiers
  └── AVOID deeply nested BEM-style names — module scope handles isolation
```

### 4.1 Build Tool Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    modules: {
      // Transform kebab-case to camelCase in imports
      localsConvention: 'camelCaseOnly',

      // Customize generated class names
      generateScopedName: process.env.NODE_ENV === 'production'
        ? '[hash:base64:5]'                           // Production: minimal
        : '[name]__[local]__[hash:base64:5]',         // Dev: readable

      // Scope behavior
      scopeBehaviour: 'local', // default
    },
  },
});
```

```typescript
// webpack.config.ts (Next.js customization in next.config.js)
// Next.js configures CSS Modules automatically
// Custom class name format in next.config.js:
module.exports = {
  webpack: (config) => {
    const cssModuleRules = config.module.rules.find(
      (rule) => rule.oneOf
    );
    // Modify CSS module loader options if needed
    return config;
  },
};
```

---

## 5. CSS Modules in Next.js

```
                    NEXT.JS CSS MODULES

  File conventions:
  ├── *.module.css    → CSS Module (scoped)
  ├── *.css           → Global CSS (only in layout.tsx / _app.tsx)
  ├── *.module.scss   → SCSS Module (needs sass package)
  └── globals.css     → Global styles (import in root layout)

  Rules in Next.js:
  ├── Global CSS can ONLY be imported in:
  │   ├── app/layout.tsx (App Router)
  │   └── pages/_app.tsx (Pages Router)
  ├── CSS Modules can be imported ANYWHERE
  ├── CSS Modules are automatically code-split
  ├── Built-in PostCSS processing
  └── Supports CSS nesting (with postcss-nesting)
```

```tsx
// app/layout.tsx — Global styles imported here
import '@/styles/globals.css';
import '@/styles/tokens.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```css
/* styles/globals.css */
@layer base {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
  }

  :root {
    --color-surface: hsl(0 0% 100%);
    --color-on-surface: hsl(222 47% 11%);
    --color-primary: hsl(221 83% 53%);
    --color-border: hsl(214 32% 91%);
    color-scheme: light dark;
  }

  .dark {
    --color-surface: hsl(222 47% 11%);
    --color-on-surface: hsl(210 40% 98%);
    --color-primary: hsl(217 91% 60%);
    --color-border: hsl(217 33% 25%);
  }

  body {
    font-family: var(--font-sans);
    background: var(--color-surface);
    color: var(--color-on-surface);
    -webkit-font-smoothing: antialiased;
  }
}
```

```tsx
// components/Sidebar/Sidebar.tsx
import styles from './Sidebar.module.css';

export function Sidebar({ isOpen }: { isOpen: boolean }) {
  return (
    <aside
      className={`${styles.root} ${isOpen ? styles.open : ''}`}
      data-state={isOpen ? 'open' : 'closed'}
    >
      <nav className={styles.nav}>
        {/* ... */}
      </nav>
    </aside>
  );
}
```

```css
/* components/Sidebar/Sidebar.module.css */
.root {
  position: fixed;
  top: 0;
  left: 0;
  height: 100dvh;
  width: 16rem;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  transform: translateX(-100%);
  transition: transform 0.3s ease;
}

.open {
  transform: translateX(0);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem;
}

/* Using :global() to target non-module classes */
.root :global(.active) {
  background: var(--color-primary);
  color: white;
}

/* Media queries work normally */
@media (min-width: 1024px) {
  .root {
    position: sticky;
    transform: none;
  }
}
```

---

## 6. CSS Modules in Vite

```tsx
// Vite handles CSS Modules out of the box
// Any file ending with .module.css is treated as CSS Module

// Vite also supports CSS Modules with preprocessors
import styles from './Component.module.scss';  // Needs sass installed
import styles from './Component.module.less';  // Needs less installed

// Vite-specific: ?inline query for raw CSS string
import cssText from './Component.module.css?inline';
// cssText is the raw CSS string (useful for Shadow DOM)
```

---

## 7. Global Styles Alongside Modules

```
                    MIXING GLOBAL AND MODULE STYLES

  ARCHITECTURE:
  ├── styles/
  │   ├── globals.css           ← Reset, base, tokens
  │   ├── tokens.css            ← CSS custom properties
  │   └── utilities.css         ← Global utility classes (if any)
  ├── components/
  │   ├── Button/
  │   │   ├── Button.tsx
  │   │   └── Button.module.css ← Scoped styles
  │   └── Card/
  │       ├── Card.tsx
  │       └── Card.module.css   ← Scoped styles
  └── app/
      └── layout.tsx            ← Imports globals.css

  ESCAPING MODULE SCOPE:
  ├── :global(.className) — Single class
  ├── :global { ... }     — Block of global styles
  └── Use sparingly — defeats the purpose of modules
```

```css
/* Component.module.css */

/* Local scope (default) */
.root {
  padding: 1rem;
}

/* Escape to global for third-party class names */
.root :global(.tippy-content) {
  padding: 0;
}

/* Target global state classes */
.root:global(.is-dragging) {
  opacity: 0.5;
}

/* Combine local and global */
.root :global(.highlight) .text {
  /* .root is local, .highlight is global, .text is local */
  color: var(--color-primary);
}

/* Block-level global escape */
:global {
  .third-party-widget {
    border: none;
  }
}
```

---

## 8. Theming with CSS Modules

```css
/* tokens.css — Global theme tokens */
:root {
  /* Primitive tokens */
  --blue-50: hsl(214 100% 97%);
  --blue-500: hsl(221 83% 53%);
  --blue-600: hsl(221 83% 46%);
  --gray-50: hsl(210 40% 98%);
  --gray-100: hsl(214 32% 91%);
  --gray-900: hsl(222 47% 11%);

  /* Semantic tokens */
  --color-surface: var(--gray-50);
  --color-on-surface: var(--gray-900);
  --color-primary: var(--blue-500);
  --color-primary-hover: var(--blue-600);
  --color-border: var(--gray-100);

  /* Component tokens */
  --button-bg: var(--color-primary);
  --button-text: white;
  --button-radius: 8px;
  --card-bg: white;
  --card-border: var(--color-border);
  --card-radius: 12px;
  --card-padding: 1.5rem;
}

.dark {
  --color-surface: var(--gray-900);
  --color-on-surface: var(--gray-50);
  --color-primary: hsl(217 91% 60%);
  --color-primary-hover: hsl(217 91% 70%);
  --color-border: hsl(217 33% 25%);

  --card-bg: hsl(222 47% 15%);
  --card-border: hsl(217 33% 25%);
}
```

```css
/* Card.module.css — Uses theme tokens */
.root {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--card-radius);
  padding: var(--card-padding);
  /* Dark mode is automatic via token redefinition — no special selectors needed */
}

.title {
  color: var(--color-on-surface);
  font-size: 1.25rem;
  font-weight: 600;
}
```

---

## 9. Comparison with Other Approaches

```
┌──────────────────┬────────────┬─────────────┬────────────┬──────────────┐
│                  │ CSS Modules│ Tailwind    │ CSS-in-JS  │ Global CSS   │
├──────────────────┼────────────┼─────────────┼────────────┼──────────────┤
│ Scoping          │ Automatic  │ None (utils)│ Automatic  │ Manual (BEM) │
│ Runtime cost     │ Zero       │ Zero        │ ~12KB+     │ Zero         │
│ Type safety      │ Plugin/gen │ Plugin      │ Built-in   │ None         │
│ Co-location      │ Separate   │ In JSX      │ In JS      │ Separate     │
│ Dynamic styles   │ CSS vars   │ Conditional │ JS values  │ CSS vars     │
│ Learning curve   │ Low        │ Medium      │ Medium     │ Low          │
│ Refactoring      │ Easy       │ Easy        │ Very easy  │ Hard         │
│ Dead code detect │ Moderate   │ Automatic   │ Easy       │ Hard         │
│ SSR              │ Trivial    │ Trivial     │ Complex    │ Trivial      │
│ RSC compatible   │ Yes        │ Yes         │ Partial    │ Yes          │
│ Build size       │ Varies     │ Small       │ Varies     │ Large        │
└──────────────────┴────────────┴─────────────┴────────────┴──────────────┘
```

---

## 10. Anti-Patterns

```
CSS MODULES ANTI-PATTERNS — NEVER DO THESE:

1. Using :global() everywhere
   BAD:  :global(.my-component) { ... }
   GOOD: .myComponent { ... }
   WHY:  Defeats the entire purpose of CSS Modules

2. Deep nesting that creates specificity issues
   BAD:  .root .list .item .content .title { ... }
   GOOD: .title { ... }  (flat selectors — module scope handles isolation)

3. Not using CSS variables for theming
   BAD:  .root { background: #ffffff; } /* How does this support dark mode? */
   GOOD: .root { background: var(--color-surface); }

4. Importing styles but not using them (dead CSS)
   BAD:  import styles from './Old.module.css'; // styles.unused is never referenced
   GOOD: Remove unused CSS module classes (use typed modules to detect)

5. String concatenation for class names
   BAD:  className={styles.root + ' ' + (active ? styles.active : '')}
   GOOD: className={cn(styles.root, active && styles.active)}

6. Mixing BEM with CSS Modules
   BAD:  .card__header--active { ... }
   GOOD: .headerActive { ... } or .header[data-active] { ... }
   WHY:  CSS Modules already provides scoping — BEM is redundant

7. Putting media queries in separate files
   BAD:  Card.module.css + Card.responsive.module.css
   GOOD: Media queries inside Card.module.css with the relevant selectors

8. Using element selectors in modules
   BAD:  .root p { ... }  (affects all <p> descendants)
   GOOD: .bodyText { ... } (explicit class for styled elements)

9. Dynamically generating class names
   BAD:  styles[`variant${type}`]  (hard to type-check, may fail)
   GOOD: const variantMap = { primary: styles.primary, secondary: styles.secondary }

10. Not configuring localsConvention
    BAD:  styles['my-class-name'] everywhere
    GOOD: Configure camelCaseOnly and use styles.myClassName
```

---

## 11. Decision Criteria: When to Choose CSS Modules

```
CHOOSE CSS MODULES WHEN:
├── Building a component library (strong isolation guarantees)
├── Team is comfortable with traditional CSS
├── SSR/RSC compatibility is required with zero runtime
├── Migrating from global CSS (least disruptive transition)
├── Using Next.js (first-class support, no config needed)
├── Need to integrate with existing CSS architecture
├── Want to use standard CSS features (nesting, @layer, etc.)
└── Performance is critical (no runtime overhead)

AVOID CSS MODULES WHEN:
├── Team prefers utility-first approach (use Tailwind)
├── Need highly dynamic styles based on props (use CSS-in-JS)
├── Building a design system that needs TypeScript-driven tokens
├── Very small project where global CSS is sufficient
└── Heavy animation needs (CSS-in-JS may be more ergonomic)
```
