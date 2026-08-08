import unittest


def complete_record(**overrides):
    record = {
        "response_id": "DFDS-00001",
        "synthetic_data_notice": "Synthetic simulated survey response - not real passenger data",
        "raw_defect_type": "",
        "route_region": "English Channel",
        "route_corridor": "Dover-Calais",
        "trip_purpose": "Leisure",
        "travel_type": "Car passenger",
        "completion_seconds": "420",
        "overall_satisfaction": "4",
        "recommend_intent": "5",
        "mot_price_value": "5",
        "mot_convenience": "4",
        "sat_booking": "4",
        "sat_terminal": "4",
        "sat_boarding": "4",
        "sat_food": "3",
        "sat_staff": "5",
    }
    record.update(overrides)
    return record


class CurateSurveyTests(unittest.TestCase):
    def test_curate_record_preserves_every_raw_value_and_marks_speeding_for_caution(self):
        from backend.survey_pipeline.curate_survey import curate_record

        raw = complete_record(raw_defect_type="speeding", completion_seconds="55", source_note="retain me")
        curated = curate_record(raw)

        for field, value in raw.items():
            self.assertEqual(value, curated[field])
            self.assertEqual(value, curated[f"raw_{field}"])
        self.assertEqual(raw, {key: raw[key] for key in raw})
        self.assertEqual("Price and value", curated["motivation_summary"])
        self.assertEqual(4.0, curated["satisfaction_summary"])
        self.assertEqual("usable_with_caution", curated["quality_status"])
        self.assertTrue(curated["rag_included"])
        self.assertIn("speeding", curated["quality_flags"].split(";"))
        self.assertEqual(raw["synthetic_data_notice"], curated["synthetic_data_notice"])

    def test_curate_record_excludes_missing_core_and_route_trip_conflict(self):
        from backend.survey_pipeline.curate_survey import curate_record

        missing = curate_record(complete_record(overall_satisfaction="", recommend_intent=""))
        conflict = curate_record(complete_record(
            raw_defect_type="route_trip_conflict",
            sailing_duration_band="Long overnight (8+ hours)",
            accommodation="Private cabin",
        ))

        self.assertEqual("exclude_from_analysis", missing["quality_status"])
        self.assertFalse(missing["rag_included"])
        self.assertIn("missing_core", missing["quality_flags"].split(";"))
        self.assertEqual("exclude_from_analysis", conflict["quality_status"])
        self.assertIn("route_trip_conflict", conflict["quality_flags"].split(";"))

    def test_curate_record_requires_three_satisfaction_items_for_a_summary(self):
        from backend.survey_pipeline.curate_survey import curate_record

        curated = curate_record(complete_record(
            sat_booking="4", sat_terminal="", sat_boarding="", sat_food="", sat_staff="",
        ))

        self.assertIsNone(curated["satisfaction_summary"])

    def test_curate_record_flags_non_target_duplicate_and_straight_line_records(self):
        from backend.survey_pipeline.curate_survey import curate_record

        non_target = curate_record(complete_record(raw_defect_type="non_target"))
        duplicate = curate_record(complete_record(raw_defect_type="duplicate_pattern"))
        straight_line = curate_record(complete_record(
            raw_defect_type="straight_lining", sat_booking="4", sat_terminal="4",
            sat_boarding="4", sat_food="4", sat_staff="4",
        ))

        self.assertIn("non_target", non_target["quality_flags"].split(";"))
        self.assertEqual("exclude_from_analysis", non_target["quality_status"])
        self.assertIn("duplicate_pattern", duplicate["quality_flags"].split(";"))
        self.assertEqual("exclude_from_analysis", duplicate["quality_status"])
        self.assertIn("straight_lining", straight_line["quality_flags"].split(";"))
        self.assertEqual("usable_with_caution", straight_line["quality_status"])


class BuildRagTests(unittest.TestCase):
    def test_build_document_is_auditable_and_calls_records_simulated_responses(self):
        from backend.survey_pipeline.build_rag import build_document
        from backend.survey_pipeline.curate_survey import curate_record

        raw = complete_record()
        document = build_document(curate_record(raw))

        self.assertEqual("DFDS-00001", document["id"])
        self.assertIn("simulated response", document["text"].lower())
        self.assertNotIn("real evidence", document["text"].lower())
        self.assertEqual("English Channel", document["metadata"]["route_region"])
        self.assertEqual("Dover-Calais", document["metadata"]["route_corridor"])
        self.assertEqual("Leisure", document["metadata"]["trip_purpose"])
        self.assertEqual("Car passenger", document["metadata"]["travel_type"])
        self.assertEqual("4", document["metadata"]["overall_satisfaction"])
        self.assertEqual("5", document["metadata"]["recommend_intent"])
        self.assertEqual("usable", document["metadata"]["quality_status"])
        self.assertEqual(raw["synthetic_data_notice"], document["metadata"]["synthetic_data_notice"])
        self.assertEqual(raw, document["raw_answers"])


if __name__ == "__main__":
    unittest.main()
