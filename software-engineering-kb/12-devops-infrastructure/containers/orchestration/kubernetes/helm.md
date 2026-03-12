# Helm: Kubernetes Package Management

| Field | Value |
|---|---|
| **Domain** | DevOps > Containers > Kubernetes |
| **Importance** | High |
| **Last Updated** | 2026-03-10 |
| **Cross-references** | [Deployments & Services](deployments-services.md), [GitOps](../../ci-cd/gitops.md) |

---

## Core Concepts

### Helm Overview

Helm is the package manager for Kubernetes. It packages manifests into versioned,
configurable charts that simplify deployment, upgrades, and rollbacks.

| Concept | Description |
|---|---|
| **Chart** | Package of Kubernetes templates + default values |
| **Release** | A chart deployed to a cluster with specific values |
| **Repository** | HTTP server or OCI registry hosting charts |
| **Values** | Configuration that customizes a chart per environment |

```bash
# Add a repository
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Search for charts
helm search repo postgresql --versions

# Install a release
helm install my-postgres bitnami/postgresql \
  --namespace database --create-namespace \
  --values values-production.yaml \
  --version 16.2.1

# Upgrade a release
helm upgrade my-postgres bitnami/postgresql \
  --namespace database \
  --values values-production.yaml \
  --version 16.3.0

# Rollback
helm rollback my-postgres 1 --namespace database

# List releases
helm list --all-namespaces

# Uninstall
helm uninstall my-postgres --namespace database
```

### Chart Structure

```
my-chart/
├── Chart.yaml              # Chart metadata (name, version, dependencies)
├── Chart.lock              # Dependency lock file
├── values.yaml             # Default configuration values
├── values.schema.json      # JSON Schema for values validation
├── templates/
│   ├── _helpers.tpl        # Named template definitions (partials)
│   ├── deployment.yaml     # Deployment template
│   ├── service.yaml        # Service template
│   ├── ingress.yaml        # Ingress template
│   ├── configmap.yaml      # ConfigMap template
│   ├── secret.yaml         # Secret template
│   ├── hpa.yaml            # HPA template
│   ├── pdb.yaml            # PodDisruptionBudget template
│   ├── serviceaccount.yaml # ServiceAccount template
│   ├── NOTES.txt           # Post-install instructions (rendered)
│   └── tests/
│       └── test-connection.yaml  # Helm test Pod
├── charts/                 # Dependency sub-charts
└── .helmignore             # Files to exclude from packaging
```

#### Chart.yaml

```yaml
apiVersion: v2
name: api-server
description: Production API server for example.com
type: application            # or "library"
version: 1.5.0               # Chart version (SemVer)
appVersion: "2.4.1"          # Application version
maintainers:
  - name: Platform Team
    email: platform@example.com
dependencies:
  - name: postgresql
    version: "16.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: "19.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

#### values.yaml

```yaml
replicaCount: 3

image:
  repository: registry.example.com/api-server
  tag: ""                    # Defaults to appVersion from Chart.yaml
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: api.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: api-tls
      hosts:
        - api.example.com

resources:
  requests:
    cpu: 250m
    memory: 512Mi
  limits:
    cpu: "1"
    memory: 1Gi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70

postgresql:
  enabled: false             # Disabled by default; enable per environment

redis:
  enabled: false
```

### Template Syntax

Helm uses Go templates with Sprig functions. Master these patterns:

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "api-server.fullname" . }}
  labels:
    {{- include "api-server.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "api-server.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
      labels:
        {{- include "api-server.labels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ include "api-server.serviceAccountName" . }}
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 8080
          {{- with .Values.resources }}
          resources:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          envFrom:
            - configMapRef:
                name: {{ include "api-server.fullname" . }}
          {{- range .Values.extraEnvSecrets }}
            - secretRef:
                name: {{ . }}
          {{- end }}
```

#### Named Templates (_helpers.tpl)

```yaml
# templates/_helpers.tpl
{{- define "api-server.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{- define "api-server.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "api-server.fullname" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "api-server.selectorLabels" -}}
app.kubernetes.io/name: {{ include "api-server.fullname" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "api-server.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "api-server.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
```

Key template functions:

| Function | Purpose | Example |
|---|---|---|
| `include` | Render a named template | `{{ include "chart.fullname" . }}` |
| `toYaml` | Convert value to YAML | `{{ toYaml .Values.resources \| nindent 12 }}` |
| `nindent` | Newline + indent | Proper YAML indentation |
| `default` | Fallback value | `{{ .Values.tag \| default .Chart.AppVersion }}` |
| `quote` | Quote a string | `{{ .Values.env \| quote }}` |
| `sha256sum` | Hash for change detection | `checksum/config: {{ ... \| sha256sum }}` |
| `tpl` | Render string as template | `{{ tpl .Values.annotations . }}` |
| `required` | Fail if value missing | `{{ required "image.tag is required" .Values.image.tag }}` |

### Values Management

Use multiple values files per environment and merge them at install time:

```bash
# Base values + environment overlay + secrets
helm upgrade api-server ./charts/api-server \
  --namespace production \
  --values values.yaml \
  --values values-production.yaml \
  --set image.tag=v2.5.0
```

```yaml
# values-production.yaml (overrides values.yaml)
replicaCount: 5

resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: "2"
    memory: 2Gi

ingress:
  hosts:
    - host: api.example.com
      paths:
        - path: /
          pathType: Prefix

postgresql:
  enabled: true
```

Values precedence (last wins): `values.yaml` < `--values file` < `--set`.

### Helm Hooks

Hooks execute at specific points in the release lifecycle:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "api-server.fullname" . }}-migrate
  annotations:
    "helm.sh/hook": pre-upgrade,pre-install
    "helm.sh/hook-weight": "0"          # Lower runs first
    "helm.sh/hook-delete-policy": hook-succeeded
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          command: ["./migrate", "up"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: url
```

| Hook | When |
|---|---|
| `pre-install` | Before any resources are created |
| `post-install` | After all resources are created |
| `pre-upgrade` | Before upgrade begins |
| `post-upgrade` | After upgrade completes |
| `pre-delete` | Before deletion begins |
| `pre-rollback` | Before rollback begins |
| `test` | When `helm test` runs |

### Chart Dependencies and Subcharts

```bash
# Update dependencies (downloads to charts/ directory)
helm dependency update ./charts/api-server

# Build dependencies
helm dependency build ./charts/api-server
```

Override subchart values by nesting under the dependency name:

```yaml
# values.yaml
postgresql:
  enabled: true
  auth:
    postgresPassword: override-in-secrets
    database: myapp
  primary:
    persistence:
      size: 100Gi
```

### Creating a Chart from Scratch

```bash
# Scaffold a new chart
helm create api-server

# Render templates locally (debug)
helm template api-server ./charts/api-server \
  --values values-staging.yaml \
  --debug

# Dry-run against cluster (validates with API server)
helm install api-server ./charts/api-server \
  --dry-run --debug \
  --namespace staging

# Package for distribution
helm package ./charts/api-server --version 1.5.0

# Push to OCI registry
helm push api-server-1.5.0.tgz oci://registry.example.com/charts
```

### Helmfile for Declarative Management

Helmfile manages multiple Helm releases declaratively:

```yaml
# helmfile.yaml
repositories:
  - name: bitnami
    url: https://charts.bitnami.com/bitnami
  - name: ingress-nginx
    url: https://kubernetes.github.io/ingress-nginx

environments:
  staging:
    values:
      - environments/staging.yaml
  production:
    values:
      - environments/production.yaml

releases:
  - name: ingress-nginx
    namespace: ingress-system
    chart: ingress-nginx/ingress-nginx
    version: 4.11.x
    values:
      - ingress-values.yaml

  - name: api-server
    namespace: {{ .Environment.Name }}
    chart: ./charts/api-server
    version: 1.5.0
    values:
      - values.yaml
      - values-{{ .Environment.Name }}.yaml
    needs:
      - ingress-system/ingress-nginx

  - name: postgresql
    namespace: database
    chart: bitnami/postgresql
    version: 16.2.x
    values:
      - postgres-values.yaml
      - postgres-{{ .Environment.Name }}.yaml
    condition: postgresql.enabled
```

```bash
helmfile -e production sync       # Apply all releases for production
helmfile -e production diff       # Show pending changes
helmfile -e staging destroy       # Tear down staging
```

### Chart Testing

```bash
# Lint chart for errors
helm lint ./charts/api-server --values values-production.yaml

# Run chart-testing (ct) for CI
ct lint --charts ./charts/api-server
ct install --charts ./charts/api-server --namespace test

# Run Helm tests (Pods with hook-test annotation)
helm test api-server --namespace production
```

### OCI Registries for Helm Charts

Helm 3.8+ supports OCI registries natively. Store charts alongside container images.

```bash
# Login to OCI registry
helm registry login registry.example.com

# Push chart
helm push api-server-1.5.0.tgz oci://registry.example.com/charts

# Pull chart
helm pull oci://registry.example.com/charts/api-server --version 1.5.0

# Install from OCI
helm install api-server oci://registry.example.com/charts/api-server \
  --version 1.5.0 --namespace production
```

### Helm vs Kustomize

| Aspect | Helm | Kustomize |
|---|---|---|
| **Approach** | Templating | Overlay patching |
| **Complexity** | Higher (Go templates) | Lower (plain YAML) |
| **Parameterization** | Full templating (loops, conditionals) | Strategic merge patches |
| **Package management** | Charts, repos, versioning | No packaging concept |
| **Third-party charts** | Large ecosystem (Artifact Hub) | Must fork upstream YAML |
| **Best for** | Distributing reusable packages | Customizing per-environment |

Use Helm when distributing reusable applications or managing complex third-party
deployments. Use Kustomize when the team prefers pure YAML with overlays for simple
environment differences. Combine both: Helm for chart rendering + Kustomize for
final environment patches.

### Helm + GitOps (ArgoCD / Flux)

Integrate Helm with GitOps controllers for declarative, Git-driven deployments.

```yaml
# ArgoCD Application using Helm chart
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: api-server
  namespace: argocd
spec:
  project: production
  source:
    repoURL: https://registry.example.com/charts
    chart: api-server
    targetRevision: 1.5.0
    helm:
      releaseName: api-server
      valueFiles:
        - values-production.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
---
# Flux HelmRelease
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: api-server
  namespace: production
spec:
  interval: 5m
  chart:
    spec:
      chart: api-server
      version: "1.5.x"
      sourceRef:
        kind: HelmRepository
        name: internal-charts
  values:
    replicaCount: 5
    image:
      tag: v2.5.0
  upgrade:
    remediation:
      retries: 3
```

### Chart Versioning and Release Management

Follow SemVer for chart versions (`version` in Chart.yaml):

| Change | Version Bump | Example |
|---|---|---|
| Breaking template changes | Major | 1.5.0 -> 2.0.0 |
| New features, new values | Minor | 1.5.0 -> 1.6.0 |
| Bug fixes, doc updates | Patch | 1.5.0 -> 1.5.1 |

Keep `appVersion` in sync with the deployed application version. Automate chart
versioning in CI: bump chart version on every merge to main.

---

## Best Practices

1. **Validate values with JSON Schema** -- Create `values.schema.json` to catch configuration errors before deployment.
2. **Use `required` function for mandatory values** -- Fail fast with clear error messages instead of deploying broken manifests.
3. **Include config checksums in Pod annotations** -- `checksum/config: {{ include ... | sha256sum }}` triggers Pod restart on ConfigMap changes.
4. **Pin dependency versions** -- Use `Chart.lock` for reproducible builds; run `helm dependency update` explicitly.
5. **Store charts in OCI registries** -- Co-locate with container images; leverage existing registry auth and replication.
6. **Use Helmfile for multi-release orchestration** -- Declare release ordering, environment-specific values, and conditional releases.
7. **Template only what varies** -- Do not over-template; keep templates readable. If a value never changes, hardcode it.
8. **Set `hook-delete-policy: hook-succeeded`** -- Prevent completed hook Jobs from lingering and consuming resources.
9. **Run `helm diff` before upgrades** -- Use the helm-diff plugin to preview changes before applying to production.
10. **Integrate Helm with GitOps** -- ArgoCD or Flux for automated sync; Git as the single source of truth for release state.

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Over-templating everything** | Templates become unreadable and hard to debug | Template only values that change per environment; hardcode the rest |
| **No values schema validation** | Invalid configuration deployed; cryptic template errors | Create `values.schema.json` with required fields and type constraints |
| **Using `helm install` in production** | Imperative; no audit trail; drift from desired state | Use GitOps (ArgoCD/Flux) with Helm chart sources |
| **Chart version not bumped** | Same version contains different templates; caching issues | Bump chart version on every change; automate in CI |
| **Secrets in values files** | Credentials committed to Git in plaintext | Use external-secrets-operator, sealed-secrets, or SOPS-encrypted values |
| **No `helm diff` before upgrade** | Unexpected changes deployed to production | Install helm-diff plugin; run `helm diff upgrade` in CI before apply |
| **Ignoring hook cleanup** | Completed hook Pods accumulate in the namespace | Set `helm.sh/hook-delete-policy: hook-succeeded,before-hook-creation` |
| **Tightly coupled subcharts** | Chart cannot be deployed without all dependencies | Use `condition` flags to make dependencies optional |

---

## Enforcement Checklist

- [ ] `values.schema.json` exists and validates all required values
- [ ] Chart version follows SemVer and is bumped on every change
- [ ] `Chart.lock` committed to Git for reproducible dependency resolution
- [ ] `helm lint` and `ct lint` pass in CI pipeline
- [ ] `helm template` renders valid YAML (validated with `kubeconform` or `kubeval`)
- [ ] Secrets managed externally (external-secrets-operator, SOPS, sealed-secrets)
- [ ] Helm hooks have `hook-delete-policy` set
- [ ] Production deployments managed via GitOps (ArgoCD or Flux), not imperative `helm install`
- [ ] `helm diff` runs before every production upgrade
- [ ] Charts published to OCI registry with automated CI pipeline
- [ ] Named templates in `_helpers.tpl` follow standard label conventions
- [ ] ConfigMap/Secret changes trigger Pod rollout via annotation checksums
