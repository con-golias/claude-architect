# Claude Architect — Hook Context

## Hook Behavior Summary

### SessionStart
- Detects current project path
- Registers/updates project in database
- Returns recent context: last 3 decisions, open violations, compliance score

### UserPromptSubmit
- Determines relevant architecture rules for current working directory
- Returns compact rule summary + open violations for this area

### PostToolUse (Write/Edit)
- Queues changed file for lightweight violation check
- Validates dependency direction and file size
- Returns warning if violation detected

### Stop
- Summarizes architectural changes made in session
- Auto-detects and logs architectural decisions
- Updates compliance score snapshot
- Triggers self-improvement analysis if enough data accumulated
