# Development Runbooks

| Attribute     | Value                                                                                       |
|---------------|---------------------------------------------------------------------------------------------|
| Domain        | Code Quality > Documentation                                                                |
| Importance    | Medium                                                                                      |
| Last Updated  | 2026-03                                                                                     |
| Cross-ref     | [12-devops incident runbooks](../../12-devops-infrastructure/incident-management/), [Architecture Docs](architecture-docs.md) |

> **Scope:** This file covers **development runbooks** -- release, migration, onboarding, and maintenance procedures. Incident response runbooks are in **12-devops-infrastructure/incident-management/**.

---

## 1. Runbook Template Structure

Every runbook follows a consistent structure so any team member can execute it under pressure.

```markdown
# [Runbook Title]

| Field          | Value                                    |
|----------------|------------------------------------------|
| Owner          | @team-platform                           |
| Last Tested    | 2026-02-15                               |
| Review Cadence | Quarterly                                |
| Estimated Time | 30 minutes                               |

## Purpose
One sentence explaining what this runbook accomplishes and when to use it.

## Prerequisites
- [ ] Access to production Kubernetes cluster
- [ ] Database admin credentials in 1Password vault "Prod-DB"
- [ ] Feature flag management access (LaunchDarkly)

## Steps

### Step 1: [Action]
\```bash
# Command with explanation
kubectl get pods -n orders -l app=order-api
\```
**Verify:** Pod count matches expected replica count.

### Step 2: [Action]
...

## Rollback
Steps to undo the procedure if something goes wrong.

## Contacts
| Role           | Person       | Slack              |
|----------------|--------------|--------------------|
| DB Admin       | @jane-smith  | #team-data         |
| Platform Lead  | @john-doe    | #team-platform     |
```

## 2. Release Procedure Runbook

```markdown
# Release Procedure — Owner: @team-platform — Est: 45 min

## Prerequisites
- [ ] All CI checks pass on `main`
- [ ] QA sign-off for the milestone

## Steps
### 1. Bump version and changelog
\```bash
git checkout main && git pull origin main
git checkout -b release/v2.4.0
npm version minor --no-git-tag-version
npx conventional-changelog -p angular -i CHANGELOG.md -s
\```
**Verify:** package.json version, CHANGELOG.md entries.

### 2. PR, merge, tag
\```bash
git add -A && git commit -m "chore: release v2.4.0"
gh pr create --title "chore: release v2.4.0" --body "Release checklist..."
# After merge:
git checkout main && git pull && git tag v2.4.0 && git push origin v2.4.0
\```

### 3. Deploy and verify
\```bash
kubectl rollout status deployment/order-api -n orders --timeout=5m
curl -s https://api.example.com/health | jq '.version'  # => "2.4.0"
\```

## Rollback Criteria
- Error rate > 1% | P99 latency > 2x baseline | 5xx on critical paths

## Rollback
\```bash
kubectl rollout undo deployment/order-api -n orders
\```
```

## 3. Database Migration Runbook

```markdown
# Database Migration — Owner: @team-data — Est: 15-60 min

## Prerequisites
- [ ] Migration tested on staging with production-size dataset
- [ ] Backup completed within last 1 hour
- [ ] Migration is backward-compatible (no column drops/renames)

## Steps
### 1. Pre-flight checks
\```bash
psql -c "SELECT pid, now()-query_start AS dur, query FROM pg_stat_activity
         WHERE state='active' AND query_start < now()-interval '5 min';"
psql -c "SELECT * FROM pg_locks WHERE NOT granted;"
\```

### 2. Run migration
\```bash
PGOPTIONS='-c statement_timeout=300000' npx prisma migrate deploy
# Or: goose -dir migrations postgres "$DATABASE_URL" up
\```
**Verify:** Migration output shows success. No errors in logs.

### 3. Validate
\```bash
psql -c "\d+ orders"
npm run test:integration -- --filter=orders
\```

## Rollback
\```bash
goose -dir migrations postgres "$DATABASE_URL" down
# If irreversible: pg_restore -d orders_db backup.dump
\```
```

## 4. Dependency Update Runbook

```markdown
# Dependency Update — Owner: @team-leads — Cadence: Weekly auto / Monthly manual

## Steps
### 1. Review and audit
\```bash
npm outdated && npm audit       # Node.js
pip list --outdated && pip-audit # Python
go list -m -u all && govulncheck ./...  # Go
\```

### 2. Evaluate each update
- [ ] Read CHANGELOG for breaking changes
- [ ] Review CVE fixes (if security update)
- [ ] Check GitHub issues for regressions

### 3. Apply and test
\```bash
npm update <package> && npm run test && npm run build && npm run test:e2e
\```

### 4. Staged rollout
Staging (24h) -> Production canary 10% (1h) -> 100%
```

## 5. Environment Setup Runbook (New Developer Onboarding)

```markdown
# Local Development Setup — Owner: @team-platform

## Prerequisites
- macOS 14+ / Ubuntu 22.04+ / Windows 11 with WSL2
- GitHub org access, 1Password team vault access

## Steps
### 1. Install toolchain
\```bash
curl https://mise.run | sh && mise install  # Reads .mise.toml
brew install --cask docker
\```

### 2. Clone, configure, start
\```bash
git clone git@github.com:myorg/order-platform.git && cd order-platform
cp .env.example .env.local  # Fill secrets from 1Password "Dev-Local"
docker compose up -d
npm run db:migrate && npm run db:seed && npm run dev
\```
**Verify:** `curl http://localhost:3000/health` returns `{"status":"ok"}`.

### 3. Run tests
\```bash
npm run test && npm run test:integration
\```

## Troubleshooting
| Symptom              | Fix                              |
|----------------------|----------------------------------|
| Port 5432 in use     | `brew services stop postgresql`  |
| Docker compose fails | Start Docker Desktop             |
| Migration fails      | Verify `.env.local` is complete  |
```

## 6. Feature Flag Lifecycle Runbook

```markdown
# Feature Flag Lifecycle

## Steps

### Create flag
\```bash
# In LaunchDarkly / Unleash / custom system
# Naming convention: <team>.<feature>.<scope>
# Example: orders.express-checkout.enabled
\```
- [ ] Flag defaults to OFF in all environments
- [ ] Flag has description and JIRA ticket link
- [ ] Flag has an expiration date (max 90 days for temporary flags)

### Enable progressively
1. Enable in development environment
2. Enable for internal users (dogfooding) in staging
3. Enable for 5% of production traffic (canary)
4. Monitor metrics for 24-48 hours
5. Ramp to 25% -> 50% -> 100%

### Cleanup after full rollout
\```bash
# Remove flag checks from code
rg "express-checkout" --files-with-matches
# Remove flag from flag management system
# PR title: "chore: remove express-checkout feature flag (FLAGS-123)"
\```
- [ ] Code references removed
- [ ] Flag archived/deleted from management system
- [ ] Stale flag alert cleared
```

## 7. Data Migration / Backfill Runbook

```markdown
# Data Migration / Backfill

## Prerequisites
- [ ] Migration script tested on staging with production-volume data
- [ ] Rollback script exists and is tested
- [ ] Stakeholders notified of migration window
- [ ] Monitoring dashboards open (DB connections, CPU, query latency)

## Steps

### Step 1: Estimate and plan
\```bash
# Count affected rows
psql -c "SELECT count(*) FROM orders WHERE migrated_at IS NULL;"
# Estimate time: rows / batch_size * sleep_interval
\```

### Step 2: Run in batches
\```python
# backfill_orders.py
import time
BATCH_SIZE = 1000
SLEEP_SECONDS = 0.5  # Throttle to avoid overloading DB

while True:
    affected = db.execute("""
        UPDATE orders
        SET new_column = compute_value(old_column),
            migrated_at = now()
        WHERE migrated_at IS NULL
        LIMIT %s
    """, [BATCH_SIZE])

    print(f"Migrated {affected} rows")
    if affected == 0:
        break
    time.sleep(SLEEP_SECONDS)
\```

### Step 3: Validate
\```bash
# Zero remaining
psql -c "SELECT count(*) FROM orders WHERE migrated_at IS NULL;"
# Data integrity check
psql -c "SELECT count(*) FROM orders WHERE new_column IS NULL AND old_column IS NOT NULL;"
\```
```

## 8. Runbook Maintenance

| Activity                     | Cadence    | Owner           |
|------------------------------|------------|-----------------|
| Review all runbooks          | Quarterly  | Tech Lead       |
| Test release runbook         | Monthly    | On-call engineer |
| Update after incidents       | Post-mortem| Incident owner  |
| Onboarding runbook dry run   | Each hire  | Buddy/mentor    |
| Dependency update review     | Monthly    | Security champion|

## 9. Runbook Testing

Validate runbooks before you need them in production.

- **Dry runs** -- execute in staging monthly; fix unclear or failing steps immediately.
- **Chaos days** -- quarterly game day practicing release+rollback, migration+rollback, environment rebuild, flag emergency kill.
- **New hire test** -- every new engineer follows the onboarding runbook unassisted; if they need help, the runbook has a gap to fix that day.

## 10. Runbook-as-Code

Replace prose steps with executable scripts. Humans verify; machines execute.

```yaml
# Taskfile.yml
version: "3"

tasks:
  release:
    desc: Run the full release procedure
    cmds:
      - task: release:preflight
      - task: release:bump
      - task: release:changelog
      - task: release:tag
      - task: release:deploy
      - task: release:verify

  release:preflight:
    desc: Verify release prerequisites
    cmds:
      - echo "Checking CI status..."
      - gh run list --branch main --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success
      - echo "CI is green."

  release:bump:
    desc: Bump version number
    cmds:
      - npm version {{.VERSION}} --no-git-tag-version
    vars:
      VERSION: '{{.CLI_ARGS | default "patch"}}'

  release:deploy:
    desc: Deploy to production
    cmds:
      - kubectl rollout status deployment/order-api -n orders --timeout=5m

  release:verify:
    desc: Verify deployment health
    cmds:
      - |
        VERSION=$(curl -s https://api.example.com/health | jq -r '.version')
        echo "Deployed version: $VERSION"

  release:rollback:
    desc: Emergency rollback
    cmds:
      - kubectl rollout undo deployment/order-api -n orders
      - kubectl rollout status deployment/order-api -n orders --timeout=5m
```

---

## Best Practices

1. **Use a consistent template** -- every runbook follows the same structure (purpose, prerequisites, steps with verification, rollback, contacts).
2. **Make every step verifiable** -- after each action include a "Verify" line that confirms the step succeeded before proceeding.
3. **Include rollback for every procedure** -- if a step cannot be rolled back, document that explicitly so operators know the point of no return.
4. **Test runbooks regularly** -- quarterly dry runs in staging and new-hire walkthroughs surface gaps before production incidents do.
5. **Keep runbooks executable** -- use Taskfiles/Makefiles with the prose runbook; link the runbook to the automation.
6. **Update runbooks post-incident** -- every post-mortem action item must include "update the runbook" when a procedure gap contributed to the incident.
7. **Scope runbooks narrowly** -- one procedure per runbook; "Release + Migration + Rollback" should be three separate runbooks that cross-reference.
8. **Version runbooks alongside code** -- store runbooks in the repository, not in a wiki; they evolve with the system they document.
9. **Assign ownership** -- every runbook has a named owner and review cadence; unowned runbooks rot within one quarter.
10. **Expire and archive stale runbooks** -- if a runbook has not been tested or used in 6 months, review it or archive it to avoid dangerous stale instructions.

---

## Anti-Patterns

| #  | Anti-Pattern                        | Problem                                                       | Fix                                                       |
|----|-------------------------------------|---------------------------------------------------------------|-----------------------------------------------------------|
| 1  | Wiki-only runbooks                  | Drift from code; no version history; unreviewable changes     | Store in the repo as markdown; review in PRs              |
| 2  | Steps without verification          | Operator follows steps blindly; fails silently at step 3      | Add "Verify:" after every step with expected output       |
| 3  | No rollback section                 | Operator panics when step fails; no recovery path documented  | Every runbook must include rollback or "point of no return"|
| 4  | 50-page mega-runbook                | Nobody reads it; critical steps buried in page 37             | One procedure per runbook; keep under 2 pages             |
| 5  | Untested runbooks                   | Steps reference tools or paths that no longer exist           | Quarterly dry runs; track last-tested date                |
| 6  | Prose-only steps                    | Ambiguous instructions lead to different interpretations      | Include exact commands; link to Taskfile/Makefile          |
| 7  | Missing prerequisites               | Operator discovers they lack access mid-procedure             | Prerequisites checklist at the top with access requirements|
| 8  | No ownership                        | Runbook written once, never updated, dangerously outdated     | Assign owner and review cadence; track in service catalog |

---

## Enforcement Checklist

- [ ] Every critical procedure (release, migration, rollback) has a runbook in the repository
- [ ] All runbooks follow the standard template (purpose, prerequisites, steps, rollback, contacts)
- [ ] Every step includes a verification action with expected output
- [ ] Runbooks have a named owner and review cadence recorded in metadata
- [ ] Release runbook includes rollback criteria and rollback steps
- [ ] Database migration runbook includes backup verification and backward-compatibility check
- [ ] Onboarding runbook is tested by every new hire; gaps are fixed within 1 day
- [ ] Runbooks are tested quarterly in staging (dry runs or chaos days)
- [ ] Executable automation (Taskfile/Makefile) exists alongside prose runbooks
- [ ] Post-incident action items include runbook updates when procedure gaps are found
