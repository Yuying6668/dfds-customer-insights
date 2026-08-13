import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REQUIRED_PROOF_NAMES = (
    "OIDC_ISSUER",
    "OIDC_AUDIENCE",
    "OIDC_JWKS_URL",
    "OIDC_SIGNING_ALG",
    "OIDC_MFA_ASSURANCE",
    "KMS_SECRET_REF",
    "KMS_ROTATED_AT",
    "TLS_EVIDENCE",
    "ENCRYPTION_AT_REST_EVIDENCE",
    "AUDIT_SINK_EVIDENCE",
)


class ProductionGovernanceConfigTests(unittest.TestCase):
    def test_env_example_documents_all_runtime_proof_names_without_real_secrets(self):
        content = (ROOT / ".env.example").read_text(encoding="utf-8")
        for name in REQUIRED_PROOF_NAMES:
            self.assertIn(f"{name}=", content)
        self.assertNotIn("sk-live-", content)
        self.assertNotIn("customer@example.com", content)

    def test_governance_declaration_has_auditable_evidence_metadata_shapes(self):
        import json

        declaration = json.loads((ROOT / "data/compliance/production-governance.json").read_text(encoding="utf-8"))
        self.assertTrue(declaration.get("evidence_version"))
        for record in declaration["sources"] + declaration["processors"]:
            self.assertTrue(record.get("evidence_ref"))
            self.assertTrue(record.get("owner"))
            self.assertTrue(record.get("reviewed_at"))
        for key in ("dpia", "ai_risk"):
            self.assertTrue(declaration[key].get("evidence_ref"))
            self.assertTrue(declaration[key].get("reviewer"))
            self.assertTrue(declaration[key].get("reviewed_at"))


if __name__ == "__main__":
    unittest.main()
