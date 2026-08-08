import csv
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]
OUTPUTS = ROOT / "data" / "survey"


class ExportTests(unittest.TestCase):
    def test_exported_curated_data_and_rag_documents_match(self):
        with (OUTPUTS / "dfds_synthetic_curated_survey_1500.csv").open(
            newline="", encoding="utf-8"
        ) as handle:
            rows = list(csv.DictReader(handle))
        documents = [
            json.loads(line)
            for line in (OUTPUTS / "dfds_rag_documents.jsonl").read_text(
                encoding="utf-8"
            ).splitlines()
        ]

        self.assertEqual(1500, len(rows))
        self.assertEqual(
            sum(row["rag_included"] == "true" for row in rows), len(documents)
        )
        self.assertTrue(
            all(
                row["synthetic_data_notice"].startswith("Synthetic") for row in rows
            )
        )

    def test_app_ready_index_matches_included_rag_documents(self):
        index = json.loads(
            (OUTPUTS / "dfds_rag_index.json").read_text(encoding="utf-8")
        )
        documents = [
            json.loads(line)
            for line in (OUTPUTS / "dfds_rag_documents.jsonl").read_text(
                encoding="utf-8"
            ).splitlines()
        ]

        self.assertEqual(documents, index)


if __name__ == "__main__":
    unittest.main()
