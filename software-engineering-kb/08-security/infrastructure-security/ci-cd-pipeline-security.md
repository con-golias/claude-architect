# CI/CD Pipeline Security Comprehensive Guide

## Metadata
- **Category**: Infrastructure Security
- **Audience**: DevOps engineers, platform engineers, security engineers
- **Last Updated**: 2026-03-10
- **Complexity**: Advanced
- **Platforms**: GitHub Actions, GitLab CI, Jenkins, CircleCI
- **Standards**: SLSA, Sigstore, OpenSSF

---

## 1. Pipeline as Attack Surface

A CI/CD pipeline is a high-value target. A compromised pipeline can inject malicious
code into production artifacts, exfiltrate secrets, modify infrastructure, and establish
persistent backdoors. The pipeline has access to source code, secrets, build systems,
artifact registries, and production environments.

### 1.1 Attack Vectors

```
+---------------------------+------------------------------------------------+
| Attack Vector             | Impact                                         |
+---------------------------+------------------------------------------------+
| Compromised dependency    | Malicious code in build artifacts               |
| Stolen secrets            | Access to production, cloud accounts, databases |
| Malicious PR              | Code execution on CI runners                   |
| Compromised action/plugin | Supply chain attack on build process            |
| Runner compromise         | Persistent access, secret exfiltration          |
| Branch protection bypass  | Unauthorized deployment to production           |
| Artifact tampering        | Deployment of modified, malicious artifacts     |
| Log exposure              | Secrets leaked through build output             |
+---------------------------+------------------------------------------------+
```

### 1.2 Trust Boundaries in CI/CD

```
[Developer] --push--> [Source Repository]
                            |
                      [CI Pipeline]
                       /    |     \
            [Build]  [Test]  [Security Scan]
                       \    |     /
                      [Artifact Registry]
                            |
                  [Approval Gate] <-- Required reviewers
                            |
                      [CD Pipeline]
                            |
                      [Production]

Trust boundaries exist at EVERY arrow in this diagram.
Each transition must be authenticated and authorized.
```

---

## 2. Secrets in CI/CD

### 2.1 Never Store Secrets in Code or Logs

```yaml
# BAD - Secrets in workflow file
env:
  AWS_ACCESS_KEY_ID: AKIAIOSFODNN7EXAMPLE      # NEVER
  AWS_SECRET_ACCESS_KEY: wJalrXUtnFEMI/K7MDENG  # NEVER
  DATABASE_PASSWORD: supersecret123              # NEVER

# BAD - Secrets printed in logs
steps:
  - run: echo "Deploying with key ${{ secrets.AWS_SECRET_KEY }}"  # NEVER
  - run: curl -H "Authorization: Bearer ${{ secrets.API_TOKEN }}" https://api.example.com
    # The above leaks the token in curl verbose output and error messages

# GOOD - Use masked secrets from repository settings
steps:
  - name: Deploy
    env:
      AWS_REGION: us-east-1
    run: |
      # Secrets are injected by the CI platform and masked in logs
      # The actual values come from repository/organization secrets
      aws s3 sync ./dist s3://my-bucket/
```

### 2.2 OIDC for Cloud Authentication (No Static Credentials)

OIDC (OpenID Connect) federation eliminates the need for long-lived cloud credentials
in CI/CD. The pipeline authenticates with the cloud provider using a short-lived token
issued by the CI platform.

```yaml
# GitHub Actions - OIDC authentication with AWS
name: Deploy to AWS

on:
  push:
    branches: [main]

permissions:
  id-token: write    # Required for OIDC
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsDeployRole
          role-session-name: github-actions-${{ github.run_id }}
          aws-region: us-east-1
          # No access key ID or secret key needed
          # The action uses OIDC to get temporary credentials

      - name: Deploy
        run: |
          aws s3 sync ./dist s3://my-app-bucket/
          aws cloudfront create-invalidation --distribution-id E1234 --paths "/*"
```

```hcl
# Terraform - AWS IAM role for GitHub Actions OIDC
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_actions_deploy" {
  name = "GitHubActionsDeployRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Restrict to specific repository and branch
            "token.actions.githubusercontent.com:sub" = "repo:my-org/my-repo:ref:refs/heads/main"
          }
        }
      }
    ]
  })

  # Least privilege - only the permissions needed for deployment
  inline_policy {
    name = "deploy-policy"
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect = "Allow"
          Action = [
            "s3:PutObject",
            "s3:DeleteObject",
            "s3:ListBucket"
          ]
          Resource = [
            "arn:aws:s3:::my-app-bucket",
            "arn:aws:s3:::my-app-bucket/*"
          ]
        },
        {
          Effect = "Allow"
          Action = [
            "cloudfront:CreateInvalidation"
          ]
          Resource = [
            "arn:aws:cloudfront::123456789012:distribution/E1234"
          ]
        }
      ]
    })
  }

  max_session_duration = 3600  # 1 hour maximum
}
```

```yaml
# GitLab CI - OIDC authentication with AWS
deploy:
  stage: deploy
  image: amazon/aws-cli:latest
  id_tokens:
    GITLAB_OIDC_TOKEN:
      aud: https://gitlab.com
  script:
    # Exchange GitLab OIDC token for AWS credentials
    - >
      STS_RESPONSE=$(aws sts assume-role-with-web-identity
      --role-arn arn:aws:iam::123456789012:role/GitLabDeployRole
      --role-session-name "gitlab-ci-${CI_PIPELINE_ID}"
      --web-identity-token "${GITLAB_OIDC_TOKEN}"
      --duration-seconds 3600)
    - export AWS_ACCESS_KEY_ID=$(echo $STS_RESPONSE | jq -r '.Credentials.AccessKeyId')
    - export AWS_SECRET_ACCESS_KEY=$(echo $STS_RESPONSE | jq -r '.Credentials.SecretAccessKey')
    - export AWS_SESSION_TOKEN=$(echo $STS_RESPONSE | jq -r '.Credentials.SessionToken')
    - aws s3 sync ./dist s3://my-app-bucket/
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

```yaml
# GitHub Actions - OIDC authentication with GCP
name: Deploy to GCP
on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to GCP via OIDC
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: projects/123456/locations/global/workloadIdentityPools/github-pool/providers/github-provider
          service_account: deployer@my-project.iam.gserviceaccount.com

      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: my-service
          region: us-central1
          image: gcr.io/my-project/my-app:${{ github.sha }}
```

---

## 3. GitHub Actions Security

### 3.1 Permissions (Least Privilege)

```yaml
# Set minimal permissions at the workflow level
name: CI Pipeline

on:
  pull_request:
    branches: [main]

# Minimal default permissions for the entire workflow
permissions:
  contents: read       # Read repository contents
  # All other permissions are "none" by default

jobs:
  test:
    runs-on: ubuntu-latest
    # No additional permissions needed for testing
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test

  security-scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write  # Only this job needs security-events
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/analyze@v3

  deploy:
    runs-on: ubuntu-latest
    needs: [test, security-scan]
    if: github.ref == 'refs/heads/main'
    permissions:
      contents: read
      id-token: write      # OIDC for cloud auth
      deployments: write   # Create deployment records
    environment: production  # Requires approval
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: echo "Deploy to production"
```

### 3.2 Pin Actions to SHA (Not Tags)

```yaml
# BAD - Using version tags (can be moved to malicious commits)
steps:
  - uses: actions/checkout@v4          # Tag can be overwritten
  - uses: actions/setup-node@latest    # NEVER use latest
  - uses: some-org/some-action@main   # Branch reference, very dangerous

# GOOD - Pin to specific SHA (immutable)
steps:
  - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
  - uses: actions/setup-node@1a4442cacd436585916f3e22e7e1d1e84a3b9e78 # v4.0.1
  - uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502 # v4.0.2
```

```yaml
# Dependabot configuration to keep pinned SHAs updated
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "ci"
```

### 3.3 GITHUB_TOKEN Scope Minimization

```yaml
# The GITHUB_TOKEN is automatically available but should be scoped minimally

# Default token permissions can be restricted at the organization level:
# Settings > Actions > General > Workflow permissions > Read repository contents

# In the workflow, only grant what is needed:
permissions:
  contents: read          # Default read is usually sufficient
  pull-requests: write    # Only if the job comments on PRs
  issues: none            # Explicitly deny
  packages: none          # Explicitly deny
  actions: none           # Explicitly deny

# For package publishing:
jobs:
  publish:
    permissions:
      contents: read
      packages: write     # Only this job needs package write
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 3.4 Environment Protection Rules

```yaml
# GitHub environment configuration (set via UI or API)
# Repository > Settings > Environments

# Production environment:
#   - Required reviewers: 2 senior engineers
#   - Wait timer: 5 minutes (time for reviewer to verify)
#   - Deployment branches: main only
#   - Environment secrets: production-specific secrets

name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging  # Auto-deploys (no approval needed)
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
      - name: Deploy to staging
        run: ./deploy.sh staging
        env:
          API_KEY: ${{ secrets.STAGING_API_KEY }}

  integration-tests:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - run: ./run-integration-tests.sh

  deploy-production:
    needs: integration-tests
    runs-on: ubuntu-latest
    environment: production  # Requires 2 reviewers + 5-minute wait
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
      - name: Deploy to production
        run: ./deploy.sh production
        env:
          API_KEY: ${{ secrets.PRODUCTION_API_KEY }}
```

### 3.5 Self-Hosted Runner Security

```yaml
# Self-hosted runner security requirements:
# 1. Use ephemeral runners (destroy after each job)
# 2. Run in isolated VMs or containers (not on shared hosts)
# 3. Do not use self-hosted runners for public repositories
# 4. Clean up workspace after each job
# 5. Use runner groups to restrict which repos can use which runners

# Ephemeral runner configuration
name: Build
on: push

jobs:
  build:
    runs-on:
      group: private-runners  # Runner group with access control
      labels: [linux, x64, ephemeral]
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
      - run: npm ci && npm run build

      # Clean up (defense in depth, runner is destroyed after anyway)
      - name: Cleanup
        if: always()
        run: |
          rm -rf ${{ github.workspace }}/*
          rm -rf ~/.npm
          rm -rf ~/.cache
```

```hcl
# Terraform - Ephemeral GitHub Actions runner on AWS (using actions-runner-controller)
# The runner is created for each job and destroyed after
resource "helm_release" "actions_runner_controller" {
  name       = "actions-runner-controller"
  repository = "oci://ghcr.io/actions/actions-runner-controller-charts"
  chart      = "gha-runner-scale-set-controller"
  namespace  = "arc-systems"
  version    = "0.9.0"
}

resource "helm_release" "runner_scale_set" {
  name       = "arc-runner-set"
  repository = "oci://ghcr.io/actions/actions-runner-controller-charts"
  chart      = "gha-runner-scale-set"
  namespace  = "arc-runners"
  version    = "0.9.0"

  set {
    name  = "githubConfigUrl"
    value = "https://github.com/my-org"
  }

  set {
    name  = "minRunners"
    value = "0"
  }

  set {
    name  = "maxRunners"
    value = "10"
  }

  # Use Kubernetes mode for isolation
  set {
    name  = "containerMode.type"
    value = "kubernetes"
  }

  # Runner pod security context
  set {
    name  = "template.spec.securityContext.runAsNonRoot"
    value = "true"
  }

  set {
    name  = "template.spec.securityContext.runAsUser"
    value = "1000"
  }
}
```

---

## 4. GitLab CI Security

### 4.1 Protected Variables and Branches

```yaml
# .gitlab-ci.yml - Security-hardened pipeline
stages:
  - validate
  - test
  - security
  - build
  - deploy-staging
  - deploy-production

variables:
  # Non-sensitive variables can be here
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"

# Security scanning
sast:
  stage: security
  image: registry.gitlab.com/security-products/sast:latest
  script:
    - /analyzer run
  artifacts:
    reports:
      sast: gl-sast-report.json

dependency_scanning:
  stage: security
  image: registry.gitlab.com/security-products/dependency-scanning:latest
  script:
    - /analyzer run
  artifacts:
    reports:
      dependency_scanning: gl-dependency-scanning-report.json

secret_detection:
  stage: security
  image: registry.gitlab.com/security-products/secrets:latest
  script:
    - /analyzer run
  artifacts:
    reports:
      secret_detection: gl-secret-detection-report.json

# Build with signed artifacts
build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    # Sign the image
    - cosign sign --key env://COSIGN_KEY $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

# Deploy staging (automatic)
deploy_staging:
  stage: deploy-staging
  environment:
    name: staging
    url: https://staging.example.com
  script:
    - ./deploy.sh staging
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

# Deploy production (manual approval required)
deploy_production:
  stage: deploy-production
  environment:
    name: production
    url: https://example.com
  script:
    - ./deploy.sh production
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual  # Requires manual trigger
  # Only accessible to maintainers
  # Protected variables (PRODUCTION_*) only available in protected branches
```

### 4.2 Merge Request Approvals

```yaml
# GitLab merge request approval configuration
# Settings > Merge Requests > Approval Rules

# Rule 1: Security team must approve security-related changes
# Applies to: changes in security/, .gitlab-ci.yml, Dockerfile
# Required approvals: 1 from @security-team

# Rule 2: Platform team must approve infrastructure changes
# Applies to: changes in terraform/, kubernetes/
# Required approvals: 2 from @platform-team

# Rule 3: Any maintainer for all other changes
# Required approvals: 1 from any maintainer

# CODEOWNERS file - .gitlab/CODEOWNERS
# Security-sensitive files require security team approval
.gitlab-ci.yml @security-team
Dockerfile @security-team @platform-team
terraform/ @platform-team
kubernetes/ @platform-team
src/auth/ @security-team
src/crypto/ @security-team
```

---

## 5. Build Artifact Integrity

### 5.1 Container Image Signing

```yaml
# GitHub Actions - Sign container images with Cosign
name: Build and Sign

on:
  push:
    branches: [main]

permissions:
  contents: read
  packages: write
  id-token: write  # Needed for keyless signing

jobs:
  build-and-sign:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11

      - name: Install Cosign
        uses: sigstore/cosign-installer@59acb6260d9c0ba8f4a2f9d9b48431a222b68e20

      - name: Login to Registry
        uses: docker/login-action@343f7c4344506bcbf9b4de18042ae17996df046d
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push
        id: build
        uses: docker/build-push-action@0565240e2d4ab88bba5387d719585280857ece09
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}

      - name: Sign Image (Keyless with Sigstore)
        run: |
          cosign sign --yes \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}

      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: ghcr.io/${{ github.repository }}:${{ github.sha }}
          artifact-name: sbom.spdx.json
          output-file: sbom.spdx.json

      - name: Attach SBOM to Image
        run: |
          cosign attest --yes --predicate sbom.spdx.json \
            --type spdxjson \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}
```

### 5.2 Build Provenance (SLSA)

```yaml
# GitHub Actions - Generate SLSA provenance
name: SLSA Build

on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: write
  actions: read
  packages: write

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      digest: ${{ steps.build.outputs.digest }}

    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11

      - name: Build and Push Container
        id: build
        uses: docker/build-push-action@0565240e2d4ab88bba5387d719585280857ece09
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}

  provenance:
    needs: build
    permissions:
      actions: read
      id-token: write
      packages: write
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@v2.0.0
    with:
      image: ghcr.io/${{ github.repository }}
      digest: ${{ needs.build.outputs.digest }}
    secrets:
      registry-username: ${{ github.actor }}
      registry-password: ${{ secrets.GITHUB_TOKEN }}
```

### 5.3 Artifact Checksums

```yaml
# Generate and verify checksums for build artifacts
name: Build with Checksums

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11

      - name: Build
        run: |
          npm ci
          npm run build
          tar -czf dist.tar.gz dist/

      - name: Generate Checksums
        run: |
          sha256sum dist.tar.gz > checksums.sha256
          sha512sum dist.tar.gz > checksums.sha512
          cat checksums.sha256

      - name: Sign Checksums
        run: |
          cosign sign-blob --yes \
            --output-signature checksums.sha256.sig \
            --output-certificate checksums.sha256.cert \
            checksums.sha256

      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: |
            dist.tar.gz
            checksums.sha256
            checksums.sha512
            checksums.sha256.sig
            checksums.sha256.cert
```

---

## 6. Runner and Agent Security

### 6.1 Ephemeral Runners

```yaml
# Docker-based ephemeral runner (destroyed after each job)
# docker-compose.yml for self-hosted runner
version: "3.8"
services:
  runner:
    image: myorg/github-runner:latest
    environment:
      - RUNNER_NAME_PREFIX=ephemeral
      - RUNNER_SCOPE=org
      - RUNNER_TOKEN=${RUNNER_TOKEN}
      - ORG_NAME=my-org
      - LABELS=linux,x64,ephemeral
      - EPHEMERAL=true           # Destroy after one job
      - DISABLE_AUTO_UPDATE=true # Pin runner version
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp:size=2G
      - /home/runner/work:size=10G
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 4G
```

### 6.2 Runner Isolation

```yaml
# Kubernetes-based runner with pod security
apiVersion: v1
kind: Pod
metadata:
  name: ci-runner
  labels:
    app: ci-runner
spec:
  serviceAccountName: ci-runner-sa
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: runner
      image: myorg/github-runner:v2.314.0
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
      resources:
        requests:
          cpu: "1"
          memory: 2Gi
        limits:
          cpu: "2"
          memory: 4Gi
      volumeMounts:
        - name: work
          mountPath: /home/runner/work
        - name: tmp
          mountPath: /tmp
  volumes:
    - name: work
      emptyDir:
        sizeLimit: 10Gi
    - name: tmp
      emptyDir:
        sizeLimit: 2Gi
  # Node isolation for runners
  nodeSelector:
    node-type: ci-runner
  tolerations:
    - key: "ci-runner"
      operator: "Equal"
      value: "true"
      effect: "NoSchedule"
```

---

## 7. Pipeline-Level Access Control

### 7.1 Deployment Approval Gates

```yaml
# GitHub Actions - Multi-stage deployment with approval gates
name: Production Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
      - run: npm ci && npm test

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
      - name: Trivy vulnerability scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          severity: CRITICAL,HIGH
          exit-code: 1

  deploy-staging:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
      - run: ./deploy.sh staging

  smoke-test:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - run: ./smoke-tests.sh https://staging.example.com

  # Production deployment requires:
  # 1. All previous stages passed
  # 2. Manual approval from 2 required reviewers
  # 3. 10-minute wait timer
  deploy-production:
    needs: smoke-test
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://example.com
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11

      # Verify the commit SHA matches what was tested
      - name: Verify deployment artifact
        run: |
          TESTED_SHA="${{ github.sha }}"
          echo "Deploying commit: $TESTED_SHA"
          # Verify artifact checksum matches the tested build
          cosign verify-blob \
            --certificate checksums.sha256.cert \
            --signature checksums.sha256.sig \
            checksums.sha256

      - run: ./deploy.sh production

  # Post-deployment verification
  verify-production:
    needs: deploy-production
    runs-on: ubuntu-latest
    steps:
      - run: ./smoke-tests.sh https://example.com
      - name: Notify on failure
        if: failure()
        run: |
          # Trigger rollback on failure
          echo "Production verification failed - initiating rollback"
```

### 7.2 Who Can Trigger and Approve

```yaml
# GitHub Actions - Restrict who can trigger deployments
name: Restricted Deploy

on:
  workflow_dispatch:
    inputs:
      environment:
        description: "Target environment"
        required: true
        type: choice
        options:
          - staging
          - production
      version:
        description: "Version to deploy"
        required: true
        type: string

jobs:
  validate-actor:
    runs-on: ubuntu-latest
    steps:
      - name: Check actor permissions
        run: |
          # Verify the actor is authorized to trigger deployments
          AUTHORIZED_ACTORS="user1,user2,user3"
          if [[ ! ",$AUTHORIZED_ACTORS," == *",${{ github.actor }},"* ]]; then
            echo "ERROR: ${{ github.actor }} is not authorized to trigger deployments"
            exit 1
          fi

  deploy:
    needs: validate-actor
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
        with:
          ref: ${{ github.event.inputs.version }}
      - run: ./deploy.sh ${{ github.event.inputs.environment }}
```

---

## 8. Audit Logging for Pipeline Activities

```yaml
# GitHub Actions - Comprehensive audit logging
name: Audited Deploy

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Record deployment start
        run: |
          cat << EOF > deployment-record.json
          {
            "event": "deployment_started",
            "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
            "actor": "${{ github.actor }}",
            "repository": "${{ github.repository }}",
            "commit_sha": "${{ github.sha }}",
            "ref": "${{ github.ref }}",
            "run_id": "${{ github.run_id }}",
            "run_number": "${{ github.run_number }}",
            "environment": "production",
            "workflow": "${{ github.workflow }}",
            "trigger": "${{ github.event_name }}",
            "approvers": "${{ toJSON(github.event.review.user.login) }}"
          }
          EOF

          # Send to audit log system
          aws logs put-log-events \
            --log-group-name "/cicd/deployments" \
            --log-stream-name "${{ github.repository }}" \
            --log-events "timestamp=$(date +%s000),message=$(cat deployment-record.json)"

      - name: Deploy
        run: ./deploy.sh production

      - name: Record deployment result
        if: always()
        run: |
          STATUS="${{ job.status }}"
          cat << EOF > deployment-result.json
          {
            "event": "deployment_completed",
            "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
            "actor": "${{ github.actor }}",
            "commit_sha": "${{ github.sha }}",
            "environment": "production",
            "status": "$STATUS",
            "run_id": "${{ github.run_id }}"
          }
          EOF

          aws logs put-log-events \
            --log-group-name "/cicd/deployments" \
            --log-stream-name "${{ github.repository }}" \
            --log-events "timestamp=$(date +%s000),message=$(cat deployment-result.json)"
```

---

## 9. Supply Chain Security in CI/CD

### 9.1 SLSA Framework Levels

```
+-------+----------------------------------------------+---------------------------+
| Level | Requirements                                 | Trust                     |
+-------+----------------------------------------------+---------------------------+
| 0     | No guarantees                                | None                      |
| 1     | Documentation of build process               | Basic provenance          |
| 2     | Hosted build service, authenticated provenance| Tamper-evident            |
| 3     | Hardened build platform, non-falsifiable      | Tamper-resistant          |
| 4     | Two-person review, hermetic builds            | Maximum assurance         |
+-------+----------------------------------------------+---------------------------+
```

### 9.2 Sigstore Integration

```yaml
# Complete supply chain security with Sigstore
name: Secure Build Pipeline

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
      packages: write
      attestations: write

    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11

      - name: Install Cosign
        uses: sigstore/cosign-installer@59acb6260d9c0ba8f4a2f9d9b48431a222b68e20

      - name: Build Image
        id: build
        run: |
          docker build -t ghcr.io/${{ github.repository }}:${{ github.sha }} .
          docker push ghcr.io/${{ github.repository }}:${{ github.sha }}
          DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' \
            ghcr.io/${{ github.repository }}:${{ github.sha }} | cut -d@ -f2)
          echo "digest=$DIGEST" >> $GITHUB_OUTPUT

      # Sign the image (keyless - uses OIDC identity)
      - name: Sign Image
        run: |
          cosign sign --yes \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}

      # Generate and attach SBOM
      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: ghcr.io/${{ github.repository }}:${{ github.sha }}
          output-file: sbom.spdx.json

      - name: Attach SBOM Attestation
        run: |
          cosign attest --yes \
            --predicate sbom.spdx.json \
            --type spdxjson \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}

      # Generate vulnerability scan attestation
      - name: Vulnerability Scan
        run: |
          trivy image --format cosign-vuln \
            --output vuln-report.json \
            ghcr.io/${{ github.repository }}:${{ github.sha }}

      - name: Attach Vulnerability Attestation
        run: |
          cosign attest --yes \
            --predicate vuln-report.json \
            --type vuln \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}

  # Verify before deployment
  verify-and-deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Verify Image Signature
        run: |
          cosign verify \
            --certificate-identity-regexp=".*@my-org\\.com" \
            --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
            ghcr.io/${{ github.repository }}@${{ needs.build.outputs.digest }}

      - name: Verify SBOM Attestation
        run: |
          cosign verify-attestation \
            --type spdxjson \
            --certificate-identity-regexp=".*@my-org\\.com" \
            --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
            ghcr.io/${{ github.repository }}@${{ needs.build.outputs.digest }}

      - name: Deploy
        run: echo "Deploy verified image"
```

---

## 10. Secret Scanning in CI

```yaml
# Comprehensive secret scanning pipeline
name: Secret Scanning

on:
  pull_request:
  push:
    branches: [main]

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
        with:
          fetch-depth: 0  # Full history for scanning

      - name: Gitleaks scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  trufflehog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
        with:
          fetch-depth: 0

      - name: TruffleHog scan
        uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified --json

  detect-secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11

      - name: Run detect-secrets
        run: |
          pip install detect-secrets
          detect-secrets scan --all-files --force-use-all-plugins > .secrets-new.json
          detect-secrets audit --report .secrets-new.json
```

```yaml
# Gitleaks configuration - .gitleaks.toml
[allowlist]
description = "Allowlisted files and patterns"
paths = [
    '''(^|/)\.gitleaks\.toml$''',
    '''(^|/)test/fixtures/''',
]

[[rules]]
id = "aws-access-key"
description = "AWS Access Key"
regex = '''AKIA[0-9A-Z]{16}'''
tags = ["aws", "credentials"]

[[rules]]
id = "generic-api-key"
description = "Generic API Key"
regex = '''(?i)(api[_-]?key|apikey)[\s]*[=:]\s*['\"][a-zA-Z0-9]{20,}['\"]'''
tags = ["api", "generic"]

[[rules]]
id = "private-key"
description = "Private Key"
regex = '''-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'''
tags = ["key", "private"]

[[rules]]
id = "github-token"
description = "GitHub Token"
regex = '''(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}'''
tags = ["github", "token"]
```

---

## 11. Best Practices

1. **Use OIDC federation for cloud authentication** -- eliminate long-lived cloud
   credentials entirely; use GitHub Actions OIDC, GitLab CI OIDC, or equivalent to
   obtain short-lived credentials for every pipeline run.

2. **Pin all third-party actions and plugins to SHA** -- never use version tags (v1,
   v2) or branch references (main) for actions; pin to specific commit SHAs to prevent
   supply chain attacks through tag manipulation.

3. **Apply least-privilege permissions to GITHUB_TOKEN** -- set the minimum permissions
   at the workflow level and override per-job only when needed; disable write access by
   default at the organization level.

4. **Require environment protection rules for production** -- configure required
   reviewers (minimum 2), wait timers, and deployment branch restrictions for
   production environments; all production deployments must be approved.

5. **Sign build artifacts and verify before deployment** -- use Cosign/Sigstore for
   keyless container image signing; attach SBOM and vulnerability attestations;
   verify signatures at deployment time.

6. **Use ephemeral, isolated runners** -- destroy runners after each job to prevent
   persistent compromise; run in isolated VMs or containers; never use self-hosted
   runners for public repositories.

7. **Scan for secrets in every pipeline run** -- use gitleaks, TruffleHog, or
   detect-secrets to scan for accidentally committed credentials; fail the pipeline
   if secrets are detected.

8. **Implement multi-stage deployment with approval gates** -- deploy to staging first,
   run integration tests, require manual approval for production, and verify after
   deployment; roll back automatically on failure.

9. **Generate and publish SLSA provenance** -- use SLSA GitHub Generator or equivalent
   to create tamper-evident build provenance; target SLSA Level 3 for production
   artifacts.

10. **Audit all pipeline activities** -- log every build, test, scan, and deployment
    with the actor identity, timestamp, commit SHA, and result; retain audit logs for
    compliance and incident investigation.

---

## 12. Anti-Patterns

1. **Storing cloud access keys as repository secrets** -- long-lived credentials can be
   exfiltrated through compromised actions or log leaks; use OIDC federation to
   eliminate static credentials entirely.

2. **Using actions/checkout without pinning** -- the checkout action runs before any
   security scanning; a compromised checkout action could modify the repository
   contents before they are scanned; pin to SHA.

3. **Running self-hosted runners on shared infrastructure** -- self-hosted runners that
   process untrusted code (from PRs) can be compromised; compromised runners with
   access to the host can steal secrets from other projects.

4. **Printing secrets in build logs** -- even masked secrets can be exfiltrated through
   encoding tricks (base64, hex); minimize secret exposure in pipeline scripts; use
   dedicated secret injection mechanisms.

5. **Deploying to production without approval gates** -- automated deployment to
   production without human review creates a path from a single compromised developer
   account to production; always require approval.

6. **Using the same secrets across all environments** -- production secrets should be
   isolated to the production environment; staging and development should use separate
   credentials to limit blast radius.

7. **Skipping artifact verification at deployment time** -- signing artifacts without
   verifying them before deployment provides no security value; the verification step
   is where trust is established.

8. **Allowing pipeline configuration changes without review** -- changes to CI/CD
   configuration files (.github/workflows/, .gitlab-ci.yml, Jenkinsfile) should
   require security team review through CODEOWNERS; these files control the
   deployment path to production.

---

## 13. Enforcement Checklist

### Authentication and Credentials
- [ ] OIDC federation is used for all cloud provider authentication (no static keys)
- [ ] No long-lived credentials stored in CI/CD secrets
- [ ] CI/CD service accounts use least-privilege IAM roles
- [ ] Credentials are scoped to specific branches and environments
- [ ] Secret rotation is automated where static secrets are unavoidable

### Pipeline Security
- [ ] All third-party actions/plugins are pinned to SHA
- [ ] GITHUB_TOKEN (or equivalent) uses minimal permissions
- [ ] Dependabot or Renovate keeps action versions updated
- [ ] Pipeline configuration files require security team review (CODEOWNERS)
- [ ] Branch protection prevents direct pushes to main

### Deployment Controls
- [ ] Production deployments require 2+ reviewer approvals
- [ ] Environment protection rules are configured (wait timer, branch restriction)
- [ ] Staging deployment and testing precede production deployment
- [ ] Deployment artifacts are signed and verified before production deployment
- [ ] Rollback procedures are documented and tested

### Secret Scanning
- [ ] Gitleaks, TruffleHog, or detect-secrets runs on every PR
- [ ] Pre-commit hooks prevent secrets from being committed locally
- [ ] Secret scanning results are reviewed and remediated within 24 hours
- [ ] Historical secret scanning has been performed on the full repository

### Build Integrity
- [ ] Container images are signed with Cosign/Sigstore
- [ ] SBOM is generated and attached to every build artifact
- [ ] SLSA provenance is generated for production artifacts
- [ ] Artifact checksums are generated and signed
- [ ] Image signatures are verified by admission controllers before deployment

### Runner Security
- [ ] Runners are ephemeral (destroyed after each job)
- [ ] Runners are isolated in VMs or containers with security contexts
- [ ] Self-hosted runners are not used for public repository forks
- [ ] Runner images are hardened and scanned for vulnerabilities
- [ ] Runner access is restricted through runner groups

### Audit and Monitoring
- [ ] All pipeline executions are logged with actor, SHA, and result
- [ ] Deployment events are sent to a centralized audit log
- [ ] Alerts are configured for failed deployments and security scan failures
- [ ] Pipeline audit logs are retained for compliance (minimum 1 year)
- [ ] Regular review of pipeline access and permissions (quarterly)
