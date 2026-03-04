---
paths:
  - ".github/**"
  - ".gitlab-ci.yml"
  - "Dockerfile"
  - "docker-compose*.yml"
  - "Jenkinsfile"
  - "Makefile"
  - ".circleci/**"
  - "bitbucket-pipelines.yml"
---
## CI/CD Pipeline Standards

### Pipeline Stages (Minimum)
1. Install dependencies (with lockfile, no dev deps in production)
2. Lint & format check
3. Unit tests (fast, parallel)
4. Build / compile
5. Integration tests (with test database)
6. Security audit (npm audit / pip audit / safety check)
7. Deploy to staging (automated)
8. Deploy to production (manual approval gate)

### Pipeline Rules
- Pipeline MUST pass before merge to main — no exceptions
- Cache dependencies between runs (node_modules, pip cache, .m2)
- Use matrix builds for multiple runtime versions when applicable
- Pin CI runner images to specific versions — never use :latest
- Set timeouts on every step — prevent hung pipelines
- Fail fast: stop pipeline on first failure in critical stages
- Separate build artifacts from test artifacts

### Docker Standards
- Multi-stage builds: builder stage → runner stage (smaller final image)
- Run as non-root user (USER node / USER app)
- Pin base image digests — never use :latest in production
- Include HEALTHCHECK instruction in every Dockerfile
- .dockerignore: exclude docs, tests, .git, node_modules, .env, coverage
- Use COPY instead of ADD unless extracting archives
- Set explicit WORKDIR — never rely on default
- Order layers by change frequency (dependencies first, code last)

### Deployment Strategy
- Staging: automatic deployment on merge to main
- Production: manual approval gate or tag-based trigger
- Use blue-green or canary deployments for zero-downtime releases
- Implement automatic rollback on health check failure
- Database migrations run BEFORE application deployment
- Smoke tests run AFTER deployment — verify critical paths
- Maintain deployment audit log (who, when, what version)

### Environment Secrets in CI
- Store secrets in CI/CD platform's secret manager — never in repository
- Never echo/print secrets in pipeline logs — mask all sensitive values
- Rotate CI secrets on the same schedule as application secrets
- Use OIDC/workload identity for cloud provider auth (avoid long-lived keys)
- Separate secrets per environment (staging vs production)

### Artifact Management
- Tag build artifacts with commit SHA and version number
- Store artifacts in a registry (container registry, npm registry, S3)
- Implement artifact retention policies (keep last N versions)
- Sign artifacts for production deployments when possible
- Never deploy untagged or unversioned artifacts to production
