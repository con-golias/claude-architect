# Web Platform APIs — Complete Implementation Specification

> **AI Plugin Directive:** When a developer asks "how do I implement a Service Worker?", "what caching strategy should I use?", "how do I use Web Workers for heavy computation?", "WebSocket reconnection pattern?", "Server-Sent Events vs WebSocket?", "IndexedDB with Dexie?", "how do I use Intersection Observer?", "Broadcast Channel for cross-tab sync?", "Web Locks API?", "File System Access API?", "View Transitions API?", "how to use MutationObserver?", "Resize Observer patterns?", "SharedWorker communication?", "Comlink with Web Workers?", or "Navigation API?", use this directive. These APIs are the building blocks of modern web applications. You MUST understand their lifecycle, error handling, and browser support before recommending them. NEVER suggest a polyfill-free API without checking compatibility. ALWAYS provide TypeScript types and error boundaries.

---

## 1. Service Workers — Lifecycle and Caching Strategies

### Lifecycle Diagram

```
 SERVICE WORKER LIFECYCLE:
 ┌──────────────────────────────────────────────────────────────────┐
 │                                                                  │
 │  ┌──────────┐    ┌───────────┐    ┌───────────┐    ┌─────────┐ │
 │  │ Register │───>│ Installing│───>│  Waiting  │───>│ Active  │ │
 │  │          │    │           │    │           │    │         │ │
 │  └──────────┘    └─────┬─────┘    └─────┬─────┘    └────┬────┘ │
 │                        │                │               │      │
 │                 install event    No other SW active  fetch/push │
 │                 (precache)      OR skipWaiting()    sync events │
 │                        │                │               │      │
 │                  If install fails:      │          ┌────┴────┐ │
 │                  → Discarded            │          │Redundant│ │
 │                                         │          │(replaced)│ │
 │                                         │          └─────────┘ │
 │                                                                  │
 │  UPDATE FLOW:                                                    │
 │  Browser fetches SW file → byte-diff with current →              │
 │  if different → install new SW → new SW enters "waiting" →       │
 │  old SW still controls pages → when all tabs close OR            │
 │  skipWaiting() called → new SW activates                         │
 └──────────────────────────────────────────────────────────────────┘
```

### Registration — Production Pattern

```typescript
// === MUST: Register Service Worker with update detection ===

// src/lib/service-worker-registration.ts
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      // MUST: Use 'module' type for ES module service workers (Chrome 91+)
      // type: 'module',
    });

    // MUST: Check for updates periodically in long-lived SPAs
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000); // Check hourly

    // MUST: Detect when a new SW is waiting
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          // New SW installed but old one still active
          // MUST: Notify user, NEVER auto-refresh without consent
          showUpdateNotification(() => {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          });
        }
      });
    });

    // MUST: Reload when new SW takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    return registration;
  } catch (error) {
    console.error('SW registration failed:', error);
    return null;
  }
}
```

### Caching Strategies — Complete Implementation

```
 CACHING STRATEGY DECISION TREE:
 ┌──────────────────────────────────────────────────────────────────┐
 │                                                                  │
 │  Is the resource critical for first paint?                       │
 │  ├── YES → PRECACHE during install event                        │
 │  └── NO  → Runtime cache with one of:                           │
 │            │                                                     │
 │            ├── Changes rarely? (fonts, logos, vendor JS)         │
 │            │   └── CACHE-FIRST (serve cache, fall back to net)  │
 │            │                                                     │
 │            ├── Must be fresh? (API data, user-specific)          │
 │            │   └── NETWORK-FIRST (try net, fall back to cache)  │
 │            │                                                     │
 │            ├── Freshness nice but speed critical? (articles)     │
 │            │   └── STALE-WHILE-REVALIDATE (serve cache, update) │
 │            │                                                     │
 │            └── Always needs network? (auth, payments)            │
 │                └── NETWORK-ONLY (never cache)                    │
 │                                                                  │
 └──────────────────────────────────────────────────────────────────┘
```

```typescript
// === sw.ts — Complete Service Worker with all strategies ===

const CACHE_NAME = 'app-v1';
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/css/critical.css',
  '/js/app.js',
  '/images/logo.svg',
];

// --- Install: Precache critical resources ---
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// --- Activate: Clean old caches ---
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  // MUST: Take control of all clients immediately
  (self as any).clients.claim();
});

// --- Skip Waiting message handler ---
self.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    (self as any).skipWaiting();
  }
});

// --- Fetch: Route to correct strategy ---
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // MUST: Only handle same-origin and whitelisted CDN requests
  if (url.origin !== location.origin && !url.hostname.endsWith('cdn.example.com')) {
    return;
  }

  // NEVER cache POST, PUT, DELETE requests
  if (request.method !== 'GET') return;

  // Route to caching strategy based on resource type
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, 'images-cache', 30 * 24 * 60 * 60));
  } else if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, 'api-cache', 5 * 60));
  } else if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font'
  ) {
    event.respondWith(staleWhileRevalidate(request, 'static-cache'));
  } else if (request.destination === 'document') {
    event.respondWith(networkFirst(request, 'pages-cache', 10 * 60));
  }
});

// === STRATEGY: Cache-First ===
// Best for: images, fonts, vendor JS — things that rarely change
async function cacheFirst(
  request: Request,
  cacheName: string,
  maxAgeSeconds: number
): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    // MUST: Check age header for cache expiry
    const dateHeader = cached.headers.get('sw-cache-date');
    if (dateHeader) {
      const age = (Date.now() - new Date(dateHeader).getTime()) / 1000;
      if (age > maxAgeSeconds) {
        // Cache expired — fetch fresh, but serve stale as fallback
        try {
          const response = await fetch(request);
          await putInCache(cache, request, response.clone(), maxAgeSeconds);
          return response;
        } catch {
          return cached; // Serve stale on network failure
        }
      }
    }
    return cached;
  }

  // Not in cache — fetch and cache
  try {
    const response = await fetch(request);
    if (response.ok) {
      await putInCache(cache, request, response.clone(), maxAgeSeconds);
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// === STRATEGY: Network-First ===
// Best for: API calls, HTML pages — freshness critical
async function networkFirst(
  request: Request,
  cacheName: string,
  maxAgeSeconds: number
): Promise<Response> {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await putInCache(cache, request, response.clone(), maxAgeSeconds);
    }
    return response;
  } catch {
    // Network failed — serve from cache
    const cached = await cache.match(request);
    if (cached) return cached;

    // MUST: Return offline page for navigation requests
    if (request.destination === 'document') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) return offlinePage;
    }

    return new Response('Network error and no cache available', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// === STRATEGY: Stale-While-Revalidate ===
// Best for: CSS, JS, content that should be fast but stay updated
async function staleWhileRevalidate(
  request: Request,
  cacheName: string
): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // MUST: Always fetch in background to update cache
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Return cached version immediately, or wait for network
  return cached || (await fetchPromise) || new Response('Offline', { status: 503 });
}

// Helper: Add cache-date header for expiry tracking
async function putInCache(
  cache: Cache,
  request: Request,
  response: Response,
  _maxAge: number
): Promise<void> {
  const headers = new Headers(response.headers);
  headers.set('sw-cache-date', new Date().toISOString());
  const dated = new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  await cache.put(request, dated);
}
```

### Caching Strategy Comparison

| Strategy | Speed | Freshness | Offline | Best For |
|----------|-------|-----------|---------|----------|
| **Cache-First** | Fastest | Low | Full | Fonts, images, vendor libs |
| **Network-First** | Slowest | Highest | Partial | API data, HTML pages |
| **Stale-While-Revalidate** | Fast | Medium (eventual) | Partial | CSS, JS, articles |
| **Network-Only** | Depends | Always fresh | None | Auth, payments, real-time |
| **Cache-Only** | Fastest | None (precached) | Full | App shell, offline page |

---

## 2. Web Workers — Offloading Heavy Computation

### Worker Architecture

```
 MAIN THREAD                           WORKER THREAD
 ┌──────────────────────┐             ┌──────────────────────┐
 │ UI Rendering         │             │ Heavy Computation    │
 │ Event Handling       │◄──────────►│ Data Processing      │
 │ DOM Access           │  postMessage│ Image Manipulation   │
 │ Animation            │  (cloned)   │ Crypto Operations    │
 │                      │             │ Search/Filter        │
 │ NEVER do heavy       │  Transferable│ CSV/JSON Parsing    │
 │ computation here     │  (zero-copy) │                     │
 │                      │             │ NO DOM access        │
 │                      │             │ NO window object     │
 └──────────────────────┘             └──────────────────────┘

 WORKER TYPES:
 ┌───────────────────┬─────────────────┬───────────────────────┐
 │ Dedicated Worker  │ Shared Worker   │ Service Worker        │
 │ 1:1 with page     │ N:1 shared by   │ Proxy for network     │
 │ Simplest model    │ multiple tabs   │ Background sync       │
 │ Most common       │ Cross-tab state │ Push notifications    │
 └───────────────────┴─────────────────┴───────────────────────┘
```

### Dedicated Worker with Comlink (Recommended Pattern)

```typescript
// === MUST: Use Comlink to eliminate postMessage boilerplate ===

// worker.ts — The worker file
import { expose } from 'comlink';

interface DataProcessor {
  filterAndSort(
    items: Array<{ id: string; name: string; score: number }>,
    query: string,
    sortBy: 'name' | 'score'
  ): Array<{ id: string; name: string; score: number }>;

  parseCSV(csvText: string): Array<Record<string, string>>;

  hashPassword(password: string): Promise<string>;

  processImage(
    imageData: ImageData,
    filter: 'grayscale' | 'blur' | 'sharpen'
  ): ImageData;
}

const processor: DataProcessor = {
  filterAndSort(items, query, sortBy) {
    const lowerQuery = query.toLowerCase();
    return items
      .filter((item) => item.name.toLowerCase().includes(lowerQuery))
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return b.score - a.score;
      });
  },

  parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const values = line.split(',');
      return headers.reduce<Record<string, string>>((obj, header, i) => {
        obj[header] = values[i]?.trim() ?? '';
        return obj;
      }, {});
    });
  },

  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  processImage(imageData, filter) {
    const { data, width, height } = imageData;
    const output = new Uint8ClampedArray(data);

    if (filter === 'grayscale') {
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        output[i] = output[i + 1] = output[i + 2] = avg;
      }
    }
    // ... other filters

    return new ImageData(output, width, height);
  },
};

expose(processor);

// -------------------------------------------------------------------

// main.ts — Using the worker with Comlink
import { wrap, transfer } from 'comlink';
import type { DataProcessor } from './worker';

// MUST: Create worker with proper bundler support
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module',
});
const processor = wrap<DataProcessor>(worker);

// Usage — looks like a regular async function call!
async function searchItems(query: string): Promise<void> {
  // This runs in the WORKER THREAD — main thread stays responsive
  const results = await processor.filterAndSort(allItems, query, 'score');
  setResults(results);
}

// Transferable objects — ZERO-COPY for ArrayBuffers
async function processImage(canvas: HTMLCanvasElement): Promise<void> {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Transfer the buffer — main thread can no longer access it (zero-copy)
  const processed = await processor.processImage(
    transfer(imageData, [imageData.data.buffer]) as unknown as ImageData,
    'grayscale'
  );

  ctx.putImageData(processed, 0, 0);
}
```

### React Hook for Web Workers

```typescript
// === MUST: Wrap worker usage in a React hook ===

// hooks/use-worker.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import { wrap, Remote, releaseProxy } from 'comlink';

export function useWorker<T>(
  workerFactory: () => Worker
): { worker: Remote<T> | null; loading: boolean; error: Error | null } {
  const workerRef = useRef<Worker | null>(null);
  const proxyRef = useRef<Remote<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const worker = workerFactory();
      workerRef.current = worker;
      proxyRef.current = wrap<T>(worker);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Worker creation failed'));
      setLoading(false);
    }

    return () => {
      // MUST: Clean up worker on unmount to prevent memory leaks
      if (proxyRef.current) {
        (proxyRef.current as any)[releaseProxy]();
      }
      workerRef.current?.terminate();
    };
  }, []);

  return { worker: proxyRef.current, loading, error };
}

// Usage:
function SearchPage() {
  const { worker } = useWorker<DataProcessor>(
    () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  );

  const handleSearch = useCallback(async (query: string) => {
    if (!worker) return;
    const results = await worker.filterAndSort(items, query, 'score');
    setResults(results);
  }, [worker]);
}
```

### SharedWorker — Cross-Tab State

```typescript
// === SharedWorker: shared-worker.ts ===
// Use when multiple tabs need shared state (e.g., auth, notifications)

interface SharedState {
  user: { id: string; name: string } | null;
  notifications: Array<{ id: string; message: string; read: boolean }>;
}

const state: SharedState = {
  user: null,
  notifications: [],
};

const ports: MessagePort[] = [];

// MUST: Use 'connect' event (not 'message') for SharedWorker
self.addEventListener('connect', (event: MessageEvent) => {
  const port = event.ports[0];
  ports.push(port);

  port.addEventListener('message', (msg: MessageEvent) => {
    const { type, payload } = msg.data;

    switch (type) {
      case 'SET_USER':
        state.user = payload;
        broadcastToAll({ type: 'USER_CHANGED', payload: state.user });
        break;

      case 'ADD_NOTIFICATION':
        state.notifications.push(payload);
        broadcastToAll({ type: 'NOTIFICATION_ADDED', payload });
        break;

      case 'GET_STATE':
        port.postMessage({ type: 'STATE', payload: state });
        break;
    }
  });

  port.start();
  // MUST: Send initial state to newly connected tab
  port.postMessage({ type: 'STATE', payload: state });
});

function broadcastToAll(message: unknown): void {
  for (const port of ports) {
    try {
      port.postMessage(message);
    } catch {
      // Port disconnected — remove it
      const idx = ports.indexOf(port);
      if (idx > -1) ports.splice(idx, 1);
    }
  }
}
```

---

## 3. WebSocket — Reconnection, Heartbeat, Binary

### Production WebSocket Client

```typescript
// === MUST: Use this reconnecting WebSocket pattern in production ===

interface WebSocketConfig {
  url: string;
  protocols?: string[];
  heartbeatIntervalMs?: number;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  maxReconnectAttempts?: number;
  onMessage: (data: unknown) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting') => void;
}

class ReconnectingWebSocket {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private intentionalClose = false;
  private config: Required<WebSocketConfig>;

  constructor(config: WebSocketConfig) {
    this.config = {
      protocols: [],
      heartbeatIntervalMs: 30_000,
      reconnectDelayMs: 1_000,
      maxReconnectDelayMs: 30_000,
      maxReconnectAttempts: Infinity,
      onStatusChange: () => {},
      ...config,
    };
    this.connect();
  }

  private connect(): void {
    this.config.onStatusChange(
      this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting'
    );

    try {
      this.ws = new WebSocket(this.config.url, this.config.protocols);
      this.ws.binaryType = 'arraybuffer'; // MUST: Use arraybuffer for binary

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.config.onStatusChange('connected');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        // MUST: Handle pong responses from heartbeat
        if (event.data === 'pong' || event.data === '__pong__') return;

        // Parse message based on type
        if (typeof event.data === 'string') {
          try {
            this.config.onMessage(JSON.parse(event.data));
          } catch {
            this.config.onMessage(event.data);
          }
        } else if (event.data instanceof ArrayBuffer) {
          // Binary protocol — decode as needed
          this.config.onMessage(event.data);
        }
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.stopHeartbeat();
        this.config.onStatusChange('disconnected');

        // MUST: Only reconnect on abnormal closure
        if (!this.intentionalClose && event.code !== 1000) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // Error always followed by close — reconnection handled in onclose
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private startHeartbeat(): void {
    // MUST: Send heartbeat to detect dead connections
    // Network issues may not trigger WebSocket close events
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('__ping__');
      }
    }, this.config.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    // MUST: Exponential backoff with jitter
    const delay = Math.min(
      this.config.reconnectDelayMs * Math.pow(2, this.reconnectAttempts) +
        Math.random() * 1000, // Jitter to prevent thundering herd
      this.config.maxReconnectDelayMs
    );

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  send(data: string | ArrayBuffer | Record<string, unknown>): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not open. Message queued or dropped.');
      return;
    }

    if (typeof data === 'object' && !(data instanceof ArrayBuffer)) {
      this.ws.send(JSON.stringify(data));
    } else {
      this.ws.send(data);
    }
  }

  close(): void {
    this.intentionalClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(1000, 'Client closing');
  }
}

// === React hook ===
function useWebSocket(url: string, onMessage: (data: unknown) => void) {
  const [status, setStatus] = useState<string>('connecting');
  const wsRef = useRef<ReconnectingWebSocket | null>(null);

  useEffect(() => {
    wsRef.current = new ReconnectingWebSocket({
      url,
      onMessage,
      onStatusChange: setStatus,
    });

    return () => wsRef.current?.close();
  }, [url]);

  const send = useCallback((data: unknown) => {
    wsRef.current?.send(data as string);
  }, []);

  return { send, status };
}
```

### WebSocket vs Server-Sent Events

| Feature | WebSocket | Server-Sent Events (SSE) |
|---------|-----------|--------------------------|
| **Direction** | Bidirectional | Server → Client only |
| **Protocol** | ws:// / wss:// | Standard HTTP |
| **Reconnection** | Manual (implement yourself) | Built-in automatic |
| **Binary data** | Yes (ArrayBuffer, Blob) | No (text only) |
| **HTTP/2 multiplexing** | No (separate TCP) | Yes (shares connection) |
| **Browser support** | Universal | Universal (except IE) |
| **Proxy/CDN friendly** | Often blocked | Always works |
| **Use for** | Chat, gaming, real-time collab | Notifications, feeds, dashboards |
| **Max connections** | Unlimited | 6 per domain (HTTP/1.1) |

### Server-Sent Events — Production Pattern

```typescript
// === MUST: Use SSE for server-to-client streaming ===

// React hook for SSE with reconnection
function useServerEvents<T>(
  url: string,
  options?: { withCredentials?: boolean }
): { data: T | null; error: Error | null; status: string } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const eventSource = new EventSource(url, {
      withCredentials: options?.withCredentials ?? false,
    });

    eventSource.onopen = () => setStatus('connected');

    // Default message event
    eventSource.onmessage = (event) => {
      try {
        setData(JSON.parse(event.data));
      } catch {
        setData(event.data as unknown as T);
      }
    };

    // MUST: Handle named events separately
    eventSource.addEventListener('notification', (event: MessageEvent) => {
      // Handle specific event types from server
      const parsed = JSON.parse(event.data);
      setData(parsed);
    });

    eventSource.onerror = () => {
      setStatus('reconnecting');
      // EventSource auto-reconnects — no manual logic needed
      // MUST: Set error only after repeated failures
      setError(new Error('Connection lost, reconnecting...'));
    };

    return () => {
      eventSource.close();
    };
  }, [url]);

  return { data, error, status };
}

// Server-side (Node.js/Express):
// app.get('/api/events', (req, res) => {
//   res.writeHead(200, {
//     'Content-Type': 'text/event-stream',
//     'Cache-Control': 'no-cache',
//     Connection: 'keep-alive',
//   });
//   res.write(`retry: 5000\n\n`); // MUST: Set retry interval
//   res.write(`event: notification\ndata: ${JSON.stringify(data)}\n\n`);
// });
```

---

## 4. IndexedDB with Dexie.js

```typescript
// === MUST: Use Dexie.js for IndexedDB — raw API is unusable in production ===

import Dexie, { Table } from 'dexie';

// Define database schema with TypeScript types
interface User {
  id?: number;          // Auto-incremented
  email: string;
  name: string;
  avatar?: Blob;
  createdAt: Date;
  syncedAt?: Date;
}

interface Post {
  id: string;           // UUID from server
  userId: number;
  title: string;
  content: string;
  tags: string[];
  publishedAt: Date;
  offlineCreated?: boolean;
}

interface SyncQueue {
  id?: number;
  operation: 'create' | 'update' | 'delete';
  table: string;
  recordId: string;
  data: unknown;
  createdAt: Date;
  retries: number;
}

class AppDatabase extends Dexie {
  users!: Table<User, number>;
  posts!: Table<Post, string>;
  syncQueue!: Table<SyncQueue, number>;

  constructor() {
    super('AppDatabase');

    // MUST: Version migrations — NEVER delete old versions
    this.version(1).stores({
      users: '++id, email, name, createdAt',
      posts: 'id, userId, *tags, publishedAt',
      //       ^primary key   ^multi-entry index
    });

    this.version(2).stores({
      users: '++id, email, name, createdAt, syncedAt',
      posts: 'id, userId, *tags, publishedAt, offlineCreated',
      syncQueue: '++id, table, operation, createdAt',
    }).upgrade((tx) => {
      // MUST: Handle data migration for existing records
      return tx.table('users').toCollection().modify((user) => {
        user.syncedAt = user.createdAt;
      });
    });
  }
}

const db = new AppDatabase();

// === CRUD Operations ===

// Create
async function createPost(post: Omit<Post, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await db.posts.add({ ...post, id });
  return id;
}

// Read with pagination
async function getPosts(
  page: number,
  pageSize: number,
  tag?: string
): Promise<{ posts: Post[]; total: number }> {
  let collection = tag
    ? db.posts.where('tags').equals(tag)
    : db.posts.orderBy('publishedAt');

  const total = await collection.count();
  const posts = await collection
    .reverse() // newest first
    .offset((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();

  return { posts, total };
}

// Bulk operations (MUST use for large datasets)
async function bulkSyncPosts(serverPosts: Post[]): Promise<void> {
  await db.transaction('rw', db.posts, async () => {
    // MUST: Use bulkPut for upsert behavior
    await db.posts.bulkPut(serverPosts);
  });
}

// Full-text-ish search (Dexie does not have full-text index)
async function searchPosts(query: string): Promise<Post[]> {
  const lowerQuery = query.toLowerCase();
  return db.posts
    .filter((post) =>
      post.title.toLowerCase().includes(lowerQuery) ||
      post.content.toLowerCase().includes(lowerQuery)
    )
    .limit(50)
    .toArray();
}

// === Offline-First Sync Queue Pattern ===
async function queueForSync(
  operation: SyncQueue['operation'],
  table: string,
  recordId: string,
  data: unknown
): Promise<void> {
  await db.syncQueue.add({
    operation,
    table,
    recordId,
    data,
    createdAt: new Date(),
    retries: 0,
  });
}

async function processyncQueue(): Promise<void> {
  const pending = await db.syncQueue.orderBy('createdAt').toArray();

  for (const item of pending) {
    try {
      await syncToServer(item);
      await db.syncQueue.delete(item.id!);
    } catch (error) {
      // MUST: Increment retry counter and back off
      await db.syncQueue.update(item.id!, {
        retries: item.retries + 1,
      });
      if (item.retries >= 5) {
        console.error(`Sync failed permanently for ${item.table}:${item.recordId}`);
      }
    }
  }
}
```

---

## 5. Broadcast Channel API — Cross-Tab Communication

```typescript
// === MUST: Use BroadcastChannel for cross-tab state sync ===

// cross-tab-sync.ts
type BroadcastMessage =
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_LOGIN'; payload: { userId: string } }
  | { type: 'THEME_CHANGE'; payload: { theme: 'light' | 'dark' } }
  | { type: 'CART_UPDATE'; payload: { itemCount: number } }
  | { type: 'DATA_INVALIDATE'; payload: { keys: string[] } };

class CrossTabSync {
  private channel: BroadcastChannel;
  private listeners = new Map<string, Set<(payload: unknown) => void>>();

  constructor(channelName = 'app-sync') {
    this.channel = new BroadcastChannel(channelName);

    this.channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      const { type } = event.data;
      const handlers = this.listeners.get(type);
      if (handlers) {
        for (const handler of handlers) {
          handler('payload' in event.data ? event.data.payload : undefined);
        }
      }
    };
  }

  on<T extends BroadcastMessage['type']>(
    type: T,
    handler: (payload: Extract<BroadcastMessage, { type: T }> extends { payload: infer P } ? P : void) => void
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler as (p: unknown) => void);

    // Return unsubscribe function
    return () => this.listeners.get(type)?.delete(handler as (p: unknown) => void);
  }

  emit(message: BroadcastMessage): void {
    this.channel.postMessage(message);
  }

  close(): void {
    this.channel.close();
  }
}

// Usage:
const sync = new CrossTabSync();

// In auth module — broadcast logout to all tabs
function logout(): void {
  clearSession();
  sync.emit({ type: 'AUTH_LOGOUT' });
}

// In every tab — listen for logout
sync.on('AUTH_LOGOUT', () => {
  // MUST: Clear local state and redirect
  clearLocalState();
  window.location.href = '/login';
});

// React Query integration — invalidate cache across tabs
sync.on('DATA_INVALIDATE', ({ keys }) => {
  queryClient.invalidateQueries({ queryKey: keys });
});
```

---

## 6. Web Locks API

```typescript
// === MUST: Use Web Locks for cross-tab resource coordination ===

// Prevent multiple tabs from running the same sync operation
async function exclusiveSync(): Promise<void> {
  // MUST: Only one tab executes this at a time
  await navigator.locks.request('data-sync', async (lock) => {
    if (!lock) return; // Lock could not be acquired

    console.log('Acquired sync lock — this tab is syncing');
    await performFullSync();
    console.log('Sync complete, releasing lock');
  });
}

// Prevent multiple tabs from refreshing the auth token simultaneously
async function refreshAuthToken(): Promise<string> {
  return navigator.locks.request(
    'auth-token-refresh',
    { ifAvailable: true }, // Non-blocking: skip if another tab is already refreshing
    async (lock) => {
      if (!lock) {
        // Another tab is refreshing — wait for it
        return navigator.locks.request('auth-token-refresh', async () => {
          // Lock acquired = other tab finished. Read the new token.
          return getStoredToken();
        });
      }

      // This tab does the refresh
      const newToken = await fetchNewToken();
      storeToken(newToken);
      return newToken;
    }
  );
}

// Leader election — only ONE tab runs background tasks
async function electLeader(onBecomeLeader: () => void): Promise<void> {
  // MUST: Use 'shared' mode = lock held as long as this tab is alive
  await navigator.locks.request(
    'leader-election',
    { mode: 'exclusive' },
    async () => {
      console.log('This tab is now the leader');
      onBecomeLeader();

      // Hold the lock forever (until tab closes)
      return new Promise(() => {});
    }
  );
}
```

---

## 7. Observers — Intersection, Resize, Mutation

### Intersection Observer — Lazy Loading and Infinite Scroll

```typescript
// === MUST: Use IntersectionObserver for visibility detection ===
// NEVER use scroll events + getBoundingClientRect (causes layout thrashing)

// React hook for intersection observation
function useIntersection(
  options?: IntersectionObserverInit
): [React.RefCallback<HTMLElement>, boolean] {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!node) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0,      // Trigger as soon as any pixel is visible
        rootMargin: '200px', // Start loading 200px before entering viewport
        ...options,
      }
    );

    observerRef.current.observe(node);
  }, [options?.threshold, options?.rootMargin, options?.root]);

  return [ref, isIntersecting];
}

// === Infinite scroll with IntersectionObserver ===
function InfiniteList({ loadMore }: { loadMore: () => Promise<void> }) {
  const [sentinelRef, isVisible] = useIntersection({ rootMargin: '400px' });
  const loadingRef = useRef(false);

  useEffect(() => {
    if (isVisible && !loadingRef.current) {
      loadingRef.current = true;
      loadMore().finally(() => {
        loadingRef.current = false;
      });
    }
  }, [isVisible, loadMore]);

  return (
    <div>
      {items.map((item) => <Item key={item.id} item={item} />)}
      {/* Sentinel element at the bottom triggers loading */}
      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
    </div>
  );
}

// === Image lazy loading with blur-up ===
function LazyImage({ src, blurhash, alt, width, height }: LazyImageProps) {
  const [imgRef, isVisible] = useIntersection({ rootMargin: '300px' });
  const [loaded, setLoaded] = useState(false);

  return (
    <div ref={imgRef} style={{ width, height, position: 'relative' }}>
      {/* Blurhash placeholder */}
      {!loaded && <canvas className="blur-placeholder" />}

      {/* MUST: Only load image when near viewport */}
      {isVisible && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"           // Browser native lazy loading as fallback
          decoding="async"         // MUST: Non-blocking decode
          onLoad={() => setLoaded(true)}
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
        />
      )}
    </div>
  );
}
```

### Resize Observer

```typescript
// === MUST: Use ResizeObserver instead of window resize events for elements ===

function useResizeObserver<T extends HTMLElement>(): [
  React.RefCallback<T>,
  DOMRectReadOnly | null
] {
  const [rect, setRect] = useState<DOMRectReadOnly | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node) return;

    observerRef.current = new ResizeObserver(([entry]) => {
      // MUST: Use contentBoxSize for accurate measurements
      // (borderBoxSize includes padding+border)
      if (entry.contentBoxSize) {
        const [size] = entry.contentBoxSize;
        setRect(entry.contentRect);
      } else {
        // Fallback for Safari < 15.4
        setRect(entry.contentRect);
      }
    });

    observerRef.current.observe(node, { box: 'content-box' });
  }, []);

  return [ref, rect];
}

// Usage: Responsive chart that redraws on container resize
function ResponsiveChart({ data }: { data: ChartData }) {
  const [containerRef, rect] = useResizeObserver<HTMLDivElement>();

  return (
    <div ref={containerRef} style={{ width: '100%', height: 400 }}>
      {rect && (
        <Chart
          data={data}
          width={rect.width}
          height={rect.height}
        />
      )}
    </div>
  );
}
```

### Mutation Observer

```typescript
// === MutationObserver: Watch DOM changes (use sparingly) ===
// MUST: Use only when you need to react to third-party DOM mutations
// NEVER use as a substitute for React state management

function useMutationObserver(
  target: React.RefObject<HTMLElement>,
  callback: MutationCallback,
  options: MutationObserverInit = { childList: true, subtree: true }
): void {
  useEffect(() => {
    if (!target.current) return;

    const observer = new MutationObserver(callback);
    observer.observe(target.current, options);

    return () => observer.disconnect();
  }, [target, callback, options]);
}

// Real-world use case: Detect when a third-party widget injects content
function ThirdPartyContainer() {
  const containerRef = useRef<HTMLDivElement>(null);

  useMutationObserver(
    containerRef,
    (mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Third-party script added elements — style them
          for (const node of Array.from(mutation.addedNodes)) {
            if (node instanceof HTMLElement) {
              node.classList.add('third-party-styled');
            }
          }
        }
      }
    },
    { childList: true, subtree: true }
  );

  return <div ref={containerRef} id="third-party-mount" />;
}
```

---

## 8. File System Access API

```typescript
// === File System Access API: Direct file read/write (Chromium only) ===
// MUST: Feature-detect. NEVER assume availability.

async function openAndEditFile(): Promise<void> {
  // MUST: Feature check
  if (!('showOpenFilePicker' in window)) {
    // Fallback to <input type="file">
    return openWithFileInput();
  }

  try {
    // Show native file picker
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'JSON files',
          accept: { 'application/json': ['.json'] },
        },
        {
          description: 'Text files',
          accept: { 'text/plain': ['.txt', '.md'] },
        },
      ],
      multiple: false,
    });

    // Read the file
    const file = await fileHandle.getFile();
    const content = await file.text();

    // Process content...
    const modified = processContent(content);

    // MUST: Request write permission (prompts user)
    const writable = await fileHandle.createWritable();
    await writable.write(modified);
    await writable.close();

  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      // User cancelled — this is normal, not an error
      return;
    }
    throw error;
  }
}

// Save As — new file
async function saveAs(content: string, suggestedName: string): Promise<void> {
  if (!('showSaveFilePicker' in window)) {
    // Fallback: create download link
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [
      { description: 'JSON', accept: { 'application/json': ['.json'] } },
    ],
  });

  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}
```

---

## 9. Clipboard API

```typescript
// === MUST: Use Clipboard API (not execCommand) for copy/paste ===

// Copy text to clipboard
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts or denied permission
    return fallbackCopy(text);
  }
}

// Copy rich content (HTML + plain text fallback)
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

// Copy image to clipboard
async function copyImage(imageUrl: string): Promise<void> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();

  // MUST: Convert to PNG — clipboard only accepts PNG
  const pngBlob = await convertToPng(blob);

  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': pngBlob }),
  ]);
}

// Read from clipboard
async function pasteFromClipboard(): Promise<string> {
  // MUST: Request permission in secure context
  try {
    const text = await navigator.clipboard.readText();
    return text;
  } catch {
    console.warn('Clipboard read denied');
    return '';
  }
}

// React hook
function useCopyToClipboard(): [
  (text: string) => Promise<void>,
  boolean
] {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, []);

  return [copy, copied];
}
```

---

## 10. Navigation API

```typescript
// === Navigation API: Modern client-side routing primitive ===
// MUST: Feature-detect — Chrome 102+, no Firefox/Safari yet

function setupNavigationInterceptor(): void {
  if (!('navigation' in window)) return;

  const navigation = (window as any).navigation;

  navigation.addEventListener('navigate', (event: any) => {
    // MUST: Only intercept same-origin navigations
    if (!event.canIntercept) return;
    if (event.hashChange) return; // Let hash changes work normally

    const url = new URL(event.destination.url);

    // Intercept and handle with SPA router
    event.intercept({
      scroll: 'after-transition', // Scroll after View Transition
      async handler() {
        // Load the route component
        const routeModule = await loadRoute(url.pathname);

        // MUST: Use event.signal for cancellation
        if (event.signal.aborted) return;

        // Render the new route
        renderRoute(routeModule);
      },
    });
  });
}
```

---

## 11. View Transitions API

```typescript
// === View Transitions API: Animated page transitions ===
// MUST: Feature-detect — Chrome 111+, Safari 18+

// Same-document transitions (SPAs)
async function navigateWithTransition(
  updateDOM: () => void | Promise<void>
): Promise<void> {
  // MUST: Feature check
  if (!document.startViewTransition) {
    await updateDOM();
    return;
  }

  const transition = document.startViewTransition(async () => {
    await updateDOM();
  });

  // MUST: Handle transition errors gracefully
  try {
    await transition.finished;
  } catch {
    // Transition was skipped — DOM was still updated
  }
}

// React integration with View Transitions
function useViewTransition() {
  const navigate = useNavigate();

  return useCallback((to: string) => {
    if (!document.startViewTransition) {
      navigate(to);
      return;
    }

    document.startViewTransition(() => {
      // React flushSync ensures DOM updates synchronously for the transition
      flushSync(() => {
        navigate(to);
      });
    });
  }, [navigate]);
}
```

```css
/* === View Transition CSS === */

/* Default crossfade (automatic) */
::view-transition-old(root) {
  animation: fade-out 0.3s ease;
}
::view-transition-new(root) {
  animation: fade-in 0.3s ease;
}

/* Named transitions for shared elements */
.product-card {
  view-transition-name: product-hero;
}
.product-detail-image {
  view-transition-name: product-hero;
  /* MUST: Same name on both pages = shared element transition */
}

/* Customize the shared element animation */
::view-transition-group(product-hero) {
  animation-duration: 0.4s;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Slide transition for navigation */
@keyframes slide-from-right {
  from { transform: translateX(100%); }
}
@keyframes slide-to-left {
  to { transform: translateX(-100%); }
}

::view-transition-old(root) {
  animation: slide-to-left 0.3s ease forwards;
}
::view-transition-new(root) {
  animation: slide-from-right 0.3s ease forwards;
}

/* MUST: Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: 0.01ms !important;
  }
}
```

---

## 12. API Browser Support Matrix

| API | Chrome | Firefox | Safari | Use in Production? |
|-----|--------|---------|--------|--------------------|
| **Service Worker** | 40+ | 44+ | 11.1+ | YES — universal |
| **Web Worker** | 4+ | 3.5+ | 4+ | YES — universal |
| **SharedWorker** | 4+ | 29+ | 16+ | YES with fallback |
| **WebSocket** | 16+ | 11+ | 6+ | YES — universal |
| **SSE (EventSource)** | 6+ | 6+ | 5+ | YES — universal |
| **IndexedDB** | 23+ | 10+ | 10+ | YES — universal |
| **BroadcastChannel** | 54+ | 38+ | 15.4+ | YES — universal now |
| **Web Locks** | 69+ | 96+ | 15.4+ | YES with fallback |
| **IntersectionObserver** | 51+ | 55+ | 12.1+ | YES — universal |
| **ResizeObserver** | 64+ | 69+ | 13.1+ | YES — universal |
| **MutationObserver** | 26+ | 14+ | 7+ | YES — universal |
| **File System Access** | 86+ | No | No | Chromium only + fallback |
| **Clipboard API** | 66+ | 63+ | 13.1+ | YES with fallback |
| **Navigation API** | 102+ | No | No | Chromium only + fallback |
| **View Transitions** | 111+ | No | 18+ | Progressive enhancement only |
| **Shared Element Transitions** | 111+ | No | 18+ | Progressive enhancement only |

---

## 13. Anti-Patterns — Symptoms and Fixes

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| Service Worker caches POST responses | Stale data, double-submission | NEVER cache POST/PUT/DELETE — only GET |
| SW `skipWaiting()` without user consent | Page breaks mid-session, lost form data | ALWAYS prompt user before activating new SW |
| Web Worker for trivial computation | Worker creation overhead > computation time | Only use Workers for tasks > 16ms |
| Not terminating Workers on unmount | Memory leaks, zombie workers | ALWAYS `worker.terminate()` in cleanup |
| WebSocket without heartbeat | Silent disconnection, stale UI | ALWAYS implement ping/pong heartbeat |
| WebSocket without reconnection logic | User sees "disconnected" forever | MUST use exponential backoff reconnection |
| Raw IndexedDB API in production | Callback hell, poor error handling | ALWAYS use Dexie.js or idb wrapper |
| IntersectionObserver without `disconnect()` | Memory leaks, observing detached elements | ALWAYS disconnect in useEffect cleanup |
| `scroll` + `getBoundingClientRect` for lazy loading | Layout thrashing, janky scroll | Use IntersectionObserver instead |
| MutationObserver with `subtree: true` on `<body>` | Performance collapse, recursive callbacks | Scope to smallest possible subtree |
| BroadcastChannel without message type checking | All tabs react to all messages | ALWAYS use typed messages with discriminated unions |

---

## 14. Enforcement Checklist

```
SERVICE WORKERS:
  [ ] Registration includes update detection and user notification
  [ ] skipWaiting() ONLY called after user confirms update
  [ ] Activate event claims all clients
  [ ] ONLY GET requests are cached — POST/PUT/DELETE are NEVER cached
  [ ] Cache versioning with cache name includes version number
  [ ] Old caches cleaned in activate event
  [ ] Offline fallback page precached during install
  [ ] navigator.sendBeacon used for analytics (not fetch in beforeunload)

WEB WORKERS:
  [ ] Comlink used for type-safe Worker communication
  [ ] Workers created with new URL('./worker.ts', import.meta.url) for bundler compat
  [ ] Workers terminated on component unmount
  [ ] Transferable objects used for ArrayBuffers (zero-copy)
  [ ] Heavy computation (>16ms) moved to Worker — NEVER on main thread
  [ ] Worker fallback for browsers without module Worker support

WEBSOCKET:
  [ ] Heartbeat ping/pong every 30s to detect dead connections
  [ ] Exponential backoff with jitter for reconnection
  [ ] intentional close flag to prevent reconnection on user logout
  [ ] Binary data uses ArrayBuffer (not Blob)
  [ ] Message queue for messages sent while reconnecting
  [ ] Connection status exposed to UI

INDEXEDDB:
  [ ] Dexie.js (or idb) used instead of raw IndexedDB API
  [ ] Version migrations preserve data — NEVER drop tables
  [ ] Transactions used for multi-table operations
  [ ] bulkPut used for batch operations (not individual puts in loop)
  [ ] Database closed on application teardown

OBSERVERS:
  [ ] IntersectionObserver used for ALL visibility detection (not scroll events)
  [ ] ResizeObserver used for element size changes (not window.onresize)
  [ ] All observers disconnected in useEffect cleanup functions
  [ ] MutationObserver scoped to smallest possible subtree
  [ ] rootMargin set on IntersectionObserver for prefetching (200-400px)

CROSS-TAB:
  [ ] BroadcastChannel used for cross-tab state sync
  [ ] Auth logout broadcast to all tabs immediately
  [ ] Web Locks used for exclusive operations (sync, token refresh)
  [ ] Leader election via Web Locks for background tasks
  [ ] Messages use TypeScript discriminated unions for type safety

FEATURE DETECTION:
  [ ] ALL modern APIs feature-detected before use
  [ ] Fallbacks provided for File System Access, Navigation, View Transitions
  [ ] Progressive enhancement — app works without optional APIs
  [ ] NEVER use User-Agent sniffing — ALWAYS use feature detection
```
