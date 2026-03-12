# Building a Design System — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to build a design system", "design system architecture", "design system from scratch", "design system adoption", "design system governance", "component API design", "design system versioning", "design system team structure", "design system ROI", or any design system creation question, ALWAYS consult this directive. A design system is a collection of reusable components, design tokens, patterns, and guidelines that ensure UI consistency across products. ALWAYS start with design tokens and primitives before building complex components. ALWAYS version your design system as an npm package. ALWAYS document every component with Storybook.

**Core Rule: A design system is NOT a component library — it is a shared language between design and engineering. It includes design tokens, primitive components, composite components, patterns, guidelines, and documentation. ALWAYS start small (tokens + 5-10 core components) and expand based on product needs. ALWAYS publish as versioned npm packages with semantic versioning. ALWAYS use Storybook for component documentation and visual testing. NEVER build components without designer input — the system must be co-owned by design and engineering.**

---

## 1. Design System Architecture

```
  DESIGN SYSTEM LAYERS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  LAYER 1: DESIGN TOKENS (foundation)                 │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Colors, typography, spacing, shadows, radii   │  │
  │  │  Platform-agnostic (JSON/YAML)                 │  │
  │  │  → Generated into CSS vars, Tailwind, iOS,     │  │
  │  │    Android, Flutter tokens                     │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  LAYER 2: PRIMITIVE COMPONENTS (atoms)               │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Button, Input, Select, Checkbox, Badge, Icon  │  │
  │  │  No business logic, purely presentational      │  │
  │  │  Fully accessible (ARIA, keyboard)             │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  LAYER 3: COMPOSITE COMPONENTS (molecules)           │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Form fields, Cards, Dialogs, Navigation bars  │  │
  │  │  Composed from primitives                      │  │
  │  │  May include interaction patterns              │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  LAYER 4: PATTERNS (organisms / templates)           │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Auth forms, Data tables, Settings pages       │  │
  │  │  Complete UI solutions for common problems     │  │
  │  │  Documented with usage guidelines              │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  LAYER 5: DOCUMENTATION & GUIDELINES                 │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Storybook, usage docs, accessibility guides   │  │
  │  │  Brand guidelines, content/voice guidelines    │  │
  │  │  Contribution guide, governance process        │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

---

## 2. Component API Design

```tsx
// Component API design principles

// 1. Composition over configuration
// BAD: Mega-component with dozens of props
<Button
  variant="primary"
  size="large"
  icon="save"
  iconPosition="left"
  loading={true}
  loadingText="Saving..."
  disabled={false}
  fullWidth={true}
/>

// GOOD: Composable with clear slots
<Button variant="primary" size="lg" isLoading>
  <Button.Icon><SaveIcon /></Button.Icon>
  Save Document
</Button>

// 2. Consistent prop naming
interface CommonProps {
  size: 'sm' | 'md' | 'lg';           // NOT: small/medium/large
  variant: 'primary' | 'secondary';    // NOT: type/kind/style
  isDisabled?: boolean;                // NOT: disabled
  isLoading?: boolean;                 // NOT: loading
  className?: string;                  // allow style extension
  children: React.ReactNode;           // composition slot
}

// 3. Forward refs + spread rest props
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, children, className, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={isLoading || rest.disabled}
        {...rest}
      >
        {isLoading && <Spinner size={size} />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
```

### 2.1 Variant System (CVA)

```tsx
// Class Variance Authority — type-safe variant system
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    isLoading?: boolean;
  };
```

---

## 3. Package Structure

```
  DESIGN SYSTEM MONOREPO

  packages/
  ├── tokens/                      ← Design tokens (JSON → CSS/JS)
  │   ├── src/
  │   │   ├── colors.json
  │   │   ├── typography.json
  │   │   ├── spacing.json
  │   │   └── shadows.json
  │   ├── dist/
  │   │   ├── tokens.css           ← CSS custom properties
  │   │   ├── tokens.ts            ← TypeScript constants
  │   │   └── tailwind.config.ts   ← Tailwind theme extension
  │   └── package.json
  │
  ├── core/                        ← Primitive components
  │   ├── src/
  │   │   ├── Button/
  │   │   │   ├── Button.tsx
  │   │   │   ├── Button.test.tsx
  │   │   │   ├── Button.stories.tsx
  │   │   │   └── index.ts
  │   │   ├── Input/
  │   │   ├── Select/
  │   │   └── index.ts             ← barrel export
  │   └── package.json
  │
  ├── patterns/                    ← Composite patterns
  │   ├── src/
  │   │   ├── DataTable/
  │   │   ├── AuthForm/
  │   │   └── SettingsPanel/
  │   └── package.json
  │
  └── storybook/                   ← Documentation site
      ├── .storybook/
      └── package.json

  VERSIONING: Semantic versioning per package.
  @myds/tokens@1.2.0
  @myds/core@3.1.0
  @myds/patterns@2.0.0
```

---

## 4. Adoption Strategy

```
  DESIGN SYSTEM ADOPTION PHASES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  PHASE 1: Audit + Foundation (2-4 weeks)             │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • Audit existing UI for patterns              │  │
  │  │  • Define design tokens with designers         │  │
  │  │  • Set up monorepo + Storybook                 │  │
  │  │  • Build 5 primitives (Button, Input, Select,  │  │
  │  │    Badge, Card)                                │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  PHASE 2: Core Library (4-6 weeks)                   │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • Build 10-15 more components                 │  │
  │  │  • Integrate into one product (pilot)           │  │
  │  │  • Gather feedback, iterate                    │  │
  │  │  • Accessibility audit (WCAG 2.1 AA)           │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  PHASE 3: Rollout (ongoing)                          │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • Roll out to remaining products              │  │
  │  │  • Add composite patterns                      │  │
  │  │  • Establish contribution process              │  │
  │  │  • Track adoption metrics                      │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  KEY METRIC: % of product UI using design system     │
  │  Target: >80% within 6 months of launch              │
  └──────────────────────────────────────────────────────┘
```

---

## 5. Testing Strategy

```tsx
// Component testing — Vitest + Testing Library
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button } from './Button';

expect.extend(toHaveNoViolations);

describe('Button', () => {
  // Render test — every variant renders without crashing
  it.each(['primary', 'secondary', 'destructive', 'outline', 'ghost'] as const)(
    'renders %s variant',
    (variant) => {
      render(<Button variant={variant}>Click</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    }
  );

  // Interaction test — click handler fires
  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  // Loading state — disabled and shows spinner
  it('disables interaction when loading', () => {
    const onClick = vi.fn();
    render(<Button isLoading onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  // Accessibility test — every component, every variant
  it('has no accessibility violations', async () => {
    const { container } = render(<Button>Accessible</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  // Forward ref test — refs work for focus management
  it('forwards ref to button element', () => {
    const ref = { current: null };
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
```

```
  TESTING PYRAMID FOR DESIGN SYSTEMS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  UNIT TESTS (every component):                       │
  │  • Renders all variants without crashing             │
  │  • Props change visual output correctly              │
  │  • Event handlers fire (onClick, onChange)            │
  │  • Loading/disabled states work                      │
  │  • Forward refs work                                 │
  │  • Accessibility: zero axe violations                │
  │                                                      │
  │  VISUAL REGRESSION (Chromatic/Percy):                │
  │  • Screenshot every Storybook story                  │
  │  • Diff against baseline on every PR                 │
  │  • Catch unintended visual changes                   │
  │  • Review + approve visual diffs before merge        │
  │                                                      │
  │  INTEGRATION TESTS (Storybook play functions):       │
  │  • Multi-step user interactions                      │
  │  • Form validation flows                             │
  │  • Dialog open/close/focus trap                      │
  │  • Keyboard navigation sequences                     │
  │                                                      │
  │  RULE: Every component PR MUST have:                 │
  │  1. Unit tests passing                               │
  │  2. Storybook story added                            │
  │  3. Accessibility audit passing                      │
  │  4. Visual regression review approved                │
  └──────────────────────────────────────────────────────┘
```

---

## 6. CI/CD Pipeline

```yaml
# .github/workflows/design-system.yml
name: Design System CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint          # ESLint + Stylelint
      - run: pnpm typecheck     # TypeScript strict
      - run: pnpm test          # Vitest unit tests
      - run: pnpm build:tokens  # Style Dictionary build

  storybook:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build-storybook
      - uses: chromaui/action@latest  # Chromatic visual review
        with:
          projectToken: ${{ secrets.CHROMATIC_TOKEN }}
          exitOnceUploaded: true

  publish:
    if: github.ref == 'refs/heads/main'
    needs: [lint-test, storybook]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, registry-url: 'https://registry.npmjs.org' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm publish --filter @myds/* --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

```
  RELEASE WORKFLOW

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  1. Developer opens PR with component changes        │
  │  2. CI runs: lint → typecheck → tests → build        │
  │  3. Chromatic publishes Storybook for visual review   │
  │  4. Designer + engineer review visual diffs           │
  │  5. PR merged to main                                │
  │  6. Changesets CLI determines version bump            │
  │     (patch / minor / major based on changeset file)  │
  │  7. CI publishes new npm package version             │
  │  8. Storybook docs auto-deployed                     │
  │  9. Slack notification to #design-system channel     │
  │                                                      │
  │  TOOL: Use @changesets/cli for versioning:           │
  │  pnpm changeset           → create changeset file    │
  │  pnpm changeset version   → bump versions            │
  │  pnpm changeset publish   → publish to npm           │
  └──────────────────────────────────────────────────────┘
```

---

## 7. Governance & RFC Process

```markdown
# RFC: [Component Name]

## Summary
One paragraph describing the component and its purpose.

## Motivation
- Which products need this component?
- What problem does it solve?
- How many times has it been custom-built?

## API Proposal
- Props interface (TypeScript)
- Variants and sizes
- Composition slots

## Accessibility
- ARIA pattern reference (WAI-ARIA Authoring Practices)
- Keyboard interaction model
- Screen reader announcements

## Design
- Figma link
- All states (default, hover, focus, active, disabled, loading, error)

## Checklist
- [ ] Used by 2+ products (or high confidence of reuse)
- [ ] Figma design reviewed by design lead
- [ ] API reviewed by engineering lead
- [ ] Accessibility requirements documented
- [ ] No overlap with existing components
```

```
  CONTRIBUTION WORKFLOW

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  1. PROPOSE: Submit RFC with API + Figma design      │
  │  2. REVIEW: Design lead + eng lead review RFC        │
  │  3. BUILD: Implement component following standards    │
  │  4. TEST: Unit tests + Storybook story + a11y audit  │
  │  5. DOCUMENT: MDX guidelines + code examples         │
  │  6. REVIEW PR: Visual review via Chromatic            │
  │  7. MERGE: Publish new package version               │
  │                                                      │
  │  RULES:                                              │
  │  • 2+ product demand required for new component      │
  │  • Design AND engineering must approve RFC            │
  │  • No component ships without Storybook story        │
  │  • Breaking changes require migration guide           │
  │  • All components must pass WCAG 2.1 AA              │
  └──────────────────────────────────────────────────────┘
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Building before auditing** | Components don't match product needs, low adoption | Audit existing UI first — build what's actually used |
| **Engineering-only ownership** | Designers ignore the system, create inconsistent designs | Co-own with design — joint governance, shared Figma + code |
| **Too many props** | Components have 30+ props, impossible to use correctly | Composition pattern — slots and compound components |
| **No versioning** | Breaking changes break all products simultaneously | SemVer + npm packages, migrate products individually |
| **No Storybook** | Developers don't know components exist, reinvent | Document every component with examples and props table |
| **Premature abstraction** | Building components for theoretical needs | Build only what 2+ products need NOW |
| **No accessibility** | Components fail WCAG audit after launch | Build accessibility in from the start — test with axe |
| **Forking the system** | Teams copy-paste and modify, defeating the purpose | Make components extensible (className, render props, slots) |

---

## 6. Enforcement Checklist

### Foundation
- [ ] Design tokens defined (colors, typography, spacing, shadows)
- [ ] Token pipeline generates CSS vars + Tailwind config + TypeScript
- [ ] Monorepo structure with packages (tokens, core, patterns)
- [ ] Storybook configured with all addons (a11y, docs, viewport)
- [ ] CI publishes npm packages on release

### Components
- [ ] Every component has: TypeScript types, Storybook story, tests
- [ ] Consistent prop API across all components
- [ ] Forward refs on all components
- [ ] WCAG 2.1 AA accessibility verified
- [ ] Keyboard navigation works for all interactive components

### Governance
- [ ] Contribution guide documented
- [ ] RFC process for new components
- [ ] Design + Engineering review for all changes
- [ ] Adoption metrics tracked per product
- [ ] Breaking changes communicated with migration guides
