# Open Source Project Structure

> **AI Plugin Directive:** When creating or structuring an open-source project for public contribution, ALWAYS use this guide. Apply proper governance files, CI/CD, release automation, and contributor experience patterns. This guide covers community-oriented projects on GitHub/GitLab.

**Core Rule: An open-source project MUST have clear contribution guidelines, automated CI, semantic versioning, and governance documentation. The barrier to contribution MUST be as low as possible. NEVER publish a project without README, LICENSE, CONTRIBUTING.md, and CI pipeline.**

---

## 1. Project Structure

```
my-oss-project/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml                 # Structured bug report form
│   │   ├── feature_request.yml            # Feature request form
│   │   └── config.yml                     # Template chooser config
│   ├── PULL_REQUEST_TEMPLATE.md           # PR template
│   ├── FUNDING.yml                        # Sponsorship links
│   ├── CODEOWNERS                         # Auto-assign reviewers
│   ├── SECURITY.md                        # Vulnerability reporting
│   ├── workflows/
│   │   ├── ci.yml                         # Lint + test + build
│   │   ├── release.yml                    # Automated releases
│   │   ├── stale.yml                      # Auto-close stale issues
│   │   └── lock.yml                       # Lock resolved issues
│   └── dependabot.yml                     # Automated dependency updates
│
├── src/                                   # Source code (language-specific)
│   └── ...
│
├── tests/                                 # Test suite
│   └── ...
│
├── docs/                                  # Documentation site source
│   ├── getting-started.md
│   ├── api-reference.md
│   ├── guides/
│   │   ├── installation.md
│   │   ├── configuration.md
│   │   └── migration.md
│   └── contributing/
│       ├── development-setup.md
│       └── architecture.md
│
├── examples/                              # Usage examples
│   ├── basic/
│   ├── advanced/
│   └── README.md
│
├── benchmarks/                            # Performance benchmarks
│   └── ...
│
├── scripts/                               # Development scripts
│   ├── setup.sh
│   └── release.sh
│
├── README.md                              # Project overview (CRITICAL)
├── LICENSE                                # License file (REQUIRED)
├── CONTRIBUTING.md                        # How to contribute
├── CODE_OF_CONDUCT.md                     # Community standards
├── CHANGELOG.md                           # Version history
├── SECURITY.md                            # Security policy (or in .github/)
├── .gitignore
├── .editorconfig                          # Editor consistency
└── [build config]                         # package.json / pyproject.toml / Cargo.toml / go.mod
```

---

## 2. README.md Structure

```markdown
# Project Name

<!-- Badges row -->
[![CI](https://github.com/org/repo/actions/workflows/ci.yml/badge.svg)](...)
[![npm version](https://img.shields.io/npm/v/package.svg)](...)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](...)
[![Downloads](https://img.shields.io/npm/dm/package.svg)](...)

> One-line description of what this project does.

## Features

- Feature 1 — brief description
- Feature 2 — brief description
- Feature 3 — brief description

## Installation

```bash
npm install my-package
# or
pip install my-package
```

## Quick Start

```typescript
// Minimal working example — 5-10 lines MAX
import { Client } from "my-package";
const client = new Client({ apiKey: "..." });
const result = await client.doSomething();
```

## Documentation

Full documentation: [https://my-project.dev/docs](...)

- [Getting Started](docs/getting-started.md)
- [API Reference](docs/api-reference.md)
- [Examples](examples/)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE) - see LICENSE file for details.
```

```
README rules:
- First 5 lines MUST answer: what is this, why should I care
- Installation MUST be copy-pasteable
- Quick start MUST work with minimal setup
- NEVER put API reference in README — link to docs
- ALWAYS include badges: CI status, version, license, downloads
- Keep README under 200 lines — detail goes in /docs
```

---

## 3. CONTRIBUTING.md

```markdown
# Contributing to Project Name

Thank you for contributing! This guide helps you get started.

## Development Setup

```bash
# Clone and install
git clone https://github.com/org/repo.git
cd repo
npm install  # or: pip install -e ".[dev]"

# Run tests
npm test

# Run linter
npm run lint
```

## Making Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make changes and add tests
4. Run the full test suite: `npm test`
5. Commit using conventional commits (see below)
6. Push and open a Pull Request

## Commit Convention

We use [Conventional Commits](https://conventionalcommits.org/):

```
feat: add new validation method
fix: handle null input in parser
docs: update API reference
test: add edge case for tokenizer
refactor: extract helper function
chore: update dependencies
```

## Pull Request Guidelines

- PRs MUST pass CI (lint + test + build)
- PRs MUST include tests for new features
- PRs MUST update documentation if behavior changes
- Keep PRs focused — one feature/fix per PR
- Fill in the PR template completely

## Reporting Issues

- Use the bug report template for bugs
- Use the feature request template for ideas
- Search existing issues before creating new ones

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
```

---

## 4. Issue Templates

```yaml
# .github/ISSUE_TEMPLATE/bug_report.yml
name: Bug Report
description: Report a bug or unexpected behavior
labels: ["bug", "needs-triage"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting! Please fill out the form below.

  - type: textarea
    id: description
    attributes:
      label: Bug Description
      description: Clear description of the bug
    validations:
      required: true

  - type: textarea
    id: reproduction
    attributes:
      label: Steps to Reproduce
      description: Minimal steps to reproduce the behavior
      value: |
        1.
        2.
        3.
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What did you expect to happen?
    validations:
      required: true

  - type: input
    id: version
    attributes:
      label: Version
      description: Package version (run `npm list my-package`)
    validations:
      required: true

  - type: dropdown
    id: environment
    attributes:
      label: Environment
      options:
        - Node.js 20
        - Node.js 22
        - Browser
        - Deno
        - Bun
    validations:
      required: true

  - type: textarea
    id: additional
    attributes:
      label: Additional Context
      description: Screenshots, logs, or any relevant information
```

```yaml
# .github/ISSUE_TEMPLATE/feature_request.yml
name: Feature Request
description: Suggest a new feature
labels: ["enhancement", "needs-triage"]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: What problem does this feature solve?
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: Proposed Solution
      description: How should this work?
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives Considered
      description: What other approaches did you consider?
```

---

## 5. PR Template

```markdown
<!-- .github/PULL_REQUEST_TEMPLATE.md -->
## Summary

<!-- What does this PR do? Why? -->

## Changes

- [ ] Change 1
- [ ] Change 2

## Type

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Refactoring
- [ ] CI/build improvement

## Checklist

- [ ] Tests added/updated
- [ ] Documentation updated (if behavior changed)
- [ ] Lint and type-check pass
- [ ] Changelog entry added (if user-facing)
- [ ] No breaking changes (or marked as breaking)

## Screenshots / Examples

<!-- If applicable, add screenshots or code examples -->
```

---

## 6. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v4
        if: matrix.node == 22
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
```

---

## 7. Automated Releases

```yaml
# .github/workflows/release.yml (Changesets approach)
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: "https://registry.npmjs.org"
      - run: npm ci

      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: npm run release
          commit: "chore: release packages"
          title: "chore: release packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

```
Release strategies:

1. Changesets (recommended for JS/TS)
   - Developers add changeset files during development
   - CI creates "Version Packages" PR automatically
   - Merge PR → publish to npm + create GitHub release

2. semantic-release (fully automated)
   - Conventional commits → automatic version bump
   - No manual intervention needed
   - Risk: surprise major versions from commit message typos

3. Manual tagging (Go, Rust)
   - Developer creates git tag: git tag v1.2.3
   - CI publishes on tag push
   - Most control, most manual effort

ALWAYS use Changesets for JavaScript/TypeScript libraries.
Use semantic-release only for internal packages.
Use manual tagging for Go and Rust modules.
```

---

## 8. CODEOWNERS

```
# .github/CODEOWNERS

# Default owners for everything
*                           @org/maintainers

# Core library
/src/                       @org/core-team
/tests/                     @org/core-team

# Documentation
/docs/                      @org/docs-team @org/core-team

# CI/CD and build
/.github/                   @org/maintainers
/scripts/                   @org/maintainers
package.json                @org/maintainers
tsconfig.json               @org/maintainers

# Examples — more relaxed ownership
/examples/                  @org/core-team @org/community-leads
```

---

## 9. Governance Files

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    groups:
      minor-and-patch:
        update-types: [minor, patch]
    open-pull-requests-limit: 10
    reviewers:
      - "org/maintainers"
    labels:
      - "dependencies"

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

```yaml
# .github/FUNDING.yml
github: [maintainer-username]
open_collective: project-name
custom: ["https://project.dev/sponsor"]
```

```markdown
<!-- SECURITY.md -->
# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 2.x     | :white_check_mark: |
| 1.x     | Security fixes only |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**DO NOT open a public issue for security vulnerabilities.**

Email: security@project.dev
PGP Key: [link to key]

We will respond within 48 hours and provide a fix within 7 days
for critical vulnerabilities.
```

---

## 10. Documentation Site

```
docs/                                      # Source for docs site
├── index.md                               # Homepage
├── getting-started.md                     # Installation + first use
├── guides/
│   ├── installation.md
│   ├── configuration.md
│   ├── migration.md                       # Version migration guides
│   └── troubleshooting.md
├── api/                                   # Auto-generated API docs
│   └── ...
├── contributing/
│   ├── development-setup.md
│   └── architecture.md
└── blog/                                  # Optional: release announcements
    └── ...

Tools:
  JS/TS: Docusaurus, VitePress, Starlight (Astro)
  Python: MkDocs + Material, Sphinx
  Go: Native godoc + pkg.go.dev
  Rust: mdBook + docs.rs
  General: Mintlify, GitBook, ReadTheDocs

ALWAYS auto-generate API reference from source code.
Write guides manually — they explain WHY, not just WHAT.
```

---

## 11. License Selection

```
Decision tree:

Want maximum adoption?
  → MIT License
  Use when: libraries, tools, anything you want widely used

Want contributions back?
  → Apache 2.0
  Use when: libraries where you want patent protection

Want copyleft (derivative works must be open)?
  → GPL v3
  Use when: standalone applications, not libraries

Want weak copyleft (library can be used in proprietary)?
  → LGPL v3 or MPL 2.0
  Use when: libraries that should remain open but allow proprietary use

Corporate project?
  → Apache 2.0 (patent clause protects contributors)
  Use when: company-sponsored open source

NEVER use:
  - No license (= all rights reserved, nobody can use it)
  - WTFPL, Beerware (not legally clear)
  - Custom licenses (legal ambiguity)
```

---

## 12. Community Health

```
Essential files (GitHub recognizes these):
  ✅ README.md          — Project overview
  ✅ LICENSE             — Legal terms
  ✅ CONTRIBUTING.md     — How to contribute
  ✅ CODE_OF_CONDUCT.md  — Community standards
  ✅ SECURITY.md         — Vulnerability reporting
  ✅ CHANGELOG.md        — Version history

GitHub Community Profile:
  Go to: Settings → Community → Community Standards
  Score: 100% means all files present

Branch protection rules:
  - Require PR reviews (1+ approvals)
  - Require CI status checks to pass
  - Require linear history (no merge commits) — optional
  - Require signed commits — optional
  - Restrict push to main to maintainers only
```

---

## 13. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No CONTRIBUTING.md | Contributors don't know how to help | Add with dev setup + PR guidelines |
| No issue templates | Low-quality bug reports | Add structured YAML templates |
| No CI on PRs | Broken code merged | Require CI checks on all PRs |
| Manual releases | Inconsistent versions, missed changelogs | Automate with Changesets/semantic-release |
| No LICENSE file | Project is NOT open source legally | Add LICENSE immediately |
| Ignoring PRs for weeks | Contributors leave | Respond within 48 hours, even if just "seen" |
| No branch protection | Direct pushes break main | Require PR reviews + CI |
| README-only docs | Users can't find advanced features | Build docs site with guides |
| No CHANGELOG | Users don't know what changed | Auto-generate from conventional commits |
| No SECURITY.md | Vulnerabilities reported publicly | Add security reporting policy |

---

## 14. Enforcement Checklist

- [ ] README.md with badges, install, quick start, license
- [ ] LICENSE file present — MIT or Apache 2.0 for libraries
- [ ] CONTRIBUTING.md with dev setup and PR guidelines
- [ ] CODE_OF_CONDUCT.md — Contributor Covenant
- [ ] SECURITY.md — vulnerability reporting process
- [ ] CHANGELOG.md — updated on every release
- [ ] Issue templates — bug report + feature request (YAML forms)
- [ ] PR template — checklist for contributors
- [ ] CI pipeline — lint + test + build on every PR
- [ ] Branch protection — require reviews + CI
- [ ] Automated releases — Changesets or semantic-release
- [ ] CODEOWNERS — auto-assign reviewers
- [ ] Dependabot — automated dependency updates
- [ ] Documentation site — NOT just README
- [ ] Examples directory — working, tested examples
- [ ] .editorconfig — consistent formatting across editors
