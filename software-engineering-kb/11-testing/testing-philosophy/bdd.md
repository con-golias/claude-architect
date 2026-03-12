# Behavior-Driven Development

| Attribute      | Value                                                        |
|---------------|--------------------------------------------------------------|
| Domain        | Testing > Philosophy                                         |
| Importance    | High                                                         |
| Last Updated  | 2026-03-10                                                   |
| Cross-ref     | [TDD](tdd.md), [What to Test](what-to-test.md), [Testing Pyramid](testing-pyramid.md) |

---

## Core Concepts

### What BDD Is

Behavior-Driven Development is a collaborative practice that bridges communication
between developers, QA engineers, and product stakeholders. Specify system behavior
in plain language using structured scenarios, then automate those scenarios as
executable tests.

BDD is NOT a testing framework. It is a communication framework that produces
living documentation and executable specifications.

### Given / When / Then Structure

Every BDD scenario follows a three-part structure:

```
Given  [a precondition or initial context]
When   [an action or event occurs]
Then   [an expected outcome is observed]
And    [additional conditions or outcomes]
But    [exceptions to expected outcomes]
```

**Example:**

```gherkin
Feature: Shopping Cart Checkout

  Scenario: Successful checkout with valid payment
    Given a customer has 2 items in the cart totaling $50.00
    And the customer has a valid credit card on file
    When the customer initiates checkout
    Then the order is created with status "confirmed"
    And the payment is charged $50.00
    And a confirmation email is sent to the customer
```

### The Three Amigos

BDD requires a collaborative specification workshop with three perspectives:

| Role       | Contribution                                   |
|------------|-----------------------------------------------|
| Product    | Defines desired behavior and acceptance criteria |
| Developer  | Identifies technical constraints and edge cases  |
| QA         | Explores failure modes and boundary conditions   |

Run Three Amigos sessions before implementation begins. Produce feature files
as the output artifact. Time-box to 30 minutes per feature.

### BDD vs TDD: Complementary Approaches

| Aspect        | TDD                             | BDD                                  |
|---------------|--------------------------------|--------------------------------------|
| Audience      | Developers                     | Developers + Product + QA            |
| Language      | Code (test framework)          | Gherkin (natural language)           |
| Granularity   | Function/class level           | Feature/scenario level               |
| Purpose       | Drive internal design          | Specify external behavior            |
| Artifacts     | Unit tests                     | Feature files + step definitions     |

Use BDD at the feature level to specify _what_ the system does.
Use TDD at the code level to drive _how_ the system implements it.

### When BDD Adds Value vs. Unnecessary Ceremony

**High value:**
- Products with complex business rules requiring stakeholder validation
- Regulated domains where requirements traceability matters
- Teams with communication gaps between developers and product
- Systems with complex user workflows

**Low value / Avoid:**
- Internal developer tools with a single-person team
- Pure infrastructure or DevOps automation
- Rapid prototyping and throw-away experiments
- APIs consumed only by other developers (use contract tests instead)

---

## Code Examples

### TypeScript: Cucumber.js with Step Definitions

**Feature file:**

```gherkin
# features/user-registration.feature
Feature: User Registration

  Background:
    Given the registration system is available

  Scenario: Successful registration with valid data
    Given a new user with email "alice@example.com"
    And the user provides password "Str0ng!Pass"
    When the user submits the registration form
    Then the account is created successfully
    And a welcome email is sent to "alice@example.com"

  Scenario: Registration fails with duplicate email
    Given a user already exists with email "bob@example.com"
    And a new user with email "bob@example.com"
    When the user submits the registration form
    Then the registration is rejected with error "Email already registered"

  Scenario Outline: Registration fails with weak password
    Given a new user with email "user@example.com"
    And the user provides password "<password>"
    When the user submits the registration form
    Then the registration is rejected with error "Password too weak"

    Examples:
      | password  |
      | short     |
      | nodigits  |
      | 12345678  |
```

**Step definitions:**

```typescript
// features/steps/registration.steps.ts
import { Given, When, Then, Before } from '@cucumber/cucumber';
import { expect } from 'chai';
import { RegistrationService } from '../../src/registration-service';
import { InMemoryUserRepository } from '../../test/fakes/in-memory-user-repo';
import { FakeEmailSender } from '../../test/fakes/fake-email-sender';

interface World {
  service: RegistrationService;
  repo: InMemoryUserRepository;
  emailSender: FakeEmailSender;
  email: string;
  password: string;
  result: { success: boolean; error?: string };
}

Before(function (this: World) {
  this.repo = new InMemoryUserRepository();
  this.emailSender = new FakeEmailSender();
  this.service = new RegistrationService(this.repo, this.emailSender);
});

Given('the registration system is available', function (this: World) {
  // No-op: system is always available in test context
});

Given('a new user with email {string}', function (this: World, email: string) {
  this.email = email;
});

Given('the user provides password {string}', function (this: World, password: string) {
  this.password = password;
});

Given('a user already exists with email {string}', async function (this: World, email: string) {
  await this.repo.save({ email, passwordHash: 'existing-hash', createdAt: new Date() });
});

When('the user submits the registration form', async function (this: World) {
  this.result = await this.service.register({
    email: this.email,
    password: this.password,
  });
});

Then('the account is created successfully', function (this: World) {
  expect(this.result.success).to.be.true;
});

Then('a welcome email is sent to {string}', function (this: World, email: string) {
  const sent = this.emailSender.sentEmails;
  expect(sent).to.have.length(1);
  expect(sent[0].to).to.equal(email);
  expect(sent[0].subject).to.include('Welcome');
});

Then(
  'the registration is rejected with error {string}',
  function (this: World, expectedError: string) {
    expect(this.result.success).to.be.false;
    expect(this.result.error).to.equal(expectedError);
  },
);
```

**Cucumber configuration:**

```typescript
// cucumber.js
module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['features/steps/**/*.steps.ts'],
    format: ['progress-bar', 'html:reports/cucumber.html'],
    paths: ['features/**/*.feature'],
  },
};
```

### Python: Behave with Step Implementations

**Feature file:**

```gherkin
# features/order_processing.feature
Feature: Order Processing

  Scenario: Order is fulfilled when all items are in stock
    Given the following items are in stock:
      | sku       | quantity |
      | WIDGET-A  | 50       |
      | GADGET-B  | 30       |
    And a customer places an order for:
      | sku       | quantity |
      | WIDGET-A  | 2        |
      | GADGET-B  | 1        |
    When the order is processed
    Then the order status is "fulfilled"
    And inventory for "WIDGET-A" is reduced to 48
    And inventory for "GADGET-B" is reduced to 29

  Scenario: Order is backordered when stock is insufficient
    Given the following items are in stock:
      | sku       | quantity |
      | WIDGET-A  | 1        |
    And a customer places an order for:
      | sku       | quantity |
      | WIDGET-A  | 5        |
    When the order is processed
    Then the order status is "backordered"
    And inventory for "WIDGET-A" remains at 1
```

**Step implementations:**

```python
# features/steps/order_processing_steps.py
from behave import given, when, then
from order_service import OrderService, OrderItem
from inventory import InMemoryInventory


@given("the following items are in stock")
def step_items_in_stock(context):
    context.inventory = InMemoryInventory()
    for row in context.table:
        context.inventory.set_stock(row["sku"], int(row["quantity"]))


@given("a customer places an order for")
def step_customer_places_order(context):
    context.order_items = [
        OrderItem(sku=row["sku"], quantity=int(row["quantity"]))
        for row in context.table
    ]


@when("the order is processed")
def step_order_processed(context):
    service = OrderService(inventory=context.inventory)
    context.order = service.process(
        customer_id="cust-1",
        items=context.order_items,
    )


@then('the order status is "{status}"')
def step_order_status(context, status):
    assert context.order.status == status, (
        f"Expected '{status}', got '{context.order.status}'"
    )


@then('inventory for "{sku}" is reduced to {quantity:d}')
def step_inventory_reduced(context, sku, quantity):
    actual = context.inventory.get_stock(sku)
    assert actual == quantity, f"Expected {quantity}, got {actual}"


@then('inventory for "{sku}" remains at {quantity:d}')
def step_inventory_unchanged(context, sku, quantity):
    actual = context.inventory.get_stock(sku)
    assert actual == quantity, f"Expected {quantity}, got {actual}"
```

**Behave configuration:**

```ini
# behave.ini
[behave]
paths = features
format = pretty
logging_level = WARNING
junit = true
junit_directory = reports
```

### Writing Effective Feature Files

Follow these guidelines for maintainable feature files:

```gherkin
# GOOD: Declarative, business-focused
Scenario: Premium customer receives free shipping
  Given a premium customer with a cart totaling $75.00
  When the customer proceeds to checkout
  Then shipping cost is $0.00

# BAD: Imperative, UI-focused (avoid this)
Scenario: Premium customer receives free shipping
  Given the user navigates to "/login"
  And the user enters "premium@example.com" in the email field
  And the user enters "password123" in the password field
  And the user clicks the "Login" button
  And the user navigates to "/cart"
  And the user clicks "Proceed to Checkout"
  Then the element "#shipping-cost" contains "$0.00"
```

**Rules for effective scenarios:**
- Write declaratively (describe _what_, not _how_)
- One scenario tests one behavior
- Keep scenarios under 10 steps
- Use Background for shared preconditions
- Use Scenario Outline for data-driven tests
- Avoid coupling to UI selectors or API endpoints

---

## 10 Best Practices

1. **Run Three Amigos before writing any feature file.** Feature files are the
   output of a collaboration session, not a developer's solo activity.
2. **Write scenarios in the domain language.** Use terminology the product team
   uses, not technical jargon.
3. **Keep step definitions thin.** Steps should delegate to page objects, service
   clients, or domain helpers — not contain business logic.
4. **Limit to 3-7 scenarios per feature.** If a feature needs more, split it into
   smaller features.
5. **Use Background sparingly.** Only for preconditions shared by every scenario
   in the file. If only some scenarios need it, use Given steps.
6. **Make scenarios independent.** No scenario should depend on the outcome of
   another. Each scenario sets up its own state.
7. **Version feature files alongside code.** Feature files are living documentation
   and must evolve with the codebase.
8. **Generate living documentation from feature files.** Use Cucumber HTML reports
   or similar tools to publish browsable specs.
9. **Review feature files in pull requests.** Product and QA must approve changes
   to feature files, not just developers.
10. **Delete obsolete scenarios aggressively.** Dead scenarios are worse than no
    scenarios — they create false confidence.

---

## Anti-Patterns

| Anti-Pattern                          | Impact                                           | Fix                                                       |
|---------------------------------------|--------------------------------------------------|-----------------------------------------------------------|
| Developer writes features alone       | Scenarios miss business context and edge cases   | Mandate Three Amigos sessions for every feature           |
| Imperative step style (UI actions)    | Brittle; breaks on every UI change               | Write declarative steps that describe behavior, not clicks |
| One giant feature file (50+ scenarios)| Impossible to maintain or reason about            | Split by sub-feature or user goal; max 7 scenarios/file   |
| Scenario interdependence              | Flaky tests; order-dependent execution            | Each scenario creates its own state from scratch          |
| Step definition god class             | One file with 500 steps; merge conflicts          | Organize steps by domain concept (one file per feature)   |
| BDD for everything (including utils)  | Overhead without communication benefit            | Use BDD only where stakeholder collaboration adds value   |
| Ignoring feature file maintenance     | Specs drift from reality; living docs are dead    | Include feature file review in every PR                   |
| Testing technical details via Gherkin | Scenarios read like unit tests in natural language | Keep Gherkin at the business behavior level               |

---

## Enforcement Checklist

- [ ] Three Amigos sessions are scheduled before each feature implementation
- [ ] Feature files are stored in a `features/` directory alongside source code
- [ ] Step definitions are organized by domain concept (one file per feature area)
- [ ] CI runs BDD scenarios as part of the integration test suite
- [ ] Feature file changes require review from product or QA
- [ ] Cucumber/Behave HTML reports are published and accessible
- [ ] Scenarios use declarative style (no UI selectors or HTTP verbs in steps)
- [ ] Each scenario is independent and can run in isolation
- [ ] Scenario Outline is used instead of copy-paste scenarios with different data
- [ ] Feature files are pruned during every quarterly review cycle
- [ ] New team members receive a walkthrough of existing feature files as onboarding
- [ ] BDD tooling versions are pinned and updated on a regular schedule
