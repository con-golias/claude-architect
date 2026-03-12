# Serverless Security Comprehensive Guide

## Metadata
- **Category**: Infrastructure Security
- **Audience**: Backend engineers, DevOps engineers, security engineers
- **Last Updated**: 2026-03-10
- **Complexity**: Advanced
- **Platforms**: AWS Lambda, GCP Cloud Functions, Azure Functions
- **Languages**: TypeScript, Python, Go

---

## 1. OWASP Serverless Top 10

The OWASP Serverless Top 10 identifies the most critical security risks specific to
serverless architectures.

### SLS-1: Function Event Data Injection

Serverless functions receive events from multiple sources (API Gateway, S3, SQS, SNS,
DynamoDB Streams). All event data must be treated as untrusted input.

```typescript
// TypeScript - Validate and sanitize ALL event data
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';

// Define strict input schemas
const CreateOrderSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(100),
  shippingAddress: z.object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    state: z.string().length(2),
    zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  }),
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Never trust event data - validate everything
  let body: unknown;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Validate against schema
  const result = CreateOrderSchema.safeParse(body);
  if (!result.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Validation failed',
        details: result.error.flatten(),
      }),
    };
  }

  // Use validated data only
  const validatedOrder = result.data;

  // Also validate path parameters and query strings
  const userId = event.pathParameters?.userId;
  if (!userId || !z.string().uuid().safeParse(userId).success) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid user ID' }) };
  }

  // Process with validated data
  return {
    statusCode: 201,
    body: JSON.stringify({ orderId: 'created' }),
  };
};
```

```python
# Python - Validate S3 event data (prevent path traversal)
import os
import re
from urllib.parse import unquote_plus

def handler(event, context):
    for record in event['Records']:
        bucket = record['s3']['bucket']['name']
        key = unquote_plus(record['s3']['object']['key'])

        # Validate bucket name (prevent SSRF through crafted events)
        allowed_buckets = os.environ.get('ALLOWED_BUCKETS', '').split(',')
        if bucket not in allowed_buckets:
            raise ValueError(f"Unauthorized bucket: {bucket}")

        # Validate object key (prevent path traversal)
        if '..' in key or key.startswith('/'):
            raise ValueError(f"Invalid object key: {key}")

        # Validate file extension
        allowed_extensions = ['.csv', '.json', '.parquet']
        if not any(key.lower().endswith(ext) for ext in allowed_extensions):
            raise ValueError(f"Unauthorized file type: {key}")

        # Process the validated file
        process_file(bucket, key)
```

### SLS-2: Broken Authentication

```typescript
// TypeScript - Proper JWT validation in Lambda authorizer
import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from 'aws-lambda';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: process.env.JWKS_URI!,
  cache: true,
  cacheMaxAge: 600000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      resolve(key!.getPublicKey());
    });
  });
}

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  const token = event.authorizationToken?.replace('Bearer ', '');

  if (!token) {
    throw new Error('Unauthorized');
  }

  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header.kid) {
      throw new Error('Invalid token');
    }

    const signingKey = await getSigningKey(decoded.header.kid);

    const verified = jwt.verify(token, signingKey, {
      issuer: process.env.TOKEN_ISSUER,
      audience: process.env.TOKEN_AUDIENCE,
      algorithms: ['RS256'],
      clockTolerance: 30,
    }) as jwt.JwtPayload;

    return generatePolicy(
      verified.sub!,
      'Allow',
      event.methodArn,
      { userId: verified.sub!, scopes: verified.scope }
    );
  } catch (err) {
    console.error('Authentication failed:', err);
    throw new Error('Unauthorized');
  }
};

function generatePolicy(
  principalId: string,
  effect: string,
  resource: string,
  context: Record<string, string>
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  };
}
```

### SLS-3: Insecure Serverless Deployment Configuration

Covered in depth in sections 2 and 3 below.

### SLS-4: Over-Privileged Function Permissions

Covered in section 2 (Function-Level Permissions).

### SLS-5: Inadequate Function Monitoring and Logging

Covered in section 7 (Logging and Monitoring).

### SLS-6: Insecure Third-Party Dependencies

```bash
# Scan Lambda function dependencies
# Python
pip-audit --requirement requirements.txt --output json

# Node.js
npm audit --audit-level=high --json

# Go
govulncheck ./...

# Integrate into CI/CD
trivy fs --severity CRITICAL,HIGH --exit-code 1 ./src/
```

### SLS-7: Insecure Application Secrets Storage

Covered in section 4 (Secrets Management).

### SLS-8: Denial of Service and Financial Resource Exhaustion

Covered in section 5 (Function Timeout and Memory Limits).

### SLS-9: Serverless Functions Execution Flow Manipulation

```python
# Python - Prevent execution flow manipulation
# Validate that chained function calls come from expected sources
import json
import hmac
import hashlib
import os

def validate_internal_event(event: dict) -> bool:
    """Validate that an event came from a trusted internal source."""
    signature = event.get('headers', {}).get('x-internal-signature')
    if not signature:
        return False

    payload = json.dumps(event.get('body', {}), sort_keys=True)
    secret = os.environ['INTERNAL_SIGNING_SECRET']

    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected)
```

### SLS-10: Improper Exception Handling and Verbose Error Messages

```typescript
// TypeScript - Proper error handling (never leak internal details)
export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    const result = await processRequest(event);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    // Log full error internally
    console.error('Internal error:', JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestId: event.requestContext.requestId,
      path: event.path,
    }));

    // Return generic error to client (never expose internals)
    if (error instanceof ValidationError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request' }),
      };
    }

    // NEVER return stack traces, SQL errors, or internal paths
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        requestId: event.requestContext.requestId,
      }),
    };
  }
};
```

---

## 2. Function-Level Permissions (Least Privilege IAM)

Each serverless function should have its own IAM role with only the permissions it
needs. Never share IAM roles across functions.

### 2.1 AWS Lambda Least Privilege

```yaml
# AWS SAM template - per-function IAM policies
AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 30
    MemorySize: 256
    Tracing: Active  # Enable X-Ray
    Environment:
      Variables:
        LOG_LEVEL: "info"

Resources:
  # Function 1: Read orders from DynamoDB
  GetOrderFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/getOrder.handler
      CodeUri: src/
      Policies:
        # Only DynamoDB read access to specific table
        - DynamoDBReadPolicy:
            TableName: !Ref OrdersTable
        # Only read access to specific SSM parameters
        - SSMParameterReadPolicy:
            ParameterName: /production/orders/*
      Events:
        GetOrder:
          Type: Api
          Properties:
            Path: /orders/{id}
            Method: get

  # Function 2: Create orders (different permissions)
  CreateOrderFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/createOrder.handler
      CodeUri: src/
      Policies:
        # DynamoDB write access to specific table
        - DynamoDBCrudPolicy:
            TableName: !Ref OrdersTable
        # SQS send permission to specific queue
        - SQSSendMessagePolicy:
            QueueName: !GetAtt OrderProcessingQueue.QueueName
        # S3 read for product catalog
        - S3ReadPolicy:
            BucketName: !Ref ProductCatalogBucket
      Events:
        CreateOrder:
          Type: Api
          Properties:
            Path: /orders
            Method: post

  # Function 3: Process payments (most restricted)
  ProcessPaymentFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/processPayment.handler
      CodeUri: src/
      # Custom IAM policy with exact permissions
      Policies:
        - Version: "2012-10-17"
          Statement:
            - Effect: Allow
              Action:
                - secretsmanager:GetSecretValue
              Resource:
                - !Sub "arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:production/payments/stripe-*"
            - Effect: Allow
              Action:
                - dynamodb:UpdateItem
              Resource:
                - !GetAtt OrdersTable.Arn
              Condition:
                ForAllValues:StringEquals:
                  dynamodb:Attributes:
                    - paymentStatus
                    - paymentId
                    - updatedAt
            - Effect: Allow
              Action:
                - kms:Decrypt
              Resource:
                - !GetAtt PaymentKMSKey.Arn
      # VPC configuration for accessing private resources
      VpcConfig:
        SecurityGroupIds:
          - !Ref PaymentFunctionSG
        SubnetIds:
          - !Ref PrivateSubnet1
          - !Ref PrivateSubnet2
```

### 2.2 Terraform Lambda Permissions

```hcl
# Terraform - Per-function IAM with least privilege
resource "aws_iam_role" "get_order" {
  name = "get-order-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "get_order" {
  name = "get-order-policy"
  role = aws_iam_role.get_order.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBRead"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.orders.arn,
          "${aws_dynamodb_table.orders.arn}/index/*"
        ]
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.get_order.arn}:*"
      },
      {
        Sid    = "XRayTracing"
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
}
```

---

## 3. Shared Responsibility in FaaS

### 3.1 Responsibility Matrix for Serverless

```
+-------------------------------+-----------+-----------+
| Responsibility                | Provider  | Customer  |
+-------------------------------+-----------+-----------+
| Physical infrastructure       | Provider  |           |
| Host OS / hypervisor          | Provider  |           |
| Container runtime             | Provider  |           |
| Runtime language patches      | Provider  |           |
| Function code security        |           | Customer  |
| Dependency vulnerabilities    |           | Customer  |
| IAM configuration             |           | Customer  |
| Input validation              |           | Customer  |
| Secrets management            |           | Customer  |
| Network configuration         | Shared    | Shared    |
| Logging and monitoring        | Shared    | Customer  |
| Data encryption               | Shared    | Customer  |
+-------------------------------+-----------+-----------+
```

### 3.2 Platform-Specific Security Configuration

```python
# GCP Cloud Functions - security configuration
# main.py
import functions_framework
from google.cloud import secretmanager
import os

# Use Workload Identity - no service account keys needed
secret_client = secretmanager.SecretManagerServiceClient()

@functions_framework.http
def handle_request(request):
    """HTTP Cloud Function with security best practices."""

    # Validate origin
    allowed_origins = os.environ.get('ALLOWED_ORIGINS', '').split(',')
    origin = request.headers.get('Origin', '')
    if origin not in allowed_origins:
        return ('Forbidden', 403)

    # Validate content type
    if request.content_type != 'application/json':
        return ('Unsupported Media Type', 415)

    # Retrieve secrets securely
    secret_name = f"projects/{os.environ['PROJECT_ID']}/secrets/api-key/versions/latest"
    response = secret_client.access_secret_version(name=secret_name)
    api_key = response.payload.data.decode('UTF-8')

    # Process request with validated input
    data = request.get_json(silent=True)
    if not data:
        return ('Bad Request', 400)

    return process_data(data, api_key)
```

```go
// Go - Azure Functions security example
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"
    "time"

    "github.com/Azure/azure-sdk-for-go/sdk/azidentity"
    "github.com/Azure/azure-sdk-for-go/sdk/keyvault/azsecrets"
    "github.com/go-playground/validator/v10"
)

type OrderRequest struct {
    ProductID string `json:"product_id" validate:"required,uuid"`
    Quantity  int    `json:"quantity" validate:"required,min=1,max=100"`
    UserID    string `json:"user_id" validate:"required,uuid"`
}

var (
    validate    *validator.Validate
    vaultClient *azsecrets.Client
)

func init() {
    validate = validator.New()

    // Use managed identity (no credentials in code)
    cred, err := azidentity.NewDefaultAzureCredential(nil)
    if err != nil {
        log.Fatalf("failed to create credential: %v", err)
    }

    vaultURL := os.Getenv("KEY_VAULT_URL")
    vaultClient, err = azsecrets.NewClient(vaultURL, cred, nil)
    if err != nil {
        log.Fatalf("failed to create vault client: %v", err)
    }
}

func HandleOrder(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Set security headers
    w.Header().Set("Content-Type", "application/json")
    w.Header().Set("X-Content-Type-Options", "nosniff")

    // Parse and validate input
    var req OrderRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, `{"error":"Invalid JSON"}`, http.StatusBadRequest)
        return
    }

    if err := validate.Struct(req); err != nil {
        http.Error(w, `{"error":"Validation failed"}`, http.StatusBadRequest)
        return
    }

    // Get secret from Key Vault using managed identity
    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()

    secret, err := vaultClient.GetSecret(ctx, "payment-api-key", "", nil)
    if err != nil {
        log.Printf("failed to get secret: %v", err)
        http.Error(w, `{"error":"Internal error"}`, http.StatusInternalServerError)
        return
    }

    _ = secret // Use secret for payment processing

    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(map[string]string{"status": "created"})
}

func main() {
    http.HandleFunc("/api/orders", HandleOrder)
    port := os.Getenv("FUNCTIONS_CUSTOMHANDLER_PORT")
    if port == "" {
        port = "8080"
    }
    log.Fatal(http.ListenAndServe(":"+port, nil))
}
```

---

## 4. Secrets Management for Serverless

### 4.1 Environment Variables with KMS Encryption

```yaml
# AWS SAM - Encrypted environment variables
Resources:
  MyFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handler.main
      Runtime: python3.12
      KmsKeyArn: !GetAtt FunctionKMSKey.Arn
      Environment:
        Variables:
          # Non-sensitive configuration
          TABLE_NAME: !Ref OrdersTable
          LOG_LEVEL: "info"
          # NEVER put actual secrets here - use Secrets Manager instead
          # DB_PASSWORD: "secret123"  # NEVER DO THIS
```

### 4.2 AWS Secrets Manager Integration

```typescript
// TypeScript - Cached secrets retrieval for Lambda
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

class SecretCache {
  private client: SecretsManagerClient;
  private cache: Map<string, { value: string; expiry: number }>;
  private ttlMs: number;

  constructor(ttlMs = 300000) { // 5-minute cache
    this.client = new SecretsManagerClient({});
    this.cache = new Map();
    this.ttlMs = ttlMs;
  }

  async getSecret(secretId: string): Promise<string> {
    const now = Date.now();
    const cached = this.cache.get(secretId);

    if (cached && cached.expiry > now) {
      return cached.value;
    }

    const response = await this.client.send(
      new GetSecretValueCommand({ SecretId: secretId })
    );

    const value = response.SecretString!;
    this.cache.set(secretId, {
      value,
      expiry: now + this.ttlMs,
    });

    return value;
  }
}

// Initialize outside handler for reuse across invocations
const secretCache = new SecretCache();

export const handler = async (event: any) => {
  // Retrieve secret (cached between invocations)
  const dbCredentials = JSON.parse(
    await secretCache.getSecret('production/database/credentials')
  );

  const stripeKey = await secretCache.getSecret('production/payments/stripe-key');

  // Use secrets
  const db = connectToDatabase(dbCredentials);
  // ...
};
```

### 4.3 SSM Parameter Store

```python
# Python - Lambda with SSM Parameter Store
import boto3
import os
from functools import lru_cache

ssm_client = boto3.client('ssm')

@lru_cache(maxsize=32)
def get_parameter(name: str) -> str:
    """Get and cache SSM parameter value."""
    response = ssm_client.get_parameter(
        Name=name,
        WithDecryption=True
    )
    return response['Parameter']['Value']

def handler(event, context):
    # Retrieve parameters (cached in memory)
    db_host = get_parameter('/production/database/host')
    db_password = get_parameter('/production/database/password')
    api_key = get_parameter('/production/api/third-party-key')

    # Use parameters
    return process_event(event, db_host, db_password, api_key)
```

---

## 5. Function Timeout and Memory Limits

Set appropriate timeout and memory limits to prevent resource exhaustion attacks and
runaway costs.

```yaml
# AWS SAM - Function resource limits
Resources:
  ProcessOrderFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handler.processOrder
      Runtime: python3.12
      # Set appropriate timeout (not maximum)
      Timeout: 30          # seconds (max is 900)
      MemorySize: 256      # MB (minimum needed)
      ReservedConcurrentExecutions: 100  # Limit max concurrent executions
      # Prevent runaway costs
      # Set billing alarm as additional protection
      EphemeralStorage:
        Size: 512  # MB for /tmp (minimum needed)

  # API Gateway throttling
  ApiGateway:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      MethodSettings:
        - HttpMethod: "*"
          ResourcePath: "/*"
          ThrottlingBurstLimit: 100
          ThrottlingRateLimit: 50
```

```hcl
# Terraform - Lambda with concurrency and timeout limits
resource "aws_lambda_function" "process_order" {
  function_name = "process-order"
  handler       = "handler.processOrder"
  runtime       = "python3.12"
  timeout       = 30
  memory_size   = 256

  reserved_concurrent_executions = 100

  ephemeral_storage {
    size = 512
  }

  dead_letter_config {
    target_arn = aws_sqs_queue.dlq.arn
  }

  tracing_config {
    mode = "Active"
  }
}

# AWS Budget alarm for Lambda cost protection
resource "aws_budgets_budget" "lambda_cost" {
  name         = "lambda-monthly-budget"
  budget_type  = "COST"
  limit_amount = "500"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "Service"
    values = ["AWS Lambda"]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_email_addresses = ["security-team@example.com"]
  }
}
```

---

## 6. VPC Configuration for Serverless

```hcl
# Terraform - Lambda in VPC for private resource access
resource "aws_lambda_function" "db_processor" {
  function_name = "db-processor"
  handler       = "handler.process"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 512

  role = aws_iam_role.db_processor.arn

  vpc_config {
    subnet_ids         = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_group_ids = [aws_security_group.lambda_sg.id]
  }

  environment {
    variables = {
      DB_HOST     = aws_rds_instance.main.address
      DB_NAME     = "production"
      SECRETS_ARN = aws_secretsmanager_secret.db_creds.arn
    }
  }
}

resource "aws_security_group" "lambda_sg" {
  name_prefix = "lambda-db-processor-"
  vpc_id      = aws_vpc.main.id

  # No ingress rules needed for Lambda
  egress {
    description     = "Database access"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.db.id]
  }

  egress {
    description     = "Secrets Manager via VPC endpoint"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    prefix_list_ids = [aws_vpc_endpoint.secretsmanager.prefix_list_id]
  }
}

# VPC endpoint for Secrets Manager (keep traffic private)
resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.us-east-1.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  security_group_ids  = [aws_security_group.vpc_endpoint.id]
  private_dns_enabled = true
}
```

---

## 7. Logging and Monitoring

### 7.1 Structured Logging

```typescript
// TypeScript - Structured logging for Lambda
interface LogEntry {
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  requestId: string;
  functionName: string;
  correlationId?: string;
  userId?: string;
  action?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    // Never include stack traces in production logs
  };
  // Never log PII, secrets, or sensitive data
}

class Logger {
  private functionName: string;
  private requestId: string;

  constructor(functionName: string, requestId: string) {
    this.functionName = functionName;
    this.requestId = requestId;
  }

  private log(entry: LogEntry): void {
    // Use JSON for CloudWatch structured logging
    console.log(JSON.stringify(entry));
  }

  info(message: string, extra?: Partial<LogEntry>): void {
    this.log({
      level: 'INFO',
      message,
      requestId: this.requestId,
      functionName: this.functionName,
      ...extra,
    });
  }

  error(message: string, error: Error, extra?: Partial<LogEntry>): void {
    this.log({
      level: 'ERROR',
      message,
      requestId: this.requestId,
      functionName: this.functionName,
      error: {
        name: error.name,
        message: error.message,
        // Do NOT include error.stack in production
      },
      ...extra,
    });
  }
}

// Usage in handler
export const handler = async (event: any, context: any) => {
  const logger = new Logger(
    context.functionName,
    context.awsRequestId
  );

  logger.info('Processing request', {
    action: 'processOrder',
    correlationId: event.headers?.['x-correlation-id'],
  });

  try {
    const result = await processOrder(event);
    logger.info('Order processed successfully', {
      action: 'processOrder',
      duration: Date.now() - startTime,
    });
    return result;
  } catch (error) {
    logger.error('Failed to process order', error as Error, {
      action: 'processOrder',
    });
    throw error;
  }
};
```

### 7.2 CloudWatch Alarms and X-Ray

```yaml
# CloudFormation - Lambda monitoring
Resources:
  ErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub "${FunctionName}-errors"
      MetricName: Errors
      Namespace: AWS/Lambda
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 1
      Threshold: 5
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: FunctionName
          Value: !Ref ProcessOrderFunction
      AlarmActions:
        - !Ref SecurityAlertTopic

  ThrottleAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub "${FunctionName}-throttles"
      MetricName: Throttles
      Namespace: AWS/Lambda
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 1
      Threshold: 10
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: FunctionName
          Value: !Ref ProcessOrderFunction
      AlarmActions:
        - !Ref SecurityAlertTopic

  DurationAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub "${FunctionName}-duration"
      MetricName: Duration
      Namespace: AWS/Lambda
      Statistic: Average
      Period: 300
      EvaluationPeriods: 3
      Threshold: 25000  # 25 seconds (close to 30s timeout)
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: FunctionName
          Value: !Ref ProcessOrderFunction
      AlarmActions:
        - !Ref SecurityAlertTopic
```

---

## 8. Serverless Framework Security

### 8.1 Serverless Framework Configuration

```yaml
# serverless.yml - Security-hardened configuration
service: my-secure-app

frameworkVersion: "3"

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  stage: ${opt:stage, 'dev'}
  memorySize: 256
  timeout: 30

  # Enable X-Ray tracing
  tracing:
    lambda: true
    apiGateway: true

  # API Gateway settings
  apiGateway:
    minimumCompressionSize: 1024
    metrics: true

  # Default IAM role (minimal)
  iam:
    role:
      statements: []  # No default permissions

  # Environment encryption
  environment:
    TABLE_NAME: !Ref OrdersTable
    # Never put secrets here

  # VPC configuration
  vpc:
    securityGroupIds:
      - !Ref LambdaSecurityGroup
    subnetIds:
      - !Ref PrivateSubnet1
      - !Ref PrivateSubnet2

functions:
  getOrder:
    handler: src/handlers/getOrder.handler
    # Per-function IAM (least privilege)
    iamRoleStatements:
      - Effect: Allow
        Action:
          - dynamodb:GetItem
          - dynamodb:Query
        Resource:
          - !GetAtt OrdersTable.Arn
    events:
      - http:
          path: /orders/{id}
          method: get
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId: !Ref ApiAuthorizer

  createOrder:
    handler: src/handlers/createOrder.handler
    iamRoleStatements:
      - Effect: Allow
        Action:
          - dynamodb:PutItem
        Resource:
          - !GetAtt OrdersTable.Arn
      - Effect: Allow
        Action:
          - sqs:SendMessage
        Resource:
          - !GetAtt ProcessingQueue.Arn
    events:
      - http:
          path: /orders
          method: post
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId: !Ref ApiAuthorizer

plugins:
  - serverless-iam-roles-per-function  # Per-function IAM
  - serverless-offline                  # Local development only

custom:
  # Disable plugins in production that should only be used in development
  serverless-offline:
    stages:
      - dev
```

### 8.2 AWS SST (Serverless Stack) Security

```typescript
// SST v3 - Security configuration
import { Api, Table, Function } from 'sst/constructs';

export function API({ stack }: StackContext) {
  const table = new Table(stack, 'Orders', {
    fields: {
      id: 'string',
      userId: 'string',
    },
    primaryIndex: { partitionKey: 'id' },
    // Enable encryption
    cdk: {
      table: {
        encryption: TableEncryption.CUSTOMER_MANAGED,
        encryptionKey: kmsKey,
        pointInTimeRecovery: true,
      },
    },
  });

  const api = new Api(stack, 'Api', {
    defaults: {
      function: {
        timeout: '30 seconds',
        memorySize: '256 MB',
        // Bind permissions per route below
      },
    },
    routes: {
      'GET /orders/{id}': {
        function: {
          handler: 'packages/functions/src/getOrder.handler',
          bind: [table],
          permissions: [
            // Only DynamoDB read
            new iam.PolicyStatement({
              actions: ['dynamodb:GetItem'],
              resources: [table.tableArn],
            }),
          ],
        },
      },
    },
  });
}
```

---

## 9. Dependency Vulnerabilities in Lambda Layers

```bash
# Create a secure Lambda layer with audited dependencies
# Step 1: Install production dependencies only
mkdir -p layer/nodejs
cd layer/nodejs
npm init -y
npm install --production --package-lock-only
npm ci --only=production

# Step 2: Audit dependencies
npm audit --audit-level=high
# If vulnerabilities found, fix before proceeding

# Step 3: Scan with Trivy
trivy fs --severity CRITICAL,HIGH --exit-code 1 .

# Step 4: Package layer
cd ..
zip -r layer.zip nodejs/

# Step 5: Publish layer with version tracking
aws lambda publish-layer-version \
  --layer-name my-app-dependencies \
  --zip-file fileb://layer.zip \
  --compatible-runtimes nodejs20.x \
  --description "Audited dependencies v1.2.3 - $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

---

## 10. Best Practices

1. **Apply least-privilege IAM per function** -- each function should have its own IAM
   role with only the exact permissions it needs; never share roles across functions;
   use resource-level permissions with condition keys.

2. **Validate all event input data** -- treat all event data (API Gateway, S3, SQS,
   SNS, DynamoDB Streams) as untrusted; use schema validation libraries (Zod, Pydantic,
   go-playground/validator) for strict input validation.

3. **Never store secrets in environment variables or code** -- use AWS Secrets Manager,
   SSM Parameter Store, GCP Secret Manager, or Azure Key Vault; cache secrets in memory
   between invocations to reduce latency and API calls.

4. **Set appropriate timeout and memory limits** -- use the minimum timeout and memory
   needed; set reserved concurrency to prevent runaway costs; configure budget alarms
   as financial safety nets.

5. **Enable tracing and structured logging** -- use AWS X-Ray, GCP Cloud Trace, or
   Azure Application Insights for distributed tracing; use JSON structured logging for
   searchability; never log secrets or PII.

6. **Scan dependencies continuously** -- run npm audit, pip-audit, or govulncheck in
   CI/CD; scan Lambda layers with Trivy; update dependencies regularly; pin versions.

7. **Use VPC for private resource access** -- place Lambda functions in VPCs when they
   need to access databases, caches, or internal services; use VPC endpoints for AWS
   service access to keep traffic private.

8. **Implement proper error handling** -- never expose internal error details, stack
   traces, or database errors to clients; log detailed errors internally; return
   generic error messages externally.

9. **Use managed identities and temporary credentials** -- use Lambda execution roles,
   GCP service accounts with Workload Identity, and Azure Managed Identities; never
   use long-lived access keys.

10. **Implement API Gateway security** -- use authorizers (Cognito, custom JWT),
    throttling, request validation, and WAF integration; enable API Gateway access
    logging.

---

## 11. Anti-Patterns

1. **Using a single IAM role for all functions** -- this violates least privilege; if
   one function is compromised, the attacker gains the combined permissions of all
   functions; create per-function roles.

2. **Storing secrets in environment variables in plaintext** -- environment variables
   are visible in the Lambda console and describe-function API calls; use a secrets
   manager with KMS encryption.

3. **Setting maximum timeout (15 minutes) on all functions** -- excessive timeouts
   allow denial-of-service and cost attacks; set the minimum timeout needed for the
   function to complete normally.

4. **Trusting event data without validation** -- event injection attacks exploit
   functions that process event data without sanitization; S3 object keys, SQS message
   bodies, and API Gateway inputs all require validation.

5. **Using the latest runtime without testing** -- runtime updates can introduce
   breaking changes; pin runtime versions and test before upgrading; use supported
   runtime versions only.

6. **Logging sensitive data** -- logging request bodies that contain passwords, tokens,
   or PII creates a data leak through CloudWatch Logs; sanitize all log output.

7. **Running functions without reserved concurrency limits** -- without concurrency
   limits, a spike in invocations can exhaust account-level concurrency, affecting
   other functions, and generate large bills.

8. **Sharing Lambda layers across security boundaries** -- layers shared between
   production and development or between teams can introduce supply chain risks;
   maintain separate layers for different environments.

---

## 12. Enforcement Checklist

### Function Security
- [ ] Each function has its own IAM role with least-privilege permissions
- [ ] No function IAM policy uses wildcard (*) for actions or resources
- [ ] Function timeout is set to the minimum needed (not maximum 900s)
- [ ] Memory is set to the minimum needed
- [ ] Reserved concurrency is configured for each function
- [ ] Dead letter queues are configured for async functions
- [ ] Functions use the latest supported runtime version

### Input Validation
- [ ] All API Gateway inputs are validated with request validators
- [ ] Function code validates and sanitizes all event data
- [ ] Schema validation is implemented for all request bodies
- [ ] Path traversal prevention is applied to S3 event handlers
- [ ] SQL injection prevention is applied to all database queries

### Secrets Management
- [ ] No secrets are stored in environment variables, code, or configuration files
- [ ] All secrets are retrieved from Secrets Manager, SSM, or Key Vault
- [ ] Secrets are cached in memory between invocations (not fetched per invocation)
- [ ] KMS encryption is enabled for function environment variables
- [ ] Secrets are rotated on a defined schedule

### Monitoring and Logging
- [ ] AWS X-Ray (or equivalent) tracing is enabled
- [ ] Structured JSON logging is implemented
- [ ] CloudWatch alarms are configured for errors, throttles, and duration
- [ ] Logs never contain secrets, PII, or stack traces
- [ ] Budget alarms are set for Lambda cost monitoring
- [ ] API Gateway access logging is enabled

### Network Security
- [ ] Functions accessing private resources are deployed in VPCs
- [ ] VPC endpoints are used for AWS service access
- [ ] Security groups restrict Lambda network access to required destinations
- [ ] No functions have unrestricted outbound internet access

### Dependencies
- [ ] Dependencies are audited (npm audit, pip-audit) in CI/CD
- [ ] Dependencies are scanned with Trivy or equivalent
- [ ] Lambda layers are versioned and audited separately
- [ ] No known critical or high vulnerabilities in production dependencies
