# Design Tokens — Complete Specification

> **AI Plugin Directive:** When implementing design systems, configuring theme tokens, building dark/light mode, integrating with Figma, or setting up token pipelines, ALWAYS consult this guide. Apply these design token patterns to create consistent, maintainable, and scalable theming across platforms. This guide covers token hierarchy, W3C format, CSS custom properties, Style Dictionary, Tokens Studio, Figma integration, and multi-platform token delivery.

**Core Rule: Design tokens MUST follow a three-tier hierarchy: Primitive (raw values) → Semantic (purpose-driven aliases) → Component (specific to UI components). NEVER reference primitive tokens directly in components — ALWAYS go through semantic tokens. Use CSS custom properties as the delivery mechanism for web. ALWAYS define tokens in a platform-agnostic format (W3C DTCG or Style Dictionary) and generate platform-specific outputs.**

---

## 1. Token Hierarchy

```
                    THREE-TIER TOKEN ARCHITECTURE

  ┌──────────────────────────────────────────────────────────────┐
  │  TIER 1: PRIMITIVE TOKENS (Global / Reference)               │
  │  Raw design values — colors, sizes, fonts                    │
  │  Named by their value, NOT their purpose                     │
  │                                                              │
  │  Examples:                                                   │
  │  ├── color.blue.500 = #3b82f6                               │
  │  ├── color.gray.900 = #111827                                │
  │  ├── space.4 = 16px                                          │
  │  ├── font.size.16 = 16px                                     │
  │  ├── font.weight.600 = 600                                   │
  │  └── radius.8 = 8px                                          │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  TIER 2: SEMANTIC TOKENS (Alias / Decision)                  │
  │  Purpose-driven — describe WHAT the token does               │
  │  Reference primitive tokens                                  │
  │  Change per theme (light/dark/brand)                         │
  │                                                              │
  │  Examples:                                                   │
  │  ├── color.surface = {color.white}           → Light         │
  │  ├── color.surface = {color.gray.900}        → Dark          │
  │  ├── color.on-surface = {color.gray.900}     → Light         │
  │  ├── color.on-surface = {color.gray.50}      → Dark          │
  │  ├── color.primary = {color.blue.500}                        │
  │  ├── color.border = {color.gray.200}         → Light         │
  │  ├── space.section = {space.16}                              │
  │  └── font.size.body = {font.size.16}                         │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  TIER 3: COMPONENT TOKENS (Scoped)                           │
  │  Specific to a UI component                                  │
  │  Reference semantic tokens                                   │
  │  Enable component-level customization                        │
  │                                                              │
  │  Examples:                                                   │
  │  ├── button.bg = {color.primary}                             │
  │  ├── button.text = {color.on-primary}                        │
  │  ├── button.radius = {radius.md}                             │
  │  ├── button.padding-x = {space.4}                            │
  │  ├── card.bg = {color.surface}                               │
  │  ├── card.border = {color.border}                            │
  │  └── card.radius = {radius.lg}                               │
  └──────────────────────────────────────────────────────────────┘

  REFERENCING RULES:
  ├── Components → reference Semantic tokens (or Component tokens)
  ├── Semantic tokens → reference Primitive tokens
  ├── Primitive tokens → hardcoded values only
  ├── NEVER: Component → Primitive (skip semantic)
  ├── NEVER: Component → hardcoded value
  └── EXCEPTION: One-off values not in the system (use sparingly)
```

---

## 2. W3C Design Tokens Community Group (DTCG) Format

```
                    W3C DTCG TOKEN FORMAT

  The W3C Design Tokens specification defines a standard JSON format
  for representing design tokens across tools and platforms.

  File extension: .tokens.json or .tokens
  Status: Community Group Draft (adopted by Figma, Style Dictionary, etc.)
```

### 2.1 W3C DTCG Token File

```json
{
  "$name": "Acme Design System",
  "$description": "Design tokens for the Acme product suite",

  "color": {
    "$type": "color",

    "primitive": {
      "blue": {
        "50":  { "$value": "#eff6ff" },
        "100": { "$value": "#dbeafe" },
        "200": { "$value": "#bfdbfe" },
        "300": { "$value": "#93c5fd" },
        "400": { "$value": "#60a5fa" },
        "500": { "$value": "#3b82f6" },
        "600": { "$value": "#2563eb" },
        "700": { "$value": "#1d4ed8" },
        "800": { "$value": "#1e40af" },
        "900": { "$value": "#1e3a5f" },
        "950": { "$value": "#172554" }
      },
      "gray": {
        "50":  { "$value": "#f9fafb" },
        "100": { "$value": "#f3f4f6" },
        "200": { "$value": "#e5e7eb" },
        "300": { "$value": "#d1d5db" },
        "400": { "$value": "#9ca3af" },
        "500": { "$value": "#6b7280" },
        "600": { "$value": "#4b5563" },
        "700": { "$value": "#374151" },
        "800": { "$value": "#1f2937" },
        "900": { "$value": "#111827" },
        "950": { "$value": "#030712" }
      },
      "white": { "$value": "#ffffff" },
      "black": { "$value": "#000000" }
    },

    "semantic": {
      "surface": {
        "$value": "{color.primitive.white}",
        "$description": "Default background color"
      },
      "on-surface": {
        "$value": "{color.primitive.gray.900}",
        "$description": "Default text color on surface"
      },
      "on-surface-secondary": {
        "$value": "{color.primitive.gray.500}",
        "$description": "Secondary text color"
      },
      "primary": {
        "$value": "{color.primitive.blue.500}",
        "$description": "Primary brand action color"
      },
      "primary-hover": {
        "$value": "{color.primitive.blue.600}",
        "$description": "Primary color on hover"
      },
      "on-primary": {
        "$value": "{color.primitive.white}",
        "$description": "Text on primary color"
      },
      "border": {
        "$value": "{color.primitive.gray.200}",
        "$description": "Default border color"
      },
      "border-strong": {
        "$value": "{color.primitive.gray.300}",
        "$description": "Emphasized border color"
      },
      "destructive": {
        "$value": "#ef4444",
        "$description": "Destructive action color"
      },
      "success": {
        "$value": "#22c55e"
      },
      "warning": {
        "$value": "#f59e0b"
      }
    }
  },

  "space": {
    "$type": "dimension",
    "0":   { "$value": "0px" },
    "1":   { "$value": "4px" },
    "2":   { "$value": "8px" },
    "3":   { "$value": "12px" },
    "4":   { "$value": "16px" },
    "5":   { "$value": "20px" },
    "6":   { "$value": "24px" },
    "8":   { "$value": "32px" },
    "10":  { "$value": "40px" },
    "12":  { "$value": "48px" },
    "16":  { "$value": "64px" },
    "20":  { "$value": "80px" },
    "24":  { "$value": "96px" }
  },

  "font": {
    "family": {
      "$type": "fontFamily",
      "sans":    { "$value": ["Inter", "system-ui", "sans-serif"] },
      "mono":    { "$value": ["JetBrains Mono", "Consolas", "monospace"] },
      "display": { "$value": ["Cal Sans", "Inter", "system-ui", "sans-serif"] }
    },
    "size": {
      "$type": "dimension",
      "xs":   { "$value": "12px" },
      "sm":   { "$value": "14px" },
      "base": { "$value": "16px" },
      "lg":   { "$value": "18px" },
      "xl":   { "$value": "20px" },
      "2xl":  { "$value": "24px" },
      "3xl":  { "$value": "30px" },
      "4xl":  { "$value": "36px" },
      "5xl":  { "$value": "48px" }
    },
    "weight": {
      "$type": "fontWeight",
      "normal":   { "$value": 400 },
      "medium":   { "$value": 500 },
      "semibold": { "$value": 600 },
      "bold":     { "$value": 700 }
    },
    "lineHeight": {
      "$type": "number",
      "tight":  { "$value": 1.2 },
      "normal": { "$value": 1.5 },
      "loose":  { "$value": 1.75 }
    }
  },

  "radius": {
    "$type": "dimension",
    "none": { "$value": "0px" },
    "sm":   { "$value": "4px" },
    "md":   { "$value": "8px" },
    "lg":   { "$value": "12px" },
    "xl":   { "$value": "16px" },
    "2xl":  { "$value": "24px" },
    "full": { "$value": "9999px" }
  },

  "shadow": {
    "$type": "shadow",
    "sm": {
      "$value": {
        "offsetX": "0px",
        "offsetY": "1px",
        "blur": "2px",
        "spread": "0px",
        "color": "#0000000d"
      }
    },
    "md": {
      "$value": [
        {
          "offsetX": "0px",
          "offsetY": "4px",
          "blur": "6px",
          "spread": "-1px",
          "color": "#0000001a"
        },
        {
          "offsetX": "0px",
          "offsetY": "2px",
          "blur": "4px",
          "spread": "-2px",
          "color": "#0000001a"
        }
      ]
    }
  },

  "duration": {
    "$type": "duration",
    "fast":   { "$value": "150ms" },
    "normal": { "$value": "250ms" },
    "slow":   { "$value": "400ms" }
  }
}
```

---

## 3. CSS Custom Properties Implementation

```css
/* tokens.css — Generated from design tokens (or manually maintained) */

/* ═══ TIER 1: Primitive Tokens ═══ */
:root {
  /* Colors — Primitives */
  --color-blue-50: #eff6ff;
  --color-blue-100: #dbeafe;
  --color-blue-200: #bfdbfe;
  --color-blue-300: #93c5fd;
  --color-blue-400: #60a5fa;
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;
  --color-blue-700: #1d4ed8;
  --color-blue-800: #1e40af;
  --color-blue-900: #1e3a5f;

  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-300: #d1d5db;
  --color-gray-400: #9ca3af;
  --color-gray-500: #6b7280;
  --color-gray-600: #4b5563;
  --color-gray-700: #374151;
  --color-gray-800: #1f2937;
  --color-gray-900: #111827;

  /* Space — Primitives */
  --space-0: 0;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-20: 5rem;

  /* Font — Primitives */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', Consolas, monospace;

  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;
  --font-size-4xl: 2.25rem;

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Radius — Primitives */
  --radius-none: 0;
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;

  /* Duration — Primitives */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
}

/* ═══ TIER 2: Semantic Tokens ═══ */
:root {
  /* Surface colors */
  --color-surface: var(--color-white, #ffffff);
  --color-surface-secondary: var(--color-gray-50);
  --color-surface-hover: var(--color-gray-100);
  --color-on-surface: var(--color-gray-900);
  --color-on-surface-secondary: var(--color-gray-500);

  /* Brand / Primary */
  --color-primary: var(--color-blue-500);
  --color-primary-hover: var(--color-blue-600);
  --color-primary-subtle: var(--color-blue-50);
  --color-on-primary: #ffffff;

  /* Borders */
  --color-border: var(--color-gray-200);
  --color-border-strong: var(--color-gray-300);
  --color-border-focus: var(--color-blue-500);

  /* Status */
  --color-destructive: #ef4444;
  --color-destructive-hover: #dc2626;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-info: var(--color-blue-500);

  /* Typography semantic */
  --font-body: var(--font-sans);
  --font-heading: var(--font-sans);
  --font-code: var(--font-mono);
}

/* ═══ DARK THEME — Override Semantic Tokens ═══ */
.dark,
[data-theme="dark"] {
  --color-surface: var(--color-gray-900);
  --color-surface-secondary: var(--color-gray-800);
  --color-surface-hover: var(--color-gray-700);
  --color-on-surface: var(--color-gray-50);
  --color-on-surface-secondary: var(--color-gray-400);

  --color-primary: #60a5fa;
  --color-primary-hover: #93c5fd;
  --color-primary-subtle: hsl(217 91% 60% / 0.15);
  --color-on-primary: var(--color-gray-900);

  --color-border: var(--color-gray-700);
  --color-border-strong: var(--color-gray-600);
  --color-border-focus: #60a5fa;

  --color-destructive: #f87171;
  --color-destructive-hover: #fca5a5;
}

/* ═══ TIER 3: Component Tokens ═══ */
:root {
  /* Button */
  --button-bg: var(--color-primary);
  --button-bg-hover: var(--color-primary-hover);
  --button-text: var(--color-on-primary);
  --button-radius: var(--radius-lg);
  --button-padding-x: var(--space-4);
  --button-padding-y: var(--space-2);
  --button-font-size: var(--font-size-sm);
  --button-font-weight: var(--font-weight-medium);

  /* Card */
  --card-bg: var(--color-surface);
  --card-border: var(--color-border);
  --card-radius: var(--radius-xl);
  --card-padding: var(--space-6);
  --card-shadow: 0 1px 3px rgb(0 0 0 / 0.1);

  /* Input */
  --input-bg: var(--color-surface);
  --input-border: var(--color-border);
  --input-border-focus: var(--color-border-focus);
  --input-text: var(--color-on-surface);
  --input-placeholder: var(--color-on-surface-secondary);
  --input-radius: var(--radius-md);
  --input-padding-x: var(--space-3);
  --input-padding-y: var(--space-2);
}
```

### 3.1 Using Tokens in Components

```css
/* Button.module.css */
.root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);

  background: var(--button-bg);
  color: var(--button-text);
  border-radius: var(--button-radius);
  padding: var(--button-padding-y) var(--button-padding-x);
  font-size: var(--button-font-size);
  font-weight: var(--button-font-weight);
  font-family: var(--font-body);

  border: none;
  cursor: pointer;
  transition: background var(--duration-fast) ease;
}

.root:hover {
  background: var(--button-bg-hover);
}

.root:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

/* Variants override component tokens */
.secondary {
  --button-bg: var(--color-surface-secondary);
  --button-bg-hover: var(--color-surface-hover);
  --button-text: var(--color-on-surface);
}

.destructive {
  --button-bg: var(--color-destructive);
  --button-bg-hover: var(--color-destructive-hover);
  --button-text: white;
}

.ghost {
  --button-bg: transparent;
  --button-bg-hover: var(--color-surface-hover);
  --button-text: var(--color-on-surface);
}
```

---

## 4. Dark/Light Mode with Tokens

```
                    THEME SWITCHING ARCHITECTURE

  ┌─────────────────────────────────────────────────────────┐
  │  Strategy 1: CSS Class Toggle                            │
  │  ├── .dark class on <html> or <body>                    │
  │  ├── Redefine semantic tokens under .dark               │
  │  ├── Requires JavaScript for toggle                     │
  │  ├── Can persist in localStorage                        │
  │  └── RECOMMENDED: Most flexible                         │
  │                                                         │
  │  Strategy 2: data-theme Attribute                        │
  │  ├── data-theme="dark" on <html>                        │
  │  ├── [data-theme="dark"] { ... }                        │
  │  ├── Supports multiple themes (not just dark/light)     │
  │  └── RECOMMENDED: If you have 3+ themes                 │
  │                                                         │
  │  Strategy 3: prefers-color-scheme Only                   │
  │  ├── @media (prefers-color-scheme: dark) { ... }        │
  │  ├── No JavaScript needed                               │
  │  ├── Cannot override per-site                           │
  │  └── Use as fallback or for simple sites                │
  └─────────────────────────────────────────────────────────┘
```

```typescript
// Multi-theme system
type ThemeName = 'light' | 'dark' | 'dim' | 'high-contrast';

const themes: Record<ThemeName, Record<string, string>> = {
  light: {
    '--color-surface': '#ffffff',
    '--color-on-surface': '#111827',
    '--color-primary': '#3b82f6',
  },
  dark: {
    '--color-surface': '#111827',
    '--color-on-surface': '#f9fafb',
    '--color-primary': '#60a5fa',
  },
  dim: {
    '--color-surface': '#1a1a2e',
    '--color-on-surface': '#e0e0e0',
    '--color-primary': '#60a5fa',
  },
  'high-contrast': {
    '--color-surface': '#000000',
    '--color-on-surface': '#ffffff',
    '--color-primary': '#ffff00',
  },
};

function applyTheme(themeName: ThemeName) {
  const root = document.documentElement;
  const theme = themes[themeName];

  for (const [property, value] of Object.entries(theme)) {
    root.style.setProperty(property, value);
  }

  root.setAttribute('data-theme', themeName);
  localStorage.setItem('theme', themeName);
}
```

---

## 5. Style Dictionary

```
                    STYLE DICTIONARY PIPELINE

  ┌──────────────┐    ┌──────────────────┐    ┌───────────────────┐
  │ Token Source  │───▶│ Style Dictionary │───▶│ Platform Outputs   │
  │ (JSON/YAML)  │    │ (Transform +     │    │ ├── CSS variables  │
  │              │    │  Format)          │    │ ├── SCSS variables │
  │              │    │                  │    │ ├── iOS Swift      │
  │              │    │                  │    │ ├── Android XML    │
  │              │    │                  │    │ ├── JS/TS module   │
  └──────────────┘    └──────────────────┘    │ └── Figma tokens   │
                                              └───────────────────┘

  Style Dictionary is the most widely-used token transformation tool.
  It reads token definitions, applies transforms (name, value, attribute),
  and outputs formatted files for each platform.
```

### 5.1 Style Dictionary Configuration

```javascript
// style-dictionary.config.mjs
import StyleDictionary from 'style-dictionary';

// Custom transform: convert px to rem
StyleDictionary.registerTransform({
  name: 'size/pxToRem',
  type: 'value',
  filter: (token) => {
    return (
      token.$type === 'dimension' &&
      token.original.$value.endsWith('px') &&
      token.path[0] !== 'breakpoint'
    );
  },
  transform: (token) => {
    const px = parseFloat(token.original.$value);
    return `${px / 16}rem`;
  },
});

// Custom format: TypeScript constants
StyleDictionary.registerFormat({
  name: 'typescript/tokens',
  format: ({ dictionary }) => {
    const tokens = dictionary.allTokens.map(
      (token) => `  '${token.name}': '${token.value}'`
    );
    return `export const tokens = {\n${tokens.join(',\n')}\n} as const;\n\nexport type TokenName = keyof typeof tokens;\n`;
  },
});

export default {
  source: ['tokens/**/*.tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      transforms: ['size/pxToRem'],
      buildPath: 'src/styles/generated/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: {
            outputReferences: true, // Preserve token references
            selector: ':root',
          },
        },
      ],
    },
    cssDark: {
      transformGroup: 'css',
      transforms: ['size/pxToRem'],
      buildPath: 'src/styles/generated/',
      files: [
        {
          destination: 'tokens-dark.css',
          format: 'css/variables',
          filter: (token) => token.filePath.includes('dark'),
          options: {
            outputReferences: true,
            selector: '.dark, [data-theme="dark"]',
          },
        },
      ],
    },
    scss: {
      transformGroup: 'scss',
      buildPath: 'src/styles/generated/',
      files: [
        {
          destination: '_tokens.scss',
          format: 'scss/variables',
        },
      ],
    },
    typescript: {
      transformGroup: 'js',
      buildPath: 'src/tokens/',
      files: [
        {
          destination: 'tokens.ts',
          format: 'typescript/tokens',
        },
        {
          destination: 'tokens.json',
          format: 'json/nested',
        },
      ],
    },
    tailwind: {
      transformGroup: 'js',
      buildPath: 'src/tokens/',
      files: [
        {
          destination: 'tailwind-tokens.cjs',
          format: 'javascript/module',
        },
      ],
    },
  },
};
```

### 5.2 Token Source Files

```
tokens/
├── color/
│   ├── primitive.tokens.json     ← Raw color palette
│   ├── semantic-light.tokens.json ← Light theme mappings
│   └── semantic-dark.tokens.json  ← Dark theme mappings
├── space/
│   └── space.tokens.json         ← Spacing scale
├── typography/
│   └── typography.tokens.json    ← Font families, sizes, weights
├── radius/
│   └── radius.tokens.json        ← Border radius values
├── shadow/
│   └── shadow.tokens.json        ← Box shadow values
└── component/
    ├── button.tokens.json         ← Button-specific tokens
    └── card.tokens.json           ← Card-specific tokens
```

---

## 6. Tokens Studio (Figma Plugin)

```
                    TOKENS STUDIO WORKFLOW

  ┌──────────┐    ┌──────────────────┐    ┌────────────────┐    ┌──────────┐
  │  Figma   │◄──▶│  Tokens Studio   │◄──▶│  Git Repo      │───▶│  Build   │
  │  Design  │    │  (Figma Plugin)  │    │  (JSON tokens) │    │  Pipeline│
  └──────────┘    └──────────────────┘    └────────────────┘    └──────────┘
       │                   │                      │                    │
       │  Apply tokens     │  Push/Pull           │  tokens.json      │  Style
       │  to layers        │  from Git            │                   │  Dictionary
       │                   │                      │                   │
       ▼                   ▼                      ▼                   ▼
  Figma components     Token management      Version control      CSS/JS/iOS/
  use token refs       UI in Figma           with branches       Android output

  TOKENS STUDIO FEATURES:
  ├── Create/edit tokens directly in Figma
  ├── Apply tokens to Figma layers
  ├── Sync tokens with Git (GitHub, GitLab, Azure DevOps)
  ├── Theme switching (light/dark) in Figma
  ├── Token sets (groups of tokens that can be toggled)
  ├── Math expressions in token values
  ├── Token references ({color.primary})
  ├── Multi-file token organization
  └── Pro: Token branching, review, and merge
```

### 6.1 Figma-to-Code Pipeline

```
RECOMMENDED PIPELINE:

1. DESIGNERS define tokens in Figma using Tokens Studio
   ├── Create primitive token set (colors, spacing, etc.)
   ├── Create semantic token sets (light, dark themes)
   └── Apply tokens to Figma components

2. TOKENS SYNC to Git repository
   ├── Tokens Studio pushes to tokens/ branch
   ├── PR review for token changes
   └── Merge to main triggers build

3. BUILD PIPELINE transforms tokens
   ├── Style Dictionary reads token JSON
   ├── Transforms run (px→rem, name formatting, etc.)
   └── Outputs generated for each platform

4. CODE CONSUMES generated files
   ├── CSS custom properties → imported in global CSS
   ├── TypeScript module → imported in components
   ├── Tailwind config → extends theme
   └── Mobile → Swift/Kotlin constants

ALTERNATIVE (WITHOUT TOKENS STUDIO):
├── Define tokens in JSON files manually
├── Designers reference tokens in a Storybook/docs site
├── Engineers maintain tokens as source of truth
└── Less overhead, more developer-controlled
```

---

## 7. Integrating Tokens with Tailwind CSS

```typescript
// tailwind.config.ts
import tokens from './src/tokens/tailwind-tokens.cjs';

export default {
  theme: {
    colors: {
      // Map token names to Tailwind color utilities
      surface: 'var(--color-surface)',
      'on-surface': 'var(--color-on-surface)',
      primary: {
        DEFAULT: 'var(--color-primary)',
        hover: 'var(--color-primary-hover)',
        subtle: 'var(--color-primary-subtle)',
      },
      border: {
        DEFAULT: 'var(--color-border)',
        strong: 'var(--color-border-strong)',
        focus: 'var(--color-border-focus)',
      },
      destructive: {
        DEFAULT: 'var(--color-destructive)',
        hover: 'var(--color-destructive-hover)',
      },
      // Include primitive palette for flexibility
      blue: tokens.color.primitive.blue,
      gray: tokens.color.primitive.gray,
    },
    spacing: tokens.space,
    borderRadius: tokens.radius,
    fontSize: tokens.font.size,
    fontWeight: tokens.font.weight,
    fontFamily: {
      sans: tokens.font.family.sans,
      mono: tokens.font.family.mono,
    },
  },
};
```

---

## 8. Comparison: Token Tools

```
┌────────────────────┬──────────────────┬──────────────────┬──────────────────┐
│                    │ Style Dictionary │ Tokens Studio    │ Manual CSS Vars  │
├────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Approach           │ Build pipeline   │ Figma plugin     │ Hand-coded       │
│ Source of truth    │ JSON files       │ Figma + Git      │ CSS files        │
│ Multi-platform     │ Yes (any)        │ Via export       │ Web only         │
│ Figma integration  │ Import/export    │ Native           │ Manual sync      │
│ Type safety        │ Custom formats   │ N/A              │ None             │
│ Theme support      │ Multiple outputs │ Token sets       │ CSS selectors    │
│ Learning curve     │ Medium           │ Low              │ Low              │
│ CI/CD integration  │ Excellent        │ Good (Git sync)  │ N/A              │
│ Team size          │ Medium-Large     │ Any              │ Small            │
│ Cost               │ Free (OSS)       │ Free + Pro tier  │ Free             │
└────────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

---

## 9. Anti-Patterns

```
DESIGN TOKEN ANTI-PATTERNS — NEVER DO THESE:

1. Referencing primitive tokens in components
   BAD:  color: var(--color-blue-500);  (in a component)
   GOOD: color: var(--color-primary);   (semantic token)
   WHY:  Primitive change breaks theme; semantic change is intentional

2. Hardcoding values instead of using tokens
   BAD:  padding: 16px; color: #3b82f6;
   GOOD: padding: var(--space-4); color: var(--color-primary);
   WHY:  Hardcoded values don't respond to theme changes

3. Too many token tiers (over-engineering)
   BAD:  primitive → alias → semantic → contextual → component → variant
   GOOD: primitive → semantic → component (3 tiers is sufficient)
   WHY:  More tiers = more indirection = harder to debug

4. Not having a primitive tier (under-engineering)
   BAD:  --color-primary: #3b82f6; (hardcoded in semantic)
   GOOD: --color-primary: var(--color-blue-500); (references primitive)
   WHY:  Can't reuse primitives or build alternative themes

5. Inconsistent naming conventions
   BAD:  --primary-color, --bgSurface, --text_on_surface
   GOOD: --color-primary, --color-surface, --color-on-surface
   WHY:  Consistent naming makes tokens discoverable and predictable

6. Not documenting token intent
   BAD:  --color-gray-200 (what is this for?)
   GOOD: --color-border: var(--color-gray-200); /* Default border color */
   WHY:  Semantic names communicate intent; documentation prevents misuse

7. Duplicating tokens across themes
   BAD:  Redefining all tokens in dark theme (even unchanged ones)
   GOOD: Only override tokens that change between themes
   WHY:  Maintenance burden; easy to miss updates

8. Not versioning tokens
   BAD:  Changing token values without changelog
   GOOD: Semantic versioning for token packages, changelogs for changes
   WHY:  Breaking changes to tokens affect every component

9. One massive token file
   BAD:  tokens.json with 500+ tokens in one file
   GOOD: Organized by category: color/, space/, typography/, component/
   WHY:  Unmanageable; hard to review changes; merge conflicts

10. Skipping component tokens for simple systems
    BAD:  Forcing component tokens when you only have 5 components
    GOOD: Start with primitive + semantic; add component tier when needed
    WHY:  Over-engineering for small systems; add complexity as you grow
```

---

## 10. Decision Criteria

```
CHOOSE STYLE DICTIONARY WHEN:
├── Multi-platform (web + iOS + Android)
├── Large design system with many consumers
├── Need automated pipeline (CI/CD)
├── Need custom transforms (px→rem, color format conversion)
└── Engineering-led token management

CHOOSE TOKENS STUDIO WHEN:
├── Design team actively manages tokens
├── Want Figma as primary token editor
├── Need designer-friendly token management
├── Want Git sync for token versioning
└── Small-medium team with close design-dev collaboration

CHOOSE MANUAL CSS CUSTOM PROPERTIES WHEN:
├── Small team or solo developer
├── Web-only project
├── Few tokens (<50)
├── Rapid prototyping
└── Don't need multi-platform output

TOKEN ARCHITECTURE BY PROJECT SIZE:
├── Small (1-3 devs): Manual CSS vars, 2 tiers (primitive + semantic)
├── Medium (4-10 devs): Style Dictionary, 3 tiers, Figma sync
├── Large (10+ devs): Full pipeline, Tokens Studio, 3 tiers, versioned packages
└── Enterprise: All of the above + multi-brand theming + governance
```
