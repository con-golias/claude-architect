# Pulumi

| Attribute     | Value                                                              |
|--------------|--------------------------------------------------------------------|
| Domain       | DevOps > IaC                                                       |
| Importance   | High                                                               |
| Last Updated | 2026-03-10                                                         |
| Cross-ref    | [Terraform](terraform.md), [Best Practices](best-practices.md)    |

---

## Core Concepts

### Pulumi Architecture

Pulumi is a multi-language Infrastructure as Code platform that uses general-purpose programming languages instead of a domain-specific language. It supports TypeScript, Python, Go, C#, Java, and YAML with 1,800+ providers.

```text
Pulumi Architecture
┌─────────────────────────────────────────────────────────┐
│  Program (TypeScript / Python / Go / C# / Java)         │
│         ↓                                                │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │ Language Host │ →  │ Pulumi Engine│                   │
│  │ (Node/Python/ │    │ (Deployment  │                   │
│  │  Go runtime)  │    │  Orchestrator│                   │
│  └──────────────┘    └──────┬───────┘                   │
│                              ↓                           │
│         ┌────────────────────┼────────────────┐         │
│         ↓                    ↓                ↓         │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ AWS Provider│  │ GCP Provider │  │ K8s Provider │    │
│  └────────────┘  └──────────────┘  └──────────────┘    │
│                              ↓                           │
│                    ┌──────────────────┐                  │
│                    │ State Backend    │                  │
│                    │ (Pulumi Cloud /  │                  │
│                    │  S3 / Local)     │                  │
│                    └──────────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

Core workflow:

```bash
# Create a new project
pulumi new aws-typescript         # Scaffolds project from template

# Standard lifecycle
pulumi preview                    # Show planned changes (like terraform plan)
pulumi up                         # Deploy changes
pulumi destroy                    # Tear down stack
pulumi stack export               # Export state for inspection
```

### Pulumi vs Terraform Comparison

| Aspect | Pulumi | Terraform |
|--------|--------|-----------|
| Language | TypeScript, Python, Go, C#, Java, YAML | HCL (domain-specific) |
| State | Pulumi Cloud, S3, local file | Terraform Cloud, S3+DynamoDB, GCS, Azure Blob |
| Testing | Native unit/integration tests in language | `terraform test` (HCL-based, limited) |
| Loops/Conditions | Native language constructs | `for_each`, `count`, ternary |
| IDE support | Full autocomplete, type checking, refactoring | HCL plugins (limited type inference) |
| Providers | 1,800+ (plus Terraform bridge) | 3,000+ native |
| Learning curve | Familiar if you know the language | Must learn HCL |
| Modularity | Classes, functions, packages | Modules (directory-based) |

### Project and Stack Organization

A **project** is a directory with a `Pulumi.yaml` file. A **stack** is an isolated instance of a project (e.g., dev, staging, prod).

```yaml
# Pulumi.yaml
name: networking
runtime: nodejs
description: VPC and networking infrastructure

config:
  pulumi:tags:
    value:
      pulumi:template: aws-typescript
```

```bash
# Stack management
pulumi stack init dev
pulumi stack init staging
pulumi stack init prod
pulumi stack select prod
pulumi stack ls
```

Recommended project structure:

```text
infrastructure/
├── networking/           # One project per infrastructure domain
│   ├── Pulumi.yaml
│   ├── Pulumi.dev.yaml   # Stack-specific config
│   ├── Pulumi.prod.yaml
│   ├── index.ts
│   └── vpc.ts
├── compute/
│   ├── Pulumi.yaml
│   ├── index.ts
│   └── ecs.ts
├── data/
│   ├── Pulumi.yaml
│   ├── index.ts
│   └── rds.ts
└── shared/               # Shared component library
    ├── package.json
    └── src/
        ├── tagging.ts
        └── naming.ts
```

### Configuration and Secrets

```bash
# Set plain-text config
pulumi config set aws:region us-east-1
pulumi config set instanceType t3.medium

# Set encrypted secrets (encrypted at rest in state)
pulumi config set --secret dbPassword 'S3cur3P@ss!'
pulumi config set --secret apiKey 'sk-abc123...'

# Use external secret providers
pulumi config set --secret --path 'database.password' 'prod-pass'
```

```typescript
// Access config in code
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const instanceType = config.get("instanceType") || "t3.medium";
const dbPassword = config.requireSecret("dbPassword"); // Returns Output<string>

// Namespaced config
const awsConfig = new pulumi.Config("aws");
const region = awsConfig.require("region");
```

### Practical Example: VPC in TypeScript

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config();
const env = pulumi.getStack();
const cidrBlock = config.get("vpcCidr") || "10.0.0.0/16";

// Create VPC
const vpc = new aws.ec2.Vpc("main", {
  cidrBlock,
  enableDnsHostnames: true,
  enableDnsSupport: true,
  tags: {
    Name: `${env}-vpc`,
    Environment: env,
    ManagedBy: "pulumi",
  },
});

// Create subnets across AZs
const azs = aws.getAvailabilityZones({ state: "available" });

const publicSubnets = azs.then((azData) =>
  azData.names.slice(0, 3).map(
    (az, index) =>
      new aws.ec2.Subnet(`public-${az}`, {
        vpcId: vpc.id,
        cidrBlock: `10.0.${index}.0/24`,
        availabilityZone: az,
        mapPublicIpOnLaunch: true,
        tags: { Name: `${env}-public-${az}`, Tier: "public" },
      })
  )
);

const privateSubnets = azs.then((azData) =>
  azData.names.slice(0, 3).map(
    (az, index) =>
      new aws.ec2.Subnet(`private-${az}`, {
        vpcId: vpc.id,
        cidrBlock: `10.0.${index + 10}.0/24`,
        availabilityZone: az,
        tags: { Name: `${env}-private-${az}`, Tier: "private" },
      })
  )
);

// Internet Gateway
const igw = new aws.ec2.InternetGateway("igw", {
  vpcId: vpc.id,
  tags: { Name: `${env}-igw` },
});

// Exports (stack outputs)
export const vpcId = vpc.id;
export const publicSubnetIds = publicSubnets.then((s) => s.map((sub) => sub.id));
export const privateSubnetIds = privateSubnets.then((s) => s.map((sub) => sub.id));
```

### Practical Example: ECS Fargate Service

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx"; // Higher-level components

const config = new pulumi.Config();
const env = pulumi.getStack();
const imageTag = config.require("imageTag");

// ALB using awsx (high-level abstraction)
const alb = new awsx.lb.ApplicationLoadBalancer("api-alb", {
  subnetIds: publicSubnetIds,
  tags: { Environment: env },
});

// ECS Cluster
const cluster = new aws.ecs.Cluster("main", {
  settings: [{ name: "containerInsights", value: "enabled" }],
  tags: { Environment: env },
});

// Fargate Service using awsx
const service = new awsx.ecs.FargateService("api", {
  cluster: cluster.arn,
  desiredCount: env === "prod" ? 3 : 1,
  networkConfiguration: {
    subnets: privateSubnetIds,
    securityGroups: [apiSecurityGroup.id],
    assignPublicIp: false,
  },
  taskDefinitionArgs: {
    container: {
      name: "api",
      image: pulumi.interpolate`${ecrRepo.repositoryUrl}:${imageTag}`,
      cpu: 512,
      memory: 1024,
      essential: true,
      portMappings: [{ containerPort: 8080, targetGroup: alb.defaultTargetGroup }],
      environment: [
        { name: "NODE_ENV", value: env },
        { name: "PORT", value: "8080" },
      ],
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": `/ecs/${env}/api`,
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "api",
        },
      },
    },
  },
  tags: { Environment: env, Service: "api" },
});

export const serviceUrl = alb.loadBalancer.dnsName;
```

### Practical Example: Lambda Function with S3

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const env = pulumi.getStack();

// S3 bucket for static site
const bucket = new aws.s3.BucketV2("site", {
  bucket: `myapp-${env}-static-site`,
  tags: { Environment: env },
});

const bucketAcl = new aws.s3.BucketAclV2("site-acl", {
  bucket: bucket.id,
  acl: "private",
});

// Lambda function
const lambdaRole = new aws.iam.Role("lambda-role", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: { Service: "lambda.amazonaws.com" },
      },
    ],
  }),
});

new aws.iam.RolePolicyAttachment("lambda-basic", {
  role: lambdaRole.name,
  policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
});

const fn = new aws.lambda.Function("processor", {
  runtime: aws.lambda.Runtime.NodeJS20dX,
  handler: "index.handler",
  role: lambdaRole.arn,
  code: new pulumi.asset.AssetArchive({
    "index.js": new pulumi.asset.StringAsset(`
      exports.handler = async (event) => {
        console.log("Event:", JSON.stringify(event));
        return { statusCode: 200, body: "OK" };
      };
    `),
  }),
  environment: {
    variables: { BUCKET_NAME: bucket.bucket, ENVIRONMENT: env },
  },
  timeout: 30,
  memorySize: 256,
  tags: { Environment: env },
});

export const functionArn = fn.arn;
export const bucketName = bucket.bucket;
```

### Component Resources (Reusable Abstractions)

Component resources are custom classes that encapsulate multiple child resources into a reusable unit.

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

interface StaticSiteArgs {
  domain: string;
  indexDocument?: string;
  tags?: Record<string, string>;
}

class StaticSite extends pulumi.ComponentResource {
  public readonly bucketName: pulumi.Output<string>;
  public readonly distributionUrl: pulumi.Output<string>;

  constructor(name: string, args: StaticSiteArgs, opts?: pulumi.ComponentResourceOptions) {
    super("custom:aws:StaticSite", name, {}, opts);

    const bucket = new aws.s3.BucketV2(`${name}-bucket`, {
      bucket: args.domain,
      tags: args.tags,
    }, { parent: this });

    new aws.s3.BucketWebsiteConfigurationV2(`${name}-website`, {
      bucket: bucket.id,
      indexDocument: { suffix: args.indexDocument || "index.html" },
    }, { parent: this });

    const oai = new aws.cloudfront.OriginAccessIdentity(`${name}-oai`, {
      comment: `OAI for ${args.domain}`,
    }, { parent: this });

    const distribution = new aws.cloudfront.Distribution(`${name}-cdn`, {
      enabled: true,
      defaultRootObject: "index.html",
      origins: [{
        originId: bucket.arn,
        domainName: bucket.bucketRegionalDomainName,
        s3OriginConfig: { originAccessIdentity: oai.cloudfrontAccessIdentityPath },
      }],
      defaultCacheBehavior: {
        targetOriginId: bucket.arn,
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD"],
        cachedMethods: ["GET", "HEAD"],
        forwardedValues: { queryString: false, cookies: { forward: "none" } },
      },
      restrictions: { geoRestriction: { restrictionType: "none" } },
      viewerCertificate: { cloudfrontDefaultCertificate: true },
      tags: args.tags,
    }, { parent: this });

    this.bucketName = bucket.bucket;
    this.distributionUrl = distribution.domainName;
    this.registerOutputs({ bucketName: this.bucketName, distributionUrl: this.distributionUrl });
  }
}

// Usage
const site = new StaticSite("docs", {
  domain: "docs.example.com",
  tags: { Environment: "prod", Project: "documentation" },
});
export const siteUrl = site.distributionUrl;
```

### Testing Infrastructure

Pulumi supports native testing in the language of choice -- a major advantage over HCL-based tools.

```typescript
// __tests__/vpc.test.ts -- Unit test with mocks
import * as pulumi from "@pulumi/pulumi";

// Mock all cloud calls
pulumi.runtime.setMocks({
  newResource: (args: pulumi.runtime.MockResourceArgs) => ({
    id: `${args.name}-id`,
    state: args.inputs,
  }),
  call: (args: pulumi.runtime.MockCallArgs) => args.inputs,
});

describe("VPC", () => {
  let infra: typeof import("../index");

  beforeAll(async () => {
    infra = await import("../index");
  });

  test("VPC has DNS hostnames enabled", (done) => {
    pulumi.all([infra.vpcId]).apply(([vpcId]) => {
      expect(vpcId).toBeDefined();
      done();
    });
  });

  test("creates exactly 3 public subnets", (done) => {
    pulumi.all([infra.publicSubnetIds]).apply(([ids]) => {
      expect(ids).toHaveLength(3);
      done();
    });
  });

  test("all resources are tagged", (done) => {
    // Use stack transformations to collect and validate tags on all resources
    done();
  });
});
```

```typescript
// Integration test using Pulumi Automation API
import { LocalWorkspace, Stack } from "@pulumi/pulumi/automation";
import * as https from "https";

describe("Infrastructure Integration", () => {
  let stack: Stack;

  beforeAll(async () => {
    stack = await LocalWorkspace.createOrSelectStack({
      stackName: "test",
      workDir: "../",
    });
    await stack.setConfig("aws:region", { value: "us-east-1" });
    await stack.up({ onOutput: console.log });
  }, 600_000);

  afterAll(async () => {
    await stack.destroy({ onOutput: console.log });
  }, 600_000);

  test("VPC is created and reachable", async () => {
    const outputs = await stack.outputs();
    expect(outputs.vpcId.value).toMatch(/^vpc-/);
  });
});
```

### Pulumi Automation API

The Automation API enables programmatic control of Pulumi operations -- useful for building platforms, CLIs, and self-service portals.

```typescript
import { LocalWorkspace, InlineProgramArgs } from "@pulumi/pulumi/automation";
import * as aws from "@pulumi/aws";

async function provisionEnvironment(envName: string) {
  const program = async () => {
    const bucket = new aws.s3.BucketV2(`${envName}-artifacts`, {
      tags: { Environment: envName, ManagedBy: "automation-api" },
    });
    return { bucketName: bucket.bucket };
  };

  const args: InlineProgramArgs = {
    stackName: envName,
    projectName: "ephemeral-envs",
    program,
  };

  const stack = await LocalWorkspace.createOrSelectStack(args);
  await stack.setConfig("aws:region", { value: "us-east-1" });

  // Deploy
  const result = await stack.up({ onOutput: console.log });
  console.log(`Bucket: ${result.outputs.bucketName.value}`);

  return { stack, outputs: result.outputs };
}

// Tear down
async function teardownEnvironment(envName: string) {
  const stack = await LocalWorkspace.selectStack({
    stackName: envName,
    projectName: "ephemeral-envs",
    program: async () => {},
  });
  await stack.destroy({ onOutput: console.log });
  await stack.workspace.removeStack(envName);
}
```

### Pulumi ESC (Environments, Secrets, Configuration)

Pulumi ESC centralizes environment configuration and secrets across all tools (not just Pulumi). Define environments in YAML with dynamic credential providers.

```yaml
# environments/aws-dev.yaml
values:
  aws:
    login:
      fn::open::aws-login:
        oidc:
          roleArn: arn:aws:iam::123456789:role/pulumi-esc-oidc
          sessionName: pulumi-esc
    region: us-east-1
  environmentVariables:
    AWS_REGION: ${aws.region}
    DATABASE_URL:
      fn::secret: "postgres://user:pass@host:5432/db"
  pulumiConfig:
    aws:region: ${aws.region}
```

```bash
pulumi env open aws-dev                         # Open environment
pulumi env run aws-dev -- aws s3 ls             # Run command with injected creds
eval $(pulumi env open aws-dev --format shell)  # Export to shell
```

### Policy as Code with CrossGuard

```typescript
// policy-pack/index.ts
import * as policy from "@pulumi/policy";

new policy.PolicyPack("compliance", {
  policies: [
    {
      name: "s3-no-public-read",
      description: "S3 buckets must not have public read access",
      enforcementLevel: "mandatory",
      validateResource: policy.validateResourceOfType(
        aws.s3.BucketAclV2,
        (bucket, args, reportViolation) => {
          if (bucket.acl === "public-read" || bucket.acl === "public-read-write") {
            reportViolation("S3 bucket ACL must not be public-read or public-read-write.");
          }
        }
      ),
    },
    {
      name: "required-tags",
      description: "All resources must have required tags",
      enforcementLevel: "mandatory",
      validateResource: (args, reportViolation) => {
        const tags = (args.props as any).tags;
        const required = ["Environment", "ManagedBy", "CostCenter"];
        if (tags) {
          for (const tag of required) {
            if (!tags[tag]) {
              reportViolation(`Missing required tag: ${tag}`);
            }
          }
        }
      },
    },
    {
      name: "no-large-instances",
      description: "Limit EC2 instance sizes in non-prod",
      enforcementLevel: "advisory",
      validateResource: policy.validateResourceOfType(
        aws.ec2.Instance,
        (instance, args, reportViolation) => {
          const forbidden = ["m6i.4xlarge", "m6i.8xlarge", "m6i.16xlarge"];
          if (forbidden.includes(instance.instanceType)) {
            reportViolation(`Instance type ${instance.instanceType} is too large.`);
          }
        }
      ),
    },
  ],
});
```

### Migration from Terraform

```bash
# tf2pulumi converts HCL to Pulumi code
tf2pulumi --target-language typescript    # Convert HCL to TypeScript
tf2pulumi --target-language python        # Convert HCL to Python

# Import existing Terraform state
pulumi import --from terraform ./terraform.tfstate

# Import a specific AWS resource
pulumi import aws:ec2/vpc:Vpc main vpc-0abc123def456
```

---

## 10 Best Practices

1. **Leverage type safety and IDE features.** Use TypeScript with strict mode or Go for compile-time infrastructure validation. Catch misconfigurations before running `pulumi preview`.

2. **Build component resources for shared patterns.** Wrap common multi-resource patterns (VPC+subnets, ECS+ALB) into typed `ComponentResource` classes with well-defined interfaces.

3. **Use stack references for cross-stack dependencies.** Access outputs from other stacks via `StackReference` instead of hardcoding ARNs or IDs. This maintains loose coupling between infrastructure layers.

4. **Encrypt all secrets with `pulumi config set --secret`.** Never store passwords, API keys, or tokens as plain-text config. Pulumi encrypts secrets in the state file automatically.

5. **Test infrastructure code like application code.** Write unit tests with mocks for fast feedback, property tests for policy validation, and integration tests for critical paths using the Automation API.

6. **Organize by infrastructure domain, not environment.** Create separate projects for networking, compute, and data. Use stacks for environment differentiation within each project.

7. **Pin provider versions in `package.json` or `go.mod`.** Use exact or tilde-range versions. Run `pulumi preview` after dependency updates to verify no unintended changes.

8. **Use Pulumi ESC for centralized secrets and config.** Consolidate environment variables, cloud credentials, and feature flags in ESC environments. Avoid scattering secrets across CI systems.

9. **Enforce policies with CrossGuard.** Define mandatory policies for tagging, encryption, network exposure, and instance sizing. Run policies in CI and block deployments that violate them.

10. **Integrate security scanning in CI.** Run Checkov or Trivy against Pulumi-generated plans. Cross-ref: [08-security/infrastructure-security/iac-security.md](../../08-security/infrastructure-security/iac-security.md).

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Ignoring `Output<T>` and using `.get()`** | Runtime errors, unresolved values, race conditions | Use `.apply()`, `pulumi.interpolate`, and `pulumi.all()` properly |
| **Monolithic single-stack program** | Slow previews, large blast radius, team conflicts | Split into domain-based projects with stack references |
| **Plain-text secrets in stack config** | Credentials exposed in state and version control | Always use `--secret` flag; integrate external secret providers |
| **No component resources (flat resource list)** | Hard to reuse, test, or reason about infrastructure | Create `ComponentResource` classes for multi-resource patterns |
| **Skipping `pulumi preview` before `pulumi up`** | Unexpected destructive changes, outages | Always preview; require preview in CI before apply |
| **Hardcoded resource names without stack context** | Name collisions across environments | Include `pulumi.getStack()` in resource naming |
| **No unit tests for infrastructure code** | Misconfigurations reach production undetected | Write unit tests with mocks; run in CI on every PR |
| **Using `pulumi up --yes` without review** | Bypasses human review of destructive changes | Require explicit approval; use `--yes` only in automated pipelines with preview gate |

---

## Enforcement Checklist

- [ ] All Pulumi projects use TypeScript strict mode or equivalent type safety
- [ ] Secrets stored with `pulumi config set --secret` (never plain-text)
- [ ] Component resources created for all multi-resource patterns (VPC, ECS, etc.)
- [ ] Stack references used for cross-project dependencies (no hardcoded IDs)
- [ ] Unit tests with mocks exist for all component resources
- [ ] `pulumi preview` runs on every PR and posts diff as comment
- [ ] `pulumi up` runs only on merge to main with approval gate
- [ ] CrossGuard policy pack enforces tagging, encryption, and network policies
- [ ] Provider versions pinned in `package.json` / `go.mod` / `requirements.txt`
- [ ] Pulumi ESC configured for environment secrets and cloud credentials
- [ ] Security scanning (Checkov/Trivy) integrated in CI pipeline
- [ ] Stack outputs documented and consumed via stack references (not copy-pasted)
- [ ] `protect: true` set on stateful resources (databases, storage) to prevent accidental deletion
