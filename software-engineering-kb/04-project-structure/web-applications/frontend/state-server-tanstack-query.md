# Server State (TanStack Query / SWR) — Complete Specification

> **AI Plugin Directive:** When a developer asks "how do I fetch data in React?", "TanStack Query vs SWR?", "how do I cache API responses?", "what is staleTime vs gcTime?", "how do I do optimistic updates?", "how do I invalidate queries?", "useQuery vs useSWR?", "how do I prefetch data?", "infinite scroll in React?", "how do I handle loading/error states?", "should I use Redux for API data?", or anything about server state management, use this directive. Server state is fundamentally different from client state. It is asynchronous, has a source of truth you do not control (the server), requires caching, deduplication, background refetching, and stale data handling. NEVER manage server data with Redux/Zustand/Jotai — ALWAYS use TanStack Query or SWR.

---

## 1. The Core Rule

**Server data MUST be managed by a server state library (TanStack Query or SWR). NEVER store API responses in Redux, Zustand, Jotai, or useState. Server state libraries handle caching, background refetching, deduplication, stale data, error retries, pagination, optimistic updates, and garbage collection automatically. Building this yourself is a guaranteed source of bugs.**

```
WHY SERVER STATE IS DIFFERENT FROM CLIENT STATE
=================================================

  CLIENT STATE                          SERVER STATE
  ────────────                          ────────────
  • You own it                          • The server owns it
  • Synchronous                         • Asynchronous
  • Always up-to-date                   • Can be stale (out of date)
  • No caching needed                   • Caching is CRITICAL
  • Single source of truth              • Shared source (multiple users)
  • No loading/error states             • Always loading/error/success
  • No deduplication needed             • Same data fetched by many components
  • No background refresh               • Must refresh periodically
  • No retry logic                      • Network failures need retries

  Examples:                             Examples:
  • UI state (modal open, sidebar)      • User profile from API
  • Form input values                   • Product list from API
  • Theme preference                    • Order history from API
  • Selected tab                        • Search results from API
```

---

## 2. TanStack Query v5 — Architecture

```
TANSTACK QUERY ARCHITECTURE
==============================

  Component calls useQuery({ queryKey, queryFn })
       │
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                    QUERY CLIENT (cache)                       │
  │                                                              │
  │  ┌─────────────────────────────────────────────────────────┐ │
  │  │  Query Cache                                            │ │
  │  │                                                         │ │
  │  │  ['users']          → { data: [...], updatedAt: ... }  │ │
  │  │  ['users', 42]      → { data: {...}, updatedAt: ... }  │ │
  │  │  ['products', {q}]  → { data: [...], updatedAt: ... }  │ │
  │  │  ['orders', page:2] → { data: [...], updatedAt: ... }  │ │
  │  │                                                         │ │
  │  └─────────────────────────────────────────────────────────┘ │
  │                                                              │
  │  BEHAVIORS:                                                  │
  │  • staleTime: How long data is "fresh" (skip refetch)       │
  │  • gcTime: How long unused data stays in cache (GC)          │
  │  • refetchOnWindowFocus: Refresh when tab gets focus         │
  │  • refetchOnReconnect: Refresh when network reconnects       │
  │  • retry: Number of retries on failure                       │
  │  • deduplication: Same queryKey = one request, many listeners│
  └──────────────────────────────────────────────────────────────┘
       │
       ▼
  Component receives: { data, isLoading, isError, error, isFetching, ... }
```

```
CACHE LIFECYCLE
================

  Fresh ──(staleTime passes)──► Stale ──(trigger)──► Refetching
    │                              │                      │
    │ Serve from cache             │ Serve stale +        │ Replace with
    │ No network request           │ fetch in background   │ fresh data
    │                              │                      │
    ▼                              ▼                      ▼
  Component                    Component sees           Component sees
  sees data                    old data INSTANTLY       new data
  immediately                  then updates             (no loading spinner)

  ──(component unmounts)──► Inactive ──(gcTime passes)──► Garbage Collected
                             │                               │
                             │ Data stays in cache           │ Data removed
                             │ (for quick remount)           │ from memory
```

---

## 3. Query Keys Factory Pattern

**RULE: ALWAYS define query keys in a centralized factory. NEVER inline query key arrays in components. This enables type-safe invalidation, prefetching, and prevents key typos.**

```typescript
// ============================================================
// QUERY KEYS FACTORY — Centralized, type-safe, hierarchical
// ============================================================

// src/lib/api/queryKeys.ts
export const queryKeys = {
  // ---- Users ----
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: UserFilters) =>
      [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    me: () => [...queryKeys.users.all, 'me'] as const,
  },

  // ---- Products ----
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (filters: ProductFilters) =>
      [...queryKeys.products.lists(), filters] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.products.details(), id] as const,
    infinite: (filters: ProductFilters) =>
      [...queryKeys.products.all, 'infinite', filters] as const,
  },

  // ---- Orders ----
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (filters: OrderFilters) =>
      [...queryKeys.orders.lists(), filters] as const,
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.orders.details(), id] as const,
  },
} as const;

// USAGE IN INVALIDATION:
// queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
//   → Invalidates ALL user queries (lists, details, me)
//
// queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() })
//   → Invalidates all user list queries (any filter)
//
// queryClient.invalidateQueries({ queryKey: queryKeys.users.detail('42') })
//   → Invalidates ONLY user #42's detail
```

---

## 4. Complete CRUD Implementation

```typescript
// ============================================================
// TANSTACK QUERY v5: Complete CRUD — Products feature
// ============================================================

// --- Types ---
// src/features/products/types/product.types.ts
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

interface ProductFilters {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price' | 'name' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface CreateProductInput {
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  stock: number;
}

type UpdateProductInput = Partial<CreateProductInput>;

// --- API Layer ---
// src/features/products/api/products.api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const productsApi = {
  getAll: async (
    filters: ProductFilters,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<Product>> => {
    const params = { ...filters, page, pageSize };
    const { data } = await api.get<PaginatedResponse<Product>>('/products', { params });
    return data;
  },

  getById: async (id: string): Promise<Product> => {
    const { data } = await api.get<Product>(`/products/${id}`);
    return data;
  },

  create: async (input: CreateProductInput): Promise<Product> => {
    const { data } = await api.post<Product>('/products', input);
    return data;
  },

  update: async (id: string, input: UpdateProductInput): Promise<Product> => {
    const { data } = await api.patch<Product>(`/products/${id}`, input);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/products/${id}`);
  },
};

// --- Query Hooks ---
// src/features/products/hooks/useProducts.ts
import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useSuspenseQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queryKeys';
import { productsApi } from '../api/products.api';

// ---- READ: Paginated product list ----
export function useProducts(filters: ProductFilters, page = 1) {
  return useQuery({
    queryKey: queryKeys.products.list({ ...filters, page }),
    queryFn: () => productsApi.getAll(filters, page),
    staleTime: 1 * 60 * 1000,         // 1 min — products change occasionally
    gcTime: 5 * 60 * 1000,            // Keep in cache 5 min after unmount
    placeholderData: keepPreviousData, // Show old page while loading new page
  });
}

// ---- READ: Single product detail ----
export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.products.detail(id),
    queryFn: () => productsApi.getById(id),
    staleTime: 2 * 60 * 1000,
    enabled: !!id,  // Don't fetch if id is empty
  });
}

// ---- READ: Suspense variant (for React Suspense boundaries) ----
export function useProductSuspense(id: string) {
  return useSuspenseQuery({
    queryKey: queryKeys.products.detail(id),
    queryFn: () => productsApi.getById(id),
    staleTime: 2 * 60 * 1000,
  });
}

// ---- CREATE: New product ----
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: productsApi.create,
    onSuccess: (newProduct) => {
      // Invalidate all product lists — they now have a new item
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
      });
      // Pre-populate the detail cache for this new product
      queryClient.setQueryData(
        queryKeys.products.detail(newProduct.id),
        newProduct
      );
    },
    onError: (error) => {
      toast.error(`Failed to create product: ${error.message}`);
    },
  });
}

// ---- UPDATE: Edit product (optimistic update) ----
export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProductInput) => productsApi.update(id, input),

    // OPTIMISTIC UPDATE: Update cache BEFORE server responds
    onMutate: async (input) => {
      // 1. Cancel in-flight queries for this product (prevent overwrite)
      await queryClient.cancelQueries({
        queryKey: queryKeys.products.detail(id),
      });

      // 2. Snapshot previous value (for rollback)
      const previousProduct = queryClient.getQueryData<Product>(
        queryKeys.products.detail(id)
      );

      // 3. Optimistically update the cache
      if (previousProduct) {
        queryClient.setQueryData<Product>(
          queryKeys.products.detail(id),
          { ...previousProduct, ...input, updatedAt: new Date().toISOString() }
        );
      }

      // 4. Return snapshot for rollback
      return { previousProduct };
    },

    // ROLLBACK on server error
    onError: (_error, _variables, context) => {
      if (context?.previousProduct) {
        queryClient.setQueryData(
          queryKeys.products.detail(id),
          context.previousProduct
        );
      }
      toast.error('Failed to update product. Changes reverted.');
    },

    // ALWAYS refetch after mutation settles (success or error)
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
      });
    },
  });
}

// ---- DELETE: Remove product (optimistic) ----
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: productsApi.delete,

    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.products.lists(),
      });

      // Snapshot all list queries for rollback
      const previousLists = queryClient.getQueriesData<PaginatedResponse<Product>>({
        queryKey: queryKeys.products.lists(),
      });

      // Optimistically remove from all list caches
      queryClient.setQueriesData<PaginatedResponse<Product>>(
        { queryKey: queryKeys.products.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.filter((p) => p.id !== id),
            total: old.total - 1,
          };
        }
      );

      return { previousLists };
    },

    onError: (_error, _id, context) => {
      // Rollback all list caches
      context?.previousLists.forEach(([queryKey, data]) => {
        if (data) queryClient.setQueryData(queryKey, data);
      });
      toast.error('Failed to delete product');
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
      });
    },
  });
}

// ---- INFINITE SCROLL ----
export function useInfiniteProducts(filters: ProductFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.products.infinite(filters),
    queryFn: ({ pageParam }) => productsApi.getAll(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;  // No more pages
    },
    staleTime: 1 * 60 * 1000,
  });
}
```

---

## 5. Component Examples

```typescript
// ============================================================
// COMPONENT: Product List with pagination, filters, prefetching
// ============================================================

// src/features/products/components/ProductListPage.tsx
function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state → query parameters
  const filters: ProductFilters = {
    search: searchParams.get('q') ?? undefined,
    category: searchParams.get('category') ?? undefined,
    sortBy: (searchParams.get('sort') as ProductFilters['sortBy']) ?? 'createdAt',
    sortDir: (searchParams.get('dir') as ProductFilters['sortDir']) ?? 'desc',
  };
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  // Query — URL state drives the query key (automatic refetch on URL change)
  const { data, isLoading, isError, error, isFetching, isPlaceholderData } =
    useProducts(filters, page);

  // Prefetch next page while user views current page
  const queryClient = useQueryClient();
  useEffect(() => {
    if (data && page < data.totalPages) {
      queryClient.prefetchQuery({
        queryKey: queryKeys.products.list({ ...filters, page: page + 1 }),
        queryFn: () => productsApi.getAll(filters, page + 1),
        staleTime: 1 * 60 * 1000,
      });
    }
  }, [data, page, filters, queryClient]);

  const deleteMutation = useDeleteProduct();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1'); // Reset to page 1 on filter change
    setSearchParams(params, { replace: true });
  }

  if (isError) {
    return (
      <ErrorPage
        message={error.message}
        onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() })}
      />
    );
  }

  return (
    <div>
      <div className="flex gap-4 mb-6">
        <SearchInput
          value={filters.search ?? ''}
          onChange={(v) => updateFilter('q', v)}
          placeholder="Search products..."
        />
        <CategorySelect
          value={filters.category ?? ''}
          onChange={(v) => updateFilter('category', v)}
        />
        <SortSelect
          sortBy={filters.sortBy ?? 'createdAt'}
          sortDir={filters.sortDir ?? 'desc'}
          onChange={(by, dir) => {
            const params = new URLSearchParams(searchParams);
            params.set('sort', by);
            params.set('dir', dir);
            setSearchParams(params, { replace: true });
          }}
        />
      </div>

      {/* Show loading skeleton on initial load, spinner on refetch */}
      {isLoading ? (
        <ProductGridSkeleton count={20} />
      ) : (
        <>
          {/* Fade effect when fetching new page (placeholderData) */}
          <div className={isFetching && isPlaceholderData ? 'opacity-60' : ''}>
            <ProductGrid
              products={data?.items ?? []}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          </div>

          <Pagination
            page={page}
            totalPages={data?.totalPages ?? 1}
            onChange={(p) => updateFilter('page', String(p))}
          />
        </>
      )}
    </div>
  );
}

// ============================================================
// COMPONENT: Product Detail with Suspense
// ============================================================

// Wrapper with Suspense boundary
function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductDetail id={id!} />
    </Suspense>
  );
}

// Inner component — useSuspenseQuery throws promise (caught by Suspense)
function ProductDetail({ id }: { id: string }) {
  const { data: product } = useProductSuspense(id);
  const updateMutation = useUpdateProduct(id);

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <p className="text-2xl font-bold">${product.price.toFixed(2)}</p>
      <p>Stock: {product.stock}</p>
      <p>Category: {product.category}</p>

      <EditProductForm
        product={product}
        onSave={(updates) => updateMutation.mutate(updates)}
        isSaving={updateMutation.isPending}
      />
    </div>
  );
}

// ============================================================
// COMPONENT: Infinite scroll
// ============================================================

function InfiniteProductList() {
  const { search } = useSearchParams()[0] ? { search: '' } : { search: '' };
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteProducts({ search });

  // Intersection Observer for auto-loading
  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Flatten all pages into one array
  const allProducts = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading) return <ProductGridSkeleton count={20} />;
  if (isError) return <ErrorBanner message={error.message} />;

  return (
    <div>
      <ProductGrid products={allProducts} />

      {/* Sentinel element for intersection observer */}
      <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
        {isFetchingNextPage && <Spinner />}
        {!hasNextPage && allProducts.length > 0 && (
          <p className="text-muted-foreground">No more products</p>
        )}
      </div>
    </div>
  );
}
```

---

## 6. Advanced Patterns

### Parallel Queries

```typescript
// ============================================================
// PARALLEL QUERIES — Multiple independent queries at once
// ============================================================

function DashboardPage() {
  // These queries fire in PARALLEL — not waterfall
  const ordersQuery = useQuery({
    queryKey: queryKeys.orders.list({ status: 'pending' }),
    queryFn: () => ordersApi.getAll({ status: 'pending' }),
  });

  const productsQuery = useQuery({
    queryKey: queryKeys.products.list({ lowStock: true }),
    queryFn: () => productsApi.getAll({ lowStock: true }),
  });

  const statsQuery = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats(),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = ordersQuery.isLoading || productsQuery.isLoading || statsQuery.isLoading;

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="grid grid-cols-3 gap-6">
      <StatsCards stats={statsQuery.data!} />
      <PendingOrders orders={ordersQuery.data!.items} />
      <LowStockProducts products={productsQuery.data!.items} />
    </div>
  );
}
```

### Dependent Queries

```typescript
// ============================================================
// DEPENDENT QUERIES — Query B depends on Query A's result
// ============================================================

function UserOrdersPage() {
  // Query A: Fetch the current user
  const { data: user } = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => usersApi.getMe(),
  });

  // Query B: Fetch the user's orders — ONLY after user is loaded
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: queryKeys.orders.list({ userId: user?.id }),
    queryFn: () => ordersApi.getAll({ userId: user!.id }),
    enabled: !!user?.id,  // ← CRITICAL: prevents fetch when user is undefined
  });

  // Query C: Fetch the user's team — ONLY after user is loaded
  const { data: team } = useQuery({
    queryKey: ['teams', user?.teamId],
    queryFn: () => teamsApi.getById(user!.teamId),
    enabled: !!user?.teamId,
  });

  // ...
}
```

### Prefetching (Hover/Route)

```typescript
// ============================================================
// PREFETCHING — Load data BEFORE the user needs it
// ============================================================

// 1. Prefetch on hover (instant perceived navigation)
function ProductCard({ product }: { product: Product }) {
  const queryClient = useQueryClient();

  function handleMouseEnter() {
    queryClient.prefetchQuery({
      queryKey: queryKeys.products.detail(product.id),
      queryFn: () => productsApi.getById(product.id),
      staleTime: 30 * 1000,  // Don't refetch if less than 30s old
    });
  }

  return (
    <Link
      to={`/products/${product.id}`}
      onMouseEnter={handleMouseEnter}  // Prefetch on hover!
      onFocus={handleMouseEnter}       // Also on keyboard focus
    >
      <div className="p-4 border rounded">
        <img src={product.imageUrl} alt={product.name} />
        <h3>{product.name}</h3>
        <p>${product.price.toFixed(2)}</p>
      </div>
    </Link>
  );
}

// 2. Prefetch on route load (React Router loader)
// src/app/routes.tsx
import { queryClient } from '@/lib/queryClient';

const routes = [
  {
    path: '/products/:id',
    element: <ProductDetailPage />,
    loader: async ({ params }) => {
      // Prefetch in route loader — data ready when component mounts
      await queryClient.ensureQueryData({
        queryKey: queryKeys.products.detail(params.id!),
        queryFn: () => productsApi.getById(params.id!),
        staleTime: 30 * 1000,
      });
      return null;
    },
  },
];
```

---

## 7. Cache Configuration Guide

```
CACHE CONFIGURATION — staleTime vs gcTime
============================================

  ┌──────────────┬──────────────────────────────────────────────────────────┐
  │  Option      │  What it Controls                                        │
  ├──────────────┼──────────────────────────────────────────────────────────┤
  │  staleTime   │  How long data is considered "fresh" after fetch.        │
  │              │  While fresh: NO background refetch on mount/focus.      │
  │              │  After stale: refetch in background, show stale data.    │
  │              │  DEFAULT: 0 (always stale — always refetch)              │
  ├──────────────┼──────────────────────────────────────────────────────────┤
  │  gcTime      │  How long INACTIVE data stays in cache before garbage    │
  │  (was        │  collection. Inactive = no component is subscribed.      │
  │  cacheTime)  │  DEFAULT: 5 minutes                                     │
  └──────────────┴──────────────────────────────────────────────────────────┘

  TIMELINE EXAMPLE (staleTime: 1min, gcTime: 5min):
  ═══════════════════════════════════════════════════

  T=0     Component mounts → fetches data
  T=0     Data is FRESH (staleTime = 1min)
  T=30s   Another component mounts with same key → serves from cache (no fetch)
  T=1min  Data becomes STALE
  T=1.5m  Component remounts → shows stale data + refetches in background
  T=2min  All components unmount → data becomes INACTIVE
  T=7min  gcTime (5min) passes → data garbage collected from cache

  RECOMMENDED staleTime BY DATA TYPE:
  ╔══════════════════════════════╦════════════════════════════════════╗
  ║  Data Type                   ║  staleTime Recommendation          ║
  ╠══════════════════════════════╬════════════════════════════════════╣
  ║  User profile                ║  5 min (changes rarely)            ║
  ║  Product catalog             ║  1-5 min (changes occasionally)    ║
  ║  Search results              ║  0-30 sec (changes per query)      ║
  ║  Dashboard stats             ║  30 sec - 2 min                    ║
  ║  Real-time data (chat, stock)║  0 (always refetch)                ║
  ║  Static reference data       ║  Infinity (never refetch)          ║
  ║  (countries, categories)     ║  staleTime: Infinity               ║
  ╚══════════════════════════════╩════════════════════════════════════╝
```

### QueryClient Configuration

```typescript
// ============================================================
// QUERYCLIENT SETUP — Production configuration
// ============================================================

// src/lib/queryClient.ts
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1 * 60 * 1000,       // 1 min default — override per query
      gcTime: 5 * 60 * 1000,          // 5 min (default)
      retry: 3,                        // Retry failed queries 3 times
      retryDelay: (attemptIndex) =>    // Exponential backoff
        Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,      // Refetch stale data on tab focus
      refetchOnReconnect: true,        // Refetch on network reconnect
      refetchOnMount: true,            // Refetch stale data on mount
      throwOnError: false,             // Don't throw — handle in component
    },
    mutations: {
      retry: 1,                        // Retry mutations once
      throwOnError: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Global error handler for queries
      if (query.state.data !== undefined) {
        // Only show toast if we already had data (background refetch failed)
        toast.error(`Background update failed: ${error.message}`);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      // Global error handler for mutations
      console.error('Mutation failed:', error);
    },
  }),
});

// --- Provider Setup ---
// src/app/providers.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      )}
    </QueryClientProvider>
  );
}
```

---

## 8. TanStack Query vs SWR Comparison

```
┌─────────────────────────┬──────────────────────────┬──────────────────────────┐
│  Feature                │  TanStack Query v5       │  SWR v2                  │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  Bundle size            │  ~13kB gzipped           │  ~4kB gzipped            │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  DevTools               │  Built-in (excellent)    │  Community (basic)       │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  Mutations              │  useMutation (full)      │  useSWRMutation (basic)  │
│                         │  optimistic, rollback    │  less mature             │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  Infinite queries       │  useInfiniteQuery        │  useSWRInfinite          │
│                         │  (mature, well-typed)    │  (works, less features)  │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  Suspense               │  useSuspenseQuery        │  { suspense: true }      │
│                         │  (dedicated hook)        │  (config option)         │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  Parallel queries       │  Automatic               │  Automatic               │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  Dependent queries      │  enabled: !!data         │  Conditional fetcher     │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  Query invalidation     │  queryClient.invalidate  │  mutate(key) / global    │
│                         │  (hierarchical keys)     │  mutate                  │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  Prefetching            │  prefetchQuery /         │  preload / mutate        │
│                         │  ensureQueryData         │  (less ergonomic)        │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  Optimistic updates     │  onMutate + context      │  Possible but manual     │
│                         │  (first-class pattern)   │  (less documented)       │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  Cache persistence      │  persistQueryClient      │  No built-in             │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  Offline support        │  onlineManager + persist │  Limited                 │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  Retry configuration    │  retry, retryDelay       │  shouldRetryOnError,     │
│                         │  (per query, exponential)│  errorRetryCount         │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  Framework support      │  React, Vue, Solid,      │  React only              │
│                         │  Svelte, Angular         │                          │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  TypeScript             │  Excellent (generic)     │  Good (generic)          │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  Scroll restoration     │  Built-in                │  Manual                  │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  SSR/Next.js            │  Hydration support       │  SWR designed for Next   │
│                         │  (prefetch on server)    │  (same team — Vercel)    │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  Learning curve         │  Medium                  │  Low                     │
├─────────────────────────┼──────────────────────────┼──────────────────────────┤
│  RECOMMENDATION         │  DEFAULT CHOICE for      │  Good for simple apps    │
│                         │  most projects.          │  or Next.js projects     │
│                         │  Most complete. Best     │  that want minimal       │
│                         │  mutations/caching.      │  bundle size.            │
└─────────────────────────┴──────────────────────────┴──────────────────────────┘

DECISION:
  • Use TanStack Query when: Mutations, optimistic updates, complex caching,
    multi-framework, DevTools needed, large app
  • Use SWR when: Simple read-heavy app, Next.js project, minimal bundle size
    priority, no complex mutations
  • NEVER use both in the same project
```

---

## 9. SWR Equivalent Example

```typescript
// ============================================================
// SWR: Equivalent product hooks for comparison
// ============================================================

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import useSWRInfinite from 'swr/infinite';

// Generic fetcher
const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// READ: Product list
function useProducts(filters: ProductFilters, page = 1) {
  const params = new URLSearchParams({
    ...filters,
    page: String(page),
  } as Record<string, string>);

  return useSWR<PaginatedResponse<Product>>(
    `/api/products?${params}`,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 60 * 1000,   // Similar to staleTime
      keepPreviousData: true,        // Like placeholderData
    }
  );
}

// READ: Single product
function useProduct(id: string | undefined) {
  return useSWR<Product>(
    id ? `/api/products/${id}` : null,  // null key = don't fetch
    fetcher,
    { dedupingInterval: 2 * 60 * 1000 }
  );
}

// CREATE: New product
function useCreateProduct() {
  return useSWRMutation<Product, Error, string, CreateProductInput>(
    '/api/products',
    async (url, { arg }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arg),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }
  );
}

// INFINITE: Infinite scroll
function useInfiniteProducts(filters: ProductFilters) {
  return useSWRInfinite<PaginatedResponse<Product>>(
    (pageIndex) => {
      const params = new URLSearchParams({
        ...filters,
        page: String(pageIndex + 1),
      } as Record<string, string>);
      return `/api/products?${params}`;
    },
    fetcher,
    { revalidateOnFocus: false }
  );
}
```

---

## 10. Mutation Patterns — Complete Reference

```typescript
// ============================================================
// MUTATION PATTERN 1: Simple (invalidate after success)
// ============================================================
// Best for: When you want the server to be the source of truth
// after mutation. Simplest, safest, slight delay for UI update.

const createMutation = useMutation({
  mutationFn: productsApi.create,
  onSuccess: () => {
    // Refetch all product lists from server
    queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
  },
});

// ============================================================
// MUTATION PATTERN 2: Cache update (setQueryData after success)
// ============================================================
// Best for: When the mutation response contains the full updated entity.
// Avoids a refetch — updates cache directly with server response.

const updateMutation = useMutation({
  mutationFn: ({ id, data }: { id: string; data: UpdateProductInput }) =>
    productsApi.update(id, data),
  onSuccess: (updatedProduct) => {
    // Update detail cache with server response
    queryClient.setQueryData(
      queryKeys.products.detail(updatedProduct.id),
      updatedProduct
    );
    // Invalidate lists (they might sort/filter differently now)
    queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
  },
});

// ============================================================
// MUTATION PATTERN 3: Optimistic update (update BEFORE server)
// ============================================================
// Best for: When you want instant UI feedback. Most complex.
// MUST handle rollback on error.
// See useUpdateProduct() in Section 4 for complete example.

// ============================================================
// MUTATION PATTERN 4: Mutation + redirect (create, then navigate)
// ============================================================

function CreateProductPage() {
  const navigate = useNavigate();
  const createMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: (newProduct) => {
      // Pre-populate detail cache
      queryClient.setQueryData(
        queryKeys.products.detail(newProduct.id),
        newProduct
      );
      // Navigate to the new product
      navigate(`/products/${newProduct.id}`);
      toast.success('Product created!');
    },
  });

  return (
    <ProductForm
      onSubmit={(data) => createMutation.mutate(data)}
      isSubmitting={createMutation.isPending}
      error={createMutation.error?.message}
    />
  );
}
```

---

## 11. Anti-Patterns Table

```
┌───────────────────────────────────┬──────────────────────────────────┬──────────────────────────────────────┐
│  Anti-Pattern                     │  Symptom                         │  Fix                                 │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Server data in Redux/Zustand     │  Manual isLoading, isError       │  Use TanStack Query / SWR.           │
│  (useEffect + setState)           │  booleans. Stale data. No cache  │  These handle loading, error, cache, │
│                                   │  invalidation. No retry.         │  retry, dedup, and background refetch│
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Inline query keys                │  queryKey: ['products', id]      │  Use query keys factory pattern.     │
│  (string arrays in components)    │  scattered across codebase.      │  Centralize in queryKeys.ts.         │
│                                   │  Typos cause cache misses.       │  Hierarchical keys for invalidation. │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  staleTime: 0 (default) for      │  Every mount triggers a network  │  Set staleTime: 1-5 min for data     │
│  all queries                      │  request. Redundant API calls.   │  that doesn't change every second.   │
│                                   │  Server overload.                │  Infinity for static reference data. │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Optimistic update without        │  UI shows success, then server   │  ALWAYS implement onError rollback   │
│  rollback                         │  rejects. UI is in impossible    │  with previous state snapshot.       │
│                                   │  state until next refetch.       │  See Pattern 3 in Section 10.        │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Creating QueryClient in          │  New QueryClient on every render.│  Create QueryClient OUTSIDE the      │
│  component render                 │  Cache is lost every render.     │  component (module level) or in      │
│                                   │  Infinite loading states.        │  useState(() => new QueryClient()). │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Not using enabled: false         │  Dependent query fires with      │  Set enabled: !!dependency.          │
│  for dependent queries            │  undefined parameter. 404 or     │  Query only fires when dependency    │
│                                   │  error on first render.          │  is truthy.                          │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Mutating cache without           │  After optimistic update, a      │  ALWAYS call invalidateQueries in    │
│  invalidation                     │  background refetch overwrites   │  onSettled (runs on success AND      │
│                                   │  your changes. Or cache is       │  error) to ensure eventual truth.    │
│                                   │  permanently out of sync.        │                                      │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Fetching in useEffect            │  Loading spinner on every mount. │  useQuery deduplicates. Multiple     │
│  (ignoring deduplication)         │  Same API called 5x because 5   │  components with same queryKey =     │
│                                   │  components need same data.      │  one request, shared cache.          │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Not handling error states        │  White screen when API fails.    │  ALWAYS check isError / error.       │
│                                   │  Unhandled promise rejections.   │  Show error UI with retry button.    │
│                                   │                                  │  Use ErrorBoundary for Suspense.     │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  No DevTools in development       │  Cannot inspect cache state,     │  ALWAYS add ReactQueryDevtools in    │
│                                   │  active queries, or mutation     │  development. It shows cache entries,│
│                                   │  status. Debugging is blind.     │  stale/fresh status, and timings.    │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Waterfall queries                │  Serial fetches: A → wait →     │  Use parallel useQuery calls.        │
│  (unnecessary dependencies)       │  B → wait → C. Slow page load.  │  Only use enabled/dependent when     │
│                                   │                                  │  B truly needs A's data.             │
└───────────────────────────────────┴──────────────────────────────────┴──────────────────────────────────────┘
```

---

## 12. Enforcement Checklist

```
SERVER STATE REVIEW CHECKLIST
================================

LIBRARY SETUP:
[ ] QueryClient created OUTSIDE components (module-level or useState)
[ ] QueryClientProvider wraps the entire app
[ ] ReactQueryDevtools added in development mode
[ ] Default staleTime set > 0 (NOT the 0 default) — tune per query type
[ ] Global error handler configured in QueryCache.onError
[ ] Retry configured with exponential backoff

QUERY PATTERNS:
[ ] ALL server data uses useQuery / useSuspenseQuery — NEVER useEffect+fetch+setState
[ ] Query keys defined in centralized factory (queryKeys.ts)
[ ] Query keys are hierarchical (enable bulk invalidation)
[ ] Dependent queries use enabled: !!dependency
[ ] Parallel queries are NOT unnecessarily serialized
[ ] staleTime tuned per data type (not left at 0 for everything)
[ ] Static reference data uses staleTime: Infinity
[ ] placeholderData: keepPreviousData used for paginated queries

MUTATION PATTERNS:
[ ] Every mutation has onSuccess with invalidation OR cache update
[ ] Optimistic updates have onError with rollback (context.previousData)
[ ] Optimistic updates have onSettled with invalidateQueries
[ ] Mutations cancel in-flight queries before optimistic update (cancelQueries)
[ ] Mutation loading state shown in UI (isPending)
[ ] Mutation errors shown to user (toast/banner)

PERFORMANCE:
[ ] Prefetching used for predictable navigation (hover, route loader)
[ ] Infinite queries use useInfiniteQuery (NOT manual page state + useQuery)
[ ] Suspense boundaries placed strategically (NOT wrapping entire app)
[ ] No duplicate queries — check DevTools for redundant cache entries

TESTING:
[ ] Tests wrap components in QueryClientProvider with fresh QueryClient
[ ] Each test creates its own QueryClient (no shared state)
[ ] retry: false in test QueryClient (fast failures)
[ ] API calls mocked at the network level (MSW) — NOT by mocking hooks
```
