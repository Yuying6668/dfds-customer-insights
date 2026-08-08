#!/usr/bin/env python3
"""Deterministic validation agent MVP for DFDS review harnesses.

This module classifies a single output record or a small batch of records and
turns them into review items that can be stored or displayed in an internal
review console.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


VALID_STATUSES = {"pending", "approved", "needs_changes", "rejected"}
VALID_LAYERS = {"scope", "collection", "retrieval", "language", "release"}

SMALL_TALK_PATTERNS = [
    r"\bhow are you\b",
    r"\bhello\b",
    r"\bhi\b",
    r"\bhey\b",
    r"\bthanks?\b",
    r"\bgoodbye\b",
    r"\bweather\b",
]

ROUTE_PATTERNS = {
    "dover-calais": r"\bdover[-\s]?calais\b",
    "newhaven-dieppe": r"\bnewhaven[-\s]?dieppe\b",
    "newcastle-ijmuiden": r"\bnewcastle[-\s]?ijmuiden\b",
    "jersey": r"\bjersey\b|\bchannel islands\b",
}

NON_ENGLISH_HINTS = {
    "zh": [" 的 ", "吗", "请", "谢谢", "航线", "天气"],
    "da": [" og ", " ikke ", " hej ", " vejret", " tak ", " hvad", " hvat", "hvad ", " er ", " status ", " for "],
    "fr": [" et ", " le ", " la ", " merci ", "bonjour"],
    "de": [" und ", " nicht ", " hallo ", " wetter", " danke"],
    "es": [" y ", " no ", " hola ", " gracias", " clima"],
    "ja": ["です", "ます", "こんにちは", "天気"],
    "ko": ["입니다", "안녕하세요", "날씨", "감사"],
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def detect_route(text: str) -> str:
    text = normalize_text(text).lower()
    for route, pattern in ROUTE_PATTERNS.items():
        if re.search(pattern, text, re.IGNORECASE):
            return route
    return "all"


def classify_intent(text: str) -> str:
    text = normalize_text(text).lower()
    if not text:
        return "empty"
    if any(re.search(pattern, text) for pattern in SMALL_TALK_PATTERNS):
        return "small_talk"
    if any(token in text for token in ["recommend", "recommendation", "should we", "what should", "next step"]):
        return "recommendation"
    if any(token in text for token in ["review", "rating", "trustpilot", "google play", "app store", "google reviews"]):
        return "evidence_lookup"
    if any(token in text for token in ["why", "root cause", "cause", "reason"]):
        return "analysis"
    return "general"


def detect_language(text: str) -> str:
    text = normalize_text(text)
    if not text:
        return "en"
    if re.search(r"[\u4e00-\u9fff]", text):
        return "zh"
    if re.search(r"[\u3040-\u30ff]", text):
        return "ja"
    if re.search(r"[\uac00-\ud7af]", text):
        return "ko"
    lower = f" {text.lower()} "
    for code, hints in NON_ENGLISH_HINTS.items():
        if sum(1 for hint in hints if hint in lower) >= 2:
            return code
    return "en"


def is_long_english_blob(text: str) -> bool:
    text = normalize_text(text)
    if not text:
        return False
    english_words = len(re.findall(r"[A-Za-z]{3,}", text))
    return english_words >= 20


@dataclass
class ReviewItem:
    review_key: str
    subject_type: str
    subject_id: str
    subject_label: str
    title: str
    layer: str
    status: str
    severity: str
    source: str
    route_key: str
    reason: str
    recommendation: str
    publish_state: str
    original_output: str = ""
    supervisor_verdict: str = ""
    suggested_fix: str = ""
    downstream_impact: str = ""
    evidence_chain: list[str] = field(default_factory=list)
    artifacts: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.review_key,
            "review_key": self.review_key,
            "subject_type": self.subject_type,
            "subject_id": self.subject_id,
            "subject_label": self.subject_label,
            "title": self.title,
            "layer": self.layer,
            "status": self.status,
            "severity": self.severity,
            "source": self.source,
            "route_key": self.route_key,
            "reason": self.reason,
            "recommendation": self.recommendation,
            "publish_state": self.publish_state,
            "original_output": self.original_output,
            "supervisor_verdict": self.supervisor_verdict,
            "suggested_fix": self.suggested_fix,
            "downstream_impact": self.downstream_impact,
            "evidence_chain": list(self.evidence_chain),
            "artifacts": list(self.artifacts),
            "metadata": dict(self.metadata),
        }


def make_review_item(
    *,
    subject_type: str = "chat_case",
    subject_id: str = "",
    subject_label: str = "",
    title: str,
    layer: str,
    status: str,
    severity: str,
    source: str,
    route_key: str,
    reason: str,
    recommendation: str,
    publish_state: str = "internal_only",
    original_output: str = "",
    supervisor_verdict: str = "",
    suggested_fix: str = "",
    downstream_impact: str = "",
    evidence_chain: Iterable[str] | None = None,
    artifacts: Iterable[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> ReviewItem:
    if layer not in VALID_LAYERS:
        raise ValueError(f"Unsupported layer: {layer}")
    if status not in VALID_STATUSES:
        raise ValueError(f"Unsupported status: {status}")
    clean_recommendation = normalize_text(recommendation)
    clean_status = normalize_text(status)
    verdict = normalize_text(supervisor_verdict) or (
        "Rule checks passed." if clean_status == "approved" else "Rule checks found an issue that needs review."
    )
    fix = normalize_text(suggested_fix) or (clean_recommendation if clean_status != "approved" else "")
    return ReviewItem(
        review_key=f"review-{uuid.uuid4().hex[:12]}",
        subject_type=normalize_text(subject_type) or "chat_case",
        subject_id=normalize_text(subject_id) or f"subject-{uuid.uuid4().hex[:8]}",
        subject_label=normalize_text(subject_label) or normalize_text(title),
        title=normalize_text(title),
        layer=layer,
        status=status,
        severity=severity,
        source=normalize_text(source),
        route_key=normalize_text(route_key) or "all",
        reason=normalize_text(reason),
        recommendation=clean_recommendation,
        publish_state=publish_state,
        original_output=normalize_text(original_output),
        supervisor_verdict=verdict,
        suggested_fix=fix,
        downstream_impact=normalize_text(downstream_impact),
        evidence_chain=list(evidence_chain or []),
        artifacts=list(artifacts or []),
        metadata=dict(metadata or {}),
    )


def validate_chat_case(case: dict[str, Any]) -> ReviewItem:
    message = normalize_text(case.get("message"))
    response = normalize_text(case.get("response"))
    route_key = normalize_text(case.get("route_key") or case.get("route") or "all")
    route_key = route_key if route_key in ROUTE_PATTERNS else "all"
    detected_route = detect_route(message)
    intent = classify_intent(message)
    language = case.get("language") or detect_language(message)
    evidence_cards = case.get("evidence_cards") or []
    source_type = normalize_text(case.get("source_type") or case.get("source"))
    source_label = normalize_text(case.get("source_label") or source_type or "chat answer")
    subject_context = {
        "subject_type": normalize_text(case.get("subject_type") or "chat_case"),
        "subject_id": normalize_text(case.get("subject_id") or case.get("case_id") or ""),
        "subject_label": normalize_text(case.get("subject_label") or message or "Chat validation case"),
        "original_output": response,
        "downstream_impact": normalize_text(
            case.get("downstream_impact") or "May affect whether a generated answer is safe to surface in the dashboard."
        ),
    }
    checks: list[str] = [
        f"intent={intent}",
        f"language={language}",
        f"route={route_key}",
    ]

    if intent == "small_talk":
        if evidence_cards or "evidence" in response.lower():
            return make_review_item(
                **subject_context,
                title="Small talk triggered evidence retrieval",
                layer="language",
                status="needs_changes",
                severity="high",
                source=source_label,
                route_key=route_key,
                reason="A small-talk or weather prompt should not surface evidence cards or retrieval language.",
                recommendation="Route small-talk to a bridge reply before any evidence retrieval.",
                evidence_chain=[*checks, "small_talk_guard", "evidence_leak"],
                artifacts=[case.get("artifact", "")] if case.get("artifact") else [],
                metadata={"intent": intent, "detected_route": detected_route, "language": language},
            )
        return make_review_item(
            **subject_context,
            title="Small talk correctly bypassed evidence retrieval",
            layer="language",
            status="approved",
            severity="low",
            source=source_label,
            route_key=route_key,
            reason="The prompt is conversational and should receive a bridge reply only.",
            recommendation="Keep the small-talk guard before retrieval.",
            publish_state="verified",
            evidence_chain=[*checks, "small_talk_guard", "bridge_reply"],
            metadata={"intent": intent, "detected_route": detected_route, "language": language},
        )

    if detected_route != "all" and route_key != detected_route:
        return make_review_item(
            **subject_context,
            title="Route mention was not detected",
            layer="retrieval",
            status="needs_changes",
            severity="high",
            source=source_label,
            route_key=route_key,
            reason="The message names a route but the active route focus stayed at all.",
            recommendation="Promote message-level route detection above stale UI state.",
            evidence_chain=[*checks, "route_detection_missing"],
            metadata={"intent": intent, "detected_route": detected_route, "language": language},
        )

    if source_type in {"firecrawl", "firecrawl-search-result", "search-result"}:
        if "directional" not in response.lower():
            return make_review_item(
                **subject_context,
                title="Firecrawl search result was not labeled directional",
                layer="collection",
                status="needs_changes",
                severity="medium",
                source=source_label,
                route_key=route_key,
                reason="Directional search-result evidence should be labeled as such instead of presented like a full scrape.",
                recommendation="Mark search-result snapshots as directional evidence and explain the collection limit.",
                evidence_chain=[*checks, "search_result_evidence", "missing_directional_label"],
                metadata={"source_type": source_type, "language": language},
            )

    if source_type in {"reddit", "trustpilot"} and case.get("blocked", False):
        return make_review_item(
            **subject_context,
            title="Blocked source was handled without a clear warning",
            layer="collection",
            status="needs_changes",
            severity="high",
            source=source_label,
            route_key=route_key,
            reason="Blocked or verification-screen sources need an explicit warning and attempted URL in the review trail.",
            recommendation="Record the block state and attempted URL before using the source in analysis.",
            evidence_chain=[*checks, "blocked_source"],
            metadata={"source_type": source_type, "language": language},
        )

    if language != "en" and is_long_english_blob(response):
        return make_review_item(
            **subject_context,
            title="Non-English response leaked a long English evidence body",
            layer="language",
            status="needs_changes",
            severity="high",
            source=source_label,
            route_key=route_key,
            reason="Non-English questions should not surface long English evidence text in the main body.",
            recommendation="Keep evidence summaries in the detected input language and shorten the English fallback body.",
            evidence_chain=[*checks, "language_mismatch"],
            metadata={"language": language, "detected_route": detected_route},
        )

    if case.get("claims_based_on_reviews") and not evidence_cards:
        return make_review_item(
            **subject_context,
            title="Claimed review-based answer had no evidence cards",
            layer="retrieval",
            status="needs_changes",
            severity="high",
            source=source_label,
            route_key=route_key,
            reason="A review-based answer must carry evidence cards or a database citation trail.",
            recommendation="Attach evidence cards before the answer is eligible for publish.",
            evidence_chain=[*checks, "missing_evidence_cards"],
            metadata={"language": language, "detected_route": detected_route},
        )

    return make_review_item(
        **subject_context,
        title="Chat response passed validation",
        layer="retrieval" if intent in {"analysis", "recommendation", "evidence_lookup"} else "scope",
        status="approved",
        severity="low",
        source=source_label,
        route_key=route_key or detected_route or "all",
        reason="No rule violations were detected in the validation pass.",
        recommendation="Publish or keep internal depending on the current workflow state.",
        publish_state="verified",
        evidence_chain=[*checks, "pass"],
        metadata={"intent": intent, "language": language, "detected_route": detected_route},
    )


def validate_batch(cases: Iterable[dict[str, Any]], *, run_key: str | None = None) -> dict[str, Any]:
    run_key = run_key or f"run-{uuid.uuid4().hex[:10]}"
    items = [validate_chat_case(case) for case in cases]
    return {
        "run": {
            "run_key": run_key,
            "run_type": "validation_batch",
            "trigger_source": "manual",
            "status": "completed",
            "started_at": now_iso(),
            "finished_at": now_iso(),
            "summary": f"{len(items)} review items generated",
        },
        "items": [item.as_dict() for item in items],
    }


def load_cases(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict) and "cases" in payload:
        payload = payload["cases"]
    if not isinstance(payload, list):
        raise ValueError("Expected a JSON list or a dict with a 'cases' key")
    return payload


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the DFDS validation agent MVP")
    parser.add_argument("input", nargs="?", help="Optional JSON file containing validation cases")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output")
    parser.add_argument("--persist", action="store_true", help="Write the generated review run and items to PostgreSQL")
    parser.add_argument("--database-url", help="Override DATABASE_URL or REVIEW_DATABASE_URL when persisting")
    args = parser.parse_args(argv)

    if args.input:
        cases = load_cases(Path(args.input))
    else:
        cases = [
            {
                "message": "how is the weather",
                "response": "Bridge reply only.",
                "route_key": "all",
                "source_type": "chat",
                "evidence_cards": [],
            }
        ]

    result = validate_batch(cases)
    if args.persist:
        from review_store import persist_validation_result

        result["persistence"] = persist_validation_result(result, database_url=args.database_url)
    dump_kwargs = {"ensure_ascii": False}
    if args.pretty:
        dump_kwargs.update({"indent": 2, "sort_keys": True})
    sys.stdout.write(json.dumps(result, **dump_kwargs))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
