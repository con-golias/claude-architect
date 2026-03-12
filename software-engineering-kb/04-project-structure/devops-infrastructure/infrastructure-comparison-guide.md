# Infrastructure & DevOps Comparison Guide — Complete Specification

> **AI Plugin Directive:** When deciding on infrastructure tooling, deployment strategies, or DevOps patterns, ALWAYS consult this guide first. Use the decision trees and comparison matrices to select the right tools for the project's scale, team, and requirements.

**Core Rule: Choose infrastructure tools based on team size, scale, and existing ecosystem. NEVER adopt complex tooling for simple projects. Start simple, add complexity only when pain points emerge.**

---

## 1. Decision Tree: Container Runtime

```
Do you need containers?
├── No → Deploy directly
│   ├── Simple app, < 3 services → PaaS (Railway, Fly.io, Render, Heroku)
│   ├── Serverless workload → AWS Lambda / Cloud Functions / Cloudflare Workers
│   ├── Static site → CDN (Vercel, Netlify, Cloudflare Pages)
│   └── Legacy/specific OS needs → VMs (EC2, GCE, Azure VMs)
│
└── Yes → Which container runtime?
    ├── Standard enterprise/team → Docker (industry standard)
    ├── Rootless/daemonless required? → Podman
    ├── Security-sensitive (no root daemon)? → Podman
    ├── Red Hat / RHEL ecosystem? → Podman (default in RHEL 8+)
    └── Using Kubernetes? → containerd (K8s default runtime)

Docker vs Podman Decision:
├── Existing Docker workflows + team familiarity? → Docker
├── Need docker-compose compatibility? → Docker (Podman has podman-compose but less mature)
├── Enterprise Linux (RHEL/CentOS)? → Podman (pre-installed)
├── Need rootless containers (no daemon)? → Podman
├── CI/CD pipelines (GitHub Actions, etc.)? → Docker (better ecosystem support)
└── Both work? → Docker (larger ecosystem, more documentation)
```

### Docker vs Podman Comparison

```
┌─────────────────────────┬──────────────────────┬──────────────────────┐
│ Feature                 │ Docker               │ Podman               │
├─────────────────────────┼──────────────────────┼──────────────────────┤
│ Architecture            │ Client-Server(daemon)│ Daemonless (fork-exec│
│ Root requirement        │ Root daemon (default)│ Rootless by default  │
│ CLI compatibility       │ docker ...           │ podman ... (alias)   │
│ Compose                 │ docker compose       │ podman-compose       │
│                         │ (built-in, mature)   │ (compatible, growing)│
│ Swarm mode              │ Built-in             │ N/A                  │
│ Desktop app             │ Docker Desktop       │ Podman Desktop       │
│ Build tool              │ BuildKit (default)   │ Buildah (integrated) │
│ Image format            │ OCI + Docker         │ OCI standard         │
│ Systemd integration     │ Via service files     │ podman generate      │
│                         │                      │ systemd (native)     │
│ Kubernetes YAML gen     │ No                   │ podman generate kube │
│ Pod concept             │ No (containers only) │ Yes (like K8s pods)  │
│ Enterprise license      │ Docker Business ($$) │ Free (Red Hat)       │
│ CI/CD ecosystem         │ Excellent (standard) │ Good (growing)       │
│ Registry support        │ Docker Hub (default) │ Multiple registries  │
│ Windows/Mac support     │ Docker Desktop       │ Podman Desktop/WSL2  │
│ Learning resources      │ Massive              │ Growing              │
│ Ecosystem maturity      │ Mature (2013+)       │ Maturing (2018+)     │
└─────────────────────────┴──────────────────────┴──────────────────────┘

RECOMMENDATION:
  Default choice          → Docker (ecosystem, documentation, CI/CD support)
  Enterprise Linux (RHEL) → Podman (pre-installed, rootless, Red Hat support)
  Security-first          → Podman (no root daemon, rootless default)
  Kubernetes destination  → Either (both produce OCI images, K8s uses containerd)
```

---

## 2. Decision Tree: Container Orchestration

```
How many services do you have?
│
├── 1 service → No orchestrator needed
│   ├── PaaS: Railway, Fly.io, Render, Cloud Run
│   └── Docker run on a VM (simple but manual)
│
├── 2-5 services → Docker Compose (dev) + managed container service (prod)
│   ├── AWS → ECS Fargate (serverless containers)
│   ├── GCP → Cloud Run (serverless containers)
│   ├── Azure → Azure Container Apps
│   └── Any cloud → Fly.io, Railway
│
├── 5-20 services → Evaluate K8s vs managed container service
│   ├── Simple networking needs? → ECS/Cloud Run (simpler ops)
│   ├── Complex networking, service mesh? → Kubernetes (managed: EKS/GKE/AKS)
│   ├── HashiCorp ecosystem? → Nomad + Consul
│   └── Mixed workloads (containers + VMs + batch)? → Nomad
│
└── 20+ services → Kubernetes (managed)
    ├── AWS → EKS (+ Karpenter for scaling)
    ├── GCP → GKE (Autopilot for less ops)
    ├── Azure → AKS
    └── Multi-cloud → GKE Enterprise or self-managed (avoid if possible)
```

### Orchestration Comparison

```
┌─────────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Dimension           │ Docker Comp. │ K8s (managed)│ Docker Swarm │ Nomad        │
├─────────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Complexity          │ Low          │ High         │ Low-Medium   │ Medium       │
│ Learning curve      │ Hours        │ Months       │ Days         │ Weeks        │
│ Auto-scaling        │ Manual       │ HPA/VPA/KEDA │ Limited      │ Built-in     │
│ Service discovery   │ DNS (basic)  │ CoreDNS+svc  │ DNS (basic)  │ Consul       │
│ Load balancing      │ None (manual)│ Ingress/svc  │ Built-in     │ Consul/Fabio │
│ Service mesh        │ No           │ Istio/Linkerd│ No           │ Consul Connect│
│ Rolling updates     │ No           │ Built-in     │ Built-in     │ Built-in     │
│ Self-healing        │ restart:always│ Built-in    │ Built-in     │ Built-in     │
│ Secrets management  │ Docker secrets│ K8s Secrets │ Docker secrets│ Vault        │
│ Storage orchestration│ Volumes     │ CSI/PV/PVC  │ Volumes      │ CSI          │
│ Multi-node          │ No (single)  │ Yes          │ Yes          │ Yes          │
│ GPU support         │ Via runtime  │ Device plugin│ Limited      │ Device plugin│
│ Cost                │ Free         │ Cluster + node│ Free        │ Free (OSS)   │
│ Team size           │ 1-5          │ 5+           │ 2-10         │ 3-15         │
│ Production ready    │ Small scale  │ Any scale    │ Declining    │ Medium scale │
│ Community           │ Huge         │ Massive      │ Shrinking    │ Medium       │
│ Best for            │ Dev/small    │ Enterprise   │ Simple prod  │ Mixed workload│
│ Avoid for           │ Multi-node   │ < 5 services │ New projects │ K8s ecosystem│
└─────────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘

RULE: Docker Swarm is DECLINING — avoid for new projects
RULE: ALWAYS use managed Kubernetes (EKS/GKE/AKS) — never self-managed unless air-gapped
RULE: Nomad is excellent but smaller ecosystem — choose only if already using HashiCorp stack
```

---

## 3. Decision Tree: Infrastructure as Code (IaC)

```
What cloud provider(s)?
│
├── Multi-cloud (AWS + GCP + Azure)
│   └── Terraform / OpenTofu (ONLY mature multi-cloud option)
│
├── AWS only
│   ├── Team is TypeScript? → AWS CDK (TypeScript constructs)
│   ├── Team prefers HCL? → Terraform
│   ├── Team prefers programming language? → Pulumi (TypeScript/Python/Go/C#)
│   ├── Already using CloudFormation? → CloudFormation (or migrate to CDK)
│   └── New project? → AWS CDK (best AWS-native DX)
│
├── GCP only
│   ├── Terraform (best GCP provider support)
│   └── Pulumi (good GCP support)
│
├── Azure only
│   ├── .NET team? → Pulumi (C#) or Bicep (Azure-native)
│   ├── Terraform (excellent Azure provider)
│   └── Bicep (Azure's own IaC, simpler than ARM templates)
│
└── Kubernetes-only resources
    ├── Want templating? → Helm (charts with values.yaml)
    ├── Want overlay-based patches? → Kustomize (base + overlays)
    ├── Want both? → Helm + Kustomize (helm template | kubectl apply)
    └── Want full IaC for K8s? → Terraform kubernetes provider or Pulumi
```

### IaC Tool Comparison

```
┌────────────────────┬────────────────┬────────────────┬────────────────┬────────────────┬────────────────┐
│ Feature            │ Terraform      │ OpenTofu       │ Pulumi         │ AWS CDK        │ CloudFormation │
├────────────────────┼────────────────┼────────────────┼────────────────┼────────────────┼────────────────┤
│ Language           │ HCL            │ HCL            │ TS/Py/Go/C#   │ TS/Py/Java/C#  │ YAML/JSON      │
│ Multi-cloud        │ YES (best)     │ YES (best)     │ YES            │ AWS only       │ AWS only       │
│ State management   │ Remote backend │ Remote backend │ Pulumi Cloud   │ CloudFormation │ CloudFormation │
│                    │ (S3, TFC, etc.)│ (S3, etc.)     │ or self-hosted │ stack          │ stack          │
│ Drift detection    │ terraform plan │ tofu plan      │ pulumi preview │ cdk diff       │ Drift detection│
│ Import existing    │ terraform import│tofu import    │ pulumi import  │ cdk import     │ Import resource│
│ Module ecosystem   │ LARGEST        │ TF compatible  │ Growing        │ Constructs Hub │ Limited        │
│ Provider ecosystem │ 3000+ providers│ TF compatible  │ 100+ providers │ AWS only       │ AWS only       │
│ Testing            │ Terratest      │ Terratest      │ Unit tests(nat)│ CDK assertions │ TaskCat        │
│ Secrets            │ Vault, SOPS    │ Vault, SOPS    │ Built-in       │ SSM/Secrets Mgr│ SSM/Secrets Mgr│
│ Refactoring        │ moved blocks   │ moved blocks   │ Aliases        │ Logical IDs    │ Manual         │
│ Learning curve     │ Medium (HCL)   │ Same as TF     │ Low (familiar  │ Low (if TS)    │ Medium (YAML)  │
│                    │                │                │ language)      │                │                │
│ License            │ BSL (HashiCorp)│ MPL 2.0 (OSS)  │ Apache 2.0     │ Apache 2.0     │ Proprietary    │
│ Enterprise support │ TF Cloud/Ent   │ Community      │ Pulumi Cloud   │ AWS Support    │ AWS Support    │
│ Team size fit      │ Any            │ Any            │ Any            │ AWS-focused    │ AWS-focused    │
│ CI/CD integration  │ Excellent      │ Excellent      │ Good           │ Good           │ Good           │
│ Cost               │ Free OSS /     │ Free           │ Free OSS /     │ Free           │ Free           │
│                    │ Cloud $$$      │                │ Cloud $$       │                │                │
└────────────────────┴────────────────┴────────────────┴────────────────┴────────────────┴────────────────┘

RECOMMENDATION:
  Default choice              → Terraform / OpenTofu (largest ecosystem, multi-cloud)
  TypeScript team, AWS only   → AWS CDK (best DX for AWS)
  TypeScript team, multi-cloud→ Pulumi (programming language, multi-cloud)
  Want fully open source      → OpenTofu (fork of Terraform, MPL 2.0)
  Azure only, C# team        → Pulumi (C#) or Bicep
  Simple AWS project          → CDK (TypeScript)
  Enterprise multi-cloud      → Terraform Cloud/Enterprise or OpenTofu + Spacelift

NOTE on Terraform vs OpenTofu:
  HashiCorp changed Terraform to BSL license (2023).
  OpenTofu is the community fork under Linux Foundation.
  Feature parity as of 2025. OpenTofu is gaining traction.
  If license matters → OpenTofu. If enterprise support matters → Terraform Cloud.
```

### Terraform Configuration Example

```hcl
# main.tf — Example ECS Fargate service
terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

module "ecs_service" {
  source = "./modules/ecs-service"

  name            = "api"
  environment     = var.environment
  container_image = "${var.ecr_repo}:${var.image_tag}"
  container_port  = 3000
  cpu             = 256
  memory          = 512
  desired_count   = var.environment == "prod" ? 3 : 1

  environment_variables = {
    DATABASE_URL = var.database_url
    NODE_ENV     = var.environment
  }

  secrets = {
    JWT_SECRET = aws_secretsmanager_secret.jwt.arn
  }

  health_check_path = "/health"
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.private_subnets
}
```

### Pulumi Configuration Example (TypeScript)

```typescript
// index.ts — Example ECS Fargate service
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const environment = pulumi.getStack(); // "dev", "staging", "prod"

const service = new aws.ecs.Service("api-service", {
  cluster: cluster.arn,
  taskDefinition: taskDef.arn,
  desiredCount: environment === "prod" ? 3 : 1,
  launchType: "FARGATE",
  networkConfiguration: {
    subnets: vpc.privateSubnetIds,
    securityGroups: [sgId],
  },
  loadBalancers: [{
    targetGroupArn: targetGroup.arn,
    containerName: "api",
    containerPort: 3000,
  }],
});

export const serviceUrl = pulumi.interpolate`https://${alb.dnsName}`;
```

### AWS CDK Configuration Example (TypeScript)

```typescript
// lib/api-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';

export class ApiStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this, 'ApiService', {
        memoryLimitMiB: 512,
        cpu: 256,
        desiredCount: this.node.tryGetContext('env') === 'prod' ? 3 : 1,
        taskImageOptions: {
          image: ecs.ContainerImage.fromEcrRepository(repo, 'latest'),
          containerPort: 3000,
          environment: {
            NODE_ENV: this.node.tryGetContext('env'),
          },
        },
      }
    );

    service.targetGroup.configureHealthCheck({ path: '/health' });
  }
}
```

---

## 4. Decision Tree: Kubernetes Manifest Management

```
How do you manage Kubernetes manifests?
│
├── Simple project, few resources
│   └── Plain YAML + Kustomize overlays (simplest)
│
├── Need to share/reuse configurations
│   └── Helm charts (package manager for K8s)
│
├── Need environment-specific patches
│   └── Kustomize (base + overlays per environment)
│
├── Need both templating + patches
│   └── Helm + Kustomize post-rendering
│       (helm template | kubectl apply -k .)
│
└── Enterprise with many teams
    └── Helm charts in OCI registry + ArgoCD ApplicationSets
```

### Helm vs Kustomize vs Carvel Comparison

```
┌─────────────────────┬──────────────────────┬──────────────────────┬──────────────────────┐
│ Feature             │ Helm                 │ Kustomize            │ Carvel (ytt/kapp)    │
├─────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ Approach            │ Templating (Go tmpl) │ Overlay/patching     │ YAML programming     │
│ Language            │ Go templates + YAML  │ Plain YAML + patches │ Starlark (Python-ish)│
│ Package management  │ YES (charts, repos)  │ NO                   │ YES (imgpkg bundles) │
│ Registry support    │ OCI registries       │ N/A                  │ OCI registries       │
│ Values file         │ values.yaml          │ N/A (use patches)    │ data-values.yml      │
│ Secrets handling    │ helm-secrets (SOPS)  │ External (SOPS, SealedSecrets)│ ytt overlays│
│ Hooks / lifecycle   │ Pre/post install, etc│ No                   │ kapp ordering        │
│ Dry run / diff      │ helm diff plugin     │ kubectl diff -k      │ kapp deploy --diff   │
│ ArgoCD support      │ Native               │ Native               │ Via carvel-package   │
│ Flux support        │ HelmRelease CRD      │ Kustomization CRD    │ PackageInstall       │
│ Learning curve      │ Medium               │ Low                  │ Medium-High          │
│ Community           │ LARGEST              │ Large (K8s built-in) │ Small (VMware/Broadcom)│
│ Best for            │ Reusable packages,   │ Environment patches, │ Complex overlays,    │
│                     │ third-party apps     │ simple customization │ enterprise config    │
│ Avoid for           │ Simple 5-resource    │ Complex templating,  │ Simple projects,     │
│                     │ apps (overkill)      │ package distribution │ small teams          │
└─────────────────────┴──────────────────────┴──────────────────────┴──────────────────────┘

RECOMMENDATION:
  Simple app, few envs        → Kustomize (built into kubectl)
  Third-party apps (nginx,    → Helm (install from Artifact Hub)
   cert-manager, monitoring)
  Your own microservices      → Helm charts OR Kustomize (team preference)
  Both templating + patching  → Helm + Kustomize post-rendering
  Enterprise config management→ Carvel ytt (if VMware/Tanzu ecosystem)
```

### Helm Chart Example

```yaml
# charts/api/values.yaml
replicaCount: 1
image:
  repository: myregistry/api
  tag: latest
  pullPolicy: IfNotPresent
service:
  type: ClusterIP
  port: 3000
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi
env:
  NODE_ENV: production
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: api.example.com
      paths:
        - path: /
          pathType: Prefix
```

### Kustomize Example

```yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
  - ingress.yaml

# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
patches:
  - target:
      kind: Deployment
      name: api
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 3
  - target:
      kind: Deployment
      name: api
    patch: |-
      - op: replace
        path: /spec/template/spec/containers/0/resources/limits/memory
        value: 1Gi
```

---

## 5. Decision Tree: CI/CD Platform

```
Where is your code hosted?
│
├── GitHub
│   ├── Simple-to-medium workflows? → GitHub Actions (native, free tier: 2000 min/mo)
│   ├── Need self-hosted runners? → GitHub Actions + self-hosted runners
│   └── Complex enterprise? → GitHub Actions (or GitLab CI if also using GitLab)
│
├── GitLab
│   └── → GitLab CI (native, excellent integration, 400 min/mo free)
│
├── Bitbucket
│   └── → Bitbucket Pipelines (native) or CircleCI
│
├── Any Git host
│   ├── Want cloud CI? → CircleCI (6000 min/mo free, any Git host)
│   ├── Want self-hosted? → Jenkins (free, maximum flexibility)
│   └── Want managed + enterprise? → CircleCI or Buildkite
│
└── Enterprise requirements
    ├── Air-gapped / on-premise → Jenkins or GitLab Self-Managed
    ├── Compliance audit trails → GitLab Ultimate or GitHub Enterprise
    ├── Complex pipelines (200+ jobs) → Jenkins or GitLab CI
    └── Build speed critical → Buildkite (auto-scaling agents)
```

### CI/CD Platform Comparison

```
┌──────────────────────┬───────────────┬───────────────┬───────────────┬───────────────┬──────────────┐
│ Feature              │ GitHub Actions│ GitLab CI     │ Jenkins       │ CircleCI      │ Buildkite    │
├──────────────────────┼───────────────┼───────────────┼───────────────┼───────────────┼──────────────┤
│ Hosting              │ Cloud + self  │ Cloud + self  │ Self-hosted   │ Cloud + self  │ Cloud agents │
│ Config format        │ YAML          │ YAML          │ Groovy/YAML   │ YAML          │ YAML         │
│ Config file          │ .github/      │ .gitlab-ci.yml│ Jenkinsfile   │ .circleci/    │ .buildkite/  │
│                      │ workflows/*.yml│              │               │ config.yml    │ pipeline.yml │
│ Marketplace          │ Actions (15K+)│ Templates     │ Plugins (1800+│ Orbs (3000+)  │ Plugins(100+)│
│ Container support    │ Excellent     │ Excellent     │ Good (Docker) │ Excellent     │ Excellent    │
│ Matrix builds        │ strategy.matrix│parallel/matrix│ Matrix axis  │ Matrix jobs   │ Matrix       │
│ Caching              │ actions/cache │ Built-in cache│ Manual        │ Built-in      │ Built-in     │
│ Artifacts            │ upload-artifact│ Job artifacts│ Archive       │ store_artifacts│ Artifact     │
│ Secrets management   │ Secrets+OIDC  │ CI/CD vars   │ Credentials   │ Contexts      │ Secrets      │
│ OIDC (cloud auth)    │ YES           │ YES           │ Plugin        │ YES           │ YES          │
│ Self-hosted runners  │ YES           │ YES           │ Default       │ YES           │ YES (default)│
│ Free tier            │ 2000 min/mo   │ 400 min/mo   │ Free (self)   │ 6000 min/mo   │ Free tier    │
│ Paid pricing         │ Per minute    │ Per user      │ Free (plugins)│ Per credit    │ Per user     │
│ Monorepo support     │ Path filters  │ rules:changes│ Manual        │ Path filtering│ Trigger paths│
│ Environment protect. │ Environments  │ Environments  │ Pipelines     │ Contexts      │ Pipelines    │
│ Approval gates       │ Required review│Manual jobs   │ Input step    │ Approval jobs │ Block step   │
│ Dashboard/visibility │ Good          │ Excellent     │ Blue Ocean    │ Good          │ Excellent    │
│ Reusability          │ Composite act.│ includes/     │ Shared library│ Orbs          │ Plugins      │
│                      │ Reusable WF   │ templates     │               │               │              │
│ Community size       │ Massive       │ Large         │ Massive       │ Medium        │ Growing      │
│ Best for             │ GitHub repos  │ GitLab repos  │ Enterprise    │ Speed/multi   │ Speed/scale  │
│ Avoid for            │ Complex enter.│ GitHub repos  │ Simple proj.  │ Tight budget  │ Small proj.  │
└──────────────────────┴───────────────┴───────────────┴───────────────┴───────────────┴──────────────┘
```

### GitHub Actions Configuration Example

```yaml
# .github/workflows/ci.yml
name: CI Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read
  id-token: write  # OIDC for cloud auth

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-${{ matrix.node-version }}
          path: coverage/

  build-and-push:
    needs: lint-and-test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1
      - uses: aws-actions/amazon-ecr-login@v2
      - run: |
          docker build -t $ECR_REPO:${{ github.sha }} .
          docker push $ECR_REPO:${{ github.sha }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: production  # Requires approval
    steps:
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster prod \
            --service api \
            --force-new-deployment
```

### GitLab CI Configuration Example

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

variables:
  DOCKER_HOST: tcp://docker:2376

test:
  stage: test
  image: node:20-alpine
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/
  script:
    - npm ci
    - npm run lint
    - npm test -- --coverage
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

deploy_production:
  stage: deploy
  environment: production
  when: manual  # Manual approval gate
  script:
    - kubectl set image deployment/api api=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

---

## 6. Decision Tree: GitOps

```
Do you use Kubernetes?
│
├── NO → GitOps is less relevant
│   ├── Use CI/CD-driven deployment instead
│   └── Consider GitOps for IaC (Terraform + Atlantis)
│
└── YES → Which GitOps tool?
    │
    ├── Need rich web UI? → ArgoCD
    │   ├── Multi-cluster management? → ArgoCD (built-in)
    │   ├── SSO integration needed? → ArgoCD (Dex integration)
    │   └── Team needs visual feedback? → ArgoCD (best UI)
    │
    ├── Want CLI-first, lightweight? → Flux
    │   ├── Already using Kustomize? → Flux (native Kustomization CRD)
    │   ├── Need image automation? → Flux (built-in image reflector)
    │   └── Want minimal resource usage? → Flux (lighter than ArgoCD)
    │
    └── Need full CD platform? → Spinnaker (Netflix)
        ├── Multi-cloud deployment? → Spinnaker (AWS, GCP, Azure, K8s)
        ├── Advanced canary/blue-green? → Spinnaker (advanced strategies)
        └── CAUTION: Spinnaker is VERY complex and resource-heavy
```

### GitOps Tool Comparison

```
┌──────────────────────┬───────────────────┬───────────────────┬───────────────────┐
│ Feature              │ ArgoCD            │ Flux              │ Spinnaker         │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Architecture         │ Server + UI       │ Controllers (CRDs)│ Microservices     │
│ UI                   │ Rich web UI       │ CLI + Weave GitOps│ Rich web UI       │
│ Learning curve       │ Medium            │ Low               │ High              │
│ Multi-cluster        │ Built-in (native) │ Via Kustomization │ Built-in          │
│ Multi-tenancy        │ Projects + RBAC   │ K8s RBAC + NS     │ Built-in          │
│ Helm support         │ Native (app of apps)│ HelmRelease CRD │ Helm provider     │
│ Kustomize support    │ Native            │ Native            │ Manifest provider │
│ Image automation     │ Argo Image Updater│ Built-in (image   │ Docker triggers   │
│                      │ (addon)           │ reflector+policy) │                   │
│ Progressive delivery │ Argo Rollouts     │ Flagger           │ Built-in (canary, │
│                      │ (canary,blue-green│ (canary,blue-green│  blue-green)      │
│                      │  , A/B testing)   │  , A/B testing)   │                   │
│ Notifications        │ Built-in (Slack,  │ Built-in (alerts) │ Built-in          │
│                      │  Teams, webhook)  │                   │                   │
│ RBAC                 │ SSO + RBAC        │ K8s RBAC          │ RBAC + SAML       │
│ Resource usage       │ Higher (~1GB RAM) │ Lower (~256MB RAM)│ Highest (~4GB RAM)│
│ Drift detection      │ Built-in (auto)   │ Built-in          │ Limited           │
│ Sync strategies      │ Auto/Manual       │ Auto (interval)   │ Pipeline stages   │
│ Community            │ Largest (CNCF)    │ Large (CNCF)      │ Smaller           │
│ CNCF status          │ Graduated         │ Graduated         │ Incubating        │
│ Best for             │ Multi-team, UI,   │ Simple, CLI-first,│ Full CD platform, │
│                      │ enterprise GitOps │ lightweight GitOps│ multi-cloud       │
│ Avoid for            │ Single small app  │ Need rich UI      │ K8s-only, small   │
│                      │ (overkill)        │                   │ team (way too much)│
└──────────────────────┴───────────────────┴───────────────────┴───────────────────┘

RECOMMENDATION:
  Default GitOps tool         → ArgoCD (best UI, largest community, CNCF graduated)
  Lightweight / CLI-first     → Flux (lower resource usage, simpler model)
  Already using ArgoCD        → Add Argo Rollouts for progressive delivery
  Need multi-cloud beyond K8s → Spinnaker (if team can handle complexity)

RULE: ArgoCD + Flux are BOTH excellent. Choose based on:
  - Need UI? → ArgoCD
  - Want minimal footprint? → Flux
  - Team prefers CLI? → Flux
  - Team prefers dashboards? → ArgoCD
```

---

## 7. Deployment Platform by Project Type

```
Project Type → Recommended Platform

Static site / JAMstack
  → Vercel, Netlify, Cloudflare Pages
  → Cost: Free for most use cases

Simple web app (1 service + DB)
  → Railway, Fly.io, Render
  → Cost: $5-25/month

API + database (2-5 services)
  → Docker Compose (dev) + ECS/Cloud Run (prod)
  → Cost: $50-200/month

Microservices (5-20 services)
  → Kubernetes (EKS/GKE) + ArgoCD
  → Cost: $300-2000/month

Enterprise (20+ services)
  → Kubernetes + service mesh (Istio/Linkerd) + GitOps
  → Cost: $2000+/month

Data pipeline
  → Managed services (AWS Glue, GCP Dataflow, Databricks)
  → Cost: Pay per processing

ML workloads
  → Kubernetes + GPU nodes, or SageMaker/Vertex AI
  → Cost: $500+/month (GPU instances expensive)

Edge / Global distribution
  → Cloudflare Workers, Vercel Edge, Deno Deploy
  → Cost: Pay per request
```

---

## 8. Scale-Based Infrastructure Recommendations

```
┌──────────────────┬────────────────┬──────────────┬────────────────┬────────────────┬──────────────────┐
│ Team Size        │ Containers     │ IaC          │ CI/CD          │ Deployment     │ GitOps           │
├──────────────────┼────────────────┼──────────────┼────────────────┼────────────────┼──────────────────┤
│ Solo / 1-3       │ Docker Compose │ None or      │ GitHub Actions │ PaaS (Railway) │ Not needed       │
│                  │ (dev only)     │ CDK/Terraform│                │ or Cloud Run   │                  │
│                  │                │              │                │                │                  │
│ Small 3-10       │ Docker +       │ Terraform    │ GitHub Actions │ ECS/Cloud Run  │ Not needed       │
│                  │ Cloud Run      │              │ or GitLab CI   │                │ (CI/CD is enough)│
│                  │                │              │                │                │                  │
│ Medium 10-30     │ Kubernetes     │ Terraform    │ GitHub Actions │ ArgoCD         │ ArgoCD           │
│                  │ (managed)      │ + modules    │ or GitLab CI   │                │                  │
│                  │                │              │                │                │                  │
│ Large 30-100     │ Kubernetes     │ Terraform    │ GitLab CI      │ ArgoCD +       │ ArgoCD +         │
│                  │ (managed) +    │ Enterprise   │ or Jenkins     │ Argo Rollouts  │ ApplicationSets  │
│                  │ service mesh   │              │                │                │                  │
│                  │                │              │                │                │                  │
│ Enterprise 100+  │ Kubernetes     │ Terraform    │ Jenkins or     │ ArgoCD +       │ ArgoCD +         │
│                  │ (managed) +    │ Enterprise + │ GitLab CI      │ service mesh + │ multi-cluster    │
│                  │ Istio/Linkerd  │ policy (OPA) │ + Buildkite    │ progressive    │ management       │
│                  │                │              │                │ delivery       │                  │
└──────────────────┴────────────────┴──────────────┴────────────────┴────────────────┴──────────────────┘
```

---

## 9. ASCII Architecture Diagrams

### Simple App (1-5 services)
```
┌─────────────────────────────────────────────────────────┐
│                    Developer Workflow                     │
│  git push → GitHub Actions → Build → Test → Deploy       │
└─────────────────────────┬───────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────┐
│                  Cloud Run / ECS Fargate                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Frontend │  │   API    │  │  Worker   │               │
│  │ (static) │  │ (Node.js)│  │ (async)   │               │
│  └────┬─────┘  └────┬─────┘  └────┬──────┘              │
│       │              │              │                     │
│       └──────────────┼──────────────┘                    │
│                      v                                    │
│              ┌──────────────┐                             │
│              │   Database   │  (Managed: RDS/Cloud SQL)  │
│              └──────────────┘                             │
└─────────────────────────────────────────────────────────┘
```

### Enterprise App (20+ services)
```
┌──────────────────────────────────────────────────────────────────────┐
│                         Developer Workflow                            │
│  git push → CI Pipeline → Build Image → Push to Registry → GitOps   │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               v
┌──────────────────────────────────────────────────────────────────────┐
│                     GitOps (ArgoCD)                                    │
│  Git Repo (manifests) ← monitors ← ArgoCD → syncs → Kubernetes      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               v
┌──────────────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster (Managed)                        │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────┐        │
│  │                    Ingress Controller                      │       │
│  │                (nginx / AWS ALB / Traefik)                │       │
│  └──────────────────────┬────────────────────────────────────┘       │
│                         │                                             │
│  ┌──────────┬───────────┼──────────┬───────────┐                     │
│  │Service A │ Service B │Service C │ Service D  │  (per-team namespaces)│
│  └────┬─────┘─────┬─────┘────┬─────┘─────┬─────┘                     │
│       │           │          │            │                            │
│  ┌────┴───────────┴──────────┴────────────┴─────┐                    │
│  │              Service Mesh (Istio)             │                    │
│  │   mTLS, traffic routing, observability        │                   │
│  └───────────────────────┬───────────────────────┘                   │
│                          │                                            │
│  ┌───────────────────────┴───────────────────────┐                   │
│  │            Data Layer                          │                   │
│  │  ┌────────┐ ┌─────────┐ ┌──────┐ ┌─────────┐ │                   │
│  │  │  RDS   │ │ Redis   │ │Kafka │ │ S3/GCS  │ │                   │
│  │  └────────┘ └─────────┘ └──────┘ └─────────┘ │                   │
│  └───────────────────────────────────────────────┘                   │
│                                                                       │
│  ┌───────────────────────────────────────────────┐                   │
│  │            Observability                       │                   │
│  │  ┌────────────┐ ┌──────────┐ ┌──────────────┐ │                   │
│  │  │ Prometheus │ │ Grafana  │ │ Jaeger/Tempo │ │                   │
│  │  │ (metrics)  │ │ (dashbd) │ │ (tracing)    │ │                   │
│  │  └────────────┘ └──────────┘ └──────────────┘ │                   │
│  └───────────────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Kubernetes for 2 services** | Over-engineered, $500+/mo for simple app | Use Cloud Run, ECS, or PaaS (Railway) |
| **No IaC** | "Snowflake" servers, unreproducible, manual AWS console clicks | Terraform/CDK from day one |
| **Manual deployments** | SSH + git pull, human error, 30+ min deploys | CI/CD pipeline with automated deployment |
| **No GitOps for K8s** | kubectl apply drift, no audit trail, YOLO deploys | ArgoCD or Flux for declarative state |
| **Self-hosted K8s** | Ops burden, etcd management, security patches, upgrade pain | Managed K8s (EKS/GKE/AKS) — ALWAYS |
| **Monolith CI for microservices** | 30+ min builds, all services rebuild on any change | Path-filtered triggers, affected-only builds |
| **No staging environment** | Bugs found in production only | Dev → staging → production (minimum 3 envs) |
| **Complex tooling for simple project** | Kubernetes + Helm + ArgoCD + Istio for a 3-page website | Start with PaaS, add complexity when needed |
| **Terraform state on local disk** | Team can't collaborate, state conflicts, lost state | Remote backend (S3 + DynamoDB lock) from day one |
| **No infrastructure testing** | Broken Terraform on apply, destroyed resources | `terraform plan` in CI, Terratest for modules |
| **Secrets in CI/CD variables** | Secrets scattered across CI platforms | Centralized secret management (Vault, AWS SSM) |
| **No rollback strategy** | Broken deploy means hours of manual fixing | Blue-green or canary deployments, instant rollback |
| **Over-privileged IAM** | CI/CD has admin access, blast radius = everything | Least privilege, OIDC for short-lived credentials |
| **Docker images with secrets** | Credentials baked into Docker layers | Multi-stage builds, runtime env vars, secrets managers |

---

## 11. Enforcement Checklist

### Container Strategy
- [ ] **Container runtime selected** — Docker (default) or Podman (rootless/RHEL)
- [ ] **Orchestration matches service count** — Compose (1-5), Cloud Run/ECS (5-15), K8s (15+)
- [ ] **Multi-stage Docker builds** — separate build and runtime stages
- [ ] **Non-root container user** — USER directive in Dockerfile
- [ ] **Image scanning enabled** — Trivy, Snyk, or platform-native scanning

### Infrastructure as Code
- [ ] **IaC tool chosen** — Terraform (multi-cloud), CDK (AWS), Pulumi (programming lang)
- [ ] **Remote state configured** — S3+DynamoDB, Terraform Cloud, or Pulumi Cloud
- [ ] **State locking enabled** — prevent concurrent modifications
- [ ] **Modules for reusable infrastructure** — DRY principle for IaC
- [ ] **Plan output reviewed** — never apply without reviewing plan

### CI/CD
- [ ] **Pipeline matches code host** — GitHub Actions for GitHub, GitLab CI for GitLab
- [ ] **OIDC for cloud auth** — no long-lived credentials in CI
- [ ] **Build caching enabled** — npm/pnpm cache, Docker layer cache
- [ ] **Path-filtered triggers** — only build affected services in monorepo
- [ ] **Environment protection rules** — manual approval for production

### Kubernetes (if applicable)
- [ ] **Managed K8s** — EKS/GKE/AKS, NEVER self-hosted unless air-gapped
- [ ] **GitOps for deployment** — ArgoCD (UI) or Flux (CLI) for declarative management
- [ ] **Manifest management chosen** — Helm (packages) or Kustomize (overlays)
- [ ] **Resource limits set** — CPU/memory requests and limits on all pods
- [ ] **Health checks configured** — liveness + readiness probes
- [ ] **Network policies defined** — pod-to-pod communication restricted
- [ ] **Pod Disruption Budgets** — ensure availability during node maintenance

### Environments
- [ ] **Minimum 3 environments** — development, staging, production
- [ ] **Environment parity** — staging mirrors production (same infra, smaller scale)
- [ ] **Secret management centralized** — Vault, AWS SSM, or cloud-native secrets
- [ ] **Rollback strategy documented** — instant rollback for failed deployments

---

## 12. Cross-Reference Guide

| Topic | Detailed Guide |
|-------|----------------|
| Docker project structure | `docker-project-structure.md` |
| Kubernetes manifests | `kubernetes-manifests-structure.md` |
| Terraform / IaC | `terraform-iac-structure.md` |
| CI/CD pipelines | `ci-cd-pipeline-structure.md` |
| GitOps workflows | `gitops-structure.md` |
| Monorepo CI/CD | `../monorepo/ci-cd-for-monorepos.md` |
| Microservices layout | `../microservices-organization/multi-service-layout.md` |
| Service templates | `../microservices-organization/service-template-structure.md` |
