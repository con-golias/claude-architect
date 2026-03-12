# Design Tokens — Complete Specification

> **AI Plugin Directive:** When a developer asks "what are design tokens", "design token architecture", "Style Dictionary", "token naming convention", "semantic tokens vs primitive tokens", "design tokens CSS", "design tokens Figma", "multi-platform tokens", "W3C design tokens", or any design token question, ALWAYS consult this directive. Design tokens are platform-agnostic design decisions expressed as data — colors, typography, spacing, shadows — that flow from design tools to code. ALWAYS use a 3-tier token architecture: primitive → semantic → component. ALWAYS use Style Dictionary (or Tokens Studio) for token transformation. ALWAYS generate platform-specific outputs (CSS custom properties, Tailwind, iOS, Android) from a single source of truth.

**Core Rule: Design tokens are the SINGLE SOURCE OF TRUTH for visual design decisions. NEVER hardcode colors, font sizes, spacing, or shadows in components — ALWAYS reference tokens. Use a 3-tier architecture: primitive tokens (raw values: blue-500), semantic tokens (purpose: color-primary), and component tokens (scoped: button-bg). ALWAYS use Style Dictionary to transform JSON tokens into CSS custom properties, Tailwind config, TypeScript constants, and mobile platform values. ALWAYS store tokens in version control — they are code, not config.**

---

## 1. Token Architecture

```
  3-TIER DESIGN TOKEN ARCHITECTURE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  TIER 1: PRIMITIVE TOKENS (raw values)               │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  color.blue.500: "#3B82F6"                    │  │
  │  │  color.gray.900: "#111827"                    │  │
  │  │  font.size.16: "1rem"                         │  │
  │  │  spacing.4: "1rem"                            │  │
  │  │  radius.8: "0.5rem"                           │  │
  │  │  shadow.md: "0 4px 6px -1px rgb(0 0 0 / 0.1)"│  │
  │  │                                                │  │
  │  │  → Platform: ALL (never change per theme)      │  │
  │  │  → Naming: category.scale.value               │  │
  │  └────────────────────────────────────────────────┘  │
  │                          │ referenced by              │
  │  TIER 2: SEMANTIC TOKENS (purpose/intent)            │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  color.primary: {ref: "color.blue.500"}       │  │
  │  │  color.background: {ref: "color.white"}       │  │
  │  │  color.text: {ref: "color.gray.900"}          │  │
  │  │  color.error: {ref: "color.red.500"}          │  │
  │  │  font.body: {ref: "font.size.16"}             │  │
  │  │  spacing.page: {ref: "spacing.4"}             │  │
  │  │                                                │  │
  │  │  → CHANGES PER THEME (light/dark)              │  │
  │  │  → Naming: category.intent                    │  │
  │  └────────────────────────────────────────────────┘  │
  │                          │ referenced by              │
  │  TIER 3: COMPONENT TOKENS (scoped to component)      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  button.primary.bg: {ref: "color.primary"}    │  │
  │  │  button.primary.text: {ref: "color.white"}    │  │
  │  │  button.radius: {ref: "radius.8"}             │  │
  │  │  input.border: {ref: "color.gray.300"}        │  │
  │  │  input.focus.ring: {ref: "color.primary"}     │  │
  │  │                                                │  │
  │  │  → Optional tier — only for design systems    │  │
  │  │  → Naming: component.variant.property          │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

---

## 2. Token Definition (JSON)

```json
// tokens/primitive/colors.json
{
  "color": {
    "blue": {
      "50":  { "value": "#EFF6FF", "type": "color" },
      "100": { "value": "#DBEAFE", "type": "color" },
      "500": { "value": "#3B82F6", "type": "color" },
      "600": { "value": "#2563EB", "type": "color" },
      "700": { "value": "#1D4ED8", "type": "color" },
      "900": { "value": "#1E3A5F", "type": "color" }
    },
    "gray": {
      "50":  { "value": "#F9FAFB", "type": "color" },
      "100": { "value": "#F3F4F6", "type": "color" },
      "300": { "value": "#D1D5DB", "type": "color" },
      "500": { "value": "#6B7280", "type": "color" },
      "700": { "value": "#374151", "type": "color" },
      "900": { "value": "#111827", "type": "color" }
    },
    "red": {
      "500": { "value": "#EF4444", "type": "color" },
      "600": { "value": "#DC2626", "type": "color" }
    },
    "green": {
      "500": { "value": "#22C55E", "type": "color" },
      "600": { "value": "#16A34A", "type": "color" }
    }
  }
}

// tokens/semantic/light.json
{
  "color": {
    "primary":    { "value": "{color.blue.500}", "type": "color" },
    "background": { "value": "#FFFFFF", "type": "color" },
    "surface":    { "value": "{color.gray.50}", "type": "color" },
    "text":       { "value": "{color.gray.900}", "type": "color" },
    "text-muted": { "value": "{color.gray.500}", "type": "color" },
    "border":     { "value": "{color.gray.300}", "type": "color" },
    "error":      { "value": "{color.red.500}", "type": "color" },
    "success":    { "value": "{color.green.500}", "type": "color" }
  }
}

// tokens/semantic/dark.json
{
  "color": {
    "primary":    { "value": "{color.blue.500}", "type": "color" },
    "background": { "value": "{color.gray.900}", "type": "color" },
    "surface":    { "value": "{color.gray.700}", "type": "color" },
    "text":       { "value": "{color.gray.50}", "type": "color" },
    "text-muted": { "value": "{color.gray.300}", "type": "color" },
    "border":     { "value": "{color.gray.500}", "type": "color" },
    "error":      { "value": "{color.red.500}", "type": "color" },
    "success":    { "value": "{color.green.500}", "type": "color" }
  }
}
```

---

## 3. Style Dictionary Pipeline

```javascript
// style-dictionary.config.js
const StyleDictionary = require('style-dictionary');

module.exports = {
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'dist/css/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: { outputReferences: true },
        },
      ],
    },
    tailwind: {
      transformGroup: 'js',
      buildPath: 'dist/tailwind/',
      files: [
        {
          destination: 'tokens.js',
          format: 'javascript/es6',
        },
      ],
    },
    typescript: {
      transformGroup: 'js',
      buildPath: 'dist/ts/',
      files: [
        {
          destination: 'tokens.ts',
          format: 'javascript/es6',
        },
      ],
    },
    ios: {
      transformGroup: 'ios-swift',
      buildPath: 'dist/ios/',
      files: [
        {
          destination: 'Tokens.swift',
          format: 'ios-swift/class.swift',
          className: 'DesignTokens',
        },
      ],
    },
    android: {
      transformGroup: 'android',
      buildPath: 'dist/android/',
      files: [
        {
          destination: 'tokens.xml',
          format: 'android/resources',
        },
      ],
    },
  },
};
```

```
  STYLE DICTIONARY PIPELINE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  tokens/*.json (source of truth)                     │
  │       │                                              │
  │       ▼                                              │
  │  Style Dictionary (transform + format)               │
  │       │                                              │
  │       ├── dist/css/tokens.css                         │
  │       │   :root { --color-primary: #3B82F6; }        │
  │       │                                              │
  │       ├── dist/tailwind/tokens.js                     │
  │       │   module.exports = { primary: '#3B82F6' }    │
  │       │                                              │
  │       ├── dist/ts/tokens.ts                           │
  │       │   export const ColorPrimary = '#3B82F6';     │
  │       │                                              │
  │       ├── dist/ios/Tokens.swift                       │
  │       │   static let colorPrimary = UIColor(...)     │
  │       │                                              │
  │       └── dist/android/tokens.xml                     │
  │           <color name="colorPrimary">#3B82F6</color> │
  │                                                      │
  │  ONE SOURCE → ALL PLATFORMS                          │
  └──────────────────────────────────────────────────────┘
```

---

## 4. Consuming Tokens

```css
/* CSS — using custom properties */
.button-primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-sm);
}

/* Dark mode — override semantic tokens */
[data-theme="dark"] {
  --color-background: var(--color-gray-900);
  --color-text: var(--color-gray-50);
  --color-surface: var(--color-gray-700);
}
```

```tsx
// Tailwind — extend with tokens
// tailwind.config.ts
import tokens from '@myds/tokens/dist/tailwind/tokens';

export default {
  theme: {
    extend: {
      colors: {
        primary: tokens.colorPrimary,
        background: tokens.colorBackground,
        surface: tokens.colorSurface,
      },
      spacing: tokens.spacing,
      borderRadius: tokens.radius,
    },
  },
};

// Usage
<button className="bg-primary text-white rounded-md px-4 py-2">
  Click me
</button>
```

---

## 5. W3C Design Tokens Format

```json
// W3C Design Tokens Community Group format (DTCG)
// Standard format — tools converging on this specification
{
  "color": {
    "brand": {
      "$type": "color",
      "primary": {
        "$value": "#3B82F6",
        "$description": "Primary brand color used for CTAs and links"
      },
      "secondary": {
        "$value": "#6366F1",
        "$description": "Secondary brand color for accents"
      }
    }
  },
  "spacing": {
    "$type": "dimension",
    "xs": { "$value": "4px" },
    "sm": { "$value": "8px" },
    "md": { "$value": "16px" },
    "lg": { "$value": "24px" },
    "xl": { "$value": "32px" }
  },
  "typography": {
    "heading": {
      "$type": "typography",
      "h1": {
        "$value": {
          "fontFamily": "Inter",
          "fontSize": "36px",
          "fontWeight": 700,
          "lineHeight": 1.2,
          "letterSpacing": "-0.02em"
        }
      }
    }
  },
  "shadow": {
    "$type": "shadow",
    "md": {
      "$value": {
        "color": "#00000026",
        "offsetX": "0px",
        "offsetY": "4px",
        "blur": "6px",
        "spread": "-1px"
      }
    }
  }
}
```

```
  W3C DESIGN TOKENS SPECIFICATION

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  KEY DIFFERENCES from Style Dictionary format:       │
  │                                                      │
  │  • $type instead of "type"                           │
  │  • $value instead of "value"                         │
  │  • $description for documentation                    │
  │  • Composite types (typography, shadow, border)      │
  │  • Alias syntax: {color.brand.primary}               │
  │                                                      │
  │  TOOL SUPPORT:                                       │
  │  Style Dictionary v4 → supports W3C format           │
  │  Tokens Studio       → exports W3C format            │
  │  Figma Variables     → aligned with W3C spec         │
  │  Specify            → W3C native                     │
  │                                                      │
  │  RECOMMENDATION:                                     │
  │  Use W3C format for new projects.                    │
  │  Style Dictionary v4 transforms W3C to all platforms.│
  └──────────────────────────────────────────────────────┘
```

---

## 6. Figma Integration (Tokens Studio)

```
  FIGMA ↔ CODE TOKEN SYNC

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Figma (Tokens Studio plugin)                        │
  │       │                                              │
  │       ▼  Export (push to GitHub)                      │
  │  tokens.json (W3C format in Git repo)                │
  │       │                                              │
  │       ▼  Style Dictionary v4                         │
  │  Generated outputs (CSS, Tailwind, TS, iOS, Android) │
  │       │                                              │
  │       ▼  Published npm package                       │
  │  @myds/tokens consumed by all products               │
  │                                                      │
  │  SYNC OPTIONS:                                       │
  │                                                      │
  │  Option A: Figma → Code (design leads)               │
  │  Tokens Studio exports JSON to GitHub branch.        │
  │  CI builds + publishes. One-directional.             │
  │                                                      │
  │  Option B: Code → Figma (engineering leads)          │
  │  Engineers edit JSON. Tokens Studio pulls from repo.  │
  │  Figma stays in sync via plugin pull.                │
  │                                                      │
  │  Option C: Figma Variables (native, no plugin)       │
  │  Use Figma REST API to read/write variables.         │
  │  Custom script syncs to code tokens.                 │
  │  Best for teams using Figma Variables over Tokens    │
  │  Studio.                                             │
  └──────────────────────────────────────────────────────┘
```

---

## 7. Token Validation & CI

```typescript
// scripts/validate-tokens.ts — run in CI
import Ajv from 'ajv';
import { readFileSync, readdirSync } from 'fs';

const schema = {
  type: 'object',
  patternProperties: {
    '.*': {
      oneOf: [
        { type: 'object', properties: { '$value': {}, '$type': {} }, required: ['$value'] },
        { type: 'object', additionalProperties: { $ref: '#' } },
      ],
    },
  },
};

const ajv = new Ajv();
const validate = ajv.compile(schema);

// Validate all token files match schema
const tokenFiles = readdirSync('tokens', { recursive: true })
  .filter((f) => f.toString().endsWith('.json'));

for (const file of tokenFiles) {
  const data = JSON.parse(readFileSync(`tokens/${file}`, 'utf-8'));
  if (!validate(data)) {
    console.error(`Invalid token file: ${file}`, validate.errors);
    process.exit(1);
  }
}

// Check for hardcoded colors in component code
import { execSync } from 'child_process';

const hardcoded = execSync(
  'grep -rn "#[0-9a-fA-F]\\{6\\}" src/components/ --include="*.tsx" --include="*.css" || true'
).toString();

if (hardcoded.trim()) {
  console.error('Hardcoded colors found in components:');
  console.error(hardcoded);
  process.exit(1);
}

console.log('All token validations passed');
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Hardcoded values** | `color: #3B82F6` in 50 places — impossible to update | Use `var(--color-primary)` or Tailwind tokens everywhere |
| **No semantic layer** | `color: var(--blue-500)` — what's blue-500 mean? | Add semantic layer: `--color-primary` references `--blue-500` |
| **Tokens in design tool only** | Figma has tokens, code has hardcoded values | Generate code tokens FROM design tool (Tokens Studio → Style Dict) |
| **No dark mode tokens** | Adding dark mode requires touching every component | Semantic tokens that change per theme — components reference semantics |
| **Per-component token files** | 100 token files, impossible to maintain | 3 files: primitive.json, semantic-light.json, semantic-dark.json |
| **String-based token references** | Typos in `var(--colr-primay)` — silent failures | TypeScript tokens with autocomplete + lint rules |
| **No naming convention** | `primaryColor`, `main-blue`, `btnBg` — inconsistent | Strict convention: `category.subcategory.variant` |

---

## 6. Enforcement Checklist

### Token Architecture
- [ ] 3-tier architecture defined (primitive → semantic → component)
- [ ] Primitive tokens cover all visual properties (color, type, space, shadow)
- [ ] Semantic tokens defined for light AND dark themes
- [ ] Naming convention documented and enforced

### Pipeline
- [ ] Style Dictionary configured for all target platforms
- [ ] Tokens generated as CSS custom properties
- [ ] Tokens generated as Tailwind config extension
- [ ] Token build runs in CI on every change
- [ ] Generated files committed to dist or published as npm package

### Usage
- [ ] ZERO hardcoded colors/spacing/fonts in component code
- [ ] Semantic tokens used in components (not primitives)
- [ ] Dark mode works by swapping semantic token values
- [ ] Figma ↔ code tokens synchronized (Tokens Studio or similar)
