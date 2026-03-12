# Swift: Best Practices

> **Domain:** Languages > Swift
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03

## Swift Style

### Value Types by Default

```swift
// PREFER struct (value type) over class (reference type)
struct User {
    let id: UUID
    var name: String
    var email: String
}

// Use class only when you need:
// - Identity (===)
// - Inheritance
// - Deinitializers
// - Reference semantics (shared mutable state)

// @Observable class for ViewModels (SwiftUI)
@Observable
class UserViewModel {
    var users: [User] = []
    var isLoading = false
    var error: Error?

    func loadUsers() async {
        isLoading = true
        defer { isLoading = false }
        do {
            users = try await userService.fetchAll()
        } catch {
            self.error = error
        }
    }
}
```

### Protocol-Oriented Design

```swift
// Prefer protocols over class inheritance
protocol Cacheable {
    var cacheKey: String { get }
    var cacheExpiry: TimeInterval { get }
}

// Protocol with default implementation
extension Cacheable {
    var cacheExpiry: TimeInterval { 300 }  // 5 minutes default
}

// Protocol composition
typealias DataSource = Fetchable & Cacheable & Sendable

// Use protocols to define capabilities
protocol UserRepository: Sendable {
    func findById(_ id: UUID) async throws -> User?
    func save(_ user: User) async throws
    func delete(_ id: UUID) async throws
}

// Concrete implementation
struct APIUserRepository: UserRepository {
    let client: HTTPClient

    func findById(_ id: UUID) async throws -> User? {
        try await client.get("/users/\(id)")
    }

    func save(_ user: User) async throws {
        try await client.post("/users", body: user)
    }

    func delete(_ id: UUID) async throws {
        try await client.delete("/users/\(id)")
    }
}
```

### Enums for Modeling State

```swift
// Model all possible states explicitly
enum LoadingState<T> {
    case idle
    case loading
    case loaded(T)
    case failed(Error)
}

// Usage in ViewModel
@Observable
class ArticleViewModel {
    var state: LoadingState<[Article]> = .idle

    func load() async {
        state = .loading
        do {
            let articles = try await articleService.fetchAll()
            state = .loaded(articles)
        } catch {
            state = .failed(error)
        }
    }
}

// Exhaustive handling in View
var body: some View {
    switch viewModel.state {
    case .idle:
        ContentUnavailableView("No articles", systemImage: "doc")
    case .loading:
        ProgressView()
    case .loaded(let articles):
        List(articles) { article in ArticleRow(article) }
    case .failed(let error):
        ContentUnavailableView("Error", systemImage: "exclamationmark.triangle",
                              description: Text(error.localizedDescription))
    }
}
```

## Error Handling

### Typed Errors

```swift
// Define domain errors
enum UserError: Error, LocalizedError {
    case notFound(id: UUID)
    case invalidEmail(String)
    case duplicateEmail(String)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .notFound(let id): "User \(id) not found"
        case .invalidEmail(let email): "Invalid email: \(email)"
        case .duplicateEmail(let email): "Email already registered: \(email)"
        case .unauthorized: "Unauthorized access"
        }
    }
}

// Typed throws (Swift 6)
func getUser(id: UUID) async throws(UserError) -> User {
    guard let user = try await repository.findById(id) else {
        throw .notFound(id: id)
    }
    return user
}
```

### Result Type for Non-Throwing APIs

```swift
// Result<Success, Failure> for APIs where you don't want throws
func validate(email: String) -> Result<String, ValidationError> {
    guard email.contains("@") else {
        return .failure(.invalidFormat("Missing @"))
    }
    guard email.count > 5 else {
        return .failure(.tooShort(minimum: 6))
    }
    return .success(email.lowercased())
}

// Chaining with map/flatMap
let result = validate(email: input)
    .map { $0.trimmingCharacters(in: .whitespaces) }
    .flatMap { normalizedEmail in
        checkAvailability(normalizedEmail)
    }

switch result {
case .success(let email):
    createAccount(email: email)
case .failure(let error):
    showError(error)
}
```

## Concurrency Best Practices

### Structured Concurrency

```swift
// Use TaskGroup for parallel work
func fetchDashboard() async throws -> Dashboard {
    async let profile = profileService.fetch()
    async let orders = orderService.fetchRecent()
    async let notifications = notificationService.fetchUnread()

    return try await Dashboard(
        profile: profile,
        orders: orders,
        notifications: notifications
    )
    // All three run concurrently, all cancelled if any throws
}

// TaskGroup for dynamic concurrency
func fetchImages(urls: [URL]) async throws -> [UIImage] {
    try await withThrowingTaskGroup(of: (Int, UIImage).self) { group in
        for (index, url) in urls.enumerated() {
            group.addTask {
                let (data, _) = try await URLSession.shared.data(from: url)
                let image = UIImage(data: data)!
                return (index, image)
            }
        }

        var images = [UIImage?](repeating: nil, count: urls.count)
        for try await (index, image) in group {
            images[index] = image
        }
        return images.compactMap { $0 }
    }
}
```

### Actor Best Practices

```swift
// Actor for thread-safe shared state
actor ImageCache {
    private var cache: [URL: UIImage] = [:]
    private var inProgress: [URL: Task<UIImage, Error>] = [:]

    func image(for url: URL) async throws -> UIImage {
        // Return cached
        if let cached = cache[url] { return cached }

        // Coalesce duplicate requests
        if let existing = inProgress[url] {
            return try await existing.value
        }

        // Start new download
        let task = Task {
            let (data, _) = try await URLSession.shared.data(from: url)
            return UIImage(data: data)!
        }
        inProgress[url] = task

        let image = try await task.value
        cache[url] = image
        inProgress[url] = nil
        return image
    }
}

// @MainActor for UI work
@MainActor
func updateUI(with data: [Item]) {
    tableView.reloadData()  // Guaranteed main thread
}
```

### Sendable Compliance

```swift
// Value types are implicitly Sendable
struct Point: Sendable {  // Sendable conformance automatic for value types
    let x: Double
    let y: Double
}

// Reference types need explicit marking
final class Config: Sendable {  // Must be final, all properties let
    let apiKey: String
    let baseURL: URL
    init(apiKey: String, baseURL: URL) {
        self.apiKey = apiKey
        self.baseURL = baseURL
    }
}

// @unchecked Sendable — when YOU guarantee thread safety
final class ThreadSafeCache: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [String: Any] = [:]

    func get(_ key: String) -> Any? {
        lock.withLock { storage[key] }
    }
}
```

## SwiftUI Best Practices

### View Composition

```swift
// Extract reusable views
struct UserRow: View {
    let user: User

    var body: some View {
        HStack {
            AsyncImage(url: user.avatarURL) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                ProgressView()
            }
            .frame(width: 44, height: 44)
            .clipShape(Circle())

            VStack(alignment: .leading) {
                Text(user.name).font(.headline)
                Text(user.email).font(.subheadline).foregroundStyle(.secondary)
            }
        }
    }
}
```

### Dependency Injection with Environment

```swift
// Define environment key
private struct UserServiceKey: EnvironmentKey {
    static let defaultValue: UserService = ProductionUserService()
}

extension EnvironmentValues {
    var userService: UserService {
        get { self[UserServiceKey.self] }
        set { self[UserServiceKey.self] = newValue }
    }
}

// Inject in app
@main struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.userService, ProductionUserService())
        }
    }
}

// Use in views
struct UserListView: View {
    @Environment(\.userService) private var userService
}

// Override in previews/tests
#Preview {
    UserListView()
        .environment(\.userService, MockUserService())
}
```

## Testing Patterns

```swift
// Swift Testing framework (modern)
import Testing

@Suite("User Service Tests")
struct UserServiceTests {
    let mockRepository = MockUserRepository()
    let service: UserService

    init() {
        service = UserService(repository: mockRepository)
    }

    @Test("Creates user with valid data")
    func createUser() async throws {
        let user = try await service.create(name: "Alice", email: "alice@test.com")
        #expect(user.name == "Alice")
        #expect(user.email == "alice@test.com")
    }

    @Test("Rejects invalid email",
          arguments: ["", "invalid", "@", "no-at-sign"])
    func invalidEmail(email: String) async {
        await #expect(throws: UserError.invalidEmail) {
            try await service.create(name: "Test", email: email)
        }
    }

    @Test("Handles concurrent access safely")
    func concurrentAccess() async throws {
        try await withThrowingTaskGroup(of: Void.self) { group in
            for i in 0..<100 {
                group.addTask {
                    try await service.create(name: "User \(i)", email: "u\(i)@test.com")
                }
            }
            try await group.waitForAll()
        }
        #expect(mockRepository.savedUsers.count == 100)
    }
}
```

## Project Structure

```
MyApp/
├── App/
│   ├── MyApp.swift              # @main entry point
│   └── AppEnvironment.swift     # Environment setup
├── Features/
│   ├── Auth/
│   │   ├── AuthView.swift
│   │   ├── AuthViewModel.swift
│   │   └── AuthService.swift
│   ├── Home/
│   │   ├── HomeView.swift
│   │   ├── HomeViewModel.swift
│   │   └── Components/
│   └── Settings/
├── Core/
│   ├── Networking/
│   │   ├── HTTPClient.swift
│   │   └── APIEndpoint.swift
│   ├── Models/
│   │   ├── User.swift
│   │   └── Order.swift
│   ├── Persistence/
│   │   └── SwiftDataModels.swift
│   └── Extensions/
├── SharedUI/
│   ├── Components/
│   └── Modifiers/
├── Resources/
│   ├── Assets.xcassets
│   └── Localizable.xcstrings
└── Tests/
    ├── UnitTests/
    ├── IntegrationTests/
    └── UITests/
```

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Better Alternative |
|-------------|-------------|-------------------|
| Force unwrapping (`!`) everywhere | Crashes at runtime | Optional binding, guard, nil-coalescing |
| Massive view controllers | Untestable, unmaintainable | MVVM, TCA, extract components |
| Retain cycles | Memory leaks | `[weak self]` in closures, `weak`/`unowned` |
| Stringly-typed APIs | No compiler help, typos | Enums, key paths, protocols |
| God object `AppDelegate` | Single point of failure | Coordinators, modular services |
| Synchronous main thread work | Frozen UI, watchdog kill | async/await, background tasks |
| Ignoring `@Sendable` warnings | Data races in Swift 6 | Proper Sendable compliance, actors |
| Using class when struct works | Unnecessary reference semantics, ARC overhead | Prefer value types |
| Not using `let` when possible | Accidental mutation | Always prefer `let` over `var` |

## Sources

- [Swift API Design Guidelines](https://swift.org/documentation/api-design-guidelines/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Point-Free](https://www.pointfree.co/) — Advanced Swift patterns
- [Swift by Sundell](https://swiftbysundell.com/)
