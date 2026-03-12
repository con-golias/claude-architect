# Compound Components — Complete Specification

> **AI Plugin Directive:** When building components that share implicit state, creating flexible multi-part APIs, or designing components with related sub-components (tabs, accordions, menus, selects), ALWAYS consult this guide. Apply compound component patterns to create flexible, declarative component APIs. This guide covers Context-based compounds, slot patterns, render delegation, controlled/uncontrolled variants, and framework implementations.

**Core Rule: Use compound components when a parent component manages shared state consumed by multiple child components. The parent provides context, children consume it. This creates declarative, composable APIs like `<Tabs><Tab>` instead of monolithic config objects. ALWAYS use React Context (or Vue provide/inject) for implicit state sharing — NEVER rely on `React.Children.map` or `cloneElement` for production compound components.**

---

## 1. What Are Compound Components

```
                    COMPOUND COMPONENT PATTERN

  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │   MONOLITHIC API (Bad)         COMPOUND API (Good)  │
  │                                                     │
  │   <Select                      <Select              │
  │     options={[                   value={v}           │
  │       {value:'a', label:'A'},    onChange={fn}       │
  │       {value:'b', label:'B'},  >                    │
  │     ]}                           <Select.Trigger>   │
  │     value={v}                      Choose...        │
  │     onChange={fn}                </Select.Trigger>   │
  │     renderOption={...}           <Select.Content>   │
  │     renderTrigger={...}            <Select.Item      │
  │     onOpen={...}                     value="a">     │
  │     triggerClassName={...}           Option A        │
  │     menuClassName={...}            </Select.Item>   │
  │     placeholder="..."              <Select.Item     │
  │   />                                 value="b">     │
  │                                      Option B       │
  │   Problem: Prop explosion          </Select.Item>   │
  │   Problem: Hard to customize     </Select.Content>  │
  │   Problem: Limited flexibility   </Select>          │
  │                                                     │
  │                                  ✅ Composable       │
  │                                  ✅ Extensible        │
  │                                  ✅ Readable           │
  └─────────────────────────────────────────────────────┘
```

---

## 2. Implementation Pattern: Context-Based

### 2.1 Tabs Component

```typescript
// compound/Tabs.tsx — Complete compound Tabs implementation
import {
  createContext, useContext, useState, useCallback, useId,
  type ReactNode, type KeyboardEvent,
} from 'react';
import { cn } from '@/lib/utils';

// ─── Context ───
interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
  baseId: string;
  orientation: 'horizontal' | 'vertical';
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(
      'Tabs compound components must be used within a <Tabs> parent. ' +
      'Wrap your Tab, TabList, and TabPanel components inside <Tabs>.'
    );
  }
  return context;
}

// ─── Root: Tabs ───
interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  children: ReactNode;
  className?: string;
}

function Tabs({
  defaultValue, value, onValueChange,
  orientation = 'horizontal', children, className,
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const baseId = useId();

  // Support both controlled and uncontrolled modes
  const activeTab = value !== undefined ? value : internalValue;
  const setActiveTab = useCallback((newValue: string) => {
    if (value === undefined) setInternalValue(newValue);
    onValueChange?.(newValue);
  }, [value, onValueChange]);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, baseId, orientation }}>
      <div
        className={cn('flex', orientation === 'vertical' ? 'flex-row' : 'flex-col', className)}
        data-orientation={orientation}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

// ─── TabList ───
interface TabListProps {
  children: ReactNode;
  className?: string;
}

function TabList({ children, className }: TabListProps) {
  const { orientation } = useTabsContext();

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
    );
    const currentIndex = tabs.indexOf(e.target as HTMLButtonElement);
    if (currentIndex === -1) return;

    const isHorizontal = orientation === 'horizontal';
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';

    let nextIndex: number | null = null;

    switch (e.key) {
      case nextKey:
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case prevKey:
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  };

  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex',
        orientation === 'horizontal' ? 'flex-row border-b' : 'flex-col border-r',
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Tab (Trigger) ───
interface TabProps {
  value: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

function Tab({ value, disabled, children, className }: TabProps) {
  const { activeTab, setActiveTab, baseId } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-controls={`${baseId}-panel-${value}`}
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => setActiveTab(value)}
      className={cn(
        'px-4 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'border-b-2 border-primary text-primary'
          : 'text-muted-foreground hover:text-foreground',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {children}
    </button>
  );
}

// ─── TabPanel ───
interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
  forceMount?: boolean;
}

function TabPanel({ value, children, className, forceMount }: TabPanelProps) {
  const { activeTab, baseId } = useTabsContext();
  const isActive = activeTab === value;

  if (!isActive && !forceMount) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      hidden={!isActive}
      className={cn('mt-2 focus-visible:outline-none', className)}
    >
      {children}
    </div>
  );
}

// ─── Attach sub-components ───
Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panel = TabPanel;

export { Tabs };
```

### 2.2 Usage

```tsx
// Clean, declarative API
function SettingsPage() {
  return (
    <Tabs defaultValue="general">
      <Tabs.List>
        <Tabs.Tab value="general">General</Tabs.Tab>
        <Tabs.Tab value="security">Security</Tabs.Tab>
        <Tabs.Tab value="billing">Billing</Tabs.Tab>
        <Tabs.Tab value="api" disabled>API (Coming Soon)</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="general">
        <GeneralSettings />
      </Tabs.Panel>
      <Tabs.Panel value="security">
        <SecuritySettings />
      </Tabs.Panel>
      <Tabs.Panel value="billing">
        <BillingSettings />
      </Tabs.Panel>
    </Tabs>
  );
}
```

---

## 3. Accordion Compound Component

```typescript
// compound/Accordion.tsx
import {
  createContext, useContext, useState, useCallback, useRef, useId,
  type ReactNode, type KeyboardEvent,
} from 'react';

// ─── Context ───
interface AccordionContextValue {
  expandedItems: Set<string>;
  toggleItem: (id: string) => void;
  type: 'single' | 'multiple';
  baseId: string;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordionContext() {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error('Accordion sub-components must be used within <Accordion>');
  return ctx;
}

// ─── Root ───
interface AccordionProps {
  type?: 'single' | 'multiple';
  defaultExpanded?: string[];
  children: ReactNode;
  className?: string;
}

function Accordion({ type = 'single', defaultExpanded = [], children, className }: AccordionProps) {
  const [expandedItems, setExpandedItems] = useState(new Set(defaultExpanded));
  const baseId = useId();

  const toggleItem = useCallback((id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (type === 'single') next.clear();
        next.add(id);
      }
      return next;
    });
  }, [type]);

  return (
    <AccordionContext.Provider value={{ expandedItems, toggleItem, type, baseId }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  );
}

// ─── Item ───
interface AccordionItemContextValue {
  itemId: string;
  isExpanded: boolean;
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

function useAccordionItemContext() {
  const ctx = useContext(AccordionItemContext);
  if (!ctx) throw new Error('AccordionTrigger/Content must be within AccordionItem');
  return ctx;
}

interface AccordionItemProps {
  value: string;
  children: ReactNode;
  className?: string;
}

function AccordionItem({ value, children, className }: AccordionItemProps) {
  const { expandedItems } = useAccordionContext();
  const isExpanded = expandedItems.has(value);

  return (
    <AccordionItemContext.Provider value={{ itemId: value, isExpanded }}>
      <div className={cn('border-b', className)} data-state={isExpanded ? 'open' : 'closed'}>
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

// ─── Trigger ───
function AccordionTrigger({ children, className }: { children: ReactNode; className?: string }) {
  const { toggleItem, baseId } = useAccordionContext();
  const { itemId, isExpanded } = useAccordionItemContext();

  return (
    <h3>
      <button
        id={`${baseId}-trigger-${itemId}`}
        aria-controls={`${baseId}-content-${itemId}`}
        aria-expanded={isExpanded}
        onClick={() => toggleItem(itemId)}
        className={cn(
          'flex w-full items-center justify-between py-4 text-sm font-medium transition-all',
          'hover:underline [&[aria-expanded=true]>svg]:rotate-180',
          className
        )}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
      </button>
    </h3>
  );
}

// ─── Content ───
function AccordionContent({ children, className }: { children: ReactNode; className?: string }) {
  const { baseId } = useAccordionContext();
  const { itemId, isExpanded } = useAccordionItemContext();
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div
      id={`${baseId}-content-${itemId}`}
      role="region"
      aria-labelledby={`${baseId}-trigger-${itemId}`}
      className={cn(
        'overflow-hidden transition-all duration-300',
        isExpanded ? 'animate-accordion-open' : 'animate-accordion-closed h-0',
        className
      )}
    >
      <div ref={contentRef} className="pb-4 pt-0">
        {children}
      </div>
    </div>
  );
}

// ─── Attach ───
Accordion.Item = AccordionItem;
Accordion.Trigger = AccordionTrigger;
Accordion.Content = AccordionContent;

export { Accordion };
```

---

## 4. Select / Dropdown Compound Component

```typescript
// compound/Select.tsx — Accessible select with compound pattern
import {
  createContext, useContext, useState, useRef, useCallback, useId, useEffect,
  type ReactNode,
} from 'react';

interface SelectContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  value: string;
  setValue: (value: string) => void;
  highlightedIndex: number;
  setHighlightedIndex: (index: number) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  listRef: React.RefObject<HTMLDivElement>;
  baseId: string;
  options: string[];
  registerOption: (value: string) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error('Select sub-components must be within <Select>');
  return ctx;
}

// ─── Root ───
interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

function Select({ value: controlledValue, defaultValue = '', onValueChange, children }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [options, setOptions] = useState<string[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null!);
  const listRef = useRef<HTMLDivElement>(null!);
  const baseId = useId();

  const value = controlledValue ?? internalValue;
  const setValue = useCallback((v: string) => {
    if (controlledValue === undefined) setInternalValue(v);
    onValueChange?.(v);
    setOpen(false);
    triggerRef.current?.focus();
  }, [controlledValue, onValueChange]);

  const registerOption = useCallback((optionValue: string) => {
    setOptions(prev => prev.includes(optionValue) ? prev : [...prev, optionValue]);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) &&
          !listRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <SelectContext.Provider value={{
      open, setOpen, value, setValue, highlightedIndex,
      setHighlightedIndex, triggerRef, listRef, baseId, options, registerOption,
    }}>
      <div className="relative inline-block">{children}</div>
    </SelectContext.Provider>
  );
}

// ─── Trigger ───
function SelectTrigger({ children, className, placeholder }: {
  children?: ReactNode;
  className?: string;
  placeholder?: string;
}) {
  const { open, setOpen, value, triggerRef, baseId, options, setHighlightedIndex } = useSelectContext();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
        e.preventDefault();
        setOpen(true);
        setHighlightedIndex(0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setOpen(true);
        setHighlightedIndex(options.length - 1);
        break;
    }
  };

  return (
    <button
      ref={triggerRef}
      id={`${baseId}-trigger`}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={`${baseId}-listbox`}
      onClick={() => setOpen(!open)}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm',
        'focus:outline-none focus:ring-2 focus:ring-ring',
        !value && 'text-muted-foreground',
        className
      )}
    >
      {children || value || placeholder || 'Select...'}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
}

// ─── Content (Dropdown) ───
function SelectContent({ children, className }: { children: ReactNode; className?: string }) {
  const { open, listRef, baseId, highlightedIndex, setHighlightedIndex, setValue, options } = useSelectContext();

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(Math.min(highlightedIndex + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(Math.max(highlightedIndex - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (options[highlightedIndex]) setValue(options[highlightedIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        const { setOpen, triggerRef } = useSelectContext();
        setOpen(false);
        triggerRef.current?.focus();
        break;
    }
  };

  return (
    <div
      ref={listRef}
      id={`${baseId}-listbox`}
      role="listbox"
      onKeyDown={handleKeyDown}
      className={cn(
        'absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md',
        'animate-in fade-in-0 zoom-in-95',
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Item ───
function SelectItem({ value, children, disabled, className }: {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const ctx = useSelectContext();
  const index = ctx.options.indexOf(value);
  const isHighlighted = ctx.highlightedIndex === index;
  const isSelected = ctx.value === value;

  // Register this option
  useEffect(() => {
    ctx.registerOption(value);
  }, [value]);

  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      data-highlighted={isHighlighted}
      onClick={() => !disabled && ctx.setValue(value)}
      onMouseEnter={() => ctx.setHighlightedIndex(index)}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm',
        isHighlighted && 'bg-accent text-accent-foreground',
        isSelected && 'font-semibold',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
    >
      {isSelected && <CheckIcon className="mr-2 h-4 w-4" />}
      {children}
    </div>
  );
}

// ─── Attach ───
Select.Trigger = SelectTrigger;
Select.Content = SelectContent;
Select.Item = SelectItem;

export { Select };
```

---

## 5. Slot Pattern (Vue / Web Components)

### 5.1 Vue Named Slots

```vue
<!-- compound/VCard.vue — Vue slot-based compound component -->
<script setup lang="ts">
interface Props {
  variant?: 'default' | 'outlined' | 'elevated';
}

withDefaults(defineProps<Props>(), { variant: 'default' });
</script>

<template>
  <div :class="['rounded-lg', variantClasses[variant]]">
    <!-- Named slots act as compound sub-components -->
    <div v-if="$slots.header" class="border-b px-6 py-4">
      <slot name="header" />
    </div>

    <div class="px-6 py-4">
      <slot />  <!-- Default slot = content -->
    </div>

    <div v-if="$slots.footer" class="border-t px-6 py-4">
      <slot name="footer" />
    </div>

    <!-- Scoped slot — passes data UP to parent -->
    <div v-if="$slots.actions" class="flex gap-2 px-6 py-4">
      <slot name="actions" :close="handleClose" :loading="isLoading" />
    </div>
  </div>
</template>
```

```vue
<!-- Usage with named slots -->
<VCard variant="elevated">
  <template #header>
    <h2 class="text-lg font-bold">Card Title</h2>
  </template>

  <p>Card content goes here.</p>

  <template #actions="{ close, loading }">
    <button @click="close" :disabled="loading">Cancel</button>
    <button @click="save" :disabled="loading">Save</button>
  </template>
</VCard>
```

### 5.2 Vue Compound with provide/inject

```vue
<!-- compound/VTabs.vue — Vue compound using provide/inject -->
<script setup lang="ts">
import { provide, ref, type InjectionKey } from 'vue';

interface TabsContext {
  activeTab: Ref<string>;
  setActiveTab: (id: string) => void;
}

export const TabsKey: InjectionKey<TabsContext> = Symbol('tabs');

const props = defineProps<{
  defaultValue?: string;
  modelValue?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const internalValue = ref(props.defaultValue || '');
const activeTab = computed(() => props.modelValue ?? internalValue.value);

function setActiveTab(id: string) {
  internalValue.value = id;
  emit('update:modelValue', id);
}

provide(TabsKey, { activeTab, setActiveTab });
</script>

<template>
  <div class="tabs">
    <slot />
  </div>
</template>
```

```vue
<!-- compound/VTab.vue -->
<script setup lang="ts">
import { inject } from 'vue';
import { TabsKey } from './VTabs.vue';

const props = defineProps<{ value: string; disabled?: boolean }>();
const { activeTab, setActiveTab } = inject(TabsKey)!;
</script>

<template>
  <button
    role="tab"
    :aria-selected="activeTab === value"
    :disabled="disabled"
    @click="setActiveTab(value)"
    :class="activeTab === value ? 'border-b-2 border-primary' : 'text-muted'"
  >
    <slot />
  </button>
</template>
```

---

## 6. Render Delegation Pattern

```typescript
// Advanced: Component that delegates rendering to children via render props

interface DataListProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderHeader?: () => ReactNode;
  renderFooter?: () => ReactNode;
  renderSeparator?: () => ReactNode;
}

function DataList<T>({
  items, keyExtractor, renderItem, renderEmpty, renderHeader, renderFooter, renderSeparator,
}: DataListProps<T>) {
  if (items.length === 0 && renderEmpty) return <>{renderEmpty()}</>;

  return (
    <div role="list">
      {renderHeader?.()}
      {items.map((item, index) => (
        <Fragment key={keyExtractor(item)}>
          {index > 0 && renderSeparator?.()}
          <div role="listitem">{renderItem(item, index)}</div>
        </Fragment>
      ))}
      {renderFooter?.()}
    </div>
  );
}

// Usage — caller controls rendering, component controls structure
<DataList
  items={users}
  keyExtractor={(u) => u.id}
  renderItem={(user) => <UserCard user={user} />}
  renderEmpty={() => <EmptyState message="No users found" />}
  renderSeparator={() => <Divider />}
/>
```

---

## 7. Controlled vs Uncontrolled Compound Components

```typescript
// Pattern: Support BOTH controlled and uncontrolled modes

interface UseControllableStateProps<T> {
  value?: T;                    // Controlled value
  defaultValue: T;              // Initial uncontrolled value
  onChange?: (value: T) => void; // Change callback
}

function useControllableState<T>({
  value: controlledValue,
  defaultValue,
  onChange,
}: UseControllableStateProps<T>): [T, (value: T) => void] {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;

  const value = isControlled ? controlledValue : uncontrolledValue;

  const setValue = useCallback((nextValue: T) => {
    if (!isControlled) {
      setUncontrolledValue(nextValue);
    }
    onChange?.(nextValue);
  }, [isControlled, onChange]);

  return [value, setValue];
}

// Usage in compound component root
function Disclosure({ open, defaultOpen = false, onOpenChange, children }: DisclosureProps) {
  const [isOpen, setIsOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  return (
    <DisclosureContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </DisclosureContext.Provider>
  );
}

// Controlled usage (parent owns state)
const [open, setOpen] = useState(false);
<Disclosure open={open} onOpenChange={setOpen}>...</Disclosure>

// Uncontrolled usage (component owns state)
<Disclosure defaultOpen={true}>...</Disclosure>
```

---

## 8. Error Boundary for Compound Components

```typescript
// ALWAYS throw clear errors when compound components are used incorrectly

function useCompoundContext<T>(
  context: React.Context<T | null>,
  componentName: string,
  parentName: string
): T {
  const ctx = useContext(context);
  if (ctx === null) {
    throw new Error(
      `<${componentName}> must be used within a <${parentName}> component. ` +
      `Example:\n\n` +
      `  <${parentName}>\n` +
      `    <${componentName}>...</${componentName}>\n` +
      `  </${parentName}>`
    );
  }
  return ctx;
}

// Usage
const TabsContext = createContext<TabsContextValue | null>(null);
function useTabsContext() {
  return useCompoundContext(TabsContext, 'Tabs.Tab', 'Tabs');
}
```

---

## 9. Sub-Component Registration Pattern

```typescript
// Pattern for registering sub-components on the parent

// Method 1: Object.assign (most common)
function Tabs(props: TabsProps) { /* ... */ }
Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panel = TabPanel;

// Method 2: Namespace object
const Tabs = {
  Root: TabsRoot,
  List: TabList,
  Tab: Tab,
  Panel: TabPanel,
};

// Method 3: displayName validation
function TabList(props: TabListProps) { /* ... */ }
TabList.displayName = 'Tabs.List';

// In parent, validate children
function Tabs({ children }: TabsProps) {
  React.Children.forEach(children, child => {
    if (React.isValidElement(child)) {
      const displayName = (child.type as any).displayName;
      if (!displayName?.startsWith('Tabs.')) {
        console.warn(`<Tabs> received unexpected child: ${displayName || 'unknown'}`);
      }
    }
  });
  return /* ... */;
}
```

---

## 10. TypeScript for Compound Components

```typescript
// Strong typing for compound component APIs

// ─── Type-safe context ───
interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// ─── Discriminated union for compound variants ───
type AccordionProps =
  | { type: 'single'; value?: string; onValueChange?: (value: string) => void }
  | { type: 'multiple'; value?: string[]; onValueChange?: (value: string[]) => void };

// ─── Generic compound components ───
interface SelectProps<T extends string = string> {
  value?: T;
  onValueChange?: (value: T) => void;
  children: ReactNode;
}

interface SelectItemProps<T extends string = string> {
  value: T;
  children: ReactNode;
}

// Usage with literal types
<Select<'small' | 'medium' | 'large'>
  value="medium"
  onValueChange={(size) => {
    // size is typed as 'small' | 'medium' | 'large'
  }}
>
  <Select.Item value="small">Small</Select.Item>
  <Select.Item value="medium">Medium</Select.Item>
  <Select.Item value="large">Large</Select.Item>
</Select>

// ─── Compound component type declaration ───
interface TabsComponent {
  (props: TabsProps): JSX.Element;
  List: typeof TabList;
  Tab: typeof Tab;
  Panel: typeof TabPanel;
}

const Tabs: TabsComponent = Object.assign(TabsRoot, {
  List: TabList,
  Tab: Tab,
  Panel: TabPanel,
});
```

---

## 11. Real-World Compound Components

| Component | Sub-Components | Shared State |
|-----------|---------------|--------------|
| Tabs | Tabs, TabList, Tab, TabPanel | Active tab index |
| Accordion | Accordion, Item, Trigger, Content | Expanded items set |
| Select | Select, Trigger, Content, Item, Group | Open state, selected value |
| Dialog/Modal | Dialog, Trigger, Content, Close, Title, Description | Open state |
| Menu/Dropdown | Menu, Trigger, Content, Item, Separator, Label | Open state, highlighted index |
| Combobox | Combobox, Input, Popover, Item, Empty | Open, value, search query |
| Toast | ToastProvider, Toast, Title, Description, Action, Close | Toast queue |
| NavigationMenu | Menu, List, Item, Trigger, Content, Link | Active item, open submenu |
| Collapsible | Collapsible, Trigger, Content | Open state |
| HoverCard | HoverCard, Trigger, Content | Open state (hover-controlled) |

---

## 12. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| `React.Children.map` + `cloneElement` | Breaks with fragments, wrappers, conditional children | Use Context for state sharing |
| Monolithic config object | `<Select options={[...]} renderItem={...} />` — prop explosion | Compound pattern with sub-components |
| No context error boundary | Silent failures when sub-component used outside parent | `throw new Error()` in `useContext` hook |
| Tight coupling to parent's DOM | Sub-component relies on parent's DOM structure | Use Context, not DOM traversal |
| No controlled/uncontrolled support | Component only works one way | Support both via `useControllableState` |
| Missing keyboard navigation | Tab/Arrow keys don't work in compound widget | Implement full WAI-ARIA keyboard patterns |
| No TypeScript generics | Value type not inferred from items | Add generic type parameter `<T>` |
| Direct state mutation | `expandedItems.add(id)` mutates set | Create new Set: `new Set([...prev, id])` |
| Missing `displayName` | Poor DevTools experience | Set `.displayName` on all sub-components |
| No ARIA attributes | Component not accessible to screen readers | Add `role`, `aria-*` attributes per WAI-ARIA |

---

## 13. Enforcement Checklist

- [ ] Compound components use Context (not `cloneElement`) for state sharing
- [ ] Every compound component throws a descriptive error when used outside its parent
- [ ] Both controlled and uncontrolled modes are supported
- [ ] Full keyboard navigation implemented per WAI-ARIA authoring practices
- [ ] ARIA roles, states, and properties correctly set on all elements
- [ ] `useId()` generates unique IDs for ARIA relationships (`aria-controls`, `aria-labelledby`)
- [ ] Sub-components registered on parent via `Object.assign` or namespace
- [ ] TypeScript types are complete, with generics where appropriate
- [ ] Focus management handled (trap focus in modals, restore focus on close)
- [ ] Animation states handled (mount/unmount transitions with `forceMount`)
- [ ] `displayName` set on all sub-components for DevTools
- [ ] No prop explosion — complex components use compound pattern over config objects
- [ ] Context value is memoized to prevent unnecessary re-renders
- [ ] Event handlers prevent default where appropriate (keyboard events)
