# N+1 Problem

> **Domain:** Backend > API > GraphQL
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-09

## What It Is

The **N+1 problem** is a performance issue that occurs when **multiple types of data** are requested in a query, but **N requests** are required instead of one:

- **1 query** to fetch the initial dataset (e.g. N posts)
- **N queries** to fetch related data for each item (e.g. author for each post)
- **Total: 1 + N queries** = Very slow!

In GraphQL, the N+1 problem is **particularly common** because each field resolver runs independently without automatic batching.

## Why It Matters

### Performance Impact

1. **Database Overload:** Hundreds or thousands of queries for a single GraphQL request
2. **Latency:** Each database roundtrip adds latency (e.g. 50 posts x 10ms = 500ms extra!)
3. **Scalability Issues:** As N grows, the system becomes unmanageable
4. **Resource Exhaustion:** Database connections, memory, CPU usage skyrocket

### Impact Example

```
10 posts with N+1:        10ms + (10 × 5ms) = 60ms
100 posts with N+1:       10ms + (100 × 5ms) = 510ms
1000 posts with N+1:      10ms + (1000 × 5ms) = 5010ms (5 seconds!)

With DataLoader:          10ms + 5ms = 15ms (constant!)
```

## How It Works

### How the N+1 Problem Occurs

```typescript
// Schema
const typeDefs = `
  type Query {
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    author: User!
  }

  type User {
    id: ID!
    name: String!
  }
`;

// ❌ PROBLEMATIC RESOLVERS (N+1 Problem)
const resolvers = {
  Query: {
    posts: async () => {
      console.log('Query 1: Fetching all posts');
      return await db.post.findMany(); // 1 query
    }
  },

  Post: {
    author: async (post) => {
      // This runs ONCE FOR EACH POST!
      console.log(`Query N: Fetching author ${post.authorId}`);
      return await db.user.findUnique({
        where: { id: post.authorId }
      }); // N queries (one for each post!)
    }
  }
};
```

**GraphQL Query:**
```graphql
query {
  posts {
    id
    title
    author {
      name
    }
  }
}
```

**Database Queries (with 10 posts):**
```sql
-- Query 1: Get all posts
SELECT * FROM posts;

-- Query 2: Get author for post 1
SELECT * FROM users WHERE id = '1';

-- Query 3: Get author for post 2
SELECT * FROM users WHERE id = '2';

-- Query 4: Get author for post 3
SELECT * FROM users WHERE id = '3';

-- ... 7 more queries

-- TOTAL: 11 queries (1 + 10)
```

### Why It Happens in GraphQL

1. **Independent Resolver Execution:** Each field resolver runs independently
2. **No Built-in Coordination:** There is no automatic batching
3. **Resolver Chaining:** Resolvers are called hierarchically (Query.posts → Post.author)
4. **Per-Item Execution:** The Post.author resolver runs for **each** post separately

### Visualizing N+1 Problem

```
GraphQL Query Request
        ↓
  Query.posts() → [post1, post2, post3, ..., postN]
        ↓
  For Each Post:
    ├─ Post.author(post1) → db.user.findUnique({ id: post1.authorId })
    ├─ Post.author(post2) → db.user.findUnique({ id: post2.authorId })
    ├─ Post.author(post3) → db.user.findUnique({ id: post3.authorId })
    └─ ... N times

Result: 1 + N database queries
```

## Solutions

### Solution 1: DataLoader Pattern (Best Practice)

**DataLoader** is the official solution from Facebook that provides:
- **Batching:** Collects all requests and executes them in one batch
- **Caching:** Caches results for the duration of the request

```typescript
import DataLoader from 'dataloader';

// Create DataLoader
const userLoader = new DataLoader<string, User>(
  async (userIds: readonly string[]) => {
    console.log('Batch loading users:', userIds);

    // Single query for all IDs
    const users = await db.user.findMany({
      where: { id: { in: [...userIds] } }
    });

    // IMPORTANT: Return in the same order as requested IDs
    return userIds.map(id =>
      users.find(user => user.id === id) || null
    );
  }
);

// Context setup
const context = {
  loaders: {
    user: userLoader
  }
};

// ✅ FIXED RESOLVERS (No N+1)
const resolvers = {
  Query: {
    posts: async () => {
      return await db.post.findMany(); // 1 query
    }
  },

  Post: {
    author: async (post, args, context) => {
      // DataLoader batches all .load() calls
      return await context.loaders.user.load(post.authorId); // Batched!
    }
  }
};
```

**Result with DataLoader:**
```sql
-- Query 1: Get all posts
SELECT * FROM posts;

-- Query 2: Batch get all authors (only 1 query!)
SELECT * FROM users WHERE id IN ('1', '2', '3', '4', '5', ...);

-- TOTAL: 2 queries (instead of 1 + N)
```

### Solution 2: Query Complexity Analysis

Limit the complexity of queries to prevent abuse:

```typescript
import { createComplexityLimitRule } from 'graphql-validation-complexity';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    createComplexityLimitRule(1000, {
      scalarCost: 1,
      objectCost: 2,
      listFactor: 10
    })
  ]
});

// Example cost calculation:
// query {
//   posts {              # Cost: 10 (list factor)
//     id                 # Cost: 1 (scalar)
//     title              # Cost: 1 (scalar)
//     author {           # Cost: 2 (object)
//       name             # Cost: 1 (scalar)
//     }
//   }
// }
// Total: 10 * (1 + 1 + 2 + 1) = 50
```

### Solution 3: Depth Limiting

Limit the depth of nested queries:

```typescript
import depthLimit from 'graphql-depth-limit';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    depthLimit(10) // Max depth: 10 levels
  ]
});

// ❌ This query will be REJECTED (depth > 10)
// query {
//   user {
//     posts {
//       author {
//         posts {
//           author {
//             posts {
//               author {
//                 posts {
//                   author {
//                     posts {
//                       author {
//                         posts { ... }  # Depth 11!
//                       }
//                     }
//                   }
//                 }
//               }
//             }
//           }
//         }
//       }
//     }
//   }
// }
```

### Solution 4: Lookahead / Info Analysis

Fetch related data proactively when you know it will be needed:

```typescript
import { GraphQLResolveInfo } from 'graphql';

function hasField(info: GraphQLResolveInfo, fieldName: string): boolean {
  return info.fieldNodes.some(node =>
    node.selectionSet?.selections.some(
      selection => 'name' in selection && selection.name.value === fieldName
    )
  );
}

const resolvers = {
  Query: {
    posts: async (parent, args, context, info: GraphQLResolveInfo) => {
      // Check if the client is requesting the author field
      const includeAuthor = hasField(info, 'author');

      if (includeAuthor) {
        // Eager load authors with join
        return await db.post.findMany({
          include: { author: true }
        });
      }

      // Otherwise fetch only posts
      return await db.post.findMany();
    }
  },

  Post: {
    author: (post) => {
      // If already loaded, return it
      if (post.author) {
        return post.author;
      }

      // Otherwise use DataLoader
      return context.loaders.user.load(post.authorId);
    }
  }
};
```

## Best Practices

### 1. Always Use DataLoaders for Relations

```typescript
// ✅ GOOD: DataLoader factory function
function createLoaders(db: PrismaClient) {
  return {
    user: new DataLoader<string, User | null>(async (ids) => {
      const users = await db.user.findMany({
        where: { id: { in: [...ids] } }
      });
      return ids.map(id => users.find(u => u.id === id) || null);
    }),

    postsByAuthor: new DataLoader<string, Post[]>(async (authorIds) => {
      const posts = await db.post.findMany({
        where: { authorId: { in: [...authorIds] } }
      });

      return authorIds.map(authorId =>
        posts.filter(post => post.authorId === authorId)
      );
    }),

    commentsByPost: new DataLoader<string, Comment[]>(async (postIds) => {
      const comments = await db.comment.findMany({
        where: { postId: { in: [...postIds] } }
      });

      return postIds.map(postId =>
        comments.filter(comment => comment.postId === postId)
      );
    })
  };
}

// Context
const context = {
  db,
  loaders: createLoaders(db)
};
```

### 2. Monitor Query Performance

```typescript
import { ApolloServerPlugin } from '@apollo/server';

const performancePlugin: ApolloServerPlugin = {
  async requestDidStart() {
    const start = Date.now();
    let queryCount = 0;

    // Intercept database queries
    const originalQuery = db.$queryRaw;
    db.$queryRaw = function (...args: any[]) {
      queryCount++;
      console.log(`Query ${queryCount}:`, args[0]);
      return originalQuery.apply(this, args);
    };

    return {
      async willSendResponse() {
        const duration = Date.now() - start;
        console.log(`Request completed in ${duration}ms with ${queryCount} queries`);

        if (queryCount > 10) {
          console.warn(`⚠️  N+1 detected! ${queryCount} queries in one request`);
        }
      }
    };
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [performancePlugin]
});
```

### 3. Implement Request-Scoped DataLoaders

```typescript
// ✅ GOOD: New loaders per request
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    return {
      user: await getUser(req),
      db,
      loaders: createLoaders(db) // Fresh loaders for each request
    };
  }
});

// ❌ BAD: Shared loaders (stale cache!)
const sharedLoaders = createLoaders(db);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    return {
      user: await getUser(req),
      db,
      loaders: sharedLoaders // WRONG! Cache will be stale
    };
  }
});
```

### 4. Configure DataLoader Options

```typescript
const userLoader = new DataLoader<string, User>(
  batchLoadFn,
  {
    // Enable caching (default: true)
    cache: true,

    // Custom cache implementation
    cacheMap: new Map(),

    // Batch schedule function (default: immediate)
    batchScheduleFn: (callback) => setTimeout(callback, 10),

    // Maximum batch size (default: Infinity)
    maxBatchSize: 100,

    // Custom cache key function
    cacheKeyFn: (key) => `user:${key}`
  }
);
```

### 5. Priming DataLoader Cache

```typescript
const resolvers = {
  Mutation: {
    createUser: async (parent, { input }, context) => {
      const user = await db.user.create({ data: input });

      // Prime cache so subsequent loads don't hit the database
      context.loaders.user.prime(user.id, user);

      return user;
    }
  }
};
```

## Anti-patterns / Common Mistakes

### ❌ 1. Not Using DataLoader

```typescript
// BAD: Direct database calls in the resolver
const resolvers = {
  Post: {
    author: (post) => db.user.findUnique({ where: { id: post.authorId } })
  }
};

// GOOD: Use DataLoader
const resolvers = {
  Post: {
    author: (post, args, context) => context.loaders.user.load(post.authorId)
  }
};
```

### ❌ 2. Returning in the Wrong Order

```typescript
// BAD: Order doesn't match requested IDs
const userLoader = new DataLoader(async (ids) => {
  const users = await db.user.findMany({
    where: { id: { in: [...ids] } },
    orderBy: { name: 'asc' } // ❌ Wrong order!
  });

  return users; // ❌ Order mismatch!
});

// GOOD: Return in the same order as requested IDs
const userLoader = new DataLoader(async (ids) => {
  const users = await db.user.findMany({
    where: { id: { in: [...ids] } }
  });

  // Map to correct order
  return ids.map(id => users.find(u => u.id === id) || null);
});
```

### ❌ 3. Sharing DataLoaders Across Requests

```typescript
// BAD: Global loaders (stale cache)
const globalLoaders = createLoaders(db);

app.use('/graphql', async (req, res) => {
  const result = await execute({
    schema,
    contextValue: {
      loaders: globalLoaders // ❌ Shared cache!
    }
  });
});

// GOOD: Fresh loaders per request
app.use('/graphql', async (req, res) => {
  const result = await execute({
    schema,
    contextValue: {
      loaders: createLoaders(db) // ✅ New loaders
    }
  });
});
```

### ❌ 4. Not Handling Errors in BatchLoadFn

```typescript
// BAD: No error handling
const userLoader = new DataLoader(async (ids) => {
  const users = await db.user.findMany({
    where: { id: { in: [...ids] } }
  });
  return ids.map(id => users.find(u => u.id === id));
});

// GOOD: Handle errors properly
const userLoader = new DataLoader(async (ids) => {
  try {
    const users = await db.user.findMany({
      where: { id: { in: [...ids] } }
    });

    return ids.map(id => {
      const user = users.find(u => u.id === id);
      if (!user) {
        return new Error(`User ${id} not found`);
      }
      return user;
    });
  } catch (error) {
    // Return error for each ID
    return ids.map(() => error);
  }
});
```

## Real-world Examples

### Complete Example with Multiple DataLoaders

```typescript
import DataLoader from 'dataloader';
import { PrismaClient } from '@prisma/client';

// Types
interface User {
  id: string;
  name: string;
  email: string;
}

interface Post {
  id: string;
  title: string;
  authorId: string;
}

interface Comment {
  id: string;
  content: string;
  postId: string;
  authorId: string;
}

// DataLoader Factory
function createLoaders(db: PrismaClient) {
  return {
    // User by ID
    user: new DataLoader<string, User | null>(async (ids) => {
      const users = await db.user.findMany({
        where: { id: { in: [...ids] } }
      });
      return ids.map(id => users.find(u => u.id === id) || null);
    }),

    // Posts by author ID
    postsByAuthor: new DataLoader<string, Post[]>(async (authorIds) => {
      const posts = await db.post.findMany({
        where: { authorId: { in: [...authorIds] } },
        orderBy: { createdAt: 'desc' }
      });

      return authorIds.map(authorId =>
        posts.filter(post => post.authorId === authorId)
      );
    }),

    // Comments by post ID
    commentsByPost: new DataLoader<string, Comment[]>(async (postIds) => {
      const comments = await db.comment.findMany({
        where: { postId: { in: [...postIds] } },
        orderBy: { createdAt: 'asc' }
      });

      return postIds.map(postId =>
        comments.filter(comment => comment.postId === postId)
      );
    }),

    // Comment count by post ID
    commentCountByPost: new DataLoader<string, number>(async (postIds) => {
      const counts = await db.comment.groupBy({
        by: ['postId'],
        where: { postId: { in: [...postIds] } },
        _count: { id: true }
      });

      return postIds.map(postId => {
        const count = counts.find(c => c.postId === postId);
        return count?._count.id || 0;
      });
    }),

    // Multiple users by IDs (for followers)
    usersByIds: new DataLoader<string[], User[]>(async (idArrays) => {
      const allIds = [...new Set(idArrays.flat())];
      const users = await db.user.findMany({
        where: { id: { in: allIds } }
      });

      return idArrays.map(ids =>
        ids.map(id => users.find(u => u.id === id)).filter(Boolean) as User[]
      );
    })
  };
}

// Resolvers
const resolvers = {
  Query: {
    posts: async (parent, args, context) => {
      return await context.db.post.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' }
      });
    },

    user: async (parent, { id }, context) => {
      return await context.loaders.user.load(id);
    }
  },

  Post: {
    // ✅ No N+1: Batched
    author: async (post, args, context) => {
      return await context.loaders.user.load(post.authorId);
    },

    // ✅ No N+1: Batched
    comments: async (post, args, context) => {
      return await context.loaders.commentsByPost.load(post.id);
    },

    // ✅ No N+1: Batched
    commentCount: async (post, args, context) => {
      return await context.loaders.commentCountByPost.load(post.id);
    }
  },

  Comment: {
    // ✅ No N+1: Batched
    author: async (comment, args, context) => {
      return await context.loaders.user.load(comment.authorId);
    }
  },

  User: {
    // ✅ No N+1: Batched
    posts: async (user, args, context) => {
      return await context.loaders.postsByAuthor.load(user.id);
    },

    // ✅ No N+1: Batched
    followers: async (user, args, context) => {
      const followerIds = await context.db.follow.findMany({
        where: { followingId: user.id },
        select: { followerId: true }
      });

      return await context.loaders.usersByIds.load(
        followerIds.map(f => f.followerId)
      );
    }
  }
};

// Server Setup
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

const db = new PrismaClient();

const server = new ApolloServer({
  typeDefs,
  resolvers
});

const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => {
    return {
      user: await getUser(req),
      db,
      loaders: createLoaders(db) // Fresh loaders per request
    };
  }
});

console.log(`🚀 Server ready at ${url}`);
```

### Performance Monitoring Example

```typescript
import { ApolloServerPlugin } from '@apollo/server';

interface QueryMetrics {
  operationName: string;
  duration: number;
  queryCount: number;
  cacheHits: number;
  cacheMisses: number;
}

const metricsPlugin: ApolloServerPlugin = {
  async requestDidStart() {
    const start = Date.now();
    const metrics: QueryMetrics = {
      operationName: '',
      duration: 0,
      queryCount: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    return {
      async didResolveOperation({ operation }) {
        metrics.operationName = operation.name?.value || 'anonymous';
      },

      async willSendResponse({ contextValue }) {
        metrics.duration = Date.now() - start;

        // Get DataLoader stats
        Object.entries(contextValue.loaders).forEach(([name, loader]) => {
          const stats = (loader as any).stats?.();
          if (stats) {
            metrics.cacheHits += stats.cacheHits || 0;
            metrics.cacheMisses += stats.cacheMisses || 0;
          }
        });

        console.log('GraphQL Metrics:', metrics);

        // Alert on N+1
        if (metrics.queryCount > 20) {
          console.error(`⚠️  Possible N+1 problem detected!`);
          console.error(`Operation: ${metrics.operationName}`);
          console.error(`Queries: ${metrics.queryCount}`);
          console.error(`Duration: ${metrics.duration}ms`);
        }
      }
    };
  }
};
```

## Sources

- [DataLoader GitHub](https://github.com/graphql/dataloader)
- [Solving the N+1 Problem - GraphQL](https://www.graphql-js.org/docs/n1-dataloader/)
- [Handling the N+1 Problem - Apollo](https://www.apollographql.com/docs/graphos/schema-design/guides/handling-n-plus-one)
- [Understanding the N+1 Problem in GraphQL](https://hygraph.com/blog/graphql-n-1-problem)
- [GraphQL Query Complexity](https://github.com/slicknode/graphql-query-complexity)
- [Depth Limiting](https://github.com/stems/graphql-depth-limit)
- [Shopify: Solving N+1 Through Batching](https://shopify.engineering/solving-the-n-1-problem-for-graphql-through-batching)
- [Visualizing the N+1 Problem](https://dineshpandiyan.com/blog/graphql-n+1/)
