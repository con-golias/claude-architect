# Cross-Platform vs Native Decisions

> **AI Plugin Directive:** When the user needs to decide between native and cross-platform mobile development, ALWAYS consult this guide. Use the decision trees, shared code strategies, and progressive complexity model to recommend the right approach. Consider team composition, platform API needs, UI requirements, performance targets, and long-term maintenance. Cross-reference with mobile-comparison-guide.md for framework-specific benchmarks.

**Core Rule: Choose native when platform-specific UX is critical or when team expertise is single-platform. Choose cross-platform when sharing code reduces cost significantly and platform-specific features are limited. ALWAYS plan an escape hatch -- never lock into a framework without a migration path.**

---

## 1. Master Decision Tree

```
START: Native vs Cross-Platform?
│
├── Q1: How many platforms do you need?
│   ├── 1 platform only
│   │   ├── iOS ──→ Swift/SwiftUI ✓ (STOP)
│   │   └── Android ──→ Kotlin/Compose ✓ (STOP)
│   │
│   ├── 2 platforms (iOS + Android)
│   │   └── continue to Q2
│   │
│   └── 3+ platforms (mobile + web + desktop)
│       ├── Flutter (web + desktop targets) ✓
│       ├── React Native + React (shared logic via monorepo)
│       └── KMP + Compose Multiplatform (Android, iOS, Desktop, Web)
│
├── Q2: What does your team know?
│   ├── JavaScript/TypeScript + React
│   │   └── React Native (Expo) ──→ fastest path ✓
│   ├── Dart
│   │   └── Flutter ✓
│   ├── Kotlin (Android devs)
│   │   ├── Need shared logic only ──→ KMP ✓
│   │   └── Need shared UI too ──→ KMP + Compose Multiplatform ✓
│   ├── Swift + Kotlin (separate platform teams)
│   │   ├── Want to start sharing ──→ KMP for shared logic ✓
│   │   └── Happy with separate ──→ stay native ✓
│   └── No mobile experience
│       ├── Web background ──→ React Native (Expo) ✓
│       └── Backend background ──→ Flutter (fresh start) ✓
│
├── Q3: What native APIs do you need?
│   ├── Heavy native integration
│   │   ├── Camera/AR (ARKit/ARCore) ──→ Native ✓
│   │   ├── Bluetooth LE (complex) ──→ Native ✓
│   │   ├── HealthKit/Health Connect ──→ Native or KMP ✓
│   │   ├── NFC (advanced) ──→ Native ✓
│   │   ├── Background processing (complex) ──→ Native ✓
│   │   └── Custom audio/video pipeline ──→ Native ✓
│   │
│   ├── Standard native APIs
│   │   ├── Camera (photo/video) ──→ any framework (expo-camera, image_picker)
│   │   ├── GPS/Location ──→ any framework
│   │   ├── Push notifications ──→ any framework
│   │   ├── Biometrics (Face/Touch ID) ──→ any framework
│   │   ├── File storage ──→ any framework
│   │   └── Keychain/Keystore ──→ any framework
│   │
│   └── Minimal native APIs (HTTP + UI)
│       └── React Native or Flutter ✓
│
├── Q4: What is your performance ceiling?
│   ├── GPU-intensive (3D, video processing, AR)
│   │   └── Native (Metal/Vulkan direct) ✓
│   │
│   ├── 120fps animations (ProMotion/high refresh)
│   │   ├── Native ✓
│   │   └── Flutter (Impeller) ✓ (close to native)
│   │
│   ├── 60fps smooth scrolling + standard animations
│   │   └── Any framework works ✓
│   │
│   └── Mostly static content / forms
│       └── React Native (Expo) ✓ (fastest to build)
│
├── Q5: What is your UI philosophy?
│   ├── Must look identical on both platforms
│   │   ├── Brand-first design (custom design system) ──→ Flutter ✓
│   │   └── Shared component library ──→ React Native + NativeWind ✓
│   │
│   ├── Must look native per platform
│   │   ├── SwiftUI on iOS, Compose on Android ──→ Native or KMP ✓
│   │   └── Adaptive components ──→ Flutter (Cupertino + Material) or RN
│   │
│   └── Mix (custom design, minor platform tweaks)
│       └── React Native ✓ or Flutter ✓
│
└── Q6: What is your timeline and budget?
    ├── MVP in <3 months (startup)
    │   └── React Native (Expo) ✓ or Flutter ✓
    │
    ├── 6-12 months (normal product)
    │   └── Any framework based on Q2-Q5
    │
    └── Long-term (3+ year product)
        ├── Large team available ──→ consider native for long-term flexibility
        ├── Small team ──→ cross-platform for cost efficiency
        └── Existing native codebase ──→ KMP to incrementally share logic
```

---

## 2. Shared Code Strategies

### 2.1 Strategy Comparison

| Strategy | Code Sharing | UI Approach | Best For | Risk |
|----------|-------------|-------------|----------|------|
| **Full cross-platform** (Flutter/RN) | 80-98% | Shared UI | Small teams, standard apps | Platform UX gaps |
| **Shared logic only** (KMP) | 50-70% | Native UI per platform | Existing native teams | More code to maintain |
| **Shared logic + shared UI** (KMP+CMP) | 70-85% | Compose Multiplatform | Kotlin teams wanting more sharing | iOS Compose maturity |
| **Shared backend logic** (monorepo) | 20-40% | Separate native UI | Teams sharing API/models only | Coordination overhead |
| **Fully native** (separate) | 0% | Native per platform | Max platform fidelity | Highest cost |

### 2.2 What to Share vs What to Keep Native

```
SHARE (cross-platform):                    KEEP NATIVE (per platform):
┌─────────────────────────────┐            ┌─────────────────────────────┐
│ Business logic              │            │ Complex animations          │
│ Data models / DTOs          │            │ Platform-specific gestures  │
│ API client / networking     │            │ ARKit / ARCore              │
│ Validation rules            │            │ HealthKit / Health Connect  │
│ Authentication flow         │            │ Bluetooth LE (advanced)     │
│ State management            │            │ Home screen widgets         │
│ Caching / persistence logic │            │ Watch / TV apps             │
│ Analytics events            │            │ Custom camera pipelines     │
│ Feature flags               │            │ App extensions / intents    │
│ Push notification handling  │            │ Background audio            │
│ Date/time utilities         │            │ CallKit / ConnectionService │
│ Localization strings        │            │ NFC (advanced operations)   │
│ Error types                 │            │ Platform-specific a11y      │
└─────────────────────────────┘            └─────────────────────────────┘
```

### 2.3 Shared Code Architecture Patterns

```
Pattern 1: FULL CROSS-PLATFORM (Flutter / React Native)
┌─────────────────────────────────────────────┐
│              Shared Codebase                │
│  ┌─────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ UI/Views│ │ Business │ │ Data Layer  │  │
│  │ (shared)│ │  Logic   │ │ (networking,│  │
│  │         │ │ (shared) │ │  storage)   │  │
│  └─────────┘ └──────────┘ └─────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ Native Modules / Platform Channels  │   │
│  │ (bridge to platform APIs)           │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
       │                          │
  ┌────▼────┐               ┌────▼────┐
  │   iOS   │               │ Android │
  │ Runtime │               │ Runtime │
  └─────────┘               └─────────┘

Pattern 2: SHARED LOGIC (KMP)
┌─────────────────────────────────────────────┐
│           Shared Module (Kotlin)            │
│  ┌──────────┐  ┌──────────┐ ┌───────────┐  │
│  │ Business │  │ Data     │ │ Models    │  │
│  │ Logic    │  │ (Ktor,   │ │ (DTOs,    │  │
│  │          │  │  SQLDel) │ │  entities)│  │
│  └──────────┘  └──────────┘ └───────────┘  │
└───────────┬─────────────────────┬───────────┘
            │                     │
  ┌─────────▼─────────┐  ┌──────▼──────────┐
  │   iOS App         │  │  Android App    │
  │  ┌─────────────┐  │  │ ┌─────────────┐ │
  │  │ SwiftUI     │  │  │ │ Compose UI  │ │
  │  │ (native UI) │  │  │ │ (native UI) │ │
  │  └─────────────┘  │  │ └─────────────┘ │
  └───────────────────┘  └─────────────────┘

Pattern 3: MONOREPO WITH SHARED PACKAGES
┌──────────────────────────────────────────────────┐
│                    Monorepo                       │
│                                                   │
│  packages/                                        │
│  ├── shared-types/     # TypeScript types/models  │
│  ├── shared-api/       # API client + validation  │
│  ├── shared-utils/     # Date, format, crypto     │
│  │                                                │
│  apps/                                            │
│  ├── mobile/           # React Native app         │
│  ├── web/              # Next.js / React app      │
│  └── backend/          # Node.js API              │
└──────────────────────────────────────────────────┘
```

---

## 3. Platform-Specific UI vs Shared UI

### 3.1 Decision Matrix

| Factor | Shared UI | Platform-Specific UI |
|--------|----------|---------------------|
| **Development cost** | 1x (write once) | 1.5-2x (write per platform) |
| **Brand consistency** | Excellent (identical everywhere) | Requires design system |
| **Platform feel** | Custom (may feel foreign) | Native (feels right) |
| **OS version adaptation** | Manual (track both platforms) | Automatic |
| **User expectations** | Works for brand-first apps | Required for platform-first apps |
| **Maintenance** | Lower (single codebase) | Higher (multiple implementations) |
| **Accessibility** | Must implement per platform patterns | Gets platform a11y for free |
| **Animation** | Shared animation system | Platform-native transitions |

### 3.2 When to Choose Each

```
SHARED UI (Flutter widgets, React Native components):
├── Brand-first design (custom design system, not platform standard)
├── Content/media apps (feeds, cards, lists)
├── E-commerce (product browsing, checkout)
├── Enterprise tools (dashboards, forms, reports)
├── Social apps (feeds, messaging, profiles)
└── Games / entertainment companions

PLATFORM-SPECIFIC UI (SwiftUI + Compose, or KMP with native UI):
├── Banking / fintech (trust + platform conventions)
├── Health / medical (must match platform expectations)
├── Settings-heavy apps (match OS Settings pattern)
├── Accessibility-critical apps (leverage platform a11y)
├── Apple ecosystem apps (Watch, widgets, Shortcuts)
└── Google ecosystem apps (Wear, tiles, widgets)

HYBRID (shared + platform-specific):
├── Shared: Business screens (lists, details, forms)
├── Native: Platform-specific screens (settings, onboarding)
├── Shared: Design tokens (colors, spacing, typography)
└── Native: Navigation chrome (tab bars, nav bars)
```

---

## 4. Navigation Patterns Comparison

### 4.1 Pattern Matrix

| Pattern | iOS Convention | Android Convention | React Native | Flutter |
|---------|---------------|-------------------|-------------|---------|
| **Stack (push/pop)** | NavigationStack | NavController | Stack Navigator / Expo Router Stack | GoRouter / Navigator 2.0 |
| **Tabs** | UITabBarController (bottom) | BottomNavigationView | Bottom Tabs / Expo Router (tabs) | BottomNavigationBar + GoRouter ShellRoute |
| **Drawer** | Less common | NavigationDrawer | Drawer Navigator | Drawer widget |
| **Modal** | Sheet / fullScreenCover | BottomSheet / Dialog | Modal Stack | showModalBottomSheet / Dialog |
| **Deep linking** | Universal Links | App Links | Expo Router (auto) | GoRouter (path-based) |
| **Back behavior** | Swipe from left edge | System back button | Platform-aware | WillPopScope / PopScope |

### 4.2 Navigation Architecture

```
iOS Pattern (standard):
┌────────────────────────────┐
│      UITabBarController    │
│  ┌──────┐ ┌──────┐ ┌────┐ │
│  │ Nav  │ │ Nav  │ │Nav │ │
│  │Stack │ │Stack │ │Stk │ │
│  │  │   │ │  │   │ │ │  │ │
│  │ Home │ │Search│ │Prof│ │
│  │  │   │ │  │   │ │    │ │
│  │Detail│ │Result│ │    │ │
│  └──────┘ └──────┘ └────┘ │
└────────────────────────────┘

Android Pattern (standard):
┌──────────────────────────────┐
│    Scaffold + NavController  │
│  ┌────────────────────────┐  │
│  │     Content Area       │  │
│  │  ┌──────────────────┐  │  │
│  │  │  NavHost (graph)  │  │  │
│  │  │  Home → Detail    │  │  │
│  │  │  Search → Result  │  │  │
│  │  └──────────────────┘  │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │  BottomNavigation      │  │
│  └────────────────────────┘  │
└──────────────────────────────┘

Expo Router Pattern:
app/
├── _layout.tsx              # Root (Stack)
├── (auth)/                  # Group: no tabs
│   ├── _layout.tsx          # Stack layout
│   ├── login.tsx
│   └── register.tsx
├── (tabs)/                  # Group: with tabs
│   ├── _layout.tsx          # Tab layout
│   ├── index.tsx            # Tab 1: Home
│   ├── search.tsx           # Tab 2: Search
│   └── profile.tsx          # Tab 3: Profile
├── users/
│   ├── index.tsx            # /users (list)
│   └── [id].tsx             # /users/:id (detail)
└── +not-found.tsx           # 404
```

---

## 5. State Management Comparison Across Platforms

### 5.1 Categories

```
STATE TYPES:
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Server State (API data, cached responses)              │
│  ├── React Native: TanStack Query                       │
│  ├── Flutter: Riverpod FutureProvider / BLoC            │
│  ├── iOS: async/await + ObservableObject                │
│  ├── Android: StateFlow + Repository pattern            │
│  └── KMP: StateFlow (shared) + platform consumption     │
│                                                         │
│  Client State (UI state, preferences, auth)             │
│  ├── React Native: Zustand / Jotai                      │
│  ├── Flutter: Riverpod StateNotifier / ValueNotifier    │
│  ├── iOS: @Observable / @State / @Binding               │
│  ├── Android: MutableStateFlow / compose mutableStateOf │
│  └── KMP: StateFlow (shared) + expect/actual for store  │
│                                                         │
│  Local State (component-level, ephemeral)               │
│  ├── React Native: useState / useReducer                │
│  ├── Flutter: StatefulWidget setState                   │
│  ├── iOS: @State (SwiftUI)                              │
│  ├── Android: remember { mutableStateOf() }             │
│  └── KMP: Platform-specific UI state                    │
│                                                         │
│  Navigation State (current route, params, history)      │
│  ├── React Native: Expo Router (automatic)              │
│  ├── Flutter: GoRouter state                            │
│  ├── iOS: NavigationPath                                │
│  ├── Android: NavController backstack                   │
│  └── KMP: Decompose / shared nav state                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.2 State Solution Comparison

| Criterion | Zustand (RN) | Riverpod (Flutter) | @Observable (iOS) | StateFlow (Android/KMP) |
|-----------|-------------|-------------------|-------------------|------------------------|
| Boilerplate | Minimal | Low-Medium | Minimal | Medium |
| Type safety | TypeScript | Full (Dart) | Full (Swift) | Full (Kotlin) |
| DevTools | React DevTools | Riverpod DevTools | Xcode debugger | Android Profiler |
| Persistence | zustand/persist | shared_preferences | UserDefaults | DataStore |
| Testability | Easy (mock store) | Excellent (overrides) | Good (DI) | Excellent (test dispatchers) |
| Bundle size | ~2KB | ~50KB (with flutter) | 0 (built-in) | 0 (kotlinx.coroutines) |
| Learning curve | Low | Medium | Low | Medium |
| Server state | Use TanStack Query | Riverpod providers | async/await patterns | Flow + Repository |

---

## 6. CI/CD Differences

### 6.1 Pipeline Comparison

```
REACT NATIVE (EXPO) CI/CD:
┌────────────────────────────────────────────┐
│ 1. Push to main                            │
│ 2. GitHub Actions: lint + typecheck + test  │
│ 3. EAS Build (cloud): iOS + Android        │
│ 4. EAS Submit: TestFlight + Play Internal  │
│ 5. Manual review + promote                 │
│ 6. EAS Update: OTA patches (no store)      │
│                                            │
│ Unique: OTA updates bypass app stores      │
│ Unique: Cloud builds (no macOS CI needed)  │
└────────────────────────────────────────────┘

FLUTTER CI/CD:
┌────────────────────────────────────────────┐
│ 1. Push to main                            │
│ 2. GitHub Actions: analyze + test          │
│ 3. Codemagic / Bitrise: iOS + Android      │
│ 4. Distribute: TestFlight + Play Internal  │
│ 5. Manual review + promote                 │
│ 6. Shorebird: OTA patches (newer option)   │
│                                            │
│ Unique: `flutter analyze` catches more     │
│ Unique: Golden image testing in CI         │
└────────────────────────────────────────────┘

NATIVE iOS CI/CD:
┌────────────────────────────────────────────┐
│ 1. Push to main                            │
│ 2. Xcode Cloud / Bitrise (macOS required)  │
│ 3. Build + unit test + UI test             │
│ 4. Archive + sign + TestFlight upload      │
│ 5. TestFlight review + external testing    │
│ 6. App Store submission                    │
│                                            │
│ Unique: Requires macOS runners             │
│ Unique: Xcode Cloud integrates with ASC    │
└────────────────────────────────────────────┘

NATIVE ANDROID CI/CD:
┌────────────────────────────────────────────┐
│ 1. Push to main                            │
│ 2. GitHub Actions (Linux runners OK)       │
│ 3. Gradle build + unit test + lint         │
│ 4. Sign APK/AAB                            │
│ 5. Upload to Play Console (internal track) │
│ 6. Promote through tracks                  │
│                                            │
│ Unique: Linux CI works (no macOS needed)   │
│ Unique: Play Console managed signing       │
└────────────────────────────────────────────┘

KMP CI/CD:
┌────────────────────────────────────────────┐
│ 1. Push to main                            │
│ 2. GitHub Actions: shared module tests     │
│ 3. Build Android (Linux) + iOS (macOS)     │
│ 4. Platform-specific test suites           │
│ 5. Platform-specific distribution          │
│                                            │
│ Unique: Needs macOS + Linux runners        │
│ Unique: Shared module tested independently │
└────────────────────────────────────────────┘
```

### 6.2 CI/CD Tool Matrix

| Tool | React Native | Flutter | iOS Native | Android Native | KMP |
|------|-------------|---------|-----------|---------------|-----|
| **EAS Build** | Primary | N/A | N/A | N/A | N/A |
| **Codemagic** | Supported | Primary | Supported | Supported | Supported |
| **Bitrise** | Supported | Supported | Primary | Primary | Supported |
| **Xcode Cloud** | N/A | N/A | Excellent | N/A | iOS builds only |
| **GitHub Actions** | Supported | Supported | macOS runners | Linux runners | Both needed |
| **Fastlane** | match + deliver | Supported | Primary | Primary | Per platform |
| **App Center** | Supported | Supported | Supported | Supported | Per platform |

---

## 7. Testing Strategy Differences

### 7.1 Testing Pyramid Per Framework

```
REACT NATIVE:                    FLUTTER:
         /\                              /\
        /  \  E2E                       /  \  E2E
       / Det\  (Detox/Maestro)         /Inte\  (integration_test)
      /  ox   \                       /gration\
     /─────────\                     /──────────\
    /  Component \                  /   Widget    \
   / RNTL + Jest  \               /  WidgetTester  \
  /────────────────\             /──────────────────\
 /    Unit Tests    \           /    Unit Tests      \
/   Jest + ts-jest   \         /   flutter_test       \
─────────────────────          ────────────────────────

iOS NATIVE:                      ANDROID NATIVE:
         /\                              /\
        /  \  E2E                       /  \  E2E
       /XCUI\  (XCUITest)             /Espr\  (Espresso)
      / Test  \                       /esso  \
     /─────────\                     /─────────\
    /  UI Tests  \                  / Compose UI \
   / ViewInspect  \               /   Test Rules  \
  /────────────────\             /──────────────────\
 /    Unit Tests    \           /    Unit Tests      \
/    XCTest/Quick    \         /   JUnit5 + MockK     \
─────────────────────          ────────────────────────
```

### 7.2 Testing Tool Matrix

| Test Level | React Native | Flutter | iOS | Android | KMP |
|-----------|-------------|---------|-----|---------|-----|
| **Unit** | Jest | flutter_test | XCTest | JUnit5 + MockK | kotlin.test |
| **Mocking** | jest.mock / MSW | mocktail / mockito | Protocol mocks | MockK | MockK / Mockative |
| **Component/Widget** | RNTL | WidgetTester | ViewInspector | Compose Test | Platform-specific |
| **Snapshot** | react-native-owl | golden_toolkit | swift-snapshot-testing | Paparazzi | N/A |
| **Integration** | Detox | integration_test | XCUITest | Espresso | Platform tests |
| **E2E** | Maestro | Maestro / Patrol | Maestro | Maestro | Maestro |
| **API mocking** | MSW / nock | http_mock_adapter | URLProtocol | MockWebServer | Ktor MockEngine |
| **Coverage** | Jest --coverage | flutter test --coverage | Xcode (llvm-cov) | JaCoCo | Kover |
| **Performance** | Flashlight | DevTools Timeline | Instruments | Macrobenchmark | Platform tools |

---

## 8. Performance Profiling Tools Per Platform

| Category | React Native | Flutter | iOS Native | Android Native |
|----------|-------------|---------|-----------|---------------|
| **CPU** | Hermes Profiler, Flipper | DevTools CPU Profiler | Instruments Time Profiler | Android Profiler CPU |
| **Memory** | Flipper Memory Plugin | DevTools Memory | Instruments Allocations | Android Profiler Memory |
| **Network** | Flipper Network | DevTools Network | Instruments Network | Network Inspector |
| **Rendering** | Performance Monitor overlay | DevTools Performance | Core Animation instrument | GPU Rendering Profile |
| **Frame drops** | `__DEV__` perf monitor | DevTools Jank detection | Core Animation FPS | GPU Overdraw overlay |
| **Bundle size** | `react-native-bundle-visualizer` | `--analyze-size` flag | Xcode App Thinning | APK Analyzer |
| **Startup** | `react-native-startup-trace` | `--trace-startup` | Instruments App Launch | Macrobenchmark |
| **Battery** | Platform tools | Platform tools | Energy Diagnostics | Battery Historian |
| **Layout** | React DevTools | Widget Inspector | Xcode View Debugger | Layout Inspector |

---

## 9. Progressive Complexity Model

### 9.1 Start Cross-Platform, Extract Native

```
PHASE 1: MVP (Month 1-6)
┌──────────────────────────────────────────┐
│ 100% Cross-Platform (Expo / Flutter)     │
│                                          │
│ - All screens shared                     │
│ - Standard APIs (camera, GPS, push)      │
│ - Expo SDK modules / Flutter plugins     │
│ - Ship fast, validate product-market fit │
└──────────────────────────────────────────┘
              │
              ▼ Product validated, need platform features
PHASE 2: SELECTIVE NATIVE (Month 6-12)
┌──────────────────────────────────────────┐
│ 85% Cross-Platform + 15% Native Modules  │
│                                          │
│ Shared: Business logic, most UI, nav     │
│ Native: Bluetooth module, ARKit screen,  │
│         custom camera, widgets           │
│                                          │
│ RN: Turbo Modules for native code        │
│ Flutter: Platform channels + method ch.  │
└──────────────────────────────────────────┘
              │
              ▼ Platform UX becoming a differentiator
PHASE 3: HYBRID (Month 12-24)
┌──────────────────────────────────────────┐
│ 70% Cross-Platform + 30% Native          │
│                                          │
│ Shared: Business logic, data layer, auth │
│ Native: Key UX screens, platform         │
│         features, performance-critical   │
│                                          │
│ Consider: Migrate to KMP for shared      │
│ logic if extracting more native screens  │
└──────────────────────────────────────────┘
              │
              ▼ (If needed) Full platform control required
PHASE 4: SHARED LOGIC ONLY (Month 24+)
┌──────────────────────────────────────────┐
│ KMP Shared Logic + Native UI             │
│                                          │
│ Shared: Business logic, networking, DB,  │
│         models, validation               │
│ Native: All UI (SwiftUI + Compose)       │
│                                          │
│ Maximum platform fidelity with shared    │
│ business logic                           │
└──────────────────────────────────────────┘
```

### 9.2 When to Extract to Native

| Signal | Action |
|--------|--------|
| Platform feature blocked by framework | Write native module, keep rest cross-platform |
| Performance issue in specific screen | Profile first; if framework-limited, extract screen |
| Platform UX expectations not met | Extract that screen to native UI |
| Framework upgrade breaking changes | Evaluate if migration cost > native rewrite cost |
| Team growing with platform specialists | Let them own native modules/screens |
| App Store rejection (platform guidelines) | Fix the specific UI to match platform conventions |

### 9.3 Reverse: Native to Cross-Platform

```
NATIVE → SHARED LOGIC:
1. Identify duplicated business logic (auth, API, validation, models)
2. Create KMP shared module
3. Expose shared logic to both platforms via:
   - Android: Direct Kotlin consumption
   - iOS: Kotlin/Native framework (Swift-friendly API)
4. Gradually move more logic to shared module
5. Keep ALL UI native (SwiftUI + Compose)
6. Test shared module in commonTest

NATIVE → CROSS-PLATFORM SCREENS:
1. Identify screens that are identical across platforms
2. Introduce Flutter module (add-to-app) or RN screen
3. Hybrid: Some screens native, some cross-platform
4. Flutter: FlutterViewController / FlutterActivity
5. RN: RCTRootView / ReactActivity for specific screens
6. Gradually migrate simple screens, keep complex ones native
```

---

## 10. Comparison Matrix (Extended)

| Factor | Native iOS | Native Android | React Native | Flutter | KMP |
|--------|-----------|---------------|-------------|---------|-----|
| **Language** | Swift | Kotlin | TypeScript | Dart | Kotlin |
| **UI Framework** | SwiftUI/UIKit | Compose/XML | React (Fabric) | Flutter Widgets | Compose MP / Native |
| **Code sharing** | 0% | 0% | 80-95% | 90-98% | 50-85% |
| **Performance** | Best | Best | Near-native | Near-native | Native |
| **Platform UX** | Perfect | Perfect | Good | Custom (consistent) | Native per platform |
| **Hot reload** | Previews | Previews | Fast Refresh (<1s) | Hot Reload (<1s) | N/A |
| **Learning curve** | Medium | Medium | Low (web devs) | Medium | Medium (Kotlin devs) |
| **Team size needed** | 2x | 2x | 1x | 1x | 1.5x |
| **Ecosystem** | Apple SDKs | Google SDKs | npm + native modules | pub.dev | Maven + platform |
| **Enterprise adoption** | Very high | Very high | High | Growing | Growing |
| **New OS feature lag** | 0 days | 0 days | Weeks-months | Weeks-months | 0 days (native) |
| **OTA updates** | No | No | Yes (EAS Update) | Yes (Shorebird) | No |
| **Web support** | No | No | Expo Web (limited) | Flutter Web | Kotlin/JS |
| **Desktop support** | macOS (native) | No | Expo (experimental) | Windows/macOS/Linux | Compose Desktop |
| **Offline support** | Core Data, SwiftData | Room | WatermelonDB, MMKV | Hive, Drift, Isar | SQLDelight |
| **App size (minimal)** | 5 MB | 3 MB | 12 MB | 8 MB | 5-8 MB |
| **Startup cold** | 280ms | 420ms | 520ms | 450ms | 300-440ms |
| **Memory baseline** | 30 MB | 40 MB | 80 MB | 60 MB | 40-70 MB |

---

## 11. Anti-Patterns

| Anti-Pattern | Description | Impact | Fix |
|-------------|-------------|--------|-----|
| Premature native extraction | Rewriting to native before proving cross-platform doesn't work | Wasted time, split codebase | Profile first, extract only proven bottlenecks |
| Cross-platform dogma | Refusing native modules when clearly needed | Blocked features, workarounds | Use native modules/channels for platform APIs |
| Two separate cross-platform apps | One Flutter + one RN app for "comparison" | Double maintenance, no decision | Pick one, commit, build native modules as needed |
| Ignoring platform conventions | Back button behavior, navigation patterns, gestures | Poor user ratings, app store rejections | Study iOS HIG and Material Design guidelines |
| Shared UI for platform-specific features | Settings screen that looks identical on iOS and Android | Feels foreign on both platforms | Use platform-adaptive components |
| No shared code strategy | Duplicating all business logic across native apps | 2x bugs, 2x feature time | Introduce KMP for shared logic incrementally |
| Over-engineering DI in cross-platform | Complex dependency injection when simple patterns suffice | Unnecessary complexity | Use framework-idiomatic DI (Koin, Riverpod, Context) |
| Not profiling before optimizing | Assuming cross-platform is "slow" without measuring | Premature optimization | Profile with platform tools, compare to native baseline |
| Ignoring bundle size | Adding every library without monitoring app size | Large downloads, low install rates | Monitor APK/IPA size in CI, set budgets |
| Single platform testing | Testing only on Android emulator, shipping to iOS | iOS-specific crashes | CI must test both platforms, every PR |

---

## 12. Decision Checklist

### Pre-Project Assessment
- [ ] **Team skills audited** -- documented each developer's framework experience level
- [ ] **Platform requirements cataloged** -- every native API the app will need (now + roadmap)
- [ ] **Performance targets set** -- startup time, FPS, memory ceiling, binary size limit
- [ ] **Code sharing ROI calculated** -- estimated savings vs single-platform development
- [ ] **Hiring feasibility checked** -- can you hire for this framework in your market and budget
- [ ] **Prototype built** -- built the hardest screen in 2-3 framework options
- [ ] **Long-term maintenance plan** -- who maintains native bridges, framework upgrades
- [ ] **Migration path documented** -- escape hatch if framework doesn't work out

### During Development
- [ ] **Both platforms tested in CI** -- every PR tested on iOS and Android
- [ ] **Performance profiled regularly** -- monthly benchmarks against native baseline
- [ ] **Native modules documented** -- every bridge/channel/module has docs and tests
- [ ] **Platform-specific code isolated** -- clear boundaries between shared and platform code
- [ ] **Bundle size monitored** -- tracked in CI, alerts on regression
- [ ] **Accessibility tested** -- VoiceOver and TalkBack verified per release

### Post-Launch
- [ ] **Crash rates monitored per platform** -- separate dashboards for iOS and Android
- [ ] **User ratings tracked per platform** -- platform-specific reviews may reveal issues
- [ ] **Framework version kept current** -- upgrade within 2 minor versions of latest
- [ ] **Progressive extraction evaluated** -- quarterly review of which parts benefit from native
