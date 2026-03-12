# Supply Chain Attacks: Comprehensive Guide

## Metadata
- **Category**: Dependency and Supply Chain Security
- **Audience**: Software Engineers, DevSecOps, Security Engineers, Engineering Managers
- **Complexity**: Intermediate to Advanced
- **Prerequisites**: Dependency management, CI/CD pipelines, package registry fundamentals
- **Last Updated**: 2025-12

---

## Table of Contents

1. [Introduction](#introduction)
2. [Attack Taxonomy](#attack-taxonomy)
3. [Attack Vectors by Target](#attack-vectors-by-target)
4. [Real-World Incidents](#real-world-incidents)
5. [Defense: Package Registry Security](#defense-package-registry-security)
6. [Defense: Source Code Integrity](#defense-source-code-integrity)
7. [Defense: Build System Security](#defense-build-system-security)
8. [Defense: Distribution Security](#defense-distribution-security)
9. [Defense: Install Script Review](#defense-install-script-review)
10. [Defense: Comprehensive Configuration](#defense-comprehensive-configuration)
11. [Incident Response for Supply Chain Attacks](#incident-response-for-supply-chain-attacks)
12. [Best Practices](#best-practices)
13. [Anti-Patterns](#anti-patterns)
14. [Enforcement Checklist](#enforcement-checklist)

---

## Introduction

A software supply chain attack compromises the tools, processes, or dependencies used to develop, build, and distribute software. Instead of attacking the target application directly, the attacker compromises an upstream component that the target consumes. This gives the attacker access to every downstream consumer of the compromised component.

Supply chain attacks are especially dangerous because they exploit trust relationships. When a developer installs a package from npm or PyPI, they implicitly trust the package author, the registry, the build system that produced the package, and every transitive dependency. Compromising any link in this chain grants the attacker code execution in the developer's environment or production systems.

The frequency and sophistication of supply chain attacks has increased dramatically. From the SolarWinds SUNBURST attack (2020) to the xz-utils backdoor (2024), these attacks demonstrate that even the most sophisticated organizations and carefully maintained open-source projects are vulnerable.

---

## Attack Taxonomy

### 1. Typosquatting

The attacker publishes a malicious package with a name similar to a popular legitimate package, hoping developers will install it by mistake.

| Legitimate Package | Typosquat Variant | Tactic |
|-------------------|-------------------|--------|
| `cross-env` | `crossenv` | Remove hyphen |
| `lodash` | `lodashs`, `1odash` | Extra char, char swap |
| `colors` | `colour`, `co1ors` | Spelling variant, number sub |
| `express` | `expres`, `expresss` | Missing/extra char |
| `typescript` | `typescipt` | Transposed chars |

Attack execution:
1. Attacker creates a package named `crossenv` on npm
2. Package contains legitimate-looking code plus malicious payload
3. Payload executes in `postinstall` script (runs automatically during `npm install`)
4. Malicious code steals environment variables, SSH keys, or credentials

### 2. Dependency Confusion

Exploits the resolution behavior of package managers when both public and private registries are configured. The attacker publishes a package on the public registry with the same name as an internal private package but with a higher version number.

Research by Alex Birsan (2021) demonstrated this attack against Apple, Microsoft, PayPal, Shopify, Netflix, Tesla, Uber, and over 30 other companies.

Attack execution:
1. Attacker discovers internal package names (from leaked manifests, error messages, JavaScript source maps, or job postings)
2. Attacker publishes packages with those names to the public npm/PyPI/RubyGems registry
3. Attacker sets version to `99.0.0` (higher than any internal version)
4. Package manager resolves the public package due to higher version
5. Malicious code executes during installation

### 3. Compromised Maintainer Accounts

The attacker gains access to a legitimate maintainer's account through credential theft, social engineering, or account takeover. They then publish a malicious version of the legitimate package.

Notable examples:
- **ua-parser-js** (October 2021): Maintainer's npm account was compromised. Malicious versions 0.7.29, 0.8.0, and 1.0.0 contained a cryptominer and credential stealer. 7 million weekly downloads affected.
- **coa and rc** (November 2021): npm packages compromised via maintainer account takeover. Malicious versions contained credential-stealing malware.

### 4. Malicious Maintainer Actions

The legitimate maintainer intentionally introduces malicious or destructive code.

- **colors and faker** (January 2022): Maintainer Marak Squires deliberately corrupted the `colors` and `faker` npm packages as a protest, adding infinite loops that printed garbage text. Affected thousands of projects including aws-cdk.
- **node-ipc** (March 2022): Maintainer added code that detected Russian and Belarusian IP addresses and overwrote files with heart emojis (protestware related to the Ukraine conflict).

### 5. Build System Attacks

The attacker compromises the build infrastructure to inject malicious code into artifacts without modifying source code.

- **SolarWinds SUNBURST** (December 2020): Attackers compromised the SolarWinds build system and injected the SUNBURST backdoor into Orion platform updates. Affected 18,000+ organizations including US government agencies.
- **Codecov** (April 2021): Attackers modified the Codecov Bash uploader script to exfiltrate environment variables (including CI/CD credentials) from customer CI pipelines.

### 6. CI/CD Pipeline Compromise

The attacker exploits misconfigured CI/CD pipelines to inject malicious code, steal secrets, or tamper with build artifacts.

Attack vectors:
- Poisoned pull requests that trigger CI/CD with malicious code
- Stolen CI/CD credentials (tokens, API keys)
- Compromised GitHub Actions or CI plugins
- Insecure workflow permissions (`contents: write`, `pull-requests: write`)

### 7. Source Code Repository Attacks

The attacker compromises the source code repository itself.

- **PHP self-hosted Git server** (March 2021): Attackers compromised php.net's self-hosted Git server and pushed malicious commits to the PHP source code repository, adding a backdoor disguised as a typo fix.
- **Gentoo GitHub** (June 2018): Attacker compromised a Gentoo developer's GitHub account and pushed malicious ebuilds to the Gentoo GitHub mirror.

### 8. Sophisticated Long-term Attacks

The attacker establishes trust over months or years before executing the attack.

- **xz-utils backdoor (CVE-2024-3094)** (March 2024): An attacker using the identity "Jia Tan" spent two years gaining trust as a maintainer of the xz compression library. They introduced a sophisticated backdoor into versions 5.6.0 and 5.6.1 that targeted OpenSSH's sshd via systemd, enabling remote code execution. The backdoor was discovered by Andres Freund (Microsoft) who noticed a 500ms latency increase in SSH connections.

---

## Attack Vectors by Target

### Package Registry Attacks

| Vector | Description | Defense |
|--------|-------------|---------|
| Typosquatting | Publish similar-named packages | Scope packages, verify names |
| Dependency confusion | Exploit public/private resolution | Registry source mapping |
| Account takeover | Compromise maintainer credentials | 2FA, security keys |
| Malicious publish | Maintainer publishes malicious code | Code review, provenance |
| Registry compromise | Attack registry infrastructure | Registry security, signing |

### Source Code Attacks

| Vector | Description | Defense |
|--------|-------------|---------|
| Compromised commits | Push malicious code to repo | Signed commits, branch protection |
| Pull request poisoning | Submit malicious PR | Code review, CI restrictions |
| Repository takeover | Gain admin access | 2FA, access controls |
| Social engineering | Gain maintainer trust over time | Multi-maintainer review |

### Build System Attacks

| Vector | Description | Defense |
|--------|-------------|---------|
| Build injection | Inject code during build | Hermetic builds, SLSA |
| CI/CD compromise | Exploit CI/CD pipeline | Minimal permissions, pinned actions |
| Plugin compromise | Malicious build plugins | Verify plugin integrity |
| Environment tampering | Modify build environment | Ephemeral build environments |

### Distribution Attacks

| Vector | Description | Defense |
|--------|-------------|---------|
| CDN compromise | Modify packages on CDN | Subresource integrity, signatures |
| Mirror poisoning | Serve malicious packages from mirror | Checksum verification |
| DNS hijacking | Redirect registry DNS | DNSSEC, certificate pinning |
| TLS interception | MITM the registry connection | Certificate pinning, verification |

---

## Real-World Incidents

### Timeline of Major Supply Chain Attacks

| Date | Incident | Impact | Vector |
|------|----------|--------|--------|
| 2017-08 | crossenv (npm) | Credential theft | Typosquatting |
| 2018-11 | event-stream (npm) | Bitcoin wallet theft | Compromised maintainer |
| 2020-12 | SolarWinds SUNBURST | 18,000+ orgs, US govt | Build system |
| 2021-02 | Dependency confusion research | 35+ companies affected | Dependency confusion |
| 2021-04 | Codecov bash uploader | CI credential theft | Distribution |
| 2021-07 | Kaseya VSA | 1,500+ businesses | Software update |
| 2021-10 | ua-parser-js (npm) | 7M weekly downloads | Account takeover |
| 2021-11 | coa, rc (npm) | Credential theft | Account takeover |
| 2022-01 | colors, faker (npm) | Thousands of projects | Malicious maintainer |
| 2022-03 | node-ipc (npm) | File destruction | Malicious maintainer |
| 2022-05 | ctx (PyPI) | Credential theft | Account takeover |
| 2023-03 | 3CX | Millions of users | Build system |
| 2023-09 | Ledger Connect Kit | DeFi users | NPM account takeover |
| 2024-03 | xz-utils (CVE-2024-3094) | Linux distros | Long-term social engineering |
| 2024-06 | polyfill.io | 100,000+ websites | Domain/CDN takeover |

### Event-stream Incident (2018) - Deep Analysis

1. Popular npm package `event-stream` (2M weekly downloads) maintained by a single developer
2. Maintainer transferred ownership to new contributor who had submitted helpful PRs
3. New maintainer added `flatmap-stream` as a dependency
4. `flatmap-stream` contained encrypted malicious payload
5. Payload targeted Copay Bitcoin wallet, stealing wallet credentials
6. Attack went undetected for 2 months

Lessons learned:
- Single-maintainer packages are high-risk targets
- Maintainer transfer should trigger security review
- Encrypted/obfuscated code in dependencies is a red flag
- Install scripts and new dependencies should be manually reviewed

### xz-utils Backdoor (2024) - Deep Analysis

1. "Jia Tan" began contributing to xz-utils in 2021
2. Spent 2+ years building trust with helpful contributions
3. Used sockpuppet accounts to pressure the original maintainer to add co-maintainers
4. Gradually introduced changes that laid groundwork for the backdoor
5. The backdoor was injected via test fixture files (binary test data)
6. Build system modifications extracted and activated the backdoor
7. Targeted OpenSSH's sshd on systemd-based Linux systems
8. Backdoor enabled remote code execution before authentication
9. Only affected versions 5.6.0 and 5.6.1 (caught before wide distribution)
10. Discovered by Andres Freund who noticed 500ms SSH latency regression

Lessons learned:
- Trust is earned over years but can be exploited
- Binary test fixtures can hide malicious code
- Build system complexity creates hiding places
- Performance testing can detect backdoors
- Multi-person review of all changes is essential
- Compressed/binary data in commits requires extra scrutiny

---

## Defense: Package Registry Security

### Scoped and Namespaced Packages

```json
// package.json - always use scoped packages for internal code
{
  "dependencies": {
    "@mycompany/auth-service": "^2.0.0",
    "@mycompany/logger": "^1.5.0",
    "@mycompany/config": "^3.1.0"
  }
}
```

### Registry Configuration (.npmrc)

```ini
# .npmrc - prevent dependency confusion
# Route all @mycompany packages to private registry
@mycompany:registry=https://npm.mycompany.com/
//npm.mycompany.com/:_authToken=${NPM_TOKEN}

# Disable install scripts for untrusted packages
ignore-scripts=true

# Enforce package-lock.json
package-lock=true

# Audit on every install
audit=true
audit-level=high

# Require exact versions
save-exact=true

# Use specific public registry (avoid typos)
registry=https://registry.npmjs.org/
```

### Python Registry Configuration (pip.conf)

```ini
# pip.conf - prevent dependency confusion
[global]
# Use ONLY the private registry (vendor all public packages there)
index-url = https://pypi.mycompany.com/simple/

# If mixing registries, configure explicitly
# index-url = https://pypi.mycompany.com/simple/
# extra-index-url = https://pypi.org/simple/

[install]
# Require hashes for all packages
require-hashes = true

# Only install from the configured index
no-deps = false
```

### Go Registry Configuration (GONOSUMCHECK, GONOSUMDB, GOPRIVATE)

```bash
# Set GOPRIVATE to prevent private modules from being fetched from public proxy
export GOPRIVATE="github.com/mycompany/*,gitlab.mycompany.com/*"

# Set GONOSUMCHECK to skip checksum verification for private modules
export GONOSUMCHECK="github.com/mycompany/*"

# Use Go module proxy for public modules (with sumdb verification)
export GOPROXY="https://proxy.golang.org,direct"
export GONOSUMDB="github.com/mycompany/*"
```

### Two-Factor Authentication for Package Publishing

```bash
# npm: enable 2FA for publishing
npm profile enable-2fa auth-and-writes

# npm: require 2FA for a package
npm access 2fa-required @mycompany/critical-package

# PyPI: enable 2FA and use API tokens
# https://pypi.org/manage/account/two-factor/

# PyPI: use trusted publishers (OIDC, no long-lived tokens)
# Configure in pypi.org project settings
```

---

## Defense: Source Code Integrity

### Signed Git Commits

```bash
# Configure GPG signing for all commits
git config --global commit.gpgsign true
git config --global user.signingkey ABCDEF1234567890

# Verify a signed commit
git verify-commit HEAD

# Show signatures in log
git log --show-signature

# Configure SSH signing (alternative to GPG)
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
```

### Branch Protection Rules

```yaml
# GitHub branch protection (configured via API or UI)
# POST /repos/{owner}/{repo}/branches/{branch}/protection
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["ci/security-scan", "ci/tests"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 2,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": true
  },
  "required_signatures": true,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

### CODEOWNERS for Sensitive Files

```
# .github/CODEOWNERS
# Require security team review for supply chain configurations
.github/dependabot.yml @security-team
.github/workflows/ @security-team @platform-team
.npmrc @security-team
package.json @security-team
package-lock.json @security-team
Dockerfile @security-team @platform-team
```

---

## Defense: Build System Security

### GitHub Actions Security

```yaml
# .github/workflows/secure-build.yml
name: Secure Build
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# Restrict default permissions
permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write  # Only if needed
    steps:
      # Pin actions to full SHA (not tags)
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - uses: actions/setup-node@b39b52d1213e96004bfcb1c61a8a6fa8ab84f3e8 # v4.0.0
        with:
          node-version: '20'

      # Verify dependencies
      - run: npm ci
      - run: npm audit --audit-level=high

      # Build in clean environment
      - run: npm run build

      # Do NOT use pull_request_target for untrusted code
      # Do NOT checkout PR head in pull_request_target workflows
```

### Preventing CI/CD Poisoning

```yaml
# Restrict workflow triggers for sensitive operations
name: Deploy
on:
  push:
    branches: [main]  # Only main branch, never PRs

# Never use pull_request_target with checkout of PR code
# This pattern is DANGEROUS:
# on: pull_request_target
# steps:
#   - uses: actions/checkout@v4
#     with:
#       ref: ${{ github.event.pull_request.head.sha }}  # DANGEROUS

permissions:
  contents: read  # Minimal permissions

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # Require environment approval
    steps:
      - uses: actions/checkout@v4
      - run: npm ci --ignore-scripts  # Disable install scripts
      - run: npm run build
      - run: npm test
```

### Hermetic and Reproducible Builds

```dockerfile
# Dockerfile for hermetic build
FROM node:20.10.0-alpine3.19@sha256:abc123... AS builder

# Copy only dependency files first (layer caching)
COPY package.json package-lock.json ./

# Install with frozen lockfile and no install scripts
RUN npm ci --ignore-scripts

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build
RUN npm run build

# Verify build output
RUN sha256sum dist/* > checksums.txt

# Production stage
FROM node:20.10.0-alpine3.19@sha256:abc123... AS production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

USER node
CMD ["node", "dist/index.js"]
```

---

## Defense: Distribution Security

### Subresource Integrity (SRI)

```html
<!-- Use SRI for externally hosted scripts -->
<script
  src="https://cdn.example.com/library.min.js"
  integrity="sha384-abc123def456..."
  crossorigin="anonymous">
</script>

<!-- Never load scripts from domains you do not control without SRI -->
<!-- The polyfill.io incident (2024) demonstrated this risk -->
```

### Package Signature Verification

```bash
# npm: verify package provenance
npm audit signatures

# Go: module checksum verification (automatic via go.sum)
go mod verify

# Cosign: verify container image signatures
cosign verify \
  --certificate-identity=builder@mycompany.com \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  ghcr.io/mycompany/myapp:latest

# Sigstore: verify with rekor transparency log
rekor-cli verify --artifact mypackage.tar.gz --signature mypackage.tar.gz.sig
```

### Self-Hosting Critical Dependencies

```yaml
# Verdaccio configuration (self-hosted npm registry)
# config.yaml
storage: ./storage
auth:
  htpasswd:
    file: ./htpasswd
    max_users: -1  # Disable registration
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
    timeout: 30s
    max_fails: 5
    cache: true
packages:
  '@mycompany/*':
    access: $authenticated
    publish: $authenticated
    unpublish: $authenticated
  '**':
    access: $authenticated
    publish: $authenticated
    proxy: npmjs  # Proxy to npm for public packages
```

---

## Defense: Install Script Review

Install scripts (preinstall, postinstall, install) execute arbitrary code during dependency installation. They are the primary mechanism for supply chain attacks via package registries.

### Disabling Install Scripts

```ini
# .npmrc - disable install scripts globally
ignore-scripts=true

# Then explicitly allow scripts for packages that need them
# Run scripts manually after review:
# npm rebuild <package-name>
```

```bash
# Install without running scripts
npm install --ignore-scripts

# Run scripts selectively after review
npm rebuild node-sass  # Only rebuild packages that need native compilation
```

### Reviewing Install Scripts

```bash
# List all install scripts in the dependency tree
npm ls --json | jq '.dependencies | to_entries[] |
  select(.value.scripts.preinstall or .value.scripts.postinstall or .value.scripts.install) |
  {name: .key, scripts: .value.scripts}'

# Review a specific package's scripts before installing
npm pack <package-name>
tar -xzf <package-name>-*.tgz
cat package/package.json | jq '.scripts'
```

### Script Auditing Tools

```bash
# Use socket.dev to check for suspicious install scripts
npx socket npm info <package-name>

# Use npm-audit-resolver for manual review workflow
npx npm-audit-resolver
```

---

## Defense: Comprehensive Configuration

### Complete .npmrc for Supply Chain Defense

```ini
# .npmrc - comprehensive supply chain defense
# Scoped package routing
@mycompany:registry=https://npm.mycompany.com/
//npm.mycompany.com/:_authToken=${NPM_TOKEN}

# Public registry
registry=https://registry.npmjs.org/

# Security settings
audit=true
audit-level=high
ignore-scripts=true
package-lock=true
save-exact=true

# Prevent lifecycle script execution from dependencies
# Run scripts explicitly: npm rebuild <package>

# Fund and message suppression (reduce noise)
fund=false
update-notifier=false
```

### Complete pip Configuration for Supply Chain Defense

```ini
# pip.conf
[global]
index-url = https://pypi.mycompany.com/simple/
trusted-host = pypi.mycompany.com

[install]
require-hashes = true
no-cache-dir = true
```

```txt
# requirements.txt with hashes (generated by pip-compile --generate-hashes)
requests==2.31.0 \
    --hash=sha256:58cd2187c01e70e6e26505bca751777aa9f2ee0b7f4300988b709f44e013003e
certifi==2023.11.17 \
    --hash=sha256:e036ab49d5b79556f99cfc2d9320b34cfbe5be05c5871b51de9329f0603b0474
```

### GitHub Actions Security Hardening

```yaml
# .github/workflows/security-hardened.yml
name: Security-Hardened Build

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# Minimal default permissions
permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15  # Prevent resource abuse

    permissions:
      contents: read
      security-events: write  # For SARIF upload only

    steps:
      # Pin ALL actions to full SHA
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          persist-credentials: false  # Do not persist git credentials

      - uses: actions/setup-node@b39b52d1213e96004bfcb1c61a8a6fa8ab84f3e8 # v4.0.0
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      # Install with frozen lockfile and no scripts
      - run: npm ci --ignore-scripts

      # Run security scans
      - run: npm audit --audit-level=high
      - run: npm audit signatures

      # Build
      - run: npm run build

      # Generate SBOM
      - uses: anchore/sbom-action@78fc58e266e87a38d4194b2137a3d4e9bcaf7ca1 # v0.17.0
        with:
          format: cyclonedx-json
          output-file: sbom.json
```

---

## Incident Response for Supply Chain Attacks

### Detection Signals

| Signal | Description | Tool |
|--------|-------------|------|
| Unexpected network calls | Package phones home during install | Socket.dev, firewall logs |
| Env variable access | Package reads credentials | Socket.dev, runtime monitoring |
| File system writes | Package modifies unexpected paths | Runtime monitoring |
| Version anomaly | New version from different author | Registry audit logs |
| Dependency change | New transitive dependency added | Lock file diff, Renovate |
| Build time increase | Unexplained latency in builds | CI/CD metrics |
| Binary size change | Artifact size increases unexpectedly | Build artifact comparison |

### Response Playbook

1. **Identify**: Determine which package/version is compromised
2. **Scope**: Identify all projects that consume the compromised package
3. **Contain**: Pin to a known-good version or remove the dependency
4. **Analyze**: Determine what the malicious code does (credential theft, backdoor, etc.)
5. **Remediate**: Rotate all credentials that may have been exposed
6. **Recover**: Rebuild and redeploy affected applications from clean sources
7. **Report**: Notify affected users and file a report with the registry
8. **Improve**: Update defenses to prevent recurrence

```bash
# Step 1: Find which projects use a compromised package
# Search across all repositories
gh api search/code -q "compromised-package filename:package-lock.json" \
  --paginate

# Step 2: Check if the compromised version is installed
npm ls compromised-package

# Step 3: Override to safe version
# Add to package.json:
# "overrides": { "compromised-package": "1.2.2" }
npm install

# Step 4: Rotate potentially exposed secrets
# List all environment variables that CI had access to
# Rotate: npm tokens, cloud credentials, API keys, database passwords
```

---

## Best Practices

1. **Use scoped/namespaced packages for all internal code.** Namespace internal packages (e.g., `@mycompany/package`) and configure registry routing to prevent dependency confusion attacks.

2. **Pin GitHub Actions to full commit SHAs.** Tags are mutable and can be reassigned to malicious commits. Always pin to the full 40-character SHA and add the tag as a comment for readability.

3. **Disable install scripts by default.** Set `ignore-scripts=true` in `.npmrc` and explicitly rebuild only packages that require native compilation. This blocks the primary attack vector for npm-based supply chain attacks.

4. **Require two-factor authentication for all package publishers.** Enable 2FA on npm, PyPI, RubyGems, and crates.io accounts. Use hardware security keys where supported. Enforce `npm access 2fa-required` on critical packages.

5. **Review dependency changes in every pull request.** Lock file changes, new dependencies, and version bumps should receive explicit review. Use CODEOWNERS to require security team approval for supply chain configuration files.

6. **Verify package provenance and signatures.** Use `npm audit signatures`, `cosign verify`, and `go mod verify` to validate that packages come from their claimed sources.

7. **Implement SLSA Level 2+ for your own builds.** Generate build provenance, use hosted build platforms, and verify provenance of consumed artifacts. Progress toward SLSA Level 3 (hardened builds).

8. **Monitor for new supply chain attack disclosures.** Subscribe to npm security advisories, Socket.dev alerts, GitHub Advisory Database, and security news feeds. Respond to compromised package alerts within hours.

9. **Maintain an inventory of all dependencies (SBOM).** Generate SBOMs for every release. Use them to quickly scope impact when a supply chain attack is disclosed.

10. **Use multiple layers of defense.** No single measure prevents all supply chain attacks. Combine scoped packages, registry configuration, install script control, provenance verification, SCA scanning, and lock file integrity for defense in depth.

---

## Anti-Patterns

1. **Trusting packages based solely on download count.** High download counts indicate popularity, not security. The `event-stream` package had 2 million weekly downloads when it was compromised.

2. **Using mutable tags for GitHub Actions.** Referencing actions by tag (e.g., `actions/checkout@v4`) allows the tag to be silently reassigned. Always pin to the full SHA.

3. **Allowing install scripts to run unreviewed.** Default npm behavior executes preinstall and postinstall scripts automatically. This is the primary vector for malicious package attacks.

4. **Not reviewing lock file changes.** Lock file diffs reveal new dependencies, version changes, and hash modifications. Ignoring these changes misses the most visible supply chain attack signals.

5. **Mixing public and private registries without source mapping.** Configuring `extra-index-url` in pip or multiple registries in npm without explicit package-to-source mapping enables dependency confusion attacks.

6. **Transferring package ownership without security review.** When a maintainer transfers a package to a new owner, all downstream consumers inherit the trust relationship with the new owner. This is how the `event-stream` attack succeeded.

7. **Loading scripts from third-party CDNs without Subresource Integrity.** The polyfill.io incident demonstrated that CDN domains can change ownership and serve malicious content. Always use SRI hashes for externally hosted scripts.

8. **Assuming open-source review catches everything.** The xz-utils backdoor was developed over two years in a widely-used project. "Many eyes" is not a reliable security control. Use automated tools and structured review processes.

---

## Enforcement Checklist

### Registry Security
- [ ] Internal packages use scoped/namespaced names
- [ ] Registry routing is configured (`.npmrc`, `pip.conf`, etc.)
- [ ] Internal package names are claimed on public registries
- [ ] Two-factor authentication is enabled for all package publishing accounts
- [ ] Package publishing requires security team approval

### Source Code Integrity
- [ ] Git commits are signed (GPG or SSH)
- [ ] Branch protection rules enforce signed commits
- [ ] Pull requests require minimum 2 approvals
- [ ] CODEOWNERS is configured for supply chain configuration files
- [ ] Force pushes are disabled on main/release branches

### Build System Security
- [ ] GitHub Actions are pinned to full SHA
- [ ] Workflow permissions use minimal `contents: read` default
- [ ] Install scripts are disabled by default (`ignore-scripts=true`)
- [ ] CI/CD secrets use environment-scoped access
- [ ] Build environments are ephemeral (fresh for each build)

### Dependency Verification
- [ ] Lock files are committed and enforced (`npm ci`, `--frozen-lockfile`)
- [ ] Package signatures are verified (`npm audit signatures`)
- [ ] New dependencies require security review
- [ ] Lock file changes are reviewed in PRs
- [ ] SCA scanning runs on every build

### Distribution Security
- [ ] Externally hosted scripts use Subresource Integrity
- [ ] Container images are signed with Cosign
- [ ] Build artifacts include provenance attestation
- [ ] Critical dependencies are self-hosted or vendored

### Monitoring and Response
- [ ] Supply chain attack alert feeds are monitored
- [ ] Incident response playbook exists for compromised dependencies
- [ ] SBOM is generated for every release
- [ ] Credential rotation procedure is documented and tested
- [ ] Post-incident reviews include supply chain analysis
