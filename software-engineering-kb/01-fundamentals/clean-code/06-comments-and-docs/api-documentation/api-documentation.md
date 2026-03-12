# API Documentation

> **Domain:** Fundamentals > Clean Code > Comments and Documentation
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

API documentation is the systematic description of an application programming interface — its endpoints, parameters, return types, errors, and usage examples. Unlike code comments (which are for developers reading source code), API docs are for **consumers** of the API.

Key standards and tools:
- **OpenAPI/Swagger:** The industry standard for REST API specification.
- **JSDoc/TypeDoc:** JavaScript/TypeScript inline documentation.
- **Javadoc:** Java's built-in documentation system.
- **Python Docstrings + Sphinx:** Python documentation ecosystem.
- **ADR (Architecture Decision Records):** Documenting architectural decisions.

## Why It Matters

APIs are contracts between teams and systems. Undocumented or poorly documented APIs cause integration errors, support tickets, and wasted developer time. Swagger reports that teams with good API docs spend **50% less time on integration**.

## How It Works

### OpenAPI/Swagger Example

```yaml
openapi: 3.0.3
info:
  title: User API
  version: 1.0.0
paths:
  /users/{id}:
    get:
      summary: Get a user by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: User found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found
```

### JSDoc Example

```typescript
/**
 * Calculates the total price including tax and discounts.
 *
 * @param items - The cart items to price
 * @param taxRate - Tax rate as a decimal (e.g., 0.2 for 20%)
 * @returns The final price in cents
 * @throws {InvalidItemError} When an item has negative quantity
 *
 * @example
 * const total = calculateTotal([{ price: 1000, qty: 2 }], 0.2);
 * // Returns 2400 (2 items at $10 each + 20% tax)
 */
function calculateTotal(items: CartItem[], taxRate: number): number { ... }
```

### Architecture Decision Records (ADR)

```markdown
# ADR-001: Use PostgreSQL for Primary Database

## Status: Accepted

## Context
We need a relational database that supports JSON operations and full-text search.

## Decision
We will use PostgreSQL 16 as our primary database.

## Consequences
- (+) Excellent JSON support with jsonb
- (+) Mature ecosystem, strong community
- (-) More complex to scale horizontally than NoSQL options
```

### Changelog (Keep a Changelog Format)

```markdown
## [1.2.0] - 2026-03-01
### Added
- User profile image upload endpoint
### Fixed
- Race condition in concurrent order processing
### Changed
- Upgraded authentication to OAuth 2.1
```

## Best Practices

1. **Document public APIs, not internal code.** Internal code should be self-documenting; public APIs need explicit documentation.
2. **Use OpenAPI spec as the single source of truth.** Generate server stubs and client SDKs from it.
3. **Include examples** — they're the most-read part of any documentation.
4. **Document error responses.** Callers need to know what can go wrong and why.
5. **Keep changelogs updated.** Use [Keep a Changelog](https://keepachangelog.com/) format.
6. **Write ADRs for significant decisions.** Future developers need to understand why choices were made.

## Anti-patterns / Common Mistakes

- **Outdated docs:** API docs that don't match the actual implementation. Use code-generated docs to prevent this.
- **No error documentation:** Only documenting the happy path.
- **Missing examples:** Abstract descriptions without concrete usage examples.

## Sources

- [Swagger/OpenAPI Documentation](https://swagger.io/docs/)
- [Keep a Changelog](https://keepachangelog.com/)
- [ADR GitHub Organization](https://adr.github.io/)
- [8 Code Documentation Best Practices (Zest)](https://meetzest.com/blog/code-documentation-best-practices)
