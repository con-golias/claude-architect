# Code Documentation

| Attribute     | Value                                                                              |
|---------------|------------------------------------------------------------------------------------|
| Domain        | Code Quality > Documentation                                                       |
| Importance    | Critical                                                                           |
| Last Updated  | 2026-03                                                                            |
| Cross-ref     | [API Documentation](api-documentation.md), [Architecture Docs](architecture-docs.md) |

---

## 1. When to Write Comments

Write comments when the **why** is not obvious from the code. Comments explain intent, constraints, and business rules that the code alone cannot convey.

### Write comments for:

- **Complex algorithms** -- explain the approach and why alternatives were rejected
- **Business rules** -- link to the specification or requirement
- **Workarounds** -- explain what is broken and when the workaround can be removed
- **Performance-critical code** -- explain why a non-obvious optimization exists
- **TODOs with ticket numbers** -- `// TODO(JIRA-1234): Remove after migration completes`
- **Regulatory requirements** -- cite the regulation driving the implementation

## 2. When NOT to Write Comments

### BAD: Restating what the code does

```typescript
// BAD: Comment restates the code
// Increment counter by one
counter += 1;

// BAD: Obvious getter
// Returns the user's name
function getUserName(user: User): string {
  return user.name;
}

// BAD: Commented-out code left "just in case"
// function oldCalculation(x: number) {
//   return x * 1.05;
// }
```

### GOOD: Explaining why

```typescript
// GOOD: Explains business rule
// Tax-exempt customers skip sales tax calculation per IRS Publication 557.
if (customer.taxExempt) {
  return subtotal;
}

// GOOD: Explains workaround with removal plan
// HACK(JIRA-4521): Stripe API returns amount in cents for USD but units
// for JPY. Normalize here until we migrate to Payment Service v3.
const normalizedAmount = currency === "JPY" ? amount : amount / 100;

// GOOD: Explains performance decision
// Use a Map instead of object for O(1) lookup on 100k+ entries.
// Benchmarked: Map is 3x faster at this scale (see bench/lookup.ts).
const userIndex = new Map<string, User>();
```

## 3. JSDoc / TSDoc

```typescript
/**
 * Calculate the shipping cost for an order.
 *
 * Uses tiered pricing based on total weight. International orders
 * add a flat surcharge per customs regulations (see SHIP-POLICY-2024).
 *
 * @param items - Order line items with weight and quantity
 * @param destination - Shipping destination address
 * @param options - Optional shipping preferences
 * @returns Shipping cost in the order's currency (minor units)
 * @throws {InvalidAddressError} When destination cannot be validated
 * @throws {ShippingUnavailableError} When no carrier serves the destination
 *
 * @example
 * ```ts
 * const cost = calculateShipping(
 *   [{ sku: "W-001", weight: 500, quantity: 2 }],
 *   { country: "US", zip: "94105" },
 * );
 * // => 899 (i.e., $8.99)
 * ```
 *
 * @see {@link https://wiki.internal/shipping-policy | Shipping Policy}
 * @since 2.3.0
 */
function calculateShipping(
  items: OrderItem[],
  destination: Address,
  options?: ShippingOptions,
): number {
  // ...
}

/**
 * @deprecated Use {@link calculateShipping} instead. Will be removed in v4.0.
 */
function getShippingCost(items: OrderItem[]): number {
  return calculateShipping(items, defaultAddress);
}
```

## 4. Python Docstrings

### Google Style (recommended)

```python
def calculate_shipping(
    items: list[OrderItem],
    destination: Address,
    *,
    expedited: bool = False,
) -> int:
    """Calculate shipping cost for an order.

    Uses tiered pricing based on total weight. International orders
    add a flat surcharge per customs regulations (SHIP-POLICY-2024).

    Args:
        items: Order line items with weight and quantity.
        destination: Shipping destination address.
        expedited: Use expedited carrier if available.

    Returns:
        Shipping cost in minor currency units (e.g., cents for USD).

    Raises:
        InvalidAddressError: When destination cannot be validated.
        ShippingUnavailableError: When no carrier serves the destination.

    Example:
        >>> calculate_shipping(
        ...     [OrderItem(sku="W-001", weight=500, quantity=2)],
        ...     Address(country="US", zip="94105"),
        ... )
        899

    .. versionadded:: 2.3.0
    """
```

## 5. Go Documentation (godoc Conventions)

```go
// Package shipping calculates shipping costs for orders.
//
// It supports domestic and international destinations with tiered
// pricing based on weight. See the shipping policy documentation
// at https://wiki.internal/shipping-policy for rate tables.
package shipping

// CalculateShipping returns the shipping cost in minor currency units
// for the given items and destination.
//
// International orders include a flat surcharge per customs regulations.
// Returns [ErrInvalidAddress] if the destination cannot be validated
// and [ErrShippingUnavailable] if no carrier serves the route.
func CalculateShipping(items []OrderItem, dest Address, opts ...Option) (int, error) {
    // ...
}

// Example functions serve as executable documentation and tests.
func ExampleCalculateShipping() {
    cost, err := CalculateShipping(
        []OrderItem{{SKU: "W-001", Weight: 500, Qty: 2}},
        Address{Country: "US", Zip: "94105"},
    )
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(cost)
    // Output: 899
}
```

## 6. Inline Documentation Patterns

```typescript
// PATTERN: Link to external specification
// Implements OAuth 2.0 PKCE flow per RFC 7636 Section 4.
// See: https://datatracker.ietf.org/doc/html/rfc7636#section-4
function generateCodeChallenge(verifier: string): string {
  // S256 method: BASE64URL(SHA256(verifier))
  return base64url(sha256(verifier));
}

// PATTERN: Regulatory requirement
// GDPR Art. 17 — Right to erasure: delete all PII within 30 days.
// Audit log retained for 7 years per SOX compliance (non-PII only).
async function deleteUserData(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(users).where(eq(users.id, userId));
    await tx.insert(auditLog).values({
      action: "user_deletion",
      subjectId: userId,
      // Store only the action, not the deleted PII
    });
  });
}

// PATTERN: Non-obvious constant
// 86400 = 24 * 60 * 60 (seconds in a day)
// Using raw number because time.Duration math with days is error-prone
// due to DST transitions. This is intentionally UTC-only.
const SECONDS_PER_DAY = 86400;
```

## 7. README Anatomy for Libraries

```markdown
# @acme/shipping-calculator

Calculate shipping costs with tiered pricing and international support.

## Installation

npm install @acme/shipping-calculator

## Quick Start

\```typescript
import { calculateShipping } from "@acme/shipping-calculator";

const cost = await calculateShipping({
  items: [{ sku: "W-001", weight: 500, quantity: 2 }],
  destination: { country: "US", zip: "94105" },
});
console.log(cost); // 899 (cents)
\```

## API Reference

### `calculateShipping(params: ShippingParams): Promise<number>`

| Parameter                | Type     | Required | Description                    |
|--------------------------|----------|----------|--------------------------------|
| `params.items`           | `Item[]` | Yes      | Line items with SKU and weight |
| `params.destination`     | `Address`| Yes      | Shipping destination           |
| `params.expedited`       | `boolean`| No       | Use expedited carrier          |

**Returns:** Cost in minor currency units.
**Throws:** `InvalidAddressError`, `ShippingUnavailableError`

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and PR guidelines.

## License

Apache-2.0
```

## 8. Documentation Testing

### Python doctest

```python
def celsius_to_fahrenheit(celsius: float) -> float:
    """Convert Celsius to Fahrenheit.

    >>> celsius_to_fahrenheit(0)
    32.0
    >>> celsius_to_fahrenheit(100)
    212.0
    >>> celsius_to_fahrenheit(-40)
    -40.0
    """
    return celsius * 9 / 5 + 32

# Run: python -m doctest -v module.py
# Or in pytest: pytest --doctest-modules
```

### Go example tests

```go
func ExampleCelsiusToFahrenheit() {
    fmt.Println(CelsiusToFahrenheit(0))
    fmt.Println(CelsiusToFahrenheit(100))
    // Output:
    // 32
    // 212
}
// Run: go test -run Example
```

## 9. Documentation Linting

```yaml
# .markdownlint.yaml
default: true
MD013: false           # Disable line length (handled by prettier)
MD033:
  allowed_elements:    # Allow specific HTML in markdown
    - details
    - summary
    - br
MD041: true            # First line must be a heading
```

```yaml
# .vale.ini
StylesPath = .vale/styles
MinAlertLevel = suggestion

[*.md]
BasedOnStyles = Vale, write-good, alex

# Custom vocabulary
Vale.Terms = YES
```

```yaml
# CI integration
- name: Lint documentation
  run: |
    npx markdownlint-cli2 "docs/**/*.md"
    vale docs/
    npx alex docs/  # Inclusive language check
```

## 10. Auto-Generating Documentation

| Tool     | Language   | Input              | Output           |
|----------|------------|--------------------|------------------|
| TypeDoc  | TypeScript | TSDoc comments     | HTML/Markdown    |
| Sphinx   | Python     | Docstrings + RST   | HTML/PDF/ePub    |
| pkgsite  | Go         | godoc comments     | HTML             |
| Dokka    | Kotlin     | KDoc comments      | HTML/Markdown    |
| Rustdoc  | Rust       | Doc comments       | HTML             |

```yaml
# Generate and deploy TypeDoc
- name: Generate docs
  run: npx typedoc --out docs/api src/index.ts

# Generate and deploy Sphinx
- name: Generate docs
  run: |
    cd docs && sphinx-build -b html source build
```

## 11. Documentation-Driven Development

Write the documentation before the implementation. The README, API docs, and usage examples define the contract. Implementation follows the documented interface: (1) write README with quick start, (2) write API reference with types and examples, (3) write doc comment stubs, (4) implement until examples work, (5) run doctest/example tests to verify.

---

## Best Practices

1. **Comment the why, not the what** -- if code needs a "what" comment, refactor the code to be self-documenting instead.
2. **Use structured doc comments on all public APIs** -- JSDoc/TSDoc, Google-style docstrings, godoc conventions for every exported function.
3. **Include at least one `@example` per public function** -- executable examples serve as both documentation and regression tests.
4. **Delete commented-out code** -- version control preserves history; dead code in comments is noise that erodes trust in all comments.
5. **Lint documentation in CI** -- run markdownlint, vale, and alex on every PR to enforce consistency and inclusive language.
6. **Test documentation examples** -- use doctest (Python), example functions (Go), or compile-check JSDoc examples (TypeScript).
7. **Link to external specifications** -- cite RFC numbers, regulation articles, and internal wiki pages directly in code comments.
8. **Keep TODOs actionable** -- every TODO must have a ticket number and removal condition; stale TODOs are worse than no TODO.
9. **Write READMEs for every library** -- include installation, quick start, API reference, and contributing guide as a minimum.
10. **Auto-generate reference docs from source** -- use TypeDoc/Sphinx/pkgsite; never manually maintain API reference that can be generated.

---

## Anti-Patterns

| #  | Anti-Pattern                       | Problem                                                       | Fix                                                      |
|----|------------------------------------|---------------------------------------------------------------|----------------------------------------------------------|
| 1  | Restating the code                 | `// increment i` adds zero information and rots quickly       | Delete trivial comments; refactor unclear code instead    |
| 2  | Commented-out code blocks          | Dead code pollutes files and misleads readers                 | Delete it; git preserves history                          |
| 3  | TODOs without tickets              | `// TODO: fix this` never gets fixed                          | Require `TODO(TICKET-123)` format; lint for it in CI     |
| 4  | Undocumented public API            | Consumers guess parameter meaning and error behavior          | Require doc comments on all exports; fail CI on missing  |
| 5  | Copy-pasted documentation          | Same paragraph in 5 files; 4 become stale                    | Single source of truth; cross-reference with links       |
| 6  | Outdated @example blocks           | Example shows old API signature; users get compile errors     | Run doctest/example tests in CI to catch drift           |
| 7  | README with only "TODO"            | Library published with no usage instructions                  | Block release if README lacks installation + quick start |
| 8  | Inconsistent doc styles            | Mix of JSDoc, TSDoc, plain comments in same codebase          | Enforce one style per language with linting rules        |

---

## Enforcement Checklist

- [ ] All public functions/methods have structured doc comments (JSDoc/docstrings/godoc)
- [ ] Every doc comment includes `@param`, `@returns`, and `@throws` where applicable
- [ ] At least one `@example` exists per public API function
- [ ] No commented-out code blocks exist in the codebase
- [ ] All TODOs follow `TODO(TICKET-XXX)` format and are tracked
- [ ] markdownlint and vale pass on all documentation files in CI
- [ ] Documentation examples are tested (doctest/example functions/compile checks)
- [ ] Every library/package has a README with installation, quick start, and API reference
- [ ] Auto-generated documentation (TypeDoc/Sphinx/pkgsite) is built and deployed in CI
- [ ] Documentation review is part of the PR review checklist
