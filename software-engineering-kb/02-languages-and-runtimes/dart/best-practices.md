# Dart: Best Practices

> **Domain:** Languages > Dart
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03

## Effective Dart Style

### Naming Conventions

```dart
// Classes, enums, typedefs — UpperCamelCase
class HttpClient {}
enum ConnectionState { active, idle, closed }
typedef UserFactory = User Function(String name);

// Variables, functions, parameters — lowerCamelCase
var itemCount = 3;
void fetchUserData() {}

// Libraries, packages, files — lowercase_with_underscores
import 'package:my_package/user_service.dart';

// Constants — lowerCamelCase (NOT SCREAMING_CAPS)
const defaultTimeout = Duration(seconds: 30);  // Dart style
const maxRetries = 3;                           // NOT MAX_RETRIES

// Private — prefix with underscore
class _InternalHelper {}
int _privateField = 0;
```

### Prefer final and const

```dart
// Use final for variables set once
final name = 'Alice';
final users = <User>[];  // list itself is final, contents are mutable

// Use const for compile-time constants
const maxItems = 100;
const defaultPadding = EdgeInsets.all(16.0);

// const constructors — single instance, no allocation
const emptyList = <int>[];  // Compiled as constant, shared instance

// Prefer final in function parameters and local variables
void processOrder(final Order order) {
  final total = order.items.fold(0.0, (sum, item) => sum + item.price);
  // total cannot be reassigned
}
```

## Null Safety Best Practices

### Prefer Non-Nullable Types

```dart
// GOOD: Default to non-nullable
class User {
  final String name;      // Always has a value
  final String email;     // Always has a value
  final String? phone;    // Explicitly optional

  User({required this.name, required this.email, this.phone});
}

// BAD: Making everything nullable "just in case"
class User {
  String? name;   // Why nullable?
  String? email;  // Why nullable?
}
```

### Null-Aware Patterns

```dart
// Null-aware cascade
user
  ?..updateName('Alice')
  ..updateEmail('alice@test.com');

// Collection null filtering
final validNames = users
    .map((u) => u.nickname)    // List<String?>
    .whereType<String>()        // List<String> — removes nulls
    .toList();

// Late variables for guaranteed initialization
class MyWidget extends StatefulWidget {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this);
  }
}
```

## Pattern Matching (Dart 3.0+)

### Destructuring

```dart
// Record destructuring
final (name, age) = getUserInfo();

// Map destructuring
final {'name': name, 'age': age} = jsonMap;

// Object destructuring
final User(name: userName, email: userEmail) = user;

// List patterns
final [first, second, ...rest] = numbers;

// Nested destructuring
final (String name, (double lat, double lng)) = getLocation();
```

### Guard Clauses with Patterns

```dart
// Switch expression for control flow
String describeScore(int score) => switch (score) {
  < 0     => throw ArgumentError('Negative score'),
  0       => 'No score',
  < 50    => 'Below average',
  < 80    => 'Average',
  < 95    => 'Good',
  <= 100  => 'Excellent',
  _       => throw ArgumentError('Score > 100'),
};

// If-case pattern
if (json case {'user': {'name': String name, 'age': int age}}) {
  print('$name is $age years old');
}

// Switch with guards
String classify(Shape shape) => switch (shape) {
  Circle(radius: var r) when r <= 0 => 'Invalid circle',
  Circle(radius: var r) => 'Circle with radius $r',
  Rectangle(width: var w, height: var h) when w == h => 'Square ${w}x$h',
  Rectangle(width: var w, height: var h) => 'Rectangle ${w}x$h',
};
```

## Error Handling

### Custom Exception Hierarchy

```dart
// Sealed exception hierarchy
sealed class AppException implements Exception {
  String get message;
}

class NotFoundException extends AppException {
  final String entity;
  final String id;
  NotFoundException(this.entity, this.id);

  @override
  String get message => '$entity with ID $id not found';
}

class ValidationException extends AppException {
  final Map<String, String> errors;
  ValidationException(this.errors);

  @override
  String get message => 'Validation failed: ${errors.entries.join(', ')}';
}

class NetworkException extends AppException {
  final int? statusCode;
  final String? detail;
  NetworkException({this.statusCode, this.detail});

  @override
  String get message => 'Network error: ${statusCode ?? "unknown"} $detail';
}

// Exhaustive handling
String handleError(AppException e) => switch (e) {
  NotFoundException() => 'Not found: ${e.message}',
  ValidationException() => 'Invalid: ${e.errors}',
  NetworkException(statusCode: 401) => 'Please log in',
  NetworkException(statusCode: 403) => 'Access denied',
  NetworkException() => 'Network error: ${e.message}',
};
```

### Result Pattern

```dart
// Sealed Result type (functional error handling)
sealed class Result<T> {
  const Result();
}

class Success<T> extends Result<T> {
  final T value;
  const Success(this.value);
}

class Failure<T> extends Result<T> {
  final AppException error;
  const Failure(this.error);
}

// Usage
Future<Result<User>> getUser(String id) async {
  try {
    final response = await _client.get('/users/$id');
    if (response.statusCode == 404) {
      return Failure(NotFoundException('User', id));
    }
    return Success(User.fromJson(response.data));
  } catch (e) {
    return Failure(NetworkException(detail: e.toString()));
  }
}

// Handling with pattern matching
final result = await getUser('123');
switch (result) {
  case Success(value: final user):
    showUser(user);
  case Failure(error: final e):
    showError(handleError(e));
}
```

## Flutter Widget Best Practices

### Prefer Small, Focused Widgets

```dart
// BAD: God widget with everything
class ProfilePage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      // 200 lines of nested widgets...
    ]);
  }
}

// GOOD: Composed from small widgets
class ProfilePage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      const ProfileHeader(),
      const ProfileStats(),
      const ProfileActions(),
      const RecentActivity(),
    ]);
  }
}
```

### Use const Constructors

```dart
// GOOD: const widgets are cached — no rebuild
class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      home: Scaffold(
        body: Center(
          child: Text('Hello'),  // const — never rebuilt
        ),
      ),
    );
  }
}

// Enable lint: prefer_const_constructors
// Enable lint: prefer_const_declarations
```

### Keys for Dynamic Lists

```dart
// BAD: No keys — Flutter can't track items correctly
ListView(children: items.map((item) => ItemWidget(item)).toList());

// GOOD: ValueKey for identity-based matching
ListView(
  children: items.map((item) =>
    ItemWidget(key: ValueKey(item.id), item: item)
  ).toList(),
);

// GOOD: Use ListView.builder for large lists (lazy rendering)
ListView.builder(
  itemCount: items.length,
  itemBuilder: (context, index) => ItemWidget(
    key: ValueKey(items[index].id),
    item: items[index],
  ),
);
```

## Async Best Practices

```dart
// Use FutureOr for APIs that may be sync or async
FutureOr<String> getValue(String key) {
  if (_cache.containsKey(key)) return _cache[key]!;  // sync
  return _fetchFromServer(key);                        // async
}

// Cancel operations with CancelToken (dio)
final cancelToken = CancelToken();
try {
  final response = await dio.get('/data', cancelToken: cancelToken);
} on DioException catch (e) {
  if (e.type == DioExceptionType.cancel) {
    print('Request cancelled');
  }
}
// Cancel when no longer needed
cancelToken.cancel('User navigated away');

// Debounce searches
Timer? _debounce;
void onSearchChanged(String query) {
  _debounce?.cancel();
  _debounce = Timer(const Duration(milliseconds: 300), () {
    performSearch(query);
  });
}
```

## Project Structure

```
lib/
├── main.dart                    # App entry point
├── app.dart                     # MaterialApp configuration
├── core/
│   ├── constants/               # App constants
│   ├── errors/                  # Exception classes
│   ├── network/                 # HTTP client, interceptors
│   ├── router/                  # Navigation (go_router)
│   └── theme/                   # Theme data, colors, text styles
├── features/
│   ├── auth/
│   │   ├── data/                # Repository implementations, DTOs
│   │   ├── domain/              # Entities, repository interfaces
│   │   └── presentation/        # Widgets, pages, controllers
│   ├── home/
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/
│   └── settings/
│       ├── data/
│       ├── domain/
│       └── presentation/
└── shared/
    ├── widgets/                 # Reusable widgets
    └── utils/                   # Helper functions
```

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Better Alternative |
|-------------|-------------|-------------------|
| setState everywhere | Global state via local setState = spaghetti | Riverpod, Bloc, or other state management |
| God widgets | 500+ line build methods | Composition, extract widgets |
| Not using const | Unnecessary widget rebuilds | `const` constructors everywhere possible |
| Ignoring BuildContext lifecycle | Using context after dispose | Check mounted, use callbacks |
| String-based navigation | Typos, no type safety | go_router, auto_route |
| Global mutable state | Hard to test, race conditions | DI, scoped state management |
| Blocking the UI thread | Janky animations, frozen UI | Isolates for heavy computation |
| Not using keys in lists | Incorrect widget reuse | ValueKey, ObjectKey |
| Over-engineering backend in Dart | Niche ecosystem for server-side | Use Go/Node.js/Python for backend |

## Sources

- [Effective Dart](https://dart.dev/effective-dart)
- [Flutter Best Practices](https://docs.flutter.dev/perf/best-practices)
- [Dart Lints](https://dart.dev/tools/linter-rules)
- [Flutter Architecture](https://docs.flutter.dev/app-architecture)
