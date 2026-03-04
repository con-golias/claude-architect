## Git Workflow & Version Control

### Branching Strategy (GitHub Flow — Simplified)
- main: always deployable, protected, no direct commits
- feature/{short-description}: new features → merge to main via PR
- fix/{short-description}: bug fixes → merge to main via PR
- hotfix/{short-description}: urgent production fixes → merge to main via PR
- chore/{short-description}: maintenance, dependencies, config
- docs/{short-description}: documentation only changes

### Conventional Commits (Enforced)
Format: type(scope): description

Types:
- feat: new feature (triggers MINOR version bump)
- fix: bug fix (triggers PATCH version bump)
- docs: documentation only
- style: formatting, no code change
- refactor: code restructure, no behavior change
- perf: performance improvement
- test: adding/fixing tests
- chore: build, CI, dependencies
- ci: CI/CD configuration changes
- revert: reverts a previous commit

Rules:
- Subject line: imperative mood, lowercase, no period, max 72 characters
- Body: explain WHAT and WHY (not HOW), wrap at 80 characters
- Footer: reference issues (Closes #123, Fixes #456)
- Breaking changes: add BREAKING CHANGE: in footer or ! after type

Examples:
```
feat(auth): add password reset via email
fix(payments): prevent duplicate charge on retry
refactor(users): extract validation to shared utility
feat(api)!: change response format for /users endpoint

BREAKING CHANGE: response now wraps data in "data" field
```

### Commit Hygiene
- One logical change per commit — never mix unrelated changes
- Never commit: node_modules, .env, build artifacts, IDE settings, OS files
- Update .gitignore BEFORE committing project scaffold
- Squash WIP commits before merging to main
- Never force push to main or shared branches

### Pull Request Standards
- Title follows Conventional Commits format
- Description includes: What changed, Why, How to test, Screenshots (if UI)
- Link related issues
- Keep PRs small: ideally <400 lines changed
- Self-review before requesting review
- All CI checks must pass before merge
- At least 1 approval required for merge to main

### Branch Protection (Recommended)
- Require PR reviews before merging to main
- Require status checks (tests, lint) to pass
- No force pushes to main
- Require up-to-date branches before merging
- Auto-delete branches after merge

### Release & Versioning
- Semantic Versioning: MAJOR.MINOR.PATCH
- MAJOR: breaking changes
- MINOR: new features, backward compatible
- PATCH: bug fixes, backward compatible
- Tag releases on main: v1.0.0, v1.1.0, v1.1.1
- Maintain CHANGELOG.md with every release
