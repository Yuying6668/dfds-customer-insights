export const supervisorLogs = [
  {
    "time": "2026-08-11 16:30",
    "module": "Mia LangGraph Closure and Acceptance Hardening",
    "change": "Completed a local acceptance pass over the three Mia graphs and tightened evaluation label isolation, Dataset input validation, node recovery, trigger wiring, human-review metrics, and shared demo trace evidence",
    "reason": "The agentic customer-intelligence design required more than graph-shaped code: every graph needed bounded recovery, safe state boundaries, explicit triggers, human-review promotion input, and an auditable end-to-end demonstration.",
    "scope": "Conversation, Dataset Insight, and Evaluation graphs; graph state contracts; PostgreSQL checkpoint integration points; external refresh and component-version event endpoints; evaluation label vault; human-review metrics and promotion gate; demo trace records; regression tests",
    "result": "The local suite now passes 85 Python tests. The demo executes Dataset, Conversation, and Evaluation sequentially with a shared trace ID and memory checkpoint, and Dataset rejects raw rows or restricted fields before graph execution. Production Evaluation prepares held-out labels outside checkpointed graph state, while human-review outcomes feed overall and segmented metrics. PostgreSQL checkpoint, live Langfuse delivery, and deployment governance evidence remain environment-gated acceptance items.",
    "status": "Local implementation verified; production environment acceptance pending"
  },
  {
    "time": "2026-08-10 12:00",
    "module": "EU Regulatory Boundaries Reference",
    "change": "Added a locally versioned GDPR and EU AI Act boundary register for Mia",
    "reason": "Mia needs a traceable regulatory baseline for privacy, AI governance, human oversight, and future scope decisions.",
    "scope": "GDPR and EU AI Act requirements mapped to Mia controls, official EUR-Lex identifiers and source links",
    "result": "A CSV reference now records the applicable legal provisions, dates, official sources, and the corresponding product boundary or control.",
    "status": "Completed"
  },
  {
    "time": "2026-07-30 12:00",
    "module": "Data Intake Summary and File-Level Exports",
    "change": "Rebuilt Data Intake Summary around current-batch MIA metadata and separated standardised exports by uploaded file",
    "reason": "Operators need an executive-ready view of what MIA understood from the latest IT Data Flow and Survey CSV uploads, without losing file identity in a combined workbook.",
    "scope": "Session-scoped upload summaries, parsed metadata cards, batch AI briefing rules, upload versions, public-evidence summary, and per-file Excel or CSV export filtering",
    "result": "The latest upload in each intake channel now replaces its prior session summary, displays only detected metadata, and exports as its own standardised file rather than being combined with other uploads.",
    "status": "Completed"
  },
  {
    "time": "2026-07-29 17:45",
    "module": "Mia's Cruises Sign-in and Workspace Routing",
    "change": "Completed interview-safe branding and role-selected workspace routing for the companion sign-in application",
    "reason": "The interview demo must hide the real company brand while letting an administrator account enter either the business IT Data Flow workspace or the protected Agent Control workspace according to the selected role.",
    "scope": "Mia's Cruises cruise mark, login page sizing, administrator topology, account registration validation, role-aware navigation, token handoff to IT Data Flow, local authentication CORS compatibility, cache-busting, and daily project logs",
    "result": "DFDS and Mia's Cruises now refer to the same project. Selecting Project user sends a permitted account to the Mia robot IT Data Flow page; selecting Administrator opens Agent Control. New usernames require uppercase, lowercase, and numeric characters.",
    "status": "Completed"
  },
  {
    "time": "2026-07-29 12:42",
    "module": "Interview Branding and Project Aliases",
    "change": "Renamed the visible frontend brand to Mia's Cruises and replaced the DFDS logo with an original cruise mark",
    "reason": "The interview demo must not expose the real company name while preserving the established project context and functionality.",
    "scope": "Visible frontend copy, original sidebar cruise mark, dynamic display-text masking, browser title, branding regression tests, project memory, and daily logs",
    "result": "The interface presents Mia's Cruises without visible DFDS branding. Future tasks may use either DFDS or Mia's Cruises to refer to this same project.",
    "status": "Completed"
  },
  {
    "time": "2026-07-29 10:45",
    "module": "Uploaded Batch Context for Mia",
    "change": "Connected the active IT Data Flow upload to Mia with owner-scoped, masked context",
    "reason": "Mia needed to answer questions about the current uploaded batch without exposing raw rows or allowing one user to read another user's data.",
    "scope": "Authenticated upload ownership, upload preview and export access, batch-aware Mia context, RAG retrieval trace, safe aggregate summaries, and frontend token handoff",
    "result": "After an upload, Mia receives only the signed-in user's active batch ID and safe aggregate profile: row count, worksheet count, source names, period, and permitted field names. Raw rows and restricted identity fields are not passed into chat.",
    "status": "Completed"
  },
  {
    "time": "2026-07-29 10:25",
    "module": "Data Flow Navigation",
    "change": "Reorganized the sidebar into a collapsible business data flow",
    "reason": "Eleven flat navigation items made it difficult to understand how IT data becomes business decisions.",
    "scope": "Sidebar information architecture, English navigation labels, responsive navigation styles, route configuration, and production dist",
    "result": "The sidebar now follows Data Intake, Data Insights, Business Decisions, and Governance & Operations. Only the active stage is expanded by default, while every existing route remains available.",
    "status": "Completed"
  },
  {
    "time": "2026-07-29 10:10",
    "module": "Mia Conversation Audit and RAG Observability",
    "change": "Added administrator-only monitoring for authenticated chat, RAG usage, and conversation history",
    "reason": "Administrators need real-time visibility of Mia usage, retrieval layers, token consumption, compliance controls, and user conversation records.",
    "scope": "PostgreSQL chat audit records, RAG usage events, per-user session isolation, administrator observability APIs, Agent Control monitoring UI, and detailed log drawers",
    "result": "Every successful Mia turn records the authenticated user, chat session, user message, Mia reply, retrieval trace, and token usage. Administrator sessions can inspect aggregated telemetry and protected conversation logs without exposing passwords or access tokens.",
    "status": "Completed"
  },
  {
    "time": "2026-07-28 23:55",
    "module": "Account Authentication and Access Control",
    "change": "Introduced persisted user accounts and role-based sign-in for the DFDS workspace",
    "reason": "The workspace needed a real backend identity instead of demo users so access and monitoring can be attributed to the signed-in account.",
    "scope": "Account persistence, salted password hashing, access sessions, sign-in and registration APIs, administrator role, business-app token handoff, and logout",
    "result": "Signed-in users are now identified by their persisted backend account. Project users enter the business workspace, while administrators can access the protected monitoring experience.",
    "status": "Completed"
  },
  {
    "time": "2026-07-28 17:45",
    "module": "IT Data Flow Workspace",
    "change": "Redesigned the technical flow as a batch-first review workspace",
    "reason": "The original page mixed upload, governance, agent scores, and architecture into competing card groups.",
    "scope": "IT Data Flow route, upload review, Mia brief, technical disclosures, compact mobile navigation, responsive CSS, and production dist",
    "result": "The page now opens with one source batch, a lifecycle strip, and a collapsed Mia intake brief; lineage, data contract, and quality review open only when a reviewer needs them, before Dashboard and Mia consumption.",
    "status": "Completed"
  },
  {
    "time": "2026-07-28 10:30",
    "module": "IT Data Flow",
    "change": "Added a dedicated IT Data Flow page",
    "reason": "The user wanted a technical view next to Data Basis for upload, validation, cleaning, modeling, review, and Mia handoff.",
    "scope": "IT Data Flow route, Data Basis technical link, dashboard context, local knowledge base, update logs, daily logs, and UI styling",
    "result": "The platform now treats IT Data Flow as a separate operational page and gives Mia access to the flow context through backend-controlled context.",
    "status": "Completed"
  },
  {
    "time": "2026-07-23 21:58",
    "module": "Google Location Progress Bar Accuracy",
    "change": "Corrected the rendered proportions in Google Reviews by ferry location",
    "reason": "The location metric row selector also applied its grid layout to nested progress tracks, so rating fills such as 84% rendered at only about one third of the full track.",
    "scope": "Overview Google location rating and review-volume bars, responsive CSS, regression test, production dist",
    "result": "Progress fills now use the complete track width: ratings render at 84%, 86%, 84%, and 88%, while review-volume bars remain proportional to the largest location count.",
    "status": "Completed"
  },
  {
    "time": "2026-07-23 00:18",
    "module": "Mia Conversational Routing and Answer Surface Cleanup",
    "change": "Made Mia treat acknowledgements as small talk and removed visible evidence labels from the default answer surface",
    "reason": "The user wanted normal conversational replies for OK / got it / thanks / MIA messages, a cleaner user-facing answer without Short answer or Evidence used labels, and a friendlier thinking state and user label.",
    "scope": "Chat intent routing, user-facing answer formatting, evidence-card visibility, language detection, chat drawer expansion, responsive styles, backend and frontend fallback paths",
    "result": "Mia now routes short acknowledgements into thanks / small talk, replies in the detected input language, hides evidence by default unless the user explicitly asks for it, strips legacy Short answer / Evidence used labels before display, offers a larger expandable chat drawer with Enter-to-send behavior, and the rebuilt production dist now serves those changes in the browser.",
    "status": "Completed"
  },
  {
    "time": "2026-07-22 21:12",
    "module": "Mia Composer and Customer Voice Badge Polish",
    "change": "Expanded Mia's question composer and centered Customer Voice priority badges",
    "reason": "The user reported that suggested Mia questions could not be read without scrolling inside the input, and that the High attention badge in Customer Voice looked visually off-center.",
    "scope": "Mia chat drawer width, textarea autosizing, suggested tag fill behavior, Customer Voice priority pill alignment, production dist",
    "result": "Mia now opens with a wider drawer and a taller autosizing textarea, while High attention badges keep their text centered inside the red priority pill.",
    "status": "Completed"
  },
  {
    "time": "2026-07-22 20:09",
    "module": "Mia Launcher and Focus Tags",
    "change": "Changed Mia to open collapsed by default and replaced long suggested questions with compact focus tags",
    "reason": "The user wanted the Q&A system to stay out of the way when the dashboard opens, and wanted only a few keyword prompts at the bottom instead of expanded long suggested questions.",
    "scope": "Mia chat launcher, focus tag prompts, chat drawer prompt styling, Update Log, production dist",
    "result": "The dashboard now opens with only the Ask Mia launcher visible; opening Mia shows compact tags for App risk, Route priority, Dover-Calais, Competitors, Marketing actions, and Evidence gaps, each still mapping to a useful report question.",
    "status": "Completed"
  },
  {
    "time": "2026-07-22 19:51",
    "module": "Final 8766 UI QA and App Review Alignment",
    "change": "Completed the final source-level UI polish and live browser QA on the restored 8766 dashboard",
    "reason": "The first polish pass fixed the major regressions, but live screenshots still showed App Reviews platform text being squeezed and source logo sizing needed one more stable pass.",
    "scope": "App Reviews top-row alignment, source logo dimensions and spacing, competitor filter width, route-focus regression check, live 8766 smoke validation",
    "result": "App Reviews now keeps each platform card in one row with the logo and rating aligned at the top, Main data sources use compact 24x20 marks with a 12px title gap, Competitors keeps a 220px filter with an 8-column sticky benchmark table, and Overview route focus remains stable without the old ui-restore layer.",
    "status": "Completed"
  },
  {
    "time": "2026-07-22 19:28",
    "module": "Dashboard UI Polish and Route Focus Stability",
    "change": "Rebuilt the React dashboard with route-focus stability fixes, priority ordering, tighter source/app layouts, and a shorter competitor filter",
    "reason": "The user reported that Overview route focus could blank the page, Customer Voice was not visually strong enough, Recommendations needed urgent-priority ordering, App Reviews had too much empty space, Main data source logos were cramped against text, and the Competitors filter input was too long.",
    "scope": "Overview route focus behavior, Main data sources spacing, Customer Voice priority ordering and card layout, App Reviews compact store cards, Recommendations priority sort, Competitors filter width, Vite production dist",
    "result": "The production dist now loads the rebuilt React bundle without the old ui-restore DOM mutation layer, route focus changes no longer blank the page, high-priority recommendations appear first, Customer Voice starts with high-attention signals, app ratings sit with store logos, and the competitor filter is compact.",
    "status": "Completed"
  },
  {
    "time": "2026-07-22 18:18",
    "module": "UI Restoration Follow-up",
    "change": "Tightened the restored DFDS UI after live browser QA showed remaining navigation borders, oversized source logos, and weak benchmark sticky-row visibility",
    "reason": "The user confirmed that the sidebar still looked underlined, Trustpilot-style source icons still looked too large, and the competitor table controls and frozen DFDS row were not clear enough in the live 8766 page.",
    "scope": "Sidebar navigation border styling, Main data sources logo sizing and spacing, App Reviews store logo sizing, Ferry benchmark table scroll height, sticky header, sticky DFDS baseline row, live dist restore layer, cache-busting version",
    "result": "The live 8766 page now removes the nav border lines, reduces source logos to compact report-scale marks, makes App store logos smaller, and strengthens the benchmark table's filter/sort and frozen baseline presentation.",
    "status": "Completed"
  },
  {
    "time": "2026-07-22 16:55",
    "module": "Approved UI Restoration",
    "change": "Restored the approved DFDS report-style UI patterns after the React route split changed several dashboard sections",
    "reason": "The user reported that the live 8766 frontend no longer matched the previously approved UI: All signals looked different, source logos were too large or cramped, the two app store cards were no longer aligned, the competitor benchmark missed filter and DFDS sticky baseline behavior, and sidebar links showed underlines.",
    "scope": "Overview route lens, Main data sources card spacing and logos, Customer temperature bar, App Reviews store cards, Ferry benchmark table filter/sort and DFDS sticky first row, sidebar navigation styling, cache-busting versions",
    "result": "The formal React source and live dist restore layer now preserve the earlier DFDS annual-report-inspired dashboard behavior while keeping the URL-based route shell.",
    "status": "Completed"
  },
  {
    "time": "2026-07-22 00:55",
    "module": "React Route Split",
    "change": "Replaced the report shell with URL-based React subroutes for the major DFDS report sections",
    "reason": "The user asked for the Overview, Customer Voice, App Reviews, Competitors, Recommendations, Survey CSV, Update Log, Data Basis, and Review Console views to become separate subroutes instead of page-level tabs.",
    "scope": "React shell, route components, URL navigation, SPA fallback, cache-busting versioning",
    "result": "The dashboard now has route-owned sections with dedicated route components, and the browser can open each report page by path.",
    "status": "Completed"
  },
  {
    "time": "2026-07-22 00:50",
    "module": "Chat Auto Validation Hook",
    "change": "Attached the live /api/chat response flow to the validation harness",
    "reason": "Every real Mia reply should generate a review item automatically so the Review Console can catch regressions in route detection, small-talk routing, source labeling, and language handling without waiting for manual test runs.",
    "scope": "server.py /api/chat flow, validation harness invocation, validation metadata on chat responses, daily logs",
    "result": "Each successful chat turn now produces a validation run and review item alongside the normal answer, and the response includes validation metadata for internal inspection.",
    "status": "Completed"
  },
  {
    "time": "2026-07-22 00:40",
    "module": "Validation Harness Agent",
    "change": "Added a deterministic validation agent and backend review-run endpoint",
    "reason": "The internal review console needs real validation items, not only seeded examples, so agent outputs can be checked for route drift, source overclaiming, evidence leakage, and language mismatch before publish.",
    "scope": "Validation agent, PostgreSQL review persistence helper, /api/review-runs/validate-chat, sample validation cases, unit tests, cache-busting versions, daily logs",
    "result": "The project can now run a validation batch from JSON or HTTP, produce review items, and write them to review_runs / review_items when PostgreSQL is connected.",
    "status": "Completed"
  },
  {
    "time": "2026-07-21 02:20",
    "module": "RAG Route Split",
    "change": "Split Mia chat into vertical report questions and smalltalk bridge replies",
    "reason": "The user wanted the RAG path to separate serious DFDS report questions from light prompts, so smalltalk can answer briefly and then guide the manager back to the vertical report flow.",
    "scope": "Backend chat mode routing, frontend chat routing, live API payloads, response guidelines, daily logs, cache-busting versions",
    "result": "Report questions now run through the vertical retrieval path, while greetings, thanks, weather, and other light prompts use the smalltalk route for a short answer and a bridge back to the DFDS report.",
    "status": "Completed"
  },
  {
    "time": "2026-07-21 02:15",
    "module": "Internal Review Console",
    "change": "Added a standalone internal review page for validation and reflection supervision",
    "reason": "The team needs a practical harness to inspect evidence chains, source limitations, RAG behavior, Mia guardrails, and release hygiene before new agent outputs are surfaced in the dashboard.",
    "scope": "Review Console navigation, seeded log-derived review records, review queue, detail panel, evidence chain, backend review schema and API, cache-busting versions",
    "result": "Internal reviewers can inspect seeded supervision items from the July 16-21 project logs and use the console as the first operational review workspace.",
    "status": "Completed"
  },
  {
    "time": "2026-07-21 02:05",
    "module": "Sidebar Data Snapshot Removal",
    "change": "Removed the sidebar data collection snapshot card",
    "reason": "The user asked to remove the lower-left block showing Data collection, Public snapshot, and Collected July 16, 2026.",
    "scope": "Sidebar, stylesheet cleanup, cache-busting versions, Update Log",
    "result": "The sidebar now keeps only the DFDS brand area and main navigation, with no data snapshot card or unused collection-status styling.",
    "status": "Completed"
  },
  {
    "time": "2026-07-21 01:40",
    "module": "Quick Read Wording Refresh",
    "change": "Rewrote the page-opening Quick read blocks in more natural, plain business English",
    "reason": "The user felt the previous page summaries were still too abstract and wanted wording that sounds easier, more conversational, and clearer for non-technical stakeholders.",
    "scope": "Overview, Customer Voice, App Reviews, Competitors, Recommendations, Survey CSV, Update Log, Data Basis, cache-busting versions",
    "result": "Each page now starts with shorter, more direct guidance about what to look at first, what question the page answers, and how a manager can use it.",
    "status": "Completed"
  },
  {
    "time": "2026-07-21 01:20",
    "module": "Page Summary Copy Simplification",
    "change": "Rewrote the page summary blocks in simpler, more conversational English",
    "reason": "The user wanted each page summary to sound less abstract and easier for a business stakeholder to understand at a glance.",
    "scope": "Overview, Customer Voice, App Reviews, Competitors, Recommendations, Survey CSV, Update Log, Data Basis, cache-busting versions",
    "result": "Each page now starts with a plain-language Quick read that explains what the page is for, what to check first, and how to use it.",
    "status": "Completed"
  },
  {
    "time": "2026-07-21 01:15",
    "module": "Chat Assistant Multilingual Evidence Alignment",
    "change": "Extended evidence summaries and backend fallback evidence responses to all supported detected languages",
    "reason": "The user clarified that the same-language rule must apply to every language, not only Chinese; for example, Danish questions should receive Danish evidence summaries.",
    "scope": "Frontend evidence formatting, backend evidence-only fallback, multilingual language detection, cache-busting versions, daily logs",
    "result": "Mia now keeps local evidence summaries in the detected input language for Danish, German, French, Spanish, Japanese, Korean, Chinese, and English instead of mixing English evidence into non-English answers.",
    "status": "Completed"
  },
  {
    "time": "2026-07-21 01:00",
    "module": "Chat Assistant Evidence Language Alignment",
    "change": "Localized Chinese evidence bullets and detected route names from the user's question",
    "reason": "The user asked in Chinese about Dover-Calais, but Mia returned Chinese wrapper text with English evidence bullets and kept the route focus as All signals.",
    "scope": "Local chat evidence formatting, route detection from message text, cache-busting versions, daily logs",
    "result": "Chinese questions now receive Chinese evidence summaries, and route mentions such as Dover-Calais influence the evidence focus even if the page dropdown remains All signals.",
    "status": "Completed"
  },
  {
    "time": "2026-07-21 00:45",
    "module": "Chat Assistant Small-talk Expansion",
    "change": "Expanded Mia's small-talk handling into dedicated greeting, identity, capability, wellbeing, thanks, apology, goodbye, joke, and confusion intents",
    "reason": "The user asked to add all common small talk so Mia behaves more like a mature commercial chatbot rather than a narrow report search box.",
    "scope": "Chat assistant intent routing, backend bridge replies, conversation guidelines, cache versioning, daily logs",
    "result": "Mia now answers common conversational prompts with short same-language replies and only bridges back to the DFDS report when that feels appropriate.",
    "status": "Completed"
  },
  {
    "time": "2026-07-21 00:30",
    "module": "Chat Assistant Small-talk Guard",
    "change": "Added a second non-report intent guard before live chat calls and expanded greeting detection for messages like Mia hello",
    "reason": "The user still saw weather and greeting questions return unrelated evidence, which means cached or alternate chat paths could still reach retrieval.",
    "scope": "Chat assistant intent classification, live chat request guard, cache-busting versions, update log",
    "result": "Weather, greetings, and off-topic messages now return Mia's concise same-language bridge response without evidence cards or backend calls, and the browser is forced to load the newest modules.",
    "status": "Completed"
  },
  {
    "time": "2026-07-21 00:15",
    "module": "Chat Assistant Cache Busting",
    "change": "Added a cache-busting version to the chat assistant module import",
    "reason": "The browser was still using the old chat-assistant.mjs module, so small-talk and weather routing changes did not appear after refresh.",
    "scope": "Frontend module imports, chat assistant loading, index cache version, update log",
    "result": "app.js now imports chat-assistant.mjs with a version query, and index.html now loads a new app.js version so Mia's latest off-topic routing is forced into the browser.",
    "status": "Completed"
  },
  {
    "time": "2026-07-20 20:05",
    "module": "Chat Assistant Off-topic Routing",
    "change": "Added explicit small-talk, weather, and off-topic intent routing before evidence retrieval",
    "reason": "The user found that asking about the weather still triggered unrelated report evidence, so Mia needed a mature chatbot-style routing layer before search.",
    "scope": "Conversation guidelines, chat intent classification, local fallback, backend bridge reply, cache versioning",
    "result": "Weather, greetings, and unrelated messages now receive a friendly same-language bridge back to the DFDS report instead of empty or mismatched evidence cards.",
    "status": "Completed"
  },
  {
    "time": "2026-07-20 19:50",
    "module": "Chat Assistant Bridge Reply",
    "change": "Made Mia answer greetings and out-of-report messages with a friendly bridge back to the DFDS report",
    "reason": "The user wanted the assistant to behave more like a mature chatbot that can handle unrelated chatter gracefully instead of dumping an empty evidence fallback.",
    "scope": "Chat submission flow, local fallback, DeepSeek prompt, backend bridge reply, response labels",
    "result": "When the user says hello or asks something unrelated, Mia now replies in the same language with a short warm introduction and a direct prompt back to the DFDS report.",
    "status": "Completed"
  },
  {
    "time": "2026-07-20 19:40",
    "module": "Chat Assistant Language Polish",
    "change": "Removed English/Translation labels and made the assistant answer in the same language as the question",
    "reason": "The user wanted the assistant to feel more natural and human, without a translation wrapper, and to answer in the language the manager actually used.",
    "scope": "Assistant greeting, message labels, local fallback, DeepSeek prompt, live API fallback copy, frontend cache versioning",
    "result": "The assistant now introduces itself as Mia, shows no English/Translation wrappers, and returns Chinese, English, or other supported language responses directly in that same language.",
    "status": "Completed"
  },
  {
    "time": "2026-07-20 19:20",
    "module": "Chat Assistant Launcher Polish",
    "change": "Simplified the collapsed assistant launcher and replaced the text close button with an × icon",
    "reason": "The user wanted the chat assistant to feel closer to mature business chatbot patterns, with less visible copy and a more familiar close control.",
    "scope": "Floating chat launcher, chat drawer header, assistant note, initial assistant message, frontend cache versioning",
    "result": "The collapsed assistant now reads Insights with an AI mark, the drawer header says Insight assistant, the note uses business-friendly wording, and the close control is shown as × with an accessible label.",
    "status": "Completed"
  },
  {
    "time": "2026-07-20 16:46",
    "module": "Frontend Modular Architecture Split",
    "change": "Split the frontend into layered data, feature, service, core, and utility modules",
    "reason": "The user wanted the project files to follow the platform logic instead of keeping all public data in data.js and all frontend behavior in one large app.js file.",
    "scope": "Frontend file architecture, data modules, page renderers, chat assistant, export brief, navigation, work scripts, handoff documentation",
    "result": "Moved DFDS data into app/data domain files, moved UI behavior into app/scripts modules, kept the existing HTML/CSS/native JavaScript stack, and preserved the current dashboard behavior.",
    "status": "Completed"
  },
  {
    "time": "2026-07-20 16:29",
    "module": "RAG Validation Set Refresh",
    "change": "Updated the human validation workbook with dashboard-driven manager questions",
    "reason": "The user wants the validation questions and answers to feel like a real manager asking follow-up questions after reading the frontend dashboard, not like abstract product knowledge checks.",
    "scope": "RAG validation workbook, evidence anchors, human scoring workflow, handoff documentation",
    "result": "Regenerated outputs/dfds-rag-validation-set.xlsx with 50 realistic dashboard-based questions, expected English answers, translation summaries, route context, evidence anchors, and editable human scoring columns.",
    "status": "Completed"
  },
  {
    "time": "2026-07-20 15:41",
    "module": "RAG Backend Upgrade",
    "change": "Added page-aware retrieval and visible chat evidence cards",
    "reason": "The user wants the report assistant to answer from both the visible dashboard data and the PostgreSQL + pgvector knowledge base.",
    "scope": "Database schema, backend RAG context, chat response evidence display, frontend cache versioning, evaluation workflow preparation",
    "result": "Added rag_evaluation_items tables, upgraded backend retrieval to combine page context, evidence, insights, and recent chat history, and made the chat UI show supporting evidence cards below answers.",
    "status": "Completed"
  },
  {
    "time": "2026-07-20 15:18",
    "module": "Local Python Environment Hygiene",
    "change": "Ignored the local Python virtual environment folder",
    "reason": "The local PostgreSQL and pgvector setup uses a Python virtual environment, which should not be treated as product source code.",
    "scope": "Local development environment, project file hygiene",
    "result": "Added .venv/ to .gitignore so backend dependencies stay local and do not pollute the project files.",
    "status": "Completed"
  },
  {
    "time": "2026-07-20 15:08",
    "module": "Local pgvector Version Alignment",
    "change": "Updated local setup guidance from PostgreSQL 16 to PostgreSQL 17",
    "reason": "The user's PostgreSQL 16 database could not find the pgvector extension control file, while the current Homebrew pgvector formula is packaged for newer PostgreSQL versions.",
    "scope": "Local pgvector setup guide, handoff documentation, setup troubleshooting",
    "result": "LOCAL_PGVECTOR_SETUP.md now recommends PostgreSQL 17 and includes recovery commands for the PostgreSQL 16 vector.control error.",
    "status": "Completed"
  },
  {
    "time": "2026-07-20 14:52",
    "module": "Local pgvector Setup",
    "change": "Added macOS local PostgreSQL and pgvector setup guidance",
    "reason": "The user decided to stop using Docker and wants to run PostgreSQL plus pgvector directly on the Mac.",
    "scope": "Local database setup documentation, environment template, local backend start script, project handoff",
    "result": "Added LOCAL_PGVECTOR_SETUP.md, changed the example DATABASE_URL to a local macOS PostgreSQL format, and added a local:start script for running the backend without Docker.",
    "status": "Completed"
  },
  {
    "time": "2026-07-20 14:39",
    "module": "RAG Evidence Fallback Fix",
    "change": "Added frontend evidence fallback when database retrieval returns no rows",
    "reason": "The chat assistant reached DeepSeek, but an empty PostgreSQL retrieval result caused the answer to say no app review data existed even though the dashboard had embedded app review evidence.",
    "scope": "Chat request payload, backend retrieval fallback, DeepSeek answer instructions, frontend cache versioning",
    "result": "The frontend now sends its top retrieved evidence to /api/chat as backup context, and the backend uses that evidence if PostgreSQL retrieval is empty. The prompt also avoids unexpected non-input-language summaries for English questions.",
    "status": "Completed"
  },
  {
    "time": "2026-07-20 14:28",
    "module": "Database Startup Hardening",
    "change": "Hardened the PostgreSQL and pgvector startup flow",
    "reason": "The first database startup must create the pgvector extension before the backend registers vector types and imports evidence.",
    "scope": "Backend database initialization, Docker Compose health check, Docker build context, developer scripts, project handoff",
    "result": "Added PostgreSQL health checks, made the backend wait and retry database initialization, moved pgvector registration after schema creation, added a Docker ignore file, and added helper scripts for seed export and Docker startup.",
    "status": "Completed"
  },
  {
    "time": "2026-07-20 14:05",
    "module": "Evidence Knowledge Base Step 2",
    "change": "Added PostgreSQL and pgvector as the database layer for public evidence",
    "reason": "The user approved moving from local frontend retrieval to a real Evidence Knowledge Base for Trustpilot, Google Play, Apple App Store, Google Reviews, Reddit, Company News, and future Survey CSV data.",
    "scope": "Database schema, Docker setup, seed data export, backend retrieval, chat sessions, chat messages, frontend chat API payload",
    "result": "Added PostgreSQL + pgvector schema for companies, routes, sources, evidence_items, insight_items, chat_sessions, and chat_messages; generated seed data from the current public dashboard dataset; updated the backend to initialize, seed, retrieve evidence, and store chat turns; updated the chat UI to use database-backed Phase 2 mode.",
    "status": "Completed"
  },
  {
    "time": "2026-07-20 13:16",
    "module": "DeepSeek Chat Step 1",
    "change": "Connected the report chat assistant to a local backend DeepSeek proxy",
    "reason": "The user wants the assistant to move beyond local mock retrieval and start using a real LLM while keeping the current dashboard unchanged.",
    "scope": "Floating chat assistant, local backend API, environment-based API key handling, frontend cache versioning",
    "result": "Added a Python backend endpoint at /api/chat, kept the DeepSeek key out of frontend files, made the chat send retrieved dashboard evidence to the backend, and kept a local fallback when the backend or API key is unavailable.",
    "status": "Completed"
  },
  {
    "time": "2026-07-18 16:32",
    "module": "Daily Logs Migration",
    "change": "Replaced the standalone HANDOFF.md with dated daily logs",
    "reason": "The user wanted a persistent, easier-to-scan record of project progress instead of a single handoff file.",
    "scope": "Project documentation, frontend status, chat assistant status, local RAG status, Update Log process",
    "result": "The project now keeps dated logs under mias-cruises-customer-insights-logs/, with a README index and one daily markdown file per date.",
    "status": "Completed"
  },
  {
    "time": "2026-07-18 16:24",
    "module": "Update Log Cache Fix",
    "change": "Added script versioning for dashboard data and app logic",
    "reason": "The browser could keep showing an older Update Log even after data.js had been updated.",
    "scope": "HTML script loading, Update Log visibility",
    "result": "Added cache-busting query versions to data.js and app.js so the latest dashboard data and update logs load after refresh.",
    "status": "Completed"
  },
  {
    "time": "2026-07-18 16:18",
    "module": "Local RAG Assistant Upgrade",
    "change": "Connected the chat assistant to the frontend evidence dataset",
    "reason": "Managers need to ask follow-up questions based on the visible report instead of receiving fixed mock answers.",
    "scope": "Floating chat assistant, public evidence retrieval, bilingual response format",
    "result": "The assistant now searches embedded dashboard evidence from app reviews, Google locations, customer signals, voice themes, root causes, competitors, recommendations, and sources, then replies with English, top evidence, source list, and a translation-style summary in the user's input language.",
    "status": "Completed"
  },
  {
    "time": "2026-07-18 16:08",
    "module": "Bilingual Chat Response",
    "change": "Added English-first and input-language response format",
    "reason": "Managers may ask questions in different languages, but the product interface and business report should remain English-first.",
    "scope": "Floating chat assistant response logic",
    "result": "Chat replies now show an English answer first, followed by a translation-style summary in the detected input language.",
    "status": "Completed"
  },
  {
    "time": "2026-07-18 15:58",
    "module": "Report Chat Assistant MVP",
    "change": "Added a floating report question assistant",
    "reason": "Managers need a way to ask follow-up questions while reading the dashboard without changing the main report layout.",
    "scope": "Global frontend layout, chat launcher, chat drawer, message history, input box, send button",
    "result": "Added a responsive right-bottom chat window with message history, user input, send behavior, mock answers, and close/open controls while preserving the existing dashboard pages.",
    "status": "Completed"
  },
  {
    "time": "2026-07-18 15:30",
    "module": "Report-inspired Visual Update",
    "change": "Adjusted frontend visual style toward a report-inspired product interface",
    "reason": "The dashboard needed to feel closer to DFDS-style reporting while still working as an interactive web product.",
    "scope": "Global styles, typography, cards, page summary blocks, colors, shadows",
    "result": "Updated the interface to use softer neutral colors, lighter shadows, more report-like heading hierarchy, and a cleaner business-dashboard presentation.",
    "status": "Completed"
  },
  {
    "time": "2026-07-16 21:35",
    "module": "Route Filter Review",
    "change": "Customer Voice route filtering",
    "reason": "The page showed all-route results even when a specific route was selected.",
    "scope": "Customer Voice, Recommendations, Overview route lens",
    "result": "Customer Voice now shows only the selected route when Route focus is set to a specific route.",
    "status": "Completed"
  },
  {
    "time": "2026-07-16 21:36",
    "module": "Page Context Review",
    "change": "Route focus visibility",
    "reason": "App Reviews, Competitors, Survey CSV, Update Log, and Data Basis are not route-specific views.",
    "scope": "Top navigation and page header controls",
    "result": "Route focus is hidden on pages where route filtering would be misleading.",
    "status": "Completed"
  },
  {
    "time": "2026-07-16 21:38",
    "module": "Competitor Scope Review",
    "change": "Competitor selection explanation",
    "reason": "The competitor page needed to explain why each ferry company is relevant to DFDS.",
    "scope": "Competitors page",
    "result": "Added comparison role, main routes, DFDS overlap, customer view, and what DFDS can learn.",
    "status": "Completed"
  },
  {
    "time": "2026-07-16 21:39",
    "module": "Insight Display Review",
    "change": "Sentiment mix display",
    "reason": "Using 1-5 stars looked like emotion categories and was confusing for marketing users.",
    "scope": "Overview sentiment panel",
    "result": "Replaced star distribution with Positive / Neutral / Negative customer temperature.",
    "status": "Completed"
  },
  {
    "time": "2026-07-16 23:50",
    "module": "Brand & Layout Review",
    "change": "DFDS visual styling",
    "reason": "The interface needed to feel closer to DFDS investor/reporting materials.",
    "scope": "Global layout, sidebar, cards, logo, colors",
    "result": "Added DFDS logo and adjusted colors toward DFDS-style navy, blue, white, and cool grey.",
    "status": "Completed"
  },
  {
    "time": "2026-07-16 23:55",
    "module": "Data Basis Review",
    "change": "Sources page wording",
    "reason": "The page was less about raw links and more about the report's data basis and preparation notes.",
    "scope": "Left navigation and Data Basis page",
    "result": "Renamed Sources to Data Basis and moved data preparation notes out of Overview.",
    "status": "Completed"
  },
  {
    "time": "2026-07-16 23:58",
    "module": "Competitor Briefing Review",
    "change": "Competitor scope note",
    "reason": "Stakeholders needed a clearer explanation of how many competitors were selected and why.",
    "scope": "Competitors page",
    "result": "Changed the competitor scope note into a bullet list covering count, priority rules, and remaining review checks.",
    "status": "Completed"
  },
  {
    "time": "2026-07-17 00:02",
    "module": "Overview KPI Review",
    "change": "Top metric cards",
    "reason": "The Marketing watchout card was too abstract and did not add enough value at overview level.",
    "scope": "Overview top summary",
    "result": "Removed the watchout card and resized the three main metric cards to fit the page.",
    "status": "Completed"
  },
  {
    "time": "2026-07-17 00:04",
    "module": "Source Clarity Review",
    "change": "Reddit and Google Reviews wording",
    "reason": "Reddit and Google Reviews cards could be misunderstood as formal review-count sources.",
    "scope": "Overview Main data sources and Data Basis notes",
    "result": "Clarified Reddit as discussion signals and separated Google Reviews from brand-level review sources.",
    "status": "Completed"
  },
  {
    "time": "2026-07-17 00:14",
    "module": "Google Reviews Collection",
    "change": "Location-level Google review signals",
    "reason": "Google Reviews are meaningful for ferry analysis only when collected by terminal or route location.",
    "scope": "Main data sources, Customer Voice, Data Basis",
    "result": "Added four public Google location profiles for Calais, Dover, Newhaven, and Newcastle and mapped them to related DFDS routes.",
    "status": "Completed"
  },
  {
    "time": "2026-07-17 00:20",
    "module": "Customer Voice Redesign",
    "change": "Customer Signals page redesigned as Customer Voice",
    "reason": "The previous page showed too much evidence text and did not clearly explain what marketing managers should take away.",
    "scope": "Customer Voice page and page-specific export brief",
    "result": "Replaced long evidence cards with concise theme summaries, source tags, marketing actions, and expandable evidence details.",
    "status": "Completed"
  },
  {
    "time": "2026-07-17 00:30",
    "module": "Scope & Readability Update",
    "change": "Passenger ferry scope and full expanded text",
    "reason": "The report needed to clarify that it covers passenger ferry customers, and expanded recommendation details should not be truncated.",
    "scope": "Data Basis, Competitors, Recommendations",
    "result": "Added passenger ferry scope notes and removed text truncation from expanded recommendation details.",
    "status": "Completed"
  },
  {
    "time": "2026-07-17 00:40",
    "module": "Dashboard UX Upgrade",
    "change": "Added visual summaries and clearer business wording",
    "reason": "The dashboard needed fewer text-heavy sections and stronger visual cues for non-technical stakeholders.",
    "scope": "Overview, Recommendations, Data Basis, page export briefs",
    "result": "Added Google location rating bars, recommendation priority lanes, clearer source status language, and shorter page-specific brief wording.",
    "status": "Completed"
  },
  {
    "time": "2026-07-17 00:53",
    "module": "Product Presentation Upgrade",
    "change": "Applied clearer data visualization and business wording",
    "reason": "The dashboard needed to communicate public review evidence quickly for marketing and CX stakeholders.",
    "scope": "Overview, Recommendations, Data Basis, Update Log",
    "result": "Kept Google location evidence visible through rating and review-volume bars, grouped recommendations by priority, and replaced technical wording with clearer report language.",
    "status": "Completed"
  },
  {
    "time": "2026-07-17 01:12",
    "module": "Recommendations Wording",
    "change": "Simplified recommendation priority language",
    "reason": "The priority explanation felt too abstract for business users.",
    "scope": "Recommendations page and page export brief",
    "result": "Changed the section wording to Do first, Do next, Expected result, and Reason, with shorter recommendation explanations.",
    "status": "Completed"
  },
  {
    "time": "2026-07-17 01:24",
    "module": "Firecrawl Competitor Data Update",
    "change": "Filled competitor review gaps using Firecrawl search",
    "reason": "Several competitor rows still showed Score not collected, which limited sorting and comparison value.",
    "scope": "Competitors, Data Basis, Update Log",
    "result": "Added public Trustpilot score and review-count snapshots for Condor Ferries, Scandlines, Color Line, Fjord Line, TT-Line, Tallink Silja, and Viking Line.",
    "status": "Completed"
  },
  {
    "time": "2026-07-17 09:55",
    "module": "Page Summary Upgrade",
    "change": "Added a clear summary block at the top of every page",
    "reason": "Users needed to understand what each page is for before reading the data cards or tables.",
    "scope": "Overview, Customer Voice, App Reviews, Competitors, Recommendations, Survey CSV, Update Log, Data Basis",
    "result": "Each page now starts with a short purpose statement, what to read first, what to watch for, and how to use the page.",
    "status": "Completed"
  },
  {
    "time": "2026-07-17 00:06",
    "module": "Export Brief Review",
    "change": "Page-specific export brief",
    "reason": "The export button previously produced the same text on every page.",
    "scope": "Export page brief button",
    "result": "Export now generates a different brief for each active page and route focus.",
    "status": "Completed"
  }
];
