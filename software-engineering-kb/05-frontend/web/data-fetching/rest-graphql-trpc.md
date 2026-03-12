# REST vs GraphQL vs tRPC — Complete Specification

> **AI Plugin Directive:** When a developer asks "REST vs GraphQL?", "should I use tRPC?", "GraphQL vs REST performance", "when to use GraphQL", "tRPC with Next.js", "API design patterns", "REST API best practices", or any API architecture question, ALWAYS consult this directive. Choose REST for public APIs and simple CRUD. Choose GraphQL for complex data requirements with multiple clients. Choose tRPC for TypeScript full-stack monorepos with maximum type safety. NEVER choose a protocol based on hype — choose based on project constraints.

**Core Rule: REST is the DEFAULT choice for most APIs — simple, cacheable, well-understood. Use GraphQL when you have MULTIPLE CLIENTS with DIFFERENT data needs (mobile vs web vs third-party) or deeply nested/relational data. Use tRPC when you control BOTH client AND server in a TypeScript monorepo and want end-to-end type safety with ZERO schema overhead. ALWAYS consider: who consumes the API, how complex are the data requirements, and does the team have the expertise?**

---

## 1. Architecture Comparison

```
         API PARADIGM COMPARISON

  REST                    GRAPHQL                 tRPC
  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
  │ Resource-based    │   │ Query-based       │   │ Procedure-based  │
  │                   │   │                   │   │                  │
  │ GET /users        │   │ query {           │   │ api.user.list()  │
  │ GET /users/1      │   │   users {         │   │ api.user.get(1)  │
  │ POST /users       │   │     id            │   │ api.user.create  │
  │ PUT /users/1      │   │     name          │   │   ({ name: '..'})│
  │ DELETE /users/1   │   │   }               │   │                  │
  │                   │   │ }                 │   │                  │
  │ Multiple endpoints│   │ Single endpoint   │   │ TypeScript RPC   │
  │ HTTP semantics    │   │ POST /graphql     │   │ Full type safety │
  │ Status codes      │   │ Schema-defined    │   │ Zero code gen    │
  └──────────────────┘   └──────────────────┘   └──────────────────┘

  DATA FETCHING:
  ┌────────────────────────────────────────────────────────┐
  │ OVER-FETCHING (getting too much data):                 │
  │ REST:    GET /users/1 → Returns ALL fields always      │
  │ GraphQL: query { user(id:1) { name } } → Only name    │
  │ tRPC:    api.user.get(1) → Type-safe, but full object  │
  │                                                        │
  │ UNDER-FETCHING (needing multiple requests):            │
  │ REST:    GET /users/1 + GET /users/1/posts             │
  │          + GET /users/1/followers (3 requests)         │
  │ GraphQL: One query gets user + posts + followers       │
  │ tRPC:    Can batch, but still multiple procedures      │
  └────────────────────────────────────────────────────────┘
```

---

## 2. REST — Representational State Transfer

```typescript
// REST API DESIGN PATTERNS

// RESOURCE NAMING — Nouns, plural, hierarchical
// ✅ GOOD:
// GET    /api/users           → List users
// GET    /api/users/123       → Get user 123
// POST   /api/users           → Create user
// PUT    /api/users/123       → Replace user 123
// PATCH  /api/users/123       → Partial update user 123
// DELETE /api/users/123       → Delete user 123
// GET    /api/users/123/posts → List posts by user 123

// ❌ BAD:
// GET /api/getUsers           → Verb in URL
// POST /api/deleteUser/123    → Wrong method + verb in URL
// GET /api/user               → Singular (use plural)


// STATUS CODES
// 200 OK                → Success (GET, PUT, PATCH)
// 201 Created           → Success (POST — resource created)
// 204 No Content        → Success (DELETE — no body)
// 400 Bad Request       → Client error (validation, bad input)
// 401 Unauthorized      → Not authenticated
// 403 Forbidden         → Authenticated but not authorized
// 404 Not Found         → Resource doesn't exist
// 409 Conflict          → Conflict (duplicate, version mismatch)
// 422 Unprocessable     → Validation error (semantic)
// 429 Too Many Requests → Rate limited
// 500 Internal Error    → Server error


// PAGINATION (cursor-based — recommended)
// GET /api/posts?cursor=abc123&limit=20
interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;  // null = no more pages
  hasMore: boolean;
}

// PAGINATION (offset-based — simpler but less efficient)
// GET /api/posts?page=2&limit=20
interface OffsetResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// FILTERING AND SORTING
// GET /api/posts?status=published&sort=-createdAt&fields=id,title
// sort=-createdAt = descending by createdAt
// fields=id,title = sparse fieldsets (partial REST solution to over-fetching)


// VERSIONING
// URL path (most common): /api/v1/users, /api/v2/users
// Header: Accept: application/vnd.api.v2+json
// Query: /api/users?version=2


// ERROR RESPONSE FORMAT
interface ApiError {
  status: number;
  code: string;          // Machine-readable: 'VALIDATION_ERROR'
  message: string;       // Human-readable
  details?: Array<{
    field: string;
    message: string;
  }>;
}

// Example:
// {
//   "status": 422,
//   "code": "VALIDATION_ERROR",
//   "message": "Invalid input",
//   "details": [
//     { "field": "email", "message": "Invalid email format" }
//   ]
// }
```

### 2.1 REST Client Patterns

```typescript
// Type-safe REST client with fetch
async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  const token = getAuthToken();

  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new ApiRequestError(error);
  }

  return response.json();
}

// Usage
const users = await apiClient<User[]>('/api/users?limit=20');
const user = await apiClient<User>('/api/users/123');
const created = await apiClient<User>('/api/users', {
  method: 'POST',
  body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
});


// WITH TANSTACK QUERY (recommended for React)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function useUsers(page: number) {
  return useQuery({
    queryKey: ['users', { page }],
    queryFn: () => apiClient<PaginatedResponse<User>>(`/api/users?page=${page}`),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserInput) =>
      apiClient<User>('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
```

---

## 3. GraphQL

```typescript
// GRAPHQL SCHEMA DEFINITION
// schema.graphql

// type User {
//   id: ID!
//   name: String!
//   email: String!
//   posts(first: Int, after: String): PostConnection!
//   followers: [User!]!
//   createdAt: DateTime!
// }
//
// type Post {
//   id: ID!
//   title: String!
//   content: String!
//   author: User!
//   comments: [Comment!]!
//   tags: [String!]!
// }
//
// type PostConnection {
//   edges: [PostEdge!]!
//   pageInfo: PageInfo!
// }
//
// type PostEdge {
//   node: Post!
//   cursor: String!
// }
//
// type PageInfo {
//   hasNextPage: Boolean!
//   endCursor: String
// }
//
// type Query {
//   user(id: ID!): User
//   users(first: Int, after: String): UserConnection!
//   post(id: ID!): Post
//   searchPosts(query: String!): [Post!]!
// }
//
// type Mutation {
//   createUser(input: CreateUserInput!): User!
//   updateUser(id: ID!, input: UpdateUserInput!): User!
//   createPost(input: CreatePostInput!): Post!
// }


// GRAPHQL QUERIES

// Simple query — specify exactly what you need
const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }
`;

// Nested query — one request for related data
const GET_USER_WITH_POSTS = gql`
  query GetUserWithPosts($userId: ID!, $first: Int!) {
    user(id: $userId) {
      id
      name
      posts(first: $first) {
        edges {
          node {
            id
            title
            comments {
              id
              text
              author { name }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;
// ONE request gets: user + posts + comments + comment authors
// REST would need: 3-4 separate requests


// MUTATIONS
const CREATE_POST = gql`
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      id
      title
      author { name }
    }
  }
`;


// FRAGMENTS — Reusable field selections
const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    name
    email
    avatar
  }
`;

const GET_USERS = gql`
  ${USER_FIELDS}
  query GetUsers {
    users(first: 20) {
      edges {
        node { ...UserFields }
      }
    }
  }
`;
```

### 3.1 GraphQL Client (Apollo)

```typescript
// Apollo Client setup
import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(`GraphQL error: ${message}`, { locations, path });
    });
  }
  if (networkError) {
    console.error('Network error:', networkError);
  }
});

const httpLink = new HttpLink({
  uri: '/graphql',
  headers: { Authorization: `Bearer ${getToken()}` },
});

const client = new ApolloClient({
  link: from([errorLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          users: {
            // Cursor-based pagination merge
            keyArgs: false,
            merge(existing, incoming) {
              return {
                ...incoming,
                edges: [...(existing?.edges ?? []), ...incoming.edges],
              };
            },
          },
        },
      },
    },
  }),
});


// React hooks usage
import { useQuery, useMutation } from '@apollo/client';

function UserProfile({ userId }: { userId: string }) {
  const { data, loading, error } = useQuery(GET_USER_WITH_POSTS, {
    variables: { userId, first: 10 },
  });

  const [createPost, { loading: creating }] = useMutation(CREATE_POST, {
    refetchQueries: [{ query: GET_USER_WITH_POSTS }],
    // Or use cache update for optimistic UI:
    update(cache, { data }) {
      // Update Apollo cache directly
    },
  });

  if (loading) return <Spinner />;
  if (error) return <Error message={error.message} />;

  return (
    <div>
      <h1>{data.user.name}</h1>
      {data.user.posts.edges.map(({ node }) => (
        <PostCard key={node.id} post={node} />
      ))}
    </div>
  );
}
```

### 3.2 The N+1 Problem

```typescript
// N+1 PROBLEM — The biggest GraphQL performance pitfall

// Query:
// query { users(first: 10) { posts { title } } }
//
// Naive resolver:
// resolve users → 1 query (SELECT * FROM users LIMIT 10)
// For EACH user, resolve posts → 10 queries!
// Total: 11 queries (1 + N)

// FIX: DataLoader (batching + caching)
import DataLoader from 'dataloader';

// Create a batch loader
const postsByUserLoader = new DataLoader(async (userIds: string[]) => {
  // ONE query for ALL users' posts
  const posts = await db.post.findMany({
    where: { authorId: { in: userIds } },
  });

  // Return posts grouped by userId (in same order as input)
  return userIds.map(id => posts.filter(p => p.authorId === id));
});

// Resolver uses loader
const resolvers = {
  User: {
    posts: (parent: User) => postsByUserLoader.load(parent.id),
    // DataLoader batches multiple .load() calls into ONE query
    // Also caches within the same request
  },
};

// RULE: ALWAYS use DataLoader for resolvers that query databases
// Create new DataLoader instances PER REQUEST (not globally)
```

---

## 4. tRPC — End-to-End Type Safety

```typescript
// tRPC — TypeScript RPC: full type safety without schema/codegen

// SERVER: Define procedures
// server/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, user: ctx.user } });
});


// server/routers/user.ts
export const userRouter = router({
  list: publicProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const users = await ctx.db.user.findMany({
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (users.length > input.limit) {
        nextCursor = users.pop()!.id;
      }

      return { users, nextCursor };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.id } });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
      return user;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      email: z.string().email(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return ctx.db.user.update({ where: { id }, data });
    }),
});


// CLIENT: Full type inference — NO codegen needed
// utils/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../server/routers';

export const trpc = createTRPCReact<AppRouter>();


// Component usage — fully typed!
function UserList() {
  const { data, isLoading } = trpc.user.list.useQuery({ limit: 20 });
  //                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                          Fully typed: input validated, output typed

  const createUser = trpc.user.create.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate(); // Type-safe cache invalidation
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      {data?.users.map(user => (
        <div key={user.id}>{user.name}</div>
        //                  ^^^^^^^^^ Autocomplete works!
      ))}
    </div>
  );
}
```

---

## 5. Decision Tree

```
API PROTOCOL DECISION TREE:

  START: Who consumes this API?
    │
    ├── Public API (third-party developers, partners)
    │   └── REST ✅ (universally understood, cacheable, tooling)
    │
    ├── Multiple clients with DIFFERENT data needs
    │   │  (mobile app needs 5 fields, web needs 20, admin needs all)
    │   └── GraphQL ✅ (each client queries exactly what it needs)
    │
    ├── TypeScript full-stack monorepo (you control both sides)
    │   └── tRPC ✅ (maximum type safety, zero schema overhead)
    │
    └── Simple CRUD API (internal or single client)
        └── REST ✅ (simplest, most familiar, best caching)

  SECONDARY QUESTIONS:

  Is caching critical? (CDN, HTTP cache)
    YES → REST ✅ (HTTP caching works naturally with GET requests)
    GraphQL: POST-based, harder to cache at HTTP level

  Do you have deeply nested/relational data?
    YES → GraphQL ✅ (one query traverses the graph)
    REST: Requires multiple endpoints or complex includes

  Is real-time data needed?
    GraphQL: Subscriptions (WebSocket)
    tRPC: Subscriptions (WebSocket)
    REST: WebSocket/SSE (separate system)

  Does the team know GraphQL?
    NO → REST or tRPC (GraphQL has a significant learning curve)
    YES → GraphQL is a strong option
```

```
COMPARISON TABLE:

  ┌──────────────────────┬──────────┬──────────┬──────────┐
  │ Criterion            │ REST     │ GraphQL  │ tRPC     │
  ├──────────────────────┼──────────┼──────────┼──────────┤
  │ Type safety          │ Manual   │ Schema   │ Automatic│
  │ Code generation      │ OpenAPI  │ Required │ None     │
  │ Over-fetching        │ Common   │ Solved   │ Moderate │
  │ Under-fetching       │ Common   │ Solved   │ Moderate │
  │ HTTP caching         │ Excellent│ Hard     │ Hard     │
  │ Learning curve       │ Low      │ High     │ Low      │
  │ Tooling maturity     │ Excellent│ Good     │ Growing  │
  │ Real-time            │ Separate │ Built-in │ Built-in │
  │ File uploads         │ Easy     │ Complex  │ Moderate │
  │ Public API           │ Best     │ Good     │ No       │
  │ Bundle size impact   │ Minimal  │ ~30-50KB │ Minimal  │
  │ N+1 queries          │ N/A      │ Risk     │ N/A      │
  │ Error handling       │ HTTP std │ Custom   │ Type-safe│
  └──────────────────────┴──────────┴──────────┴──────────┘
```

---

## 6. Authentication Patterns

```typescript
// BEARER TOKEN (JWT) — Most common for SPAs
// Header: Authorization: Bearer eyJhbGci...
const response = await fetch('/api/users', {
  headers: { Authorization: `Bearer ${token}` },
});

// HTTPONLY COOKIE — More secure for same-origin
// Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Strict
// Browser sends automatically — no JS access (XSS resistant)
const response = await fetch('/api/users', {
  credentials: 'include', // Include cookies
});

// API KEY — For server-to-server or rate limiting
// Header: X-API-Key: sk_live_abc123
const response = await fetch('/api/data', {
  headers: { 'X-API-Key': process.env.API_KEY },
});

// RECOMMENDATION:
// SPA + same-origin API → HttpOnly cookies (most secure)
// SPA + cross-origin API → Bearer token (store in memory, not localStorage)
// Server-to-server → API Key
// Public API → API Key with rate limiting
// OAuth flow → Authorization Code with PKCE
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **GraphQL without DataLoader** | N+1 queries, slow resolvers, database overload | ALWAYS use DataLoader for batch loading in resolvers |
| **Over-engineering with GraphQL** | Simple CRUD API with 50 lines of schema, codegen, resolvers | Use REST for simple APIs; GraphQL adds value with complex data graphs |
| **REST without consistent error format** | Different error shapes across endpoints, fragile client parsing | Define and enforce a standard error response format |
| **tRPC for public APIs** | External consumers can't use tRPC (TypeScript-only) | REST for public APIs; tRPC only for internal TypeScript consumers |
| **GraphQL without query complexity limits** | Malicious deep queries crash server (nested 20 levels deep) | Set max depth, max complexity, and query cost analysis |
| **REST with verbs in URLs** | `/api/getUsers`, `/api/deleteUser/1` — not RESTful | Use HTTP methods + noun URLs: `GET /api/users`, `DELETE /api/users/1` |
| **Not versioning REST API** | Breaking changes affect all clients simultaneously | Version with URL path (`/api/v2/`) or content negotiation |
| **GraphQL over-fetching at resolver level** | Resolver loads full DB record even if query asks for one field | Use field-level resolvers or projection based on requested fields |
| **No input validation** | Invalid data reaches business logic, causing cryptic errors | Validate with Zod (tRPC), input types (GraphQL), or middleware (REST) |

---

## 8. Enforcement Checklist

### REST APIs
- [ ] Resources named as plural nouns (not verbs)
- [ ] Correct HTTP methods used (GET, POST, PUT, PATCH, DELETE)
- [ ] Appropriate status codes returned (not 200 for everything)
- [ ] Consistent error response format across all endpoints
- [ ] Pagination implemented (cursor-based preferred)
- [ ] API versioned (URL path or header)
- [ ] Rate limiting configured

### GraphQL APIs
- [ ] Schema designed with client needs in mind (not 1:1 with database)
- [ ] DataLoader used for ALL resolvers that access data sources
- [ ] Query depth and complexity limits configured
- [ ] Fragments used for reusable field selections
- [ ] Code generation configured (GraphQL Code Generator)
- [ ] Persisted queries used in production (security + performance)

### tRPC APIs
- [ ] Zod validation on ALL procedure inputs
- [ ] Procedures organized into domain routers
- [ ] Authentication middleware applied to protected routes
- [ ] Error handling with TRPCError (proper codes)
- [ ] Type inference working end-to-end (no manual type annotations)

### General
- [ ] Authentication strategy appropriate for use case
- [ ] CORS configured correctly (not `*` in production)
- [ ] Request/response logging in place
- [ ] API documentation maintained (OpenAPI/Swagger for REST)
