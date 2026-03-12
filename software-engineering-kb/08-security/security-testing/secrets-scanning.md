# Secrets Scanning

## Metadata
- **Category:** Security Testing
- **Scope:** Detection and prevention of secrets in source code and version control
- **Audience:** Software engineers, security engineers, DevSecOps practitioners
- **Prerequisites:** Git fundamentals, CI/CD basics
- **Last Updated:** 2025-01

---

## 1. Overview

Secrets scanning detects credentials, API keys, tokens, and other sensitive data
that has been accidentally committed to source code repositories. Leaked secrets
are one of the most common and dangerous security incidents, enabling attackers
to access cloud services, databases, internal systems, and customer data.

### 1.1 Types of Secrets

```
Secret Type          | Example Pattern                    | Risk Level
---------------------|------------------------------------|----------
AWS Access Key       | AKIA[0-9A-Z]{16}                   | Critical
AWS Secret Key       | [A-Za-z0-9/+=]{40}                 | Critical
GCP Service Account  | {"type": "service_account",...}     | Critical
Azure Client Secret  | [a-zA-Z0-9~._-]{34}               | Critical
GitHub PAT           | ghp_[a-zA-Z0-9]{36}               | Critical
GitLab PAT           | glpat-[a-zA-Z0-9\-_]{20,}         | Critical
Stripe API Key       | sk_live_[a-zA-Z0-9]{24,}          | Critical
OpenAI API Key       | sk-[a-zA-Z0-9]{32,}               | High
JWT Secret           | Hardcoded in code                  | High
Database Password    | password = "..."                   | Critical
SSH Private Key      | -----BEGIN OPENSSH PRIVATE KEY---- | Critical
TLS Private Key      | -----BEGIN RSA PRIVATE KEY----     | Critical
Connection String    | postgresql://user:pass@host/db     | Critical
Webhook URL          | https://hooks.slack.com/services/  | Medium
OAuth Client Secret  | Various patterns                   | High
Encryption Key       | Hardcoded symmetric key            | Critical
.env file contents   | KEY=value                          | Variable
```

### 1.2 How Secrets End Up in Code

```
Common vectors:
1. Developer hardcodes secret during local testing, forgets to remove
2. Configuration file with real credentials committed accidentally
3. .env file not in .gitignore
4. Secrets in environment variable defaults in code
5. Copy-paste from documentation or Slack into code
6. Test fixtures using real credentials
7. Log output containing secrets committed to repo
8. CI/CD configuration files with inline secrets
9. Docker Compose files with hardcoded passwords
10. Jupyter notebooks with API keys in cells
```

### 1.3 Detection Methods

```
Method             | How It Works                  | Strengths          | Weaknesses
-------------------|-------------------------------|--------------------|-----------
Pattern-based      | Regex matching against known  | Fast, precise for  | Misses unknown
(regex)            | secret formats                | known patterns     | patterns
                   |                               |                    |
Entropy-based      | Detects high-entropy strings  | Catches unknown    | Higher false
                   | (random-looking data)         | secret formats     | positive rate
                   |                               |                    |
Verified           | Tests if detected secret is   | Zero false         | Requires network
                   | actually valid (API call)     | positives          | access, slow
                   |                               |                    |
ML-based           | Machine learning models       | Catches patterns   | Requires training
                   | trained on secret patterns    | humans miss        | data, opaque
```

---

## 2. Pre-Commit Scanning

Pre-commit scanning catches secrets before they enter version control. Once a
secret is committed, it exists in git history forever (even after deletion from
the working tree) unless the history is rewritten.

### 2.1 git-secrets (AWS)

git-secrets, developed by AWS, scans commits for AWS credential patterns and
custom patterns.

```bash
# Install git-secrets
# macOS
brew install git-secrets

# Linux
git clone https://github.com/awslabs/git-secrets.git
cd git-secrets && make install

# Initialize in a repository
cd /path/to/repo
git secrets --install

# Register AWS patterns
git secrets --register-aws

# Add custom patterns
git secrets --add 'PRIVATE_KEY'
git secrets --add --literal 'password123'
git secrets --add 'sk_live_[a-zA-Z0-9]{24,}'   # Stripe
git secrets --add 'ghp_[a-zA-Z0-9]{36}'         # GitHub PAT
git secrets --add 'xoxb-[0-9]+-[a-zA-Z0-9]+'    # Slack Bot Token

# Add allowed patterns (false positive exclusions)
git secrets --add --allowed 'AKIAEXAMPLE'
git secrets --add --allowed 'test_secret_key'

# Scan the repository
git secrets --scan

# Scan specific files
git secrets --scan path/to/file.py

# Scan entire history
git secrets --scan-history

# Install globally for all new repositories
git secrets --install ~/.git-templates/git-secrets
git config --global init.templateDir ~/.git-templates/git-secrets
```

### 2.2 detect-secrets (Yelp)

detect-secrets uses a plugin-based architecture with both pattern and entropy
detection. It maintains a baseline file to track known/accepted secrets.

```bash
# Install detect-secrets
pip install detect-secrets

# Create initial baseline
detect-secrets scan > .secrets.baseline

# Create baseline excluding certain files
detect-secrets scan \
  --exclude-files '\.test\.' \
  --exclude-files 'package-lock\.json' \
  --exclude-files '\.secrets\.baseline' \
  > .secrets.baseline

# Audit the baseline (interactive triage)
detect-secrets audit .secrets.baseline

# Scan for new secrets against baseline
detect-secrets scan --baseline .secrets.baseline

# Scan specific files
detect-secrets scan --baseline .secrets.baseline path/to/file.py

# List detected plugins
detect-secrets scan --list-all-plugins
```

**detect-secrets configuration:**

```yaml
# .detect-secrets.yaml (or in pyproject.toml)
# Configure plugins and filters
plugins_used:
  - name: ArtifactoryDetector
  - name: AWSKeyDetector
  - name: AzureStorageKeyDetector
  - name: BasicAuthDetector
  - name: CloudantDetector
  - name: DiscordBotTokenDetector
  - name: GitHubTokenDetector
  - name: HexHighEntropyString
    hex_limit: 3
  - name: IbmCloudIamDetector
  - name: IbmCosHmacDetector
  - name: JwtTokenDetector
  - name: KeywordDetector
    keyword_exclude: ''
  - name: MailchimpDetector
  - name: NpmDetector
  - name: PrivateKeyDetector
  - name: SendGridDetector
  - name: SlackDetector
  - name: SoftlayerDetector
  - name: SquareOAuthDetector
  - name: StripeDetector
  - name: TwilioKeyDetector
  - name: Base64HighEntropyString
    base64_limit: 4.5

filters_used:
  - name: detect_secrets.filters.allowlist.is_line_allowlisted
  - name: detect_secrets.filters.common.is_baseline_file
    filename: .secrets.baseline
  - name: detect_secrets.filters.heuristic.is_likely_id_string
  - name: detect_secrets.filters.heuristic.is_lock_file
  - name: detect_secrets.filters.heuristic.is_not_alphanumeric_string
  - name: detect_secrets.filters.heuristic.is_potential_uuid
  - name: detect_secrets.filters.heuristic.is_templated_secret
  - name: detect_secrets.filters.regex.should_exclude_file
    pattern:
      - \.test\.
      - test_.*\.py
      - .*_test\.go
      - package-lock\.json
      - yarn\.lock
      - go\.sum
```

### 2.3 Pre-Commit Hook Configuration

```yaml
# .pre-commit-config.yaml
repos:
  # Option 1: detect-secrets
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
        exclude: |
          (?x)^(
            .*\.lock$|
            .*-lock\.json$|
            \.secrets\.baseline$
          )$

  # Option 2: gitleaks
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.1
    hooks:
      - id: gitleaks

  # Option 3: trufflehog (pre-commit)
  - repo: https://github.com/trufflesecurity/trufflehog
    rev: v3.63.0
    hooks:
      - id: trufflehog
        entry: trufflehog git file://. --since-commit HEAD --only-verified --fail
```

```bash
# Install pre-commit framework
pip install pre-commit

# Install hooks
pre-commit install

# Run against all files (first time or verification)
pre-commit run --all-files

# Run specific hook
pre-commit run detect-secrets --all-files
```

---

## 3. CI/CD Scanning

### 3.1 TruffleHog

TruffleHog scans for secrets using regex, entropy analysis, and verification
(checking if detected secrets are actually valid).

```bash
# Install TruffleHog
# macOS
brew install trufflehog

# Docker
docker pull trufflesecurity/trufflehog:latest

# Go install
go install github.com/trufflesecurity/trufflehog/v3@latest
```

```bash
# Scan a Git repository
trufflehog git https://github.com/example/repo.git

# Scan local directory
trufflehog filesystem /path/to/code

# Scan only since a specific commit
trufflehog git file://. --since-commit abc123

# Scan with verification (test if secrets are valid)
trufflehog git file://. --only-verified

# Scan Git history
trufflehog git file://. --no-update

# Scan specific branch
trufflehog git file://. --branch main

# Output in JSON format
trufflehog git file://. --json --output trufflehog-results.json

# Scan a GitHub organization
trufflehog github --org=example-org --token=$GITHUB_TOKEN

# Scan a Docker image
trufflehog docker --image=my-app:latest
```

**TruffleHog CI integration:**

```yaml
# .github/workflows/trufflehog.yml
name: TruffleHog Secrets Scan
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  trufflehog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for scanning

      - name: TruffleHog Scan
        uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified
```

### 3.2 Gitleaks

Gitleaks is a fast, regex-based secret scanner with a configurable rule engine.

```bash
# Install Gitleaks
# macOS
brew install gitleaks

# Docker
docker pull ghcr.io/gitleaks/gitleaks:latest

# Go install
go install github.com/gitleaks/gitleaks/v8@latest
```

```bash
# Scan current directory
gitleaks detect --source . -v

# Scan Git history
gitleaks detect --source . --log-opts="--all"

# Scan only staged changes (pre-commit)
gitleaks protect --staged

# Scan specific commits range
gitleaks detect --source . --log-opts="HEAD~10..HEAD"

# Output in JSON format
gitleaks detect --source . -f json -r gitleaks-report.json

# Output in SARIF format
gitleaks detect --source . -f sarif -r gitleaks-report.sarif

# Scan with specific config
gitleaks detect --source . -c .gitleaks.toml

# Scan ignoring specific paths
gitleaks detect --source . --no-git
```

**Gitleaks configuration:**

```toml
# .gitleaks.toml
title = "Gitleaks Configuration"

# Custom rules
[[rules]]
id = "internal-api-key"
description = "Internal API Key"
regex = '''INTERNAL_API_KEY_[a-zA-Z0-9]{32}'''
tags = ["internal", "api"]
entropy = 3.5

[[rules]]
id = "database-connection-string"
description = "Database Connection String"
regex = '''(?i)(postgres|mysql|mongodb|redis):\/\/[^\s]+:[^\s]+@[^\s]+'''
tags = ["database"]

[[rules]]
id = "generic-password-assignment"
description = "Generic Password Assignment"
regex = '''(?i)(password|passwd|pwd|secret)\s*[:=]\s*['""][^'""]{8,}['""]'''
tags = ["password"]

# Allowlist - global false positive exclusions
[allowlist]
description = "Global allowlist"
paths = [
    '''gitleaks\.toml''',
    '''(.*?)(test|spec|mock)(.*?)''',
    '''package-lock\.json''',
    '''yarn\.lock''',
    '''go\.sum''',
    '''\.secrets\.baseline''',
]
regexes = [
    '''EXAMPLE_[A-Z_]+''',
    '''test_[a-z_]+_key''',
    '''AKIAEXAMPLE[A-Z0-9]{12}''',
    '''password\s*[:=]\s*["'](\$\{|<|placeholder|changeme|xxx|test|example)''',
]

# Per-rule allowlists
[[rules]]
id = "aws-access-key"
description = "AWS Access Key"
regex = '''AKIA[0-9A-Z]{16}'''
tags = ["aws"]
[rules.allowlist]
regexes = ['''AKIAEXAMPLE[A-Z0-9]{4}''']
commits = ["abc123def456"]  # Specific commit SHA to ignore
paths = ["docs/examples/"]
```

**Gitleaks CI integration:**

```yaml
# .github/workflows/gitleaks.yml
name: Gitleaks
on:
  push:
    branches: [main]
  pull_request:

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Gitleaks scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results.sarif
        if: always()
```

### 3.3 GitHub Secret Scanning

GitHub provides built-in secret scanning for repositories.

**Enabling GitHub Secret Scanning:**

```
GitHub Settings -> Code security and analysis:
  - Secret scanning: Enable
  - Push protection: Enable
  - Secret scanning alerts: Enable

Supported secret types (150+ partner patterns):
  - Cloud providers: AWS, Azure, GCP
  - CI/CD: GitHub, GitLab, CircleCI
  - Payment: Stripe, PayPal, Square
  - Communication: Slack, Twilio, SendGrid
  - Databases: MongoDB, Redis
  - AI/ML: OpenAI, Anthropic, HuggingFace
  - And many more...
```

**GitHub Secret Scanning with push protection:**

```
When push protection is enabled:
1. Developer pushes code containing a detected secret
2. GitHub blocks the push with an error message:
   "Push blocked: secret detected in commit abc123"
3. Developer must either:
   a. Remove the secret and re-push (recommended)
   b. Mark as false positive (with justification)
   c. Mark as used in tests (with justification)
   d. Mark as will fix later (creates alert, allows push)
4. All bypass decisions are logged for security review
```

**GitHub Secret Scanning API:**

```bash
# List secret scanning alerts
gh api repos/{owner}/{repo}/secret-scanning/alerts --jq '.[] | {number, state, secret_type}'

# Get specific alert details
gh api repos/{owner}/{repo}/secret-scanning/alerts/1

# Update alert state (resolve)
gh api repos/{owner}/{repo}/secret-scanning/alerts/1 \
  -X PATCH \
  -f state=resolved \
  -f resolution=revoked
```

### 3.4 GitLab Secret Detection

```yaml
# .gitlab-ci.yml
include:
  - template: Security/Secret-Detection.gitlab-ci.yml

secret_detection:
  stage: test
  variables:
    SECRET_DETECTION_HISTORIC_SCAN: "true"
    SECRET_DETECTION_EXCLUDED_PATHS: "tests/,docs/examples/"
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

---

## 4. Custom Pattern Creation

### 4.1 Writing Custom Regex Rules

Organizations often have internal secret formats that generic tools do not detect.

```toml
# .gitleaks.toml - Custom rules for internal secrets

[[rules]]
id = "internal-service-token"
description = "Internal Service Authentication Token"
regex = '''svc_[a-zA-Z0-9]{32}_[a-zA-Z0-9]{8}'''
tags = ["internal", "service-token"]

[[rules]]
id = "internal-db-password"
description = "Internal Database Password Pattern"
regex = '''(?i)DB_(PASSWORD|PASS|SECRET)\s*=\s*['""][^'""]{8,}['""]'''
tags = ["internal", "database"]
entropy = 3.0

[[rules]]
id = "internal-api-endpoint-with-key"
description = "Internal API endpoint with embedded key"
regex = '''https://api\.internal\.example\.com/v[0-9]+\?key=[a-zA-Z0-9]{20,}'''
tags = ["internal", "api"]

[[rules]]
id = "jwt-token-in-code"
description = "JWT Token hardcoded in source code"
regex = '''eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+'''
tags = ["jwt"]

[[rules]]
id = "base64-private-key"
description = "Base64 encoded private key"
regex = '''LS0tLS1CRUdJTi[A-Za-z0-9+/=]+'''
tags = ["private-key"]

[[rules]]
id = "webhook-url"
description = "Webhook URL with token"
regex = '''https://hooks\.(slack\.com|discord\.com)/[a-zA-Z0-9/_-]+'''
tags = ["webhook"]
```

### 4.2 Semgrep Secret Detection Rules

```yaml
# .semgrep/secrets.yaml
rules:
  - id: hardcoded-password-in-config
    patterns:
      - pattern: |
          $DICT["password"] = "..."
      - pattern-not: |
          $DICT["password"] = ""
      - pattern-not: |
          $DICT["password"] = "changeme"
      - pattern-not: |
          $DICT["password"] = os.environ[...]
    message: >
      Hardcoded password detected. Use environment variables or a
      secrets manager instead.
    languages: [python]
    severity: ERROR
    metadata:
      cwe: "CWE-798"

  - id: hardcoded-api-key-in-code
    pattern-either:
      - pattern: |
          api_key = "..."
      - pattern: |
          API_KEY = "..."
      - pattern: |
          apiKey = "..."
      - pattern: |
          apikey = "..."
    message: >
      API key appears to be hardcoded. Use environment variables or a
      secrets manager.
    languages: [python, javascript, typescript, java, go]
    severity: ERROR

  - id: connection-string-with-password
    pattern-regex: |
      (?i)(postgres|mysql|mongodb|redis|amqp)://[^:]+:[^@]+@[^\s]+
    message: >
      Database connection string with embedded password detected. Use
      environment variables for credentials.
    languages: [generic]
    severity: ERROR
```

---

## 5. Entropy-Based vs Pattern-Based Detection

### 5.1 Comparison

```
Pattern-Based:
  Method: Match against known regex patterns
  Pros:
    - Low false positive rate for known formats
    - Fast execution
    - Easy to understand and debug
  Cons:
    - Misses unknown or custom secret formats
    - Requires constant rule updates
    - Cannot detect generic high-entropy secrets
  Example: AKIA[0-9A-Z]{16} matches AWS Access Keys exactly

Entropy-Based:
  Method: Calculate Shannon entropy of strings; flag high-entropy strings
  Pros:
    - Catches secrets with no known pattern
    - Works for custom/internal secret formats
    - No pattern maintenance required
  Cons:
    - Higher false positive rate (UUIDs, hashes, encoded data)
    - Cannot distinguish secrets from random-looking non-secrets
    - Requires tuning entropy thresholds
  Example: "aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2u" has high entropy

Best Practice: Combine both approaches
  1. Pattern-based rules for known secret formats (low false positives)
  2. Entropy-based detection for unknown formats (broader coverage)
  3. Verification for detected secrets (eliminate false positives)
```

### 5.2 Entropy Threshold Tuning

```python
import math
from collections import Counter

def shannon_entropy(data: str) -> float:
    """Calculate Shannon entropy of a string."""
    if not data:
        return 0.0
    counter = Counter(data)
    length = len(data)
    entropy = -sum(
        (count / length) * math.log2(count / length)
        for count in counter.values()
    )
    return entropy

# Examples:
# "password"            -> ~2.75 (low entropy, dictionary word)
# "aaaaaaaaa"           -> 0.0 (no entropy, repeated character)
# "P@ssw0rd!2024"       -> ~3.6 (moderate entropy, predictable)
# "aB3cD4eF5gH6iJ7kL8" -> ~4.2 (high entropy, likely a secret)
# "sk_live_abc123def456"-> ~3.8 (high entropy, known pattern)

# Recommended thresholds:
# Base64 strings: entropy > 4.5 (detect-secrets default)
# Hex strings: entropy > 3.0 (detect-secrets default)
# General strings: entropy > 4.0 (custom threshold)
```

---

## 6. Historical Scan (Git History)

### 6.1 Scanning Full Git History

Secrets removed from the working tree still exist in git history. A historical
scan finds all secrets ever committed.

```bash
# TruffleHog full history scan
trufflehog git file://. --no-update --json > trufflehog-history.json

# Gitleaks full history scan
gitleaks detect --source . --log-opts="--all" -f json -r gitleaks-history.json

# git-secrets history scan
git secrets --scan-history

# Count secrets found in history
cat gitleaks-history.json | jq length
```

### 6.2 Cleaning Secrets from History

After finding secrets in history, you must rotate the secret AND optionally
clean the history.

```bash
# Option 1: BFG Repo Cleaner (faster, simpler)
# Remove files containing secrets
java -jar bfg.jar --delete-files secrets.env my-repo.git

# Replace specific strings in all history
java -jar bfg.jar --replace-text replacements.txt my-repo.git

# replacements.txt format:
# AKIAIOSFODNN7EXAMPLE==>REMOVED
# sk_live_abc123==>REMOVED

# After BFG, clean up
cd my-repo.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Option 2: git filter-repo (more flexible)
pip install git-filter-repo

# Remove a file from all history
git filter-repo --path secrets.env --invert-paths

# Replace strings in all history
git filter-repo --replace-text expressions.txt

# expressions.txt format:
# regex:AKIA[0-9A-Z]{16}==>REDACTED_AWS_KEY
# literal:sk_live_abc123def456==>REDACTED_STRIPE_KEY
```

**WARNING:** Rewriting git history requires force-pushing to the remote. All
team members must re-clone or rebase. This is disruptive and should be
coordinated carefully.

---

## 7. Secret Rotation After Leak

### 7.1 Incident Response Workflow

```
SECRET LEAK INCIDENT RESPONSE
===============================

1. DETECTION (immediate)
   - Secret detected by scanner or reported by team member
   - Record: What secret, where committed, when, by whom

2. CONTAINMENT (within 15 minutes)
   - Rotate/revoke the leaked secret IMMEDIATELY
   - Do not wait to assess scope first - rotate first
   - Generate new secret and update all consumers

3. SCOPE ASSESSMENT (within 1 hour)
   - Was the repository public or private?
   - When was the secret committed? When was it pushed?
   - Was the secret ever used in production?
   - What resources does the secret grant access to?
   - Check access logs for unauthorized usage

4. INVESTIGATION (within 24 hours)
   - Review access logs for the compromised credential
   - Check for unauthorized data access or modifications
   - Determine if the secret was scraped by bots
   - Check dark web for the leaked credential

5. REMEDIATION (within 48 hours)
   - Clean secret from git history (if needed)
   - Update .gitignore and pre-commit hooks
   - Update documentation and developer guidelines
   - Retrain the developer who committed the secret

6. POST-INCIDENT (within 1 week)
   - Write incident report
   - Update secret scanning rules if pattern was missed
   - Review and improve secret management practices
   - Share lessons learned with the team
```

### 7.2 Rotation Procedures by Secret Type

```bash
# AWS Access Key
# 1. Create new access key in IAM
aws iam create-access-key --user-name my-service-user
# 2. Update all consumers with new key
# 3. Deactivate old key
aws iam update-access-key --access-key-id AKIAOLDKEY --status Inactive
# 4. After verifying everything works, delete old key
aws iam delete-access-key --access-key-id AKIAOLDKEY

# GitHub Personal Access Token
# 1. Generate new token at github.com/settings/tokens
# 2. Update all consumers
# 3. Delete old token from GitHub settings

# Database Password
# 1. Generate new password
# 2. Update password in database
# 3. Update password in secrets manager
# 4. Restart application instances to pick up new password

# Stripe API Key
# 1. Roll the API key in Stripe Dashboard
# 2. Stripe provides a grace period where both old and new keys work
# 3. Update all consumers with new key
# 4. Old key automatically expires after grace period

# JWT Signing Key
# 1. Generate new signing key
# 2. Deploy new key alongside old key (accept both during transition)
# 3. After token TTL has passed, remove old key
# 4. All new tokens are signed with new key
```

---

## 8. False Positive Management

### 8.1 Allowlists

```toml
# .gitleaks.toml - Allowlist configuration
[allowlist]
description = "Known false positives"

# Paths to exclude
paths = [
    '''testdata/''',
    '''fixtures/''',
    '''\.test\.(js|ts|py|go)$''',
    '''test_.*\.py$''',
    '''.*_test\.go$''',
    '''mocks/''',
    '''__snapshots__/''',
    '''vendor/''',
    '''node_modules/''',
]

# Regex patterns to exclude
regexes = [
    '''example[_-]?(key|token|secret|password)''',
    '''REPLACE[_-]?ME''',
    '''changeme|placeholder|dummy|fake|test''',
    '''0{16,}''',  # All zeros
    '''x{16,}''',  # All x's
]

# Specific commits to exclude
commits = [
    "abc123def456",  # Migration commit with test data
]
```

### 8.2 detect-secrets Baseline Management

```bash
# Create baseline
detect-secrets scan > .secrets.baseline

# Audit baseline interactively
detect-secrets audit .secrets.baseline
# For each finding, mark as:
#   y = true positive (real secret)
#   n = false positive (not a secret)
#   s = skip (decide later)

# Update baseline after code changes
detect-secrets scan --baseline .secrets.baseline

# CI check against baseline
detect-secrets scan --baseline .secrets.baseline
if [ $? -ne 0 ]; then
  echo "New secrets detected! Run 'detect-secrets audit' to triage."
  exit 1
fi
```

### 8.3 Verified vs Unverified Findings

```
TruffleHog verification:
  - Verified: TruffleHog tested the secret and confirmed it is valid
    (e.g., AWS key used to call STS:GetCallerIdentity)
    --> IMMEDIATE ACTION REQUIRED: rotate the secret

  - Unverified: Pattern matched but could not confirm validity
    (e.g., regex matched but API call failed or not attempted)
    --> MANUAL REVIEW: may be false positive or expired secret

Best practice: Use --only-verified in CI to block only confirmed leaks,
  and review unverified findings separately on a regular schedule.
```

---

## 9. GitHub Push Protection

GitHub push protection blocks pushes that contain detected secrets before they
reach the remote repository.

```
Push Protection Flow:
1. Developer runs: git push
2. GitHub scans the pushed commits for known secret patterns
3. If secret detected:
   a. Push is BLOCKED with error message
   b. Developer sees: "Push blocked: secret detected"
   c. Developer options:
      - Remove the secret and push again (recommended)
      - Bypass with justification (logged for audit)
4. If no secret detected:
   a. Push proceeds normally

Bypass reasons (all logged):
  - "It is used in tests" (test credential)
  - "It is a false positive" (not actually a secret)
  - "I will fix it later" (creates an alert, allows push)
```

**Configuring push protection for an organization:**

```
GitHub Organization Settings:
  -> Code security and analysis
  -> Secret scanning
     [x] Enable for all repositories
  -> Push protection
     [x] Enable for all repositories
  -> Custom patterns (for internal secret formats)
     + Add pattern
       Name: "Internal Service Token"
       Secret format: svc_[a-zA-Z0-9]{32}_[a-zA-Z0-9]{8}
       Before secret: (optional context before secret)
       After secret: (optional context after secret)
```

---

## 10. IDE Integration

### 10.1 VS Code

```json
// .vscode/settings.json
{
  "gitleaks.enable": true,
  "gitleaks.scanOnSave": true,
  "gitleaks.configPath": ".gitleaks.toml",
  "detect-secrets.enableLinting": true,
  "detect-secrets.baselineFile": ".secrets.baseline"
}
```

### 10.2 JetBrains IDEs

```
Settings -> Plugins -> Install:
  - "Secret Scanner" plugin
  - "GitLeaks" plugin

Settings -> Tools -> Secret Scanner:
  - Enable real-time scanning: true
  - Configuration file: .gitleaks.toml
  - Severity level: Error
```

### 10.3 Pre-Save Hooks in Editors

```json
// VS Code - Run detect-secrets on save via tasks
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Detect Secrets",
      "type": "shell",
      "command": "detect-secrets scan --baseline .secrets.baseline ${file}",
      "presentation": {
        "reveal": "silent",
        "panel": "shared"
      },
      "runOptions": {
        "runOn": "folderOpen"
      }
    }
  ]
}
```

---

## 11. Comprehensive CI Pipeline

```yaml
# .github/workflows/secrets-scanning.yml
name: Secrets Scanning
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  gitleaks:
    name: Gitleaks Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  trufflehog:
    name: TruffleHog Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run TruffleHog
        uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified

  detect-secrets:
    name: detect-secrets Baseline
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install detect-secrets
        run: pip install detect-secrets

      - name: Check for new secrets
        run: |
          detect-secrets scan --baseline .secrets.baseline
          if [ $? -ne 0 ]; then
            echo "New secrets detected!"
            echo "Run 'detect-secrets audit .secrets.baseline' to review."
            exit 1
          fi

  semgrep-secrets:
    name: Semgrep Secret Rules
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Semgrep with secret rules
        uses: returntocorp/semgrep-action@v1
        with:
          config: p/secrets
```

---

## 12. Best Practices

1. **Implement pre-commit hooks as the first line of defense.** Catching secrets
   before they enter git history is far easier than cleaning them from history
   afterward. Configure git-secrets, detect-secrets, or gitleaks as a pre-commit
   hook in every repository.

2. **Rotate leaked secrets immediately, then investigate.** Do not wait to assess
   scope before rotating. The secret may already be compromised. Rotate first,
   then investigate whether unauthorized access occurred.

3. **Use verified scanning to reduce false positives.** Tools like TruffleHog can
   test detected secrets against the actual service to confirm validity. Use
   `--only-verified` in CI to block only confirmed leaks, and review unverified
   findings separately.

4. **Enable GitHub push protection (or equivalent).** Push protection blocks secrets
   before they reach the remote repository. This catches cases where developers
   do not have pre-commit hooks installed locally.

5. **Scan git history periodically, not just current files.** Secrets removed from
   the working tree still exist in git history. Run full history scans (TruffleHog,
   Gitleaks) monthly to detect historical leaks.

6. **Create custom patterns for internal secret formats.** Generic tools only detect
   well-known patterns (AWS keys, Stripe keys). Create custom regex rules for
   organization-specific tokens, API keys, and connection strings.

7. **Maintain an allowlist for known false positives.** Test fixtures, example
   credentials, and placeholder values trigger false positives. Maintain a
   well-documented allowlist to reduce noise without suppressing real findings.

8. **Use a secrets manager instead of environment variables.** Environment variables
   are better than hardcoded secrets, but a dedicated secrets manager (AWS Secrets
   Manager, HashiCorp Vault, Azure Key Vault) provides rotation, auditing, and
   access control.

9. **Include secrets scanning in developer onboarding.** Every developer should
   understand the risk of committed secrets, how pre-commit hooks work, and what
   to do if a secret is accidentally committed.

10. **Automate secret rotation as part of incident response.** Manual rotation is
    error-prone and slow. Automate rotation procedures for common secret types
    (API keys, database passwords, certificates) so they can be executed rapidly
    during an incident.

---

## 13. Anti-Patterns

1. **Deleting the file and committing a removal.** Removing a file from the working
   tree does not remove it from git history. The secret is still accessible via
   `git log` or by checking out old commits. You must rotate the secret regardless.

2. **Relying solely on .gitignore.** `.gitignore` prevents files from being tracked
   but does not prevent developers from using `git add -f` to force-add an ignored
   file. Pre-commit hooks provide a stronger enforcement mechanism.

3. **Storing secrets in environment variables within CI config files.** Defining
   `SECRET_KEY=actual-value` in a `.github/workflows/*.yml` or `.gitlab-ci.yml`
   file commits the secret to the repository. Use CI/CD secret storage features
   (GitHub Secrets, GitLab CI Variables).

4. **Using the same secret across all environments.** Development, staging, and
   production should use different secrets. A leaked development secret should
   not grant access to production resources.

5. **Not scanning container images for secrets.** Secrets baked into Docker images
   persist in image layers even if deleted in a later layer. Scan images with
   TruffleHog or Trivy to detect embedded secrets.

6. **Suppressing all entropy-based findings.** Entropy-based detection has higher
   false positive rates, but disabling it entirely misses secrets that do not match
   known patterns. Tune thresholds instead of disabling.

7. **Treating secret scanning as someone else's problem.** Every developer is
   responsible for not committing secrets. Secret scanning tools are a safety net,
   not a substitute for secure coding practices and awareness.

8. **Not logging and auditing secret scanning bypass decisions.** When developers
   bypass push protection or suppress findings, those decisions must be logged
   and reviewed by the security team. Unaudited bypasses defeat the purpose
   of scanning.

---

## 14. Enforcement Checklist

```
SECRETS SCANNING ENFORCEMENT CHECKLIST
========================================

Pre-Commit:
[ ] Pre-commit hook framework installed (pre-commit)
[ ] Secret scanning hook configured (detect-secrets, gitleaks, or git-secrets)
[ ] Custom patterns added for organization-specific secret formats
[ ] Pre-commit hooks documented in repository README/CONTRIBUTING
[ ] Hook installation automated (Makefile, setup script, or husky)

CI/CD Scanning:
[ ] Secret scanning runs on every push and PR
[ ] Multiple tools configured (gitleaks + TruffleHog recommended)
[ ] CI blocks on verified secret detections
[ ] SARIF results uploaded to GitHub Security tab (or equivalent)
[ ] Semgrep secret rules included in SAST pipeline

Platform Features:
[ ] GitHub Secret Scanning enabled (or equivalent platform feature)
[ ] Push protection enabled for all repositories
[ ] Custom patterns configured for internal secret formats
[ ] Partner pattern alerts configured

Historical and Ongoing:
[ ] Full git history scan performed on all repositories
[ ] Historical scan scheduled monthly
[ ] Container image scanning includes secret detection
[ ] IaC files scanned for embedded secrets

False Positive Management:
[ ] Allowlist maintained with documented justifications
[ ] detect-secrets baseline file maintained and audited
[ ] Gitleaks .gitleaks.toml configuration tuned
[ ] False positive review scheduled quarterly

Incident Response:
[ ] Secret leak incident response procedure documented
[ ] Rotation procedures defined for each secret type
[ ] Automated rotation scripts available for common secrets
[ ] Incident response team trained on secret leak procedures
[ ] Post-incident review process established

IDE Integration:
[ ] IDE plugin recommended/required for secret scanning
[ ] IDE configuration documented and shared (settings.json, etc.)
[ ] Real-time scanning enabled in IDE

Governance:
[ ] Secret scanning configuration version-controlled
[ ] Scanning coverage dashboard maintained
[ ] Developer onboarding includes secrets scanning training
[ ] Secret scanning bypass decisions logged and reviewed
[ ] Quarterly review of scanning effectiveness (leaks found, MTTR)
```
