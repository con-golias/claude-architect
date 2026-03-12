# iOS/Swift Project Structure

> **AI Plugin Directive:** When generating an iOS project with Swift, ALWAYS use this structure. Apply feature-first organization with SwiftUI (preferred for new projects) or UIKit. This guide covers Xcode 16+, Swift 5.9+/6.0+, SwiftUI with Observation framework, The Composable Architecture (TCA), Swift Package Manager modularization, and modern CI/CD with fastlane.

**Core Rule: Organize iOS projects by feature with MVVM or TCA (The Composable Architecture). Each feature contains its own views, view models, models, and services. NEVER use MVC with massive view controllers. Use `@Observable` (iOS 17+) for new ViewModels. Use Swift Concurrency (`async/await`) for ALL asynchronous work — NEVER completion handlers in new code.**

---

## 1. Enterprise Project Structure (SwiftUI + MVVM)

```
MyApp/
├── MyApp.xcodeproj/                   # Xcode project
│   ├── project.pbxproj
│   └── xcshareddata/
│       └── xcschemes/
│           ├── MyApp.xcscheme
│           ├── MyApp-Debug.xcscheme
│           └── MyApp-Release.xcscheme
│
├── MyApp/
│   ├── App/
│   │   ├── MyAppApp.swift             # @main entry point
│   │   ├── AppDelegate.swift          # UIKit lifecycle (push notifications, deep links)
│   │   ├── SceneDelegate.swift        # Scene lifecycle (multi-window iPad)
│   │   ├── ContentView.swift          # Root view with TabView/NavigationSplitView
│   │   └── AppState.swift             # Global observable app state
│   │
│   ├── Features/                      # Feature modules (domain-driven)
│   │   ├── Auth/
│   │   │   ├── Views/
│   │   │   │   ├── LoginView.swift
│   │   │   │   ├── RegisterView.swift
│   │   │   │   ├── ForgotPasswordView.swift
│   │   │   │   ├── OTPVerificationView.swift
│   │   │   │   └── Components/
│   │   │   │       ├── SocialLoginButton.swift
│   │   │   │       ├── AuthTextField.swift
│   │   │   │       └── PasswordStrengthIndicator.swift
│   │   │   ├── ViewModels/
│   │   │   │   ├── LoginViewModel.swift
│   │   │   │   ├── RegisterViewModel.swift
│   │   │   │   └── ForgotPasswordViewModel.swift
│   │   │   ├── Models/
│   │   │   │   ├── User.swift
│   │   │   │   ├── AuthToken.swift
│   │   │   │   └── AuthError.swift
│   │   │   └── Services/
│   │   │       ├── AuthService.swift
│   │   │       └── BiometricAuthService.swift
│   │   │
│   │   ├── Home/
│   │   │   ├── Views/
│   │   │   │   ├── HomeView.swift
│   │   │   │   ├── HomeDashboardCard.swift
│   │   │   │   └── Components/
│   │   │   │       ├── QuickActionGrid.swift
│   │   │   │       └── RecentActivityList.swift
│   │   │   ├── ViewModels/
│   │   │   │   └── HomeViewModel.swift
│   │   │   └── Models/
│   │   │       └── DashboardItem.swift
│   │   │
│   │   ├── UserList/
│   │   │   ├── Views/
│   │   │   │   ├── UserListView.swift
│   │   │   │   ├── UserDetailView.swift
│   │   │   │   ├── UserEditView.swift
│   │   │   │   └── Components/
│   │   │   │       ├── UserRow.swift
│   │   │   │       ├── UserAvatar.swift
│   │   │   │       └── UserFilterSheet.swift
│   │   │   ├── ViewModels/
│   │   │   │   ├── UserListViewModel.swift
│   │   │   │   ├── UserDetailViewModel.swift
│   │   │   │   └── UserEditViewModel.swift
│   │   │   ├── Models/
│   │   │   │   ├── UserProfile.swift
│   │   │   │   └── UserFilter.swift
│   │   │   └── Services/
│   │   │       └── UserService.swift
│   │   │
│   │   ├── Settings/
│   │   │   ├── Views/
│   │   │   │   ├── SettingsView.swift
│   │   │   │   ├── AppearanceSettingsView.swift
│   │   │   │   ├── NotificationSettingsView.swift
│   │   │   │   └── AboutView.swift
│   │   │   └── ViewModels/
│   │   │       └── SettingsViewModel.swift
│   │   │
│   │   └── Onboarding/
│   │       ├── Views/
│   │       │   ├── OnboardingView.swift
│   │       │   └── OnboardingPageView.swift
│   │       └── Models/
│   │           └── OnboardingPage.swift
│   │
│   ├── Core/                          # Shared infrastructure
│   │   ├── Network/
│   │   │   ├── APIClient.swift        # URLSession wrapper with async/await
│   │   │   ├── Endpoint.swift         # Endpoint protocol + definitions
│   │   │   ├── HTTPMethod.swift       # HTTP method enum
│   │   │   ├── NetworkError.swift     # Error types
│   │   │   ├── RequestInterceptor.swift # Auth token injection
│   │   │   ├── ResponseValidator.swift # Status code validation
│   │   │   └── MultipartFormData.swift # File upload support
│   │   │
│   │   ├── Storage/
│   │   │   ├── KeychainService.swift   # Secure storage (tokens, passwords)
│   │   │   ├── UserDefaultsService.swift # Non-sensitive preferences
│   │   │   ├── FileStorageService.swift  # Document/cache file management
│   │   │   └── CoreDataStack.swift     # Core Data container (or SwiftData)
│   │   │
│   │   ├── Navigation/
│   │   │   ├── AppRouter.swift         # Centralized navigation coordinator
│   │   │   ├── Route.swift             # Type-safe route enum
│   │   │   ├── DeepLinkHandler.swift   # Universal links / deep link parsing
│   │   │   └── TabRoute.swift          # Tab bar routes
│   │   │
│   │   ├── Analytics/
│   │   │   ├── AnalyticsService.swift  # Analytics facade
│   │   │   ├── AnalyticsEvent.swift    # Event definitions
│   │   │   └── AnalyticsProvider.swift # Firebase/Amplitude/Mixpanel adapter
│   │   │
│   │   ├── Push/
│   │   │   ├── PushNotificationService.swift
│   │   │   └── NotificationHandler.swift
│   │   │
│   │   └── DI/
│   │       ├── Container.swift         # Dependency container
│   │       └── ServiceKey.swift        # Environment key for SwiftUI DI
│   │
│   ├── Shared/                        # Shared UI components
│   │   ├── Components/
│   │   │   ├── PrimaryButton.swift
│   │   │   ├── SecondaryButton.swift
│   │   │   ├── LoadingView.swift
│   │   │   ├── ErrorView.swift
│   │   │   ├── EmptyStateView.swift
│   │   │   ├── AsyncImageView.swift
│   │   │   ├── SearchBar.swift
│   │   │   ├── Badge.swift
│   │   │   ├── ToastView.swift
│   │   │   └── ConfirmationDialog.swift
│   │   │
│   │   ├── Modifiers/
│   │   │   ├── CardModifier.swift
│   │   │   ├── ShimmerModifier.swift
│   │   │   ├── ConditionalModifier.swift
│   │   │   ├── HapticModifier.swift
│   │   │   └── KeyboardDismissModifier.swift
│   │   │
│   │   ├── Extensions/
│   │   │   ├── View+Extensions.swift
│   │   │   ├── Color+Theme.swift
│   │   │   ├── Date+Formatting.swift
│   │   │   ├── String+Validation.swift
│   │   │   ├── Bundle+Version.swift
│   │   │   └── URLSession+Extensions.swift
│   │   │
│   │   └── Styles/
│   │       ├── ButtonStyles.swift
│   │       ├── TextFieldStyles.swift
│   │       └── ListStyles.swift
│   │
│   ├── Resources/
│   │   ├── Assets.xcassets/            # Images, colors, app icon
│   │   │   ├── AppIcon.appiconset/
│   │   │   ├── AccentColor.colorset/
│   │   │   ├── Colors/
│   │   │   │   ├── Primary.colorset/
│   │   │   │   ├── Secondary.colorset/
│   │   │   │   ├── Background.colorset/
│   │   │   │   └── Surface.colorset/
│   │   │   └── Images/
│   │   │       ├── onboarding-1.imageset/
│   │   │       └── placeholder.imageset/
│   │   │
│   │   ├── Localizable.xcstrings       # String catalogs (iOS 17+)
│   │   ├── InfoPlist.xcstrings         # Info.plist localization
│   │   ├── Fonts/
│   │   │   ├── Inter-Regular.ttf
│   │   │   ├── Inter-Medium.ttf
│   │   │   └── Inter-Bold.ttf
│   │   └── Info.plist
│   │
│   └── Configuration/
│       ├── Debug.xcconfig              # Debug build settings
│       ├── Release.xcconfig            # Release build settings
│       ├── Shared.xcconfig             # Common settings
│       └── AppConfiguration.swift      # Runtime config (API URLs, keys)
│
├── MyAppTests/                        # Unit tests (mirror feature structure)
│   ├── Features/
│   │   ├── Auth/
│   │   │   ├── LoginViewModelTests.swift
│   │   │   └── AuthServiceTests.swift
│   │   └── UserList/
│   │       ├── UserListViewModelTests.swift
│   │       └── UserServiceTests.swift
│   ├── Core/
│   │   ├── Network/
│   │   │   ├── APIClientTests.swift
│   │   │   └── EndpointTests.swift
│   │   └── Storage/
│   │       └── KeychainServiceTests.swift
│   ├── Mocks/
│   │   ├── MockAuthService.swift
│   │   ├── MockAPIClient.swift
│   │   ├── MockUserService.swift
│   │   └── MockKeychainService.swift
│   └── Fixtures/
│       ├── users.json
│       └── auth_response.json
│
├── MyAppUITests/                      # UI / integration tests
│   ├── Screens/
│   │   ├── LoginScreenTests.swift
│   │   ├── UserListScreenTests.swift
│   │   └── SettingsScreenTests.swift
│   ├── Flows/
│   │   ├── AuthFlowTests.swift
│   │   └── UserCRUDFlowTests.swift
│   ├── Pages/                         # Page Object pattern
│   │   ├── LoginPage.swift
│   │   ├── UserListPage.swift
│   │   └── BasePage.swift
│   └── Helpers/
│       └── XCUIApplication+Extensions.swift
│
├── MyAppWidgetExtension/              # Widget extension (iOS 14+)
│   ├── MyAppWidget.swift
│   ├── WidgetProvider.swift
│   └── WidgetViews/
│       ├── SmallWidgetView.swift
│       ├── MediumWidgetView.swift
│       └── LargeWidgetView.swift
│
├── Packages/                          # Local Swift Packages (modularization)
│   ├── NetworkKit/
│   │   ├── Package.swift
│   │   ├── Sources/NetworkKit/
│   │   │   ├── APIClient.swift
│   │   │   ├── Endpoint.swift
│   │   │   ├── HTTPMethod.swift
│   │   │   └── NetworkError.swift
│   │   └── Tests/NetworkKitTests/
│   │       └── APIClientTests.swift
│   │
│   ├── DesignSystem/
│   │   ├── Package.swift
│   │   ├── Sources/DesignSystem/
│   │   │   ├── Colors.swift
│   │   │   ├── Typography.swift
│   │   │   ├── Spacing.swift
│   │   │   └── Components/
│   │   │       ├── DSButton.swift
│   │   │       ├── DSTextField.swift
│   │   │       └── DSCard.swift
│   │   └── Tests/DesignSystemTests/
│   │
│   └── Domain/
│       ├── Package.swift
│       ├── Sources/Domain/
│       │   ├── Models/
│       │   │   ├── User.swift
│       │   │   └── AuthToken.swift
│       │   ├── Repositories/
│       │   │   └── UserRepositoryProtocol.swift
│       │   └── UseCases/
│       │       ├── GetUsersUseCase.swift
│       │       └── LoginUseCase.swift
│       └── Tests/DomainTests/
│
├── fastlane/                          # CI/CD automation
│   ├── Fastfile
│   ├── Appfile
│   ├── Matchfile                      # Code signing
│   └── Pluginfile
│
├── .swiftlint.yml                     # SwiftLint configuration
├── .swiftformat                       # SwiftFormat configuration
├── .gitignore
└── Gemfile                            # Ruby deps for fastlane
```

---

## 2. SwiftUI + Observation (iOS 17+ / Swift 5.9+)

### ViewModel with @Observable

```swift
// Features/UserList/ViewModels/UserListViewModel.swift
import Foundation
import Observation

@Observable
final class UserListViewModel {
    // MARK: - Dependencies
    private let userService: UserServiceProtocol
    private let analytics: AnalyticsServiceProtocol

    // MARK: - State
    var users: [UserProfile] = []
    var isLoading = false
    var error: Error?
    var searchText = ""
    var selectedFilter: UserFilter = .all
    var showCreateSheet = false
    var showDeleteConfirmation = false
    var userToDelete: UserProfile?

    // MARK: - Computed
    var filteredUsers: [UserProfile] {
        var result = users

        // Apply search
        if !searchText.isEmpty {
            result = result.filter {
                $0.fullName.localizedCaseInsensitiveContains(searchText) ||
                $0.email.localizedCaseInsensitiveContains(searchText)
            }
        }

        // Apply filter
        switch selectedFilter {
        case .all:
            break
        case .active:
            result = result.filter { $0.isActive }
        case .inactive:
            result = result.filter { !$0.isActive }
        case .role(let role):
            result = result.filter { $0.role == role }
        }

        return result
    }

    var isEmpty: Bool { filteredUsers.isEmpty && !isLoading }
    var hasError: Bool { error != nil }

    // MARK: - Init
    init(
        userService: UserServiceProtocol,
        analytics: AnalyticsServiceProtocol = AnalyticsService.shared
    ) {
        self.userService = userService
        self.analytics = analytics
    }

    // MARK: - Actions
    @MainActor
    func loadUsers() async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            users = try await userService.getUsers()
            analytics.track(.usersLoaded(count: users.count))
        } catch {
            self.error = error
            analytics.track(.error(error))
        }
    }

    @MainActor
    func deleteUser(_ user: UserProfile) async {
        do {
            try await userService.deleteUser(id: user.id)
            users.removeAll { $0.id == user.id }
            analytics.track(.userDeleted(id: user.id))
        } catch {
            self.error = error
        }
    }

    @MainActor
    func createUser(name: String, email: String) async {
        do {
            let newUser = try await userService.createUser(
                name: name,
                email: email
            )
            users.append(newUser)
            showCreateSheet = false
            analytics.track(.userCreated(id: newUser.id))
        } catch {
            self.error = error
        }
    }

    func confirmDelete(_ user: UserProfile) {
        userToDelete = user
        showDeleteConfirmation = true
    }
}
```

### SwiftUI View with Full Patterns

```swift
// Features/UserList/Views/UserListView.swift
import SwiftUI

struct UserListView: View {
    @State private var viewModel: UserListViewModel

    init(userService: UserServiceProtocol) {
        _viewModel = State(
            initialValue: UserListViewModel(userService: userService)
        )
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.users.isEmpty {
                    LoadingView()
                } else if let error = viewModel.error, viewModel.users.isEmpty {
                    ErrorView(error: error) {
                        Task { await viewModel.loadUsers() }
                    }
                } else if viewModel.isEmpty {
                    EmptyStateView(
                        title: "No Users",
                        message: viewModel.searchText.isEmpty
                            ? "Tap + to add a user"
                            : "No users match your search",
                        systemImage: "person.2.slash"
                    )
                } else {
                    userList
                }
            }
            .navigationTitle("Users")
            .searchable(text: $viewModel.searchText, prompt: "Search users")
            .toolbar { toolbarContent }
            .task { await viewModel.loadUsers() }
            .refreshable { await viewModel.loadUsers() }
            .sheet(isPresented: $viewModel.showCreateSheet) {
                CreateUserSheet { name, email in
                    Task { await viewModel.createUser(name: name, email: email) }
                }
            }
            .confirmationDialog(
                "Delete User",
                isPresented: $viewModel.showDeleteConfirmation,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    if let user = viewModel.userToDelete {
                        Task { await viewModel.deleteUser(user) }
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This action cannot be undone.")
            }
        }
    }

    // MARK: - User List
    private var userList: some View {
        List(viewModel.filteredUsers) { user in
            NavigationLink(value: user) {
                UserRow(user: user)
            }
            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                Button("Delete", role: .destructive) {
                    viewModel.confirmDelete(user)
                }
                Button("Edit") {
                    // Navigate to edit
                }
                .tint(.blue)
            }
        }
        .listStyle(.insetGrouped)
        .navigationDestination(for: UserProfile.self) { user in
            UserDetailView(
                userId: user.id,
                userService: Container.shared.userService
            )
        }
        .overlay {
            if viewModel.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .padding(.top, 20)
            }
        }
    }

    // MARK: - Toolbar
    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button {
                viewModel.showCreateSheet = true
            } label: {
                Image(systemName: "plus")
            }
        }

        ToolbarItem(placement: .topBarLeading) {
            Menu {
                Picker("Filter", selection: $viewModel.selectedFilter) {
                    Text("All").tag(UserFilter.all)
                    Text("Active").tag(UserFilter.active)
                    Text("Inactive").tag(UserFilter.inactive)
                }
            } label: {
                Image(systemName: "line.3.horizontal.decrease.circle")
            }
        }
    }
}
```

---

## 3. Networking Layer (Complete)

```swift
// Core/Network/HTTPMethod.swift
enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

// Core/Network/Endpoint.swift
protocol Endpoint {
    var path: String { get }
    var method: HTTPMethod { get }
    var headers: [String: String]? { get }
    var queryItems: [URLQueryItem]? { get }
    var body: Encodable? { get }
}

extension Endpoint {
    var headers: [String: String]? { nil }
    var queryItems: [URLQueryItem]? { nil }
    var body: Encodable? { nil }
}

// Feature-specific endpoints
enum UserEndpoint: Endpoint {
    case list(page: Int, perPage: Int)
    case detail(id: UUID)
    case create(name: String, email: String)
    case update(id: UUID, name: String, email: String)
    case delete(id: UUID)

    var path: String {
        switch self {
        case .list:              return "/api/v1/users"
        case .detail(let id):    return "/api/v1/users/\(id)"
        case .create:            return "/api/v1/users"
        case .update(let id, _, _): return "/api/v1/users/\(id)"
        case .delete(let id):    return "/api/v1/users/\(id)"
        }
    }

    var method: HTTPMethod {
        switch self {
        case .list, .detail:  return .get
        case .create:         return .post
        case .update:         return .put
        case .delete:         return .delete
        }
    }

    var queryItems: [URLQueryItem]? {
        switch self {
        case .list(let page, let perPage):
            return [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "per_page", value: "\(perPage)"),
            ]
        default:
            return nil
        }
    }

    var body: Encodable? {
        switch self {
        case .create(let name, let email):
            return CreateUserRequest(name: name, email: email)
        case .update(_, let name, let email):
            return UpdateUserRequest(name: name, email: email)
        default:
            return nil
        }
    }
}

// Core/Network/NetworkError.swift
enum NetworkError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int, data: Data?)
    case decodingError(Error)
    case noConnection
    case timeout
    case unauthorized
    case serverError

    var errorDescription: String? {
        switch self {
        case .invalidURL:          return "Invalid URL"
        case .invalidResponse:     return "Invalid server response"
        case .httpError(let code, _): return "HTTP error: \(code)"
        case .decodingError:       return "Failed to process response"
        case .noConnection:        return "No internet connection"
        case .timeout:             return "Request timed out"
        case .unauthorized:        return "Session expired. Please log in again."
        case .serverError:         return "Server error. Please try again later."
        }
    }
}

// Core/Network/APIClient.swift
import Foundation
import os

protocol APIClientProtocol: Sendable {
    func request<T: Decodable>(_ endpoint: Endpoint) async throws -> T
    func request(_ endpoint: Endpoint) async throws
}

final class APIClient: APIClientProtocol, @unchecked Sendable {
    private let session: URLSession
    private let baseURL: URL
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private let keychainService: KeychainServiceProtocol
    private let logger = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "Network")

    init(
        baseURL: URL,
        keychainService: KeychainServiceProtocol,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.keychainService = keychainService
        self.session = session

        self.decoder = JSONDecoder()
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder.dateDecodingStrategy = .iso8601

        self.encoder = JSONEncoder()
        self.encoder.keyEncodingStrategy = .convertToSnakeCase
        self.encoder.dateEncodingStrategy = .iso8601
    }

    func request<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        let data = try await performRequest(endpoint)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            logger.error("Decoding error: \(error)")
            throw NetworkError.decodingError(error)
        }
    }

    func request(_ endpoint: Endpoint) async throws {
        _ = try await performRequest(endpoint)
    }

    private func performRequest(_ endpoint: Endpoint) async throws -> Data {
        // Build URL
        guard var components = URLComponents(
            url: baseURL.appending(path: endpoint.path),
            resolvingAgainstBaseURL: true
        ) else {
            throw NetworkError.invalidURL
        }
        components.queryItems = endpoint.queryItems

        guard let url = components.url else {
            throw NetworkError.invalidURL
        }

        // Build request
        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 30

        // Auth header
        if let token = keychainService.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // Custom headers
        endpoint.headers?.forEach { key, value in
            request.setValue(value, forHTTPHeaderField: key)
        }

        // Body
        if let body = endpoint.body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }

        // Execute
        logger.debug("\(endpoint.method.rawValue) \(url.absoluteString)")

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError {
            switch error.code {
            case .notConnectedToInternet, .networkConnectionLost:
                throw NetworkError.noConnection
            case .timedOut:
                throw NetworkError.timeout
            default:
                throw error
            }
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidResponse
        }

        logger.debug("Response: \(httpResponse.statusCode)")

        switch httpResponse.statusCode {
        case 200...299:
            return data
        case 401:
            throw NetworkError.unauthorized
        case 500...599:
            throw NetworkError.serverError
        default:
            throw NetworkError.httpError(
                statusCode: httpResponse.statusCode,
                data: data
            )
        }
    }
}

// Helper for encoding any Encodable
private struct AnyEncodable: Encodable {
    private let encode: (Encoder) throws -> Void

    init<T: Encodable>(_ value: T) {
        self.encode = value.encode(to:)
    }

    func encode(to encoder: Encoder) throws {
        try encode(encoder)
    }
}
```

---

## 4. Configuration (xcconfig Files)

```
// Configuration/Shared.xcconfig
// Common settings for all build configurations
PRODUCT_BUNDLE_IDENTIFIER = com.mycompany.myapp
MARKETING_VERSION = 1.0.0
CURRENT_PROJECT_VERSION = 1
IPHONEOS_DEPLOYMENT_TARGET = 16.0
SWIFT_VERSION = 5.9
GENERATE_INFOPLIST_FILE = YES
INFOPLIST_FILE = MyApp/Resources/Info.plist
INFOPLIST_KEY_CFBundleDisplayName = My App
INFOPLIST_KEY_LSApplicationCategoryType = public.app-category.utilities
ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon
ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor
CODE_SIGN_STYLE = Automatic

// Configuration/Debug.xcconfig
#include "Shared.xcconfig"
SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG
API_BASE_URL = https://api.staging.myapp.com
ENABLE_TESTABILITY = YES
SWIFT_OPTIMIZATION_LEVEL = -Onone
GCC_PREPROCESSOR_DEFINITIONS = DEBUG=1

// Configuration/Release.xcconfig
#include "Shared.xcconfig"
SWIFT_ACTIVE_COMPILATION_CONDITIONS = RELEASE
API_BASE_URL = https://api.myapp.com
ENABLE_TESTABILITY = NO
SWIFT_OPTIMIZATION_LEVEL = -O
SWIFT_COMPILATION_MODE = wholemodule
```

```swift
// Configuration/AppConfiguration.swift
import Foundation

enum AppConfiguration {
    enum Environment {
        case debug
        case release

        static var current: Environment {
            #if DEBUG
            return .debug
            #else
            return .release
            #endif
        }
    }

    static var apiBaseURL: URL {
        guard let urlString = Bundle.main.infoDictionary?["API_BASE_URL"] as? String,
              let url = URL(string: urlString) else {
            fatalError("API_BASE_URL not configured in xcconfig")
        }
        return url
    }

    static var isDebug: Bool {
        Environment.current == .debug
    }

    static var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
    }

    static var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0"
    }
}
```

---

## 5. Swift Package Manager Modularization

```swift
// Packages/NetworkKit/Package.swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NetworkKit",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "NetworkKit", targets: ["NetworkKit"]),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "NetworkKit",
            dependencies: [],
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency"),
            ]
        ),
        .testTarget(
            name: "NetworkKitTests",
            dependencies: ["NetworkKit"],
            resources: [.process("Fixtures")]
        ),
    ]
)

// Packages/DesignSystem/Package.swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DesignSystem",
    platforms: [.iOS(.v16)],
    products: [
        .library(name: "DesignSystem", targets: ["DesignSystem"]),
    ],
    targets: [
        .target(
            name: "DesignSystem",
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "DesignSystemTests",
            dependencies: ["DesignSystem"]
        ),
    ]
)
```

```
SPM MODULARIZATION STRATEGY:

Small app (1-3 devs):
  └── No local packages needed -- keep everything in main target

Medium app (3-10 devs):
  ├── NetworkKit (networking layer)
  └── DesignSystem (shared UI components)

Large app (10+ devs):
  ├── NetworkKit
  ├── DesignSystem
  ├── Domain (models, use cases, repository protocols)
  ├── Analytics
  ├── FeatureAuth (auth feature module)
  ├── FeatureHome
  └── FeatureSettings

RULES:
- Domain package has ZERO external dependencies
- Feature packages depend on Domain + DesignSystem
- NetworkKit is infrastructure, injected via protocols
- DesignSystem has NO business logic
- Each package has its own test target
```

---

## 6. Dependency Injection

```swift
// Core/DI/Container.swift
import Foundation

@MainActor
final class Container {
    static let shared = Container()

    // MARK: - Services (lazy initialization)
    lazy var apiClient: APIClientProtocol = APIClient(
        baseURL: AppConfiguration.apiBaseURL,
        keychainService: keychainService
    )

    lazy var keychainService: KeychainServiceProtocol = KeychainService()

    lazy var userService: UserServiceProtocol = UserService(
        apiClient: apiClient
    )

    lazy var authService: AuthServiceProtocol = AuthService(
        apiClient: apiClient,
        keychainService: keychainService
    )

    lazy var analyticsService: AnalyticsServiceProtocol = AnalyticsService()

    private init() {}
}

// SwiftUI Environment injection
private struct ContainerKey: EnvironmentKey {
    static let defaultValue = Container.shared
}

extension EnvironmentValues {
    var container: Container {
        get { self[ContainerKey.self] }
        set { self[ContainerKey.self] = newValue }
    }
}

// Usage in View:
struct ContentView: View {
    @Environment(\.container) private var container

    var body: some View {
        UserListView(userService: container.userService)
    }
}
```

---

## 7. Testing Patterns

```swift
// MyAppTests/Mocks/MockUserService.swift
import Foundation
@testable import MyApp

final class MockUserService: UserServiceProtocol {
    var getUsersResult: Result<[UserProfile], Error> = .success([])
    var deleteUserCalled = false
    var lastDeletedId: UUID?

    func getUsers() async throws -> [UserProfile] {
        try getUsersResult.get()
    }

    func deleteUser(id: UUID) async throws {
        deleteUserCalled = true
        lastDeletedId = id
    }

    func createUser(name: String, email: String) async throws -> UserProfile {
        UserProfile(id: UUID(), fullName: name, email: email, isActive: true, role: .user)
    }
}

// MyAppTests/Features/UserList/UserListViewModelTests.swift
import Testing
@testable import MyApp

@Suite("UserListViewModel Tests")
struct UserListViewModelTests {
    let mockService = MockUserService()
    var sut: UserListViewModel

    init() {
        sut = UserListViewModel(
            userService: mockService,
            analytics: MockAnalyticsService()
        )
    }

    @Test("Loads users successfully")
    @MainActor
    func loadUsers() async {
        // Arrange
        let users = [
            UserProfile.fixture(name: "Alice"),
            UserProfile.fixture(name: "Bob"),
        ]
        mockService.getUsersResult = .success(users)

        // Act
        await sut.loadUsers()

        // Assert
        #expect(sut.users.count == 2)
        #expect(sut.isLoading == false)
        #expect(sut.error == nil)
    }

    @Test("Handles load error")
    @MainActor
    func loadUsersError() async {
        mockService.getUsersResult = .failure(NetworkError.noConnection)

        await sut.loadUsers()

        #expect(sut.users.isEmpty)
        #expect(sut.error != nil)
        #expect(sut.isLoading == false)
    }

    @Test("Filters users by search text")
    @MainActor
    func filterUsers() async {
        let users = [
            UserProfile.fixture(name: "Alice Smith"),
            UserProfile.fixture(name: "Bob Jones"),
            UserProfile.fixture(name: "Charlie Smith"),
        ]
        mockService.getUsersResult = .success(users)
        await sut.loadUsers()

        sut.searchText = "Smith"

        #expect(sut.filteredUsers.count == 2)
    }

    @Test("Deletes user successfully")
    @MainActor
    func deleteUser() async {
        let user = UserProfile.fixture(name: "Alice")
        sut.users = [user]

        await sut.deleteUser(user)

        #expect(sut.users.isEmpty)
        #expect(mockService.deleteUserCalled)
        #expect(mockService.lastDeletedId == user.id)
    }
}

// Test fixture helper
extension UserProfile {
    static func fixture(
        id: UUID = UUID(),
        name: String = "Test User",
        email: String = "test@example.com",
        isActive: Bool = true,
        role: UserRole = .user
    ) -> UserProfile {
        UserProfile(
            id: id,
            fullName: name,
            email: email,
            isActive: isActive,
            role: role
        )
    }
}
```

---

## 8. CI/CD with fastlane

```ruby
# fastlane/Fastfile
default_platform(:ios)

platform :ios do
  # ─── CI ───
  desc "Run tests"
  lane :test do
    scan(
      scheme: "MyApp",
      devices: ["iPhone 15 Pro"],
      clean: true,
      code_coverage: true,
      result_bundle: true,
      output_directory: "fastlane/test_results"
    )
  end

  desc "Lint code"
  lane :lint do
    swiftlint(
      mode: :lint,
      config_file: ".swiftlint.yml",
      strict: true,
      raise_if_swiftlint_error: true
    )
  end

  # ─── Beta ───
  desc "Push a new beta build to TestFlight"
  lane :beta do
    setup_ci if is_ci
    match(type: "appstore", readonly: is_ci)

    increment_build_number(
      build_number: latest_testflight_build_number + 1
    )

    build_app(
      scheme: "MyApp",
      configuration: "Release",
      export_method: "app-store",
      clean: true,
      output_directory: "build"
    )

    upload_to_testflight(
      skip_waiting_for_build_processing: true,
      apple_id: ENV["APPLE_ID"]
    )

    slack(
      message: "New beta build uploaded to TestFlight!",
      slack_url: ENV["SLACK_WEBHOOK_URL"]
    ) if ENV["SLACK_WEBHOOK_URL"]
  end

  # ─── Release ───
  desc "Push a new release to App Store"
  lane :release do
    setup_ci if is_ci
    match(type: "appstore", readonly: is_ci)

    build_app(
      scheme: "MyApp",
      configuration: "Release",
      export_method: "app-store"
    )

    upload_to_app_store(
      submit_for_review: true,
      automatic_release: false,
      force: true,
      precheck_include_in_app_purchases: false
    )
  end

  # ─── Code Signing ───
  desc "Sync code signing certificates"
  lane :sync_certs do
    match(type: "development")
    match(type: "appstore")
  end
end
```

```yaml
# .github/workflows/ios-ci.yml
name: iOS CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4

      - name: Select Xcode
        run: sudo xcode-select -s /Applications/Xcode_16.0.app

      - name: Cache SPM
        uses: actions/cache@v4
        with:
          path: |
            ~/Library/Caches/org.swift.swiftpm
            .build
          key: ${{ runner.os }}-spm-${{ hashFiles('**/Package.resolved') }}

      - name: Run SwiftLint
        run: swiftlint lint --strict

      - name: Build and Test
        run: |
          xcodebuild test \
            -scheme MyApp \
            -destination 'platform=iOS Simulator,name=iPhone 15 Pro' \
            -resultBundlePath TestResults.xcresult \
            -enableCodeCoverage YES \
            CODE_SIGN_IDENTITY="" \
            CODE_SIGNING_REQUIRED=NO

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: TestResults.xcresult

  beta:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4

      - name: Install fastlane
        run: gem install fastlane

      - name: Deploy to TestFlight
        run: fastlane beta
        env:
          MATCH_PASSWORD: ${{ secrets.MATCH_PASSWORD }}
          MATCH_GIT_URL: ${{ secrets.MATCH_GIT_URL }}
          APP_STORE_CONNECT_API_KEY_ID: ${{ secrets.ASC_KEY_ID }}
          APP_STORE_CONNECT_API_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
          APP_STORE_CONNECT_API_KEY: ${{ secrets.ASC_PRIVATE_KEY }}
```

---

## 9. SwiftLint Configuration

```yaml
# .swiftlint.yml
disabled_rules:
  - trailing_whitespace
  - todo
  - line_length              # Handled by SwiftFormat

opt_in_rules:
  - closure_body_length
  - collection_alignment
  - contains_over_filter_count
  - empty_count
  - empty_string
  - fatal_error_message
  - first_where
  - force_unwrapping
  - identical_operands
  - implicit_return
  - last_where
  - modifier_order
  - multiline_arguments
  - operator_usage_whitespace
  - overridden_super_call
  - prefer_self_in_static_references
  - private_action
  - private_outlet
  - redundant_nil_coalescing
  - sorted_first_last
  - unneeded_parentheses_in_closure_argument
  - vertical_whitespace_closing_braces
  - yoda_condition

excluded:
  - Packages
  - DerivedData
  - .build
  - fastlane
  - Pods

type_body_length:
  warning: 300
  error: 500

file_length:
  warning: 500
  error: 1000

function_body_length:
  warning: 50
  error: 100

identifier_name:
  min_length: 2
  max_length: 50
  excluded: [id, x, y, i, to]

nesting:
  type_level: 3
  function_level: 3

custom_rules:
  no_print:
    name: "No print statements"
    regex: "\\bprint\\("
    message: "Use Logger instead of print()"
    severity: warning
    match_kinds: [identifier]

  no_force_cast:
    name: "No force casts"
    regex: " as! "
    message: "Use conditional cast (as?) instead"
    severity: error
```

---

## 10. Architecture Decision: MVVM vs TCA

```
WHEN TO USE MVVM (Default):
├── Small to medium apps (1-15 features)
├── Team familiar with UIKit/SwiftUI patterns
├── Simple navigation requirements
├── Standard CRUD operations
├── Prototyping and rapid development
└── @Observable makes MVVM very lightweight

WHEN TO USE TCA (The Composable Architecture):
├── Large apps (15+ features) needing strict state management
├── Complex side effects (timers, WebSocket, notifications)
├── Extensive testing requirements (TCA is fully testable by design)
├── Team has functional programming experience
├── Multiple developers working on same features
└── Need deterministic, reproducible state transitions

WHEN TO USE VIPER:
├── Legacy projects already using VIPER
├── DO NOT start new projects with VIPER
└── VIPER adds excessive boilerplate for SwiftUI apps

DECISION:
├── New SwiftUI project, small team → MVVM + @Observable
├── New SwiftUI project, complex state → TCA
├── Existing UIKit project → MVVM + Combine or async/await
└── NEVER → MVC with massive view controllers
```

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| Massive View Controller | 1000+ line UIViewController with networking, UI, state | MVVM with separate ViewModel, split into child VCs |
| Business logic in Views | API calls, date formatting in SwiftUI `body` | Extract ALL logic to ViewModel, Views are UI-only |
| No dependency injection | `let service = UserService()` hardcoded | Protocol-based DI, inject via init parameter |
| Singletons everywhere | `UserService.shared` in every file | Dependency container, inject protocols via Environment |
| Force unwrapping | `user!.name`, `try!`, `as!` | `guard let`, optional chaining, `if let`, `as?` |
| No error handling | `try! await api.request(...)` | do/catch in every async call, surface errors in ViewModel |
| All code in one target | No modularization, 500+ files in main target | Local Swift Packages for networking, design system, domain |
| Storyboard + code mix | Some UI in storyboards, some programmatic | SwiftUI for new projects OR 100% programmatic UIKit |
| Completion handlers in new code | `func loadUsers(completion: @escaping (Result))` | `async/await` for ALL async operations |
| `onAppear` + `Task {}` | Inconsistent loading behavior, double loads | Use `.task` modifier (auto-cancels, lifecycle-aware) |
| ObservableObject in iOS 17+ | `@Published` boilerplate, `objectWillChange` | `@Observable` macro (automatic, less boilerplate) |
| Storing tokens in UserDefaults | Security vulnerability, tokens readable | Keychain Services for ALL sensitive data |
| No localization from start | Hardcoded English strings everywhere | String Catalogs (`.xcstrings`) from day one |
| Testing against live API | Flaky tests, slow CI | Mock services via protocols, fixture JSON files |
| No xcconfig files | Build settings scattered in Xcode GUI | `.xcconfig` for Debug/Release/Staging environments |
| CocoaPods for new projects | Slow installs, Pods/ committed | Swift Package Manager (SPM) exclusively |

---

## 12. Enforcement Checklist

### Architecture (MANDATORY)
- [ ] Feature-first organization -- each feature has Views/, ViewModels/, Models/, Services/
- [ ] MVVM with `@Observable` (iOS 17+) or `ObservableObject` -- ZERO business logic in views
- [ ] Protocols for ALL services -- enables testing with mocks
- [ ] Dependency injection via container -- NO hardcoded service instances

### Swift Concurrency (MANDATORY)
- [ ] `async/await` for ALL asynchronous operations -- NEVER completion handlers in new code
- [ ] `@MainActor` on ViewModel methods that update UI state
- [ ] SwiftUI `.task` modifier for data loading -- NEVER `onAppear` + `Task { }`
- [ ] `defer` for cleanup in async methods (e.g., `defer { isLoading = false }`)

### Navigation
- [ ] `NavigationStack` + `navigationDestination` for type-safe navigation (iOS 16+)
- [ ] `NavigationSplitView` for iPad sidebar-detail layout
- [ ] Route enum for programmatic navigation
- [ ] Deep link handling via `onOpenURL` modifier

### Security
- [ ] Keychain for sensitive data (tokens, passwords) -- NEVER UserDefaults for secrets
- [ ] Certificate pinning for API calls in production
- [ ] App Transport Security (ATS) enabled -- NO arbitrary loads
- [ ] Biometric authentication for sensitive operations

### Configuration
- [ ] `.xcconfig` files for Debug/Release/Staging build settings
- [ ] `AppConfiguration` enum for runtime environment detection
- [ ] API keys via xcconfig (NOT hardcoded in source code)

### Testing
- [ ] Unit tests for ALL ViewModels -- mock services via protocols
- [ ] Swift Testing framework (`@Test`, `#expect`) for new tests
- [ ] Fixture JSON files for API response mocking
- [ ] UI tests with Page Object pattern
- [ ] Code coverage enforced (minimum 70%)

### Localization
- [ ] String Catalogs (`.xcstrings`) for ALL user-facing strings (iOS 17+)
- [ ] `InfoPlist.xcstrings` for Info.plist strings (camera, location permissions)

### Code Quality
- [ ] SwiftLint configured and enforced in CI
- [ ] SwiftFormat for consistent code style
- [ ] Swift Package Manager for ALL dependencies -- NO CocoaPods for new projects

### CI/CD
- [ ] GitHub Actions or fastlane for automated builds
- [ ] `match` for code signing in CI (encrypted certificates in Git)
- [ ] Automated TestFlight deployment on merge to main
- [ ] SPM cache in CI for faster builds

### Distribution
- [ ] App Store Connect API key for automated uploads
- [ ] TestFlight for beta testing
- [ ] App Store review guidelines compliance
- [ ] Privacy manifest (PrivacyInfo.xcprivacy) for required reason APIs
