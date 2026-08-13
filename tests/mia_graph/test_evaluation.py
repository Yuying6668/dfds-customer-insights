import unittest

from backend.mia_graph.evaluation import (
    build_evaluation_graph,
    build_evaluation_run,
    aggregate_human_calibration,
    promotion_decision,
    parse_judge_verdict,
    score_evaluation_cases,
    validate_human_calibration_record,
)


class FakeEvaluationServices:
    def __init__(self):
        self.retrieval_inputs = []
        self.answer_inputs = []

    def retrieve_case(self, case):
        self.retrieval_inputs.append(case)
        return {"retrieved_evidence_ids": ["e1"], "latency_ms": 12}

    def answer_case(self, case, retrieval):
        self.answer_inputs.append(case)
        return {"answer": "Grounded answer [e1]", "latency_ms": 8, "model_usage": {"total_tokens": 12}}

    def judge_case(self, result, labels):
        return {"citation_correct": result["retrieved_evidence_ids"] == labels["expected_evidence_ids"], "judge_score": 0.9}


def invoke_evaluation(services, cases, **state):
    prepared = build_evaluation_run(cases)
    graph = build_evaluation_graph(services=services, label_vault=prepared["label_vault"])
    return graph.invoke({"cases": prepared["live_retrieval_payload"]["cases"], **state})


class EvaluationGraphTests(unittest.TestCase):
    def test_human_calibration_outcomes_feed_metrics_and_gate(self):
        report = score_evaluation_cases([
            {"expected_evidence_ids": ["e1"], "retrieved_evidence_ids": ["e1"], "citation_correct": True, "judge_score": 1.0, "expects_abstention": False, "latency_ms": 10, "failed": False, "human_review": {"overall_score": 1.0, "citation_correct": False, "should_abstain": False, "policy_issue": True}},
        ])
        self.assertEqual(report["human_review"]["reviewed_cases"], 1)
        self.assertEqual(report["metrics"]["human_overall_score"], 0.2)
        decision = promotion_decision(report["metrics"], {"recall_at_5": 1.0, "citation_correctness": 1.0, "human_overall_score": 0.8})
        self.assertEqual(decision["promotion_state"], "blocked")
        self.assertIn("human_review_regression", decision["reasons"])

    def test_evaluation_failure_is_bounded_and_recoverable(self):
        class Failing(FakeEvaluationServices):
            def retrieve_case(self, case):
                raise RuntimeError("retrieval down")
        state = invoke_evaluation(Failing(), [{"question": "Q", "expected_evidence_ids": ["e1"]}], baseline_metrics={"recall_at_5": 0.8})
        self.assertEqual(state["failure_state"], "failed")
        self.assertEqual(state["retry"]["attempts"], 3)
        self.assertIn("last_safe_state", state)

    def test_answer_and_judge_failures_are_bounded_and_recoverable(self):
        class FailingAnswer(FakeEvaluationServices):
            def answer_case(self, case, retrieval):
                raise RuntimeError("model down")
        state = invoke_evaluation(FailingAnswer(), [{"question": "Q", "expected_evidence_ids": ["e1"]}], baseline_metrics={"recall_at_5": 0.8})
        self.assertEqual(state["failure_state"], "failed")
        self.assertEqual(state["failure_node"], "execute_cases.answer")
    def test_human_calibration_record_requires_all_review_dimensions(self):
        with self.assertRaises(ValueError):
            validate_human_calibration_record({"case_id": "cal-001", "overall_score": 4})

    def test_human_calibration_is_aggregated_separately_from_automated_judge(self):
        report = aggregate_human_calibration([
            {
                "case_id": "cal-001",
                "dimension_scores": {key: 4 for key in ("groundedness", "citation_correctness", "answer_completeness", "uncertainty_calibration", "policy_safety")},
                "overall_score": 4,
                "citation_correct": True,
                "should_abstain": False,
                "policy_issue": False,
                "notes": "Good grounded answer",
                "reviewer_id": "reviewer-1",
                "reviewed_at": "2026-08-10T00:00:00Z",
                "judge_score": 0.9,
            },
        ])
        self.assertEqual(report["reviewed_cases"], 1)
        self.assertEqual(report["overall_score_mean"], 4.0)
        self.assertEqual(report["human_scores"]["groundedness"], 4.0)
        self.assertEqual(report["judge_score_mean"], 0.9)
        self.assertNotIn("judge_score", report["human_scores"])

    def test_versioned_llm_judge_verdict_requires_a_bounded_score(self):
        verdict = parse_judge_verdict('{"score": 0.75, "citation_correct": true, "rubric_version": "answer-quality-v1"}')
        self.assertEqual(verdict["judge_score"], 0.75)
        self.assertTrue(verdict["citation_correct"])
        with self.assertRaises(ValueError):
            parse_judge_verdict('{"score": 2}')
    def test_evaluation_graph_blocks_a_regressed_candidate(self):
        state = invoke_evaluation(None, [{"question": "Q", "expected_answer": "secret", "expected_evidence_ids": ["e1"]}], current_metrics={"recall_at_5": 0.82, "citation_correctness": 0.96}, baseline_metrics={"recall_at_5": 0.90, "citation_correctness": 0.95})
        self.assertEqual(state["promotion_state"], "blocked")
        self.assertNotIn("expected_answer", state["live_retrieval_payload"])
        self.assertEqual(state["workflow_steps"][-1], "block_promotion")

    def test_regressed_recall_blocks_promotion(self):
        result = promotion_decision(
            {"recall_at_5": 0.82, "citation_correctness": 0.96},
            {"recall_at_5": 0.90, "citation_correctness": 0.95},
        )
        self.assertEqual(result["promotion_state"], "blocked")
        self.assertIn("recall_at_5_regression", result["reasons"])

    def test_missing_baseline_blocks_promotion_until_an_administrator_sets_one(self):
        result = promotion_decision({"recall_at_5": 1.0, "citation_correctness": 1.0}, {})
        self.assertEqual(result["promotion_state"], "blocked")
        self.assertEqual(result["reasons"], ["baseline_required"])

    def test_absolute_quality_regression_thresholds_block_even_when_baseline_is_low(self):
        result = promotion_decision(
            {"recall_at_5": 0.75, "citation_correctness": 0.5, "answer_quality": 0.6, "abstention_accuracy": 0.0, "p95_latency_ms": 3909, "failure_rate": 0.0},
            {"recall_at_5": 0.0, "citation_correctness": 0.0},
        )
        self.assertEqual(result["promotion_state"], "blocked")
        self.assertIn("answer_quality_below_minimum", result["reasons"])
        self.assertIn("abstention_accuracy_below_minimum", result["reasons"])

    def test_heldout_expected_answers_never_reach_live_retrieval(self):
        run = build_evaluation_run([
            {"question": "Q", "expected_answer": "secret", "expected_evidence_ids": ["e1"]}
        ])
        self.assertNotIn("expected_answer", run["live_retrieval_payload"])
        self.assertNotIn("expected_evidence_ids", run["live_retrieval_payload"])

    def test_scores_required_metrics_and_segments(self):
        report = score_evaluation_cases([
            {
                "language": "Danish", "route": "copenhagen-oslo", "source_type": "review",
                "expected_evidence_ids": ["e1"], "retrieved_evidence_ids": ["e1", "e2"],
                "expected_answer": "Boarding was slow", "answer": "Boarding was slow [e1]",
                "citation_correct": True, "judge_score": 0.9, "expects_abstention": False,
                "latency_ms": 120, "failed": False,
            },
            {
                "language": "English", "route": "all", "source_type": "survey",
                "expected_evidence_ids": [], "retrieved_evidence_ids": [],
                "expected_answer": "", "answer": "I do not have enough evidence.",
                "citation_correct": True, "judge_score": 0.8, "expects_abstention": True,
                "latency_ms": 240, "failed": False,
            },
        ])
        self.assertEqual(report["metrics"]["recall_at_5"], 1.0)
        self.assertEqual(report["metrics"]["citation_correctness"], 1.0)
        self.assertAlmostEqual(report["metrics"]["answer_quality"], 0.85)
        self.assertEqual(report["metrics"]["abstention_accuracy"], 1.0)
        self.assertEqual(report["metrics"]["p95_latency_ms"], 240.0)
        self.assertEqual(report["metrics"]["failure_rate"], 0.0)
        self.assertEqual(report["segments"]["language:Danish"]["cases"], 1)
        self.assertEqual(report["segments"]["route:copenhagen-oslo"]["recall_at_5"], 1.0)
        self.assertEqual(report["segments"]["source_type:survey"]["abstention_accuracy"], 1.0)

    def test_human_review_metrics_are_in_each_matching_segment(self):
        record = {"case_id": "case-1", "dimension_scores": {key: 4 for key in ("groundedness", "citation_correctness", "answer_completeness", "uncertainty_calibration", "policy_safety")}, "overall_score": 4, "citation_correct": True, "should_abstain": False, "policy_issue": False, "notes": "good", "reviewer_id": "r1", "reviewed_at": "now"}
        report = score_evaluation_cases([{"language": "Danish", "route": "route-a", "source_type": "review", "human_review": record}])
        self.assertEqual(report["segments"]["language:Danish"]["human_overall_score"], 0.8)

    def test_graph_executes_services_without_exposing_frozen_labels_to_live_calls(self):
        services = FakeEvaluationServices()
        state = invoke_evaluation(services, [{
                "question": "Why was boarding slow?", "language": "Danish", "route": "copenhagen-oslo", "source_type": "review",
                "expected_answer": "withheld", "expected_evidence_ids": ["e1"], "expects_abstention": False,
            }], baseline_metrics={"recall_at_5": 0.8, "citation_correctness": 0.8})
        self.assertEqual(state["scored_metrics"]["recall_at_5"], 1.0)
        self.assertEqual(state["promotion_state"], "accepted")
        self.assertNotIn("expected_answer", services.retrieval_inputs[0])
        self.assertNotIn("expected_evidence_ids", services.answer_inputs[0])


if __name__ == "__main__":
    unittest.main()
