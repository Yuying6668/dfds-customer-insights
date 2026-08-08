import unittest


class GenerateSurveyTests(unittest.TestCase):
    def test_generate_records_returns_exact_deterministic_count_with_notice(self):
        from backend.survey_pipeline.generate_survey import generate_records

        first = generate_records(count=1500, seed=20260730)
        second = generate_records(count=1500, seed=20260730)

        self.assertEqual(1500, len(first))
        self.assertEqual(first, second)
        self.assertEqual(
            [f"DFDS-{number:05d}" for number in range(1, 1501)],
            [record["response_id"] for record in first],
        )
        self.assertTrue(
            all(
                record["synthetic_data_notice"].startswith(
                    "Synthetic simulated survey response - not real passenger data"
                )
                for record in first
            )
        )

    def test_records_use_closed_choices_and_five_point_scales(self):
        from backend.survey_pipeline.generate_survey import generate_records
        from backend.survey_pipeline.survey_schema import FIELDS

        records = generate_records(count=250, seed=20260730)
        scale_fields = [field["name"] for field in FIELDS if field["scale"] == "1-5"]

        self.assertTrue(scale_fields)
        for record in records:
            for field_name in scale_fields:
                value = record[field_name]
                if value:
                    self.assertIn(value, {"1", "2", "3", "4", "5"})

        service_recovery = next(
            field for field in FIELDS if field["name"] == "service_recovery_evaluation"
        )
        self.assertIn("Not applicable", {option["code"] for option in service_recovery["options"]})
        for record in records:
            value = record["service_recovery_evaluation"]
            if record["raw_defect_type"] == "missing_values":
                self.assertEqual("", value)
            elif record["disruption_experienced"] == "No":
                self.assertEqual("Not applicable", value)
            else:
                self.assertIn(value, {"1", "2", "3", "4", "5"})

    def test_emitted_categorical_values_are_declared_in_schema(self):
        from backend.survey_pipeline.generate_survey import generate_records
        from backend.survey_pipeline.survey_schema import FIELDS

        records = generate_records(count=1500, seed=20260730)
        categorical_fields = [field for field in FIELDS if field["type"] == "category"]

        for field in categorical_fields:
            with self.subTest(field=field["name"]):
                self.assertTrue(field["options"])
                allowed = set(field["options"])
                self.assertTrue(
                    all(record[field["name"]] in allowed for record in records)
                )

    def test_records_include_representative_route_and_passenger_choices(self):
        from backend.survey_pipeline.generate_survey import generate_records

        records = generate_records(count=1500, seed=20260730)
        route_regions = {record["route_region"] for record in records}
        corridors = {record["route_corridor"] for record in records}

        self.assertEqual(
            {"English Channel", "North Sea", "Baltic", "Norway coastal / overnight"},
            route_regions,
        )
        self.assertGreaterEqual(len(corridors), 8)
        self.assertTrue(all(record["age_band"] for record in records))
        self.assertTrue(all(record["trip_purpose"] for record in records))
        self.assertTrue(all(record["sailing_duration_band"] for record in records))

    def test_records_intentionally_include_raw_data_defects(self):
        from backend.survey_pipeline.generate_survey import generate_records

        records = generate_records(count=1500, seed=20260730)

        self.assertTrue(any(not record["sat_food"] for record in records))
        self.assertTrue(any(int(record["completion_seconds"]) < 120 for record in records))
        self.assertTrue(any(record["raw_defect_type"] == "straight_lining" for record in records))
        self.assertTrue(any(record["raw_defect_type"] == "duplicate_pattern" for record in records))
        self.assertTrue(any(record["raw_defect_type"] == "route_trip_conflict" for record in records))

        duplicate_records = [
            record for record in records if record["raw_defect_type"] == "duplicate_pattern"
        ]
        self.assertTrue(
            all(
                any(
                    candidate["response_id"] != duplicate["response_id"]
                    and all(
                        candidate[key] == duplicate[key]
                        for key in duplicate
                        if key not in {"response_id", "raw_defect_type"}
                    )
                    for candidate in records
                )
                for duplicate in duplicate_records
            )
        )

        conflict_records = [
            record for record in records if record["raw_defect_type"] == "route_trip_conflict"
        ]
        self.assertTrue(
            all(
                record["route_region"] == "English Channel"
                and record["route_corridor"] == "Dover-Calais"
                and record["sailing_duration_band"] == "Long overnight (8+ hours)"
                and record["accommodation"] == "Private cabin"
                for record in conflict_records
            )
        )

        straight_line_records = [
            record for record in records if record["raw_defect_type"] == "straight_lining"
        ]
        self.assertTrue(
            any(
                len(
                    {
                        record[field]
                        for field in (
                            "sat_booking",
                            "sat_terminal",
                            "sat_boarding",
                            "sat_cleanliness",
                            "sat_staff",
                        )
                    }
                )
                == 1
                for record in straight_line_records
            )
        )

    def test_dover_dunkirk_is_an_english_channel_corridor(self):
        from backend.survey_pipeline.generate_survey import generate_records

        records = generate_records(count=1500, seed=20260730)
        self.assertTrue(
            all(
                record["route_region"] == "English Channel"
                for record in records
                if record["route_corridor"] == "Dover-Dunkirk"
            )
        )


if __name__ == "__main__":
    unittest.main()
