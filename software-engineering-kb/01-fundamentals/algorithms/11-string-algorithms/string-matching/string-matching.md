# String Matching Algorithms

> **Domain:** Fundamentals > Algorithms > String > Pattern Matching
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-07

---

## What It Is

String matching (also called pattern matching) is the problem of finding all occurrences of a
pattern string **P** (length **m**) within a text string **T** (length **n**). This is one of the
most fundamental problems in computer science, with applications ranging from text editors and
search engines to bioinformatics (DNA sequence matching), intrusion detection systems, and
compilers.

Different algorithms optimize for different scenarios:

- **Single pattern, single text:** KMP, Boyer-Moore
- **Multiple patterns simultaneously:** Aho-Corasick
- **Multiple patterns, hash-based:** Rabin-Karp
- **Many queries on the same text:** Suffix Array, Suffix Tree
- **Approximate matching:** Edit distance-based approaches

---

## Naive / Brute Force

The simplest approach: slide the pattern over the text one position at a time and check for a
match at each position.

### How It Works

```
Text:    A B C A B C A B D
Pattern: A B C A B D

Step 1:  A B C A B C A B D
         A B C A B D          <- mismatch at position 5 (C != D)

Step 2:  A B C A B C A B D
           A B C A B D        <- mismatch at position 1 (B != A)

Step 3:  A B C A B C A B D
             A B C A B D      <- mismatch at position 1 (C != A)

Step 4:  A B C A B C A B D
               A B C A B D    <- MATCH at position 3!
```

### Implementation (Python)

```python
def naive_search(text: str, pattern: str) -> list[int]:
    """Return all starting indices where pattern occurs in text."""
    n, m = len(text), len(pattern)
    occurrences = []

    for i in range(n - m + 1):
        match = True
        for j in range(m):
            if text[i + j] != pattern[j]:
                match = False
                break
        if match:
            occurrences.append(i)

    return occurrences


# Example
text = "ABCABCABD"
pattern = "ABCABD"
print(naive_search(text, pattern))  # [3]
```

### Complexity

| Case    | Time       | Explanation                                     |
|---------|------------|-------------------------------------------------|
| Best    | O(n)       | First char always mismatches                    |
| Average | O(n + m)   | For random text and pattern                     |
| Worst   | O(nm)      | e.g., text = "AAAAAA", pattern = "AAB"          |

**Space:** O(1) auxiliary.

---

## KMP (Knuth-Morris-Pratt)

### Key Idea

When a mismatch occurs, the naive algorithm "forgets" all the characters it has already matched.
KMP precomputes a **failure function** (also called the prefix function or LPS array -- Longest
Proper Prefix which is also a Suffix) that tells us the longest prefix of the pattern that is
also a suffix of the matched portion. This allows us to shift the pattern intelligently without
re-examining characters in the text.

**Critical insight:** KMP never backtracks the text pointer -- it only moves forward. This makes
it ideal for streaming data.

### LPS Array Computation -- Step by Step

For pattern `P = "ABABAC"`:

```
Index:    0  1  2  3  4  5
Pattern:  A  B  A  B  A  C

Compute LPS:
  i=0: LPS[0] = 0                          (by definition)
  i=1: P[1]='B' vs P[0]='A' -> mismatch    LPS[1] = 0
  i=2: P[2]='A' vs P[0]='A' -> match       LPS[2] = 1
  i=3: P[3]='B' vs P[1]='B' -> match       LPS[3] = 2
  i=4: P[4]='A' vs P[2]='A' -> match       LPS[4] = 3
  i=5: P[5]='C' vs P[3]='B' -> mismatch
       fall back to LPS[2]=1
       P[5]='C' vs P[1]='B' -> mismatch
       fall back to LPS[0]=0
       P[5]='C' vs P[0]='A' -> mismatch    LPS[5] = 0

Result: LPS = [0, 0, 1, 2, 3, 0]
```

The LPS value at index `i` means: the longest proper prefix of `P[0..i]` that is also a suffix.

### ASCII Trace of Matching

```
Text:    A B A B A B A C
Pattern: A B A B A C

Step 1:  A B A B A B A C
         A B A B A C        <- mismatch at j=5 (B != C)
                             LPS[4] = 3, so shift to j=3

Step 2:  A B A B A B A C
             A B A B A C    <- We resume comparing at j=3
                             match continues: P[3]='B'=T[5], P[4]='A'=T[6], P[5]='C'=T[7]
                             MATCH found at index 2!
```

### Implementation (Python)

```python
def compute_lps(pattern: str) -> list[int]:
    """Compute the Longest Proper Prefix which is also Suffix array."""
    m = len(pattern)
    lps = [0] * m
    length = 0  # length of the previous longest prefix suffix
    i = 1

    while i < m:
        if pattern[i] == pattern[length]:
            length += 1
            lps[i] = length
            i += 1
        else:
            if length != 0:
                length = lps[length - 1]  # fall back, don't increment i
            else:
                lps[i] = 0
                i += 1

    return lps


def kmp_search(text: str, pattern: str) -> list[int]:
    """Find all occurrences of pattern in text using KMP algorithm."""
    n, m = len(text), len(pattern)
    if m == 0:
        return []

    lps = compute_lps(pattern)
    occurrences = []

    i = 0  # index in text
    j = 0  # index in pattern

    while i < n:
        if text[i] == pattern[j]:
            i += 1
            j += 1

        if j == m:
            occurrences.append(i - j)
            j = lps[j - 1]
        elif i < n and text[i] != pattern[j]:
            if j != 0:
                j = lps[j - 1]
            else:
                i += 1

    return occurrences


# Example
text = "ABABABABAC"
pattern = "ABABAC"
print(kmp_search(text, pattern))  # [4]
```

### Implementation (TypeScript)

```typescript
function computeLPS(pattern: string): number[] {
    const m = pattern.length;
    const lps: number[] = new Array(m).fill(0);
    let length = 0;
    let i = 1;

    while (i < m) {
        if (pattern[i] === pattern[length]) {
            length++;
            lps[i] = length;
            i++;
        } else {
            if (length !== 0) {
                length = lps[length - 1];
            } else {
                lps[i] = 0;
                i++;
            }
        }
    }
    return lps;
}

function kmpSearch(text: string, pattern: string): number[] {
    const n = text.length;
    const m = pattern.length;
    if (m === 0) return [];

    const lps = computeLPS(pattern);
    const occurrences: number[] = [];
    let i = 0; // text index
    let j = 0; // pattern index

    while (i < n) {
        if (text[i] === pattern[j]) {
            i++;
            j++;
        }

        if (j === m) {
            occurrences.push(i - j);
            j = lps[j - 1];
        } else if (i < n && text[i] !== pattern[j]) {
            if (j !== 0) {
                j = lps[j - 1];
            } else {
                i++;
            }
        }
    }
    return occurrences;
}

// Example
console.log(kmpSearch("ABABABABAC", "ABABAC")); // [4]
```

### Complexity

| Phase          | Time  | Space |
|----------------|-------|-------|
| Preprocessing  | O(m)  | O(m)  |
| Matching       | O(n)  | O(1)  |
| **Total**      | O(n+m)| O(m)  |

**Why it is efficient:** The text pointer `i` never decreases. Each comparison either advances
`i` or decreases `j` (which can decrease at most as many times as it has increased), giving a
total of at most `2n` comparisons.

---

## Rabin-Karp Algorithm

### Key Idea

Use a **rolling hash** to quickly compare the pattern hash with text substring hashes. Only
perform character-by-character comparison when hashes match (to rule out hash collisions).

### Rolling Hash Formula

Using polynomial hashing with base `d` and modulus `q`:

```
Initial hash of P[0..m-1]:
  hash_p = P[0]*d^(m-1) + P[1]*d^(m-2) + ... + P[m-1]

Rolling update (slide window by 1):
  hash_new = (hash_old - T[i]*d^(m-1)) * d + T[i+m]

All operations taken mod q to prevent overflow.
```

### Implementation (Python)

```python
def rabin_karp(text: str, pattern: str, d: int = 256, q: int = 101) -> list[int]:
    """Rabin-Karp string matching with rolling hash."""
    n, m = len(text), len(pattern)
    if m > n:
        return []

    occurrences = []
    h = pow(d, m - 1, q)  # d^(m-1) mod q
    p_hash = 0  # hash of pattern
    t_hash = 0  # hash of current text window

    # Compute initial hashes
    for i in range(m):
        p_hash = (d * p_hash + ord(pattern[i])) % q
        t_hash = (d * t_hash + ord(text[i])) % q

    # Slide pattern over text
    for i in range(n - m + 1):
        if p_hash == t_hash:
            # Hash match -- verify character by character (spurious hit check)
            if text[i:i + m] == pattern:
                occurrences.append(i)

        # Compute hash for next window
        if i < n - m:
            t_hash = (d * (t_hash - ord(text[i]) * h) + ord(text[i + m])) % q
            if t_hash < 0:
                t_hash += q

    return occurrences


# Example
print(rabin_karp("ABABDABABCABABD", "ABABC"))  # [5]
```

### Implementation (TypeScript)

```typescript
function rabinKarp(
    text: string,
    pattern: string,
    d: number = 256,
    q: number = 101
): number[] {
    const n = text.length;
    const m = pattern.length;
    if (m > n) return [];

    const occurrences: number[] = [];
    let h = 1;
    for (let k = 0; k < m - 1; k++) {
        h = (h * d) % q;  // d^(m-1) mod q
    }

    let pHash = 0;
    let tHash = 0;

    // Compute initial hashes
    for (let i = 0; i < m; i++) {
        pHash = (d * pHash + pattern.charCodeAt(i)) % q;
        tHash = (d * tHash + text.charCodeAt(i)) % q;
    }

    // Slide window
    for (let i = 0; i <= n - m; i++) {
        if (pHash === tHash) {
            if (text.substring(i, i + m) === pattern) {
                occurrences.push(i);
            }
        }
        if (i < n - m) {
            tHash = (d * (tHash - text.charCodeAt(i) * h) + text.charCodeAt(i + m)) % q;
            if (tHash < 0) tHash += q;
        }
    }
    return occurrences;
}

console.log(rabinKarp("ABABDABABCABABD", "ABABC")); // [5]
```

### Complexity

| Case    | Time       | Explanation                              |
|---------|------------|------------------------------------------|
| Average | O(n + m)   | Few hash collisions                      |
| Worst   | O(nm)      | All hashes collide (e.g., text = "AAAA") |

**Best for:** Searching for multiple patterns simultaneously (compute hash for each pattern,
compare all at once).

---

## Boyer-Moore Algorithm

### Key Idea

Start comparing from the **end** of the pattern (right to left). Use two heuristics to skip
large portions of the text:

1. **Bad Character Rule:** When a mismatch occurs at text character `c`, shift the pattern so
   that the rightmost occurrence of `c` in the pattern aligns with the mismatched position. If
   `c` does not appear in the pattern, shift past the entire pattern.

2. **Good Suffix Rule:** When a mismatch occurs after matching a suffix of the pattern, shift
   the pattern to align the next occurrence of that suffix (or a prefix that matches a suffix
   of the matched portion).

### Bad Character Rule -- Visual

```
Text:    H E R E   I S   A   S I M P L E   E X A M P L E
Pattern: E X A M P L E
                   ^
                   mismatch: T[3]='E' vs P[3]='M'

'E' occurs in pattern at position 6 (and 0). Shift pattern so that
P[6]='E' aligns with the mismatch position:

Text:    H E R E   I S   A   S I M P L E   E X A M P L E
                       E X A M P L E
```

### Implementation (Python -- Simplified with Bad Character Rule)

```python
def boyer_moore(text: str, pattern: str) -> list[int]:
    """Boyer-Moore with bad character heuristic."""
    n, m = len(text), len(pattern)
    if m > n:
        return []

    # Preprocess: last occurrence of each character in pattern
    bad_char = {}
    for i in range(m):
        bad_char[pattern[i]] = i

    occurrences = []
    s = 0  # shift of pattern relative to text

    while s <= n - m:
        j = m - 1  # start from end of pattern

        # Move j left while characters match
        while j >= 0 and pattern[j] == text[s + j]:
            j -= 1

        if j < 0:
            # Pattern found
            occurrences.append(s)
            # Shift pattern to align next character in text with its
            # last occurrence in pattern
            if s + m < n:
                s += m - bad_char.get(text[s + m], -1)
            else:
                s += 1
        else:
            # Mismatch -- shift using bad character rule
            bc_shift = j - bad_char.get(text[s + j], -1)
            s += max(1, bc_shift)

    return occurrences


# Example
print(boyer_moore("HERE IS A SIMPLE EXAMPLE", "EXAMPLE"))  # [17]
```

### Complexity

| Case    | Time    | Explanation                                    |
|---------|---------|------------------------------------------------|
| Best    | O(n/m)  | Sublinear! Skips large chunks of text          |
| Average | O(n)    | Typical for natural language text               |
| Worst   | O(nm)   | Pathological cases (mitigated with good suffix) |

**Best for:** Large alphabets (e.g., ASCII/Unicode text) and long patterns where mismatches
tend to occur quickly.

---

## Trie (Prefix Tree)

A trie is a tree-shaped data structure where each path from root to node represents a prefix of
stored strings. Each edge is labeled with a character.

### ASCII Diagram

Trie storing: `["apple", "app", "apt", "bat", "bar"]`

```
            (root)
           /      \
          a        b
          |        |
          p        a
         / \      / \
        p   t    t   r
        |   $    $   $
        l
        |
        e
        $

  $ = end-of-word marker

  Paths:
    root -> a -> p -> p -> l -> e  = "apple"
    root -> a -> p -> p            = "app"
    root -> a -> p -> t            = "apt"
    root -> b -> a -> t            = "bat"
    root -> b -> a -> r            = "bar"
```

### Implementation (Python)

```python
class TrieNode:
    def __init__(self):
        self.children: dict[str, 'TrieNode'] = {}
        self.is_end_of_word: bool = False


class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word: str) -> None:
        """Insert a word into the trie. O(m) where m = len(word)."""
        node = self.root
        for char in word:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
        node.is_end_of_word = True

    def search(self, word: str) -> bool:
        """Return True if the word exists in the trie. O(m)."""
        node = self._find_node(word)
        return node is not None and node.is_end_of_word

    def starts_with(self, prefix: str) -> bool:
        """Return True if any word starts with the given prefix. O(m)."""
        return self._find_node(prefix) is not None

    def delete(self, word: str) -> bool:
        """Delete a word from the trie. Returns True if deleted."""
        return self._delete_helper(self.root, word, 0)

    def _find_node(self, prefix: str) -> TrieNode | None:
        node = self.root
        for char in prefix:
            if char not in node.children:
                return None
            node = node.children[char]
        return node

    def _delete_helper(self, node: TrieNode, word: str, depth: int) -> bool:
        if depth == len(word):
            if not node.is_end_of_word:
                return False
            node.is_end_of_word = False
            return len(node.children) == 0  # can delete if no children

        char = word[depth]
        if char not in node.children:
            return False

        should_delete = self._delete_helper(node.children[char], word, depth + 1)

        if should_delete:
            del node.children[char]
            return not node.is_end_of_word and len(node.children) == 0

        return False

    def autocomplete(self, prefix: str) -> list[str]:
        """Return all words with the given prefix."""
        node = self._find_node(prefix)
        if node is None:
            return []
        results = []
        self._collect_words(node, prefix, results)
        return results

    def _collect_words(self, node: TrieNode, prefix: str, results: list[str]) -> None:
        if node.is_end_of_word:
            results.append(prefix)
        for char, child in sorted(node.children.items()):
            self._collect_words(child, prefix + char, results)


# Usage
trie = Trie()
for word in ["apple", "app", "apt", "bat", "bar"]:
    trie.insert(word)

print(trie.search("app"))           # True
print(trie.search("ap"))            # False
print(trie.starts_with("ap"))       # True
print(trie.autocomplete("ap"))      # ['app', 'apple', 'apt']
print(trie.autocomplete("ba"))      # ['bar', 'bat']
```

### Implementation (TypeScript)

```typescript
class TrieNode {
    children: Map<string, TrieNode> = new Map();
    isEndOfWord: boolean = false;
}

class Trie {
    private root: TrieNode = new TrieNode();

    insert(word: string): void {
        let node = this.root;
        for (const char of word) {
            if (!node.children.has(char)) {
                node.children.set(char, new TrieNode());
            }
            node = node.children.get(char)!;
        }
        node.isEndOfWord = true;
    }

    search(word: string): boolean {
        const node = this.findNode(word);
        return node !== null && node.isEndOfWord;
    }

    startsWith(prefix: string): boolean {
        return this.findNode(prefix) !== null;
    }

    autocomplete(prefix: string): string[] {
        const node = this.findNode(prefix);
        if (node === null) return [];
        const results: string[] = [];
        this.collectWords(node, prefix, results);
        return results;
    }

    private findNode(prefix: string): TrieNode | null {
        let node = this.root;
        for (const char of prefix) {
            if (!node.children.has(char)) return null;
            node = node.children.get(char)!;
        }
        return node;
    }

    private collectWords(node: TrieNode, prefix: string, results: string[]): void {
        if (node.isEndOfWord) results.push(prefix);
        const sortedKeys = [...node.children.keys()].sort();
        for (const char of sortedKeys) {
            this.collectWords(node.children.get(char)!, prefix + char, results);
        }
    }
}

// Usage
const trie = new Trie();
["apple", "app", "apt", "bat", "bar"].forEach(w => trie.insert(w));
console.log(trie.search("app"));          // true
console.log(trie.startsWith("ap"));       // true
console.log(trie.autocomplete("ap"));     // ["app", "apple", "apt"]
```

### Trie Complexity

| Operation     | Time  | Space      |
|---------------|-------|------------|
| Insert        | O(m)  | O(m) worst |
| Search        | O(m)  | O(1)       |
| StartsWith    | O(m)  | O(1)       |
| Delete        | O(m)  | O(1)       |
| Autocomplete  | O(m+k)| O(k)       |

Where `m` = key length, `k` = number of results.

**Applications:** Autocomplete, spell checkers, IP routing (longest prefix match), dictionaries,
T9 predictive text, Boggle solvers.

---

## Aho-Corasick Algorithm

### Key Idea

Aho-Corasick is to **multiple pattern matching** what KMP is to single pattern matching. It
builds a finite automaton on top of a trie of all patterns, adding **failure links** (analogous
to the KMP failure function) and **output links** (for patterns that are suffixes of other
patterns).

**Result:** Searches for all patterns simultaneously in a single pass through the text.

### How It Works

1. **Build trie** from all patterns
2. **Add failure links** using BFS (similar to KMP's LPS)
3. **Search:** follow trie edges for matches; on mismatch, follow failure link

### Implementation (Python)

```python
from collections import deque


class AhoCorasick:
    def __init__(self):
        self.goto = [{}]       # goto function (trie edges)
        self.fail = [0]        # failure links
        self.output = [[]]     # output at each state (pattern indices)
        self.num_states = 1

    def _add_state(self) -> int:
        self.goto.append({})
        self.fail.append(0)
        self.output.append([])
        state_id = self.num_states
        self.num_states += 1
        return state_id

    def build(self, patterns: list[str]) -> None:
        """Build the automaton from a list of patterns."""
        # Phase 1: Build trie
        for idx, pattern in enumerate(patterns):
            state = 0
            for char in pattern:
                if char not in self.goto[state]:
                    self.goto[state][char] = self._add_state()
                state = self.goto[state][char]
            self.output[state].append(idx)

        # Phase 2: Build failure links using BFS
        queue = deque()
        for char, state in self.goto[0].items():
            self.fail[state] = 0
            queue.append(state)

        while queue:
            curr = queue.popleft()
            for char, next_state in self.goto[curr].items():
                queue.append(next_state)

                # Follow failure links to find the longest proper suffix
                failure = self.fail[curr]
                while failure != 0 and char not in self.goto[failure]:
                    failure = self.fail[failure]

                self.fail[next_state] = self.goto[failure].get(char, 0)
                if self.fail[next_state] == next_state:
                    self.fail[next_state] = 0

                # Merge outputs
                self.output[next_state] = (
                    self.output[next_state] + self.output[self.fail[next_state]]
                )

    def search(self, text: str, patterns: list[str]) -> list[tuple[int, str]]:
        """Search text for all pattern occurrences. Returns (position, pattern)."""
        results = []
        state = 0

        for i, char in enumerate(text):
            while state != 0 and char not in self.goto[state]:
                state = self.fail[state]
            state = self.goto[state].get(char, 0)

            for pattern_idx in self.output[state]:
                pat = patterns[pattern_idx]
                results.append((i - len(pat) + 1, pat))

        return results


# Usage
patterns = ["he", "she", "his", "hers"]
ac = AhoCorasick()
ac.build(patterns)
matches = ac.search("ahishers", patterns)
for pos, pat in matches:
    print(f"  Pattern '{pat}' found at index {pos}")
# Output:
#   Pattern 'his' found at index 1
#   Pattern 'he' found at index 4
#   Pattern 'she' found at index 3
#   Pattern 'hers' found at index 4
```

### Complexity

| Phase         | Time        | Space       |
|---------------|-------------|-------------|
| Build trie    | O(sum(m_i)) | O(sum(m_i)) |
| Build failure | O(sum(m_i)) | O(1) extra  |
| Search        | O(n + z)    | O(1)        |

Where `n` = text length, `m_i` = length of pattern i, `z` = total number of matches.

**Applications:** Antivirus scanning (matching thousands of malware signatures), network
intrusion detection (Snort IDS), multi-keyword grep, DNA motif finding.

---

## Suffix Array

A suffix array is a sorted array of all suffixes of a string. It enables efficient substring
search via binary search.

### Construction

For string `S = "banana"`:

```
Suffixes:                  Sorted suffixes:         Suffix Array:
0: banana                  5: a                     [5, 3, 1, 0, 4, 2]
1: anana                   3: ana
2: nana                    1: anana
3: ana                     0: banana
4: na                      4: na
5: a                       2: nana
```

### Implementation (Python)

```python
def build_suffix_array(text: str) -> list[int]:
    """Build suffix array using simple O(n log^2 n) approach."""
    n = len(text)
    # Create list of (suffix, original_index)
    suffixes = [(text[i:], i) for i in range(n)]
    suffixes.sort(key=lambda x: x[0])
    return [idx for _, idx in suffixes]


def search_suffix_array(text: str, sa: list[int], pattern: str) -> list[int]:
    """Binary search for pattern in suffix array. O(m log n)."""
    n = len(text)
    m = len(pattern)

    # Find leftmost occurrence
    lo, hi = 0, n - 1
    left = n
    while lo <= hi:
        mid = (lo + hi) // 2
        suffix = text[sa[mid]:sa[mid] + m]
        if suffix >= pattern:
            left = mid
            hi = mid - 1
        else:
            lo = mid + 1

    # Find rightmost occurrence
    lo, hi = 0, n - 1
    right = -1
    while lo <= hi:
        mid = (lo + hi) // 2
        suffix = text[sa[mid]:sa[mid] + m]
        if suffix <= pattern:
            right = mid
            lo = mid + 1
        else:
            hi = mid - 1

    if left > right:
        return []
    return sorted(sa[left:right + 1])


# Usage
text = "banana"
sa = build_suffix_array(text)
print(f"Suffix Array: {sa}")              # [5, 3, 1, 0, 4, 2]
print(search_suffix_array(text, sa, "ana"))  # [1, 3]
```

### Complexity

| Operation      | Time           | Space |
|----------------|----------------|-------|
| Construction   | O(n log^2 n)*  | O(n)  |
| Search         | O(m log n)     | O(1)  |

*O(n log n) with DC3/SA-IS algorithm.

**Applications:** Longest repeated substring, number of distinct substrings, longest common
substring of two strings, full-text indexing.

---

## Comparison Table

```
Algorithm       Preprocessing     Matching          Best For
───────────────────────────────────────────────────────────────────────
Naive           O(0)              O(nm)             Short texts, simple cases
KMP             O(m)              O(n)              Single pattern, streaming data
Rabin-Karp      O(m)              O(n+m) avg        Multiple patterns (hash-based)
Boyer-Moore     O(m + sigma)      O(n/m) best       Large alphabet, long patterns
Aho-Corasick    O(sum(m_i))       O(n + z)          Multiple patterns simultaneously
Suffix Array    O(n log n)        O(m log n)        Many queries on same text
Trie            O(sum(m_i))       O(m) per query    Prefix search, autocomplete
```

Where `n` = text length, `m` = pattern length, `sigma` = alphabet size, `z` = number of
matches.

### Decision Guide

```
How many patterns?
  |
  +-- Single pattern
  |     |
  |     +-- Short text? -----------> Naive
  |     +-- Streaming data? -------> KMP
  |     +-- Large alphabet? -------> Boyer-Moore
  |
  +-- Multiple patterns
  |     |
  |     +-- All at once? ----------> Aho-Corasick
  |     +-- Hash-based check? -----> Rabin-Karp
  |
  +-- Many queries, same text
        |
        +-- Substring queries? ----> Suffix Array / Suffix Tree
        +-- Prefix queries? -------> Trie
```

---

## Common Interview Problems

| Problem                          | Best Algorithm      | Time        |
|----------------------------------|---------------------|-------------|
| Find pattern in string           | KMP / Boyer-Moore   | O(n + m)    |
| Find multiple patterns           | Aho-Corasick        | O(n + z)    |
| Longest repeated substring       | Suffix Array + LCP  | O(n log n)  |
| Autocomplete                     | Trie                | O(m + k)    |
| Plagiarism detection             | Rabin-Karp (rolling) | O(n)       |
| DNA sequence matching            | Suffix Tree / KMP   | O(n + m)    |
| Implement strStr()               | KMP / Rabin-Karp    | O(n + m)    |

---

## Sources

- Cormen, Leiserson, Rivest, Stein. *Introduction to Algorithms* (CLRS), 4th Ed., Ch. 32 "String Matching"
- Knuth, D.E., Morris, J.H., Pratt, V.R. "Fast Pattern Matching in Strings" (1977), SIAM Journal on Computing
- Aho, A.V., Corasick, M.J. "Efficient String Matching: An Aid to Bibliographic Search" (1975), Communications of the ACM
- Boyer, R.S., Moore, J.S. "A Fast String Searching Algorithm" (1977), Communications of the ACM
- Karp, R.M., Rabin, M.O. "Efficient Randomized Pattern-Matching Algorithms" (1987), IBM Journal
- Manber, U., Myers, G. "Suffix Arrays: A New Method for On-Line String Searches" (1993), SIAM Journal on Computing
- Wikipedia: "String-searching algorithm", "Knuth-Morris-Pratt algorithm", "Aho-Corasick algorithm"
- cp-algorithms.com: String Hashing, Suffix Array, Aho-Corasick
