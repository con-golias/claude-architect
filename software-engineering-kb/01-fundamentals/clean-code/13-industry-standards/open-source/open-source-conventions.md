# Open-Source Clean Code Conventions

> **Domain:** Fundamentals > Clean Code > Industry Standards
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Open-source projects have developed their own clean code conventions shaped by the unique challenges of distributed, volunteer-driven development. These conventions have become industry standards adopted far beyond open source.

## Key Conventions

### Semantic Versioning (SemVer)

The standard for communicating the nature of changes:

```
MAJOR.MINOR.PATCH
  ↓      ↓      ↓
Breaking  New    Bug
change    feature fix

Examples:
1.0.0 → 1.0.1  (patch: bug fix)
1.0.0 → 1.1.0  (minor: new feature, backward compatible)
1.0.0 → 2.0.0  (major: breaking change)
```

### Conventional Commits

A specification for commit messages that integrates with SemVer:

```
feat: add user registration endpoint          → MINOR bump
fix: resolve race condition in payment flow    → PATCH bump
feat!: redesign authentication API             → MAJOR bump (breaking)
docs: update API documentation
chore: upgrade dependencies
refactor: extract validation logic
perf: optimize database queries
test: add integration tests for orders
ci: add GitHub Actions workflow
```

### Contributing Guidelines (CONTRIBUTING.md)

Every serious open-source project includes contribution guidelines covering:
- How to set up the development environment
- Code style and formatting requirements
- Testing requirements (must pass CI, coverage thresholds)
- Commit message format
- PR process and review expectations
- Code of Conduct reference

### Keep a Changelog

```markdown
# Changelog

## [Unreleased]
### Added
- Dark mode support

## [2.1.0] - 2026-02-15
### Added
- User profile image upload
### Fixed
- Memory leak in WebSocket handler
### Changed
- Upgraded to React 19
### Deprecated
- Legacy REST API v1 (removal in 3.0.0)
```

### Notable Project Coding Styles

**Linux Kernel:**
- Tabs for indentation (8-character width)
- Short variable names in small scopes, descriptive for globals
- C89 standard, no C++ features
- Maximum line length: 80 characters
- Functions should be short — "if a function is more than 3 screens, it needs to be split"

**Kubernetes (CNCF):**
- Go style with gofmt enforcement
- Comprehensive documentation requirements
- Structured logging with klog
- Test coverage requirements for all changes

**Apache Software Foundation:**
- Language-specific style guides per project
- JIRA-linked commit messages
- Consensus-based code review (3 +1 votes, no -1)

### Standard Repository Files

Every well-maintained project includes:

| File | Purpose |
|------|---------|
| `README.md` | Project description, quickstart, badges |
| `CONTRIBUTING.md` | How to contribute |
| `CHANGELOG.md` | Version history |
| `LICENSE` | Legal terms (MIT, Apache 2.0, GPL) |
| `CODE_OF_CONDUCT.md` | Community behavior standards |
| `.editorconfig` | Cross-IDE formatting |
| `.github/ISSUE_TEMPLATE/` | Structured issue reporting |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR checklist |

## Key Takeaways

1. **Use Semantic Versioning** for all libraries and APIs.
2. **Adopt Conventional Commits** — they enable automated changelogs and version bumps.
3. **Write a CONTRIBUTING.md** — even for internal projects. It codifies standards.
4. **Maintain a changelog** — users and developers need to understand what changed.
5. **Automate everything** — formatting, linting, testing, changelog generation, version bumping.

## Sources

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Linux Kernel Coding Style](https://docs.kernel.org/process/coding-style.html)
- [GNU Coding Standards](https://www.gnu.org/prep/standards/standards.html)
