# Greedy Algorithms — Fundamentals

| Domain | Difficulty | Last Updated |
|---|---|---|
| Fundamentals > Algorithms > Greedy | Intermediate | 2026-03-07 |

---

## What It Is

A **greedy algorithm** makes the **locally optimal choice** at each step with the hope of finding
a **global optimum**. Unlike dynamic programming, which considers all possible subproblem
combinations, a greedy algorithm commits to a single choice at each step and never reconsiders.

Greedy algorithms work when a problem has two key properties:

1. **Greedy-Choice Property** — A globally optimal solution can be arrived at by making locally
   optimal (greedy) choices. The choice made at each step does not depend on future choices or
   solutions to subproblems.

2. **Optimal Substructure** — An optimal solution to the problem contains optimal solutions to
   its subproblems (shared with DP).

The critical challenge with greedy algorithms is **proving correctness**. Just because a greedy
strategy seems intuitive does not mean it produces optimal results. Many problems that look
amenable to greedy solutions actually require dynamic programming.

```
Greedy Algorithm Flow:

    ┌─────────────────┐
    │  Problem Input   │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Sort / Preprocess│  ← Most greedy algorithms start with sorting
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐     ┌──────────────────┐
    │  Select best     │────▶│ Add to solution   │
    │  available choice│     │ if feasible       │
    └────────┬────────┘     └──────────────────┘
             │
             ▼
       More choices?
        │         │
       Yes        No
        │         │
        ▼         ▼
    (loop back)  Output solution
```

---

## When Greedy Works vs When It Fails

### Problems Where Greedy Works:
| Problem | Why Greedy Works |
|---|---|
| Activity Selection | Choosing earliest end time leaves most room |
| Huffman Coding | Merging lowest frequencies first is provably optimal |
| Dijkstra's Algorithm | Shortest known distance is final (non-negative weights) |
| Kruskal's / Prim's MST | Lightest safe edge is always in some MST |
| Fractional Knapsack | Taking best value/weight ratio is optimal for fractions |

### Problems Where Greedy Fails:
| Problem | Why Greedy Fails |
|---|---|
| 0/1 Knapsack | Can't take fractions; greedy by ratio misses better combos |
| Traveling Salesman | Nearest neighbor heuristic can give poor tours |
| Shortest Path (neg. weights) | Dijkstra fails; need Bellman-Ford (DP) |
| Coin Change (non-canonical) | Greedy doesn't find minimum coins for all coin systems |

### Concrete Counterexample: Greedy Fails for 0/1 Knapsack

```
Items:    Weight   Value   Ratio (v/w)
  A        10       60      6.0   ← Greedy picks this first
  B         20      100      5.0   ← Greedy picks this second
  C         30      120      4.0

Knapsack capacity = 50

Greedy (by ratio): Take A (w=10, v=60) + B (w=20, v=100) = total value 160, weight 30
                   C doesn't fit? Actually C fits (30+30=60 > 50). No.
                   Remaining capacity = 20. C needs 30. Can't take.
                   Greedy result: value = 160

Optimal:           Take B (w=20, v=100) + C (w=30, v=120) = total value 220, weight 50
                   Optimal result: value = 220

Greedy gave 160 instead of 220!
The high-ratio item A consumed capacity needed for the better combination B+C.
```

---

## Classic Greedy Problems

### 1. Activity Selection / Interval Scheduling

**Problem:** Given `n` activities with start times `s[i]` and finish times `f[i]`, select the
**maximum number of non-overlapping activities**.

**Greedy Strategy:** Sort by finish time. Always pick the activity that finishes earliest
(and doesn't conflict with the previously selected activity).

**Why it works:** By picking the earliest-finishing activity, we leave the most room for
subsequent activities.

**Proof of Correctness (Exchange Argument):**
Suppose the greedy solution selects activities G = {g1, g2, ..., gk} and an optimal solution
selects O = {o1, o2, ..., om} where m > k. Consider the first activity where G and O differ.
Since g finishes no later than o (greedy picks earliest), we can replace o with g in the
optimal solution without creating conflicts. Therefore |G| >= |O|, so greedy is optimal.

**Proof of Correctness (Greedy Stays Ahead):**
By induction, after selecting i activities, the greedy solution's i-th activity finishes no
later than the i-th activity of any valid solution. Therefore greedy can always select at
least as many activities as any other solution.

**Python:**

```python
def activity_selection(activities: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Select maximum non-overlapping activities.
    Each activity is (start_time, end_time).
    """
    # Sort by finish time
    sorted_acts = sorted(activities, key=lambda x: x[1])
    selected = [sorted_acts[0]]

    for i in range(1, len(sorted_acts)):
        # If this activity starts after (or when) the last selected one finishes
        if sorted_acts[i][0] >= selected[-1][1]:
            selected.append(sorted_acts[i])

    return selected

# Example
activities = [(1, 4), (3, 5), (0, 6), (5, 7), (3, 9), (5, 9),
              (6, 10), (8, 11), (8, 12), (2, 14), (12, 16)]
result = activity_selection(activities)
print(f"Selected {len(result)} activities: {result}")
# Selected 4 activities: [(1, 4), (5, 7), (8, 11), (12, 16)]
```

**TypeScript:**

```typescript
function activitySelection(activities: [number, number][]): [number, number][] {
    const sorted = [...activities].sort((a, b) => a[1] - b[1]);
    const selected: [number, number][] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i][0] >= selected[selected.length - 1][1]) {
            selected.push(sorted[i]);
        }
    }
    return selected;
}

const activities: [number, number][] = [
    [1, 4], [3, 5], [0, 6], [5, 7], [3, 9], [5, 9],
    [6, 10], [8, 11], [8, 12], [2, 14], [12, 16]
];
console.log(activitySelection(activities));
// [[1,4], [5,7], [8,11], [12,16]]
```

**Complexity:** Time O(n log n) for sorting + O(n) scan = O(n log n). Space O(1) extra.

```
Activity Selection Trace:

Time:  0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16
       │──────────────│                                      (1,4)  ← PICK
       │     │──────────│                                    (3,5)  ← skip (conflicts)
       │──────────────────────│                              (0,6)  ← skip
                     │──────────│                            (5,7)  ← PICK
                  │──────────────────│                       (3,9)  ← skip
                     │──────────────────│                    (5,9)  ← skip
                        │────────────────│                   (6,10) ← skip
                              │────────────│                 (8,11) ← PICK
                              │──────────────│               (8,12) ← skip
          │──────────────────────────────────────│           (2,14) ← skip
                                          │──────────│      (12,16)← PICK

Selected: (1,4), (5,7), (8,11), (12,16) → 4 activities
```

---

### 2. Huffman Coding

**Problem:** Given character frequencies, build an optimal **prefix-free binary code** that
minimizes the total encoded length. More frequent characters get shorter codes.

**Greedy Strategy:** Repeatedly merge the two nodes with the **lowest frequencies** to build
a binary tree bottom-up.

```
Example: Characters with frequencies
  a:5  b:9  c:12  d:13  e:16  f:45

Huffman Tree Construction:

Step 1: Merge a(5) + b(9) = 14          Step 2: Merge c(12) + d(13) = 25
        14                                       25
       /  \                                     /  \
      a:5  b:9                                c:12  d:13

Step 3: Merge 14 + e(16) = 30           Step 4: Merge 25 + 30 = 55
        30                                       55
       /  \                                     /  \
     14    e:16                               25    30
    /  \                                     /  \  /  \
  a:5  b:9                               c:12 d:13 14 e:16
                                                      /  \
                                                    a:5  b:9

Step 5: Merge f(45) + 55 = 100
              100
             /   \
           f:45   55
                 /  \
               25    30
              /  \  /  \
           c:12 d:13 14 e:16
                        /  \
                      a:5  b:9

Huffman Codes:
  f: 0        (1 bit)
  c: 100      (3 bits)
  d: 101      (3 bits)
  a: 1100     (4 bits)
  b: 1101     (4 bits)
  e: 111      (3 bits)

Total cost = 5*4 + 9*4 + 12*3 + 13*3 + 16*3 + 45*1 = 224 bits
Fixed-length (3 bits each) = (5+9+12+13+16+45)*3 = 300 bits
Savings: 25.3%
```

**Python:**

```python
import heapq
from collections import Counter

class HuffmanNode:
    def __init__(self, char: str | None, freq: int,
                 left: 'HuffmanNode | None' = None,
                 right: 'HuffmanNode | None' = None):
        self.char = char
        self.freq = freq
        self.left = left
        self.right = right

    def __lt__(self, other):
        return self.freq < other.freq

def build_huffman_tree(text: str) -> HuffmanNode:
    freq = Counter(text)
    heap = [HuffmanNode(char, f) for char, f in freq.items()]
    heapq.heapify(heap)

    while len(heap) > 1:
        left = heapq.heappop(heap)
        right = heapq.heappop(heap)
        merged = HuffmanNode(None, left.freq + right.freq, left, right)
        heapq.heappush(heap, merged)

    return heap[0]

def build_codes(node: HuffmanNode, prefix: str = "",
                codes: dict = None) -> dict[str, str]:
    if codes is None:
        codes = {}
    if node.char is not None:
        codes[node.char] = prefix or "0"  # handle single-char case
        return codes
    build_codes(node.left, prefix + "0", codes)
    build_codes(node.right, prefix + "1", codes)
    return codes

def huffman_encode(text: str) -> tuple[str, dict[str, str]]:
    tree = build_huffman_tree(text)
    codes = build_codes(tree)
    encoded = "".join(codes[c] for c in text)
    return encoded, codes

def huffman_decode(encoded: str, tree: HuffmanNode) -> str:
    result = []
    node = tree
    for bit in encoded:
        node = node.left if bit == "0" else node.right
        if node.char is not None:
            result.append(node.char)
            node = tree
    return "".join(result)

# Example
text = "aaaaabbbbbbbbbccccccccccccdddddddddddddeeeeeeeeeeeeeeee" + "f" * 45
tree = build_huffman_tree(text)
encoded, codes = huffman_encode(text)
decoded = huffman_decode(encoded, tree)
print(f"Codes: {codes}")
print(f"Original bits: {len(text) * 8}")
print(f"Encoded bits:  {len(encoded)}")
print(f"Decoded matches: {decoded == text}")
```

**TypeScript:**

```typescript
class HuffmanNode {
    char: string | null;
    freq: number;
    left: HuffmanNode | null;
    right: HuffmanNode | null;

    constructor(char: string | null, freq: number,
                left: HuffmanNode | null = null,
                right: HuffmanNode | null = null) {
        this.char = char;
        this.freq = freq;
        this.left = left;
        this.right = right;
    }
}

function buildHuffmanTree(text: string): HuffmanNode {
    const freq = new Map<string, number>();
    for (const c of text) freq.set(c, (freq.get(c) || 0) + 1);

    // Simple priority queue using sorted array (use a proper min-heap in production)
    const nodes: HuffmanNode[] = [];
    for (const [char, f] of freq) nodes.push(new HuffmanNode(char, f));
    nodes.sort((a, b) => a.freq - b.freq);

    while (nodes.length > 1) {
        const left = nodes.shift()!;
        const right = nodes.shift()!;
        const merged = new HuffmanNode(null, left.freq + right.freq, left, right);
        // Insert in sorted position
        const idx = nodes.findIndex(n => n.freq > merged.freq);
        if (idx === -1) nodes.push(merged);
        else nodes.splice(idx, 0, merged);
    }
    return nodes[0];
}

function buildCodes(node: HuffmanNode, prefix = "",
                    codes = new Map<string, string>()): Map<string, string> {
    if (node.char !== null) {
        codes.set(node.char, prefix || "0");
        return codes;
    }
    if (node.left) buildCodes(node.left, prefix + "0", codes);
    if (node.right) buildCodes(node.right, prefix + "1", codes);
    return codes;
}

function huffmanEncode(text: string): [string, Map<string, string>] {
    const tree = buildHuffmanTree(text);
    const codes = buildCodes(tree);
    const encoded = [...text].map(c => codes.get(c)!).join("");
    return [encoded, codes];
}

function huffmanDecode(encoded: string, tree: HuffmanNode): string {
    const result: string[] = [];
    let node = tree;
    for (const bit of encoded) {
        node = bit === "0" ? node.left! : node.right!;
        if (node.char !== null) {
            result.push(node.char);
            node = tree;
        }
    }
    return result.join("");
}
```

**Complexity:** Time O(n log n) with a min-heap. Space O(n) for the tree.

---

### 3. Fractional Knapsack

**Problem:** Given items with weights and values, and a knapsack with capacity W, maximize value.
Unlike 0/1 Knapsack, you **can take fractions** of items.

**Greedy Strategy:** Sort by **value-to-weight ratio** descending. Take as much as possible of each
item, starting from the highest ratio.

**Why it works:** Since we can take fractions, every unit of capacity should be used on the highest-
ratio item available.

**Python:**

```python
def fractional_knapsack(items: list[tuple[int, int]], capacity: int) -> float:
    """items: list of (weight, value) tuples."""
    # Sort by value/weight ratio descending
    sorted_items = sorted(items, key=lambda x: x[1] / x[0], reverse=True)
    total_value = 0.0
    remaining = capacity

    for weight, value in sorted_items:
        if remaining <= 0:
            break
        take = min(weight, remaining)
        total_value += take * (value / weight)
        remaining -= take

    return total_value

items = [(10, 60), (20, 100), (30, 120)]  # (weight, value)
print(fractional_knapsack(items, 50))  # Output: 240.0
# Take all of item 1 (v/w=6): value=60, capacity left=40
# Take all of item 2 (v/w=5): value=100, capacity left=20
# Take 2/3 of item 3 (v/w=4): value=80, capacity left=0
# Total: 60 + 100 + 80 = 240
```

**TypeScript:**

```typescript
function fractionalKnapsack(items: [number, number][], capacity: number): number {
    // Sort by value/weight ratio descending
    const sorted = [...items].sort((a, b) => (b[1] / b[0]) - (a[1] / a[0]));
    let totalValue = 0;
    let remaining = capacity;

    for (const [weight, value] of sorted) {
        if (remaining <= 0) break;
        const take = Math.min(weight, remaining);
        totalValue += take * (value / weight);
        remaining -= take;
    }
    return totalValue;
}

console.log(fractionalKnapsack([[10, 60], [20, 100], [30, 120]], 50)); // 240
```

**Complexity:** Time O(n log n). Space O(1) extra (or O(n) if we copy the array).

**Contrast with 0/1 Knapsack:** Greedy by ratio gives 240 for fractional, which is optimal.
For 0/1 with the same items and capacity 50, greedy gives 160 but optimal (DP) gives 220.
The ability to take fractions makes greedy work.

---

### 4. Job Scheduling with Deadlines

**Problem:** Given `n` jobs, each with a deadline `d[i]` and profit `p[i]`, schedule at most
one job per time slot to maximize total profit. Each job takes 1 unit of time.

**Greedy Strategy:** Sort by profit descending. For each job, place it in the latest available
time slot before its deadline.

**Python:**

```python
def job_scheduling(jobs: list[tuple[str, int, int]]) -> tuple[int, list[str]]:
    """jobs: list of (job_id, deadline, profit)."""
    # Sort by profit descending
    sorted_jobs = sorted(jobs, key=lambda x: x[2], reverse=True)

    max_deadline = max(j[1] for j in sorted_jobs)
    slots = [None] * (max_deadline + 1)  # slots[1..max_deadline]
    total_profit = 0
    scheduled = []

    for job_id, deadline, profit in sorted_jobs:
        # Find latest available slot <= deadline
        for t in range(min(deadline, max_deadline), 0, -1):
            if slots[t] is None:
                slots[t] = job_id
                total_profit += profit
                scheduled.append(job_id)
                break

    return total_profit, scheduled

jobs = [("J1", 2, 100), ("J2", 1, 19), ("J3", 2, 27),
        ("J4", 1, 25), ("J5", 3, 15)]
profit, schedule = job_scheduling(jobs)
print(f"Profit: {profit}, Schedule: {schedule}")
# Profit: 142, Schedule: ['J1', 'J3', 'J5']
# J1 in slot 2 (deadline 2), J3 in slot 1 (deadline 2), J5 in slot 3 (deadline 3)
```

**TypeScript:**

```typescript
function jobScheduling(jobs: [string, number, number][]): [number, string[]] {
    const sorted = [...jobs].sort((a, b) => b[2] - a[2]);
    const maxDeadline = Math.max(...sorted.map(j => j[1]));
    const slots: (string | null)[] = new Array(maxDeadline + 1).fill(null);
    let totalProfit = 0;
    const scheduled: string[] = [];

    for (const [jobId, deadline, profit] of sorted) {
        for (let t = Math.min(deadline, maxDeadline); t > 0; t--) {
            if (slots[t] === null) {
                slots[t] = jobId;
                totalProfit += profit;
                scheduled.push(jobId);
                break;
            }
        }
    }
    return [totalProfit, scheduled];
}
```

**Complexity:** Time O(n^2) naive, O(n log n) with Union-Find for slot management. Space O(n).

---

### 5. Minimum Number of Platforms / Meeting Rooms

**Problem:** Given arrival and departure times of trains (or meetings), find the minimum number
of platforms (or rooms) needed so that no two overlap.

**Greedy Strategy:** Separate arrivals and departures, sort both. Sweep through events: each
arrival needs a platform, each departure frees one.

**Python:**

```python
def min_platforms(arrivals: list[int], departures: list[int]) -> int:
    arrivals_sorted = sorted(arrivals)
    departures_sorted = sorted(departures)

    platforms_needed = 0
    max_platforms = 0
    i = j = 0

    while i < len(arrivals_sorted):
        if arrivals_sorted[i] <= departures_sorted[j]:
            platforms_needed += 1
            max_platforms = max(max_platforms, platforms_needed)
            i += 1
        else:
            platforms_needed -= 1
            j += 1

    return max_platforms

# Alternative: event-based approach
def min_platforms_events(arrivals: list[int], departures: list[int]) -> int:
    events = []
    for a in arrivals:
        events.append((a, 1))      # arrival: +1
    for d in departures:
        events.append((d + 1, -1))  # departure: -1 (after the time slot)
    events.sort()

    current = 0
    max_needed = 0
    for _, delta in events:
        current += delta
        max_needed = max(max_needed, current)
    return max_needed

arrivals   = [900, 940, 950, 1100, 1500, 1800]
departures = [910, 1200, 1120, 1130, 1900, 2000]
print(min_platforms(arrivals, departures))  # Output: 3
```

**TypeScript:**

```typescript
function minPlatforms(arrivals: number[], departures: number[]): number {
    const arr = [...arrivals].sort((a, b) => a - b);
    const dep = [...departures].sort((a, b) => a - b);

    let platforms = 0, maxPlatforms = 0;
    let i = 0, j = 0;

    while (i < arr.length) {
        if (arr[i] <= dep[j]) {
            platforms++;
            maxPlatforms = Math.max(maxPlatforms, platforms);
            i++;
        } else {
            platforms--;
            j++;
        }
    }
    return maxPlatforms;
}

console.log(minPlatforms(
    [900, 940, 950, 1100, 1500, 1800],
    [910, 1200, 1120, 1130, 1900, 2000]
)); // 3
```

**Complexity:** Time O(n log n). Space O(n) for sorted copies.

```
Platform Allocation Trace:

Time:  900  910  940  950  1100  1120  1130  1200  1500  1800  1900  2000
       ├──────┤                                                           Train 1
            ├──────────────────────────────────────┤                       Train 2
                 ├────────────────────┤                                    Train 3
                          ├──────────────┤                                Train 4
                                                    ├─────────────┤      Train 5
                                                          ├─────────────┤ Train 6

At time 1100: Trains 2, 3, and 4 are all at the station → 3 platforms needed
```

---

### 6. Coin Change (Greedy Version)

**When Greedy Works:** For **canonical coin systems** (like US coins: 1, 5, 10, 25), greedy
always produces the minimum number of coins.

**When Greedy Fails:** For non-canonical coin systems.

**Python:**

```python
def coin_change_greedy(coins: list[int], amount: int) -> list[int]:
    """Greedy coin change — works only for canonical coin systems!"""
    coins_sorted = sorted(coins, reverse=True)
    result = []

    for coin in coins_sorted:
        while amount >= coin:
            result.append(coin)
            amount -= coin

    return result if amount == 0 else []  # empty if impossible

# Works for US coins
print(coin_change_greedy([1, 5, 10, 25], 41))
# [25, 10, 5, 1] → 4 coins (optimal)

# FAILS for non-canonical coins
print(coin_change_greedy([1, 3, 4], 6))
# [4, 1, 1] → 3 coins (NOT optimal!)
# Optimal: [3, 3] → 2 coins
```

**TypeScript:**

```typescript
function coinChangeGreedy(coins: number[], amount: number): number[] {
    const sorted = [...coins].sort((a, b) => b - a);
    const result: number[] = [];

    for (const coin of sorted) {
        while (amount >= coin) {
            result.push(coin);
            amount -= coin;
        }
    }
    return amount === 0 ? result : [];
}

console.log(coinChangeGreedy([1, 5, 10, 25], 41)); // [25, 10, 5, 1]
console.log(coinChangeGreedy([1, 3, 4], 6));        // [4, 1, 1] (suboptimal!)
```

```
Greedy Failure Example — Coins [1, 3, 4], Amount = 6:

Greedy approach:
  Pick 4 → remaining 2
  Pick 1 → remaining 1
  Pick 1 → remaining 0
  Result: [4, 1, 1] = 3 coins

Optimal (DP):
  Pick 3 → remaining 3
  Pick 3 → remaining 0
  Result: [3, 3] = 2 coins

Lesson: Greedy's local choice of "biggest coin first" misses the globally optimal solution.
```

---

## Proving Greedy Correctness

Two standard proof techniques:

### 1. Exchange Argument

Show that any optimal solution can be **transformed** into the greedy solution without worsening
it.

**Steps:**
1. Assume OPT is an optimal solution that differs from greedy solution G.
2. Find the first point where they differ.
3. Show you can "exchange" OPT's choice for G's choice without increasing cost.
4. Repeat until OPT = G, proving G is also optimal.

**Applied to Activity Selection:**
- Let G = {g1, g2, ..., gk} (greedy) and O = {o1, o2, ..., om} (optimal), sorted by finish time.
- At the first difference: g1 finishes no later than o1 (greedy picks earliest finish).
- Replace o1 with g1 in O. Since g1 finishes earlier, it can't create new conflicts.
- New solution O' has same size as O → still optimal.
- Repeat for remaining activities → O becomes G → G is optimal.

### 2. Greedy Stays Ahead

Show by **induction** that after each step, the greedy solution is **at least as good** as
any other partial solution.

**Steps:**
1. Define a measure of progress (e.g., number of activities selected so far).
2. Show that after the greedy's i-th selection, it's at least as good as the i-th selection
   of any other valid solution.
3. Conclude that the greedy solution is at least as large as any optimal solution.

**Applied to Activity Selection:**
- **Base case:** g1 finishes no later than o1 (greedy picks earliest finish).
- **Inductive step:** Assume f(gi) <= f(oi). Then gi+1 finishes earliest among activities
  starting after f(gi). Since f(gi) <= f(oi), the set of activities available to greedy is
  a superset of those available after oi. So f(gi+1) <= f(oi+1).
- **Conclusion:** Greedy selects at least as many activities as OPT.

---

## Greedy vs Dynamic Programming

```
Feature              Greedy                       Dynamic Programming
──────────────────────────────────────────────────────────────────────────
Choice strategy      Locally optimal, irrevocable  Considers all options
Subproblems          One remaining subproblem       Many overlapping subproblems
Proof required       Exchange argument / stays      Optimal substructure +
                     ahead                          overlapping subproblems
Typical speed        O(n log n)                     O(n^2) or O(n*W) etc.
Space                O(1) to O(n)                   O(n) to O(n^2)
Correctness          Only with greedy property      Always (if applicable)
Implementation       Usually simpler                Usually more complex
When to prefer       Problem has greedy property    Greedy doesn't work
```

### Decision Guide

```
Can the problem be solved greedily?
    │
    ├── Can you prove greedy-choice property?
    │     │
    │     ├── Yes → Use Greedy (simpler, faster)
    │     │
    │     └── No / Not sure
    │           │
    │           └── Does it have overlapping subproblems?
    │                 │
    │                 ├── Yes → Use Dynamic Programming
    │                 │
    │                 └── No  → Use Divide and Conquer or Brute Force
    │
    └── Common trap: "It seems greedy" ≠ "It IS greedy"
        Always verify with counterexamples or formal proof.
```

---

## More Greedy Algorithms (Brief)

### Dijkstra's Shortest Path
Greedy: always extend the shortest known distance. Works with non-negative edge weights.
Uses a priority queue. Time: O((V + E) log V) with binary heap.

### Kruskal's Minimum Spanning Tree
Greedy: sort edges by weight, add lightest edge that doesn't create a cycle.
Uses Union-Find for cycle detection. Time: O(E log E).

### Prim's Minimum Spanning Tree
Greedy: grow tree from a vertex, always add cheapest edge to a non-tree vertex.
Uses a priority queue. Time: O((V + E) log V).

### Interval Partitioning (Coloring)
Assign minimum number of resources to schedule all activities.
Greedy: sort by start time, assign to any available resource. Time: O(n log n).

---

## Common Pitfalls

1. **Assuming greedy works without proof.** Always verify with counterexamples.
2. **Wrong sorting criterion.** Activity selection: sort by end time, NOT start time or duration.
3. **Forgetting edge cases.** Empty input, single element, all conflicts.
4. **Confusing fractional and 0/1 variants.** Greedy works for fractional knapsack but NOT 0/1.
5. **Greedy coin change.** Only works for canonical coin systems. Always check with DP if unsure.

---

## Sources

- **Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C.** *Introduction to Algorithms*
  (CLRS), Chapter 16: Greedy Algorithms.
- **Huffman, D. A.** (1952). "A Method for the Construction of Minimum-Redundancy Codes."
  *Proceedings of the IRE*, 40(9), 1098-1101.
- **Skiena, S. S.** *The Algorithm Design Manual*, Chapter 8: Greedy Algorithms.
- **Dasgupta, S., Papadimitriou, C., & Vazirani, U.** *Algorithms*, Chapter 5: Greedy Algorithms.
- **Kleinberg, J. & Tardos, E.** *Algorithm Design*, Chapter 4: Greedy Algorithms.
- **Wikipedia** — Greedy Algorithm: https://en.wikipedia.org/wiki/Greedy_algorithm
