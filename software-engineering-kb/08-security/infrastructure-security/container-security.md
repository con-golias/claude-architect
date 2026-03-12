# Container Security Comprehensive Guide

## Metadata
- **Category**: Infrastructure Security
- **Audience**: DevOps engineers, platform engineers, security engineers
- **Last Updated**: 2026-03-10
- **Complexity**: Advanced
- **Technologies Covered**: Docker, Kubernetes, Containerd, Falco, OPA Gatekeeper, Kyverno

---

## 1. Docker Security Fundamentals

### 1.1 Run as Non-Root User

Containers should never run as root. The root user inside a container is the same
uid 0 as root on the host, and a container escape exploit running as root gains host
root privileges.

```dockerfile
# GOOD - Run as non-root user
FROM node:20-alpine

# Create a non-root user and group
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Set ownership of application files
WORKDIR /app
COPY --chown=appuser:appgroup package*.json ./
RUN npm ci --only=production
COPY --chown=appuser:appgroup . .

# Switch to non-root user before CMD/ENTRYPOINT
USER appuser:appgroup

# Use numeric UID for runtime verification
# USER 1001:1001

EXPOSE 8080
CMD ["node", "server.js"]
```

```dockerfile
# BAD - Running as root (default)
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
# No USER directive = runs as root
CMD ["node", "server.js"]
```

### 1.2 Read-Only Filesystem

Mount the container filesystem as read-only to prevent runtime modifications.

```bash
# Run container with read-only filesystem
docker run --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --tmpfs /var/run:rw,noexec,nosuid,size=1m \
  -v app-data:/app/data:rw \
  my-app:latest
```

```yaml
# Docker Compose with read-only filesystem
services:
  app:
    image: my-app:latest
    read_only: true
    tmpfs:
      - /tmp:size=64m,noexec,nosuid
      - /var/run:size=1m,noexec,nosuid
    volumes:
      - app-data:/app/data:rw
    security_opt:
      - no-new-privileges:true
```

### 1.3 Drop All Capabilities and Add Only Needed

Linux capabilities divide root privileges into distinct units. Drop all and add back
only what the application requires.

```bash
# Drop all capabilities, add only what is needed
docker run \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  --cap-add=CHOWN \
  my-app:latest

# Common capabilities and their purposes:
# NET_BIND_SERVICE - bind to ports below 1024
# CHOWN            - change file ownership
# SETUID/SETGID    - change UID/GID
# DAC_OVERRIDE     - bypass file permission checks (avoid if possible)
# SYS_PTRACE       - needed for debugging only (never in production)
```

```yaml
# Docker Compose capabilities configuration
services:
  web:
    image: nginx:alpine
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
      - CHOWN
      - SETUID
      - SETGID
    security_opt:
      - no-new-privileges:true
```

### 1.4 No-New-Privileges Flag

Prevent the container process from gaining additional privileges through setuid binaries
or capability escalation.

```bash
# Prevent privilege escalation
docker run --security-opt=no-new-privileges:true my-app:latest
```

### 1.5 Seccomp Profiles

Seccomp (Secure Computing Mode) restricts the system calls a container can make. Docker
ships with a default profile that blocks approximately 44 of 300+ syscalls.

```json
// Custom seccomp profile - strict-seccomp.json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "defaultErrnoRet": 1,
  "archMap": [
    {
      "architecture": "SCMP_ARCH_X86_64",
      "subArchitectures": ["SCMP_ARCH_X86", "SCMP_ARCH_X32"]
    }
  ],
  "syscalls": [
    {
      "names": [
        "accept", "accept4", "access", "bind", "brk", "chdir", "chmod",
        "chown", "clock_getres", "clock_gettime", "clock_nanosleep",
        "close", "connect", "dup", "dup2", "dup3", "epoll_create",
        "epoll_create1", "epoll_ctl", "epoll_wait", "epoll_pwait",
        "eventfd", "eventfd2", "execve", "exit", "exit_group",
        "faccessat", "fchmod", "fchmodat", "fchown", "fchownat",
        "fcntl", "fdatasync", "flock", "fstat", "fstatfs", "fsync",
        "ftruncate", "futex", "getcwd", "getdents", "getdents64",
        "getegid", "geteuid", "getgid", "getgroups", "getpeername",
        "getpgrp", "getpid", "getppid", "getpriority", "getrandom",
        "getresgid", "getresuid", "getrlimit", "getsockname",
        "getsockopt", "gettid", "gettimeofday", "getuid", "ioctl",
        "kill", "listen", "lseek", "lstat", "madvise", "memfd_create",
        "mincore", "mkdir", "mkdirat", "mmap", "mprotect", "munmap",
        "nanosleep", "newfstatat", "open", "openat", "pipe", "pipe2",
        "poll", "ppoll", "pread64", "prlimit64", "pwrite64", "read",
        "readlink", "readlinkat", "recvfrom", "recvmsg", "rename",
        "renameat", "restart_syscall", "rmdir", "rt_sigaction",
        "rt_sigprocmask", "rt_sigreturn", "sched_getaffinity",
        "sched_yield", "select", "sendmsg", "sendto", "set_robust_list",
        "set_tid_address", "setgid", "setgroups", "setsockopt", "setuid",
        "shutdown", "sigaltstack", "socket", "socketpair", "stat",
        "statfs", "statx", "symlink", "symlinkat", "tgkill", "umask",
        "uname", "unlink", "unlinkat", "wait4", "write", "writev"
      ],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

```bash
# Apply custom seccomp profile
docker run --security-opt seccomp=strict-seccomp.json my-app:latest
```

### 1.6 AppArmor Profiles

```
# AppArmor profile for a container - /etc/apparmor.d/docker-app
#include <tunables/global>

profile docker-app flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  #include <abstractions/nameservice>

  # Deny all file writes except to specific paths
  deny /etc/** w,
  deny /usr/** w,
  deny /bin/** w,
  deny /sbin/** w,
  deny /lib/** w,

  # Allow writes to application directories only
  /app/data/** rw,
  /tmp/** rw,
  /var/log/app/** rw,

  # Deny network raw sockets
  deny network raw,

  # Deny mounting filesystems
  deny mount,

  # Deny ptrace
  deny ptrace,

  # Allow outbound TCP connections
  network tcp,
  network udp,
}
```

```bash
# Load and apply AppArmor profile
sudo apparmor_parser -r /etc/apparmor.d/docker-app
docker run --security-opt apparmor=docker-app my-app:latest
```

### 1.7 Resource Limits

```bash
# Set resource limits to prevent resource exhaustion attacks
docker run \
  --memory=512m \
  --memory-swap=512m \
  --cpus=1.0 \
  --pids-limit=100 \
  --ulimit nofile=1024:2048 \
  --ulimit nproc=64:128 \
  my-app:latest
```

### 1.8 Never Use Privileged Mode

```bash
# NEVER run containers in privileged mode in production
# This gives full host access and defeats all container isolation
docker run --privileged my-app:latest    # NEVER DO THIS

# If you need specific host access, use targeted capabilities instead
docker run \
  --cap-drop=ALL \
  --cap-add=SYS_TIME \
  --device=/dev/specific-device \
  my-app:latest
```

---

## 2. Image Security

### 2.1 Multi-Stage Builds

Use multi-stage builds to minimize the attack surface by excluding build tools,
source code, and development dependencies from the final image.

```dockerfile
# Multi-stage build for Go application
FROM golang:1.22-alpine AS builder

# Install security updates
RUN apk update && apk upgrade --no-cache

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download && go mod verify
COPY . .

# Build static binary with security flags
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -extldflags '-static'" \
    -tags netgo \
    -o /app ./cmd/server

# Final stage - distroless image (no shell, no package manager)
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /app /app

USER nonroot:nonroot

EXPOSE 8080
ENTRYPOINT ["/app"]
```

### 2.2 Image Scanning

```bash
# Scan images with Trivy
trivy image --severity CRITICAL,HIGH --exit-code 1 my-app:latest

# Scan with Grype
grype my-app:latest --fail-on critical

# Scan with Snyk
snyk container test my-app:latest --severity-threshold=high

# Docker Scout (built into Docker)
docker scout cves my-app:latest --only-severity critical,high
```

### 2.3 Image Signing and Verification

```bash
# Sign images with Cosign (Sigstore)
cosign sign --key cosign.key my-registry.com/my-app:latest

# Verify image signatures before deployment
cosign verify --key cosign.pub my-registry.com/my-app:latest

# Keyless signing with Sigstore (uses OIDC identity)
cosign sign my-registry.com/my-app:latest
cosign verify \
  --certificate-identity=user@example.com \
  --certificate-oidc-issuer=https://accounts.google.com \
  my-registry.com/my-app:latest
```

---

## 3. Kubernetes Security

### 3.1 RBAC (Role-Based Access Control)

```yaml
# ClusterRole - Read-only access to pods and services
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: pod-reader
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "services"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list", "watch"]

---
# Role - Namespace-scoped deployment permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: deployment-manager
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]
    resourceNames: ["my-app"]  # Restrict to specific deployments
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list"]
  # Explicitly deny access to secrets
  # (absence of secrets in rules = implicit deny)

---
# RoleBinding - Bind role to a group
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: deployment-manager-binding
  namespace: production
subjects:
  - kind: Group
    name: "app-deployers"
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: deployment-manager
  apiGroup: rbac.authorization.k8s.io

---
# ClusterRoleBinding - Bind cluster role to a service account
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: pod-reader-binding
subjects:
  - kind: ServiceAccount
    name: monitoring-sa
    namespace: monitoring
roleRef:
  kind: ClusterRole
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

### 3.2 NetworkPolicies

```yaml
# Default deny all ingress and egress traffic in a namespace
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
# Allow specific ingress and egress for the application
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: app-network-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: my-app
      tier: backend
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Allow traffic from the frontend pods only on port 8080
    - from:
        - podSelector:
            matchLabels:
              app: my-app
              tier: frontend
        - namespaceSelector:
            matchLabels:
              name: production
      ports:
        - protocol: TCP
          port: 8080
  egress:
    # Allow DNS resolution
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
    # Allow connections to the database pods
    - to:
        - podSelector:
            matchLabels:
              app: my-app
              tier: database
      ports:
        - protocol: TCP
          port: 5432
    # Allow HTTPS egress to external APIs
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
      ports:
        - protocol: TCP
          port: 443
```

### 3.3 Pod Security Standards

Kubernetes Pod Security Standards define three profiles: Privileged, Baseline, and
Restricted. Apply them at the namespace level using Pod Security Admission.

```yaml
# Namespace with Restricted Pod Security Standard
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: latest
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: latest

---
# Pod that complies with Restricted Pod Security Standard
apiVersion: v1
kind: Pod
metadata:
  name: secure-app
  namespace: production
spec:
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      image: my-registry.com/my-app@sha256:abc123...
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
        runAsNonRoot: true
        runAsUser: 1000
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: 500m
          memory: 512Mi
      ports:
        - containerPort: 8080
          protocol: TCP
      volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: app-data
          mountPath: /app/data
  volumes:
    - name: tmp
      emptyDir:
        sizeLimit: 64Mi
    - name: app-data
      emptyDir:
        sizeLimit: 256Mi
```

### 3.4 Secrets Encryption

```yaml
# etcd encryption configuration - /etc/kubernetes/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
      - configmaps
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: <base64-encoded-32-byte-key>
      - kms:
          apiVersion: v2
          name: aws-kms-provider
          endpoint: unix:///run/kms-plugin/socket.sock
          cachesize: 1000
          timeout: 3s
      - identity: {}  # Fallback - unencrypted (for reading old secrets)
```

```yaml
# External Secrets Operator - fetch secrets from AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: app-secrets
    creationPolicy: Owner
    deletionPolicy: Retain
  data:
    - secretKey: database-url
      remoteRef:
        key: production/my-app/database
        property: connection_string
    - secretKey: api-key
      remoteRef:
        key: production/my-app/api-keys
        property: stripe_secret_key

---
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secrets-manager
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
            namespace: external-secrets
```

### 3.5 Admission Controllers

#### OPA Gatekeeper

```yaml
# Constraint Template - require resource limits
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredresources
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredResources
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredresources

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.resources.limits.cpu
          msg := sprintf("Container '%v' must have CPU limits", [container.name])
        }

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.resources.limits.memory
          msg := sprintf("Container '%v' must have memory limits", [container.name])
        }

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.resources.requests.cpu
          msg := sprintf("Container '%v' must have CPU requests", [container.name])
        }

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.resources.requests.memory
          msg := sprintf("Container '%v' must have memory requests", [container.name])
        }

---
# Apply the constraint
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredResources
metadata:
  name: require-resource-limits
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
      - apiGroups: ["apps"]
        kinds: ["Deployment", "StatefulSet", "DaemonSet"]
    namespaces:
      - production
      - staging
```

#### Kyverno

```yaml
# Kyverno policy - disallow privileged containers
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-privileged
  annotations:
    policies.kyverno.io/title: Disallow Privileged Containers
    policies.kyverno.io/category: Pod Security Standards (Restricted)
    policies.kyverno.io/severity: high
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: deny-privileged
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Privileged containers are not allowed."
        pattern:
          spec:
            containers:
              - securityContext:
                  privileged: "false"
            initContainers:
              - securityContext:
                  privileged: "false"
            ephemeralContainers:
              - securityContext:
                  privileged: "false"

---
# Kyverno policy - require image signatures
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signatures
spec:
  validationFailureAction: Enforce
  webhookTimeoutSeconds: 30
  rules:
    - name: verify-cosign-signature
      match:
        any:
          - resources:
              kinds:
                - Pod
      verifyImages:
        - imageReferences:
            - "my-registry.com/*"
          attestors:
            - entries:
                - keys:
                    publicKeys: |-
                      -----BEGIN PUBLIC KEY-----
                      MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
                      -----END PUBLIC KEY-----

---
# Kyverno policy - mutate to add default security context
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-default-security-context
spec:
  rules:
    - name: add-security-context
      match:
        any:
          - resources:
              kinds:
                - Pod
      mutate:
        patchStrategicMerge:
          spec:
            securityContext:
              runAsNonRoot: true
              seccompProfile:
                type: RuntimeDefault
            containers:
              - (name): "*"
                securityContext:
                  allowPrivilegeEscalation: false
                  capabilities:
                    drop:
                      - ALL
```

### 3.6 Disable Service Account Token Auto-Mount

```yaml
# Disable auto-mounting of service account token when not needed
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-sa
  namespace: production
automountServiceAccountToken: false

---
# If a pod needs the token, explicitly enable it
apiVersion: v1
kind: Pod
metadata:
  name: needs-api-access
spec:
  serviceAccountName: app-sa
  automountServiceAccountToken: true  # Only when actually needed
  containers:
    - name: app
      image: my-app:latest
```

### 3.7 Service Mesh mTLS

```yaml
# Istio - enforce strict mTLS for all traffic in the mesh
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system  # Mesh-wide policy
spec:
  mtls:
    mode: STRICT

---
# Istio AuthorizationPolicy - restrict access between services
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: backend-auth
  namespace: production
spec:
  selector:
    matchLabels:
      app: backend
  action: ALLOW
  rules:
    - from:
        - source:
            principals:
              - "cluster.local/ns/production/sa/frontend-sa"
      to:
        - operation:
            methods: ["GET", "POST"]
            paths: ["/api/*"]
    - from:
        - source:
            principals:
              - "cluster.local/ns/monitoring/sa/prometheus-sa"
      to:
        - operation:
            methods: ["GET"]
            paths: ["/metrics"]
```

---

## 4. Runtime Security

### 4.1 Falco Rules

```yaml
# Falco custom rules for runtime threat detection
- rule: Terminal shell in container
  desc: Detect a shell being spawned in a container
  condition: >
    spawned_process and container and
    shell_procs and proc.tty != 0 and
    container_entrypoint
  output: >
    Shell spawned in container
    (user=%user.name user_loginuid=%user.loginuid %container.info
    shell=%proc.name parent=%proc.pname cmdline=%proc.cmdline
    terminal=%proc.tty container_id=%container.id image=%container.image.repository)
  priority: WARNING
  tags: [container, shell, mitre_execution]

- rule: Read sensitive file in container
  desc: Detect reading of sensitive files inside containers
  condition: >
    open_read and container and
    (fd.name startswith /etc/shadow or
     fd.name startswith /etc/passwd or
     fd.name startswith /etc/kubernetes or
     fd.name startswith /var/run/secrets)
  output: >
    Sensitive file read in container
    (user=%user.name file=%fd.name container=%container.name
    image=%container.image.repository)
  priority: CRITICAL
  tags: [container, filesystem, mitre_credential_access]

- rule: Unexpected outbound connection
  desc: Detect outbound network connections to unexpected destinations
  condition: >
    outbound and container and
    not (fd.sip.name in (allowed_outbound_destinations))
  output: >
    Unexpected outbound connection from container
    (command=%proc.cmdline connection=%fd.name user=%user.name
    container=%container.name image=%container.image.repository)
  priority: NOTICE
  tags: [container, network, mitre_exfiltration]

- rule: Container drift detected
  desc: Detect new executable files created at runtime (container drift)
  condition: >
    container and evt.type in (open, openat, creat) and
    evt.is_open_exec=true and
    not proc.name in (known_container_processes)
  output: >
    Drift detected - new executable in container
    (user=%user.name command=%proc.cmdline file=%fd.name
    container=%container.name image=%container.image.repository)
  priority: CRITICAL
  tags: [container, drift, mitre_persistence]
```

### 4.2 CIS Docker Benchmark Key Controls

```bash
# Run Docker Bench for Security
docker run --rm --net host --pid host \
  --userns host --cap-add audit_control \
  -e DOCKER_CONTENT_TRUST=$DOCKER_CONTENT_TRUST \
  -v /etc:/etc:ro \
  -v /usr/bin/containerd:/usr/bin/containerd:ro \
  -v /usr/bin/runc:/usr/bin/runc:ro \
  -v /usr/lib/systemd:/usr/lib/systemd:ro \
  -v /var/lib:/var/lib:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  --label docker_bench_security \
  docker/docker-bench-security

# Key checks performed:
# 1. Host Configuration (kernel params, audit rules)
# 2. Docker daemon configuration (TLS, ulimits, userns)
# 3. Docker daemon configuration files (permissions)
# 4. Container Images and Build Files
# 5. Container Runtime (privileges, capabilities, mounts)
# 6. Docker Security Operations (image scanning, secrets)
```

### 4.3 CIS Kubernetes Benchmark Key Controls

```bash
# Run kube-bench for CIS Kubernetes Benchmark
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml
kubectl logs -f job/kube-bench

# Key areas assessed:
# 1. Control Plane Components (API server, controller manager, scheduler)
# 2. etcd (encryption, authentication, peer communication)
# 3. Control Plane Configuration (authentication, authorization)
# 4. Worker Nodes (kubelet configuration, security)
# 5. Policies (RBAC, PSP/PSA, network policies, secrets)
```

---

## 5. OWASP Kubernetes Top 10

### K01: Insecure Workload Configurations

Mitigated by Pod Security Standards, OPA Gatekeeper, or Kyverno policies as shown above.

### K02: Supply Chain Vulnerabilities

```yaml
# Use image digests instead of tags to prevent tag mutation attacks
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      containers:
        # BAD - tags can be overwritten
        # - image: my-app:latest
        # - image: my-app:v1.2.3

        # GOOD - immutable digest reference
        - image: my-registry.com/my-app@sha256:a1b2c3d4e5f6...
```

### K03: Overly Permissive RBAC

```bash
# Audit RBAC permissions - find overly permissive bindings
kubectl auth can-i --list --as=system:serviceaccount:default:default

# Find all ClusterRoleBindings that grant cluster-admin
kubectl get clusterrolebindings -o json | \
  jq '.items[] | select(.roleRef.name=="cluster-admin") | .metadata.name'

# Use rbac-tool for comprehensive RBAC analysis
kubectl rbac-tool analysis
kubectl rbac-tool who-can create deployments
```

### K04: Lack of Centralized Policy Enforcement

Addressed through admission controllers (OPA Gatekeeper, Kyverno) as shown in
section 3.5.

### K05: Inadequate Logging and Monitoring

```yaml
# Kubernetes audit policy for comprehensive logging
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  # Log all requests to secrets at the Metadata level
  - level: Metadata
    resources:
      - group: ""
        resources: ["secrets"]
    omitStages:
      - "RequestReceived"

  # Log all changes to RBAC at RequestResponse level
  - level: RequestResponse
    resources:
      - group: "rbac.authorization.k8s.io"
        resources: ["clusterroles", "clusterrolebindings", "roles", "rolebindings"]

  # Log pod exec and attach at RequestResponse level
  - level: RequestResponse
    resources:
      - group: ""
        resources: ["pods/exec", "pods/attach", "pods/portforward"]

  # Log all changes to workloads
  - level: Request
    resources:
      - group: "apps"
        resources: ["deployments", "daemonsets", "statefulsets"]
    verbs: ["create", "update", "patch", "delete"]

  # Do not log read-only requests to certain resources
  - level: None
    resources:
      - group: ""
        resources: ["events", "endpoints"]
    verbs: ["get", "list", "watch"]

  # Default: log at Metadata level
  - level: Metadata
    omitStages:
      - "RequestReceived"
```

---

## 6. Container Multi-Tenancy

### 6.1 Namespace Isolation

```yaml
# Resource Quotas per namespace (tenant)
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-a-quota
  namespace: tenant-a
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"
    services: "10"
    secrets: "20"
    configmaps: "20"
    persistentvolumeclaims: "10"

---
# LimitRange per namespace
apiVersion: v1
kind: LimitRange
metadata:
  name: tenant-a-limits
  namespace: tenant-a
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 512Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      max:
        cpu: "2"
        memory: 4Gi
      min:
        cpu: 50m
        memory: 64Mi
    - type: Pod
      max:
        cpu: "4"
        memory: 8Gi
```

---

## 7. Best Practices

1. **Use minimal base images** -- prefer distroless, Alpine, or scratch images to
   minimize the attack surface; every additional package in an image is a potential
   vulnerability.

2. **Scan images in CI/CD and at admission** -- integrate Trivy, Grype, or Snyk into
   the build pipeline to block images with critical vulnerabilities; use admission
   controllers to enforce scanning at deploy time.

3. **Run containers as non-root with read-only filesystem** -- always set USER in
   Dockerfiles, set runAsNonRoot in Kubernetes security context, and mount the
   filesystem as read-only with tmpfs for temporary data.

4. **Drop all capabilities and add only what is needed** -- use cap_drop ALL and
   selectively add required capabilities; most applications need zero Linux
   capabilities.

5. **Enforce Pod Security Standards at the namespace level** -- use the Restricted
   profile for production namespaces; use Baseline for staging; never use Privileged
   in production.

6. **Implement default-deny NetworkPolicies** -- start by denying all ingress and
   egress traffic, then explicitly allow only required communication paths between
   pods.

7. **Sign and verify container images** -- use Cosign or Notary to sign images in CI/CD
   and verify signatures at admission with Kyverno or OPA Gatekeeper.

8. **Encrypt secrets and use external secrets management** -- never store plaintext
   secrets in Kubernetes; use External Secrets Operator or Sealed Secrets with
   encryption at the etcd level.

9. **Deploy runtime security monitoring** -- use Falco, Sysdig Secure, or similar tools
   to detect anomalous behavior (shell access, file modifications, unexpected network
   connections) at runtime.

10. **Disable service account token auto-mount** -- set automountServiceAccountToken to
    false by default on both ServiceAccount and Pod resources; enable only when the
    application genuinely needs Kubernetes API access.

---

## 8. Anti-Patterns

1. **Running containers as root** -- this negates container isolation; a container
   escape as root gives host root access; always use non-root users.

2. **Using the latest tag in production** -- the latest tag is mutable and can
   change without notice; use specific version tags or, better, image digests
   (sha256) for reproducibility and security.

3. **Mounting the Docker socket into containers** -- mounting /var/run/docker.sock
   gives the container full control over the Docker daemon, equivalent to root on the
   host; use purpose-built tools instead.

4. **Running containers in privileged mode** -- privileged mode disables all security
   features (capabilities, seccomp, AppArmor, SELinux, namespaces); never use it in
   production.

5. **Storing secrets in environment variables or ConfigMaps** -- environment variables
   are visible in process listings, container inspect output, and logs; use Kubernetes
   Secrets with encryption or external secrets managers.

6. **Skipping NetworkPolicies because "it works without them"** -- without
   NetworkPolicies, any pod can communicate with any other pod; this allows lateral
   movement after a compromise.

7. **Granting cluster-admin to application service accounts** -- cluster-admin provides
   full cluster access; application service accounts should have the minimum RBAC
   permissions required.

8. **Ignoring container image vulnerabilities in base images** -- even if your
   application code is secure, vulnerabilities in base image packages (OpenSSL, glibc)
   can be exploited; scan and update base images regularly.

---

## 9. Enforcement Checklist

### Image Security
- [ ] All images use multi-stage builds with minimal final images
- [ ] Images are scanned for vulnerabilities in CI/CD with a severity gate
- [ ] Images are signed and signatures are verified at admission
- [ ] Images use specific version tags or digests (never "latest" in production)
- [ ] Base images are updated and rebuilt at least monthly
- [ ] Private container registries require authentication

### Container Runtime Security
- [ ] All containers run as non-root (USER directive in Dockerfile, runAsNonRoot in K8s)
- [ ] Filesystem is mounted read-only with tmpfs for writable paths
- [ ] All capabilities are dropped (cap_drop ALL) and only needed ones are added
- [ ] no-new-privileges is set to true
- [ ] Seccomp profile is applied (RuntimeDefault at minimum)
- [ ] Resource limits (CPU, memory, PIDs) are set for all containers
- [ ] No containers run in privileged mode

### Kubernetes Cluster Security
- [ ] RBAC is configured with least privilege for all users and service accounts
- [ ] Default-deny NetworkPolicies are applied in all namespaces
- [ ] Pod Security Standards (Restricted) are enforced in production namespaces
- [ ] etcd is encrypted at rest
- [ ] Kubernetes audit logging is enabled with appropriate policy
- [ ] API server authentication uses OIDC or certificate-based auth (no static tokens)
- [ ] Service account token auto-mount is disabled by default

### Admission Control
- [ ] OPA Gatekeeper or Kyverno is deployed and enforcing policies
- [ ] Policies block privileged containers, host networking, and host PID/IPC
- [ ] Policies require resource limits on all workloads
- [ ] Policies verify image signatures before admission
- [ ] Policies restrict image sources to approved registries

### Runtime Monitoring
- [ ] Falco or equivalent runtime security tool is deployed
- [ ] Alerts are configured for shell access, file modifications, and network anomalies
- [ ] Container drift detection is enabled
- [ ] Log aggregation captures all container and Kubernetes audit logs
- [ ] Incident response procedures are documented for container security events
