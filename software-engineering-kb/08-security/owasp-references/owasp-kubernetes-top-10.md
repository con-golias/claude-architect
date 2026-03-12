# OWASP Kubernetes Top 10 -- Comprehensive Reference Guide

## Metadata

| Field            | Value                                              |
| ---------------- | -------------------------------------------------- |
| Title            | OWASP Kubernetes Top 10                            |
| Version          | 2022 (Latest)                                      |
| Audience         | DevOps, SRE, Platform Engineers, Security Teams     |
| Format           | YAML, Helm, Kyverno/OPA Policies                   |
| Last Updated     | 2022                                               |

## Overview

The OWASP Kubernetes Top 10 identifies the most critical security risks in Kubernetes deployments. Kubernetes orchestrates containerized workloads at scale, but its flexibility and complexity create a vast attack surface. Misconfigurations, excessive permissions, and inadequate monitoring are the primary causes of Kubernetes security incidents.

### Categories

| Rank | Category                               | Description                                      |
| ---- | -------------------------------------- | ------------------------------------------------ |
| K01  | Insecure Workload Configurations       | Privileged containers, missing security context  |
| K02  | Supply Chain Vulnerabilities           | Untrusted images, poisoned base images           |
| K03  | Overly Permissive RBAC                 | Excessive cluster/namespace permissions          |
| K04  | Lack of Centralized Policy Enforcement | No admission control, no policy engine           |
| K05  | Inadequate Logging and Monitoring      | Missing audit logs, no runtime detection         |
| K06  | Broken Authentication Mechanisms       | Weak auth, exposed API server, service tokens    |
| K07  | Missing Network Segmentation           | Flat network, no network policies                |
| K08  | Secrets Management Failures            | Secrets in plain text, exposed env vars          |
| K09  | Misconfigured Cluster Components       | Insecure kubelet, etcd, API server settings      |
| K10  | Outdated and Vulnerable K8s Components | Unpatched nodes, old K8s versions, CVEs          |

---

## K01: Insecure Workload Configurations

### Description

Insecure workload configurations are the most common Kubernetes security issue. Running containers as root, with privileged mode enabled, or without security contexts exposes the cluster to container escape attacks and privilege escalation. Default Kubernetes settings are permissive and must be hardened.

### Attack Scenario

A developer deploys a web application container running as root with privileged mode enabled. An attacker exploits a remote code execution vulnerability in the application, escapes the container using the privileged access, gains root access to the host node, and pivots to other containers and the cluster control plane.

### Vulnerable Config

```yaml
# VULNERABLE: Insecure workload configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: web-app
          image: myregistry/web-app:latest   # Mutable tag
          # No securityContext -- runs as root by default
          # No resource limits -- can consume all node resources
          ports:
            - containerPort: 8080
          volumeMounts:
            - name: host-fs
              mountPath: /host
      volumes:
        - name: host-fs
          hostPath:
            path: /              # Full host filesystem access!
```

### Secure Config

```yaml
# SECURE: Hardened workload configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      automountServiceAccountToken: false  # Disable default token mount
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        runAsGroup: 10001
        fsGroup: 10001
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: web-app
          image: myregistry/web-app@sha256:abc123def456...  # Immutable digest
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
            # No privileged: true
            # No hostNetwork: true
            # No hostPID: true
          ports:
            - containerPort: 8080
              protocol: TCP
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir:
            sizeLimit: "100Mi"
      # No hostPath volumes
```

### Kyverno Policy -- Enforce Non-Root

```yaml
# Kyverno policy: Require non-root containers
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-run-as-non-root
  annotations:
    policies.kyverno.io/title: Require Run As Non-Root
    policies.kyverno.io/category: Pod Security
    policies.kyverno.io/severity: high
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: run-as-non-root
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Containers must run as non-root. Set securityContext.runAsNonRoot to true."
        pattern:
          spec:
            securityContext:
              runAsNonRoot: true
            containers:
              - securityContext:
                  allowPrivilegeEscalation: false
                  capabilities:
                    drop:
                      - ALL
```

### OPA/Gatekeeper Policy -- Deny Privileged Containers

```yaml
# OPA Gatekeeper ConstraintTemplate
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8sdenyprivileged
spec:
  crd:
    spec:
      names:
        kind: K8sDenyPrivileged
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8sdenyprivileged

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          container.securityContext.privileged == true
          msg := sprintf("Privileged containers are not allowed: %v", [container.name])
        }

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.securityContext.allowPrivilegeEscalation == false
          msg := sprintf("allowPrivilegeEscalation must be false: %v", [container.name])
        }
---
# Apply the constraint
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sDenyPrivileged
metadata:
  name: deny-privileged-containers
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
```

### Prevention

- [ ] Run containers as non-root with read-only root filesystem
- [ ] Drop all Linux capabilities and add only those explicitly needed
- [ ] Disable privilege escalation (`allowPrivilegeEscalation: false`)
- [ ] Set resource requests and limits for all containers
- [ ] Use immutable image references (digests, not tags)
- [ ] Disable automatic service account token mounting
- [ ] Never use hostPath volumes, hostNetwork, or hostPID
- [ ] Enable seccomp and AppArmor profiles

---

## K02: Supply Chain Vulnerabilities

### Description

Container supply chain vulnerabilities include untrusted base images, images with known CVEs, compromised registries, and unsigned images. Attackers can inject malicious code through poisoned base images or compromise the build pipeline to inject backdoors into container images.

### Attack Scenario

A developer uses `FROM ubuntu:latest` as the base image. The image contains known vulnerabilities including a critical OpenSSL CVE. An attacker exploits the vulnerability to gain code execution in the container. Additionally, images are pulled from Docker Hub without signature verification.

### Vulnerable Config

```yaml
# VULNERABLE: Untrusted image, no signature verification
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
    - name: app
      image: random-user/app:latest   # Untrusted source, mutable tag
      imagePullPolicy: Always          # Pulls latest every time -- could change
```

```dockerfile
# VULNERABLE: Dockerfile with security issues
FROM ubuntu:latest
RUN apt-get update && apt-get install -y curl wget
COPY . /app
RUN chmod 777 /app
USER root
CMD ["/app/server"]
```

### Secure Config

```yaml
# SECURE: Trusted registry, image digest, pull policy
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
    - name: app
      image: myregistry.azurecr.io/app@sha256:a1b2c3d4e5f6...  # Pinned digest
      imagePullPolicy: IfNotPresent
  imagePullSecrets:
    - name: registry-credentials
```

```dockerfile
# SECURE: Minimal, non-root, multi-stage build
FROM golang:1.22-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download && go mod verify
COPY . .
RUN CGO_ENABLED=0 go build -o /app/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /app/server /app/server
USER nonroot:nonroot
ENTRYPOINT ["/app/server"]
```

### Kyverno Policy -- Require Trusted Registry

```yaml
# Kyverno: Only allow images from trusted registries
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: restrict-image-registries
spec:
  validationFailureAction: Enforce
  rules:
    - name: validate-registries
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Images must come from approved registries."
        pattern:
          spec:
            containers:
              - image: "myregistry.azurecr.io/* | gcr.io/myproject/*"
            initContainers:
              - image: "myregistry.azurecr.io/* | gcr.io/myproject/*"
```

### Kyverno Policy -- Require Image Digest

```yaml
# Kyverno: Require image digests (no tags)
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-image-digest
spec:
  validationFailureAction: Enforce
  rules:
    - name: require-digest
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Images must use a digest (sha256), not a tag."
        pattern:
          spec:
            containers:
              - image: "*@sha256:*"
```

### Prevention

- [ ] Use minimal base images (distroless, Alpine, scratch)
- [ ] Pin images by digest, not by tag
- [ ] Scan images for vulnerabilities in CI/CD (Trivy, Grype, Snyk)
- [ ] Use only trusted and approved container registries
- [ ] Sign images with cosign/Notary and verify signatures before deployment
- [ ] Implement admission controllers to enforce image policies
- [ ] Run multi-stage builds to minimize final image contents
- [ ] Rebuild images regularly to pick up base image security patches

---

## K03: Overly Permissive RBAC

### Description

Role-Based Access Control (RBAC) in Kubernetes is powerful but complex. Overly permissive roles, cluster-admin grants to non-admin users, and wildcard permissions create opportunities for privilege escalation. Default service accounts often have more permissions than needed.

### Attack Scenario

A developer is given cluster-admin access for convenience. Their credentials are compromised through a phishing attack. The attacker now has full control over the entire cluster including all namespaces, secrets, and workloads. They deploy a cryptocurrency miner and exfiltrate database credentials from secrets.

### Vulnerable Config

```yaml
# VULNERABLE: Overly permissive RBAC
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: developer-admin
subjects:
  - kind: User
    name: developer@example.com
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: cluster-admin          # Full cluster admin for a developer
  apiGroup: rbac.authorization.k8s.io
---
# VULNERABLE: Wildcard permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: dev-role
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["*"]             # Full access to everything
```

### Secure Config

```yaml
# SECURE: Namespace-scoped, least privilege RBAC
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: developer-role
  namespace: development
rules:
  # Can view and manage deployments and services in their namespace
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]
  - apiGroups: [""]
    resources: ["services", "configmaps"]
    verbs: ["get", "list", "watch", "create", "update"]
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
  # Explicitly no access to secrets, cluster resources, or delete operations
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: developer-binding
  namespace: development
subjects:
  - kind: User
    name: developer@example.com
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: developer-role
  apiGroup: rbac.authorization.k8s.io
---
# SECURE: Dedicated service account with minimal permissions
apiVersion: v1
kind: ServiceAccount
metadata:
  name: web-app-sa
  namespace: production
automountServiceAccountToken: false  # Only mount when explicitly needed
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: web-app-role
  namespace: production
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames: ["web-app-config"]  # Specific resource name
    verbs: ["get", "watch"]
```

### Kyverno Policy -- Deny Cluster-Admin Bindings

```yaml
# Kyverno: Prevent new cluster-admin bindings
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: deny-cluster-admin-binding
spec:
  validationFailureAction: Enforce
  rules:
    - name: deny-cluster-admin
      match:
        any:
          - resources:
              kinds:
                - ClusterRoleBinding
      validate:
        message: "Binding to cluster-admin is not allowed. Use namespace-scoped roles."
        deny:
          conditions:
            any:
              - key: "{{ request.object.roleRef.name }}"
                operator: Equals
                value: "cluster-admin"
```

### Prevention

- [ ] Use namespace-scoped Roles instead of ClusterRoles where possible
- [ ] Never grant cluster-admin to non-infrastructure roles
- [ ] Avoid wildcard permissions in RBAC rules
- [ ] Scope service accounts per workload with minimal permissions
- [ ] Disable automountServiceAccountToken for pods that do not need API access
- [ ] Regularly audit RBAC bindings with `kubectl auth can-i --list`
- [ ] Use tools like rbac-lookup and rakkess for RBAC analysis
- [ ] Implement just-in-time access for elevated permissions

---

## K04: Lack of Centralized Policy Enforcement

### Description

Without centralized policy enforcement through admission controllers, there is no way to prevent insecure configurations from being deployed. Individual developers may create resources that violate security policies. Policy engines like Kyverno, OPA/Gatekeeper, or Pod Security Admission provide automated enforcement.

### Attack Scenario

Without admission control policies, a junior developer accidentally deploys a container in privileged mode with host networking in the production namespace. The misconfiguration goes unnoticed until an attacker exploits it to escape the container and access the node.

### Vulnerable Config

```yaml
# No admission controllers configured
# No Pod Security Standards enforced
# No policy engine deployed
# Anything can be deployed to any namespace
```

### Secure Config -- Pod Security Admission

```yaml
# SECURE: Namespace-level Pod Security Standards
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted    # Block violations
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/audit: restricted      # Log violations
    pod-security.kubernetes.io/audit-version: latest
    pod-security.kubernetes.io/warn: restricted       # Warn on violations
    pod-security.kubernetes.io/warn-version: latest
---
apiVersion: v1
kind: Namespace
metadata:
  name: development
  labels:
    pod-security.kubernetes.io/enforce: baseline      # Less strict for dev
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: latest
```

### Secure Config -- Kyverno Comprehensive Policies

```yaml
# Kyverno: Comprehensive policy set
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: baseline-security-policies
spec:
  validationFailureAction: Enforce
  rules:
    # 1. Require resource limits
    - name: require-resource-limits
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "All containers must have resource limits defined."
        pattern:
          spec:
            containers:
              - resources:
                  limits:
                    memory: "?*"
                    cpu: "?*"

    # 2. Require liveness and readiness probes
    - name: require-probes
      match:
        any:
          - resources:
              kinds:
                - Pod
      preconditions:
        any:
          - key: "{{ request.operation }}"
            operator: In
            value: ["CREATE", "UPDATE"]
      validate:
        message: "Containers must have liveness and readiness probes."
        pattern:
          spec:
            containers:
              - livenessProbe:
                  httpGet:
                    path: "?*"
                readinessProbe:
                  httpGet:
                    path: "?*"

    # 3. Require labels
    - name: require-labels
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Pods must have app and team labels."
        pattern:
          metadata:
            labels:
              app: "?*"
              team: "?*"

    # 4. Deny host namespaces
    - name: deny-host-namespaces
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Host namespaces (hostNetwork, hostPID, hostIPC) are not allowed."
        pattern:
          spec:
            =(hostNetwork): false
            =(hostPID): false
            =(hostIPC): false
```

### Prevention

- [ ] Deploy a policy engine (Kyverno, OPA/Gatekeeper, or Pod Security Admission)
- [ ] Enforce Pod Security Standards at the namespace level
- [ ] Require resource limits on all containers
- [ ] Require security contexts on all pods
- [ ] Require health check probes on all production workloads
- [ ] Require standard labels for observability and ownership
- [ ] Audit policy violations and remediate regularly
- [ ] Test policies in warn/audit mode before enforcing

---

## K05: Inadequate Logging and Monitoring

### Description

Inadequate logging and monitoring in Kubernetes clusters leaves security incidents undetected. Without audit logs, runtime threat detection, and centralized log aggregation, attackers can operate undetected for extended periods. Kubernetes API audit logging and container runtime monitoring are essential.

### Attack Scenario

An attacker gains access to a compromised pod and uses the service account token to query the Kubernetes API for secrets across namespaces. No audit logging is enabled, so the API access goes undetected. The attacker exfiltrates database credentials from a secret and pivots to the production database.

### Vulnerable Config

```yaml
# No audit policy configured
# No runtime monitoring deployed
# Container logs go to stdout with no aggregation
# No alerting on security events
```

### Secure Config -- Kubernetes Audit Policy

```yaml
# SECURE: Comprehensive audit policy
apiVersion: audit.k8s.io/v1
kind: Policy
metadata:
  name: security-audit-policy
rules:
  # Log all authentication failures
  - level: Metadata
    users: ["system:anonymous"]
    verbs: ["*"]

  # Log all access to secrets
  - level: RequestResponse
    resources:
      - group: ""
        resources: ["secrets"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

  # Log all RBAC changes
  - level: RequestResponse
    resources:
      - group: "rbac.authorization.k8s.io"
        resources: ["clusterrolebindings", "clusterroles", "rolebindings", "roles"]
    verbs: ["create", "update", "patch", "delete"]

  # Log pod exec and attach (interactive access)
  - level: RequestResponse
    resources:
      - group: ""
        resources: ["pods/exec", "pods/attach", "pods/portforward"]
    verbs: ["create"]

  # Log namespace operations
  - level: Metadata
    resources:
      - group: ""
        resources: ["namespaces"]
    verbs: ["create", "delete"]

  # Log node operations
  - level: Metadata
    resources:
      - group: ""
        resources: ["nodes"]
    verbs: ["*"]

  # Log all changes to deployments, daemonsets, statefulsets
  - level: RequestResponse
    resources:
      - group: "apps"
        resources: ["deployments", "daemonsets", "statefulsets"]
    verbs: ["create", "update", "patch", "delete"]

  # Metadata for everything else
  - level: Metadata
    omitStages:
      - "RequestReceived"
```

### Secure Config -- Falco Runtime Monitoring

```yaml
# Falco rules for runtime threat detection
- rule: Terminal Shell in Container
  desc: Detect a shell being opened in a container
  condition: >
    spawned_process
    and container
    and shell_procs
    and proc.tty != 0
  output: >
    Shell opened in container
    (user=%user.name container=%container.name image=%container.image.repository
    shell=%proc.name parent=%proc.pname cmdline=%proc.cmdline)
  priority: WARNING
  tags: [container, shell, mitre_execution]

- rule: Read Sensitive Files
  desc: Detect reading of sensitive files in containers
  condition: >
    open_read
    and container
    and sensitive_files
  output: >
    Sensitive file read in container
    (user=%user.name file=%fd.name container=%container.name image=%container.image.repository)
  priority: WARNING
  tags: [container, filesystem, mitre_collection]

- rule: Contact K8S API Server From Container
  desc: Detect a container contacting the K8s API server
  condition: >
    outbound
    and container
    and fd.sip.name = "kubernetes.default.svc.cluster.local"
  output: >
    Container contacting K8s API
    (user=%user.name container=%container.name image=%container.image.repository
    connection=%fd.name)
  priority: NOTICE
  tags: [container, network, k8s]
```

### Secure Config -- Log Aggregation with Fluentd

```yaml
# Fluentd DaemonSet for centralized logging
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd
  namespace: logging
spec:
  selector:
    matchLabels:
      app: fluentd
  template:
    metadata:
      labels:
        app: fluentd
    spec:
      serviceAccountName: fluentd
      containers:
        - name: fluentd
          image: fluent/fluentd-kubernetes-daemonset:v1.16-debian-elasticsearch8
          resources:
            limits:
              memory: "512Mi"
              cpu: "500m"
            requests:
              memory: "256Mi"
              cpu: "100m"
          volumeMounts:
            - name: varlog
              mountPath: /var/log
              readOnly: true
            - name: containers
              mountPath: /var/lib/docker/containers
              readOnly: true
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
        - name: containers
          hostPath:
            path: /var/lib/docker/containers
```

### Prevention

- [ ] Enable Kubernetes API audit logging with appropriate policy
- [ ] Deploy runtime threat detection (Falco, Sysdig, Tetragon)
- [ ] Implement centralized log aggregation (EFK/ELK, Loki, Datadog)
- [ ] Set up alerts for security-relevant events (secret access, exec into pods, RBAC changes)
- [ ] Monitor for anomalous API access patterns
- [ ] Retain audit logs for compliance and forensic analysis
- [ ] Deploy dashboard for cluster security visibility
- [ ] Test alerting with simulated security events

---

## K06: Broken Authentication Mechanisms

### Description

Broken authentication in Kubernetes includes exposed API servers, unauthenticated kubelet endpoints, leaked service account tokens, and weak authentication methods. Anonymous access, static token files, and certificate-based auth without rotation are common weaknesses.

### Attack Scenario

The Kubernetes API server is exposed to the internet with anonymous authentication enabled. An attacker discovers the endpoint and uses anonymous access to list namespaces and pods. They find a service account token mounted in a pod, use it to escalate privileges, and gain cluster access.

### Vulnerable Config

```yaml
# VULNERABLE: API server with weak auth settings (kube-apiserver flags)
# --anonymous-auth=true
# --token-auth-file=/etc/kubernetes/static-tokens.csv
# --insecure-port=8080
# --authorization-mode=AlwaysAllow

# VULNERABLE: Service account token auto-mounted and overpowered
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
    - name: app
      image: myapp:latest
  # Service account token auto-mounted by default
  # Default SA may have broad permissions
```

### Secure Config

```yaml
# SECURE: API server hardened authentication
# --anonymous-auth=false
# --token-auth-file not used (use OIDC instead)
# --insecure-port=0 (disabled)
# --authorization-mode=RBAC,Node
# --oidc-issuer-url=https://identity.example.com
# --oidc-client-id=kubernetes
# --oidc-username-claim=email
# --oidc-groups-claim=groups

# SECURE: Disable default token mounting, use dedicated service account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-service-account
  namespace: production
automountServiceAccountToken: false
---
apiVersion: v1
kind: Pod
metadata:
  name: app
  namespace: production
spec:
  serviceAccountName: app-service-account
  automountServiceAccountToken: false   # Explicitly disable
  containers:
    - name: app
      image: myregistry/app@sha256:abc123...
```

### Secure Config -- OIDC Authentication with Dex

```yaml
# Dex OIDC provider for Kubernetes authentication
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dex
  namespace: auth
spec:
  replicas: 2
  selector:
    matchLabels:
      app: dex
  template:
    spec:
      containers:
        - name: dex
          image: ghcr.io/dexidp/dex:v2.37.0
          ports:
            - containerPort: 5556
          volumeMounts:
            - name: config
              mountPath: /etc/dex/cfg
      volumes:
        - name: config
          configMap:
            name: dex-config
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: dex-config
  namespace: auth
data:
  config.yaml: |
    issuer: https://dex.example.com
    storage:
      type: kubernetes
      config:
        inCluster: true
    connectors:
      - type: oidc
        id: google
        name: Google
        config:
          issuer: https://accounts.google.com
          clientID: $GOOGLE_CLIENT_ID
          clientSecret: $GOOGLE_CLIENT_SECRET
          redirectURI: https://dex.example.com/callback
    oauth2:
      skipApprovalScreen: true
    staticClients:
      - id: kubernetes
        name: Kubernetes
        redirectURIs:
          - http://localhost:8000
        secret: kubernetes-client-secret
```

### Prevention

- [ ] Disable anonymous authentication on the API server
- [ ] Use OIDC-based authentication instead of static tokens or certificates
- [ ] Disable the insecure port on the API server
- [ ] Restrict API server network access with firewall rules
- [ ] Disable automountServiceAccountToken on all pods that do not need it
- [ ] Use short-lived tokens with bound service account tokens
- [ ] Rotate certificates and tokens regularly
- [ ] Audit authentication failures and unusual access patterns

---

## K07: Missing Network Segmentation

### Description

By default, Kubernetes allows all pod-to-pod communication within a cluster. Without network policies, any compromised pod can communicate with any other pod, service, or the API server. This flat network enables lateral movement after initial compromise.

### Attack Scenario

An attacker compromises a frontend web pod through an application vulnerability. Because no network policies exist, they scan the internal network and discover a Redis cache running without authentication, a PostgreSQL database, and internal microservices. They pivot from the frontend to the database and exfiltrate all customer data.

### Vulnerable Config

```yaml
# VULNERABLE: No network policies -- flat network, all-to-all communication
# Default Kubernetes behavior: all pods can reach all other pods
```

### Secure Config -- Network Policies

```yaml
# SECURE: Default deny all traffic in namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
---
# Allow frontend to receive traffic from ingress controller only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-ingress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
          podSelector:
            matchLabels:
              app: nginx-ingress
      ports:
        - protocol: TCP
          port: 8080
---
# Allow frontend to talk to API service only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-egress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: api-service
      ports:
        - protocol: TCP
          port: 3000
    # Allow DNS
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
---
# Allow API service to talk to database only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-service-egress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api-service
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
    # Allow DNS
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
---
# Database accepts connections from API service only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-ingress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api-service
      ports:
        - protocol: TCP
          port: 5432
  egress: []  # Database should not initiate outbound connections
```

### Kyverno Policy -- Require Network Policy Per Namespace

```yaml
# Kyverno: Require a default-deny network policy in every namespace
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-network-policy
spec:
  validationFailureAction: Audit  # Start in audit mode
  rules:
    - name: generate-default-deny
      match:
        any:
          - resources:
              kinds:
                - Namespace
      exclude:
        any:
          - resources:
              namespaces:
                - kube-system
                - kube-public
      generate:
        kind: NetworkPolicy
        apiVersion: networking.k8s.io/v1
        name: default-deny
        namespace: "{{request.object.metadata.name}}"
        data:
          spec:
            podSelector: {}
            policyTypes:
              - Ingress
              - Egress
```

### Prevention

- [ ] Implement default-deny network policies in all namespaces
- [ ] Create explicit allow rules for each required communication path
- [ ] Separate sensitive workloads into dedicated namespaces
- [ ] Block pod access to the API server unless explicitly needed
- [ ] Block pod access to cloud metadata endpoints (169.254.169.254)
- [ ] Use a CNI that supports network policies (Calico, Cilium, Weave)
- [ ] Monitor and alert on network policy violations
- [ ] Regularly review and test network segmentation

---

## K08: Secrets Management Failures

### Description

Kubernetes Secrets are base64-encoded (not encrypted) by default and stored in etcd. Inadequate secrets management includes storing secrets in environment variables, hardcoding in manifests, not encrypting secrets at rest, and failing to rotate credentials. Exposed secrets are a primary target for attackers.

### Attack Scenario

An attacker gains read access to the Kubernetes API and runs `kubectl get secrets --all-namespaces -o json`. Because secrets are only base64-encoded, they decode all secrets and obtain database passwords, API keys, TLS certificates, and service account tokens for the entire cluster.

### Vulnerable Config

```yaml
# VULNERABLE: Secret in plaintext manifest (committed to git)
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
data:
  username: YWRtaW4=        # base64("admin")
  password: cGFzc3dvcmQxMjM= # base64("password123")
---
# VULNERABLE: Secrets passed as environment variables (visible in pod spec)
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
    - name: app
      image: myapp:latest
      env:
        - name: DB_PASSWORD
          value: "supersecret"  # Hardcoded plaintext in manifest
        - name: API_KEY
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: api-key  # Visible in env vars, process listing, crash dumps
```

### Secure Config -- External Secrets with Vault

```yaml
# SECURE: External Secrets Operator with HashiCorp Vault
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: production
spec:
  provider:
    vault:
      server: "https://vault.internal.example.com:8200"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "production-app"
          serviceAccountRef:
            name: vault-auth-sa
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: production
spec:
  refreshInterval: "1h"  # Auto-refresh from Vault
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: db-credentials
    creationPolicy: Owner
  data:
    - secretKey: username
      remoteRef:
        key: production/database
        property: username
    - secretKey: password
      remoteRef:
        key: production/database
        property: password
---
# SECURE: Mount secrets as files (not env vars) with volume projection
apiVersion: v1
kind: Pod
metadata:
  name: app
  namespace: production
spec:
  serviceAccountName: app-sa
  automountServiceAccountToken: false
  containers:
    - name: app
      image: myregistry/app@sha256:abc123...
      volumeMounts:
        - name: db-creds
          mountPath: /etc/secrets/db
          readOnly: true
  volumes:
    - name: db-creds
      secret:
        secretName: db-credentials
        defaultMode: 0400  # Read-only for owner
```

### Secure Config -- Sealed Secrets for GitOps

```yaml
# SECURE: Sealed Secrets (encrypted in git, decrypted only in cluster)
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: db-credentials
  namespace: production
spec:
  encryptedData:
    username: AgBghJ8...encrypted...
    password: AgCDF2k...encrypted...
  template:
    metadata:
      name: db-credentials
      namespace: production
    type: Opaque
```

### Secure Config -- etcd Encryption

```yaml
# SECURE: Encryption configuration for etcd secrets at rest
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: <base64-encoded-32-byte-key>
      - identity: {}  # Fallback for reading unencrypted secrets
```

### Prevention

- [ ] Never store secrets in plaintext in manifests or git repositories
- [ ] Use an external secrets manager (Vault, AWS Secrets Manager, Azure Key Vault)
- [ ] Enable encryption at rest for etcd
- [ ] Mount secrets as files, not environment variables
- [ ] Use Sealed Secrets or SOPS for GitOps workflows
- [ ] Implement secret rotation policies
- [ ] Restrict RBAC access to secrets on a per-namespace basis
- [ ] Audit secret access in API server audit logs
- [ ] Use short-lived credentials where possible

---

## K09: Misconfigured Cluster Components

### Description

Kubernetes clusters consist of many components (API server, kubelet, etcd, scheduler, controller manager, CoreDNS) that must be properly configured. Misconfigured components can expose the cluster to attacks including unauthenticated access, data exposure, and denial of service.

### Attack Scenario

The kubelet API is exposed on port 10250 without authentication. An attacker scans the network, discovers the kubelet endpoint, and uses it to exec into running containers, list pods, and extract secrets. The etcd endpoint is also accessible without TLS client authentication, allowing direct read/write access to all cluster state.

### Vulnerable Config

```yaml
# VULNERABLE: kubelet configuration
# --anonymous-auth=true
# --authorization-mode=AlwaysAllow
# --read-only-port=10255 (enabled)

# VULNERABLE: etcd configuration
# --client-cert-auth=false
# --peer-client-cert-auth=false
# No TLS for client connections

# VULNERABLE: API server
# --profiling=true (exposed at /debug/pprof)
# --enable-admission-plugins not set (no PodSecurity, etc.)
```

### Secure Config -- kubelet

```yaml
# SECURE: kubelet configuration (/var/lib/kubelet/config.yaml)
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
authentication:
  anonymous:
    enabled: false
  webhook:
    enabled: true
  x509:
    clientCAFile: /etc/kubernetes/pki/ca.crt
authorization:
  mode: Webhook
readOnlyPort: 0  # Disable read-only port
protectKernelDefaults: true
eventRecordQPS: 50
rotateCertificates: true
serverTLSBootstrap: true
```

### Secure Config -- etcd

```text
# SECURE: etcd flags
--client-cert-auth=true
--trusted-ca-file=/etc/etcd/ca.crt
--cert-file=/etc/etcd/server.crt
--key-file=/etc/etcd/server.key
--peer-client-cert-auth=true
--peer-trusted-ca-file=/etc/etcd/ca.crt
--peer-cert-file=/etc/etcd/peer.crt
--peer-key-file=/etc/etcd/peer.key
--cipher-suites=TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
```

### Secure Config -- API Server

```text
# SECURE: API server flags
--anonymous-auth=false
--authorization-mode=RBAC,Node
--enable-admission-plugins=NodeRestriction,PodSecurity,EventRateLimit,AlwaysPullImages
--insecure-port=0
--profiling=false
--audit-log-path=/var/log/kubernetes/audit.log
--audit-policy-file=/etc/kubernetes/audit-policy.yaml
--audit-log-maxage=30
--audit-log-maxbackup=10
--audit-log-maxsize=100
--encryption-provider-config=/etc/kubernetes/encryption-config.yaml
--tls-min-version=VersionTLS12
--tls-cipher-suites=TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
```

### Secure Config -- CIS Benchmark Compliance Script

```bash
#!/bin/bash
# Kubernetes CIS Benchmark quick checks

echo "=== API Server Checks ==="
# Check anonymous auth
ps aux | grep kube-apiserver | grep -c "anonymous-auth=false"

# Check insecure port
ps aux | grep kube-apiserver | grep -c "insecure-port=0"

echo "=== kubelet Checks ==="
# Check anonymous auth on kubelet
curl -sk https://localhost:10250/healthz 2>&1 | grep -c "Unauthorized"

echo "=== etcd Checks ==="
# Check etcd client cert auth
ps aux | grep etcd | grep -c "client-cert-auth=true"

echo "=== Run kube-bench for comprehensive CIS check ==="
# kubectl run kube-bench --image=aquasec/kube-bench:latest --restart=Never -- run
```

### Prevention

- [ ] Disable anonymous authentication on kubelet and API server
- [ ] Disable the kubelet read-only port (10255)
- [ ] Enable TLS client authentication for etcd
- [ ] Disable profiling endpoints in production
- [ ] Enable and configure admission controllers
- [ ] Set minimum TLS version to 1.2
- [ ] Run CIS Kubernetes Benchmark (kube-bench) regularly
- [ ] Rotate component certificates before expiration
- [ ] Restrict component communication to TLS only

---

## K10: Outdated and Vulnerable Kubernetes Components

### Description

Running outdated Kubernetes versions, unpatched node operating systems, or vulnerable cluster components exposes the cluster to known exploits. Kubernetes releases patches for critical CVEs regularly, and falling behind on updates increases risk. This applies to the control plane, nodes, CNI plugins, ingress controllers, and all cluster add-ons.

### Attack Scenario

A cluster runs Kubernetes v1.23, which has a known privilege escalation vulnerability (CVE). An attacker exploits this CVE to escape from a pod to the node, gaining root access. The node's kernel is also outdated and vulnerable to a container escape exploit, allowing the attacker to compromise the entire cluster.

### Vulnerable Config

```yaml
# VULNERABLE: Running outdated components
# Kubernetes: v1.23.0 (multiple known CVEs)
# Node OS: Ubuntu 20.04 without recent patches
# CNI: Calico v3.20 (known vulnerabilities)
# Ingress: nginx-ingress v0.49 (multiple CVEs)
# Container runtime: containerd v1.5 (outdated)
```

### Secure Config -- Automated Update Strategy

```yaml
# Managed Kubernetes -- auto-upgrade configuration (GKE example)
# gcloud container clusters update my-cluster \
#   --release-channel=regular \
#   --enable-autoupgrade \
#   --zone us-central1-a

# Self-managed -- use kured for node reboots after OS patches
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: kured
  namespace: kube-system
spec:
  selector:
    matchLabels:
      name: kured
  template:
    metadata:
      labels:
        name: kured
    spec:
      serviceAccountName: kured
      hostPID: true
      containers:
        - name: kured
          image: ghcr.io/kubereboot/kured:1.14.0
          command:
            - /usr/bin/kured
            - --reboot-sentinel=/var/run/reboot-required
            - --period=1h
            - --drain-grace-period=120
            - --skip-wait-for-delete-timeout=60
          securityContext:
            privileged: true  # Required for reboot
          volumeMounts:
            - name: sentinel
              mountPath: /var/run
              readOnly: true
      volumes:
        - name: sentinel
          hostPath:
            path: /var/run
```

### Secure Config -- Vulnerability Scanning with Trivy

```yaml
# Trivy Operator for continuous vulnerability scanning
apiVersion: aquasecurity.github.io/v1alpha1
kind: ClusterComplianceReport
metadata:
  name: cis-benchmark
spec:
  cron: "0 */6 * * *"  # Every 6 hours
  compliance:
    id: cis
    title: CIS Kubernetes Benchmark
---
# Scan all images in the cluster
# helm install trivy-operator aquasecurity/trivy-operator \
#   --namespace trivy-system \
#   --set trivy.severity=CRITICAL,HIGH \
#   --set operator.scanJobsConcurrentLimit=3

# Check scan results
# kubectl get vulnerabilityreports -A -o wide
```

### Kyverno Policy -- Require Minimum Image Scan Score

```yaml
# Kyverno: Block deployment of images with critical vulnerabilities
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: check-vulnerability-scan
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-trivy-scan
      match:
        any:
          - resources:
              kinds:
                - Pod
      preconditions:
        any:
          - key: "{{ request.operation }}"
            operator: In
            value: ["CREATE", "UPDATE"]
      validate:
        message: "Image must have a vulnerability scan with no critical CVEs."
        deny:
          conditions:
            any:
              - key: "{{ images.containers.*.registry }}"
                operator: AnyNotIn
                value:
                  - "myregistry.azurecr.io"  # Only pre-scanned registry images
```

### Prevention

- [ ] Keep Kubernetes version within supported release window (N-2 minor versions)
- [ ] Enable auto-upgrade for managed Kubernetes clusters
- [ ] Patch node operating systems regularly using automated pipelines
- [ ] Update all cluster add-ons (CNI, CSI, ingress, monitoring) regularly
- [ ] Subscribe to Kubernetes security announcements
- [ ] Run continuous vulnerability scanning (Trivy Operator, Grype)
- [ ] Implement a patch management policy with SLAs per severity
- [ ] Test upgrades in staging before applying to production
- [ ] Use managed Kubernetes release channels for automatic patching

---

## Summary Table

| Rank | Category                               | Severity | Primary Attack Vector                          |
| ---- | -------------------------------------- | -------- | ---------------------------------------------- |
| K01  | Insecure Workload Configurations       | Critical | Container escape, privilege escalation         |
| K02  | Supply Chain Vulnerabilities           | Critical | Poisoned images, vulnerable base images        |
| K03  | Overly Permissive RBAC                 | Critical | Credential theft leading to full cluster access|
| K04  | Lack of Centralized Policy Enforcement | High     | Misconfiguration deployment                    |
| K05  | Inadequate Logging and Monitoring      | High     | Undetected compromise                          |
| K06  | Broken Authentication Mechanisms       | Critical | Unauthenticated API access                     |
| K07  | Missing Network Segmentation           | High     | Lateral movement after pod compromise          |
| K08  | Secrets Management Failures            | Critical | Credential exposure                            |
| K09  | Misconfigured Cluster Components       | High     | Component-level exploitation                   |
| K10  | Outdated and Vulnerable Components     | High     | Known CVE exploitation                         |

---

## Best Practices for Kubernetes Security

### Cluster Setup

1. Use managed Kubernetes with automatic patching when possible.
2. Enable RBAC and disable anonymous authentication.
3. Encrypt etcd data at rest.
4. Deploy a policy engine (Kyverno or OPA/Gatekeeper) from day one.
5. Implement network policies with default-deny.

### Workload Security

1. Run all containers as non-root with read-only root filesystems.
2. Drop all capabilities and add only those explicitly needed.
3. Set resource limits on all containers.
4. Use immutable image references (digests).
5. Scan images for vulnerabilities before deployment.

### Operations

1. Enable and review Kubernetes audit logs.
2. Deploy runtime threat detection (Falco).
3. Monitor and rotate secrets regularly.
4. Run CIS Kubernetes Benchmark (kube-bench) on a schedule.
5. Maintain a patch management schedule for all components.

---

## Enforcement Checklist

### Cluster-Level Controls

- [ ] API server anonymous auth disabled (K06)
- [ ] etcd encryption at rest enabled (K08)
- [ ] Audit logging enabled with security-focused policy (K05)
- [ ] Network policies default-deny in all namespaces (K07)
- [ ] Policy engine deployed and enforcing (K04)
- [ ] RBAC properly scoped, no unnecessary cluster-admin (K03)
- [ ] Component versions within supported window (K10)
- [ ] kubelet anonymous auth disabled, read-only port closed (K09)

### Workload-Level Controls

- [ ] All containers run as non-root (K01)
- [ ] No privileged containers (K01)
- [ ] Resource limits set on all containers (K01)
- [ ] Images from trusted registries only (K02)
- [ ] Images pinned by digest (K02)
- [ ] Service account tokens not auto-mounted (K06)
- [ ] Secrets mounted as files, not env vars (K08)
- [ ] Health probes configured (K01)

### Monitoring and Response

- [ ] Centralized logging operational (K05)
- [ ] Runtime threat detection deployed (K05)
- [ ] Alert rules configured for security events (K05)
- [ ] Vulnerability scanning running continuously (K10)
- [ ] CIS benchmark scheduled and reviewed (K09)
- [ ] Incident response plan includes Kubernetes scenarios
