---
mode: auto
---
## Supply Chain Security

### Lockfile Integrity
- ALWAYS commit lockfiles (package-lock.json, yarn.lock, pnpm-lock.yaml, poetry.lock, Cargo.lock)
- CI MUST install dependencies using the lockfile exclusively: `npm ci`, `yarn --frozen-lockfile`, `pip install --require-hashes`
- Review lockfile diffs in every PR — look for unexpected package additions or version changes
- NEVER delete and regenerate a lockfile without explicit justification in the PR description
- Configure CI to fail if the lockfile is out of sync with the manifest (package.json, pyproject.toml)

### Dependency Auditing in CI
- Run `npm audit`, `pip audit`, `safety check`, or equivalent in every CI pipeline
- Block merges on critical or high severity vulnerabilities — no exceptions
- Schedule weekly full-dependency audits even without code changes (cron job in CI)
- Track vulnerability resolution time: critical within 48 hours, high within 7 days
- Document accepted vulnerabilities with: justification, risk assessment, and expiry date
- Audit transitive dependencies — not just direct ones — using `npm audit --all` or equivalent

### Typosquatting Prevention
- Verify package name spelling against the official documentation before first install
- Prefer scoped packages from known publishers: `@aws-sdk/client-s3` over unscoped alternatives
- Check package publisher, download count, and repository link before installing any new dependency
- NEVER install packages from URLs, tarballs, or git refs in production manifests — use registry versions only
- Use an allowlist of approved packages for security-critical categories (crypto, auth, serialization)

### Provenance & Author Verification
- Enable npm provenance verification: `npm install --verify-provenance` where supported
- Verify that package source matches its published registry artifact (GitHub repo linked and active)
- Be suspicious of packages with: no repository link, single maintainer, recent ownership transfers, or sudden version jumps
- For critical dependencies, pin to a specific verified commit hash in lockfile review
- Subscribe to security advisories for all direct dependencies (GitHub Dependabot, Snyk)

### Build Reproducibility
- Pin ALL build tool versions: Node.js, Python, Bun, Rust, Go — use `.node-version`, `.python-version`, or `mise`
- CI and local builds MUST use identical dependency resolution — never allow floating installs
- Use content-addressable artifacts: tag with commit SHA and content hash, not just version
- Verify that building the same commit twice produces byte-identical output (or document why not)
- Pin CI runner images to digest, not tag: `node@sha256:abc123...` — never `:latest` or `:lts`

### SBOM Generation
- Generate a Software Bill of Materials (SBOM) in CycloneDX or SPDX format for every release
- Include: all direct and transitive dependencies, versions, licenses, and known vulnerabilities
- Store SBOMs as release artifacts alongside build output — attach to GitHub Releases
- Automate SBOM generation in CI — never generate manually
- Review SBOM for license compliance: flag GPL, AGPL, or unknown licenses before release

### Artifact Signing & Trusted Registries
- Sign production artifacts (container images, npm packages, binaries) with Sigstore/cosign or GPG
- Verify artifact signatures before deployment — reject unsigned artifacts in production pipelines
- Use a private registry (Artifactory, GitHub Packages, AWS CodeArtifact) as a proxy for public registries
- Configure package managers to resolve ONLY from the private registry — block direct public access in CI
- Enable Sub-Resource Integrity (SRI) hashes for all externally loaded scripts and stylesheets:
  ```html
  <script src="https://cdn.example.com/lib.js"
    integrity="sha384-..." crossorigin="anonymous"></script>
  ```
- NEVER load scripts from CDNs without SRI hashes — a compromised CDN compromises your application
