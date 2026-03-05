---
paths:
  - "Dockerfile*"
  - "docker-compose*.yml"
  - "*.tf"
  - "*.yaml"
  - "k8s/**"
  - "infra/**"
  - "terraform/**"
---
## Infrastructure as Code

### General IaC Principles
- ALL infrastructure MUST be defined in code — no manual resource creation in any environment
- Infrastructure code is version controlled in the same repository or a dedicated infra repository
- Infrastructure changes go through the same PR review process as application code
- Use declarative definitions over imperative scripts — describe desired state, not steps
- Environments (dev, staging, prod) use the SAME templates with different variable files
- NEVER apply infrastructure changes directly — always go through plan/preview then apply
- Document every infrastructure component's purpose in comments or a companion README

### Terraform & CloudFormation Patterns
- Organize by environment and service: `infra/{env}/{service}/main.tf`
- Use modules for reusable components — never copy-paste resource blocks across environments
- Remote state storage with locking (S3 + DynamoDB for Terraform, or equivalent)
- NEVER store state files locally or commit them to version control
- Pin provider versions exactly: `required_providers { aws = { version = "= 5.40.0" } }`
- Use `terraform plan` / changeset preview in CI — require human approval for production applies
- Name resources descriptively: `{project}-{env}-{service}-{resource}` (e.g., `myapp-prod-api-alb`)
- Use data sources to reference existing resources — never hardcode ARNs, IDs, or IP addresses
- Output values that downstream modules or applications need — document each output

### Kubernetes Manifests
- Use namespaces to isolate environments and services — never deploy to `default`
- ALWAYS set resource requests AND limits for CPU and memory on every container
- Define liveness and readiness probes for every deployment — use appropriate timeouts
- Use `PodDisruptionBudget` for critical services — ensure availability during node maintenance
- Pin container image tags to specific versions or SHA digests — never use `:latest`
- Store configuration in `ConfigMap`, secrets in `Secret` or external secrets operator
- Use `RollingUpdate` strategy with `maxSurge` and `maxUnavailable` configured explicitly
- Apply standard labels on all resources:
  - `app.kubernetes.io/name`, `app.kubernetes.io/version`, `app.kubernetes.io/component`
  - `app.kubernetes.io/managed-by`, `app.kubernetes.io/part-of`

### Secrets in Infrastructure
- NEVER store plaintext secrets in IaC files, variable files, or version control
- Use external secrets management: Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault
- For Kubernetes: use Sealed Secrets or External Secrets Operator — never plain `Secret` manifests with base64 values in Git
- Reference secrets by path/ARN in IaC — never inline the secret value
- Encrypt sensitive Terraform state at rest — enable server-side encryption on state backend
- Rotate infrastructure credentials (cloud provider keys, service accounts) on schedule

### Resource Tagging & Organization
- Apply mandatory tags to EVERY resource:
  - `project` — project or product name
  - `environment` — dev, staging, production
  - `owner` — team or individual responsible
  - `managed-by` — terraform, cloudformation, manual
  - `cost-center` — billing allocation identifier
- Enforce tagging via policy (AWS SCP, Azure Policy, OPA/Gatekeeper)
- Use tags for cost tracking — review resource costs by tag weekly
- Clean up untagged resources — they indicate drift or manual creation

### Infrastructure Testing & Validation
- Lint all IaC files in CI: `terraform validate`, `tflint`, `kubeval`, `hadolint` for Dockerfiles
- Run `terraform plan` on every PR — post plan output as PR comment for review
- Use policy-as-code (OPA/Rego, Sentinel, Checkov) to enforce security and compliance rules
- Detect configuration drift: schedule periodic plan runs and alert on unexpected differences
- Test infrastructure modules with tools like Terratest or kitchen-terraform before promoting
- Verify environment parity: staging and production MUST use the same module versions
