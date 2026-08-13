import json
from pathlib import Path

from backend.production_governance import evaluate_readiness


ROOT = Path(__file__).resolve().parents[1]


def complete_declaration():
    return {
        "version": "2026-08-10.1",
        "sources": [{"id": "internal-surveys", "purpose": "aggregate insights", "source_terms": "internal-approved", "retention_days": 90, "deletion_owner": "data-steward", "data_steward": "data-steward", "lawful_basis": "legitimate-interest", "evidence_ref": "evidence://sources/internal-surveys", "owner": "data-steward", "reviewed_at": "2026-08-01"}],
        "processors": [{"id": "model", "dpa": "approved", "regions": ["EEA"], "retention_days": 30, "transfer_mechanism": "none", "encryption": "approved", "evidence_ref": "evidence://processors/model", "owner": "security", "reviewed_at": "2026-08-01"}],
        "deployment": {"auth_protocol": "oidc", "mfa_assurance": "aal2", "roles": {"governance_admin": "governance-admin"}, "tls": "approved", "encryption_at_rest": "approved", "secret_manager": "kms", "audit_sink": "approved"},
        "dpia": {"status": "approved", "evidence_ref": "evidence://dpia/mia", "reviewer": "dpo", "reviewed_at": "2026-08-01"},
        "ai_risk": {"classification": "limited-risk", "prohibited_use_reviewed": True, "evidence_ref": "evidence://ai-risk/mia", "reviewer": "governance", "reviewed_at": "2026-08-01"},
        "training": [{"role": "governance_admin", "completed_at": "2099-01-01", "evidence_ref": "evidence://training/governance-admin", "owner": "governance", "reviewed_at": "2026-08-01"}],
    }


def complete_runtime():
    return {
        "OIDC_ISSUER": "https://idp.example.test",
        "OIDC_AUDIENCE": "mia",
        "OIDC_JWKS_URL": "https://idp.example.test/.well-known/jwks.json",
        "OIDC_SIGNING_ALG": "RS256",
        "OIDC_MFA_ASSURANCE": "aal2",
        "KMS_SECRET_REF": "secret://mia/prod",
        "KMS_ROTATED_AT": "2099-01-01T00:00:00+00:00",
        "TLS_EVIDENCE": "approved",
        "ENCRYPTION_AT_REST_EVIDENCE": "approved",
        "AUDIT_SINK_EVIDENCE": "approved",
    }


def test_complete_evidence_is_ready():
    report = evaluate_readiness(complete_declaration(), complete_runtime(), now="2026-08-10T00:00:00+00:00")
    assert report["status"] == "ready"
    assert not report["blocking_checks"]


def test_missing_mfa_and_dpia_blocks_readiness():
    declaration = complete_declaration()
    declaration["deployment"]["mfa_assurance"] = "none"
    declaration["dpia"]["status"] = "required_pending"
    report = evaluate_readiness(declaration, complete_runtime(), now="2026-08-10T00:00:00+00:00")
    assert report["status"] == "blocked"
    assert {"deployment.mfa", "dpia.status"}.issubset(report["blocking_checks"])


def test_report_does_not_echo_runtime_secrets_or_raw_context():
    runtime = complete_runtime() | {"KMS_SECRET_VALUE": "do-not-leak", "RAW_UPLOAD": "customer@example.com"}
    report = evaluate_readiness(complete_declaration(), runtime, now="2026-08-10T00:00:00+00:00")
    rendered = json.dumps(report)
    assert "do-not-leak" not in rendered
    assert "customer@example.com" not in rendered


def test_governance_report_identifies_missing_evidence_metadata():
    declaration = complete_declaration()
    del declaration["processors"][0]["evidence_ref"]
    report = evaluate_readiness(declaration, complete_runtime(), now="2026-08-10T00:00:00+00:00")
    assert report["status"] == "blocked"
    assert "processors.evidence_records" in report["blocking_checks"]
