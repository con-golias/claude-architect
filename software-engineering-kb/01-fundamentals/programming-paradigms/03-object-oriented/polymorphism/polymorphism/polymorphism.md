# Polymorphism

> **Domain:** Fundamentals > Programming Paradigms > Object-Oriented
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Polymorphism means **"many forms"** — the ability to use a single interface to represent different underlying types. The same operation behaves differently depending on the type it acts upon. It is arguably the most powerful concept in OOP, enabling extensibility without modifying existing code.

## Types of Polymorphism

### 1. Subtype Polymorphism (Runtime / Inclusion)

```typescript
// Same interface, different implementations — resolved at runtime
interface PaymentMethod {
  charge(amount: number): Promise<Receipt>;
  refund(receiptId: string): Promise<void>;
}

class CreditCard implements PaymentMethod {
  async charge(amount: number) {
    return stripe.charges.create({ amount, currency: "usd" });
  }
  async refund(receiptId: string) { await stripe.refunds.create(receiptId); }
}

class PayPal implements PaymentMethod {
  async charge(amount: number) {
    return paypal.createPayment({ amount });
  }
  async refund(receiptId: string) { await paypal.refundPayment(receiptId); }
}

class Crypto implements PaymentMethod {
  async charge(amount: number) {
    return blockchain.sendTransaction({ amount });
  }
  async refund(receiptId: string) { await blockchain.reverseTransaction(receiptId); }
}

// Client code — works with any PaymentMethod without knowing the type
async function processOrder(payment: PaymentMethod, amount: number) {
  const receipt = await payment.charge(amount);  // polymorphic call
  return receipt;
}
```

### 2. Parametric Polymorphism (Generics)

```typescript
// Same function works for ANY type — resolved at compile time
function first<T>(items: T[]): T | undefined {
  return items.length > 0 ? items[0] : undefined;
}

first([1, 2, 3]);        // number
first(["a", "b"]);       // string
first([true, false]);    // boolean

// Generic class
class Stack<T> {
  private items: T[] = [];
  push(item: T): void { this.items.push(item); }
  pop(): T | undefined { return this.items.pop(); }
  peek(): T | undefined { return this.items[this.items.length - 1]; }
}

const numStack = new Stack<number>();
const strStack = new Stack<string>();
```

### 3. Ad-hoc Polymorphism (Overloading)

```java
// Java — same method name, different parameter types
public class Calculator {
    public int add(int a, int b) { return a + b; }
    public double add(double a, double b) { return a + b; }
    public String add(String a, String b) { return a + b; }  // concatenation

    // Resolved at COMPILE time based on argument types
}
```

### 4. Duck Typing (Structural Polymorphism)

```python
# Python — if it walks like a duck and quacks like a duck...
class Dog:
    def speak(self): return "Woof!"

class Cat:
    def speak(self): return "Meow!"

class Robot:
    def speak(self): return "Beep boop!"

# No shared base class needed — just needs speak() method
def greet(entity):
    print(entity.speak())

greet(Dog())    # "Woof!"
greet(Cat())    # "Meow!"
greet(Robot())  # "Beep boop!"
```

```go
// Go — structural typing via interfaces (implicit implementation)
type Writer interface {
    Write(data []byte) (int, error)
}

// File satisfies Writer without declaring "implements Writer"
type File struct { /* ... */ }
func (f *File) Write(data []byte) (int, error) { /* ... */ }

// Buffer also satisfies Writer
type Buffer struct { /* ... */ }
func (b *Buffer) Write(data []byte) (int, error) { /* ... */ }

// Any type with Write() method is a Writer
func save(w Writer, data []byte) { w.Write(data) }
```

### Polymorphism Comparison

```
Type             Resolution   Mechanism            Languages
─────────────────────────────────────────────────────────────
Subtype          Runtime      Virtual methods/vtable  Java, C#, TS, Python
Parametric       Compile      Generics/templates      Java, TS, Rust, C++, Go
Ad-hoc           Compile      Method overloading      Java, C++, C#
Duck typing      Runtime      Method existence check  Python, Ruby, JS
Structural       Compile      Shape matching           Go, TypeScript
```

## Real-world Examples

- **JDBC** — `Connection`, `Statement`, `ResultSet` are polymorphic interfaces for any database.
- **`java.util.List`** — `ArrayList`, `LinkedList`, `CopyOnWriteArrayList` all share the same interface.
- **React components** — any component with `render()` (or returning JSX) is polymorphic.
- **Go `io.Reader`/`io.Writer`** — files, buffers, HTTP bodies, sockets — all satisfy the same interface.
- **Python `len()`** — works on strings, lists, dicts, sets, custom `__len__` objects.

## Sources

- Cardelli, L. & Wegner, P. (1985). "On Understanding Types, Data Abstraction, and Polymorphism." *Computing Surveys*, 17(4).
- Strachey, C. (1967). "Fundamental Concepts in Programming Languages." Lecture notes, NATO Summer School.
