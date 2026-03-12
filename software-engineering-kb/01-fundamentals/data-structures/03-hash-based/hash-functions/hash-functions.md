# Hash Functions

> **Domain:** Fundamentals > Data Structures > Hash-Based
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A hash function maps data of arbitrary size to a fixed-size value (the hash code or digest). In the context of data structures, hash functions convert keys into array indices for hash tables. A good hash function distributes keys uniformly across buckets, minimizing collisions.

## Why It Matters

- **Determines hash table performance** — a bad hash function turns O(1) lookups into O(n).
- **Uniform distribution** reduces collisions and keeps load balanced.
- **Deterministic** — same input always produces same output (required for correctness).
- **Used beyond data structures** — checksums, digital signatures, content addressing, bloom filters.

## How It Works

### Properties of a Good Hash Function

1. **Deterministic** — same key always produces the same hash.
2. **Uniform distribution** — keys spread evenly across the range.
3. **Fast to compute** — hashing should be O(k) where k is the key length.
4. **Avalanche effect** — small changes in input produce drastically different hashes.

### Common Hash Functions

**Division Method:**
```
h(k) = k mod m

Best when m is a prime not close to a power of 2.
Example: h(123456) = 123456 mod 997 = 812
```

**Multiplication Method:**
```
h(k) = floor(m × (k × A mod 1))

Where A ≈ 0.6180339887 (golden ratio conjugate)
Works well with any m, including powers of 2.
```

**String Hashing (Polynomial Rolling Hash):**
```python
def polynomial_hash(s: str, base: int = 31, mod: int = 10**9 + 9) -> int:
    """Hash a string using polynomial rolling hash."""
    h = 0
    power = 1
    for char in s:
        h = (h + ord(char) * power) % mod
        power = (power * base) % mod
    return h
```

**FNV-1a (Fowler-Noll-Vo):**
```python
def fnv1a_32(data: bytes) -> int:
    """FNV-1a hash — fast, good distribution, simple."""
    h = 0x811c9dc5  # FNV offset basis
    for byte in data:
        h ^= byte
        h = (h * 0x01000193) & 0xFFFFFFFF  # FNV prime
    return h
```

### Hash Functions in Standard Libraries

| Language | Hash Method | Notes |
|----------|------------|-------|
| Java | `Object.hashCode()` | Returns int; must override with `equals()` |
| Python | `hash()` | Built-in; uses SipHash for strings (DoS protection) |
| C++ | `std::hash<T>` | Specializations for built-in types |
| Go | Internal (unexported) | Used by `map`; runtime-selected |

### Java hashCode Examples

```java
// Java's String.hashCode()
// s[0]*31^(n-1) + s[1]*31^(n-2) + ... + s[n-1]
"hello".hashCode();  // 99162322

// Custom class — must override both hashCode and equals
public class Point {
    int x, y;

    @Override
    public int hashCode() {
        return Objects.hash(x, y);  // combines multiple fields
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Point p)) return false;
        return x == p.x && y == p.y;
    }
}
```

### Cryptographic vs Non-Cryptographic

| Property | Non-Cryptographic | Cryptographic |
|----------|------------------|---------------|
| Speed | Very fast | Slower |
| Purpose | Hash tables, checksums | Security, signatures |
| Collision resistance | Low (acceptable) | Very high (required) |
| Examples | FNV, MurmurHash, xxHash | SHA-256, SHA-3, BLAKE3 |
| Pre-image resistance | Not required | Required |

## Best Practices

1. **Use built-in hash functions** — language-provided hashing is well-tested and optimized.
2. **Never use identity hash for strings** — memory address hashing fails for equal string values.
3. **Use all significant fields** in custom `hashCode()` — omitting fields increases collisions.
4. **Use a prime multiplier** (31, 37) for combining field hashes — reduces patterns.
5. **For security-sensitive contexts**, use SipHash or keyed hash functions to prevent HashDoS attacks.

## Anti-patterns / Common Mistakes

- **Overriding `equals` without `hashCode`** (Java) — violates the contract; equal objects in different buckets.
- **Using mutable fields in hash computation** — object becomes unfindable if fields change.
- **Modding by a power of 2 with a bad hash** — only the low bits matter, increasing collisions.
- **Using MD5/SHA for hash tables** — cryptographic hashes are too slow for data structures.
- **Ignoring HashDoS** — adversaries can craft inputs that collide, turning O(1) into O(n).

## Real-world Examples

- **Python's SipHash** — protects against HashDoS by using a per-process random seed.
- **Java's treeification** — Java 8+ `HashMap` converts long chains (8+) to red-black trees for O(log n) worst case.
- **Consistent hashing** — distributed caches (Memcached) use hash rings for server assignment.
- **Content-addressable storage** — Git uses SHA-1 (migrating to SHA-256) to hash file contents.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [Wikipedia — Hash Function](https://en.wikipedia.org/wiki/Hash_function)
- [GeeksforGeeks — Collision Resolution Techniques](https://www.geeksforgeeks.org/collision-resolution-techniques/)
