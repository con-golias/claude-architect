# Serverless Patterns — Complete Specification

> **AI Plugin Directive:** Serverless patterns solve common architectural challenges in event-driven, function-based systems. EVERY serverless application must implement proper error handling, retry logic, and idempotency. Use Step Functions for orchestration, SQS/SNS for async communication, and DynamoDB for state. NEVER build synchronous call chains between Lambda functions.

---

## 1. API Gateway + Lambda Pattern

```
The most common serverless pattern: HTTP API backed by Lambda functions.

Client → API Gateway → Lambda → DynamoDB/RDS
                    → Returns HTTP response

RULES:
  - One Lambda per route (POST /orders → createOrder function)
  - API Gateway handles: auth, rate limiting, request validation, CORS
  - Lambda handles: business logic, data access
  - Response time target: < 1 second (including cold start)
```

```typescript
// Standard API handler structure
import { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // 1. Parse and validate input
    const body = JSON.parse(event.body || '{}');
    const validationErrors = validate(body);
    if (validationErrors.length > 0) {
      return response(400, { errors: validationErrors });
    }

    // 2. Execute business logic
    const result = await placeOrder(body);

    // 3. Return response
    return response(201, { orderId: result.orderId });
  } catch (error) {
    return handleError(error);
  }
};

function response(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function handleError(error: unknown): APIGatewayProxyResultV2 {
  if (error instanceof ValidationError) return response(400, { error: error.message });
  if (error instanceof NotFoundError) return response(404, { error: error.message });
  if (error instanceof ConflictError) return response(409, { error: error.message });

  console.error('Unhandled error:', error);
  return response(500, { error: 'Internal server error' });
}
```

---

## 2. Event Processing Pattern

```
Asynchronous event processing using queues and event buses.

Producer → SQS/SNS/EventBridge → Lambda Consumer → Side Effects

USE CASES:
  - Order placed → send confirmation email
  - File uploaded → generate thumbnail
  - Payment received → update order status
  - User registered → create welcome workflow
```

```typescript
// SQS event handler with batch processing
import { SQSHandler, SQSRecord } from 'aws-lambda';

export const handler: SQSHandler = async (event) => {
  const failedIds: string[] = [];

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error('Failed to process record', {
        messageId: record.messageId,
        error: (error as Error).message,
      });
      failedIds.push(record.messageId);
    }
  }

  // Partial batch failure: return failed items for retry
  if (failedIds.length > 0) {
    return {
      batchItemFailures: failedIds.map(id => ({ itemIdentifier: id })),
    };
  }
};

async function processRecord(record: SQSRecord): Promise<void> {
  const event = JSON.parse(record.body);

  // Idempotency check
  if (await isAlreadyProcessed(event.eventId)) return;

  // Process based on event type
  switch (event.eventType) {
    case 'order.placed':
      await sendOrderConfirmation(event.payload);
      break;
    case 'order.shipped':
      await sendShippingNotification(event.payload);
      break;
    default:
      console.warn('Unknown event type:', event.eventType);
  }

  await markAsProcessed(event.eventId);
}
```

---

## 3. Fan-Out / Fan-In Pattern

```
One event triggers multiple parallel processors.
Results are aggregated when all processors complete.

             ┌─── Lambda A (process images)
             │
SNS Topic ───┼─── Lambda B (update search index)
             │
             └─── Lambda C (send notification)

USE CASES:
  - File upload triggers: thumbnail, virus scan, metadata extraction
  - Order placed triggers: inventory, payment, notification (parallel)
  - New user triggers: welcome email, analytics, referral check
```

```yaml
# SNS fan-out configuration
resources:
  Resources:
    OrderEventsTopic:
      Type: AWS::SNS::Topic
      Properties:
        TopicName: order-events

    # Each subscriber gets its own SQS queue (for retry/DLQ)
    InventoryQueue:
      Type: AWS::SQS::Queue
      Properties:
        RedrivePolicy:
          deadLetterTargetArn: !GetAtt InventoryDLQ.Arn
          maxReceiveCount: 3

    InventorySubscription:
      Type: AWS::SNS::Subscription
      Properties:
        TopicArn: !Ref OrderEventsTopic
        Protocol: sqs
        Endpoint: !GetAtt InventoryQueue.Arn
        FilterPolicy:
          eventType: [order.placed]  # Only receives order.placed events
```

---

## 4. Step Functions (Orchestration) Pattern

```
For complex workflows with multiple steps, conditions, and error handling.
Step Functions is the CORRECT way to orchestrate Lambda functions.

NEVER: Lambda calls Lambda (synchronous chain)
ALWAYS: Step Functions orchestrates Lambda functions

USE CASES:
  - Order processing workflow (multi-step with conditions)
  - Data pipeline (ETL with branching)
  - Approval workflows (wait for human input)
  - Saga pattern implementation
```

```json
{
  "Comment": "Order Processing Saga",
  "StartAt": "CreateOrder",
  "States": {
    "CreateOrder": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:*:*:function:create-order",
      "ResultPath": "$.order",
      "Next": "ReserveInventory",
      "Catch": [{
        "ErrorEquals": ["States.ALL"],
        "Next": "OrderFailed"
      }]
    },
    "ReserveInventory": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:*:*:function:reserve-inventory",
      "ResultPath": "$.inventory",
      "Next": "ProcessPayment",
      "Catch": [{
        "ErrorEquals": ["States.ALL"],
        "Next": "ReleaseInventoryAndCancel"
      }]
    },
    "ProcessPayment": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:*:*:function:process-payment",
      "ResultPath": "$.payment",
      "Next": "ConfirmOrder",
      "Catch": [{
        "ErrorEquals": ["States.ALL"],
        "Next": "RefundAndReleaseInventory"
      }]
    },
    "ConfirmOrder": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:*:*:function:confirm-order",
      "End": true
    },
    "RefundAndReleaseInventory": {
      "Type": "Parallel",
      "Branches": [
        {
          "StartAt": "RefundPayment",
          "States": {
            "RefundPayment": { "Type": "Task", "Resource": "arn:aws:lambda:*:*:function:refund-payment", "End": true }
          }
        },
        {
          "StartAt": "ReleaseInventory",
          "States": {
            "ReleaseInventory": { "Type": "Task", "Resource": "arn:aws:lambda:*:*:function:release-inventory", "End": true }
          }
        }
      ],
      "Next": "CancelOrder"
    },
    "ReleaseInventoryAndCancel": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:*:*:function:release-inventory",
      "Next": "CancelOrder"
    },
    "CancelOrder": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:*:*:function:cancel-order",
      "End": true
    },
    "OrderFailed": {
      "Type": "Fail",
      "Error": "OrderCreationFailed",
      "Cause": "Failed to create order"
    }
  }
}
```

---

## 5. Event Bridge Pattern

```
EventBridge is a serverless event bus for routing events between services.
More powerful than SNS: content-based routing, schema registry, replay.

Producer → EventBridge → Rules → Targets (Lambda, SQS, Step Functions)

USE CASES:
  - Cross-account event routing
  - SaaS integration (Stripe, Shopify events)
  - Complex event routing rules
  - Event archival and replay
```

```typescript
// Publishing to EventBridge
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const eventBridge = new EventBridgeClient({});

async function publishOrderEvent(order: Order): Promise<void> {
  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      Source: 'ordering-service',
      DetailType: 'OrderPlaced',
      Detail: JSON.stringify({
        orderId: order.id,
        customerId: order.customerId,
        totalAmount: order.totalAmount,
        currency: order.currency,
      }),
      EventBusName: 'order-events',
    }],
  }));
}
```

---

## 6. Idempotency Pattern

```typescript
// CRITICAL: Every Lambda handler MUST be idempotent
// Lambda can be invoked multiple times for the same event

import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

const IDEMPOTENCY_TABLE = process.env.IDEMPOTENCY_TABLE;

async function withIdempotency<T>(
  idempotencyKey: string,
  operation: () => Promise<T>,
  ttlSeconds: number = 86400, // 24 hours
): Promise<T> {
  // Check if already processed
  const existing = await dynamodb.send(new GetItemCommand({
    TableName: IDEMPOTENCY_TABLE,
    Key: { PK: { S: idempotencyKey } },
  }));

  if (existing.Item) {
    // Already processed — return cached result
    return JSON.parse(existing.Item.result.S) as T;
  }

  // Execute operation
  const result = await operation();

  // Store result for future duplicate detection
  await dynamodb.send(new PutItemCommand({
    TableName: IDEMPOTENCY_TABLE,
    Item: {
      PK: { S: idempotencyKey },
      result: { S: JSON.stringify(result) },
      ttl: { N: String(Math.floor(Date.now() / 1000) + ttlSeconds) },
    },
    ConditionExpression: 'attribute_not_exists(PK)',
  }));

  return result;
}

// Usage in handler
export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    await withIdempotency(body.eventId, async () => {
      return processOrderEvent(body);
    });
  }
};
```

---

## 7. Pattern Selection Guide

```
What is the trigger?
├── HTTP request → API Gateway + Lambda
├── Queue message → SQS + Lambda
├── Event notification → SNS/EventBridge + Lambda
├── File upload → S3 + Lambda
├── Database change → DynamoDB Streams + Lambda
├── Scheduled job → EventBridge Scheduler + Lambda
└── Complex workflow → Step Functions

How many steps?
├── 1 step → Single Lambda
├── 2-3 steps (linear) → SQS chaining or SNS
├── 4+ steps (complex) → Step Functions
└── Parallel processing → SNS fan-out or Step Functions Parallel

Need response?
├── Synchronous → API Gateway + Lambda (< 29 sec)
├── Long-running → API Gateway → Step Functions → callback
└── Fire-and-forget → SQS/SNS + Lambda
```

---

## 8. Enforcement Checklist

- [ ] **One function per event/route** — no Lambda monoliths
- [ ] **Idempotent handlers** — every handler handles duplicates gracefully
- [ ] **DLQ on every queue** — failed events are captured and monitored
- [ ] **Step Functions for orchestration** — not Lambda-calls-Lambda
- [ ] **Partial batch failure** — SQS handlers return batchItemFailures
- [ ] **Timeout appropriate** — each function's timeout matches its workload
- [ ] **Least privilege IAM** — specific permissions per function
- [ ] **Infrastructure as Code** — all resources in CloudFormation/CDK/Serverless Framework
- [ ] **Error handling standardized** — consistent error responses across all functions
- [ ] **Monitoring dashboards** — per-function metrics for errors, duration, throttles
