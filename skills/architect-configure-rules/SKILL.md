---
name: architect-configure-rules
description: Configure which architecture rules are active for a project. List all rules, enable/disable manual rules. Use when user asks "enable microservices rules", "configure rules", "which rules are active", or "disable i18n rules".
---

# Architect Configure Rules

Manage architecture rule configuration for a project.

## Rule Types

### Automatic Rules (26) — Always enforced
These rules are always active and cannot be disabled:
00-constitution, 01-architecture, 02-security, 03-testing, 04-api-design, 05-database, 06-documentation, 07-performance, 08-error-handling, 09-git-workflow, 10-frontend, 11-auth-patterns, 12-monitoring, 13-environment, 14-dependency-management, 15-code-style, 16-ci-cd, 17-owasp-top-ten, 18-data-privacy, 19-resilience-patterns, 20-concurrency, 22-accessibility, 26-advanced-code-quality, 28-advanced-api-patterns, 29-configuration-hygiene, 30-supply-chain-security

### Manual Rules (5) — User enables per project
- **21-microservices** — Only for distributed architectures (not monoliths)
- **23-internationalization** — Only for multi-locale apps
- **24-event-driven** — Only for CQRS/event sourcing architectures
- **25-infrastructure-as-code** — Only if project has Terraform/K8s/Docker
- **27-state-management** — Only for frontend apps with complex state

## Workflow

### List All Rules
```
architect_configure_rules(project_path: "...", list_available: true)
```
Shows auto rules, manual rules, and which manual rules are currently enabled.

### Enable Manual Rules
```
architect_configure_rules(project_path: "...", enable: ["21-microservices", "24-event-driven"])
```

### Disable Manual Rules
```
architect_configure_rules(project_path: "...", disable: ["21-microservices"])
```

## When to Suggest Enabling Manual Rules
- User mentions microservices, service mesh, API gateway → suggest 21-microservices
- User has i18n files, locale directories, or mentions translation → suggest 23-internationalization
- User mentions events, CQRS, event sourcing, message queues → suggest 24-event-driven
- Project has Dockerfile, terraform/, k8s/, helm/ → suggest 25-infrastructure-as-code
- Frontend project with Redux, Zustand, MobX, or complex state → suggest 27-state-management

## Output
After configuration changes, display:
- Which rules are now enabled/disabled
- Suggest running `architect_check` to see the impact of rule changes
