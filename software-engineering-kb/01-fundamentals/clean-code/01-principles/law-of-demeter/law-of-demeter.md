# Law of Demeter (LoD)

> **Domain:** Fundamentals > Clean Code > Principles
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Law of Demeter (LoD), also known as the **Principle of Least Knowledge**, was proposed by Ian Holland at Northeastern University in 1987 during work on the Demeter project.

> "Only talk to your immediate neighbors. Don't talk to strangers."

Formally, a method `M` of object `O` should only call methods of:
1. `O` itself
2. Objects passed as parameters to `M`
3. Objects created/instantiated within `M`
4. `O`'s direct component objects (fields/properties)
5. Global objects accessible by `O` in the scope of `M`

The simplest heuristic: **use only one dot.** `customer.getAddress()` is fine; `customer.getAddress().getCity().getZipCode()` violates LoD.

## Why It Matters

### Reduced Coupling
LoD prevents objects from reaching deep into the structure of other objects. This reduces the number of classes that any given class depends on.

### Easier Refactoring
If `Order` only talks to `Customer` (not `Customer.Address.City`), changing the `Address` structure doesn't break `Order`.

### Better Encapsulation
LoD enforces encapsulation by ensuring objects don't expose their internal structure to the outside world.

## How It Works

### Example: Train Wreck Violation

```typescript
// BAD: Train wreck — reaching deep into object graph
const zipCode = order.getCustomer().getAddress().getCity().getZipCode();

// GOOD: Ask, don't dig
const zipCode = order.getShippingZipCode();
```

```typescript
// Inside Order class:
class Order {
  getShippingZipCode(): string {
    return this.customer.getShippingZipCode();
  }
}

// Inside Customer class:
class Customer {
  getShippingZipCode(): string {
    return this.address.getZipCode();
  }
}
```

### Python Example

```python
# BAD: Violates LoD — knows too much about internal structure
def calculate_shipping(order):
    distance = get_distance(
        order.customer.address.city.coordinates,   # Train wreck!
        order.warehouse.location.coordinates        # Train wreck!
    )
    return distance * RATE_PER_KM

# GOOD: Each object delegates to its immediate neighbor
def calculate_shipping(order):
    distance = order.shipping_distance()
    return distance * RATE_PER_KM

class Order:
    def shipping_distance(self) -> float:
        return self.customer.distance_to(self.warehouse.coordinates())
```

### Java Example

```java
// BAD: Exposing internal structure
public String getCustomerCity(Invoice invoice) {
    return invoice.getCustomer()
                  .getAddress()
                  .getCity()
                  .getName();
}

// GOOD: Tell, don't ask
public String getCustomerCity(Invoice invoice) {
    return invoice.getCustomerCityName();
}
```

### When LoD Doesn't Apply

LoD applies to **behavior-rich objects**, not data structures. Chaining on plain data is acceptable:

```typescript
// This is FINE — it's data, not behavior
const city = user.address.city;

// This is FINE — fluent builder pattern
const query = QueryBuilder
  .select('name', 'email')
  .from('users')
  .where('active', true)
  .limit(10);
```

## Best Practices

1. **Follow "Tell, Don't Ask."** Instead of extracting data from an object and making decisions, tell the object what you want and let it decide how.

2. **Create wrapper/delegate methods** that hide internal navigation. This puts the knowledge where it belongs.

3. **Use the Facade pattern** to provide a simplified interface to complex subsystems.

4. **Don't apply LoD to data structures.** DTOs, value objects, and configuration objects are meant to be accessed directly.

5. **Watch for long method chains.** More than two dots in a chain is a code smell (unless it's a fluent API or stream/LINQ operations).

## Anti-patterns / Common Mistakes

### The Wrapper Explosion
Over-applying LoD by creating dozens of forwarding methods. If every object wraps every method of its children, you've just created a maze of indirection.

### Confusing Fluent APIs with Train Wrecks
```typescript
// This is NOT a LoD violation — it's a fluent API returning the same builder
const result = array.filter(x => x > 0).map(x => x * 2).reduce((a, b) => a + b, 0);
```

### Feature Envy
When a class extensively queries another object's properties, it often means the behavior should be moved to that object instead.

## Real-world Examples

### Django's ORM
Django's queryset chaining (`User.objects.filter(...).exclude(...).order_by(...)`) looks like a train wreck but is actually a fluent API — each call returns a new queryset, not drilling into an object's internals.

### React Props Drilling
Props drilling in React (passing data through many levels) is a form of LoD violation at the component level. Solutions like Context or state management libraries (Redux, Zustand) address this.

## Sources

- Holland, I. (1987). *The Law of Demeter*. Northeastern University, Demeter Project.
- Lieberherr, K. et al. (1989). "Object-Oriented Programming: An Objective Sense of Style." OOPSLA '89.
- Martin, R.C. (2008). *Clean Code*. Chapter 6: Objects and Data Structures.
- [The Law of Demeter by Example (Medium)](https://medium.com/vattenfall-tech/the-law-of-demeter-by-example-fd7adbf0c324)
- [Law of Demeter — Wikipedia](https://en.wikipedia.org/wiki/Law_of_Demeter)
