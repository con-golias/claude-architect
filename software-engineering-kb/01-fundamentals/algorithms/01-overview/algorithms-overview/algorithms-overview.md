# Algorithms Overview

> **Domain:** Fundamentals > Algorithms > Overview
> **Difficulty:** Beginner-Intermediate
> **Last Updated:** 2026-03-07

---

## What It Is

An **algorithm** is a finite sequence of well-defined, unambiguous instructions designed to solve a class of problems or perform a computation. Given an input, an algorithm produces an output through a deterministic series of steps that are guaranteed to terminate.

The word "algorithm" derives from the name **al-Khwarizmi** (Muhammad ibn Musa al-Khwarizmi), a 9th-century Persian mathematician whose works introduced Hindu-Arabic numerals and algebraic concepts to Europe. His name was Latinized to "Algoritmi," which eventually became "algorithm."

More formally, an algorithm can be defined as a computational procedure that takes a value (or set of values) as **input** and produces a value (or set of values) as **output**. An algorithm is thus a sequence of computational steps that transform the input into the output.

### Informal vs Formal Definitions

| Perspective     | Definition                                                                 |
|-----------------|---------------------------------------------------------------------------|
| Informal        | A step-by-step recipe to solve a problem                                   |
| Mathematical    | A mapping from inputs to outputs via a finite sequence of operations       |
| Turing Machine  | A program for a Turing machine that halts on all valid inputs              |
| Church-Turing   | Any effectively computable function (lambda calculus, recursive functions)  |

---

## Why Algorithms Matter

### 1. Foundation of Computer Science

Algorithms are the intellectual core of computer science. Data structures hold data; algorithms manipulate it. Without efficient algorithms, even the fastest hardware is useless for large-scale problems.

### 2. Efficiency Determines Feasibility

The difference between a good and bad algorithm is not incremental -- it is existential:

```
Problem: Sort 1 million integers

Algorithm         Complexity     Operations (approx.)    Time at 10⁹ ops/sec
────────────────────────────────────────────────────────────────────────────────
Bubble Sort       O(n^2)         10^12                   ~17 minutes
Merge Sort        O(n log n)     2 * 10^7                ~0.02 seconds
```

An O(n^2) algorithm on 10 million elements takes **~28 hours**. An O(n log n) algorithm takes **~0.2 seconds**. Algorithm choice is the single biggest performance lever available to engineers.

### 3. Interview and Career Staple

Algorithm knowledge is tested in virtually every software engineering interview at major companies (FAANG, startups, finance). Understanding algorithms demonstrates problem-solving ability and computational thinking.

### 4. Engineering Craft

Writing efficient, correct algorithms is a craft. It requires understanding trade-offs between time, space, readability, and maintainability. Great engineers choose the right algorithm for the right problem.

### 5. Real-World Impact

- **Google Search** relies on PageRank and inverted indices
- **GPS navigation** uses Dijkstra's / A* shortest-path algorithms
- **Compression** (ZIP, JPEG, MP3) uses Huffman coding and transforms
- **Encryption** (HTTPS, banking) uses RSA, AES, and number-theoretic algorithms
- **Machine Learning** is built on gradient descent, backpropagation, and optimization algorithms
- **Database queries** depend on B-tree traversal, hash joins, and sort-merge joins

---

## Algorithm Classification

Algorithms can be classified along several orthogonal dimensions.

### By Design Paradigm

```
Paradigm              Description                            Examples
────────────────────────────────────────────────────────────────────────────────────
Brute Force           Try all possibilities                   Linear search, string matching
Divide & Conquer      Split -> solve halves -> combine         Merge sort, quicksort, binary search
Greedy                Make locally optimal choices             Huffman coding, Dijkstra, Kruskal
Dynamic Programming   Overlapping subproblems + optimal cache  Knapsack, LCS, edit distance
Backtracking          Build incrementally, prune early         N-Queens, Sudoku solver, subset sum
Randomized            Use randomness for speed or simplicity   QuickSort (random pivot), Monte Carlo
Branch & Bound        Systematic enumeration with pruning      TSP, integer linear programming
Transform & Conquer   Transform problem, then solve            Heapsort (heapify), Gaussian elim.
Incremental           Build solution one element at a time     Insertion sort, convex hull (online)
Reduction             Reduce to a known solved problem         Sorting -> median, graph coloring
```

#### Paradigm Selection Flowchart

```
                    ┌─────────────────────┐
                    │  Understand Problem  │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │ Optimal substructure?│
                    └──┬──────────────┬────┘
                   Yes │              │ No
              ┌────────▼──────┐  ┌────▼──────────────┐
              │ Overlapping   │  │ Can we divide      │
              │ subproblems?  │  │ into independent   │
              └──┬────────┬───┘  │ subproblems?       │
              Yes│        │No    └──┬─────────────┬───┘
        ┌────────▼──┐  ┌──▼────┐ Yes│             │No
        │  Dynamic   │  │Greedy │ ┌──▼──────────┐ ┌▼──────────┐
        │Programming │  │       │ │Divide &     │ │Brute Force│
        └────────────┘  └───────┘ │Conquer      │ │Backtrack  │
                                  └─────────────┘ └───────────┘
```

### By Problem Type

| Problem Type     | Description                                   | Key Algorithms                                      |
|------------------|-----------------------------------------------|-----------------------------------------------------|
| **Sorting**      | Arrange elements in a defined order            | Merge sort, quicksort, heapsort, radix sort          |
| **Searching**    | Find elements or verify existence              | Binary search, BFS, DFS, hash lookup                 |
| **Graph**        | Traverse, find paths, detect cycles            | Dijkstra, Bellman-Ford, Kruskal, Prim, topological   |
| **String**       | Pattern matching, transformation               | KMP, Rabin-Karp, Aho-Corasick, suffix arrays         |
| **Mathematical** | Number theory, combinatorics, algebra          | GCD (Euclid), Sieve of Eratosthenes, FFT, RSA       |
| **Optimization** | Find best solution from a feasible set         | Linear programming, simplex, gradient descent         |
| **Geometric**    | Spatial problems on points, lines, polygons    | Convex hull, closest pair, line intersection          |
| **Compression**  | Reduce data size losslessly or lossy           | Huffman, LZW, run-length encoding                     |
| **Cryptographic**| Encrypt, decrypt, sign, verify                 | AES, RSA, SHA-256, elliptic curve                     |

### By Input/Output Characteristics

```
Dimension                Description                        Examples
────────────────────────────────────────────────────────────────────────────────────
Deterministic            Same input -> always same output     Merge sort, Dijkstra
Nondeterministic         May produce different outputs        Randomized quicksort, Monte Carlo
Online                   Processes input as it arrives        Insertion sort (streaming)
Offline                  Requires all input upfront           Merge sort (batch)
Exact                    Guarantees optimal/correct result    Dijkstra (shortest path)
Approximate              Guarantees near-optimal result       Approximation algorithms for NP-hard
Serial                   Single thread of execution           Standard implementations
Parallel                 Multiple concurrent threads          Parallel merge sort, MapReduce
In-place                 O(1) extra space                     Quicksort, heapsort
Out-of-place             Requires extra memory                Merge sort (O(n) extra)
Stable                   Preserves relative order of equal    Merge sort, insertion sort
Unstable                 May reorder equal elements           Quicksort, heapsort
Comparison-based         Uses element comparisons             Merge sort (O(n log n) lower bound)
Non-comparison           Uses element properties (digits)     Radix sort, counting sort (O(n))
```

---

## Algorithm Properties

Every well-defined algorithm must exhibit these essential properties:

### 1. Correctness

The algorithm produces the correct output for every valid input. Correctness is typically proven via:

- **Loop invariants** -- a property that holds before and after each iteration
- **Mathematical induction** -- base case + inductive step
- **Formal verification** -- machine-checked proofs (Coq, Isabelle)

### 2. Termination

The algorithm halts after a finite number of steps for every valid input. Contrast with programs that intentionally run forever (servers, OS kernels) -- those are not algorithms in the strict sense.

### 3. Determinism

For a given input, a deterministic algorithm always follows the same sequence of steps. Randomized algorithms relax this but still produce correct results (with high probability or in expectation).

### 4. Finiteness

The description of the algorithm is finite (finite number of instructions). This distinguishes algorithms from infinite mathematical objects.

### 5. Effectiveness

Each step must be basic enough to be carried out exactly and in finite time by a person with pencil and paper (or a machine). Operations like "find the answer" are not effective.

### 6. Generality

An algorithm solves a **class** of problems, not a single instance. A sorting algorithm sorts any array, not just one specific array.

---

## How to Analyze Algorithms

### Time Complexity

Measures the number of elementary operations as a function of input size n.

```
Common operations counted:
  - Comparisons (sorting, searching)
  - Arithmetic operations (numerical algorithms)
  - Memory accesses (cache-aware algorithms)
  - Assignments / swaps
```

### Space Complexity

Measures the amount of memory used beyond the input itself (auxiliary space).

```
Components:
  - Input space (not usually counted)
  - Auxiliary space (extra arrays, hash tables)
  - Stack space (recursion depth)
```

### Asymptotic Notation (Preview)

| Notation | Meaning           | Analogy           |
|----------|-------------------|-------------------|
| O(g(n))  | Upper bound       | f(n) <= c*g(n)    |
| Omega(g(n))  | Lower bound   | f(n) >= c*g(n)    |
| Theta(g(n))  | Tight bound   | c1*g(n) <= f(n) <= c2*g(n) |

> See [Complexity Analysis & Big O](../../02-complexity-analysis/complexity-and-big-o/complexity-and-big-o.md) for full coverage.

### Best, Average, and Worst Case

Every algorithm has three performance profiles:

```
Case        Definition                          QuickSort Example
──────────────────────────────────────────────────────────────────────
Best        Minimum operations for any input    O(n log n) — balanced pivots
Average     Expected operations over all inputs O(n log n) — random pivots
Worst       Maximum operations for any input    O(n^2) — sorted + bad pivot
```

---

## Algorithm Design Process

A disciplined approach to algorithm design follows these steps:

```
Step 1: Understand the Problem
  ├── Define inputs, outputs, constraints
  ├── Identify edge cases (empty input, single element, duplicates)
  └── Clarify requirements (exact vs approximate, online vs offline)

Step 2: Choose a Paradigm
  ├── Start with brute force — get a correct baseline
  ├── Identify structure: optimal substructure? overlapping subproblems?
  └── Select paradigm: D&C, DP, greedy, backtracking

Step 3: Design the Algorithm
  ├── Write pseudocode first (language-independent)
  ├── Define helper functions and data structures
  └── Trace through examples by hand

Step 4: Prove Correctness
  ├── Identify loop invariant or inductive hypothesis
  ├── Prove base case
  ├── Prove maintenance (invariant preserved)
  └── Prove termination

Step 5: Analyze Complexity
  ├── Count dominant operations
  ├── Express as function of input size
  └── Determine best/average/worst case

Step 6: Implement and Test
  ├── Translate pseudocode to code
  ├── Test with edge cases and large inputs
  └── Use assertions and invariant checks

Step 7: Optimize If Needed
  ├── Profile to find bottlenecks
  ├── Consider algorithmic improvements first
  ├── Then consider constant-factor improvements
  └── Consider space-time trade-offs
```

### Example: Design Process for "Two Sum"

**Problem:** Given an array of integers and a target sum, find two numbers that add up to the target.

```python
# Step 1: Input = array + target, Output = indices of two numbers
# Step 2: Brute force first, then optimize with hash map

# Brute Force — O(n^2) time, O(1) space
def two_sum_brute(nums: list[int], target: int) -> list[int]:
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []

# Optimized — O(n) time, O(n) space
def two_sum_hash(nums: list[int], target: int) -> list[int]:
    seen = {}  # value -> index
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
```

```typescript
// TypeScript — Brute Force O(n^2)
function twoSumBrute(nums: number[], target: number): number[] {
    for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
            if (nums[i] + nums[j] === target) {
                return [i, j];
            }
        }
    }
    return [];
}

// TypeScript — Hash Map O(n)
function twoSumHash(nums: number[], target: number): number[] {
    const seen = new Map<number, number>();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (seen.has(complement)) {
            return [seen.get(complement)!, i];
        }
        seen.set(nums[i], i);
    }
    return [];
}
```

```java
// Java — Hash Map O(n)
import java.util.HashMap;
import java.util.Map;

public class TwoSum {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (seen.containsKey(complement)) {
                return new int[]{seen.get(complement), i};
            }
            seen.put(nums[i], i);
        }
        return new int[]{};
    }
}
```

```cpp
// C++ — Hash Map O(n)
#include <vector>
#include <unordered_map>

std::vector<int> twoSum(std::vector<int>& nums, int target) {
    std::unordered_map<int, int> seen;
    for (int i = 0; i < nums.size(); i++) {
        int complement = target - nums[i];
        if (seen.count(complement)) {
            return {seen[complement], i};
        }
        seen[nums[i]] = i;
    }
    return {};
}
```

```go
// Go — Hash Map O(n)
func twoSum(nums []int, target int) []int {
    seen := make(map[int]int)
    for i, num := range nums {
        complement := target - num
        if j, ok := seen[complement]; ok {
            return []int{j, i}
        }
        seen[num] = i
    }
    return nil
}
```

```rust
// Rust — Hash Map O(n)
use std::collections::HashMap;

fn two_sum(nums: &[i32], target: i32) -> Vec<usize> {
    let mut seen: HashMap<i32, usize> = HashMap::new();
    for (i, &num) in nums.iter().enumerate() {
        let complement = target - num;
        if let Some(&j) = seen.get(&complement) {
            return vec![j, i];
        }
        seen.insert(num, i);
    }
    vec![]
}
```

---

## Language Comparison for Algorithm Implementation

```
Language    Speed       Strengths                          Weaknesses                  Typical Use
──────────────────────────────────────────────────────────────────────────────────────────────────────
Python      Slow       Readable, rapid prototyping,        Slow execution, GIL,        Interviews,
            (interp.)  rich libraries (collections,        no type safety (unless      prototyping,
                       heapq, itertools)                   using typing)               ML/data science

TypeScript  Medium     Web-native, good type system,       Single-threaded, GC         Web apps,
            (JIT)      functional patterns, async          pauses, no low-level        full-stack,
                                                          control                      cloud functions

Java        Fast       Enterprise ecosystem, JIT,          Verbose, boilerplate,       Enterprise,
            (JIT)      strong typing, Collections          GC pauses, no unsigned      Android, backend
                       framework, concurrent utils

C++         Very Fast  Zero-overhead, STL, templates,     Complex syntax, manual      Systems, games,
            (compiled) fine-grained memory control        memory mgmt, UB risk        competitive prog.

Go          Fast       Simple syntax, built-in             No generics (until 1.18),   Cloud, CLI,
            (compiled) concurrency (goroutines),           no exceptions, limited      microservices,
                       fast compilation                    type system                  DevOps

Rust        Very Fast  Zero-cost abstractions, memory      Steep learning curve,       Systems,
            (compiled) safety without GC, ownership        slower compilation,         embedded, WASM,
                       model, pattern matching             verbose lifetimes           performance-critical
```

---

## Famous Algorithms Timeline

```
Year        Algorithm / Concept              Inventor / Discoverer        Significance
──────────────────────────────────────────────────────────────────────────────────────────────────────
~300 BC     Euclidean Algorithm (GCD)         Euclid                       Oldest known non-trivial algorithm
~200 BC     Sieve of Eratosthenes            Eratosthenes                 First prime-finding algorithm
~800 AD     al-Khwarizmi's algebra           al-Khwarizmi                 Origin of the word "algorithm"
1669        Newton's Method                  Isaac Newton                  Iterative root finding
1805        FFT (precursor)                  Carl Friedrich Gauss          Fast polynomial multiplication
1809        Gaussian Elimination             Carl Friedrich Gauss          Solving linear systems
1843        First Algorithm (published)      Ada Lovelace                  Bernoulli numbers on Analytical Engine
1936        Turing Machine                   Alan Turing                   Formalized computation
1945        Merge Sort                       John von Neumann              First O(n log n) sorting algorithm
1956        Dijkstra's Algorithm             Edsger Dijkstra               Single-source shortest path
1956        Kruskal's Algorithm              Joseph Kruskal                Minimum spanning tree
1957        Prim's Algorithm                 Robert Prim                   Minimum spanning tree (alternative)
1959        Quicksort                        Tony Hoare                    Fastest practical sorting
1960        Dynamic Programming (coined)     Richard Bellman               Optimization framework
1962        AVL Tree                         Adelson-Velsky & Landis       First self-balancing BST
1965        Cooley-Tukey FFT                 Cooley & Tukey                Rediscovered fast Fourier transform
1968        A* Search                        Hart, Nilsson, Raphael        Optimal pathfinding with heuristics
1970        Knuth-Morris-Pratt               Knuth, Morris, Pratt          Linear-time string matching
1972        Red-Black Trees                  Rudolf Bayer                   Balanced BST used in std::map
1977        RSA Encryption                   Rivest, Shamir, Adleman       Public-key cryptography
1978        LZW Compression                  Lempel, Ziv, Welch            Dictionary-based compression
1984        Karmarkar's Algorithm            Narendra Karmarkar             Polynomial-time linear programming
1994        Shor's Algorithm                 Peter Shor                     Quantum factoring (breaks RSA)
1996        PageRank                         Larry Page, Sergey Brin        Web page ranking (Google)
2001        AES (Rijndael)                   Daemen, Rijmen                 Modern symmetric encryption standard
```

---

## Unsolved Problems in Algorithm Theory

### P vs NP (Millennium Prize Problem -- $1M reward)

The most important open question in theoretical computer science:

```
Class P:   Problems solvable in polynomial time
           (sorting, shortest path, primality testing)

Class NP:  Problems whose solutions are VERIFIABLE in polynomial time
           (SAT, traveling salesman, graph coloring)

Question:  Is P = NP?
           Can every problem whose solution is quickly verifiable
           also be quickly solvable?

Consensus: Most researchers believe P != NP, but no proof exists.

Implication if P = NP:
  - Most cryptography would break
  - Optimization problems become efficiently solvable
  - Enormous practical impact on logistics, scheduling, AI
```

### Other Open Problems

| Problem                 | Status                                                       |
|-------------------------|--------------------------------------------------------------|
| **Traveling Salesman**  | No polynomial exact algorithm known; best approximation: 1.5x|
| **Graph Isomorphism**   | Quasipolynomial (Babai, 2015), but polynomial unknown        |
| **Optimal Matrix Mult.**| Strassen: O(n^2.807); current best: O(n^2.371); is O(n^2) possible? |
| **Integer Factoring**   | No classical polynomial algorithm; quantum: Shor's O((log n)^3) |
| **3SUM Conjecture**     | Is O(n^(2-e)) possible? Major implication for computational geometry |

---

## Pseudocode Conventions

Throughout this knowledge base, pseudocode follows these conventions:

```
ALGORITHM-NAME(input1, input2, ...)
    // Comments use double slash
    // Indentation denotes scope (no braces)
    // 1-indexed arrays by default (following CLRS)
    // Assignment uses =
    // Equality comparison uses ==

    for i = 1 to n
        if condition
            do something
        else
            do something else

    return result
```

### Example: Binary Search in Pseudocode

```
BINARY-SEARCH(A, target)
    low = 0
    high = length(A) - 1

    while low <= high
        mid = low + (high - low) / 2    // avoids integer overflow

        if A[mid] == target
            return mid
        else if A[mid] < target
            low = mid + 1
        else
            high = mid - 1

    return -1    // not found
```

---

## The Algorithm Complexity Landscape

```
                    ┌──────────────────────────────────────────────────────┐
        Feasible    │                                                      │
        (Polynomial)│   O(1)  O(log n)  O(n)  O(n log n)  O(n^2)  O(n^3) │
                    │    |       |        |       |          |        |     │
                    │  const   binary   linear  merge     bubble  matrix   │
                    │  lookup  search   scan    sort      sort    mult     │
                    └──────────────────────────────────────────────────────┘
                    ┌──────────────────────────────────────────────────────┐
        Intractable │                                                      │
        (Exponential│   O(2^n)            O(n!)                            │
        & Beyond)   │    |                  |                               │
                    │  subsets           permutations                       │
                    │  brute TSP         brute force                        │
                    └──────────────────────────────────────────────────────┘
                    ┌──────────────────────────────────────────────────────┐
        Undecidable │   Halting Problem                                     │
                    │   Post Correspondence Problem                        │
                    │   Rice's Theorem (non-trivial program properties)     │
                    └──────────────────────────────────────────────────────┘
```

---

## Algorithms in Standard Libraries

Most languages provide battle-tested algorithm implementations. Know what is available before reimplementing:

### Python

```python
# Sorting
sorted(iterable)           # Timsort, O(n log n), stable
list.sort()                # In-place Timsort

# Searching
bisect.bisect_left(a, x)  # Binary search (sorted list)
bisect.insort(a, x)       # Insert maintaining sort order

# Data structures with algorithmic guarantees
from collections import deque, Counter, defaultdict, OrderedDict
from heapq import heappush, heappop, heapify      # Min-heap
from functools import lru_cache                     # Memoization
import itertools                                    # Combinatorial iterators
```

### TypeScript / JavaScript

```typescript
// Sorting
array.sort((a, b) => a - b);  // Timsort (V8), O(n log n)

// Searching — no built-in binary search; use libraries or implement
// Map and Set — hash-based O(1) average lookup
const map = new Map<string, number>();
const set = new Set<number>();
```

### Java

```java
// Sorting
Arrays.sort(arr);                    // Dual-pivot quicksort (primitives)
Collections.sort(list);             // Timsort (objects), stable

// Searching
Arrays.binarySearch(arr, target);   // Binary search (sorted array)
Collections.binarySearch(list, target);

// Data structures
TreeMap<K,V>       // Red-black tree, O(log n) operations
PriorityQueue<E>   // Binary heap, O(log n) insert/extract
HashMap<K,V>       // Hash table, O(1) average operations
```

### C++

```cpp
// Sorting
std::sort(v.begin(), v.end());            // Introsort, O(n log n), unstable
std::stable_sort(v.begin(), v.end());     // Merge sort variant, stable

// Searching
std::binary_search(v.begin(), v.end(), target);  // Binary search
std::lower_bound(v.begin(), v.end(), target);     // First >= target

// Data structures
std::map<K,V>             // Red-black tree, O(log n)
std::unordered_map<K,V>   // Hash table, O(1) average
std::priority_queue<int>  // Binary heap (max-heap by default)
std::set<int>             // Red-black tree (sorted, unique)
```

### Go

```go
// Sorting
sort.Ints(slice)                    // Introsort, O(n log n)
sort.Slice(s, func(i, j int) bool { // Custom comparator
    return s[i] < s[j]
})

// Searching
sort.SearchInts(a, target)          // Binary search (sorted slice)
```

### Rust

```rust
// Sorting
vec.sort();               // Timsort variant, stable, O(n log n)
vec.sort_unstable();      // Pattern-defeating quicksort, unstable, faster

// Searching
vec.binary_search(&target);  // Binary search, returns Result<usize, usize>

// Data structures
use std::collections::{HashMap, HashSet, BTreeMap, BTreeSet, BinaryHeap, VecDeque};
// HashMap: hash table, O(1) average
// BTreeMap: B-tree, O(log n), sorted keys
// BinaryHeap: max-heap
```

---

## How to Study Algorithms Effectively

### For Beginners

1. **Start with sorting and searching** -- they teach fundamental paradigms
2. **Implement from scratch** -- do not just read; write code and test it
3. **Trace by hand** -- walk through examples on paper before coding
4. **Use visualizations** -- sites like VisuAlgo, Algorithm Visualizer
5. **Start with Python or JavaScript** -- focus on logic, not syntax

### For Intermediate Learners

1. **Solve problems on LeetCode, Codeforces, HackerRank** -- practice is essential
2. **Study CLRS or Skiena** -- formal treatment builds deep understanding
3. **Learn to prove correctness** -- loop invariants, induction
4. **Master complexity analysis** -- be able to derive Big O for any code
5. **Study multiple paradigms** -- D&C, DP, greedy, backtracking

### For Advanced Learners

1. **Read research papers** -- stay current with algorithmic advances
2. **Study NP-completeness and reductions** -- understand problem hardness
3. **Learn approximation and randomized algorithms** -- practical for hard problems
4. **Competitive programming** -- ICPC, Google Code Jam, Codeforces Div. 1
5. **Contribute to open-source** -- implement algorithms in real systems

---

## Key Takeaways

```
  1. An algorithm is a finite, correct, terminating procedure for a class of problems.

  2. Algorithm choice matters MORE than hardware -- O(n log n) vs O(n^2) is the
     difference between seconds and hours.

  3. Classify algorithms by paradigm (D&C, DP, greedy), problem type (sort, search,
     graph), and characteristics (online/offline, exact/approximate).

  4. Follow the design process: understand -> choose paradigm -> design ->
     prove -> analyze -> implement -> optimize.

  5. Use standard library algorithms when available; they are tested, optimized,
     and correct.

  6. Study algorithms actively: implement, trace, prove, and practice on problems.
```

---

## Related Topics

- [Complexity Analysis & Big O](../../02-complexity-analysis/complexity-and-big-o/complexity-and-big-o.md)
- [Recursion Fundamentals](../../03-recursion/recursion-fundamentals/recursion-fundamentals.md)
- [Sorting Algorithms](../../04-sorting/)
- [Searching Algorithms](../../05-searching/)
- [Graph Algorithms](../../06-graph-algorithms/)
- [Dynamic Programming](../../07-dynamic-programming/)
- [Greedy Algorithms](../../08-greedy/)
- [Divide and Conquer](../../09-divide-and-conquer/)

---

## Sources

1. **Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C.** (2022). *Introduction to Algorithms* (4th ed.). MIT Press. (CLRS -- the definitive algorithms textbook)
2. **Sedgewick, R., & Wayne, K.** (2011). *Algorithms* (4th ed.). Addison-Wesley. (Excellent Java-based treatment)
3. **Skiena, S. S.** (2020). *The Algorithm Design Manual* (3rd ed.). Springer. (Practical focus with war stories)
4. **Knuth, D. E.** (1997-2011). *The Art of Computer Programming*, Volumes 1-4A. Addison-Wesley. (TAOCP -- encyclopedic reference)
5. **Kleinberg, J., & Tardos, E.** (2005). *Algorithm Design*. Addison-Wesley. (Excellent for paradigm-based teaching)
6. **Dasgupta, S., Papadimitriou, C., & Vazirani, U.** (2006). *Algorithms*. McGraw-Hill. (Concise and mathematical)
7. **Wikipedia** -- "Algorithm," "Computational complexity theory," "List of algorithms." https://en.wikipedia.org/wiki/Algorithm
8. **VisuAlgo** -- Algorithm visualization: https://visualgo.net/
