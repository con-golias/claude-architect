# SQLAlchemy

> **Domain:** Database > ORM & Query Builders > SQLAlchemy
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

SQLAlchemy is the dominant Python ORM, used by Flask, FastAPI, and most Python web frameworks. It provides two distinct APIs: the Core (SQL expression language — a query builder) and the ORM (object-relational mapping). Unlike many ORMs, SQLAlchemy's design philosophy is "the developer should be in control" — it maps closely to SQL concepts rather than hiding them. SQLAlchemy 2.0 brought modern Python typing support, making it comparable to Prisma/Drizzle in type safety while maintaining the full power of SQL through its expression language.

---

## How It Works

### Model Definition (SQLAlchemy 2.0)

```python
# models.py — SQLAlchemy 2.0 declarative
from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Numeric, ForeignKey, Enum as SAEnum, Index
from sqlalchemy.orm import (
    DeclarativeBase, Mapped, mapped_column, relationship,
)
import enum

class Base(DeclarativeBase):
    pass

class Role(enum.Enum):
    USER = "user"
    ADMIN = "admin"

class OrderStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(SAEnum(Role), default=Role.USER)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    posts: Mapped[list["Post"]] = relationship(back_populates="author")
    orders: Mapped[list["Order"]] = relationship(back_populates="user")

class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(500))
    content: Mapped[Optional[str]]
    published: Mapped[bool] = mapped_column(default=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    author: Mapped["User"] = relationship(back_populates="posts")

    __table_args__ = (Index("idx_posts_author", "author_id"),)

class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus), default=OrderStatus.PENDING
    )
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("idx_orders_user_created", "user_id", "created_at"),)

class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    product_id: Mapped[int]
    quantity: Mapped[int]
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))

    order: Mapped["Order"] = relationship(back_populates="items")
```

### CRUD Operations

```python
from sqlalchemy import create_engine, select, func, and_
from sqlalchemy.orm import Session, selectinload, joinedload

engine = create_engine("postgresql://localhost/mydb", echo=False)

# CREATE
with Session(engine) as session:
    user = User(email="alice@example.com", name="Alice")
    session.add(user)
    session.commit()
    session.refresh(user)  # get generated id

# READ — single
with Session(engine) as session:
    user = session.get(User, user_id)  # by primary key

    # With explicit query
    stmt = select(User).where(User.email == "alice@example.com")
    user = session.scalars(stmt).first()

# READ — with relations (eager loading)
with Session(engine) as session:
    stmt = (
        select(User)
        .where(User.id == user_id)
        .options(
            selectinload(User.orders).selectinload(Order.items),
            selectinload(User.posts),
        )
    )
    user = session.scalars(stmt).first()

# READ — with JOIN and filter
with Session(engine) as session:
    stmt = (
        select(User)
        .join(User.orders)
        .where(
            and_(
                User.role == Role.ADMIN,
                Order.total > 100,
            )
        )
        .order_by(User.created_at.desc())
        .limit(20)
    )
    users = session.scalars(stmt).unique().all()

# Aggregation
with Session(engine) as session:
    stmt = (
        select(
            Order.status,
            func.count().label("order_count"),
            func.sum(Order.total).label("revenue"),
        )
        .group_by(Order.status)
    )
    results = session.execute(stmt).all()

# UPDATE
with Session(engine) as session:
    user = session.get(User, user_id)
    user.name = "Alice Smith"
    session.commit()

# DELETE
with Session(engine) as session:
    user = session.get(User, user_id)
    session.delete(user)  # cascades to related objects
    session.commit()

# Transaction (explicit)
with Session(engine) as session:
    try:
        order = Order(user_id=user_id, total=Decimal("99.99"))
        session.add(order)
        session.flush()  # get order.id without commit

        items = [
            OrderItem(order_id=order.id, product_id=1, quantity=2, price=Decimal("29.99")),
            OrderItem(order_id=order.id, product_id=2, quantity=1, price=Decimal("40.01")),
        ]
        session.add_all(items)
        session.commit()
    except Exception:
        session.rollback()
        raise
```

### Async Support

```python
# SQLAlchemy async (with asyncpg)
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

engine = create_async_engine("postgresql+asyncpg://localhost/mydb")
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_user_orders(user_id: int) -> list[Order]:
    async with async_session() as session:
        stmt = (
            select(Order)
            .where(Order.user_id == user_id)
            .options(selectinload(Order.items))
            .order_by(Order.created_at.desc())
            .limit(20)
        )
        result = await session.scalars(stmt)
        return result.all()

# FastAPI integration
from fastapi import Depends

async def get_db():
    async with async_session() as session:
        yield session

@app.get("/users/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    return user
```

### Migrations (Alembic)

```bash
# Initialize Alembic
alembic init alembic

# Generate migration from model changes
alembic revision --autogenerate -m "add orders table"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

---

## Best Practices

1. **ALWAYS use SQLAlchemy 2.0** style (Mapped, mapped_column) — type-safe, modern
2. **ALWAYS use selectinload/joinedload** for relations — prevent N+1 queries
3. **ALWAYS use async** for FastAPI and async frameworks — asyncpg for PostgreSQL
4. **ALWAYS use Alembic** for migrations — integrated with SQLAlchemy models
5. **ALWAYS use session context manager** — ensures proper cleanup
6. **NEVER access lazy-loaded relations** outside session — causes DetachedInstanceError
7. **NEVER use `session.query()`** in new code — use `select()` (2.0 style)

---

## Enforcement Checklist

- [ ] SQLAlchemy 2.0 declarative style used (Mapped, mapped_column)
- [ ] Eager loading configured for N+1 prevention
- [ ] Async engine used for async frameworks
- [ ] Alembic migrations tracked in version control
- [ ] Sessions properly scoped (context manager, request lifecycle)
- [ ] Indexes defined in model __table_args__
