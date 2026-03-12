# Adapter Pattern

> **Domain:** Fundamentals > Design Patterns > Structural
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Adapter pattern converts the interface of a class into another interface that clients expect. It allows classes with incompatible interfaces to work together — like a power adapter that lets a US plug fit into a European socket.

**GoF Intent:** "Convert the interface of a class into another interface clients expect. Adapter lets classes work together that couldn't otherwise because of incompatible interfaces."

## How It Works

```typescript
// Existing (incompatible) third-party library
class StripePaymentAPI {
  makeCharge(amountInCents: number, currency: string, cardToken: string): StripeResult {
    return { success: true, chargeId: "ch_123" };
  }
}

// Our application's expected interface
interface PaymentGateway {
  pay(amount: number, cardDetails: CardDetails): PaymentResult;
}

// Adapter — makes Stripe conform to our interface
class StripeAdapter implements PaymentGateway {
  private stripe: StripePaymentAPI;

  constructor(stripe: StripePaymentAPI) {
    this.stripe = stripe;
  }

  pay(amount: number, cardDetails: CardDetails): PaymentResult {
    const cents = Math.round(amount * 100);
    const result = this.stripe.makeCharge(cents, "USD", cardDetails.token);
    return { success: result.success, transactionId: result.chargeId };
  }
}

// Client code — works with any PaymentGateway
function checkout(gateway: PaymentGateway, amount: number, card: CardDetails) {
  return gateway.pay(amount, card);
}

checkout(new StripeAdapter(new StripePaymentAPI()), 49.99, card);
```

```python
# Legacy XML-based data source
class LegacyXMLDataSource:
    def get_xml(self) -> str:
        return "<data><name>Alice</name></data>"

# Modern JSON interface expected by the app
class DataSource(ABC):
    @abstractmethod
    def get_json(self) -> dict: pass

# Adapter
class XMLToJSONAdapter(DataSource):
    def __init__(self, xml_source: LegacyXMLDataSource):
        self.xml_source = xml_source

    def get_json(self) -> dict:
        xml = self.xml_source.get_xml()
        return xml_to_dict(xml)  # convert XML → dict
```

## Best Practices

1. **Wrap third-party libraries** — protect your code from API changes.
2. **Use object adapter (composition)** over class adapter (inheritance) — more flexible.
3. **Keep the adapter thin** — it should only translate, not add business logic.

## Real-world Examples

- **`Arrays.asList()`** (Java) — adapts array to List interface.
- **`java.io.InputStreamReader`** — adapts `InputStream` (bytes) to `Reader` (characters).
- **React wrappers** — adapting a jQuery plugin to a React component.
- **Database drivers** — JDBC adapts each database vendor's protocol to a common interface.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 139-150.
- [Refactoring.Guru — Adapter](https://refactoring.guru/design-patterns/adapter)
