# Component Testing — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to test components?", "Storybook testing?", "interaction testing", "component test vs unit test", "testing forms", "testing modals", "Storybook play functions", "portable stories", "CSF3 format", "testing drag and drop", or any component testing question, ALWAYS consult this directive. Component testing verifies UI components in isolation with real rendering — between unit tests (jsdom) and E2E tests (full browser). ALWAYS use Storybook as the component development and testing platform. ALWAYS write interaction tests with play functions for complex components. NEVER test internal state — test what the user sees and does.

**Core Rule: Component tests MUST verify components in isolation with real rendering and real user interactions. Use Storybook as the primary component development environment — every component gets stories. Use play functions for interaction testing — they run in real browser context and catch bugs that jsdom misses. Portable stories bridge the gap: write stories once, run in Storybook AND Vitest AND Playwright. NEVER test raw DOM structure — test behavior, accessibility, and visual output.**

---

## 1. Component Testing Landscape

```
  COMPONENT TESTING — WHERE IT FITS

  ┌──────────────────────────────────────────────────────────────┐
  │                                                              │
  │  UNIT TESTS (Vitest + Testing Library)                       │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  Environment: jsdom (simulated DOM)                    │  │
  │  │  Speed:       10-50ms per test                         │  │
  │  │  Fidelity:    Medium (no real CSS, layout, events)     │  │
  │  │  Use for:     Logic-heavy components, hooks, utils     │  │
  │  └────────────────────────────────────────────────────────┘  │
  │                                                              │
  │  COMPONENT TESTS (Storybook + Play Functions)                │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  Environment: Real browser (Chromium)                  │  │
  │  │  Speed:       100-500ms per test                       │  │
  │  │  Fidelity:    High (real CSS, layout, events)          │  │
  │  │  Use for:     Visual components, forms, interactions   │  │
  │  └────────────────────────────────────────────────────────┘  │
  │                                                              │
  │  E2E TESTS (Playwright)                                      │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  Environment: Full app in real browser                 │  │
  │  │  Speed:       1-10s per test                           │  │
  │  │  Fidelity:    Highest (full app context)               │  │
  │  │  Use for:     User journeys across multiple pages      │  │
  │  └────────────────────────────────────────────────────────┘  │
  │                                                              │
  │  DECISION: Test at the LOWEST level that gives confidence.   │
  │  Component tests fill the gap where jsdom is insufficient    │
  │  but full E2E is overkill.                                   │
  └──────────────────────────────────────────────────────────────┘
```

### 1.1 When to Use Component Tests

| Scenario | Unit Test | Component Test | E2E Test |
|---|---|---|---|
| Pure function logic | YES | No | No |
| Simple button click | YES | No | No |
| Form with validation + submission | Partial | YES | If critical path |
| Modal open/close/focus trap | No | YES | No |
| Drag and drop | No | YES | No |
| Responsive layout changes | No | YES | No |
| CSS animation completion | No | YES | No |
| Multi-step wizard | No | YES | If critical path |
| Login → Dashboard flow | No | No | YES |
| Checkout end-to-end | No | No | YES |

---

## 2. Storybook 8 — Component Development Platform

```
  STORYBOOK 8 ARCHITECTURE

  ┌──────────────────────────────────────────────────────┐
  │                 STORYBOOK                             │
  │                                                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  STORIES (CSF3 Format)                         │  │
  │  │                                                │  │
  │  │  export default {                              │  │
  │  │    component: Button,                          │  │
  │  │    args: { label: 'Click me' },                │  │
  │  │  } satisfies Meta<typeof Button>;              │  │
  │  │                                                │  │
  │  │  export const Primary: Story = {               │  │
  │  │    args: { variant: 'primary' },               │  │
  │  │    play: async ({ canvasElement }) => { ... }, │  │
  │  │  };                                            │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
  │  │ Controls │  │   Docs   │  │  Interactions    │  │
  │  │  Panel   │  │  (auto)  │  │  Panel           │  │
  │  │          │  │          │  │                  │  │
  │  │ Tweak    │  │ MDX +    │  │ Play functions   │  │
  │  │ props    │  │ Auto-gen │  │ step-by-step     │  │
  │  └──────────┘  └──────────┘  └──────────────────┘  │
  │                                                      │
  │  ADDONS: a11y | viewport | themes | test | actions   │
  └──────────────────────────────────────────────────────┘
```

### 2.1 Storybook Configuration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',     // controls, docs, viewport, actions
    '@storybook/addon-a11y',           // accessibility audit
    '@storybook/addon-interactions',   // play function debugging
    '@storybook/addon-coverage',       // istanbul coverage
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
};

export default config;
```

```typescript
// .storybook/preview.ts
import type { Preview } from '@storybook/react';
import { initialize, mswLoader } from 'msw-storybook-addon';
import '../src/styles/globals.css';

// Initialize MSW for Storybook
initialize();

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'label', enabled: true },
        ],
      },
    },
  },
  loaders: [mswLoader],
  decorators: [
    // Global decorators (theme, providers, etc.)
    (Story) => (
      <div style={{ padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
```

### 2.2 CSF3 Story Format

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { fn, expect, userEvent, within } from '@storybook/test';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],                       // auto-generate docs page
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
    disabled: { control: 'boolean' },
  },
  args: {
    onClick: fn(),                           // auto-tracked action
    children: 'Button',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic variants
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Delete',
  },
};

// States
export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled',
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: 'Saving...',
  },
};

// With interaction test
export const ClickTest: Story = {
  args: {
    children: 'Click Me',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const button = canvas.getByRole('button', { name: 'Click Me' });
    await userEvent.click(button);

    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
```

### 2.3 Complex Story with Decorators

```tsx
// UserCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import { UserCard } from './UserCard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const meta = {
  title: 'Components/UserCard',
  component: UserCard,
  decorators: [
    // Provide TanStack Query context
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof UserCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Success state — mock API returns data
export const Default: Story = {
  args: { userId: '1' },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users/1', () =>
          HttpResponse.json({
            id: '1',
            name: 'Alice Johnson',
            email: 'alice@example.com',
            avatar: 'https://i.pravatar.cc/150?u=alice',
            role: 'admin',
          })
        ),
      ],
    },
  },
};

// Loading state
export const Loading: Story = {
  args: { userId: '1' },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users/1', async () => {
          await new Promise(() => {});   // never resolves — shows loading forever
        }),
      ],
    },
  },
};

// Error state
export const Error: Story = {
  args: { userId: '1' },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users/1', () =>
          HttpResponse.json(
            { error: 'User not found' },
            { status: 404 }
          )
        ),
      ],
    },
  },
};
```

---

## 3. Interaction Testing with Play Functions

```
  PLAY FUNCTION EXECUTION FLOW

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  1. Storybook renders component with args            │
  │     ↓                                                │
  │  2. play() function executes in browser context      │
  │     ↓                                                │
  │  3. userEvent simulates real user interactions       │
  │     ↓                                                │
  │  4. expect() assertions validate outcomes            │
  │     ↓                                                │
  │  5. Interactions panel shows step-by-step replay     │
  │                                                      │
  │  RUNS IN:                                            │
  │  • Storybook UI (interactive debugging)              │
  │  • test-runner CLI (CI/CD)                           │
  │  • Vitest via portable stories                       │
  └──────────────────────────────────────────────────────┘
```

### 3.1 Form Interaction Testing

```tsx
// LoginForm.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { fn, expect, userEvent, within, waitFor } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import { LoginForm } from './LoginForm';

const meta = {
  title: 'Forms/LoginForm',
  component: LoginForm,
  args: {
    onSuccess: fn(),
  },
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const FilledIn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText('Email'), 'admin@example.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'password123');
  },
};

export const SubmitSuccess: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/api/login', () =>
          HttpResponse.json({ token: 'abc123', user: { name: 'Admin' } })
        ),
      ],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Fill in form
    await userEvent.type(canvas.getByLabelText('Email'), 'admin@example.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'password123');

    // Submit
    await userEvent.click(canvas.getByRole('button', { name: 'Sign In' }));

    // Wait for success callback
    await waitFor(() => {
      expect(args.onSuccess).toHaveBeenCalledWith({
        token: 'abc123',
        user: { name: 'Admin' },
      });
    });
  },
};

export const SubmitError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/api/login', () =>
          HttpResponse.json(
            { error: 'Invalid credentials' },
            { status: 401 }
          )
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText('Email'), 'wrong@example.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'wrongpass');
    await userEvent.click(canvas.getByRole('button', { name: 'Sign In' }));

    // Error message appears
    await waitFor(() => {
      expect(canvas.getByRole('alert')).toHaveTextContent('Invalid credentials');
    });
  },
};

export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Submit empty form
    await userEvent.click(canvas.getByRole('button', { name: 'Sign In' }));

    // Validation errors appear
    await waitFor(() => {
      expect(canvas.getByText('Email is required')).toBeInTheDocument();
      expect(canvas.getByText('Password is required')).toBeInTheDocument();
    });

    // Fix email, password still shows error
    await userEvent.type(canvas.getByLabelText('Email'), 'test@test.com');
    await userEvent.click(canvas.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(canvas.queryByText('Email is required')).not.toBeInTheDocument();
      expect(canvas.getByText('Password is required')).toBeInTheDocument();
    });
  },
};
```

### 3.2 Modal and Dialog Testing

```tsx
// ConfirmDialog.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { fn, expect, userEvent, within, waitFor } from '@storybook/test';
import { ConfirmDialog } from './ConfirmDialog';

const meta = {
  title: 'Overlays/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    title: 'Delete Item',
    message: 'Are you sure you want to delete this item? This cannot be undone.',
    onConfirm: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { open: true },
};

export const ConfirmAction: Story = {
  args: { open: true },
  play: async ({ canvasElement, args }) => {
    // Dialog should be accessible
    const dialog = within(canvasElement).getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Title and message visible
    expect(within(dialog).getByRole('heading', { name: 'Delete Item' })).toBeVisible();
    expect(within(dialog).getByText(/cannot be undone/)).toBeVisible();

    // Click confirm
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(args.onConfirm).toHaveBeenCalledOnce();
  },
};

export const CancelAction: Story = {
  args: { open: true },
  play: async ({ canvasElement, args }) => {
    const dialog = within(canvasElement).getByRole('dialog');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(args.onCancel).toHaveBeenCalledOnce();
  },
};

export const EscapeKeyCloses: Story = {
  args: { open: true },
  play: async ({ canvasElement, args }) => {
    within(canvasElement).getByRole('dialog');

    await userEvent.keyboard('{Escape}');
    expect(args.onCancel).toHaveBeenCalledOnce();
  },
};

export const FocusTrap: Story = {
  args: { open: true },
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement).getByRole('dialog');

    // First focusable element should receive focus
    const cancelBtn = within(dialog).getByRole('button', { name: 'Cancel' });
    const deleteBtn = within(dialog).getByRole('button', { name: 'Delete' });

    // Tab through dialog elements
    await userEvent.tab();
    expect(cancelBtn).toHaveFocus();

    await userEvent.tab();
    expect(deleteBtn).toHaveFocus();

    // Should cycle back (focus trap)
    await userEvent.tab();
    expect(cancelBtn).toHaveFocus();
  },
};
```

### 3.3 Compound Component Testing

```tsx
// Tabs.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { Tabs, TabList, Tab, TabPanel } from './Tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  render: (args) => (
    <Tabs {...args}>
      <TabList>
        <Tab>Overview</Tab>
        <Tab>Features</Tab>
        <Tab>Pricing</Tab>
      </TabList>
      <TabPanel>Overview content goes here.</TabPanel>
      <TabPanel>Features list and details.</TabPanel>
      <TabPanel>Pricing tiers and comparison.</TabPanel>
    </Tabs>
  ),
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // First tab active by default
    const tabs = canvas.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(canvas.getByText('Overview content goes here.')).toBeVisible();

    // Click second tab
    await userEvent.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(canvas.getByText('Features list and details.')).toBeVisible();
    expect(canvas.queryByText('Overview content goes here.')).not.toBeVisible();

    // Keyboard: Arrow Right moves to next tab
    await userEvent.keyboard('{ArrowRight}');
    expect(tabs[2]).toHaveFocus();
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    expect(canvas.getByText('Pricing tiers and comparison.')).toBeVisible();

    // Arrow Right from last wraps to first
    await userEvent.keyboard('{ArrowRight}');
    expect(tabs[0]).toHaveFocus();
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  },
};
```

---

## 4. Portable Stories — Write Once, Test Everywhere

```
  PORTABLE STORIES FLOW

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Story Definition (Button.stories.tsx)                │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  export const Primary: Story = {               │  │
  │  │    args: { variant: 'primary' },               │  │
  │  │    play: async ({ canvasElement }) => { ... },  │  │
  │  │  };                                            │  │
  │  └──────────────────┬─────────────────────────────┘  │
  │                     │                                │
  │         ┌───────────┼───────────┐                    │
  │         │           │           │                    │
  │         ▼           ▼           ▼                    │
  │    Storybook     Vitest     Playwright               │
  │    (visual)     (fast)     (screenshot)              │
  │                                                      │
  │  composeStories() creates renderable components      │
  │  from stories — with args, decorators, and play      │
  │  functions all applied.                              │
  └──────────────────────────────────────────────────────┘
```

### 4.1 Using Stories in Vitest

```typescript
// Button.stories.portable.test.tsx
import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react';
import * as stories from './Button.stories';

const { Primary, Disabled, ClickTest } = composeStories(stories);

describe('Button stories', () => {
  it('renders primary variant', () => {
    render(<Primary />);
    expect(screen.getByRole('button', { name: 'Primary Button' })).toBeInTheDocument();
  });

  it('renders disabled state', () => {
    render(<Disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('runs click interaction test', async () => {
    const { container } = render(<ClickTest />);

    // Run the play function from the story
    await ClickTest.play?.({ canvasElement: container } as any);

    // Play function already asserts onClick was called
  });
});

// Batch test: all stories render without error
const composedStories = composeStories(stories);
Object.entries(composedStories).forEach(([name, Story]) => {
  it(`renders ${name} without error`, () => {
    render(<Story />);
  });
});
```

### 4.2 Using Stories in Playwright

```typescript
// e2e/button.spec.ts
import { test, expect } from '@playwright/test';

test('Button stories render correctly', async ({ page }) => {
  // Navigate to Storybook story
  await page.goto(
    'http://localhost:6006/iframe.html?id=components-button--primary&viewMode=story'
  );

  // Visual comparison
  await expect(page.locator('#storybook-root')).toHaveScreenshot('button-primary.png');
});
```

---

## 5. Storybook Test Runner (CI)

```bash
# Install
npm install @storybook/test-runner --save-dev

# Run all stories and play functions
npx test-storybook

# With coverage
npx test-storybook --coverage

# Against specific URL (CI)
npx test-storybook --url http://localhost:6006
```

```typescript
// .storybook/test-runner.ts
import type { TestRunnerConfig } from '@storybook/test-runner';
import { getStoryContext } from '@storybook/test-runner';
import { injectAxe, checkA11y } from 'axe-playwright';

const config: TestRunnerConfig = {
  async preVisit(page) {
    // Inject axe for accessibility testing
    await injectAxe(page);
  },

  async postVisit(page, context) {
    // Run a11y checks on every story
    await checkA11y(page, '#storybook-root', {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  },
};

export default config;
```

```yaml
# CI: Run Storybook test runner
jobs:
  storybook-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci
      - run: npx playwright install --with-deps chromium

      # Build and serve Storybook
      - run: npm run build-storybook
      - name: Serve Storybook
        run: npx http-server storybook-static -p 6006 &

      - name: Wait for Storybook
        run: npx wait-on http://localhost:6006

      - name: Run tests
        run: npx test-storybook --url http://localhost:6006
```

---

## 6. Testing Responsive Components

```tsx
// ResponsiveNav.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { ResponsiveNav } from './ResponsiveNav';

const meta = {
  title: 'Navigation/ResponsiveNav',
  component: ResponsiveNav,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ResponsiveNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  parameters: {
    viewport: { defaultViewport: 'desktop' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Desktop: nav links visible, hamburger hidden
    expect(canvas.getByRole('link', { name: 'Home' })).toBeVisible();
    expect(canvas.getByRole('link', { name: 'Products' })).toBeVisible();
    expect(canvas.queryByRole('button', { name: 'Open menu' })).not.toBeVisible();
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Mobile: hamburger visible, nav links hidden initially
    const hamburger = canvas.getByRole('button', { name: 'Open menu' });
    expect(hamburger).toBeVisible();

    // Open menu
    await userEvent.click(hamburger);

    // Nav links now visible
    expect(canvas.getByRole('link', { name: 'Home' })).toBeVisible();
    expect(canvas.getByRole('link', { name: 'Products' })).toBeVisible();
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: 'tablet' },
  },
};
```

---

## 7. Testing Complex Interactions

### 7.1 Drag and Drop

```tsx
// DragDropList.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { DragDropList } from './DragDropList';

const meta = {
  title: 'Components/DragDropList',
  component: DragDropList,
  args: {
    items: ['Item A', 'Item B', 'Item C', 'Item D'],
  },
} satisfies Meta<typeof DragDropList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReorderItems: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Get drag handles
    const items = canvas.getAllByRole('listitem');
    const firstItem = items[0];
    const thirdItem = items[2];

    // Simulate drag using dataTransfer
    const dataTransfer = new DataTransfer();

    firstItem.dispatchEvent(
      new DragEvent('dragstart', { dataTransfer, bubbles: true })
    );
    thirdItem.dispatchEvent(
      new DragEvent('dragover', { dataTransfer, bubbles: true })
    );
    thirdItem.dispatchEvent(
      new DragEvent('drop', { dataTransfer, bubbles: true })
    );
    firstItem.dispatchEvent(
      new DragEvent('dragend', { dataTransfer, bubbles: true })
    );

    // Verify reorder
    const reorderedItems = canvas.getAllByRole('listitem');
    expect(reorderedItems[0]).toHaveTextContent('Item B');
    expect(reorderedItems[1]).toHaveTextContent('Item C');
    expect(reorderedItems[2]).toHaveTextContent('Item A');
  },
};
```

### 7.2 Multi-Step Wizard

```tsx
// Wizard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, waitFor } from '@storybook/test';
import { Wizard } from './Wizard';

const meta = {
  title: 'Flows/Wizard',
  component: Wizard,
} satisfies Meta<typeof Wizard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CompleteFlow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Step 1: Personal Info
    expect(canvas.getByText('Step 1 of 3')).toBeVisible();
    await userEvent.type(canvas.getByLabelText('First Name'), 'Jane');
    await userEvent.type(canvas.getByLabelText('Last Name'), 'Doe');
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));

    // Step 2: Address
    await waitFor(() => {
      expect(canvas.getByText('Step 2 of 3')).toBeVisible();
    });
    await userEvent.type(canvas.getByLabelText('Street'), '123 Main St');
    await userEvent.type(canvas.getByLabelText('City'), 'Anytown');
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));

    // Step 3: Review
    await waitFor(() => {
      expect(canvas.getByText('Step 3 of 3')).toBeVisible();
    });
    expect(canvas.getByText('Jane Doe')).toBeVisible();
    expect(canvas.getByText('123 Main St')).toBeVisible();

    // Submit
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }));

    // Success
    await waitFor(() => {
      expect(canvas.getByText('Registration complete!')).toBeVisible();
    });
  },
};

export const BackNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill step 1 and go to step 2
    await userEvent.type(canvas.getByLabelText('First Name'), 'Jane');
    await userEvent.type(canvas.getByLabelText('Last Name'), 'Doe');
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(canvas.getByText('Step 2 of 3')).toBeVisible();
    });

    // Go back
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }));

    // Step 1 data preserved
    await waitFor(() => {
      expect(canvas.getByLabelText('First Name')).toHaveValue('Jane');
      expect(canvas.getByLabelText('Last Name')).toHaveValue('Doe');
    });
  },
};
```

---

## 8. Storybook Addons for Testing

### 8.1 Accessibility Addon

```tsx
// Component with a11y parameters
export const AccessibleButton: Story = {
  args: {
    children: 'Submit',
    variant: 'primary',
  },
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'button-name', enabled: true },
        ],
      },
    },
  },
};

// Disable a11y for specific story (with justification)
export const DecorativeIcon: Story = {
  parameters: {
    a11y: {
      disable: true,  // icon is purely decorative, aria-hidden
    },
  },
};
```

### 8.2 Viewport Addon

```typescript
// .storybook/preview.ts
const preview: Preview = {
  parameters: {
    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '375px', height: '667px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1440px', height: '900px' } },
      },
    },
  },
};
```

### 8.3 Dark Mode Testing

```tsx
// ThemeToggle.stories.tsx
export const LightMode: Story = {
  decorators: [
    (Story) => (
      <ThemeProvider theme="light">
        <Story />
      </ThemeProvider>
    ),
  ],
};

export const DarkMode: Story = {
  decorators: [
    (Story) => (
      <ThemeProvider theme="dark">
        <div style={{ background: '#1a1a1a', padding: '1rem' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};
```

---

## 9. Component Test Organization

```
  COMPONENT TEST FILE STRUCTURE

  src/
  ├── components/
  │   ├── Button/
  │   │   ├── Button.tsx                 ← component
  │   │   ├── Button.test.tsx            ← unit tests (Vitest)
  │   │   ├── Button.stories.tsx         ← stories + interaction tests
  │   │   └── Button.module.css          ← styles
  │   │
  │   ├── LoginForm/
  │   │   ├── LoginForm.tsx
  │   │   ├── LoginForm.test.tsx         ← unit: validation logic
  │   │   ├── LoginForm.stories.tsx      ← component: full form flows
  │   │   └── LoginForm.module.css
  │   │
  │   └── DataTable/
  │       ├── DataTable.tsx
  │       ├── DataTable.test.tsx         ← unit: sorting, filtering logic
  │       ├── DataTable.stories.tsx      ← component: interaction + responsive
  │       └── columns.ts

  NAMING CONVENTIONS:
  • *.test.tsx    → Unit tests (Vitest)
  • *.stories.tsx → Storybook stories + interaction tests
  • *.spec.tsx    → E2E tests (if component-specific)

  RULE: Every component that is reusable MUST have:
  1. At least one story showing default state
  2. Stories for all major variants
  3. Stories for edge cases (empty, loading, error)
  4. Play functions for interactive components
```

---

## 10. Testing Patterns by Component Type

### 10.1 Testing Strategy Matrix

| Component Type | Unit Test | Storybook Story | Interaction Test |
|---|---|---|---|
| Button | Click handler, disabled state | All variants, sizes | Click tracking |
| Form | Validation logic | Empty, filled, error states | Full submission flow |
| Modal/Dialog | N/A | Open states | Focus trap, Escape key |
| Data Table | Sort/filter logic | Empty, loaded, pagination | Column sort, row selection |
| Dropdown/Select | N/A | Open, selected states | Keyboard navigation |
| Tabs | N/A | All tab states | Tab switching, arrow keys |
| Toast/Notification | N/A | All types (success, error) | Auto-dismiss timer |
| Infinite Scroll | Load more logic | Loading, loaded, end states | Scroll trigger |
| Autocomplete | Filter/search logic | Suggestion states | Type, select, keyboard |
| File Upload | File validation | Drag, preview states | Drop, remove file |

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **No stories for components** | Components developed in isolation with hot reload — no documentation, no visual testing | Write stories FIRST (Story-Driven Development) — story per variant |
| **Stories without play functions** | Stories only show static rendering — no interaction coverage | Add play functions for any component with user interaction |
| **Testing DOM structure** | `expect(container.innerHTML).toContain('<div class="wrapper">')` — brittle | Test behavior: what the user sees and can interact with |
| **Snapshot-based component tests** | `toMatchSnapshot()` on full component tree — breaks on every change | Use explicit assertions or visual regression (Chromatic) |
| **Mocking CSS modules** | `jest.mock('./styles.module.css')` — styles are part of the component | Configure test environment to process CSS (vitest: `css: true`) |
| **No MSW in Storybook** | Stories with data-fetching components show loading forever or errors | Configure `msw-storybook-addon` — mock API in story parameters |
| **Giant composite stories** | One story tests 15 things in sequence — hard to debug | One story per scenario — clear name describes the test |
| **No a11y addon** | Accessibility violations discovered in production | Install `@storybook/addon-a11y` — runs axe on every story |
| **Stories not in CI** | Stories bitrot — components change, stories break silently | Run `test-storybook` in CI — validates all stories render and play functions pass |
| **No responsive stories** | Components break on mobile — discovered only in E2E or production | Add viewport-specific stories for responsive components |

---

## 12. Enforcement Checklist

### Storybook Setup
- [ ] Storybook configured with `@storybook/react-vite` (or framework equivalent)
- [ ] Essential addons installed: controls, docs, viewport, a11y, interactions
- [ ] MSW addon configured for data-fetching components
- [ ] Global decorators set up (theme, providers, layout wrapper)
- [ ] `tags: ['autodocs']` on component meta for auto-generated docs

### Story Coverage
- [ ] Every reusable component has at least one story
- [ ] All visual variants documented (primary, secondary, error, disabled)
- [ ] Edge cases covered: empty state, loading, error, overflow text
- [ ] Responsive viewport stories for layout components
- [ ] Dark/light mode stories for themed components

### Interaction Testing
- [ ] Play functions written for all interactive components (forms, modals, tabs)
- [ ] Play functions use `within(canvasElement)` for scoped queries
- [ ] `expect()` assertions verify outcomes inside play functions
- [ ] Keyboard navigation tested for accessible components
- [ ] `fn()` used for callback props — verified with `expect().toHaveBeenCalled()`

### CI Integration
- [ ] `test-storybook` runs in CI — every story renders, every play function passes
- [ ] A11y checks run on every story via test-runner config
- [ ] Storybook builds successfully (`build-storybook`)
- [ ] Visual regression integrated (Chromatic, Percy, or Playwright screenshots)
- [ ] Stories not allowed to bitrot — CI failure on broken stories
