"""Deterministically generate clearly labeled synthetic survey records."""

import random


NOTICE = "Synthetic simulated survey response - not real passenger data"

ROUTES = [
    ("English Channel", "Dover-Calais", "Short (under 3 hours)", ("United Kingdom", "France", "Germany")),
    ("English Channel", "Newhaven-Dieppe", "Medium (3-6 hours)", ("United Kingdom", "France", "Netherlands")),
    ("English Channel", "Dover-Dunkirk", "Short (under 3 hours)", ("United Kingdom", "France", "Belgium")),
    ("North Sea", "IJmuiden-Newcastle", "Long overnight (8+ hours)", ("Netherlands", "United Kingdom", "Germany")),
    ("North Sea", "Harwich-Hook of Holland", "Overnight (6-8 hours)", ("United Kingdom", "Netherlands", "Germany")),
    ("Baltic", "Karlshamn-Klaipeda", "Overnight (6-8 hours)", ("Sweden", "Lithuania", "Poland")),
    ("Baltic", "Kiel-Klaipeda", "Long overnight (8+ hours)", ("Germany", "Lithuania", "Sweden")),
    ("Norway coastal / overnight", "Copenhagen-Oslo", "Long overnight (8+ hours)", ("Denmark", "Norway", "Sweden")),
    ("Norway coastal / overnight", "Frederikshavn-Oslo", "Overnight (6-8 hours)", ("Denmark", "Norway", "Sweden")),
]

MOTIVATION_FIELDS = [
    "mot_price_value", "mot_convenience", "mot_car_access", "mot_comfort_break",
    "mot_scenery", "mot_sustainability", "mot_visiting_family", "mot_business_flexibility",
]
SATISFACTION_FIELDS = [
    "sat_booking", "sat_terminal", "sat_boarding", "sat_cabin_seating", "sat_food",
    "sat_cleanliness", "sat_staff", "sat_wifi", "sat_punctuality", "sat_value",
]


def _scale(rng, center, spread=1):
    return str(max(1, min(5, int(round(center + rng.choice(range(-spread, spread + 1)))))))


def _choice(rng, values):
    return rng.choice(values)


def _base_record(rng, number):
    region, corridor, duration, residences = _choice(rng, ROUTES)
    trip_purpose = _choice(rng, ["Leisure", "Leisure", "Visiting friends/family", "Business", "Holiday transit", "Freight work"])
    travel_type = "Freight driver" if trip_purpose == "Freight work" else _choice(rng, ["Foot passenger", "Car passenger", "Car passenger", "Motorcycle"])
    vehicle = "Van / freight vehicle" if travel_type == "Freight driver" else ("None" if travel_type == "Foot passenger" else "Motorcycle" if travel_type == "Motorcycle" else "Car")
    overnight = "overnight" in region or duration.startswith(("Overnight", "Long"))
    accommodation = _choice(rng, ["Private cabin", "Premium cabin", "Reclining seat"]) if overnight else _choice(rng, ["Standard seat", "Reclining seat", "Not applicable"])
    disruption = "Yes" if rng.random() < 0.14 else "No"
    price_sensitive = rng.choice([-1, 0, 0, 1])
    experience = max(1, min(5, 4 + rng.choice([-1, 0, 0, 0, 1]) - (1 if disruption == "Yes" else 0)))
    record = {
        "response_id": f"DFDS-{number:05d}", "synthetic_data_notice": NOTICE,
        "raw_defect_type": "", "age_band": _choice(rng, ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]),
        "gender": _choice(rng, ["Woman", "Man", "Non-binary", "Prefer not to say"]),
        "residence_region": _choice(rng, residences), "party_composition": "Business colleagues" if trip_purpose in {"Business", "Freight work"} else _choice(rng, ["Solo", "Couple", "Family with children", "Friends"]),
        "household_income_band": _choice(rng, ["Lower", "Middle", "Upper-middle", "Higher", "Prefer not to say"]),
        "accessibility_needs": _choice(rng, ["None", "None", "None", "Mobility assistance", "Hearing or vision support", "Other assistance"]),
        "route_region": region, "route_corridor": corridor, "travel_type": travel_type,
        "direction": _choice(rng, ["Outbound", "Return"]), "trip_purpose": trip_purpose,
        "vehicle": vehicle, "sailing_duration_band": duration, "accommodation": accommodation,
        "booking_channel": _choice(rng, ["DFDS website", "DFDS app", "Travel agent", "Phone", "Corporate booking"]),
        "travel_frequency": _choice(rng, ["First time", "Once a year", "2-3 times a year", "Monthly or more"]),
        "completion_seconds": str(rng.randint(180, 900)), "disruption_experienced": disruption,
    }
    record.update({
        "mot_price_value": _scale(rng, 4 + price_sensitive), "mot_convenience": _scale(rng, 4),
        "mot_car_access": _scale(rng, 5 if vehicle != "None" else 2), "mot_comfort_break": _scale(rng, 4 if overnight else 3),
        "mot_scenery": _scale(rng, 4 if region == "Norway coastal / overnight" else 3),
        "mot_sustainability": _scale(rng, 3), "mot_visiting_family": _scale(rng, 5 if trip_purpose == "Visiting friends/family" else 2),
        "mot_business_flexibility": _scale(rng, 5 if trip_purpose in {"Business", "Freight work"} else 2),
    })
    record.update({field: _scale(rng, experience) for field in SATISFACTION_FIELDS})
    record["sat_value"] = _scale(rng, experience + price_sensitive)
    record["sat_punctuality"] = _scale(rng, experience - (1 if disruption == "Yes" else 0))
    record["overall_satisfaction"] = _scale(rng, experience)
    overall = int(record["overall_satisfaction"])
    record["nps_band"] = "Promoter (9-10)" if overall >= 4 else "Passive (7-8)" if overall == 3 else "Detractor (0-6)"
    record["return_intent"] = _scale(rng, overall)
    record["recommend_intent"] = _scale(rng, overall)
    record["competitor_likelihood"] = _scale(rng, 6 - overall)
    record["service_recovery_evaluation"] = _scale(rng, experience) if disruption == "Yes" else "Not applicable"
    return record


def _inject_defect(record, number, records):
    selector = number % 41
    if selector == 0:
        record["raw_defect_type"] = "missing_values"
        record["sat_food"] = ""
        record["mot_sustainability"] = ""
        record["service_recovery_evaluation"] = ""
    elif selector == 1:
        record["raw_defect_type"] = "speeding"
        record["completion_seconds"] = str(45 + (number % 70))
    elif selector == 2:
        record["raw_defect_type"] = "straight_lining"
        for field in SATISFACTION_FIELDS:
            record[field] = "4"
        record["overall_satisfaction"] = "4"
    elif selector == 3 and records:
        record["raw_defect_type"] = "duplicate_pattern"
        source = records[-1]
        for key, value in source.items():
            if key not in {"response_id", "raw_defect_type"}:
                record[key] = value
        record["response_id"] = f"DFDS-{number:05d}"
        record["raw_defect_type"] = "duplicate_pattern"
    elif selector == 4:
        record["raw_defect_type"] = "route_trip_conflict"
        record["route_region"] = "English Channel"
        record["route_corridor"] = "Dover-Calais"
        record["sailing_duration_band"] = "Long overnight (8+ hours)"
        record["accommodation"] = "Private cabin"


def generate_records(count, seed):
    """Return exactly ``count`` deterministic, non-identifying synthetic records."""
    if count < 0:
        raise ValueError("count must be non-negative")
    rng = random.Random(seed)
    records = []
    for number in range(1, count + 1):
        record = _base_record(rng, number)
        _inject_defect(record, number, records)
        records.append(record)
    return records
