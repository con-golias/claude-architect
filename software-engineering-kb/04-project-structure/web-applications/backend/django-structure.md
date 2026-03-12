# Django Project Structure — Complete Specification

> **AI Plugin Directive:** When a developer asks "how do I structure a Django project?", "Django app organization?", "Django REST Framework structure?", "Django project vs app?", "Django for large projects?", or "Two Scoops of Django structure?", use this directive. Django follows "convention over configuration" with its own opinionated structure. Django projects consist of a project-level configuration package and multiple feature apps. Each app is a self-contained domain with models, views, URLs, serializers, and tests. The "Two Scoops of Django" book by Daniel and Audrey Feldroy is the authoritative guide for Django project organization. Django REST Framework (DRF) extends the pattern with serializers, viewsets, and routers.

---

## 1. The Core Rule

**Django projects MUST use a single project configuration package and multiple feature-specific apps. Each app represents ONE business domain (users, orders, payments) and contains its own models, views, URLs, forms/serializers, admin, and tests. Apps MUST be small and focused — an app with 20+ models is TOO BIG. Use the 3-tier layout: `config/` (project settings), `apps/` (feature apps), and project root. For API projects, use Django REST Framework with ViewSets and Serializers. Follow the Two Scoops of Django conventions.**

```
❌ WRONG: Monolithic app with everything
myproject/
├── myapp/
│   ├── models.py          ← 30 models for users, orders, products, payments
│   ├── views.py           ← 2000 lines of views
│   ├── serializers.py     ← All serializers for everything
│   ├── urls.py
│   └── admin.py           ← Giant admin file
├── manage.py
└── myproject/
    └── settings.py

✅ CORRECT: Feature apps with clear boundaries
myproject/
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── local.py
│   │   └── production.py
│   ├── urls.py
│   └── wsgi.py
├── apps/
│   ├── users/
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── tests/
│   ├── orders/
│   └── products/
└── manage.py
```

---

## 2. Enterprise Structure

### Django REST Framework API Project

```
myproject/
├── config/                                ← Project configuration package
│   ├── __init__.py
│   ├── settings/                          ← Split settings per environment
│   │   ├── __init__.py
│   │   ├── base.py                        ← Common settings (installed apps, middleware)
│   │   ├── local.py                       ← Development overrides (DEBUG=True)
│   │   ├── production.py                  ← Production overrides (security)
│   │   ├── staging.py                     ← Staging overrides
│   │   └── test.py                        ← Test overrides (fast passwords, in-memory)
│   ├── urls.py                            ← Root URL configuration
│   ├── wsgi.py                            ← WSGI entry point
│   ├── asgi.py                            ← ASGI entry point (for async/websockets)
│   └── celery.py                          ← Celery configuration (if using)
│
├── apps/                                  ← Feature apps (business domains)
│   ├── __init__.py
│   │
│   ├── users/                             ← User management app
│   │   ├── __init__.py
│   │   ├── apps.py                        ← App configuration
│   │   ├── models.py                      ← User model (custom user model)
│   │   ├── managers.py                    ← Custom model managers
│   │   ├── admin.py                       ← Admin site configuration
│   │   ├── views.py                       ← DRF ViewSets
│   │   ├── serializers.py                 ← DRF Serializers
│   │   ├── urls.py                        ← URL patterns for this app
│   │   ├── permissions.py                 ← Custom DRF permissions
│   │   ├── filters.py                     ← django-filter FilterSets
│   │   ├── signals.py                     ← Django signals
│   │   ├── tasks.py                       ← Celery tasks
│   │   ├── constants.py                   ← App-specific constants
│   │   ├── exceptions.py                  ← Custom exceptions
│   │   ├── utils.py                       ← App-specific utilities
│   │   ├── migrations/                    ← Database migrations (auto-generated)
│   │   │   ├── __init__.py
│   │   │   └── 0001_initial.py
│   │   └── tests/                         ← Tests directory
│   │       ├── __init__.py
│   │       ├── test_models.py
│   │       ├── test_views.py
│   │       ├── test_serializers.py
│   │       ├── test_permissions.py
│   │       ├── factories.py              ← Factory Boy factories
│   │       └── conftest.py               ← Pytest fixtures
│   │
│   ├── orders/                            ← Orders management app
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── models.py                      ← Order, OrderItem models
│   │   ├── managers.py                    ← OrderQuerySet, custom managers
│   │   ├── admin.py
│   │   ├── views.py                       ← OrderViewSet
│   │   ├── serializers.py                 ← OrderSerializer, OrderItemSerializer
│   │   ├── urls.py
│   │   ├── permissions.py
│   │   ├── filters.py
│   │   ├── signals.py
│   │   ├── tasks.py                       ← async order processing
│   │   ├── services.py                    ← Business logic (service layer)
│   │   ├── selectors.py                   ← Complex query functions
│   │   ├── migrations/
│   │   └── tests/
│   │       ├── test_models.py
│   │       ├── test_views.py
│   │       ├── test_services.py
│   │       └── factories.py
│   │
│   ├── products/
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── models.py
│   │   ├── admin.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   ├── migrations/
│   │   └── tests/
│   │
│   ├── payments/
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   ├── services.py                    ← Stripe/payment logic
│   │   ├── webhooks.py                    ← Payment webhook handlers
│   │   ├── urls.py
│   │   ├── migrations/
│   │   └── tests/
│   │
│   └── notifications/
│       ├── models.py
│       ├── services.py                    ← Email/SMS sending logic
│       ├── tasks.py                       ← Celery tasks for async notifications
│       ├── templates/                     ← Email templates
│       │   └── notifications/
│       │       ├── welcome.html
│       │       └── order_confirmation.html
│       ├── migrations/
│       └── tests/
│
├── common/                                ← Shared utilities (used by 3+ apps)
│   ├── __init__.py
│   ├── models.py                          ← Abstract base models (TimestampMixin)
│   ├── permissions.py                     ← Shared DRF permissions
│   ├── pagination.py                      ← Custom pagination classes
│   ├── renderers.py                       ← Custom DRF renderers
│   ├── exceptions.py                      ← Global exception handler
│   ├── middleware.py                      ← Custom middleware
│   ├── utils.py                           ← Shared utility functions
│   └── validators.py                      ← Shared validators
│
├── templates/                             ← Django templates (if any)
│   ├── base.html
│   └── emails/
│
├── static/                                ← Static files
│   ├── css/
│   ├── js/
│   └── images/
│
├── media/                                 ← User-uploaded files (GITIGNORED)
│
├── docs/                                  ← Documentation
│   ├── api.md
│   └── architecture.md
│
├── scripts/                               ← Management scripts
│   ├── seed_data.py
│   └── deploy.sh
│
├── requirements/                          ← Pip requirements split by env
│   ├── base.txt                           ← Common dependencies
│   ├── local.txt                          ← Dev dependencies (includes base.txt)
│   ├── production.txt                     ← Production dependencies
│   └── test.txt                           ← Test dependencies
│
├── .env
├── .env.example
├── manage.py
├── pyproject.toml                         ← Or setup.cfg for project metadata
├── Dockerfile
├── docker-compose.yml
├── Makefile                               ← Common commands
├── conftest.py                            ← Root pytest configuration
└── pytest.ini                             ← or in pyproject.toml
```

---

## 3. Settings Split Pattern

```python
# config/settings/base.py — Common settings
import os
from pathlib import Path
import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / '.env')

SECRET_KEY = env('DJANGO_SECRET_KEY')
DEBUG = False  # Overridden in local.py

INSTALLED_APPS = [
    # Django built-in
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'django_filters',
    'corsheaders',
    'drf_spectacular',  # OpenAPI schema generation

    # Local apps
    'apps.users',
    'apps.orders',
    'apps.products',
    'apps.payments',
    'apps.notifications',
]

AUTH_USER_MODEL = 'users.User'  # MUST set custom user model

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'common.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'EXCEPTION_HANDLER': 'common.exceptions.custom_exception_handler',
}

# config/settings/local.py — Development
from .base import *  # noqa

DEBUG = True
ALLOWED_HOSTS = ['*']
DATABASES = {
    'default': env.db('DATABASE_URL', default='sqlite:///db.sqlite3'),
}

# config/settings/production.py — Production
from .base import *  # noqa

DEBUG = False
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS')
DATABASES = {
    'default': env.db('DATABASE_URL'),
}
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

```
RULE: NEVER use a single settings.py — ALWAYS split by environment.
RULE: base.py has common settings. local.py overrides for dev. production.py for prod.
RULE: Use django-environ for environment variable parsing.
RULE: Set DJANGO_SETTINGS_MODULE in .env: config.settings.local or config.settings.production
RULE: ALWAYS set AUTH_USER_MODEL to a custom user model BEFORE first migration.
```

---

## 4. Service Layer Pattern (Django Styleguide)

```python
# apps/orders/services.py — Business logic
from django.db import transaction
from apps.orders.models import Order, OrderItem
from apps.products.models import Product
from apps.notifications.services import send_order_confirmation

def create_order(*, user, items: list[dict]) -> Order:
    """
    Create an order with items.
    Business rules:
    - Validate stock availability
    - Calculate totals
    - Send confirmation notification
    """
    with transaction.atomic():
        order = Order.objects.create(user=user, status='pending')

        total = 0
        for item_data in items:
            product = Product.objects.select_for_update().get(id=item_data['product_id'])
            if product.stock < item_data['quantity']:
                raise ValueError(f'Insufficient stock for {product.name}')

            product.stock -= item_data['quantity']
            product.save()

            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=item_data['quantity'],
                price=product.price,
            )
            total += product.price * item_data['quantity']

        order.total = total
        order.save()

    send_order_confirmation(order=order)
    return order

# apps/orders/selectors.py — Complex queries
from django.db.models import QuerySet, Sum, F
from apps.orders.models import Order

def get_user_orders(*, user, status: str | None = None) -> QuerySet[Order]:
    qs = Order.objects.filter(user=user).select_related('user').prefetch_related('items__product')
    if status:
        qs = qs.filter(status=status)
    return qs.order_by('-created_at')

def get_order_statistics(*, user) -> dict:
    return Order.objects.filter(user=user).aggregate(
        total_orders=Count('id'),
        total_spent=Sum('total'),
    )
```

```
RULE: services.py contains business logic (mutations, workflows).
RULE: selectors.py contains complex read queries.
RULE: Use keyword-only arguments (*, user, items) in services for clarity.
RULE: Services are plain functions, NOT classes. No unnecessary OOP.
RULE: Services handle transactions. Views call services.
RULE: Views should be thin — parse request, call service, return response.
```

---

## 5. Abstract Base Models

```python
# common/models.py — Shared abstract models
import uuid
from django.db import models

class TimestampMixin(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

class UUIDMixin(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True

class BaseModel(UUIDMixin, TimestampMixin):
    """Base model with UUID primary key and timestamps."""
    class Meta:
        abstract = True

# Usage in feature apps:
# apps/orders/models.py
from common.models import BaseModel

class Order(BaseModel):
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='orders')
    status = models.CharField(max_length=20, choices=ORDER_STATUS_CHOICES, default='pending')
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        ordering = ['-created_at']
```

---

## 6. URL Configuration

```python
# config/urls.py — Root URL conf
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include([
        path('auth/', include('apps.users.urls')),
        path('users/', include('apps.users.urls_users')),
        path('orders/', include('apps.orders.urls')),
        path('products/', include('apps.products.urls')),
    ])),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

# apps/orders/urls.py — Feature app URLs
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('', views.OrderViewSet, basename='orders')

urlpatterns = [
    path('', include(router.urls)),
]
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Single monolithic app** | One app with 20+ models, 2000-line views.py | Split into focused apps by business domain |
| **Business logic in views** | ViewSet methods with 100+ lines of logic | Extract to services.py (service layer) |
| **Single settings.py** | `if DEBUG:` conditionals scattered in settings | Split: base.py, local.py, production.py |
| **No custom user model** | Using default `auth.User`, impossible to extend later | Set AUTH_USER_MODEL BEFORE first migration |
| **Fat serializers** | Serializer with create/update logic + validation + business rules | Serializer validates data, service handles logic |
| **No select_related/prefetch_related** | N+1 queries on every list endpoint | Always optimize querysets in selectors.py |
| **Tests in single test.py** | One test.py file with 1000 lines | tests/ directory: test_models.py, test_views.py, etc. |
| **No Factory Boy** | Manual model creation in every test | Factory Boy factories for test data |
| **Requirements in single file** | requirements.txt with dev + prod + test deps mixed | Split: base.txt, local.txt, production.txt, test.txt |
| **App cross-imports** | Orders app directly imports Products model internals | Use Django's ForeignKey relations or service layer |
| **No API versioning** | /api/orders/ without version | /api/v1/orders/ — always version your API |
| **Hardcoded config** | API keys and URLs hardcoded in code | django-environ + .env for all config |

---

## 8. Enforcement Checklist

- [ ] **Feature apps** — one app per business domain (users, orders, products)
- [ ] **Split settings** — base.py, local.py, production.py, test.py
- [ ] **Custom user model** — AUTH_USER_MODEL set before first migration
- [ ] **Service layer** — services.py for business logic, selectors.py for queries
- [ ] **Thin views** — views parse request, call service, return response
- [ ] **Abstract base models** — TimestampMixin, UUIDMixin in common/models.py
- [ ] **DRF ViewSets** — router-based URL registration
- [ ] **API versioning** — /api/v1/ prefix
- [ ] **drf-spectacular** — auto-generated OpenAPI schema and Swagger UI
- [ ] **Split requirements** — base.txt + local.txt + production.txt
- [ ] **Factory Boy** — test factories for all models
- [ ] **tests/ directory** — test_models.py, test_views.py, test_services.py
- [ ] **django-environ** — .env file for all configuration
- [ ] **Celery tasks** — async operations in tasks.py per app
- [ ] **Migrations committed** — all migrations in version control
