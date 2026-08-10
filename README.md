# DFDS Customer Insights / MIA

This repository consolidates the DFDS customer-insights product and its MIA (Mia's Cruises) interview-facing experience. It includes the React/Vite dashboard, Python ingestion and retrieval services, database schema, survey/RAG pipeline, test suites, and dated design and delivery logs.

## Layout

- `app/`: React dashboard and static data modules.
- `backend/`: ingestion, retrieval, identity, and `survey_pipeline/` modules.
- `data/`: small checked-in seed/playbook data only.
- `db/`, `sql/`: database schemas and SQL utilities.
- `scripts/`: reproducible import, export, and survey-build commands.
- `docs/`: specifications, implementation plans, response guidance, and project logs.
- `tests/`: Node and Python tests, grouped by product area.

## Local checks

```bash
python3 -m compileall server.py backend scripts
python3 -m unittest discover -s tests -p 'test_*.py'
pnpm test
pnpm build
```

The survey pipeline is explicitly synthetic and is not evidence about real DFDS passengers:

```bash
python3 scripts/build_survey_outputs.py
```

Create delivery work on the `Mia` branch. Keep `.env`, virtual environments, caches, generated exports, and local credentials untracked.

## Mia graph operations

The bounded Mia graphs use `LANGGRAPH_CHECKPOINT_DATABASE_URL` for PostgreSQL checkpoints. Without it, local development uses an in-memory checkpoint. Optional Langfuse configuration is `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_HOST`.

Before enabling external processors, confirm an approved DPA, data residency, retention period, source authority, and DPIA screening. Traces and `graph_run_audits` contain only request hashes, graph/config versions, timing, evidence IDs, scores, and verdicts; raw prompts, reviews, uploads, identity values, and credentials must never be sent to observability providers or stored in graph audit metadata.
