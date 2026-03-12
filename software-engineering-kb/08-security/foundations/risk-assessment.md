# Risk Assessment

> **Domain:** Security > Foundations
> **Difficulty:** Intermediate to Advanced
> **Last Updated:** 2026-03-10

## Table of Contents

- [Risk Fundamentals](#risk-fundamentals)
- [CVSS -- Common Vulnerability Scoring System](#cvss----common-vulnerability-scoring-system)
- [EPSS -- Exploit Prediction Scoring System](#epss----exploit-prediction-scoring-system)
- [SSVC -- Stakeholder-Specific Vulnerability Categorization](#ssvc----stakeholder-specific-vulnerability-categorization)
- [Risk Assessment Methodologies](#risk-assessment-methodologies)
- [Vulnerability Prioritization](#vulnerability-prioritization)
- [Risk Registers](#risk-registers)
- [Security Risk in Software Development](#security-risk-in-software-development)
- [Risk Communication](#risk-communication)
- [Continuous Risk Assessment](#continuous-risk-assessment)
- [Best Practices](#best-practices)
- [Anti-patterns](#anti-patterns)
- [Enforcement Checklist](#enforcement-checklist)
- [References](#references)

---

## Risk Fundamentals

### The Risk Equation

Apply the foundational formula consistently:

```
Risk = Likelihood x Impact
```

- **Likelihood** -- the probability that a threat exploits a vulnerability within a given timeframe.
- **Impact** -- the magnitude of harm resulting from a successful exploit.

Both factors must be assessed in context. A critical vulnerability in an air-gapped system carries different risk than the same vulnerability on an internet-facing API.

### Core Terminology

| Term | Definition |
|------|-----------|
| **Threat** | Any circumstance or event with the potential to cause harm. Includes threat actors (attackers), natural disasters, insider actions. |
| **Vulnerability** | A weakness in a system, process, or control that a threat can exploit. |
| **Asset** | Anything of value -- data, systems, infrastructure, reputation, intellectual property. |
| **Risk Appetite** | The total amount of risk an organization is willing to accept in pursuit of its objectives. Set by executive leadership. |
| **Risk Tolerance** | The acceptable variation around a specific risk. More granular than appetite -- defines the boundary for individual risks. |
| **Residual Risk** | The risk that remains after controls and mitigations are applied. Always nonzero. |
| **Inherent Risk** | The risk level before any controls are applied. |
| **Control** | A safeguard or countermeasure that reduces risk (e.g., encryption, authentication, firewall rules). |
| **Exposure** | The degree to which an asset is accessible to a threat. |

### Risk vs Compliance

Distinguish clearly between risk management and compliance:

| Aspect | Risk Management | Compliance |
|--------|----------------|------------|
| **Goal** | Reduce actual harm to acceptable levels | Meet regulatory or contractual obligations |
| **Approach** | Prioritize by impact and likelihood | Satisfy checklist requirements |
| **Outcome** | Risk-informed decisions | Pass/fail determination |
| **Scope** | Organization-specific threats | Industry-wide standards (SOC 2, PCI-DSS, HIPAA) |
| **Limitation** | Requires judgment and context | Compliant does not mean secure |

A system can be fully compliant with PCI-DSS and still be vulnerable to a zero-day. A system can be noncompliant but have excellent risk posture through compensating controls. Treat compliance as a floor, not a ceiling.

---

## CVSS -- Common Vulnerability Scoring System

CVSS provides a standardized method for rating the severity of vulnerabilities. Use it as one input to prioritization -- never as the sole factor.

### CVSS v3.1 Score Groups

| Score Range | Severity | Example |
|-------------|----------|---------|
| 0.0 | None | Informational finding |
| 0.1 - 3.9 | Low | Information disclosure with minimal impact |
| 4.0 - 6.9 | Medium | Cross-site scripting requiring user interaction |
| 7.0 - 8.9 | High | SQL injection in authenticated endpoint |
| 9.0 - 10.0 | Critical | Remote code execution, unauthenticated |

### CVSS v3.1 Base Score Metrics

The base score consists of two sub-scores:

**Exploitability Metrics:**

| Metric | Values | Description |
|--------|--------|-------------|
| **Attack Vector (AV)** | Network (N), Adjacent (A), Local (L), Physical (P) | How the attacker reaches the vulnerable component |
| **Attack Complexity (AC)** | Low (L), High (H) | Conditions beyond the attacker's control that must exist |
| **Privileges Required (PR)** | None (N), Low (L), High (H) | Level of access needed before exploitation |
| **User Interaction (UI)** | None (N), Required (R) | Whether a human other than the attacker must participate |

**Impact Metrics:**

| Metric | Values | Description |
|--------|--------|-------------|
| **Scope (S)** | Unchanged (U), Changed (C) | Whether the vulnerability impacts resources beyond its security scope |
| **Confidentiality (C)** | None (N), Low (L), High (H) | Impact to information confidentiality |
| **Integrity (I)** | None (N), Low (L), High (H) | Impact to information integrity |
| **Availability (A)** | None (N), Low (L), High (H) | Impact to system availability |

### CVSS v3.1 Temporal and Environmental Scores

**Temporal Score** -- adjusts base score based on current state:

| Metric | Values |
|--------|--------|
| **Exploit Code Maturity (E)** | Not Defined (X), Unproven (U), Proof-of-Concept (P), Functional (F), High (H) |
| **Remediation Level (RL)** | Not Defined (X), Official Fix (O), Temporary Fix (T), Workaround (W), Unavailable (U) |
| **Report Confidence (RC)** | Not Defined (X), Unknown (U), Reasonable (R), Confirmed (C) |

**Environmental Score** -- adjusts for your specific deployment:

Modify the base metrics to reflect your environment. A vulnerability with High Availability impact scores lower if the affected component has no availability requirement in your deployment.

### CVSS v4.0 Changes

CVSS v4.0 replaces Temporal and Environmental scores with a more granular supplemental metric group:

- **Exploit Maturity** replaces Exploit Code Maturity with simplified values (Attacked, POC, Unreported).
- **Attack Requirements (AT)** is a new metric capturing prerequisites (None, Present).
- **Value Density** -- whether the target contains concentrated high-value data.
- **Vulnerability Response Effort** -- effort required to respond.
- **Provider Urgency** -- the vendor/provider's urgency assessment.
- **Safety** -- physical safety implications.
- **Automatable** -- whether the exploit can be automated at scale.
- **Recovery** -- how easily the system recovers (Automatic, User, Irrecoverable).

### CVSS Calculation Example: Real CVE

**CVE-2021-44228 (Log4Shell) -- CVSS v3.1:**

```
Vector: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H
Score: 10.0 (Critical)
```

Breakdown:
- Attack Vector: Network -- exploitable remotely
- Attack Complexity: Low -- no special conditions needed
- Privileges Required: None -- unauthenticated
- User Interaction: None -- no victim action needed
- Scope: Changed -- can escape the vulnerable component
- C/I/A: All High -- complete compromise

**CVE-2023-23397 (Outlook Privilege Escalation) -- CVSS v3.1:**

```
Vector: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
Score: 9.8 (Critical)
```

Breakdown:
- Attack Vector: Network -- triggered by a specially crafted email
- Scope: Unchanged -- does not impact other components
- Otherwise identical to Log4Shell in exploitability

### CVSS Score Calculator in TypeScript

```typescript
// cvss-calculator.ts
// CVSS v3.1 Base Score Calculator

interface CvssVector {
  attackVector: "N" | "A" | "L" | "P";
  attackComplexity: "L" | "H";
  privilegesRequired: "N" | "L" | "H";
  userInteraction: "N" | "R";
  scope: "U" | "C";
  confidentiality: "N" | "L" | "H";
  integrity: "N" | "L" | "H";
  availability: "N" | "L" | "H";
}

interface CvssResult {
  score: number;
  severity: "None" | "Low" | "Medium" | "High" | "Critical";
  vector: string;
}

const AV_VALUES: Record<string, number> = {
  N: 0.85, A: 0.62, L: 0.55, P: 0.2,
};

const AC_VALUES: Record<string, number> = {
  L: 0.77, H: 0.44,
};

const UI_VALUES: Record<string, number> = {
  N: 0.85, R: 0.62,
};

// PR values depend on Scope
const PR_VALUES: Record<string, Record<string, number>> = {
  U: { N: 0.85, L: 0.62, H: 0.27 },
  C: { N: 0.85, L: 0.68, H: 0.50 },
};

const IMPACT_VALUES: Record<string, number> = {
  N: 0, L: 0.22, H: 0.56,
};

function calculateCvssBaseScore(vector: CvssVector): CvssResult {
  // Calculate Exploitability sub-score
  const exploitability =
    8.22 *
    AV_VALUES[vector.attackVector] *
    AC_VALUES[vector.attackComplexity] *
    PR_VALUES[vector.scope][vector.privilegesRequired] *
    UI_VALUES[vector.userInteraction];

  // Calculate Impact sub-score
  const impactBase =
    1 -
    (1 - IMPACT_VALUES[vector.confidentiality]) *
    (1 - IMPACT_VALUES[vector.integrity]) *
    (1 - IMPACT_VALUES[vector.availability]);

  let impact: number;
  if (vector.scope === "U") {
    impact = 6.42 * impactBase;
  } else {
    impact = 7.52 * (impactBase - 0.029) - 3.25 * Math.pow(impactBase - 0.02, 15);
  }

  // Calculate Base Score
  let score: number;
  if (impact <= 0) {
    score = 0;
  } else if (vector.scope === "U") {
    score = Math.min(impact + exploitability, 10);
    score = Math.ceil(score * 10) / 10;
  } else {
    score = Math.min(1.08 * (impact + exploitability), 10);
    score = Math.ceil(score * 10) / 10;
  }

  const vectorString =
    `CVSS:3.1/AV:${vector.attackVector}/AC:${vector.attackComplexity}` +
    `/PR:${vector.privilegesRequired}/UI:${vector.userInteraction}` +
    `/S:${vector.scope}/C:${vector.confidentiality}` +
    `/I:${vector.integrity}/A:${vector.availability}`;

  return {
    score,
    severity: getSeverity(score),
    vector: vectorString,
  };
}

function getSeverity(score: number): CvssResult["severity"] {
  if (score === 0) return "None";
  if (score <= 3.9) return "Low";
  if (score <= 6.9) return "Medium";
  if (score <= 8.9) return "High";
  return "Critical";
}

// Example: Calculate Log4Shell CVSS
const log4shell = calculateCvssBaseScore({
  attackVector: "N",
  attackComplexity: "L",
  privilegesRequired: "N",
  userInteraction: "N",
  scope: "C",
  confidentiality: "H",
  integrity: "H",
  availability: "H",
});

console.log(`Log4Shell: ${log4shell.score} (${log4shell.severity})`);
// Output: Log4Shell: 10.0 (Critical)
```

---

## EPSS -- Exploit Prediction Scoring System

### What EPSS Is

EPSS estimates the probability that a vulnerability will be exploited in the wild within the next 30 days. Unlike CVSS, which measures severity, EPSS measures the real-world likelihood of exploitation.

| Property | CVSS | EPSS |
|----------|------|------|
| **Measures** | Severity / technical impact | Probability of exploitation |
| **Range** | 0.0 - 10.0 | 0.0 - 1.0 (probability) |
| **Updates** | Fixed at publication (base) | Updated daily |
| **Input data** | Vulnerability characteristics | Exploit intelligence, threat feeds, PoC availability, social media mentions, vulnerability age |
| **Best for** | Understanding impact severity | Prioritizing remediation effort |

### Using EPSS for Prioritization

Combine EPSS with CVSS for effective prioritization:

- **CVSS >= 9.0 AND EPSS >= 0.5**: Immediate action -- actively exploited critical vulnerability
- **CVSS >= 9.0 AND EPSS < 0.1**: High severity but low exploitation likelihood -- schedule within SLA
- **CVSS < 4.0 AND EPSS >= 0.7**: Low severity but high exploitation probability -- investigate for escalation paths
- **CVSS < 4.0 AND EPSS < 0.1**: Low priority -- batch into regular maintenance

### EPSS API Integration

```python
# epss_client.py
# Query the FIRST EPSS API for vulnerability exploitation probability

import httpx
from dataclasses import dataclass
from datetime import datetime


@dataclass
class EpssScore:
    cve: str
    epss: float
    percentile: float
    date: str


class EpssClient:
    """Client for the FIRST EPSS API (https://api.first.org/data/v1/epss)."""

    BASE_URL = "https://api.first.org/data/v1/epss"

    def __init__(self, timeout: float = 30.0):
        self.client = httpx.Client(timeout=timeout)

    def get_score(self, cve_id: str) -> EpssScore | None:
        """Fetch the EPSS score for a single CVE."""
        response = self.client.get(self.BASE_URL, params={"cve": cve_id})
        response.raise_for_status()
        data = response.json()

        if not data.get("data"):
            return None

        entry = data["data"][0]
        return EpssScore(
            cve=entry["cve"],
            epss=float(entry["epss"]),
            percentile=float(entry["percentile"]),
            date=entry["date"],
        )

    def get_scores_bulk(self, cve_ids: list[str]) -> list[EpssScore]:
        """Fetch EPSS scores for multiple CVEs in a single request."""
        # EPSS API accepts comma-separated CVE IDs
        cve_param = ",".join(cve_ids)
        response = self.client.get(self.BASE_URL, params={"cve": cve_param})
        response.raise_for_status()
        data = response.json()

        return [
            EpssScore(
                cve=entry["cve"],
                epss=float(entry["epss"]),
                percentile=float(entry["percentile"]),
                date=entry["date"],
            )
            for entry in data.get("data", [])
        ]

    def get_above_threshold(self, threshold: float = 0.5) -> list[EpssScore]:
        """Fetch all CVEs with EPSS score above the given threshold."""
        response = self.client.get(
            self.BASE_URL,
            params={"epss-gt": threshold, "limit": 100},
        )
        response.raise_for_status()
        data = response.json()

        return [
            EpssScore(
                cve=entry["cve"],
                epss=float(entry["epss"]),
                percentile=float(entry["percentile"]),
                date=entry["date"],
            )
            for entry in data.get("data", [])
        ]


# Usage example
if __name__ == "__main__":
    client = EpssClient()

    # Single CVE lookup
    log4shell = client.get_score("CVE-2021-44228")
    if log4shell:
        print(f"{log4shell.cve}: EPSS={log4shell.epss:.4f} "
              f"(percentile: {log4shell.percentile:.4f})")
        # Output: CVE-2021-44228: EPSS=0.9754 (percentile: 0.9999)

    # Bulk lookup
    scores = client.get_scores_bulk([
        "CVE-2021-44228",
        "CVE-2023-23397",
        "CVE-2023-44487",
    ])
    for score in scores:
        print(f"{score.cve}: EPSS={score.epss:.4f}")
```

---

## SSVC -- Stakeholder-Specific Vulnerability Categorization

### Overview

SSVC is CISA's decision-tree approach for vulnerability prioritization. Instead of a numeric score, SSVC produces an actionable decision: **Track**, **Track***, **Attend**, or **Act**.

Use SSVC when CVSS alone produces too many "Critical" findings and teams cannot differentiate priorities.

### SSVC Decision Points

Evaluate each vulnerability through four decision points:

**1. Exploitation Status**

| Value | Definition |
|-------|-----------|
| **None** | No evidence of active exploitation |
| **PoC** | Proof-of-concept exists but no active exploitation observed |
| **Active** | Exploitation observed in the wild (CISA KEV, threat intel) |

**2. Automatable**

| Value | Definition |
|-------|-----------|
| **No** | Exploitation requires manual effort, human interaction, or specific conditions |
| **Yes** | Exploitation can be fully automated (wormable, scriptable) |

**3. Technical Impact**

| Value | Definition |
|-------|-----------|
| **Partial** | Limited impact -- information disclosure, DoS of non-critical function |
| **Total** | Complete control -- remote code execution, full data access |

**4. Mission Prevalence**

| Value | Definition |
|-------|-----------|
| **Minimal** | Affected asset has little relevance to critical functions |
| **Support** | Asset supports but is not essential to critical functions |
| **Essential** | Asset is directly involved in mission-critical operations |

### SSVC Decision Outcomes

| Outcome | Action | Timeline |
|---------|--------|----------|
| **Track** | Monitor the vulnerability. No immediate action needed. | Remediate during standard cycles |
| **Track*** | Monitor closely. More attention than Track but no immediate action. | Remediate in next scheduled window |
| **Attend** | Prioritize remediation. Escalate to senior staff. | Remediate within days |
| **Act** | Immediate remediation. Executive notification. All hands on deck. | Remediate within hours |

### SSVC Decision Tree Implementation

```typescript
// ssvc-decision.ts
// Implement CISA's SSVC decision tree for vulnerability triage

type ExploitationStatus = "none" | "poc" | "active";
type Automatable = "yes" | "no";
type TechnicalImpact = "partial" | "total";
type MissionPrevalence = "minimal" | "support" | "essential";
type SsvcDecision = "Track" | "Track*" | "Attend" | "Act";

interface SsvcInput {
  exploitation: ExploitationStatus;
  automatable: Automatable;
  technicalImpact: TechnicalImpact;
  missionPrevalence: MissionPrevalence;
}

interface SsvcOutput {
  decision: SsvcDecision;
  reasoning: string;
  slaHours: number;
}

function evaluateSsvc(input: SsvcInput): SsvcOutput {
  const { exploitation, automatable, technicalImpact, missionPrevalence } = input;

  // Active exploitation path -- highest urgency
  if (exploitation === "active") {
    if (automatable === "yes") {
      return {
        decision: "Act",
        reasoning: "Active exploitation + automatable = wormable threat. Immediate action.",
        slaHours: 24,
      };
    }
    if (technicalImpact === "total") {
      if (missionPrevalence === "essential") {
        return {
          decision: "Act",
          reasoning: "Active exploitation + total impact + essential asset.",
          slaHours: 24,
        };
      }
      return {
        decision: "Attend",
        reasoning: "Active exploitation + total impact on non-essential asset.",
        slaHours: 72,
      };
    }
    // Active exploitation, partial impact
    if (missionPrevalence === "essential") {
      return {
        decision: "Attend",
        reasoning: "Active exploitation + partial impact on essential asset.",
        slaHours: 72,
      };
    }
    return {
      decision: "Track*",
      reasoning: "Active exploitation but partial impact on non-essential asset.",
      slaHours: 168,
    };
  }

  // PoC exists path
  if (exploitation === "poc") {
    if (automatable === "yes" && technicalImpact === "total") {
      if (missionPrevalence === "essential" || missionPrevalence === "support") {
        return {
          decision: "Attend",
          reasoning: "PoC + automatable + total impact on important asset.",
          slaHours: 72,
        };
      }
    }
    if (technicalImpact === "total" && missionPrevalence === "essential") {
      return {
        decision: "Attend",
        reasoning: "PoC + total impact on essential asset.",
        slaHours: 72,
      };
    }
    return {
      decision: "Track*",
      reasoning: "PoC exists. Monitor for escalation to active exploitation.",
      slaHours: 168,
    };
  }

  // No known exploitation
  if (technicalImpact === "total" && missionPrevalence === "essential") {
    return {
      decision: "Track*",
      reasoning: "No exploitation but total impact potential on essential asset.",
      slaHours: 168,
    };
  }
  return {
    decision: "Track",
    reasoning: "No exploitation evidence. Standard tracking.",
    slaHours: 720,
  };
}

// Example usage
const log4shellSsvc = evaluateSsvc({
  exploitation: "active",
  automatable: "yes",
  technicalImpact: "total",
  missionPrevalence: "essential",
});
console.log(`Log4Shell SSVC: ${log4shellSsvc.decision}`);
// Output: Log4Shell SSVC: Act
```

---

## Risk Assessment Methodologies

### Qualitative Risk Assessment

Use qualitative methods when data is insufficient for numerical analysis or when rapid assessment is needed.

**3x3 Risk Matrix:**

```
              IMPACT
              Low    Medium    High
LIKELIHOOD
High        | M    | H       | H    |
Medium      | L    | M       | H    |
Low         | L    | L       | M    |
```

**5x5 Risk Matrix (recommended for production use):**

```
              IMPACT
              Negligible  Minor  Moderate  Major  Catastrophic
LIKELIHOOD
Almost Certain |  M       |  H   |  H      |  VH  |  VH         |
Likely         |  M       |  M   |  H      |  H   |  VH         |
Possible       |  L       |  M   |  M      |  H   |  H          |
Unlikely       |  L       |  L   |  M      |  M   |  H          |
Rare           |  L       |  L   |  L      |  M   |  M          |
```

**Likelihood Scale:**

| Level | Label | Annual Probability | Description |
|-------|-------|--------------------|-------------|
| 5 | Almost Certain | > 90% | Expected to occur multiple times per year |
| 4 | Likely | 50-90% | Expected to occur at least once per year |
| 3 | Possible | 10-50% | Could occur within a 1-3 year period |
| 2 | Unlikely | 1-10% | Could occur within a 3-10 year period |
| 1 | Rare | < 1% | Could occur but not expected |

**Impact Scale:**

| Level | Label | Financial | Operational | Reputational |
|-------|-------|-----------|-------------|--------------|
| 5 | Catastrophic | > $10M | Complete service outage > 48h | National media coverage, regulatory action |
| 4 | Major | $1M-$10M | Critical service degradation > 24h | Industry-wide awareness |
| 3 | Moderate | $100K-$1M | Service degradation > 4h | Regional or sector-specific coverage |
| 2 | Minor | $10K-$100K | Brief disruption < 4h | Limited customer awareness |
| 1 | Negligible | < $10K | No noticeable disruption | No external awareness |

### Quantitative Risk Assessment

Use quantitative methods when historical data is available and precision matters.

**Annual Loss Expectancy (ALE):**

```
ALE = SLE x ARO

Where:
  SLE (Single Loss Expectancy) = Asset Value x Exposure Factor
  ARO (Annual Rate of Occurrence) = How often the event occurs per year
  Exposure Factor = Percentage of asset lost (0.0 to 1.0)
```

**Example Calculation:**

```
Scenario: SQL injection leading to customer data breach

Asset Value: $5,000,000 (customer database, including regulatory fines)
Exposure Factor: 0.4 (40% of records exposed on average)
SLE = $5,000,000 x 0.4 = $2,000,000

ARO: 0.25 (once every 4 years based on industry data)

ALE = $2,000,000 x 0.25 = $500,000/year

If a WAF + code remediation costs $150,000/year, the investment is justified:
  Risk Reduction = $500,000 - $150,000 = $350,000 net savings
```

**Monte Carlo Simulation:**

Use Monte Carlo methods when single-point estimates are insufficient and you need to model uncertainty.

```python
# monte_carlo_risk.py
# Monte Carlo simulation for risk quantification

import numpy as np
from dataclasses import dataclass


@dataclass
class RiskScenario:
    name: str
    asset_value_range: tuple[float, float]       # (min, max) in dollars
    exposure_factor_range: tuple[float, float]    # (min, max) as fraction
    frequency_range: tuple[float, float]          # (min, max) events per year


def simulate_ale(
    scenario: RiskScenario,
    simulations: int = 10_000,
    seed: int = 42,
) -> dict:
    """Run Monte Carlo simulation to estimate ALE distribution."""
    rng = np.random.default_rng(seed)

    # Sample from uniform distributions (use PERT/triangular for more realism)
    asset_values = rng.uniform(
        scenario.asset_value_range[0],
        scenario.asset_value_range[1],
        simulations,
    )
    exposure_factors = rng.uniform(
        scenario.exposure_factor_range[0],
        scenario.exposure_factor_range[1],
        simulations,
    )
    frequencies = rng.uniform(
        scenario.frequency_range[0],
        scenario.frequency_range[1],
        simulations,
    )

    # Calculate ALE for each simulation
    sle_values = asset_values * exposure_factors
    ale_values = sle_values * frequencies

    return {
        "scenario": scenario.name,
        "simulations": simulations,
        "ale_mean": float(np.mean(ale_values)),
        "ale_median": float(np.median(ale_values)),
        "ale_p5": float(np.percentile(ale_values, 5)),
        "ale_p95": float(np.percentile(ale_values, 95)),
        "ale_std": float(np.std(ale_values)),
        "max_single_loss": float(np.max(sle_values)),
    }


# Example: Data breach risk
breach_scenario = RiskScenario(
    name="Customer Data Breach via SQL Injection",
    asset_value_range=(2_000_000, 8_000_000),
    exposure_factor_range=(0.1, 0.6),
    frequency_range=(0.05, 0.5),
)

results = simulate_ale(breach_scenario)

print(f"Scenario: {results['scenario']}")
print(f"Mean ALE: ${results['ale_mean']:,.0f}")
print(f"Median ALE: ${results['ale_median']:,.0f}")
print(f"5th Percentile: ${results['ale_p5']:,.0f}")
print(f"95th Percentile: ${results['ale_p95']:,.0f}")
print(f"Worst-case single loss: ${results['max_single_loss']:,.0f}")
```

### Semi-Quantitative: FAIR (Factor Analysis of Information Risk)

FAIR decomposes risk into measurable components:

```
Risk
 |-- Loss Event Frequency (LEF)
 |    |-- Threat Event Frequency (TEF)
 |    |    |-- Contact Frequency
 |    |    |-- Probability of Action
 |    |-- Vulnerability (probability of success)
 |         |-- Threat Capability
 |         |-- Resistance Strength
 |
 |-- Loss Magnitude (LM)
      |-- Primary Loss
      |    |-- Productivity
      |    |-- Response Cost
      |    |-- Replacement Cost
      |-- Secondary Loss
           |-- Fines/Judgments
           |-- Reputation Damage
           |-- Competitive Advantage Loss
```

FAIR forces explicit estimation of each component. This makes assumptions visible and debatable -- far superior to gut-feel risk ratings.

**When to use each methodology:**

| Method | Use When | Precision | Effort |
|--------|----------|-----------|--------|
| Qualitative (matrices) | Rapid triage, limited data, early-stage assessments | Low | Low |
| Quantitative (ALE) | Sufficient historical data, budget justification | High | High |
| Monte Carlo | Significant uncertainty, need confidence intervals | Highest | Highest |
| FAIR | Board-level risk communication, comparing disparate risks | Medium-High | Medium-High |

---

## Vulnerability Prioritization

### Triage Workflow

Follow this workflow for every new vulnerability finding:

```
1. IDENTIFY
   |-- Source: scanner, advisory, bug bounty, CISA KEV
   |-- Affected component, version, deployment context
   |
2. SCORE
   |-- CVSS base score (severity)
   |-- EPSS score (exploitation probability)
   |-- SSVC decision (action recommendation)
   |
3. CONTEXTUALIZE
   |-- Reachability: Is the vulnerable code path actually reachable?
   |-- Exposure: Is the component internet-facing or internal-only?
   |-- Data sensitivity: What data can be accessed through this path?
   |-- Compensating controls: WAF, network segmentation, authentication
   |
4. PRIORITIZE
   |-- Combine scores with business context
   |-- Assign remediation SLA
   |-- Assign owner
   |
5. REMEDIATE
   |-- Patch, upgrade, workaround, or accept with documentation
   |-- Verify fix
   |-- Close ticket
```

### Remediation SLAs

| Priority | CVSS Range | Additional Criteria | SLA |
|----------|------------|---------------------|-----|
| **P0 -- Critical** | 9.0-10.0 | Active exploitation OR EPSS > 0.7 OR internet-facing | 24 hours |
| **P1 -- High** | 7.0-8.9 | EPSS > 0.4 OR reachable code path confirmed | 7 days |
| **P2 -- Medium** | 4.0-6.9 | Reachable code path, no compensating controls | 30 days |
| **P3 -- Low** | 0.1-3.9 | Or higher CVSS with strong compensating controls | 90 days |

### Combined Prioritization Logic

```typescript
// vulnerability-prioritizer.ts
// Combine CVSS, EPSS, and business context for prioritization

interface VulnerabilityContext {
  cveId: string;
  cvssScore: number;
  epssScore: number;
  isExploitedInWild: boolean;       // CISA KEV list
  isInternetFacing: boolean;
  isReachable: boolean;             // Reachability analysis result
  hasCompensatingControls: boolean;
  dataSensitivity: "public" | "internal" | "confidential" | "restricted";
  assetCriticality: "low" | "medium" | "high" | "critical";
}

type Priority = "P0" | "P1" | "P2" | "P3";

interface PrioritizationResult {
  priority: Priority;
  slaHours: number;
  reasoning: string[];
  riskScore: number;
}

function prioritizeVulnerability(ctx: VulnerabilityContext): PrioritizationResult {
  const reasoning: string[] = [];
  let riskScore = 0;

  // Start with CVSS as baseline (0-10 scale, weight: 30%)
  riskScore += ctx.cvssScore * 3;
  reasoning.push(`CVSS ${ctx.cvssScore} contributes ${(ctx.cvssScore * 3).toFixed(1)} points`);

  // EPSS factor (0-1 scale, weight: 25%)
  riskScore += ctx.epssScore * 25;
  reasoning.push(`EPSS ${ctx.epssScore.toFixed(4)} contributes ${(ctx.epssScore * 25).toFixed(1)} points`);

  // Known exploitation (binary, weight: 20%)
  if (ctx.isExploitedInWild) {
    riskScore += 20;
    reasoning.push("Active exploitation confirmed (+20)");
  }

  // Exposure modifiers
  if (ctx.isInternetFacing) {
    riskScore += 10;
    reasoning.push("Internet-facing asset (+10)");
  }

  if (!ctx.isReachable) {
    riskScore *= 0.3;
    reasoning.push("Code path NOT reachable (score * 0.3)");
  }

  if (ctx.hasCompensatingControls) {
    riskScore *= 0.7;
    reasoning.push("Compensating controls in place (score * 0.7)");
  }

  // Data sensitivity multiplier
  const sensitivityMultipliers: Record<string, number> = {
    public: 0.5,
    internal: 0.8,
    confidential: 1.0,
    restricted: 1.3,
  };
  riskScore *= sensitivityMultipliers[ctx.dataSensitivity];
  reasoning.push(
    `Data sensitivity: ${ctx.dataSensitivity} (x${sensitivityMultipliers[ctx.dataSensitivity]})`
  );

  // Asset criticality multiplier
  const criticalityMultipliers: Record<string, number> = {
    low: 0.5,
    medium: 0.8,
    high: 1.0,
    critical: 1.5,
  };
  riskScore *= criticalityMultipliers[ctx.assetCriticality];
  reasoning.push(
    `Asset criticality: ${ctx.assetCriticality} (x${criticalityMultipliers[ctx.assetCriticality]})`
  );

  // Normalize to 0-100
  riskScore = Math.min(Math.max(riskScore, 0), 100);

  // Map to priority
  let priority: Priority;
  let slaHours: number;

  if (riskScore >= 70 || ctx.isExploitedInWild) {
    priority = "P0";
    slaHours = 24;
  } else if (riskScore >= 45) {
    priority = "P1";
    slaHours = 168; // 7 days
  } else if (riskScore >= 20) {
    priority = "P2";
    slaHours = 720; // 30 days
  } else {
    priority = "P3";
    slaHours = 2160; // 90 days
  }

  return { priority, slaHours, reasoning, riskScore: Math.round(riskScore * 10) / 10 };
}

// Example: Prioritize Log4Shell on an internal service
const result = prioritizeVulnerability({
  cveId: "CVE-2021-44228",
  cvssScore: 10.0,
  epssScore: 0.975,
  isExploitedInWild: true,
  isInternetFacing: false,
  isReachable: true,
  hasCompensatingControls: false,
  dataSensitivity: "confidential",
  assetCriticality: "high",
});

console.log(`Priority: ${result.priority}, SLA: ${result.slaHours}h`);
console.log(`Risk Score: ${result.riskScore}/100`);
result.reasoning.forEach((r) => console.log(`  - ${r}`));
```

---

## Risk Registers

### Purpose

A risk register is the central repository for identified risks, their assessments, treatment decisions, and ownership. Maintain it as a living document, reviewed at minimum quarterly.

### Risk Register Structure

Each entry must contain:

| Field | Description | Example |
|-------|-------------|---------|
| **Risk ID** | Unique identifier | RISK-SEC-042 |
| **Title** | Short descriptive name | "SQL Injection in Payment API" |
| **Description** | Detailed explanation of the risk | "The /api/payments endpoint constructs SQL queries using string concatenation..." |
| **Category** | Risk domain | Application Security, Infrastructure, Compliance, Third-party |
| **Threat Source** | Who or what could exploit it | External attacker, malicious insider, automated bot |
| **Vulnerability** | The weakness being exploited | Lack of parameterized queries |
| **Asset(s) Affected** | What is at risk | Customer payment data, PCI scope systems |
| **Inherent Risk** | Risk before controls (Likelihood x Impact) | High (4) x Catastrophic (5) = 20 |
| **Current Controls** | Existing mitigations | WAF rules, input validation on frontend |
| **Residual Risk** | Risk after controls | Medium (3) x Major (4) = 12 |
| **Risk Treatment** | Selected approach | Mitigate |
| **Treatment Plan** | Specific actions | "Implement parameterized queries, add SAST rule, deploy runtime protection" |
| **Owner** | Person accountable | Jane Smith, Senior Backend Engineer |
| **Due Date** | Deadline for treatment | 2026-04-15 |
| **Status** | Current state | In Progress, Accepted, Mitigated, Closed |
| **Last Reviewed** | Date of last review | 2026-03-01 |

### Risk Treatment Options

Apply one of four treatment strategies to every identified risk:

**1. Mitigate (Reduce)**
- Implement controls to reduce likelihood, impact, or both.
- Most common treatment. Examples: patching, code fixes, adding authentication, encryption.
- Cost of mitigation must be proportional to risk reduction achieved.

**2. Accept**
- Acknowledge the risk and choose to take no action.
- Requires formal documentation: who accepted it, why, expiration date for review.
- Never accept risk informally. Every risk acceptance must be signed by someone at the appropriate authority level.

**3. Transfer**
- Shift the risk to a third party.
- Examples: cyber insurance, outsourcing to a managed security provider, contractual liability transfer.
- Transfer shifts financial impact, not reputational impact. A breach is still your breach.

**4. Avoid**
- Eliminate the risk entirely by removing the activity or asset.
- Examples: discontinue a legacy service, remove a feature with unresolvable vulnerabilities, decline to store certain data.
- Most effective but least flexible. Not always feasible.

### Risk Acceptance Template

```
RISK ACCEPTANCE FORM
--------------------
Risk ID:          RISK-SEC-042
Risk Title:       Unpatched OpenSSL in Legacy Payment Gateway
Risk Score:       High (Inherent: 20, Residual: 15)
Accepted By:      [Name, Title]
Acceptance Date:  [Date]
Review Date:      [Date -- maximum 90 days from acceptance]

Justification:
  The legacy payment gateway is scheduled for decommission in Q3 2026.
  Patching OpenSSL requires recompilation of the custom binary, estimated
  at 3 engineering weeks. Compensating controls are in place:
  - Network segmentation restricts access to internal VPN users only
  - WAF rules block known exploit patterns
  - Enhanced monitoring with 15-minute alert SLA on anomalous traffic

Conditions for Revocation:
  - Active exploitation observed in the wild
  - Gateway decommission delayed beyond Q3 2026
  - Compensating controls fail or are removed

Approved By:      [CISO / VP Engineering signature]
```

---

## Security Risk in Software Development

### Risk-Based Testing

Allocate testing effort proportionally to risk:

| Component Risk Level | Testing Requirements |
|---------------------|---------------------|
| **Critical** (authentication, payment, PII handling) | Automated SAST + DAST + manual penetration testing + fuzzing |
| **High** (API endpoints, data processing) | Automated SAST + DAST + periodic manual review |
| **Medium** (internal tools, admin panels) | Automated SAST + periodic DAST |
| **Low** (static pages, documentation) | Automated SAST in CI |

### Risk-Informed Code Review

When reviewing code, evaluate security risk using this checklist:

```
[ ] Does this change handle user input? -> Validate injection risk
[ ] Does this change modify authentication/authorization? -> Full security review required
[ ] Does this change introduce a new dependency? -> Check CVE history, maintainer reputation
[ ] Does this change modify data access patterns? -> Evaluate data exposure risk
[ ] Does this change affect cryptographic operations? -> Require cryptography expert review
[ ] Does this change modify network-facing interfaces? -> Evaluate attack surface change
[ ] Does this change handle secrets or credentials? -> Verify no hardcoded values, proper vault usage
[ ] Does this change modify logging? -> Ensure no sensitive data in logs
```

### Security Debt Tracking

Track security debt alongside technical debt:

```typescript
// security-debt-tracker.ts
// Track and prioritize security debt items

interface SecurityDebtItem {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "vulnerability" | "misconfiguration" | "missing-control" | "outdated-dependency";
  discoveredDate: Date;
  estimatedEffortHours: number;
  riskScore: number;
  affectedComponents: string[];
  owner: string;
  status: "open" | "in-progress" | "accepted" | "resolved";
  acceptedBy?: string;
  acceptedUntil?: Date;
}

interface DebtMetrics {
  totalItems: number;
  criticalCount: number;
  highCount: number;
  averageAgeInDays: number;
  overdueCount: number;
  totalEstimatedHours: number;
  riskWeightedScore: number;
}

function calculateDebtMetrics(items: SecurityDebtItem[]): DebtMetrics {
  const now = new Date();
  const openItems = items.filter((item) => item.status !== "resolved");

  const severityWeights: Record<string, number> = {
    critical: 10,
    high: 5,
    medium: 2,
    low: 1,
  };

  const slaDays: Record<string, number> = {
    critical: 1,
    high: 7,
    medium: 30,
    low: 90,
  };

  const ages = openItems.map(
    (item) => (now.getTime() - item.discoveredDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const overdueItems = openItems.filter((item) => {
    const ageInDays =
      (now.getTime() - item.discoveredDate.getTime()) / (1000 * 60 * 60 * 24);
    return ageInDays > slaDays[item.severity];
  });

  return {
    totalItems: openItems.length,
    criticalCount: openItems.filter((i) => i.severity === "critical").length,
    highCount: openItems.filter((i) => i.severity === "high").length,
    averageAgeInDays:
      ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0,
    overdueCount: overdueItems.length,
    totalEstimatedHours: openItems.reduce((sum, i) => sum + i.estimatedEffortHours, 0),
    riskWeightedScore: openItems.reduce(
      (sum, item) => sum + item.riskScore * severityWeights[item.severity],
      0
    ),
  };
}
```

### Risk Acceptance Process for Software Decisions

Follow this escalation path for risk acceptance:

| Risk Level | Acceptance Authority | Documentation |
|------------|---------------------|---------------|
| Low | Team Lead / Senior Engineer | Ticket comment with justification |
| Medium | Engineering Manager | Written risk acceptance in risk register |
| High | Director of Engineering + Security Lead | Formal risk acceptance form, time-bounded |
| Critical | CISO / CTO / VP Engineering | Board-level risk acceptance, quarterly review |

---

## Risk Communication

### Communicating to Different Audiences

**Developers:**
- Speak in technical terms. Provide CVE IDs, affected packages, exact versions.
- Show the attack vector with code examples.
- Provide clear remediation steps with code snippets.
- Link to the relevant PR or commit that fixes the issue.

**Engineering Managers:**
- Focus on SLA compliance, team velocity impact, resource needs.
- Use metrics: number of open vulnerabilities by severity, mean time to remediate (MTTR), SLA compliance percentage.
- Frame in terms of sprint impact: "This requires 2 story points from the current sprint."

**Executives / Board:**
- Translate to business terms: revenue impact, regulatory exposure, competitive risk.
- Use financial quantification: ALE, potential fine amounts, insurance implications.
- Present trends, not individual vulnerabilities. "Critical vulnerability backlog reduced 40% quarter-over-quarter."
- Provide comparison to industry benchmarks.

### Risk Dashboard Metrics

Track and display these metrics:

```
VULNERABILITY MANAGEMENT DASHBOARD
------------------------------------

SLA Compliance:
  Critical (24h): 95% (target: 99%)
  High (7d):      88% (target: 95%)
  Medium (30d):   92% (target: 90%)
  Low (90d):      97% (target: 85%)

Mean Time to Remediate (MTTR):
  Critical: 18 hours
  High:     4.2 days
  Medium:   22 days
  Low:      61 days

Open Vulnerability Counts:
  Critical: 2 (both within SLA)
  High:     14 (12 within SLA, 2 overdue)
  Medium:   47 (43 within SLA, 4 overdue)
  Low:      128

Risk Trend (quarter-over-quarter):
  Risk-weighted score: 1,240 -> 890 (28% reduction)
  New findings rate: 45/month -> 38/month
  Reintroduction rate: 4% -> 2%

Security Debt:
  Total estimated effort: 340 hours
  Top 3 areas: Dependency updates (140h), Auth refactoring (80h), Encryption upgrades (60h)
```

### Reporting Template

```python
# risk_report.py
# Generate a risk summary report for stakeholders

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum


class Severity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class VulnerabilityStats:
    severity: Severity
    total_open: int
    within_sla: int
    overdue: int
    mttr_hours: float
    sla_target_pct: float

    @property
    def sla_compliance_pct(self) -> float:
        if self.total_open == 0:
            return 100.0
        return (self.within_sla / self.total_open) * 100

    @property
    def sla_met(self) -> bool:
        return self.sla_compliance_pct >= self.sla_target_pct


@dataclass
class RiskReport:
    report_date: datetime
    reporting_period: str
    stats: list[VulnerabilityStats]
    risk_score_current: float
    risk_score_previous: float
    accepted_risks_count: int
    accepted_risks_expiring_soon: int  # within 30 days

    def risk_trend_pct(self) -> float:
        if self.risk_score_previous == 0:
            return 0.0
        return (
            (self.risk_score_current - self.risk_score_previous)
            / self.risk_score_previous
        ) * 100

    def executive_summary(self) -> str:
        trend = self.risk_trend_pct()
        direction = "decreased" if trend < 0 else "increased"
        lines = [
            f"Security Risk Report -- {self.report_date.strftime('%Y-%m-%d')}",
            f"Period: {self.reporting_period}",
            "",
            f"Overall risk score has {direction} by {abs(trend):.1f}% "
            f"(from {self.risk_score_previous:.0f} to {self.risk_score_current:.0f}).",
            "",
            "SLA Compliance:",
        ]
        for stat in self.stats:
            status = "MET" if stat.sla_met else "MISSED"
            lines.append(
                f"  {stat.severity.value.upper():>8}: "
                f"{stat.sla_compliance_pct:.0f}% "
                f"(target: {stat.sla_target_pct:.0f}%) [{status}]"
            )

        if self.accepted_risks_expiring_soon > 0:
            lines.append("")
            lines.append(
                f"ACTION REQUIRED: {self.accepted_risks_expiring_soon} accepted risks "
                f"expire within 30 days and require re-evaluation."
            )

        return "\n".join(lines)


# Example usage
report = RiskReport(
    report_date=datetime.now(),
    reporting_period="Q1 2026",
    stats=[
        VulnerabilityStats(Severity.CRITICAL, 2, 2, 0, 18.0, 99.0),
        VulnerabilityStats(Severity.HIGH, 14, 12, 2, 100.8, 95.0),
        VulnerabilityStats(Severity.MEDIUM, 47, 43, 4, 528.0, 90.0),
        VulnerabilityStats(Severity.LOW, 128, 125, 3, 1464.0, 85.0),
    ],
    risk_score_current=890,
    risk_score_previous=1240,
    accepted_risks_count=8,
    accepted_risks_expiring_soon=3,
)

print(report.executive_summary())
```

---

## Continuous Risk Assessment

### Integrating Risk Assessment into CI/CD

Embed risk evaluation at every stage of the software delivery pipeline:

```
CODE COMMIT
  |-- Pre-commit hooks: secrets scanning (gitleaks, truffleHog)
  |-- SAST scan on changed files
  |
PULL REQUEST
  |-- Full SAST scan
  |-- Dependency vulnerability check (npm audit, pip-audit, trivy)
  |-- License compliance check
  |-- Security-focused code review (auto-triggered for sensitive paths)
  |
BUILD
  |-- Container image scanning (trivy, grype)
  |-- SBOM generation (syft, cyclonedx)
  |-- Binary composition analysis
  |
STAGING DEPLOYMENT
  |-- DAST scan against staging environment
  |-- Infrastructure configuration scan (checkov, tfsec)
  |-- API security testing
  |
PRODUCTION DEPLOYMENT
  |-- Final vulnerability gate check
  |-- Risk score calculation for the release
  |-- Deployment approval based on risk threshold
  |
RUNTIME
  |-- Continuous vulnerability monitoring
  |-- EPSS score tracking for deployed dependencies
  |-- Runtime application self-protection (RASP)
  |-- Cloud security posture management (CSPM)
```

### Automated Vulnerability Assessment Pipeline

```typescript
// pipeline-risk-gate.ts
// Risk gate for CI/CD pipeline -- block deployments that exceed risk threshold

interface ScanResult {
  cveId: string;
  packageName: string;
  installedVersion: string;
  fixedVersion: string | null;
  cvssScore: number;
  epssScore: number;
  isReachable: boolean;
  isInKev: boolean;  // CISA Known Exploited Vulnerabilities catalog
}

interface RiskGateConfig {
  maxCriticalCount: number;       // Max critical vulns allowed (typically 0)
  maxHighCount: number;           // Max high vulns allowed
  maxRiskScore: number;           // Max aggregate risk score (0-100)
  blockOnKev: boolean;            // Block if any KEV entries found
  blockOnUnreachable: boolean;    // Whether to count unreachable vulns
  allowedCves: string[];          // Explicitly accepted CVEs (with approval)
}

interface GateDecision {
  allowed: boolean;
  reason: string;
  criticalCount: number;
  highCount: number;
  aggregateRiskScore: number;
  blockers: string[];
  warnings: string[];
}

function evaluateRiskGate(
  results: ScanResult[],
  config: RiskGateConfig,
): GateDecision {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Filter out explicitly accepted CVEs
  const activeResults = results.filter(
    (r) => !config.allowedCves.includes(r.cveId)
  );

  // Filter unreachable if configured
  const relevantResults = config.blockOnUnreachable
    ? activeResults
    : activeResults.filter((r) => r.isReachable);

  // Count by severity
  const criticalCount = relevantResults.filter((r) => r.cvssScore >= 9.0).length;
  const highCount = relevantResults.filter(
    (r) => r.cvssScore >= 7.0 && r.cvssScore < 9.0
  ).length;

  // Check KEV blockers
  if (config.blockOnKev) {
    const kevFindings = relevantResults.filter((r) => r.isInKev);
    if (kevFindings.length > 0) {
      blockers.push(
        `${kevFindings.length} CVE(s) in CISA KEV catalog: ` +
        kevFindings.map((r) => r.cveId).join(", ")
      );
    }
  }

  // Check critical count
  if (criticalCount > config.maxCriticalCount) {
    blockers.push(
      `Critical vulnerabilities: ${criticalCount} (max allowed: ${config.maxCriticalCount})`
    );
  }

  // Check high count
  if (highCount > config.maxHighCount) {
    blockers.push(
      `High vulnerabilities: ${highCount} (max allowed: ${config.maxHighCount})`
    );
  }

  // Calculate aggregate risk score
  const aggregateRiskScore = relevantResults.reduce((sum, r) => {
    const weight = r.isReachable ? 1.0 : 0.2;
    const kevBonus = r.isInKev ? 2.0 : 1.0;
    return sum + r.cvssScore * r.epssScore * weight * kevBonus;
  }, 0);

  const normalizedScore = Math.min(aggregateRiskScore, 100);

  if (normalizedScore > config.maxRiskScore) {
    blockers.push(
      `Aggregate risk score: ${normalizedScore.toFixed(1)} (max allowed: ${config.maxRiskScore})`
    );
  }

  // Generate warnings for accepted but notable findings
  const acceptedWithHighEpss = results.filter(
    (r) => config.allowedCves.includes(r.cveId) && r.epssScore > 0.5
  );
  if (acceptedWithHighEpss.length > 0) {
    warnings.push(
      `${acceptedWithHighEpss.length} accepted CVE(s) have high exploitation probability. Review acceptances.`
    );
  }

  return {
    allowed: blockers.length === 0,
    reason: blockers.length === 0
      ? "All risk gates passed"
      : `Deployment blocked: ${blockers.length} gate(s) failed`,
    criticalCount,
    highCount,
    aggregateRiskScore: normalizedScore,
    blockers,
    warnings,
  };
}

// Example: CI/CD pipeline usage
const scanResults: ScanResult[] = [
  {
    cveId: "CVE-2024-1234",
    packageName: "lodash",
    installedVersion: "4.17.20",
    fixedVersion: "4.17.21",
    cvssScore: 7.5,
    epssScore: 0.15,
    isReachable: true,
    isInKev: false,
  },
  {
    cveId: "CVE-2024-5678",
    packageName: "express",
    installedVersion: "4.17.1",
    fixedVersion: "4.18.2",
    cvssScore: 9.8,
    epssScore: 0.82,
    isReachable: true,
    isInKev: true,
  },
];

const gateConfig: RiskGateConfig = {
  maxCriticalCount: 0,
  maxHighCount: 3,
  maxRiskScore: 50,
  blockOnKev: true,
  blockOnUnreachable: false,
  allowedCves: [],
};

const decision = evaluateRiskGate(scanResults, gateConfig);
console.log(`Decision: ${decision.allowed ? "ALLOW" : "BLOCK"}`);
console.log(`Reason: ${decision.reason}`);
decision.blockers.forEach((b) => console.log(`  BLOCKER: ${b}`));
decision.warnings.forEach((w) => console.log(`  WARNING: ${w}`));

// In CI/CD: process.exit(decision.allowed ? 0 : 1);
```

### Risk Scoring in Deployment Pipeline

```python
# deployment_risk_score.py
# Calculate a deployment risk score based on change characteristics

from dataclasses import dataclass
from enum import Enum


class ChangeType(Enum):
    FEATURE = "feature"
    BUGFIX = "bugfix"
    SECURITY_PATCH = "security_patch"
    DEPENDENCY_UPDATE = "dependency_update"
    INFRASTRUCTURE = "infrastructure"
    CONFIGURATION = "configuration"
    ROLLBACK = "rollback"


@dataclass
class DeploymentChange:
    change_type: ChangeType
    files_changed: int
    lines_added: int
    lines_removed: int
    touches_auth: bool
    touches_payment: bool
    touches_pii: bool
    new_dependencies: int
    has_db_migration: bool
    has_security_review: bool
    test_coverage_delta: float    # positive = increased, negative = decreased
    author_familiarity: float     # 0.0-1.0, based on prior commits to these files


def calculate_deployment_risk(change: DeploymentChange) -> dict:
    """Calculate a 0-100 risk score for a deployment."""
    risk_score = 0.0
    factors: list[str] = []

    # Size factor (0-15 points)
    total_changes = change.lines_added + change.lines_removed
    if total_changes > 1000:
        size_score = 15
    elif total_changes > 500:
        size_score = 10
    elif total_changes > 100:
        size_score = 5
    else:
        size_score = 2
    risk_score += size_score
    factors.append(f"Change size: {total_changes} lines (+{size_score})")

    # Sensitive area factors (0-30 points)
    if change.touches_auth:
        risk_score += 15
        factors.append("Touches authentication/authorization (+15)")
    if change.touches_payment:
        risk_score += 15
        factors.append("Touches payment processing (+15)")
    if change.touches_pii:
        risk_score += 10
        factors.append("Touches PII handling (+10)")

    # Dependency risk (0-10 points)
    if change.new_dependencies > 0:
        dep_score = min(change.new_dependencies * 3, 10)
        risk_score += dep_score
        factors.append(f"New dependencies: {change.new_dependencies} (+{dep_score})")

    # Database migration (0-10 points)
    if change.has_db_migration:
        risk_score += 10
        factors.append("Includes database migration (+10)")

    # Security review (reduces risk)
    if change.has_security_review:
        risk_score *= 0.7
        factors.append("Security review completed (x0.7)")

    # Test coverage
    if change.test_coverage_delta < -5:
        risk_score += 10
        factors.append(f"Test coverage decreased by {abs(change.test_coverage_delta):.1f}% (+10)")
    elif change.test_coverage_delta > 5:
        risk_score *= 0.9
        factors.append(f"Test coverage increased by {change.test_coverage_delta:.1f}% (x0.9)")

    # Author familiarity (reduces risk)
    familiarity_factor = 1.0 - (change.author_familiarity * 0.3)
    risk_score *= familiarity_factor
    factors.append(
        f"Author familiarity: {change.author_familiarity:.0%} (x{familiarity_factor:.2f})"
    )

    # Change type modifier
    type_multipliers = {
        ChangeType.ROLLBACK: 0.3,
        ChangeType.SECURITY_PATCH: 0.5,
        ChangeType.BUGFIX: 0.7,
        ChangeType.CONFIGURATION: 0.8,
        ChangeType.DEPENDENCY_UPDATE: 0.9,
        ChangeType.FEATURE: 1.0,
        ChangeType.INFRASTRUCTURE: 1.2,
    }
    type_mult = type_multipliers[change.change_type]
    risk_score *= type_mult
    factors.append(f"Change type: {change.change_type.value} (x{type_mult})")

    risk_score = min(max(risk_score, 0), 100)

    # Determine approval requirements
    if risk_score >= 70:
        approval = "Requires security team + engineering lead approval"
    elif risk_score >= 40:
        approval = "Requires engineering lead approval"
    elif risk_score >= 20:
        approval = "Requires peer review approval"
    else:
        approval = "Standard CI/CD auto-approval"

    return {
        "risk_score": round(risk_score, 1),
        "risk_level": (
            "critical" if risk_score >= 70
            else "high" if risk_score >= 40
            else "medium" if risk_score >= 20
            else "low"
        ),
        "approval_required": approval,
        "factors": factors,
    }


# Example
result = calculate_deployment_risk(DeploymentChange(
    change_type=ChangeType.FEATURE,
    files_changed=12,
    lines_added=450,
    lines_removed=120,
    touches_auth=True,
    touches_payment=False,
    touches_pii=True,
    new_dependencies=2,
    has_db_migration=True,
    has_security_review=True,
    test_coverage_delta=3.2,
    author_familiarity=0.8,
))

print(f"Risk Score: {result['risk_score']}/100 ({result['risk_level']})")
print(f"Approval: {result['approval_required']}")
for factor in result["factors"]:
    print(f"  - {factor}")
```

---

## Best Practices

### Rule 1: Never Use CVSS Score Alone for Prioritization

Combine CVSS with EPSS, exploitation status (CISA KEV), reachability analysis, and business context. A CVSS 10.0 in an unreachable code path is lower priority than a CVSS 7.0 that is actively exploited on an internet-facing service.

### Rule 2: Treat Risk Assessment as a Continuous Process

Risk changes constantly. New vulnerabilities are disclosed daily. Threat landscapes shift. Business priorities evolve. Reassess risk at minimum quarterly, and trigger reassessment on any significant change (new deployment, architecture change, acquisition, new regulation).

### Rule 3: Make Risk Decisions Traceable

Every risk acceptance, treatment choice, and prioritization decision must be documented with reasoning, approver, date, and review schedule. When an incident occurs, you must be able to reconstruct the risk decisions that led to the current state.

### Rule 4: Calibrate Severity Thresholds to Your Organization

Generic severity ratings (Critical/High/Medium/Low) mean nothing without organization-specific definitions of impact. Define impact in terms relevant to your business: revenue loss, customer impact, regulatory exposure, data sensitivity.

### Rule 5: Automate What Can Be Automated, but Do Not Automate Judgment

Automate vulnerability scanning, EPSS lookups, CVSS calculation, SLA tracking, and dashboard generation. Do not automate risk acceptance decisions, business impact assessment, or threat modeling. These require human judgment and organizational context.

### Rule 6: Own Your Risk Register

Assign every risk a single owner. Shared ownership is no ownership. The owner is accountable for tracking the risk, implementing treatment, and reporting status. Ownership does not mean the owner does all the work -- it means they are the single point of accountability.

### Rule 7: Set and Enforce Remediation SLAs

Define clear SLAs by severity level and enforce them. Track SLA compliance as a key security metric. When SLAs are consistently missed, investigate root causes: insufficient resources, poor tooling, unclear ownership, or unrealistic SLAs.

### Rule 8: Communicate Risk in the Language of Your Audience

Developers need CVE IDs and code fixes. Managers need metrics and resource implications. Executives need business impact and trend lines. Never present a list of CVEs to a board member. Never present ALE calculations to a developer.

### Rule 9: Account for Dependency and Supply Chain Risk

First-party code is only part of the attack surface. Evaluate the risk profile of every third-party dependency: maintenance status, CVE history, contributor count, download trends. Use SBOM (Software Bill of Materials) to maintain visibility.

### Rule 10: Validate Assumptions Regularly

Risk assessments are built on assumptions about likelihood, impact, and control effectiveness. Test these assumptions: run tabletop exercises, red team engagements, chaos engineering experiments. An untested risk assessment is an opinion, not an assessment.

---

## Anti-patterns

### Anti-pattern 1: CVSS Score as the Only Priority Signal

**Problem:** Treating every CVSS 9.0+ as a "drop everything" emergency regardless of context.

**Impact:** Alert fatigue, misallocation of resources, actual high-risk items buried in noise.

**Correct approach:** Use the combined prioritization model (CVSS + EPSS + reachability + business context) described in the Vulnerability Prioritization section.

### Anti-pattern 2: Informal Risk Acceptance

**Problem:** Verbally agreeing to accept a risk in a meeting without documentation. "Yeah, we know about that, we will get to it."

**Impact:** No accountability, no review trigger, no audit trail. The risk is forgotten until it becomes an incident.

**Correct approach:** Require a formal risk acceptance form for any risk rated Medium or above. Include expiration date, conditions for revocation, and appropriate approval authority.

### Anti-pattern 3: Compliance-Driven Security

**Problem:** Treating compliance checklists (SOC 2, PCI-DSS) as the definition of "secure." If we pass the audit, we are secure.

**Impact:** False sense of security. Compliance frameworks are baseline requirements, not comprehensive security programs. Many breached organizations were fully compliant at the time of breach.

**Correct approach:** Use compliance as a floor. Build risk-based security practices on top of compliance requirements.

### Anti-pattern 4: Risk Assessment as a One-Time Activity

**Problem:** Performing risk assessment during project kickoff and never revisiting it.

**Impact:** Risk profile drifts as code changes, new vulnerabilities emerge, and business context evolves. Assessment becomes stale within weeks.

**Correct approach:** Integrate risk assessment into CI/CD, review the risk register quarterly, and trigger reassessment on significant changes.

### Anti-pattern 5: Ignoring Residual Risk After Mitigation

**Problem:** Assuming risk is eliminated after applying a control. "We added a WAF, so SQL injection is no longer a risk."

**Impact:** Controls can fail, be misconfigured, or be bypassed. Residual risk always exists.

**Correct approach:** Explicitly quantify and document residual risk after each mitigation. Monitor control effectiveness continuously.

### Anti-pattern 6: Equal Treatment of All Assets

**Problem:** Applying the same security controls and risk tolerance to all systems regardless of their criticality.

**Impact:** Over-investment in low-value systems, under-investment in critical ones. Wasted resources and unmitigated risk where it matters most.

**Correct approach:** Classify assets by criticality. Apply proportional controls and risk tolerance. A development sandbox does not need the same controls as a production payment processing system.

### Anti-pattern 7: Vulnerability Count as a Security Metric

**Problem:** Reporting "we fixed 200 vulnerabilities this quarter" as a measure of security improvement.

**Impact:** Incentivizes fixing easy, low-impact vulnerabilities while ignoring harder, high-impact ones. 200 fixed Low findings matter less than 1 unfixed Critical.

**Correct approach:** Report risk-weighted metrics: risk score reduction, MTTR by severity, SLA compliance, accepted risk expiration tracking.

### Anti-pattern 8: Siloed Risk Assessment

**Problem:** Security team performs risk assessment in isolation without input from development, operations, or business teams.

**Impact:** Assessments miss business context, operational constraints, and development realities. Produces impractical recommendations that get ignored.

**Correct approach:** Risk assessment is a collaborative activity. Include domain experts, asset owners, and stakeholders. Security provides methodology; the organization provides context.

---

## Enforcement Checklist

Use this checklist to verify risk assessment practices in your organization:

### Foundations

- [ ] Risk appetite and tolerance are formally defined and approved by executive leadership
- [ ] Risk terminology (threat, vulnerability, asset, residual risk) is consistently used across teams
- [ ] Risk vs compliance distinction is understood and documented

### Scoring and Prioritization

- [ ] CVSS scores are used alongside EPSS and business context, never in isolation
- [ ] EPSS data is integrated into vulnerability management workflow
- [ ] SSVC or equivalent decision-tree approach is used for triage
- [ ] Reachability analysis is performed for vulnerability findings
- [ ] CISA KEV catalog is monitored and integrated into prioritization

### Process

- [ ] Risk register exists, is maintained, and is reviewed at minimum quarterly
- [ ] Every risk has a single assigned owner
- [ ] Risk treatment decisions (mitigate, accept, transfer, avoid) are documented for each risk
- [ ] Risk acceptance has formal process with appropriate authority levels and expiration dates
- [ ] Remediation SLAs are defined, communicated, and tracked
- [ ] SLA compliance is reported as a key security metric

### Software Development Integration

- [ ] Security scanning (SAST, SCA) runs in CI/CD pipeline
- [ ] Vulnerability gates are configured in deployment pipeline
- [ ] Risk-based testing allocation is practiced (more testing for higher-risk components)
- [ ] Security-focused code review is required for changes to sensitive components
- [ ] Security debt is tracked alongside technical debt
- [ ] SBOM is generated for every release

### Communication and Reporting

- [ ] Risk dashboards exist with appropriate views for different audiences
- [ ] Executive risk reports are produced at minimum quarterly
- [ ] MTTR, SLA compliance, and risk trend metrics are tracked
- [ ] Risk communication uses audience-appropriate language and metrics

### Continuous Improvement

- [ ] Risk assessment assumptions are validated through exercises (tabletop, red team)
- [ ] Risk assessment methodology is reviewed and updated annually
- [ ] Lessons from incidents are incorporated back into risk assessments
- [ ] Third-party and supply chain risks are evaluated alongside first-party risks
- [ ] Automated vulnerability monitoring runs continuously in production

---

## References

- [NIST SP 800-30: Guide for Conducting Risk Assessments](https://csrc.nist.gov/publications/detail/sp/800-30/rev-1/final)
- [NIST Cybersecurity Framework (CSF)](https://www.nist.gov/cyberframework)
- [FIRST CVSS v3.1 Specification](https://www.first.org/cvss/v3.1/specification-document)
- [FIRST CVSS v4.0 Specification](https://www.first.org/cvss/v4.0/specification-document)
- [FIRST EPSS Model](https://www.first.org/epss/)
- [CISA SSVC Guide](https://www.cisa.gov/stakeholder-specific-vulnerability-categorization-ssvc)
- [CISA Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
- [FAIR Institute -- Factor Analysis of Information Risk](https://www.fairinstitute.org/)
- [ISO 27005: Information Security Risk Management](https://www.iso.org/standard/80585.html)
- [OWASP Risk Rating Methodology](https://owasp.org/www-community/OWASP_Risk_Rating_Methodology)
