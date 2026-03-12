# Azure Cost Optimization

| Attribute      | Value                                                                 |
|---------------|-----------------------------------------------------------------------|
| Domain        | DevOps > Cloud > Azure                                                |
| Importance    | High                                                                  |
| Last Updated  | 2026-03-10                                                            |
| Cross-ref     | [Core Services](core-services.md), [Architecture Patterns](architecture-patterns.md) |

---

## Core Concepts

### Azure Pricing Models

Azure offers multiple pricing models. Combine them strategically to minimize
cost while maintaining performance and availability.

| Model              | Discount    | Commitment        | Best For                            |
|--------------------|-------------|-------------------|-------------------------------------|
| Pay-As-You-Go      | 0% (base)   | None              | Variable workloads, experimentation |
| Reserved Instances | Up to 72%   | 1 or 3 years      | Steady-state VMs, databases         |
| Savings Plans      | Up to 65%   | $/hr for 1 or 3yr | Dynamic compute across regions/SKUs |
| Spot VMs           | Up to 90%   | None (evictable)  | Batch, CI/CD, fault-tolerant jobs   |
| Dev/Test Pricing   | Up to 55%   | VS subscription   | Non-production environments         |

**Reserved Instances vs Savings Plans:** RIs lock a specific VM size in a
specific region. Savings Plans commit to a $/hr spend across any VM size,
region, or even across services (Compute Savings Plan). Savings Plans offer more
flexibility; RIs offer deeper discounts for predictable workloads.

```bash
# List current reservations and utilization
az reservations reservation list \
  --reservation-order-id <order-id> \
  --output table

# Check Savings Plan utilization
az billing savings-plan list \
  --output table

# View Azure Advisor cost recommendations
az advisor recommendation list --category Cost --output table
```

#### Spot VMs

Spot VMs use surplus Azure capacity at up to 90% discount. Azure can evict them
with 30 seconds notice when capacity is needed. Set a max price or use -1 for
market price.

```bicep
// Bicep: Spot VM for batch processing
resource spotVM 'Microsoft.Compute/virtualMachines@2024-07-01' = {
  name: 'vm-batch-spot'
  location: resourceGroup().location
  properties: {
    hardwareProfile: { vmSize: 'Standard_D8s_v5' }
    priority: 'Spot'
    evictionPolicy: 'Deallocate'  // or 'Delete' for ephemeral
    billingProfile: { maxPrice: -1 }  // -1 = pay up to on-demand price
    storageProfile: {
      osDisk: {
        createOption: 'FromImage'
        managedDisk: { storageAccountType: 'Standard_LRS' }
      }
      imageReference: {
        publisher: 'Canonical'
        offer: '0001-com-ubuntu-server-jammy'
        sku: '22_04-lts-gen2'
        version: 'latest'
      }
    }
    osProfile: {
      computerName: 'vm-batch-spot'
      adminUsername: 'azureuser'
      linuxConfiguration: {
        disablePasswordAuthentication: true
        ssh: { publicKeys: [ { path: '/home/azureuser/.ssh/authorized_keys', keyData: sshPublicKey } ] }
      }
    }
  }
}
```

---

### Azure Cost Management + Billing

The primary tool for monitoring, analyzing, and optimizing Azure spend. Available
in the Azure portal and via API.

**Key features:**
- **Cost Analysis:** Breakdown by service, resource group, tag, region, or meter
- **Budgets:** Set monthly/quarterly/annual budgets with alert thresholds
- **Exports:** Schedule daily/weekly CSV exports to Storage for BI pipelines
- **Anomaly Detection:** ML-based alerts when spend deviates from patterns
- **Power BI integration:** Detailed cost dashboards via the Cost Management connector

```bash
# Create a monthly budget with alerts
az consumption budget create \
  --budget-name "prod-monthly" \
  --resource-group rg-prod \
  --amount 10000 \
  --time-grain Monthly \
  --start-date 2026-01-01 \
  --end-date 2026-12-31 \
  --notifications '{
    "at80Percent": {
      "enabled": true,
      "operator": "GreaterThanOrEqualTo",
      "threshold": 80,
      "contactEmails": ["platform-team@company.com"],
      "contactRoles": ["Owner"]
    },
    "at100Percent": {
      "enabled": true,
      "operator": "GreaterThanOrEqualTo",
      "threshold": 100,
      "contactEmails": ["platform-team@company.com", "finance@company.com"],
      "contactRoles": ["Owner", "Contributor"]
    }
  }'

# Export cost data to storage for analysis
az costmanagement export create \
  --name "daily-export" \
  --scope "/subscriptions/<sub-id>" \
  --type ActualCost \
  --timeframe MonthToDate \
  --storage-account-id "/subscriptions/<sub-id>/resourceGroups/rg-shared/providers/Microsoft.Storage/storageAccounts/stcostexport" \
  --storage-container exports \
  --schedule-recurrence Daily \
  --schedule-status Active
```

---

### Cost Allocation and Tagging

Tags are the foundation of cost allocation. Without consistent tagging, cost
attribution across teams, projects, and environments is impossible.

**Required tag taxonomy:**

| Tag Key        | Purpose                       | Example Values                 |
|----------------|-------------------------------|--------------------------------|
| `environment`  | Separate prod/dev costs       | `production`, `staging`, `dev` |
| `cost-center`  | Finance chargeback            | `CC-1234`, `engineering`       |
| `owner`        | Accountability                | `team-platform`, `john@co.com` |
| `project`      | Project-level cost tracking   | `checkout-v2`, `data-pipeline` |
| `managed-by`   | IaC vs manual tracking        | `terraform`, `bicep`, `manual` |

```hcl
# Terraform: Azure Policy to enforce required tags
resource "azurerm_subscription_policy_assignment" "require_tags" {
  name                 = "require-cost-center-tag"
  subscription_id      = data.azurerm_subscription.current.id
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/871b6d14-10aa-478d-b466-ef6698305b4c"

  parameters = jsonencode({
    tagName = { value = "cost-center" }
  })

  non_compliance_message {
    content = "Resource must have a 'cost-center' tag for cost allocation."
  }
}

# Inherit tags from resource group (apply at subscription level)
resource "azurerm_subscription_policy_assignment" "inherit_tags" {
  name                 = "inherit-env-tag-from-rg"
  subscription_id      = data.azurerm_subscription.current.id
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/cd3aa116-8754-49c9-a813-ad46512ece54"

  parameters = jsonencode({
    tagName = { value = "environment" }
  })

  identity { type = "SystemAssigned" }
  location = "eastus"
}
```

---

### Azure Advisor Recommendations

Azure Advisor provides personalized recommendations across cost, reliability,
performance, operational excellence, and security. Cost recommendations include:

- **Shut down underutilized VMs** (< 5% average CPU over 7 days)
- **Right-size VMs** (current SKU is over-provisioned for actual usage)
- **Buy Reserved Instances** (based on 30-day usage patterns)
- **Delete unattached disks** (orphaned managed disks from deleted VMs)
- **Use Spot VMs** for fault-tolerant workloads

```typescript
// TypeScript: Fetch Advisor cost recommendations via Azure SDK
import { AdvisorManagementClient } from '@azure/arm-advisor';
import { DefaultAzureCredential } from '@azure/identity';

const client = new AdvisorManagementClient(
  new DefaultAzureCredential(),
  process.env.AZURE_SUBSCRIPTION_ID!,
);

const recommendations = client.recommendations.list();

for await (const rec of recommendations) {
  if (rec.category === 'Cost') {
    console.log(`[${rec.impact}] ${rec.shortDescription?.problem}`);
    console.log(`  Solution: ${rec.shortDescription?.solution}`);
    console.log(`  Savings: ${rec.extendedProperties?.annualSavingsAmount} ${rec.extendedProperties?.savingsCurrency}/year`);
  }
}
```

---

### Right-Sizing VMs and Databases

Over-provisioning is the most common source of cloud waste. Monitor actual usage
before selecting SKUs, and re-evaluate monthly.

**VM right-sizing workflow:**
1. Enable Azure Monitor VM Insights for CPU, memory, disk, and network metrics
2. Analyze 14-30 days of utilization data
3. Use Advisor recommendations or custom queries to identify waste
4. Resize VMs during maintenance windows (causes a brief restart)
5. Consider B-series burstable VMs for workloads with spiky CPU

**Database right-sizing:**
- Azure SQL: Switch to serverless compute (auto-pause after idle period)
- Flexible Server PostgreSQL: Scale vCores and storage independently
- Use elastic pools to share DTUs/vCores across multiple databases

```bash
# Check VM CPU utilization over 30 days (Log Analytics / KQL)
az monitor metrics list \
  --resource "/subscriptions/<sub-id>/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-app" \
  --metric "Percentage CPU" \
  --interval PT1H \
  --aggregation Average \
  --start-time 2026-02-08T00:00:00Z \
  --end-time 2026-03-10T00:00:00Z \
  --output table

# Resize a VM (causes restart)
az vm resize \
  --resource-group rg-prod \
  --name vm-app \
  --size Standard_D2s_v5
```

---

### Cosmos DB RU Optimization

Cosmos DB charges per Request Unit (RU). One RU = one 1 KB point read. Queries
cost 2-100+ RUs depending on complexity. Optimize partition key, indexing policy,
and provisioning model.

**Provisioning models:**

| Model        | Use Case                           | Cost Behavior                     |
|--------------|------------------------------------|-----------------------------------|
| Manual       | Predictable, steady throughput     | Fixed $/hr per 100 RU/s          |
| Autoscale    | Variable with known peak           | Scales 10%-100% of max, pay peak  |
| Serverless   | Low/intermittent traffic           | Pay per RU consumed, no minimum   |

**Key optimization strategies:**
- Design partition key for even write distribution and minimal cross-partition queries
- Customize indexing policy: exclude unused paths, use composite indexes for ORDER BY
- Use point reads (id + partition key) instead of queries where possible
- Enable integrated cache (dedicated gateway) for read-heavy workloads

```typescript
// Measure RU cost per operation
import { CosmosClient } from '@azure/cosmos';

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING!);
const container = client.database('orders-db').container('orders');

// Point read: ~1 RU for a 1 KB document
const { resource, headers } = await container.item('order-123', 'customer-456').read();
console.log(`Point read cost: ${headers['x-ms-request-charge']} RUs`);

// Query: cost varies with complexity
const { resources, requestCharge } = await container.items
  .query({
    query: 'SELECT * FROM c WHERE c.status = @status',
    parameters: [{ name: '@status', value: 'pending' }],
  })
  .fetchAll();
console.log(`Query cost: ${requestCharge} RUs for ${resources.length} results`);
```

```json
// Cosmos DB custom indexing policy: exclude heavy paths, add composites
{
  "indexingMode": "consistent",
  "automatic": true,
  "includedPaths": [
    { "path": "/customerId/?" },
    { "path": "/status/?" },
    { "path": "/createdAt/?" }
  ],
  "excludedPaths": [
    { "path": "/metadata/*" },
    { "path": "/largePayload/*" },
    { "path": "/_etag/?" }
  ],
  "compositeIndexes": [
    [
      { "path": "/status", "order": "ascending" },
      { "path": "/createdAt", "order": "descending" }
    ]
  ]
}
```

---

### Azure Functions: Consumption vs Premium vs Dedicated

| Aspect           | Consumption           | Flex Consumption       | Premium (EP)          | Dedicated (ASP)      |
|------------------|-----------------------|------------------------|-----------------------|----------------------|
| Cold start       | Yes (seconds)         | Reduced (always-ready) | No                    | No                   |
| Scale limit      | 200 instances         | 1000 instances         | 100 instances         | 10-30 (manual)       |
| VNet integration | No                    | Yes                    | Yes                   | Yes (Isolated)       |
| Pricing          | Per-execution + GB-s  | Per-execution + ready  | Per-instance per hour | ASP pricing          |
| Free grant       | 1M exec + 400K GB-s   | None                   | None                  | None                 |
| Best for         | Low-traffic, sporadic | Medium, VNet needed    | High-traffic, no cold | Existing ASP capacity|

**Optimization tips:**
- Start with Consumption for new workloads; move to Flex or Premium when cold
  start latency or VNet integration is required
- Flex Consumption provides per-function always-ready instances for critical paths
- For Functions running 24/7 at steady load, Dedicated on an existing App Service
  Plan is often cheapest

---

### App Service Plan Optimization

App Service Plans define the compute for App Service, Functions (Dedicated), and
Logic Apps. Multiple apps can share one plan.

**Optimization strategies:**
- **Consolidate apps on shared plans.** Multiple low-traffic apps on one Standard
  plan beats individual plans per app
- **Use autoscale rules.** Scale out on CPU/memory/HTTP queue, scale in during
  off-peak hours
- **Downgrade non-production plans.** Use B1/B2 for dev/staging; P1v3+ for prod
- **Delete unused plans.** Empty plans still incur charges

```bash
# Check App Service Plan utilization
az monitor metrics list \
  --resource "/subscriptions/<sub-id>/resourceGroups/rg-prod/providers/Microsoft.Web/serverfarms/plan-web-prod" \
  --metric "CpuPercentage" "MemoryPercentage" \
  --interval PT1H \
  --aggregation Average \
  --output table

# Configure autoscale for App Service Plan
az monitor autoscale create \
  --resource-group rg-prod \
  --resource plan-web-prod \
  --resource-type Microsoft.Web/serverfarms \
  --min-count 2 --max-count 10 --count 3

az monitor autoscale rule create \
  --resource-group rg-prod \
  --autoscale-name plan-web-prod \
  --condition "CpuPercentage > 75 avg 10m" \
  --scale out 1

az monitor autoscale rule create \
  --resource-group rg-prod \
  --autoscale-name plan-web-prod \
  --condition "CpuPercentage < 25 avg 10m" \
  --scale in 1
```

---

### Blob Storage Tiering

Storage tiering is one of the highest-ROI cost optimizations. Most data is
accessed infrequently after initial creation.

| Tier      | $/GB/month (LRS) | Access Cost   | Min Retention | Use Case              |
|-----------|-------------------|---------------|---------------|-----------------------|
| Hot       | ~$0.018           | Low           | None          | Frequently accessed   |
| Cool      | ~$0.010           | Medium        | 30 days       | Infrequent access     |
| Cold      | ~$0.0036          | Higher        | 90 days       | Rare access           |
| Archive   | ~$0.00099         | Very high     | 180 days      | Compliance, long-term |

**Break-even analysis:** If a blob is accessed less than once per month, Cool
tier saves money. If accessed less than once per quarter, Cold tier wins. For
data retained purely for compliance, Archive costs 95% less than Hot.

Configure lifecycle management policies to automate transitions. See the Bicep
example in [Core Services](core-services.md) for the policy definition.

---

### Bandwidth and Networking Costs

Azure charges for egress (data leaving Azure), not ingress. Bandwidth costs
are often overlooked but can be significant at scale.

| Traffic Type                  | Cost                                   |
|-------------------------------|----------------------------------------|
| Inbound (ingress)             | Free                                   |
| Outbound to internet          | ~$0.087/GB (first 10 TB/month)         |
| VNet peering (same region)    | $0.01/GB each direction                |
| VNet peering (cross-region)   | $0.035-$0.075/GB                       |
| ExpressRoute (metered)        | $0.025/GB outbound                     |
| ExpressRoute (unlimited)      | Fixed monthly fee, no per-GB charge    |
| Azure Front Door transfer     | $0.08/GB (Zone 1)                      |
| Private Endpoint data         | $0.01/GB processed                     |

**Optimization strategies:**
- Use Azure Front Door or CDN to cache content at edge (reduces origin egress)
- Choose VNet peering within the same region whenever possible
- Use ExpressRoute Unlimited for high-volume hybrid connectivity
- Deploy multi-region to keep traffic local (users -> nearest region)
- Compress API responses (gzip/Brotli) to reduce transfer volume

---

### Azure Hybrid Benefit

Bring existing Windows Server and SQL Server licenses (with Software Assurance)
to Azure for significant savings. Also applies to Linux subscriptions (Red Hat,
SUSE).

| License Type           | Savings on Azure                         |
|------------------------|------------------------------------------|
| Windows Server (SA)    | Up to 85% (combined with RI)             |
| SQL Server Enterprise  | Up to 55% on Azure SQL                   |
| SQL Server Standard    | Up to 40% on Azure SQL                   |
| Red Hat / SUSE (BYOS)  | Save on Linux subscription premium       |

```bash
# Enable Azure Hybrid Benefit on a VM
az vm update \
  --resource-group rg-prod \
  --name vm-web \
  --set licenseType=Windows_Server

# Enable Hybrid Benefit on Azure SQL
az sql db update \
  --resource-group rg-prod \
  --server sql-prod \
  --name db-orders \
  --set licenseType=BasePrice  # BasePrice = Hybrid Benefit
```

---

### Azure Dev/Test Subscriptions

Dev/Test subscriptions provide discounted rates for non-production workloads.
Available through Enterprise Agreement (EA) and Visual Studio subscriptions.

**Key benefits:**
- No Windows Server license charges on VMs
- Discounted rates on many PaaS services
- Access to dev/test images in the marketplace
- Separate billing identity for cost tracking

**Restriction:** Dev/Test subscriptions must not run production workloads.
Enforce this with Azure Policy (deny production tags, restrict SKU sizes).

---

### Commitment Strategy Decision Framework

Use this framework to decide which commitment model to apply to each workload.

```
                        Is the workload steady-state?
                              /           \
                           Yes             No
                            |               |
                    Predictable SKU?    Spiky/variable?
                      /        \           |
                   Yes          No     Pay-as-you-go
                    |            |     + autoscale
               Reserved      Savings
               Instance       Plan        Can it tolerate
               (1yr/3yr)    (1yr/3yr)     interruption?
                                            /       \
                                          Yes        No
                                           |          |
                                        Spot VM    On-demand
```

**Commitment buying process:**
1. Run workloads on pay-as-you-go for 30-60 days to establish baseline
2. Review Azure Advisor reservation recommendations
3. Start with 1-year commitments to reduce risk
4. Use Savings Plans for dynamic/evolving workloads across regions
5. Layer Spot VMs for fault-tolerant batch processing
6. Re-evaluate commitments quarterly with actual usage data

```bash
# View reservation recommendations from Advisor
az advisor recommendation list \
  --category Cost \
  --query "[?contains(shortDescription.problem, 'Reserved')]" \
  --output table

# View current reservation utilization (target: >90%)
az consumption reservation summary list \
  --reservation-order-id <order-id> \
  --grain monthly \
  --output table
```

---

## 10 Best Practices

1. **Implement cost tagging from day one.** Enforce tags (`cost-center`,
   `environment`, `owner`, `project`) via Azure Policy. Without tags, cost
   attribution requires manual detective work.
2. **Set budgets and alerts per resource group and subscription.** Configure
   alerts at 50%, 80%, and 100% thresholds. Include both email and Action Group
   notifications for automated responses.
3. **Right-size before committing.** Run workloads for 30 days on pay-as-you-go,
   analyze actual utilization, then purchase Reserved Instances or Savings Plans
   for the established baseline.
4. **Use serverless and autoscale for variable workloads.** Cosmos DB serverless,
   Functions Consumption plan, and VMSS autoscale eliminate paying for idle
   capacity.
5. **Automate Blob Storage lifecycle policies.** Move data through Hot -> Cool ->
   Cold -> Archive -> Delete tiers automatically. Most data is cold after 30 days.
6. **Leverage Azure Hybrid Benefit.** Apply existing Windows Server and SQL
   Server licenses to Azure VMs and databases. Combine with RIs for up to 85%
   savings.
7. **Use Dev/Test subscriptions for non-production.** Separate dev/staging into
   EA Dev/Test subscriptions for discounted rates and license-free Windows VMs.
8. **Monitor Cosmos DB RU consumption per operation.** Log `x-ms-request-charge`
   headers. Optimize partition keys, indexing policies, and query patterns to
   reduce RU spend.
9. **Review Azure Advisor weekly.** Advisor surfaces idle resources, right-sizing
   opportunities, and reservation recommendations with estimated savings.
10. **Schedule non-production shutdowns.** Auto-shutdown dev/test VMs and scale
    AKS dev clusters to zero nodes outside business hours. Use Azure Automation
    or start/stop solutions.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| No tagging strategy | Cannot attribute costs to teams or projects | Enforce tags via Azure Policy before any deployment |
| Buying 3-year RIs before usage stabilizes | Locked into wrong SKU, wasted commitment | Start with 1-year; buy 3-year only after 6+ months data |
| Running dev/test on production SKUs | 3-5x overspend on non-production environments | Use B-series VMs, serverless DBs, Dev/Test subscriptions |
| Manual Cosmos DB RU provisioning at peak | Paying for peak 24/7 when load is variable | Switch to autoscale (10%-100%) or serverless mode |
| Ignoring orphaned resources (disks, IPs, NICs) | Silent cost accumulation after VM/resource deletion | Schedule monthly cleanup; use Advisor orphan alerts |
| All Blob data in Hot tier permanently | 60-80% overspend on infrequently accessed data | Implement lifecycle policies for automatic tier transition |
| No egress cost awareness | Surprise bandwidth bills at scale (multi-region) | Monitor egress metrics; use CDN and regional deployment |
| Skipping commitment reviews quarterly | Over- or under-committed as workloads change | Calendar quarterly reservation/savings plan reviews |

---

## Enforcement Checklist

- [ ] Azure Policy enforces required tags (`cost-center`, `environment`, `owner`) on all resources
- [ ] Monthly budgets with alerts configured per subscription and critical resource groups
- [ ] Azure Cost Management exports scheduled daily to Storage for BI/analytics
- [ ] Advisor cost recommendations reviewed and triaged weekly (target: no open High-impact items)
- [ ] Reserved Instances or Savings Plans purchased for steady-state workloads (target: >80% coverage)
- [ ] Blob Storage lifecycle policies active on all storage accounts
- [ ] Dev/Test environments use Dev/Test subscriptions or B-series/serverless SKUs
- [ ] Cosmos DB containers use autoscale or serverless (no over-provisioned manual RUs)
- [ ] Non-production VMs and AKS clusters auto-shutdown outside business hours
- [ ] Azure Hybrid Benefit applied to all eligible Windows Server and SQL Server workloads
