# Dart: Overview

> **Domain:** Languages > Dart
> **Difficulty:** Beginner-Advanced
> **Last Updated:** 2026-03

## History & Evolution

| Version | Year | Key Features |
|---------|------|-------------|
| **Dart 1.0** | 2013 | Original release — intended as JavaScript replacement in Chrome |
| **Dart 2.0** | 2018 | **Sound type system**, strong mode, removed checked mode |
| **Dart 2.12** | 2021 | **Sound null safety** (all code must handle nulls) |
| **Dart 2.17** | 2022 | Enhanced enums, super initializers |
| **Dart 3.0** | 2023 | **Records, patterns, sealed classes**, class modifiers |
| **Dart 3.2** | 2023 | Extension types, improved patterns |
| **Dart 3.3** | 2024 | Extension types GA, improved JS interop |
| **Dart 3.4** | 2024 | Macros (experimental), WASM support |
| **Dart 3.5+** | 2025 | Macros progress, enhanced WASM, improved FFI |

### Dart's Journey

```
2011: Google announces Dart as JavaScript replacement → Chrome Dart VM
2013: Dart 1.0 released → Dart VM in Chrome plan
2015: Dart VM dropped from Chrome → compiles to JavaScript instead
2017: Flutter announced → Dart gets new life
2018: Dart 2.0 → sound type system, Flutter 1.0
2021: Sound null safety → major language milestone
2023: Dart 3.0 → records, patterns, modern language features
2025: Dart + Flutter = dominant cross-platform framework
```

**Key insight**: Dart was originally designed to replace JavaScript in browsers. That plan failed, but **Flutter** transformed Dart into one of the fastest-growing languages. Today, Dart exists primarily **because of Flutter**.

## Runtime Architecture

### Compilation Targets

```
Dart Source Code (.dart)
    ↓
Dart Compiler (multiple backends)
├── Dart VM (development)
│   ├── JIT compilation — hot reload in <1 second
│   ├── Incremental compilation
│   └── Debugger, Observatory
├── dart2js (web — JavaScript)
│   ├── Tree shaking — remove unused code
│   ├── Minification
│   └── Deferred loading (lazy load libraries)
├── dart2wasm (web — WebAssembly)
│   ├── WasmGC-based — garbage collected WASM
│   ├── Better performance than JS target
│   └── Smaller binary size
└── AOT Compiler (mobile/desktop — Flutter)
    ├── ARM64 native code (iOS, Android)
    ├── x64 native code (desktop)
    ├── Tree shaking at compilation
    └── No reflection (trimmed for size)
```

### JIT vs AOT

| Feature | JIT (Development) | AOT (Production) |
|---------|-------------------|-------------------|
| Startup time | Slower (compile on run) | **Fast** (pre-compiled) |
| **Hot reload** | **Yes** (sub-second) | No |
| Runtime optimization | Dynamic profiling | Static optimization |
| Code size | Larger (includes compiler) | Smaller (trimmed) |
| Reflection | Full (`dart:mirrors`) | **No** (tree-shaken) |
| Performance | Good | Best |

**Hot reload** is Dart/Flutter's killer feature — change code, see results in <1 second without losing app state.

## Type System

### Overview

| Feature | Support |
|---------|---------|
| Paradigm | Multi-paradigm (OOP + functional elements) |
| Typing | **Static**, strong, sound |
| Null safety | **Sound null safety** (compile-time guaranteed, no runtime NPE) |
| Generics | **Reified** (type info preserved at runtime) |
| Type inference | Full local inference, generic inference |
| Pattern matching | Dart 3.0+ (records, destructuring, switch expressions) |
| Algebraic types | Records + sealed classes |

### Sound Null Safety

Dart has one of the **strongest null safety implementations** — it's **sound**, meaning if a type is non-nullable, it's **guaranteed** at runtime (unlike TypeScript or Kotlin's platform types).

```dart
// Non-nullable by default
String name = 'Alice';        // Cannot be null
String? nickname;              // Nullable — must check before use

// Null-aware operators
String display = nickname ?? 'Anonymous';     // if-null
int? length = nickname?.length;               // null-conditional
nickname ??= 'Default';                       // assign if null

// Flow analysis — compiler tracks null checks
void greet(String? name) {
  if (name == null) return;
  print(name.toUpperCase()); // OK — compiler knows name is non-null here
}

// Late initialization (promise to initialize before use)
late final String configValue;
// Must be set before first read, otherwise throws
```

### Records (Dart 3.0)

```dart
// Positional records
(String, int) userInfo = ('Alice', 30);
var (name, age) = userInfo; // Destructuring

// Named records
({String name, int age}) user = (name: 'Alice', age: 30);

// Records in functions — multiple return values
(String name, int age) getUser() => ('Alice', 30);
var (userName, userAge) = getUser();

// Typedef for readability
typedef UserRecord = ({String name, String email, int age});
```

### Sealed Classes & Patterns (Dart 3.0)

```dart
// Sealed class hierarchy — exhaustive pattern matching
sealed class Shape {}

class Circle extends Shape {
  final double radius;
  Circle(this.radius);
}

class Rectangle extends Shape {
  final double width, height;
  Rectangle(this.width, this.height);
}

class Triangle extends Shape {
  final double base, height;
  Triangle(this.base, this.height);
}

// Exhaustive switch — compiler ensures all cases handled
double area(Shape shape) => switch (shape) {
  Circle(radius: var r) => 3.14159 * r * r,
  Rectangle(width: var w, height: var h) => w * h,
  Triangle(base: var b, height: var h) => 0.5 * b * h,
};
// Adding a new Shape subclass = compile error here (exhaustive)
```

### Class Modifiers (Dart 3.0)

```dart
// Control how classes can be used outside their library
interface class Printable { void print(); }     // Can implement, cannot extend
base class Animal { void eat() {} }              // Can extend, cannot implement
final class DatabaseConnection { ... }           // Cannot extend or implement
sealed class Result { ... }                       // Cannot be extended outside library
mixin class Validator { bool validate(); }        // Can be used as mixin or class
```

## Extension Types (Dart 3.3)

```dart
// Zero-cost wrapper around existing types
extension type UserId(int id) {
  // Type-safe wrapper — UserId != int at compile time
  // But at runtime, it IS just an int (zero overhead)

  bool get isValid => id > 0;
  UserId next() => UserId(id + 1);
}

// Usage — type safety without runtime cost
void processUser(UserId id) { ... }

processUser(UserId(42));     // OK
processUser(42);              // ERROR — int is not UserId
```

## Async Programming

```dart
// Future — single async value (like Promise)
Future<User> fetchUser(int id) async {
  final response = await http.get(Uri.parse('/users/$id'));
  return User.fromJson(jsonDecode(response.body));
}

// Stream — async sequence of values
Stream<int> countDown(int from) async* {
  for (var i = from; i > 0; i--) {
    yield i;
    await Future.delayed(Duration(seconds: 1));
  }
}

// Listen to stream
await for (final count in countDown(5)) {
  print(count);
}

// Parallel async
final results = await Future.wait([
  fetchUser(1),
  fetchUser(2),
  fetchUser(3),
]);

// Stream transformations
final stream = numberStream
    .where((n) => n.isEven)
    .map((n) => n * 2)
    .take(10);
```

## Isolates (Concurrency)

```dart
// Dart has no shared memory — uses Isolates (like actors)
// Each Isolate has its own memory heap and event loop

// Simple compute (runs in background isolate)
final result = await Isolate.run(() {
  return expensiveComputation();
});

// Bi-directional communication
final receivePort = ReceivePort();
final isolate = await Isolate.spawn(
  heavyWork,
  receivePort.sendPort,
);

receivePort.listen((message) {
  print('Got: $message');
});

void heavyWork(SendPort sendPort) {
  final result = doHeavyComputation();
  sendPort.send(result);
}
```

## Dart's Relationship with Flutter

| Aspect | Dart's Role |
|--------|-------------|
| **UI framework** | Flutter uses Dart for everything (widgets, logic, state) |
| **Hot reload** | Dart's JIT enables sub-second hot reload |
| **AOT compilation** | Dart AOT compiles to native ARM for iOS/Android |
| **Single-threaded UI** | Dart's event loop model maps to UI rendering |
| **Tree shaking** | Dart compiler removes unused code for small binaries |
| **Widget system** | Dart's class system maps directly to Flutter widgets |

**Dart without Flutter** is rare — the language exists primarily as Flutter's language. Backend/CLI usage exists but is niche.

## Sources

- [Dart Language Tour](https://dart.dev/language)
- [Dart Documentation](https://dart.dev/guides)
- [Dart 3.0 Announcement](https://medium.com/dartlang/announcing-dart-3-53f065a10635)
- [Effective Dart](https://dart.dev/effective-dart)
