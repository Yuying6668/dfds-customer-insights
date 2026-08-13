# Mia Demo Governance Evidence Pack

**Purpose:** This pack completes the interview-demo governance walkthrough. Every project record in this pack is simulated. It demonstrates the evidence shape, gate behaviour, and audit trail expected before a real deployment; it is not a claim that a provider, employer, DPO, or security team approved the system.

## How To Run

```bash
.venv/bin/python scripts/production_preflight.py --demo --pretty
```

The command loads `data/compliance/demo-governance.json`, injects non-secret demo runtime proofs, and returns `status: ready` with `mode: demo-simulated`. The default command deliberately remains fail-closed:

```bash
.venv/bin/python scripts/production_preflight.py
```

The simulated provider trace contract is verified separately:

```bash
.venv/bin/python scripts/langgraph_demo_trace_check.py
```

It confirms the same trace ID is used as provider ID and metadata ID for Conversation, Dataset, and Evaluation, with all required redacted trace fields present.

## Evidence Register

| Control | Simulated evidence reference | Public design basis |
| --- | --- | --- |
| OIDC issuer, audience, JWKS, RS256 | `evidence://demo/deployment/oidc` | [RFC 8414, OAuth 2.0 Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414) |
| MFA assurance | `evidence://demo/deployment/mfa` | [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html) |
| TLS, encryption at rest, audit sink | `evidence://demo/deployment/tls`, `encryption`, `audit` | [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) |
| Processor DPA, EEA residency, retention, transfers | `evidence://demo/processor/model-provider` | [GDPR, Article 28](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| DPIA screening | `evidence://demo/dpia/mia` | [GDPR, Article 35](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| Prohibited-use review | `evidence://demo/ai-risk/mia` | [EU AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) |
| Operator training | `evidence://demo/training/governance-admin` | [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) |
| Trace contract and provider linkage | `evidence://demo/observability/langfuse-contract` | [Langfuse documentation](https://langfuse.com/docs) |

## Demonstration Boundaries

- `evidence_type: simulated` identifies every evidence object in the demo declaration.
- All IDs, URLs, roles, approvals, and dates are non-production fixtures.
- The demo command does not enable `MIA_PRODUCTION_MODE`, send traffic to providers, or create real credentials.
- A real deployment must replace the demo declaration with executed contracts, provider attestations, runtime configuration evidence, and named accountable approvers.
