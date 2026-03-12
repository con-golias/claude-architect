# Resolvers

> **Domain:** Backend > API > GraphQL
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-09

## What It Is

**Resolvers** are the functions responsible for **fetching data** for each field in the GraphQL schema. Each field can have its own resolver that determines how the data will be retrieved.

Resolvers are the **"how"** while the schema is the **"what"** - the schema defines what data is available, resolvers determine how to fetch it.

## Why It Matters

1. **Separation of Concerns:** They separate data fetching logic from schema definition
2. **Flexibility:** They can fetch data from any source (database, REST API, microservices)
3. **Composability:** Nested resolvers enable complex data relationships
4. **Performance Control:** Optimization strategies like batching and caching
5. **Business Logic Layer:** Centralized authentication, authorization, validation

## How It Works

### Resolver Function Signature

Each resolver function accepts **4 arguments** (parent, args, context, info):

```typescript
type ResolverFunction = (
  parent: any,
  args: { [key: string]: any },
  context: ContextValue,
  info: GraphQLResolveInfo
) => any;
```

#### 1. Parent (Root/Object)

The result from the **parent resolver**. For top-level Query fields, it is usually undefined.

```typescript
const resolvers = {
  Query: {
    // parent is undefined for root Query
    user: (parent, { id }, context) => {
      return context.db.user.findUnique({ where: { id } });
    }
  },

  User: {
    // parent is the User object from the Query.user resolver
    posts: (parent, args, context) => {
      console.log(parent); // { id: '123', name: 'John', email: 'john@example.com' }

      return context.db.post.findMany({
        where: { authorId: parent.id }  // Using parent.id
      });
    }
  }
};
```

#### 2. Args (Arguments)

The **arguments** passed by the client to the field:

```graphql
query {
  user(id: "123") {
    posts(first: 10, status: PUBLISHED) {
      title
    }
  }
}
```

```typescript
const resolvers = {
  Query: {
    user: (parent, args, context) => {
      console.log(args); // { id: "123" }
      return context.db.user.findUnique({ where: { id: args.id } });
    }
  },

  User: {
    posts: (parent, args, context) => {
      console.log(args); // { first: 10, status: "PUBLISHED" }

      return context.db.post.findMany({
        where: {
          authorId: parent.id,
          status: args.status
        },
        take: args.first
      });
    }
  }
};
```

#### 3. Context (ContextValue)

A **shared object** among all resolvers for the request. Typically contains:
- Authentication/authorization data (current user)
- Database connections
- DataLoaders
- Custom services/utilities

```typescript
import { PrismaClient } from '@prisma/client';
import DataLoader from 'dataloader';

interface Context {
  user: User | null;
  db: PrismaClient;
  loaders: {
    user: DataLoader<string, User>;
    post: DataLoader<string, Post>;
  };
  req: Request;
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }): Promise<Context> => {
    // Extract token from header
    const token = req.headers.authorization?.replace('Bearer ', '');

    // Verify and get user
    const user = token ? await verifyToken(token) : null;

    // Create database connection
    const db = new PrismaClient();

    // Create DataLoaders
    const loaders = {
      user: new DataLoader(async (ids: string[]) => {
        const users = await db.user.findMany({
          where: { id: { in: [...ids] } }
        });
        return ids.map(id => users.find(u => u.id === id));
      }),
      post: new DataLoader(async (ids: string[]) => {
        const posts = await db.post.findMany({
          where: { id: { in: [...ids] } }
        });
        return ids.map(id => posts.find(p => p.id === id));
      })
    };

    return { user, db, loaders, req };
  }
});

// Using context in resolvers
const resolvers = {
  Query: {
    me: (parent, args, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated');
      }
      return context.user;
    }
  },

  Post: {
    author: (parent, args, context: Context) => {
      // Use DataLoader from context
      return context.loaders.user.load(parent.authorId);
    }
  }
};
```

#### 4. Info (GraphQLResolveInfo)

Contains **metadata** about the query:
- Field name
- Path to the field from the root
- Parent type
- Return type
- Selection set (which fields were requested)

```typescript
import { GraphQLResolveInfo } from 'graphql';

const resolvers = {
  Query: {
    user: (parent, args, context, info: GraphQLResolveInfo) => {
      console.log(info.fieldName);        // "user"
      console.log(info.path);             // { key: 'user', prev: undefined }
      console.log(info.returnType);       // "User"
      console.log(info.parentType);       // "Query"

      // Inspect requested fields
      const requestedFields = info.fieldNodes[0].selectionSet?.selections;
      console.log(requestedFields);

      // Conditional fetching based on requested fields
      const includeRelations = hasField(info, 'posts') || hasField(info, 'comments');

      return context.db.user.findUnique({
        where: { id: args.id },
        include: includeRelations ? { posts: true, comments: true } : undefined
      });
    }
  }
};

function hasField(info: GraphQLResolveInfo, fieldName: string): boolean {
  return info.fieldNodes.some(node =>
    node.selectionSet?.selections.some(
      selection => 'name' in selection && selection.name.value === fieldName
    )
  );
}
```

### DataLoader Pattern for Batching

**DataLoader** solves the N+1 problem with **batching** and **caching**:

```typescript
import DataLoader from 'dataloader';

// Create DataLoader
const userLoader = new DataLoader<string, User>(
  async (userIds: readonly string[]) => {
    console.log('Batch fetching users:', userIds);

    // Single database query for all IDs
    const users = await db.user.findMany({
      where: { id: { in: [...userIds] } }
    });

    // IMPORTANT: Return in the same order as the requested IDs
    return userIds.map(id => users.find(u => u.id === id) || null);
  },
  {
    // Options
    cache: true,           // Cache results (default: true)
    batchScheduleFn: (callback) => setTimeout(callback, 10), // Batch window
    maxBatchSize: 100      // Max items per batch
  }
);

// Usage in resolvers
const resolvers = {
  Query: {
    posts: (parent, args, context) => {
      return context.db.post.findMany();
    }
  },

  Post: {
    author: (parent, args, context) => {
      // Instead of: return db.user.findUnique({ where: { id: parent.authorId } })
      // We use DataLoader:
      return context.loaders.user.load(parent.authorId);
    }
  }
};

// Result:
// Instead of N queries (one per post):
// SELECT * FROM users WHERE id = '1';
// SELECT * FROM users WHERE id = '2';
// SELECT * FROM users WHERE id = '3';
// ...

// It becomes 1 batched query:
// SELECT * FROM users WHERE id IN ('1', '2', '3', ...);
```

**DataLoader Methods:**

```typescript
// Load single item
const user = await userLoader.load('123');

// Load multiple items
const users = await userLoader.loadMany(['123', '456', '789']);

// Clear cache for specific key
userLoader.clear('123');

// Clear all cache
userLoader.clearAll();

// Prime cache (add without fetching)
userLoader.prime('123', { id: '123', name: 'John' });
```

### Authentication/Authorization in Resolvers

#### Pattern 1: Context-Based Authentication

```typescript
interface Context {
  user: User | null;
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }): Promise<Context> => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await authenticateUser(token);
    return { user };
  }
});

const resolvers = {
  Query: {
    me: (parent, args, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      return context.user;
    },

    adminData: (parent, args, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      if (context.user.role !== 'ADMIN') {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return getAdminData();
    }
  }
};
```

#### Pattern 2: Directive-Based Authorization

```typescript
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

// Schema with directive
const typeDefs = `
  directive @auth(requires: Role = USER) on FIELD_DEFINITION

  enum Role {
    ADMIN
    USER
    GUEST
  }

  type Query {
    publicData: String
    userData: String @auth(requires: USER)
    adminData: String @auth(requires: ADMIN)
  }
`;

// Directive implementation
function authDirective(schema: GraphQLSchema, directiveName: string) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(schema, fieldConfig, directiveName)?.[0];

      if (authDirective) {
        const { requires } = authDirective;
        const { resolve = defaultFieldResolver } = fieldConfig;

        fieldConfig.resolve = async function (source, args, context, info) {
          if (!context.user) {
            throw new GraphQLError('Not authenticated');
          }

          if (requires === 'ADMIN' && context.user.role !== 'ADMIN') {
            throw new GraphQLError('Not authorized');
          }

          return resolve(source, args, context, info);
        };
      }

      return fieldConfig;
    }
  });
}
```

#### Pattern 3: Middleware/Guard Pattern

```typescript
// Authentication guard
function requireAuth(next: Function) {
  return (parent: any, args: any, context: Context, info: any) => {
    if (!context.user) {
      throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
    }
    return next(parent, args, context, info);
  };
}

// Authorization guard
function requireRole(role: string) {
  return function (next: Function) {
    return (parent: any, args: any, context: Context, info: any) => {
      if (!context.user || context.user.role !== role) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }
      return next(parent, args, context, info);
    };
  };
}

// Apply guards
const resolvers = {
  Query: {
    me: requireAuth((parent, args, context) => {
      return context.user;
    }),

    adminData: requireAuth(
      requireRole('ADMIN')((parent, args, context) => {
        return getAdminData();
      })
    )
  }
};
```

### Error Handling in Resolvers

#### Pattern 1: GraphQLError with Extensions

```typescript
import { GraphQLError } from 'graphql';

const resolvers = {
  Query: {
    user: async (parent, { id }, context) => {
      try {
        const user = await context.db.user.findUnique({ where: { id } });

        if (!user) {
          throw new GraphQLError('User not found', {
            extensions: {
              code: 'USER_NOT_FOUND',
              userId: id,
              http: { status: 404 }
            }
          });
        }

        return user;
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        // Log internal errors
        console.error('Database error:', error);

        throw new GraphQLError('Failed to fetch user', {
          extensions: {
            code: 'INTERNAL_SERVER_ERROR',
            http: { status: 500 }
          }
        });
      }
    }
  }
};
```

#### Pattern 2: Union Types for Explicit Errors

```graphql
type User {
  id: ID!
  username: String!
}

type UserNotFoundError {
  message: String!
  userId: ID!
}

type UnauthorizedError {
  message: String!
}

union UserResult = User | UserNotFoundError | UnauthorizedError

type Query {
  user(id: ID!): UserResult!
}
```

```typescript
const resolvers = {
  Query: {
    user: async (parent, { id }, context) => {
      if (!context.user) {
        return {
          __typename: 'UnauthorizedError',
          message: 'Not authenticated'
        };
      }

      const user = await context.db.user.findUnique({ where: { id } });

      if (!user) {
        return {
          __typename: 'UserNotFoundError',
          message: 'User not found',
          userId: id
        };
      }

      return {
        __typename: 'User',
        ...user
      };
    }
  },

  UserResult: {
    __resolveType(obj) {
      return obj.__typename;
    }
  }
};
```

#### Pattern 3: Result Type Pattern

```graphql
type User {
  id: ID!
  username: String!
}

type Error {
  message: String!
  code: String!
  field: String
}

type UserPayload {
  user: User
  errors: [Error!]!
  success: Boolean!
}

type Query {
  user(id: ID!): UserPayload!
}
```

```typescript
const resolvers = {
  Query: {
    user: async (parent, { id }, context) => {
      try {
        const user = await context.db.user.findUnique({ where: { id } });

        if (!user) {
          return {
            user: null,
            errors: [{
              message: 'User not found',
              code: 'USER_NOT_FOUND',
              field: 'id'
            }],
            success: false
          };
        }

        return {
          user,
          errors: [],
          success: true
        };
      } catch (error) {
        return {
          user: null,
          errors: [{
            message: 'Internal server error',
            code: 'INTERNAL_ERROR',
            field: null
          }],
          success: false
        };
      }
    }
  }
};
```

## Best Practices

### 1. Keep Resolvers Thin

```typescript
// ❌ BAD: Business logic in the resolver
const resolvers = {
  Mutation: {
    createUser: async (parent, { input }, context) => {
      // Validation
      if (input.username.length < 3) {
        throw new Error('Username too short');
      }
      if (!input.email.includes('@')) {
        throw new Error('Invalid email');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Create user
      const user = await context.db.user.create({
        data: { ...input, password: hashedPassword }
      });

      // Send welcome email
      await sendEmail(user.email, 'Welcome!');

      return user;
    }
  }
};

// ✅ GOOD: Delegate to service layer
const resolvers = {
  Mutation: {
    createUser: async (parent, { input }, context) => {
      return await context.services.user.create(input);
    }
  }
};

// services/user.service.ts
class UserService {
  async create(input: CreateUserInput): Promise<User> {
    this.validateInput(input);
    const hashedPassword = await this.hashPassword(input.password);
    const user = await this.db.user.create({
      data: { ...input, password: hashedPassword }
    });
    await this.sendWelcomeEmail(user);
    return user;
  }
}
```

### 2. Use DataLoaders Always for Relations

```typescript
// ✅ GOOD: Always use DataLoaders
const resolvers = {
  Post: {
    author: (parent, args, context) => {
      return context.loaders.user.load(parent.authorId);
    },
    comments: (parent, args, context) => {
      return context.loaders.commentsByPost.load(parent.id);
    }
  }
};
```

### 3. Handle Null Cases Explicitly

```typescript
const resolvers = {
  Query: {
    user: async (parent, { id }, context) => {
      const user = await context.db.user.findUnique({ where: { id } });

      // Explicit null return for nullable fields
      if (!user) {
        return null;  // Schema: user(id: ID!): User
      }

      return user;
    }
  },

  User: {
    bio: (parent) => {
      // Handle null/undefined fields
      return parent.bio ?? null;
    }
  }
};
```

### 4. Implement Proper Context Cleanup

```typescript
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const db = new PrismaClient();

    return {
      user: await getUser(req),
      db,
      loaders: createLoaders(db)
    };
  },
  plugins: [
    {
      async requestDidStart() {
        return {
          async willSendResponse({ contextValue }) {
            // Cleanup: Disconnect database
            await contextValue.db.$disconnect();
          }
        };
      }
    }
  ]
});
```

### 5. Use Field-Level Caching

```typescript
import { GraphQLResolveInfo } from 'graphql';
import { createHash } from 'crypto';

// Cache decorator
function cached(ttl: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cache = new Map<string, { data: any; expires: number }>();

    descriptor.value = async function (...args: any[]) {
      const [parent, resolverArgs, context, info] = args;
      const cacheKey = createCacheKey(info.path, resolverArgs);

      const cached = cache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        return cached.data;
      }

      const result = await originalMethod.apply(this, args);

      cache.set(cacheKey, {
        data: result,
        expires: Date.now() + ttl
      });

      return result;
    };

    return descriptor;
  };
}

function createCacheKey(path: any, args: any): string {
  const key = JSON.stringify({ path, args });
  return createHash('md5').update(key).digest('hex');
}

// Usage
class UserResolver {
  @cached(60000) // Cache for 60 seconds
  async user(parent: any, args: { id: string }, context: Context) {
    return await context.db.user.findUnique({ where: { id: args.id } });
  }
}
```

## Anti-patterns / Common Mistakes

### ❌ 1. N+1 Queries without DataLoader

```typescript
// BAD: N+1 problem
const resolvers = {
  Query: {
    posts: () => db.post.findMany() // 1 query
  },
  Post: {
    author: (post) => db.user.findUnique({ where: { id: post.authorId } }) // N queries!
  }
};
```

### ❌ 2. Mutating Context

```typescript
// BAD: Mutating context
const resolvers = {
  Query: {
    user: (parent, args, context) => {
      context.cachedData = {}; // DON'T mutate context!
      return getUser(args.id);
    }
  }
};
```

### ❌ 3. Throwing Generic Errors

```typescript
// BAD: Generic errors
const resolvers = {
  Query: {
    user: async (parent, { id }) => {
      const user = await db.user.findUnique({ where: { id } });
      if (!user) throw new Error('Error'); // Too generic!
      return user;
    }
  }
};

// GOOD: Specific errors with codes
const resolvers = {
  Query: {
    user: async (parent, { id }) => {
      const user = await db.user.findUnique({ where: { id } });
      if (!user) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'USER_NOT_FOUND', userId: id }
        });
      }
      return user;
    }
  }
};
```

### ❌ 4. Over-Fetching at the Resolver Level

```typescript
// BAD: Fetching all relations
const resolvers = {
  User: {
    posts: (user) => db.post.findMany({
      where: { authorId: user.id },
      include: {
        comments: true,  // Not requested!
        likes: true,     // Not requested!
        tags: true       // Not requested!
      }
    })
  }
};

// GOOD: Let nested resolvers handle it
const resolvers = {
  User: {
    posts: (user) => db.post.findMany({ where: { authorId: user.id } })
  },
  Post: {
    comments: (post) => context.loaders.commentsByPost.load(post.id),
    likes: (post) => context.loaders.likesByPost.load(post.id)
  }
};
```

## Real-world Examples

### Complete Example with All Patterns

```typescript
// types.ts
import { PrismaClient, User, Post } from '@prisma/client';
import DataLoader from 'dataloader';

export interface Context {
  user: User | null;
  db: PrismaClient;
  loaders: {
    user: DataLoader<string, User | null>;
    usersByIds: DataLoader<string[], User[]>;
    postsByAuthor: DataLoader<string, Post[]>;
  };
}

// context.ts
import { PrismaClient } from '@prisma/client';
import DataLoader from 'dataloader';
import { verifyToken } from './auth';
import type { Context } from './types';

export async function createContext({ req }): Promise<Context> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = token ? await verifyToken(token) : null;

  const db = new PrismaClient();

  const loaders = {
    user: new DataLoader<string, User | null>(async (ids) => {
      const users = await db.user.findMany({
        where: { id: { in: [...ids] } }
      });
      return ids.map(id => users.find(u => u.id === id) || null);
    }),

    usersByIds: new DataLoader<string[], User[]>(async (idArrays) => {
      const allIds = [...new Set(idArrays.flat())];
      const users = await db.user.findMany({
        where: { id: { in: allIds } }
      });

      return idArrays.map(ids =>
        ids.map(id => users.find(u => u.id === id)).filter(Boolean) as User[]
      );
    }),

    postsByAuthor: new DataLoader<string, Post[]>(async (authorIds) => {
      const posts = await db.post.findMany({
        where: { authorId: { in: [...authorIds] } }
      });

      return authorIds.map(authorId =>
        posts.filter(p => p.authorId === authorId)
      );
    })
  };

  return { user, db, loaders };
}

// resolvers.ts
import { GraphQLError } from 'graphql';
import type { Context } from './types';

export const resolvers = {
  Query: {
    me: (parent: any, args: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      return context.user;
    },

    user: async (parent: any, { id }: { id: string }, context: Context) => {
      const user = await context.loaders.user.load(id);

      if (!user) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'USER_NOT_FOUND', userId: id }
        });
      }

      return user;
    },

    users: async (parent: any, args: any, context: Context) => {
      return await context.db.user.findMany();
    },

    posts: async (
      parent: any,
      { status }: { status?: string },
      context: Context
    ) => {
      return await context.db.post.findMany({
        where: status ? { status } : undefined
      });
    }
  },

  Mutation: {
    createPost: async (
      parent: any,
      { input }: { input: any },
      context: Context
    ) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      const post = await context.db.post.create({
        data: {
          title: input.title,
          content: input.content,
          authorId: context.user.id,
          published: false
        }
      });

      return post;
    },

    updatePost: async (
      parent: any,
      { id, input }: { id: string; input: any },
      context: Context
    ) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated');
      }

      const post = await context.db.post.findUnique({ where: { id } });

      if (!post) {
        throw new GraphQLError('Post not found', {
          extensions: { code: 'POST_NOT_FOUND' }
        });
      }

      if (post.authorId !== context.user.id) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return await context.db.post.update({
        where: { id },
        data: input
      });
    },

    deletePost: async (
      parent: any,
      { id }: { id: string },
      context: Context
    ) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated');
      }

      const post = await context.db.post.findUnique({ where: { id } });

      if (!post) {
        throw new GraphQLError('Post not found');
      }

      if (post.authorId !== context.user.id && context.user.role !== 'ADMIN') {
        throw new GraphQLError('Not authorized');
      }

      await context.db.post.delete({ where: { id } });

      return true;
    }
  },

  User: {
    posts: async (parent: User, args: any, context: Context) => {
      return await context.loaders.postsByAuthor.load(parent.id);
    },

    postCount: async (parent: User, args: any, context: Context) => {
      return await context.db.post.count({
        where: { authorId: parent.id }
      });
    }
  },

  Post: {
    author: async (parent: Post, args: any, context: Context) => {
      const author = await context.loaders.user.load(parent.authorId);
      if (!author) {
        throw new GraphQLError('Author not found');
      }
      return author;
    }
  }
};

// server.ts
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { createContext } from './context';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    {
      async requestDidStart() {
        return {
          async willSendResponse({ contextValue }) {
            await contextValue.db.$disconnect();
          }
        };
      }
    }
  ]
});

const { url } = await startStandaloneServer(server, {
  context: createContext,
  listen: { port: 4000 }
});

console.log(`🚀 Server ready at ${url}`);
```

## Sources

- [Resolvers - Apollo GraphQL](https://www.apollographql.com/docs/apollo-server/data/resolvers)
- [GraphQL Execution](https://graphql.org/learn/execution/)
- [DataLoader GitHub](https://github.com/graphql/dataloader)
- [Context and contextValue](https://www.apollographql.com/docs/apollo-server/data/context)
- [GraphQL Resolver Best Practices - PayPal](https://medium.com/paypal-tech/graphql-resolvers-best-practices-cd36fdbcef55)
- [Authentication and Authorization](https://www.apollographql.com/docs/apollo-server/security/authentication)
- [Error Handling - Apollo](https://www.apollographql.com/docs/apollo-server/data/errors)
- [Demystifying the info Argument](https://www.prisma.io/blog/graphql-server-basics-demystifying-the-info-argument-in-graphql-resolvers-6f26249f613a)
