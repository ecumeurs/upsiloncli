---
id: contract_cli_contract
status: STABLE
version: 1.0
tags: [governance, contract, cli]
parents:
  - [[shared:contract_upsilon_contract]]
type: CONTRACT
layer: BUSINESS
priority: 1
dependents: []
human_name: UpsilonCLI Contract
---

# UpsilonCLI Contract

## INTENT
Establish the technical standards for CLI scripts and E2E testing scenarios.

## THE RULE / LOGIC
- **Test Integrity:** All E2E scenarios must be deterministic and provide clear pass/fail criteria with detailed failure logs.
- **API Compliance:** Scripts must use the same DTOs and protocols as the official frontend.
- **Security:** Ensure sensitive data (credentials, tokens) are never logged or exposed in test reports.
- **Modularity:** Scenarios should be reusable and isolated to specific features or edge cases.
- **Traceability:** Map each test scenario to its corresponding BUSINESS or ARCHITECTURE atom via `@test-link`.

## TECHNICAL INTERFACE
- **Code Tag:** `@spec-link [[contract_cli_contract]]`
- **Related Atoms:** `[[shared:contract_upsilon_contract]]`

## EXPECTATION
