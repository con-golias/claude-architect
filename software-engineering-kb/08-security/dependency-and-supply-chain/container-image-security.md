# Container Image Security

## Metadata
- **Category**: Dependency and Supply Chain Security
- **Audience**: Software Engineers, DevSecOps, Security Engineers, Platform Engineers
- **Complexity**: Intermediate to Advanced
- **Prerequisites**: Docker/OCI basics, CI/CD pipelines, Linux security fundamentals
- **Last Updated**: 2025-12

---

## Table of Contents

1. [Introduction](#introduction)
2. [Base Image Selection](#base-image-selection)
3. [Image Scanning Tools](#image-scanning-tools)
4. [Vulnerability Remediation](#vulnerability-remediation)
5. [Image Signing](#image-signing)
6. [Registry Security](#registry-security)
7. [Image Provenance](#image-provenance)
8. [Dockerfile Security Best Practices](#dockerfile-security-best-practices)
9. [Runtime Security](#runtime-security)
10. [Image Scanning in CI/CD](#image-scanning-in-cicd)
11. [Admission Controllers for Image Policy](#admission-controllers-for-image-policy)
12. [Best Practices](#best-practices)
13. [Anti-Patterns](#anti-patterns)
14. [Enforcement Checklist](#enforcement-checklist)

---

## Introduction

Container images are the primary deployment artifact for cloud-native applications. A container image encapsulates the application code, its dependencies, the runtime environment, and OS-level packages into a single distributable unit. This makes images a critical target for supply chain attacks: a compromised base image, vulnerable OS package, or malicious dependency affects every container launched from that image.

Container image security spans the entire lifecycle: selecting secure base images, scanning for vulnerabilities during build, signing images for authenticity, securing the registry, enforcing policies at deployment, and hardening the runtime environment.

The attack surface of a container image includes:
- OS packages in the base image
- Application-level dependencies (npm, pip, Go modules, etc.)
- Configuration files and secrets accidentally embedded
- Dockerfile instructions that weaken security
- Runtime permissions and capabilities

---

## Base Image Selection

The base image is the foundation of every container. Selecting the right base image is the single most impactful decision for container security.

### Base Image Categories

| Category | Examples | Size | Packages | Attack Surface | Best For |
|----------|---------|------|----------|---------------|----------|
| Scratch | `scratch` | 0 MB | None | Minimal | Statically compiled Go, Rust |
| Distroless | `gcr.io/distroless/*` | 2-20 MB | Runtime only | Very small | Java, Python, Node.js |
| Minimal | `alpine`, `*-slim` | 5-50 MB | Minimal OS | Small | General purpose |
| Standard | `ubuntu`, `debian` | 70-200 MB | Full OS | Large | Development, debugging |

### Scratch Images

Scratch is an empty image with no operating system, no shell, and no packages. It is suitable only for statically compiled binaries.

```dockerfile
# Go application with scratch base
FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download && go mod verify

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" -o /server ./cmd/server

# Final image: scratch (0 packages, 0 vulnerabilities)
FROM scratch

# Copy CA certificates for HTTPS
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy the binary
COPY --from=builder /server /server

# Non-root user (numeric UID since there is no /etc/passwd)
USER 65534:65534

ENTRYPOINT ["/server"]
```

### Distroless Images (Google)

Distroless images contain only the application runtime (JRE, Python, Node.js) without package managers, shells, or unnecessary OS utilities. This dramatically reduces the attack surface.

```dockerfile
# Node.js application with distroless base
FROM node:20-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY . .
RUN npm run build

# Final image: distroless (no shell, no package manager)
FROM gcr.io/distroless/nodejs20-debian12

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

CMD ["dist/index.js"]
```

```dockerfile
# Java application with distroless base
FROM eclipse-temurin:21-jdk AS builder

WORKDIR /app
COPY . .
RUN ./gradlew build -x test

# Distroless Java base
FROM gcr.io/distroless/java21-debian12

COPY --from=builder /app/build/libs/app.jar /app.jar

EXPOSE 8080
CMD ["app.jar"]
```

```dockerfile
# Python application with distroless base
FROM python:3.12-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/app/deps -r requirements.txt
COPY . .

# Distroless Python base
FROM gcr.io/distroless/python3-debian12

WORKDIR /app
COPY --from=builder /app /app
ENV PYTHONPATH=/app/deps

CMD ["main.py"]
```

### Alpine Images

Alpine Linux uses musl libc (not glibc), which has a smaller attack surface but may cause compatibility issues with some software. Alpine images are significantly smaller than Debian-based images.

```dockerfile
# Node.js with Alpine
FROM node:20-alpine3.19

# Alpine-specific: install only needed packages
RUN apk add --no-cache tini

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY . .

USER node
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/index.js"]
```

### Base Image Selection Decision Tree

```
Is your binary statically compiled?
  |
  +-- Yes (Go, Rust with static linking) --> Use scratch
  |
  +-- No --> Does your app need only the runtime?
              |
              +-- Yes (Java, Node.js, Python) --> Use distroless
              |
              +-- No --> Do you need a package manager in the image?
                          |
                          +-- No --> Use Alpine or slim variant
                          |
                          +-- Yes (debugging, tooling) --> Use slim variant
                                    (Never use full ubuntu/debian in production)
```

---

## Image Scanning Tools

### Trivy

Trivy is a comprehensive scanner for container images, covering OS packages, application dependencies, misconfigurations, and secrets.

```bash
# Scan a container image
trivy image node:20-alpine

# Scan with severity filter
trivy image --severity HIGH,CRITICAL node:20-alpine

# Ignore unfixed vulnerabilities (only show actionable findings)
trivy image --ignore-unfixed node:20-alpine

# Output as JSON
trivy image --format json -o results.json node:20-alpine

# Output as SARIF (for GitHub Security tab)
trivy image --format sarif -o results.sarif node:20-alpine

# Scan for multiple categories
trivy image --scanners vuln,secret,misconfig node:20-alpine

# Scan a local image (not yet pushed)
trivy image --input myapp.tar

# Scan with a specific vulnerability database
trivy image --db-repository ghcr.io/aquasecurity/trivy-db node:20-alpine

# Generate SBOM from image
trivy image --format cyclonedx -o sbom.json node:20-alpine

# Use .trivyignore for false positives
echo "CVE-2023-12345" > .trivyignore
trivy image --ignorefile .trivyignore node:20-alpine
```

### Grype (Anchore)

```bash
# Scan a container image
grype node:20-alpine

# Scan with severity threshold
grype node:20-alpine --fail-on high

# Scan a local image
grype docker:myapp:latest

# Scan from SBOM
grype sbom:sbom.json

# Output as JSON
grype node:20-alpine -o json > results.json

# Show only fixed vulnerabilities (actionable)
grype node:20-alpine --only-fixed

# Use VEX to filter results
grype node:20-alpine --vex vex.json
```

### Snyk Container

```bash
# Scan a container image
snyk container test node:20-alpine

# Scan with severity threshold
snyk container test node:20-alpine --severity-threshold=high

# Scan and suggest base image upgrade
snyk container test node:20-alpine --file=Dockerfile

# Monitor image for new vulnerabilities
snyk container monitor node:20-alpine

# Output as JSON
snyk container test node:20-alpine --json > results.json

# Output as SARIF
snyk container test node:20-alpine --sarif > results.sarif

# Exclude base image vulnerabilities (focus on app layer)
snyk container test myapp:latest --exclude-base-image-vulns
```

### Docker Scout

```bash
# Scan a container image
docker scout cves node:20-alpine

# Show only critical and high vulnerabilities
docker scout cves --only-severity critical,high node:20-alpine

# Compare images
docker scout compare node:20-alpine node:20-slim

# Recommend base image updates
docker scout recommendations node:20-alpine

# Quick overview
docker scout quickview node:20-alpine

# SBOM generation
docker scout sbom node:20-alpine
```

### Clair

Clair is an open-source static analysis tool for container images, commonly used with Harbor and Quay registries.

```bash
# Clair is typically deployed as a service
# Configure with Harbor registry for automatic scanning

# Using clairctl for standalone scanning
clairctl report node:20-alpine

# Output as JSON
clairctl report --format json node:20-alpine > clair-results.json
```

### Tool Comparison

| Feature | Trivy | Grype | Snyk Container | Docker Scout | Clair |
|---------|-------|-------|---------------|-------------|-------|
| OS packages | Yes | Yes | Yes | Yes | Yes |
| App dependencies | Yes | Yes | Yes | Yes | Limited |
| Secrets | Yes | No | No | No | No |
| Misconfigs | Yes | No | Yes | No | No |
| SBOM input | Yes | Yes | No | Yes | No |
| VEX support | Yes | Yes | No | No | No |
| Speed | Fast | Fast | Medium | Fast | Slow |
| License | Apache-2.0 | Apache-2.0 | Proprietary | Proprietary | Apache-2.0 |

---

## Vulnerability Remediation

### Remediation Strategies

| Strategy | When to Use | Example |
|----------|-------------|---------|
| Rebuild with patched base | OS-level vulnerability | Update `FROM node:20.10.0-alpine3.19` to `node:20.11.0-alpine3.19` |
| Update application dependency | App-level vulnerability | Update package.json, rebuild |
| Override transitive dependency | Nested dependency issue | npm overrides, pip constraints |
| Switch base image | Base image EOL or too many vulns | Alpine to distroless |
| Accept risk with VEX | False positive or not exploitable | VEX not_affected statement |

### Automated Base Image Updates

```yaml
# Renovate configuration for Docker base image updates
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "matchPackagePatterns": ["*"],
      "pinDigests": true,
      "automerge": false,
      "labels": ["docker-update", "security"]
    },
    {
      "matchDatasources": ["docker"],
      "matchUpdateTypes": ["patch"],
      "automerge": true,
      "minimumReleaseAge": "3 days"
    }
  ]
}
```

```yaml
# Dependabot configuration for Docker
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "docker"
      - "dependencies"
```

### Rebuild Pipeline on Vulnerability Discovery

```yaml
# GitHub Actions: scheduled rebuild to pick up base image patches
name: Scheduled Security Rebuild
on:
  schedule:
    - cron: '0 6 * * 1'  # Every Monday at 6am UTC
  workflow_dispatch:

jobs:
  rebuild:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build image (no cache to pick up base image updates)
        uses: docker/build-push-action@v5
        with:
          no-cache: true
          push: false
          load: true
          tags: myapp:security-rebuild

      - name: Scan rebuilt image
        uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: myapp:security-rebuild
          severity: HIGH,CRITICAL
          exit-code: '1'

      - name: Push if scan passes
        if: success()
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
```

---

## Image Signing

### Cosign (Sigstore)

```bash
# Sign a container image (keyless, recommended)
cosign sign --yes ghcr.io/myorg/myapp@sha256:abc123...

# Sign with key pair
cosign generate-key-pair
cosign sign --key cosign.key ghcr.io/myorg/myapp@sha256:abc123...

# Verify signature (keyless)
cosign verify \
  --certificate-identity="https://github.com/myorg/myapp/.github/workflows/build.yml@refs/tags/v1.0.0" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/myorg/myapp@sha256:abc123...

# Verify with key pair
cosign verify --key cosign.pub ghcr.io/myorg/myapp@sha256:abc123...
```

### Notary v2 (OCI Distribution)

Notary v2 (also known as Notation) is the OCI-native approach to container image signing.

```bash
# Install notation
# See https://notaryproject.dev/docs/user-guides/installation/

# Generate a test key (development only)
notation cert generate-test --default "mycompany.com"

# Sign an image
notation sign ghcr.io/myorg/myapp@sha256:abc123...

# Verify an image
notation verify ghcr.io/myorg/myapp@sha256:abc123...

# List signatures
notation list ghcr.io/myorg/myapp@sha256:abc123...

# Configure trust policy
cat > trustpolicy.json <<EOF
{
    "version": "1.0",
    "trustPolicies": [
        {
            "name": "production-images",
            "registryScopes": ["ghcr.io/myorg/*"],
            "signatureVerification": {
                "level": "strict"
            },
            "trustStores": ["ca:mycompany"],
            "trustedIdentities": ["x509.subject: C=US, O=My Company"]
        }
    ]
}
EOF
notation policy import trustpolicy.json
```

---

## Registry Security

### Private Registry Configuration

```yaml
# Harbor registry deployment (docker-compose snippet)
# Harbor provides scanning, signing, replication, and access control
version: '3.8'
services:
  harbor-core:
    image: goharbor/harbor-core:v2.10.0
    environment:
      - CORE_SECRET=${CORE_SECRET}
      - REGISTRY_CREDENTIAL_PASSWORD=${REGISTRY_PASSWORD}
    volumes:
      - harbor-data:/data
```

### Access Control

```yaml
# Harbor project configuration
project:
  name: production-images
  access_level: private
  auto_scan: true  # Scan images on push
  prevent_vul: true  # Block images with vulnerabilities
  severity: high  # Threshold for blocking
  content_trust: true  # Require signed images
```

### Registry Security Measures

| Measure | Implementation |
|---------|----------------|
| Authentication | OIDC, LDAP, or local auth |
| Authorization | RBAC with project-level permissions |
| Encryption | TLS for transport, encryption at rest |
| Scanning | Auto-scan on push (Trivy, Clair) |
| Content trust | Require signed images (Cosign, Notary) |
| Replication | Geo-replicate for availability |
| Immutable tags | Prevent tag overwriting |
| Retention policy | Clean up old/untagged images |
| Audit logging | Log all push/pull/delete operations |

### Immutable Tags

```bash
# Configure immutable tags in Harbor (via API)
curl -X PUT "https://harbor.mycompany.com/api/v2.0/projects/production/immutabletagrules" \
  -H "Content-Type: application/json" \
  -d '{
    "tag_selectors": [
      {
        "kind": "doublestar",
        "decoration": "matches",
        "pattern": "v*"
      }
    ],
    "scope_selectors": {
      "repository": [
        {
          "kind": "doublestar",
          "decoration": "repoMatches",
          "pattern": "**"
        }
      ]
    }
  }'
```

### Docker Content Trust (DCT)

```bash
# Enable Docker Content Trust (Notary v1)
export DOCKER_CONTENT_TRUST=1

# Push a signed image (signs automatically with DCT enabled)
docker push ghcr.io/myorg/myapp:v1.0.0

# Pull only signed images (fails if not signed)
docker pull ghcr.io/myorg/myapp:v1.0.0

# Inspect trust data
docker trust inspect --pretty ghcr.io/myorg/myapp
```

---

## Image Provenance

### SLSA Provenance for Containers

```yaml
# GitHub Actions: generate SLSA L3 provenance for container
name: Container with SLSA Provenance
on:
  push:
    tags: ['v*']

permissions: read-all

jobs:
  build:
    outputs:
      image: ghcr.io/${{ github.repository }}
      digest: ${{ steps.build.outputs.digest }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.ref_name }}

  provenance:
    needs: build
    permissions:
      actions: read
      id-token: write
      packages: write
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@v2.0.0
    with:
      image: ${{ needs.build.outputs.image }}
      digest: ${{ needs.build.outputs.digest }}
      registry-username: ${{ github.actor }}
    secrets:
      registry-password: ${{ secrets.GITHUB_TOKEN }}
```

### Docker BuildKit Provenance

```bash
# Build with provenance and SBOM attestations
docker buildx build \
  --provenance=mode=max \
  --sbom=true \
  --tag ghcr.io/myorg/myapp:v1.0.0 \
  --push \
  .

# Inspect provenance
docker buildx imagetools inspect ghcr.io/myorg/myapp:v1.0.0 \
  --format '{{json .Provenance.SLSA}}'

# Inspect SBOM
docker buildx imagetools inspect ghcr.io/myorg/myapp:v1.0.0 \
  --format '{{json .SBOM.SPDX}}'
```

---

## Dockerfile Security Best Practices

### Multi-stage Builds

Multi-stage builds separate the build environment from the runtime environment, ensuring build tools, source code, and intermediate artifacts are not included in the final image.

```dockerfile
# Multi-stage build: separate build and runtime
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (cached layer)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev

# Stage 2: Runtime (minimal image)
FROM node:20-alpine@sha256:abc123... AS runtime

# Install tini for proper signal handling
RUN apk add --no-cache tini

# Create non-root user
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

WORKDIR /app

# Copy only runtime artifacts
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# Run as non-root
USER appuser

# Use tini as init
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/index.js"]
```

### Non-root User

```dockerfile
# Create and use non-root user
# Alpine
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# Debian/Ubuntu
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/bash -m appuser

# Switch to non-root user
USER appuser

# For scratch images, use numeric UID
USER 65534:65534
```

### Pinned Base Image Digests

```dockerfile
# BAD: mutable tag, can change silently
FROM node:20-alpine

# BETTER: pinned version, but tag can still be reassigned
FROM node:20.10.0-alpine3.19

# BEST: pinned by SHA256 digest (immutable)
FROM node:20.10.0-alpine3.19@sha256:7a91aa397f2e2dfbfcdad2e2d72599f374e0b0172be1d86eeb73f1d33f36a4b2
```

### No Secrets in Build Args or Layers

```dockerfile
# BAD: secret in build arg (visible in image history)
ARG DATABASE_PASSWORD
ENV DATABASE_PASSWORD=$DATABASE_PASSWORD

# BAD: secret copied into image
COPY .env /app/.env

# GOOD: use Docker BuildKit secrets
# syntax=docker/dockerfile:1
FROM node:20-alpine

# Mount secret during build (not persisted in layer)
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci

# GOOD: inject secrets at runtime via environment or volume
# Do NOT bake secrets into the image
```

### COPY vs ADD

```dockerfile
# BAD: ADD has auto-extraction and URL fetching (unexpected behavior)
ADD https://example.com/file.tar.gz /app/
ADD archive.tar.gz /app/

# GOOD: COPY is explicit and predictable
COPY archive.tar.gz /app/
RUN tar -xzf /app/archive.tar.gz -C /app/ && rm /app/archive.tar.gz

# GOOD: Use curl/wget for downloading (explicit and cacheable)
RUN curl -fsSL https://example.com/file.tar.gz | tar -xz -C /app/
```

### Minimal Installed Packages

```dockerfile
# Install only what is needed, clean up cache
# Alpine
RUN apk add --no-cache \
    tini \
    curl

# Debian
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    tini \
    curl \
    ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```

### .dockerignore

```
# .dockerignore - exclude unnecessary files from build context
.git
.github
.env
.env.*
*.md
README*
LICENSE
docker-compose*.yml
.dockerignore
Dockerfile
node_modules
.npm
.eslintrc*
.prettierrc*
jest.config.*
tests/
__tests__/
coverage/
.nyc_output/
*.log
.DS_Store
Thumbs.db
```

### Complete Secure Dockerfile

```dockerfile
# syntax=docker/dockerfile:1

# Stage 1: Dependencies
FROM node:20.10.0-alpine3.19@sha256:abc123... AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev

# Stage 2: Build
FROM node:20.10.0-alpine3.19@sha256:abc123... AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

# Stage 3: Runtime
FROM node:20.10.0-alpine3.19@sha256:abc123... AS runtime

# Security: install tini for signal handling, no extra packages
RUN apk add --no-cache tini && \
    addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

WORKDIR /app

# Copy only production dependencies and built output
COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --chown=appuser:appgroup package.json ./

# Security: run as non-root
USER appuser

# Security: expose only the needed port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["node", "-e", "require('http').get('http://localhost:8080/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"]

# Security: use tini as PID 1
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/index.js"]
```

---

## Runtime Security

### Read-only Filesystem

```yaml
# Docker Compose: read-only filesystem
services:
  app:
    image: ghcr.io/myorg/myapp:v1.0.0
    read_only: true
    tmpfs:
      - /tmp:size=100M
    volumes:
      - type: tmpfs
        target: /app/logs
```

```bash
# Docker run: read-only filesystem
docker run --read-only \
  --tmpfs /tmp:size=100M \
  ghcr.io/myorg/myapp:v1.0.0
```

```yaml
# Kubernetes: read-only root filesystem
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: app
      image: ghcr.io/myorg/myapp@sha256:abc123...
      securityContext:
        readOnlyRootFilesystem: true
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        allowPrivilegeEscalation: false
        capabilities:
          drop:
            - ALL
        seccompProfile:
          type: RuntimeDefault
      volumeMounts:
        - name: tmp
          mountPath: /tmp
  volumes:
    - name: tmp
      emptyDir:
        sizeLimit: 100Mi
```

### Dropped Capabilities

```bash
# Drop all capabilities, add only needed ones
docker run \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  ghcr.io/myorg/myapp:v1.0.0
```

```yaml
# Kubernetes: minimal capabilities
securityContext:
  capabilities:
    drop:
      - ALL
    add:
      - NET_BIND_SERVICE  # Only if binding to port < 1024
```

### No New Privileges

```bash
# Prevent privilege escalation
docker run --security-opt=no-new-privileges ghcr.io/myorg/myapp:v1.0.0
```

```yaml
# Kubernetes
securityContext:
  allowPrivilegeEscalation: false
```

### Seccomp Profiles

```json
// custom-seccomp.json - restrict system calls
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": ["SCMP_ARCH_X86_64"],
  "syscalls": [
    {
      "names": [
        "accept", "accept4", "access", "bind", "brk",
        "close", "connect", "epoll_create1", "epoll_ctl",
        "epoll_wait", "exit", "exit_group", "fstat",
        "futex", "getdents64", "getpid", "getsockname",
        "getsockopt", "listen", "mmap", "mprotect",
        "munmap", "open", "openat", "read", "recvfrom",
        "recvmsg", "rt_sigaction", "rt_sigprocmask",
        "sendmsg", "sendto", "setsockopt", "socket",
        "write", "writev"
      ],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

```bash
# Apply custom seccomp profile
docker run --security-opt seccomp=custom-seccomp.json ghcr.io/myorg/myapp:v1.0.0
```

```yaml
# Kubernetes: seccomp profile
securityContext:
  seccompProfile:
    type: RuntimeDefault  # Use container runtime default
    # OR
    # type: Localhost
    # localhostProfile: profiles/custom-seccomp.json
```

### AppArmor and SELinux

```bash
# Docker: apply AppArmor profile
docker run --security-opt apparmor=docker-default ghcr.io/myorg/myapp:v1.0.0

# Docker: apply SELinux label
docker run --security-opt label=level:s0:c100,c200 ghcr.io/myorg/myapp:v1.0.0
```

### Complete Kubernetes PodSecurityContext

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-app
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    runAsGroup: 1001
    fsGroup: 1001
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      image: ghcr.io/myorg/myapp@sha256:abc123...
      securityContext:
        readOnlyRootFilesystem: true
        allowPrivilegeEscalation: false
        capabilities:
          drop:
            - ALL
        seccompProfile:
          type: RuntimeDefault
      resources:
        limits:
          cpu: "500m"
          memory: "256Mi"
        requests:
          cpu: "100m"
          memory: "128Mi"
      volumeMounts:
        - name: tmp
          mountPath: /tmp
  automountServiceAccountToken: false  # Unless needed
  volumes:
    - name: tmp
      emptyDir:
        sizeLimit: 100Mi
```

---

## Image Scanning in CI/CD

### Comprehensive CI/CD Image Security Pipeline

```yaml
# GitHub Actions: complete container security pipeline
name: Container Security Pipeline
on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

permissions:
  contents: read
  packages: write
  security-events: write
  id-token: write

jobs:
  # Step 1: Lint Dockerfile
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Lint Dockerfile
        uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: Dockerfile
          failure-threshold: warning

  # Step 2: Build image
  build:
    needs: lint
    runs-on: ubuntu-latest
    outputs:
      image: ghcr.io/${{ github.repository }}
      digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          push: ${{ github.event_name != 'pull_request' }}
          load: ${{ github.event_name == 'pull_request' }}
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.sha }}
            ghcr.io/${{ github.repository }}:${{ github.ref_name }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # Step 3: Scan image for vulnerabilities
  scan:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: ghcr.io/${{ github.repository }}:${{ github.sha }}
          severity: HIGH,CRITICAL
          exit-code: '1'
          ignore-unfixed: true
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
          category: 'trivy-container'

  # Step 4: Generate SBOM
  sbom:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/')
    steps:
      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: ghcr.io/${{ github.repository }}:${{ github.sha }}
          format: cyclonedx-json
          output-file: sbom.cyclonedx.json

      - name: Upload SBOM
        uses: actions/upload-artifact@v4
        with:
          name: container-sbom
          path: sbom.cyclonedx.json

  # Step 5: Sign image
  sign:
    needs: [build, scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/')
    steps:
      - name: Install Cosign
        uses: sigstore/cosign-installer@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Sign container image
        run: |
          cosign sign --yes \
            ghcr.io/${{ github.repository }}@${{ needs.build.outputs.digest }}
```

---

## Admission Controllers for Image Policy

Admission controllers enforce image policies in Kubernetes, blocking deployments that do not meet security requirements.

### Sigstore Policy Controller

```bash
# Install Sigstore policy-controller
helm repo add sigstore https://sigstore.github.io/helm-charts
helm install policy-controller sigstore/policy-controller \
  -n cosign-system --create-namespace
```

```yaml
# ClusterImagePolicy: require signed images
apiVersion: policy.sigstore.dev/v1beta1
kind: ClusterImagePolicy
metadata:
  name: require-signed-images
spec:
  images:
    - glob: "ghcr.io/myorg/**"
  authorities:
    - keyless:
        url: https://fulcio.sigstore.dev
        identities:
          - issuer: https://token.actions.githubusercontent.com
            subjectRegExp: "https://github.com/myorg/.*"
      ctlog:
        url: https://rekor.sigstore.dev
```

### Kyverno

```yaml
# Kyverno: verify container image signatures
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signatures
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    - name: verify-cosign-signature
      match:
        any:
          - resources:
              kinds:
                - Pod
      verifyImages:
        - imageReferences:
            - "ghcr.io/myorg/*"
          attestors:
            - entries:
                - keyless:
                    subject: "https://github.com/myorg/*"
                    issuer: "https://token.actions.githubusercontent.com"
                    rekor:
                      url: https://rekor.sigstore.dev

    - name: require-non-root
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Containers must run as non-root"
        pattern:
          spec:
            containers:
              - securityContext:
                  runAsNonRoot: true

    - name: deny-privileged
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Privileged containers are not allowed"
        pattern:
          spec:
            containers:
              - securityContext:
                  privileged: false
```

### OPA Gatekeeper

```yaml
# OPA Gatekeeper ConstraintTemplate: allowed registries
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8sallowedregistries
spec:
  crd:
    spec:
      names:
        kind: K8sAllowedRegistries
      validation:
        openAPIV3Schema:
          type: object
          properties:
            registries:
              type: array
              items:
                type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8sallowedregistries

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not startswith(container.image, input.parameters.registries[_])
          msg := sprintf("Image '%v' is not from an allowed registry", [container.image])
        }
---
# Apply the constraint
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sAllowedRegistries
metadata:
  name: allowed-registries
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
  parameters:
    registries:
      - "ghcr.io/myorg/"
      - "gcr.io/distroless/"
```

### Admission Controller Comparison

| Controller | Approach | Image Verification | Policy Language |
|-----------|---------|-------------------|----------------|
| Sigstore policy-controller | Dedicated to signing | Cosign, keyless | YAML policy |
| Kyverno | General-purpose | Cosign, Notary | YAML patterns |
| OPA Gatekeeper | General-purpose | Via custom rules | Rego |
| Connaisseur | Dedicated to signing | Cosign, Notary, DCT | YAML policy |

---

## Best Practices

1. **Use distroless or scratch base images for production.** Distroless images contain no shell, package manager, or unnecessary utilities, reducing the attack surface to the absolute minimum. Use scratch for statically compiled binaries.

2. **Pin base images by SHA256 digest, not by tag.** Tags are mutable and can be reassigned to different image layers. Pinning by digest (e.g., `@sha256:abc123...`) ensures immutability and reproducibility.

3. **Use multi-stage builds to separate build and runtime.** Multi-stage builds ensure that build tools, source code, development dependencies, and intermediate artifacts are excluded from the final image.

4. **Run containers as non-root with minimal capabilities.** Set `USER` in the Dockerfile, configure `runAsNonRoot: true` and `allowPrivilegeEscalation: false` in Kubernetes, and drop all capabilities with `capabilities.drop: ALL`.

5. **Scan images in CI/CD and block deployment of vulnerable images.** Integrate Trivy, Grype, or Snyk Container into the build pipeline. Fail the build on critical and high severity vulnerabilities with available fixes.

6. **Sign all production container images with Cosign.** Use keyless signing in CI/CD pipelines. Verify signatures before deployment using admission controllers (Sigstore policy-controller, Kyverno).

7. **Enable read-only root filesystem.** Set `readOnlyRootFilesystem: true` in the container security context. Provide writable tmpfs mounts only for directories that require writes (e.g., /tmp).

8. **Rebuild images regularly to incorporate base image patches.** Schedule weekly or more frequent rebuilds (with `--no-cache`) to pick up security updates in the base image. Use Dependabot or Renovate to track base image updates.

9. **Never embed secrets in container images.** Do not use `ARG` or `ENV` for secrets, do not `COPY` credential files, and do not embed secrets in any build layer. Inject secrets at runtime via environment variables, mounted volumes, or secret managers.

10. **Enforce image policies with admission controllers.** Deploy Kyverno, OPA Gatekeeper, or Sigstore policy-controller to enforce that only signed images from approved registries with passing vulnerability scans can be deployed to production clusters.

---

## Anti-Patterns

1. **Using `latest` tag for base images or deployments.** The `latest` tag is mutable and can change without notice. It breaks reproducibility and makes vulnerability tracking impossible. Always use specific version tags pinned by digest.

2. **Running containers as root.** Many official images default to root. Always add a non-root user in the Dockerfile and set `USER` before the `CMD`/`ENTRYPOINT`. Running as root means a container escape gives full host access.

3. **Using full OS images (ubuntu, debian) as base for production.** Full OS images contain hundreds of packages, most of which are unnecessary. Each package is a potential vulnerability. Use distroless, Alpine, or slim variants.

4. **Embedding secrets in Dockerfile layers.** Any secret added via `COPY`, `ADD`, `ARG`, or `ENV` is permanently stored in the image layer history, even if deleted in a subsequent layer. Use BuildKit secret mounts or runtime injection.

5. **Skipping image scanning to speed up the pipeline.** Security scanning adds minutes to the pipeline but prevents deploying vulnerable images to production. The time cost of a security incident far exceeds the time saved by skipping scans.

6. **Using ADD instead of COPY.** `ADD` has implicit behavior (auto-extraction, URL fetching) that can introduce unexpected files. `COPY` is explicit and predictable. Use `COPY` unless you specifically need tar extraction.

7. **Not using .dockerignore.** Without `.dockerignore`, the build context may include `.git`, `.env`, `node_modules`, and other files that bloat the image and may expose secrets.

8. **Allowing any registry in Kubernetes.** Without admission controllers that restrict registries, any user can deploy images from untrusted public registries. Enforce a list of approved registries.

---

## Enforcement Checklist

### Base Image
- [ ] Production images use distroless, scratch, or Alpine/slim base
- [ ] Base images are pinned by SHA256 digest
- [ ] Base image updates are tracked (Dependabot, Renovate)
- [ ] Base images are rebuilt regularly (at least weekly)

### Dockerfile Security
- [ ] Multi-stage builds separate build and runtime
- [ ] Final stage runs as non-root user
- [ ] No secrets in build args, env vars, or COPY instructions
- [ ] COPY used instead of ADD
- [ ] Only necessary packages are installed
- [ ] .dockerignore excludes unnecessary files
- [ ] Dockerfile passes hadolint linting

### Image Scanning
- [ ] Images are scanned in CI/CD on every build
- [ ] Builds fail on critical/high vulnerabilities with available fixes
- [ ] SARIF results upload to security dashboard
- [ ] Unfixed vulnerabilities are tracked with VEX statements
- [ ] Scans cover both OS packages and application dependencies
- [ ] Multiple scanning tools are used for coverage

### Image Signing and Provenance
- [ ] All production images are signed with Cosign
- [ ] Images are signed by digest (not tag)
- [ ] SLSA provenance is generated for release images
- [ ] SBOM is generated and attached to images
- [ ] Signatures are recorded in Rekor transparency log

### Registry Security
- [ ] Private registry is used for production images
- [ ] Registry enforces authentication and RBAC
- [ ] Auto-scanning is enabled on push
- [ ] Immutable tags are configured for release versions
- [ ] Audit logging is enabled for all registry operations

### Runtime Security
- [ ] Containers run as non-root (runAsNonRoot: true)
- [ ] Root filesystem is read-only (readOnlyRootFilesystem: true)
- [ ] Privilege escalation is disabled (allowPrivilegeEscalation: false)
- [ ] All capabilities are dropped (capabilities.drop: ALL)
- [ ] Seccomp profile is applied (RuntimeDefault minimum)
- [ ] Resource limits are set (CPU, memory)
- [ ] Service account token is not auto-mounted unless needed

### Admission Control
- [ ] Admission controller is deployed (Kyverno, Gatekeeper, or policy-controller)
- [ ] Only approved registries are allowed
- [ ] Image signatures are verified at admission
- [ ] Privileged containers are blocked
- [ ] Non-root requirement is enforced
- [ ] Image tag policies are enforced (no latest, require digest)
