# Folder Naming Conventions

> **Domain:** Project Structure
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-08

## Ti einai (What it is)

Folder naming conventions are the standardized rules that dictate how directories and files in a software project are named. They encompass case style (kebab-case, PascalCase, snake_case, camelCase), pluralization rules, suffix conventions, and special directory patterns. Consistent naming is a foundational aspect of project structure that directly impacts developer productivity, tooling compatibility, and codebase navigability.

## Giati einai simantiko (Why it matters)

- **Cognitive load reduction**: Developers can predict file locations without searching
- **Tooling compatibility**: Many frameworks auto-resolve files based on naming conventions (Angular CLI, Next.js pages router, Rust module system)
- **Cross-platform safety**: Case-sensitivity differences between Linux (case-sensitive) and macOS/Windows (case-insensitive) cause real bugs
- **Onboarding speed**: New team members become productive faster with consistent conventions
- **Merge conflict reduction**: Agreed-upon naming prevents two developers creating `UserService.ts` vs `user-service.ts`
- **Automated code generation**: CLI tools and scaffolding rely on predictable naming patterns

---

## 1. Case Conventions by Ecosystem

### Decision Table: Which Case for Which Ecosystem

| Ecosystem | Folders | Files | Classes/Components | Reason |
|-----------|---------|-------|--------------------|--------|
| **Node.js / JavaScript** | `kebab-case` | `kebab-case.js` | PascalCase (in code) | npm convention; avoids cross-platform issues |
| **TypeScript / Angular** | `kebab-case` | `kebab-case.component.ts` | PascalCase (in code) | Angular Style Guide official standard |
| **React (community)** | `kebab-case` or `PascalCase` | `PascalCase.tsx` (components) | PascalCase | Component files match export name |
| **Next.js** | `kebab-case` | `kebab-case.tsx` (pages), `PascalCase.tsx` (components) | PascalCase | Pages = routes (lowercase); components = classes |
| **Python** | `snake_case` | `snake_case.py` | PascalCase (in code) | PEP 8 official standard |
| **Ruby / Rails** | `snake_case` | `snake_case.rb` | PascalCase (in code) | Ruby community standard |
| **Go** | `lowercase` (single word preferred) | `snake_case.go` or `lowercase.go` | PascalCase (exported) | Go spec: package names are lowercase, no underscores |
| **C# / .NET** | `PascalCase` | `PascalCase.cs` | PascalCase | Microsoft official .NET conventions |
| **Java** | `lowercase` (package segments) | `PascalCase.java` | PascalCase | Java Language Specification |
| **Rust** | `snake_case` | `snake_case.rs` | PascalCase (types in code) | Rust compiler enforces this with warnings |
| **PHP / Laravel** | `PascalCase` (classes) | `PascalCase.php` | PascalCase | PSR-4 autoloading standard |
| **Swift** | `PascalCase` | `PascalCase.swift` | PascalCase | Apple Swift conventions |
| **Kotlin** | `lowercase` (packages) | `PascalCase.kt` | PascalCase | Kotlin coding conventions |

### Detailed Examples by Ecosystem

#### Node.js / TypeScript (kebab-case)

```
src/
  user-management/
    user-profile.service.ts
    user-profile.controller.ts
    user-profile.model.ts
    user-profile.dto.ts
    user-profile.spec.ts
    index.ts                      # barrel file
  order-processing/
    order-processing.service.ts
    order-item.model.ts
    index.ts
  shared/
    string-utils.ts
    date-helpers.ts
    http-client.ts
```

#### Angular (kebab-case with type suffixes) -- Angular Style Guide

```
src/app/
  heroes/
    hero-list/
      hero-list.component.ts       # @Component class: HeroListComponent
      hero-list.component.html
      hero-list.component.scss
      hero-list.component.spec.ts
    hero-detail/
      hero-detail.component.ts
      hero-detail.component.html
    shared/
      hero.model.ts                # interface Hero
      hero.service.ts              # @Injectable class: HeroService
      hero-search.pipe.ts          # @Pipe class: HeroSearchPipe
      hero-highlight.directive.ts  # @Directive class: HeroHighlightDirective
    heroes-routing.module.ts
    heroes.module.ts
```

**Angular naming rules (from official style guide):**
- Use kebab-case for file names
- Always use descriptive suffixes: `.component.ts`, `.service.ts`, `.module.ts`, `.pipe.ts`, `.directive.ts`, `.guard.ts`, `.interceptor.ts`, `.resolver.ts`
- Class name = PascalCase version of file name + suffix (e.g., `hero-list.component.ts` -> `HeroListComponent`)
- One class per file (STYLE 01-01)
- Symbol name matches file name in casing convention

#### React (PascalCase for components, kebab-case for utilities)

```
src/
  components/
    UserProfile/
      UserProfile.tsx              # export default function UserProfile()
      UserProfile.styles.ts        # styled-components / CSS modules
      UserProfile.test.tsx
      UserProfile.stories.tsx      # Storybook
      index.ts                     # re-export
    DataTable/
      DataTable.tsx
      DataTableRow.tsx
      DataTableHeader.tsx
      index.ts
  hooks/
    use-auth.ts                    # export function useAuth()
    use-debounce.ts
    use-local-storage.ts
  utils/
    format-currency.ts
    validate-email.ts
  services/
    api-client.ts
    auth-service.ts
  types/
    user.types.ts
    order.types.ts
```

**React community consensus:**
- Component files: PascalCase (`UserProfile.tsx`) because the default export is a PascalCase component
- Non-component files: kebab-case (`use-auth.ts`, `api-client.ts`)
- Component folders: PascalCase to match the component name
- Utility/service folders: kebab-case or lowercase

#### Python (snake_case) -- PEP 8

```
my_project/
  user_management/
    __init__.py
    user_profile.py               # class UserProfile
    user_repository.py            # class UserRepository
    exceptions.py                 # class UserNotFoundError
  order_processing/
    __init__.py
    order_service.py
    order_item.py
  utils/
    __init__.py
    string_helpers.py
    date_utils.py
  tests/
    test_user_profile.py          # class TestUserProfile / def test_create_user()
    test_order_service.py
    conftest.py                   # pytest fixtures
```

**PEP 8 naming rules:**
- Modules (files): `snake_case.py` -- short, all-lowercase, underscores if needed
- Packages (folders): `snake_case` -- short, all-lowercase, underscores discouraged but allowed
- Classes: `PascalCase` (in code, not file names)
- Functions/variables: `snake_case`
- Constants: `UPPER_SNAKE_CASE`
- Private: prefix with `_single_underscore`
- Name-mangled: prefix with `__double_underscore`

#### Go (lowercase packages)

```
myapp/
  cmd/
    server/
      main.go
    cli/
      main.go
  internal/
    user/
      user.go                     # package user; type User struct{}
      user_test.go                # package user; func TestCreateUser(t *testing.T)
      repository.go               # package user; type Repository interface{}
      postgres_repository.go      # package user; type PostgresRepository struct{}
    order/
      order.go
      order_test.go
      service.go
  pkg/
    httpclient/
      client.go                   # package httpclient
      client_test.go
    stringutil/
      reverse.go
      reverse_test.go
  api/
    openapi.yaml
  configs/
    config.yaml
```

**Go naming rules (golang-standards/project-layout + Effective Go):**
- Package names: short, lowercase, single-word preferred (`user` not `userManagement`)
- No underscores or mixedCaps in package names
- File names: `snake_case.go` or `lowercase.go` (both accepted; snake_case more common for multi-word)
- Test files: `*_test.go` (mandatory suffix; Go toolchain requires this)
- Exported names: `PascalCase` (e.g., `func NewUser()`)
- Unexported names: `camelCase` (e.g., `func validateEmail()`)
- Avoid `util`, `common`, `misc` packages -- put code where it belongs

#### C# / .NET (PascalCase)

```
MyApp/
  Controllers/
    UserController.cs              # public class UserController
    OrderController.cs
  Services/
    UserService.cs                 # public class UserService : IUserService
    IUserService.cs                # public interface IUserService
    OrderService.cs
  Models/
    User.cs                        # public class User
    Order.cs
    OrderItem.cs
  Data/
    ApplicationDbContext.cs
    Repositories/
      UserRepository.cs
      IUserRepository.cs
  ViewModels/
    UserViewModel.cs
  DTOs/
    CreateUserDto.cs
    UserResponseDto.cs
  Middleware/
    ExceptionHandlingMiddleware.cs
  Extensions/
    ServiceCollectionExtensions.cs
  MyApp.csproj
```

**Microsoft .NET conventions:**
- Folders: PascalCase
- Files: PascalCase, matching the primary class name
- One primary class per file (file name = class name)
- Interfaces: `I` prefix (`IUserService`)
- Async methods: `Async` suffix (in code, not file names)
- Namespaces match folder structure: `MyApp.Services.UserService`

#### Rust (snake_case)

```
my_crate/
  src/
    lib.rs                         # crate root
    main.rs                        # binary entry point
    user/
      mod.rs                       # pub mod user; (module declaration)
      profile.rs                   # pub struct Profile
      repository.rs
    order/
      mod.rs
      service.rs
    utils/
      string_helpers.rs
      date_utils.rs
    config.rs
    error.rs
  tests/
    integration_test.rs            # integration tests
  benches/
    benchmark.rs
  examples/
    basic_usage.rs
  Cargo.toml
```

**Rust naming rules (enforced by compiler warnings):**
- Modules/files: `snake_case` (compiler warns on anything else)
- Types (struct, enum, trait): `PascalCase`
- Functions/variables: `snake_case`
- Constants: `UPPER_SNAKE_CASE`
- Module declaration: `mod.rs` inside a folder, or `module_name.rs` at parent level (Rust 2018+ supports both)
- Crate names: `kebab-case` in Cargo.toml, `snake_case` when imported

---

## 2. File Naming by Type

### Universal Suffix/Type Conventions

| File Type | TypeScript/Angular | React | Python | Go | C# | Rust |
|-----------|-------------------|-------|--------|----|-----|------|
| **Component** | `*.component.ts` | `*.tsx` (PascalCase) | N/A | N/A | `*.cs` (View) | N/A |
| **Service** | `*.service.ts` | `*-service.ts` | `*_service.py` | `service.go` | `*Service.cs` | `service.rs` |
| **Model/Entity** | `*.model.ts` | `*.types.ts` | `*_model.py` | `*.go` (type in file) | `*.cs` | `*.rs` (struct) |
| **Repository** | `*.repository.ts` | `*-repository.ts` | `*_repository.py` | `repository.go` | `*Repository.cs` | `repository.rs` |
| **Controller** | `*.controller.ts` | N/A | `*_controller.py` or `views.py` | `handler.go` | `*Controller.cs` | `handler.rs` |
| **Utility** | `*.utils.ts` | `*-utils.ts` | `*_utils.py` | `*.go` (in `pkg/`) | `*Extensions.cs` | `*_utils.rs` |
| **DTO** | `*.dto.ts` | `*.types.ts` | `*_dto.py` / `schemas.py` | `dto.go` | `*Dto.cs` | `dto.rs` |
| **Config** | `*.config.ts` | `*.config.ts` | `config.py` / `settings.py` | `config.go` | `*Config.cs` | `config.rs` |
| **Middleware** | `*.middleware.ts` | N/A | `*_middleware.py` | `middleware.go` | `*Middleware.cs` | `middleware.rs` |
| **Guard** | `*.guard.ts` | N/A | `*_guard.py` | `guard.go` | N/A | `guard.rs` |
| **Pipe/Filter** | `*.pipe.ts` | N/A | N/A | N/A | N/A | N/A |
| **Interceptor** | `*.interceptor.ts` | N/A | N/A | N/A | N/A | N/A |
| **Interface** | `*.interface.ts` | `*.types.ts` | `protocol` in code | `interface` in `*.go` | `I*.cs` | `trait` in `*.rs` |
| **Enum** | `*.enum.ts` | in `*.types.ts` | in `enums.py` | in `*.go` (iota) | `*.cs` | in `*.rs` |
| **Constants** | `*.constants.ts` | `constants.ts` | `constants.py` | `constants.go` | `*Constants.cs` | `constants.rs` |
| **Validator** | `*.validator.ts` | `*-validator.ts` | `*_validator.py` | `validator.go` | `*Validator.cs` | `validator.rs` |

### Code Examples: Type Suffixes in Practice

**TypeScript/NestJS:**
```typescript
// user.entity.ts
export class User {
  id: string;
  email: string;
  name: string;
}

// user.dto.ts
export class CreateUserDto {
  email: string;
  name: string;
}

// user.service.ts
@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}
}

// user.controller.ts
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}
}

// user.module.ts
@Module({
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
```

**Python/Django:**
```python
# models.py (Django convention: plural, all models in one file per app)
class User(models.Model):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255)

# serializers.py
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'name']

# views.py (Django) or controllers.py (Flask/FastAPI)
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

# urls.py
urlpatterns = [
    path('users/', UserViewSet.as_view({'get': 'list'})),
]
```

---

## 3. Plural vs Singular Folder Names

### Industry Consensus

This is one of the most debated topics. Here is the analysis:

| Convention | Used By | Examples | Rationale |
|-----------|---------|----------|-----------|
| **Plural folders** | Angular, Rails, Laravel, NestJS, .NET (Controllers, Models, Services) | `components/`, `services/`, `models/`, `utils/` | "This folder contains multiple X items" |
| **Singular folders** | Go (package = singular noun), Domain-Driven Design, some React patterns | `component/`, `service/`, `model/`, `util/` | "This folder represents the X domain/concept" |
| **Mixed** | Next.js, many real-world projects | `pages/` (plural, convention), `lib/` (singular) | Framework dictates some; team picks rest |

### Detailed Guidance

**Use PLURAL when:**
- The folder is a **collection container** -- it holds many items of the same type
- Framework conventions mandate it (Angular: `components/`, Rails: `models/`, `controllers/`, `views/`)
- You are following REST-style resource naming

```
# Plural -- treating as collections
src/
  components/          # contains many components
    Button.tsx
    Modal.tsx
    DataTable.tsx
  services/            # contains many services
    auth-service.ts
    user-service.ts
  models/              # contains many models
    user.model.ts
    order.model.ts
  hooks/               # contains many hooks
    use-auth.ts
    use-theme.ts
  utils/               # contains many utilities
    format-date.ts
    validate-email.ts
```

**Use SINGULAR when:**
- The folder represents a **domain/feature boundary** (DDD bounded context)
- Go packages (mandatory: package names are singular nouns)
- The folder represents a single concept's internal organization

```
# Singular -- treating as domain boundaries
src/
  user/                # the "user" domain
    user.go
    repository.go
    service.go
  order/               # the "order" domain
    order.go
    handler.go
    service.go
```

### The Definitive Rule

**Pick one and be consistent within the project.** The strongest industry consensus is:

1. **Type-based folders: PLURAL** (`components/`, `services/`, `hooks/`, `utils/`, `models/`)
2. **Feature/domain folders: SINGULAR** (`user/`, `order/`, `auth/`, `payment/`)
3. **Never mix within the same level** -- do not have `components/` next to `hook/`

```
# CORRECT: consistent mixed approach (type=plural, feature=singular)
src/
  features/
    auth/                # singular feature
      components/        # plural type collection
      hooks/
      services/
    dashboard/
      components/
      hooks/
  shared/
    components/          # plural type collection
    utils/
    hooks/

# WRONG: inconsistent
src/
  component/            # singular
  services/             # plural -- inconsistent!
  model/                # singular
  hooks/                # plural -- inconsistent!
```

---

## 4. Index / Barrel File Conventions

### By Language/Ecosystem

#### TypeScript/JavaScript: `index.ts` (Barrel Files)

```typescript
// src/components/index.ts -- barrel file
export { Button } from './Button';
export { Modal } from './Modal';
export { DataTable } from './DataTable';
export type { ButtonProps } from './Button';
export type { ModalProps } from './Modal';

// Usage: clean imports
import { Button, Modal, DataTable } from '@/components';
// Instead of:
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
```

**Barrel file best practices:**
- Use in library/package code for clean public API
- **AVOID deep barrel files in application code** -- they cause circular dependencies and slow bundlers
- Never re-export everything with `export * from './...'` in large projects (tree-shaking issues)
- Place at feature boundaries, not every folder

```typescript
// GOOD: selective re-export at feature boundary
// src/features/auth/index.ts
export { AuthProvider } from './components/AuthProvider';
export { useAuth } from './hooks/use-auth';
export { loginAction } from './actions/login';
// Internal implementation details NOT exported

// BAD: wildcard re-export (breaks tree-shaking, hides circular deps)
export * from './components';
export * from './hooks';
export * from './utils';
export * from './services';
```

#### Python: `__init__.py`

```python
# src/user_management/__init__.py
from .user_service import UserService
from .user_repository import UserRepository
from .exceptions import UserNotFoundError

__all__ = ['UserService', 'UserRepository', 'UserNotFoundError']

# Usage:
from user_management import UserService
# Instead of:
from user_management.user_service import UserService
```

**Python `__init__.py` rules:**
- Required in Python 2; optional in Python 3 (namespace packages) but still recommended
- Keep `__init__.py` minimal -- avoid heavy computation
- Use `__all__` to define public API explicitly
- Empty `__init__.py` is valid and common (just marks directory as package)

#### Rust: `mod.rs`

```rust
// src/user/mod.rs
pub mod profile;
pub mod repository;
pub mod service;

pub use profile::UserProfile;
pub use repository::UserRepository;
pub use service::UserService;

// Alternative (Rust 2018+): src/user.rs instead of src/user/mod.rs
// Both are valid; mod.rs is traditional, user.rs is newer convention
```

#### Go: No barrel files (by design)

```go
// Go explicitly does NOT have barrel files.
// Each package is its own namespace.
// All exported symbols (PascalCase) from any .go file in a package
// are automatically available when importing the package.

// package user -- all .go files in user/ contribute to this package
import "myapp/internal/user"

u := user.NewUser("alice@example.com")  // from any .go file in user/
```

#### C#: No explicit barrel files (namespace-based)

```csharp
// C# uses namespaces, not file-based module systems.
// GlobalUsings.cs (C# 10+) can serve a similar purpose:
global using MyApp.Services;
global using MyApp.Models;
global using MyApp.Extensions;

// Or a Usings.cs file with global using directives
```

---

## 5. Test File Naming Conventions

### Decision Table by Ecosystem

| Ecosystem | Unit Test Files | Integration Test Files | Test Runner |
|-----------|----------------|----------------------|-------------|
| **TypeScript/JS (Jest)** | `*.test.ts`, `*.test.tsx` | `*.integration.test.ts` | Jest, Vitest |
| **Angular** | `*.spec.ts` | `*.integration.spec.ts` | Karma/Jasmine (legacy), Jest |
| **Python (pytest)** | `test_*.py` or `*_test.py` | `test_*.py` in `tests/integration/` | pytest |
| **Python (unittest)** | `test_*.py` | Same | unittest |
| **Go** | `*_test.go` (same package) | `*_test.go` (in `_test` package) | `go test` |
| **C# (.NET)** | `*Tests.cs` | `*IntegrationTests.cs` | xUnit, NUnit, MSTest |
| **Java** | `*Test.java` | `*IT.java` | JUnit, TestNG |
| **Rust** | inline `#[cfg(test)] mod tests` | `tests/*.rs` (separate dir) | `cargo test` |
| **Ruby (RSpec)** | `*_spec.rb` | `*_spec.rb` in `spec/integration/` | RSpec |
| **PHP (PHPUnit)** | `*Test.php` | `*Test.php` in `tests/Integration/` | PHPUnit |

### Test File Placement: Co-located vs Separate

#### Pattern A: Co-located tests (recommended for unit tests)

```
src/
  components/
    Button/
      Button.tsx
      Button.test.tsx           # RIGHT NEXT TO the file it tests
      Button.stories.tsx
    Modal/
      Modal.tsx
      Modal.test.tsx
  services/
    auth-service.ts
    auth-service.test.ts        # co-located
```

**Advantages:** Easy to find tests, easy to see untested files, encourages writing tests.

#### Pattern B: Separate test directory (common for integration/e2e tests)

```
src/
  components/
    Button.tsx
    Modal.tsx
  services/
    auth-service.ts
tests/                           # separate directory
  unit/
    components/
      Button.test.tsx
      Modal.test.tsx
    services/
      auth-service.test.ts
  integration/
    api/
      user-api.integration.test.ts
  e2e/
    user-flow.e2e.test.ts
```

**Advantages:** Clean `src/` directory, clear separation of test types.

#### Pattern C: `__tests__` directories (Jest convention)

```
src/
  components/
    __tests__/
      Button.test.tsx
      Modal.test.tsx
    Button.tsx
    Modal.tsx
```

#### Framework-Specific Examples

**Go (mandatory co-location):**
```
internal/user/
  user.go               # package user
  user_test.go           # package user (unit tests, same package access)
  export_test.go         # package user_test (black-box test, external package)
```

**Rust (inline unit + separate integration):**
```rust
// src/lib.rs -- unit tests inline
pub fn add(a: i32, b: i32) -> i32 { a + b }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add() {
        assert_eq!(add(2, 3), 5);
    }
}
```
```
// tests/integration_test.rs -- integration test (separate directory)
use my_crate::add;

#[test]
fn test_add_integration() {
    assert_eq!(add(10, 20), 30);
}
```

**Python (pytest):**
```python
# tests/test_user_service.py
import pytest
from my_app.user_management.user_service import UserService

class TestUserService:
    def test_create_user(self):
        service = UserService()
        user = service.create("alice@example.com")
        assert user.email == "alice@example.com"

    def test_create_user_invalid_email(self):
        service = UserService()
        with pytest.raises(ValueError):
            service.create("invalid-email")

# conftest.py -- shared fixtures
@pytest.fixture
def user_service():
    return UserService(repository=FakeUserRepository())
```

**C# (xUnit, separate project):**
```
MyApp.sln
  src/
    MyApp.Api/
      Controllers/UserController.cs
      Services/UserService.cs
    MyApp.Domain/
      Models/User.cs
  tests/
    MyApp.Api.Tests/               # separate test project
      Controllers/
        UserControllerTests.cs
      Services/
        UserServiceTests.cs
    MyApp.Integration.Tests/
      UserApiIntegrationTests.cs
```

---

## 6. Special Folders

### Dot-prefixed Configuration Folders

| Folder | Purpose | Ecosystem |
|--------|---------|-----------|
| `.github/` | GitHub Actions workflows, issue templates, PR templates, CODEOWNERS | GitHub |
| `.gitlab/` | GitLab CI config templates | GitLab |
| `.vscode/` | VS Code workspace settings, extensions recommendations, debug configs | VS Code |
| `.idea/` | JetBrains IDE settings (IntelliJ, WebStorm, PyCharm) | JetBrains |
| `.husky/` | Git hooks managed by Husky | Node.js |
| `.config/` | Project-level configuration files | Various |
| `.docker/` | Docker-related files (Dockerfiles, compose overrides) | Docker |
| `.circleci/` | CircleCI pipeline config | CircleCI |
| `.aws/` | AWS configuration | AWS |
| `.terraform/` | Terraform state and providers (auto-generated, NEVER commit) | Terraform |
| `.next/` | Next.js build output (NEVER commit) | Next.js |
| `.nuxt/` | Nuxt build output (NEVER commit) | Nuxt |
| `.cache/` | Various cache directories (NEVER commit) | Various |

### Dunder (Double Underscore) Directories

| Folder | Purpose | Ecosystem |
|--------|---------|-----------|
| `__tests__/` | Test files directory (Jest convention) | JavaScript/TypeScript |
| `__mocks__/` | Manual mock files for Jest | JavaScript/TypeScript |
| `__fixtures__/` | Test fixture data | JavaScript/TypeScript |
| `__snapshots__/` | Jest snapshot files (auto-generated) | JavaScript/TypeScript |
| `__pycache__/` | Python bytecode cache (NEVER commit) | Python |
| `__init__.py` | Python package marker (file, not folder) | Python |

### `.github/` Structure (Comprehensive)

```
.github/
  workflows/
    ci.yml                    # Main CI pipeline
    cd.yml                    # Continuous deployment
    release.yml               # Release automation
    codeql.yml                # Security scanning
    dependabot-automerge.yml  # Auto-merge Dependabot PRs
  ISSUE_TEMPLATE/
    bug_report.md
    feature_request.md
    config.yml                # Template chooser config
  PULL_REQUEST_TEMPLATE.md
  CODEOWNERS                  # Code ownership rules
  dependabot.yml              # Dependency update config
  FUNDING.yml                 # Sponsorship info
  SECURITY.md                 # Security policy
  renovate.json               # Renovate bot config (alternative to dependabot)
```

### `.husky/` Structure

```
.husky/
  pre-commit                  # Run linting before commit
  commit-msg                  # Validate commit message (commitlint)
  pre-push                    # Run tests before push
```

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx lint-staged

# .husky/commit-msg
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx --no -- commitlint --edit ${1}
```

---

## Best Practices

### Golden Rules

1. **Follow the ecosystem convention** -- do not impose Python conventions on a Node.js project
2. **Configure and enforce with tooling** -- ESLint rules (`unicorn/filename-case`), EditorConfig, CI checks
3. **Document the convention** -- add a `CONVENTIONS.md` or a section in `CONTRIBUTING.md`
4. **Use automated scaffolding** -- Angular CLI (`ng generate`), Rails generators, `dotnet new`, `cargo new`
5. **Be consistent above all else** -- a consistently "wrong" convention is better than an inconsistent "right" one
6. **Avoid deep nesting** -- 3-4 levels max; flatten when possible
7. **Avoid overly generic names** -- `utils/`, `helpers/`, `misc/`, `common/` become dumping grounds

### Enforcement Tooling

| Tool | What It Enforces | Ecosystem |
|------|-----------------|-----------|
| **eslint-plugin-unicorn** (`filename-case` rule) | File naming case | JavaScript/TypeScript |
| **eslint-plugin-filenames** | File naming patterns | JavaScript/TypeScript |
| **Angular ESLint** | Angular naming conventions | Angular |
| **Rust compiler** | `snake_case` modules (warns on violation) | Rust |
| **Go vet** | Package naming | Go |
| **flake8-import-order** | Import/module naming | Python |
| **EditorConfig** (`.editorconfig`) | Consistent file formatting | All |
| **ls-lint** | Directory and filename linting | All |

**ls-lint example (`.ls-lint.yml`):**
```yaml
ls:
  src:
    .ts: kebab-case
    .tsx: PascalCase
    .test.ts: kebab-case
    .spec.ts: kebab-case
  src/components:
    .tsx: PascalCase
    .test.tsx: PascalCase

ignore:
  - node_modules
  - .git
  - dist
```

---

## Anti-patterns / Common Mistakes

### Anti-pattern 1: Mixing Case Conventions

```
# BAD -- inconsistent case
src/
  UserProfile/
    userProfile.ts          # camelCase file
  order-management/         # kebab-case folder
    OrderService.ts         # PascalCase file
  CONSTANTS/                # UPPER_CASE folder
    appConstants.ts         # camelCase file

# GOOD -- consistent kebab-case (Node.js project)
src/
  user-profile/
    user-profile.ts
  order-management/
    order-service.ts
  constants/
    app-constants.ts
```

### Anti-pattern 2: Platform-Specific Case Bugs

```
# This works on macOS/Windows (case-insensitive) but BREAKS on Linux CI:
import { UserService } from './userservice';  // file is UserService.ts

# Fix: always match exact case, use kebab-case to avoid ambiguity
import { UserService } from './user-service';  // file is user-service.ts
```

### Anti-pattern 3: God Folders

```
# BAD -- everything dumped in utils/
src/
  utils/
    helpers.ts              # 2000 lines of random functions
    constants.ts            # every constant in the app
    types.ts                # every type in the app
    misc.ts                 # literally named "misc"

# GOOD -- organized by domain
src/
  shared/
    date/
      format-date.ts
      parse-date.ts
    validation/
      validate-email.ts
      validate-phone.ts
    http/
      http-client.ts
      interceptors.ts
```

### Anti-pattern 4: Overly Deep Nesting

```
# BAD -- 7 levels deep
src/app/modules/feature/user/components/profile/header/UserProfileHeader.tsx

# GOOD -- flat with clear naming
src/features/user/UserProfileHeader.tsx
```

### Anti-pattern 5: Redundant Names

```
# BAD -- folder name repeated in every file
src/
  user/
    user-user-service.ts
    user-user-model.ts
    user-user-controller.ts

# GOOD -- folder provides context
src/
  user/
    service.ts              # or user.service.ts (Angular style)
    model.ts
    controller.ts
```

### Anti-pattern 6: Barrel File Chains (Circular Dependencies)

```typescript
// BAD: barrel files re-exporting other barrel files creates circular dependency chains
// src/index.ts -> src/features/index.ts -> src/features/auth/index.ts -> imports from src/shared/index.ts -> ...

// This causes:
// 1. Circular dependency errors at runtime
// 2. Webpack/Vite struggling with tree-shaking
// 3. Slow IDE autocomplete

// GOOD: direct imports for application code
import { AuthService } from '@/features/auth/auth-service';
// Only use barrels at package/library boundaries
```

---

## Real-world Examples

### Next.js App Router (2024+ convention)

```
my-next-app/
  app/
    layout.tsx                    # root layout
    page.tsx                      # home page (route: /)
    globals.css
    (auth)/                       # route group (no URL impact)
      login/
        page.tsx                  # route: /login
      register/
        page.tsx                  # route: /register
    dashboard/
      layout.tsx                  # nested layout
      page.tsx                    # route: /dashboard
      settings/
        page.tsx                  # route: /dashboard/settings
    api/
      users/
        route.ts                  # API route: /api/users
      webhooks/
        stripe/
          route.ts                # API route: /api/webhooks/stripe
  components/
    ui/
      Button.tsx
      Input.tsx
      Modal.tsx
    forms/
      LoginForm.tsx
      RegisterForm.tsx
  lib/
    db.ts
    auth.ts
    utils.ts
  types/
    user.ts
    order.ts
  public/
    images/
    fonts/
```

### NestJS Enterprise Application

```
src/
  modules/
    auth/
      auth.module.ts
      auth.controller.ts
      auth.service.ts
      strategies/
        jwt.strategy.ts
        local.strategy.ts
      guards/
        jwt-auth.guard.ts
        roles.guard.ts
      decorators/
        current-user.decorator.ts
      dto/
        login.dto.ts
        register.dto.ts
    users/
      users.module.ts
      users.controller.ts
      users.service.ts
      users.repository.ts
      entities/
        user.entity.ts
      dto/
        create-user.dto.ts
        update-user.dto.ts
  common/
    filters/
      http-exception.filter.ts
    interceptors/
      logging.interceptor.ts
      transform.interceptor.ts
    pipes/
      validation.pipe.ts
    decorators/
      api-paginated-response.decorator.ts
  config/
    database.config.ts
    jwt.config.ts
    app.config.ts
  database/
    migrations/
    seeds/
  main.ts
  app.module.ts
```

---

## Sources

- **Angular Style Guide**: https://angular.dev/style-guide -- Official Angular naming conventions
- **Airbnb JavaScript Style Guide**: https://github.com/airbnb/javascript -- Community standard for JS naming
- **Google TypeScript Style Guide**: https://google.github.io/styleguide/tsguide.html -- Google's TS conventions
- **PEP 8**: https://peps.python.org/pep-0008/ -- Python official style guide (naming conventions section)
- **Effective Go**: https://go.dev/doc/effective_go -- Go naming conventions
- **golang-standards/project-layout**: https://github.com/golang-standards/project-layout -- Go project structure
- **Microsoft .NET Naming Guidelines**: https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/naming-guidelines
- **Rust Naming Conventions**: https://rust-lang.github.io/api-guidelines/naming.html
- **The Rust Book, Chapter 7 (Modules)**: https://doc.rust-lang.org/book/ch07-00-managing-growing-projects-with-packages-crates-and-modules.html
- **ls-lint**: https://ls-lint.org/ -- Directory and filename linter
- **eslint-plugin-unicorn**: https://github.com/sindresorhus/eslint-plugin-unicorn -- filename-case rule
