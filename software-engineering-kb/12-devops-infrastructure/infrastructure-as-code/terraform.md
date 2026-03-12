# Terraform

| Attribute     | Value                                                                                      |
|--------------|--------------------------------------------------------------------------------------------|
| Domain       | DevOps > IaC                                                                               |
| Importance   | Critical                                                                                   |
| Last Updated | 2026-03-10                                                                                 |
| Cross-ref    | [Best Practices](best-practices.md), [Pulumi](pulumi.md), [CloudFormation](cloudformation.md) |

---

## Core Concepts

### Terraform Architecture

Terraform is a declarative Infrastructure as Code tool that manages infrastructure through a plan-and-apply lifecycle. With 32.8% market share and 3,000+ providers, it is the most widely adopted IaC tool.

```text
Terraform Architecture
┌─────────────────────────────────────────────────────┐
│  Terraform CLI                                       │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ HCL Parser│→ │ Graph    │→ │ Provider Plugins │ │
│  │           │  │ Builder  │  │ (AWS, GCP, Azure)│ │
│  └───────────┘  └──────────┘  └──────────────────┘ │
│        ↓              ↓               ↓              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Plan     │→ │ Apply    │→ │ State File       │  │
│  │ (diff)   │  │ (execute)│  │ (terraform.tfstate)│ │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
```

The core workflow follows three steps:

1. **`terraform init`** -- Download providers and modules, initialize backend.
2. **`terraform plan`** -- Compare desired state (HCL) with current state, produce an execution plan.
3. **`terraform apply`** -- Execute the plan to create, update, or destroy resources.

```bash
# Standard workflow
terraform init
terraform plan -out=tfplan          # Save plan to file for exact replay
terraform apply tfplan              # Apply the saved plan
terraform destroy                   # Tear down all managed resources
```

### HCL Syntax Deep-Dive

#### Resources and Data Sources

Resources represent infrastructure objects to create. Data sources read existing infrastructure.

```hcl
# Resource: create and manage an AWS VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.project}-${var.environment}-vpc"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Data source: read an existing AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-24.04-amd64-server-*"]
  }
}
```

#### Variables, Outputs, and Locals

```hcl
# variables.tf
variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "instance_config" {
  description = "EC2 instance configuration"
  type = object({
    instance_type = string
    volume_size   = number
    encrypted     = optional(bool, true)
  })
}

# locals.tf -- Compute derived values; avoid repeating expressions
locals {
  name_prefix = "${var.project}-${var.environment}"
  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    CostCenter  = var.cost_center
  }
  is_production = var.environment == "prod"
}

# outputs.tf
output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}
```

#### Expressions and Functions

```hcl
# Conditional expression
resource "aws_instance" "web" {
  instance_type = local.is_production ? "m6i.xlarge" : "t3.medium"
  monitoring    = local.is_production
}

# String interpolation and directives
locals {
  user_data = <<-EOT
    #!/bin/bash
    %{ for port in var.open_ports ~}
    ufw allow ${port}/tcp
    %{ endfor ~}
    echo "Setup complete"
  EOT
}

# Built-in functions
locals {
  az_names     = slice(data.aws_availability_zones.available.names, 0, 3)
  cidr_blocks  = cidrsubnets("10.0.0.0/16", 8, 8, 8, 8, 8, 8)
  merged_tags  = merge(local.common_tags, { Name = "web-server" })
  encoded_data = base64encode(jsonencode({ key = "value" }))
  file_hash    = filemd5("${path.module}/files/config.json")
}
```

### State Management

State tracks the mapping between HCL resources and real-world infrastructure. Never store state locally in production.

```hcl
# Remote backend: S3 + DynamoDB (recommended for AWS)
terraform {
  backend "s3" {
    bucket         = "mycompany-terraform-state"
    key            = "environments/prod/networking/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"   # State locking
    kms_key_id     = "alias/terraform-state"  # Server-side encryption
  }
}

# Remote backend: GCS (recommended for GCP)
terraform {
  backend "gcs" {
    bucket = "mycompany-tf-state"
    prefix = "environments/prod/networking"
  }
}

# Remote backend: Azure Blob Storage
terraform {
  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "mycompanytfstate"
    container_name       = "tfstate"
    key                  = "prod/networking.tfstate"
  }
}

# Terraform Cloud backend
terraform {
  cloud {
    organization = "mycompany"
    workspaces {
      name = "networking-prod"
    }
  }
}
```

### Modules

Modules encapsulate reusable infrastructure components. Follow single-responsibility principle.

```hcl
# modules/vpc/main.tf
resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(var.tags, { Name = "${var.name}-vpc" })
}

resource "aws_subnet" "public" {
  for_each = { for i, az in var.availability_zones : az => i }

  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.cidr_block, 8, each.value)
  availability_zone       = each.key
  map_public_ip_on_launch = true
  tags = merge(var.tags, {
    Name = "${var.name}-public-${each.key}"
    Tier = "public"
  })
}

resource "aws_subnet" "private" {
  for_each = { for i, az in var.availability_zones : az => i + length(var.availability_zones) }

  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, 8, each.value)
  availability_zone = each.key
  tags = merge(var.tags, {
    Name = "${var.name}-private-${each.key}"
    Tier = "private"
  })
}

# modules/vpc/variables.tf
variable "name"               { type = string }
variable "cidr_block"         { type = string, default = "10.0.0.0/16" }
variable "availability_zones" { type = list(string) }
variable "tags"               { type = map(string), default = {} }

# modules/vpc/outputs.tf
output "vpc_id"             { value = aws_vpc.this.id }
output "public_subnet_ids"  { value = [for s in aws_subnet.public : s.id] }
output "private_subnet_ids" { value = [for s in aws_subnet.private : s.id] }
```

#### Consuming Modules

```hcl
# Root module: environments/prod/main.tf
module "vpc" {
  source  = "../../modules/vpc"       # Local path
  # source = "app.terraform.io/mycompany/vpc/aws"  # Private registry
  # source = "git::https://github.com/mycompany/tf-modules.git//vpc?ref=v2.1.0"

  name               = "production"
  cidr_block         = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  tags               = local.common_tags
}

module "ecs_service" {
  source = "../../modules/ecs-service"

  cluster_id         = module.ecs_cluster.id
  service_name       = "api"
  container_image    = "123456789.dkr.ecr.us-east-1.amazonaws.com/api:${var.image_tag}"
  cpu                = 512
  memory             = 1024
  desired_count      = local.is_production ? 3 : 1
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [module.security_groups.ecs_sg_id]
  target_group_arn   = module.alb.target_group_arn
  tags               = local.common_tags
}
```

### for_each vs count

Prefer `for_each` over `count` for most cases. `count` uses index-based addressing, causing cascading changes when items are removed from the middle of a list.

```hcl
# BAD: count -- removing item at index 0 forces recreation of all subsequent items
resource "aws_iam_user" "users" {
  count = length(var.user_names)
  name  = var.user_names[count.index]
}

# GOOD: for_each -- stable keys, removing one user does not affect others
resource "aws_iam_user" "users" {
  for_each = toset(var.user_names)
  name     = each.value
}

# for_each with a map
resource "aws_security_group_rule" "ingress" {
  for_each = {
    http  = { port = 80,  cidr = "0.0.0.0/0" }
    https = { port = 443, cidr = "0.0.0.0/0" }
    ssh   = { port = 22,  cidr = var.admin_cidr }
  }

  type              = "ingress"
  from_port         = each.value.port
  to_port           = each.value.port
  protocol          = "tcp"
  cidr_blocks       = [each.value.cidr]
  security_group_id = aws_security_group.web.id
}
```

### Dynamic Blocks

Use dynamic blocks to generate repeated nested blocks from collections.

```hcl
resource "aws_security_group" "web" {
  name   = "${local.name_prefix}-web-sg"
  vpc_id = module.vpc.vpc_id

  dynamic "ingress" {
    for_each = var.ingress_rules
    content {
      from_port   = ingress.value.from_port
      to_port     = ingress.value.to_port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
      description = ingress.value.description
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### Lifecycle Rules

Control resource creation and destruction behavior.

```hcl
resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type

  lifecycle {
    create_before_destroy = true   # Create replacement before destroying original (zero-downtime)
    prevent_destroy       = true   # Block terraform destroy for critical resources
    ignore_changes        = [ami]  # Ignore AMI drift (handled by a separate pipeline)

    # Precondition and postcondition (Terraform 1.2+)
    precondition {
      condition     = data.aws_ami.ubuntu.architecture == "x86_64"
      error_message = "AMI must be x86_64 architecture."
    }

    postcondition {
      condition     = self.public_ip != ""
      error_message = "Instance must have a public IP."
    }
  }
}

resource "aws_db_instance" "main" {
  identifier     = "${local.name_prefix}-db"
  engine         = "postgres"
  engine_version = "16.2"
  instance_class = "db.r6g.xlarge"

  lifecycle {
    prevent_destroy = true          # Never accidentally destroy the database
    ignore_changes  = [password]    # Password managed externally (Vault/SecretsManager)
  }
}
```

### Moved Blocks for Refactoring

Rename or restructure resources without destroying and recreating them (Terraform 1.1+).

```hcl
# Refactor: rename a resource
moved {
  from = aws_instance.web_server
  to   = aws_instance.web
}

# Refactor: move a resource into a module
moved {
  from = aws_vpc.main
  to   = module.networking.aws_vpc.this
}

# Refactor: change from count to for_each
moved {
  from = aws_subnet.public[0]
  to   = aws_subnet.public["us-east-1a"]
}
```

### Provider Configuration and Version Constraints

```hcl
terraform {
  required_version = ">= 1.7.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"    # Allow patch updates only
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.25.0"
    }
  }
}

# Multi-region provider configuration
provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = local.common_tags
  }
}

provider "aws" {
  alias  = "eu"
  region = "eu-west-1"
  default_tags {
    tags = local.common_tags
  }
}

# Use aliased provider
resource "aws_s3_bucket" "eu_backup" {
  provider = aws.eu
  bucket   = "${local.name_prefix}-eu-backup"
}
```

### Import and State Manipulation

```bash
# Import an existing resource into Terraform state
terraform import aws_instance.web i-1234567890abcdef0

# Import block (Terraform 1.5+ -- declarative import)
# In your .tf file:
# import {
#   to = aws_instance.web
#   id = "i-1234567890abcdef0"
# }
# Then run: terraform plan -generate-config-out=generated.tf

# State manipulation (use with extreme caution)
terraform state list                           # List all resources in state
terraform state show aws_instance.web          # Show details of one resource
terraform state mv aws_instance.old aws_instance.new  # Rename in state
terraform state rm aws_instance.orphaned       # Remove from state (does NOT destroy resource)
terraform state pull > backup.tfstate          # Download remote state for inspection
```

### Workspaces vs Directory-Based Environments

```bash
# Workspaces: lightweight environment isolation (shared config, separate state)
terraform workspace new staging
terraform workspace new prod
terraform workspace select staging
terraform workspace list

# Access workspace name in HCL
# locals {
#   environment = terraform.workspace
#   instance_count = terraform.workspace == "prod" ? 3 : 1
# }
```

**Recommendation:** Prefer directory-based environments over workspaces for production. Workspaces share the same backend config and code, making it easy to accidentally apply prod changes to staging. Directory separation provides clearer boundaries.

```text
environments/
├── dev/
│   ├── main.tf          # module "vpc" { source = "../../modules/vpc" }
│   ├── variables.tf
│   └── terraform.tfvars
├── staging/
│   ├── main.tf
│   ├── variables.tf
│   └── terraform.tfvars
└── prod/
    ├── main.tf
    ├── variables.tf
    └── terraform.tfvars
modules/
├── vpc/
├── ecs-service/
└── rds/
```

### Terraform Cloud / Enterprise Features

Terraform Cloud adds collaboration, governance, and remote execution.

- **Remote state management** with built-in locking and encryption.
- **VCS-driven workflows** -- trigger plan/apply from Git commits.
- **Policy as Code (Sentinel)** -- enforce governance rules before apply.
- **Cost estimation** -- show estimated monthly cost diff per plan.
- **Private module registry** -- publish and version internal modules.
- **Run triggers** -- chain workspace runs for dependent infrastructure.
- **Ephemeral workspaces** -- short-lived environments for PR previews.

### OpenTofu Fork

OpenTofu is a Linux Foundation fork of Terraform created after HashiCorp switched to the BSL license in August 2023. Consider OpenTofu when:

- License compliance requires truly open-source (MPL 2.0 vs BSL 1.1).
- Organization policy prohibits BSL-licensed software.
- Community-driven governance model is preferred.

OpenTofu maintains compatibility with Terraform 1.5.x configuration and state format, adds features like client-side state encryption, and supports the same provider ecosystem.

---

## 10 Best Practices

1. **Use remote state with locking.** Configure S3+DynamoDB, GCS, Azure Blob, or Terraform Cloud as backend. Local state is acceptable only for individual learning exercises.

2. **Pin provider and Terraform versions.** Use `required_version` and `required_providers` with pessimistic constraints (`~>`) to prevent unexpected breaking changes while allowing patch updates.

3. **Prefer `for_each` over `count`.** Index-based `count` causes cascading recreations when list items change. Key-based `for_each` provides stable addressing.

4. **Isolate state per environment and component.** Separate state files for networking, compute, and data layers reduce blast radius. Never share a single state file across environments.

5. **Write reusable modules with clear interfaces.** Define explicit `variable` inputs with types, validation, and descriptions. Expose intentional `output` values. Version modules with Git tags or a registry.

6. **Run `terraform plan` in CI on every PR.** Post the plan output as a PR comment so reviewers can assess the blast radius before approving. Apply only on merge to the main branch.

7. **Use `moved` blocks for refactoring.** Rename resources or restructure modules without destroy-and-recreate cycles. Never manually edit state files.

8. **Tag every resource with standard metadata.** Include `Environment`, `Project`, `ManagedBy`, `CostCenter`, and `Owner` tags using `default_tags` in the provider block.

9. **Store secrets in external systems.** Use AWS Secrets Manager, HashiCorp Vault, or SSM Parameter Store. Reference secrets via `data` sources at plan time -- never hardcode them in `.tf` or `.tfvars`.

10. **Enable security scanning in CI.** Integrate Checkov, tfsec/Trivy, or KICS to catch misconfigurations before apply. Cross-ref: [08-security/infrastructure-security/iac-security.md](../../08-security/infrastructure-security/iac-security.md).

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Local state in team environments** | State conflicts, lost infrastructure, no locking | Configure remote backend with state locking from day one |
| **Monolithic root module (1000+ resources)** | Slow plans (10+ minutes), risky blast radius per apply | Split into smaller state files by layer (network, compute, data) |
| **Hardcoded values instead of variables** | No reuse across environments, duplication | Extract variables with validation; use `.tfvars` per environment |
| **Using `count` with dynamic lists** | Removing item at index N recreates all subsequent resources | Replace with `for_each` keyed by stable identifiers |
| **Provisioners for configuration** | Fragile, non-idempotent, hard to debug | Use cloud-init, user_data, or dedicated config management (Ansible) |
| **Wildcard provider versions (`>= 3.0`)** | Breaking changes silently introduced | Pin with `~>` constraint; update intentionally and test |
| **Manual state editing** | Corrupted state, orphaned resources, drift | Use `terraform state mv`, `terraform import`, `moved` blocks |
| **Single workspace for all environments** | Accidental prod changes, shared blast radius | Use directory-based environments with separate state per env |

---

## Enforcement Checklist

- [ ] Remote backend configured with encryption and state locking enabled
- [ ] `required_version` and `required_providers` constraints set in every root module
- [ ] `.terraform.lock.hcl` committed to version control for reproducible provider installs
- [ ] All resources tagged via `default_tags` and resource-level tags
- [ ] `terraform plan` runs automatically on every pull request
- [ ] Plan output posted as PR comment for blast radius review
- [ ] `terraform apply` triggered only on merge to main branch (no manual applies)
- [ ] Modules versioned with semantic tags and consumed via registry or pinned Git refs
- [ ] No secrets in `.tf`, `.tfvars`, or state (use external secret stores)
- [ ] Security scanner (Checkov/tfsec/Trivy) integrated in CI pipeline
- [ ] `prevent_destroy` lifecycle set on critical stateful resources (databases, S3 buckets)
- [ ] State file access restricted via IAM policies (least privilege)
- [ ] Drift detection runs on schedule (daily or weekly) to catch out-of-band changes
- [ ] `terraform fmt` and `terraform validate` enforced as pre-commit hooks
