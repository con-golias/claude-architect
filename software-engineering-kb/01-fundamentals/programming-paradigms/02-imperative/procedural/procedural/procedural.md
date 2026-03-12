# Procedural Programming

> **Domain:** Fundamentals > Programming Paradigms > Imperative
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

Procedural programming organizes code as a **sequence of instructions grouped into procedures (functions/subroutines)** that operate on data. The program executes step by step, calling procedures to perform tasks. Data and functions are separate — procedures receive data, process it, and return results.

**Key Characteristics:**
- Sequential execution (top-down)
- Procedures/functions as the primary organizational unit
- Shared mutable state (global or passed by reference)
- Data and behavior are separate

## How It Works

```c
// C — the canonical procedural language
#include <stdio.h>
#include <string.h>

// Data structures
typedef struct {
    char name[50];
    double balance;
} Account;

// Procedures operate on data
void deposit(Account *acc, double amount) {
    if (amount > 0) {
        acc->balance += amount;
        printf("Deposited %.2f to %s\n", amount, acc->name);
    }
}

void withdraw(Account *acc, double amount) {
    if (amount > 0 && amount <= acc->balance) {
        acc->balance -= amount;
        printf("Withdrew %.2f from %s\n", amount, acc->name);
    } else {
        printf("Insufficient funds in %s\n", acc->name);
    }
}

void transfer(Account *from, Account *to, double amount) {
    withdraw(from, amount);
    deposit(to, amount);
}

void print_balance(const Account *acc) {
    printf("%s: $%.2f\n", acc->name, acc->balance);
}

int main(void) {
    Account alice = {"Alice", 1000.0};
    Account bob   = {"Bob", 500.0};

    deposit(&alice, 200.0);
    transfer(&alice, &bob, 300.0);
    print_balance(&alice);  // Alice: $900.00
    print_balance(&bob);    // Bob: $800.00

    return 0;
}
```

```python
# Python — procedural style
import csv
from typing import List, Dict

# Procedures for data processing pipeline
def read_data(filepath: str) -> List[Dict]:
    with open(filepath) as f:
        return list(csv.DictReader(f))

def filter_active(records: List[Dict]) -> List[Dict]:
    return [r for r in records if r["status"] == "active"]

def calculate_totals(records: List[Dict]) -> float:
    return sum(float(r["amount"]) for r in records)

def generate_report(total: float, count: int) -> str:
    return f"Processed {count} records. Total: ${total:.2f}"

# Main procedure — orchestrates the pipeline
def main():
    data = read_data("transactions.csv")
    active = filter_active(data)
    total = calculate_totals(active)
    report = generate_report(total, len(active))
    print(report)

if __name__ == "__main__":
    main()
```

```go
// Go — modern procedural style with packages
package main

import (
    "fmt"
    "sort"
)

type Student struct {
    Name   string
    Grade  float64
}

func average(students []Student) float64 {
    sum := 0.0
    for _, s := range students {
        sum += s.Grade
    }
    return sum / float64(len(students))
}

func topStudents(students []Student, n int) []Student {
    sorted := make([]Student, len(students))
    copy(sorted, students)
    sort.Slice(sorted, func(i, j int) bool {
        return sorted[i].Grade > sorted[j].Grade
    })
    if n > len(sorted) { n = len(sorted) }
    return sorted[:n]
}

func main() {
    students := []Student{
        {"Alice", 92.5}, {"Bob", 87.3}, {"Carol", 95.1}, {"Dave", 78.8},
    }
    fmt.Printf("Average: %.1f\n", average(students))
    for _, s := range topStudents(students, 2) {
        fmt.Printf("Top: %s (%.1f)\n", s.Name, s.Grade)
    }
}
```

### Procedural vs OOP vs Functional

```
                  Procedural          OOP                  Functional
──────────────────────────────────────────────────────────────────────
Organization      Functions           Classes + methods    Pure functions
State             Shared mutable      Encapsulated         Immutable
Data flow         Passed to fns       Owned by objects     Transformed
Primary unit      Procedure           Object               Function
Reuse             Function calls      Inheritance/comp     Composition
Concurrency       Difficult (shared)  Moderate             Easy (no state)
Best for          Scripts, systems    Business domains     Transformations
```

## Real-world Examples

- **Linux kernel** — 30M+ lines of procedural C code.
- **SQLite** — entire database engine in procedural C.
- **Shell scripts** — Bash/PowerShell are inherently procedural.
- **Data pipelines** — ETL scripts in Python procedural style.
- **Embedded systems** — C for microcontrollers (Arduino, STM32).
- **Game loops** — core update/render cycle is procedural.

## Sources

- Kernighan, B.W. & Ritchie, D.M. (1988). *The C Programming Language*. 2nd ed. Prentice Hall.
- Wirth, N. (1976). *Algorithms + Data Structures = Programs*. Prentice Hall.
