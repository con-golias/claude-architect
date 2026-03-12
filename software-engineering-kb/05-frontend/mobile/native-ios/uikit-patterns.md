# UIKit Patterns — Complete Specification

> **AI Plugin Directive:** When a developer asks "UIKit architecture", "UIKit vs SwiftUI", "UIKit MVVM-C", "UITableView best practices", "UIKit programmatic UI", "Auto Layout patterns", "UIKit dependency injection", "UIKit Coordinator pattern", "UIKit testing", "UICollectionView compositional layout", or any UIKit question, ALWAYS consult this directive. UIKit is Apple's imperative UI framework that powers most production iOS apps. For NEW projects, ALWAYS prefer SwiftUI — UIKit is maintained for legacy codebases and advanced use cases SwiftUI cannot handle. When working with UIKit, ALWAYS use programmatic Auto Layout (no storyboards), MVVM-C (Model-View-ViewModel-Coordinator) architecture, and protocol-based dependency injection.

**Core Rule: UIKit is LEGACY for new development — use SwiftUI for all new projects. When maintaining or extending UIKit apps: ALWAYS use programmatic layout (SnapKit or NSLayoutConstraint) — NEVER storyboards (merge conflicts, hidden dependencies). ALWAYS use MVVM-C with Coordinators for navigation — NEVER let ViewControllers push/present other ViewControllers directly. ALWAYS use UICollectionViewCompositionalLayout for complex lists — NEVER use UITableView for new code. Use Combine or async/await for reactive bindings — NEVER use KVO or NotificationCenter for ViewModel updates.**

---

## 1. UIKit Architecture (MVVM-C)

```
  MVVM-C (Model-View-ViewModel-Coordinator)

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  COORDINATOR (navigation logic)                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • Creates ViewControllers + ViewModels         │  │
  │  │  • Handles navigation (push, present, dismiss)  │  │
  │  │  • Child coordinators for sub-flows             │  │
  │  │  • Decouples VCs from navigation knowledge      │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │ creates                         │
  │  ┌─────────────────▼──────────────────────────────┐  │
  │  │  VIEWMODEL (business logic + state)            │  │
  │  │  • Transforms Model → display-ready data       │  │
  │  │  • Handles user actions                         │  │
  │  │  • Exposes @Published properties or Subjects    │  │
  │  │  • NO import UIKit — purely testable            │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │ binds                           │
  │  ┌─────────────────▼──────────────────────────────┐  │
  │  │  VIEWCONTROLLER (UI rendering)                 │  │
  │  │  • Sets up views programmatically              │  │
  │  │  • Binds to ViewModel (Combine / closures)     │  │
  │  │  • Delegates user actions to ViewModel          │  │
  │  │  • NO business logic, NO navigation logic      │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │ displays                        │
  │  ┌─────────────────▼──────────────────────────────┐  │
  │  │  MODEL (data)                                  │  │
  │  │  • Data structures (Codable structs)           │  │
  │  │  • Repository/Service layer                     │  │
  │  │  • Network client, persistence                  │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

### 1.1 Coordinator Pattern

```swift
// Base coordinator protocol
protocol Coordinator: AnyObject {
    var navigationController: UINavigationController { get }
    var childCoordinators: [Coordinator] { get set }
    func start()
}

extension Coordinator {
    func addChild(_ coordinator: Coordinator) {
        childCoordinators.append(coordinator)
    }

    func removeChild(_ coordinator: Coordinator) {
        childCoordinators.removeAll { $0 === coordinator }
    }
}

// App coordinator (root)
class AppCoordinator: Coordinator {
    let navigationController: UINavigationController
    var childCoordinators: [Coordinator] = []
    private let window: UIWindow

    init(window: UIWindow) {
        self.window = window
        self.navigationController = UINavigationController()
    }

    func start() {
        window.rootViewController = navigationController
        window.makeKeyAndVisible()

        if AuthManager.shared.isAuthenticated {
            showMainFlow()
        } else {
            showAuthFlow()
        }
    }

    private func showAuthFlow() {
        let authCoordinator = AuthCoordinator(navigationController: navigationController)
        authCoordinator.onLoginSuccess = { [weak self] in
            self?.removeChild(authCoordinator)
            self?.showMainFlow()
        }
        addChild(authCoordinator)
        authCoordinator.start()
    }

    private func showMainFlow() {
        let tabCoordinator = TabBarCoordinator(navigationController: navigationController)
        addChild(tabCoordinator)
        tabCoordinator.start()
    }
}

// Feature coordinator
class ProductCoordinator: Coordinator {
    let navigationController: UINavigationController
    var childCoordinators: [Coordinator] = []
    private let repository: ProductRepository

    init(navigationController: UINavigationController, repository: ProductRepository) {
        self.navigationController = navigationController
        self.repository = repository
    }

    func start() {
        let viewModel = ProductListViewModel(repository: repository)
        viewModel.onProductSelected = { [weak self] product in
            self?.showProductDetail(product)
        }
        let viewController = ProductListViewController(viewModel: viewModel)
        navigationController.pushViewController(viewController, animated: true)
    }

    private func showProductDetail(_ product: Product) {
        let viewModel = ProductDetailViewModel(product: product, repository: repository)
        let viewController = ProductDetailViewController(viewModel: viewModel)
        navigationController.pushViewController(viewController, animated: true)
    }
}
```

---

## 2. Programmatic Layout

```swift
// Programmatic Auto Layout (NO storyboards)
class ProductListViewController: UIViewController {
    private let viewModel: ProductListViewModel
    private var cancellables = Set<AnyCancellable>()

    // MARK: - UI Components
    private lazy var collectionView: UICollectionView = {
        let layout = createLayout()
        let cv = UICollectionView(frame: .zero, collectionViewLayout: layout)
        cv.translatesAutoresizingMaskIntoConstraints = false
        cv.backgroundColor = .systemBackground
        cv.register(ProductCell.self, forCellWithReuseIdentifier: ProductCell.reuseId)
        return cv
    }()

    private lazy var activityIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .large)
        indicator.translatesAutoresizingMaskIntoConstraints = false
        indicator.hidesWhenStopped = true
        return indicator
    }()

    // MARK: - Init
    init(viewModel: ProductListViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("Use init(viewModel:)") }

    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupConstraints()
        bindViewModel()
        viewModel.loadProducts()
    }

    // MARK: - Setup
    private func setupUI() {
        title = "Products"
        view.backgroundColor = .systemBackground
        view.addSubview(collectionView)
        view.addSubview(activityIndicator)
    }

    private func setupConstraints() {
        NSLayoutConstraint.activate([
            collectionView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            activityIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            activityIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }

    private func bindViewModel() {
        viewModel.$isLoading
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading in
                if isLoading {
                    self?.activityIndicator.startAnimating()
                } else {
                    self?.activityIndicator.stopAnimating()
                }
            }
            .store(in: &cancellables)

        viewModel.$products
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.collectionView.reloadData()
            }
            .store(in: &cancellables)
    }
}
```

---

## 3. UICollectionView Compositional Layout

```swift
// Modern collection view with Compositional Layout + Diffable Data Source
private func createLayout() -> UICollectionViewCompositionalLayout {
    UICollectionViewCompositionalLayout { sectionIndex, environment in
        switch Section(rawValue: sectionIndex) {
        case .featured:
            // Horizontal scrolling cards
            let itemSize = NSCollectionLayoutSize(
                widthDimension: .fractionalWidth(1.0),
                heightDimension: .fractionalHeight(1.0)
            )
            let item = NSCollectionLayoutItem(layoutSize: itemSize)

            let groupSize = NSCollectionLayoutSize(
                widthDimension: .fractionalWidth(0.85),
                heightDimension: .absolute(200)
            )
            let group = NSCollectionLayoutGroup.horizontal(layoutSize: groupSize, subitems: [item])

            let section = NSCollectionLayoutSection(group: group)
            section.orthogonalScrollingBehavior = .groupPagingCentered
            section.interGroupSpacing = 16
            section.contentInsets = NSDirectionalEdgeInsets(top: 16, leading: 16, bottom: 16, trailing: 16)
            return section

        case .grid:
            // 2-column grid
            let itemSize = NSCollectionLayoutSize(
                widthDimension: .fractionalWidth(0.5),
                heightDimension: .estimated(250)
            )
            let item = NSCollectionLayoutItem(layoutSize: itemSize)
            item.contentInsets = NSDirectionalEdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4)

            let groupSize = NSCollectionLayoutSize(
                widthDimension: .fractionalWidth(1.0),
                heightDimension: .estimated(250)
            )
            let group = NSCollectionLayoutGroup.horizontal(layoutSize: groupSize, subitems: [item, item])

            let section = NSCollectionLayoutSection(group: group)
            section.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12)
            return section

        default:
            fatalError("Unknown section")
        }
    }
}

// Diffable Data Source (type-safe, animated updates)
private func configureDiffableDataSource() {
    dataSource = UICollectionViewDiffableDataSource<Section, Product>(
        collectionView: collectionView
    ) { collectionView, indexPath, product in
        let cell = collectionView.dequeueReusableCell(
            withReuseIdentifier: ProductCell.reuseId,
            for: indexPath
        ) as! ProductCell
        cell.configure(with: product)
        return cell
    }
}

private func applySnapshot(products: [Product], animated: Bool = true) {
    var snapshot = NSDiffableDataSourceSnapshot<Section, Product>()
    snapshot.appendSections([.featured, .grid])
    snapshot.appendItems(products.filter(\.isFeatured), toSection: .featured)
    snapshot.appendItems(products.filter { !$0.isFeatured }, toSection: .grid)
    dataSource.apply(snapshot, animatingDifferences: animated)
}
```

---

## 4. ViewModel Pattern

```swift
// ViewModel — NO import UIKit
import Foundation
import Combine

class ProductListViewModel {
    // Outputs (ViewController observes)
    @Published private(set) var products: [Product] = []
    @Published private(set) var isLoading = false
    @Published private(set) var error: Error?

    // Navigation callbacks (Coordinator handles)
    var onProductSelected: ((Product) -> Void)?
    var onCreateProduct: (() -> Void)?

    private let repository: ProductRepository

    init(repository: ProductRepository) {
        self.repository = repository
    }

    func loadProducts() {
        isLoading = true
        Task {
            do {
                products = try await repository.fetchAll()
            } catch {
                self.error = error
            }
            isLoading = false
        }
    }

    func selectProduct(_ product: Product) {
        onProductSelected?(product)
    }

    func deleteProduct(at index: Int) {
        let product = products[index]
        Task {
            do {
                try await repository.delete(product.id)
                products.remove(at: index)
            } catch {
                self.error = error
            }
        }
    }
}
```

---

## 5. SwiftUI Interop (Incremental Migration)

```swift
// Embed SwiftUI in UIKit (UIHostingController)
let swiftUIView = ProductDetailView(product: product)
let hostingController = UIHostingController(rootView: swiftUIView)
navigationController.pushViewController(hostingController, animated: true)

// Embed UIKit in SwiftUI (UIViewControllerRepresentable)
struct MapViewRepresentable: UIViewControllerRepresentable {
    let region: MKCoordinateRegion

    func makeUIViewController(context: Context) -> MKMapViewController {
        let vc = MKMapViewController()
        vc.setRegion(region)
        return vc
    }

    func updateUIViewController(_ vc: MKMapViewController, context: Context) {
        vc.setRegion(region)
    }
}

// MIGRATION STRATEGY:
// 1. New screens → SwiftUI
// 2. Shared components → SwiftUI (embedded via UIHostingController)
// 3. Existing screens → keep UIKit until full rewrite justified
// 4. Navigation → keep Coordinators, wrap SwiftUI screens
```

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Storyboards** | Merge conflicts, hidden segue dependencies, runtime crashes | Programmatic layout (NSLayoutConstraint or SnapKit) |
| **Massive ViewController** | 1000+ line VC with networking, navigation, UI, business logic | MVVM-C — extract ViewModel + Coordinator |
| **VC pushes VC** | Deep coupling between ViewControllers, untestable navigation | Coordinator pattern — VC delegates navigation to Coordinator |
| **UITableView for new code** | Limited layout options, complex section handling | UICollectionViewCompositionalLayout — handles ALL list layouts |
| **NotificationCenter for state** | Spaghetti data flow, impossible to trace state changes | Combine @Published or closure-based bindings |
| **Force unwrap IBOutlets** | Runtime crash when storyboard/xib connection breaks | Programmatic UI — no outlets needed |
| **Singletons everywhere** | Untestable, hidden dependencies, shared mutable state | Protocol-based dependency injection via Coordinator |
| **Retain cycles in closures** | Memory leaks, ViewControllers never deallocate | `[weak self]` in ALL closures that capture self |

---

## 7. Enforcement Checklist

### Architecture
- [ ] MVVM-C pattern (ViewModel + Coordinator)
- [ ] Coordinators handle ALL navigation
- [ ] ViewModels have NO UIKit imports
- [ ] Protocol-based dependency injection
- [ ] No storyboards — programmatic layout only

### UI
- [ ] UICollectionViewCompositionalLayout for lists/grids
- [ ] DiffableDataSource for type-safe, animated updates
- [ ] Auto Layout with NSLayoutConstraint or SnapKit
- [ ] Safe area insets respected
- [ ] Dynamic Type support

### Quality
- [ ] Unit tests for ALL ViewModels
- [ ] Mock repositories injected via protocols
- [ ] `[weak self]` in ALL closures
- [ ] Memory leak testing (Instruments / Debug Memory Graph)
- [ ] SwiftUI migration plan for new screens
