"""Deterministic release policy. LLM output never decides whether it is publishable."""

from dataclasses import dataclass
import re

REVIEW_POLICY_VERSION = "review-policy-v1"
DEFAULT_CONFIDENCE_THRESHOLD = 0.80
HIGH_IMPACT = re.compile(r"\b(price|fare|eligibility|credit|employment|revenue|rights|policy)\b", re.I)
INJECTION = re.compile(r"ignore (?:all|previous|prior) instructions|system prompt|reveal credentials|use the tool", re.I)


@dataclass(frozen=True)
class ReviewDecision:
    requires_human_review: bool
    reasons: list[str]
    policy_version: str = REVIEW_POLICY_VERSION


def assess_untrusted_text(text: str) -> bool:
    """Return true when retrieved/generated text contains a likely instruction injection."""
    return bool(INJECTION.search(str(text or "")))


def decide_review(output: dict, confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD) -> ReviewDecision:
    reasons = []
    evidence_ids = output.get("evidence_ids") or output.get("evidenceIds") or []
    if not evidence_ids:
        reasons.append("missing_citations")
    confidence = output.get("confidence")
    try:
        if confidence is None or float(confidence) < confidence_threshold:
            reasons.append("low_confidence")
    except (TypeError, ValueError):
        reasons.append("low_confidence")
    if output.get("conflicting_evidence") or output.get("conflictingEvidence"):
        reasons.append("conflicting_evidence")
    if output.get("restricted_data") or output.get("restrictedData"):
        reasons.append("restricted_data")
    recommendation = output.get("recommendation") or ""
    if HIGH_IMPACT.search(str(recommendation)):
        reasons.append("high_impact_recommendation")
    if output.get("suspected_injection") or assess_untrusted_text(output.get("answer", "")):
        reasons.append("suspected_prompt_injection")
    return ReviewDecision(bool(reasons), reasons)
