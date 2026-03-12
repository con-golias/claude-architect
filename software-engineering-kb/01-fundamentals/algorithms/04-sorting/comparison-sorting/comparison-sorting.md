# Comparison-Based Sorting Algorithms

> **Domain**: Fundamentals > Algorithms > Sorting > Comparison
> **Difficulty**: Intermediate
> **Last Updated**: 2026-03-07

---

## What It Is

Comparison-based sorting algorithms determine the order of elements solely by comparing pairs of elements using a comparator (typically `<`, `>`, or `<=`). The result of each comparison yields exactly one bit of information: which of two elements comes first.

**Theoretical Lower Bound**: The minimum number of comparisons required to sort n elements is **Omega(n log n)**. This is provable via the **decision tree model**:

- Any comparison-based sort can be modeled as a binary decision tree.
- Each internal node represents a comparison; each leaf represents a permutation.
- There are n! possible permutations of n elements.
- A binary tree with L leaves has height at least log2(L).
- Therefore, height >= log2(n!) = Omega(n log n) by Stirling's approximation.

This means **no** comparison-based sorting algorithm can do better than O(n log n) in the worst case. Algorithms like Merge Sort and Heap Sort achieve this bound and are therefore asymptotically optimal.

---

## Comprehensive Comparison Table

```
Algorithm        Best       Average     Worst      Space    Stable   Adaptive
---------------------------------------------------------------------------------
Bubble Sort      O(n)       O(n^2)      O(n^2)      O(1)     Yes      Yes
Selection Sort   O(n^2)     O(n^2)      O(n^2)      O(1)     No       No
Insertion Sort   O(n)       O(n^2)      O(n^2)      O(1)     Yes      Yes
Merge Sort       O(n log n) O(n log n)  O(n log n)  O(n)     Yes      No
Quick Sort       O(n log n) O(n log n)  O(n^2)      O(log n) No*      No
Heap Sort        O(n log n) O(n log n)  O(n log n)  O(1)     No       No
Tim Sort         O(n)       O(n log n)  O(n log n)  O(n)     Yes      Yes
Shell Sort       O(n log n) O(depends)  O(n^2)      O(1)     No       Yes
```

**Key definitions**:
- **Stable**: Equal elements retain their relative order from the input.
- **Adaptive**: Performance improves when the input is partially sorted.
- **In-place**: Uses O(1) auxiliary space (or O(log n) for recursion stack).

*Quick Sort can be made stable, but the standard in-place version is not.*

---

## Bubble Sort

Bubble Sort repeatedly steps through the list, compares adjacent elements, and swaps them if they are in the wrong order. After each pass, the largest unsorted element "bubbles up" to its correct position.

### Implementation (Python)

```python
def bubble_sort(arr: list) -> list:
    """
    Optimized Bubble Sort with early termination.
    If no swaps occur during a pass, the array is already sorted.
    """
    n = len(arr)
    for i in range(n):
        swapped = False
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:
            break  # Early termination: array is sorted
    return arr
```

### ASCII Step-by-Step Trace for [5, 3, 8, 1, 2]

```
Initial: [5, 3, 8, 1, 2]

Pass 1:
  Compare 5,3 -> swap  -> [3, 5, 8, 1, 2]
  Compare 5,8 -> ok    -> [3, 5, 8, 1, 2]
  Compare 8,1 -> swap  -> [3, 5, 1, 8, 2]
  Compare 8,2 -> swap  -> [3, 5, 1, 2, 8]   <- 8 is in place
  (swapped = True)

Pass 2:
  Compare 3,5 -> ok    -> [3, 5, 1, 2, 8]
  Compare 5,1 -> swap  -> [3, 1, 5, 2, 8]
  Compare 5,2 -> swap  -> [3, 1, 2, 5, 8]   <- 5 is in place
  (swapped = True)

Pass 3:
  Compare 3,1 -> swap  -> [1, 3, 2, 5, 8]
  Compare 3,2 -> swap  -> [1, 2, 3, 5, 8]   <- 3 is in place
  (swapped = True)

Pass 4:
  Compare 1,2 -> ok    -> [1, 2, 3, 5, 8]
  (swapped = False -> EARLY TERMINATION)

Result: [1, 2, 3, 5, 8]
```

### Why Bubble Sort Is Only Useful for Teaching

- O(n^2) average and worst case makes it impractical for any real dataset.
- Even with the early termination optimization, it is outperformed by Insertion Sort on nearly-sorted data.
- It does more swaps than necessary (compared to Selection Sort).
- Its only pedagogical value is its simplicity: it is the easiest sort to understand and implement.
- Knuth famously said: "The bubble sort seems to have nothing to recommend it, except a catchy name."

---

## Selection Sort

Selection Sort divides the array into a sorted prefix and an unsorted suffix. On each iteration, it finds the minimum element in the unsorted portion and swaps it into the end of the sorted prefix.

### Implementation (Python)

```python
def selection_sort(arr: list) -> list:
    """
    Selection Sort: always O(n^2) comparisons, but at most O(n) swaps.
    """
    n = len(arr)
    for i in range(n):
        min_idx = i
        for j in range(i + 1, n):
            if arr[j] < arr[min_idx]:
                min_idx = j
        arr[i], arr[min_idx] = arr[min_idx], arr[i]
    return arr
```

### Key Properties

- **Always O(n^2) comparisons** regardless of input order. It is **not adaptive**.
- **Minimizes the number of swaps**: exactly n-1 swaps in the worst case.
- This makes Selection Sort useful when **writes are significantly more expensive** than reads (e.g., writing to flash memory or EEPROM).
- **Not stable** by default: swapping can change the relative order of equal elements. (A stable variant exists using insertion instead of swapping, but it is rarely used.)
- Despite always being O(n^2), it tends to outperform Bubble Sort due to fewer swaps.

---

## Insertion Sort

Insertion Sort builds the final sorted array one element at a time. It takes each element and inserts it into its correct position among the already-sorted elements to its left.

### Implementation (Python)

```python
def insertion_sort(arr: list) -> list:
    """
    Insertion Sort: optimal for nearly-sorted data and small arrays.
    """
    for i in range(1, len(arr)):
        key = arr[i]
        j = i - 1
        while j >= 0 and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key
    return arr
```

### Implementation (TypeScript)

```typescript
function insertionSort(arr: number[]): number[] {
    for (let i = 1; i < arr.length; i++) {
        const key = arr[i];
        let j = i - 1;
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key;
    }
    return arr;
}
```

### ASCII Step-by-Step Trace for [5, 3, 8, 1, 2]

```
Initial: [5, 3, 8, 1, 2]
         ^sorted|unsorted

Step 1: key = 3, insert into [5]
  3 < 5, shift 5 right -> [_, 5, 8, 1, 2]
  Place 3                -> [3, 5, 8, 1, 2]
                            ^^^^|unsorted

Step 2: key = 8, insert into [3, 5]
  8 > 5, no shift        -> [3, 5, 8, 1, 2]
                            ^^^^^^^|unsorted

Step 3: key = 1, insert into [3, 5, 8]
  1 < 8, shift 8 right   -> [3, 5, _, 8, 2]
  1 < 5, shift 5 right   -> [3, _, 5, 8, 2]
  1 < 3, shift 3 right   -> [_, 3, 5, 8, 2]
  Place 1                -> [1, 3, 5, 8, 2]
                            ^^^^^^^^^^|unsorted

Step 4: key = 2, insert into [1, 3, 5, 8]
  2 < 8, shift           -> [1, 3, 5, _, 8]
  2 < 5, shift           -> [1, 3, _, 5, 8]
  2 < 3, shift           -> [1, _, 3, 5, 8]
  2 > 1, stop            -> [1, 2, 3, 5, 8]

Result: [1, 2, 3, 5, 8]
```

### Why Insertion Sort Is Important

1. **Optimal for nearly-sorted arrays**: O(n) time when the array has O(1) inversions per element.
2. **Optimal for small arrays**: Low constant factor and minimal overhead. Faster than O(n log n) algorithms for n < ~50 due to cache friendliness and no recursion overhead.
3. **Used as base case** in hybrid algorithms:
   - **TimSort** (Python, Java) switches to Insertion Sort for runs shorter than 32-64 elements.
   - **IntroSort** (C++ `std::sort`) uses Insertion Sort for partitions smaller than ~16 elements.
4. **Online algorithm**: Can sort a stream of elements as they arrive.
5. **Stable**: Equal elements maintain their original relative order.

---

## Merge Sort

Merge Sort is a divide-and-conquer algorithm that splits the array in half, recursively sorts each half, and merges the sorted halves.

### Implementation (Python)

```python
def merge_sort(arr: list) -> list:
    """Top-down Merge Sort."""
    if len(arr) <= 1:
        return arr

    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])

    return merge(left, right)


def merge(left: list, right: list) -> list:
    """Merge two sorted lists into one sorted list."""
    result = []
    i = j = 0

    while i < len(left) and j < len(right):
        if left[i] <= right[j]:   # <= ensures stability
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1

    result.extend(left[i:])
    result.extend(right[j:])
    return result
```

### Implementation (Java)

```java
public class MergeSort {
    public static void mergeSort(int[] arr, int left, int right) {
        if (left < right) {
            int mid = left + (right - left) / 2;

            mergeSort(arr, left, mid);
            mergeSort(arr, mid + 1, right);
            merge(arr, left, mid, right);
        }
    }

    private static void merge(int[] arr, int left, int mid, int right) {
        int n1 = mid - left + 1;
        int n2 = right - mid;

        int[] L = new int[n1];
        int[] R = new int[n2];

        System.arraycopy(arr, left, L, 0, n1);
        System.arraycopy(arr, mid + 1, R, 0, n2);

        int i = 0, j = 0, k = left;

        while (i < n1 && j < n2) {
            if (L[i] <= R[j]) {
                arr[k++] = L[i++];
            } else {
                arr[k++] = R[j++];
            }
        }

        while (i < n1) arr[k++] = L[i++];
        while (j < n2) arr[k++] = R[j++];
    }
}
```

### ASCII Diagram: Divide and Merge Phases

```
                    [38, 27, 43, 3, 9, 82, 10]
                   /                            \
          [38, 27, 43, 3]                [9, 82, 10]
          /             \                /          \
      [38, 27]      [43, 3]        [9, 82]       [10]
      /     \       /     \        /     \          |
    [38]   [27]  [43]    [3]    [9]    [82]       [10]
      \     /       \     /        \     /          |
     [27, 38]      [3, 43]        [9, 82]        [10]
          \             /                \          /
       [3, 27, 38, 43]               [9, 10, 82]
                   \                      /
            [3, 9, 10, 27, 38, 43, 82]
```

### Top-Down vs Bottom-Up

| Variant     | Description                                   | Space (stack) |
|-------------|-----------------------------------------------|---------------|
| Top-Down    | Recursive; divides from top, merges upward    | O(log n)      |
| Bottom-Up   | Iterative; starts with size-1 subarrays       | O(1)          |

Bottom-up Merge Sort (Python):

```python
def merge_sort_bottom_up(arr: list) -> list:
    """Iterative bottom-up merge sort."""
    n = len(arr)
    width = 1
    while width < n:
        for i in range(0, n, 2 * width):
            left = arr[i:i + width]
            right = arr[i + width:i + 2 * width]
            arr[i:i + len(left) + len(right)] = merge(left, right)
        width *= 2
    return arr
```

### Why Merge Sort Is Preferred for Linked Lists

- Arrays: Merge Sort requires O(n) extra space for the temporary merge buffer.
- Linked lists: Merging can be done **in-place** with O(1) extra space by rearranging pointers.
- Additionally, linked lists lack random access, which makes Quick Sort's partitioning less efficient.
- Merge Sort's sequential access pattern suits linked lists perfectly.

### Key Properties

- **Stable**: Equal elements preserve their original order (due to `<=` in merge).
- **Not adaptive**: Always O(n log n) regardless of input order.
- **Parallelizable**: The independent recursive calls can be parallelized easily.
- **External sorting**: The merge operation works well for data that does not fit in memory.

---

## Quick Sort

Quick Sort is a divide-and-conquer algorithm that selects a "pivot" element and partitions the array such that all elements less than the pivot come before it, and all greater elements come after it. It then recursively sorts the sub-arrays.

### Implementation (Python) — Lomuto Partition

```python
def quicksort_lomuto(arr: list, lo: int = 0, hi: int = None) -> list:
    """Quick Sort using Lomuto partition scheme."""
    if hi is None:
        hi = len(arr) - 1
    if lo < hi:
        pivot_idx = lomuto_partition(arr, lo, hi)
        quicksort_lomuto(arr, lo, pivot_idx - 1)
        quicksort_lomuto(arr, pivot_idx + 1, hi)
    return arr


def lomuto_partition(arr: list, lo: int, hi: int) -> int:
    """
    Lomuto partition: pivot is last element.
    Elements <= pivot go to the left partition.
    Returns the final position of the pivot.
    """
    pivot = arr[hi]
    i = lo - 1
    for j in range(lo, hi):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i + 1], arr[hi] = arr[hi], arr[i + 1]
    return i + 1
```

### Implementation (Python) — Hoare Partition

```python
def quicksort_hoare(arr: list, lo: int = 0, hi: int = None) -> list:
    """Quick Sort using Hoare partition scheme."""
    if hi is None:
        hi = len(arr) - 1
    if lo < hi:
        pivot_idx = hoare_partition(arr, lo, hi)
        quicksort_hoare(arr, lo, pivot_idx)
        quicksort_hoare(arr, pivot_idx + 1, hi)
    return arr


def hoare_partition(arr: list, lo: int, hi: int) -> int:
    """
    Hoare partition: pivot is first element.
    Two pointers move inward, swapping misplaced elements.
    More efficient than Lomuto (3x fewer swaps on average).
    """
    pivot = arr[lo]
    i = lo - 1
    j = hi + 1
    while True:
        i += 1
        while arr[i] < pivot:
            i += 1
        j -= 1
        while arr[j] > pivot:
            j -= 1
        if i >= j:
            return j
        arr[i], arr[j] = arr[j], arr[i]
```

### Lomuto vs Hoare Partition Schemes

```
Lomuto Partition (pivot = last element):
  - Single scan from left to right
  - Maintains boundary with index i
  - Simpler to understand and implement
  - ~3x more swaps than Hoare on average
  - Degrades badly with many duplicates

Hoare Partition (pivot = first element):
  - Two pointers scanning inward from both ends
  - More efficient: ~3x fewer swaps on average
  - Better performance in practice
  - Slightly harder to implement correctly
  - Note: pivot is NOT necessarily at the returned index
```

### Implementation (TypeScript)

```typescript
function quickSort(arr: number[], lo = 0, hi = arr.length - 1): number[] {
    if (lo < hi) {
        const pivotIdx = partition(arr, lo, hi);
        quickSort(arr, lo, pivotIdx - 1);
        quickSort(arr, pivotIdx + 1, hi);
    }
    return arr;
}

function partition(arr: number[], lo: number, hi: number): number {
    // Median-of-three pivot selection
    const mid = lo + Math.floor((hi - lo) / 2);
    if (arr[mid] < arr[lo]) [arr[lo], arr[mid]] = [arr[mid], arr[lo]];
    if (arr[hi] < arr[lo]) [arr[lo], arr[hi]] = [arr[hi], arr[lo]];
    if (arr[mid] < arr[hi]) [arr[mid], arr[hi]] = [arr[hi], arr[mid]];

    const pivot = arr[hi];
    let i = lo - 1;

    for (let j = lo; j < hi; j++) {
        if (arr[j] <= pivot) {
            i++;
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
    [arr[i + 1], arr[hi]] = [arr[hi], arr[i + 1]];
    return i + 1;
}
```

### Implementation (C++)

```cpp
#include <vector>
#include <algorithm>
#include <random>

class QuickSort {
public:
    static void sort(std::vector<int>& arr, int lo, int hi) {
        if (lo < hi) {
            int pivotIdx = partition(arr, lo, hi);
            sort(arr, lo, pivotIdx - 1);
            sort(arr, pivotIdx + 1, hi);
        }
    }

private:
    static int partition(std::vector<int>& arr, int lo, int hi) {
        // Random pivot selection to avoid worst case
        static std::mt19937 rng(std::random_device{}());
        std::uniform_int_distribution<int> dist(lo, hi);
        int randomIdx = dist(rng);
        std::swap(arr[randomIdx], arr[hi]);

        int pivot = arr[hi];
        int i = lo - 1;

        for (int j = lo; j < hi; j++) {
            if (arr[j] <= pivot) {
                i++;
                std::swap(arr[i], arr[j]);
            }
        }
        std::swap(arr[i + 1], arr[hi]);
        return i + 1;
    }
};
```

### Pivot Selection Strategies

```
Strategy         Worst Case Trigger          Pros/Cons
----------------------------------------------------------------------
First element    Sorted/reverse-sorted       Simple but O(n^2) common
Last element     Sorted/reverse-sorted       Simple but O(n^2) common
Median-of-three  Specific adversarial input  Good practical choice
Random           Extremely unlikely O(n^2)   Best general strategy
Median-of-medians  Never (guaranteed)        O(n log n) but high constant
```

### 3-Way Partition (Dutch National Flag) for Duplicates

When the array contains many duplicate elements, standard partitioning degrades. The 3-way partition divides the array into three regions: less than pivot, equal to pivot, greater than pivot.

```python
def quicksort_3way(arr: list, lo: int = 0, hi: int = None) -> list:
    """
    3-Way Quick Sort (Dutch National Flag).
    Optimal for arrays with many duplicate keys.
    Partitions into: [< pivot | == pivot | > pivot]
    """
    if hi is None:
        hi = len(arr) - 1
    if lo >= hi:
        return arr

    pivot = arr[lo]
    lt = lo      # arr[lo..lt-1]   < pivot
    i = lo + 1   # arr[lt..i-1]   == pivot
    gt = hi      # arr[gt+1..hi]  > pivot

    while i <= gt:
        if arr[i] < pivot:
            arr[lt], arr[i] = arr[i], arr[lt]
            lt += 1
            i += 1
        elif arr[i] > pivot:
            arr[i], arr[gt] = arr[gt], arr[i]
            gt -= 1
        else:
            i += 1

    # arr[lt..gt] are all equal to pivot — no need to recurse on them
    quicksort_3way(arr, lo, lt - 1)
    quicksort_3way(arr, gt + 1, hi)
    return arr
```

### Worst Case: Already Sorted + First/Last Pivot

```
Array: [1, 2, 3, 4, 5]  Pivot: first element (1)

Partition 1: pivot=1 -> [] [1] [2, 3, 4, 5]     (n-1 comparisons)
Partition 2: pivot=2 -> [] [2] [3, 4, 5]         (n-2 comparisons)
Partition 3: pivot=3 -> [] [3] [4, 5]            (n-3 comparisons)
Partition 4: pivot=4 -> [] [4] [5]               (n-4 comparisons)

Total comparisons: (n-1) + (n-2) + ... + 1 = n(n-1)/2 = O(n^2)

Each partition only removes one element, creating maximally unbalanced splits.
This is why random or median-of-three pivot selection is essential.
```

### Why Quick Sort Is Fastest in Practice

Despite its O(n^2) worst case:
1. **Cache friendliness**: Operates on contiguous memory, unlike Merge Sort's auxiliary arrays.
2. **Small constant factor**: Inner loop is extremely tight (compare and increment).
3. **In-place**: O(log n) stack space vs O(n) for Merge Sort.
4. **Tail-call optimization**: Recursing on the smaller partition first limits stack depth.
5. **Random pivot** makes worst case astronomically unlikely (probability ~ 1/n!).

---

## Heap Sort

Heap Sort uses a binary max-heap to sort an array. It first builds a heap from the array, then repeatedly extracts the maximum element and places it at the end.

### Implementation (Python)

```python
def heap_sort(arr: list) -> list:
    """Heap Sort using max-heap."""
    n = len(arr)

    # Build max heap (heapify all non-leaf nodes from bottom up)
    for i in range(n // 2 - 1, -1, -1):
        sift_down(arr, n, i)

    # Extract elements one by one
    for i in range(n - 1, 0, -1):
        arr[0], arr[i] = arr[i], arr[0]  # Move max to end
        sift_down(arr, i, 0)              # Restore heap on reduced array

    return arr


def sift_down(arr: list, heap_size: int, root: int) -> None:
    """
    Sift down the element at 'root' to maintain the max-heap property.
    """
    largest = root
    left = 2 * root + 1
    right = 2 * root + 2

    if left < heap_size and arr[left] > arr[largest]:
        largest = left
    if right < heap_size and arr[right] > arr[largest]:
        largest = right

    if largest != root:
        arr[root], arr[largest] = arr[largest], arr[root]
        sift_down(arr, heap_size, largest)
```

### ASCII Heapify Diagram for [4, 10, 3, 5, 1]

```
Step 1: Initial array as complete binary tree:

         4
        / \
      10    3
      / \
     5    1

Step 2: Heapify from last non-leaf (index 1, value 10):
  10 > 5 and 10 > 1 -> already a valid heap at this node.

         4
        / \
      10    3
      / \
     5    1

Step 3: Heapify from root (index 0, value 4):
  Children: 10, 3. Largest child: 10 > 4 -> swap 4 and 10.

        10
        / \
       4    3
      / \
     5    1

  Continue sifting down 4: children are 5, 1. Largest: 5 > 4 -> swap.

        10
        / \
       5    3
      / \
     4    1

Max-heap built! Now extract:

  Swap root (10) with last (1):  [1, 5, 3, 4, 10]  -> 10 in final position
  Sift down 1:                   [5, 4, 3, 1, | 10]
  Swap root (5) with last (1):   [1, 4, 3, | 5, 10]
  Sift down 1:                   [4, 1, 3, | 5, 10]
  Swap root (4) with last (3):   [3, 1, | 4, 5, 10]
  Sift down 3:                   [3, 1, | 4, 5, 10]  (already valid)
  Swap root (3) with last (1):   [1, | 3, 4, 5, 10]

Result: [1, 3, 4, 5, 10]
```

### Why Heap Sort Is Not Commonly Used in Practice

- **Poor cache locality**: Heap operations jump around in memory (parent at i, children at 2i+1, 2i+2), causing cache misses.
- **Not stable**: The extraction phase disturbs the relative order of equal elements.
- **Higher constant factor** than Quick Sort in practice.
- **Guaranteed O(n log n)** worst case is its main advantage over Quick Sort, but IntroSort achieves this by falling back to Heap Sort only when Quick Sort degrades.

---

## Tim Sort

Tim Sort is a hybrid sorting algorithm derived from Merge Sort and Insertion Sort, designed by Tim Peters in 2002 for Python. It is specifically optimized for real-world data, which often contains pre-existing ordered subsequences.

### How It Works

1. **Divide the array into "runs"** — natural ascending or descending sequences in the data. Minimum run size is typically 32 or 64.
2. **Extend short runs** to the minimum run length using Insertion Sort (which is efficient for small, partially sorted sequences).
3. **Merge runs** using a modified merge sort that:
   - Maintains a stack of pending runs
   - Enforces merge invariants to maintain balance
   - Uses **galloping mode** for merging when one run consistently wins

### Run Detection

```
Input:  [1, 3, 5, 7, 2, 4, 6, 8, 10, 9, 6, 3, 1]

Detected runs:
  Run 1: [1, 3, 5, 7]        (ascending)
  Run 2: [2, 4, 6, 8, 10]    (ascending)
  Run 3: [9, 6, 3, 1]        (descending -> reversed to [1, 3, 6, 9])

Merge runs pairwise until one sorted array remains.
```

### Galloping Mode

When merging two runs A and B, if elements from A are consistently "winning" (coming first), galloping mode kicks in:

- Instead of comparing one element at a time, it uses binary search (exponential search) to find where the next element from B belongs in A.
- This is highly efficient when one run has many consecutive elements smaller than the other.
- Galloping is entered when one side wins 7 times in a row (configurable parameter called `MIN_GALLOP`).

### Why Tim Sort Is Optimal for Real-World Data

1. **Adaptive**: O(n) for already-sorted data and nearly-sorted data.
2. **Stable**: Preserves original order of equal elements.
3. **Exploits existing order**: Real-world data often has natural runs.
4. **Used by default** in:
   - Python (`list.sort()` and `sorted()`)
   - Java (`Arrays.sort()` for objects)
   - Android, V8 JavaScript engine, Swift, Rust
5. **Worst case O(n log n)**, best case O(n).

### Simplified Tim Sort Skeleton (Python)

```python
MIN_RUN = 32

def insertion_sort_range(arr, left, right):
    """Insertion sort on arr[left..right]."""
    for i in range(left + 1, right + 1):
        key = arr[i]
        j = i - 1
        while j >= left and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key

def tim_sort(arr):
    """Simplified Tim Sort implementation."""
    n = len(arr)

    # Sort individual runs using Insertion Sort
    for start in range(0, n, MIN_RUN):
        end = min(start + MIN_RUN - 1, n - 1)
        insertion_sort_range(arr, start, end)

    # Merge runs, doubling merge size each iteration
    size = MIN_RUN
    while size < n:
        for left in range(0, n, 2 * size):
            mid = min(left + size - 1, n - 1)
            right = min(left + 2 * size - 1, n - 1)
            if mid < right:
                merge_inplace(arr, left, mid, right)
        size *= 2

def merge_inplace(arr, left, mid, right):
    """Merge arr[left..mid] and arr[mid+1..right]."""
    left_part = arr[left:mid + 1]
    right_part = arr[mid + 1:right + 1]

    i = j = 0
    k = left
    while i < len(left_part) and j < len(right_part):
        if left_part[i] <= right_part[j]:
            arr[k] = left_part[i]
            i += 1
        else:
            arr[k] = right_part[j]
            j += 1
        k += 1

    while i < len(left_part):
        arr[k] = left_part[i]
        i += 1
        k += 1
    while j < len(right_part):
        arr[k] = right_part[j]
        j += 1
        k += 1
```

---

## Shell Sort

Shell Sort is a generalization of Insertion Sort that allows the exchange of elements that are far apart. It works by sorting elements at a specific gap interval, then progressively reducing the gap until it becomes 1 (at which point it becomes a standard Insertion Sort on a nearly-sorted array).

### Implementation (Python)

```python
def shell_sort(arr: list) -> list:
    """Shell Sort with Knuth's gap sequence: 1, 4, 13, 40, 121, ..."""
    n = len(arr)
    gap = 1
    while gap < n // 3:
        gap = gap * 3 + 1  # Knuth's sequence

    while gap > 0:
        for i in range(gap, n):
            temp = arr[i]
            j = i
            while j >= gap and arr[j - gap] > temp:
                arr[j] = arr[j - gap]
                j -= gap
            arr[j] = temp
        gap //= 3

    return arr
```

### Gap Sequences and Their Complexities

```
Sequence                    Worst Case       Who
------------------------------------------------------------
Shell's original (N/2^k)    O(n^2)           Shell, 1959
Knuth (3^k - 1) / 2         O(n^(3/2))       Knuth, 1973
Sedgewick                    O(n^(4/3))       Sedgewick, 1986
Ciura                        O(?)             Ciura, 2001 (empirically best)
  [1, 4, 10, 23, 57, 132, 301, 701]
```

---

## When to Use Which — Decision Guide

```
Scenario                          Recommended Algorithm
--------------------------------------------------------------
Small arrays (n < 50)             Insertion Sort
Nearly sorted data                Insertion Sort or Tim Sort
General purpose                   Quick Sort or Tim Sort
Guaranteed O(n log n) needed      Merge Sort or Heap Sort
Stability required                Merge Sort or Tim Sort
Linked lists                      Merge Sort
External sorting (disk-based)     Merge Sort (k-way merge)
Minimal memory usage              Heap Sort or Quick Sort
Many duplicate keys               3-Way Quick Sort
Parallel sorting                  Merge Sort
Embedded systems (low memory)     Shell Sort or Heap Sort
Standard library sort             Tim Sort (Python, Java)
                                  IntroSort (C++ std::sort)
```

### IntroSort: The Pragmatic Hybrid

Most C++ standard library implementations use IntroSort, which combines:
1. **Quick Sort** for general sorting (fast average case).
2. **Heap Sort** as fallback when recursion depth exceeds 2*log2(n) (prevents O(n^2) worst case).
3. **Insertion Sort** for small partitions (n < 16).

This gives O(n log n) worst case with the practical speed of Quick Sort.

---

## Summary of Key Takeaways

1. **O(n log n) is the theoretical lower bound** for comparison-based sorting.
2. **Quick Sort** is fastest in practice due to cache locality and small constants.
3. **Merge Sort** is the go-to for stability, linked lists, and external sorting.
4. **Tim Sort** is the champion for real-world data with existing order.
5. **Insertion Sort** is the best quadratic sort and is essential as a building block.
6. **Heap Sort** provides guaranteed O(n log n) with O(1) extra space.
7. Modern standard libraries use **hybrid algorithms** (TimSort, IntroSort) that combine the strengths of multiple algorithms.

---

## Sources

- Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2009). *Introduction to Algorithms* (3rd ed.), Chapters 2, 6, 7, 8. MIT Press.
- Sedgewick, R. & Wayne, K. (2011). *Algorithms* (4th ed.), Chapter 2. Addison-Wesley.
- Knuth, D. E. (1998). *The Art of Computer Programming, Vol. 3: Sorting and Searching* (2nd ed.). Addison-Wesley.
- Peters, T. (2002). *Timsort description*. Python source code: https://github.com/python/cpython/blob/main/Objects/listsort.txt
- Wikipedia. *Sorting algorithm*. https://en.wikipedia.org/wiki/Sorting_algorithm
- Wikipedia. *Comparison sort*. https://en.wikipedia.org/wiki/Comparison_sort
- Musser, D. R. (1997). "Introspective Sorting and Selection Algorithms." *Software: Practice and Experience*, 27(8), 983-993.
