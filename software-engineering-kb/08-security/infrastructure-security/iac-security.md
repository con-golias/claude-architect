# Infrastructure as Code Security Comprehensive Guide

## Metadata
- **Category**: Infrastructure Security
- **Audience**: DevOps engineers, platform engineers, security engineers
- **Last Updated**: 2026-03-10
- **Complexity**: Advanced
- **Tools Covered**: Checkov, tfsec, Trivy, KICS, Terrascan, OPA, Sentinel, CloudFormation Guard, Kyverno

---

## 1. IaC Security Scanning Tools

Infrastructure as Code (IaC) enables consistent, repeatable infrastructure provisioning.
However, misconfigurations in IaC templates are a leading cause of cloud security
incidents. Static analysis tools detect misconfigurations before deployment.

### 1.1 Checkov

Checkov is a multi-framework IaC scanner supporting Terraform, CloudFormation,
Kubernetes manifests, Dockerfiles, Helm charts, and ARM templates. It includes over
2,000 built-in policies.

```bash
# Install Checkov
pip install checkov

# Scan Terraform directory
checkov -d ./terraform \
  --framework terraform \
  --check HIGH,CRITICAL \
  --output cli json \
  --output-file-path ./results \
  --compact

# Scan a specific file
checkov -f main.tf --framework terraform

# Scan Kubernetes manifests
checkov -d ./k8s-manifests --framework kubernetes

# Scan Dockerfiles
checkov -f Dockerfile --framework dockerfile

# Scan CloudFormation
checkov -d ./cfn-templates --framework cloudformation

# Scan with custom policies
checkov -d ./terraform --external-checks-dir ./custom-policies

# Skip specific checks with justification
checkov -d ./terraform --skip-check CKV_AWS_18,CKV_AWS_19
```

```python
# Custom Checkov policy - require encryption for all S3 buckets
# custom-policies/s3_encryption.py
from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck
from checkov.common.models.enums import CheckCategories, CheckResult

class S3BucketEncryption(BaseResourceCheck):
    def __init__(self):
        name = "Ensure S3 bucket has server-side encryption enabled with KMS CMK"
        id = "CUSTOM_S3_001"
        supported_resources = ["aws_s3_bucket"]
        categories = [CheckCategories.ENCRYPTION]
        super().__init__(name=name, id=id, categories=categories,
                         supported_resources=supported_resources)

    def scan_resource_conf(self, conf):
        # Check for server_side_encryption_configuration
        sse_config = conf.get("server_side_encryption_configuration")
        if sse_config:
            for config in sse_config:
                rules = config.get("rule", [{}])
                for rule in rules:
                    sse = rule.get("apply_server_side_encryption_by_default", [{}])
                    for s in sse:
                        if s.get("sse_algorithm") == ["aws:kms"]:
                            if s.get("kms_master_key_id"):
                                return CheckResult.PASSED
        return CheckResult.FAILED

check = S3BucketEncryption()
```

```yaml
# Custom Checkov policy in YAML format
# custom-policies/require_tags.yaml
metadata:
  id: "CUSTOM_TAG_001"
  name: "Ensure all resources have required tags"
  category: "GENERAL_SECURITY"
  severity: "HIGH"
definition:
  cond_type: "attribute"
  resource_types:
    - "aws_instance"
    - "aws_s3_bucket"
    - "aws_rds_instance"
    - "aws_lambda_function"
  attribute: "tags"
  operator: "exists"
```

### 1.2 tfsec / Trivy (Terraform-focused)

tfsec has been merged into Trivy. Trivy now provides comprehensive IaC scanning
alongside container image and filesystem scanning.

```bash
# Trivy IaC scanning (successor to tfsec)
trivy config ./terraform \
  --severity CRITICAL,HIGH \
  --exit-code 1 \
  --format json \
  --output trivy-iac-results.json

# Trivy with specific scanners
trivy config ./terraform \
  --scanners misconfig \
  --policy ./custom-policies \
  --namespaces custom

# Scan Kubernetes manifests
trivy config ./k8s-manifests \
  --severity CRITICAL,HIGH

# Scan Dockerfiles
trivy config ./Dockerfile \
  --severity CRITICAL,HIGH

# Legacy tfsec command (still works in some installations)
tfsec ./terraform \
  --format json \
  --out results.json \
  --minimum-severity HIGH
```

```yaml
# Custom Trivy policy using Rego
# custom-policies/deny_public_s3.rego
package custom.aws.s3

import future.keywords.in

__rego_metadata__ := {
    "id": "CUSTOM-001",
    "title": "S3 bucket must not be publicly accessible",
    "severity": "CRITICAL",
    "type": "Terraform Security",
}

deny[msg] {
    bucket := input.resource.aws_s3_bucket[name]
    acl := bucket.acl
    acl in ["public-read", "public-read-write", "authenticated-read"]
    msg := sprintf("S3 bucket '%s' has public ACL '%s'", [name, acl])
}
```

### 1.3 KICS (Keeping Infrastructure as Code Secure)

KICS supports Terraform, CloudFormation, Kubernetes, Docker, Ansible, Helm, and
OpenAPI definitions.

```bash
# Run KICS scan
docker run -v $(pwd):/path checkmarx/kics:latest scan \
  -p /path/terraform \
  -o /path/results \
  --report-formats "json,html" \
  --type "Terraform" \
  --fail-on "high,critical" \
  --exclude-queries "S3 Bucket Without Versioning"

# KICS with custom queries
docker run -v $(pwd):/path checkmarx/kics:latest scan \
  -p /path/terraform \
  -q /path/custom-queries \
  -o /path/results
```

### 1.4 Terrascan

```bash
# Terrascan - policy as code for IaC
terrascan scan \
  -i terraform \
  -d ./terraform \
  --severity high \
  --output json \
  --policy-type aws \
  --config-path terrascan-config.toml

# Terrascan with custom policies
terrascan scan \
  -i terraform \
  -d ./terraform \
  -p ./custom-policies
```

### 1.5 CloudFormation Linting and Security

```bash
# cfn-lint - CloudFormation linter
cfn-lint template.yaml \
  --include-checks I \
  --configure-rule E3012:strict=true

# cfn-nag - CloudFormation security analysis
cfn_nag_scan --input-path template.yaml \
  --output-format json \
  --deny-list-path deny_list.yaml
```

```yaml
# cfn-nag deny list - deny_list.yaml
RulesToSuppress:
  - id: W28
    reason: "Explicit resource name required for this use case"
```

---

## 2. Common IaC Misconfigurations

### 2.1 Public S3 Buckets

```hcl
# BAD - Public S3 bucket
resource "aws_s3_bucket" "data" {
  bucket = "my-application-data"
}

resource "aws_s3_bucket_acl" "data" {
  bucket = aws_s3_bucket.data.id
  acl    = "public-read"  # NEVER DO THIS
}

# GOOD - Private S3 bucket with encryption and access logging
resource "aws_s3_bucket" "data" {
  bucket = "my-application-data"
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket = aws_s3_bucket.data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_logging" "data" {
  bucket        = aws_s3_bucket.data.id
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "s3-access-logs/"
}
```

### 2.2 Open Security Groups

```hcl
# BAD - Open security group allowing all traffic
resource "aws_security_group" "web" {
  name = "web-sg"

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]  # NEVER DO THIS
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]  # Overly permissive
  }
}

# GOOD - Restrictive security group
resource "aws_security_group" "web" {
  name_prefix = "web-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for web servers - HTTPS only from ALB"

  ingress {
    description     = "HTTPS from ALB"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "HTTPS outbound"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description     = "Database"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.db.id]
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "web-sg"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
```

### 2.3 Unencrypted Resources

```hcl
# BAD - Unencrypted RDS instance
resource "aws_db_instance" "main" {
  engine         = "postgres"
  instance_class = "db.r5.large"
  # storage_encrypted not set = defaults to false
  # kms_key_id not set = no CMK
}

# GOOD - Encrypted RDS with CMK
resource "aws_db_instance" "main" {
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.r5.large"
  storage_encrypted    = true
  kms_key_id           = aws_kms_key.rds.arn
  deletion_protection  = true
  skip_final_snapshot  = false

  # Enforce TLS for connections
  parameter_group_name = aws_db_parameter_group.enforce_ssl.name

  # Disable public access
  publicly_accessible = false

  # Enable automated backups
  backup_retention_period = 30
  backup_window           = "03:00-04:00"

  # Enable enhanced monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  # Enable Performance Insights
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.rds.arn

  tags = {
    Name        = "production-db"
    Environment = "production"
  }
}

resource "aws_db_parameter_group" "enforce_ssl" {
  family = "postgres15"
  name   = "enforce-ssl"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}
```

### 2.4 Missing Logging

```hcl
# BAD - CloudTrail without log validation or encryption
resource "aws_cloudtrail" "main" {
  name           = "main-trail"
  s3_bucket_name = aws_s3_bucket.trail.id
  # Missing: is_multi_region_trail
  # Missing: enable_log_file_validation
  # Missing: kms_key_id
  # Missing: cloud_watch_logs_group_arn
}

# GOOD - CloudTrail with full security configuration
resource "aws_cloudtrail" "main" {
  name                          = "organization-trail"
  s3_bucket_name                = aws_s3_bucket.trail.id
  s3_key_prefix                 = "cloudtrail"
  is_multi_region_trail         = true
  is_organization_trail         = true
  enable_log_file_validation    = true
  kms_key_id                    = aws_kms_key.cloudtrail.arn
  include_global_service_events = true
  cloud_watch_logs_group_arn    = "${aws_cloudwatch_log_group.trail.arn}:*"
  cloud_watch_logs_role_arn     = aws_iam_role.cloudtrail_cloudwatch.arn

  event_selector {
    read_write_type           = "All"
    include_management_events = true

    data_resource {
      type   = "AWS::S3::Object"
      values = ["arn:aws:s3"]
    }

    data_resource {
      type   = "AWS::Lambda::Function"
      values = ["arn:aws:lambda"]
    }
  }

  insight_selectors {
    insight_type = "ApiCallRateInsight"
  }

  insight_selectors {
    insight_type = "ApiErrorRateInsight"
  }

  tags = {
    Name        = "organization-trail"
    Environment = "security"
  }
}
```

### 2.5 Overly Permissive IAM

```hcl
# BAD - Wildcard IAM policy
resource "aws_iam_role_policy" "app" {
  name = "app-policy"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "*"         # NEVER use wildcard actions
        Resource = "*"         # NEVER use wildcard resources
      }
    ]
  })
}

# GOOD - Least privilege IAM policy
resource "aws_iam_role_policy" "app" {
  name = "app-policy"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadS3AppBucket"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.app_data.arn,
          "${aws_s3_bucket.app_data.arn}/*"
        ]
      },
      {
        Sid    = "WriteCloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.app.arn}:*"
      },
      {
        Sid    = "ReadSecretsManager"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.app.arn
        Condition = {
          StringEquals = {
            "secretsmanager:ResourceTag/Application" = "my-app"
          }
        }
      }
    ]
  })
}
```

---

## 3. Policy-as-Code

### 3.1 OPA (Open Policy Agent) with Rego

```rego
# Terraform plan validation using OPA
# policy/terraform/security.rego
package terraform.security

import future.keywords.in

# Deny public S3 buckets
deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_s3_bucket_acl"
    resource.change.after.acl in ["public-read", "public-read-write"]
    msg := sprintf("S3 bucket ACL '%s' is public: %s", [resource.address, resource.change.after.acl])
}

# Deny security groups with 0.0.0.0/0 ingress
deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_security_group"
    ingress := resource.change.after.ingress[_]
    cidr := ingress.cidr_blocks[_]
    cidr == "0.0.0.0/0"
    msg := sprintf("Security group '%s' allows ingress from 0.0.0.0/0 on port %d", [resource.address, ingress.from_port])
}

# Deny unencrypted RDS instances
deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_db_instance"
    not resource.change.after.storage_encrypted
    msg := sprintf("RDS instance '%s' does not have encryption enabled", [resource.address])
}

# Deny IAM policies with wildcard actions
deny[msg] {
    resource := input.resource_changes[_]
    resource.type in ["aws_iam_role_policy", "aws_iam_policy"]
    policy := json.unmarshal(resource.change.after.policy)
    statement := policy.Statement[_]
    statement.Effect == "Allow"
    action := statement.Action
    action == "*"
    msg := sprintf("IAM policy '%s' uses wildcard action '*'", [resource.address])
}

# Require specific tags on all taggable resources
deny[msg] {
    resource := input.resource_changes[_]
    resource.change.actions[_] in ["create", "update"]
    taggable_types := {
        "aws_instance", "aws_s3_bucket", "aws_rds_instance",
        "aws_lambda_function", "aws_ecs_service"
    }
    resource.type in taggable_types
    required_tags := {"Environment", "Owner", "Application", "ManagedBy"}
    tags := object.get(resource.change.after, "tags", {})
    missing := required_tags - {key | tags[key]}
    count(missing) > 0
    msg := sprintf("Resource '%s' is missing required tags: %v", [resource.address, missing])
}
```

```bash
# Integrate OPA with Terraform in CI/CD
# Step 1: Generate Terraform plan in JSON format
terraform plan -out=tfplan
terraform show -json tfplan > tfplan.json

# Step 2: Evaluate plan against OPA policies
opa eval \
  --data policy/terraform/ \
  --input tfplan.json \
  --format pretty \
  'data.terraform.security.deny'

# Step 3: Fail pipeline if violations found
VIOLATIONS=$(opa eval \
  --data policy/terraform/ \
  --input tfplan.json \
  --format json \
  'data.terraform.security.deny' | jq '.result[0].expressions[0].value | length')

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "POLICY VIOLATION: $VIOLATIONS violations found"
  exit 1
fi
```

### 3.2 HashiCorp Sentinel

```python
# Sentinel policy - enforce encryption on all AWS resources
# policies/enforce-encryption.sentinel

import "tfplan/v2" as tfplan

# Get all AWS resources that support encryption
encrypted_resources = filter tfplan.resource_changes as _, rc {
    rc.type in [
        "aws_db_instance",
        "aws_rds_cluster",
        "aws_ebs_volume",
        "aws_efs_file_system",
        "aws_s3_bucket",
    ] and
    rc.mode is "managed" and
    (rc.change.actions contains "create" or rc.change.actions contains "update")
}

# Validate that all resources have encryption enabled
encryption_check = rule {
    all encrypted_resources as _, rc {
        rc.change.after.storage_encrypted is true or
        rc.change.after.encrypted is true
    }
}

# Validate that CMK is used (not just default encryption)
cmk_check = rule {
    all encrypted_resources as _, rc {
        rc.change.after.kms_key_id is not null and
        rc.change.after.kms_key_id is not ""
    }
}

# Main rule
main = rule {
    encryption_check and cmk_check
}
```

### 3.3 AWS CloudFormation Guard

```
# CloudFormation Guard rules
# rules/s3-security.guard

# Rule: All S3 buckets must have encryption
rule s3_bucket_encryption when resourceType == "AWS::S3::Bucket" {
    Properties.BucketEncryption.ServerSideEncryptionConfiguration[*] {
        ServerSideEncryptionByDefault.SSEAlgorithm == "aws:kms"
        ServerSideEncryptionByDefault.KMSMasterKeyID exists
    }
}

# Rule: All S3 buckets must have versioning enabled
rule s3_bucket_versioning when resourceType == "AWS::S3::Bucket" {
    Properties.VersioningConfiguration.Status == "Enabled"
}

# Rule: All S3 buckets must block public access
rule s3_bucket_public_access when resourceType == "AWS::S3::Bucket" {
    Properties.PublicAccessBlockConfiguration exists
    Properties.PublicAccessBlockConfiguration {
        BlockPublicAcls == true
        BlockPublicPolicy == true
        IgnorePublicAcls == true
        RestrictPublicBuckets == true
    }
}

# Rule: All S3 buckets must have access logging
rule s3_bucket_logging when resourceType == "AWS::S3::Bucket" {
    Properties.LoggingConfiguration exists
    Properties.LoggingConfiguration.DestinationBucketName exists
}

# Rule: Security groups must not allow 0.0.0.0/0 ingress
rule sg_no_open_ingress when resourceType == "AWS::EC2::SecurityGroup" {
    Properties.SecurityGroupIngress[*] {
        CidrIp != "0.0.0.0/0"
        CidrIpv6 != "::/0"
    }
}
```

```bash
# Run CloudFormation Guard
cfn-guard validate \
  --data template.yaml \
  --rules rules/s3-security.guard \
  --output-format json \
  --show-summary all
```

### 3.4 Kyverno for Kubernetes IaC

```yaml
# Kyverno policy - enforce labels on all resources
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-labels
  annotations:
    policies.kyverno.io/severity: high
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: require-team-label
      match:
        any:
          - resources:
              kinds:
                - Deployment
                - StatefulSet
                - DaemonSet
                - Service
      validate:
        message: "All resources must have 'team' and 'app' labels."
        pattern:
          metadata:
            labels:
              team: "?*"
              app: "?*"

    - name: require-resource-limits
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "All containers must have resource requests and limits."
        pattern:
          spec:
            containers:
              - resources:
                  requests:
                    memory: "?*"
                    cpu: "?*"
                  limits:
                    memory: "?*"
                    cpu: "?*"
```

---

## 4. Drift Detection

Configuration drift occurs when the actual state of infrastructure diverges from the
declared state in IaC. Drift introduces untracked changes that bypass security policies.

### 4.1 Terraform Plan for Drift Detection

```bash
# Detect drift by running terraform plan with no changes intended
terraform plan -detailed-exitcode -out=drift-check.tfplan

# Exit codes:
# 0 = No changes (no drift)
# 1 = Error
# 2 = Changes detected (drift exists)

# Automate drift detection in CI/CD
if terraform plan -detailed-exitcode -out=drift.tfplan 2>&1; then
  echo "No drift detected"
else
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 2 ]; then
    echo "DRIFT DETECTED - infrastructure has diverged from IaC"
    terraform show drift.tfplan
    # Send alert to security team
    exit 1
  else
    echo "Error running terraform plan"
    exit 1
  fi
fi
```

### 4.2 Dedicated Drift Detection Tools

```bash
# driftctl (now part of Snyk) - detect unmanaged cloud resources
driftctl scan \
  --from tfstate://terraform.tfstate \
  --to aws+tf \
  --output json://drift-report.json

# The report shows:
# - Managed resources (in IaC and in cloud)
# - Unmanaged resources (in cloud but NOT in IaC) <-- security risk
# - Missing resources (in IaC but NOT in cloud)
```

---

## 5. Secrets in IaC

### 5.1 Never Hardcode Secrets

```hcl
# BAD - Hardcoded secrets in Terraform
resource "aws_db_instance" "main" {
  username = "admin"
  password = "SuperSecret123!"  # NEVER hardcode passwords
}

# BAD - Secrets in terraform.tfvars committed to git
# terraform.tfvars
# db_password = "SuperSecret123!"

# GOOD - Reference secrets from a secrets manager
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "production/database/master-password"
}

resource "aws_db_instance" "main" {
  username = "admin"
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
}

# GOOD - Use SSM Parameter Store
data "aws_ssm_parameter" "db_password" {
  name            = "/production/database/password"
  with_decryption = true
}

resource "aws_db_instance" "main" {
  username = "admin"
  password = data.aws_ssm_parameter.db_password.value
}

# GOOD - Use random password generation with secrets manager storage
resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "aws_secretsmanager_secret" "db_password" {
  name       = "production/database/master-password"
  kms_key_id = aws_kms_key.secrets.arn
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

resource "aws_db_instance" "main" {
  username = "admin"
  password = random_password.db_password.result

  lifecycle {
    ignore_changes = [password]  # Password managed externally after creation
  }
}
```

### 5.2 Detect Secrets in IaC Files

```bash
# Use git-secrets to prevent committing secrets
git secrets --install
git secrets --register-aws

# Pre-commit hook configuration - .pre-commit-config.yaml
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  - repo: https://github.com/trufflesecurity/trufflehog
    rev: v3.63.0
    hooks:
      - id: trufflehog
        args: ['--only-verified']
```

---

## 6. State File Security

Terraform state files contain the full configuration of managed resources, including
sensitive values like database passwords, access keys, and certificates.

### 6.1 Encrypted Remote Backend

```hcl
# Terraform backend configuration - encrypted S3 with DynamoDB locking
terraform {
  backend "s3" {
    bucket         = "my-terraform-state-prod"
    key            = "production/infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    kms_key_id     = "arn:aws:kms:us-east-1:123456789012:key/my-key-id"
    dynamodb_table = "terraform-state-lock"
    acl            = "private"
  }
}

# State bucket security
resource "aws_s3_bucket" "terraform_state" {
  bucket = "my-terraform-state-prod"

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
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.terraform_state.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Restrict access to state bucket
resource "aws_s3_bucket_policy" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyUnencryptedPut"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.terraform_state.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      },
      {
        Sid       = "DenyNonSSLAccess"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          aws_s3_bucket.terraform_state.arn,
          "${aws_s3_bucket.terraform_state.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}
```

---

## 7. Module Security

### 7.1 Pin Module Versions

```hcl
# BAD - Unpinned module source
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  # No version constraint = always latest (supply chain risk)
}

# BAD - Using a branch reference
module "vpc" {
  source = "git::https://github.com/org/modules.git//vpc?ref=main"
}

# GOOD - Pinned to specific version
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.1"  # Pin to exact version
}

# GOOD - Pinned to specific commit SHA
module "vpc" {
  source = "git::https://github.com/org/modules.git//vpc?ref=abc123def456"
}

# GOOD - Use version constraints
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.5"  # Allow patch updates only
}
```

### 7.2 Private Module Registry

```hcl
# Use private Terraform registry for internal modules
module "app_infrastructure" {
  source  = "app.terraform.io/my-org/app-infrastructure/aws"
  version = "2.1.0"

  environment = "production"
  vpc_id      = module.vpc.vpc_id
}
```

---

## 8. GitOps Security

### 8.1 PR-Based Approval Workflow

```yaml
# GitHub Actions workflow for Terraform with security gates
name: Terraform Security Pipeline

on:
  pull_request:
    paths:
      - 'terraform/**'

permissions:
  contents: read
  pull-requests: write
  id-token: write

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Checkov
        uses: bridgecrewio/checkov-action@v12
        with:
          directory: terraform/
          framework: terraform
          output_format: sarif
          soft_fail: false
          check: HIGH,CRITICAL

      - name: Run Trivy IaC scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: config
          scan-ref: terraform/
          severity: CRITICAL,HIGH
          exit-code: 1

      - name: Run tflint
        uses: terraform-linters/setup-tflint@v4
      - run: |
          cd terraform && tflint --init && tflint --minimum-failure-severity=warning

  terraform-plan:
    needs: security-scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsTerraform
          aws-region: us-east-1

      - name: Terraform Init
        run: terraform -chdir=terraform init

      - name: Terraform Plan
        id: plan
        run: |
          terraform -chdir=terraform plan \
            -out=tfplan \
            -detailed-exitcode \
            -no-color 2>&1 | tee plan-output.txt

      - name: OPA Policy Check
        run: |
          terraform -chdir=terraform show -json tfplan > tfplan.json
          opa eval \
            --data policies/ \
            --input tfplan.json \
            --format pretty \
            'data.terraform.security.deny'

      - name: Post Plan to PR
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync('plan-output.txt', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Terraform Plan\n\`\`\`\n${plan.substring(0, 60000)}\n\`\`\``
            });

  terraform-apply:
    needs: terraform-plan
    runs-on: ubuntu-latest
    if: github.event.pull_request.merged == true
    environment: production  # Requires approval
    steps:
      - uses: actions/checkout@v4
      - name: Terraform Apply
        run: terraform -chdir=terraform apply -auto-approve tfplan
```

### 8.2 Branch Protection

```yaml
# GitHub branch protection rules (configured via API or UI)
# Protect the main branch for IaC repositories
branch_protection:
  branch: main
  rules:
    require_pull_request_reviews:
      required_approving_review_count: 2
      dismiss_stale_reviews: true
      require_code_owner_reviews: true
    required_status_checks:
      strict: true
      contexts:
        - "security-scan"
        - "terraform-plan"
        - "opa-policy-check"
    enforce_admins: true
    require_signed_commits: true
    allow_force_pushes: false
    allow_deletions: false
```

---

## 9. CI Integration

```yaml
# GitLab CI pipeline for IaC security scanning
stages:
  - validate
  - security
  - plan
  - apply

checkov:
  stage: security
  image: bridgecrew/checkov:latest
  script:
    - checkov -d ./terraform
      --framework terraform
      --check CRITICAL,HIGH
      --output cli junitxml
      --output-file-path ./results
      --compact
  artifacts:
    reports:
      junit: results/results_junitxml.xml
    when: always

trivy-iac:
  stage: security
  image: aquasec/trivy:latest
  script:
    - trivy config ./terraform
      --severity CRITICAL,HIGH
      --exit-code 1
      --format json
      --output trivy-results.json
  artifacts:
    paths:
      - trivy-results.json
    when: always

opa-check:
  stage: security
  image: openpolicyagent/opa:latest
  script:
    - terraform -chdir=terraform show -json tfplan > plan.json
    - |
      VIOLATIONS=$(opa eval \
        --data policies/ \
        --input plan.json \
        --format json \
        'data.terraform.security.deny' | jq '.result[0].expressions[0].value | length')
      if [ "$VIOLATIONS" -gt 0 ]; then
        echo "Policy violations found: $VIOLATIONS"
        exit 1
      fi

secret-scan:
  stage: security
  image: zricethezav/gitleaks:latest
  script:
    - gitleaks detect --source . --verbose --report-format json --report-path gitleaks.json
  artifacts:
    paths:
      - gitleaks.json
    when: always
```

---

## 10. Best Practices

1. **Scan IaC templates before every deployment** -- integrate Checkov, Trivy, or KICS
   into CI/CD pipelines with automatic failure on critical and high-severity findings;
   never deploy unscanned infrastructure.

2. **Implement Policy-as-Code with OPA or Sentinel** -- define security policies in
   code (Rego, Sentinel, Guard) and evaluate Terraform plans against them before
   applying; policies should cover encryption, network access, IAM, and tagging.

3. **Never hardcode secrets in IaC files** -- use data sources to reference secrets
   from AWS Secrets Manager, SSM Parameter Store, HashiCorp Vault, or GCP Secret
   Manager; mark sensitive variables with `sensitive = true` in Terraform.

4. **Secure state files with encryption and access controls** -- store Terraform state
   in encrypted remote backends (S3 with KMS, GCS with CMEK); restrict access to state
   files to only CI/CD pipelines and authorized operators.

5. **Pin module and provider versions** -- use exact version constraints or commit SHAs
   for all module sources; use a private module registry for internal modules; review
   module updates before adopting new versions.

6. **Implement drift detection** -- run scheduled `terraform plan` operations to detect
   configuration drift; alert the security team when drift is detected; prohibit manual
   console changes.

7. **Require PR reviews for all IaC changes** -- enforce branch protection with required
   reviewers, status checks (security scan, plan output), and signed commits; post
   Terraform plan output as PR comments for review.

8. **Use pre-commit hooks for local validation** -- install pre-commit hooks that run
   `terraform fmt`, `terraform validate`, secret scanning, and basic policy checks
   before code reaches the repository.

9. **Separate IaC repositories by environment and sensitivity** -- use different
   repositories or directories for production and non-production infrastructure; apply
   stricter review requirements for production changes.

10. **Audit and log all IaC operations** -- log every `terraform plan`, `apply`, and
    `destroy` operation with the identity of the operator, timestamp, and changed
    resources; retain audit logs for compliance.

---

## 11. Anti-Patterns

1. **Running terraform apply locally from developer workstations** -- this bypasses
   all security gates (scanning, policy checks, peer review); all applies should go
   through the CI/CD pipeline with proper approvals.

2. **Committing terraform.tfstate to git** -- state files contain sensitive data
   including passwords, keys, and resource configurations; use encrypted remote
   backends exclusively.

3. **Using wildcard (*) in IAM policies defined in IaC** -- wildcard actions and
   resources violate least privilege; define exact actions and resource ARNs for every
   IAM policy.

4. **Hardcoding secrets in variable defaults or tfvars** -- even if the repository is
   private, secrets should never exist in code; use dynamic references to secrets
   managers.

5. **Disabling security scanning to "speed up" pipelines** -- the time cost of
   scanning (typically 1-3 minutes) is negligible compared to the cost of deploying a
   misconfigured resource; never disable or skip security checks.

6. **Using unpinned module versions from public registries** -- unpinned modules can
   receive malicious updates; a supply chain attack on a popular module would affect
   all users; always pin versions.

7. **Granting CI/CD pipelines administrator access** -- pipeline service accounts
   should have the minimum permissions needed to manage the specific resources
   defined in the IaC; use separate roles for different resource types.

8. **Ignoring scan findings and adding blanket suppressions** -- suppressing security
   findings without remediation defeats the purpose of scanning; every suppression
   should be documented with a risk acceptance and reviewed periodically.

---

## 12. Enforcement Checklist

### Scanning and Validation
- [ ] Checkov, Trivy, or KICS runs on every PR with automatic failure on CRITICAL/HIGH
- [ ] Custom policies cover organization-specific security requirements
- [ ] Pre-commit hooks run terraform fmt, validate, and secret scanning locally
- [ ] Scanning results are visible in PR comments and review UI

### Policy-as-Code
- [ ] OPA, Sentinel, or Guard policies enforce encryption, IAM, and network rules
- [ ] Terraform plan output is evaluated against policies before apply
- [ ] Policies are version-controlled and reviewed like application code
- [ ] Policy violations block deployment automatically

### Secrets Management
- [ ] No hardcoded secrets in any IaC files (enforced by scanning)
- [ ] All secrets referenced via data sources from secrets managers
- [ ] Secret scanning (gitleaks, detect-secrets) runs in pre-commit and CI
- [ ] Terraform variables containing secrets are marked as sensitive

### State File Security
- [ ] State files are stored in encrypted remote backends
- [ ] State file access is restricted to CI/CD service accounts
- [ ] State file bucket has versioning, logging, and public access block enabled
- [ ] State locking is enabled (DynamoDB for AWS, GCS for GCP)

### GitOps and Workflow
- [ ] Branch protection requires 2+ approvals for production IaC changes
- [ ] Required status checks include security scan and policy check
- [ ] Terraform plan output is posted to PR for reviewer visibility
- [ ] Only CI/CD pipelines can run terraform apply (no local applies)
- [ ] All IaC operations are logged with operator identity and timestamp

### Drift Detection
- [ ] Scheduled terraform plan runs detect configuration drift
- [ ] Drift alerts are sent to the security and operations teams
- [ ] Manual console changes are prohibited by organization policy
- [ ] Unmanaged cloud resources are identified and brought under IaC management
