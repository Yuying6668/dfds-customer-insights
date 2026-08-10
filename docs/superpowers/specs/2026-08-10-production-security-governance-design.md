# Production Security and Governance Design

## Scope

This batch adds an executable production-readiness gate for Mia. It covers enterprise authentication, MFA/SSO, least-privilege RBAC, encryption and secret-management evidence, processor/DPA records, data residency and retention, GDPR DPIA screening, EU AI risk classification, operator training, and minimum audit metadata. It does not implement a vendor-specific IdP; the runtime contract is OIDC/SAML-compatible so an approved enterprise provider can be connected later.

Mia remains decision support. The gate must not enable individual profiling, rights-affecting automated decisions, autonomous operational actions, or publication without human review.

## Governance Contract

`data/compliance/production-governance.json` is a versioned, non-sensitive declaration. It contains:

- source records: controller/processor, purpose, lawful basis or source authority, source terms, retention period, deletion owner, data steward, residency and approved collection method;
- processor records for model, embedding, observability, database and hosting providers: DPA status, approved regions, transfer mechanism, retention, encryption and approval date;
- deployment controls: OIDC/SAML mode, required MFA assurance, RBAC role mappings, TLS and encryption-at-rest evidence, KMS secret references and rotation evidence;
- DPIA screening result and reviewer metadata;
- AI risk classification, prohibited-use declaration and reassessment date;
- role-based operator/reviewer/administrator training records.

No password, token, raw identity value, upload content, DPIA body, or provider secret is stored in the repository or audit record.

## Runtime Readiness

`backend/production_governance.py` loads the declaration and evaluates it with runtime proofs supplied through environment variables or a deployment secret manager. It validates:

1. OIDC/SAML issuer, audience, JWKS/metadata, signing algorithm, clock/expiry policy, MFA assurance, and group-to-role mappings;
2. managed secret references and rotation timestamps, TLS, encryption-at-rest, and audit-log sink;
3. every in-scope processor's DPA, residency, transfer, retention, and encryption evidence;
4. DPIA conclusion and escalation state;
5. AI risk class, prohibited-use declaration, and current training records.

The result is a deterministic report with check IDs, status, evidence version, and redacted blocking reasons. Required failures produce `blocked`; only a fully passing report produces `ready`.

## Service Boundary

The server exposes administrator-only `GET /api/governance/production-readiness` and `POST /api/governance/production-mode`. The POST endpoint is idempotent and can only move the instance to production when readiness is `ready`; it records a minimal audit event containing a pseudonymous actor ID, timestamp, governance version, result hash, and blocking check IDs. A shared server-side middleware rejects production-only uploads, graph execution, evaluation runs, and external-provider calls whenever readiness is not ready. Local development may use the existing account login, but production mode cannot use it as an authentication fallback.

RBAC is enforced on the server with separate capabilities for data administration, human review, evaluation administration, and governance administration. UI visibility is not an authorization control.

## Failure and Data Minimisation

Missing, stale, contradictory, or unverifiable evidence fails closed. Provider outages do not silently pass the gate. Readiness reports and audit events retain only hashes, versions, pseudonymous actor IDs, timestamps, statuses, and check identifiers. They contain no credentials, prompts, reviews, unrestricted uploads, or DPIA contents. Governance records are themselves subject to the existing tombstone and retention policy where they reference a deleted source, while the minimum lawful audit metadata remains.

## Verification

Tests must prove that incomplete OIDC/MFA, role mappings, KMS references, processor/DPA, residency/retention, DPIA, risk, or training evidence blocks production; complete evidence produces `ready`; non-administrators cannot read or change readiness; production-only handlers are blocked until ready; repeated enable requests are idempotent; and audit output is redacted and minimal. Existing authentication, deletion, graph, and route tests must remain green.
