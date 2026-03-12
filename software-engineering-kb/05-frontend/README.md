# 05 — Frontend

> **AI Plugin Directive:** This section contains 80+ comprehensive guides covering web, mobile, and desktop frontend development. Start with the relevant subsection below based on the developer's question. For framework selection, route to `web/frameworks/framework-comparison.md`. For mobile platform decisions, route to `mobile/cross-platform/native-vs-cross-platform.md`. For desktop app decisions, route to `desktop/native-desktop-options.md`.

---

## Navigation

### Web — Fundamentals
Core browser, rendering, styling, and tooling knowledge that applies across ALL frameworks.

| Guide | Description |
|-------|-------------|
| [browser-rendering-pipeline.md](web/fundamentals/browser-rendering-pipeline.md) | DOM, CSSOM, layout, paint, compositing — how browsers render pages |
| [rendering-strategies.md](web/fundamentals/rendering-strategies.md) | CSR, SSR, SSG, ISR, streaming SSR — master comparison and decision guide |
| [web-platform-apis.md](web/fundamentals/web-platform-apis.md) | Intersection Observer, Web Workers, Service Workers, Storage APIs |
| [seo-and-metadata.md](web/fundamentals/seo-and-metadata.md) | Meta tags, structured data, Open Graph, sitemap, robots.txt |
| [responsive-design.md](web/fundamentals/responsive-design.md) | Media queries, container queries, fluid typography, mobile-first |
| [tailwind-css.md](web/fundamentals/tailwind-css.md) | Utility-first CSS, configuration, custom plugins, design tokens |
| [css-in-js.md](web/fundamentals/css-in-js.md) | Styled-components, Emotion, vanilla-extract, zero-runtime options |
| [css-modules.md](web/fundamentals/css-modules.md) | Scoped CSS, composition, integration with bundlers |
| [design-tokens.md](web/fundamentals/design-tokens.md) | Token architecture, naming conventions, CSS custom properties |
| [bundlers-webpack-vite-turbopack.md](web/fundamentals/bundlers-webpack-vite-turbopack.md) | Webpack, Vite, Turbopack — configuration, optimization, migration |
| [code-splitting.md](web/fundamentals/code-splitting.md) | Route-based, component-based, dynamic imports, lazy loading |
| [tree-shaking.md](web/fundamentals/tree-shaking.md) | Dead code elimination, sideEffects, ESM, bundle analysis |

---

### Web — Rendering Strategies (Deep Dives)
Individual deep dives into specific rendering approaches.

| Guide | Description |
|-------|-------------|
| [csr-client-side.md](web/rendering-strategies/csr-client-side.md) | Client-side rendering patterns, SPA architecture, hydration |
| [ssr-server-side.md](web/rendering-strategies/ssr-server-side.md) | Server-side rendering, streaming, edge rendering |
| [ssg-static-generation.md](web/rendering-strategies/ssg-static-generation.md) | Static site generation, incremental static regeneration |

---

### Web — Component Design
Patterns for building reusable, accessible UI components.

| Guide | Description |
|-------|-------------|
| [accessibility.md](web/component-design/accessibility.md) | WCAG 2.2, ARIA patterns, keyboard navigation, screen readers, axe testing |
| [atomic-design.md](web/component-design/atomic-design.md) | Atoms → Molecules → Organisms → Templates → Pages methodology |
| [compound-components.md](web/component-design/compound-components.md) | Compound components pattern (Select, Tabs, Accordion) with shared state |
| [render-props-hoc.md](web/component-design/render-props-hoc.md) | Render props, HOCs, headless components — behavior extraction patterns |

---

### Web — Frameworks
Framework-specific guides and master comparison.

| Guide | Description |
|-------|-------------|
| [framework-comparison.md](web/frameworks/framework-comparison.md) | React vs Vue vs Angular vs Svelte — decision matrix and benchmarks |

#### React
| Guide | Description |
|-------|-------------|
| [overview.md](web/frameworks/react/overview.md) | React 19, JSX, component model, lifecycle, ecosystem |
| [hooks-patterns.md](web/frameworks/react/hooks-patterns.md) | useState, useEffect, useRef, custom hooks, rules of hooks |
| [server-components.md](web/frameworks/react/server-components.md) | RSC architecture, Server Actions, client/server boundaries |
| [performance.md](web/frameworks/react/performance.md) | React.memo, useMemo, useCallback, Suspense, concurrent features |
| [state-management.md](web/frameworks/react/state-management.md) | Context, Zustand, Jotai, Redux Toolkit, TanStack Query |

#### Vue
| Guide | Description |
|-------|-------------|
| [overview.md](web/frameworks/vue/overview.md) | Vue 3, SFC, template syntax, reactivity system, ecosystem |
| [composition-api.md](web/frameworks/vue/composition-api.md) | ref, reactive, computed, watch, composables, script setup |
| [performance.md](web/frameworks/vue/performance.md) | Virtual DOM optimizations, v-once, KeepAlive, async components |

#### Angular
| Guide | Description |
|-------|-------------|
| [overview.md](web/frameworks/angular/overview.md) | Angular 17+, signals, standalone components, control flow |
| [modules-and-di.md](web/frameworks/angular/modules-and-di.md) | Dependency injection, providers, modules, standalone migration |
| [performance.md](web/frameworks/angular/performance.md) | OnPush, signals, zoneless, lazy loading, trackBy |

#### Svelte
| Guide | Description |
|-------|-------------|
| [overview.md](web/frameworks/svelte/overview.md) | Svelte 5, runes ($state, $derived, $effect), compiler approach |
| [performance.md](web/frameworks/svelte/performance.md) | Compile-time optimizations, fine-grained reactivity, bundle size |

---

### Web — State Management
Patterns and libraries for managing application state.

| Guide | Description |
|-------|-------------|
| [local-vs-global.md](web/state-management/local-vs-global.md) | When to use local vs global state, state colocation |
| [patterns.md](web/state-management/patterns.md) | Flux, atomic, proxy, signal — state management paradigms |
| [redux-zustand-jotai.md](web/state-management/redux-zustand-jotai.md) | Redux Toolkit, Zustand, Jotai — comparison and patterns |
| [server-state-tanstack-swr.md](web/state-management/server-state-tanstack-swr.md) | TanStack Query, SWR — server state caching and synchronization |

---

### Web — Performance
Measuring and optimizing frontend performance.

| Guide | Description |
|-------|-------------|
| [core-web-vitals.md](web/performance/core-web-vitals.md) | LCP, INP, CLS — measurement, targets, optimization strategies |
| [image-optimization.md](web/performance/image-optimization.md) | Formats (WebP, AVIF), responsive images, lazy loading, CDN |
| [font-loading.md](web/performance/font-loading.md) | font-display, preload, subsetting, variable fonts, FOUT/FOIT |
| [runtime-performance.md](web/performance/runtime-performance.md) | Long tasks, main thread, Web Workers, virtualization, debounce |

---

### Web — Data Fetching
Strategies for loading, caching, and synchronizing data.

| Guide | Description |
|-------|-------------|
| [rest-graphql-trpc.md](web/data-fetching/rest-graphql-trpc.md) | REST, GraphQL, tRPC — comparison, patterns, when to use each |
| [caching-strategies.md](web/data-fetching/caching-strategies.md) | HTTP cache, stale-while-revalidate, TanStack Query, service workers |
| [real-time-websockets-sse.md](web/data-fetching/real-time-websockets-sse.md) | WebSockets, Server-Sent Events, polling — real-time patterns |

---

### Web — Testing
Frontend testing strategies from unit to visual regression.

| Guide | Description |
|-------|-------------|
| [unit-testing.md](web/testing/unit-testing.md) | Vitest, Testing Library, mocking, coverage, test patterns |
| [integration-e2e.md](web/testing/integration-e2e.md) | Playwright, Cypress — E2E testing, CI integration, flaky tests |
| [component-testing.md](web/testing/component-testing.md) | Component testing with Testing Library, Storybook play functions |
| [visual-regression.md](web/testing/visual-regression.md) | Chromatic, Percy, screenshot comparison, visual review workflow |

---

### Web — Forms & Validation
Form architecture and validation strategies.

| Guide | Description |
|-------|-------------|
| [form-architecture.md](web/forms-validation/form-architecture.md) | React Hook Form, Formik, controlled vs uncontrolled, multi-step forms |
| [validation-strategies.md](web/forms-validation/validation-strategies.md) | Zod, Yup, server-side validation, error display patterns |

---

### Web — Security
Frontend security patterns and hardening.

| Guide | Description |
|-------|-------------|
| [xss-prevention.md](web/security/xss-prevention.md) | XSS vectors, sanitization, DOMPurify, framework protections |
| [auth-patterns.md](web/security/auth-patterns.md) | JWT, sessions, OAuth, PKCE, token storage, refresh patterns |
| [csp-headers.md](web/security/csp-headers.md) | Content Security Policy, security headers, CORS, HTTPS |

---

### Web — Error Handling
Error boundaries, monitoring, and logging.

| Guide | Description |
|-------|-------------|
| [error-boundaries.md](web/error-handling/error-boundaries.md) | React error boundaries, fallback UI, error recovery, retry |
| [monitoring-logging.md](web/error-handling/monitoring-logging.md) | Sentry, LogRocket, structured logging, error tracking |

---

### Web — Internationalization
Multi-language and locale support.

| Guide | Description |
|-------|-------------|
| [internationalization.md](web/i18n/internationalization.md) | i18next, react-intl, ICU format, RTL support, locale detection |

---

### Web — Animation
Motion design and animation patterns.

| Guide | Description |
|-------|-------------|
| [animation-patterns.md](web/animation/animation-patterns.md) | Framer Motion, CSS transitions, FLIP, reduced motion, performance |

---

### Web — Micro-Frontends
Splitting frontends into independently deployable units.

| Guide | Description |
|-------|-------------|
| [micro-frontend-architecture.md](web/micro-frontends/micro-frontend-architecture.md) | Module Federation, single-spa, iframe, web components |

---

### Mobile — Cross-Platform
Framework comparison and deep dives for cross-platform mobile development.

| Guide | Description |
|-------|-------------|
| [native-vs-cross-platform.md](mobile/cross-platform/native-vs-cross-platform.md) | Decision framework: native vs React Native vs Flutter vs KMP |
| [react-native-deep-dive.md](mobile/cross-platform/react-native-deep-dive.md) | New Architecture (Fabric + JSI), Expo, navigation, performance |
| [flutter-deep-dive.md](mobile/cross-platform/flutter-deep-dive.md) | Widget tree, Riverpod, GoRouter, Dart FFI, platform channels |
| [kotlin-multiplatform.md](mobile/cross-platform/kotlin-multiplatform.md) | KMP architecture, expect/actual, Ktor, SQLDelight, Compose MP |

---

### Mobile — Native iOS
iOS-specific patterns and architecture.

| Guide | Description |
|-------|-------------|
| [swiftui-patterns.md](mobile/native-ios/swiftui-patterns.md) | @Observable, NavigationStack, MVVM, previews, performance |
| [uikit-patterns.md](mobile/native-ios/uikit-patterns.md) | MVVM-C, Coordinator, CompositionalLayout, DiffableDataSource |
| [app-lifecycle.md](mobile/native-ios/app-lifecycle.md) | App states, SceneDelegate, BGTaskScheduler, deep linking |

---

### Mobile — Native Android
Android-specific patterns and architecture.

| Guide | Description |
|-------|-------------|
| [jetpack-compose.md](mobile/native-android/jetpack-compose.md) | UDF, remember, side effects, Navigation Compose, Material 3 |
| [architecture-components.md](mobile/native-android/architecture-components.md) | ViewModel, Hilt DI, Room, DataStore, WorkManager, Repository |
| [app-lifecycle.md](mobile/native-android/app-lifecycle.md) | Activity lifecycle, Compose lifecycle, process death, permissions |

---

### Mobile — General
Cross-cutting mobile topics.

| Guide | Description |
|-------|-------------|
| [offline-first.md](mobile/offline-first.md) | Sync queues, conflict resolution, optimistic UI, background sync |
| [push-notifications.md](mobile/push-notifications.md) | FCM, APNs, Expo Notifications, channels, permissions, rich notifs |
| [app-store-optimization.md](mobile/app-store-optimization.md) | ASO, keyword research, in-app review API, screenshots, A/B testing |

---

### Desktop
Desktop application development approaches.

| Guide | Description |
|-------|-------------|
| [electron-deep-dive.md](desktop/electron-deep-dive.md) | Main/renderer processes, contextBridge, auto-update, security |
| [tauri-deep-dive.md](desktop/tauri-deep-dive.md) | Rust backend, system webview, commands, permissions, plugins |
| [progressive-web-apps.md](desktop/progressive-web-apps.md) | Service workers, Workbox, caching strategies, install prompt |
| [native-desktop-options.md](desktop/native-desktop-options.md) | Decision tree: Tauri vs Electron vs Qt vs SwiftUI vs .NET MAUI |

---

### Design Systems
Building, documenting, and maintaining design systems.

| Guide | Description |
|-------|-------------|
| [building-a-design-system.md](design-systems/building-a-design-system.md) | Architecture (tokens → primitives → composites), CVA, monorepo, adoption |
| [component-libraries.md](design-systems/component-libraries.md) | shadcn/ui, Radix, MUI, Mantine — selection guide, headless vs styled |
| [design-tokens.md](design-systems/design-tokens.md) | 3-tier tokens, Style Dictionary, W3C format, Figma sync, dark mode |
| [documentation.md](design-systems/documentation.md) | Storybook setup, stories, MDX guidelines, Chromatic, changelog |

---

## How This Section Connects

```
  05-FRONTEND IN THE KNOWLEDGE BASE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  04-project-structure/                               │
  │  └── Web/mobile/desktop project structures           │
  │      (HOW to organize files and folders)             │
  │          │                                           │
  │          ▼                                           │
  │  05-frontend/ ← YOU ARE HERE                         │
  │  └── Frontend implementation patterns                │
  │      (HOW to build UIs, choose frameworks,           │
  │       manage state, test, optimize)                  │
  │          │                                           │
  │          ▼                                           │
  │  06-backend/                                         │
  │  └── API design, databases, server patterns          │
  │      (the other half of the stack)                   │
  │                                                      │
  │  Cross-references:                                   │
  │  • Rendering strategies → 04 Next.js/Remix structure │
  │  • Data fetching → 06 API design                     │
  │  • Design tokens → 04 design system monorepo         │
  │  • Mobile → 04 React Native/Flutter structure        │
  │  • Desktop → 04 Electron/Tauri structure             │
  │  • Testing → 04 test directory structure             │
  │  • Security → 06 auth/API security                   │
  └──────────────────────────────────────────────────────┘
```
