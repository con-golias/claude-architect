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

### Step 2: Display Results
Format the results clearly:

1. **Compliance Score**: Show as X/100 with trend indicator
2. **Violations by Severity**:
   - Critical (must fix immediately)
   - Warning (should fix soon)
   - Info (nice to have)
3. **Category Breakdown**: Score per category (architecture, security, quality, docs)
4. **Feature Map**: Table of features with their compliance status
5. **Top Violations**: List the most impactful violations first

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

### Violations
| Severity | Count |
|----------|-------|
| Critical | 2     |
| Warning  | 5     |
| Info     | 8     |

### Critical Issues
1. [01-architecture] Domain imports infrastructure in src/features/auth/domain/user.ts:15
   → Move to port interface in domain/ports/

2. [02-security] Hardcoded API key in src/config/api.ts:23
   → Move to environment variable
```
