# Tailwind CSS — Complete Specification

> **AI Plugin Directive:** When implementing styling with Tailwind CSS, configuring themes, building component libraries, or optimizing CSS output, ALWAYS consult this guide. Apply these utility-first patterns to maintain consistent, performant, and maintainable styling. This guide covers Tailwind v3 and v4, configuration, theming, plugins, responsive design, dark mode, class sorting, and performance optimization.

**Core Rule: Tailwind is a utility-first CSS framework. ALWAYS compose styles from utility classes directly in markup. NEVER default to @apply unless extracting a truly reusable component class. ALWAYS configure design tokens in the theme — NEVER use arbitrary values for tokens that appear more than once. Use responsive prefixes mobile-first (sm:, md:, lg:). ALWAYS run purging in production — unused utilities MUST be stripped.**

---

## 1. Utility-First Methodology

```
                    UTILITY-FIRST vs TRADITIONAL CSS

  TRADITIONAL (Semantic CSS):
  ┌─────────────────────────────────────────────────────────┐
  │  .card { display: flex; padding: 1rem; ... }            │
  │  .card-title { font-size: 1.25rem; font-weight: 700; } │
  │  .card-body { margin-top: 0.5rem; ... }                 │
  │                                                         │
  │  Problem: Naming fatigue, CSS bloat, specificity wars   │
  └─────────────────────────────────────────────────────────┘

  UTILITY-FIRST (Tailwind):
  ┌─────────────────────────────────────────────────────────┐
  │  <div class="flex p-4 rounded-lg shadow-md">            │
  │    <h2 class="text-xl font-bold">Title</h2>             │
  │    <p class="mt-2 text-gray-600">Body</p>               │
  │  </div>                                                  │
  │                                                          │
  │  Benefit: No naming, no context-switching, co-location  │
  └─────────────────────────────────────────────────────────┘

  WHEN TO USE UTILITY-FIRST:
  ├── Application UI (dashboards, forms, layouts)     → ALWAYS
  ├── Marketing pages with unique designs             → ALWAYS
  ├── Component libraries (reusable across projects)  → SOMETIMES (combine with component extraction)
  └── Email templates                                 → NEVER (email clients don't support)

  WHEN TO EXTRACT COMPONENTS:
  ├── Pattern repeats 3+ times in the same file       → Extract React/Vue component
  ├── Pattern repeats across files                    → Extract shared component
  ├── Long class lists (15+ utilities)                → Consider component extraction
  └── Third-party HTML you can't add classes to       → Use @apply in CSS
```

### 1.1 The Utility Workflow

```tsx
// GOOD — Utilities composed directly in JSX
function UserCard({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      <img
        src={user.avatar}
        alt={user.name}
        className="h-12 w-12 rounded-full object-cover ring-2 ring-blue-500"
      />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
          {user.name}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
      </div>
    </div>
  );
}

// BAD — Creating a CSS file for every component
// styles/UserCard.css
// .user-card { display: flex; align-items: center; ... }
// .user-card__avatar { height: 3rem; width: 3rem; ... }
// This creates naming burden and CSS bloat
```

---

## 2. Configuration (tailwind.config.ts)

```
                    CONFIGURATION HIERARCHY

  ┌─────────────────────────────────────────────┐
  │  tailwind.config.ts                          │
  │  │                                           │
  │  ├── content ──── File paths to scan         │
  │  │                for class usage             │
  │  │                                           │
  │  ├── theme                                   │
  │  │   ├── extend ── ADD to defaults           │
  │  │   └── (root) ── REPLACE defaults          │
  │  │                                           │
  │  ├── plugins ──── Custom utilities/components│
  │  │                                           │
  │  ├── presets ──── Shared configurations       │
  │  │                                           │
  │  └── corePlugins ── Enable/disable built-in  │
  └─────────────────────────────────────────────┘

  CRITICAL: theme.extend ADDS to defaults.
            theme (without extend) REPLACES defaults entirely.
            ALWAYS use extend unless you want to remove default values.
```

### 2.1 Complete Configuration Template (Tailwind v3)

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  // ─── Content Scanning ───
  // MUST include ALL files that use Tailwind classes
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    // Include packages in monorepos
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
    // Include content collections
    './content/**/*.{md,mdx}',
  ],

  // ─── Dark Mode Strategy ───
  // 'media' — OS preference (prefers-color-scheme)
  // 'class'  — Manual toggle via class on <html>
  // 'selector' — (v3.4+) uses CSS :where() selector
  darkMode: 'class',

  // ─── Theme Configuration ───
  theme: {
    // EXTEND adds to defaults (preferred)
    extend: {
      // Custom colors — use CSS custom properties for theming
      colors: {
        brand: {
          50: 'hsl(var(--brand-50) / <alpha-value>)',
          100: 'hsl(var(--brand-100) / <alpha-value>)',
          200: 'hsl(var(--brand-200) / <alpha-value>)',
          300: 'hsl(var(--brand-300) / <alpha-value>)',
          400: 'hsl(var(--brand-400) / <alpha-value>)',
          500: 'hsl(var(--brand-500) / <alpha-value>)',
          600: 'hsl(var(--brand-600) / <alpha-value>)',
          700: 'hsl(var(--brand-700) / <alpha-value>)',
          800: 'hsl(var(--brand-800) / <alpha-value>)',
          900: 'hsl(var(--brand-900) / <alpha-value>)',
          950: 'hsl(var(--brand-950) / <alpha-value>)',
        },
        // Semantic color tokens
        surface: 'hsl(var(--color-surface) / <alpha-value>)',
        'on-surface': 'hsl(var(--color-on-surface) / <alpha-value>)',
        primary: 'hsl(var(--color-primary) / <alpha-value>)',
        'on-primary': 'hsl(var(--color-on-primary) / <alpha-value>)',
      },

      // Typography scale
      fontFamily: {
        sans: ['Inter var', ...defaultTheme.fontFamily.sans],
        mono: ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
        display: ['Cal Sans', ...defaultTheme.fontFamily.sans],
      },

      fontSize: {
        // [fontSize, { lineHeight, letterSpacing, fontWeight }]
        'display-2xl': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg': ['3rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
      },

      // Spacing (extends default 0-96 scale)
      spacing: {
        '4.5': '1.125rem',
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },

      // Border radius
      borderRadius: {
        '4xl': '2rem',
      },

      // Animations
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
      },

      // Custom screens (adds to default sm/md/lg/xl/2xl)
      screens: {
        'xs': '475px',
        '3xl': '1920px',
      },

      // Z-index scale
      zIndex: {
        'dropdown': '1000',
        'sticky': '1020',
        'modal-backdrop': '1040',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
        'toast': '1080',
      },

      // Box shadow
      boxShadow: {
        'inner-sm': 'inset 0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'elevation-1': '0 1px 3px rgb(0 0 0 / 0.12), 0 1px 2px rgb(0 0 0 / 0.08)',
        'elevation-2': '0 3px 6px rgb(0 0 0 / 0.15), 0 2px 4px rgb(0 0 0 / 0.1)',
        'elevation-3': '0 10px 20px rgb(0 0 0 / 0.15), 0 3px 6px rgb(0 0 0 / 0.1)',
      },

      // Container queries
      containers: {
        'card': '20rem',
        'sidebar': '16rem',
      },
    },

    // ─── REPLACING defaults (use sparingly) ───
    // This completely overrides the default breakpoints:
    // screens: {
    //   'sm': '640px',
    //   'md': '768px',
    //   'lg': '1024px',
    //   'xl': '1280px',
    // },
  },

  // ─── Plugins ───
  plugins: [
    // Official plugins
    require('@tailwindcss/typography'),    // Prose styling for markdown
    require('@tailwindcss/forms'),         // Form element resets
    require('@tailwindcss/container-queries'), // @container support (v3)
    require('@tailwindcss/aspect-ratio'),  // aspect-ratio (legacy browsers)

    // Custom plugin
    plugin(function ({ addUtilities, addComponents, matchUtilities, theme }) {
      // Custom utilities
      addUtilities({
        '.text-balance': {
          'text-wrap': 'balance',
        },
        '.text-pretty': {
          'text-wrap': 'pretty',
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      });

      // Dynamic utilities with values
      matchUtilities(
        {
          'grid-cols-fill': (value) => ({
            gridTemplateColumns: `repeat(auto-fill, minmax(${value}, 1fr))`,
          }),
          'grid-cols-fit': (value) => ({
            gridTemplateColumns: `repeat(auto-fit, minmax(${value}, 1fr))`,
          }),
        },
        { values: theme('spacing') }
      );
    }),
  ],

  // ─── Safelist ───
  // Force-include classes that are dynamically generated
  safelist: [
    // Pattern-based
    {
      pattern: /bg-(red|green|blue|yellow)-(100|200|500)/,
      variants: ['hover', 'dark'],
    },
    // String-based
    'animate-fade-in',
  ],
};

export default config;
```

---

## 3. Arbitrary Values and Bracket Notation

```
                    ARBITRARY VALUE SYNTAX

  Standard utility:     text-lg          ← From theme
  Arbitrary value:      text-[22px]      ← One-off value
  Arbitrary property:   [mask-type:alpha] ← No utility exists
  CSS variable:         text-[var(--my-size)]
  Calc expression:      w-[calc(100%-2rem)]
  Theme function:       p-[theme('spacing.4')]

  RULES:
  ├── Use arbitrary values ONLY for true one-offs
  ├── If you use the same arbitrary value 3+ times → ADD to theme
  ├── NEVER use arbitrary values for brand colors
  ├── Spaces in arbitrary values use underscores: grid-cols-[1fr_2fr_1fr]
  └── Arbitrary variants: [&>svg]:w-5  [&:nth-child(3)]:bg-red-500
```

```tsx
// Arbitrary values — acceptable use cases
<div className="
  top-[117px]                         // One-off positioning
  grid-cols-[1fr_minmax(0,2fr)_1fr]  // Complex grid that's not reusable
  bg-[#1da1f2]                        // Third-party brand color (Twitter blue)
  text-[clamp(1rem,2.5vw,2rem)]       // Fluid typography
  [mask-image:linear-gradient(to_bottom,black,transparent)]  // No utility exists
  before:content-['Hello']            // Pseudo-element content
  supports-[display:grid]:grid        // @supports query
  group-[.is-active]:bg-blue-500      // Arbitrary group variant
"/>

// BAD — Arbitrary values that should be in theme
// NEVER: bg-[#3b82f6] when this is your brand blue → put in theme
// NEVER: text-[14px] text-[16px] text-[18px] → use the type scale
// NEVER: p-[13px] → use spacing scale (p-3 is 12px, p-3.5 is 14px)
```

---

## 4. Responsive Prefixes (Mobile-First)

```
                    BREAKPOINT SYSTEM (Mobile-First)

  Default breakpoints:
  ┌──────────┬──────────┬──────────────────────────────┐
  │ Prefix   │ min-width│ Target                        │
  ├──────────┼──────────┼──────────────────────────────┤
  │ (none)   │ 0px      │ Mobile (base styles)          │
  │ sm:      │ 640px    │ Large phones / small tablets   │
  │ md:      │ 768px    │ Tablets                        │
  │ lg:      │ 1024px   │ Laptops                        │
  │ xl:      │ 1280px   │ Desktops                       │
  │ 2xl:     │ 1536px   │ Large desktops                 │
  └──────────┴──────────┴──────────────────────────────┘

  MOBILE-FIRST RULE:
  ├── Base styles (no prefix) apply to ALL screen sizes
  ├── Prefixed styles apply at that breakpoint AND UP
  ├── ALWAYS design for mobile first, then add breakpoints
  └── Read class lists left-to-right as screen gets wider

  Example reading:
  className="w-full md:w-1/2 lg:w-1/3"
  ├── Mobile:  w-full   (100% width)
  ├── Tablet:  w-1/2    (50% width)
  └── Desktop: w-1/3    (33% width)
```

```tsx
// Responsive layout pattern
function ResponsiveGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="
      grid
      grid-cols-1          // Mobile: single column
      gap-4                // Mobile: small gap
      sm:grid-cols-2       // Small: 2 columns
      sm:gap-6             // Small: medium gap
      lg:grid-cols-3       // Large: 3 columns
      xl:grid-cols-4       // XL: 4 columns
      xl:gap-8             // XL: large gap
    ">
      {children}
    </div>
  );
}

// Responsive typography
<h1 className="
  text-2xl               // Mobile: 24px
  sm:text-3xl            // Small: 30px
  md:text-4xl            // Medium: 36px
  lg:text-5xl            // Large: 48px
  font-bold
  leading-tight          // Tight line height at all sizes
  lg:leading-none        // Even tighter at large sizes
">

// Responsive hiding/showing
<nav className="hidden md:flex">        // Hidden on mobile, flex on md+
<button className="md:hidden">Menu</button>  // Visible only on mobile

// Max-width breakpoints (when needed)
// Use arbitrary values: max-md: max-lg: etc. (v3.4+)
<div className="max-md:hidden">Only shows on md and above</div>

// Range breakpoints (v3.4+)
<div className="md:max-lg:text-center">Only centered between md and lg</div>
```

---

## 5. Dark Mode Strategies

```
                    DARK MODE APPROACHES

  ┌─────────────────────────────────────────────────────────────┐
  │  Strategy 1: 'media' (OS Preference)                        │
  │  ├── Uses @media (prefers-color-scheme: dark)               │
  │  ├── Automatic — respects OS setting                        │
  │  ├── No JavaScript needed                                   │
  │  └── User CANNOT override per-site                          │
  │                                                             │
  │  Strategy 2: 'class' (Manual Toggle)                        │
  │  ├── Requires class="dark" on <html>                        │
  │  ├── Requires JavaScript to toggle                          │
  │  ├── User CAN override per-site                             │
  │  ├── Can persist preference in localStorage                 │
  │  └── RECOMMENDED for most applications                      │
  │                                                             │
  │  Strategy 3: 'selector' (v3.4+)                             │
  │  ├── Uses .dark selector wrapped in :where()                │
  │  ├── Does not increase specificity                          │
  │  └── Better for complex selector scenarios                  │
  └─────────────────────────────────────────────────────────────┘
```

```tsx
// Dark mode toggle implementation
'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

function useTheme() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) {
      setTheme(stored);
      applyTheme(stored);
    }
  }, []);

  function applyTheme(newTheme: Theme) {
    const root = document.documentElement;
    const isDark =
      newTheme === 'dark' ||
      (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    root.classList.toggle('dark', isDark);
    // Prevent flash: set color-scheme for native elements
    root.style.colorScheme = isDark ? 'dark' : 'light';
  }

  function changeTheme(newTheme: Theme) {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  }

  return { theme, changeTheme };
}

// Prevent flash of wrong theme (add to <head> as inline script)
const THEME_SCRIPT = `
  (function() {
    var theme = localStorage.getItem('theme');
    var isDark = theme === 'dark' ||
      (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  })();
`;

// Using dark: prefix in components
function Card() {
  return (
    <div className="
      bg-white text-gray-900 border-gray-200
      dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700
      border rounded-lg p-6 shadow-sm
      dark:shadow-gray-900/20
    ">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        Title
      </h2>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Description text
      </p>
    </div>
  );
}

// BEST PRACTICE: Use CSS variables for theme colors
// This reduces dark: prefix repetition significantly
// In your global CSS:
// @layer base {
//   :root {
//     --color-surface: 0 0% 100%;        /* white */
//     --color-on-surface: 222 47% 11%;    /* gray-900 */
//   }
//   .dark {
//     --color-surface: 222 47% 11%;       /* gray-900 */
//     --color-on-surface: 210 40% 98%;    /* gray-50 */
//   }
// }
//
// Then in Tailwind: bg-surface text-on-surface
// No dark: prefix needed — CSS variables handle it
```

---

## 6. @apply Usage (When and Why)

```
                    @apply DECISION TREE

  Need to style something?
  │
  ├── Can you add classes to the element?
  │   ├── YES → Use utility classes directly. DO NOT use @apply.
  │   └── NO → Is it third-party HTML you can't modify?
  │       ├── YES → @apply is acceptable
  │       └── NO → Reconsider your architecture
  │
  ├── Are you creating a base layer style?
  │   ├── YES → @apply in @layer base is acceptable
  │   └── NO → Continue
  │
  ├── Is it a complex animation or pseudo-element?
  │   ├── YES → @apply can simplify this
  │   └── NO → Continue
  │
  └── Is it a truly atomic, reusable CSS class?
      ├── YES → Consider @apply (but prefer component extraction)
      └── NO → DO NOT use @apply. Extract a component instead.

  ANTI-PATTERN:
  .btn { @apply px-4 py-2 rounded font-medium; }
  ↑ This defeats the purpose of Tailwind. Just make a <Button> component.
```

```css
/* ACCEPTABLE @apply uses */

/* Base layer resets and defaults */
@layer base {
  h1 {
    @apply text-3xl font-bold tracking-tight;
  }

  /* Styling third-party components you can't add classes to */
  .markdown-body h2 {
    @apply mt-8 mb-4 text-2xl font-semibold border-b border-gray-200 pb-2;
  }

  .markdown-body a {
    @apply text-blue-600 underline hover:text-blue-800 dark:text-blue-400;
  }

  /* Focus-visible reset */
  [type='text']:focus,
  [type='email']:focus,
  select:focus {
    @apply ring-2 ring-blue-500 ring-offset-2 outline-none;
  }
}

/* Complex pseudo-elements that are hard to express with utilities alone */
@layer utilities {
  .gradient-text {
    @apply bg-clip-text text-transparent;
    @apply bg-gradient-to-r from-blue-600 to-purple-600;
  }
}

/* BAD — These should be React/Vue components, not CSS */
/* .card { @apply flex rounded-lg p-4 shadow-md bg-white; }           */
/* .btn-primary { @apply px-4 py-2 bg-blue-600 text-white rounded; }  */
/* .sidebar { @apply fixed left-0 top-0 h-screen w-64 bg-gray-50; }  */
```

---

## 7. Component Extraction Patterns

```
                    COMPONENT EXTRACTION STRATEGIES

  Strategy 1: Framework Components (PREFERRED)
  ┌────────────────────────────────────────────┐
  │  Extract a React/Vue/Svelte component      │
  │  Keep utilities in the component's JSX      │
  │  Pass variants via props                    │
  │  Use cva() or tailwind-variants for types   │
  └────────────────────────────────────────────┘

  Strategy 2: @apply in CSS (LAST RESORT)
  ┌────────────────────────────────────────────┐
  │  Use ONLY for elements you can't control    │
  │  Third-party HTML, CMS content, etc.        │
  └────────────────────────────────────────────┘
```

### 7.1 Class Variance Authority (cva)

```tsx
// components/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base styles (always applied)
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500 dark:bg-gray-800 dark:text-gray-100',
        destructive: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
        ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800',
        link: 'text-blue-600 underline-offset-4 hover:underline',
        outline: 'border border-gray-300 bg-transparent hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-lg',
        icon: 'h-10 w-10',
      },
    },
    compoundVariants: [
      // When destructive + large, increase font weight
      {
        variant: 'destructive',
        size: ['lg', 'xl'],
        className: 'font-semibold',
      },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

// The cn() utility — ALWAYS use for conditional class merging
// Uses clsx + tailwind-merge
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage
<Button variant="primary" size="lg">Save</Button>
<Button variant="destructive" size="sm">Delete</Button>
<Button variant="ghost" size="icon"><TrashIcon /></Button>
<Button className="w-full mt-4">Full Width</Button>  // cn() merges correctly
```

---

## 8. Tailwind v4 Changes

```
                    TAILWIND v3 → v4 MIGRATION

  ┌────────────────────────────────────────────────────────────────┐
  │  MAJOR CHANGES IN v4:                                          │
  │                                                                │
  │  1. CSS-FIRST CONFIGURATION                                    │
  │     ├── No more tailwind.config.ts (optional, for compat)      │
  │     ├── Configure directly in CSS with @theme                  │
  │     └── @import "tailwindcss"                                  │
  │                                                                │
  │  2. NEW ENGINE                                                 │
  │     ├── Oxide engine (Rust-based, replaces JIT)                │
  │     ├── 10x faster full builds                                 │
  │     ├── Lightning CSS for parsing (replaces PostCSS)           │
  │     └── Built-in @import handling                              │
  │                                                                │
  │  3. AUTOMATIC CONTENT DETECTION                                │
  │     ├── No more content[] config                               │
  │     ├── Scans project automatically                            │
  │     └── Uses heuristics to find template files                 │
  │                                                                │
  │  4. CSS-NATIVE FEATURES                                        │
  │     ├── Native @layer, @property                               │
  │     ├── CSS nesting (no plugin needed)                         │
  │     ├── color-mix() for opacity modifiers                      │
  │     └── Wide gamut colors (oklch)                              │
  │                                                                │
  │  5. COMPOSABLE VARIANTS                                        │
  │     ├── group-* and peer-* work with any variant               │
  │     ├── not-* variant                                          │
  │     └── Stacked variants: hover:focus:text-blue-500            │
  │                                                                │
  │  6. RENAMED/CHANGED UTILITIES                                  │
  │     ├── shadow-sm → shadow-xs, shadow → shadow-sm              │
  │     ├── blur-sm → blur-xs, blur → blur-sm                     │
  │     ├── ring → ring-3 (ring is now 1px)                       │
  │     ├── rounded-sm → rounded-xs, rounded → rounded-sm         │
  │     └── New: inset-shadow-*, inset-ring-*                      │
  └────────────────────────────────────────────────────────────────┘
```

### 8.1 Tailwind v4 CSS-First Configuration

```css
/* app.css — Tailwind v4 configuration */

/* Single import replaces @tailwind directives */
@import "tailwindcss";

/* ─── Theme Configuration (replaces tailwind.config.ts) ─── */
@theme {
  /* Colors — use oklch for wide gamut */
  --color-brand-50: oklch(0.97 0.01 250);
  --color-brand-100: oklch(0.93 0.03 250);
  --color-brand-500: oklch(0.55 0.2 250);
  --color-brand-600: oklch(0.48 0.2 250);
  --color-brand-900: oklch(0.25 0.1 250);

  /* Semantic colors */
  --color-surface: var(--color-white);
  --color-on-surface: var(--color-gray-900);
  --color-primary: var(--color-brand-500);

  /* Fonts */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* Custom spacing */
  --spacing-4\.5: 1.125rem;
  --spacing-18: 4.5rem;

  /* Animation */
  --animate-fade-in: fade-in 0.3s ease-in-out;

  /* Breakpoints */
  --breakpoint-xs: 30rem;    /* 480px */
  --breakpoint-3xl: 120rem;  /* 1920px */
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ─── Dark Mode with CSS Variables ─── */
@layer base {
  :root {
    --color-surface: white;
    --color-on-surface: var(--color-gray-900);
  }

  .dark {
    --color-surface: var(--color-gray-900);
    --color-on-surface: var(--color-gray-50);
  }
}

/* ─── Plugins via CSS ─── */
@plugin "@tailwindcss/typography";
@plugin "@tailwindcss/forms";

/* ─── Source detection override (if needed) ─── */
@source "../components/**/*.tsx";
@source "../../packages/ui/src/**/*.tsx";
```

---

## 9. Class Sorting (prettier-plugin-tailwindcss)

```
                    CLASS SORTING ORDER

  Official Prettier plugin sorts classes in this order:
  ┌──────────────────────────────────────────────┐
  │ 1. Base utilities (layout, position)          │
  │ 2. Spacing (margin, padding)                  │
  │ 3. Sizing (width, height)                     │
  │ 4. Typography (font, text, leading)           │
  │ 5. Background                                 │
  │ 6. Border                                     │
  │ 7. Effects (shadow, opacity)                  │
  │ 8. Transitions                                │
  │ 9. Responsive variants (sm:, md:, lg:)        │
  │ 10. State variants (hover:, focus:)           │
  │ 11. Dark mode (dark:)                         │
  └──────────────────────────────────────────────┘

  Setup:
  npm install -D prettier-plugin-tailwindcss

  .prettierrc:
  {
    "plugins": ["prettier-plugin-tailwindcss"],
    "tailwindConfig": "./tailwind.config.ts",
    "tailwindFunctions": ["cn", "clsx", "cva", "tw"]
  }

  IMPORTANT:
  ├── This MUST be the last plugin in the plugins array
  ├── Works with cn(), clsx(), cva() via tailwindFunctions config
  └── Sorts classes in template literals, JSX, and CSS @apply
```

---

## 10. Performance and Purging

```
                    CSS OPTIMIZATION PIPELINE

  Development:
  ┌────────────────────────────────────────────┐
  │  JIT compiles ONLY used classes on-demand   │
  │  Dev CSS size: ~10-30KB (only what you use) │
  │  No purging needed in dev                   │
  └────────────────────────────────────────────┘

  Production:
  ┌────────────────────────────────────────────┐
  │  Content scanning → finds all class usage   │
  │  Generates ONLY used utilities              │
  │  Minification (cssnano / Lightning CSS)     │
  │  Production CSS: typically 5-15KB gzipped   │
  └────────────────────────────────────────────┘

  CONTENT SCANNING RULES:
  ├── Tailwind scans file CONTENTS as strings
  ├── It does NOT parse your code — it uses regex
  ├── Dynamic class names WILL BE MISSED:
  │   BAD:  className={`text-${color}-500`}    ← PURGED!
  │   GOOD: className={color === 'red' ? 'text-red-500' : 'text-blue-500'}
  ├── Safelist classes that MUST be generated dynamically
  └── Check production CSS with: npx tailwindcss --content ... --minify | wc -c

  COMMON PURGING FAILURES:
  ├── String interpolation in class names
  ├── Classes in files not included in content[]
  ├── Classes in node_modules packages (add to content[])
  ├── Classes generated by server-side logic
  └── Classes in CMS content loaded at runtime
```

```tsx
// SAFE dynamic class patterns
const colorMap = {
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
} as const;

function Alert({ type }: { type: keyof typeof colorMap }) {
  return <div className={cn('rounded-lg border p-4', colorMap[type])} />;
}
// GOOD: All class names are complete strings — scanner finds them

// UNSAFE dynamic patterns
function BadAlert({ color }: { color: string }) {
  // BAD: bg-${color}-100 will be purged because scanner
  // cannot resolve the variable
  return <div className={`bg-${color}-100 text-${color}-800`} />;
}
```

---

## 11. Comparison: Tailwind vs Alternatives

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│              │ Tailwind     │ CSS Modules  │ styled-comp  │ Vanilla Ext  │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Approach     │ Utility-first│ Scoped CSS   │ CSS-in-JS    │ Zero-runtime │
│ Scoping      │ Global utils │ Module scope │ Component    │ Build-time   │
│ Bundle size  │ ~5-15KB gz   │ Depends      │ ~12KB+ runtime│ 0KB runtime │
│ Type safety  │ Via plugins  │ typed-css-mod│ Full TS      │ Full TS      │
│ Dev speed    │ Very fast    │ Fast         │ Fast         │ Moderate     │
│ Learning     │ Moderate     │ Low          │ Low-Moderate │ Moderate     │
│ Customization│ Config-driven│ Standard CSS │ JS-driven    │ TS-driven    │
│ SSR          │ No issues    │ No issues    │ Requires setup│ No issues   │
│ RSC compat   │ Full         │ Full         │ Partial      │ Full         │
│ Ecosystem    │ Huge         │ Standard     │ Large        │ Growing      │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

---

## 12. Anti-Patterns

```
TAILWIND ANTI-PATTERNS — NEVER DO THESE:

1. String interpolation in class names
   BAD:  className={`text-${size}`}
   GOOD: className={sizeMap[size]}

2. Using @apply for everything
   BAD:  .btn { @apply px-4 py-2 bg-blue-600 text-white rounded; }
   GOOD: <Button> component with utilities in JSX

3. Not using the design system
   BAD:  className="p-[13px] text-[15px] text-[#336699]"
   GOOD: className="p-3 text-sm text-brand-600"

4. Overly long class strings without extraction
   BAD:  30+ utilities on a single element with no abstraction
   GOOD: Extract to a component or use cva()

5. Fighting Tailwind with custom CSS
   BAD:  Mixing Tailwind with large custom stylesheets
   GOOD: Configure Tailwind theme to match your design system

6. Not configuring content paths
   BAD:  Missing files in content[] → classes purged
   GOOD: Include ALL files that reference Tailwind classes

7. Using important! to override
   BAD:  className="!text-red-500" everywhere
   GOOD: Fix specificity issues with proper ordering or tailwind-merge

8. Not using prettier-plugin-tailwindcss
   BAD:  Inconsistent class ordering across the team
   GOOD: Auto-sort with prettier plugin

9. Ignoring responsive mobile-first
   BAD:  className="lg:hidden block"  (redundant — block is default)
   GOOD: className="lg:hidden"        (hidden at lg+, visible below)

10. Not using CSS variables for theme switching
    BAD:  Repeating dark: prefix on every element
    GOOD: CSS variable theming with semantic color tokens
```

---

## 13. Decision Criteria: When to Choose Tailwind

```
CHOOSE TAILWIND WHEN:
├── Building application UI (dashboards, SaaS, admin panels)
├── Team size > 2 (consistent utility vocabulary)
├── Rapid prototyping needed
├── Design system has defined tokens (configure in theme)
├── Using React/Vue/Svelte (component model maps well)
├── Using Next.js, Nuxt, SvelteKit (first-class support)
└── Performance is important (small CSS bundles)

AVOID TAILWIND WHEN:
├── Email template development
├── Legacy jQuery projects with no component model
├── Team strongly prefers semantic CSS
├── Project has extensive existing CSS architecture
├── Building a CSS-only library (no JS framework)
└── CMS-rendered content where you can't add classes
```
