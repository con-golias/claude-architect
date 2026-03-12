# API Contract Organization

> **AI Plugin Directive:** When managing API contracts (OpenAPI, gRPC, AsyncAPI) across multiple services, ALWAYS use this guide. Apply contract-first design, schema registries, and automated client generation. This guide covers how to organize, version, and enforce API contracts in a multi-service architecture.

**Core Rule: Design contracts FIRST, implement code SECOND. API contracts are the source of truth for inter-service communication. Store contracts in a dedicated location, generate client code from them, and validate implementations against them. NEVER let code diverge from contracts.**

---

## 1. Contract Repository Structure

```
contracts/
├── openapi/                               # REST API contracts
│   ├── user-service/
│   │   ├── v1/
│   │   │   └── openapi.yaml               # OpenAPI 3.1 spec
│   │   └── v2/
│   │       └── openapi.yaml
│   ├── order-service/
│   │   └── v1/
│   │       └── openapi.yaml
│   └── payment-service/
│       └── v1/
│           └── openapi.yaml
│
├── proto/                                 # gRPC contracts
│   ├── buf.yaml                           # Buf configuration
│   ├── buf.gen.yaml                       # Code generation config
│   ├── user/
│   │   └── v1/
│   │       ├── user.proto
│   │       └── user_service.proto
│   ├── order/
│   │   └── v1/
│   │       ├── order.proto
│   │       └── order_service.proto
│   └── common/
│       └── v1/
│           ├── pagination.proto
│           ├── error.proto
│           └── health.proto
│
├── asyncapi/                              # Event contracts
│   ├── user-events.yaml                   # AsyncAPI 3.0 spec
│   ├── order-events.yaml
│   └── payment-events.yaml
│
├── schemas/                               # Shared JSON schemas
│   ├── address.json
│   ├── money.json
│   └── pagination.json
│
├── generated/                             # Auto-generated clients (gitignored or committed)
│   ├── typescript/
│   ├── python/
│   └── go/
│
├── scripts/
│   ├── generate.sh                        # Generate all clients
│   ├── validate.sh                        # Validate all specs
│   └── lint.sh                            # Lint all specs
│
├── .spectral.yaml                         # OpenAPI linting rules
├── buf.yaml                               # Protobuf linting
└── README.md
```

---

## 2. OpenAPI Contract

```yaml
# contracts/openapi/user-service/v1/openapi.yaml
openapi: "3.1.0"
info:
  title: User Service API
  version: "1.0.0"
  description: Manages user accounts and authentication

servers:
  - url: http://user-service:3001
    description: Internal service

paths:
  /v1/users:
    get:
      operationId: listUsers
      summary: List all users
      tags: [Users]
      parameters:
        - $ref: "#/components/parameters/Limit"
        - $ref: "#/components/parameters/Cursor"
        - name: role
          in: query
          schema:
            $ref: "#/components/schemas/UserRole"
      responses:
        "200":
          description: List of users
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserListResponse"

    post:
      operationId: createUser
      summary: Create a new user
      tags: [Users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateUserRequest"
      responses:
        "201":
          description: User created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        "422":
          $ref: "#/components/responses/ValidationError"

  /v1/users/{userId}:
    get:
      operationId: getUser
      summary: Get user by ID
      tags: [Users]
      parameters:
        - $ref: "#/components/parameters/UserId"
      responses:
        "200":
          description: User found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        "404":
          $ref: "#/components/responses/NotFoundError"

components:
  schemas:
    User:
      type: object
      required: [id, email, name, role, createdAt]
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        name:
          type: string
        role:
          $ref: "#/components/schemas/UserRole"
        createdAt:
          type: string
          format: date-time

    UserRole:
      type: string
      enum: [admin, member, viewer]

    CreateUserRequest:
      type: object
      required: [email, name]
      properties:
        email:
          type: string
          format: email
        name:
          type: string
          minLength: 1
        role:
          $ref: "#/components/schemas/UserRole"
          default: member

    UserListResponse:
      type: object
      required: [data, hasMore]
      properties:
        data:
          type: array
          items:
            $ref: "#/components/schemas/User"
        hasMore:
          type: boolean
        nextCursor:
          type: string
          nullable: true

  parameters:
    UserId:
      name: userId
      in: path
      required: true
      schema:
        type: string
        format: uuid
    Limit:
      name: limit
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20
    Cursor:
      name: cursor
      in: query
      schema:
        type: string

  responses:
    NotFoundError:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"
    ValidationError:
      description: Validation failed
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"

  schemas:
    ErrorResponse:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message]
          properties:
            code:
              type: string
            message:
              type: string
            details:
              type: array
              items:
                type: object
```

---

## 3. gRPC Proto Contract

```protobuf
// contracts/proto/user/v1/user_service.proto
syntax = "proto3";

package user.v1;

import "common/v1/pagination.proto";

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc UpdateUser(UpdateUserRequest) returns (User);
  rpc DeleteUser(DeleteUserRequest) returns (DeleteUserResponse);
}

message User {
  string id = 1;
  string email = 2;
  string name = 3;
  UserRole role = 4;
  google.protobuf.Timestamp created_at = 5;
}

enum UserRole {
  USER_ROLE_UNSPECIFIED = 0;
  USER_ROLE_ADMIN = 1;
  USER_ROLE_MEMBER = 2;
  USER_ROLE_VIEWER = 3;
}

message GetUserRequest {
  string user_id = 1;
}

message ListUsersRequest {
  int32 page_size = 1;
  string page_token = 2;
  optional UserRole role_filter = 3;
}

message ListUsersResponse {
  repeated User users = 1;
  string next_page_token = 2;
  int32 total_count = 3;
}

message CreateUserRequest {
  string email = 1;
  string name = 2;
  UserRole role = 3;
}
```

---

## 4. AsyncAPI Event Contract

```yaml
# contracts/asyncapi/user-events.yaml
asyncapi: "3.0.0"
info:
  title: User Events
  version: "1.0.0"
  description: Events published by the User Service

channels:
  userCreated:
    address: events.user.created
    messages:
      userCreated:
        $ref: "#/components/messages/UserCreated"

  userUpdated:
    address: events.user.updated
    messages:
      userUpdated:
        $ref: "#/components/messages/UserUpdated"

  userDeleted:
    address: events.user.deleted
    messages:
      userDeleted:
        $ref: "#/components/messages/UserDeleted"

components:
  messages:
    UserCreated:
      payload:
        type: object
        required: [eventType, version, timestamp, data]
        properties:
          eventType:
            type: string
            const: user.created
          version:
            type: string
            const: "1.0"
          timestamp:
            type: string
            format: date-time
          data:
            type: object
            required: [userId, email, name, plan]
            properties:
              userId:
                type: string
                format: uuid
              email:
                type: string
                format: email
              name:
                type: string
              plan:
                type: string
                enum: [free, pro, enterprise]
          metadata:
            $ref: "#/components/schemas/EventMetadata"

  schemas:
    EventMetadata:
      type: object
      required: [correlationId, source]
      properties:
        correlationId:
          type: string
          format: uuid
        source:
          type: string
```

---

## 5. Contract Validation & Linting

```yaml
# .spectral.yaml — OpenAPI linting rules
extends: ["spectral:oas"]
rules:
  operation-operationId: error              # Every operation needs operationId
  operation-tags: error                      # Every operation needs tags
  oas3-valid-schema-example: warn           # Examples must match schemas
  info-description: error                    # API must have description
  operation-description: warn               # Operations should have descriptions

  # Custom rules
  path-must-be-versioned:
    description: All paths must start with version prefix
    severity: error
    given: "$.paths"
    then:
      field: "@key"
      function: pattern
      functionOptions:
        match: "^/v\\d+/"
```

```bash
# scripts/validate.sh
#!/bin/bash
set -e

echo "=== Validating OpenAPI specs ==="
for spec in contracts/openapi/*/v*/openapi.yaml; do
  echo "Validating: $spec"
  npx @stoplight/spectral-cli lint "$spec" --ruleset .spectral.yaml
done

echo "=== Validating Proto files ==="
cd contracts && buf lint

echo "=== Validating AsyncAPI specs ==="
for spec in contracts/asyncapi/*.yaml; do
  echo "Validating: $spec"
  npx @asyncapi/cli validate "$spec"
done

echo "All contracts valid!"
```

---

## 6. Client Generation

```bash
# scripts/generate.sh
#!/bin/bash
set -e

# Generate TypeScript clients from OpenAPI
for service_dir in contracts/openapi/*/; do
  service=$(basename "$service_dir")
  latest=$(ls -d "${service_dir}"v* | sort -V | tail -1)

  npx openapi-typescript "${latest}/openapi.yaml" \
    -o "generated/typescript/${service}.ts"
done

# Generate gRPC clients
cd contracts && buf generate

echo "All clients generated!"
```

```yaml
# contracts/buf.gen.yaml
version: v2
plugins:
  - remote: buf.build/protocolbuffers/ts
    out: ../generated/typescript/proto
  - remote: buf.build/protocolbuffers/python
    out: ../generated/python/proto
  - remote: buf.build/grpc/go
    out: ../generated/go/proto
    opt: paths=source_relative
```

---

## 7. Contract-First Workflow

```
1. Design contract (OpenAPI/Proto/AsyncAPI)
2. Review contract in PR (like code review)
3. Generate clients and types
4. Implement service against contract
5. Validate implementation matches contract
6. Consumer uses generated client

Timeline:
  PR: Update openapi.yaml
  → CI: Lint contract (Spectral)
  → CI: Check backward compatibility
  → CI: Generate clients
  → Merge: Clients available to services
  → Services: Implement and consume

NEVER implement first, document later.
ALWAYS design the contract before writing code.
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No contracts | Services break each other | Contract-first design |
| Contracts in service repos | Hard to find, no central truth | Dedicated contracts/ directory |
| No linting | Inconsistent API style | Spectral rules + buf lint |
| Hand-written clients | Drift from actual API | Generate from contracts |
| No versioning in paths | Breaking changes break consumers | `/v1/`, `/v2/` path prefix |
| No backward compat checks | Breaking changes in minor versions | `buf breaking` or `oasdiff` |
| Code-first contracts | API design driven by implementation | Design contract first |
| No event schemas | Consumers guess event format | AsyncAPI specs |

---

## 9. Enforcement Checklist

- [ ] Contract-first — design API before implementation
- [ ] Central location — all contracts in one directory/repo
- [ ] Versioned paths — `/v1/`, `/v2/` for REST APIs
- [ ] Linted — Spectral for OpenAPI, buf for Proto
- [ ] Backward compatibility checked — automated in CI
- [ ] Clients generated — NEVER hand-written
- [ ] Events documented — AsyncAPI specs for all events
- [ ] Shared schemas — reusable components (pagination, errors)
- [ ] PR review for contracts — treated like code changes
- [ ] CI validation — contracts validated on every PR
