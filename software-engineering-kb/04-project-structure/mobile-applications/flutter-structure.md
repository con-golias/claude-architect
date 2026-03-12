# Flutter Project Structure

> **AI Plugin Directive:** When generating a Flutter project, ALWAYS use this structure. Apply feature-first organization with a state management solution (Riverpod, BLoC, or Provider). This guide covers Flutter 3.x with Dart 3, Material 3, and modern patterns including Riverpod as the recommended state management.

**Core Rule: Organize Flutter projects by feature. Each feature contains its own screens, widgets, models, and state. NEVER use a flat `screens/` + `widgets/` + `models/` structure for anything beyond prototypes.**

---

## 1. Enterprise Project Structure

```
my_app/
├── lib/
│   ├── main.dart                      # App entry point
│   ├── app.dart                       # MaterialApp/CupertinoApp configuration
│   │
│   ├── core/                          # Shared infrastructure
│   │   ├── config/
│   │   │   ├── app_config.dart        # Environment config
│   │   │   ├── routes.dart            # GoRouter route definitions
│   │   │   └── theme.dart             # ThemeData + color scheme
│   │   ├── constants/
│   │   │   ├── api_constants.dart     # Base URLs, endpoints
│   │   │   └── app_constants.dart     # Sizes, durations, keys
│   │   ├── errors/
│   │   │   ├── failures.dart          # Failure classes
│   │   │   └── exceptions.dart        # Exception classes
│   │   ├── network/
│   │   │   ├── api_client.dart        # Dio/http client setup
│   │   │   ├── interceptors.dart      # Auth, logging interceptors
│   │   │   └── api_response.dart      # Generic API response wrapper
│   │   ├── storage/
│   │   │   ├── secure_storage.dart    # FlutterSecureStorage wrapper
│   │   │   └── preferences.dart       # SharedPreferences wrapper
│   │   └── utils/
│   │       ├── extensions.dart        # Dart extensions
│   │       ├── validators.dart        # Form validation helpers
│   │       └── date_utils.dart        # Date formatting
│   │
│   ├── features/                      # Feature modules
│   │   ├── auth/
│   │   │   ├── data/
│   │   │   │   ├── datasources/
│   │   │   │   │   ├── auth_remote_datasource.dart
│   │   │   │   │   └── auth_local_datasource.dart
│   │   │   │   ├── models/
│   │   │   │   │   ├── user_model.dart       # JSON serializable
│   │   │   │   │   └── token_model.dart
│   │   │   │   └── repositories/
│   │   │   │       └── auth_repository_impl.dart
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── user.dart            # Domain entity
│   │   │   │   ├── repositories/
│   │   │   │   │   └── auth_repository.dart # Abstract interface
│   │   │   │   └── usecases/
│   │   │   │       ├── login.dart
│   │   │   │       ├── register.dart
│   │   │   │       └── logout.dart
│   │   │   └── presentation/
│   │   │       ├── screens/
│   │   │       │   ├── login_screen.dart
│   │   │       │   └── register_screen.dart
│   │   │       ├── widgets/
│   │   │       │   ├── login_form.dart
│   │   │       │   └── social_login_button.dart
│   │   │       └── providers/              # Riverpod providers
│   │   │           └── auth_provider.dart
│   │   │
│   │   ├── home/
│   │   │   └── presentation/
│   │   │       ├── screens/
│   │   │       │   └── home_screen.dart
│   │   │       └── widgets/
│   │   │           ├── home_header.dart
│   │   │           └── feature_card.dart
│   │   │
│   │   ├── users/
│   │   │   ├── data/
│   │   │   │   ├── datasources/
│   │   │   │   │   └── user_remote_datasource.dart
│   │   │   │   ├── models/
│   │   │   │   │   └── user_model.dart
│   │   │   │   └── repositories/
│   │   │   │       └── user_repository_impl.dart
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── user.dart
│   │   │   │   ├── repositories/
│   │   │   │   │   └── user_repository.dart
│   │   │   │   └── usecases/
│   │   │   │       ├── get_users.dart
│   │   │   │       └── get_user_details.dart
│   │   │   └── presentation/
│   │   │       ├── screens/
│   │   │       │   ├── user_list_screen.dart
│   │   │       │   └── user_detail_screen.dart
│   │   │       ├── widgets/
│   │   │       │   ├── user_card.dart
│   │   │       │   └── user_avatar.dart
│   │   │       └── providers/
│   │   │           └── user_provider.dart
│   │   │
│   │   └── settings/
│   │       └── presentation/
│   │           ├── screens/
│   │           └── widgets/
│   │
│   └── shared/                        # Shared UI components
│       ├── widgets/
│       │   ├── app_button.dart
│       │   ├── app_text_field.dart
│       │   ├── loading_indicator.dart
│       │   └── error_widget.dart
│       └── layouts/
│           ├── scaffold_with_nav.dart
│           └── responsive_layout.dart
│
├── test/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── data/
│   │   │   │   └── repositories/
│   │   │   │       └── auth_repository_impl_test.dart
│   │   │   └── domain/
│   │   │       └── usecases/
│   │   │           └── login_test.dart
│   │   └── users/
│   │       └── ...
│   ├── core/
│   │   └── network/
│   │       └── api_client_test.dart
│   └── helpers/
│       ├── test_helpers.dart
│       └── mocks.dart
│
├── integration_test/                  # Integration / E2E tests
│   └── app_test.dart
│
├── assets/                            # Static assets
│   ├── images/
│   ├── icons/
│   ├── fonts/
│   └── animations/                    # Lottie files
│
├── android/                           # Android platform code
├── ios/                               # iOS platform code
├── web/                               # Web platform (optional)
├── pubspec.yaml                       # Dependencies
├── analysis_options.yaml              # Lint rules
├── l10n.yaml                          # Localization config
├── .env                               # Environment variables
└── build.yaml                         # Code generation config
```

---

## 2. Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| File | snake_case | `user_list_screen.dart` |
| Class | PascalCase | `UserListScreen` |
| Variable/Function | camelCase | `getUserById()` |
| Constant | camelCase or SCREAMING_SNAKE | `maxRetryCount`, `API_BASE_URL` |
| Directory | snake_case | `data_sources/`, `use_cases/` |
| Widget | PascalCase (descriptive) | `UserCard`, `AppButton` |
| Provider | camelCase + Provider suffix | `userListProvider` |
| Test file | source_name + `_test.dart` | `login_test.dart` |

---

## 3. State Management (Riverpod)

```dart
// lib/features/users/presentation/providers/user_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/user.dart';
import '../../domain/usecases/get_users.dart';

// Repository provider
final userRepositoryProvider = Provider<UserRepository>((ref) {
  return UserRepositoryImpl(
    remoteDatasource: ref.read(userRemoteDatasourceProvider),
  );
});

// Use case provider
final getUsersUseCaseProvider = Provider<GetUsers>((ref) {
  return GetUsers(ref.read(userRepositoryProvider));
});

// Async state provider
final usersProvider = FutureProvider.autoDispose
    .family<List<User>, int>((ref, page) async {
  final getUsers = ref.read(getUsersUseCaseProvider);
  return getUsers(page: page, limit: 20);
});

// Notifier for complex state
final userListNotifierProvider =
    AsyncNotifierProvider.autoDispose<UserListNotifier, List<User>>(
  UserListNotifier.new,
);

class UserListNotifier extends AutoDisposeAsyncNotifier<List<User>> {
  @override
  Future<List<User>> build() async {
    final getUsers = ref.read(getUsersUseCaseProvider);
    return getUsers(page: 1, limit: 20);
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final getUsers = ref.read(getUsersUseCaseProvider);
      return getUsers(page: 1, limit: 20);
    });
  }

  Future<void> deleteUser(String id) async {
    final deleteUseCase = ref.read(deleteUserUseCaseProvider);
    await deleteUseCase(id);
    ref.invalidateSelf();
  }
}
```

---

## 4. Clean Architecture Layers

```
┌─────────────────────────────────────┐
│         Presentation Layer          │
│   Screens, Widgets, Providers       │
│   (Flutter framework-dependent)     │
└──────────────┬──────────────────────┘
               │ depends on
┌──────────────▼──────────────────────┐
│          Domain Layer               │
│   Entities, UseCases, Repo contracts│
│   (Pure Dart, ZERO dependencies)    │
└──────────────┬──────────────────────┘
               │ depends on
┌──────────────▼──────────────────────┐
│           Data Layer                │
│   Models, DataSources, Repo impl   │
│   (Dio, JSON, local storage)       │
└─────────────────────────────────────┘
```

---

## 5. Routing (GoRouter)

```dart
// lib/core/config/routes.dart
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final isLoggedIn = authState.isAuthenticated;
      final isAuthRoute = state.matchedLocation.startsWith('/auth');

      if (!isLoggedIn && !isAuthRoute) return '/auth/login';
      if (isLoggedIn && isAuthRoute) return '/';
      return null;
    },
    routes: [
      // Auth routes
      GoRoute(path: '/auth/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/auth/register', builder: (_, __) => const RegisterScreen()),

      // App shell with bottom nav
      ShellRoute(
        builder: (_, __, child) => ScaffoldWithNav(child: child),
        routes: [
          GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
          GoRoute(
            path: '/users',
            builder: (_, __) => const UserListScreen(),
            routes: [
              GoRoute(
                path: ':id',
                builder: (_, state) => UserDetailScreen(
                  userId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
        ],
      ),
    ],
  );
});
```

---

## 6. API Client

```dart
// lib/core/network/api_client.dart
import 'package:dio/dio.dart';

class ApiClient {
  late final Dio _dio;

  ApiClient({required String baseUrl, required String? token}) {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
    ));

    _dio.interceptors.addAll([
      LogInterceptor(requestBody: true, responseBody: true),
    ]);
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? queryParameters,
      T Function(dynamic)? fromJson}) async {
    final response = await _dio.get(path, queryParameters: queryParameters);
    return fromJson != null ? fromJson(response.data) : response.data as T;
  }

  Future<T> post<T>(String path, {dynamic data,
      T Function(dynamic)? fromJson}) async {
    final response = await _dio.post(path, data: data);
    return fromJson != null ? fromJson(response.data) : response.data as T;
  }
}
```

---

## 7. Essential Packages

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter

  # State Management
  flutter_riverpod: ^2.5.0
  riverpod_annotation: ^2.3.0

  # Routing
  go_router: ^14.0.0

  # Networking
  dio: ^5.4.0
  retrofit: ^4.1.0        # Optional: type-safe HTTP

  # Local Storage
  shared_preferences: ^2.2.0
  flutter_secure_storage: ^9.0.0

  # Serialization
  freezed_annotation: ^2.4.0
  json_annotation: ^4.9.0

  # UI
  flutter_screenutil: ^5.9.0   # Responsive sizes

dev_dependencies:
  # Code Generation
  build_runner: ^2.4.0
  freezed: ^2.5.0
  json_serializable: ^6.8.0
  riverpod_generator: ^2.4.0
  retrofit_generator: ^8.1.0

  # Testing
  flutter_test:
    sdk: flutter
  mocktail: ^1.0.0

  # Linting
  flutter_lints: ^4.0.0
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Flat structure | `lib/screens/`, `lib/widgets/`, `lib/models/` | Feature-first: `lib/features/auth/`, `lib/features/users/` |
| Business logic in widgets | `setState()` with API calls in `build()` | Extract to providers/BLoC, widgets are UI only |
| No separation of concerns | Model does serialization + validation + UI | Clean Architecture: entities, models, DTOs are separate |
| God widget | Single widget with 500+ lines | Break into smaller composable widgets |
| Hardcoded strings | `'http://api.example.com'` in widget | Use constants or env config |
| No error handling | Uncaught exceptions crash the app | Use Result/Either pattern, show error widgets |
| Testing presentation only | Only widget tests | Test use cases, repositories, and integration |
| Direct Dio usage | `Dio().get()` scattered everywhere | Wrap in `ApiClient`, inject via DI |

---

## 9. Enforcement Checklist

- [ ] Feature-first organization — each feature has data/domain/presentation
- [ ] Clean Architecture layers — domain has ZERO framework dependencies
- [ ] Riverpod (or BLoC) for state management — NEVER `setState()` for async data
- [ ] GoRouter for navigation — type-safe route parameters
- [ ] Freezed for immutable models — JSON serialization via code generation
- [ ] Dio with interceptors for HTTP — centralized error handling
- [ ] Test structure mirrors `lib/` — one test file per source file
- [ ] `analysis_options.yaml` with strict rules — zero lint warnings
- [ ] Assets organized by type — images/, fonts/, icons/ in assets/
- [ ] Environment config separated — NEVER hardcode URLs or keys
