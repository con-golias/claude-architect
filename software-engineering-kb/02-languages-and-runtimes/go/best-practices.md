# Go: Best Practices

> **Domain:** Languages > Go
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03

## Error Handling

### The Go Error Philosophy

Go treats errors as values, not exceptions. Every function that can fail returns an error.

```go
// Basic pattern: check every error
result, err := doSomething()
if err != nil {
    return fmt.Errorf("doing something: %w", err) // Wrap with context
}

// Error wrapping (Go 1.13+)
func readConfig(path string) (*Config, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("reading config %s: %w", path, err)
        // Wrapping preserves the original error for errors.Is/As
    }
    var cfg Config
    if err := json.Unmarshal(data, &cfg); err != nil {
        return nil, fmt.Errorf("parsing config: %w", err)
    }
    return &cfg, nil
}

// Checking wrapped errors
if errors.Is(err, os.ErrNotExist) {
    // Handle file not found
}

var pathErr *os.PathError
if errors.As(err, &pathErr) {
    fmt.Println("failed path:", pathErr.Path)
}
```

### Custom Error Types

```go
// Sentinel errors — for known, fixed error conditions
var (
    ErrNotFound     = errors.New("not found")
    ErrUnauthorized = errors.New("unauthorized")
    ErrConflict     = errors.New("conflict")
)

// Custom error types — for errors carrying data
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation error: %s: %s", e.Field, e.Message)
}

// Usage
func validateAge(age int) error {
    if age < 0 || age > 150 {
        return &ValidationError{Field: "age", Message: "must be 0-150"}
    }
    return nil
}
```

## Interface Design

### Accept Interfaces, Return Structs

```go
// GOOD: Accept the narrowest interface you need
func ProcessData(r io.Reader) error {
    data, err := io.ReadAll(r)
    // Works with *os.File, *bytes.Buffer, *http.Response.Body, etc.
}

// GOOD: Return concrete types
func NewServer(addr string) *Server {
    return &Server{addr: addr}
}

// BAD: Returning an interface hides information
func NewServer(addr string) ServerInterface { // Don't do this
    return &Server{addr: addr}
}
```

### Small Interfaces

```go
// Go stdlib example: io.Reader is just one method
type Reader interface {
    Read(p []byte) (n int, err error)
}

// Compose larger interfaces from small ones
type ReadWriter interface {
    Reader
    Writer
}

// Interface segregation — don't require more than you need
// BAD:
type Store interface {
    Get(id string) (*User, error)
    List() ([]*User, error)
    Create(u *User) error
    Update(u *User) error
    Delete(id string) error
}
func PrintUser(store Store, id string) // Only needs Get!

// GOOD:
type UserGetter interface {
    Get(id string) (*User, error)
}
func PrintUser(getter UserGetter, id string) // Much better
```

## Concurrency Patterns

### Worker Pool

```go
func WorkerPool(jobs <-chan Job, results chan<- Result, numWorkers int) {
    var wg sync.WaitGroup
    for i := 0; i < numWorkers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for job := range jobs {
                results <- process(job)
            }
        }()
    }
    wg.Wait()
    close(results)
}
```

### Fan-Out / Fan-In

```go
func FanOut(input <-chan int, workers int) []<-chan int {
    channels := make([]<-chan int, workers)
    for i := 0; i < workers; i++ {
        channels[i] = worker(input)
    }
    return channels
}

func FanIn(channels ...<-chan int) <-chan int {
    var wg sync.WaitGroup
    merged := make(chan int)
    for _, ch := range channels {
        wg.Add(1)
        go func(c <-chan int) {
            defer wg.Done()
            for v := range c {
                merged <- v
            }
        }(ch)
    }
    go func() { wg.Wait(); close(merged) }()
    return merged
}
```

### errgroup — Structured Error Handling for Goroutines

```go
import "golang.org/x/sync/errgroup"

func fetchAll(ctx context.Context, urls []string) ([]string, error) {
    g, ctx := errgroup.WithContext(ctx)
    results := make([]string, len(urls))

    for i, url := range urls {
        g.Go(func() error {
            resp, err := http.Get(url)
            if err != nil {
                return err
            }
            defer resp.Body.Close()
            body, err := io.ReadAll(resp.Body)
            results[i] = string(body) // Safe: each goroutine writes to unique index
            return err
        })
    }

    if err := g.Wait(); err != nil {
        return nil, err // Returns first error, cancels context for others
    }
    return results, nil
}
```

## Context Usage

```go
// Context carries deadlines, cancellation, and values
func HandleRequest(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context() // Already has deadline from server

    // Add timeout
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel() // ALWAYS defer cancel

    result, err := fetchFromDB(ctx)
    if err != nil {
        if ctx.Err() == context.DeadlineExceeded {
            http.Error(w, "request timed out", http.StatusGatewayTimeout)
            return
        }
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    json.NewEncoder(w).Encode(result)
}

// Pass context as first parameter (convention)
func fetchFromDB(ctx context.Context) (*Result, error) {
    return db.QueryContext(ctx, "SELECT ...")
}

// DO NOT store context in structs
// DO NOT use context.Value for passing function parameters
// DO use context.Value only for request-scoped data (trace ID, auth)
```

## Project Layout

```
myapp/
├── cmd/
│   ├── api/
│   │   └── main.go           # API server entrypoint
│   └── worker/
│       └── main.go           # Background worker entrypoint
├── internal/                  # Private packages (enforced by compiler)
│   ├── auth/
│   │   ├── auth.go
│   │   └── auth_test.go
│   ├── user/
│   │   ├── handler.go        # HTTP handlers
│   │   ├── service.go        # Business logic
│   │   ├── repository.go     # Database access
│   │   └── user_test.go
│   └── platform/
│       ├── database/
│       │   └── postgres.go
│       └── logger/
│           └── logger.go
├── pkg/                       # Public packages (importable by others)
│   └── middleware/
│       └── auth.go
├── api/                       # API definitions (OpenAPI, protobuf)
│   └── openapi.yaml
├── go.mod
├── go.sum
└── Makefile
```

## Testing Patterns

### Table-Driven Tests

```go
func TestAdd(t *testing.T) {
    tests := []struct {
        name string
        a, b int
        want int
    }{
        {"positive", 2, 3, 5},
        {"negative", -1, -2, -3},
        {"zero", 0, 0, 0},
        {"mixed", -1, 5, 4},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := Add(tt.a, tt.b)
            if got != tt.want {
                t.Errorf("Add(%d, %d) = %d, want %d", tt.a, tt.b, got, tt.want)
            }
        })
    }
}
```

### Benchmarks

```go
func BenchmarkSort(b *testing.B) {
    data := generateData(1000)
    b.ResetTimer()

    for b.Loop() { // Go 1.24+ (replaces for i := 0; i < b.N; i++)
        sort.Ints(slices.Clone(data))
    }
}
// Run: go test -bench=. -benchmem
```

### Fuzzing (Go 1.18+)

```go
func FuzzParseJSON(f *testing.F) {
    f.Add([]byte(`{"name": "test"}`))
    f.Add([]byte(`{}`))

    f.Fuzz(func(t *testing.T, data []byte) {
        var result map[string]any
        if err := json.Unmarshal(data, &result); err != nil {
            return // Invalid JSON is OK, just don't crash
        }
        // If Unmarshal succeeds, Marshal should too
        _, err := json.Marshal(result)
        if err != nil {
            t.Fatalf("Marshal failed after successful Unmarshal: %v", err)
        }
    })
}
```

## Code Quality Tools

| Tool | Type | Purpose |
|------|------|---------|
| `go fmt` | Formatter | Canonical formatting |
| `go vet` | Static analysis | Common bugs |
| **golangci-lint** | Meta-linter | Runs 100+ linters in parallel |
| **staticcheck** | Static analysis | Bugs, simplifications, style |
| **govulncheck** | Vulnerability scanner | Known CVEs in dependencies |
| **deadcode** | Dead code finder | Find unreachable functions |

```bash
# golangci-lint — most important external tool
golangci-lint run ./...

# Recommended .golangci.yml linters:
# errcheck, govet, staticcheck, unused, gosimple,
# ineffassign, typecheck, misspell, revive, gocritic
```

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Better Alternative |
|-------------|-------------|-------------------|
| `_ = err` | Silently ignoring errors | Handle or wrap the error |
| `interface{}` everywhere | No type safety | Use generics (Go 1.18+) |
| `init()` functions | Hidden side effects, testing difficulty | Explicit initialization |
| Goroutine without lifecycle | Goroutine leaks | errgroup, context cancellation |
| Large interfaces | Hard to test, tight coupling | Small, focused interfaces |
| Global state / singletons | Testing difficulty | Dependency injection |
| `sync.Mutex` for everything | Channels may be simpler | Use channels for communication |
| Premature abstraction | Over-engineering | YAGNI — wait until you need it |

## Sources

- [Effective Go](https://go.dev/doc/effective_go) — Idiomatic Go
- [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments) — Style guide
- [Go Proverbs](https://go-proverbs.github.io/) — Design philosophy
- [Style Guide (Google)](https://google.github.io/styleguide/go/) — Google's Go style guide
- [Standard Go Project Layout](https://github.com/golang-standards/project-layout)
- [Uber Go Style Guide](https://github.com/uber-go/guide/blob/master/style.md)
