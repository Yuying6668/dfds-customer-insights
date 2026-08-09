# Mia's Cruises Agentic Customer Intelligence Design

## Objective

Extend Mia's Cruises from a RAG-enabled customer-insights assistant into a bounded, auditable agentic customer-intelligence platform. It must combine approved external customer signals with authorised internal survey and operational uploads to produce source-backed business insights and recommendation drafts for Marketing, CX, and Operations.

The system assists human decision makers. It does not make decisions about individual passengers, publish business actions, write to source systems, or run open-ended autonomous agents.

## Architecture

### Deterministic Data Foundation

External sources (Trustpilot, Google Reviews, app stores, and Reddit) and internal uploads enter a deterministic pipeline before any LLM or LangGraph node can use them.

1. Preserve the original file or source reference, collection time, version, owner, authority/licence metadata, content hash, source tier, synthetic flag, and deletion/tombstone status.
2. Apply schema mapping, deduplication, multilingual normalisation, metadata enrichment, data-quality checks, and chunking.
3. Record parser, cleaner, chunker, embedding, and retriever versions with every derived record.
4. Mask restricted identity fields and reject or quarantine data that fails permission, schema, PII, source-authority, freshness, or quality rules.
5. Persist approved evidence, batch metadata, quality summaries, and transformation lineage.

Existing upload ingestion, pgvector/BM25 retrieval, batch manifests, and Review Console remain the source of truth. LangGraph must not make cleaning, access-control, or publication decisions that a deterministic rule can make.

### LangGraph Workflows

Three small, independent graphs share typed contracts and observability but have separate triggers and state. They must not be combined into a single global graph.

#### 1. Mia Conversation Graph

Trigger: an authenticated user asks Mia a question or asks about the current approved upload batch.

`route_request -> retrieve_evidence -> analyse_or_answer -> validate_output -> [human_review | return_cited_response]`

- Route questions into small talk, evidence-grounded Q&A, or current-batch analysis.
- Retrieve only owner-scoped, permitted, approved evidence using existing hybrid retrieval, historical insights, memory, and page/batch context.
- Treat every retrieved review, document, and upload field as untrusted data, not instructions. Delimit retrieved content, prohibit it from changing system policy or triggering tools, and quarantine suspected prompt-injection content.
- Return claims with source IDs, confidence, limitations, and a retrieval trace.
- Apply the versioned review policy before release. Send high-impact, low-confidence, insufficiently cited, or policy-sensitive drafts to review; ordinary grounded answers return directly.

#### 2. Dataset Insight Graph

Trigger: a user publishes a validated internal dataset run, or a scheduled external-data refresh completes.

`load_approved_run -> build_safe_aggregates -> retrieve_comparative_evidence -> analyse_patterns -> draft_recommendations -> validate_publication -> [human_review | publish_snapshot]`

- Use aggregate, privacy-approved metrics and explicitly labelled source coverage.
- Compare internal experience signals with relevant external evidence without conflating the two.
- Generate dashboard-ready insight and recommendation drafts with evidence, confidence, owner, expected impact, and stated limitations.
- Publish only a review-approved, versioned analytics snapshot; never automatically execute a recommendation.
- Use the dataset run, analysis version, and graph version as an idempotency key. A repeated publish returns the existing result; a retry creates a new attempt, not a second dataset version.

#### 3. Evaluation and Monitoring Graph

Trigger: a model, prompt, retriever, embedding, reranker, chunker, or graph-version change; optionally a scheduled evaluation run.

`load_frozen_evaluation_set -> execute_cases -> score_retrieval_and_answer -> compare_baseline -> [block_promotion | record_accepted_run]`

- Keep golden/held-out datasets out of live retrieval.
- Measure Recall@5, citation correctness, grounded-answer quality, abstention accuracy, P95 latency, failure rate, and human-review outcomes, segmented by language, route, and source type.
- Score generated answers with a versioned LLM-as-a-judge rubric and a recurring human-audited calibration sample. Keep automated and human scores separate.
- Block promotion on predefined, versioned regression thresholds and retain the result, configuration, baseline, and trace for audit. Thresholds are set only after a measured baseline exists.

## State and Interfaces

Every graph state is versioned and contains only the minimum permitted data: request ID, actor/owner scope, route/time/source filters, approved batch ID, evidence IDs and scores, aggregate metrics, draft output, validation result, publication state, trace ID, graph version, and idempotency key.

Nodes cannot receive raw unrestricted uploads, unmasked identity fields, evaluation answers, credentials, or direct write access to operational systems. Recommendations are immutable drafts until a human approves publication.

Each graph uses PostgreSQL-backed checkpoints. Node inputs and outputs must be idempotent, have bounded retries, expose a failure state, and preserve the last safe state for operator retry or withdrawal.

## Governance and EU-Oriented Boundaries

- Treat Mia as decision support for business teams, not as a system that determines an individual's eligibility, pricing, treatment, employment, creditworthiness, or other rights-affecting outcome.
- Restrict analysis to aggregates by route, time, service theme, and approved business segment. Do not infer special-category personal data or create individual behavioural profiles.
- Clearly disclose when a user is interacting with AI and label generated insight, confidence, evidence, limitations, and synthetic data.
- Record controller/processor responsibility, processing purpose, lawful basis or source authority, source terms, retention period, deletion owner, and data steward for every source.
- Ingest public sources only through approved collection methods and documented source terms; label their scope, collection date, reliability, and refresh SLA. Public availability is not itself a permission to reuse data without restriction.
- Enforce deletion propagation across raw files, cleaned records, evidence chunks, embeddings, caches, dashboard snapshots, and observability data, retaining only the minimum lawful audit metadata.
- Keep Langfuse and model/embedding providers within approved processor, DPA, data-residency, retention, and security arrangements. Langfuse traces default to request IDs, hashes, aggregate statistics, configuration versions, timings, and verdicts; raw reviews, unrestricted uploads, identity values, and credentials never enter traces. Send redacted, aggregate, or pseudonymised model context by default.
- Require enterprise authentication, MFA/SSO, role-based access control, encryption, secret management, and audit logging before any production deployment.
- Run a GDPR DPIA screening before production use of internal customer data and escalate to legal/DPO where the screening indicates a DPIA is required.
- Maintain a documented risk classification and AI-literacy/training record for operators. Reassess before adding uses that could fall into AI Act high-risk areas.

## Human Oversight

Human review is mandatory when the versioned review policy detects missing citations, conflicting evidence, confidence below the configured threshold, sensitive internal-data involvement, a revenue/customer-rights/operations-impact recommendation, a policy failure, suspected prompt injection, or material evaluation regression. The policy version and triggered conditions are stored with the draft.

Reviewers can approve, correct, reject, withdraw, or request re-analysis. All decisions, evidence links, and reviewer actions enter the audit trail. An unavailable reviewer leaves the output in a non-published pending state; no timeout can auto-approve it.

## Non-Goals

- Autonomous browser actions, customer outreach, price changes, CRM writes, or operational execution.
- LLM-directed data cleansing, permission decisions, or source licensing decisions.
- Individual-level profiling or automated decisions about passengers.
- Claims of real performance metrics until reproducibly measured on a frozen evaluation set.

## Delivery Evidence

The final demo must show one published internal batch, one external evidence query, one cited Mia answer, one insight/recommendation draft, one conditional review decision, and one repeatable evaluation run. Langfuse traces must link the graph version, prompt/version, retrieval trace, model usage, validation verdict, and final outcome.
