# Jenkins

| Attribute      | Value                                                        |
|---------------|--------------------------------------------------------------|
| Domain        | DevOps > CI/CD                                               |
| Importance    | Medium                                                       |
| Last Updated  | 2026-03-10                                                   |
| Cross-ref     | [Pipeline Design](pipeline-design.md), [Fundamentals](fundamentals.md) |

---

## Core Concepts

### Jenkins Architecture

Jenkins follows a controller-agent model. The **controller** (formerly "master") orchestrates
builds, serves the UI, manages configuration, and dispatches work. **Agents** (formerly "slaves")
execute the actual build steps. Each agent exposes one or more **executors** -- threads that
run individual builds concurrently.

```
┌─────────────────────────────────────────────┐
│              Jenkins Controller              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐│
│  │ Scheduler│ │  UI/API  │ │  Config/Creds ││
│  └──────────┘ └──────────┘ └──────────────┘│
│              Dispatches work                 │
└──────┬──────────────┬──────────────┬────────┘
       │              │              │
  ┌────▼────┐   ┌─────▼────┐  ┌─────▼─────┐
  │ Agent 1 │   │ Agent 2  │  │ Agent 3   │
  │ 2 exec. │   │ 4 exec.  │  │ (K8s Pod) │
  │ Linux   │   │ Windows  │  │ Ephemeral │
  └─────────┘   └──────────┘  └───────────┘
```

**Key principle:** Never run production builds on the controller. The controller should have
zero executors configured; all work must run on agents.

### Declarative vs Scripted Pipeline

Jenkins supports two Jenkinsfile syntaxes. Prefer **declarative** for most use cases --
it enforces structure, supports `when` conditions, and integrates with Blue Ocean.
Use **scripted** only when declarative's structure is genuinely insufficient.

**Declarative Pipeline:**

```groovy
// Jenkinsfile (Declarative)
pipeline {
    agent {
        kubernetes {
            yaml '''
            apiVersion: v1
            kind: Pod
            spec:
              containers:
              - name: node
                image: node:20-alpine
                command: ['sleep', '3600']
              - name: docker
                image: docker:24-dind
                securityContext:
                  privileged: true
            '''
        }
    }

    environment {
        REGISTRY = 'registry.example.com'
        APP_NAME = 'my-service'
        // Credentials reference (never hardcode)
        DOCKER_CREDS = credentials('docker-registry-creds')
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timestamps()
    }

    stages {
        stage('Install') {
            steps {
                container('node') {
                    sh 'npm ci --prefer-offline'
                }
            }
        }

        stage('Quality Gate') {
            parallel {
                stage('Lint') {
                    steps {
                        container('node') {
                            sh 'npm run lint'
                        }
                    }
                }
                stage('Unit Tests') {
                    steps {
                        container('node') {
                            sh 'npm run test:unit -- --coverage'
                        }
                    }
                    post {
                        always {
                            junit 'reports/junit.xml'
                            publishHTML([
                                reportDir: 'coverage/lcov-report',
                                reportFiles: 'index.html',
                                reportName: 'Coverage Report'
                            ])
                        }
                    }
                }
                stage('Security Scan') {
                    steps {
                        container('node') {
                            sh 'npm audit --audit-level=high'
                        }
                    }
                }
            }
        }

        stage('Build Image') {
            when {
                anyOf {
                    branch 'main'
                    branch pattern: 'release/*'
                }
            }
            steps {
                container('docker') {
                    sh """
                        docker build \
                          -t ${REGISTRY}/${APP_NAME}:${BUILD_NUMBER} \
                          -t ${REGISTRY}/${APP_NAME}:latest \
                          .
                        docker push ${REGISTRY}/${APP_NAME}:${BUILD_NUMBER}
                    """
                }
            }
        }

        stage('Deploy Staging') {
            when { branch 'main' }
            steps {
                sh "kubectl set image deployment/${APP_NAME} ${APP_NAME}=${REGISTRY}/${APP_NAME}:${BUILD_NUMBER} -n staging"
                sh "kubectl rollout status deployment/${APP_NAME} -n staging --timeout=120s"
            }
        }
    }

    post {
        failure {
            slackSend channel: '#ci-alerts',
                      color: 'danger',
                      message: "FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER} (<${env.BUILD_URL}|Open>)"
        }
        success {
            slackSend channel: '#ci-alerts',
                      color: 'good',
                      message: "SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
        }
        cleanup {
            cleanWs()
        }
    }
}
```

**Scripted Pipeline (use sparingly):**

```groovy
// Jenkinsfile (Scripted) -- for complex conditional logic
node('linux') {
    try {
        stage('Checkout') {
            checkout scm
        }

        def branches = [:]
        def services = ['api', 'worker', 'gateway']

        // Dynamic parallel stages -- not possible in declarative
        services.each { svc ->
            branches[svc] = {
                stage("Build ${svc}") {
                    sh "docker build -t myrepo/${svc}:${env.BUILD_NUMBER} ./services/${svc}"
                }
            }
        }
        parallel branches

    } catch (e) {
        currentBuild.result = 'FAILURE'
        throw e
    } finally {
        cleanWs()
    }
}
```

### Shared Libraries

Extract reusable pipeline logic into a shared library stored in Git. This prevents
copy-pasting Jenkinsfile logic across hundreds of repositories.

```
(repository: jenkins-shared-lib)
├── vars/
│   ├── standardPipeline.groovy    # Global pipeline templates
│   ├── deployToK8s.groovy         # Reusable deploy step
│   └── notifySlack.groovy         # Notification helper
├── src/
│   └── com/example/
│       └── Docker.groovy          # OOP helper classes
└── resources/
    └── pod-templates/
        └── node-agent.yaml        # K8s pod templates
```

```groovy
// vars/standardPipeline.groovy
def call(Map config = [:]) {
    pipeline {
        agent {
            kubernetes {
                yamlFile "resources/pod-templates/${config.agentTemplate ?: 'default'}.yaml"
            }
        }
        stages {
            stage('Build') {
                steps {
                    sh config.buildCommand ?: 'make build'
                }
            }
            stage('Test') {
                steps {
                    sh config.testCommand ?: 'make test'
                }
            }
            stage('Deploy') {
                when { branch 'main' }
                steps {
                    deployToK8s(
                        service: config.serviceName,
                        namespace: config.namespace ?: 'production',
                        image: "${config.registry}/${config.serviceName}:${env.BUILD_NUMBER}"
                    )
                }
            }
        }
    }
}
```

```groovy
// Consuming Jenkinsfile (entire file)
@Library('my-shared-lib') _

standardPipeline(
    serviceName: 'user-service',
    registry: 'registry.example.com',
    agentTemplate: 'node-agent',
    buildCommand: 'npm ci && npm run build',
    testCommand: 'npm test'
)
```

### Key Jenkins Plugins

| Plugin                    | Purpose                                | Status (2026)     |
|--------------------------|----------------------------------------|-------------------|
| Pipeline                 | Core Jenkinsfile support               | Essential         |
| Kubernetes               | Ephemeral pod agents on K8s            | Essential         |
| Docker Pipeline          | Build/push Docker images in pipeline   | Essential         |
| Blue Ocean               | Modern UI for pipeline visualization   | Maintenance mode  |
| Credentials Binding      | Inject secrets into builds securely    | Essential         |
| Job DSL                  | Programmatic job creation              | Mature            |
| Configuration as Code    | YAML-based Jenkins configuration       | Essential         |
| Warnings Next Gen        | Static analysis result aggregation     | Recommended       |
| Slack/Teams Notification | Build notifications                    | Common            |
| Lockable Resources       | Mutex for shared resources             | Useful            |

### Jenkins on Kubernetes

Run Jenkins controller and agents on Kubernetes for elastic scaling. Use the
**Jenkins Kubernetes Operator** for lifecycle management, or **Helm charts** for simpler setups.

```yaml
# Helm values for Jenkins on Kubernetes
controller:
  image: jenkins/jenkins
  tag: "2.479-lts"
  resources:
    requests:
      cpu: "1"
      memory: "2Gi"
    limits:
      cpu: "2"
      memory: "4Gi"
  JCasC:
    configScripts:
      cloud-config: |
        jenkins:
          clouds:
            - kubernetes:
                name: "k8s"
                serverUrl: "https://kubernetes.default"
                namespace: "jenkins-agents"
                podLabels:
                  - key: "jenkins/agent"
                    value: "true"
                templates:
                  - name: "default"
                    label: "default"
                    containers:
                      - name: "jnlp"
                        image: "jenkins/inbound-agent:latest"
                        resourceRequestCpu: "500m"
                        resourceRequestMemory: "512Mi"
                    podRetention: never  # Ephemeral agents

persistence:
  enabled: true
  size: 50Gi
  storageClass: "gp3"
```

**Ephemeral agents** spin up as Kubernetes pods per build, then terminate. This eliminates
agent drift, reduces cost (no idle agents), and provides clean build environments.

### Jenkins Configuration as Code (JCasC)

Manage the entire Jenkins configuration in YAML. Store it in Git alongside infrastructure code.
Eliminate manual UI clicks entirely.

```yaml
# jenkins-casc.yaml
jenkins:
  systemMessage: "Managed by JCasC -- do not configure via UI"
  numExecutors: 0  # No builds on controller
  securityRealm:
    ldap:
      configurations:
        - server: "ldap.example.com"
          rootDN: "dc=example,dc=com"
  authorizationStrategy:
    roleBased:
      roles:
        global:
          - name: "admin"
            permissions:
              - "Overall/Administer"
            entries:
              - group: "jenkins-admins"
          - name: "developer"
            permissions:
              - "Job/Build"
              - "Job/Read"
              - "Job/Workspace"
            entries:
              - group: "developers"

credentials:
  system:
    domainCredentials:
      - credentials:
          - usernamePassword:
              scope: GLOBAL
              id: "docker-registry-creds"
              username: "${DOCKER_USER}"
              password: "${DOCKER_PASSWORD}"
          - string:
              scope: GLOBAL
              id: "slack-token"
              secret: "${SLACK_TOKEN}"

unclassified:
  slackNotifier:
    teamDomain: "mycompany"
    tokenCredentialId: "slack-token"
```

### Credential Management

Never store secrets in Jenkinsfiles, environment variables on agents, or SCM.
Use the Jenkins Credentials Store with the Credentials Binding plugin.

```groovy
// Correct: credentials injected via binding
withCredentials([
    usernamePassword(
        credentialsId: 'db-creds',
        usernameVariable: 'DB_USER',
        passwordVariable: 'DB_PASS'
    ),
    file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG'),
    string(credentialsId: 'api-key', variable: 'API_KEY')
]) {
    sh '''
        echo "Deploying with user ${DB_USER}"
        # DB_PASS is masked in logs automatically
        kubectl --kubeconfig=${KUBECONFIG} apply -f manifests/
    '''
}
```

For enterprise setups, integrate with **HashiCorp Vault** or **AWS Secrets Manager**
via their respective plugins rather than storing secrets in Jenkins.

### Pipeline Parallelism and Agent Templating

Maximize throughput with parallel stages and purpose-built agents.

```groovy
// Matrix builds -- declarative parallel
pipeline {
    agent none  // Each stage picks its own agent

    stages {
        stage('Test Matrix') {
            matrix {
                axes {
                    axis {
                        name 'NODE_VERSION'
                        values '18', '20', '22'
                    }
                    axis {
                        name 'OS'
                        values 'linux', 'windows'
                    }
                }
                excludes {
                    exclude {
                        axis {
                            name 'NODE_VERSION'
                            values '18'
                        }
                        axis {
                            name 'OS'
                            values 'windows'
                        }
                    }
                }
                stages {
                    stage('Test') {
                        agent { label "${OS}-node${NODE_VERSION}" }
                        steps {
                            sh 'npm ci && npm test'
                        }
                    }
                }
            }
        }
    }
}
```

### Jenkins vs Modern CI: When Jenkins Still Makes Sense

| Criterion                      | Jenkins                            | GitHub Actions / GitLab CI        |
|-------------------------------|-------------------------------------|-----------------------------------|
| Self-hosted requirement       | Full control, air-gapped envs       | SaaS-first (self-hosted limited)  |
| Complex pipeline logic        | Groovy: unlimited flexibility       | YAML: structured but constrained  |
| Plugin ecosystem              | 1,800+ plugins, mature              | Growing marketplace               |
| On-premise infrastructure     | Native support                      | Requires runners/agents           |
| Maintenance burden            | High (upgrades, plugins, security)  | Low (managed service)             |
| Startup/small team            | Overkill                            | Preferred                         |
| Multi-SCM (Git, SVN, Perforce)| Full support                        | Tied to their platform            |
| Kubernetes-native             | Via plugin (works well)             | Native in GitLab, add-on in GHA   |

**Keep Jenkins when:** Air-gapped environments, existing large investment, multi-SCM needs,
or complex orchestration (hundreds of interrelated pipelines with shared libraries).

**Migrate away when:** Greenfield project, small team, single SCM provider, or the
maintenance cost exceeds the value of Jenkins-specific features.

---

## Best Practices

1. **Run zero executors on the controller.** The controller should only schedule and
   coordinate. All builds must execute on agents to isolate workloads and prevent
   controller compromise.

2. **Use declarative pipeline as the default.** Declarative syntax enforces structure,
   enables Blue Ocean visualization, and provides built-in `post` blocks. Fall back to
   scripted only for genuinely dynamic requirements (e.g., programmatic parallel stages).

3. **Adopt JCasC for all configuration.** Store `jenkins.yaml` in Git. Disable UI-based
   configuration changes in production. Recreate the controller from code in under 10 minutes.

4. **Extract shared logic into shared libraries.** Maintain a versioned library with
   reusable pipeline templates, deployment functions, and notification helpers. Pin library
   versions in consuming Jenkinsfiles to prevent breaking changes.

5. **Use ephemeral Kubernetes agents.** Configure `podRetention: never` so every build
   gets a fresh environment. This eliminates agent drift and reduces infrastructure costs.

6. **Integrate an external secrets manager.** Use HashiCorp Vault or cloud-native
   secret managers instead of the built-in Jenkins credential store for production secrets.
   The Jenkins store is acceptable only for CI-specific credentials.

7. **Enforce pipeline timeouts and resource limits.** Set `timeout()` in pipeline options
   and `resources` in Kubernetes pod templates. Prevent runaway builds from consuming cluster
   resources indefinitely.

8. **Version-lock plugins and test upgrades.** Maintain a `plugins.txt` with explicit
   versions. Test plugin upgrades in a staging Jenkins instance before applying to production.

9. **Implement build result notifications.** Configure Slack, Teams, or email notifications
   in `post` blocks. Include build URL, duration, and committer information.

10. **Audit and rotate credentials quarterly.** Use the Audit Trail plugin to log all
    credential access. Rotate secrets on a fixed schedule and after any personnel change.

---

## Anti-Patterns

| Anti-Pattern                          | Impact                                            | Fix                                                       |
|---------------------------------------|---------------------------------------------------|-----------------------------------------------------------|
| Running builds on the controller      | Security risk, resource contention, single PoF    | Set controller executors to 0; use agents exclusively     |
| Hardcoded secrets in Jenkinsfile      | Secrets leak via SCM history                      | Use `credentials()` binding and external vault            |
| Snowflake Jenkins (UI-configured)     | Unreproducible setup, disaster recovery failure   | Adopt JCasC; store all config in Git                      |
| Copy-pasting pipeline across repos    | Drift, inconsistent practices, maintenance hell   | Extract into shared library with versioned releases       |
| Persistent, manually maintained agents| Agent drift, "works on my agent" bugs             | Use ephemeral K8s or Docker agents                        |
| No pipeline timeout                   | Hung builds consume executors for hours            | Set `timeout()` in every pipeline; default 30 minutes     |
| Installing plugins without versioning | Random breakage after auto-updates                | Pin versions in `plugins.txt`; disable auto-update        |
| Monolithic pipeline (no stages)       | No visibility into which step failed              | Break into stages; use parallel where independent         |

---

## Enforcement Checklist

- [ ] Controller has zero executors configured
- [ ] All Jenkinsfiles use declarative pipeline syntax (exceptions documented)
- [ ] JCasC is the sole configuration mechanism (UI changes are overwritten on restart)
- [ ] Shared library is versioned and used by all team pipelines
- [ ] Agents are ephemeral (Kubernetes pods or Docker containers)
- [ ] Credentials are managed via external secrets manager or Jenkins Credentials Store
- [ ] Pipeline timeouts are set in every pipeline (max 30-60 minutes)
- [ ] Plugin versions are pinned and tested before upgrade
- [ ] Build notifications are configured for failure and recovery
- [ ] Security: CSRF protection enabled, agent-to-controller access restricted
- [ ] Backup strategy exists for Jenkins home (or controller is fully reproducible via JCasC)
- [ ] Pipeline linting runs via `jenkins-lint` or `npm-groovy-lint` in pre-commit hooks
