# DFDS Memory Ledger RAG Design

## Goal

Replace the partial chat-history and project-memory implementation with one
scoped, auditable memory system. Every short-, medium-, and long-term memory
record is retrievable through the RAG pipeline. The system must retain ten
complete user-assistant exchanges without relying on a lossy summary, restore
an authorized user's history, resolve canonical keywords and aliases, and
avoid presenting unsupported content as a confirmed fact.

This design borrows the public Claude Code pattern of scoped durable context
and source-preserving compaction. It does not depend on, or claim to reproduce,
Claude Code's private implementation.

## Non-Goals

- Guaranteeing literal zero model hallucination. The implementation instead
  blocks unsupported factual claims through retrieval and response contracts.
- Sharing a user's private memories with another user or browser session.
- Treating unverified statements in chat as external business evidence.
- Deleting original chat turns when a compacted summary is created.

## Isolation Model

Every memory query and write is scoped server-side using:

```text
tenant_id + actor_id + conversation_id
```

The browser may send a conversation identifier, but the server derives the
actor and tenant from a trusted identity boundary. The initial demo may use a
stable local demo identity; production must replace it with authenticated SSO
claims. A request-provided `userId` is never sufficient authorization.

Four visibility scopes are supported:

| Scope | Owner | Example | Visibility |
| --- | --- | --- | --- |
| `platform` | system | Mia answer safety policy | authorized platform users |
| `project` | DFDS workspace | reviewed DFDS data constraint | authorized project members |
| `user` | one actor | language preference or approved personal default | that actor only |
| `conversation` | one actor and conversation | current discussion, route focus, correction | that conversation only |

`platform` and `project` records are still filtered by tenant and permissions.
No user or conversation record can be returned outside its owner scope.

## Memory Layers

| Layer | Record classes | Storage and retention | Retrieval behavior |
| --- | --- | --- | --- |
| Short term | immutable user and assistant turns, current entity focus | permanent raw source rows; active context is bounded to ten exchanges | latest ten exchanges are always supplied; older matching turns can be retrieved |
| Medium term | active task state, selected route/filter, upload batch, correction, unresolved question | TTL-aware scoped memory records | retrieve matching active records before long-term content |
| Long term | approved preference, policy, validated insight, data rule | versioned records with source and approval state | retrieve only active, authorized, evidence-bound records |

Ten exchanges means up to twenty source messages: ten user turns and their ten
assistant replies. The current six-message history limit is replaced by this
explicit contract.

## Data Model

The current `chat_messages` table remains the immutable audit source for raw
conversation content. Existing `project_memories` records are migrated into
the new ledger rather than discarded.

### `memory_records`

The canonical RAG document table. Important fields are:

```text
id, tenant_id, owner_actor_id, conversation_id, visibility_scope,
memory_layer, memory_kind, title, content, status, confidence,
approval_state, source_type, source_message_ids, evidence_refs,
supersedes_memory_id, valid_from, expires_at, metadata,
lexical_document, semantic_embedding, created_at, updated_at
```

Each raw chat turn has a corresponding short-term `memory_records` document
with its immutable `chat_messages.id` in `source_message_ids`. A record copied
into medium or long-term memory keeps links to every original turn or evidence
item that supports it.

### Supporting Tables

| Table | Purpose |
| --- | --- |
| `memory_keyword_aliases` | canonical entities and multilingual aliases such as `Dover-Calais`, `DVR-CALAIS`, and `多佛-加莱` |
| `memory_record_keywords` | many-to-many exact keyword and entity links with source and confidence |
| `memory_links` | `derived_from`, `supersedes`, `contradicts`, and `references` provenance links |
| `session_compactions` | immutable compacted summaries linked to the exact source-turn range |
| `memory_retrieval_traces` | query terms, permitted scopes, selected IDs, scores, and answer decision for audit and evaluation |

The database adds indexes for scope, conversation recency, active TTL state,
keyword joins, full-text lexical matching, and HNSW semantic search. Row-level
security is applied where the deployed PostgreSQL environment supports it;
server-side scope predicates remain mandatory in all environments.

## Claude-Code-Style Context Compaction

The compactor runs when context size exceeds its budget or a conversation has
more than ten exchanges. It writes a `session_compaction` record containing:

- confirmed decisions;
- active task, route, data batch, and filters;
- user corrections and unresolved questions;
- canonical entities and keywords;
- source message IDs for every statement.

The compaction is an index and navigation aid, not a new truth source. Raw
turns remain retrievable. The compactor may create medium-term candidate
records, but cannot promote a statement to long-term memory without an
evidence-backed rule or explicit approval.

## Retrieval Contract

For every report-mode request, the retrieval service performs all of the
following under the caller's authorized scope:

1. Normalize the message and resolve exact IDs, canonical keywords, and
   multilingual aliases.
2. Retrieve the latest ten exchanges for the active conversation in
   chronological order.
3. Retrieve matching short-term history outside that window when needed.
4. Retrieve active medium-term state for the conversation and actor.
5. Retrieve matching long-term project, platform, and user memory.
6. Combine exact keyword, PostgreSQL full-text, recency, route/entity, and
   semantic scores with reciprocal-rank fusion.
7. Persist a retrieval trace before generating the answer.

Exact entity matches are ranked before semantic similarity. References such as
"this route" are resolved against the most recent unambiguous entity focus in
short-term memory. If more than one entity is plausible, Mia asks a concise
clarifying question rather than guessing.

The prompt receives a token-bounded context envelope:

```text
always-on platform policy
+ last 10 raw exchanges
+ latest applicable compaction(s)
+ active medium-term state
+ keyword-matched long-term memories
+ cited business evidence and data-query output
```

Irrelevant long-term memories are not inserted merely to satisfy a quota. The
trace records that a layer was searched even when it produced no result.

## Grounding and Conflict Rules

The chat model produces structured claim candidates. A response gate validates
that each factual claim is marked as one of:

- `retrieved_memory` with one or more `memory_id` values;
- `retrieved_evidence` with one or more `evidence_id` values;
- `calculation` with an allowlisted query and result reference;
- `user_stated` with source turn IDs.

Claims without a valid source reference are removed or converted into a
clarification. If no sufficiently relevant record exists, Mia states that no
confirmed record was found. A user's statement may be repeated as something
the user said, but never promoted to a verified external fact automatically.

A correction creates a newer record with a `supersedes` link. Retrieval
excludes superseded records by default and exposes conflicts only when the
user asks about history or the conflict blocks a reliable response.

## History Restore

Opening a conversation calls a scoped restore endpoint. It returns:

- authorized chronological chat history;
- current short-term entity focus;
- active medium-term records;
- latest source-linked compaction;
- metadata sufficient to render memory provenance without exposing another
  actor's data.

Cross-device restoration requires the same authenticated actor identity. A
browser-local session ID alone cannot safely provide this behavior.

## Migration Strategy

1. Add ledger, alias, relation, compaction, and retrieval-trace tables.
2. Backfill existing `project_memories` as project/platform long-term records.
3. Backfill existing `chat_messages` as short-term source-linked records.
4. Dual-read old and new paths during migration; new writes go to both audit
   chat messages and the ledger.
5. Switch chat context assembly to the new retrieval contract.
6. Retire legacy direct history and project-memory queries only after tests and
   migration counts reconcile.

## Acceptance Tests

The implementation must automate these cases:

1. Ten complete exchanges: the tenth follow-up accurately resolves an entity
   introduced in the first exchange.
2. Compaction: after more than ten exchanges, an older confirmed decision is
   recoverable through its compaction and raw source turns.
3. Chinese and English aliases: `多佛-加莱`, `Dover-Calais`, and `DVR-CALAIS`
   resolve to one canonical route entity.
4. Correction: a later correction defeats an older conflicting memory.
5. Isolation: two actors using the same keyword cannot retrieve each other's
   conversation or user records.
6. Restoration: an authorized actor restores their conversation; an unrelated
   actor receives no records.
7. Unsupported query: Mia returns a no-confirmed-record response rather than
   creating a factual answer.
8. Traceability: every grounded factual claim has a valid memory, evidence,
   calculation, or source-turn reference in the retrieval trace.

## Success Criteria

- All three memory layers are RAG-indexed and scope-isolated.
- The chat context contains ten complete raw exchanges plus relevant compacted
  and durable context.
- Keyword and alias resolution precedes semantic fallback.
- History can be restored only by the authorized identity.
- Test fixtures demonstrate no cross-user leakage, correction handling, and
  grounded handling of unsupported facts.
