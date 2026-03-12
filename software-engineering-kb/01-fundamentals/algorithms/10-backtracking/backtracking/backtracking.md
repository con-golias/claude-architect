# Backtracking — Fundamentals

| Domain | Difficulty | Last Updated |
|---|---|---|
| Fundamentals > Algorithms > Backtracking | Intermediate-Advanced | 2026-03-07 |

---

## What It Is

**Backtracking** is a systematic **trial-and-error** technique for solving constraint satisfaction
and combinatorial problems. It builds a solution **incrementally**, one piece at a time, and
**abandons** a candidate ("backtracks") as soon as it determines the candidate cannot lead to a
valid or optimal solution.

Backtracking is essentially **Depth-First Search (DFS) on the solution space tree** with
**pruning**. Instead of exploring every possible combination (brute force), it eliminates entire
branches of the search tree that violate constraints, often reducing the search space exponentially.

```
Solution Space Tree (Conceptual):

                          root (empty)
                       /      |      \
                    [1]      [2]      [3]       ← first choice
                  /   \     / \      / \
               [1,2] [1,3] [2,1][2,3] [3,1][3,2]  ← second choice
                │      │     │    │     │     │
               ...    ...   ...  ...   ...   ...    ← third choice

  Backtracking: when a partial solution violates constraints,
  PRUNE that branch (don't explore its children).

  ┌─────────┐
  │ Explore │──▶ Valid? ──▶ Yes ──▶ Continue deeper
  └─────────┘              │
                           No ──▶ BACKTRACK (undo last choice, try next)
```

---

## General Template

The backtracking pattern follows a **choose-explore-unchoose** structure:

**Python:**

```python
def backtrack(candidate, state):
    if is_solution(candidate):
        process_solution(candidate)
        return

    for next_choice in get_choices(state):
        if is_valid(next_choice, state):       # pruning check
            make_choice(next_choice, state)     # CHOOSE
            backtrack(candidate, state)         # EXPLORE
            undo_choice(next_choice, state)     # UN-CHOOSE (backtrack)
```

**TypeScript:**

```typescript
function backtrack(candidate: any[], state: State): void {
    if (isSolution(candidate)) {
        processSolution(candidate);
        return;
    }

    for (const nextChoice of getChoices(state)) {
        if (isValid(nextChoice, state)) {       // pruning check
            makeChoice(nextChoice, state);       // CHOOSE
            backtrack(candidate, state);         // EXPLORE
            undoChoice(nextChoice, state);       // UN-CHOOSE (backtrack)
        }
    }
}
```

**The three key steps:**
1. **Choose** — Make a decision, modify state
2. **Explore** — Recurse with the modified state
3. **Un-choose** — Undo the decision, restore state (this IS the backtracking)

---

## Classic Problems

### 1. N-Queens

**Problem:** Place N queens on an NxN chessboard so that no two queens attack each other
(no two queens share the same row, column, or diagonal).

```
8-Queens — One Valid Solution:

    0   1   2   3   4   5   6   7
  ┌───┬───┬───┬───┬───┬───┬───┬───┐
0 │   │   │   │   │ Q │   │   │   │
  ├───┼───┼───┼───┼───┼───┼───┼───┤
1 │   │   │   │   │   │   │ Q │   │
  ├───┼───┼───┼───┼───┼───┼───┼───┤
2 │   │ Q │   │   │   │   │   │   │
  ├───┼───┼───┼───┼───┼───┼───┼───┤
3 │   │   │   │   │   │   │   │ Q │
  ├───┼───┼───┼───┼───┼───┼───┼───┤
4 │   │   │   │   │   │ Q │   │   │
  ├───┼───┼───┼───┼───┼───┼───┼───┤
5 │   │   │ Q │   │   │   │   │   │
  ├───┼───┼───┼───┼───┼───┼───┼───┤
6 │ Q │   │   │   │   │   │   │   │
  ├───┼───┼───┼───┼───┼───┼───┼───┤
7 │   │   │   │ Q │   │   │   │   │
  └───┴───┴───┴───┴───┴───┴───┴───┘

Queens at: (0,4), (1,6), (2,1), (3,7), (4,5), (5,2), (6,0), (7,3)
```

**Pruning strategy:** Place queens row by row. For each row, try each column. Skip columns,
and diagonals that are already under attack. Track attacked columns and diagonals using sets.

**Diagonal key insight:** For cells on the same diagonal:
- Main diagonal (top-left to bottom-right): `row - col` is constant
- Anti-diagonal (top-right to bottom-left): `row + col` is constant

**Python:**

```python
def solve_n_queens(n: int) -> list[list[int]]:
    """Returns all solutions. Each solution is a list of column positions."""
    solutions = []
    cols = set()          # columns under attack
    diag1 = set()         # main diagonals (row - col)
    diag2 = set()         # anti-diagonals (row + col)

    def backtrack(row: int, queens: list[int]):
        if row == n:
            solutions.append(queens[:])
            return

        for col in range(n):
            if col in cols or (row - col) in diag1 or (row + col) in diag2:
                continue  # PRUNE: this column/diagonal is under attack

            # CHOOSE
            queens.append(col)
            cols.add(col)
            diag1.add(row - col)
            diag2.add(row + col)

            # EXPLORE
            backtrack(row + 1, queens)

            # UN-CHOOSE
            queens.pop()
            cols.remove(col)
            diag1.remove(row - col)
            diag2.remove(row + col)

    backtrack(0, [])
    return solutions

def print_board(solution: list[int]):
    n = len(solution)
    for row in range(n):
        line = ""
        for col in range(n):
            line += " Q " if solution[row] == col else " . "
        print(line)
    print()

solutions = solve_n_queens(8)
print(f"Total 8-Queens solutions: {len(solutions)}")  # 92
print_board(solutions[0])

# Find just ONE solution (faster)
def solve_n_queens_one(n: int) -> list[int] | None:
    cols = set()
    diag1 = set()
    diag2 = set()

    def backtrack(row, queens):
        if row == n:
            return queens[:]
        for col in range(n):
            if col in cols or (row - col) in diag1 or (row + col) in diag2:
                continue
            queens.append(col)
            cols.add(col)
            diag1.add(row - col)
            diag2.add(row + col)

            result = backtrack(row + 1, queens)
            if result:
                return result

            queens.pop()
            cols.remove(col)
            diag1.remove(row - col)
            diag2.remove(row + col)
        return None

    return backtrack(0, [])
```

**TypeScript:**

```typescript
function solveNQueens(n: number): number[][] {
    const solutions: number[][] = [];
    const cols = new Set<number>();
    const diag1 = new Set<number>();  // row - col
    const diag2 = new Set<number>();  // row + col

    function backtrack(row: number, queens: number[]): void {
        if (row === n) {
            solutions.push([...queens]);
            return;
        }

        for (let col = 0; col < n; col++) {
            if (cols.has(col) || diag1.has(row - col) || diag2.has(row + col)) {
                continue;
            }

            queens.push(col);
            cols.add(col);
            diag1.add(row - col);
            diag2.add(row + col);

            backtrack(row + 1, queens);

            queens.pop();
            cols.delete(col);
            diag1.delete(row - col);
            diag2.delete(row + col);
        }
    }

    backtrack(0, []);
    return solutions;
}

console.log(`Total 8-Queens solutions: ${solveNQueens(8).length}`); // 92
```

**Complexity:** Time O(n!) — much better than brute force O(n^n). For n=8, brute force checks
16,777,216 configurations; backtracking explores far fewer due to pruning.

---

### 2. Sudoku Solver

**Problem:** Fill a 9x9 grid so each row, column, and 3x3 box contains digits 1-9 exactly once.

**Python:**

```python
def solve_sudoku(board: list[list[int]]) -> bool:
    """Solves sudoku in-place. Empty cells are 0. Returns True if solvable."""

    def is_valid(row: int, col: int, num: int) -> bool:
        # Check row
        if num in board[row]:
            return False
        # Check column
        if any(board[r][col] == num for r in range(9)):
            return False
        # Check 3x3 box
        box_r, box_c = 3 * (row // 3), 3 * (col // 3)
        for r in range(box_r, box_r + 3):
            for c in range(box_c, box_c + 3):
                if board[r][c] == num:
                    return False
        return True

    def find_empty() -> tuple[int, int] | None:
        for r in range(9):
            for c in range(9):
                if board[r][c] == 0:
                    return (r, c)
        return None

    def backtrack() -> bool:
        cell = find_empty()
        if cell is None:
            return True  # all cells filled — solved!

        row, col = cell
        for num in range(1, 10):
            if is_valid(row, col, num):
                board[row][col] = num       # CHOOSE
                if backtrack():             # EXPLORE
                    return True
                board[row][col] = 0         # UN-CHOOSE (backtrack)

        return False  # no valid number for this cell — trigger backtrack

    return backtrack()

# Optimized version with constraint sets for O(1) validity checking
def solve_sudoku_fast(board: list[list[int]]) -> bool:
    rows = [set() for _ in range(9)]
    cols = [set() for _ in range(9)]
    boxes = [set() for _ in range(9)]
    empty = []

    for r in range(9):
        for c in range(9):
            if board[r][c] != 0:
                num = board[r][c]
                rows[r].add(num)
                cols[c].add(num)
                boxes[3 * (r // 3) + c // 3].add(num)
            else:
                empty.append((r, c))

    def backtrack(idx: int) -> bool:
        if idx == len(empty):
            return True

        r, c = empty[idx]
        box_id = 3 * (r // 3) + c // 3

        for num in range(1, 10):
            if num not in rows[r] and num not in cols[c] and num not in boxes[box_id]:
                board[r][c] = num
                rows[r].add(num)
                cols[c].add(num)
                boxes[box_id].add(num)

                if backtrack(idx + 1):
                    return True

                board[r][c] = 0
                rows[r].remove(num)
                cols[c].remove(num)
                boxes[box_id].remove(num)

        return False

    return backtrack(0)

# Example
board = [
    [5,3,0, 0,7,0, 0,0,0],
    [6,0,0, 1,9,5, 0,0,0],
    [0,9,8, 0,0,0, 0,6,0],
    [8,0,0, 0,6,0, 0,0,3],
    [4,0,0, 8,0,3, 0,0,1],
    [7,0,0, 0,2,0, 0,0,6],
    [0,6,0, 0,0,0, 2,8,0],
    [0,0,0, 4,1,9, 0,0,5],
    [0,0,0, 0,8,0, 0,7,9]
]
solve_sudoku_fast(board)
for row in board:
    print(row)
```

**TypeScript:**

```typescript
function solveSudoku(board: number[][]): boolean {
    const rows: Set<number>[] = Array.from({ length: 9 }, () => new Set());
    const cols: Set<number>[] = Array.from({ length: 9 }, () => new Set());
    const boxes: Set<number>[] = Array.from({ length: 9 }, () => new Set());
    const empty: [number, number][] = [];

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] !== 0) {
                const num = board[r][c];
                rows[r].add(num);
                cols[c].add(num);
                boxes[3 * Math.floor(r / 3) + Math.floor(c / 3)].add(num);
            } else {
                empty.push([r, c]);
            }
        }
    }

    function backtrack(idx: number): boolean {
        if (idx === empty.length) return true;

        const [r, c] = empty[idx];
        const boxId = 3 * Math.floor(r / 3) + Math.floor(c / 3);

        for (let num = 1; num <= 9; num++) {
            if (!rows[r].has(num) && !cols[c].has(num) && !boxes[boxId].has(num)) {
                board[r][c] = num;
                rows[r].add(num);
                cols[c].add(num);
                boxes[boxId].add(num);

                if (backtrack(idx + 1)) return true;

                board[r][c] = 0;
                rows[r].delete(num);
                cols[c].delete(num);
                boxes[boxId].delete(num);
            }
        }
        return false;
    }

    return backtrack(0);
}
```

**Constraint propagation:** Before backtracking, use techniques like **naked singles** (only one
possible value for a cell) and **hidden singles** (a value can only go in one place in a row/col/box)
to fill in forced cells. This can solve easy-to-medium puzzles without any backtracking at all.

---

### 3. Permutations

**Problem:** Generate all permutations of a list of elements.

```
Permutation Tree for [1, 2, 3]:

                     []
                /     |     \
             [1]     [2]     [3]
            / \     / \     / \
         [1,2][1,3][2,1][2,3][3,1][3,2]
          |    |    |    |    |    |
       [1,2,3][1,3,2][2,1,3][2,3,1][3,1,2][3,2,1]

Total: 3! = 6 permutations
```

**Python:**

```python
# Permutations without duplicates
def permutations(nums: list[int]) -> list[list[int]]:
    result = []

    def backtrack(path: list[int], remaining: list[int]):
        if not remaining:
            result.append(path[:])
            return

        for i in range(len(remaining)):
            path.append(remaining[i])
            backtrack(path, remaining[:i] + remaining[i+1:])
            path.pop()

    backtrack([], nums)
    return result

# Permutations WITH duplicates (e.g., [1, 1, 2])
def permutations_unique(nums: list[int]) -> list[list[int]]:
    result = []
    nums.sort()

    def backtrack(path: list[int], used: list[bool]):
        if len(path) == len(nums):
            result.append(path[:])
            return

        for i in range(len(nums)):
            if used[i]:
                continue
            # Skip duplicates: if same as previous AND previous not used
            if i > 0 and nums[i] == nums[i-1] and not used[i-1]:
                continue
            used[i] = True
            path.append(nums[i])
            backtrack(path, used)
            path.pop()
            used[i] = False

    backtrack([], [False] * len(nums))
    return result

print(permutations([1, 2, 3]))
# [[1,2,3], [1,3,2], [2,1,3], [2,3,1], [3,1,2], [3,2,1]]

print(permutations_unique([1, 1, 2]))
# [[1,1,2], [1,2,1], [2,1,1]]
```

**TypeScript:**

```typescript
function permutations(nums: number[]): number[][] {
    const result: number[][] = [];

    function backtrack(path: number[], remaining: number[]): void {
        if (remaining.length === 0) {
            result.push([...path]);
            return;
        }
        for (let i = 0; i < remaining.length; i++) {
            path.push(remaining[i]);
            backtrack(path, [...remaining.slice(0, i), ...remaining.slice(i + 1)]);
            path.pop();
        }
    }

    backtrack([], nums);
    return result;
}

function permutationsUnique(nums: number[]): number[][] {
    const result: number[][] = [];
    nums.sort((a, b) => a - b);
    const used = new Array(nums.length).fill(false);

    function backtrack(path: number[]): void {
        if (path.length === nums.length) {
            result.push([...path]);
            return;
        }
        for (let i = 0; i < nums.length; i++) {
            if (used[i]) continue;
            if (i > 0 && nums[i] === nums[i - 1] && !used[i - 1]) continue;
            used[i] = true;
            path.push(nums[i]);
            backtrack(path);
            path.pop();
            used[i] = false;
        }
    }

    backtrack([]);
    return result;
}
```

---

### 4. Combinations / Subsets

**Python:**

```python
# Combinations: choose k elements from n
def combinations(nums: list[int], k: int) -> list[list[int]]:
    result = []

    def backtrack(start: int, path: list[int]):
        if len(path) == k:
            result.append(path[:])
            return
        # Pruning: need (k - len(path)) more elements, so stop early if not enough remain
        for i in range(start, len(nums) - (k - len(path)) + 1):
            path.append(nums[i])
            backtrack(i + 1, path)
            path.pop()

    backtrack(0, [])
    return result

# Subsets (Power Set): all 2^n subsets
def subsets(nums: list[int]) -> list[list[int]]:
    result = []

    def backtrack(start: int, path: list[int]):
        result.append(path[:])  # every partial path is a valid subset
        for i in range(start, len(nums)):
            path.append(nums[i])
            backtrack(i + 1, path)
            path.pop()

    backtrack(0, [])
    return result

print(combinations([1, 2, 3, 4], 2))
# [[1,2], [1,3], [1,4], [2,3], [2,4], [3,4]]

print(subsets([1, 2, 3]))
# [[], [1], [1,2], [1,2,3], [1,3], [2], [2,3], [3]]
```

**TypeScript:**

```typescript
function combinations(nums: number[], k: number): number[][] {
    const result: number[][] = [];

    function backtrack(start: number, path: number[]): void {
        if (path.length === k) {
            result.push([...path]);
            return;
        }
        for (let i = start; i <= nums.length - (k - path.length); i++) {
            path.push(nums[i]);
            backtrack(i + 1, path);
            path.pop();
        }
    }

    backtrack(0, []);
    return result;
}

function subsets(nums: number[]): number[][] {
    const result: number[][] = [];

    function backtrack(start: number, path: number[]): void {
        result.push([...path]);
        for (let i = start; i < nums.length; i++) {
            path.push(nums[i]);
            backtrack(i + 1, path);
            path.pop();
        }
    }

    backtrack(0, []);
    return result;
}
```

---

### 5. Subset Sum

**Problem:** Find all subsets of a given set that sum to a target value.

**Python:**

```python
def subset_sum(nums: list[int], target: int) -> list[list[int]]:
    result = []
    nums.sort()  # sort to enable pruning

    def backtrack(start: int, path: list[int], remaining: int):
        if remaining == 0:
            result.append(path[:])
            return
        if remaining < 0:
            return  # PRUNE: sum exceeded target

        for i in range(start, len(nums)):
            # PRUNE: if current number exceeds remaining, all subsequent will too
            if nums[i] > remaining:
                break
            # Skip duplicates
            if i > start and nums[i] == nums[i - 1]:
                continue
            path.append(nums[i])
            backtrack(i + 1, path, remaining - nums[i])
            path.pop()

    backtrack(0, [], target)
    return result

print(subset_sum([2, 3, 6, 7], 7))
# [[7]]

print(subset_sum([2, 3, 5, 1, 8], 8))
# [[1, 2, 5], [3, 5], [8]]
```

**TypeScript:**

```typescript
function subsetSum(nums: number[], target: number): number[][] {
    const result: number[][] = [];
    nums.sort((a, b) => a - b);

    function backtrack(start: number, path: number[], remaining: number): void {
        if (remaining === 0) {
            result.push([...path]);
            return;
        }

        for (let i = start; i < nums.length; i++) {
            if (nums[i] > remaining) break;
            if (i > start && nums[i] === nums[i - 1]) continue;
            path.push(nums[i]);
            backtrack(i + 1, path, remaining - nums[i]);
            path.pop();
        }
    }

    backtrack(0, [], target);
    return result;
}
```

---

### 6. Graph Coloring

**Problem:** Color the vertices of a graph with at most `k` colors such that no two adjacent
vertices share the same color.

**Python:**

```python
def graph_coloring(adj: list[list[int]], k: int) -> list[int] | None:
    """
    adj: adjacency list. adj[v] = list of neighbors of vertex v.
    k: number of available colors.
    Returns list of colors (0 to k-1) for each vertex, or None if impossible.
    """
    n = len(adj)
    colors = [-1] * n

    def is_safe(vertex: int, color: int) -> bool:
        for neighbor in adj[vertex]:
            if colors[neighbor] == color:
                return False
        return True

    def backtrack(vertex: int) -> bool:
        if vertex == n:
            return True  # all vertices colored

        for color in range(k):
            if is_safe(vertex, color):
                colors[vertex] = color          # CHOOSE
                if backtrack(vertex + 1):        # EXPLORE
                    return True
                colors[vertex] = -1             # UN-CHOOSE

        return False  # no valid color — backtrack

    if backtrack(0):
        return colors
    return None

# Example: Petersen graph fragment
#   0 --- 1
#   |   / |
#   | /   |
#   2 --- 3
adj = [
    [1, 2],     # 0 connects to 1, 2
    [0, 2, 3],  # 1 connects to 0, 2, 3
    [0, 1, 3],  # 2 connects to 0, 1, 3
    [1, 2]      # 3 connects to 1, 2
]
result = graph_coloring(adj, 3)
print(f"Coloring with 3 colors: {result}")  # e.g., [0, 1, 2, 0]
```

**TypeScript:**

```typescript
function graphColoring(adj: number[][], k: number): number[] | null {
    const n = adj.length;
    const colors = new Array(n).fill(-1);

    function isSafe(vertex: number, color: number): boolean {
        for (const neighbor of adj[vertex]) {
            if (colors[neighbor] === color) return false;
        }
        return true;
    }

    function backtrack(vertex: number): boolean {
        if (vertex === n) return true;

        for (let color = 0; color < k; color++) {
            if (isSafe(vertex, color)) {
                colors[vertex] = color;
                if (backtrack(vertex + 1)) return true;
                colors[vertex] = -1;
            }
        }
        return false;
    }

    return backtrack(0) ? colors : null;
}
```

**Complexity:** O(k^n) worst case. Graph coloring is NP-complete in general.

---

### 7. Word Search in Grid

**Problem:** Given a 2D board of characters and a word, find if the word exists in the grid.
The word can be formed by letters of sequentially adjacent cells (horizontal or vertical
neighbors). Each cell may be used at most once per word.

**Python:**

```python
def word_search(board: list[list[str]], word: str) -> bool:
    rows, cols = len(board), len(board[0])

    def backtrack(r: int, c: int, idx: int) -> bool:
        if idx == len(word):
            return True

        if (r < 0 or r >= rows or c < 0 or c >= cols
                or board[r][c] != word[idx]):
            return False

        # Mark as visited
        temp = board[r][c]
        board[r][c] = "#"

        # Explore all 4 directions
        found = (backtrack(r + 1, c, idx + 1)
                 or backtrack(r - 1, c, idx + 1)
                 or backtrack(r, c + 1, idx + 1)
                 or backtrack(r, c - 1, idx + 1))

        # Restore (un-choose)
        board[r][c] = temp
        return found

    for r in range(rows):
        for c in range(cols):
            if board[r][c] == word[0] and backtrack(r, c, 0):
                return True
    return False

board = [
    ["A", "B", "C", "E"],
    ["S", "F", "C", "S"],
    ["A", "D", "E", "E"]
]
print(word_search(board, "ABCCED"))  # True
print(word_search(board, "SEE"))     # True
print(word_search(board, "ABCB"))    # False
```

**TypeScript:**

```typescript
function wordSearch(board: string[][], word: string): boolean {
    const rows = board.length, cols = board[0].length;

    function backtrack(r: number, c: number, idx: number): boolean {
        if (idx === word.length) return true;
        if (r < 0 || r >= rows || c < 0 || c >= cols || board[r][c] !== word[idx]) {
            return false;
        }

        const temp = board[r][c];
        board[r][c] = "#";

        const found = backtrack(r + 1, c, idx + 1)
            || backtrack(r - 1, c, idx + 1)
            || backtrack(r, c + 1, idx + 1)
            || backtrack(r, c - 1, idx + 1);

        board[r][c] = temp;
        return found;
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] === word[0] && backtrack(r, c, 0)) return true;
        }
    }
    return false;
}
```

**Complexity:** Time O(m * n * 4^L) where m x n is board size and L is word length.
Pruning makes the practical running time much better.

---

## Optimization Techniques

### 1. Constraint Propagation
Reduce the domain of choices before recursing. In Sudoku, after placing a number, eliminate that
number from the candidates of all cells in the same row, column, and box. This can fill in
"forced" cells without any backtracking.

```
Before propagation: Cell (0,2) has candidates {1, 2, 4, 6, 7, 9}
After placing 4 in (0,0): Cell (0,2) has candidates {1, 2, 6, 7, 9}
After placing 7 in (2,2): Cell (0,2) has candidates {1, 2, 6, 9}
After placing 6 in (0,5): Cell (0,2) has candidates {1, 2, 9}
...
Eventually: Cell (0,2) has candidates {1} ← forced! No backtracking needed.
```

### 2. Ordering Heuristics — Most Constrained Variable (MRV)
Choose the variable with the **fewest remaining valid choices** first. This fails fast: if a
variable has only 1 or 2 options, try it first — if it leads to failure, we discover this quickly.

```python
# MRV for Sudoku: pick empty cell with fewest candidates
def find_most_constrained(board, rows, cols, boxes):
    min_options = 10
    best_cell = None
    for r in range(9):
        for c in range(9):
            if board[r][c] == 0:
                box_id = 3 * (r // 3) + c // 3
                options = 9 - len(rows[r]) - len(cols[c]) - len(boxes[box_id])
                # (simplified — real calculation needs set union)
                if options < min_options:
                    min_options = options
                    best_cell = (r, c)
    return best_cell
```

### 3. Forward Checking
After making a choice, immediately check if any unassigned variable has **no valid options left**.
If so, backtrack immediately without recursing further. This catches failures earlier than
standard backtracking.

### 4. Symmetry Breaking
Avoid exploring solutions that are rotations, reflections, or permutations of already-found
solutions. For N-Queens, we can fix the first queen in the first half of the first row
(columns 0 to n/2 - 1) and multiply the count by 2.

```python
# N-Queens with symmetry breaking (roughly halves the work)
def n_queens_symmetric(n: int) -> int:
    count = [0]
    cols, diag1, diag2 = set(), set(), set()

    def backtrack(row, queens):
        if row == n:
            count[0] += 1
            return
        limit = (n + 1) // 2 if row == 0 else n  # symmetry: first row only half
        for col in range(limit):
            if col in cols or (row - col) in diag1 or (row + col) in diag2:
                continue
            cols.add(col); diag1.add(row - col); diag2.add(row + col)
            queens.append(col)
            backtrack(row + 1, queens)
            queens.pop()
            cols.remove(col); diag1.remove(row - col); diag2.remove(row + col)

    backtrack(0, [])
    return count[0] * 2  # approximate (exact symmetry counting is more nuanced)
```

---

## Backtracking vs Brute Force

```
                     Brute Force                    Backtracking
──────────────────────────────────────────────────────────────────────
Strategy          Generate ALL candidates,        Build incrementally,
                  then check each                 prune invalid branches

Search space      Explores everything             Prunes early
                  (exhaustive)                     (often exponentially less)

N-Queens (n=8)    8^8 = 16,777,216 candidates     ~15,720 nodes explored
                  (check all placements)           (with column constraint)

Efficiency        O(n^n) or worse                  O(n!) or better with pruning

When to use       When you can't prune             When constraints allow
                  (no constraints to check)        early elimination
```

---

## Time Complexity Analysis

Backtracking algorithms are typically **exponential** in the worst case:

| Problem | Brute Force | Backtracking | Actual Solutions |
|---|---|---|---|
| N-Queens (n=8) | O(n^n) = 16.7M | O(n!) ~ 40K nodes | 92 solutions |
| Sudoku | O(9^81) | O(9^k), k=empty cells | 1 solution (typically) |
| Permutations | O(n * n!) | O(n!) | n! permutations |
| Subsets | O(2^n) | O(2^n) | 2^n subsets |
| Graph Coloring | O(k^n) | O(k^n) with pruning | Depends on graph |

The power of backtracking is not in worst-case complexity (still exponential) but in
**practical performance** through pruning. A well-designed backtracking solution with good
heuristics can solve instances that are theoretically intractable.

```
Pruning Effect on Search Tree:

Full tree (brute force):          Pruned tree (backtracking):
        *                                *
      / | \                            / | \
     *  *  *                          *  X  *
    /|\ /|\ /|\                      /|\    /|\
   *** *** ***                      *X*    **X
  ... ... ...                      /       |
                                  *        *
                                  |
                                  SOLUTION

  X = pruned branches (not explored)
```

---

## Branch and Bound

**Branch and Bound (B&B)** is an extension of backtracking used for **optimization problems**.
It adds **bounds** (upper and lower estimates) to prune branches that cannot lead to a better
solution than the best one found so far.

```
Branch and Bound vs Backtracking:

Backtracking:  "Can this lead to ANY valid solution?"  → prune if no
Branch & Bound: "Can this lead to a BETTER solution?"  → prune if no

B&B maintains a 'best so far' value and prunes branches where
the upper bound < best so far.
```

**Applications:**
- **Traveling Salesman Problem (TSP):** Lower bound using MST or 1-tree relaxation.
- **Integer Linear Programming:** Lower bound from LP relaxation.
- **Job Shop Scheduling:** Upper bound from greedy heuristic, lower bound from relaxation.

**Python — B&B for TSP (simplified):**

```python
import math

def tsp_branch_and_bound(dist: list[list[float]]) -> tuple[float, list[int]]:
    """
    dist: n x n distance matrix.
    Returns (minimum cost, tour).
    """
    n = len(dist)
    best_cost = [math.inf]
    best_tour = [None]

    def lower_bound(visited: set, current: int) -> float:
        """Simple lower bound: sum of minimum edges from unvisited nodes."""
        bound = 0
        for v in range(n):
            if v not in visited:
                min_edge = min(dist[v][u] for u in range(n) if u != v)
                bound += min_edge
        return bound

    def backtrack(current: int, visited: set, path: list[int], cost: float):
        if len(visited) == n:
            total = cost + dist[current][0]  # return to start
            if total < best_cost[0]:
                best_cost[0] = total
                best_tour[0] = path[:]
            return

        # Branch and BOUND: prune if lower bound exceeds best known solution
        lb = cost + lower_bound(visited, current)
        if lb >= best_cost[0]:
            return  # PRUNE

        for next_city in range(n):
            if next_city not in visited:
                visited.add(next_city)
                path.append(next_city)
                backtrack(next_city, visited, path, cost + dist[current][next_city])
                path.pop()
                visited.remove(next_city)

    backtrack(0, {0}, [0], 0)
    return best_cost[0], best_tour[0]

# Example: 4-city TSP
dist = [
    [0, 10, 15, 20],
    [10, 0, 35, 25],
    [15, 35, 0, 30],
    [20, 25, 30, 0]
]
cost, tour = tsp_branch_and_bound(dist)
print(f"Minimum cost: {cost}, Tour: {tour}")
# Minimum cost: 80, Tour: [0, 1, 3, 2]
```

---

## Summary: When to Use Backtracking

Use backtracking when:
- The problem asks to find **all solutions** or **any solution** satisfying constraints
- The solution can be built **incrementally** (one choice at a time)
- There are **constraints** that allow early pruning
- The search space is finite but too large for brute force
- Keywords: "find all," "generate," "enumerate," "N-Queens," "Sudoku," "permutations"

Do NOT use backtracking when:
- A polynomial algorithm exists (e.g., use DP for shortest path, greedy for MST)
- The problem has no constraints to prune (backtracking degenerates to brute force)
- The search space is small enough for brute force (simpler to implement)

---

## Sources

- **Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C.** *Introduction to Algorithms*
  (CLRS), Supplementary material on backtracking and branch-and-bound.
- **Skiena, S. S.** *The Algorithm Design Manual*, Chapter 7: Combinatorial Search and Heuristic
  Methods.
- **Knuth, D. E.** *The Art of Computer Programming*, Volume 4A: Combinatorial Algorithms,
  Part 1. Section 7.2.2: Backtrack Programming.
- **Russell, S. & Norvig, P.** *Artificial Intelligence: A Modern Approach*, Chapter 6:
  Constraint Satisfaction Problems.
- **Wikipedia** — Backtracking: https://en.wikipedia.org/wiki/Backtracking
- **LeetCode** — Backtracking problem set: https://leetcode.com/tag/backtracking/
