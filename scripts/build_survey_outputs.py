#!/usr/bin/env python3
"""Build the deterministic, explicitly synthetic survey export set."""

import csv
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"
RAW_INTERCHANGE = ROOT / "work" / "raw_survey_records.json"
SEED = 20260730
RECORD_COUNT = 1500


def csv_value(value):
    """Keep CSV values explicit and portable, including JSON booleans."""
    if isinstance(value, bool):
        return str(value).lower()
    return "" if value is None else value


def write_csv(path, records):
    fieldnames = list(records[0])
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(
            {name: csv_value(record.get(name)) for name in fieldnames}
            for record in records
        )


def node_command():
    configured = os.environ.get("NODE_BIN")
    if configured:
        return configured
    return shutil.which("node") or "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node"


def build_workbooks():
    subprocess.run(
        [node_command(), str(ROOT / "scripts" / "export_workbooks.mjs")],
        cwd=ROOT,
        check=True,
    )


def main():
    sys.path.insert(0, str(ROOT / "backend"))
    from survey_pipeline.build_rag import build_document
    from survey_pipeline.curate_survey import curate_record
    from survey_pipeline.generate_survey import generate_records
    from survey_pipeline.survey_schema import FIELDS

    OUTPUTS.mkdir(exist_ok=True)
    RAW_INTERCHANGE.parent.mkdir(exist_ok=True)
    raw_records = generate_records(count=RECORD_COUNT, seed=SEED)
    curated_records = [curate_record(record) for record in raw_records]
    documents = [
        build_document(record) for record in curated_records if record["rag_included"]
    ]

    RAW_INTERCHANGE.write_text(
        json.dumps(raw_records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (RAW_INTERCHANGE.parent / "survey_data_dictionary.json").write_text(
        json.dumps(FIELDS, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    write_csv(OUTPUTS / "dfds_synthetic_curated_survey_1500.csv", curated_records)
    with (OUTPUTS / "dfds_rag_documents.jsonl").open("w", encoding="utf-8") as handle:
        for document in documents:
            handle.write(json.dumps(document, ensure_ascii=False) + "\n")
    (OUTPUTS / "dfds_rag_index.json").write_text(
        json.dumps(documents, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    build_workbooks()


if __name__ == "__main__":
    main()
