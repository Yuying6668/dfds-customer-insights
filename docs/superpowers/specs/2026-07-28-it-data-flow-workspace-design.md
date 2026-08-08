# IT Data Flow Workspace Design

## Purpose

Redesign the `IT Data Flow` route as a technical-review workspace. The page must show how a source batch travels from raw uploaded files to governed data that can be consumed by dashboard views and Mia. It should demonstrate data-flow mapping, data contracts, lineage, quality controls, human review, and shared memory boundaries without presenting these topics as competing dashboard cards.

The primary audience is a technical interviewer or reviewer. The product should still feel like a plausible internal data-operations surface rather than a static architecture slide.

## Design Decisions

- The page is organized around a source batch, not a collection of platform metrics.
- The first viewport contains only the upload action, a compact lifecycle status strip, and a collapsed `Mia intake brief` drawer.
- The large flow-map card, four summary metric cards, and standalone processing-monitor card are removed.
- Details are progressively disclosed below the primary workflow.
- `Agent reliability` and `Human feedback` become one `Quality review` area.
- Platform memory is retained as a collapsed technical architecture section, because it is relevant to the project but not to the first operator action.
- Existing page route remains `/it-data-flow` and the navigation label remains `IT Data Flow`.

## Information Architecture

```text
IT Data Flow
  Batch intake (default view)
    Upload a source batch
    Selected-file list and batch metadata
    Lifecycle: Upload -> Validate -> Classify -> Map -> Review -> Ready for Mia
    Mia intake brief (collapsed drawer)
  Batch lineage
    Source, version, timestamp, processing state, downstream consumers
  Data contract
    Visible spreadsheet fields, hidden inferred fields, model role
  Quality review
    Agent checks, confidence, exceptions, human review state, release decision
  Platform architecture
    Short-term, medium-term, and long-term memory with consumption boundaries
```

## First Viewport

The page header is concise: `IT Data Flow` and one sentence, `Trace a source batch from raw file to governed knowledge.` The current `PageSummary` block and its three instructional cards are removed from this route.

The upload surface is the largest element. It supports `.txt`, `.pdf`, `.doc`, and `.docx` files. Before selection it explains the accepted formats and purpose. After selection it shows the batch filename list, type, size, total size, and current batch state in the same surface.

Under the upload surface is a single horizontal lifecycle strip:

```text
Upload -> Validate -> Classify -> Map -> Review -> Ready for Mia
```

It uses compact status markers rather than large cards or a diagram. It is the technical story of the page, and it changes state after a file selection.

At the right edge is a narrow `Mia intake brief` trigger. It shows only compact status text when closed. On click it opens a bounded drawer or panel containing the batch summary, inferred dimensions, likely quality issues, governance checks, and impact on Dashboard and Mia. It must not remain open by default.

## Progressive Sections

### Batch Lineage

This is a table-focused section, not a card grid. It shows source family, source version, batch state, timestamp or freshness note, and intended consumers. It turns the existing `Source versions` information into a real lineage artifact.

### Data Contract

This section starts collapsed. When opened, it separates fields that remain visible in an Excel-style source view from model-side inferred dimensions. It should make the relation to the star schema explicit: source, route, passenger/profile, processing, and memory-related fields. The visible-field table remains available, but it is not rendered by default.

### Quality Review

This combines agent reliability and human feedback. The core review question is not which agent has the highest score; it is whether a batch can be published. The section shows validation checks, confidence or exceptions, reviewer notes, and a final state such as `Ready`, `Needs review`, or `Blocked`.

### Platform Architecture

This is an accordion-like technical disclosure, collapsed by default. It displays the short-, medium-, and long-term memory model, distinguishing temporary batch state from durable project knowledge. Its purpose is to demonstrate shared platform architecture and explain why Mia can use approved knowledge without treating current uploads as long-term facts.

## Interaction Model

- Selecting files updates the batch list, batch metadata, lifecycle status, and Mia brief input.
- The Mia brief opens only after the reviewer chooses to inspect it. It must have a close control and return focus to its trigger.
- Each lower technical section uses an expandable disclosure control with an accurate `aria-expanded` state.
- In the empty state, the page does not imply that a batch has been processed. The Mia brief explains that it needs an uploaded batch.
- Existing manual feedback submission remains available inside `Quality review`.

## Technical Narrative for Reviewers

The page should make this sequence obvious without requiring a presenter to explain every card:

```text
Raw source files
-> versioned batch
-> validation and classification
-> structured / modeled dataset
-> quality and human review
-> Dashboard and Mia consumption
```

This makes the following capabilities visible:

- process and data-flow mapping;
- source lineage and version control;
- structured field and schema design;
- quality gates and human-in-the-loop governance;
- separation of temporary batch context and durable memory;
- controlled consumption by analytics and a chat agent.

## Visual Direction

- Retain the existing DFDS application shell and restrained blue, white, and neutral palette.
- Use open workspace layout rather than nested panels and card grids.
- Use a thin lifecycle strip and tables where data comparison matters.
- Reserve cards for selected files, review exceptions, and the Mia drawer only.
- Use a familiar disclosure icon and clear tooltip for the collapsed Mia brief. Use the existing icon library if available; otherwise use accessible text plus a simple directional icon.
- Keep the desktop layout legible at 1280px and collapse the Mia trigger above the content on narrow screens. The brief remains closed by default on mobile.

## Acceptance Criteria

1. The first viewport contains no four-card metric grid, no large flow map, and no standalone processing-monitor card.
2. Upload is the visually dominant first action.
3. A lifecycle strip communicates all six stages in a compact, readable sequence.
4. `Mia intake brief` is closed by default and opens through a deliberate user action.
5. Lineage, data contract, quality review, and platform architecture are separately expandable and have clear responsibilities.
6. Reliability and human feedback are represented under one quality-review domain.
7. The page continues to show the existing upload, file preview, field visibility, and feedback capabilities.
8. The route renders correctly at desktop and mobile sizes without overlapping content or clipped controls.

## Out of Scope

- Real file persistence, OCR, or asynchronous ingestion jobs.
- Changing the PostgreSQL schema, memory seeds, or Mia retrieval behavior.
- Replacing the broader application navigation or visual system.
