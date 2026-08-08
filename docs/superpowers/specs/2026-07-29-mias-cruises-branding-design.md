# Mia's Cruises Frontend Branding Design

## Goal

Present the application as `Mia's Cruises` for an interview demo without changing its internal data model or external source references.

## Display Scope

- Remove the image-only DFDS logo from the top of the left sidebar.
- Change the sidebar product name and visible DFDS copy in React views to `Mia's Cruises` or an appropriate possessive form, such as `Mia's Cruises' customer intelligence workspace`.
- Keep visible third-party source names and URLs truthful where they identify the original DFDS application or a public DFDS record.
- Preserve internal identifiers, filenames, API contracts, and comparison-baseline logic.

## Verification

A Node static-source test will assert that the primary shell uses `Mia's Cruises` and no longer renders the DFDS logo URL. `vite build` will confirm the React application compiles.
