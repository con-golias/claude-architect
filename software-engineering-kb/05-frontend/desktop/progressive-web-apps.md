# Progressive Web Apps — Complete Specification

> **AI Plugin Directive:** When a developer asks "PWA setup", "service worker", "web app manifest", "offline web app", "install prompt PWA", "PWA vs native app", "workbox", "cache strategies", "push notifications web", "PWA performance", "background sync web", or any PWA question, ALWAYS consult this directive. Progressive Web Apps (PWAs) are web applications that use modern APIs to deliver native-app-like experiences. ALWAYS use Workbox for service worker management — NEVER write service workers from scratch. ALWAYS implement a web app manifest for installability. ALWAYS use cache-first strategy for static assets and network-first for API calls. PWAs are the best choice when you need cross-platform reach without app store distribution.

**Core Rule: PWAs are web apps enhanced with service workers, manifests, and modern APIs to work offline, be installable, and send push notifications. ALWAYS use Workbox (by Google) for service worker generation — hand-written service workers are error-prone and hard to maintain. ALWAYS implement the stale-while-revalidate pattern for content that changes periodically. ALWAYS test with Lighthouse PWA audit — score must be 100 before launch. Choose PWA over native when: app store distribution is not required, web reach is important, and the app is primarily content/forms-based.**

---

## 1. PWA Architecture

```
  PWA COMPONENTS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  WEB APP MANIFEST (manifest.json):                   │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • App name, icons, theme color                │  │
  │  │  • Display mode (standalone, fullscreen)       │  │
  │  │  • Start URL, scope                            │  │
  │  │  • Shortcuts, screenshots                      │  │
  │  │  → Makes app INSTALLABLE                       │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  SERVICE WORKER (sw.js):                             │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • Intercepts network requests                 │  │
  │  │  • Caches assets and API responses             │  │
  │  │  • Enables offline functionality               │  │
  │  │  • Background sync                             │  │
  │  │  • Push notification handling                  │  │
  │  │  → Makes app work OFFLINE                      │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  MODERN WEB APIs:                                    │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • Push API (notifications)                    │  │
  │  │  • Background Sync API                         │  │
  │  │  • Cache API                                   │  │
  │  │  • IndexedDB (structured storage)              │  │
  │  │  • Web Share API                               │  │
  │  │  • Badging API                                 │  │
  │  │  → Makes app feel NATIVE                       │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

### 1.1 Web App Manifest

```json
// manifest.json
{
  "name": "My Progressive Web App",
  "short_name": "MyPWA",
  "description": "A powerful web app that works offline",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a73e8",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    {
      "name": "New Item",
      "url": "/new",
      "icons": [{ "src": "/icons/new-item.png", "sizes": "96x96" }]
    }
  ],
  "screenshots": [
    { "src": "/screenshots/desktop.png", "sizes": "1280x720", "form_factor": "wide" },
    { "src": "/screenshots/mobile.png", "sizes": "750x1334", "form_factor": "narrow" }
  ]
}
```

---

## 2. Service Worker with Workbox

```typescript
// vite.config.ts — Workbox via vite-plugin-pwa
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // API calls — network first, fallback to cache
            urlPattern: /^https:\/\/api\.example\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 }, // 1 hour
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Images — cache first
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }, // 30 days
            },
          },
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
        ],
      },
      manifest: {
        name: 'My PWA',
        short_name: 'MyPWA',
        theme_color: '#1a73e8',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
```

### 2.1 Caching Strategies

```
  CACHING STRATEGIES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  CACHE FIRST (fastest):                              │
  │  Request → Cache hit? → Return cached                │
  │                  miss? → Network → Cache → Return     │
  │  USE FOR: Static assets (images, fonts, CSS, JS)     │
  │                                                      │
  │  NETWORK FIRST (freshest):                           │
  │  Request → Network → Cache → Return                  │
  │             timeout? → Return cached (stale)          │
  │  USE FOR: API calls, dynamic content                 │
  │                                                      │
  │  STALE WHILE REVALIDATE (balanced):                  │
  │  Request → Return cached immediately                  │
  │          → Fetch from network in background           │
  │          → Update cache for next request              │
  │  USE FOR: Content that changes periodically           │
  │           (blog posts, product listings)              │
  │                                                      │
  │  NETWORK ONLY:                                       │
  │  Request → Network → Return                          │
  │  USE FOR: Analytics, non-cacheable POST requests      │
  │                                                      │
  │  CACHE ONLY:                                         │
  │  Request → Cache → Return                            │
  │  USE FOR: Pre-cached static content only              │
  └──────────────────────────────────────────────────────┘
```

---

## 3. Offline Fallback & Background Sync

```typescript
// Offline fallback page
// Register in workbox config
workbox: {
  navigateFallback: '/offline.html',
  navigateFallbackAllowlist: [/^\/(?!api)/], // only for navigation, not API
}

// Background Sync API — retry failed requests when online
import { BackgroundSyncPlugin } from 'workbox-background-sync';

const bgSyncPlugin = new BackgroundSyncPlugin('apiQueue', {
  maxRetentionTime: 24 * 60, // 24 hours
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request.clone());
      } catch (error) {
        await queue.unshiftRequest(entry);
        throw error; // retry later
      }
    }
  },
});

// Register sync plugin for POST/PUT/DELETE requests
registerRoute(
  /^https:\/\/api\.example\.com\/.*/i,
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  'POST',
);
```

```typescript
// Periodic Background Sync (limited browser support)
if ('periodicSync' in navigator.serviceWorker) {
  const registration = await navigator.serviceWorker.ready;
  try {
    await registration.periodicSync.register('content-sync', {
      minInterval: 24 * 60 * 60 * 1000, // once per day
    });
  } catch {
    // Periodic sync not granted
  }
}

// In service worker
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(syncContent());
  }
});

async function syncContent() {
  const response = await fetch('/api/latest-content');
  const data = await response.json();
  const cache = await caches.open('content-cache');
  // Update cached content
  for (const item of data) {
    await cache.put(`/content/${item.id}`, new Response(JSON.stringify(item)));
  }
}
```

---

## 4. Push Notifications (Web Push)

```typescript
// Request push notification permission
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // Send subscription to server
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });
}

// Service worker — handle push event
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: data.url },
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    }),
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(clients.openWindow(event.notification.data.url || '/'));
  }
});
```

---

## 5. Install Prompt

```typescript
// Custom install prompt (before the browser's default)
let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton(); // show your custom UI
});

async function handleInstallClick() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    console.log('User installed PWA');
  }
  deferredPrompt = null;
}

// React component
function InstallBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!showBanner) return null;

  return (
    <div className="install-banner">
      <p>Install our app for offline access and faster loading</p>
      <button onClick={handleInstallClick}>Install</button>
      <button onClick={() => setShowBanner(false)}>Dismiss</button>
    </div>
  );
}
```

---

## 4. PWA vs Native Decision

```
  PWA vs NATIVE APP DECISION

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  CHOOSE PWA WHEN:                                    │
  │  ✅ Content/forms-based app (news, e-commerce, tools) │
  │  ✅ Web reach is more important than store presence   │
  │  ✅ Budget is limited (one codebase for all platforms)│
  │  ✅ SEO is important (PWA content is indexable)       │
  │  ✅ Instant updates needed (no app store review)      │
  │  ✅ Offline capability is a nice-to-have              │
  │                                                      │
  │  CHOOSE NATIVE/CROSS-PLATFORM WHEN:                  │
  │  ✅ App Store presence required (discovery, payments)  │
  │  ✅ Deep device access (BLE, NFC, camera processing)  │
  │  ✅ Complex gestures and animations                   │
  │  ✅ Background processing requirements                │
  │  ✅ Push notification reliability is critical          │
  │  ✅ iOS users are primary target (Safari PWA support   │
  │    is limited compared to Chrome)                    │
  │                                                      │
  │  PWA LIMITATIONS ON iOS:                             │
  │  • No push notifications in iOS PWA (until iOS 16.4+)│
  │  • No background sync                                │
  │  • 50MB cache limit                                  │
  │  • No install prompt (Add to Home Screen only)        │
  │  • Service worker killed after 48h of inactivity      │
  └──────────────────────────────────────────────────────┘
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Hand-written service worker** | Cache bugs, stale content, broken offline | Use Workbox — battle-tested, maintained by Google |
| **Caching everything** | Cache grows unbounded, storage quota exceeded | Set `maxEntries` and `maxAgeSeconds` on every cache |
| **No update notification** | Users stuck on stale cached version forever | Implement "New version available" prompt with reload |
| **Missing maskable icon** | Icon displays incorrectly on Android (white border) | Include `"purpose": "maskable"` icon variant |
| **Cache-first for API calls** | Users see stale data that never refreshes | Network-first or stale-while-revalidate for API calls |
| **No offline fallback page** | Broken page when offline and cache miss | Precache an offline.html fallback page |
| **Ignoring iOS limitations** | PWA features silently fail on Safari | Test on Safari, implement graceful degradation |
| **No Lighthouse audit** | PWA criteria not met, not installable | Run Lighthouse PWA audit — must score 100 |

---

## 6. Enforcement Checklist

### Setup
- [ ] Web app manifest with all required fields
- [ ] Icons: 192x192, 512x512, and maskable variant
- [ ] Service worker registered (Workbox via vite-plugin-pwa)
- [ ] HTTPS enabled (required for service workers)
- [ ] `<meta name="theme-color">` in HTML

### Caching
- [ ] Static assets: cache-first strategy
- [ ] API calls: network-first with cache fallback
- [ ] Cache expiration configured (maxEntries + maxAgeSeconds)
- [ ] Offline fallback page precached
- [ ] Update prompt when new service worker available

### Quality
- [ ] Lighthouse PWA audit: 100 score
- [ ] Installability criteria met (manifest + service worker + HTTPS)
- [ ] Tested offline functionality
- [ ] Tested on iOS Safari (known limitations)
- [ ] Performance budget maintained (<100KB JS initial load)
