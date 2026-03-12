# GORM & Ent (Go ORMs)

> **Domain:** Database > ORM & Query Builders > Go
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Go's database ecosystem offers two distinct approaches: GORM (convention-based ORM, most popular) and Ent (schema-as-code with code generation, by Meta). Go also has excellent raw SQL support via `database/sql`, `sqlx`, and `pgx` — many Go teams prefer raw SQL over ORMs. Understanding when to use each approach (raw SQL, GORM, Ent) depends on project complexity, team preferences, and performance requirements.

---

## How It Works

### GORM

```go
// GORM — Model definition
import (
    "time"
    "gorm.io/gorm"
    "gorm.io/driver/postgres"
)

type User struct {
    ID        string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
    Email     string    `gorm:"uniqueIndex;not null"`
    Name      string    `gorm:"not null"`
    Role      string    `gorm:"type:varchar(20);default:'user'"`
    Orders    []Order   `gorm:"foreignKey:UserID"`
    CreatedAt time.Time
    UpdatedAt time.Time
}

type Order struct {
    ID        string      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
    UserID    string      `gorm:"type:uuid;not null;index"`
    User      User
    Total     float64     `gorm:"type:decimal(10,2);not null"`
    Status    string      `gorm:"type:varchar(20);default:'pending'"`
    Items     []OrderItem `gorm:"foreignKey:OrderID;constraint:OnDelete:CASCADE"`
    CreatedAt time.Time   `gorm:"index"`
}

type OrderItem struct {
    ID        string  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
    OrderID   string  `gorm:"type:uuid;not null"`
    ProductID string  `gorm:"type:uuid;not null"`
    Quantity  int     `gorm:"not null"`
    Price     float64 `gorm:"type:decimal(10,2);not null"`
}

// Initialize
func NewDB() (*gorm.DB, error) {
    dsn := "host=localhost user=app dbname=mydb sslmode=require"
    db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
    if err != nil {
        return nil, err
    }

    // Auto-migrate (development only)
    db.AutoMigrate(&User{}, &Order{}, &OrderItem{})

    return db, nil
}
```

```go
// GORM — CRUD operations

// CREATE
user := User{Email: "alice@example.com", Name: "Alice"}
result := db.Create(&user) // user.ID populated after create

// READ
var user User
db.First(&user, "id = ?", userID)  // by primary key
db.Where("email = ?", "alice@example.com").First(&user)

// READ with preload (eager loading)
var userWithOrders User
db.Preload("Orders", func(db *gorm.DB) *gorm.DB {
    return db.Order("created_at DESC").Limit(10)
}).Preload("Orders.Items").First(&userWithOrders, "id = ?", userID)

// READ many with conditions
var users []User
db.Where("role = ?", "admin").
    Order("created_at DESC").
    Limit(20).Offset(0).
    Find(&users)

// JOIN query
type UserOrderSummary struct {
    UserName   string  `gorm:"column:user_name"`
    OrderCount int64   `gorm:"column:order_count"`
    Revenue    float64 `gorm:"column:revenue"`
}
var summaries []UserOrderSummary
db.Model(&Order{}).
    Select("users.name AS user_name, COUNT(orders.id) AS order_count, SUM(orders.total) AS revenue").
    Joins("JOIN users ON orders.user_id = users.id").
    Group("users.id, users.name").
    Scan(&summaries)

// UPDATE
db.Model(&user).Updates(User{Name: "Alice Smith"})

// DELETE
db.Delete(&user)

// Transaction
db.Transaction(func(tx *gorm.DB) error {
    order := Order{UserID: userID, Total: 99.99}
    if err := tx.Create(&order).Error; err != nil {
        return err // rollback
    }
    items := []OrderItem{
        {OrderID: order.ID, ProductID: "prod-1", Quantity: 2, Price: 29.99},
    }
    if err := tx.Create(&items).Error; err != nil {
        return err // rollback
    }
    return nil // commit
})

// Raw SQL
var results []map[string]interface{}
db.Raw(`SELECT DATE_TRUNC('month', created_at) AS month, SUM(total) AS revenue
        FROM orders WHERE created_at > ? GROUP BY month`, startDate).Scan(&results)
```

---

### Ent (Meta/Facebook)

```go
// Ent — Schema definition (code generation)
// ent/schema/user.go
package schema

import (
    "entgo.io/ent"
    "entgo.io/ent/schema/edge"
    "entgo.io/ent/schema/field"
    "entgo.io/ent/schema/index"
    "github.com/google/uuid"
)

type User struct {
    ent.Schema
}

func (User) Fields() []ent.Field {
    return []ent.Field{
        field.UUID("id", uuid.UUID{}).Default(uuid.New),
        field.String("email").Unique().NotEmpty(),
        field.String("name").NotEmpty(),
        field.Enum("role").Values("user", "admin").Default("user"),
        field.Time("created_at").Default(time.Now),
    }
}

func (User) Edges() []ent.Edge {
    return []ent.Edge{
        edge.To("orders", Order.Type),
        edge.To("posts", Post.Type),
    }
}

func (User) Indexes() []ent.Index {
    return []ent.Index{
        index.Fields("email").Unique(),
    }
}
```

```go
// Ent — Generated client usage
// After: go generate ./ent

// CREATE
user, err := client.User.Create().
    SetEmail("alice@example.com").
    SetName("Alice").
    SetRole(user.RoleUser).
    Save(ctx)

// READ
user, err := client.User.
    Query().
    Where(user.EmailEQ("alice@example.com")).
    Only(ctx)  // exactly one result

// READ with edges (relations)
user, err := client.User.
    Query().
    Where(user.IDEQ(userID)).
    WithOrders(func(q *ent.OrderQuery) {
        q.Order(ent.Desc(order.FieldCreatedAt)).Limit(10)
        q.WithItems()
    }).
    Only(ctx)

// UPDATE
user, err := client.User.
    UpdateOneID(userID).
    SetName("Alice Smith").
    Save(ctx)

// DELETE
err := client.User.DeleteOneID(userID).Exec(ctx)

// Transaction
tx, err := client.Tx(ctx)
order, err := tx.Order.Create().
    SetUserID(userID).
    SetTotal(99.99).
    Save(ctx)
_, err = tx.OrderItem.Create().
    SetOrderID(order.ID).
    SetProductID("prod-1").
    SetQuantity(2).
    SetPrice(29.99).
    Save(ctx)
err = tx.Commit()
```

---

### Go Raw SQL (sqlx / pgx)

```go
// sqlx — Enhanced database/sql with struct scanning
import "github.com/jmoiron/sqlx"

type User struct {
    ID    string `db:"id"`
    Email string `db:"email"`
    Name  string `db:"name"`
}

db := sqlx.MustConnect("postgres", dsn)

// Named queries
var users []User
err := db.Select(&users,
    `SELECT id, email, name FROM users WHERE role = $1 ORDER BY created_at DESC LIMIT $2`,
    "admin", 20)

// pgx — PostgreSQL-specific, highest performance
import "github.com/jackc/pgx/v5/pgxpool"

pool, _ := pgxpool.New(ctx, dsn)
rows, _ := pool.Query(ctx,
    `SELECT id, email, name FROM users WHERE role = $1`, "admin")
```

---

### Go ORM Comparison

| Feature | GORM | Ent | sqlx/pgx (raw) |
|---------|------|-----|----------------|
| **Approach** | Convention-based ORM | Code generation | Raw SQL + struct scan |
| **Type safety** | Moderate (reflect) | Excellent (generated) | Manual |
| **Performance** | Good (reflection overhead) | Good | Best (no overhead) |
| **Learning curve** | Low | Medium | Low (SQL knowledge) |
| **Migrations** | AutoMigrate (dev) | Built-in | Manual (golang-migrate) |
| **Complex queries** | Query builder + raw | Predicates + raw | Direct SQL |
| **Community** | Largest Go ORM | Growing (Meta-backed) | Standard library |
| **Best for** | Rapid development | Type-safe, large teams | Performance-critical |

---

## Best Practices

1. **ALWAYS use pgx/sqlx** for performance-critical Go services — minimal overhead
2. **ALWAYS use GORM for rapid development** — fastest time to working CRUD
3. **ALWAYS use Ent for large teams** — generated code ensures type safety
4. **ALWAYS use Preload/WithEdges** for eager loading — prevent N+1
5. **NEVER use AutoMigrate in production** — use proper migration tools
6. **NEVER ignore GORM errors** — check `result.Error` after every operation

---

## Enforcement Checklist

- [ ] Go ORM/driver chosen based on project requirements
- [ ] pgx used for PostgreSQL-specific features and performance
- [ ] Eager loading configured (Preload/WithEdges)
- [ ] Transactions used for multi-table writes
- [ ] Proper migration tool used (not AutoMigrate in production)
- [ ] Raw SQL used for complex analytics queries
