# Atomic Design Component Architecture — Complete Specification

> **AI Plugin Directive:** When a developer asks "how should I organize my components?", "what is atomic design?", "how do I structure a component library?", "should I use atoms/molecules/organisms?", or "how do I decide if a component is an atom or molecule?", use this directive. Atomic Design is the ONLY proven methodology for scaling component libraries beyond 50 components. ALWAYS apply these rules when generating component hierarchies, Storybook structures, or design system file organization. Every component MUST be classified into exactly ONE atomic level. Components that span levels indicate a design smell — decompose them.

---

## 1. The Core Rule

**Every UI component MUST belong to exactly ONE atomic level: Atom, Molecule, Organism, Template, or Page. Components at level N MUST only compose components from level N-1 or below. NEVER allow an Atom to import a Molecule. NEVER allow a Molecule to import an Organism. This one-directional dependency flow is NON-NEGOTIABLE.**

```
DEPENDENCY FLOW — ONE DIRECTION ONLY (bottom to top):

  ┌─────────────────────────────────────────────────────┐
  │                      PAGES                          │
  │  (route-level, data-fetching, side-effects)         │
  │  Compose: Templates + Organisms + Molecules         │
  ├─────────────────────────────────────────────────────┤
  │                    TEMPLATES                        │
  │  (layout shells, slot-based, no data)               │
  │  Compose: Organisms + Molecules (via slots/props)   │
  ├─────────────────────────────────────────────────────┤
  │                    ORGANISMS                        │
  │  (self-contained sections, may have local state)    │
  │  Compose: Molecules + Atoms                         │
  ├─────────────────────────────────────────────────────┤
  │                    MOLECULES                        │
  │  (small groups, single responsibility)              │
  │  Compose: Atoms only                                │
  ├─────────────────────────────────────────────────────┤
  │                      ATOMS                          │
  │  (primitives, no children components, leaf nodes)   │
  │  Compose: HTML elements + styles only               │
  └─────────────────────────────────────────────────────┘

  NEVER import upward. NEVER skip levels for imports.
```

---

## 2. Level Definitions and Rules

### Level 1: Atoms

**Atoms are the smallest indivisible UI components. They wrap exactly ONE native HTML element (or a very small cluster like `<label>` + visually-hidden text). Atoms MUST NOT import other components. Atoms MUST be fully controlled via props. Atoms MUST NOT contain business logic or API calls.**

```
ATOMS — Leaf Components
┌──────────────┬──────────────┬──────────────┬──────────────┐
│   Button     │    Input     │    Label     │    Icon      │
├──────────────┼──────────────┼──────────────┼──────────────┤
│   Badge      │   Avatar     │   Spinner    │  Checkbox    │
├──────────────┼──────────────┼──────────────┼──────────────┤
│   Tooltip    │    Tag       │  Separator   │   Switch     │
├──────────────┼──────────────┼──────────────┼──────────────┤
│  Typography  │    Link      │   Skeleton   │   Radio      │
└──────────────┴──────────────┴──────────────┴──────────────┘

RULE: If you can split it further into meaningful UI pieces,
      it is NOT an atom.
```

#### Atom TypeScript/React Example: Button

```typescript
// src/components/atoms/Button/Button.tsx
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

// ALWAYS define variants with cva or equivalent for atoms
const buttonVariants = cva(
  // Base classes — ALWAYS present
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
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

// ALWAYS export the variant type for molecule-level consumption
export type ButtonVariants = VariantProps<typeof buttonVariants>;

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariants {
  /** Content rendered inside the button */
  children: ReactNode;
  /** Optional icon rendered before children */
  leftIcon?: ReactNode;
  /** Optional icon rendered after children */
  rightIcon?: ReactNode;
  /** Loading state — disables button and shows spinner */
  isLoading?: boolean;
}

/**
 * Button atom — the foundational interactive element.
 *
 * RULES:
 * - MUST forward ref for compound component patterns
 * - MUST spread remaining props onto the native element
 * - MUST support all native button attributes
 * - NEVER fetch data or manage global state
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      children,
      leftIcon,
      rightIcon,
      isLoading = false,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : leftIcon ? (
          <span className="mr-2 flex-shrink-0">{leftIcon}</span>
        ) : null}
        {children}
        {rightIcon && !isLoading && (
          <span className="ml-2 flex-shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

#### Atom TypeScript/React Example: Input

```typescript
// src/components/atoms/Input/Input.tsx
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const inputVariants = cva(
  'flex w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      inputSize: {
        sm: 'h-8 text-xs',
        md: 'h-10 text-sm',
        lg: 'h-12 text-base',
      },
      state: {
        default: 'border-input',
        error: 'border-destructive focus-visible:ring-destructive',
        success: 'border-green-500 focus-visible:ring-green-500',
      },
    },
    defaultVariants: {
      inputSize: 'md',
      state: 'default',
    },
  }
);

export type InputVariants = VariantProps<typeof inputVariants>;

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    InputVariants {
  /** Unique ID — REQUIRED for accessibility (label association) */
  id: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputSize, state, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(inputVariants({ inputSize, state }), className)}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
```

#### Atom TypeScript/React Example: Label

```typescript
// src/components/atoms/Label/Label.tsx
import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** MUST match the Input's id — NEVER omit */
  htmlFor: string;
  /** Indicates the associated field is required */
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          className
        )}
        {...props}
      >
        {children}
        {required && (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>
    );
  }
);

Label.displayName = 'Label';
```

#### Atom TypeScript/React Example: Icon

```typescript
// src/components/atoms/Icon/Icon.tsx
import { forwardRef, type SVGAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface IconProps extends SVGAttributes<SVGElement> {
  /** The icon name — maps to an SVG sprite or icon component */
  name: string;
  /** Size in pixels — applies to both width and height */
  size?: 16 | 20 | 24 | 32;
  /** Accessible label — REQUIRED when icon conveys meaning */
  label?: string;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ name, size = 24, label, className, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        className={cn('inline-block flex-shrink-0', className)}
        width={size}
        height={size}
        aria-hidden={!label}
        aria-label={label}
        role={label ? 'img' : 'presentation'}
        {...props}
      >
        <use href={`/icons/sprite.svg#${name}`} />
      </svg>
    );
  }
);

Icon.displayName = 'Icon';
```

---

### Level 2: Molecules

**Molecules combine 2-5 Atoms into a single functional unit with ONE clear purpose. A molecule handles the coordination between its atoms (e.g., linking a Label to an Input). Molecules MUST NOT import Organisms or higher levels. Molecules may have minimal local state (e.g., input focus) but MUST NOT manage global state or make API calls.**

```
MOLECULES — Small Functional Groups
┌──────────────────┬──────────────────┬──────────────────┐
│   SearchField    │    FormGroup     │   NavItem        │
│  (Input + Button │  (Label + Input  │  (Icon + Link    │
│   + Icon)        │   + HelpText     │   + Badge)       │
│                  │   + ErrorMsg)    │                  │
├──────────────────┼──────────────────┼──────────────────┤
│   InputGroup     │   MenuButton     │  StatCard        │
│  (Input + Addon  │  (Button + Icon  │  (Icon + Text    │
│   + Icon)        │   + Label)       │   + Number)      │
├──────────────────┼──────────────────┼──────────────────┤
│  AvatarName      │  PriceDisplay    │  ToggleField     │
│  (Avatar + Text) │  (Price + Badge) │  (Label+Switch)  │
└──────────────────┴──────────────────┴──────────────────┘

RULE: If it composes more than 5 atoms or contains
      other molecules, promote to Organism.
```

#### Molecule TypeScript/React Example: SearchField

```typescript
// src/components/molecules/SearchField/SearchField.tsx
import { useState, useCallback, type FormEvent } from 'react';
import { Input, type InputProps } from '@/components/atoms/Input';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';

export interface SearchFieldProps {
  /** Called when user submits the search */
  onSearch: (query: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Initial search value */
  defaultValue?: string;
  /** Disable the search field */
  disabled?: boolean;
  /** Input size variant — passed down to Input atom */
  size?: InputProps['inputSize'];
  /** Accessible label for the search input */
  label?: string;
}

/**
 * SearchField molecule — combines Input, Button, and Icon atoms.
 *
 * RULES:
 * - ONLY composes atoms — NEVER import molecules or organisms
 * - Manages ONLY local state (the search query text)
 * - Delegates the search action upward via onSearch callback
 * - MUST be accessible: proper label, role="search"
 */
export function SearchField({
  onSearch,
  placeholder = 'Search...',
  defaultValue = '',
  disabled = false,
  size = 'md',
  label = 'Search',
}: SearchFieldProps) {
  const [query, setQuery] = useState(defaultValue);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        onSearch(query.trim());
      }
    },
    [query, onSearch]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    onSearch('');
  }, [onSearch]);

  return (
    <form onSubmit={handleSubmit} role="search" aria-label={label}>
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Icon
            name="search"
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="search-field"
            type="search"
            inputSize={size}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-9"
            aria-label={label}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              aria-label="Clear search"
            >
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
        <Button type="submit" variant="primary" size={size} disabled={disabled}>
          Search
        </Button>
      </div>
    </form>
  );
}
```

#### Molecule TypeScript/React Example: FormGroup

```typescript
// src/components/molecules/FormGroup/FormGroup.tsx
import { type ReactNode } from 'react';
import { Label } from '@/components/atoms/Label';

export interface FormGroupProps {
  /** Unique ID that links label, input, description, and error */
  id: string;
  /** The label text */
  label: string;
  /** Whether the field is required */
  required?: boolean;
  /** Help text shown below the input */
  description?: string;
  /** Error message — takes priority over description */
  error?: string;
  /** The form control (Input, Select, Textarea atom) */
  children: ReactNode;
}

/**
 * FormGroup molecule — the standard label + input + help/error pattern.
 *
 * RULES:
 * - ALWAYS link label to input via matching id/htmlFor
 * - ALWAYS link error to input via aria-describedby
 * - ALWAYS link description to input via aria-describedby
 * - The children MUST be a single atom (Input, Select, Textarea)
 */
export function FormGroup({
  id,
  label,
  required = false,
  description,
  error,
  children,
}: FormGroupProps) {
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>

      {/* The child input MUST have id={id} and aria-describedby linking */}
      {children}

      {error ? (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

// Usage at a higher level:
// <FormGroup id="email" label="Email" required error={errors.email}>
//   <Input
//     id="email"
//     type="email"
//     aria-describedby={errors.email ? 'email-error' : 'email-description'}
//     aria-invalid={!!errors.email}
//   />
// </FormGroup>
```

---

### Level 3: Organisms

**Organisms are self-contained UI sections that combine Molecules and/or Atoms into a meaningful, reusable section of the interface. Organisms MAY have local state, MAY handle form submissions, and MAY make API calls (though prefer lifting data fetching to Pages). Organisms are the FIRST level where domain-specific logic appears.**

```
ORGANISMS — Self-Contained UI Sections
┌────────────────────┬────────────────────┬────────────────────┐
│      Header        │     UserCard       │     DataTable      │
│  ┌──────────────┐  │  ┌──────────────┐  │  ┌──────────────┐  │
│  │Logo (Atom)   │  │  │Avatar (Atom) │  │  │TableHead     │  │
│  │NavItems (Mol)│  │  │Name (Atom)   │  │  │TableRow (Mol)│  │
│  │SearchField   │  │  │Stats (Mol)   │  │  │Pagination    │  │
│  │  (Molecule)  │  │  │Actions (Mol) │  │  │  (Molecule)  │  │
│  │UserMenu(Mol) │  │  └──────────────┘  │  │Filters (Mol) │  │
│  └──────────────┘  │                    │  └──────────────┘  │
├────────────────────┼────────────────────┼────────────────────┤
│   LoginForm        │    Sidebar         │   CommentThread    │
│   HeroSection      │    Footer          │   ProductGrid      │
│   CheckoutSummary  │    NotificationBar │   ChatWindow       │
└────────────────────┴────────────────────┴────────────────────┘

RULE: An organism MUST represent a distinct section of the page
      that could exist independently.
```

#### Organism TypeScript/React Example: DataTable

```typescript
// src/components/organisms/DataTable/DataTable.tsx
import {
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Icon } from '@/components/atoms/Icon';
import { Badge } from '@/components/atoms/Badge';
import { Skeleton } from '@/components/atoms/Skeleton';

// ─── Types ──────────────────────────────────────────────────

export interface Column<T> {
  /** Unique key matching a property of T */
  key: keyof T & string;
  /** Display header label */
  header: string;
  /** Custom cell renderer */
  render?: (value: T[keyof T], row: T) => ReactNode;
  /** Whether column is sortable */
  sortable?: boolean;
  /** Column width (CSS value) */
  width?: string;
}

export interface DataTableProps<T extends { id: string | number }> {
  /** Column definitions */
  columns: Column<T>[];
  /** Data rows */
  data: T[];
  /** Loading state */
  isLoading?: boolean;
  /** Total number of rows (for pagination) */
  totalCount?: number;
  /** Current page (1-indexed) */
  page?: number;
  /** Rows per page */
  pageSize?: number;
  /** Called when page changes */
  onPageChange?: (page: number) => void;
  /** Called when sort changes */
  onSort?: (key: keyof T & string, direction: 'asc' | 'desc') => void;
  /** Caption for screen readers — REQUIRED for accessibility */
  caption: string;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * DataTable organism — full-featured data display with sorting, pagination.
 *
 * RULES:
 * - MUST include a <caption> for screen readers
 * - MUST use proper <table>, <thead>, <tbody> semantics
 * - MUST indicate sort direction with aria-sort
 * - MUST support keyboard navigation for sort buttons
 * - Composes atoms (Button, Icon, Badge, Skeleton) — no organism imports
 */
export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  isLoading = false,
  totalCount,
  page = 1,
  pageSize = 10,
  onPageChange,
  onSort,
  caption,
  emptyMessage = 'No data available.',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<(keyof T & string) | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = useCallback(
    (key: keyof T & string) => {
      const newDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
      setSortKey(key);
      setSortDir(newDir);
      onSort?.(key, newDir);
    },
    [sortKey, sortDir, onSort]
  );

  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 1;

  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading table data">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <table className="w-full caption-bottom text-sm" role="table">
        {/* ALWAYS include caption for accessibility */}
        <caption className="sr-only">{caption}</caption>

        <thead className="border-b bg-muted/50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                style={{ width: col.width }}
                aria-sort={
                  sortKey === col.key
                    ? sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                {col.sortable ? (
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort(col.key)}
                  >
                    {col.header}
                    <Icon
                      name={
                        sortKey === col.key
                          ? sortDir === 'asc'
                            ? 'arrow-up'
                            : 'arrow-down'
                          : 'arrows-sort'
                      }
                      size={16}
                    />
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={row.id}
                className="border-b transition-colors hover:bg-muted/50"
              >
                {columns.map((col) => (
                  <td key={col.key} className="p-4 align-middle">
                    {col.render
                      ? col.render(row[col.key], row)
                      : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination — composed from atoms */}
      {onPageChange && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
            {totalCount != null && ` (${totalCount} total)`}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### Organism TypeScript/React Example: Header

```typescript
// src/components/organisms/Header/Header.tsx
import { useState, useCallback } from 'react';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { SearchField } from '@/components/molecules/SearchField';

export interface NavItem {
  label: string;
  href: string;
  isActive?: boolean;
  badge?: number;
}

export interface HeaderProps {
  /** Application logo source */
  logoSrc: string;
  /** Logo alt text */
  logoAlt: string;
  /** Navigation items */
  navItems: NavItem[];
  /** User avatar URL */
  userAvatar?: string;
  /** User display name */
  userName?: string;
  /** Notification count */
  notificationCount?: number;
  /** Search handler */
  onSearch: (query: string) => void;
  /** User menu click handler */
  onUserMenuClick: () => void;
  /** Logo click handler (go home) */
  onLogoClick: () => void;
}

/**
 * Header organism — the main application navigation bar.
 *
 * Composes:
 * - Atoms: Icon, Avatar, Badge, Button
 * - Molecules: SearchField
 *
 * NEVER imports other organisms, templates, or pages.
 */
export function Header({
  logoSrc,
  logoAlt,
  navItems,
  userAvatar,
  userName,
  notificationCount = 0,
  onSearch,
  onUserMenuClick,
  onLogoClick,
}: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <nav
        className="flex h-16 items-center justify-between px-4 md:px-6"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <button
          onClick={onLogoClick}
          className="flex items-center gap-2"
          aria-label={`${logoAlt} — go to homepage`}
        >
          <img src={logoSrc} alt={logoAlt} className="h-8 w-auto" />
        </button>

        {/* Desktop Nav */}
        <ul className="hidden md:flex items-center gap-6" role="menubar">
          {navItems.map((item) => (
            <li key={item.href} role="none">
              <a
                href={item.href}
                role="menuitem"
                aria-current={item.isActive ? 'page' : undefined}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  item.isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {item.label}
                {item.badge != null && item.badge > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {item.badge}
                  </Badge>
                )}
              </a>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden md:block w-64">
            <SearchField onSearch={onSearch} size="sm" />
          </div>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ''}`}
          >
            <Icon name="bell" size={20} />
            {notificationCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs"
              >
                {notificationCount > 99 ? '99+' : notificationCount}
              </Badge>
            )}
          </Button>

          {/* User Menu */}
          <button
            onClick={onUserMenuClick}
            className="flex items-center gap-2"
            aria-label="User menu"
            aria-haspopup="true"
          >
            <Avatar src={userAvatar} alt={userName ?? 'User'} size="sm" />
          </button>

          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            <Icon name={isMobileMenuOpen ? 'x' : 'menu'} size={24} />
          </Button>
        </div>
      </nav>
    </header>
  );
}
```

---

### Level 4: Templates

**Templates define PAGE LAYOUTS — the structural skeleton that positions organisms and molecules into a page structure via slots/children. Templates MUST NOT contain data fetching, business logic, or specific content. Templates are PURE LAYOUT — they define WHERE things go, not WHAT things are.**

```
TEMPLATES — Layout Skeletons (no data, only structure)

  ┌──────────────────────────────────────────────┐
  │ DashboardLayout                              │
  │ ┌────────────────────────────────────────┐   │
  │ │           {header}                     │   │
  │ ├──────────┬─────────────────────────────┤   │
  │ │          │                             │   │
  │ │{sidebar} │         {main}              │   │
  │ │          │                             │   │
  │ │          │                             │   │
  │ │          │                             │   │
  │ ├──────────┴─────────────────────────────┤   │
  │ │           {footer}                     │   │
  │ └────────────────────────────────────────┘   │
  └──────────────────────────────────────────────┘

  RULE: Templates are SLOTS. They accept organisms/molecules
        as children or render props. They NEVER know what
        fills those slots.
```

#### Template TypeScript/React Example: DashboardLayout

```typescript
// src/components/templates/DashboardLayout/DashboardLayout.tsx
import { type ReactNode } from 'react';

export interface DashboardLayoutProps {
  /** Header organism (e.g., <Header />) */
  header: ReactNode;
  /** Sidebar organism (e.g., <Sidebar />) */
  sidebar: ReactNode;
  /** Main content area — receives page-specific content */
  children: ReactNode;
  /** Optional footer organism */
  footer?: ReactNode;
  /** Whether sidebar is collapsed */
  isSidebarCollapsed?: boolean;
}

/**
 * DashboardLayout template — positions header, sidebar, and main content.
 *
 * RULES:
 * - ZERO data fetching — PURE LAYOUT ONLY
 * - ZERO business logic — PURE POSITIONING ONLY
 * - All content passed via props/children (slot pattern)
 * - Responsive behavior is the ONLY logic allowed
 */
export function DashboardLayout({
  header,
  sidebar,
  children,
  footer,
  isSidebarCollapsed = false,
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen flex-col">
      {/* Header — full width, always on top */}
      <div className="flex-shrink-0">{header}</div>

      {/* Body — sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`flex-shrink-0 overflow-y-auto border-r bg-muted/30 transition-all duration-300 ${
            isSidebarCollapsed ? 'w-16' : 'w-64'
          }`}
          aria-label="Sidebar navigation"
        >
          {sidebar}
        </aside>

        {/* Main content */}
        <main
          className="flex-1 overflow-y-auto p-6"
          id="main-content"
          role="main"
        >
          {children}
        </main>
      </div>

      {/* Footer */}
      {footer && <div className="flex-shrink-0 border-t">{footer}</div>}
    </div>
  );
}
```

---

### Level 5: Pages

**Pages are route-level components that CONNECT data to the UI. Pages fetch data, manage application state, handle URL parameters, and wire organisms/molecules into Templates. Pages are the ONLY level where data fetching, URL routing, and side effects should live.**

```
PAGES — Route-Level Wiring

  ┌──────────────────────────────────────────────────┐
  │ DashboardPage                                    │
  │                                                  │
  │  1. Fetch data (TanStack Query / loader)         │
  │  2. Parse URL params (useParams, useSearchParams)│
  │  3. Wire data into organisms                     │
  │  4. Pass organisms into template                 │
  │                                                  │
  │  <DashboardLayout                                │
  │    header={<Header navItems={...} />}            │
  │    sidebar={<Sidebar menuItems={...} />}         │
  │  >                                               │
  │    <StatsGrid stats={data.stats} />              │
  │    <DataTable data={data.orders} />              │
  │    <ActivityFeed items={data.activity} />        │
  │  </DashboardLayout>                              │
  └──────────────────────────────────────────────────┘
```

#### Page TypeScript/React Example: DashboardPage

```typescript
// src/pages/DashboardPage/DashboardPage.tsx
import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

// Template
import { DashboardLayout } from '@/components/templates/DashboardLayout';

// Organisms
import { Header } from '@/components/organisms/Header';
import { Sidebar } from '@/components/organisms/Sidebar';
import { DataTable } from '@/components/organisms/DataTable';
import { StatsGrid } from '@/components/organisms/StatsGrid';

// API + types
import { fetchDashboardData } from '@/features/dashboard/api';
import { type DashboardData } from '@/features/dashboard/types';

// Config
import { dashboardColumns } from './columns';
import { navItems, sidebarMenu } from './navigation';

/**
 * DashboardPage — the route-level component for /dashboard.
 *
 * RULES:
 * - THIS is where data fetching happens
 * - THIS is where URL params are parsed
 * - THIS wires data into organisms, organisms into templates
 * - NEVER put data fetching in organisms or lower
 */
export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', page],
    queryFn: () => fetchDashboardData({ page }),
  });

  const handleSearch = (query: string) => {
    setSearchParams({ search: query, page: '1' });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams({ page: String(newPage) });
  };

  if (error) {
    return <div role="alert">Failed to load dashboard: {error.message}</div>;
  }

  return (
    <DashboardLayout
      header={
        <Header
          logoSrc="/logo.svg"
          logoAlt="Acme Corp"
          navItems={navItems}
          onSearch={handleSearch}
          onUserMenuClick={() => {}}
          onLogoClick={() => {}}
        />
      }
      sidebar={<Sidebar menuItems={sidebarMenu} />}
    >
      {/* Stats section */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Dashboard statistics
        </h2>
        <StatsGrid stats={data?.stats ?? []} isLoading={isLoading} />
      </section>

      {/* Data table section */}
      <section aria-labelledby="orders-heading" className="mt-8">
        <h2 id="orders-heading" className="text-lg font-semibold mb-4">
          Recent Orders
        </h2>
        <DataTable
          columns={dashboardColumns}
          data={data?.recentOrders ?? []}
          isLoading={isLoading}
          totalCount={data?.totalOrders}
          page={page}
          pageSize={10}
          onPageChange={handlePageChange}
          caption="Recent customer orders"
        />
      </section>
    </DashboardLayout>
  );
}
```

---

## 3. File Organization

**ALWAYS organize components by atomic level first, then by component name. Each component gets its own directory with co-located tests, stories, and styles.**

```
src/
├── components/
│   ├── atoms/                              # Level 1
│   │   ├── Button/
│   │   │   ├── Button.tsx                  # Component
│   │   │   ├── Button.test.tsx             # Tests
│   │   │   ├── Button.stories.tsx          # Storybook
│   │   │   ├── Button.variants.ts          # CVA variants (if complex)
│   │   │   └── index.ts                    # Public export
│   │   ├── Input/
│   │   │   ├── Input.tsx
│   │   │   ├── Input.test.tsx
│   │   │   ├── Input.stories.tsx
│   │   │   └── index.ts
│   │   ├── Label/
│   │   ├── Icon/
│   │   ├── Badge/
│   │   ├── Avatar/
│   │   ├── Spinner/
│   │   ├── Checkbox/
│   │   ├── Switch/
│   │   ├── Radio/
│   │   ├── Skeleton/
│   │   ├── Separator/
│   │   ├── Tooltip/
│   │   └── index.ts                        # Barrel: export all atoms
│   │
│   ├── molecules/                          # Level 2
│   │   ├── SearchField/
│   │   │   ├── SearchField.tsx
│   │   │   ├── SearchField.test.tsx
│   │   │   ├── SearchField.stories.tsx
│   │   │   └── index.ts
│   │   ├── FormGroup/
│   │   ├── InputGroup/
│   │   ├── NavItem/
│   │   ├── StatCard/
│   │   ├── AvatarName/
│   │   └── index.ts                        # Barrel: export all molecules
│   │
│   ├── organisms/                          # Level 3
│   │   ├── Header/
│   │   ├── DataTable/
│   │   ├── Sidebar/
│   │   ├── UserCard/
│   │   ├── LoginForm/
│   │   ├── CommentThread/
│   │   └── index.ts                        # Barrel: export all organisms
│   │
│   └── templates/                          # Level 4
│       ├── DashboardLayout/
│       ├── AuthLayout/
│       ├── MarketingLayout/
│       └── index.ts                        # Barrel: export all templates
│
├── pages/                                  # Level 5
│   ├── DashboardPage/
│   ├── LoginPage/
│   ├── OrdersPage/
│   └── index.ts
│
└── ...
```

---

## 4. Naming Conventions

| Level     | Component Name Pattern  | File Name Pattern              | Storybook Path                |
|-----------|------------------------|-------------------------------|-------------------------------|
| Atom      | `Button`, `Input`       | `Button/Button.tsx`           | `Atoms/Button`                |
| Molecule  | `SearchField`           | `SearchField/SearchField.tsx` | `Molecules/SearchField`       |
| Organism  | `DataTable`, `Header`   | `DataTable/DataTable.tsx`     | `Organisms/DataTable`         |
| Template  | `DashboardLayout`       | `DashboardLayout/...`         | `Templates/DashboardLayout`   |
| Page      | `DashboardPage`         | `DashboardPage/...`           | `Pages/DashboardPage`         |

**Rules:**
- Atoms: Single noun (`Button`, `Input`, `Badge`) — NEVER compound words
- Molecules: Compound descriptor (`SearchField`, `FormGroup`, `NavItem`)
- Organisms: Section descriptor (`DataTable`, `Header`, `LoginForm`)
- Templates: `*Layout` suffix ALWAYS (`DashboardLayout`, `AuthLayout`)
- Pages: `*Page` suffix ALWAYS (`DashboardPage`, `OrdersPage`)

---

## 5. Storybook Organization by Atomic Level

```typescript
// src/components/atoms/Button/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

// ALWAYS prefix with atomic level for Storybook sidebar grouping
const meta = {
  title: 'Atoms/Button',  // <── ALWAYS "Level/ComponentName"
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'icon'],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { children: 'Button', variant: 'primary' },
};

export const Secondary: Story = {
  args: { children: 'Button', variant: 'secondary' },
};

export const Destructive: Story = {
  args: { children: 'Delete', variant: 'destructive' },
};

export const Loading: Story = {
  args: { children: 'Saving...', isLoading: true },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};
```

**Storybook sidebar structure MUST match:**

```
├── Atoms
│   ├── Avatar
│   ├── Badge
│   ├── Button
│   ├── Checkbox
│   ├── Icon
│   ├── Input
│   ├── Label
│   ├── Radio
│   ├── Separator
│   ├── Skeleton
│   ├── Spinner
│   ├── Switch
│   └── Tooltip
├── Molecules
│   ├── AvatarName
│   ├── FormGroup
│   ├── InputGroup
│   ├── NavItem
│   ├── SearchField
│   └── StatCard
├── Organisms
│   ├── CommentThread
│   ├── DataTable
│   ├── Header
│   ├── LoginForm
│   ├── Sidebar
│   └── UserCard
├── Templates
│   ├── AuthLayout
│   ├── DashboardLayout
│   └── MarketingLayout
└── Pages
    ├── DashboardPage
    ├── LoginPage
    └── OrdersPage
```

---

## 6. Props API Design at Each Level

```
PROPS COMPLEXITY PYRAMID

  Pages:      route params, search params, loaders
                        ▲
  Templates:  children, slot props (ReactNode)
                        ▲
  Organisms:  data arrays, event handlers, config objects
                        ▲
  Molecules:  value + onChange, composed atom props
                        ▲
  Atoms:      variant, size, state + native HTML attributes
```

| Level     | Props Pattern                                         | State Allowed                       |
|-----------|------------------------------------------------------|-------------------------------------|
| Atom      | Extends native HTML attrs + variant/size/state enums  | NONE (fully controlled)             |
| Molecule  | Aggregates atom props + onAction callbacks            | Minimal local (focus, open/close)   |
| Organism  | Data arrays + event handlers + configuration          | Local UI state (sort, filter, page) |
| Template  | ReactNode slots only (header, sidebar, children)      | NONE (pure layout)                  |
| Page      | Route params + search params                          | Server/query state via hooks        |

**Rules:**
- Atoms: ALWAYS extend native HTML attributes via `ButtonHTMLAttributes`, `InputHTMLAttributes`, etc.
- Atoms: ALWAYS use `forwardRef` — required for compound component patterns
- Molecules: ALWAYS expose `onAction` callback props — NEVER handle side effects internally
- Organisms: MAY accept `isLoading`, `error`, `data` props — the "data boundary"
- Templates: ONLY accept `ReactNode` props — NEVER accept data or handlers
- Pages: NEVER accept props — they read from URL/context/queries

---

## 7. When to Promote a Component Up the Hierarchy

**Use this decision tree to determine the correct atomic level:**

```
START: You have a new component to classify.
  │
  ├─ Does it wrap a SINGLE native HTML element with styling?
  │   YES → ATOM
  │   NO ↓
  │
  ├─ Does it combine 2-5 atoms for ONE purpose (no domain logic)?
  │   YES → MOLECULE
  │   NO ↓
  │
  ├─ Does it represent a distinct PAGE SECTION with domain logic?
  │   YES → ORGANISM
  │   NO ↓
  │
  ├─ Does it define a page LAYOUT with content slots?
  │   YES → TEMPLATE
  │   NO ↓
  │
  └─ Does it wire data to UI at the route level?
      YES → PAGE
```

**Promotion triggers — when a component MUST move up:**

| From       | To         | Trigger                                                              |
|------------|------------|----------------------------------------------------------------------|
| Atom       | Molecule   | It starts composing other atoms (e.g., Input gains a clear button)   |
| Molecule   | Organism   | It gains domain logic, >5 atoms, or internal data management         |
| Organism   | Template   | It becomes reusable layout that multiple pages share                 |
| Template   | Page       | It starts fetching data or reading URL params — NEVER allowed        |

---

## 8. Composition Patterns

### Pattern A: Slot Composition (Templates)

```typescript
// Template accepts any organism via ReactNode slots
<DashboardLayout
  header={<Header />}              // Organism fills header slot
  sidebar={<Sidebar />}            // Organism fills sidebar slot
  footer={<Footer />}              // Organism fills footer slot
>
  {/* Main content area — organism or page content */}
  <DataTable />
</DashboardLayout>
```

### Pattern B: Render Prop Composition (Organisms)

```typescript
// Organism delegates cell rendering to parent
<DataTable
  columns={columns}
  data={orders}
  renderRow={(row) => (               // Parent controls row rendering
    <OrderRow key={row.id} order={row} />
  )}
  renderEmpty={() => (
    <EmptyState icon="inbox" message="No orders yet" />
  )}
/>
```

### Pattern C: Compound Composition (Molecules/Organisms)

```typescript
// Compound component pattern — see compound-components.md for full details
<Select value={value} onValueChange={setValue}>
  <Select.Trigger>
    <Select.Value placeholder="Choose..." />
  </Select.Trigger>
  <Select.Content>
    <Select.Item value="a">Option A</Select.Item>
    <Select.Item value="b">Option B</Select.Item>
  </Select.Content>
</Select>
```

---

## 9. Vue 3 Adaptation

```
Atomic design maps to Vue 3 identically. The ONLY differences:

| React                        | Vue 3                              |
|-----------------------------|------------------------------------|
| forwardRef                   | defineExpose + template ref         |
| className prop               | class prop (auto-merged)            |
| children prop                | <slot /> default slot               |
| ReactNode slot props         | Named <slot name="header" />        |
| cva() variants               | Same (cva works in Vue)             |
| Storybook CSF                | Same (Storybook supports Vue)       |
```

```vue
<!-- src/components/atoms/Button/Button.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

type ButtonVariants = VariantProps<typeof buttonVariants>;

interface Props {
  variant?: ButtonVariants['variant'];
  size?: ButtonVariants['size'];
  disabled?: boolean;
  isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  isLoading: false,
});

const classes = computed(() =>
  cn(buttonVariants({ variant: props.variant, size: props.size }))
);
</script>

<template>
  <button
    :class="classes"
    :disabled="disabled || isLoading"
    v-bind="$attrs"
  >
    <span v-if="isLoading" class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <slot />
  </button>
</template>
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **God Organism** | Single component with 500+ lines, does everything | Decompose: extract molecules for sub-sections, lift data to page |
| **Atom with children components** | Atom imports another custom component | If it composes other components, it is a Molecule — promote it |
| **Molecule with API calls** | `useQuery` or `fetch` inside a molecule | Move data fetching to Page level; pass data as props |
| **Template with business logic** | `if (user.role === 'admin')` inside a layout template | Templates are PURE LAYOUT — move conditional logic to Page |
| **Page with inline UI** | Page has 300 lines of JSX instead of composing organisms | Extract organisms; Page should be <50 lines of wiring |
| **Cross-level imports** | Organism imports another organism | NEVER — compose at the Template or Page level instead |
| **Ambiguous naming** | `Card` — is it an atom, molecule, or organism? | Use clear names: atom=`CardFrame`, molecule=`StatCard`, organism=`UserCard` |
| **Shared state in atoms** | Atom reads from Redux/Zustand/Context | Atoms are ALWAYS controlled via props — ZERO external state |
| **Barrel file circular deps** | `atoms/index.ts` re-exports everything, causing circular imports | Only barrel export PUBLIC API; use direct imports internally |
| **Storybook without levels** | All stories in flat `Components/` folder | ALWAYS prefix: `Atoms/Button`, `Molecules/SearchField` |

---

## 11. Enforcement Checklist

```
PRE-COMMIT / CODE REVIEW CHECKLIST:

[ ] Every component is classified into EXACTLY ONE atomic level
[ ] Atoms do NOT import any other custom components
[ ] Molecules ONLY import atoms (never molecules, organisms, etc.)
[ ] Organisms ONLY import atoms and molecules
[ ] Templates accept ONLY ReactNode/slot props — zero data/logic
[ ] Pages are the ONLY level with data fetching / URL parsing
[ ] Every atom uses forwardRef (React) or defineExpose (Vue)
[ ] Every atom extends native HTML attributes in its props
[ ] Storybook stories use "Level/ComponentName" title format
[ ] No component directory contains files from another atomic level
[ ] File structure matches: atoms/ → molecules/ → organisms/ → templates/
[ ] Component names follow naming convention (see Section 4)
[ ] No circular dependencies between atomic levels
[ ] Props flow downward ONLY — no child-to-parent prop drilling across levels
[ ] Each component directory has: Component.tsx, Component.test.tsx, Component.stories.tsx, index.ts
```

**ESLint enforcement (eslint-plugin-import + custom rule):**

```json
{
  "rules": {
    "import/no-restricted-paths": [
      "error",
      {
        "zones": [
          {
            "target": "./src/components/atoms",
            "from": "./src/components/molecules",
            "message": "Atoms MUST NOT import molecules"
          },
          {
            "target": "./src/components/atoms",
            "from": "./src/components/organisms",
            "message": "Atoms MUST NOT import organisms"
          },
          {
            "target": "./src/components/molecules",
            "from": "./src/components/organisms",
            "message": "Molecules MUST NOT import organisms"
          },
          {
            "target": "./src/components/molecules",
            "from": "./src/components/templates",
            "message": "Molecules MUST NOT import templates"
          },
          {
            "target": "./src/components/organisms",
            "from": "./src/components/templates",
            "message": "Organisms MUST NOT import templates"
          },
          {
            "target": "./src/components/templates",
            "from": "./src/pages",
            "message": "Templates MUST NOT import pages"
          }
        ]
      }
    ]
  }
}
```
