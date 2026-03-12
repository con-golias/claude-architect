# Atomic Design — Complete Specification

> **AI Plugin Directive:** When designing component hierarchies, establishing a component library structure, or deciding how to decompose UI into reusable pieces, ALWAYS consult this guide. Apply Atomic Design methodology to create scalable, consistent, and maintainable component systems. This guide covers the five-level hierarchy from atoms to pages, composition rules, and framework-specific implementations.

**Core Rule: EVERY UI component MUST belong to exactly one atomic level: atom, molecule, organism, template, or page. Atoms are the smallest indivisible UI elements. Molecules combine atoms into functional groups. Organisms combine molecules into distinct sections. Templates define layout without data. Pages are templates with real data. NEVER allow a lower-level component to import from a higher level — dependencies flow DOWN only.**

---

## 1. The Five Levels of Atomic Design

```
                    ATOMIC DESIGN HIERARCHY

  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │   PAGES          ┌──────────────────────────────────┐       │
  │   (Instances)    │  ProductListPage                 │       │
  │                  │  ┌─ real data, real images ─────┐ │       │
  │                  │  │  actual product catalog      │ │       │
  │                  └──┴──────────────────────────────┘│       │
  │                                                     │       │
  │   TEMPLATES      ┌──────────────────────────────────┐       │
  │   (Layout)       │  CatalogTemplate                 │       │
  │                  │  ┌─ header slot ───────────────┐ │       │
  │                  │  │  sidebar │ content grid     │ │       │
  │                  │  │          │ ┌──┐ ┌──┐ ┌──┐  │ │       │
  │                  │  │          │ └──┘ └──┘ └──┘  │ │       │
  │                  │  └─────────────────────────────┘ │       │
  │                  └──────────────────────────────────┘       │
  │                                                             │
  │   ORGANISMS      ┌──────────────────┐  ┌──────────┐        │
  │   (Sections)     │  ProductCard      │  │ NavBar   │        │
  │                  │  ┌─────┐ Title   │  │ Logo|Nav │        │
  │                  │  │Image│ Price   │  │    |Auth │        │
  │                  │  └─────┘ Rating  │  └──────────┘        │
  │                  │  [Add to Cart]   │                       │
  │                  └──────────────────┘                       │
  │                                                             │
  │   MOLECULES      ┌──────────┐  ┌──────────┐                │
  │   (Groups)       │SearchBar │  │ FormField│                │
  │                  │[icon|inp]│  │Label     │                │
  │                  └──────────┘  │[input]   │                │
  │                                │hint text │                │
  │                                └──────────┘                │
  │                                                             │
  │   ATOMS          [Button] [Input] [Label] [Icon] [Badge]   │
  │   (Elements)     [Avatar] [Tag]   [Spinner] [Divider]      │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘

  DEPENDENCY RULE: Pages → Templates → Organisms → Molecules → Atoms
  NEVER import upward. Atoms NEVER import molecules.
```

---

## 2. Atoms — Indivisible UI Elements

### 2.1 Definition and Rules

```
  ATOM RULES:
  ┌──────────────────────────────────────────────────────────┐
  │ 1. Cannot be broken down further without losing meaning  │
  │ 2. ZERO domain knowledge — purely presentational          │
  │ 3. Highly reusable across ALL contexts                   │
  │ 4. MUST NOT import other components (except icons/utils)  │
  │ 5. MUST accept all styling via props/variants             │
  │ 6. MUST be accessible (ARIA, keyboard, focus)             │
  │ 7. MUST NOT fetch data or manage global state            │
  │ 8. MUST have comprehensive variant coverage               │
  └──────────────────────────────────────────────────────────┘
```

### 2.2 Atom Implementation

```typescript
// atoms/Button.tsx — Complete atom with full variant system
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base styles — ALWAYS applied
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

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && <Spinner className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
export type { ButtonProps };
```

```typescript
// atoms/Input.tsx — Text input atom
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-destructive focus-visible:ring-destructive',
        !error && 'border-input',
        className
      )}
      aria-invalid={error}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
```

```typescript
// atoms/Badge.tsx — Status indicator atom
import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
        warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

### 2.3 Common Atoms Catalog

| Atom | Purpose | Key Props |
|------|---------|-----------|
| Button | User actions | variant, size, loading, disabled |
| Input | Text entry | type, error, placeholder |
| Label | Form labels | htmlFor, required |
| Textarea | Multi-line text | rows, resize |
| Checkbox | Boolean toggle | checked, indeterminate |
| Radio | Single selection | checked, name, value |
| Select | Dropdown selection | options, placeholder |
| Switch | Toggle on/off | checked, size |
| Badge | Status indicator | variant, size |
| Avatar | User/entity image | src, fallback, size |
| Icon | Symbolic graphic | name, size, color |
| Spinner | Loading indicator | size |
| Divider | Visual separator | orientation |
| Tooltip | Contextual info | content, side, delay |
| Skeleton | Loading placeholder | width, height, variant |

---

## 3. Molecules — Functional Groups

### 3.1 Definition and Rules

```
  MOLECULE RULES:
  ┌──────────────────────────────────────────────────────────┐
  │ 1. Combines 2-5 atoms into a functional unit             │
  │ 2. Has a single, clear purpose                           │
  │ 3. Still context-agnostic (no domain logic)              │
  │ 4. MAY manage local UI state (open/closed, focused)      │
  │ 5. MUST NOT fetch data or call APIs                      │
  │ 6. Imports ONLY from atoms (or other molecules)          │
  │ 7. MUST be reusable across different organisms           │
  └──────────────────────────────────────────────────────────┘
```

### 3.2 Molecule Implementation

```typescript
// molecules/FormField.tsx — Combines Label + Input + error message
import { Label } from '@/atoms/Label';
import { Input, type InputProps } from '@/atoms/Input';

interface FormFieldProps extends InputProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

function FormField({ label, error, hint, required, id, ...inputProps }: FormFieldProps) {
  const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} required={required}>
        {label}
      </Label>
      <Input
        id={fieldId}
        error={!!error}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        aria-required={required}
        {...inputProps}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert">{error}</p>
      )}
    </div>
  );
}

export { FormField };
```

```typescript
// molecules/SearchBar.tsx — Combines Input + Button + Icon
import { useState, type FormEvent } from 'react';
import { Input } from '@/atoms/Input';
import { Button } from '@/atoms/Button';
import { SearchIcon, XIcon } from '@/atoms/Icons';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  defaultValue?: string;
}

function SearchBar({ onSearch, placeholder = 'Search...', defaultValue = '' }: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(query.trim());
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <form onSubmit={handleSubmit} role="search" className="relative flex gap-2">
      <div className="relative flex-1">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-8"
          aria-label="Search"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            aria-label="Clear search"
          >
            <XIcon className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
      <Button type="submit" variant="primary">Search</Button>
    </form>
  );
}

export { SearchBar };
```

```typescript
// molecules/UserChip.tsx — Combines Avatar + text
import { Avatar } from '@/atoms/Avatar';
import { cn } from '@/lib/utils';

interface UserChipProps {
  name: string;
  avatarUrl?: string;
  status?: 'online' | 'offline' | 'away';
  size?: 'sm' | 'md';
}

function UserChip({ name, avatarUrl, status, size = 'md' }: UserChipProps) {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="relative">
        <Avatar src={avatarUrl} fallback={name[0]} size={size} />
        {status && (
          <span
            className={cn(
              'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background',
              status === 'online' && 'bg-green-500',
              status === 'offline' && 'bg-gray-400',
              status === 'away' && 'bg-yellow-500',
            )}
            aria-label={`Status: ${status}`}
          />
        )}
      </div>
      <span className="text-sm font-medium">{name}</span>
    </div>
  );
}

export { UserChip };
```

---

## 4. Organisms — Complex Sections

### 4.1 Definition and Rules

```
  ORGANISM RULES:
  ┌──────────────────────────────────────────────────────────┐
  │ 1. Combines molecules and atoms into a distinct section  │
  │ 2. MAY contain domain-specific logic and terminology     │
  │ 3. MAY manage complex local state                        │
  │ 4. MAY fetch data (via hooks/props)                      │
  │ 5. Represents a complete, self-contained UI section      │
  │ 6. Imports from molecules and atoms                      │
  │ 7. SHOULD be reusable but MAY be page-specific           │
  │ 8. Examples: navigation bar, product card, comment thread│
  └──────────────────────────────────────────────────────────┘
```

### 4.2 Organism Implementation

```typescript
// organisms/ProductCard.tsx — Complete product display unit
import { Badge } from '@/atoms/Badge';
import { Button } from '@/atoms/Button';
import { StarRating } from '@/molecules/StarRating';
import { PriceDisplay } from '@/molecules/PriceDisplay';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    image: string;
    price: number;
    originalPrice?: number;
    rating: number;
    reviewCount: number;
    inStock: boolean;
    isNew?: boolean;
    category: string;
  };
  onAddToCart: (productId: string) => void;
  onQuickView: (productId: string) => void;
}

function ProductCard({ product, onAddToCart, onQuickView }: ProductCardProps) {
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  return (
    <article className="group relative flex flex-col rounded-lg border bg-card overflow-hidden">
      {/* Image Section */}
      <div className="relative aspect-square overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
          width={400}
          height={400}
        />
        <div className="absolute top-2 left-2 flex gap-1">
          {product.isNew && <Badge variant="default">New</Badge>}
          {discount > 0 && <Badge variant="destructive">-{discount}%</Badge>}
        </div>
        <button
          onClick={() => onQuickView(product.id)}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Quick view ${product.name}`}
        >
          <span className="rounded-full bg-white px-4 py-2 text-sm font-medium">
            Quick View
          </span>
        </button>
      </div>

      {/* Content Section */}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs text-muted-foreground">{product.category}</p>
        <h3 className="mt-1 font-medium line-clamp-2">{product.name}</h3>
        <StarRating rating={product.rating} count={product.reviewCount} className="mt-2" />
        <div className="mt-auto pt-3">
          <PriceDisplay price={product.price} originalPrice={product.originalPrice} />
          <Button
            onClick={() => onAddToCart(product.id)}
            disabled={!product.inStock}
            className="mt-3 w-full"
            variant={product.inStock ? 'primary' : 'outline'}
          >
            {product.inStock ? 'Add to Cart' : 'Out of Stock'}
          </Button>
        </div>
      </div>
    </article>
  );
}

export { ProductCard };
```

```typescript
// organisms/NavigationBar.tsx — Complete site navigation
import { useState } from 'react';
import { Button } from '@/atoms/Button';
import { Avatar } from '@/atoms/Avatar';
import { Badge } from '@/atoms/Badge';
import { SearchBar } from '@/molecules/SearchBar';
import { NavLinks } from '@/molecules/NavLinks';

interface NavigationBarProps {
  user?: { name: string; avatarUrl: string } | null;
  cartItemCount: number;
  onSearch: (query: string) => void;
  onLogin: () => void;
  onCartClick: () => void;
  links: Array<{ label: string; href: string; active?: boolean }>;
}

function NavigationBar({
  user, cartItemCount, onSearch, onLogin, onCartClick, links,
}: NavigationBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <nav className="container mx-auto flex h-16 items-center gap-4 px-4" aria-label="Main">
        <a href="/" className="flex-shrink-0 font-bold text-xl">Brand</a>
        <NavLinks links={links} className="hidden md:flex" />
        <SearchBar onSearch={onSearch} className="hidden md:flex flex-1 max-w-md" />
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onCartClick} className="relative p-2" aria-label="Shopping cart">
            <CartIcon className="h-5 w-5" />
            {cartItemCount > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center">
                {cartItemCount}
              </Badge>
            )}
          </button>
          {user ? (
            <Avatar src={user.avatarUrl} fallback={user.name[0]} size="sm" />
          ) : (
            <Button onClick={onLogin} variant="outline" size="sm">Sign In</Button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <XIcon /> : <MenuIcon />}
          </button>
        </div>
      </nav>
      {mobileMenuOpen && (
        <div className="md:hidden border-t p-4 space-y-4">
          <SearchBar onSearch={onSearch} />
          <NavLinks links={links} className="flex flex-col" />
        </div>
      )}
    </header>
  );
}

export { NavigationBar };
```

---

## 5. Templates — Layout Structures

### 5.1 Definition and Rules

```
  TEMPLATE RULES:
  ┌──────────────────────────────────────────────────────────┐
  │ 1. Defines page LAYOUT — positions of organisms          │
  │ 2. Contains NO real data — uses placeholder/slot pattern  │
  │ 3. Focus on structure, spacing, responsiveness            │
  │ 4. Receives organisms as children or render props         │
  │ 5. MUST handle responsive breakpoints                    │
  │ 6. MUST define loading and error states                  │
  │ 7. Represents the content structure, NOT the content      │
  └──────────────────────────────────────────────────────────┘
```

### 5.2 Template Implementation

```typescript
// templates/CatalogTemplate.tsx — E-commerce catalog layout
import { type ReactNode } from 'react';

interface CatalogTemplateProps {
  header: ReactNode;
  sidebar: ReactNode;
  content: ReactNode;
  pagination?: ReactNode;
  breadcrumbs?: ReactNode;
}

function CatalogTemplate({
  header, sidebar, content, pagination, breadcrumbs,
}: CatalogTemplateProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {header}
      <main className="flex-1 container mx-auto px-4 py-6">
        {breadcrumbs && <div className="mb-4">{breadcrumbs}</div>}
        <div className="flex flex-col md:flex-row gap-6">
          <aside className="w-full md:w-64 flex-shrink-0">{sidebar}</aside>
          <section className="flex-1" aria-label="Product catalog">
            {content}
            {pagination && <div className="mt-8">{pagination}</div>}
          </section>
        </div>
      </main>
    </div>
  );
}

export { CatalogTemplate };
```

```typescript
// templates/DashboardTemplate.tsx — Admin dashboard layout
import { type ReactNode } from 'react';

interface DashboardTemplateProps {
  header: ReactNode;
  sidebar: ReactNode;
  content: ReactNode;
  footer?: ReactNode;
}

function DashboardTemplate({
  header, sidebar, content, footer,
}: DashboardTemplateProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card">{sidebar}</aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        {header}
        <main className="flex-1 overflow-y-auto p-6">{content}</main>
        {footer && <footer className="border-t p-4">{footer}</footer>}
      </div>
    </div>
  );
}

export { DashboardTemplate };
```

---

## 6. Pages — Templates with Real Data

### 6.1 Definition and Rules

```
  PAGE RULES:
  ┌──────────────────────────────────────────────────────────┐
  │ 1. Instantiates a template with REAL data                │
  │ 2. Contains data fetching logic (or receives from route) │
  │ 3. Handles loading, error, and empty states              │
  │ 4. Connects organisms to global state and APIs           │
  │ 5. MUST NOT contain layout logic (delegate to templates) │
  │ 6. MUST NOT contain presentational logic (use organisms) │
  │ 7. Acts as the "controller" or "container" layer         │
  │ 8. Maps route parameters to data queries                 │
  └──────────────────────────────────────────────────────────┘
```

### 6.2 Page Implementation

```typescript
// pages/ProductCatalogPage.tsx — Connects template with real data
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CatalogTemplate } from '@/templates/CatalogTemplate';
import { NavigationBar } from '@/organisms/NavigationBar';
import { ProductGrid } from '@/organisms/ProductGrid';
import { FilterSidebar } from '@/organisms/FilterSidebar';
import { Pagination } from '@/molecules/Pagination';
import { Breadcrumbs } from '@/molecules/Breadcrumbs';
import { ProductGridSkeleton } from '@/organisms/skeletons/ProductGridSkeleton';

export default function ProductCatalogPage() {
  const searchParams = useSearchParams();
  const category = searchParams.get('category');
  const page = parseInt(searchParams.get('page') || '1');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['products', { category, page }],
    queryFn: () => fetchProducts({ category, page, limit: 24 }),
  });

  return (
    <CatalogTemplate
      header={<NavigationBar {...useNavProps()} />}
      breadcrumbs={
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'Products', href: '/products' },
          ...(category ? [{ label: category }] : []),
        ]} />
      }
      sidebar={<FilterSidebar activeCategory={category} onFilterChange={handleFilterChange} />}
      content={
        isLoading ? (
          <ProductGridSkeleton count={24} />
        ) : error ? (
          <ErrorState message="Failed to load products" onRetry={refetch} />
        ) : data?.products.length === 0 ? (
          <EmptyState message="No products found" />
        ) : (
          <ProductGrid products={data!.products} />
        )
      }
      pagination={
        data && <Pagination currentPage={page} totalPages={data.totalPages} onPageChange={handlePageChange} />
      }
    />
  );
}
```

---

## 7. File System Organization

```
  ATOMIC DESIGN DIRECTORY STRUCTURE

  src/
  ├── components/
  │   ├── atoms/                    ← Indivisible UI elements
  │   │   ├── Button/
  │   │   │   ├── Button.tsx
  │   │   │   ├── Button.test.tsx
  │   │   │   ├── Button.stories.tsx
  │   │   │   └── index.ts
  │   │   ├── Input/
  │   │   ├── Badge/
  │   │   ├── Avatar/
  │   │   ├── Spinner/
  │   │   └── index.ts             ← Re-exports all atoms
  │   │
  │   ├── molecules/                ← Functional groups of atoms
  │   │   ├── FormField/
  │   │   ├── SearchBar/
  │   │   ├── UserChip/
  │   │   ├── StarRating/
  │   │   └── index.ts
  │   │
  │   ├── organisms/                ← Complex, self-contained sections
  │   │   ├── ProductCard/
  │   │   ├── NavigationBar/
  │   │   ├── CommentThread/
  │   │   ├── DataTable/
  │   │   └── index.ts
  │   │
  │   ├── templates/                ← Page layouts (no data)
  │   │   ├── CatalogTemplate/
  │   │   ├── DashboardTemplate/
  │   │   ├── AuthTemplate/
  │   │   └── index.ts
  │   │
  │   └── pages/                    ← Templates + real data
  │       ├── ProductCatalogPage/
  │       ├── DashboardPage/
  │       └── index.ts
  │
  └── styles/
      └── tokens/                   ← Design tokens used by atoms
```

### 7.1 Import Rules by Level

```typescript
// ─── ALLOWED IMPORTS ───

// Atom: ONLY utilities, design tokens, icons
import { cn } from '@/lib/utils';            // ✅
import { IconSearch } from '@/atoms/Icon';   // ✅ (icons are atoms)
import { SearchBar } from '@/molecules/...'; // ❌ NEVER

// Molecule: atoms + utilities
import { Button } from '@/atoms/Button';     // ✅
import { Input } from '@/atoms/Input';       // ✅
import { ProductCard } from '@/organisms/...'; // ❌ NEVER

// Organism: molecules + atoms + hooks + utilities
import { FormField } from '@/molecules/FormField';  // ✅
import { Button } from '@/atoms/Button';             // ✅
import { useProducts } from '@/hooks/useProducts';   // ✅

// Template: organisms + molecules + atoms (NO data fetching)
import { NavigationBar } from '@/organisms/NavigationBar';  // ✅
import { useQuery } from '@tanstack/react-query';           // ❌ NEVER in template

// Page: templates + organisms + data hooks + state
import { CatalogTemplate } from '@/templates/CatalogTemplate';  // ✅
import { useQuery } from '@tanstack/react-query';                // ✅
```

---

## 8. Composition Patterns at Each Level

### 8.1 Composition vs Inheritance

```typescript
// ALWAYS use composition — NEVER use class inheritance for components

// ❌ ANTI-PATTERN: Inheritance
class PrimaryButton extends Button { /* ... */ }
class DangerButton extends Button { /* ... */ }

// ✅ CORRECT: Composition via variants
<Button variant="primary">Submit</Button>
<Button variant="destructive">Delete</Button>

// ✅ CORRECT: Composition via wrapping
function SubmitButton(props: Omit<ButtonProps, 'type'>) {
  return <Button type="submit" variant="primary" {...props} />;
}

// ✅ CORRECT: Composition via slots
function Card({ header, content, footer }: CardProps) {
  return (
    <div className="rounded-lg border">
      {header && <div className="border-b p-4">{header}</div>}
      <div className="p-4">{content}</div>
      {footer && <div className="border-t p-4">{footer}</div>}
    </div>
  );
}
```

### 8.2 Flexible Composition with Polymorphic Components

```typescript
// Atom that can render as different HTML elements
import { type ElementType, type ComponentPropsWithoutRef } from 'react';

type BoxProps<T extends ElementType = 'div'> = {
  as?: T;
} & ComponentPropsWithoutRef<T>;

function Box<T extends ElementType = 'div'>({ as, ...props }: BoxProps<T>) {
  const Component = as || 'div';
  return <Component {...props} />;
}

// Usage
<Box as="section" className="p-4">Section content</Box>
<Box as="article" className="p-4">Article content</Box>
<Box as="main" className="p-4">Main content</Box>
```

---

## 9. State Distribution Across Levels

```
  STATE OWNERSHIP BY LEVEL:

  ┌──────────┬────────────────────────────────────────────────────┐
  │ Level    │ State Responsibilities                             │
  ├──────────┼────────────────────────────────────────────────────┤
  │ Atom     │ ZERO state — fully controlled via props            │
  │          │ Exception: internal focus/hover state only          │
  │          │                                                    │
  │ Molecule │ LOCAL UI state only                                │
  │          │ (open/closed, input value, focused field)           │
  │          │ NEVER: data state, auth state, global state        │
  │          │                                                    │
  │ Organism │ FEATURE state + data hooks                         │
  │          │ (filter state, pagination, form state)             │
  │          │ MAY call data hooks (useQuery, useForm)            │
  │          │                                                    │
  │ Template │ LAYOUT state only                                  │
  │          │ (sidebar open, scroll position)                    │
  │          │ NEVER: data state, business logic                  │
  │          │                                                    │
  │ Page     │ ROUTE state + data orchestration                   │
  │          │ (URL params, page-level queries, global state)     │
  │          │ Coordinates data flow between organisms            │
  └──────────┴────────────────────────────────────────────────────┘
```

---

## 10. Testing Strategy by Level

| Level | Test Type | What to Test | Tools |
|-------|-----------|-------------|-------|
| Atom | Unit + Visual | All variants, accessibility, keyboard | Testing Library, Storybook |
| Molecule | Unit + Integration | Atom interaction, state changes | Testing Library |
| Organism | Integration | Data flow, user workflows | Testing Library, MSW |
| Template | Snapshot + Visual | Layout responsiveness, slot rendering | Storybook, Chromatic |
| Page | E2E | Full user flows, data loading | Playwright, Cypress |

```typescript
// Atom test — Button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders all variants without visual regression', () => {
    const variants = ['primary', 'secondary', 'destructive', 'outline', 'ghost', 'link'] as const;
    variants.forEach(variant => {
      const { container } = render(<Button variant={variant}>{variant}</Button>);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  it('shows loading state with spinner', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('handles click events', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does NOT fire click when disabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>Click</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

---

## 11. When to Deviate from Strict Atomic Design

```
  DEVIATION DECISION TREE:

  Component doesn't fit neatly into one level?
       │
       ├── Is it a utility/layout primitive (Stack, Grid, Container)?
       │       └── Place in atoms/layout/ — these are layout atoms
       │
       ├── Is it a complex atom with sub-components (Dropdown, Combobox)?
       │       └── Place in molecules/ — compound components are molecules
       │
       ├── Is it a global context provider (ThemeProvider, AuthProvider)?
       │       └── Place in providers/ — NOT in the atomic hierarchy
       │
       ├── Is it a hook (useDebounce, useMediaQuery)?
       │       └── Place in hooks/ — NOT in the atomic hierarchy
       │
       ├── Is it a page-specific organism used only once?
       │       └── Co-locate with the page — prefix with page name
       │
       └── Does it cross multiple levels (fetches data AND renders UI)?
               └── SPLIT IT: Container (organism) + Presentational (molecule)
```

---

## 12. Framework-Specific Adaptations

### 12.1 Next.js App Router

```typescript
// In Next.js App Router:
// - Pages = Route files (page.tsx)
// - Templates = Layout files (layout.tsx) + template components
// - Server Components can be atoms/molecules (no state, no interactivity)
// - Client Components MUST be marked with 'use client'

// app/products/page.tsx — This IS the "page" in atomic terms
import { CatalogTemplate } from '@/templates/CatalogTemplate';
import { ProductGrid } from '@/organisms/ProductGrid';

// Server Component — fetches data at the page level
export default async function ProductsPage({ searchParams }: Props) {
  const products = await fetchProducts(searchParams);
  return (
    <CatalogTemplate
      content={<ProductGrid products={products} />}
    />
  );
}
```

### 12.2 Vue 3 Adaptation

```vue
<!-- atoms/VButton.vue -->
<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
});
</script>

<template>
  <button
    :class="[
      'inline-flex items-center justify-center rounded-md font-medium transition-colors',
      variantClasses[variant],
      sizeClasses[size],
    ]"
    :disabled="disabled || loading"
    :aria-busy="loading"
  >
    <Spinner v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
    <slot />
  </button>
</template>
```

### 12.3 Angular Adaptation

```typescript
// atoms/button/button.component.ts
@Component({
  selector: 'ui-button',
  standalone: true,
  template: `
    <button
      [class]="computedClasses()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading()"
    >
      <ui-spinner *ngIf="loading()" class="mr-2 h-4 w-4 animate-spin" />
      <ng-content />
    </button>
  `,
})
export class ButtonComponent {
  variant = input<'primary' | 'secondary' | 'destructive' | 'outline'>('primary');
  size = input<'sm' | 'md' | 'lg'>('md');
  loading = input(false);
  disabled = input(false);

  computedClasses = computed(() =>
    cn(buttonVariants({ variant: this.variant(), size: this.size() }))
  );
}
```

---

## 13. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Atom fetches data | Atom has API dependency, not reusable | Move data fetching to organism/page level |
| Molecule imports organism | Circular dependencies, broken hierarchy | Restructure — pass data as props from above |
| Template contains business logic | Layout coupled to domain, not reusable | Move logic to page, pass via props/slots |
| Page contains layout CSS | Page does template's job, duplication | Extract layout to a template component |
| "God organism" with 500+ lines | Too much responsibility, hard to test | Split into multiple organisms + molecules |
| Atom has too many variants | 15+ variant props, confusing API | Split into separate atom components |
| Skipping levels | Page directly uses atoms without structure | Add missing molecules/organisms |
| Domain-specific atoms | `<ProductPrice>` as an atom | Make generic `<Price>` atom, domain in organism |
| Importing upward in hierarchy | Atom imports molecule for composition | REVERSE the dependency — compose downward |
| No barrel exports | Import paths 5 levels deep | Add `index.ts` at each level |
| Over-atomizing | Every `<span>` is an atom | Only make atoms for reused, styled elements |
| Under-atomizing | Organism has inline `<button>` elements | Extract to Button atom for consistency |

---

## 14. Enforcement Checklist

- [ ] Every component belongs to exactly ONE atomic level (atom/molecule/organism/template/page)
- [ ] Directory structure reflects atomic hierarchy (`atoms/`, `molecules/`, `organisms/`, `templates/`, `pages/`)
- [ ] Import dependencies flow DOWNWARD only (page → template → organism → molecule → atom)
- [ ] No circular dependencies exist between levels
- [ ] Atoms have ZERO domain knowledge and ZERO data fetching
- [ ] Atoms support all needed variants via props (not separate components)
- [ ] Molecules combine 2-5 atoms into functional units
- [ ] Organisms represent complete, self-contained UI sections
- [ ] Templates define layout structure WITHOUT data
- [ ] Pages connect templates with real data and handle loading/error/empty states
- [ ] Every atom has comprehensive accessibility support (ARIA, keyboard, focus)
- [ ] Every atom has a Storybook story covering all variants
- [ ] Barrel exports exist at each level (`index.ts`)
- [ ] Polymorphic components use `as` prop for semantic HTML flexibility
- [ ] State is owned at the appropriate level (atoms: none, molecules: UI, organisms: feature, pages: data)
- [ ] Tests exist at each level with appropriate test type (unit → integration → E2E)
- [ ] Component API uses composition over inheritance
- [ ] Cross-cutting concerns (providers, hooks, utils) live OUTSIDE atomic hierarchy
