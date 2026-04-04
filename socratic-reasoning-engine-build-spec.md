# Socratic Reasoning Engine — Build Specification for Claude Architect Integration

## Purpose of this document

This is a complete build prompt. You (Claude Code) must read this document and integrate a **Socratic Reasoning Engine** into the existing `claude-architect` MCP plugin. You are not creating a new plugin — you are **enhancing** the existing one.

## What claude-architect does today

claude-architect is an MCP plugin that uses a database of best practices for how code should be written. In other words: it tells you **HOW** to write.

## What is missing

Today claude-architect only answers the HOW. It does not ask:

- WHAT exactly was requested?
- WHY was it requested?
- WHAT does the thing that needs to change consist of?
- WHERE in the code should it happen?
- WHEN should each step happen?
- WHO is affected?

And most importantly: it does not ask **do you KNOW or ASSUME?**

## What needs to be done

Add a **Socratic Reasoning Layer** to claude-architect. This layer runs **BEFORE** every significant action (file creation, refactors, architecture changes, dependency additions, API modifications, database changes, security-sensitive operations) and:

1. Deterministically generates 77 questions (7 dimensions x 11 operators)
2. Forces Claude Code to answer each one
3. Applies the META-OPERATOR to every answer: do you KNOW or ASSUME?
4. If ASSUMES → BLOCKS → forces verification (grep, web search, ask user)
5. Only after ALL verified → allows execution

---

## Architecture

### Position in the system

```
User Prompt
    |
    v
+-----------------------------+
|  claude-architect (MCP)     |
|                             |
|  +-----------------------+  |
|  | SOCRATIC LAYER (new)  |  |  <- Runs FIRST
|  | 7x11 questions        |  |
|  | + META-OPERATOR        |  |
|  | + Verification gates   |  |
|  +-----------+-----------+  |
|              |               |
|  +-----------v-----------+  |
|  | BEST PRACTICES (already|  |  <- Runs AFTER
|  | exists — the database) |  |
|  |                        |  |
|  +-----------------------+  |
+-----------------------------+
    |
    v
Claude Code writes code
(now WITH full knowledge, WITHOUT assumptions)
```

### Execution flow

1. User provides prompt → `analyze_before_action` (Socratic layer)
2. Socratic layer generates 77 questions
3. Claude Code answers → META-OPERATOR checks each answer
4. If ASSUMPTION → BLOCK → verification → retry
5. After ALL verified → `submit_reasoning` → `validate_reasoning`
6. NOW: best practices layer provides the technical guidance
7. Claude Code executes WITH full knowledge

---

## The Matrix: 7 Dimensions x 11 Operators

### Dimensions (Aristotle's Causes + Place)

| # | Dimension | Aristotle | Asks | In software |
|---|-----------|-----------|------|-------------|
| 1 | **WHAT** | Formal cause (Essence) | What is it? What is it not? | Definition, scope, boundaries |
| 2 | **WHY** | Final cause (Purpose) | Why does it exist? Why now? | Business reason, user need |
| 3 | **FROM WHAT** | Material cause (Matter) | What is it made of? | Stack, dependencies, tools |
| 4 | **HOW** | Efficient cause (Method) | How is it done? | Implementation approach |
| 5 | **WHEN** | Time (When) | When? In what order? | Execution order, prerequisites |
| 6 | **WHO** | Subject (Who) | Who is involved? | Stakeholders, affected parties |
| 7 | **WHERE** | Place (Where) | Where in the code? | Files, modules, environments |

### Operators (Modal Logic)

| # | Operator | Logic | Asks |
|---|----------|-------|------|
| 1 | **EINAI** | Affirmation | What exists? What holds true? |
| 2 | **DEN_EINAI** | Negation | What does not exist? What does not hold? |
| 3 | **PREPEI** | Deontic (obligatory) | What is mandatory? |
| 4 | **DEN_PREPEI** | Deontic (forbidden) | What is forbidden? |
| 5 | **MPOREI** | Possibility | What is possible? |
| 6 | **DEN_MPOREI** | Impossibility | What is impossible? |
| 7 | **ALLAZEI** | Change | What changes? |
| 8 | **EKSARTATAI** | Dependency (upstream) | What does this depend on? |
| 9 | **PROKALEI** | Causality (downstream) | What does this break? |
| 10 | **MOIAZEI** | Analogy | What similar thing exists? |
| 11 | **ORIO** | Boundary | Where does it end? |

### Total: 7 x 11 = 77 questions per subject

---

## META-OPERATOR: KNOW / ASSUME

**This is the most important part of the entire system.**

The META-OPERATOR is not inside the matrix. It is applied to **EVERY ANSWER** that Claude Code gives. It is an enforcement gate:

### Rule

```
Every answer to every question ->
  Do you KNOW this or ASSUME this?
    KNOW (verified) -> OK, proceed
    ASSUME -> BLOCKED -> SEARCH NOW -> verification -> retry
```

### Verification rules per dimension

When Claude Code ASSUMES, it must perform verification depending on the dimension:

| Dimension | Verification method | Command |
|-----------|-------------------|---------|
| **WHAT** | Web search | Search for definition, spec, standard |
| **WHY** | Ask user | Ask the user about the purpose |
| **FROM WHAT** | Read codebase | `cat package.json`, `grep`, imports |
| **HOW** | Web search + docs | Search best practice, official docs |
| **WHEN** | Read codebase | Dependency graph, imports, CI config |
| **WHO** | Ask user | Ask team structure, responsibilities |
| **WHERE** | Read codebase | `find`, `ls`, `grep`, directory structure |

### ABSOLUTE RULE

**If you do not KNOW something, do NOT make ANY assumption. Search NOW:**
- If the information is in the code → `Read`, `Grep`, `Glob`, `Bash`
- If the information is technical knowledge → web search (if available) or official docs
- If the information depends on the user → ASK the user
- If you cannot find it → DECLARE IT, do not guess

---

## Recursive exhaustion

Every non-atomic answer becomes a **new subject** and must pass through the matrix again:

```
Prompt: "Build dark mode"
|
+- WHAT x EINAI -> "Alternative color scheme" (non-atomic)
|   |
|   +- WHAT x DEN_EINAI -> "Not inverted colors" (non-atomic)
|   |   |
|   |   +- WHY x EINAI -> "Because inversion breaks images" (atomic)
|   |   +- ...52 more questions
|   |
|   +- WHAT x PREPEI -> "WCAG AA contrast >= 4.5:1" (atomic)
|   +- ...52 more questions
|
+- WHAT x DEN_EINAI -> ...
+- ...76 more questions
```

### Termination rules

A branch terminates (no recursion needed) when the answer is:

1. **Atomic fact** — verifiable fact (grep output, spec number, file path)
2. **Already known** — the same answer was found in another branch
3. **External dependency** — requires human input
4. **Max depth** — safety limit (recommended 3-4 levels)

### Practical depth limit

In production, you do NOT run 77 questions at every depth. Use this strategy:

- **Level 1 (prompt)**: ALL 77 questions — mandatory
- **Level 2 (answers)**: Only non-atomic answers → filtered subset (typically 20-35)
- **Level 3 (answers of answers)**: Only if critical unknowns remain (typically 5-15)
- **Level 4+**: Rare — almost everything terminates by this point

Estimated total for a medium prompt: 100-150 questions, ~30-60 seconds.

---

## Question templates

Every question is generated deterministically from the formula:

```
Question = Template[Dimension][Operator].format(subject)
```

### Full template table

```
WHAT x EINAI        -> "What IS '{subject}'?"
WHAT x DEN_EINAI    -> "What is '{subject}' NOT?"
WHAT x PREPEI       -> "What MUST '{subject}' be?"
WHAT x DEN_PREPEI   -> "What MUST '{subject}' NOT be?"
WHAT x MPOREI       -> "What CAN '{subject}' be?"
WHAT x DEN_MPOREI   -> "What CAN '{subject}' NOT be?"
WHAT x ALLAZEI      -> "What CHANGES in '{subject}'?"
WHAT x EKSARTATAI   -> "What does '{subject}' DEPEND on?"
WHAT x PROKALEI     -> "What does '{subject}' CAUSE?"
WHAT x MOIAZEI      -> "What RESEMBLES '{subject}'?"
WHAT x ORIO         -> "Where does '{subject}' END?"

WHY x EINAI        -> "Why does '{subject}' EXIST?"
WHY x DEN_EINAI    -> "Why doesn't '{subject}' ALREADY exist?"
WHY x PREPEI       -> "Why MUST '{subject}'?"
WHY x DEN_PREPEI   -> "Why MUST '{subject}' NOT?"
WHY x MPOREI       -> "Why MIGHT '{subject}' fail?"
WHY x DEN_MPOREI   -> "Why CAN'T '{subject}' be otherwise?"
WHY x ALLAZEI      -> "Why is the purpose of '{subject}' CHANGING?"
WHY x EKSARTATAI   -> "What does the purpose of '{subject}' DEPEND on?"
WHY x PROKALEI     -> "Why does '{subject}' CAUSE a problem?"
WHY x MOIAZEI      -> "Who ELSE solves '{subject}'?"
WHY x ORIO         -> "Where does the purpose of '{subject}' END?"

FROM_WHAT x EINAI        -> "What is '{subject}' COMPOSED of?"
FROM_WHAT x DEN_EINAI    -> "What is NOT part of '{subject}'?"
FROM_WHAT x PREPEI       -> "What MUST exist before '{subject}'?"
FROM_WHAT x DEN_PREPEI   -> "What MUST NOT be used in '{subject}'?"
FROM_WHAT x MPOREI       -> "What CAN be used for '{subject}'?"
FROM_WHAT x DEN_MPOREI   -> "What CAN'T be used in '{subject}'?"
FROM_WHAT x ALLAZEI      -> "What material CHANGES in '{subject}'?"
FROM_WHAT x EKSARTATAI   -> "What does the material of '{subject}' DEPEND on?"
FROM_WHAT x PROKALEI     -> "What downstream does '{subject}' CAUSE?"
FROM_WHAT x MOIAZEI      -> "What PATTERN resembles '{subject}'?"
FROM_WHAT x ORIO         -> "What is the material BOUNDARY of '{subject}'?"

HOW x EINAI        -> "How IS '{subject}' done now?"
HOW x DEN_EINAI    -> "How should '{subject}' NOT be done?"
HOW x PREPEI       -> "How MUST '{subject}' be done?"
HOW x DEN_PREPEI   -> "How MUST '{subject}' NEVER be done?"
HOW x MPOREI       -> "How else CAN '{subject}' be done?"
HOW x DEN_MPOREI   -> "How CAN '{subject}' NOT be done?"
HOW x ALLAZEI      -> "How does the method of '{subject}' CHANGE?"
HOW x EKSARTATAI   -> "What does the method of '{subject}' DEPEND on?"
HOW x PROKALEI     -> "How does '{subject}' CAUSE side effects?"
HOW x MOIAZEI      -> "How do OTHERS do '{subject}'?"
HOW x ORIO         -> "Where does the method of '{subject}' STOP?"

WHEN x EINAI        -> "When does '{subject}' HAPPEN?"
WHEN x DEN_EINAI    -> "When should '{subject}' NOT happen?"
WHEN x PREPEI       -> "What MUST happen first before '{subject}'?"
WHEN x DEN_PREPEI   -> "What MUST NOT happen first in '{subject}'?"
WHEN x MPOREI       -> "What CAN happen in parallel with '{subject}'?"
WHEN x DEN_MPOREI   -> "What CAN'T happen in parallel with '{subject}'?"
WHEN x ALLAZEI      -> "When does the order of '{subject}' CHANGE?"
WHEN x EKSARTATAI   -> "What does the order of '{subject}' DEPEND on?"
WHEN x PROKALEI     -> "When does '{subject}' CAUSE a problem?"
WHEN x MOIAZEI      -> "When has this been done ELSEWHERE for '{subject}'?"
WHEN x ORIO         -> "How much TIME is there for '{subject}'?"

WHO x EINAI        -> "Who is INVOLVED in '{subject}'?"
WHO x DEN_EINAI    -> "Who is NOT involved in '{subject}'?"
WHO x PREPEI       -> "Who MUST approve '{subject}'?"
WHO x DEN_PREPEI   -> "Who MUST NOT touch '{subject}'?"
WHO x MPOREI       -> "Who CAN help with '{subject}'?"
WHO x DEN_MPOREI   -> "Who CAN'T do '{subject}'?"
WHO x ALLAZEI      -> "Who is AFFECTED by '{subject}'?"
WHO x EKSARTATAI   -> "Who DEPENDS on whom in '{subject}'?"
WHO x PROKALEI     -> "Who does '{subject}' IMPACT?"
WHO x MOIAZEI      -> "Who has done this WELL for '{subject}'?"
WHO x ORIO         -> "Who DECIDES the boundaries of '{subject}'?"

WHERE x EINAI        -> "Where IS '{subject}' in the code?"
WHERE x DEN_EINAI    -> "Where should '{subject}' NOT be?"
WHERE x PREPEI       -> "Where MUST '{subject}' go?"
WHERE x DEN_PREPEI   -> "Where MUST '{subject}' NEVER go?"
WHERE x MPOREI       -> "Where else CAN '{subject}' go?"
WHERE x DEN_MPOREI   -> "Where CAN '{subject}' NOT go?"
WHERE x ALLAZEI      -> "Where does '{subject}' CHANGE at runtime?"
WHERE x EKSARTATAI   -> "What does the location of '{subject}' DEPEND on?"
WHERE x PROKALEI     -> "Where does '{subject}' CAUSE changes?"
WHERE x MOIAZEI      -> "Where does something like '{subject}' ALREADY exist?"
WHERE x ORIO         -> "Where does '{subject}' END?"
```

---

## Technical implementation

### Tools to be added/modified

Add 3 new MCP tools to claude-architect:

#### Tool 1: `socratic_analyze`

```typescript
// Description (IMPORTANT — this is what Claude Code sees):
"MANDATORY: Call BEFORE any significant code change. Generates Socratic
questions using 7x11 matrix (Dimensions x Operators). Returns questions
that MUST be answered before proceeding. Every answer will be checked:
do you KNOW this or ASSUME this? Assumptions are BLOCKED until verified."

// Input schema:
{
  action_description: string,  // what you want to do (min 20 chars)
  action_type: enum [
    "file_creation", "major_refactor", "architecture_change",
    "dependency_addition", "api_modification", "database_change",
    "config_change", "security_sensitive", "feature_addition",
    "bug_fix", "performance_optimization", "other_significant"
  ],
  affected_scope: string,  // which files/modules are affected
  user_original_prompt: string  // exactly what the user said
}

// Output: Structured list of 77 questions grouped by dimension
```

#### Tool 2: `socratic_verify`

```typescript
// Description:
"Submit answers to Socratic questions. Each answer is checked against
the KNOW/ASSUME gate. If any answer is an assumption, you will
receive specific verification commands to execute BEFORE proceeding."

// Input schema:
{
  session_id: string,
  answers: Record<string, {
    answer: string,           // the answer
    confidence: "KNOW" | "ASSUME" | "DONT_KNOW",
    evidence: string | null,  // how you know this (grep output, file content, etc.)
  }>
}

// Output:
// - If ALL = KNOW -> "VALIDATED — proceed"
// - If any = ASSUME -> verification commands + BLOCKED
// - If any = DONT_KNOW -> specific search/ask commands
```

#### Tool 3: `socratic_status`

```typescript
// Description:
"Check if pre-action reasoning is complete and validated.
Returns current status and any remaining unverified assumptions."

// Input: { session_id: string }
// Output: { status, verified_count, assumption_count, blocked_questions }
```

### Integration with existing best practices layer

The execution order must be:

```
1. socratic_analyze -> generates questions
2. Claude Code answers (using Read, Grep, web search)
3. socratic_verify -> checks answers
4. (if assumptions) -> verification loop
5. socratic_verify -> VALIDATED
6. [EXISTING] best practices lookup -> technical guidance
7. Claude Code executes
```

The best practices layer now receives RICHER context:
- It knows WHAT exactly was requested (verified)
- It knows FROM WHAT it consists of (verified stack info)
- It knows WHERE the change will happen (verified paths)
- It can provide MORE ACCURATE best practices

### State management

Use an in-memory Map or a temp file for state:

```typescript
interface SocraticSession {
  sessionId: string;
  prompt: string;
  questions: Question[];  // 77 questions
  answers: Map<string, Answer>;
  verifiedCount: number;
  assumptionCount: number;
  status: "analyzing" | "verifying" | "blocked" | "validated";
  createdAt: number;
  validatedAt: number | null;
}
```

### Enforcement (CLAUDE.md integration)

Add to the project's CLAUDE.md:

```markdown
## MANDATORY: Socratic Pre-Action Protocol

Before ANY significant code change, you MUST:
1. Call `socratic_analyze` with action details
2. Answer ALL 77 questions — for each, state: KNOW / ASSUME / DONT_KNOW
3. If ASSUME -> STOP. Do NOT write code. First:
   - Read codebase (grep, find, cat) for code facts
   - Web search for technical standards
   - Ask user for business/team decisions
4. Call `socratic_verify` with verified answers
5. Only when status = VALIDATED -> proceed with code

CRITICAL RULE: NO ASSUMPTIONS. EVER.
If you don't KNOW something, you don't code it. You FIND it first.
```

### PreToolUse Hook enforcement

If you want hard enforcement (recommended), add a hook in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit|Bash",
        "hooks": [{
          "type": "command",
          "command": "node .claude/hooks/check-socratic-session.js"
        }]
      }
    ]
  }
}
```

The hook script checks whether a validated socratic session exists. If it does not, it blocks (exit code 2) and tells Claude Code to call `socratic_analyze` first.

Exceptions (tools that do not need Socratic analysis):
- `Read`, `Glob`, `Grep`, `LS` — read-only operations
- The socratic tools themselves
- `Bash` commands that are read-only (grep, find, cat, ls)

---

## Full flow example

### Prompt: "Add authentication to the API"

**Step 1: socratic_analyze**

```
Questions generated: 77
Subject: "authentication for the API"
```

**Step 2: Claude Code answers (sample)**

```
WHAT x EINAI -> "JWT-based authentication"
  META: Do you KNOW? -> "ASSUME"
  BLOCKED -> grep -r "jwt\|passport\|auth" package.json
  -> Found: passport + express-session (NOT JWT)
  -> NOW I KNOW: "Session-based auth with passport"

FROM_WHAT x EINAI -> "Express + passport"
  META: Do you KNOW? -> "KNOW" (just verified from package.json)
  OK

WHERE x PREPEI -> "src/middleware/auth.ts"
  META: Do you KNOW? -> "ASSUME"
  BLOCKED -> find . -name '*.ts' -path '*middleware*'
  -> Found: src/server/middleware/ (not src/middleware/)
  -> NOW I KNOW: "src/server/middleware/auth.ts"

HOW x MOIAZEI -> "I don't know what others do"
  META: Do you KNOW? -> "DONT_KNOW"
  BLOCKED -> web search "passport session authentication best practices 2025"
  -> Found: official passport docs + OWASP session guidelines
  -> NOW I KNOW
```

**Step 3: socratic_verify**

```
Status: VALIDATED
Verified: 77/77
Assumptions caught and resolved: 12
Facts discovered through verification:
  - Stack: Express + Passport (not JWT)
  - Location: src/server/middleware/ (not src/middleware/)
  - Existing: partial auth in routes/auth.js (needs migration)
  - Constraint: session store needed (Redis already in docker-compose)
  - Pattern: existing middleware follows factory pattern
```

**Step 4: Best practices layer**
Now receives verified context → provides correct guidance

**Step 5: Claude Code writes code**
Correct stack, correct location, correct pattern, 0 assumptions.

---

## Summary of changes

| What | Action |
|------|--------|
| New tools | `socratic_analyze`, `socratic_verify`, `socratic_status` |
| Question engine | 7x11 matrix generator (pure function, deterministic) |
| META-OPERATOR | KNOW/ASSUME enforcement gate on every answer |
| Verification rules | Per-dimension: Read/WebSearch/AskUser mapping |
| State | Session tracking (in-memory + optional temp file) |
| CLAUDE.md | Pre-action protocol instructions |
| Hooks (optional) | PreToolUse enforcement script |
| Integration | Socratic -> (verified context) -> Best Practices -> Execute |

## Note

This does not replace anything from the existing claude-architect. It **enhances** it. The best practices database remains — it is now simply fed with **verified context** instead of assumptions. The quality of best practices recommendations improves automatically because they know exactly what stack, which files, what pattern, what scope.
