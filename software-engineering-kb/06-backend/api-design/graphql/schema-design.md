# Schema Design

> **Domain:** Backend > API > GraphQL
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-09

## What It Is

Schema Design in GraphQL is the process of defining the **type system** that describes the data and operations of the API using the **Schema Definition Language (SDL)**.

The schema is the **contract** between client and server that determines:
- What data can be requested
- How the data is structured
- What operations are available (queries, mutations, subscriptions)

## Why It Matters

1. **Type Safety:** Validation before execution, predictable responses
2. **Self-Documentation:** The schema serves as API documentation
3. **Tooling Support:** Auto-completion, validation, code generation
4. **Contract-First Development:** Frontend/Backend teams can work in parallel
5. **Schema Evolution:** Additive changes without breaking changes

## How It Works

### SDL (Schema Definition Language) Syntax

#### 1. Scalar Types

The built-in scalars of GraphQL:

```graphql
# Built-in Scalars
type Example {
  id: ID!              # Unique identifier (serialized as String)
  name: String!        # UTF-8 character sequence
  age: Int!            # 32-bit signed integer
  balance: Float!      # Signed double-precision floating-point value
  isActive: Boolean!   # true or false
}
```

#### 2. Object Types

The basic building blocks of the schema:

```graphql
type User {
  id: ID!
  username: String!
  email: String!
  profile: Profile
  posts: [Post!]!
  createdAt: DateTime!
}

type Profile {
  bio: String
  avatar: String
  website: String
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  tags: [String!]!
  published: Boolean!
}
```

#### 3. Interface Types

Share common fields between types:

```graphql
interface Node {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type User implements Node {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
  username: String!
  email: String!
}

type Post implements Node {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
  title: String!
  content: String!
}

# Query with interface
type Query {
  node(id: ID!): Node
}
```

#### 4. Union Types

Return one of multiple possible types:

```graphql
union SearchResult = User | Post | Comment

type Query {
  search(term: String!): [SearchResult!]!
}

# Query with union
query SearchContent {
  search(term: "graphql") {
    __typename
    ... on User {
      username
      email
    }
    ... on Post {
      title
      content
    }
    ... on Comment {
      text
      author {
        username
      }
    }
  }
}
```

#### 5. Enum Types

A restricted set of allowed values:

```graphql
enum UserRole {
  ADMIN
  MODERATOR
  USER
  GUEST
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

type User {
  id: ID!
  username: String!
  role: UserRole!
}

type Post {
  id: ID!
  title: String!
  status: PostStatus!
}

# Query with enum filter
type Query {
  users(role: UserRole): [User!]!
  posts(status: PostStatus): [Post!]!
}
```

#### 6. Input Types

For complex arguments in mutations:

```graphql
input CreateUserInput {
  username: String!
  email: String!
  password: String!
  profile: ProfileInput
}

input ProfileInput {
  bio: String
  avatar: String
  website: String
}

input UpdatePostInput {
  title: String
  content: String
  tags: [String!]
  status: PostStatus
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updatePost(id: ID!, input: UpdatePostInput!): Post!
}
```

### Naming Conventions

```graphql
# ✅ GOOD: Following conventions

# Types: PascalCase, singular
type User { ... }
type BlogPost { ... }

# Fields: camelCase
type User {
  id: ID!
  firstName: String!
  emailAddress: String!
  createdAt: DateTime!
}

# Enums: PascalCase (type), ALL_CAPS (values)
enum UserRole {
  ADMIN
  MODERATOR
  USER
}

# Input types: PascalCase with "Input" suffix
input CreateUserInput { ... }
input UpdateUserInput { ... }

# Query/Mutation names: camelCase, descriptive verbs
type Query {
  getUser(id: ID!): User
  listUsers: [User!]!
  searchPosts(term: String!): [Post!]!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}

# ❌ BAD: Inconsistent naming
type user { ... }                    # Should be PascalCase
type Users { ... }                   # Should be singular
type blog_post { ... }               # Use PascalCase, not snake_case

type User {
  ID: ID!                            # Should be camelCase
  first_name: String!                # Should be camelCase
  EmailAddress: String!              # Should be camelCase
}

enum user_role {                     # Should be PascalCase
  admin                              # Should be ALL_CAPS
  Moderator                          # Should be ALL_CAPS
}
```

### Nullability Strategy

GraphQL fields are **nullable by default**:

```graphql
type User {
  # Non-null fields (guaranteed to exist)
  id: ID!                    # Always present
  username: String!          # Always present
  email: String!             # Always present

  # Nullable fields (optional)
  bio: String                # Might be null
  website: String            # Might be null
  phone: String              # Might be null

  # Non-null list with non-null items
  posts: [Post!]!            # Always returns array (might be empty), items never null

  # Nullable list with non-null items
  favorited: [Post!]         # Might return null, but if array, items never null

  # Non-null list with nullable items
  tags: [String]!            # Always returns array, items might be null

  # Nullable list with nullable items
  metadata: [String]         # Might return null, items might be null
}
```

**Best Practices for Nullability:**

```typescript
// TypeScript Example
const typeDefs = `
  type Query {
    # ✅ GOOD: Nullable by default for fields that might not exist
    user(id: ID!): User

    # ✅ GOOD: Non-null for collections that always return (maybe empty)
    users: [User!]!

    # ❌ BAD: Don't make everything non-null
    user(id: ID!): User!  # What if user not found? Errors bubble up!
  }

  type User {
    # ✅ GOOD: Non-null for guaranteed fields
    id: ID!
    username: String!

    # ✅ GOOD: Nullable for optional fields
    bio: String
    website: String

    # ❌ BAD: Don't make optional data non-null
    phone: String!  # User might not have phone!
  }
`;
```

### Pagination Patterns: Relay Cursor-Based Connections

The **Relay Cursor Connections Specification** is the standard for pagination:

```graphql
# Core Connection Types
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type PostEdge {
  node: Post!
  cursor: String!
}

type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

# Query with pagination
type Query {
  posts(
    first: Int          # Forward pagination: get first N items
    after: String       # Forward pagination: cursor to start after
    last: Int           # Backward pagination: get last N items
    before: String      # Backward pagination: cursor to start before
  ): PostConnection!
}
```

**Example Usage:**

```graphql
# First page (forward pagination)
query FirstPage {
  posts(first: 10) {
    edges {
      node {
        id
        title
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

# Next page (using endCursor from previous)
query NextPage {
  posts(first: 10, after: "Y3Vyc29yOjEw") {
    edges {
      node {
        id
        title
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

# Last page (backward pagination)
query LastPage {
  posts(last: 10) {
    edges {
      node {
        id
        title
      }
      cursor
    }
    pageInfo {
      hasPreviousPage
      startCursor
    }
  }
}
```

**Implementation Example (TypeScript):**

```typescript
import { encodeCursor, decodeCursor } from './cursor-utils';

const resolvers = {
  Query: {
    posts: async (_, { first, after, last, before }, { db }) => {
      let query = db.post.findMany({
        orderBy: { createdAt: 'desc' }
      });

      let skip = 0;
      let take = first || last || 10;

      // Handle cursor-based pagination
      if (after) {
        const afterId = decodeCursor(after);
        skip = await db.post.count({
          where: { id: { lte: afterId } }
        });
      }

      if (before) {
        const beforeId = decodeCursor(before);
        // Adjust query for backward pagination
      }

      const posts = await query.skip(skip).take(take + 1);
      const hasMore = posts.length > take;
      const nodes = hasMore ? posts.slice(0, take) : posts;

      const edges = nodes.map(node => ({
        node,
        cursor: encodeCursor(node.id)
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: first ? hasMore : false,
          hasPreviousPage: Boolean(after || before),
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor
        },
        totalCount: await db.post.count()
      };
    }
  }
};

// Cursor utilities
function encodeCursor(id: string): string {
  return Buffer.from(`cursor:${id}`).toString('base64');
}

function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64').toString('utf-8').replace('cursor:', '');
}
```

### Custom Scalars

Creating custom scalar types for specialized data:

```graphql
# Schema definition
scalar DateTime
scalar URL
scalar Email
scalar JSON
scalar BigInt

type User {
  id: ID!
  email: Email!
  website: URL
  createdAt: DateTime!
  metadata: JSON
  balance: BigInt
}
```

**Implementation (TypeScript with graphql-scalars):**

```typescript
import { GraphQLDateTime, GraphQLURL, GraphQLJSON, GraphQLBigInt } from 'graphql-scalars';
import { GraphQLScalarType, Kind } from 'graphql';

// Using library scalars
const resolvers = {
  DateTime: GraphQLDateTime,
  URL: GraphQLURL,
  JSON: GraphQLJSON,
  BigInt: GraphQLBigInt,

  // Custom Email scalar
  Email: new GraphQLScalarType({
    name: 'Email',
    description: 'Email custom scalar type',
    serialize(value: unknown): string {
      if (typeof value !== 'string') {
        throw new Error('Email must be a string');
      }
      if (!isValidEmail(value)) {
        throw new Error('Invalid email format');
      }
      return value;
    },
    parseValue(value: unknown): string {
      if (typeof value !== 'string') {
        throw new Error('Email must be a string');
      }
      if (!isValidEmail(value)) {
        throw new Error('Invalid email format');
      }
      return value;
    },
    parseLiteral(ast): string {
      if (ast.kind !== Kind.STRING) {
        throw new Error('Email must be a string');
      }
      if (!isValidEmail(ast.value)) {
        throw new Error('Invalid email format');
      }
      return ast.value;
    }
  })
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

**Python Implementation (Strawberry):**

```python
import strawberry
from datetime import datetime
from typing import NewType

# Custom scalar for DateTime
DateTime = strawberry.scalar(
    NewType("DateTime", datetime),
    serialize=lambda v: v.isoformat(),
    parse_value=lambda v: datetime.fromisoformat(v)
)

# Custom scalar for Email
Email = strawberry.scalar(
    NewType("Email", str),
    serialize=lambda v: v,
    parse_value=lambda v: validate_email(v)
)

@strawberry.type
class User:
    id: strawberry.ID
    email: Email
    created_at: DateTime

def validate_email(value: str) -> str:
    import re
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', value):
        raise ValueError('Invalid email format')
    return value
```

### Schema Evolution

GraphQL prefers **additive changes** and **deprecation** instead of versioning:

```graphql
type User {
  id: ID!
  username: String!
  email: String!

  # ✅ GOOD: Adding new fields (non-breaking)
  phone: String
  bio: String

  # ✅ GOOD: Deprecating old fields
  fullName: String @deprecated(reason: "Use firstName and lastName instead")
  firstName: String!
  lastName: String!

  # ❌ BAD: Removing fields (breaking change!)
  # oldField: String  # DON'T REMOVE!
}

type Query {
  # ✅ GOOD: Adding new queries (non-breaking)
  users: [User!]!
  user(id: ID!): User

  # ✅ GOOD: Deprecating old queries
  getUser(id: ID!): User @deprecated(reason: "Use user(id:) instead")

  # ✅ GOOD: Adding optional arguments (non-breaking)
  posts(status: PostStatus, authorId: ID): [Post!]!
}

type Mutation {
  # ❌ BAD: Adding required arguments (breaking change!)
  # createUser(username: String!, email: String!, newRequiredField: String!): User!

  # ✅ GOOD: Making new arguments optional
  createUser(username: String!, email: String!, phone: String): User!
}
```

**Evolution Best Practices:**

1. **Never remove fields** - Use `@deprecated` instead
2. **Never change field types** - Add new field with new name
3. **Never add required arguments** - Always make new args optional
4. **Monitor deprecated usage** before removal
5. **Additive changes only** for backward compatibility

**Tracking Deprecations:**

```typescript
import { GraphQLSchema } from 'graphql';

function findDeprecatedFields(schema: GraphQLSchema) {
  const deprecated = [];

  const typeMap = schema.getTypeMap();
  Object.keys(typeMap).forEach(typeName => {
    const type = typeMap[typeName];
    if ('getFields' in type) {
      const fields = type.getFields();
      Object.keys(fields).forEach(fieldName => {
        const field = fields[fieldName];
        if (field.deprecationReason) {
          deprecated.push({
            type: typeName,
            field: fieldName,
            reason: field.deprecationReason
          });
        }
      });
    }
  });

  return deprecated;
}
```

## Best Practices

### 1. Design Schema Around Client Needs

```graphql
# ❌ BAD: Database-driven schema
type User {
  id: ID!
  user_name: String!
  email_address: String!
  created_at: String!
  updated_at: String!
}

# ✅ GOOD: Client-driven schema
type User {
  id: ID!
  username: String!
  email: String!
  profile: UserProfile!
  statistics: UserStatistics!
}

type UserProfile {
  displayName: String!
  avatar: String
  bio: String
}

type UserStatistics {
  postCount: Int!
  followerCount: Int!
  joinedAt: DateTime!
}
```

### 2. Use Connection Pattern for Lists

```graphql
# ❌ BAD: Simple array
type Query {
  posts: [Post!]!
}

# ✅ GOOD: Connection pattern with pagination
type Query {
  posts(first: Int, after: String): PostConnection!
}

type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}
```

### 3. Provide Rich Error Information

```graphql
# Instead of Boolean returns, return structured data
type Mutation {
  # ❌ BAD
  deletePost(id: ID!): Boolean!

  # ✅ GOOD
  deletePost(id: ID!): DeletePostPayload!
}

type DeletePostPayload {
  success: Boolean!
  post: Post
  errors: [Error!]
}

type Error {
  message: String!
  code: String!
  field: String
}
```

### 4. Document Your Schema

```graphql
"""
Represents a user in the system.
Users can create posts, follow other users, and interact with content.
"""
type User {
  "Unique identifier for the user"
  id: ID!

  "Username must be unique and between 3-20 characters"
  username: String!

  "Email address for the user (must be verified)"
  email: String!

  "User's profile information"
  profile: Profile

  "Posts created by this user"
  posts(
    "Filter posts by status"
    status: PostStatus
    "Number of posts to return (max 100)"
    first: Int
  ): PostConnection!
}
```

### 5. Use Input Types for Mutations

```graphql
# ❌ BAD: Many arguments
type Mutation {
  createPost(
    title: String!,
    content: String!,
    excerpt: String,
    tags: [String!],
    status: PostStatus
  ): Post!
}

# ✅ GOOD: Input type
type Mutation {
  createPost(input: CreatePostInput!): Post!
}

input CreatePostInput {
  title: String!
  content: String!
  excerpt: String
  tags: [String!]
  status: PostStatus
}
```

## Anti-patterns / Common Mistakes

### ❌ 1. Over-Nesting

```graphql
# BAD: Too deeply nested
type Query {
  data: Data
}

type Data {
  users: Users
}

type Users {
  list: UserList
}

type UserList {
  items: [User!]!
}

# GOOD: Flat structure
type Query {
  users: [User!]!
}
```

### ❌ 2. God Objects

```graphql
# BAD: One massive type
type User {
  id: ID!
  username: String!
  email: String!
  bio: String
  avatar: String
  postCount: Int!
  followerCount: Int!
  followingCount: Int!
  lastLoginAt: DateTime!
  preferences: JSON!
  # ... 50 more fields
}

# GOOD: Split into logical groupings
type User {
  id: ID!
  username: String!
  email: String!
  profile: UserProfile!
  statistics: UserStatistics!
  settings: UserSettings!
}
```

### ❌ 3. Exposing Implementation Details

```graphql
# BAD: Exposing database structure
type Post {
  id: ID!
  user_id: ID!           # Database column name
  created_at: String!    # Database column name
  is_deleted: Boolean!   # Implementation detail
}

# GOOD: Clean API design
type Post {
  id: ID!
  author: User!
  createdAt: DateTime!
  status: PostStatus!
}
```

### ❌ 4. Not Using Enums

```graphql
# BAD: String for status
type Post {
  status: String!  # Could be any string!
}

# GOOD: Enum for fixed values
enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

type Post {
  status: PostStatus!
}
```

## Real-world Examples

### Complete Schema Example

```graphql
# Scalars
scalar DateTime
scalar URL
scalar Email

# Enums
enum UserRole {
  ADMIN
  MODERATOR
  USER
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

# Interfaces
interface Node {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
}

interface Timestamped {
  createdAt: DateTime!
  updatedAt: DateTime!
}

# Types
type User implements Node & Timestamped {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
  username: String!
  email: Email!
  role: UserRole!
  profile: UserProfile!
  posts(first: Int, after: String, status: PostStatus): PostConnection!
  followers(first: Int, after: String): UserConnection!
}

type UserProfile {
  displayName: String!
  bio: String
  avatar: URL
  website: URL
  location: String
}

type Post implements Node & Timestamped {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
  title: String!
  content: String!
  excerpt: String
  slug: String!
  status: PostStatus!
  author: User!
  tags: [Tag!]!
  comments(first: Int, after: String): CommentConnection!
  likeCount: Int!
  viewCount: Int!
}

type Tag {
  id: ID!
  name: String!
  slug: String!
  postCount: Int!
}

type Comment implements Node & Timestamped {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
  content: String!
  author: User!
  post: Post!
  parent: Comment
  replies(first: Int, after: String): CommentConnection!
}

# Connections (Relay spec)
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type PostEdge {
  node: Post!
  cursor: String!
}

type CommentConnection {
  edges: [CommentEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type CommentEdge {
  node: Comment!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Inputs
input CreateUserInput {
  username: String!
  email: Email!
  password: String!
  profile: UserProfileInput
}

input UserProfileInput {
  displayName: String!
  bio: String
  avatar: URL
  website: URL
}

input UpdateUserInput {
  username: String
  email: Email
  profile: UserProfileInput
}

input CreatePostInput {
  title: String!
  content: String!
  excerpt: String
  status: PostStatus
  tags: [String!]
}

input UpdatePostInput {
  title: String
  content: String
  excerpt: String
  status: PostStatus
  tags: [String!]
}

# Unions
union SearchResult = User | Post | Tag

# Queries
type Query {
  # Node interface
  node(id: ID!): Node

  # Users
  user(id: ID, username: String): User
  users(first: Int, after: String, role: UserRole): UserConnection!
  me: User

  # Posts
  post(id: ID, slug: String): Post
  posts(first: Int, after: String, status: PostStatus, authorId: ID): PostConnection!

  # Search
  search(term: String!, first: Int, after: String): [SearchResult!]!

  # Tags
  tags(first: Int, after: String): [Tag!]!
  tag(id: ID, slug: String): Tag
}

# Mutations
type Mutation {
  # Auth
  register(input: CreateUserInput!): AuthPayload!
  login(email: Email!, password: String!): AuthPayload!
  logout: Boolean!

  # Users
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): DeleteUserPayload!
  followUser(userId: ID!): User!
  unfollowUser(userId: ID!): User!

  # Posts
  createPost(input: CreatePostInput!): Post!
  updatePost(id: ID!, input: UpdatePostInput!): Post!
  deletePost(id: ID!): DeletePostPayload!
  publishPost(id: ID!): Post!
  likePost(postId: ID!): Post!

  # Comments
  createComment(postId: ID!, content: String!, parentId: ID): Comment!
  updateComment(id: ID!, content: String!): Comment!
  deleteComment(id: ID!): DeleteCommentPayload!
}

# Subscriptions
type Subscription {
  postPublished: Post!
  commentAdded(postId: ID!): Comment!
  userOnline(userId: ID!): User!
}

# Payloads
type AuthPayload {
  token: String!
  user: User!
}

type DeleteUserPayload {
  success: Boolean!
  deletedUserId: ID
  errors: [Error!]
}

type DeletePostPayload {
  success: Boolean!
  deletedPostId: ID
  errors: [Error!]
}

type DeleteCommentPayload {
  success: Boolean!
  deletedCommentId: ID
  errors: [Error!]
}

type Error {
  message: String!
  code: String!
  field: String
}
```

## Sources

- [GraphQL Schema Design Guide](https://graphql.org/learn/schema/)
- [SDL Syntax Reference](https://www.apollographql.com/tutorials/lift-off-part1/03-schema-definition-language-sdl)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [Relay Cursor Connections Specification](https://relay.dev/graphql/connections.htm)
- [Schema Design Best Practices - Apollo](https://www.apollographql.com/docs/apollo-server/schema/schema)
- [GraphQL Naming Conventions](https://github.com/hendrikniemann/graphql-style-guide)
- [Nullability Best Practices](https://www.apollographql.com/blog/using-nullability-in-graphql)
- [Custom Scalars - graphql-scalars](https://the-guild.dev/graphql/scalars/docs/quick-start)
- [Schema Evolution Guide](https://www.apollographql.com/docs/graphos/schema-design/guides/deprecations)
