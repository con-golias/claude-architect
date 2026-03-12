# Bit Manipulation

> **Domain**: Fundamentals > Algorithms > Bit Manipulation
> **Difficulty**: Intermediate
> **Last Updated**: 2026-03-07

---

## What It Is

Bit manipulation uses bitwise operators to perform operations at the binary level. It is the fastest form of computation -- most bitwise operations execute in a single CPU cycle -- and appears extensively in systems programming, cryptography, compression, graphics, network protocols, and competitive programming.

Every integer in memory is stored as a sequence of bits (binary digits, 0 or 1). Bit manipulation operates directly on these bits rather than treating the number as an abstract decimal value. This gives programmers fine-grained control over data at the lowest level and enables significant performance optimizations.

Key advantages:
- **Speed**: bitwise operations are among the fastest CPU instructions.
- **Space efficiency**: store multiple boolean flags in a single integer.
- **Elegance**: many complex operations reduce to a single bitwise expression.
- **Hardware proximity**: directly maps to how CPUs actually process data.

---

## Bitwise Operators

### Reference Table

```
Operator   Symbol   Description              Example (5=101, 3=011)
──────────────────────────────────────────────────────────────────
AND        &        Both bits 1              101 & 011 = 001 (1)
OR         |        Either bit 1             101 | 011 = 111 (7)
XOR        ^        Different bits           101 ^ 011 = 110 (6)
NOT        ~        Flip all bits            ~101 = ...11111010 (-6)
Left Shift <<       Multiply by 2^k          101 << 1 = 1010 (10)
Right Shift >>      Divide by 2^k            101 >> 1 = 10 (2)
```

### Truth Tables

```
AND (&)        OR (|)         XOR (^)        NOT (~)
A B | A&B      A B | A|B      A B | A^B      A | ~A
0 0 |  0       0 0 |  0       0 0 |  0       0 |  1
0 1 |  0       0 1 |  1       0 1 |  1       1 |  0
1 0 |  0       1 0 |  1       1 0 |  1
1 1 |  1       1 1 |  1       1 1 |  0
```

### Examples in Python

```python
a, b = 5, 3  # 5 = 0b101, 3 = 0b011

print(f"AND:  {a} & {b} = {a & b}")       # 1   (001)
print(f"OR:   {a} | {b} = {a | b}")       # 7   (111)
print(f"XOR:  {a} ^ {b} = {a ^ b}")       # 6   (110)
print(f"NOT:  ~{a} = {~a}")               # -6  (two's complement)
print(f"LSHIFT: {a} << 1 = {a << 1}")     # 10  (1010)
print(f"RSHIFT: {a} >> 1 = {a >> 1}")     # 2   (10)
```

### Examples in TypeScript

```typescript
const a = 5, b = 3; // 5 = 0b101, 3 = 0b011

console.log(`AND:    ${a} & ${b} = ${a & b}`);       // 1
console.log(`OR:     ${a} | ${b} = ${a | b}`);       // 7
console.log(`XOR:    ${a} ^ ${b} = ${a ^ b}`);       // 6
console.log(`NOT:    ~${a} = ${~a}`);                 // -6
console.log(`LSHIFT: ${a} << 1 = ${a << 1}`);        // 10
console.log(`RSHIFT: ${a} >> 1 = ${a >> 1}`);        // 2
// Note: JS bitwise operators work on 32-bit signed integers
// Use >>> for unsigned right shift: (-1 >>> 0) = 4294967295
```

### Examples in C++

```cpp
#include <iostream>
#include <bitset>
using namespace std;

int main() {
    int a = 5, b = 3;

    cout << "AND:    " << a << " & " << b << " = " << (a & b) << endl;   // 1
    cout << "OR:     " << a << " | " << b << " = " << (a | b) << endl;   // 7
    cout << "XOR:    " << a << " ^ " << b << " = " << (a ^ b) << endl;   // 6
    cout << "NOT:    ~" << a << " = " << (~a) << endl;                    // -6
    cout << "LSHIFT: " << a << " << 1 = " << (a << 1) << endl;          // 10
    cout << "RSHIFT: " << a << " >> 1 = " << (a >> 1) << endl;          // 2

    // Print binary representation
    cout << "5 in binary: " << bitset<8>(5) << endl;   // 00000101
    cout << "3 in binary: " << bitset<8>(3) << endl;   // 00000011
    return 0;
}
```

---

## Essential Bit Tricks

### Basic Operations

#### 1. Check if n is even

```python
# Python
def is_even(n: int) -> bool:
    return (n & 1) == 0

print(is_even(4))  # True  (100 & 001 = 000)
print(is_even(7))  # False (111 & 001 = 001)
```

```typescript
// TypeScript
function isEven(n: number): boolean {
    return (n & 1) === 0;
}
```

#### 2. Check if n is a power of 2

A power of 2 has exactly one bit set. Subtracting 1 flips that bit and all lower bits. AND-ing gives 0 only for powers of 2.

```python
# Python
def is_power_of_two(n: int) -> bool:
    return n > 0 and (n & (n - 1)) == 0

# 8 = 1000, 7 = 0111 -> 1000 & 0111 = 0000 -> True
# 6 = 0110, 5 = 0101 -> 0110 & 0101 = 0100 -> False
```

```typescript
// TypeScript
function isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
}
```

#### 3. Get the i-th bit

```python
# Python
def get_bit(n: int, i: int) -> int:
    return (n >> i) & 1

print(get_bit(0b1010, 1))  # 1 (bit at position 1)
print(get_bit(0b1010, 0))  # 0 (bit at position 0)
```

```typescript
// TypeScript
function getBit(n: number, i: number): number {
    return (n >> i) & 1;
}
```

#### 4. Set the i-th bit (set to 1)

```python
# Python
def set_bit(n: int, i: int) -> int:
    return n | (1 << i)

print(bin(set_bit(0b1000, 1)))  # 0b1010
```

```typescript
// TypeScript
function setBit(n: number, i: number): number {
    return n | (1 << i);
}
```

#### 5. Clear the i-th bit (set to 0)

```python
# Python
def clear_bit(n: int, i: int) -> int:
    return n & ~(1 << i)

print(bin(clear_bit(0b1010, 1)))  # 0b1000
```

```typescript
// TypeScript
function clearBit(n: number, i: number): number {
    return n & ~(1 << i);
}
```

#### 6. Toggle the i-th bit

```python
# Python
def toggle_bit(n: int, i: int) -> int:
    return n ^ (1 << i)

print(bin(toggle_bit(0b1010, 1)))  # 0b1000 (was 1, now 0)
print(bin(toggle_bit(0b1000, 1)))  # 0b1010 (was 0, now 1)
```

```typescript
// TypeScript
function toggleBit(n: number, i: number): number {
    return n ^ (1 << i);
}
```

#### 7. Clear the lowest set bit

```python
# Python
def clear_lowest_set_bit(n: int) -> int:
    return n & (n - 1)

# 12 = 1100 -> 1100 & 1011 = 1000 (8)
# 10 = 1010 -> 1010 & 1001 = 1000 (8)
```

#### 8. Isolate the lowest set bit

```python
# Python
def isolate_lowest_set_bit(n: int) -> int:
    return n & (-n)

# 12 = 1100 -> 1100 & 0100 = 0100 (4)
# 10 = 1010 -> 1010 & 0110 = 0010 (2)
```

#### 9. Check if exactly two bits are set

```python
# Python
def has_exactly_two_bits(n: int) -> bool:
    return n > 0 and (n & (n - 1)) > 0 and ((n & (n - 1)) & ((n & (n - 1)) - 1)) == 0

# Simpler: clear lowest set bit, then check if result is a power of 2
def has_exactly_two_bits_v2(n: int) -> bool:
    if n <= 0:
        return False
    n = n & (n - 1)     # clear lowest set bit
    return n > 0 and (n & (n - 1)) == 0  # remaining is power of 2
```

---

### Counting Bits

#### Brian Kernighan's Algorithm

Counts set bits by repeatedly clearing the lowest set bit. Runs in O(k) where k is the number of set bits, not the number of total bits.

```python
# Python
def count_bits(n: int) -> int:
    count = 0
    while n:
        n &= n - 1  # clear lowest set bit
        count += 1
    return count

print(count_bits(0b11010110))  # 5
```

```typescript
// TypeScript
function countBits(n: number): number {
    let count = 0;
    while (n) {
        n &= n - 1;
        count++;
    }
    return count;
}
```

```cpp
// C++
int countBits(int n) {
    int count = 0;
    while (n) {
        n &= n - 1;
        count++;
    }
    return count;
}

// Or use built-in:
// __builtin_popcount(n)     for unsigned int
// __builtin_popcountll(n)   for unsigned long long
```

#### Built-in Functions Across Languages

```
Language       Function                   Notes
────────────────────────────────────────────────────
Python         bin(n).count('1')          String-based, simple
               int.bit_count() (3.10+)    Native, fast
Java           Integer.bitCount(n)        Uses optimized intrinsic
               Long.bitCount(n)           For 64-bit
C++            __builtin_popcount(n)      GCC/Clang intrinsic
               std::popcount(n) (C++20)   Standard library
Go             bits.OnesCount(n)          math/bits package
TypeScript     n.toString(2).split('0')   Workaround (no native)
               .join('').length
```

---

### XOR Tricks

XOR has remarkable properties:
- `a ^ a = 0` (self-inverse)
- `a ^ 0 = a` (identity)
- Commutative and associative
- Useful for "cancellation" in pairs

#### XOR Swap (no temporary variable)

```python
# Python
a, b = 5, 3
a ^= b   # a = 5 ^ 3 = 6
b ^= a   # b = 3 ^ 6 = 5
a ^= b   # a = 6 ^ 5 = 3
print(a, b)  # 3, 5
```

```typescript
// TypeScript
let a = 5, b = 3;
a ^= b;  // a = 6
b ^= a;  // b = 5
a ^= b;  // a = 3
// Warning: fails if a and b refer to the same memory location
```

#### Find Single Number (all others appear twice)

```python
# Python
def single_number(nums: list[int]) -> int:
    result = 0
    for n in nums:
        result ^= n
    return result

print(single_number([4, 1, 2, 1, 2]))  # 4
# Because: 4 ^ 1 ^ 2 ^ 1 ^ 2 = 4 ^ (1^1) ^ (2^2) = 4 ^ 0 ^ 0 = 4
```

```typescript
// TypeScript
function singleNumber(nums: number[]): number {
    return nums.reduce((acc, n) => acc ^ n, 0);
}
```

#### Find Two Unique Numbers (all others appear twice)

```python
# Python
def two_unique_numbers(nums: list[int]) -> tuple[int, int]:
    # Step 1: XOR all -> gives xor of the two unique numbers
    xor_all = 0
    for n in nums:
        xor_all ^= n

    # Step 2: Find any set bit (the two numbers differ here)
    diff_bit = xor_all & (-xor_all)  # isolate lowest set bit

    # Step 3: Split into two groups by that bit
    a, b = 0, 0
    for n in nums:
        if n & diff_bit:
            a ^= n
        else:
            b ^= n

    return (a, b)

print(two_unique_numbers([1, 2, 1, 3, 2, 5]))  # (3, 5) or (5, 3)
```

---

### Arithmetic with Bits

```python
# Python — Arithmetic bit tricks

# Multiply by 2^k
def multiply_pow2(n: int, k: int) -> int:
    return n << k
# 5 << 3 = 40 (5 * 8)

# Divide by 2^k (floor division for positive numbers)
def divide_pow2(n: int, k: int) -> int:
    return n >> k
# 40 >> 3 = 5

# Fast modulo by power of 2: n % m == n & (m - 1) when m is power of 2
def fast_mod_pow2(n: int, m: int) -> int:
    return n & (m - 1)
# 29 & (8 - 1) = 29 & 7 = 11101 & 00111 = 00101 = 5  (same as 29 % 8)

# Average without overflow (for languages with fixed-width integers)
def safe_average(a: int, b: int) -> int:
    return (a & b) + ((a ^ b) >> 1)
# (a & b) gives the carry bits, (a ^ b) >> 1 gives the non-carry average

# Absolute value without branching (32-bit signed integer)
def abs_no_branch(n: int) -> int:
    mask = n >> 31          # all 1s if negative, all 0s if positive
    return (n ^ mask) - mask
# For negative n: XOR with all 1s flips bits (like ~n), subtract -1 (add 1) -> two's complement
```

```typescript
// TypeScript — Arithmetic bit tricks
const multiplyPow2 = (n: number, k: number): number => n << k;
const dividePow2 = (n: number, k: number): number => n >> k;
const fastModPow2 = (n: number, m: number): number => n & (m - 1);
const safeAverage = (a: number, b: number): number => (a & b) + ((a ^ b) >> 1);
const absNoBranch = (n: number): number => {
    const mask = n >> 31;
    return (n ^ mask) - mask;
};
```

---

## Bitmask Techniques

### Representing Sets as Integers

A bitmask of n bits can represent any subset of {0, 1, ..., n-1}. Each bit position corresponds to an element: 1 means present, 0 means absent.

```
Set Operations with Bitmasks:
────────────────────────────────────────────
Operation              Bitmask Equivalent
────────────────────────────────────────────
Empty set              0
Full set {0..n-1}      (1 << n) - 1
Add element i          mask | (1 << i)
Remove element i       mask & ~(1 << i)
Check membership i     (mask >> i) & 1
Union A | B            a | b
Intersection A & B     a & b
Difference A - B       a & ~b
Symmetric Diff A^B     a ^ b
Complement             ~mask & ((1 << n) - 1)
Set size (popcount)    bin(mask).count('1')
Is subset A <= B       (a & b) == a
```

### Subset Generation Using Bitmask

```python
# Python — Generate all subsets of {0, 1, ..., n-1}
def all_subsets(n: int):
    for mask in range(1 << n):  # 0 to 2^n - 1
        subset = []
        for i in range(n):
            if mask & (1 << i):
                subset.append(i)
        yield subset

# Example: all subsets of {0, 1, 2}
for s in all_subsets(3):
    print(s)
# [] -> [0] -> [1] -> [0,1] -> [2] -> [0,2] -> [1,2] -> [0,1,2]
```

```typescript
// TypeScript — Generate all subsets
function* allSubsets(n: number): Generator<number[]> {
    for (let mask = 0; mask < (1 << n); mask++) {
        const subset: number[] = [];
        for (let i = 0; i < n; i++) {
            if (mask & (1 << i)) {
                subset.push(i);
            }
        }
        yield subset;
    }
}

for (const s of allSubsets(3)) {
    console.log(s);
}
```

### Enumerating Subsets of a Subset

```python
# Python — Enumerate all subsets of a given mask (submask enumeration)
def subsets_of_mask(mask: int):
    submask = mask
    while submask > 0:
        yield submask
        submask = (submask - 1) & mask
    yield 0  # the empty subset

# Example: all subsets of 0b1010 (which represents {1, 3})
for s in subsets_of_mask(0b1010):
    print(bin(s))
# 0b1010 -> 0b1000 -> 0b10 -> 0b0
```

### Bitmask DP: Traveling Salesman Problem (TSP)

The classic bitmask DP application. Find the shortest Hamiltonian cycle visiting all n cities.

```python
# Python — TSP with Bitmask DP
# Time: O(2^n * n^2), Space: O(2^n * n)
import math

def tsp(dist: list[list[int]]) -> int:
    n = len(dist)
    ALL_VISITED = (1 << n) - 1

    # dp[mask][i] = min cost to visit all cities in mask, ending at city i
    dp = [[math.inf] * n for _ in range(1 << n)]
    dp[1][0] = 0  # start at city 0 (mask = 0b...001)

    for mask in range(1 << n):
        for last in range(n):
            if dp[mask][last] == math.inf:
                continue
            if not (mask & (1 << last)):
                continue
            # Try visiting each unvisited city
            for next_city in range(n):
                if mask & (1 << next_city):
                    continue  # already visited
                new_mask = mask | (1 << next_city)
                new_cost = dp[mask][last] + dist[last][next_city]
                dp[new_mask][next_city] = min(dp[new_mask][next_city], new_cost)

    # Return to start city
    result = math.inf
    for last in range(n):
        result = min(result, dp[ALL_VISITED][last] + dist[last][0])
    return result

# Example
distances = [
    [0, 10, 15, 20],
    [10, 0, 35, 25],
    [15, 35, 0, 30],
    [20, 25, 30, 0]
]
print(tsp(distances))  # 80 (0->1->3->2->0)
```

---

## Bit Manipulation in Practice

### Permission Flags (Unix File Permissions)

```
rwxr-xr-x = 0755 (octal) = 111 101 101 (binary)

Owner:  rwx = 111 = 7   (read + write + execute)
Group:  r-x = 101 = 5   (read + execute)
Others: r-x = 101 = 5   (read + execute)

Checking permissions with bitmasks:
    READ    = 4  (100)
    WRITE   = 2  (010)
    EXECUTE = 1  (001)

    has_read    = (perm & 4) != 0
    has_write   = (perm & 2) != 0
    has_execute = (perm & 1) != 0
```

### Feature Flags in Software

```typescript
// TypeScript — Feature flags using bitmasks
const FEATURE_DARK_MODE   = 1 << 0;  // 1
const FEATURE_BETA_UI     = 1 << 1;  // 2
const FEATURE_ANALYTICS   = 1 << 2;  // 4
const FEATURE_EXPORT_CSV  = 1 << 3;  // 8
const FEATURE_AI_ASSIST   = 1 << 4;  // 16

// User's enabled features stored as a single integer
let userFeatures = FEATURE_DARK_MODE | FEATURE_ANALYTICS;  // 5

// Check if feature is enabled
function hasFeature(features: number, flag: number): boolean {
    return (features & flag) !== 0;
}

// Enable a feature
function enableFeature(features: number, flag: number): number {
    return features | flag;
}

// Disable a feature
function disableFeature(features: number, flag: number): number {
    return features & ~flag;
}

// Toggle a feature
function toggleFeature(features: number, flag: number): number {
    return features ^ flag;
}

console.log(hasFeature(userFeatures, FEATURE_DARK_MODE));   // true
console.log(hasFeature(userFeatures, FEATURE_BETA_UI));     // false
userFeatures = enableFeature(userFeatures, FEATURE_AI_ASSIST);
console.log(hasFeature(userFeatures, FEATURE_AI_ASSIST));   // true
```

### Network Subnet Masks

```python
# Python — Subnet mask operations
# IPv4 address: 192.168.1.100  = 11000000.10101000.00000001.01100100
# Subnet mask:  255.255.255.0  = 11111111.11111111.11111111.00000000
# Network addr: 192.168.1.0    = IP & MASK

def ip_to_int(ip: str) -> int:
    parts = ip.split('.')
    return (int(parts[0]) << 24) | (int(parts[1]) << 16) | \
           (int(parts[2]) << 8)  | int(parts[3])

def int_to_ip(n: int) -> str:
    return f"{(n >> 24) & 0xFF}.{(n >> 16) & 0xFF}.{(n >> 8) & 0xFF}.{n & 0xFF}"

def network_address(ip: str, mask: str) -> str:
    return int_to_ip(ip_to_int(ip) & ip_to_int(mask))

print(network_address("192.168.1.100", "255.255.255.0"))  # 192.168.1.0
```

### Graphics: Color Manipulation

```python
# Python — Extracting and manipulating RGBA color channels
# Color stored as 32-bit integer: 0xAARRGGBB

color = 0xFF3A7BFF  # A=255, R=58, G=123, B=255

alpha = (color >> 24) & 0xFF   # 255
red   = (color >> 16) & 0xFF   # 58
green = (color >> 8)  & 0xFF   # 123
blue  = color & 0xFF           # 255

# Create color from components
def make_color(a: int, r: int, g: int, b: int) -> int:
    return (a << 24) | (r << 16) | (g << 8) | b

# Blend two colors (50/50 average per channel)
def blend(c1: int, c2: int) -> int:
    r = (((c1 >> 16) & 0xFF) + ((c2 >> 16) & 0xFF)) >> 1
    g = (((c1 >> 8) & 0xFF) + ((c2 >> 8) & 0xFF)) >> 1
    b = ((c1 & 0xFF) + (c2 & 0xFF)) >> 1
    return (0xFF << 24) | (r << 16) | (g << 8) | b
```

### Compression: Huffman Encoding

Huffman encoding assigns variable-length binary codes to characters based on frequency. More frequent characters get shorter codes. These codes are stored and transmitted as individual bits, making bitwise operations essential for encoding and decoding.

```python
# Simplified: writing bits to a byte stream
class BitWriter:
    def __init__(self):
        self.buffer = 0
        self.count = 0
        self.output = bytearray()

    def write_bit(self, bit: int):
        self.buffer = (self.buffer << 1) | bit
        self.count += 1
        if self.count == 8:
            self.output.append(self.buffer)
            self.buffer = 0
            self.count = 0

    def write_bits(self, value: int, num_bits: int):
        for i in range(num_bits - 1, -1, -1):
            self.write_bit((value >> i) & 1)
```

---

## Common Interview Problems

### 1. Single Number

Given an array where every element appears twice except one, find the unique element.

```python
# Python — O(n) time, O(1) space
def single_number(nums: list[int]) -> int:
    result = 0
    for n in nums:
        result ^= n
    return result

# Every pair cancels: a ^ a = 0, and 0 ^ unique = unique
```

```typescript
// TypeScript
function singleNumber(nums: number[]): number {
    return nums.reduce((acc, n) => acc ^ n, 0);
}
```

### 2. Number of 1 Bits (Hamming Weight)

Count the number of set bits in an integer.

```python
# Python — Brian Kernighan's algorithm
def hamming_weight(n: int) -> int:
    count = 0
    while n:
        n &= n - 1
        count += 1
    return count

print(hamming_weight(0b10110111))  # 6
```

```typescript
// TypeScript
function hammingWeight(n: number): number {
    let count = 0;
    while (n) {
        n &= n - 1;
        count++;
    }
    return count;
}
```

### 3. Reverse Bits

Reverse all 32 bits of a given unsigned integer.

```python
# Python — Reverse 32 bits
def reverse_bits(n: int) -> int:
    result = 0
    for _ in range(32):
        result = (result << 1) | (n & 1)
        n >>= 1
    return result

print(reverse_bits(0b00000010100101000001111010011100))
# 964176192 = 0b00111001011110000010100101000000
```

```typescript
// TypeScript — Reverse 32 bits
function reverseBits(n: number): number {
    let result = 0;
    for (let i = 0; i < 32; i++) {
        result = (result << 1) | (n & 1);
        n >>>= 1;  // unsigned right shift
    }
    return result >>> 0;  // convert to unsigned
}
```

```cpp
// C++ — Reverse bits
uint32_t reverseBits(uint32_t n) {
    uint32_t result = 0;
    for (int i = 0; i < 32; i++) {
        result = (result << 1) | (n & 1);
        n >>= 1;
    }
    return result;
}

// Optimized O(log n) divide-and-conquer approach:
uint32_t reverseBitsFast(uint32_t n) {
    n = ((n & 0xFFFF0000) >> 16) | ((n & 0x0000FFFF) << 16);
    n = ((n & 0xFF00FF00) >> 8)  | ((n & 0x00FF00FF) << 8);
    n = ((n & 0xF0F0F0F0) >> 4)  | ((n & 0x0F0F0F0F) << 4);
    n = ((n & 0xCCCCCCCC) >> 2)  | ((n & 0x33333333) << 2);
    n = ((n & 0xAAAAAAAA) >> 1)  | ((n & 0x55555555) << 1);
    return n;
}
```

### 4. Power of Two

Determine if a given integer is a power of two.

```python
# Python
def is_power_of_two(n: int) -> bool:
    return n > 0 and (n & (n - 1)) == 0

# Why it works:
# Power of 2: has exactly one bit set.   e.g., 8 = 1000
# n - 1: flips that bit and all below.   e.g., 7 = 0111
# AND: all bits become 0.                1000 & 0111 = 0000
```

```typescript
// TypeScript
function isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
}
```

### 5. Counting Bits for All Numbers 0 to n

Return an array where result[i] is the number of 1-bits in i.

```python
# Python — O(n) dynamic programming approach
def count_bits_range(n: int) -> list[int]:
    result = [0] * (n + 1)
    for i in range(1, n + 1):
        # i & (i-1) clears the lowest set bit
        # so popcount(i) = popcount(i & (i-1)) + 1
        result[i] = result[i & (i - 1)] + 1
    return result

print(count_bits_range(8))
# [0, 1, 1, 2, 1, 2, 2, 3, 1]
#  0  1  2  3  4  5  6  7  8
```

```typescript
// TypeScript
function countBitsRange(n: number): number[] {
    const result = new Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) {
        result[i] = result[i & (i - 1)] + 1;
    }
    return result;
}
```

```cpp
// C++
vector<int> countBits(int n) {
    vector<int> result(n + 1, 0);
    for (int i = 1; i <= n; i++) {
        result[i] = result[i & (i - 1)] + 1;
    }
    return result;
}
```

---

## Complexity Reference

```
Operation                      Time        Space    Notes
─────────────────────────────────────────────────────────────
Single bitwise operation       O(1)        O(1)     One CPU cycle
Count bits (Kernighan)         O(k)        O(1)     k = number of set bits
Count bits (lookup table)      O(1)        O(256)   Precomputed for each byte
Reverse bits (loop)            O(w)        O(1)     w = word size (32 or 64)
Reverse bits (divide&conquer)  O(log w)    O(1)     Constant swaps
Subset enumeration             O(2^n)      O(n)     All subsets of n elements
Submask enumeration            O(3^n)      O(1)     Amortized over all masks
TSP bitmask DP                 O(2^n * n^2) O(2^n*n) n cities
```

---

## Key Gotchas and Pitfalls

1. **Signed vs unsigned shift**: In Java and C++, `>>` is arithmetic (sign-extending) for signed types. Use `>>>` in Java or cast to unsigned in C++ for logical shift.
2. **JavaScript 32-bit limitation**: JS bitwise operators convert operands to 32-bit signed integers. Use `>>> 0` to treat as unsigned.
3. **Python arbitrary precision**: Python integers have unlimited size, so `~n` gives `-(n+1)`, not a fixed-width complement. Use `n ^ ((1 << width) - 1)` for fixed-width NOT.
4. **Operator precedence**: Bitwise operators have lower precedence than comparison operators in most languages. Always use parentheses: `(n & 1) == 0`, not `n & 1 == 0`.
5. **Shift overflow**: Shifting by more than the bit width is undefined behavior in C/C++.

---

## Sources

- Warren, Henry S. *Hacker's Delight* (2nd Edition, Addison-Wesley, 2012) -- the definitive reference for bit manipulation tricks.
- Anderson, Sean Eron. "Bit Twiddling Hacks." Stanford University. https://graphics.stanford.edu/~seander/bithacks.html
- cp-algorithms.com -- "Bit Manipulation" and "Bitmask DP" articles. https://cp-algorithms.com/
- Cormen, Thomas H. et al. *Introduction to Algorithms* (CLRS), 4th Edition, MIT Press, 2022.
- Wikipedia. "Bitwise operation." https://en.wikipedia.org/wiki/Bitwise_operation
- LeetCode. Bit Manipulation problem set. https://leetcode.com/tag/bit-manipulation/
