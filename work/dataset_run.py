"""Pure helpers for versioned upload dataset runs and safe aggregate analytics."""

import copy
import hashlib
import json
import re
import uuid
from datetime import datetime, timezone


ANALYSIS_VERSION = "analysis-v1"
SEMANTIC_MAPPING_VERSION = "semantic-mapping-v1"
EVENT_SCHEMA_VERSION = "dataset-run-event-v1"
RESTRICTED_FIELD = re.compile(r"email|customer|account|device|loyalty|alias|free.?text|phone|address|name", re.I)

# This registry is intentionally small. Unknown fields never become analytics inputs.
SEMANTIC_MAPPING_REGISTRY = (
    {"sourceType": "all", "fields": ("rating", "overall_score", "score"), "canonicalConcept": "rating", "dataType": "number", "privacy": "aggregate_safe", "aggregation": "average"},
    {"sourceType": "all", "fields": ("nps", "nps_score"), "canonicalConcept": "nps", "dataType": "number", "privacy": "aggregate_safe", "aggregation": "average"},
    {"sourceType": "all", "fields": ("csat", "csat_score"), "canonicalConcept": "csat", "dataType": "number", "privacy": "aggregate_safe", "aggregation": "average"},
    {"sourceType": "all", "fields": ("revenue", "gross_amount", "amount"), "canonicalConcept": "revenue", "dataType": "number", "privacy": "aggregate_safe", "aggregation": "sum"},
    {"sourceType": "all", "fields": ("bookings", "booking_count"), "canonicalConcept": "bookings", "dataType": "number", "privacy": "aggregate_safe", "aggregation": "sum"},
    {"sourceType": "it_data", "fields": ("delay", "delay_minutes"), "canonicalConcept": "delay", "dataType": "number", "privacy": "aggregate_safe", "aggregation": "average"},
    {"sourceType": "it_data", "fields": ("cancellation", "cancellation_rate", "cancelled"), "canonicalConcept": "cancellation", "dataType": "number", "privacy": "aggregate_safe", "aggregation": "average"},
    {"sourceType": "all", "fields": ("market",), "canonicalConcept": "market", "dataType": "category", "privacy": "aggregate_safe", "aggregation": "distribution"},
    {"sourceType": "all", "fields": ("route",), "canonicalConcept": "route", "dataType": "category", "privacy": "aggregate_safe", "aggregation": "distribution"},
    {"sourceType": "all", "fields": ("language",), "canonicalConcept": "language", "dataType": "category", "privacy": "aggregate_safe", "aggregation": "distribution"},
    {"sourceType": "all", "fields": ("country",), "canonicalConcept": "country", "dataType": "category", "privacy": "aggregate_safe", "aggregation": "distribution"},
)

SOURCE_PUBLISH_RULES = {
    "survey": {"ruleVersion": "survey-publish-v1", "warningKeys": ("mappingExceptions", "invalidRatingValues")},
    "it_data": {"ruleVersion": "it-data-publish-v1", "warningKeys": ("mappingExceptions", "invalidDateValues", "invalidAmountValues")},
}


class DatasetRunError(ValueError):
    """Raised when a run cannot be safely published."""


def _utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _canonical_field(field):
    if not field or RESTRICTED_FIELD.search(str(field)):
        return None
    return re.sub(r"[^a-z0-9]+", "_", str(field).strip().lower()).strip("_")


def resolve_semantic_mapping(source_type, field):
    """Return the versioned safe mapping for a source field, or ``None`` for unknown fields."""
    canonical = _canonical_field(field)
    if not canonical:
        return None
    source_type = str(source_type or "").lower()
    for mapping in SEMANTIC_MAPPING_REGISTRY:
        if canonical in mapping["fields"] and mapping["sourceType"] in ("all", source_type):
            result = copy.deepcopy(mapping)
            result["mappingVersion"] = SEMANTIC_MAPPING_VERSION
            return result
    return None


def _columns_from_manifest(manifest):
    columns = []
    for file_item in manifest.get("files", []):
        candidates = file_item.get("sheets", []) if isinstance(file_item, dict) else []
        if isinstance(file_item, dict) and "columns" in file_item:
            candidates = [file_item]
        for sheet in candidates:
            columns.extend(sheet.get("columns", []))
    return columns


def schema_fingerprint(columns, source_type=""):
    """Return a stable SHA-256 fingerprint for allowed canonical analytics concepts only."""
    concepts = sorted({
        mapping["canonicalConcept"]
        for column in columns
        for mapping in [resolve_semantic_mapping(source_type, column)]
        if mapping and mapping["privacy"] == "aggregate_safe"
    })
    encoded = json.dumps(concepts, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _analysis_version(dataset_run):
    lineage = dataset_run.get("lineage", {}) if isinstance(dataset_run, dict) else {}
    return str(lineage.get("analysisVersion") or ANALYSIS_VERSION)


def evaluate_publish_quality(source_type, quality):
    """Normalize quality into explicit source-specific blockers and warnings."""
    source_type = str(source_type or "").lower()
    rules = SOURCE_PUBLISH_RULES.get(source_type)
    blockers = list(quality.get("blockers") or [])
    cleaned_rows = int(quality.get("cleanedRows") or 0)
    if not rules:
        blockers.append("Unsupported source type")
        rules = {"ruleVersion": "unsupported", "warningKeys": ()}
    if cleaned_rows <= 0:
        blockers.append("Dataset run has no cleaned rows")
    blockers.extend(str(value) for value in (quality.get("fatalErrors") or []) if value)
    warnings = list(quality.get("warnings") or [])
    for key in rules["warningKeys"]:
        if int(quality.get(key) or 0) > 0:
            warnings.append("%s: %s" % (key, int(quality[key])))
    return {
        "sourceType": source_type,
        "cleanedRows": cleaned_rows,
        "mappingExceptions": int(quality.get("mappingExceptions") or 0),
        "invalidValues": int(quality.get("invalidValues") or 0),
        "blockers": sorted(set(blockers)),
        "warnings": sorted(set(warnings)),
        "readyToPublish": not blockers,
        "rulesApplied": {"mappingVersion": SEMANTIC_MAPPING_VERSION, "publishRuleVersion": rules["ruleVersion"]},
    }


def publish_run(manifest, owner_id, quality):
    """Return a copied manifest with an owned, eligible run marked published."""
    batch = manifest.get("batch") or {}
    if str(batch.get("ownerId") or "") != str(owner_id or ""):
        raise DatasetRunError("Only the batch owner may publish this dataset run")
    evaluated_quality = evaluate_publish_quality(batch.get("sourceType"), quality)
    if not evaluated_quality["readyToPublish"]:
        raise DatasetRunError("Dataset run has quality blockers")

    result = copy.deepcopy(manifest)
    result_batch = result.setdefault("batch", {})
    run = result_batch.setdefault("datasetRun", {})
    if run.get("state") == "published":
        return result
    run.update({"state": "published", "publishedAt": _utc_now(), "publishedBy": str(owner_id)})
    run.setdefault("analysisState", "not_started")
    run.setdefault("analysisGeneratedAt", None)
    run.setdefault("ragState", "not_requested")
    run["quality"] = evaluated_quality
    lineage = run.setdefault("lineage", {})
    lineage.setdefault("analysisVersion", ANALYSIS_VERSION)
    lineage["schemaFingerprint"] = schema_fingerprint(_columns_from_manifest(result), result_batch.get("sourceType"))
    lineage.setdefault("sourceType", result_batch.get("sourceType"))
    return result


def _number(value):
    if isinstance(value, bool) or value is None:
        return None
    try:
        return float(str(value).strip().replace(",", "."))
    except (TypeError, ValueError):
        return None


def _analysis_rows(sheet):
    """Use full cleaned rows first; preview rows require an explicit source declaration."""
    if isinstance(sheet.get("rows"), list):
        return sheet["rows"]
    if isinstance(sheet.get("cleanedRows"), list):
        return sheet["cleanedRows"]
    if sheet.get("analysisRowsSource") == "preview" and isinstance(sheet.get("previewRows"), list):
        return sheet["previewRows"]
    return []


def _safe_dimension_value(concept, value):
    candidate = str(value).strip()
    if not candidate or len(candidate) > 64 or any(char in candidate for char in "\r\n\t"):
        return None
    if concept in {"market", "country", "language"}:
        return candidate.upper() if re.fullmatch(r"[A-Za-z]{2,3}", candidate) else None
    return candidate if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 _-]{0,63}", candidate) else None


def _safe_quality(sheets):
    cleaning = [sheet.get("cleaning", {}) for sheet in sheets]
    return {
        "cleanedRows": sum(int(item.get("cleanedRows") or 0) for item in cleaning),
        "mappingExceptions": sum(int(item.get("mappingExceptions") or 0) for item in cleaning),
        "invalidValues": sum(int(item.get(key) or 0) for item in cleaning for key in ("invalidDateValues", "invalidAmountValues", "invalidRatingValues")),
    }


def build_analysis_snapshot(manifest, sheets):
    """Build a versioned aggregate-only analysis contract from explicit cleaned rows."""
    batch = manifest.get("batch") or {}
    run = batch.get("datasetRun") or {}
    source_type = batch.get("sourceType")
    quality = _safe_quality(sheets)
    metric_values, dimension_counts, available = {}, {}, set()
    columns = [column for sheet in sheets for column in sheet.get("columns", [])]

    for sheet in sheets:
        mapped_columns = [(column, resolve_semantic_mapping(source_type, column)) for column in sheet.get("columns", [])]
        available.update(mapping["canonicalConcept"] for _, mapping in mapped_columns if mapping)
        for row in _analysis_rows(sheet):
            for original, mapping in mapped_columns:
                if not mapping:
                    continue
                concept, value = mapping["canonicalConcept"], row.get(original)
                if mapping["aggregation"] == "average":
                    numeric = _number(value)
                    if numeric is not None:
                        metric_values.setdefault(concept, []).append(numeric)
                elif mapping["aggregation"] == "sum":
                    numeric = _number(value)
                    if numeric is not None:
                        metric_values.setdefault(concept, []).append(numeric)
                elif mapping["aggregation"] == "distribution":
                    safe_value = _safe_dimension_value(concept, value)
                    if safe_value:
                        counts = dimension_counts.setdefault(concept, {})
                        if len(counts) < 50 or safe_value in counts:
                            counts[safe_value] = counts.get(safe_value, 0) + 1

    metrics = {}
    for concept, values in sorted(metric_values.items()):
        metrics[concept] = {"average": round(sum(values) / len(values), 2), "sampleSize": len(values)} if concept in {"rating", "nps", "csat", "delay", "cancellation"} else {"sum": round(sum(values), 2), "sampleSize": len(values)}
    insights, recommendations = [], []
    rating = metrics.get("rating")
    if rating and rating["average"] < 3:
        evidence = {"metric": "rating", "value": rating["average"], "sampleSize": rating["sampleSize"]}
        insights.append({"type": "low_rating", "evidence": evidence})
        recommendations.append({"type": "review_low_rating_drivers", "evidence": evidence, "qualityContext": copy.deepcopy(quality)})

    return {
        "batchId": batch.get("id"), "version": batch.get("version"), "analysisVersion": _analysis_version(run), "generatedAt": _utc_now(),
        "datasetOverview": {"recordCount": quality["cleanedRows"], "sheetCount": len(sheets)}, "quality": quality,
        "metrics": metrics, "distributions": {key: dict(sorted(value.items())) for key, value in sorted(dimension_counts.items())},
        "insights": insights, "recommendations": recommendations,
        "schemaAvailability": {"availableConcepts": sorted(available), "schemaFingerprint": schema_fingerprint(columns, source_type)},
    }


def event_envelope(event_type, manifest):
    """Create a small versioned event containing lineage metadata only, never rows or values."""
    batch = manifest.get("batch") or {}
    run = batch.get("datasetRun") or {}
    lineage = run.get("lineage") or {}
    return {
        "eventId": str(uuid.uuid4()), "eventType": str(event_type), "occurredAt": _utc_now(),
        "batchId": batch.get("id"), "ownerId": batch.get("ownerId"), "sourceType": batch.get("sourceType") or lineage.get("sourceType"),
        "schemaFingerprint": schema_fingerprint(_columns_from_manifest(manifest), batch.get("sourceType")),
        "analysisVersion": _analysis_version(run), "eventSchemaVersion": EVENT_SCHEMA_VERSION,
    }
