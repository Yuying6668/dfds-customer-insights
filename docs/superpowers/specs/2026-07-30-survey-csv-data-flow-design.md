# Survey CSV Data Flow Design

## Goal

Replace the Survey CSV placeholder with an operational intake workspace that follows the existing IT Data Flow layout and interaction model. The page accepts questionnaire exports, exposes a six-stage normalisation lifecycle, provides a MIA summary, and lets users review standardised survey rows before publishing.

## Scope

The `/survey-csv` route becomes a batch-first workspace with four regions, ordered from intake to review:

1. **Survey upload**: a drag-and-drop surface plus file picker. It accepts CSV and Excel questionnaire exports, shows supported formats, upload state, progress, and recoverable errors.
2. **Six-stage lifecycle**: Capture, Profile, Clean, Standardise, Validate, and Publish. Each stage shows a concise description and uses the same complete/active/pending state treatment as IT Data Flow.
3. **MIA summary**: after upload, show a short dataset overview (response count, period, routes, languages, questions, and quality score) alongside concise business insights derived from the standardised survey data.
4. **Questionnaire standardisation preview**: after upload, present cleaned and mapped response rows with tabs for standardised responses, question mapping, and exceptions. Preserve the IT Data Flow table, pagination, export, and masked-data conventions where the existing API supports them.

## Visual Direction

Use the approved visual companion mockup as the layout reference. The route shares IT Data Flow's operational styling: pale surfaces, 8px corner radius, thin teal/gray borders, restrained navy/teal accents, Georgia section headings, and dense, scannable panels. It must not introduce dashboard metric cards, a separate navigation pattern, or decorative imagery.

The six stages sit directly beneath the upload surface as one continuous horizontal lifecycle on desktop and a stable two-column grid on mobile. The MIA section uses the existing highlighted review panel treatment. The normalisation preview is a full-width panel below it, with a standard table rather than a card grid.

## Data And Interactions

- Keep the raw uploaded survey file immutable and pass it through the existing upload-batch API where compatible.
- Use an intake profile that recognizes questionnaire fields such as response ID, route, question, answer, rating, sentiment, language, consent, and survey period.
- Reuse existing upload progress, drag state, error state, export behavior, table pagination, and MIA review loading states when their data contracts apply.
- Keep standardisation visible and auditable: show mapped fields and exceptions separately; do not silently treat unresolved mappings as clean.
- Apply the shared date rule to survey responses: valid day-first `dd/mm/yyyy` values are converted to UTC ISO-8601; impossible calendar dates such as `31/02/2026` remain in the row, increment `Invalid dates`, and appear in Expectations with their field, source value, reason, worksheet, and row detail for manual review.
- Make the preview meaningful with an empty/upload state and a real loaded state. If survey-specific backend support is not yet available, the UI must clearly retain the uploaded batch's observed profile rather than inventing a published result.

## Error Handling And Responsive Behavior

- Reject unsupported file types with a readable error near the upload surface.
- Preserve errors returned by the batch API and allow another upload attempt.
- On smaller widths, stack MIA subpanels, wrap the lifecycle into two columns, retain horizontal scrolling for the table, and keep all actions reachable.

## Verification

- Add focused route/data tests for the Survey CSV lifecycle and visible initial upload state.
- Run the existing application checks.
- Verify desktop and mobile renderings, drag upload state, file selection, stage state changes, preview tabs, pagination, and export control availability.

## Deliberately Out Of Scope

- Changing IT Data Flow behavior or its backend contracts.
- Reworking global navigation, page shell, authentication, or unrelated data sources.
- Automatically publishing unresolved survey mappings to MIA.
