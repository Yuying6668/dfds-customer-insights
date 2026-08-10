"""Pure retrieval-quality metrics for frozen RAG evaluation cases."""

from __future__ import annotations

from backend.mia_graph.evaluation import promotion_decision


def _first_relevant_rank(expected_ids, retrieved_ids, maximum_rank):
    expected = {str(value) for value in expected_ids}
    for position, value in enumerate(retrieved_ids[:maximum_rank], start=1):
        if str(value) in expected:
            return position
    return None


def score_cases(cases: list[dict]) -> dict[str, float | bool | int]:
    factual = [case for case in cases if case.get("expected_evidence_ids")]
    abstention = [case for case in cases if case.get("expects_abstention")]
    recall_hits = 0
    reciprocal_ranks = []
    for case in factual:
        rank = _first_relevant_rank(case["expected_evidence_ids"], case.get("retrieved_evidence_ids", []), 10)
        if rank is not None and rank <= 5:
            recall_hits += 1
        reciprocal_ranks.append(1 / rank if rank is not None else 0.0)

    abstention_hits = sum(
        not case.get("retrieved_evidence_ids") for case in abstention
    )
    recall_at_5 = recall_hits / len(factual) if factual else 0.0
    mrr_at_10 = sum(reciprocal_ranks) / len(reciprocal_ranks) if reciprocal_ranks else 0.0
    abstention_accuracy = abstention_hits / len(abstention) if abstention else 0.0
    return {
        "cases": len(cases),
        "factual_cases": len(factual),
        "abstention_cases": len(abstention),
        "recall_at_5": recall_at_5,
        "mrr_at_10": mrr_at_10,
        "abstention_accuracy": abstention_accuracy,
        "quality_gate_passed": (
            bool(factual)
            and bool(abstention)
            and recall_at_5 >= 0.90
            and mrr_at_10 >= 0.75
            and abstention_accuracy >= 0.90
        ),
    }
