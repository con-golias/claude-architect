# Two Pointers & Sliding Window

> **Domain**: Fundamentals > Algorithms > Searching > Two Pointers & Sliding Window
> **Difficulty**: Intermediate
> **Last Updated**: 2026-03-07

---

## What It Is

Two Pointers and Sliding Window are algorithmic techniques that use pointer manipulation to solve array and string problems efficiently. They typically reduce a brute-force **O(n^2)** or **O(n^3)** approach to **O(n)** by avoiding redundant work.

### Core Insight

Instead of examining every possible pair or subarray (nested loops), these techniques maintain a "window" or "pointer pair" that slides through the data, processing each element at most a constant number of times.

```
Brute Force (nested loops):       Two Pointers / Sliding Window:
for i in range(n):                left, right = 0, 0
    for j in range(i, n):         while right < n:
        # check (i, j)               # process, move left or right
        # O(n^2)                      # O(n)
```

---

## Two Pointers Technique

The Two Pointers technique uses two index variables that traverse the data structure in a coordinated way. There are three main patterns.

---

### Pattern 1: Opposite Direction (Converging Pointers)

Two pointers start at opposite ends and move toward each other. Used when the answer involves a pair of elements from a sorted array or when checking symmetric properties.

#### Problem: Two Sum in Sorted Array

Given a sorted array and a target sum, find two numbers that add up to the target.

**Python:**

```python
def two_sum_sorted(arr: list[int], target: int) -> list[int]:
    """
    Find two indices whose values sum to target in a sorted array.
    Time: O(n), Space: O(1)

    Why it works: if sum < target, we need a larger sum (move left pointer right).
    If sum > target, we need a smaller sum (move right pointer left).
    """
    left, right = 0, len(arr) - 1

    while left < right:
        current_sum = arr[left] + arr[right]

        if current_sum == target:
            return [left, right]
        elif current_sum < target:
            left += 1    # Need larger sum -> increase smaller element
        else:
            right -= 1   # Need smaller sum -> decrease larger element

    return []  # No pair found
```

**TypeScript:**

```typescript
function twoSumSorted(arr: number[], target: number): number[] {
    let left = 0;
    let right = arr.length - 1;

    while (left < right) {
        const sum = arr[left] + arr[right];
        if (sum === target) {
            return [left, right];
        } else if (sum < target) {
            left++;
        } else {
            right--;
        }
    }
    return [];
}
```

**ASCII Trace:**

```
Array:  [2, 7, 11, 15]    Target: 9
         ^            ^
        left        right

Step 1: sum = 2 + 15 = 17 > 9  ->  right--
         ^        ^
        left    right

Step 2: sum = 2 + 11 = 13 > 9  ->  right--
         ^    ^
        left right

Step 3: sum = 2 + 7 = 9 == 9   ->  FOUND! [0, 1]
```

#### Problem: Container With Most Water

Given heights, find two lines that together with the x-axis form a container holding the most water.

**Python:**

```python
def max_area(height: list[int]) -> int:
    """
    Container With Most Water (LeetCode 11).
    Time: O(n), Space: O(1)

    Strategy: Start with the widest container. Move the shorter side inward
    because the area is limited by the shorter line, and moving the taller
    side inward can only decrease the width without increasing the height.
    """
    left, right = 0, len(height) - 1
    max_water = 0

    while left < right:
        width = right - left
        h = min(height[left], height[right])
        max_water = max(max_water, width * h)

        # Move the pointer with the shorter height
        if height[left] < height[right]:
            left += 1
        else:
            right -= 1

    return max_water
```

**TypeScript:**

```typescript
function maxArea(height: number[]): number {
    let left = 0;
    let right = height.length - 1;
    let maxWater = 0;

    while (left < right) {
        const width = right - left;
        const h = Math.min(height[left], height[right]);
        maxWater = Math.max(maxWater, width * h);

        if (height[left] < height[right]) {
            left++;
        } else {
            right--;
        }
    }
    return maxWater;
}
```

#### Problem: Valid Palindrome

Check if a string is a palindrome, considering only alphanumeric characters and ignoring case.

**Python:**

```python
def is_palindrome(s: str) -> bool:
    """
    Valid Palindrome (LeetCode 125).
    Time: O(n), Space: O(1)
    """
    left, right = 0, len(s) - 1

    while left < right:
        # Skip non-alphanumeric characters
        while left < right and not s[left].isalnum():
            left += 1
        while left < right and not s[right].isalnum():
            right -= 1

        if s[left].lower() != s[right].lower():
            return False

        left += 1
        right -= 1

    return True
```

**TypeScript:**

```typescript
function isPalindrome(s: string): boolean {
    let left = 0;
    let right = s.length - 1;

    while (left < right) {
        while (left < right && !isAlphanumeric(s[left])) left++;
        while (left < right && !isAlphanumeric(s[right])) right--;

        if (s[left].toLowerCase() !== s[right].toLowerCase()) {
            return false;
        }
        left++;
        right--;
    }
    return true;
}

function isAlphanumeric(ch: string): boolean {
    return /[a-zA-Z0-9]/.test(ch);
}
```

#### Problem: Three Sum (Extension of Two Pointers)

Find all unique triplets that sum to zero. Sort the array, fix one element, then use two-pointer on the remaining.

**Python:**

```python
def three_sum(nums: list[int]) -> list[list[int]]:
    """
    3Sum (LeetCode 15).
    Time: O(n^2), Space: O(1) excluding output.
    Fix one element, use two pointers for the remaining pair.
    """
    nums.sort()
    result = []

    for i in range(len(nums) - 2):
        # Skip duplicates for the first element
        if i > 0 and nums[i] == nums[i - 1]:
            continue

        left, right = i + 1, len(nums) - 1
        target = -nums[i]

        while left < right:
            current_sum = nums[left] + nums[right]

            if current_sum == target:
                result.append([nums[i], nums[left], nums[right]])
                # Skip duplicates
                while left < right and nums[left] == nums[left + 1]:
                    left += 1
                while left < right and nums[right] == nums[right - 1]:
                    right -= 1
                left += 1
                right -= 1
            elif current_sum < target:
                left += 1
            else:
                right -= 1

    return result
```

---

### Pattern 2: Same Direction (Fast/Slow Pointers)

Both pointers start at the same position and move in the same direction, but at different speeds or with different conditions for advancement. Also known as the "tortoise and hare" pattern.

#### Problem: Remove Duplicates from Sorted Array

Given a sorted array, remove duplicates in-place and return the new length.

**Python:**

```python
def remove_duplicates(nums: list[int]) -> int:
    """
    Remove Duplicates from Sorted Array (LeetCode 26).
    Time: O(n), Space: O(1)

    slow: points to the position where the next unique element will go.
    fast: scans through the array looking for new unique elements.
    """
    if not nums:
        return 0

    slow = 0  # Position of last unique element

    for fast in range(1, len(nums)):
        if nums[fast] != nums[slow]:
            slow += 1
            nums[slow] = nums[fast]

    return slow + 1  # Length of unique portion
```

**TypeScript:**

```typescript
function removeDuplicates(nums: number[]): number {
    if (nums.length === 0) return 0;

    let slow = 0;

    for (let fast = 1; fast < nums.length; fast++) {
        if (nums[fast] !== nums[slow]) {
            slow++;
            nums[slow] = nums[fast];
        }
    }
    return slow + 1;
}
```

**ASCII Trace:**

```
Input: [1, 1, 2, 2, 3]
        s
        f

Step 1: fast=1, nums[1]=1 == nums[0]=1 -> skip
        [1, 1, 2, 2, 3]
         s     f

Step 2: fast=2, nums[2]=2 != nums[0]=1 -> slow++, copy
        [1, 2, 2, 2, 3]
            s     f

Step 3: fast=3, nums[3]=2 == nums[1]=2 -> skip
        [1, 2, 2, 2, 3]
            s        f

Step 4: fast=4, nums[4]=3 != nums[1]=2 -> slow++, copy
        [1, 2, 3, 2, 3]
               s        f (out of bounds)

Return: slow + 1 = 3 (first 3 elements are unique: [1, 2, 3])
```

#### Problem: Linked List Cycle Detection (Floyd's Algorithm)

Detect if a linked list has a cycle using slow (1 step) and fast (2 steps) pointers.

**Python:**

```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


def has_cycle(head: ListNode) -> bool:
    """
    Floyd's Cycle Detection (LeetCode 141).
    Time: O(n), Space: O(1)

    If there is a cycle, the fast pointer will eventually catch up
    to the slow pointer. If no cycle, fast reaches the end.
    """
    slow = fast = head

    while fast and fast.next:
        slow = slow.next        # 1 step
        fast = fast.next.next   # 2 steps
        if slow == fast:
            return True

    return False


def find_cycle_start(head: ListNode) -> ListNode:
    """
    Find where the cycle begins (LeetCode 142).
    After slow and fast meet, move one pointer back to head.
    Both advance 1 step at a time; they meet at the cycle start.
    """
    slow = fast = head

    # Phase 1: Detect cycle
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow == fast:
            break
    else:
        return None  # No cycle

    # Phase 2: Find cycle start
    slow = head
    while slow != fast:
        slow = slow.next
        fast = fast.next

    return slow
```

**TypeScript:**

```typescript
class ListNode {
    val: number;
    next: ListNode | null;
    constructor(val = 0, next: ListNode | null = null) {
        this.val = val;
        this.next = next;
    }
}

function hasCycle(head: ListNode | null): boolean {
    let slow = head;
    let fast = head;

    while (fast !== null && fast.next !== null) {
        slow = slow!.next;
        fast = fast.next.next;
        if (slow === fast) return true;
    }
    return false;
}
```

**ASCII Diagram — Floyd's Algorithm:**

```
Linked list with cycle:

  1 -> 2 -> 3 -> 4 -> 5
                  ^         |
                  |         v
                  8 <- 7 <- 6

Step  Slow  Fast
  0    1     1
  1    2     3
  2    3     5
  3    4     7
  4    5     4     (fast lapped around)
  5    6     6     MEET! Cycle detected.

Phase 2: Reset slow to head (1), advance both by 1:
  slow=1, fast=6 -> slow=2, fast=7 -> slow=3, fast=8
  -> slow=4, fast=4 MEET! Cycle starts at node 4.
```

#### Problem: Finding Middle of Linked List

```python
def find_middle(head: ListNode) -> ListNode:
    """
    Find the middle node of a linked list.
    Time: O(n), Space: O(1)
    When fast reaches the end, slow is at the middle.
    """
    slow = fast = head

    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next

    return slow
```

---

### Pattern 3: Two Separate Arrays

Two pointers, each traversing a different array. Used for merging, comparing, or finding intersections.

#### Problem: Merge Two Sorted Arrays

**Python:**

```python
def merge_sorted(arr1: list[int], arr2: list[int]) -> list[int]:
    """
    Merge two sorted arrays into one sorted array.
    Time: O(n + m), Space: O(n + m)
    """
    result = []
    i, j = 0, 0

    while i < len(arr1) and j < len(arr2):
        if arr1[i] <= arr2[j]:
            result.append(arr1[i])
            i += 1
        else:
            result.append(arr2[j])
            j += 1

    result.extend(arr1[i:])
    result.extend(arr2[j:])
    return result
```

**TypeScript:**

```typescript
function mergeSorted(arr1: number[], arr2: number[]): number[] {
    const result: number[] = [];
    let i = 0, j = 0;

    while (i < arr1.length && j < arr2.length) {
        if (arr1[i] <= arr2[j]) {
            result.push(arr1[i++]);
        } else {
            result.push(arr2[j++]);
        }
    }

    while (i < arr1.length) result.push(arr1[i++]);
    while (j < arr2.length) result.push(arr2[j++]);

    return result;
}
```

#### Problem: Intersection of Two Sorted Arrays

```python
def intersection_sorted(arr1: list[int], arr2: list[int]) -> list[int]:
    """
    Find common elements in two sorted arrays.
    Time: O(n + m), Space: O(min(n, m))
    """
    result = []
    i, j = 0, 0

    while i < len(arr1) and j < len(arr2):
        if arr1[i] == arr2[j]:
            # Avoid duplicates in result
            if not result or result[-1] != arr1[i]:
                result.append(arr1[i])
            i += 1
            j += 1
        elif arr1[i] < arr2[j]:
            i += 1
        else:
            j += 1

    return result
```

---

## Sliding Window Technique

The Sliding Window technique maintains a contiguous subarray (or substring) — the "window" — and slides it across the data. There are two main patterns: fixed-size and variable-size windows.

---

### Fixed-Size Window

The window size is known in advance. Slide it across the array, updating the window state by removing the leftmost element and adding the next element.

#### Problem: Maximum Sum Subarray of Size K

**Python:**

```python
def max_sum_subarray(arr: list[int], k: int) -> int:
    """
    Find the maximum sum of any contiguous subarray of size k.
    Time: O(n), Space: O(1)
    """
    if len(arr) < k:
        return 0

    # Compute sum of first window
    window_sum = sum(arr[:k])
    max_sum = window_sum

    # Slide window: remove left element, add right element
    for i in range(k, len(arr)):
        window_sum += arr[i] - arr[i - k]
        max_sum = max(max_sum, window_sum)

    return max_sum
```

**TypeScript:**

```typescript
function maxSumSubarray(arr: number[], k: number): number {
    if (arr.length < k) return 0;

    let windowSum = 0;
    for (let i = 0; i < k; i++) {
        windowSum += arr[i];
    }

    let maxSum = windowSum;

    for (let i = k; i < arr.length; i++) {
        windowSum += arr[i] - arr[i - k];
        maxSum = Math.max(maxSum, windowSum);
    }

    return maxSum;
}
```

**ASCII Trace:**

```
Array: [2, 1, 5, 1, 3, 2], k = 3

Window 1: [2, 1, 5] = 8
           ^-----^
Window 2: [1, 5, 1] = 7    (remove 2, add 1)
              ^-----^
Window 3: [5, 1, 3] = 9    (remove 1, add 3)
                 ^-----^
Window 4: [1, 3, 2] = 6    (remove 5, add 2)
                    ^-----^

Maximum sum = 9 (window [5, 1, 3])
```

#### Problem: Find All Anagrams in a String

Given a string s and a pattern p, find all starting indices of p's anagrams in s.

**Python:**

```python
from collections import Counter

def find_anagrams(s: str, p: str) -> list[int]:
    """
    Find All Anagrams in a String (LeetCode 438).
    Time: O(n), Space: O(k) where k = unique chars in p.
    Uses a fixed window of size len(p).
    """
    if len(p) > len(s):
        return []

    p_count = Counter(p)
    window_count = Counter(s[:len(p)])
    result = []

    if window_count == p_count:
        result.append(0)

    for i in range(len(p), len(s)):
        # Add new character to window
        window_count[s[i]] += 1

        # Remove old character from window
        old_char = s[i - len(p)]
        window_count[old_char] -= 1
        if window_count[old_char] == 0:
            del window_count[old_char]

        if window_count == p_count:
            result.append(i - len(p) + 1)

    return result
```

**TypeScript:**

```typescript
function findAnagrams(s: string, p: string): number[] {
    if (p.length > s.length) return [];

    const pCount = new Map<string, number>();
    const windowCount = new Map<string, number>();
    const result: number[] = [];

    for (const ch of p) {
        pCount.set(ch, (pCount.get(ch) ?? 0) + 1);
    }

    for (let i = 0; i < p.length; i++) {
        windowCount.set(s[i], (windowCount.get(s[i]) ?? 0) + 1);
    }

    if (mapsEqual(windowCount, pCount)) result.push(0);

    for (let i = p.length; i < s.length; i++) {
        // Add new char
        windowCount.set(s[i], (windowCount.get(s[i]) ?? 0) + 1);

        // Remove old char
        const oldChar = s[i - p.length];
        const oldCount = windowCount.get(oldChar)! - 1;
        if (oldCount === 0) {
            windowCount.delete(oldChar);
        } else {
            windowCount.set(oldChar, oldCount);
        }

        if (mapsEqual(windowCount, pCount)) {
            result.push(i - p.length + 1);
        }
    }

    return result;
}

function mapsEqual(a: Map<string, number>, b: Map<string, number>): boolean {
    if (a.size !== b.size) return false;
    for (const [key, val] of a) {
        if (b.get(key) !== val) return false;
    }
    return true;
}
```

---

### Variable-Size Window

The window size changes dynamically. The right pointer expands the window, and the left pointer shrinks it when a constraint is violated. This is the more common and more powerful pattern.

#### Problem: Minimum Size Subarray Sum

Find the minimum-length contiguous subarray with sum >= target.

**Python:**

```python
def min_subarray_len(target: int, nums: list[int]) -> int:
    """
    Minimum Size Subarray Sum (LeetCode 209).
    Time: O(n), Space: O(1)

    Expand right to increase sum, shrink left when sum >= target.
    """
    min_len = float('inf')
    window_sum = 0
    left = 0

    for right in range(len(nums)):
        window_sum += nums[right]  # Expand window

        while window_sum >= target:
            min_len = min(min_len, right - left + 1)
            window_sum -= nums[left]  # Shrink window
            left += 1

    return min_len if min_len != float('inf') else 0
```

**TypeScript:**

```typescript
function minSubArrayLen(target: number, nums: number[]): number {
    let minLen = Infinity;
    let windowSum = 0;
    let left = 0;

    for (let right = 0; right < nums.length; right++) {
        windowSum += nums[right];

        while (windowSum >= target) {
            minLen = Math.min(minLen, right - left + 1);
            windowSum -= nums[left];
            left++;
        }
    }

    return minLen === Infinity ? 0 : minLen;
}
```

**ASCII Trace:**

```
nums = [2, 3, 1, 2, 4, 3], target = 7

right=0: sum=2,  [2]                        sum < 7
right=1: sum=5,  [2, 3]                     sum < 7
right=2: sum=6,  [2, 3, 1]                  sum < 7
right=3: sum=8,  [2, 3, 1, 2]               sum >= 7! len=4, shrink
         sum=6,     [3, 1, 2]               sum < 7
right=4: sum=10,    [3, 1, 2, 4]            sum >= 7! len=4, shrink
         sum=7,        [1, 2, 4]            sum >= 7! len=3, shrink
         sum=6,           [2, 4]            sum < 7
right=5: sum=9,           [2, 4, 3]         sum >= 7! len=3, shrink
         sum=7,              [4, 3]         sum >= 7! len=2, shrink
         sum=3,                 [3]         sum < 7

Minimum length = 2 (subarray [4, 3])
```

#### Problem: Longest Substring Without Repeating Characters

**Python:**

```python
def length_of_longest_substring(s: str) -> int:
    """
    Longest Substring Without Repeating Characters (LeetCode 3).
    Time: O(n), Space: O(min(n, charset_size))
    """
    char_index = {}  # Maps character to its most recent index
    max_len = 0
    left = 0

    for right in range(len(s)):
        if s[right] in char_index and char_index[s[right]] >= left:
            # Character is repeated within current window
            left = char_index[s[right]] + 1

        char_index[s[right]] = right
        max_len = max(max_len, right - left + 1)

    return max_len
```

**TypeScript:**

```typescript
function lengthOfLongestSubstring(s: string): number {
    const charIndex = new Map<string, number>();
    let maxLen = 0;
    let left = 0;

    for (let right = 0; right < s.length; right++) {
        const lastSeen = charIndex.get(s[right]);
        if (lastSeen !== undefined && lastSeen >= left) {
            left = lastSeen + 1;
        }
        charIndex.set(s[right], right);
        maxLen = Math.max(maxLen, right - left + 1);
    }

    return maxLen;
}
```

**ASCII Trace:**

```
s = "abcabcbb"

right=0: char='a', window="a",     left=0, len=1, max=1
right=1: char='b', window="ab",    left=0, len=2, max=2
right=2: char='c', window="abc",   left=0, len=3, max=3
right=3: char='a', seen at 0!      left=1
         window="bca",  len=3, max=3
right=4: char='b', seen at 1!      left=2
         window="cab",  len=3, max=3
right=5: char='c', seen at 2!      left=3
         window="abc",  len=3, max=3
right=6: char='b', seen at 4!      left=5
         window="cb",   len=2, max=3
right=7: char='b', seen at 6!      left=7
         window="b",    len=1, max=3

Answer: 3 ("abc")
```

#### Problem: Minimum Window Substring (Hard Classic)

Given strings s and t, find the minimum window in s that contains all characters of t.

**Python:**

```python
from collections import Counter

def min_window(s: str, t: str) -> str:
    """
    Minimum Window Substring (LeetCode 76).
    Time: O(n + m), Space: O(m) where n = len(s), m = len(t)

    Expand right to find a valid window, shrink left to minimize it.
    """
    if not s or not t or len(s) < len(t):
        return ""

    # Count characters needed
    need = Counter(t)
    have = {}
    formed = 0          # Number of characters with sufficient count
    required = len(need) # Number of unique characters needed

    min_len = float('inf')
    min_start = 0
    left = 0

    for right in range(len(s)):
        char = s[right]
        have[char] = have.get(char, 0) + 1

        # Check if this character satisfies its requirement
        if char in need and have[char] == need[char]:
            formed += 1

        # Try to shrink window while it's still valid
        while formed == required:
            # Update minimum
            window_len = right - left + 1
            if window_len < min_len:
                min_len = window_len
                min_start = left

            # Remove leftmost character
            left_char = s[left]
            have[left_char] -= 1
            if left_char in need and have[left_char] < need[left_char]:
                formed -= 1
            left += 1

    return s[min_start:min_start + min_len] if min_len != float('inf') else ""
```

**TypeScript:**

```typescript
function minWindow(s: string, t: string): string {
    if (s.length < t.length) return "";

    const need = new Map<string, number>();
    for (const ch of t) {
        need.set(ch, (need.get(ch) ?? 0) + 1);
    }

    const have = new Map<string, number>();
    let formed = 0;
    const required = need.size;
    let minLen = Infinity;
    let minStart = 0;
    let left = 0;

    for (let right = 0; right < s.length; right++) {
        const ch = s[right];
        have.set(ch, (have.get(ch) ?? 0) + 1);

        if (need.has(ch) && have.get(ch) === need.get(ch)) {
            formed++;
        }

        while (formed === required) {
            const windowLen = right - left + 1;
            if (windowLen < minLen) {
                minLen = windowLen;
                minStart = left;
            }

            const leftChar = s[left];
            have.set(leftChar, have.get(leftChar)! - 1);
            if (need.has(leftChar) && have.get(leftChar)! < need.get(leftChar)!) {
                formed--;
            }
            left++;
        }
    }

    return minLen === Infinity ? "" : s.substring(minStart, minStart + minLen);
}
```

---

## Template Patterns

### Two Pointers Template — Converging

```python
def two_pointers_converging(arr: list, target: int):
    """
    Template for converging two pointers on a sorted array.
    Use for: two sum, container with most water, trapping rain water.
    """
    left, right = 0, len(arr) - 1

    while left < right:
        current = arr[left] + arr[right]  # or some function of both

        if current == target:
            return [left, right]
        elif current < target:
            left += 1     # Need larger value
        else:
            right -= 1    # Need smaller value

    return []  # No solution found
```

### Two Pointers Template — Fast/Slow

```python
def two_pointers_fast_slow(arr: list):
    """
    Template for same-direction two pointers.
    Use for: remove duplicates, partition, move zeros.
    """
    slow = 0  # Boundary of "processed" section

    for fast in range(len(arr)):
        if meets_condition(arr[fast]):
            arr[slow] = arr[fast]
            slow += 1

    return slow  # Length of processed section
```

### Sliding Window Template — Fixed Size

```python
def fixed_sliding_window(arr: list, k: int):
    """
    Template for fixed-size sliding window.
    Use for: max sum of size k, string anagrams, rolling statistics.
    """
    # Initialize first window
    window_state = initialize(arr[:k])
    best = evaluate(window_state)

    for i in range(k, len(arr)):
        # Slide: remove arr[i-k], add arr[i]
        remove_from_window(window_state, arr[i - k])
        add_to_window(window_state, arr[i])
        best = update_best(best, evaluate(window_state))

    return best
```

### Sliding Window Template — Variable Size

```python
def variable_sliding_window(s: str):
    """
    Template for variable-size sliding window.
    Use for: longest/shortest substring with constraint.
    """
    window = {}    # Window state (e.g., character counts)
    left = 0
    result = 0     # or float('inf') for minimum

    for right in range(len(s)):
        # EXPAND: add s[right] to window
        add_to_window(window, s[right])

        # SHRINK: while window violates the constraint
        while window_is_invalid(window):
            remove_from_window(window, s[left])
            left += 1

        # UPDATE: record the best valid window
        result = max(result, right - left + 1)   # for longest
        # result = min(result, right - left + 1) # for shortest

    return result
```

---

## Prefix Sum

Prefix Sum is a related technique that precomputes cumulative sums to enable **O(1) range sum queries** after O(n) preprocessing.

### How It Works

```
Array:      [1, 2, 3, 4, 5]
Prefix Sum: [0, 1, 3, 6, 10, 15]

Sum of arr[i..j] = prefix[j+1] - prefix[i]

Example: Sum of arr[1..3] = prefix[4] - prefix[1] = 10 - 1 = 9
         (2 + 3 + 4 = 9)
```

### Implementation (Python)

```python
def build_prefix_sum(arr: list[int]) -> list[int]:
    """
    Build prefix sum array.
    prefix[i] = sum of arr[0..i-1]
    prefix[0] = 0
    """
    prefix = [0] * (len(arr) + 1)
    for i in range(len(arr)):
        prefix[i + 1] = prefix[i] + arr[i]
    return prefix


def range_sum(prefix: list[int], left: int, right: int) -> int:
    """Sum of arr[left..right] (inclusive) in O(1)."""
    return prefix[right + 1] - prefix[left]
```

### Implementation (TypeScript)

```typescript
function buildPrefixSum(arr: number[]): number[] {
    const prefix = new Array(arr.length + 1).fill(0);
    for (let i = 0; i < arr.length; i++) {
        prefix[i + 1] = prefix[i] + arr[i];
    }
    return prefix;
}

function rangeSum(prefix: number[], left: number, right: number): number {
    return prefix[right + 1] - prefix[left];
}
```

### Application: Subarray Sum Equals K

```python
def subarray_sum(nums: list[int], k: int) -> int:
    """
    Count subarrays with sum equal to k (LeetCode 560).
    Time: O(n), Space: O(n)

    Key insight: if prefix[j] - prefix[i] == k, then subarray [i..j-1] sums to k.
    So we need to find pairs where prefix[j] - k == prefix[i].
    Use a hash map to count prefix sums seen so far.
    """
    count = 0
    current_sum = 0
    prefix_counts = {0: 1}  # Empty prefix has sum 0

    for num in nums:
        current_sum += num
        # How many previous prefix sums equal current_sum - k?
        count += prefix_counts.get(current_sum - k, 0)
        prefix_counts[current_sum] = prefix_counts.get(current_sum, 0) + 1

    return count
```

### Application: Equilibrium Index

Find an index where the sum of elements to the left equals the sum to the right.

```python
def equilibrium_index(arr: list[int]) -> int:
    """
    Find equilibrium index: left_sum == right_sum.
    Time: O(n), Space: O(1)
    """
    total = sum(arr)
    left_sum = 0

    for i in range(len(arr)):
        right_sum = total - left_sum - arr[i]
        if left_sum == right_sum:
            return i
        left_sum += arr[i]

    return -1
```

---

## When to Use Which

```
Problem Pattern                                Technique
-------------------------------------------------------------------
Pair that satisfies condition (sorted)         Two pointers (converging)
Three sum, four sum                            Fix element + two pointers
Cycle or middle in linked list                 Two pointers (fast/slow)
Remove duplicates / partition in-place         Two pointers (fast/slow)
Merge sorted arrays/lists                      Two pointers (two arrays)
Fixed-size subarray property                   Fixed sliding window
Min/max subarray with constraint               Variable sliding window
Longest/shortest substring with constraint     Variable sliding window
Range sum queries                              Prefix sum
Subarray sum equals k                          Prefix sum + hash map
Count subarrays with condition on sum          Prefix sum + hash map
```

---

## Complexity Analysis: How These Techniques Reduce Time Complexity

### Example: Two Sum (Sorted Array)

```
Brute Force:
  for i in range(n):              # O(n)
      for j in range(i+1, n):     # O(n)
          if arr[i]+arr[j]==target # O(1)
  Total: O(n^2)

Two Pointers:
  left, right = 0, n-1            # O(1)
  while left < right:             # Each iteration moves one pointer
      ...                         # At most n iterations total
  Total: O(n)

Why? Each element is visited at most once by each pointer.
     left only moves right, right only moves left.
     Combined they can move at most n times.
```

### Example: Maximum Sum Subarray of Size K

```
Brute Force:
  for i in range(n-k+1):          # O(n)
      total = sum(arr[i:i+k])     # O(k)
  Total: O(n*k)

Fixed Sliding Window:
  Compute first window: O(k)
  Slide n-k times: each slide is O(1) (add one, remove one)
  Total: O(n)

Why? We avoid recomputing the entire sum.
     Adding one element and removing one is O(1) instead of O(k).
```

### Example: Longest Substring Without Repeating Characters

```
Brute Force:
  for i in range(n):              # O(n)
      for j in range(i, n):       # O(n)
          if all_unique(s[i:j+1]) # O(n) to check
  Total: O(n^3)

Variable Sliding Window:
  left and right each traverse the string once
  Each character is added once and removed at most once
  Total: O(n)

Why? The key invariant: left only moves right, right only moves right.
     Combined work is at most 2n operations.
```

### Amortized Analysis

For the variable sliding window:
- The right pointer moves from 0 to n-1: **n moves**.
- The left pointer can move at most from 0 to n-1 across all iterations: **at most n moves**.
- Total operations: **at most 2n = O(n)**.

Even though there is a `while` loop inside the `for` loop, the total iterations of the inner loop across all outer iterations is bounded by n.

---

## Common Variations and Extensions

### Sliding Window Maximum (Monotonic Deque)

```python
from collections import deque

def max_sliding_window(nums: list[int], k: int) -> list[int]:
    """
    Maximum in each window of size k (LeetCode 239).
    Time: O(n), Space: O(k)
    Uses a monotonic decreasing deque.
    """
    dq = deque()  # Stores indices, front is always the max
    result = []

    for i in range(len(nums)):
        # Remove elements outside window
        while dq and dq[0] < i - k + 1:
            dq.popleft()

        # Remove smaller elements (they can never be the max)
        while dq and nums[dq[-1]] < nums[i]:
            dq.pop()

        dq.append(i)

        # Window is fully formed starting at i = k-1
        if i >= k - 1:
            result.append(nums[dq[0]])

    return result
```

### Multi-Pointer: K-way Merge

```python
import heapq

def merge_k_sorted(lists: list[list[int]]) -> list[int]:
    """
    Merge k sorted lists using a min-heap.
    Time: O(n log k) where n = total elements.
    """
    heap = []
    for i, lst in enumerate(lists):
        if lst:
            heapq.heappush(heap, (lst[0], i, 0))

    result = []
    while heap:
        val, list_idx, elem_idx = heapq.heappop(heap)
        result.append(val)

        if elem_idx + 1 < len(lists[list_idx]):
            next_val = lists[list_idx][elem_idx + 1]
            heapq.heappush(heap, (next_val, list_idx, elem_idx + 1))

    return result
```

---

## Summary of Key Takeaways

1. **Two Pointers and Sliding Window reduce O(n^2) to O(n)** by avoiding redundant computation.
2. **Converging pointers** work on sorted arrays; **fast/slow pointers** work on linked lists and in-place array operations.
3. **Fixed sliding window** is for problems with a known window size; **variable sliding window** is for optimization problems (longest/shortest with constraint).
4. **Prefix sum** enables O(1) range queries and is combinable with hash maps for subarray sum problems.
5. These techniques are among the **most frequently tested** in coding interviews and competitive programming.
6. Master the templates, then adapt them to specific problems.

---

## Sources

- LeetCode. *Two Pointers problems collection*. https://leetcode.com/tag/two-pointers/
- LeetCode. *Sliding Window problems collection*. https://leetcode.com/tag/sliding-window/
- GeeksforGeeks. *Two Pointers Technique*. https://www.geeksforgeeks.org/two-pointers-technique/
- GeeksforGeeks. *Window Sliding Technique*. https://www.geeksforgeeks.org/window-sliding-technique/
- Huang, S. *Sliding Window Algorithm Pattern*. https://leetcode.com/discuss/study-guide/657507/sliding-window-for-beginners-problems-template-sample-solutions
- Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- competitive-programming-algorithms. *Prefix Sum*. https://cp-algorithms.com/data_structures/prefix_sum.html
