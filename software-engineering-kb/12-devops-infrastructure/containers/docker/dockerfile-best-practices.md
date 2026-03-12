# Dockerfile Best Practices

| Property       | Value                                                                |
|----------------|----------------------------------------------------------------------|
| Domain         | DevOps > Containers > Docker                                         |
| Importance     | Critical                                                             |
| Last Updated   | 2026-03                                                              |
| Cross-ref      | [Fundamentals](fundamentals.md), [Multi-Stage Builds](multi-stage-builds.md), [Container Security](../../../08-security/infrastructure-security/container-security.md) |

---

## 1. Base Image Selection

### Image Hierarchy (Smallest to Largest)

| Base Image         | Size      | Shell | Package Mgr | Use Case                        |
|--------------------|-----------|-------|-------------|----------------------------------|
| `scratch`          | 0 MB      | No    | No          | Static Go/Rust binaries          |
| `gcr.io/distroless/static` | ~2 MB | No | No       | Static binaries + CA certs       |
| `cgr.dev/chainguard/static` | ~1.5 MB | No | No    | Wolfi-based, zero CVEs           |
| `cgr.dev/chainguard/wolfi-base` | ~15 MB | Yes | apk | When shell needed, minimal CVEs |
| `alpine:3.21`      | ~7 MB     | Yes   | apk         | General-purpose minimal          |
| `node:22-alpine`    | ~130 MB  | Yes   | apk + npm   | Node.js workloads                |
| `python:3.13-slim`  | ~150 MB  | Yes   | apt         | Python without extras            |
| `ubuntu:24.04`      | ~78 MB   | Yes   | apt         | Full-featured, broad compat      |

### Chainguard / Wolfi Images (2025+ Standard)

Wolfi is a Linux distribution built for containers with zero known CVEs by default. Chainguard publishes hardened distroless images based on Wolfi:

```dockerfile
# Go static binary — zero CVE base
FROM cgr.dev/chainguard/static:latest AS runtime
COPY --from=builder /app/server /server
ENTRYPOINT ["/server"]

# Node.js with Chainguard (no shell, minimal attack surface)
FROM cgr.dev/chainguard/node:22
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["dist/server.js"]
```

### Selection Criteria

Choose based on requirements:
- **Static binary (Go, Rust)** — use `scratch` or `cgr.dev/chainguard/static`
- **Need CA certs** — use `distroless/static` or Chainguard static
- **Need glibc** — use `distroless/base` or `cgr.dev/chainguard/glibc-dynamic`
- **Need shell for debugging** — use `alpine` or `wolfi-base`
- **Language runtime** — use official `*-alpine` or Chainguard language images

---

## 2. Layer Optimization

### Instruction Ordering for Cache Efficiency

```dockerfile
# GOOD: Ordered from least to most frequently changing
FROM node:22-alpine
WORKDIR /app

# Layer 1: System dependencies (rarely change)
RUN apk add --no-cache dumb-init

# Layer 2: Dependency manifests (change on dep updates)
COPY package.json package-lock.json ./

# Layer 3: Install dependencies (cached if manifests unchanged)
RUN npm ci --production

# Layer 4: Application code (changes most often)
COPY src/ ./src/

CMD ["dumb-init", "node", "src/server.js"]
```

### Combining RUN Commands

```dockerfile
# BAD: Each RUN creates a layer; intermediate layers waste space
RUN apt-get update
RUN apt-get install -y curl wget
RUN rm -rf /var/lib/apt/lists/*

# GOOD: Single layer, cache cleaned in same layer
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl wget && \
    rm -rf /var/lib/apt/lists/*
```

### Remove Package Manager Caches

```dockerfile
# Alpine
RUN apk add --no-cache git openssh

# Debian/Ubuntu
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*

# Python pip
RUN pip install --no-cache-dir -r requirements.txt

# Go module cache (in build stage only — not copied to runtime)
RUN go mod download
```

---

## 3. .dockerignore

```text
# .dockerignore — keep build context minimal
.git
.github
.gitignore
.env*
.vscode
.idea

# Dependencies (rebuilt inside container)
node_modules
vendor
__pycache__
*.pyc

# Build artifacts
dist
build
coverage
*.log

# Documentation
*.md
LICENSE
docs/

# Docker/CI files
Dockerfile*
docker-compose*
compose*
.dockerignore

# OS files
.DS_Store
Thumbs.db
```

**Impact**: A build context with `node_modules` (500MB) vs without (<5MB) makes `docker build` seconds instead of minutes.

---

## 4. COPY vs ADD

| Feature        | `COPY`                        | `ADD`                              |
|----------------|-------------------------------|------------------------------------|
| Local files    | Yes                           | Yes                                |
| URL download   | No                            | Yes (but no checksum verification) |
| Tar extraction | No                            | Yes (auto-extracts .tar.gz)        |
| Recommended    | **Always prefer**             | Only for tar extraction            |

```dockerfile
# GOOD: Use COPY for files
COPY package.json ./

# GOOD: Use ADD only for tar extraction
ADD rootfs.tar.gz /

# BAD: Use ADD for remote files (use curl in RUN instead)
# ADD https://example.com/file.tar.gz /tmp/
RUN curl -fsSL https://example.com/file.tar.gz | tar -xz -C /tmp/
```

---

## 5. ENTRYPOINT vs CMD

```dockerfile
# Pattern 1: CMD only — simple, overridable
CMD ["node", "server.js"]
# docker run myapp                    → node server.js
# docker run myapp node worker.js     → node worker.js (overridden)

# Pattern 2: ENTRYPOINT + CMD — fixed binary, arguments configurable
ENTRYPOINT ["python", "manage.py"]
CMD ["runserver", "0.0.0.0:8000"]
# docker run myapp                    → python manage.py runserver 0.0.0.0:8000
# docker run myapp migrate            → python manage.py migrate

# Pattern 3: Entrypoint script for init logic
COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["server"]
```

### Exec Form vs Shell Form (Signal Handling)

```dockerfile
# GOOD: Exec form — PID 1, receives signals (SIGTERM for graceful shutdown)
CMD ["node", "server.js"]
ENTRYPOINT ["python", "app.py"]

# BAD: Shell form — wraps in /bin/sh -c, PID 1 is shell, signals not forwarded
CMD node server.js
ENTRYPOINT python app.py
```

### Signal Handling with tini / dumb-init

Use an init process when the application does not handle signals or zombie reaping:

```dockerfile
FROM node:22-alpine
RUN apk add --no-cache dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
```

Or use Docker's built-in init:

```bash
docker run --init myapp
```

---

## 6. HEALTHCHECK Instruction

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
```

| Parameter        | Default | Recommendation                              |
|------------------|---------|---------------------------------------------|
| `--interval`     | 30s     | 10-30s depending on service criticality     |
| `--timeout`      | 30s     | 3-5s — fail fast                            |
| `--start-period` | 0s      | Set to app startup time (10-60s)            |
| `--retries`      | 3       | 3-5 retries before marking unhealthy        |

Use lightweight tools available in the image:

```dockerfile
# Alpine/slim — use wget (no curl by default)
CMD wget -qO- http://localhost:3000/health || exit 1

# If curl available
CMD curl -f http://localhost:3000/health || exit 1

# TCP check (no HTTP endpoint)
CMD nc -z localhost 5432 || exit 1

# Custom binary health check
CMD ["/app/healthcheck"]
```

---

## 7. Non-Root Users

```dockerfile
# Create a non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

# Copy files with correct ownership
COPY --chown=appuser:appgroup ./dist /app/dist

# Switch to non-root before CMD
USER appuser

CMD ["node", "dist/server.js"]
```

For official images, use built-in users:

```dockerfile
# Node.js — built-in 'node' user
FROM node:22-alpine
USER node

# Nginx — built-in 'nginx' user
FROM nginx:alpine
USER nginx

# Python — create user explicitly
FROM python:3.13-slim
RUN useradd --create-home --shell /bin/bash app
USER app
```

---

## 8. ARG vs ENV

```dockerfile
# ARG: Build-time only, not in final image
ARG NODE_ENV=production
ARG BUILD_VERSION

# ENV: Persists at runtime inside the container
ENV NODE_ENV=${NODE_ENV}
ENV APP_VERSION=${BUILD_VERSION}

RUN echo "Building version: ${BUILD_VERSION} for ${NODE_ENV}"
```

```bash
# Pass build arguments
docker build --build-arg BUILD_VERSION=1.2.3 --build-arg NODE_ENV=staging .
```

**Security note**: `ARG` values are visible in `docker history`. Never pass secrets via `ARG` — use BuildKit secret mounts instead.

---

## 9. BuildKit Features

### Cache Mounts (Persist Package Manager Caches)

```dockerfile
# syntax=docker/dockerfile:1

# Go modules — persist download cache across builds
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# npm — persist npm cache
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# pip — persist pip cache
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# apt — persist package cache
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt \
    apt-get update && apt-get install -y build-essential
```

### Secret Mounts (Never Stored in Layers)

```dockerfile
# syntax=docker/dockerfile:1

# Mount secret at build time — not persisted in any layer
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) && \
    echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && \
    npm ci && \
    rm -f .npmrc
```

```bash
# Pass secret during build
docker build --secret id=npm_token,src=$HOME/.npmrc .
```

### SSH Forwarding

```dockerfile
# syntax=docker/dockerfile:1

# Clone private repo using host SSH agent
RUN --mount=type=ssh \
    git clone git@github.com:org/private-repo.git /app/repo
```

```bash
docker build --ssh default .
```

---

## 10. Image Scanning Integration

### Trivy (Recommended for OSS)

```bash
# Scan image for vulnerabilities
trivy image myapp:1.0.0

# Scan with severity filter
trivy image --severity HIGH,CRITICAL myapp:1.0.0

# Fail CI if critical vulnerabilities found
trivy image --exit-code 1 --severity CRITICAL myapp:1.0.0
```

### Integrate in CI (GitHub Actions)

```yaml
- name: Scan image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: myapp:${{ github.sha }}
    format: sarif
    output: trivy-results.sarif
    severity: CRITICAL,HIGH
    exit-code: 1
```

For comprehensive container security practices, see [Container Security](../../../08-security/infrastructure-security/container-security.md).

---

## 11. Image Tagging Strategies

| Strategy           | Example                          | Use Case                        |
|--------------------|----------------------------------|---------------------------------|
| Semantic version   | `myapp:1.2.3`                    | Release tracking                |
| Git SHA            | `myapp:a1b2c3d`                  | Traceability to exact commit    |
| Branch + SHA       | `myapp:main-a1b2c3d`            | Multi-branch CI                 |
| Timestamp          | `myapp:20260310-143022`          | Chronological ordering          |
| Combined           | `myapp:1.2.3-a1b2c3d`           | Version + commit (recommended)  |

```bash
# Tag with multiple strategies in CI
GIT_SHA=$(git rev-parse --short HEAD)
VERSION=$(cat VERSION)

docker build \
  -t myregistry/myapp:${VERSION} \
  -t myregistry/myapp:${VERSION}-${GIT_SHA} \
  -t myregistry/myapp:${GIT_SHA} \
  .
```

**Rule**: Never use `:latest` in production manifests. It is mutable and non-deterministic.

---

## 12. Conditional Builds with Build Arguments

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# Development target
FROM base AS development
RUN npm install           # All dependencies including devDependencies
COPY . .
CMD ["npm", "run", "dev"]

# Production target
FROM base AS production
RUN npm ci --production   # Production dependencies only
COPY src/ ./src/
USER node
CMD ["node", "src/server.js"]
```

```bash
# Build for development
docker build --target development -t myapp:dev .

# Build for production
docker build --target production -t myapp:prod .
```

---

## Best Practices

1. **Use minimal base images** — prefer Chainguard/distroless for production; Alpine for when a shell is needed.
2. **Order layers from stable to volatile** — system deps, then app deps, then source code.
3. **Combine and clean in single RUN** — merge related commands; remove caches in the same layer.
4. **Always use exec form for CMD/ENTRYPOINT** — ensure PID 1 receives signals for graceful shutdown.
5. **Run as non-root** — set `USER` to a dedicated low-privilege user before CMD.
6. **Use BuildKit cache mounts** — `--mount=type=cache` for package managers to speed up rebuilds.
7. **Never bake secrets into images** — use `--mount=type=secret` or runtime injection.
8. **Scan every image in CI** — integrate Trivy or Snyk and fail builds on CRITICAL vulnerabilities.
9. **Tag with semantic version + git SHA** — ensure full traceability; never rely on `:latest`.
10. **Maintain a comprehensive .dockerignore** — exclude everything not needed at build time.

---

## Anti-Patterns

| Anti-Pattern                          | Problem                                        | Fix                                          |
|---------------------------------------|------------------------------------------------|----------------------------------------------|
| Using `ubuntu` as base for everything | Massive images (200+ MB), large attack surface | Use Alpine, slim, or distroless variants     |
| Installing dev dependencies in production | Larger image, unnecessary attack surface    | Multi-stage build or `npm ci --production`   |
| Shell form for CMD/ENTRYPOINT         | Signals not forwarded, no graceful shutdown    | Use exec form `["cmd", "arg"]`               |
| Secrets in ARG or ENV                 | Visible in `docker history` and image metadata | Use `--mount=type=secret` in BuildKit        |
| COPY . . as first instruction         | Busts cache on every file change               | Copy manifests first, install deps, then code |
| No .dockerignore                      | Huge build context, slow builds, secrets leaked | Add .dockerignore excluding .git, node_modules |
| Using ADD for simple file copies      | Unexpected behavior (URL download, tar extract) | Use COPY; ADD only for tar extraction        |
| No HEALTHCHECK defined                | Orchestrator cannot detect unhealthy containers | Add HEALTHCHECK with appropriate intervals   |

---

## Enforcement Checklist

- [ ] Base image is minimal (Alpine, slim, distroless, or Chainguard)
- [ ] All `RUN` commands clean up caches in the same layer
- [ ] `.dockerignore` excludes `.git`, `node_modules`, secrets, build artifacts
- [ ] `CMD` and `ENTRYPOINT` use exec form (JSON array syntax)
- [ ] `USER` set to non-root before final CMD
- [ ] `HEALTHCHECK` defined with reasonable intervals
- [ ] No secrets in `ARG`, `ENV`, or `COPY` — BuildKit secret mounts used
- [ ] Image scanned in CI with Trivy/Snyk; critical findings fail the build
- [ ] Tags use semantic version + git SHA; `:latest` not used in production
- [ ] BuildKit cache mounts used for package manager dependencies
- [ ] Multi-stage build separates build and runtime — see [Multi-Stage Builds](multi-stage-builds.md)
