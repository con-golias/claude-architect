# Hashing Algorithms

> **Domain:** Fundamentals > Algorithms > Hashing
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03-07

---

## What It Is

Hashing maps data of arbitrary size to fixed-size values called **hash codes** (or digests).
A hash function `h: U -> {0, 1, ..., m-1}` maps keys from a universe `U` to indices in a
table of size `m`. Hash tables use hashing to achieve **O(1) average-case** lookup, insert,
and delete -- making them one of the most practically important data structures in computing.

Every major programming language provides a hash table as a built-in:
- **Python:** `dict`, `set`
- **JavaScript/TypeScript:** `Object`, `Map`, `Set`
- **Java:** `HashMap`, `HashSet`
- **C++:** `std::unordered_map`, `std::unordered_set`
- **Go:** `map`
- **Rust:** `HashMap`, `HashSet`

---

## Hash Function Properties

A good hash function must satisfy:

### 1. Deterministic
Same input must always produce the same output.

### 2. Uniform Distribution
Keys should be spread as evenly as possible across buckets to minimize collisions. For `m`
buckets, each bucket should receive approximately `n/m` keys.

### 3. Fast Computation
Hash computation should be O(1) for fixed-size keys (or O(k) for variable-length keys of
length k).

### 4. Avalanche Effect
A small change in input should cause a large, unpredictable change in the output. Flipping
one bit in the input should flip approximately half the bits in the output.

```
Example (illustrative):
  hash("hello")  = 0x2CF24DBA  = 0010 1100 1111 ...
  hash("hellp")  = 0xE9B1C5A3  = 1110 1001 1011 ...
                                  ^^^^  different bits everywhere
```

---

## Common Hash Functions

### Division Method

```
h(k) = k mod m
```

Simple but the choice of `m` matters:
- **Avoid** powers of 2 (only uses low-order bits)
- **Avoid** powers of 10 (if keys are decimal)
- **Use** a prime not close to a power of 2

```python
def hash_division(key: int, m: int) -> int:
    """Division method. Choose m as prime."""
    return key % m

# Good:  m = 701 (prime)
# Bad:   m = 1024 (power of 2, only uses last 10 bits)
```

### Multiplication Method

```
h(k) = floor(m * (k * A mod 1))
```

Where `A` is a constant, `0 < A < 1`. Knuth suggests `A = (sqrt(5) - 1) / 2 = 0.6180339...`
(the golden ratio conjugate).

```python
import math

def hash_multiplication(key: int, m: int) -> int:
    """Multiplication method. Works well with any m."""
    A = (math.sqrt(5) - 1) / 2  # Golden ratio conjugate
    return int(m * ((key * A) % 1))
```

**Advantage:** Works well regardless of `m`. Does not require `m` to be prime.

### Universal Hashing

A family of hash functions where the function is chosen randomly at initialization. This
provides probabilistic guarantees against adversarial inputs.

```
h_{a,b}(k) = ((a * k + b) mod p) mod m
```

Where `p` is a prime larger than the key universe, `a` is random in `[1, p-1]`, `b` is random
in `[0, p-1]`.

```python
import random

class UniversalHash:
    """Universal hashing family. Probabilistic collision guarantee."""

    def __init__(self, m: int, p: int = 2_147_483_647):
        self.m = m
        self.p = p  # Large prime (2^31 - 1)
        self.a = random.randint(1, p - 1)
        self.b = random.randint(0, p - 1)

    def hash(self, key: int) -> int:
        return ((self.a * key + self.b) % self.p) % self.m
```

**Guarantee:** For any two distinct keys `k1 != k2`, `Pr[h(k1) == h(k2)] <= 1/m`.

### Polynomial Rolling Hash (for Strings)

```
h(s) = s[0]*p^(n-1) + s[1]*p^(n-2) + ... + s[n-1]  (mod m)
```

Where `p` is a prime base (commonly 31 or 37 for lowercase letters) and `m` is a large prime
modulus.

#### Implementation (Python)

```python
def polynomial_hash(s: str, p: int = 31, m: int = 10**9 + 9) -> int:
    """Polynomial rolling hash for strings."""
    hash_val = 0
    p_pow = 1
    for char in reversed(s):
        hash_val = (hash_val + (ord(char) - ord('a') + 1) * p_pow) % m
        p_pow = (p_pow * p) % m
    return hash_val


# Example
print(polynomial_hash("hello"))    # Some large number
print(polynomial_hash("world"))    # Different large number
```

#### Implementation (TypeScript)

```typescript
function polynomialHash(s: string, p: number = 31, m: number = 1e9 + 9): number {
    let hashVal = 0;
    let pPow = 1;

    for (let i = s.length - 1; i >= 0; i--) {
        const charVal = s.charCodeAt(i) - 'a'.charCodeAt(0) + 1;
        hashVal = (hashVal + charVal * pPow) % m;
        pPow = (pPow * p) % m;
    }
    return hashVal;
}

console.log(polynomialHash("hello"));
console.log(polynomialHash("world"));
```

**Rolling property:** To compute hash of `s[i+1..i+m]` from hash of `s[i..i+m-1]`:

```
hash_new = (hash_old - s[i] * p^(m-1)) * p + s[i+m]   (mod M)
```

This is the core of the Rabin-Karp string matching algorithm.

---

## Collision Resolution

When two keys hash to the same bucket (`h(k1) == h(k2)` but `k1 != k2`), we have a
**collision**. There are two main strategies for handling collisions.

### Separate Chaining

Each bucket contains a linked list (or other collection) of all key-value pairs that hash
to that bucket.

```
Bucket 0: -> (key=14, val="Alice") -> (key=7, val="Bob") -> null
Bucket 1: -> null
Bucket 2: -> (key=9, val="Charlie") -> null
Bucket 3: -> (key=3, val="Dave") -> (key=10, val="Eve") -> null
Bucket 4: -> null
...
```

#### Implementation (Python)

```python
class ChainingHashTable:
    """Hash table with separate chaining."""

    def __init__(self, capacity: int = 16, load_factor_threshold: float = 0.75):
        self.capacity = capacity
        self.load_factor_threshold = load_factor_threshold
        self.size = 0
        self.buckets: list[list[tuple]] = [[] for _ in range(capacity)]

    def _hash(self, key) -> int:
        return hash(key) % self.capacity

    def put(self, key, value) -> None:
        """Insert or update key-value pair. Amortized O(1)."""
        if self.size / self.capacity >= self.load_factor_threshold:
            self._resize()

        idx = self._hash(key)
        bucket = self.buckets[idx]

        # Update if key exists
        for i, (k, v) in enumerate(bucket):
            if k == key:
                bucket[i] = (key, value)
                return

        # Insert new entry
        bucket.append((key, value))
        self.size += 1

    def get(self, key, default=None):
        """Retrieve value by key. Average O(1), worst O(n)."""
        idx = self._hash(key)
        for k, v in self.buckets[idx]:
            if k == key:
                return v
        return default

    def remove(self, key) -> bool:
        """Remove key-value pair. Returns True if found."""
        idx = self._hash(key)
        bucket = self.buckets[idx]
        for i, (k, v) in enumerate(bucket):
            if k == key:
                bucket.pop(i)
                self.size -= 1
                return True
        return False

    def _resize(self) -> None:
        """Double capacity and rehash all entries. O(n)."""
        old_buckets = self.buckets
        self.capacity *= 2
        self.buckets = [[] for _ in range(self.capacity)]
        self.size = 0

        for bucket in old_buckets:
            for key, value in bucket:
                self.put(key, value)

    def __repr__(self) -> str:
        items = []
        for bucket in self.buckets:
            for k, v in bucket:
                items.append(f"{k}: {v}")
        return "{" + ", ".join(items) + "}"


# Usage
ht = ChainingHashTable()
ht.put("name", "Alice")
ht.put("age", 30)
ht.put("city", "NYC")
print(ht.get("name"))    # "Alice"
ht.put("name", "Bob")    # Update
print(ht.get("name"))    # "Bob"
ht.remove("age")
print(ht.get("age"))     # None
```

#### Implementation (TypeScript)

```typescript
class ChainingHashTable<K, V> {
    private buckets: [K, V][][];
    private capacity: number;
    private size: number;
    private loadFactorThreshold: number;

    constructor(capacity: number = 16, loadFactor: number = 0.75) {
        this.capacity = capacity;
        this.loadFactorThreshold = loadFactor;
        this.size = 0;
        this.buckets = Array.from({ length: capacity }, () => []);
    }

    private hash(key: K): number {
        const str = String(key);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return Math.abs(hash) % this.capacity;
    }

    put(key: K, value: V): void {
        if (this.size / this.capacity >= this.loadFactorThreshold) {
            this.resize();
        }

        const idx = this.hash(key);
        const bucket = this.buckets[idx];

        for (let i = 0; i < bucket.length; i++) {
            if (bucket[i][0] === key) {
                bucket[i] = [key, value];
                return;
            }
        }

        bucket.push([key, value]);
        this.size++;
    }

    get(key: K): V | undefined {
        const idx = this.hash(key);
        for (const [k, v] of this.buckets[idx]) {
            if (k === key) return v;
        }
        return undefined;
    }

    remove(key: K): boolean {
        const idx = this.hash(key);
        const bucket = this.buckets[idx];
        for (let i = 0; i < bucket.length; i++) {
            if (bucket[i][0] === key) {
                bucket.splice(i, 1);
                this.size--;
                return true;
            }
        }
        return false;
    }

    private resize(): void {
        const oldBuckets = this.buckets;
        this.capacity *= 2;
        this.buckets = Array.from({ length: this.capacity }, () => []);
        this.size = 0;
        for (const bucket of oldBuckets) {
            for (const [key, value] of bucket) {
                this.put(key, value);
            }
        }
    }
}

// Usage
const ht = new ChainingHashTable<string, any>();
ht.put("name", "Alice");
ht.put("age", 30);
console.log(ht.get("name")); // "Alice"
```

**Load factor:** `alpha = n / m` (number of elements / number of buckets).
Average chain length = `alpha`. Average search = `O(1 + alpha)`.

**Java 8+ optimization:** When a bucket exceeds 8 entries, the linked list is converted to
a **red-black tree**, giving O(log n) worst-case per bucket instead of O(n).

---

### Open Addressing

All elements are stored directly in the table array. On collision, **probe** for the next
available slot.

#### Three Probing Strategies

```
1. Linear Probing:
   h(k, i) = (h(k) + i) mod m        for i = 0, 1, 2, ...

   Problem: PRIMARY CLUSTERING -- long runs of occupied slots form,
   degrading performance. Consecutive probes cluster together.

   Visual:
   [X][X][X][X][X][ ][ ][ ][ ]   <- cluster forces long probes
    ^                ^
    collision here    first free slot


2. Quadratic Probing:
   h(k, i) = (h(k) + c1*i + c2*i^2) mod m

   Reduces primary clustering but introduces SECONDARY CLUSTERING
   (keys hashing to the same initial slot follow the same probe sequence).


3. Double Hashing:
   h(k, i) = (h1(k) + i * h2(k)) mod m

   Best distribution. h2(k) must never be 0.
   Common choice: h2(k) = prime - (k mod prime)
```

#### Linear Probing Implementation (Python)

```python
class LinearProbingHashTable:
    """Hash table with open addressing (linear probing)."""

    EMPTY = None
    DELETED = object()  # Tombstone marker

    def __init__(self, capacity: int = 16):
        self.capacity = capacity
        self.size = 0
        self.keys = [self.EMPTY] * capacity
        self.values = [self.EMPTY] * capacity

    def _hash(self, key) -> int:
        return hash(key) % self.capacity

    def put(self, key, value) -> None:
        """Insert or update. Resize at 70% load factor."""
        if self.size >= self.capacity * 0.7:
            self._resize()

        idx = self._hash(key)
        while True:
            if self.keys[idx] is self.EMPTY or self.keys[idx] is self.DELETED:
                self.keys[idx] = key
                self.values[idx] = value
                self.size += 1
                return
            elif self.keys[idx] == key:
                self.values[idx] = value  # Update existing
                return
            idx = (idx + 1) % self.capacity  # Linear probe

    def get(self, key, default=None):
        """Retrieve value by key. Average O(1)."""
        idx = self._hash(key)
        steps = 0
        while steps < self.capacity:
            if self.keys[idx] is self.EMPTY:
                return default  # Key not found (hit empty slot)
            if self.keys[idx] != self.DELETED and self.keys[idx] == key:
                return self.values[idx]
            idx = (idx + 1) % self.capacity
            steps += 1
        return default

    def remove(self, key) -> bool:
        """Remove key. Uses tombstone (DELETED marker)."""
        idx = self._hash(key)
        steps = 0
        while steps < self.capacity:
            if self.keys[idx] is self.EMPTY:
                return False
            if self.keys[idx] != self.DELETED and self.keys[idx] == key:
                self.keys[idx] = self.DELETED
                self.values[idx] = self.EMPTY
                self.size -= 1
                return True
            idx = (idx + 1) % self.capacity
            steps += 1
        return False

    def _resize(self) -> None:
        """Double capacity and rehash."""
        old_keys, old_values = self.keys, self.values
        self.capacity *= 2
        self.keys = [self.EMPTY] * self.capacity
        self.values = [self.EMPTY] * self.capacity
        self.size = 0

        for i in range(len(old_keys)):
            if old_keys[i] is not self.EMPTY and old_keys[i] is not self.DELETED:
                self.put(old_keys[i], old_values[i])


# Usage
ht = LinearProbingHashTable()
ht.put("hello", 1)
ht.put("world", 2)
ht.put("foo", 3)
print(ht.get("hello"))  # 1
ht.remove("hello")
print(ht.get("hello"))  # None
print(ht.get("world"))  # 2 (still accessible despite deletion)
```

#### Linear Probing Implementation (TypeScript)

```typescript
class LinearProbingHashTable<K, V> {
    private keys: (K | null | symbol)[];
    private values: (V | null)[];
    private capacity: number;
    private size: number;
    private static DELETED = Symbol("DELETED");

    constructor(capacity: number = 16) {
        this.capacity = capacity;
        this.size = 0;
        this.keys = new Array(capacity).fill(null);
        this.values = new Array(capacity).fill(null);
    }

    private hash(key: K): number {
        const str = String(key);
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = ((h << 5) - h + str.charCodeAt(i)) | 0;
        }
        return Math.abs(h) % this.capacity;
    }

    put(key: K, value: V): void {
        if (this.size >= this.capacity * 0.7) this.resize();

        let idx = this.hash(key);
        while (true) {
            if (this.keys[idx] === null || this.keys[idx] === LinearProbingHashTable.DELETED) {
                this.keys[idx] = key;
                this.values[idx] = value;
                this.size++;
                return;
            }
            if (this.keys[idx] === key) {
                this.values[idx] = value;
                return;
            }
            idx = (idx + 1) % this.capacity;
        }
    }

    get(key: K): V | undefined {
        let idx = this.hash(key);
        let steps = 0;
        while (steps < this.capacity) {
            if (this.keys[idx] === null) return undefined;
            if (this.keys[idx] === key) return this.values[idx] as V;
            idx = (idx + 1) % this.capacity;
            steps++;
        }
        return undefined;
    }

    remove(key: K): boolean {
        let idx = this.hash(key);
        let steps = 0;
        while (steps < this.capacity) {
            if (this.keys[idx] === null) return false;
            if (this.keys[idx] === key) {
                this.keys[idx] = LinearProbingHashTable.DELETED;
                this.values[idx] = null;
                this.size--;
                return true;
            }
            idx = (idx + 1) % this.capacity;
            steps++;
        }
        return false;
    }

    private resize(): void {
        const oldKeys = this.keys;
        const oldValues = this.values;
        this.capacity *= 2;
        this.keys = new Array(this.capacity).fill(null);
        this.values = new Array(this.capacity).fill(null);
        this.size = 0;
        for (let i = 0; i < oldKeys.length; i++) {
            if (oldKeys[i] !== null && oldKeys[i] !== LinearProbingHashTable.DELETED) {
                this.put(oldKeys[i] as K, oldValues[i] as V);
            }
        }
    }
}

const ht2 = new LinearProbingHashTable<string, number>();
ht2.put("hello", 1);
ht2.put("world", 2);
console.log(ht2.get("hello")); // 1
```

---

### Cuckoo Hashing

Cuckoo hashing uses **two hash functions** and **two tables**. Each key has exactly two
possible locations: `h1(k)` in table 1 and `h2(k)` in table 2.

**Insert:** Try `h1(k)` in table 1. If occupied, evict the existing key and re-insert it at
its alternate location. This may cascade (like a cuckoo bird evicting eggs from a nest).

**Lookup:** Check exactly two positions. **O(1) worst-case!**

```
Table 1:  [_] [A] [_] [C] [_]
Table 2:  [_] [_] [B] [_] [D]

Insert E -> h1(E) = 1 (occupied by A)
  Kick A out -> reinsert A at h2(A) = 2 in Table 2
  h2(A) = 2 in Table 2 (occupied by B)
  Kick B out -> reinsert B at h1(B) = 3 in Table 1
  h1(B) = 3 in Table 1 (occupied by C)
  ... continue until a free slot is found or cycle detected (rehash)
```

#### Implementation (Python)

```python
class CuckooHashTable:
    """Cuckoo hashing with O(1) worst-case lookup."""

    MAX_KICKS = 500  # Max evictions before rehash

    def __init__(self, capacity: int = 16):
        self.capacity = capacity
        self.size = 0
        self.table1 = [None] * capacity
        self.table2 = [None] * capacity

    def _h1(self, key) -> int:
        return hash(key) % self.capacity

    def _h2(self, key) -> int:
        return hash(key * 2654435761) % self.capacity  # Different hash

    def get(self, key):
        """O(1) worst-case lookup -- check exactly 2 positions."""
        idx1 = self._h1(key)
        if self.table1[idx1] is not None and self.table1[idx1][0] == key:
            return self.table1[idx1][1]

        idx2 = self._h2(key)
        if self.table2[idx2] is not None and self.table2[idx2][0] == key:
            return self.table2[idx2][1]

        return None

    def put(self, key, value) -> None:
        """Insert with cuckoo eviction. Amortized O(1)."""
        # Check if key already exists
        idx1 = self._h1(key)
        if self.table1[idx1] is not None and self.table1[idx1][0] == key:
            self.table1[idx1] = (key, value)
            return

        idx2 = self._h2(key)
        if self.table2[idx2] is not None and self.table2[idx2][0] == key:
            self.table2[idx2] = (key, value)
            return

        # Insert with eviction
        entry = (key, value)
        for _ in range(self.MAX_KICKS):
            idx1 = self._h1(entry[0])
            if self.table1[idx1] is None:
                self.table1[idx1] = entry
                self.size += 1
                return

            # Evict from table 1
            entry, self.table1[idx1] = self.table1[idx1], entry

            idx2 = self._h2(entry[0])
            if self.table2[idx2] is None:
                self.table2[idx2] = entry
                self.size += 1
                return

            # Evict from table 2
            entry, self.table2[idx2] = self.table2[idx2], entry

        # Too many evictions -- rehash
        self._rehash()
        self.put(entry[0], entry[1])

    def _rehash(self) -> None:
        """Double capacity and reinsert all entries."""
        old_t1, old_t2 = self.table1, self.table2
        self.capacity *= 2
        self.table1 = [None] * self.capacity
        self.table2 = [None] * self.capacity
        self.size = 0

        for entry in old_t1 + old_t2:
            if entry is not None:
                self.put(entry[0], entry[1])

    def remove(self, key) -> bool:
        """Remove a key. O(1)."""
        idx1 = self._h1(key)
        if self.table1[idx1] is not None and self.table1[idx1][0] == key:
            self.table1[idx1] = None
            self.size -= 1
            return True

        idx2 = self._h2(key)
        if self.table2[idx2] is not None and self.table2[idx2][0] == key:
            self.table2[idx2] = None
            self.size -= 1
            return True

        return False


# Usage
ct = CuckooHashTable()
ct.put("alice", 100)
ct.put("bob", 200)
ct.put("charlie", 300)
print(ct.get("bob"))       # 200
print(ct.get("unknown"))   # None
```

### Collision Resolution Comparison

```
Method           Avg Search    Worst Search   Pros                    Cons
──────────────────────────────────────────────────────────────────────────────
Separate Chain   O(1 + alpha)  O(n)           Simple, no clustering   Extra memory (pointers)
Linear Probe     O(1/(1-a))    O(n)           Cache-friendly          Clustering
Quadratic Probe  O(1/(1-a))    O(n)           Less clustering         Secondary clustering
Double Hashing   O(1/(1-a))    O(n)           Best distribution       Two hash functions
Cuckoo Hashing   O(1)          O(1)           Guaranteed O(1) lookup  Complex insert
```

---

## Bloom Filter

A Bloom filter is a **probabilistic data structure** that can tell you:
- **"Definitely NOT in the set"** -- 100% accurate
- **"PROBABLY in the set"** -- may have false positives

It uses `k` independent hash functions mapping to a bit array of size `m`.

### How It Works

```
Insert "hello":
  h1("hello") = 3    -> set bit 3
  h2("hello") = 7    -> set bit 7
  h3("hello") = 11   -> set bit 11

  Bit array: [0 0 0 1 0 0 0 1 0 0 0 1 0 0 0 0]
                   ^           ^           ^

Query "world":
  h1("world") = 3    -> bit 3 is 1  (could be from "hello")
  h2("world") = 5    -> bit 5 is 0  -> DEFINITELY NOT IN SET

Query "test":
  h1("test") = 3     -> bit 3 is 1
  h2("test") = 7     -> bit 7 is 1
  h3("test") = 11    -> bit 11 is 1
  All bits set -> PROBABLY IN SET (false positive!)
```

### Optimal Parameters

- **Optimal k (hash functions):** `k = (m/n) * ln(2)`
- **False positive rate:** `P = (1 - e^(-kn/m))^k`
- **Required bits per element for 1% FP rate:** ~9.6 bits
- **Required bits per element for 0.1% FP rate:** ~14.4 bits

### Implementation (Python)

```python
import math
import hashlib


class BloomFilter:
    """Space-efficient probabilistic set membership test."""

    def __init__(self, expected_items: int, fp_rate: float = 0.01):
        """
        Args:
            expected_items: Expected number of items to insert.
            fp_rate: Desired false positive rate (default 1%).
        """
        # Calculate optimal size and number of hash functions
        self.m = self._optimal_size(expected_items, fp_rate)
        self.k = self._optimal_hash_count(self.m, expected_items)
        self.bit_array = [False] * self.m
        self.size = 0

    @staticmethod
    def _optimal_size(n: int, p: float) -> int:
        """Optimal bit array size: m = -(n * ln(p)) / (ln(2)^2)"""
        return int(-n * math.log(p) / (math.log(2) ** 2))

    @staticmethod
    def _optimal_hash_count(m: int, n: int) -> int:
        """Optimal hash count: k = (m/n) * ln(2)"""
        return max(1, int((m / n) * math.log(2)))

    def _hashes(self, item: str) -> list[int]:
        """Generate k hash values using double hashing technique."""
        h1 = int(hashlib.md5(item.encode()).hexdigest(), 16)
        h2 = int(hashlib.sha256(item.encode()).hexdigest(), 16)
        return [(h1 + i * h2) % self.m for i in range(self.k)]

    def add(self, item: str) -> None:
        """Add an item to the Bloom filter. O(k)."""
        for idx in self._hashes(item):
            self.bit_array[idx] = True
        self.size += 1

    def __contains__(self, item: str) -> bool:
        """Check if item might be in the set. O(k).
        Returns False -> definitely not in set.
        Returns True  -> probably in set (may be false positive).
        """
        return all(self.bit_array[idx] for idx in self._hashes(item))

    @property
    def estimated_fp_rate(self) -> float:
        """Estimated current false positive rate."""
        return (1 - math.exp(-self.k * self.size / self.m)) ** self.k


# Usage
bf = BloomFilter(expected_items=1000, fp_rate=0.01)

# Add items
for word in ["apple", "banana", "cherry", "date", "elderberry"]:
    bf.add(word)

# Query
print("apple" in bf)       # True (correct)
print("banana" in bf)      # True (correct)
print("fig" in bf)         # False (correct -- definitely not)
print("grape" in bf)       # False (probably correct)

print(f"Bits: {bf.m}, Hash functions: {bf.k}")
print(f"Estimated FP rate: {bf.estimated_fp_rate:.6f}")
```

### Implementation (TypeScript)

```typescript
class BloomFilter {
    private bitArray: boolean[];
    private m: number;    // bit array size
    private k: number;    // number of hash functions
    private count: number;

    constructor(expectedItems: number, fpRate: number = 0.01) {
        this.m = Math.ceil(-expectedItems * Math.log(fpRate) / (Math.log(2) ** 2));
        this.k = Math.max(1, Math.round((this.m / expectedItems) * Math.log(2)));
        this.bitArray = new Array(this.m).fill(false);
        this.count = 0;
    }

    private hashes(item: string): number[] {
        // Simple double hashing using FNV-like hashes
        let h1 = 0;
        let h2 = 0;
        for (let i = 0; i < item.length; i++) {
            h1 = (h1 * 31 + item.charCodeAt(i)) | 0;
            h2 = (h2 * 37 + item.charCodeAt(i)) | 0;
        }
        h1 = Math.abs(h1);
        h2 = Math.abs(h2);

        const indices: number[] = [];
        for (let i = 0; i < this.k; i++) {
            indices.push((h1 + i * h2) % this.m);
        }
        return indices;
    }

    add(item: string): void {
        for (const idx of this.hashes(item)) {
            this.bitArray[idx] = true;
        }
        this.count++;
    }

    mightContain(item: string): boolean {
        return this.hashes(item).every(idx => this.bitArray[idx]);
    }
}

// Usage
const bf = new BloomFilter(1000, 0.01);
bf.add("apple");
bf.add("banana");
console.log(bf.mightContain("apple"));   // true
console.log(bf.mightContain("cherry"));  // false (definitely not)
```

### Bloom Filter Applications

| Application                | Why Bloom Filter?                                        |
|----------------------------|---------------------------------------------------------|
| Web caches (Akamai/CDN)   | Avoid caching one-hit-wonders (only cache on 2nd request)|
| Spell checkers             | Quick "not a word" check before expensive lookup         |
| Database query optimization| Skip disk reads for non-existent rows (LSM trees)       |
| Bitcoin SPV clients        | Check if transaction might be in a block                 |
| Network routers            | Packet deduplication, loop detection                     |
| Chrome Safe Browsing       | Check URLs against malicious URL database                |
| Apache Cassandra           | Skip SSTables that definitely don't contain a key        |

---

## Consistent Hashing

Standard hashing (`h(k) mod n`) breaks when `n` changes -- nearly all keys must be remapped.
Consistent hashing arranges servers on a **hash ring** so that adding or removing a server
only affects `~1/n` of the keys.

### How It Works

```
Hash Ring (0 to 2^32 - 1):

                    0 / 2^32
                      |
            Server A  *
                 /          \
         *  S_C               * S_B
        /                        \
       |                          |
        \                        /
         *  key3            *  key1
          \                /
           *  key2     *
                  |
              2^32 / 2

  Each key is assigned to the FIRST server encountered
  clockwise on the ring:
    key1 -> Server B
    key2 -> Server C (next server clockwise)
    key3 -> Server C
```

### Virtual Nodes

To ensure uniform distribution, each physical server is mapped to multiple **virtual nodes**
on the ring.

```
Physical Server A -> Virtual: A_0, A_1, A_2, ..., A_149
Physical Server B -> Virtual: B_0, B_1, B_2, ..., B_149
Physical Server C -> Virtual: C_0, C_1, C_2, ..., C_149

With 150 virtual nodes per server, load is balanced within ~5-10%.
```

### Implementation (Python)

```python
import hashlib
import bisect


class ConsistentHash:
    """Consistent hashing with virtual nodes."""

    def __init__(self, nodes: list[str] = None, virtual_nodes: int = 150):
        self.virtual_nodes = virtual_nodes
        self.ring: dict[int, str] = {}  # hash -> node name
        self.sorted_keys: list[int] = []

        if nodes:
            for node in nodes:
                self.add_node(node)

    def _hash(self, key: str) -> int:
        """Hash a string to a position on the ring."""
        digest = hashlib.md5(key.encode()).hexdigest()
        return int(digest, 16)

    def add_node(self, node: str) -> None:
        """Add a node with virtual copies. O(v log(nv))."""
        for i in range(self.virtual_nodes):
            virtual_key = f"{node}:{i}"
            h = self._hash(virtual_key)
            self.ring[h] = node
            bisect.insort(self.sorted_keys, h)

    def remove_node(self, node: str) -> None:
        """Remove a node and all its virtual copies. O(v log(nv))."""
        for i in range(self.virtual_nodes):
            virtual_key = f"{node}:{i}"
            h = self._hash(virtual_key)
            if h in self.ring:
                del self.ring[h]
                idx = bisect.bisect_left(self.sorted_keys, h)
                self.sorted_keys.pop(idx)

    def get_node(self, key: str) -> str:
        """Find which node a key maps to. O(log(nv))."""
        if not self.ring:
            raise ValueError("No nodes in the ring")

        h = self._hash(key)
        idx = bisect.bisect_right(self.sorted_keys, h)

        # Wrap around to the first node if past the end
        if idx == len(self.sorted_keys):
            idx = 0

        return self.ring[self.sorted_keys[idx]]


# Usage
ch = ConsistentHash(["server-1", "server-2", "server-3"])

# Map keys to servers
keys = ["user:1001", "user:1002", "user:1003", "session:abc", "cache:xyz"]
for key in keys:
    server = ch.get_node(key)
    print(f"  {key} -> {server}")

# Add a new server -- only ~1/4 of keys move
print("\nAdding server-4...")
ch.add_node("server-4")
for key in keys:
    server = ch.get_node(key)
    print(f"  {key} -> {server}")

# Remove a server -- only its keys move to the next server
print("\nRemoving server-2...")
ch.remove_node("server-2")
for key in keys:
    server = ch.get_node(key)
    print(f"  {key} -> {server}")
```

### Consistent Hashing Applications

| System           | Usage                                              |
|------------------|----------------------------------------------------|
| Amazon DynamoDB  | Partition data across storage nodes                 |
| Apache Cassandra | Distribute data across cluster ring                 |
| Memcached        | Client-side consistent hashing for cache sharding   |
| Redis Cluster    | Hash slots (16384 slots, similar concept)           |
| Akamai CDN       | Route requests to nearest/best cache server         |
| Discord          | Route messages to correct server                    |
| Load Balancers   | Sticky sessions without centralized state           |

---

## Hash Table Performance

```
Operation     Avg Case      Worst Case      Space
──────────────────────────────────────────────────────
Insert        O(1) amort.   O(n)            O(n)
Search        O(1)          O(n)            --
Delete        O(1)          O(n)            --
Resize        O(n)          O(n)            O(n) temp
```

Worst case occurs when all keys hash to the same bucket (adversarial or pathological input).

### Load Factor and Performance

```
Load Factor (alpha)    Avg Probes (linear)    Avg Probes (chaining)
──────────────────────────────────────────────────────────────────
0.25                   1.17                   1.25
0.50                   1.50                   1.50
0.70                   2.17                   1.70
0.80                   3.00                   1.80
0.90                   5.50                   1.90
0.95                   10.50                  1.95
1.00                   infinite               2.00
```

**Rule of thumb:** Keep load factor below 0.7 for open addressing, below 1.0 for chaining.
Most implementations resize at 0.75 (Java HashMap) or 2/3 (Python dict).

---

## Real-World Hash Table Implementations

| Language   | Structure           | Strategy              | Notes                         |
|------------|---------------------|-----------------------|-------------------------------|
| Python     | `dict`              | Open addressing       | Compact dict since 3.6, Robin Hood-like probing |
| Java       | `HashMap`           | Chaining              | Treeify buckets at 8 entries (RB-tree) |
| C++        | `unordered_map`     | Chaining              | Bucket-based, pointer-heavy   |
| Go         | `map`               | Chaining (buckets of 8)| Incremental resize            |
| JavaScript | `Map`               | Implementation varies | V8 uses hash table internally |
| Rust       | `HashMap`           | Robin Hood hashing    | SwissTable since 1.36         |
| C#/.NET    | `Dictionary`        | Open addressing       | Chaining in older versions    |

### Python Dict Internals (since CPython 3.6+)

```
Compact dict layout:
  Indices:   [_, 2, _, 0, 1, _, _, _]  (sparse, 1 byte per entry if < 256)
  Entries:   [(hash, key, value),       (dense, in insertion order)
              (hash, key, value),
              (hash, key, value)]

  Lookup: hash(key) -> index table -> entry table -> compare key
  Space efficient: indices are small (1-8 bytes), entries are dense
```

---

## Cryptographic vs Non-Cryptographic Hashing

### Non-Cryptographic (for hash tables, checksums)

| Function   | Speed      | Output | Notes                                |
|------------|------------|--------|--------------------------------------|
| MurmurHash3| Very fast  | 32/128 | General purpose, used by many DBs    |
| xxHash     | Fastest    | 32/64  | Extremely fast, used by Zstd         |
| FNV-1a     | Fast       | 32/64  | Simple, good distribution            |
| CityHash   | Very fast  | 64/128 | Optimized for strings (Google)       |
| SipHash    | Fast       | 64/128 | Hash-flood resistant (Python, Rust)  |

### Cryptographic (for security)

| Function   | Speed     | Output | Notes                                 |
|------------|-----------|--------|---------------------------------------|
| SHA-256    | Moderate  | 256    | General purpose crypto hash           |
| SHA-3      | Moderate  | 256+   | Keccak-based, NIST standard           |
| BLAKE3     | Fast      | 256    | Fastest secure hash                   |
| bcrypt     | Slow      | 184    | Password hashing (adaptive cost)      |
| Argon2     | Very slow | 256+   | Winner of Password Hashing Comp.      |

**Key difference:** Cryptographic hashes are intentionally slow and resist pre-image attacks
(cannot reverse the hash). Non-cryptographic hashes prioritize speed.

```
Use non-crypto:  Hash tables, checksums, data partitioning, deduplication
Use crypto:      Passwords, digital signatures, data integrity, certificates
```

---

## Common Interview Problems

| Problem                        | Technique                      | Time       |
|--------------------------------|--------------------------------|------------|
| Two Sum                        | Hash map (value -> index)      | O(n)       |
| Group Anagrams                 | Sort as key / frequency hash   | O(nk)      |
| Longest Substring w/o Repeat   | Sliding window + hash set      | O(n)       |
| Top K Frequent Elements        | Hash map + heap / bucket sort  | O(n log k) |
| Subarray Sum Equals K          | Prefix sum + hash map          | O(n)       |
| Design LRU Cache               | Hash map + doubly linked list  | O(1) ops   |
| Consistent Hashing             | Ring + sorted virtual nodes    | O(log n)   |
| Implement Hash Map             | Array + collision resolution   | O(1) avg   |

---

## Sources

- Cormen, Leiserson, Rivest, Stein. *Introduction to Algorithms* (CLRS), 4th Ed., Ch. 11 "Hash Tables"
- Knuth, D.E. *The Art of Computer Programming*, Vol. 3 "Sorting and Searching", Ch. 6.4
- Bloom, B.H. "Space/Time Trade-offs in Hash Coding with Allowable Errors" (1970), Communications of the ACM
- Karger, D. et al. "Consistent Hashing and Random Trees" (1997), STOC
- Pagh, R., Rodler, F.F. "Cuckoo Hashing" (2004), Journal of Algorithms
- Mitzenmacher, M., Upfal, E. *Probability and Computing*, Ch. 5 "Hashing"
- Wikipedia: "Hash table", "Bloom filter", "Consistent hashing", "Cuckoo hashing"
- cp-algorithms.com: String Hashing, Rabin-Karp
