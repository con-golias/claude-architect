# Code Signing and Artifact Verification

## Metadata
- **Category**: Dependency and Supply Chain Security
- **Audience**: Software Engineers, DevSecOps, Security Engineers, Platform Engineers
- **Complexity**: Intermediate to Advanced
- **Prerequisites**: Cryptographic fundamentals (public/private keys, hashing), CI/CD pipelines, container basics
- **Last Updated**: 2025-12

---

## Table of Contents

1. [Introduction](#introduction)
2. [Why Sign Code and Artifacts](#why-sign-code-and-artifacts)
3. [Sigstore Ecosystem](#sigstore-ecosystem)
4. [Container Image Signing with Cosign](#container-image-signing-with-cosign)
5. [GPG Signing](#gpg-signing)
6. [Code Signing Certificates](#code-signing-certificates)
7. [npm Package Signing and Provenance](#npm-package-signing-and-provenance)
8. [Python Package Signing](#python-package-signing)
9. [Go Module Checksums](#go-module-checksums)
10. [Transparency Logs](#transparency-logs)
11. [Artifact Attestation](#artifact-attestation)
12. [GitHub Artifact Attestations](#github-artifact-attestations)
13. [Signature Verification in CI/CD](#signature-verification-in-cicd)
14. [Best Practices](#best-practices)
15. [Anti-Patterns](#anti-patterns)
16. [Enforcement Checklist](#enforcement-checklist)

---

## Introduction

Code signing is the process of applying a cryptographic signature to a software artifact (binary, container image, package, commit, or any digital asset) to verify its authenticity and integrity. It answers two fundamental questions:

1. **Who produced this artifact?** (Authentication)
2. **Has it been modified since it was signed?** (Integrity)

Without code signing, consumers of software artifacts have no reliable way to verify that an artifact was produced by its claimed author or that it has not been tampered with during distribution. This gap is exploited in supply chain attacks where attackers substitute legitimate artifacts with malicious ones.

Code signing has historically been difficult due to key management complexity. The Sigstore project has dramatically simplified signing through keyless, identity-based signing that eliminates the need for long-lived keys.

---

## Why Sign Code and Artifacts

### Threats Addressed by Signing

| Threat | Without Signing | With Signing |
|--------|----------------|--------------|
| Artifact tampering | Undetectable | Signature verification fails |
| Impersonation | No way to verify author | Signature proves identity |
| MITM during distribution | Modified artifact accepted | Signature mismatch detected |
| Compromised mirror | Malicious artifact served | Signature does not match |
| Rollback attack | Old vulnerable version served | Version in signature metadata |
| Build system compromise | Injected code undetected | Provenance attestation missing |

### What to Sign

| Artifact Type | Signing Method | Verification Method |
|--------------|----------------|---------------------|
| Git commits | GPG/SSH signatures | `git verify-commit` |
| Container images | Cosign (Sigstore) | `cosign verify` |
| Binary artifacts | Cosign, GPG, Authenticode | Tool-specific verification |
| npm packages | npm provenance (Sigstore) | `npm audit signatures` |
| Python packages | Sigstore for Python | `sigstore verify` |
| Go modules | go.sum checksum db | `go mod verify` |
| Helm charts | Cosign, GPG | `helm verify` |
| OCI artifacts | Cosign, Notary v2 | Tool-specific verification |

---

## Sigstore Ecosystem

Sigstore is an open-source project that provides free, easy-to-use code signing and verification. It eliminates the need for long-lived signing keys by using short-lived certificates tied to OIDC identities.

### Sigstore Components

| Component | Purpose | Analogy |
|-----------|---------|---------|
| Cosign | Sign and verify containers/blobs | The signing tool |
| Fulcio | Certificate authority for signing certs | The identity verifier |
| Rekor | Transparency log for signatures | The public notary |

### How Keyless Signing Works

```
1. Developer authenticates via OIDC (GitHub, Google, etc.)
                    |
                    v
2. Fulcio issues short-lived certificate (10 minutes)
   Certificate binds OIDC identity to signing key
                    |
                    v
3. Developer signs artifact with ephemeral key
                    |
                    v
4. Signature + certificate recorded in Rekor transparency log
                    |
                    v
5. Ephemeral private key is destroyed
                    |
                    v
6. Verifier checks: Rekor log + Fulcio certificate + OIDC identity
```

Advantages of keyless signing:
- No long-lived keys to manage, rotate, or protect
- Identity is tied to OIDC provider (GitHub, Google, Microsoft)
- All signatures are recorded in a public transparency log
- Short-lived certificates limit the window of key compromise
- No key revocation needed (certificates expire in minutes)

### Installing Cosign

```bash
# macOS
brew install cosign

# Linux (using Go)
go install github.com/sigstore/cosign/v2/cmd/cosign@latest

# Download binary (Linux amd64)
curl -LO https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64
chmod +x cosign-linux-amd64
mv cosign-linux-amd64 /usr/local/bin/cosign

# Verify Cosign installation (Cosign is itself signed with Cosign)
cosign verify-blob --yes \
  --certificate cosign-linux-amd64.cert \
  --signature cosign-linux-amd64.sig \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  cosign-linux-amd64
```

---

## Container Image Signing with Cosign

### Keyless Signing (Recommended)

```bash
# Sign a container image (keyless, OIDC-based)
cosign sign --yes ghcr.io/myorg/myapp:v1.0.0

# This will:
# 1. Authenticate you via browser-based OIDC
# 2. Request a certificate from Fulcio
# 3. Sign the image
# 4. Upload signature to Rekor transparency log
# 5. Push signature to the container registry

# Verify the signature
cosign verify \
  --certificate-identity=user@example.com \
  --certificate-oidc-issuer=https://accounts.google.com \
  ghcr.io/myorg/myapp:v1.0.0

# Verify with GitHub Actions OIDC identity
cosign verify \
  --certificate-identity="https://github.com/myorg/myapp/.github/workflows/build.yml@refs/tags/v1.0.0" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/myorg/myapp:v1.0.0

# Verify with regex pattern for identity
cosign verify \
  --certificate-identity-regexp="https://github.com/myorg/.*" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/myorg/myapp:v1.0.0
```

### Key-pair Signing

```bash
# Generate a key pair (for environments without OIDC)
cosign generate-key-pair

# Sign with private key
cosign sign --key cosign.key ghcr.io/myorg/myapp:v1.0.0

# Verify with public key
cosign verify --key cosign.pub ghcr.io/myorg/myapp:v1.0.0

# Store key in KMS
cosign generate-key-pair --kms awskms:///alias/cosign-key
cosign sign --key awskms:///alias/cosign-key ghcr.io/myorg/myapp:v1.0.0
cosign verify --key awskms:///alias/cosign-key ghcr.io/myorg/myapp:v1.0.0
```

### Signing in CI/CD (GitHub Actions)

```yaml
# GitHub Actions: sign container image with Cosign
name: Build and Sign Container
on:
  push:
    tags: ['v*']

permissions:
  contents: read
  packages: write
  id-token: write  # Required for keyless signing

jobs:
  build-sign:
    runs-on: ubuntu-latest
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

      - name: Install Cosign
        uses: sigstore/cosign-installer@v3

      - name: Sign container image (keyless)
        run: |
          cosign sign --yes \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}

      - name: Verify signature
        run: |
          cosign verify \
            --certificate-identity="https://github.com/${{ github.repository }}/.github/workflows/build.yml@${{ github.ref }}" \
            --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}
```

### Attaching Metadata to Signed Images

```bash
# Attach an SBOM to a container image
cosign attach sbom --sbom sbom.cyclonedx.json ghcr.io/myorg/myapp:v1.0.0

# Attest provenance (in-toto format)
cosign attest --yes \
  --predicate provenance.json \
  --type slsaprovenance \
  ghcr.io/myorg/myapp:v1.0.0

# Attest custom metadata
cosign attest --yes \
  --predicate scan-results.json \
  --type vuln \
  ghcr.io/myorg/myapp:v1.0.0

# Verify attestation
cosign verify-attestation \
  --type slsaprovenance \
  --certificate-identity-regexp="https://github.com/myorg/.*" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/myorg/myapp:v1.0.0
```

---

## GPG Signing

GPG (GNU Privacy Guard) is the traditional method for signing git commits, tags, packages, and files. While Sigstore is preferred for new implementations, GPG remains widely used for git signing and Linux package management.

### Git Commit Signing with GPG

```bash
# Generate a GPG key
gpg --full-generate-key
# Choose RSA and RSA, 4096 bits, key does not expire

# List GPG keys
gpg --list-secret-keys --keyid-format=long

# Configure Git to use GPG signing
git config --global user.signingkey ABCDEF1234567890
git config --global commit.gpgsign true
git config --global tag.gpgsign true

# Sign a commit
git commit -S -m "Signed commit message"

# Sign a tag
git tag -s v1.0.0 -m "Signed release v1.0.0"

# Verify a signed commit
git verify-commit HEAD
git log --show-signature -1

# Verify a signed tag
git verify-tag v1.0.0

# Export public key for GitHub/GitLab
gpg --armor --export ABCDEF1234567890
# Paste the output into GitHub Settings > SSH and GPG keys
```

### Git Commit Signing with SSH

```bash
# Configure Git to use SSH signing (Git 2.34+)
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true

# Configure allowed signers file for verification
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers

# Create allowed signers file
echo "user@example.com ssh-ed25519 AAAAC3NzaC1..." > ~/.ssh/allowed_signers

# Sign a commit
git commit -S -m "SSH-signed commit"

# Verify
git verify-commit HEAD
```

### GPG Signing for Package Files

```bash
# Sign a file
gpg --armor --detach-sign my-package.tar.gz
# Creates my-package.tar.gz.asc

# Verify a signed file
gpg --verify my-package.tar.gz.asc my-package.tar.gz

# Sign with a specific key
gpg --armor --detach-sign --default-key ABCDEF1234567890 my-package.tar.gz

# Clear-sign a file (signature embedded in the file)
gpg --clearsign checksums.txt
```

---

## Code Signing Certificates

### Authenticode (Windows)

Authenticode is Microsoft's code signing technology for Windows executables, drivers, and scripts.

```powershell
# Sign an executable with a code signing certificate
# Using SignTool (from Windows SDK)
signtool sign /fd SHA256 /t http://timestamp.digicert.com /f certificate.pfx /p password MyApp.exe

# Sign with hardware token (EV certificate)
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /sha1 THUMBPRINT MyApp.exe

# Verify signature
signtool verify /pa /v MyApp.exe

# Sign a PowerShell script
Set-AuthenticodeSignature -FilePath .\script.ps1 -Certificate $cert -TimestampServer http://timestamp.digicert.com
```

### Apple Code Signing

```bash
# Sign a macOS application
codesign --sign "Developer ID Application: My Company (TEAMID)" \
  --timestamp \
  --options runtime \
  MyApp.app

# Verify signature
codesign --verify --deep --strict MyApp.app

# Notarize with Apple (required for distribution)
xcrun notarytool submit MyApp.zip \
  --apple-id "developer@example.com" \
  --password "app-specific-password" \
  --team-id TEAMID

# Staple notarization ticket
xcrun stapler staple MyApp.app

# Verify notarization
spctl --assess --verbose=4 --type execute MyApp.app
```

### Code Signing Certificate Types

| Type | Validation | Use Case | Trust Level |
|------|-----------|----------|-------------|
| Self-signed | None | Internal/development | Low |
| OV (Organization Validated) | Organization verified | General distribution | Medium |
| EV (Extended Validation) | Extensive organization verification | High-trust distribution | High |
| Keyless (Sigstore) | OIDC identity | Open-source, CI/CD | High |

---

## npm Package Signing and Provenance

### npm Provenance

npm provenance (introduced in npm v9.5.0) uses Sigstore to generate and publish a provenance attestation that links a published package to its source repository and build.

```bash
# Publish a package with provenance (from GitHub Actions)
npm publish --provenance

# Verify provenance of installed packages
npm audit signatures

# View provenance of a specific package
npm view <package-name> --json | jq '.dist.attestations'
```

```yaml
# GitHub Actions: publish npm package with provenance
name: Publish npm Package
on:
  release:
    types: [published]

permissions:
  contents: read
  id-token: write  # Required for npm provenance

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm test

      # Publish with provenance attestation
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Verifying npm Package Integrity

```bash
# Verify all packages in the project have valid signatures
npm audit signatures

# Output shows:
# audited 150 packages in 3s
# 145 packages have verified registry signatures
# 5 packages have verified attestations

# Check if a specific package has provenance
npm view express --json | jq '.dist'
```

---

## Python Package Signing

### Sigstore for Python

```bash
# Install sigstore for Python
pip install sigstore

# Sign a Python distribution
sigstore sign dist/mypackage-1.0.0.tar.gz

# This creates:
# dist/mypackage-1.0.0.tar.gz.sigstore.json (bundle)

# Verify a signed distribution
sigstore verify identity \
  --cert-identity user@example.com \
  --cert-oidc-issuer https://accounts.google.com \
  dist/mypackage-1.0.0.tar.gz

# Verify with GitHub Actions identity
sigstore verify identity \
  --cert-identity "https://github.com/myorg/mypackage/.github/workflows/publish.yml@refs/tags/v1.0.0" \
  --cert-oidc-issuer "https://token.actions.githubusercontent.com" \
  dist/mypackage-1.0.0.tar.gz
```

```yaml
# GitHub Actions: sign and publish Python package
name: Publish Python Package
on:
  release:
    types: [published]

permissions:
  contents: read
  id-token: write  # For Sigstore and PyPI trusted publishing

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: pypi
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Build package
        run: |
          pip install build
          python -m build

      - name: Sign with Sigstore
        run: |
          pip install sigstore
          sigstore sign dist/*

      - name: Publish to PyPI (trusted publishing)
        uses: pypa/gh-action-pypi-publish@release/v1
        # No password needed - uses OIDC trusted publishing
```

### PyPI Trusted Publishers

PyPI Trusted Publishers use OIDC to authenticate GitHub Actions workflows for package publishing, eliminating the need for long-lived API tokens.

```yaml
# Configure in PyPI project settings:
# Publisher: GitHub Actions
# Repository owner: myorg
# Repository name: mypackage
# Workflow name: publish.yml
# Environment name: pypi
```

---

## Go Module Checksums

Go has built-in module verification through the checksum database (sum.golang.org).

### How Go Checksum Verification Works

```
go get example.com/module@v1.0.0
        |
        v
1. Download module from proxy (proxy.golang.org)
        |
        v
2. Compute hash of module contents (go.sum format: h1:SHA256)
        |
        v
3. Verify hash against checksum database (sum.golang.org)
        |
        v
4. Record verified hash in go.sum
        |
        v
5. Future builds verify against go.sum (any mismatch = build failure)
```

### go.sum File

```
// go.sum - records verified checksums
golang.org/x/crypto v0.16.0 h1:mR0SJwGZkXVzs6RlPJp4ZJR+cEjlYcF...
golang.org/x/crypto v0.16.0/go.mod h1:gCAAfMLgwOJRpTjQ2zCCt2OcSfYMTeZ...
github.com/gin-gonic/gin v1.9.1 h1:4idEAncQnU5cB7BeOkPtxjfCS...
github.com/gin-gonic/gin v1.9.1/go.mod h1:hPrL/0KcuZQP7...
```

### Verifying Go Modules

```bash
# Verify all module checksums
go mod verify

# Output: all modules verified

# If verification fails:
# verifying github.com/example/module@v1.0.0: checksum mismatch
# This indicates the module has been tampered with

# Configure private modules (skip public sumdb)
export GOPRIVATE="github.com/mycompany/*"
export GONOSUMDB="github.com/mycompany/*"

# Disable the checksum database (NOT recommended for public modules)
# export GONOSUMCHECK="*"

# Use a specific sum database
export GOSUMDB="sum.golang.org"
```

### Go Module Proxy

```bash
# Use the default Go module proxy (recommended)
export GOPROXY="https://proxy.golang.org,direct"

# Use a private proxy for internal modules
export GOPROXY="https://goproxy.mycompany.com,https://proxy.golang.org,direct"

# Direct download only (no proxy)
export GOPROXY="direct"
```

---

## Transparency Logs

Transparency logs are append-only, tamper-evident data structures that record cryptographic operations (signatures, certificates, checksums) for public verification. They ensure that signing operations cannot be silently repudiated.

### Rekor (Sigstore Transparency Log)

```bash
# Install rekor-cli
go install github.com/sigstore/rekor/cmd/rekor-cli@latest

# Search for entries by email
rekor-cli search --email user@example.com

# Search for entries by artifact hash
rekor-cli search --sha sha256:abc123...

# Get a specific entry
rekor-cli get --uuid 24296fb24b8ad77aed13...

# Verify an artifact against Rekor
rekor-cli verify --artifact my-app.tar.gz \
  --signature my-app.tar.gz.sig \
  --pki-format x509 \
  --public-key signing-cert.pem

# Upload a signature to Rekor
rekor-cli upload --artifact my-app.tar.gz \
  --signature my-app.tar.gz.sig \
  --pki-format x509 \
  --public-key signing-cert.pem
```

### Certificate Transparency (CT)

Certificate Transparency logs record all TLS certificates issued by certificate authorities. This is relevant to code signing because it provides a model for detecting unauthorized certificate issuance.

```bash
# Query Certificate Transparency logs
# Using crt.sh
curl -s "https://crt.sh/?q=example.com&output=json" | jq '.[0]'
```

### Transparency Log Properties

| Property | Description |
|----------|-------------|
| Append-only | New entries can only be added, never removed |
| Tamper-evident | Any modification to existing entries is detectable |
| Publicly verifiable | Anyone can verify the integrity of the log |
| Cryptographically secured | Merkle tree ensures consistency |
| Non-repudiable | Signers cannot deny having signed |

---

## Artifact Attestation

Attestation is a signed statement about an artifact. Unlike a simple signature (which only proves who signed what), an attestation includes structured metadata about the artifact.

### Attestation Types

| Type | Predicate | Content |
|------|-----------|---------|
| SLSA Provenance | `https://slsa.dev/provenance/v1` | Build provenance |
| SBOM | `https://cyclonedx.org/bom` | Software bill of materials |
| Vulnerability scan | `https://cosign.sigstore.dev/attestation/vuln/v1` | Scan results |
| Custom | Custom URI | Any structured metadata |

### Creating Attestations with Cosign

```bash
# Create a provenance attestation
cosign attest --yes \
  --predicate provenance.json \
  --type slsaprovenance \
  ghcr.io/myorg/myapp@sha256:abc123...

# Create an SBOM attestation
cosign attest --yes \
  --predicate sbom.cyclonedx.json \
  --type cyclonedx \
  ghcr.io/myorg/myapp@sha256:abc123...

# Create a vulnerability scan attestation
cosign attest --yes \
  --predicate scan-results.json \
  --type vuln \
  ghcr.io/myorg/myapp@sha256:abc123...

# Create a custom attestation
cosign attest --yes \
  --predicate custom-metadata.json \
  --type https://mycompany.com/attestation/compliance/v1 \
  ghcr.io/myorg/myapp@sha256:abc123...

# Verify attestations
cosign verify-attestation \
  --type slsaprovenance \
  --certificate-identity-regexp="https://github.com/myorg/.*" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/myorg/myapp@sha256:abc123...

# List all attestations on an image
cosign tree ghcr.io/myorg/myapp@sha256:abc123...
```

---

## GitHub Artifact Attestations

GitHub provides built-in artifact attestation that generates SLSA-compatible provenance attestations using Sigstore.

```yaml
# GitHub Actions: generate artifact attestation
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

      - name: Build binary
        run: |
          go build -trimpath -ldflags="-s -w" -o myapp ./cmd/myapp

      - name: Attest build provenance
        uses: actions/attest-build-provenance@v1
        with:
          subject-path: myapp

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: myapp
          path: myapp

  container:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write
      attestations: write
    steps:
      - uses: actions/checkout@v4

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
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.ref_name }}

      - name: Attest container image
        uses: actions/attest-build-provenance@v1
        with:
          subject-name: ghcr.io/${{ github.repository }}
          subject-digest: ${{ steps.build.outputs.digest }}
          push-to-registry: true

      - name: Attest SBOM
        uses: actions/attest-sbom@v1
        with:
          subject-name: ghcr.io/${{ github.repository }}
          subject-digest: ${{ steps.build.outputs.digest }}
          sbom-path: sbom.cyclonedx.json
          push-to-registry: true
```

### Verifying GitHub Attestations

```bash
# Verify artifact attestation with gh CLI
gh attestation verify myapp \
  --owner myorg

# Verify container image attestation
gh attestation verify oci://ghcr.io/myorg/myapp:v1.0.0 \
  --owner myorg

# Verify with specific repository
gh attestation verify myapp \
  --repo myorg/myapp

# Output detailed attestation information
gh attestation verify myapp \
  --owner myorg \
  --format json
```

---

## Signature Verification in CI/CD

### Pre-deployment Verification Pipeline

```yaml
# GitHub Actions: verify signatures before deployment
name: Verified Deployment
on:
  workflow_dispatch:
    inputs:
      image_tag:
        description: 'Image tag to deploy'
        required: true

permissions:
  contents: read
  packages: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Install Cosign
        uses: sigstore/cosign-installer@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      # Step 1: Verify image signature
      - name: Verify image signature
        run: |
          cosign verify \
            --certificate-identity-regexp="https://github.com/myorg/myapp/.*" \
            --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
            ghcr.io/myorg/myapp:${{ inputs.image_tag }}

      # Step 2: Verify SLSA provenance attestation
      - name: Verify provenance
        run: |
          cosign verify-attestation \
            --type slsaprovenance \
            --certificate-identity-regexp="https://github.com/slsa-framework/.*" \
            --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
            ghcr.io/myorg/myapp:${{ inputs.image_tag }}

      # Step 3: Verify vulnerability scan attestation
      - name: Verify vulnerability scan
        run: |
          cosign verify-attestation \
            --type vuln \
            --certificate-identity-regexp="https://github.com/myorg/.*" \
            --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
            ghcr.io/myorg/myapp:${{ inputs.image_tag }}

  deploy:
    needs: verify
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to production
        run: |
          echo "All verifications passed. Deploying..."
          # kubectl set image deployment/myapp myapp=ghcr.io/myorg/myapp:${{ inputs.image_tag }}
```

### Kubernetes Admission Policy for Signed Images

```yaml
# Sigstore policy-controller: require signed images
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

---

## Best Practices

1. **Use keyless signing with Sigstore for all CI/CD artifacts.** Keyless signing eliminates the complexity and risk of long-lived key management. OIDC-based identity ties signatures to verifiable CI/CD identities.

2. **Sign all container images before pushing to a registry.** Every container image deployed to production must have a valid Cosign signature. Use the image digest (not tag) for signing to ensure immutability.

3. **Require signed commits on protected branches.** Configure branch protection rules to require signed commits (GPG or SSH). This ensures every change has a verified author identity.

4. **Verify signatures before every deployment.** Integrate `cosign verify` and `slsa-verifier` into the deployment pipeline. Block deployment of any artifact that fails verification.

5. **Use transparency logs (Rekor) for all signatures.** Recording signatures in a transparency log provides non-repudiation and allows third-party auditing of signing activity.

6. **Publish npm packages with provenance.** Use `npm publish --provenance` from GitHub Actions. This generates Sigstore-backed provenance attestations that consumers can verify with `npm audit signatures`.

7. **Attach SBOMs and vulnerability scan results as attestations.** Use `cosign attest` to bind additional metadata to artifacts. This creates a verifiable chain of evidence about each artifact.

8. **Use GitHub Artifact Attestations for GitHub-hosted projects.** GitHub's built-in attestation support provides a simple path to SLSA-compatible provenance with minimal configuration.

9. **Implement admission controllers for image signature verification.** Use Sigstore policy-controller, Kyverno, or OPA Gatekeeper to enforce that only signed images can be deployed to Kubernetes clusters.

10. **Rotate signing keys if using key-pair signing.** If keyless signing is not feasible, rotate signing keys annually or after any suspected compromise. Store keys in hardware security modules (HSMs) or cloud KMS.

---

## Anti-Patterns

1. **Storing signing keys in CI environment variables.** CI secrets can be leaked through log output, compromised workflows, or stolen credentials. Use keyless signing or KMS-backed keys instead.

2. **Signing with mutable tags instead of digests.** Signing `ghcr.io/myorg/myapp:latest` is meaningless because the tag can be reassigned. Always sign by digest: `ghcr.io/myorg/myapp@sha256:...`.

3. **Generating signatures but not verifying them.** Signing without verification provides no security. Implement verification in every deployment path and admission controller.

4. **Using self-signed certificates for production code signing.** Self-signed certificates do not prove identity because anyone can create one with any claimed identity. Use Sigstore (keyless) or CA-issued certificates.

5. **Ignoring `npm audit signatures` failures.** When `npm audit signatures` reports packages with invalid or missing signatures, investigate immediately. This may indicate a supply chain attack.

6. **Signing only release builds but not pre-release or staging.** Attackers can target non-production environments to establish persistence. Sign all artifacts consistently across all environments.

7. **Not recording signatures in transparency logs.** Without a transparency log, signed artifacts can be silently replaced. Rekor provides tamper-evident recording of all signing operations.

8. **Using GPG keys without expiration dates.** GPG keys without expiration remain valid indefinitely, even after the owner loses control. Set expiration dates and rotate keys on schedule.

---

## Enforcement Checklist

### Container Image Signing
- [ ] All container images are signed with Cosign before deployment
- [ ] Images are signed by digest, not by tag
- [ ] Keyless signing is used in CI/CD (Sigstore OIDC)
- [ ] Signatures are recorded in Rekor transparency log
- [ ] Admission controllers enforce signed images in Kubernetes

### Git Signing
- [ ] All commits on protected branches are signed (GPG or SSH)
- [ ] Branch protection rules require signed commits
- [ ] Signing keys are registered on GitHub/GitLab
- [ ] GPG keys have expiration dates and are rotated

### Package Signing
- [ ] npm packages are published with `--provenance`
- [ ] Python packages are signed with Sigstore
- [ ] Go module checksums are verified (go.sum, sumdb)
- [ ] Package consumers verify signatures (`npm audit signatures`)

### Attestation
- [ ] Build provenance attestations are generated (SLSA format)
- [ ] SBOM attestations are attached to release artifacts
- [ ] Vulnerability scan results are attested
- [ ] Attestations are signed with Sigstore (keyless)
- [ ] GitHub Artifact Attestations are enabled for GitHub-hosted projects

### Verification
- [ ] `cosign verify` is integrated into the deployment pipeline
- [ ] `slsa-verifier` validates provenance before deployment
- [ ] Verification failures block deployment to production
- [ ] Verification identity (issuer, subject) is explicitly configured
- [ ] Failed verifications generate security alerts

### Key Management
- [ ] Keyless signing is preferred over key-pair signing
- [ ] If key-pair signing is used, keys are stored in KMS/HSM
- [ ] Signing keys are rotated on schedule (annually minimum)
- [ ] Key compromise incident response procedure is documented
- [ ] Transparency log entries are monitored for unauthorized signing
