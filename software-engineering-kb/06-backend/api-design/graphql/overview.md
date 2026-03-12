# GraphQL Overview

> **Domain:** Backend > API > GraphQL
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-09

## What It Is

GraphQL is a **query language for APIs** and a **server-side runtime** for executing queries using a type system that you define for your data.

### Core Elements

**Type System:** Every GraphQL service defines a type system that allows tools to perform syntactic validation of queries before execution and to ensure predictable results.

**Query Language:** Describes the language, its grammar, the type system, and the introspection system used for queries.

**Runtime:** Execution and validation engines with the algorithms that power them.

### GraphQL Specification Components

```graphql
# 1. QUERIES - Reading data
query GetUser($id: ID!) {
  user(id: $id) {
    name
    email
    posts {
      title
    }
  }
}

# 2. MUTATIONS - Modifying data
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    id
    title
    author {
      name
    }
  }
}

# 3. SUBSCRIPTIONS - Real-time updates
subscription OnPostCreated {
  postCreated {
    id
    title
    author {
      name
    }
  }
}

# 4. FRAGMENTS - Reusable query parts
fragment UserInfo on User {
  id
  name
  email
}

query GetUsers {
  users {
    ...UserInfo
  }
}
```

## Why It Matters

### Differences from REST

| Characteristic | REST | GraphQL |
|----------------|------|---------|
| **Endpoints** | Multiple endpoints (e.g. `/users`, `/posts`) | A single endpoint (e.g. `/graphql`) |
| **Data Fetching** | Server determines structure | Client determines exactly what it needs |
| **Over-fetching** | You get all the data of the resource | You get only the fields you request |
| **Under-fetching** | Multiple requests needed | One request for nested data |
| **Versioning** | URL versioning (e.g. `/v1/users`) | Schema evolution with deprecation |
| **Type System** | No built-in (OpenAPI optional) | Strongly-typed schema (required) |
| **Transport** | REST principles over HTTP | Typically HTTP POST (not REST) |

### Advantages

1. **Client-Driven Queries:** Clients send a query that specifies exactly what data they need
2. **No Over/Under-Fetching:** You receive exactly as much data as you requested
3. **Single Request:** You can get related data in one request instead of multiple
4. **Strong Type System:** Validation before execution, predictable responses
5. **Introspection:** Self-documenting API that you can query for its schema

## How It Works

### Schema-First vs Code-First Development

#### Schema-First Approach

You start by writing the GraphQL schema using SDL (Schema Definition Language):

```graphql
# schema.graphql
type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  createdAt: DateTime!
}

type Query {
  user(id: ID!): User
  users: [User!]!
  post(id: ID!): Post
}

type Mutation {
  createPost(input: CreatePostInput!): Post!
  updatePost(id: ID!, input: UpdatePostInput!): Post!
  deletePost(id: ID!): Boolean!
}

input CreatePostInput {
  title: String!
  content: String!
  authorId: ID!
}
```

**Advantages:**
- Easy to understand, communication tool between frontend/backend
- Schema definition as API documentation
- Fast for prototyping

**Disadvantages:**
- The schema must match exactly with the resolver implementation
- Difficult to maintain as it grows (hundreds of lines)

#### Code-First Approach (TypeScript)

The schema is created programmatically from code:

```typescript
// TypeScript with TypeGraphQL
import { ObjectType, Field, ID, Resolver, Query, Arg } from 'type-graphql';

@ObjectType()
class User {
  @Field(type => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field(type => [Post])
  posts: Post[];
}

@ObjectType()
class Post {
  @Field(type => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  content: string;

  @Field(type => User)
  author: User;
}

@Resolver(User)
class UserResolver {
  @Query(returns => User, { nullable: true })
  async user(@Arg('id', type => ID) id: string): Promise<User | null> {
    return await db.user.findUnique({ where: { id } });
  }

  @Query(returns => [User])
  async users(): Promise<User[]> {
    return await db.user.findMany();
  }
}
```

**Advantages:**
- Type safety: Errors at development time, not runtime
- Automatic synchronization between schema and resolvers
- Easier maintenance as the API grows

**Disadvantages:**
- You can become too focused on the implementation instead of the API design

### Transport Layer

GraphQL is **agnostic to the transport layer** but typically uses **HTTP POST**:

```http
POST /graphql HTTP/1.1
Host: api.example.com
Content-Type: application/json

{
  "query": "query GetUser($id: ID!) { user(id: $id) { name email } }",
  "variables": { "id": "123" },
  "operationName": "GetUser"
}
```

**HTTP Response:**
```json
{
  "data": {
    "user": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "errors": []
}
```

### Introspection System

GraphQL allows querying the schema itself:

```graphql
# Discover all types
{
  __schema {
    types {
      name
      kind
      description
    }
  }
}

# Discover the fields of a type
{
  __type(name: "User") {
    name
    fields {
      name
      type {
        name
        kind
      }
    }
  }
}
```

This enables tools like GraphQL Playground and GraphiQL to provide:
- Auto-completion
- Documentation
- Query validation in real-time

## Best Practices

### 1. Schema Design Best Practices

```graphql
# ✅ GOOD: Descriptive names, proper casing
type User {
  id: ID!
  fullName: String!
  emailAddress: String!
}

# ❌ BAD: Abbreviated, inconsistent casing
type usr {
  ID: ID!
  name: String!
  email_addr: String!
}
```

### 2. Use Nullable by Default Strategy

```graphql
# Fields are nullable by default
type User {
  id: ID!              # Non-null (guaranteed)
  name: String!        # Non-null (guaranteed)
  bio: String          # Nullable (might not exist)
  website: String      # Nullable (optional)
}
```

### 3. Implement Proper Error Handling

```typescript
// TypeScript Apollo Server
const resolvers = {
  Query: {
    user: async (parent, { id }, context) => {
      try {
        const user = await context.db.user.findUnique({ where: { id } });
        if (!user) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'USER_NOT_FOUND' }
          });
        }
        return user;
      } catch (error) {
        throw new GraphQLError('Failed to fetch user', {
          extensions: { code: 'INTERNAL_ERROR', originalError: error }
        });
      }
    }
  }
};
```

### 4. Use DataLoader for N+1 Prevention

```typescript
import DataLoader from 'dataloader';

// Batch load users
const userLoader = new DataLoader(async (userIds: string[]) => {
  const users = await db.user.findMany({
    where: { id: { in: userIds } }
  });

  // Return in same order as requested
  return userIds.map(id => users.find(u => u.id === id));
});

const resolvers = {
  Post: {
    author: (post, args, context) => {
      return context.loaders.user.load(post.authorId);
    }
  }
};
```

### 5. Implement Authentication/Authorization

```typescript
// Context with user authentication
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await verifyToken(token);

    return {
      user,
      db,
      loaders: {
        user: new DataLoader(batchGetUsers)
      }
    };
  }
});

// Resolver-level authorization
const resolvers = {
  Query: {
    adminData: (parent, args, context) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }
      return getAdminData();
    }
  }
};
```

## Anti-patterns / Common Mistakes

### ❌ 1. Ignoring the N+1 Problem

```typescript
// BAD: Causes N+1 queries
const resolvers = {
  Query: {
    posts: () => db.post.findMany()
  },
  Post: {
    // This runs once for EACH post!
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

### ❌ 2. Exposing Internal Structure

```graphql
# BAD: Exposes database structure
type User {
  id: ID!
  user_name: String!      # Database column name
  created_at: DateTime!   # Database column name
}

# GOOD: API-first design
type User {
  id: ID!
  username: String!
  createdAt: DateTime!
}
```

### ❌ 3. Not Using Complexity Limiting

```typescript
// BAD: Without protection from malicious queries
const server = new ApolloServer({ typeDefs, resolvers });

// GOOD: With depth and complexity limiting
import { createComplexityLimitRule } from 'graphql-validation-complexity';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    createComplexityLimitRule(1000), // Max complexity
    depthLimit(10) // Max depth
  ]
});
```

### ❌ 4. Over-fetching at the Resolver Level

```typescript
// BAD: Fetching all related data
const resolvers = {
  User: {
    posts: (user) => db.post.findMany({
      where: { authorId: user.id },
      include: {
        comments: true,  // Not requested by client!
        likes: true      // Not requested by client!
      }
    })
  }
};

// GOOD: Fetch only requested fields
const resolvers = {
  User: {
    posts: (user) => db.post.findMany({
      where: { authorId: user.id }
    })
  },
  Post: {
    comments: (post) => db.comment.findMany({ where: { postId: post.id } }),
    likes: (post) => db.like.count({ where: { postId: post.id } })
  }
};
```

## Real-world Examples

### Example 1: Complete Apollo Server Setup (TypeScript)

```typescript
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import DataLoader from 'dataloader';

// Type Definitions
const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    author: User!
    published: Boolean!
    createdAt: String!
  }

  type Query {
    user(id: ID!): User
    users: [User!]!
    posts(published: Boolean): [Post!]!
  }

  type Mutation {
    createPost(title: String!, content: String!, authorId: ID!): Post!
    publishPost(id: ID!): Post!
  }

  type Subscription {
    postPublished: Post!
  }
`;

// Resolvers
const resolvers = {
  Query: {
    user: async (_, { id }, { loaders }) => {
      return loaders.user.load(id);
    },
    users: async (_, __, { db }) => {
      return db.user.findMany();
    },
    posts: async (_, { published }, { db }) => {
      return db.post.findMany({
        where: published !== undefined ? { published } : {}
      });
    }
  },

  Mutation: {
    createPost: async (_, { title, content, authorId }, { db, user }) => {
      if (!user) throw new Error('Not authenticated');

      return db.post.create({
        data: { title, content, authorId, published: false }
      });
    },
    publishPost: async (_, { id }, { db, user }) => {
      if (!user) throw new Error('Not authenticated');

      const post = await db.post.findUnique({ where: { id } });
      if (post.authorId !== user.id) {
        throw new Error('Not authorized');
      }

      return db.post.update({
        where: { id },
        data: { published: true }
      });
    }
  },

  User: {
    posts: async (user, _, { db }) => {
      return db.post.findMany({ where: { authorId: user.id } });
    }
  },

  Post: {
    author: async (post, _, { loaders }) => {
      return loaders.user.load(post.authorId);
    }
  }
};

// DataLoaders
const createLoaders = (db) => ({
  user: new DataLoader(async (ids) => {
    const users = await db.user.findMany({
      where: { id: { in: [...ids] } }
    });
    return ids.map(id => users.find(u => u.id === id));
  })
});

// Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = token ? await verifyToken(token) : null;

    return {
      user,
      db: prisma,
      loaders: createLoaders(prisma)
    };
  },
  listen: { port: 4000 }
});

console.log(`🚀 Server ready at ${url}`);
```

### Example 2: Python with Strawberry GraphQL

```python
import strawberry
from typing import List, Optional
from dataclasses import dataclass

@strawberry.type
class User:
    id: strawberry.ID
    name: str
    email: str

@strawberry.type
class Post:
    id: strawberry.ID
    title: str
    content: str
    author_id: strawberry.ID
    published: bool

    @strawberry.field
    async def author(self, info) -> User:
        # Use DataLoader from context
        return await info.context.loaders.user.load(self.author_id)

@strawberry.type
class Query:
    @strawberry.field
    async def user(self, id: strawberry.ID) -> Optional[User]:
        return await db.get_user(id)

    @strawberry.field
    async def users(self) -> List[User]:
        return await db.get_users()

    @strawberry.field
    async def posts(self, published: Optional[bool] = None) -> List[Post]:
        return await db.get_posts(published=published)

@strawberry.input
class CreatePostInput:
    title: str
    content: str
    author_id: strawberry.ID

@strawberry.type
class Mutation:
    @strawberry.mutation
    async def create_post(self, input: CreatePostInput) -> Post:
        return await db.create_post(
            title=input.title,
            content=input.content,
            author_id=input.author_id
        )

# Create schema
schema = strawberry.Schema(query=Query, mutation=Mutation)

# FastAPI integration
from fastapi import FastAPI
from strawberry.fastapi import GraphQLRouter

app = FastAPI()
graphql_app = GraphQLRouter(schema)
app.include_router(graphql_app, prefix="/graphql")
```

### Example 3: Client Query (Apollo Client)

```typescript
import { ApolloClient, InMemoryCache, gql, useQuery } from '@apollo/client';

// Setup client
const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql',
  cache: new InMemoryCache(),
  headers: {
    authorization: `Bearer ${localStorage.getItem('token')}`
  }
});

// Query
const GET_USER_WITH_POSTS = gql`
  query GetUserWithPosts($userId: ID!) {
    user(id: $userId) {
      id
      name
      email
      posts {
        id
        title
        published
        createdAt
      }
    }
  }
`;

// React component
function UserProfile({ userId }) {
  const { loading, error, data } = useQuery(GET_USER_WITH_POSTS, {
    variables: { userId }
  });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h1>{data.user.name}</h1>
      <p>{data.user.email}</p>
      <h2>Posts</h2>
      {data.user.posts.map(post => (
        <div key={post.id}>
          <h3>{post.title}</h3>
          <span>{post.published ? 'Published' : 'Draft'}</span>
        </div>
      ))}
    </div>
  );
}
```

## Sources

- [GraphQL Official Website](https://graphql.org/)
- [GraphQL Specification](https://spec.graphql.org/)
- [Apollo GraphQL Documentation](https://www.apollographql.com/docs/)
- [How to GraphQL Tutorial](https://www.howtographql.com/)
- [GraphQL vs REST Comparison](https://aws.amazon.com/compare/the-difference-between-graphql-and-rest/)
- [Code-first vs Schema-first Development](https://blog.logrocket.com/code-first-vs-schema-first-development-graphql/)
- [GraphQL Introspection](https://graphql.org/learn/introspection/)
- [GraphQL Over HTTP Specification](https://graphql.github.io/graphql-over-http/draft/)
