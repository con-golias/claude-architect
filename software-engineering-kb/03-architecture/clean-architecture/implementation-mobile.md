# Clean Architecture: Mobile Implementation — Complete Guide

> **AI Plugin Directive:** When building ANY mobile application (Android, iOS, Flutter, React Native), follow these exact patterns. Mobile has unique concerns: offline-first, lifecycle management, platform APIs. Every pattern here is production-tested at scale.

---

## 1. Project Structure for Mobile Apps

### Android (Kotlin) — Multi-Module

```
app/                                    # App module (composition root)
├── src/main/kotlin/com/app/
│   ├── di/                            # Hilt modules
│   │   ├── AppModule.kt
│   │   ├── NetworkModule.kt
│   │   └── DatabaseModule.kt
│   ├── navigation/
│   │   └── AppNavigation.kt
│   └── App.kt
├── build.gradle.kts

feature/                               # Feature modules
├── ordering/
│   ├── domain/                        # Pure Kotlin module (NO Android deps)
│   │   ├── src/main/kotlin/
│   │   │   ├── entities/
│   │   │   │   ├── Order.kt
│   │   │   │   └── OrderItem.kt
│   │   │   ├── valueobjects/
│   │   │   │   ├── OrderId.kt
│   │   │   │   ├── Money.kt
│   │   │   │   └── OrderStatus.kt
│   │   │   ├── events/
│   │   │   │   └── OrderEvents.kt
│   │   │   ├── errors/
│   │   │   │   └── OrderErrors.kt
│   │   │   └── ports/
│   │   │       └── OrderRepository.kt
│   │   └── build.gradle.kts           # kotlin("jvm") — NO Android plugin!
│   ├── data/                          # Data module
│   │   ├── src/main/kotlin/
│   │   │   ├── local/
│   │   │   │   ├── OrderDao.kt
│   │   │   │   ├── OrderEntity.kt     # Room entity
│   │   │   │   └── OrderDatabase.kt
│   │   │   ├── remote/
│   │   │   │   ├── OrderApi.kt        # Retrofit interface
│   │   │   │   ├── OrderDto.kt
│   │   │   │   └── OrderRemoteDataSource.kt
│   │   │   ├── mappers/
│   │   │   │   └── OrderMapper.kt
│   │   │   └── repository/
│   │   │       └── OrderRepositoryImpl.kt
│   │   └── build.gradle.kts           # android library
│   └── presentation/                  # Presentation module
│       ├── src/main/kotlin/
│       │   ├── list/
│       │   │   ├── OrderListScreen.kt
│       │   │   ├── OrderListViewModel.kt
│       │   │   └── OrderListUiState.kt
│       │   ├── detail/
│       │   │   ├── OrderDetailScreen.kt
│       │   │   └── OrderDetailViewModel.kt
│       │   ├── create/
│       │   │   ├── CreateOrderScreen.kt
│       │   │   └── CreateOrderViewModel.kt
│       │   └── di/
│       │       └── OrderModule.kt     # Hilt module for this feature
│       └── build.gradle.kts           # android library + compose

core/                                  # Core/shared modules
├── domain/                            # Shared domain abstractions
│   ├── src/main/kotlin/
│   │   ├── base/
│   │   │   ├── AggregateRoot.kt
│   │   │   ├── Entity.kt
│   │   │   ├── ValueObject.kt
│   │   │   └── DomainEvent.kt
│   │   └── types/
│   │       ├── Result.kt
│   │       └── Pagination.kt
│   └── build.gradle.kts               # kotlin("jvm")
├── network/
│   ├── src/main/kotlin/
│   │   ├── HttpClient.kt
│   │   ├── AuthInterceptor.kt
│   │   └── NetworkMonitor.kt
│   └── build.gradle.kts
├── database/
│   └── build.gradle.kts
└── ui/                                # Shared UI components
    ├── src/main/kotlin/
    │   ├── components/
    │   └── theme/
    └── build.gradle.kts
```

### iOS (Swift) — Package-Based

```
Project/
├── App/                               # Main app target
│   ├── App.swift
│   ├── AppDelegate.swift
│   ├── DependencyContainer.swift      # Composition root
│   └── Navigation/
│       └── AppCoordinator.swift
├── Packages/                          # Swift Package Manager
│   ├── OrderingDomain/                # Pure Swift package (NO UIKit/SwiftUI)
│   │   ├── Sources/
│   │   │   ├── Entities/
│   │   │   │   ├── Order.swift
│   │   │   │   └── OrderItem.swift
│   │   │   ├── ValueObjects/
│   │   │   │   ├── OrderId.swift
│   │   │   │   ├── Money.swift
│   │   │   │   └── OrderStatus.swift
│   │   │   ├── Events/
│   │   │   │   └── OrderEvents.swift
│   │   │   ├── Errors/
│   │   │   │   └── OrderErrors.swift
│   │   │   └── Ports/
│   │   │       └── OrderRepository.swift
│   │   └── Package.swift              # NO platform-specific deps
│   ├── OrderingData/
│   │   ├── Sources/
│   │   │   ├── Local/
│   │   │   │   ├── OrderCoreDataModel.swift
│   │   │   │   └── CoreDataOrderRepository.swift
│   │   │   ├── Remote/
│   │   │   │   ├── OrderDTO.swift
│   │   │   │   └── OrderAPIService.swift
│   │   │   ├── Mappers/
│   │   │   │   └── OrderMapper.swift
│   │   │   └── Repository/
│   │   │       └── OrderRepositoryImpl.swift
│   │   └── Package.swift              # Depends on OrderingDomain
│   ├── OrderingPresentation/
│   │   ├── Sources/
│   │   │   ├── OrderListView.swift
│   │   │   ├── OrderListViewModel.swift
│   │   │   ├── OrderDetailView.swift
│   │   │   └── OrderDetailViewModel.swift
│   │   └── Package.swift              # Depends on OrderingDomain
│   └── SharedDomain/
│       ├── Sources/
│       │   ├── AggregateRoot.swift
│       │   ├── ValueObject.swift
│       │   └── Result+Extensions.swift
│       └── Package.swift
```

### Flutter (Dart)

```
lib/
├── features/
│   ├── ordering/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── order.dart
│   │   │   │   └── order_item.dart
│   │   │   ├── value_objects/
│   │   │   │   ├── order_id.dart
│   │   │   │   ├── money.dart
│   │   │   │   └── order_status.dart
│   │   │   ├── errors/
│   │   │   │   └── order_failures.dart
│   │   │   └── ports/
│   │   │       └── order_repository.dart
│   │   ├── application/
│   │   │   ├── blocs/                 # or riverpod providers
│   │   │   │   ├── order_list_bloc.dart
│   │   │   │   ├── order_list_event.dart
│   │   │   │   ├── order_list_state.dart
│   │   │   │   └── order_detail_bloc.dart
│   │   │   └── use_cases/
│   │   │       ├── create_order.dart
│   │   │       └── submit_order.dart
│   │   ├── infrastructure/
│   │   │   ├── datasources/
│   │   │   │   ├── order_local_datasource.dart
│   │   │   │   └── order_remote_datasource.dart
│   │   │   ├── models/
│   │   │   │   ├── order_model.dart
│   │   │   │   └── order_model.g.dart  # Generated
│   │   │   ├── mappers/
│   │   │   │   └── order_mapper.dart
│   │   │   └── repositories/
│   │   │       └── order_repository_impl.dart
│   │   └── presentation/
│   │       ├── pages/
│   │       │   ├── order_list_page.dart
│   │       │   └── order_detail_page.dart
│   │       └── widgets/
│   │           ├── order_card.dart
│   │           └── order_status_badge.dart
│   ├── catalog/
│   └── auth/
├── core/
│   ├── domain/
│   │   ├── entity.dart
│   │   ├── value_object.dart
│   │   └── failure.dart
│   ├── infrastructure/
│   │   ├── network/
│   │   │   └── dio_client.dart
│   │   └── storage/
│   │       └── hive_storage.dart
│   └── presentation/
│       ├── widgets/
│       └── theme/
├── di/
│   └── injection.dart                 # GetIt configuration
└── main.dart
```

---

## 2. Presentation Layer

### MVVM with Clean Architecture (Android/Kotlin)

```kotlin
// presentation/list/OrderListUiState.kt
sealed interface OrderListUiState {
    data object Loading : OrderListUiState
    data class Success(
        val orders: List<OrderUiModel>,
        val isRefreshing: Boolean = false,
        val hasMore: Boolean = true,
    ) : OrderListUiState
    data class Error(val message: String, val retry: Boolean = true) : OrderListUiState
}

data class OrderUiModel(
    val id: String,
    val title: String,
    val statusText: String,
    val statusColor: Color,
    val totalFormatted: String,
    val dateFormatted: String,
    val itemCount: Int,
)

// presentation/list/OrderListViewModel.kt
@HiltViewModel
class OrderListViewModel @Inject constructor(
    private val getOrders: GetOrdersUseCase,
    private val submitOrder: SubmitOrderUseCase,
) : ViewModel() {

    private val _uiState = MutableStateFlow<OrderListUiState>(OrderListUiState.Loading)
    val uiState: StateFlow<OrderListUiState> = _uiState.asStateFlow()

    private var currentPage = 1

    init {
        loadOrders()
    }

    fun loadOrders() {
        viewModelScope.launch {
            _uiState.value = OrderListUiState.Loading
            getOrders(page = 1, limit = 20)
                .onSuccess { result ->
                    currentPage = 1
                    _uiState.value = OrderListUiState.Success(
                        orders = result.items.map { it.toUiModel() },
                        hasMore = result.hasMore,
                    )
                }
                .onFailure { error ->
                    _uiState.value = OrderListUiState.Error(
                        message = error.toUserMessage(),
                        retry = error.isRetryable,
                    )
                }
        }
    }

    fun loadMore() {
        val current = _uiState.value as? OrderListUiState.Success ?: return
        if (!current.hasMore) return

        viewModelScope.launch {
            getOrders(page = currentPage + 1, limit = 20)
                .onSuccess { result ->
                    currentPage++
                    _uiState.value = current.copy(
                        orders = current.orders + result.items.map { it.toUiModel() },
                        hasMore = result.hasMore,
                    )
                }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            val current = _uiState.value as? OrderListUiState.Success
            if (current != null) {
                _uiState.value = current.copy(isRefreshing = true)
            }
            getOrders(page = 1, limit = 20)
                .onSuccess { result ->
                    currentPage = 1
                    _uiState.value = OrderListUiState.Success(
                        orders = result.items.map { it.toUiModel() },
                        hasMore = result.hasMore,
                    )
                }
        }
    }

    fun submitOrder(orderId: String) {
        viewModelScope.launch {
            submitOrder.execute(orderId)
                .onSuccess { refresh() }
                .onFailure { error ->
                    // Show snackbar or dialog
                }
        }
    }

    private fun Order.toUiModel() = OrderUiModel(
        id = id.value,
        title = "Order #${id.value.take(8)}",
        statusText = status.toDisplayText(),
        statusColor = status.toColor(),
        totalFormatted = totalAmount.toFormattedString(),
        dateFormatted = createdAt.toRelativeString(),
        itemCount = items.size,
    )
}

// presentation/list/OrderListScreen.kt (Compose)
@Composable
fun OrderListScreen(
    viewModel: OrderListViewModel = hiltViewModel(),
    onOrderClick: (String) -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    when (val state = uiState) {
        is OrderListUiState.Loading -> LoadingIndicator()
        is OrderListUiState.Error -> ErrorState(
            message = state.message,
            onRetry = if (state.retry) viewModel::loadOrders else null,
        )
        is OrderListUiState.Success -> {
            SwipeRefresh(
                isRefreshing = state.isRefreshing,
                onRefresh = viewModel::refresh,
            ) {
                LazyColumn {
                    items(state.orders, key = { it.id }) { order ->
                        OrderCard(
                            order = order,
                            onClick = { onOrderClick(order.id) },
                        )
                    }
                    if (state.hasMore) {
                        item {
                            LaunchedEffect(Unit) { viewModel.loadMore() }
                            CircularProgressIndicator(modifier = Modifier.padding(16.dp))
                        }
                    }
                }
            }
        }
    }
}
```

### iOS SwiftUI + Combine

```swift
// presentation/OrderListViewModel.swift
@MainActor
final class OrderListViewModel: ObservableObject {
    enum State {
        case loading
        case loaded(orders: [OrderUiModel], hasMore: Bool)
        case error(message: String)
    }

    @Published var state: State = .loading
    @Published var isRefreshing = false

    private let getOrders: GetOrdersUseCase
    private let submitOrder: SubmitOrderUseCase
    private var currentPage = 1

    init(getOrders: GetOrdersUseCase, submitOrder: SubmitOrderUseCase) {
        self.getOrders = getOrders
        self.submitOrder = submitOrder
    }

    func loadOrders() async {
        state = .loading
        do {
            let result = try await getOrders.execute(page: 1, limit: 20)
            currentPage = 1
            state = .loaded(
                orders: result.items.map { $0.toUiModel() },
                hasMore: result.hasMore
            )
        } catch {
            state = .error(message: error.localizedDescription)
        }
    }

    func loadMore() async {
        guard case .loaded(let orders, true) = state else { return }
        do {
            let result = try await getOrders.execute(page: currentPage + 1, limit: 20)
            currentPage += 1
            state = .loaded(
                orders: orders + result.items.map { $0.toUiModel() },
                hasMore: result.hasMore
            )
        } catch {
            // Keep existing data on pagination error
        }
    }

    func refresh() async {
        isRefreshing = true
        await loadOrders()
        isRefreshing = false
    }
}

// presentation/OrderListView.swift
struct OrderListView: View {
    @StateObject private var viewModel: OrderListViewModel

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                ProgressView()
            case .error(let message):
                ErrorView(message: message, onRetry: {
                    Task { await viewModel.loadOrders() }
                })
            case .loaded(let orders, let hasMore):
                List {
                    ForEach(orders) { order in
                        NavigationLink(destination: OrderDetailView(orderId: order.id)) {
                            OrderRow(order: order)
                        }
                    }
                    if hasMore {
                        ProgressView()
                            .onAppear {
                                Task { await viewModel.loadMore() }
                            }
                    }
                }
                .refreshable {
                    await viewModel.refresh()
                }
            }
        }
        .task { await viewModel.loadOrders() }
    }
}
```

### Flutter BLoC

```dart
// application/blocs/order_list_bloc.dart
class OrderListBloc extends Bloc<OrderListEvent, OrderListState> {
  final GetOrdersUseCase _getOrders;

  OrderListBloc(this._getOrders) : super(OrderListInitial()) {
    on<LoadOrders>(_onLoadOrders);
    on<LoadMoreOrders>(_onLoadMore);
    on<RefreshOrders>(_onRefresh);
  }

  Future<void> _onLoadOrders(LoadOrders event, Emitter<OrderListState> emit) async {
    emit(OrderListLoading());
    final result = await _getOrders(page: 1, limit: 20);
    result.fold(
      (failure) => emit(OrderListError(failure.message)),
      (data) => emit(OrderListLoaded(
        orders: data.items.map((e) => e.toUiModel()).toList(),
        hasMore: data.hasMore,
        currentPage: 1,
      )),
    );
  }

  Future<void> _onLoadMore(LoadMoreOrders event, Emitter<OrderListState> emit) async {
    final current = state;
    if (current is! OrderListLoaded || !current.hasMore) return;

    final result = await _getOrders(page: current.currentPage + 1, limit: 20);
    result.fold(
      (failure) {}, // Keep existing data on pagination error
      (data) => emit(current.copyWith(
        orders: [...current.orders, ...data.items.map((e) => e.toUiModel())],
        hasMore: data.hasMore,
        currentPage: current.currentPage + 1,
      )),
    );
  }
}
```

---

## 3. Data Layer: Offline-First Architecture

### Repository with Local + Remote Data Sources

```kotlin
// data/repository/OrderRepositoryImpl.kt
class OrderRepositoryImpl @Inject constructor(
    private val localDataSource: OrderLocalDataSource,
    private val remoteDataSource: OrderRemoteDataSource,
    private val mapper: OrderMapper,
    private val networkMonitor: NetworkMonitor,
) : OrderRepository {

    // CACHE-FIRST strategy: Return local immediately, then sync with remote
    override fun getOrders(page: Int, limit: Int): Flow<Result<PaginatedResult<Order>>> = flow {
        // 1. Emit cached data immediately
        val cached = localDataSource.getOrders(page, limit)
        if (cached.isNotEmpty()) {
            emit(Result.success(PaginatedResult(
                items = cached.map(mapper::toDomain),
                hasMore = cached.size >= limit,
            )))
        }

        // 2. Try to fetch from remote if online
        if (networkMonitor.isOnline()) {
            try {
                val remote = remoteDataSource.getOrders(page, limit)
                // Save to local cache
                localDataSource.saveOrders(remote.items.map(mapper::toLocal))
                // Emit updated data
                emit(Result.success(PaginatedResult(
                    items = remote.items.map(mapper::toDomain),
                    hasMore = remote.hasMore,
                )))
            } catch (e: Exception) {
                // Already emitted cached data, just log the error
                if (cached.isEmpty()) {
                    emit(Result.failure(e))
                }
            }
        } else if (cached.isEmpty()) {
            emit(Result.failure(NoConnectionException()))
        }
    }

    // NETWORK-FIRST strategy for mutations
    override suspend fun submitOrder(orderId: OrderId): Result<Order> {
        return if (networkMonitor.isOnline()) {
            try {
                val dto = remoteDataSource.submitOrder(orderId.value)
                val order = mapper.toDomain(dto)
                localDataSource.updateOrder(mapper.toLocal(dto))
                Result.success(order)
            } catch (e: Exception) {
                // Queue for sync when back online
                localDataSource.queuePendingAction(
                    PendingAction.SubmitOrder(orderId.value)
                )
                Result.failure(e)
            }
        } else {
            // Queue for sync
            localDataSource.queuePendingAction(
                PendingAction.SubmitOrder(orderId.value)
            )
            // Update local state optimistically
            localDataSource.updateOrderStatus(orderId.value, "submitted")
            val cached = localDataSource.getOrderById(orderId.value)
            Result.success(mapper.toDomain(cached!!))
        }
    }
}
```

### Data Synchronization

```kotlin
// data/sync/SyncManager.kt
class SyncManager @Inject constructor(
    private val localDataSource: OrderLocalDataSource,
    private val remoteDataSource: OrderRemoteDataSource,
    private val networkMonitor: NetworkMonitor,
) {
    // Call when network becomes available
    suspend fun syncPendingActions() {
        if (!networkMonitor.isOnline()) return

        val pendingActions = localDataSource.getPendingActions()
        for (action in pendingActions) {
            try {
                when (action) {
                    is PendingAction.SubmitOrder -> {
                        remoteDataSource.submitOrder(action.orderId)
                    }
                    is PendingAction.CancelOrder -> {
                        remoteDataSource.cancelOrder(action.orderId, action.reason)
                    }
                    is PendingAction.CreateOrder -> {
                        remoteDataSource.createOrder(action.data)
                    }
                }
                localDataSource.removePendingAction(action.id)
            } catch (e: ConflictException) {
                // Server state has changed — resolve conflict
                handleConflict(action, e)
            } catch (e: Exception) {
                // Keep in queue for retry
                localDataSource.incrementRetryCount(action.id)
            }
        }
    }

    private suspend fun handleConflict(action: PendingAction, error: ConflictException) {
        // Strategy: Server wins (most common for order systems)
        val serverState = remoteDataSource.getOrder(action.orderId)
        localDataSource.updateOrder(serverState)
        localDataSource.removePendingAction(action.id)
        // Notify user about conflict resolution
    }
}

// Register with WorkManager for periodic sync
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val syncManager: SyncManager,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            syncManager.syncPendingActions()
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
```

### Local Database (Room/Android)

```kotlin
// data/local/OrderDao.kt
@Dao
interface OrderDao {
    @Query("SELECT * FROM orders ORDER BY created_at DESC LIMIT :limit OFFSET :offset")
    suspend fun getOrders(offset: Int, limit: Int): List<OrderLocalEntity>

    @Query("SELECT * FROM orders WHERE id = :id")
    suspend fun getById(id: String): OrderLocalEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(order: OrderLocalEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(orders: List<OrderLocalEntity>)

    @Query("UPDATE orders SET status = :status, updated_at = :updatedAt WHERE id = :id")
    suspend fun updateStatus(id: String, status: String, updatedAt: Long = System.currentTimeMillis())

    @Query("DELETE FROM orders WHERE id = :id")
    suspend fun delete(id: String)

    @Query("SELECT * FROM orders WHERE sync_status = 'PENDING'")
    suspend fun getPendingSyncOrders(): List<OrderLocalEntity>

    // Reactive query with Flow
    @Query("SELECT * FROM orders ORDER BY created_at DESC")
    fun observeOrders(): Flow<List<OrderLocalEntity>>

    @Query("SELECT * FROM orders WHERE id = :id")
    fun observeOrder(id: String): Flow<OrderLocalEntity?>
}

// data/local/OrderLocalEntity.kt
@Entity(tableName = "orders")
data class OrderLocalEntity(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "customer_id") val customerId: String,
    val status: String,
    @ColumnInfo(name = "total_amount") val totalAmount: Double,
    val currency: String,
    @ColumnInfo(name = "item_count") val itemCount: Int,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(name = "sync_status") val syncStatus: String = "SYNCED", // SYNCED, PENDING, CONFLICT
    @ColumnInfo(name = "items_json") val itemsJson: String, // Serialized items
)
```

---

## 4. Dependency Injection for Mobile

### Android with Hilt

```kotlin
// di/AppModule.kt
@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(context, AppDatabase::class.java, "app.db")
            .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(authInterceptor: AuthInterceptor): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(OkHttpClient.Builder()
                .addInterceptor(authInterceptor)
                .addInterceptor(HttpLoggingInterceptor().apply {
                    level = if (BuildConfig.DEBUG) Level.BODY else Level.NONE
                })
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build())
            .addConverterFactory(MoshiConverterFactory.create())
            .build()
    }
}

// feature/ordering/di/OrderModule.kt
@Module
@InstallIn(ViewModelComponent::class)  // Scoped to ViewModel lifecycle
object OrderModule {
    @Provides
    fun provideOrderRepository(
        localDataSource: OrderLocalDataSource,
        remoteDataSource: OrderRemoteDataSource,
        mapper: OrderMapper,
        networkMonitor: NetworkMonitor,
    ): OrderRepository {
        return OrderRepositoryImpl(localDataSource, remoteDataSource, mapper, networkMonitor)
    }

    @Provides
    fun provideOrderApi(retrofit: Retrofit): OrderApi {
        return retrofit.create(OrderApi::class.java)
    }

    @Provides
    fun provideOrderDao(database: AppDatabase): OrderDao {
        return database.orderDao()
    }
}
```

### Flutter with GetIt + Injectable

```dart
// di/injection.dart
@InjectableInit()
Future<void> configureDependencies() async => getIt.init();

// di/modules/network_module.dart
@module
abstract class NetworkModule {
  @singleton
  Dio get dio => Dio(BaseOptions(
    baseUrl: Environment.apiBaseUrl,
    connectTimeout: const Duration(seconds: 30),
  ))..interceptors.addAll([
    AuthInterceptor(getIt<TokenStorage>()),
    LoggingInterceptor(),
  ]);
}

// di/modules/database_module.dart
@module
abstract class DatabaseModule {
  @preResolve
  @singleton
  Future<AppDatabase> get database async => AppDatabase.create();
}

// Registrations via @injectable annotation
@Injectable(as: OrderRepository)
class OrderRepositoryImpl implements OrderRepository {
  final OrderLocalDataSource _local;
  final OrderRemoteDataSource _remote;
  final OrderMapper _mapper;

  OrderRepositoryImpl(this._local, this._remote, this._mapper);
  // ...
}

@injectable
class CreateOrderUseCase {
  final OrderRepository _repo;
  CreateOrderUseCase(this._repo);
  // ...
}
```

---

## 5. Platform-Specific Concerns

### Lifecycle-Aware Components

```kotlin
// Rule: NEVER hold references to Activities/Fragments in ViewModels
// Rule: Use lifecycle-aware collectors for Flows

// ✅ CORRECT: Collect state with lifecycle awareness
@Composable
fun OrderListScreen(viewModel: OrderListViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    // Automatically stops collecting when the composable is not visible
}

// ✅ CORRECT: For non-Compose, use repeatOnLifecycle
class OrderListFragment : Fragment() {
    private val viewModel: OrderListViewModel by viewModels()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    updateUI(state)
                }
            }
        }
    }
}

// ❌ NEVER do this
class BadViewModel(private val activity: Activity) : ViewModel() {
    // Memory leak! ViewModel outlives Activity
}
```

### Permission Handling as Infrastructure

```kotlin
// domain/ports — Domain only knows WHAT permission it needs, not HOW
interface PermissionChecker {
    suspend fun hasPermission(permission: AppPermission): Boolean
    suspend fun requestPermission(permission: AppPermission): PermissionResult
}

enum class AppPermission {
    CAMERA, LOCATION, STORAGE, NOTIFICATIONS
}

// infrastructure/android/AndroidPermissionChecker.kt
class AndroidPermissionChecker @Inject constructor(
    private val activity: ComponentActivity,
) : PermissionChecker {

    override suspend fun hasPermission(permission: AppPermission): Boolean {
        val androidPermission = permission.toAndroidPermission()
        return ContextCompat.checkSelfPermission(activity, androidPermission) ==
            PackageManager.PERMISSION_GRANTED
    }

    override suspend fun requestPermission(permission: AppPermission): PermissionResult {
        return suspendCancellableCoroutine { continuation ->
            val launcher = activity.registerForActivityResult(
                ActivityResultContracts.RequestPermission()
            ) { granted ->
                continuation.resume(
                    if (granted) PermissionResult.Granted else PermissionResult.Denied
                )
            }
            launcher.launch(permission.toAndroidPermission())
        }
    }

    private fun AppPermission.toAndroidPermission(): String = when (this) {
        AppPermission.CAMERA -> Manifest.permission.CAMERA
        AppPermission.LOCATION -> Manifest.permission.ACCESS_FINE_LOCATION
        AppPermission.STORAGE -> Manifest.permission.READ_EXTERNAL_STORAGE
        AppPermission.NOTIFICATIONS -> Manifest.permission.POST_NOTIFICATIONS
    }
}
```

### Push Notification Handling

```kotlin
// domain/ports
interface PushNotificationHandler {
    fun onTokenRefreshed(token: String)
    fun onNotificationReceived(notification: AppNotification)
}

data class AppNotification(
    val title: String,
    val body: String,
    val data: Map<String, String>,
    val type: NotificationType,
)

// infrastructure/firebase/FirebasePushHandler.kt
class FirebasePushHandler @Inject constructor(
    private val tokenRepo: PushTokenRepository,
    private val navigator: DeepLinkNavigator,
) : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        CoroutineScope(Dispatchers.IO).launch {
            tokenRepo.saveToken(token)
            tokenRepo.syncTokenToServer(token)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val notification = AppNotification(
            title = message.notification?.title ?: "",
            body = message.notification?.body ?: "",
            data = message.data,
            type = NotificationType.fromString(message.data["type"]),
        )

        when (notification.type) {
            NotificationType.ORDER_STATUS_CHANGED -> {
                // Update local database
                updateLocalOrder(notification.data["orderId"]!!)
                // Show notification
                showNotification(notification)
            }
            NotificationType.SILENT_SYNC -> {
                // Trigger background sync without showing notification
                triggerSync()
            }
        }
    }
}
```

---

## 6. Testing Strategy for Mobile

### Domain Layer Tests (Unit — No Android/iOS Dependencies)

```kotlin
// domain/entities/OrderTest.kt
class OrderTest {
    @Test
    fun `should reject submission of empty order`() {
        val order = Order.create(OrderId.generate(), CustomerId("cust-1"))

        assertThrows<EmptyOrderError> { order.submit() }
    }

    @Test
    fun `should calculate total from items`() {
        val order = Order.create(OrderId.generate(), CustomerId("cust-1"))
        order.addItem(product(price = Money(10.0, "USD")), Quantity(2))
        order.addItem(product(price = Money(5.0, "USD")), Quantity(3))

        assertEquals(Money(35.0, "USD"), order.totalAmount)
    }

    @Test
    fun `should emit OrderSubmitted event on submission`() {
        val order = orderWithItems()
        order.submit()

        assertTrue(order.domainEvents.any { it is OrderSubmittedEvent })
    }
}
```

### ViewModel Tests

```kotlin
// presentation/list/OrderListViewModelTest.kt
@OptIn(ExperimentalCoroutinesApi::class)
class OrderListViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule() // Sets Dispatchers.Main to TestDispatcher

    private val getOrders = mockk<GetOrdersUseCase>()
    private lateinit var viewModel: OrderListViewModel

    @Test
    fun `should load orders on init`() = runTest {
        coEvery { getOrders(page = 1, limit = 20) } returns Result.success(
            PaginatedResult(
                items = listOf(testOrder()),
                hasMore = false,
            )
        )

        viewModel = OrderListViewModel(getOrders, mockk())

        val state = viewModel.uiState.first { it is OrderListUiState.Success }
        val success = state as OrderListUiState.Success
        assertEquals(1, success.orders.size)
        assertFalse(success.hasMore)
    }

    @Test
    fun `should show error state on failure`() = runTest {
        coEvery { getOrders(page = 1, limit = 20) } returns Result.failure(
            NetworkException("No connection")
        )

        viewModel = OrderListViewModel(getOrders, mockk())

        val state = viewModel.uiState.first { it is OrderListUiState.Error }
        assertEquals("No connection", (state as OrderListUiState.Error).message)
    }
}
```

### Repository Integration Tests

```kotlin
// data/repository/OrderRepositoryImplTest.kt
class OrderRepositoryImplTest {
    private lateinit var db: AppDatabase
    private lateinit var localDataSource: OrderLocalDataSource
    private val remoteDataSource = mockk<OrderRemoteDataSource>()
    private val networkMonitor = mockk<NetworkMonitor>()

    @Before
    fun setup() {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java
        ).build()
        localDataSource = RoomOrderLocalDataSource(db.orderDao())
    }

    @After
    fun teardown() {
        db.close()
    }

    @Test
    fun `should return cached data when offline`() = runTest {
        // Arrange: seed local DB
        localDataSource.saveOrders(listOf(testOrderEntity()))
        every { networkMonitor.isOnline() } returns false

        val repo = OrderRepositoryImpl(localDataSource, remoteDataSource, OrderMapper(), networkMonitor)

        // Act
        val result = repo.getOrders(1, 20).first()

        // Assert
        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().items.size)
        coVerify(exactly = 0) { remoteDataSource.getOrders(any(), any()) }
    }

    @Test
    fun `should sync with remote when online`() = runTest {
        every { networkMonitor.isOnline() } returns true
        coEvery { remoteDataSource.getOrders(1, 20) } returns RemoteResult(
            items = listOf(testOrderDto()),
            hasMore = false,
        )

        val repo = OrderRepositoryImpl(localDataSource, remoteDataSource, OrderMapper(), networkMonitor)

        val results = repo.getOrders(1, 20).toList()

        // Should emit remote data
        assertTrue(results.last().isSuccess)
        // Should have cached locally
        val cached = localDataSource.getOrders(0, 20)
        assertEquals(1, cached.size)
    }
}
```

---

## 7. Complete Working Examples

### Full Authentication Flow (Mobile)

```kotlin
// domain/entities/Session.kt
data class Session(
    val userId: UserId,
    val accessToken: Token,
    val refreshToken: Token,
    val expiresAt: Instant,
) {
    val isExpired: Boolean get() = Instant.now().isAfter(expiresAt)
    val needsRefresh: Boolean get() = Instant.now().isAfter(expiresAt.minus(5, ChronoUnit.MINUTES))
}

// domain/ports/AuthRepository.kt
interface AuthRepository {
    suspend fun login(email: Email, password: Password): Result<Session>
    suspend fun refreshSession(refreshToken: Token): Result<Session>
    suspend fun logout(): Result<Unit>
    fun observeSession(): Flow<Session?>
}

// domain/ports/SecureStorage.kt
interface SecureStorage {
    suspend fun saveSession(session: Session)
    suspend fun getSession(): Session?
    suspend fun clearSession()
}

// application/use-cases/LoginUseCase.kt
class LoginUseCase @Inject constructor(
    private val authRepo: AuthRepository,
    private val secureStorage: SecureStorage,
    private val pushTokenRepo: PushTokenRepository,
) {
    suspend fun execute(email: String, password: String): Result<LoginResult> {
        val emailVo = Email.create(email).getOrElse { return Result.failure(it) }
        val passwordVo = Password.create(password).getOrElse { return Result.failure(it) }

        return authRepo.login(emailVo, passwordVo)
            .onSuccess { session ->
                secureStorage.saveSession(session)
                pushTokenRepo.syncTokenToServer(session.accessToken)
            }
            .map { session ->
                LoginResult(
                    userId = session.userId.value,
                    displayName = session.displayName,
                )
            }
    }
}

// data/repository/AuthRepositoryImpl.kt
class AuthRepositoryImpl @Inject constructor(
    private val api: AuthApi,
    private val secureStorage: SecureStorage,
    private val mapper: AuthMapper,
) : AuthRepository {

    override suspend fun login(email: Email, password: Password): Result<Session> {
        return try {
            val response = api.login(LoginRequest(email.value, password.value))
            val session = mapper.toDomain(response)
            secureStorage.saveSession(session)
            Result.success(session)
        } catch (e: HttpException) {
            when (e.code()) {
                401 -> Result.failure(InvalidCredentialsError())
                429 -> Result.failure(TooManyAttemptsError())
                else -> Result.failure(AuthenticationError(e.message()))
            }
        } catch (e: IOException) {
            Result.failure(NetworkException("No connection"))
        }
    }

    override suspend fun refreshSession(refreshToken: Token): Result<Session> {
        return try {
            val response = api.refresh(RefreshRequest(refreshToken.value))
            val session = mapper.toDomain(response)
            secureStorage.saveSession(session)
            Result.success(session)
        } catch (e: HttpException) {
            if (e.code() == 401) {
                secureStorage.clearSession()
                Result.failure(SessionExpiredError())
            } else {
                Result.failure(AuthenticationError(e.message()))
            }
        }
    }
}

// infrastructure/network/AuthInterceptor.kt
class AuthInterceptor @Inject constructor(
    private val secureStorage: SecureStorage,
    private val authRepository: Lazy<AuthRepository>,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val session = runBlocking { secureStorage.getSession() }
            ?: return chain.proceed(chain.request())

        // Auto-refresh if needed
        val validSession = if (session.needsRefresh) {
            runBlocking {
                authRepository.get().refreshSession(session.refreshToken)
                    .getOrNull() ?: session
            }
        } else session

        val request = chain.request().newBuilder()
            .addHeader("Authorization", "Bearer ${validSession.accessToken.value}")
            .build()

        val response = chain.proceed(request)

        // If 401, try refresh once
        if (response.code == 401) {
            response.close()
            val refreshed = runBlocking {
                authRepository.get().refreshSession(validSession.refreshToken).getOrNull()
            } ?: return response

            val retryRequest = chain.request().newBuilder()
                .addHeader("Authorization", "Bearer ${refreshed.accessToken.value}")
                .build()
            return chain.proceed(retryRequest)
        }

        return response
    }
}
```

### Full Offline-First Data List

```kotlin
// Complete flow: Fetch → Cache → Display → Sync

// 1. ViewModel observes local database reactively
@HiltViewModel
class OrderListViewModel @Inject constructor(
    private val orderRepo: OrderRepository,
    private val syncManager: SyncManager,
    private val networkMonitor: NetworkMonitor,
) : ViewModel() {

    val orders: StateFlow<OrderListUiState> = orderRepo
        .observeOrders() // Flow from Room
        .map { orders ->
            OrderListUiState.Success(
                orders = orders.map { it.toUiModel() },
                isOffline = !networkMonitor.isOnline(),
                hasPendingSync = orders.any { it.syncStatus == SyncStatus.PENDING },
            )
        }
        .catch { emit(OrderListUiState.Error(it.message ?: "Unknown error")) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), OrderListUiState.Loading)

    init {
        // Trigger sync when online
        viewModelScope.launch {
            networkMonitor.observeConnectivity()
                .filter { it == ConnectivityStatus.ONLINE }
                .collect {
                    syncManager.syncPendingActions()
                    orderRepo.refreshFromRemote()
                }
        }
    }
}
```
