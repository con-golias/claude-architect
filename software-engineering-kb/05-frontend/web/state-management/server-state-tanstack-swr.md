# Server State: TanStack Query & SWR — Complete Specification

> **AI Plugin Directive:** When implementing data fetching, caching, synchronization with server data, optimistic updates, or infinite scrolling, ALWAYS consult this guide. Apply TanStack Query (React Query) or SWR patterns to manage server state instead of storing API responses in client state. This guide covers cache configuration, query patterns, mutations with optimistic updates, infinite queries, prefetching, and real-time data synchronization.

**Core Rule: NEVER store server data in useState, useReducer, Redux, or Zustand. Server data is NOT client state — it is a cache of remote data. Use TanStack Query or SWR to manage the cache lifecycle (fetching, caching, deduplication, refetching, invalidation). The query key is the cache identity — it MUST include ALL variables that affect the query result. ALWAYS handle loading, error, and empty states for every query.**

---

## 1. Server State vs Client State

```
                    STATE CATEGORIES

  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  CLIENT STATE                 SERVER STATE       │
  │  (Owned by client)            (Cached from server)│
  │                                                  │
  │  ├── Theme preference         ├── User profile   │
  │  ├── Sidebar open/closed      ├── Product list   │
  │  ├── Form input values        ├── Order history  │
  │  ├── Modal visibility         ├── Search results │
  │  ├── Selected tab             ├── Comments       │
  │  └── Drag position            └── Notifications  │
  │                                                  │
  │  Manage with:                 Manage with:        │
  │  useState, Zustand,           TanStack Query,     │
  │  Jotai, Context               SWR                 │
  │                                                  │
  │  RULE: NEVER mix them.                           │
  │  Server data has different lifecycle:            │
  │  - Can become stale                              │
  │  - Needs background refetching                   │
  │  - Needs cache invalidation                      │
  │  - Can be modified by other users                │
  │  - Requires loading/error states                 │
  └──────────────────────────────────────────────────┘
```

---

## 2. TanStack Query Setup

```typescript
// providers/query-provider.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes — data considered fresh
      gcTime: 30 * 60 * 1000,           // 30 minutes — garbage collection time
      retry: 3,                          // Retry failed requests 3 times
      retryDelay: (attempt) =>
        Math.min(1000 * 2 ** attempt, 30000), // Exponential backoff
      refetchOnWindowFocus: true,        // Refetch when tab gains focus
      refetchOnReconnect: true,          // Refetch when network reconnects
      refetchOnMount: true,              // Refetch when component mounts
      throwOnError: false,               // Don't throw — handle in component
    },
    mutations: {
      retry: 1,
      throwOnError: false,
    },
  },
});

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

---

## 3. Query Patterns

### 3.1 Basic Query

```typescript
// hooks/use-products.ts
import { useQuery } from '@tanstack/react-query';

interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price' | 'name' | 'newest';
  page?: number;
  limit?: number;
}

async function fetchProducts(filters: ProductFilters): Promise<ProductsResponse> {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.minPrice) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const response = await fetch(`/api/products?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.statusText}`);
  }
  return response.json();
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    // Query key MUST include ALL variables that affect the result
    queryKey: ['products', filters],
    queryFn: () => fetchProducts(filters),
    staleTime: 2 * 60 * 1000,           // 2 minutes fresh
    placeholderData: keepPreviousData,    // Show old data while fetching new
  });
}

// Usage in component
function ProductGrid() {
  const filters = useFiltersFromURL();
  const { data, isLoading, isError, error, isFetching } = useProducts(filters);

  if (isLoading) return <ProductGridSkeleton />;
  if (isError) return <ErrorState error={error} />;
  if (!data?.products.length) return <EmptyState />;

  return (
    <>
      {isFetching && <RefetchingIndicator />}
      <div className="grid grid-cols-3 gap-4">
        {data.products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </>
  );
}
```

### 3.2 Dependent Queries

```typescript
// Query that depends on another query's result
function useUserOrders(userId: string | undefined) {
  return useQuery({
    queryKey: ['orders', userId],
    queryFn: () => fetchOrders(userId!),
    enabled: !!userId,  // Only run when userId is available
  });
}

// Usage — chained queries
function UserDashboard() {
  const { data: user } = useUser();
  const { data: orders } = useUserOrders(user?.id);
  // orders query waits for user query to complete
}
```

### 3.3 Parallel Queries

```typescript
// Multiple independent queries — run in parallel automatically
function Dashboard() {
  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  });

  const analyticsQuery = useQuery({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
  });

  // All three fetch in parallel
  const isLoading = productsQuery.isLoading || ordersQuery.isLoading || analyticsQuery.isLoading;
}

// useQueries for dynamic parallel queries
function ProductComparison({ productIds }: { productIds: string[] }) {
  const queries = useQueries({
    queries: productIds.map(id => ({
      queryKey: ['product', id],
      queryFn: () => fetchProduct(id),
    })),
  });

  const isLoading = queries.some(q => q.isLoading);
  const products = queries.map(q => q.data).filter(Boolean);
}
```

---

## 4. Query Key Design

```
  QUERY KEY RULES:

  ┌──────────────────────────────────────────────────────────┐
  │ 1. Query keys are ARRAYS (like file paths)               │
  │ 2. Include ALL variables that affect the query result    │
  │ 3. Order: general → specific                            │
  │ 4. Keys are serialized with JSON — objects are compared  │
  │    by value, not reference                               │
  │ 5. Use query key factories for consistency               │
  └──────────────────────────────────────────────────────────┘

  EXAMPLES:
  ['products']                    ← All products
  ['products', { category: 'electronics' }] ← Filtered
  ['products', { category: 'electronics', sort: 'price' }] ← Filtered + sorted
  ['product', '123']              ← Single product by ID
  ['users', userId, 'orders']     ← User's orders
  ['users', userId, 'orders', { page: 2 }] ← Paginated
```

### 4.1 Query Key Factory

```typescript
// query-keys.ts — Centralized query key management
export const queryKeys = {
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (filters: ProductFilters) => [...queryKeys.products.lists(), filters] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.products.details(), id] as const,
  },
  users: {
    all: ['users'] as const,
    detail: (id: string) => [...queryKeys.users.all, id] as const,
    orders: (userId: string) => [...queryKeys.users.all, userId, 'orders'] as const,
  },
  orders: {
    all: ['orders'] as const,
    detail: (id: string) => [...queryKeys.orders.all, id] as const,
  },
};

// Usage
useQuery({ queryKey: queryKeys.products.list({ category: 'electronics' }), ... });
useQuery({ queryKey: queryKeys.products.detail('123'), ... });

// Invalidation — fuzzy matching
queryClient.invalidateQueries({ queryKey: queryKeys.products.all });  // Invalidates ALL product queries
queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() }); // Invalidates only lists
```

---

## 5. Mutations

### 5.1 Basic Mutation

```typescript
// hooks/use-create-product.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newProduct: CreateProductDTO) => {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct),
      });
      if (!response.ok) throw new Error('Failed to create product');
      return response.json() as Promise<Product>;
    },

    onSuccess: (createdProduct) => {
      // Invalidate product list queries — trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });

      // Optionally: seed the cache for the detail query
      queryClient.setQueryData(
        queryKeys.products.detail(createdProduct.id),
        createdProduct
      );
    },

    onError: (error) => {
      toast.error(`Failed to create product: ${error.message}`);
    },
  });
}

// Usage
function CreateProductForm() {
  const createProduct = useCreateProduct();

  const handleSubmit = async (data: CreateProductDTO) => {
    try {
      await createProduct.mutateAsync(data);
      toast.success('Product created!');
      router.push('/products');
    } catch {
      // Error handled in mutation's onError
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... */}
      <button type="submit" disabled={createProduct.isPending}>
        {createProduct.isPending ? 'Creating...' : 'Create Product'}
      </button>
    </form>
  );
}
```

### 5.2 Optimistic Updates

```typescript
// hooks/use-toggle-todo.ts
export function useToggleTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      if (!response.ok) throw new Error('Failed to update todo');
      return response.json() as Promise<Todo>;
    },

    // Optimistic update — update cache BEFORE server responds
    onMutate: async ({ id, completed }) => {
      // Cancel any in-flight queries (prevent overwrite)
      await queryClient.cancelQueries({ queryKey: queryKeys.todos.all });

      // Snapshot previous value (for rollback)
      const previousTodos = queryClient.getQueryData<Todo[]>(queryKeys.todos.all);

      // Optimistically update cache
      queryClient.setQueryData<Todo[]>(queryKeys.todos.all, (old) =>
        old?.map(todo =>
          todo.id === id ? { ...todo, completed } : todo
        )
      );

      // Return context with snapshot for rollback
      return { previousTodos };
    },

    // Rollback on error
    onError: (_error, _variables, context) => {
      if (context?.previousTodos) {
        queryClient.setQueryData(queryKeys.todos.all, context.previousTodos);
      }
      toast.error('Failed to update todo');
    },

    // Refetch after mutation settles (success or error)
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
    },
  });
}
```

### 5.3 Optimistic Update Flow

```
  OPTIMISTIC UPDATE FLOW:

  User Action          Cache            Server          UI
       │                 │                │              │
       │  Click toggle   │                │              │
       ├────────────────▶│                │              │
       │                 │ onMutate:      │              │
       │                 │ ├─ Cancel      │              │
       │                 │ │  in-flight   │              │
       │                 │ ├─ Snapshot    │              │
       │                 │ │  old data    │              │
       │                 │ ├─ Update      │              │
       │                 │ │  cache       │              │
       │                 │ └─────────────▶│ ◀─ INSTANT   │
       │                 │                │   UI UPDATE  │
       │                 │  mutationFn    │              │
       │                 │────────────────▶│              │
       │                 │                │ Process      │
       │                 │                │ request      │
       │                 │                │              │
       │                 │  ┌─ SUCCESS ───┤              │
       │                 │  │             │              │
       │                 │  │ onSettled:  │              │
       │                 │  │ Invalidate  │              │
       │                 │  │ + refetch   │              │
       │                 │  │             │              │
       │                 │  └─ ERROR ─────┤              │
       │                 │    │           │              │
       │                 │    │ onError:  │              │
       │                 │    │ Rollback  │              │
       │                 │    │ to snap   │ ◀─ ROLLBACK  │
       │                 │    └──────────▶│              │
```

---

## 6. Infinite Queries (Pagination)

```typescript
// hooks/use-infinite-products.ts
import { useInfiniteQuery } from '@tanstack/react-query';

interface ProductPage {
  products: Product[];
  nextCursor: string | null;
  total: number;
}

export function useInfiniteProducts(category?: string) {
  return useInfiniteQuery({
    queryKey: ['products', 'infinite', { category }],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (pageParam) params.set('cursor', pageParam);
      params.set('limit', '20');

      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json() as Promise<ProductPage>;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000,
  });
}

// Usage with intersection observer for infinite scroll
function InfiniteProductList() {
  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useInfiniteProducts();

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isLoading) return <ProductGridSkeleton />;

  const allProducts = data?.pages.flatMap(page => page.products) ?? [];

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {allProducts.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      <div ref={sentinelRef}>
        {isFetchingNextPage && <Spinner />}
      </div>
    </>
  );
}
```

---

## 7. Prefetching

```typescript
// ─── Prefetch on hover ───
function ProductCard({ product }: { product: Product }) {
  const queryClient = useQueryClient();

  const handleMouseEnter = () => {
    // Prefetch product detail when user hovers
    queryClient.prefetchQuery({
      queryKey: queryKeys.products.detail(product.id),
      queryFn: () => fetchProduct(product.id),
      staleTime: 5 * 60 * 1000,
    });
  };

  return (
    <Link
      href={`/products/${product.id}`}
      onMouseEnter={handleMouseEnter}
    >
      {product.name}
    </Link>
  );
}

// ─── Prefetch on route navigation (Next.js) ───
// app/products/[id]/page.tsx
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';

export default async function ProductPage({ params }: Props) {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.products.detail(params.id),
    queryFn: () => fetchProduct(params.id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductDetail id={params.id} />
    </HydrationBoundary>
  );
}

// ─── Prefetch next page ───
function PaginatedList({ currentPage }: { currentPage: number }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Prefetch next page
    queryClient.prefetchQuery({
      queryKey: queryKeys.products.list({ page: currentPage + 1 }),
      queryFn: () => fetchProducts({ page: currentPage + 1 }),
    });
  }, [currentPage]);

  return /* ... */;
}
```

---

## 8. Cache Management

### 8.1 Cache Configuration

```
  CACHE TIMING:

  ┌──────────────┬────────────────────────────────────────┐
  │ staleTime    │ How long data is "fresh"                │
  │              │ Fresh data: NEVER refetched             │
  │              │ Default: 0 (always stale)               │
  │              │ Set to Infinity for truly static data   │
  ├──────────────┼────────────────────────────────────────┤
  │ gcTime       │ How long INACTIVE cache entries stay    │
  │              │ (previously: cacheTime)                 │
  │              │ Default: 5 minutes                      │
  │              │ After this, cache is garbage collected   │
  ├──────────────┼────────────────────────────────────────┤
  │ refetchOnX   │ Automatic refetch triggers:             │
  │              │ refetchOnWindowFocus: true (default)    │
  │              │ refetchOnReconnect: true (default)      │
  │              │ refetchOnMount: true (default)          │
  ├──────────────┼────────────────────────────────────────┤
  │ refetchInterval │ Poll at interval (ms)               │
  │              │ Set for real-time-ish data              │
  │              │ refetchIntervalInBackground: false      │
  └──────────────┴────────────────────────────────────────┘
```

### 8.2 Stale Time Recommendations

| Data Type | Stale Time | Rationale |
|-----------|-----------|-----------|
| User session | 5-15 min | Doesn't change often, critical data |
| Product list | 1-5 min | Inventory/prices can change |
| Product detail | 5-10 min | Single item, less volatile |
| Search results | 30 sec | Should feel current |
| Dashboard metrics | 30-60 sec | Near real-time |
| Static content (about, FAQ) | 1 hour+ | Rarely changes |
| User preferences | 15-30 min | Changed by same user only |
| Comments/feed | 30 sec - 2 min | Actively updated by others |

---

## 9. SWR Comparison

### 9.1 SWR Basic Usage

```typescript
// SWR — lighter alternative to TanStack Query
import useSWR from 'swr';

// Global fetcher
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
});

// SWR configuration
import { SWRConfig } from 'swr';

function App({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{
      fetcher,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      errorRetryCount: 3,
    }}>
      {children}
    </SWRConfig>
  );
}

// Usage
function ProductList() {
  const { data, error, isLoading, mutate } = useSWR<Product[]>('/api/products');

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorState />;

  return /* ... */;
}

// SWR mutation
import useSWRMutation from 'swr/mutation';

function useCreateProduct() {
  return useSWRMutation(
    '/api/products',
    async (url, { arg }: { arg: CreateProductDTO }) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arg),
      });
      if (!response.ok) throw new Error('Failed');
      return response.json();
    }
  );
}
```

### 9.2 TanStack Query vs SWR

| Feature | TanStack Query | SWR |
|---------|---------------|-----|
| Bundle size | ~13KB | ~4KB |
| DevTools | ✅ Excellent | ⚠️ Basic |
| Mutations | ✅ useMutation (full lifecycle) | ✅ useSWRMutation |
| Optimistic updates | ✅ Built-in pattern | ⚠️ Manual |
| Infinite queries | ✅ useInfiniteQuery | ✅ useSWRInfinite |
| Prefetching | ✅ prefetchQuery | ✅ preload |
| Cache invalidation | ✅ Granular (query keys) | ✅ mutate (key-based) |
| Suspense | ✅ useSuspenseQuery | ✅ { suspense: true } |
| SSR/Hydration | ✅ HydrationBoundary | ✅ SWRConfig fallback |
| Offline | ✅ Built-in | ⚠️ Plugin needed |
| Retry | ✅ Configurable | ✅ Configurable |
| TypeScript | ✅ Excellent | ✅ Good |
| Framework support | React, Vue, Solid, Angular | React only |
| Best for | Full-featured, complex apps | Simpler apps, smaller bundle |

---

## 10. Error Handling

```typescript
// ─── Global error handler ───
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry 4xx errors
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

// ─── Query-level error handling ───
function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    retry: (failureCount, error) => {
      if ((error as ApiError).status === 404) return false;
      return failureCount < 2;
    },
  });
}

// ─── Error boundary integration ───
function ProductDetail({ id }: { id: string }) {
  const { data, error, isError } = useProduct(id);

  if (isError) {
    if ((error as ApiError).status === 404) {
      return <NotFound message="Product not found" />;
    }
    return <ErrorState error={error} onRetry={() => queryClient.invalidateQueries(['product', id])} />;
  }

  return /* ... */;
}
```

---

## 11. Real-Time Data Integration

```typescript
// WebSocket + TanStack Query for real-time updates
function useRealtimeQuery<T>(queryKey: QueryKey, queryFn: () => Promise<T>, wsChannel: string) {
  const queryClient = useQueryClient();

  // Standard query for initial data
  const query = useQuery({ queryKey, queryFn });

  // WebSocket subscription for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`wss://api.example.com/ws`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ subscribe: wsChannel }));
    };

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);

      switch (update.type) {
        case 'update':
          // Update specific cache entry
          queryClient.setQueryData(queryKey, (old: T) => ({
            ...old,
            ...update.data,
          }));
          break;

        case 'invalidate':
          // Trigger refetch
          queryClient.invalidateQueries({ queryKey });
          break;
      }
    };

    return () => ws.close();
  }, [wsChannel]);

  return query;
}

// Usage
function StockPrice({ symbol }: { symbol: string }) {
  const { data } = useRealtimeQuery(
    ['stock', symbol],
    () => fetchStockPrice(symbol),
    `stocks:${symbol}`
  );

  return <span>${data?.price}</span>;
}
```

---

## 12. Testing

```typescript
// ─── Testing with TanStack Query ───
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// Test a custom hook
describe('useProducts', () => {
  it('fetches products successfully', async () => {
    // Mock API
    server.use(
      http.get('/api/products', () => {
        return HttpResponse.json([
          { id: '1', name: 'Widget', price: 9.99 },
        ]);
      })
    );

    const { result } = renderHook(() => useProducts({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('Widget');
  });

  it('handles error', async () => {
    server.use(
      http.get('/api/products', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const { result } = renderHook(() => useProducts({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
```

---

## 13. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Server data in useState | Stale data, no caching, manual refetching | Use TanStack Query or SWR |
| Query key missing variables | Wrong cached data returned, stale results | Include ALL variables in query key |
| Not using query key factory | Inconsistent keys, invalidation misses | Create centralized query key factory |
| staleTime: 0 everywhere | Excessive refetching, API overload | Set appropriate staleTime per data type |
| No error handling | White screen on API failure | ALWAYS handle isError state |
| No loading state | Flash of empty content | ALWAYS handle isLoading state |
| Optimistic update without rollback | Failed mutation leaves stale cache | ALWAYS implement onError rollback |
| Polling with short interval | API overload, excessive re-renders | Use WebSocket for real-time, or 30s+ intervals |
| Not invalidating after mutation | Stale data shown after create/update/delete | invalidateQueries on mutation success |
| Manual cache updates without invalidation | Cache and server diverge | ALWAYS invalidate (even with optimistic updates) |
| useQuery inside event handlers | Hook rules violation | Use queryClient.fetchQuery for imperative fetching |
| Not prefetching predictable navigation | Slow transitions between pages | prefetchQuery on hover/link visibility |
| Infinite staleTime without invalidation | Data never refreshes | Pair with manual invalidation or set reasonable staleTime |

---

## 14. Enforcement Checklist

- [ ] ALL server data fetched via TanStack Query or SWR (not useState)
- [ ] Query keys include ALL variables that affect the result
- [ ] Query key factory used for consistency and invalidation
- [ ] staleTime configured appropriately per data type (not left at 0)
- [ ] gcTime configured (default 5 min usually sufficient)
- [ ] Loading states handled for EVERY query (isLoading → skeleton/spinner)
- [ ] Error states handled for EVERY query (isError → error UI with retry)
- [ ] Empty states handled (data.length === 0 → empty state UI)
- [ ] Mutations use useMutation with onSuccess invalidation
- [ ] Optimistic updates implemented where UX demands instant feedback
- [ ] Optimistic updates have proper rollback on error
- [ ] Prefetching implemented for predictable navigation (hover, link visibility)
- [ ] DevTools enabled in development (ReactQueryDevtools)
- [ ] SSR hydration configured for server-rendered pages
- [ ] WebSocket integration for real-time data (not excessive polling)
- [ ] Tests use test QueryClient (retry: false, gcTime: 0)
- [ ] API requests use proper error classes (not generic Error)
- [ ] Retry logic respects HTTP status codes (no retry on 4xx)
