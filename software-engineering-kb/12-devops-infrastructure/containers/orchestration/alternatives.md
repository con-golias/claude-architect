# Container Orchestration Alternatives

| Property       | Value                                                                |
|----------------|----------------------------------------------------------------------|
| Domain         | DevOps > Containers > Orchestration                                  |
| Importance     | Medium                                                               |
| Last Updated   | 2026-03                                                              |
| Cross-ref      | [Kubernetes Fundamentals](kubernetes/fundamentals.md), [Docker Fundamentals](../docker/fundamentals.md), [Container Orchestration Scaling](../../../10-scalability/infrastructure/container-orchestration.md) |

---

## 1. Docker Compose (Development and Small Deployments)

Docker Compose manages multi-container applications on a single host using a declarative YAML file.

### When to Use

- Local development environments
- CI/CD pipeline testing
- Small deployments (1-3 nodes, fewer than 20 containers)
- Prototyping before migrating to Kubernetes

### Architecture

```text
┌────────────────────────────────────────┐
│            Single Docker Host           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ web  │ │ api  │ │  db  │ │redis │  │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘  │
│     └────────┴────────┴────────┘       │
│              Bridge Network             │
└────────────────────────────────────────┘
```

```yaml
# compose.yaml
services:
  api:
    build: .
    ports: ["3000:3000"]
    depends_on:
      db: { condition: service_healthy }
    deploy:
      replicas: 2
      resources:
        limits: { memory: 512M, cpus: "1.0" }

  db:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
      interval: 10s

  redis:
    image: redis:7-alpine
    profiles: [cache]

volumes:
  pgdata:
```

### Limitations

- **Single-host only** — no cross-node scheduling or failover
- **No auto-healing** — crashed containers require manual restart unless using `restart: always`
- **No rolling updates** — updates cause downtime (stop old, start new)
- **No service discovery** — limited to Docker DNS on bridge networks

---

## 2. Docker Swarm

Docker Swarm is Docker's built-in clustering and orchestration. It extends Docker Compose syntax with multi-node capabilities.

### Architecture

```text
┌────────────────────────────────────────────────┐
│                 Swarm Cluster                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Manager  │  │ Manager  │  │ Manager  │      │
│  │  (Raft)  │──│  (Raft)  │──│  (Raft)  │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       │              │              │            │
│  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐      │
│  │ Worker 1 │  │ Worker 2 │  │ Worker 3 │      │
│  │ Tasks    │  │ Tasks    │  │ Tasks    │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└────────────────────────────────────────────────┘
```

### When Swarm Still Makes Sense

- **Small teams** with existing Docker expertise (no Kubernetes knowledge required)
- **Simple architectures** — fewer than 50 services, 5-10 nodes
- **Budget constraints** — no managed K8s costs
- **Docker-native environments** — already invested in Docker Compose files

```bash
# Initialize Swarm
docker swarm init --advertise-addr 10.0.0.1

# Deploy stack from compose file
docker stack deploy -c compose.yaml myapp

# Scale a service
docker service scale myapp_api=5

# Rolling update
docker service update --image myapp:2.0.0 myapp_api
```

### Limitations

- **Ecosystem decline** — minimal community investment since 2020
- **No auto-scaling** — must scale manually or script it
- **Limited RBAC** — no namespace-level isolation
- **No CRDs or extensibility** — cannot extend with custom controllers
- **Sparse monitoring** — limited native observability

---

## 3. HashiCorp Nomad

Nomad is a lightweight, multi-runtime workload orchestrator. Single binary, no external dependencies.

### Architecture

```text
┌──────────────────────────────────────────┐
│              Nomad Cluster                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │ Server  │──│ Server  │──│ Server  │  │
│  │ (Raft)  │  │ (Raft)  │  │ (Raft)  │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  │
│  ┌────▼────┐  ┌────▼────┐  ┌────▼────┐  │
│  │ Client  │  │ Client  │  │ Client  │  │
│  │ Docker  │  │  Exec   │  │  Java   │  │
│  │ Podman  │  │  Raw    │  │  QEMU   │  │
│  └─────────┘  └─────────┘  └─────────┘  │
└──────────────────────────────────────────┘
    ┌──────┐   ┌──────┐   ┌──────┐
    │Consul│   │Vault │   │Nomad │  ← HashiCorp Stack
    └──────┘   └──────┘   └──────┘
```

### Job Specification (HCL)

```hcl
# api.nomad.hcl
job "api" {
  datacenters = ["dc1"]
  type        = "service"

  group "web" {
    count = 3

    network {
      port "http" { to = 3000 }
    }

    service {
      name = "api"
      port = "http"
      provider = "consul"

      check {
        type     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "server" {
      driver = "docker"

      config {
        image = "myapp:1.0.0"
        ports = ["http"]
      }

      resources {
        cpu    = 500   # MHz
        memory = 256   # MB
      }

      vault {
        policies = ["api-policy"]
      }

      template {
        data = <<EOF
DATABASE_URL={{ with secret "database/creds/api" }}{{ .Data.connection_url }}{{ end }}
EOF
        destination = "secrets/env"
        env         = true
      }
    }
  }

  update {
    max_parallel     = 1
    health_check     = "checks"
    min_healthy_time = "10s"
    healthy_deadline = "5m"
    canary           = 1
    auto_revert      = true
  }
}
```

### Nomad vs Kubernetes

| Aspect              | Nomad                               | Kubernetes                         |
|---------------------|-------------------------------------|------------------------------------|
| Complexity          | Single binary, 15 min setup         | Many components, steep learning    |
| Runtime support     | Docker, exec, Java, QEMU, Podman   | Containers only (OCI)              |
| Service discovery   | Consul integration                  | Built-in (CoreDNS, Services)       |
| Secrets             | Vault integration                   | Built-in Secrets + external        |
| Ecosystem           | Smaller, HashiCorp-focused          | Massive, CNCF landscape            |
| Auto-scaling        | Manual or external autoscaler       | HPA, VPA, KEDA, Cluster Autoscaler |
| Multi-region        | Built-in federation                 | Requires multi-cluster tooling     |
| Best for            | Mixed workloads, small-medium teams | Large teams, complex microservices |

---

## 4. Amazon ECS

Elastic Container Service is AWS's managed container orchestrator with deep AWS integration.

### Architecture

```text
┌─────────────────────────────────────────────┐
│                  Amazon ECS                  │
│  ┌─────────────────────────────────────┐     │
│  │           ECS Cluster                │     │
│  │  ┌──────────┐  ┌──────────┐         │     │
│  │  │ Service  │  │ Service  │         │     │
│  │  │ (API)    │  │ (Worker) │         │     │
│  │  └──┬──┬────┘  └──┬──┬───┘         │     │
│  │     │  │          │  │              │     │
│  │  ┌──▼──▼──┐   ┌──▼──▼──┐           │     │
│  │  │ Tasks  │   │ Tasks  │           │     │
│  └──┴────────┴───┴────────┴───────────┘     │
│                                              │
│  Launch Type: Fargate (serverless)           │
│               EC2 (self-managed instances)   │
└─────────────────────────────────────────────┘
```

### Task Definition

```json
{
  "family": "api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/api:1.0.0",
      "portMappings": [
        { "containerPort": 3000, "protocol": "tcp" }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "api"
        }
      },
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123:secret:db-url"
        }
      ]
    }
  ]
}
```

### Fargate vs EC2 Launch Types

| Aspect          | Fargate                          | EC2                                |
|-----------------|----------------------------------|------------------------------------|
| Management      | Fully serverless                 | Self-managed instances             |
| Cost model      | Per vCPU-second + memory-second  | EC2 instance pricing               |
| GPU support     | Limited                          | Full GPU instance types            |
| Startup time    | 30-60 seconds                    | Depends on instance launch         |
| Best for        | Variable workloads, simplicity   | Steady workloads, cost optimization|

### ECS Anywhere

Run ECS tasks on on-premises infrastructure:

```bash
# Register external instance
aws ecs register-container-instance \
  --cluster my-cluster \
  --instance-identity-document "$(curl -s http://169.254.169.254/latest/dynamic/instance-identity/document)"
```

---

## 5. Azure Container Apps (ACA)

Serverless container platform built on Kubernetes and Dapr, abstracting away cluster management.

### Key Features

- **Scale to zero** — no cost when idle
- **KEDA-based autoscaling** — scale on HTTP, queue depth, custom metrics
- **Built-in Dapr** — service invocation, pub/sub, state management
- **Revision management** — traffic splitting for blue/green and canary
- **Serverless GPU** — on-demand GPU for AI workloads (GA 2025)

```bash
# Deploy from container image
az containerapp create \
  --name api \
  --resource-group myapp-rg \
  --environment myapp-env \
  --image myregistry.azurecr.io/api:1.0.0 \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 10 \
  --cpu 0.5 --memory 1.0Gi
```

```yaml
# Container App YAML
properties:
  configuration:
    ingress:
      external: true
      targetPort: 3000
      traffic:
        - revisionName: api--v1
          weight: 80
        - revisionName: api--v2
          weight: 20        # Canary: 20% to new version
    dapr:
      enabled: true
      appId: api
      appPort: 3000
  template:
    scale:
      minReplicas: 1
      maxReplicas: 50
      rules:
        - name: http-scaling
          http:
            metadata:
              concurrentRequests: "100"
        - name: queue-scaling
          azureQueue:
            queueName: orders
            queueLength: 10
```

---

## 6. Google Cloud Run

Fully managed serverless container platform, built on Knative.

### Key Features

- **Sub-second cold start** — fastest deployment of all platforms
- **Request-based billing** — pay only when handling requests
- **Scale to zero** — automatic, no minimum instances (or set always-on)
- **Source-to-URL** — deploy directly from source code
- **Multi-region** — deploy globally with Cloud Load Balancing

```bash
# Deploy from source (auto-builds with Cloud Build)
gcloud run deploy api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated

# Deploy from container image
gcloud run deploy api \
  --image gcr.io/myproject/api:1.0.0 \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 100 \
  --concurrency 80 \
  --set-env-vars "NODE_ENV=production"
```

### Traffic Splitting

```bash
# Deploy new revision without traffic
gcloud run deploy api --image api:2.0.0 --no-traffic

# Route 10% of traffic to new revision (canary)
gcloud run services update-traffic api \
  --to-revisions api-00002-xyz=10
```

### Limitations

- **Single container per service** (no sidecar support until Cloud Run Jobs v2)
- **Maximum 60-minute request timeout**
- **No persistent storage** — stateless by design
- **Cold start latency** — 200ms-2s for first request after scale-to-zero

---

## 7. Podman and Rootless Containers

Podman is a daemonless container engine that runs as unprivileged user by default.

```bash
# Podman CLI is Docker-compatible
podman build -t myapp:1.0.0 .
podman run -d -p 3000:3000 myapp:1.0.0

# Generate Kubernetes YAML from running container
podman generate kube myapp > myapp-pod.yaml

# Play Kubernetes YAML with Podman
podman play kube myapp-pod.yaml

# Compose support
podman compose up -d
```

### Podman vs Docker

| Aspect          | Podman                           | Docker                            |
|-----------------|----------------------------------|-----------------------------------|
| Daemon          | Daemonless                       | dockerd daemon required           |
| Root            | Rootless by default              | Root daemon (rootless optional)   |
| OCI compliance  | Full                             | Full                              |
| Compose         | Via `podman-compose` or plugin   | Native                            |
| Pods            | Native pod support (like K8s)    | No pod concept                    |
| Systemd         | Generate systemd units           | Requires separate config          |

---

## 8. Decision Matrix

### When NOT to Use Kubernetes

- **Team size < 10 engineers** — operational overhead exceeds benefit
- **Fewer than 5 services** — Compose or ECS is simpler
- **Tight budget** — managed K8s costs $70-200+/month before workloads
- **No dedicated platform team** — K8s requires ongoing expertise
- **Simple deployment model** — single-region, low traffic, few services

### Orchestration Decision Matrix

| Criteria                    | Compose | Swarm  | ECS     | Cloud Run | ACA     | Nomad   | K8s     |
|-----------------------------|---------|--------|---------|-----------|---------|---------|---------|
| Setup complexity            | Trivial | Low    | Medium  | Low       | Low     | Low     | High    |
| Multi-node                  | No      | Yes    | Yes     | Yes       | Yes     | Yes     | Yes     |
| Auto-scaling                | No      | No     | Yes     | Yes       | Yes     | Partial | Yes     |
| Scale to zero               | No      | No     | No      | Yes       | Yes     | No      | KEDA    |
| Service mesh                | No      | No     | App Mesh| N/A       | Dapr    | Consul  | Istio+  |
| Multi-cloud                 | N/A     | Yes    | AWS     | GCP       | Azure   | Yes     | Yes     |
| GPU workloads               | Yes     | Yes    | Yes     | Yes       | Yes     | Yes     | Yes     |
| Non-container workloads     | No      | No     | No      | No        | No      | Yes     | No      |
| Community/ecosystem         | Large   | Small  | AWS     | GCP       | Azure   | Medium  | Massive |
| Cost (small, 3-5 services)  | Free    | Free   | $$      | $         | $       | Free    | $$$     |
| Best team size              | 1-5     | 2-10   | 5-50    | 1-20      | 1-20    | 5-30    | 10+     |

### Quick Decision Guide

```text
Need serverless + scale to zero?
  └─ GCP → Cloud Run
  └─ Azure → Container Apps
  └─ AWS → ECS Fargate

Need multi-runtime (containers + VMs + batch)?
  └─ Nomad

Need maximum ecosystem + extensibility?
  └─ Kubernetes

Simple app, small team, single host?
  └─ Docker Compose

AWS-native, no K8s expertise?
  └─ ECS
```

---

## Best Practices

1. **Match orchestrator to team size** — do not adopt Kubernetes for a 3-person team running 2 services.
2. **Start with managed services** — use ECS Fargate, Cloud Run, or ACA before self-hosting K8s or Nomad.
3. **Use Docker Compose as the development baseline** — all orchestrators can consume OCI images built locally with Compose.
4. **Evaluate total cost of ownership** — include engineer time, learning curve, and operational burden, not just infrastructure cost.
5. **Plan for migration paths** — containerize properly (12-factor) so workloads move between orchestrators.
6. **Use health checks everywhere** — all orchestrators rely on health checks for scheduling and restarts.
7. **Implement infrastructure as code** — define orchestrator configuration in version-controlled files (Terraform, Pulumi, CDK).
8. **Centralize logging and monitoring** — choose an orchestrator with observability support or integrate third-party tooling early.
9. **Enable auto-scaling where available** — configure HPA, KEDA, or platform-native scaling rules from day one.
10. **Adopt GitOps for deployments** — use ArgoCD, Flux, or platform-native CD to make deployments auditable and repeatable.

---

## Anti-Patterns

| Anti-Pattern                          | Problem                                        | Fix                                          |
|---------------------------------------|------------------------------------------------|----------------------------------------------|
| Kubernetes for 2-3 microservices      | Massive overhead for minimal benefit           | Use Compose, ECS, or Cloud Run               |
| Docker Swarm for new greenfield projects | Ecosystem is stagnant, limited future        | Choose ECS, ACA, or Kubernetes               |
| No health checks in task definitions  | Orchestrator cannot detect failures            | Add HTTP or TCP health checks to every service |
| Vendor lock-in without abstraction    | Cannot migrate between cloud providers         | Containerize with 12-factor; abstract infra with IaC |
| Running orchestrator without monitoring | Blind to failures, resource waste             | Deploy Prometheus/Grafana or cloud-native monitoring |
| Manual scaling in production          | Cannot respond to traffic spikes               | Configure auto-scaling rules                 |
| Skipping Compose for local development | Developer environments diverge from production | Use Compose locally; deploy to orchestrator  |
| Choosing orchestrator by hype         | Overengineered for actual requirements         | Evaluate against team size, services, budget |

---

## Enforcement Checklist

- [ ] Orchestrator choice documented with rationale against team size, service count, and budget
- [ ] Health checks configured for every service in every orchestrator
- [ ] Auto-scaling rules defined with min/max boundaries
- [ ] All configuration stored in version control (IaC)
- [ ] Local development uses Docker Compose regardless of production orchestrator
- [ ] Logging and monitoring integrated before production launch
- [ ] Secret management configured (Vault, AWS Secrets Manager, or platform-native)
- [ ] Disaster recovery and failover tested for the chosen orchestrator
- [ ] Migration path documented if switching orchestrators in the future
- [ ] Cost monitoring enabled — see [Container Orchestration Scaling](../../../10-scalability/infrastructure/container-orchestration.md)
