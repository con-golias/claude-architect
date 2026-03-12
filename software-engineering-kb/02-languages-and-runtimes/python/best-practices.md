# Python: Best Practices

> **Domain:** Languages > Python
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03

## Modern Python Style (3.10+)

### F-strings (Always Prefer)

```python
# ❌ Old style
"Hello, %s! You are %d years old." % (name, age)
"Hello, {}! You are {} years old.".format(name, age)

# ✅ F-strings (fastest, most readable)
f"Hello, {name}! You are {age} years old."
f"Result: {value:.2f}"          # Formatting
f"Debug: {expr=}"               # Self-documenting (3.8+)
f"{'yes' if flag else 'no'}"    # Expressions
```

### Pattern Matching (3.10+)

```python
# Structural pattern matching
match command:
    case {"action": "move", "direction": str(dir), "distance": int(dist)}:
        move(dir, dist)
    case {"action": "attack", "target": str(target)}:
        attack(target)
    case {"action": "quit"}:
        quit_game()
    case _:
        print("Unknown command")

# Type-based matching
match event:
    case Click(x=x, y=y) if x > 100:
        handle_right_click(x, y)
    case KeyPress(key="q"):
        quit()
    case Scroll(direction="up", amount=n):
        scroll_up(n)
```

### Walrus Operator (:=)

```python
# Assign and use in same expression
if (n := len(items)) > 10:
    print(f"Too many items: {n}")

# In comprehensions
results = [y for x in data if (y := expensive(x)) is not None]

# In while loops
while chunk := file.read(8192):
    process(chunk)
```

## Type Hints Best Practices

### Modern Syntax (3.10+)

```python
# ✅ Modern (3.10+): use | instead of Union, lowercase generics
def process(data: list[int] | None = None) -> dict[str, int]:
    ...

# ❌ Old style (pre-3.10)
from typing import List, Dict, Optional, Union
def process(data: Optional[List[int]] = None) -> Dict[str, int]:
    ...

# Python 3.12+: Type parameter syntax
type Vector[T] = list[T]
type Point = tuple[float, float]

def first[T](items: list[T]) -> T:
    return items[0]

class Stack[T]:
    def __init__(self) -> None:
        self._items: list[T] = []
    def push(self, item: T) -> None:
        self._items.append(item)
    def pop(self) -> T:
        return self._items.pop()
```

### Protocol (Structural Subtyping)

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class Readable(Protocol):
    def read(self, n: int = -1) -> str: ...

class FileReader:
    def read(self, n: int = -1) -> str:
        return "data"

# FileReader satisfies Readable without inheriting from it
def process(source: Readable) -> str:
    return source.read()

process(FileReader())  # OK — duck typing with type safety
```

## Data Classes & Alternatives

### Comparison

```python
# 1. @dataclass — standard library (3.7+)
from dataclasses import dataclass, field

@dataclass(frozen=True, slots=True)  # frozen=immutable, slots=memory efficient
class Point:
    x: float
    y: float
    label: str = "origin"
    tags: list[str] = field(default_factory=list)

# 2. NamedTuple — immutable, lightweight
from typing import NamedTuple

class Point(NamedTuple):
    x: float
    y: float
    label: str = "origin"

# 3. Pydantic — validation + serialization
from pydantic import BaseModel, Field, EmailStr

class User(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    age: int = Field(ge=0, le=150)

user = User(name="Alice", email="alice@example.com", age=30)
user.model_dump()        # → dict
user.model_dump_json()   # → JSON string
User.model_validate({"name": "Bob", "email": "bob@example.com", "age": 25})

# 4. attrs — most flexible
import attrs

@attrs.define
class Point:
    x: float = attrs.field(validator=attrs.validators.gt(0))
    y: float
```

| Feature | dataclass | NamedTuple | Pydantic v2 | attrs |
|---------|-----------|-----------|-------------|-------|
| Validation | No | No | Yes (automatic) | Yes (validators) |
| Serialization | No | No | Yes (JSON, dict) | No (cattrs) |
| Immutability | frozen=True | Always | frozen=True | frozen=True |
| Slots | slots=True | Always | Yes | Yes |
| Speed | Fast | Fastest | Fast (Rust core) | Fast |
| JSON Schema | No | No | Yes (automatic) | No |

## Error Handling

```python
# Custom exception hierarchy
class AppError(Exception):
    """Base application error."""
    def __init__(self, message: str, code: str):
        self.message = message
        self.code = code
        super().__init__(message)

class NotFoundError(AppError):
    def __init__(self, resource: str, id: str):
        super().__init__(f"{resource} {id} not found", "NOT_FOUND")

class ValidationError(AppError):
    def __init__(self, errors: dict[str, list[str]]):
        self.errors = errors
        super().__init__("Validation failed", "VALIDATION_ERROR")

# Exception Groups (3.11+) — multiple simultaneous errors
try:
    async with asyncio.TaskGroup() as tg:
        tg.create_task(task1())
        tg.create_task(task2())
except* ValueError as eg:
    for exc in eg.exceptions:
        handle_value_error(exc)
except* TypeError as eg:
    for exc in eg.exceptions:
        handle_type_error(exc)

# contextlib.suppress — cleaner than try/except/pass
from contextlib import suppress
with suppress(FileNotFoundError):
    os.remove('temp.txt')
```

## Async Patterns

### Structured Concurrency with TaskGroup (3.11+)

```python
import asyncio

async def fetch_all(urls: list[str]) -> list[dict]:
    results: list[dict] = []

    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch_url(url)) for url in urls]

    return [task.result() for task in tasks]
    # If any task raises, ALL are cancelled — structured concurrency!

# Async context managers
from contextlib import asynccontextmanager

@asynccontextmanager
async def get_db_connection():
    conn = await create_connection()
    try:
        yield conn
    finally:
        await conn.close()

async def get_user(id: int) -> User:
    async with get_db_connection() as conn:
        return await conn.fetchone("SELECT * FROM users WHERE id=$1", id)

# Async generators
async def stream_events(url: str):
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            async for line in resp.content:
                yield json.loads(line)

async for event in stream_events("/api/stream"):
    process(event)
```

## Project Structure

### Modern Python Project (pyproject.toml)

```
my-project/
├── pyproject.toml              # Project metadata + build config (PEP 621)
├── src/
│   └── my_package/
│       ├── __init__.py
│       ├── py.typed             # PEP 561 marker (typed package)
│       ├── models/
│       │   ├── __init__.py
│       │   └── user.py
│       ├── services/
│       │   ├── __init__.py
│       │   └── user_service.py
│       ├── api/
│       │   ├── __init__.py
│       │   └── routes.py
│       └── core/
│           ├── __init__.py
│           ├── config.py
│           └── database.py
├── tests/
│   ├── conftest.py             # Shared fixtures
│   ├── unit/
│   │   └── test_user_service.py
│   └── integration/
│       └── test_api.py
├── .python-version             # Python version (for uv/pyenv)
└── uv.lock                    # Lock file
```

### pyproject.toml (Modern Standard)

```toml
[project]
name = "my-package"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.110",
    "sqlmodel>=0.0.16",
    "pydantic>=2.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "ruff>=0.3",
    "mypy>=1.8",
]

[tool.ruff]
target-version = "py312"
line-length = 88

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "SIM", "RUF"]

[tool.mypy]
strict = true
python_version = "3.12"

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
```

## Testing with pytest

```python
import pytest
from unittest.mock import AsyncMock, patch

# Fixtures for dependency injection
@pytest.fixture
def db_session():
    session = create_test_session()
    yield session
    session.rollback()
    session.close()

@pytest.fixture
def user_service(db_session):
    return UserService(db=db_session)

# Parametrized tests — test multiple inputs
@pytest.mark.parametrize("email,valid", [
    ("user@example.com", True),
    ("user@", False),
    ("", False),
    ("a@b.co", True),
])
def test_email_validation(email: str, valid: bool):
    assert is_valid_email(email) == valid

# Async testing
@pytest.mark.asyncio
async def test_fetch_user(user_service: UserService):
    user = await user_service.get_by_id(1)
    assert user.name == "Alice"

# Mocking
async def test_send_notification(user_service: UserService):
    with patch.object(user_service, 'email_client', new_callable=AsyncMock) as mock:
        await user_service.notify(user_id=1, message="Hello")
        mock.send.assert_called_once()

# Hypothesis — property-based testing
from hypothesis import given
from hypothesis import strategies as st

@given(st.lists(st.integers()))
def test_sort_is_idempotent(lst: list[int]):
    assert sorted(sorted(lst)) == sorted(lst)
```

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Better Alternative |
|-------------|-------------|-------------------|
| Mutable default arguments | `def f(x=[])` — shared across calls | `def f(x=None): x = x or []` |
| Bare `except:` | Catches SystemExit, KeyboardInterrupt | `except Exception:` |
| `import *` | Namespace pollution, unclear origins | Explicit imports |
| Global variables | Hard to test, race conditions | Dependency injection, config objects |
| Nested comprehensions (3+ levels) | Unreadable | Regular for loops |
| `type()` for type checking | Doesn't handle inheritance | `isinstance()` |
| String concatenation in loops | O(n²) for strings | `"".join(parts)` or f-strings |
| Ignoring return values | Silent failures | Check returns, use type hints |

## Sources

- [PEP 8 Style Guide](https://peps.python.org/pep-0008/)
- [Real Python](https://realpython.com) — Tutorials
- [Python docs](https://docs.python.org/3/)
- [mypy docs](https://mypy.readthedocs.io)
- [pytest docs](https://docs.pytest.org)
- [ruff docs](https://docs.astral.sh/ruff/)
