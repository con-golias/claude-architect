# Bloom Filters

> **Domain:** Fundamentals > Data Structures > Advanced
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

A Bloom filter is a space-efficient **probabilistic data structure** that tests whether an element is a member of a set. It can tell you:
- **"Definitely not in the set"** — 100% accurate (no false negatives).
- **"Probably in the set"** — may have false positives (says yes when the answer is actually no).

It uses multiple hash functions to map elements to positions in a bit array, achieving dramatically less memory than storing the actual elements.

## Why It Matters

- **Extreme space efficiency** — can represent millions of elements in just a few KB.
- **O(k) operations** — insert and query are O(k) where k is the number of hash functions (constant).
- **No false negatives** — if it says "not in set", that's guaranteed correct.
- **Used at massive scale** — Google Chrome, Cassandra, Bitcoin, CDNs, and spell checkers.

## How It Works

### Mechanism

```
Bit array of size m (initially all 0s):
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

Insert "hello" using k=3 hash functions:
h₁("hello") = 1, h₂("hello") = 4, h₃("hello") = 7
[0, 1, 0, 0, 1, 0, 0, 1, 0, 0]

Insert "world":
h₁("world") = 3, h₂("world") = 4, h₃("world") = 9
[0, 1, 0, 1, 1, 0, 0, 1, 0, 1]
              ↑  ↑ shared bit

Query "hello": positions 1,4,7 all set → "probably yes" ✓
Query "test":  h₁=2, h₂=5, h₃=7 → position 2 is 0 → "definitely no" ✓
Query "foo":   h₁=1, h₂=3, h₃=9 → all set → "probably yes" ✗ (FALSE POSITIVE!)
```

### Implementation

```python
import hashlib

class BloomFilter:
    def __init__(self, size: int, num_hashes: int):
        self.size = size
        self.num_hashes = num_hashes
        self.bit_array = [False] * size

    def _hashes(self, item: str) -> list[int]:
        """Generate k hash values using double hashing."""
        h1 = int(hashlib.md5(item.encode()).hexdigest(), 16)
        h2 = int(hashlib.sha1(item.encode()).hexdigest(), 16)
        return [(h1 + i * h2) % self.size for i in range(self.num_hashes)]

    def add(self, item: str) -> None:
        """O(k) — add item to the filter."""
        for pos in self._hashes(item):
            self.bit_array[pos] = True

    def might_contain(self, item: str) -> bool:
        """O(k) — check membership. False = definitely not present."""
        return all(self.bit_array[pos] for pos in self._hashes(item))

# Usage
bf = BloomFilter(size=1000, num_hashes=7)
bf.add("hello")
bf.add("world")
bf.might_contain("hello")  # True (correct)
bf.might_contain("test")   # False (definitely not present)
bf.might_contain("foo")    # True or False (might be false positive)
```

### False Positive Rate

```
Given:
  m = bit array size
  n = number of inserted elements
  k = number of hash functions

False positive probability ≈ (1 - e^(-kn/m))^k

Optimal k (minimizes false positives):
  k = (m/n) × ln(2) ≈ 0.693 × (m/n)

Example:
  1 million elements, 1% false positive rate:
  m ≈ 9.6 million bits ≈ 1.2 MB
  k ≈ 7 hash functions

  Compare: storing 1M strings ≈ 50+ MB
```

### Operations and Time Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| Insert | O(k) | k = number of hash functions |
| Query | O(k) | Returns "maybe" or "definitely not" |
| Delete | Not supported | Cannot unset bits (may affect other elements) |

### Counting Bloom Filter (Supports Delete)

Replace each bit with a counter — increment on insert, decrement on delete:

```python
class CountingBloomFilter:
    def __init__(self, size: int, num_hashes: int):
        self.size = size
        self.num_hashes = num_hashes
        self.counters = [0] * size

    def add(self, item: str):
        for pos in self._hashes(item):
            self.counters[pos] += 1

    def remove(self, item: str):
        if self.might_contain(item):
            for pos in self._hashes(item):
                self.counters[pos] -= 1

    def might_contain(self, item: str) -> bool:
        return all(self.counters[pos] > 0 for pos in self._hashes(item))
```

## Best Practices

1. **Size the filter correctly** — use the formula to calculate optimal m and k for your desired false positive rate.
2. **Use as a pre-filter** — check the Bloom filter first, then do the expensive lookup only for "maybe" results.
3. **Never rely on "yes" answers** — always confirm with the actual data source.
4. **Use counting Bloom filters** if you need deletion support.
5. **Choose good hash functions** — independent, uniform hash functions minimize false positives.

## Anti-patterns / Common Mistakes

- **Assuming "yes" is definitive** — Bloom filters have false positives.
- **Undersizing the filter** — too small → high false positive rate, defeating the purpose.
- **Trying to delete from a standard Bloom filter** — unsetting bits may break other entries.
- **Using when exact membership is needed** — Bloom filters are approximate; use hash sets for exact results.

## Real-world Examples

- **Google Chrome Safe Browsing** — checks URLs against a Bloom filter of malicious sites before doing a full server lookup.
- **Apache Cassandra** — uses Bloom filters to avoid unnecessary disk reads for non-existent keys.
- **Bitcoin** — SPV clients use Bloom filters to request only relevant transactions.
- **Medium** — uses Bloom filters to avoid recommending articles a user has already read.
- **Spell checkers** — quick dictionary membership check before suggesting corrections.

## Sources

- Bloom, B.H. (1970). "Space/Time Trade-offs in Hash Coding with Allowable Errors."
- [Wikipedia — Bloom Filter](https://en.wikipedia.org/wiki/Bloom_filter)
- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
