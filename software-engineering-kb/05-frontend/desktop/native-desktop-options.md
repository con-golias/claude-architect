# Native Desktop Options — Complete Specification

> **AI Plugin Directive:** When a developer asks "desktop app framework comparison", "native desktop development", "Qt vs GTK", ".NET MAUI desktop", "SwiftUI macOS", "WPF vs WinUI", "cross-platform desktop", "desktop app architecture", "Avalonia UI", "desktop app distribution", or any native desktop development question, ALWAYS consult this directive. Native desktop development provides the best performance and platform integration but requires platform-specific code. ALWAYS prefer web-based desktop (Tauri, Electron, PWA) for business applications. Choose native desktop ONLY for: performance-critical applications (IDEs, DAWs, video editors), deep OS integration (system tray, file system watchers, custom window management), or platform-specific tools (macOS menu bar apps, Windows system utilities).

**Core Rule: For MOST desktop applications, use Tauri (web frontend + Rust backend) or Electron (web frontend + Node.js backend) — they provide cross-platform support with familiar web technologies. Choose native desktop ONLY when you need: GPU-intensive rendering, sub-millisecond latency, deep OS integration not available through web APIs, or platform-specific system utilities. When going native, use SwiftUI for macOS-only apps, WinUI 3 for Windows-only apps, and Qt (C++) or .NET MAUI (C#) for cross-platform native.**

---

## 1. Desktop Framework Decision Tree

```
  DESKTOP FRAMEWORK DECISION

  START
    │
    ├── Is it a business/content app?
    │   └── YES → Tauri or Electron (web-based)
    │
    ├── Need cross-platform (Win + Mac + Linux)?
    │   ├── Web team? → Tauri (Rust + web) or Electron (Node.js + web)
    │   ├── C++ team? → Qt
    │   ├── C# team? → .NET MAUI or Avalonia
    │   ├── Kotlin team? → Compose Multiplatform Desktop
    │   └── Dart team? → Flutter Desktop
    │
    ├── macOS-only?
    │   └── SwiftUI (or AppKit for legacy)
    │
    ├── Windows-only?
    │   └── WinUI 3 (or WPF for legacy)
    │
    ├── Linux-only?
    │   └── GTK (GNOME) or Qt (KDE)
    │
    ├── Performance-critical (IDE, DAW, video editor)?
    │   └── Native (C++/Rust) or Qt
    │
    └── System utility (tray app, driver UI)?
        └── Platform-native (SwiftUI / WinUI / GTK)
```

---

## 2. Framework Comparison

| Framework | Language | Platforms | Rendering | App Size | Performance | Learning Curve |
|---|---|---|---|---|---|---|
| **Tauri** | Rust + Web | Win/Mac/Linux/Mobile | System webview | 3-10MB | Good | Medium (Rust) |
| **Electron** | JS/TS | Win/Mac/Linux | Chromium | 120-200MB | Good | Low (web) |
| **Qt** | C++/Python | Win/Mac/Linux/Mobile | Custom (QPainter) | 20-50MB | Excellent | High |
| **SwiftUI** | Swift | macOS/iOS | Native (AppKit) | 5-15MB | Excellent | Medium |
| **WinUI 3** | C#/C++ | Windows | Native (XAML) | 10-30MB | Excellent | Medium |
| **.NET MAUI** | C# | Win/Mac/iOS/Android | Native per platform | 15-40MB | Good | Medium |
| **Avalonia** | C# | Win/Mac/Linux | Custom (Skia) | 15-35MB | Good | Medium |
| **Flutter** | Dart | Win/Mac/Linux/Mobile | Impeller/Skia | 15-30MB | Good | Medium |
| **Compose MP** | Kotlin | Win/Mac/Linux | Skia | 30-60MB | Good | Medium |
| **GTK** | C/Python/Rust | Linux/Win/Mac | Native (Cairo) | 10-30MB | Good | Medium |

---

## 3. When to Choose Each

### 3.1 Web-Based Desktop (Tauri / Electron)

```
  WEB-BASED DESKTOP — BEST FOR MOST APPS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  USE WHEN:                                           │
  │  • Team knows web technologies (React, Vue, etc.)    │
  │  • App is content/forms/data-centric                 │
  │  • Cross-platform is required                        │
  │  • Rapid development is priority                     │
  │  • App doesn't need extreme performance              │
  │                                                      │
  │  Tauri (RECOMMENDED for new projects):               │
  │  • 3-10MB app size                                   │
  │  • Rust backend (memory safe, fast)                  │
  │  • System webview (no Chromium bundled)               │
  │  • Strong security model (capability-based)           │
  │  • Mobile support (Tauri v2)                         │
  │                                                      │
  │  Electron (when ecosystem/compatibility matters):     │
  │  • Largest desktop app ecosystem (VS Code, Slack)    │
  │  • Full Chromium control (consistent rendering)      │
  │  • Node.js backend (npm ecosystem)                   │
  │  • Battle-tested enterprise deployment               │
  │  • Trade-off: 120-200MB app size                     │
  └──────────────────────────────────────────────────────┘
```

### 3.2 Native Frameworks

```
  NATIVE DESKTOP — FOR SPECIALIZED NEEDS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Qt (C++):                                           │
  │  • Performance-critical cross-platform apps           │
  │  • Industrial/embedded/automotive UIs                 │
  │  • Complex custom rendering (charts, diagrams)        │
  │  • Examples: Autodesk Maya, VLC, KDE apps             │
  │  • License: GPL or commercial ($$$)                  │
  │                                                      │
  │  SwiftUI (macOS):                                    │
  │  • macOS-only tools and utilities                    │
  │  • Menu bar apps, system preferences panels          │
  │  • Deep macOS integration (Spotlight, Widgets)       │
  │  • Examples: Xcode, Swift Playgrounds                │
  │                                                      │
  │  WinUI 3 (Windows):                                  │
  │  • Windows-only enterprise tools                     │
  │  • Microsoft Store distribution                      │
  │  • Fluent Design System                              │
  │  • Examples: Windows Terminal, Dev Home               │
  │                                                      │
  │  .NET MAUI / Avalonia (C#):                          │
  │  • .NET teams needing desktop                        │
  │  • MAUI: native per-platform, Microsoft-supported    │
  │  • Avalonia: custom rendering (like WPF everywhere)  │
  │  • Examples: JetBrains Rider (Avalonia)               │
  │                                                      │
  │  Flutter Desktop:                                    │
  │  • Teams already using Flutter for mobile            │
  │  • Consistent UI across desktop + mobile             │
  │  • Examples: Google Earth, Canonical tools            │
  └──────────────────────────────────────────────────────┘
```

---

## 4. Platform-Specific Examples

### 4.1 SwiftUI macOS App

```swift
// macOS menu bar app with SwiftUI
@main
struct MenuBarApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var delegate

    var body: some Scene {
        MenuBarExtra("My App", systemImage: "star.fill") {
            VStack(spacing: 12) {
                Text("Status: Active")
                    .font(.headline)

                Divider()

                Button("Open Dashboard") {
                    NSWorkspace.shared.open(URL(string: "myapp://dashboard")!)
                }

                Button("Preferences...") {
                    NSApp.sendAction(#selector(AppDelegate.openPreferences), to: nil, from: nil)
                }

                Divider()

                Button("Quit") {
                    NSApplication.shared.terminate(nil)
                }
            }
            .padding()
        }

        Settings {
            PreferencesView()
        }
    }
}
```

### 4.2 WinUI 3 Windows App

```csharp
// WinUI 3 — modern Windows desktop
public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        ExtendsContentIntoTitleBar = true;
        SetTitleBar(AppTitleBar);
    }
}

// XAML with Fluent Design
// <NavigationView>
//     <NavigationView.MenuItems>
//         <NavigationViewItem Content="Home" Icon="Home" Tag="home"/>
//         <NavigationViewItem Content="Settings" Icon="Setting" Tag="settings"/>
//     </NavigationView.MenuItems>
//     <Frame x:Name="ContentFrame"/>
// </NavigationView>
```

### 4.3 Qt Cross-Platform

```cpp
// Qt Quick (QML) — declarative cross-platform UI
// main.qml
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    width: 800
    height: 600
    title: "My Qt App"

    menuBar: MenuBar {
        Menu {
            title: "&File"
            Action { text: "&New"; shortcut: "Ctrl+N" }
            Action { text: "&Open"; shortcut: "Ctrl+O" }
            Action { text: "&Save"; shortcut: "Ctrl+S" }
            MenuSeparator {}
            Action { text: "&Quit"; shortcut: "Ctrl+Q"; onTriggered: Qt.quit() }
        }
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 16

        Label {
            text: "Hello from Qt!"
            font.pixelSize: 24
        }

        Button {
            text: "Click Me"
            onClicked: console.log("Button clicked")
        }
    }
}
```

---

## 5. Distribution & Updates

```
  DESKTOP APP DISTRIBUTION

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  macOS:                                              │
  │  • Mac App Store (curated, sandboxed)                │
  │  • Direct download (.dmg) — requires notarization   │
  │  • Homebrew Cask (developer tools)                   │
  │  • MUST be notarized by Apple (or Gatekeeper blocks) │
  │                                                      │
  │  Windows:                                            │
  │  • Microsoft Store (UWP/MSIX packaging)              │
  │  • Direct download (.exe/.msi)                       │
  │  • winget package manager                            │
  │  • Chocolatey (developer tools)                      │
  │  • SHOULD be code-signed (SmartScreen warning)       │
  │                                                      │
  │  Linux:                                              │
  │  • Flatpak (universal, sandboxed)                    │
  │  • Snap Store (Ubuntu)                               │
  │  • AppImage (portable, no install)                   │
  │  • .deb / .rpm (distribution-specific)               │
  │                                                      │
  │  AUTO-UPDATE:                                        │
  │  • Electron: electron-updater                        │
  │  • Tauri: @tauri-apps/plugin-updater                 │
  │  • Native: Sparkle (macOS), WinSparkle (Windows)     │
  │  • Custom: check version API + download new binary   │
  └──────────────────────────────────────────────────────┘
```

---

## 5. Desktop App Architecture Patterns

```
  DESKTOP APP ARCHITECTURE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  PATTERN 1: Single Window (most common)              │
  │  • One main window with sidebar/tab navigation       │
  │  • Modal dialogs for settings/preferences            │
  │  • Examples: VS Code, Slack, Notion                  │
  │  • Best for: productivity apps, dashboards           │
  │                                                      │
  │  PATTERN 2: Multi-Window (MDI)                       │
  │  • Multiple document windows                         │
  │  • Each window is independent                        │
  │  • Examples: Photoshop, Figma desktop                │
  │  • Best for: creative tools, editors                 │
  │                                                      │
  │  PATTERN 3: Menu Bar / System Tray                   │
  │  • No main window (or minimal)                       │
  │  • Lives in menu bar (macOS) or system tray          │
  │  • Examples: 1Password mini, Dropbox, CleanMyMac     │
  │  • Best for: utilities, background services          │
  │                                                      │
  │  PATTERN 4: Background Service + UI                  │
  │  • Background daemon/service always running          │
  │  • UI opens on demand                                │
  │  • Examples: Docker Desktop, VPN clients             │
  │  • Best for: services with occasional UI interaction │
  └──────────────────────────────────────────────────────┘
```

### 5.1 Cross-Platform Keyboard Shortcuts

```
  KEYBOARD SHORTCUTS BY PLATFORM

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Action        macOS           Windows/Linux         │
  │  ─────────────────────────────────────────────       │
  │  Save          Cmd+S           Ctrl+S                │
  │  Undo          Cmd+Z           Ctrl+Z                │
  │  Redo          Cmd+Shift+Z     Ctrl+Y                │
  │  Copy          Cmd+C           Ctrl+C                │
  │  Paste         Cmd+V           Ctrl+V                │
  │  Find          Cmd+F           Ctrl+F                │
  │  Preferences   Cmd+,           Ctrl+, (or File menu) │
  │  Quit          Cmd+Q           Alt+F4                │
  │  New Window    Cmd+N           Ctrl+N                │
  │  Close Window  Cmd+W           Ctrl+W                │
  │                                                      │
  │  RULE: ALWAYS respect platform keyboard conventions. │
  │  Use CmdOrCtrl in Electron/Tauri for cross-platform. │
  │  macOS users expect Cmd, Windows users expect Ctrl.  │
  └──────────────────────────────────────────────────────┘
```

### 5.2 Desktop App Performance

```
  DESKTOP PERFORMANCE TARGETS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Cold startup:        <3 seconds                     │
  │  Window switch:       <100ms                         │
  │  File open (<10MB):   <500ms                         │
  │  Memory (idle):       <100MB (web-based)             │
  │                       <50MB (native)                 │
  │  Memory (active):     <300MB (web-based)             │
  │                       <150MB (native)                │
  │  CPU (idle):          <1%                            │
  │  Installer size:      <15MB (Tauri)                  │
  │                       <200MB (Electron)              │
  │                       <30MB (native)                 │
  │                                                      │
  │  OPTIMIZATION TECHNIQUES:                            │
  │  • Lazy-load windows and heavy modules               │
  │  • Virtual scrolling for large lists                 │
  │  • Web Workers / background threads for computation  │
  │  • Compress and optimize bundled assets               │
  │  • Use native file dialogs (not web-based)           │
  └──────────────────────────────────────────────────────┘
```

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Native for business apps** | 6-month dev time for a CRUD desktop app | Use Tauri or Electron — web technologies are sufficient |
| **Electron for tiny utility** | 150MB download for a system tray clock app | Tauri (3MB) or native platform utility |
| **No auto-update** | Users run outdated versions with known bugs | Implement auto-update from day 1 |
| **No code signing** | macOS blocks app, Windows shows SmartScreen warning | Sign with Apple Developer / Microsoft Authenticode |
| **Ignoring platform conventions** | Mac app uses Windows-style menus, Linux app uses Windows dialogs | Follow HIG (Apple), Fluent (Microsoft), GNOME/KDE guidelines |
| **One-size-fits-all UI** | macOS app looks alien, Windows app feels wrong | Adapt UI to platform conventions (native menus, shortcuts) |
| **No crash reporting** | Desktop app crashes silently, user churns | Integrate Sentry or custom crash reporter |
| **Qt without license review** | GPL contamination in proprietary app | Review Qt licensing (GPL/LGPL/commercial) before choosing |

---

## 6. Enforcement Checklist

### Decision
- [ ] Framework chosen based on requirements (not team preference alone)
- [ ] Performance requirements evaluated
- [ ] Platform targets defined (Windows, macOS, Linux)
- [ ] App size budget established
- [ ] Licensing reviewed (especially Qt)

### Distribution
- [ ] Code signing configured for macOS and Windows
- [ ] macOS app notarized by Apple
- [ ] Auto-update mechanism implemented
- [ ] Platform-specific installers created
- [ ] Crash reporting integrated

### UX
- [ ] Platform UI conventions followed (HIG, Fluent)
- [ ] Native menus and keyboard shortcuts
- [ ] Window state persistence (size, position)
- [ ] Dark mode support
- [ ] Accessibility (screen reader, keyboard navigation)
