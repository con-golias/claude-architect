# Python Package Structure (2025+)

> **AI Plugin Directive:** When generating a Python package for distribution (PyPI), ALWAYS use this structure. Apply the `src/` layout with `pyproject.toml` as the single source of truth (PEP 621). NEVER use `setup.py` or `setup.cfg` for new projects. This guide covers modern Python packaging with Hatch, Poetry, PDM, or uv as the tool, pytest for testing, ruff for linting, mypy for type checking, and MkDocs for documentation. ALWAYS include the `py.typed` marker for PEP 561 compliance.

**Core Rule: Use the `src/` layout with `pyproject.toml` as the single source of truth. NEVER use `setup.py` for new projects. Define all metadata in `pyproject.toml` (PEP 621). Use dependency ranges (not pins) for library dependencies. Include `py.typed` marker for typed packages.**

---

## 1. src/ Layout vs Flat Layout

### 1.1 Decision Tree

```
START: Which layout?
│
├── Publishing to PyPI (library/package)?
│   └── ALWAYS use src/ layout ✓
│
├── Internal tool / application (not published)?
│   ├── Simple script ──→ flat layout OK
│   └── Larger application ──→ src/ layout recommended
│
└── Monorepo with multiple packages?
    └── src/ layout for each package ✓

WHY src/ LAYOUT:
├── Tests import the INSTALLED package, not local source
│   (catches packaging errors before users do)
├── Prevents accidentally importing unpackaged files
│   (if it's not in the wheel, tests fail immediately)
├── Forces proper packaging configuration
├── Standard in modern Python (recommended by PyPA)
├── Works correctly with editable installs (pip install -e .)
└── Avoids confusion between package directory and project root
```

### 1.2 Layout Comparison

```
SRC LAYOUT (recommended):            FLAT LAYOUT (legacy):
my-package/                           my-package/
├── src/                              ├── my_package/        ← Same level as tests
│   └── my_package/                   │   ├── __init__.py
│       ├── __init__.py               │   └── core.py
│       └── core.py                   ├── tests/
├── tests/                            │   └── test_core.py
│   └── test_core.py                  └── pyproject.toml
└── pyproject.toml

DANGER WITH FLAT LAYOUT:
$ cd my-package/
$ python -c "import my_package"   ← Imports local source, NOT installed package
                                     Tests pass even if packaging is broken!

WITH SRC LAYOUT:
$ cd my-package/
$ python -c "import my_package"   ← ImportError (not installed)
$ pip install -e .                ← Install first
$ python -c "import my_package"   ← Imports installed package ✓
```

---

## 2. Enterprise Package Structure (60+ files)

```
my-package/
├── src/
│   └── my_package/                        # Package directory (importable name)
│       ├── __init__.py                    # Package init, public API, __version__
│       ├── py.typed                       # PEP 561 marker (typed package)
│       │
│       ├── core/                          # Core functionality
│       │   ├── __init__.py
│       │   ├── client.py                  # Main client class
│       │   ├── config.py                  # Configuration (Pydantic Settings)
│       │   ├── types.py                   # TypedDict, Protocol, type aliases
│       │   └── constants.py               # Constants
│       │
│       ├── models/                        # Data models
│       │   ├── __init__.py
│       │   ├── base.py                    # Base model class
│       │   ├── user.py                    # User model
│       │   ├── post.py                    # Post model
│       │   └── response.py               # API response models
│       │
│       ├── services/                      # Business logic services
│       │   ├── __init__.py
│       │   ├── auth.py                    # Authentication service
│       │   ├── users.py                   # User service
│       │   └── posts.py                   # Post service
│       │
│       ├── http/                          # HTTP client layer
│       │   ├── __init__.py
│       │   ├── client.py                  # httpx-based HTTP client
│       │   ├── retry.py                   # Retry logic (tenacity)
│       │   ├── interceptors.py            # Request/response hooks
│       │   └── errors.py                  # HTTP error classes
│       │
│       ├── utils/                         # Utility functions
│       │   ├── __init__.py
│       │   ├── formatting.py              # String/date formatting
│       │   ├── validation.py              # Input validation
│       │   ├── hashing.py                 # Hash utilities
│       │   └── retry.py                   # Generic retry decorator
│       │
│       ├── exceptions.py                  # Custom exception hierarchy
│       │
│       ├── cli.py                         # CLI entry point (click/typer)
│       │
│       └── _internal/                     # Private internals (underscore prefix)
│           ├── __init__.py
│           ├── _compat.py                 # Python version compatibility
│           ├── _cache.py                  # Internal caching
│           └── _helpers.py                # Internal helper functions
│
├── tests/                                 # Test suite
│   ├── __init__.py
│   ├── conftest.py                        # Shared fixtures (project-wide)
│   │
│   ├── unit/                              # Unit tests (fast, no I/O)
│   │   ├── __init__.py
│   │   ├── conftest.py                    # Unit test fixtures
│   │   ├── test_client.py
│   │   ├── test_config.py
│   │   ├── test_models.py
│   │   ├── test_auth_service.py
│   │   ├── test_users_service.py
│   │   ├── test_formatting.py
│   │   ├── test_validation.py
│   │   └── test_exceptions.py
│   │
│   ├── integration/                       # Integration tests (external services)
│   │   ├── __init__.py
│   │   ├── conftest.py                    # Integration fixtures (API mocks, DB)
│   │   ├── test_http_client.py
│   │   └── test_cli.py
│   │
│   └── fixtures/                          # Test data files
│       ├── sample_response.json
│       ├── sample_users.json
│       └── sample_config.toml
│
├── docs/                                  # Documentation source (MkDocs)
│   ├── index.md                           # Home page
│   ├── getting-started.md                 # Quick start guide
│   ├── configuration.md                   # Configuration reference
│   ├── api-reference/                     # Auto-generated API docs
│   │   ├── client.md
│   │   ├── models.md
│   │   └── exceptions.md
│   ├── guides/
│   │   ├── authentication.md
│   │   ├── error-handling.md
│   │   ├── advanced-usage.md
│   │   └── migration.md
│   └── changelog.md                       # Links to CHANGELOG
│
├── examples/                              # Runnable examples
│   ├── basic_usage.py
│   ├── authentication.py
│   ├── error_handling.py
│   ├── async_usage.py
│   └── cli_example.sh
│
├── .github/
│   └── workflows/
│       ├── ci.yml                         # Test + lint on PR
│       ├── publish.yml                    # Publish to PyPI on release
│       └── docs.yml                       # Build + deploy docs
│
├── pyproject.toml                         # Build system + metadata (PEP 621)
├── mkdocs.yml                             # MkDocs configuration
├── noxfile.py                             # Nox test automation (or tox.ini)
├── .pre-commit-config.yaml                # Pre-commit hooks
├── .gitignore
├── .python-version                        # Python version (for pyenv/uv)
├── CHANGELOG.md
├── LICENSE
├── README.md
└── CONTRIBUTING.md
```

---

## 3. pyproject.toml (Complete Configuration)

### 3.1 With Hatchling (Recommended)

```toml
# pyproject.toml

# ============================================================================
# Build System
# ============================================================================
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

# ============================================================================
# Project Metadata (PEP 621)
# ============================================================================
[project]
name = "my-package"
version = "1.0.0"
description = "A production-grade Python SDK for the Example API"
readme = "README.md"
license = "MIT"
requires-python = ">=3.10"
authors = [
    { name = "Author Name", email = "author@example.com" },
]
maintainers = [
    { name = "Maintainer Name", email = "maintainer@example.com" },
]
keywords = ["sdk", "api-client", "http", "async"]
classifiers = [
    "Development Status :: 5 - Production/Stable",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: MIT License",
    "Operating System :: OS Independent",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
    "Programming Language :: Python :: 3.13",
    "Typing :: Typed",
    "Topic :: Software Development :: Libraries :: Python Modules",
]

# Runtime dependencies (use ranges for libraries, NOT pins)
dependencies = [
    "httpx>=0.27,<1.0",
    "pydantic>=2.0,<3.0",
    "tenacity>=8.0,<10.0",
]

# ============================================================================
# Optional Dependencies
# ============================================================================
[project.optional-dependencies]
# Development dependencies
dev = [
    "pytest>=8.0",
    "pytest-cov>=5.0",
    "pytest-asyncio>=0.24",
    "pytest-xdist>=3.5",          # Parallel test execution
    "pytest-mock>=3.14",
    "respx>=0.21",                # httpx mocking
    "ruff>=0.8",
    "mypy>=1.13",
    "pre-commit>=4.0",
    "nox>=2024.4",
]

# Documentation dependencies
docs = [
    "mkdocs>=1.6",
    "mkdocs-material>=9.5",
    "mkdocstrings[python]>=0.26",
    "mkdocs-gen-files>=0.5",
    "mkdocs-literate-nav>=0.6",
]

# CLI extra (only if using CLI)
cli = [
    "typer>=0.12,<1.0",
    "rich>=13.0,<14.0",
]

# All extras combined
all = ["my-package[cli]"]

# ============================================================================
# Entry Points
# ============================================================================
[project.scripts]
# Console scripts (CLI commands)
my-package = "my_package.cli:app"

# Alternative: GUI scripts
# [project.gui-scripts]
# my-package-gui = "my_package.gui:main"

# Plugin entry points
# [project.entry-points."my_package.plugins"]
# builtin = "my_package.plugins.builtin:BuiltinPlugin"

# ============================================================================
# URLs
# ============================================================================
[project.urls]
Homepage = "https://github.com/myorg/my-package"
Documentation = "https://myorg.github.io/my-package"
Repository = "https://github.com/myorg/my-package"
Changelog = "https://github.com/myorg/my-package/blob/main/CHANGELOG.md"
"Issue Tracker" = "https://github.com/myorg/my-package/issues"

# ============================================================================
# Build Configuration (Hatch)
# ============================================================================
[tool.hatch.build.targets.wheel]
packages = ["src/my_package"]

[tool.hatch.build.targets.sdist]
include = [
    "src/my_package",
    "tests",
    "LICENSE",
    "README.md",
    "CHANGELOG.md",
    "pyproject.toml",
]

# Dynamic versioning from VCS (alternative to static version)
# [tool.hatch.version]
# source = "vcs"

# ============================================================================
# Hatch Environments (if using hatch as tool manager)
# ============================================================================
[tool.hatch.envs.default]
dependencies = [
    "my-package[dev]",
]

[tool.hatch.envs.default.scripts]
test = "pytest {args:tests}"
test-cov = "pytest --cov=my_package --cov-report=term-missing {args:tests}"
lint = "ruff check src/ tests/"
lint-fix = "ruff check src/ tests/ --fix"
format = "ruff format src/ tests/"
format-check = "ruff format src/ tests/ --check"
typecheck = "mypy src/my_package"
all = ["lint", "typecheck", "test"]

[tool.hatch.envs.docs]
dependencies = [
    "my-package[docs]",
]

[tool.hatch.envs.docs.scripts]
build = "mkdocs build"
serve = "mkdocs serve"
deploy = "mkdocs gh-deploy --force"

# ============================================================================
# pytest Configuration
# ============================================================================
[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["src"]
asyncio_mode = "auto"
addopts = [
    "--strict-markers",
    "--strict-config",
    "-ra",                          # Show extra test summary
    "-q",                           # Quieter output
]
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "integration: marks tests as integration tests",
]
filterwarnings = [
    "error",                        # Treat warnings as errors
    "ignore::DeprecationWarning",
]

# ============================================================================
# Coverage Configuration
# ============================================================================
[tool.coverage.run]
source = ["my_package"]
branch = true
parallel = true
omit = [
    "src/my_package/_internal/*",
    "src/my_package/cli.py",
]

[tool.coverage.report]
precision = 2
show_missing = true
skip_covered = true
fail_under = 80
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "if TYPE_CHECKING:",
    "if __name__ == .__main__.",
    "@overload",
    "raise NotImplementedError",
    "pass",
    "\\.\\.\\.",
]

[tool.coverage.paths]
source = [
    "src/my_package",
    "*/site-packages/my_package",
]

# ============================================================================
# Ruff Configuration (Linter + Formatter)
# ============================================================================
[tool.ruff]
target-version = "py310"
line-length = 88
src = ["src", "tests"]

[tool.ruff.lint]
select = [
    "E",       # pycodestyle errors
    "W",       # pycodestyle warnings
    "F",       # pyflakes
    "I",       # isort (import sorting)
    "N",       # pep8-naming
    "UP",      # pyupgrade
    "B",       # flake8-bugbear
    "SIM",     # flake8-simplify
    "TCH",     # flake8-type-checking
    "RUF",     # Ruff-specific rules
    "S",       # flake8-bandit (security)
    "C4",      # flake8-comprehensions
    "DTZ",     # flake8-datetimez
    "T20",     # flake8-print (no print statements)
    "PT",      # flake8-pytest-style
    "ERA",     # eradicate (commented-out code)
    "PL",      # pylint
    "PERF",    # perflint
    "FURB",    # refurb
    "LOG",     # flake8-logging
    "ANN",     # flake8-annotations (type annotations)
]
ignore = [
    "ANN101",  # Missing type annotation for self
    "ANN102",  # Missing type annotation for cls
    "ANN401",  # Dynamically typed expressions (typing.Any)
    "S101",    # Use of assert (OK in tests)
    "PLR0913", # Too many arguments (sometimes necessary)
]

[tool.ruff.lint.per-file-ignores]
"tests/**/*.py" = [
    "S101",    # asserts allowed in tests
    "ANN",     # annotations optional in tests
    "T20",     # prints allowed in tests
]

[tool.ruff.lint.isort]
known-first-party = ["my_package"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
skip-magic-trailing-comma = false

# ============================================================================
# mypy Configuration (Type Checker)
# ============================================================================
[tool.mypy]
python_version = "3.10"
strict = true
warn_return_any = true
warn_unused_configs = true
warn_redundant_casts = true
warn_unused_ignores = true
disallow_any_generics = true
check_untyped_defs = true
no_implicit_reexport = true
disallow_untyped_defs = true

[[tool.mypy.overrides]]
module = "tests.*"
disallow_untyped_defs = false
disallow_untyped_decorators = false

[[tool.mypy.overrides]]
module = "my_package._internal.*"
disallow_any_generics = false
```

### 3.2 With Poetry (Alternative)

```toml
# pyproject.toml (Poetry variant)
[tool.poetry]
name = "my-package"
version = "1.0.0"
description = "A production-grade Python SDK"
authors = ["Author Name <author@example.com>"]
license = "MIT"
readme = "README.md"
packages = [{ include = "my_package", from = "src" }]
classifiers = [
    "Typing :: Typed",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
]

[tool.poetry.dependencies]
python = ">=3.10,<4.0"
httpx = ">=0.27,<1.0"
pydantic = ">=2.0,<3.0"

[tool.poetry.group.dev.dependencies]
pytest = ">=8.0"
pytest-cov = ">=5.0"
pytest-asyncio = ">=0.24"
ruff = ">=0.8"
mypy = ">=1.13"

[tool.poetry.group.docs.dependencies]
mkdocs = ">=1.6"
mkdocs-material = ">=9.5"

[tool.poetry.scripts]
my-package = "my_package.cli:app"

[build-system]
requires = ["poetry-core>=1.0.0"]
build-backend = "poetry.core.masonry.api"
```

### 3.3 With PDM (Alternative)

```toml
# pyproject.toml (PDM variant)
[build-system]
requires = ["pdm-backend"]
build-backend = "pdm.backend"

[project]
name = "my-package"
version = "1.0.0"
# ... same PEP 621 metadata as hatchling version ...

[tool.pdm]
distribution = true

[tool.pdm.build]
package-dir = "src"

[tool.pdm.dev-dependencies]
dev = [
    "pytest>=8.0",
    "ruff>=0.8",
    "mypy>=1.13",
]
docs = [
    "mkdocs>=1.6",
]
```

---

## 4. Build Backends Comparison

| Feature | Hatchling | Setuptools | Flit | Poetry-core | PDM-backend | Maturin |
|---------|-----------|-----------|------|-------------|------------|---------|
| PEP 621 | Yes | Yes (62+) | Yes | No (own format) | Yes | Yes |
| src/ layout | Yes | Yes | Yes | Yes | Yes | Yes |
| Build speed | Fast | Medium | Fast | Fast | Fast | Fast |
| Dynamic version | VCS, file, env | attr, file | No | Poetry format | VCS, file | Cargo.toml |
| Editable installs | Yes | Yes | Yes | Yes | Yes | Yes |
| C extensions | No | Yes | No | No | No | Yes (Rust) |
| Best for | Pure Python libs | C extensions | Simple libs | Poetry ecosystem | PDM ecosystem | Rust + Python |
| Recommendation | **Default choice** | Legacy/C code | Minimalist | Poetry users | PDM users | Rust extensions |

---

## 5. Tool Manager Comparison (Poetry vs Hatch vs PDM vs uv)

### 5.1 Decision Tree

```
START: Which Python tool?
│
├── Q1: Do you need fast dependency resolution + virtual envs?
│   └── uv ✓ (fastest, Rust-based, 2024+)
│
├── Q2: Do you want an all-in-one project management tool?
│   ├── Coming from Node.js/npm world ──→ PDM (npm-like lockfile)
│   ├── Want mature ecosystem ──→ Poetry (most popular)
│   └── Want PEP-standard everything ──→ Hatch (PyPA aligned)
│
├── Q3: Do you want maximum PEP compliance?
│   └── Hatch ✓ (uses PEP 621, hatchling backend)
│
└── Q4: Do you need lock files?
    ├── Yes ──→ Poetry, PDM, or uv
    └── No (library, not app) ──→ Hatch (no lock file by design)

RECOMMENDED COMBINATIONS:
├── Library for PyPI: Hatch (tool) + Hatchling (backend) + uv (installer)
├── Application: uv (tool + installer + lockfile)
├── Poetry ecosystem: Poetry (tool) + poetry-core (backend)
└── Simple library: Flit (tool + backend) for minimal config
```

### 5.2 Comparison Matrix

| Feature | Poetry | Hatch | PDM | uv |
|---------|--------|-------|-----|-----|
| **Speed** | Slow | Medium | Medium | Very fast (Rust) |
| **Lock file** | poetry.lock | No (by design) | pdm.lock | uv.lock |
| **PEP 621** | No (own format) | Yes | Yes | Yes |
| **Virtual envs** | Automatic | Managed | Automatic | Automatic |
| **Build backend** | poetry-core | hatchling | pdm-backend | Any |
| **Scripts/tasks** | No | Yes (hatch.envs) | Yes (pdm run) | Yes (uv run) |
| **Publish** | `poetry publish` | `hatch publish` | `pdm publish` | `uv publish` |
| **Multi-env** | No | Yes (matrix) | No | No |
| **Maturity** | High (2018+) | Growing (2022+) | Growing (2021+) | Rapid (2024+) |
| **Community** | Very large | Growing | Growing | Fast growing |
| **Recommendation** | Established teams | PEP-standard libs | npm-like workflow | Speed-critical |

---

## 6. Dependency Management

### 6.1 Library vs Application Dependencies

```
FOR LIBRARIES (published to PyPI):
├── Use ranges, NOT pins
│   GOOD: "httpx>=0.27,<1.0"
│   BAD:  "httpx==0.27.2"
│
├── Reason: Library consumers need flexibility
│   Your pin conflicts with their other dependencies
│
├── Use >= for minimum, < for maximum major version
│   "pydantic>=2.0,<3.0" → Accept any 2.x
│
└── NEVER pin transitive dependencies
    Let the solver resolve them

FOR APPLICATIONS (deployed, not published):
├── USE pins (via lock file)
│   poetry.lock, pdm.lock, uv.lock, requirements.txt
│
├── Reason: Reproducible builds, security
│   Same deps on every machine, every deploy
│
├── Pin everything: direct + transitive
│   pip freeze > requirements.txt (simple)
│   uv lock (modern)
│
└── Update regularly with dependabot/renovate
```

### 6.2 Optional Dependencies

```toml
[project.optional-dependencies]
# Extras that consumers can install:
# pip install my-package[cli]
# pip install my-package[all]

# Feature extras
cli = ["typer>=0.12,<1.0", "rich>=13.0,<14.0"]
async = ["anyio>=4.0,<5.0"]
caching = ["redis>=5.0,<6.0", "hiredis>=2.0"]

# Development extras (for contributors)
dev = ["pytest>=8.0", "ruff>=0.8", "mypy>=1.13"]
docs = ["mkdocs>=1.6", "mkdocs-material>=9.5"]

# All optional features
all = ["my-package[cli,async,caching]"]
```

---

## 7. Entry Points (console_scripts)

```toml
# pyproject.toml
[project.scripts]
# Creates a CLI command "my-package" that calls my_package.cli:app
my-package = "my_package.cli:app"

# Multiple commands
my-package-serve = "my_package.server:main"
my-package-migrate = "my_package.db:migrate"
```

```python
# src/my_package/cli.py
import typer
from rich.console import Console

app = typer.Typer(
    name="my-package",
    help="CLI for my-package operations",
    no_args_is_help=True,
)
console = Console()


@app.command()
def init(
    name: str = typer.Argument(..., help="Project name"),
    template: str = typer.Option("default", "--template", "-t", help="Template to use"),
) -> None:
    """Initialize a new project."""
    console.print(f"Creating project '{name}' with template '{template}'...")


@app.command()
def serve(
    host: str = typer.Option("127.0.0.1", "--host", "-h"),
    port: int = typer.Option(8000, "--port", "-p"),
    reload: bool = typer.Option(False, "--reload", "-r"),
) -> None:
    """Start the development server."""
    console.print(f"Starting server on {host}:{port}...")


@app.command()
def version() -> None:
    """Show the current version."""
    from my_package import __version__
    console.print(f"my-package {__version__}")


if __name__ == "__main__":
    app()
```

---

## 8. Namespace Packages

```
NAMESPACE PACKAGES (PEP 420):
Allow splitting a package across multiple distributions.

Example: myorg.core and myorg.utils are separate PyPI packages
         but share the myorg namespace.

STRUCTURE:
myorg-core/
├── src/
│   └── myorg/                # NO __init__.py (namespace package)
│       └── core/
│           ├── __init__.py
│           └── client.py
└── pyproject.toml

myorg-utils/
├── src/
│   └── myorg/                # NO __init__.py (namespace package)
│       └── utils/
│           ├── __init__.py
│           └── format.py
└── pyproject.toml

USAGE:
from myorg.core import Client      # From myorg-core package
from myorg.utils import format     # From myorg-utils package

RULES:
├── The shared namespace directory (myorg/) MUST NOT have __init__.py
├── Each sub-package (core/, utils/) MUST have __init__.py
├── Use the same namespace across all distributions
└── Configure build backend to handle namespace:
    [tool.hatch.build.targets.wheel]
    packages = ["src/myorg"]
```

---

## 9. Testing (pytest + nox)

### 9.1 conftest.py

```python
# tests/conftest.py
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
import respx
from httpx import Response

from my_package.core.client import Client
from my_package.core.config import Config


FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_config() -> Config:
    """Create a test configuration."""
    return Config(
        api_key="test-api-key",
        base_url="https://api.test.example.com",
        timeout=5.0,
        max_retries=1,
    )


@pytest.fixture
def client(sample_config: Config) -> Client:
    """Create a test client."""
    return Client(config=sample_config)


@pytest.fixture
def mock_api() -> respx.MockRouter:
    """Mock the HTTP API using respx."""
    with respx.mock(assert_all_called=False) as respx_mock:
        yield respx_mock


@pytest.fixture
def sample_user_data() -> dict[str, Any]:
    """Load sample user data from fixture."""
    fixture_path = FIXTURES_DIR / "sample_users.json"
    return json.loads(fixture_path.read_text())


@pytest.fixture
def mock_user_api(mock_api: respx.MockRouter, sample_user_data: dict) -> None:
    """Set up user API mocks."""
    mock_api.get("/users").mock(
        return_value=Response(200, json=sample_user_data)
    )
    mock_api.get("/users/1").mock(
        return_value=Response(200, json=sample_user_data["users"][0])
    )
    mock_api.post("/users").mock(
        return_value=Response(201, json={"id": "new-1", "name": "New User"})
    )
```

### 9.2 Unit Test Examples

```python
# tests/unit/test_client.py
from __future__ import annotations

import pytest
from my_package.core.client import Client
from my_package.core.config import Config
from my_package.exceptions import AuthenticationError, ConfigurationError


class TestClientInit:
    """Tests for Client initialization."""

    def test_creates_client_with_valid_config(self, sample_config: Config) -> None:
        client = Client(config=sample_config)
        assert client.config.base_url == "https://api.test.example.com"
        assert client.config.timeout == 5.0

    def test_creates_client_with_api_key_only(self) -> None:
        client = Client(api_key="test-key")
        assert client.config.base_url == "https://api.example.com"  # default

    def test_raises_on_missing_api_key(self) -> None:
        with pytest.raises(ConfigurationError, match="API key is required"):
            Client(api_key="")

    def test_raises_on_invalid_base_url(self) -> None:
        with pytest.raises(ConfigurationError, match="Invalid base URL"):
            Client(api_key="key", base_url="not-a-url")


class TestClientUsers:
    """Tests for Client.users operations."""

    @pytest.mark.asyncio
    async def test_list_users(
        self, client: Client, mock_user_api: None
    ) -> None:
        users = await client.users.list()
        assert len(users) > 0
        assert users[0].name == "Test User"

    @pytest.mark.asyncio
    async def test_get_user_by_id(
        self, client: Client, mock_user_api: None
    ) -> None:
        user = await client.users.get("1")
        assert user.id == "1"
        assert user.email == "test@example.com"

    @pytest.mark.asyncio
    async def test_get_nonexistent_user_raises(
        self, client: Client, mock_api: respx.MockRouter
    ) -> None:
        mock_api.get("/users/999").mock(
            return_value=Response(404, json={"error": "Not found"})
        )
        with pytest.raises(my_package.exceptions.NotFoundError):
            await client.users.get("999")


# tests/unit/test_validation.py
import pytest
from my_package.utils.validation import validate_email, validate_api_key


@pytest.mark.parametrize(
    "email,expected",
    [
        ("user@example.com", True),
        ("user+tag@example.com", True),
        ("invalid", False),
        ("@example.com", False),
        ("user@", False),
        ("", False),
    ],
)
def test_validate_email(email: str, expected: bool) -> None:
    assert validate_email(email) == expected


@pytest.mark.parametrize(
    "key,valid",
    [
        ("sk_live_abc123def456", True),
        ("sk_test_abc123def456", True),
        ("", False),
        ("invalid-key", False),
    ],
)
def test_validate_api_key(key: str, valid: bool) -> None:
    assert validate_api_key(key) == valid
```

### 9.3 nox Configuration (Multi-Environment Testing)

```python
# noxfile.py
from __future__ import annotations

import nox

nox.options.default_venv_backend = "uv"  # Use uv for speed
nox.options.reuse_existing_virtualenvs = True

PYTHON_VERSIONS = ["3.10", "3.11", "3.12", "3.13"]


@nox.session(python=PYTHON_VERSIONS)
def tests(session: nox.Session) -> None:
    """Run the test suite across Python versions."""
    session.install(".[dev]")
    session.run(
        "pytest",
        "--cov=my_package",
        "--cov-report=term-missing",
        "--cov-report=xml",
        *session.posargs,
    )


@nox.session(python="3.12")
def lint(session: nox.Session) -> None:
    """Run linting."""
    session.install("ruff")
    session.run("ruff", "check", "src/", "tests/")
    session.run("ruff", "format", "--check", "src/", "tests/")


@nox.session(python="3.12")
def typecheck(session: nox.Session) -> None:
    """Run type checking."""
    session.install(".[dev]")
    session.run("mypy", "src/my_package")


@nox.session(python="3.12")
def docs(session: nox.Session) -> None:
    """Build the documentation."""
    session.install(".[docs]")
    session.run("mkdocs", "build", "--strict")


@nox.session(python="3.12")
def build(session: nox.Session) -> None:
    """Build the package."""
    session.install("build", "twine")
    session.run("python", "-m", "build")
    session.run("twine", "check", "dist/*")
```

---

## 10. Documentation (MkDocs + mkdocstrings)

```yaml
# mkdocs.yml
site_name: my-package
site_url: https://myorg.github.io/my-package
repo_url: https://github.com/myorg/my-package
repo_name: myorg/my-package

theme:
  name: material
  palette:
    - scheme: default
      primary: indigo
      accent: indigo
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
    - scheme: slate
      primary: indigo
      accent: indigo
      toggle:
        icon: material/brightness-4
        name: Switch to light mode
  features:
    - content.code.copy
    - content.code.annotate
    - navigation.sections
    - navigation.expand
    - navigation.indexes
    - search.suggest
    - search.highlight

plugins:
  - search
  - mkdocstrings:
      handlers:
        python:
          options:
            show_source: true
            show_root_heading: true
            show_category_heading: true
            docstring_style: google
  - gen-files:
      scripts:
        - docs/gen_ref_pages.py
  - literate-nav:
      nav_file: SUMMARY.md

nav:
  - Home: index.md
  - Getting Started: getting-started.md
  - Configuration: configuration.md
  - Guides:
      - Authentication: guides/authentication.md
      - Error Handling: guides/error-handling.md
      - Advanced Usage: guides/advanced-usage.md
      - Migration: guides/migration.md
  - API Reference: api-reference/
  - Changelog: changelog.md

markdown_extensions:
  - pymdownx.highlight:
      anchor_liners: true
  - pymdownx.inlinehilite
  - pymdownx.snippets
  - pymdownx.superfences
  - pymdownx.tabbed:
      alternate_style: true
  - admonition
  - pymdownx.details
  - toc:
      permalink: true
```

---

## 11. Publishing to PyPI

### 11.1 GitHub Actions Workflow

```yaml
# .github/workflows/publish.yml
name: Publish to PyPI

on:
  release:
    types: [published]

permissions:
  id-token: write    # Trusted publishing (no API token needed)
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install build tools
        run: pip install build

      - name: Build package
        run: python -m build

      - name: Check dist
        run: |
          pip install twine
          twine check dist/*

      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  publish:
    needs: build
    runs-on: ubuntu-latest
    environment: pypi    # GitHub environment for trusted publishing

    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - name: Publish to PyPI
        uses: pypa/gh-action-pypi-publish@release/v1
        # No API token needed - uses trusted publishing (OIDC)
```

### 11.2 Trusted Publishing (Recommended)

```
TRUSTED PUBLISHING (PyPI):

What: OIDC-based publishing from GitHub Actions to PyPI
      without storing API tokens as secrets.

Setup:
1. Go to PyPI → Your Project → Settings → Publishing
2. Add new publisher:
   - Owner: myorg
   - Repository: my-package
   - Workflow: publish.yml
   - Environment: pypi

Benefits:
├── No long-lived API tokens to rotate
├── Scoped to specific repository + workflow
├── Audit trail in PyPI
├── Cannot be used from other repos/workflows
└── PyPA recommended approach

FALLBACK (if trusted publishing not available):
Generate token at pypi.org → Account settings → API tokens
Store as PYPI_API_TOKEN secret in GitHub repo
Use: twine upload dist/* (with TWINE_USERNAME=__token__)
```

---

## 12. Type Hints and py.typed

```python
# src/my_package/__init__.py
"""My Package - A production-grade Python SDK."""

from __future__ import annotations

from my_package.core.client import Client
from my_package.core.config import Config
from my_package.exceptions import (
    MyPackageError,
    AuthenticationError,
    NotFoundError,
    RateLimitError,
    ValidationError,
)

__version__ = "1.0.0"

__all__ = [
    "Client",
    "Config",
    "MyPackageError",
    "AuthenticationError",
    "NotFoundError",
    "RateLimitError",
    "ValidationError",
    "__version__",
]


# src/my_package/py.typed
# This file is EMPTY. Its presence marks the package as PEP 561 compliant.
# Type checkers (mypy, pyright) use this to know the package ships type info.


# src/my_package/core/types.py
"""Type definitions for the package."""

from __future__ import annotations

from typing import Any, Protocol, TypeAlias, TypedDict, runtime_checkable

# Type aliases
JSON: TypeAlias = dict[str, Any]
Headers: TypeAlias = dict[str, str]

# TypedDict for structured dicts
class UserData(TypedDict):
    id: str
    name: str
    email: str

class UserCreateData(TypedDict):
    name: str
    email: str
    password: str

class PaginatedResponse(TypedDict):
    items: list[UserData]
    total: int
    page: int
    per_page: int

# Protocol for structural subtyping
@runtime_checkable
class Serializable(Protocol):
    def to_dict(self) -> dict[str, Any]: ...
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Serializable: ...

# Generic types
from typing import Generic, TypeVar

T = TypeVar("T")

class Result(Generic[T]):
    """Result type for error handling without exceptions."""

    def __init__(self, value: T | None = None, error: str | None = None) -> None:
        self._value = value
        self._error = error

    @property
    def is_ok(self) -> bool:
        return self._error is None

    @property
    def value(self) -> T:
        if self._error is not None:
            raise ValueError(f"Result is an error: {self._error}")
        assert self._value is not None
        return self._value

    @property
    def error(self) -> str:
        if self._error is None:
            raise ValueError("Result is not an error")
        return self._error

    @classmethod
    def ok(cls, value: T) -> Result[T]:
        return cls(value=value)

    @classmethod
    def err(cls, error: str) -> Result[T]:
        return cls(error=error)
```

---

## 13. Pre-commit Configuration

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-toml
      - id: check-added-large-files
        args: [--maxkb=1000]
      - id: check-merge-conflict
      - id: debug-statements

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.13.0
    hooks:
      - id: mypy
        additional_dependencies:
          - pydantic>=2.0
          - httpx>=0.27
        args: [--strict, src/my_package]
```

---

## 14. CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install ruff
      - run: ruff check src/ tests/
      - run: ruff format --check src/ tests/

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -e ".[dev]"
      - run: mypy src/my_package

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.11", "3.12", "3.13"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
      - run: pip install -e ".[dev]"
      - run: pytest --cov=my_package --cov-report=xml tests/
      - uses: codecov/codecov-action@v4
        if: matrix.python-version == '3.12'
        with:
          file: coverage.xml

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install build twine
      - run: python -m build
      - run: twine check dist/*
```

---

## 15. Anti-Patterns

| Anti-Pattern | Symptom | Impact | Fix |
|-------------|---------|--------|-----|
| `setup.py` for new projects | Legacy build system, hard to maintain | Modern tools can't parse it | Use `pyproject.toml` (PEP 621) |
| Flat layout without `src/` | Tests pass locally but fail after install | Silent packaging bugs ship to users | Use `src/` layout |
| No `py.typed` marker | Type checkers can't find package types | Users get `Any` for all imports | Add empty `py.typed` file in package dir |
| `requirements.txt` for library deps | Consumers can't install deps automatically | Manual dep management for users | Declare in `[project.dependencies]` |
| Pinned versions in library | `httpx==0.27.2` | Conflicts with consumer's other packages | Use ranges: `httpx>=0.27,<1.0` |
| No `__init__.py` in packages | Module not found errors | ImportError at runtime | Every directory that should be a package needs `__init__.py` |
| `setup.py` + `setup.cfg` + `pyproject.toml` | Three config files, confusion | Inconsistent metadata, maintenance burden | Single `pyproject.toml` for everything |
| No `__all__` in `__init__.py` | Everything exported, public API unclear | Users depend on internal APIs | Define `__all__` listing public names only |
| Using `print()` for logging | No log levels, no configuration | Users can't control output verbosity | Use `logging` module with proper logger |
| No type annotations | `def process(data):` | No IDE help, no mypy checking, unclear API | Add type hints to all public functions |
| Tests import from source directly | `from my_package.core import Client` works but packaging broken | Tests pass, package broken | Use `src/` layout so tests use installed package |
| `from __future__ import annotations` missing | Python 3.9 type syntax fails on 3.9 | Runtime errors on older Python | Add to all files, or use quoted annotations |
| No changelog | Users don't know what changed | Upgrade anxiety | Maintain CHANGELOG.md (manually or auto-generated) |
| Publishing without CI checks | Broken package reaches PyPI | Users install broken code | Require CI pass + build check before publish |

---

## 16. Enforcement Checklist

- [ ] `src/` layout -- package directory under `src/`
- [ ] `pyproject.toml` as single config source (PEP 621) -- NO `setup.py` or `setup.cfg`
- [ ] `py.typed` marker file present for PEP 561 compliance
- [ ] `[build-system]` table specifies build backend (hatchling, setuptools, flit, etc.)
- [ ] Dependency ranges (not pins) in `[project.dependencies]` for libraries
- [ ] `[project.optional-dependencies]` for dev, docs, extras
- [ ] `[project.scripts]` for CLI entry points (if applicable)
- [ ] `__init__.py` with `__all__` and `__version__` in package root
- [ ] `ruff` for linting + formatting (replaces flake8, isort, black)
- [ ] `mypy` strict mode for type checking
- [ ] `pytest` with `--cov` for testing with coverage
- [ ] Coverage thresholds set (80%+ for branches, lines, functions)
- [ ] `nox` or `tox` for multi-Python-version testing
- [ ] `pre-commit` hooks configured for ruff + mypy
- [ ] Tests use installed package (src/ layout ensures this)
- [ ] GitHub Actions: CI (lint + typecheck + test on 3.10-3.13) + Publish
- [ ] Trusted Publishing configured on PyPI (no API token secrets)
- [ ] MkDocs or Sphinx for documentation with API reference auto-generation
- [ ] CHANGELOG.md maintained (manually or auto-generated)
- [ ] README with installation, quick start, API examples, and badges
- [ ] `.python-version` file for pyenv/uv compatibility
- [ ] No `print()` statements -- use `logging` module
- [ ] All public functions/methods have type annotations
- [ ] All public functions/methods have docstrings (Google style)
