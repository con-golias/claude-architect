# GraphQL Security

Category: Application Security / API Security
Severity: Critical
Last Updated: 2025-12
Tags: graphql, query-complexity, introspection, authorization, batching

---

## Overview

GraphQL provides clients with the power to request exactly the data they need, but this flexibility introduces unique security risks not found in REST APIs. Clients can craft deeply nested queries that exhaust server resources, abuse introspection to map the entire schema, bypass field-level authorization, and use batching to amplify attacks. This guide covers every critical GraphQL security control with practical implementations.

---

## Introspection Control

### Disable Introspection in Production

GraphQL introspection allows anyone to query the full schema, including types, fields, arguments, and descriptions. This is invaluable during development but must be disabled in production to prevent attackers from mapping your API surface.

**TypeScript (Apollo Server)**:

```typescript
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginInlineTrace } from '@apollo/server/plugin/inlineTrace';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production',
  plugins: [
    // Custom plugin to block introspection queries
    {
      async requestDidStart() {
        return {
          async didResolveOperation(requestContext) {
            if (process.env.NODE_ENV === 'production') {
              const query = requestContext.request.query || '';
              if (query.includes('__schema') || query.includes('__type')) {
                throw new GraphQLError('Introspection is disabled', {
                  extensions: { code: 'INTROSPECTION_DISABLED' },
                });
              }
            }
          },
        };
      },
    },
  ],
});
```

**Go (gqlgen)**:

```go
// Disable introspection in production using middleware
func introspectionMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if os.Getenv("ENV") == "production" {
            body, _ := io.ReadAll(r.Body)
            r.Body = io.NopCloser(bytes.NewBuffer(body))

            if strings.Contains(string(body), "__schema") ||
               strings.Contains(string(body), "__type") {
                w.WriteHeader(http.StatusBadRequest)
                json.NewEncoder(w).Encode(map[string]string{
                    "error": "Introspection is disabled",
                })
                return
            }
        }
        next.ServeHTTP(w, r)
    })
}

// In gqlgen config, set introspection based on environment
srv := handler.NewDefaultServer(generated.NewExecutableSchema(generated.Config{
    Resolvers: &resolver.Resolver{},
}))

if os.Getenv("ENV") == "production" {
    srv.AroundOperations(func(ctx context.Context, next graphql.OperationHandler) graphql.ResponseHandler {
        oc := graphql.GetOperationContext(ctx)
        // Block introspection
        if oc.OperationName == "IntrospectionQuery" {
            return func(ctx context.Context) *graphql.Response {
                return graphql.ErrorResponse(ctx, "introspection disabled")
            }
        }
        return next(ctx)
    })
}
```

**Python (Strawberry)**:

```python
import strawberry
from strawberry.extensions import SchemaExtension

class DisableIntrospection(SchemaExtension):
    def on_operation(self):
        if settings.ENVIRONMENT == "production":
            query = self.execution_context.query
            if "__schema" in query or "__type" in query:
                raise Exception("Introspection is disabled in production")
        yield

schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    extensions=[DisableIntrospection],
)
```

---

## Query Depth Limiting

Deeply nested queries can cause exponential database load. Limit the maximum depth of any query.

**Attack Query Example**:

```graphql
# Deeply nested query that could cause exponential joins
query MaliciousDeep {
  users {
    posts {
      comments {
        author {
          posts {
            comments {
              author {
                posts {
                  # ... continues nesting
                }
              }
            }
          }
        }
      }
    }
  }
}
```

**TypeScript (Apollo Server with graphql-depth-limit)**:

```typescript
import depthLimit from 'graphql-depth-limit';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [depthLimit(5)], // Maximum depth of 5 levels
});
```

**Custom depth limiter (TypeScript)**:

```typescript
import { ValidationContext, ASTVisitor, GraphQLError } from 'graphql';

function createDepthLimitRule(maxDepth: number) {
  return function depthLimitRule(context: ValidationContext): ASTVisitor {
    return {
      Field: {
        enter(node, key, parent, path, ancestors) {
          const depth = ancestors.filter(
            (ancestor) => (ancestor as any).kind === 'Field',
          ).length;

          if (depth > maxDepth) {
            context.reportError(
              new GraphQLError(
                `Query depth of ${depth} exceeds maximum allowed depth of ${maxDepth}`,
                { nodes: [node] },
              ),
            );
          }
        },
      },
    };
  };
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [createDepthLimitRule(5)],
});
```

**Go (gqlgen)**:

```go
import "github.com/99designs/gqlgen/graphql/handler/extension"

srv := handler.NewDefaultServer(generated.NewExecutableSchema(cfg))
srv.Use(extension.FixedComplexityLimit(100))

// Custom depth limit
srv.AroundOperations(func(ctx context.Context, next graphql.OperationHandler) graphql.ResponseHandler {
    oc := graphql.GetOperationContext(ctx)
    depth := calculateDepth(oc.Doc)
    if depth > 5 {
        return func(ctx context.Context) *graphql.Response {
            return graphql.ErrorResponse(ctx, "query too deep: max depth is 5")
        }
    }
    return next(ctx)
})

func calculateDepth(doc *ast.QueryDocument) int {
    maxDepth := 0
    for _, op := range doc.Operations {
        d := selectionSetDepth(op.SelectionSet, 0)
        if d > maxDepth {
            maxDepth = d
        }
    }
    return maxDepth
}

func selectionSetDepth(ss ast.SelectionSet, current int) int {
    if len(ss) == 0 {
        return current
    }
    max := current
    for _, sel := range ss {
        if field, ok := sel.(*ast.Field); ok {
            d := selectionSetDepth(field.SelectionSet, current+1)
            if d > max {
                max = d
            }
        }
    }
    return max
}
```

---

## Query Complexity Analysis and Cost Limiting

Depth alone is insufficient. A wide query at depth 2 can be more expensive than a narrow query at depth 10. Assign costs to fields and limit total query complexity.

**TypeScript (Apollo Server with custom complexity)**:

```typescript
import { getComplexity, simpleEstimator, fieldExtensionsEstimator } from 'graphql-query-complexity';

const MAX_COMPLEXITY = 1000;

const complexityPlugin = {
  async requestDidStart() {
    return {
      async didResolveOperation({ request, document, schema }) {
        const complexity = getComplexity({
          schema,
          operationName: request.operationName,
          query: document,
          variables: request.variables,
          estimators: [
            fieldExtensionsEstimator(),
            simpleEstimator({ defaultComplexity: 1 }),
          ],
        });

        if (complexity > MAX_COMPLEXITY) {
          throw new GraphQLError(
            `Query complexity ${complexity} exceeds maximum ${MAX_COMPLEXITY}`,
            { extensions: { code: 'QUERY_TOO_COMPLEX', complexity } },
          );
        }
      },
    };
  },
};

// Define complexity in type definitions
const typeDefs = gql`
  type Query {
    users(first: Int = 10): [User!]! @complexity(value: 5, multipliers: ["first"])
    user(id: ID!): User @complexity(value: 1)
  }

  type User {
    id: ID!
    name: String!
    posts(first: Int = 10): [Post!]! @complexity(value: 3, multipliers: ["first"])
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    comments(first: Int = 10): [Comment!]! @complexity(value: 3, multipliers: ["first"])
  }
`;
```

**Python (Strawberry with custom complexity)**:

```python
import strawberry
from strawberry.extensions import QueryDepthLimiter

class ComplexityExtension(SchemaExtension):
    MAX_COMPLEXITY = 1000

    FIELD_COSTS = {
        "Query.users": 5,
        "Query.user": 1,
        "User.posts": 3,
        "Post.comments": 3,
    }

    def on_operation(self):
        complexity = self._calculate_complexity(self.execution_context)
        if complexity > self.MAX_COMPLEXITY:
            raise Exception(
                f"Query complexity {complexity} exceeds maximum {self.MAX_COMPLEXITY}"
            )
        yield

    def _calculate_complexity(self, context) -> int:
        # Walk the AST and sum field costs
        doc = context.graphql_document
        total = 0
        for definition in doc.definitions:
            if hasattr(definition, "selection_set"):
                total += self._selection_cost(definition.selection_set, "Query")
        return total

    def _selection_cost(self, selection_set, parent_type: str) -> int:
        if not selection_set:
            return 0
        cost = 0
        for selection in selection_set.selections:
            field_name = f"{parent_type}.{selection.name.value}"
            field_cost = self.FIELD_COSTS.get(field_name, 1)

            # Check for multiplier arguments (first, limit)
            for arg in (selection.arguments or []):
                if arg.name.value in ("first", "limit", "last"):
                    field_cost *= int(arg.value.value)

            cost += field_cost
            if selection.selection_set:
                cost += self._selection_cost(
                    selection.selection_set,
                    selection.name.value.capitalize(),
                )
        return cost

schema = strawberry.Schema(
    query=Query,
    extensions=[ComplexityExtension, QueryDepthLimiter(max_depth=5)],
)
```

---

## Batching Attack Prevention

GraphQL allows sending multiple operations in a single HTTP request. Attackers abuse this to bypass rate limiting, brute-force authentication, or amplify denial-of-service attacks.

**Attack Example**:

```json
[
  { "query": "mutation { login(email: \"user@x.com\", password: \"pass1\") { token } }" },
  { "query": "mutation { login(email: \"user@x.com\", password: \"pass2\") { token } }" },
  { "query": "mutation { login(email: \"user@x.com\", password: \"pass3\") { token } }" }
]
```

**TypeScript (Apollo Server -- limit batching)**:

```typescript
const server = new ApolloServer({
  typeDefs,
  resolvers,
  allowBatchedHttpRequests: false, // Disable batching entirely
});

// Or limit batch size if batching is needed
const batchLimitPlugin = {
  async requestDidStart({ request }) {
    // This runs per operation in a batch, but we check at the HTTP level
  },
  async serverWillStart() {
    return {
      async renderLandingPage() { return null; },
    };
  },
};

// Express middleware to limit batch size
app.use('/graphql', (req, res, next) => {
  if (Array.isArray(req.body)) {
    if (req.body.length > 5) {
      return res.status(400).json({
        error: 'Batch size exceeds maximum of 5 operations',
      });
    }
  }
  next();
});
```

**Alias-based batching prevention**:

```typescript
// Prevent alias-based batching: sending the same field multiple times with aliases
// query { a1: login(...) a2: login(...) a3: login(...) }
function aliasLimitRule(maxAliases: number) {
  return function (context: ValidationContext): ASTVisitor {
    return {
      OperationDefinition(node) {
        const aliasCounts = new Map<string, number>();
        function countAliases(selectionSet: any) {
          for (const selection of selectionSet?.selections || []) {
            if (selection.kind === 'Field') {
              const fieldName = selection.name.value;
              const count = (aliasCounts.get(fieldName) || 0) + 1;
              aliasCounts.set(fieldName, count);
              if (count > maxAliases) {
                context.reportError(
                  new GraphQLError(
                    `Field "${fieldName}" used ${count} times (max: ${maxAliases})`,
                  ),
                );
              }
              if (selection.selectionSet) countAliases(selection.selectionSet);
            }
          }
        }
        countAliases(node.selectionSet);
      },
    };
  };
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [aliasLimitRule(3)],
});
```

---

## Field-Level Authorization

### Using graphql-shield (TypeScript)

```typescript
import { shield, rule, and, or, not } from 'graphql-shield';

const isAuthenticated = rule()((parent, args, context) => {
  return context.user !== null;
});

const isAdmin = rule()((parent, args, context) => {
  return context.user?.role === 'admin';
});

const isOwner = rule()((parent, args, context) => {
  return parent.authorId === context.user?.id;
});

const permissions = shield({
  Query: {
    users: isAdmin,
    user: isAuthenticated,
    publicPosts: true,  // Allow all
  },
  Mutation: {
    createPost: isAuthenticated,
    updatePost: and(isAuthenticated, isOwner),
    deletePost: or(isAdmin, and(isAuthenticated, isOwner)),
    deleteUser: isAdmin,
  },
  User: {
    email: or(isAdmin, isOwner),
    // id and name are accessible to all authenticated users
  },
  Post: {
    '*': isAuthenticated,
    // All post fields require authentication
  },
}, {
  fallbackRule: isAuthenticated,
  fallbackError: new GraphQLError('Not authorized', {
    extensions: { code: 'FORBIDDEN' },
  }),
});
```

### Go (gqlgen directive-based authorization)

```go
// schema.graphql
// directive @auth(requires: Role!) on FIELD_DEFINITION
// enum Role { ADMIN USER }

// Resolver middleware in gqlgen
func authDirective(ctx context.Context, obj interface{}, next graphql.Resolver, requires model.Role) (interface{}, error) {
    user := auth.GetUserFromContext(ctx)
    if user == nil {
        return nil, fmt.Errorf("access denied: not authenticated")
    }

    switch requires {
    case model.RoleAdmin:
        if user.Role != "admin" {
            return nil, fmt.Errorf("access denied: admin required")
        }
    case model.RoleUser:
        // Any authenticated user
    }

    return next(ctx)
}

// In server setup
cfg := generated.Config{Resolvers: &resolver.Resolver{}}
cfg.Directives.Auth = authDirective
```

### Python (Strawberry permission classes)

```python
import strawberry
from strawberry.permission import BasePermission
from strawberry.types import Info

class IsAuthenticated(BasePermission):
    message = "User is not authenticated"

    def has_permission(self, source, info: Info, **kwargs) -> bool:
        return info.context.user is not None

class IsAdmin(BasePermission):
    message = "Admin access required"

    def has_permission(self, source, info: Info, **kwargs) -> bool:
        user = info.context.user
        return user is not None and user.role == "admin"

class IsOwner(BasePermission):
    message = "You can only access your own data"

    def has_permission(self, source, info: Info, **kwargs) -> bool:
        user = info.context.user
        if user is None:
            return False
        # 'source' is the parent object
        return hasattr(source, 'author_id') and source.author_id == user.id

@strawberry.type
class Query:
    @strawberry.field(permission_classes=[IsAuthenticated])
    def me(self, info: Info) -> User:
        return info.context.user

    @strawberry.field(permission_classes=[IsAdmin])
    def users(self, info: Info) -> list[User]:
        return UserService.get_all()

@strawberry.type
class User:
    id: strawberry.ID
    name: str

    @strawberry.field(permission_classes=[IsOwner, IsAdmin])
    def email(self) -> str:
        return self._email

    @strawberry.field(permission_classes=[IsAdmin])
    def role(self) -> str:
        return self._role
```

---

## N+1 Query Abuse Prevention

N+1 query problems are not just a performance issue -- they are a security issue. An attacker can craft queries that trigger thousands of database queries.

**TypeScript (DataLoader pattern)**:

```typescript
import DataLoader from 'dataloader';

// Create DataLoaders per request to prevent cache leaks between users
function createLoaders(userId: string) {
  return {
    userLoader: new DataLoader<string, User>(async (ids) => {
      const users = await db.users.find({ _id: { $in: ids } }).toArray();
      const userMap = new Map(users.map(u => [u._id, u]));
      return ids.map(id => userMap.get(id) || null);
    }, {
      maxBatchSize: 100, // Prevent unbounded batch sizes
    }),

    postLoader: new DataLoader<string, Post[]>(async (authorIds) => {
      // Only load posts the requesting user is authorized to see
      const posts = await db.posts.find({
        authorId: { $in: authorIds },
        $or: [
          { visibility: 'public' },
          { authorId: userId },
        ],
      }).toArray();

      const grouped = new Map<string, Post[]>();
      for (const post of posts) {
        const list = grouped.get(post.authorId) || [];
        list.push(post);
        grouped.set(post.authorId, list);
      }
      return authorIds.map(id => grouped.get(id) || []);
    }, {
      maxBatchSize: 50,
    }),
  };
}

// Create fresh loaders per request
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => ({
    user: req.user,
    loaders: createLoaders(req.user?.id),
  }),
});
```

---

## Persisted / Allowlisted Queries

For maximum security, only allow pre-registered queries in production. This eliminates all query injection and complexity attacks.

**TypeScript (Apollo Server with Automatic Persisted Queries)**:

```typescript
import { ApolloServer } from '@apollo/server';

// Strict mode: ONLY persisted queries allowed in production
const persistedQueries = new Map<string, string>([
  ['abc123', '{ me { id name email } }'],
  ['def456', 'query GetPost($id: ID!) { post(id: $id) { id title content } }'],
  ['ghi789', 'mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { id } }'],
]);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [{
    async requestDidStart({ request }) {
      if (process.env.NODE_ENV === 'production') {
        const hash = request.extensions?.persistedQuery?.sha256Hash;
        if (!hash || !persistedQueries.has(hash)) {
          throw new GraphQLError('Only persisted queries are allowed', {
            extensions: { code: 'PERSISTED_QUERY_ONLY' },
          });
        }
        // Replace query with the registered version
        request.query = persistedQueries.get(hash);
      }
      return {};
    },
  }],
});
```

**Go (gqlgen with allowlisted queries)**:

```go
var allowedQueries = map[string]string{
    "sha256hash1": `query GetUser($id: ID!) { user(id: $id) { id name } }`,
    "sha256hash2": `query ListPosts { posts { id title } }`,
}

srv.AroundOperations(func(ctx context.Context, next graphql.OperationHandler) graphql.ResponseHandler {
    oc := graphql.GetOperationContext(ctx)

    if os.Getenv("ENV") == "production" {
        hash := sha256Hash(oc.RawQuery)
        if _, ok := allowedQueries[hash]; !ok {
            return func(ctx context.Context) *graphql.Response {
                return graphql.ErrorResponse(ctx, "query not in allowlist")
            }
        }
    }

    return next(ctx)
})
```

---

## Error Masking

GraphQL errors can leak schema details, database structure, and internal implementation details. Mask all errors in production.

**TypeScript (Apollo Server)**:

```typescript
const server = new ApolloServer({
  typeDefs,
  resolvers,
  formatError: (formattedError, error) => {
    // Log the full error internally
    logger.error({
      message: formattedError.message,
      path: formattedError.path,
      stack: error instanceof Error ? error.stack : undefined,
      errorId: crypto.randomUUID(),
    });

    // In production, mask unexpected errors
    if (process.env.NODE_ENV === 'production') {
      // Allow known, safe error codes through
      const safeErrorCodes = [
        'VALIDATION_ERROR',
        'NOT_FOUND',
        'FORBIDDEN',
        'UNAUTHENTICATED',
        'BAD_USER_INPUT',
      ];

      const code = formattedError.extensions?.code as string;
      if (safeErrorCodes.includes(code)) {
        return formattedError;
      }

      // Mask everything else
      return {
        message: 'An unexpected error occurred',
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      };
    }

    return formattedError;
  },
});
```

**Python (Ariadne)**:

```python
from ariadne import format_error

def custom_error_formatter(error, debug=False):
    formatted = format_error(error, debug)

    if not debug:
        safe_codes = {"VALIDATION_ERROR", "NOT_FOUND", "FORBIDDEN", "UNAUTHENTICATED"}
        code = formatted.get("extensions", {}).get("code", "")

        if code not in safe_codes:
            error_id = str(uuid4())
            logger.error(f"GraphQL error {error_id}: {error}")
            return {
                "message": "An unexpected error occurred",
                "extensions": {"code": "INTERNAL_SERVER_ERROR", "errorId": error_id},
            }

    return formatted

app = GraphQL(schema, error_formatter=custom_error_formatter)
```

---

## CSRF Protection in GraphQL

GraphQL endpoints typically use POST for all operations, which means they are vulnerable to CSRF if cookie-based authentication is used.

```typescript
// Require a custom header for all GraphQL requests
// Browsers cannot set custom headers in cross-origin simple requests
app.use('/graphql', (req, res, next) => {
  // Require the custom header that simple CORS requests cannot include
  if (req.method === 'POST') {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }

    // Additional CSRF token check if using cookies
    if (req.cookies?.session) {
      const csrfToken = req.headers['x-csrf-token'];
      if (!csrfToken || csrfToken !== req.cookies.csrfToken) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }
    }
  }
  next();
});
```

---

## File Upload Security

GraphQL file uploads via the `graphql-upload` package introduce additional risks.

```typescript
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';
import processUpload from 'graphql-upload/processRequest.mjs';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 5;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const resolvers = {
  Upload: GraphQLUpload,

  Mutation: {
    async uploadFile(parent, { file }, context) {
      if (!context.user) throw new GraphQLError('Authentication required');

      const { createReadStream, filename, mimetype, encoding } = await file;

      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
        throw new GraphQLError(`File type ${mimetype} is not allowed`);
      }

      // Validate filename (prevent path traversal)
      const sanitizedFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');

      // Read with size limit
      const stream = createReadStream();
      let size = 0;
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        size += chunk.length;
        if (size > MAX_FILE_SIZE) {
          stream.destroy();
          throw new GraphQLError(`File exceeds maximum size of ${MAX_FILE_SIZE} bytes`);
        }
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      // Validate file content matches declared MIME type (magic bytes)
      const actualType = await detectFileType(buffer);
      if (actualType !== mimetype) {
        throw new GraphQLError('File content does not match declared type');
      }

      // Store in object storage, not local filesystem
      const key = `uploads/${context.user.id}/${crypto.randomUUID()}/${sanitizedFilename}`;
      await s3.putObject({ Bucket: 'uploads', Key: key, Body: buffer });

      return { url: `https://cdn.example.com/${key}`, filename: sanitizedFilename };
    },
  },
};
```

---

## Subscription Authorization

WebSocket-based GraphQL subscriptions must authenticate and authorize at connection time and per-subscription.

```typescript
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';

const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

useServer({
  schema,
  context: async (ctx) => {
    // Authenticate at connection time
    const token = ctx.connectionParams?.authorization as string;
    if (!token) throw new Error('Missing authentication');

    const user = await validateToken(token);
    if (!user) throw new Error('Invalid token');

    return { user };
  },
  onSubscribe: async (ctx, msg) => {
    // Authorize per subscription
    const user = ctx.extra?.user;
    const operationName = msg.payload.operationName;

    // Check if user has permission for this subscription
    if (operationName === 'AdminNotifications' && user.role !== 'admin') {
      return [new GraphQLError('Not authorized for admin subscriptions')];
    }

    // Validate subscription arguments
    if (msg.payload.variables?.channelId) {
      const hasAccess = await checkChannelAccess(user.id, msg.payload.variables.channelId);
      if (!hasAccess) {
        return [new GraphQLError('Not authorized for this channel')];
      }
    }
  },
  onNext: async (ctx, msg, args, result) => {
    // Filter subscription results per user authorization
    // This ensures users only receive data they are authorized to see
  },
}, wsServer);
```

---

## Rate Limiting by Query Complexity

Standard request-based rate limiting is insufficient for GraphQL because a single request can have vastly different costs. Rate limit by computed query complexity.

```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';

const redis = new Redis();

const complexityLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'gql_complexity',
  points: 10000,        // 10,000 complexity points per window
  duration: 60,          // Per minute
});

const rateLimitPlugin = {
  async requestDidStart({ context }) {
    return {
      async didResolveOperation({ request, document, schema, context }) {
        const complexity = getComplexity({
          schema,
          query: document,
          variables: request.variables,
          estimators: [fieldExtensionsEstimator(), simpleEstimator({ defaultComplexity: 1 })],
        });

        try {
          await complexityLimiter.consume(
            context.user?.id || context.ip,
            complexity,
          );
        } catch (rateLimiterRes) {
          throw new GraphQLError('Rate limit exceeded', {
            extensions: {
              code: 'RATE_LIMITED',
              retryAfter: Math.ceil(rateLimiterRes.msBeforeNext / 1000),
            },
          });
        }
      },
    };
  },
};
```

---

## Using graphql-armor

graphql-armor provides a comprehensive set of protections as a single package.

```typescript
import { ApolloArmor } from '@escape.tech/graphql-armor';

const armor = ApolloArmor({
  maxDepth: {
    n: 6,                   // Maximum query depth
    propagateOnRejection: true,
  },
  maxAliases: {
    n: 5,                   // Maximum aliases per query
    propagateOnRejection: true,
  },
  maxDirectives: {
    n: 10,                  // Maximum directives per query
    propagateOnRejection: true,
  },
  maxTokens: {
    n: 1000,                // Maximum tokens in query document
    propagateOnRejection: true,
  },
  costLimit: {
    maxCost: 5000,          // Maximum query cost
    objectCost: 2,
    scalarCost: 1,
    depthCostFactor: 1.5,
    propagateOnRejection: true,
  },
  blockFieldSuggestion: {
    enabled: true,          // Do not suggest field names in errors
  },
  characterLimit: {
    maxLength: 15000,       // Maximum query string length
  },
});

const server = new ApolloServer({
  typeDefs,
  resolvers,
  ...armor.protect(),
});
```

---

## Best Practices

1. **Disable introspection in production** -- Never expose your full schema to potential attackers. Use build-time schema extraction for client tooling.

2. **Enforce query depth and complexity limits** -- Set maximum depth (5-7 levels) and complexity budgets (scale based on your infrastructure capacity).

3. **Use persisted queries in production** -- Register all allowed queries at build time. Reject ad-hoc queries to eliminate injection and complexity attacks.

4. **Implement field-level authorization** -- Use graphql-shield, directives, or permission classes to enforce access control on every field, not just root queries.

5. **Prevent batching abuse** -- Disable batching or limit batch size. Also limit alias-based batching within a single query.

6. **Use DataLoaders with authorization awareness** -- DataLoaders must respect the requesting user's permissions. Create per-request loaders to prevent cross-user cache leaks.

7. **Mask errors in production** -- Return generic error messages for unexpected errors. Log full details server-side with correlation IDs.

8. **Authenticate subscriptions at connection time** -- Validate tokens during the WebSocket handshake and re-validate when subscriptions are initiated.

9. **Rate limit by query complexity, not just request count** -- A simple query and a complex query should consume different rate limit budgets.

10. **Validate and sanitize file uploads** -- Check MIME types, file sizes, and actual file content (magic bytes). Store files in object storage, never on the application server filesystem.

---

## Anti-Patterns

1. **Leaving introspection enabled in production** -- Gives attackers a complete map of your API, including types, relationships, and field descriptions.

2. **No query depth or complexity limits** -- Allows denial-of-service through deeply nested or widely fanned-out queries.

3. **Applying authorization only at the resolver level** -- Misses authorization checks when fields are accessed through different query paths.

4. **Returning raw database errors in GraphQL responses** -- Exposes table names, column names, query structure, and database version.

5. **Using a single global DataLoader cache** -- Leaks data between users. One user's cached results may be returned to another user.

6. **Allowing unlimited batching** -- Lets attackers bypass rate limits by packing thousands of operations into one request.

7. **Trusting client-provided query strings without validation** -- Allows query injection and arbitrary schema exploration.

8. **Not rate-limiting GraphQL subscriptions** -- WebSocket connections bypass HTTP rate limiters. Subscriptions need their own limits.

---

## Enforcement Checklist

- [ ] Introspection is disabled in production environments
- [ ] Query depth limit is enforced (maximum 5-7 levels)
- [ ] Query complexity/cost analysis is implemented with a maximum budget
- [ ] Batching is disabled or limited to a small maximum (3-5 operations)
- [ ] Alias-based batching is limited per field
- [ ] Field-level authorization is implemented using shield, directives, or permissions
- [ ] DataLoaders are created per-request with authorization awareness
- [ ] Persisted/allowlisted queries are enforced in production
- [ ] Error messages are masked in production (no schema leaks)
- [ ] CSRF protection is in place for cookie-based authentication
- [ ] File upload validation includes type, size, and content verification
- [ ] Subscription authentication occurs at WebSocket connection time
- [ ] Rate limiting is based on query complexity, not just request count
- [ ] graphql-armor or equivalent protections are deployed
- [ ] Query string length is limited to prevent parsing abuse
