# CSS-in-JS — Complete Specification

> **AI Plugin Directive:** When choosing a CSS-in-JS solution, migrating between styling approaches, evaluating runtime vs build-time tradeoffs, or implementing server-side rendering with styles, ALWAYS consult this guide. Apply these patterns to select the right CSS-in-JS library for your constraints. This guide covers styled-components, Emotion, Panda CSS, Vanilla Extract, runtime vs zero-runtime tradeoffs, SSR, and migration strategies.

**Core Rule: For NEW projects in 2024+, PREFER zero-runtime CSS-in-JS (Vanilla Extract, Panda CSS) or utility-first CSS (Tailwind) over runtime CSS-in-JS (styled-components, Emotion). Runtime CSS-in-JS is INCOMPATIBLE with React Server Components and adds 8-15KB+ to client bundles. NEVER use runtime CSS-in-JS in performance-critical applications without understanding the rendering overhead. If you MUST use runtime CSS-in-JS, prefer Emotion over styled-components for smaller bundle size.**

---

## 1. CSS-in-JS Landscape

```
                    CSS-IN-JS SPECTRUM

  RUNTIME ◄──────────────────────────────────────────► ZERO-RUNTIME

  styled-components    Emotion    Stitches*   Panda CSS    Vanilla Extract
  │                    │          │           │            │
  │  Full runtime      │  Full    │  Near-    │  Build-    │  Build-time
  │  Style injection   │  runtime │  zero     │  time      │  only
  │  at render time    │  + css   │  runtime  │  extraction│  Type-safe
  │  ~12KB gzipped     │  prop    │  (EOL)    │  CSS output│  CSS output
  │                    │  ~7KB    │           │  Atomic    │
  │                    │  gzipped │           │            │

  * Stitches is end-of-life (unmaintained since 2023)

  ┌─────────────────────────────────────────────────────────┐
  │  DECISION: Runtime or Zero-Runtime?                      │
  │                                                         │
  │  Use RUNTIME when:                                      │
  │  ├── Existing codebase already uses it                  │
  │  ├── Need truly dynamic styles from JS values           │
  │  ├── NOT using React Server Components                  │
  │  └── Small app where bundle size isn't critical         │
  │                                                         │
  │  Use ZERO-RUNTIME when:                                 │
  │  ├── New project (2024+)                                │
  │  ├── Using React Server Components                      │
  │  ├── Performance is important                           │
  │  ├── SSR is required                                    │
  │  └── Want type safety in styles                         │
  └─────────────────────────────────────────────────────────┘
```

---

## 2. styled-components

```
                    styled-components ARCHITECTURE

  ┌─────────────────┐    ┌──────────────────┐    ┌──────────────┐
  │ Tagged Template  │───▶│ Style Processing │───▶│ <style> tag  │
  │ Literal          │    │ (at runtime)     │    │ injection    │
  │ styled.div`...`  │    │ - Parse CSS      │    │ into <head>  │
  │                  │    │ - Generate hash  │    │              │
  │                  │    │ - Vendor prefix  │    │ .sc-abc123 { │
  │                  │    │ - Handle props   │    │   color: red;│
  │                  │    └──────────────────┘    │ }            │
  └─────────────────┘                             └──────────────┘

  Runtime cost:
  ├── Bundle: ~12.7KB gzipped
  ├── Serialization: CSS parsed from template literal every render
  ├── Injection: <style> tag created/updated in DOM
  ├── Hydration: Must match server-generated styles
  └── Re-render: Styles recalculated when props change
```

### 2.1 styled-components Patterns

```tsx
import styled, { css, keyframes, ThemeProvider } from 'styled-components';

// ─── Basic Styled Component ───
const Card = styled.div`
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
`;

// ─── Props-Based Styling ───
interface ButtonProps {
  $variant?: 'primary' | 'secondary' | 'destructive';
  $size?: 'sm' | 'md' | 'lg';
  $fullWidth?: boolean;
}

const Button = styled.button<ButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  border: none;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;

  /* Transient props (prefixed with $) are NOT passed to DOM */
  ${({ $fullWidth }) => $fullWidth && 'width: 100%;'}

  /* Size variants */
  ${({ $size = 'md' }) => {
    const sizes = {
      sm: css`height: 2rem; padding: 0 0.75rem; font-size: 0.875rem;`,
      md: css`height: 2.5rem; padding: 0 1rem; font-size: 0.875rem;`,
      lg: css`height: 3rem; padding: 0 1.5rem; font-size: 1rem;`,
    };
    return sizes[$size];
  }}

  /* Color variants */
  ${({ $variant = 'primary', theme }) => {
    const variants = {
      primary: css`
        background: ${theme.colors.primary};
        color: white;
        &:hover { background: ${theme.colors.primaryHover}; }
      `,
      secondary: css`
        background: ${theme.colors.secondary};
        color: ${theme.colors.onSecondary};
        &:hover { background: ${theme.colors.secondaryHover}; }
      `,
      destructive: css`
        background: ${theme.colors.destructive};
        color: white;
        &:hover { background: ${theme.colors.destructiveHover}; }
      `,
    };
    return variants[$variant];
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// ─── Extending Styles ───
const IconButton = styled(Button)`
  padding: 0;
  width: ${({ $size = 'md' }) => {
    const sizes = { sm: '2rem', md: '2.5rem', lg: '3rem' };
    return sizes[$size];
  }};
`;

// ─── Animations ───
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const AnimatedCard = styled(Card)`
  animation: ${fadeIn} 0.3s ease-out;
`;

// ─── css Helper for Conditional Blocks ───
const inputFocusStyles = css`
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;

const Input = styled.input`
  padding: 0.5rem 0.75rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  ${inputFocusStyles}
`;

// ─── attrs for Default Props ───
const SubmitButton = styled(Button).attrs({
  type: 'submit',
  $variant: 'primary',
})`
  min-width: 120px;
`;

// ─── Theme Provider ───
const theme = {
  colors: {
    primary: 'hsl(221, 83%, 53%)',
    primaryHover: 'hsl(221, 83%, 46%)',
    secondary: 'hsl(210, 40%, 96%)',
    secondaryHover: 'hsl(210, 40%, 90%)',
    onSecondary: 'hsl(222, 47%, 11%)',
    destructive: 'hsl(0, 84%, 60%)',
    destructiveHover: 'hsl(0, 84%, 50%)',
    surface: 'hsl(0, 0%, 100%)',
    border: 'hsl(214, 32%, 91%)',
  },
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Card>
        <Button $variant="primary" $size="lg">Save</Button>
      </Card>
    </ThemeProvider>
  );
}
```

### 2.2 SSR with styled-components

```tsx
// CRITICAL: styled-components requires SSR setup to avoid FOUC

// Next.js App Router — lib/registry.tsx
'use client';

import { useState } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { ServerStyleSheet, StyleSheetManager } from 'styled-components';

export function StyledComponentsRegistry({ children }: { children: React.ReactNode }) {
  const [styledComponentsStyleSheet] = useState(() => new ServerStyleSheet());

  useServerInsertedHTML(() => {
    const styles = styledComponentsStyleSheet.getStyleTags();
    styledComponentsStyleSheet.instance.clearTag();
    return <>{styles}</>;
  });

  if (typeof window !== 'undefined') return <>{children}</>;

  return (
    <StyleSheetManager sheet={styledComponentsStyleSheet.instance}>
      {children}
    </StyleSheetManager>
  );
}

// app/layout.tsx
import { StyledComponentsRegistry } from '@/lib/registry';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
      </body>
    </html>
  );
}
```

---

## 3. Emotion

```
                    EMOTION APPROACHES

  Approach 1: @emotion/styled (like styled-components)
  ├── styled.div`...`
  ├── Props-based dynamic styles
  └── ThemeProvider for theming

  Approach 2: @emotion/react css prop
  ├── css={{ color: 'red' }}  or  css={css`color: red;`}
  ├── More flexible — no wrapper components
  ├── Requires JSX pragma or Babel plugin
  └── Slightly smaller bundle (~7KB vs ~12KB)

  KEY DIFFERENCE from styled-components:
  ├── Smaller runtime (~7.1KB vs ~12.7KB gzipped)
  ├── css prop approach (no wrapper components)
  ├── Source maps are more reliable
  ├── Better SSR performance
  └── @emotion/css works without React
```

### 3.1 Emotion Patterns

```tsx
/** @jsxImportSource @emotion/react */
import { css, SerializedStyles } from '@emotion/react';
import styled from '@emotion/styled';

// ─── css Prop Approach (preferred for Emotion) ───
function Card({ elevated = false }: { elevated?: boolean }) {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        padding: 1.5rem;
        border-radius: 12px;
        background: var(--color-surface);
        ${elevated && 'box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);'}
      `}
    >
      <h2
        css={css`
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-on-surface);
        `}
      >
        Title
      </h2>
    </div>
  );
}

// ─── Object Styles ───
const containerStyles = css({
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '0 1rem',
  '@media (min-width: 768px)': {
    padding: '0 2rem',
  },
});

// ─── Composition (Emotion's strength) ───
const baseButton = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
`;

const primaryButton = css`
  ${baseButton}
  background: var(--color-primary);
  color: white;
  &:hover {
    background: var(--color-primary-hover);
  }
`;

// ─── Emotion styled (identical API to styled-components) ───
const Grid = styled.div<{ $columns?: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $columns = 3 }) => $columns}, 1fr);
  gap: 1.5rem;
`;
```

### 3.2 Emotion SSR (Next.js)

```tsx
// Emotion has better Next.js support than styled-components
// @emotion/react works with App Router when configured properly

// next.config.js
module.exports = {
  compiler: {
    emotion: true, // SWC-based emotion transform (fast)
  },
};

// For App Router, similar registry pattern:
'use client';

import { CacheProvider } from '@emotion/react';
import createEmotionCache from '@emotion/cache';
import { useServerInsertedHTML } from 'next/navigation';
import { useState } from 'react';

export function EmotionRegistry({ children }: { children: React.ReactNode }) {
  const [cache] = useState(() => {
    const cache = createEmotionCache({ key: 'css' });
    cache.compat = true;
    return cache;
  });

  useServerInsertedHTML(() => {
    const entries = Object.entries(cache.inserted);
    if (entries.length === 0) return null;

    const names: string[] = [];
    let styles = '';
    for (const [name, style] of entries) {
      if (typeof style === 'string') {
        names.push(name);
        styles += style;
      }
    }

    return (
      <style
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
```

---

## 4. Panda CSS (Zero-Runtime)

```
                    PANDA CSS ARCHITECTURE

  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
  │ TypeScript    │───▶│ Build-Time       │───▶│ Static CSS   │
  │ Style Calls  │    │ Analysis         │    │ Output       │
  │ css({...})   │    │ (AST extraction) │    │ (atomic)     │
  │ cva({...})   │    │ No runtime       │    │              │
  └──────────────┘    └──────────────────┘    └──────────────┘

  KEY FEATURES:
  ├── Type-safe style functions
  ├── Design token system built-in
  ├── Atomic CSS output (like Tailwind)
  ├── Zero runtime (styles extracted at build time)
  ├── Recipes (like cva but built-in)
  ├── Compatible with RSC
  ├── CSS-in-JS DX with zero-runtime performance
  └── Works with any framework (React, Vue, Svelte, Solid)
```

### 4.1 Panda CSS Setup and Usage

```typescript
// panda.config.ts
import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{js,jsx,ts,tsx}'],
  exclude: [],

  theme: {
    extend: {
      tokens: {
        colors: {
          brand: {
            50: { value: '#eff6ff' },
            500: { value: '#3b82f6' },
            600: { value: '#2563eb' },
            900: { value: '#1e3a5f' },
          },
        },
        fonts: {
          sans: { value: 'Inter, system-ui, sans-serif' },
        },
      },
      semanticTokens: {
        colors: {
          surface: {
            value: { base: '{colors.white}', _dark: '{colors.gray.900}' },
          },
          'on-surface': {
            value: { base: '{colors.gray.900}', _dark: '{colors.gray.50}' },
          },
          primary: {
            value: { base: '{colors.brand.500}', _dark: '{colors.brand.400}' },
          },
        },
      },
      recipes: {
        button: {
          className: 'btn',
          base: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'medium',
            borderRadius: 'lg',
            cursor: 'pointer',
            transition: 'all 0.2s',
          },
          variants: {
            variant: {
              primary: {
                bg: 'primary',
                color: 'white',
                _hover: { bg: 'brand.600' },
              },
              secondary: {
                bg: 'gray.100',
                color: 'gray.900',
                _hover: { bg: 'gray.200' },
              },
            },
            size: {
              sm: { h: '8', px: '3', fontSize: 'sm' },
              md: { h: '10', px: '4', fontSize: 'sm' },
              lg: { h: '12', px: '6', fontSize: 'md' },
            },
          },
          defaultVariants: {
            variant: 'primary',
            size: 'md',
          },
        },
      },
    },
  },

  outdir: 'styled-system',
});
```

```tsx
// Using Panda CSS in components
import { css } from '../styled-system/css';
import { button } from '../styled-system/recipes';

// ─── css() Function (Inline Styles) ───
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        p: '6',
        rounded: 'xl',
        bg: 'surface',
        shadow: 'sm',
        _hover: {
          shadow: 'md',
        },
        // Responsive styles
        md: {
          p: '8',
          flexDirection: 'row',
        },
      })}
    >
      {children}
    </div>
  );
}

// ─── Recipe (Variant-Based Components) ───
function Button({ variant, size, children, ...props }: ButtonProps) {
  return (
    <button className={button({ variant, size })} {...props}>
      {children}
    </button>
  );
}

// ─── Patterns (Layout Primitives) ───
import { stack, hstack, center, grid } from '../styled-system/patterns';

function Layout() {
  return (
    <div className={stack({ gap: '4', direction: 'column' })}>
      <div className={hstack({ gap: '2', justify: 'space-between' })}>
        <h1>Title</h1>
        <Button variant="primary">Action</Button>
      </div>
      <div className={grid({ columns: 3, gap: '6' })}>
        {/* Grid items */}
      </div>
    </div>
  );
}
```

---

## 5. Vanilla Extract

```
                    VANILLA EXTRACT ARCHITECTURE

  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
  │ TypeScript    │───▶│ Build-Time       │───▶│ Static CSS   │
  │ .css.ts files │    │ Compilation      │    │ Files        │
  │ style({...}) │    │ (esbuild/Vite)   │    │ .css         │
  │              │    │ Executes TS      │    │              │
  └──────────────┘    └──────────────────┘    └──────────────┘

  KEY FEATURES:
  ├── Full TypeScript — styles ARE TypeScript files
  ├── Type-safe CSS properties (catches typos at build time)
  ├── Zero runtime — all CSS extracted to static .css files
  ├── Sprinkles — build your own utility system (like type-safe Tailwind)
  ├── Recipes — variant-based component styling
  ├── Themes — type-safe theme contracts
  ├── Compatible with RSC, SSR, any framework
  └── Built on CSS Modules under the hood
```

### 5.1 Vanilla Extract Core API

```typescript
// Button.css.ts
import { style, styleVariants, globalStyle } from '@vanilla-extract/css';
import { recipe, RecipeVariants } from '@vanilla-extract/recipes';
import { vars } from './theme.css';

// ─── style() — Single Class ───
export const root = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 500,
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  ':hover': {
    transform: 'translateY(-1px)',
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
    transform: 'none',
  },
  // Responsive
  '@media': {
    '(min-width: 768px)': {
      fontSize: '1rem',
    },
  },
  // Selectors
  selectors: {
    '&:focus-visible': {
      outline: `2px solid ${vars.color.primary}`,
      outlineOffset: '2px',
    },
    // Target descendants
    [`${root} > svg`]: {
      width: 20,
      height: 20,
    },
  },
});

// ─── styleVariants() — Map of Classes ───
export const size = styleVariants({
  sm: { height: 32, padding: '0 12px', fontSize: 14 },
  md: { height: 40, padding: '0 16px', fontSize: 14 },
  lg: { height: 48, padding: '0 24px', fontSize: 16 },
});

export const variant = styleVariants({
  primary: {
    background: vars.color.primary,
    color: 'white',
    ':hover': { background: vars.color.primaryHover },
  },
  secondary: {
    background: vars.color.secondary,
    color: vars.color.onSecondary,
    ':hover': { background: vars.color.secondaryHover },
  },
  ghost: {
    background: 'transparent',
    color: vars.color.onSurface,
    ':hover': { background: vars.color.surfaceHover },
  },
});

// ─── recipe() — Variant-Based (combines variants) ───
export const button = recipe({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 500,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  variants: {
    variant: {
      primary: {
        background: vars.color.primary,
        color: 'white',
      },
      secondary: {
        background: vars.color.secondary,
        color: vars.color.onSecondary,
      },
    },
    size: {
      sm: { height: 32, padding: '0 12px', fontSize: 14 },
      md: { height: 40, padding: '0 16px', fontSize: 14 },
      lg: { height: 48, padding: '0 24px', fontSize: 16 },
    },
  },
  compoundVariants: [
    {
      variants: { variant: 'primary', size: 'lg' },
      style: { fontWeight: 600 },
    },
  ],
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

export type ButtonVariants = RecipeVariants<typeof button>;
```

### 5.2 Vanilla Extract Themes

```typescript
// theme.css.ts
import { createTheme, createThemeContract } from '@vanilla-extract/css';

// ─── Theme Contract (type-safe token structure) ───
export const vars = createThemeContract({
  color: {
    primary: null,
    primaryHover: null,
    secondary: null,
    secondaryHover: null,
    onSecondary: null,
    surface: null,
    surfaceHover: null,
    onSurface: null,
    border: null,
  },
  space: {
    xs: null,
    sm: null,
    md: null,
    lg: null,
    xl: null,
  },
  font: {
    body: null,
    heading: null,
  },
  radius: {
    sm: null,
    md: null,
    lg: null,
    full: null,
  },
});

// ─── Light Theme ───
export const lightTheme = createTheme(vars, {
  color: {
    primary: 'hsl(221, 83%, 53%)',
    primaryHover: 'hsl(221, 83%, 46%)',
    secondary: 'hsl(210, 40%, 96%)',
    secondaryHover: 'hsl(210, 40%, 90%)',
    onSecondary: 'hsl(222, 47%, 11%)',
    surface: 'hsl(0, 0%, 100%)',
    surfaceHover: 'hsl(210, 40%, 98%)',
    onSurface: 'hsl(222, 47%, 11%)',
    border: 'hsl(214, 32%, 91%)',
  },
  space: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  font: {
    body: 'Inter, system-ui, sans-serif',
    heading: 'Cal Sans, Inter, system-ui, sans-serif',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  },
});

// ─── Dark Theme ───
export const darkTheme = createTheme(vars, {
  color: {
    primary: 'hsl(217, 91%, 60%)',
    primaryHover: 'hsl(217, 91%, 70%)',
    secondary: 'hsl(217, 33%, 20%)',
    secondaryHover: 'hsl(217, 33%, 25%)',
    onSecondary: 'hsl(210, 40%, 98%)',
    surface: 'hsl(222, 47%, 11%)',
    surfaceHover: 'hsl(222, 47%, 15%)',
    onSurface: 'hsl(210, 40%, 98%)',
    border: 'hsl(217, 33%, 25%)',
  },
  space: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  font: {
    body: 'Inter, system-ui, sans-serif',
    heading: 'Cal Sans, Inter, system-ui, sans-serif',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  },
});
```

### 5.3 Vanilla Extract Sprinkles (Type-Safe Utilities)

```typescript
// sprinkles.css.ts
import { defineProperties, createSprinkles } from '@vanilla-extract/sprinkles';
import { vars } from './theme.css';

const responsiveProperties = defineProperties({
  conditions: {
    mobile: {},
    tablet: { '@media': 'screen and (min-width: 768px)' },
    desktop: { '@media': 'screen and (min-width: 1024px)' },
  },
  defaultCondition: 'mobile',
  properties: {
    display: ['none', 'flex', 'block', 'inline', 'grid'],
    flexDirection: ['row', 'column'],
    alignItems: ['stretch', 'flex-start', 'center', 'flex-end'],
    justifyContent: ['stretch', 'flex-start', 'center', 'flex-end', 'space-between'],
    gap: vars.space,
    padding: vars.space,
    paddingTop: vars.space,
    paddingBottom: vars.space,
    paddingLeft: vars.space,
    paddingRight: vars.space,
    margin: vars.space,
    width: ['100%', 'auto'],
    fontSize: {
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    textAlign: ['left', 'center', 'right'],
    borderRadius: vars.radius,
  },
  shorthands: {
    p: ['padding'],
    px: ['paddingLeft', 'paddingRight'],
    py: ['paddingTop', 'paddingBottom'],
    placeItems: ['alignItems', 'justifyContent'],
  },
});

const colorProperties = defineProperties({
  conditions: {
    lightMode: {},
    darkMode: { '@media': '(prefers-color-scheme: dark)' },
  },
  defaultCondition: 'lightMode',
  properties: {
    color: vars.color,
    background: vars.color,
    borderColor: vars.color,
  },
});

export const sprinkles = createSprinkles(responsiveProperties, colorProperties);
export type Sprinkles = Parameters<typeof sprinkles>[0];
```

```tsx
// Using sprinkles in a component
import { sprinkles } from './sprinkles.css';

function Container({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={sprinkles({
        display: 'flex',
        flexDirection: 'column',
        gap: 'md',
        p: 'lg',
        // Responsive
        tablet: { flexDirection: 'row', gap: 'xl' },
        desktop: { p: 'xl' },
        // Type-safe — IDE autocompletes token names
        background: 'surface',
        color: 'onSurface',
      })}
    >
      {children}
    </div>
  );
}
```

---

## 6. Runtime vs Zero-Runtime Comparison

```
┌─────────────────────┬──────────────────┬──────────────────┬──────────────────┐
│                     │ Runtime          │ Near-Zero        │ Zero-Runtime     │
│                     │ (SC, Emotion)    │ (Panda CSS)      │ (Vanilla Extract)│
├─────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ JS bundle impact    │ 7-13KB+ gzipped  │ <1KB             │ 0KB              │
│ CSS generation      │ At render time   │ Build time       │ Build time       │
│ Dynamic styles      │ Full (any JS)    │ Limited (tokens) │ Theme vars only  │
│ Type safety         │ Via TS generics  │ Full (codegen)   │ Full (TS files)  │
│ SSR complexity      │ High (registry)  │ None             │ None             │
│ RSC compatible      │ No               │ Yes              │ Yes              │
│ FOUC risk           │ Yes (without SSR)│ No               │ No               │
│ Style dedup         │ Partial          │ Atomic CSS       │ CSS Modules      │
│ Caching             │ Per-component    │ Static files     │ Static files     │
│ Debugging           │ Generated names  │ Generated names  │ Generated names  │
│ Render performance  │ Overhead on      │ No overhead      │ No overhead      │
│                     │ each render      │                  │                  │
│ Learning curve      │ Low              │ Medium           │ Medium-High      │
│ Ecosystem           │ Huge             │ Growing          │ Moderate         │
│ Hot reload          │ Fast             │ Fast             │ Moderate         │
│ Critical CSS        │ Auto (SSR)       │ Manual           │ Manual           │
└─────────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

---

## 7. Performance Implications

```
                    PERFORMANCE COMPARISON

  Runtime CSS-in-JS (styled-components/Emotion):
  ┌──────────────────────────────────────────────────────┐
  │  1. Parse template literal → CSS string              │
  │  2. Hash CSS → generate unique class name            │
  │  3. Check if style already injected                  │
  │  4. If new: inject <style> tag into <head>           │
  │  5. Return class name for React to apply             │
  │                                                      │
  │  This happens EVERY RENDER if props change.           │
  │  For static styles, result is cached after first render.│
  │                                                      │
  │  Cost per dynamic styled component:                   │
  │  ~0.1ms parse + ~0.01ms hash + ~0.05ms inject        │
  │  = ~0.16ms per unique style                          │
  │                                                      │
  │  With 100 styled components on a page:               │
  │  ~16ms initial render overhead (blocks paint)        │
  │  + 12KB runtime JavaScript                           │
  └──────────────────────────────────────────────────────┘

  Zero-Runtime (Vanilla Extract / Panda CSS):
  ┌──────────────────────────────────────────────────────┐
  │  1. Build: Extract styles to static .css files       │
  │  2. Runtime: Just apply class names (strings)        │
  │  3. No style parsing, hashing, or injection          │
  │                                                      │
  │  Cost per component: 0ms (just string concatenation) │
  │  CSS loaded by browser like any static stylesheet    │
  │  Full browser caching of CSS files                   │
  └──────────────────────────────────────────────────────┘

  BENCHMARK GUIDELINES:
  ├── <50 styled components per page   → Runtime is acceptable
  ├── 50-200 styled components per page → Consider zero-runtime
  ├── >200 styled components per page  → MUST use zero-runtime or utilities
  ├── Frequent re-renders with dynamic props → AVOID runtime CSS-in-JS
  └── Static styles that rarely change → Runtime overhead is cached, acceptable
```

---

## 8. Migration: Runtime to Zero-Runtime

```
                    MIGRATION STRATEGY

  styled-components / Emotion → Panda CSS or Vanilla Extract

  Phase 1: Inventory
  ├── Count styled components in codebase
  ├── Identify dynamic vs static styles
  ├── Catalog theme tokens used
  └── List third-party styled dependencies

  Phase 2: Parallel Architecture
  ├── Set up zero-runtime tool alongside runtime
  ├── Configure theme tokens to match existing theme
  ├── Create utility/sprinkles layer matching common patterns
  └── Both systems can coexist during migration

  Phase 3: Incremental Migration
  ├── New components use zero-runtime
  ├── Migrate leaf components first (fewest dependents)
  ├── Migrate shared components last (most dependents)
  ├── Convert static styles first, then dynamic
  └── Run A/B performance tests during migration

  Phase 4: Cleanup
  ├── Remove runtime CSS-in-JS dependency
  ├── Remove SSR style registry
  ├── Remove ThemeProvider if using CSS vars now
  └── Verify no styled-components imports remain
```

```tsx
// BEFORE: styled-components
const Card = styled.div<{ $elevated: boolean }>`
  padding: 1.5rem;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.surface};
  ${({ $elevated }) => $elevated && 'box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);'}
`;

// AFTER: Panda CSS
import { css } from '../styled-system/css';

function Card({ elevated, children }: { elevated?: boolean; children: React.ReactNode }) {
  return (
    <div className={css({
      p: '6',
      rounded: 'xl',
      bg: 'surface',
      shadow: elevated ? 'lg' : 'sm',
    })}>
      {children}
    </div>
  );
}

// AFTER: Vanilla Extract
import { card, cardElevated } from './Card.css';
import clsx from 'clsx';

function Card({ elevated, children }: { elevated?: boolean; children: React.ReactNode }) {
  return (
    <div className={clsx(card, elevated && cardElevated)}>
      {children}
    </div>
  );
}
```

---

## 9. Anti-Patterns

```
CSS-IN-JS ANTI-PATTERNS — NEVER DO THESE:

1. Using runtime CSS-in-JS in React Server Components
   BAD:  styled.div`...` in a server component
   GOOD: CSS Modules, Tailwind, or zero-runtime CSS-in-JS
   WHY:  Runtime CSS-in-JS requires React context (client-only)

2. Creating styled components inside render functions
   BAD:  function App() { const Box = styled.div`...`; return <Box />; }
   GOOD: Define styled components OUTSIDE components (module scope)
   WHY:  Creates new component on every render, destroying React reconciliation

3. Excessive dynamic styles based on props
   BAD:  background: ${({ width }) => `hsl(${width}, 80%, 50%)`}
   GOOD: Use CSS custom properties: style={{ '--width': width }}
   WHY:  CSS custom properties change without re-injecting styles

4. Not using transient props ($prefix) in styled-components
   BAD:  <Button variant="primary" /> (variant passed to DOM)
   GOOD: <Button $variant="primary" /> ($variant filtered out)
   WHY:  Prevents "unknown prop" warnings in DOM

5. Deeply nesting styled components
   BAD:  const A = styled.div`${B} { ... } ${C} { ... }` (cross-references)
   GOOD: Flat component structure with explicit class names
   WHY:  Circular dependencies and poor readability

6. Using runtime CSS-in-JS for static styles
   BAD:  styled.div`display: flex; padding: 1rem;` (never changes)
   GOOD: CSS Modules or static class for unchanging styles
   WHY:  Unnecessary runtime overhead for something CSS can handle

7. Not extracting shared theme constants
   BAD:  Hardcoding colors/spacing in every styled component
   GOOD: Use ThemeProvider or CSS custom properties
   WHY:  Theme inconsistency and maintenance burden

8. Mixing multiple CSS-in-JS solutions
   BAD:  Some components use Emotion, others use styled-components
   GOOD: Pick one and standardize
   WHY:  Multiple runtimes = multiple bundles, conflicting <style> tags

9. Not SSR-configuring runtime CSS-in-JS
   BAD:  Deploying styled-components without ServerStyleSheet
   GOOD: Implement proper SSR style extraction
   WHY:  Flash of unstyled content (FOUC) on initial load

10. Ignoring build-time alternatives for new projects
    BAD:  Starting a new Next.js 14+ project with styled-components
    GOOD: Use Tailwind, CSS Modules, Panda CSS, or Vanilla Extract
    WHY:  RSC incompatibility and unnecessary runtime overhead
```

---

## 10. Decision Criteria

```
CHOOSE styled-components/Emotion WHEN:
├── Existing codebase already uses it (migration cost > benefit)
├── NOT using React Server Components
├── Team is very familiar with the API
├── App is small with few styled components (<50 per page)
└── Need full dynamic styles from JavaScript values

CHOOSE Panda CSS WHEN:
├── Starting a new project (2024+)
├── Want CSS-in-JS developer experience with zero runtime
├── Using React Server Components
├── Want built-in design token system
├── Coming from Tailwind and want more type safety
└── Need atomic CSS output for small bundle size

CHOOSE Vanilla Extract WHEN:
├── Want maximum type safety in styles
├── Building a design system or component library
├── Need theme contracts (typed theme switching)
├── Want to build a custom utility system (Sprinkles)
├── Performance is critical (zero runtime, static CSS)
└── Team is comfortable with TypeScript-heavy approaches

CHOOSE Tailwind or CSS Modules INSTEAD WHEN:
├── Don't need CSS-in-JS patterns at all
├── Want simplest possible setup
├── Team prefers utility-first (Tailwind) or traditional CSS (Modules)
└── RSC + zero config is the priority
```
