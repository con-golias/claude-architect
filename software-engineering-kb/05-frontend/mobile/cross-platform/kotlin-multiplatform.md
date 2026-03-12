# Kotlin Multiplatform — Complete Specification

> **AI Plugin Directive:** When a developer asks "what is Kotlin Multiplatform?", "KMP vs Flutter vs React Native?", "shared business logic mobile", "Compose Multiplatform", "expect/actual pattern", "KMP architecture", "KMP networking", "KMP testing", "Ktor client", "SQLDelight", "KMP dependency injection", or any Kotlin Multiplatform question, ALWAYS consult this directive. Kotlin Multiplatform (KMP) is JetBrains' technology for sharing Kotlin business logic across Android, iOS, web, and desktop while keeping NATIVE UI per platform. ALWAYS use KMP when the team has Kotlin/Android expertise and wants to share business logic without sacrificing native UI. ALWAYS use Compose Multiplatform when full UI sharing is acceptable. ALWAYS use Ktor for networking, SQLDelight for local database, and Koin for dependency injection in KMP projects.

**Core Rule: KMP shares BUSINESS LOGIC (networking, validation, data models, state management) — NOT UI by default. Each platform keeps its native UI (Jetpack Compose for Android, SwiftUI for iOS). Use Compose Multiplatform ONLY when pixel-perfect platform-native UI is NOT required and the team prefers full code sharing. ALWAYS use expect/actual for platform-specific implementations. ALWAYS use Ktor Client for networking — it provides multiplatform HTTP with engine-per-platform. ALWAYS use SQLDelight for local persistence — it generates type-safe Kotlin from SQL.**

---

## 1. KMP Architecture

```
  KOTLIN MULTIPLATFORM ARCHITECTURE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  SHARED MODULE (commonMain)          written in Kotlin│
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Business Logic                               │  │
  │  │  ├── Domain Models (data classes)              │  │
  │  │  ├── Use Cases / Interactors                   │  │
  │  │  ├── Repository Interfaces                     │  │
  │  │  ├── Validation Rules                          │  │
  │  │  └── State Management (shared ViewModels)      │  │
  │  │                                                │  │
  │  │  Infrastructure                               │  │
  │  │  ├── Ktor Client (networking)                  │  │
  │  │  ├── SQLDelight (database)                     │  │
  │  │  ├── Kotlinx.serialization (JSON)              │  │
  │  │  └── Kotlinx.coroutines (async)                │  │
  │  │                                                │  │
  │  │  expect declarations (platform contracts)      │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │                                  │
  │      ┌─────────────┴──────────────┐                  │
  │      │                            │                  │
  │  ┌───▼────────────────┐  ┌───────▼──────────────┐   │
  │  │  androidMain        │  │  iosMain              │   │
  │  │  actual impls       │  │  actual impls         │   │
  │  │  ┌────────────────┐ │  │  ┌────────────────┐  │   │
  │  │  │ Android-specific│ │  │  │ iOS-specific    │  │   │
  │  │  │ implementations│ │  │  │ implementations  │  │   │
  │  │  └────────────────┘ │  │  └────────────────┘  │   │
  │  └────────────────────┘  └───────────────────────┘   │
  │      │                            │                  │
  │  ┌───▼────────────────┐  ┌───────▼──────────────┐   │
  │  │  ANDROID APP        │  │  iOS APP              │   │
  │  │  Jetpack Compose    │  │  SwiftUI              │   │
  │  │  Native Android UI  │  │  Native iOS UI        │   │
  │  └────────────────────┘  └───────────────────────┘   │
  └──────────────────────────────────────────────────────┘

  KEY INSIGHT: KMP does NOT replace native UI.
  It shares the "brain" (logic) while each platform
  keeps its "face" (native UI).
```

### 1.1 KMP vs Cross-Platform Frameworks

```
  CODE SHARING COMPARISON

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  React Native / Flutter:                             │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ████████████████████████████████████████████  │  │
  │  │  Shared UI + Logic (70-95%)                   │  │
  │  │  Platform-specific: <10%                      │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  KMP (logic only):                                   │
  │  ┌──────────────────────┐┌────────────────────────┐  │
  │  │  Shared Logic (50-70%)││ Native UI per platform │  │
  │  │  networking, models,  ││ Compose + SwiftUI      │  │
  │  │  validation, state    ││ (30-50%)               │  │
  │  └──────────────────────┘└────────────────────────┘  │
  │                                                      │
  │  KMP + Compose Multiplatform:                        │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ████████████████████████████████████████████  │  │
  │  │  Shared UI + Logic (80-95%)                   │  │
  │  │  Like Flutter but with Kotlin + Compose       │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  VERDICT:                                            │
  │  KMP (logic only) → best UI quality, more code      │
  │  KMP + CMP → maximum sharing, Kotlin ecosystem      │
  │  RN/Flutter → maximum sharing, larger communities    │
  └──────────────────────────────────────────────────────┘
```

### 1.2 Project Setup

```bash
# Use KMP Wizard: https://kmp.jetbrains.com
# Or IntelliJ/Android Studio → New Project → Kotlin Multiplatform

# Project structure:
# my-kmp-app/
# ├── shared/                          ← Shared KMP module
# │   ├── build.gradle.kts
# │   └── src/
# │       ├── commonMain/kotlin/       ← Shared code
# │       ├── commonTest/kotlin/       ← Shared tests
# │       ├── androidMain/kotlin/      ← Android-specific
# │       └── iosMain/kotlin/          ← iOS-specific
# ├── androidApp/                      ← Android application
# │   ├── build.gradle.kts
# │   └── src/main/
# ├── iosApp/                          ← iOS application (Xcode)
# │   └── iosApp/
# ├── build.gradle.kts
# └── settings.gradle.kts
```

```kotlin
// shared/build.gradle.kts
plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidLibrary)
    alias(libs.plugins.kotlinxSerialization)
    alias(libs.plugins.sqldelight)
}

kotlin {
    androidTarget()

    listOf(
        iosX64(),
        iosArm64(),
        iosSimulatorArm64()
    ).forEach { iosTarget ->
        iosTarget.binaries.framework {
            baseName = "Shared"
            isStatic = true
        }
    }

    sourceSets {
        commonMain.dependencies {
            implementation(libs.ktor.client.core)
            implementation(libs.ktor.client.content.negotiation)
            implementation(libs.ktor.serialization.kotlinx.json)
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.kotlinx.serialization.json)
            implementation(libs.sqldelight.runtime)
            implementation(libs.koin.core)
        }

        androidMain.dependencies {
            implementation(libs.ktor.client.android)
            implementation(libs.sqldelight.android.driver)
        }

        iosMain.dependencies {
            implementation(libs.ktor.client.darwin)
            implementation(libs.sqldelight.native.driver)
        }

        commonTest.dependencies {
            implementation(libs.kotlin.test)
            implementation(libs.kotlinx.coroutines.test)
            implementation(libs.ktor.client.mock)
        }
    }
}
```

---

## 2. expect/actual Pattern

```kotlin
// commonMain — expect declaration (contract)
expect class PlatformContext

expect fun getPlatformName(): String

expect class SecureStorage(context: PlatformContext) {
    fun save(key: String, value: String)
    fun read(key: String): String?
    fun delete(key: String)
}

// androidMain — actual implementation
actual typealias PlatformContext = android.content.Context

actual fun getPlatformName(): String = "Android ${Build.VERSION.SDK_INT}"

actual class SecureStorage actual constructor(
    private val context: PlatformContext
) {
    private val prefs = EncryptedSharedPreferences.create(
        context, "secure_prefs",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    actual fun save(key: String, value: String) { prefs.edit().putString(key, value).apply() }
    actual fun read(key: String): String? = prefs.getString(key, null)
    actual fun delete(key: String) { prefs.edit().remove(key).apply() }
}

// iosMain — actual implementation
actual typealias PlatformContext = Any // not needed on iOS

actual fun getPlatformName(): String = "${UIDevice.currentDevice.systemName} ${UIDevice.currentDevice.systemVersion}"

actual class SecureStorage actual constructor(context: PlatformContext) {
    actual fun save(key: String, value: String) {
        val query = mapOf<Any?, Any?>(
            kSecClass to kSecClassGenericPassword,
            kSecAttrAccount to key,
            kSecValueData to (value as NSString).dataUsingEncoding(NSUTF8StringEncoding)!!
        )
        SecItemDelete(query as CFDictionaryRef)
        SecItemAdd(query as CFDictionaryRef, null)
    }

    actual fun read(key: String): String? { /* Keychain read */ }
    actual fun delete(key: String) { /* Keychain delete */ }
}
```

```
  WHEN TO USE expect/actual

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  USE expect/actual for:                              │
  │  • Platform-specific APIs (Keychain, SharedPrefs)    │
  │  • File system access                               │
  │  • Biometric authentication                          │
  │  • Device info (OS version, device model)            │
  │  • Platform-specific date/time handling              │
  │  • Crypto operations using native libraries          │
  │                                                      │
  │  DO NOT USE expect/actual for:                       │
  │  • Networking → use Ktor (multiplatform)              │
  │  • Database → use SQLDelight (multiplatform)          │
  │  • JSON → use kotlinx.serialization (multiplatform)   │
  │  • Async → use kotlinx.coroutines (multiplatform)     │
  │  • DI → use Koin (multiplatform)                      │
  │                                                      │
  │  PREFER multiplatform libraries over expect/actual.  │
  │  expect/actual is the LAST RESORT for true           │
  │  platform-specific behavior.                         │
  └──────────────────────────────────────────────────────┘
```

---

## 3. Networking (Ktor Client)

```kotlin
// commonMain — shared HTTP client
class ApiClient(engine: HttpClientEngine) {
    private val client = HttpClient(engine) {
        install(ContentNegotiation) {
            json(Json {
                prettyPrint = true
                isLenient = true
                ignoreUnknownKeys = true
            })
        }
        install(Logging) {
            level = LogLevel.HEADERS
        }
        install(HttpTimeout) {
            requestTimeoutMillis = 15_000
            connectTimeoutMillis = 10_000
        }
        defaultRequest {
            url("https://api.example.com/v1/")
            contentType(ContentType.Application.Json)
        }
    }

    suspend fun getProducts(): List<Product> {
        return client.get("products").body()
    }

    suspend fun getProduct(id: String): Product {
        return client.get("products/$id").body()
    }

    suspend fun createProduct(request: CreateProductRequest): Product {
        return client.post("products") {
            setBody(request)
        }.body()
    }
}

// androidMain — Android engine
actual fun createHttpEngine(): HttpClientEngine = Android.create()

// iosMain — iOS engine
actual fun createHttpEngine(): HttpClientEngine = Darwin.create()
```

```kotlin
// Data models — shared across all platforms
@Serializable
data class Product(
    val id: String,
    val name: String,
    val description: String,
    val price: Double,
    val imageUrl: String,
    val category: Category,
    val createdAt: Instant,
)

@Serializable
enum class Category {
    @SerialName("electronics") ELECTRONICS,
    @SerialName("clothing") CLOTHING,
    @SerialName("books") BOOKS,
}

// Sealed class for API results
sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(val code: Int, val message: String) : ApiResult<Nothing>()
    data object Loading : ApiResult<Nothing>()
}
```

---

## 4. Local Persistence (SQLDelight)

```sql
-- shared/src/commonMain/sqldelight/com/example/db/Product.sq

CREATE TABLE product (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT NOT NULL,
    is_favorite INTEGER AS Boolean NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

getAll:
SELECT * FROM product ORDER BY created_at DESC;

getById:
SELECT * FROM product WHERE id = ?;

getFavorites:
SELECT * FROM product WHERE is_favorite = 1 ORDER BY name;

search:
SELECT * FROM product WHERE name LIKE '%' || ? || '%';

insert:
INSERT OR REPLACE INTO product(id, name, description, price, category, image_url, is_favorite, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);

toggleFavorite:
UPDATE product SET is_favorite = NOT is_favorite WHERE id = ?;

deleteById:
DELETE FROM product WHERE id = ?;

deleteAll:
DELETE FROM product;
```

```kotlin
// commonMain — repository using SQLDelight
class ProductLocalRepository(private val db: AppDatabase) {
    fun getAllProducts(): Flow<List<Product>> {
        return db.productQueries.getAll()
            .asFlow()
            .mapToList(Dispatchers.Default)
            .map { rows -> rows.map { it.toDomain() } }
    }

    fun getProduct(id: String): Flow<Product?> {
        return db.productQueries.getById(id)
            .asFlow()
            .mapToOneOrNull(Dispatchers.Default)
            .map { it?.toDomain() }
    }

    suspend fun saveProducts(products: List<Product>) {
        db.transaction {
            products.forEach { product ->
                db.productQueries.insert(
                    id = product.id,
                    name = product.name,
                    description = product.description,
                    price = product.price,
                    category = product.category.name,
                    image_url = product.imageUrl,
                    is_favorite = false,
                    created_at = product.createdAt.toEpochMilliseconds(),
                )
            }
        }
    }

    suspend fun toggleFavorite(id: String) {
        db.productQueries.toggleFavorite(id)
    }
}

// androidMain — driver
actual fun createDatabaseDriver(context: PlatformContext): SqlDriver {
    return AndroidSqliteDriver(AppDatabase.Schema, context, "app.db")
}

// iosMain — driver
actual fun createDatabaseDriver(context: PlatformContext): SqlDriver {
    return NativeSqliteDriver(AppDatabase.Schema, "app.db")
}
```

---

## 5. Shared ViewModel / State Management

```kotlin
// commonMain — shared ViewModel (using KMP-ViewModel or custom)
class ProductListViewModel(
    private val apiClient: ApiClient,
    private val localRepo: ProductLocalRepository,
) {
    private val _state = MutableStateFlow<ProductListState>(ProductListState.Loading)
    val state: StateFlow<ProductListState> = _state.asStateFlow()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    fun loadProducts() {
        scope.launch {
            _state.value = ProductListState.Loading
            try {
                val products = apiClient.getProducts()
                localRepo.saveProducts(products) // cache locally
                _state.value = ProductListState.Success(products)
            } catch (e: Exception) {
                // Fallback to local cache
                localRepo.getAllProducts().collect { cached ->
                    _state.value = if (cached.isNotEmpty()) {
                        ProductListState.Success(cached)
                    } else {
                        ProductListState.Error(e.message ?: "Unknown error")
                    }
                }
            }
        }
    }

    fun onDispose() {
        scope.cancel()
    }
}

sealed class ProductListState {
    data object Loading : ProductListState()
    data class Success(val products: List<Product>) : ProductListState()
    data class Error(val message: String) : ProductListState()
}
```

### 5.1 Consuming in Android (Jetpack Compose)

```kotlin
// androidApp — Jetpack Compose UI
@Composable
fun ProductListScreen(viewModel: ProductListViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.loadProducts()
    }

    when (val s = state) {
        is ProductListState.Loading -> {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
        is ProductListState.Success -> {
            LazyColumn {
                items(s.products, key = { it.id }) { product ->
                    ProductCard(product = product)
                }
            }
        }
        is ProductListState.Error -> {
            Column(
                Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("Error: ${s.message}")
                Button(onClick = { viewModel.loadProducts() }) {
                    Text("Retry")
                }
            }
        }
    }
}
```

### 5.2 Consuming in iOS (SwiftUI)

```swift
// iosApp — SwiftUI wrapper
import Shared // KMP framework

class ProductListObservable: ObservableObject {
    @Published var state: ProductListState = ProductListState.Loading()

    private let viewModel: ProductListViewModel

    init() {
        let apiClient = ApiClient(engine: KtorHelper().createEngine())
        let localRepo = ProductLocalRepository(db: DatabaseHelper().createDatabase())
        viewModel = ProductListViewModel(apiClient: apiClient, localRepo: localRepo)

        // Collect Kotlin Flow into SwiftUI
        FlowCollector(flow: viewModel.state) { [weak self] state in
            DispatchQueue.main.async {
                self?.state = state
            }
        }
    }

    func loadProducts() {
        viewModel.loadProducts()
    }

    deinit {
        viewModel.onDispose()
    }
}

struct ProductListView: View {
    @StateObject private var observable = ProductListObservable()

    var body: some View {
        Group {
            switch observable.state {
            case is ProductListState.Loading:
                ProgressView()
            case let success as ProductListState.Success:
                List(success.products, id: \.id) { product in
                    ProductRow(product: product)
                }
            case let error as ProductListState.Error:
                VStack {
                    Text("Error: \(error.message)")
                    Button("Retry") { observable.loadProducts() }
                }
            default:
                EmptyView()
            }
        }
        .onAppear { observable.loadProducts() }
    }
}
```

---

## 6. Dependency Injection (Koin)

```kotlin
// commonMain — shared DI modules
val sharedModule = module {
    single { ApiClient(createHttpEngine()) }
    single { AppDatabase(createDatabaseDriver(get())) }
    single { ProductLocalRepository(get()) }
    factory { ProductListViewModel(get(), get()) }
    factory { AuthViewModel(get(), get()) }
}

// androidMain
val androidModule = module {
    single<PlatformContext> { androidContext() }
}

// In Android Application class
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        startKoin {
            androidContext(this@MyApp)
            modules(sharedModule, androidModule)
        }
    }
}

// In Android Compose
@Composable
fun ProductScreen(viewModel: ProductListViewModel = koinViewModel()) {
    // viewModel injected by Koin
}

// iosMain — Koin helper for Swift
object KoinHelper {
    fun initKoin() {
        startKoin {
            modules(sharedModule, iosModule)
        }
    }

    fun getProductListViewModel(): ProductListViewModel {
        return KoinPlatform.getKoin().get()
    }
}

// In iOS AppDelegate
@main
struct MyApp: App {
    init() {
        KoinHelper().initKoin()
    }
}
```

---

## 7. Compose Multiplatform (Full UI Sharing)

```
  COMPOSE MULTIPLATFORM

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Traditional KMP:                                    │
  │  Shared Logic → Android (Compose) + iOS (SwiftUI)   │
  │  → 50-70% code sharing                              │
  │                                                      │
  │  Compose Multiplatform:                              │
  │  Shared Logic + Shared Compose UI                    │
  │  → 80-95% code sharing                              │
  │  → Same Compose code renders on Android, iOS,        │
  │    Desktop (JVM), Web (Wasm)                         │
  │                                                      │
  │  HOW IT WORKS ON iOS:                                │
  │  Compose renders to Skia canvas (like Flutter)       │
  │  → NOT using UIKit components                        │
  │  → Pixel-perfect consistency                         │
  │  → But: doesn't feel "native iOS"                    │
  │                                                      │
  │  WHEN TO USE:                                        │
  │  ✅ Team knows Kotlin + Compose                       │
  │  ✅ Custom UI that doesn't need to match platform     │
  │  ✅ Internal/enterprise apps                          │
  │  ❌ Consumer apps needing iOS-native feel             │
  │  ❌ Apps heavy on iOS-specific patterns               │
  └──────────────────────────────────────────────────────┘
```

```kotlin
// commonMain — Compose Multiplatform UI (shared across all platforms)
@Composable
fun ProductListScreen(viewModel: ProductListViewModel) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) { viewModel.loadProducts() }

    when (val s = state) {
        is ProductListState.Loading -> {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
        is ProductListState.Success -> {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(s.products, key = { it.id }) { product ->
                    ProductCard(product = product)
                }
            }
        }
        is ProductListState.Error -> {
            ErrorRetry(message = s.message) { viewModel.loadProducts() }
        }
    }
}

// This EXACT code runs on Android, iOS, Desktop, and Web
// No platform-specific UI code needed
```

---

## 8. Testing

```kotlin
// commonTest — shared tests run on ALL platforms
class ProductListViewModelTest {
    private val mockApiClient = MockApiClient()
    private val mockLocalRepo = MockProductLocalRepository()
    private lateinit var viewModel: ProductListViewModel

    @BeforeTest
    fun setup() {
        viewModel = ProductListViewModel(mockApiClient, mockLocalRepo)
    }

    @Test
    fun `loadProducts emits Success with data`() = runTest {
        mockApiClient.products = listOf(testProduct1, testProduct2)

        viewModel.loadProducts()

        val state = viewModel.state.first { it is ProductListState.Success }
        val success = state as ProductListState.Success
        assertEquals(2, success.products.size)
        assertEquals("Test Product 1", success.products[0].name)
    }

    @Test
    fun `loadProducts falls back to cache on network error`() = runTest {
        mockApiClient.shouldFail = true
        mockLocalRepo.cachedProducts = listOf(testProduct1)

        viewModel.loadProducts()

        val state = viewModel.state.first { it is ProductListState.Success }
        val success = state as ProductListState.Success
        assertEquals(1, success.products.size)
    }

    @Test
    fun `loadProducts emits Error when no cache`() = runTest {
        mockApiClient.shouldFail = true
        mockLocalRepo.cachedProducts = emptyList()

        viewModel.loadProducts()

        val state = viewModel.state.first { it is ProductListState.Error }
        assertTrue(state is ProductListState.Error)
    }
}

// Ktor MockEngine for HTTP testing
class MockApiClient {
    var products: List<Product> = emptyList()
    var shouldFail: Boolean = false

    val engine = MockEngine { request ->
        if (shouldFail) {
            respondError(HttpStatusCode.InternalServerError)
        } else {
            respond(
                content = Json.encodeToString(products),
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, "application/json")
            )
        }
    }
}

// Run tests
// ./gradlew :shared:allTests           ← all platforms
// ./gradlew :shared:testDebugUnitTest  ← Android
// ./gradlew :shared:iosSimulatorArm64Test  ← iOS
```

---

## 9. Gradle Configuration & Dependencies

```
  KMP DEPENDENCY ECOSYSTEM

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  NETWORKING:                                         │
  │  Ktor Client        — multiplatform HTTP client      │
  │  kotlinx.serialization — JSON/Protobuf/CBOR          │
  │                                                      │
  │  DATABASE:                                           │
  │  SQLDelight         — type-safe SQL, reactive queries │
  │  Realm Kotlin       — object database, offline-first  │
  │                                                      │
  │  STATE:                                              │
  │  kotlinx.coroutines — Flow, StateFlow                │
  │  KMP-ViewModel      — shared ViewModels              │
  │  Decompose          — lifecycle-aware components      │
  │                                                      │
  │  DI:                                                 │
  │  Koin               — lightweight, KMP-native        │
  │  kotlin-inject      — compile-time DI (annotation)   │
  │                                                      │
  │  DATE/TIME:                                          │
  │  kotlinx-datetime   — multiplatform date/time        │
  │                                                      │
  │  SETTINGS:                                           │
  │  multiplatform-settings — SharedPrefs / NSUserDefaults│
  │                                                      │
  │  LOGGING:                                            │
  │  Napier             — multiplatform logging           │
  │  Kermit             — multiplatform logging (Touchlab)│
  │                                                      │
  │  IMAGE:                                              │
  │  Coil (3.0+)        — Compose Multiplatform images   │
  │                                                      │
  │  TESTING:                                            │
  │  kotlin.test        — multiplatform assertions        │
  │  Turbine            — Flow testing                   │
  │  Ktor MockEngine    — HTTP mocking                   │
  └──────────────────────────────────────────────────────┘
```

---

## 10. iOS Interop Considerations

```
  KOTLIN → SWIFT INTEROP CHALLENGES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  CHALLENGE 1: Kotlin sealed class → Swift            │
  │  Kotlin: sealed class Result { ... }                 │
  │  Swift:  switch doesn't have exhaustive checking     │
  │  FIX: Use SKIE plugin for proper Swift sealed class  │
  │       mapping with exhaustive enums                  │
  │                                                      │
  │  CHALLENGE 2: Kotlin Flow → Swift                    │
  │  Kotlin: Flow<T> doesn't map to Swift AsyncSequence  │
  │  FIX: Use SKIE or KMP-NativeCoroutines              │
  │       for automatic Flow → AsyncSequence bridging    │
  │                                                      │
  │  CHALLENGE 3: Kotlin coroutines → Swift              │
  │  Kotlin: suspend fun → completion handler in Swift   │
  │  FIX: Use SKIE for native Swift async/await mapping  │
  │                                                      │
  │  CHALLENGE 4: Generic types                          │
  │  Kotlin generics erased in Objective-C interop       │
  │  FIX: Limited — design APIs with concrete types      │
  │       or use SKIE for improved mapping               │
  │                                                      │
  │  RECOMMENDED: Use SKIE (Swift Kotlin Interface       │
  │  Enhancer) by Touchlab for ALL KMP iOS projects.     │
  │  It fixes sealed classes, coroutines, and Flow       │
  │  interop automatically.                              │
  └──────────────────────────────────────────────────────┘
```

```kotlin
// Without SKIE — awkward Swift interop
// Kotlin
sealed class UiState {
    object Loading : UiState()
    data class Success(val data: List<Product>) : UiState()
    data class Error(val message: String) : UiState()
}

// Swift (without SKIE) — ugly, no exhaustive switch
let state: UiState = viewModel.state
if state is UiState.Loading {
    // ...
} else if let success = state as? UiState.Success {
    // ...
}

// With SKIE — clean Swift interop
// Swift (with SKIE) — proper enum, exhaustive switch
switch onEnum(of: viewModel.state) {
case .loading:
    ProgressView()
case .success(let data):
    ProductList(products: data.products)
case .error(let error):
    ErrorView(message: error.message)
}
```

---

## 11. Adoption Strategy

```
  KMP ADOPTION PATH

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  PHASE 1: Start Small                                │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Share ONE module:                             │  │
  │  │  • Data models (Product, User, etc.)           │  │
  │  │  • Network client (Ktor + API definitions)     │  │
  │  │  • Keep ALL UI native                          │  │
  │  │  Effort: 1-2 weeks                             │  │
  │  └────────────────────────────────────────────────┘  │
  │                          │                           │
  │                          ▼                           │
  │  PHASE 2: Expand Logic                               │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Add shared:                                   │  │
  │  │  • Validation rules                            │  │
  │  │  • Business logic / use cases                  │  │
  │  │  • Local persistence (SQLDelight)              │  │
  │  │  Effort: 2-4 weeks                             │  │
  │  └────────────────────────────────────────────────┘  │
  │                          │                           │
  │                          ▼                           │
  │  PHASE 3: Shared State                               │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Add shared:                                   │  │
  │  │  • ViewModels / state management               │  │
  │  │  • Navigation logic                            │  │
  │  │  • Authentication flow                         │  │
  │  │  Install SKIE for iOS interop                  │  │
  │  │  Effort: 2-4 weeks                             │  │
  │  └────────────────────────────────────────────────┘  │
  │                          │                           │
  │                          ▼                           │
  │  PHASE 4 (Optional): Compose Multiplatform           │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Replace SwiftUI with Compose for iOS          │  │
  │  │  → Only if native iOS feel not required        │  │
  │  │  Effort: 4-8 weeks                             │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

---

## 12. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Sharing UI code without Compose Multiplatform** | Trying to abstract UIKit/SwiftUI/Compose into shared interfaces — fragile, leaky | Share logic only; keep UI native per platform. Or fully adopt Compose Multiplatform |
| **Ignoring SKIE for iOS** | Kotlin sealed classes become unergonomic `if/else` chains in Swift; Flows require manual collection | Install SKIE — gives exhaustive Swift enums, proper async/await, Flow → AsyncSequence |
| **expect/actual for everything** | Dozens of expect/actual files when multiplatform libraries exist | Use Ktor (networking), SQLDelight (DB), kotlinx.serialization (JSON) — expect/actual only for truly platform-specific APIs |
| **Threading assumptions** | Kotlin coroutines dispatchers don't map 1:1 to iOS GCD queues; crashes on iOS | Use `Dispatchers.Main` for UI, `Dispatchers.Default` for CPU; test on both platforms |
| **Fat shared module** | Single `shared` module with thousands of files, slow compilation | Split into feature modules: `:shared:core`, `:shared:auth`, `:shared:products` |
| **No iOS testing** | Tests only run on JVM/Android; iOS-specific bugs missed | Run `iosSimulatorArm64Test` in CI — catches iOS-specific serialization/threading bugs |
| **Exposing Kotlin internals to Swift** | Swift sees internal Kotlin types, coroutine machinery, companion objects | Design clean public API surface; use `@HiddenFromObjC` for internal APIs |
| **Not using version catalogs** | Dependency versions scattered across build files, version conflicts | Use `libs.versions.toml` for centralized dependency management |

---

## 13. Enforcement Checklist

### Setup
- [ ] KMP project created with KMP Wizard or Android Studio template
- [ ] Source sets configured: `commonMain`, `androidMain`, `iosMain`, `commonTest`
- [ ] Version catalogs (`libs.versions.toml`) for dependency management
- [ ] Koin configured for cross-platform dependency injection
- [ ] SKIE installed for iOS Swift interop

### Shared Logic
- [ ] Ktor Client for ALL networking (no platform-specific HTTP)
- [ ] kotlinx.serialization for ALL JSON parsing
- [ ] SQLDelight for local persistence (or Realm Kotlin)
- [ ] kotlinx.coroutines for ALL async operations
- [ ] kotlinx-datetime for date/time handling
- [ ] expect/actual ONLY for true platform-specific APIs

### Architecture
- [ ] Data models shared in `commonMain`
- [ ] Repository interfaces in `commonMain`, implementations use Ktor/SQLDelight
- [ ] ViewModels shared with StateFlow for UI state
- [ ] Sealed classes for UI states (Loading/Success/Error)
- [ ] Feature-based module structure for large projects

### iOS Integration
- [ ] SKIE configured for sealed class/Flow/coroutine bridging
- [ ] Swift wrapper classes for Kotlin StateFlow → SwiftUI @Published
- [ ] iOS framework exported as static (not dynamic)
- [ ] CocoaPods or SPM integration configured

### Testing
- [ ] `commonTest` covers ALL shared business logic
- [ ] Ktor MockEngine for API testing
- [ ] Tests run on BOTH JVM and iOS simulator in CI
- [ ] Integration tests verify Android and iOS consumption
- [ ] SQLDelight queries tested with in-memory driver

### CI/CD
- [ ] `./gradlew :shared:allTests` runs in CI
- [ ] iOS framework build verified in CI
- [ ] Android and iOS apps build successfully with shared module
- [ ] Dependency updates tracked with Renovate/Dependabot
