# Dependency Management Security

## Metadata
- **Category**: Dependency and Supply Chain Security
- **Audience**: Software Engineers, DevSecOps, Security Engineers
- **Complexity**: Intermediate to Advanced
- **Prerequisites**: Package manager basics, CI/CD fundamentals
- **Last Updated**: 2025-12

---

## Table of Contents

1. [Introduction](#introduction)
2. [Version Pinning Strategies](#version-pinning-strategies)
3. [Lock Files](#lock-files)
4. [Automated Dependency Updates](#automated-dependency-updates)
5. [Evaluating Dependency Health](#evaluating-dependency-health)
6. [Transitive Dependency Risks](#transitive-dependency-risks)
7. [Dependency Confusion Attacks](#dependency-confusion-attacks)
8. [License Compliance](#license-compliance)
9. [Vendoring vs Registry](#vendoring-vs-registry)
10. [Minimal Dependency Principle](#minimal-dependency-principle)
11. [Monorepo Dependency Management](#monorepo-dependency-management)
12. [Best Practices](#best-practices)
13. [Anti-Patterns](#anti-patterns)
14. [Enforcement Checklist](#enforcement-checklist)

---

## Introduction

Dependency management is the first line of defense in supply chain security. Modern applications rely on hundreds or thousands of third-party packages, each representing a potential entry point for attackers. A single compromised dependency can cascade through the entire supply chain, affecting every application that consumes it.

The security of your application is only as strong as the weakest dependency in your dependency tree. This guide covers the strategies, tools, and practices required to maintain secure dependency management across all stages of the software development lifecycle.

Key objectives of secure dependency management:

- Ensure reproducible builds through deterministic dependency resolution
- Minimize exposure to known vulnerabilities through timely updates
- Reduce attack surface through minimal dependency selection
- Prevent supply chain attacks through verification and monitoring
- Maintain license compliance across the dependency tree

---

## Version Pinning Strategies

### Exact Version Pinning

Exact version pinning specifies the precise version of a dependency to install. This provides maximum reproducibility and prevents unexpected changes from entering the build.

```json
// package.json - exact pinning
{
  "dependencies": {
    "express": "4.18.2",
    "lodash": "4.17.21",
    "axios": "1.6.2"
  }
}
```

```toml
# Cargo.toml - exact pinning
[dependencies]
serde = "=1.0.193"
tokio = "=1.35.0"
reqwest = "=0.11.23"
```

```txt
# requirements.txt - exact pinning
Django==4.2.8
requests==2.31.0
cryptography==41.0.7
```

```go
// go.mod - Go uses exact versions by default
require (
    github.com/gin-gonic/gin v1.9.1
    github.com/lib/pq v1.10.9
    golang.org/x/crypto v0.16.0
)
```

### Version Ranges and Their Risks

Version ranges allow automatic updates within defined boundaries. While convenient, they introduce non-determinism and potential security risks.

```json
// package.json - version ranges (RISKY without lock file)
{
  "dependencies": {
    "express": "^4.18.0",   // Allows 4.x.x (minor + patch)
    "lodash": "~4.17.0",    // Allows 4.17.x (patch only)
    "axios": ">=1.0.0"      // Allows any version >= 1.0.0 (DANGEROUS)
  }
}
```

The caret (`^`) operator is the default for npm and allows minor and patch updates. The tilde (`~`) operator restricts to patch updates only. Open ranges (`>=`, `*`, `latest`) must never be used in production code because they allow arbitrary future versions, including potentially compromised ones.

### Pinning Strategy by Environment

| Environment | Strategy | Rationale |
|-------------|----------|-----------|
| Production apps | Exact pins + lock file | Reproducibility, security |
| Libraries | Ranges (caret/tilde) | Flexibility for consumers |
| CI/CD tooling | Exact pins + lock file | Build reproducibility |
| Development | Ranges with lock file | Convenience with safety |
| Docker base images | SHA256 digest | Immutability guarantee |

### Docker Image Pinning

```dockerfile
# BAD: Mutable tag, can change without notice
FROM node:20-alpine

# GOOD: Pinned to exact digest
FROM node:20-alpine@sha256:a1b2c3d4e5f6...

# GOOD: Pinned major.minor.patch with digest
FROM node:20.10.0-alpine3.19@sha256:a1b2c3d4e5f6...
```

---

## Lock Files

Lock files record the exact resolved version of every direct and transitive dependency, including integrity hashes. They are the single most important mechanism for reproducible and secure builds.

### Lock File by Ecosystem

| Ecosystem | Lock File | Integrity Hash |
|-----------|-----------|----------------|
| npm | `package-lock.json` | SHA-512 |
| Yarn | `yarn.lock` | SHA-512 |
| pnpm | `pnpm-lock.yaml` | SHA-512 |
| Go | `go.sum` | SHA-256 (h1:) |
| Python (Pipenv) | `Pipfile.lock` | SHA-256 |
| Python (Poetry) | `poetry.lock` | SHA-256 |
| Rust | `Cargo.lock` | SHA-256 (checksum) |
| Ruby | `Gemfile.lock` | SHA-256 |
| .NET | `packages.lock.json` | SHA-512 |

### Lock File Rules

1. Always commit lock files to version control
2. Never manually edit lock files
3. Use `--frozen-lockfile` (or equivalent) in CI/CD
4. Review lock file changes in pull requests
5. Regenerate lock files only when intentionally updating dependencies

### CI/CD Lock File Enforcement

```yaml
# GitHub Actions - enforce frozen lockfile
name: Build
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # npm: fail if lock file is out of sync
      - run: npm ci

      # yarn: fail if lock file is out of sync
      # - run: yarn install --frozen-lockfile

      # pnpm: fail if lock file is out of sync
      # - run: pnpm install --frozen-lockfile

      # Go: verify checksums
      # - run: go mod verify

      # Rust: use locked dependencies
      # - run: cargo build --locked

      # Python (Poetry): fail if lock file is out of sync
      # - run: poetry install --no-update
```

### Lock File Integrity Verification

```bash
# npm: verify integrity of installed packages
npm audit signatures

# Go: verify module checksums against go.sum
go mod verify

# Python (pip-compile): generate deterministic requirements
pip-compile --generate-hashes requirements.in -o requirements.txt

# Rust: verify Cargo.lock integrity
cargo verify-project
```

Example of pip-compile with hashes for maximum security:

```txt
# requirements.txt (generated by pip-compile --generate-hashes)
certifi==2023.11.17 \
    --hash=sha256:e036ab49d5b79556f99cfc2d9320b34cfbe5be05c5871b51de9329f0603b0474 \
    --hash=sha256:9b469f3a900bf28dc19b8cfbf8019bf47f7fdd1a65a1d4ffb5fc13b11232cd41
requests==2.31.0 \
    --hash=sha256:58cd2187c01e70e6e26505bca751777aa9f2ee0b7f4300988b709f44e013003e \
    --hash=sha256:942c5a758f98d790eaed1a29cb6eefc7f0edf3fcb0fce8aea3fbd5951d bdf708
```

---

## Automated Dependency Updates

### Dependabot Configuration

Dependabot is GitHub's built-in dependency update tool. Configure it via `.github/dependabot.yml`.

```yaml
# .github/dependabot.yml
version: 2
updates:
  # npm dependencies
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "America/New_York"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "dependencies"
      - "security"
    # Group minor and patch updates together
    groups:
      production-dependencies:
        patterns:
          - "*"
        exclude-patterns:
          - "@types/*"
        update-types:
          - "minor"
          - "patch"
      dev-dependencies:
        dependency-type: "development"
        update-types:
          - "minor"
          - "patch"
    # Security updates get separate PRs
    versioning-strategy: increase
    # Ignore specific packages
    ignore:
      - dependency-name: "aws-sdk"
        update-types: ["version-update:semver-major"]

  # Docker base images
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    reviewers:
      - "platform-team"

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    # Pin GitHub Actions to full SHA
    labels:
      - "ci-cd"
      - "dependencies"

  # Go modules
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      go-dependencies:
        patterns:
          - "*"
        update-types:
          - "minor"
          - "patch"

  # Python dependencies
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
```

### Renovate Bot Configuration

Renovate provides more granular control than Dependabot, including auto-merge, custom grouping, and regex manager support.

```json5
// renovate.json5
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    "security:openssf-scorecard",
    ":dependencyDashboard",
    ":semanticCommits",
    ":automergePatch",
    "group:recommended"
  ],
  "timezone": "America/New_York",
  "schedule": ["before 6am on monday"],
  "prConcurrentLimit": 10,
  "prHourlyLimit": 5,
  "labels": ["dependencies", "renovate"],
  "reviewers": ["team:security-reviewers"],

  // Vulnerability alerts: create PRs immediately
  "vulnerabilityAlerts": {
    "enabled": true,
    "labels": ["security"],
    "schedule": ["at any time"],
    "prPriority": 10,
    "automerge": false,
    "assignees": ["security-lead"]
  },

  // Auto-merge patch updates for trusted packages
  "packageRules": [
    {
      "description": "Auto-merge patch updates for production deps",
      "matchUpdateTypes": ["patch"],
      "matchDepTypes": ["dependencies"],
      "automerge": true,
      "automergeType": "pr",
      "automergeStrategy": "squash",
      "minimumReleaseAge": "3 days",
      "prCreation": "immediate"
    },
    {
      "description": "Auto-merge dev dependency updates",
      "matchDepTypes": ["devDependencies"],
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": true,
      "minimumReleaseAge": "3 days"
    },
    {
      "description": "Group all eslint packages",
      "matchPackagePatterns": ["^eslint", "^@typescript-eslint"],
      "groupName": "eslint packages"
    },
    {
      "description": "Major updates require manual review",
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "labels": ["major-update", "needs-review"],
      "prPriority": -1
    },
    {
      "description": "Pin GitHub Actions to full SHA",
      "matchManagers": ["github-actions"],
      "pinDigests": true
    },
    {
      "description": "Pin Docker digests",
      "matchDatasources": ["docker"],
      "pinDigests": true
    },
    {
      "description": "Do not update deprecated packages",
      "matchDepPatterns": ["*"],
      "matchPackagePatterns": ["^request$"],
      "enabled": false
    }
  ],

  // Regex manager for custom version patterns
  "regexManagers": [
    {
      "description": "Update tool versions in Makefile",
      "fileMatch": ["^Makefile$"],
      "matchStrings": [
        "# renovate: datasource=github-releases depName=(?<depName>\\S+)\\n.+_VERSION\\s*[?:]?=\\s*(?<currentValue>\\S+)"
      ],
      "datasourceTemplate": "github-releases"
    }
  ]
}
```

### Update Strategy Comparison

| Strategy | Use Case | Risk | Automation |
|----------|----------|------|------------|
| Auto-merge patch | Low-risk updates | Low | Full |
| Auto-merge minor (dev) | Dev tooling | Low-Medium | Full |
| Grouped PRs | Related packages | Medium | Semi |
| Individual PRs | Major updates | High | Manual review |
| Security-only | Risk-averse teams | Low | Immediate |
| Scheduled batch | Large codebases | Medium | Weekly batch |

---

## Evaluating Dependency Health

Before adding a dependency, evaluate its health and security posture using the following criteria.

### Health Assessment Criteria

| Criterion | Good Signal | Red Flag |
|-----------|-------------|----------|
| Maintenance | Regular commits, responsive issues | No commits in 12+ months |
| Downloads | Consistent or growing usage | Declining rapidly |
| Vulnerabilities | Quick CVE response | Unpatched known CVEs |
| Bus factor | Multiple active maintainers | Single maintainer |
| License | OSI-approved, compatible | No license, GPL (if proprietary) |
| Security policy | SECURITY.md present | No disclosure process |
| Test coverage | CI with tests | No tests |
| Release cadence | Regular, semver-compliant | Irregular, breaking changes |

### OpenSSF Scorecard

OpenSSF Scorecard provides automated security health checks for open-source projects.

```bash
# Install scorecard
go install github.com/ossf/scorecard/v5/cmd/scorecard@latest

# Run scorecard against a project
scorecard --repo=github.com/expressjs/express

# Run scorecard with specific checks
scorecard --repo=github.com/expressjs/express \
  --checks=Maintained,Vulnerabilities,CII-Best-Practices,License,Signed-Releases

# Run scorecard in CI with JSON output
scorecard --repo=github.com/expressjs/express \
  --format=json \
  --show-details > scorecard-results.json
```

Key scorecard checks and their meaning:

| Check | What It Measures |
|-------|-----------------|
| Maintained | Is the project actively maintained |
| Vulnerabilities | Does the project have unpatched vulnerabilities |
| Code-Review | Are changes reviewed before merge |
| Branch-Protection | Are branch protection rules enforced |
| Signed-Releases | Are releases cryptographically signed |
| Token-Permissions | Are workflow tokens minimally scoped |
| Dangerous-Workflow | Does CI/CD use dangerous patterns |
| Pinned-Dependencies | Are dependencies pinned to hashes |
| SAST | Is static analysis used |
| Fuzzing | Is fuzz testing used |

### Automated Health Checks in CI

```yaml
# GitHub Actions: check dependency health before merge
name: Dependency Health Check
on:
  pull_request:
    paths:
      - 'package.json'
      - 'go.mod'
      - 'requirements.txt'
      - 'Cargo.toml'

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check for new dependencies
        id: new-deps
        run: |
          # Compare dependency files with base branch
          git diff origin/${{ github.base_ref }} -- package.json | \
            grep '^\+' | grep -v '^\+\+\+' > new-deps.txt || true
          if [ -s new-deps.txt ]; then
            echo "new_deps=true" >> $GITHUB_OUTPUT
          fi

      - name: Run OpenSSF Scorecard on new dependencies
        if: steps.new-deps.outputs.new_deps == 'true'
        uses: ossf/scorecard-action@v2
        with:
          results_file: scorecard-results.sarif
          results_format: sarif

      - name: Check npm audit
        run: npm audit --audit-level=high

      - name: Verify package provenance
        run: npm audit signatures
```

---

## Transitive Dependency Risks

Transitive (indirect) dependencies are packages pulled in by your direct dependencies. They often represent the majority of your dependency tree and the greatest source of hidden risk.

### Visualizing the Dependency Tree

```bash
# npm: view full dependency tree
npm ls --all

# npm: view dependency tree with depth limit
npm ls --depth=3

# npm: find why a package is installed
npm explain <package-name>

# Go: view module dependency graph
go mod graph

# Go: find why a module is required
go mod why -m <module-path>

# Python: view dependency tree
pip install pipdeptree
pipdeptree --warn silence

# Rust: view dependency tree
cargo tree

# Rust: find duplicated dependencies
cargo tree --duplicates

# Rust: find why a crate is included
cargo tree --invert <crate-name>
```

### Transitive Dependency Risks

1. **Hidden vulnerabilities**: A vulnerability in a deeply nested dependency may not trigger alerts in your direct dependency scanner.
2. **Version conflicts**: Multiple versions of the same transitive dependency can cause subtle bugs.
3. **Unmaintained packages**: Your direct dependency may depend on an abandoned package.
4. **License contamination**: A transitive dependency with GPL license can affect your entire project.
5. **Supply chain depth**: Each level of transitivity adds another potential attack vector.

### Mitigating Transitive Risks

```bash
# npm: use npm-audit to check all dependencies (including transitive)
npm audit --all

# npm: override a vulnerable transitive dependency
# Add to package.json:
# "overrides": {
#   "minimist": "1.2.8"
# }

# Go: use govulncheck to analyze actual usage
govulncheck ./...

# Python: use pip-audit for all installed packages
pip-audit --strict --desc

# Rust: use cargo-audit for advisory database checks
cargo audit
```

```json
// package.json - overriding vulnerable transitive dependencies
{
  "overrides": {
    "minimist": "1.2.8",
    "json5": "2.2.3",
    "semver": "7.5.4"
  }
}
```

```toml
# Cargo.toml - patching a vulnerable transitive dependency
[patch.crates-io]
vulnerable-crate = { git = "https://github.com/owner/fixed-fork", branch = "security-fix" }
```

---

## Dependency Confusion Attacks

Dependency confusion (also called namespace confusion or substitution attack) exploits the way package managers resolve packages when both public and private registries are configured. An attacker publishes a malicious package to a public registry using the same name as an internal private package but with a higher version number. The package manager then resolves the malicious public package instead of the legitimate private one.

### How the Attack Works

1. Attacker discovers internal package names (via leaked configs, error messages, or JavaScript source maps)
2. Attacker publishes a package with the same name on the public registry (npm, PyPI, etc.)
3. Attacker assigns a very high version number (e.g., 99.0.0)
4. When the build system resolves dependencies, it prefers the higher-versioned public package
5. Malicious code executes during installation (preinstall/postinstall scripts)

### Defense: Scoped Packages (npm)

```json
// package.json - use scoped packages for internal code
{
  "dependencies": {
    "@mycompany/auth-service": "1.2.3",
    "@mycompany/logging": "2.0.1",
    "@mycompany/shared-utils": "3.1.0"
  }
}
```

### Defense: Registry Configuration

```ini
# .npmrc - route scoped packages to private registry
@mycompany:registry=https://npm.mycompany.com/
//npm.mycompany.com/:_authToken=${NPM_TOKEN}
always-auth=true

# Block public registry for scoped packages
# This ensures @mycompany packages ONLY come from private registry
```

```ini
# pip.conf - configure private index
[global]
index-url = https://pypi.mycompany.com/simple/
extra-index-url = https://pypi.org/simple/

# SAFER: use only private index and vendor public deps
# index-url = https://pypi.mycompany.com/simple/
# no-index = false
```

```xml
<!-- .NET NuGet.config - explicit package source mapping -->
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
    <add key="mycompany" value="https://nuget.mycompany.com/v3/index.json" />
  </packageSources>
  <packageSourceMapping>
    <packageSource key="nuget.org">
      <package pattern="*" />
    </packageSource>
    <packageSource key="mycompany">
      <package pattern="MyCompany.*" />
    </packageSource>
  </packageSourceMapping>
</configuration>
```

### Defense: Claim Names on Public Registries

Register placeholder packages on public registries using your internal package names. These placeholders should contain no code but prevent attackers from claiming the names.

```json
// Placeholder package.json for public registry
{
  "name": "mycompany-internal-auth",
  "version": "0.0.1",
  "description": "This package name is reserved. Use @mycompany/auth from our private registry.",
  "scripts": {
    "preinstall": "echo 'ERROR: This is a placeholder. Use @mycompany/auth from the private registry.' && exit 1"
  }
}
```

---

## License Compliance

Dependency licenses carry legal obligations. Failure to comply can result in legal liability, forced open-sourcing of proprietary code, or product recalls.

### License Categories

| Category | Licenses | Obligation |
|----------|----------|------------|
| Permissive | MIT, BSD-2, BSD-3, ISC, Apache-2.0 | Attribution only |
| Weak copyleft | LGPL-2.1, LGPL-3.0, MPL-2.0 | Share modifications to the library |
| Strong copyleft | GPL-2.0, GPL-3.0, AGPL-3.0 | Share entire derivative work |
| Public domain | Unlicense, CC0-1.0 | No obligations |
| No license | (none specified) | All rights reserved (CANNOT use) |

### License Scanning

```bash
# npm: check licenses of all dependencies
npx license-checker --summary
npx license-checker --failOn "GPL-2.0;GPL-3.0;AGPL-3.0"
npx license-checker --production --json > licenses.json

# Python: check licenses
pip install pip-licenses
pip-licenses --format=table --with-urls --with-description
pip-licenses --fail-on="GNU General Public License v3 (GPLv3)"

# Go: check licenses
go install github.com/google/go-licenses@latest
go-licenses check ./... --disallowed_types=restricted

# Rust: check licenses
cargo install cargo-license
cargo license --json > licenses.json
cargo deny check licenses
```

### License Policy Configuration (cargo-deny)

```toml
# deny.toml - Rust license policy
[licenses]
unlicensed = "deny"
allow = [
    "MIT",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "Unicode-DFS-2016",
]
deny = [
    "GPL-2.0",
    "GPL-3.0",
    "AGPL-3.0-only",
    "AGPL-3.0-or-later",
]
copyleft = "deny"

[licenses.private]
ignore = true
registries = ["mycompany-registry"]
```

---

## Vendoring vs Registry

### Vendoring

Vendoring copies dependency source code directly into your repository. This eliminates runtime dependency on external registries and provides complete control over the code.

```bash
# Go: vendor all dependencies
go mod vendor
# Build with vendored dependencies
go build -mod=vendor ./...

# Node.js: vendor with bundledDependencies
# Add to package.json:
# "bundledDependencies": ["critical-package"]

# Rust: vendor all crates
cargo vendor
# Configure .cargo/config.toml to use vendored sources
```

```toml
# .cargo/config.toml - use vendored crates
[source.crates-io]
replace-with = "vendored-sources"

[source.vendored-sources]
directory = "vendor"
```

### Comparison

| Aspect | Vendoring | Registry |
|--------|-----------|----------|
| Availability | No network needed | Registry must be up |
| Auditability | Full code in repo | Must fetch to audit |
| Repo size | Large | Small |
| Updates | Manual copy | Automated tools |
| Security review | Easy diff review | Requires tooling |
| Build speed | Faster (local) | Network dependent |
| Best for | Critical apps, air-gapped | Most projects |

---

## Minimal Dependency Principle

Every dependency added to a project increases the attack surface, maintenance burden, and supply chain risk. The minimal dependency principle states: use the fewest external dependencies necessary to deliver the required functionality.

### Decision Framework

Before adding a dependency, answer these questions:

1. **Is the functionality essential?** Can you implement it in a reasonable amount of code?
2. **Is the dependency well-maintained?** Check maintenance activity, bus factor, and security posture.
3. **What is the transitive cost?** How many additional dependencies does it bring?
4. **Is there a standard library alternative?** Many languages provide built-in equivalents.
5. **What is the security track record?** Check for past CVEs and response time.

### Standard Library Alternatives

```javascript
// AVOID: adding lodash for simple operations
const _ = require('lodash');
const result = _.get(obj, 'a.b.c', 'default');

// PREFER: native JavaScript optional chaining
const result = obj?.a?.b?.c ?? 'default';

// AVOID: moment.js (deprecated, large bundle)
const moment = require('moment');
const formatted = moment().format('YYYY-MM-DD');

// PREFER: native Intl API or lightweight alternative
const formatted = new Date().toISOString().split('T')[0];
```

```go
// AVOID: adding a UUID library for simple IDs
import "github.com/google/uuid"

// CONSIDER: crypto/rand from standard library
import (
    "crypto/rand"
    "encoding/hex"
)

func generateID() string {
    b := make([]byte, 16)
    crypto_rand.Read(b)
    return hex.EncodeToString(b)
}
```

### Dependency Budget

Establish a dependency budget for your project. Track the total number of direct and transitive dependencies and set thresholds that trigger review.

```yaml
# dependency-budget.yml
limits:
  direct_dependencies: 50
  total_dependencies: 300
  max_depth: 6
  new_dependency_approval: required
  review_team: security-team
```

---

## Monorepo Dependency Management

Monorepos present unique challenges for dependency management: shared dependencies must be consistent across packages, updates must be coordinated, and security scanning must cover all packages.

### Workspace Configuration

```json
// package.json (npm/yarn/pnpm workspaces)
{
  "workspaces": [
    "packages/*",
    "apps/*",
    "services/*"
  ]
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'services/*'
```

### Consistent Dependency Versions

```json
// package.json - pnpm catalog for shared versions
{
  "pnpm": {
    "overrides": {
      "minimist": "1.2.8",
      "json5": "2.2.3"
    }
  }
}
```

```json5
// .syncpackrc.json - enforce consistent versions across workspaces
{
  "versionGroups": [
    {
      "label": "Use consistent versions across all packages",
      "packages": ["**"],
      "dependencies": ["**"],
      "pinVersion": null
    }
  ],
  "semverGroups": [
    {
      "range": "",
      "dependencies": ["**"],
      "packages": ["**"],
      "label": "Use exact versions"
    }
  ]
}
```

### Monorepo Security Scanning

```yaml
# GitHub Actions: scan all packages in monorepo
name: Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [packages/auth, packages/api, packages/web, services/backend]
    steps:
      - uses: actions/checkout@v4
      - name: Audit dependencies
        working-directory: ${{ matrix.package }}
        run: |
          npm ci
          npm audit --audit-level=high
      - name: License check
        working-directory: ${{ matrix.package }}
        run: npx license-checker --failOn "GPL-2.0;GPL-3.0;AGPL-3.0"
```

---

## Best Practices

1. **Always commit lock files to version control.** Lock files ensure reproducible builds and prevent unauthorized dependency changes. Never add lock files to `.gitignore`.

2. **Use exact version pinning for applications, ranges for libraries.** Applications need deterministic builds. Libraries need flexibility so consumers can resolve compatible versions.

3. **Run `npm ci` (or equivalent frozen install) in CI/CD.** This ensures the build uses exactly the versions specified in the lock file, failing if the lock file is out of sync.

4. **Enable automated dependency updates with Dependabot or Renovate.** Configure auto-merge for patch updates with a minimum release age of 3 days. Require manual review for major updates.

5. **Evaluate dependency health before adoption.** Check OpenSSF Scorecard, maintenance activity, bus factor, vulnerability history, and license compatibility before adding any new dependency.

6. **Use scoped/namespaced packages for internal code.** Prevent dependency confusion attacks by using scoped packages (`@mycompany/package`) and configuring registry routing in `.npmrc` or equivalent.

7. **Enforce license compliance in CI/CD.** Automatically reject dependencies with incompatible licenses (GPL, AGPL for proprietary projects, no license).

8. **Monitor transitive dependencies.** Use `npm ls`, `cargo tree`, or `pipdeptree` to understand the full dependency tree. Override vulnerable transitive dependencies when direct dependency updates are not available.

9. **Apply the minimal dependency principle.** Prefer standard library functions over third-party packages. Establish a dependency budget and require approval for new dependencies.

10. **Pin Docker base images to SHA256 digests.** Mutable tags like `latest` or `alpine` can change without notice. Pin to immutable digests for reproducible container builds.

---

## Anti-Patterns

1. **Using `latest` or `*` version specifiers.** This allows any future version to be installed, including compromised ones. Always use explicit version constraints.

2. **Not committing lock files.** Without a lock file in version control, every install can produce different dependency trees, making builds non-reproducible and vulnerable to supply chain attacks.

3. **Running `npm install` instead of `npm ci` in CI/CD.** `npm install` can modify the lock file, while `npm ci` enforces the exact lock file contents. Always use the frozen install variant in automated environments.

4. **Ignoring Dependabot/Renovate PRs for weeks or months.** Stale dependency update PRs accumulate and become increasingly difficult to merge. Review and merge security updates within 48 hours.

5. **Adding dependencies without security review.** Every new dependency is an extension of your trust boundary. Adding packages without evaluating their security posture introduces unassessed risk.

6. **Disabling security audits to unblock builds.** When `npm audit` or equivalent tools report vulnerabilities, the correct response is to fix them, not to add `--no-audit` flags or ignore them.

7. **Using multiple public registries without source mapping.** Configuring `extra-index-url` in pip or multiple registries in npm without explicit package-to-source mapping enables dependency confusion attacks.

8. **Copy-pasting dependency lists from tutorials or Stack Overflow.** Tutorials often use outdated or overly broad dependency sets. Evaluate each dependency individually and use the minimum set required.

---

## Enforcement Checklist

Use this checklist to verify dependency management security in your projects.

### Version Pinning
- [ ] All production dependencies use exact version pinning or lock files
- [ ] Docker base images are pinned to SHA256 digests
- [ ] GitHub Actions are pinned to full commit SHAs
- [ ] No `latest`, `*`, or open-ended version ranges exist in production configs

### Lock Files
- [ ] Lock files are committed to version control
- [ ] CI/CD uses frozen lockfile installation (`npm ci`, `--frozen-lockfile`, `--locked`)
- [ ] Lock file changes are reviewed in pull requests
- [ ] Lock file integrity hashes are verified

### Automated Updates
- [ ] Dependabot or Renovate is configured and active
- [ ] Security updates are prioritized and auto-created
- [ ] Patch updates auto-merge after minimum release age
- [ ] Major updates require manual security review
- [ ] Update PRs are reviewed within one week

### Dependency Health
- [ ] New dependencies require security team approval
- [ ] OpenSSF Scorecard is checked for new dependencies
- [ ] Maintenance status and bus factor are evaluated
- [ ] Dependency budget thresholds are defined and monitored

### Dependency Confusion
- [ ] Internal packages use scoped names (`@org/package`)
- [ ] Registry routing is configured (`.npmrc`, `pip.conf`, `NuGet.config`)
- [ ] Internal package names are claimed on public registries
- [ ] Install scripts are reviewed for new dependencies

### License Compliance
- [ ] License scanning runs in CI/CD
- [ ] Incompatible licenses (GPL, AGPL, no license) are blocked
- [ ] License inventory is maintained and reviewed quarterly
- [ ] Legal team has approved the license policy

### Transitive Dependencies
- [ ] Full dependency tree is periodically reviewed
- [ ] Vulnerable transitive dependencies are overridden when necessary
- [ ] Dependency depth is monitored and kept reasonable
- [ ] Duplicated transitive dependencies are resolved

### General
- [ ] Dependency management policy is documented and enforced
- [ ] Security scanning is integrated into CI/CD (npm audit, pip-audit, etc.)
- [ ] Vendoring is used for critical air-gapped environments
- [ ] Minimal dependency principle is followed and enforced
