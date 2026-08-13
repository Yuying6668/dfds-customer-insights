import json
import unittest

from backend.mia_graph.observability import RedactedTracer, graph_audit_record, langfuse_batch_deletion_sink, record_graph_result_trace


class FakeLangfuseClient:
    def __init__(self):
        self.records = []

    def trace(self, **record):
        self.records.append(record)


class ObservabilityTests(unittest.TestCase):
    def test_graph_audit_record_gets_a_trace_id_without_raw_context(self):
        record = graph_audit_record({"graph": "conversation", "request_id": "req-1", "message": "email a@example.com", "actor_id": "u1"})
        self.assertTrue(record["trace_id"])
        self.assertNotIn("message", record)
        self.assertNotIn("a@example.com", json.dumps(record))

    def test_redacted_tracer_exposes_the_trace_id_to_callers(self):
        client = FakeLangfuseClient()
        tracer = RedactedTracer(client)
        with tracer.span("mia.conversation.run", {"graph": "conversation", "request_id": "req-2"}) as span:
            trace_id = span.trace_id
        self.assertTrue(trace_id)
        self.assertEqual(client.records[0]["id"], trace_id)
        self.assertEqual(client.records[0]["metadata"]["trace_id"], trace_id)

    def test_graph_audit_never_persists_raw_text_or_identity_values(self):
        record = graph_audit_record(
            {"message": "email a@example.com", "actor_id": "u1", "evidence_ids": ["e1"]}
        )
        serialized = json.dumps(record)
        self.assertNotIn("message", record)
        self.assertNotIn("actor_id", record)
        self.assertNotIn("a@example.com", serialized)
        self.assertNotIn("u1", serialized)
        self.assertEqual(record["evidence_ids"], ["e1"])

    def test_langfuse_deletion_sink_requires_batch_capable_adapter(self):
        sink = langfuse_batch_deletion_sink(client=object())
        with self.assertRaises(RuntimeError):
            sink("batch-1")

    def test_langfuse_deletion_sink_delegates_to_configured_adapter(self):
        deleted = []

        class Client:
            def delete_traces_for_batch(self, batch_id):
                deleted.append(batch_id)

        langfuse_batch_deletion_sink(client=Client())("batch-1")
        self.assertEqual(deleted, ["batch-1"])

    def test_graph_audit_record_keeps_versioned_result_contract(self):
        record = graph_audit_record({
            "graph": "conversation", "prompt_version": "conversation-answer-v1",
            "config_version": "mia-config-v1", "validation_verdict": {"status": "pass"},
            "final_outcome": "returned", "duration_ms": 12.3,
        })
        self.assertEqual(record["prompt_version"], "conversation-answer-v1")
        self.assertEqual(record["final_outcome"], "returned")
        self.assertEqual(record["duration_ms"], 12.3)

    def test_record_graph_result_trace_reuses_trace_id(self):
        client = FakeLangfuseClient()
        record = record_graph_result_trace(client, name="mia.conversation.result", state={"graph": "conversation", "trace_id": "trace-1", "final_outcome": "returned"})
        self.assertEqual(record["trace_id"], "trace-1")
        self.assertEqual(client.records[-1]["id"], "trace-1")


if __name__ == "__main__":
    unittest.main()
