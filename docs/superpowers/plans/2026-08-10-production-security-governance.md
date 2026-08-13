# Production Security Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a versioned governance contract and fail-closed production-readiness gate covering enterprise authentication, least-privilege roles, secrets, processor controls, DPIA, AI risk, training, and audit minimisation.

**Architecture:** A focused Python module loads the repository declaration and runtime proofs, returns deterministic check results, and exposes a single readiness predicate. `server.py` adds administrator-only readiness/mode endpoints and a shared production guard; existing local login remains development-only. Tests exercise the module directly and the HTTP boundary without contacting external providers.

**Tech Stack:** Python 3, stdlib `json`, `datetime`, `hashlib`; `http.server`; pytest; existing PostgreSQL audit helpers.

---

### Task 1: Governance contract and validator

**Files:**
- Create: `data/compliance/production-governance.json`
- Create: `backend/production_governance.py`
- Test: `tests/test_production_governance.py`

- [x] Write failing tests for required check IDs, blocked incomplete evidence, ready complete evidence, stale training/rotation, and redacted result output.
- [ ] Run `pytest tests/test_production_governance.py -q` and confirm the module/import or assertion failure.
- [x] Add the non-sensitive declaration with source, processor, deployment, DPIA, risk, and training records.
- [x] Implement `load_governance()`, `evaluate_readiness(declaration, runtime_env)`, `readiness_report()`, `is_production_ready()`, and `pseudonymous_actor_id()`. Validate OIDC/SAML metadata, MFA assurance, role mappings, KMS references/rotation, TLS/encryption evidence, DPA/residency/retention, DPIA state, risk classification, prohibited-use declaration, and current training. Return only check IDs, statuses, versions, hashes, and redacted reasons.
- [x] Run the focused tests and commit `feat: add production governance readiness validator`.

### Task 2: Server-side gate, RBAC, and audit

**Files:**
- Modify: `server.py` near authentication helpers, admin routes, and production-only handlers
- Modify: `db/schema.sql` for governance audit/readiness tables if PostgreSQL is available
- Test: `tests/test_production_governance_api.py`

- [x] Write failing tests for administrator-only GET/POST readiness, non-admin denial, blocked mode enable, idempotent enable, capability checks, and minimal audit payload.
- [ ] Run the focused API tests and confirm failure before implementation.
- [x] Add `GET /api/governance/production-readiness` and `POST /api/governance/production-mode`; require the governance-admin capability, evaluate current runtime evidence, fail closed, and make repeated enable requests return the same active state without duplicate activation.
- [x] Add a shared `require_production_ready()` check to production-only upload, graph, evaluation, and external-provider paths. Local account login cannot satisfy this guard when production mode is enabled.
- [x] Add server-side capability mapping for data admin, reviewer, evaluation admin, and governance admin; persist only pseudonymous actor, timestamp, governance version/hash, status, and blocking IDs.
- [x] Run focused API tests and commit `feat: enforce production governance gate`.

### Task 3: Configuration and operator evidence

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Test: `tests/test_production_governance_config.py`

- [x] Write failing tests that assert no secret values are present in the example and required runtime proof names are documented.
- [x] Add vendor-neutral OIDC/SAML, MFA assurance, KMS reference, rotation, TLS, encryption, residency, retention, and audit-sink variable names with safe placeholders.
- [x] Document the production preflight command, all blocking statuses, local-vs-production authentication boundary, and evidence ownership without claiming a real IdP integration.
- [x] Run config tests and commit `docs: document production governance preflight`.

### Task 4: Full verification

**Files:** existing tests only

- [x] Run the available full Python test suite (`.venv/bin/python -m unittest discover -s tests -q`).
- [x] Run `npm test` with the bundled Node runtime.
- [x] Run `npm run build` with the bundled Node runtime.
- [x] Review the governance output for credentials, raw uploads, prompts, reviews, or identity values.
- [x] Add narrowly scoped governance declaration, configuration, and evidence metadata adjustments.

## Acceptance Closure (2026-08-11)

- Repository governance contract: **closed**. Evidence references, owners, review timestamps, and evidence version are now part of the declaration and validator contract.
- Automated verification: **passed**. 69 Python tests, 25 JavaScript tests, and the production build pass.
- Production readiness: **blocked by design** until real runtime OIDC/KMS/TLS/audit proofs, approved processor/DPA records, DPIA approval, prohibited-use review, and current training records are supplied. No placeholder is treated as production evidence.
