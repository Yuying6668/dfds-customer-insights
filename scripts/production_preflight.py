#!/usr/bin/env python3
"""Run the production governance gate without starting the application."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.production_governance import evaluate_readiness, load_governance


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check Mia production governance readiness")
    parser.add_argument("--declaration", type=Path, help="Override the governance declaration path")
    parser.add_argument("--demo", action="store_true", help="Use the explicitly simulated interview/demo evidence pack")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print the redacted report")
    args = parser.parse_args(argv)
    try:
        declaration_path = args.declaration
        if args.demo:
            declaration_path = Path(__file__).resolve().parents[1] / "data" / "compliance" / "demo-governance.json"
        declaration = load_governance(declaration_path) if declaration_path else load_governance()
        runtime = {
            "OIDC_ISSUER": "https://demo.example.invalid/oidc",
            "OIDC_AUDIENCE": "mia-demo",
            "OIDC_JWKS_URL": "https://demo.example.invalid/oidc/.well-known/jwks.json",
            "OIDC_SIGNING_ALG": "RS256",
            "OIDC_MFA_ASSURANCE": "aal2",
            "KMS_SECRET_REF": "demo/kms/mia",
            "KMS_ROTATED_AT": "2026-08-11T00:00:00Z",
            "TLS_EVIDENCE": "evidence://demo/deployment/tls",
            "ENCRYPTION_AT_REST_EVIDENCE": "evidence://demo/deployment/encryption",
            "AUDIT_SINK_EVIDENCE": "evidence://demo/deployment/audit",
        } if args.demo else None
        report = evaluate_readiness(declaration, runtime)
        if args.demo:
            report["mode"] = "demo-simulated"
            report["warning"] = declaration.get("simulation_notice")
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "blocked", "error": str(exc)}))
        return 2
    indent = 2 if args.pretty else None
    print(json.dumps(report, ensure_ascii=False, indent=indent))
    return 0 if report["status"] == "ready" else 2


if __name__ == "__main__":
    sys.exit(main())
