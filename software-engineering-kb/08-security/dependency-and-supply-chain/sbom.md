# Software Bill of Materials (SBOM)

## Metadata
- **Category**: Dependency and Supply Chain Security
- **Audience**: Software Engineers, DevSecOps, Security Engineers, Compliance Officers
- **Complexity**: Intermediate to Advanced
- **Prerequisites**: Dependency management, CI/CD pipelines, vulnerability scanning basics
- **Last Updated**: 2025-12

---

## Table of Contents

1. [Introduction](#introduction)
2. [What Is an SBOM and Why It Matters](#what-is-an-sbom-and-why-it-matters)
3. [SBOM Formats](#sbom-formats)
4. [SBOM Content and Minimum Elements](#sbom-content-and-minimum-elements)
5. [SBOM Generation Tools](#sbom-generation-tools)
6. [VEX: Vulnerability Exploitability eXchange](#vex-vulnerability-exploitability-exchange)
7. [VDR: Vulnerability Disclosure Report](#vdr-vulnerability-disclosure-report)
8. [Regulatory Requirements](#regulatory-requirements)
9. [SBOM in CI/CD Pipelines](#sbom-in-cicd-pipelines)
10. [SBOM Consumption and Analysis](#sbom-consumption-and-analysis)
11. [SBOM for Containers](#sbom-for-containers)
12. [SBOM Lifecycle Management](#sbom-lifecycle-management)
13. [Best Practices](#best-practices)
14. [Anti-Patterns](#anti-patterns)
15. [Enforcement Checklist](#enforcement-checklist)

---

## Introduction

A Software Bill of Materials (SBOM) is a formal, machine-readable inventory of all components, libraries, and modules that make up a piece of software. It is the software equivalent of an ingredient list for a food product or a bill of materials for a manufactured product.

SBOMs have moved from a niche practice to a regulatory requirement. The US Executive Order 14028 on Improving the Nation's Cybersecurity (May 2021) mandates SBOM generation for software sold to the federal government. The EU Cyber Resilience Act imposes similar requirements for products sold in the European market.

Beyond compliance, SBOMs provide operational security value: when a new vulnerability is disclosed (like Log4Shell), an SBOM allows organizations to determine within minutes which products and deployments are affected, rather than spending days or weeks inventorying their software.

---

## What Is an SBOM and Why It Matters

### Definition

An SBOM is a nested inventory of the components that comprise a software artifact. It describes:

- What components are present (names, versions, suppliers)
- How components relate to each other (dependency tree)
- Where components come from (package URLs, download locations)
- What licenses govern each component
- Cryptographic hashes for integrity verification

### Why SBOMs Matter

| Stakeholder | Value |
|-------------|-------|
| Security teams | Rapid vulnerability impact assessment |
| Compliance officers | License obligation tracking |
| Procurement | Vendor risk assessment |
| Incident response | Scoping supply chain attacks |
| Development teams | Understanding dependency landscape |
| Legal teams | Open-source license compliance |
| Auditors | Evidence of due diligence |

### SBOM Use Cases

1. **Vulnerability response**: When CVE-2024-3094 (xz-utils) was disclosed, organizations with SBOMs immediately identified affected products. Organizations without SBOMs spent days searching.

2. **License compliance**: SBOMs reveal all licenses in the dependency tree, including transitive dependencies with copyleft licenses that may not be obvious.

3. **Procurement risk assessment**: Before purchasing software, organizations can request an SBOM to evaluate the dependency health and vulnerability posture of the product.

4. **Regulatory compliance**: Meeting US Executive Order 14028, EU Cyber Resilience Act, and industry-specific regulations.

5. **Supply chain transparency**: Understanding the full provenance of every component in a software product.

---

## SBOM Formats

### CycloneDX (OWASP)

CycloneDX is an OWASP standard designed specifically for security use cases. It supports JSON, XML, and Protocol Buffers serialization.

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "serialNumber": "urn:uuid:3e671687-395b-41f5-a30f-a58921a69b79",
  "version": 1,
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "tools": {
      "components": [
        {
          "type": "application",
          "name": "syft",
          "version": "0.100.0",
          "publisher": "Anchore"
        }
      ]
    },
    "component": {
      "type": "application",
      "name": "my-web-app",
      "version": "2.1.0",
      "bom-ref": "my-web-app@2.1.0",
      "purl": "pkg:npm/my-web-app@2.1.0"
    }
  },
  "components": [
    {
      "type": "library",
      "name": "express",
      "version": "4.18.2",
      "bom-ref": "express@4.18.2",
      "purl": "pkg:npm/express@4.18.2",
      "hashes": [
        {
          "alg": "SHA-256",
          "content": "a1b2c3d4e5f6..."
        }
      ],
      "licenses": [
        {
          "license": {
            "id": "MIT"
          }
        }
      ],
      "supplier": {
        "name": "expressjs",
        "url": ["https://expressjs.com"]
      },
      "externalReferences": [
        {
          "type": "website",
          "url": "https://github.com/expressjs/express"
        },
        {
          "type": "vcs",
          "url": "https://github.com/expressjs/express.git"
        }
      ]
    },
    {
      "type": "library",
      "name": "lodash",
      "version": "4.17.21",
      "bom-ref": "lodash@4.17.21",
      "purl": "pkg:npm/lodash@4.17.21",
      "hashes": [
        {
          "alg": "SHA-256",
          "content": "f1e2d3c4b5a6..."
        }
      ],
      "licenses": [
        {
          "license": {
            "id": "MIT"
          }
        }
      ]
    }
  ],
  "dependencies": [
    {
      "ref": "my-web-app@2.1.0",
      "dependsOn": [
        "express@4.18.2",
        "lodash@4.17.21"
      ]
    },
    {
      "ref": "express@4.18.2",
      "dependsOn": [
        "body-parser@1.20.2",
        "cookie@0.6.0"
      ]
    }
  ]
}
```

### SPDX (Linux Foundation / ISO 5962)

SPDX (Software Package Data Exchange) is an ISO/IEC 5962:2021 standard. It supports JSON, XML, YAML, RDF, and tag-value formats.

```json
{
  "spdxVersion": "SPDX-2.3",
  "dataLicense": "CC0-1.0",
  "SPDXID": "SPDXRef-DOCUMENT",
  "name": "my-web-app-sbom",
  "documentNamespace": "https://mycompany.com/sbom/my-web-app-2.1.0",
  "creationInfo": {
    "created": "2024-01-15T10:30:00Z",
    "creators": [
      "Tool: syft-0.100.0",
      "Organization: My Company"
    ],
    "licenseListVersion": "3.22"
  },
  "packages": [
    {
      "SPDXID": "SPDXRef-Package-npm-express-4.18.2",
      "name": "express",
      "versionInfo": "4.18.2",
      "downloadLocation": "https://registry.npmjs.org/express/-/express-4.18.2.tgz",
      "filesAnalyzed": false,
      "supplier": "Organization: expressjs",
      "originator": "Organization: expressjs",
      "licenseConcluded": "MIT",
      "licenseDeclared": "MIT",
      "copyrightText": "Copyright (c) 2009-2014 TJ Holowaychuk, 2013-2014 Roman Shtylman, 2014-2015 Douglas Christopher Wilson",
      "externalRefs": [
        {
          "referenceCategory": "PACKAGE-MANAGER",
          "referenceType": "purl",
          "referenceLocator": "pkg:npm/express@4.18.2"
        },
        {
          "referenceCategory": "SECURITY",
          "referenceType": "cpe23Type",
          "referenceLocator": "cpe:2.3:a:expressjs:express:4.18.2:*:*:*:*:node.js:*:*"
        }
      ],
      "checksums": [
        {
          "algorithm": "SHA256",
          "checksumValue": "a1b2c3d4e5f6..."
        }
      ]
    }
  ],
  "relationships": [
    {
      "spdxElementId": "SPDXRef-DOCUMENT",
      "relationshipType": "DESCRIBES",
      "relatedSpdxElement": "SPDXRef-Package-npm-my-web-app-2.1.0"
    },
    {
      "spdxElementId": "SPDXRef-Package-npm-my-web-app-2.1.0",
      "relationshipType": "DEPENDS_ON",
      "relatedSpdxElement": "SPDXRef-Package-npm-express-4.18.2"
    }
  ]
}
```

### SWID Tags (ISO/IEC 19770-2)

Software Identification (SWID) tags are an ISO standard primarily used for software asset management. They are less common than CycloneDX or SPDX for SBOM use cases but are referenced in NIST guidance.

```xml
<?xml version="1.0" encoding="utf-8"?>
<SoftwareIdentity
    xmlns="http://standards.iso.org/iso/19770/-2/2015/schema.xsd"
    name="my-web-app"
    tagId="my-web-app-2.1.0"
    version="2.1.0"
    versionScheme="semver">
  <Entity
      name="My Company"
      role="softwareCreator tagCreator"/>
  <Link
      rel="component"
      href="swid:express-4.18.2"/>
  <Link
      rel="component"
      href="swid:lodash-4.17.21"/>
</SoftwareIdentity>
```

### Format Comparison

| Feature | CycloneDX | SPDX | SWID |
|---------|-----------|------|------|
| Primary use | Security | License/Compliance | Asset mgmt |
| ISO standard | No (OWASP) | Yes (ISO 5962) | Yes (ISO 19770-2) |
| VEX support | Yes (built-in) | Yes (external) | No |
| Dependency graph | Yes | Yes | Limited |
| Formats | JSON, XML, Protobuf | JSON, XML, YAML, RDF, TV | XML |
| Tooling | Strong | Strong | Limited |
| Vulnerability refs | Yes (built-in) | Yes (external refs) | No |
| Recommended for | Security-focused SBOM | Legal/compliance SBOM | Software inventory |

---

## SBOM Content and Minimum Elements

### NTIA Minimum Elements for SBOM

The National Telecommunications and Information Administration (NTIA) defined the minimum elements that an SBOM must contain:

| Element | Description | Example |
|---------|-------------|---------|
| Supplier name | Entity that creates/distributes | "expressjs" |
| Component name | Name of the component | "express" |
| Version | Version of the component | "4.18.2" |
| Unique identifier | Unique identifier (PURL, CPE) | "pkg:npm/express@4.18.2" |
| Dependency relationship | How components relate | "my-app DEPENDS_ON express" |
| Author of SBOM data | Who generated the SBOM | "Tool: syft-0.100.0" |
| Timestamp | When the SBOM was generated | "2024-01-15T10:30:00Z" |

### Beyond Minimum: Recommended Fields

| Field | Purpose |
|-------|---------|
| Hash/checksum | Integrity verification (SHA-256, SHA-512) |
| License | Compliance tracking |
| Download location | Provenance verification |
| CPE | NVD vulnerability matching |
| PURL | Universal package identification |
| External references | Source code, website, issue tracker |
| Copyright text | Legal compliance |

### Package URL (PURL) Format

PURL provides a universal scheme for identifying software packages across ecosystems.

```
scheme:type/namespace/name@version?qualifiers#subpath

# Examples:
pkg:npm/%40angular/core@16.2.0          # npm scoped package
pkg:npm/express@4.18.2                   # npm package
pkg:pypi/requests@2.31.0                 # PyPI package
pkg:golang/github.com/gin-gonic/gin@v1.9.1  # Go module
pkg:cargo/serde@1.0.193                  # Rust crate
pkg:gem/rails@7.1.2                      # Ruby gem
pkg:nuget/Newtonsoft.Json@13.0.3         # NuGet package
pkg:deb/debian/openssl@3.0.13-1          # Debian package
pkg:docker/library/node@20-alpine        # Docker image
pkg:oci/my-app@sha256:abc123...          # OCI image
```

---

## SBOM Generation Tools

### Syft (Anchore)

Syft is a CLI tool and Go library for generating SBOMs from container images and filesystems.

```bash
# Install Syft
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s

# Generate CycloneDX SBOM from directory
syft dir:. -o cyclonedx-json=sbom.cyclonedx.json

# Generate SPDX SBOM from directory
syft dir:. -o spdx-json=sbom.spdx.json

# Generate SBOM from container image
syft node:20-alpine -o cyclonedx-json=image-sbom.json

# Generate SBOM from Docker archive
syft docker-archive:image.tar -o cyclonedx-json=archive-sbom.json

# Generate SBOM from OCI image
syft registry:ghcr.io/myorg/myapp:latest -o cyclonedx-json=oci-sbom.json

# Multiple output formats simultaneously
syft dir:. \
  -o cyclonedx-json=sbom.cyclonedx.json \
  -o spdx-json=sbom.spdx.json \
  -o table

# Scan with specific catalogers
syft dir:. --catalogers=javascript,go-module -o cyclonedx-json=sbom.json

# Include file metadata
syft dir:. --file-metadata -o cyclonedx-json=sbom-with-files.json
```

### cdxgen (CycloneDX Generator)

```bash
# Install cdxgen
npm install -g @cyclonedx/cdxgen

# Generate CycloneDX SBOM
cdxgen -o sbom.json

# Generate for specific project type
cdxgen -t python -o sbom.json
cdxgen -t go -o sbom.json
cdxgen -t java -o sbom.json

# Generate with evidence (more detailed)
cdxgen --evidence -o sbom.json

# Generate for a container image
cdxgen -t docker -i node:20-alpine -o sbom.json

# Generate in XML format
cdxgen --format xml -o sbom.xml

# Include deep dependency analysis
cdxgen --deep -o sbom.json
```

### Trivy SBOM Generation

```bash
# Generate CycloneDX SBOM from filesystem
trivy fs --format cyclonedx -o sbom.cyclonedx.json .

# Generate SPDX SBOM from filesystem
trivy fs --format spdx-json -o sbom.spdx.json .

# Generate SBOM from container image
trivy image --format cyclonedx -o image-sbom.json node:20-alpine

# Generate SBOM and scan for vulnerabilities
trivy sbom sbom.cyclonedx.json
```

### npm SBOM Generation

```bash
# Generate CycloneDX SBOM (npm v10+)
npm sbom --sbom-format cyclonedx > sbom.cyclonedx.json

# Generate SPDX SBOM
npm sbom --sbom-format spdx > sbom.spdx.json

# Include only production dependencies
npm sbom --sbom-format cyclonedx --omit dev > sbom-prod.json
```

### CycloneDX for Python

```bash
# Install cyclonedx-python
pip install cyclonedx-bom

# Generate from installed packages
cyclonedx-py environment -o sbom.json --format json

# Generate from requirements.txt
cyclonedx-py requirements requirements.txt -o sbom.json --format json

# Generate from Poetry
cyclonedx-py poetry -o sbom.json --format json

# Generate from Pipenv
cyclonedx-py pipenv -o sbom.json --format json
```

### CycloneDX for Go

```bash
# Install cyclonedx-gomod
go install github.com/CycloneDX/cyclonedx-gomod/cmd/cyclonedx-gomod@latest

# Generate SBOM from go.mod
cyclonedx-gomod mod -json -output sbom.json

# Include test dependencies
cyclonedx-gomod mod -json -test -output sbom-all.json
```

---

## VEX: Vulnerability Exploitability eXchange

### What Is VEX

VEX (Vulnerability Exploitability eXchange) is a companion document to an SBOM that communicates whether a product is affected by a known vulnerability in a component it contains. VEX reduces false positives by allowing software suppliers to state that a vulnerability is not exploitable in their specific usage.

### VEX Status Values

| Status | Meaning | Example |
|--------|---------|---------|
| `not_affected` | Vulnerability exists in component but is not exploitable | "We do not use the vulnerable function" |
| `affected` | Vulnerability is exploitable and requires action | "Upgrade to version X.Y.Z" |
| `fixed` | Vulnerability has been remediated | "Fixed in version 2.1.1" |
| `under_investigation` | Status is being evaluated | "Assessing impact, update to follow" |

### VEX Justifications (for not_affected)

| Justification | Description |
|---------------|-------------|
| `component_not_present` | The component is not actually present |
| `vulnerable_code_not_present` | The specific vulnerable code is not included |
| `vulnerable_code_not_in_execute_path` | The vulnerable code is present but never executed |
| `vulnerable_code_cannot_be_controlled_by_adversary` | An attacker cannot reach the vulnerable code |
| `inline_mitigations_already_exist` | Mitigating controls exist in the product |

### CycloneDX VEX Example

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "serialNumber": "urn:uuid:vex-001",
  "version": 1,
  "vulnerabilities": [
    {
      "id": "CVE-2023-44487",
      "source": {
        "name": "NVD",
        "url": "https://nvd.nist.gov/vuln/detail/CVE-2023-44487"
      },
      "ratings": [
        {
          "source": { "name": "NVD" },
          "score": 7.5,
          "severity": "high",
          "method": "CVSSv31",
          "vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
        }
      ],
      "description": "HTTP/2 Rapid Reset Attack",
      "analysis": {
        "state": "not_affected",
        "justification": "vulnerable_code_not_in_execute_path",
        "detail": "Our application does not expose HTTP/2 endpoints. The Go net/http server is configured with HTTP/1.1 only. The vulnerable HTTP/2 stream handling code is never invoked.",
        "response": ["will_not_fix"],
        "firstIssued": "2023-10-15T00:00:00Z",
        "lastUpdated": "2023-10-15T00:00:00Z"
      },
      "affects": [
        {
          "ref": "golang.org/x/net@0.17.0"
        }
      ]
    },
    {
      "id": "CVE-2024-3094",
      "source": {
        "name": "NVD",
        "url": "https://nvd.nist.gov/vuln/detail/CVE-2024-3094"
      },
      "ratings": [
        {
          "score": 10.0,
          "severity": "critical",
          "method": "CVSSv31"
        }
      ],
      "description": "xz-utils backdoor",
      "analysis": {
        "state": "not_affected",
        "justification": "component_not_present",
        "detail": "Our container images use Alpine Linux which uses musl libc and does not include xz-utils 5.6.0 or 5.6.1. The vulnerable versions are not present in any deployed artifact."
      },
      "affects": [
        {
          "ref": "xz-utils@5.6.0"
        }
      ]
    },
    {
      "id": "CVE-2023-50164",
      "source": {
        "name": "NVD"
      },
      "description": "Apache Struts file upload vulnerability",
      "analysis": {
        "state": "affected",
        "detail": "The application uses the affected file upload functionality. Upgrade to Apache Struts 6.3.0.2 or 2.5.33.",
        "response": ["update"]
      }
    }
  ]
}
```

### OpenVEX Format

```json
{
  "@context": "https://openvex.dev/ns/v0.2.0",
  "@id": "https://mycompany.com/vex/2024-001",
  "author": "security-team@mycompany.com",
  "role": "Document Creator",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": 1,
  "tooling": "vexctl/0.2.0",
  "statements": [
    {
      "vulnerability": {
        "@id": "https://nvd.nist.gov/vuln/detail/CVE-2023-44487",
        "name": "CVE-2023-44487",
        "description": "HTTP/2 Rapid Reset Attack"
      },
      "products": [
        {
          "@id": "pkg:oci/my-app@sha256:abc123..."
        }
      ],
      "status": "not_affected",
      "justification": "vulnerable_code_not_in_execute_path",
      "impact_statement": "HTTP/2 is not enabled in our deployment configuration."
    }
  ]
}
```

### VEX Tooling

```bash
# Install vexctl (OpenVEX)
go install github.com/openvex/vexctl@latest

# Create a VEX document
vexctl create \
  --product="pkg:oci/my-app@sha256:abc123..." \
  --vuln="CVE-2023-44487" \
  --status="not_affected" \
  --justification="vulnerable_code_not_in_execute_path" > vex.json

# Apply VEX to filter scan results
vexctl filter --vex=vex.json scan-results.json

# Merge multiple VEX documents
vexctl merge vex1.json vex2.json > merged-vex.json

# Use Grype with VEX filtering
grype sbom:sbom.json --vex vex.json
```

---

## VDR: Vulnerability Disclosure Report

A Vulnerability Disclosure Report (VDR) is a structured document that provides the complete vulnerability status of a software product. While a VEX document communicates exploitability for specific vulnerabilities, a VDR provides the comprehensive vulnerability posture including all known vulnerabilities, their status, and remediation information.

VDR typically includes:
- All known vulnerabilities in the product's components
- Current status of each vulnerability (affected, not affected, fixed, investigating)
- Remediation actions taken or planned
- Timeline of vulnerability discovery and response
- Risk assessment and residual risk

CycloneDX supports VDR natively through its vulnerability data model, combining SBOM component data with vulnerability analysis.

---

## Regulatory Requirements

### US Executive Order 14028 (May 2021)

Executive Order 14028 "Improving the Nation's Cybersecurity" requires:

- Software vendors selling to the federal government must provide SBOMs
- SBOMs must be machine-readable (CycloneDX or SPDX)
- SBOMs must include NTIA minimum elements
- Continuous monitoring and updating of SBOMs
- Attestation of secure software development practices

### NIST Guidelines

NIST SP 800-218 (Secure Software Development Framework) and related guidance specify:

- SBOM generation as part of the software development lifecycle
- SBOM should cover both direct and transitive dependencies
- SBOMs should be regenerated with each release
- VEX should accompany SBOMs to communicate vulnerability status

### EU Cyber Resilience Act

The EU CRA (effective 2024) requires:

- Mandatory SBOM for products with digital elements sold in the EU
- Vulnerability handling and disclosure requirements
- Security update obligations for the product lifetime
- Conformity assessment for critical products

### Industry-Specific Requirements

| Industry | Regulation/Standard | SBOM Requirement |
|----------|-------------------|------------------|
| Healthcare | FDA cybersecurity guidance | Required for medical devices |
| Automotive | UNECE WP.29 / ISO 21434 | Required for vehicle software |
| Financial | Various (PCI DSS 4.0) | Recommended/Emerging |
| Defense | DoD DevSecOps Reference | Required |
| Telecom | EU NIS2 Directive | Required for critical infrastructure |

---

## SBOM in CI/CD Pipelines

### Automated SBOM Generation Pipeline

```yaml
# GitHub Actions: SBOM generation and attestation
name: SBOM Pipeline
on:
  push:
    branches: [main]
    tags: ['v*']

permissions:
  contents: read
  packages: write
  id-token: write  # For keyless signing

jobs:
  sbom:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      # Generate SBOM with Syft
      - name: Generate CycloneDX SBOM
        uses: anchore/sbom-action@v0
        with:
          format: cyclonedx-json
          output-file: sbom.cyclonedx.json
          artifact-name: sbom-cyclonedx

      # Generate SPDX SBOM
      - name: Generate SPDX SBOM
        uses: anchore/sbom-action@v0
        with:
          format: spdx-json
          output-file: sbom.spdx.json
          artifact-name: sbom-spdx

      # Scan SBOM for vulnerabilities
      - name: Scan SBOM with Grype
        uses: anchore/scan-action@v4
        with:
          sbom: sbom.cyclonedx.json
          fail-build: true
          severity-cutoff: high

      # Upload SBOMs as release assets
      - name: Upload SBOMs
        if: startsWith(github.ref, 'refs/tags/')
        uses: actions/upload-artifact@v4
        with:
          name: sbom-artifacts
          path: |
            sbom.cyclonedx.json
            sbom.spdx.json

      # Attest SBOM with GitHub Attestations
      - name: Attest SBOM
        if: startsWith(github.ref, 'refs/tags/')
        uses: actions/attest-sbom@v1
        with:
          subject-path: dist/
          sbom-path: sbom.cyclonedx.json
```

### Container SBOM in Build Pipeline

```yaml
# GitHub Actions: Container build with SBOM
name: Container Build
on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  container:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push image
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          sbom: true  # Generate SBOM attestation
          provenance: true  # Generate provenance attestation

      # Generate standalone SBOM from image
      - name: Generate image SBOM
        run: |
          syft ghcr.io/${{ github.repository }}:${{ github.sha }} \
            -o cyclonedx-json=image-sbom.json

      # Sign image with Cosign
      - name: Sign image
        uses: sigstore/cosign-installer@v3
      - run: |
          cosign sign --yes ghcr.io/${{ github.repository }}:${{ github.sha }}

      # Attach SBOM to image
      - run: |
          cosign attach sbom \
            --sbom image-sbom.json \
            ghcr.io/${{ github.repository }}:${{ github.sha }}
```

---

## SBOM Consumption and Analysis

### Dependency-Track (OWASP)

Dependency-Track is an open-source platform for SBOM consumption, vulnerability monitoring, and policy management.

```bash
# Deploy Dependency-Track with Docker Compose
# docker-compose.yml
cat <<'EOF'
version: '3.8'
services:
  dtrack-apiserver:
    image: dependencytrack/apiserver:latest
    ports:
      - "8081:8080"
    volumes:
      - dtrack-data:/data
    environment:
      ALPINE_DATABASE_MODE: external
      ALPINE_DATABASE_URL: jdbc:postgresql://postgres:5432/dtrack
      ALPINE_DATABASE_DRIVER: org.postgresql.Driver
      ALPINE_DATABASE_USERNAME: dtrack
      ALPINE_DATABASE_PASSWORD: ${DTRACK_DB_PASSWORD}

  dtrack-frontend:
    image: dependencytrack/frontend:latest
    ports:
      - "8080:8080"
    environment:
      API_BASE_URL: http://localhost:8081

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: dtrack
      POSTGRES_USER: dtrack
      POSTGRES_PASSWORD: ${DTRACK_DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  dtrack-data:
  postgres-data:
EOF
```

```bash
# Upload SBOM to Dependency-Track via API
curl -X POST \
  "http://localhost:8081/api/v1/bom" \
  -H "X-Api-Key: ${DTRACK_API_KEY}" \
  -H "Content-Type: multipart/form-data" \
  -F "project=my-web-app" \
  -F "projectVersion=2.1.0" \
  -F "autoCreate=true" \
  -F "bom=@sbom.cyclonedx.json"

# Check project vulnerabilities
curl -s \
  "http://localhost:8081/api/v1/vulnerability/project/${PROJECT_UUID}" \
  -H "X-Api-Key: ${DTRACK_API_KEY}" | jq '.[] | {vulnId, severity, source}'
```

### Grype SBOM Analysis

```bash
# Scan SBOM for vulnerabilities
grype sbom:sbom.cyclonedx.json

# Scan with severity filter
grype sbom:sbom.cyclonedx.json --fail-on high

# Scan with VEX filtering
grype sbom:sbom.cyclonedx.json --vex vex.json

# Output as JSON
grype sbom:sbom.cyclonedx.json -o json > vulnerabilities.json
```

### SBOM Diff (Detecting Changes)

```bash
# Compare SBOMs between versions using cyclonedx-cli
cyclonedx diff sbom-v1.json sbom-v2.json

# Using jq to compare component lists
diff <(jq -r '.components[].purl' sbom-v1.json | sort) \
     <(jq -r '.components[].purl' sbom-v2.json | sort)

# Identify new, removed, and changed components
comm -23 \
  <(jq -r '.components[].purl' sbom-v2.json | sort) \
  <(jq -r '.components[].purl' sbom-v1.json | sort) \
  > new-components.txt

comm -23 \
  <(jq -r '.components[].purl' sbom-v1.json | sort) \
  <(jq -r '.components[].purl' sbom-v2.json | sort) \
  > removed-components.txt
```

---

## SBOM for Containers

Container SBOMs must capture both the application dependencies and the OS-level packages in the base image.

### Multi-layer Container SBOM

```bash
# Generate SBOM for the full container image (all layers)
syft node:20-alpine -o cyclonedx-json=base-image-sbom.json

# Generate SBOM for application layer only
syft dir:./dist -o cyclonedx-json=app-sbom.json

# Generate SBOM for a running container
syft docker:my-running-container -o cyclonedx-json=runtime-sbom.json

# Trivy: generate SBOM with OS and application packages
trivy image --format cyclonedx -o full-sbom.json myapp:latest

# Trivy: separate OS packages
trivy image --format cyclonedx --vuln-type os -o os-sbom.json myapp:latest

# Trivy: separate application packages
trivy image --format cyclonedx --vuln-type library -o lib-sbom.json myapp:latest
```

### Docker BuildKit SBOM

```bash
# Docker BuildKit can generate SBOMs during build
docker buildx build \
  --sbom=true \
  --provenance=true \
  --tag myapp:latest \
  --push \
  .

# Inspect SBOM attestation
docker buildx imagetools inspect myapp:latest --format '{{json .SBOM}}'
```

---

## SBOM Lifecycle Management

### SBOM Generation Triggers

| Trigger | When | Purpose |
|---------|------|---------|
| Every build | CI/CD pipeline | Latest snapshot |
| Every release | Tag/version creation | Release artifact |
| Dependency change | Lock file modification | Change tracking |
| Periodic refresh | Weekly/monthly | Catch new vulns |
| On demand | Audit request | Compliance evidence |

### SBOM Storage and Distribution

| Method | Use Case | Example |
|--------|----------|---------|
| Release asset | Public software | GitHub Release attachment |
| Package registry | Library/package | npm provenance |
| OCI registry | Container images | Cosign attach sbom |
| SBOM platform | Enterprise | Dependency-Track |
| Artifact storage | Internal | S3, Artifactory |

### SBOM Freshness

SBOMs become stale as new vulnerabilities are discovered. A static SBOM tells you what components are present but does not automatically update with new vulnerability data.

To maintain SBOM freshness:

1. Regenerate SBOMs with every release
2. Continuously scan existing SBOMs against updated vulnerability databases
3. Use Dependency-Track for continuous monitoring
4. Set up alerts for new vulnerabilities affecting existing SBOMs

---

## Best Practices

1. **Generate SBOMs automatically in CI/CD for every release.** Use Syft, cdxgen, or Trivy as part of the build pipeline. Store SBOMs as release artifacts alongside the software they describe.

2. **Use CycloneDX for security-focused SBOMs and SPDX for compliance-focused SBOMs.** CycloneDX has built-in VEX and vulnerability support. SPDX is an ISO standard preferred for license compliance and regulatory submissions.

3. **Include both direct and transitive dependencies.** An SBOM that only lists direct dependencies is incomplete. Use tools that resolve the full dependency tree, including transitive dependencies.

4. **Publish VEX documents alongside SBOMs.** When a vulnerability exists in a component but is not exploitable in your product, publish a VEX statement. This reduces downstream noise and demonstrates due diligence.

5. **Feed SBOMs into Dependency-Track or equivalent for continuous monitoring.** SBOMs are most valuable when continuously scanned against updated vulnerability databases, not just at generation time.

6. **Include cryptographic hashes for all components.** SHA-256 hashes enable integrity verification and more precise vulnerability matching than name/version alone.

7. **Use Package URLs (PURLs) as component identifiers.** PURLs provide a universal, unambiguous identifier for packages across all ecosystems. They are the recommended identifier in both CycloneDX and SPDX.

8. **Sign SBOMs to ensure authenticity.** Use Cosign or GPG to sign SBOM documents. This prevents tampering and provides non-repudiation.

9. **Maintain SBOMs for container images at both OS and application layers.** Container SBOMs must include both the base image OS packages and the application-level dependencies for complete coverage.

10. **Establish SBOM requirements in procurement processes.** Require SBOMs from software vendors as part of the procurement process. Use SBOMs to assess vendor dependency health before purchase.

---

## Anti-Patterns

1. **Generating SBOMs only when auditors request them.** SBOMs should be generated continuously as part of the build pipeline, not produced ad hoc. Retroactive SBOM generation is error-prone and incomplete.

2. **Using only component names and versions without hashes.** Without cryptographic hashes, SBOMs cannot verify component integrity. Two packages with the same name and version can have different contents (especially across mirrors).

3. **Ignoring transitive dependencies in the SBOM.** An SBOM that only lists direct dependencies misses the majority of the code in the application. Transitive dependencies are where most vulnerabilities hide.

4. **Generating SBOMs but never scanning them for vulnerabilities.** An SBOM without vulnerability scanning is an inventory without security value. Always pair SBOM generation with continuous vulnerability analysis.

5. **Treating SBOM as a one-time compliance artifact.** SBOMs must be regenerated with every release and continuously monitored. A stale SBOM provides false assurance as new vulnerabilities are disclosed.

6. **Not including VEX when vulnerabilities exist but are not exploitable.** Without VEX, downstream consumers and scanners will flag every known vulnerability regardless of exploitability, causing alert fatigue and eroding trust.

7. **Storing SBOMs only in local build artifacts.** SBOMs should be stored in a centralized platform (Dependency-Track) and attached to container images and release assets for broad accessibility.

8. **Using SWID tags as the primary SBOM format.** SWID tags are designed for software asset management, not security or compliance use cases. Use CycloneDX or SPDX for security-relevant SBOMs.

---

## Enforcement Checklist

### SBOM Generation
- [ ] SBOM generation is integrated into the CI/CD pipeline
- [ ] SBOMs are generated for every release (tagged build)
- [ ] SBOMs include both direct and transitive dependencies
- [ ] SBOMs use CycloneDX or SPDX format (machine-readable)
- [ ] SBOMs include NTIA minimum elements (supplier, name, version, ID, relationships, author, timestamp)
- [ ] SBOMs include cryptographic hashes (SHA-256) for all components
- [ ] SBOMs use Package URL (PURL) as component identifiers

### SBOM Content Quality
- [ ] License information is included for all components
- [ ] Dependency relationships (dependency graph) are captured
- [ ] External references (source code, website) are included
- [ ] CPE identifiers are included for NVD matching
- [ ] SBOMs cover application dependencies AND OS packages (for containers)

### VEX and Vulnerability Management
- [ ] VEX documents are published for known-but-not-exploitable vulnerabilities
- [ ] VEX justifications include detailed rationale
- [ ] VEX documents are updated when vulnerability status changes
- [ ] SBOMs are continuously scanned against updated vulnerability databases

### Storage and Distribution
- [ ] SBOMs are stored as release artifacts (GitHub Releases, Artifactory)
- [ ] Container image SBOMs are attached via Cosign or OCI attestation
- [ ] SBOMs are uploaded to Dependency-Track or equivalent platform
- [ ] SBOMs are signed for authenticity verification
- [ ] Historical SBOMs are retained for audit trail

### Process and Compliance
- [ ] SBOM generation policy is documented
- [ ] SBOM requirements are included in procurement processes
- [ ] SBOM format and tooling are standardized across the organization
- [ ] SBOM freshness is monitored (regenerated with each release)
- [ ] Regulatory requirements (EO 14028, CRA) are met
- [ ] SBOM diff between releases is reviewed for unexpected changes
