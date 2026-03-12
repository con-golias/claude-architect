# Constraint Programming

> **Domain:** Fundamentals > Programming Paradigms > Declarative
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

Constraint Programming (CP) solves problems by **declaring variables, their domains, and constraints** that must be satisfied. The solver uses constraint propagation and backtracking search to find solutions. It excels at combinatorial problems like scheduling, resource allocation, and puzzle solving.

## How It Works

```python
# Python — python-constraint library
from constraint import Problem

# Sudoku-like: place digits 1-4 in 2x2 grid
# Each row and column must have distinct values
problem = Problem()
cells = [(r, c) for r in range(2) for c in range(2)]
for cell in cells:
    problem.addVariable(cell, range(1, 5))

# Row constraints: all values in each row must be different
problem.addConstraint(lambda a, b: a != b, [(0,0), (0,1)])
problem.addConstraint(lambda a, b: a != b, [(1,0), (1,1)])

# Column constraints
problem.addConstraint(lambda a, b: a != b, [(0,0), (1,0)])
problem.addConstraint(lambda a, b: a != b, [(0,1), (1,1)])

solutions = problem.getSolutions()
# [{(0,0): 1, (0,1): 2, (1,0): 2, (1,1): 1}, ...]
```

```python
# N-Queens problem — place N queens on NxN board, no two attacking
from constraint import Problem, AllDifferentConstraint

def solve_nqueens(n: int):
    problem = Problem()

    # Variables: one per column, value = row position
    cols = range(n)
    for col in cols:
        problem.addVariable(col, range(n))

    # Constraint 1: no two queens in same row
    problem.addConstraint(AllDifferentConstraint(), cols)

    # Constraint 2: no two queens on same diagonal
    for i in cols:
        for j in range(i + 1, n):
            problem.addConstraint(
                lambda ri, rj, d=j-i: abs(ri - rj) != d, (i, j)
            )

    return problem.getSolutions()

solutions = solve_nqueens(8)
print(f"8-Queens has {len(solutions)} solutions")  # 92 solutions
```

```python
# Scheduling problem — assign tasks to workers with constraints
from constraint import Problem

problem = Problem()

tasks = ["design", "frontend", "backend", "testing", "deploy"]
workers = ["Alice", "Bob", "Carol"]
days = [1, 2, 3, 4, 5]

for task in tasks:
    problem.addVariable(f"{task}_worker", workers)
    problem.addVariable(f"{task}_day", days)

# Alice can't work on day 3
problem.addConstraint(lambda w, d: not (w == "Alice" and d == 3),
                      ("design_worker", "design_day"))

# Backend must be after frontend
problem.addConstraint(lambda fd, bd: bd > fd,
                      ("frontend_day", "backend_day"))

# Testing must be after backend
problem.addConstraint(lambda bd, td: td > bd,
                      ("backend_day", "testing_day"))

# No worker has two tasks on the same day
for i, t1 in enumerate(tasks):
    for t2 in tasks[i+1:]:
        problem.addConstraint(
            lambda w1, d1, w2, d2: not (w1 == w2 and d1 == d2),
            (f"{t1}_worker", f"{t1}_day", f"{t2}_worker", f"{t2}_day")
        )

solutions = problem.getSolutions()
```

### CP vs Other Optimization Approaches

```
Approach                 Best For                          How
──────────────────────────────────────────────────────────────
Constraint Programming   Feasibility + combinatorial       Propagation + search
Linear Programming       Continuous optimization           Simplex / interior point
SAT Solving              Boolean satisfiability            DPLL / CDCL
Integer Programming      Optimization with integers        Branch and bound
Metaheuristics           Large approximate solutions       Genetic, simulated annealing

CP excels when:
  - Many discrete constraints must be satisfied simultaneously
  - The problem is combinatorial (scheduling, routing, timetabling)
  - You need ALL solutions, not just one
  - Constraints are naturally expressible as logical rules
```

## Real-world Examples

- **Airline scheduling** — crew assignment, gate allocation, flight routing.
- **Google OR-Tools** — open-source CP solver for vehicle routing, scheduling.
- **MiniZinc** — high-level constraint modeling language.
- **IBM CPLEX / CP Optimizer** — industrial-strength constraint solvers.
- **Compiler register allocation** — assigning variables to CPU registers.
- **Timetabling** — university course scheduling.

## Sources

- Rossi, F., Van Beek, P. & Walsh, T. (2006). *Handbook of Constraint Programming*. Elsevier.
- [MiniZinc Tutorial](https://www.minizinc.org/doc-2.7.6/en/part_2_tutorial.html)
- [Google OR-Tools — CP-SAT](https://developers.google.com/optimization/cp/cp_solver)
