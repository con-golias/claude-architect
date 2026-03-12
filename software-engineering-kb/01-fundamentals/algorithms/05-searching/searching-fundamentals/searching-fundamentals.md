# Searching Algorithms

> **Domain**: Fundamentals > Algorithms > Searching
> **Difficulty**: Intermediate
> **Last Updated**: 2026-03-07

---

## What It Is

Searching algorithms find a target element within a data structure, or determine that it is absent. The choice of algorithm depends on:

- **Data structure**: Array, linked list, tree, hash table, graph
- **Sorted or unsorted**: Sorted data enables logarithmic search
- **Access pattern**: Random access (arrays) vs sequential access (linked lists)
- **Frequency of searches**: Amortized cost matters for repeated queries
- **Static vs dynamic data**: Whether elements are inserted/deleted between searches

The two fundamental approaches are:
1. **Linear scan** — check every element (no assumptions about data)
2. **Divide and conquer** — eliminate half the search space each step (requires sorted data)

---

## Linear Search

Linear Search (also called Sequential Search) examines each element in order until the target is found or the end of the collection is reached.

### Implementation (Python)

```python
def linear_search(arr: list, target) -> int:
    """
    Linear Search: O(n) time, O(1) space.
    Returns the index of target, or -1 if not found.
    """
    for i in range(len(arr)):
        if arr[i] == target:
            return i
    return -1
```

### Implementation (TypeScript)

```typescript
function linearSearch<T>(arr: T[], target: T): number {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] === target) {
            return i;
        }
    }
    return -1;
}
```

### Sentinel Linear Search

A small optimization that eliminates the bounds check (`i < n`) on each iteration by placing the target value at the end of the array as a "sentinel":

```python
def sentinel_linear_search(arr: list, target) -> int:
    """
    Sentinel Linear Search: eliminates one comparison per iteration.
    Slightly faster constant factor than standard linear search.
    """
    n = len(arr)
    if n == 0:
        return -1

    last = arr[n - 1]
    arr[n - 1] = target  # Place sentinel

    i = 0
    while arr[i] != target:
        i += 1

    arr[n - 1] = last  # Restore original value

    if i < n - 1 or arr[n - 1] == target:
        return i
    return -1
```

### When to Use Linear Search

- **Unsorted data**: No alternative without preprocessing.
- **Linked lists**: No random access, so binary search is impractical.
- **Small arrays**: For n < ~20, linear search can outperform binary search due to simplicity and cache effects.
- **One-time search**: Building a sorted structure or hash table is not worth the overhead for a single search.

### Complexity

| Case    | Time | Space |
|---------|------|-------|
| Best    | O(1) | O(1)  |
| Average | O(n) | O(1)  |
| Worst   | O(n) | O(1)  |

---

## Binary Search

Binary Search is the fundamental divide-and-conquer search algorithm. It works on **sorted arrays** by repeatedly dividing the search space in half.

### Core Idea

```
Given sorted array and target:
1. Look at the middle element.
2. If it equals the target, found!
3. If target < middle, search the left half.
4. If target > middle, search the right half.
5. Repeat until found or search space is empty.
```

### Implementation (Python) — Iterative

```python
def binary_search(arr: list, target) -> int:
    """
    Iterative Binary Search.
    Time: O(log n), Space: O(1)
    Returns index of target, or -1 if not found.
    """
    lo, hi = 0, len(arr) - 1

    while lo <= hi:
        mid = lo + (hi - lo) // 2  # Avoids integer overflow
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1

    return -1
```

### Implementation (Python) — Recursive

```python
def binary_search_recursive(arr: list, target, lo: int = 0, hi: int = None) -> int:
    """
    Recursive Binary Search.
    Time: O(log n), Space: O(log n) due to call stack.
    """
    if hi is None:
        hi = len(arr) - 1

    if lo > hi:
        return -1

    mid = lo + (hi - lo) // 2

    if arr[mid] == target:
        return mid
    elif arr[mid] < target:
        return binary_search_recursive(arr, target, mid + 1, hi)
    else:
        return binary_search_recursive(arr, target, lo, mid - 1)
```

### Implementation (TypeScript)

```typescript
function binarySearch(arr: number[], target: number): number {
    let lo = 0;
    let hi = arr.length - 1;

    while (lo <= hi) {
        const mid = lo + Math.floor((hi - lo) / 2);
        if (arr[mid] === target) {
            return mid;
        } else if (arr[mid] < target) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return -1;
}
```

### Implementation (Java)

```java
public class BinarySearch {
    public static int binarySearch(int[] arr, int target) {
        int lo = 0, hi = arr.length - 1;

        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;  // Prevents overflow

            if (arr[mid] == target) {
                return mid;
            } else if (arr[mid] < target) {
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return -1;
    }
}
```

### Implementation (C++)

```cpp
#include <vector>

int binarySearch(const std::vector<int>& arr, int target) {
    int lo = 0, hi = static_cast<int>(arr.size()) - 1;

    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;

        if (arr[mid] == target) {
            return mid;
        } else if (arr[mid] < target) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return -1;
}
```

### Implementation (Go)

```go
func binarySearch(arr []int, target int) int {
    lo, hi := 0, len(arr)-1

    for lo <= hi {
        mid := lo + (hi-lo)/2
        if arr[mid] == target {
            return mid
        } else if arr[mid] < target {
            lo = mid + 1
        } else {
            hi = mid - 1
        }
    }
    return -1
}
```

### ASCII Trace: Search for 23 in [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]

```
Array: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
Index:  0  1  2   3   4   5   6   7   8   9
Target: 23

Step 1: lo=0, hi=9, mid=4
  arr[4]=16 < 23 -> search right half
  [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
                  ^^mid
                      |--- search here ---|

Step 2: lo=5, hi=9, mid=7
  arr[7]=56 > 23 -> search left half
  [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
                                ^^mid
                      |-here-|

Step 3: lo=5, hi=6, mid=5
  arr[5]=23 == 23 -> FOUND at index 5!
  [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
                      ^^mid = target!

Result: index 5 (found in 3 comparisons instead of 6 for linear search)
```

### The Integer Overflow Bug

The classic formula `mid = (lo + hi) / 2` can overflow when `lo + hi` exceeds the maximum integer value. This bug existed in Java's `Arrays.binarySearch` for 9 years before being discovered by Joshua Bloch in 2006.

```
BUGGY:   mid = (lo + hi) / 2        // Overflow when lo + hi > INT_MAX
CORRECT: mid = lo + (hi - lo) / 2   // Safe: hi - lo never overflows
ALSO OK: mid = (lo + hi) >>> 1      // Unsigned right shift (Java)
```

In Python, this is not an issue because integers have arbitrary precision. But in Java, C++, Go, and TypeScript (when using 32-bit integers), this bug is real and critical.

---

## Binary Search Variants

### Lower Bound — First Occurrence of Target

```python
def lower_bound(arr: list, target) -> int:
    """
    Find the index of the FIRST occurrence of target.
    If target is not found, returns the insertion point
    (index where target would be inserted to maintain sorted order).
    Equivalent to C++ std::lower_bound and Python bisect.bisect_left.
    """
    lo, hi = 0, len(arr)

    while lo < hi:
        mid = lo + (hi - lo) // 2
        if arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid  # Don't skip mid — it might be the first occurrence

    return lo  # lo == hi == insertion point
```

### Upper Bound — Last Occurrence of Target

```python
def upper_bound(arr: list, target) -> int:
    """
    Find the index AFTER the last occurrence of target.
    Equivalent to C++ std::upper_bound and Python bisect.bisect_right.
    """
    lo, hi = 0, len(arr)

    while lo < hi:
        mid = lo + (hi - lo) // 2
        if arr[mid] <= target:
            lo = mid + 1
        else:
            hi = mid

    return lo


def find_last_occurrence(arr: list, target) -> int:
    """Find index of the last occurrence of target, or -1."""
    idx = upper_bound(arr, target) - 1
    if idx >= 0 and arr[idx] == target:
        return idx
    return -1
```

### Count Occurrences of Target

```python
def count_occurrences(arr: list, target) -> int:
    """Count how many times target appears in sorted array. O(log n)."""
    return upper_bound(arr, target) - lower_bound(arr, target)
```

### Finding Insertion Point

Python's `bisect` module provides this directly:

```python
import bisect

arr = [1, 3, 5, 7, 9]
# bisect_left: insert BEFORE existing equal elements
print(bisect.bisect_left(arr, 5))   # 2
# bisect_right: insert AFTER existing equal elements
print(bisect.bisect_right(arr, 5))  # 3

# Insert while maintaining sorted order
bisect.insort_left(arr, 4)
# arr is now [1, 3, 4, 5, 7, 9]
```

---

## Binary Search on Answer (Parametric Search)

One of the most powerful applications of binary search is searching over the **answer space** rather than an array. If you can frame a problem as "is answer X feasible?" and the feasibility is monotonic (once feasible, stays feasible), you can binary search for the optimal answer.

### Template

```python
def binary_search_on_answer(lo: int, hi: int) -> int:
    """
    Find the minimum value x in [lo, hi] such that is_feasible(x) is True.
    Assumption: if is_feasible(x) is True, then is_feasible(x+1) is also True.
    """
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if is_feasible(mid):
            hi = mid      # mid might be the answer, search lower
        else:
            lo = mid + 1  # mid is too small
    return lo
```

### Example: Minimum Capacity to Ship Packages Within D Days

Given weights of packages and D days, find the minimum ship capacity to ship all packages within D days. Packages must be shipped in order.

```python
def ship_within_days(weights: list[int], days: int) -> int:
    """
    LeetCode 1011: Capacity To Ship Packages Within D Days
    Binary search on the answer (ship capacity).
    """
    def can_ship(capacity: int) -> bool:
        """Check if we can ship all packages in 'days' days with given capacity."""
        current_load = 0
        days_needed = 1

        for weight in weights:
            if current_load + weight > capacity:
                days_needed += 1
                current_load = weight
                if days_needed > days:
                    return False
            else:
                current_load += weight

        return True

    # Search space: [max single package weight, sum of all weights]
    lo = max(weights)         # Must be able to carry the heaviest package
    hi = sum(weights)         # Could ship everything in one day

    while lo < hi:
        mid = lo + (hi - lo) // 2
        if can_ship(mid):
            hi = mid          # Try smaller capacity
        else:
            lo = mid + 1      # Need larger capacity

    return lo


# Example:
weights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
days = 5
print(ship_within_days(weights, days))  # Output: 15
```

### More Parametric Search Problems

```
Problem                                      Search Space
--------------------------------------------------------------
Koko eating bananas                          [1, max(piles)]
Split array largest sum                      [max(arr), sum(arr)]
Minimum days to make m bouquets             [1, max(bloom_days)]
Magnetic force between two balls            [1, max_position]
Minimum speed to arrive on time            [1, max_distance]
```

---

## Interpolation Search

Instead of always going to the middle, Interpolation Search **estimates** the position of the target based on its value relative to the boundary values. It assumes values are **uniformly distributed**.

### Formula

```
pos = lo + ((target - arr[lo]) * (hi - lo)) / (arr[hi] - arr[lo])
```

This is analogous to looking up a word in a dictionary: you do not start in the middle for "aardvark" — you start near the beginning.

### Implementation (Python)

```python
def interpolation_search(arr: list, target) -> int:
    """
    Interpolation Search.
    O(log log n) for uniformly distributed data.
    O(n) worst case (non-uniform distribution).
    """
    lo, hi = 0, len(arr) - 1

    while lo <= hi and arr[lo] <= target <= arr[hi]:
        if lo == hi:
            if arr[lo] == target:
                return lo
            return -1

        # Estimate position using interpolation formula
        pos = lo + ((target - arr[lo]) * (hi - lo)) // (arr[hi] - arr[lo])

        if arr[pos] == target:
            return pos
        elif arr[pos] < target:
            lo = pos + 1
        else:
            hi = pos - 1

    return -1
```

### When Interpolation Search Excels

```
Array: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
Target: 70

Binary Search: mid=50 -> right half -> mid=80 -> left -> mid=60 -> right -> 70
  4 steps

Interpolation Search:
  pos = 0 + ((70-10) * 9) / (100-10) = 0 + 540/90 = 6
  arr[6] = 70 -> FOUND!
  1 step (because data is perfectly uniform)
```

### Complexity

| Distribution | Average      | Worst   |
|-------------|-------------|---------|
| Uniform     | O(log log n)| O(log log n) |
| Non-uniform | O(n)        | O(n)    |

---

## Exponential Search

Exponential Search finds the range where the target might exist by doubling the search index (1, 2, 4, 8, 16, ...), then performs binary search within that range. It is useful for **unbounded or infinite arrays** where you do not know the size.

### Implementation (Python)

```python
def exponential_search(arr: list, target) -> int:
    """
    Exponential Search.
    O(log n) time. Useful when size is unknown or array is unbounded.
    """
    n = len(arr)
    if n == 0:
        return -1
    if arr[0] == target:
        return 0

    # Find range by doubling
    bound = 1
    while bound < n and arr[bound] <= target:
        bound *= 2

    # Binary search within [bound/2, min(bound, n-1)]
    lo = bound // 2
    hi = min(bound, n - 1)

    while lo <= hi:
        mid = lo + (hi - lo) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1

    return -1
```

### ASCII Trace

```
Array: [2, 3, 4, 10, 40, 55, 60, 70, 80, 90, 100]
Target: 55

Exponential phase (find range):
  bound=1:  arr[1]=3  <= 55  -> double
  bound=2:  arr[2]=4  <= 55  -> double
  bound=4:  arr[4]=40 <= 55  -> double
  bound=8:  arr[8]=80 > 55   -> STOP

Range found: [4, 8]

Binary search in [4, 8]:
  mid=6: arr[6]=60 > 55  -> hi=5
  mid=4: arr[4]=40 < 55  -> lo=5
  mid=5: arr[5]=55 == 55 -> FOUND at index 5
```

### When to Use

- **Unbounded arrays** (e.g., searching in an infinite sorted stream).
- **When the target is close to the beginning** of a large sorted array (the exponential phase will find the range quickly).
- Time complexity is O(log i) where i is the index of the target, which is O(log n) in the worst case.

---

## Jump Search

Jump Search works on sorted arrays by jumping ahead by fixed steps of size sqrt(n), then performing a linear search within the identified block.

### Implementation (Python)

```python
import math

def jump_search(arr: list, target) -> int:
    """
    Jump Search.
    Time: O(sqrt(n)), Space: O(1).
    """
    n = len(arr)
    if n == 0:
        return -1

    step = int(math.sqrt(n))
    prev = 0

    # Jump ahead until we find a block that may contain the target
    while arr[min(step, n) - 1] < target:
        prev = step
        step += int(math.sqrt(n))
        if prev >= n:
            return -1

    # Linear search within the block [prev, step)
    while arr[prev] < target:
        prev += 1
        if prev == min(step, n):
            return -1

    if arr[prev] == target:
        return prev
    return -1
```

### ASCII Trace

```
Array: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
Target: 55, n=12, step = sqrt(12) = 3

Jump phase:
  Check arr[2]=1  < 55  -> jump (prev=3, step=6)
  Check arr[5]=5  < 55  -> jump (prev=6, step=9)
  Check arr[8]=21 < 55  -> jump (prev=9, step=12)
  Check arr[11]=89 >= 55 -> STOP

Linear search in [9, 12):
  arr[9]=34  < 55  -> next
  arr[10]=55 == 55 -> FOUND at index 10
```

### Optimal Block Size

The optimal block size is sqrt(n), which minimizes the total work:
- Number of jumps: n / m (where m is block size)
- Linear search within block: m
- Total: n/m + m, minimized when m = sqrt(n), giving O(sqrt(n))

### When to Use

- When **binary search is too complex** to implement for the given scenario.
- When you need a search better than linear but on **block-accessible storage** (e.g., tape drives, where seeking is expensive but sequential reading is cheap).

---

## Ternary Search

Ternary Search divides the search space into three parts instead of two. Its primary use is **finding the maximum or minimum of a unimodal function** (a function that increases then decreases, or vice versa).

### Implementation (Python) — Unimodal Function Maximum

```python
def ternary_search_max(f, lo: float, hi: float, eps: float = 1e-9) -> float:
    """
    Find the x that maximizes f(x) on [lo, hi].
    f must be unimodal: increases then decreases on [lo, hi].
    Time: O(log((hi-lo)/eps))
    """
    while hi - lo > eps:
        m1 = lo + (hi - lo) / 3
        m2 = hi - (hi - lo) / 3

        if f(m1) < f(m2):
            lo = m1   # Maximum is in [m1, hi]
        else:
            hi = m2   # Maximum is in [lo, m2]

    return (lo + hi) / 2
```

### Implementation (Python) — Array Search (Discrete)

```python
def ternary_search_array(arr: list, target) -> int:
    """
    Ternary Search on a sorted array.
    Note: Not faster than binary search for sorted array search!
    O(log3(n)) comparisons, but each step does 2 comparisons,
    so total = 2*log3(n) > log2(n).
    """
    lo, hi = 0, len(arr) - 1

    while lo <= hi:
        mid1 = lo + (hi - lo) // 3
        mid2 = hi - (hi - lo) // 3

        if arr[mid1] == target:
            return mid1
        if arr[mid2] == target:
            return mid2
        if target < arr[mid1]:
            hi = mid1 - 1
        elif target > arr[mid2]:
            lo = mid2 + 1
        else:
            lo = mid1 + 1
            hi = mid2 - 1

    return -1
```

### Important Note

For **searching in a sorted array**, ternary search is **not better** than binary search. Each ternary search step eliminates 1/3 of the search space but requires 2 comparisons, whereas binary search eliminates 1/2 with 1 comparison. The total comparisons are:
- Binary search: log2(n) ~ 1.0 * log(n)
- Ternary search: 2 * log3(n) ~ 1.26 * log(n)

Ternary search's value is in **unimodal function optimization**, not sorted array search.

---

## Comparison Table

```
Algorithm         Time (avg)     Time (worst)   Space   Requires Sorted   Best For
------------------------------------------------------------------------------------
Linear Search     O(n)           O(n)           O(1)    No               Unsorted, small
Binary Search     O(log n)       O(log n)       O(1)    Yes              Sorted arrays
Interpolation     O(log log n)   O(n)           O(1)    Yes              Uniform distribution
Exponential       O(log n)       O(log n)       O(1)    Yes              Unbounded arrays
Jump Search       O(sqrt(n))     O(sqrt(n))     O(1)    Yes              Block-access storage
Ternary Search    O(log n)       O(log n)       O(1)    Yes              Unimodal functions
```

---

## Hash-Based Search

Hash-based search achieves **O(1) average-case** lookup by computing a hash function that maps keys to array indices.

### Brief Overview

```python
# Python dictionary: O(1) average lookup
phonebook = {"Alice": "555-0001", "Bob": "555-0002"}
print(phonebook.get("Alice"))  # O(1)

# Python set: O(1) membership test
seen = set()
seen.add(42)
print(42 in seen)  # O(1)
```

### Complexity

| Case    | Time | Notes |
|---------|------|-------|
| Average | O(1) | Good hash function, low load factor |
| Worst   | O(n) | All keys hash to the same bucket (pathological) |

Hash-based search is covered in detail in the hashing chapter (hash tables, hash functions, collision resolution).

---

## Search in Data Structures

Different data structures provide different search guarantees:

```
Data Structure          Search Time       Notes
--------------------------------------------------------------------
Unsorted array          O(n)              Linear scan
Sorted array            O(log n)          Binary search
Linked list             O(n)              Linear scan (no random access)
Binary Search Tree      O(h)              h = height (O(n) worst, unbalanced)
Balanced BST (AVL/RB)   O(log n)          Guaranteed balanced height
Hash Table              O(1) amortized    O(n) worst case (collisions)
Trie                    O(m)              m = key length (for strings)
Skip List               O(log n) expected Probabilistic data structure
B-Tree                  O(log n)          Optimized for disk access
Bloom Filter            O(k)              Probabilistic: may have false positives
```

### Choosing the Right Structure for Search

```
Need                                  Use
--------------------------------------------------------------
Single key lookup, mutable           Hash Table
Range queries on sorted data         Balanced BST or B-Tree
Prefix matching on strings           Trie
Existence check (approximate)        Bloom Filter
Sorted iteration + search            Balanced BST
Disk-based search (databases)        B-Tree / B+ Tree
In-memory sorted data + search       Sorted array + binary search
```

---

## Binary Search: Common Patterns and Pitfalls

### Pattern: Search in Rotated Sorted Array

```python
def search_rotated(arr: list, target: int) -> int:
    """
    Search in a rotated sorted array (e.g., [4,5,6,7,0,1,2]).
    The array was originally sorted, then rotated at some pivot.
    Time: O(log n)
    """
    lo, hi = 0, len(arr) - 1

    while lo <= hi:
        mid = lo + (hi - lo) // 2

        if arr[mid] == target:
            return mid

        # Determine which half is sorted
        if arr[lo] <= arr[mid]:
            # Left half is sorted
            if arr[lo] <= target < arr[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        else:
            # Right half is sorted
            if arr[mid] < target <= arr[hi]:
                lo = mid + 1
            else:
                hi = mid - 1

    return -1
```

### Pattern: Find Peak Element

```python
def find_peak(arr: list) -> int:
    """
    Find a peak element (greater than its neighbors).
    Time: O(log n)
    """
    lo, hi = 0, len(arr) - 1

    while lo < hi:
        mid = lo + (hi - lo) // 2
        if arr[mid] < arr[mid + 1]:
            lo = mid + 1  # Peak is in right half
        else:
            hi = mid      # Peak is at mid or left

    return lo
```

### Pattern: Find Minimum in Rotated Sorted Array

```python
def find_min_rotated(arr: list) -> int:
    """Find the minimum element in a rotated sorted array. O(log n)."""
    lo, hi = 0, len(arr) - 1

    while lo < hi:
        mid = lo + (hi - lo) // 2
        if arr[mid] > arr[hi]:
            lo = mid + 1  # Min is in right half
        else:
            hi = mid      # Min is at mid or left

    return arr[lo]
```

### Common Pitfalls

```
1. Off-by-one errors:
   - lo <= hi  vs  lo < hi  (inclusive vs exclusive upper bound)
   - hi = mid  vs  hi = mid - 1
   - These depend on your loop invariant. Be consistent!

2. Infinite loops:
   - If lo == hi and you set hi = mid (not mid - 1), you need lo < hi (not lo <= hi)
   - If using lo < hi, make sure lo or hi ALWAYS changes

3. Integer overflow:
   - mid = (lo + hi) / 2 overflows in Java/C++ for large lo + hi
   - Fix: mid = lo + (hi - lo) / 2

4. Wrong comparison direction:
   - Searching for leftmost: use arr[mid] < target (move lo right when strictly less)
   - Searching for rightmost: use arr[mid] <= target (move lo right when less or equal)

5. Empty array:
   - Always check if the array is empty before searching

6. Not handling duplicates:
   - Standard binary search may return any occurrence
   - Use lower_bound/upper_bound for specific occurrence
```

---

## Two-Dimensional Binary Search

### Search in Sorted Matrix

```python
def search_matrix(matrix: list[list[int]], target: int) -> bool:
    """
    Search in a row-wise and column-wise sorted matrix.
    Start from top-right corner.
    Time: O(m + n) where m = rows, n = columns.
    """
    if not matrix or not matrix[0]:
        return False

    rows, cols = len(matrix), len(matrix[0])
    row, col = 0, cols - 1

    while row < rows and col >= 0:
        if matrix[row][col] == target:
            return True
        elif matrix[row][col] > target:
            col -= 1  # Eliminate current column
        else:
            row += 1  # Eliminate current row

    return False
```

```
Matrix (sorted rows and columns):
    1   4   7  11
    2   5   8  12
    3   6   9  16
   10  13  14  17

Search for 5: Start at top-right (11)
  11 > 5 -> go left (7)
   7 > 5 -> go left (4)
   4 < 5 -> go down (5)
   5 == 5 -> FOUND!
```

---

## Summary of Key Takeaways

1. **Binary Search is the most important search algorithm** — it appears in countless variations and applications beyond simple array search.
2. **Binary search on answer** (parametric search) is a powerful technique for optimization problems with monotonic feasibility.
3. **Always use `mid = lo + (hi - lo) / 2`** to avoid integer overflow.
4. **Lower bound and upper bound** are the foundational binary search variants — most other variations are built on top of them.
5. **Interpolation Search** is theoretically faster for uniform data but Binary Search is more robust.
6. **Choose the right data structure** for your search pattern: hash table for O(1) lookup, BST for sorted operations, trie for strings.

---

## Sources

- Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2009). *Introduction to Algorithms* (3rd ed.), Chapter 2. MIT Press.
- Sedgewick, R. & Wayne, K. (2011). *Algorithms* (4th ed.). Addison-Wesley.
- Bloch, J. (2006). "Extra, Extra - Read All About It: Nearly All Binary Searches and Mergesorts are Broken." Google Research Blog.
- Knuth, D. E. (1998). *The Art of Computer Programming, Vol. 3: Sorting and Searching* (2nd ed.). Addison-Wesley.
- Wikipedia. *Binary search algorithm*. https://en.wikipedia.org/wiki/Binary_search_algorithm
- Wikipedia. *Interpolation search*. https://en.wikipedia.org/wiki/Interpolation_search
- Wikipedia. *Exponential search*. https://en.wikipedia.org/wiki/Exponential_search
- cp-algorithms. *Binary Search*. https://cp-algorithms.com/num_methods/binary_search.html
