# Android/Kotlin Project Structure

> **AI Plugin Directive:** When generating an Android project with Kotlin, ALWAYS use this structure. Apply feature-first organization with Jetpack Compose, MVVM, and Hilt for DI. This guide covers Android with Kotlin 2.0+, Compose, Material 3, and modern Jetpack libraries.

**Core Rule: Organize Android projects by feature with MVVM. Each feature module contains its own UI (Compose), ViewModel, Repository, and data sources. Use Jetpack Compose for ALL new UI — NEVER use XML layouts for new screens.**

---

## 1. Enterprise Project Structure

### Single Module

```
app/
├── src/
│   ├── main/
│   │   ├── java/com/example/myapp/
│   │   │   ├── MyApplication.kt              # Application class (@HiltAndroidApp)
│   │   │   ├── MainActivity.kt               # Single activity (Compose host)
│   │   │   │
│   │   │   ├── navigation/                    # Navigation graph
│   │   │   │   ├── AppNavHost.kt
│   │   │   │   └── Screen.kt                 # Route sealed class
│   │   │   │
│   │   │   ├── features/                      # Feature packages
│   │   │   │   ├── auth/
│   │   │   │   │   ├── ui/
│   │   │   │   │   │   ├── LoginScreen.kt
│   │   │   │   │   │   ├── RegisterScreen.kt
│   │   │   │   │   │   └── components/
│   │   │   │   │   │       ├── LoginForm.kt
│   │   │   │   │   │       └── SocialLoginButton.kt
│   │   │   │   │   ├── viewmodel/
│   │   │   │   │   │   └── AuthViewModel.kt
│   │   │   │   │   ├── data/
│   │   │   │   │   │   ├── AuthRepository.kt
│   │   │   │   │   │   ├── AuthRemoteDataSource.kt
│   │   │   │   │   │   └── model/
│   │   │   │   │   │       ├── LoginRequest.kt
│   │   │   │   │   │       └── AuthResponse.kt
│   │   │   │   │   └── domain/
│   │   │   │   │       ├── model/
│   │   │   │   │       │   └── User.kt
│   │   │   │   │       └── usecase/
│   │   │   │   │           └── LoginUseCase.kt
│   │   │   │   │
│   │   │   │   ├── users/
│   │   │   │   │   ├── ui/
│   │   │   │   │   │   ├── UserListScreen.kt
│   │   │   │   │   │   ├── UserDetailScreen.kt
│   │   │   │   │   │   └── components/
│   │   │   │   │   │       ├── UserCard.kt
│   │   │   │   │   │       └── UserAvatar.kt
│   │   │   │   │   ├── viewmodel/
│   │   │   │   │   │   ├── UserListViewModel.kt
│   │   │   │   │   │   └── UserDetailViewModel.kt
│   │   │   │   │   ├── data/
│   │   │   │   │   │   ├── UserRepository.kt
│   │   │   │   │   │   ├── UserRemoteDataSource.kt
│   │   │   │   │   │   ├── UserLocalDataSource.kt
│   │   │   │   │   │   └── model/
│   │   │   │   │   │       ├── UserDto.kt
│   │   │   │   │   │       └── UserEntity.kt  # Room entity
│   │   │   │   │   └── domain/
│   │   │   │   │       ├── model/
│   │   │   │   │       │   └── UserProfile.kt
│   │   │   │   │       └── usecase/
│   │   │   │   │           ├── GetUsersUseCase.kt
│   │   │   │   │           └── DeleteUserUseCase.kt
│   │   │   │   │
│   │   │   │   └── settings/
│   │   │   │       └── ...
│   │   │   │
│   │   │   ├── core/                          # Shared infrastructure
│   │   │   │   ├── di/                        # Hilt modules
│   │   │   │   │   ├── NetworkModule.kt
│   │   │   │   │   ├── DatabaseModule.kt
│   │   │   │   │   └── RepositoryModule.kt
│   │   │   │   ├── network/
│   │   │   │   │   ├── ApiService.kt         # Retrofit interface
│   │   │   │   │   ├── AuthInterceptor.kt
│   │   │   │   │   └── NetworkResult.kt      # Sealed class Result
│   │   │   │   ├── database/
│   │   │   │   │   ├── AppDatabase.kt        # Room database
│   │   │   │   │   └── Converters.kt         # Type converters
│   │   │   │   ├── datastore/
│   │   │   │   │   └── UserPreferences.kt    # DataStore
│   │   │   │   └── util/
│   │   │   │       ├── Extensions.kt
│   │   │   │       └── DateUtils.kt
│   │   │   │
│   │   │   └── designsystem/                 # Shared UI
│   │   │       ├── theme/
│   │   │       │   ├── Theme.kt
│   │   │       │   ├── Color.kt
│   │   │       │   ├── Type.kt
│   │   │       │   └── Shape.kt
│   │   │       └── components/
│   │   │           ├── AppButton.kt
│   │   │           ├── AppTextField.kt
│   │   │           ├── LoadingIndicator.kt
│   │   │           └── ErrorContent.kt
│   │   │
│   │   └── res/
│   │       ├── values/
│   │       │   ├── strings.xml
│   │       │   ├── colors.xml
│   │       │   └── themes.xml
│   │       ├── drawable/
│   │       └── mipmap-*/
│   │
│   ├── test/                              # Unit tests
│   │   └── java/com/example/myapp/
│   │       ├── features/
│   │       │   └── users/
│   │       │       ├── viewmodel/
│   │       │       │   └── UserListViewModelTest.kt
│   │       │       └── data/
│   │       │           └── UserRepositoryTest.kt
│   │       └── core/
│   │
│   └── androidTest/                       # Instrumented tests
│       └── java/com/example/myapp/
│           └── features/
│               └── users/
│                   └── ui/
│                       └── UserListScreenTest.kt
│
├── build.gradle.kts                       # Module-level build
└── proguard-rules.pro
```

---

## 2. ViewModel Pattern

```kotlin
// features/users/viewmodel/UserListViewModel.kt
@HiltViewModel
class UserListViewModel @Inject constructor(
    private val getUsersUseCase: GetUsersUseCase,
    private val deleteUserUseCase: DeleteUserUseCase,
) : ViewModel() {

    private val _uiState = MutableStateFlow<UserListUiState>(UserListUiState.Loading)
    val uiState: StateFlow<UserListUiState> = _uiState.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    init {
        loadUsers()
    }

    fun loadUsers() {
        viewModelScope.launch {
            _uiState.value = UserListUiState.Loading
            getUsersUseCase()
                .onSuccess { users ->
                    _uiState.value = UserListUiState.Success(users)
                }
                .onFailure { error ->
                    _uiState.value = UserListUiState.Error(error.message ?: "Unknown error")
                }
        }
    }

    fun deleteUser(userId: String) {
        viewModelScope.launch {
            deleteUserUseCase(userId)
                .onSuccess { loadUsers() }
                .onFailure { /* show snackbar */ }
        }
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
    }
}

sealed interface UserListUiState {
    data object Loading : UserListUiState
    data class Success(val users: List<UserProfile>) : UserListUiState
    data class Error(val message: String) : UserListUiState
}
```

---

## 3. Compose Screen

```kotlin
// features/users/ui/UserListScreen.kt
@Composable
fun UserListScreen(
    onUserClick: (String) -> Unit,
    viewModel: UserListViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            SearchTopBar(
                query = searchQuery,
                onQueryChanged = viewModel::onSearchQueryChanged,
            )
        },
    ) { padding ->
        when (val state = uiState) {
            is UserListUiState.Loading -> LoadingIndicator(Modifier.padding(padding))
            is UserListUiState.Error -> ErrorContent(
                message = state.message,
                onRetry = viewModel::loadUsers,
                modifier = Modifier.padding(padding),
            )
            is UserListUiState.Success -> {
                LazyColumn(contentPadding = padding) {
                    items(state.users, key = { it.id }) { user ->
                        UserCard(
                            user = user,
                            onClick = { onUserClick(user.id) },
                            onDelete = { viewModel.deleteUser(user.id) },
                        )
                    }
                }
            }
        }
    }
}
```

---

## 4. Navigation (Compose Navigation)

```kotlin
// navigation/Screen.kt
sealed class Screen(val route: String) {
    data object Login : Screen("login")
    data object Register : Screen("register")
    data object Home : Screen("home")
    data object UserList : Screen("users")
    data class UserDetail(val userId: String) : Screen("users/$userId") {
        companion object {
            const val ROUTE = "users/{userId}"
        }
    }
    data object Settings : Screen("settings")
}


// navigation/AppNavHost.kt
@Composable
fun AppNavHost(navController: NavHostController = rememberNavController()) {
    NavHost(navController = navController, startDestination = Screen.Login.route) {
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = { navController.navigate(Screen.Home.route) },
                onRegisterClick = { navController.navigate(Screen.Register.route) },
            )
        }
        composable(Screen.UserList.route) {
            UserListScreen(
                onUserClick = { userId ->
                    navController.navigate(Screen.UserDetail(userId).route)
                },
            )
        }
        composable(
            route = Screen.UserDetail.ROUTE,
            arguments = listOf(navArgument("userId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val userId = backStackEntry.arguments?.getString("userId") ?: return@composable
            UserDetailScreen(userId = userId)
        }
    }
}
```

---

## 5. Hilt Dependency Injection

```kotlin
// core/di/NetworkModule.kt
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides
    @Singleton
    fun provideOkHttpClient(authInterceptor: AuthInterceptor): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideApiService(retrofit: Retrofit): ApiService {
        return retrofit.create(ApiService::class.java)
    }
}

// core/di/RepositoryModule.kt
@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    @Singleton
    abstract fun bindUserRepository(impl: UserRepositoryImpl): UserRepository
}
```

---

## 6. Repository Pattern

```kotlin
// features/users/data/UserRepository.kt
interface UserRepository {
    suspend fun getUsers(): Result<List<UserProfile>>
    suspend fun getUserById(id: String): Result<UserProfile>
    suspend fun deleteUser(id: String): Result<Unit>
}

class UserRepositoryImpl @Inject constructor(
    private val remoteDataSource: UserRemoteDataSource,
    private val localDataSource: UserLocalDataSource,
) : UserRepository {

    override suspend fun getUsers(): Result<List<UserProfile>> {
        return try {
            val users = remoteDataSource.getUsers()
            localDataSource.cacheUsers(users.map { it.toEntity() })
            Result.success(users.map { it.toDomain() })
        } catch (e: Exception) {
            // Fallback to cache
            val cached = localDataSource.getCachedUsers()
            if (cached.isNotEmpty()) {
                Result.success(cached.map { it.toDomain() })
            } else {
                Result.failure(e)
            }
        }
    }

    override suspend fun getUserById(id: String): Result<UserProfile> {
        return try {
            val user = remoteDataSource.getUserById(id)
            Result.success(user.toDomain())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun deleteUser(id: String): Result<Unit> {
        return try {
            remoteDataSource.deleteUser(id)
            localDataSource.deleteUser(id)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
```

---

## 7. Essential Dependencies

```kotlin
// build.gradle.kts (app module)
dependencies {
    // Compose
    implementation(platform("androidx.compose:compose-bom:2024.01.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.7.0")

    // Navigation
    implementation("androidx.navigation:navigation-compose:2.7.6")
    implementation("androidx.hilt:hilt-navigation-compose:1.1.0")

    // Hilt
    implementation("com.google.dagger:hilt-android:2.50")
    kapt("com.google.dagger:hilt-compiler:2.50")

    // Networking
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Room
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")

    // DataStore
    implementation("androidx.datastore:datastore-preferences:1.0.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("io.mockk:mockk:1.13.8")
    testImplementation("app.cash.turbine:turbine:1.0.0")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| God Activity | All logic in `MainActivity` | Single Activity + Compose Navigation + ViewModels |
| XML layouts in new code | Using XML instead of Compose | Jetpack Compose for ALL new UI |
| Business logic in ViewModel | API calls, data mapping in ViewModel | Use UseCases + Repository pattern |
| No DI framework | Manual instantiation everywhere | Hilt (or Koin) for dependency injection |
| Blocking main thread | Network/DB calls on main thread | `viewModelScope.launch` + suspend functions |
| No offline support | App crashes without network | Repository caches to Room, fallback to local |
| LiveData in new code | Using LiveData instead of StateFlow | `StateFlow` + `collectAsStateWithLifecycle()` |
| Hardcoded strings in Compose | `Text("Login")` | `stringResource(R.string.login)` |

---

## 9. Enforcement Checklist

- [ ] Feature-first packages — ui/, viewmodel/, data/, domain/ per feature
- [ ] Jetpack Compose for ALL UI — NEVER XML layouts for new screens
- [ ] MVVM with `StateFlow` — collected via `collectAsStateWithLifecycle()`
- [ ] Sealed interface for UI state — Loading, Success, Error states
- [ ] Hilt for dependency injection — `@HiltViewModel`, `@Inject`, `@Module`
- [ ] Repository pattern — abstracts remote + local data sources
- [ ] Room for local caching — offline-first where possible
- [ ] Retrofit for networking — with auth interceptor
- [ ] Compose Navigation — type-safe route definitions
- [ ] Material 3 theme system — `MaterialTheme` for colors, typography, shapes
