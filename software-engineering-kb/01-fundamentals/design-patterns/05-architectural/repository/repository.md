# Repository Pattern

> **Domain:** Fundamentals > Design Patterns > Architectural
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Repository pattern **mediates between the domain and data mapping layers**, acting as an in-memory collection of domain objects. It encapsulates the logic for accessing data sources, providing a clean separation between business logic and data access. The domain layer works with repositories as if they were simple collections, unaware of the underlying persistence mechanism.

**Origin:** Defined by Martin Fowler in *Patterns of Enterprise Application Architecture* (2002) and reinforced as a core pattern in Eric Evans' *Domain-Driven Design* (2003).

## How It Works

```
┌──────────────┐    uses    ┌──────────────┐    abstracts    ┌──────────────┐
│   Service /  │ ─────────→ │  Repository  │ ─────────────→  │  Database /  │
│   Use Case   │            │  (interface) │                 │  API / File  │
└──────────────┘            └──────┬───────┘                 └──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
             ┌──────────────┐             ┌──────────────┐
             │   SQL Repo   │             │  In-Memory   │
             │   (prod)     │             │  Repo (test) │
             └──────────────┘             └──────────────┘
```

### TypeScript — Generic Repository

```typescript
// Repository interface — defines the contract
interface Repository<T, ID> {
  findById(id: ID): Promise<T | null>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: ID): Promise<void>;
}

// Domain entity
interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: Date;
}

// Domain-specific repository with custom queries
interface UserRepository extends Repository<User, string> {
  findByEmail(email: string): Promise<User | null>;
  findByRole(role: string): Promise<User[]>;
}

// Production implementation — PostgreSQL
class PostgresUserRepository implements UserRepository {
  constructor(private pool: Pool) {}

  async findById(id: string): Promise<User | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM users WHERE id = $1", [id]
    );
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM users WHERE email = $1", [email]
    );
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findByRole(role: string): Promise<User[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM users WHERE role = $1", [role]
    );
    return rows.map(this.toEntity);
  }

  async findAll(): Promise<User[]> {
    const { rows } = await this.pool.query("SELECT * FROM users");
    return rows.map(this.toEntity);
  }

  async save(user: User): Promise<User> {
    const { rows } = await this.pool.query(
      `INSERT INTO users (id, email, name, role, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET email = $2, name = $3, role = $4
       RETURNING *`,
      [user.id, user.email, user.name, user.role, user.createdAt]
    );
    return this.toEntity(rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM users WHERE id = $1", [id]);
  }

  private toEntity(row: any): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: new Date(row.created_at),
    };
  }
}

// Test implementation — in-memory
class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return [...this.users.values()].find(u => u.email === email) ?? null;
  }

  async findByRole(role: string): Promise<User[]> {
    return [...this.users.values()].filter(u => u.role === role);
  }

  async findAll(): Promise<User[]> {
    return [...this.users.values()];
  }

  async save(user: User): Promise<User> {
    this.users.set(user.id, { ...user });
    return user;
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }
}

// Service layer — depends on interface, not implementation
class UserService {
  constructor(private userRepo: UserRepository) {}

  async register(email: string, name: string): Promise<User> {
    const existing = await this.userRepo.findByEmail(email);
    if (existing) throw new Error("Email already registered");

    return this.userRepo.save({
      id: crypto.randomUUID(),
      email,
      name,
      role: "user",
      createdAt: new Date(),
    });
  }
}

// Dependency injection
const repo = isTest
  ? new InMemoryUserRepository()
  : new PostgresUserRepository(pool);
const service = new UserService(repo);
```

```python
# Python — Repository with SQLAlchemy
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class Product:
    id: str
    name: str
    price: float
    category: str

class ProductRepository(ABC):
    @abstractmethod
    def find_by_id(self, id: str) -> Product | None: ...

    @abstractmethod
    def find_by_category(self, category: str) -> list[Product]: ...

    @abstractmethod
    def save(self, product: Product) -> Product: ...

    @abstractmethod
    def delete(self, id: str) -> None: ...

class SQLAlchemyProductRepository(ProductRepository):
    def __init__(self, session: Session):
        self.session = session

    def find_by_id(self, id: str) -> Product | None:
        row = self.session.query(ProductModel).get(id)
        return self._to_entity(row) if row else None

    def find_by_category(self, category: str) -> list[Product]:
        rows = self.session.query(ProductModel).filter_by(category=category).all()
        return [self._to_entity(r) for r in rows]

    def save(self, product: Product) -> Product:
        model = ProductModel(**vars(product))
        self.session.merge(model)
        self.session.commit()
        return product

    def delete(self, id: str) -> None:
        self.session.query(ProductModel).filter_by(id=id).delete()
        self.session.commit()

    def _to_entity(self, row: ProductModel) -> Product:
        return Product(id=row.id, name=row.name, price=row.price, category=row.category)
```

### Repository vs DAO vs Active Record

```
Repository:     Collection-oriented, domain-centric, hides queries
DAO:            Data-access-oriented, table-centric, exposes CRUD
Active Record:  Entity is its own repository (user.save())

Repository:   userRepo.findByRole("admin")     // domain language
DAO:          userDao.executeQuery(sql)          // data language
Active Rec:   User.where(role: "admin")          // model has queries

Use Repository for:  complex domains, DDD, testability
Use Active Record:   simple CRUD apps, rapid prototyping (Rails, Django ORM)
```

## Real-world Examples

- **Spring Data JPA** — `JpaRepository<T, ID>` auto-generates implementations from method names.
- **Django ORM** — `Model.objects` acts as a repository (Active Record + Repository hybrid).
- **Entity Framework** — `DbSet<T>` in C# functions as a repository over DbContext.
- **TypeORM** — `Repository<T>` with custom repositories for domain-specific queries.
- **Android Room** — `@Dao` interfaces with compile-time query verification.
- **DDD** — aggregate roots are accessed exclusively through repositories.

## Sources

- Fowler, M. (2002). *Patterns of Enterprise Application Architecture*. Addison-Wesley. pp. 322-327.
- Evans, E. (2003). *Domain-Driven Design*. Addison-Wesley. Chapter 6.
- [Martin Fowler — Repository](https://martinfowler.com/eaaCatalog/repository.html)
