# Python Coding Standards

| Property     | Value                                                                |
|-------------|----------------------------------------------------------------------|
| Domain      | Code Quality > Standards                                             |
| Importance  | Critical                                                             |
| Languages   | Python 3.10–3.12+                                                    |
| Cross-ref   | [Language-Specific Linters](../linting-formatting/language-specific-linters.md), [Type Checking](../static-analysis/type-checking.md) |

---

## Core Concepts

### PEP 8 — The Parts That Matter

```python
# ❌ BAD: Inconsistent style, compressed logic
def processData(input,flag=True):
    x=input.strip()
    if flag==True: return x.upper()
    else: return x.lower()

# ✅ GOOD: PEP 8 compliant
def process_data(text: str, *, uppercase: bool = True) -> str:
    cleaned = text.strip()
    if uppercase:
        return cleaned.upper()
    return cleaned.lower()
```

**Key PEP 8 rules that impact readability most:**
- `snake_case` for functions/variables, `PascalCase` for classes, `UPPER_SNAKE` for constants
- 4-space indentation (never tabs)
- 88-char line length (Black/Ruff default, preferred over PEP 8's 79)
- Keyword-only args after `*` for boolean/config parameters
- Avoid comparing to `True`/`False`/`None` with `==`; use `is` or truthiness

### Type Hints — Modern Syntax

```python
# ❌ BAD: Legacy typing (pre-3.10)
from typing import Optional, Union, List, Dict, Tuple

def fetch_users(
    ids: List[int],
    filters: Optional[Dict[str, Union[str, int]]] = None,
) -> Tuple[List[User], int]:
    ...

# ✅ GOOD: Modern syntax (3.10+)
def fetch_users(
    ids: list[int],
    filters: dict[str, str | int] | None = None,
) -> tuple[list[User], int]:
    ...
```

**Advanced type hint patterns:**

```python
from typing import TypeVar, TypeGuard, ParamSpec, overload
from collections.abc import Callable

T = TypeVar("T")
P = ParamSpec("P")

# TypeGuard narrows types in conditional checks
def is_admin(user: User) -> TypeGuard[AdminUser]:
    return user.role == "admin"

if is_admin(user):
    user.admin_panel()  # Type checker knows user is AdminUser

# ParamSpec preserves function signatures in decorators
def retry(fn: Callable[P, T]) -> Callable[P, T]:
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        for attempt in range(3):
            try:
                return fn(*args, **kwargs)
            except Exception:
                if attempt == 2:
                    raise
    return wrapper

# @overload for input-dependent return types
@overload
def parse(raw: str) -> dict[str, Any]: ...
@overload
def parse(raw: bytes) -> list[Any]: ...
def parse(raw: str | bytes) -> dict[str, Any] | list[Any]:
    if isinstance(raw, str):
        return json.loads(raw)
    return msgpack.unpackb(raw)
```

### Modern Python 3.10–3.12 Features

```python
# Pattern matching (3.10+) — replace complex if/elif chains
# ❌ BAD
def handle_response(resp):
    if resp["status"] == 200:
        return resp["data"]
    elif resp["status"] == 404:
        raise NotFoundError()
    elif resp["status"] >= 500:
        raise ServerError(resp.get("message", ""))

# ✅ GOOD: Structural pattern matching
def handle_response(resp: dict) -> Any:
    match resp:
        case {"status": 200, "data": data}:
            return data
        case {"status": 404}:
            raise NotFoundError()
        case {"status": status, "message": msg} if status >= 500:
            raise ServerError(msg)
        case _:
            raise UnexpectedResponse(resp)

# StrEnum (3.11+)
from enum import StrEnum

class Color(StrEnum):
    RED = "red"      # Is a string — no .value needed
    GREEN = "green"

print(f"color: {Color.RED}")  # "color: red" — not "Color.RED"

# Dataclasses with slots + frozen (3.10+)
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class Point:
    x: float
    y: float
    # frozen: immutable after creation
    # slots: 20-30% less memory, faster attribute access

# Exception groups (3.11+)
async def fetch_all(urls: list[str]) -> list[Response]:
    results = await asyncio.gather(*map(fetch, urls), return_exceptions=True)
    errors = [r for r in results if isinstance(r, Exception)]
    if errors:
        raise ExceptionGroup("fetch failures", errors)
    return results
```

### Ruff — The Universal Linter + Formatter

```toml
# pyproject.toml — Ruff replaces Black + isort + Flake8 + pyupgrade
[tool.ruff]
target-version = "py312"
line-length = 88

[tool.ruff.lint]
select = [
    "E", "W",   # pycodestyle       "F",    # pyflakes
    "I",         # isort             "N",    # pep8-naming
    "UP",        # pyupgrade         "B",    # flake8-bugbear
    "SIM",       # flake8-simplify   "RUF",  # Ruff-specific
    "PTH",       # pathlib           "ERA",  # dead code
]
```

### Function Design

```python
# ❌ BAD: Multiple return types, deep nesting
def process(data, mode="default"):
    if data is not None:
        if mode == "strict":
            if validate(data):
                return transform(data)
            else:
                return None
        else:
            return transform(data)
    return None

# ✅ GOOD: Early returns, single responsibility, consistent return type
def process(data: InputData | None, *, strict: bool = False) -> OutputData | None:
    if data is None:
        return None
    if strict and not validate(data):
        return None
    return transform(data)
```

**Generators vs lists — yield when you can, collect when you must:**

```python
# ❌ BAD: Builds entire list in memory
def get_even_squares(numbers: list[int]) -> list[int]:
    result = []
    for n in numbers:
        if n % 2 == 0:
            result.append(n ** 2)
    return result

# ✅ GOOD: Generator for lazy evaluation
def even_squares(numbers: Iterable[int]) -> Iterator[int]:
    return (n ** 2 for n in numbers if n % 2 == 0)

# Collect only when the caller needs a list
squares_list = list(even_squares(range(1_000_000)))
```

### Class Design — Dataclasses, Protocol, Pydantic

```python
# ❌ BAD: Manual __init__, __repr__, __eq__
class User:
    def __init__(self, name: str, email: str, age: int):
        self.name = name; self.email = email; self.age = age

# ✅ GOOD: Dataclass for internal data containers
@dataclass(frozen=True, slots=True)
class User:
    name: str
    email: str
    age: int

# ✅ GOOD: Pydantic for validated external data (API input, config)
class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    age: int = Field(ge=0, le=150)

# ✅ GOOD: Protocol for structural typing (duck typing + type safety)
class Serializable(Protocol):
    def to_dict(self) -> dict[str, Any]: ...

def save(obj: Serializable) -> None:  # Any object with to_dict() works
    db.insert(obj.to_dict())
```

### Error Handling — LBYL vs EAFP

```python
# LBYL: check first (when check is cheap + failure is common)
if key in mapping: value = mapping[key]

# EAFP: try/except (Pythonic default — failure is rare)
try: value = mapping[key]
except KeyError: value = default

# ❌ BAD: Bare except catches SystemExit/KeyboardInterrupt
try: result = do_work()
except: log("failed")

# ❌ BAD: Catching Exception when you mean a specific error
try: data = json.loads(raw)
except Exception: return None

# ✅ GOOD: Specific exceptions + exception chaining with `from`
try:
    data = json.loads(raw)
except json.JSONDecodeError as e:
    raise ConfigError(f"Invalid JSON: {raw[:50]}") from e

# ✅ GOOD: Custom exception hierarchy
class AppError(Exception): """Base for all application errors."""
class NotFoundError(AppError):
    def __init__(self, entity: str, id: str) -> None:
        super().__init__(f"{entity} with id={id} not found")
        self.entity = entity
        self.id = id
```

### Context Managers

```python
# ❌ BAD: Manual resource cleanup
f = open("data.txt")
try: data = f.read()
finally: f.close()

# ✅ GOOD: Context manager
with open("data.txt") as f:
    data = f.read()

# ✅ GOOD: Custom context manager with contextlib
@contextmanager
def timer(label: str) -> Iterator[None]:
    start = time.perf_counter()
    try:
        yield
    finally:
        logger.info(f"{label}: {time.perf_counter() - start:.3f}s")
```

### Pathlib Over os.path

```python
# ❌ BAD: os.path string manipulation
import os
path = os.path.join(base_dir, "data", "output.csv")
if os.path.exists(path):
    with open(path) as f:
        content = f.read()
ext = os.path.splitext(path)[1]

# ✅ GOOD: pathlib — object-oriented, cross-platform
from pathlib import Path

path = Path(base_dir) / "data" / "output.csv"
if path.exists():
    content = path.read_text()
ext = path.suffix
stem = path.stem          # "output"
parent = path.parent      # Path(".../data")
path.mkdir(parents=True, exist_ok=True)
```

### Comprehensions — When to Use, When to Avoid

```python
# ✅ GOOD: Simple transformations — one filter, one transform
names = [user.name for user in users if user.active]
lookup = {u.id: u for u in users}
unique_emails = {u.email.lower() for u in users}

# ❌ BAD: Nested loops + multiple conditions in comprehension — unreadable
result = [transform(clean(item)) for group in data for item in group.items
          if item.status == "active" and item.score > threshold]

# ✅ GOOD: Extract to function when comprehension exceeds one line of logic
def process_active_items(data: list[Group]) -> list[Result]:
    results = []
    for group in data:
        for item in group.items:
            if not _is_eligible(item): continue
            results.append(_process_item(item))
    return results
```

### Packaging and Dependency Management

```toml
# pyproject.toml — single source of truth (PEP 621)
[project]
name = "myapp"
version = "1.0.0"
requires-python = ">=3.12"
dependencies = ["fastapi>=0.110", "pydantic>=2.6", "sqlalchemy>=2.0"]

[project.optional-dependencies]
dev = ["pytest>=8.0", "ruff>=0.4", "mypy>=1.10"]

[tool.mypy]
strict = true
plugins = ["pydantic.mypy"]
# Use uv for fast dependency resolution: uv lock / uv sync
```

### Async Python Patterns

```python
# ❌ BAD: Blocking call inside async function
async def get_data() -> dict:
    response = requests.get(url)  # Blocks the event loop!
    return response.json()

# ✅ GOOD: Use httpx async client
async def get_data() -> dict:
    async with httpx.AsyncClient() as client:
        return (await client.get(url)).json()

# ✅ GOOD: Concurrent async operations
async def fetch_all_users(ids: list[int]) -> list[User]:
    async with httpx.AsyncClient() as client:
        responses = await asyncio.gather(*(client.get(f"/users/{id}") for id in ids))
        return [User(**r.json()) for r in responses]

# ✅ GOOD: Async context manager for resource lifecycle
@asynccontextmanager
async def db_session():
    session = await create_session()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
```

---

## Best Practices

| #  | Practice                                                                 |
|----|--------------------------------------------------------------------------|
| 1  | Use Ruff as the single tool for linting + formatting (replace Black/isort/Flake8) |
| 2  | Add type hints to all public function signatures; run `mypy --strict`    |
| 3  | Use `X \| Y` union syntax (3.10+) and lowercase generics (`list`, `dict`) |
| 4  | Prefer `@dataclass(frozen=True, slots=True)` for internal data; Pydantic for external |
| 5  | Use `Protocol` for structural typing instead of ABC inheritance          |
| 6  | Catch specific exceptions; always chain with `from` for wrapped errors   |
| 7  | Use `pathlib.Path` for all file system operations                        |
| 8  | Use keyword-only arguments (`*`) for boolean/config parameters           |
| 9  | Prefer generators for large sequences; collect to list only when needed  |
| 10 | Use `pyproject.toml` as the single config file; manage deps with `uv`   |

---

## Anti-Patterns

| #  | Anti-Pattern                     | Problem                                       | Fix                                      |
|----|----------------------------------|-----------------------------------------------|------------------------------------------|
| 1  | Mutable default arguments        | `def f(x=[])` — shared list across calls      | Use `None` sentinel: `x: list \| None = None` |
| 2  | Bare `except:`                   | Catches `SystemExit`, `KeyboardInterrupt`      | Catch `Exception` or specific types      |
| 3  | `import *`                       | Namespace pollution, shadowing                 | Import specific names                    |
| 4  | `isinstance` chains              | Violates Open-Closed principle                 | Use pattern matching or polymorphism     |
| 5  | String concatenation in loops    | O(n^2) string building                         | Use `"".join()` or f-string             |
| 6  | Nested `try/except` blocks       | Hard to reason about error flow                | Flatten with early returns               |
| 7  | `os.path` + manual string ops    | Platform-dependent, error-prone                | Use `pathlib.Path`                       |
| 8  | `requests` in async code         | Blocks the event loop                          | Use `httpx` with `async/await`           |

---

## Enforcement Checklist

- [ ] `ruff check` and `ruff format` pass in CI with zero warnings
- [ ] `mypy --strict` passes (or `pyright` in strict mode)
- [ ] Target Python version set in `pyproject.toml` and `ruff.toml`
- [ ] All public functions have type annotations and docstrings
- [ ] No `typing.Optional`/`Union`/`List` — use modern `X | Y` syntax
- [ ] Pydantic v2 for all external input validation
- [ ] `uv.lock` committed for reproducible builds
- [ ] `pathlib` used for all file operations (Ruff rule `PTH` enforces this)
- [ ] No bare `except:` or `except Exception:` without re-raise
- [ ] Pre-commit hooks run `ruff check --fix` and `ruff format` on save
