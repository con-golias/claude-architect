# Flutter Deep Dive — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to start Flutter?", "Flutter vs React Native?", "Flutter architecture", "Riverpod vs Bloc?", "Flutter navigation", "GoRouter setup", "Flutter state management", "Impeller renderer", "widget testing Flutter", "Flutter performance", "platform channels", "Dart FFI", or any Flutter question, ALWAYS consult this directive. Flutter is Google's cross-platform UI toolkit that compiles to native ARM code using its own rendering engine (Skia/Impeller). ALWAYS use Riverpod for state management — it provides compile-time safety, testability, and code generation. ALWAYS use GoRouter for navigation — it provides declarative, type-safe routing. ALWAYS use the Impeller renderer (default since Flutter 3.16) for consistent 60fps rendering.

**Core Rule: Flutter renders EVERY pixel itself using its own engine (Skia/Impeller) — it does NOT use platform UI components like React Native. This gives pixel-perfect consistency across platforms but means you MUST build platform-adaptive UI yourself. ALWAYS use Riverpod (v2+) for state management — Provider is legacy, Bloc is overengineered for most apps. ALWAYS use GoRouter for navigation — Navigator 2.0 is too complex for direct use. ALWAYS use freezed for immutable data classes and json_serializable for JSON parsing. Test with the widget testing framework — it runs in milliseconds without an emulator.**

---

## 1. Flutter Architecture

```
  FLUTTER RENDERING ARCHITECTURE

  ┌──────────────────────────────────────────────────────┐
  │  DART APPLICATION                                     │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Widget Tree (declarative UI)                  │  │
  │  │  ┌──────────────────────────────────────────┐  │  │
  │  │  │  StatelessWidget / StatefulWidget        │  │  │
  │  │  │  Riverpod / Bloc / Provider              │  │  │
  │  │  │  GoRouter (navigation)                   │  │  │
  │  │  └──────────────────────────────────────────┘  │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │                                  │
  │  ┌─────────────────▼──────────────────────────────┐  │
  │  │  FRAMEWORK LAYER (Dart)                        │  │
  │  │  ┌────────────┐  ┌──────────────────────────┐  │  │
  │  │  │  Element   │  │  RenderObject Tree       │  │  │
  │  │  │  Tree      │  │  (layout + paint)        │  │  │
  │  │  │  (lifecycle)│  │  Constraints → Size →    │  │  │
  │  │  │            │  │  Paint commands           │  │  │
  │  │  └────────────┘  └──────────────────────────┘  │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │                                  │
  │  ┌─────────────────▼──────────────────────────────┐  │
  │  │  ENGINE LAYER (C++)                            │  │
  │  │  ┌──────────────────────────────────────────┐  │  │
  │  │  │  Impeller (default) / Skia (legacy)      │  │  │
  │  │  │  → Pre-compiled shaders                  │  │  │
  │  │  │  → GPU-accelerated rendering             │  │  │
  │  │  │  → NO platform UI components used        │  │  │
  │  │  └──────────────────────────────────────────┘  │  │
  │  │  ┌──────────────────────────────────────────┐  │  │
  │  │  │  Dart VM (JIT debug / AOT release)       │  │  │
  │  │  └──────────────────────────────────────────┘  │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘

  KEY INSIGHT: Flutter paints every pixel.
  React Native uses PLATFORM UI components (UIKit/Android Views).
  Flutter uses its OWN rendering engine (Impeller/Skia).
  → Same pixels on iOS and Android (consistency)
  → Must manually implement platform-adaptive behavior
```

### 1.1 Three Trees

```
  WIDGET TREE → ELEMENT TREE → RENDER TREE

  Widget Tree (immutable config):
  ┌─────────────┐
  │ MaterialApp  │
  │ ├── Scaffold │
  │ │   ├── AppBar│
  │ │   └── Body │
  │ │       ├── Column │
  │ │       │   ├── Text│
  │ │       │   └── Button│
  │ └───────┘
  └─────────────┘

  Element Tree (mutable state + lifecycle):
  - Links widgets to render objects
  - Persists across rebuilds (key-based diffing)
  - Manages State objects for StatefulWidgets

  RenderObject Tree (layout + paint):
  - Computes sizes via constraints
  - Paints to Impeller/Skia canvas
  - Only rebuilt when layout/paint changes

  REBUILD RULE:
  Widget rebuild ≠ RenderObject rebuild
  Flutter diffs Element tree to minimize actual layout/paint work
```

### 1.2 Project Setup

```bash
# Create new Flutter project
flutter create --org com.example my_app
cd my_app

# Add core dependencies
flutter pub add riverpod_annotation go_router freezed_annotation json_annotation
flutter pub add dev:riverpod_generator dev:build_runner dev:freezed dev:json_serializable

# Run code generation
dart run build_runner watch --delete-conflicting-outputs

# Run on device/simulator
flutter run
```

```
  PROJECT STRUCTURE

  lib/
  ├── main.dart                    ← App entry point
  ├── app/
  │   ├── app.dart                 ← MaterialApp.router config
  │   └── router.dart              ← GoRouter configuration
  ├── features/
  │   ├── auth/
  │   │   ├── data/
  │   │   │   ├── auth_repository.dart
  │   │   │   └── models/
  │   │   │       └── user.dart    ← freezed model
  │   │   ├── presentation/
  │   │   │   ├── login_screen.dart
  │   │   │   └── widgets/
  │   │   │       └── login_form.dart
  │   │   └── providers/
  │   │       └── auth_provider.dart  ← Riverpod providers
  │   └── products/
  │       ├── data/
  │       ├── presentation/
  │       └── providers/
  ├── shared/
  │   ├── widgets/                 ← Reusable UI components
  │   ├── providers/               ← Global providers
  │   └── theme/                   ← App theme
  └── core/
      ├── constants.dart
      ├── extensions.dart
      └── exceptions.dart
```

---

## 2. Widget Fundamentals

```dart
// StatelessWidget — pure function of props
class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.product});
  final Product product;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Image.network(product.imageUrl, fit: BoxFit.cover),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(product.name, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text('\$${product.price}', style: Theme.of(context).textTheme.bodyLarge),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// StatefulWidget — widget with mutable state (AVOID — prefer Riverpod)
class Counter extends StatefulWidget {
  const Counter({super.key});

  @override
  State<Counter> createState() => _CounterState();
}

class _CounterState extends State<Counter> {
  int _count = 0;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: () => setState(() => _count++),
      child: Text('Count: $_count'),
    );
  }
}
```

### 2.1 Composition Over Inheritance

```dart
// GOOD: Compose widgets — small, focused, reusable
class PriceTag extends StatelessWidget {
  const PriceTag({super.key, required this.price, this.currency = 'USD'});
  final double price;
  final String currency;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        NumberFormat.currency(symbol: currency == 'USD' ? '\$' : currency).format(price),
        style: Theme.of(context).textTheme.labelLarge,
      ),
    );
  }
}

// BAD: Giant widgets with hundreds of lines
// ALWAYS break into smaller composable widgets
```

---

## 3. State Management (Riverpod v2)

```
  STATE MANAGEMENT COMPARISON

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Riverpod (RECOMMENDED):                             │
  │  ✅ Compile-time safety (no runtime ProviderNotFound) │
  │  ✅ Code generation (minimal boilerplate)             │
  │  ✅ Testable (easy to override providers)             │
  │  ✅ Auto-dispose (no memory leaks)                    │
  │  ✅ Works outside widget tree                         │
  │                                                      │
  │  Bloc:                                               │
  │  ✅ Strict event-driven pattern                       │
  │  ✅ Good for large teams (enforced structure)          │
  │  ❌ Verbose (event classes, state classes, bloc class) │
  │  ❌ Overkill for simple state                         │
  │                                                      │
  │  Provider (LEGACY — DO NOT USE):                     │
  │  ❌ Runtime errors (ProviderNotFoundException)        │
  │  ❌ No code generation                               │
  │  ❌ Disposed by widget tree (fragile)                 │
  │                                                      │
  │  VERDICT: Riverpod for ALL new Flutter projects.     │
  │  Bloc only if team already uses it extensively.      │
  └──────────────────────────────────────────────────────┘
```

### 3.1 Riverpod Providers

```dart
// Simple provider — computed value
@riverpod
String greeting(GreetingRef ref) {
  return 'Hello, Flutter!';
}

// FutureProvider — async data fetching
@riverpod
Future<List<Product>> products(ProductsRef ref) async {
  final repository = ref.watch(productRepositoryProvider);
  return repository.fetchAll();
}

// Notifier — mutable state with methods
@riverpod
class CartNotifier extends _$CartNotifier {
  @override
  List<CartItem> build() => []; // initial state

  void addItem(Product product) {
    state = [...state, CartItem(product: product, quantity: 1)];
  }

  void removeItem(String productId) {
    state = state.where((item) => item.product.id != productId).toList();
  }

  void clearCart() {
    state = [];
  }
}

// AsyncNotifier — async state with methods
@riverpod
class AuthNotifier extends _$AuthNotifier {
  @override
  Future<User?> build() async {
    final token = await ref.watch(secureStorageProvider).read('token');
    if (token == null) return null;
    return ref.watch(authRepositoryProvider).getCurrentUser(token);
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(authRepositoryProvider);
      final user = await repo.login(email, password);
      await ref.read(secureStorageProvider).write('token', user.token);
      return user;
    });
  }

  Future<void> logout() async {
    await ref.read(secureStorageProvider).delete('token');
    state = const AsyncData(null);
  }
}
```

### 3.2 Consuming Providers in UI

```dart
// ConsumerWidget — Riverpod-aware widget
class ProductListScreen extends ConsumerWidget {
  const ProductListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(productsProvider);

    return productsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, stack) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Error: $error'),
            ElevatedButton(
              onPressed: () => ref.invalidate(productsProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (products) => ListView.builder(
        itemCount: products.length,
        itemBuilder: (context, index) => ProductCard(product: products[index]),
      ),
    );
  }
}

// Using ref.listen for side effects (navigation, snackbars)
class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(authNotifierProvider, (prev, next) {
      next.whenOrNull(
        data: (user) {
          if (user != null) context.go('/home');
        },
        error: (error, _) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Login failed: $error')),
          );
        },
      );
    });

    final authState = ref.watch(authNotifierProvider);

    return Scaffold(
      body: authState.isLoading
          ? const Center(child: CircularProgressIndicator())
          : LoginForm(
              onSubmit: (email, password) {
                ref.read(authNotifierProvider.notifier).login(email, password);
              },
            ),
    );
  }
}
```

---

## 4. Navigation (GoRouter)

```dart
// app/router.dart
import 'package:go_router/go_router.dart';

@riverpod
GoRouter router(RouterRef ref) {
  final authState = ref.watch(authNotifierProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final isLoggedIn = authState.valueOrNull != null;
      final isAuthRoute = state.matchedLocation.startsWith('/auth');

      if (!isLoggedIn && !isAuthRoute) return '/auth/login';
      if (isLoggedIn && isAuthRoute) return '/';
      return null;
    },
    routes: [
      // Shell route for bottom navigation
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return ScaffoldWithNavBar(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/',
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/explore',
                builder: (context, state) => const ExploreScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),

      // Auth routes (outside shell)
      GoRoute(
        path: '/auth/login',
        builder: (context, state) => const LoginScreen(),
      ),

      // Detail routes with parameters
      GoRoute(
        path: '/product/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          return ProductDetailScreen(productId: id);
        },
      ),
    ],
  );
}

// Navigation
context.go('/product/123');           // replace stack
context.push('/product/123');         // push onto stack
context.pop();                        // go back
context.goNamed('product', pathParameters: {'id': '123'});
```

---

## 5. Data Models (freezed + json_serializable)

```dart
// models/user.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'user.freezed.dart';
part 'user.g.dart';

@freezed
class User with _$User {
  const factory User({
    required String id,
    required String name,
    required String email,
    @Default('') String avatarUrl,
    @Default(UserRole.user) UserRole role,
    required DateTime createdAt,
  }) = _User;

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
}

enum UserRole {
  @JsonValue('admin') admin,
  @JsonValue('user') user,
  @JsonValue('moderator') moderator,
}

// Usage — freezed provides: ==, hashCode, toString, copyWith
final user = User(id: '1', name: 'Alice', email: 'alice@example.com', createdAt: DateTime.now());
final updated = user.copyWith(name: 'Alice Smith');

// Sealed unions with freezed
@freezed
sealed class AuthState with _$AuthState {
  const factory AuthState.initial() = AuthInitial;
  const factory AuthState.authenticated(User user) = Authenticated;
  const factory AuthState.unauthenticated() = Unauthenticated;
  const factory AuthState.error(String message) = AuthError;
}

// Pattern matching
Widget buildUI(AuthState state) {
  return switch (state) {
    AuthInitial() => const SplashScreen(),
    Authenticated(:final user) => HomeScreen(user: user),
    Unauthenticated() => const LoginScreen(),
    AuthError(:final message) => ErrorScreen(message: message),
  };
}
```

---

## 6. Networking

```dart
// Dio HTTP client setup
@riverpod
Dio dio(DioRef ref) {
  final dio = Dio(BaseOptions(
    baseUrl: 'https://api.example.com/v1',
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
  ));

  // Auth interceptor
  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      final token = await ref.read(secureStorageProvider).read('token');
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    },
    onError: (error, handler) async {
      if (error.response?.statusCode == 401) {
        // Refresh token or logout
        await ref.read(authNotifierProvider.notifier).logout();
      }
      handler.next(error);
    },
  ));

  return dio;
}

// Repository pattern
class ProductRepository {
  ProductRepository(this._dio);
  final Dio _dio;

  Future<List<Product>> fetchAll({int page = 1}) async {
    final response = await _dio.get('/products', queryParameters: {'page': page});
    return (response.data['data'] as List)
        .map((json) => Product.fromJson(json))
        .toList();
  }

  Future<Product> fetchById(String id) async {
    final response = await _dio.get('/products/$id');
    return Product.fromJson(response.data);
  }

  Future<Product> create(CreateProductRequest request) async {
    final response = await _dio.post('/products', data: request.toJson());
    return Product.fromJson(response.data);
  }
}

@riverpod
ProductRepository productRepository(ProductRepositoryRef ref) {
  return ProductRepository(ref.watch(dioProvider));
}
```

---

## 7. Platform Channels & Native Integration

```
  PLATFORM CHANNELS

  ┌──────────────────────────────────────────────────────┐
  │  DART (Flutter)                                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  MethodChannel('com.example.app/battery')      │  │
  │  │  → invokeMethod('getBatteryLevel')             │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │ async message passing            │
  │  ┌─────────────────▼──────────────────────────────┐  │
  │  │  PLATFORM (Kotlin / Swift)                     │  │
  │  │                                                │  │
  │  │  iOS:                                          │  │
  │  │  FlutterMethodChannel(name: "com.example...")   │  │
  │  │  → result(UIDevice.current.batteryLevel * 100) │  │
  │  │                                                │  │
  │  │  Android:                                      │  │
  │  │  MethodChannel(flutterEngine, "com.example..")  │  │
  │  │  → result.success(batteryManager.intProperty)  │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  CHANNEL TYPES:                                      │
  │  MethodChannel    — request/response (most common)   │
  │  EventChannel     — stream of events (sensors, BLE)  │
  │  BasicMessageChannel — raw message passing           │
  └──────────────────────────────────────────────────────┘
```

```dart
// Dart side — calling native code
class BatteryService {
  static const _channel = MethodChannel('com.example.app/battery');

  Future<int> getBatteryLevel() async {
    final level = await _channel.invokeMethod<int>('getBatteryLevel');
    return level ?? -1;
  }
}

// Prefer using packages over raw platform channels:
// camera: camera package
// location: geolocator package
// BLE: flutter_blue_plus package
// biometrics: local_auth package
// file system: path_provider package
```

### 7.1 Federated Plugins & FFI

```dart
// Dart FFI — call C/C++/Rust directly (no platform channels)
// Use for: crypto, image processing, audio, game engines
import 'dart:ffi';

typedef NativeAdd = Int32 Function(Int32, Int32);
typedef DartAdd = int Function(int, int);

final dylib = DynamicLibrary.open('libnative.so');
final add = dylib.lookupFunction<NativeAdd, DartAdd>('native_add');
print(add(3, 4)); // 7

// VERDICT:
// Platform Channels → high-level native APIs (camera, location, auth)
// Dart FFI → low-level C/C++/Rust (crypto, codecs, game engines)
```

---

## 8. Performance Optimization

```
  FLUTTER PERFORMANCE RULES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  RULE 1: Use const constructors EVERYWHERE           │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  // BAD: Rebuilds every time parent rebuilds   │  │
  │  │  Text('Hello')                                 │  │
  │  │                                                │  │
  │  │  // GOOD: Compile-time constant, skips rebuild │  │
  │  │  const Text('Hello')                           │  │
  │  │                                                │  │
  │  │  Use: dart fix --apply (auto-adds const)       │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RULE 2: Avoid rebuilding large subtrees             │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  // BAD: Entire screen rebuilds on cart change │  │
  │  │  ref.watch(cartProvider) in top-level widget   │  │
  │  │                                                │  │
  │  │  // GOOD: Only cart badge rebuilds             │  │
  │  │  ref.watch(cartProvider) only in CartBadge     │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RULE 3: Use ListView.builder for long lists         │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  // BAD: All items built at once               │  │
  │  │  ListView(children: items.map(buildItem))      │  │
  │  │                                                │  │
  │  │  // GOOD: Only visible items built             │  │
  │  │  ListView.builder(                             │  │
  │  │    itemCount: items.length,                    │  │
  │  │    itemBuilder: (ctx, i) => ItemTile(items[i]),│  │
  │  │  )                                             │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RULE 4: Use RepaintBoundary for isolated repaints   │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  RepaintBoundary(                              │  │
  │  │    child: AnimatedWidget(), // only this repaints│ │
  │  │  )                                             │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RULE 5: Use Impeller (default since Flutter 3.16)   │
  │  → Pre-compiled shaders = no jank on first render    │
  │  → Skia had "shader compilation jank" on first frame │
  └──────────────────────────────────────────────────────┘
```

### 8.1 Image Optimization

```dart
// CachedNetworkImage — disk + memory caching
import 'package:cached_network_image/cached_network_image.dart';

CachedNetworkImage(
  imageUrl: product.imageUrl,
  placeholder: (context, url) => const CircularProgressIndicator(),
  errorWidget: (context, url, error) => const Icon(Icons.error),
  memCacheWidth: 300,   // decode at display size (saves memory)
  memCacheHeight: 300,
);

// NEVER load full-resolution images when displaying thumbnails
// ALWAYS specify cacheWidth/cacheHeight or memCacheWidth/memCacheHeight
```

### 8.2 Isolates for Heavy Computation

```dart
// Use Isolate.run for CPU-intensive work (parsing, image processing)
Future<List<Product>> parseProducts(String jsonString) async {
  return Isolate.run(() {
    final data = jsonDecode(jsonString) as List;
    return data.map((json) => Product.fromJson(json)).toList();
  });
}

// RULE: If computation takes >16ms, use an isolate
// The main isolate must stay free for UI rendering at 60fps
```

---

## 9. Theming & Styling

```dart
// app/theme.dart
import 'package:flutter/material.dart';

class AppTheme {
  static ThemeData light() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF6750A4),
      brightness: Brightness.light,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      textTheme: const TextTheme(
        displayLarge: TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
        titleMedium: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(fontSize: 16),
        bodyMedium: TextStyle(fontSize: 14),
      ),
      cardTheme: CardTheme(
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        filled: true,
        fillColor: colorScheme.surfaceContainerLowest,
      ),
    );
  }

  static ThemeData dark() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF6750A4),
      brightness: Brightness.dark,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
    );
  }
}

// Usage in app
MaterialApp.router(
  theme: AppTheme.light(),
  darkTheme: AppTheme.dark(),
  themeMode: ThemeMode.system,
  routerConfig: router,
);

// Access theme in widgets
Theme.of(context).colorScheme.primary
Theme.of(context).textTheme.titleMedium
```

### 9.1 Platform-Adaptive UI

```dart
// Detect platform for adaptive behavior
import 'dart:io' show Platform;

Widget buildButton(BuildContext context) {
  if (Platform.isIOS) {
    return CupertinoButton(
      onPressed: () {},
      child: const Text('iOS Style'),
    );
  }
  return ElevatedButton(
    onPressed: () {},
    child: const Text('Material Style'),
  );
}

// Or use flutter_platform_widgets package for automatic adaptation
// RULE: Use Material Design as default
// Add Cupertino adaptation only for iOS-critical UX patterns
// (date pickers, action sheets, navigation transitions)
```

---

## 10. Testing

```dart
// Widget test (runs in milliseconds, no emulator needed)
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('ProductCard displays product info', (tester) async {
    final product = Product(
      id: '1',
      name: 'Test Product',
      price: 29.99,
      imageUrl: 'https://example.com/image.png',
    );

    await tester.pumpWidget(
      MaterialApp(home: ProductCard(product: product)),
    );

    expect(find.text('Test Product'), findsOneWidget);
    expect(find.text('\$29.99'), findsOneWidget);
  });

  testWidgets('Counter increments on tap', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Counter()));

    expect(find.text('Count: 0'), findsOneWidget);

    await tester.tap(find.byType(TextButton));
    await tester.pump(); // rebuild

    expect(find.text('Count: 1'), findsOneWidget);
  });
}

// Testing Riverpod providers
void main() {
  test('CartNotifier adds and removes items', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final notifier = container.read(cartNotifierProvider.notifier);

    notifier.addItem(testProduct);
    expect(container.read(cartNotifierProvider), hasLength(1));

    notifier.removeItem(testProduct.id);
    expect(container.read(cartNotifierProvider), isEmpty);
  });

  // Override providers in tests
  testWidgets('ProductList shows loading then data', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          productsProvider.overrideWith((ref) async {
            return [testProduct1, testProduct2];
          }),
        ],
        child: const MaterialApp(home: ProductListScreen()),
      ),
    );

    // Loading state
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    // Wait for async
    await tester.pumpAndSettle();

    // Data state
    expect(find.text(testProduct1.name), findsOneWidget);
    expect(find.text(testProduct2.name), findsOneWidget);
  });
}

// Golden tests (visual snapshot testing)
testWidgets('ProductCard matches golden', (tester) async {
  await tester.pumpWidget(
    MaterialApp(home: ProductCard(product: testProduct)),
  );

  await expectLater(
    find.byType(ProductCard),
    matchesGoldenFile('goldens/product_card.png'),
  );
});
// Update goldens: flutter test --update-goldens

// Integration test (runs on real device/emulator)
// integration_test/app_test.dart
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('full login flow', (tester) async {
    app.main();
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('email')), 'test@example.com');
    await tester.enterText(find.byKey(const Key('password')), 'password');
    await tester.tap(find.text('Sign In'));
    await tester.pumpAndSettle();

    expect(find.text('Home'), findsOneWidget);
  });
}
```

---

## 11. Flutter vs React Native

```
  FLUTTER vs REACT NATIVE — HEAD-TO-HEAD

  ┌────────────────────┬──────────────────┬──────────────────┐
  │ Aspect             │ Flutter          │ React Native     │
  ├────────────────────┼──────────────────┼──────────────────┤
  │ Rendering          │ Own engine       │ Platform UI      │
  │                    │ (Impeller/Skia)  │ (UIKit/Android)  │
  ├────────────────────┼──────────────────┼──────────────────┤
  │ Language           │ Dart             │ TypeScript/JS    │
  ├────────────────────┼──────────────────┼──────────────────┤
  │ State management   │ Riverpod/Bloc    │ Zustand/TanStack │
  ├────────────────────┼──────────────────┼──────────────────┤
  │ Navigation         │ GoRouter         │ expo-router      │
  ├────────────────────┼──────────────────┼──────────────────┤
  │ Hot reload         │ Excellent        │ Excellent        │
  ├────────────────────┼──────────────────┼──────────────────┤
  │ UI consistency     │ Pixel-perfect    │ Platform-native  │
  │ across platforms   │ (same pixels)    │ (looks native)   │
  ├────────────────────┼──────────────────┼──────────────────┤
  │ Developer pool     │ Smaller (Dart)   │ Huge (JS/TS)     │
  ├────────────────────┼──────────────────┼──────────────────┤
  │ OTA updates        │ Shorebird (early)│ Expo Updates     │
  ├────────────────────┼──────────────────┼──────────────────┤
  │ Desktop support    │ macOS/Win/Linux  │ Limited          │
  ├────────────────────┼──────────────────┼──────────────────┤
  │ Web support        │ Flutter Web      │ React Native Web │
  ├────────────────────┼──────────────────┼──────────────────┤
  │ Performance        │ 60fps (Impeller) │ 60fps (New Arch) │
  └────────────────────┴──────────────────┴──────────────────┘

  CHOOSE Flutter when: custom UI heavy, desktop targets needed,
  new team (no existing React/web codebase), Google ecosystem.

  CHOOSE React Native when: team knows React/web, OTA updates
  critical, large npm ecosystem needed, web + mobile sharing.
```

---

## 12. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Provider for state management** | Runtime `ProviderNotFoundException`, widget-tree coupled lifecycle | Migrate to Riverpod — compile-time safety, auto-dispose |
| **Giant StatefulWidgets** | 500+ line widgets with multiple setState calls, impossible to test | Break into small widgets, move state to Riverpod providers |
| **Missing const constructors** | Unnecessary rebuilds across entire subtree | Add `const` everywhere — run `dart fix --apply` |
| **ListView instead of ListView.builder** | OOM on large lists — all items built at once | Use `ListView.builder` — only visible items rendered |
| **Full-resolution images** | 200MB memory for a list of product thumbnails | Set `cacheWidth`/`cacheHeight` to display size |
| **Heavy compute on main isolate** | Jank during JSON parsing or image processing (>16ms) | Use `Isolate.run()` for CPU-intensive work |
| **Navigator 2.0 directly** | Hundreds of lines of boilerplate, impossible to maintain | Use GoRouter — declarative, type-safe, minimal code |
| **No RepaintBoundary** | Animated widget causes entire screen to repaint | Wrap isolated animations in `RepaintBoundary` |
| **BuildContext across async gaps** | `setState() called after dispose` crash | Check `mounted` before using context after await |
| **Mutable data classes** | State management bugs, `==` comparison fails | Use freezed for immutable, value-equal data classes |

---

## 13. Enforcement Checklist

### Setup
- [ ] Flutter latest stable channel used
- [ ] Riverpod v2 with code generation configured
- [ ] GoRouter for navigation
- [ ] freezed + json_serializable for data models
- [ ] Impeller renderer active (default since 3.16)
- [ ] Material 3 theme with `ColorScheme.fromSeed`
- [ ] Feature-based project structure (not layer-based)

### Performance
- [ ] `const` constructors used everywhere possible
- [ ] `ListView.builder` for ALL scrollable lists
- [ ] `CachedNetworkImage` with size constraints
- [ ] `RepaintBoundary` for isolated animations
- [ ] `Isolate.run` for computation >16ms
- [ ] State watched at lowest widget level (not top)

### Quality
- [ ] Widget tests for all screens and components
- [ ] Golden tests for visual components
- [ ] Integration tests for critical flows
- [ ] Riverpod providers tested with `ProviderContainer`
- [ ] Provider overrides used in widget tests
- [ ] Lint rules enabled (`flutter_lints` or `very_good_analysis`)

### Architecture
- [ ] Repository pattern for data access
- [ ] Freezed sealed classes for UI states
- [ ] Dio with interceptors for networking
- [ ] Secure storage for tokens (`flutter_secure_storage`)
- [ ] Platform-adaptive UI where needed (iOS/Android)
- [ ] Error handling with `AsyncValue.guard`
