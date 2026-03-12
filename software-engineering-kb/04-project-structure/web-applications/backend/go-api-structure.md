# Go API Project Structure

> **AI Plugin Directive:** When generating a Go API project, ALWAYS use this structure. Apply the Standard Go Project Layout principles with `cmd/`, `internal/`, and `pkg/` separation. This guide covers Go 1.22+ with modern patterns, generics, and structured logging.

**Core Rule: Follow Go's explicit simplicity. Use `internal/` for private packages, `cmd/` for entry points, and flat packages over deep nesting. NEVER import a third-party framework when the standard library suffices.**

---

## 1. Enterprise Project Structure

### Standard Layout

```
my-api/
├── cmd/                           # Application entry points
│   ├── api/                       # Main API server
│   │   └── main.go               # Wires dependencies, starts server
│   ├── worker/                    # Background worker (optional)
│   │   └── main.go
│   └── migrate/                   # Migration CLI tool (optional)
│       └── main.go
│
├── internal/                      # Private application code
│   ├── config/                    # Configuration loading
│   │   └── config.go
│   │
│   ├── server/                    # HTTP server setup
│   │   ├── server.go             # Server struct, Start/Stop
│   │   ├── routes.go             # Route registration
│   │   └── middleware.go         # HTTP middleware
│   │
│   ├── user/                      # Feature: Users (domain package)
│   │   ├── handler.go            # HTTP handlers
│   │   ├── service.go            # Business logic
│   │   ├── repository.go         # Database interface + impl
│   │   ├── model.go              # Domain types
│   │   └── user_test.go          # Tests co-located
│   │
│   ├── order/                     # Feature: Orders
│   │   ├── handler.go
│   │   ├── service.go
│   │   ├── repository.go
│   │   ├── model.go
│   │   └── order_test.go
│   │
│   ├── auth/                      # Feature: Authentication
│   │   ├── handler.go
│   │   ├── service.go
│   │   ├── middleware.go         # Auth middleware
│   │   ├── jwt.go                # Token generation/validation
│   │   └── model.go
│   │
│   ├── platform/                  # Infrastructure/platform concerns
│   │   ├── database/
│   │   │   ├── postgres.go       # Connection pool setup
│   │   │   └── migrations.go    # Migration runner
│   │   ├── cache/
│   │   │   └── redis.go
│   │   ├── email/
│   │   │   └── smtp.go
│   │   └── storage/
│   │       └── s3.go
│   │
│   └── common/                    # Shared utilities
│       ├── errors.go             # Custom error types
│       ├── response.go           # JSON response helpers
│       ├── pagination.go         # Pagination types
│       └── validator.go          # Input validation
│
├── pkg/                           # Public reusable packages (optional)
│   └── httputil/                  # Could be imported by other projects
│       └── response.go
│
├── api/                           # API specifications
│   └── openapi.yaml              # OpenAPI/Swagger spec
│
├── migrations/                    # SQL migration files
│   ├── 000001_create_users.up.sql
│   ├── 000001_create_users.down.sql
│   ├── 000002_create_orders.up.sql
│   └── 000002_create_orders.down.sql
│
├── scripts/                       # Build/deploy scripts
│   ├── build.sh
│   └── docker-entrypoint.sh
│
├── deployments/                   # Deployment configs
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── k8s/
│       ├── deployment.yaml
│       └── service.yaml
│
├── go.mod
├── go.sum
├── Makefile                       # Build automation
└── .golangci.yml                  # Linter config
```

### Minimal Project (Startups / Small APIs)

```
my-api/
├── main.go                        # Entry point
├── config.go                      # Configuration
├── server.go                      # HTTP server + routes
├── middleware.go                   # Middleware
├── user.go                        # User handlers + service + model
├── order.go                       # Order handlers + service + model
├── db.go                          # Database setup
├── errors.go                      # Error types
├── migrations/
├── go.mod
├── go.sum
├── Makefile
└── Dockerfile
```

---

## 2. Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Package | Short, lowercase, singular | `user`, `order`, `auth` |
| File | snake_case, descriptive | `user_handler.go`, `order_test.go` |
| Exported type | PascalCase | `User`, `OrderService`, `CreateUserRequest` |
| Unexported type | camelCase | `userRepository`, `tokenClaims` |
| Interface | -er suffix (single method) or descriptive | `Reader`, `UserRepository` |
| Constructor | `New` + Type | `NewUserService`, `NewServer` |
| HTTP handler | `Handle` + Verb + Noun | `HandleCreateUser`, `HandleGetUsers` |
| Test file | `*_test.go` (same package) | `user_test.go`, `handler_test.go` |
| Mock file | `mock_*.go` or in `*_test.go` | `mock_repository.go` |

### Package Naming Rules

```
GOOD: user, order, auth, config, server
BAD:  users, models, controllers, helpers, utils, common (too generic)
```

**Exception:** `common/` or `platform/` is acceptable for truly cross-cutting infrastructure code that does not belong to any domain package.

---

## 3. Entry Point (cmd/api/main.go)

```go
// cmd/api/main.go
package main

import (
    "context"
    "fmt"
    "log/slog"
    "os"
    "os/signal"
    "syscall"

    "myapp/internal/auth"
    "myapp/internal/config"
    "myapp/internal/order"
    "myapp/internal/platform/database"
    "myapp/internal/server"
    "myapp/internal/user"
)

func main() {
    if err := run(); err != nil {
        fmt.Fprintf(os.Stderr, "error: %v\n", err)
        os.Exit(1)
    }
}

func run() error {
    // Load configuration
    cfg, err := config.Load()
    if err != nil {
        return fmt.Errorf("loading config: %w", err)
    }

    // Setup structured logging
    logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: cfg.LogLevel,
    }))
    slog.SetDefault(logger)

    // Connect to database
    db, err := database.Connect(cfg.DatabaseURL)
    if err != nil {
        return fmt.Errorf("connecting to database: %w", err)
    }
    defer db.Close()

    // Wire dependencies
    userRepo := user.NewPostgresRepository(db)
    userSvc := user.NewService(userRepo)
    userHandler := user.NewHandler(userSvc)

    orderRepo := order.NewPostgresRepository(db)
    orderSvc := order.NewService(orderRepo)
    orderHandler := order.NewHandler(orderSvc)

    authSvc := auth.NewService(cfg.JWTSecret, cfg.TokenExpiry)
    authHandler := auth.NewHandler(authSvc, userSvc)
    authMiddleware := auth.NewMiddleware(authSvc)

    // Create and start server
    srv := server.New(cfg.Port, logger,
        server.WithUserHandler(userHandler),
        server.WithOrderHandler(orderHandler),
        server.WithAuthHandler(authHandler),
        server.WithAuthMiddleware(authMiddleware),
    )

    // Graceful shutdown
    ctx, stop := signal.NotifyContext(context.Background(),
        syscall.SIGINT, syscall.SIGTERM)
    defer stop()

    return srv.Start(ctx)
}
```

---

## 4. Configuration

```go
// internal/config/config.go
package config

import (
    "fmt"
    "log/slog"
    "os"
    "strconv"
    "time"
)

type Config struct {
    Port        int
    Environment string
    LogLevel    slog.Level

    DatabaseURL string

    JWTSecret   string
    TokenExpiry time.Duration

    RedisURL string

    CORSOrigins []string
}

func Load() (*Config, error) {
    port, err := strconv.Atoi(getEnv("PORT", "8080"))
    if err != nil {
        return nil, fmt.Errorf("invalid PORT: %w", err)
    }

    dbURL := os.Getenv("DATABASE_URL")
    if dbURL == "" {
        return nil, fmt.Errorf("DATABASE_URL is required")
    }

    jwtSecret := os.Getenv("JWT_SECRET")
    if jwtSecret == "" {
        return nil, fmt.Errorf("JWT_SECRET is required")
    }

    return &Config{
        Port:        port,
        Environment: getEnv("ENVIRONMENT", "development"),
        LogLevel:    parseLogLevel(getEnv("LOG_LEVEL", "info")),
        DatabaseURL: dbURL,
        JWTSecret:   jwtSecret,
        TokenExpiry: parseDuration(getEnv("TOKEN_EXPIRY", "30m")),
        RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),
        CORSOrigins: splitCSV(getEnv("CORS_ORIGINS", "http://localhost:3000")),
    }, nil
}

func getEnv(key, fallback string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return fallback
}

func parseLogLevel(s string) slog.Level {
    switch s {
    case "debug":
        return slog.LevelDebug
    case "warn":
        return slog.LevelWarn
    case "error":
        return slog.LevelError
    default:
        return slog.LevelInfo
    }
}
```

---

## 5. HTTP Server

```go
// internal/server/server.go
package server

import (
    "context"
    "fmt"
    "log/slog"
    "net/http"
    "time"
)

type Server struct {
    httpServer *http.Server
    logger     *slog.Logger
}

func New(port int, logger *slog.Logger, opts ...Option) *Server {
    s := &Server{logger: logger}

    mux := http.NewServeMux()

    // Apply options (handlers, middleware)
    cfg := &options{}
    for _, opt := range opts {
        opt(cfg)
    }

    // Register routes
    s.registerRoutes(mux, cfg)

    // Build middleware chain
    handler := chainMiddleware(mux,
        requestIDMiddleware,
        loggingMiddleware(logger),
        corsMiddleware([]string{"*"}),
        recoverMiddleware(logger),
    )

    s.httpServer = &http.Server{
        Addr:         fmt.Sprintf(":%d", port),
        Handler:      handler,
        ReadTimeout:  10 * time.Second,
        WriteTimeout: 30 * time.Second,
        IdleTimeout:  60 * time.Second,
    }

    return s
}

func (s *Server) Start(ctx context.Context) error {
    errCh := make(chan error, 1)

    go func() {
        s.logger.Info("server starting", "addr", s.httpServer.Addr)
        if err := s.httpServer.ListenAndServe(); err != http.ErrServerClosed {
            errCh <- err
        }
    }()

    select {
    case err := <-errCh:
        return fmt.Errorf("server error: %w", err)
    case <-ctx.Done():
        s.logger.Info("shutting down server")
        shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()
        return s.httpServer.Shutdown(shutdownCtx)
    }
}
```

```go
// internal/server/routes.go
package server

import "net/http"

func (s *Server) registerRoutes(mux *http.ServeMux, cfg *options) {
    // Health check
    mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte(`{"status":"ok"}`))
    })

    // Auth routes (public)
    if cfg.authHandler != nil {
        mux.HandleFunc("POST /api/v1/auth/login", cfg.authHandler.HandleLogin)
        mux.HandleFunc("POST /api/v1/auth/register", cfg.authHandler.HandleRegister)
    }

    // Protected routes
    protected := http.NewServeMux()
    if cfg.userHandler != nil {
        protected.HandleFunc("GET /api/v1/users", cfg.userHandler.HandleList)
        protected.HandleFunc("GET /api/v1/users/{id}", cfg.userHandler.HandleGet)
        protected.HandleFunc("POST /api/v1/users", cfg.userHandler.HandleCreate)
        protected.HandleFunc("PUT /api/v1/users/{id}", cfg.userHandler.HandleUpdate)
        protected.HandleFunc("DELETE /api/v1/users/{id}", cfg.userHandler.HandleDelete)
    }
    if cfg.orderHandler != nil {
        protected.HandleFunc("GET /api/v1/orders", cfg.orderHandler.HandleList)
        protected.HandleFunc("POST /api/v1/orders", cfg.orderHandler.HandleCreate)
    }

    // Wrap protected routes with auth middleware
    if cfg.authMiddleware != nil {
        mux.Handle("/api/v1/", cfg.authMiddleware.Authenticate(protected))
    }
}
```

---

## 6. Feature Package: Handler

```go
// internal/user/handler.go
package user

import (
    "encoding/json"
    "net/http"
    "strconv"

    "myapp/internal/common"
)

type Handler struct {
    service *Service
}

func NewHandler(service *Service) *Handler {
    return &Handler{service: service}
}

func (h *Handler) HandleList(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    page, _ := strconv.Atoi(r.URL.Query().Get("page"))
    if page < 1 {
        page = 1
    }
    limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
    if limit < 1 || limit > 100 {
        limit = 20
    }

    users, total, err := h.service.List(ctx, page, limit)
    if err != nil {
        common.ErrorJSON(w, err)
        return
    }

    common.JSON(w, http.StatusOK, common.PageResponse[UserResponse]{
        Items: toResponseSlice(users),
        Total: total,
        Page:  page,
        Limit: limit,
    })
}

func (h *Handler) HandleGet(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
    if err != nil {
        common.ErrorJSON(w, common.ErrBadRequest("invalid user ID"))
        return
    }

    user, err := h.service.GetByID(ctx, id)
    if err != nil {
        common.ErrorJSON(w, err)
        return
    }

    common.JSON(w, http.StatusOK, toResponse(user))
}

func (h *Handler) HandleCreate(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    var req CreateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        common.ErrorJSON(w, common.ErrBadRequest("invalid request body"))
        return
    }

    if err := req.Validate(); err != nil {
        common.ErrorJSON(w, err)
        return
    }

    user, err := h.service.Create(ctx, req)
    if err != nil {
        common.ErrorJSON(w, err)
        return
    }

    common.JSON(w, http.StatusCreated, toResponse(user))
}

func (h *Handler) HandleUpdate(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
    if err != nil {
        common.ErrorJSON(w, common.ErrBadRequest("invalid user ID"))
        return
    }

    var req UpdateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        common.ErrorJSON(w, common.ErrBadRequest("invalid request body"))
        return
    }

    user, err := h.service.Update(ctx, id, req)
    if err != nil {
        common.ErrorJSON(w, err)
        return
    }

    common.JSON(w, http.StatusOK, toResponse(user))
}

func (h *Handler) HandleDelete(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
    if err != nil {
        common.ErrorJSON(w, common.ErrBadRequest("invalid user ID"))
        return
    }

    if err := h.service.Delete(ctx, id); err != nil {
        common.ErrorJSON(w, err)
        return
    }

    w.WriteHeader(http.StatusNoContent)
}
```

---

## 7. Feature Package: Service

```go
// internal/user/service.go
package user

import (
    "context"
    "fmt"

    "myapp/internal/common"
)

type Service struct {
    repo Repository
}

func NewService(repo Repository) *Service {
    return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, page, limit int) ([]User, int, error) {
    offset := (page - 1) * limit
    users, err := s.repo.FindAll(ctx, offset, limit)
    if err != nil {
        return nil, 0, fmt.Errorf("listing users: %w", err)
    }
    total, err := s.repo.Count(ctx)
    if err != nil {
        return nil, 0, fmt.Errorf("counting users: %w", err)
    }
    return users, total, nil
}

func (s *Service) GetByID(ctx context.Context, id int64) (*User, error) {
    user, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("finding user %d: %w", id, err)
    }
    if user == nil {
        return nil, common.ErrNotFound("user", id)
    }
    return user, nil
}

func (s *Service) Create(ctx context.Context, req CreateUserRequest) (*User, error) {
    existing, _ := s.repo.FindByEmail(ctx, req.Email)
    if existing != nil {
        return nil, common.ErrConflict("email already registered")
    }

    hashedPassword, err := hashPassword(req.Password)
    if err != nil {
        return nil, fmt.Errorf("hashing password: %w", err)
    }

    user := &User{
        Email:        req.Email,
        FullName:     req.FullName,
        PasswordHash: hashedPassword,
        IsActive:     true,
    }

    if err := s.repo.Create(ctx, user); err != nil {
        return nil, fmt.Errorf("creating user: %w", err)
    }

    return user, nil
}

func (s *Service) Update(ctx context.Context, id int64, req UpdateUserRequest) (*User, error) {
    user, err := s.GetByID(ctx, id)
    if err != nil {
        return nil, err
    }

    if req.FullName != nil {
        user.FullName = *req.FullName
    }
    if req.Email != nil {
        user.Email = *req.Email
    }
    if req.IsActive != nil {
        user.IsActive = *req.IsActive
    }

    if err := s.repo.Update(ctx, user); err != nil {
        return nil, fmt.Errorf("updating user: %w", err)
    }

    return user, nil
}

func (s *Service) Delete(ctx context.Context, id int64) error {
    _, err := s.GetByID(ctx, id)
    if err != nil {
        return err
    }
    return s.repo.Delete(ctx, id)
}
```

---

## 8. Feature Package: Repository (Interface + Implementation)

```go
// internal/user/repository.go
package user

import (
    "context"
    "database/sql"
    "fmt"
)

// Repository defines the data access interface.
// Implementation is in the same package — Go does NOT need separate interface packages.
type Repository interface {
    FindByID(ctx context.Context, id int64) (*User, error)
    FindByEmail(ctx context.Context, email string) (*User, error)
    FindAll(ctx context.Context, offset, limit int) ([]User, error)
    Count(ctx context.Context) (int, error)
    Create(ctx context.Context, user *User) error
    Update(ctx context.Context, user *User) error
    Delete(ctx context.Context, id int64) error
}

type PostgresRepository struct {
    db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
    return &PostgresRepository{db: db}
}

func (r *PostgresRepository) FindByID(ctx context.Context, id int64) (*User, error) {
    var u User
    err := r.db.QueryRowContext(ctx,
        `SELECT id, email, full_name, password_hash, is_active, role,
                created_at, updated_at
         FROM users WHERE id = $1`, id,
    ).Scan(&u.ID, &u.Email, &u.FullName, &u.PasswordHash,
        &u.IsActive, &u.Role, &u.CreatedAt, &u.UpdatedAt)

    if err == sql.ErrNoRows {
        return nil, nil
    }
    if err != nil {
        return nil, fmt.Errorf("querying user: %w", err)
    }
    return &u, nil
}

func (r *PostgresRepository) FindAll(ctx context.Context, offset, limit int) ([]User, error) {
    rows, err := r.db.QueryContext(ctx,
        `SELECT id, email, full_name, is_active, role, created_at, updated_at
         FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        limit, offset,
    )
    if err != nil {
        return nil, fmt.Errorf("querying users: %w", err)
    }
    defer rows.Close()

    var users []User
    for rows.Next() {
        var u User
        if err := rows.Scan(&u.ID, &u.Email, &u.FullName,
            &u.IsActive, &u.Role, &u.CreatedAt, &u.UpdatedAt); err != nil {
            return nil, fmt.Errorf("scanning user: %w", err)
        }
        users = append(users, u)
    }
    return users, rows.Err()
}

func (r *PostgresRepository) Create(ctx context.Context, user *User) error {
    return r.db.QueryRowContext(ctx,
        `INSERT INTO users (email, full_name, password_hash, is_active, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at, updated_at`,
        user.Email, user.FullName, user.PasswordHash, user.IsActive, user.Role,
    ).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
}
```

---

## 9. Model and Request Types

```go
// internal/user/model.go
package user

import "time"

type User struct {
    ID           int64     `json:"id"`
    Email        string    `json:"email"`
    FullName     string    `json:"full_name"`
    PasswordHash string    `json:"-"` // NEVER serialize
    IsActive     bool      `json:"is_active"`
    Role         string    `json:"role"`
    CreatedAt    time.Time `json:"created_at"`
    UpdatedAt    time.Time `json:"updated_at"`
}

type CreateUserRequest struct {
    Email    string `json:"email"`
    FullName string `json:"full_name"`
    Password string `json:"password"`
}

func (r CreateUserRequest) Validate() error {
    if r.Email == "" {
        return common.ErrValidation("email is required")
    }
    if r.FullName == "" {
        return common.ErrValidation("full_name is required")
    }
    if len(r.Password) < 8 {
        return common.ErrValidation("password must be at least 8 characters")
    }
    return nil
}

type UpdateUserRequest struct {
    Email    *string `json:"email,omitempty"`
    FullName *string `json:"full_name,omitempty"`
    IsActive *bool   `json:"is_active,omitempty"`
}

type UserResponse struct {
    ID        int64     `json:"id"`
    Email     string    `json:"email"`
    FullName  string    `json:"full_name"`
    IsActive  bool      `json:"is_active"`
    Role      string    `json:"role"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

func toResponse(u *User) UserResponse {
    return UserResponse{
        ID:        u.ID,
        Email:     u.Email,
        FullName:  u.FullName,
        IsActive:  u.IsActive,
        Role:      u.Role,
        CreatedAt: u.CreatedAt,
        UpdatedAt: u.UpdatedAt,
    }
}

func toResponseSlice(users []User) []UserResponse {
    result := make([]UserResponse, len(users))
    for i, u := range users {
        result[i] = toResponse(&u)
    }
    return result
}
```

---

## 10. Common Package (Error Handling)

```go
// internal/common/errors.go
package common

import (
    "fmt"
    "net/http"
)

type AppError struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
}

func (e *AppError) Error() string { return e.Message }

func ErrNotFound(entity string, id any) *AppError {
    return &AppError{
        Code:    http.StatusNotFound,
        Message: fmt.Sprintf("%s with id %v not found", entity, id),
    }
}

func ErrBadRequest(msg string) *AppError {
    return &AppError{Code: http.StatusBadRequest, Message: msg}
}

func ErrConflict(msg string) *AppError {
    return &AppError{Code: http.StatusConflict, Message: msg}
}

func ErrValidation(msg string) *AppError {
    return &AppError{Code: http.StatusUnprocessableEntity, Message: msg}
}

func ErrInternal(msg string) *AppError {
    return &AppError{Code: http.StatusInternalServerError, Message: msg}
}


// internal/common/response.go
package common

import (
    "encoding/json"
    "errors"
    "net/http"
)

type PageResponse[T any] struct {
    Items []T `json:"items"`
    Total int `json:"total"`
    Page  int `json:"page"`
    Limit int `json:"limit"`
}

func JSON(w http.ResponseWriter, status int, data any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(data)
}

func ErrorJSON(w http.ResponseWriter, err error) {
    var appErr *AppError
    if errors.As(err, &appErr) {
        JSON(w, appErr.Code, map[string]string{"error": appErr.Message})
        return
    }
    JSON(w, http.StatusInternalServerError,
        map[string]string{"error": "internal server error"})
}
```

---

## 11. Middleware

```go
// internal/server/middleware.go
package server

import (
    "log/slog"
    "net/http"
    "time"

    "github.com/google/uuid"
)

type Middleware func(http.Handler) http.Handler

func chainMiddleware(handler http.Handler, middlewares ...Middleware) http.Handler {
    for i := len(middlewares) - 1; i >= 0; i-- {
        handler = middlewares[i](handler)
    }
    return handler
}

func requestIDMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        id := r.Header.Get("X-Request-ID")
        if id == "" {
            id = uuid.NewString()
        }
        w.Header().Set("X-Request-ID", id)
        ctx := context.WithValue(r.Context(), requestIDKey, id)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func loggingMiddleware(logger *slog.Logger) Middleware {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            sw := &statusWriter{ResponseWriter: w, status: 200}

            next.ServeHTTP(sw, r)

            logger.Info("request",
                "method", r.Method,
                "path", r.URL.Path,
                "status", sw.status,
                "duration_ms", time.Since(start).Milliseconds(),
            )
        })
    }
}

func recoverMiddleware(logger *slog.Logger) Middleware {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            defer func() {
                if rec := recover(); rec != nil {
                    logger.Error("panic recovered", "error", rec)
                    http.Error(w, "internal server error",
                        http.StatusInternalServerError)
                }
            }()
            next.ServeHTTP(w, r)
        })
    }
}
```

---

## 12. Database Setup

```go
// internal/platform/database/postgres.go
package database

import (
    "database/sql"
    "fmt"
    "time"

    _ "github.com/lib/pq"
)

func Connect(databaseURL string) (*sql.DB, error) {
    db, err := sql.Open("postgres", databaseURL)
    if err != nil {
        return nil, fmt.Errorf("opening database: %w", err)
    }

    // Connection pool settings
    db.SetMaxOpenConns(25)
    db.SetMaxIdleConns(5)
    db.SetConnMaxLifetime(5 * time.Minute)
    db.SetConnMaxIdleTime(1 * time.Minute)

    if err := db.Ping(); err != nil {
        return nil, fmt.Errorf("pinging database: %w", err)
    }

    return db, nil
}
```

---

## 13. Testing

```go
// internal/user/service_test.go
package user

import (
    "context"
    "testing"
)

// Mock repository for testing
type mockRepository struct {
    users map[int64]*User
    nextID int64
}

func newMockRepository() *mockRepository {
    return &mockRepository{users: make(map[int64]*User), nextID: 1}
}

func (m *mockRepository) FindByID(ctx context.Context, id int64) (*User, error) {
    u, ok := m.users[id]
    if !ok {
        return nil, nil
    }
    return u, nil
}

func (m *mockRepository) Create(ctx context.Context, user *User) error {
    user.ID = m.nextID
    m.nextID++
    m.users[user.ID] = user
    return nil
}

// ... implement other interface methods

func TestService_Create(t *testing.T) {
    repo := newMockRepository()
    svc := NewService(repo)

    user, err := svc.Create(context.Background(), CreateUserRequest{
        Email:    "test@example.com",
        FullName: "Test User",
        Password: "securepassword",
    })

    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if user.Email != "test@example.com" {
        t.Errorf("expected email test@example.com, got %s", user.Email)
    }
    if user.ID == 0 {
        t.Error("expected non-zero ID")
    }
}

func TestService_Create_DuplicateEmail(t *testing.T) {
    repo := newMockRepository()
    svc := NewService(repo)

    // Create first user
    _, _ = svc.Create(context.Background(), CreateUserRequest{
        Email: "test@example.com", FullName: "User 1", Password: "password1",
    })

    // Attempt duplicate
    _, err := svc.Create(context.Background(), CreateUserRequest{
        Email: "test@example.com", FullName: "User 2", Password: "password2",
    })

    if err == nil {
        t.Fatal("expected error for duplicate email")
    }
}
```

---

## 14. Makefile

```makefile
.PHONY: build run test lint migrate

# Build
build:
	go build -o bin/api ./cmd/api

# Run with hot reload (using air)
run:
	air -c .air.toml

# Run directly
run-direct:
	go run ./cmd/api

# Test
test:
	go test ./... -v -race -count=1

test-cover:
	go test ./... -coverprofile=coverage.out
	go tool cover -html=coverage.out

# Lint
lint:
	golangci-lint run

# Database migrations (golang-migrate)
migrate-up:
	migrate -path migrations -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path migrations -database "$(DATABASE_URL)" down 1

migrate-create:
	migrate create -ext sql -dir migrations -seq $(name)

# Docker
docker-build:
	docker build -t myapp -f deployments/Dockerfile .

docker-run:
	docker compose -f deployments/docker-compose.yml up
```

---

## 15. Standard Library vs Third-Party

| Need | Standard Library | Third-Party (When Needed) |
|------|-----------------|--------------------------|
| HTTP Router | `net/http` (Go 1.22+ with path params) | chi, gorilla/mux, gin (high perf) |
| JSON | `encoding/json` | json-iterator (performance critical) |
| Logging | `log/slog` (Go 1.21+) | zerolog, zap (structured, high perf) |
| Database | `database/sql` | sqlx (named params), pgx (PostgreSQL) |
| ORM | N/A | GORM, ent, sqlc (code generation) |
| Validation | Manual | go-playground/validator |
| Config | `os.Getenv` | viper, envconfig, koanf |
| Testing | `testing` | testify (assertions), testcontainers |
| Migration | N/A | golang-migrate, goose |
| UUID | N/A | google/uuid |

**Decision rule:** Use standard library FIRST. Add third-party ONLY when the standard library adds significant boilerplate or lacks critical functionality.

---

## 16. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Framework-first | Using Gin/Echo for simple API | Start with `net/http`, add framework only when needed |
| Package-per-layer | `handlers/`, `services/`, `models/` at top level | Package-per-feature: `user/`, `order/`, `auth/` |
| Exporting everything | All types and functions PascalCase | Export only what other packages NEED |
| Interface pollution | Interface for every type | Define interfaces where they are USED, not where implemented |
| `init()` abuse | Hidden initialization, test surprises | Explicit initialization in `main()`, pass dependencies |
| Global state | Package-level `var db *sql.DB` | Inject via constructors, avoid globals |
| Ignoring errors | `_ = doSomething()` | ALWAYS handle errors, log or return them |
| Deep package nesting | `internal/domain/user/service/impl/` | Flat packages: `internal/user/` with service.go, handler.go |
| Context misuse | Storing business data in context | Context for cancellation + request-scoped values only |
| Missing graceful shutdown | `log.Fatal(http.ListenAndServe(...))` | Use signal handling + `Server.Shutdown()` |

---

## 17. Enforcement Checklist

- [ ] `cmd/` for entry points, `internal/` for private code — NEVER business logic in `cmd/`
- [ ] Package-per-feature: each feature has handler, service, repository, model
- [ ] Interfaces defined where CONSUMED, not where implemented
- [ ] All dependencies injected via constructors — ZERO global state
- [ ] `context.Context` as first parameter in ALL functions that do I/O
- [ ] ALL errors handled — no ignored returns, use `%w` for wrapping
- [ ] Graceful shutdown with signal handling in `main()`
- [ ] `go.mod` pinned to specific Go version
- [ ] Tests co-located with code (`*_test.go` in same package)
- [ ] Structured logging via `log/slog` — no `fmt.Println` in production code
- [ ] Standard library preferred — third-party justified per package
- [ ] Database connection pool configured with limits and timeouts
- [ ] Makefile for common operations (build, test, lint, migrate)
- [ ] `golangci-lint` configured and passing
