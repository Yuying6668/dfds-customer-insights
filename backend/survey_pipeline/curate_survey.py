"""Curate synthetic survey records without losing their source values."""

from .generate_survey import MOTIVATION_FIELDS, SATISFACTION_FIELDS


MOTIVATION_LABELS = {
    "mot_price_value": "Price and value",
    "mot_convenience": "Convenience",
    "mot_car_access": "Vehicle access",
    "mot_comfort_break": "Comfort and a break from driving",
    "mot_scenery": "Scenery and the crossing",
    "mot_sustainability": "Sustainability",
    "mot_visiting_family": "Visiting family or friends",
    "mot_business_flexibility": "Business flexibility",
}

VALID_TRAVEL_TYPES = {"Foot passenger", "Car passenger", "Motorcycle", "Freight driver"}
VALID_PURPOSES = {"Leisure", "Visiting friends/family", "Business", "Holiday transit", "Freight work"}
CORRIDOR_CONTEXT = {
    "Dover-Calais": ("English Channel", "Short (under 3 hours)"),
    "Newhaven-Dieppe": ("English Channel", "Medium (3-6 hours)"),
    "Dover-Dunkirk": ("English Channel", "Short (under 3 hours)"),
    "IJmuiden-Newcastle": ("North Sea", "Long overnight (8+ hours)"),
    "Harwich-Hook of Holland": ("North Sea", "Overnight (6-8 hours)"),
    "Karlshamn-Klaipeda": ("Baltic", "Overnight (6-8 hours)"),
    "Kiel-Klaipeda": ("Baltic", "Long overnight (8+ hours)"),
    "Copenhagen-Oslo": ("Norway coastal / overnight", "Long overnight (8+ hours)"),
    "Frederikshavn-Oslo": ("Norway coastal / overnight", "Overnight (6-8 hours)"),
}


def _normalise(value):
    return value.strip() if isinstance(value, str) else value


def _score(value):
    try:
        score = int(value)
    except (TypeError, ValueError):
        return None
    return score if 1 <= score <= 5 else None


def _mean_score(record, fields, minimum_items=1):
    scores = [_score(record.get(field)) for field in fields]
    valid_scores = [score for score in scores if score is not None]
    return (
        round(sum(valid_scores) / len(valid_scores), 2)
        if len(valid_scores) >= minimum_items
        else None
    )


def _quality_flags(record):
    flags = []
    defect = record.get("raw_defect_type", "")
    if not record.get("response_id") or _score(record.get("overall_satisfaction")) is None or _score(record.get("recommend_intent")) is None:
        flags.append("missing_core")
    completion = record.get("completion_seconds")
    try:
        is_speeding = int(completion) < 120
    except (TypeError, ValueError):
        is_speeding = False
    if defect == "speeding" or is_speeding:
        flags.append("speeding")
    satisfaction_scores = [_score(record.get(field)) for field in SATISFACTION_FIELDS]
    populated = [score for score in satisfaction_scores if score is not None]
    if defect == "straight_lining" or (len(populated) >= 5 and len(set(populated)) == 1):
        flags.append("straight_lining")
    expected = CORRIDOR_CONTEXT.get(record.get("route_corridor"))
    supplied_route = record.get("route_region")
    supplied_duration = record.get("sailing_duration_band")
    conflict = expected and (
        (supplied_route and supplied_route != expected[0])
        or (supplied_duration and supplied_duration != expected[1])
    )
    if defect == "route_trip_conflict" or conflict:
        flags.append("route_trip_conflict")
    if defect == "duplicate_pattern":
        flags.append("duplicate_pattern")
    if defect == "non_target" or record.get("travel_type") not in VALID_TRAVEL_TYPES or record.get("trip_purpose") not in VALID_PURPOSES:
        flags.append("non_target")
    return flags


def curate_record(raw):
    """Return a normalized record while retaining an exact raw-value audit trail."""
    curated = {field: _normalise(value) for field, value in raw.items()}
    curated.update({f"raw_{field}": value for field, value in raw.items()})

    salient_motivations = [
        MOTIVATION_LABELS[field]
        for field in MOTIVATION_FIELDS
        if _score(curated.get(field)) == 5
    ]
    curated["motivation_summary"] = "; ".join(salient_motivations) or "No strong stated motivation"
    curated["satisfaction_summary"] = _mean_score(
        curated, SATISFACTION_FIELDS, minimum_items=3
    )

    flags = _quality_flags(curated)
    curated["quality_flags"] = ";".join(flags)
    excluded = {"missing_core", "route_trip_conflict", "duplicate_pattern", "non_target"}
    caution = {"speeding", "straight_lining"}
    curated["quality_status"] = (
        "exclude_from_analysis" if excluded.intersection(flags)
        else "usable_with_caution" if caution.intersection(flags)
        else "usable"
    )
    curated["rag_included"] = curated["quality_status"] != "exclude_from_analysis"
    return curated
