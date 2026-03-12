# Serverless Scaling

> **Domain:** Scalability > Infrastructure
> **Importance:** High
> **Last Updated:** 2026-03-10
> **Cross-references:**
> - `03-architecture/architectural-patterns/serverless/overview.md`
> - `09-performance/`
> - `10-scalability/horizontal-scaling/`

---

## Core Concepts

### Serverless Scaling Model

Serverless platforms scale automatically from zero to thousands of concurrent executions.
The provider manages all infrastructure provisioning. Billing charges per invocation and
execution duration, making it cost-effective for sporadic and bursty workloads.

| Property | Serverless | Containers |
|---|---|---|
| Scaling trigger | Per-request automatic | Metric-based (HPA, KEDA) |
| Scale-to-zero | Native | Requires KEDA or Knative |
| Cold start latency | 100ms - 10s | Seconds to minutes (pod scheduling) |
| Max execution time | 15 minutes (Lambda) | Unlimited |
| Cost at low traffic | Near zero | Fixed baseline |
| Cost at high traffic | Can exceed containers | Predictable with reservations |

### AWS Lambda Concurrency Model

Lambda manages three concurrency tiers. Understand each to prevent throttling.

- **Unreserved concurrency**: Shared pool across all functions in the account (default 1000).
- **Reserved concurrency**: Dedicated slice from the account pool; guarantees availability but caps the function.
- **Provisioned concurrency**: Pre-initialized environments; eliminates cold starts but incurs fixed cost.

### Cold Start Mitigation

1. **Provisioned Concurrency** -- Pre-warm a fixed number of environments.
2. **SnapStart** (Java) -- Snapshot the initialized JVM state and restore on invocation.
3. **Minimal dependencies** -- Reduce package size to accelerate initialization.
4. **Keep-alive pings** -- Schedule periodic invocations (use only as a last resort).

### Cost Crossover Analysis

Serverless is cheaper below a predictable invocation threshold. Above it, containers on
reserved instances become more economical. Evaluate monthly. Migrate high-volume,
steady-state functions when Lambda cost exceeds 1.5x equivalent container cost for three
consecutive months.

---

## Code Examples

### Lambda with Connection Pooling via RDS Proxy (TypeScript)

```typescript
// src/handlers/order-handler.ts
import { APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import { Pool } from "pg";

// Initialize OUTSIDE the handler to reuse across warm invocations.
const pool = new Pool({
  host: process.env.RDS_PROXY_ENDPOINT,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 2,             // Keep pool small; RDS Proxy manages the real pool
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 5_000,
  ssl: { rejectUnauthorized: true },
});

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    if (event.httpMethod === "POST" && event.path === "/orders") {
      const { customerId, total } = JSON.parse(event.body ?? "{}");
      const result = await pool.query(
        `INSERT INTO orders (customer_id, total, status, created_at)
         VALUES ($1, $2, 'pending', NOW())
         RETURNING id, customer_id AS "customerId", total, status`,
        [customerId, total]
      );
      return respond(201, result.rows[0]);
    }
    if (event.httpMethod === "GET" && event.path.startsWith("/orders/")) {
      const id = event.path.split("/").pop()!;
      const result = await pool.query(
        `SELECT id, customer_id AS "customerId", total, status
         FROM orders WHERE id = $1`, [id]
      );
      if (result.rows.length === 0) return respond(404, { error: "Not found" });
      return respond(200, result.rows[0]);
    }
    return respond(404, { error: "Not found" });
  } catch (err) {
    console.error("Handler error:", err);
    return respond(500, { error: "Internal server error" });
  }
};

function respond(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
```

### Lambda with Cold Start Optimization (Go)

```go
// cmd/lambda/main.go
// Minimize cold start: package-level init, no CGO, small binary.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

var (
	dbClient   *dynamodb.Client
	httpClient *http.Client
	initOnce   sync.Once
	initErr    error
)

func initClients() {
	initOnce.Do(func() {
		cfg, err := config.LoadDefaultConfig(context.Background())
		if err != nil {
			initErr = fmt.Errorf("load AWS config: %w", err)
			return
		}
		dbClient = dynamodb.NewFromConfig(cfg)
		httpClient = &http.Client{
			Timeout: 5 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        50,
				MaxIdleConnsPerHost: 50,
				IdleConnTimeout:     90 * time.Second,
			},
		}
	})
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest,
) (events.APIGatewayProxyResponse, error) {
	initClients()
	if initErr != nil {
		return errResp(500, "initialization failed"), nil
	}
	tableName := os.Getenv("TABLE_NAME")
	id := req.PathParameters["id"]
	if id == "" {
		return errResp(400, "missing id"), nil
	}
	result, err := dbClient.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: &tableName, Key: buildKey(id),
	})
	if err != nil {
		return errResp(502, "database query failed"), nil
	}
	if result.Item == nil {
		return errResp(404, "not found"), nil
	}
	body, _ := json.Marshal(result.Item)
	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       string(body),
	}, nil
}

func errResp(code int, msg string) events.APIGatewayProxyResponse {
	body, _ := json.Marshal(map[string]string{"error": msg})
	return events.APIGatewayProxyResponse{
		StatusCode: code,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       string(body),
	}
}

func main() { lambda.Start(handler) }
```

### Terraform: Lambda with Reserved Concurrency and DLQ

```hcl
# infra/modules/lambda/main.tf
resource "aws_lambda_function" "order_processor" {
  function_name = "${var.project}-order-processor-${var.environment}"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "bootstrap"
  runtime       = "provided.al2023"
  architectures = ["arm64"]
  memory_size   = 512
  timeout       = 30
  publish       = true

  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)
  reserved_concurrent_executions = 100

  dead_letter_config { target_arn = aws_sqs_queue.lambda_dlq.arn }

  environment {
    variables = {
      TABLE_NAME         = var.dynamodb_table_name
      LOG_LEVEL          = "info"
      POWERTOOLS_SERVICE = "order-processor"
    }
  }
  tracing_config { mode = "Active" }
  tags = var.tags
}

resource "aws_lambda_provisioned_concurrency_config" "order_processor" {
  function_name                     = aws_lambda_function.order_processor.function_name
  qualifier                         = aws_lambda_function.order_processor.version
  provisioned_concurrent_executions = var.provisioned_concurrency
}

resource "aws_sqs_queue" "lambda_dlq" {
  name                       = "${var.project}-order-processor-dlq-${var.environment}"
  message_retention_seconds  = 1209600
  visibility_timeout_seconds = 300
  tags                       = var.tags
}

resource "aws_cloudwatch_metric_alarm" "throttle_alarm" {
  alarm_name          = "${var.project}-order-throttles-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_actions       = [var.sns_alert_topic_arn]
  dimensions          = { FunctionName = aws_lambda_function.order_processor.function_name }
}
```

### Step Functions for Orchestrating Serverless Workflows

```yaml
# step-functions/order-workflow.asl.yaml
Comment: "Order processing workflow with retry and fallback"
StartAt: ValidateOrder
States:
  ValidateOrder:
    Type: Task
    Resource: "arn:aws:lambda:us-east-1:123456789:function:validate-order"
    TimeoutSeconds: 10
    Retry:
      - ErrorEquals: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"]
        IntervalSeconds: 2
        MaxAttempts: 3
        BackoffRate: 2.0
    Catch:
      - ErrorEquals: ["ValidationError"]
        Next: RejectOrder
      - ErrorEquals: ["States.ALL"]
        Next: HandleFailure
    Next: ProcessPayment
  ProcessPayment:
    Type: Task
    Resource: "arn:aws:lambda:us-east-1:123456789:function:process-payment"
    TimeoutSeconds: 30
    Retry:
      - ErrorEquals: ["PaymentGatewayTimeout"]
        IntervalSeconds: 5
        MaxAttempts: 3
        BackoffRate: 2.0
    Catch:
      - ErrorEquals: ["States.ALL"]
        Next: HandleFailure
    Next: FulfillOrder
  FulfillOrder:
    Type: Task
    Resource: "arn:aws:lambda:us-east-1:123456789:function:fulfill-order"
    TimeoutSeconds: 60
    Next: NotifyCustomer
  NotifyCustomer:
    Type: Task
    Resource: "arn:aws:lambda:us-east-1:123456789:function:send-notification"
    End: true
  RejectOrder:
    Type: Task
    Resource: "arn:aws:lambda:us-east-1:123456789:function:reject-order"
    End: true
  HandleFailure:
    Type: Task
    Resource: "arn:aws:lambda:us-east-1:123456789:function:handle-failure"
    End: true
```

---

## 10 Best Practices

1. **Initialize SDK clients outside the handler function.** Reuse connections across warm invocations to eliminate repeated setup costs.
2. **Set reserved concurrency on every production function.** Prevent a single function from consuming the entire account concurrency pool.
3. **Use provisioned concurrency for latency-sensitive paths.** Eliminate cold starts on user-facing API endpoints.
4. **Deploy on ARM64 (Graviton) architecture.** Achieve up to 34% better price-performance compared to x86.
5. **Keep deployment packages under 50 MB.** Smaller packages reduce cold start duration; use layers for shared dependencies.
6. **Configure dead-letter queues on every async invocation.** Capture failed events for debugging and reprocessing.
7. **Set function timeouts well below the 15-minute maximum.** Match the timeout to expected execution duration plus a buffer.
8. **Use RDS Proxy or connection pooling for relational databases.** Lambda can exhaust database connection limits without a proxy.
9. **Monitor throttle metrics and set alarms.** Detect when concurrency limits are reached before users are impacted.
10. **Evaluate cost monthly against container alternatives.** Migrate steady-state high-volume functions when serverless cost exceeds 1.5x containers.

---

## 8 Anti-Patterns

| # | Anti-Pattern | Problem | Correct Approach |
|---|---|---|---|
| 1 | Initializing clients inside the handler | Every invocation pays the full SDK initialization cost | Move client initialization to module scope |
| 2 | No reserved concurrency limits | One function storm consumes the account pool, throttling others | Set reserved concurrency per function based on expected peak |
| 3 | Synchronous chains of Lambda calls | Multiplies latency and cost; any failure breaks the chain | Use Step Functions or event-driven patterns with queues |
| 4 | Large monolithic Lambda packages | Cold starts exceed 5s; deployments become slow | Split into single-purpose functions under 50 MB |
| 5 | Using Lambda for long-running jobs | 15-minute timeout causes failures; retries duplicate work | Use ECS Fargate or Step Functions with Activity tasks |
| 6 | No DLQ on async invocations | Failed events silently dropped after retry exhaustion | Configure SQS DLQ on every async Lambda trigger |
| 7 | Connecting directly to RDS without proxy | Lambda creates hundreds of connections, exhausting DB limits | Use RDS Proxy to pool and manage connections |
| 8 | Keep-alive pings as primary cold start strategy | Adds cost, complexity, does not scale under burst traffic | Use provisioned concurrency or SnapStart instead |

---

## Enforcement Checklist

- [ ] Every Lambda function has reserved concurrency configured
- [ ] Latency-sensitive functions use provisioned concurrency or SnapStart
- [ ] All SDK clients and database pools are initialized outside the handler
- [ ] Deployment packages are under 50 MB (excluding layers)
- [ ] ARM64 architecture is selected unless a dependency requires x86
- [ ] Dead-letter queues are attached to all async event sources
- [ ] Function timeouts are set to expected duration plus 20% buffer
- [ ] RDS Proxy is used for all Lambda-to-RDS connections
- [ ] CloudWatch alarms exist for Throttles, Errors, and DLQ depth
- [ ] Monthly cost reviews compare serverless vs. container alternatives
- [ ] Step Functions orchestrate multi-step workflows instead of Lambda chains
- [ ] IAM roles follow least-privilege with per-function policies
