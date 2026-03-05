---
name: architect-check
description: Run full architecture compliance check. Reports violations, compliance score, and improvement suggestions. Use when user asks "check architecture", "validate code", "compliance score", or "how healthy is my project".
---

# Architect Check

Run a comprehensive architecture compliance validation.

## Workflow

### Step 1: Run Compliance Check
Call the `architect_check` MCP tool with the current project path:
```
architect_check(project_path: "/path/to/project")
```

### Step 1.5: Check Rule Configuration
Call `architect_configure_rules(project_path, list_available: true)` to see which manual rules are active.
Note: Check results depend on which manual rules are enabled. If the user's project uses microservices,
event-driven architecture, or i18n, suggest enabling the relevant manual rules for a complete check.

### Step 2: Display Results

**CRITICAL: You MUST use the EXACT violation counts from the tool response. Do NOT group, merge, summarize, or skip any violations. The dashboard at localhost:37778 shows the same data — if your counts differ from the dashboard, users will lose trust in the plugin.**

Count violations by severity directly from the `violations` array in the response:
- Count all items where `severity === "critical"` → show as Critical count
- Count all items where `severity === "warning"` → show as Warning count
- Count all items where `severity === "info"` → show as Info count

Format the results clearly:

1. **Compliance Report Header**: `## Compliance Report — {projectName}`
2. **Score**: Show `overallScore` as X/100 with trend indicator
3. **Violations Table**: Show the EXACT counts per severity from the tool response
4. **Category Breakdown**: Show `scoresByCategory` values (dependency, structure, security, quality, docs)
5. **Feature Map**: Table of `featureMap` entries with their compliance status
6. **Critical Issues**: List ALL critical violations with file path, line number, code snippet, and suggested fix
7. **Warning Issues**: List ALL warning violations
8. **Info Issues**: List ALL info violations (every single one)

> **Tip:** After displaying the report, remind the user: "View the interactive dashboard with charts and history at http://localhost:37778"

### Step 3: Suggest Fixes
For each critical violation:
- Explain what's wrong
- Show exactly how to fix it
- Offer to fix automatically if simple

### Step 4: Check for Improvements
Call `architect_improve` to see if any self-improvement suggestions are available.

## Example Output Format

```
## Compliance Report — MyProject

Score: 78/100 (improving ↑)

---
Violations

| Severity | Count |
|----------|-------|
| Critical | 2     |
| Warning  | 5     |
| Info     | 8     |

---
Category Scores

| Category   | Score |
|------------|-------|
| Dependency | 100   |
| Structure  | 75    |
| Security   | 60    |
| Quality    | 85    |
| Docs       | 70    |

---
Critical Issues

1. [security] Hardcoded API key — src/config/api.ts:23
   const API_KEY = "sk-abcdef123456";
   → Move to environment variable: process.env.API_KEY

2. [security] eval() usage — src/utils/dynamic.ts:10
   return eval(code);
   → Remove entirely or replace with safe alternative

---
Warning Issues

1. [structure] Feature "auth" missing infrastructure/ directory
   → Create src/features/auth/infrastructure/

---
Info Issues

1. [quality] Missing test file for "api.ts" — src/api.ts
2. [quality] Missing test file for "User.ts" — src/features/auth/domain/User.ts
3. [docs] Missing JSDoc for "login" — src/features/auth/application/LoginUseCase.ts:6
4. [docs] Feature "auth" missing README.md
```
