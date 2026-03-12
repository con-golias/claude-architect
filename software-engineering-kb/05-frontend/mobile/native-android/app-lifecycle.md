# Android App Lifecycle — Complete Specification

> **AI Plugin Directive:** When a developer asks "Android Activity lifecycle", "Android Fragment lifecycle", "Compose lifecycle", "configuration changes Android", "process death Android", "Android deep linking", "Android permissions", "Android intent handling", "onSaveInstanceState", "ViewModel lifecycle", or any Android lifecycle question, ALWAYS consult this directive. Understanding the Android lifecycle is critical for preventing memory leaks, data loss, and crashes. ALWAYS use ViewModel for state that must survive configuration changes — NEVER store data in Activity fields. ALWAYS use SavedStateHandle for state that must survive process death. ALWAYS handle configuration changes gracefully — the system WILL destroy and recreate Activities.

**Core Rule: Android DESTROYS and RECREATES Activities on configuration changes (rotation, theme change, locale change). NEVER store important state in Activity fields — it will be LOST. Use ViewModel for UI state (survives config changes, NOT process death). Use SavedStateHandle for critical state (survives process death). Use Room/DataStore for persistent data (survives everything). ALWAYS test with "Don't keep activities" developer option enabled to find process death bugs.**

---

## 1. Activity Lifecycle

```
  ANDROID ACTIVITY LIFECYCLE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  LAUNCHED                                            │
  │      │                                               │
  │      ▼                                               │
  │  onCreate()  ← Initialize UI, ViewModel, DI          │
  │      │         Called on: first launch, config change │
  │      ▼                                               │
  │  onStart()   ← Visible but not interactive           │
  │      │                                               │
  │      ▼                                               │
  │  onResume()  ← FOREGROUND — interactive, receiving   │
  │      │         events. Register listeners here.      │
  │      │                                               │
  │  ┌───┴───────────────────────────────────────┐       │
  │  │  RUNNING (user interacting)               │       │
  │  └───┬───────────────────────────────────────┘       │
  │      │                                               │
  │      ▼                                               │
  │  onPause()   ← Partially visible (dialog, PiP)      │
  │      │         Save lightweight state                │
  │      ▼                                               │
  │  onStop()    ← NOT visible. Save data, unregister    │
  │      │         listeners. May be killed after this.   │
  │      │                                               │
  │      ├──→ onRestart() → onStart() (user returns)     │
  │      │                                               │
  │      ▼                                               │
  │  onDestroy() ← Activity finishing or config change   │
  │               Check isFinishing to distinguish        │
  │                                                      │
  │  CONFIG CHANGE FLOW:                                 │
  │  onPause → onStop → onSaveInstanceState →            │
  │  onDestroy → onCreate → onStart → onResume           │
  │  ViewModel SURVIVES this — Activity does NOT         │
  │                                                      │
  │  PROCESS DEATH:                                      │
  │  System kills entire process when in background      │
  │  → ViewModel DESTROYED                               │
  │  → SavedStateHandle SURVIVES                         │
  │  → Room/DataStore data SURVIVES                      │
  └──────────────────────────────────────────────────────┘
```

### 1.1 Compose Lifecycle

```kotlin
// In Compose, lifecycle events map to composable lifecycle
@Composable
fun ProductDetailScreen(productId: String) {
    // LaunchedEffect — runs when productId changes
    // Cancels and re-launches on key change
    LaunchedEffect(productId) {
        viewModel.loadProduct(productId)
    }

    // DisposableEffect — setup + cleanup
    DisposableEffect(Unit) {
        val listener = connectivity.registerListener()
        onDispose {
            connectivity.unregisterListener(listener)
        }
    }

    // Lifecycle-aware collection
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    // Stops collection in onStop, resumes in onStart
    // ALWAYS use this instead of collectAsState()
}

// LifecycleEventEffect — respond to lifecycle events in Compose
@Composable
fun CameraScreen() {
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        // Start camera preview when screen becomes active
        cameraManager.startPreview()
    }

    LifecycleEventEffect(Lifecycle.Event.ON_PAUSE) {
        // Stop camera preview when leaving screen
        cameraManager.stopPreview()
    }
}
```

---

## 2. State Survival Guide

```
  STATE SURVIVAL ACROSS SCENARIOS

  ┌──────────────────────┬────────┬──────────┬─────────┐
  │ Storage              │ Config │ Process  │ App     │
  │                      │ Change │ Death    │ Killed  │
  ├──────────────────────┼────────┼──────────┼─────────┤
  │ Activity fields      │  ❌    │  ❌      │  ❌    │
  │ ViewModel properties │  ✅    │  ❌      │  ❌    │
  │ SavedStateHandle     │  ✅    │  ✅      │  ❌    │
  │ Room / DataStore     │  ✅    │  ✅      │  ✅    │
  │ rememberSaveable     │  ✅    │  ✅      │  ❌    │
  │ remember { }         │  ❌    │  ❌      │  ❌    │
  └──────────────────────┴────────┴──────────┴─────────┘

  WHAT TO USE:
  • UI-only state (scroll, expanded) → remember / rememberSaveable
  • Screen state (list data, loading) → ViewModel + StateFlow
  • Form input, search query → SavedStateHandle
  • User data, settings → Room / DataStore
  • Auth tokens → EncryptedSharedPreferences / Keystore
```

```kotlin
// SavedStateHandle — survives process death
@HiltViewModel
class SearchViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle,
    private val repository: ProductRepository,
) : ViewModel() {

    // This survives process death (serialized to Bundle)
    val searchQuery = savedStateHandle.getStateFlow("query", "")

    // This does NOT survive process death
    private val _results = MutableStateFlow<List<Product>>(emptyList())
    val results: StateFlow<List<Product>> = _results.asStateFlow()

    fun onSearchQueryChanged(query: String) {
        savedStateHandle["query"] = query // saved automatically
        viewModelScope.launch {
            _results.value = repository.search(query)
        }
    }
}
```

---

## 3. Configuration Changes

```
  CONFIGURATION CHANGES — WHAT TRIGGERS THEM

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  • Screen rotation (orientation)                     │
  │  • Dark/light mode toggle (uiMode)                   │
  │  • Language change (locale)                          │
  │  • Font size change (fontScale)                      │
  │  • Keyboard attached/detached                        │
  │  • Multi-window resize                               │
  │  • Screen density change                             │
  │                                                      │
  │  DEFAULT BEHAVIOR:                                   │
  │  Activity is DESTROYED and RECREATED.                │
  │  All Activity fields are LOST.                       │
  │  ViewModel SURVIVES.                                 │
  │                                                      │
  │  DO NOT override configChanges in AndroidManifest    │
  │  unless you have a VERY specific reason.             │
  │  → It prevents proper resource reloading             │
  │  → It breaks the lifecycle contract                  │
  │  → Compose handles config changes automatically      │
  └──────────────────────────────────────────────────────┘
```

---

## 4. Deep Linking

```kotlin
// AndroidManifest.xml deep link configuration
// <activity android:name=".MainActivity">
//   <!-- Custom URL scheme -->
//   <intent-filter>
//     <action android:name="android.intent.action.VIEW" />
//     <category android:name="android.intent.category.DEFAULT" />
//     <category android:name="android.intent.category.BROWSABLE" />
//     <data android:scheme="myapp" android:host="product" />
//   </intent-filter>
//
//   <!-- App Links (verified, HTTPS) -->
//   <intent-filter android:autoVerify="true">
//     <action android:name="android.intent.action.VIEW" />
//     <category android:name="android.intent.category.DEFAULT" />
//     <category android:name="android.intent.category.BROWSABLE" />
//     <data android:scheme="https" android:host="example.com" android:pathPrefix="/product" />
//   </intent-filter>
// </activity>

// Handle deep links in Navigation Compose
@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = Home) {
        composable<Home> { HomeScreen() }

        composable<ProductDetail>(
            deepLinks = listOf(
                navDeepLink<ProductDetail>(basePath = "https://example.com/product"),
                navDeepLink<ProductDetail>(basePath = "myapp://product"),
            ),
        ) { backStackEntry ->
            val args = backStackEntry.toRoute<ProductDetail>()
            ProductDetailScreen(productId = args.productId)
        }
    }
}

// Handle intent in Activity
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent) // called when app is already running
    }

    private fun handleIntent(intent: Intent) {
        intent.data?.let { uri ->
            // Navigate based on URI
            navController.handleDeepLink(intent)
        }
    }
}
```

---

## 5. Permissions

```kotlin
// Modern permission handling in Compose
@Composable
fun CameraScreen() {
    val cameraPermissionState = rememberPermissionState(Manifest.permission.CAMERA)

    when {
        cameraPermissionState.status.isGranted -> {
            CameraPreview()
        }
        cameraPermissionState.status.shouldShowRationale -> {
            // Show explanation why permission is needed
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Camera permission is needed to scan QR codes")
                Button(onClick = { cameraPermissionState.launchPermissionRequest() }) {
                    Text("Grant Permission")
                }
            }
        }
        else -> {
            // First time or permanently denied
            Button(onClick = { cameraPermissionState.launchPermissionRequest() }) {
                Text("Request Camera Permission")
            }
        }
    }
}

// Multiple permissions
@Composable
fun LocationScreen() {
    val permissionState = rememberMultiplePermissionsState(
        permissions = listOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        ),
    )

    if (permissionState.allPermissionsGranted) {
        MapView()
    } else {
        Button(onClick = { permissionState.launchMultiplePermissionRequest() }) {
            Text("Grant Location Access")
        }
    }
}
```

```
  PERMISSION BEST PRACTICES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  1. Request permissions IN CONTEXT                   │
  │     → When user taps camera button (not on launch)   │
  │                                                      │
  │  2. Explain WHY before requesting                    │
  │     → "Camera needed to scan QR codes"               │
  │                                                      │
  │  3. Handle ALL states                                │
  │     → Granted: show feature                          │
  │     → Rationale: explain + re-request                │
  │     → Denied: graceful fallback or redirect to       │
  │       Settings                                       │
  │                                                      │
  │  4. NEVER block app on permissions                   │
  │     → App should work without optional permissions   │
  │                                                      │
  │  5. Use minimum required permissions                 │
  │     → COARSE location if FINE not needed             │
  │     → READ_MEDIA_IMAGES instead of READ_EXTERNAL     │
  └──────────────────────────────────────────────────────┘
```

---

## 6. Process Death Testing

```
  TESTING FOR PROCESS DEATH

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  STEP 1: Enable "Don't keep activities"              │
  │  Settings → Developer Options → Don't keep activities│
  │  → System destroys every Activity as soon as you     │
  │    navigate away from it                             │
  │                                                      │
  │  STEP 2: Test critical flows                         │
  │  1. Fill out a form                                  │
  │  2. Press Home button                                │
  │  3. Return to app                                    │
  │  → Form data should still be there (SavedStateHandle)│
  │                                                      │
  │  STEP 3: Test with adb                               │
  │  adb shell am kill com.example.app                   │
  │  → Simulates process death while app is in background│
  │  → Return to app — state should be restored          │
  │                                                      │
  │  COMMON BUGS FOUND:                                  │
  │  • Form data lost (stored in ViewModel, not SSHandle)│
  │  • Scroll position lost                              │
  │  • Navigation state corrupted                        │
  │  • Crash on null ViewModel data                      │
  └──────────────────────────────────────────────────────┘
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **State in Activity fields** | Data lost on rotation, process death crash | ViewModel + StateFlow for UI state |
| **configChanges in manifest** | Resources not reloaded on locale/theme change, Compose recomposition broken | Let Activity recreate — ViewModel survives |
| **No process death testing** | Crashes when user returns after system kills app | Test with "Don't keep activities" enabled |
| **Blocking main thread** | ANR dialog, jank, unresponsive UI | Coroutines (viewModelScope), Room with Flow |
| **Leaking Activity reference** | Memory leak, crash on destroyed Activity callback | Use lifecycle-aware components, `[weak]` references |
| **Permissions on launch** | User denies permission, app is useless | Request in context, handle denial gracefully |
| **No SavedStateHandle** | Search query, tab position lost on process death | SavedStateHandle for lightweight restorable state |
| **Intent handled only in onCreate** | Deep link ignored when app is already running | Handle in BOTH onCreate AND onNewIntent |

---

## 8. Enforcement Checklist

### Lifecycle
- [ ] ViewModel used for ALL UI state
- [ ] SavedStateHandle for process-death-critical state
- [ ] Room/DataStore for persistent data
- [ ] `collectAsStateWithLifecycle` for Flow collection
- [ ] No configChanges override (unless justified and documented)

### Testing
- [ ] "Don't keep activities" testing passed for ALL screens
- [ ] Process death tested with `adb shell am kill`
- [ ] Configuration change tested (rotation, dark mode, locale)
- [ ] Back navigation preserves state correctly

### Deep Linking
- [ ] App Links configured with `autoVerify="true"`
- [ ] Deep links handled in both onCreate and onNewIntent
- [ ] Navigation Compose deep links configured
- [ ] Deep links tested from cold start and background

### Permissions
- [ ] Permissions requested in context (not on launch)
- [ ] Rationale shown when shouldShowRationale is true
- [ ] Graceful fallback when permission denied
- [ ] Minimum required permissions used
- [ ] Dangerous permissions not requested on app launch
- [ ] Permission state checked before using protected APIs
