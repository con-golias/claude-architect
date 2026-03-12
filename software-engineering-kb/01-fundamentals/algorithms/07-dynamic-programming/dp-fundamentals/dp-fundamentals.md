# Dynamic Programming — Fundamentals

| Domain | Difficulty | Last Updated |
|---|---|---|
| Fundamentals > Algorithms > Dynamic Programming | Advanced | 2026-03-07 |

---

## What It Is

**Dynamic Programming (DP)** solves problems by breaking them into **overlapping subproblems** and
**storing solutions** (in a table or cache) to avoid redundant computation. The term was coined by
**Richard Bellman** in the 1950s while working at RAND Corporation. Bellman chose the name "dynamic
programming" partly to hide the mathematical nature of his work from a Secretary of Defense who was
hostile to research.

DP requires two fundamental properties:

1. **Optimal Substructure** — An optimal solution to the problem contains optimal solutions to its
   subproblems. For example, the shortest path from A to C through B contains the shortest path
   from A to B and the shortest path from B to C.

2. **Overlapping Subproblems** — The same subproblems are solved repeatedly. Unlike Divide and
   Conquer (where subproblems are independent), DP subproblems share work. For example, computing
   `fib(5)` requires `fib(3)` twice in a naive recursive approach.

```
Naive Fibonacci Recursion Tree (Exponential — many repeated calls):

                         fib(5)
                       /        \
                  fib(4)          fib(3)
                 /     \         /     \
            fib(3)    fib(2)  fib(2)  fib(1)
           /    \     /   \    /   \
       fib(2) fib(1) fib(1) fib(0) fib(1) fib(0)
       /   \
   fib(1) fib(0)

   fib(3) is computed 2 times
   fib(2) is computed 3 times
   fib(1) is computed 5 times
   fib(0) is computed 3 times
   Total calls: 15      (grows exponentially — O(2^n))
```

With DP, each subproblem is solved **exactly once** and stored, reducing from O(2^n) to O(n).

---

## Two Approaches

### Top-Down (Memoization)

Start from the original problem, recurse into subproblems, and **cache** results as you go.
Think of it as "enhanced recursion with a lookup table."

- Pros: Natural recursive thinking, only solves needed subproblems (lazy evaluation)
- Cons: Recursion overhead, potential stack overflow for deep recursion

### Bottom-Up (Tabulation)

Start from the **smallest subproblems**, iteratively build up solutions in a table.
Think of it as "fill the table from the base case upward."

- Pros: No recursion overhead, no stack overflow, often cache-friendly
- Cons: Must determine computation order, may solve unneeded subproblems

### Fibonacci — All Three Approaches

**Python:**

```python
# ──────────────────────────────────────────
# Top-Down (Memoization)
# ──────────────────────────────────────────
def fib_memo(n: int, memo: dict = {}) -> int:
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib_memo(n - 1, memo) + fib_memo(n - 2, memo)
    return memo[n]

# ──────────────────────────────────────────
# Bottom-Up (Tabulation)
# ──────────────────────────────────────────
def fib_tab(n: int) -> int:
    if n <= 1:
        return n
    dp = [0] * (n + 1)
    dp[1] = 1
    for i in range(2, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]

# ──────────────────────────────────────────
# Space-Optimized Bottom-Up
# ──────────────────────────────────────────
def fib_opt(n: int) -> int:
    if n <= 1:
        return n
    prev2, prev1 = 0, 1
    for _ in range(2, n + 1):
        prev2, prev1 = prev1, prev2 + prev1
    return prev1
```

**TypeScript:**

```typescript
// ──────────────────────────────────────────
// Top-Down (Memoization)
// ──────────────────────────────────────────
function fibMemo(n: number, memo: Map<number, number> = new Map()): number {
    if (memo.has(n)) return memo.get(n)!;
    if (n <= 1) return n;
    const result = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
    memo.set(n, result);
    return result;
}

// ──────────────────────────────────────────
// Bottom-Up (Tabulation)
// ──────────────────────────────────────────
function fibTab(n: number): number {
    if (n <= 1) return n;
    const dp: number[] = new Array(n + 1).fill(0);
    dp[1] = 1;
    for (let i = 2; i <= n; i++) {
        dp[i] = dp[i - 1] + dp[i - 2];
    }
    return dp[n];
}

// ──────────────────────────────────────────
// Space-Optimized Bottom-Up
// ──────────────────────────────────────────
function fibOpt(n: number): number {
    if (n <= 1) return n;
    let prev2 = 0, prev1 = 1;
    for (let i = 2; i <= n; i++) {
        [prev2, prev1] = [prev1, prev2 + prev1];
    }
    return prev1;
}
```

```
Comparison of Approaches:

Approach         Time     Space    Stack Depth   When to Use
─────────────────────────────────────────────────────────────────
Top-Down         O(n)     O(n)     O(n)          Naturally recursive problems
Bottom-Up        O(n)     O(n)     O(1)          When you need all subproblems
Space-Optimized  O(n)     O(1)     O(1)          When you only need last few states
```

---

## Classic DP Problems

### 1. 0/1 Knapsack

**Problem:** Given `n` items, each with a weight `w[i]` and value `v[i]`, and a knapsack with
capacity `W`, find the maximum value you can carry. Each item is either taken or not (0/1).

**Recurrence:**
```
dp[i][w] = max(dp[i-1][w],                    // don't take item i
               dp[i-1][w - w[i]] + v[i])       // take item i (if w >= w[i])
```

**ASCII Table Trace** (items: [{w:1,v:1}, {w:3,v:4}, {w:4,v:5}, {w:5,v:7}], capacity=7):

```
          Capacity →
Item ↓    0    1    2    3    4    5    6    7
──────────────────────────────────────────────
  0       0    0    0    0    0    0    0    0
  1       0    1    1    1    1    1    1    1
  2       0    1    1    4    5    5    5    5
  3       0    1    1    4    5    6    6    9
  4       0    1    1    4    5    7    8    9

Answer: dp[4][7] = 9 (take items 2 and 4: weight=3+5=8? No!)
Actually: dp[4][7] = 9 (take items 2 and 3: weight=3+4=7, value=4+5=9)
```

**Python — 2D Table:**

```python
def knapsack_2d(weights: list[int], values: list[int], capacity: int) -> int:
    n = len(weights)
    dp = [[0] * (capacity + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        for w in range(capacity + 1):
            dp[i][w] = dp[i - 1][w]  # don't take item i
            if weights[i - 1] <= w:
                dp[i][w] = max(dp[i][w],
                               dp[i - 1][w - weights[i - 1]] + values[i - 1])
    return dp[n][capacity]

# Example
weights = [1, 3, 4, 5]
values  = [1, 4, 5, 7]
print(knapsack_2d(weights, values, 7))  # Output: 9
```

**Python — Space-Optimized 1D:**

```python
def knapsack_1d(weights: list[int], values: list[int], capacity: int) -> int:
    n = len(weights)
    dp = [0] * (capacity + 1)

    for i in range(n):
        # Traverse right-to-left to avoid using updated values
        for w in range(capacity, weights[i] - 1, -1):
            dp[w] = max(dp[w], dp[w - weights[i]] + values[i])
    return dp[capacity]
```

**TypeScript — 2D Table:**

```typescript
function knapsack2D(weights: number[], values: number[], capacity: number): number {
    const n = weights.length;
    const dp: number[][] = Array.from({ length: n + 1 },
        () => new Array(capacity + 1).fill(0));

    for (let i = 1; i <= n; i++) {
        for (let w = 0; w <= capacity; w++) {
            dp[i][w] = dp[i - 1][w];
            if (weights[i - 1] <= w) {
                dp[i][w] = Math.max(dp[i][w],
                    dp[i - 1][w - weights[i - 1]] + values[i - 1]);
            }
        }
    }
    return dp[n][capacity];
}
```

**TypeScript — Space-Optimized 1D:**

```typescript
function knapsack1D(weights: number[], values: number[], capacity: number): number {
    const dp = new Array(capacity + 1).fill(0);

    for (let i = 0; i < weights.length; i++) {
        for (let w = capacity; w >= weights[i]; w--) {
            dp[w] = Math.max(dp[w], dp[w - weights[i]] + values[i]);
        }
    }
    return dp[capacity];
}
```

**Complexity:** Time O(nW), Space O(nW) or O(W) optimized. This is **pseudo-polynomial** — polynomial
in the numeric value of W, not in the number of bits to represent it.

---

### 2. Longest Common Subsequence (LCS)

**Problem:** Find the longest subsequence common to two sequences.

**Recurrence:**
```
if X[i] == Y[j]:
    dp[i][j] = dp[i-1][j-1] + 1
else:
    dp[i][j] = max(dp[i-1][j], dp[i][j-1])
```

**Example:** X = "ABCBDAB", Y = "BDCAB" -> LCS = "BCAB" (length 4)

```
DP Table:

        ""   B   D   C   A   B
   ""    0   0   0   0   0   0
    A    0   0   0   0   1   1
    B    0   1   1   1   1   2
    C    0   1   1   2   2   2
    B    0   1   1   2   2   3
    D    0   1   2   2   2   3
    A    0   1   2   2   3   3
    B    0   1   2   2   3   4

Answer: dp[7][5] = 4, LCS = "BCAB"
```

**Python:**

```python
def lcs(x: str, y: str) -> tuple[int, str]:
    m, n = len(x), len(y)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    # Fill DP table
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if x[i - 1] == y[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

    # Reconstruct the LCS
    result = []
    i, j = m, n
    while i > 0 and j > 0:
        if x[i - 1] == y[j - 1]:
            result.append(x[i - 1])
            i -= 1
            j -= 1
        elif dp[i - 1][j] > dp[i][j - 1]:
            i -= 1
        else:
            j -= 1
    return dp[m][n], "".join(reversed(result))

length, subsequence = lcs("ABCBDAB", "BDCAB")
print(f"Length: {length}, LCS: {subsequence}")  # Length: 4, LCS: BCAB
```

**TypeScript:**

```typescript
function lcs(x: string, y: string): [number, string] {
    const m = x.length, n = y.length;
    const dp: number[][] = Array.from({ length: m + 1 },
        () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (x[i - 1] === y[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // Reconstruct
    const result: string[] = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
        if (x[i - 1] === y[j - 1]) {
            result.push(x[i - 1]);
            i--; j--;
        } else if (dp[i - 1][j] > dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }
    return [dp[m][n], result.reverse().join("")];
}
```

**Complexity:** Time O(mn), Space O(mn) or O(min(m,n)) with rolling array.

---

### 3. Edit Distance (Levenshtein Distance)

**Problem:** Find the minimum number of operations (insert, delete, replace) to transform one string
into another. Used in spell checkers, DNA sequence alignment, diff tools, and fuzzy matching.

**Recurrence:**
```
if X[i] == Y[j]:
    dp[i][j] = dp[i-1][j-1]           // characters match, no operation needed
else:
    dp[i][j] = 1 + min(
        dp[i-1][j],                     // delete from X
        dp[i][j-1],                     // insert into X
        dp[i-1][j-1]                    // replace in X
    )
```

**Example:** "kitten" -> "sitting" (edit distance = 3)

```
DP Table:

          ""   s   i   t   t   i   n   g
   ""      0   1   2   3   4   5   6   7
    k      1   1   2   3   4   5   6   7
    i      2   2   1   2   3   4   5   6
    t      3   3   2   1   2   3   4   5
    t      4   4   3   2   1   2   3   4
    e      5   5   4   3   2   2   3   4
    n      6   6   5   4   3   3   2   3

Answer: 3 (k->s replace, e->i replace, insert g)
```

**Python:**

```python
def edit_distance(word1: str, word2: str) -> int:
    m, n = len(word1), len(word2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    # Base cases: transforming from/to empty string
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if word1[i - 1] == word2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j],       # delete
                    dp[i][j - 1],       # insert
                    dp[i - 1][j - 1]    # replace
                )
    return dp[m][n]

print(edit_distance("kitten", "sitting"))  # Output: 3
```

**TypeScript:**

```typescript
function editDistance(word1: string, word2: string): number {
    const m = word1.length, n = word2.length;
    const dp: number[][] = Array.from({ length: m + 1 },
        () => new Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (word1[i - 1] === word2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],       // delete
                    dp[i][j - 1],       // insert
                    dp[i - 1][j - 1]    // replace
                );
            }
        }
    }
    return dp[m][n];
}
```

**Complexity:** Time O(mn), Space O(mn) or O(min(m,n)) optimized.

---

### 4. Coin Change

**Variant 1: Minimum number of coins** to make amount.

**Recurrence:** `dp[amount] = min(dp[amount - coin] + 1)` for each coin

**Variant 2: Number of ways** to make amount (order doesn't matter).

**Recurrence:** `dp[amount] += dp[amount - coin]` for each coin (iterate coins in outer loop)

**Python:**

```python
# Variant 1: Minimum number of coins
def coin_change_min(coins: list[int], amount: int) -> int:
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0

    for i in range(1, amount + 1):
        for coin in coins:
            if coin <= i and dp[i - coin] + 1 < dp[i]:
                dp[i] = dp[i - coin] + 1
    return dp[amount] if dp[amount] != float('inf') else -1

# Variant 2: Number of ways to make change
def coin_change_ways(coins: list[int], amount: int) -> int:
    dp = [0] * (amount + 1)
    dp[0] = 1

    for coin in coins:                   # coin in outer loop avoids counting permutations
        for i in range(coin, amount + 1):
            dp[i] += dp[i - coin]
    return dp[amount]

print(coin_change_min([1, 5, 10, 25], 30))   # Output: 2 (25 + 5)
print(coin_change_ways([1, 5, 10, 25], 30))  # Output: 18
```

**TypeScript:**

```typescript
// Variant 1: Minimum number of coins
function coinChangeMin(coins: number[], amount: number): number {
    const dp = new Array(amount + 1).fill(Infinity);
    dp[0] = 0;

    for (let i = 1; i <= amount; i++) {
        for (const coin of coins) {
            if (coin <= i && dp[i - coin] + 1 < dp[i]) {
                dp[i] = dp[i - coin] + 1;
            }
        }
    }
    return dp[amount] === Infinity ? -1 : dp[amount];
}

// Variant 2: Number of ways to make change
function coinChangeWays(coins: number[], amount: number): number {
    const dp = new Array(amount + 1).fill(0);
    dp[0] = 1;

    for (const coin of coins) {
        for (let i = coin; i <= amount; i++) {
            dp[i] += dp[i - coin];
        }
    }
    return dp[amount];
}
```

**Complexity:** Time O(amount * |coins|), Space O(amount).

---

### 5. Longest Increasing Subsequence (LIS)

**Problem:** Find the length of the longest strictly increasing subsequence.

**Approach 1: O(n^2) DP**

```
dp[i] = length of LIS ending at index i
dp[i] = max(dp[j] + 1) for all j < i where arr[j] < arr[i]
```

**Approach 2: O(n log n) with Patience Sorting / Binary Search**

Maintain a list `tails` where `tails[i]` is the smallest tail element of all increasing
subsequences of length `i+1`. Use binary search to update.

**Python:**

```python
# O(n^2) DP approach
def lis_dp(arr: list[int]) -> int:
    n = len(arr)
    if n == 0:
        return 0
    dp = [1] * n

    for i in range(1, n):
        for j in range(i):
            if arr[j] < arr[i]:
                dp[i] = max(dp[i], dp[j] + 1)
    return max(dp)

# O(n log n) Binary Search approach
import bisect

def lis_binary_search(arr: list[int]) -> int:
    tails = []
    for num in arr:
        pos = bisect.bisect_left(tails, num)
        if pos == len(tails):
            tails.append(num)       # extend longest subsequence
        else:
            tails[pos] = num        # replace with smaller tail
    return len(tails)

arr = [10, 9, 2, 5, 3, 7, 101, 18]
print(lis_dp(arr))              # Output: 4 ([2, 3, 7, 101] or [2, 5, 7, 101])
print(lis_binary_search(arr))   # Output: 4
```

**TypeScript:**

```typescript
// O(n^2) DP approach
function lisDp(arr: number[]): number {
    if (arr.length === 0) return 0;
    const dp = new Array(arr.length).fill(1);

    for (let i = 1; i < arr.length; i++) {
        for (let j = 0; j < i; j++) {
            if (arr[j] < arr[i]) {
                dp[i] = Math.max(dp[i], dp[j] + 1);
            }
        }
    }
    return Math.max(...dp);
}

// O(n log n) Binary Search approach
function lisBinarySearch(arr: number[]): number {
    const tails: number[] = [];

    for (const num of arr) {
        let lo = 0, hi = tails.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (tails[mid] < num) lo = mid + 1;
            else hi = mid;
        }
        if (lo === tails.length) tails.push(num);
        else tails[lo] = num;
    }
    return tails.length;
}
```

```
Trace of O(n log n) approach for [10, 9, 2, 5, 3, 7, 101, 18]:

Step  Element   tails           Action
──────────────────────────────────────────────────
1     10        [10]            append 10
2     9         [9]             replace 10 with 9
3     2         [2]             replace 9 with 2
4     5         [2, 5]          append 5
5     3         [2, 3]          replace 5 with 3
6     7         [2, 3, 7]       append 7
7     101       [2, 3, 7, 101]  append 101
8     18        [2, 3, 7, 18]   replace 101 with 18

Final tails length = 4, so LIS length = 4
Note: tails is NOT the actual LIS, just a working array.
```

---

### 6. Matrix Chain Multiplication

**Problem:** Given dimensions of n matrices, find the optimal way to parenthesize their product
to minimize total scalar multiplications. Matrix A(p x q) * B(q x r) costs p * q * r operations.

**Recurrence:**
```
dp[i][j] = min over k in [i, j-1] of:
    dp[i][k] + dp[k+1][j] + dims[i-1] * dims[k] * dims[j]
```

**Example:** Matrices A(10x30), B(30x5), C(5x60)
- (AB)C = 10*30*5 + 10*5*60 = 1500 + 3000 = 4500
- A(BC) = 30*5*60 + 10*30*60 = 9000 + 18000 = 27000
- Optimal: (AB)C with cost 4500

**Python:**

```python
def matrix_chain_order(dims: list[int]) -> tuple[int, str]:
    """dims[i-1] x dims[i] gives dimensions of matrix i."""
    n = len(dims) - 1  # number of matrices
    dp = [[0] * n for _ in range(n)]
    split = [[0] * n for _ in range(n)]

    # l = chain length
    for l in range(2, n + 1):
        for i in range(n - l + 1):
            j = i + l - 1
            dp[i][j] = float('inf')
            for k in range(i, j):
                cost = dp[i][k] + dp[k + 1][j] + dims[i] * dims[k + 1] * dims[j + 1]
                if cost < dp[i][j]:
                    dp[i][j] = cost
                    split[i][j] = k

    def build_parens(i: int, j: int) -> str:
        if i == j:
            return f"A{i + 1}"
        return f"({build_parens(i, split[i][j])} x {build_parens(split[i][j] + 1, j)})"

    return dp[0][n - 1], build_parens(0, n - 1)

dims = [10, 30, 5, 60]
cost, parens = matrix_chain_order(dims)
print(f"Minimum cost: {cost}")          # Output: 4500
print(f"Optimal order: {parens}")       # Output: ((A1 x A2) x A3)
```

**TypeScript:**

```typescript
function matrixChainOrder(dims: number[]): [number, string] {
    const n = dims.length - 1;
    const dp: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const split: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let l = 2; l <= n; l++) {
        for (let i = 0; i <= n - l; i++) {
            const j = i + l - 1;
            dp[i][j] = Infinity;
            for (let k = i; k < j; k++) {
                const cost = dp[i][k] + dp[k + 1][j] + dims[i] * dims[k + 1] * dims[j + 1];
                if (cost < dp[i][j]) {
                    dp[i][j] = cost;
                    split[i][j] = k;
                }
            }
        }
    }

    function buildParens(i: number, j: number): string {
        if (i === j) return `A${i + 1}`;
        return `(${buildParens(i, split[i][j])} x ${buildParens(split[i][j] + 1, j)})`;
    }

    return [dp[0][n - 1], buildParens(0, n - 1)];
}
```

**Complexity:** Time O(n^3), Space O(n^2).

---

## How to Identify DP Problems

Ask yourself these questions:

1. **Can the problem be divided into subproblems?**
   If the problem can be expressed in terms of smaller instances of itself, DP may apply.

2. **Are subproblems overlapping?**
   If the same subproblem is solved more than once in a naive recursive solution, DP will help.
   (If subproblems are independent, Divide and Conquer is more appropriate.)

3. **Does the problem have optimal substructure?**
   Is the optimal solution to the whole problem built from optimal solutions to subproblems?

4. **Look for keywords in the problem statement:**
   - "minimum cost" / "maximum profit" / "maximum value"
   - "number of ways" / "count the paths"
   - "is it possible" / "can you reach"
   - "longest" / "shortest" subsequence, subarray, path

5. **Can you define a clear recurrence relation?**
   If you can write `dp[i] = f(dp[smaller states])`, you have a DP problem.

```
Decision Flowchart:

    Can you break it into subproblems?
        │
        ├── No  → Not DP (try brute force or other)
        │
        └── Yes → Do subproblems overlap?
                    │
                    ├── No  → Divide and Conquer
                    │
                    └── Yes → Does it have optimal substructure?
                                │
                                ├── No  → Not DP (try other approaches)
                                │
                                └── Yes → Does greedy work?
                                            │
                                            ├── Yes → Use Greedy (simpler)
                                            │
                                            └── No  → Use DP
```

---

## DP on Different Structures

### DP on Strings
Problems involving one or two strings: LCS, Edit Distance, Palindrome Subsequence,
Regular Expression Matching, Wildcard Matching. Typically 2D DP with `dp[i][j]`.

### DP on Grids
Problems on 2D grids: minimum path sum, unique paths, dungeon game.
`dp[i][j]` depends on `dp[i-1][j]` and `dp[i][j-1]` (and sometimes `dp[i-1][j-1]`).

### DP on Trees
Problems on tree structures: tree diameter, maximum path sum, number of subtrees.
Typically solved with DFS, computing DP values bottom-up from leaves to root.

### DP on DAGs
Any DP can be viewed as shortest/longest path on a DAG of states.
Topological sort + relaxation is equivalent to bottom-up DP.

---

## Common DP Patterns

### 1. Linear DP (1D array)
State: `dp[i]` depends on previous elements.
Examples: Fibonacci, LIS, Coin Change, House Robber.

### 2. Grid DP (2D array)
State: `dp[i][j]` on a grid or two sequences.
Examples: LCS, Edit Distance, Unique Paths, Minimum Path Sum.

### 3. Interval DP
State: `dp[i][j]` represents a contiguous interval [i, j].
Fill order: by increasing interval length.
Examples: Matrix Chain Multiplication, Burst Balloons, Palindrome Partitioning.

### 4. Knapsack Variants
| Variant | Item Use | Inner Loop Direction |
|---|---|---|
| 0/1 Knapsack | At most once | Right to left |
| Unbounded Knapsack | Unlimited | Left to right |
| Bounded Knapsack | Limited count | Binary representation trick |

### 5. Bitmask DP
State: `dp[mask]` where `mask` is a bitmask representing a subset.
Used when n is small (n <= 20) and we need to track subset membership.
Examples: Traveling Salesman (dp[mask][i]), Assignment Problem.

### 6. Digit DP
Count numbers in range [L, R] satisfying some property.
State tracks: position, tight constraint, and problem-specific info.
Examples: Count numbers with no repeated digits, sum of digits equals k.

---

## Space Optimization — Rolling Array Technique

When `dp[i]` only depends on `dp[i-1]`, we can reduce a 2D table to two 1D arrays
(or even one array with careful traversal order).

```python
# LCS with space optimization: O(mn) -> O(min(m,n))
def lcs_optimized(x: str, y: str) -> int:
    if len(x) < len(y):
        x, y = y, x  # ensure y is shorter
    m, n = len(x), len(y)
    prev = [0] * (n + 1)
    curr = [0] * (n + 1)

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if x[i - 1] == y[j - 1]:
                curr[j] = prev[j - 1] + 1
            else:
                curr[j] = max(prev[j], curr[j - 1])
        prev, curr = curr, [0] * (n + 1)
    return prev[n]
```

```
Rolling Array Visualization:

  Full 2D table:              Rolling array (2 rows):
  ┌──────────────┐            ┌──────────────┐
  │ row 0        │            │ prev (row i-1)│
  │ row 1        │   ──→      │ curr (row i)  │
  │ row 2        │            └──────────────┘
  │ ...          │            After each row:
  │ row m        │            prev ← curr
  └──────────────┘            curr ← new zeros
```

---

## DP vs Greedy vs Divide and Conquer

```
Feature           Dynamic Programming        Greedy                    Divide & Conquer
──────────────────────────────────────────────────────────────────────────────────────────
Subproblems       Overlapping                 Single remaining          Independent
Approach          Try all, pick best          Pick locally best         Split, solve, merge
Optimality        Always (if applicable)      Only with greedy property Always
Time              Usually polynomial          Usually faster            O(n log n) typical
Space             Table (O(n), O(n^2), etc.)  O(1) or O(n)             O(log n) stack
Examples          Knapsack, LCS, Edit Dist    Activity Select, Huffman  Merge Sort, FFT
When to use       Overlapping + optimal sub   Greedy-choice property    Independent subprobs
```

---

## Practical Tips

1. **Start with the recurrence.** Write the mathematical recurrence before coding.
2. **Define the state clearly.** What does `dp[i]` (or `dp[i][j]`) represent?
3. **Determine the base cases.** What are the trivially solvable subproblems?
4. **Figure out the transition order.** Bottom-up requires filling states in dependency order.
5. **Optimize space if needed.** Check if you can drop old states (rolling array).
6. **Watch for off-by-one errors.** DP indexing is a common source of bugs.
7. **Print the DP table** during debugging to verify correctness.

---

## Sources

- **Bellman, R.** (1957). *Dynamic Programming*. Princeton University Press. The foundational text.
- **Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C.** *Introduction to Algorithms*
  (CLRS), Chapter 15: Dynamic Programming.
- **Skiena, S. S.** *The Algorithm Design Manual*, Chapter 8: Dynamic Programming.
- **Dasgupta, S., Papadimitriou, C., & Vazirani, U.** *Algorithms*, Chapter 6: Dynamic Programming.
- **Wikipedia** — Dynamic Programming: https://en.wikipedia.org/wiki/Dynamic_programming
- **LeetCode** — Dynamic Programming problem set for practice:
  https://leetcode.com/tag/dynamic-programming/
