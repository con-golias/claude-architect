# Domain-Driven Design: Ubiquitous Language — Complete Specification

> **AI Plugin Directive:** Ubiquitous Language is the FOUNDATION of DDD. Before writing ANY code, establish and enforce a shared vocabulary between domain experts and developers. Every class name, method name, variable name, and module name MUST use the domain's language, not technical jargon.

---

## 1. The Core Rule

**Every term in the code MUST match exactly the language domain experts use. If a domain expert says "Order Fulfillment," the code says `OrderFulfillment` — NOT `ProcessOrder`, NOT `HandleShipment`, NOT `OrderService`.**

---

## 2. Rules for Establishing Ubiquitous Language

### Rule 1: Domain Experts Name Things, Not Developers

```typescript
// ❌ WRONG: Developer-named concepts
class OrderProcessor {
  handleData(input: DataPayload): ProcessResult { }
  updateRecord(id: string, data: any): void { }
}

// ✅ CORRECT: Domain expert-named concepts
class OrderFulfillment {
  fulfillOrder(orderId: OrderId): FulfillmentResult { }
  scheduleDelivery(order: Order, address: DeliveryAddress): DeliverySchedule { }
  confirmPickup(orderId: OrderId, carrier: Carrier): PickupConfirmation { }
}
```

### Rule 2: Names Must Be Precise and Unambiguous

```typescript
// ❌ WRONG: Vague, generic names
interface Service { }
interface Manager { }
interface Handler { }
interface Processor { }
interface Helper { }

// ✅ CORRECT: Precise domain terms
interface PricingPolicy { }
interface InventoryAllocator { }
interface ShipmentTracker { }
interface CreditAssessor { }
interface ClaimAdjudicator { }
```

### Rule 3: Use Domain Verbs, Not CRUD Verbs

```typescript
// ❌ WRONG: CRUD/technical verbs
class OrderService {
  create(data: OrderData): Order { }
  update(id: string, data: Partial<OrderData>): Order { }
  delete(id: string): void { }
}

// ✅ CORRECT: Domain verbs that describe what actually happens
class Order {
  static place(items: OrderItem[], customer: Customer): Order { }
  submit(): void { }
  cancel(reason: CancellationReason): void { }
  fulfill(shipment: Shipment): void { }
  refund(amount: Money, reason: RefundReason): Refund { }
  hold(reason: HoldReason): void { }
  release(): void { }
  amend(changes: OrderAmendment): void { }
  split(criteria: SplitCriteria): [Order, Order] { }
}
```

### Rule 4: Different Contexts Use Different Names for the Same Real-World Thing

```typescript
// In SALES context: "Customer" means someone who buys
namespace Sales {
  class Customer {
    name: CustomerName;
    creditLimit: Money;
    orderHistory: OrderSummary[];
    purchasingPreferences: PurchasingPreferences;
  }
}

// In SHIPPING context: Same person is a "Recipient"
namespace Shipping {
  class Recipient {
    name: RecipientName;
    deliveryAddress: DeliveryAddress;
    deliveryInstructions: string;
    contactPhone: PhoneNumber;
  }
}

// In BILLING context: Same person is an "AccountHolder"
namespace Billing {
  class AccountHolder {
    billingAddress: BillingAddress;
    paymentMethods: PaymentMethod[];
    outstandingBalance: Money;
  }
}

// This is NOT duplication — it's intentional bounded context separation
```

### Rule 5: Maintain a Living Glossary

**Every project MUST have a glossary document.**

```markdown
# Domain Glossary — E-Commerce Platform

## Order
A request by a Customer to purchase Products. States: Draft → Submitted →
Confirmed → Fulfilled → Delivered → Completed. NOT the same as "Cart".

## Fulfillment
Picking, packing, and shipping an Order. Begins after Confirmation + payment capture.

## Backorder
Product ordered but out of stock. Order accepted, Fulfillment delayed.

## SKU (Stock Keeping Unit)
Unique identifier for a Product variant. NOT the same as Product (which has multiple SKUs).

## Return
Customer sends back a received Product. Triggers Return Authorization (RA).

## Chargeback
Customer disputes charge with bank. NOT the same as Refund (merchant-initiated).
```

---

## 3. Naming Conventions by Code Element

### Entity Names
```
❌ BAD              ✅ GOOD
UserEntity          Customer
OrderModel          PurchaseOrder
ProductRecord       Product
TransactionLog      PaymentTransaction
ItemData            LineItem
```

### Method Names
```
❌ BAD                         ✅ GOOD
order.process()                order.submit()
order.setStatus('cancelled')   order.cancel(reason)
order.updateAmount(newAmount)   order.applyDiscount(discount)
account.changeBalance(-100)    account.debit(Money.of(100, 'USD'))
user.setActive(false)          employee.terminate(effectiveDate)
```

### Event Names
```
❌ BAD                          ✅ GOOD
OrderUpdatedEvent               OrderSubmittedEvent
StatusChangedEvent              OrderCancelledEvent
DataModifiedEvent               PaymentCapturedEvent
RecordCreatedEvent              InventoryReplenishedEvent
```

### Value Object Names
```
❌ BAD               ✅ GOOD
StringWrapper        EmailAddress
NumberValue          Money
IdField              OrderNumber
DateRange            PolicyPeriod
AddressInfo          DeliveryAddress
```

### Service/Policy Names
```
❌ BAD                        ✅ GOOD
OrderService                  PricingEngine
PaymentManager                PaymentProcessor
NotificationHelper            ClaimNotifier
DataTransformer               CurrencyConverter
```

---

## 4. Domain Language Patterns

### State Transitions

```typescript
// Name states after domain terminology
enum OrderStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FULFILLED = 'fulfilled',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
}

// Methods use domain verbs
class Order {
  submit(): void { }       // DRAFT → SUBMITTED
  confirm(): void { }      // SUBMITTED → CONFIRMED
  fulfill(): void { }      // CONFIRMED → FULFILLED
  deliver(): void { }      // FULFILLED → DELIVERED
  cancel(reason): void { } // cancellable state → CANCELLED
}
```

### Quantities and Measurements

```typescript
// ❌ BAD: Primitives
function calculateShipping(weight: number, distance: number): number { }

// ✅ GOOD: Domain types
function calculateShipping(weight: Weight, distance: Distance): ShippingCost { }

class Weight {
  static kilograms(value: number): Weight { }
  static pounds(value: number): Weight { }
  toKilograms(): Weight { }
}
```

### Domain Policies

```typescript
// Name policies after what the business calls them
class LoyaltyDiscountPolicy {
  calculateDiscount(customer: Customer, order: Order): Discount {
    if (customer.tier === LoyaltyTier.GOLD && order.totalAmount.isGreaterThan(Money.of(100, 'USD'))) {
      return Discount.percentage(15);
    }
    return Discount.none();
  }
}

class ReturnPolicy {
  canReturn(order: Order, item: LineItem, requestDate: Date): ReturnEligibility {
    const daysSinceDelivery = DateDiff.days(order.deliveredAt, requestDate);
    if (daysSinceDelivery > 30) return ReturnEligibility.expired();
    if (item.isCustomized) return ReturnEligibility.nonReturnable();
    return ReturnEligibility.eligible(this.calculateRefundAmount(item));
  }
}
```

---

## 5. Language Discovery Techniques

### Event Storming Output → Code Mapping

```
Orange sticky (Domain Event)       → DomainEvent class
Blue sticky (Command)              → Use case / Command handler
Yellow sticky (Aggregate)          → Aggregate root entity
Green sticky (Read Model)          → Query result / DTO
Lilac sticky (Policy)              → Domain service / Policy class
Pink sticky (External System)      → Port interface
Small yellow sticky (Actor)        → @CurrentUser parameter
Red sticky (Hotspot)               → Needs clarification
```

### Questions to Ask Domain Experts

1. "What do you call this in your daily work?" → Entity/Value Object name
2. "What happens when...?" → Domain event name
3. "What are the rules for...?" → Business invariant
4. "Can you walk me through the process?" → Use case flow
5. "What's the difference between X and Y?" → Separate concepts?
6. "What would make this invalid?" → Validation rules
7. "When does this change?" → State transition rules
8. "Who is responsible for...?" → Aggregate boundary

---

## 6. Anti-Pattern Quick Reference

| Anti-Pattern | Example | Fix |
|-------------|---------|-----|
| **Technical naming** | `DataProcessor`, `RecordHandler` | `ClaimAdjudicator`, `OrderFulfillment` |
| **CRUD naming** | `createOrder`, `deleteOrder` | `placeOrder`, `cancelOrder` |
| **Generic naming** | `Service`, `Manager`, `Util` | `PricingEngine`, `InventoryAllocator` |
| **Abbreviations** | `txn`, `cust`, `inv`, `amt` | `transaction`, `customer`, `invoice`, `amount` |
| **Mixed language** | "order" and "purchase" for same thing | Pick ONE term per context |
| **Technical events** | `RecordUpdatedEvent` | `OrderShippedEvent` |
| **Boolean flags** | `isActive`, `isProcessed` | `status === Active` |
| **Primitive obsession** | `email: string`, `price: number` | `email: EmailAddress`, `price: Money` |

---

## 7. Enforcement Rules

1. **NEVER use** `Service`, `Manager`, `Handler`, `Processor`, `Helper`, `Util` in domain layer
2. **ALWAYS ask** "What does the business call this?" before naming
3. **Use domain verbs**: `submit()`, `approve()`, `reject()`, `cancel()`, `fulfill()` — NOT `process()`, `handle()`
4. **Use past-tense domain events**: `OrderSubmittedEvent`, NOT `OrderUpdatedEvent`
5. **Use value objects** for ALL domain concepts: `Money` not `number`, `EmailAddress` not `string`
6. **Different contexts, different names** is CORRECT — not duplication
7. **Maintain a glossary** as a markdown file in the project
8. **When in doubt**, use the MORE specific term
