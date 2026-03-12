# Web Platform APIs — Complete Specification

> **AI Plugin Directive:** When implementing offline functionality, background processing, real-time communication, client-side storage, or any browser-native capability, ALWAYS consult this guide. Apply these Web Platform API patterns to leverage native browser features instead of third-party libraries. This guide covers Service Workers, Web Workers, WebSockets, IndexedDB, and 20+ essential browser APIs.

**Core Rule: ALWAYS use native Web Platform APIs before reaching for third-party libraries. Service Workers enable offline-first architecture and background sync. Web Workers move computation off the main thread. IndexedDB provides structured client-side storage. NEVER block the main thread with heavy computation — delegate to workers. NEVER store sensitive data in localStorage — use appropriate storage APIs with encryption.**

---

## 1. Service Workers

```
                    SERVICE WORKER LIFECYCLE

  ┌─────────┐    ┌───────────┐    ┌───────────┐    ┌──────────┐
  │ Register │───▶│ Installing│───▶│  Waiting  │───▶│  Active  │
  └─────────┘    └───────────┘    └───────────┘    └──────────┘
       │              │                │                 │
       │         install event    Other SW active    fetch event
       │         Cache assets     skipWaiting()      Intercept requests
       │              │                │                 │
       │              ▼                ▼                 ▼
       │         ┌──────────┐    ┌──────────┐    ┌──────────────┐
       │         │ Pre-cache │    │ Takes    │    │ Cache-first  │
       │         │ App Shell │    │ Control  │    │ Network-first│
       │         └──────────┘    └──────────┘    │ Stale-WR     │
       │                                         └──────────────┘
       │
       └── MUST serve over HTTPS (or localhost for dev)
```

### 1.1 Registration Pattern

```typescript
// service-worker-registration.ts
// ALWAYS register after page load to avoid competing for bandwidth

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      type: 'module',            // Use ES modules in SW (Chrome 91+)
      updateViaCache: 'none',    // ALWAYS bypass HTTP cache for SW script
    });

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000); // Every hour

    // Handle update found
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
          // New version available — notify user
          showUpdateNotification();
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('SW registration failed:', error);
    return null;
  }
}

// ALWAYS register after load event
if (document.readyState === 'complete') {
  registerServiceWorker();
} else {
  window.addEventListener('load', registerServiceWorker);
}
```

### 1.2 Caching Strategies

```typescript
// sw.js — Service Worker implementation
const CACHE_VERSION = 'v2';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/scripts/app.js',
  '/offline.html',
];

// ─── Install: Pre-cache App Shell ───
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()) // Take control immediately
  );
});

// ─── Activate: Clean Old Caches ───
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => !key.includes(CACHE_VERSION))
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // Control all open tabs
  );
});

// ─── Fetch: Strategy Router ───
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls → Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Images → Cache First with fallback
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Static assets → Cache First
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Everything else → Stale While Revalidate
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});
```

### 1.3 Caching Strategy Implementations

```typescript
// ─── Cache First (Static Assets, Images) ───
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match('/offline.html') as Promise<Response>;
  }
}

// ─── Network First (API Calls) ───
async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── Stale While Revalidate (Pages, Non-critical) ───
async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise as Promise<Response>;
}
```

### 1.4 Caching Strategy Decision Matrix

| Strategy | Use Case | Freshness | Offline | Speed |
|----------|----------|-----------|---------|-------|
| Cache First | Static assets, fonts, images | Low | ✅ Full | ✅ Instant |
| Network First | API calls, dynamic data | ✅ High | ✅ Fallback | ❌ Depends on network |
| Stale While Revalidate | Pages, semi-dynamic | Medium | ✅ Stale | ✅ Instant (stale) |
| Network Only | Auth, payments, analytics | ✅ Real-time | ❌ None | ❌ Depends on network |
| Cache Only | App shell, pre-cached | ❌ Static | ✅ Full | ✅ Instant |

---

## 2. Web Workers

```
                    WORKER ARCHITECTURE

  ┌─────────────────────┐         ┌──────────────────────┐
  │    MAIN THREAD       │         │    WORKER THREAD      │
  │                      │         │                       │
  │  UI Rendering        │  post   │  Heavy Computation    │
  │  Event Handling      │ Message │  Data Processing      │
  │  DOM Manipulation    │────────▶│  Image Processing     │
  │                      │         │  Sorting/Filtering    │
  │  ┌────────────────┐  │◀────────│  Encryption          │
  │  │  onmessage()   │  │  post   │  CSV/JSON Parsing    │
  │  │  handler       │  │ Message │                       │
  │  └────────────────┘  │         │  NO DOM ACCESS        │
  │                      │         │  NO window object     │
  └─────────────────────┘         │  HAS: fetch, IndexedDB│
                                   └──────────────────────┘
```

### 2.1 Dedicated Workers

```typescript
// ─── Worker Creation and Communication ───

// main.ts
class WorkerPool {
  private workers: Worker[] = [];
  private queue: Array<{ data: unknown; resolve: (v: unknown) => void; reject: (e: Error) => void }> = [];
  private activeWorkers = 0;

  constructor(
    private workerUrl: string | URL,
    private poolSize: number = navigator.hardwareConcurrency || 4
  ) {
    for (let i = 0; i < poolSize; i++) {
      this.workers.push(new Worker(workerUrl, { type: 'module' }));
    }
  }

  async execute<T>(data: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.activeWorkers < this.poolSize) {
        this.runTask(data, resolve as (v: unknown) => void, reject);
      } else {
        this.queue.push({ data, resolve: resolve as (v: unknown) => void, reject });
      }
    });
  }

  private runTask(
    data: unknown,
    resolve: (v: unknown) => void,
    reject: (e: Error) => void
  ): void {
    const worker = this.workers[this.activeWorkers];
    this.activeWorkers++;

    const cleanup = () => {
      this.activeWorkers--;
      worker.onmessage = null;
      worker.onerror = null;

      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        this.runTask(next.data, next.resolve, next.reject);
      }
    };

    worker.onmessage = (event: MessageEvent) => {
      cleanup();
      resolve(event.data);
    };

    worker.onerror = (error: ErrorEvent) => {
      cleanup();
      reject(new Error(error.message));
    };

    worker.postMessage(data);
  }

  terminate(): void {
    this.workers.forEach(w => w.terminate());
    this.workers = [];
  }
}

// Usage
const pool = new WorkerPool(new URL('./heavy-task.worker.ts', import.meta.url));
const result = await pool.execute<ProcessedData>({ items: largeDataset });
```

### 2.2 Shared Workers

```typescript
// shared-worker.ts — Single instance shared across tabs
const connections: MessagePort[] = [];

self.addEventListener('connect', (event: MessageEvent) => {
  const port = event.ports[0];
  connections.push(port);

  port.addEventListener('message', (msg: MessageEvent) => {
    const { type, payload } = msg.data;

    switch (type) {
      case 'broadcast':
        // Send to ALL connected tabs
        connections.forEach(p => {
          if (p !== port) p.postMessage(payload);
        });
        break;

      case 'state-sync':
        // Synchronize state across tabs
        port.postMessage({ type: 'state', data: sharedState });
        break;
    }
  });

  port.start();
});

// main.ts — Connect from any tab
const sharedWorker = new SharedWorker('/shared-worker.js');
sharedWorker.port.start();
sharedWorker.port.addEventListener('message', (event) => {
  console.log('Message from shared worker:', event.data);
});
```

### 2.3 Worker Type Comparison

| Feature | Dedicated Worker | Shared Worker | Service Worker |
|---------|-----------------|---------------|----------------|
| Scope | Single page | Multiple pages | Entire origin |
| Lifecycle | Page lifecycle | Last connection | Independent |
| DOM Access | ❌ | ❌ | ❌ |
| fetch() | ✅ | ✅ | ✅ + intercept |
| IndexedDB | ✅ | ✅ | ✅ |
| Cache API | ✅ | ✅ | ✅ |
| Notifications | ❌ | ❌ | ✅ Push |
| Use Case | Heavy computation | Cross-tab state | Offline/caching |

---

## 3. WebSocket API

### 3.1 Robust WebSocket Client

```typescript
// websocket-client.ts

interface WSOptions {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  messageQueueSize?: number;
}

class RobustWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: string[] = [];
  private listeners = new Map<string, Set<(data: unknown) => void>>();

  constructor(private options: Required<WSOptions>) {}

  connect(): void {
    this.ws = new WebSocket(this.options.url, this.options.protocols);

    this.ws.addEventListener('open', () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.flushQueue();
    });

    this.ws.addEventListener('message', (event: MessageEvent) => {
      const message = JSON.parse(event.data);

      // Handle pong (heartbeat response)
      if (message.type === 'pong') return;

      // Dispatch to listeners
      const handlers = this.listeners.get(message.type);
      handlers?.forEach(handler => handler(message.data));
    });

    this.ws.addEventListener('close', (event: CloseEvent) => {
      this.stopHeartbeat();

      // 1000 = normal closure, 1001 = going away — do NOT reconnect
      if (!event.wasClean && this.options.reconnect) {
        this.scheduleReconnect();
      }
    });

    this.ws.addEventListener('error', () => {
      // Error always followed by close — handle reconnect in close handler
    });
  }

  send(type: string, data: unknown): void {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else if (this.messageQueue.length < this.options.messageQueueSize) {
      // Queue messages while disconnected
      this.messageQueue.push(message);
    }
  }

  on(type: string, handler: (data: unknown) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);

    // Return unsubscribe function
    return () => this.listeners.get(type)?.delete(handler);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) return;

    // Exponential backoff with jitter
    const delay = Math.min(
      this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts) +
        Math.random() * 1000,
      30000 // Max 30 seconds
    );

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(this.messageQueue.shift()!);
    }
  }

  disconnect(): void {
    this.options.reconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.ws?.close(1000, 'Client closing');
  }
}
```

### 3.2 Server-Sent Events (SSE) — One-Way Alternative

```typescript
// sse-client.ts — Use SSE when you only need server → client

class SSEClient {
  private source: EventSource | null = null;

  connect(url: string, options?: { withCredentials: boolean }): void {
    this.source = new EventSource(url, options);

    // Default message event
    this.source.addEventListener('message', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    });

    // Custom named events
    this.source.addEventListener('notification', (event: MessageEvent) => {
      const notification = JSON.parse(event.data);
      showNotification(notification);
    });

    // Auto-reconnects on error (built-in)
    this.source.addEventListener('error', () => {
      if (this.source?.readyState === EventSource.CLOSED) {
        console.log('SSE connection closed permanently');
      }
      // CONNECTING state = auto-reconnecting (EventSource handles this)
    });
  }

  disconnect(): void {
    this.source?.close();
  }
}

// DECISION: WebSocket vs SSE
// WebSocket: Bidirectional, binary data, custom protocols, gaming/chat
// SSE: Server-push only, auto-reconnect, simpler, text/event-stream
// SSE: Use for notifications, live feeds, progress updates
```

---

## 4. IndexedDB

```
                    INDEXEDDB ARCHITECTURE

  ┌──────────────────────────────────────────────────┐
  │                   Origin (domain)                 │
  │                                                   │
  │  ┌─────────────┐  ┌─────────────┐                │
  │  │  Database 1  │  │  Database 2  │  ...           │
  │  │              │  │              │                │
  │  │ ┌─────────┐  │  │ ┌─────────┐  │                │
  │  │ │ Store A  │  │  │ │ Store X  │  │                │
  │  │ │ ┌──────┐ │  │  │ │         │  │                │
  │  │ │ │Index1│ │  │  │ └─────────┘  │                │
  │  │ │ │Index2│ │  │  │              │                │
  │  │ │ └──────┘ │  │  │ ┌─────────┐  │                │
  │  │ └─────────┘  │  │ │ Store Y  │  │                │
  │  │              │  │ │         │  │                │
  │  │ ┌─────────┐  │  │ └─────────┘  │                │
  │  │ │ Store B  │  │  │              │                │
  │  │ └─────────┘  │  └─────────────┘                │
  │  └─────────────┘                                  │
  │                                                   │
  │  Storage: 50%+ of disk (origin-based quota)       │
  │  Transactions: ACID compliant                     │
  │  Access: Same-origin only                         │
  └──────────────────────────────────────────────────┘
```

### 4.1 Modern IndexedDB Wrapper

```typescript
// indexed-db.ts — Type-safe IndexedDB wrapper
// ALWAYS wrap raw IndexedDB API — it's callback-based and error-prone

interface DBSchema {
  users: {
    key: string;
    value: { id: string; name: string; email: string; createdAt: number };
    indexes: { 'by-email': string; 'by-created': number };
  };
  products: {
    key: number;
    value: { id: number; name: string; price: number; category: string };
    indexes: { 'by-category': string; 'by-price': number };
  };
}

class TypedDB {
  private db: IDBDatabase | null = null;

  async open(name: string, version: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores with indexes
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'id' });
          userStore.createIndex('by-email', 'email', { unique: true });
          userStore.createIndex('by-created', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', {
            keyPath: 'id',
            autoIncrement: true,
          });
          productStore.createIndex('by-category', 'category', { unique: false });
          productStore.createIndex('by-price', 'price', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;

        // Handle version change (another tab opened newer version)
        this.db.onversionchange = () => {
          this.db?.close();
          window.location.reload();
        };

        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async put<K extends keyof DBSchema>(
    storeName: K,
    value: DBSchema[K]['value']
  ): Promise<DBSchema[K]['key']> {
    return this.transaction(storeName, 'readwrite', store =>
      store.put(value)
    );
  }

  async get<K extends keyof DBSchema>(
    storeName: K,
    key: DBSchema[K]['key']
  ): Promise<DBSchema[K]['value'] | undefined> {
    return this.transaction(storeName, 'readonly', store =>
      store.get(key)
    );
  }

  async getAll<K extends keyof DBSchema>(
    storeName: K
  ): Promise<DBSchema[K]['value'][]> {
    return this.transaction(storeName, 'readonly', store =>
      store.getAll()
    );
  }

  async getByIndex<K extends keyof DBSchema>(
    storeName: K,
    indexName: string,
    value: IDBValidKey
  ): Promise<DBSchema[K]['value'][]> {
    return this.transaction(storeName, 'readonly', store => {
      const index = store.index(indexName);
      return index.getAll(value);
    });
  }

  async delete<K extends keyof DBSchema>(
    storeName: K,
    key: DBSchema[K]['key']
  ): Promise<void> {
    return this.transaction(storeName, 'readwrite', store =>
      store.delete(key as IDBValidKey)
    );
  }

  async clear<K extends keyof DBSchema>(storeName: K): Promise<void> {
    return this.transaction(storeName, 'readwrite', store =>
      store.clear()
    );
  }

  // Cursor-based pagination
  async paginate<K extends keyof DBSchema>(
    storeName: K,
    options: { offset: number; limit: number; direction?: IDBCursorDirection }
  ): Promise<DBSchema[K]['value'][]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName as string, 'readonly');
      const store = tx.objectStore(storeName as string);
      const request = store.openCursor(null, options.direction || 'next');
      const results: DBSchema[K]['value'][] = [];
      let skipped = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || results.length >= options.limit) {
          resolve(results);
          return;
        }

        if (skipped < options.offset) {
          skipped++;
          cursor.continue();
          return;
        }

        results.push(cursor.value);
        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  }

  private transaction<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }
}

// Usage
const db = new TypedDB();
await db.open('myApp', 1);
await db.put('users', { id: '1', name: 'Alice', email: 'alice@example.com', createdAt: Date.now() });
const user = await db.get('users', '1');
const recentUsers = await db.paginate('users', { offset: 0, limit: 20 });
```

---

## 5. Storage APIs Comparison

| API | Capacity | Persistence | Sync/Async | Use Case |
|-----|----------|-------------|------------|----------|
| `localStorage` | ~5-10 MB | Session+ | Sync (blocks!) | Simple key-value, preferences |
| `sessionStorage` | ~5-10 MB | Tab only | Sync (blocks!) | Tab-specific temp data |
| `IndexedDB` | 50%+ disk | Persistent | Async | Structured data, large datasets |
| `Cache API` | 50%+ disk | Persistent | Async | HTTP responses, assets |
| `Cookies` | ~4 KB | Configurable | Sync | Auth tokens, server-readable |
| `OPFS` | 50%+ disk | Persistent | Async | File system access, large files |

### 5.1 Storage Persistence

```typescript
// Request persistent storage — prevents browser from evicting data
async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;

  const isPersisted = await navigator.storage.persisted();
  if (isPersisted) return true;

  // Browser may grant automatically based on:
  // - Site is bookmarked
  // - Site has push notification permission
  // - High engagement score
  return navigator.storage.persist();
}

// Check storage quota
async function checkStorageQuota(): Promise<{ usage: number; quota: number; percent: string }> {
  const estimate = await navigator.storage.estimate();
  return {
    usage: estimate.usage || 0,
    quota: estimate.quota || 0,
    percent: ((estimate.usage || 0) / (estimate.quota || 1) * 100).toFixed(2) + '%',
  };
}
```

### 5.2 When to Use Each Storage API

```
  Need to store data?
       │
       ├── Server needs to read it? ──────▶ Cookie (HttpOnly, Secure, SameSite)
       │
       ├── > 5MB of structured data? ─────▶ IndexedDB
       │
       ├── HTTP response caching? ────────▶ Cache API (Service Worker)
       │
       ├── File system operations? ───────▶ OPFS (Origin Private File System)
       │
       ├── Tab-scoped temp data? ─────────▶ sessionStorage
       │
       └── Small key-value pairs? ────────▶ localStorage (ONLY non-sensitive)
               │
               └── NEVER store tokens, passwords, PII in localStorage
```

---

## 6. Intersection Observer

```typescript
// Lazy loading, infinite scroll, analytics visibility tracking

// ─── Lazy Loading Images ───
function lazyLoadImages(): void {
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const img = entry.target as HTMLImageElement;
        img.src = img.dataset.src!;
        img.srcset = img.dataset.srcset || '';
        img.classList.remove('lazy');
        obs.unobserve(img);
      });
    },
    {
      rootMargin: '200px 0px',  // Start loading 200px before visible
      threshold: 0,
    }
  );

  document.querySelectorAll('img.lazy').forEach(img => observer.observe(img));
}

// ─── Infinite Scroll ───
function infiniteScroll(
  sentinel: HTMLElement,
  loadMore: () => Promise<void>
): () => void {
  let loading = false;

  const observer = new IntersectionObserver(
    async ([entry]) => {
      if (!entry.isIntersecting || loading) return;
      loading = true;
      await loadMore();
      loading = false;
    },
    { rootMargin: '400px' }
  );

  observer.observe(sentinel);
  return () => observer.disconnect();
}

// ─── Viewport Tracking (Analytics) ───
function trackVisibility(
  elements: HTMLElement[],
  onVisible: (element: HTMLElement, visibleTime: number) => void
): () => void {
  const startTimes = new Map<HTMLElement, number>();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          startTimes.set(el, Date.now());
        } else if (startTimes.has(el)) {
          const visibleTime = Date.now() - startTimes.get(el)!;
          if (visibleTime > 1000) { // Only track >1s visibility
            onVisible(el, visibleTime);
          }
          startTimes.delete(el);
        }
      });
    },
    { threshold: 0.5 } // 50% visible
  );

  elements.forEach(el => observer.observe(el));
  return () => observer.disconnect();
}
```

---

## 7. Resize Observer

```typescript
// Respond to element size changes (NOT window resize)
// ALWAYS prefer ResizeObserver over window.addEventListener('resize')

function observeElementSize(
  element: HTMLElement,
  callback: (entry: ResizeObserverEntry) => void
): () => void {
  const observer = new ResizeObserver((entries) => {
    // ALWAYS use requestAnimationFrame to avoid ResizeObserver loop errors
    requestAnimationFrame(() => {
      for (const entry of entries) {
        callback(entry);
      }
    });
  });

  observer.observe(element, { box: 'border-box' });
  return () => observer.disconnect();
}

// Usage: Responsive component without CSS media queries
const cleanup = observeElementSize(containerRef, (entry) => {
  const { inlineSize: width } = entry.contentBoxSize[0];

  if (width < 400) {
    entry.target.classList.add('compact');
    entry.target.classList.remove('wide');
  } else {
    entry.target.classList.add('wide');
    entry.target.classList.remove('compact');
  }
});
```

---

## 8. Mutation Observer

```typescript
// Monitor DOM changes — NEVER poll for DOM changes, use MutationObserver

function observeDOMChanges(
  target: HTMLElement,
  callback: (mutations: MutationRecord[]) => void,
  options?: MutationObserverInit
): () => void {
  const observer = new MutationObserver((mutations) => {
    callback(mutations);
  });

  observer.observe(target, {
    childList: true,         // Added/removed child nodes
    attributes: true,        // Attribute changes
    characterData: true,     // Text content changes
    subtree: true,           // Monitor entire subtree
    attributeFilter: ['class', 'data-state'], // Only specific attributes
    ...options,
  });

  return () => observer.disconnect();
}

// Use case: Auto-detect dynamically injected third-party scripts
const cleanup = observeDOMChanges(document.head, (mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLScriptElement && !node.dataset.trusted) {
        console.warn('Untrusted script injected:', node.src);
        node.remove();
      }
    }
  }
});
```

---

## 9. Web Animations API

```typescript
// PREFER Web Animations API over CSS transitions for programmatic control
// PREFER CSS transitions/animations for simple, declarative animations

function animateElement(
  element: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions
): Animation {
  const animation = element.animate(keyframes, {
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)', // Material Design easing
    fill: 'forwards',
    ...options,
  });

  return animation;
}

// ─── Scroll-Linked Animations (Chrome 115+) ───
function scrollLinkedAnimation(element: HTMLElement): void {
  element.animate(
    [
      { opacity: 0, transform: 'translateY(50px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    {
      timeline: new ViewTimeline({ subject: element }),
      rangeStart: 'entry 0%',
      rangeEnd: 'entry 100%',
      fill: 'both',
    }
  );
}

// ─── View Transitions API (Chrome 111+) ───
async function navigateWithTransition(updateDOM: () => Promise<void>): Promise<void> {
  if (!document.startViewTransition) {
    await updateDOM();
    return;
  }

  const transition = document.startViewTransition(async () => {
    await updateDOM();
  });

  await transition.finished;
}
```

---

## 10. Broadcast Channel API

```typescript
// Cross-tab communication — simpler alternative to SharedWorker

const channel = new BroadcastChannel('app-events');

// ─── Send Events ───
function broadcastEvent(type: string, data: unknown): void {
  channel.postMessage({ type, data, tabId: getTabId() });
}

// ─── Receive Events ───
channel.addEventListener('message', (event: MessageEvent) => {
  const { type, data, tabId } = event.data;

  switch (type) {
    case 'auth:logout':
      // Another tab logged out — redirect to login
      window.location.href = '/login';
      break;

    case 'theme:change':
      // Another tab changed theme — sync
      document.documentElement.dataset.theme = data.theme;
      break;

    case 'data:updated':
      // Another tab modified data — invalidate cache
      queryClient.invalidateQueries({ queryKey: [data.entity] });
      break;
  }
});

// ALWAYS close when done
window.addEventListener('beforeunload', () => channel.close());
```

---

## 11. Clipboard API

```typescript
// Modern async Clipboard API — ALWAYS prefer over deprecated document.execCommand
// REQUIRES user gesture (click/keypress) and Secure Context (HTTPS)

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers or permission denied
    return fallbackCopy(text);
  }
}

async function copyRichContent(html: string, plainText: string): Promise<void> {
  const htmlBlob = new Blob([html], { type: 'text/html' });
  const textBlob = new Blob([plainText], { type: 'text/plain' });

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': htmlBlob,
      'text/plain': textBlob,
    }),
  ]);
}

async function readFromClipboard(): Promise<string> {
  // REQUIRES clipboard-read permission
  return navigator.clipboard.readText();
}

function fallbackCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const success = document.execCommand('copy');
  document.body.removeChild(textarea);
  return success;
}
```

---

## 12. Permissions API

```typescript
// Query permission state WITHOUT triggering the permission prompt

async function checkPermission(
  name: PermissionName
): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    const result = await navigator.permissions.query({ name });

    // Listen for permission changes
    result.addEventListener('change', () => {
      console.log(`Permission ${name} changed to: ${result.state}`);
    });

    return result.state;
  } catch {
    return 'prompt'; // Unsupported permission name
  }
}

// Usage — adapt UI based on permission state
async function setupNotifications(): Promise<void> {
  const state = await checkPermission('notifications');

  switch (state) {
    case 'granted':
      initializePushNotifications();
      break;
    case 'denied':
      showInAppNotificationsFallback();
      break;
    case 'prompt':
      showNotificationExplainer(); // Explain why, THEN request
      break;
  }
}
```

---

## 13. Performance Observer API

```typescript
// Monitor performance metrics in production

// ─── Long Tasks (>50ms main thread blocks) ───
const longTaskObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 100) {
      reportToAnalytics('long-task', {
        duration: entry.duration,
        startTime: entry.startTime,
        name: entry.name,
      });
    }
  }
});
longTaskObserver.observe({ type: 'longtask', buffered: true });

// ─── Resource Loading Performance ───
const resourceObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
    if (entry.duration > 2000) {
      console.warn(`Slow resource: ${entry.name} (${entry.duration}ms)`);
    }
  }
});
resourceObserver.observe({ type: 'resource', buffered: true });

// ─── Layout Shift Detection ───
let clsValue = 0;
const clsObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries() as PerformanceEntry[]) {
    if (!(entry as any).hadRecentInput) {
      clsValue += (entry as any).value;
    }
  }
});
clsObserver.observe({ type: 'layout-shift', buffered: true });

// ─── Element Timing (LCP candidates) ───
const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  reportToAnalytics('lcp', {
    value: lastEntry.startTime,
    element: (lastEntry as any).element?.tagName,
    url: (lastEntry as any).url,
  });
});
lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
```

---

## 14. Notification API & Push API

```typescript
// ─── Request Permission (ALWAYS explain first, NEVER request on page load) ───
async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';

  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  return Notification.requestPermission();
}

// ─── Show Local Notification ───
function showNotification(title: string, options?: NotificationOptions): void {
  if (Notification.permission !== 'granted') return;

  const notification = new Notification(title, {
    body: options?.body,
    icon: '/icons/notification-icon.png',
    badge: '/icons/badge.png',
    tag: options?.tag || 'default',      // Replace existing with same tag
    renotify: true,
    requireInteraction: false,           // Auto-dismiss
    silent: false,
    ...options,
  });

  notification.addEventListener('click', () => {
    window.focus();
    notification.close();
  });
}

// ─── Push Subscription (Service Worker) ───
async function subscribeToPush(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string
): Promise<PushSubscription | null> {
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,  // REQUIRED — must show notification for each push
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    // Send subscription to your server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    });

    return subscription;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return null;
  }
}
```

---

## 15. Geolocation API

```typescript
// ALWAYS check permission first, NEVER request on page load

async function getCurrentPosition(
  options?: PositionOptions
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,  // Set true only when needed (drains battery)
      timeout: 10000,
      maximumAge: 300000,         // Accept cached position up to 5 min old
      ...options,
    });
  });
}

function watchPosition(
  callback: (position: GeolocationPosition) => void,
  errorCallback?: (error: GeolocationPositionError) => void
): () => void {
  const watchId = navigator.geolocation.watchPosition(
    callback,
    errorCallback || console.error,
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}
```

---

## 16. AbortController — Request Cancellation

```typescript
// ALWAYS use AbortController for cancellable operations

// ─── Cancel Fetch Requests ───
function createCancellableFetch(url: string, options?: RequestInit) {
  const controller = new AbortController();

  const promise = fetch(url, {
    ...options,
    signal: controller.signal,
  });

  return {
    promise,
    cancel: () => controller.abort(),
  };
}

// ─── Timeout Pattern ───
async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 5000,
  options?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.any([
        controller.signal,
        ...(options?.signal ? [options.signal] : []),
      ]),
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Race Multiple Requests ───
async function fetchFastest<T>(urls: string[]): Promise<T> {
  const controller = new AbortController();

  try {
    const result = await Promise.any(
      urls.map(async url => {
        const response = await fetch(url, { signal: controller.signal });
        return response.json() as Promise<T>;
      })
    );
    controller.abort(); // Cancel remaining requests
    return result;
  } catch {
    throw new Error('All requests failed');
  }
}

// ─── AbortSignal.timeout() — Modern API ───
const response = await fetch('/api/data', {
  signal: AbortSignal.timeout(5000), // Auto-abort after 5s
});
```

---

## 17. Structured Clone & Transferable Objects

```typescript
// ─── structuredClone() — Deep clone without JSON limitations ───
const original = {
  date: new Date(),
  regex: /pattern/gi,
  map: new Map([['key', 'value']]),
  set: new Set([1, 2, 3]),
  buffer: new ArrayBuffer(8),
  nested: { deep: { object: true } },
};

// structuredClone handles Date, RegExp, Map, Set, ArrayBuffer, etc.
const cloned = structuredClone(original);
// JSON.parse(JSON.stringify()) would LOSE Date, RegExp, Map, Set types

// ─── Transferable Objects — Zero-copy to Workers ───
const buffer = new ArrayBuffer(1024 * 1024); // 1MB

// Transfer ownership — buffer becomes unusable in main thread
worker.postMessage({ buffer }, [buffer]);
// buffer.byteLength === 0 after transfer (zero-copy, no serialization)

// Use transfer with structuredClone
const result = structuredClone(
  { data: buffer },
  { transfer: [buffer] }
);
```

---

## 18. Media APIs

```typescript
// ─── MediaRecorder — Audio/Video Recording ───
async function startRecording(): Promise<{
  stop: () => Promise<Blob>;
  pause: () => void;
  resume: () => void;
}> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: { width: 1280, height: 720 },
  });

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9,opus',
  });

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  recorder.start(1000); // Capture in 1s intervals

  return {
    stop: () => new Promise(resolve => {
      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach(track => track.stop());
        resolve(new Blob(chunks, { type: 'video/webm' }));
      });
      recorder.stop();
    }),
    pause: () => recorder.pause(),
    resume: () => recorder.resume(),
  };
}

// ─── Screen Capture API ───
async function captureScreen(): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'monitor' },
    audio: true,
  });
}
```

---

## 19. File System Access API

```typescript
// Origin Private File System (OPFS) — available in all modern browsers
// Regular File System Access API — requires user gesture (picker dialog)

// ─── OPFS for App Data ───
async function writeToOPFS(filename: string, data: string): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

async function readFromOPFS(filename: string): Promise<string> {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(filename);
  const file = await fileHandle.getFile();
  return file.text();
}

// ─── File Picker (User-Initiated) ───
async function openFile(
  accept?: Record<string, string[]>
): Promise<{ name: string; content: string }> {
  const [fileHandle] = await window.showOpenFilePicker({
    types: Object.entries(accept || {}).map(([desc, extensions]) => ({
      description: desc,
      accept: { 'application/octet-stream': extensions },
    })),
    multiple: false,
  });

  const file = await fileHandle.getFile();
  return { name: file.name, content: await file.text() };
}

// ─── Save File Picker ───
async function saveFile(content: string, suggestedName: string): Promise<void> {
  const fileHandle = await window.showSaveFilePicker({
    suggestedName,
    types: [{
      description: 'Text files',
      accept: { 'text/plain': ['.txt', '.md'] },
    }],
  });

  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}
```

---

## 20. Credential Management & Web Authentication

```typescript
// ─── Password Credential API ───
async function saveCredential(
  id: string,
  password: string,
  name?: string
): Promise<void> {
  if (!window.PasswordCredential) return;

  const credential = new PasswordCredential({
    id,
    password,
    name: name || id,
  });

  await navigator.credentials.store(credential);
}

async function getStoredCredential(): Promise<PasswordCredential | null> {
  const credential = await navigator.credentials.get({
    password: true,
    mediation: 'optional', // 'silent' | 'optional' | 'required'
  });

  return credential as PasswordCredential | null;
}

// ─── WebAuthn / Passkeys ───
async function registerPasskey(
  userId: string,
  userName: string,
  challenge: ArrayBuffer
): Promise<PublicKeyCredential> {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'My App', id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId),
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Built-in (Touch ID, Windows Hello)
        residentKey: 'required',             // Discoverable credential (passkey)
        userVerification: 'required',
      },
      timeout: 60000,
      attestation: 'none',
    },
  });

  return credential as PublicKeyCredential;
}
```

---

## 21. Navigator APIs

```typescript
// ─── Network Information ───
function getNetworkInfo(): {
  online: boolean;
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
} {
  const connection = (navigator as any).connection;

  return {
    online: navigator.onLine,
    effectiveType: connection?.effectiveType,  // '4g', '3g', '2g', 'slow-2g'
    downlink: connection?.downlink,             // Mbps
    saveData: connection?.saveData,             // User requested reduced data
  };
}

// ─── Adaptive Loading Based on Network ───
function adaptToNetwork(): void {
  const { effectiveType, saveData } = getNetworkInfo();

  if (saveData || effectiveType === '2g' || effectiveType === 'slow-2g') {
    // Load low-res images, disable animations, reduce data fetching
    document.documentElement.classList.add('reduced-data');
  }
}

// ─── Online/Offline Detection ───
window.addEventListener('online', () => {
  syncPendingChanges();
  showToast('Back online — syncing changes');
});

window.addEventListener('offline', () => {
  showToast('Offline — changes will sync when reconnected');
});

// ─── Share API ───
async function shareContent(data: ShareData): Promise<boolean> {
  if (!navigator.canShare?.(data)) return false;

  try {
    await navigator.share(data);
    return true;
  } catch (error) {
    if ((error as DOMException).name === 'AbortError') return false; // User cancelled
    throw error;
  }
}

// ─── Vibration API (Mobile) ───
function hapticFeedback(pattern: 'light' | 'medium' | 'heavy'): void {
  const patterns: Record<string, number[]> = {
    light: [10],
    medium: [30],
    heavy: [50, 30, 50],
  };
  navigator.vibrate?.(patterns[pattern]);
}
```

---

## 22. Scheduling APIs

```typescript
// ─── scheduler.postTask() — Priority-based scheduling ───
// Priority levels: 'user-blocking' > 'user-visible' > 'background'

async function scheduleWork(): Promise<void> {
  // High priority — user-blocking interactions
  await scheduler.postTask(
    () => validateForm(),
    { priority: 'user-blocking' }
  );

  // Default priority — visible updates
  await scheduler.postTask(
    () => updateDashboard(),
    { priority: 'user-visible' }
  );

  // Low priority — background work
  scheduler.postTask(
    () => prefetchNextPage(),
    { priority: 'background' }
  );
}

// ─── scheduler.yield() — Yield to main thread ───
async function processLargeList(items: unknown[]): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    processItem(items[i]);

    // Yield every 5 items to keep UI responsive
    if (i % 5 === 0) {
      await scheduler.yield();
    }
  }
}

// ─── requestIdleCallback — Do work when browser is idle ───
function doIdleWork(tasks: Array<() => void>): void {
  const taskQueue = [...tasks];

  function processQueue(deadline: IdleDeadline): void {
    while (taskQueue.length > 0 && deadline.timeRemaining() > 5) {
      const task = taskQueue.shift()!;
      task();
    }

    if (taskQueue.length > 0) {
      requestIdleCallback(processQueue);
    }
  }

  requestIdleCallback(processQueue, { timeout: 5000 });
}
```

---

## 23. API Browser Support Decision Matrix

| API | Chrome | Firefox | Safari | Edge | Polyfill Available |
|-----|--------|---------|--------|------|--------------------|
| Service Worker | ✅ 40+ | ✅ 44+ | ✅ 11.1+ | ✅ 17+ | ❌ |
| Web Workers | ✅ 4+ | ✅ 3.5+ | ✅ 4+ | ✅ 12+ | ❌ |
| IndexedDB | ✅ 24+ | ✅ 16+ | ✅ 10+ | ✅ 12+ | ❌ |
| WebSocket | ✅ 16+ | ✅ 11+ | ✅ 6+ | ✅ 12+ | ❌ |
| IntersectionObserver | ✅ 58+ | ✅ 55+ | ✅ 12.1+ | ✅ 16+ | ✅ |
| ResizeObserver | ✅ 64+ | ✅ 69+ | ✅ 13.1+ | ✅ 79+ | ✅ |
| BroadcastChannel | ✅ 54+ | ✅ 38+ | ✅ 15.4+ | ✅ 79+ | ✅ |
| View Transitions | ✅ 111+ | 🔜 | 🔜 | ✅ 111+ | ❌ |
| Scroll Timeline | ✅ 115+ | ✅ 110+ | 🔜 | ✅ 115+ | ❌ |
| OPFS | ✅ 86+ | ✅ 111+ | ✅ 15.2+ | ✅ 86+ | ❌ |
| WebAuthn/Passkeys | ✅ 67+ | ✅ 60+ | ✅ 14+ | ✅ 18+ | ❌ |
| scheduler.postTask | ✅ 94+ | ❌ | ❌ | ✅ 94+ | ✅ |
| structuredClone | ✅ 98+ | ✅ 94+ | ✅ 15.4+ | ✅ 98+ | ✅ |

---

## 24. Feature Detection Pattern

```typescript
// ALWAYS use feature detection — NEVER use user-agent sniffing

function detectFeatures(): Record<string, boolean> {
  return {
    serviceWorker: 'serviceWorker' in navigator,
    webWorker: typeof Worker !== 'undefined',
    sharedWorker: typeof SharedWorker !== 'undefined',
    indexedDB: 'indexedDB' in window,
    webSocket: 'WebSocket' in window,
    intersectionObserver: 'IntersectionObserver' in window,
    resizeObserver: 'ResizeObserver' in window,
    mutationObserver: 'MutationObserver' in window,
    broadcastChannel: 'BroadcastChannel' in window,
    clipboard: 'clipboard' in navigator,
    share: 'share' in navigator,
    permissions: 'permissions' in navigator,
    geolocation: 'geolocation' in navigator,
    notifications: 'Notification' in window,
    pushManager: 'PushManager' in window,
    mediaRecorder: 'MediaRecorder' in window,
    viewTransition: 'startViewTransition' in document,
    scheduler: 'scheduler' in window,
    structuredClone: 'structuredClone' in window,
    opfs: 'storage' in navigator && 'getDirectory' in navigator.storage,
    containerQueries: CSS.supports('container-type', 'inline-size'),
  };
}

// Progressive enhancement helper
function withFeature<T>(
  featureCheck: () => boolean,
  enhanced: () => T,
  fallback: () => T
): T {
  return featureCheck() ? enhanced() : fallback();
}

// Usage
withFeature(
  () => 'IntersectionObserver' in window,
  () => lazyLoadWithObserver(),
  () => lazyLoadWithScroll()
);
```

---

## 25. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| User-agent sniffing for features | Breaks on new browsers, false negatives | ALWAYS use feature detection (`'feature' in object`) |
| `localStorage` for auth tokens | XSS can steal tokens | Use `HttpOnly` cookies or in-memory storage |
| Polling for DOM changes | Wasted CPU, battery drain | Use `MutationObserver` |
| `window.onresize` for element sizing | Doesn't detect container size changes | Use `ResizeObserver` |
| Manual scroll position tracking | Jank, wasted main thread time | Use `IntersectionObserver` |
| Synchronous XHR | Blocks main thread | Use `fetch()` with `async/await` |
| No AbortController on fetch | Memory leaks, race conditions | ALWAYS pass `AbortSignal` to cancellable requests |
| Heavy computation on main thread | UI freezes, poor INP | Move to Web Worker or use `scheduler.yield()` |
| Requesting permissions on page load | Low grant rate, user distrust | Explain first, request on user action |
| `JSON.parse(JSON.stringify())` for deep clone | Loses Date, RegExp, Map, Set, functions | Use `structuredClone()` |
| No cache versioning in Service Worker | Stale assets served forever | Use cache versioning and cleanup in activate |
| `skipWaiting()` without user notification | Silent updates break in-progress work | Notify user of new version, let them choose |
| Storing sensitive data in `localStorage` | Accessible via XSS, no encryption, no expiry | Use IndexedDB with encryption or server sessions |
| Not handling offline state | Broken UI when network drops | Listen to `online`/`offline` events, queue actions |

---

## 26. Enforcement Checklist

- [ ] Feature detection is used for ALL browser API checks (no user-agent sniffing)
- [ ] Service Worker registered after page `load` event (not during initial parse)
- [ ] Service Worker uses proper cache versioning with old cache cleanup in `activate`
- [ ] Caching strategy matches content type (cache-first for static, network-first for API)
- [ ] Heavy computation runs in Web Workers, not on main thread
- [ ] Worker pool implemented for parallel computation tasks
- [ ] WebSocket has exponential backoff reconnection with jitter
- [ ] WebSocket has heartbeat/ping-pong mechanism
- [ ] IndexedDB wrapped in Promise-based API (not raw callbacks)
- [ ] IndexedDB handles `versionchange` events (another tab upgrading)
- [ ] `localStorage` NEVER stores tokens, passwords, or PII
- [ ] `AbortController` used for ALL cancellable fetch requests
- [ ] Fetch requests have timeout handling (`AbortSignal.timeout()`)
- [ ] `IntersectionObserver` used for lazy loading (not scroll events)
- [ ] `ResizeObserver` used for element size changes (not window resize)
- [ ] `MutationObserver` used for DOM monitoring (not polling)
- [ ] Permission requests explained to user BEFORE triggering browser prompt
- [ ] Notification permission NEVER requested on page load
- [ ] Push subscriptions stored server-side with proper VAPID configuration
- [ ] `structuredClone()` used instead of `JSON.parse(JSON.stringify())`
- [ ] Transferable objects used for large data to Workers (zero-copy)
- [ ] Network Information API used for adaptive loading strategies
- [ ] Offline state handled gracefully with queued sync
- [ ] `BroadcastChannel` used for cross-tab communication (closed on unload)
- [ ] Storage persistence requested for critical app data
- [ ] Storage quota monitored and handled when approaching limits
