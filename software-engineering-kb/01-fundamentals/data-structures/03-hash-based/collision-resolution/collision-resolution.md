# Collision Resolution

> **Domain:** Fundamentals > Data Structures > Hash-Based
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A collision occurs when two different keys hash to the same bucket index. Since the number of possible keys far exceeds the number of buckets, collisions are inevitable (pigeonhole principle). Collision resolution strategies determine how the hash table handles these conflicts while maintaining O(1) average-case performance.

## Why It Matters

- **Directly affects performance** — poor resolution degrades hash tables from O(1) to O(n).
- **Memory vs speed tradeoff** — different strategies optimize for different constraints.
- **Security implications** — collision attacks (HashDoS) can be exploited if resolution is predictable.

## How It Works

### Strategy 1: Separate Chaining

Each bucket stores a linked list (or tree) of all entries that hash to that index.

```
Bucket 0: → ["apple", 5]
Bucket 1: → null
Bucket 2: → ["banana", 3] → ["cherry", 7] → ["date", 2]
Bucket 3: → null
Bucket 4: → ["elderberry", 1]
Bucket 5: → null
Bucket 6: → null
Bucket 7: → ["fig", 4]
```

```java
// Separate chaining implementation
class HashTableChaining<K, V> {
    private LinkedList<Entry<K, V>>[] buckets;
    private int size;

    void put(K key, V value) {
        int index = hash(key) % buckets.length;
        LinkedList<Entry<K, V>> chain = buckets[index];
        if (chain == null) {
            chain = new LinkedList<>();
            buckets[index] = chain;
        }
        // Check if key exists
        for (Entry<K, V> entry : chain) {
            if (entry.key.equals(key)) {
                entry.value = value;  // update
                return;
            }
        }
        chain.add(new Entry<>(key, value));  // insert
        size++;
    }
}
```

**Pros:** Simple, never truly "full", deletion is easy.
**Cons:** Extra memory for pointers, poor cache locality (pointer chasing).

### Strategy 2: Open Addressing

All entries are stored directly in the bucket array. On collision, probe for the next available slot.

#### Linear Probing

```
h(k, i) = (h(k) + i) mod m     where i = 0, 1, 2, ...

Insert "cherry" → hash = 2 (occupied) → try 3 (occupied) → try 4 (empty) → insert at 4

Index:  0     1     2        3       4        5
      ┌─────┬─────┬────────┬───────┬────────┬─────┐
      │     │     │"apple" │"banana"│"cherry"│     │
      └─────┴─────┴────────┴───────┴────────┴─────┘
                    ↑ hash=2  hash=2  hash=2
                              probed→ probed→ placed
```

**Primary clustering:** Occupied slots tend to form long clusters, increasing probe lengths.

#### Quadratic Probing

```
h(k, i) = (h(k) + c₁·i + c₂·i²) mod m

Probes: +1, +3, +6, +10, +15, ...
Reduces primary clustering but can cause secondary clustering.
```

#### Double Hashing

```
h(k, i) = (h₁(k) + i · h₂(k)) mod m

Uses a second hash function to determine probe step size.
Best distribution but more expensive per probe.
```

```python
class HashTableOpenAddressing:
    def __init__(self, capacity=16):
        self.capacity = capacity
        self.keys = [None] * capacity
        self.values = [None] * capacity
        self.size = 0

    def _probe(self, key):
        """Linear probing."""
        index = hash(key) % self.capacity
        while self.keys[index] is not None:
            if self.keys[index] == key:
                return index  # found existing key
            index = (index + 1) % self.capacity
        return index  # found empty slot

    def put(self, key, value):
        if self.size / self.capacity > 0.7:
            self._resize()
        index = self._probe(key)
        if self.keys[index] is None:
            self.size += 1
        self.keys[index] = key
        self.values[index] = value

    def get(self, key):
        index = self._probe(key)
        if self.keys[index] == key:
            return self.values[index]
        return None
```

### Strategy 3: Robin Hood Hashing

A variation of linear probing where elements with longer probe distances "steal" slots from elements with shorter distances. This reduces variance in probe lengths.

```
Insert with Robin Hood:
- New element probes like linear probing
- If current slot's occupant has a shorter probe distance,
  swap them and continue inserting the displaced element
- Result: more uniform probe distances
```

### Strategy 4: Cuckoo Hashing

Uses two hash functions and two tables. Each key has exactly two possible positions. On collision, the existing element is "kicked out" and re-inserted at its alternative position.

```
Table A:    h₁("apple") = 2    Table B:    h₂("apple") = 5
            h₁("banana") = 2               h₂("banana") = 1

Insert "banana": h₁ = 2 (occupied by "apple")
→ kick "apple" to Table B position h₂ = 5
→ place "banana" at Table A position 2

Lookup: always O(1) worst case — check exactly 2 positions
```

### Comparison

| Strategy | Avg Lookup | Worst Lookup | Cache | Memory | Deletion |
|----------|-----------|-------------|-------|--------|----------|
| Chaining | O(1 + α) | O(n) | Poor | Extra pointers | Easy |
| Linear probing | O(1) | O(n) | Excellent | No extra | Complex (tombstones) |
| Quadratic probing | O(1) | O(n) | Good | No extra | Complex |
| Double hashing | O(1) | O(n) | Good | No extra | Complex |
| Robin Hood | O(1) | O(log n) expected | Excellent | No extra | Complex |
| Cuckoo | O(1) | O(1) | Fair | 2× table | Easy |

## Best Practices

1. **Use chaining for simplicity** — it's the default in most hash table implementations.
2. **Use open addressing for cache performance** — linear probing with good hash functions is very fast.
3. **Keep load factor below 0.75** for open addressing — performance degrades rapidly above this.
4. **Use tombstone markers** for deletion in open addressing — don't just empty the slot.
5. **Resize at the right threshold** — Java's HashMap resizes at α = 0.75.

## Anti-patterns / Common Mistakes

- **Deleting in open addressing without tombstones** — breaks the probe chain; subsequent lookups fail.
- **High load factor with open addressing** — exponential increase in probe length above α = 0.8.
- **Not resizing** — unbounded load factor degrades all operations to O(n).
- **Using modulo with clustering-prone hash** — amplifies primary clustering in linear probing.

## Real-world Examples

- **Java HashMap** — separate chaining (lists for < 8 collisions, red-black trees for >= 8).
- **Python dict** — open addressing with a custom probing scheme.
- **Google's Swiss Table (Abseil)** — SIMD-accelerated open addressing with metadata bytes.
- **Rust's HashMap** — uses Robin Hood hashing (hashbrown crate).
- **D language** — uses open addressing with Robin Hood hashing.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [GeeksforGeeks — Collision Resolution Techniques](https://www.geeksforgeeks.org/collision-resolution-techniques/)
- [Wikipedia — Hash Table](https://en.wikipedia.org/wiki/Hash_table)
- [Wikipedia — Open Addressing](https://en.wikipedia.org/wiki/Open_addressing)
