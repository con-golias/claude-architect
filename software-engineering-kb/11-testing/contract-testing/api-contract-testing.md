# API Contract Testing

| Attribute      | Value                                              |
|----------------|----------------------------------------------------|
| Domain         | Testing > Contract Testing                         |
| Importance     | Critical                                           |
| Last Updated   | 2026-03-10                                         |
| Cross-ref      | `06-backend/testing/api-testing/contract-testing.md` |

---

## Core Concepts

### What Is a Contract?

A contract is a formal, machine-verifiable agreement between an API consumer and an API provider. It specifies the request shape, response shape, status codes, headers, and content types that both parties honor. Breaking a contract means breaking integration.

### Consumer-Driven Contracts (CDC)

In CDC, **consumers define the expectations** they have of a provider. Each consumer writes a contract test that produces an artifact (e.g., a Pact file). The provider then verifies all consumer contracts against its implementation. This inverts the traditional model: the provider serves consumers, not the other way around.

Use CDC when:
- Multiple consumers depend on a single provider.
- Consumers evolve independently and have different needs.
- Teams deploy microservices autonomously.

### Provider-Driven Contracts

The provider publishes an authoritative spec (OpenAPI/Swagger, AsyncAPI, GraphQL SDL). Consumers validate their usage against this spec. The provider owns the contract definition.

Use provider-driven contracts when:
- A single team owns both the API and its documentation.
- The API is public-facing with many unknown consumers.
- Spec-first design is enforced.

### Bi-Directional Contracts

Combine provider specs with consumer contract tests. A broker compares the provider's OpenAPI spec against consumer Pact files to detect incompatibilities without running full provider verification. This reduces coupling between CI pipelines.

### Contract Testing vs Integration Testing

| Dimension            | Contract Testing                  | Integration Testing               |
|----------------------|-----------------------------------|-----------------------------------|
| Scope                | Interface agreement only          | Full request/response through stack |
| Environment          | No real services needed           | Requires running services          |
| Speed                | Fast (seconds)                    | Slow (minutes)                     |
| Failure signal       | Schema/shape mismatch             | Behavioral/logic errors            |
| Maintenance          | Low                               | High (environment flakiness)       |
| When to use          | Verify interface compatibility    | Verify end-to-end behavior         |

Use contract tests as the **first gate** before integration tests. If the contract breaks, integration tests are meaningless.

---

## Code Examples

### TypeScript: Consumer-Driven Contract Test with Pact

```typescript
// user-service.consumer.pact.test.ts
import { PactV4, MatchersV3 } from "@pact-foundation/pact";
import { resolve } from "path";
import { UserApiClient } from "../clients/user-api-client";

const { like, eachLike, string, integer, timestamp } = MatchersV3;

const provider = new PactV4({
  consumer: "OrderService",
  provider: "UserService",
  dir: resolve(process.cwd(), "pacts"),
});

describe("UserService API Contract", () => {
  it("returns a user by ID", async () => {
    await provider
      .addInteraction()
      .given("a user with ID 42 exists")
      .uponReceiving("a request for user 42")
      .withRequest("GET", "/api/users/42", (builder) => {
        builder.headers({ Accept: "application/json" });
      })
      .willRespondWith(200, (builder) => {
        builder
          .headers({ "Content-Type": "application/json" })
          .jsonBody({
            id: integer(42),
            email: string("user@example.com"),
            name: string("Jane Doe"),
            createdAt: timestamp(
              "yyyy-MM-dd'T'HH:mm:ss.SSSX",
              "2025-01-15T10:30:00.000Z"
            ),
            roles: eachLike(string("admin")),
          });
      })
      .executeTest(async (mockServer) => {
        const client = new UserApiClient(mockServer.url);
        const user = await client.getUserById(42);

        expect(user.id).toBe(42);
        expect(user.email).toBeDefined();
        expect(user.roles.length).toBeGreaterThan(0);
      });
  });

  it("returns 404 for a non-existent user", async () => {
    await provider
      .addInteraction()
      .given("no user with ID 9999 exists")
      .uponReceiving("a request for non-existent user 9999")
      .withRequest("GET", "/api/users/9999")
      .willRespondWith(404, (builder) => {
        builder.jsonBody({
          error: string("NOT_FOUND"),
          message: string("User not found"),
        });
      })
      .executeTest(async (mockServer) => {
        const client = new UserApiClient(mockServer.url);
        await expect(client.getUserById(9999)).rejects.toThrow("User not found");
      });
  });
});
```

### Go: Provider Verification with Pact Go

```go
// user_provider_test.go
package provider

import (
	"fmt"
	"net/http"
	"os"
	"testing"

	"github.com/pact-foundation/pact-go/v2/provider"
	"github.com/pact-foundation/pact-go/v2/utils"
)

func TestUserProviderPact(t *testing.T) {
	port, _ := utils.GetFreePort()

	// Start the real provider server
	go startProviderServer(port)

	verifier := provider.NewVerifier()

	err := verifier.VerifyProvider(t, provider.VerifyRequest{
		ProviderBaseURL: fmt.Sprintf("http://localhost:%d", port),
		Provider:        "UserService",
		// Fetch pacts from Pact Broker
		BrokerURL:                  os.Getenv("PACT_BROKER_URL"),
		BrokerToken:                os.Getenv("PACT_BROKER_TOKEN"),
		PublishVerificationResults: true,
		ProviderVersion:            os.Getenv("GIT_COMMIT"),
		ProviderBranch:             os.Getenv("GIT_BRANCH"),
		// State handlers set up preconditions for each interaction
		StateHandlers: map[string]provider.StateHandlerFunc{
			"a user with ID 42 exists": func(setup bool, state provider.ProviderState) (map[string]interface{}, error) {
				if setup {
					seedTestUser(42, "Jane Doe", "user@example.com")
				} else {
					cleanupTestUser(42)
				}
				return nil, nil
			},
			"no user with ID 9999 exists": func(setup bool, state provider.ProviderState) (map[string]interface{}, error) {
				if setup {
					ensureUserDoesNotExist(9999)
				}
				return nil, nil
			},
		},
		// Filter by consumer version selectors
		ConsumerVersionSelectors: []provider.Selector{
			{MainBranch: true},
			{DeployedOrReleased: true},
		},
		EnablePending: true,
	})

	if err != nil {
		t.Fatalf("Provider verification failed: %v", err)
	}
}
```

### Python: Property-Based API Contract Testing with Schemathesis

```python
# test_api_contract_schemathesis.py
import schemathesis
from schemathesis.checks import (
    not_a_server_error,
    status_code_conformance,
    content_type_conformance,
    response_schema_conformance,
)

# Load the OpenAPI spec (provider-driven contract)
schema = schemathesis.from_url(
    "http://localhost:8080/openapi.json",
    # Validate every response against the spec
    validate_schema=True,
)


@schema.parametrize()
def test_api_conforms_to_spec(case):
    """
    Schemathesis generates random valid requests from the OpenAPI spec
    and verifies that responses conform to the documented contract.
    """
    response = case.call()
    case.validate_response(
        response,
        checks=(
            not_a_server_error,
            status_code_conformance,
            content_type_conformance,
            response_schema_conformance,
        ),
    )


# Targeted testing for specific endpoints
@schema.parametrize(endpoint="/api/users/{user_id}")
def test_user_endpoint_contract(case):
    """Verify the user endpoint specifically."""
    response = case.call()
    case.validate_response(response)

    if response.status_code == 200:
        data = response.json()
        assert "id" in data, "Response must contain 'id' field"
        assert "email" in data, "Response must contain 'email' field"
        assert isinstance(data["id"], int), "'id' must be an integer"


# Stateful testing: Schemathesis links operations together
@schema.parametrize()
@schemathesis.given(data=schemathesis.from_schema(schema))
def test_stateful_api_contract(case, data):
    """Test sequences of API calls for stateful contracts."""
    response = case.call()
    case.validate_response(response)
```

### Contract Testing in CI/CD: Can-I-Deploy Workflow

```yaml
# .github/workflows/contract-test.yml
name: Contract Tests
on:
  push:
    branches: [main, "feature/**"]
  pull_request:
    branches: [main]

jobs:
  consumer-contract-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run test:contract
      - name: Publish pacts to broker
        run: npx pact-broker publish ./pacts
          --consumer-app-version=${{ github.sha }}
          --branch=${{ github.ref_name }}
          --broker-base-url=${{ secrets.PACT_BROKER_URL }}
          --broker-token=${{ secrets.PACT_BROKER_TOKEN }}

  can-i-deploy:
    needs: consumer-contract-test
    runs-on: ubuntu-latest
    steps:
      - name: Can I deploy?
        run: |
          npx pact-broker can-i-deploy \
            --pacticipant=OrderService \
            --version=${{ github.sha }} \
            --to-environment=production \
            --broker-base-url=${{ secrets.PACT_BROKER_URL }} \
            --broker-token=${{ secrets.PACT_BROKER_TOKEN }}
```

---

## 10 Best Practices

1. **Write contract tests from the consumer's perspective first.** Define what you actually need, not what the provider offers. This minimizes coupling.
2. **Use matchers instead of exact values.** Verify types and structure rather than specific data. Exact value matching creates brittle contracts.
3. **Version contracts with Git SHAs and branch names.** Enable the Pact Broker to correlate contracts with deployable versions.
4. **Run `can-i-deploy` before every deployment.** Gate deployments on contract compatibility to prevent breaking changes from reaching production.
5. **Keep contracts minimal.** Test only the fields your consumer uses. Including unused fields increases maintenance burden without adding safety.
6. **Implement provider state handlers for every interaction.** Ensure the provider can set up the preconditions needed for each consumer expectation.
7. **Separate contract tests from functional tests.** Contract tests verify shape and compatibility; functional tests verify business logic.
8. **Use pending pacts for new consumers.** Allow new consumer contracts to be verified without blocking the provider pipeline until the contract is stable.
9. **Tag and track environments in the Pact Broker.** Use environment-aware selectors so `can-i-deploy` checks the right versions for each deployment target.
10. **Automate provider verification via webhooks.** Trigger provider verification automatically when a new consumer pact is published.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Testing business logic in contract tests | Bloated, slow contracts that duplicate functional tests | Limit contracts to request/response shape and status codes |
| Using exact value matching everywhere | Brittle contracts that break on any data change | Use type matchers (`like`, `eachLike`, `string`, `integer`) |
| Sharing a single contract across all environments | Deployments blocked by irrelevant environment mismatches | Use environment-specific version selectors and tags |
| Skipping provider states | Provider verification fails randomly based on data state | Implement explicit state handlers for every interaction |
| Running contract tests against shared staging | Flaky tests due to shared mutable state | Run against isolated provider instances with seeded data |
| Not publishing contracts to a broker | Manual contract exchange breaks at scale | Use Pact Broker or PactFlow for centralized contract management |
| Treating contract test failures as non-blocking | Broken contracts reach production, causing outages | Make contract tests a required CI gate before merge |
| Coupling consumer and provider releases | Defeats the purpose of independent deployability | Use `can-i-deploy` to verify compatibility without synchronized releases |

---

## Enforcement Checklist

- [ ] Every service that consumes an API has at least one consumer contract test
- [ ] Contract tests produce versioned artifacts published to a Pact Broker
- [ ] Provider verification runs automatically when new pacts are published
- [ ] `can-i-deploy` is a required gate in the deployment pipeline
- [ ] Matchers are used instead of hardcoded values in all contract expectations
- [ ] Provider state handlers exist for every consumer interaction
- [ ] Contract tests run in CI on every pull request
- [ ] Pending pacts are enabled to prevent new consumers from blocking providers
- [ ] Contract test failures block merges to main
- [ ] Teams review contract changes in pull requests alongside code changes
- [ ] Consumer and provider versions are tagged with Git SHA and branch
- [ ] Contract tests are separated from integration and unit test suites
