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

## Repeatable Mia delivery demo

The complete interview/demo evidence chain can be reproduced without a database,
model provider, or network connection. It uses the checked-in fixture at
`data/demo/mia-demo-seed.json` and writes a reviewable JSON report.

```bash
pnpm demo:mia
pnpm test:demo
```

The report in `demo-output/mia-demo-report.json` covers a published internal
batch, external comparison evidence, a cited Mia answer, an insight draft with
owner/impact/limitations, the pending-to-approved publication decision, and a
frozen-set evaluation report with Recall@5, citation correctness, answer quality,
abstention accuracy, P95 latency, failure rate, and language/route/source segments.
The script is deterministic and safe to rerun; the same run and idempotency keys
are retained in the output.

Create delivery work on the `Mia` branch. Keep `.env`, virtual environments, caches, generated exports, and local credentials untracked.

## Mia graph operations

The bounded Mia graphs use `LANGGRAPH_CHECKPOINT_DATABASE_URL` for PostgreSQL checkpoints. Without it, local development uses an in-memory checkpoint. Optional Langfuse configuration is `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_HOST`.

Before enabling external processors, confirm an approved DPA, data residency, retention period, source authority, and DPIA screening. Traces and `graph_run_audits` contain only request hashes, graph/config versions, timing, evidence IDs, scores, and verdicts; raw prompts, reviews, uploads, identity values, and credentials must never be sent to observability providers or stored in graph audit metadata.

Production governance is fail-closed. Review the versioned declaration at `data/compliance/production-governance.json`, including `evidence_ref`, `owner`, and `reviewed_at` metadata for every source, processor, DPIA, risk, and training record. Provide the non-secret runtime proofs listed in `.env.example` through the deployment environment or managed KMS, then call `GET /api/governance/production-readiness` as a governance administrator. `POST /api/governance/production-mode` can enable production only when every check is ready; local password login is never a production SSO fallback. Missing MFA, role mappings, KMS rotation, processor/DPA, residency/retention, DPIA, AI-risk, or training evidence blocks the mode.

Run the same deployment check without starting the server with `npm run governance:preflight` (exit code `0` means ready; exit code `2` means blocked). The checked declaration intentionally contains pending placeholders until Legal, Security, and the selected enterprise identity/secret providers supply approved evidence.

For interview/demo walkthroughs only, run `python3 scripts/production_preflight.py --demo`. This uses `data/compliance/demo-governance.json`, whose records are explicitly marked `evidence_type: simulated` and must never be used as production approval.

The control-by-control demo evidence register and public standards basis are in `docs/demo-governance-evidence.md`.

Production evaluation requires `DATABASE_URL`, `DEEPSEEK_API_KEY`, and a frozen evaluation set. `MIA_EVALUATION_JUDGE_MODEL` runs the versioned answer-quality judge; an unavailable judge marks the run failed rather than accepting a fallback score. Set `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_HOST` to emit redacted evaluation trace metadata.

## Batch deletion

`DELETE /api/upload-batches/{batchId}` accepts an authenticated owner or administrator and an optional JSON `reason`. It records a minimal tombstone, removes the batch's raw files, cleaned data, and analytics snapshot, and creates propagation records for evidence, embeddings, retrieval cache, Langfuse traces, and audit traces. Repeating the request is idempotent; tombstoned batches are no longer readable through upload or dataset-run APIs.
