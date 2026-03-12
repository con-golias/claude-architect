# Firestore

> **Domain:** Database > NoSQL > Document Stores
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Cloud Firestore is Google's serverless document database — zero infrastructure, automatic scaling, built-in real-time synchronization, and offline-first mobile support. Unlike MongoDB which requires cluster management, Firestore is fully managed with no provisioning or capacity planning. Its real-time listeners eliminate polling, its security rules replace backend authorization for many use cases, and its offline persistence enables mobile apps to work without connectivity. Firestore is the default database for Firebase-based applications and an excellent choice for mobile-first, real-time, and serverless architectures.

---

## How It Works

### Data Model

```
Firestore Structure:
┌──────────────────────────────────────────────┐
│  Project (Firebase Project)                   │
│                                               │
│  ├── Collection: users/                       │
│  │   ├── Document: user_alice                 │
│  │   │   ├── name: "Alice"                   │
│  │   │   ├── email: "alice@example.com"      │
│  │   │   └── Subcollection: orders/          │
│  │   │       ├── Document: order_001         │
│  │   │       └── Document: order_002         │
│  │   └── Document: user_bob                  │
│  │                                            │
│  ├── Collection: products/                    │
│  │   ├── Document: prod_widget               │
│  │   └── Document: prod_gadget               │
│  └── Collection: settings/                    │
└──────────────────────────────────────────────┘

Rules:
- Collections contain only documents
- Documents contain fields + subcollections
- Documents limited to 1 MB
- Max document depth: 100 subcollections
- Path: users/alice/orders/order_001
```

### CRUD Operations

```typescript
// TypeScript — Firebase Admin SDK
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

// CREATE
await db.collection('users').doc('alice').set({
  name: 'Alice Johnson',
  email: 'alice@example.com',
  age: 32,
  roles: ['admin', 'editor'],
  address: { city: 'Springfield', state: 'IL' },
  createdAt: FieldValue.serverTimestamp(),
});

// Auto-generated ID
const docRef = await db.collection('users').add({
  name: 'Bob',
  email: 'bob@example.com',
});
console.log('Created with ID:', docRef.id);

// READ
const doc = await db.collection('users').doc('alice').get();
if (doc.exists) {
  console.log(doc.data());
}

// QUERY
const activeAdmins = await db.collection('users')
  .where('roles', 'array-contains', 'admin')
  .where('age', '>=', 18)
  .orderBy('age')
  .limit(10)
  .get();

activeAdmins.forEach(doc => console.log(doc.id, doc.data()));

// UPDATE
await db.collection('users').doc('alice').update({
  'address.city': 'Chicago',            // nested field update
  roles: FieldValue.arrayUnion('moderator'),  // add to array
  loginCount: FieldValue.increment(1),        // atomic increment
  updatedAt: FieldValue.serverTimestamp(),
});

// DELETE
await db.collection('users').doc('alice').delete();

// Delete field
await db.collection('users').doc('alice').update({
  obsoleteField: FieldValue.delete(),
});
```

---

### Real-Time Listeners

```typescript
// Listen to document changes (real-time sync)
const unsubscribe = db.collection('orders')
  .where('status', '==', 'pending')
  .onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        console.log('New order:', change.doc.data());
      }
      if (change.type === 'modified') {
        console.log('Updated order:', change.doc.data());
      }
      if (change.type === 'removed') {
        console.log('Removed order:', change.doc.id);
      }
    });
  });

// Unsubscribe when done
unsubscribe();
```

---

### Transactions & Batched Writes

```typescript
// Transaction (read-then-write, automatic retry on contention)
await db.runTransaction(async (transaction) => {
  const accountRef = db.collection('accounts').doc('alice');
  const doc = await transaction.get(accountRef);

  const currentBalance = doc.data()!.balance;
  if (currentBalance < amount) {
    throw new Error('Insufficient funds');
  }

  transaction.update(accountRef, { balance: currentBalance - amount });
  transaction.update(db.collection('accounts').doc('bob'), {
    balance: FieldValue.increment(amount),
  });
});

// Batched write (up to 500 operations, atomic)
const batch = db.batch();
const usersRef = db.collection('users');

batch.set(usersRef.doc('alice'), { name: 'Alice', status: 'active' });
batch.update(usersRef.doc('bob'), { status: 'inactive' });
batch.delete(usersRef.doc('charlie'));

await batch.commit();  // all-or-nothing
```

---

### Security Rules

```javascript
// firestore.rules — declarative security (no backend needed for simple apps)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Public read, authenticated write
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null &&
                      request.auth.token.admin == true;
    }

    // Validate data on write
    match /orders/{orderId} {
      allow create: if request.auth != null &&
                       request.resource.data.userId == request.auth.uid &&
                       request.resource.data.total > 0 &&
                       request.resource.data.items.size() > 0;
      allow read: if request.auth != null &&
                     resource.data.userId == request.auth.uid;
    }
  }
}
```

---

### Limitations & Constraints

| Constraint | Limit |
|-----------|-------|
| Document size | 1 MB |
| Field depth | 20 levels |
| Collection group query fields | Must be indexed |
| Writes per document | 1 per second sustained |
| Transaction max operations | 500 |
| Batch write max operations | 500 |
| Query inequality filters | Single field only (composite index for multi) |
| OR queries | Max 30 disjunctions |
| Offline cache | 40 MB default (configurable) |

---

### Firestore vs MongoDB

| Feature | Firestore | MongoDB |
|---------|-----------|---------|
| **Hosting** | Fully managed (Google) | Self-hosted or Atlas |
| **Scaling** | Automatic, serverless | Manual sharding |
| **Real-time** | Built-in listeners | Change Streams |
| **Offline** | Built-in (mobile SDK) | Not built-in |
| **Query language** | SDK methods | Rich query language (MQL) |
| **Aggregation** | Limited (count, sum) | Full pipeline |
| **Transactions** | Yes (max 500 ops) | Yes (no limit) |
| **Security** | Declarative rules | Application-level |
| **Pricing** | Per read/write/storage | Instance-based |
| **Best for** | Mobile, real-time, serverless | Complex queries, large scale |

---

## Best Practices

1. **ALWAYS design data for query patterns** — denormalize for the reads you need
2. **ALWAYS use subcollections** for unbounded lists — not arrays in documents
3. **ALWAYS use batched writes** for multiple operations — atomic and efficient
4. **ALWAYS use server timestamps** — FieldValue.serverTimestamp() for consistency
5. **ALWAYS create composite indexes** for queries with multiple fields
6. **ALWAYS use security rules** — never rely only on application-level checks
7. **ALWAYS use offline persistence** for mobile apps — built-in, enable it
8. **NEVER store large arrays in documents** — 1 MB document limit, use subcollections
9. **NEVER write to same document more than 1/sec** — creates contention
10. **NEVER use Firestore for complex analytics** — use BigQuery export instead

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Relational data model | Excessive reads, high cost | Denormalize for query patterns |
| Unbounded arrays | Document size limit exceeded | Use subcollections |
| Frequent writes to single document | Write contention, failures | Distributed counters or subcollections |
| No composite indexes | Query failures at runtime | Pre-create indexes |
| Client-side security only | Data accessible by modifying client code | Use Firestore Security Rules |
| Reading entire collections | High read costs, slow | Use queries with filters |
| No pagination | Memory issues, cost explosion | Use startAfter() cursor |
| Ignoring pricing model | Unexpected bills | Estimate reads/writes, use caching |

---

## Real-world Examples

### Firebase Ecosystem
- Real-time chat (messages as documents with listeners)
- User profiles with offline-first mobile sync
- IoT dashboards with live data streams
- Game leaderboards with real-time updates

### The New York Times
- Firestore for content delivery to mobile apps
- Real-time updates for breaking news
- Offline reading support for commuters

---

## Enforcement Checklist

- [ ] Data model designed for query patterns (denormalized)
- [ ] Subcollections used for unbounded lists
- [ ] Composite indexes created for multi-field queries
- [ ] Security Rules deployed and tested
- [ ] Server timestamps used for all date fields
- [ ] Batched writes used for multi-document operations
- [ ] Offline persistence enabled for mobile clients
- [ ] Write frequency per document considered (< 1/sec)
- [ ] Cost estimation performed (reads/writes/storage)
- [ ] BigQuery export configured for analytics
