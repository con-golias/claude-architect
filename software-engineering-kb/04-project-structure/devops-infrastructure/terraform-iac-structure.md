# Terraform / Infrastructure as Code Structure

> **AI Plugin Directive:** When organizing Terraform or OpenTofu infrastructure code, ALWAYS use this guide. Apply module-based organization, remote state, environment separation with workspaces or directory-based isolation, and proper variable management. This guide covers production-grade IaC project structure.

**Core Rule: Organize Terraform by ENVIRONMENT and MODULE. Use remote state with locking. Pin provider and module versions. NEVER hardcode values — use variables and tfvars files. Keep modules small, composable, and reusable.**

---

## 1. Project Structure (Environment Directories)

```
infrastructure/
├── modules/                               # Reusable Terraform modules
│   ├── networking/
│   │   ├── main.tf                        # VPC, subnets, NAT gateway
│   │   ├── variables.tf                   # Input variables
│   │   ├── outputs.tf                     # Output values
│   │   └── README.md
│   ├── database/
│   │   ├── main.tf                        # RDS, ElastiCache
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── compute/
│   │   ├── main.tf                        # ECS, EKS, EC2
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── cdn/
│   │   ├── main.tf                        # CloudFront, S3 static hosting
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── monitoring/
│       ├── main.tf                        # CloudWatch, alerts
│       ├── variables.tf
│       └── outputs.tf
│
├── environments/                          # Per-environment configurations
│   ├── dev/
│   │   ├── main.tf                        # Module calls with dev params
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── terraform.tfvars               # Dev-specific values
│   │   ├── backend.tf                     # Remote state config
│   │   └── providers.tf                   # Provider versions
│   ├── staging/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── terraform.tfvars
│   │   ├── backend.tf
│   │   └── providers.tf
│   └── production/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       ├── terraform.tfvars
│       ├── backend.tf
│       └── providers.tf
│
├── global/                                # Resources shared across environments
│   ├── iam/
│   │   ├── main.tf                        # IAM roles, policies
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── dns/
│   │   ├── main.tf                        # Route53 zones
│   │   └── outputs.tf
│   └── state-backend/
│       └── main.tf                        # S3 bucket + DynamoDB for state
│
├── .terraform.lock.hcl                    # Provider lock file (COMMITTED)
├── .gitignore
└── README.md
```

---

## 2. File Conventions

```
Standard files per directory:

main.tf        → Resource and module definitions
variables.tf   → Input variable declarations
outputs.tf     → Output value declarations
providers.tf   → Provider configuration and version constraints
backend.tf     → Remote state backend configuration
terraform.tfvars → Variable values (environment-specific)
locals.tf      → Local values and computed expressions
data.tf        → Data sources (existing resources)
versions.tf    → Alternative: terraform and provider versions

NEVER put everything in one file.
Split by responsibility, NOT by resource type.
```

---

## 3. Module Design

```hcl
# modules/networking/main.tf

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, {
    Name = "${var.project}-${var.environment}-vpc"
  })
}

resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone = var.availability_zones[count.index]

  tags = merge(var.tags, {
    Name = "${var.project}-${var.environment}-private-${count.index + 1}"
    Type = "private"
  })
}

resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index + length(var.availability_zones))
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${var.project}-${var.environment}-public-${count.index + 1}"
    Type = "public"
  })
}
```

```hcl
# modules/networking/variables.tf

variable "project" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
```

```hcl
# modules/networking/outputs.tf

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = aws_subnet.public[*].id
}
```

---

## 4. Environment Configuration

```hcl
# environments/production/main.tf

module "networking" {
  source = "../../modules/networking"

  project            = var.project
  environment        = var.environment
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  tags               = local.common_tags
}

module "database" {
  source = "../../modules/database"

  project           = var.project
  environment       = var.environment
  vpc_id            = module.networking.vpc_id
  subnet_ids        = module.networking.private_subnet_ids
  instance_class    = "db.r6g.xlarge"
  multi_az          = true
  backup_retention  = 30
  tags              = local.common_tags
}

module "compute" {
  source = "../../modules/compute"

  project           = var.project
  environment       = var.environment
  vpc_id            = module.networking.vpc_id
  private_subnets   = module.networking.private_subnet_ids
  public_subnets    = module.networking.public_subnet_ids
  min_capacity      = 3
  max_capacity      = 20
  tags              = local.common_tags
}
```

```hcl
# environments/production/backend.tf

terraform {
  backend "s3" {
    bucket         = "myorg-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

```hcl
# environments/production/providers.tf

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}
```

```hcl
# environments/production/terraform.tfvars

project     = "my-app"
environment = "production"
aws_region  = "us-east-1"
```

---

## 5. Remote State

```
Remote state rules:

1. ALWAYS use remote state for team projects
   - S3 + DynamoDB (AWS)
   - GCS + Cloud Storage (GCP)
   - Azure Blob Storage (Azure)
   - Terraform Cloud

2. ALWAYS enable state locking
   - Prevents concurrent modifications
   - DynamoDB for S3 backend
   - Built-in for GCS and Azure

3. ALWAYS encrypt state at rest
   - State contains sensitive values
   - Enable bucket encryption

4. NEVER commit .tfstate to Git
   - Contains secrets in plaintext
   - .gitignore MUST include *.tfstate*

5. Separate state per environment
   - production/terraform.tfstate
   - staging/terraform.tfstate
   - dev/terraform.tfstate
```

```hcl
# global/state-backend/main.tf — Bootstrap state backend

resource "aws_s3_bucket" "terraform_state" {
  bucket = "myorg-terraform-state"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}
```

---

## 6. .gitignore for Terraform

```
# .gitignore

# State files (NEVER commit)
*.tfstate
*.tfstate.*
.terraform/

# Crash log files
crash.log
crash.*.log

# Sensitive variable files
*.tfvars.json
override.tf
override.tf.json
*_override.tf
*_override.tf.json

# CLI configuration (personal)
.terraformrc
terraform.rc

# Lock file — DO commit this
# !.terraform.lock.hcl    ← This line is NOT needed, just don't gitignore it
```

---

## 7. Workspaces vs Directories

```
Two approaches for environment isolation:

APPROACH 1: Directory-based (RECOMMENDED)
  environments/
  ├── dev/       ← terraform apply here
  ├── staging/   ← terraform apply here
  └── production/ ← terraform apply here

  ✅ Clear separation, different backends
  ✅ Can have different module versions per env
  ✅ Easy to reason about
  ❌ Some code duplication

APPROACH 2: Terraform Workspaces
  infrastructure/
  ├── main.tf
  ├── dev.tfvars
  ├── staging.tfvars
  └── production.tfvars

  terraform workspace select production
  terraform apply -var-file=production.tfvars

  ✅ Less code duplication
  ❌ Shared state backend (risky)
  ❌ Easy to accidentally apply to wrong workspace
  ❌ Hard to have different provider versions

ALWAYS use directory-based for production systems.
Workspaces are acceptable for simple projects with < 20 resources.
```

---

## 8. CI/CD Pipeline

```yaml
# .github/workflows/terraform.yml
name: Terraform

on:
  pull_request:
    paths: ["infrastructure/**"]
  push:
    branches: [main]
    paths: ["infrastructure/**"]

env:
  TF_VERSION: "1.7.0"

jobs:
  plan:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [dev, staging, production]
    defaults:
      run:
        working-directory: infrastructure/environments/${{ matrix.environment }}
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Terraform Init
        run: terraform init

      - name: Terraform Validate
        run: terraform validate

      - name: Terraform Plan
        run: terraform plan -out=tfplan
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

      - name: Comment PR with Plan
        if: github.event_name == 'pull_request'
        uses: borchero/terraform-plan-comment@v2
        with:
          working-directory: infrastructure/environments/${{ matrix.environment }}

  apply:
    needs: plan
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production                  # Requires manual approval
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init && terraform apply -auto-approve
        working-directory: infrastructure/environments/production
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Local state | State only on one machine | Remote state with S3/GCS |
| No state locking | Concurrent applies corrupt state | DynamoDB lock table |
| Hardcoded values | Can't reuse across environments | Variables + tfvars |
| Monolithic main.tf | 1000+ line file | Split into modules |
| No version pinning | Provider updates break infra | Pin `~> 5.40` in required_providers |
| Secrets in tfvars | Credentials in Git | Use secrets manager, environment variables |
| No `prevent_destroy` | Accidental deletion of databases | Lifecycle rule on critical resources |
| `terraform apply` without plan | Unexpected changes | ALWAYS plan first, review, then apply |
| No CI/CD pipeline | Manual, error-prone deploys | GitHub Actions with plan on PR, apply on merge |
| Workspaces for prod | Risk of wrong workspace | Directory-based isolation |

---

## 10. Enforcement Checklist

- [ ] Remote state — S3/GCS with locking, NEVER local
- [ ] Environment isolation — directory-based, NOT workspaces
- [ ] Provider versions pinned — `~>` constraint in providers.tf
- [ ] `.terraform.lock.hcl` committed — reproducible provider installs
- [ ] `.tfstate` gitignored — NEVER committed
- [ ] Modules for reusable infrastructure — DRY, composable
- [ ] Variables for ALL environment-specific values — NO hardcoding
- [ ] `prevent_destroy` on stateful resources — databases, S3 buckets
- [ ] CI pipeline — plan on PR, apply on merge to main
- [ ] State encryption — at rest in backend
- [ ] Tagging strategy — project, environment, managed-by on ALL resources
- [ ] README per module — inputs, outputs, usage examples
