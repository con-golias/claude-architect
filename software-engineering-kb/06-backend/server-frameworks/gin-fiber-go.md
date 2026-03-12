# Gin & Fiber — Go Server Frameworks

> **AI Plugin Directive — Gin & Fiber Production Patterns for Go**
> You are an AI coding assistant. When generating, reviewing, or refactoring Gin or Fiber
> Go applications, follow EVERY rule in this document. Go web services require disciplined
> error handling, context propagation, and interface-based design. Treat each section as non-negotiable.

**Core Rule: ALWAYS propagate context.Context through the call chain. ALWAYS handle errors explicitly (never ignore returned errors). ALWAYS use structured logging (slog). ALWAYS implement graceful shutdown with connection draining. ALWAYS use interfaces for dependencies (testability). NEVER use global state or init() for application dependencies.**

---

## 1. Gin vs Fiber Decision

```
┌──────────────────────────────────────────────────────────────┐
│              Gin vs Fiber vs net/http                         │
│                                                               │
│  net/http (stdlib):                                          │
│  ├── Zero dependencies                                      │
│  ├── Maximum control                                        │
│  ├── Pairs with chi or gorilla/mux for routing             │
│  └── Best for: libraries, simple services, maximum control  │
│                                                               │
│  Gin:                                                        │
│  ├── Most popular Go web framework                          │
│  ├── Fast (radix tree router)                               │
│  ├── net/http compatible (standard interfaces)              │
│  ├── Rich middleware ecosystem                              │
│  └── Best for: production APIs, teams new to Go             │
│                                                               │
│  Fiber:                                                      │
│  ├── Express-inspired API (familiar to Node devs)           │
│  ├── Built on fasthttp (NOT net/http compatible)            │
│  ├── Slightly faster than Gin in benchmarks                 │
│  ├── Some net/http middleware won't work                    │
│  └── Best for: Node.js devs transitioning to Go            │
│                                                               │
│  Recommendation:                                             │
│  ├── Default choice: Gin (net/http compatible, largest community) │
│  ├── Maximum control: net/http + chi                        │
│  └── Node.js team: Fiber (familiar API)                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Gin — Production Setup

```go
package main

import (
    "context"
    "errors"
    "log/slog"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/gin-gonic/gin"
)

func main() {
    // Structured logging
    logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelInfo,
    }))
    slog.SetDefault(logger)

    // Dependencies
    cfg := config.Load()
    db, err := database.Connect(cfg.DatabaseURL)
    if err != nil {
        slog.Error("failed to connect to database", "error", err)
        os.Exit(1)
    }
    defer db.Close()

    redisClient := redis.NewClient(cfg.RedisURL)
    defer redisClient.Close()

    // Gin setup
    if cfg.Env == "production" {
        gin.SetMode(gin.ReleaseMode)
    }

    router := gin.New() // Don't use gin.Default() — configure middleware explicitly

    // --- Middleware (order matters) ---
    router.Use(
        RequestIDMiddleware(),         // 1. Request ID
        LoggingMiddleware(logger),     // 2. Structured logging
        RecoveryMiddleware(logger),    // 3. Panic recovery
        CORSMiddleware(cfg.AllowedOrigins), // 4. CORS
        SecurityHeadersMiddleware(),   // 5. Security headers
    )

    // --- Dependency injection via handler structs ---
    userRepo := repository.NewUserRepo(db)
    userService := service.NewUserService(userRepo)
    userHandler := handler.NewUserHandler(userService)

    // --- Routes ---
    api := router.Group("/api")
    {
        api.Use(AuthMiddleware(cfg.JWTSecret))

        users := api.Group("/users")
        {
            users.GET("", userHandler.List)
            users.GET("/:id", userHandler.GetByID)
            users.POST("", userHandler.Create)
            users.PUT("/:id", userHandler.Update)
            users.DELETE("/:id", userHandler.Delete)
        }
    }

    // Health check (no auth)
    router.GET("/health", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
            "status": "ok",
            "uptime": time.Since(startTime).String(),
        })
    })

    // --- Server with graceful shutdown ---
    srv := &http.Server{
        Addr:         ":" + cfg.Port,
        Handler:      router,
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 15 * time.Second,
        IdleTimeout:  60 * time.Second,
    }

    go func() {
        slog.Info("server starting", "port", cfg.Port)
        if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
            slog.Error("server error", "error", err)
            os.Exit(1)
        }
    }()

    // Graceful shutdown
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    sig := <-quit
    slog.Info("shutdown signal received", "signal", sig)

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    if err := srv.Shutdown(ctx); err != nil {
        slog.Error("forced shutdown", "error", err)
    }

    slog.Info("server stopped")
}
```

---

## 3. Gin — Handler Pattern

```go
// handler/user.go
type UserHandler struct {
    service service.UserService // Interface, not concrete type
}

func NewUserHandler(service service.UserService) *UserHandler {
    return &UserHandler{service: service}
}

func (h *UserHandler) List(c *gin.Context) {
    var query struct {
        Page  int `form:"page" binding:"min=1"`
        Limit int `form:"limit" binding:"min=1,max=100"`
    }
    if err := c.ShouldBindQuery(&query); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_params", "details": err.Error()})
        return
    }
    if query.Page == 0 { query.Page = 1 }
    if query.Limit == 0 { query.Limit = 20 }

    result, err := h.service.List(c.Request.Context(), query.Page, query.Limit)
    if err != nil {
        handleError(c, err)
        return
    }

    c.JSON(http.StatusOK, result)
}

func (h *UserHandler) GetByID(c *gin.Context) {
    id := c.Param("id")
    if !isValidUUID(id) {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
        return
    }

    user, err := h.service.GetByID(c.Request.Context(), id)
    if err != nil {
        handleError(c, err)
        return
    }

    c.JSON(http.StatusOK, user)
}

func (h *UserHandler) Create(c *gin.Context) {
    var input dto.CreateUserInput
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "details": err.Error()})
        return
    }

    user, err := h.service.Create(c.Request.Context(), input)
    if err != nil {
        handleError(c, err)
        return
    }

    c.JSON(http.StatusCreated, user)
}

// Centralized error handling
func handleError(c *gin.Context, err error) {
    var appErr *apperror.AppError
    if errors.As(err, &appErr) {
        c.JSON(appErr.StatusCode, gin.H{
            "error":   appErr.Code,
            "message": appErr.Message,
        })
        return
    }

    slog.ErrorContext(c.Request.Context(), "unhandled error",
        "error", err,
        "path", c.Request.URL.Path,
        "method", c.Request.Method,
    )
    c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_server_error"})
}
```

---

## 4. Gin — Middleware Patterns

```go
// Request ID
func RequestIDMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        requestID := c.GetHeader("X-Request-ID")
        if requestID == "" {
            requestID = uuid.New().String()
        }
        c.Set("request_id", requestID)
        c.Header("X-Request-ID", requestID)

        // Add to context for downstream services
        ctx := context.WithValue(c.Request.Context(), ctxKeyRequestID, requestID)
        c.Request = c.Request.WithContext(ctx)

        c.Next()
    }
}

// Structured logging
func LoggingMiddleware(logger *slog.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        c.Next()
        duration := time.Since(start)

        level := slog.LevelInfo
        if c.Writer.Status() >= 500 {
            level = slog.LevelError
        } else if c.Writer.Status() >= 400 {
            level = slog.LevelWarn
        }

        logger.LogAttrs(c.Request.Context(), level, "request",
            slog.String("method", c.Request.Method),
            slog.String("path", c.Request.URL.Path),
            slog.Int("status", c.Writer.Status()),
            slog.Duration("duration", duration),
            slog.String("ip", c.ClientIP()),
            slog.String("request_id", c.GetString("request_id")),
            slog.Int("body_size", c.Writer.Size()),
        )
    }
}

// Panic recovery
func RecoveryMiddleware(logger *slog.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        defer func() {
            if r := recover(); r != nil {
                logger.Error("panic recovered",
                    "panic", r,
                    "path", c.Request.URL.Path,
                    "stack", string(debug.Stack()),
                )
                c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
                    "error": "internal_server_error",
                })
            }
        }()
        c.Next()
    }
}

// Auth middleware
func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        token := extractBearerToken(c.GetHeader("Authorization"))
        if token == "" {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_token"})
            return
        }

        claims, err := jwt.ValidateToken(token, jwtSecret)
        if err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid_token"})
            return
        }

        // Set user context
        c.Set("user_id", claims.UserID)
        c.Set("user_role", claims.Role)
        ctx := context.WithValue(c.Request.Context(), ctxKeyUserID, claims.UserID)
        c.Request = c.Request.WithContext(ctx)

        c.Next()
    }
}

// Rate limiting per user
func RateLimitMiddleware(limiter *rate.Limiter) gin.HandlerFunc {
    limiters := sync.Map{}

    return func(c *gin.Context) {
        key := c.ClientIP()
        if userID, exists := c.Get("user_id"); exists {
            key = userID.(string)
        }

        val, _ := limiters.LoadOrStore(key, rate.NewLimiter(rate.Every(time.Second), 100))
        lim := val.(*rate.Limiter)

        if !lim.Allow() {
            c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
                "error": "rate_limit_exceeded",
                "retry_after": 1,
            })
            return
        }
        c.Next()
    }
}
```

---

## 5. Service & Repository Pattern

```go
// service/user.go — Business logic (interface-based)
type UserService interface {
    List(ctx context.Context, page, limit int) (*PaginatedResult[dto.UserResponse], error)
    GetByID(ctx context.Context, id string) (*dto.UserResponse, error)
    Create(ctx context.Context, input dto.CreateUserInput) (*dto.UserResponse, error)
    Update(ctx context.Context, id string, input dto.UpdateUserInput) (*dto.UserResponse, error)
    Delete(ctx context.Context, id string) error
}

type userService struct {
    repo   repository.UserRepository
    hasher password.Hasher
}

func NewUserService(repo repository.UserRepository, hasher password.Hasher) UserService {
    return &userService{repo: repo, hasher: hasher}
}

func (s *userService) Create(ctx context.Context, input dto.CreateUserInput) (*dto.UserResponse, error) {
    // Business validation
    existing, err := s.repo.FindByEmail(ctx, input.Email)
    if err != nil {
        return nil, fmt.Errorf("check existing: %w", err)
    }
    if existing != nil {
        return nil, apperror.New(http.StatusConflict, "email_taken", "Email already in use")
    }

    hash, err := s.hasher.Hash(input.Password)
    if err != nil {
        return nil, fmt.Errorf("hash password: %w", err)
    }

    user, err := s.repo.Create(ctx, model.User{
        Name:         input.Name,
        Email:        input.Email,
        PasswordHash: hash,
        Role:         "user",
    })
    if err != nil {
        return nil, fmt.Errorf("create user: %w", err)
    }

    return dto.ToUserResponse(user), nil
}

// repository/user.go — Data access (interface-based)
type UserRepository interface {
    FindByID(ctx context.Context, id string) (*model.User, error)
    FindByEmail(ctx context.Context, email string) (*model.User, error)
    FindAll(ctx context.Context, page, limit int) ([]model.User, int, error)
    Create(ctx context.Context, user model.User) (*model.User, error)
    Update(ctx context.Context, id string, user model.User) (*model.User, error)
    Delete(ctx context.Context, id string) error
}

type pgUserRepo struct {
    db *sql.DB
}

func NewUserRepo(db *sql.DB) UserRepository {
    return &pgUserRepo{db: db}
}

func (r *pgUserRepo) FindByID(ctx context.Context, id string) (*model.User, error) {
    var user model.User
    err := r.db.QueryRowContext(ctx,
        "SELECT id, name, email, role, created_at FROM users WHERE id = $1", id,
    ).Scan(&user.ID, &user.Name, &user.Email, &user.Role, &user.CreatedAt)

    if errors.Is(err, sql.ErrNoRows) {
        return nil, apperror.New(http.StatusNotFound, "not_found", "User not found")
    }
    if err != nil {
        return nil, fmt.Errorf("query user: %w", err)
    }
    return &user, nil
}

func (r *pgUserRepo) FindAll(ctx context.Context, page, limit int) ([]model.User, int, error) {
    offset := (page - 1) * limit

    // Count total
    var total int
    if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&total); err != nil {
        return nil, 0, fmt.Errorf("count users: %w", err)
    }

    rows, err := r.db.QueryContext(ctx,
        "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        limit, offset,
    )
    if err != nil {
        return nil, 0, fmt.Errorf("query users: %w", err)
    }
    defer rows.Close()

    var users []model.User
    for rows.Next() {
        var u model.User
        if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.CreatedAt); err != nil {
            return nil, 0, fmt.Errorf("scan user: %w", err)
        }
        users = append(users, u)
    }
    return users, total, rows.Err()
}
```

---

## 6. Testing Pattern

```go
// handler_test.go — HTTP handler tests
func TestUserHandler_List(t *testing.T) {
    // Mock service
    mockService := &mockUserService{
        listFn: func(ctx context.Context, page, limit int) (*PaginatedResult[dto.UserResponse], error) {
            return &PaginatedResult[dto.UserResponse]{
                Data:  []dto.UserResponse{{ID: "1", Name: "Test"}},
                Total: 1,
            }, nil
        },
    }

    handler := NewUserHandler(mockService)
    router := gin.New()
    router.GET("/api/users", handler.List)

    req := httptest.NewRequest(http.MethodGet, "/api/users?page=1&limit=10", nil)
    w := httptest.NewRecorder()

    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)

    var result PaginatedResult[dto.UserResponse]
    err := json.Unmarshal(w.Body.Bytes(), &result)
    assert.NoError(t, err)
    assert.Equal(t, 1, result.Total)
    assert.Equal(t, "Test", result.Data[0].Name)
}

// Integration test with test database
func TestUserRepo_Create(t *testing.T) {
    db := testutil.SetupTestDB(t)
    repo := NewUserRepo(db)

    user, err := repo.Create(context.Background(), model.User{
        Name:         "Test User",
        Email:        "test@example.com",
        PasswordHash: "hashed",
        Role:         "user",
    })

    require.NoError(t, err)
    assert.NotEmpty(t, user.ID)
    assert.Equal(t, "Test User", user.Name)
}
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Using `gin.Default()` without understanding middleware | Default logger/recovery may not match requirements | Use `gin.New()` + explicit middleware |
| Ignoring returned errors | Silent failures, data corruption | Handle EVERY returned error (`if err != nil`) |
| Global variables for dependencies | Untestable, hidden coupling | Dependency injection via constructor |
| Not propagating context | Lost deadlines, cancellation doesn't work | Pass `c.Request.Context()` to all service calls |
| `panic` for error handling | Crashes the service | Return errors, reserve panic for truly unrecoverable states |
| Not using interfaces for services | Cannot mock for testing | Define interfaces, inject implementations |
| Fat handlers (business logic in handler) | Untestable business logic | Handler → Service → Repository layers |
| Not closing `rows` from database queries | Connection leaks | `defer rows.Close()` immediately after query |
| Using `init()` for dependency setup | Hidden initialization order, testing issues | Explicit initialization in `main()` |
| No request timeout | Slow requests consume resources indefinitely | `http.Server{ReadTimeout, WriteTimeout}` |

---

## 8. Enforcement Checklist

- [ ] Context propagated through all layers (handler → service → repository)
- [ ] All errors handled explicitly (no ignored return values)
- [ ] Structured logging with slog (JSON to stdout)
- [ ] Graceful shutdown with SIGTERM/SIGINT handling and 30s drain
- [ ] HTTP server timeouts configured (read, write, idle)
- [ ] Dependencies injected via constructors (no global state)
- [ ] Interfaces used for all service and repository dependencies
- [ ] Request validation using binding tags or custom validators
- [ ] Panic recovery middleware configured
- [ ] Request ID middleware for tracing
- [ ] Health check endpoint at /health
- [ ] Database connection pool configured with limits
- [ ] `defer rows.Close()` on all database query results
- [ ] Rate limiting middleware configured
- [ ] Tests use httptest + mock services (no real dependencies)
