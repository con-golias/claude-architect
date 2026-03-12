# Go Coding Standards

| Property     | Value                                                                |
|-------------|----------------------------------------------------------------------|
| Domain      | Code Quality > Standards                                             |
| Importance  | Critical                                                             |
| Languages   | Go 1.22–1.23+                                                        |
| Cross-ref   | [Language-Specific Linters](../linting-formatting/language-specific-linters.md), [Type Checking](../static-analysis/type-checking.md) |

---

## Core Concepts

### Naming Conventions

```go
// ❌ BAD: Java/Python naming habits in Go
type IUserService interface { ... }  // No "I" prefix for interfaces
func GetAllUsersByStatus(s string) {} // Verbose — stutters with package name
var userList []User                   // Don't suffix with type

// ✅ GOOD: Idiomatic Go naming
type UserService interface { ... }    // No prefix
func ByStatus(s string) []User {}    // user.ByStatus() reads naturally
var users []User                     // Plural noun for slices

// Short names in small scopes, descriptive names in large scopes
for i, u := range users { ... }      // OK: i, u in tight loop
func (s *Server) handleRequest(w http.ResponseWriter, r *http.Request) { ... }

// Exported = PascalCase, unexported = camelCase
type Config struct {               // Exported
    maxRetries int                 // Unexported field
}

// Acronyms: all caps — URL, HTTP, ID (not Url, Http, Id)
func ServeHTTP(w http.ResponseWriter, r *http.Request) {}
type UserID string
```

**Package naming: short, lowercase, no underscores, no plurals:**

```go
// ❌ BAD
package string_utils   // No underscores
package models         // Avoid meaningless plurals
package common         // Too vague

// ✅ GOOD
package stringutil
package user           // Singular — represents the domain
package auth
```

### Error Handling

```go
// ❌ BAD: Ignoring errors
data, _ := json.Marshal(user)

// ✅ GOOD: Wrap errors with context using fmt.Errorf %w
func GetUser(id string) (*User, error) {
    row := db.QueryRow("SELECT ... WHERE id = $1", id)
    var u User
    if err := row.Scan(&u.Name, &u.Email); err != nil {
        return nil, fmt.Errorf("get user %s: %w", id, err)
    }
    return &u, nil
}

// ✅ GOOD: Sentinel errors + errors.Is for expected conditions
var ErrNotFound = errors.New("not found")

func FindUser(id string) (*User, error) {
    u, err := repo.Get(id)
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return nil, fmt.Errorf("find user %s: %w", id, ErrNotFound)
        }
        return nil, fmt.Errorf("find user %s: %w", id, err)
    }
    return u, nil
}

// ✅ GOOD: Custom error types + errors.As for rich error info
type ValidationError struct{ Field, Message string }
func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation: %s — %s", e.Field, e.Message)
}
var ve *ValidationError
if errors.As(err, &ve) {
    respondJSON(w, 422, map[string]string{"field": ve.Field, "error": ve.Message})
}
```

### Interface Design

```go
// ❌ BAD: Large interfaces — hard to mock, hard to implement
type UserService interface {
    Create(User) error
    Update(User) error
    Delete(string) error
    GetByID(string) (*User, error)
    GetByEmail(string) (*User, error)
    List(Filter) ([]User, error)
    Count(Filter) (int, error)
}

// ✅ GOOD: Small, focused interfaces (1-3 methods)
type UserReader interface {
    GetByID(ctx context.Context, id string) (*User, error)
}

type UserWriter interface {
    Save(ctx context.Context, user *User) error
}

// Compose when needed
type UserStore interface {
    UserReader
    UserWriter
}
```

**Accept interfaces, return structs:**

```go
// ❌ BAD: Return interface — hides concrete type, prevents extension
func NewUserService() UserServiceInterface { return &userService{} }

// ✅ GOOD: Return concrete struct, accept interface parameters
func NewUserService(repo UserReader, logger *slog.Logger) *UserService {
    return &UserService{repo: repo, logger: logger}
}

// io.Reader / io.Writer — the gold standard
func ProcessData(r io.Reader) error {
    // Works with *os.File, *bytes.Buffer, *http.Request.Body, net.Conn...
    data, err := io.ReadAll(r)
    // ...
}
```

### Struct Design — Functional Options Pattern

```go
// ❌ BAD: Exported struct with many fields — unclear which are required
srv := &Server{Host: "localhost", Port: 8080, TLS: true, ReadTimeout: 5 * time.Second}

// ✅ GOOD: Constructor with functional options
type ServerOption func(*Server)

func WithTLS(cert, key string) ServerOption {
    return func(s *Server) { s.certFile = cert; s.keyFile = key }
}
func WithTimeouts(read, write time.Duration) ServerOption {
    return func(s *Server) { s.readTimeout = read; s.writeTimeout = write }
}

func NewServer(host string, port int, opts ...ServerOption) (*Server, error) {
    if host == "" { return nil, errors.New("host is required") }
    s := &Server{host: host, port: port, readTimeout: 30 * time.Second}
    for _, opt := range opts { opt(s) }
    return s, nil
}

// Usage
srv, err := NewServer("0.0.0.0", 8080,
    WithTLS("cert.pem", "key.pem"),
    WithTimeouts(10*time.Second, 30*time.Second),
)
```

### Goroutines, Channels, and Context

```go
// ❌ BAD: Goroutine leak — no way to cancel
go func() {
    for {
        data := <-ch
        process(data)
    }
}()

// ✅ GOOD: Context-controlled goroutine lifecycle
func worker(ctx context.Context, ch <-chan Job) {
    for {
        select {
        case <-ctx.Done():
            return
        case job, ok := <-ch:
            if !ok {
                return // Channel closed
            }
            process(job)
        }
    }
}

// ✅ GOOD: errgroup for concurrent work with error propagation
func FetchAll(ctx context.Context, urls []string) ([]Response, error) {
    g, ctx := errgroup.WithContext(ctx) // golang.org/x/sync/errgroup
    results := make([]Response, len(urls))
    for i, url := range urls {
        g.Go(func() error {
            resp, err := fetch(ctx, url)
            if err != nil { return fmt.Errorf("fetch %s: %w", url, err) }
            results[i] = resp // Safe: unique index per goroutine
            return nil
        })
    }
    if err := g.Wait(); err != nil { return nil, err }
    return results, nil
}

// Channel directions — always specify in function signatures
func producer(out chan<- int) { ... }  // Send only
func consumer(in <-chan int)  { ... }  // Receive only
```

### Table-Driven Tests

```go
func TestParse(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    int
        wantErr bool
    }{
        {"positive", "42", 42, false},
        {"negative", "-7", -7, false},
        {"zero", "0", 0, false},
        {"invalid", "abc", 0, true},
        {"overflow", "99999999999999999999", 0, true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := Parse(tt.input)
            if tt.wantErr {
                if err == nil { t.Fatal("expected error, got nil") }
                return
            }
            if err != nil { t.Fatalf("unexpected error: %v", err) }
            if got != tt.want { t.Errorf("Parse(%q) = %d, want %d", tt.input, got, tt.want) }
        })
    }
}
```

### Go Project Layout

```
# Prefer flat layout until complexity demands structure. Layered:
cmd/api/main.go          # Entrypoints
cmd/worker/main.go
internal/user/            # Cannot be imported by other modules
  handler.go, service.go, store.go, store_test.go
internal/order/
pkg/                      # Public library code (use sparingly)
```

**Rules: avoid `models/`, `utils/`, `helpers/` packages.** Organize by domain, not layer.

### Defer, Panic, Recover

```go
// ✅ GOOD: Defer for cleanup — executes in LIFO order
func ReadFile(path string) ([]byte, error) {
    f, err := os.Open(path)
    if err != nil { return nil, err }
    defer f.Close()
    return io.ReadAll(f)
}

// ✅ GOOD: Defer with error capture (named return)
func WriteFile(path string, data []byte) (retErr error) {
    f, err := os.Create(path)
    if err != nil { return err }
    defer func() {
        if closeErr := f.Close(); retErr == nil { retErr = closeErr }
    }()
    _, err = f.Write(data)
    return err
}

// Panic only for invariant violations. Recover only at boundaries (HTTP, main).
func recoverMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if v := recover(); v != nil {
                slog.Error("panic", "error", v, "stack", debug.Stack())
                http.Error(w, "internal error", 500)
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

### Generics — When to Use, When to Avoid

```go
// ✅ GOOD: Generics for collection utilities
func Map[T, U any](s []T, fn func(T) U) []U {
    result := make([]U, len(s))
    for i, v := range s { result[i] = fn(v) }
    return result
}

// ✅ GOOD: Type constraints for numeric operations
type Number interface { ~int | ~int32 | ~int64 | ~float32 | ~float64 }
func Sum[T Number](nums []T) T {
    var total T
    for _, n := range nums { total += n }
    return total
}

// ❌ BAD: Don't use generics when a simple interface works
func BadPrint[T fmt.Stringer](v T) { fmt.Println(v.String()) }
// ✅ GOOD: Just use the interface
func Print(v fmt.Stringer) { fmt.Println(v.String()) }
```

### Structured Logging with slog

```go
// ❌ BAD: Unstructured string logging
log.Printf("user %s created order %s, total: $%.2f", userID, orderID, total)

// ✅ GOOD: slog (stdlib, Go 1.21+) — structured, leveled, JSON output
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
logger.Info("order created",
    slog.String("user_id", userID),
    slog.String("order_id", orderID),
    slog.Float64("total", total),
) // {"level":"INFO","msg":"order created","user_id":"u1","order_id":"o1","total":42.50}

// Context-scoped fields
func withRequestID(logger *slog.Logger, reqID string) *slog.Logger {
    return logger.With(slog.String("request_id", reqID))
}
```

### Go 1.22–1.23 Features

```go
// Range over int (Go 1.22) — no more i := 0; i < n; i++
// ❌ BAD
for i := 0; i < 10; i++ {
    fmt.Println(i)
}
// ✅ GOOD
for i := range 10 {
    fmt.Println(i) // 0..9
}

// Loop variable fix (Go 1.22) — each iteration gets its own variable
for _, v := range values {
    go func() {
        process(v) // Safe in Go 1.22+ — v is per-iteration
    }()
}

// Iterator pattern (Go 1.23) — range over func
func (s *Store) All() iter.Seq2[string, *User] {
    return func(yield func(string, *User) bool) {
        for id, user := range s.data {
            if !yield(id, user) {
                return
            }
        }
    }
}

// Usage:
for id, user := range store.All() {
    fmt.Printf("%s: %s\n", id, user.Name)
}
```

### golangci-lint Configuration

```yaml
# .golangci.yml — essential linters
linters:
  enable:
    - errcheck       # Unchecked errors
    - govet          # Suspicious constructs
    - staticcheck    # Advanced static analysis
    - gocritic       # Opinionated style (diagnostic, style, performance tags)
    - revive         # Extensible linter (replaces golint)
    - errname        # Error naming (ErrFoo)
    - exhaustive     # Exhaustive switch/map
    - noctx          # HTTP requests without context
    - bodyclose      # Unclosed HTTP response bodies
    - nilnil         # (nil, nil) returns
```

---

## Best Practices

| #  | Practice                                                                 |
|----|--------------------------------------------------------------------------|
| 1  | Always handle errors — never use `_` to discard an error                 |
| 2  | Wrap errors with `fmt.Errorf("context: %w", err)` at every layer        |
| 3  | Keep interfaces small (1-3 methods); define them near the consumer       |
| 4  | Accept interfaces, return concrete structs                               |
| 5  | Use functional options for constructors with more than 3 config params   |
| 6  | Always pass `context.Context` as the first parameter                     |
| 7  | Use `errgroup` for concurrent operations; never launch untracked goroutines |
| 8  | Organize packages by domain, not by technical layer                      |
| 9  | Use table-driven tests with `t.Run` for all test cases                   |
| 10 | Use `slog` for structured logging; include request context fields        |

---

## Anti-Patterns

| #  | Anti-Pattern                    | Problem                                       | Fix                                        |
|----|--------------------------------|-----------------------------------------------|--------------------------------------------|
| 1  | Discarding errors with `_`     | Silent failures, data corruption               | Handle or explicitly log every error       |
| 2  | `init()` functions             | Hidden side effects, test difficulty            | Explicit initialization in `main()`        |
| 3  | Package-level mutable state    | Data races, test pollution                     | Inject dependencies via constructor        |
| 4  | `interface{}` / `any` overuse  | Loses type safety, runtime panics              | Use generics or specific interfaces        |
| 5  | Goroutine without cancellation | Goroutine leak, resource exhaustion            | Always accept `context.Context`            |
| 6  | `panic` for error handling     | Crashes the process                            | Return `error`; panic only for invariants  |
| 7  | `utils` / `helpers` packages   | Grab-bag with no cohesion                      | Move functions to domain packages          |
| 8  | `sync.Mutex` in exported API   | Callers can't control locking granularity      | Use channels or unexported mutex           |

---

## Enforcement Checklist

- [ ] `golangci-lint run` passes in CI with zero issues
- [ ] All exported functions/types have doc comments
- [ ] `go vet` and `staticcheck` run as part of CI
- [ ] Error wrapping uses `%w` verb consistently
- [ ] All goroutines are tracked (errgroup, WaitGroup, or context cancellation)
- [ ] `context.Context` is the first parameter of all IO/network functions
- [ ] No `init()` functions outside of `main` package
- [ ] Table-driven tests cover happy path, edge cases, and error cases
- [ ] `internal/` package used to prevent unintended API exposure
- [ ] `go mod tidy` runs in CI — no unused or missing dependencies
