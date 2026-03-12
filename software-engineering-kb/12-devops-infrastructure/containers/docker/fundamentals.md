# Docker Fundamentals

| Property       | Value                                                                |
|----------------|----------------------------------------------------------------------|
| Domain         | DevOps > Containers > Docker                                         |
| Importance     | Critical                                                             |
| Last Updated   | 2026-03                                                              |
| Cross-ref      | [Dockerfile Best Practices](dockerfile-best-practices.md), [Multi-Stage Builds](multi-stage-builds.md) |

---

## 1. Container Concepts

### Linux Primitives Behind Containers

Containers are **not virtual machines**. They are isolated processes using three Linux kernel features:

| Primitive          | Purpose                                       | Example                            |
|--------------------|-----------------------------------------------|------------------------------------|
| **Namespaces**     | Isolate what a process can see                | PID, NET, MNT, UTS, IPC, USER     |
| **cgroups (v2)**   | Limit what a process can use                  | CPU, memory, I/O, PIDs            |
| **Union FS**       | Layer filesystem for efficient image storage  | OverlayFS, overlay2               |

```text
┌─────────────────────────────────────────┐
│  Container = Namespaces + cgroups + FS  │
│  ┌───────┐ ┌────────┐ ┌──────────┐     │
│  │  PID  │ │  NET   │ │   MNT    │     │ ← Namespaces
│  └───────┘ └────────┘ └──────────┘     │
│  ┌────────────────────────────────┐     │
│  │  cgroup v2: cpu/mem/io limits  │     │ ← Resource limits
│  └────────────────────────────────┘     │
│  ┌────────────────────────────────┐     │
│  │  OverlayFS: image layers + RW │     │ ← Filesystem
│  └────────────────────────────────┘     │
└─────────────────────────────────────────┘
```

### Images vs Containers vs Volumes

| Concept       | Description                                    | Lifecycle                          |
|---------------|------------------------------------------------|------------------------------------|
| **Image**     | Read-only template with layered filesystem     | Immutable, versioned with tags     |
| **Container** | Running instance of an image with writable top layer | Ephemeral, created/destroyed    |
| **Volume**    | Persistent storage decoupled from container    | Survives container deletion        |

---

## 2. Docker Architecture

```text
┌──────────────┐     REST API      ┌──────────────────┐
│ Docker CLI   │ ──────────────►   │  Docker Daemon    │
│ (docker)     │                   │  (dockerd)        │
└──────────────┘                   │  ┌─────────────┐  │
                                   │  │ containerd   │  │
┌──────────────┐                   │  │  ┌────────┐  │  │
│ Docker       │  push/pull        │  │  │  runc  │  │  │
│ Registry     │ ◄────────────►    │  │  └────────┘  │  │
│ (Hub/ECR/    │                   │  └─────────────┘  │
│  GCR/GHCR)  │                   └──────────────────┘
└──────────────┘
```

- **Docker CLI**: User-facing command-line client
- **dockerd**: Daemon managing images, containers, networks, volumes
- **containerd**: Industry-standard container runtime (CNCF graduated)
- **runc**: OCI-compliant low-level runtime spawning containers
- **Registry**: Stores and distributes images (Docker Hub, GHCR, ECR, GCR, ACR)

---

## 3. Dockerfile Basics

```dockerfile
# Base image — always pin to a specific version
FROM node:22-alpine AS runtime

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests first (cache optimization)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --production

# Copy application code
COPY src/ ./src/

# Document the port the app listens on
EXPOSE 3000

# Set non-root user
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Define the default command (exec form)
CMD ["node", "src/server.js"]
```

### Key Instructions

| Instruction    | Purpose                                     | Notes                                |
|----------------|---------------------------------------------|--------------------------------------|
| `FROM`         | Set base image                              | Always pin version, never use `:latest` in prod |
| `RUN`          | Execute build-time commands                 | Each creates a new layer             |
| `COPY`         | Copy files from build context               | Prefer over `ADD` unless extracting tarballs |
| `WORKDIR`      | Set working directory                       | Creates dir if not exists            |
| `EXPOSE`       | Document listening port                     | Does not publish — informational only |
| `CMD`          | Default command at runtime                  | Use exec form `["cmd", "arg"]`       |
| `ENTRYPOINT`   | Fixed executable, CMD becomes arguments     | Use for CLI tools and wrappers       |
| `ENV`          | Set environment variable (persists at runtime) | Baked into image layers           |
| `ARG`          | Build-time variable only                    | Not available at runtime             |
| `USER`         | Switch to non-root user                     | Always set before CMD                |

### Image Layers and Caching

```text
Layer 5: CMD ["node", "src/server.js"]     ← Metadata (0 bytes)
Layer 4: COPY src/ ./src/                   ← Changes often → rebuilt frequently
Layer 3: RUN npm ci --production            ← Cached if package.json unchanged
Layer 2: COPY package.json package-lock.json ← Changes less often
Layer 1: FROM node:22-alpine                ← Base layer, rarely changes
```

**Rule**: Order instructions from least-frequently to most-frequently changing. Docker rebuilds from the first changed layer onward.

---

## 4. Docker CLI Essentials

### Build and Run

```bash
# Build image with tag
docker build -t myapp:1.0.0 .

# Build with BuildKit (default in Docker 23+)
DOCKER_BUILDKIT=1 docker build -t myapp:1.0.0 .

# Run container (detached, port mapping, auto-remove)
docker run -d --name myapp -p 3000:3000 --rm myapp:1.0.0

# Run with resource limits
docker run -d --name myapp \
  --memory=512m --cpus=1.0 \
  -p 3000:3000 myapp:1.0.0

# Execute command inside running container
docker exec -it myapp sh

# View logs (follow mode, last 100 lines)
docker logs -f --tail 100 myapp
```

### Inspect and Debug

```bash
# Inspect container details (JSON output)
docker inspect myapp

# View resource usage in real time
docker stats myapp

# Show image layer history and sizes
docker history myapp:1.0.0

# List all images with sizes
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

### Cleanup

```bash
# Remove stopped containers, unused images, networks, build cache
docker system prune -a --volumes

# Remove dangling images only
docker image prune

# Remove all stopped containers
docker container prune

# Show disk usage by Docker
docker system df
```

---

## 5. Container Networking

### Network Drivers

| Driver      | Scope    | Use Case                                       |
|-------------|----------|-------------------------------------------------|
| `bridge`    | Single host | Default — containers on same host communicate  |
| `host`      | Single host | Container shares host network stack (no isolation) |
| `overlay`   | Multi-host  | Swarm/K8s cross-node communication            |
| `none`      | Isolated | No networking — for batch or security use cases |
| `macvlan`   | Single host | Container gets own MAC address on physical network |

```bash
# Create a custom bridge network
docker network create --driver bridge app-network

# Run containers on the same network (DNS resolution by name)
docker run -d --name api --network app-network myapi:1.0
docker run -d --name db --network app-network postgres:16

# From api container, connect via: postgres://db:5432
```

### DNS Resolution

Containers on the same user-defined bridge network resolve each other by container name. The default `bridge` network does NOT support automatic DNS — always create custom networks.

---

## 6. Volumes and Bind Mounts

```text
┌─────────────────────────────────────┐
│         Docker Host                  │
│  ┌───────────┐  ┌───────────────┐   │
│  │ Named     │  │ Bind Mount    │   │
│  │ Volume    │  │ (host path)   │   │
│  │ /var/lib/ │  │ ./src:/app/src│   │
│  │ docker/   │  │               │   │
│  │ volumes/  │  │ Dev only!     │   │
│  └─────┬─────┘  └──────┬────────┘   │
│        │               │             │
│  ┌─────▼───────────────▼──────────┐  │
│  │        Container FS            │  │
│  └────────────────────────────────┘  │
└─────────────────────────────────────┘
```

| Type            | Command                            | Use Case                         |
|-----------------|------------------------------------|----------------------------------|
| **Named Volume** | `-v pgdata:/var/lib/postgresql`   | Database storage, persistent data |
| **Bind Mount**  | `-v ./src:/app/src`                | Development hot-reload           |
| **tmpfs**       | `--tmpfs /tmp`                     | Sensitive data, scratch space    |

```bash
# Create a named volume
docker volume create pgdata

# Run with named volume
docker run -d --name db \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16

# Inspect volume location on host
docker volume inspect pgdata
```

---

## 7. Docker Compose

### Compose File Structure

```yaml
# compose.yaml (v2 syntax — no "version:" field needed since Compose v2)
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: production        # Multi-stage target
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://db:5432/myapp
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
    networks:
      - app-network
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
    profiles:
      - default

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: app
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    networks:
      - app-network
    profiles:
      - cache

volumes:
  pgdata:

networks:
  app-network:
    driver: bridge

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

### Compose CLI Commands

```bash
# Start all services (detached)
docker compose up -d

# Start with specific profile
docker compose --profile cache up -d

# Rebuild images and start
docker compose up -d --build

# View logs for specific service
docker compose logs -f api

# Scale a service
docker compose up -d --scale api=3

# Stop and remove everything (including volumes)
docker compose down -v

# Run one-off command
docker compose run --rm api npm test
```

### Profiles

Use profiles to group optional services (e.g., monitoring, debug tools):

```yaml
services:
  grafana:
    image: grafana/grafana:11
    profiles:
      - monitoring

  jaeger:
    image: jaegertracing/all-in-one:1
    profiles:
      - monitoring
      - tracing
```

```bash
# Start only default services (no profile)
docker compose up -d

# Start with monitoring services
docker compose --profile monitoring up -d
```

---

## 8. Environment Variables and .env Files

```bash
# .env file (auto-loaded by Docker Compose)
POSTGRES_USER=app
POSTGRES_DB=myapp
APP_PORT=3000
NODE_ENV=production
```

```yaml
# compose.yaml — reference .env variables
services:
  api:
    ports:
      - "${APP_PORT:-3000}:3000"    # Default value syntax
    environment:
      NODE_ENV: ${NODE_ENV}
    env_file:
      - .env                         # Explicit load
      - .env.local                   # Override file (gitignored)
```

**Security rule**: Never commit `.env` files with secrets. Use Docker secrets or external secret managers in production. Add `.env*` to `.gitignore` and `.dockerignore`.

---

## 9. Docker Desktop Alternatives

| Tool               | Platform         | License           | Key Advantage                         |
|--------------------|------------------|-------------------|---------------------------------------|
| **Docker Desktop** | macOS/Win/Linux  | Paid (>250 emp.)  | Official, integrated GUI              |
| **OrbStack**       | macOS            | Free (commercial) | Fastest startup, ~60% less RAM        |
| **Colima**         | macOS/Linux      | Free/OSS          | CLI-only, ~400MB RAM idle             |
| **Rancher Desktop**| macOS/Win/Linux  | Free/OSS          | Built-in K8s, containerd or dockerd   |
| **Podman Desktop** | macOS/Win/Linux  | Free/OSS          | Daemonless, rootless, K8s compatible  |

### Quick Setup: Colima (macOS/Linux)

```bash
# Install via Homebrew
brew install colima docker docker-compose

# Start with resource limits
colima start --cpu 4 --memory 8 --disk 60

# Verify Docker CLI works
docker info
docker compose version
```

### Quick Setup: OrbStack (macOS)

```bash
# Install via Homebrew
brew install orbstack

# OrbStack automatically configures Docker CLI
docker run hello-world
```

### Podman as Docker Drop-in

```bash
# Install Podman
brew install podman

# Initialize and start machine
podman machine init
podman machine start

# Alias for Docker compatibility
alias docker=podman

# Run containers (rootless by default)
podman run -d -p 8080:80 nginx:alpine
```

---

## 10. Best Practices

1. **Pin all image versions** — use `image:tag@sha256:digest` for reproducibility, never `:latest` in production.
2. **Use custom bridge networks** — enable DNS-based service discovery; avoid the default bridge.
3. **Set resource limits on every container** — prevent single-container memory/CPU exhaustion via `--memory` and `--cpus`.
4. **Use named volumes for persistent data** — avoid bind mounts in production; named volumes are managed by Docker.
5. **Run one process per container** — keep containers focused; use Compose for multi-service apps.
6. **Add health checks to all services** — enable orchestrator-level restart and dependency management.
7. **Use `.dockerignore` aggressively** — exclude `node_modules`, `.git`, `*.md`, test files from build context.
8. **Leverage Compose profiles** — separate development, testing, and monitoring stacks without multiple files.
9. **Clean up regularly** — schedule `docker system prune` in CI and development; dangling resources waste disk.
10. **Keep images small** — use multi-stage builds, Alpine/distroless bases, and remove caches (see [Dockerfile Best Practices](dockerfile-best-practices.md)).

---

## Anti-Patterns

| Anti-Pattern                          | Problem                                        | Fix                                          |
|---------------------------------------|------------------------------------------------|----------------------------------------------|
| Using `:latest` tag everywhere        | Non-reproducible builds, silent breaking changes | Pin exact versions with SHA digests          |
| Running as root inside containers     | Privilege escalation risk if container escapes  | Add `USER nonroot` in Dockerfile             |
| Storing state in container filesystem | Data lost on container restart/removal          | Use named volumes or external storage        |
| Bind-mounting host paths in production | Tight coupling to host, security risk          | Use named volumes; bind mounts for dev only  |
| Using default bridge network          | No DNS resolution, limited isolation            | Create custom bridge networks                |
| No resource limits                    | One container can starve all others             | Set `--memory` and `--cpus` on every run     |
| Ignoring image size                   | Slow pulls, wasted bandwidth, larger attack surface | Multi-stage builds, minimal base images    |
| Hardcoding secrets in Dockerfiles     | Secrets baked into image layers permanently     | Use Docker secrets, env injection, or vaults |

---

## Enforcement Checklist

- [ ] All production images use pinned versions (no `:latest`)
- [ ] Every container runs with `--memory` and `--cpus` limits
- [ ] Custom bridge networks used for all multi-container setups
- [ ] Named volumes configured for all persistent data
- [ ] `.dockerignore` present and excludes build artifacts, `.git`, secrets
- [ ] Health checks defined for all services in Compose and Dockerfiles
- [ ] No secrets in Dockerfiles, `.env` files excluded from version control
- [ ] `docker system prune` automated in CI cleanup steps
- [ ] Non-root `USER` set in all production Dockerfiles
- [ ] Container security scanning integrated — see [Container Security](../../../08-security/infrastructure-security/container-security.md)
