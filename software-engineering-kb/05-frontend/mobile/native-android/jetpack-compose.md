# Jetpack Compose — Complete Specification

> **AI Plugin Directive:** When a developer asks "Jetpack Compose best practices", "Compose architecture", "Compose state management", "Compose navigation", "Compose performance", "remember vs rememberSaveable", "Compose side effects", "LaunchedEffect", "Compose testing", "Material 3 Compose", "Compose theming", or any Jetpack Compose question, ALWAYS consult this directive. Jetpack Compose is Android's modern declarative UI toolkit that replaces XML layouts. ALWAYS use Compose for new Android projects — XML layouts are legacy. ALWAYS use Material 3 (Material You) for theming. ALWAYS use the Compose Navigation library with type-safe routes. ALWAYS follow unidirectional data flow (UDF) with ViewModel + StateFlow.

**Core Rule: Jetpack Compose is the DEFAULT for all new Android UI development — XML layouts are legacy. ALWAYS follow unidirectional data flow: ViewModel exposes StateFlow → Compose collects state → UI events call ViewModel methods. ALWAYS use `remember` for UI-local state and `rememberSaveable` for state that survives configuration changes. ALWAYS use `LaunchedEffect` for side effects tied to composition lifecycle. Use Hilt for dependency injection, Navigation Compose for routing, and Material 3 for theming.**

---

## 1. Compose Architecture

```
  JETPACK COMPOSE — UNIDIRECTIONAL DATA FLOW

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  ViewModel (state holder)                            │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  private val _uiState = MutableStateFlow(...)  │  │
  │  │  val uiState: StateFlow<UiState> = _uiState    │  │
  │  │                                                │  │
  │  │  fun onEvent(event: UiEvent) {                 │  │
  │  │    when (event) {                              │  │
  │  │      is LoadProducts → loadProducts()          │  │
  │  │      is DeleteProduct → deleteProduct(event.id)│  │
  │  │    }                                           │  │
  │  │  }                                             │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │ StateFlow                       │
  │                    ▼                                  │
  │  Composable (UI)                                     │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  val uiState by viewModel.uiState              │  │
  │  │    .collectAsStateWithLifecycle()              │  │
  │  │                                                │  │
  │  │  when (uiState) {                             │  │
  │  │    Loading → CircularProgressIndicator()       │  │
  │  │    Success → ProductList(products)             │  │
  │  │    Error → ErrorView(retry = { onEvent(...) }) │  │
  │  │  }                                            │  │
  │  │                                                │  │
  │  │  User action → viewModel.onEvent(...)         │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  KEY RULE: State flows DOWN, events flow UP.         │
  │  Composables are PURE functions of state.            │
  └──────────────────────────────────────────────────────┘
```

### 1.1 State Management

```kotlin
// UI State — sealed interface for exhaustive when
sealed interface ProductListUiState {
    data object Loading : ProductListUiState
    data class Success(val products: List<Product>) : ProductListUiState
    data class Error(val message: String) : ProductListUiState
}

// UI Events
sealed interface ProductListEvent {
    data object LoadProducts : ProductListEvent
    data class DeleteProduct(val id: String) : ProductListEvent
    data class SearchProducts(val query: String) : ProductListEvent
}

// ViewModel
@HiltViewModel
class ProductListViewModel @Inject constructor(
    private val repository: ProductRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow<ProductListUiState>(ProductListUiState.Loading)
    val uiState: StateFlow<ProductListUiState> = _uiState.asStateFlow()

    private val _searchQuery = MutableStateFlow("")

    init {
        loadProducts()
    }

    fun onEvent(event: ProductListEvent) {
        when (event) {
            is ProductListEvent.LoadProducts -> loadProducts()
            is ProductListEvent.DeleteProduct -> deleteProduct(event.id)
            is ProductListEvent.SearchProducts -> {
                _searchQuery.value = event.query
            }
        }
    }

    private fun loadProducts() {
        viewModelScope.launch {
            _uiState.value = ProductListUiState.Loading
            try {
                val products = repository.fetchAll()
                _uiState.value = ProductListUiState.Success(products)
            } catch (e: Exception) {
                _uiState.value = ProductListUiState.Error(e.message ?: "Unknown error")
            }
        }
    }

    private fun deleteProduct(id: String) {
        viewModelScope.launch {
            try {
                repository.delete(id)
                loadProducts() // refresh
            } catch (e: Exception) {
                // Show snackbar via SharedFlow
            }
        }
    }
}
```

### 1.2 Consuming State in Composables

```kotlin
@Composable
fun ProductListScreen(
    viewModel: ProductListViewModel = hiltViewModel(),
    onProductClick: (String) -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Products") })
        },
    ) { padding ->
        when (val state = uiState) {
            is ProductListUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }
            is ProductListUiState.Success -> {
                LazyColumn(
                    modifier = Modifier.padding(padding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(
                        items = state.products,
                        key = { it.id },
                    ) { product ->
                        ProductCard(
                            product = product,
                            onClick = { onProductClick(product.id) },
                        )
                    }
                }
            }
            is ProductListUiState.Error -> {
                ErrorView(
                    message = state.message,
                    onRetry = { viewModel.onEvent(ProductListEvent.LoadProducts) },
                    modifier = Modifier.padding(padding),
                )
            }
        }
    }
}
```

---

## 2. remember and State

```kotlin
// remember — survives recomposition, NOT configuration change
@Composable
fun ExpandableCard(title: String, content: String) {
    var isExpanded by remember { mutableStateOf(false) }

    Card(onClick = { isExpanded = !isExpanded }) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            AnimatedVisibility(visible = isExpanded) {
                Text(content, modifier = Modifier.padding(top = 8.dp))
            }
        }
    }
}

// rememberSaveable — survives configuration change (rotation, theme change)
@Composable
fun SearchBar(onSearch: (String) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }

    OutlinedTextField(
        value = query,
        onValueChange = {
            query = it
            onSearch(it)
        },
        label = { Text("Search") },
        modifier = Modifier.fillMaxWidth(),
    )
}

// derivedStateOf — computed state that only recomputes when inputs change
@Composable
fun FilteredList(items: List<Item>, query: String) {
    val filteredItems by remember(items, query) {
        derivedStateOf {
            if (query.isBlank()) items
            else items.filter { it.name.contains(query, ignoreCase = true) }
        }
    }

    LazyColumn {
        items(filteredItems, key = { it.id }) { item ->
            ItemRow(item = item)
        }
    }
}
```

```
  STATE TYPES DECISION GUIDE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Is it UI-only state (expanded, scroll position)?    │
  │  └── YES → remember { mutableStateOf(...) }          │
  │                                                      │
  │  Must it survive config change (rotation)?           │
  │  └── YES → rememberSaveable { mutableStateOf(...) }  │
  │                                                      │
  │  Is it business logic state (user data, API results)?│
  │  └── YES → ViewModel + StateFlow                     │
  │                                                      │
  │  Is it a computed value from other state?            │
  │  └── YES → derivedStateOf { }                        │
  │                                                      │
  │  Is it injected from parent?                         │
  │  └── YES → CompositionLocal or parameter             │
  └──────────────────────────────────────────────────────┘
```

---

## 3. Side Effects

```kotlin
// LaunchedEffect — run suspend function when key changes
@Composable
fun ProductDetailScreen(productId: String) {
    var product by remember { mutableStateOf<Product?>(null) }

    LaunchedEffect(productId) {
        // Runs when productId changes, cancels previous
        product = repository.fetch(productId)
    }

    product?.let { ProductDetail(it) }
}

// DisposableEffect — setup + cleanup (like useEffect cleanup)
@Composable
fun LocationTracker() {
    val context = LocalContext.current

    DisposableEffect(Unit) {
        val locationManager = context.getSystemService<LocationManager>()
        val listener = LocationListener { location -> /* update */ }
        locationManager?.requestLocationUpdates("gps", 1000L, 0f, listener)

        onDispose {
            locationManager?.removeUpdates(listener) // cleanup
        }
    }
}

// SideEffect — runs after every successful recomposition (non-suspend)
@Composable
fun AnalyticsScreen(screenName: String) {
    SideEffect {
        analytics.logScreenView(screenName)
    }
}

// rememberCoroutineScope — for event handlers (NOT composition)
@Composable
fun SnackbarDemo() {
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    Button(onClick = {
        scope.launch {
            snackbarHostState.showSnackbar("Action completed")
        }
    }) {
        Text("Show Snackbar")
    }
}
```

```
  SIDE EFFECT DECISION GUIDE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Need to run suspend function on composition?        │
  │  └── LaunchedEffect(key) { }                         │
  │                                                      │
  │  Need setup + cleanup (listener, observer)?          │
  │  └── DisposableEffect(key) { onDispose { } }        │
  │                                                      │
  │  Need to run on every recomposition (analytics)?     │
  │  └── SideEffect { }                                  │
  │                                                      │
  │  Need coroutine scope for event handler?             │
  │  └── rememberCoroutineScope()                        │
  │                                                      │
  │  Need to convert Flow to State?                      │
  │  └── flow.collectAsStateWithLifecycle()              │
  │                                                      │
  │  NEVER: Launch coroutines in composition directly    │
  │  ALWAYS: Use LaunchedEffect or rememberCoroutineScope│
  └──────────────────────────────────────────────────────┘
```

---

## 4. Navigation

```kotlin
// Navigation Compose with type-safe routes (Compose Navigation 2.8+)
@Serializable
data object Home

@Serializable
data object Explore

@Serializable
data class ProductDetail(val productId: String)

@Serializable
data object Settings

@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = Home) {
        composable<Home> {
            HomeScreen(
                onProductClick = { id ->
                    navController.navigate(ProductDetail(productId = id))
                },
            )
        }

        composable<Explore> {
            ExploreScreen()
        }

        composable<ProductDetail> { backStackEntry ->
            val args = backStackEntry.toRoute<ProductDetail>()
            ProductDetailScreen(
                productId = args.productId,
                onBack = { navController.popBackStack() },
            )
        }

        composable<Settings> {
            SettingsScreen()
        }
    }
}

// Bottom navigation with NavHost
@Composable
fun MainScreen() {
    val navController = rememberNavController()
    val currentBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = currentBackStackEntry?.destination?.route

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Home, contentDescription = "Home") },
                    label = { Text("Home") },
                    selected = currentRoute == Home::class.qualifiedName,
                    onClick = { navController.navigate(Home) { launchSingleTop = true } },
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Search, contentDescription = "Explore") },
                    label = { Text("Explore") },
                    selected = currentRoute == Explore::class.qualifiedName,
                    onClick = { navController.navigate(Explore) { launchSingleTop = true } },
                )
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Home,
            modifier = Modifier.padding(padding),
        ) {
            composable<Home> { HomeScreen() }
            composable<Explore> { ExploreScreen() }
        }
    }
}
```

---

## 5. Theming (Material 3)

```kotlin
// Theme setup
@Composable
fun AppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true, // Material You dynamic colors (Android 12+)
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context)
            else dynamicLightColorScheme(context)
        }
        darkTheme -> darkColorScheme()
        else -> lightColorScheme(
            primary = Color(0xFF6750A4),
            secondary = Color(0xFF625B71),
            tertiary = Color(0xFF7D5260),
        )
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography(
            displayLarge = TextStyle(fontSize = 57.sp, fontWeight = FontWeight.Normal),
            headlineMedium = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.SemiBold),
            titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Medium),
            bodyLarge = TextStyle(fontSize = 16.sp),
            bodyMedium = TextStyle(fontSize = 14.sp),
            labelLarge = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Medium),
        ),
        content = content,
    )
}

// Usage
MaterialTheme.colorScheme.primary
MaterialTheme.typography.titleMedium
MaterialTheme.shapes.medium
```

---

## 6. Performance

```
  COMPOSE PERFORMANCE RULES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  RULE 1: Use stable types for parameters             │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  // Compose skips recomposition when params     │  │
  │  │  // haven't changed — but only for stable types │  │
  │  │                                                │  │
  │  │  // STABLE (skippable): primitives, String,    │  │
  │  │  //   data class with stable fields, enums     │  │
  │  │                                                │  │
  │  │  // UNSTABLE (never skipped): List, Map, Set,  │  │
  │  │  //   interfaces, classes with var properties   │  │
  │  │                                                │  │
  │  │  // FIX: Use ImmutableList from kotlinx        │  │
  │  │  //   or wrap in @Stable / @Immutable          │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RULE 2: Use key in LazyColumn                       │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  items(products, key = { it.id }) { product -> │  │
  │  │    ProductCard(product)                        │  │
  │  │  }                                             │  │
  │  │  → Enables item reuse and stable animations    │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RULE 3: Defer reads (lambda-based modifiers)        │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  // BAD: State read during composition         │  │
  │  │  Modifier.offset(y = scrollOffset.dp)          │  │
  │  │                                                │  │
  │  │  // GOOD: State read deferred to layout phase  │  │
  │  │  Modifier.offset { IntOffset(0, scrollOffset) }│  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RULE 4: Use collectAsStateWithLifecycle             │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  // BAD: Collects even when app is in background│ │
  │  │  val state by flow.collectAsState()            │  │
  │  │                                                │  │
  │  │  // GOOD: Stops collection when lifecycle stops│  │
  │  │  val state by flow.collectAsStateWithLifecycle()│  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

---

## 7. Testing

```kotlin
// Compose UI testing
@get:Rule
val composeTestRule = createComposeRule()

@Test
fun productCard_displaysCorrectInfo() {
    val product = Product(id = "1", name = "Test Product", price = 29.99)

    composeTestRule.setContent {
        AppTheme {
            ProductCard(product = product, onClick = {})
        }
    }

    composeTestRule.onNodeWithText("Test Product").assertIsDisplayed()
    composeTestRule.onNodeWithText("$29.99").assertIsDisplayed()
}

@Test
fun productList_showsLoadingThenData() {
    val viewModel = ProductListViewModel(FakeProductRepository())

    composeTestRule.setContent {
        AppTheme {
            ProductListScreen(viewModel = viewModel, onProductClick = {})
        }
    }

    // Initially loading
    composeTestRule.onNodeWithContentDescription("Loading").assertIsDisplayed()

    // After data loads
    composeTestRule.waitUntilAtLeastOneExists(hasText("Product 1"))
    composeTestRule.onNodeWithText("Product 1").assertIsDisplayed()
}

@Test
fun searchBar_filtersProducts() {
    composeTestRule.setContent {
        AppTheme {
            ProductListScreen(viewModel = viewModel, onProductClick = {})
        }
    }

    composeTestRule.waitUntilAtLeastOneExists(hasText("iPhone"))

    composeTestRule.onNodeWithText("Search").performTextInput("Mac")

    composeTestRule.onNodeWithText("MacBook").assertIsDisplayed()
    composeTestRule.onNodeWithText("iPhone").assertDoesNotExist()
}

// ViewModel testing
@Test
fun `loadProducts emits Success state`() = runTest {
    val fakeRepository = FakeProductRepository(products = listOf(testProduct))
    val viewModel = ProductListViewModel(fakeRepository)

    viewModel.uiState.test {
        assertEquals(ProductListUiState.Loading, awaitItem())
        val success = awaitItem() as ProductListUiState.Success
        assertEquals(1, success.products.size)
    }
}
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **XML layouts in new code** | Mixed UI paradigms, complex interop | Use Compose for ALL new screens |
| **collectAsState (not lifecycle-aware)** | Wasted resources collecting in background | `collectAsStateWithLifecycle()` |
| **State in ViewModel as mutableStateOf** | ViewModel depends on Compose — not testable with pure Kotlin | Use `StateFlow` in ViewModel, `collectAsStateWithLifecycle` in UI |
| **LaunchedEffect(Unit) for one-shot** | Runs on every recomposition if key is wrong | Use `LaunchedEffect(true)` or move to ViewModel init |
| **Unstable parameters on Composables** | Composable recomposes even when data hasn't changed | Use `@Immutable`/`@Stable` annotations or ImmutableList |
| **Not using key in LazyColumn** | Items recompose incorrectly on list changes | Always provide `key = { it.id }` |
| **Navigation with string routes** | No type safety, runtime crashes on typos | Use type-safe routes with `@Serializable` (Navigation 2.8+) |
| **God composable** | 500+ line composable with all logic inline | Extract smaller composables, move logic to ViewModel |
| **remember without key** | Stale state when parameters change | `remember(key) { }` — recompute when key changes |

---

## 9. Enforcement Checklist

### Architecture
- [ ] Unidirectional data flow (ViewModel → StateFlow → Composable → Event)
- [ ] Sealed interface for UI states (Loading/Success/Error)
- [ ] ViewModel uses StateFlow (not mutableStateOf)
- [ ] Hilt for dependency injection
- [ ] Navigation Compose with type-safe routes

### UI
- [ ] Material 3 theme with ColorScheme.fromSeed or dynamic colors
- [ ] Composables are pure functions of parameters
- [ ] No business logic in composables
- [ ] Consistent use of MaterialTheme (colors, typography, shapes)

### Performance
- [ ] `key` parameter on ALL LazyColumn/LazyRow items
- [ ] `collectAsStateWithLifecycle` (not collectAsState)
- [ ] Stable types for composable parameters
- [ ] Lambda-based modifiers for animations (defer reads)
- [ ] derivedStateOf for computed state

### Testing
- [ ] Compose UI tests for all screens
- [ ] ViewModel unit tests with Turbine (Flow testing)
- [ ] Fake repositories for testing
- [ ] Screenshot tests for visual regression
