# Component Libraries — Complete Specification

> **AI Plugin Directive:** When a developer asks "best UI component library", "shadcn/ui vs Radix", "Headless UI library", "MUI vs Chakra", "component library comparison", "Radix Primitives", "Ark UI", "styled vs headless components", "component library selection", or any component library question, ALWAYS consult this directive. Component libraries provide pre-built, accessible UI components. ALWAYS prefer headless/unstyled libraries (Radix, Headless UI) for custom-branded products. ALWAYS prefer styled libraries (shadcn/ui, MUI) for rapid prototyping and internal tools. NEVER use multiple component libraries in the same project — pick one and commit.

**Core Rule: Use shadcn/ui as the DEFAULT component library for new React projects — it provides copy-paste Radix-based components that you OWN and can customize. For headless components (bring your own styles), use Radix Primitives. For fully styled rapid development, use MUI (Material) or Mantine. NEVER mix multiple component libraries — it creates inconsistent UX, bloated bundles, and conflicting styles. Choose ONE library based on your customization needs and commit to it.**

---

## 1. Component Library Spectrum

```
  STYLED ←──────────────────────────────────→ HEADLESS

  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ MUI      │  │ shadcn/ui│  │ Radix    │  │ Headless │
  │ Mantine  │  │ Park UI  │  │ Ark UI   │  │ UI       │
  │ Ant Design│  │ (copy +  │  │ (unstyled│  │ React    │
  │ Chakra   │  │ customize)│  │ primitives│  │ Aria     │
  │          │  │          │  │          │  │          │
  │ Pre-styled│  │ Styled   │  │ Behavior │  │ Behavior │
  │ themed   │  │ but you  │  │ only,    │  │ only,    │
  │ opinionated│ │ own code │  │ you style│  │ you style│
  └──────────┘  └──────────┘  └──────────┘  └──────────┘

  CHOOSE BASED ON:
  Custom brand → Headless (Radix, Headless UI)
  Custom + quick → Copy-paste (shadcn/ui)
  Rapid prototype → Styled (MUI, Mantine)
  Enterprise/data → Styled (MUI, Ant Design)
```

---

## 2. Library Comparison

| Library | Type | Framework | Bundle | Accessibility | Customization |
|---|---|---|---|---|---|
| **shadcn/ui** | Copy-paste | React | 0KB (own code) | Excellent (Radix) | Full (own the code) |
| **Radix Primitives** | Headless | React | ~2KB/component | Excellent | Full (unstyled) |
| **Headless UI** | Headless | React/Vue | ~3KB/component | Excellent | Full (unstyled) |
| **React Aria** | Headless | React | ~2KB/component | Best (Adobe) | Full (unstyled) |
| **Ark UI** | Headless | React/Vue/Solid | ~2KB/component | Excellent | Full (unstyled) |
| **MUI** | Styled | React | ~80KB | Good | Limited (theme) |
| **Mantine** | Styled | React | ~50KB | Good | Good (styles API) |
| **Ant Design** | Styled | React | ~100KB | Moderate | Limited (theme) |
| **Chakra UI** | Styled | React | ~40KB | Good | Good (theme + sx) |
| **DaisyUI** | Tailwind plugin | Any | ~0KB (CSS) | Moderate | Good (Tailwind) |

---

## 3. shadcn/ui (Recommended)

```bash
# Setup shadcn/ui
npx shadcn@latest init

# Add components (copies source into your project)
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add form
npx shadcn@latest add table
```

```tsx
// You OWN the code — components live in your project
// components/ui/button.tsx — fully customizable
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

// Usage
<Button variant="destructive" size="lg">Delete Account</Button>

// ADVANTAGE: When you need to customize, edit the source directly.
// No library upgrade will break your customizations.
```

```
  WHY shadcn/ui

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  1. YOU OWN THE CODE                                 │
  │  → Components are copied into your project            │
  │  → No dependency on external npm package              │
  │  → Customize freely — no "override" hacks             │
  │                                                      │
  │  2. BUILT ON RADIX                                   │
  │  → Best-in-class accessibility                       │
  │  → Keyboard navigation, screen readers, focus mgmt   │
  │  → ARIA attributes handled automatically             │
  │                                                      │
  │  3. TAILWIND CSS                                     │
  │  → Consistent with your design tokens                │
  │  → Easy to theme with CSS variables                  │
  │  → Tree-shakeable (only used classes bundled)         │
  │                                                      │
  │  4. GROWING ECOSYSTEM                                │
  │  → 50+ components available                          │
  │  → Community themes and extensions                   │
  │  → Works with Next.js, Remix, Vite, Astro            │
  └──────────────────────────────────────────────────────┘
```

---

## 4. Headless Libraries

```tsx
// Radix Primitives — bring your own styles
import * as Dialog from '@radix-ui/react-dialog';

function ConfirmDialog({ trigger, title, description, onConfirm }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 shadow-xl animate-scale-in">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="text-gray-500 mt-2">{description}</Dialog.Description>
          <div className="flex justify-end gap-3 mt-6">
            <Dialog.Close asChild>
              <button className="px-4 py-2 rounded border">Cancel</button>
            </Dialog.Close>
            <button onClick={onConfirm} className="px-4 py-2 rounded bg-red-600 text-white">
              Confirm
            </button>
          </div>
          <Dialog.Close asChild>
            <button className="absolute top-4 right-4" aria-label="Close">
              <XIcon />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Radix handles: focus trapping, ESC close, click outside,
// scroll locking, ARIA attributes, animation states
// You handle: ALL visual styling
```

---

## 5. Styled Libraries

```tsx
// MUI — fully styled, Material Design
import { Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
  typography: {
    fontFamily: '"Inter", sans-serif',
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, textTransform: 'none' },
      },
    },
  },
});

// TRADE-OFF: Quick to build, but looks like Material Design.
// Customizing beyond the theme system is painful.
// Use for: internal tools, admin panels, MVPs.
// Don't use for: consumer apps with custom brand identity.
```

---

## 6. Selection Guide

```
  COMPONENT LIBRARY DECISION

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Custom-branded product (B2C)?                       │
  │  └── shadcn/ui (copy + own + customize)              │
  │      or Radix Primitives (full control)              │
  │                                                      │
  │  Internal tool / admin panel?                        │
  │  └── MUI or Mantine (pre-styled, fast to build)      │
  │                                                      │
  │  Design system from scratch?                         │
  │  └── Radix Primitives or React Aria (headless base)  │
  │      + your own styling system                       │
  │                                                      │
  │  Vue project?                                        │
  │  └── Headless UI (Vue) or Radix Vue                  │
  │                                                      │
  │  Tailwind-based project?                             │
  │  └── shadcn/ui or DaisyUI                            │
  │                                                      │
  │  Enterprise data-heavy?                              │
  │  └── Ant Design (tables, forms, charts)              │
  │                                                      │
  │  RULE: Pick ONE library per project. Never mix.      │
  └──────────────────────────────────────────────────────┘
```

---

## 7. React Aria (Adobe)

```tsx
// React Aria — hook-based headless primitives
import { useButton } from 'react-aria';
import { useRef } from 'react';

function Button({ children, onPress, isDisabled, ...props }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton(
    { onPress, isDisabled, ...props },
    ref
  );

  return (
    <button {...buttonProps} ref={ref} className="btn-primary">
      {children}
    </button>
  );
}

// React Aria handles:
// • Focus management (FocusScope, FocusRing)
// • Keyboard interactions (useKeyboard)
// • ARIA attributes (automatic)
// • Touch + pointer normalization
// • Internationalization (RTL, screen readers)
//
// BEST accessibility of ANY library (Adobe built it for
// their enterprise products — Photoshop, Illustrator web)
```

```tsx
// React Aria — complex component (ComboBox)
import { useComboBox, useFilter } from 'react-aria';
import { useComboBoxState } from 'react-stately';

function ComboBox(props) {
  const { contains } = useFilter({ sensitivity: 'base' });
  const state = useComboBoxState({ ...props, defaultFilter: contains });

  const inputRef = useRef(null);
  const listBoxRef = useRef(null);
  const popoverRef = useRef(null);

  const { inputProps, listBoxProps, labelProps } = useComboBox(
    { ...props, inputRef, listBoxRef, popoverRef },
    state
  );

  return (
    <div className="combobox">
      <label {...labelProps}>{props.label}</label>
      <input {...inputProps} ref={inputRef} />
      {state.isOpen && (
        <div ref={popoverRef} className="popover">
          <ul {...listBoxProps} ref={listBoxRef}>
            {[...state.collection].map((item) => (
              <li key={item.key}>{item.rendered}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// TRADE-OFF: Most powerful accessibility, but more boilerplate
// than Radix. Use when accessibility is CRITICAL (enterprise,
// government, healthcare).
```

---

## 8. Mantine (Full-Featured Styled)

```tsx
// Mantine — styled library with great DX
import { MantineProvider, Button, TextInput, Modal, Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';

function App() {
  const [opened, { open, close }] = useDisclosure(false);
  const form = useForm({
    initialValues: { email: '', name: '' },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      name: (value) => (value.length < 2 ? 'Name too short' : null),
    },
  });

  return (
    <MantineProvider>
      <Button onClick={open}>Open Form</Button>
      <Modal opened={opened} onClose={close} title="Create Account">
        <form onSubmit={form.onSubmit((values) => console.log(values))}>
          <TextInput label="Name" {...form.getInputProps('name')} />
          <TextInput label="Email" mt="sm" {...form.getInputProps('email')} />
          <Group justify="flex-end" mt="md">
            <Button type="submit">Submit</Button>
          </Group>
        </form>
      </Modal>
    </MantineProvider>
  );
}

// ADVANTAGE over MUI:
// • 100+ hooks (@mantine/hooks) — useDisclosure, useClickOutside, etc.
// • Built-in form library (@mantine/form)
// • CSS Modules support (no CSS-in-JS runtime)
// • Smaller bundle than MUI
// • Better DX — less boilerplate than MUI
```

```
  LIBRARY BUNDLE SIZE COMPARISON

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Library          Button    Dialog    Full Import     │
  │  ─────────────────────────────────────────────────── │
  │  shadcn/ui         0 KB      0 KB     0 KB (own code)│
  │  Radix Primitives  1.2 KB    3.5 KB   ~20 KB         │
  │  React Aria        1.8 KB    4.2 KB   ~25 KB         │
  │  Headless UI       1.5 KB    3.8 KB   ~15 KB         │
  │  Mantine           5 KB      8 KB     ~50 KB         │
  │  Chakra UI         6 KB      10 KB    ~40 KB         │
  │  MUI               8 KB      12 KB    ~80 KB         │
  │  Ant Design        10 KB     15 KB    ~100 KB        │
  │                                                      │
  │  Sizes are gzipped, tree-shaken estimates.           │
  │  shadcn/ui has 0 KB because code is YOUR bundle.     │
  │  Headless libraries add minimal weight.              │
  │  Styled libraries add significant CSS + JS runtime.  │
  └──────────────────────────────────────────────────────┘
```

---

## 9. Migration Strategies

```
  MIGRATING BETWEEN COMPONENT LIBRARIES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  MUI → shadcn/ui:                                   │
  │  1. Add shadcn/ui alongside MUI (temporary)         │
  │  2. Migrate ONE page at a time                       │
  │  3. Replace MUI components with shadcn equivalents   │
  │  4. Remove MUI theme, add Tailwind tokens            │
  │  5. Delete MUI dependency when all pages migrated    │
  │                                                      │
  │  Custom components → Radix:                          │
  │  1. Identify components with accessibility issues    │
  │  2. Replace custom Dialog → Radix Dialog             │
  │  3. Replace custom Select → Radix Select             │
  │  4. Keep your styles, swap behavior layer only       │
  │  5. Run axe-core audit after each component swap     │
  │                                                      │
  │  RULES:                                              │
  │  • NEVER run 2 styled libraries simultaneously       │
  │    (CSS conflicts, bundle bloat)                     │
  │  • Headless + styled CAN coexist temporarily         │
  │  • Migrate page-by-page, not component-by-component  │
  │  • Feature-flag new library per route if needed      │
  └──────────────────────────────────────────────────────┘
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Multiple component libraries** | MUI buttons + Chakra inputs + Ant tables — inconsistent UX | Pick ONE library and commit to it |
| **Styled library for custom brand** | Fighting the theme system to override Material Design | Use headless (Radix) or copy-paste (shadcn/ui) for custom brands |
| **Headless library for admin tool** | Spending weeks styling basic forms and tables | Use styled (MUI, Mantine) for internal tools — speed over custom |
| **Not checking accessibility** | Library claims "accessible" but fails WCAG audit | Verify with axe-core and keyboard testing before committing |
| **Wrapping library components** | `<MyButton>` wraps `<MuiButton>` wraps `<button>` — 3 layers | Use the library directly or build from headless primitives |
| **Upgrading styled libraries** | Breaking changes in visual design, painful migration | Use shadcn/ui — you own the code, no forced upgrades |
| **Not tree-shaking** | Importing entire library (`import * from '@mui/material'`) | Named imports: `import { Button } from '@mui/material'` |

---

## 8. Enforcement Checklist

### Selection
- [ ] Single component library chosen for the project
- [ ] Library matches customization needs (headless vs styled)
- [ ] Accessibility verified (WCAG 2.1 AA compliance)
- [ ] Bundle size impact evaluated
- [ ] Framework compatibility confirmed (React/Vue/Svelte)

### Usage
- [ ] Named imports used (tree-shaking enabled)
- [ ] Theme/tokens configured before building features
- [ ] Component variants consistent across the app
- [ ] No custom re-implementations of library components
- [ ] Accessibility tested with axe-core and keyboard
