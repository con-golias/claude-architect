# Android Architecture Components — Complete Specification

> **AI Plugin Directive:** When a developer asks "Android architecture", "Android MVVM", "ViewModel lifecycle", "Room database", "Hilt dependency injection", "DataStore", "WorkManager", "Android Clean Architecture", "Repository pattern Android", "Android Coroutines", "Android Flow", or any Android Architecture Components question, ALWAYS consult this directive. Android Architecture Components are Jetpack libraries that enforce separation of concerns, lifecycle awareness, and testability. ALWAYS use ViewModel for UI state — it survives configuration changes. ALWAYS use Hilt for dependency injection. ALWAYS use Room for structured local data and DataStore for key-value preferences. ALWAYS use WorkManager for guaranteed background work.

**Core Rule: EVERY Android app MUST follow the official architecture guide: UI Layer (Compose + ViewModel) → Domain Layer (Use Cases, optional) → Data Layer (Repository + DataSource). ALWAYS use ViewModel with StateFlow for UI state — NEVER put business logic in Activities/Fragments/Composables. ALWAYS use Hilt for dependency injection — manual DI does not scale. ALWAYS use Room for SQLite — raw SQL is error-prone and not type-safe. ALWAYS use WorkManager for background work that must complete — it handles constraints, retries, and chaining.**

---

## 1. Architecture Layers

```
  ANDROID RECOMMENDED ARCHITECTURE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  UI LAYER                                            │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Composables (UI)                              │  │
  │  │  ← observes state, sends events                │  │
  │  │                                                │  │
  │  │  ViewModel (state holder)                      │  │
  │  │  ← exposes StateFlow<UiState>                  │  │
  │  │  ← handles UI events                           │  │
  │  │  ← survives configuration changes              │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │                                  │
  │  DOMAIN LAYER (optional)                             │
  │  ┌─────────────────▼──────────────────────────────┐  │
  │  │  Use Cases / Interactors                       │  │
  │  │  ← single responsibility                       │  │
  │  │  ← orchestrate multiple repositories           │  │
  │  │  ← business rules                              │  │
  │  │  ← Only needed when ViewModel is too complex    │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │                                  │
  │  DATA LAYER                                          │
  │  ┌─────────────────▼──────────────────────────────┐  │
  │  │  Repository (single source of truth)           │  │
  │  │  ← coordinates data from multiple sources      │  │
  │  │  ← exposes clean API to upper layers           │  │
  │  │                                                │  │
  │  │  ┌──────────────┐  ┌────────────────────────┐  │  │
  │  │  │ Remote Source │  │ Local Source            │  │  │
  │  │  │ (Retrofit)   │  │ (Room / DataStore)      │  │  │
  │  │  └──────────────┘  └────────────────────────┘  │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘

  DEPENDENCY RULE: Dependencies point INWARD.
  UI → Domain → Data. Never the reverse.
```

### 1.1 Project Structure

```
  app/src/main/java/com/example/app/
  ├── di/                              ← Hilt modules
  │   ├── AppModule.kt
  │   ├── NetworkModule.kt
  │   └── DatabaseModule.kt
  ├── data/
  │   ├── remote/
  │   │   ├── api/
  │   │   │   └── ProductApi.kt        ← Retrofit interface
  │   │   └── dto/
  │   │       └── ProductDto.kt        ← Network DTOs
  │   ├── local/
  │   │   ├── dao/
  │   │   │   └── ProductDao.kt        ← Room DAO
  │   │   ├── entity/
  │   │   │   └── ProductEntity.kt     ← Room entity
  │   │   └── AppDatabase.kt           ← Room database
  │   └── repository/
  │       └── ProductRepositoryImpl.kt ← Repository implementation
  ├── domain/
  │   ├── model/
  │   │   └── Product.kt               ← Domain model
  │   ├── repository/
  │   │   └── ProductRepository.kt     ← Repository interface
  │   └── usecase/
  │       └── GetProductsUseCase.kt    ← Optional use cases
  └── ui/
      ├── theme/
      │   └── Theme.kt
      └── products/
          ├── ProductListScreen.kt     ← Composable
          └── ProductListViewModel.kt  ← ViewModel
```

---

## 2. ViewModel

```kotlin
// ViewModel — survives configuration changes
@HiltViewModel
class ProductListViewModel @Inject constructor(
    private val repository: ProductRepository,
    private val savedStateHandle: SavedStateHandle,
) : ViewModel() {

    // UI State
    private val _uiState = MutableStateFlow<ProductListUiState>(ProductListUiState.Loading)
    val uiState: StateFlow<ProductListUiState> = _uiState.asStateFlow()

    // One-time events (navigation, snackbar)
    private val _events = Channel<ProductListUiEvent>()
    val events = _events.receiveAsFlow()

    // Saved state (survives process death)
    private val searchQuery = savedStateHandle.getStateFlow("search", "")

    init {
        loadProducts()

        // React to search query changes
        viewModelScope.launch {
            searchQuery.debounce(300).collectLatest { query ->
                searchProducts(query)
            }
        }
    }

    fun onEvent(event: ProductListEvent) {
        when (event) {
            is ProductListEvent.Refresh -> loadProducts()
            is ProductListEvent.Search -> savedStateHandle["search"] = event.query
            is ProductListEvent.Delete -> deleteProduct(event.productId)
            is ProductListEvent.ProductClicked -> {
                viewModelScope.launch {
                    _events.send(ProductListUiEvent.NavigateToDetail(event.productId))
                }
            }
        }
    }

    private fun loadProducts() {
        viewModelScope.launch {
            _uiState.value = ProductListUiState.Loading
            repository.getProducts()
                .catch { e ->
                    _uiState.value = ProductListUiState.Error(e.message ?: "Unknown error")
                }
                .collect { products ->
                    _uiState.value = ProductListUiState.Success(products)
                }
        }
    }

    private fun deleteProduct(id: String) {
        viewModelScope.launch {
            try {
                repository.delete(id)
                _events.send(ProductListUiEvent.ShowSnackbar("Product deleted"))
            } catch (e: Exception) {
                _events.send(ProductListUiEvent.ShowSnackbar("Delete failed: ${e.message}"))
            }
        }
    }
}

// One-time UI events (navigation, snackbar — NOT state)
sealed interface ProductListUiEvent {
    data class NavigateToDetail(val productId: String) : ProductListUiEvent
    data class ShowSnackbar(val message: String) : ProductListUiEvent
}
```

---

## 3. Dependency Injection (Hilt)

```kotlin
// App-level module
@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor())
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl("https://api.example.com/v1/")
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideProductApi(retrofit: Retrofit): ProductApi {
        return retrofit.create(ProductApi::class.java)
    }
}

// Database module
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(context, AppDatabase::class.java, "app.db")
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    fun provideProductDao(database: AppDatabase): ProductDao {
        return database.productDao()
    }
}

// Repository binding
@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    @Singleton
    abstract fun bindProductRepository(impl: ProductRepositoryImpl): ProductRepository
}

// Application class
@HiltAndroidApp
class MyApp : Application()

// Activity
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AppTheme { AppNavigation() }
        }
    }
}
```

---

## 4. Data Layer

### 4.1 Room Database

```kotlin
// Entity
@Entity(tableName = "products")
data class ProductEntity(
    @PrimaryKey val id: String,
    val name: String,
    val description: String,
    val price: Double,
    val category: String,
    val imageUrl: String,
    val isFavorite: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis(),
)

// DAO
@Dao
interface ProductDao {
    @Query("SELECT * FROM products ORDER BY updatedAt DESC")
    fun getAll(): Flow<List<ProductEntity>>

    @Query("SELECT * FROM products WHERE id = :id")
    suspend fun getById(id: String): ProductEntity?

    @Query("SELECT * FROM products WHERE isFavorite = 1")
    fun getFavorites(): Flow<List<ProductEntity>>

    @Query("SELECT * FROM products WHERE name LIKE '%' || :query || '%'")
    fun search(query: String): Flow<List<ProductEntity>>

    @Upsert
    suspend fun upsert(products: List<ProductEntity>)

    @Query("DELETE FROM products WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("UPDATE products SET isFavorite = NOT isFavorite WHERE id = :id")
    suspend fun toggleFavorite(id: String)
}

// Database
@Database(entities = [ProductEntity::class], version = 1)
abstract class AppDatabase : RoomDatabase() {
    abstract fun productDao(): ProductDao
}
```

### 4.2 Repository (Single Source of Truth)

```kotlin
// Repository interface (domain layer)
interface ProductRepository {
    fun getProducts(): Flow<List<Product>>
    suspend fun getProduct(id: String): Product
    suspend fun refreshProducts()
    suspend fun delete(id: String)
}

// Repository implementation (data layer)
class ProductRepositoryImpl @Inject constructor(
    private val api: ProductApi,
    private val dao: ProductDao,
) : ProductRepository {

    // Offline-first: Room is source of truth
    override fun getProducts(): Flow<List<Product>> {
        return dao.getAll().map { entities ->
            entities.map { it.toDomain() }
        }.onStart {
            // Refresh from network in background
            try { refreshProducts() } catch (_: Exception) { }
        }
    }

    override suspend fun getProduct(id: String): Product {
        // Try local first, then remote
        val local = dao.getById(id)
        if (local != null) return local.toDomain()

        val remote = api.getProduct(id)
        dao.upsert(listOf(remote.toEntity()))
        return remote.toDomain()
    }

    override suspend fun refreshProducts() {
        val remoteProducts = api.getProducts()
        dao.upsert(remoteProducts.map { it.toEntity() })
    }

    override suspend fun delete(id: String) {
        api.deleteProduct(id)
        dao.deleteById(id)
    }
}
```

### 4.3 DataStore (Key-Value Preferences)

```kotlin
// DataStore — replacement for SharedPreferences
// NEVER use SharedPreferences for new code
val Context.settingsDataStore by preferencesDataStore(name = "settings")

class SettingsRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val dataStore = context.settingsDataStore

    val darkMode: Flow<Boolean> = dataStore.data.map { prefs ->
        prefs[DARK_MODE_KEY] ?: false
    }

    val notificationsEnabled: Flow<Boolean> = dataStore.data.map { prefs ->
        prefs[NOTIFICATIONS_KEY] ?: true
    }

    suspend fun setDarkMode(enabled: Boolean) {
        dataStore.edit { prefs ->
            prefs[DARK_MODE_KEY] = enabled
        }
    }

    suspend fun setNotifications(enabled: Boolean) {
        dataStore.edit { prefs ->
            prefs[NOTIFICATIONS_KEY] = enabled
        }
    }

    companion object {
        private val DARK_MODE_KEY = booleanPreferencesKey("dark_mode")
        private val NOTIFICATIONS_KEY = booleanPreferencesKey("notifications_enabled")
    }
}
```

---

## 5. Background Work (WorkManager)

```kotlin
// WorkManager — guaranteed background execution
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val repository: ProductRepository,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            repository.refreshProducts()
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }
}

// Schedule work
fun schedulePeriodSync(context: Context) {
    val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .setRequiresBatteryNotLow(true)
        .build()

    val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
        repeatInterval = 1, repeatIntervalTimeUnit = TimeUnit.HOURS,
    )
        .setConstraints(constraints)
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
        .build()

    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        "product_sync",
        ExistingPeriodicWorkPolicy.KEEP,
        syncRequest,
    )
}

// One-time work with chaining
fun uploadImageAndSync(context: Context, imageUri: Uri) {
    val uploadWork = OneTimeWorkRequestBuilder<UploadImageWorker>()
        .setInputData(workDataOf("image_uri" to imageUri.toString()))
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .build()

    val syncWork = OneTimeWorkRequestBuilder<SyncWorker>().build()

    WorkManager.getInstance(context)
        .beginWith(uploadWork)
        .then(syncWork) // runs after upload completes
        .enqueue()
}
```

```
  BACKGROUND WORK DECISION GUIDE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Must the work DEFINITELY complete?                  │
  │  └── YES → WorkManager                               │
  │       (survives app kill, device restart)             │
  │                                                      │
  │  Is it a simple one-shot async operation?            │
  │  └── YES → viewModelScope.launch { }                 │
  │       (cancelled when ViewModel cleared)             │
  │                                                      │
  │  Is it a coroutine tied to a lifecycle?              │
  │  └── YES → lifecycleScope.launch { }                 │
  │       (cancelled when lifecycle stops)               │
  │                                                      │
  │  NEVER: Thread(), AsyncTask (deprecated),            │
  │         IntentService (deprecated)                   │
  │                                                      │
  │  WORKMANAGER USE CASES:                              │
  │  • Upload logs/analytics                             │
  │  • Sync local data with server                       │
  │  • Download content for offline use                  │
  │  • Database cleanup/migration                        │
  │  • Scheduled notifications                           │
  └──────────────────────────────────────────────────────┘
```

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Business logic in Activity/Fragment** | God Activity with 1000+ lines, untestable | Move logic to ViewModel, data to Repository |
| **SharedPreferences for new code** | Blocking I/O on main thread, no type safety | Use DataStore (Preferences or Proto) |
| **Manual DI** | `val repo = ProductRepository(ApiClient(...), Database(...))` | Hilt — constructor injection, automatic scoping |
| **Raw SQLite** | SQL strings, no compile-time checks, manual mapping | Room — type-safe, reactive queries, migration support |
| **ViewModel depends on Android** | ViewModel imports Context/Activity — untestable | Inject abstractions via constructor (Hilt), use SavedStateHandle |
| **LiveData for new code** | No coroutine support, requires MainThread observer | StateFlow — coroutine-native, lifecycle-aware with `collectAsStateWithLifecycle` |
| **Thread() for background work** | No lifecycle awareness, no cancellation, no retry | viewModelScope/WorkManager depending on guarantee needed |
| **No offline support** | App crashes or shows empty screen without network | Repository returns Room Flow (cached data) + refreshes from network |

---

## 7. Enforcement Checklist

### Architecture
- [ ] 3-layer architecture (UI → Domain → Data)
- [ ] ViewModel for ALL UI state (no logic in Composables/Activities)
- [ ] Repository pattern for data access (single source of truth)
- [ ] Hilt for dependency injection
- [ ] Interface-based repository (domain layer defines, data layer implements)

### Data Layer
- [ ] Room for structured local data
- [ ] DataStore for key-value preferences (NOT SharedPreferences)
- [ ] Retrofit for HTTP networking
- [ ] Offline-first pattern (Room as source of truth)
- [ ] DTOs separate from domain models (mapper functions)

### Background Work
- [ ] WorkManager for guaranteed background work
- [ ] viewModelScope for ViewModel-scoped coroutines
- [ ] Constraints set on WorkManager tasks (network, battery)
- [ ] Retry policy configured for WorkManager tasks

### Quality
- [ ] ViewModel unit tests with fake repositories
- [ ] Room DAO tests with in-memory database
- [ ] Repository tests with mock API + real Room
- [ ] No Android framework dependencies in ViewModel (except SavedStateHandle)
- [ ] ProGuard/R8 rules for Retrofit, Room, Hilt
