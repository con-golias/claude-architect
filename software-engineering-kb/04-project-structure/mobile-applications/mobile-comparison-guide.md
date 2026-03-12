# Mobile Framework Comparison Guide

> **AI Plugin Directive:** When the user needs to choose a mobile framework, ALWAYS consult this guide alongside cross-platform-decisions.md. Use the comparison matrices and decision trees to recommend the right framework and structure based on project constraints. Evaluate ALL 20+ dimensions before making a recommendation. NEVER recommend a framework without considering team expertise, performance requirements, and long-term maintenance costs.

**Core Rule: Default to Expo (React Native) for cross-platform unless Flutter's widget system or KMP's Kotlin sharing is specifically beneficial. Default to native when platform-specific UX is the primary differentiator.**

---

## 1. Framework Profiles

| Framework | Language | UI Toolkit | Code Sharing | Rendering | First Release | Backing |
|-----------|---------|------------|-------------|-----------|---------------|---------|
| Swift/SwiftUI | Swift | SwiftUI / UIKit | 0% | Native UIKit/Metal | 2014 (Swift) / 2019 (SwiftUI) | Apple |
| Kotlin/Compose | Kotlin | Jetpack Compose / XML Views | 0% | Native Android/Skia | 2017 (Kotlin) / 2021 (Compose) | Google/JetBrains |
| React Native (Expo) | TypeScript | React (native views via Fabric) | 80-95% | Platform native views | 2015 | Meta |
| Flutter | Dart | Flutter Widgets (Material/Cupertino) | 90-98% | Impeller (Skia fallback) | 2018 | Google |
| KMP + Compose Multiplatform | Kotlin | Compose Multiplatform / SwiftUI | 50-85% | Skia (Compose) / Native | 2020 (KMM) / 2022 (KMP stable) | JetBrains |

---

## 2. 25-Dimension Comparison Matrix

### 2.1 Development Experience

| Dimension | iOS Native (Swift) | Android Native (Kotlin) | React Native (Expo) | Flutter | KMP |
|-----------|-------------------|------------------------|---------------------|---------|-----|
| **Language maturity** | Excellent (Swift 5.9+) | Excellent (Kotlin 2.0+) | Excellent (TypeScript 5.x) | Good (Dart 3.x) | Excellent (Kotlin 2.0+) |
| **IDE** | Xcode (macOS only) | Android Studio / IntelliJ | VS Code / WebStorm | VS Code / Android Studio | Android Studio / IntelliJ |
| **Hot reload speed** | Xcode Previews (~2-5s) | Compose Preview (~2-5s) | Fast Refresh (<1s) | Hot Reload (<1s) | N/A (recompile) |
| **Hot reload fidelity** | Limited (previews only) | Limited (previews only) | Preserves state | Preserves state | N/A |
| **Build time (clean)** | 60-120s | 90-180s | 30-60s (Metro) | 60-120s | 120-300s (all targets) |
| **Incremental build** | 5-15s | 10-30s | <1s (Fast Refresh) | <1s (Hot Reload) | 10-30s |
| **Debugging** | Xcode (excellent) | Android Studio (excellent) | Chrome DevTools + Flipper | DevTools (Dart) | Android Studio (Kotlin) |
| **Code generation** | Macros (Swift 5.9+) | KSP / KAPT | Codegen (RN New Arch) | build_runner / macros | KSP |
| **Package manager** | SPM / CocoaPods | Gradle (Maven Central) | npm / yarn | pub.dev | Gradle (Maven) |
| **Learning curve** | Medium-High | Medium | Low (web devs) / Medium (mobile) | Medium | Medium (Kotlin devs) / High (others) |

### 2.2 Performance

| Dimension | iOS Native | Android Native | React Native | Flutter | KMP |
|-----------|-----------|---------------|-------------|---------|-----|
| **Startup time (cold)** | 200-400ms | 300-600ms | 500-900ms | 400-700ms | 300-600ms (native) |
| **Startup time (warm)** | 50-100ms | 100-200ms | 200-400ms | 150-300ms | 100-200ms |
| **Rendering (60fps)** | Guaranteed | Guaranteed | Near-native (Fabric) | Near-native (Impeller) | Native per platform |
| **Memory baseline** | 30-50MB | 40-70MB | 80-150MB | 60-100MB | 40-70MB + shared |
| **Binary size (min)** | 5-15MB | 8-20MB | 15-30MB (Hermes) | 10-25MB | 10-25MB |
| **Animation perf** | 120fps ProMotion | 120fps capable | 60fps (Reanimated) | 60-120fps | Native per platform |
| **JS bridge overhead** | N/A | N/A | Minimal (JSI) | N/A | N/A |
| **GPU acceleration** | Metal (direct) | Vulkan/OpenGL | Platform native | Impeller (Metal/Vulkan) | Platform native |
| **Background processing** | Excellent | Excellent | Limited (Expo) | Good (isolates) | Excellent (native) |
| **Large list perf** | UICollectionView | LazyColumn | FlashList (excellent) | ListView.builder | Native per platform |

### 2.3 Platform & Ecosystem

| Dimension | iOS Native | Android Native | React Native | Flutter | KMP |
|-----------|-----------|---------------|-------------|---------|-----|
| **Platform API access** | Full (immediate) | Full (immediate) | Via native modules | Via platform channels | Full (native per platform) |
| **New OS feature support** | Day 0 | Day 0 | Weeks-months lag | Weeks-months lag | Day 0 (native layers) |
| **Widgets/Components** | 100+ native | 100+ native (Compose) | React + native | 200+ Material/Cupertino | Compose Multiplatform + native |
| **3rd party libraries** | CocoaPods: 90K+ | Maven: 200K+ | npm: 2M+ (not all RN) | pub.dev: 40K+ | Maven + platform |
| **RN/Flutter plugins** | N/A | N/A | 3000+ Expo/RN | 30K+ packages | Kotlin libs + native |
| **Camera/AR/VR** | ARKit (first-class) | ARCore (first-class) | expo-camera (limited AR) | camera plugin (limited AR) | Native per platform |
| **Bluetooth/IoT** | CoreBluetooth | Android BLE | react-native-ble | flutter_blue_plus | Native per platform |
| **Push notifications** | APNs (native) | FCM (native) | expo-notifications | firebase_messaging | Native per platform |
| **In-app purchases** | StoreKit 2 | Google Play Billing | expo-in-app-purchases | in_app_purchase | Native per platform |
| **Accessibility** | VoiceOver (excellent) | TalkBack (excellent) | Good (AccessibilityInfo) | Good (Semantics) | Native per platform |

### 2.4 Team & Business

| Dimension | iOS Native | Android Native | React Native | Flutter | KMP |
|-----------|-----------|---------------|-------------|---------|-----|
| **Team size (both platforms)** | 2x (iOS + Android) | 2x (included above) | 1x (shared team) | 1x (shared team) | 1.5x (shared + platform) |
| **Hiring market** | Large (iOS devs) | Large (Android devs) | Very large (web + mobile) | Growing (smaller pool) | Medium (Kotlin devs) |
| **Avg salary range (US)** | $130-180K | $120-170K | $120-170K | $115-165K | $130-175K |
| **Code sharing %** | 0% cross-platform | 0% cross-platform | 80-95% | 90-98% | 50-85% (logic) |
| **Time to market** | Slow (2 codebases) | Slow (2 codebases) | Fast (1 codebase) | Fast (1 codebase) | Medium (shared + native UI) |
| **Maintenance cost** | High (2 teams) | High (2 teams) | Low-Medium | Low-Medium | Medium |

---

## 3. Performance Benchmarks (Real-World)

### 3.1 Startup Time Benchmarks

```
Cold Start (release build, mid-range device 2024):
┌──────────────────┬──────────┬──────────┬──────────────┐
│ Framework        │ iOS (ms) │ Android  │ Notes        │
├──────────────────┼──────────┼──────────┼──────────────┤
│ Native Swift     │   280    │   N/A    │ Baseline     │
│ Native Kotlin    │   N/A    │   420    │ Baseline     │
│ Flutter          │   450    │   580    │ Impeller      │
│ React Native     │   520    │   680    │ Hermes + JSI │
│ KMP (native UI)  │   300    │   440    │ Native shell │
│ KMP (Compose MP) │   480    │   560    │ Skia render  │
└──────────────────┴──────────┴──────────┴──────────────┘
```

### 3.2 Rendering Performance (Complex List Scrolling)

```
1000-item list with images, 60fps target:
┌──────────────────┬───────────┬────────────┬──────────────────┐
│ Framework        │ Avg FPS   │ Drop Frame │ Memory (MB)      │
├──────────────────┼───────────┼────────────┼──────────────────┤
│ Native (each)    │ 59.8      │ 0.3%       │ 45-65            │
│ Flutter          │ 59.2      │ 1.2%       │ 70-95            │
│ React Native     │ 58.5      │ 2.1%       │ 90-130           │
│ (FlashList)      │ 59.5      │ 0.8%       │ 85-110           │
│ KMP (Compose MP) │ 59.0      │ 1.5%       │ 65-85            │
└──────────────────┴───────────┴────────────┴──────────────────┘
```

### 3.3 Memory Usage Profile

```
"Hello World" app → Full enterprise app (20 screens, network, DB):
┌──────────────────┬──────────────┬──────────────┬──────────────┐
│ Framework        │ Hello World  │ Medium App   │ Enterprise   │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ iOS Native       │   18 MB      │   45 MB      │   80 MB      │
│ Android Native   │   25 MB      │   60 MB      │   100 MB     │
│ Flutter          │   40 MB      │   85 MB      │   150 MB     │
│ React Native     │   55 MB      │   110 MB     │   200 MB     │
│ KMP (native UI)  │   20-28 MB   │   50-65 MB   │   90-110 MB  │
└──────────────────┴──────────────┴──────────────┴──────────────┘
```

### 3.4 Binary Size

```
Release APK/IPA (minimal app → enterprise app):
┌──────────────────┬──────────────┬──────────────┐
│ Framework        │ Minimal      │ Enterprise   │
├──────────────────┼──────────────┼──────────────┤
│ iOS Native       │   5 MB       │   25-40 MB   │
│ Android Native   │   3 MB       │   15-30 MB   │
│ Flutter          │   8 MB       │   20-40 MB   │
│ React Native     │   12 MB      │   25-50 MB   │
│ KMP              │   5-8 MB     │   20-40 MB   │
└──────────────────┴──────────────┴──────────────┘
```

---

## 4. Platform API Access Comparison

```
Feature availability (time after OS release):

                    Day 0    Week 1   Month 1   Month 3   Month 6+
Native iOS/Android  ██████   ██████   ██████    ██████    ██████
KMP (native UI)     ██████   ██████   ██████    ██████    ██████
Flutter             ░░░░░░   ██░░░░   ████░░    ██████    ██████
React Native        ░░░░░░   █░░░░░   ███░░░    █████░    ██████

█ = Available   ░ = Not yet available / community plugin needed
```

| Platform Feature | iOS Native | Android Native | React Native | Flutter | KMP |
|-----------------|-----------|---------------|-------------|---------|-----|
| Dynamic Island | Day 0 | N/A | Community lib (lag) | Community lib (lag) | Day 0 (iOS layer) |
| Material You theming | N/A | Day 0 | Manual | flutter_dynamic_color | Day 0 (Android) |
| Live Activities | Day 0 | N/A | expo-live-activity | Community plugin | Day 0 (iOS layer) |
| Widgets (Home Screen) | WidgetKit (Day 0) | Glance (Day 0) | expo-widgets (limited) | home_widget | Native per platform |
| HealthKit / Health Connect | Day 0 | Day 0 | react-native-health | health plugin | Day 0 |
| NFC | Core NFC (Day 0) | Day 0 | react-native-nfc | nfc_manager | Day 0 |
| Biometrics | FaceID/TouchID | Fingerprint/Face | expo-local-authentication | local_auth | Day 0 |
| Background fetch | BGTaskScheduler | WorkManager | expo-background-fetch | workmanager | Native per platform |
| File system access | Full | Full | expo-file-system | path_provider | Full |
| Keychain/Keystore | Full | Full | expo-secure-store | flutter_secure_storage | Native per platform |

---

## 5. Hot Reload Capabilities

| Capability | iOS Native | Android Native | React Native | Flutter | KMP |
|-----------|-----------|---------------|-------------|---------|-----|
| **Mechanism** | Xcode Previews | Compose Preview | Fast Refresh (Metro) | Hot Reload (Dart VM) | N/A (recompile) |
| **State preservation** | No (preview only) | No (preview only) | Yes (component state) | Yes (widget state) | N/A |
| **Speed** | 2-5s (preview render) | 2-5s (preview render) | <500ms | <500ms | 10-30s rebuild |
| **Scope** | Single view preview | Single composable | Changed component tree | Changed widget tree | Full recompile |
| **Works in debug** | Previews separate | Previews separate | Yes (debug mode) | Yes (debug mode) | N/A |
| **Works in release** | No | No | No | No | No |
| **Structural changes** | Requires rebuild | Requires rebuild | Requires reload | Hot Restart (~2s) | Requires rebuild |
| **New dependency** | Requires rebuild | Requires rebuild | Requires rebuild | Requires restart | Requires rebuild |
| **Custom UI support** | Full (SwiftUI) | Full (Compose) | Full (React) | Full (Flutter) | N/A |

---

## 6. Ecosystem Maturity

| Dimension | iOS Native | Android Native | React Native | Flutter | KMP |
|-----------|-----------|---------------|-------------|---------|-----|
| **Years in production** | 10+ (Swift) / 16+ (ObjC) | 7+ (Kotlin) / 15+ (Java) | 9+ | 6+ | 4+ (stable) |
| **Fortune 500 adoption** | Nearly all | Nearly all | ~30% | ~15% | ~10% |
| **Package ecosystem size** | 90K+ (CocoaPods/SPM) | 200K+ (Maven) | 2M+ npm (subset RN) | 40K+ (pub.dev) | Kotlin ecosystem + native |
| **Documentation quality** | Excellent (Apple) | Excellent (Google) | Good (Meta + Expo) | Excellent (Google) | Good (JetBrains) |
| **Stack Overflow answers** | Very high | Very high | High | High | Growing |
| **Enterprise examples** | All major banks, health | All major apps | Shopify, Discord, Bloomberg | BMW, Google Pay, Alibaba | Netflix, VMware, Cash App |
| **Conference ecosystem** | WWDC, iOSDevUK, etc. | Android Dev Summit, etc. | React Native EU, App.js | FlutterCon, Flutter Forward | KotlinConf |
| **Training resources** | Abundant | Abundant | Abundant | Good, growing | Growing |

---

## 7. Real-World Apps Per Framework

### iOS Native (Swift)
Apple Music, Apple Maps, Apple Health, Settings, Safari, Signal, Lyft, LinkedIn, Airbnb (moved from RN), Slack (partially)

### Android Native (Kotlin)
Google Maps, Gmail, Google Drive, YouTube, WhatsApp, Spotify, Twitter/X, Uber, Netflix

### React Native
Facebook, Instagram, Shopify, Discord, Bloomberg, Pinterest, Walmart, Microsoft Office apps, Coinbase, Flipkart

### Flutter
Google Pay, BMW, Alibaba (Xianyu), eBay Motors, Nubank, PUBG Mobile (companion), Toyota, Philips Hue, Google Classroom

### KMP
Netflix (shared logic), Cash App (shared logic), VMware, Philips, Quizlet, Touchlab clients, Forbes, Baidu

---

## 8. Decision by Project Type

```
PROJECT TYPE DECISION MATRIX:

                        ┌─────────────────────────────────────────────┐
                        │            Recommended Frameworks           │
┌───────────────────────┼─────────┬──────────┬──────┬────────┬───────┤
│ Project Type          │ Primary │ Alt #1   │ Alt  │ Avoid  │ Why   │
├───────────────────────┼─────────┼──────────┼──────┼────────┼───────┤
│ Consumer social app   │ RN/Expo │ Flutter  │      │        │ Fast  │
│ Enterprise internal   │ RN/Expo │ Flutter  │      │ Native │ Cost  │
│ E-commerce            │ RN/Expo │ Flutter  │      │        │ Speed │
│ Fintech / Banking     │ Native  │ KMP      │ Fltr │ RN     │ Sec.  │
│ Health / Medical      │ Native  │ KMP      │      │ Fltr   │ API   │
│ Gaming companion      │ Flutter │ Native   │      │ RN     │ GPU   │
│ IoT / Bluetooth       │ Native  │ RN+mod   │      │ Fltr   │ BLE   │
│ Content / Media       │ RN/Expo │ Flutter  │      │        │ Speed │
│ Maps / Navigation     │ Native  │ Flutter  │      │        │ Perf  │
│ Camera / AR / VR      │ Native  │          │      │ Fltr/RN│ API   │
│ Apple Watch + Phone   │ Swift   │          │      │ All CP │ Watch │
│ Wear OS + Phone       │ Kotlin  │          │      │ All CP │ Wear  │
│ Startup MVP (<6 mo)   │ RN/Expo │ Flutter  │      │ Native │ Speed │
│ Agency (many clients) │ Flutter │ RN/Expo  │      │ Native │ Reuse │
│ Existing Kotlin team  │ KMP     │ Flutter  │      │        │ Skill │
│ Existing web team     │ RN/Expo │          │      │ Fltr   │ Skill │
│ Max performance app   │ Native  │ Flutter  │      │ RN     │ Perf  │
│ Offline-first app     │ Native  │ Flutter  │ KMP  │        │ DB    │
│ Streaming / video     │ Native  │ Flutter  │      │        │ Codec │
│ Accessibility-first   │ Native  │ RN       │ Fltr │        │ A11y  │
└───────────────────────┴─────────┴──────────┴──────┴────────┴───────┘
```

---

## 9. Framework Selection Decision Tree

```
START: Choose your mobile framework
│
├── Q1: Single platform only?
│   ├── iOS only ──→ Swift/SwiftUI
│   ├── Android only ──→ Kotlin/Jetpack Compose
│   └── Both platforms ──→ continue
│
├── Q2: Does your team have existing expertise?
│   ├── JavaScript/TypeScript/React ──→ lean React Native (Expo)
│   ├── Dart (rare) ──→ lean Flutter
│   ├── Kotlin/Java ──→ lean KMP
│   ├── Swift + Kotlin (both native) ──→ lean KMP for shared logic
│   └── No mobile experience ──→ continue
│
├── Q3: Performance requirements?
│   ├── GPU-intensive (games, video, AR) ──→ Native or Unity
│   ├── 120fps animations critical ──→ Native or Flutter (Impeller)
│   ├── Standard UI + smooth scrolling ──→ any cross-platform works
│   └── Mostly forms/content ──→ React Native (Expo) ✓
│
├── Q4: Platform API needs?
│   ├── Heavy native APIs (HealthKit, ARKit, Bluetooth LE, NFC) ──→ Native or KMP
│   ├── Standard APIs (camera, GPS, push, storage) ──→ any framework works
│   └── Mostly HTTP/REST + UI ──→ React Native (Expo) or Flutter ✓
│
├── Q5: UI consistency requirement?
│   ├── Must look identical on both platforms ──→ Flutter ✓
│   ├── Must look native per platform ──→ Native or KMP
│   └── Mix (shared design system, minor platform tweaks) ──→ React Native ✓
│
├── Q6: Code sharing strategy?
│   ├── Share everything (UI + logic) ──→ Flutter (90-98%) or RN (80-95%)
│   ├── Share logic only, native UI ──→ KMP (50-85%)
│   └── No sharing needed ──→ Native
│
├── Q7: Time/budget constraints?
│   ├── Startup/MVP (<6 months, small team) ──→ React Native (Expo) ✓
│   ├── Agency (reusable across clients) ──→ Flutter ✓
│   ├── Enterprise (long-term, dedicated teams) ──→ KMP or Native
│   └── No constraints ──→ choose based on Q2-Q6
│
└── Q8: Web support needed too?
    ├── Yes, single codebase for mobile + web ──→ Flutter (web) or React Native (web via Expo)
    ├── Shared logic with separate web app ──→ KMP (Kotlin/JS) or RN (shared hooks/logic)
    └── No web needed ──→ choose based on above
```

---

## 10. State Management Comparison

| Framework | Solution | Type | Pros | Cons |
|-----------|---------|------|------|------|
| **iOS** | @Observable (Swift) | Built-in reactive | Zero deps, Apple official | iOS 17+ only |
| **iOS** | Combine | Reactive streams | Apple official, powerful | Steep learning curve |
| **Android** | StateFlow + ViewModel | Flow-based reactive | Kotlin official, lifecycle-aware | Boilerplate |
| **Android** | Compose State | UI state | Simple, built-in | Not for complex state |
| **React Native** | Zustand | External store | Tiny, simple, persist | Manual optimization |
| **React Native** | TanStack Query | Server state | Cache, refetch, pagination | Learning curve |
| **React Native** | Jotai | Atomic state | Minimal, composable | Less ecosystem |
| **Flutter** | Riverpod | Provider-based | Type-safe, testable, code-gen | Learning curve |
| **Flutter** | BLoC | Stream/event-based | Predictable, enterprise | Verbose boilerplate |
| **Flutter** | Provider | InheritedWidget wrapper | Simple, official | Less powerful |
| **KMP** | StateFlow (shared) | Kotlin Flow | Cross-platform, native | iOS bridging needed |
| **KMP** | KMP-NativeCoroutines | Flow wrapper | Swift interop | Additional dependency |

---

## 11. Navigation Comparison

| Framework | Solution | Type | Deep Links | Type Safety | Nested Nav |
|-----------|---------|------|------------|-------------|------------|
| iOS | NavigationStack | Declarative | Universal Links | NavigationPath | Yes |
| Android | Compose Navigation | Declarative | App Links | Safe Args / KSP | Yes |
| React Native | Expo Router | File-based | Yes (auto) | Typed routes | Yes (groups) |
| React Native | React Navigation | Imperative + declarative | Yes (config) | TypeScript types | Yes (nested) |
| Flutter | GoRouter | Declarative | Yes (config) | Type-safe params | ShellRoute |
| Flutter | auto_route | Code-gen | Yes | Full type safety | Yes |
| KMP | Compose Navigation | Declarative per platform | Platform native | Safe Args | Yes |
| KMP | Decompose | Shared navigation | Delegated to platform | Kotlin types | Yes |

---

## 12. CI/CD Comparison

| Aspect | iOS Native | Android Native | React Native | Flutter | KMP |
|--------|-----------|---------------|-------------|---------|-----|
| **Build service** | Xcode Cloud, Bitrise | GitHub Actions, Bitrise | EAS Build (cloud) | Codemagic, Bitrise | Bitrise, GitHub Actions |
| **Build time (CI)** | 10-20 min | 5-15 min | 5-10 min (EAS) | 8-15 min | 15-30 min |
| **OTA updates** | Not allowed (Apple) | Not allowed (Play) | EAS Update / CodePush | Shorebird | N/A |
| **App signing** | Xcode managed / manual | Keystore / Play signing | EAS credentials | Codemagic / manual | Platform native |
| **Testing in CI** | XCTest + xcresult | JUnit + Gradle | Jest + Detox | flutter_test + integration | kotlin.test + platform |
| **Distribution** | TestFlight | Internal testing track | EAS Submit | Codemagic | Platform native |
| **Code signing** | Provisioning profiles | Keystore | EAS handles | Manual or Codemagic | Platform native |

---

## 13. Testing Strategy Comparison

| Test Type | iOS Native | Android Native | React Native | Flutter | KMP |
|-----------|-----------|---------------|-------------|---------|-----|
| **Unit tests** | XCTest | JUnit5 + MockK | Jest + ts-jest | flutter_test | kotlin.test |
| **Widget/Component** | XCTest (ViewInspector) | Compose UI Test | React Native Testing Lib | WidgetTester | Compose test (Android) |
| **Integration** | XCUITest | Espresso / UI Automator | Detox | integration_test | Platform native |
| **Snapshot** | SwiftUI Previews | Compose Preview + Paparazzi | react-native-owl | golden_toolkit | N/A |
| **E2E** | XCUITest | Maestro | Maestro / Detox | Maestro / Patrol | Maestro |
| **API mocking** | URLProtocol | MockWebServer | MSW / nock | http_mock_adapter | MockEngine (Ktor) |
| **Coverage** | Xcode (llvm-cov) | JaCoCo | istanbul / Jest | lcov | Kover |

---

## 14. Performance Profiling Tools

| Framework | CPU Profiling | Memory Profiling | Network | UI/Frame | Battery |
|-----------|-------------|-----------------|---------|----------|---------|
| iOS Native | Instruments (Time Profiler) | Instruments (Allocations) | Instruments (Network) | Core Animation | Energy Diagnostics |
| Android Native | Android Profiler | Android Profiler (Memory) | Network Inspector | Layout Inspector | Battery Historian |
| React Native | Flipper (Hermes profiler) | Flipper (Memory) | Flipper (Network) | Perf Monitor overlay | Platform tools |
| Flutter | DevTools (CPU Profiler) | DevTools (Memory) | DevTools (Network) | DevTools (Performance) | Platform tools |
| KMP | Platform tools per target | Platform tools | Ktor logging | Platform tools | Platform tools |

---

## 15. Hiring Market & Community

```
Developer Availability (relative, 2025):
┌────────────────────┬────────────────────────────────────────┐
│ Framework          │ Available developers (relative)        │
├────────────────────┼────────────────────────────────────────┤
│ React/React Native │ ██████████████████████████████ 100%    │
│ Android (Kotlin)   │ ████████████████████████ 78%           │
│ iOS (Swift)        │ ██████████████████████ 72%             │
│ Flutter (Dart)     │ █████████████████ 55%                  │
│ KMP (Kotlin)       │ ████████████ 38%                       │
└────────────────────┴────────────────────────────────────────┘

Note: RN benefits from the massive React web developer pool.
KMP benefits from the existing Android Kotlin developer pool.
```

---

## 16. Code Sharing Reality

```
What can actually be shared:

                    0%    20%    40%    60%    80%    100%
                    ├──────┼──────┼──────┼──────┼──────┤

Flutter             │██████████████████████████████████████│ 90-98%
  UI + Logic + Nav  │██████████████████████████████████████│

React Native        │████████████████████████████████████  │ 80-95%
  UI + Logic        │████████████████████████████████████  │

KMP (Compose MP)    │████████████████████████████████      │ 70-85%
  Logic + UI (Comp) │████████████████████████████████      │

KMP (native UI)     │██████████████████████                │ 50-70%
  Logic only        │██████████████████████                │

Native (separate)   │                                      │ 0%
  Nothing shared    │                                      │

WHAT GETS SHARED:
─────────────────────────────────────────────────────
Flutter:     Business logic, UI, navigation, state, networking, models,
             tests, animations, themes, localization
React Native:Business logic, UI (mostly), navigation, state, networking,
             models, tests, some animations
KMP (full):  Business logic, networking, database, models, validation,
             state management, some UI (Compose MP)
KMP (logic): Business logic, networking, database, models, validation
Native:      Nothing (separate codebases entirely)
```

---

## 17. Anti-Patterns

| Anti-Pattern | Description | Impact | Fix |
|-------------|-------------|--------|-----|
| Choosing framework by hype | Picking Flutter/RN because trending | Team mismatch, slow progress | Match to team skills and project needs |
| Ignoring native module needs | Assuming cross-platform covers all APIs | Blocked on platform features | Audit native API requirements upfront |
| Over-sharing code in KMP | Forcing shared UI when native would be better | Poor UX per platform | Share logic, let UI be platform-native |
| Under-investing in native bridges | Not learning platform channels/native modules | Fragile integrations, bugs | Dedicate time to native bridge quality |
| Expecting identical performance | Cross-platform matching native in all cases | User complaints about jank | Profile early, set realistic expectations |
| Skipping platform testing | Testing only on one platform | Platform-specific bugs in production | Test on both platforms in CI |
| Ignoring binary size | Not monitoring app size during development | Large downloads, slow installs | Monitor size, tree-shake, split code |
| No migration strategy | Going all-in without escape hatch | Lock-in with no alternatives | Plan progressive migration path |
| Mixing state solutions | Using 3+ state management libraries | Confusion, inconsistency | Pick one primary, one for server state |
| Skipping accessibility | Not testing VoiceOver/TalkBack | Legal risk, excluded users | Test accessibility from day 1 |

---

## 18. Enforcement Checklist

### Before Starting a Mobile Project:

- [ ] **Team skill audit completed** -- document each developer's framework experience
- [ ] **Platform API requirements listed** -- every native API the app needs (camera, BLE, health, etc.)
- [ ] **Performance requirements documented** -- target FPS, startup time, memory ceiling
- [ ] **Code sharing percentage estimated** -- what can realistically be shared
- [ ] **Hiring plan considered** -- can you find developers for this framework in your market
- [ ] **Framework prototype built** -- build the hardest screen in 2-3 frameworks to compare
- [ ] **CI/CD pipeline evaluated** -- confirm build/test/deploy works for chosen framework
- [ ] **Long-term maintenance plan** -- who owns native bridges, upgrades, OS compatibility
- [ ] **Accessibility requirements confirmed** -- VoiceOver/TalkBack tested in prototype
- [ ] **Binary size budget set** -- target maximum app download size
- [ ] **Offline requirements assessed** -- local database and sync strategy chosen
- [ ] **Deep linking strategy confirmed** -- universal links / app links tested
- [ ] **Analytics/crash reporting chosen** -- Firebase, Sentry, or platform-native
- [ ] **App store compliance verified** -- both Apple and Google store policies met

---

## 19. Cross-Reference

| Framework | Detailed Structure Guide |
|-----------|------------------------|
| Flutter | `flutter-structure.md` |
| React Native | `react-native-structure.md` |
| iOS/Swift | `ios-swift-structure.md` |
| Android/Kotlin | `android-kotlin-structure.md` |
| KMP | `kotlin-multiplatform-structure.md` |
| Decision Framework | `cross-platform-decisions.md` |
