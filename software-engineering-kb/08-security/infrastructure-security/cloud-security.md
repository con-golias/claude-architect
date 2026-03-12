# Cloud Security Comprehensive Guide

## Metadata
- **Category**: Infrastructure Security
- **Audience**: Cloud architects, DevOps engineers, security engineers
- **Last Updated**: 2026-03-10
- **Complexity**: Advanced
- **Providers Covered**: AWS, GCP, Azure

---

## 1. Shared Responsibility Model

The shared responsibility model defines which security obligations belong to the cloud
provider and which belong to the customer. Misunderstanding this boundary is the root
cause of most cloud security incidents.

### 1.1 IaaS (Infrastructure as a Service)

In IaaS (EC2, GCE, Azure VMs), the provider manages physical security, hypervisor, and
network fabric. The customer is responsible for:

- Operating system patching and hardening
- Network configuration (firewalls, security groups)
- Identity and access management
- Data encryption at rest and in transit
- Application security
- Logging and monitoring

### 1.2 PaaS (Platform as a Service)

In PaaS (AWS Elastic Beanstalk, GCP App Engine, Azure App Service), the provider
additionally manages the runtime, middleware, and OS. The customer is responsible for:

- Application code security
- Data classification and encryption
- Identity and access management
- Application-level logging

### 1.3 SaaS (Software as a Service)

In SaaS (Google Workspace, Microsoft 365, Salesforce), the provider manages nearly
everything. The customer is responsible for:

- Data governance and classification
- User access management
- Configuration of security settings
- Compliance with regulatory requirements

### 1.4 Responsibility Matrix

```
+---------------------------+--------+--------+--------+
| Responsibility            |  IaaS  |  PaaS  |  SaaS  |
+---------------------------+--------+--------+--------+
| Physical Security         | Cloud  | Cloud  | Cloud  |
| Network Infrastructure    | Cloud  | Cloud  | Cloud  |
| Hypervisor                | Cloud  | Cloud  | Cloud  |
| Operating System          | You    | Cloud  | Cloud  |
| Network Controls          | You    | Shared | Cloud  |
| Identity & Access         | You    | You    | You    |
| Application Security      | You    | You    | Cloud  |
| Data Encryption           | You    | You    | Shared |
| Data Classification       | You    | You    | You    |
+---------------------------+--------+--------+--------+
```

---

## 2. Identity and Access Management (IAM) Best Practices

### 2.1 Principle of Least Privilege

Grant only the minimum permissions required for a task. Start with zero permissions and
add incrementally.

```json
// AWS IAM Policy - Least privilege for S3 read-only on specific bucket
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowReadSpecificBucket",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-application-data",
        "arn:aws:s3:::my-application-data/*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "us-east-1"
        }
      }
    }
  ]
}
```

### 2.2 MFA for Root and Privileged Accounts

Enforce MFA on all root accounts and privileged users without exception.

```bash
# AWS CLI - Check if root account has MFA enabled
aws iam get-account-summary --query 'SummaryMap.AccountMFAEnabled'

# List users without MFA
aws iam generate-credential-report
aws iam get-credential-report --output text --query 'Content' | base64 -d | \
  awk -F, '$4 == "true" && $8 == "false" {print $1, "has no MFA"}'
```

### 2.3 Avoid Long-Lived Credentials

Never use static access keys when temporary credentials are available. Use IAM roles,
instance profiles, and workload identity federation instead.

```python
# BAD - Hardcoded long-lived credentials
import boto3
client = boto3.client(
    's3',
    aws_access_key_id='AKIAIOSFODNN7EXAMPLE',      # NEVER DO THIS
    aws_secret_access_key='wJalrXUtnFEMI/K7MDENG...' # NEVER DO THIS
)

# GOOD - Use IAM role attached to the compute resource
import boto3
client = boto3.client('s3')  # SDK auto-discovers credentials from role
```

### 2.4 Use Roles and Service Accounts

```yaml
# AWS - EC2 Instance Profile with role
Resources:
  AppInstanceProfile:
    Type: AWS::IAM::InstanceProfile
    Properties:
      Roles:
        - !Ref AppRole

  AppRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              Service: ec2.amazonaws.com
            Action: "sts:AssumeRole"
      ManagedPolicyArns:
        - arn:aws:iam::policy/AmazonS3ReadOnlyAccess
      MaxSessionDuration: 3600
```

---

## 3. AWS Security

### 3.1 IAM Policies Deep Dive

#### Deny by Default with Explicit Allows

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyAllOutsideApprovedRegions",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:RequestedRegion": [
            "us-east-1",
            "us-west-2",
            "eu-west-1"
          ]
        },
        "ForAllValues:StringNotEquals": {
          "aws:CalledVia": [
            "cloudfront.amazonaws.com"
          ]
        }
      }
    }
  ]
}
```

#### Service Control Policies (SCPs)

SCPs provide guardrails across an entire AWS Organization. They do not grant permissions;
they define the maximum permissions boundary.

```json
// SCP - Prevent disabling CloudTrail, GuardDuty, and Config
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PreventSecurityServiceDisable",
      "Effect": "Deny",
      "Action": [
        "cloudtrail:StopLogging",
        "cloudtrail:DeleteTrail",
        "guardduty:DeleteDetector",
        "guardduty:DisassociateFromMasterAccount",
        "config:StopConfigurationRecorder",
        "config:DeleteConfigurationRecorder"
      ],
      "Resource": "*",
      "Condition": {
        "ArnNotLike": {
          "aws:PrincipalARN": "arn:aws:iam::*:role/SecurityAdmin"
        }
      }
    },
    {
      "Sid": "DenyRootAccountUsage",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "StringLike": {
          "aws:PrincipalArn": "arn:aws:iam::*:root"
        }
      }
    }
  ]
}
```

#### IAM Condition Keys

Use condition keys to restrict access based on contextual information.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EnforceMFAForSensitiveOps",
      "Effect": "Deny",
      "Action": [
        "iam:CreateUser",
        "iam:DeleteUser",
        "iam:AttachUserPolicy",
        "iam:PutUserPolicy"
      ],
      "Resource": "*",
      "Condition": {
        "BoolIfExists": {
          "aws:MultiFactorAuthPresent": "false"
        }
      }
    },
    {
      "Sid": "RestrictBySourceIP",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "NotIpAddress": {
          "aws:SourceIp": [
            "203.0.113.0/24",
            "198.51.100.0/24"
          ]
        },
        "BoolIfExists": {
          "aws:ViaAWSService": "false"
        }
      }
    }
  ]
}
```

### 3.2 Security Groups vs NACLs

Security Groups are stateful, instance-level firewalls. NACLs are stateless,
subnet-level firewalls. Use both for defense in depth.

```hcl
# Terraform - Security Group with minimal access
resource "aws_security_group" "app_sg" {
  name_prefix = "app-"
  vpc_id      = aws_vpc.main.id

  # Allow HTTPS from ALB only
  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
    description     = "HTTPS from ALB"
  }

  # No unrestricted egress - limit to required destinations
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS outbound for API calls"
  }

  egress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.db_sg.id]
    description     = "PostgreSQL to RDS"
  }

  tags = {
    Name = "app-security-group"
  }
}

# NACL - Additional subnet-level protection
resource "aws_network_acl" "private_subnet_nacl" {
  vpc_id     = aws_vpc.main.id
  subnet_ids = [aws_subnet.private.id]

  ingress {
    rule_no    = 100
    protocol   = "tcp"
    action     = "allow"
    cidr_block = "10.0.0.0/16"
    from_port  = 443
    to_port    = 443
  }

  ingress {
    rule_no    = 200
    protocol   = "tcp"
    action     = "allow"
    cidr_block = "10.0.0.0/16"
    from_port  = 1024
    to_port    = 65535
  }

  # Explicit deny all other ingress
  ingress {
    rule_no    = 999
    protocol   = "-1"
    action     = "deny"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  egress {
    rule_no    = 100
    protocol   = "tcp"
    action     = "allow"
    cidr_block = "10.0.0.0/16"
    from_port  = 1024
    to_port    = 65535
  }

  egress {
    rule_no    = 999
    protocol   = "-1"
    action     = "deny"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }
}
```

### 3.3 VPC Design for Security

```hcl
# Terraform - Secure VPC with public, private, and isolated subnets
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "production-vpc"
  }
}

# Public subnet - only for load balancers
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = false  # Never auto-assign public IPs
  availability_zone       = "us-east-1a"
}

# Private subnet - for application workloads
resource "aws_subnet" "private_app" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = "us-east-1a"
}

# Isolated subnet - for databases (no internet access at all)
resource "aws_subnet" "isolated_db" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.100.0/24"
  availability_zone = "us-east-1a"
}

# VPC Flow Logs for network monitoring
resource "aws_flow_log" "vpc_flow_log" {
  iam_role_arn    = aws_iam_role.flow_log_role.arn
  log_destination = aws_cloudwatch_log_group.flow_log.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id

  tags = {
    Name = "vpc-flow-log"
  }
}

# VPC Endpoints - keep traffic within AWS network
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.us-east-1.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowSpecificBucket"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["s3:GetObject", "s3:PutObject"]
        Resource  = ["arn:aws:s3:::my-bucket/*"]
      }
    ]
  })
}
```

### 3.4 AWS Security Services

```bash
# Enable GuardDuty (threat detection)
aws guardduty create-detector \
  --enable \
  --finding-publishing-frequency FIFTEEN_MINUTES \
  --data-sources '{
    "S3Logs": {"Enable": true},
    "Kubernetes": {"AuditLogs": {"Enable": true}},
    "MalwareProtection": {"ScanEc2InstanceWithFindings": {"EbsVolumes": true}}
  }'

# Enable CloudTrail with log file validation
aws cloudtrail create-trail \
  --name organization-trail \
  --s3-bucket-name my-cloudtrail-bucket \
  --is-multi-region-trail \
  --enable-log-file-validation \
  --include-global-service-events \
  --kms-key-id arn:aws:kms:us-east-1:123456789012:key/my-key-id

aws cloudtrail start-logging --name organization-trail

# Enable AWS Config for resource compliance monitoring
aws configservice put-configuration-recorder \
  --configuration-recorder '{
    "name": "default",
    "roleARN": "arn:aws:iam::123456789012:role/ConfigRole",
    "recordingGroup": {
      "allSupported": true,
      "includeGlobalResourceTypes": true
    }
  }'

# AWS Security Hub - aggregate findings
aws securityhub enable-security-hub \
  --enable-default-standards \
  --control-finding-generator SECURITY_CONTROL
```

---

## 4. GCP Security

### 4.1 GCP IAM

GCP IAM uses a resource hierarchy: Organization > Folders > Projects > Resources.
Permissions are inherited downward.

```yaml
# GCP IAM binding with conditions using Terraform
resource "google_project_iam_binding" "app_deployer" {
  project = "my-project-id"
  role    = "roles/run.developer"

  members = [
    "serviceAccount:deployer@my-project-id.iam.gserviceaccount.com",
  ]

  condition {
    title       = "deploy_hours_only"
    description = "Allow deployments only during business hours"
    expression  = "request.time.getHours('America/New_York') >= 9 && request.time.getHours('America/New_York') <= 17"
  }
}
```

### 4.2 Service Accounts and Workload Identity

```yaml
# GCP Workload Identity Federation for GitHub Actions
# Eliminates the need for service account keys entirely

resource "google_iam_workload_identity_pool" "github_pool" {
  project                   = "my-project-id"
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "GitHub Actions Pool"
}

resource "google_iam_workload_identity_pool_provider" "github_provider" {
  project                            = "my-project-id"
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_pool.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository_owner == 'my-org'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Workload Identity for GKE - bind Kubernetes SA to GCP SA
resource "google_service_account_iam_binding" "workload_identity" {
  service_account_id = google_service_account.app_sa.name
  role               = "roles/iam.workloadIdentityUser"

  members = [
    "serviceAccount:my-project-id.svc.id.goog[app-namespace/app-ksa]",
  ]
}
```

### 4.3 VPC Service Controls

```yaml
# VPC Service Controls - create a service perimeter
resource "google_access_context_manager_service_perimeter" "secure_perimeter" {
  parent = "accessPolicies/${var.access_policy_id}"
  name   = "accessPolicies/${var.access_policy_id}/servicePerimeters/secure_perimeter"
  title  = "Production Service Perimeter"

  status {
    restricted_services = [
      "storage.googleapis.com",
      "bigquery.googleapis.com",
      "compute.googleapis.com",
    ]

    resources = [
      "projects/${var.project_number}",
    ]

    access_levels = [
      google_access_context_manager_access_level.corp_network.name,
    ]

    vpc_accessible_services {
      enable_restriction = true
      allowed_services   = ["storage.googleapis.com"]
    }
  }
}
```

### 4.4 GCP Organization Policies

```yaml
# Organization Policy - disable service account key creation
resource "google_organization_policy" "disable_sa_key_creation" {
  org_id     = var.org_id
  constraint = "constraints/iam.disableServiceAccountKeyCreation"

  boolean_policy {
    enforced = true
  }
}

# Organization Policy - restrict VM external IPs
resource "google_organization_policy" "restrict_vm_external_ip" {
  org_id     = var.org_id
  constraint = "constraints/compute.vmExternalIpAccess"

  list_policy {
    deny {
      all = true
    }
  }
}

# Organization Policy - require OS Login
resource "google_organization_policy" "require_os_login" {
  org_id     = var.org_id
  constraint = "constraints/compute.requireOsLogin"

  boolean_policy {
    enforced = true
  }
}
```

---

## 5. Azure Security

### 5.1 Microsoft Entra ID (formerly Azure AD)

```json
// Azure Conditional Access Policy (JSON representation)
{
  "displayName": "Require MFA for all admin roles",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeRoles": [
        "62e90394-69f5-4237-9190-012177145e10",
        "194ae4cb-b126-40b2-bd5b-6091b380977d"
      ]
    },
    "applications": {
      "includeApplications": ["All"]
    },
    "locations": {
      "includeLocations": ["All"],
      "excludeLocations": ["AllTrusted"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["mfa"]
  },
  "sessionControls": {
    "signInFrequency": {
      "value": 4,
      "type": "hours",
      "isEnabled": true
    }
  }
}
```

### 5.2 Azure Network Security Groups (NSGs)

```hcl
# Terraform - Azure NSG with strict rules
resource "azurerm_network_security_group" "app_nsg" {
  name                = "app-nsg"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  security_rule {
    name                       = "AllowHTTPS"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "AzureFrontDoor.Backend"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "DenyAllInbound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}
```

### 5.3 Azure Policy

```json
// Azure Policy - Require encryption on storage accounts
{
  "mode": "Indexed",
  "policyRule": {
    "if": {
      "allOf": [
        {
          "field": "type",
          "equals": "Microsoft.Storage/storageAccounts"
        },
        {
          "field": "Microsoft.Storage/storageAccounts/encryption.services.blob.enabled",
          "notEquals": true
        }
      ]
    },
    "then": {
      "effect": "deny"
    }
  },
  "parameters": {}
}
```

### 5.4 Azure Key Vault

```hcl
# Terraform - Azure Key Vault with RBAC and network restrictions
resource "azurerm_key_vault" "main" {
  name                        = "app-keyvault-prod"
  location                    = azurerm_resource_group.main.location
  resource_group_name         = azurerm_resource_group.main.name
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  sku_name                    = "premium"
  enabled_for_disk_encryption = true
  purge_protection_enabled    = true
  soft_delete_retention_days  = 90
  enable_rbac_authorization   = true

  network_acls {
    default_action             = "Deny"
    bypass                     = "AzureServices"
    ip_rules                   = ["203.0.113.0/24"]
    virtual_network_subnet_ids = [azurerm_subnet.app.id]
  }
}
```

---

## 6. CIS Benchmarks

### 6.1 CIS AWS Foundations Benchmark Key Controls

```bash
# 1.1 - Avoid use of root account
# Check for root account activity in last 90 days
aws iam generate-credential-report
aws iam get-credential-report --output text --query 'Content' | \
  base64 -d | head -1 && \
aws iam get-credential-report --output text --query 'Content' | \
  base64 -d | grep '<root_account>'

# 2.1 - Ensure CloudTrail is enabled in all regions
aws cloudtrail describe-trails --query 'trailList[*].{Name:Name,IsMultiRegion:IsMultiRegionTrail,LogValidation:LogFileValidationEnabled}'

# 2.6 - Ensure S3 bucket access logging is enabled on CloudTrail bucket
aws s3api get-bucket-logging --bucket my-cloudtrail-bucket

# 3.x - Ensure CloudWatch alarms exist for critical events
# Example: alarm for unauthorized API calls
aws cloudwatch put-metric-alarm \
  --alarm-name "UnauthorizedAPICalls" \
  --metric-name "UnauthorizedAPICalls" \
  --namespace "CISBenchmark" \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:security-alerts
```

### 6.2 CIS GCP Foundations Benchmark Key Controls

```bash
# 1.1 - Ensure corporate login credentials are used
gcloud organizations get-iam-policy $ORG_ID --format=json | \
  jq '.bindings[] | select(.members[] | contains("gmail.com"))'

# 1.4 - Ensure service account keys are rotated within 90 days
gcloud iam service-accounts keys list \
  --iam-account=SA_NAME@PROJECT_ID.iam.gserviceaccount.com \
  --format="table(name,validAfterTime,validBeforeTime)"

# 3.1 - Ensure default network does not exist
gcloud compute networks list --filter="name=default"

# 6.1 - Ensure Cloud SQL does not have public IP
gcloud sql instances list --format="table(name,settings.ipConfiguration.ipv4Enabled)"
```

---

## 7. Cloud Security Posture Management (CSPM)

CSPM tools continuously monitor cloud environments for misconfigurations, compliance
violations, and security risks.

### 7.1 CSPM Implementation

```yaml
# Prowler - Open source AWS/GCP/Azure security assessment
# prowler.yaml configuration
config:
  aws:
    regions:
      - us-east-1
      - us-west-2
      - eu-west-1
    checks:
      - iam
      - logging
      - monitoring
      - networking
      - forensics
    severity:
      - critical
      - high
    output:
      - json
      - html
    scan_unused_services: true
    shodan_api_key: ""
```

```bash
# Run Prowler for AWS security assessment
prowler aws \
  --severity critical high \
  --compliance cis_2.0_aws \
  --output-formats json html \
  --output-directory ./prowler-results \
  --region us-east-1 us-west-2

# Run Prowler for GCP
prowler gcp \
  --project-id my-project-id \
  --severity critical high \
  --compliance cis_2.0_gcp

# ScoutSuite - Multi-cloud security auditing
scout aws --profile production --report-dir ./scout-results
scout gcp --project-id my-project-id
scout azure --cli
```

### 7.2 Custom CSPM Rules

```python
# Custom Python script for continuous cloud security monitoring
import boto3
from datetime import datetime, timedelta

def check_public_s3_buckets():
    """Identify S3 buckets with public access enabled."""
    s3 = boto3.client('s3')
    findings = []

    for bucket in s3.list_buckets()['Buckets']:
        bucket_name = bucket['Name']
        try:
            public_access = s3.get_public_access_block(Bucket=bucket_name)
            config = public_access['PublicAccessBlockConfiguration']

            if not all([
                config['BlockPublicAcls'],
                config['IgnorePublicAcls'],
                config['BlockPublicPolicy'],
                config['RestrictPublicBuckets']
            ]):
                findings.append({
                    'resource': bucket_name,
                    'severity': 'CRITICAL',
                    'finding': 'S3 bucket has public access block disabled',
                    'remediation': 'Enable all public access block settings'
                })
        except s3.exceptions.NoSuchPublicAccessBlockConfiguration:
            findings.append({
                'resource': bucket_name,
                'severity': 'CRITICAL',
                'finding': 'S3 bucket has no public access block configuration',
                'remediation': 'Apply public access block configuration'
            })

    return findings


def check_unencrypted_ebs_volumes():
    """Identify EBS volumes without encryption."""
    ec2 = boto3.client('ec2')
    findings = []

    volumes = ec2.describe_volumes(
        Filters=[{'Name': 'encrypted', 'Values': ['false']}]
    )

    for volume in volumes['Volumes']:
        findings.append({
            'resource': volume['VolumeId'],
            'severity': 'HIGH',
            'finding': 'EBS volume is not encrypted',
            'remediation': 'Create encrypted snapshot and replace volume'
        })

    return findings


def check_old_access_keys():
    """Identify access keys older than 90 days."""
    iam = boto3.client('iam')
    findings = []
    threshold = datetime.now(tz=None) - timedelta(days=90)

    for user in iam.list_users()['Users']:
        keys = iam.list_access_keys(UserName=user['UserName'])
        for key in keys['AccessKeyMetadata']:
            if key['CreateDate'].replace(tzinfo=None) < threshold:
                findings.append({
                    'resource': f"{user['UserName']}/{key['AccessKeyId']}",
                    'severity': 'HIGH',
                    'finding': f"Access key is older than 90 days",
                    'remediation': 'Rotate or delete the access key'
                })

    return findings
```

---

## 8. Multi-Cloud Security Strategy

### 8.1 Unified Identity Management

```yaml
# Multi-cloud identity federation architecture
# Use a single identity provider (IdP) across all clouds

# Terraform - Federate Okta with AWS, GCP, and Azure
# AWS SAML Provider
resource "aws_iam_saml_provider" "okta" {
  name                   = "Okta"
  saml_metadata_document = file("okta-metadata.xml")
}

resource "aws_iam_role" "okta_admin" {
  name = "OktaAdminRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_saml_provider.okta.arn
        }
        Action = "sts:AssumeRoleWithSAML"
        Condition = {
          StringEquals = {
            "SAML:aud" = "https://signin.aws.amazon.com/saml"
          }
        }
      }
    ]
  })
}
```

### 8.2 Centralized Logging Across Clouds

```python
# Aggregate security logs from multiple clouds into a SIEM
# Example: Forward to Elasticsearch/OpenSearch

import json
from datetime import datetime

class MultiCloudLogAggregator:
    """Normalize and aggregate security logs from AWS, GCP, and Azure."""

    def normalize_aws_cloudtrail(self, event: dict) -> dict:
        return {
            'timestamp': event['eventTime'],
            'cloud': 'aws',
            'account': event['recipientAccountId'],
            'region': event['awsRegion'],
            'service': event['eventSource'],
            'action': event['eventName'],
            'actor': event.get('userIdentity', {}).get('arn', 'unknown'),
            'source_ip': event.get('sourceIPAddress', 'unknown'),
            'result': 'success' if not event.get('errorCode') else 'failure',
            'error': event.get('errorMessage', ''),
            'raw': json.dumps(event)
        }

    def normalize_gcp_audit_log(self, entry: dict) -> dict:
        proto = entry.get('protoPayload', {})
        return {
            'timestamp': entry['timestamp'],
            'cloud': 'gcp',
            'account': entry.get('resource', {}).get('labels', {}).get('project_id'),
            'region': entry.get('resource', {}).get('labels', {}).get('location'),
            'service': proto.get('serviceName', 'unknown'),
            'action': proto.get('methodName', 'unknown'),
            'actor': proto.get('authenticationInfo', {}).get('principalEmail', 'unknown'),
            'source_ip': proto.get('requestMetadata', {}).get('callerIp', 'unknown'),
            'result': 'success' if not proto.get('status', {}).get('code') else 'failure',
            'error': proto.get('status', {}).get('message', ''),
            'raw': json.dumps(entry)
        }

    def normalize_azure_activity_log(self, record: dict) -> dict:
        return {
            'timestamp': record['time'],
            'cloud': 'azure',
            'account': record.get('tenantId', 'unknown'),
            'region': record.get('resourceLocation', 'unknown'),
            'service': record.get('resourceProviderName', {}).get('value', 'unknown'),
            'action': record.get('operationName', {}).get('value', 'unknown'),
            'actor': record.get('caller', 'unknown'),
            'source_ip': record.get('callerIpAddress', 'unknown'),
            'result': record.get('resultType', 'unknown').lower(),
            'error': record.get('resultDescription', ''),
            'raw': json.dumps(record)
        }
```

---

## 9. Best Practices

1. **Enable MFA everywhere** -- enforce MFA for all human users, especially root and
   admin accounts; use hardware security keys (FIDO2/U2F) for privileged accounts
   rather than TOTP.

2. **Eliminate long-lived credentials** -- use IAM roles, workload identity federation,
   and OIDC-based authentication instead of static access keys; rotate any remaining
   keys on a strict schedule (maximum 90 days).

3. **Enforce least privilege rigorously** -- start with zero permissions and grant only
   what is needed; use IAM Access Analyzer (AWS), Policy Analyzer (GCP), or Entra ID
   Access Reviews (Azure) to identify and remove unused permissions.

4. **Encrypt everything** -- enable encryption at rest for all storage services using
   customer-managed keys (CMK); enforce TLS 1.2+ for all data in transit; use VPC
   endpoints and private links to keep traffic off the public internet.

5. **Enable comprehensive logging** -- activate CloudTrail, VPC Flow Logs, and Config
   in AWS; enable Audit Logs and VPC Flow Logs in GCP; enable Activity Logs and NSG
   Flow Logs in Azure; send all logs to a centralized SIEM with immutable storage.

6. **Implement network segmentation** -- use separate VPCs or VNets for different
   environments (production, staging, development); isolate databases in private
   subnets with no internet access; use VPC peering or transit gateways with strict
   routing.

7. **Automate compliance monitoring** -- deploy CSPM tools (Prowler, ScoutSuite, cloud
   native) to continuously scan for misconfigurations; implement auto-remediation for
   critical findings; align with CIS Benchmarks.

8. **Use infrastructure as code for all resources** -- define all cloud resources in
   Terraform, CloudFormation, or Pulumi; scan IaC templates before deployment with
   Checkov or tfsec; prohibit manual console changes.

9. **Implement tagging and resource governance** -- enforce mandatory tags for cost
   center, environment, owner, and data classification; use tag-based access policies
   and compliance rules.

10. **Plan for multi-account and multi-project architecture** -- use AWS Organizations,
    GCP Folders/Projects, or Azure Management Groups to isolate workloads; apply SCPs
    and organization policies at the top level.

---

## 10. Anti-Patterns

1. **Using root or owner accounts for daily operations** -- root accounts should be
   locked away with hardware MFA; daily work should use federated identities with
   appropriate roles.

2. **Storing access keys in source code or environment variables** -- this is the
   number one cause of cloud breaches; use IAM roles, workload identity, or a secrets
   manager instead.

3. **Opening security groups to 0.0.0.0/0** -- allowing all inbound traffic on any port
   exposes services to the entire internet; restrict to specific CIDR ranges and
   security group references.

4. **Disabling default encryption to "simplify" configuration** -- encryption at rest
   should be non-negotiable; use service-default encryption at minimum and CMKs for
   sensitive workloads.

5. **Granting Administrator or Owner access as the default role** -- wildcard permissions
   violate least privilege and create blast radius for credential compromise; create
   custom roles with only needed permissions.

6. **Skipping VPC Flow Logs and CloudTrail to "save costs"** -- the cost of logging is
   negligible compared to the cost of a breach investigation without audit trails; these
   logs are essential for incident response.

7. **Using a single account or project for all environments** -- mixing production and
   development in one account increases blast radius; use separate accounts with
   cross-account roles for access.

8. **Relying solely on cloud provider native security** -- cloud security is a shared
   responsibility; native tools must be supplemented with CSPM, SIEM, vulnerability
   scanning, and application-level security controls.

---

## 11. Enforcement Checklist

### Identity and Access Management
- [ ] Root/owner account secured with hardware MFA and no access keys
- [ ] All human users authenticate through federated identity provider (SSO)
- [ ] All service-to-service authentication uses roles or workload identity (no static keys)
- [ ] IAM policies follow least privilege with regular access reviews
- [ ] SCPs or organization policies enforce security guardrails at the organization level
- [ ] Unused users, roles, and permissions are removed within 30 days
- [ ] Password policy enforces minimum 14 characters, complexity, and rotation

### Network Security
- [ ] No security group rules allow 0.0.0.0/0 for SSH (22) or RDP (3389)
- [ ] Production databases are in isolated subnets with no internet access
- [ ] VPC Flow Logs or equivalent are enabled for all VPCs
- [ ] VPC endpoints or private links are used for cloud service access
- [ ] NACLs provide additional subnet-level filtering as defense in depth

### Data Protection
- [ ] Encryption at rest is enabled for all storage services using CMKs
- [ ] TLS 1.2+ is enforced for all data in transit
- [ ] S3 bucket public access block is enabled at the account level
- [ ] Key rotation is automated with maximum 365-day rotation period
- [ ] Data classification tags are applied to all storage resources

### Logging and Monitoring
- [ ] CloudTrail (or equivalent) is enabled in all regions with log validation
- [ ] CloudTrail logs are stored in a separate account with immutable storage
- [ ] GuardDuty (or equivalent threat detection) is enabled in all accounts
- [ ] Security Hub (or equivalent) aggregates findings from all security services
- [ ] Alerts are configured for critical security events with defined escalation paths
- [ ] Log retention meets compliance requirements (minimum 1 year)

### Compliance and Governance
- [ ] CIS Benchmark assessment is run quarterly and findings are remediated
- [ ] CSPM tool runs continuously and reports to the security team
- [ ] All cloud resources are created through IaC with pre-deployment scanning
- [ ] Tag policies enforce mandatory tags on all resources
- [ ] Resource creation outside approved regions is blocked by policy
- [ ] Regular penetration testing is performed on cloud infrastructure
