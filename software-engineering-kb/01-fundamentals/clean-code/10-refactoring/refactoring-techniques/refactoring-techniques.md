# Refactoring Techniques

> **Domain:** Fundamentals > Clean Code > Refactoring
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Refactoring is the process of **changing the internal structure of code without changing its external behavior**. Martin Fowler's *Refactoring* (1999, 2nd ed. 2018) catalogs ~70 techniques.

> "Refactoring is a disciplined technique for restructuring an existing body of code, altering its internal structure without changing its external behavior." — Martin Fowler

## Why It Matters

Refactoring keeps code healthy over time. Without it, every feature addition makes the code worse (entropy). With regular refactoring, code improves continuously, keeping development velocity high.

## How It Works

### Composing Methods

**Extract Function** (most common refactoring):
```typescript
// BEFORE
function printOwing(invoice: Invoice) {
  let outstanding = 0;
  console.log("***********************");
  console.log("**** Customer Owes ****");
  for (const o of invoice.orders) {
    outstanding += o.amount;
  }
  console.log(`name: ${invoice.customer}`);
  console.log(`amount: ${outstanding}`);
}

// AFTER
function printOwing(invoice: Invoice) {
  printBanner();
  const outstanding = calculateOutstanding(invoice);
  printDetails(invoice, outstanding);
}
```

**Replace Temp with Query:**
```python
# BEFORE
base_price = quantity * item_price
if base_price > 1000:
    return base_price * 0.95

# AFTER
if base_price(quantity, item_price) > 1000:
    return base_price(quantity, item_price) * 0.95

def base_price(quantity, item_price):
    return quantity * item_price
```

### Simplifying Conditionals

**Decompose Conditional:**
```java
// BEFORE
if (date.before(SUMMER_START) || date.after(SUMMER_END)) {
    charge = quantity * winterRate + winterServiceCharge;
} else {
    charge = quantity * summerRate;
}

// AFTER
if (isWinter(date)) {
    charge = winterCharge(quantity);
} else {
    charge = summerCharge(quantity);
}
```

**Replace Conditional with Polymorphism:**
```typescript
// BEFORE
function calculatePay(employee: Employee): number {
  switch (employee.type) {
    case 'hourly': return employee.hours * employee.rate;
    case 'salaried': return employee.salary / 12;
    case 'commission': return employee.sales * employee.commissionRate;
  }
}

// AFTER
interface Employee { calculatePay(): number; }
class HourlyEmployee implements Employee {
  calculatePay() { return this.hours * this.rate; }
}
class SalariedEmployee implements Employee {
  calculatePay() { return this.salary / 12; }
}
```

### Moving Features

**Extract Class:** Split a class with multiple responsibilities into two focused classes.

**Move Method:** Move a method to the class where most of its data lives (fixes Feature Envy).

**Introduce Parameter Object:** Replace related parameters with a single object.
```typescript
// BEFORE
function amountInRange(start: Date, end: Date, min: number, max: number) {}

// AFTER
function amountInRange(dateRange: DateRange, amountRange: AmountRange) {}
```

## Best Practices

1. **Always have tests before refactoring.** Tests are your safety net.
2. **Take small steps.** Each step should keep tests green.
3. **Commit frequently** during refactoring — each small step is a safe checkpoint.
4. **Refactor and feature work in separate commits.** Makes code review much easier.
5. **Use IDE refactoring tools.** Rename, Extract Method, Move — let the IDE do it safely.

## Sources

- Fowler, M. (2018). *Refactoring* (2nd ed.). Addison-Wesley.
- [Refactoring Guru — Techniques](https://refactoring.guru/refactoring/techniques)
- [Catalog of Refactorings](https://refactoring.com/catalog/)
