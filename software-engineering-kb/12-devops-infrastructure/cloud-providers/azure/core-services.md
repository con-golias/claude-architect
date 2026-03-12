# Azure Core Services

| Attribute      | Value                                                                 |
|---------------|-----------------------------------------------------------------------|
| Domain        | DevOps > Cloud > Azure                                                |
| Importance    | High                                                                  |
| Last Updated  | 2026-03-10                                                            |
| Cross-ref     | [Architecture Patterns](architecture-patterns.md), [Cost Optimization](cost-optimization.md) |

---

## Core Concepts

### Compute

#### Virtual Machines and VM Scale Sets

Azure VMs provide IaaS compute with full OS control. VM Scale Sets (VMSS) add
autoscaling across identical instances behind a load balancer.

**When to use:** Legacy workloads, lift-and-shift migrations, custom OS images,
GPU/HPC workloads, compliance-required dedicated hosts.

**Key config:** VM size family (B-series burstable, D-series general, E-series
memory-optimized, N-series GPU), OS disk type, availability zones, proximity
placement groups.

**Pricing:** Pay-per-second for compute + managed disk + networking. Reserved
Instances save up to 72%. Spot VMs save up to 90% for interruptible workloads.

```bash
# Create a VM Scale Set with autoscaling
az vmss create \
  --resource-group rg-prod \
  --name vmss-web \
  --image Ubuntu2204 \
  --vm-sku Standard_D4s_v5 \
  --instance-count 3 \
  --zones 1 2 3 \
  --upgrade-policy-mode Rolling \
  --lb-sku Standard

# Configure autoscale rules
az monitor autoscale create \
  --resource-group rg-prod \
  --resource vmss-web \
  --resource-type Microsoft.Compute/virtualMachineScaleSets \
  --min-count 2 \
  --max-count 20 \
  --count 3

az monitor autoscale rule create \
  --resource-group rg-prod \
  --autoscale-name vmss-web \
  --condition "Percentage CPU > 70 avg 5m" \
  --scale out 2
```

#### Azure Kubernetes Service (AKS)

Managed Kubernetes with free control plane. Azure handles upgrades, patching,
and monitoring. Integrates with Entra ID, Azure Monitor, and Azure Policy.

**When to use:** Microservices, container-native workloads, multi-team platforms,
workloads needing fine-grained scaling and orchestration.

**Key config:** Node pools (system + user), cluster autoscaler, KEDA for
event-driven scaling, Azure CNI vs kubenet networking, Workload Identity.

**Pricing:** Free control plane; pay only for worker node VMs and storage.

```bicep
// Bicep: AKS cluster with system and user node pools
resource aksCluster 'Microsoft.ContainerService/managedClusters@2024-09-01' = {
  name: 'aks-prod'
  location: resourceGroup().location
  identity: { type: 'SystemAssigned' }
  properties: {
    dnsPrefix: 'aks-prod'
    kubernetesVersion: '1.30'
    networkProfile: {
      networkPlugin: 'azure'
      networkPolicy: 'calico'
      serviceCidr: '10.0.0.0/16'
      dnsServiceIP: '10.0.0.10'
    }
    agentPoolProfiles: [
      {
        name: 'system'
        count: 3
        vmSize: 'Standard_D4s_v5'
        mode: 'System'
        availabilityZones: [ '1', '2', '3' ]
        enableAutoScaling: true
        minCount: 3
        maxCount: 5
      }
      {
        name: 'workload'
        count: 3
        vmSize: 'Standard_D8s_v5'
        mode: 'User'
        availabilityZones: [ '1', '2', '3' ]
        enableAutoScaling: true
        minCount: 3
        maxCount: 50
      }
    ]
  }
}
```

#### App Service

PaaS for web apps, REST APIs, and backends. Supports .NET, Node.js, Python,
Java, PHP, Go, and custom containers. Built-in CI/CD slots, autoscale, and TLS.

**When to use:** Web apps and APIs with minimal infra management, deployment
slots for blue-green deployments, apps needing VNet integration.

**Key config:** App Service Plan (shared, dedicated, isolated), deployment slots,
VNet integration, custom domains, managed certificates.

**Pricing:** Based on App Service Plan tier. Free/Shared for dev. Basic/Standard/
Premium for production. Isolated for compliance.

```bash
# Create App Service with deployment slot
az appservice plan create \
  --name plan-prod --resource-group rg-prod \
  --sku P1v3 --zone-redundant true

az webapp create \
  --name app-api-prod --resource-group rg-prod \
  --plan plan-prod --runtime "NODE:20-lts"

az webapp deployment slot create \
  --name app-api-prod --resource-group rg-prod \
  --slot staging

# Swap staging to production (zero-downtime)
az webapp deployment slot swap \
  --name app-api-prod --resource-group rg-prod \
  --slot staging --target-slot production
```

#### Azure Functions

Serverless compute triggered by events (HTTP, timers, queues, blobs, Cosmos DB
change feed). Scale to zero, scale to thousands.

**When to use:** Event-driven processing, webhooks, scheduled tasks, stream
processing, lightweight APIs, background jobs.

**Pricing:** Consumption plan (pay-per-execution, first 1M free/month), Flex
Consumption (always-ready instances + on-demand), Premium (VNet, no cold start),
Dedicated (App Service Plan).

```typescript
// Azure Function: Process Service Bus messages (TypeScript v4 model)
import { app, InvocationContext } from '@azure/functions';

interface OrderEvent {
  orderId: string;
  customerId: string;
  total: number;
}

app.serviceBusQueue('processOrder', {
  connection: 'ServiceBusConnection',
  queueName: 'orders',
  handler: async (message: OrderEvent, context: InvocationContext) => {
    context.log(`Processing order ${message.orderId}`);
    // Process order logic
    await fulfillOrder(message);
  },
});
```

#### Container Apps

Serverless container platform built on Kubernetes (KEDA + Envoy). Run
containers without managing cluster infrastructure. Native Dapr integration.

**When to use:** Microservices that need autoscaling without Kubernetes
complexity, background processing, event-driven containers, APIs.

**Key config:** Revision mode (single/multiple for traffic splitting), scale
rules (HTTP, queue, custom), ingress, Dapr components, workload profiles.

**Pricing:** Consumption (pay-per-second vCPU/memory), Dedicated workload
profiles for predictable pricing.

```bash
# Deploy a Container App with scale rules
az containerapp create \
  --name app-orders \
  --resource-group rg-prod \
  --environment env-prod \
  --image myregistry.azurecr.io/orders:latest \
  --target-port 8080 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 30 \
  --scale-rule-name queue-scaler \
  --scale-rule-type azure-servicebus \
  --scale-rule-metadata "queueName=orders" "messageCount=10" \
  --scale-rule-auth "connection=sb-connection-string"
```

#### Container Instances (ACI)

Run a single container or pod without managing any infrastructure. Start in
seconds. No orchestration overhead.

**When to use:** Burst compute, CI/CD build agents, short-lived batch tasks,
sidecar containers for AKS (virtual nodes).

**Pricing:** Per-second billing for vCPU and memory. No minimum.

---

### Storage

#### Blob Storage Tiers and Lifecycle

Object storage for unstructured data. Four access tiers: Hot (frequent access),
Cool (infrequent, 30-day minimum), Cold (rare, 90-day minimum), Archive
(offline, 180-day minimum).

**Key config:** Storage account type (Standard LRS/ZRS/GRS, Premium for
block blobs), access tier, lifecycle management policies, immutability policies.

```bicep
// Bicep: Storage account with lifecycle management
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'stproddata001'
  location: resourceGroup().location
  sku: { name: 'Standard_ZRS' }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

resource lifecyclePolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'tierToCool'
          type: 'Lifecycle'
          definition: {
            actions: {
              baseBlob: {
                tierToCool: { daysAfterModificationGreaterThan: 30 }
                tierToArchive: { daysAfterModificationGreaterThan: 180 }
                delete: { daysAfterModificationGreaterThan: 365 }
              }
            }
            filters: { blobTypes: [ 'blockBlob' ] }
          }
        }
      ]
    }
  }
}
```

#### Azure Files, Managed Disks, Data Lake Storage Gen2

**Azure Files:** Managed SMB/NFS file shares for lift-and-shift, shared config,
and Kubernetes persistent volumes. Standard (HDD) and Premium (SSD) tiers.

**Managed Disks:** Block storage for VMs. Ultra Disk (sub-ms latency), Premium
SSD v2 (configurable IOPS/throughput), Premium SSD, Standard SSD, Standard HDD.

**Data Lake Storage Gen2:** Hierarchical namespace on top of Blob Storage for
big data analytics. Compatible with HDFS, integrates with Synapse, Databricks.

---

### Database

#### Azure SQL

Fully managed SQL Server. Deployment options: Single Database, Elastic Pool
(shared resources across databases), and Managed Instance (near-100% SQL Server
compatibility for migrations).

**When to use:** Relational workloads, OLTP, enterprise apps migrating from SQL
Server, apps needing built-in HA with 99.995% SLA.

**Key config:** Service tier (General Purpose/Business Critical/Hyperscale),
compute model (provisioned vs serverless), max vCores, backup retention.

```bash
# Create serverless Azure SQL Database
az sql server create \
  --name sql-prod --resource-group rg-prod \
  --admin-user sqladmin --admin-password "${SQL_ADMIN_PASSWORD}"

az sql db create \
  --server sql-prod --resource-group rg-prod \
  --name db-orders \
  --edition GeneralPurpose \
  --compute-model Serverless \
  --auto-pause-delay 60 \
  --min-capacity 0.5 \
  --max-size 32GB
```

#### Cosmos DB

Globally distributed, multi-model NoSQL database. APIs: NoSQL (native), MongoDB,
Cassandra, Gremlin (graph), Table. Single-digit millisecond latency at any scale.

**When to use:** Global distribution needed, multi-region writes, flexible
schema, high-throughput key-value/document workloads, event sourcing.

**Key config:** Consistency levels (Strong, Bounded Staleness, Session,
Consistent Prefix, Eventual), partition key design, RU/s provisioning
(manual, autoscale, or serverless).

```typescript
// TypeScript: Cosmos DB operations with Azure SDK
import { CosmosClient } from '@azure/cosmos';

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING!);
const container = client.database('orders-db').container('orders');

// Efficient point read (partition key + id)
async function getOrder(orderId: string, customerId: string) {
  const { resource } = await container.item(orderId, customerId).read();
  return resource;
}

// Cross-partition query (use sparingly — costs more RUs)
async function getRecentOrders(since: Date) {
  const { resources } = await container.items
    .query({
      query: 'SELECT * FROM c WHERE c.createdAt > @since ORDER BY c.createdAt DESC',
      parameters: [{ name: '@since', value: since.toISOString() }],
    })
    .fetchAll();
  return resources;
}
```

#### Azure Database for PostgreSQL Flexible Server

Managed PostgreSQL with zone-redundant HA, automatic backups, and built-in
PgBouncer connection pooling. Supports PostgreSQL 13-17.

**When to use:** PostgreSQL workloads, open-source preference, apps using
PostGIS, full-text search, JSONB, extensions ecosystem.

**Key config:** Compute tier (Burstable/General Purpose/Memory Optimized), HA
mode (same zone or zone-redundant), storage auto-grow, read replicas.

#### Azure Cache for Redis

Managed Redis with clustering, geo-replication, and data persistence. Tiers:
Basic (dev), Standard (replicated), Premium (clustering, VNet, persistence),
Enterprise (Redis modules, Active-Active geo).

**When to use:** Session caching, API response caching, real-time leaderboards,
pub/sub messaging, rate limiting, distributed locking.

---

### Networking

#### VNet, Subnets, and NSGs

Azure Virtual Network (VNet) is the foundation. Each VNet has a CIDR range.
Subnets divide the VNet. Network Security Groups (NSGs) filter traffic with
priority-based allow/deny rules.

```bicep
// Bicep: VNet with subnets and NSG
resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: 'vnet-prod'
  location: resourceGroup().location
  properties: {
    addressSpace: { addressPrefixes: [ '10.0.0.0/16' ] }
    subnets: [
      {
        name: 'snet-app'
        properties: {
          addressPrefix: '10.0.1.0/24'
          networkSecurityGroup: { id: nsgApp.id }
          privateEndpointNetworkPolicies: 'Enabled'
        }
      }
      {
        name: 'snet-data'
        properties: {
          addressPrefix: '10.0.2.0/24'
          networkSecurityGroup: { id: nsgData.id }
        }
      }
      {
        name: 'snet-aks'
        properties: {
          addressPrefix: '10.0.4.0/22'  // /22 for AKS node IPs
        }
      }
    ]
  }
}

resource nsgApp 'Microsoft.Network/networkSecurityGroups@2024-01-01' = {
  name: 'nsg-app'
  location: resourceGroup().location
  properties: {
    securityRules: [
      {
        name: 'AllowHTTPS'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
          sourcePortRange: '*'
        }
      }
    ]
  }
}
```

#### Application Gateway and Azure Front Door

**Application Gateway:** Regional L7 load balancer with WAF, SSL termination,
URL-based routing, session affinity. V2 supports autoscaling.

**Azure Front Door:** Global L7 load balancer + CDN + WAF. Anycast routing to
the nearest edge PoP. Use for multi-region apps and global acceleration.

**When to use Front Door vs Application Gateway:** Front Door for global
distribution and CDN. Application Gateway for regional L7 routing within a VNet.
Combine both for multi-region apps (Front Door -> regional App Gateways).

#### Azure DNS, Load Balancer, Private Endpoints, ExpressRoute

**Azure DNS:** Host DNS zones. Private DNS Zones resolve names inside VNets
(critical for Private Endpoints).

**Load Balancer:** L4 (TCP/UDP). Standard SKU supports availability zones and
cross-region load balancing. Use for non-HTTP traffic.

**Private Endpoints:** Project an Azure PaaS service (SQL, Storage, Cosmos DB)
into your VNet with a private IP. Eliminates public internet exposure.

**ExpressRoute:** Dedicated private connection from on-premises to Azure (50 Mbps
to 100 Gbps). Lower latency and more reliable than site-to-site VPN.

```bash
# Create Private Endpoint for Azure SQL
az network private-endpoint create \
  --name pe-sql-prod \
  --resource-group rg-prod \
  --vnet-name vnet-prod \
  --subnet snet-data \
  --private-connection-resource-id "/subscriptions/.../Microsoft.Sql/servers/sql-prod" \
  --group-ids sqlServer \
  --connection-name pe-sql-conn

# Link Private DNS Zone
az network private-dns zone create \
  --resource-group rg-prod \
  --name privatelink.database.windows.net

az network private-dns link vnet create \
  --resource-group rg-prod \
  --zone-name privatelink.database.windows.net \
  --name link-vnet-prod \
  --virtual-network vnet-prod \
  --registration-enabled false
```

---

### Messaging

#### Service Bus

Enterprise message broker with queues and topics (pub/sub). Supports sessions,
dead-letter queues, scheduled delivery, transactions, and duplicate detection.

**When to use:** Ordered messaging, exactly-once processing, request-reply
patterns, decoupling microservices, transactional workflows.

**Pricing:** Basic (queues only), Standard (topics, 12.5M operations/month
included), Premium (dedicated resources, VNet, large messages up to 100 MB).

#### Event Hubs

Big data streaming platform. Millions of events per second. Compatible with
Apache Kafka protocol (no code changes for Kafka clients).

**When to use:** Telemetry ingestion, clickstream, IoT data, log aggregation,
real-time analytics pipelines with Spark/Flink/Stream Analytics.

**Key config:** Throughput units (Standard) or processing units (Premium),
partition count (immutable after creation), capture to Blob/ADLS, schema
registry.

#### Event Grid

Serverless event routing. Reacts to Azure resource events (blob created, resource
provisioned) and custom events. Push delivery to subscribers (webhooks, queues,
Functions, Event Hubs).

**When to use:** Resource lifecycle events, serverless event-driven architectures,
fan-out to multiple subscribers, CloudEvents-native workloads.

#### Queue Storage

Simple queue built into Azure Storage accounts. Low cost, high durability, up to
64 KB per message. No ordering guarantees.

**When to use:** Simple background processing, low cost, messages under 64 KB,
already using a Storage account. Choose Service Bus for advanced features.

| Feature             | Service Bus | Event Hubs | Event Grid  | Queue Storage |
|---------------------|-------------|------------|-------------|---------------|
| Pattern             | Queue/Topic | Stream     | Event route | Simple queue  |
| Message size        | 256KB-100MB | 1 MB       | 1 MB        | 64 KB         |
| Ordering            | FIFO        | Per-partition | No        | No            |
| Throughput          | Medium      | Very high  | High        | Medium        |
| Dead-letter         | Yes         | No         | Yes         | No            |
| Kafka compatible    | No          | Yes        | No          | No            |
| Price tier start    | ~$0.05/M    | ~$11/TU/mo | $0.60/M ops | ~$0.004/10K   |

---

### Identity

#### Entra ID (formerly Azure Active Directory)

Cloud identity platform. Authenticates users, applications, and managed
identities. Provides SSO, conditional access, and app registrations.

**Key concepts:** Tenants, app registrations (client IDs), service principals,
enterprise applications, groups, roles.

#### Managed Identity

Eliminate credentials from code. Azure automatically provisions and rotates
certificates. Two types: System-assigned (tied to a resource lifecycle) and
User-assigned (independent lifecycle, shareable).

```typescript
// TypeScript: Access Azure services with Managed Identity (no secrets)
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';
import { SecretClient } from '@azure/keyvault-secrets';

// DefaultAzureCredential auto-detects Managed Identity in Azure,
// and uses Azure CLI / VS Code credentials locally
const credential = new DefaultAzureCredential();

// Access Blob Storage — no connection string needed
const blobClient = new BlobServiceClient(
  'https://stproddata001.blob.core.windows.net',
  credential,
);

// Access Key Vault — no client secret needed
const kvClient = new SecretClient(
  'https://kv-prod.vault.azure.net',
  credential,
);
const secret = await kvClient.getSecret('database-password');
```

#### Role-Based Access Control (RBAC)

Assign permissions using roles at scopes (management group, subscription,
resource group, or resource). Built-in roles: Owner, Contributor, Reader, plus
hundreds of service-specific roles.

**Principle of least privilege:** Assign the narrowest role at the narrowest
scope. Prefer built-in roles. Use custom roles only when necessary.

```bash
# Assign Storage Blob Data Contributor to a managed identity
az role assignment create \
  --assignee "<managed-identity-principal-id>" \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/<sub-id>/resourceGroups/rg-prod/providers/Microsoft.Storage/storageAccounts/stproddata001"
```

---

## 10 Best Practices

1. **Use Managed Identity everywhere.** Eliminate connection strings, keys, and
   secrets from application code. Assign RBAC roles instead.
2. **Deploy across Availability Zones.** Use zone-redundant SKUs for VMs, AKS,
   SQL, Storage, and App Service to achieve 99.99% SLA.
3. **Use Private Endpoints for all PaaS services.** Keep data-plane traffic
   inside the VNet. Disable public access on Storage, SQL, Cosmos DB, Key Vault.
4. **Right-size compute before reserving.** Monitor actual usage for 2-4 weeks,
   then purchase Reserved Instances or Savings Plans for baseline.
5. **Design Cosmos DB partition keys carefully.** The partition key cannot be
   changed. Choose a high-cardinality key that distributes writes evenly.
6. **Implement lifecycle management for Blob Storage.** Automate tier transitions
   (Hot -> Cool -> Cold -> Archive -> Delete) to reduce storage costs by 60-80%.
7. **Separate system and user node pools in AKS.** Keep system components
   (CoreDNS, metrics-server) isolated from application workloads.
8. **Use deployment slots for zero-downtime releases.** Warm up the staging slot
   before swapping to production in App Service and Container Apps.
9. **Choose the right messaging service.** Service Bus for transactional
   workflows, Event Hubs for streaming, Event Grid for reactive events.
10. **Tag every resource with owner, environment, and cost-center.** Azure
    Policy can enforce tagging. Tags drive cost allocation and governance.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Storing secrets in app settings or env vars | Credential leaks, rotation nightmare | Use Key Vault references and Managed Identity |
| Deploying everything into one resource group | Blast radius too large, RBAC too broad | Group by lifecycle: one RG per app per environment |
| Using Classic resources (Cloud Services, ASM) | No ARM support, no RBAC, EOL path | Migrate to ARM-based services (VMs, App Service) |
| Single-region deployment without DR plan | Full outage during regional failure | Deploy to paired regions with geo-replication |
| Over-provisioning Cosmos DB RUs manually | 10x cost overrun on idle databases | Use autoscale or serverless for variable workloads |
| Public endpoints on PaaS services | Data exfiltration risk, compliance violations | Enable Private Endpoints; disable public access |
| Ignoring NSG flow logs | No visibility into network traffic anomalies | Enable NSG flow logs + Traffic Analytics |
| Using Premium SKU everywhere in dev/test | Massive cost waste in non-production | Use Basic/Standard SKUs, Azure Dev/Test pricing |

---

## Enforcement Checklist

- [ ] All PaaS services use Private Endpoints; public access disabled
- [ ] Managed Identity assigned to every compute resource (VMs, AKS, Functions, App Service)
- [ ] RBAC roles follow least-privilege; no standing Owner at subscription level
- [ ] Resources tagged with: `environment`, `owner`, `cost-center`, `project`
- [ ] Zone-redundant SKUs selected for all production workloads
- [ ] Blob Storage lifecycle policies configured for all storage accounts
- [ ] AKS clusters use system + user node pools with autoscaler enabled
- [ ] Diagnostic settings send logs to Log Analytics workspace
- [ ] Azure Policy assignments enforce tagging, allowed SKUs, and region constraints
- [ ] Network topology reviewed: VNet peering, NSGs, and route tables documented
