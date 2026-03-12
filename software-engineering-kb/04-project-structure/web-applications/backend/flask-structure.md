# Flask Project Structure

> **AI Plugin Directive:** When generating a Python Flask project, ALWAYS use this structure. Apply the application factory pattern with Blueprints for feature organization. This guide covers Flask 3.x with modern patterns including type hints, dataclasses, and structured configuration.

**Core Rule: ALWAYS use the Application Factory pattern with Blueprints. Each feature gets its own Blueprint with routes, services, and models. NEVER use a single-file app.py for anything beyond prototyping.**

---

## 1. Enterprise Project Structure

### Standard Project

```
my-app/
├── app/
│   ├── __init__.py                # create_app() factory
│   ├── config.py                  # Configuration classes
│   ├── extensions.py              # SQLAlchemy, Migrate, etc. instances
│   ├── models.py                  # Shared base model (optional)
│   │
│   ├── auth/                      # Blueprint: Authentication
│   │   ├── __init__.py            # Blueprint registration
│   │   ├── routes.py              # Route handlers
│   │   ├── services.py            # Business logic
│   │   ├── models.py              # SQLAlchemy models
│   │   ├── schemas.py             # Marshmallow/Pydantic schemas
│   │   ├── decorators.py          # @login_required, @roles_required
│   │   └── forms.py               # WTForms (if using server-rendered)
│   │
│   ├── users/                     # Blueprint: Users
│   │   ├── __init__.py
│   │   ├── routes.py
│   │   ├── services.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── repository.py          # Database queries
│   │
│   ├── api/                       # Blueprint: REST API (if dual web+API)
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── users.py
│   │   │   ├── items.py
│   │   │   └── auth.py
│   │   └── errors.py              # API error handlers
│   │
│   ├── core/                      # Cross-cutting concerns
│   │   ├── __init__.py
│   │   ├── security.py            # Password hashing, JWT
│   │   ├── email.py               # Email sending
│   │   └── logging.py             # Logging configuration
│   │
│   ├── templates/                 # Jinja2 templates (if SSR)
│   │   ├── base.html
│   │   ├── auth/
│   │   │   ├── login.html
│   │   │   └── register.html
│   │   └── users/
│   │       ├── profile.html
│   │       └── list.html
│   │
│   └── static/                    # Static files (CSS, JS, images)
│       ├── css/
│       ├── js/
│       └── img/
│
├── migrations/                    # Flask-Migrate (Alembic) migrations
│   ├── versions/
│   └── alembic.ini
│
├── tests/
│   ├── conftest.py                # Fixtures: app, client, db
│   ├── auth/
│   │   ├── test_routes.py
│   │   └── test_services.py
│   ├── users/
│   │   ├── test_routes.py
│   │   └── test_services.py
│   └── factories.py               # Test data factories (factory_boy)
│
├── .env
├── .env.example
├── .flaskenv                      # FLASK_APP, FLASK_ENV
├── pyproject.toml
├── Dockerfile
└── wsgi.py                        # Gunicorn entry point
```

### Large Enterprise Project (API-Only)

```
my-api/
├── src/
│   └── app/
│       ├── __init__.py            # create_app()
│       ├── config.py
│       ├── extensions.py
│       │
│       ├── api/                   # ALL API routes
│       │   ├── __init__.py
│       │   ├── v1/
│       │   │   ├── __init__.py    # v1 blueprint registration
│       │   │   ├── auth/
│       │   │   │   ├── routes.py
│       │   │   │   └── schemas.py
│       │   │   ├── users/
│       │   │   │   ├── routes.py
│       │   │   │   └── schemas.py
│       │   │   └── billing/
│       │   │       ├── routes.py
│       │   │       └── schemas.py
│       │   └── v2/
│       │       └── ...
│       │
│       ├── domain/                # Business logic (framework-agnostic)
│       │   ├── auth/
│       │   │   ├── service.py
│       │   │   └── models.py
│       │   ├── users/
│       │   │   ├── service.py
│       │   │   ├── models.py
│       │   │   └── repository.py
│       │   └── billing/
│       │       ├── service.py
│       │       └── models.py
│       │
│       └── infrastructure/        # External concerns
│           ├── database.py
│           ├── cache.py
│           ├── email.py
│           └── storage.py
│
├── migrations/
├── tests/
├── scripts/
└── pyproject.toml
```

---

## 2. Application Factory Pattern

```python
# app/__init__.py
from flask import Flask

from app.config import config_by_name
from app.extensions import db, migrate, cors, jwt, limiter


def create_app(config_name: str = "development") -> Flask:
    """Application factory."""
    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    # Initialize extensions
    _register_extensions(app)

    # Register blueprints
    _register_blueprints(app)

    # Register error handlers
    _register_error_handlers(app)

    # Register CLI commands
    _register_commands(app)

    return app


def _register_extensions(app: Flask) -> None:
    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app)
    jwt.init_app(app)
    limiter.init_app(app)


def _register_blueprints(app: Flask) -> None:
    from app.auth import auth_bp
    from app.users import users_bp
    from app.api.v1 import api_v1_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(api_v1_bp, url_prefix="/api/v1")


def _register_error_handlers(app: Flask) -> None:
    from app.core.errors import register_error_handlers
    register_error_handlers(app)


def _register_commands(app: Flask) -> None:
    from app.commands import register_commands
    register_commands(app)
```

---

## 3. Extensions Module

```python
# app/extensions.py
"""
Initialize extensions WITHOUT app instance.
Extensions are bound to app in create_app() via init_app().
NEVER import app in this module — avoids circular imports.
"""
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_marshmallow import Marshmallow

db = SQLAlchemy()
migrate = Migrate()
cors = CORS()
jwt = JWTManager()
limiter = Limiter(key_func=get_remote_address)
ma = Marshmallow()
```

---

## 4. Configuration Classes

```python
# app/config.py
import os
from datetime import timedelta


class BaseConfig:
    """Base configuration — shared across all environments."""
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False

    # JWT
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # Rate limiting
    RATELIMIT_DEFAULT = "100/hour"
    RATELIMIT_STORAGE_URI = os.environ.get("REDIS_URL", "memory://")


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "postgresql://localhost/myapp_dev"
    )
    SQLALCHEMY_ECHO = True


class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "TEST_DATABASE_URL", "postgresql://localhost/myapp_test"
    )
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=5)
    RATELIMIT_ENABLED = False


class ProductionConfig(BaseConfig):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ["DATABASE_URL"]
    SQLALCHEMY_POOL_SIZE = 10
    SQLALCHEMY_MAX_OVERFLOW = 20
    SQLALCHEMY_POOL_RECYCLE = 300

    @classmethod
    def init_app(cls, app):
        """Production-specific initialization."""
        import logging
        from logging.handlers import RotatingFileHandler

        handler = RotatingFileHandler(
            "logs/app.log", maxBytes=10_000_000, backupCount=10
        )
        handler.setLevel(logging.WARNING)
        app.logger.addHandler(handler)


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
```

---

## 5. Blueprint Pattern

```python
# app/users/__init__.py
from flask import Blueprint

users_bp = Blueprint("users", __name__, url_prefix="/users")

from app.users import routes  # noqa: E402, F401 — registers routes


# app/users/routes.py
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.users import users_bp
from app.users import services, schemas


@users_bp.route("/", methods=["GET"])
@jwt_required()
def list_users():
    """List users with pagination."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    result = services.get_users_paginated(page=page, per_page=per_page)
    return jsonify(schemas.user_list_schema.dump(result)), 200


@users_bp.route("/<int:user_id>", methods=["GET"])
@jwt_required()
def get_user(user_id: int):
    """Get user by ID."""
    user = services.get_user_or_404(user_id)
    return jsonify(schemas.user_schema.dump(user)), 200


@users_bp.route("/", methods=["POST"])
@jwt_required()
def create_user():
    """Create a new user."""
    data = schemas.user_create_schema.load(request.get_json())
    user = services.create_user(**data)
    return jsonify(schemas.user_schema.dump(user)), 201


@users_bp.route("/<int:user_id>", methods=["PATCH"])
@jwt_required()
def update_user(user_id: int):
    """Update user fields."""
    data = schemas.user_update_schema.load(request.get_json())
    user = services.update_user(user_id, **data)
    return jsonify(schemas.user_schema.dump(user)), 200


@users_bp.route("/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id: int):
    """Delete a user."""
    services.delete_user(user_id)
    return "", 204
```

---

## 6. Service Layer

```python
# app/users/services.py
from flask import abort
from app.extensions import db
from app.users.models import User


def get_users_paginated(page: int = 1, per_page: int = 20):
    """Get paginated users."""
    return User.query.order_by(User.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )


def get_user_or_404(user_id: int) -> User:
    """Get user by ID or abort 404."""
    return db.get_or_404(User, user_id, description=f"User {user_id} not found")


def get_user_by_email(email: str) -> User | None:
    """Get user by email."""
    return User.query.filter_by(email=email).first()


def create_user(
    email: str,
    full_name: str,
    password: str,
) -> User:
    """Create user with hashed password."""
    if get_user_by_email(email):
        abort(409, description="Email already registered")
    user = User(email=email, full_name=full_name)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return user


def update_user(user_id: int, **kwargs) -> User:
    """Update user fields."""
    user = get_user_or_404(user_id)
    for key, value in kwargs.items():
        if hasattr(user, key):
            setattr(user, key, value)
    db.session.commit()
    return user


def delete_user(user_id: int) -> None:
    """Delete user."""
    user = get_user_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
```

---

## 7. SQLAlchemy Models

```python
# app/users/models.py
from datetime import datetime, UTC
from werkzeug.security import generate_password_hash, check_password_hash

from app.extensions import db


class TimestampMixin:
    """Add created_at and updated_at to models."""
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


class User(TimestampMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    full_name = db.Column(db.String(100), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    role = db.Column(db.String(20), default="user")

    # Relationships
    posts = db.relationship("Post", back_populates="author", lazy="dynamic")

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def __repr__(self) -> str:
        return f"<User {self.email}>"
```

---

## 8. Marshmallow Schemas

```python
# app/users/schemas.py
from marshmallow import Schema, fields, validate, post_load


class UserCreateSchema(Schema):
    email = fields.Email(required=True)
    full_name = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    password = fields.Str(
        required=True,
        validate=validate.Length(min=8, max=128),
        load_only=True,
    )


class UserUpdateSchema(Schema):
    email = fields.Email()
    full_name = fields.Str(validate=validate.Length(min=1, max=100))
    is_active = fields.Bool()


class UserSchema(Schema):
    id = fields.Int(dump_only=True)
    email = fields.Email()
    full_name = fields.Str()
    is_active = fields.Bool()
    role = fields.Str()
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)


class UserListSchema(Schema):
    """Pagination wrapper."""
    items = fields.Nested(UserSchema, many=True)
    total = fields.Int()
    page = fields.Int()
    per_page = fields.Int()
    pages = fields.Int()


# Schema instances
user_schema = UserSchema()
user_create_schema = UserCreateSchema()
user_update_schema = UserUpdateSchema()
user_list_schema = UserListSchema()
```

---

## 9. Error Handling

```python
# app/core/errors.py
from flask import Flask, jsonify
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(HTTPException)
    def handle_http_error(exc):
        return jsonify({
            "error": exc.name,
            "message": exc.description,
            "status_code": exc.code,
        }), exc.code

    @app.errorhandler(ValidationError)
    def handle_validation_error(exc):
        return jsonify({
            "error": "Validation Error",
            "message": exc.messages,
            "status_code": 422,
        }), 422

    @app.errorhandler(IntegrityError)
    def handle_integrity_error(exc):
        return jsonify({
            "error": "Conflict",
            "message": "Resource already exists or constraint violation",
            "status_code": 409,
        }), 409

    @app.errorhandler(Exception)
    def handle_unexpected_error(exc):
        app.logger.exception("Unhandled exception")
        return jsonify({
            "error": "Internal Server Error",
            "message": "An unexpected error occurred",
            "status_code": 500,
        }), 500
```

---

## 10. CLI Commands

```python
# app/commands.py
import click
from flask import Flask
from app.extensions import db


def register_commands(app: Flask) -> None:
    @app.cli.command("seed")
    @click.option("--count", default=10, help="Number of users to create")
    def seed_db(count: int):
        """Seed the database with test data."""
        from app.users.models import User

        for i in range(count):
            user = User(
                email=f"user{i}@example.com",
                full_name=f"User {i}",
            )
            user.set_password("password123")
            db.session.add(user)
        db.session.commit()
        click.echo(f"Created {count} users")

    @app.cli.command("create-admin")
    @click.argument("email")
    @click.password_option()
    def create_admin(email: str, password: str):
        """Create an admin user."""
        from app.users.models import User

        user = User(email=email, full_name="Admin", role="admin")
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        click.echo(f"Admin {email} created")
```

---

## 11. WSGI Entry Point

```python
# wsgi.py
import os
from app import create_app

config_name = os.environ.get("FLASK_CONFIG", "production")
app = create_app(config_name)

# .flaskenv (development convenience)
# FLASK_APP=wsgi.py
# FLASK_ENV=development
# FLASK_DEBUG=1
```

```bash
# Development
flask run --debug --port 5000

# Production with Gunicorn
gunicorn wsgi:app -w 4 -b 0.0.0.0:8000 --access-logfile -

# Production with Gunicorn + gevent
gunicorn wsgi:app -w 4 -k gevent -b 0.0.0.0:8000
```

---

## 12. Testing Structure

```python
# tests/conftest.py
import pytest
from app import create_app
from app.extensions import db as _db


@pytest.fixture(scope="session")
def app():
    """Create application for testing."""
    app = create_app("testing")
    with app.app_context():
        _db.create_all()
        yield app
        _db.drop_all()


@pytest.fixture(scope="function")
def db(app):
    """Create clean database for each test."""
    with app.app_context():
        _db.session.begin_nested()
        yield _db
        _db.session.rollback()


@pytest.fixture
def client(app):
    """Test client."""
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    """Get authenticated headers."""
    response = client.post("/api/v1/auth/login", json={
        "email": "admin@example.com",
        "password": "password123",
    })
    token = response.get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# tests/users/test_routes.py
def test_create_user(client, auth_headers):
    response = client.post(
        "/api/v1/users/",
        json={
            "email": "new@example.com",
            "full_name": "New User",
            "password": "securepass123",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.get_json()
    assert data["email"] == "new@example.com"
    assert "password" not in data
```

---

## 13. Flask vs Flask-RESTful vs Flask-RESTX

| Feature | Pure Flask | Flask-RESTful | Flask-RESTX |
|---------|-----------|--------------|-------------|
| Route definition | `@bp.route()` | `Resource` classes | `Resource` + `Namespace` |
| Serialization | Marshmallow | reqparse (deprecated) | Marshmallow or models |
| Swagger/OpenAPI | flask-smorest | Manual | Built-in Swagger UI |
| Recommendation | **Use for most projects** | Avoid (maintenance mode) | Use when Swagger is critical |

### Recommended Stack (2024+)

```
Flask 3.x
├── Flask-SQLAlchemy       # ORM
├── Flask-Migrate          # Alembic migrations
├── Flask-JWT-Extended     # JWT authentication
├── Flask-CORS             # CORS headers
├── Flask-Limiter          # Rate limiting
├── Marshmallow            # Serialization/validation
├── flask-smorest          # OpenAPI/Swagger generation
└── Celery / RQ            # Background tasks
```

---

## 14. Blueprint Nesting (Large Apps)

```python
# app/api/v1/__init__.py
from flask import Blueprint
from flask_smorest import Api

api_v1_bp = Blueprint("api_v1", __name__, url_prefix="/api/v1")

# Register nested blueprints
from app.api.v1.users import users_bp
from app.api.v1.auth import auth_bp
from app.api.v1.items import items_bp

api_v1_bp.register_blueprint(users_bp)
api_v1_bp.register_blueprint(auth_bp)
api_v1_bp.register_blueprint(items_bp)
```

---

## 15. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No factory pattern | Global `app = Flask(__name__)` at module level | Use `create_app()` factory, bind extensions via `init_app()` |
| Circular imports | `from app import db` fails at import time | Put extensions in `extensions.py`, import from there |
| Fat routes | Business logic in route handlers | Extract to `services.py`, routes handle HTTP only |
| No blueprints | All routes in one file | One Blueprint per feature, register in factory |
| Raw SQL everywhere | `db.engine.execute("SELECT ...")` | Use SQLAlchemy ORM models and queries |
| No schema validation | `request.json["email"]` without validation | Use Marshmallow schemas for input validation |
| Config in code | `app.config["SECRET_KEY"] = "hardcoded"` | Use config classes + environment variables |
| Testing without app context | `db.session.query()` outside test fixture | ALWAYS use `app.app_context()` in test fixtures |
| Monolithic models.py | ALL models in one file | Each feature has its own `models.py` |
| Missing error handlers | Unhandled exceptions return HTML errors | Register JSON error handlers for API responses |

---

## 16. Enforcement Checklist

- [ ] Application factory pattern used — `create_app()` in `app/__init__.py`
- [ ] Extensions initialized in `extensions.py` — NEVER coupled to app instance
- [ ] Each feature has its own Blueprint with routes, services, models, schemas
- [ ] Configuration uses class-based inheritance — Base → Dev/Test/Prod
- [ ] ALL sensitive values loaded from environment variables
- [ ] Marshmallow validates ALL incoming request data
- [ ] Service layer handles business logic — routes handle HTTP only
- [ ] Error handlers registered for HTTPException, ValidationError, 500
- [ ] Tests use app fixture with `create_app("testing")`
- [ ] Database sessions properly scoped — no leaked connections
- [ ] Flask-Migrate manages ALL schema changes
- [ ] WSGI entry point (`wsgi.py`) separate from app factory
- [ ] `.flaskenv` sets FLASK_APP and FLASK_DEBUG for development
- [ ] API versioning via Blueprint URL prefix when needed
