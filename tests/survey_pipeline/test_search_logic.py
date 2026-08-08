import json
from pathlib import Path
import unittest

from server import score_document, tokenize


ROOT = Path(__file__).resolve().parents[2]


class SearchLogicTests(unittest.TestCase):
    def test_rag_index_has_auditable_metadata_and_raw_answers(self):
        records = json.loads((ROOT / "app/data/rag-index.json").read_text())
        self.assertTrue(records)
        sample = records[0]
        self.assertTrue({"id", "text", "metadata", "raw_answers"} <= sample.keys())
        self.assertTrue(sample["metadata"]["synthetic_data_notice"].startswith("Synthetic"))
        self.assertEqual(sample["raw_answers"]["response_id"], sample["id"])

    def test_token_scoring_is_case_insensitive_unique_and_searches_audit_fields(self):
        document = {"id": "DFDS-42", "text": "Boarding was smooth", "metadata": {"route": "Dover"}, "raw_answers": {"disruption": "Yes"}}
        self.assertEqual(tokenize("Boarding, BOARDING!"), ["boarding", "boarding"])
        self.assertEqual(score_document("BOARDING boarding Dover yes", document), 3)
        self.assertEqual(score_document("missing", document), 0)
