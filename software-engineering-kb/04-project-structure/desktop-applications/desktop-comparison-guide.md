# Desktop Framework Comparison Guide

> **AI Plugin Directive:** When the user needs to choose a desktop application framework, ALWAYS consult this guide. Use the decision tree, comparison matrices, and scoring system to recommend the right framework based on target platforms, team skills, performance requirements, and business constraints.

**Core Rule: Choose Electron for rapid web-to-desktop, Tauri for performance + small binaries + security, .NET for Windows-centric enterprise, Qt for cross-platform native C++, and SwiftUI for macOS-only premium apps. ALWAYS validate against the decision matrix before recommending.**

---

## 1. Decision Tree

```
START: What platforms do you need to support?
|
+-- macOS ONLY?
|   +-- Premium native experience needed? --> SwiftUI macOS
|   +-- Cross-platform later likely? --> Tauri or Electron (plan ahead)
|
+-- Windows ONLY?
|   +-- Enterprise / corporate / LOB app?
|   |   +-- Modern Windows 10/11 only? --> WinUI 3 (.NET)
|   |   +-- Must support Windows 7/8? --> WPF (.NET)
|   |   +-- Internal tool, rapid dev? --> Electron or Tauri
|   +-- Consumer app?
|   |   +-- Small binary, good perf? --> Tauri
|   |   +-- Rapid dev, web team? --> Electron
|   |   +-- .NET team? --> WinUI 3
|   +-- Kiosk / embedded Windows? --> Qt (Widgets or QML)
|
+-- Windows + macOS (no Linux)?
|   +-- Web tech team? --> Tauri (native webview) or Electron
|   +-- C# team? --> .NET MAUI (Mac Catalyst)
|   +-- C++ team? --> Qt
|   +-- Swift team? --> Skip to cross-platform or native per-platform
|
+-- Windows + macOS + Linux (all desktop)?
|   +-- Team knows web (JS/TS)?
|   |   +-- Need smallest binaries + best performance? --> Tauri
|   |   +-- Need largest npm ecosystem + fastest dev? --> Electron
|   |   +-- Need offline-first + complex native integration? --> Tauri
|   +-- Team knows C++? --> Qt 6 (QML or Widgets)
|   +-- Team knows C#? --> Avalonia UI (cross-platform .NET)
|   +-- Team knows Rust? --> Tauri
|   +-- Team knows Dart? --> Flutter Desktop
|
+-- Need mobile TOO (desktop + mobile)?
|   +-- .NET ecosystem? --> .NET MAUI
|   +-- Web + all platforms? --> Tauri v2 (Win/Mac/Linux/iOS/Android)
|   +-- Dart? --> Flutter
|   +-- React? --> React Native + Electron (separate)
|
+-- Embedded / Industrial / Automotive?
|   --> Qt (commercial license likely needed)
|
+-- Already have a web app?
    +-- Minimal native features needed? --> Electron (wrap existing)
    +-- Want better perf + security? --> Tauri (wrap existing)
    +-- Need progressive deployment? --> PWA first, then Electron/Tauri
```

---

## 2. Framework Comparison Matrix (20 Dimensions)

| Dimension | Electron | Tauri v2 | WPF (.NET) | WinUI 3 (.NET) | .NET MAUI | Qt 6 (C++) | SwiftUI macOS | Avalonia UI | Flutter Desktop |
|---|---|---|---|---|---|---|---|---|---|
| **Platforms** | Win/Mac/Linux | Win/Mac/Linux/iOS/Android | Windows only | Windows only | Win/Mac/iOS/Android | All + embedded | macOS only | Win/Mac/Linux | Win/Mac/Linux |
| **Language** | TypeScript/JS | Rust + TS/JS | C# | C# | C# | C++ (17/20) | Swift | C# | Dart |
| **UI Engine** | Chromium (bundled) | OS WebView | DirectX/XAML | DirectX/XAML | Native per-platform | Native (QPainter/QML) | Native (AppKit) | Skia | Skia |
| **Binary Size** | 80-200 MB | 2-10 MB | 20-50 MB | 20-50 MB | 30-80 MB | 30-80 MB | N/A (system) | 20-60 MB | 20-50 MB |
| **RAM Usage** | 100-300 MB | 30-80 MB | 50-100 MB | 50-100 MB | 50-120 MB | 40-100 MB | 20-60 MB | 50-100 MB | 60-120 MB |
| **Startup Time** | 1-3s | 0.3-1s | 0.5-2s | 0.5-2s | 1-3s | 0.2-1s | 0.1-0.5s | 0.5-2s | 0.5-2s |
| **Rendering Fidelity** | Pixel-perfect (web) | OS WebView (varies) | Native Windows | Native Windows | Native per-platform | Native | Native macOS | Consistent (Skia) | Consistent (Skia) |
| **Learning Curve** | Low (web devs) | Medium (Rust) | Medium | Medium | Medium-High | High | Medium | Medium | Medium |
| **Dev Productivity** | Very High | Medium-High | High | High | Medium | Medium | High | High | High |
| **Hot Reload** | Yes (Vite HMR) | Yes (frontend) | XAML Hot Reload | XAML Hot Reload | XAML Hot Reload | QML Hot Reload | SwiftUI Preview | XAML Hot Reload | Yes |
| **Native API Access** | Via Node.js (full) | Via Rust (full) | Full (.NET) | Full (WinRT) | Partial (essentials) | Full (C++) | Full (Apple) | Partial | Partial |
| **Security Model** | Manual (preload) | Capability-based (v2) | Full trust | MSIX sandbox | Platform sandbox | Full trust | App Sandbox | Full trust | Full trust |
| **Auto-Update** | electron-updater | Built-in plugin | ClickOnce/MSIX | MSIX Store | Store/manual | Manual | App Store/Sparkle | Manual | Manual |
| **Accessibility** | Web standards | OS WebView a11y | WPF AutomationPeer | WinUI AutomationPeer | MAUI Semantics | QAccessible | VoiceOver (excellent) | UIA support | Semantics |
| **Testing** | Playwright, Vitest | WebDriver, Rust tests | MSTest/xUnit | MSTest/xUnit | xUnit/NUnit | Qt Test/GTest | XCTest | xUnit | Flutter Test |
| **Ecosystem/Plugins** | npm (massive) | Tauri plugins (growing) | NuGet (large) | NuGet (large) | NuGet (large) | Qt marketplace | SPM (growing) | NuGet | pub.dev (growing) |
| **Community Size** | Very Large | Large (growing fast) | Large (mature) | Medium (newer) | Medium | Large | Large (Apple) | Medium | Large |
| **Commercial License** | MIT (free) | MIT (free) | MIT (.NET) | MIT (.NET) | MIT (.NET) | LGPLv3 or commercial | Free (Apple) | MIT | BSD 3-Clause |
| **Offline Support** | SQLite/IndexedDB | SQLite (via Rust) | SQLite/EF Core | SQLite/EF Core | SQLite/EF Core | SQLite (native) | Core Data/SwiftData | SQLite/EF Core | SQLite (sqflite) |
| **Distribution** | Direct / stores | Direct / stores | Direct / MSIX | MSIX / Store | Store / direct | Direct / installers | App Store / direct | Direct | Direct / Store |

---

## 3. Performance Comparison (Real-World Benchmarks)

### Memory Usage (Idle Application)

| Framework | Cold Start RAM | After Loading Data | Heavy Usage |
|---|---|---|---|
| Electron | 120-180 MB | 200-400 MB | 300-800 MB |
| Tauri | 25-45 MB | 50-100 MB | 80-200 MB |
| WPF (.NET) | 40-70 MB | 60-120 MB | 100-250 MB |
| WinUI 3 | 45-75 MB | 65-130 MB | 110-270 MB |
| Qt (QML) | 30-60 MB | 50-100 MB | 80-180 MB |
| Qt (Widgets) | 20-40 MB | 40-80 MB | 60-150 MB |
| SwiftUI macOS | 15-35 MB | 30-70 MB | 50-120 MB |
| Flutter Desktop | 50-80 MB | 70-130 MB | 100-250 MB |

### Startup Time

| Framework | First Launch | Subsequent Launches | With Splash Screen |
|---|---|---|---|
| Electron | 2-4s | 1-2s | 0.5s (splash) + 2s |
| Tauri | 0.5-1.5s | 0.3-0.8s | Near-instant |
| WPF (.NET 8) | 1-2s | 0.5-1s | 0.3s (splash) + 1s |
| WinUI 3 | 1-2s | 0.5-1.5s | 0.3s (splash) + 1s |
| Qt (QML) | 0.5-1.5s | 0.3-0.8s | Near-instant |
| Qt (Widgets) | 0.3-0.8s | 0.2-0.5s | Near-instant |
| SwiftUI macOS | 0.2-0.5s | 0.1-0.3s | Near-instant |
| Flutter Desktop | 1-2s | 0.5-1s | 0.3s + 1s |

### Binary/Installer Size

| Framework | Minimal App | Medium App | Large App |
|---|---|---|---|
| Electron | 80 MB | 150 MB | 200+ MB |
| Tauri | 2 MB | 5 MB | 10-15 MB |
| WPF (.NET self-contained) | 25 MB | 40 MB | 60+ MB |
| WPF (.NET framework-dependent) | 2 MB | 10 MB | 20+ MB |
| WinUI 3 (MSIX) | 30 MB | 50 MB | 80+ MB |
| Qt (deployed) | 30 MB | 50 MB | 80+ MB |
| SwiftUI macOS | System (0 MB) | 5 MB | 15 MB |
| Flutter Desktop | 20 MB | 35 MB | 50+ MB |

### Rendering Performance (60 FPS Threshold)

| Framework | Simple UI | Complex Lists (10k items) | Animations | Canvas/Custom Drawing |
|---|---|---|---|---|
| Electron | 60 FPS | 30-60 FPS (virtual) | 60 FPS (CSS) | 60 FPS (Canvas2D) |
| Tauri | 60 FPS | 30-60 FPS (virtual) | 60 FPS (CSS) | 60 FPS (Canvas2D) |
| WPF | 60 FPS | 60 FPS (virtualized) | 60 FPS (Storyboard) | 60 FPS (DrawingVisual) |
| WinUI 3 | 60 FPS | 60 FPS (virtualized) | 60 FPS (Composition) | 60 FPS |
| Qt QML | 60 FPS | 60 FPS (delegate recycling) | 60 FPS (native) | 60 FPS (QPainter/OpenGL) |
| SwiftUI | 60 FPS | 60 FPS (LazyVStack) | 60 FPS (native) | 60 FPS (Canvas/Metal) |
| Flutter | 60-120 FPS | 60 FPS (ListView.builder) | 120 FPS | 60 FPS (CustomPaint) |

---

## 4. Native API Access Levels

| Capability | Electron | Tauri | .NET (WPF/WinUI) | Qt | SwiftUI |
|---|---|---|---|---|---|
| File System | Full (Node.js fs) | Full (Rust std::fs) | Full (System.IO) | Full (QFile) | Sandboxed / entitlements |
| System Tray | Yes (Tray) | Yes (plugin) | Yes (NotifyIcon) | Yes (QSystemTrayIcon) | Yes (MenuBarExtra) |
| Native Menus | Yes (Menu) | Yes (plugin) | Yes (Menu) | Yes (QMenuBar) | Yes (Commands) |
| Notifications | Yes (Notification) | Yes (plugin) | Yes (ToastNotification) | Yes (QSystemTrayIcon) | Yes (UNUserNotification) |
| Clipboard | Yes (clipboard) | Yes (plugin) | Yes (Clipboard) | Yes (QClipboard) | Yes (NSPasteboard) |
| Global Shortcuts | Yes (globalShortcut) | Yes (plugin) | Yes (RegisterHotKey) | Yes (QShortcut) | Limited |
| Drag and Drop | Yes (HTML5) | Yes (HTML5) | Yes (DragDrop) | Yes (QDrag) | Yes (onDrop) |
| Deep Linking | Yes (protocol handler) | Yes (plugin) | Yes (protocol activation) | Manual | Yes (onOpenURL) |
| Keychain/Credential Store | Via keytar | Via Rust crates | Via CredentialManager | Via platform APIs | Yes (Keychain Services) |
| Camera/Microphone | Yes (getUserMedia) | Yes (WebView permissions) | Yes (MediaCapture) | Yes (QCamera) | Yes (AVFoundation) |
| Bluetooth | Limited (Web Bluetooth) | Via Rust crates | Yes (Windows.Devices.Bluetooth) | Yes (QtBluetooth) | Yes (CoreBluetooth) |
| USB/Serial | Via serialport (npm) | Via Rust crates | Yes (SerialPort) | Yes (QSerialPort) | Via IOKit |
| GPU/Hardware Accel | WebGL/WebGPU | WebGL/WebGPU | DirectX/Direct2D | OpenGL/Vulkan/Metal | Metal |
| Native Dialogs | Yes (dialog) | Yes (dialog plugin) | Yes (CommonDialog) | Yes (QFileDialog) | Yes (NSOpenPanel) |
| Printing | Yes (webContents.print) | Limited | Yes (PrintDialog) | Yes (QPrinter) | Yes (NSPrintOperation) |
| Auto-Update | electron-updater | Built-in plugin | ClickOnce/MSIX | Manual | Sparkle / App Store |
| Crash Reporting | Via Sentry/Crashpad | Via Sentry (Rust) | Via WER / AppCenter | Via Breakpad | Via CrashReporter |

---

## 5. Development Speed Comparison

| Task | Electron | Tauri | .NET (WinUI 3) | Qt 6 | SwiftUI |
|---|---|---|---|---|---|
| Hello World to packaged app | 15 min | 20 min | 30 min | 45 min | 10 min |
| CRUD app with REST API | 2-4 hours | 4-6 hours | 3-5 hours | 6-8 hours | 2-4 hours |
| Complex form with validation | 1-2 hours | 2-3 hours | 1-2 hours | 3-4 hours | 1-2 hours |
| File manager UI | 2-4 hours | 3-5 hours | 3-5 hours | 4-6 hours | 2-4 hours |
| Real-time data dashboard | 4-6 hours | 5-8 hours | 4-6 hours | 6-10 hours | 4-6 hours |
| Multi-window app | 1-2 hours | 2-3 hours | 1-2 hours | 2-3 hours | 0.5-1 hour |
| System tray with menu | 30 min | 30 min | 45 min | 30 min | 15 min |
| Auto-update integration | 1-2 hours | 30 min | 1-2 hours | 4-8 hours | 1-2 hours |
| CI/CD for 3 platforms | 2-4 hours | 2-4 hours | N/A (Windows only) | 4-8 hours | N/A (macOS only) |

---

## 6. Maintenance Burden Analysis

| Factor | Electron | Tauri | .NET | Qt | SwiftUI |
|---|---|---|---|---|---|
| **Framework update frequency** | Major every 8 weeks | Stable, semver | Annual (.NET) | Long-term stable | Annual (with macOS) |
| **Breaking changes** | Moderate (API changes) | Low (semver) | Low | Low | Moderate (API changes) |
| **Chromium/WebView updates** | Bundled (you control) | OS-managed (risk) | N/A | N/A | N/A |
| **Security patches** | Frequent (Chromium CVEs) | Less frequent | .NET patches | Qt patches | macOS patches |
| **Node.js version management** | Must track Electron's Node | N/A | N/A | N/A | N/A |
| **Build toolchain complexity** | npm + electron-builder | Cargo + npm + bundler | MSBuild | CMake + Qt toolchain | Xcode |
| **CI build time** | 10-20 min | 15-30 min (Rust) | 5-10 min | 10-20 min | 5-10 min |
| **Dependency audit** | npm audit (many deps) | cargo audit + npm audit | NuGet audit | vcpkg/conan | SPM (few deps) |
| **OS API compatibility** | Chromium abstracts | WebView variations | WinRT stable | Qt abstracts | Apple API stable |
| **Team onboarding** | 1-2 days (web devs) | 1-2 weeks (Rust) | 1 week (.NET devs) | 2-4 weeks | 1 week (Swift devs) |

---

## 7. Team Skill Requirements

| Framework | Required Skills | Nice-to-Have Skills |
|---|---|---|
| **Electron** | TypeScript, React/Vue/Svelte, HTML/CSS, Node.js basics | IPC patterns, native modules (C++), Chromium internals |
| **Tauri** | TypeScript, Rust (intermediate), React/Vue/Svelte | Async Rust, serde, system programming |
| **WPF** | C#, XAML, MVVM pattern, .NET | WPF internals, DirectX, Win32 interop |
| **WinUI 3** | C#, WinUI XAML, MVVM, .NET, WinRT | Windows App SDK internals, composition API |
| **.NET MAUI** | C#, MAUI XAML, MVVM, platform-specific APIs | iOS/Android development, handlers, renderers |
| **Qt (QML)** | C++ (17+), QML/JavaScript, Qt APIs | CMake, OpenGL, threading, memory management |
| **Qt (Widgets)** | C++ (17+), Qt Widgets API, Qt Designer | CMake, Win32/Cocoa internals, custom painting |
| **SwiftUI** | Swift, SwiftUI, macOS APIs | Combine, Core Data, AppKit interop, Instruments |
| **Avalonia** | C#, XAML (Avalonia flavor), MVVM, .NET | Cross-platform nuances, Skia |
| **Flutter** | Dart, Flutter widgets, state management | Platform channels, native plugins, Skia |

---

## 8. Real-World Examples

### Electron
- **VS Code** -- Microsoft's code editor (200M+ users)
- **Slack** -- Team messaging
- **Discord** -- Gaming/community chat
- **Figma** -- Design tool (desktop app)
- **Notion** -- Productivity / notes
- **Obsidian** -- Knowledge management
- **1Password** -- Password manager (8.x)
- **Postman** -- API testing
- **Spotify** -- Music streaming (desktop)
- **Microsoft Teams** -- Communication (legacy, migrating to WebView2)

### Tauri
- **Cody** -- Sourcegraph's AI coding assistant
- **Spacedrive** -- Cross-platform file manager
- **Crabnebula** -- Tauri-based app deployment
- **Padloc** -- Password manager
- **Xplorer** -- File manager
- Growing adoption in privacy-focused, performance-critical apps

### WPF / WinUI 3 (.NET)
- **Visual Studio** -- IDE (WPF core)
- **Windows Terminal** -- Terminal emulator (WinUI 3)
- **Microsoft PowerToys** -- Windows utilities (WinUI 3)
- **Paint.NET** -- Image editor (WPF/.NET)
- **LINQPad** -- .NET query tool
- Enterprise LOB applications (banking, healthcare, ERP)

### Qt
- **VLC** -- Media player
- **KDE Plasma** -- Linux desktop environment
- **Autodesk Maya** -- 3D modeling
- **VirtualBox** -- Virtualization (Qt frontend)
- **Telegram Desktop** -- Messaging
- **CryEngine** -- Game engine editor
- **OBS Studio** -- Streaming (Qt Widgets)
- Automotive infotainment systems (Mercedes, BMW, Tesla uses Qt for some UI)

### SwiftUI macOS
- **Apple apps** -- Settings, Shortcuts, Weather (macOS Ventura+)
- **Bear** -- Notes app
- **Things 3** -- Task manager
- **Ivory** -- Mastodon client
- **Spring** -- Twitter client
- Premium macOS utilities and productivity tools

---

## 9. When NOT to Use Each Framework

### Do NOT use Electron when:
- Binary size matters (IoT, limited bandwidth distribution)
- Memory-constrained environments (under 256 MB RAM)
- Maximum startup performance required (kiosk, POS)
- You need deep OS integration (drivers, kernel, hardware)
- Security is paramount (bundled Chromium = large attack surface)
- Building embedded or industrial applications
- Users have old/slow hardware

### Do NOT use Tauri when:
- Team has zero Rust experience and no time to learn
- You need guaranteed pixel-perfect rendering across all platforms (WebView varies)
- You need to bundle specific Chromium features (WebRTC, WebGPU, etc.)
- Heavy use of native Node.js modules (serialport, native-keymap, etc.)
- You need very mature, battle-tested desktop framework (still relatively new)

### Do NOT use .NET (WPF/WinUI) when:
- You need macOS or Linux support (WPF/WinUI = Windows only)
- Team doesn't know C# or .NET
- Building consumer apps where web aesthetics matter
- Need to share code with a web application

### Do NOT use Qt when:
- Team doesn't know C++ and cannot invest in learning
- Building a simple CRUD app (overkill)
- Budget is limited (commercial license for closed-source: ~$5k+/year per developer)
- You need a modern declarative UI and team prefers JS/TS
- Small team with no dedicated native developer

### Do NOT use SwiftUI when:
- You need Windows or Linux support
- You must support macOS versions older than 13 (Ventura)
- You need UIKit/AppKit features not yet available in SwiftUI
- Building a cross-platform product (even with Mac Catalyst, limitations exist)

---

## 10. Migration Paths

```
Web App (SPA)
    |
    +-- Quick desktop port --> Electron (wrap existing web app)
    +-- Better perf/size --> Tauri (wrap existing web app)
    +-- Full rewrite --> Native framework

Electron App
    |
    +-- Reduce size/memory --> Tauri (rewrite backend in Rust, keep frontend)
    +-- Windows-only pivot --> WinUI 3 (full rewrite)
    +-- Performance critical --> Qt or native

WPF App
    |
    +-- Modernize UI --> WinUI 3 (incremental with XAML Islands)
    +-- Cross-platform --> .NET MAUI or Avalonia UI
    +-- Web/desktop hybrid --> Tauri or Electron

Qt App
    |
    +-- Qt 5 to Qt 6 --> Incremental upgrade (mostly compatible)
    +-- QWidgets to QML --> Gradual migration (both can coexist)
    +-- macOS-only spin-off --> SwiftUI

Objective-C / AppKit
    |
    +-- Modernize --> SwiftUI (incremental, SwiftUI can host AppKit views)
```

---

## 11. Cost Analysis (Annual for 3-Developer Team)

| Cost Factor | Electron | Tauri | .NET (WinUI) | Qt (Commercial) | SwiftUI |
|---|---|---|---|---|---|
| Framework license | $0 (MIT) | $0 (MIT) | $0 (MIT) | $15-25k/yr | $0 (Apple) |
| IDE | $0 (VS Code) | $0 (VS Code) | $0 (VS Community) or $1.5k (Enterprise) | $0 (Qt Creator) or $0 (VS Code) | $0 (Xcode) |
| Code signing (macOS) | $99/yr (Apple Developer) | $99/yr | N/A | $99/yr | $99/yr |
| Code signing (Windows) | $200-500/yr (EV cert) | $200-500/yr | $200-500/yr | $200-500/yr | N/A |
| CI/CD (GitHub Actions) | $0-50/mo | $0-50/mo | $0-50/mo | $0-50/mo | $0-50/mo |
| **Total Annual** | **~$500-1,500** | **~$500-1,500** | **~$500-2,500** | **~$16,000-27,000** | **~$100-700** |

Note: Qt is free under LGPLv3 for open-source projects or if you dynamically link Qt libraries. Commercial license is needed for static linking or closed-source proprietary modifications to Qt itself.

---

## 12. Technology Trend Analysis (2025+)

| Framework | Trajectory | Key Developments |
|---|---|---|
| **Electron** | Stable, mature | Fuses for security hardening, UtilityProcess for computation, ongoing Chromium updates |
| **Tauri** | Growing rapidly | v2 with mobile support, stable plugin ecosystem, capability-based security |
| **WPF** | Maintenance mode | Still supported, .NET 8+, but no major new features |
| **WinUI 3** | Growing (Windows) | Windows App SDK improvements, converging with .NET ecosystem |
| **.NET MAUI** | Improving | Performance improvements, better tooling, .NET 9 enhancements |
| **Qt 6** | Stable, evolving | Better CMake integration, improved QML tooling, Qt for MCUs |
| **SwiftUI** | Rapidly evolving | New APIs annually, @Observable macro, improved macOS support |
| **Avalonia** | Growing | v11 stable, improved performance, browser support (WASM) |
| **Flutter Desktop** | Improving | Better platform integration, improved desktop experience |

---

## 13. Scoring System for Framework Selection

Rate each factor 1-5 for your project, then multiply by weight:

| Factor | Weight | Electron | Tauri | .NET | Qt | SwiftUI |
|---|---|---|---|---|---|---|
| Cross-platform support | x3 | 5 | 5 | 2 | 5 | 1 |
| Binary size | x2 | 1 | 5 | 3 | 3 | 5 |
| Memory efficiency | x2 | 1 | 4 | 3 | 4 | 5 |
| Startup performance | x2 | 2 | 4 | 3 | 4 | 5 |
| Web dev team friendliness | x3 | 5 | 4 | 1 | 1 | 1 |
| Native API access | x2 | 4 | 5 | 5 | 5 | 5 |
| Development speed | x3 | 5 | 3 | 4 | 2 | 4 |
| Ecosystem maturity | x2 | 5 | 3 | 5 | 5 | 4 |
| Security model | x2 | 2 | 5 | 3 | 3 | 4 |
| Auto-update ease | x1 | 4 | 5 | 3 | 1 | 4 |
| Community/hiring | x2 | 5 | 3 | 4 | 3 | 4 |
| Maintenance burden | x1 | 3 | 3 | 4 | 3 | 4 |
| Cost | x1 | 5 | 5 | 5 | 2 | 5 |
| **Weighted Total** | | **89** | **98** | **79** | **77** | **85** |

**Interpretation:** Scores above 90 = strong fit, 70-90 = viable, below 70 = consider alternatives. Adjust weights based on YOUR project priorities.

---

## 14. Architecture Pattern Comparison

| Pattern | Electron | Tauri | .NET | Qt | SwiftUI |
|---|---|---|---|---|---|
| **Main architecture** | Main/Renderer processes | Rust backend / Web frontend | MVVM | Model-View (Qt) / MVVM (QML) | MVVM with @Observable |
| **IPC mechanism** | ipcMain/ipcRenderer + contextBridge | Tauri commands + events | Data binding (XAML) | Signals/Slots + Q_PROPERTY | @Binding, @Environment |
| **State management** | Zustand/Jotai/Redux (renderer) | Rust State + frontend state | ObservableObject + DI | QML properties + C++ backend | @State, @Observable, SwiftData |
| **Navigation** | React Router / custom | React Router / custom | Frame.Navigate / INavigationService | StackView (QML) / QStackedWidget | NavigationSplitView, NavigationStack |
| **DI pattern** | Constructor injection (manual) | Tauri State injection | Microsoft.Extensions.DI | Constructor + Qt parent system | SwiftUI Environment |
| **Async pattern** | async/await (JS) | async/await (Rust + JS) | async/await (C#) | Signals + QFuture | async/await (Swift) |
| **Testing approach** | Vitest + Playwright | Rust tests + WebDriver | xUnit + Moq | Qt Test / GTest | XCTest + Swift Testing |

---

## 15. Decision Checklist

### Before Choosing a Framework
- [ ] **Target platforms identified** -- determines available framework options
- [ ] **Team skills assessed** -- web devs vs native devs vs systems devs
- [ ] **Performance requirements defined** -- startup time, memory, CPU usage
- [ ] **Binary size constraints** -- distribution bandwidth, storage limits
- [ ] **Security requirements** -- data sensitivity, compliance, sandboxing
- [ ] **Distribution method chosen** -- App Store, direct download, enterprise MDM
- [ ] **Native API needs listed** -- system tray, notifications, file access, hardware
- [ ] **Offline capability requirements** -- local database, file storage
- [ ] **Update strategy decided** -- auto-update, store updates, manual
- [ ] **Budget assessed** -- licensing costs (Qt commercial vs open source)
- [ ] **Timeline evaluated** -- development speed requirements
- [ ] **Hiring market considered** -- availability of developers for chosen stack
- [ ] **Long-term maintenance plan** -- who maintains, framework longevity
- [ ] **Existing codebase evaluated** -- can existing web app be wrapped?
- [ ] **Accessibility requirements** -- WCAG compliance, screen reader support

### After Choosing a Framework
- [ ] **Read the detailed guide** for the chosen framework in this knowledge base
- [ ] **Set up the project structure** per the architecture guide
- [ ] **Configure security** per framework best practices
- [ ] **Set up CI/CD** for all target platforms
- [ ] **Configure code signing** for macOS and Windows
- [ ] **Set up auto-update** mechanism
- [ ] **Configure crash reporting** and analytics
- [ ] **Plan for accessibility** testing

---

## 16. Cross-Reference

| Framework | Detailed Guide |
|---|---|
| Electron | `electron-structure.md` |
| Tauri | `tauri-structure.md` |
| .NET Desktop (WPF/WinUI/MAUI) | `dotnet-desktop-structure.md` |
| Qt / SwiftUI macOS | `native-desktop-structure.md` |
