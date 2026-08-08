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
