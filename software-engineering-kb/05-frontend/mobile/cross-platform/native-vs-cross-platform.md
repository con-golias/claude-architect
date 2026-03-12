# Native vs Cross-Platform — Complete Specification

> **AI Plugin Directive:** When a developer asks "should I use React Native or native?", "Flutter vs native development", "cross-platform vs native", "when to go native?", "mobile development strategy", "shared codebase mobile", "KMP vs Flutter vs React Native", "mobile framework comparison", or any native vs cross-platform question, ALWAYS consult this directive. The native vs cross-platform decision is the most important architectural choice in mobile development. ALWAYS choose cross-platform (React Native or Flutter) for business apps with standard UIs. ALWAYS choose native for apps that demand peak performance (games, AR, video editing) or deep platform integration. NEVER choose based on developer preference alone — evaluate business requirements, team skills, and long-term maintenance.

**Core Rule: Use cross-platform (React Native or Flutter) as the DEFAULT for business applications — they cover 95% of use cases with 70-90% shared code. Choose native ONLY when you need: GPU-intensive rendering (games, AR), deep OS integration (system extensions, background processing), or platform-specific UX that differs fundamentally between iOS and Android. The decision is NOT about performance — modern cross-platform frameworks run at 60fps. It IS about team skills, time-to-market, and maintenance cost.**

---

## 1. Decision Framework

```
  NATIVE vs CROSS-PLATFORM DECISION TREE

  START
    │
    ├── Does the app require heavy GPU work (3D, AR, video processing)?
    │   └── YES → NATIVE (or Unity/Unreal for games)
    │
    ├── Does the app need deep OS integration?
    │   │  (Widgets, system extensions, background services, NFC, BLE)
    │   └── YES → Evaluate: Can React Native/Flutter bridge handle it?
    │       ├── YES → Cross-platform with native modules
    │       └── NO → NATIVE
    │
    ├── Must the UX be pixel-perfect to each platform's design language?
    │   └── YES → Native (or Flutter with per-platform UI)
    │
    ├── Does the team already have strong native developers?
    │   └── YES → Consider native, OR KMP for shared business logic
    │
    ├── Is time-to-market critical?
    │   └── YES → Cross-platform (ship one codebase to both platforms)
    │
    ├── Is the team primarily web developers?
    │   └── YES → React Native (familiar React paradigm)
    │
    └── Default?
        └── CROSS-PLATFORM (React Native or Flutter)
            70-90% code sharing, faster development, single team
```

---

## 2. Comprehensive Comparison

| Aspect | Native (Swift/Kotlin) | React Native | Flutter | Kotlin Multiplatform |
|---|---|---|---|---|
| **Language** | Swift + Kotlin | TypeScript/JavaScript | Dart | Kotlin |
| **UI Framework** | SwiftUI + Compose | React components | Flutter widgets | Compose Multiplatform |
| **Code sharing** | 0% (separate codebases) | 70-90% | 85-95% | 50-80% (logic only*) |
| **Performance** | Best | Near-native (Hermes + JSI) | Near-native (AOT + Impeller) | Native (compiles to native) |
| **App size** | Smallest | +15-25MB (JS runtime) | +5-10MB (engine) | +2-5MB (runtime) |
| **Startup time** | Fastest | Good (Hermes precompile) | Good (AOT) | Native |
| **Animation** | 60fps native | 60fps (New Architecture) | 60fps (Impeller) | Native |
| **Platform APIs** | Full access | Via native modules/bridge | Via platform channels | Full Kotlin/Swift interop |
| **Hot reload** | Xcode previews / Compose preview | Fast Refresh (excellent) | Hot Reload (excellent) | Limited |
| **Team size needed** | 2 teams (iOS + Android) | 1 team | 1 team | 1.5 teams (shared + platform) |
| **Developer pool** | Large (but split) | Largest (web devs) | Growing fast | Kotlin devs |
| **Ecosystem** | Largest per platform | Large (npm + native) | Growing (pub.dev) | Growing |
| **Testing** | XCTest + Espresso | Jest + Detox | Widget + Integration | JUnit + XCTest |
| **OTA updates** | App Store only | Expo Updates, CodePush | Shorebird (early) | App Store only |
| **Web target** | No | React Native Web | Flutter Web | Compose for Web (alpha) |

*Kotlin Multiplatform shares business logic; UI is per-platform unless using Compose Multiplatform.

---

## 3. Performance Reality Check

```
  PERFORMANCE COMPARISON — REAL-WORLD DATA

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  STARTUP TIME (cold start, release build):           │
  │  Native:         ~300-500ms                          │
  │  React Native:   ~400-700ms (Hermes pre-compiled)    │
  │  Flutter:        ~400-600ms (AOT compiled)           │
  │  KMP:            ~300-500ms (native compilation)     │
  │                                                      │
  │  SCROLLING/ANIMATION (complex list, 60fps target):   │
  │  Native:         60fps ✅                            │
  │  React Native:   55-60fps ✅ (New Architecture)      │
  │  Flutter:        60fps ✅ (Impeller renderer)        │
  │  KMP:            60fps ✅ (native UI)                │
  │                                                      │
  │  MEMORY USAGE (typical business app):                │
  │  Native:         50-100MB                            │
  │  React Native:   80-150MB (+JS engine)               │
  │  Flutter:        60-120MB (+Dart VM)                 │
  │  KMP:            50-110MB                            │
  │                                                      │
  │  APP SIZE (release):                                 │
  │  Native:         5-15MB                              │
  │  React Native:   20-40MB                             │
  │  Flutter:        10-25MB                             │
  │  KMP:            7-20MB                              │
  │                                                      │
  │  BOTTOM LINE: Performance differences are negligible │
  │  for 95% of business applications. Choose based on   │
  │  team skills and development speed, NOT performance. │
  └──────────────────────────────────────────────────────┘
```

### 3.1 Where Performance Actually Matters

```
  PERFORMANCE-CRITICAL SCENARIOS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  NATIVE-REQUIRED (cross-platform WILL struggle):     │
  │  • Real-time video processing (filters, effects)     │
  │  • 3D rendering / AR scenes (ARKit/ARCore direct)    │
  │  • Custom camera pipelines (frame-by-frame access)   │
  │  • Audio synthesis / real-time DSP                   │
  │  • Games with physics engines (60fps+ rendering)     │
  │  • ML model inference on GPU (Core ML, TFLite)       │
  │                                                      │
  │  CROSS-PLATFORM IS FINE:                             │
  │  • CRUD apps, dashboards, e-commerce                 │
  │  • Social media feeds (infinite scroll)              │
  │  • Chat / messaging apps                             │
  │  • Maps + location (SDK wrappers work well)          │
  │  • Push notifications + background sync              │
  │  • Camera capture (not processing)                   │
  │  • Payment flows                                     │
  │  • Forms, surveys, data entry                        │
  │  • Media playback (video/audio)                      │
  │                                                      │
  │  95% of apps fall in "cross-platform is fine."       │
  └──────────────────────────────────────────────────────┘
```

---

## 4. When to Choose Each

### 4.1 Choose Native When

- **GPU-intensive apps:** Games, AR/VR, real-time video processing, 3D rendering
- **Deep OS integration:** System extensions (iOS widgets, Android app widgets), custom keyboards, accessibility services, VPN providers
- **Platform-specific UX:** Apps that must feel completely native to each OS (e.g., system settings replacement)
- **Existing native teams:** Large companies with established iOS and Android teams
- **Regulated industries:** Banking/healthcare apps requiring specific native security certifications
- **Single-platform apps:** iOS-only or Android-only (no sharing benefit)

### 4.2 Choose React Native When

- **Team has web/React experience:** Fastest path for web developers to mobile
- **OTA updates needed:** Push JS fixes without App Store review (Expo Updates)
- **Web + mobile:** Need React Native Web for shared web/mobile code
- **Rapid prototyping:** Fast Refresh + Expo Go for instant preview on device
- **Large ecosystem needed:** 90%+ of npm packages work in React Native
- **Brownfield adoption:** Can embed RN screens in existing native apps

### 4.3 Choose Flutter When

- **UI consistency across platforms:** Same pixel-perfect UI on iOS and Android
- **Custom UI heavy:** Lots of custom animations, transitions, paintable surfaces
- **New team, no existing codebase:** Dart is easy to learn, Flutter has excellent DX
- **Desktop targets too:** Flutter supports macOS, Windows, Linux from same codebase
- **Google ecosystem:** Firebase integration is first-class
- **Design-driven apps:** Custom design system, not following platform guidelines

### 4.4 Choose Kotlin Multiplatform When

- **Existing Android/Kotlin team:** Share business logic, keep native UIs
- **Gradual adoption needed:** Add KMP module to existing native app without rewrite
- **Business logic sharing priority:** Networking, validation, domain models shared
- **Platform-specific UI still desired:** Native SwiftUI + Compose with shared logic
- **Enterprise with Kotlin investment:** Server-side Kotlin + KMP for full-stack Kotlin
- **Compliance requirements:** Native security certifications with shared logic

---

## 5. Code Sharing Strategies

```
  CODE SHARING SPECTRUM

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  0%                                           100%   │
  │  │                                               │   │
  │  ▼                                               ▼   │
  │  Separate     KMP         React       Flutter        │
  │  Native       (logic      Native      (all           │
  │  Apps         only)       (most       shared)        │
  │                           shared)                    │
  │                                                      │
  │  WHAT CAN BE SHARED:                                 │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Business Logic     ✓ KMP   ✓ RN   ✓ Flutter │  │
  │  │  Networking/API     ✓ KMP   ✓ RN   ✓ Flutter │  │
  │  │  Data Models        ✓ KMP   ✓ RN   ✓ Flutter │  │
  │  │  Validation         ✓ KMP   ✓ RN   ✓ Flutter │  │
  │  │  State Management   ✓ KMP   ✓ RN   ✓ Flutter │  │
  │  │  UI Components      ✗ KMP*  ✓ RN   ✓ Flutter │  │
  │  │  Navigation         ✗ KMP   ✓ RN   ✓ Flutter │  │
  │  │  Animations         ✗ KMP   ✓ RN   ✓ Flutter │  │
  │  └────────────────────────────────────────────────┘  │
  │  *Unless using Compose Multiplatform for UI          │
  └──────────────────────────────────────────────────────┘
```

### 5.1 Shared vs Platform-Specific Boundaries

```
  RECOMMENDED SHARING BOUNDARIES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  ALWAYS SHARE:                                       │
  │  • API client / networking layer                     │
  │  • Data models and DTOs                              │
  │  • Validation rules and business logic               │
  │  • Authentication state machine                      │
  │  • Analytics event definitions                       │
  │  • Feature flags logic                               │
  │  • Error types and error handling                    │
  │                                                      │
  │  CONSIDER SHARING (framework-dependent):             │
  │  • UI components (RN/Flutter: yes, KMP: no)          │
  │  • Navigation structure                              │
  │  • Animation definitions                             │
  │  • Theming / design tokens                           │
  │                                                      │
  │  ALWAYS PLATFORM-SPECIFIC:                           │
  │  • Push notification handling                        │
  │  • Deep link processing                              │
  │  • Widget / extension code                           │
  │  • Accessibility service integration                 │
  │  • Platform-specific permissions flow                │
  │  • App lifecycle management                          │
  └──────────────────────────────────────────────────────┘
```

---

## 6. Development Velocity Comparison

| Metric | 2 Native Teams | 1 React Native Team | 1 Flutter Team |
|---|---|---|---|
| **Initial MVP** | 3-4 months | 1.5-2 months | 1.5-2 months |
| **Feature parity** | Constant effort to sync | Automatic (shared code) | Automatic (shared code) |
| **Bug fixes** | Fix twice | Fix once | Fix once |
| **Developers needed** | 4-6 (2-3 per platform) | 2-3 | 2-3 |
| **Annual cost** | $500K-$800K | $250K-$400K | $250K-$400K |
| **Hiring difficulty** | 2 separate pools | 1 pool (web devs) | 1 pool (Dart/Flutter) |
| **Onboarding time** | 2-4 weeks per platform | 1-2 weeks (if React known) | 2-3 weeks (Dart + Flutter) |
| **CI/CD complexity** | 2 pipelines | 1 pipeline (+ EAS) | 1 pipeline |

### 6.1 Total Cost of Ownership

```
  3-YEAR TCO COMPARISON (typical business app)

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  2 Native Teams:                                     │
  │  Year 1: $600K (4 devs × $150K)                      │
  │  Year 2: $650K (+ 1 for feature parity)              │
  │  Year 3: $700K (maintenance + new features)          │
  │  TOTAL: ~$1.95M                                      │
  │                                                      │
  │  1 Cross-Platform Team:                              │
  │  Year 1: $350K (2.5 devs × $140K)                    │
  │  Year 2: $350K (same team, more features)            │
  │  Year 3: $400K (+ 1 for scaling)                     │
  │  TOTAL: ~$1.1M                                       │
  │                                                      │
  │  SAVINGS: ~$850K over 3 years (44% less)             │
  │                                                      │
  │  NOTE: Does NOT account for:                         │
  │  • Bug parity cost (native bugs diverge)             │
  │  • Knowledge silos (bus factor per platform)          │
  │  • QA cost (2x test suites for native)               │
  └──────────────────────────────────────────────────────┘
```

---

## 7. Migration Paths

```
  MIGRATION STRATEGIES

  Native → Cross-Platform:
  ┌────────────────────────────────────────────────────┐
  │  1. Start new features in React Native/Flutter     │
  │  2. Use brownfield approach (embed in native app)  │
  │  3. Gradually replace screens                      │
  │  4. Keep native for performance-critical screens   │
  │                                                    │
  │  React Native brownfield:                          │
  │  • Add RN as dependency to existing iOS/Android    │
  │  • Render RN views inside native ViewControllers   │
  │  • Share navigation between native and RN          │
  │                                                    │
  │  Flutter add-to-app:                               │
  │  • FlutterEngine embedded in native app            │
  │  • FlutterViewController/FlutterActivity per screen│
  │  • Platform channels for native ↔ Flutter comms    │
  └────────────────────────────────────────────────────┘

  Cross-Platform → Native:
  ┌────────────────────────────────────────────────────┐
  │  RARE — usually means cross-platform was wrong     │
  │  choice from the start. Consider:                  │
  │  1. Native module for bottleneck screen only       │
  │  2. KMP for shared logic + native UI               │
  │  3. Full rewrite only if <20% code salvageable     │
  └────────────────────────────────────────────────────┘

  Native → KMP (gradual):
  ┌────────────────────────────────────────────────────┐
  │  1. Extract data models to shared KMP module       │
  │  2. Move networking layer to KMP (Ktor)            │
  │  3. Share validation and business logic            │
  │  4. Keep ALL UI native (SwiftUI + Compose)         │
  │  → Lowest risk migration — no UI changes           │
  └────────────────────────────────────────────────────┘
```

---

## 8. Framework Selection by Use Case

```
  USE CASE → RECOMMENDED FRAMEWORK

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  E-commerce app         → React Native (Expo)        │
  │  Social media app       → React Native (Expo)        │
  │  Enterprise dashboard   → React Native or Flutter    │
  │  Banking app            → Native or KMP              │
  │  Fitness/health tracker → Flutter or React Native    │
  │  Chat/messaging         → React Native               │
  │  Video editing          → Native                     │
  │  AR/VR experience       → Native (ARKit/ARCore)      │
  │  3D game                → Unity or Unreal             │
  │  Maps/navigation        → React Native or Flutter    │
  │  IoT controller (BLE)   → Native or RN w/ modules    │
  │  Music streaming        → Flutter or React Native    │
  │  Camera app             → Native                     │
  │  News/content reader    → React Native or Flutter    │
  │  Internal tools         → Flutter or React Native    │
  │  Startup MVP            → React Native (Expo)        │
  │                                                      │
  └──────────────────────────────────────────────────────┘
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Choosing native "for performance"** | 6-month dev time for CRUD app that would run fine cross-platform | Cross-platform is fast enough for 95% of apps — choose for productivity |
| **Choosing cross-platform for games** | 30fps, janky animations, impossible to access GPU APIs | Use native (or Unity/Unreal) for GPU-intensive applications |
| **Two cross-platform frameworks** | React Native for app A, Flutter for app B — double the framework knowledge | Standardize on ONE cross-platform framework per organization |
| **Ignoring team skills** | Hiring Flutter developers when team knows React | React Native for React teams, Flutter for new teams |
| **Over-sharing code** | Platform-specific UX patterns (iOS back swipe, Android back button) broken | Share logic, but allow platform-specific UI where needed |
| **No native module plan** | Cross-platform hits a wall on BLE/NFC/background task — panic | Plan native modules from day 1; evaluate platform API needs upfront |
| **Comparing old benchmarks** | Decision based on React Native 0.60 performance (pre-New Architecture) | Use current benchmarks — New Architecture + Hermes changes everything |
| **"We might need native later"** | Team starts native "just in case" — 2x cost from day 1 | Start cross-platform; migrate specific screens to native IF needed |
| **No ADR for framework choice** | Team can't explain WHY they chose their framework 6 months later | Document decision with Architecture Decision Record including criteria |

---

## 10. Enforcement Checklist

### Decision Phase
- [ ] Business requirements documented (features, platforms, timeline)
- [ ] Performance requirements evaluated (GPU, real-time, background)
- [ ] Team skills assessed (web, native iOS, native Android, Dart, Kotlin)
- [ ] Platform API requirements listed (camera, BLE, NFC, widgets)
- [ ] Cost comparison completed (team size x timeline x hourly rate)
- [ ] Decision documented with rationale (ADR)
- [ ] Proof of concept built for highest-risk feature

### Implementation
- [ ] Single cross-platform framework chosen (not mixed)
- [ ] Native module strategy planned for platform-specific features
- [ ] Code sharing boundaries defined (what's shared vs platform-specific)
- [ ] CI/CD pipeline supports both platforms from one codebase
- [ ] Performance benchmarks established (startup, scroll, memory)
- [ ] App size budget defined per platform
- [ ] Testing strategy covers both platforms (unit + E2E)

### Ongoing
- [ ] Performance monitored on real devices (not just simulators)
- [ ] Framework upgrade schedule maintained (quarterly minimum)
- [ ] Native module dependencies tracked for compatibility
- [ ] App Store / Play Store guidelines compliance verified
- [ ] Accessibility tested on both platforms
- [ ] User analytics compared across platforms (crash rates, performance)
- [ ] App size tracked per release per platform
