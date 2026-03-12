# Design System Structure

> **AI Plugin Directive:** When creating or structuring a design system / component library (React, Vue, Web Components), ALWAYS use this structure. Apply Storybook, design tokens, accessibility-first components, and proper publishing. This guide covers design systems as shared npm packages consumed by multiple applications.

**Core Rule: A design system is a PRODUCT, not a folder. It MUST have its own package, Storybook, design tokens, automated visual testing, and documentation. Components MUST be accessible (WCAG 2.1 AA minimum), composable, and theme-aware. NEVER build a design system as a subfolder of one application.**

---

## 1. Design System Structure

```
design-system/
├── src/
│   ├── components/                        # UI components
│   │   ├── Button/
│   │   │   ├── Button.tsx                 # Component implementation
│   │   │   ├── Button.stories.tsx         # Storybook stories
│   │   │   ├── Button.test.tsx            # Unit/interaction tests
│   │   │   ├── Button.css.ts              # Styles (vanilla-extract/CSS modules)
│   │   │   └── index.ts                   # Public export
│   │   ├── Input/
│   │   │   ├── Input.tsx
│   │   │   ├── Input.stories.tsx
│   │   │   ├── Input.test.tsx
│   │   │   ├── Input.css.ts
│   │   │   └── index.ts
│   │   ├── Dialog/
│   │   │   ├── Dialog.tsx
│   │   │   ├── DialogTrigger.tsx
│   │   │   ├── DialogContent.tsx
│   │   │   ├── Dialog.stories.tsx
│   │   │   ├── Dialog.test.tsx
│   │   │   └── index.ts
│   │   └── index.ts                       # Barrel export ALL components
│   │
│   ├── tokens/                            # Design tokens
│   │   ├── colors.ts                      # Color palette + semantic colors
│   │   ├── spacing.ts                     # Spacing scale
│   │   ├── typography.ts                  # Font families, sizes, weights
│   │   ├── shadows.ts                     # Shadow definitions
│   │   ├── radii.ts                       # Border radius scale
│   │   ├── breakpoints.ts                 # Responsive breakpoints
│   │   ├── motion.ts                      # Animation/transition tokens
│   │   └── index.ts                       # All tokens export
│   │
│   ├── themes/                            # Theme definitions
│   │   ├── light.ts                       # Light theme token values
│   │   ├── dark.ts                        # Dark theme token values
│   │   ├── ThemeProvider.tsx              # Theme context provider
│   │   ├── useTheme.ts                    # Theme hook
│   │   ├── contract.css.ts               # Theme contract (vanilla-extract)
│   │   └── index.ts
│   │
│   ├── primitives/                        # Unstyled base components
│   │   ├── Polymorphic.tsx                # Polymorphic "as" prop
│   │   ├── Slot.tsx                       # Slot composition
│   │   ├── VisuallyHidden.tsx             # Accessibility utility
│   │   └── index.ts
│   │
│   ├── hooks/                             # Shared hooks
│   │   ├── useId.ts                       # Accessible ID generation
│   │   ├── useMediaQuery.ts               # Responsive hooks
│   │   ├── useFocusTrap.ts                # Focus management
│   │   ├── useClickOutside.ts             # Click outside detection
│   │   └── index.ts
│   │
│   ├── utils/                             # Internal utilities
│   │   ├── cn.ts                          # Class name merger (clsx + tailwind-merge)
│   │   ├── polymorphic.ts                 # Polymorphic type helpers
│   │   └── index.ts
│   │
│   ├── icons/                             # Icon system
│   │   ├── Icon.tsx                        # Icon wrapper component
│   │   ├── icons/                          # Individual icon SVGs as components
│   │   │   ├── ChevronDown.tsx
│   │   │   ├── Close.tsx
│   │   │   └── Search.tsx
│   │   └── index.ts
│   │
│   ├── types.ts                           # Shared types
│   └── index.ts                           # Main entry point
│
├── .storybook/                            # Storybook configuration
│   ├── main.ts                            # Storybook config
│   ├── preview.tsx                        # Global decorators + args
│   ├── manager.ts                         # UI customization
│   └── theme.ts                           # Storybook theme (brand)
│
├── dist/                                  # Build output (gitignored)
│
├── package.json
├── tsconfig.json
├── tsup.config.ts                         # Build config
├── vitest.config.ts                       # Test config
├── CHANGELOG.md
├── README.md
└── LICENSE
```

---

## 2. Component Anatomy

```tsx
// src/components/Button/Button.tsx

import { forwardRef } from "react";
import { Slot } from "../../primitives/Slot";
import { cn } from "../../utils/cn";
import { buttonVariants } from "./Button.css";

// ─── Types ───────────────────────────────────────────────
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  /** Size preset */
  size?: "sm" | "md" | "lg";
  /** Render as child element (Radix pattern) */
  asChild?: boolean;
  /** Loading state — disables button and shows spinner */
  loading?: boolean;
}

// ─── Component ───────────────────────────────────────────
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Spinner className="mr-2" aria-hidden />}
        {children}
      </Comp>
    );
  }
);

Button.displayName = "Button";
```

```
Component rules:
  ✅ forwardRef — ALWAYS forward refs for composition
  ✅ displayName — set for React DevTools
  ✅ Default variant/size — sensible defaults
  ✅ className prop — allow consumer overrides
  ✅ Spread ...props — pass through native attributes
  ✅ aria-* attributes — built-in accessibility
  ✅ asChild pattern — composition via Slot (Radix approach)
  ❌ NEVER hardcode colors — use tokens/theme
  ❌ NEVER use inline styles — use CSS-in-JS or CSS modules
  ❌ NEVER import app-specific code — design system is standalone
```

---

## 3. Design Tokens

```typescript
// src/tokens/colors.ts

/** Raw color palette — NEVER use directly in components */
export const palette = {
  blue: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
  },
  // ... other palettes
} as const;

/** Semantic color tokens — USE THESE in components */
export const colors = {
  // Brand
  brand: {
    primary: palette.blue[600],
    primaryHover: palette.blue[700],
    primaryActive: palette.blue[800],
  },

  // Foreground (text, icons)
  fg: {
    default: "#0f172a",
    muted: "#64748b",
    subtle: "#94a3b8",
    onBrand: "#ffffff",
    destructive: "#dc2626",
  },

  // Background
  bg: {
    default: "#ffffff",
    subtle: "#f8fafc",
    muted: "#f1f5f9",
    emphasis: "#0f172a",
  },

  // Border
  border: {
    default: "#e2e8f0",
    emphasis: "#94a3b8",
    focus: palette.blue[500],
  },
} as const;
```

```typescript
// src/tokens/spacing.ts

/** 4px base grid spacing scale */
export const spacing = {
  0: "0",
  0.5: "0.125rem",   // 2px
  1: "0.25rem",       // 4px
  1.5: "0.375rem",    // 6px
  2: "0.5rem",        // 8px
  3: "0.75rem",       // 12px
  4: "1rem",          // 16px
  5: "1.25rem",       // 20px
  6: "1.5rem",        // 24px
  8: "2rem",          // 32px
  10: "2.5rem",       // 40px
  12: "3rem",         // 48px
  16: "4rem",         // 64px
  20: "5rem",         // 80px
  24: "6rem",         // 96px
} as const;
```

```typescript
// src/tokens/typography.ts

export const fontFamilies = {
  sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", "Fira Code", monospace',
} as const;

export const fontSizes = {
  xs: "0.75rem",      // 12px
  sm: "0.875rem",     // 14px
  base: "1rem",       // 16px
  lg: "1.125rem",     // 18px
  xl: "1.25rem",      // 20px
  "2xl": "1.5rem",    // 24px
  "3xl": "1.875rem",  // 30px
  "4xl": "2.25rem",   // 36px
} as const;

export const fontWeights = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const lineHeights = {
  none: "1",
  tight: "1.25",
  snug: "1.375",
  normal: "1.5",
  relaxed: "1.625",
  loose: "2",
} as const;
```

---

## 4. Theme System

```tsx
// src/themes/ThemeProvider.tsx

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "ds-theme",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
  });

  const resolvedTheme = useResolvedTheme(theme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);
    localStorage.setItem(storageKey, theme);
  }, [theme, resolvedTheme, storageKey]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
```

---

## 5. Storybook Configuration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",           // Controls, actions, docs
    "@storybook/addon-a11y",                 // Accessibility checks
    "@storybook/addon-interactions",         // Interaction testing
    "@chromatic-com/storybook",              // Visual regression
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",                          // Auto-generate docs pages
  },
};

export default config;
```

```tsx
// .storybook/preview.tsx
import type { Preview } from "@storybook/react";
import { ThemeProvider } from "../src/themes/ThemeProvider";

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="light">
        <Story />
      </ThemeProvider>
    ),
  ],
  parameters: {
    controls: { expanded: true },
    a11y: { config: { rules: [{ id: "color-contrast", enabled: true }] } },
    layout: "centered",
  },
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Global theme",
      defaultValue: "light",
      toolbar: {
        icon: "circlehollow",
        items: ["light", "dark"],
        showName: true,
      },
    },
  },
};

export default preview;
```

---

## 6. Story Patterns

```tsx
// src/components/Button/Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Button } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost", "destructive"],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  args: {
    children: "Button",
    variant: "primary",
    size: "md",
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Stories ─────────────────────────────────────────────
export const Default: Story = {};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8 }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const Loading: Story = {
  args: { loading: true },
};

// ─── Interaction Test ────────────────────────────────────
export const ClickTest: Story = {
  args: { onClick: () => {} },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
```

---

## 7. Testing Strategy

```tsx
// src/components/Button/Button.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when loading", () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("forwards ref", () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
  });

  it("applies variant classes", () => {
    const { rerender } = render(<Button variant="primary">Btn</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("primary");

    rerender(<Button variant="destructive">Btn</Button>);
    expect(btn.className).toContain("destructive");
  });
});
```

```
Testing layers for design systems:

1. Unit tests (Vitest + Testing Library)
   - Component renders correctly
   - Props change behavior
   - Accessibility attributes present
   - Event handlers fire
   - Ref forwarding works

2. Interaction tests (Storybook play functions)
   - Click, type, focus sequences
   - Keyboard navigation
   - Form submissions

3. Visual regression tests (Chromatic)
   - Screenshot every story
   - Detect visual changes automatically
   - Approve/reject diffs in PR

4. Accessibility tests (Storybook a11y + axe)
   - Color contrast
   - ARIA roles and labels
   - Focus management
   - Keyboard operability

ALWAYS run all 4 layers in CI.
```

---

## 8. Package Configuration

```json
{
  "name": "@myorg/design-system",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.ts", "default": "./dist/index.cjs" }
    },
    "./tokens": {
      "import": { "types": "./dist/tokens.d.mts", "default": "./dist/tokens.mjs" },
      "require": { "types": "./dist/tokens.d.ts", "default": "./dist/tokens.cjs" }
    },
    "./themes": {
      "import": { "types": "./dist/themes.d.mts", "default": "./dist/themes.mjs" },
      "require": { "types": "./dist/themes.d.ts", "default": "./dist/themes.cjs" }
    },
    "./css": "./dist/styles.css"
  },
  "sideEffects": ["*.css"],
  "files": ["dist", "README.md", "LICENSE"],
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "scripts": {
    "build": "tsup",
    "dev": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "test": "vitest",
    "test:a11y": "storybook test --url http://localhost:6006",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "chromatic": "npx chromatic --project-token=${CHROMATIC_TOKEN}",
    "prepublishOnly": "npm run build"
  }
}
```

---

## 9. Component Categories

```
Organize components by complexity level:

primitives/          ← Unstyled, behavior-only (headless)
  - Slot
  - VisuallyHidden
  - Polymorphic
  - FocusScope

components/          ← Styled, ready-to-use
  atoms/             ← Single-purpose (no composition)
    - Button
    - Badge
    - Avatar
    - Spinner
    - Skeleton

  molecules/         ← Composed from atoms
    - Input (label + input + error)
    - Select (trigger + options)
    - Tooltip (trigger + content)
    - Card (header + body + footer)

  organisms/         ← Complex, multi-molecule
    - Dialog (overlay + content + title + actions)
    - DataTable (headers + rows + pagination + sorting)
    - Command (search + list + items)
    - DatePicker (trigger + calendar + navigation)

layout/              ← Layout components
  - Stack (vertical/horizontal)
  - Grid
  - Container
  - Divider

This categorization is for ORGANIZATION only.
Export ALL components flat from the package root.
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Design system as app subfolder | Tight coupling, can't share | Separate package with own build |
| Hardcoded colors/sizes | Can't theme, inconsistent | Use design tokens |
| No Storybook | Components undiscoverable | Add Storybook with autodocs |
| Missing forwardRef | Can't compose with other libraries | ALWAYS forwardRef |
| No accessibility | WCAG violations, lawsuits | Test with a11y addon, keyboard nav |
| Bundle React in output | Duplicate React in consumer | Use peerDependencies + external |
| Global CSS | Style conflicts in consumer apps | CSS modules, CSS-in-JS, or scoped styles |
| No visual regression tests | Visual bugs ship undetected | Add Chromatic or similar |
| Exporting default only | Hard to tree-shake | Named exports only |
| No displayName | Poor React DevTools experience | Set displayName on forwardRef |

---

## 11. Enforcement Checklist

- [ ] Separate package — NOT a subfolder of an application
- [ ] Design tokens for ALL visual values — colors, spacing, typography
- [ ] Theme system — light/dark minimum, `data-theme` attribute
- [ ] Storybook with autodocs — every component has stories
- [ ] Accessibility — WCAG 2.1 AA, tested with a11y addon
- [ ] forwardRef on ALL components
- [ ] Named exports only — NO default exports
- [ ] peerDependencies for React — NEVER bundle React
- [ ] Visual regression testing — Chromatic or Percy
- [ ] `sideEffects` configured — `["*.css"]` if CSS exists
- [ ] Multi-entry exports — components, tokens, themes as separate entry points
- [ ] Interaction tests — play functions in Storybook
- [ ] Component naming — PascalCase, descriptive, no abbreviations
- [ ] CHANGELOG — updated with every release
