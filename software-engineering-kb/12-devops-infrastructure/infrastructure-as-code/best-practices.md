# IaC Best Practices

| Attribute     | Value                                                                                          |
|--------------|------------------------------------------------------------------------------------------------|
| Domain       | DevOps > IaC                                                                                   |
| Importance   | Critical                                                                                       |
| Last Updated | 2026-03-10                                                                                     |
| Cross-ref    | [Terraform](terraform.md), [Pulumi](pulumi.md), [CloudFormation](cloudformation.md)           |

---

## Core Concepts

### IaC Principles

Infrastructure as Code treats infrastructure provisioning and management as a software engineering discipline. Three foundational principles guide all IaC work:

**Declarative over Imperative.** Describe the desired end state, not the steps to reach it. Declarative definitions are idempotent -- applying the same configuration twice produces the same result with no side effects.

**Idempotency.** Every apply operation must be safe to run multiple times. If the infrastructure already matches the desired state, no changes occur. This eliminates "it worked on my machine" drift.

**Immutability.** Replace infrastructure components rather than modifying them in place. Instead of patching a running server, create a new AMI and replace the instance. Immutable infrastructure eliminates configuration drift.

```text
Infrastructure Maturity Model
┌────────────────────────────────────────────────────────┐
│ Level 0: Manual           │ Console clicks, SSH, docs  │
│ Level 1: Scripts          │ Bash/PowerShell, imperative │
│ Level 2: IaC (basic)      │ Terraform/CFN, single env  │
│ Level 3: IaC (modular)    │ Modules, multi-env, CI/CD  │
│ Level 4: IaC (platform)   │ Self-service, policy-as-code│
│ Level 5: IaC (autonomous) │ Auto-remediation, GitOps   │
└────────────────────────────────────────────────────────┘
```

### Repository Structure

#### Monorepo vs Polyrepo

| Approach | When to Use | Trade-offs |
|----------|-------------|------------|
| **Monorepo** | Small-medium teams, tightly coupled infra | Simpler cross-cutting changes, harder access control |
| **Polyrepo** | Large orgs, independent teams, strict boundaries | Strong ownership boundaries, harder cross-repo refactoring |
| **Hybrid** | Most organizations | App repos own their infra; shared modules in separate repo |

#### Recommended Directory Layout (Terraform)

```text
infrastructure/
├── modules/                    # Reusable modules (versioned)
│   ├── vpc/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── ecs-service/
│   ├── rds-cluster/
│   └── lambda-function/
├── environments/               # Environment-specific root modules
│   ├── dev/
│   │   ├── networking/
│   │   │   ├── main.tf         # module "vpc" { source = "../../../modules/vpc" }
│   │   │   ├── backend.tf      # Remote state config
│   │   │   ├── variables.tf
│   │   │   └── terraform.tfvars
│   │   ├── compute/
│   │   └── data/
│   ├── staging/
│   │   ├── networking/
│   │   ├── compute/
│   │   └── data/
│   └── prod/
│       ├── networking/
│       ├── compute/
│       └── data/
├── shared/                     # Account-level resources (IAM, DNS)
│   ├── iam/
│   └── route53/
└── scripts/                    # Helper scripts (not IaC)
    ├── bootstrap-state.sh
    └── import-resources.sh
```

#### Recommended Layout (Pulumi)

```text
infrastructure/
├── packages/                   # Shared component libraries
│   └── components/
│       ├── package.json
│       └── src/
│           ├── vpc.ts
│           ├── ecs-service.ts
│           └── index.ts
├── projects/                   # Pulumi projects (one per domain)
│   ├── networking/
│   │   ├── Pulumi.yaml
│   │   ├── Pulumi.dev.yaml
│   │   ├── Pulumi.prod.yaml
│   │   ├── index.ts
│   │   └── tsconfig.json
│   ├── compute/
│   └── data/
└── policy-packs/               # CrossGuard policies
    └── compliance/
        ├── package.json
        └── index.ts
```

### State Management Strategies

State is the mapping between IaC definitions and real-world resources. Mismanaged state is the most common source of IaC incidents.

**Remote state** is mandatory for any team environment. Configure backend storage with encryption, versioning, and access controls.

**State locking** prevents concurrent operations from corrupting state. DynamoDB (AWS), GCS (GCP), and Azure Blob leases provide locking.

**State isolation** separates blast radius per environment and per infrastructure layer. One state file per root module.

```hcl
# Terraform: Isolated state per environment and layer
# environments/prod/networking/backend.tf
terraform {
  backend "s3" {
    bucket         = "mycompany-tf-state"
    key            = "prod/networking/terraform.tfstate"  # Unique per layer
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "tf-state-lock"
  }
}

# environments/prod/compute/backend.tf
terraform {
  backend "s3" {
    bucket         = "mycompany-tf-state"
    key            = "prod/compute/terraform.tfstate"     # Different key
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "tf-state-lock"
  }
}
```

```bash
# Bootstrap state backend (run once, manually)
#!/bin/bash
aws s3api create-bucket \
  --bucket mycompany-tf-state \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket mycompany-tf-state \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket mycompany-tf-state \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "aws:kms"}}]
  }'

aws dynamodb create-table \
  --table-name tf-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### Module / Component Design

Apply software engineering principles to infrastructure modules:

**Single Responsibility.** Each module manages one logical component (VPC, ECS service, RDS cluster). Do not create "everything" modules.

**Versioning.** Tag module releases with semantic versions. Pin consumers to specific versions. Never consume modules from `main` branch in production.

**Clear Interfaces.** Define typed inputs with validation and descriptions. Expose only intentional outputs.

```hcl
# GOOD: Module with clear interface and validation
# modules/rds-cluster/variables.tf
variable "cluster_name" {
  description = "Name of the RDS cluster"
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,62}$", var.cluster_name))
    error_message = "Cluster name must be lowercase alphanumeric with hyphens, 3-63 chars."
  }
}

variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "16.2"

  validation {
    condition     = can(regex("^\\d+\\.\\d+$", var.engine_version))
    error_message = "Engine version must be in format X.Y."
  }
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.large"
}

variable "backup_retention_days" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 7

  validation {
    condition     = var.backup_retention_days >= 7 && var.backup_retention_days <= 35
    error_message = "Backup retention must be between 7 and 35 days."
  }
}
```

### Environment Management

Maintain dev/staging/prod parity. Differences between environments should be limited to scale (instance count, size) and external integrations.

```hcl
# environments/prod/terraform.tfvars
environment        = "prod"
instance_type      = "m6i.xlarge"
min_capacity       = 3
max_capacity       = 10
multi_az           = true
deletion_protection = true

# environments/dev/terraform.tfvars
environment        = "dev"
instance_type      = "t3.medium"
min_capacity       = 1
max_capacity       = 2
multi_az           = false
deletion_protection = false
```

Promotion workflow:

```text
Feature Branch → dev (auto-apply) → staging (auto-apply) → prod (manual approve)
      │                │                    │                      │
      └─ PR            └─ Plan + Apply      └─ Plan + Apply       └─ Plan → Review → Apply
```

### Secrets in IaC

Never store secrets in IaC files, variable definitions, or state. Use external secret management systems.

```hcl
# Terraform: Reference secrets from external stores
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "prod/database/password"
}

resource "aws_db_instance" "main" {
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
}

# Terraform: Use Vault provider
data "vault_generic_secret" "db" {
  path = "secret/data/prod/database"
}

resource "aws_db_instance" "main" {
  password = data.vault_generic_secret.db.data["password"]
}
```

```typescript
// Pulumi: Encrypted config secrets
const config = new pulumi.Config();
const dbPassword = config.requireSecret("dbPassword"); // Encrypted in state

// Pulumi: Reference AWS Secrets Manager
const secret = aws.secretsmanager.getSecretVersionOutput({
  secretId: "prod/database/password",
});
```

### CI/CD for Infrastructure

Automate IaC workflows with the same rigor as application CI/CD.

```yaml
# .github/workflows/terraform.yml
name: Terraform CI/CD

on:
  pull_request:
    paths: ["environments/**", "modules/**"]
  push:
    branches: [main]
    paths: ["environments/**", "modules/**"]

env:
  TF_VERSION: "1.7.5"
  AWS_REGION: "us-east-1"

jobs:
  plan:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [dev, staging, prod]
        layer: [networking, compute, data]
    defaults:
      run:
        working-directory: environments/${{ matrix.environment }}/${{ matrix.layer }}
    permissions:
      id-token: write        # OIDC for AWS
      contents: read
      pull-requests: write   # Post plan comment
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/terraform-plan
          aws-region: ${{ env.AWS_REGION }}

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - run: terraform init -input=false
      - run: terraform validate

      # Security scanning -- cross-ref: 08-security/infrastructure-security/iac-security.md
      - uses: bridgecrewio/checkov-action@v12
        with:
          directory: .
          framework: terraform

      # Cost estimation
      - uses: infracost/actions/setup@v3
        with:
          api-key: ${{ secrets.INFRACOST_API_KEY }}
      - run: infracost breakdown --path . --format json --out-file /tmp/infracost.json
      - run: infracost comment github --path /tmp/infracost.json --repo ${{ github.repository }} --pull-request ${{ github.event.pull_request.number }} --behavior update

      # Plan
      - run: terraform plan -input=false -no-color -out=tfplan
        id: plan

      # Post plan as PR comment
      - uses: actions/github-script@v7
        with:
          script: |
            const output = `#### Terraform Plan - ${{ matrix.environment }}/${{ matrix.layer }}
            \`\`\`
            ${{ steps.plan.outputs.stdout }}
            \`\`\``;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: output
            });

  apply:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production    # Requires manual approval
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init && terraform apply -auto-approve -input=false
```

### Tagging and Naming Conventions

Define and enforce consistent tagging and naming standards across all resources.

```hcl
# Standard tags applied to all resources
locals {
  standard_tags = {
    Environment = var.environment          # dev, staging, prod
    Project     = var.project              # project name
    ManagedBy   = "terraform"              # iac tool
    CostCenter  = var.cost_center          # billing attribution
    Owner       = var.team                 # responsible team
    Repository  = var.repository           # source repo
    Compliance  = var.compliance_standard  # PCI, HIPAA, SOC2
  }
}

# Provider-level default tags (Terraform AWS provider)
provider "aws" {
  region = var.region
  default_tags {
    tags = local.standard_tags
  }
}

# Naming convention: {project}-{environment}-{component}-{qualifier}
locals {
  name_prefix = "${var.project}-${var.environment}"
  # Examples:
  # myapp-prod-vpc
  # myapp-prod-api-alb
  # myapp-prod-api-ecs-service
  # myapp-prod-orders-rds
}
```

### Cost Estimation in Pipeline

Integrate Infracost to show cost impact of infrastructure changes before they are applied.

```bash
# Install Infracost
brew install infracost    # macOS
infracost auth login      # Authenticate

# Show cost breakdown
infracost breakdown --path .

# Show cost diff between current and planned state
infracost diff --path . --compare-to infracost-base.json

# Example output:
# ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━┓
# ┃ Project                   ┃ Monthly cost  ┃ Diff          ┃
# ┣━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━┫
# ┃ prod/compute              ┃ $1,245/mo     ┃ +$320/mo      ┃
# ┃ prod/data                 ┃ $890/mo       ┃ No change     ┃
# ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━┛
```

### Documentation Generation

```bash
# terraform-docs: auto-generate module documentation
brew install terraform-docs

# Generate markdown docs from module
terraform-docs markdown table ./modules/vpc > ./modules/vpc/README.md

# Configuration: .terraform-docs.yml
# formatter: markdown table
# output:
#   file: README.md
#   mode: inject
# content: |-
#   {{ .Header }}
#   {{ .Requirements }}
#   {{ .Providers }}
#   {{ .Inputs }}
#   {{ .Outputs }}

# Pre-commit hook for auto-generation
# - repo: https://github.com/terraform-docs/terraform-docs
#   rev: v0.18.0
#   hooks:
#     - id: terraform-docs-go
#       args: ["markdown", "table", "--output-file", "README.md"]
```

### Dependency Management Between Stacks

Manage dependencies between infrastructure layers using data sources, remote state, or stack references.

```hcl
# Terraform: Read outputs from another state file
data "terraform_remote_state" "networking" {
  backend = "s3"
  config = {
    bucket = "mycompany-tf-state"
    key    = "prod/networking/terraform.tfstate"
    region = "us-east-1"
  }
}

resource "aws_ecs_service" "api" {
  network_configuration {
    subnets         = data.terraform_remote_state.networking.outputs.private_subnet_ids
    security_groups = [aws_security_group.api.id]
  }
}
```

```typescript
// Pulumi: Stack references
const networkStack = new pulumi.StackReference("myorg/networking/prod");
const vpcId = networkStack.getOutput("vpcId");
const subnetIds = networkStack.getOutput("privateSubnetIds");
```

### Rollback Strategies

| Strategy | Tool | Mechanism |
|----------|------|-----------|
| **State rollback** | Terraform | Restore previous state version from S3 versioning |
| **Stack rollback** | CloudFormation | Automatic rollback on failure (default behavior) |
| **Blue-green** | All tools | Deploy new infra alongside old, switch traffic, tear down old |
| **Revert commit** | All tools | `git revert` the infrastructure change, re-apply |
| **Targeted destroy** | Terraform | `terraform destroy -target=aws_ecs_service.api` |

```bash
# Terraform: Recover from bad state using S3 versioning
aws s3api list-object-versions \
  --bucket mycompany-tf-state \
  --prefix prod/compute/terraform.tfstate

aws s3api get-object \
  --bucket mycompany-tf-state \
  --key prod/compute/terraform.tfstate \
  --version-id "abc123" \
  recovered.tfstate

# Restore the previous state version
terraform state push recovered.tfstate
```

### Infrastructure Testing Pyramid

```text
Infrastructure Testing Pyramid
┌──────────────────┐
│   E2E Tests      │  Deploy real infra, verify behavior, destroy
│   (slowest)      │  Tools: Terratest, Pulumi Automation API
├──────────────────┤
│  Integration     │  Deploy subset, verify connectivity/permissions
│  Tests           │  Tools: Terratest, kitchen-terraform
├──────────────────┤
│  Unit Tests      │  Mock providers, verify resource config
│  (fast)          │  Tools: Pulumi mocks, terraform test, OPA
├──────────────────┤
│  Static Analysis │  Lint, validate, security scan (no deploy)
│  (fastest)       │  Tools: tflint, cfn-lint, Checkov, tfsec
└──────────────────┘
```

```hcl
# Terraform native tests (terraform test, Terraform 1.6+)
# tests/vpc.tftest.hcl
run "vpc_creates_successfully" {
  command = plan

  assert {
    condition     = aws_vpc.main.enable_dns_hostnames == true
    error_message = "VPC must have DNS hostnames enabled"
  }

  assert {
    condition     = length(aws_subnet.private) == 3
    error_message = "Must create exactly 3 private subnets"
  }
}

run "cidr_is_valid" {
  command = plan

  variables {
    cidr_block = "10.0.0.0/16"
  }

  assert {
    condition     = can(cidrhost(var.cidr_block, 0))
    error_message = "CIDR block must be valid"
  }
}
```

```go
// Terratest: Integration test (Go)
package test

import (
    "testing"
    "github.com/gruntwork-io/terratest/modules/terraform"
    "github.com/stretchr/testify/assert"
)

func TestVpcModule(t *testing.T) {
    t.Parallel()

    opts := &terraform.Options{
        TerraformDir: "../environments/test/networking",
        Vars: map[string]interface{}{
            "environment": "test",
            "cidr_block":  "10.99.0.0/16",
        },
    }

    defer terraform.Destroy(t, opts)
    terraform.InitAndApply(t, opts)

    vpcId := terraform.Output(t, opts, "vpc_id")
    assert.Regexp(t, `^vpc-`, vpcId)

    privateSubnets := terraform.OutputList(t, opts, "private_subnet_ids")
    assert.Len(t, privateSubnets, 3)
}
```

### Security Scanning Integration

IaC security scanning is covered extensively in [08-security/infrastructure-security/iac-security.md](../../08-security/infrastructure-security/iac-security.md), including Checkov, tfsec/Trivy, KICS, Terrascan, OPA, Sentinel, and CloudFormation Guard with full CI integration patterns. Run static security scanning as the first CI stage for fastest feedback. Enforce `mandatory` policy level for critical rules (public S3, unencrypted storage) and `advisory` for non-critical best practices during initial adoption.

---

## 10 Best Practices

1. **Declare everything, modify nothing manually.** Every infrastructure component must exist in code. Manual Console or CLI changes create drift. If emergency changes are necessary, codify them within 24 hours.

2. **Isolate state per environment and per layer.** Never share a single state file across environments (dev/staging/prod) or across infrastructure layers (networking/compute/data). Isolation limits blast radius.

3. **Version and pin modules.** Consume modules via Git tags (`?ref=v2.1.0`), registry versions, or package versions. Never reference `main` branch directly. Update module versions intentionally and test before promoting.

4. **Run plan/preview on every pull request.** Post the plan output as a PR comment so reviewers can assess blast radius. Reviewers must verify: what resources are created, changed, or destroyed.

5. **Apply only on merge to main.** Prevent developers from running `terraform apply` or `pulumi up` locally against shared environments. CI/CD is the only path to production.

6. **Integrate cost estimation in CI.** Use Infracost to show the monthly cost impact of every infrastructure change. Set budget thresholds that require additional approval for large cost increases.

7. **Generate documentation automatically.** Use `terraform-docs` to generate module documentation from code. Stale documentation is worse than no documentation.

8. **Adopt the infrastructure testing pyramid.** Run static analysis on every commit (seconds). Run unit tests on every PR (minutes). Run integration tests nightly or on release branches (minutes to hours).

9. **Implement drift detection.** Run scheduled drift detection (daily or weekly). Alert on any differences between the declared state and actual infrastructure. Remediate immediately.

10. **Standardize tagging and naming across all resources.** Enforce required tags (Environment, Project, ManagedBy, CostCenter, Owner) via policy-as-code. Inconsistent tagging makes cost attribution and incident response harder.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **"ClickOps" alongside IaC** | Drift, state conflicts, unreproducible infrastructure | Enforce all changes through IaC pipeline; enable drift detection |
| **Single state file for entire environment** | Slow plans, large blast radius, team contention | Split state by infrastructure layer (networking, compute, data) |
| **Secrets committed in `.tfvars` or config** | Credentials leaked in version control | Use external secret stores (Vault, AWS Secrets Manager, Pulumi ESC) |
| **Unpinned module/provider versions** | Breaking changes silently introduced, non-reproducible builds | Pin all versions with pessimistic constraints; update intentionally |
| **No CI/CD for infrastructure** | Manual applies, no review, no audit trail, inconsistent environments | Implement plan-on-PR, apply-on-merge pipeline with approval gates |
| **Copy-pasting modules instead of versioning** | Drift between copies, bug fixes not propagated | Publish modules to a registry; consume with version constraints |
| **No resource tagging** | Cannot attribute costs, identify owners, or filter resources | Enforce standard tags via `default_tags` and policy-as-code |
| **Skipping infrastructure tests** | Misconfigurations reach production, rollback is manual and risky | Implement testing pyramid: static analysis, unit, integration, E2E |

---

## Enforcement Checklist

- [ ] All infrastructure defined in code (no manual Console/CLI provisioning)
- [ ] Remote state configured with encryption, versioning, and locking
- [ ] State isolated per environment and per infrastructure layer
- [ ] Module/component versions pinned with semantic constraints
- [ ] `plan`/`preview` runs on every pull request and posts output as PR comment
- [ ] `apply`/`up` runs only via CI on merge to main branch
- [ ] Security scanning integrated in CI (Checkov, tfsec/Trivy, KICS)
- [ ] Cost estimation (Infracost) runs on every infrastructure PR
- [ ] Standard tags enforced on all resources via policy-as-code
- [ ] Naming conventions documented and enforced via validation rules
- [ ] Secrets stored in external systems (Vault, Secrets Manager, Pulumi ESC)
- [ ] Module documentation auto-generated (terraform-docs or equivalent)
- [ ] Drift detection runs on schedule (daily or weekly) with alerts
- [ ] Infrastructure testing pyramid implemented (static, unit, integration, E2E)
- [ ] Pre-commit hooks run `fmt`, `validate`, and `lint` on every commit
- [ ] Rollback procedure documented and tested for each infrastructure layer
