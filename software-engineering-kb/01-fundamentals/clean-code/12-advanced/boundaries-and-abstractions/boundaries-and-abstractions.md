# Boundaries and Clean Abstractions

> **Domain:** Fundamentals > Clean Code > Advanced
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

Chapter 8 of *Clean Code* — "Boundaries" — addresses how to cleanly integrate third-party code, external APIs, and systems you don't control. The core principle:

> "Wrap third-party code at the boundary to protect your system from external changes."

When a third-party library changes its API, only the wrapper needs updating — not your entire codebase.

### Related Patterns

- **Anti-Corruption Layer (DDD):** A translation layer that prevents external models from corrupting your domain.
- **Ports and Adapters (Hexagonal Architecture):** The domain defines ports (interfaces); adapters implement them for specific technologies.
- **Adapter Pattern (GoF):** Translates one interface to another.

## Why It Matters

External dependencies change without your control. Library updates, API deprecations, and service migrations are inevitable. Clean boundaries isolate your system from these changes.

## How It Works

### Wrapping Third-Party APIs

```typescript
// BAD: Third-party library used directly everywhere
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

class OrderService {
  async saveReceipt(orderId: string, pdf: Buffer) {
    const client = new S3Client({ region: 'us-east-1' });
    await client.send(new PutObjectCommand({
      Bucket: 'receipts',
      Key: `${orderId}.pdf`,
      Body: pdf,
    }));
  }
}

// GOOD: Wrap the boundary
interface FileStorage {
  upload(path: string, content: Buffer): Promise<string>;
}

class S3FileStorage implements FileStorage {
  private client = new S3Client({ region: 'us-east-1' });

  async upload(path: string, content: Buffer): Promise<string> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: path,
      Body: content,
    }));
    return `s3://${this.bucket}/${path}`;
  }
}

// Now OrderService depends on YOUR interface, not AWS SDK
class OrderService {
  constructor(private storage: FileStorage) {}

  async saveReceipt(orderId: string, pdf: Buffer) {
    await this.storage.upload(`receipts/${orderId}.pdf`, pdf);
  }
}
```

### Learning Tests

When integrating a new library, write **learning tests** — tests that verify your understanding of how the library works. They serve dual purpose: learning the API and catching breaking changes on upgrades.

```typescript
describe('Lodash learning tests', () => {
  it('_.groupBy groups items by property', () => {
    const items = [
      { type: 'A', value: 1 },
      { type: 'B', value: 2 },
      { type: 'A', value: 3 },
    ];
    const grouped = _.groupBy(items, 'type');
    expect(grouped.A).toHaveLength(2);
    expect(grouped.B).toHaveLength(1);
  });
});
```

## Best Practices

1. **Wrap all third-party libraries** at the boundary.
2. **Define your own interfaces** that the business logic depends on.
3. **Write learning tests** for new external dependencies.
4. **Keep boundary code thin** — just translation, no business logic.
5. **Use the Dependency Rule** — inner layers never reference outer layers.

## Sources

- Martin, R.C. (2008). *Clean Code*. Chapter 8: Boundaries.
- Evans, E. (2003). *Domain-Driven Design*. Anti-Corruption Layer.
- Cockburn, A. (2005). *Hexagonal Architecture*. (Blog post)
