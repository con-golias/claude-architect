# Tries (Prefix Trees)

> **Domain:** Fundamentals > Data Structures > Trees
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A trie (pronounced "try", from re**trie**val) is a tree-like data structure where each node represents a character. Paths from root to marked nodes represent stored strings. Unlike hash tables which compare entire keys, tries compare keys character by character — making them optimal for prefix-based operations like autocomplete, spell checking, and IP routing.

## Why It Matters

- **O(m) lookup** where m is the key length — independent of the number of stored keys.
- **Prefix search** — find all words starting with "pre" in O(p + k) where p is prefix length and k is the number of matches.
- **No hash collisions** — deterministic performance, unlike hash tables.
- **Sorted iteration** — keys are naturally stored in lexicographic order.

## How It Works

### Structure

```
Words stored: "cat", "car", "card", "care", "do", "dog"

         (root)
        /      \
       c        d
       |        |
       a        o
      / \       |
     t*  r*     g*
        / \
       d*  e*

* marks end of a complete word
```

### Node Definition

```typescript
class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord: boolean = false;
}

class Trie {
  private root: TrieNode = new TrieNode();

  // O(m) — insert a word
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

  // O(m) — search for exact word
  search(word: string): boolean {
    const node = this.findNode(word);
    return node !== null && node.isEndOfWord;
  }

  // O(m) — check if any word starts with prefix
  startsWith(prefix: string): boolean {
    return this.findNode(prefix) !== null;
  }

  // O(p + k) — find all words with given prefix
  autocomplete(prefix: string): string[] {
    const node = this.findNode(prefix);
    if (!node) return [];
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
    for (const [char, child] of node.children) {
      this.collectWords(child, prefix + char, results);
    }
  }
}
```

### Operations and Time Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| Insert | O(m) | m = key length |
| Search | O(m) | m = key length |
| Delete | O(m) | m = key length |
| Prefix search | O(p + k) | p = prefix length, k = matches |
| Sorted iteration | O(n) | Natural lexicographic order |

### Compressed Trie (Radix Tree / Patricia Tree)

Reduces memory by merging single-child chains:

```
Standard Trie:        Compressed Trie:
    (root)              (root)
     |                  /    \
     c                "ca"   "do"
     |                / \      |
     a               "t" "r"  "g"
    / \                  / \
   t   r                "d" "e"
      / \
     d   e
```

```
Space savings: fewer nodes, fewer pointers
Used in: Linux kernel routing tables, radix sort
```

### Trie vs Hash Table vs BST

| Property | Trie | Hash Table | BST |
|----------|------|------------|-----|
| Search | O(m) | O(m) average | O(m log n) |
| Prefix search | O(p + k) | O(n) | O(n) |
| Sorted iteration | Free | O(n log n) | O(n) |
| Space | High (many pointers) | Moderate | Moderate |
| Worst case | O(m) | O(n × m) | O(m × n) |

## Best Practices

1. **Use tries for prefix-heavy operations** — autocomplete, spell check, IP routing.
2. **Use compressed tries** (radix trees) to reduce memory usage.
3. **Consider array-based children** (size 26 for lowercase English) for speed, `Map` for flexibility.
4. **For simple key-value lookup**, prefer hash tables — tries have higher memory overhead.

## Anti-patterns / Common Mistakes

- **Using tries for simple key lookup** — hash tables are more memory-efficient and equally fast.
- **Not compressing** — uncompressed tries waste memory on long single-child chains.
- **Fixed-size arrays for Unicode** — using `char[65536]` per node is wasteful; use a map.
- **Forgetting end-of-word marker** — "car" should not match as a prefix when searching for the word "car" if it's not marked.

## Real-world Examples

- **Autocomplete** — Google search suggestions, IDE code completion.
- **Spell checkers** — dictionary lookup with suggestions for misspellings.
- **IP routing** — longest-prefix matching in network routers (Patricia trees).
- **T9 predictive text** — old phone keyboards mapped digits to words via tries.
- **Genome sequencing** — suffix trees (related to tries) for DNA pattern matching.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [Wikipedia — Trie](https://en.wikipedia.org/wiki/Trie)
- Fredkin, E. (1960). "Trie Memory." *Communications of the ACM*.
