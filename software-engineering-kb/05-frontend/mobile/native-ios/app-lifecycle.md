# iOS App Lifecycle — Complete Specification

> **AI Plugin Directive:** When a developer asks "iOS app lifecycle", "UIApplication states", "SceneDelegate vs AppDelegate", "background tasks iOS", "app state transitions", "iOS push notification lifecycle", "deep linking iOS", "Universal Links", "iOS background processing", "app launch optimization", or any iOS lifecycle question, ALWAYS consult this directive. Understanding the iOS app lifecycle is critical for resource management, data persistence, and user experience. ALWAYS use SceneDelegate (iOS 13+) for multi-window support — AppDelegate alone is legacy. ALWAYS use BGTaskScheduler for background work — NEVER use background fetch without the modern API. ALWAYS persist critical state in `sceneDidEnterBackground` — the system may terminate the app at any time.

**Core Rule: iOS apps transition through 5 states: Not Running → Inactive → Active → Background → Suspended. The system can TERMINATE a suspended app at ANY time without notification — ALWAYS save state before entering background. Use SwiftUI's @Environment(\.scenePhase) for lifecycle events in SwiftUI apps. Use BGTaskScheduler for ALL background processing — it provides intelligent scheduling based on battery, network, and user patterns. ALWAYS handle deep links and Universal Links in the scene delegate or SwiftUI's onOpenURL.**

---

## 1. App Lifecycle States

```
  iOS APP LIFECYCLE STATE MACHINE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  NOT RUNNING ─────────────→ INACTIVE                 │
  │  (not in memory)    launch  (in foreground,          │
  │       ▲                      not receiving events)   │
  │       │                          │                   │
  │       │                          ▼                   │
  │  TERMINATED              ←── ACTIVE                  │
  │  (by system,                 (in foreground,         │
  │   no notification)           receiving events)       │
  │       ▲                          │                   │
  │       │                          ▼                   │
  │  SUSPENDED               ←── BACKGROUND             │
  │  (in memory,                 (executing code,        │
  │   no code running)           ~30s then suspended)    │
  │                                                      │
  │  TRANSITIONS:                                        │
  │  App launched      → Not Running → Inactive → Active │
  │  User switches app → Active → Inactive → Background  │
  │  User returns      → Background → Inactive → Active  │
  │  System pressure   → Suspended → Terminated          │
  │  Phone call        → Active → Inactive → Active      │
  └──────────────────────────────────────────────────────┘
```

### 1.1 SwiftUI Lifecycle

```swift
// SwiftUI App lifecycle (RECOMMENDED for new projects)
@main
struct MyApp: App {
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .onChange(of: scenePhase) { oldPhase, newPhase in
            switch newPhase {
            case .active:
                // App is in foreground and receiving events
                // Resume operations, refresh data
                print("App became active")

            case .inactive:
                // App is visible but not receiving events
                // Pause ongoing tasks, save lightweight state
                print("App became inactive")

            case .background:
                // App is in background
                // CRITICAL: Save all state — app may be terminated
                saveAppState()
                print("App entered background")

            @unknown default:
                break
            }
        }
    }

    private func saveAppState() {
        // Persist critical data
        UserDefaults.standard.synchronize()
        // Save Core Data context
        // Finish in-progress writes
    }
}

// Deep link handling in SwiftUI
struct ContentView: View {
    var body: some View {
        NavigationStack {
            HomeView()
        }
        .onOpenURL { url in
            // Handle deep links and Universal Links
            handleDeepLink(url)
        }
    }

    private func handleDeepLink(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true) else { return }

        switch components.path {
        case "/product":
            if let id = components.queryItems?.first(where: { $0.name == "id" })?.value {
                router.navigate(to: .productDetail(id: id))
            }
        case "/settings":
            router.navigate(to: .settings)
        default:
            break
        }
    }
}
```

### 1.2 UIKit Lifecycle (SceneDelegate)

```swift
// SceneDelegate — per-window lifecycle (iOS 13+)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    var coordinator: AppCoordinator?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let window = UIWindow(windowScene: windowScene)
        self.window = window

        coordinator = AppCoordinator(window: window)
        coordinator?.start()

        // Handle deep links from cold launch
        if let urlContext = connectionOptions.urlContexts.first {
            handleDeepLink(urlContext.url)
        }
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        // Resume paused tasks, refresh UI
    }

    func sceneWillResignActive(_ scene: UIScene) {
        // Pause ongoing tasks
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        // SAVE STATE — app may be terminated
        CoreDataManager.shared.saveContext()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        // Handle deep links while app is running
        if let url = URLContexts.first?.url {
            handleDeepLink(url)
        }
    }
}

// AppDelegate — app-level events (launch, push notifications, background)
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Configure services (analytics, crash reporting, push)
        configureFirebase()
        registerBackgroundTasks()
        requestPushNotificationPermission()
        return true
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        // Send token to backend
    }
}
```

---

## 2. Launch Optimization

```
  APP LAUNCH TIMELINE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  PRE-MAIN (before your code runs):                   │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  1. Load dylibs (dynamic libraries)            │  │
  │  │  2. Rebase/bind symbols                        │  │
  │  │  3. Run initializers (+load, __attribute__)     │  │
  │  │  4. Call main()                                 │  │
  │  │                                                │  │
  │  │  OPTIMIZE: Reduce dylibs, avoid +load,         │  │
  │  │  merge frameworks, use static linking           │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  POST-MAIN (your code):                              │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  1. UIApplication init                         │  │
  │  │  2. didFinishLaunchingWithOptions              │  │
  │  │  3. Scene connection                           │  │
  │  │  4. First frame rendered                       │  │
  │  │                                                │  │
  │  │  OPTIMIZE: Defer non-critical init,            │  │
  │  │  lazy-load services, minimize first screen     │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  TARGET: <400ms total launch time                    │
  │  MEASURE: Instruments → App Launch template          │
  └──────────────────────────────────────────────────────┘
```

```swift
// Deferred initialization pattern
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

        // CRITICAL: Only essential setup here
        configureLogging()      // lightweight
        configureAnalytics()    // lightweight init, defer first event

        // DEFER: Non-critical services after first frame
        DispatchQueue.main.async {
            self.configurePushNotifications()
            self.configureInAppPurchases()
            self.preloadCaches()
        }

        return true
    }
}
```

---

## 3. Background Processing

```swift
// BGTaskScheduler — modern background processing (iOS 13+)
import BackgroundTasks

// Register in AppDelegate
func registerBackgroundTasks() {
    BGTaskScheduler.shared.register(
        forTaskWithIdentifier: "com.example.app.refresh",
        using: nil
    ) { task in
        self.handleAppRefresh(task as! BGAppRefreshTask)
    }

    BGTaskScheduler.shared.register(
        forTaskWithIdentifier: "com.example.app.db-cleanup",
        using: nil
    ) { task in
        self.handleDatabaseCleanup(task as! BGProcessingTask)
    }
}

// Schedule refresh
func scheduleAppRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: "com.example.app.refresh")
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 min
    try? BGTaskScheduler.shared.submit(request)
}

// Handle refresh
func handleAppRefresh(_ task: BGAppRefreshTask) {
    scheduleAppRefresh() // re-schedule for next time

    let operation = RefreshOperation()

    task.expirationHandler = {
        operation.cancel()
    }

    operation.completionBlock = {
        task.setTaskCompleted(success: !operation.isCancelled)
    }

    OperationQueue().addOperation(operation)
}

// Schedule processing task (long-running, needs power + WiFi)
func scheduleDatabaseCleanup() {
    let request = BGProcessingTaskRequest(identifier: "com.example.app.db-cleanup")
    request.requiresNetworkConnectivity = false
    request.requiresExternalPower = true
    try? BGTaskScheduler.shared.submit(request)
}
```

```
  BACKGROUND TASK TYPES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  BGAppRefreshTask:                                   │
  │  • Short task (~30 seconds)                          │
  │  • Periodic data refresh                             │
  │  • System decides optimal timing                     │
  │  • Use for: sync, prefetch, notifications check      │
  │                                                      │
  │  BGProcessingTask:                                   │
  │  • Long task (minutes)                               │
  │  • Runs when device is charging + idle               │
  │  • Use for: database cleanup, ML training,           │
  │    large syncs, media processing                     │
  │                                                      │
  │  URLSession background transfer:                     │
  │  • Downloads/uploads continue after app suspension   │
  │  • System manages transfers                          │
  │  • Use for: large file downloads, photo upload       │
  │                                                      │
  │  CRITICAL RULES:                                     │
  │  • ALWAYS set expirationHandler                      │
  │  • ALWAYS call setTaskCompleted                      │
  │  • Register tasks in Info.plist BGTaskSchedulerPermittedIdentifiers │
  │  • System may NOT run your task — don't rely on it   │
  └──────────────────────────────────────────────────────┘
```

---

## 4. Deep Linking & Universal Links

```swift
// Universal Links — Apple-verified deep links
// Step 1: Host apple-app-site-association on your domain
// https://example.com/.well-known/apple-app-site-association
// {
//   "applinks": {
//     "apps": [],
//     "details": [{
//       "appID": "TEAMID.com.example.app",
//       "paths": ["/product/*", "/profile/*"]
//     }]
//   }
// }

// Step 2: Handle in SceneDelegate
func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
          let url = userActivity.webpageURL else { return }

    handleUniversalLink(url)
}

func handleUniversalLink(_ url: URL) {
    let pathComponents = url.pathComponents

    if pathComponents.contains("product"), let id = pathComponents.last {
        coordinator?.navigateToProduct(id: id)
    } else if pathComponents.contains("profile"), let userId = pathComponents.last {
        coordinator?.navigateToProfile(userId: userId)
    }
}

// Custom URL schemes (simpler but less secure)
// myapp://product/123
func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    // Parse custom scheme URL
}

// SwiftUI deep link handling
.onOpenURL { url in
    // Handles both Universal Links and custom URL schemes
    deepLinkRouter.handle(url)
}
```

---

## 5. Push Notification Lifecycle

```
  PUSH NOTIFICATION FLOW

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  1. Request permission                               │
  │  UNUserNotificationCenter.requestAuthorization()     │
  │                          │                           │
  │  2. Register for remote notifications                │
  │  UIApplication.shared.registerForRemoteNotifications()│
  │                          │                           │
  │  3. Receive device token                             │
  │  didRegisterForRemoteNotificationsWithDeviceToken    │
  │  → Send token to backend                            │
  │                          │                           │
  │  4. Notification arrives                             │
  │  ┌──────────────────────┬───────────────────────┐   │
  │  │  App in foreground   │  App in background     │   │
  │  │  → willPresent       │  → didReceive          │   │
  │  │  → Show banner?      │  → User tapped?        │   │
  │  │    alert/sound/badge  │  → Route to content    │   │
  │  └──────────────────────┴───────────────────────┘   │
  │                                                      │
  │  5. User taps notification                           │
  │  didReceive response → Extract payload → Navigate    │
  └──────────────────────────────────────────────────────┘
```

```swift
// UNUserNotificationCenter delegate
class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()

    func requestPermission() async throws -> Bool {
        let center = UNUserNotificationCenter.current()
        let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
        if granted {
            await MainActor.run {
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
        return granted
    }

    // Notification received while app is in FOREGROUND
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        let userInfo = notification.request.content.userInfo
        // Process silently or show banner
        return [.banner, .sound, .badge]
    }

    // User TAPPED on notification
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse) async {
        let userInfo = response.notification.request.content.userInfo

        if let productId = userInfo["product_id"] as? String {
            // Navigate to product
            await MainActor.run {
                DeepLinkRouter.shared.navigate(to: .product(id: productId))
            }
        }
    }
}
```

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Not saving state in background** | User loses data when system terminates app | Save ALL critical state in `sceneDidEnterBackground` / `.background` phase |
| **Heavy work in didFinishLaunching** | >1s launch time, blank screen | Defer non-critical initialization after first frame |
| **Using AppDelegate only** | No multi-window support, deprecated patterns | Use SceneDelegate (UIKit) or SwiftUI App lifecycle |
| **Background fetch without BGTaskScheduler** | Legacy API, unreliable scheduling | Use BGTaskScheduler (iOS 13+) |
| **Not handling deep links** | Users can't navigate to specific content from links/notifications | Implement Universal Links + onOpenURL handler |
| **Missing expirationHandler** | Background task terminated without cleanup | ALWAYS set expirationHandler and call setTaskCompleted |
| **Synchronous I/O on main thread** | UI freezes during file/network operations | async/await or dispatch to background queue |
| **UserDefaults for large data** | Slow app launch (UserDefaults loaded into memory at launch) | Core Data / SwiftData / file system for large datasets |

---

## 7. Enforcement Checklist

### Lifecycle
- [ ] SceneDelegate or SwiftUI App lifecycle used (not AppDelegate-only)
- [ ] Critical state saved in background transition
- [ ] Launch time measured and optimized (<400ms target)
- [ ] Non-critical initialization deferred after first frame
- [ ] App handles all state transitions gracefully

### Background Processing
- [ ] BGTaskScheduler used for background work
- [ ] Background task identifiers registered in Info.plist
- [ ] expirationHandler set on ALL background tasks
- [ ] setTaskCompleted called when task finishes

### Deep Linking
- [ ] Universal Links configured (apple-app-site-association hosted)
- [ ] Custom URL scheme registered (if needed)
- [ ] Deep link handler routes to correct content
- [ ] Deep links tested from cold launch and background

### Push Notifications
- [ ] Permission requested at appropriate time (not on first launch)
- [ ] Device token sent to backend
- [ ] Foreground notification presentation configured
- [ ] Notification tap navigates to relevant content
- [ ] Badge count managed properly
