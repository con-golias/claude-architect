# Go Module Structure

> **AI Plugin Directive:** When generating a Go library or module for public/internal distribution, ALWAYS use this structure. Apply the standard Go project layout with `internal/`, proper module paths, and idiomatic Go conventions. This guide covers Go modules published to pkg.go.dev or used internally.

**Core Rule: Follow Go conventions — flat packages, `internal/` for private code, `cmd/` only for executables. Use `go.mod` with semantic import versioning. NEVER create deeply nested package hierarchies. Go is NOT Java — packages are small, focused, and named by what they PROVIDE, not what they contain.**

---

## 1. Module Structure (Library)

```
go-utils/                                  # Module root = repo root
├── go.mod                                 # Module definition
├── go.sum                                 # Dependency checksums (committed)
├── LICENSE
├── README.md
├── CHANGELOG.md
├── Makefile
│
├── *.go                                   # Root package = primary API
│   ├── doc.go                             # Package-level documentation
│   ├── client.go                          # Primary types and functions
│   ├── options.go                         # Functional options pattern
│   ├── errors.go                          # Exported error types
│   └── client_test.go                     # Tests alongside source
│
├── internal/                              # Private — NOT importable externally
│   ├── parser/
│   │   ├── parser.go
│   │   └── parser_test.go
│   ├── transport/
│   │   ├── http.go
│   │   └── grpc.go
│   └── testutil/                          # Shared test utilities
│       └── helpers.go
│
├── middleware/                            # Sub-package (exported)
│   ├── logging.go
│   ├── retry.go
│   └── retry_test.go
│
├── encoding/                             # Sub-package (exported)
│   ├── json.go
│   ├── protobuf.go
│   └── json_test.go
│
├── testdata/                             # Test fixtures (ignored by Go tools)
│   ├── golden_response.json
│   └── config.yaml
│
├── examples/                             # Example programs
│   ├── basic/
│   │   └── main.go
│   └── advanced/
│       └── main.go
│
├── _examples/                            # Alternative: underscore prefix ignored by Go
│
└── .github/
    └── workflows/
        ├── ci.yml
        └── release.yml
```

---

## 2. Module with CLI Tool

```
my-tool/
├── go.mod
├── go.sum
│
├── cmd/                                   # Executable entry points
│   ├── my-tool/
│   │   └── main.go                        # CLI binary
│   └── my-tool-server/
│       └── main.go                        # Server binary
│
├── *.go                                   # Library code (importable)
│   ├── client.go
│   ├── config.go
│   └── types.go
│
├── internal/                              # Private implementation
│   ├── cli/
│   │   ├── root.go
│   │   ├── serve.go
│   │   └── version.go
│   └── server/
│       ├── handler.go
│       ├── middleware.go
│       └── routes.go
│
└── pkg/                                   # ONLY if library AND tool in same repo
    └── api/                               # Public API types for consumers
        ├── types.go
        └── client.go
```

---

## 3. go.mod Configuration

```go
// go.mod
module github.com/myorg/go-utils

go 1.22

require (
    golang.org/x/sync v0.7.0
    google.golang.org/grpc v1.64.0
    google.golang.org/protobuf v1.34.0
)

require (
    // indirect dependencies auto-managed by go mod tidy
    golang.org/x/net v0.26.0 // indirect
    golang.org/x/text v0.16.0 // indirect
)
```

```
Module path rules:
- github.com/myorg/package     ← Standard for v0.x and v1.x
- github.com/myorg/package/v2  ← REQUIRED for v2+ (semantic import versioning)
- internal.company.com/team/pkg ← Private modules (configure GONOSUMDB, GOPRIVATE)

NEVER use vanity import paths unless you commit to maintaining the redirect service.
```

---

## 4. Semantic Import Versioning

```
v0.x.x → Pre-stable, breaking changes allowed
v1.x.x → Stable API, module path: github.com/myorg/pkg
v2.x.x → Module path MUST change: github.com/myorg/pkg/v2

Directory structure for v2+:
Option A (recommended): Major version subdirectory
  my-pkg/
  ├── go.mod          → module github.com/myorg/my-pkg (v1)
  └── v2/
      ├── go.mod      → module github.com/myorg/my-pkg/v2
      └── *.go

Option B: Major version branch
  main branch  → v1.x.x (module github.com/myorg/my-pkg)
  v2 branch    → v2.x.x (module github.com/myorg/my-pkg/v2)

ALWAYS use Option A for active development of multiple major versions.
Use Option B when v1 is in maintenance-only mode.
```

---

## 5. Package Design Rules

```
Go packages are NOT folders — they are APIs.

Naming:
  ✅ package http          ← Named by what it provides
  ✅ package json          ← Short, lowercase, one word
  ✅ package middleware     ← Descriptive purpose
  ❌ package utils          ← Too vague (acceptable ONLY in internal/)
  ❌ package common         ← Meaningless grab-bag
  ❌ package helpers        ← No clear API boundary
  ❌ package models         ← Java-ism, not idiomatic Go

Package size:
  - 1-10 files per package is normal
  - If a package has 20+ files, split by responsibility
  - Single-file packages are fine and encouraged

Export rules:
  - Export ONLY what consumers need
  - Use internal/ for implementation details
  - Unexported types in exported packages are fine
  - Prefer returning concrete types, accept interfaces
```

---

## 6. doc.go — Package Documentation

```go
// doc.go

// Package goutils provides HTTP client utilities with automatic retry,
// circuit breaking, and structured logging.
//
// # Quick Start
//
//	client := goutils.NewClient(
//	    goutils.WithTimeout(10 * time.Second),
//	    goutils.WithRetry(3),
//	)
//	resp, err := client.Get(ctx, "https://api.example.com/data")
//
// # Configuration
//
// Use functional options to configure the client. All options are optional
// and have sensible defaults.
//
// # Error Handling
//
// All errors returned implement the [Error] interface, which provides
// structured error information including HTTP status codes and retry hints.
package goutils
```

---

## 7. Functional Options Pattern

```go
// options.go

// Option configures a Client.
type Option func(*clientConfig)

type clientConfig struct {
    timeout    time.Duration
    retries    int
    baseURL    string
    httpClient *http.Client
    logger     *slog.Logger
}

var defaultConfig = clientConfig{
    timeout: 30 * time.Second,
    retries: 0,
    logger:  slog.Default(),
}

// WithTimeout sets the request timeout. Default: 30s.
func WithTimeout(d time.Duration) Option {
    return func(c *clientConfig) {
        c.timeout = d
    }
}

// WithRetry sets the number of retry attempts. Default: 0 (no retry).
func WithRetry(n int) Option {
    return func(c *clientConfig) {
        c.retries = n
    }
}

// WithHTTPClient sets a custom http.Client. Overrides WithTimeout.
func WithHTTPClient(hc *http.Client) Option {
    return func(c *clientConfig) {
        c.httpClient = hc
    }
}
```

```go
// client.go

// Client is an HTTP client with retry and observability.
type Client struct {
    cfg clientConfig
}

// NewClient creates a Client with the given options.
func NewClient(opts ...Option) *Client {
    cfg := defaultConfig
    for _, opt := range opts {
        opt(&cfg)
    }
    if cfg.httpClient == nil {
        cfg.httpClient = &http.Client{Timeout: cfg.timeout}
    }
    return &Client{cfg: cfg}
}
```

---

## 8. Error Types

```go
// errors.go

// Error represents a structured error from the client.
type Error struct {
    Op         string // Operation that failed
    StatusCode int    // HTTP status code (0 if not HTTP error)
    Err        error  // Underlying error
}

func (e *Error) Error() string {
    if e.StatusCode != 0 {
        return fmt.Sprintf("%s: HTTP %d: %v", e.Op, e.StatusCode, e.Err)
    }
    return fmt.Sprintf("%s: %v", e.Op, e.Err)
}

func (e *Error) Unwrap() error { return e.Err }

// Sentinel errors — use errors.Is() to check.
var (
    ErrTimeout     = errors.New("request timed out")
    ErrRateLimited = errors.New("rate limited")
    ErrNotFound    = errors.New("resource not found")
)

// IsRetryable reports whether the error is worth retrying.
func IsRetryable(err error) bool {
    var e *Error
    if errors.As(err, &e) {
        return e.StatusCode == 429 || e.StatusCode >= 500
    }
    return false
}
```

---

## 9. Testing Patterns

```go
// client_test.go
package goutils_test // External test package — tests the public API

import (
    "testing"
    goutils "github.com/myorg/go-utils"
)

func TestClient_Get(t *testing.T) {
    t.Parallel()

    tests := []struct {
        name       string
        statusCode int
        wantErr    bool
    }{
        {"success", 200, false},
        {"not found", 404, true},
        {"server error", 500, true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()
            srv := newTestServer(t, tt.statusCode)
            client := goutils.NewClient(goutils.WithBaseURL(srv.URL))

            _, err := client.Get(t.Context(), "/test")
            if (err != nil) != tt.wantErr {
                t.Errorf("Get() error = %v, wantErr %v", err, tt.wantErr)
            }
        })
    }
}

func newTestServer(t *testing.T, status int) *httptest.Server {
    t.Helper()
    srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(status)
    }))
    t.Cleanup(srv.Close)
    return srv
}
```

```
Test file placement:
  client.go          → client_test.go       (same directory, ALWAYS)
  internal/parser/   → internal/parser/parser_test.go
  middleware/        → middleware/logging_test.go

Test naming:
  func TestTypeName_MethodName(t *testing.T)
  func TestFunctionName(t *testing.T)
  func BenchmarkFunctionName(b *testing.B)
  func ExampleClient_Get()  ← Runnable examples in docs

testdata/ directory:
  - Automatically ignored by go build
  - Place golden files, fixtures, test configs here
  - Access with os.ReadFile("testdata/fixture.json")
```

---

## 10. internal/ Package Rules

```
internal/ is enforced by the Go compiler — NOT a convention, a GUARANTEE.

github.com/myorg/pkg/internal/parser
  ✅ Importable by: github.com/myorg/pkg (and sub-packages)
  ❌ NOT importable by: github.com/other/project
  ❌ NOT importable by: github.com/myorg/other-pkg

Use internal/ for:
  - Implementation details consumers don't need
  - Helper functions that aren't part of the public API
  - Types shared between sub-packages but not exported
  - Test utilities shared across packages

DO NOT put everything in internal/:
  - If consumers need it, it MUST be in a public package
  - internal/ is for implementation, not "maybe public later"
```

---

## 11. Private Module Configuration

```bash
# For private/internal modules (corporate repos):

# Tell go not to use the public sum database
export GONOSUMDB="internal.company.com/*"

# Tell go not to use the proxy for private repos
export GOPRIVATE="internal.company.com/*,github.com/myorg-private/*"

# Configure git to use SSH for private repos
git config --global url."git@github.com:myorg-private/".insteadOf "https://github.com/myorg-private/"
```

```ini
# .netrc (for CI with HTTPS token auth)
machine github.com
login oauth2
password ${GITHUB_TOKEN}
```

---

## 12. Release Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ["v*"]

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"

      - name: Verify module
        run: |
          go mod verify
          go vet ./...
          go test -race -count=1 ./...

      # For libraries: just tag and push
      # pkg.go.dev automatically indexes tagged versions

      # For CLI tools: use GoReleaser
      - uses: goreleaser/goreleaser-action@v6
        if: contains(github.repository, 'cmd/')
        with:
          args: release --clean
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

```yaml
# .goreleaser.yaml (for CLI tools only)
version: 2
builds:
  - main: ./cmd/my-tool
    binary: my-tool
    goos: [linux, darwin, windows]
    goarch: [amd64, arm64]
    ldflags:
      - -s -w
      - -X main.version={{.Version}}
      - -X main.commit={{.ShortCommit}}

archives:
  - format: tar.gz
    name_template: "{{ .ProjectName }}_{{ .Os }}_{{ .Arch }}"
    format_overrides:
      - goos: windows
        format: zip

changelog:
  sort: asc
  filters:
    exclude: ["^docs:", "^test:", "^ci:"]
```

---

## 13. Makefile

```makefile
# Makefile
.PHONY: all build test lint fmt vet tidy check

all: check test

## Development
build:
	go build ./...

test:
	go test -race -count=1 -coverprofile=coverage.out ./...

test-short:
	go test -short ./...

bench:
	go test -bench=. -benchmem ./...

## Quality
lint:
	golangci-lint run

fmt:
	gofmt -s -w .
	goimports -w .

vet:
	go vet ./...

tidy:
	go mod tidy
	go mod verify

## CI
check: fmt vet lint
	@echo "All checks passed"

## Coverage
coverage: test
	go tool cover -html=coverage.out -o coverage.html
```

---

## 14. golangci-lint Configuration

```yaml
# .golangci.yml
run:
  go: "1.22"
  timeout: 5m

linters:
  enable:
    - errcheck
    - govet
    - staticcheck
    - unused
    - gosimple
    - ineffassign
    - typecheck
    - gocritic
    - revive
    - misspell
    - prealloc
    - noctx        # Ensure context is passed to HTTP requests
    - exhaustive   # Ensure switch statements cover all enum cases
    - errorlint    # Proper error wrapping

linters-settings:
  gocritic:
    enabled-tags: [diagnostic, style, performance]
  revive:
    rules:
      - name: exported
        arguments: [checkPrivateReceivers]

issues:
  exclude-rules:
    - path: _test\.go
      linters: [errcheck, gocritic]
```

---

## 15. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| `pkg/` in a library-only module | Unnecessary nesting, Java-ism | Put public packages at module root |
| `models/`, `types/`, `utils/` packages | Grab-bag packages with no cohesion | Name packages by responsibility |
| Deep nesting (`pkg/v1/core/domain/model/`) | Java/C# mindset, unidiomatic Go | Flat structure, 1-2 levels max |
| Not using `internal/` | Private code accidentally exported | Move implementation to `internal/` |
| Missing `go.sum` in repo | Unreproducible builds | ALWAYS commit `go.sum` |
| `vendor/` without reason | Bloated repo, outdated deps | Only vendor if required by build system |
| No `doc.go` | Package undocumented on pkg.go.dev | Add `doc.go` with package comment |
| Returning interfaces | Over-abstraction, hard to test | Return concrete types, accept interfaces |
| `init()` functions | Hidden side effects, test pollution | Use explicit initialization via constructors |
| Exporting everything | Massive API surface, hard to maintain | Export only what consumers need |

---

## 16. Enforcement Checklist

- [ ] Module path matches repository URL — `github.com/org/repo`
- [ ] `go.sum` committed — NEVER gitignored
- [ ] `internal/` for all private implementation code
- [ ] Packages named by responsibility — NO `utils/`, `common/`, `models/`
- [ ] Functional options for configurable constructors
- [ ] `doc.go` with package-level documentation
- [ ] Tests in `_test.go` files alongside source (NEVER a separate `tests/` dir)
- [ ] `testdata/` for fixtures (auto-ignored by Go tools)
- [ ] Table-driven tests with `t.Parallel()`
- [ ] `golangci-lint` configured and passing
- [ ] `go mod tidy` produces no changes
- [ ] Semantic import versioning for v2+ modules
- [ ] `GOPRIVATE` configured for internal modules
- [ ] Examples as `Example*` functions (runnable in docs)
- [ ] CHANGELOG.md with semantic versioning
