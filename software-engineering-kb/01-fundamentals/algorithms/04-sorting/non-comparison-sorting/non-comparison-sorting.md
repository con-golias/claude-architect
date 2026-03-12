# Non-Comparison Sorting Algorithms

> **Domain**: Fundamentals > Algorithms > Sorting > Non-Comparison
> **Difficulty**: Intermediate-Advanced
> **Last Updated**: 2026-03-07

---

## What It Is

Non-comparison sorting algorithms determine the order of elements **without comparing pairs of elements**. Instead, they exploit structural properties of the data — such as digit values, key ranges, or distribution characteristics — to place elements directly into their correct positions.

Because they do not rely on pairwise comparisons, non-comparison sorts **break the O(n log n) lower bound** that applies to all comparison-based sorts. They can achieve **O(n)** or **O(nk)** time complexity under specific constraints on the input data.

### The Key Insight

The O(n log n) lower bound is proven using the decision tree model, which assumes the only operation available is comparing two elements. Non-comparison sorts sidestep this by using additional operations:
- **Indexing** into an array by key value (Counting Sort)
- **Extracting digits** from keys (Radix Sort)
- **Hashing** elements into buckets (Bucket Sort)

### Trade-offs

Non-comparison sorts are **not universally better** than comparison sorts:

```
Comparison Sorts                  Non-Comparison Sorts
------------------------------    --------------------------------
Work on ANY comparable type       Require specific key structure
O(n log n) always                 O(n) only when constraints hold
Space: often O(1) or O(log n)     Space: often O(n + k)
General purpose                   Specialized
```

---

## When to Use Non-Comparison Sorts

- **Integer keys** with a known, bounded range (e.g., ages 0-150, ASCII codes 0-127).
- **Fixed-length strings** or records with fixed-width keys.
- **Large datasets** where the O(n log n) factor matters and data has exploitable structure.
- **Radix-based data**: IP addresses, dates, phone numbers, zip codes.
- **Multi-key sorting**: When you need to sort by multiple fields (e.g., sort by year, then by month, then by day).

---

## Counting Sort

Counting Sort works by counting the number of occurrences of each distinct element, then using those counts to compute the correct position of each element in the output.

### How It Works

1. **Count**: Create a count array of size `k` (range of values). Count occurrences of each value.
2. **Cumulative Sum**: Transform the count array so each position stores the cumulative count. This tells us the position of the last occurrence of each value.
3. **Place Elements**: Iterate through the input in reverse (for stability), placing each element at the position indicated by the cumulative count, then decrementing the count.

### Implementation (Python)

```python
def counting_sort(arr: list) -> list:
    """
    Counting Sort for non-negative integers.
    Time: O(n + k), Space: O(n + k), Stable: Yes
    where k = max(arr) + 1 (range of values)
    """
    if not arr:
        return arr

    max_val = max(arr)
    count = [0] * (max_val + 1)

    # Step 1: Count occurrences
    for num in arr:
        count[num] += 1

    # Step 2: Cumulative sum (prefix sum)
    for i in range(1, len(count)):
        count[i] += count[i - 1]

    # Step 3: Place elements (iterate in reverse for stability)
    output = [0] * len(arr)
    for i in range(len(arr) - 1, -1, -1):
        val = arr[i]
        count[val] -= 1
        output[count[val]] = val

    return output
```

### Implementation (TypeScript)

```typescript
function countingSort(arr: number[]): number[] {
    if (arr.length === 0) return arr;

    const maxVal = Math.max(...arr);
    const count = new Array(maxVal + 1).fill(0);

    // Step 1: Count occurrences
    for (const num of arr) {
        count[num]++;
    }

    // Step 2: Cumulative sum
    for (let i = 1; i < count.length; i++) {
        count[i] += count[i - 1];
    }

    // Step 3: Build output (reverse iteration for stability)
    const output = new Array(arr.length);
    for (let i = arr.length - 1; i >= 0; i--) {
        const val = arr[i];
        count[val]--;
        output[count[val]] = val;
    }

    return output;
}
```

### ASCII Trace for [4, 2, 2, 8, 3, 3, 1]

```
Input: [4, 2, 2, 8, 3, 3, 1]

Step 1: COUNT OCCURRENCES
  Index:  0  1  2  3  4  5  6  7  8
  Count: [0, 1, 2, 2, 1, 0, 0, 0, 1]
          ^  ^  ^  ^  ^              ^
          0  1  2  3  4              8
          x1 x1 x2 x2 x1            x1

Step 2: CUMULATIVE SUM
  Index:  0  1  2  3  4  5  6  7  8
  Count: [0, 1, 3, 5, 6, 6, 6, 6, 7]

  This means: "there are 3 elements <= 2" (positions 0,1,2)
              "there are 5 elements <= 3" (positions 0,1,2,3,4)
              etc.

Step 3: PLACE ELEMENTS (iterate input in reverse)

  i=6: arr[6]=1, count[1]=1, count[1]-- -> 0, output[0]=1
    output: [1, _, _, _, _, _, _]

  i=5: arr[5]=3, count[3]=5, count[3]-- -> 4, output[4]=3
    output: [1, _, _, _, 3, _, _]

  i=4: arr[4]=3, count[3]=4, count[3]-- -> 3, output[3]=3
    output: [1, _, _, 3, 3, _, _]

  i=3: arr[3]=8, count[8]=7, count[8]-- -> 6, output[6]=8
    output: [1, _, _, 3, 3, _, 8]

  i=2: arr[2]=2, count[2]=3, count[2]-- -> 2, output[2]=2
    output: [1, _, 2, 3, 3, _, 8]

  i=1: arr[1]=2, count[2]=2, count[2]-- -> 1, output[1]=2
    output: [1, 2, 2, 3, 3, _, 8]

  i=0: arr[0]=4, count[4]=6, count[4]-- -> 5, output[5]=4
    output: [1, 2, 2, 3, 3, 4, 8]

Result: [1, 2, 2, 3, 3, 4, 8]
```

### Complexity Analysis

| Metric | Value | Notes |
|--------|-------|-------|
| Time   | O(n + k) | n = array size, k = range of values |
| Space  | O(n + k) | count array of size k, output array of size n |
| Stable | Yes | Reverse iteration preserves order of equal elements |

### Stability Is Critical

Counting Sort's stability is not just a nice property — it is **essential** because Counting Sort is used as the **subroutine** inside Radix Sort. If the subroutine were not stable, sorting by less significant digits first (in LSD Radix Sort) would not work correctly.

### Limitation

Counting Sort becomes **impractical when k >> n** (the range of values is much larger than the number of elements). For example, sorting 100 integers in the range [0, 10^9] would require a count array of size 10^9, which is wasteful in both time and space.

---

## Radix Sort

Radix Sort sorts elements by processing individual digits (or characters) of the keys, from least significant to most significant (LSD) or from most significant to least significant (MSD). It uses a stable sort (typically Counting Sort) as a subroutine for each digit position.

### LSD Radix Sort (Least Significant Digit First)

Process digits from the **rightmost** (least significant) to the **leftmost** (most significant). Because the subroutine sort is stable, earlier sorts are preserved when later sorts break ties.

### Implementation (Python) — LSD Radix Sort

```python
def radix_sort_lsd(arr: list) -> list:
    """
    LSD Radix Sort for non-negative integers.
    Uses counting sort as a stable subroutine for each digit.
    Time: O(d * (n + b)) where d = digits, b = base, n = elements
    """
    if not arr:
        return arr

    max_val = max(arr)

    # Process each digit position (units, tens, hundreds, ...)
    exp = 1  # Current digit place (1, 10, 100, ...)
    while max_val // exp > 0:
        arr = counting_sort_by_digit(arr, exp)
        exp *= 10

    return arr


def counting_sort_by_digit(arr: list, exp: int) -> list:
    """Sort arr by the digit at position 'exp' using counting sort."""
    n = len(arr)
    output = [0] * n
    count = [0] * 10  # Base 10 digits (0-9)

    # Count occurrences of each digit
    for num in arr:
        digit = (num // exp) % 10
        count[digit] += 1

    # Cumulative sum
    for i in range(1, 10):
        count[i] += count[i - 1]

    # Place elements (reverse for stability)
    for i in range(n - 1, -1, -1):
        digit = (arr[i] // exp) % 10
        count[digit] -= 1
        output[count[digit]] = arr[i]

    return output
```

### Implementation (Java)

```java
import java.util.Arrays;

public class RadixSort {
    public static void radixSort(int[] arr) {
        if (arr.length == 0) return;

        int max = Arrays.stream(arr).max().getAsInt();

        // Sort by each digit position
        for (int exp = 1; max / exp > 0; exp *= 10) {
            countingSortByDigit(arr, exp);
        }
    }

    private static void countingSortByDigit(int[] arr, int exp) {
        int n = arr.length;
        int[] output = new int[n];
        int[] count = new int[10];

        // Count occurrences of each digit
        for (int num : arr) {
            int digit = (num / exp) % 10;
            count[digit]++;
        }

        // Cumulative sum
        for (int i = 1; i < 10; i++) {
            count[i] += count[i - 1];
        }

        // Build output (reverse for stability)
        for (int i = n - 1; i >= 0; i--) {
            int digit = (arr[i] / exp) % 10;
            count[digit]--;
            output[count[digit]] = arr[i];
        }

        // Copy back
        System.arraycopy(output, 0, arr, 0, n);
    }
}
```

### ASCII Trace for [170, 45, 75, 90, 802, 24, 2, 66]

```
Input: [170, 45, 75, 90, 802, 24, 2, 66]

=== SORT BY ONES DIGIT (exp=1) ===

  170 -> digit 0
   45 -> digit 5
   75 -> digit 5
   90 -> digit 0
  802 -> digit 2
   24 -> digit 4
    2 -> digit 2
   66 -> digit 6

  Bucket 0: [170, 90]
  Bucket 2: [802, 2]
  Bucket 4: [24]
  Bucket 5: [45, 75]
  Bucket 6: [66]

  After ones: [170, 90, 802, 2, 24, 45, 75, 66]

=== SORT BY TENS DIGIT (exp=10) ===

  170 -> digit 7
   90 -> digit 9
  802 -> digit 0
    2 -> digit 0
   24 -> digit 2
   45 -> digit 4
   75 -> digit 7
   66 -> digit 6

  Bucket 0: [802, 2]
  Bucket 2: [24]
  Bucket 4: [45]
  Bucket 6: [66]
  Bucket 7: [170, 75]
  Bucket 9: [90]

  After tens: [802, 2, 24, 45, 66, 170, 75, 90]

=== SORT BY HUNDREDS DIGIT (exp=100) ===

  802 -> digit 8
    2 -> digit 0
   24 -> digit 0
   45 -> digit 0
   66 -> digit 0
  170 -> digit 1
   75 -> digit 0
   90 -> digit 0

  Bucket 0: [2, 24, 45, 66, 75, 90]
  Bucket 1: [170]
  Bucket 8: [802]

  After hundreds: [2, 24, 45, 66, 75, 90, 170, 802]

Result: [2, 24, 45, 66, 75, 90, 170, 802]  (SORTED!)
```

### MSD Radix Sort (Most Significant Digit First)

MSD processes from the leftmost digit. It is naturally recursive: after sorting by the most significant digit, each bucket is recursively sorted by the next digit.

```python
def radix_sort_msd(arr: list, exp: int = None, depth: int = 0) -> list:
    """
    MSD Radix Sort (recursive).
    Particularly useful for variable-length strings.
    """
    if len(arr) <= 1:
        return arr

    if exp is None:
        max_val = max(arr) if arr else 0
        if max_val == 0:
            return arr
        exp = 1
        while exp * 10 <= max_val:
            exp *= 10

    # Create 10 buckets (digits 0-9)
    buckets = [[] for _ in range(10)]

    for num in arr:
        digit = (num // exp) % 10
        buckets[digit].append(num)

    # Recursively sort each bucket by next digit
    result = []
    for bucket in buckets:
        if exp >= 10 and len(bucket) > 1:
            result.extend(radix_sort_msd(bucket, exp // 10, depth + 1))
        else:
            result.extend(bucket)

    return result
```

### LSD vs MSD Comparison

```
Property              LSD Radix Sort              MSD Radix Sort
------------------------------------------------------------------
Processing order      Right to left               Left to right
Approach              Iterative                   Recursive
Stability             Stable                      Stable (if careful)
Best for              Fixed-length integers        Variable-length strings
Parallelism           Limited                     Natural (buckets are independent)
Short-circuit         No                          Yes (single-element buckets)
```

### When Radix Sort Beats O(n log n)

Radix Sort runs in O(d * (n + b)) where:
- d = number of digits
- n = number of elements
- b = base (typically 10 or 256)

For comparison: a comparison sort runs in O(n log n).

Radix Sort wins when **d < log_b(n)**, or equivalently, when the number of digits is small relative to the logarithm of n. For 32-bit integers, d = 4 (using base 256), so Radix Sort is O(4n) = O(n), which beats O(n log n) for large n.

```
n = 1,000,000 (one million 32-bit integers)
  Comparison sort: ~20n comparisons (n * log2(n) = 20n)
  Radix sort (base 256): 4 passes of n = 4n operations

  Radix sort is ~5x faster for this case!
```

---

## Bucket Sort

Bucket Sort distributes elements into a number of "buckets," sorts each bucket individually (often using Insertion Sort or another algorithm), and then concatenates the sorted buckets.

### How It Works

1. **Create k empty buckets** (typically k = n).
2. **Distribute** each element into a bucket based on a mapping function.
3. **Sort** each bucket individually.
4. **Concatenate** all buckets in order.

### Implementation (Python) — Floating-Point Numbers in [0, 1)

```python
def bucket_sort(arr: list[float]) -> list[float]:
    """
    Bucket Sort for uniformly distributed floats in [0, 1).
    Time: O(n) average (uniform distribution), O(n^2) worst case.
    Space: O(n + k) where k = number of buckets.
    """
    if not arr:
        return arr

    n = len(arr)
    buckets: list[list[float]] = [[] for _ in range(n)]

    # Distribute elements into buckets
    for num in arr:
        bucket_idx = int(num * n)  # Maps [0, 1) to [0, n)
        if bucket_idx == n:        # Edge case: num == 1.0
            bucket_idx = n - 1
        buckets[bucket_idx].append(num)

    # Sort each bucket (Insertion Sort for small buckets)
    for bucket in buckets:
        insertion_sort(bucket)

    # Concatenate all buckets
    result = []
    for bucket in buckets:
        result.extend(bucket)

    return result


def insertion_sort(arr: list) -> None:
    """In-place insertion sort for bucket contents."""
    for i in range(1, len(arr)):
        key = arr[i]
        j = i - 1
        while j >= 0 and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key
```

### Implementation (Python) — Integer Bucket Sort

```python
def bucket_sort_integers(arr: list[int], bucket_size: int = 5) -> list[int]:
    """
    Bucket Sort for integers with configurable bucket size.
    """
    if not arr:
        return arr

    min_val = min(arr)
    max_val = max(arr)

    # Calculate number of buckets
    bucket_count = (max_val - min_val) // bucket_size + 1
    buckets: list[list[int]] = [[] for _ in range(bucket_count)]

    # Distribute into buckets
    for num in arr:
        bucket_idx = (num - min_val) // bucket_size
        buckets[bucket_idx].append(num)

    # Sort each bucket and concatenate
    result = []
    for bucket in buckets:
        insertion_sort(bucket)
        result.extend(bucket)

    return result
```

### ASCII Trace for Floats [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68]

```
n = 10 elements, 10 buckets

Distribution (bucket_idx = int(value * 10)):

  Bucket 0: []
  Bucket 1: [0.17, 0.12]
  Bucket 2: [0.26, 0.21, 0.23]
  Bucket 3: [0.39]
  Bucket 4: []
  Bucket 5: []
  Bucket 6: [0.68]
  Bucket 7: [0.78, 0.72]
  Bucket 8: []
  Bucket 9: [0.94]

Sort each bucket (Insertion Sort):

  Bucket 1: [0.12, 0.17]
  Bucket 2: [0.21, 0.23, 0.26]
  Bucket 7: [0.72, 0.78]
  (others unchanged)

Concatenate:
  [0.12, 0.17, 0.21, 0.23, 0.26, 0.39, 0.68, 0.72, 0.78, 0.94]
```

### Complexity Analysis

| Case    | Time     | Condition |
|---------|----------|-----------|
| Best    | O(n)     | Elements uniformly distributed, each bucket has O(1) elements |
| Average | O(n + k) | Uniform distribution with n buckets |
| Worst   | O(n^2)   | All elements in one bucket, reduces to Insertion Sort |

### Why Uniform Distribution Matters

If elements are uniformly distributed across [0, 1) and we use n buckets:
- Each bucket receives **O(1) elements** on average.
- Sorting O(1) elements takes O(1) time.
- n buckets * O(1) per bucket = O(n) total.

If the distribution is **skewed**, some buckets receive many elements and the sort degrades toward O(n^2).

---

## Pigeonhole Sort

Pigeonhole Sort is a special case of Counting Sort that works when the **range of key values (k)** is approximately equal to the number of elements **(k ~ n)**. Each "pigeonhole" corresponds to a distinct key value.

### Implementation (Python)

```python
def pigeonhole_sort(arr: list[int]) -> list[int]:
    """
    Pigeonhole Sort: special case of counting sort.
    Best when range of values ~ number of elements.
    Time: O(n + k), Space: O(k)
    """
    if not arr:
        return arr

    min_val = min(arr)
    max_val = max(arr)
    range_size = max_val - min_val + 1

    # Create pigeonholes
    holes: list[list[int]] = [[] for _ in range(range_size)]

    # Place elements into pigeonholes
    for num in arr:
        holes[num - min_val].append(num)

    # Collect from pigeonholes
    result = []
    for hole in holes:
        result.extend(hole)

    return result
```

### When to Use Pigeonhole Sort

- When the range of values is close to the number of elements: k ~ n.
- Example: sorting exam scores (0-100) for 100 students.
- If k >> n, too much memory is wasted on empty pigeonholes.
- If k << n, many elements share pigeonholes and the advantage is lost.

---

## Comparison Table

```
Algorithm       Time         Space    Stable   Constraint
---------------------------------------------------------------------
Counting Sort   O(n + k)     O(n+k)   Yes      Integer keys, small range k
Radix Sort      O(d(n+k))   O(n+k)   Yes      Fixed-length keys, d digits
Bucket Sort     O(n + k)    O(n+k)   Yes*     Uniform distribution
Pigeonhole      O(n + k)    O(k)     Yes      Range k ~ n
```

*Bucket Sort stability depends on the sub-sort used within each bucket.*

### Detailed Breakdown

```
                   Counting Sort    Radix Sort       Bucket Sort
------------------------------------------------------------------
Key type           Integers         Integers/Strings Any with mapping
Range constraint   k must be small  d must be small  Distribution matters
Space              count + output   per-digit counts n buckets
Stability          Always stable    Stable (via CS)  Depends on sub-sort
Implementation     Simple           Moderate         Moderate
Parallelizable     Limited          Limited (LSD)    Yes (independent buckets)
                                    Good (MSD)
```

---

## Handling Negative Numbers

Standard non-comparison sorts work on non-negative integers. To handle negatives:

### Approach 1: Offset All Values

```python
def counting_sort_with_negatives(arr: list[int]) -> list[int]:
    """Counting sort that handles negative integers."""
    if not arr:
        return arr

    min_val = min(arr)
    max_val = max(arr)
    range_size = max_val - min_val + 1

    count = [0] * range_size

    for num in arr:
        count[num - min_val] += 1

    for i in range(1, range_size):
        count[i] += count[i - 1]

    output = [0] * len(arr)
    for i in range(len(arr) - 1, -1, -1):
        val = arr[i] - min_val
        count[val] -= 1
        output[count[val]] = arr[i]

    return output
```

### Approach 2: Separate Negatives and Positives

```python
def radix_sort_with_negatives(arr: list[int]) -> list[int]:
    """Radix sort that handles negative integers."""
    negatives = [-x for x in arr if x < 0]
    positives = [x for x in arr if x >= 0]

    sorted_neg = radix_sort_lsd(negatives) if negatives else []
    sorted_pos = radix_sort_lsd(positives) if positives else []

    # Negative numbers: reverse and negate back
    return [-x for x in reversed(sorted_neg)] + sorted_pos
```

---

## Radix Sort for Strings

Radix Sort (MSD variant) is particularly well-suited for sorting strings. It processes characters from the most significant (leftmost) to the least significant.

### Implementation (Python) — MSD String Sort

```python
def msd_string_sort(strings: list[str]) -> list[str]:
    """
    MSD Radix Sort for strings.
    Uses character codes as digits.
    """
    if len(strings) <= 1:
        return strings

    return _msd_sort(strings, 0)


def _msd_sort(strings: list[str], pos: int) -> list[str]:
    """Sort strings by character at position 'pos'."""
    if len(strings) <= 1:
        return strings

    # Bucket by character at position pos (-1 for end-of-string)
    buckets: dict[int, list[str]] = {}

    for s in strings:
        if pos >= len(s):
            key = -1  # End-of-string comes first
        else:
            key = ord(s[pos])
        if key not in buckets:
            buckets[key] = []
        buckets[key].append(s)

    result = []

    # End-of-string bucket first (shorter strings come first)
    if -1 in buckets:
        result.extend(buckets[-1])

    # Then all character buckets in order
    for key in sorted(k for k in buckets if k >= 0):
        result.extend(_msd_sort(buckets[key], pos + 1))

    return result


# Example usage:
strings = ["banana", "apple", "cherry", "apricot", "avocado", "app"]
print(msd_string_sort(strings))
# Output: ['app', 'apple', 'apricot', 'avocado', 'banana', 'cherry']
```

---

## Real-World Applications

### 1. Database Index Sorting

Databases often sort records by composite keys (date, time, ID). Radix Sort processes these fixed-width fields efficiently:

```
Sort by: YYYY-MM-DD HH:MM:SS

LSD approach: sort by seconds, then minutes, then hours,
              then day, then month, then year.
Each field has a small range -> counting sort per field is O(n).
Total: O(6n) = O(n) for date-time sorting.
```

### 2. Sorting IP Addresses

IPv4 addresses are 4 bytes. Using base-256 Radix Sort:

```python
def sort_ip_addresses(ips: list[str]) -> list[str]:
    """Sort IPv4 addresses using radix sort on octets."""
    # Convert to tuples of integers
    ip_tuples = [tuple(int(x) for x in ip.split('.')) for ip in ips]

    # Sort by each octet (LSD: from 4th to 1st)
    for octet_idx in range(3, -1, -1):
        ip_tuples = counting_sort_by_key(ip_tuples, octet_idx)

    return ['.'.join(str(x) for x in t) for t in ip_tuples]


def counting_sort_by_key(tuples, key_idx):
    """Counting sort on a specific field of tuples (0-255 range)."""
    count = [0] * 256
    for t in tuples:
        count[t[key_idx]] += 1
    for i in range(1, 256):
        count[i] += count[i - 1]

    output = [None] * len(tuples)
    for i in range(len(tuples) - 1, -1, -1):
        val = tuples[i][key_idx]
        count[val] -= 1
        output[count[val]] = tuples[i]
    return output
```

### 3. Character Frequency Analysis (Counting Sort)

```python
def sort_by_frequency(text: str) -> str:
    """Sort characters by frequency using counting sort principles."""
    count = [0] * 128  # ASCII range

    for ch in text:
        count[ord(ch)] += 1

    result = []
    # Create (frequency, character) pairs and sort
    freq_pairs = [(count[i], chr(i)) for i in range(128) if count[i] > 0]
    freq_pairs.sort(key=lambda x: -x[0])

    for freq, ch in freq_pairs:
        result.append(ch * freq)

    return ''.join(result)
```

### 4. Histogram Equalization (Bucket Sort)

In image processing, pixel values (0-255) can be sorted using counting/bucket sort in O(n) time to compute histograms and perform equalization.

### 5. Suffix Array Construction

Radix Sort is used in efficient suffix array construction algorithms (e.g., the DC3/Skew algorithm) which operate in O(n) time.

---

## Hybrid Approaches

### Counting Sort + Quick Sort

For arrays with a mix of dense and sparse key ranges:

```python
def hybrid_sort(arr: list[int]) -> list[int]:
    """Use counting sort if range is small, otherwise quicksort."""
    if not arr:
        return arr

    min_val, max_val = min(arr), max(arr)
    range_size = max_val - min_val + 1

    if range_size <= 2 * len(arr):
        # Small range -> counting sort is efficient
        return counting_sort_with_negatives(arr)
    else:
        # Large range -> fall back to comparison sort
        return sorted(arr)
```

### American Flag Sort

An in-place variant of MSD Radix Sort:
- Counts occurrences of each digit value.
- Computes bucket boundaries.
- Swaps elements to their correct buckets in-place.
- Recursively sorts each bucket.
- Used when memory is constrained and keys are fixed-width.

---

## Common Pitfalls

1. **Assuming non-comparison sorts are always faster**: They require constraints on the data. For arbitrary objects with a comparison operator, you must use comparison sorts.

2. **Forgetting stability in Radix Sort**: If the subroutine sort is not stable, LSD Radix Sort produces incorrect results.

3. **Using Counting Sort with huge ranges**: Sorting 100 elements with values up to 10^9 creates a 10^9-element count array. Use Radix Sort (base 256) instead.

4. **Not handling negative numbers**: Standard implementations only work for non-negative integers.

5. **Choosing the wrong base for Radix Sort**: Base 10 requires more passes than base 256. For 32-bit integers: base 10 needs ~10 passes, base 256 needs 4 passes.

---

## Summary

```
Choose Counting Sort when:
  - Integer keys with known, small range (k ~ n or k = O(n))
  - You need stability
  - You need a subroutine for Radix Sort

Choose Radix Sort when:
  - Fixed-width integer keys (32-bit, 64-bit)
  - Fixed-length strings
  - Number of digits d is small (d < log n)
  - You need to sort millions of records by numeric keys

Choose Bucket Sort when:
  - Data is uniformly distributed
  - Floating-point keys in a known range
  - You can define an efficient mapping function

Choose comparison-based sort when:
  - Keys are arbitrary objects with a comparison operator
  - Range of values is unknown or very large
  - Dataset is small (n < 1000, overhead of non-comparison sorts not worth it)
```

---

## Sources

- Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2009). *Introduction to Algorithms* (3rd ed.), Chapter 8: Sorting in Linear Time. MIT Press.
- Sedgewick, R. & Wayne, K. (2011). *Algorithms* (4th ed.), Section 5.1: String Sorts. Addison-Wesley.
- Knuth, D. E. (1998). *The Art of Computer Programming, Vol. 3: Sorting and Searching* (2nd ed.). Addison-Wesley.
- Wikipedia. *Counting sort*. https://en.wikipedia.org/wiki/Counting_sort
- Wikipedia. *Radix sort*. https://en.wikipedia.org/wiki/Radix_sort
- Wikipedia. *Bucket sort*. https://en.wikipedia.org/wiki/Bucket_sort
- cp-algorithms. *Radix sort*. https://cp-algorithms.com/sequences/radix-sort.html
