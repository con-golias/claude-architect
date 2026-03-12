# Test Data Management

| Attribute      | Value                                                                |
|----------------|----------------------------------------------------------------------|
| **Domain**     | Testing > Test Automation                                            |
| **Importance** | High                                                                 |
| **Last Updated** | 2026-03-10                                                         |
| **Cross-ref**  | `07-database/migrations.md`, `11-testing/test-automation/flaky-tests.md`, `08-security/compliance/data-privacy.md` |

---

## Core Concepts

### Test Data Strategies

| Strategy      | Description                                       | Best For                         |
|---------------|---------------------------------------------------|----------------------------------|
| **Fixtures**  | Static data files (JSON, SQL, CSV) in VCS         | Stable reference data, snapshots |
| **Factories** | Programmatic builders generating valid objects     | Unit and integration tests       |
| **Seeders**   | Scripts populating a DB with a known state         | Integration and E2E suites       |
| **Builders**  | Fluent API for complex object graphs               | Domain objects with many fields  |
| **Snapshots** | Anonymized production-like datasets                | Performance and acceptance tests |

### Factory Pattern

Factories produce valid test objects with sensible defaults. Override only the
fields relevant to each test.

```
factory.build()            -> in-memory object (no DB)
factory.create()           -> persisted object (written to DB)
factory.buildList(5)       -> array of 5 in-memory objects
factory.create({ role })   -> persisted with one field overridden
```

### Database Seeding

- Run seeders in a transaction and roll back after the suite.
- Version seed scripts alongside schema migrations.
- Keep seed data minimal: only entities the tests actually reference.

### Sensitive Data Handling

Never use real PII in test environments.

- **Mask**: replace identifying fields with synthetic data during seeding.
- **Faker libraries**: generate realistic but fake names, emails, addresses.
- **Anonymization pipelines**: required for production DB snapshots.
- **Compliance**: GDPR, HIPAA, SOC 2 prohibit real customer data in test envs.

### Test Data Cleanup

| Strategy               | Mechanism                          | Trade-off                          |
|------------------------|------------------------------------|------------------------------------|
| **Transaction rollback** | Wrap each test in a tx; rollback | Fastest; cannot test commit behavior |
| **Truncation**         | `TRUNCATE TABLE` after each suite  | Clean slate; slower than rollback  |
| **Dedicated database** | Fresh DB per test worker           | Perfect isolation; highest cost    |
| **Docker containers**  | Ephemeral DB via Testcontainers    | Production-like; ~2-5 s startup   |

### Environment Parity

- Use the same database engine and version as production.
- Apply the same migrations in the same order.
- Scale seed data to 10 % of production cardinality for performance tests.
- Store env-specific config in environment variables, never in code.

### Data Versioning

- Co-locate fixtures with the migration that introduced the schema change.
- Include test data updates in the same PR as migration changes.
- Validate fixtures against the current schema in CI.

---

## Code Examples

### Factory Pattern with Fishery and faker.js (TypeScript)

```typescript
// tests/factories/user.factory.ts
import { Factory } from "fishery";
import { faker } from "@faker-js/faker";

interface Address {
  street: string; city: string; country: string; postalCode: string;
}
interface User {
  id: string; email: string; name: string;
  role: "admin" | "member" | "viewer";
  address: Address; createdAt: Date; active: boolean;
}

faker.seed(42); // Deterministic output in CI

const addressFactory = Factory.define<Address>(() => ({
  street: faker.location.streetAddress(),
  city: faker.location.city(),
  country: faker.location.countryCode(),
  postalCode: faker.location.zipCode(),
}));

const userFactory = Factory.define<User>(({ sequence, params }) => ({
  id: `user-${sequence}`,
  email: params.email ?? faker.internet.email(),
  name: params.name ?? faker.person.fullName(),
  role: params.role ?? "member",
  address: addressFactory.build(params.address),
  createdAt: params.createdAt ?? new Date("2025-01-01T00:00:00Z"),
  active: params.active ?? true,
}));

export { userFactory, addressFactory };

// Usage:
// const admin = userFactory.build({ role: "admin" });
// const users = userFactory.buildList(10, { active: false });
```

```typescript
// tests/factories/order.factory.ts
import { Factory } from "fishery";
import { faker } from "@faker-js/faker";
import { userFactory } from "./user.factory";

interface LineItem {
  productId: string; productName: string; quantity: number; unitPrice: number;
}
interface Order {
  id: string; userId: string; items: LineItem[];
  total: number; status: "pending" | "confirmed" | "shipped" | "delivered"; createdAt: Date;
}

const lineItemFactory = Factory.define<LineItem>(({ sequence }) => {
  const quantity = faker.number.int({ min: 1, max: 5 });
  const unitPrice = parseFloat(faker.commerce.price({ min: 5, max: 200 }));
  return { productId: `prod-${sequence}`, productName: faker.commerce.productName(), quantity, unitPrice };
});

const orderFactory = Factory.define<Order>(({ sequence, params }) => {
  const items = params.items ?? lineItemFactory.buildList(3);
  return {
    id: `order-${sequence}`,
    userId: params.userId ?? userFactory.build().id,
    items,
    total: parseFloat(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)),
    status: params.status ?? "pending",
    createdAt: params.createdAt ?? new Date("2025-01-15T00:00:00Z"),
  };
});

export { orderFactory, lineItemFactory };
```

### Test Helpers with Builder Pattern (Go)

```go
// internal/testutil/builders.go
package testutil

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"
)

type Role string

const (
	RoleAdmin  Role = "admin"
	RoleMember Role = "member"
	RoleViewer Role = "viewer"
)

type User struct {
	ID    string; Email string; Name string
	Role  Role;   Active bool;  CreatedAt time.Time
}

type Order struct {
	ID     string; UserID string; Items []LineItem
	Total  float64; Status string; CreatedAt time.Time
}

type LineItem struct {
	ProductID string; Name string; Quantity int; UnitPrice float64
}

// --- User builder ---

var userSeq int

type UserBuilder struct{ user User }

func NewUserBuilder() *UserBuilder {
	userSeq++
	return &UserBuilder{user: User{
		ID: fmt.Sprintf("user-%d", userSeq),
		Email: fmt.Sprintf("user-%d@test.example.com", userSeq),
		Name: fmt.Sprintf("Test User %d", userSeq),
		Role: RoleMember, Active: true,
		CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
	}}
}

func (b *UserBuilder) WithRole(r Role) *UserBuilder   { b.user.Role = r; return b }
func (b *UserBuilder) WithEmail(e string) *UserBuilder { b.user.Email = e; return b }
func (b *UserBuilder) Inactive() *UserBuilder          { b.user.Active = false; return b }
func (b *UserBuilder) Build() User                     { return b.user }

// --- Order builder ---

var orderSeq int

type OrderBuilder struct{ order Order }

func NewOrderBuilder() *OrderBuilder {
	orderSeq++
	return &OrderBuilder{order: Order{
		ID: fmt.Sprintf("order-%d", orderSeq), Status: "pending",
		CreatedAt: time.Date(2025, 1, 15, 0, 0, 0, 0, time.UTC),
	}}
}

func (b *OrderBuilder) ForUser(u User) *OrderBuilder          { b.order.UserID = u.ID; return b }
func (b *OrderBuilder) WithStatus(s string) *OrderBuilder     { b.order.Status = s; return b }
func (b *OrderBuilder) WithItems(items ...LineItem) *OrderBuilder {
	b.order.Items = items
	b.order.Total = 0
	for _, i := range items { b.order.Total += float64(i.Quantity) * i.UnitPrice }
	return b
}
func (b *OrderBuilder) Build() Order {
	if len(b.order.Items) == 0 {
		b.order.Items = []LineItem{{ProductID: "prod-1", Name: "Widget", Quantity: 2, UnitPrice: 19.99}}
		b.order.Total = 39.98
	}
	return b.order
}

// --- Transaction-isolated test DB ---

type TestDB struct{ tx *sql.Tx }

func SetupTestDB(t *testing.T, db *sql.DB) *TestDB {
	t.Helper()
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil { t.Fatalf("begin tx: %v", err) }
	t.Cleanup(func() {
		if err := tx.Rollback(); err != nil && err != sql.ErrTxDone {
			t.Errorf("rollback: %v", err)
		}
	})
	return &TestDB{tx: tx}
}

func (tdb *TestDB) InsertUser(t *testing.T, u User) {
	t.Helper()
	_, err := tdb.tx.Exec(
		`INSERT INTO users (id, email, name, role, active, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
		u.ID, u.Email, u.Name, u.Role, u.Active, u.CreatedAt)
	if err != nil { t.Fatalf("insert user: %v", err) }
}

// Usage:
// user := testutil.NewUserBuilder().WithRole(testutil.RoleAdmin).Build()
// order := testutil.NewOrderBuilder().ForUser(user).WithStatus("confirmed").Build()
```

### factory_boy with SQLAlchemy Model Factories (Python)

```python
# tests/factories.py
import factory
from factory.alchemy import SQLAlchemyModelFactory
from faker import Faker

from app.models import Address, LineItem, Order, User
from tests.conftest import TestSession

fake = Faker()
Faker.seed(42)


class AddressFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Address
        sqlalchemy_session = TestSession
        sqlalchemy_session_persistence = "commit"

    street = factory.LazyFunction(fake.street_address)
    city = factory.LazyFunction(fake.city)
    country = factory.LazyFunction(fake.country_code)
    postal_code = factory.LazyFunction(fake.zipcode)


class UserFactory(SQLAlchemyModelFactory):
    class Meta:
        model = User
        sqlalchemy_session = TestSession
        sqlalchemy_session_persistence = "commit"

    id = factory.Sequence(lambda n: f"user-{n}")
    email = factory.LazyFunction(fake.email)
    name = factory.LazyFunction(fake.name)
    role = "member"
    active = True
    address = factory.SubFactory(AddressFactory)

    class Params:
        admin = factory.Trait(role="admin")
        inactive = factory.Trait(active=False)


class OrderFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Order
        sqlalchemy_session = TestSession
        sqlalchemy_session_persistence = "commit"

    id = factory.Sequence(lambda n: f"order-{n}")
    user = factory.SubFactory(UserFactory)
    status = "pending"

    @factory.lazy_attribute
    def items(self) -> list:
        return [LineItem(product_id=f"prod-{i}", quantity=2, unit_price=19.99) for i in range(3)]

    @factory.lazy_attribute
    def total(self) -> float:
        return round(sum(i.quantity * i.unit_price for i in self.items), 2)

# Usage:
# user = UserFactory(admin=True)
# order = OrderFactory(user=user, status="confirmed")
# users = UserFactory.build_batch(10, inactive=True)
```

```python
# tests/conftest.py
from collections.abc import Generator
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from app.models import Base

TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL)
TestSession = sessionmaker(bind=engine)


@pytest.fixture(scope="session", autouse=True)
def _create_tables() -> Generator[None, None, None]:
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def db_session(monkeypatch: pytest.MonkeyPatch) -> Generator[Session, None, None]:
    """Transactional session that rolls back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestSession(bind=connection)
    monkeypatch.setattr("tests.factories.TestSession", session)
    yield session
    session.close()
    transaction.rollback()
    connection.close()
```

### Database Seeding Script (YAML + Python)

```yaml
# test-data/seed.yaml
users:
  - id: "user-seed-1"
    email: "alice@example.com"
    name: "Alice Admin"
    role: "admin"
    active: true
  - id: "user-seed-2"
    email: "bob@example.com"
    name: "Bob Member"
    role: "member"
    active: true
orders:
  - id: "order-seed-1"
    user_id: "user-seed-1"
    status: "confirmed"
    items:
      - { product_id: "prod-1", name: "Widget Pro", quantity: 2, unit_price: 49.99 }
      - { product_id: "prod-2", name: "Gadget Plus", quantity: 1, unit_price: 129.00 }
```

```python
# scripts/seed_database.py
import yaml
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.orm import Session


def load_seed_data(session: Session, seed_path: Path) -> None:
    data = yaml.safe_load(seed_path.read_text())
    for user in data.get("users", []):
        session.execute(text(
            "INSERT INTO users (id, email, name, role, active) VALUES (:id, :email, :name, :role, :active)"
        ), user)
    for order in data.get("orders", []):
        items = order.pop("items", [])
        order["total"] = round(sum(i["quantity"] * i["unit_price"] for i in items), 2)
        session.execute(text(
            "INSERT INTO orders (id, user_id, status, total) VALUES (:id, :user_id, :status, :total)"
        ), order)
    session.commit()
```

---

## 10 Best Practices

1. **Use factories, not fixtures, for unit and integration tests.** Factories produce minimal valid objects and resist schema drift.
2. **Seed faker with a fixed value** (`Faker.seed(42)`) for deterministic output across machines and CI.
3. **Isolate test data with transaction rollback.** Faster than truncation and guarantees isolation.
4. **Never use production data** without a verified anonymization pipeline. Compliance violations carry severe penalties.
5. **Co-locate test data updates with schema migrations.** Same PR, same review.
6. **Keep seed data minimal.** Only create entities the tests actually reference.
7. **Use the builder pattern** for domain objects with many optional fields. Fluent APIs are self-documenting.
8. **Automate fixture validation in CI.** Load every fixture against the current schema on every build.
9. **Use Testcontainers** for integration tests requiring a real database. SQLite-for-Postgres hides bugs.
10. **Document the test data strategy** in the contributing guide so new engineers know the conventions.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Copying production data without anonymization | PII leaks, GDPR/HIPAA violations | Build anonymization pipelines; use factories with faker |
| Sharing mutable test data across tests | Order-dependent flakiness | Transaction rollback or per-test database isolation |
| Hardcoding IDs and magic values | Tests break on seed data changes; intent unclear | Factories generate IDs; reference entities by variable |
| Creating massive seed datasets for every run | Slow startup, wasted compute, obscured intent | Seed minimally; each test creates its own data |
| Not cleaning up test data after runs | Stale data causes interference and disk pressure | Transaction rollback, truncation, or ephemeral containers |
| Using a different DB engine in tests vs. production | Hides SQL dialect bugs and constraint differences | Same engine via Testcontainers; SQLite only for pure unit tests |
| Letting fixtures drift from current schema | Silent load failures or cryptic errors | Validate fixtures in CI; co-locate updates with migrations |
| Generating random data without seeding the PRNG | Non-deterministic output; failures cannot be reproduced | Always seed faker and random generators with a fixed value |

---

## Enforcement Checklist

- [ ] Test data factories exist for every core domain entity
- [ ] Faker / random generators are seeded with a fixed value for determinism
- [ ] Transaction rollback or per-test database isolation is configured
- [ ] No production PII exists in any test environment (verified by audit)
- [ ] Fixture files are validated against the current schema in CI
- [ ] Seed data updates are required in the same PR as schema migrations
- [ ] Builder pattern is used for domain objects with more than 5 fields
- [ ] Testcontainers or equivalent provides production-parity database in CI
- [ ] Test data cleanup runs automatically after every test suite execution
- [ ] The test data strategy is documented in the repository contributing guide
- [ ] Anonymization pipeline is in place for any production-derived test data
- [ ] Environment-specific secrets are injected via env variables, never committed
