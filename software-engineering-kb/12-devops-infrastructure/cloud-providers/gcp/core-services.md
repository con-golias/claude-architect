# GCP: Core Services

| Attribute     | Value                                                                 |
|--------------|-----------------------------------------------------------------------|
| Domain       | DevOps > Cloud > GCP                                                  |
| Importance   | High                                                                  |
| Last Updated | 2026-03-10                                                            |
| Cross-ref    | [Architecture Patterns](architecture-patterns.md), [Cost Optimization](cost-optimization.md) |

---

## Core Concepts

### Compute Services

#### Compute Engine (IaaS VMs)

Compute Engine provides configurable virtual machines with custom or predefined machine types.
Use for lift-and-shift, HPC, or workloads requiring specific OS/kernel configurations.

```bash
# Create a VM with e2-medium machine type
gcloud compute instances create web-server-1 \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=50GB \
  --tags=http-server,https-server \
  --metadata=startup-script='#!/bin/bash
    apt-get update && apt-get install -y nginx'

# Create instance from instance template (production pattern)
gcloud compute instance-templates create web-template \
  --machine-type=n2-standard-4 \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=100GB \
  --metadata-from-file=startup-script=startup.sh

gcloud compute instance-groups managed create web-group \
  --base-instance-name=web \
  --template=web-template \
  --size=3 \
  --zone=us-central1-a
```

```hcl
# Terraform — Compute Engine with managed instance group
resource "google_compute_instance_template" "web" {
  name_prefix  = "web-"
  machine_type = "n2-standard-4"
  region       = "us-central1"

  disk {
    source_image = "debian-cloud/debian-12"
    auto_delete  = true
    boot         = true
    disk_size_gb = 100
  }

  network_interface {
    network    = google_compute_network.main.id
    subnetwork = google_compute_subnetwork.main.id
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_region_instance_group_manager" "web" {
  name               = "web-mig"
  base_instance_name = "web"
  region             = "us-central1"
  target_size        = 3

  version {
    instance_template = google_compute_instance_template.web.id
  }

  auto_healing_policies {
    health_check      = google_compute_health_check.web.id
    initial_delay_sec = 300
  }
}
```

#### GKE and Autopilot

Google Kubernetes Engine is the managed Kubernetes service. Autopilot mode fully manages
node infrastructure, charging per pod resource request.

```bash
# Create Autopilot cluster (recommended for most workloads)
gcloud container clusters create-auto production-cluster \
  --region=us-central1 \
  --release-channel=regular \
  --enable-master-authorized-networks \
  --master-authorized-networks=10.0.0.0/8

# Create Standard cluster (when you need node-level control)
gcloud container clusters create standard-cluster \
  --region=us-central1 \
  --num-nodes=3 \
  --enable-autoscaling --min-nodes=1 --max-nodes=10 \
  --machine-type=n2-standard-4 \
  --enable-autorepair \
  --enable-autoupgrade \
  --release-channel=regular
```

**Autopilot vs Standard decision:** Use Autopilot unless you need GPU node pools,
DaemonSets with host access, specific kernel modules, or Windows containers.

#### Cloud Run (Serverless Containers)

Cloud Run runs stateless containers without managing infrastructure. Scales to zero.
Supports HTTP, gRPC, WebSockets, and background tasks via Cloud Run jobs.

```bash
# Deploy a container to Cloud Run
gcloud run deploy my-api \
  --image=us-central1-docker.pkg.dev/my-project/repo/my-api:v1.2.0 \
  --region=us-central1 \
  --platform=managed \
  --cpu=2 --memory=1Gi \
  --min-instances=1 --max-instances=100 \
  --concurrency=80 \
  --set-env-vars="DB_HOST=10.0.1.3,ENV=production" \
  --vpc-connector=my-connector \
  --allow-unauthenticated
```

```hcl
# Terraform — Cloud Run service
resource "google_cloud_run_v2_service" "api" {
  name     = "my-api"
  location = "us-central1"

  template {
    scaling {
      min_instance_count = 1
      max_instance_count = 100
    }

    containers {
      image = "us-central1-docker.pkg.dev/my-project/repo/my-api:v1.2.0"

      resources {
        limits = {
          cpu    = "2"
          memory = "1Gi"
        }
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "DB_HOST"
        value = "10.0.1.3"
      }
    }

    vpc_access {
      connector = google_vpc_access_connector.main.id
      egress    = "PRIVATE_RANGES_ONLY"
    }
  }
}
```

#### Cloud Functions (2nd Gen)

Event-driven serverless functions. 2nd gen is built on Cloud Run infrastructure,
supporting longer timeouts (up to 60 min), larger instances, and concurrency.

```typescript
// Cloud Function 2nd gen — HTTP trigger
import { HttpFunction } from "@google-cloud/functions-framework";

export const processOrder: HttpFunction = async (req, res) => {
  const order = req.body;
  // Process order logic
  const result = await createOrder(order);
  res.status(201).json(result);
};

// Cloud Function 2nd gen — Pub/Sub trigger
import { CloudEvent } from "@google-cloud/functions-framework";

interface PubSubData {
  message: { data: string; attributes: Record<string, string> };
}

export const processMessage = async (event: CloudEvent<PubSubData>) => {
  const data = JSON.parse(
    Buffer.from(event.data!.message.data, "base64").toString()
  );
  console.log("Processing:", data);
};
```

#### App Engine

Fully managed PaaS. Use Standard environment for auto-scaling web apps,
Flexible environment for custom runtimes. Generally prefer Cloud Run for new projects.

### Storage Services

#### Cloud Storage (Object Storage)

Multi-regional, dual-regional, regional, and nearline/coldline/archive classes.
Lifecycle policies automate transitions and deletions.

```hcl
# Terraform — Cloud Storage with lifecycle management
resource "google_storage_bucket" "data" {
  name          = "my-project-data-bucket"
  location      = "US"
  storage_class = "STANDARD"

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "ARCHIVE"
    }
  }

  lifecycle_rule {
    condition {
      age                = 730
      with_state         = "ANY"
    }
    action {
      type = "Delete"
    }
  }
}
```

**Storage class selection:**
- **Standard**: Frequently accessed data, serving website content
- **Nearline**: Accessed less than once per month (30-day minimum storage)
- **Coldline**: Accessed less than once per quarter (90-day minimum)
- **Archive**: Accessed less than once per year (365-day minimum), disaster recovery

#### Persistent Disks and Filestore

Persistent Disks attach to Compute Engine VMs. Choose between pd-standard (HDD),
pd-balanced (SSD), and pd-ssd (high-perf SSD). Filestore provides managed NFS.

### Database Services

#### Cloud SQL (Managed RDBMS)

Managed MySQL, PostgreSQL, and SQL Server. Handles replication, backups, patching.

```hcl
# Terraform — Cloud SQL PostgreSQL with HA
resource "google_sql_database_instance" "main" {
  name             = "main-db"
  database_version = "POSTGRES_16"
  region           = "us-central1"

  settings {
    tier              = "db-custom-4-16384"
    availability_type = "REGIONAL"

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 30
      }
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }

    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 4096
    }

    maintenance_window {
      day          = 7
      hour         = 3
      update_track = "stable"
    }
  }

  deletion_protection = true
}
```

#### Cloud Spanner

Globally distributed, horizontally scalable relational database with strong consistency.
Use for global transactions requiring 99.999% availability.

#### AlloyDB

PostgreSQL-compatible managed database optimized for demanding transactional and
analytical workloads. Up to 4x faster than standard PostgreSQL for transactions,
up to 100x faster for analytical queries via columnar engine.

#### Firestore (Document DB)

Serverless NoSQL document database. Native mode for mobile/web, Datastore mode
for server-side workloads. Scales automatically with strong consistency.

#### Bigtable

Wide-column NoSQL for low-latency, high-throughput workloads (IoT, time-series,
analytics). Petabyte-scale with single-digit millisecond latency.

#### Memorystore

Managed Redis and Memcached for caching and session storage.

### Networking Services

#### VPC and Subnets

```hcl
# Terraform — VPC with custom subnets
resource "google_compute_network" "main" {
  name                    = "main-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

resource "google_compute_subnetwork" "app" {
  name          = "app-subnet"
  ip_cidr_range = "10.0.1.0/24"
  region        = "us-central1"
  network       = google_compute_network.main.id

  secondary_ip_range {
    range_name    = "gke-pods"
    ip_cidr_range = "10.1.0.0/16"
  }

  secondary_ip_range {
    range_name    = "gke-services"
    ip_cidr_range = "10.2.0.0/20"
  }

  private_ip_google_access = true
}

# Cloud NAT for outbound internet access without public IPs
resource "google_compute_router" "main" {
  name    = "main-router"
  region  = "us-central1"
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "main" {
  name                               = "main-nat"
  router                             = google_compute_router.main.name
  region                             = "us-central1"
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}
```

#### Cloud Load Balancing

Global external Application Load Balancer (HTTP/S), regional internal, TCP/UDP proxy,
and network pass-through load balancers. Global LB uses Google's edge network.

```hcl
# Terraform — Global external Application Load Balancer for Cloud Run
resource "google_compute_global_address" "default" {
  name = "global-lb-ip"
}

resource "google_compute_region_network_endpoint_group" "run_neg" {
  name                  = "run-neg"
  region                = "us-central1"
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.api.name
  }
}

resource "google_compute_backend_service" "default" {
  name                  = "api-backend"
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_region_network_endpoint_group.run_neg.id
  }
}
```

#### Cloud CDN, Cloud DNS, Cloud Armor, Cloud NAT

- **Cloud CDN**: Edge caching integrated with Cloud Load Balancing
- **Cloud DNS**: Managed authoritative DNS with 100% SLA
- **Cloud Armor**: DDoS protection and WAF policies at the load balancer
- **Cloud NAT**: Outbound internet for private VMs without public IPs
- **Cloud Interconnect**: Dedicated or partner connections to on-premises

### Messaging Services

#### Pub/Sub

Fully managed, serverless messaging service for event-driven architectures.
At-least-once delivery with exactly-once processing support.

```typescript
// Publish messages to Pub/Sub
import { PubSub } from "@google-cloud/pubsub";

const pubsub = new PubSub();

async function publishOrder(order: Order): Promise<string> {
  const topic = pubsub.topic("orders");
  const messageId = await topic.publishMessage({
    data: Buffer.from(JSON.stringify(order)),
    attributes: {
      type: "order.created",
      version: "1.0",
    },
    orderingKey: order.customerId, // Enable ordered delivery
  });
  return messageId;
}

// Subscribe with exactly-once delivery
const subscription = pubsub.subscription("orders-processor", {
  enableExactlyOnceDelivery: true,
});

subscription.on("message", async (message) => {
  try {
    const order = JSON.parse(message.data.toString());
    await processOrder(order);
    message.ack();
  } catch (err) {
    message.nack();
  }
});
```

#### Eventarc

Route events from Google services, Pub/Sub, and third-party sources to Cloud Run,
GKE, and Workflows. Use for event-driven orchestration.

#### Cloud Tasks

Managed task queues for asynchronous execution with rate limiting, scheduling,
and retry logic. Use for work that must be processed reliably but not immediately.

### Identity and Access Management

#### IAM, Service Accounts, Workload Identity Federation

```bash
# Create service account with least privilege
gcloud iam service-accounts create cloud-run-sa \
  --display-name="Cloud Run Service Account"

# Grant specific roles (not primitive roles)
gcloud projects add-iam-policy-binding my-project \
  --member="serviceAccount:cloud-run-sa@my-project.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding my-project \
  --member="serviceAccount:cloud-run-sa@my-project.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
```

```hcl
# Terraform — Workload Identity Federation for GitHub Actions
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions Pool"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository_owner == 'my-org'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}
```

**Key IAM principles:**
- Never use primitive roles (Owner/Editor/Viewer) in production
- Prefer predefined roles over custom roles when possible
- Use Workload Identity Federation instead of service account keys
- Apply IAM conditions for time-bound or resource-specific access

---

## 10 Best Practices

1. **Use Autopilot for GKE unless you need node-level control.** Autopilot reduces
   operational overhead, enforces best practices, and optimizes cost per pod.
2. **Default to Cloud Run for stateless HTTP workloads.** It scales to zero, requires
   no cluster management, and integrates with Cloud Build for CI/CD.
3. **Enable Private Google Access on all subnets.** Allow VMs without external IPs
   to reach Google APIs and services through internal networking.
4. **Use Cloud Storage lifecycle policies on every bucket.** Transition to Nearline
   after 30 days, Coldline after 90, and Archive after 365 unless access patterns differ.
5. **Enable Query Insights on Cloud SQL.** Identify slow queries, missing indexes,
   and lock contention without external tooling.
6. **Use Workload Identity Federation instead of service account keys.** Eliminate
   long-lived credentials for CI/CD, external services, and cross-cloud access.
7. **Configure Cloud NAT for all private subnets.** Provide outbound internet access
   without assigning public IPs to individual instances.
8. **Set up Pub/Sub dead-letter topics for every subscription.** Capture messages
   that fail processing after max retry attempts for debugging and replay.
9. **Use regional resources for high availability.** Regional Cloud SQL, regional GKE
   clusters, and multi-zone instance groups survive zone outages.
10. **Label all resources consistently.** Apply environment, team, service, and cost-center
    labels for billing analysis, access control, and operational filtering.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Using primitive IAM roles (Owner/Editor) | Excessive permissions, compliance violations | Use predefined or custom roles with least privilege |
| Running GKE Standard without autoscaling | Over-provisioned nodes, wasted cost | Enable cluster autoscaler or migrate to Autopilot |
| Storing secrets in environment variables | Secrets in logs, container images, metadata | Use Secret Manager with IAM-based access |
| Single-zone deployments for production | Full outage on zone failure | Use regional resources (regional MIG, regional GKE) |
| Public IPs on all VMs | Expanded attack surface, unnecessary exposure | Use Cloud NAT + Private Google Access |
| Neglecting Cloud Storage lifecycle rules | Unbounded storage costs growth | Define lifecycle policies during bucket creation |
| Using default VPC for production | No subnet control, shared with all projects | Create custom VPC with planned CIDR ranges |
| Service account key files in repos/CI | Credential leakage, rotation burden | Use Workload Identity Federation |

---

## Enforcement Checklist

- [ ] All production workloads use custom VPC with private subnets
- [ ] Cloud NAT configured for all subnets requiring outbound access
- [ ] No primitive IAM roles assigned in production projects
- [ ] Workload Identity Federation configured for all external CI/CD systems
- [ ] Cloud SQL instances use private IP with regional HA enabled
- [ ] Cloud Storage buckets have lifecycle policies and uniform access
- [ ] Pub/Sub subscriptions have dead-letter topics configured
- [ ] All resources labeled with environment, team, service, and cost-center
- [ ] GKE clusters use Autopilot or Standard with autoscaling enabled
- [ ] Cloud Run services have min-instances=1 for latency-sensitive endpoints
- [ ] Query Insights enabled on all Cloud SQL instances
- [ ] VPC firewall rules reviewed and documented quarterly
