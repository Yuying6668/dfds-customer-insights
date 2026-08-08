"""Closed-choice questionnaire metadata for synthetic passenger responses."""

SCALE_OPTIONS = [
    {"code": "1", "label": "Strongly disagree / very dissatisfied"},
    {"code": "2", "label": "Disagree / dissatisfied"},
    {"code": "3", "label": "Neutral"},
    {"code": "4", "label": "Agree / satisfied"},
    {"code": "5", "label": "Strongly agree / very satisfied"},
]


def _category(name, label, section, options):
    return {"name": name, "label": label, "section": section, "type": "category", "options": options, "scale": ""}


def _scale(name, label, section):
    return {"name": name, "label": label, "section": section, "type": "closed_choice", "options": SCALE_OPTIONS, "scale": "1-5"}


FIELDS = [
    {"name": "response_id", "label": "Synthetic response identifier", "section": "Audit", "type": "metadata", "options": [], "scale": ""},
    {"name": "synthetic_data_notice", "label": "Synthetic-data disclosure", "section": "Audit", "type": "metadata", "options": [], "scale": ""},
    _category("raw_defect_type", "Intentional raw-data defect type", "Audit", ["", "missing_values", "speeding", "straight_lining", "duplicate_pattern", "route_trip_conflict"]),
    _category("age_band", "Age band", "Passenger profile", ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]),
    _category("gender", "Gender", "Passenger profile", ["Woman", "Man", "Non-binary", "Prefer not to say"]),
    _category("residence_region", "Residence region", "Passenger profile", ["Belgium", "Denmark", "France", "Germany", "Lithuania", "Netherlands", "Norway", "Poland", "Sweden", "United Kingdom"]),
    _category("party_composition", "Travel party", "Passenger profile", ["Solo", "Couple", "Family with children", "Friends", "Business colleagues"]),
    _category("household_income_band", "Household income band", "Passenger profile", ["Lower", "Middle", "Upper-middle", "Higher", "Prefer not to say"]),
    _category("accessibility_needs", "Accessibility needs", "Passenger profile", ["None", "Mobility assistance", "Hearing or vision support", "Other assistance"]),
    _category("route_region", "Route region", "Journey context", ["English Channel", "North Sea", "Baltic", "Norway coastal / overnight"]),
    _category("route_corridor", "Representative route corridor", "Journey context", ["Dover-Calais", "Newhaven-Dieppe", "Dover-Dunkirk", "IJmuiden-Newcastle", "Harwich-Hook of Holland", "Karlshamn-Klaipeda", "Kiel-Klaipeda", "Copenhagen-Oslo", "Frederikshavn-Oslo"]),
    _category("travel_type", "Travel type", "Journey context", ["Foot passenger", "Car passenger", "Motorcycle", "Freight driver"]),
    _category("direction", "Journey direction", "Journey context", ["Outbound", "Return"]),
    _category("trip_purpose", "Trip purpose", "Journey context", ["Leisure", "Visiting friends/family", "Business", "Holiday transit", "Freight work"]),
    _category("vehicle", "Vehicle on sailing", "Journey context", ["None", "Car", "Motorcycle", "Van / freight vehicle"]),
    _category("sailing_duration_band", "Sailing duration", "Journey context", ["Short (under 3 hours)", "Medium (3-6 hours)", "Overnight (6-8 hours)", "Long overnight (8+ hours)"]),
    _category("accommodation", "Accommodation or seating", "Journey context", ["Standard seat", "Reclining seat", "Private cabin", "Premium cabin", "Not applicable"]),
    _category("booking_channel", "Booking channel", "Journey context", ["DFDS website", "DFDS app", "Travel agent", "Phone", "Corporate booking"]),
    _category("travel_frequency", "Ferry travel frequency", "Journey context", ["First time", "Once a year", "2-3 times a year", "Monthly or more"]),
    {"name": "completion_seconds", "label": "Survey completion duration in seconds", "section": "Audit", "type": "duration", "options": [], "scale": "seconds"},
    _category("disruption_experienced", "Experienced a disruption", "Experience", ["Yes", "No"]),
    _category("nps_band", "Recommendation score band", "Experience", ["Detractor (0-6)", "Passive (7-8)", "Promoter (9-10)"]),
]

for _name, _label in [
    ("mot_price_value", "Price and value motivated this journey"),
    ("mot_convenience", "Convenience motivated this journey"),
    ("mot_car_access", "Taking a vehicle motivated this journey"),
    ("mot_comfort_break", "Comfort and a break from driving motivated this journey"),
    ("mot_scenery", "Scenery and the sea crossing motivated this journey"),
    ("mot_sustainability", "Sustainability motivated this journey"),
    ("mot_visiting_family", "Visiting family or friends motivated this journey"),
    ("mot_business_flexibility", "Business flexibility motivated this journey"),
]:
    FIELDS.append(_scale(_name, _label, "Travel motivation"))

for _name, _label in [
    ("sat_booking", "Satisfaction with booking"),
    ("sat_terminal", "Satisfaction with terminal"),
    ("sat_boarding", "Satisfaction with boarding"),
    ("sat_cabin_seating", "Satisfaction with cabin or seating"),
    ("sat_food", "Satisfaction with food and drink"),
    ("sat_cleanliness", "Satisfaction with cleanliness"),
    ("sat_staff", "Satisfaction with staff"),
    ("sat_wifi", "Satisfaction with Wi-Fi"),
    ("sat_punctuality", "Satisfaction with punctuality"),
    ("sat_value", "Satisfaction with value"),
    ("overall_satisfaction", "Overall satisfaction"),
    ("return_intent", "Likely to travel with DFDS again"),
    ("recommend_intent", "Likely to recommend DFDS"),
    ("competitor_likelihood", "Likely to choose a competing operator"),
    ("service_recovery_evaluation", "Satisfaction with service recovery"),
]:
    FIELDS.append(_scale(_name, _label, "Experience and future behavior"))

for _field in FIELDS:
    if _field["name"] == "service_recovery_evaluation":
        _field["options"] = SCALE_OPTIONS + [{"code": "Not applicable", "label": "No disruption experienced"}]
        _field["scale"] = "1-5 / Not applicable"
        break
