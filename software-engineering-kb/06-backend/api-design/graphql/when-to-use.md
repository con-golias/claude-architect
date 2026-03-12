# When to Use GraphQL

> **Domain:** Backend > API > GraphQL
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-09

## What It Is

The decision of **when to use GraphQL** versus other API architectures (REST, gRPC) depends on:
- The type of application
- The needs of the clients
- The complexity of the data
- The team expertise
- Performance requirements

## Why It Matters

Choosing the right API architecture:
1. **Improves Developer Experience** for frontend/mobile teams
2. **Optimizes Performance** with fewer requests and bandwidth
3. **Reduces Development Time** with type safety and tooling
4. **Enables Scalability** with proper architecture patterns
5. **Affects Maintenance Costs** long-term

## How It Works

### Decision Matrix: GraphQL vs REST vs gRPC

| Criterion | GraphQL | REST | gRPC |
|----------|---------|------|------|
| **Performance** | Moderate (JSON over HTTP) | Moderate (JSON over HTTP) | Very Fast (Protobuf over HTTP/2) |
| **Data Fetching** | Client-driven, precise | Over-fetching typically | Predefined messages |
| **Type Safety** | Strong (built-in) | Weak (OpenAPI optional) | Very Strong (Protocol Buffers) |
| **Browser Support** | Excellent | Excellent | Limited (needs gRPC-web) |
| **Learning Curve** | Medium-High | Low | High |
| **Caching** | Complex (needs work) | Simple (HTTP caching) | Complex |
| **Tooling** | Excellent (Playground, etc) | Good | Good (code generation) |
| **Streaming** | Limited (subscriptions) | Limited (SSE) | Excellent (bidirectional) |
| **Mobile Apps** | Excellent | Good | Excellent |
| **Public APIs** | Good | Excellent | Poor |
| **Microservices** | Medium | Good | Excellent |

### Latency Comparison (Production AI Workloads)

```
gRPC:    25ms   (10x faster)
GraphQL: 150ms  (moderate)
REST:    250ms  (slower)
```

### When to Use GraphQL

#### ✅ Best Use Cases

##### 1. Mobile Applications

GraphQL is **ideal for mobile** because:
- **Reduces Network Requests:** One request instead of multiple
- **Minimizes Data Transfer:** Exactly the data you need (battery/bandwidth savings)
- **Works Offline:** Persistent normalized cache
- **Flexible Queries:** Different screens with different data needs

```graphql
# Mobile app can request exactly what it needs
query MobileHomeScreen {
  me {
    id
    name
    avatar
  }
  feed(first: 10) {
    edges {
      node {
        id
        title
        excerpt
        thumbnail
        author {
          name
          avatar
        }
      }
    }
  }
  notifications(unreadOnly: true) {
    count
  }
}
```

##### 2. Backend for Frontend (BFF) Pattern

GraphQL as an **aggregation layer** in front of microservices:

```
┌─────────────┐
│   Mobile    │
│     App     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  GraphQL    │  ← BFF Layer
│   Gateway   │
└──────┬──────┘
       │
       ├────────────┬─────────────┬───────────┐
       ▼            ▼             ▼           ▼
  ┌────────┐  ┌─────────┐  ┌──────────┐  ┌────────┐
  │ User   │  │ Product │  │ Payment  │  │ Order  │
  │Service │  │ Service │  │ Service  │  │Service │
  └────────┘  └─────────┘  └──────────┘  └────────┘
```

**Advantages:**
- Single customized endpoint per client (web, mobile, tablet)
- Aggregates data from multiple microservices
- Filters and transforms data for the specific channel
- Client does not need to know about microservices

```typescript
// GraphQL BFF for mobile
const resolvers = {
  Query: {
    productDetails: async (parent, { id }, context) => {
      // Aggregate from multiple microservices
      const [product, reviews, inventory, recommendations] = await Promise.all([
        context.services.product.get(id),
        context.services.review.getByProduct(id),
        context.services.inventory.check(id),
        context.services.recommendation.getRelated(id)
      ]);

      // Return aggregated data
      return {
        ...product,
        reviews,
        inStock: inventory.quantity > 0,
        recommendations
      };
    }
  }
};
```

##### 3. Complex Data Relationships

When you have **deeply nested data** or **many-to-many relationships**:

```graphql
# One request for complex nested data
query BlogPost {
  post(id: "123") {
    title
    author {
      name
      bio
      posts(first: 5) {
        title
      }
      followers {
        name
      }
    }
    comments {
      content
      author {
        name
      }
      replies {
        content
        author {
          name
        }
      }
    }
    tags {
      name
      relatedPosts {
        title
      }
    }
  }
}
```

With REST you would need **multiple requests**:
```
GET /posts/123
GET /users/456
GET /users/456/posts
GET /users/456/followers
GET /posts/123/comments
GET /comments/789/author
GET /posts/123/tags
...
```

##### 4. Rapid Product Development

GraphQL enables **faster iteration**:
- Frontend does not wait for backend for new endpoints
- Schema evolution with deprecation (no versioning)
- Strong types = fewer bugs
- Mock data from schema for development

```typescript
// Frontend can proceed with mocks
import { graphql } from 'msw';

const handlers = [
  graphql.query('GetUser', (req, res, ctx) => {
    return res(
      ctx.data({
        user: {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com'
        }
      })
    );
  })
];
```

##### 5. Real-time Features (Subscriptions)

```graphql
subscription OnMessageReceived($chatId: ID!) {
  messageReceived(chatId: $chatId) {
    id
    content
    sender {
      name
      avatar
    }
    timestamp
  }
}
```

```typescript
// Client
import { useSubscription } from '@apollo/client';

function ChatRoom({ chatId }) {
  const { data } = useSubscription(ON_MESSAGE_RECEIVED, {
    variables: { chatId }
  });

  return <Message data={data?.messageReceived} />;
}
```

#### ❌ When NOT to Use GraphQL

##### 1. Simple CRUD Operations

```
If your API is simple CRUD:
- GET /users
- GET /users/:id
- POST /users
- PUT /users/:id
- DELETE /users/:id

→ Use REST. GraphQL is overkill.
```

##### 2. File Uploads

GraphQL **is not designed** for file uploads:

**Problems:**
- Does not support binary data natively
- Multipart requests are non-standard
- Security concerns (CSRF)
- Stream handling issues
- Implementation complexity

**Best Practice: Use Signed URLs**

```graphql
# GraphQL mutation to get signed URL
type Mutation {
  getUploadUrl(filename: String!, contentType: String!): UploadUrl!
}

type UploadUrl {
  url: String!          # S3 signed URL
  fields: JSON!         # Form fields
  expiresAt: DateTime!
}
```

```typescript
// Client uploads directly to S3
async function uploadFile(file: File) {
  // 1. Get signed URL from GraphQL
  const { data } = await client.mutate({
    mutation: GET_UPLOAD_URL,
    variables: {
      filename: file.name,
      contentType: file.type
    }
  });

  // 2. Upload directly to S3 (not through GraphQL)
  const formData = new FormData();
  Object.entries(data.getUploadUrl.fields).forEach(([key, value]) => {
    formData.append(key, value as string);
  });
  formData.append('file', file);

  await fetch(data.getUploadUrl.url, {
    method: 'POST',
    body: formData
  });

  // 3. Confirm upload in GraphQL
  await client.mutate({
    mutation: CONFIRM_UPLOAD,
    variables: { filename: file.name }
  });
}
```

##### 3. High-Performance Streaming

If you need **bidirectional streaming** or **very low latency**:

**Use gRPC Instead:**
```protobuf
service ChatService {
  // Bidirectional streaming
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);

  // Server streaming
  rpc GetNotifications(UserId) returns (stream Notification);
}
```

**Performance Comparison:**
```
gRPC streaming:     ~1-5ms latency
GraphQL subscriptions: ~50-200ms latency
```

##### 4. Public APIs with Unknown Consumers

For **public APIs** that will be used by unknown third parties:

**REST is better because:**
- More familiar to developers
- HTTP caching out-of-the-box
- Easier rate limiting per endpoint
- Simpler documentation
- Better suited for API keys/throttling

```
GitHub:     REST + GraphQL (both!)
Stripe:     REST only
Twitter:    REST + GraphQL (both!)
AWS:        REST (+ gRPC for internal)
```

##### 5. Microservices Internal Communication

For **service-to-service** communication:

**gRPC is better:**
- 10x faster than GraphQL/REST
- Strong type safety with Protocol Buffers
- Built-in streaming
- Code generation for all languages
- Smaller payload size

```
Internal Microservices:   gRPC
BFF/Gateway Layer:         GraphQL
Public API:                REST
```

### Migration Strategies from REST

#### Strategy 1: Incremental Adoption (Recommended)

```typescript
// Step 1: Wrap existing REST endpoints
const resolvers = {
  Query: {
    users: async () => {
      // Call existing REST API
      const response = await fetch('https://api.example.com/users');
      return response.json();
    },

    user: async (parent, { id }) => {
      const response = await fetch(`https://api.example.com/users/${id}`);
      return response.json();
    }
  }
};

// Step 2: Gradually replace with native implementations
const resolvers = {
  Query: {
    users: async (parent, args, { db }) => {
      return db.user.findMany(); // Native implementation
    },

    // This still uses REST
    products: async () => {
      const response = await fetch('https://api.example.com/products');
      return response.json();
    }
  }
};
```

**Timeline:**
1. **Week 1-2:** Setup GraphQL server, wrap 1-2 endpoints
2. **Month 1:** Migrate core queries
3. **Month 2-3:** Migrate mutations
4. **Month 4+:** Deprecate old REST endpoints

#### Strategy 2: Parallel APIs

```
┌──────────────┐
│   Clients    │
└──────┬───────┘
       │
       ├─────────────┬─────────────┐
       ▼             ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│   REST   │  │ GraphQL  │  │ Legacy   │
│   API    │  │   API    │  │   API    │
└──────────┘  └──────────┘  └──────────┘
       │             │             │
       └─────────────┴─────────────┘
                     ▼
            ┌─────────────────┐
            │  Business Logic │
            └─────────────────┘
```

**Best Practices:**
- Don't build **new REST endpoints** (build in GraphQL)
- Use **feature flags** for gradual rollout
- Maintain **dual compatibility** initially
- Monitor **metrics** for both APIs

#### Strategy 3: BFF Pattern

```
┌────────┐        ┌────────┐
│  Web   │        │ Mobile │
└───┬────┘        └───┬────┘
    │                 │
    ▼                 ▼
┌────────┐        ┌──────────┐
│  REST  │        │ GraphQL  │  ← BFF Layer
│  BFF   │        │   BFF    │
└───┬────┘        └────┬─────┘
    │                  │
    └──────────┬───────┘
               ▼
         ┌──────────┐
         │   REST   │  ← Legacy Backend
         │  Backend │
         └──────────┘
```

## Best Practices

### 1. Start Small, Iterate

```typescript
// ✅ GOOD: Start with a few queries
type Query {
  me: User
  posts(first: Int): [Post!]!
}

// ❌ BAD: Trying to model everything immediately
type Query {
  users: [User!]!
  posts: [Post!]!
  comments: [Comment!]!
  tags: [Tag!]!
  categories: [Category!]!
  // ... 50 more types
}
```

### 2. Monitor Performance

```typescript
import { ApolloServerPlugin } from '@apollo/server';

const performanceMonitoringPlugin: ApolloServerPlugin = {
  async requestDidStart() {
    const start = Date.now();

    return {
      async willSendResponse({ metrics, operationName }) {
        const duration = Date.now() - start;

        console.log({
          operation: operationName,
          duration,
          queryCount: metrics?.queryCount
        });

        // Alert on slow queries
        if (duration > 1000) {
          console.warn(`Slow query detected: ${operationName} (${duration}ms)`);
        }
      }
    };
  }
};
```

### 3. Implement Proper Security

```typescript
import { createComplexityLimitRule } from 'graphql-validation-complexity';
import depthLimit from 'graphql-depth-limit';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    depthLimit(10),                    // Max query depth
    createComplexityLimitRule(1000)    // Max query complexity
  ],
  plugins: [
    // Rate limiting plugin
    rateLimitPlugin({
      max: 100,
      window: '15m'
    })
  ]
});
```

### 4. Use Persisted Queries for Production

```typescript
// Client sends hash instead of full query
const PERSISTED_QUERIES = {
  'abc123': 'query GetUser($id: ID!) { user(id: $id) { name email } }'
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  persistedQueries: {
    cache: new Map(Object.entries(PERSISTED_QUERIES))
  }
});

// Client
const client = new ApolloClient({
  link: createPersistedQueryLink().concat(httpLink),
  cache: new InMemoryCache()
});
```

### 5. Design Schema Around Client Needs

```graphql
# ❌ BAD: Database-driven schema
type User {
  id: ID!
  user_name: String!
  email_addr: String!
  created_at: String!
}

# ✅ GOOD: Client-driven schema
type User {
  id: ID!
  displayName: String!
  email: String!
  profile: UserProfile!
  activity: UserActivity!
}

type UserProfile {
  bio: String
  avatar: String
  website: String
}

type UserActivity {
  postCount: Int!
  lastActive: DateTime!
  joinedAt: DateTime!
}
```

## Anti-patterns / Common Mistakes

### ❌ 1. Using GraphQL for Everything

```typescript
// BAD: GraphQL for file upload
mutation UploadFile($file: Upload!) {
  uploadFile(file: $file) {
    url
  }
}

// GOOD: Signed URL pattern
mutation GetUploadUrl($filename: String!) {
  getUploadUrl(filename: $filename) {
    url
    expiresAt
  }
}
```

### ❌ 2. Not Considering Team Experience

```
If the team:
- Does not know GraphQL
- Does not have time to learn
- Has a working REST API
- Does not have complex data needs

→ Don't migrate to GraphQL just because it's trendy!
```

### ❌ 3. Ignoring Caching Implications

```typescript
// REST: HTTP caching works automatically
GET /api/users/123
Cache-Control: max-age=3600

// GraphQL: Needs extra work
{
  user(id: "123") {
    name  # How to cache this?
  }
}

// Solution: Use cache IDs
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        user: {
          read(existing, { args, toReference }) {
            return existing || toReference({
              __typename: 'User',
              id: args.id
            });
          }
        }
      }
    }
  }
});
```

### ❌ 4. Over-Engineering Simple APIs

```
If your API is:
GET /health → { status: "ok" }
GET /version → { version: "1.0.0" }

→ Don't use GraphQL! Use REST.
```

## Real-world Examples

### Example 1: E-commerce Product Page (GraphQL Advantage)

```graphql
# Single request for all the product page data
query ProductPage($id: ID!) {
  product(id: $id) {
    id
    name
    description
    price
    images {
      url
      alt
    }
    inventory {
      inStock
      quantity
    }
    seller {
      name
      rating
      totalSales
    }
    reviews(first: 10) {
      edges {
        node {
          rating
          comment
          author {
            name
            avatar
          }
        }
      }
      pageInfo {
        hasNextPage
      }
    }
    recommendations {
      id
      name
      price
      image
    }
    relatedCategories {
      name
      slug
    }
  }
}
```

**With REST you would need:**
```
GET /products/123
GET /products/123/inventory
GET /sellers/456
GET /products/123/reviews
GET /products/123/recommendations
GET /categories?product=123
```

### Example 2: When REST is Better (Simple API)

```typescript
// Simple CRUD API - REST is better
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/users', (req, res) => {
  res.json(users);
});

app.get('/api/users/:id', (req, res) => {
  res.json(users.find(u => u.id === req.params.id));
});

app.post('/api/users', (req, res) => {
  const user = createUser(req.body);
  res.json(user);
});

// GraphQL would be overkill here!
```

### Example 3: Hybrid Approach (Best of Both)

```typescript
// Public API: REST
app.get('/api/v1/users', async (req, res) => {
  const users = await db.user.findMany();
  res.json(users);
});

// Internal/Mobile: GraphQL
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production'
});

app.use('/graphql', expressMiddleware(server));

// File uploads: Direct S3
app.post('/api/upload', upload.single('file'), async (req, res) => {
  const result = await s3.upload({
    Bucket: 'my-bucket',
    Key: req.file.originalname,
    Body: req.file.buffer
  }).promise();

  res.json({ url: result.Location });
});
```

## Sources

- [GraphQL vs REST vs gRPC - Kong](https://konghq.com/blog/engineering/rest-vs-grpc-vs-graphql)
- [When to Use REST vs GraphQL - Baeldung](https://www.baeldung.com/rest-vs-graphql-vs-grpc)
- [GraphQL Best Use Cases](https://www.capitalone.com/tech/software-engineering/graphql-is-your-new-backend-for-frontend/)
- [GraphQL as BFF Pattern](https://hygraph.com/blog/graphql-backend-for-frontend)
- [Migration Strategies - GitHub](https://docs.github.com/en/graphql/guides/migrating-from-rest-to-graphql)
- [When NOT to Use GraphQL](https://blog.logrocket.com/graphql-vs-rest-api-why-you-shouldnt-use-graphql/)
- [File Upload Best Practices - Apollo](https://www.apollographql.com/blog/file-upload-best-practices)
- [GraphQL Adoption Patterns - Apollo](https://www.apollographql.com/docs/graphos/resources/guides/graphql-adoption-patterns)
- [REST to GraphQL Migration - This Dot Labs](https://www.thisdot.co/blog/migrating-from-rest-to-graphql)
