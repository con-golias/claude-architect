# CloudFormation

| Attribute     | Value                                                              |
|--------------|--------------------------------------------------------------------|
| Domain       | DevOps > IaC                                                       |
| Importance   | Medium                                                             |
| Last Updated | 2026-03-10                                                         |
| Cross-ref    | [Terraform](terraform.md), [Best Practices](best-practices.md)    |

---

## Core Concepts

### CloudFormation Architecture

AWS CloudFormation is a native AWS IaC service that provisions and manages resources using declarative JSON or YAML templates. It integrates deeply with all AWS services and requires no separate tooling.

```text
CloudFormation Architecture
┌─────────────────────────────────────────────────────────────┐
│  Template (YAML/JSON)                                        │
│         ↓                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Validate     │→ │ Change Set   │→ │ Stack Operations │  │
│  │ (cfn-lint)   │  │ (diff preview│  │ (CREATE/UPDATE/  │  │
│  │              │  │  before apply│  │  DELETE)          │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                             ↓                │
│        ┌────────────────────────────────────┼──────┐        │
│        ↓                ↓                   ↓      ↓        │
│  ┌──────────┐  ┌──────────────┐  ┌──────┐  ┌──────────┐   │
│  │ EC2      │  │ RDS          │  │ S3   │  │ Lambda   │   │
│  └──────────┘  └──────────────┘  └──────┘  └──────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │ Stack State (managed by AWS -- no external state) │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

Key advantage: CloudFormation state is managed entirely by AWS. There is no external state file to secure, lock, or back up.

```bash
# Core workflow
aws cloudformation validate-template --template-body file://template.yaml
aws cloudformation create-stack --stack-name my-stack --template-body file://template.yaml
aws cloudformation update-stack --stack-name my-stack --template-body file://template.yaml
aws cloudformation delete-stack --stack-name my-stack

# Change sets (preview before apply -- recommended)
aws cloudformation create-change-set \
  --stack-name my-stack \
  --change-set-name update-v2 \
  --template-body file://template.yaml

aws cloudformation describe-change-set \
  --stack-name my-stack \
  --change-set-name update-v2

aws cloudformation execute-change-set \
  --stack-name my-stack \
  --change-set-name update-v2

# Drift detection
aws cloudformation detect-stack-drift --stack-name my-stack
aws cloudformation describe-stack-drift-detection-status --stack-drift-detection-id <id>
```

### Template Anatomy

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: >
  Production VPC with public and private subnets across 3 AZs.
  Managed by CloudFormation. Do not modify resources manually.

Metadata:
  AWS::CloudFormation::Interface:
    ParameterGroups:
      - Label: { default: "Network Configuration" }
        Parameters: [VpcCidr, Environment]
      - Label: { default: "Tagging" }
        Parameters: [Project, CostCenter]

Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues: [dev, staging, prod]
    Description: Deployment environment

  VpcCidr:
    Type: String
    Default: "10.0.0.0/16"
    AllowedPattern: '(\d{1,3}\.){3}\d{1,3}/\d{1,2}'
    ConstraintDescription: Must be a valid CIDR block

  Project:
    Type: String
    Default: myapp

  CostCenter:
    Type: String
    Default: engineering

Mappings:
  EnvironmentConfig:
    dev:
      InstanceType: t3.medium
      MinSize: "1"
      MaxSize: "2"
    staging:
      InstanceType: t3.large
      MinSize: "2"
      MaxSize: "4"
    prod:
      InstanceType: m6i.xlarge
      MinSize: "3"
      MaxSize: "10"

Conditions:
  IsProduction: !Equals [!Ref Environment, prod]
  CreateNatGateway: !Or
    - !Equals [!Ref Environment, prod]
    - !Equals [!Ref Environment, staging]

Resources:
  # Resources defined below in examples

Outputs:
  VpcId:
    Description: VPC Identifier
    Value: !Ref Vpc
    Export:
      Name: !Sub "${AWS::StackName}-VpcId"

  PrivateSubnetIds:
    Description: Private subnet IDs (comma-separated)
    Value: !Join [",", [!Ref PrivateSubnet1, !Ref PrivateSubnet2, !Ref PrivateSubnet3]]
    Export:
      Name: !Sub "${AWS::StackName}-PrivateSubnetIds"
```

### Intrinsic Functions

```yaml
Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Ref VpcCidr                    # Ref: reference parameter or resource
      EnableDnsHostnames: true
      Tags:
        - Key: Name
          Value: !Sub "${Project}-${Environment}-vpc"  # Sub: string interpolation

  SecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Web server security group
      VpcId: !Ref Vpc
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: "0.0.0.0/0"
        # Conditional rule: SSH only in non-prod
        - !If
          - IsProduction
          - !Ref AWS::NoValue            # Omit this rule in production
          - IpProtocol: tcp
            FromPort: 22
            ToPort: 22
            CidrIp: "10.0.0.0/8"

  # GetAtt: retrieve resource attributes
  SubnetRouteAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet1
      RouteTableId: !GetAtt PublicRouteTable.RouteTableId

  # Select: pick item from list by index
  FirstAz:
    Type: AWS::EC2::Subnet
    Properties:
      AvailabilityZone: !Select [0, !GetAZs ""]   # First AZ in region
      VpcId: !Ref Vpc
      CidrBlock: "10.0.1.0/24"

  # Join: concatenate strings
  BucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref ArtifactBucket
      PolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              AWS: !Join ["", ["arn:aws:iam::", !Ref "AWS::AccountId", ":root"]]
            Action: "s3:GetObject"
            Resource: !Join ["/", [!GetAtt ArtifactBucket.Arn, "*"]]
```

### Practical Example: Full VPC Template

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: Production-ready VPC with 3-AZ public/private subnets

Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, prod]
  VpcCidr:
    Type: String
    Default: "10.0.0.0/16"

Conditions:
  IsProduction: !Equals [!Ref Environment, prod]

Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Ref VpcCidr
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub "${Environment}-vpc"
        - Key: Environment
          Value: !Ref Environment

  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub "${Environment}-igw"

  GatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref Vpc
      InternetGatewayId: !Ref InternetGateway

  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: !Select [0, !Cidr [!Ref VpcCidr, 6, 8]]
      AvailabilityZone: !Select [0, !GetAZs ""]
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub "${Environment}-public-1"
        - Key: Tier
          Value: public

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: !Select [1, !Cidr [!Ref VpcCidr, 6, 8]]
      AvailabilityZone: !Select [1, !GetAZs ""]
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub "${Environment}-public-2"

  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: !Select [3, !Cidr [!Ref VpcCidr, 6, 8]]
      AvailabilityZone: !Select [0, !GetAZs ""]
      Tags:
        - Key: Name
          Value: !Sub "${Environment}-private-1"
        - Key: Tier
          Value: private

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: !Select [4, !Cidr [!Ref VpcCidr, 6, 8]]
      AvailabilityZone: !Select [1, !GetAZs ""]
      Tags:
        - Key: Name
          Value: !Sub "${Environment}-private-2"

  # NAT Gateway (prod/staging only -- see best-practices.md for cost considerations)
  NatEip:
    Type: AWS::EC2::EIP
    Condition: IsProduction
    Properties:
      Domain: vpc

  NatGateway:
    Type: AWS::EC2::NatGateway
    Condition: IsProduction
    Properties:
      AllocationId: !GetAtt NatEip.AllocationId
      SubnetId: !Ref PublicSubnet1

Outputs:
  VpcId:
    Value: !Ref Vpc
    Export:
      Name: !Sub "${AWS::StackName}-VpcId"
  PublicSubnets:
    Value: !Join [",", [!Ref PublicSubnet1, !Ref PublicSubnet2]]
    Export:
      Name: !Sub "${AWS::StackName}-PublicSubnets"
  PrivateSubnets:
    Value: !Join [",", [!Ref PrivateSubnet1, !Ref PrivateSubnet2]]
    Export:
      Name: !Sub "${AWS::StackName}-PrivateSubnets"
```

### Practical Example: Lambda with API Gateway

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31     # Enable SAM transform
Description: Serverless API with Lambda and API Gateway

Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, prod]

Globals:                                    # SAM globals
  Function:
    Runtime: nodejs20.x
    Timeout: 30
    MemorySize: 256
    Environment:
      Variables:
        ENVIRONMENT: !Ref Environment
    Tags:
      Environment: !Ref Environment
      ManagedBy: cloudformation

Resources:
  ApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub "${Environment}-api-handler"
      Handler: index.handler
      CodeUri: ./src/
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref DataTable
      Events:
        GetItems:
          Type: Api
          Properties:
            Path: /items
            Method: GET
        CreateItem:
          Type: Api
          Properties:
            Path: /items
            Method: POST

  DataTable:
    Type: AWS::DynamoDB::Table
    DeletionPolicy: Retain                  # Protect from accidental deletion
    UpdateReplacePolicy: Retain
    Properties:
      TableName: !Sub "${Environment}-items"
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
        - AttributeName: createdAt
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH
        - AttributeName: createdAt
          KeyType: RANGE
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true
      SSESpecification:
        SSEEnabled: true
      Tags:
        - Key: Environment
          Value: !Ref Environment

Outputs:
  ApiUrl:
    Description: API Gateway endpoint URL
    Value: !Sub "https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod/"
  FunctionArn:
    Value: !GetAtt ApiFunction.Arn
```

### Nested Stacks and Cross-Stack References

Nested stacks decompose large templates into manageable components. Cross-stack references share outputs between independent stacks.

```yaml
# parent-stack.yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: Parent stack orchestrating nested infrastructure

Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, prod]

Resources:
  NetworkStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: https://s3.amazonaws.com/cf-templates/networking.yaml
      Parameters:
        Environment: !Ref Environment
        VpcCidr: "10.0.0.0/16"
      Tags:
        - Key: Layer
          Value: networking

  ComputeStack:
    Type: AWS::CloudFormation::Stack
    DependsOn: NetworkStack
    Properties:
      TemplateURL: https://s3.amazonaws.com/cf-templates/compute.yaml
      Parameters:
        Environment: !Ref Environment
        VpcId: !GetAtt NetworkStack.Outputs.VpcId
        SubnetIds: !GetAtt NetworkStack.Outputs.PrivateSubnets
      Tags:
        - Key: Layer
          Value: compute

  DataStack:
    Type: AWS::CloudFormation::Stack
    DependsOn: NetworkStack
    Properties:
      TemplateURL: https://s3.amazonaws.com/cf-templates/data.yaml
      Parameters:
        Environment: !Ref Environment
        VpcId: !GetAtt NetworkStack.Outputs.VpcId
        SubnetIds: !GetAtt NetworkStack.Outputs.PrivateSubnets
```

Cross-stack references using Exports/Imports:

```yaml
# In networking stack: export the VPC ID
Outputs:
  VpcId:
    Value: !Ref Vpc
    Export:
      Name: !Sub "${Environment}-VpcId"

# In compute stack: import the VPC ID
Resources:
  Instance:
    Type: AWS::EC2::Instance
    Properties:
      SubnetId: !ImportValue
        Fn::Sub: "${Environment}-PrivateSubnet1"
```

### StackSets for Multi-Account / Multi-Region

```bash
# Deploy to multiple accounts and regions
aws cloudformation create-stack-set \
  --stack-set-name security-baseline \
  --template-body file://security-baseline.yaml \
  --permission-model SERVICE_MANAGED \
  --auto-deployment Enabled=true,RetainStacksOnAccountRemoval=false

aws cloudformation create-stack-instances \
  --stack-set-name security-baseline \
  --deployment-targets OrganizationalUnitIds=ou-abc123 \
  --regions us-east-1 eu-west-1 ap-southeast-1

# Check deployment status
aws cloudformation describe-stack-set-operation \
  --stack-set-name security-baseline \
  --operation-id <id>
```

### AWS CDK Relationship

AWS CDK generates CloudFormation templates from general-purpose languages. CDK is the recommended approach for new AWS-only projects.

```typescript
// CDK synthesizes to CloudFormation
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";

class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 3,
      natGateways: 1,
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "Private", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: "Isolated", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });
  }
}

// CDK synth → CloudFormation template → CloudFormation deploy
// cdk synth   → generates template
// cdk deploy  → creates/updates CloudFormation stack
```

Decision guide:

| Factor | CloudFormation (raw) | AWS CDK | Terraform |
|--------|---------------------|---------|-----------|
| AWS-only | Excellent | Excellent | Excellent |
| Multi-cloud | No | No | Yes |
| Language | YAML/JSON | TS/Python/Go/Java/C# | HCL |
| State management | AWS-managed | AWS-managed | Self-managed |
| Learning curve | Moderate | Low (if you know the language) | Moderate |
| Abstraction level | Low (1:1 with API) | High (L2/L3 constructs) | Medium |
| Third-party resources | Registry (limited) | Via CFN or custom | 3,000+ providers |

### CloudFormation Guard (Policy Validation)

CloudFormation Guard validates templates against policy rules before deployment. For comprehensive IaC security scanning coverage (Checkov, tfsec/Trivy, KICS, OPA/Sentinel), see [08-security/infrastructure-security/iac-security.md](../../08-security/infrastructure-security/iac-security.md).

```bash
# Install cfn-guard
curl -Lo cfn-guard https://github.com/aws-cloudformation/cloudformation-guard/releases/latest/download/cfn-guard
chmod +x cfn-guard

# Write guard rules
# rules/security.guard
let s3_buckets = Resources.*[ Type == 'AWS::S3::Bucket' ]

rule s3_encryption_required when %s3_buckets !empty {
  %s3_buckets.Properties.BucketEncryption exists
  %s3_buckets.Properties.BucketEncryption.ServerSideEncryptionConfiguration[*]
    .ServerSideEncryptionByDefault.SSEAlgorithm == "aws:kms"
}

rule s3_public_access_blocked when %s3_buckets !empty {
  %s3_buckets.Properties.PublicAccessBlockConfiguration exists
  %s3_buckets.Properties.PublicAccessBlockConfiguration.BlockPublicAcls == true
  %s3_buckets.Properties.PublicAccessBlockConfiguration.BlockPublicPolicy == true
}

# Validate template against rules
cfn-guard validate \
  --data template.yaml \
  --rules rules/security.guard \
  --output-format json
```

### cfn-lint Validation

```bash
# Install and run cfn-lint
pip install cfn-lint
cfn-lint template.yaml

# Configuration file: .cfnlintrc
# configure:
#   regions:
#     - us-east-1
#     - eu-west-1
#   ignore_checks:
#     - W3010  # Disable specific warning
#   include_checks:
#     - I      # Include informational checks
```

### SAM (Serverless Application Model)

SAM is a CloudFormation extension for serverless applications. It provides shorthand syntax for Lambda, API Gateway, DynamoDB, and Step Functions.

```bash
# SAM CLI workflow
sam init --runtime nodejs20.x --name my-api    # Scaffold project
sam build                                       # Build artifacts
sam local invoke ApiFunction --event event.json # Local testing
sam local start-api                             # Local API Gateway
sam deploy --guided                             # Deploy (creates CloudFormation stack)
sam logs -n ApiFunction --tail                  # Stream Lambda logs
```

### Rain CLI

Rain is an improved CloudFormation CLI with better developer experience: formatted output, progress visualization, and dependency-aware operations.

```bash
rain fmt template.yaml                    # Format template
rain deploy template.yaml my-stack --yes  # Deploy with progress visualization
rain cat my-stack                         # Show current template of deployed stack
rain diff template.yaml my-stack          # Show changes before deploying
rain rm my-stack                          # Delete stack with dependency handling
rain build AWS::S3::Bucket                # Scaffold minimal resource definition
```

---

## 10 Best Practices

1. **Use change sets before every update.** Never run `update-stack` directly. Create a change set, review the diff, then execute. This prevents accidental resource replacements.

2. **Set DeletionPolicy and UpdateReplacePolicy on stateful resources.** Use `Retain` or `Snapshot` for databases, S3 buckets, and encryption keys. Protect against accidental deletion.

3. **Parameterize templates with AllowedValues and constraints.** Use `AllowedValues`, `AllowedPattern`, `MinLength`, `MaxLength`, and `ConstraintDescription` to catch errors early.

4. **Export outputs for cross-stack references.** Use `Export` in outputs and `Fn::ImportValue` in consumers. This establishes explicit contracts between stacks.

5. **Prefer AWS CDK for new projects.** CDK provides higher-level abstractions, type safety, and native testing while generating CloudFormation under the hood.

6. **Use nested stacks to decompose large templates.** Keep individual templates under 200 resources. Break into networking, compute, data, and monitoring layers.

7. **Validate templates in CI with cfn-lint and cfn-guard.** Run `cfn-lint` for syntax/best-practice checks and `cfn-guard` for policy compliance before deploying.

8. **Enable drift detection on a schedule.** Detect manual changes that deviate from the template. Remediate drift immediately to maintain IaC as the source of truth.

9. **Use StackSets for multi-account governance.** Deploy security baselines, IAM policies, and compliance controls across all accounts in an AWS Organization consistently.

10. **Tag every resource with standard metadata.** Use `Tags` on all taggable resources. Include Environment, Project, ManagedBy, and CostCenter at minimum.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Direct `update-stack` without change set** | Unexpected resource replacements, data loss | Always create and review a change set before executing |
| **No DeletionPolicy on stateful resources** | Database or bucket deleted on stack removal | Set `DeletionPolicy: Retain` or `Snapshot` on all data stores |
| **Monolithic 500+ resource template** | Slow deployments, hard to debug, single blast radius | Break into nested stacks or cross-stack references |
| **Hardcoded account IDs and regions** | Template not portable across environments | Use `AWS::AccountId`, `AWS::Region` pseudo-parameters |
| **Cross-stack circular dependencies** | Stack update failures, deployment deadlocks | Design unidirectional dependency graphs; use SSM Parameter Store for loose coupling |
| **Ignoring cfn-lint warnings** | Subtle misconfigurations, runtime deployment failures | Run cfn-lint in CI and treat warnings as errors |
| **Using `Fn::ImportValue` extensively** | Tight coupling, cannot delete exporting stack | Limit exports; prefer SSM parameters for loose coupling |
| **Manual resource modifications outside CFN** | Drift between template and reality, failed future updates | Enable drift detection; enforce all changes through IaC |

---

## Enforcement Checklist

- [ ] All infrastructure changes go through CloudFormation (no manual Console/CLI changes)
- [ ] Change sets created and reviewed before every stack update
- [ ] `DeletionPolicy: Retain` set on all databases, S3 buckets, and encryption keys
- [ ] Templates validated with `cfn-lint` and `cfn-guard` in CI pipeline
- [ ] Parameters use `AllowedValues`, `AllowedPattern`, and constraints
- [ ] Nested stacks used for templates exceeding 100 resources
- [ ] Cross-stack outputs exported with consistent naming convention
- [ ] Drift detection enabled and running on weekly schedule
- [ ] StackSets deployed for security baselines across all AWS accounts
- [ ] SAM used for all serverless application deployments
- [ ] All resources tagged with Environment, Project, ManagedBy, CostCenter
- [ ] Template linting and policy validation run as pre-commit hooks
- [ ] Stack termination protection enabled for production stacks
