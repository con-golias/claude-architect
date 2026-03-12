# Compound Components — Complete Specification

> **AI Plugin Directive:** When a developer asks "how do I build a Select component?", "what is the compound component pattern?", "how do I use React context for component composition?", "how do Vue slots work for component APIs?", "how do I build a Tabs component?", or "should I use cloneElement or context?", use this directive. Compound components are the CORRECT pattern for any multi-part UI component where children need implicit shared state (Select, Tabs, Accordion, Menu, Dialog). ALWAYS prefer Context-based compound components over cloneElement in React. ALWAYS prefer scoped slots in Vue. ALWAYS prefer ng-content with ngTemplateOutlet in Angular.

---

## 1. The Core Rule

**A compound component is a set of components that work together to form a complete UI widget, sharing implicit state via Context (React), provide/inject (Vue), or dependency injection (Angular). The parent component owns the state; children read and update it through shared context. NEVER use prop drilling for multi-part components — use compound patterns instead. NEVER use cloneElement for new code — use Context.**

```
COMPOUND COMPONENT ARCHITECTURE

  ┌─────────────────────────────────────────────────────┐
  │                  <Select>                            │
  │    (Parent — owns state via Context Provider)        │
  │                                                     │
  │    ┌─────────────────────────────────────────────┐   │
  │    │  <Select.Trigger>                           │   │
  │    │    (Reads isOpen from context)               │   │
  │    │    (Calls toggle from context)               │   │
  │    │    ┌─────────────────────────────────┐       │   │
  │    │    │ <Select.Value />                │       │   │
  │    │    │ (Reads selectedValue)           │       │   │
  │    │    └─────────────────────────────────┘       │   │
  │    └─────────────────────────────────────────────┘   │
  │                                                     │
  │    ┌─────────────────────────────────────────────┐   │
  │    │  <Select.Content>                           │   │
  │    │    (Renders when isOpen === true)            │   │
  │    │    ┌───────────────────────────────────┐     │   │
  │    │    │ <Select.Item value="a">           │     │   │
  │    │    │   (Calls onSelect from context)   │     │   │
  │    │    │   (Reads selectedValue to style)  │     │   │
  │    │    └───────────────────────────────────┘     │   │
  │    │    ┌───────────────────────────────────┐     │   │
  │    │    │ <Select.Item value="b">           │     │   │
  │    │    └───────────────────────────────────┘     │   │
  │    └─────────────────────────────────────────────┘   │
  │                                                     │
  └─────────────────────────────────────────────────────┘

  STATE FLOW:
  Select (Provider) ──context──> Trigger, Content, Item, Value
  Item ──onSelect(value)──> Select ──re-render──> Value updates

  RULE: Children NEVER own the state. Parent ALWAYS owns it.
        Children communicate ONLY through context.
```

---

## 2. Context-Based vs cloneElement — Decision Matrix

| Criteria | Context-Based | cloneElement |
|---|---|---|
| **Flexibility** | Children can be at ANY depth | Children MUST be direct descendants |
| **Type safety** | Full TypeScript support | Loses type information on cloned props |
| **Performance** | Context updates are optimized | cloneElement re-renders all children |
| **Composition** | Works with wrapper elements | Breaks when children are wrapped |
| **Recommendation** | ALWAYS use for new code | LEGACY ONLY — migrate away |

```
DECISION: Which compound pattern?

  ┌─ React?
  │   ├─ New code → Context-based (ALWAYS)
  │   └─ Legacy code with cloneElement → Migrate to Context
  │
  ├─ Vue?
  │   ├─ Simple composition → Named slots
  │   └─ Shared state needed → provide/inject + scoped slots
  │
  └─ Angular?
      ├─ Simple projection → ng-content with select
      └─ Dynamic templates → ngTemplateOutlet + DI
```

---

## 3. Implicit vs Explicit Compound Patterns

```
IMPLICIT (Context-based — PREFERRED):
  State is shared automatically through Context.
  Children do NOT receive props explicitly.

  <Tabs defaultValue="tab1">
    <Tabs.List>
      <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
      <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="tab1">Content 1</Tabs.Content>
    <Tabs.Content value="tab2">Content 2</Tabs.Content>
  </Tabs>

  Pros: Clean API, flexible nesting, no prop drilling
  Cons: Requires Context setup, slightly more code

EXPLICIT (Props-based):
  State is passed explicitly via props to each child.

  <Tabs
    activeTab={activeTab}
    onTabChange={setActiveTab}
    tabs={[
      { value: 'tab1', label: 'Tab 1', content: <Content1 /> },
      { value: 'tab2', label: 'Tab 2', content: <Content2 /> },
    ]}
  />

  Pros: Simple, no Context needed
  Cons: Rigid structure, no layout flexibility, config-driven

RULE: Use IMPLICIT for design system components.
      Use EXPLICIT only for simple, internal, one-off components.
```

---

## 4. Complete Implementation: Select/Dropdown (React + TypeScript)

```typescript
// src/components/organisms/Select/SelectContext.tsx
import { createContext, useContext } from 'react';

export interface SelectContextValue {
  /** Currently selected value */
  value: string | undefined;
  /** Update the selected value */
  onValueChange: (value: string) => void;
  /** Whether the dropdown is open */
  isOpen: boolean;
  /** Toggle dropdown open/close */
  toggle: () => void;
  /** Close the dropdown */
  close: () => void;
  /** ID for ARIA attributes */
  selectId: string;
  /** Currently highlighted index for keyboard nav */
  highlightedIndex: number;
  /** Update highlighted index */
  setHighlightedIndex: (index: number) => void;
  /** Registered item values for keyboard navigation */
  items: string[];
  /** Register an item value */
  registerItem: (value: string) => void;
  /** Unregister an item value */
  unregisterItem: (value: string) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

/**
 * ALWAYS use this hook inside compound children.
 * Throws if used outside <Select> — fail-fast over silent bugs.
 */
export function useSelectContext(): SelectContextValue {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error(
      'Select compound components must be used within a <Select> parent. ' +
      'Found a Select.Trigger, Select.Content, Select.Item, or Select.Value ' +
      'rendered outside of <Select>.'
    );
  }
  return context;
}

export { SelectContext };
```

```typescript
// src/components/organisms/Select/Select.tsx
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useId,
  type ReactNode,
} from 'react';
import { SelectContext, type SelectContextValue } from './SelectContext';
import { SelectTrigger } from './SelectTrigger';
import { SelectContent } from './SelectContent';
import { SelectItem } from './SelectItem';
import { SelectValue } from './SelectValue';
import { SelectGroup } from './SelectGroup';
import { SelectSeparator } from './SelectSeparator';

// ─── Props ──────────────────────────────────────────────────

export interface SelectProps {
  /** Controlled value */
  value?: string;
  /** Default value (uncontrolled) */
  defaultValue?: string;
  /** Called when value changes */
  onValueChange?: (value: string) => void;
  /** Accessible label */
  'aria-label'?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Children (Select.Trigger, Select.Content, etc.) */
  children: ReactNode;
}

// ─── Root Component ─────────────────────────────────────────

function SelectRoot({
  value: controlledValue,
  defaultValue,
  onValueChange,
  disabled = false,
  children,
  ...props
}: SelectProps) {
  const selectId = useId();
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [items, setItems] = useState<string[]>([]);

  // Support both controlled and uncontrolled usage
  const value = controlledValue ?? internalValue;

  const handleValueChange = useCallback(
    (newValue: string) => {
      if (controlledValue === undefined) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
      setIsOpen(false);
    },
    [controlledValue, onValueChange]
  );

  const toggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  const close = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  const registerItem = useCallback((itemValue: string) => {
    setItems((prev) =>
      prev.includes(itemValue) ? prev : [...prev, itemValue]
    );
  }, []);

  const unregisterItem = useCallback((itemValue: string) => {
    setItems((prev) => prev.filter((v) => v !== itemValue));
  }, []);

  const contextValue: SelectContextValue = {
    value,
    onValueChange: handleValueChange,
    isOpen,
    toggle,
    close,
    selectId,
    highlightedIndex,
    setHighlightedIndex,
    items,
    registerItem,
    unregisterItem,
  };

  return (
    <SelectContext.Provider value={contextValue}>
      <div className="relative inline-block" {...props}>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

// ─── Compound Export ────────────────────────────────────────

/**
 * ALWAYS export compound components as static properties
 * on the root component. This enforces the parent-child
 * relationship in the API.
 */
export const Select = Object.assign(SelectRoot, {
  Trigger: SelectTrigger,
  Content: SelectContent,
  Item: SelectItem,
  Value: SelectValue,
  Group: SelectGroup,
  Separator: SelectSeparator,
});
```

```typescript
// src/components/organisms/Select/SelectTrigger.tsx
import { forwardRef, useCallback, type ReactNode, type KeyboardEvent } from 'react';
import { useSelectContext } from './SelectContext';
import { cn } from '@/utils/cn';

export interface SelectTriggerProps {
  children: ReactNode;
  className?: string;
}

export const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ children, className }, ref) => {
    const { isOpen, toggle, selectId, highlightedIndex, setHighlightedIndex, items } =
      useSelectContext();

    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        switch (e.key) {
          case 'Enter':
          case ' ':
          case 'ArrowDown':
            e.preventDefault();
            if (!isOpen) {
              toggle();
              setHighlightedIndex(0);
            }
            break;
          case 'ArrowUp':
            e.preventDefault();
            if (!isOpen) {
              toggle();
              setHighlightedIndex(items.length - 1);
            }
            break;
          case 'Escape':
            e.preventDefault();
            if (isOpen) toggle();
            break;
        }
      },
      [isOpen, toggle, setHighlightedIndex, items.length]
    );

    return (
      <button
        ref={ref}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${selectId}-content`}
        aria-activedescendant={
          highlightedIndex >= 0 ? `${selectId}-item-${highlightedIndex}` : undefined
        }
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        onClick={toggle}
        onKeyDown={handleKeyDown}
      >
        {children}
        <svg
          className={cn('ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform', isOpen && 'rotate-180')}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    );
  }
);

SelectTrigger.displayName = 'Select.Trigger';
```

```typescript
// src/components/organisms/Select/SelectContent.tsx
import {
  forwardRef,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { useSelectContext } from './SelectContext';
import { cn } from '@/utils/cn';

export interface SelectContentProps {
  children: ReactNode;
  className?: string;
  /** Alignment relative to trigger */
  align?: 'start' | 'center' | 'end';
}

export const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(
  ({ children, className, align = 'start' }, ref) => {
    const {
      isOpen,
      close,
      selectId,
      highlightedIndex,
      setHighlightedIndex,
      items,
      onValueChange,
    } = useSelectContext();
    const contentRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (
          contentRef.current &&
          !contentRef.current.contains(e.target as Node)
        ) {
          close();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, close]);

    // Keyboard navigation within content
    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setHighlightedIndex(
              highlightedIndex < items.length - 1 ? highlightedIndex + 1 : 0
            );
            break;
          case 'ArrowUp':
            e.preventDefault();
            setHighlightedIndex(
              highlightedIndex > 0 ? highlightedIndex - 1 : items.length - 1
            );
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            if (highlightedIndex >= 0 && items[highlightedIndex]) {
              onValueChange(items[highlightedIndex]);
            }
            break;
          case 'Escape':
            e.preventDefault();
            close();
            break;
          case 'Home':
            e.preventDefault();
            setHighlightedIndex(0);
            break;
          case 'End':
            e.preventDefault();
            setHighlightedIndex(items.length - 1);
            break;
        }
      },
      [highlightedIndex, items, setHighlightedIndex, onValueChange, close]
    );

    if (!isOpen) return null;

    return (
      <div
        ref={contentRef}
        id={`${selectId}-content`}
        role="listbox"
        className={cn(
          'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
          'animate-in fade-in-0 zoom-in-95',
          align === 'end' && 'right-0',
          align === 'center' && 'left-1/2 -translate-x-1/2',
          className
        )}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    );
  }
);

SelectContent.displayName = 'Select.Content';
```

```typescript
// src/components/organisms/Select/SelectItem.tsx
import { forwardRef, useEffect, type ReactNode } from 'react';
import { useSelectContext } from './SelectContext';
import { cn } from '@/utils/cn';

export interface SelectItemProps {
  /** The value this item represents */
  value: string;
  /** Display content */
  children: ReactNode;
  /** Whether this item is disabled */
  disabled?: boolean;
  className?: string;
}

export const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  ({ value, children, disabled = false, className }, ref) => {
    const ctx = useSelectContext();
    const isSelected = ctx.value === value;
    const itemIndex = ctx.items.indexOf(value);
    const isHighlighted = ctx.highlightedIndex === itemIndex;

    // Register/unregister this item for keyboard navigation
    useEffect(() => {
      ctx.registerItem(value);
      return () => ctx.unregisterItem(value);
    }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div
        ref={ref}
        id={`${ctx.selectId}-item-${itemIndex}`}
        role="option"
        aria-selected={isSelected}
        aria-disabled={disabled}
        data-highlighted={isHighlighted || undefined}
        data-disabled={disabled || undefined}
        className={cn(
          'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
          isHighlighted && 'bg-accent text-accent-foreground',
          isSelected && 'font-medium',
          disabled && 'pointer-events-none opacity-50',
          className
        )}
        onClick={() => {
          if (!disabled) ctx.onValueChange(value);
        }}
        onMouseEnter={() => {
          if (!disabled) ctx.setHighlightedIndex(itemIndex);
        }}
      >
        {/* Checkmark for selected item */}
        <span className="mr-2 flex h-4 w-4 items-center justify-center">
          {isSelected && (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        {children}
      </div>
    );
  }
);

SelectItem.displayName = 'Select.Item';
```

```typescript
// src/components/organisms/Select/SelectValue.tsx
import { useSelectContext } from './SelectContext';

export interface SelectValueProps {
  /** Shown when no value is selected */
  placeholder?: string;
}

export function SelectValue({ placeholder = 'Select...' }: SelectValueProps) {
  const { value } = useSelectContext();
  return (
    <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
      {value ?? placeholder}
    </span>
  );
}

SelectValue.displayName = 'Select.Value';
```

```typescript
// src/components/organisms/Select/SelectGroup.tsx
import { type ReactNode } from 'react';

export interface SelectGroupProps {
  /** Group label */
  label: string;
  children: ReactNode;
}

export function SelectGroup({ label, children }: SelectGroupProps) {
  return (
    <div role="group" aria-label={label}>
      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

SelectGroup.displayName = 'Select.Group';
```

```typescript
// src/components/organisms/Select/SelectSeparator.tsx
export function SelectSeparator() {
  return <div className="-mx-1 my-1 h-px bg-muted" role="separator" />;
}

SelectSeparator.displayName = 'Select.Separator';
```

```typescript
// src/components/organisms/Select/index.ts
// ALWAYS export the compound component as a single named export
export { Select } from './Select';
export type { SelectProps } from './Select';
```

### Select Usage

```tsx
import { Select } from '@/components/organisms/Select';

function UserRoleSelect() {
  const [role, setRole] = useState<string>();

  return (
    <Select value={role} onValueChange={setRole} aria-label="User role">
      <Select.Trigger>
        <Select.Value placeholder="Choose a role..." />
      </Select.Trigger>
      <Select.Content>
        <Select.Group label="Standard">
          <Select.Item value="viewer">Viewer</Select.Item>
          <Select.Item value="editor">Editor</Select.Item>
        </Select.Group>
        <Select.Separator />
        <Select.Group label="Administrative">
          <Select.Item value="admin">Admin</Select.Item>
          <Select.Item value="superadmin">Super Admin</Select.Item>
        </Select.Group>
      </Select.Content>
    </Select>
  );
}
```

---

## 5. Complete Implementation: Tabs (React + TypeScript)

```typescript
// src/components/organisms/Tabs/TabsContext.tsx
import { createContext, useContext } from 'react';

export interface TabsContextValue {
  activeValue: string;
  onValueChange: (value: string) => void;
  tabsId: string;
  orientation: 'horizontal' | 'vertical';
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(
      'Tabs compound components (Tabs.List, Tabs.Trigger, Tabs.Content) ' +
      'MUST be rendered inside a <Tabs> parent.'
    );
  }
  return context;
}

export { TabsContext };
```

```typescript
// src/components/organisms/Tabs/Tabs.tsx
import { useState, useId, type ReactNode } from 'react';
import { TabsContext, type TabsContextValue } from './TabsContext';
import { TabsList } from './TabsList';
import { TabsTrigger } from './TabsTrigger';
import { TabsContent } from './TabsContent';

export interface TabsProps {
  /** Controlled active tab value */
  value?: string;
  /** Default active tab (uncontrolled) */
  defaultValue: string;
  /** Called when active tab changes */
  onValueChange?: (value: string) => void;
  /** Tab orientation for keyboard navigation */
  orientation?: 'horizontal' | 'vertical';
  children: ReactNode;
  className?: string;
}

function TabsRoot({
  value: controlledValue,
  defaultValue,
  onValueChange,
  orientation = 'horizontal',
  children,
  className,
}: TabsProps) {
  const tabsId = useId();
  const [internalValue, setInternalValue] = useState(defaultValue);

  const activeValue = controlledValue ?? internalValue;

  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  const contextValue: TabsContextValue = {
    activeValue,
    onValueChange: handleValueChange,
    tabsId,
    orientation,
  };

  return (
    <TabsContext.Provider value={contextValue}>
      <div
        className={className}
        data-orientation={orientation}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
});
```

```typescript
// src/components/organisms/Tabs/TabsList.tsx
import { forwardRef, type ReactNode } from 'react';
import { useTabsContext } from './TabsContext';
import { cn } from '@/utils/cn';

export interface TabsListProps {
  children: ReactNode;
  className?: string;
}

/**
 * TabsList — container for tab triggers.
 * MUST use role="tablist" for accessibility.
 */
export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ children, className }, ref) => {
    const { orientation } = useTabsContext();

    return (
      <div
        ref={ref}
        role="tablist"
        aria-orientation={orientation}
        className={cn(
          'inline-flex items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
          orientation === 'vertical' && 'flex-col',
          className
        )}
      >
        {children}
      </div>
    );
  }
);

TabsList.displayName = 'Tabs.List';
```

```typescript
// src/components/organisms/Tabs/TabsTrigger.tsx
import { forwardRef, useCallback, type KeyboardEvent, type ReactNode } from 'react';
import { useTabsContext } from './TabsContext';
import { cn } from '@/utils/cn';

export interface TabsTriggerProps {
  /** The value this trigger activates */
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * TabsTrigger — a single tab button.
 *
 * MUST use role="tab" and proper ARIA attributes.
 * MUST support keyboard navigation (Arrow keys for roving tabindex).
 */
export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, children, disabled = false, className }, ref) => {
    const { activeValue, onValueChange, tabsId, orientation } = useTabsContext();
    const isActive = activeValue === value;

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLButtonElement>) => {
        const tablist = e.currentTarget.parentElement;
        if (!tablist) return;

        const tabs = Array.from(
          tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
        );
        const currentIndex = tabs.indexOf(e.currentTarget);

        let nextIndex = -1;
        const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
        const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';

        switch (e.key) {
          case nextKey:
            e.preventDefault();
            nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
            break;
          case prevKey:
            e.preventDefault();
            nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
            break;
          case 'Home':
            e.preventDefault();
            nextIndex = 0;
            break;
          case 'End':
            e.preventDefault();
            nextIndex = tabs.length - 1;
            break;
        }

        if (nextIndex >= 0) {
          tabs[nextIndex].focus();
          // Activate on focus (automatic activation)
          const nextValue = tabs[nextIndex].getAttribute('data-value');
          if (nextValue) onValueChange(nextValue);
        }
      },
      [orientation, onValueChange]
    );

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={`${tabsId}-trigger-${value}`}
        aria-selected={isActive}
        aria-controls={`${tabsId}-content-${value}`}
        data-value={value}
        disabled={disabled}
        tabIndex={isActive ? 0 : -1}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          isActive
            ? 'bg-background text-foreground shadow-sm'
            : 'hover:bg-background/50 hover:text-foreground',
          className
        )}
        onClick={() => onValueChange(value)}
        onKeyDown={handleKeyDown}
      >
        {children}
      </button>
    );
  }
);

TabsTrigger.displayName = 'Tabs.Trigger';
```

```typescript
// src/components/organisms/Tabs/TabsContent.tsx
import { forwardRef, type ReactNode } from 'react';
import { useTabsContext } from './TabsContext';
import { cn } from '@/utils/cn';

export interface TabsContentProps {
  /** The value this panel is associated with */
  value: string;
  children: ReactNode;
  className?: string;
  /** Whether to force mount (keep in DOM when inactive) */
  forceMount?: boolean;
}

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, children, className, forceMount = false }, ref) => {
    const { activeValue, tabsId } = useTabsContext();
    const isActive = activeValue === value;

    if (!isActive && !forceMount) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${tabsId}-content-${value}`}
        aria-labelledby={`${tabsId}-trigger-${value}`}
        hidden={!isActive}
        tabIndex={0}
        className={cn(
          'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className
        )}
      >
        {children}
      </div>
    );
  }
);

TabsContent.displayName = 'Tabs.Content';
```

### Tabs Usage

```tsx
<Tabs defaultValue="overview">
  <Tabs.List>
    <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
    <Tabs.Trigger value="analytics">Analytics</Tabs.Trigger>
    <Tabs.Trigger value="settings" disabled>Settings</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="overview">
    <OverviewPanel data={data} />
  </Tabs.Content>
  <Tabs.Content value="analytics">
    <AnalyticsPanel data={data} />
  </Tabs.Content>
  <Tabs.Content value="settings">
    <SettingsPanel />
  </Tabs.Content>
</Tabs>
```

---

## 6. Complete Implementation: Accordion (React + TypeScript)

```typescript
// src/components/organisms/Accordion/Accordion.tsx
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useId,
  forwardRef,
  type ReactNode,
} from 'react';
import { cn } from '@/utils/cn';

// ─── Context ────────────────────────────────────────────────

interface AccordionContextValue {
  type: 'single' | 'multiple';
  expandedItems: string[];
  toggleItem: (value: string) => void;
  accordionId: string;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordionContext(): AccordionContextValue {
  const ctx = useContext(AccordionContext);
  if (!ctx) {
    throw new Error(
      'Accordion.Item, Accordion.Trigger, and Accordion.Content ' +
      'MUST be used within an <Accordion> parent.'
    );
  }
  return ctx;
}

// ─── Item Context (per-item) ────────────────────────────────

interface AccordionItemContextValue {
  value: string;
  isExpanded: boolean;
  triggerId: string;
  contentId: string;
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

function useAccordionItemContext(): AccordionItemContextValue {
  const ctx = useContext(AccordionItemContext);
  if (!ctx) {
    throw new Error(
      'Accordion.Trigger and Accordion.Content MUST be used within an <Accordion.Item>.'
    );
  }
  return ctx;
}

// ─── Root ───────────────────────────────────────────────────

interface AccordionSingleProps {
  type: 'single';
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string | undefined) => void;
  /** Allow collapsing all items (single mode) */
  collapsible?: boolean;
}

interface AccordionMultipleProps {
  type: 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
}

type AccordionRootProps = (AccordionSingleProps | AccordionMultipleProps) & {
  children: ReactNode;
  className?: string;
};

function AccordionRoot(props: AccordionRootProps) {
  const { type, children, className } = props;
  const accordionId = useId();

  // Single mode state
  const [singleValue, setSingleValue] = useState<string | undefined>(
    type === 'single' ? props.defaultValue : undefined
  );
  // Multiple mode state
  const [multipleValue, setMultipleValue] = useState<string[]>(
    type === 'multiple' ? (props.defaultValue ?? []) : []
  );

  const expandedItems: string[] =
    type === 'single'
      ? (((props as AccordionSingleProps).value ?? singleValue) ? [((props as AccordionSingleProps).value ?? singleValue)!] : [])
      : ((props as AccordionMultipleProps).value ?? multipleValue);

  const toggleItem = useCallback(
    (value: string) => {
      if (type === 'single') {
        const sp = props as AccordionSingleProps;
        const isExpanded = expandedItems.includes(value);
        const newValue = isExpanded && sp.collapsible ? undefined : value;
        if (sp.value === undefined) setSingleValue(newValue);
        sp.onValueChange?.(newValue);
      } else {
        const mp = props as AccordionMultipleProps;
        const isExpanded = expandedItems.includes(value);
        const newValue = isExpanded
          ? expandedItems.filter((v) => v !== value)
          : [...expandedItems, value];
        if (mp.value === undefined) setMultipleValue(newValue);
        mp.onValueChange?.(newValue);
      }
    },
    [type, props, expandedItems]
  );

  return (
    <AccordionContext.Provider value={{ type, expandedItems, toggleItem, accordionId }}>
      <div className={cn('divide-y divide-border', className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

// ─── Item ───────────────────────────────────────────────────

interface AccordionItemProps {
  value: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

function AccordionItem({ value, children, className, disabled }: AccordionItemProps) {
  const { expandedItems, accordionId } = useAccordionContext();
  const isExpanded = expandedItems.includes(value);

  const itemContext: AccordionItemContextValue = {
    value,
    isExpanded,
    triggerId: `${accordionId}-trigger-${value}`,
    contentId: `${accordionId}-content-${value}`,
  };

  return (
    <AccordionItemContext.Provider value={itemContext}>
      <div
        className={cn('border-b', className)}
        data-state={isExpanded ? 'open' : 'closed'}
        data-disabled={disabled || undefined}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

// ─── Trigger ────────────────────────────────────────────────

interface AccordionTriggerProps {
  children: ReactNode;
  className?: string;
}

const AccordionTrigger = forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ children, className }, ref) => {
    const { toggleItem } = useAccordionContext();
    const { value, isExpanded, triggerId, contentId } = useAccordionItemContext();

    return (
      <h3>
        <button
          ref={ref}
          id={triggerId}
          type="button"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          className={cn(
            'flex flex-1 w-full items-center justify-between py-4 font-medium transition-all hover:underline',
            className
          )}
          onClick={() => toggleItem(value)}
        >
          {children}
          <svg
            className={cn(
              'h-4 w-4 shrink-0 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </h3>
    );
  }
);

AccordionTrigger.displayName = 'Accordion.Trigger';

// ─── Content ────────────────────────────────────────────────

interface AccordionContentProps {
  children: ReactNode;
  className?: string;
}

const AccordionContent = forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ children, className }, ref) => {
    const { isExpanded, triggerId, contentId } = useAccordionItemContext();

    return (
      <div
        ref={ref}
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!isExpanded}
        className={cn(
          'overflow-hidden text-sm transition-all',
          isExpanded ? 'animate-accordion-down' : 'animate-accordion-up',
          className
        )}
      >
        <div className="pb-4 pt-0">{children}</div>
      </div>
    );
  }
);

AccordionContent.displayName = 'Accordion.Content';

// ─── Compound Export ────────────────────────────────────────

export const Accordion = Object.assign(AccordionRoot, {
  Item: AccordionItem,
  Trigger: AccordionTrigger,
  Content: AccordionContent,
});
```

### Accordion Usage

```tsx
// Single mode — only one item open at a time
<Accordion type="single" defaultValue="item-1" collapsible>
  <Accordion.Item value="item-1">
    <Accordion.Trigger>What is atomic design?</Accordion.Trigger>
    <Accordion.Content>
      Atomic design is a methodology for creating design systems...
    </Accordion.Content>
  </Accordion.Item>
  <Accordion.Item value="item-2">
    <Accordion.Trigger>Why compound components?</Accordion.Trigger>
    <Accordion.Content>
      Compound components provide flexible, accessible APIs...
    </Accordion.Content>
  </Accordion.Item>
</Accordion>

// Multiple mode — multiple items can be open simultaneously
<Accordion type="multiple" defaultValue={['item-1', 'item-3']}>
  {/* ... items ... */}
</Accordion>
```

---

## 7. Complete Implementation: Menu (React + TypeScript)

```typescript
// src/components/organisms/Menu/Menu.tsx
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useId,
  forwardRef,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { cn } from '@/utils/cn';

// ─── Context ────────────────────────────────────────────────

interface MenuContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  menuId: string;
  highlightedIndex: number;
  setHighlightedIndex: (index: number) => void;
  itemCount: number;
  registerItem: () => number;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext(): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (!ctx) {
    throw new Error('Menu components MUST be used within a <Menu> parent.');
  }
  return ctx;
}

// ─── Root ───────────────────────────────────────────────────

interface MenuProps {
  children: ReactNode;
}

function MenuRoot({ children }: MenuProps) {
  const menuId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const itemCountRef = useRef(0);

  const open = useCallback(() => {
    setIsOpen(true);
    setHighlightedIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    itemCountRef.current = 0;
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) close();
    else open();
  }, [isOpen, open, close]);

  const registerItem = useCallback(() => {
    return itemCountRef.current++;
  }, []);

  return (
    <MenuContext.Provider
      value={{
        isOpen,
        open,
        close,
        toggle,
        menuId,
        highlightedIndex,
        setHighlightedIndex,
        itemCount: itemCountRef.current,
        registerItem,
      }}
    >
      <div className="relative inline-block text-left">{children}</div>
    </MenuContext.Provider>
  );
}

// ─── Trigger ────────────────────────────────────────────────

interface MenuTriggerProps {
  children: ReactNode;
  className?: string;
}

const MenuTrigger = forwardRef<HTMLButtonElement, MenuTriggerProps>(
  ({ children, className }, ref) => {
    const { toggle, isOpen, menuId } = useMenuContext();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowDown', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        if (!isOpen) toggle();
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={`${menuId}-content`}
        className={className}
        onClick={toggle}
        onKeyDown={handleKeyDown}
      >
        {children}
      </button>
    );
  }
);

MenuTrigger.displayName = 'Menu.Trigger';

// ─── Content ────────────────────────────────────────────────

interface MenuContentProps {
  children: ReactNode;
  className?: string;
  align?: 'start' | 'end';
}

const MenuContent = forwardRef<HTMLDivElement, MenuContentProps>(
  ({ children, className, align = 'start' }, ref) => {
    const { isOpen, close, menuId } = useMenuContext();
    const contentRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: MouseEvent) => {
        if (contentRef.current && !contentRef.current.closest('[data-menu-root]')?.contains(e.target as Node)) {
          close();
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, close]);

    // Close on Escape
    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: globalThis.KeyboardEvent) => {
        if (e.key === 'Escape') close();
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }, [isOpen, close]);

    if (!isOpen) return null;

    return (
      <div
        ref={contentRef}
        id={`${menuId}-content`}
        role="menu"
        aria-orientation="vertical"
        className={cn(
          'absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
          'animate-in fade-in-0 zoom-in-95',
          align === 'end' ? 'right-0' : 'left-0',
          className
        )}
      >
        {children}
      </div>
    );
  }
);

MenuContent.displayName = 'Menu.Content';

// ─── Item ───────────────────────────────────────────────────

interface MenuItemProps {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  className?: string;
  /** Destructive action styling */
  variant?: 'default' | 'destructive';
}

const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(
  ({ children, onSelect, disabled = false, className, variant = 'default' }, ref) => {
    const { close } = useMenuContext();

    const handleClick = () => {
      if (disabled) return;
      onSelect?.();
      close();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    };

    return (
      <div
        ref={ref}
        role="menuitem"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        className={cn(
          'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground',
          disabled && 'pointer-events-none opacity-50',
          variant === 'destructive' && 'text-destructive focus:bg-destructive/10',
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    );
  }
);

MenuItem.displayName = 'Menu.Item';

// ─── Separator ──────────────────────────────────────────────

function MenuSeparator() {
  return <div className="-mx-1 my-1 h-px bg-muted" role="separator" />;
}

MenuSeparator.displayName = 'Menu.Separator';

// ─── Label ──────────────────────────────────────────────────

interface MenuLabelProps {
  children: ReactNode;
  className?: string;
}

function MenuLabel({ children, className }: MenuLabelProps) {
  return (
    <div className={cn('px-2 py-1.5 text-xs font-semibold text-muted-foreground', className)}>
      {children}
    </div>
  );
}

MenuLabel.displayName = 'Menu.Label';

// ─── Compound Export ────────────────────────────────────────

export const Menu = Object.assign(MenuRoot, {
  Trigger: MenuTrigger,
  Content: MenuContent,
  Item: MenuItem,
  Separator: MenuSeparator,
  Label: MenuLabel,
});
```

### Menu Usage

```tsx
<Menu>
  <Menu.Trigger>
    <Button variant="outline" size="icon">
      <Icon name="more-vertical" size={16} />
    </Button>
  </Menu.Trigger>
  <Menu.Content align="end">
    <Menu.Label>Actions</Menu.Label>
    <Menu.Item onSelect={() => navigate(`/users/${id}`)}>
      <Icon name="user" size={16} className="mr-2" /> View Profile
    </Menu.Item>
    <Menu.Item onSelect={() => openEditModal(id)}>
      <Icon name="edit" size={16} className="mr-2" /> Edit
    </Menu.Item>
    <Menu.Separator />
    <Menu.Item variant="destructive" onSelect={() => deleteUser(id)}>
      <Icon name="trash" size={16} className="mr-2" /> Delete
    </Menu.Item>
  </Menu.Content>
</Menu>
```

---

## 8. Vue 3 Compound Components (provide/inject + Scoped Slots)

```vue
<!-- src/components/organisms/Tabs/Tabs.vue -->
<script setup lang="ts">
import { provide, ref, readonly, type InjectionKey } from 'vue';

export interface TabsContext {
  activeValue: Readonly<Ref<string>>;
  onValueChange: (value: string) => void;
  tabsId: string;
}

export const TABS_INJECTION_KEY: InjectionKey<TabsContext> = Symbol('Tabs');

interface Props {
  defaultValue: string;
  modelValue?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const internalValue = ref(props.defaultValue);
const activeValue = computed(() => props.modelValue ?? internalValue.value);

const tabsId = `tabs-${Math.random().toString(36).slice(2, 9)}`;

function onValueChange(value: string) {
  internalValue.value = value;
  emit('update:modelValue', value);
}

// ALWAYS use provide/inject for Vue compound components
provide(TABS_INJECTION_KEY, {
  activeValue: readonly(activeValue),
  onValueChange,
  tabsId,
});
</script>

<template>
  <div>
    <slot />
  </div>
</template>
```

```vue
<!-- src/components/organisms/Tabs/TabsTrigger.vue -->
<script setup lang="ts">
import { inject, computed } from 'vue';
import { TABS_INJECTION_KEY, type TabsContext } from './Tabs.vue';

interface Props {
  value: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), { disabled: false });

// ALWAYS throw if context is missing — fail-fast
const ctx = inject(TABS_INJECTION_KEY);
if (!ctx) throw new Error('TabsTrigger must be used inside <Tabs>');

const isActive = computed(() => ctx.activeValue.value === props.value);
</script>

<template>
  <button
    type="button"
    role="tab"
    :id="`${ctx.tabsId}-trigger-${value}`"
    :aria-selected="isActive"
    :aria-controls="`${ctx.tabsId}-content-${value}`"
    :tabindex="isActive ? 0 : -1"
    :disabled="disabled"
    :class="[
      'px-3 py-1.5 text-sm font-medium rounded-sm transition-all',
      isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
    ]"
    @click="ctx.onValueChange(value)"
  >
    <slot />
  </button>
</template>
```

```vue
<!-- src/components/organisms/Tabs/TabsContent.vue -->
<script setup lang="ts">
import { inject, computed } from 'vue';
import { TABS_INJECTION_KEY } from './Tabs.vue';

interface Props {
  value: string;
}

const props = defineProps<Props>();

const ctx = inject(TABS_INJECTION_KEY);
if (!ctx) throw new Error('TabsContent must be used inside <Tabs>');

const isActive = computed(() => ctx.activeValue.value === props.value);
</script>

<template>
  <div
    v-if="isActive"
    role="tabpanel"
    :id="`${ctx.tabsId}-content-${value}`"
    :aria-labelledby="`${ctx.tabsId}-trigger-${value}`"
    tabindex="0"
  >
    <slot />
  </div>
</template>
```

### Vue Usage

```vue
<template>
  <Tabs default-value="overview">
    <TabsList>
      <TabsTrigger value="overview">Overview</TabsTrigger>
      <TabsTrigger value="analytics">Analytics</TabsTrigger>
    </TabsList>
    <TabsContent value="overview">
      <OverviewPanel />
    </TabsContent>
    <TabsContent value="analytics">
      <AnalyticsPanel />
    </TabsContent>
  </Tabs>
</template>
```

---

## 9. Angular Content Projection (ng-content + ngTemplateOutlet)

```typescript
// tabs.component.ts
import {
  Component,
  ContentChildren,
  QueryList,
  AfterContentInit,
  Input,
  Output,
  EventEmitter,
  TemplateRef,
} from '@angular/core';

@Component({
  selector: 'app-tab',
  template: `
    <ng-template #content>
      <ng-content></ng-content>
    </ng-template>
  `,
})
export class TabComponent {
  @Input({ required: true }) value!: string;
  @Input({ required: true }) label!: string;
  @Input() disabled = false;
  @ViewChild('content') contentTemplate!: TemplateRef<unknown>;
}

@Component({
  selector: 'app-tabs',
  template: `
    <div>
      <div role="tablist" class="flex border-b">
        @for (tab of tabs; track tab.value) {
          <button
            role="tab"
            [attr.aria-selected]="tab.value === activeValue"
            [attr.aria-controls]="'panel-' + tab.value"
            [id]="'tab-' + tab.value"
            [tabindex]="tab.value === activeValue ? 0 : -1"
            [disabled]="tab.disabled"
            [class.active]="tab.value === activeValue"
            (click)="selectTab(tab.value)"
          >
            {{ tab.label }}
          </button>
        }
      </div>
      @for (tab of tabs; track tab.value) {
        @if (tab.value === activeValue) {
          <div
            role="tabpanel"
            [id]="'panel-' + tab.value"
            [attr.aria-labelledby]="'tab-' + tab.value"
          >
            <ng-container [ngTemplateOutlet]="tab.contentTemplate" />
          </div>
        }
      }
    </div>
  `,
})
export class TabsComponent implements AfterContentInit {
  @Input() defaultValue = '';
  @Output() valueChange = new EventEmitter<string>();

  @ContentChildren(TabComponent) tabs!: QueryList<TabComponent>;

  activeValue = '';

  ngAfterContentInit() {
    this.activeValue = this.defaultValue || this.tabs.first?.value || '';
  }

  selectTab(value: string) {
    this.activeValue = value;
    this.valueChange.emit(value);
  }
}
```

### Angular Usage

```html
<app-tabs defaultValue="overview" (valueChange)="onTabChange($event)">
  <app-tab value="overview" label="Overview">
    <app-overview-panel />
  </app-tab>
  <app-tab value="analytics" label="Analytics">
    <app-analytics-panel />
  </app-tab>
  <app-tab value="settings" label="Settings" [disabled]="true">
    <app-settings-panel />
  </app-tab>
</app-tabs>
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Prop drilling instead of Context** | Parent passes `isOpen`, `onToggle`, `value` to every child via props | Use Context — compound children read state implicitly |
| **cloneElement for new code** | `React.Children.map` + `cloneElement` to inject props | MIGRATE to Context-based pattern — cloneElement breaks with wrappers |
| **Missing error boundary on context** | `useContext` returns `undefined`, silent bugs | ALWAYS throw in custom hook: `if (!ctx) throw new Error(...)` |
| **State in children** | `Select.Item` owns its own `isSelected` state | Children NEVER own state — they READ from context |
| **Missing ARIA attributes** | Tab component without `role="tab"`, `aria-selected`, `aria-controls` | See ARIA checklist below — compound components MUST be accessible |
| **No keyboard navigation** | Dropdown only works with mouse clicks | MUST implement Arrow key nav, Enter/Space selection, Escape to close |
| **Monolithic compound** | Single 800-line file with all sub-components | Split: Root, Context, Trigger, Content, Item in separate files |
| **Circular context dependency** | Child updates trigger parent re-render which re-renders all children | Memoize context value with `useMemo`; split read/write contexts |
| **Missing displayName** | React DevTools shows `<ForwardRef>` instead of `Select.Trigger` | ALWAYS set `Component.displayName = 'Parent.Child'` |
| **Forgetting forwardRef** | Cannot access DOM node of compound child | ALWAYS use `forwardRef` on compound children for ref forwarding |

---

## 11. ARIA Checklist for Compound Components

| Component | Required ARIA | Keyboard Navigation |
|---|---|---|
| **Select** | `role="combobox"` on trigger, `role="listbox"` on content, `role="option"` on items, `aria-expanded`, `aria-selected`, `aria-activedescendant` | ArrowUp/Down to navigate, Enter/Space to select, Escape to close, Home/End |
| **Tabs** | `role="tablist"` on list, `role="tab"` on triggers, `role="tabpanel"` on content, `aria-selected`, `aria-controls`, `aria-labelledby` | Arrow Left/Right (horizontal), Arrow Up/Down (vertical), Home/End |
| **Accordion** | `aria-expanded` on trigger, `aria-controls` pointing to content, `role="region"` on content, `aria-labelledby` | Enter/Space to toggle, Arrow Up/Down between triggers |
| **Menu** | `role="menu"` on content, `role="menuitem"` on items, `aria-haspopup` on trigger, `aria-expanded` | ArrowUp/Down to navigate, Enter/Space to activate, Escape to close |

---

## 12. Enforcement Checklist

```
PRE-COMMIT / CODE REVIEW CHECKLIST:

[ ] Compound component uses Context (NOT cloneElement) for state sharing
[ ] Context hook throws descriptive error when used outside provider
[ ] Root component supports BOTH controlled and uncontrolled usage
[ ] All sub-components have displayName set to "Parent.Child" format
[ ] All interactive sub-components use forwardRef
[ ] Compound export uses Object.assign pattern for dot-notation API
[ ] ALL required ARIA roles are present (see Section 11)
[ ] ALL required ARIA states are present (expanded, selected, etc.)
[ ] Keyboard navigation fully implemented (Arrow, Enter, Space, Escape, Home, End)
[ ] Focus management implemented (focus trap for modals, roving tabindex for tabs)
[ ] Context value is memoized with useMemo to prevent unnecessary re-renders
[ ] Type-safe: all props, context values, and events have TypeScript types
[ ] Sub-components are in separate files (not one monolithic file)
[ ] Index.ts barrel file exports ONLY the compound root + its types
[ ] Unit tests verify: state sharing, keyboard nav, ARIA attributes, edge cases
```
