# Immutability

> **Domain:** Fundamentals > Programming Paradigms > Functional
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Immutability means that once a value is created, it **cannot be changed**. Instead of modifying existing data, you create new values with the desired changes. Immutable data eliminates entire categories of bugs — race conditions, unexpected state changes, and stale references. It is a cornerstone of functional programming and increasingly adopted in imperative languages.

## How It Works

```typescript
// MUTABLE — changes in place (dangerous)
const user = { name: "Alice", age: 30 };
user.age = 31;  // mutates original — any reference sees the change

// IMMUTABLE — create new object with changes
const user1 = { name: "Alice", age: 30 } as const;
const user2 = { ...user1, age: 31 };  // spread: new object, original unchanged

// Deep immutability with readonly
interface User {
  readonly name: string;
  readonly age: number;
  readonly address: Readonly<{ city: string; zip: string }>;
}

// Immutable array operations
const nums = [1, 2, 3, 4, 5];
// BAD (mutating): nums.push(6), nums.sort(), nums.splice(1, 1)
// GOOD (new arrays):
const added   = [...nums, 6];                    // [1,2,3,4,5,6]
const removed = nums.filter(n => n !== 3);       // [1,2,4,5]
const updated = nums.map(n => n === 3 ? 30 : n); // [1,2,30,4,5]
const sorted  = [...nums].sort();                 // new sorted array
```

```python
# Python — immutable data structures
from dataclasses import dataclass, replace

# Frozen dataclass — immutable after creation
@dataclass(frozen=True)
class Point:
    x: float
    y: float

p1 = Point(1.0, 2.0)
# p1.x = 3.0  # FrozenInstanceError!
p2 = replace(p1, x=3.0)  # create new Point with x=3.0

# Tuples are immutable, lists are mutable
coords = (1, 2, 3)       # immutable
# coords[0] = 5          # TypeError!

# frozenset — immutable set
tags = frozenset({"python", "functional", "immutable"})
new_tags = tags | {"programming"}  # new frozenset, original unchanged

# NamedTuple — immutable record
from typing import NamedTuple

class Config(NamedTuple):
    host: str
    port: int
    debug: bool = False

config = Config("localhost", 8080)
# config.port = 3000  # AttributeError!
```

```rust
// Rust — immutable by default
let x = 5;          // immutable by default
// x = 6;           // ERROR: cannot assign twice to immutable variable

let mut y = 5;      // explicitly opt-in to mutability
y = 6;              // OK

// Ownership system enforces single mutable reference
let mut data = vec![1, 2, 3];
let r1 = &data;      // immutable borrow — OK
let r2 = &data;      // second immutable borrow — OK
// let r3 = &mut data; // ERROR: cannot borrow as mutable while immutable borrows exist

// Functional update with structs
#[derive(Clone)]
struct User { name: String, age: u32 }

let alice = User { name: "Alice".into(), age: 30 };
let older_alice = User { age: 31, ..alice.clone() };
```

### Structural Sharing (Persistent Data Structures)

```typescript
// Immer.js — efficient immutable updates with structural sharing
import produce from "immer";

interface State {
  users: User[];
  settings: { theme: string; notifications: boolean };
}

const state1: State = {
  users: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }],
  settings: { theme: "dark", notifications: true },
};

// Immer: write "mutable" code, get immutable result
const state2 = produce(state1, draft => {
  draft.users[0].name = "Alicia";  // looks mutable, but creates new state
});

state1.users[0].name;  // "Alice"   — original unchanged
state2.users[0].name;  // "Alicia"  — new state
state1.settings === state2.settings;  // true — shared (unchanged parts reused)
```

### Why Immutability Matters for Concurrency

```
Mutable shared state + concurrency = race conditions

Thread A: balance = account.balance      // reads 1000
Thread B: balance = account.balance      // reads 1000
Thread A: account.balance = balance - 100 // writes 900
Thread B: account.balance = balance - 200 // writes 800 (should be 700!)

With immutability: no shared mutable state → no race conditions
Each thread works with its own immutable snapshot of data.
```

## Sources

- Okasaki, C. (1998). *Purely Functional Data Structures*. Cambridge University Press.
- [Immer.js Documentation](https://immerjs.github.io/immer/)
- Bloch, J. (2018). *Effective Java*. 3rd ed. Item 17: "Minimize mutability."
