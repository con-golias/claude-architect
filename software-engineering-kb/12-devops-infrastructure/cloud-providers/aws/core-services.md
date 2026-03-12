# AWS Core Services

| Attribute    | Value                                                                                       |
|--------------|---------------------------------------------------------------------------------------------|
| Domain       | DevOps > Cloud > AWS                                                                        |
| Importance   | Critical                                                                                    |
| Last Updated | 2026-03-10                                                                                  |
| Cross-ref    | [Architecture Patterns](architecture-patterns.md), [Cost Optimization](cost-optimization.md)|

---

## Core Concepts

### Compute

#### EC2 (Elastic Compute Cloud)

Virtual machines with full OS control. Choose EC2 when workloads need persistent state,
GPU access, custom kernels, or specific hardware configurations.

**Instance Family Reference (current generation):**

| Family  | Use Case                           | Examples          | vCPU:Memory Ratio |
|---------|------------------------------------|-------------------|--------------------|
| **M7i/M7g** | General purpose                | m7g.xlarge        | 1:4                |
| **C7i/C7g** | Compute-optimized (batch, HPC) | c7g.2xlarge       | 1:2                |
| **R7i/R7g** | Memory-optimized (caches, DBs) | r7g.4xlarge       | 1:8                |
| **I4i**     | Storage-optimized (IOPS-heavy)  | i4i.large         | 1:8 + NVMe        |
| **P5/Trn1** | ML training and inference       | p5.48xlarge       | GPU/Trainium       |
| **G5**      | Graphics and ML inference        | g5.xlarge         | GPU                |
| **T3/T4g**  | Burstable (dev, low traffic)     | t4g.micro         | Burstable credits  |

> Use Graviton (suffix `g`) instances for 20-40% better price-performance on Linux workloads.

```bash
# Launch a Graviton instance with latest Amazon Linux
aws ec2 run-instances \
  --image-id resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 \
  --instance-type m7g.large \
  --key-name my-key \
  --subnet-id subnet-0abc123 \
  --security-group-ids sg-0abc123 \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=web-server}]'
```

**Pricing model:** On-Demand (per-second), Reserved Instances (1/3-year commit, up to 72% off),
Savings Plans (flexible commit), Spot (up to 90% off, can be interrupted).

#### ECS / Fargate

Container orchestration. ECS manages task placement; Fargate removes instance management entirely.

| Mode            | When to Use                                    | You Manage           |
|-----------------|------------------------------------------------|----------------------|
| ECS on EC2      | GPU tasks, large fleets, cost optimization     | Instances + tasks    |
| ECS on Fargate  | Variable workloads, small teams, no OS patching| Tasks only           |

```typescript
// AWS CDK -- Fargate service behind ALB
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";

const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Api", {
  cluster,
  cpu: 512,
  memoryLimitMiB: 1024,
  desiredCount: 2,
  taskImageOptions: {
    image: ecs.ContainerImage.fromEcrRepository(repo, "latest"),
    containerPort: 8080,
    environment: { NODE_ENV: "production" },
  },
  runtimePlatform: {
    cpuArchitecture: ecs.CpuArchitecture.ARM64, // Graviton Fargate
    operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
  },
  circuitBreaker: { enable: true, rollback: true },
});

service.targetGroup.configureHealthCheck({ path: "/health", interval: cdk.Duration.seconds(15) });
```

**Pricing:** Fargate charges per vCPU-second and GB-second. No charge for stopped tasks.

#### Lambda

Event-driven serverless functions. Use for glue logic, API backends, event processing, and
scheduled tasks. Maximum execution: 15 minutes, maximum memory: 10 GB.

```typescript
// AWS CDK -- Lambda with provisioned concurrency
import * as lambda from "aws-cdk-lib/aws-lambda";

const fn = new lambda.Function(this, "Processor", {
  runtime: lambda.Runtime.NODEJS_22_X,
  architecture: lambda.Architecture.ARM_64, // Graviton -- 20% cheaper
  handler: "index.handler",
  code: lambda.Code.fromAsset("dist/processor"),
  memorySize: 1769,  // 1 full vCPU at this memory size
  timeout: cdk.Duration.seconds(30),
  environment: { TABLE_NAME: table.tableName },
  tracing: lambda.Tracing.ACTIVE,
  insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_229_0,
});

const alias = fn.addAlias("live");
alias.addAutoScaling({ minCapacity: 5, maxCapacity: 100 });
```

**Pricing:** Per-request ($0.20/1M) + per-GB-second ($0.0000133). Free tier: 1M requests + 400K GB-s/month.

#### App Runner

Fully managed container or source-code deployment. Use for simple web APIs and front-end
backends that do not need ECS complexity. Automatic scaling to zero is not supported (minimum 1 instance).

---

### Storage

#### S3 (Simple Storage Service)

Object storage with 11 nines durability. Core building block for data lakes, backups, static assets.

**Storage Class Reference:**

| Class                    | Access Pattern              | Min Duration | Retrieval Cost |
|--------------------------|-----------------------------|--------------|----------------|
| S3 Standard              | Frequent                    | None         | None           |
| S3 Intelligent-Tiering   | Unknown / changing          | None         | None*          |
| S3 Standard-IA           | Infrequent (>30 days)       | 30 days      | Per-GB         |
| S3 One Zone-IA           | Reproducible infrequent     | 30 days      | Per-GB         |
| S3 Glacier Instant       | Archive, ms retrieval       | 90 days      | Per-GB         |
| S3 Glacier Flexible      | Archive, minutes-hours      | 90 days      | Per-GB + time  |
| S3 Glacier Deep Archive  | Compliance, 12hr retrieval  | 180 days     | Per-GB + time  |

*Intelligent-Tiering charges a small monitoring fee per object (~$0.0025/1K objects).

```hcl
# Terraform -- S3 bucket with lifecycle rules
resource "aws_s3_bucket" "data" {
  bucket = "myapp-data-${var.environment}"
}

resource "aws_s3_bucket_lifecycle_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    id     = "archive-old-data"
    status = "Enabled"
    filter { prefix = "logs/" }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 90
      storage_class = "GLACIER_IR"       # Glacier Instant Retrieval
    }
    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }
    expiration { days = 2555 }           # 7 years retention
  }
}
```

#### EBS (Elastic Block Store)

Block storage volumes attached to EC2. Choose type by IOPS and throughput needs.

| Type      | Use Case              | Max IOPS  | Max Throughput | Pricing Basis       |
|-----------|-----------------------|-----------|----------------|---------------------|
| gp3       | General (default)     | 16,000    | 1,000 MB/s     | GB + IOPS + throughput |
| io2 Block Express | Critical DBs  | 256,000   | 4,000 MB/s     | GB + IOPS           |
| st1       | Sequential (logs)     | 500       | 500 MB/s       | GB                  |
| sc1       | Cold archival         | 250       | 250 MB/s       | GB                  |

> Always use gp3 over gp2. gp3 is 20% cheaper at baseline and allows independent IOPS/throughput tuning.

#### EFS (Elastic File System)

Managed NFS. Use for shared file access across multiple EC2/ECS/Lambda. Supports bursting
and provisioned throughput modes. Elastic throughput mode (default since 2024) auto-scales.

#### FSx

Managed high-performance file systems. FSx for Lustre for HPC/ML workloads.
FSx for NetApp ONTAP for enterprise NAS migration. FSx for Windows File Server for SMB shares.

---

### Database

#### RDS (Relational Database Service)

Managed relational databases. Handles backups, patching, failover. Multi-AZ for HA.

| Engine        | Best For                          | Max Storage |
|---------------|-----------------------------------|-------------|
| PostgreSQL    | General OLTP, geospatial (PostGIS)| 128 TiB     |
| MySQL         | WordPress, legacy apps            | 128 TiB     |
| MariaDB       | MySQL-compatible workloads        | 128 TiB     |
| Oracle        | Enterprise ERP                    | 128 TiB     |
| SQL Server    | .NET ecosystem                    | 16 TiB      |

**Pricing:** Instance hours + storage (GB/month) + I/O (Aurora) + backup beyond free retention.

#### Aurora

MySQL/PostgreSQL-compatible, AWS-designed storage engine. 5x throughput of MySQL, 3x of PostgreSQL.
Storage auto-scales in 10 GB increments up to 128 TiB. 6-way replication across 3 AZs.

```typescript
// AWS CDK -- Aurora Serverless v2 PostgreSQL
import * as rds from "aws-cdk-lib/aws-rds";

const cluster = new rds.DatabaseCluster(this, "Database", {
  engine: rds.DatabaseClusterEngine.auroraPostgres({
    version: rds.AuroraPostgresEngineVersion.VER_16_4,
  }),
  serverlessV2MinCapacity: 0.5,  // Scale to near-zero
  serverlessV2MaxCapacity: 32,
  writer: rds.ClusterInstance.serverlessV2("writer"),
  readers: [
    rds.ClusterInstance.serverlessV2("reader", { scaleWithWriter: true }),
  ],
  vpc,
  defaultDatabaseName: "appdb",
  storageEncrypted: true,
  backup: { retention: cdk.Duration.days(14) },
});
```

#### DynamoDB

Serverless NoSQL key-value and document store. Single-digit-millisecond latency at any scale.

| Capacity Mode | When to Use                     | Pricing                  |
|---------------|---------------------------------|--------------------------|
| On-demand     | Unpredictable traffic           | Per read/write request   |
| Provisioned   | Steady traffic (with auto-scale)| Per RCU/WCU-hour         |

**Key features:** Global tables (multi-region), DAX (in-memory cache), streams,
TTL (automatic item expiration), point-in-time recovery.

#### ElastiCache / MemoryDB

| Service      | Engine       | Use Case                        | Durability |
|--------------|--------------|---------------------------------|------------|
| ElastiCache  | Redis / Valkey | Caching, sessions, leaderboards | Optional   |
| ElastiCache  | Memcached    | Simple caching, multi-threaded  | None       |
| MemoryDB     | Redis-compatible | Primary database (durable Redis)| Multi-AZ WAL |

---

### Networking

#### VPC (Virtual Private Cloud)

Isolated network in AWS. Every resource requiring network access lives inside a VPC.

**Standard VPC Design:**

| Subnet Type | CIDR Example  | Route Target     | Resources              |
|-------------|---------------|------------------|------------------------|
| Public      | 10.0.1.0/24   | Internet Gateway | ALB, NAT Gateway, bastion |
| Private App | 10.0.10.0/24  | NAT Gateway      | ECS tasks, EC2 app servers |
| Private DB  | 10.0.20.0/24  | None / VPC only  | RDS, ElastiCache        |

> Size VPCs with at least /16 CIDR (65K IPs). Subnets across 3 AZs minimum for HA.

```hcl
# Terraform -- VPC with public/private subnets (3 AZs)
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "production"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24", "10.0.12.0/24"]
  database_subnets = ["10.0.20.0/24", "10.0.21.0/24", "10.0.22.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = false          # One NAT GW per AZ for HA
  enable_dns_hostnames   = true
  enable_flow_log        = true

  create_database_subnet_group = true
}
```

#### Load Balancers

| Type | Protocol      | Use Case                        | Pricing Basis    |
|------|---------------|---------------------------------|------------------|
| ALB  | HTTP/HTTPS    | Web apps, path routing, gRPC    | LCU-hour         |
| NLB  | TCP/UDP/TLS   | Low latency, static IPs, gaming | NLCU-hour        |
| GLB  | IP (layer 3)  | Third-party firewalls/appliances| GLCU-hour       |

#### Route 53

Managed DNS. Supports public and private hosted zones. Routing policies: simple, weighted,
latency-based, geolocation, geoproximity, failover, multivalue answer.
Health checks enable automatic DNS failover between regions.

#### CloudFront

Global CDN with 600+ PoPs. Serves static assets, dynamic API responses, WebSocket connections.
Origin types: S3, ALB, API Gateway, custom HTTP server. Use Origin Access Control (OAC) for S3 origins.

#### API Gateway

| Type     | Protocol    | Use Case                          | Pricing             |
|----------|-------------|-----------------------------------|---------------------|
| HTTP API | REST/HTTP   | Low-latency proxy, JWT auth       | $1/M requests       |
| REST API | REST        | Full features, WAF, usage plans   | $3.50/M requests    |
| WebSocket| WebSocket   | Real-time, chat, gaming           | $1/M messages       |

> Prefer HTTP API over REST API for new projects unless WAF integration or usage plans are required.

#### Transit Gateway

Hub-and-spoke network connecting multiple VPCs, VPNs, and Direct Connect gateways.
Replaces complex VPC peering meshes. Supports inter-region peering.

---

### Messaging and Event Services

#### SQS (Simple Queue Service)

Fully managed message queue. Decouples producers from consumers.

| Type     | Ordering   | Dedup            | Throughput            |
|----------|------------|------------------|-----------------------|
| Standard | Best-effort| At-least-once    | Unlimited             |
| FIFO     | Strict     | Exactly-once     | 3,000 msg/s (batch)   |

```yaml
# CloudFormation -- SQS with dead-letter queue
OrderQueue:
  Type: AWS::SQS::Queue
  Properties:
    QueueName: order-processing.fifo
    FifoQueue: true
    ContentBasedDeduplication: true
    VisibilityTimeout: 120
    MessageRetentionPeriod: 1209600    # 14 days
    RedrivePolicy:
      deadLetterTargetArn: !GetAtt OrderDLQ.Arn
      maxReceiveCount: 3

OrderDLQ:
  Type: AWS::SQS::Queue
  Properties:
    QueueName: order-processing-dlq.fifo
    FifoQueue: true
    MessageRetentionPeriod: 1209600
```

**Pricing:** $0.40/M requests (Standard), $0.50/M (FIFO). First 1M requests/month free.

#### SNS (Simple Notification Service)

Pub/sub messaging. Fan-out to multiple subscribers (SQS, Lambda, HTTP, email, SMS).
Use SNS + SQS fan-out pattern to decouple event producers from multiple consumers.

#### EventBridge

Serverless event bus for application integration. Schema registry for event discovery.
Rules route events based on content-based filtering patterns.

```typescript
// AWS CDK -- EventBridge rule routing to Lambda
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";

const bus = new events.EventBus(this, "AppBus", { eventBusName: "app-events" });

new events.Rule(this, "OrderCreated", {
  eventBus: bus,
  eventPattern: {
    source: ["com.myapp.orders"],
    detailType: ["OrderCreated"],
    detail: { amount: [{ numeric: [">=", 10000] }] },  // Orders >= $100
  },
  targets: [new targets.LambdaFunction(highValueOrderFn)],
});
```

**Pricing:** $1/M events published. Free for AWS service events (CloudTrail, etc.).

#### Kinesis

Real-time data streaming. Use for clickstream analytics, log aggregation, IoT telemetry.

| Service             | Use Case                     | Retention     |
|---------------------|------------------------------|---------------|
| Data Streams        | Custom consumers, low latency| 24h - 365 days|
| Data Firehose       | Load into S3/Redshift/OpenSearch | N/A (delivery) |
| Data Analytics      | SQL on streams (deprecated)  | N/A           |
| Video Streams       | Video ingestion              | 24h - custom  |

---

### Identity and Access Management

#### IAM Fundamentals

IAM controls who (authentication) can do what (authorization) on which resources.
Every API call in AWS is evaluated against IAM policies.

**Policy Structure:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3ReadOnly",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ],
      "Condition": {
        "StringEquals": { "aws:RequestedRegion": "us-east-1" }
      }
    }
  ]
}
```

**Core principle:** Grant least privilege. Start with no permissions and add only what is needed.
Use IAM Access Analyzer to identify unused permissions and refine policies.

#### IAM Roles

Prefer roles over long-lived access keys everywhere. EC2 instance profiles, ECS task roles,
Lambda execution roles, and cross-account assume-role patterns eliminate static credentials.

#### AWS Organizations

Manage multiple AWS accounts from a central management account. Use Service Control Policies (SCPs)
to set permission guardrails across all accounts. Structure OUs by environment or workload type.

#### IAM Identity Center (SSO)

Centralized workforce access to multiple AWS accounts and applications.
Integrates with external IdPs (Okta, Azure AD, Google Workspace).
Replaces per-account IAM users for human access.

> Cross-reference: See [08-security/infrastructure-security/cloud-security.md] for IAM hardening,
> SCPs, and permission boundary patterns.

---

## Best Practices

1. **Use Graviton instances by default.** ARM-based Graviton3/4 processors deliver 20-40% better
   price-performance for Linux workloads across EC2, Fargate, Lambda, RDS, and ElastiCache.

2. **Size VPCs for growth.** Allocate /16 CIDRs for production VPCs. Running out of IP addresses
   forces painful migration. Use secondary CIDRs only as a fallback.

3. **Deploy across 3 Availability Zones minimum.** Two AZs provide HA but no headroom during
   an AZ failure. Three AZs allow losing one while maintaining capacity.

4. **Enable S3 Intelligent-Tiering for unknown access patterns.** The small monitoring fee
   ($0.0025/1K objects) is negligible compared to savings from automatic tier transitions.

5. **Use gp3 over gp2 for all new EBS volumes.** gp3 is 20% cheaper at baseline and allows
   IOPS and throughput to be configured independently of volume size.

6. **Prefer Aurora Serverless v2 for variable database workloads.** Scales from 0.5 ACU to
   128 ACU without connection drops. Eliminates over-provisioning for dev and staging environments.

7. **Set up dead-letter queues for every SQS queue and Lambda function.** Failed messages must
   land somewhere observable. Monitor DLQ depth with CloudWatch alarms.

8. **Use EventBridge over SNS for application event routing.** EventBridge supports content-based
   filtering, schema registry, replay, and archive -- capabilities SNS lacks.

9. **Never use IAM users with long-lived access keys for applications.** Use IAM roles with
   temporary credentials via STS. Rotate any remaining access keys every 90 days.

10. **Tag every resource with at minimum: Team, Environment, Project, CostCenter.** Tags enable
    cost allocation, access control via ABAC, and automated operations.

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| **Single-AZ deployment** | One AZ failure takes down entire application | Deploy across 3 AZs with auto-scaling |
| **Hardcoded credentials in code** | Leaked secrets, impossible rotation | Use IAM roles, Secrets Manager, or SSM Parameter Store |
| **One giant VPC for everything** | Blast radius, IP exhaustion, no isolation | Separate VPCs per environment/workload with Transit Gateway |
| **Using gp2 volumes on new instances** | 20% cost premium, IOPS tied to volume size | Migrate to gp3 with independent IOPS/throughput |
| **Polling SQS in a tight loop** | Wasted API calls, higher costs | Use long polling (WaitTimeSeconds=20) or Lambda event source |
| **Running everything as root/admin** | Excessive blast radius on compromise | Least privilege IAM policies, use Access Analyzer |
| **Manual console-only infrastructure** | Unreproducible, drift-prone, no audit trail | Infrastructure as Code (CDK, Terraform, CloudFormation) |
| **Ignoring data transfer costs** | Surprise bills from cross-AZ and internet egress | Use VPC endpoints, same-AZ affinity, CloudFront for egress |

---

## Enforcement Checklist

- [ ] All compute workloads evaluated for Graviton compatibility
- [ ] VPC designed with /16 CIDR, 3-AZ subnets, and NAT Gateway per AZ
- [ ] EBS volumes use gp3 type (gp2 volumes identified for migration)
- [ ] S3 buckets have lifecycle policies or Intelligent-Tiering enabled
- [ ] Every SQS queue has a dead-letter queue configured
- [ ] IAM policies follow least privilege (Access Analyzer review quarterly)
- [ ] No IAM users with console passwords or access keys for applications
- [ ] All resources tagged with Team, Environment, Project, CostCenter
- [ ] CloudWatch alarms set for critical services (CPU, memory, queue depth, errors)
- [ ] Multi-AZ enabled for all production RDS instances and ElastiCache clusters
- [ ] VPC Flow Logs enabled for all production VPCs
- [ ] Infrastructure defined in code (CDK/Terraform/CloudFormation) -- no manual creation
