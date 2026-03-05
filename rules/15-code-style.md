---
mode: auto
---
## Code Style & Conventions

### Naming Conventions
- Variables/functions: camelCase — descriptive, pronounceable
- Classes/components: PascalCase
- Constants: UPPER_SNAKE_CASE for true constants, camelCase for derived values
- Files: kebab-case for general files, PascalCase for components
- Database: snake_case for tables, columns, indexes
- Booleans: prefix with is/has/can/should (isActive, hasPermission, canEdit)
- Functions: verb-first (getUser, createOrder, validateEmail, calculateTotal)

### Function Rules
- Max 30 lines per function — extract if longer
- Max 3 parameters — use options/config object if more needed
- Single return type — never return different shapes
- Pure functions preferred — minimize side effects
- Early return pattern — handle errors/edge cases first, main logic last

### File Organization
- Max 200 lines per file — split into focused modules if larger
- Consistent internal ordering:
  1. Imports (external → internal → relative, grouped with blank lines)
  2. Types/interfaces
  3. Constants
  4. Main export (class/function/component)
  5. Helper functions (private)
- One primary export per file — named export preferred over default

### Code Smells to Avoid
- God objects/classes: >5 methods that do unrelated things → split
- Feature envy: function that uses more data from another class than its own → move it
- Magic numbers/strings: use named constants → const MAX_RETRY = 3
- Deep nesting (>3 levels): extract to functions or use early returns
- Long parameter lists (>3): use parameter object
- Boolean parameters: use options object or separate functions
- Duplicate code across >2 locations: extract to shared utility (Rule of Three)
- String typing: use enums or union types for known values

### Formatting (Enforce via Tooling)
- Use Prettier/Black/equivalent — never argue about formatting
- Configure once, enforce via pre-commit hook or CI
- Tab width: 2 spaces (JS/TS), 4 spaces (Python)
- Max line length: 100 characters
- Trailing commas in multiline constructs
- Semicolons: follow language convention

### Type Safety
- Use TypeScript strict mode / Python type hints / equivalent
- No any/unknown types unless absolutely necessary (document why)
- Define explicit interfaces for all API contracts (request/response)
- Use enum/union types for finite sets of values
- Validate external data at boundaries with runtime type checking
