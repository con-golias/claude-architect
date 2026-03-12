# Azure Architecture Patterns

| Attribute      | Value                                                                 |
|---------------|-----------------------------------------------------------------------|
| Domain        | DevOps > Cloud > Azure                                                |
| Importance    | High                                                                  |
| Last Updated  | 2026-03-10                                                            |
| Cross-ref     | [Core Services](core-services.md), [Provider Comparison](../provider-comparison.md) |

---

## Core Concepts

### Azure Well-Architected Framework (5 Pillars)

The Azure Well-Architected Framework (WAF) guides architecture decisions. Every
Azure workload assessment maps to these five pillars.

| Pillar               | Focus                                  | Key Tool                  |
|----------------------|----------------------------------------|---------------------------|
| Reliability          | Resiliency, HA, DR                     | Availability Zones, ASR   |
| Security             | Zero trust, defense in depth           | Entra ID, Defender, NSGs  |
| Cost Optimization    | Eliminate waste, maximize value         | Cost Management, Advisor  |
| Operational Excellence | Automation, monitoring, DevOps        | Azure Monitor, IaC, CI/CD |
| Performance Efficiency | Scale to demand, optimize resources   | Autoscale, CDN, caching   |

Use the Azure Well-Architected Review (WAR) tool to assess workloads against
these pillars and receive prioritized recommendations.

```bash
# Run Azure Advisor recommendations (covers WAF pillars)
az advisor recommendation list \
  --category Cost HighAvailability Security Performance \
  --output table
```

---

### Web Application Architecture (App Service + SQL + CDN)

The classic three-tier web app: App Service for compute, Azure SQL for data,
Azure Front Door or CDN for static content and global acceleration.

```
Users --> Azure Front Door (CDN + WAF)
              |
              v
         App Service (P1v3, zone-redundant)
         [Deployment Slots: production, staging]
              |
              v
         Azure SQL (Business Critical, zone-redundant)
         [Auto-failover group for DR]
              |
         Azure Cache for Redis (session + query cache)
              |
         Azure Blob Storage (static assets, uploads)
```

```bicep
// Bicep: App Service with VNet integration and SQL backend
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'plan-web-prod'
  location: resourceGroup().location
  sku: { name: 'P1v3', tier: 'PremiumV3' }
  properties: { zoneRedundant: true }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-web-prod'
  location: resourceGroup().location
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    virtualNetworkSubnetId: snetApp.id
    siteConfig: {
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'AZURE_SQL_CONNECTION', value: '@Microsoft.KeyVault(VaultName=kv-prod;SecretName=sql-connection)' }
        { name: 'REDIS_CONNECTION', value: '@Microsoft.KeyVault(VaultName=kv-prod;SecretName=redis-connection)' }
      ]
    }
  }
  identity: { type: 'SystemAssigned' }
}
```

---

### Microservices on AKS

Run microservices on Azure Kubernetes Service. Use namespace isolation, KEDA for
event-driven autoscaling, Workload Identity for credential-free Azure access,
and Azure Service Mesh (Istio-based) or Dapr for service communication.

```
                    Azure Front Door
                         |
                    Ingress Controller (NGINX / App Gateway for Containers)
                         |
          +--------------+--------------+
          |              |              |
     orders-svc     payments-svc   notifications-svc
     (namespace:    (namespace:     (namespace:
      orders)        payments)       notifications)
          |              |              |
     Azure SQL      Cosmos DB      Service Bus
     (via PE)       (via PE)       (via PE)
```

```hcl
# Terraform: AKS with Workload Identity and KEDA
resource "azurerm_kubernetes_cluster" "aks" {
  name                = "aks-prod"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  dns_prefix          = "aks-prod"
  kubernetes_version  = "1.30"

  default_node_pool {
    name                 = "system"
    vm_size              = "Standard_D4s_v5"
    node_count           = 3
    zones                = [1, 2, 3]
    auto_scaling_enabled = true
    min_count            = 3
    max_count            = 5
    vnet_subnet_id       = azurerm_subnet.aks.id
  }

  identity { type = "SystemAssigned" }

  oidc_issuer_enabled       = true
  workload_identity_enabled = true

  network_profile {
    network_plugin = "azure"
    network_policy = "calico"
    service_cidr   = "10.1.0.0/16"
    dns_service_ip = "10.1.0.10"
  }

  key_vault_secrets_provider {
    secret_rotation_enabled = true
  }
}

resource "azurerm_kubernetes_cluster_node_pool" "workload" {
  name                  = "workload"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.aks.id
  vm_size               = "Standard_D8s_v5"
  zones                 = [1, 2, 3]
  auto_scaling_enabled  = true
  min_count             = 3
  max_count             = 50
  vnet_subnet_id        = azurerm_subnet.aks.id
}
```

---

### Serverless Patterns (Functions + Cosmos DB + Event Grid)

Fully event-driven architecture with no servers to manage. Azure Functions
react to events, Cosmos DB stores data with change feed, Event Grid routes
events between services.

**Pattern: Event-driven CRUD with change feed propagation**

```
Client --> API Management --> Azure Functions (HTTP trigger)
                                    |
                              Cosmos DB (NoSQL)
                                    |
                              Change Feed --> Azure Functions (Cosmos trigger)
                                                    |
                                              Event Grid --> Downstream consumers
```

```typescript
// Azure Function: Cosmos DB Change Feed trigger
import { app, InvocationContext } from '@azure/functions';

interface Product {
  id: string;
  name: string;
  price: number;
  _ts: number;
}

app.cosmosDB('productChangeFeed', {
  connection: 'CosmosDBConnection',
  databaseName: 'catalog',
  containerName: 'products',
  createLeaseContainerIfNotExists: true,
  handler: async (documents: Product[], context: InvocationContext) => {
    for (const doc of documents) {
      context.log(`Product changed: ${doc.id} - ${doc.name}`);
      // Publish event to Event Grid for downstream consumers
      await publishEvent('product.updated', {
        productId: doc.id,
        name: doc.name,
        price: doc.price,
      });
    }
  },
});
```

---

### Event-Driven Architecture (Event Hubs + Functions + Service Bus)

High-throughput event ingestion with Event Hubs, processing with Functions, and
reliable command delivery via Service Bus.

**Pattern: IoT/telemetry ingestion pipeline**

```
IoT Devices / Apps --> Event Hubs (millions/sec, Kafka protocol)
                            |
                       Azure Functions (Event Hub trigger)
                            |
               +------------+------------+
               |            |            |
          Real-time      Service Bus   Data Lake Gen2
          dashboard      (commands)    (cold storage)
          (SignalR)
```

```typescript
// Azure Function: Event Hubs batch processing
import { app, InvocationContext } from '@azure/functions';

interface TelemetryEvent {
  deviceId: string;
  temperature: number;
  timestamp: string;
}

app.eventHub('processTelemetry', {
  connection: 'EventHubConnection',
  eventHubName: 'telemetry',
  cardinality: 'many',
  handler: async (events: TelemetryEvent[], context: InvocationContext) => {
    const anomalies = events.filter(e => e.temperature > 100);

    if (anomalies.length > 0) {
      // Send alert commands via Service Bus for affected devices
      for (const anomaly of anomalies) {
        await sendToServiceBus('commands', {
          deviceId: anomaly.deviceId,
          action: 'emergency_shutdown',
          reason: `Temperature ${anomaly.temperature}C exceeds threshold`,
        });
      }
    }

    // Batch write all events to Data Lake for analytics
    await writeToDataLake(events);
    context.log(`Processed ${events.length} events, ${anomalies.length} anomalies`);
  },
});
```

---

### Azure Landing Zones and Management Groups

Landing Zones provide a standardized, scalable foundation for Azure environments.
Management groups create a hierarchy above subscriptions for governance at scale.

```
Root Management Group
  |- Platform
  |    |- Identity (Entra ID, DNS)
  |    |- Management (Log Analytics, Automation)
  |    |- Connectivity (Hub VNets, ExpressRoute, Firewall)
  |- Landing Zones
  |    |- Corp (internal apps, VNet-connected)
  |    |    |- Subscription: app-orders-prod
  |    |    |- Subscription: app-orders-dev
  |    |    |- Subscription: app-payments-prod
  |    |- Online (internet-facing apps)
  |         |- Subscription: app-web-prod
  |         |- Subscription: app-web-staging
  |- Sandbox (experimentation, no connectivity)
  |- Decommissioned
```

**Key principles:** One subscription per workload per environment. Azure Policy
applied at management group level cascades to all child subscriptions.

```bash
# Create management group hierarchy
az account management-group create --name "Platform" --parent "RootMG"
az account management-group create --name "LandingZones" --parent "RootMG"
az account management-group create --name "Corp" --parent "LandingZones"
az account management-group create --name "Online" --parent "LandingZones"

# Assign policy at management group level (cascades to all subscriptions)
az policy assignment create \
  --name "require-tags" \
  --policy "/providers/Microsoft.Authorization/policyDefinitions/<policy-id>" \
  --scope "/providers/Microsoft.Management/managementGroups/LandingZones" \
  --params '{"tagName": {"value": "cost-center"}}'
```

---

### Hub-Spoke Network Topology

Central hub VNet contains shared network services (firewall, VPN/ExpressRoute
gateway, DNS). Spoke VNets peer with the hub for each workload.

```
                    On-Premises
                         |
                    ExpressRoute / VPN
                         |
                    Hub VNet (10.0.0.0/16)
                    |- Azure Firewall  (10.0.1.0/24)
                    |- VPN Gateway     (10.0.2.0/24)
                    |- Bastion Host    (10.0.3.0/24)
                    |- DNS Resolver    (10.0.4.0/24)
                         |
              VNet Peering (hub <--> spokes)
                    /              \
     Spoke: Orders                Spoke: Payments
     (10.1.0.0/16)               (10.2.0.0/16)
     |- snet-app                  |- snet-app
     |- snet-data                 |- snet-data
     |- snet-aks                  |- snet-aks
```

**Key design decisions:**
- Use Azure Firewall or NVA in the hub for centralized egress control
- Configure User Defined Routes (UDR) to force spoke traffic through hub firewall
- Use Private DNS Zones linked to hub for centralized DNS resolution
- Enable VNet peering with `allowGatewayTransit` on hub, `useRemoteGateways` on spokes

---

### Azure DevOps vs GitHub Actions for Azure

| Capability              | Azure DevOps                      | GitHub Actions                     |
|-------------------------|-----------------------------------|------------------------------------|
| Pipeline definition     | YAML (azure-pipelines.yml)        | YAML (.github/workflows/)         |
| Azure integration       | Native (service connections)      | OIDC federation (recommended)     |
| Artifact management     | Azure Artifacts (NuGet, npm, etc) | GitHub Packages                   |
| Board/project tracking  | Azure Boards (built-in)           | GitHub Projects / Issues          |
| Self-hosted agents      | Azure DevOps agents               | GitHub Actions runners            |
| Approval gates          | Environments + approvals          | Environments + protection rules   |
| Best for                | Enterprise, complex release gates | Open source, GitHub-native teams  |

```yaml
# GitHub Actions: Deploy to Azure with OIDC (no secrets stored)
name: Deploy to Azure
on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - uses: azure/webapps-deploy@v3
        with:
          app-name: app-web-prod
          slot-name: staging
          package: ./dist

      - name: Swap staging to production
        run: |
          az webapp deployment slot swap \
            --name app-web-prod \
            --resource-group rg-prod \
            --slot staging \
            --target-slot production
```

---

### Azure AI Studio Integration Patterns

Azure AI Foundry (formerly AI Studio) provides a unified platform for building,
evaluating, and deploying AI models. Integrate with Azure OpenAI Service, Azure
AI Search, and custom models.

**Pattern: RAG (Retrieval-Augmented Generation) on Azure**

```
User Query --> API Management --> Azure Functions
                                      |
                                Azure AI Search (vector + keyword hybrid)
                                      |
                                Azure OpenAI Service (GPT-4o / GPT-4.1)
                                      |
                                Response with grounded citations
```

**Key services:**
- **Azure OpenAI Service:** GPT-4o, GPT-4.1, o3/o4-mini reasoning, embeddings
- **Azure AI Search:** Hybrid search (keyword + vector + semantic ranking)
- **Azure AI Foundry:** Model catalog, prompt flow, evaluation, deployment
- **Content Safety:** Filter harmful content from inputs and outputs

```typescript
// TypeScript: Azure OpenAI with Azure AI Search (RAG pattern)
import { AzureOpenAI } from 'openai';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';

const credential = new DefaultAzureCredential();
const scope = 'https://cognitiveservices.azure.com/.default';
const tokenProvider = getBearerTokenProvider(credential, scope);

const client = new AzureOpenAI({
  azureADTokenProvider: tokenProvider,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
  apiVersion: '2025-03-01-preview',
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'Answer using the provided context only.' },
    { role: 'user', content: 'What is our refund policy?' },
  ],
  data_sources: [
    {
      type: 'azure_search',
      parameters: {
        endpoint: process.env.AZURE_SEARCH_ENDPOINT!,
        index_name: 'knowledge-base',
        authentication: { type: 'system_assigned_managed_identity' },
        query_type: 'vector_semantic_hybrid',
        embedding_dependency: {
          type: 'deployment_name',
          deployment_name: 'text-embedding-3-large',
        },
      },
    },
  ],
});
```

---

### Disaster Recovery

#### Azure Site Recovery (ASR)

Replicates VMs between Azure regions or from on-premises to Azure. Provides
automated failover and failback with RTO of under 15 minutes and RPO of under
5 minutes.

#### Geo-Replication Strategies

| Service        | DR Strategy                                         | RPO         | RTO          |
|----------------|-----------------------------------------------------|-------------|--------------|
| Azure SQL      | Auto-failover groups (async geo-replication)        | < 5 seconds | < 30 seconds |
| Cosmos DB      | Multi-region writes (active-active)                 | 0           | 0            |
| Blob Storage   | GRS/GZRS (async replication to paired region)       | < 15 min    | < 1 hour     |
| AKS            | Cluster per region + Azure Front Door               | Varies      | Minutes      |
| App Service    | Deploy to both regions + Front Door routing          | 0           | Seconds      |

#### Paired Regions

Azure pairs regions within the same geography (e.g., East US + West US, North
Europe + West Europe). Platform updates are sequenced across pairs. Some services
(GRS, ASR) use paired regions by default.

---

### Hybrid Cloud (Azure Arc and Azure Stack HCI)

**Azure Arc:** Extend Azure management to any infrastructure. Project on-premises
servers, Kubernetes clusters, and SQL Server instances into Azure Resource
Manager. Apply Azure Policy, RBAC, and monitoring across hybrid environments.

**Azure Stack HCI:** Run Azure services on-premises on validated hardware. Host
AKS, Azure Virtual Desktop, and VMs with Azure billing and management.

**When to use Arc:** Manage existing on-prem servers, multi-cloud Kubernetes,
edge locations. **When to use Stack HCI:** Run Azure workloads on-prem due to
sovereignty, latency, or disconnected requirements.

```bash
# Connect an on-premises Kubernetes cluster to Azure Arc
az connectedk8s connect \
  --name k8s-onprem-factory \
  --resource-group rg-arc \
  --location eastus

# Apply Azure Policy to Arc-connected cluster
az policy assignment create \
  --name "enforce-pod-security" \
  --policy "Kubernetes cluster pods should only use allowed images" \
  --scope "/subscriptions/<sub-id>/resourceGroups/rg-arc/providers/Microsoft.Kubernetes/connectedClusters/k8s-onprem-factory"
```

---

## 10 Best Practices

1. **Start with Azure Landing Zones.** Use the Cloud Adoption Framework (CAF)
   Enterprise-Scale architecture for governance, networking, and identity from day
   one. Retrofitting governance is far more expensive.
2. **Adopt hub-spoke topology for networking.** Centralize egress through Azure
   Firewall, share ExpressRoute/VPN gateways, and use Private DNS Zones in the
   hub for consistent name resolution.
3. **Design for multi-region from the start.** Even if deploying to one region
   initially, choose services that support geo-replication and use Azure Front
   Door for global entry points.
4. **Use OIDC federation for CI/CD (no stored secrets).** Configure GitHub
   Actions or Azure DevOps with workload identity federation instead of client
   secrets or PATs.
5. **Apply Azure Policy at the management group level.** Enforce tagging,
   allowed regions, allowed SKUs, and diagnostic settings. Policies cascade to
   all child subscriptions automatically.
6. **Use deployment slots and traffic splitting.** Deploy to staging, validate
   with smoke tests, then swap to production. Container Apps revision mode
   supports weighted traffic routing.
7. **Implement the Well-Architected Review quarterly.** Run the Azure
   Well-Architected Assessment against each workload. Track recommendations
   as engineering backlog items.
8. **Separate subscriptions by workload and environment.** One subscription per
   application per environment provides RBAC isolation, cost visibility, and
   blast-radius containment.
9. **Use Bicep or Terraform for all infrastructure.** No portal clicks in
   production. IaC enables review, versioning, drift detection, and reproducible
   environments.
10. **Plan Cosmos DB partition strategy before writing data.** Partition key
    affects query performance, cost, and scalability. Changing it later requires
    full data migration.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Click-ops (portal deployments to production) | Configuration drift, no audit trail, unreproducible | IaC with Bicep/Terraform; lock production RGs |
| Single subscription for everything | RBAC blast radius too wide, cost chaos, quota limits | Separate subscriptions per workload per environment |
| Flat network (one VNet, no segmentation) | Lateral movement risk, no traffic control | Hub-spoke with NSGs, Azure Firewall, and UDRs |
| Deploying directly to production slot | Downtime, no rollback, no pre-warming | Use staging slots, validate, then swap |
| Ignoring Azure Advisor recommendations | Missing easy wins on cost, security, and reliability | Review Advisor weekly; automate remediation |
| Hardcoding connection strings in CI/CD | Credential leaks, rotation requires pipeline changes | Use OIDC federation + Managed Identity + Key Vault |
| No disaster recovery testing | DR plan fails when actually needed | Run DR drills quarterly; automate failover validation |
| Skipping management group hierarchy | Per-subscription policy management does not scale | Define management group tree with inherited policies |

---

## Enforcement Checklist

- [ ] Azure Landing Zone deployed (management groups, policies, connectivity hub)
- [ ] Hub-spoke network topology with centralized firewall and DNS
- [ ] All production infrastructure defined in Bicep or Terraform (no portal deployments)
- [ ] CI/CD uses OIDC workload identity federation (no stored client secrets)
- [ ] Azure Policy enforces: required tags, allowed regions, allowed SKUs, diagnostic settings
- [ ] Deployment slots used for all App Service and Container Apps production releases
- [ ] DR strategy documented and tested for each workload (RPO/RTO targets defined)
- [ ] Well-Architected Review completed for each production workload
- [ ] Multi-region deployment or documented region-failure playbook exists
- [ ] Azure Advisor recommendations reviewed and triaged weekly
