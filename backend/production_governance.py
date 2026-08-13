"""Fail-closed production security and governance readiness checks."""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping


ROOT = Path(__file__).resolve().parents[1]
DECLARATION_PATH = ROOT / "data" / "compliance" / "production-governance.json"
REQUIRED_RUNTIME = (
    "OIDC_ISSUER", "OIDC_AUDIENCE", "OIDC_JWKS_URL", "OIDC_SIGNING_ALG",
    "OIDC_MFA_ASSURANCE", "KMS_SECRET_REF", "KMS_ROTATED_AT", "TLS_EVIDENCE",
    "ENCRYPTION_AT_REST_EVIDENCE", "AUDIT_SINK_EVIDENCE",
)
EVIDENCE_METADATA = ("evidence_ref", "owner", "reviewed_at")


def load_governance(path: str | Path = DECLARATION_PATH) -> dict[str, Any]:
    with Path(path).open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError("Governance declaration must be an object")
    return value


def _check(check_id: str, ok: bool, reason: str = "") -> dict[str, str]:
    result = {"id": check_id, "status": "pass" if ok else "block"}
    if not ok:
        result["reason"] = reason[:240]
    return result


def _parse_time(value: object) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def _has_evidence_metadata(value: Mapping[str, Any] | None, *, reviewer_key: str = "owner") -> bool:
    value = value or {}
    return bool(value.get("evidence_ref") and value.get(reviewer_key) and _parse_time(value.get("reviewed_at")))


def _all_have_evidence_metadata(values: list[Mapping[str, Any]]) -> bool:
    return bool(values) and all(_has_evidence_metadata(value) for value in values)


def evaluate_readiness(declaration: Mapping[str, Any], runtime: Mapping[str, Any] | None = None, *, now: str | None = None) -> dict[str, Any]:
    runtime = runtime or os.environ
    checks: list[dict[str, str]] = []
    deployment = declaration.get("deployment") or {}
    auth_protocol = str(deployment.get("auth_protocol") or "").lower()
    checks.append(_check("deployment.auth_protocol", auth_protocol in {"oidc", "saml"}, "OIDC or SAML is required"))
    checks.append(_check("deployment.mfa", str(deployment.get("mfa_assurance") or "").lower() in {"aal2", "aal3", "phishing-resistant"}, "MFA assurance is missing"))
    checks.append(_check("deployment.roles", bool(deployment.get("roles", {}).get("governance_admin")), "Governance administrator mapping is missing"))
    for key in ("tls", "encryption_at_rest", "secret_manager", "audit_sink"):
        checks.append(_check(f"deployment.{key}", bool(deployment.get(key)), f"{key} evidence is missing"))

    for key in REQUIRED_RUNTIME:
        checks.append(_check(f"runtime.{key.lower()}", bool(str(runtime.get(key) or "").strip()), f"{key} runtime proof is missing"))
    if runtime.get("OIDC_SIGNING_ALG") not in {"RS256", "ES256"}:
        checks.append(_check("runtime.oidc_signing_alg", False, "Only RS256 or ES256 is accepted"))
    if str(runtime.get("OIDC_MFA_ASSURANCE") or "").lower() != str(deployment.get("mfa_assurance") or "").lower():
        checks.append(_check("runtime.oidc_mfa_assurance", False, "Runtime MFA assurance does not match the declared policy"))
    rotated = _parse_time(runtime.get("KMS_ROTATED_AT"))
    current = _parse_time(now) or datetime.now(timezone.utc)
    if rotated is None or (current - rotated).days > 180:
        checks.append(_check("runtime.kms_rotation", False, "Managed secret rotation evidence is stale or invalid"))

    sources = declaration.get("sources") or []
    checks.append(_check("sources.records", bool(sources) and all(all(item.get(k) for k in ("id", "purpose", "source_terms", "retention_days", "deletion_owner", "data_steward", "lawful_basis")) for item in sources), "Every source needs purpose, authority, source terms, retention, deletion owner, and steward"))
    checks.append(_check("sources.evidence_records", _all_have_evidence_metadata(sources), "Every source needs an evidence reference, owner, and review timestamp"))
    processors = declaration.get("processors") or []
    checks.append(_check("processors.records", bool(processors) and all(all(item.get(k) for k in ("id", "dpa", "regions", "retention_days", "transfer_mechanism", "encryption")) and item.get("dpa") == "approved" and item.get("encryption") == "approved" and "EEA" in item.get("regions", []) and not str(item.get("transfer_mechanism")).startswith("document-before") for item in processors), "Every processor needs approved DPA, EEA residency, transfer, retention, and encryption evidence"))
    checks.append(_check("processors.evidence_records", _all_have_evidence_metadata(processors), "Every processor needs an evidence reference, owner, and review timestamp"))
    dpia = declaration.get("dpia") or {}
    checks.append(_check("dpia.status", dpia.get("status") == "approved", "DPIA screening is not approved"))
    checks.append(_check("dpia.evidence_record", _has_evidence_metadata(dpia, reviewer_key="reviewer"), "DPIA needs an evidence reference, reviewer, and review timestamp"))
    risk = declaration.get("ai_risk") or {}
    checks.append(_check("ai_risk.classification", risk.get("classification") in {"minimal-risk", "limited-risk"}, "AI risk is high-risk or unclassified"))
    checks.append(_check("ai_risk.prohibited_use", risk.get("prohibited_use_reviewed") is True, "Prohibited-use review is missing"))
    checks.append(_check("ai_risk.evidence_record", _has_evidence_metadata(risk, reviewer_key="reviewer"), "AI risk needs an evidence reference, reviewer, and review timestamp"))
    training = declaration.get("training") or []
    checks.append(_check("training.current", bool(training) and all(_parse_time(item.get("completed_at")) and (_parse_time(item.get("completed_at")) - current).days >= -365 for item in training), "Operator training records are missing or stale"))
    checks.append(_check("training.evidence_records", _all_have_evidence_metadata(training), "Every training record needs an evidence reference, owner, and review timestamp"))

    blocking = [item["id"] for item in checks if item["status"] == "block"]
    declaration_hash = hashlib.sha256(json.dumps(declaration, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return {"status": "ready" if not blocking else "blocked", "governance_version": str(declaration.get("version") or "unknown"), "evidence_version": str(declaration.get("evidence_version") or "unknown"), "declaration_hash": declaration_hash, "checks": checks, "blocking_checks": blocking}


def readiness_report(runtime: Mapping[str, Any] | None = None) -> dict[str, Any]:
    return evaluate_readiness(load_governance(), runtime)


def is_production_ready(runtime: Mapping[str, Any] | None = None) -> bool:
    return readiness_report(runtime)["status"] == "ready"


def pseudonymous_actor_id(actor_id: object) -> str:
    return hashlib.sha256(str(actor_id).encode("utf-8")).hexdigest()[:24]
