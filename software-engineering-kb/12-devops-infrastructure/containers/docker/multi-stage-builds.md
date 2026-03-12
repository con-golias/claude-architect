# Multi-Stage Builds

| Property       | Value                                                                |
|----------------|----------------------------------------------------------------------|
| Domain         | DevOps > Containers > Docker                                         |
| Importance     | High                                                                 |
| Last Updated   | 2026-03                                                              |
| Cross-ref      | [Dockerfile Best Practices](dockerfile-best-practices.md), [Fundamentals](fundamentals.md) |

---

## 1. Multi-Stage Build Concept

Multi-stage builds use multiple `FROM` instructions in a single Dockerfile. Each `FROM` begins a new stage. Only the final stage produces the output image — intermediate stages are discarded, keeping build tools, source code, and dev dependencies out of the production image.

```text
┌──────────────────────┐     ┌──────────────────────┐
│   Build Stage        │     │   Runtime Stage       │
│                      │     │                       │
│  Source code         │     │  Minimal base image   │
│  Build tools         │ ──► │  Compiled binary OR   │
│  Dev dependencies    │     │  Production deps only │
│  Test frameworks     │     │  App artifacts        │
│                      │     │                       │
│  ~800 MB - 2 GB      │     │  ~5 MB - 150 MB      │
└──────────────────────┘     └──────────────────────┘
       Discarded                   Final Image
```

### Syntax

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime (final image)
FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/server.js"]
```

**Key syntax**: `COPY --from=<stage>` copies artifacts from a previous stage. Reference stages by name (`AS builder`) or index (`--from=0`).

---

## 2. Node.js / TypeScript Pattern

```dockerfile
# syntax=docker/dockerfile:1

# ── Stage 1: Install dependencies ──
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ── Stage 2: Build TypeScript ──
FROM deps AS builder
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 3: Production runtime ──
FROM node:22-alpine AS production
RUN apk add --no-cache dumb-init

WORKDIR /app
ENV NODE_ENV=production

# Copy only production dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --production && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/dist ./dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

### Image Size Comparison

| Approach            | Base                | Final Size |
|---------------------|---------------------|------------|
| No multi-stage      | `node:22`           | ~1.2 GB    |
| Multi-stage + node  | `node:22-alpine`    | ~180 MB    |
| Multi-stage + distroless | `cgr.dev/chainguard/node:22` | ~120 MB |

---

## 3. Go Pattern

Go compiles to static binaries, making it ideal for `scratch` or distroless bases:

```dockerfile
# syntax=docker/dockerfile:1

# ── Build stage ──
FROM golang:1.23-alpine AS builder
WORKDIR /app

# Download dependencies (cached if go.mod/go.sum unchanged)
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Build static binary
COPY . .
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /server ./cmd/server

# ── Runtime stage ──
FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /server /server
EXPOSE 8080
ENTRYPOINT ["/server"]
```

### Alternative: Chainguard Static Base

```dockerfile
FROM cgr.dev/chainguard/static:latest
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

### Image Size Comparison

| Approach                  | Final Size |
|---------------------------|------------|
| `golang:1.23` (no multi-stage) | ~850 MB |
| Multi-stage + `alpine`   | ~15 MB     |
| Multi-stage + `scratch`  | ~8 MB      |
| Multi-stage + `chainguard/static` | ~9 MB |

---

## 4. Python Pattern

```dockerfile
# syntax=docker/dockerfile:1

# ── Build stage: install compiled dependencies ──
FROM python:3.13-slim AS builder
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install --no-warn-script-location -r requirements.txt

# ── Runtime stage ──
FROM python:3.13-slim AS runtime
WORKDIR /app

# Copy only installed packages
COPY --from=builder /install /usr/local

COPY src/ ./src/

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Python with UV (Modern Package Manager)

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.13-slim AS builder
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-editable

COPY src/ ./src/

FROM python:3.13-slim AS runtime
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src ./src
ENV PATH="/app/.venv/bin:$PATH"

RUN useradd --create-home appuser
USER appuser
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Image Size Comparison

| Approach                      | Final Size |
|-------------------------------|------------|
| `python:3.13` (no multi-stage) | ~1.0 GB  |
| Multi-stage + `python:3.13-slim` | ~200 MB |
| Multi-stage + Chainguard Python | ~130 MB  |

---

## 5. Rust Pattern

```dockerfile
# syntax=docker/dockerfile:1

# ── Build stage ──
FROM rust:1.83-alpine AS builder
WORKDIR /app

RUN apk add --no-cache musl-dev

# Cache dependencies: build a dummy project first
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release

# Build actual application
COPY src/ ./src/
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release && \
    cp target/release/myapp /myapp

# ── Runtime stage ──
FROM scratch
COPY --from=builder /myapp /myapp
EXPOSE 8080
ENTRYPOINT ["/myapp"]
```

### Image Size Comparison

| Approach                      | Final Size |
|-------------------------------|------------|
| `rust:1.83` (no multi-stage) | ~1.5 GB    |
| Multi-stage + `alpine`       | ~12 MB     |
| Multi-stage + `scratch`      | ~5 MB      |

---

## 6. Java Pattern

```dockerfile
# syntax=docker/dockerfile:1

# ── Build stage ──
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app

COPY gradle/ gradle/
COPY gradlew build.gradle.kts settings.gradle.kts ./
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew dependencies --no-daemon

COPY src/ ./src/
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew build --no-daemon -x test

# Extract layered JAR for optimal Docker caching
RUN java -Djarmode=layertools -jar build/libs/*.jar extract --destination extracted

# ── Runtime stage ──
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

# Copy layered JAR (each layer is a Docker layer)
COPY --from=builder /app/extracted/dependencies/ ./
COPY --from=builder /app/extracted/spring-boot-loader/ ./
COPY --from=builder /app/extracted/snapshot-dependencies/ ./
COPY --from=builder /app/extracted/application/ ./

RUN addgroup --system app && adduser --system --ingroup app app
USER app

EXPOSE 8080
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

### Image Size Comparison

| Approach                    | Final Size |
|-----------------------------|------------|
| `eclipse-temurin:21-jdk`    | ~480 MB    |
| Multi-stage + JRE alpine    | ~180 MB    |
| Multi-stage + distroless Java | ~140 MB  |

---

## 7. Builder Pattern for Monorepos

### Shared Base Stage

```dockerfile
# syntax=docker/dockerfile:1

# ── Shared: install all workspace dependencies ──
FROM node:22-alpine AS workspace
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ── Build shared library ──
FROM workspace AS shared-builder
COPY packages/shared/ ./packages/shared/
RUN npm run build -w packages/shared

# ── Build API ──
FROM shared-builder AS api-builder
COPY packages/api/ ./packages/api/
RUN npm run build -w packages/api

# ── Build Web ──
FROM shared-builder AS web-builder
COPY packages/web/ ./packages/web/
RUN npm run build -w packages/web

# ── API Runtime ──
FROM node:22-alpine AS api
WORKDIR /app
COPY --from=api-builder /app/packages/api/dist ./dist
COPY --from=api-builder /app/node_modules ./node_modules
USER node
CMD ["node", "dist/server.js"]

# ── Web Runtime (served by nginx) ──
FROM nginx:alpine AS web
COPY --from=web-builder /app/packages/web/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
```

Build specific targets:

```bash
docker build --target api -t myapp-api:latest .
docker build --target web -t myapp-web:latest .
```

---

## 8. Test Stage Integration

Run tests during the build — only produce final image if tests pass:

```dockerfile
# ── Build stage ──
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

# ── Test stage (blocks build on failure) ──
FROM builder AS tester
RUN go test -v -race ./...

# ── Runtime stage (only reached if tests pass) ──
FROM scratch AS production
COPY --from=tester /server /server
ENTRYPOINT ["/server"]
```

**Note**: The `COPY --from=tester` ensures the test stage must complete successfully. If tests fail, the build fails.

For CI, use `--target` to run specific stages:

```bash
# Run tests only
docker build --target tester -t myapp:test .

# Build production image (includes running tests)
docker build --target production -t myapp:prod .
```

---

## 9. Development vs Production Targets

```dockerfile
# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# ── Development: all deps, hot reload, debug tools ──
FROM base AS development
RUN npm install
COPY . .
EXPOSE 3000 9229
CMD ["npm", "run", "dev"]

# ── Production deps only ──
FROM base AS prod-deps
RUN npm ci --production

# ── Build step ──
FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

# ── Production: minimal image ──
FROM node:22-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER node
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

```yaml
# compose.yaml
services:
  api:
    build:
      context: .
      target: development      # Dev target with hot reload
    volumes:
      - ./src:/app/src          # Bind mount for hot reload
    ports:
      - "3000:3000"
      - "9229:9229"             # Node.js debugger
```

```bash
# Production build
docker build --target production -t myapp:prod .
```

---

## 10. BuildKit Parallel Stage Execution

BuildKit automatically parallelizes independent stages:

```dockerfile
# These stages run IN PARALLEL because they have no dependencies:
FROM node:22-alpine AS frontend-builder
COPY frontend/ ./frontend/
RUN cd frontend && npm ci && npm run build

FROM golang:1.23-alpine AS backend-builder
COPY backend/ ./backend/
RUN cd backend && go build -o /server ./cmd/server

# Final stage waits for both:
FROM nginx:alpine AS production
COPY --from=frontend-builder /frontend/dist /usr/share/nginx/html
COPY --from=backend-builder /server /usr/local/bin/server
```

```text
Timeline (BuildKit):
  frontend-builder: ████████████████░░░░░░  (12s)
  backend-builder:  ████████████░░░░░░░░░░  (10s)
  production:       ░░░░░░░░░░░░░░░░██████  (3s, waits for both)
  Total: ~15s (not 25s sequential)
```

Enable BuildKit (default since Docker 23+):

```bash
DOCKER_BUILDKIT=1 docker build .
```

---

## 11. Copying from External Images

Copy files from published images without building them:

```dockerfile
# Copy a specific binary from another image
COPY --from=busybox:stable /bin/wget /usr/local/bin/wget

# Copy CA certificates
COPY --from=alpine:3.21 /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy tools from tool images
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY --from=golang:1.23 /usr/local/go/bin/go /usr/local/bin/go
```

---

## 12. Image Size Comparison Summary

| Language   | No Multi-Stage | Multi-Stage + Slim/Alpine | Multi-Stage + Scratch/Distroless | Reduction |
|------------|----------------|---------------------------|----------------------------------|-----------|
| Node.js    | ~1.2 GB        | ~180 MB                   | ~120 MB                          | 90%       |
| Go         | ~850 MB        | ~15 MB                    | ~5-8 MB                          | 99%       |
| Python     | ~1.0 GB        | ~200 MB                   | ~130 MB                          | 87%       |
| Rust       | ~1.5 GB        | ~12 MB                    | ~5 MB                            | 99%+      |
| Java       | ~480 MB        | ~180 MB                   | ~140 MB                          | 71%       |

---

## Best Practices

1. **Always use multi-stage builds** — separate build tools from runtime; never ship compilers in production images.
2. **Name every stage** — use `AS builder`, `AS tester`, `AS production` for readability and `--target` support.
3. **Copy only what is needed** — use specific `COPY --from` paths; avoid copying entire build directories.
4. **Use cache mounts for dependencies** — `--mount=type=cache` on module caches dramatically speeds rebuilds.
5. **Put dependency install before source copy** — leverage Docker layer caching; rebuild deps only when manifests change.
6. **Run tests in a build stage** — make the final stage depend on the test stage to gate on test success.
7. **Use `scratch` or distroless for compiled languages** — Go, Rust, and C/C++ binaries need no OS.
8. **Create development and production targets** — share base stages; use `--target` for environment-specific builds.
9. **Leverage parallel stage execution** — structure independent stages so BuildKit builds them concurrently.
10. **Verify final image contents** — run `docker history` and `docker run --rm image ls -la` to confirm only expected files exist.

---

## Anti-Patterns

| Anti-Pattern                          | Problem                                        | Fix                                          |
|---------------------------------------|------------------------------------------------|----------------------------------------------|
| Single-stage build with build tools   | Go compiler, npm devDeps shipped to production | Multi-stage: build in stage 1, run in stage 2 |
| Copying entire `/app` from builder    | Includes source, tests, configs not needed     | Copy specific paths: `dist/`, binary, etc.   |
| Not using named stages                | Fragile index-based refs (`--from=0`)          | Name every stage with `AS <name>`            |
| Rebuilding deps on every code change  | Slow builds, no layer cache benefit            | Copy manifests first, install, then copy code |
| No test stage in Dockerfile           | Tests only run in CI, not gated on build       | Add test stage; final stage depends on it    |
| Using `golang` image as runtime       | ~850 MB runtime image with compiler            | Use `scratch` or `distroless/static`         |
| Duplicating dep install in each stage | Wasted build time and layers                   | Share a `deps` stage across build targets    |
| Not using BuildKit cache mounts       | Fresh package downloads on every build          | Add `--mount=type=cache` for pkg managers    |

---

## Enforcement Checklist

- [ ] All production Dockerfiles use at least two stages (build + runtime)
- [ ] Every stage has a descriptive `AS <name>` alias
- [ ] `COPY --from` copies only specific artifacts, not entire directories
- [ ] Dependency manifests (package.json, go.mod, requirements.txt) copied before source
- [ ] BuildKit cache mounts used for package manager caches
- [ ] Test stage present and blocks final image on failure (for CI builds)
- [ ] Final image uses minimal base: scratch, distroless, or Alpine
- [ ] `docker history <image>` confirms no build tools or source code in final image
- [ ] Development and production targets available via `--target`
- [ ] Image size verified and documented — compare against size budget
