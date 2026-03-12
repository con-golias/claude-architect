# WCAG Compliance and Legal Requirements

| Property       | Value                                                                |
|---------------|----------------------------------------------------------------------|
| Domain        | Accessibility > Compliance                                           |
| Importance    | High                                                                 |
| Audience      | All engineers, product managers, legal teams                         |
| Cross-ref     | [05-frontend accessibility](../../05-frontend/web/component-design/accessibility.md), [11-testing a11y testing](../../11-testing/advanced-testing/accessibility-testing.md) |

---

## WCAG 2.2 Conformance Levels

### Level A — Minimum Baseline

Level A criteria prevent the most severe barriers. Failure means content is completely unusable for some users.

| Criterion | Summary |
|-----------|---------|
| 1.1.1 Non-text Content | Provide text alternatives for images, icons, controls |
| 1.2.1 Audio/Video Only | Provide transcript or audio description |
| 1.3.1 Info and Relationships | Use semantic HTML to convey structure |
| 1.3.2 Meaningful Sequence | Reading order matches visual order |
| 1.3.3 Sensory Characteristics | Do not rely solely on shape, size, color, or sound |
| 2.1.1 Keyboard | All functionality available via keyboard |
| 2.1.2 No Keyboard Trap | User can navigate away from any component |
| 2.1.4 Character Key Shortcuts | Allow remapping or disabling single-key shortcuts |
| 2.4.1 Bypass Blocks | Provide skip navigation links |
| 2.4.2 Page Titled | Descriptive, unique page titles |
| 2.5.1 Pointer Gestures | Provide single-pointer alternatives for multipoint gestures |
| 2.5.2 Pointer Cancellation | Use `mouseup`/`keyup`, not `mousedown`/`keydown` |
| 3.1.1 Language of Page | Declare `lang` attribute on `<html>` |
| 3.3.1 Error Identification | Identify and describe input errors in text |
| 3.3.2 Labels or Instructions | Provide labels for all form inputs |
| 4.1.2 Name, Role, Value | Use ARIA when native semantics are insufficient |

### Level AA — Industry Standard Target

Level AA is the **legal requirement** in most jurisdictions. Target AA for all public-facing products.

| Criterion | Summary |
|-----------|---------|
| 1.3.4 Orientation | Do not restrict display to single orientation |
| 1.3.5 Identify Input Purpose | Use `autocomplete` attributes on personal data fields |
| 1.4.3 Contrast (Minimum) | 4.5:1 for text, 3:1 for large text |
| 1.4.4 Resize Text | Content usable at 200% zoom |
| 1.4.5 Images of Text | Use real text, not images of text |
| 1.4.10 Reflow | No horizontal scroll at 320px viewport width |
| 1.4.11 Non-text Contrast | 3:1 contrast for UI components and graphics |
| 1.4.12 Text Spacing | Content readable with custom spacing |
| 1.4.13 Content on Hover/Focus | Dismissible, hoverable, persistent |
| 2.4.5 Multiple Ways | Provide at least two ways to find pages |
| 2.4.6 Headings and Labels | Descriptive headings and labels |
| 2.4.7 Focus Visible | Keyboard focus indicator is visible |
| 2.4.11 Focus Not Obscured (Min) | Focused element not entirely hidden (NEW in 2.2) |
| 2.5.7 Dragging Movements | Provide non-dragging alternative (NEW in 2.2) |
| 2.5.8 Target Size (Minimum) | 24x24px minimum target, or sufficient spacing (NEW in 2.2) |
| 3.2.3 Consistent Navigation | Navigation order consistent across pages |
| 3.2.4 Consistent Identification | Same function = same label |
| 3.2.6 Consistent Help | Help mechanisms in consistent location (NEW in 2.2) |
| 3.3.7 Redundant Entry | Do not require re-entering already-provided info (NEW in 2.2) |
| 3.3.8 Accessible Authentication (Min) | No cognitive function test for login (NEW in 2.2) |

### Level AAA — Enhanced (Selective Adoption)

Do not target full AAA conformance. Adopt individual AAA criteria where they provide clear user benefit.

Notable AAA criteria worth adopting selectively:
- **1.4.6** Enhanced contrast (7:1 / 4.5:1)
- **2.4.12** Focus Not Obscured (Enhanced) — focused element fully visible
- **3.1.5** Reading level — provide simplified version for complex text
- **3.3.9** Accessible Authentication (Enhanced) — no object or image recognition

---

## Legal Landscape

### ADA Title III — United States

- Web accessibility lawsuits exceeded **4,000 per year** since 2021
- No explicit web regulation, but courts consistently rule websites as "places of public accommodation"
- DOJ confirmed in 2022 that WCAG 2.1 AA is the expected standard
- Key cases: *Robles v. Domino's Pizza* (2019), *Gil v. Winn-Dixie* (reversed 2021, but trend continues)
- **Risk**: Demand letters and lawsuits target companies of all sizes

### European Accessibility Act (EAA) — EU

- **Enforcement date: June 28, 2025**
- Applies to private sector products and services sold in the EU
- Covers: e-commerce, banking, transport, e-books, operating systems
- References **EN 301 549** (harmonized standard mapping to WCAG 2.1 AA)
- Penalties vary by member state; includes fines and market withdrawal

### Section 508 — US Government

- Applies to all federal agencies and their contractors
- Refreshed in 2017 to incorporate WCAG 2.0 AA
- **Any software sold to US government must meet Section 508**
- Requires VPAT documentation (see below)

### EN 301 549 — EU Standard

- Harmonized European standard for ICT accessibility
- Maps directly to WCAG 2.1 AA for web content
- Additional requirements for software, hardware, and documentation
- Required for public procurement in EU member states

### AODA — Canada (Ontario)

- Accessibility for Ontarians with Disabilities Act
- Organizations with 50+ employees must comply with WCAG 2.0 AA
- Applies to both public and private sector

---

## VPAT and Accessibility Conformance Reports

### What Is a VPAT/ACR?

A **Voluntary Product Accessibility Template (VPAT)** produces an **Accessibility Conformance Report (ACR)** — a document declaring how a product meets accessibility standards.

```markdown
## VPAT Structure
1. Product description and evaluation methods used
2. Table of applicable standards (WCAG 2.2, Section 508, EN 301 549)
3. Per-criterion conformance level:
   - Supports: Fully meets the criterion
   - Partially Supports: Some functionality meets, some does not
   - Does Not Support: Does not meet
   - Not Applicable: Criterion does not apply
4. Remarks and explanations for each criterion
```

### OpenACR Project

- Open-source VPAT format by GSA (US General Services Administration)
- Machine-readable YAML/JSON format for ACRs
- Enables automated comparison of vendor accessibility claims
- Repository: [github.com/GSA/openacr](https://github.com/GSA/openacr)

---

## Accessibility Audit Process

### Phase 1: Automated Scanning

Run automated tools to catch the ~30-40% of issues detectable by machines.

```bash
# CI pipeline automated scan
npx axe-core --exit-code 1 --tags wcag2aa https://app.example.com
npx pa11y-ci --config .pa11yci.json
```

### Phase 2: Manual Testing

Test the remaining ~60-70% that requires human judgment.

| Test | Method |
|------|--------|
| Keyboard navigation | Tab through entire flow, verify focus order |
| Screen reader | Test with NVDA (Windows), VoiceOver (macOS/iOS), TalkBack (Android) |
| Zoom and reflow | 200% zoom, 320px viewport, text spacing overrides |
| Color and contrast | Check with simulated color blindness |
| Content structure | Verify heading hierarchy, landmark regions |
| Dynamic content | Test live regions, error messages, route changes |

### Phase 3: Assistive Technology Testing

Test with real assistive technology on real devices.

| AT + Browser | Priority |
|-------------|----------|
| NVDA + Firefox (Windows) | P0 |
| JAWS + Chrome (Windows) | P0 |
| VoiceOver + Safari (macOS) | P0 |
| VoiceOver + Safari (iOS) | P1 |
| TalkBack + Chrome (Android) | P1 |

### Phase 4: Remediation

Prioritize by severity and user impact (see next section).

---

## Remediation Roadmap

### Priority Framework

| Priority | Category | Examples | Timeline |
|----------|----------|----------|----------|
| **P0 — Blocker** | Prevents task completion | Keyboard traps, missing form labels preventing submission, inaccessible authentication | Immediate (1-2 weeks) |
| **P1 — Critical** | Severely degrades experience | Missing alt text on functional images, no skip links, broken focus management | Sprint (2-4 weeks) |
| **P2 — Major** | Significant barrier | Color contrast failures, missing error identification, no focus indicator | Quarter (1-3 months) |
| **P3 — Minor** | Reduced quality | Decorative image alt text, redundant ARIA, minor heading order issues | Backlog (3-6 months) |

### Remediation Tracking

```typescript
interface AccessibilityIssue {
  id: string;
  wcagCriterion: string;      // e.g., "1.4.3"
  conformanceLevel: "A" | "AA" | "AAA";
  priority: "P0" | "P1" | "P2" | "P3";
  component: string;
  description: string;
  stepsToReproduce: string;
  affectedUsers: string[];     // e.g., ["screen-reader", "keyboard-only"]
  remediation: string;
  status: "open" | "in-progress" | "resolved" | "wont-fix";
  resolvedDate?: Date;
}
```

---

## Compliance Monitoring

### CI Integration

```yaml
# .github/workflows/a11y.yml
accessibility-check:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: npm ci && npm run build
    - name: Run axe-core scan
      run: npx @axe-core/cli --exit-code 1 --tags wcag2aa $DEPLOY_URL
    - name: Run pa11y
      run: npx pa11y-ci --config .pa11yci.json
    - name: Lighthouse accessibility audit
      uses: treosh/lighthouse-ci-action@v11
      with:
        configPath: .lighthouserc.json
```

### Periodic Audit Schedule

| Frequency | Activity |
|-----------|----------|
| Every commit | Automated axe-core scan in CI |
| Monthly | Manual spot-check of new features |
| Quarterly | Full manual audit of critical user flows |
| Annually | Third-party professional audit with VPAT update |

### User Feedback Channels

- Dedicated accessibility feedback email or form
- Bug tracker label/tag for accessibility issues
- User testing sessions with people with disabilities

---

## Accessibility Statement

Include on every public website. Required by EU directive and recommended globally.

```markdown
## Accessibility Statement Template

### Commitment
[Organization] is committed to ensuring digital accessibility for people
with disabilities. We continually improve the user experience and apply
relevant accessibility standards.

### Standards
This website conforms to WCAG 2.2 Level AA. We test with automated tools
and assistive technologies including screen readers.

### Known Limitations
- [List any known non-conformances with timeline for resolution]

### Feedback
Contact us at accessibility@example.com to report accessibility barriers.
We aim to respond within 5 business days.

### Enforcement (EU)
If you are not satisfied with our response, you may contact
[national enforcement body].

### Last Updated
[Date of most recent audit or update]
```

---

## Organizational Maturity Model

| Level | Name | Characteristics |
|-------|------|-----------------|
| 1 | **Reactive** | Fix issues only when reported or sued. No process. No training. |
| 2 | **Compliant** | Meet minimum legal requirements. Annual audits. VPAT exists. |
| 3 | **Proactive** | Accessibility in design process. CI testing. Training for engineers. |
| 4 | **Embedded** | Accessibility is a core value. Disability inclusion in hiring. Users with disabilities in research. Accessibility champions in every team. |

### Business Case

- **Market size**: 1.3 billion people with disabilities worldwide (16% of population)
- **Legal risk**: 4,000+ ADA lawsuits/year; EAA enforcement from 2025
- **SEO benefit**: Semantic HTML, alt text, and headings improve search ranking
- **Innovation**: Curb-cut effect — accessibility features benefit all users (captions, voice control, dark mode)
- **Revenue**: The disability community and allies represent $13 trillion in disposable income globally

---

## Best Practices

1. **Target WCAG 2.2 Level AA** as the minimum conformance level for all public-facing products and internal tools.
2. **Integrate automated accessibility scanning into CI/CD** pipelines to catch regressions on every commit.
3. **Conduct quarterly manual audits** covering keyboard navigation, screen reader testing, and zoom/reflow verification.
4. **Maintain a current VPAT/ACR** and update it after every major release or annual audit cycle.
5. **Publish an accessibility statement** on every public-facing website with contact information and known limitations.
6. **Prioritize remediation by user impact** — fix keyboard traps and blocking issues before cosmetic contrast adjustments.
7. **Test with real assistive technologies** — automated tools catch only 30-40% of accessibility issues.
8. **Train all engineers on accessibility fundamentals** during onboarding and provide annual refresher training.
9. **Include people with disabilities in user research** to validate that solutions work in practice, not just in theory.
10. **Track accessibility metrics** (open issues by priority, mean time to remediate, audit scores) and report to leadership quarterly.

---

## Anti-Patterns

| # | Anti-Pattern | Problem | Correct Approach |
|---|-------------|---------|------------------|
| 1 | Accessibility overlay widgets | Overlays do not fix underlying issues; they add a separate broken interface and create legal risk | Fix source code directly with proper semantics and ARIA |
| 2 | "We will fix it later" deferral | Technical debt compounds; retrofitting is 10x more expensive than building accessibly | Include accessibility in Definition of Done for every story |
| 3 | Relying solely on automated testing | Automated tools detect only 30-40% of issues; false sense of compliance | Combine automated scanning with manual and assistive technology testing |
| 4 | Treating VPAT as a one-time document | Products change; stale VPATs misrepresent conformance to customers | Update VPAT after every major release and annual audit |
| 5 | Targeting Level AAA conformance | AAA is intentionally aspirational; mandating it stalls real progress | Target AA fully; adopt individual AAA criteria where practical |
| 6 | Separate "accessible version" of site | Maintaining two versions is unsustainable and inherently unequal | Build one inclusive version that works for everyone |
| 7 | Ignoring mobile accessibility | Mobile users with disabilities face unique barriers (gestures, small targets) | Apply WCAG to all platforms including native mobile apps |
| 8 | No accessibility feedback mechanism | Users cannot report barriers; issues remain invisible | Provide accessible feedback channel and triage reported issues promptly |

---

## Enforcement Checklist

- [ ] WCAG 2.2 AA conformance verified by automated scan and manual audit
- [ ] Accessibility statement published with contact info and known limitations
- [ ] VPAT/ACR created or updated within last 12 months
- [ ] CI pipeline includes axe-core or equivalent with WCAG 2.2 AA ruleset
- [ ] Quarterly manual audit scheduled and tracked
- [ ] P0 and P1 accessibility issues resolved within SLA (2 weeks / 4 weeks)
- [ ] Assistive technology testing performed on NVDA, JAWS, VoiceOver, TalkBack
- [ ] Engineering team completed accessibility training within last 12 months
- [ ] Legal compliance reviewed for applicable jurisdictions (ADA, EAA, Section 508, AODA)
- [ ] Accessibility metrics tracked and reported to leadership quarterly
