# Property-Based Testing

| Attribute      | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| Domain         | Testing > Advanced Testing                                         |
| Importance     | High                                                               |
| Last Updated   | 2026-03-10                                                         |
| Cross-ref      | `11-testing/unit-testing/`, `11-testing/testing-philosophy/`       |

---

## Core Concepts

### What Property-Based Testing Is

Property-based testing (PBT) inverts the traditional test-writing approach. Instead of specifying individual input-output pairs (example-based testing), you **define properties that must hold for all valid inputs**, and the framework generates hundreds or thousands of random inputs to verify them.

| Aspect | Example-Based | Property-Based |
| ------ | ------------- | -------------- |
| Input selection | Manual, developer-chosen | Automated, randomized |
| Coverage | Limited to imagination | Explores edge cases systematically |
| Test count | Tens per function | Hundreds to thousands per run |
| Failure output | "Test X failed" | "Minimal failing case: [shrunk input]" |
| Maintenance | Update examples when logic changes | Properties remain stable across refactors |

### Shrinking

When a property violation is found, the framework **automatically simplifies the failing input** to the smallest case that still triggers the failure. A failing input of `[839, -22, 0, 417, 3, -1]` might shrink to `[0, -1]`, making root cause analysis immediate.

### Properties Worth Testing

| Property Type | Description | Example |
| ------------- | ----------- | ------- |
| **Roundtrip** | encode then decode yields original | `decode(encode(x)) === x` |
| **Invariant** | output always satisfies a constraint | `sort(xs).length === xs.length` |
| **Idempotence** | applying twice equals applying once | `format(format(s)) === format(s)` |
| **Commutativity** | order of operations does not matter | `merge(a, b) === merge(b, a)` |
| **Equivalence** | two implementations agree | `fastSort(xs) === referenceSort(xs)` |
| **Inductive** | larger cases compose from smaller | `concat(sort(a), sort(b))` is a permutation of `sort(concat(a, b))` |
| **Hard to compute, easy to verify** | verify output without reimplementing | For `factorize(n)`, check `product(factors) === n` |

### When Property-Based Testing Shines

- **Parsers and serializers** -- roundtrip properties catch subtle encoding bugs.
- **Algorithms** -- sorting, searching, graph traversal have strong invariants.
- **Data transformations** -- ETL pipelines, API mappers, schema migrations.
- **State machines** -- stateful PBT generates action sequences that expose invalid state transitions.
- **Codec and compression** -- roundtrip and size properties.

---

## Code Examples

### TypeScript -- fast-check

```typescript
// property-tests.test.ts -- fast-check property-based tests
import fc from 'fast-check';

// --- Roundtrip: JSON encode/decode ---
describe('JSON roundtrip', () => {
  it('survives encode then decode for any serializable value', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const encoded = JSON.stringify(value);
        const decoded = JSON.parse(encoded);
        expect(decoded).toEqual(value);
      }),
      { numRuns: 1000 },
    );
  });
});

// --- Sorting invariants ---
describe('Array.sort', () => {
  it('preserves array length', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        expect(sorted.length).toBe(arr.length);
      }),
    );
  });

  it('produces a non-decreasing sequence', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i]).toBeGreaterThanOrEqual(sorted[i - 1]);
        }
      }),
    );
  });

  it('contains the same elements as the input', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        expect(sorted.sort()).toEqual([...arr].sort());
      }),
    );
  });
});

// --- Idempotence: string trimming ---
describe('String.trim idempotence', () => {
  it('trim(trim(s)) === trim(s)', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(s.trim().trim()).toBe(s.trim());
      }),
    );
  });
});

// --- Custom arbitrary: domain-specific generators ---
const userArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  email: fc.emailAddress(),
  age: fc.integer({ min: 18, max: 120 }),
  roles: fc.array(fc.constantFrom('admin', 'editor', 'viewer'), {
    minLength: 1,
    maxLength: 3,
  }),
});

describe('User serialization roundtrip', () => {
  it('survives serialize/deserialize', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        const serialized = serializeUser(user);
        const deserialized = deserializeUser(serialized);
        expect(deserialized).toEqual(user);
      }),
    );
  });
});

// Placeholder functions for the example
function serializeUser(user: unknown): string {
  return JSON.stringify(user);
}
function deserializeUser(data: string): unknown {
  return JSON.parse(data);
}
```

### Python -- Hypothesis

```python
# test_properties.py -- Hypothesis property-based tests
from hypothesis import given, assume, settings, HealthCheck
from hypothesis import strategies as st
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant
import json
from urllib.parse import quote, unquote

# --- Roundtrip: URL encoding ---
@given(st.text())
def test_url_encode_roundtrip(s):
    """URL encoding then decoding yields the original string."""
    encoded = quote(s, safe="")
    decoded = unquote(encoded)
    assert decoded == s

# --- Invariant: sorted output is always sorted ---
@given(st.lists(st.integers()))
def test_sorted_is_sorted(xs):
    result = sorted(xs)
    for i in range(1, len(result)):
        assert result[i] >= result[i - 1]

# --- Invariant: sorted preserves elements ---
@given(st.lists(st.integers()))
def test_sorted_preserves_elements(xs):
    result = sorted(xs)
    assert sorted(result) == sorted(xs)

# --- Custom strategy: domain objects ---
user_strategy = st.fixed_dictionaries({
    "id": st.uuids().map(str),
    "name": st.text(min_size=1, max_size=100),
    "email": st.emails(),
    "age": st.integers(min_value=18, max_value=120),
    "roles": st.lists(
        st.sampled_from(["admin", "editor", "viewer"]),
        min_size=1, max_size=3, unique=True,
    ),
})

@given(user_strategy)
def test_user_json_roundtrip(user):
    """User survives JSON serialization roundtrip."""
    encoded = json.dumps(user)
    decoded = json.loads(encoded)
    assert decoded == user

# --- Stateful testing: shopping cart state machine ---
class ShoppingCartMachine(RuleBasedStateMachine):
    """Verify shopping cart invariants across random action sequences."""

    def __init__(self):
        super().__init__()
        self.cart: dict[str, int] = {}   # model: product_id -> quantity

    @rule(product_id=st.text(min_size=1, max_size=10), qty=st.integers(min_value=1, max_value=20))
    def add_item(self, product_id, qty):
        self.cart[product_id] = self.cart.get(product_id, 0) + qty

    @rule(product_id=st.text(min_size=1, max_size=10))
    def remove_item(self, product_id):
        self.cart.pop(product_id, None)

    @invariant()
    def quantities_are_positive(self):
        for qty in self.cart.values():
            assert qty > 0

    @invariant()
    def total_items_non_negative(self):
        assert sum(self.cart.values()) >= 0

TestShoppingCart = ShoppingCartMachine.TestCase
```

### Go -- rapid

```go
// property_test.go -- Property-based tests using pgregory.net/rapid
package sorting_test

import (
	"sort"
	"testing"

	"pgregory.net/rapid"
)

func TestSortPreservesLength(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		xs := rapid.SliceOf(rapid.Int()).Draw(t, "xs")
		original := len(xs)
		sort.Ints(xs)
		if len(xs) != original {
			t.Fatalf("length changed: %d -> %d", original, len(xs))
		}
	})
}

func TestSortProducesNonDecreasing(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		xs := rapid.SliceOf(rapid.Int()).Draw(t, "xs")
		sort.Ints(xs)
		for i := 1; i < len(xs); i++ {
			if xs[i] < xs[i-1] {
				t.Fatalf("not sorted at index %d: %d < %d", i, xs[i], xs[i-1])
			}
		}
	})
}

// Roundtrip: encode/decode for a custom type
type User struct {
	Name  string
	Age   int
	Email string
}

func genUser() *rapid.Generator[User] {
	return rapid.Custom(func(t *rapid.T) User {
		return User{
			Name:  rapid.String().Draw(t, "name"),
			Age:   rapid.IntRange(18, 120).Draw(t, "age"),
			Email: rapid.StringMatching(`[a-z]+@[a-z]+\.[a-z]{2,4}`).Draw(t, "email"),
		}
	})
}

func TestUserRoundtrip(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		user := genUser().Draw(t, "user")
		data := encodeUser(user)    // your encode function
		decoded := decodeUser(data) // your decode function
		if user != decoded {
			t.Fatalf("roundtrip failed: %+v != %+v", user, decoded)
		}
	})
}

// Stubs -- replace with real implementations
func encodeUser(u User) []byte {
	return []byte(u.Name + "|" + u.Email)
}

func decodeUser(data []byte) User {
	// Placeholder -- implement real decoder
	return User{}
}
```

---

## Combining Property-Based and Example-Based Tests

These approaches are complementary, not competing:

| Use Example-Based For | Use Property-Based For |
| --------------------- | ---------------------- |
| Specific business rules with known expected outputs | General invariants that hold for all inputs |
| Regression tests for specific bug reports | Exploring edge cases you have not imagined |
| Documentation-style tests showing usage | Verifying algebraic properties of pure functions |
| UI snapshot tests | Serialization, parsing, data transformation |

**Guideline:** Write example-based tests first to establish understanding, then add property-based tests to increase coverage and catch edge cases.

---

## 10 Best Practices

1. **Start with roundtrip properties** -- they are the easiest to write and catch the most bugs in serialization code.
2. **Use domain-specific generators** -- custom arbitraries that produce valid business objects yield more meaningful tests than raw primitives.
3. **Name properties clearly** -- `"sorted output has same length as input"` is better than `"test_sort_1"`.
4. **Set sufficient run count** -- 100 runs is the default; increase to 1 000+ for critical code paths.
5. **Examine shrunk examples** -- the minimal failing case is the most valuable output of PBT; analyze it before fixing.
6. **Seed failing cases into example-based tests** -- when PBT finds a bug, add the shrunk case as a permanent regression test.
7. **Avoid reimplementing the function under test** -- properties should verify *characteristics* of the output, not recompute it.
8. **Use `assume()` sparingly** -- filtering too many inputs wastes generation effort; prefer constrained generators.
9. **Test with stateful PBT for state machines** -- Hypothesis and fast-check both support model-based stateful testing.
10. **Integrate into CI** -- run property tests on every PR with a fixed seed for reproducibility and random seed for exploration.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
| --- | --- | --- |
| Reimplementing the function under test as the property | Test always passes; verifies nothing | Test output characteristics (length, ordering, membership) instead |
| Using `assume()` to filter out most generated inputs | Test runs slowly; effective run count is much lower than configured | Build constraints into the generator itself |
| Ignoring shrunk output | Fixing the symptom without understanding the minimal case | Always analyze the shrunk example before writing a fix |
| Generating only trivial inputs (small integers, short strings) | Misses edge cases in large or complex inputs | Configure generators with realistic size ranges matching production data |
| Writing properties that are tautologically true | False confidence; 100% pass rate with zero value | Review each property: could a buggy implementation still pass? |
| Not seeding CI with a fixed seed | Flaky tests that fail non-reproducibly | Use `{ seed: 42 }` in CI for determinism; run with random seed in nightly builds |
| Replacing all example-based tests with PBT | Loses documentation value and specific regression coverage | Use both: examples for clarity, properties for breadth |
| Writing one property per module | Inadequate coverage; PBT's power comes from many complementary properties | Write 3-5 properties per function covering different aspects |

---

## Enforcement Checklist

- [ ] Every serializer/deserializer has a roundtrip property test
- [ ] Sorting and filtering functions have invariant properties (length, ordering, membership)
- [ ] Custom generators exist for domain objects (User, Order, Product) and are shared across tests
- [ ] Property tests run in CI on every pull request
- [ ] Shrunk failing cases are added as permanent example-based regression tests
- [ ] Run count is configured to at least 500 for critical paths
- [ ] Stateful property tests exist for components with complex state transitions
- [ ] Property test failures block merges (they are not treated as flaky)
- [ ] Nightly CI runs use random seeds with higher run counts (5 000+)
- [ ] Team has documented which properties to write for each category of function
