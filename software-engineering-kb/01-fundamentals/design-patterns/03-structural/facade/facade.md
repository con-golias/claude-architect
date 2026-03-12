# Facade Pattern

> **Domain:** Fundamentals > Design Patterns > Structural
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

The Facade pattern provides a **simplified, unified interface** to a complex subsystem. It doesn't encapsulate the subsystem — it just provides a convenient entry point that makes the subsystem easier to use.

**GoF Intent:** "Provide a unified interface to a set of interfaces in a subsystem. Facade defines a higher-level interface that makes the subsystem easier to use."

## How It Works

```typescript
// Complex subsystem classes
class Inventory { check(productId: string): boolean { return true; } }
class Payment { charge(card: string, amount: number): string { return "txn_123"; } }
class Shipping { ship(address: string, productId: string): string { return "track_456"; } }
class EmailService { send(to: string, subject: string, body: string): void { } }

// Facade — hides complexity behind a simple interface
class OrderFacade {
  private inventory = new Inventory();
  private payment = new Payment();
  private shipping = new Shipping();
  private email = new EmailService();

  placeOrder(productId: string, card: string, address: string, email: string): OrderResult {
    // Step 1: Check inventory
    if (!this.inventory.check(productId)) {
      throw new Error("Out of stock");
    }
    // Step 2: Process payment
    const txnId = this.payment.charge(card, 29.99);
    // Step 3: Ship item
    const trackingId = this.shipping.ship(address, productId);
    // Step 4: Send confirmation
    this.email.send(email, "Order Confirmed", `Tracking: ${trackingId}`);

    return { txnId, trackingId };
  }
}

// Client — one simple call instead of coordinating 4 subsystems
const order = new OrderFacade();
order.placeOrder("PROD-1", "card_123", "123 Main St", "user@email.com");
```

## Best Practices

1. **Don't hide the subsystem** — the Facade is an addition, not a replacement. Allow direct access when needed.
2. **Keep the Facade thin** — it coordinates, it doesn't implement business logic.
3. **One Facade per bounded context** — avoid God facades that cover everything.

## Real-world Examples

- **jQuery** — `$()` is a facade over complex DOM manipulation.
- **ORMs** — Sequelize, Hibernate facade over raw SQL.
- **`fetch()` API** — simplified facade over XMLHttpRequest.
- **AWS SDK** — `S3Client.send(new PutObjectCommand(...))` hides HTTP/auth complexity.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 185-193.
- [Refactoring.Guru — Facade](https://refactoring.guru/design-patterns/facade)
