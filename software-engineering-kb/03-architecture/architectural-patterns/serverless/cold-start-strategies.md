# Serverless: Cold Start Strategies — Complete Specification

> **AI Plugin Directive:** A cold start occurs when a serverless function is invoked after being idle — the platform must initialize a new execution environment (download code, start runtime, run initialization). Cold starts add 100ms to 10+ seconds of latency depending on runtime and configuration. MINIMIZE cold starts through code optimization, runtime selection, and provisioned concurrency. NEVER ignore cold starts for user-facing APIs.

---

## 1. What Causes Cold Starts

```
COLD START LIFECYCLE:
  1. Download function code/container image    (10-500ms)
  2. Start execution environment               (50-200ms)
  3. Initialize runtime (Node.js, Python, JVM) (10-5000ms)
  4. Run function initialization code          (1-5000ms)
  5. Execute handler                           (your code)

Cold start = Steps 1-4 (added before your code runs)
Warm invocation = Step 5 only (no initialization)

COLD START TRIGGERS:
  - First invocation after deployment
  - Function idle for 5-15 minutes (varies by provider)
  - Scaling up (new instance needed for concurrent requests)
  - Memory/configuration change

WARM INVOCATION:
  - Reuses existing execution environment
  - Skips steps 1-4
  - Only runs the handler function
```

### Cold Start Duration by Runtime

```
┌───────────────┬──────────────────┬──────────────────────────┐
│ Runtime       │ Cold Start       │ Notes                    │
├───────────────┼──────────────────┼──────────────────────────┤
│ Node.js       │ 100-500ms        │ Fastest for most cases   │
│ Python        │ 100-500ms        │ Similar to Node.js       │
│ Go            │ 50-200ms         │ Compiled, very fast      │
│ Rust          │ 50-200ms         │ Compiled, very fast      │
│ .NET          │ 200-1500ms       │ Better with AOT compile  │
│ Java          │ 500-5000ms       │ JVM startup is heavy     │
│ Java (GraalVM)│ 200-800ms        │ Native image helps a lot │
│ Docker Image  │ 500-3000ms       │ Depends on image size    │
└───────────────┴──────────────────┴──────────────────────────┘

NOTE: These are approximate. Actual cold start depends on:
  - Code size (larger = slower download)
  - Dependency count (more = slower init)
  - Memory allocation (more memory = faster CPU)
  - VPC configuration (adds 1-10 seconds if in VPC)
```

---

## 2. Optimization Strategies

### Strategy 1: Minimize Package Size

```typescript
// BIGGEST impact: smaller code = faster download and initialization

// ❌ WRONG: Full SDK import (70MB+)
import AWS from 'aws-sdk';

// ✅ CORRECT: Specific client import (2-5MB)
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// ❌ WRONG: Heavy libraries
import moment from 'moment'; // 300KB
import lodash from 'lodash'; // 500KB

// ✅ CORRECT: Lightweight alternatives or native
import dayjs from 'dayjs'; // 7KB
const pick = (obj: any, keys: string[]) =>
  keys.reduce((acc, key) => ({ ...acc, [key]: obj[key] }), {}); // 2 lines

// Bundle with esbuild for tree-shaking
// esbuild src/handler.ts --bundle --platform=node --target=node20 --outfile=dist/handler.js --minify
```

### Strategy 2: Move Initialization Outside Handler

```typescript
// Code OUTSIDE the handler runs ONCE per cold start
// Code INSIDE the handler runs EVERY invocation

// ✅ CORRECT: Initialize outside handler (reused across warm invocations)
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// These run ONCE during cold start, then are reused
const dynamodb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;

// Connection is established on first use, then reused
let dbConnection: Pool | null = null;
function getDb(): Pool {
  if (!dbConnection) {
    dbConnection = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return dbConnection;
}

// Handler runs EVERY invocation — keep it lean
export const handler = async (event: APIGatewayProxyEvent) => {
  const db = getDb(); // Reuses existing connection
  const result = await db.query('SELECT * FROM orders WHERE id = $1', [event.pathParameters.id]);
  return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
};
```

### Strategy 3: Provisioned Concurrency

```yaml
# Pre-warm N instances — eliminates cold starts entirely
# Cost: You pay for idle provisioned instances

# Serverless Framework
functions:
  createOrder:
    handler: functions/orders/create-order.handler
    provisionedConcurrency: 5  # 5 warm instances always ready
    events:
      - httpApi:
          path: /orders
          method: post

# AWS CDK
const createOrderFn = new lambda.Function(this, 'CreateOrder', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'create-order.handler',
  code: lambda.Code.fromAsset('dist'),
});

// Auto-scaling provisioned concurrency
const target = new autoscaling.ScalableTarget(this, 'Scaling', {
  serviceNamespace: autoscaling.ServiceNamespace.LAMBDA,
  maxCapacity: 50,
  minCapacity: 5,
  resourceId: `function:${createOrderFn.functionName}:${alias.aliasName}`,
  scalableDimension: 'lambda:function:ProvisionedConcurrency',
});

target.scaleToTrackMetric('Tracking', {
  targetValue: 0.7,  // Scale when 70% of provisioned concurrency is used
  predefinedMetric: autoscaling.PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
});
```

```
PROVISIONED CONCURRENCY RULES:
  ✅ Use for user-facing APIs with latency requirements < 200ms
  ✅ Use for high-traffic functions where cold starts are frequent
  ✅ Use for scheduled functions that MUST start on time
  ❌ Don't use for infrequently called functions (wasteful)
  ❌ Don't use for event-processing functions where latency is acceptable
```

### Strategy 4: Increase Memory

```
MORE MEMORY = MORE CPU = FASTER COLD START

Lambda allocates CPU proportional to memory:
  128 MB  = ~0.1 vCPU  → Slow initialization
  256 MB  = ~0.2 vCPU
  512 MB  = ~0.3 vCPU
  1024 MB = ~0.6 vCPU
  1769 MB = 1.0 vCPU   → Sweet spot for most functions
  3008 MB = 2.0 vCPU   → For CPU-intensive functions
  10240 MB = 6 vCPU    → Maximum

PARADOX: More memory can be CHEAPER because:
  - You pay per GB-second (memory × duration)
  - 128MB × 1000ms = 128 GB-ms = $0.000002083
  - 512MB × 200ms  = 102 GB-ms = $0.000001667 (CHEAPER and FASTER)

USE AWS Lambda Power Tuning tool to find the optimal memory setting
```

### Strategy 5: Choose the Right Runtime

```
FOR LOWEST COLD START:
  1st: Go, Rust (compiled, no runtime overhead)
  2nd: Node.js, Python (lightweight runtimes)
  3rd: .NET with AOT compilation
  4th: Java with GraalVM native image
  Last: Java (standard JVM) — avoid for latency-sensitive functions

FOR NODE.JS:
  - Use ESM (import) not CJS (require) for tree-shaking
  - Bundle with esbuild
  - Avoid: express/fastify (heavy for Lambda, use middy instead)

FOR PYTHON:
  - Use Lambda layers for large dependencies
  - Avoid: Django/Flask (heavy, use mangum adapter or raw handler)
  - Use: powertools-python for structured logging, tracing
```

### Strategy 6: Avoid VPC (When Possible)

```
LAMBDA IN VPC adds significant cold start time:
  Without VPC: 100-500ms cold start
  With VPC: 1-10 seconds cold start (ENI attachment)

AWS has improved this (Hyperplane), but VPC still adds latency.

RULES:
  ✅ Put Lambda in VPC if it needs to access RDS, ElastiCache, or other VPC resources
  ❌ Don't put Lambda in VPC just "for security" if it only accesses DynamoDB, S3, SQS
      → These services are accessible via the public internet with IAM auth
  ✅ Use VPC endpoints for AWS services instead of NAT Gateway when in VPC
```

---

## 3. Cold Start Monitoring

```typescript
// Track cold starts to understand their impact

// Method 1: Check if global variables are initialized
let isWarm = false;

export const handler = async (event: any) => {
  const isColdStart = !isWarm;
  isWarm = true;

  console.log(JSON.stringify({
    level: 'info',
    message: 'Function invoked',
    coldStart: isColdStart,
    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    requestId: event.requestContext?.requestId,
  }));

  // ... handler logic
};

// Method 2: Use Lambda Powertools
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'order-service' });
// Powertools automatically logs cold start status

// Method 3: CloudWatch Metrics
// Create custom metric for cold start duration
// Set up alarm: Alert if cold start rate > 10% or duration > 2 seconds
```

---

## 4. Decision Guide

```
Is this function user-facing with < 200ms latency requirement?
├── YES → Provisioned concurrency + optimized code + 1769MB memory
└── NO → Continue

Is this function called frequently (> 100/min)?
├── YES → Cold starts are rare (platform keeps it warm)
│         → Focus on code optimization only
└── NO → Continue

Is occasional 500ms-2s latency acceptable?
├── YES → Optimize code (minimal deps, init outside handler)
│         → No provisioned concurrency needed
└── NO → Use provisioned concurrency

Is this a Java/.NET function?
├── YES → Consider GraalVM native image / .NET AOT
│         → Or switch to Node.js/Python/Go for this function
└── NO → Standard optimization is sufficient
```

---

## 5. Enforcement Checklist

- [ ] **Package size < 5MB** — bundled and tree-shaken
- [ ] **Initialization outside handler** — SDK clients, DB connections created once
- [ ] **Right-sized memory** — tested with Power Tuning tool
- [ ] **Provisioned concurrency for critical paths** — user-facing APIs with latency SLAs
- [ ] **VPC avoided unless necessary** — only when accessing VPC resources
- [ ] **Cold start monitored** — custom metric or Powertools logging
- [ ] **Runtime appropriate** — Node.js/Python/Go preferred over Java for latency-sensitive functions
- [ ] **Minimal SDK imports** — specific client imports, not full SDK
- [ ] **Bundle optimized** — esbuild/webpack with tree-shaking and minification
- [ ] **Connection reuse** — DB connections, HTTP clients reused across warm invocations
