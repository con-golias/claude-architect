# AWS Architecture Patterns

| Attribute    | Value                                                                              |
|--------------|------------------------------------------------------------------------------------|
| Domain       | DevOps > Cloud > AWS                                                               |
| Importance   | High                                                                               |
| Last Updated | 2026-03-10                                                                         |
| Cross-ref    | [Core Services](core-services.md), [Provider Comparison](../provider-comparison.md)|

---

## Core Concepts

### AWS Well-Architected Framework (6 Pillars)

The Well-Architected Framework provides a consistent approach to evaluating architectures
against best practices. Run Well-Architected reviews via the AWS console tool or programmatically.

| Pillar                     | Focus Area                                    | Key Question                                  |
|----------------------------|-----------------------------------------------|-----------------------------------------------|
| **Operational Excellence** | Runbooks, IaC, observability, CI/CD           | Can you detect and respond to issues fast?     |
| **Security**               | IAM, encryption, detection, incident response | Is every layer protected by least privilege?   |
| **Reliability**            | HA, DR, fault isolation, auto-recovery        | Can the system withstand component failures?   |
| **Performance Efficiency** | Right-sizing, scaling, benchmarking            | Are you using the right resource types?        |
| **Cost Optimization**      | Right-sizing, pricing models, waste removal   | Are you paying only for what you use?          |
| **Sustainability**         | Region selection, efficient code, utilization | Are you minimizing environmental impact?       |

> Conduct a Well-Architected Review at least once per quarter for production workloads.

---

### Three-Tier Web Architecture

The foundational pattern for most web applications on AWS.

```
                        ┌──────────────┐
                        │  CloudFront  │
                        │    (CDN)     │
                        └──────┬───────┘
                               │
                        ┌──────┴───────┐
                        │   Route 53   │
                        │    (DNS)     │
                        └──────┬───────┘
                               │
               ┌───────────────┼───────────────┐
               │               │               │
        ┌──────┴──────┐ ┌─────┴──────┐ ┌──────┴──────┐
        │   ALB (AZ-a)│ │  ALB (AZ-b)│ │  ALB (AZ-c) │
        └──────┬──────┘ └─────┬──────┘ └──────┬──────┘
               │               │               │
     ┌─────────┴─────┐ ┌─────┴──────┐ ┌──────┴──────┐
     │ App Tier (ASG) │ │ App Tier   │ │ App Tier    │   ← Private subnets
     │ ECS / EC2      │ │ ECS / EC2  │ │ ECS / EC2   │
     └─────────┬─────┘ └─────┬──────┘ └──────┬──────┘
               │               │               │
        ┌──────┴───────────────┴───────────────┴──────┐
        │        Aurora / RDS (Multi-AZ)               │   ← Database subnets
        │        ElastiCache (cluster mode)            │
        └─────────────────────────────────────────────┘
```

**Key decisions:**
- ALB for HTTP/HTTPS routing with path-based rules
- Auto Scaling Group or ECS service for the application tier
- Aurora Multi-AZ for the database tier with read replicas for read-heavy workloads
- ElastiCache (Valkey/Redis) for session state and application caching
- CloudFront in front of ALB for global latency reduction and DDoS mitigation

```typescript
// AWS CDK -- Three-tier skeleton
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";

// Networking tier
const vpc = new ec2.Vpc(this, "Vpc", {
  maxAzs: 3,
  natGateways: 3,
  subnetConfiguration: [
    { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
    { name: "App", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
    { name: "DB", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
  ],
});

// Application tier
const cluster = new ecs.Cluster(this, "Cluster", { vpc, containerInsights: true });
const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Web", {
  cluster,
  cpu: 1024,
  memoryLimitMiB: 2048,
  desiredCount: 3,
  taskImageOptions: {
    image: ecs.ContainerImage.fromEcrRepository(repo),
    containerPort: 8080,
  },
  runtimePlatform: {
    cpuArchitecture: ecs.CpuArchitecture.ARM64,
    operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
  },
});

// Database tier
const db = new rds.DatabaseCluster(this, "DB", {
  engine: rds.DatabaseClusterEngine.auroraPostgres({
    version: rds.AuroraPostgresEngineVersion.VER_16_4,
  }),
  writer: rds.ClusterInstance.serverlessV2("writer"),
  readers: [rds.ClusterInstance.serverlessV2("reader")],
  vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
  serverlessV2MinCapacity: 1,
  serverlessV2MaxCapacity: 16,
});
```

---

### Serverless Patterns

#### API Gateway + Lambda + DynamoDB

The canonical serverless stack. Zero infrastructure management.

```
  Client → API Gateway (HTTP API) → Lambda → DynamoDB
                                      ↓
                                  CloudWatch Logs
```

```typescript
// AWS CDK -- Serverless REST API
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

const table = new dynamodb.TableV2(this, "Items", {
  partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
  sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
  billing: dynamodb.Billing.onDemand(),
  pointInTimeRecovery: true,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});

const handler = new lambda.Function(this, "ApiHandler", {
  runtime: lambda.Runtime.NODEJS_22_X,
  architecture: lambda.Architecture.ARM_64,
  handler: "index.handler",
  code: lambda.Code.fromAsset("dist/api"),
  environment: { TABLE_NAME: table.tableName },
  timeout: cdk.Duration.seconds(10),
});

table.grantReadWriteData(handler);

const httpApi = new apigw.HttpApi(this, "HttpApi", { corsPreflight: { allowOrigins: ["*"] } });
httpApi.addRoutes({
  path: "/items/{id}",
  methods: [apigw.HttpMethod.GET, apigw.HttpMethod.PUT],
  integration: new integrations.HttpLambdaIntegration("LambdaIntegration", handler),
});
```

#### Step Functions Orchestration

Use Step Functions for multi-step workflows that need retries, error handling, parallel
execution, and human approval gates. Express Workflows for high-volume, short-duration (<5 min).
Standard Workflows for long-running processes (up to 1 year).

```
  ┌──────────┐    ┌───────────┐    ┌──────────────┐    ┌─────────┐
  │ Validate │───→│ Process   │───→│ Send         │───→│ Complete│
  │  Input   │    │  Payment  │    │ Notification │    │         │
  └──────────┘    └─────┬─────┘    └──────────────┘    └─────────┘
                        │ (on error)
                   ┌────┴────┐
                   │  Retry  │ → DLQ after 3 attempts
                   └─────────┘
```

```json
{
  "Comment": "Order processing workflow",
  "StartAt": "ValidateInput",
  "States": {
    "ValidateInput": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789:function:validate",
      "Next": "ProcessPayment",
      "Retry": [{ "ErrorEquals": ["States.TaskFailed"], "MaxAttempts": 2, "BackoffRate": 2 }]
    },
    "ProcessPayment": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789:function:payment",
      "Next": "SendNotification",
      "Catch": [{ "ErrorEquals": ["States.ALL"], "Next": "HandleFailure" }]
    },
    "SendNotification": {
      "Type": "Task",
      "Resource": "arn:aws:states:::sns:publish",
      "Parameters": {
        "TopicArn": "arn:aws:sns:us-east-1:123456789:order-notifications",
        "Message.$": "$.result"
      },
      "End": true
    },
    "HandleFailure": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789:function:handleError",
      "End": true
    }
  }
}
```

---

### Event-Driven Architecture

#### EventBridge + SQS + Lambda

Decouple services through events. EventBridge routes events by content; SQS buffers
for resilience; Lambda processes.

```
  ┌──────────┐    ┌─────────────┐    ┌───────┐    ┌─────────┐
  │ Service A│───→│ EventBridge │───→│  SQS  │───→│ Lambda  │
  │ (publish)│    │   (route)   │    │(buffer)│    │(process)│
  └──────────┘    └──────┬──────┘    └───────┘    └─────────┘
                         │
                         ├──→ SQS Queue B → Lambda B (analytics)
                         │
                         └──→ Archive (replay up to 90 days)
```

**Design rules for event-driven on AWS:**
- Publish events to EventBridge, not directly to SQS
- Place SQS between EventBridge and Lambda for buffering and retry control
- Enable EventBridge archive for event replay during debugging
- Define events with a schema in EventBridge Schema Registry
- Use idempotency tokens in events -- consumers must handle duplicates

```typescript
// Producer: publish to EventBridge
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const client = new EventBridgeClient({});

async function publishOrderEvent(order: Order): Promise<void> {
  await client.send(new PutEventsCommand({
    Entries: [{
      Source: "com.myapp.orders",
      DetailType: "OrderCreated",
      Detail: JSON.stringify({
        orderId: order.id,
        customerId: order.customerId,
        amount: order.totalCents,
        idempotencyKey: order.idempotencyKey,
      }),
      EventBusName: "app-events",
    }],
  }));
}
```

---

### Microservices on ECS/EKS

#### ECS Service Mesh with Cloud Map

```
  ┌─────────┐     ┌─────────────────┐     ┌─────────┐
  │ ALB     │────→│ Frontend Service │────→│ API GW  │
  └─────────┘     │ (ECS Fargate)   │     │ (internal)│
                  └─────────────────┘     └────┬────┘
                                                │
                    ┌───────────────┬───────────┴──────────┐
                    │               │                      │
             ┌──────┴──────┐ ┌─────┴──────┐  ┌───────────┴──┐
             │ Order Svc   │ │ Payment Svc│  │ Inventory Svc│
             │ (Fargate)   │ │ (Fargate)  │  │ (Fargate)    │
             └──────┬──────┘ └─────┬──────┘  └───────┬──────┘
                    │              │                  │
               ┌────┴───┐    ┌────┴───┐        ┌────┴────┐
               │ Aurora  │    │DynamoDB│        │ Aurora   │
               └────────┘    └────────┘        └─────────┘
```

**ECS vs EKS decision matrix:**

| Factor                 | ECS                          | EKS                              |
|------------------------|------------------------------|----------------------------------|
| Operational complexity | Lower (AWS-native)           | Higher (Kubernetes expertise)    |
| Ecosystem              | AWS-only                     | CNCF, Helm, Istio, Argo         |
| Portability            | AWS lock-in                  | Multi-cloud possible             |
| Service mesh           | App Mesh or Cloud Map        | Istio, Linkerd, App Mesh         |
| Best for               | AWS-native shops, simplicity | Multi-cloud, existing K8s teams  |

Use AWS Cloud Map for service discovery. ECS integrates natively: services register
automatically and resolve via DNS or API.

---

### Data Lake Architecture

```
  ┌─────────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ Data Sources│───→│  Kinesis  │───→│  S3 Raw  │───→│  Glue    │
  │ (apps, IoT) │    │ Firehose  │    │ (landing)│    │  ETL     │
  └─────────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                          │
  ┌─────────────┐    ┌──────────┐    ┌──────────┐    ┌───┴──────┐
  │  QuickSight │←───│  Athena  │←───│S3 Curated│←───│ S3 Clean │
  │  (BI)       │    │  (query) │    │(analytics)│   │ (staged) │
  └─────────────┘    └──────────┘    └──────────┘    └──────────┘
                                          │
                                     ┌────┴────┐
                                     │Glue Data│
                                     │ Catalog │
                                     └─────────┘
```

**Medallion architecture on S3:**

| Layer    | S3 Prefix     | Format  | Purpose                            |
|----------|---------------|---------|------------------------------------|
| Bronze   | s3://lake/raw/| JSON/CSV| Raw ingestion, immutable           |
| Silver   | s3://lake/clean/| Parquet| Cleaned, deduplicated, typed       |
| Gold     | s3://lake/curated/| Parquet| Business-level aggregations, joins |

**Key services:**
- **Glue** -- Managed Spark ETL + Data Catalog (Hive metastore compatible)
- **Athena** -- Serverless SQL on S3 (Presto/Trino engine, pay per TB scanned)
- **Lake Formation** -- Centralized data lake governance and permissions
- **Redshift Serverless** -- Data warehouse for complex analytics

> Use Parquet or ORC columnar formats. Partition by date. This reduces Athena scan costs by 90%+.

---

### Real-Time Streaming

```
  Producers ──→ Kinesis Data Streams ──→ Lambda (real-time) ──→ DynamoDB
                        │
                        ├──→ Kinesis Firehose ──→ S3 (archive)
                        │
                        └──→ Amazon MSK Consumer ──→ Custom Processing
```

**Kinesis Data Streams vs Amazon MSK (Kafka):**

| Factor             | Kinesis Data Streams     | Amazon MSK               |
|--------------------|--------------------------|--------------------------|
| Operations         | Serverless (on-demand)   | Managed but cluster-based|
| Retention          | 24h-365 days             | Unlimited (tiered storage)|
| Consumer model     | KCL, Lambda              | Kafka consumer groups    |
| Throughput         | Per-shard (1 MB/s in)    | Per-broker (configurable)|
| Best for           | AWS-native, simple       | Kafka ecosystem, portable|

---

### Multi-Account Strategy

#### AWS Organizations + Control Tower

```
  ┌──────────────────────────────────────────────────────┐
  │                 Management Account                    │
  │  (billing, Organizations, Control Tower, SSO)        │
  └───────────────────────┬──────────────────────────────┘
                          │
      ┌───────────────────┼───────────────────┐
      │                   │                   │
  ┌───┴──────┐     ┌──────┴──────┐     ┌─────┴──────┐
  │ Security │     │ Shared Svcs │     │ Workloads  │
  │ OU       │     │ OU          │     │ OU         │
  ├──────────┤     ├─────────────┤     ├────────────┤
  │ Log      │     │ Networking  │     │ Prod OU    │
  │ Archive  │     │ (Transit GW)│     │ ├─App A    │
  │          │     │ Shared Svcs │     │ ├─App B    │
  │ Security │     │ (CI/CD)     │     │ Stage OU   │
  │ Tooling  │     │             │     │ ├─App A    │
  │ (GuardDuty)│   │             │     │ Dev OU     │
  └──────────┘     └─────────────┘     │ ├─App A    │
                                        │ Sandbox OU │
                                        └────────────┘
```

**Account separation principles:**
- One workload per account per environment (prod App A != staging App A)
- Centralize networking in a shared-services account (Transit Gateway hub)
- Centralize logging in a dedicated log archive account (write-only from other accounts)
- Centralize security tooling (GuardDuty, Security Hub, Config) in a security account
- Use SCPs to prevent dangerous actions across the organization

```hcl
# Terraform -- Control Tower landing zone account factory
resource "aws_organizations_account" "app_prod" {
  name      = "app-a-production"
  email     = "aws+app-a-prod@company.com"
  parent_id = aws_organizations_organizational_unit.prod.id
  role_name = "OrganizationAccountAccessRole"

  tags = {
    Environment = "production"
    Application = "app-a"
    ManagedBy   = "terraform"
  }

  lifecycle { ignore_changes = [role_name] }
}
```

---

### Disaster Recovery Patterns

| Strategy        | RTO      | RPO     | Cost  | AWS Implementation                             |
|-----------------|----------|---------|-------|-------------------------------------------------|
| **Backup & Restore** | Hours | Hours  | $     | S3 cross-region replication, RDS snapshots      |
| **Pilot Light** | 10-30 min| Minutes| $$    | Core infra running, scale on failover           |
| **Warm Standby**| Minutes  | Seconds| $$$   | Scaled-down clone in DR region, Route 53 health |
| **Active-Active**| Seconds | ~Zero  | $$$$  | Full deployment in 2+ regions, global tables    |

#### Pilot Light Implementation

```
  Primary Region (us-east-1)              DR Region (us-west-2)
  ┌─────────────────────┐                ┌────────────────────┐
  │ ALB → ECS (active)  │                │ ALB (standby)      │
  │ Aurora Writer        │  ──repl──→    │ Aurora Reader       │
  │ S3 (source)          │  ──CRR──→    │ S3 (replica)        │
  └─────────────────────┘                │ ECS (0 tasks)       │
                                          └────────────────────┘

  On failover:
  1. Promote Aurora reader to writer
  2. Scale ECS desired count from 0 to N
  3. Update Route 53 to point to DR ALB
```

```typescript
// AWS CDK -- Cross-region Aurora Global Database
import * as rds from "aws-cdk-lib/aws-rds";

// Primary region stack
const globalCluster = new rds.DatabaseCluster(this, "Primary", {
  engine: rds.DatabaseClusterEngine.auroraPostgres({
    version: rds.AuroraPostgresEngineVersion.VER_16_4,
  }),
  writer: rds.ClusterInstance.provisioned("writer", {
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.R7G, ec2.InstanceSize.XLARGE),
  }),
  vpc: primaryVpc,
  storageEncrypted: true,
});
// Add secondary region via separate stack using CfnGlobalCluster
```

---

### Hybrid Connectivity

| Method            | Bandwidth    | Latency     | Encryption | Setup Time |
|-------------------|-------------|-------------|------------|------------|
| Site-to-Site VPN  | ~1.25 Gbps  | Variable    | IPSec      | Hours      |
| Direct Connect    | 1-100 Gbps  | Consistent  | MACsec opt | Weeks      |
| DX + VPN Backup   | 1-100 Gbps  | Consistent  | Both       | Weeks      |
| Client VPN        | Per-user     | Variable    | TLS        | Hours      |

**Transit Gateway architecture for hybrid:**

```
  On-premises ──VPN/DX──→ Transit Gateway ──→ VPC A (Production)
                                │
                                ├──→ VPC B (Staging)
                                │
                                ├──→ VPC C (Shared Services)
                                │
                                └──→ Transit Gateway (peer region)
```

> Use Transit Gateway over VPC peering when connecting more than 3 VPCs.
> VPC peering requires N*(N-1)/2 connections; Transit Gateway is hub-and-spoke.

---

## Best Practices

1. **Start with the Well-Architected Framework review.** Run the review tool before
   launching any production workload. Address all high-risk findings before go-live.

2. **Design for failure at every layer.** Assume any single component can fail. Use
   health checks, circuit breakers, retry with backoff, and multi-AZ deployment.

3. **Use serverless-first for new workloads.** Lambda + API Gateway + DynamoDB eliminates
   server management. Move to containers only when serverless constraints (timeout, cold starts)
   become actual blockers.

4. **Implement the strangler fig pattern for migrations.** Route traffic incrementally
   from legacy to new services using ALB weighted target groups or API Gateway stages.

5. **Separate workloads into multiple AWS accounts.** Use Organizations OUs to isolate
   blast radius. Never run production and development in the same account.

6. **Use Aurora Global Database for multi-region active-passive.** Sub-second replication
   lag with managed failover. Cheaper than running full active-active.

7. **Place SQS between EventBridge and Lambda consumers.** The SQS buffer provides
   batching, visibility timeout control, and DLQ -- features EventBridge-to-Lambda lacks natively.

8. **Define all architecture in CDK or Terraform.** Infrastructure code enables
   reproducible DR, environment parity, and peer review of architecture changes.

9. **Use CloudFront for all internet-facing endpoints.** Even for APIs, CloudFront reduces
   latency via edge PoPs and provides AWS Shield Standard (free DDoS protection).

10. **Test disaster recovery runbooks quarterly.** An untested DR plan is not a plan.
    Automate failover with Step Functions and validate RTO/RPO through chaos engineering.

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| **Monolith Lambda** | Single Lambda handling all routes hits size/timeout limits | One Lambda per route or use Lambda function URLs with router |
| **Synchronous chain of Lambdas** | Compounding latency, cascading timeouts, double billing | Use Step Functions for orchestration or events for choreography |
| **No dead-letter queue on async flows** | Failed events silently lost, no ability to replay | DLQ on every SQS queue and Lambda async invocation |
| **Single AWS account for all environments** | Blast radius, noisy-neighbor billing, no SCP isolation | Multi-account with Organizations, one account per workload/env |
| **Direct Connect without VPN backup** | Single circuit failure causes total connectivity loss | Configure Site-to-Site VPN as automatic failover for DX |
| **Active-active for non-critical workloads** | 2x+ cost for minimal RTO improvement over warm standby | Match DR strategy to actual business RTO/RPO requirements |
| **Serverless for everything** | Long-running batch jobs hit 15-min timeout, VPC cold starts | Use ECS/Fargate for tasks >15 min, always-on, or high throughput |
| **Building without architecture decision records** | Forgotten context, repeated debates, inconsistent patterns | Document every architecture decision with ADR format in repo |

---

## Enforcement Checklist

- [ ] Well-Architected Framework review completed for each production workload
- [ ] Multi-AZ deployment verified for all stateful services (RDS, ElastiCache, EFS)
- [ ] Disaster recovery strategy documented with tested RTO/RPO targets
- [ ] Multi-account structure implemented (separate accounts for prod, staging, dev, security, logging)
- [ ] Service Control Policies applied to prevent dangerous actions
- [ ] All inter-service communication uses async patterns where possible
- [ ] Dead-letter queues configured for every asynchronous processing path
- [ ] Infrastructure defined in CDK/Terraform with peer-reviewed pull requests
- [ ] CloudFront distribution configured for all internet-facing endpoints
- [ ] Architecture Decision Records maintained for all significant design choices
- [ ] DR failover tested within the last quarter
- [ ] Data lake uses columnar formats (Parquet) with date partitioning
