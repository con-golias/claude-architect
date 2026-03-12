# SLSA Framework (Supply-chain Levels for Software Artifacts)

## Metadata
- **Category**: Dependency and Supply Chain Security
- **Audience**: Software Engineers, DevSecOps, Security Engineers, Platform Engineers
- **Complexity**: Intermediate to Advanced
- **Prerequisites**: CI/CD pipelines, container builds, cryptographic signing basics
- **Last Updated**: 2025-12

---

## Table of Contents

1. [Introduction](#introduction)
2. [What Is SLSA](#what-is-slsa)
3. [SLSA Levels](#slsa-levels)
4. [Build Provenance](#build-provenance)
5. [Build Platform Requirements](#build-platform-requirements)
6. [SLSA for GitHub Actions](#slsa-for-github-actions)
7. [SLSA for Containers](#slsa-for-containers)
8. [Provenance Verification](#provenance-verification)
9. [Sigstore Integration](#sigstore-integration)
10. [In-toto Framework](#in-toto-framework)
11. [SLSA Adoption Path](#slsa-adoption-path)
12. [SLSA v1.0 Specification Details](#slsa-v10-specification-details)
13. [Best Practices](#best-practices)
14. [Anti-Patterns](#anti-patterns)
15. [Enforcement Checklist](#enforcement-checklist)

---

## Introduction

Software supply chain attacks exploit the gap between source code and the artifacts that users consume. An attacker does not need to compromise the source code if they can inject malicious code during the build, packaging, or distribution stages. The SolarWinds SUNBURST attack demonstrated this: the source code in the repository was clean, but the build system injected a backdoor into the compiled artifacts.

SLSA (pronounced "salsa") is a security framework that addresses this gap by defining levels of assurance for how software artifacts are built and distributed. It provides a common language for describing build integrity and a graduated path for organizations to improve their supply chain security posture.

SLSA was originally created at Google based on their internal "Binary Authorization for Borg" (BAB) system and is now maintained as an open-source specification by the OpenSSF (Open Source Security Foundation).

---

## What Is SLSA

SLSA is a specification for describing and improving the integrity of software supply chains. It defines:

1. **Levels of assurance** (L0-L3) that describe increasing security guarantees
2. **Build provenance** as the primary artifact that establishes trust
3. **Build platform requirements** that the build system must meet
4. **Verification procedures** for consumers to validate provenance

### Core Concepts

| Concept | Definition |
|---------|------------|
| Artifact | Any software output (binary, container, package) |
| Provenance | Metadata describing how an artifact was built |
| Build platform | The system that runs the build (GitHub Actions, Cloud Build) |
| Source | The version-controlled code from which artifacts are built |
| Dependencies | External inputs consumed during the build |
| Attestation | Signed statement about an artifact (in-toto format) |

### The Problem SLSA Solves

```
Source Code ----[BUILD]----> Artifact ----[DISTRIBUTE]----> Consumer

   Is this the same code?    Was the build tampered with?    Is the artifact authentic?
   Was the repo compromised?  Was malware injected?          Was it modified in transit?
```

Without SLSA, consumers cannot verify:
- That the artifact was built from the claimed source code
- That the build process was not tampered with
- That no unauthorized modifications were made after the build
- Who built the artifact and on what platform

With SLSA provenance:
- The build platform attests to what source code was used
- The attestation is cryptographically signed
- Consumers can verify the provenance before using the artifact
- Tampering at any stage is detectable

---

## SLSA Levels

### SLSA v1.0 Build Track

SLSA v1.0 (released April 2023) defines a single Build Track with four levels:

| Level | Name | Requirements | Security Guarantee |
|-------|------|-------------|-------------------|
| L0 | No guarantees | None | No supply chain security |
| L1 | Provenance exists | Build provenance is generated | Establishes artifact origin |
| L2 | Hosted build | Build runs on hosted service | Prevents build tampering by developers |
| L3 | Hardened builds | Builds are hardened against tampering | Prevents tampering by build platform insiders |

### Level 0: No Guarantees

Level 0 represents the default state of most software. There is no provenance, no signed attestation, and no way for consumers to verify how the artifact was built.

### Level 1: Provenance Exists

At Level 1, the build process generates provenance metadata describing how the artifact was built. The provenance is signed by the build platform but the build process does not need to run on a hosted service.

Requirements:
- Provenance is generated describing the build
- Provenance follows the SLSA provenance format
- Provenance is available to consumers
- The build platform signs the provenance

What L1 does NOT guarantee:
- The build platform is trustworthy
- The provenance is accurate (build could be tampered with)
- The source code is unmodified

### Level 2: Hosted Build Platform

At Level 2, the build runs on a hosted build platform (like GitHub Actions, Google Cloud Build, or GitLab CI). The hosted platform generates provenance that consumers can verify.

Additional requirements over L1:
- Build runs on a hosted, multi-tenant build platform
- Provenance is generated by the build platform (not the build script)
- Provenance is authenticated (signed by the platform)
- Provenance includes the build platform identity

What L2 guarantees:
- The provenance is authentic (signed by a trusted build platform)
- The build actually ran on the claimed platform
- Individual developers cannot forge provenance

What L2 does NOT guarantee:
- The build platform itself is secure against insider threats
- The build is isolated from other tenants
- The build is reproducible

### Level 3: Hardened Builds

At Level 3, the build platform provides hardened, isolated build environments that resist tampering even by platform insiders.

Additional requirements over L2:
- Builds run in ephemeral, isolated environments
- Build environments are hardened against tampering
- Provenance is unforgeable (no single insider can forge it)
- Secret material is not exposed to the build process
- Build scripts are defined in version control (not modifiable at build time)

What L3 guarantees:
- Even a compromised build platform insider cannot inject malicious code without detection
- Builds are isolated from each other
- The provenance accurately reflects the build that was performed
- The source code that was built matches what is claimed

---

## Build Provenance

### What Is Build Provenance

Build provenance is a verifiable metadata document that describes how a software artifact was produced. It answers three critical questions:

1. **What source code was used?** (Git repository, commit hash, branch)
2. **What build platform was used?** (GitHub Actions, Cloud Build)
3. **What build recipe was executed?** (Workflow file, build commands)

### Provenance Format (in-toto Attestation)

SLSA provenance uses the in-toto attestation format with the SLSA provenance predicate.

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [
    {
      "name": "my-app",
      "digest": {
        "sha256": "a1b2c3d4e5f6789..."
      }
    }
  ],
  "predicateType": "https://slsa.dev/provenance/v1",
  "predicate": {
    "buildDefinition": {
      "buildType": "https://actions.github.io/buildtypes/workflow/v1",
      "externalParameters": {
        "workflow": {
          "ref": "refs/heads/main",
          "repository": "https://github.com/myorg/my-app",
          "path": ".github/workflows/build.yml"
        }
      },
      "internalParameters": {
        "github": {
          "event_name": "push",
          "repository_id": "123456789",
          "repository_owner_id": "987654321"
        }
      },
      "resolvedDependencies": [
        {
          "uri": "git+https://github.com/myorg/my-app@refs/heads/main",
          "digest": {
            "gitCommit": "abc123def456..."
          }
        }
      ]
    },
    "runDetails": {
      "builder": {
        "id": "https://github.com/slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@refs/tags/v2.0.0"
      },
      "metadata": {
        "invocationId": "https://github.com/myorg/my-app/actions/runs/12345",
        "startedOn": "2024-01-15T10:30:00Z",
        "finishedOn": "2024-01-15T10:35:00Z"
      }
    }
  }
}
```

### Provenance Components

| Component | Description | Example |
|-----------|-------------|---------|
| Subject | The artifact(s) this provenance describes | `{"name": "my-app", "digest": {"sha256": "..."}}` |
| Builder | Identity of the build platform | GitHub Actions workflow URI |
| Source | Repository and commit that was built | `git+https://github.com/org/repo@refs/heads/main` |
| Build type | Type of build that was performed | `https://actions.github.io/buildtypes/workflow/v1` |
| Parameters | Inputs to the build | Workflow parameters, environment |
| Dependencies | External inputs consumed during build | Resolved dependency versions |
| Metadata | Build timing and invocation details | Start time, build ID |

---

## Build Platform Requirements

### Hermetic Builds

A hermetic build is one that depends only on its declared inputs. It does not fetch dependencies or data from the network during the build. This prevents build-time supply chain attacks where a dependency is swapped during the build.

```dockerfile
# Hermetic build example: vendor all dependencies
FROM golang:1.22-alpine AS builder

# Copy module files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Verify module checksums
RUN go mod verify

# Copy source code
COPY . .

# Build with vendored dependencies (no network)
RUN CGO_ENABLED=0 GOOS=linux go build \
    -mod=readonly \
    -ldflags="-s -w" \
    -o /app \
    ./cmd/server

# Final image
FROM scratch
COPY --from=builder /app /app
ENTRYPOINT ["/app"]
```

### Reproducible Builds

A reproducible build produces the same artifact given the same inputs. This allows independent verification that the artifact matches the source code.

```dockerfile
# Reproducible build: pin everything
FROM golang:1.22.0-alpine3.19@sha256:abc123... AS builder

# Set reproducible build flags
ENV CGO_ENABLED=0
ENV GOOS=linux
ENV GOARCH=amd64
ENV GOFLAGS="-trimpath"

COPY go.mod go.sum ./
RUN go mod download && go mod verify

COPY . .

# Build with deterministic flags
RUN go build \
    -mod=readonly \
    -trimpath \
    -ldflags="-s -w -buildid=" \
    -o /app \
    ./cmd/server

FROM scratch
COPY --from=builder /app /app
ENTRYPOINT ["/app"]
```

Key requirements for reproducible builds:
- Pin all dependency versions (including build tools)
- Use deterministic compiler flags (`-trimpath`, `-buildid=`)
- Do not embed timestamps or hostnames
- Pin base images by SHA256 digest
- Use consistent build environments

### Isolated Builds

Build isolation ensures that builds cannot interfere with each other or access shared resources.

| Isolation Level | Description | SLSA Level |
|----------------|-------------|------------|
| None | Shared build agent, persistent state | L0-L1 |
| Container | Container-isolated build steps | L2 |
| VM | Virtual machine per build | L2-L3 |
| Ephemeral VM | Fresh VM for each build, destroyed after | L3 |

### Ephemeral Build Environments

```yaml
# GitHub Actions: ephemeral runners (default behavior)
jobs:
  build:
    runs-on: ubuntu-latest  # Fresh VM for each job
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build

# Self-hosted runners: configure auto-scaling ephemeral runners
# Use actions/runner to create ephemeral self-hosted runners
# that are destroyed after each job
```

---

## SLSA for GitHub Actions

### slsa-github-generator

The `slsa-github-generator` project provides reusable GitHub Actions workflows for generating SLSA Level 3 provenance.

### Generic Artifact Provenance (SLSA L3)

```yaml
# .github/workflows/slsa-build.yml
name: SLSA Build
on:
  push:
    tags: ['v*']

permissions: read-all

jobs:
  # Step 1: Build the artifact
  build:
    runs-on: ubuntu-latest
    outputs:
      digest: ${{ steps.hash.outputs.digest }}
      artifact-name: ${{ steps.build.outputs.name }}
    steps:
      - uses: actions/checkout@v4

      - name: Build artifact
        id: build
        run: |
          npm ci
          npm run build
          tar -czf my-app.tar.gz dist/
          echo "name=my-app.tar.gz" >> $GITHUB_OUTPUT

      - name: Compute digest
        id: hash
        run: |
          DIGEST=$(sha256sum my-app.tar.gz | awk '{print $1}')
          echo "digest=sha256:${DIGEST}" >> $GITHUB_OUTPUT

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: my-app
          path: my-app.tar.gz

  # Step 2: Generate SLSA provenance
  provenance:
    needs: build
    permissions:
      actions: read
      id-token: write
      contents: write
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v2.0.0
    with:
      base64-subjects: |
        ${{ needs.build.outputs.digest }} my-app.tar.gz
      upload-assets: true  # Upload provenance as release asset
```

### Container Image Provenance (SLSA L3)

```yaml
# .github/workflows/slsa-container.yml
name: SLSA Container Build
on:
  push:
    tags: ['v*']

permissions: read-all

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image: ${{ steps.image.outputs.image }}
      digest: ${{ steps.build.outputs.digest }}
    permissions:
      contents: read
      packages: write

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

      - name: Build and push image
        id: build
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.ref_name }}

      - name: Output image info
        id: image
        run: |
          echo "image=ghcr.io/${{ github.repository }}" >> $GITHUB_OUTPUT

  # Generate SLSA provenance for container
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

### Go Binary Provenance (SLSA L3)

```yaml
# .github/workflows/slsa-go.yml
name: SLSA Go Build
on:
  push:
    tags: ['v*']

permissions: read-all

jobs:
  build:
    permissions:
      id-token: write
      contents: write
      actions: read
    uses: slsa-framework/slsa-github-generator/.github/workflows/builder_go_slsa3.yml@v2.0.0
    with:
      go-version: '1.22'
      evaluated-envs: "VERSION:${{ github.ref_name }}"
      config-file: .slsa-goreleaser.yml
```

```yaml
# .slsa-goreleaser.yml
version: 1
env:
  - GO111MODULE=on
  - CGO_ENABLED=0

goos:
  - linux
  - darwin
  - windows

goarch:
  - amd64
  - arm64

main: ./cmd/myapp
binary: myapp
ldflags:
  - "-s -w"
  - "-X main.version={{ .Env.VERSION }}"
  - "-buildid="
flags:
  - -trimpath
```

### GitHub Artifact Attestations

GitHub provides built-in attestation support as a simpler alternative to slsa-github-generator.

```yaml
# .github/workflows/attest.yml
name: Build with Attestation
on:
  push:
    tags: ['v*']

permissions:
  contents: read
  id-token: write
  attestations: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build artifact
        run: |
          npm ci
          npm run build
          tar -czf my-app.tar.gz dist/

      - name: Generate artifact attestation
        uses: actions/attest-build-provenance@v1
        with:
          subject-path: my-app.tar.gz

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: my-app
          path: my-app.tar.gz
```

```bash
# Verify GitHub artifact attestation
gh attestation verify my-app.tar.gz \
  --owner myorg \
  --repo my-app
```

---

## SLSA for Containers

### Container Build with SLSA Provenance

```yaml
# Complete container pipeline with SLSA L3 provenance
name: Container SLSA Pipeline
on:
  push:
    branches: [main]
    tags: ['v*']

permissions: read-all

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    outputs:
      image: ${{ steps.meta.outputs.image }}
      digest: ${{ steps.build.outputs.digest }}
    permissions:
      contents: read
      packages: write

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

      - name: Docker meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha

      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

  # SLSA provenance generation
  provenance:
    needs: build-and-push
    permissions:
      actions: read
      id-token: write
      packages: write
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@v2.0.0
    with:
      image: ${{ needs.build-and-push.outputs.image }}
      digest: ${{ needs.build-and-push.outputs.digest }}
      registry-username: ${{ github.actor }}
    secrets:
      registry-password: ${{ secrets.GITHUB_TOKEN }}

  # Verify provenance
  verify:
    needs: [build-and-push, provenance]
    runs-on: ubuntu-latest
    steps:
      - name: Install slsa-verifier
        uses: slsa-framework/slsa-verifier/actions/installer@v2.6.0

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Verify provenance
        run: |
          slsa-verifier verify-image \
            ${{ needs.build-and-push.outputs.image }}@${{ needs.build-and-push.outputs.digest }} \
            --source-uri github.com/${{ github.repository }} \
            --source-tag ${{ github.ref_name }}
```

---

## Provenance Verification

### slsa-verifier

The `slsa-verifier` tool verifies SLSA provenance for artifacts and container images.

```bash
# Install slsa-verifier
go install github.com/slsa-framework/slsa-verifier/v2/cli/slsa-verifier@latest

# Verify a generic artifact
slsa-verifier verify-artifact my-app.tar.gz \
  --provenance-path my-app.tar.gz.intoto.jsonl \
  --source-uri github.com/myorg/my-app \
  --source-tag v1.0.0

# Verify with builder ID check
slsa-verifier verify-artifact my-app.tar.gz \
  --provenance-path my-app.tar.gz.intoto.jsonl \
  --source-uri github.com/myorg/my-app \
  --builder-id https://github.com/slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@refs/tags/v2.0.0

# Verify a container image
slsa-verifier verify-image ghcr.io/myorg/my-app@sha256:abc123... \
  --source-uri github.com/myorg/my-app

# Verify with specific source branch
slsa-verifier verify-image ghcr.io/myorg/my-app@sha256:abc123... \
  --source-uri github.com/myorg/my-app \
  --source-branch main

# Print verified provenance (for inspection)
slsa-verifier verify-artifact my-app.tar.gz \
  --provenance-path my-app.tar.gz.intoto.jsonl \
  --source-uri github.com/myorg/my-app \
  --print-provenance
```

### Verification in CI/CD

```yaml
# GitHub Actions: verify provenance before deployment
name: Deploy with Verification
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to deploy'
        required: true

jobs:
  verify-and-deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Install slsa-verifier
        uses: slsa-framework/slsa-verifier/actions/installer@v2.6.0

      - name: Download release artifact
        run: |
          gh release download ${{ inputs.version }} \
            --repo myorg/my-app \
            --pattern "my-app.tar.gz" \
            --pattern "my-app.tar.gz.intoto.jsonl"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Verify provenance
        run: |
          slsa-verifier verify-artifact my-app.tar.gz \
            --provenance-path my-app.tar.gz.intoto.jsonl \
            --source-uri github.com/myorg/my-app \
            --source-tag ${{ inputs.version }}

      - name: Deploy (only after verification)
        run: |
          echo "Provenance verified - deploying..."
          # deployment steps here
```

### Verification Policy

```yaml
# verification-policy.yml
policy:
  name: "Production Deployment Policy"
  description: "Artifacts must have verified SLSA L3 provenance"
  rules:
    - name: "Require SLSA L3 provenance"
      type: slsa-provenance
      level: 3
      source:
        uri: "github.com/myorg/*"
        branch: "main"
      builder:
        id: "https://github.com/slsa-framework/slsa-github-generator/*"

    - name: "Container images must have provenance"
      type: container-provenance
      registries:
        - "ghcr.io/myorg/*"
      require-signature: true
      require-provenance: true
```

---

## Sigstore Integration

Sigstore provides the cryptographic infrastructure that SLSA provenance relies on for signing and verification.

### Sigstore Components for SLSA

| Component | Role in SLSA |
|-----------|-------------|
| Cosign | Signs artifacts and provenance attestations |
| Fulcio | Issues short-lived signing certificates (keyless) |
| Rekor | Records signatures in tamper-evident transparency log |

### Signing Provenance with Cosign

```bash
# Sign an artifact (keyless via OIDC)
cosign sign-blob --yes my-app.tar.gz \
  --bundle my-app.tar.gz.cosign.bundle

# Verify the signature
cosign verify-blob my-app.tar.gz \
  --bundle my-app.tar.gz.cosign.bundle \
  --certificate-identity=build@myorg.com \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com

# Attest provenance to a container image
cosign attest --yes \
  --predicate provenance.json \
  --type slsaprovenance \
  ghcr.io/myorg/my-app@sha256:abc123...

# Verify attestation on a container image
cosign verify-attestation \
  --type slsaprovenance \
  --certificate-identity-regexp=".*@myorg.com" \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  ghcr.io/myorg/my-app@sha256:abc123...
```

### Keyless Signing in CI/CD

```yaml
# GitHub Actions: keyless signing with Sigstore
name: Sign and Attest
on:
  push:
    tags: ['v*']

permissions:
  contents: read
  id-token: write  # Required for OIDC token (keyless signing)
  packages: write

jobs:
  sign:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: sigstore/cosign-installer@v3

      - name: Build artifact
        run: |
          npm ci && npm run build
          tar -czf my-app.tar.gz dist/

      - name: Sign artifact (keyless)
        run: |
          cosign sign-blob --yes my-app.tar.gz \
            --bundle my-app.tar.gz.cosign.bundle

      - name: Verify signature
        run: |
          cosign verify-blob my-app.tar.gz \
            --bundle my-app.tar.gz.cosign.bundle \
            --certificate-identity="https://github.com/myorg/my-app/.github/workflows/sign.yml@refs/tags/${{ github.ref_name }}" \
            --certificate-oidc-issuer="https://token.actions.githubusercontent.com"
```

---

## In-toto Framework

In-toto is a framework for securing the integrity of software supply chains. SLSA provenance is formatted as in-toto attestations. In-toto defines a broader layout concept where each step in the supply chain is attested to and verified.

### In-toto Layout

```json
{
  "_type": "https://in-toto.io/Layout/v1",
  "steps": [
    {
      "name": "checkout",
      "expectedMaterials": [],
      "expectedProducts": [
        ["MATCH", "src/*", "WITH", "PRODUCTS", "FROM", "checkout"]
      ],
      "pubkeys": ["builder-key-id"],
      "threshold": 1
    },
    {
      "name": "build",
      "expectedMaterials": [
        ["MATCH", "src/*", "WITH", "PRODUCTS", "FROM", "checkout"]
      ],
      "expectedProducts": [
        ["CREATE", "dist/app.js"]
      ],
      "pubkeys": ["builder-key-id"],
      "threshold": 1
    },
    {
      "name": "test",
      "expectedMaterials": [
        ["MATCH", "dist/app.js", "WITH", "PRODUCTS", "FROM", "build"]
      ],
      "expectedProducts": [],
      "pubkeys": ["tester-key-id"],
      "threshold": 1
    }
  ],
  "inspect": [
    {
      "name": "verify-no-extra-files",
      "expectedMaterials": [
        ["MATCH", "dist/app.js", "WITH", "PRODUCTS", "FROM", "build"]
      ],
      "run": ["sha256sum", "dist/app.js"]
    }
  ]
}
```

### In-toto Link Metadata

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [
    {
      "name": "dist/app.js",
      "digest": {
        "sha256": "abc123..."
      }
    }
  ],
  "predicateType": "https://in-toto.io/Link/v1",
  "predicate": {
    "name": "build",
    "command": ["npm", "run", "build"],
    "materials": {
      "src/index.ts": {
        "sha256": "def456..."
      },
      "package-lock.json": {
        "sha256": "ghi789..."
      }
    },
    "products": {
      "dist/app.js": {
        "sha256": "abc123..."
      }
    },
    "byproducts": {
      "stdout": "Build completed successfully",
      "stderr": "",
      "return-value": 0
    },
    "environment": {
      "NODE_VERSION": "20.10.0"
    }
  }
}
```

---

## SLSA Adoption Path

### Phased Adoption Strategy

| Phase | Target Level | Timeline | Key Actions |
|-------|-------------|----------|-------------|
| 1 | L1 | Month 1-2 | Generate provenance for all builds |
| 2 | L2 | Month 3-4 | Move builds to hosted platform |
| 3 | L2+ | Month 5-8 | Add provenance verification, harden CI |
| 4 | L3 | Month 9-12 | Implement hardened builds, full verification |

### Phase 1: Achieve SLSA L1

```yaml
# Minimal SLSA L1: generate provenance
name: Build with Provenance
on: push

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
      attestations: write
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - run: tar -czf app.tar.gz dist/

      # Generate provenance attestation (L1)
      - uses: actions/attest-build-provenance@v1
        with:
          subject-path: app.tar.gz
```

### Phase 2: Achieve SLSA L2

Ensure all builds run on GitHub Actions (hosted platform) and use the platform's provenance generation rather than custom scripts.

### Phase 3: Hardening Toward L3

```yaml
# Hardening measures for L3
permissions: read-all  # Restrict all permissions

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read  # Minimal permissions
    steps:
      # Pin all actions to SHA
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11

      # No self-hosted runners (use GitHub-hosted)
      # No manual script modifications
      # No shared build caches across workflows
      # No network access during build (where possible)
```

### Phase 4: Full SLSA L3

Use `slsa-github-generator` reusable workflows as shown in the "SLSA for GitHub Actions" section above.

---

## SLSA v1.0 Specification Details

### Build Track vs Source Track

SLSA v1.0 focuses on the Build Track. A Source Track (covering source code integrity) is planned for future versions.

| Track | Focus | Status |
|-------|-------|--------|
| Build | How artifacts are built | Finalized (v1.0) |
| Source | How source code is managed | Draft |
| Dependencies | How dependencies are managed | Planned |

### Provenance Requirements by Level

| Requirement | L1 | L2 | L3 |
|-------------|----|----|----|
| Provenance exists | Yes | Yes | Yes |
| Provenance is signed | Best effort | By platform | Unforgeable |
| Build on hosted platform | No | Yes | Yes |
| Build isolation | No | No | Yes |
| Ephemeral environment | No | No | Yes |
| Parameterless build | No | No | Yes |
| Provenance non-falsifiable | No | No | Yes |

### Threat Model

SLSA explicitly models these threats:

| Threat | L1 | L2 | L3 |
|--------|----|----|----|
| Developer modifies source after review | No | No | Partial |
| Build platform compromise | No | No | Yes |
| Developer forges provenance | No | Yes | Yes |
| Upload modified artifact | Partial | Yes | Yes |
| Compromise dependency | No | No | No* |

*SLSA Build Track does not address dependency compromise. That is planned for the Dependencies Track.

---

## Best Practices

1. **Start at SLSA Level 1 and progress incrementally.** Generate provenance for all builds immediately. Move to hosted platforms (L2) and then hardened builds (L3) over months, not all at once.

2. **Use slsa-github-generator for SLSA L3 on GitHub Actions.** The reusable workflows provided by the SLSA project are the easiest path to L3 provenance on GitHub. They handle signing, attestation, and provenance format automatically.

3. **Pin all GitHub Actions to full commit SHAs.** Tags are mutable and can be reassigned. Pinning to SHAs prevents an attacker from modifying an action after you have verified it.

4. **Verify provenance before deployment.** Use `slsa-verifier` in your deployment pipeline to verify that artifacts have valid provenance from trusted builders and source repositories.

5. **Use keyless signing via Sigstore.** Keyless signing eliminates the need to manage long-lived signing keys. OIDC-based identity from GitHub Actions, Google Cloud Build, or other providers ties signatures to verifiable identities.

6. **Generate provenance for container images, not just binaries.** Container images are the primary deployment artifact for many organizations. Use the container-specific SLSA generators and attach provenance to OCI images.

7. **Implement hermetic builds.** Download all dependencies before the build starts and build without network access. This prevents build-time dependency substitution attacks.

8. **Set minimal workflow permissions.** Use `permissions: read-all` at the workflow level and grant specific permissions only to jobs that need them. Never use `permissions: write-all`.

9. **Store provenance alongside artifacts.** Attach provenance as release assets, OCI attestations, or in-toto bundles. Make provenance discoverable so consumers can verify it.

10. **Monitor the SLSA specification for new tracks.** The Source Track and Dependencies Track will provide additional supply chain protections. Plan to adopt them as they are finalized.

---

## Anti-Patterns

1. **Self-attesting provenance.** Generating provenance within the same build script that produces the artifact provides no security. Provenance must be generated by the build platform, not the build script.

2. **Using self-hosted runners without hardening for L2/L3.** Self-hosted runners that persist state between builds, share resources, or lack isolation do not meet L2 or L3 requirements.

3. **Generating provenance but not verifying it.** Provenance is only valuable if consumers verify it. Generating provenance without verification is compliance theater.

4. **Using mutable tags for build inputs.** If your build uses `docker pull node:20` instead of `node:20@sha256:...`, the input is non-deterministic and provenance claims about inputs are unreliable.

5. **Skipping provenance for "internal" services.** Internal services are often the most attractive targets for attackers. Apply SLSA provenance to all production artifacts, not just externally distributed ones.

6. **Storing signing keys in CI environment variables.** Long-lived signing keys in CI secrets can be extracted. Use keyless signing (Sigstore/Fulcio) or hardware security modules instead.

7. **Granting broad permissions to build workflows.** Workflows with `contents: write`, `packages: write`, and `id-token: write` all at once create an unnecessarily large attack surface. Apply least privilege.

8. **Treating SLSA compliance as a one-time certification.** SLSA is a continuous practice, not a one-time achievement. Build configurations change, new dependencies are added, and new threats emerge. Regularly reassess your SLSA posture.

---

## Enforcement Checklist

### SLSA Level 1
- [ ] Build provenance is generated for all artifacts
- [ ] Provenance follows SLSA v1.0 format (in-toto attestation)
- [ ] Provenance includes builder identity, source reference, and build parameters
- [ ] Provenance is available to artifact consumers
- [ ] Provenance is signed (best effort)

### SLSA Level 2
- [ ] All builds run on a hosted build platform (GitHub Actions, Cloud Build, etc.)
- [ ] Provenance is generated by the build platform (not the build script)
- [ ] Provenance is authenticated (signed by the platform)
- [ ] Build platform identity is included in provenance
- [ ] Provenance cannot be forged by individual developers

### SLSA Level 3
- [ ] Builds run in ephemeral, isolated environments
- [ ] Build environments are destroyed after each build
- [ ] Build parameters are defined in version control (not modifiable at build time)
- [ ] Provenance is unforgeable (no single insider can forge it)
- [ ] Secret material is not exposed to the build process
- [ ] slsa-github-generator (or equivalent) is used for provenance generation

### Verification
- [ ] slsa-verifier is integrated into the deployment pipeline
- [ ] Provenance is verified before any deployment to production
- [ ] Source repository and branch are verified in provenance
- [ ] Builder identity is verified in provenance
- [ ] Verification failures block deployment

### Infrastructure
- [ ] GitHub Actions are pinned to full commit SHAs
- [ ] Workflow permissions use minimal `permissions: read-all` default
- [ ] Keyless signing is used (Sigstore/Fulcio)
- [ ] Provenance is stored alongside artifacts (release assets, OCI attestations)
- [ ] Container images include provenance attestations

### Process
- [ ] SLSA adoption roadmap is documented with target levels and timelines
- [ ] All build configurations are in version control
- [ ] Build and provenance changes require code review
- [ ] SLSA level is tracked and reported for all production artifacts
- [ ] Regular assessment against SLSA requirements is performed
