# Acceptance Criteria & Definition of Done

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Requirements |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [User Stories](user-stories.md), [BDD](../../11-testing/testing-philosophy/bdd.md) |

---

## Core Concepts

### What Are Acceptance Criteria

Acceptance criteria (AC) are the specific conditions a user story must satisfy to be
accepted by the product owner. They define the boundary between "done" and "not done"
and serve as the contract between product and engineering.

**Purpose:**
- Remove ambiguity from user stories
- Provide a basis for test case design
- Enable the product owner to verify the story is complete
- Prevent scope creep by making boundaries explicit

### Acceptance Criteria Formats

#### 1. Given/When/Then (Gherkin)

The most structured format. Use it for behavior-driven stories where the flow matters.

```gherkin
Feature: Password Reset

  Scenario: Successful password reset via email
    Given a registered user with email "user@example.com"
    And the user is on the login page
    When the user clicks "Forgot password"
    And enters their email address
    And clicks "Send reset link"
    Then an email with a reset link is sent within 60 seconds
    And the reset link expires after 24 hours

  Scenario: Password reset with invalid email
    Given a visitor on the login page
    When the user enters an unregistered email
    And clicks "Send reset link"
    Then the system displays "If an account exists, a reset link has been sent"
    And no email is sent
    And the response time is identical to the success case
```

**When to use:** Complex workflows, multi-step processes, scenarios where preconditions
matter, stories destined for BDD automation.

#### 2. Checklist Style

A simple list of conditions that must all be true. Use for simpler stories.

```markdown
### AC for: User Profile Edit
- [ ] User can update display name (2-50 characters)
- [ ] User can upload avatar (JPG/PNG, max 5MB, min 200x200px)
- [ ] User can change email (requires re-verification)
- [ ] Changes are saved only when "Save" is clicked
- [ ] Unsaved changes trigger a confirmation dialog on navigation
- [ ] Success toast appears after save completes
- [ ] Validation errors appear inline next to the relevant field
```

**When to use:** CRUD operations, configuration screens, straightforward features.

#### 3. Rules-Based

Express business rules as declarative statements. Use for stories governed by complex
business logic.

```markdown
### AC for: Discount Calculation
**Rules:**
1. Orders over $100 receive 10% discount
2. Orders over $250 receive 15% discount
3. Loyalty members receive an additional 5% on top of order discount
4. Maximum total discount is capped at 25%
5. Discounts apply to product subtotal, not shipping or tax
6. Discount is calculated before tax is applied

**Boundary cases:**
- Order of exactly $100.00 receives the 10% discount
- Order of $99.99 receives no discount
- Loyalty + $250 order = 20% discount (15% + 5%), not 25%
```

**When to use:** Pricing, permissions, eligibility rules, regulatory compliance logic.

---

## Writing Effective Acceptance Criteria

### The SMART-AC Framework

Apply these five qualities to every acceptance criterion:

| Quality | Test | Bad Example | Good Example |
|---------|------|-------------|--------------|
| **Specific** | Does it describe one concrete behavior? | "System is user-friendly" | "Error message appears below the input field within 100ms" |
| **Measurable** | Can you verify pass/fail objectively? | "Page loads quickly" | "Page loads within 2 seconds on 3G connection" |
| **Achievable** | Is it technically feasible in one sprint? | "Support all world languages" | "Support English, Spanish, and French" |
| **Relevant** | Does it connect to the story's value? | "Database uses B-tree indexes" | "Search results return within 500ms" |
| **Testable** | Can you write an automated test for it? | "Users feel confident" | "Confirmation dialog shows order total and item count before payment" |

### How Many Criteria Per Story

- **Minimum:** 2 criteria (happy path + one edge case)
- **Ideal:** 3-5 criteria
- **Maximum:** 8 criteria (if more, the story is too large -- split it)

### Writing Negative Criteria

Always include at least one criterion that defines what the system must NOT do.

```gherkin
Scenario: Prevent brute-force login attempts
  Given a user has failed login 5 times in 10 minutes
  When the user attempts a 6th login
  Then the account is locked for 30 minutes
  And the lockout message does not reveal whether the email exists
```

---

## Definition of Done (DoD)

The Definition of Done is a team-wide agreement on what "done" means for any story.
It is broader than acceptance criteria -- AC are story-specific, DoD applies to all stories.

### Team-Level DoD

```markdown
## Definition of Done (Team Level)
A story is "done" when ALL of the following are true:

### Code Quality
- [ ] Code reviewed and approved by at least one peer
- [ ] No new linting warnings or errors introduced
- [ ] All existing tests pass in CI
- [ ] New code covered by unit tests (minimum 80% branch coverage)

### Testing
- [ ] Acceptance criteria verified with automated tests
- [ ] Integration tests pass against staging environment
- [ ] Manual exploratory testing completed for UI changes
- [ ] Accessibility checks pass (axe-core, keyboard navigation)

### Documentation
- [ ] API documentation updated (OpenAPI spec for new endpoints)
- [ ] README updated if setup steps changed
- [ ] Architecture decision recorded if significant choice was made

### Deployment
- [ ] Feature deployed to staging environment
- [ ] No regression in error rates or latency (compared to baseline)
- [ ] Feature flag configured (if applicable)
- [ ] Monitoring and alerts configured for new endpoints/services
```

### Sprint-Level DoD

Extends the team DoD with sprint-specific completeness checks.

```markdown
## Sprint-Level Done
- [ ] All stories in the sprint meet team-level DoD
- [ ] Sprint demo prepared and delivered to stakeholders
- [ ] Sprint retrospective action items from last sprint addressed
- [ ] Release notes drafted for completed stories
- [ ] Product owner has accepted all completed stories
```

### Release-Level DoD

Extends sprint DoD with release-readiness checks.

```markdown
## Release-Level Done
- [ ] All sprint-level DoD criteria met
- [ ] Performance testing completed against production-like environment
- [ ] Security scan (SAST + dependency check) passes with no critical findings
- [ ] Load testing confirms system handles expected peak traffic
- [ ] Rollback plan documented and tested
- [ ] Customer-facing documentation published
- [ ] Support team briefed on new features and known issues
- [ ] Compliance review completed (if applicable)
```

---

## Definition of Ready (DoR)

The Definition of Ready defines when a story is ready for sprint planning.

```markdown
## Definition of Ready
A story is "ready" when ALL of the following are true:

- [ ] User story follows "As a / I want / So that" format
- [ ] Acceptance criteria written (2-5, in Given/When/Then or checklist format)
- [ ] Story passes all INVEST criteria
- [ ] Dependencies identified and resolved (or explicitly scheduled)
- [ ] UX mockups attached and reviewed by engineering (if UI change)
- [ ] Technical approach discussed in refinement session
- [ ] Story estimated by the team
- [ ] Product owner has prioritized it in the backlog
```

**Warning:** Do not make the DoR so strict that it becomes a bottleneck. A story needs
enough clarity to start, not a complete specification. Conversation continues during
the sprint.

---

## Connecting AC to Automated Tests

### BDD with Cucumber and Gherkin

Write acceptance criteria in Gherkin, then automate them directly.

```gherkin
# features/checkout.feature
Feature: Checkout process

  Scenario: Successful checkout with valid credit card
    Given a customer with items in their cart totaling $49.99
    And the customer has entered valid shipping information
    When the customer submits payment with a valid credit card
    Then the order is created with status "confirmed"
    And the customer receives a confirmation email within 60 seconds
    And inventory is decremented for each purchased item
```

```typescript
// steps/checkout.steps.ts (Cucumber.js)
import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "chai";

Given("a customer with items in their cart totaling ${float}", async function (total: number) {
  this.cart = await createCartWithTotal(total);
  this.customer = await createTestCustomer();
});

When("the customer submits payment with a valid credit card", async function () {
  this.order = await checkout(this.customer.id, { paymentMethod: "test_card_success" });
});

Then("the order is created with status {string}", async function (status: string) {
  expect(this.order.status).to.equal(status);
});
```

### BDD with Playwright

Use Playwright's test runner for end-to-end acceptance tests.

```typescript
import { test, expect } from "@playwright/test";

test("successful checkout with valid credit card", async ({ page }) => {
  // Given: customer with items in cart
  await page.goto("/products");
  await page.click('[data-testid="add-to-cart-1"]');

  // When: customer completes checkout
  await page.click('[data-testid="checkout-button"]');
  await page.fill('[data-testid="card-number"]', "4242424242424242");
  await page.click('[data-testid="submit-payment"]');

  // Then: order confirmation displayed
  await expect(page.locator('[data-testid="order-status"]')).toHaveText("Confirmed");
});
```

---

## Domain-Specific AC Examples

### CRUD Operations

```gherkin
Scenario: Create a new project
  Given an authenticated user with "project_admin" role
  When the user submits a project with name "Apollo" and description "Moon landing"
  Then the project is created with a unique ID
  And the creating user is assigned as project owner
  And the project appears in the user's project list
  And an audit log entry records the creation event

Scenario: Prevent duplicate project names within organization
  Given an organization with an existing project named "Apollo"
  When a user creates a new project named "Apollo"
  Then the system rejects the request with error "Project name already exists"
  And no project is created
```

### Payment Processing

```gherkin
Scenario: Payment with insufficient funds
  Given a customer with a valid cart totaling $150.00
  When the customer submits payment with a card that has insufficient funds
  Then the payment is declined with reason "insufficient_funds"
  And the order remains in "pending_payment" status
  And the customer sees "Payment declined. Please try another card."
  And the cart items remain reserved for 15 minutes
```

### Authentication

```gherkin
Scenario: Login with valid credentials
  Given a registered user with verified email
  When the user submits correct email and password
  Then the user receives an access token (15 min) and refresh token (7 days)
  And the user is redirected to the dashboard

Scenario: Login with MFA enabled
  Given a registered user with TOTP-based MFA enabled
  When the user submits correct email and password
  Then the user is prompted for a 6-digit TOTP code
  And the access token is not issued until the code is verified
```

---

## 10 Best Practices

1. **Write acceptance criteria before development starts.** AC define the scope of work.
   Writing them during or after development leads to scope creep and missed requirements.

2. **Use Given/When/Then for workflow stories.** The structured format forces explicit
   preconditions, actions, and expected outcomes. Use checklist format for simpler CRUD.

3. **Include at least one negative scenario.** Define what the system must NOT do. Invalid
   inputs, unauthorized access, and error conditions are as important as happy paths.

4. **Keep each criterion independently testable.** Every AC should map to at least one test
   case. If you cannot write a test, the criterion is too vague.

5. **Cap criteria at 5-8 per story.** More than 8 criteria indicates the story is too large.
   Split the story and distribute criteria across the resulting stories.

6. **Make the Definition of Done visible.** Post the DoD in the team's workspace (physical
   or virtual). Review it quarterly and update when the team's maturity evolves.

7. **Separate DoD from acceptance criteria.** DoD applies to every story (code review,
   tests pass, deployed). AC are specific to one story. Never mix them.

8. **Automate AC verification from day one.** Write Gherkin scenarios that become automated
   tests. Manual-only verification does not scale and rots quickly.

9. **Review AC in refinement, not sprint planning.** Sprint planning is for commitment and
   task breakdown. AC should already be written and reviewed in the refinement session.

10. **Version-control acceptance criteria.** Store Gherkin feature files alongside code.
    When AC change, the diff is visible in pull requests and linked to the story.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Vague criteria** ("system works correctly") | Cannot verify done, disputes at demo | Rewrite with specific, measurable conditions |
| **Too many criteria** (15+ per story) | Story is actually an epic in disguise | Split the story; redistribute criteria |
| **Implementation-prescriptive AC** | Constrains engineering solutions | Focus on observable behavior, not technical approach |
| **Missing edge cases** | Bugs discovered after release | Add negative scenarios and boundary conditions |
| **AC written by developer alone** | Product intent not captured | PM writes AC, reviewed by engineering in refinement |
| **No DoD, only AC** | "Done" means different things to different people | Establish team DoD as baseline for every story |
| **DoD never updated** | Team outgrows stale practices, quality drifts | Review DoD at every retrospective, update quarterly |
| **Manual-only verification** | Testing bottleneck, regression risk | Automate AC as BDD tests; keep manual for exploratory only |

---

## Enforcement Checklist

- [ ] Every story has 2-8 acceptance criteria before entering a sprint
- [ ] AC format is consistent across the team (Given/When/Then or checklist)
- [ ] At least one negative / error scenario per story
- [ ] Team-level Definition of Done documented and visible to all members
- [ ] Sprint-level and release-level DoD defined and reviewed quarterly
- [ ] Definition of Ready applied as gate before sprint planning
- [ ] AC automated as BDD tests (Cucumber/Playwright) for critical workflows
- [ ] AC reviewed in refinement by PM, design, and engineering together
- [ ] DoD compliance verified in sprint review before accepting stories
- [ ] Feature files (Gherkin) stored in version control alongside source code
