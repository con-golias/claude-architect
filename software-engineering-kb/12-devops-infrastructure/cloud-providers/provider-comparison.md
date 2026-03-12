# Cloud Provider Comparison

| Attribute     | Value                                                                 |
|--------------|-----------------------------------------------------------------------|
| Domain       | DevOps > Cloud                                                        |
| Importance   | High                                                                  |
| Last Updated | 2026-03-10                                                            |
| Cross-ref    | [AWS Core Services](aws/core-services.md), [Azure Core Services](azure/core-services.md), [GCP Core Services](gcp/core-services.md) |

---

## Core Concepts

### Service Mapping Table

| Category | AWS | Azure | GCP |
|----------|-----|-------|-----|
| **Compute (VMs)** | EC2 | Virtual Machines | Compute Engine |
| **Managed K8s** | EKS | AKS | GKE |
| **Serverless Containers** | Fargate, App Runner | Container Apps | Cloud Run |
| **Serverless Functions** | Lambda | Azure Functions | Cloud Functions |
| **PaaS** | Elastic Beanstalk | App Service | App Engine |
| **Object Storage** | S3 | Blob Storage | Cloud Storage |
| **Block Storage** | EBS | Managed Disks | Persistent Disk |
| **File Storage** | EFS | Azure Files | Filestore |
| **Relational DB** | RDS, Aurora | Azure SQL, Cosmos DB (PG) | Cloud SQL, AlloyDB |
| **Global Relational** | Aurora Global | Cosmos DB | Cloud Spanner |
| **Document DB** | DynamoDB | Cosmos DB | Firestore |
| **Cache** | ElastiCache | Azure Cache for Redis | Memorystore |
| **Data Warehouse** | Redshift | Synapse Analytics | BigQuery |
| **VPC/VNet** | VPC | Virtual Network | VPC |
| **Load Balancer** | ALB/NLB/GLB | Load Balancer, App Gateway | Cloud Load Balancing |
| **CDN** | CloudFront | Azure CDN / Front Door | Cloud CDN |
| **DNS** | Route 53 | Azure DNS | Cloud DNS |
| **WAF** | AWS WAF | Azure WAF | Cloud Armor |
| **Message Queue** | SQS | Service Bus Queues | Cloud Tasks |
| **Pub/Sub** | SNS, EventBridge | Event Grid, Service Bus Topics | Pub/Sub, Eventarc |
| **Stream Processing** | Kinesis | Event Hubs | Dataflow |
| **Container Registry** | ECR | ACR | Artifact Registry |
| **CI/CD** | CodePipeline, CodeBuild | Azure DevOps, GitHub Actions | Cloud Build |
| **Secrets** | Secrets Manager | Key Vault | Secret Manager |
| **IAM** | IAM | Entra ID (AAD) + RBAC | IAM |
| **Monitoring** | CloudWatch | Azure Monitor | Cloud Monitoring |
| **Logging** | CloudWatch Logs | Log Analytics | Cloud Logging |
| **IaC** | CloudFormation | Bicep / ARM Templates | Deployment Manager (deprecated) |
| **AI/ML Platform** | SageMaker | Azure AI / ML | Vertex AI |
| **LLM API** | Bedrock | Azure OpenAI | Vertex AI / Gemini API |

### Pricing Model Comparison

| Aspect | AWS | Azure | GCP |
|--------|-----|-------|-----|
| VM billing | Per-second (Linux) | Per-second | Per-second (1-min minimum) |
| Savings plans | Savings Plans (1yr/3yr) | Reserved Instances (1yr/3yr) | CUDs (1yr/3yr) + SUDs (automatic) |
| Spot pricing | Spot Instances (up to 90%) | Spot VMs (up to 90%) | Spot VMs (up to 91%) |
| Free tier | 12-month free + always-free | 12-month free + always-free | 90-day $300 credit + always-free |
| Egress (first 100GB) | Free (since 2024) | Free (first 5GB) | Free (first 200GB, Premium) |
| Support plans | $29-$15K+/mo | $29-$1K+/mo | $29-custom/mo |

**GCP unique advantage:** Sustained Use Discounts apply automatically -- no commitment
needed. AWS and Azure require explicit reservation purchases for comparable savings.

### Free Tier Comparison

| Service Type | AWS Free Tier | Azure Free Tier | GCP Free Tier |
|-------------|---------------|-----------------|---------------|
| Compute | 750 hrs/mo t2.micro (12 mo) | 750 hrs/mo B1s (12 mo) | 1 e2-micro always-free |
| Functions | 1M requests/mo (always) | 1M requests/mo (always) | 2M requests/mo (always) |
| Object Storage | 5 GB S3 (12 mo) | 5 GB Blob (12 mo) | 5 GB always-free |
| Database | 750 hrs RDS (12 mo) | 750 hrs SQL (12 mo) | Firestore 1 GiB always-free |
| Data Warehouse | -- | -- | 1 TB BQ queries/mo always-free |

### CLI Tooling Comparison

```bash
# AWS CLI — Resource management
aws ec2 describe-instances \
  --filters "Name=tag:env,Values=prod" --output json
aws s3 cp file.txt s3://my-bucket/
aws lambda invoke --function-name my-func --payload '{}' output.json

# Azure CLI — Resource management
az vm list --resource-group prod-rg --output table
az storage blob upload \
  --account-name myacct --container-name data --file file.txt
az functionapp show --name my-func --resource-group prod-rg

# Google Cloud CLI — Resource management
gcloud compute instances list --filter="labels.env=prod" --format=json
gsutil cp file.txt gs://my-bucket/
gcloud functions call my-func --data='{}'
```

**CLI ergonomics:**
- **gcloud**: Most consistent, self-documenting (`gcloud help`), interactive mode
- **aws**: Broadest coverage, verbose, auto-complete via `aws-shell`
- **az**: Group-based commands, good integration with Azure DevOps

### IaC Support Comparison

| Tool | AWS | Azure | GCP |
|------|-----|-------|-----|
| Terraform | Excellent (most mature) | Excellent | Excellent |
| Pulumi | Excellent | Excellent | Excellent |
| Native IaC | CloudFormation / CDK | Bicep / ARM Templates | Deployment Manager (deprecated) |
| Crossplane | Full support | Full support | Full support |
| CDKTF | Full support | Full support | Full support |

```hcl
# Terraform — Multi-cloud pattern with modules
module "aws_infra" {
  source    = "./modules/aws"
  providers = { aws = aws.us_east_1 }
  environment = var.environment
}

module "gcp_infra" {
  source    = "./modules/gcp"
  providers = { google = google.us_central1 }
  environment = var.environment
}

module "azure_infra" {
  source    = "./modules/azure"
  providers = { azurerm = azurerm.eastus }
  environment = var.environment
}
```

### Market Share and Trends (2025)

```
Market Share (IaaS + PaaS, Q4 2025):
  AWS    ████████████████████████████   28%
  Azure  ████████████████████           20%
  GCP    █████████████                  13%
  Others ████████████████████████████████████████ 39%
```

**Trend analysis:**
- **AWS (28%, stable)**: Largest ecosystem, broadest service catalog, dominant in startups
  and enterprises. Growth slowing as market matures
- **Azure (20%, growing)**: Fastest absolute growth in enterprise. Strong Microsoft 365
  integration, hybrid cloud (Azure Arc), and AI (OpenAI partnership)
- **GCP (13%, fastest % growth)**: Dominant in data analytics (BigQuery), AI/ML (Vertex AI,
  Gemini), and Kubernetes (GKE). Gaining enterprise traction

### Provider Strengths

| Strength Area | Best Provider | Why |
|--------------|---------------|-----|
| Breadth of services | AWS | 200+ services, most mature marketplace |
| Enterprise hybrid | Azure | Azure Arc, Active Directory integration, M365 |
| Kubernetes | GCP | GKE is origin of K8s, Autopilot, GKE Enterprise |
| Data analytics | GCP | BigQuery (serverless), Dataflow, Looker |
| AI/ML | GCP + Azure | Vertex AI + Gemini; Azure OpenAI |
| Serverless | AWS | Lambda ecosystem, Step Functions, EventBridge |
| Networking | AWS | Transit Gateway, most peering locations |
| Global database | GCP | Cloud Spanner (globally consistent) |
| DevOps toolchain | Azure | Azure DevOps, GitHub integration |
| Cost transparency | GCP | SUDs automatic, simpler pricing calculator |

### Decision Framework: Choosing a Cloud Provider

Use this weighted scoring matrix to evaluate providers for your specific workload.
Score each factor 1-5, multiply by weight, and compare totals.

| Factor | Weight | AWS (example) | Azure (example) | GCP (example) |
|--------|--------|--------------|-----------------|---------------|
| Team existing expertise | 25% | 4 | 2 | 3 |
| Service fit for workload | 20% | 4 | 3 | 5 |
| Pricing for expected usage | 15% | 3 | 3 | 4 |
| Compliance/regulatory needs | 15% | 5 | 5 | 4 |
| Support quality/SLA needs | 10% | 4 | 4 | 3 |
| Data/AI capabilities | 10% | 3 | 4 | 5 |
| Geographic availability | 5% | 5 | 4 | 3 |

**Scoring rules:**
- Weight team expertise highest -- cloud skills are the most expensive investment
- Give extra weight to compliance if operating in regulated industries
- Score service fit based on your PRIMARY workload, not edge cases
- Re-evaluate annually as services and pricing evolve

### Cloud-Native Application Patterns

```typescript
// Cloud-agnostic storage adapter pattern
interface ObjectStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

// AWS S3 implementation
class S3Storage implements ObjectStorage {
  constructor(private client: S3Client, private bucket: string) {}

  async put(key: string, data: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data })
    );
  }
  // ... other methods
}

// GCP Cloud Storage implementation
class GCSStorage implements ObjectStorage {
  constructor(private bucket: Bucket) {}

  async put(key: string, data: Buffer): Promise<void> {
    await this.bucket.file(key).save(data);
  }
  // ... other methods
}

// Azure Blob Storage implementation
class AzureBlobStorage implements ObjectStorage {
  constructor(private container: ContainerClient) {}

  async put(key: string, data: Buffer): Promise<void> {
    await this.container.getBlockBlobClient(key).upload(data, data.length);
  }
  // ... other methods
}

// Factory pattern for runtime selection
function createStorage(provider: "aws" | "gcp" | "azure"): ObjectStorage {
  switch (provider) {
    case "aws":
      return new S3Storage(new S3Client({}), process.env.BUCKET!);
    case "gcp":
      return new GCSStorage(
        new Storage().bucket(process.env.BUCKET!)
      );
    case "azure":
      return new AzureBlobStorage(
        BlobServiceClient
          .fromConnectionString(process.env.AZURE_CONN!)
          .getContainerClient(process.env.CONTAINER!)
      );
  }
}
```

### Multi-Cloud Considerations

**When multi-cloud makes sense:**
- Regulatory requirements mandate geographic or provider diversity
- Acquiring companies on different clouds (M&A consolidation)
- Best-of-breed strategy (e.g., GCP for analytics + AWS for compute)
- Avoiding single-vendor dependency for strategic workloads

**When multi-cloud does NOT make sense:**
- Complexity cost exceeds vendor lock-in risk
- Small team without cloud platform engineering capacity
- Workloads that benefit from deep provider integration

```yaml
# Crossplane — Cloud-agnostic resource provisioning on Kubernetes
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-aws
spec:
  package: xpkg.upbound.io/upbound/provider-aws:v1.0.0
---
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-gcp
spec:
  package: xpkg.upbound.io/upbound/provider-gcp:v1.0.0
---
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-azure
spec:
  package: xpkg.upbound.io/upbound/provider-azure:v1.0.0
```

### Cloud-Agnostic Tooling

| Category | Tool | Description |
|----------|------|-------------|
| IaC | Terraform / OpenTofu | HCL-based, provider-agnostic, largest ecosystem |
| IaC | Pulumi | General-purpose languages (TS, Python, Go) |
| IaC | Crossplane | K8s-native cloud resource management |
| Orchestration | Kubernetes | Runs on all clouds (EKS, AKS, GKE) |
| Service mesh | Istio / Linkerd | Cloud-agnostic service-to-service networking |
| Monitoring | Prometheus + Grafana | Open-source observability stack |
| Monitoring | Datadog / New Relic | Commercial multi-cloud observability |
| Secrets | HashiCorp Vault | Cloud-agnostic secrets management |
| CI/CD | GitHub Actions | Works with any cloud provider |
| DNS/CDN | Cloudflare | Cloud-agnostic DNS and CDN |

### Serverless Comparison

| Feature | AWS Lambda | Azure Functions | GCP Cloud Functions | GCP Cloud Run |
|---------|-----------|-----------------|-------------------|---------------|
| Max timeout | 15 min | 10 min (consumption) | 60 min (2nd gen) | 60 min |
| Max memory | 10 GB | 1.5 GB (consumption) | 32 GB (2nd gen) | 32 GB |
| Concurrency | 1 per instance | Varies by plan | 1000 per instance | 1000 per instance |
| Cold start | 100-500ms | 500-2000ms | 100-500ms (2nd gen) | 100-1000ms |
| Container support | Container images | Container images | Not native | Native |
| Languages | Node, Python, Java, Go, .NET, Ruby | Node, Python, Java, C#, PowerShell | Node, Python, Go, Java, .NET, Ruby, PHP | Any (container) |
| VPC support | Yes | Yes (premium) | Yes | Yes |
| Event sources | 200+ | 20+ | 10+ (Eventarc) | Pub/Sub, HTTP, jobs |
| GPU support | No | No | No | Yes (preview) |

### Kubernetes Managed Services Comparison

| Feature | EKS | AKS | GKE |
|---------|-----|-----|-----|
| Control plane cost | $0.10/hr ($73/mo) | Free | Free (Autopilot/Standard) |
| Autopilot mode | No (Fargate is separate) | No (virtual nodes) | Yes (native) |
| Node auto-provisioning | Karpenter (add-on) | KEDA (add-on) | Built-in |
| Max pods per node | 110-250 | 250 | 110 |
| Windows containers | Yes | Yes | Yes (Standard only) |
| GPU support | Yes | Yes | Yes |
| Service mesh | App Mesh (deprecated), Istio | Istio, Open Service Mesh | Anthos Service Mesh (Istio) |
| GitOps | Flux (add-on) | Flux, GitOps (add-on) | Config Sync (built-in) |
| Multi-cluster | EKS Anywhere | Azure Arc | GKE Enterprise |

### Database Services Comparison

| Requirement | AWS Recommendation | Azure Recommendation | GCP Recommendation |
|------------|-------------------|---------------------|-------------------|
| General RDBMS | RDS PostgreSQL / Aurora | Azure Database for PostgreSQL | Cloud SQL PostgreSQL |
| High-perf PostgreSQL | Aurora | Cosmos DB (PostgreSQL) | AlloyDB |
| Global relational | Aurora Global | Cosmos DB | Cloud Spanner |
| Key-value / Document | DynamoDB | Cosmos DB | Firestore |
| Time-series | Timestream | Azure Data Explorer | Bigtable |
| Graph | Neptune | Cosmos DB (Gremlin) | No native (use Neo4j on GCE) |
| Cache | ElastiCache (Redis/Memcached) | Azure Cache for Redis | Memorystore |
| Search | OpenSearch Service | Azure AI Search | Vertex AI Search |
| Data warehouse | Redshift | Synapse Analytics | BigQuery |

### Networking and CDN Comparison

| Feature | AWS | Azure | GCP |
|---------|-----|-------|-----|
| Global load balancer | Global Accelerator + ALB | Front Door | Global External ALB |
| CDN edge locations | 600+ (CloudFront) | 190+ (Front Door) | 200+ (Cloud CDN) |
| Private connectivity | Direct Connect | ExpressRoute | Cloud Interconnect |
| DNS SLA | 100% (Route 53) | 100% (Azure DNS) | 100% (Cloud DNS) |
| DDoS protection | Shield Standard (free) | DDoS Protection Basic (free) | Cloud Armor Standard (free) |
| Service mesh | App Mesh (deprecated) | Open Service Mesh | Anthos Service Mesh |
| VPN pricing | ~$36/mo per tunnel | ~$140/mo per gateway | ~$36/mo per tunnel |

### Observability Comparison

| Feature | AWS CloudWatch | Azure Monitor | GCP Cloud Operations |
|---------|---------------|---------------|---------------------|
| Metrics retention | 15 months | 93 days | 6 weeks (free), custom |
| Log ingestion cost | $0.50/GB | $2.76/GB (basic) | $0.50/GB |
| Tracing | X-Ray | Application Insights | Cloud Trace |
| Dashboards | CloudWatch Dashboards | Azure Dashboards | Cloud Monitoring Dashboards |
| Alerting | CloudWatch Alarms | Azure Alerts | Cloud Alerting |
| APM | X-Ray + CloudWatch RUM | Application Insights | Cloud Trace + Error Reporting |

### Regional Availability and Compliance Certifications

| Aspect | AWS | Azure | GCP |
|--------|-----|-------|-----|
| Regions | 33+ | 60+ | 40+ |
| Availability Zones | 105+ | 200+ | 121+ |
| Edge locations / PoPs | 600+ | 190+ | 200+ |
| Government regions | GovCloud (US), China | Government (US/China), Sovereign | Assured Workloads |
| SOC 2 Type II | Yes | Yes | Yes |
| ISO 27001 | Yes | Yes | Yes |
| HIPAA BAA | Yes | Yes | Yes |
| PCI DSS | Yes | Yes | Yes |
| FedRAMP High | Yes | Yes | Yes (select services) |
| GDPR DPA | Yes | Yes | Yes |

### Support Plan Comparison

| Tier | AWS | Azure | GCP |
|------|-----|-------|-----|
| Free | Basic (no tech support) | Basic (no tech support) | Basic (no tech support) |
| Developer | $29/mo (business hours) | -- | -- |
| Standard | $100/mo or 10% of spend | $100/mo (Standard) | $29/mo (Standard) |
| Enhanced | $15K/mo (Enterprise) | $1K/mo (Unified) | Custom (Enhanced) |
| Premium | Enterprise On-Ramp ($5.5K) | Premier (custom) | Premium (custom, TAM) |
| Response time (critical) | 15 min (Enterprise) | 15 min (Unified) | 15 min (Premium) |

### Vendor Lock-In Spectrum

| Lock-In Level | Services | Mitigation |
|--------------|----------|------------|
| **Low** (portable) | VMs, K8s, object storage, PostgreSQL, Redis | Standard APIs, easy migration |
| **Medium** (effort) | Managed DBs (RDS/Cloud SQL), FaaS, queues | Abstract with interfaces, standard SQL |
| **High** (rewrite) | DynamoDB, Cosmos DB, Spanner, proprietary AI | Accept for differentiated value |
| **Very High** (arch) | Step Functions, Eventarc, Logic Apps, native IaC | Design abstraction layers, document exit |

### Migration Paths Between Providers

```
Migration Complexity Matrix:
                    To AWS    To Azure    To GCP
From AWS              -       Medium      Medium
From Azure          Medium      -         Medium
From GCP            Medium    Medium        -
From On-Prem        High      Medium*     High

* Azure Arc simplifies hybrid migration
```

**Migration strategies:**
1. **Lift and shift**: Move VMs/containers as-is (fastest, least optimization)
2. **Replatform**: Adopt managed services on target cloud (moderate effort)
3. **Refactor**: Redesign for target cloud native services (highest effort, best outcome)
4. **Hybrid**: Run workloads across clouds during transition

```bash
# GCP — VM migration using Migrate to Virtual Machines
gcloud migration vms create my-migration \
  --source=my-aws-source \
  --target-project=my-gcp-project \
  --location=us-central1

# GCP — Database migration using Database Migration Service
gcloud database-migration migration-jobs create pg-migration \
  --source=aws-rds-source \
  --destination=cloud-sql-dest \
  --type=CONTINUOUS \
  --region=us-central1

# AWS — Server Migration Service
aws sms create-replication-job \
  --server-id s-12345 \
  --frequency 12 \
  --role-name sms-role

# Azure — Azure Migrate
az migrate project create \
  --name my-migration \
  --resource-group migration-rg \
  --location eastus
```

---

## 10 Best Practices

1. **Choose your primary cloud based on team expertise and workload fit.** Cloud skills
   are expensive to develop; align with existing team knowledge.
2. **Use Terraform or Pulumi as the IaC layer across all providers.** Avoid native IaC
   (CloudFormation, Bicep) unless committed to a single provider.
3. **Standardize on Kubernetes for compute portability.** EKS, AKS, and GKE provide
   compatible platforms with provider-specific enhancements.
4. **Abstract cloud-specific services behind application interfaces.** Use repository
   patterns, adapter layers, and dependency injection for storage, queues, and databases.
5. **Track cloud spending by team and service using consistent tagging.** All three
   providers support labels/tags -- enforce the same taxonomy across clouds.
6. **Evaluate vendor lock-in per service, not per provider.** Accept high lock-in for
   differentiated services (BigQuery, DynamoDB) while keeping portability for commodity.
7. **Document your cloud exit strategy even if you never use it.** The exercise clarifies
   architectural dependencies and informs service selection.
8. **Use cloud-agnostic monitoring for multi-cloud visibility.** Prometheus + Grafana
   or Datadog provide unified dashboards across all providers.
9. **Negotiate enterprise agreements with usage commitments.** All three providers
   offer significant discounts (20-40%) for annual spend commitments.
10. **Review the provider comparison annually.** Service parity evolves rapidly; what was
    a differentiator 12 months ago may now be commodity.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Multi-cloud without platform team | Doubled complexity, inconsistent practices | Single cloud or dedicate platform engineering team |
| Choosing cloud by feature checklist alone | Ignores team skills, support quality, pricing nuance | Weight team expertise and operational factors |
| Native IaC across multiple providers | Fragmented tooling, duplicated effort | Standardize on Terraform/Pulumi for all providers |
| Ignoring egress costs in architecture | Surprise bills when crossing cloud/region boundaries | Model egress costs during architecture design |
| Assuming service equivalence across providers | Subtle API, consistency, and performance differences | Test equivalent services under realistic load |
| Vendor lock-in avoidance at all costs | Over-engineering abstraction layers, missing native benefits | Accept lock-in for differentiated value |
| Migrating without right-sizing | Moving waste from one cloud to another | Right-size before, during, and after migration |
| Using 3 clouds for "redundancy" | Triple the cost, complexity, and staffing | Use multi-region within one cloud for HA |

---

## Enforcement Checklist

- [ ] Primary cloud provider selected with documented rationale (ADR)
- [ ] IaC tool standardized across all used cloud providers
- [ ] Service mapping table maintained for cross-provider equivalents
- [ ] Tagging/labeling taxonomy consistent across all clouds
- [ ] Egress costs modeled for all cross-cloud and cross-region data flows
- [ ] Cloud-agnostic monitoring deployed for multi-cloud workloads
- [ ] Vendor lock-in assessed per service with documented exit strategies
- [ ] Enterprise agreements reviewed annually for cost optimization
- [ ] Team cloud certifications tracked and training budgeted
- [ ] Migration runbooks documented for critical workloads
- [ ] Provider comparison reviewed and updated annually
- [ ] Cloud spend tracked by provider with unified dashboarding
