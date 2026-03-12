# Docker Project Structure

> **AI Plugin Directive:** When containerizing an application or structuring Docker-related files, ALWAYS use this guide. Apply multi-stage builds, proper .dockerignore, health checks, and security-hardened images. This guide covers Dockerfile best practices, Docker Compose for development, and container image organization.

**Core Rule: Use multi-stage builds to minimize image size. Run as non-root user. Pin base image versions. NEVER copy `node_modules`, `.env`, or secrets into images. Use `.dockerignore` to exclude everything not needed at runtime.**

---

## 1. Docker Files in a Project

```
my-app/
├── docker/                                # Docker-related files (alternative: project root)
│   ├── Dockerfile                         # Production image
│   ├── Dockerfile.dev                     # Development image (optional)
│   └── nginx.conf                         # Nginx config (if reverse proxy)
│
├── .dockerignore                          # MUST be at repo root
├── docker-compose.yml                     # Development environment
├── docker-compose.prod.yml                # Production overrides (optional)
│
├── src/                                   # Application source
├── package.json
└── ...
```

```
File placement rules:
  .dockerignore    → ALWAYS at repo root (Docker reads from build context root)
  Dockerfile       → Repo root OR docker/ subdirectory
  docker-compose   → Repo root (for easy `docker compose up`)

If Dockerfile is in docker/:
  Build with: docker build -f docker/Dockerfile .
  Context is still the repo root
```

---

## 2. Multi-Stage Dockerfile (Node.js)

```dockerfile
# ─── Stage 1: Dependencies ───────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile --prod

# ─── Stage 2: Build ──────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile

COPY src/ ./src/
COPY tsconfig.json ./

RUN pnpm build

# ─── Stage 3: Production ─────────────────────────────────
FROM node:22-alpine AS production

# Security: non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

WORKDIR /app

# Copy only what's needed
COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY package.json ./

# Security: non-root
USER appuser

# Metadata
EXPOSE 3000
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
```

---

## 3. Multi-Stage Dockerfile (Python)

```dockerfile
# ─── Stage 1: Build ──────────────────────────────────────
FROM python:3.12-slim AS build
WORKDIR /app

# Install build dependencies
RUN pip install --no-cache-dir uv

# Install Python dependencies
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy source
COPY src/ ./src/

# ─── Stage 2: Production ─────────────────────────────────
FROM python:3.12-slim AS production

# Security: non-root user
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --create-home appuser

WORKDIR /app

# Copy virtual environment and source
COPY --from=build --chown=appuser:appgroup /app/.venv ./.venv
COPY --from=build --chown=appuser:appgroup /app/src ./src

# Ensure venv binaries are in PATH
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "src.my_app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 4. Multi-Stage Dockerfile (Go)

```dockerfile
# ─── Stage 1: Build ──────────────────────────────────────
FROM golang:1.22-alpine AS build
WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w -X main.version=${VERSION}" \
    -o /app/server ./cmd/server

# ─── Stage 2: Production ─────────────────────────────────
FROM scratch AS production

# Import CA certificates for HTTPS
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy binary
COPY --from=build /app/server /server

EXPOSE 8080

ENTRYPOINT ["/server"]
```

```
Go-specific rules:
  - Use `scratch` or `distroless` as final image (no shell, minimal attack surface)
  - CGO_ENABLED=0 for static binary (no libc dependency)
  - -ldflags="-s -w" strips debug info (smaller binary)
  - Copy CA certs for HTTPS calls
  - No USER directive needed — scratch has no users
```

---

## 5. .dockerignore

```
# .dockerignore — MUST exist at repo root

# Version control
.git
.gitignore

# Dependencies (installed inside container)
node_modules
.venv
__pycache__
*.pyc

# Build output (rebuilt inside container)
dist
build
.next
.nuxt

# Development files
.env
.env.*
!.env.example
docker-compose*.yml
Dockerfile*

# IDE
.vscode
.idea
*.swp

# Tests (not needed in production image)
tests
__tests__
*.test.*
*.spec.*
coverage
.nyc_output

# Documentation
docs
*.md
!README.md
LICENSE

# CI/CD
.github
.gitlab-ci.yml
.circleci

# OS
.DS_Store
Thumbs.db
```

```
.dockerignore rules:
  - Exclude EVERYTHING not needed for build or runtime
  - NEVER include .env files (use runtime env vars)
  - NEVER include node_modules (install fresh in container)
  - NEVER include .git (adds 10-100MB+ to context)
  - DO include lockfiles (pnpm-lock.yaml, go.sum, uv.lock)
  - DO include source files needed for build
```

---

## 6. Docker Compose (Development)

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: build                          # Use build stage for dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app                               # Hot reload
      - /app/node_modules                    # Preserve container's node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/myapp
      - REDIS_URL=redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    command: pnpm dev

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/var/lib/redis/data

  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"                          # SMTP
      - "8025:8025"                          # Web UI

volumes:
  postgres_data:
  redis_data:
```

---

## 7. Image Size Comparison

```
Image size by base image (Node.js app):

node:22              → 1.1 GB    ❌ NEVER use in production
node:22-slim         → 240 MB   ⚠️ Acceptable
node:22-alpine       → 140 MB   ✅ Recommended
distroless/nodejs22  → 130 MB   ✅ Most secure

With multi-stage:
node:22-alpine (multi-stage, prod deps only) → 80-120 MB  ✅ Best

Python:
python:3.12          → 1.0 GB   ❌
python:3.12-slim     → 140 MB   ✅ Recommended
python:3.12-alpine   → 60 MB    ⚠️ May have C extension issues

Go:
golang:1.22-alpine   → 250 MB (build stage only)
scratch              → 5-15 MB  ✅ Best (static binary)
distroless/static    → 5-15 MB  ✅ Best with CA certs
```

---

## 8. Security Checklist

```
Container security rules:

1. Non-root user
   ✅ USER appuser (UID 1001)
   ❌ Running as root (default)

2. Pin base image versions
   ✅ FROM node:22.4-alpine
   ⚠️ FROM node:22-alpine     (minor updates OK)
   ❌ FROM node:latest         (unpredictable)

3. No secrets in image
   ✅ Pass via environment variables at runtime
   ✅ Use Docker secrets or vault
   ❌ COPY .env into image
   ❌ ARG SECRET_KEY (visible in image history)

4. Minimal image
   ✅ Multi-stage build, production deps only
   ✅ .dockerignore excludes unnecessary files
   ❌ Development dependencies in production image

5. Read-only filesystem
   ✅ docker run --read-only --tmpfs /tmp

6. Scan for vulnerabilities
   ✅ docker scout cves
   ✅ trivy image my-app:latest
```

---

## 9. Layer Caching Optimization

```dockerfile
# ❌ BAD — Cache busted on every code change
COPY . .
RUN npm install
RUN npm run build

# ✅ GOOD — Dependencies cached separately from source
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY src/ ./src/
COPY tsconfig.json ./
RUN pnpm build
```

```
Caching rules:
  1. Order instructions from least to most frequently changing
  2. Copy dependency manifests BEFORE source code
  3. Install dependencies in a separate layer
  4. COPY only needed files, never COPY . (without .dockerignore)
  5. Combine RUN commands with && to reduce layers
  6. Use --mount=type=cache for package manager caches:

RUN --mount=type=cache,target=/root/.npm \
    npm ci --production
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No .dockerignore | Huge build context, slow builds | Add .dockerignore excluding .git, node_modules |
| Single-stage build | 1GB+ images with dev tools | Multi-stage: build stage → production stage |
| Running as root | Security vulnerability | Add USER directive with non-root user |
| `FROM node:latest` | Unpredictable base, breaks CI | Pin to specific version: `node:22-alpine` |
| Secrets in Dockerfile | Credentials in image history | Use runtime env vars or Docker secrets |
| `COPY . .` first | Cache busted every change | Copy lockfile → install → copy source |
| No HEALTHCHECK | Orchestrator can't detect failures | Add HEALTHCHECK with endpoint |
| No .env in .dockerignore | Secrets leaked into image | Add `.env*` to .dockerignore |
| `npm install` (not `ci`) | Non-reproducible installs | Use `npm ci` or `pnpm install --frozen-lockfile` |

---

## 11. Enforcement Checklist

- [ ] Multi-stage build — separate build and production stages
- [ ] Non-root user — UID 1001, never run as root
- [ ] Pinned base images — specific version, not `:latest`
- [ ] .dockerignore — exclude .git, node_modules, .env, tests
- [ ] HEALTHCHECK — endpoint-based health verification
- [ ] No secrets in image — runtime env vars or secrets manager
- [ ] Layer caching optimized — lockfile before source code
- [ ] Production deps only — no devDependencies in final image
- [ ] Alpine or distroless base — minimal attack surface
- [ ] docker-compose.yml for local development — all dependencies included
- [ ] Volumes for databases — data persists across restarts
- [ ] `--frozen-lockfile` in install — reproducible builds
