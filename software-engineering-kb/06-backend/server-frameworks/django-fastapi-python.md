# Django & FastAPI — Python Server Frameworks

> **AI Plugin Directive — Django & FastAPI Production Patterns for Python**
> You are an AI coding assistant. When generating, reviewing, or refactoring Django or FastAPI
> applications, follow EVERY rule in this document. Python web frameworks span from full-stack
> (Django) to async-first (FastAPI). Choose correctly and follow each framework's conventions.
> Treat each section as non-negotiable.

**Core Rule: ALWAYS use type hints in all Python backend code. ALWAYS use async functions in FastAPI handlers. ALWAYS use Django's ORM for database operations (never raw SQL without parameterization). ALWAYS validate input with Pydantic (FastAPI) or Django Forms/Serializers. NEVER mix sync and async code without proper wrapping. NEVER store secrets in settings.py — use environment variables.**

---

## 1. Django vs FastAPI Decision

```
┌──────────────────────────────────────────────────────────────┐
│              Django vs FastAPI                                │
│                                                               │
│  Django:                                                     │
│  ├── "Batteries included" — ORM, admin, auth, forms, CLI   │
│  ├── Mature ecosystem (15+ years)                           │
│  ├── Django REST Framework for APIs                         │
│  ├── Django Admin — instant admin panel                     │
│  ├── Synchronous by default (async support since 4.1)       │
│  ├── Best for: content sites, admin panels, complex CRUD    │
│  └── Companies: Instagram, Spotify, Pinterest               │
│                                                               │
│  FastAPI:                                                    │
│  ├── Modern, async-first                                    │
│  ├── Auto-generated OpenAPI docs (best-in-class)            │
│  ├── Pydantic validation (type-safe, fast)                  │
│  ├── Depends() for dependency injection                     │
│  ├── 3-5x faster than Django for JSON APIs                  │
│  ├── Best for: APIs, microservices, ML serving              │
│  └── Companies: Microsoft, Netflix, Uber                    │
│                                                               │
│  Choose Django when:                                         │
│  ├── Need admin panel out of the box                        │
│  ├── Complex ORM with relations, migrations                 │
│  ├── Template-rendered pages (server-side HTML)              │
│  ├── Existing Django team/codebase                          │
│  └── Need built-in auth, sessions, CSRF                     │
│                                                               │
│  Choose FastAPI when:                                        │
│  ├── Building pure API (no server-rendered HTML)            │
│  ├── Need WebSocket/streaming support                       │
│  ├── Need auto-generated OpenAPI documentation              │
│  ├── Async I/O is critical (many concurrent connections)    │
│  └── Serving ML models or data pipelines                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. FastAPI — Production Setup

```python
# main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import structlog
import uvicorn

from app.api import users, products, auth
from app.core.config import settings
from app.core.database import init_db, close_db
from app.middleware.logging import LoggingMiddleware
from app.middleware.request_id import RequestIDMiddleware

# Structured logging
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer() if settings.debug else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
)

logger = structlog.get_logger()

# Lifespan — startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    logger.info("application_started", port=settings.port)
    yield
    # Shutdown
    await close_db()
    logger.info("application_stopped")

app = FastAPI(
    title="My API",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)

# --- Middleware (order: last added = first executed) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=86400,
)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RequestIDMiddleware)

# --- Exception handlers ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": "validation_error",
            "details": exc.errors(),
        },
    )

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.error_code, "message": exc.message},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error("unhandled_exception", error=str(exc), path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "message": "An unexpected error occurred"},
    )

# --- Routes ---
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])

# --- Health check ---
@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=settings.debug)
```

---

## 3. FastAPI — Routes with Pydantic Validation

```python
# api/users.py
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field, EmailStr
from uuid import UUID
from datetime import datetime

from app.core.auth import get_current_user, require_role
from app.services.user_service import UserService
from app.core.deps import get_user_service

router = APIRouter()

# --- Pydantic Schemas ---
class CreateUserRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

class UpdateUserRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    email: EmailStr | None = None

class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}

class PaginatedResponse(BaseModel):
    data: list[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

# --- Endpoints ---
@router.get("", response_model=PaginatedResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_service: UserService = Depends(get_user_service),
    current_user=Depends(get_current_user),
):
    result = await user_service.get_all(page, page_size)
    return result

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    user_service: UserService = Depends(get_user_service),
    current_user=Depends(get_current_user),
):
    return await user_service.get_by_id(user_id)

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: CreateUserRequest,
    user_service: UserService = Depends(get_user_service),
    current_user=Depends(get_current_user),
):
    return await user_service.create(request)

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    request: UpdateUserRequest,
    user_service: UserService = Depends(get_user_service),
    current_user=Depends(get_current_user),
):
    return await user_service.update(user_id, request)

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    user_service: UserService = Depends(get_user_service),
    _=Depends(require_role("admin")),
):
    await user_service.delete(user_id)
```

---

## 4. FastAPI — Service & Repository

```python
# services/user_service.py
from uuid import UUID
from passlib.context import CryptContext

from app.repositories.user_repository import UserRepository
from app.core.exceptions import NotFoundException, ConflictException

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserService:
    def __init__(self, repository: UserRepository):
        self.repo = repository

    async def get_all(self, page: int, page_size: int):
        users, total = await self.repo.find_all(page, page_size)
        total_pages = (total + page_size - 1) // page_size
        return {
            "data": users,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }

    async def get_by_id(self, user_id: UUID):
        user = await self.repo.find_by_id(user_id)
        if not user:
            raise NotFoundException(f"User {user_id} not found")
        return user

    async def create(self, request):
        if await self.repo.exists_by_email(request.email):
            raise ConflictException("Email already in use")

        password_hash = pwd_context.hash(request.password)
        return await self.repo.create(
            name=request.name,
            email=request.email,
            password_hash=password_hash,
        )

    async def update(self, user_id: UUID, request):
        user = await self.repo.find_by_id(user_id)
        if not user:
            raise NotFoundException(f"User {user_id} not found")

        update_data = request.model_dump(exclude_unset=True)

        if "email" in update_data and update_data["email"] != user.email:
            if await self.repo.exists_by_email(update_data["email"]):
                raise ConflictException("Email already in use")

        return await self.repo.update(user_id, update_data)

    async def delete(self, user_id: UUID):
        if not await self.repo.exists(user_id):
            raise NotFoundException(f"User {user_id} not found")
        await self.repo.delete(user_id)

# repositories/user_repository.py
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def find_all(self, page: int, page_size: int) -> tuple[list[User], int]:
        offset = (page - 1) * page_size

        count_stmt = select(func.count()).select_from(User)
        total = (await self.session.execute(count_stmt)).scalar() or 0

        stmt = (
            select(User)
            .order_by(User.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def find_by_id(self, user_id) -> User | None:
        return await self.session.get(User, user_id)

    async def exists_by_email(self, email: str) -> bool:
        stmt = select(func.count()).select_from(User).where(User.email == email)
        count = (await self.session.execute(stmt)).scalar()
        return count > 0

    async def exists(self, user_id) -> bool:
        user = await self.session.get(User, user_id)
        return user is not None

    async def create(self, **kwargs) -> User:
        user = User(**kwargs, role="user")
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update(self, user_id, data: dict) -> User:
        user = await self.session.get(User, user_id)
        for key, value in data.items():
            setattr(user, key, value)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def delete(self, user_id) -> None:
        user = await self.session.get(User, user_id)
        if user:
            await self.session.delete(user)
            await self.session.commit()
```

---

## 5. FastAPI — Dependency Injection

```python
# core/deps.py — Dependency providers
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.repositories.user_repository import UserRepository
from app.services.user_service import UserService

async def get_user_repository(session: AsyncSession = Depends(get_session)) -> UserRepository:
    return UserRepository(session)

async def get_user_service(repo: UserRepository = Depends(get_user_repository)) -> UserService:
    return UserService(repo)

# core/database.py — Database session management
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    pool_size=20,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    echo=settings.debug,
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_session():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise

async def init_db():
    # Run Alembic migrations or create tables
    pass

async def close_db():
    await engine.dispose()

# core/config.py — Settings with Pydantic
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "My API"
    debug: bool = False
    port: int = 8000
    database_url: str
    redis_url: str = "redis://localhost:6379"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env"}

settings = Settings()
```

---

## 6. Django — Production Setup

```python
# settings.py — Production configuration
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = os.environ.get("DJANGO_DEBUG", "false").lower() == "true"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "rest_framework",
    "corsheaders",
    "django_filters",
    "users",
    "products",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",           # CORS (first)
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",       # Static files
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "app.middleware.RequestIDMiddleware",               # Custom request ID
]

# Database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "mydb"),
        "USER": os.environ.get("DB_USER", "postgres"),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
        "CONN_MAX_AGE": 600,
        "CONN_HEALTH_CHECKS": True,
        "OPTIONS": {
            "connect_timeout": 5,
        },
    }
}

# DRF Configuration
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "EXCEPTION_HANDLER": "app.exceptions.custom_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
    },
}

# Security
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
X_FRAME_OPTIONS = "DENY"
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# CORS
CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ORIGINS", "").split(",")
CORS_ALLOW_CREDENTIALS = True

# Logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django.db.backends": {"level": "WARNING"},
    },
}
```

---

## 7. Django REST Framework — Views & Serializers

```python
# serializers.py
from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "name", "email", "role", "created_at"]
        read_only_fields = ["id", "role", "created_at"]

class CreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["name", "email", "password"]

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already in use")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

# views.py
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("-created_at")
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "email"]
    ordering_fields = ["name", "created_at"]
    filterset_fields = ["role"]

    def get_serializer_class(self):
        if self.action == "create":
            return CreateUserSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action == "destroy":
            return [permissions.IsAdminUser()]
        return super().get_permissions()

# urls.py
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r"users", UserViewSet)

urlpatterns = [
    path("api/", include(router.urls)),
    path("health/", health_check),
]
```

---

## 8. Testing

```python
# FastAPI testing with httpx
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

@pytest.mark.asyncio
async def test_list_users(client: AsyncClient, auth_headers):
    response = await client.get("/api/users", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "total" in data

@pytest.mark.asyncio
async def test_create_user_invalid_email(client: AsyncClient, auth_headers):
    response = await client.post("/api/users", json={
        "name": "Test",
        "email": "invalid",
        "password": "password123",
    }, headers=auth_headers)
    assert response.status_code == 400

# Django testing
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model

class UserTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            name="Test", email="test@test.com", password="password123"
        )
        self.client.force_authenticate(user=self.user)

    def test_list_users(self):
        response = self.client.get("/api/users/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("results", response.data)

    def test_create_user_duplicate_email(self):
        response = self.client.post("/api/users/", {
            "name": "Test2",
            "email": "test@test.com",
            "password": "password123",
        })
        self.assertEqual(response.status_code, 400)
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No type hints in Python code | Runtime type errors, poor IDE support | Type hints everywhere + mypy |
| Mixing sync/async in FastAPI | Thread deadlocks, poor performance | All-async handlers with async DB driver |
| Raw SQL without parameterization | SQL injection | Django ORM or parameterized queries |
| No Pydantic models for FastAPI input | No validation, type coercion | Pydantic BaseModel for all request bodies |
| Django `DEBUG=True` in production | Full stack traces exposed | Environment variable, `DEBUG=False` |
| No database connection pooling | Connection exhaustion under load | `CONN_MAX_AGE` (Django), `pool_size` (SQLAlchemy) |
| Business logic in views/routes | Untestable, duplicated logic | Service layer pattern |
| No Alembic/Django migrations | Manual schema changes, data loss | Alembic (FastAPI) or Django migrations |
| `requirements.txt` without pinned versions | Non-reproducible builds | Pin all versions, use `pip-compile` or `poetry.lock` |
| No structured logging | Unstructured logs, hard to parse | structlog/python-json-logger |

---

## 10. Enforcement Checklist

- [ ] Type hints on all functions, parameters, and return types
- [ ] Pydantic models for all FastAPI request/response schemas
- [ ] Django serializers for all DRF request/response
- [ ] Async database driver for FastAPI (asyncpg + SQLAlchemy async)
- [ ] Django ORM used for all database operations (no raw SQL)
- [ ] Environment variables for all secrets (never in settings.py)
- [ ] Structured logging to stdout (structlog or python-json-logger)
- [ ] Database connection pooling configured
- [ ] Alembic (FastAPI) or Django migrations for schema changes
- [ ] Global exception handler with safe error responses
- [ ] CORS configured with explicit origins
- [ ] Health check endpoint implemented
- [ ] Tests with pytest (FastAPI) or Django TestCase
- [ ] Dependency injection via FastAPI Depends() or Django DI
- [ ] Production ASGI server configured (uvicorn with workers, or gunicorn+uvicorn)
