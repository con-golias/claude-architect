# FastAPI Project Structure

> **AI Plugin Directive:** When generating a Python FastAPI project, ALWAYS use this structure. Apply router-per-feature organization with Pydantic v2 schemas, dependency injection, and async-first patterns. This guide covers FastAPI 0.100+ with Pydantic v2.

**Core Rule: Organize FastAPI projects by feature using routers. Each feature module contains its own router, schemas, service, models, and dependencies. NEVER put all endpoints in a single file.**

---

## 1. Enterprise Project Structure

### Small-to-Medium Project

```
my-api/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app creation + startup
│   ├── config.py                  # Settings via pydantic-settings
│   ├── dependencies.py            # Global dependencies (get_db, get_current_user)
│   ├── exceptions.py              # Custom exception classes
│   ├── middleware.py               # Custom middleware
│   │
│   ├── auth/                      # Feature: Authentication
│   │   ├── __init__.py
│   │   ├── router.py              # Auth endpoints
│   │   ├── schemas.py             # Pydantic request/response models
│   │   ├── service.py             # Business logic
│   │   ├── dependencies.py        # Feature-specific deps
│   │   ├── models.py              # SQLAlchemy models
│   │   ├── exceptions.py          # Feature-specific exceptions
│   │   └── constants.py           # Feature constants
│   │
│   ├── users/                     # Feature: Users
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── schemas.py
│   │   ├── service.py
│   │   ├── models.py
│   │   └── repository.py          # Database queries
│   │
│   ├── items/                     # Feature: Items
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── schemas.py
│   │   ├── service.py
│   │   ├── models.py
│   │   └── repository.py
│   │
│   ├── core/                      # Shared infrastructure
│   │   ├── __init__.py
│   │   ├── database.py            # Engine, SessionLocal, Base
│   │   ├── security.py            # JWT, hashing, OAuth2
│   │   └── logging.py             # Structured logging config
│   │
│   └── utils/                     # Pure utility functions
│       ├── __init__.py
│       ├── pagination.py
│       └── datetime.py
│
├── alembic/                       # Database migrations
│   ├── versions/
│   ├── env.py
│   └── alembic.ini
│
├── tests/
│   ├── conftest.py                # Fixtures: test client, test DB
│   ├── auth/
│   │   ├── test_router.py
│   │   └── test_service.py
│   ├── users/
│   │   ├── test_router.py
│   │   └── test_service.py
│   └── items/
│       └── test_router.py
│
├── .env
├── .env.example
├── pyproject.toml
├── Dockerfile
└── docker-compose.yml
```

### Large Enterprise Project

```
my-api/
├── src/
│   └── app/
│       ├── __init__.py
│       ├── main.py
│       ├── config.py
│       │
│       ├── api/                   # API layer only
│       │   ├── __init__.py
│       │   ├── deps.py            # Global API dependencies
│       │   └── v1/                # API versioning
│       │       ├── __init__.py
│       │       ├── router.py      # Aggregates all v1 routers
│       │       ├── auth/
│       │       │   ├── router.py
│       │       │   └── schemas.py
│       │       ├── users/
│       │       │   ├── router.py
│       │       │   └── schemas.py
│       │       └── billing/
│       │           ├── router.py
│       │           └── schemas.py
│       │
│       ├── domain/                # Business logic layer
│       │   ├── auth/
│       │   │   ├── service.py
│       │   │   ├── models.py
│       │   │   └── exceptions.py
│       │   ├── users/
│       │   │   ├── service.py
│       │   │   ├── models.py
│       │   │   └── repository.py
│       │   └── billing/
│       │       ├── service.py
│       │       ├── models.py
│       │       └── repository.py
│       │
│       ├── infrastructure/        # External integrations
│       │   ├── database/
│       │   │   ├── session.py
│       │   │   └── base.py
│       │   ├── cache/
│       │   │   └── redis.py
│       │   ├── messaging/
│       │   │   └── rabbitmq.py
│       │   └── storage/
│       │       └── s3.py
│       │
│       └── core/                  # Cross-cutting concerns
│           ├── config.py
│           ├── security.py
│           ├── middleware.py
│           └── logging.py
│
├── alembic/
├── tests/
├── scripts/
├── pyproject.toml
└── Dockerfile
```

---

## 2. File Roles and Conventions

| File | Role | Rules |
|------|------|-------|
| `main.py` | App factory, lifespan, middleware registration | NEVER put endpoints here |
| `router.py` | Route definitions, HTTP handling only | NEVER put business logic in routers |
| `schemas.py` | Pydantic v2 request/response models | One file per feature, suffix with `Create`, `Update`, `Response` |
| `service.py` | Business logic, orchestration | Receives dependencies via __init__ or function params |
| `repository.py` | Database queries, raw SQL | Returns models, NEVER returns schemas |
| `models.py` | SQLAlchemy ORM models | One file per feature, use mapped_column() |
| `dependencies.py` | FastAPI Depends() callables | Use for auth, DB sessions, pagination |
| `config.py` | pydantic-settings BaseSettings | Load from .env, validate at startup |
| `exceptions.py` | Custom exception classes | Inherit from base HTTPException or domain exception |
| `constants.py` | Enums, magic strings, limits | NEVER hardcode values in routers/services |

---

## 3. Application Factory Pattern

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.auth.router import router as auth_router
from app.users.router import router as users_router
from app.items.router import router as items_router
from app.core.database import engine
from app.core.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    setup_logging()
    # Startup: create tables, warm caches, connect to services
    yield
    # Shutdown: close connections, flush buffers
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )

    # Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
    app.include_router(items_router, prefix="/api/v1/items", tags=["items"])

    return app


app = create_app()
```

---

## 4. Configuration with pydantic-settings

```python
# app/config.py
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # Application
    PROJECT_NAME: str = "My API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"  # development | staging | production
    DEBUG: bool = False

    # Database
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 10

    # Auth
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # External Services
    REDIS_URL: str = "redis://localhost:6379/0"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v


settings = Settings()
```

---

## 5. Router Pattern

```python
# app/users/router.py
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user
from app.users import schemas, service
from app.users.models import User

router = APIRouter()


@router.get("/", response_model=schemas.UserListResponse)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List users with pagination."""
    users, total = await service.get_users(db, skip=skip, limit=limit)
    return schemas.UserListResponse(
        items=[schemas.UserResponse.model_validate(u) for u in users],
        total=total,
    )


@router.get("/{user_id}", response_model=schemas.UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user by ID."""
    user = await service.get_user_by_id(db, user_id)
    return schemas.UserResponse.model_validate(user)


@router.post(
    "/",
    response_model=schemas.UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_user(
    payload: schemas.UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new user."""
    user = await service.create_user(db, payload)
    return schemas.UserResponse.model_validate(user)


@router.patch("/{user_id}", response_model=schemas.UserResponse)
async def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Partially update a user."""
    user = await service.update_user(db, user_id, payload)
    return schemas.UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a user."""
    await service.delete_user(db, user_id)
```

---

## 6. Pydantic v2 Schemas

```python
# app/users/schemas.py
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --- Base schemas ---

class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=100)
    is_active: bool = True


# --- Request schemas ---

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)


class UserUpdate(BaseModel):
    """All fields optional for PATCH."""
    email: EmailStr | None = None
    full_name: str | None = Field(None, min_length=1, max_length=100)
    is_active: bool | None = None


# --- Response schemas ---

class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int


# --- Naming Convention ---
# {Entity}Create     → POST body
# {Entity}Update     → PATCH body
# {Entity}Response   → GET response
# {Entity}InDB       → Internal (includes hashed_password)
# {Entity}Filter     → Query parameters for filtering
```

---

## 7. Service Layer

```python
# app/users/service.py
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.users import repository, schemas
from app.users.models import User
from app.core.security import hash_password


async def get_users(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[User], int]:
    """Get paginated list of users."""
    users = await repository.get_multi(db, skip=skip, limit=limit)
    total = await repository.count(db)
    return users, total


async def get_user_by_id(db: AsyncSession, user_id: int) -> User:
    """Get user by ID or raise 404."""
    user = await repository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found",
        )
    return user


async def create_user(
    db: AsyncSession,
    payload: schemas.UserCreate,
) -> User:
    """Create user with hashed password."""
    existing = await repository.get_by_email(db, payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    hashed = hash_password(payload.password)
    user = await repository.create(
        db,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hashed,
    )
    return user


async def update_user(
    db: AsyncSession,
    user_id: int,
    payload: schemas.UserUpdate,
) -> User:
    """Update user fields."""
    user = await get_user_by_id(db, user_id)
    update_data = payload.model_dump(exclude_unset=True)
    user = await repository.update(db, user, update_data)
    return user


async def delete_user(db: AsyncSession, user_id: int) -> None:
    """Delete user by ID."""
    user = await get_user_by_id(db, user_id)
    await repository.delete(db, user)
```

---

## 8. Repository Pattern

```python
# app/users/repository.py
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.users.models import User


async def get_by_id(db: AsyncSession, user_id: int) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_multi(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 20,
) -> list[User]:
    result = await db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def count(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(User.id)))
    return result.scalar_one()


async def create(db: AsyncSession, **kwargs) -> User:
    user = User(**kwargs)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update(
    db: AsyncSession,
    user: User,
    update_data: dict,
) -> User:
    for field, value in update_data.items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


async def delete(db: AsyncSession, user: User) -> None:
    await db.delete(user)
    await db.commit()
```

---

## 9. SQLAlchemy Models (Async)

```python
# app/core/database.py
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    echo=settings.DEBUG,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    """Dependency: yields async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
```

```python
# app/users/models.py
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

---

## 10. Dependency Injection

```python
# app/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.users import repository
from app.users.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate current user from JWT token."""
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = await repository.get_by_id(db, int(payload.sub))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    return user


async def get_current_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require superuser role."""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return current_user
```

### Dependency Composition Flow

```
Request → OAuth2PasswordBearer(token)
              ↓
         get_db() → AsyncSession
              ↓
         get_current_user(token, db) → User
              ↓
         get_current_superuser(user) → User (verified admin)
```

---

## 11. Custom Exception Handling

```python
# app/exceptions.py
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class AppException(Exception):
    """Base application exception."""
    def __init__(
        self,
        status_code: int = 500,
        detail: str = "Internal server error",
        headers: dict | None = None,
    ):
        self.status_code = status_code
        self.detail = detail
        self.headers = headers


class NotFound(AppException):
    def __init__(self, entity: str, entity_id: int | str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{entity} with id {entity_id} not found",
        )


class AlreadyExists(AppException):
    def __init__(self, entity: str, field: str, value: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{entity} with {field}={value} already exists",
        )


class PermissionDenied(AppException):
    def __init__(self, detail: str = "Permission denied"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(
        request: Request, exc: AppException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=exc.headers,
        )
```

---

## 12. Middleware

```python
# app/middleware.py
import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import structlog

logger = structlog.get_logger()


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        logger.info(
            "request_completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration * 1000, 2),
            request_id=getattr(request.state, "request_id", None),
        )
        return response
```

---

## 13. Testing Structure

```python
# tests/conftest.py
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.main import create_app
from app.core.database import Base, get_db
from app.config import settings

TEST_DATABASE_URL = settings.DATABASE_URL + "_test"

engine_test = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    engine_test, class_=AsyncSession, expire_on_commit=False
)


@pytest_asyncio.fixture
async def db_session():
    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with TestSessionLocal() as session:
        yield session
    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    app = create_app()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# tests/users/test_router.py
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_user(client: AsyncClient):
    response = await client.post(
        "/api/v1/users/",
        json={
            "email": "test@example.com",
            "full_name": "Test User",
            "password": "securepassword123",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "password" not in data
    assert "hashed_password" not in data
```

---

## 14. API Versioning Strategies

### URL Prefix Versioning (Recommended)

```python
# app/api/v1/router.py
from fastapi import APIRouter
from app.api.v1.auth.router import router as auth_router
from app.api.v1.users.router import router as users_router

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(auth_router, prefix="/auth", tags=["auth"])
v1_router.include_router(users_router, prefix="/users", tags=["users"])

# app/api/v2/router.py
from fastapi import APIRouter
from app.api.v2.users.router import router as users_router

v2_router = APIRouter(prefix="/api/v2")
v2_router.include_router(users_router, prefix="/users", tags=["users-v2"])

# main.py
app.include_router(v1_router)
app.include_router(v2_router)
```

### Versioning Decision

| Strategy | When to Use |
|----------|------------|
| URL prefix `/api/v1/` | Default choice. Clear, cacheable, easy to route |
| Header `Accept: application/vnd.api+json;version=2` | When URL must stay stable, media type negotiation |
| Query param `?version=2` | Quick prototyping only, NEVER in production |

---

## 15. Background Tasks and Workers

```python
# app/users/router.py
from fastapi import BackgroundTasks

@router.post("/", status_code=201)
async def create_user(
    payload: schemas.UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    user = await service.create_user(db, payload)
    background_tasks.add_task(send_welcome_email, user.email, user.full_name)
    return schemas.UserResponse.model_validate(user)


# For heavy workloads, use Celery/ARQ/SAQ instead:
# app/workers/
# ├── __init__.py
# ├── celery_app.py        # Celery configuration
# ├── tasks/
# │   ├── email_tasks.py   # send_welcome_email.delay()
# │   ├── report_tasks.py  # generate_monthly_report.delay()
# │   └── cleanup_tasks.py
# └── schedules.py         # Celery Beat periodic tasks
```

---

## 16. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Fat routers | Business logic in route handlers | Extract to service.py, router only does HTTP |
| No schemas | Returning raw dicts or ORM objects | ALWAYS use Pydantic response models |
| Sync in async | Using `time.sleep()` or sync DB drivers | Use `asyncio.sleep()`, async DB drivers (asyncpg) |
| Global DB session | Module-level `db = Session()` | Use `Depends(get_db)` for request-scoped sessions |
| No validation | Trusting raw request data | Pydantic validates automatically, add Field constraints |
| Circular imports | Feature A imports Feature B imports Feature A | Use dependency injection, move shared code to core/ |
| One giant main.py | All routes, models, schemas in single file | Split by feature from day one |
| No error standardization | Each endpoint returns different error formats | Use custom exception handler with consistent JSON |
| Hardcoded config | `SECRET_KEY = "abc123"` in code | Use pydantic-settings, load from environment |
| Missing type hints | `def get_user(id):` | ALWAYS type hint: `def get_user(user_id: int) -> User:` |

---

## 17. CLI and Project Setup

```bash
# Create project structure
mkdir -p app/{auth,users,items,core,utils}
touch app/{__init__,main,config,dependencies,exceptions,middleware}.py
touch app/auth/{__init__,router,schemas,service,models,dependencies}.py
touch app/users/{__init__,router,schemas,service,models,repository}.py

# Initialize with Poetry
poetry init
poetry add fastapi uvicorn[standard] sqlalchemy[asyncio] asyncpg
poetry add pydantic-settings python-jose[cryptography] passlib[bcrypt]
poetry add alembic httpx structlog

# Dev dependencies
poetry add --group dev pytest pytest-asyncio pytest-cov httpx ruff mypy

# Initialize Alembic
alembic init alembic

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run with multiple workers (production)
uvicorn app.main:app --workers 4 --host 0.0.0.0 --port 8000
# OR
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### pyproject.toml Essentials

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.ruff]
target-version = "py312"
line-length = 88

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "SIM", "TCH"]

[tool.mypy]
python_version = "3.12"
strict = true
plugins = ["pydantic.mypy"]
```

---

## 18. Enforcement Checklist

- [ ] Every feature has its own directory with router.py, schemas.py, service.py
- [ ] main.py contains ONLY app factory — no endpoint definitions
- [ ] ALL request/response data uses Pydantic v2 models with `from_attributes=True`
- [ ] Database sessions use `Depends(get_db)` — NEVER global sessions
- [ ] Configuration loaded via pydantic-settings from environment variables
- [ ] Business logic lives in service.py — routers handle HTTP only
- [ ] Database queries live in repository.py — services NEVER import sqlalchemy
- [ ] All endpoints have explicit `response_model` and `status_code`
- [ ] Custom exceptions use centralized handler — no ad-hoc JSONResponse in routes
- [ ] Alembic manages ALL schema changes — NEVER use `Base.metadata.create_all()` in production
- [ ] Tests use dependency overrides — NEVER test against production database
- [ ] Type hints on ALL function signatures — mypy strict mode passes
- [ ] Async used consistently — NO mixing sync/async database drivers
- [ ] API versioning via URL prefix when multiple versions needed
