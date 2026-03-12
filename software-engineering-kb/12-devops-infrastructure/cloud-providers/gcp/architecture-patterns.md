# GCP: Architecture Patterns

| Attribute     | Value                                                                 |
|--------------|-----------------------------------------------------------------------|
| Domain       | DevOps > Cloud > GCP                                                  |
| Importance   | High                                                                  |
| Last Updated | 2026-03-10                                                            |
| Cross-ref    | [Core Services](core-services.md), [Provider Comparison](../provider-comparison.md) |

---

## Core Concepts

### Google Cloud Architecture Framework

The Google Cloud Architecture Framework organizes best practices across six pillars:

1. **Operational excellence** — Monitoring, incident response, automation
2. **Security, privacy, and compliance** — Defense in depth, least privilege
3. **Reliability** — High availability, disaster recovery, resilience
4. **Cost optimization** — Resource efficiency, pricing models
5. **Performance optimization** — Scaling, latency, throughput
6. **System design** — Service selection, architecture patterns

### Web Application on Cloud Run

The standard pattern for stateless web APIs and server-rendered applications.
Cloud Run handles scaling, TLS, and load balancing automatically.

```yaml
# cloudbuild.yaml — CI/CD pipeline for Cloud Run
steps:
  - name: "gcr.io/cloud-builders/docker"
    args:
      - "build"
      - "-t"
      - "us-central1-docker.pkg.dev/$PROJECT_ID/services/web-api:$COMMIT_SHA"
      - "."

  - name: "gcr.io/cloud-builders/docker"
    args:
      - "push"
      - "us-central1-docker.pkg.dev/$PROJECT_ID/services/web-api:$COMMIT_SHA"

  - name: "gcr.io/google.com/cloudsdktool/cloud-sdk"
    entrypoint: gcloud
    args:
      - "run"
      - "deploy"
      - "web-api"
      - "--image=us-central1-docker.pkg.dev/$PROJECT_ID/services/web-api:$COMMIT_SHA"
      - "--region=us-central1"
      - "--platform=managed"
      - "--min-instances=1"
      - "--max-instances=50"
      - "--cpu=2"
      - "--memory=1Gi"

images:
  - "us-central1-docker.pkg.dev/$PROJECT_ID/services/web-api:$COMMIT_SHA"
```

```hcl
# Terraform — Full Cloud Run web app with custom domain
resource "google_cloud_run_v2_service" "web" {
  name     = "web-app"
  location = "us-central1"

  template {
    scaling {
      min_instance_count = 1
      max_instance_count = 50
    }

    containers {
      image = "us-central1-docker.pkg.dev/my-project/services/web-app:latest"

      resources {
        limits   = { cpu = "2", memory = "1Gi" }
        cpu_idle = true  # Scale down CPU when not processing requests
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_url.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get { path = "/healthz" }
        initial_delay_seconds = 5
        period_seconds        = 3
        failure_threshold     = 3
      }

      liveness_probe {
        http_get { path = "/healthz" }
        period_seconds = 30
      }
    }

    service_account = google_service_account.run_sa.email
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }
}

# Custom domain mapping
resource "google_cloud_run_domain_mapping" "web" {
  location = "us-central1"
  name     = "app.example.com"

  metadata {
    namespace = "my-project"
  }

  spec {
    route_name = google_cloud_run_v2_service.web.name
  }
}
```

### Microservices on GKE Autopilot

GKE Autopilot manages node pools, scaling, and security hardening. Focus on
deploying workloads, not managing infrastructure.

```yaml
# Kubernetes deployment on GKE Autopilot
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
    spec:
      serviceAccountName: order-service-ksa
      containers:
        - name: order-service
          image: us-central1-docker.pkg.dev/my-project/services/order-service:v2.1.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 20
          env:
            - name: PUBSUB_TOPIC
              value: "orders"
            - name: DB_CONNECTION
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: connection-string
---
apiVersion: v1
kind: Service
metadata:
  name: order-service
  namespace: production
spec:
  selector:
    app: order-service
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP
---
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

```hcl
# Terraform — GKE Autopilot with Workload Identity
resource "google_container_cluster" "autopilot" {
  name     = "production"
  location = "us-central1"

  enable_autopilot = true

  release_channel {
    channel = "REGULAR"
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = "gke-pods"
    services_secondary_range_name = "gke-services"
  }

  network    = google_compute_network.main.id
  subnetwork = google_compute_subnetwork.app.id

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }
}

# Workload Identity binding
resource "google_service_account" "order_service" {
  account_id   = "order-service"
  display_name = "Order Service"
}

resource "google_service_account_iam_binding" "workload_identity" {
  service_account_id = google_service_account.order_service.name
  role               = "roles/iam.workloadIdentityUser"
  members = [
    "serviceAccount:my-project.svc.id.goog[production/order-service-ksa]"
  ]
}
```

### Serverless Event-Driven Pattern

Cloud Functions + Firestore + Pub/Sub for fully serverless architectures
with no infrastructure management.

```typescript
// Cloud Function triggered by Firestore document creation
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { PubSub } from "@google-cloud/pubsub";

const pubsub = new PubSub();

export const onOrderCreated = onDocumentCreated(
  "orders/{orderId}",
  async (event) => {
    const order = event.data?.data();
    if (!order) return;

    // Publish event for downstream processing
    await pubsub.topic("order-events").publishMessage({
      data: Buffer.from(JSON.stringify({
        type: "order.created",
        orderId: event.params.orderId,
        customerId: order.customerId,
        total: order.total,
        timestamp: new Date().toISOString(),
      })),
    });
  }
);
```

```typescript
// Cloud Run service triggered by Eventarc (Pub/Sub event)
import express from "express";

const app = express();
app.use(express.json());

app.post("/", async (req, res) => {
  const message = req.body.message;
  const data = JSON.parse(
    Buffer.from(message.data, "base64").toString()
  );

  switch (data.type) {
    case "order.created":
      await sendConfirmationEmail(data);
      await updateInventory(data);
      break;
    case "order.shipped":
      await sendShippingNotification(data);
      break;
  }

  res.status(200).send("OK");
});

app.listen(8080);
```

### Data Analytics Pipeline

BigQuery + Dataflow + Pub/Sub for real-time and batch analytics.

```python
# Apache Beam pipeline on Dataflow
import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions

class ParseEvent(beam.DoFn):
    def process(self, element):
        import json
        data = json.loads(element.decode("utf-8"))
        yield {
            "event_type": data["type"],
            "user_id": data["userId"],
            "timestamp": data["timestamp"],
            "properties": json.dumps(data.get("properties", {})),
        }

options = PipelineOptions([
    "--runner=DataflowRunner",
    "--project=my-project",
    "--region=us-central1",
    "--temp_location=gs://my-bucket/temp",
    "--streaming",
])

with beam.Pipeline(options=options) as p:
    (
        p
        | "ReadPubSub" >> beam.io.ReadFromPubSub(
            topic="projects/my-project/topics/events"
        )
        | "Parse" >> beam.ParDo(ParseEvent())
        | "Window" >> beam.WindowInto(beam.window.FixedWindows(60))
        | "WriteBQ" >> beam.io.WriteToBigQuery(
            table="my-project:analytics.events",
            schema="event_type:STRING,user_id:STRING,"
                   "timestamp:TIMESTAMP,properties:STRING",
            write_disposition=beam.io.BigQueryDisposition.WRITE_APPEND,
            create_disposition=beam.io.BigQueryDisposition.CREATE_IF_NEEDED,
        )
    )
```

### ML/AI Patterns with Vertex AI

```python
# Vertex AI — Deploy a model endpoint
from google.cloud import aiplatform

aiplatform.init(project="my-project", location="us-central1")

# Upload model to Model Registry
model = aiplatform.Model.upload(
    display_name="fraud-detector-v2",
    artifact_uri="gs://my-bucket/models/fraud-detector/v2",
    serving_container_image_uri=(
        "us-docker.pkg.dev/vertex-ai/prediction/sklearn-cpu.1-3:latest"
    ),
)

# Deploy to endpoint with traffic splitting
endpoint = aiplatform.Endpoint.create(
    display_name="fraud-detection-endpoint"
)
endpoint.deploy(
    model=model,
    deployed_model_display_name="fraud-v2",
    machine_type="n1-standard-4",
    min_replica_count=1,
    max_replica_count=5,
    traffic_percentage=100,
)
```

```typescript
// Call Gemini API via Vertex AI
import { VertexAI } from "@google-cloud/vertexai";

const vertexAI = new VertexAI({
  project: "my-project",
  location: "us-central1",
});

const model = vertexAI.getGenerativeModel({ model: "gemini-1.5-pro" });

async function analyzeDocument(text: string): Promise<string> {
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{
          text: `Analyze this document and extract key entities:\n\n${text}`,
        }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  });
  return result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
```

### Multi-Project Organization

```
org: my-company.com
├── folder: Production
│   ├── project: prod-networking (Shared VPC host)
│   ├── project: prod-app-team-a
│   ├── project: prod-app-team-b
│   └── project: prod-data-platform
├── folder: Staging
│   ├── project: staging-networking
│   └── project: staging-apps
├── folder: Development
│   └── project: dev-sandbox
└── folder: Shared Services
    ├── project: shared-cicd
    ├── project: shared-monitoring
    └── project: shared-security
```

```hcl
# Terraform — Shared VPC configuration
resource "google_compute_shared_vpc_host_project" "host" {
  project = "prod-networking"
}

resource "google_compute_shared_vpc_service_project" "team_a" {
  host_project    = google_compute_shared_vpc_host_project.host.project
  service_project = "prod-app-team-a"
}

resource "google_compute_shared_vpc_service_project" "team_b" {
  host_project    = google_compute_shared_vpc_host_project.host.project
  service_project = "prod-app-team-b"
}
```

### Disaster Recovery Patterns

| Pattern | RPO | RTO | Cost | Implementation |
|---------|-----|-----|------|---------------|
| Backup & Restore | Hours | Hours | Low | Cloud Storage backups, restore on demand |
| Pilot Light | Minutes | 10-30 min | Medium | Minimal infra in DR region, scale on failover |
| Warm Standby | Seconds-Min | Minutes | High | Reduced capacity in DR, scale up on failover |
| Multi-Region Active-Active | Near-zero | Near-zero | Highest | Full capacity in multiple regions, global LB |

```hcl
# Terraform — Multi-region Cloud Run with global load balancer
resource "google_cloud_run_v2_service" "api_us" {
  name     = "api"
  location = "us-central1"
  template {
    containers {
      image = var.api_image
    }
  }
}

resource "google_cloud_run_v2_service" "api_eu" {
  name     = "api"
  location = "europe-west1"
  template {
    containers {
      image = var.api_image
    }
  }
}

# Network Endpoint Groups for both regions
resource "google_compute_region_network_endpoint_group" "us_neg" {
  name                  = "api-neg-us"
  region                = "us-central1"
  network_endpoint_type = "SERVERLESS"
  cloud_run { service = google_cloud_run_v2_service.api_us.name }
}

resource "google_compute_region_network_endpoint_group" "eu_neg" {
  name                  = "api-neg-eu"
  region                = "europe-west1"
  network_endpoint_type = "SERVERLESS"
  cloud_run { service = google_cloud_run_v2_service.api_eu.name }
}

# Global backend service with both NEGs
resource "google_compute_backend_service" "api" {
  name                  = "api-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"

  backend {
    group = google_compute_region_network_endpoint_group.us_neg.id
  }

  backend {
    group = google_compute_region_network_endpoint_group.eu_neg.id
  }
}
```

### Hybrid and Multi-Cloud with GKE Enterprise

GKE Enterprise (formerly Anthos) extends GKE to on-premises, AWS, Azure,
and edge locations with a unified control plane.

**Key components:**
- **GKE on-prem**: Run GKE on bare metal or VMware
- **GKE on AWS/Azure**: Managed Kubernetes on other clouds
- **Anthos Config Management**: GitOps-based policy enforcement across clusters
- **Anthos Service Mesh**: Managed Istio service mesh across environments
- **Distributed Cloud**: Google-managed hardware in your data center or edge

```yaml
# Anthos Config Management — GitOps policy sync
apiVersion: configmanagement.gke.io/v1
kind: ConfigManagement
metadata:
  name: config-management
spec:
  sourceFormat: unstructured
  git:
    syncRepo: https://github.com/my-org/platform-config
    syncBranch: main
    policyDir: policies
    secretType: token
  policyController:
    enabled: true
    templateLibraryInstalled: true
    referentialRulesEnabled: true
```

---

## 10 Best Practices

1. **Use Cloud Run as the default compute for stateless services.** Reserve GKE for
   workloads requiring persistent connections, GPUs, or complex scheduling.
2. **Adopt Autopilot for all GKE clusters unless proven otherwise.** Document the
   specific requirement that necessitates Standard mode.
3. **Implement Shared VPC for multi-project networking.** Centralize network management
   in a dedicated host project with service projects for each team.
4. **Design for multi-region from day one.** Use global load balancing and regional
   resources even if initially deploying to a single region.
5. **Store all infrastructure as code in version control.** Use Terraform or Pulumi
   with remote state in Cloud Storage and state locking.
6. **Use Eventarc and Pub/Sub for service decoupling.** Avoid synchronous service-to-service
   calls; use events for workflows that tolerate seconds of latency.
7. **Implement GitOps for GKE deployments.** Use Config Sync or Argo CD to reconcile
   cluster state from a Git repository.
8. **Use Cloud Build or GitHub Actions with Workload Identity.** Eliminate service account
   keys from CI/CD pipelines entirely.
9. **Apply the principle of least-privilege projects.** Separate production, staging, and
   shared services into distinct projects with isolated IAM policies.
10. **Test disaster recovery procedures quarterly.** Run failover drills and document
    actual RTO/RPO versus targets.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Monolithic GKE cluster for all environments | Blast radius, noisy neighbors, complex RBAC | Separate clusters per environment with Shared VPC |
| Synchronous chain of microservice calls | Cascading failures, latency multiplication | Use Pub/Sub for async, circuit breakers for sync |
| Single-project for all resources | IAM sprawl, billing confusion, blast radius | Organize into folders with purpose-specific projects |
| Hardcoded region in application code | Cannot failover, vendor lock-in within GCP | Use environment variables, discover region at runtime |
| No health checks on Cloud Run services | Traffic routed to unhealthy instances | Configure startup, liveness, and readiness probes |
| Manual deployments to production | Inconsistency, audit gaps, human error | Implement CI/CD with Cloud Build or GitHub Actions |
| Flat networking without segmentation | Lateral movement risk, compliance violations | Use Shared VPC with per-team subnets and firewall rules |
| Ignoring Vertex AI for custom ML serving | Reinventing model serving infrastructure | Use Vertex AI endpoints with autoscaling and monitoring |

---

## Enforcement Checklist

- [ ] Architecture decision records (ADRs) exist for compute service selection
- [ ] Cloud Run services have health probes and min-instances configured
- [ ] GKE clusters run Autopilot unless Standard mode is justified in ADR
- [ ] Multi-project structure follows org folder hierarchy
- [ ] Shared VPC configured for cross-project networking
- [ ] All deployments automated via CI/CD pipeline (no manual deploys)
- [ ] Disaster recovery plan documented with target RPO/RTO per service
- [ ] DR failover tested quarterly with results documented
- [ ] Event-driven patterns use Pub/Sub with dead-letter topics
- [ ] Vertex AI endpoints have autoscaling configured for ML workloads
- [ ] GitOps reconciliation configured for GKE cluster state
- [ ] Infrastructure code reviewed and merged via pull request process
