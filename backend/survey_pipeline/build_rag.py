"""Render curated synthetic survey records as auditable RAG documents."""


def build_document(curated):
    """Create an English RAG document while retaining all raw source answers."""
    raw_answers = {
        field[4:]: value
        for field, value in curated.items()
        if field.startswith("raw_") and f"raw_{field}" not in curated
    }
    metadata_fields = (
        "route_region", "route_corridor", "trip_purpose", "travel_type", "overall_satisfaction",
        "recommend_intent", "quality_status", "synthetic_data_notice",
    )
    metadata = {field: curated.get(field, "") for field in metadata_fields}
    text = (
        f"This simulated response ({curated.get('response_id', '')}) is synthetic data, not a passenger observation. "
        f"Route: {curated.get('route_corridor', '')} in {curated.get('route_region', '')}. "
        f"Trip purpose: {curated.get('trip_purpose', '')}. "
        f"Overall satisfaction: {curated.get('overall_satisfaction', '')}/5; "
        f"recommendation intent: {curated.get('recommend_intent', '')}/5. "
        f"Motivation summary: {curated.get('motivation_summary', '')}. "
        f"Satisfaction summary: {curated.get('satisfaction_summary', '')}. "
        f"Quality status: {curated.get('quality_status', '')}."
    )
    return {"id": curated.get("response_id", ""), "text": text, "metadata": metadata, "raw_answers": raw_answers}
