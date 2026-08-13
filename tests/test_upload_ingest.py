import unittest

from backend.upload_ingest import clean_sheet_rows


class UploadIngestTests(unittest.TestCase):
    def test_survey_workbook_with_notice_row_uses_real_header(self):
        header = ["response_id", "residence_region", "route_region", "route_corridor", "overall_satisfaction"]
        rows = [
            ["SYNTHETIC DATA ONLY: simulated survey responses"],
            header,
            ["DFDS-00001", "Denmark", "Baltic", "Copenhagen-Oslo", 4],
            ["DFDS-00002", "France", "English Channel", "Dover-Calais", 5],
        ]

        result = clean_sheet_rows(rows, preview_row_limit=None)

        self.assertEqual(result["columns"], header)
        self.assertEqual(result["dataRows"], 2)
        self.assertEqual(result["cleaning"]["cleanedRows"], 2)
        self.assertEqual(result["previewRows"][0]["response_id"], "DFDS-00001")


if __name__ == "__main__":
    unittest.main()
