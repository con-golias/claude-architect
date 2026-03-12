# Mathematical Algorithms

> **Domain**: Fundamentals > Algorithms > Mathematical
> **Difficulty**: Intermediate-Advanced
> **Last Updated**: 2026-03-07

---

## What It Is

Mathematical algorithms solve number-theoretic, combinatorial, and computational geometry problems. They form the foundation of cryptography (RSA, Diffie-Hellman), computer graphics (transformations, rendering), scientific computing (simulations, optimization), competitive programming, and many core computer science applications.

Understanding mathematical algorithms equips you to reason about correctness proofs, computational complexity at a deeper level, and the theoretical limits of what can be computed efficiently.

---

## Prime Numbers

A prime number is a natural number greater than 1 that has no positive divisors other than 1 and itself. Primes are the building blocks of number theory and are critical to cryptography.

### Primality Testing

#### Trial Division -- O(sqrt(n))

The simplest approach: check if any integer from 2 to sqrt(n) divides n evenly.

```python
# Python
import math

def is_prime(n: int) -> bool:
    if n < 2:
        return False
    if n < 4:
        return True
    if n % 2 == 0 or n % 3 == 0:
        return False
    # All primes > 3 are of the form 6k +/- 1
    i = 5
    while i * i <= n:
        if n % i == 0 or n % (i + 2) == 0:
            return False
        i += 6
    return True

print(is_prime(97))     # True
print(is_prime(100))    # False
print(is_prime(104729)) # True (the 10000th prime)
```

```typescript
// TypeScript
function isPrime(n: number): boolean {
    if (n < 2) return false;
    if (n < 4) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    for (let i = 5; i * i <= n; i += 6) {
        if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
}
```

#### Miller-Rabin Probabilistic Test -- O(k log^2 n)

For very large numbers, trial division is too slow. Miller-Rabin is probabilistic but fast. With specific witnesses, it can be made deterministic for numbers up to certain bounds.

```python
# Python — Miller-Rabin primality test
import random

def miller_rabin(n: int, k: int = 10) -> bool:
    """Test if n is probably prime with k rounds of Miller-Rabin."""
    if n < 2:
        return False
    if n == 2 or n == 3:
        return True
    if n % 2 == 0:
        return False

    # Write n-1 as 2^r * d where d is odd
    r, d = 0, n - 1
    while d % 2 == 0:
        r += 1
        d //= 2

    # Witness loop
    for _ in range(k):
        a = random.randrange(2, n - 1)
        x = pow(a, d, n)  # a^d mod n (Python built-in fast modular exponentiation)

        if x == 1 or x == n - 1:
            continue

        for _ in range(r - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False  # composite

    return True  # probably prime

# Deterministic for n < 3,317,044,064,679,887,385,961,981:
# Use witnesses {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37}
```

### Sieve of Eratosthenes

Find all primes up to n in O(n log log n) time. One of the oldest known algorithms (circa 240 BCE).

**How it works** (step by step for n=30):
```
Start:  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30
p=2:    2  3  .  5  .  7  .  9  . 11  . 13  . 15  . 17  . 19  . 21  . 23  . 25  . 27  . 29  .
p=3:    2  3     5     7     .    11    13    .    17    19    .    23    25    .    29    .
p=5:    2  3     5     7         11    13         17    19         23    .         29

Result: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29
```

```python
# Python — Sieve of Eratosthenes
def sieve_of_eratosthenes(n: int) -> list[int]:
    if n < 2:
        return []
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False

    # Optimization: start from p^2 (smaller multiples already crossed out)
    p = 2
    while p * p <= n:
        if is_prime[p]:
            # Mark multiples of p starting from p^2
            for multiple in range(p * p, n + 1, p):
                is_prime[multiple] = False
        p += 1

    return [i for i in range(2, n + 1) if is_prime[i]]

print(sieve_of_eratosthenes(30))
# [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
```

```typescript
// TypeScript — Sieve of Eratosthenes
function sieveOfEratosthenes(n: number): number[] {
    if (n < 2) return [];
    const isPrime = new Array(n + 1).fill(true);
    isPrime[0] = isPrime[1] = false;

    for (let p = 2; p * p <= n; p++) {
        if (isPrime[p]) {
            for (let multiple = p * p; multiple <= n; multiple += p) {
                isPrime[multiple] = false;
            }
        }
    }

    const primes: number[] = [];
    for (let i = 2; i <= n; i++) {
        if (isPrime[i]) primes.push(i);
    }
    return primes;
}
```

```cpp
// C++ — Sieve of Eratosthenes (optimized with bitset)
#include <vector>
#include <bitset>
using namespace std;

vector<int> sieve(int n) {
    vector<bool> is_prime(n + 1, true);
    is_prime[0] = is_prime[1] = false;

    for (int p = 2; (long long)p * p <= n; p++) {
        if (is_prime[p]) {
            for (int j = p * p; j <= n; j += p) {
                is_prime[j] = false;
            }
        }
    }

    vector<int> primes;
    for (int i = 2; i <= n; i++) {
        if (is_prime[i]) primes.push_back(i);
    }
    return primes;
}
```

**Optimizations**:
- **Only odd numbers**: Skip even numbers after 2. Halves memory usage.
- **Segmented sieve**: For very large ranges, process in segments that fit in cache. Enables finding primes up to 10^12+.
- **Wheel factorization**: Skip multiples of 2, 3, 5 to reduce work by ~73%.

### Prime Factorization

```python
# Python — Prime factorization via trial division: O(sqrt(n))
def prime_factors(n: int) -> list[int]:
    factors = []
    d = 2
    while d * d <= n:
        while n % d == 0:
            factors.append(d)
            n //= d
        d += 1
    if n > 1:
        factors.append(n)
    return factors

print(prime_factors(360))   # [2, 2, 2, 3, 3, 5]  -> 2^3 * 3^2 * 5
print(prime_factors(97))    # [97] (prime)
print(prime_factors(1000000007))  # [1000000007] (large prime)
```

```python
# Python — Factorization using precomputed smallest prime factor (SPF)
# Useful for many queries on numbers up to N
def precompute_spf(n: int) -> list[int]:
    spf = list(range(n + 1))  # spf[i] = i initially
    for p in range(2, int(n**0.5) + 1):
        if spf[p] == p:  # p is prime
            for j in range(p * p, n + 1, p):
                if spf[j] == j:
                    spf[j] = p
    return spf

def factorize_with_spf(n: int, spf: list[int]) -> list[int]:
    factors = []
    while n > 1:
        factors.append(spf[n])
        n //= spf[n]
    return factors

spf = precompute_spf(1000)
print(factorize_with_spf(360, spf))  # [2, 2, 2, 3, 3, 5]
```

---

## GCD and LCM

### Euclidean Algorithm

The most fundamental algorithm in number theory. Computes the greatest common divisor in O(log(min(a, b))) time.

**Key insight**: gcd(a, b) = gcd(b, a % b). Base case: gcd(a, 0) = a.

```python
# Python — Recursive
def gcd_recursive(a: int, b: int) -> int:
    if b == 0:
        return a
    return gcd_recursive(b, a % b)

# Python — Iterative (avoids stack overflow for large inputs)
def gcd_iterative(a: int, b: int) -> int:
    while b:
        a, b = b, a % b
    return a

# Python 3.5+: math.gcd(a, b) is built-in
import math
print(math.gcd(48, 18))  # 6
```

```typescript
// TypeScript — Recursive
function gcdRecursive(a: number, b: number): number {
    if (b === 0) return a;
    return gcdRecursive(b, a % b);
}

// TypeScript — Iterative
function gcdIterative(a: number, b: number): number {
    while (b !== 0) {
        [a, b] = [b, a % b];
    }
    return a;
}
```

**Trace example**: gcd(48, 18)
```
gcd(48, 18) -> gcd(18, 48 % 18 = 12) -> gcd(12, 18 % 12 = 6) -> gcd(6, 12 % 6 = 0) -> 6
```

### Extended Euclidean Algorithm

Find integers x, y such that ax + by = gcd(a, b). This is essential for computing modular inverses.

```python
# Python — Extended Euclidean Algorithm
def extended_gcd(a: int, b: int) -> tuple[int, int, int]:
    """Returns (gcd, x, y) such that a*x + b*y = gcd(a, b)."""
    if b == 0:
        return a, 1, 0
    g, x1, y1 = extended_gcd(b, a % b)
    x = y1
    y = x1 - (a // b) * y1
    return g, x, y

g, x, y = extended_gcd(35, 15)
print(f"gcd={g}, x={x}, y={y}")           # gcd=5, x=1, y=-2
print(f"Verify: 35*{x} + 15*{y} = {35*x + 15*y}")  # 35*1 + 15*(-2) = 5
```

**Applications**:
- Modular multiplicative inverse
- Solving linear Diophantine equations (ax + by = c has solutions iff gcd(a,b) | c)
- Chinese Remainder Theorem implementation

### LCM (Least Common Multiple)

```python
# Python
def lcm(a: int, b: int) -> int:
    return abs(a * b) // math.gcd(a, b)

# Use abs() to handle negative inputs; divide before multiply to avoid overflow
# In Python overflow is not an issue, but in C++/Java it is.

print(lcm(12, 18))  # 36
print(lcm(4, 6))    # 12
```

```typescript
// TypeScript
function lcm(a: number, b: number): number {
    return Math.abs(a * b) / gcdIterative(a, b);
}
```

---

## Modular Arithmetic

Modular arithmetic is the arithmetic of remainders. It is fundamental to cryptography, hashing, and competitive programming. The notation `a ≡ b (mod m)` means m divides (a - b).

### Properties

```
(a + b) mod m = ((a mod m) + (b mod m)) mod m
(a * b) mod m = ((a mod m) * (b mod m)) mod m
(a - b) mod m = ((a mod m) - (b mod m) + m) mod m    (add m to handle negatives)
(a / b) mod m = (a * b^(-1)) mod m                    (requires modular inverse)

Exponentiation:
a^b mod m  -- use fast exponentiation (binary method), NOT naive multiplication
```

### Modular Exponentiation (Binary Exponentiation / Fast Power)

Compute a^b mod m in O(log b) time by repeatedly squaring.

**Key insight**: a^b = a^(b/2) * a^(b/2) if b is even, or a * a^(b-1) if b is odd.

```python
# Python — Iterative binary exponentiation
def power_mod(base: int, exp: int, mod: int) -> int:
    result = 1
    base %= mod
    while exp > 0:
        if exp & 1:  # if exp is odd
            result = result * base % mod
        exp >>= 1    # exp = exp // 2
        base = base * base % mod
    return result

print(power_mod(2, 10, 1000))       # 24  (1024 % 1000)
print(power_mod(3, 1000000, 1000))   # 1   (Euler's theorem: 3^phi(1000) ≡ 1)

# Python built-in: pow(base, exp, mod) does the same thing
print(pow(2, 10, 1000))  # 24
```

```typescript
// TypeScript — Binary exponentiation
// Note: For large numbers, use BigInt to avoid precision loss
function powerMod(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    base = base % mod;
    while (exp > 0n) {
        if (exp & 1n) {
            result = (result * base) % mod;
        }
        exp >>= 1n;
        base = (base * base) % mod;
    }
    return result;
}

console.log(powerMod(2n, 10n, 1000n));  // 24n
```

```java
// Java — Binary exponentiation
public static long powerMod(long base, long exp, long mod) {
    long result = 1;
    base %= mod;
    while (exp > 0) {
        if ((exp & 1) == 1) {
            result = result * base % mod;
        }
        exp >>= 1;
        base = base * base % mod;
    }
    return result;
}
// Or use: BigInteger.valueOf(base).modPow(BigInteger.valueOf(exp), BigInteger.valueOf(mod))
```

**Applications**:
- RSA encryption: c = m^e mod n (encryption), m = c^d mod n (decryption)
- Fermat's Little Theorem primality test: a^(p-1) = 1 mod p for prime p
- Computing large Fibonacci numbers modulo m

### Modular Inverse

The modular inverse of a modulo m is a number x such that `a * x ≡ 1 (mod m)`. It exists if and only if gcd(a, m) = 1.

```python
# Python — Method 1: Using Extended Euclidean Algorithm
def mod_inverse_ext(a: int, m: int) -> int:
    """Returns a^(-1) mod m, or raises ValueError if no inverse exists."""
    g, x, _ = extended_gcd(a % m, m)
    if g != 1:
        raise ValueError(f"Modular inverse of {a} mod {m} does not exist")
    return x % m

# Python — Method 2: Using Fermat's Little Theorem (m must be prime)
def mod_inverse_fermat(a: int, m: int) -> int:
    """Returns a^(-1) mod m using Fermat's theorem. Requires m to be prime."""
    return pow(a, m - 2, m)

# Example
print(mod_inverse_ext(3, 7))      # 5  (because 3 * 5 = 15 ≡ 1 mod 7)
print(mod_inverse_fermat(3, 7))    # 5
```

---

## Combinatorics

### Binomial Coefficients (nCr)

C(n, r) = n! / (r! * (n - r)!) -- the number of ways to choose r items from n items.

#### Approach 1: Pascal's Triangle DP -- O(n^2) time, O(n^2) space

```python
# Python — Pascal's Triangle
def pascal_triangle(n: int) -> list[list[int]]:
    C = [[0] * (n + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        C[i][0] = 1
        for j in range(1, i + 1):
            C[i][j] = C[i - 1][j - 1] + C[i - 1][j]
    return C

triangle = pascal_triangle(10)
print(triangle[10][3])  # C(10, 3) = 120
print(triangle[5][2])   # C(5, 2) = 10
```

#### Approach 2: Multiplicative Formula -- O(k) time

```python
# Python — Direct computation (avoids large factorials)
def nCr(n: int, r: int) -> int:
    if r > n - r:
        r = n - r  # optimization: C(n, r) = C(n, n-r)
    result = 1
    for i in range(r):
        result = result * (n - i) // (i + 1)
    return result

print(nCr(10, 3))    # 120
print(nCr(20, 10))   # 184756
print(nCr(100, 50))  # 100891344545564193334812497256
```

#### Approach 3: With Modular Arithmetic (for large values)

```python
# Python — nCr mod p (p is prime), using modular inverse
# Precompute factorials and inverse factorials

def precompute_factorials(n: int, mod: int):
    fact = [1] * (n + 1)
    for i in range(1, n + 1):
        fact[i] = fact[i - 1] * i % mod

    inv_fact = [1] * (n + 1)
    inv_fact[n] = pow(fact[n], mod - 2, mod)  # Fermat's little theorem
    for i in range(n - 1, -1, -1):
        inv_fact[i] = inv_fact[i + 1] * (i + 1) % mod

    return fact, inv_fact

def nCr_mod(n: int, r: int, fact, inv_fact, mod: int) -> int:
    if r < 0 or r > n:
        return 0
    return fact[n] * inv_fact[r] % mod * inv_fact[n - r] % mod

MOD = 10**9 + 7
fact, inv_fact = precompute_factorials(200000, MOD)
print(nCr_mod(100, 50, fact, inv_fact, MOD))  # 538992043
```

### Catalan Numbers

The n-th Catalan number: C(n) = (2n)! / ((n+1)! * n!) = C(2n, n) / (n+1)

First values: 1, 1, 2, 5, 14, 42, 132, 429, 1430, 4862, ...

**Applications**:
- Number of valid parentheses expressions with n pairs
- Number of distinct binary search trees with n nodes
- Number of ways to triangulate a convex polygon with n+2 sides
- Number of full binary trees with n+1 leaves
- Number of monotonic lattice paths (Dyck paths)

```python
# Python — Catalan numbers via DP
def catalan(n: int) -> list[int]:
    dp = [0] * (n + 1)
    dp[0] = dp[1] = 1
    for i in range(2, n + 1):
        for j in range(i):
            dp[i] += dp[j] * dp[i - 1 - j]
    return dp

# Recurrence: C(n) = sum of C(i) * C(n-1-i) for i = 0 to n-1
print(catalan(10))  # [1, 1, 2, 5, 14, 42, 132, 429, 1430, 4862, 16796]
```

```python
# Python — Catalan number using direct formula
def catalan_direct(n: int) -> int:
    return nCr(2 * n, n) // (n + 1)

for i in range(10):
    print(f"C({i}) = {catalan_direct(i)}")
```

### Permutations and Combinations

```python
# Python — Count permutations P(n, r) = n! / (n-r)!
def P(n: int, r: int) -> int:
    result = 1
    for i in range(n, n - r, -1):
        result *= i
    return result

print(P(5, 3))  # 60  (5 * 4 * 3)

# Python — Count combinations C(n, r) = n! / (r! * (n-r)!)
# (Already defined above as nCr)
```

#### Next Permutation (Narayana Pandita's Algorithm)

Given a permutation, find the lexicographically next permutation. Used in STL `std::next_permutation`.

```python
# Python — Next permutation (in-place)
def next_permutation(nums: list[int]) -> bool:
    """Rearranges nums to the next lexicographic permutation.
    Returns False if already the last permutation."""
    n = len(nums)

    # Step 1: Find largest index i such that nums[i] < nums[i+1]
    i = n - 2
    while i >= 0 and nums[i] >= nums[i + 1]:
        i -= 1

    if i < 0:
        nums.reverse()  # last permutation -> wrap to first
        return False

    # Step 2: Find largest index j > i such that nums[j] > nums[i]
    j = n - 1
    while nums[j] <= nums[i]:
        j -= 1

    # Step 3: Swap nums[i] and nums[j]
    nums[i], nums[j] = nums[j], nums[i]

    # Step 4: Reverse the suffix starting at nums[i+1]
    left, right = i + 1, n - 1
    while left < right:
        nums[left], nums[right] = nums[right], nums[left]
        left += 1
        right -= 1

    return True

# Example: generate all permutations of [1, 2, 3]
perm = [1, 2, 3]
result = [perm[:]]
while next_permutation(perm):
    result.append(perm[:])
print(result)
# [[1,2,3], [1,3,2], [2,1,3], [2,3,1], [3,1,2], [3,2,1]]
```

---

## Matrix Exponentiation

Compute A^n in O(k^3 log n) time where k is the matrix dimension. This technique reduces linear recurrence problems from O(n) to O(log n).

### Fibonacci in O(log n)

The Fibonacci recurrence F(n) = F(n-1) + F(n-2) can be expressed as matrix multiplication:

```
[F(n+1)]   [1 1]^n   [F(1)]
[F(n)  ] = [1 0]   * [F(0)]
```

```python
# Python — Matrix exponentiation for Fibonacci
def matrix_mult(A: list[list[int]], B: list[list[int]], mod: int = 0) -> list[list[int]]:
    """Multiply two 2x2 matrices, optionally modulo mod."""
    n = len(A)
    C = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            for k in range(n):
                C[i][j] += A[i][k] * B[k][j]
            if mod:
                C[i][j] %= mod
    return C

def matrix_pow(M: list[list[int]], n: int, mod: int = 0) -> list[list[int]]:
    """Compute M^n using binary exponentiation."""
    size = len(M)
    # Start with identity matrix
    result = [[1 if i == j else 0 for j in range(size)] for i in range(size)]

    while n > 0:
        if n & 1:
            result = matrix_mult(result, M, mod)
        M = matrix_mult(M, M, mod)
        n >>= 1
    return result

def fibonacci(n: int, mod: int = 0) -> int:
    """Compute the n-th Fibonacci number in O(log n)."""
    if n <= 1:
        return n
    M = [[1, 1], [1, 0]]
    result = matrix_pow(M, n - 1, mod)
    return result[0][0]

print(fibonacci(10))      # 55
print(fibonacci(50))      # 12586269025
print(fibonacci(1000000, 10**9 + 7))  # Fibonacci mod 10^9+7, computed instantly
```

### General Linear Recurrence

Any k-th order linear recurrence `f(n) = c1*f(n-1) + c2*f(n-2) + ... + ck*f(n-k)` can be solved with matrix exponentiation.

```python
# Python — General linear recurrence via matrix exponentiation
# Example: Tribonacci: T(n) = T(n-1) + T(n-2) + T(n-3)
# T(0)=0, T(1)=0, T(2)=1

def tribonacci(n: int) -> int:
    if n < 2:
        return 0
    if n == 2:
        return 1

    # Transition matrix:
    # [T(n)  ]   [1 1 1] [T(n-1)]
    # [T(n-1)] = [1 0 0] [T(n-2)]
    # [T(n-2)]   [0 1 0] [T(n-3)]
    M = [[1, 1, 1],
         [1, 0, 0],
         [0, 1, 0]]

    result = matrix_pow(M, n - 2)
    # result * [T(2), T(1), T(0)]^T = result * [1, 0, 0]^T
    return result[0][0]  # T(2) * result[0][0] + T(1) * result[0][1] + T(0) * result[0][2]

for i in range(10):
    print(f"T({i}) = {tribonacci(i)}")
# 0, 0, 1, 1, 2, 4, 7, 13, 24, 44
```

---

## Number Theory Utilities

### Euler's Totient Function (phi)

phi(n) = count of integers in [1, n] that are coprime to n.

```python
# Python — Euler's totient function
def euler_totient(n: int) -> int:
    result = n
    p = 2
    while p * p <= n:
        if n % p == 0:
            while n % p == 0:
                n //= p
            result -= result // p
        p += 1
    if n > 1:
        result -= result // n
    return result

print(euler_totient(12))   # 4  (1, 5, 7, 11 are coprime to 12)
print(euler_totient(7))    # 6  (all of 1-6, since 7 is prime)

# Key property: a^phi(m) ≡ 1 (mod m) when gcd(a, m) = 1 (Euler's theorem)
# Special case (Fermat): a^(p-1) ≡ 1 (mod p) for prime p
```

### Chinese Remainder Theorem (CRT)

Solve a system of simultaneous congruences: x ≡ a_i (mod m_i) for pairwise coprime moduli.

```python
# Python — Chinese Remainder Theorem
def chinese_remainder(remainders: list[int], moduli: list[int]) -> int:
    """Find x such that x ≡ remainders[i] (mod moduli[i]) for all i."""
    M = 1
    for m in moduli:
        M *= m

    x = 0
    for a_i, m_i in zip(remainders, moduli):
        M_i = M // m_i
        _, y_i, _ = extended_gcd(M_i, m_i)
        x += a_i * M_i * y_i

    return x % M

# Example: x ≡ 2 (mod 3), x ≡ 3 (mod 5), x ≡ 2 (mod 7)
print(chinese_remainder([2, 3, 2], [3, 5, 7]))  # 23
# Verify: 23 % 3 = 2, 23 % 5 = 3, 23 % 7 = 2
```

---

## Numerical Methods

### Newton's Method for Square Root

Iteratively refine an approximation using the formula: x_{n+1} = (x_n + S/x_n) / 2.

Converges quadratically (doubles correct digits each iteration).

```python
# Python — Newton's method for square root
def sqrt_newton(S: float, epsilon: float = 1e-10) -> float:
    if S < 0:
        raise ValueError("Cannot compute square root of negative number")
    if S == 0:
        return 0.0
    x = S  # initial guess
    while True:
        x_new = (x + S / x) / 2
        if abs(x_new - x) < epsilon:
            return x_new
        x = x_new

print(sqrt_newton(2))       # 1.4142135623730951
print(sqrt_newton(144))     # 12.0
print(sqrt_newton(0.04))    # 0.2
```

### Integer Square Root via Binary Search

```python
# Python — Integer square root (floor of sqrt(n))
def isqrt(n: int) -> int:
    if n < 0:
        raise ValueError("Square root not defined for negative numbers")
    if n < 2:
        return n
    lo, hi = 1, n
    while lo <= hi:
        mid = (lo + hi) // 2
        if mid * mid == n:
            return mid
        elif mid * mid < n:
            lo = mid + 1
            result = mid
        else:
            hi = mid - 1
    return result

print(isqrt(8))   # 2  (floor of sqrt(8) = 2.828...)
print(isqrt(16))  # 4
print(isqrt(10**18))  # 1000000000
```

### Newton's Method for Cube Root and General Roots

```python
# Python — Newton's method for n-th root
def nth_root(S: float, n: int, epsilon: float = 1e-10) -> float:
    x = S / n  # initial guess
    while True:
        x_new = ((n - 1) * x + S / (x ** (n - 1))) / n
        if abs(x_new - x) < epsilon:
            return x_new
        x = x_new

print(nth_root(27, 3))   # 3.0
print(nth_root(256, 4))  # 4.0
```

---

## Complexity Reference

```
Algorithm                        Time              Space     Notes
───────────────────────────────────────────────────────────────────────
Trial division primality         O(sqrt(n))        O(1)
Miller-Rabin primality           O(k log^2 n)      O(1)      k rounds
Sieve of Eratosthenes            O(n log log n)    O(n)      Find all primes <= n
Prime factorization              O(sqrt(n))        O(log n)  Number of factors
Euclidean GCD                    O(log min(a,b))   O(1)      Iterative
Extended GCD                     O(log min(a,b))   O(log n)  Recursive stack
Binary exponentiation            O(log b)          O(1)      a^b mod m
Pascal's triangle (nCr table)    O(n^2)            O(n^2)    Precompute all
nCr direct formula               O(k)              O(1)      Single query
Matrix exponentiation (k x k)   O(k^3 log n)      O(k^2)    Fibonacci in O(log n)
Euler's totient                  O(sqrt(n))        O(1)
Chinese Remainder Theorem        O(k log M)        O(k)      k equations
Newton's method (sqrt)           O(log(1/eps))     O(1)      Quadratic convergence
```

---

## Sources

- Cormen, Thomas H. et al. *Introduction to Algorithms* (CLRS), 4th Edition, MIT Press, 2022. Chapter 31: Number-Theoretic Algorithms.
- Knuth, Donald E. *The Art of Computer Programming, Volume 2: Seminumerical Algorithms* (3rd Edition, Addison-Wesley, 1997).
- Hardy, G.H. and Wright, E.M. *An Introduction to the Theory of Numbers* (6th Edition, Oxford University Press, 2008).
- cp-algorithms.com -- Number Theory articles. https://cp-algorithms.com/algebra/
- Wikipedia. "Sieve of Eratosthenes," "Modular arithmetic," "Miller-Rabin primality test," "Chinese Remainder Theorem." https://en.wikipedia.org/
- Shoup, Victor. *A Computational Introduction to Number Theory and Algebra* (Cambridge University Press, 2009). Free online: https://shoup.net/ntb/
