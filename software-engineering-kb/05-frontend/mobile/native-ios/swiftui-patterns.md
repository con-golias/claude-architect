# SwiftUI Patterns — Complete Specification

> **AI Plugin Directive:** When a developer asks "SwiftUI best practices", "SwiftUI architecture", "SwiftUI navigation", "SwiftUI state management", "@State vs @Binding vs @ObservedObject", "SwiftUI performance", "SwiftUI MVVM", "SwiftUI previews", "SwiftUI modifiers", "SwiftUI data flow", or any SwiftUI question, ALWAYS consult this directive. SwiftUI is Apple's declarative UI framework for building native iOS, macOS, watchOS, and tvOS applications. ALWAYS use SwiftUI for new iOS projects — UIKit is legacy. ALWAYS use the Observation framework (@Observable) instead of ObservableObject for iOS 17+. ALWAYS use NavigationStack (not NavigationView) for navigation. ALWAYS use the MVVM pattern with protocol-based dependency injection for testability.

**Core Rule: SwiftUI is the DEFAULT for all new Apple platform development. Use @Observable (iOS 17+) for state management — it provides automatic dependency tracking with ZERO boilerplate compared to @Published/@ObservableObject. Use NavigationStack with NavigationPath for type-safe, programmatic navigation. Use async/await for ALL asynchronous work — NEVER use Combine for new code unless reactive streams are specifically needed. Structure apps with MVVM + Repository pattern for testability.**

---

## 1. SwiftUI Architecture

```
  SWIFTUI DATA FLOW

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  SOURCE OF TRUTH                                     │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  @State         — view-local state             │  │
  │  │  @Observable    — shared observable object      │  │
  │  │  @Environment   — injected dependencies        │  │
  │  │  @AppStorage    — UserDefaults-backed           │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │ triggers re-render              │
  │                    ▼                                  │
  │  VIEW (declarative body)                             │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  var body: some View {                        │  │
  │  │    Text(viewModel.title)  ← reads state       │  │
  │  │    Button("Tap") {                            │  │
  │  │      viewModel.doSomething() ← modifies state │  │
  │  │    }                                          │  │
  │  │  }                                            │  │
  │  └────────────────────────────────────────────────┘  │
  │                    │                                  │
  │  DERIVED VALUES (computed, no storage)                │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  @Binding       — two-way binding to parent    │  │
  │  │  Computed props — derived from @Observable     │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

### 1.1 Property Wrapper Guide

```
  SWIFTUI PROPERTY WRAPPERS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  @State (view-local, value type):                    │
  │  → Simple view-local state (toggle, text input)      │
  │  → NEVER pass to child as source of truth            │
  │  @State private var isExpanded = false                │
  │                                                      │
  │  @Binding (two-way reference to parent's @State):    │
  │  → Child reads AND writes parent's state             │
  │  @Binding var isPresented: Bool                      │
  │                                                      │
  │  @Observable (iOS 17+, reference type):              │
  │  → Automatic dependency tracking                     │
  │  → REPLACES @ObservedObject + @Published             │
  │  @Observable class ViewModel { var title = "" }      │
  │                                                      │
  │  @Environment (dependency injection):                │
  │  → System values (colorScheme, locale, dismiss)      │
  │  → Custom dependencies via EnvironmentKey            │
  │  @Environment(\.dismiss) private var dismiss          │
  │                                                      │
  │  @AppStorage (UserDefaults):                         │
  │  → Persisted simple values                           │
  │  @AppStorage("hasOnboarded") var hasOnboarded = false│
  │                                                      │
  │  LEGACY (pre-iOS 17):                                │
  │  @ObservedObject — use @Observable instead            │
  │  @StateObject — use @State + @Observable instead     │
  │  @EnvironmentObject — use @Environment instead       │
  │  @Published — automatic with @Observable             │
  └──────────────────────────────────────────────────────┘
```

---

## 2. State Management (@Observable)

```swift
// iOS 17+ — @Observable (RECOMMENDED)
import SwiftUI

@Observable
class ProductListViewModel {
    var products: [Product] = []
    var isLoading = false
    var error: String?
    var searchText = ""

    var filteredProducts: [Product] {
        if searchText.isEmpty { return products }
        return products.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    private let repository: ProductRepository

    init(repository: ProductRepository = .live) {
        self.repository = repository
    }

    func loadProducts() async {
        isLoading = true
        error = nil
        do {
            products = try await repository.fetchAll()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func deleteProduct(_ product: Product) async {
        do {
            try await repository.delete(product.id)
            products.removeAll { $0.id == product.id }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// View consumes @Observable directly — no wrappers needed
struct ProductListView: View {
    @State private var viewModel = ProductListViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    ProgressView()
                } else if let error = viewModel.error {
                    ContentUnavailableView("Error", systemImage: "exclamationmark.triangle") {
                        Text(error)
                    } actions: {
                        Button("Retry") { Task { await viewModel.loadProducts() } }
                    }
                } else {
                    List(viewModel.filteredProducts) { product in
                        NavigationLink(value: product) {
                            ProductRow(product: product)
                        }
                    }
                    .searchable(text: $viewModel.searchText)
                }
            }
            .navigationTitle("Products")
            .task { await viewModel.loadProducts() }
            .refreshable { await viewModel.loadProducts() }
        }
    }
}

// LEGACY (pre-iOS 17) — ObservableObject
class LegacyViewModel: ObservableObject {
    @Published var products: [Product] = []  // must mark each property
    @Published var isLoading = false
}
// View: @StateObject private var viewModel = LegacyViewModel()
```

---

## 3. Navigation

```swift
// NavigationStack + NavigationPath (iOS 16+)
@Observable
class Router {
    var path = NavigationPath()

    func navigate(to destination: Destination) {
        path.append(destination)
    }

    func goBack() {
        path.removeLast()
    }

    func goToRoot() {
        path.removeLast(path.count)
    }
}

enum Destination: Hashable {
    case productDetail(Product)
    case settings
    case profile(userId: String)
}

struct ContentView: View {
    @State private var router = Router()

    var body: some View {
        NavigationStack(path: $router.path) {
            HomeView()
                .navigationDestination(for: Destination.self) { destination in
                    switch destination {
                    case .productDetail(let product):
                        ProductDetailView(product: product)
                    case .settings:
                        SettingsView()
                    case .profile(let userId):
                        ProfileView(userId: userId)
                    }
                }
        }
        .environment(router)
    }
}

// Navigate from any child view
struct ProductRow: View {
    @Environment(Router.self) private var router
    let product: Product

    var body: some View {
        Button(product.name) {
            router.navigate(to: .productDetail(product))
        }
    }
}

// Tab-based navigation
struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem { Label("Home", systemImage: "house") }
                .tag(0)

            ExploreView()
                .tabItem { Label("Explore", systemImage: "magnifyingglass") }
                .tag(1)

            ProfileView()
                .tabItem { Label("Profile", systemImage: "person") }
                .tag(2)
        }
    }
}
```

---

## 4. Networking & Repository Pattern

```swift
// Protocol-based repository for testability
protocol ProductRepository {
    func fetchAll() async throws -> [Product]
    func fetch(id: String) async throws -> Product
    func create(_ input: CreateProductInput) async throws -> Product
    func delete(_ id: String) async throws
}

// Live implementation
struct LiveProductRepository: ProductRepository {
    private let baseURL = URL(string: "https://api.example.com/v1")!
    private let session: URLSession
    private let decoder: JSONDecoder

    init(session: URLSession = .shared) {
        self.session = session
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
    }

    func fetchAll() async throws -> [Product] {
        let url = baseURL.appendingPathComponent("products")
        let (data, response) = try await session.data(from: url)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }
        return try decoder.decode([Product].self, from: data)
    }

    func fetch(id: String) async throws -> Product {
        let url = baseURL.appendingPathComponent("products/\(id)")
        let (data, _) = try await session.data(from: url)
        return try decoder.decode(Product.self, from: data)
    }

    func create(_ input: CreateProductInput) async throws -> Product {
        var request = URLRequest(url: baseURL.appendingPathComponent("products"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(input)
        let (data, _) = try await session.data(for: request)
        return try decoder.decode(Product.self, from: data)
    }

    func delete(_ id: String) async throws {
        var request = URLRequest(url: baseURL.appendingPathComponent("products/\(id)"))
        request.httpMethod = "DELETE"
        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 204 else {
            throw APIError.deleteFailed
        }
    }
}

// Extension for static access
extension ProductRepository where Self == LiveProductRepository {
    static var live: LiveProductRepository { LiveProductRepository() }
}

// Mock for testing / previews
struct MockProductRepository: ProductRepository {
    var products: [Product] = Product.samples
    var shouldFail = false

    func fetchAll() async throws -> [Product] {
        if shouldFail { throw APIError.networkError }
        return products
    }
    // ... other methods
}
```

---

## 5. Component Patterns

```swift
// Reusable view components with configuration
struct PrimaryButton: View {
    let title: String
    let isLoading: Bool
    let action: () -> Void

    init(_ title: String, isLoading: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.isLoading = isLoading
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                }
                Text(title)
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(isLoading ? Color.blue.opacity(0.7) : Color.blue)
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .disabled(isLoading)
    }
}

// Custom ViewModifier
struct CardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding()
            .background(.background)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
    }
}

extension View {
    func cardStyle() -> some View {
        modifier(CardModifier())
    }
}

// Usage
Text("Hello").cardStyle()

// Generic async content view
struct AsyncContentView<T, Content: View, Placeholder: View>: View {
    let load: () async throws -> T
    @ViewBuilder let content: (T) -> Content
    @ViewBuilder let placeholder: () -> Placeholder

    @State private var result: Result<T, Error>?

    var body: some View {
        Group {
            switch result {
            case .none:
                placeholder()
            case .success(let value):
                content(value)
            case .failure(let error):
                ContentUnavailableView("Error", systemImage: "exclamationmark.triangle") {
                    Text(error.localizedDescription)
                }
            }
        }
        .task {
            do {
                result = .success(try await load())
            } catch {
                result = .failure(error)
            }
        }
    }
}
```

---

## 6. Previews

```swift
// SwiftUI Previews — instant visual feedback
#Preview("Product List - Loading") {
    ProductListView()
        .environment(ProductListViewModel(repository: MockProductRepository()))
}

#Preview("Product List - With Data") {
    let vm = ProductListViewModel(repository: MockProductRepository(products: Product.samples))
    return ProductListView()
        .environment(vm)
}

#Preview("Product List - Error") {
    let vm = ProductListViewModel(repository: MockProductRepository(shouldFail: true))
    return ProductListView()
        .environment(vm)
}

// Preview with different configurations
#Preview("Dark Mode") {
    ProductCard(product: .sample)
        .preferredColorScheme(.dark)
}

#Preview("Large Text") {
    ProductCard(product: .sample)
        .environment(\.dynamicTypeSize, .xxxLarge)
}

#Preview("Landscape") {
    ProductCard(product: .sample)
        .previewInterfaceOrientation(.landscapeLeft)
}

// RULE: Every view MUST have at least one preview.
// Use mock data and repositories for previews.
// Preview ALL states: loading, data, error, empty.
```

---

## 7. Performance

```
  SWIFTUI PERFORMANCE RULES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  RULE 1: Keep body computations cheap                │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  // BAD: Expensive computation in body         │  │
  │  │  var body: some View {                         │  │
  │  │    let filtered = items.filter { ... }         │  │
  │  │    .sorted { ... }  ← runs every render        │  │
  │  │  }                                             │  │
  │  │                                                │  │
  │  │  // GOOD: Computed property on @Observable     │  │
  │  │  var filteredItems: [Item] {                   │  │
  │  │    items.filter { ... }.sorted { ... }         │  │
  │  │  }  ← only re-evaluated when items changes    │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RULE 2: Use LazyVStack/LazyHStack for long lists   │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  // BAD: VStack renders ALL items              │  │
  │  │  ScrollView { VStack { ForEach(items) { } } }  │  │
  │  │                                                │  │
  │  │  // GOOD: LazyVStack renders only visible      │  │
  │  │  ScrollView { LazyVStack { ForEach(items) { } }│  │
  │  │  }                                             │  │
  │  │  // Or use List (built on lazy rendering)      │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RULE 3: Break views into small components          │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  SwiftUI re-evaluates body of views whose      │  │
  │  │  state changes. Smaller views = smaller         │  │
  │  │  re-evaluation scope.                          │  │
  │  │                                                │  │
  │  │  // BAD: One giant view with all state         │  │
  │  │  // GOOD: Extract subviews — each owns state   │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RULE 4: Use .task instead of .onAppear for async   │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  // .task auto-cancels when view disappears    │  │
  │  │  .task { await viewModel.load() }              │  │
  │  │                                                │  │
  │  │  // .onAppear does NOT cancel — memory leak    │  │
  │  │  .onAppear { Task { await viewModel.load() } } │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RULE 5: Prefer value types (struct) for models     │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Structs enable SwiftUI's efficient diffing.   │  │
  │  │  Use Identifiable protocol for ForEach/List.   │  │
  │  │  Only use classes for @Observable ViewModels.  │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

---

## 8. Testing

```swift
// Unit testing ViewModels
import XCTest

final class ProductListViewModelTests: XCTestCase {
    func testLoadProductsSuccess() async {
        let mockRepo = MockProductRepository(products: [.sample])
        let viewModel = ProductListViewModel(repository: mockRepo)

        await viewModel.loadProducts()

        XCTAssertEqual(viewModel.products.count, 1)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.error)
    }

    func testLoadProductsFailure() async {
        let mockRepo = MockProductRepository(shouldFail: true)
        let viewModel = ProductListViewModel(repository: mockRepo)

        await viewModel.loadProducts()

        XCTAssertTrue(viewModel.products.isEmpty)
        XCTAssertNotNil(viewModel.error)
    }

    func testSearchFiltering() async {
        let products = [
            Product(id: "1", name: "iPhone"),
            Product(id: "2", name: "MacBook"),
        ]
        let viewModel = ProductListViewModel(
            repository: MockProductRepository(products: products)
        )
        await viewModel.loadProducts()

        viewModel.searchText = "Mac"

        XCTAssertEqual(viewModel.filteredProducts.count, 1)
        XCTAssertEqual(viewModel.filteredProducts.first?.name, "MacBook")
    }
}

// Snapshot testing with swift-snapshot-testing
import SnapshotTesting

func testProductCardSnapshot() {
    let view = ProductCard(product: .sample)
        .frame(width: 375)
    assertSnapshot(of: view, as: .image)
}

// UI testing
import XCTest

final class LoginUITests: XCTestCase {
    let app = XCUIApplication()

    override func setUpWithError() throws {
        continueAfterFailure = false
        app.launch()
    }

    func testLoginFlow() {
        app.textFields["Email"].tap()
        app.textFields["Email"].typeText("test@example.com")
        app.secureTextFields["Password"].tap()
        app.secureTextFields["Password"].typeText("password")
        app.buttons["Sign In"].tap()

        XCTAssertTrue(app.staticTexts["Dashboard"].waitForExistence(timeout: 5))
    }
}
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Using ObservableObject on iOS 17+** | Boilerplate `@Published` on every property, manual `objectWillChange` | Use `@Observable` — automatic tracking, zero boilerplate |
| **NavigationView** | Deprecated, inconsistent behavior across platforms | Use `NavigationStack` with `NavigationPath` |
| **Massive body property** | 200+ line body — impossible to reason about re-renders | Extract subviews — each owns its state scope |
| **VStack/HStack for long lists** | All items rendered at once — OOM on large datasets | `LazyVStack`/`LazyHStack` or `List` for lazy rendering |
| **Force unwrapping in views** | Runtime crash kills the entire app | Use `if let`, `guard let`, or provide defaults |
| **.onAppear for async** | Task not cancelled when view disappears — memory leaks | Use `.task { }` — auto-cancels on disappear |
| **God ViewModel** | Single ViewModel with 50+ properties — everything re-renders | Split into focused ViewModels per feature |
| **Combine for simple async** | Complex publisher chains for one-shot network calls | Use async/await — Combine only for reactive streams |
| **No previews** | Can't see UI without building and running on device | Add `#Preview` for every view with all states |
| **UserDefaults for secrets** | Tokens stored in plaintext, accessible with backup extraction | Use Keychain (via KeychainAccess or Security framework) |

---

## 10. Enforcement Checklist

### Architecture
- [ ] MVVM pattern with protocol-based repositories
- [ ] @Observable for ViewModels (iOS 17+)
- [ ] NavigationStack with typed destinations
- [ ] async/await for all asynchronous operations
- [ ] Protocol-based dependency injection for testability
- [ ] Value types (structs) for data models

### UI Quality
- [ ] Every view has `#Preview` with all states (loading, data, error, empty)
- [ ] Dynamic Type support (no hardcoded font sizes)
- [ ] Dark mode tested (use semantic colors)
- [ ] Landscape orientation tested where applicable
- [ ] VoiceOver accessibility labels on interactive elements
- [ ] Safe area insets respected

### Performance
- [ ] LazyVStack/List for scrollable content
- [ ] .task for async work (not .onAppear + Task)
- [ ] Small, focused views for minimal re-render scope
- [ ] Expensive computations in ViewModel computed properties
- [ ] Images loaded with AsyncImage or cached loader

### Testing
- [ ] Unit tests for ALL ViewModels
- [ ] Mock repositories injected via protocols
- [ ] Snapshot tests for key UI components
- [ ] UI tests for critical user flows
- [ ] Preview coverage for all views
