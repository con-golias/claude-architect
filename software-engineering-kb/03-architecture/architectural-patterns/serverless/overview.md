# Serverless Architecture — Complete Specification

> **AI Plugin Directive:** Serverless architecture delegates server management entirely to the cloud provider. Code runs in ephemeral, stateless functions triggered by events. You pay ONLY for execution time, not idle servers. Use serverless for event-driven workloads, APIs with variable traffic, and background processing. Do NOT use serverless for long-running processes, stateful applications, or workloads requiring consistent low latency.

---

## 1. The Core Rule

**Serverless functions are stateless, short-lived, event-triggered compute units. They scale automatically to zero and to thousands of instances. Design for STATELESSNESS — every invocation is independent. Store state externally (database, cache, object storage). Accept cold starts as a trade-off for zero operational overhead.**

---

## 2. Serverless Computing Model

```
TRADITIONAL SERVER:
  Server runs 24/7 → You pay for idle time
  You manage: OS, runtime, scaling, patching, monitoring
  Scaling: Manual or autoscaling (minutes to scale)

SERVERLESS (FaaS — Function as a Service):
  Function runs on demand → You pay per invocation
  Provider manages: Everything below your code
  Scaling: Automatic, instant (milliseconds to scale)

┌──────────────────────────────────────────────────────────┐
│                    YOU MANAGE                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Application Code + Configuration                  │  │
│  └────────────────────────────────────────────────────┘  │
│                    PROVIDER MANAGES                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Runtime │ OS │ Containers │ Servers │ Network      │  │
│  │  Scaling │ Patching │ Load Balancing │ Monitoring   │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Major Serverless Platforms

```
┌───────────────────┬──────────────────────────────────────┐
│ Platform          │ Key Features                         │
├───────────────────┼──────────────────────────────────────┤
│ AWS Lambda        │ Most mature, largest ecosystem        │
│                   │ Max: 15min, 10GB RAM, 10GB /tmp      │
│                   │ Languages: Node, Python, Java, Go, C#│
├───────────────────┼──────────────────────────────────────┤
│ Google Cloud      │ HTTP native, Cloud Run for containers│
│ Functions         │ Max: 60min (2nd gen), 32GB RAM       │
│                   │ Languages: Node, Python, Go, Java    │
├───────────────────┼──────────────────────────────────────┤
│ Azure Functions   │ Best .NET integration, Durable Func  │
│                   │ Max: 10min (consumption), unlimited  │
│                   │ (premium)                            │
│                   │ Languages: C#, Node, Python, Java    │
├───────────────────┼──────────────────────────────────────┤
│ Cloudflare        │ Edge-deployed, V8 isolates           │
│ Workers           │ Ultra-low latency, 128MB limit       │
│                   │ Languages: JS/TS, Rust (WASM)        │
└───────────────────┴──────────────────────────────────────┘
```

---

## 3. Function Design Rules

### Stateless Functions

```typescript
// EVERY function invocation is independent
// NEVER store state in function memory between invocations

// ❌ WRONG: Storing state in function memory
let requestCount = 0; // This WILL be reset on cold start!
let cachedUser = null; // This WILL be shared across invocations (BUG!)

export async function handler(event: APIGatewayEvent) {
  requestCount++; // Unreliable counter
  if (!cachedUser) cachedUser = await getUser(); // Race condition
  return { body: JSON.stringify({ count: requestCount }) };
}

// ✅ CORRECT: External state
export async function handler(event: APIGatewayEvent) {
  // Read state from external store
  const count = await redis.incr('request-count');
  const user = await db.getUser(event.pathParameters.userId);
  return {
    statusCode: 200,
    body: JSON.stringify({ count, user }),
  };
}
```

### Single Responsibility

```typescript
// Each function does ONE thing. Not a mini-server.

// ❌ WRONG: One function handles everything
export async function handler(event: APIGatewayEvent) {
  switch (event.httpMethod) {
    case 'GET': return getOrder(event);
    case 'POST': return createOrder(event);
    case 'PUT': return updateOrder(event);
    case 'DELETE': return deleteOrder(event);
  }
}

// ✅ CORRECT: Separate functions per operation
// functions/get-order.ts
export async function handler(event: APIGatewayEvent) {
  const orderId = event.pathParameters?.id;
  const order = await orderRepo.findById(orderId);
  return { statusCode: 200, body: JSON.stringify(order) };
}

// functions/create-order.ts
export async function handler(event: APIGatewayEvent) {
  const body = JSON.parse(event.body);
  const orderId = await placeOrder(body);
  return { statusCode: 201, body: JSON.stringify({ orderId }) };
}
```

### Minimal Dependencies

```typescript
// Cold start time = time to load your code + dependencies
// MINIMIZE dependency size

// ❌ WRONG: Heavy dependencies
import AWS from 'aws-sdk'; // 70MB+ — loads the ENTIRE SDK
import moment from 'moment'; // 300KB — use native Date or day.js

// ✅ CORRECT: Minimal, specific imports
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'; // ~2MB
import { formatDate } from './utils'; // Custom lightweight utility

// Bundle optimization:
// - Use esbuild or webpack to bundle and tree-shake
// - Exclude aws-sdk v3 (already in Lambda runtime)
// - Use layers for shared dependencies
```

---

## 4. Serverless Project Structure

```
serverless-app/
├── functions/
│   ├── orders/
│   │   ├── create-order.ts        # POST /orders
│   │   ├── get-order.ts           # GET /orders/:id
│   │   ├── list-orders.ts         # GET /orders
│   │   └── cancel-order.ts        # DELETE /orders/:id
│   ├── events/
│   │   ├── on-order-created.ts    # SQS/SNS trigger
│   │   ├── on-payment-received.ts # SQS trigger
│   │   └── on-file-uploaded.ts    # S3 trigger
│   └── scheduled/
│       ├── daily-report.ts        # CloudWatch cron trigger
│       └── cleanup-expired.ts     # Scheduled cleanup
├── lib/
│   ├── domain/
│   │   ├── entities/
│   │   │   └── order.ts
│   │   ├── value-objects/
│   │   │   └── money.ts
│   │   └── ports/
│   │       └── order-repository.ts
│   ├── infrastructure/
│   │   ├── dynamodb-order-repo.ts
│   │   ├── sqs-publisher.ts
│   │   └── secrets-manager.ts
│   └── shared/
│       ├── http-response.ts       # Standard response builders
│       ├── error-handler.ts       # Centralized error handling
│       └── middleware.ts          # Auth, logging, tracing
├── infrastructure/
│   ├── serverless.yml             # Serverless Framework config
│   └── cdk/                       # OR AWS CDK
│       └── stack.ts
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
└── tsconfig.json
```

---

## 5. Infrastructure as Code

### Serverless Framework

```yaml
# serverless.yml
service: order-service
frameworkVersion: '3'

provider:
  name: aws
  runtime: nodejs20.x
  region: eu-west-1
  memorySize: 256
  timeout: 10
  environment:
    ORDERS_TABLE: ${self:service}-orders-${sls:stage}
    EVENTS_QUEUE_URL: !Ref OrderEventsQueue
  iam:
    role:
      statements:
        - Effect: Allow
          Action: [dynamodb:PutItem, dynamodb:GetItem, dynamodb:Query]
          Resource: !GetAtt OrdersTable.Arn
        - Effect: Allow
          Action: [sqs:SendMessage]
          Resource: !GetAtt OrderEventsQueue.Arn

functions:
  createOrder:
    handler: functions/orders/create-order.handler
    events:
      - httpApi:
          path: /orders
          method: post

  getOrder:
    handler: functions/orders/get-order.handler
    events:
      - httpApi:
          path: /orders/{id}
          method: get

  onOrderCreated:
    handler: functions/events/on-order-created.handler
    events:
      - sqs:
          arn: !GetAtt OrderEventsQueue.Arn
          batchSize: 10
    timeout: 30

  dailyReport:
    handler: functions/scheduled/daily-report.handler
    events:
      - schedule: cron(0 8 * * ? *)
    timeout: 300
    memorySize: 512

resources:
  Resources:
    OrdersTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ${self:service}-orders-${sls:stage}
        BillingMode: PAY_PER_REQUEST
        AttributeDefinitions:
          - { AttributeName: PK, AttributeType: S }
          - { AttributeName: SK, AttributeType: S }
        KeySchema:
          - { AttributeName: PK, KeyType: HASH }
          - { AttributeName: SK, KeyType: RANGE }

    OrderEventsQueue:
      Type: AWS::SQS::Queue
      Properties:
        QueueName: ${self:service}-events-${sls:stage}
        VisibilityTimeout: 60
        RedrivePolicy:
          deadLetterTargetArn: !GetAtt OrderEventsDLQ.Arn
          maxReceiveCount: 3

    OrderEventsDLQ:
      Type: AWS::SQS::Queue
      Properties:
        QueueName: ${self:service}-events-dlq-${sls:stage}
```

---

## 6. Database Patterns for Serverless

### DynamoDB (Serverless-Native)

```typescript
// DynamoDB is the NATURAL database for serverless:
// - No connection pooling issues
// - Pay per request
// - Millisecond latency at any scale
// - Auto-scaling

// Single-table design for DynamoDB
const TABLE_NAME = process.env.ORDERS_TABLE;

// Store order
async function saveOrder(order: Order): Promise<void> {
  await dynamodb.send(new PutItemCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: { S: `ORDER#${order.id}` },
      SK: { S: `ORDER#${order.id}` },
      GSI1PK: { S: `CUSTOMER#${order.customerId}` },
      GSI1SK: { S: `ORDER#${order.createdAt}` },
      type: { S: 'ORDER' },
      status: { S: order.status },
      totalAmount: { N: order.totalAmount.toString() },
      createdAt: { S: order.createdAt },
      data: { S: JSON.stringify(order) },
    },
    ConditionExpression: 'attribute_not_exists(PK)', // Prevent duplicates
  }));
}

// Query: Get orders for a customer
async function getOrdersByCustomer(customerId: string): Promise<Order[]> {
  const result = await dynamodb.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': { S: `CUSTOMER#${customerId}` } },
    ScanIndexForward: false, // Newest first
  }));
  return result.Items.map(item => JSON.parse(item.data.S));
}
```

### RDS Proxy (for SQL databases)

```typescript
// PROBLEM: Lambda functions create new DB connections per invocation
// 1000 concurrent Lambdas = 1000 DB connections → DB overwhelmed

// SOLUTION: RDS Proxy pools connections between Lambda and RDS

// Lambda → RDS Proxy → PostgreSQL/MySQL
// RDS Proxy maintains a connection pool
// Lambda functions share connections through the proxy

// Configuration in serverless.yml:
// provider:
//   vpc:
//     securityGroupIds: [!Ref LambdaSG]
//     subnetIds: [!Ref PrivateSubnet1, !Ref PrivateSubnet2]
//   environment:
//     DATABASE_URL: !GetAtt RDSProxy.Endpoint
```

---

## 7. Anti-Patterns

| Anti-Pattern | Description | Fix |
|-------------|-------------|-----|
| **Lambda Monolith** | One function handles all routes (mini-server) | One function per route/event |
| **Stateful Functions** | Storing state in function memory | Use external state (DynamoDB, Redis, S3) |
| **Heavy Dependencies** | 100MB+ deployment package | Tree-shake, use layers, import specific clients |
| **Long-Running Functions** | Functions running > 5 minutes | Use Step Functions or ECS for long processes |
| **Direct DB Connections** | 1000 Lambdas = 1000 DB connections | RDS Proxy or use DynamoDB |
| **No DLQ** | Failed events disappear silently | Every queue/trigger has a DLQ |
| **Synchronous Chains** | Lambda calls Lambda calls Lambda | Use Step Functions or events |
| **No Idempotency** | Retry creates duplicate orders | Idempotency key in every handler |
| **VPC Cold Starts** | Lambda in VPC adds seconds to cold start | Avoid VPC unless necessary, use VPC endpoints |
| **Over-Provisioning** | 1GB RAM for a 50ms function | Right-size memory using Power Tuning |

---

## 8. Enforcement Checklist

- [ ] **Stateless functions** — no in-memory state between invocations
- [ ] **Single responsibility** — one function per event type / API endpoint
- [ ] **Minimal dependencies** — bundle size < 5MB, tree-shaken
- [ ] **Timeout configured** — every function has an appropriate timeout
- [ ] **DLQ on every queue** — failed events captured and monitored
- [ ] **Idempotent handlers** — retries don't cause duplicate processing
- [ ] **Infrastructure as Code** — all resources defined in SAM/CDK/Serverless Framework
- [ ] **Monitoring and alerting** — CloudWatch alarms on errors, throttles, duration
- [ ] **Least privilege IAM** — each function has only the permissions it needs
- [ ] **Cold start optimized** — minimal deps, provisioned concurrency for critical paths
