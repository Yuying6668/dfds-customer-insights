# Mia's Cruises Agentic Customer Intelligence Design

## Objective

Extend Mia's Cruises from a RAG-enabled customer-insights assistant into a bounded, auditable agentic customer-intelligence platform. It must combine approved external customer signals with authorised internal survey and operational uploads to produce source-backed business insights and recommendation drafts for Marketing, CX, and Operations.

The system assists human decision makers. It does not make decisions about individual passengers, publish business actions, write to source systems, or run open-ended autonomous agents.

## Architecture

### Deterministic Data Foundation

External sources (Trustpilot, Google Reviews, app stores, and Reddit) and internal uploads enter a deterministic pipeline before any LLM or LangGraph node can use them.

1. Preserve the original file or source reference, collection time, version, owner, and authority/licence metadata.
2. Apply schema mapping, deduplication, multilingual normalisation, metadata enrichment, data-quality checks, and chunking.
3. Mask restricted identity fields and reject or quarantine data that fails permission, schema, PII, or quality rules.
4. Persist approved evidence, batch metadata, quality summaries, and transformation lineage.

Existing upload ingestion, pgvector/BM25 retrieval, batch manifests, and Review Console remain the source of truth. LangGraph must not make cleaning, access-control, or publication decisions that a deterministic rule can make.

### LangGraph Workflows

Three small, independent graphs share typed contracts and observability but have separate triggers and state. They must not be combined into a single global graph.

#### 1. Mia Conversation Graph

Trigger: an authenticated user asks Mia a question or asks about the current approved upload batch.

`route_request -> retrieve_evidence -> analyse_or_answer -> validate_output -> [human_review | return_cited_response]`

- Route questions into small talk, evidence-grounded Q&A, or current-batch analysis.
- Retrieve only owner-scoped, permitted, approved evidence using existing hybrid retrieval, historical insights, memory, and page/batch context.
- Return claims with source IDs, confidence, limitations, and a retrieval trace.
- Send high-impact, low-confidence, insufficiently cited, or policy-sensitive drafts to review; ordinary grounded answers return directly.

#### 2. Dataset Insight Graph

Trigger: a user publishes a validated internal dataset run, or a scheduled external-data refresh completes.

`load_approved_run -> build_safe_aggregates -> retrieve_comparative_evidence -> analyse_patterns -> draft_recommendations -> validate_publication -> [human_review | publish_snapshot]`

- Use aggregate, privacy-approved metrics and explicitly labelled source coverage.
- Compare internal experience signals with relevant external evidence without conflating the two.
- Generate dashboard-ready insight and recommendation drafts with evidence, confidence, owner, expected impact, and stated limitations.
- Publish only a review-approved, versioned analytics snapshot; never automatically execute a recommendation.

#### 3. Evaluation and Monitoring Graph

Trigger: a model, prompt, retriever, embedding, reranker, chunker, or graph-version change; optionally a scheduled evaluation run.

`load_frozen_evaluation_set -> execute_cases -> score_retrieval_and_answer -> compare_baseline -> [block_promotion | record_accepted_run]`

- Keep golden/held-out datasets out of live retrieval.
- Measure Recall@5, citation correctness, grounded-answer quality, abstention accuracy, P95 latency, failure rate, and human-review outcomes.
- Block promotion on predefined regression thresholds and retain the result, configuration, and trace for audit.

## State and Interfaces

Every graph state is versioned and contains only the minimum permitted data: request ID, actor/owner scope, route/time/source filters, approved batch ID, evidence IDs and scores, aggregate metrics, draft output, validation result, publication state, and trace ID.

Nodes cannot receive raw unrestricted uploads, unmasked identity fields, evaluation answers, credentials, or direct write access to operational systems. Recommendations are immutable drafts until a human approves publication.

## Governance and EU-Oriented Boundaries

- Treat Mia as decision support for business teams, not as a system that determines an individual's eligibility, pricing, treatment, employment, creditworthiness, or other rights-affecting outcome.
- Restrict analysis to aggregates by route, time, service theme, and approved business segment. Do not infer special-category personal data or create individual behavioural profiles.
- Clearly disclose when a user is interacting with AI and label generated insight, confidence, evidence, limitations, and synthetic data.
- Record controller/processor responsibility, processing purpose, lawful basis or source authority, source terms, retention period, deletion owner, and data steward for every source.
- Enforce deletion propagation across raw files, cleaned records, evidence chunks, embeddings, caches, dashboard snapshots, and observability data, retaining only the minimum lawful audit metadata.
- Keep Langfuse and model/embedding providers within approved processor, DPA, data-residency, retention, and security arrangements. Send redacted, aggregate, or pseudonymised context by default.
- Require enterprise authentication, MFA/SSO, role-based access control, encryption, secret management, and audit logging before any production deployment.
- Run a GDPR DPIA screening before production use of internal customer data and escalate to legal/DPO where the screening indicates a DPIA is required.
- Maintain a documented risk classification and AI-literacy/training record for operators. Reassess before adding uses that could fall into AI Act high-risk areas.

## Human Oversight

Human review is mandatory when a draft has weak or missing evidence, low confidence, sensitive internal-data involvement, a high business-impact recommendation, policy failure, or material evaluation regression. Reviewers can approve, correct, reject, withdraw, or request re-analysis. All decisions and evidence links enter the audit trail.

## Non-Goals

- Autonomous browser actions, customer outreach, price changes, CRM writes, or operational execution.
- LLM-directed data cleansing, permission decisions, or source licensing decisions.
- Individual-level profiling or automated decisions about passengers.
- Claims of real performance metrics until reproducibly measured on a frozen evaluation set.

## Delivery Evidence

The final demo must show one published internal batch, one external evidence query, one cited Mia answer, one insight/recommendation draft, one conditional review decision, and one repeatable evaluation run. Langfuse traces must link the graph version, prompt/version, retrieval trace, model usage, validation verdict, and final outcome.
