# Swift: Overview

> **Domain:** Languages > Swift
> **Difficulty:** Beginner-Advanced
> **Last Updated:** 2026-03

## History & Evolution

| Version | Year | Key Features |
|---------|------|-------------|
| **Swift 1.0** | 2014 | Initial release — Objective-C replacement for Apple platforms |
| **Swift 2.0** | 2015 | Error handling (try/catch), protocol extensions, guard |
| **Swift 3.0** | 2016 | **Open-sourced**, API design guidelines, Grand Renaming |
| **Swift 4.0** | 2017 | Codable protocol, multi-line strings, key paths |
| **Swift 4.2** | 2018 | CaseIterable, random number API, conditional conformance |
| **Swift 5.0** | 2019 | **ABI stability** — Swift runtime shipped with OS |
| **Swift 5.1** | 2019 | Property wrappers, opaque return types (`some`), SwiftUI |
| **Swift 5.5** | 2021 | **Structured concurrency** (async/await, actors, tasks) |
| **Swift 5.7** | 2022 | `if let` shorthand, regex builders, `any` keyword |
| **Swift 5.9** | 2023 | **Macros**, parameter packs, `consume`/`borrowing` |
| **Swift 5.10** | 2024 | Complete strict concurrency checking |
| **Swift 6.0** | 2024 | **Data race safety** (compile-time guarantee), typed throws |
| **Swift 6.1** | 2025 | Embedded Swift improvements, non-copyable types, Java interop |

### Swift's Design Philosophy

```
Swift Core Principles:
├── Safe — null safety, optionals, value types, memory safety
├── Fast — LLVM-compiled, zero-cost abstractions, value types
├── Expressive — clean syntax, protocol-oriented, type inference
├── Modern — async/await, actors, macros, result builders
└── Progressive disclosure — easy to start, powerful when needed
```

**Key insight**: Swift was designed from the ground up to replace Objective-C while being safe, fast, and modern. Unlike Kotlin (which complements Java), Swift was designed to **completely replace** its predecessor.

## Compilation & Runtime

### Compilation Pipeline

```
Swift Source Code (.swift)
    ↓
Swift Frontend
├── Parser → AST
├── Sema (Semantic Analysis) → type checking, overload resolution
├── SILGen → Swift Intermediate Language (SIL)
├── SIL Optimizer → high-level optimizations
│   ├── Devirtualization
│   ├── Specialization (generic monomorphization)
│   ├── ARC optimization (retain/release elimination)
│   ├── Dead code elimination
│   └── Inlining
└── IRGen → LLVM IR
    ↓
LLVM Backend
├── LLVM optimizations (O2/O3)
├── Vectorization (SIMD)
├── Platform-specific code gen
└── Native binary (ARM64, x86_64)
```

### ARC (Automatic Reference Counting)

Unlike garbage-collected languages (Java, Go, Python, Dart), Swift uses **ARC** — deterministic memory management at compile time.

```swift
// ARC inserts retain/release automatically at compile time
class User {
    let name: String
    init(name: String) { self.name = name }
    deinit { print("\(name) deallocated") }
}

var user1: User? = User(name: "Alice")  // retain count = 1
var user2 = user1                        // retain count = 2
user1 = nil                              // retain count = 1
user2 = nil                              // retain count = 0 → deinit called immediately

// Strong reference cycle (ARC's main pitfall)
class Person {
    var apartment: Apartment?
}
class Apartment {
    weak var tenant: Person?  // weak breaks the cycle
}
```

| Feature | ARC (Swift) | GC (Java/Go/Dart) |
|---------|-------------|-------------------|
| Deallocation | **Deterministic** (immediate) | Non-deterministic (GC decides) |
| Pause times | **None** (no stop-the-world) | GC pauses (1ms-200ms) |
| Memory overhead | Low (reference counts only) | Higher (GC metadata, heap fragmentation) |
| Cycles | Must handle manually (weak/unowned) | Automatic cycle collection |
| Performance | Predictable latency | Better throughput |
| CPU overhead | Retain/release cost | GC thread cost |

## Type System

### Overview

| Feature | Support |
|---------|---------|
| Paradigm | Multi-paradigm (OOP + protocol-oriented + functional) |
| Typing | **Static**, strong, inferred |
| Null safety | **Optionals** — compile-time enforced (no null, only Optional) |
| Generics | Full (with associated types, where clauses, conditional conformance) |
| Type inference | Powerful bi-directional inference |
| Pattern matching | Exhaustive switch, if-case, guard-case |
| Value types | **First-class** — structs, enums are value types |
| Protocol-oriented | Protocols with default implementations, extensions, existentials |

### Optionals (Null Safety)

```swift
// Swift has NO null — only Optional<T> (an enum)
enum Optional<Wrapped> {
    case none
    case some(Wrapped)
}

var name: String = "Alice"      // Cannot be nil
var nickname: String? = nil     // Optional — may or may not have a value

// Unwrapping
if let nick = nickname {
    print(nick)                 // Safe — nick is String (not String?)
}

// if-let shorthand (Swift 5.7)
if let nickname {
    print(nickname)             // Same name, unwrapped
}

// Guard — early exit
func greet(_ name: String?) {
    guard let name else { return }
    print("Hello, \(name)")
}

// Optional chaining
let length = nickname?.count    // Int? — nil if nickname is nil

// Nil-coalescing
let display = nickname ?? "Anonymous"

// map/flatMap on optionals
let uppercased = nickname.map { $0.uppercased() }  // String?
```

### Enums (Algebraic Data Types)

```swift
// Swift enums are full algebraic data types (like Rust's)
enum Result<Success, Failure: Error> {
    case success(Success)
    case failure(Failure)
}

// Enums with associated values
enum NetworkResponse {
    case success(data: Data, statusCode: Int)
    case failure(error: NetworkError)
    case loading(progress: Double)
}

// Exhaustive switch
func handle(_ response: NetworkResponse) -> String {
    switch response {
    case .success(let data, let code):
        return "Got \(data.count) bytes (HTTP \(code))"
    case .failure(let error):
        return "Error: \(error.localizedDescription)"
    case .loading(let progress):
        return "Loading: \(Int(progress * 100))%"
    }
    // No default needed — compiler ensures all cases handled
}

// Enums with raw values
enum Planet: Int, CaseIterable {
    case mercury = 1, venus, earth, mars, jupiter, saturn, uranus, neptune
}

// Recursive enums
indirect enum ArithExpr {
    case number(Int)
    case add(ArithExpr, ArithExpr)
    case multiply(ArithExpr, ArithExpr)
}
```

### Value Types vs Reference Types

```swift
// Structs (value types) — copied on assignment (copy-on-write)
struct Point {
    var x: Double
    var y: Double
}

var p1 = Point(x: 0, y: 0)
var p2 = p1         // p2 is an independent copy
p2.x = 10           // p1.x is still 0

// Classes (reference types) — shared reference
class ViewModel: ObservableObject {
    @Published var items: [Item] = []
}

// Swift guideline: prefer structs over classes
// Use classes only when you need:
//   - Identity (===), inheritance, deinit, or reference semantics
```

## Structured Concurrency (Swift 5.5+)

```swift
// async/await
func fetchUser(id: Int) async throws -> User {
    let (data, response) = try await URLSession.shared.data(
        from: URL(string: "https://api.example.com/users/\(id)")!
    )
    guard let httpResponse = response as? HTTPURLResponse,
          httpResponse.statusCode == 200 else {
        throw NetworkError.badResponse
    }
    return try JSONDecoder().decode(User.self, from: data)
}

// Structured concurrency with TaskGroup
func fetchAllUsers(ids: [Int]) async throws -> [User] {
    try await withThrowingTaskGroup(of: User.self) { group in
        for id in ids {
            group.addTask { try await fetchUser(id: id) }
        }
        var users: [User] = []
        for try await user in group {
            users.append(user)
        }
        return users
    }
}

// Actors — thread-safe mutable state
actor BankAccount {
    private var balance: Decimal = 0

    func deposit(amount: Decimal) {
        balance += amount
    }

    func withdraw(amount: Decimal) throws -> Decimal {
        guard balance >= amount else { throw BankError.insufficientFunds }
        balance -= amount
        return amount
    }
}

// @MainActor — UI updates
@MainActor
class ViewModel: ObservableObject {
    @Published var users: [User] = []

    func loadUsers() async {
        users = try await fetchAllUsers(ids: [1, 2, 3])
        // Always runs on main thread — UI-safe
    }
}
```

### Swift 6 — Data Race Safety

```swift
// Swift 6 enforces Sendable at compile time
// Cannot pass non-Sendable types across concurrency domains

struct UserData: Sendable {  // OK — value type, all properties Sendable
    let name: String
    let age: Int
}

class MutableState {  // NOT Sendable — mutable reference type
    var count = 0
}

// Compile error in Swift 6:
// Task { @Sendable in
//     mutate(mutableState)  // ERROR: not Sendable
// }
```

## SwiftUI

```swift
// Declarative UI framework (since 2019)
struct ContentView: View {
    @State private var count = 0

    var body: some View {
        VStack(spacing: 20) {
            Text("Count: \(count)")
                .font(.largeTitle)

            Button("Increment") {
                count += 1
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}

// Property wrappers for state management
// @State — local view state (value types)
// @Binding — reference to parent's @State
// @StateObject — owned reference type (view model)
// @ObservedObject — non-owned reference type
// @EnvironmentObject — dependency injection
// @Environment — system environment values
```

## Swift on Server

```swift
// Vapor — most popular Swift server framework
import Vapor

let app = try Application(.detect())

app.get("users", ":id") { req -> User in
    let id = req.parameters.get("id", as: Int.self)!
    return try await User.find(id, on: req.db)
        ?? throw Abort(.notFound)
}

app.post("users") { req -> User in
    let input = try req.content.decode(CreateUserInput.self)
    let user = User(name: input.name, email: input.email)
    try await user.save(on: req.db)
    return user
}

try app.run()
```

## Sources

- [Swift Language Guide](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/)
- [Swift Evolution](https://github.com/apple/swift-evolution)
- [Swift.org](https://swift.org/)
- [WWDC Sessions](https://developer.apple.com/wwdc/)
- [SwiftUI Documentation](https://developer.apple.com/documentation/swiftui)
