---
mode: auto
---
## Dependency Management

### Adding Dependencies
- BEFORE adding a new dependency, check:
  1. Can this be done with existing dependencies or standard library?
  2. Is the package actively maintained? (last commit <6 months, responsive issues)
  3. Does it have known security vulnerabilities?
  4. What is the package size and impact on bundle?
  5. Is it well-typed? (TypeScript definitions available)
  6. What is the license? (MIT, Apache 2.0 preferred — avoid GPL for commercial)
- Create ADR for significant dependencies (database, ORM, auth, payment, etc.)
- Prefer well-established packages over trending alternatives

### Version Pinning
- Pin EXACT versions in production: "lodash": "4.17.21" not "^4.17.21"
- Use lockfile (package-lock.json, yarn.lock, poetry.lock) — always commit it
- Never delete and regenerate lockfile without reason
- Review lockfile changes in PRs

### Update Strategy
- Security updates: apply immediately, same day
- Patch updates: apply weekly in batch
- Minor updates: apply monthly, test thoroughly
- Major updates: plan and test in dedicated branch, update ADR
- Use automated tools (Dependabot, Renovate) for update notifications
- Review changelogs before updating — never blindly update

### Security Auditing
- Run npm audit / pip audit / safety check in CI pipeline
- Block deployment on critical/high severity vulnerabilities
- Document known acceptable vulnerabilities with justification and expiry date
- Review transitive dependencies — not just direct ones

### Dependency Boundaries
- Wrap third-party libraries in adapter/wrapper classes
- Never import third-party libraries directly in domain or application layers
- If a dependency is used in >5 files, create a shared wrapper
- This allows swapping dependencies without touching business logic

### Forbidden Patterns
- Never install packages globally for project use — always local
- Never use deprecated packages — find maintained alternatives
- Never vendor/copy library code into your codebase
- Never use multiple packages for the same purpose (e.g., two HTTP clients)
- Never import from package internals (e.g., lodash/internal/...)
