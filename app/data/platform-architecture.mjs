import { passengerProfileSummary } from "./passenger-profile.mjs";
import { sourceCoverage } from "./source-coverage.mjs";
import { supervisorLogs } from "./update-log.mjs";

export const itDataFlowSummary = {
  title: "IT Data Flow",
  sourceLabel: "IT flow",
  status: "Ready for upload review",
  acceptedFormats: ["xlsx", "xls", "csv", "txt", "pdf", "doc", "docx"],
  monitoredSourceFamilies: sourceCoverage.length,
  sourceSystems: [
    "Upload inbox",
    "Version monitor",
    "Cleaning / normalization",
    "Star-schema model",
    "Dashboard views",
    "Mia chat context"
  ],
  pipelineStages: [
    {
      label: "Upload",
      status: "Input",
      detail: "Accept the latest txt, pdf, or Word files and keep the original filename."
    },
    {
      label: "Validate",
      status: "Checks",
      detail: "Verify file type, recency, route hints, and source version before processing."
    },
    {
      label: "Clean",
      status: "Normalization",
      detail: "Extract text, standardize dates and language, and remove obvious duplicates."
    },
    {
      label: "Model",
      status: "Schema",
      detail: "Map the batch into source, route, passenger, and processing dimensions."
    },
    {
      label: "Serve",
      status: "Delivery",
      detail: "Expose the cleaned batch to dashboard views, Mia, and exportable summaries."
    }
  ],
  monitoring: [
    {
      label: "File queue",
      value: "Live",
      detail: "Tracks batch size, file mix, and the most recent upload time."
    },
    {
      label: "Version watch",
      value: "On",
      detail: "Shows source versions, processing state, and batch lineage."
    },
    {
      label: "Inferred dimensions",
      value: "Route / source / language / schema",
      detail: "The guessed dimensions the agent uses before data reaches Mia."
    },
    {
      label: "Agent reliability",
      value: "0.86",
      detail: "Current confidence for extraction, mapping, and synthesis."
    }
  ],
  governanceChecks: [
    "Every file upload keeps original filename and source version.",
    "Visible fields stay visible in Excel; inferred fields stay inside the model.",
    "Human feedback can override weak batch inference before Mia reuses it."
  ],
  sourceVersions: [
    {
      source: "Public evidence snapshot",
      version: `${sourceCoverage.length} source families`,
      state: "Stable",
      note: "Trustpilot, Google Reviews, app stores, Reddit, and public source notes."
    },
    {
      source: "Passenger profile PG",
      version: `${passengerProfileSummary.passengerCount.toLocaleString()} passengers / ${passengerProfileSummary.tripCount.toLocaleString()} trips`,
      state: "Ready",
      note: "Synthetic star schema used by the Passenger Profile sub-agent."
    },
    {
      source: "Supervisor log trail",
      version: `${supervisorLogs.length} entries`,
      state: "Current",
      note: "Daily product changes and release notes stay aligned with the UI."
    },
    {
      source: "Survey CSV",
      version: "Upload later",
      state: "Waiting",
      note: "Future survey files will be versioned by upload date and schema."
    },
    {
      source: "IT flow config",
      version: "Route-aware",
      state: "Current",
      note: "Upload and processing metadata stay aligned with the active page."
    }
  ],
  agentReliability: [
    {
      agent: "Parser",
      score: 0.93,
      detail: "Reads txt, pdf, and Word uploads into one clean text stream."
    },
    {
      agent: "Classifier",
      score: 0.89,
      detail: "Infers route, source, and schema dimensions from the batch."
    },
    {
      agent: "Summarizer",
      score: 0.86,
      detail: "Turns the batch into a compact preview for the right rail."
    },
    {
      agent: "Mia",
      score: 0.88,
      detail: "Uses the shared context to answer in the current report language."
    }
  ],
  humanFeedback: [
    {
      label: "Show upload preview first",
      status: "Approved",
      detail: "Keep filename, file type, and batch size visible before the AI summary."
    },
    {
      label: "Surface source version",
      status: "Approved",
      detail: "Version tracking should be visible beside processing state."
    },
    {
      label: "Expose inferred dimensions",
      status: "Needs review",
      detail: "When quality drops, show which business fields need manual review."
    }
  ],
  visibleFields: [
    {
      field: "Source",
      type: "Text",
      visible: true,
      purpose: "Source filter"
    },
    {
      field: "Review Date",
      type: "Date",
      visible: true,
      purpose: "Trend reporting"
    },
    {
      field: "Route",
      type: "Category",
      visible: true,
      purpose: "Route comparison"
    },
    {
      field: "Language",
      type: "Category",
      visible: true,
      purpose: "Language filter"
    },
    {
      field: "Processing Status",
      type: "Status",
      visible: true,
      purpose: "Reporting readiness"
    },
    {
      field: "Business Review Notes",
      type: "Text",
      visible: false,
      purpose: "Internal quality review"
    },
    {
      field: "Quality Score",
      type: "Number",
      visible: false,
      purpose: "Review weighting"
    },
    {
      field: "Review Status",
      type: "Status",
      visible: false,
      purpose: "Human review outcome"
    }
  ],
  processedDimensions: [
    {
      dimension: "Source",
      type: "Text",
      example: "Apple App Store review",
      standardised: true,
      validation: true,
      output: "Dashboard filters"
    },
    {
      dimension: "Review Date",
      type: "Date",
      example: "2026-07-21",
      standardised: true,
      validation: true,
      output: "Trend reporting"
    },
    {
      dimension: "Language",
      type: "Category",
      example: "English",
      standardised: true,
      validation: true,
      output: "Language analysis"
    },
    {
      dimension: "Country",
      type: "Category",
      example: "United Kingdom",
      standardised: true,
      validation: true,
      output: "Market comparison"
    },
    {
      dimension: "Route",
      type: "Category",
      example: "Newcastle-IJmuiden",
      standardised: true,
      validation: true,
      output: "Route comparison"
    },
    {
      dimension: "Journey Stage",
      type: "Category",
      example: "Pre-travel",
      standardised: true,
      validation: true,
      output: "Journey analysis"
    },
    {
      dimension: "Customer Theme",
      type: "Category",
      example: "Digital self-service",
      standardised: true,
      validation: true,
      output: "Theme tracking"
    },
    {
      dimension: "Issue Category",
      type: "Category",
      example: "Mobile check-in unavailable",
      standardised: true,
      validation: true,
      output: "Issue reporting"
    },
    {
      dimension: "Sentiment",
      type: "Category",
      example: "Negative",
      standardised: true,
      validation: true,
      output: "Sentiment reporting"
    },
    {
      dimension: "Severity",
      type: "Category",
      example: "High",
      standardised: true,
      validation: true,
      output: "Priority views"
    },
    {
      dimension: "Customer Intent",
      type: "Category",
      example: "Needs travel reassurance",
      standardised: true,
      validation: true,
      output: "Service recovery"
    },
    {
      dimension: "Mentioned Service",
      type: "Category",
      example: "Mobile check-in",
      standardised: true,
      validation: true,
      output: "Service analysis"
    },
    {
      dimension: "Processing Status",
      type: "Status",
      example: "Validated for reporting",
      standardised: true,
      validation: true,
      output: "Power BI refresh"
    }
  ],
  sourceWorkbookPreview: [
    {
      source: "Booking and payment",
      sheet: "Bookings",
      rowCount: 192,
      columns: ["booking_export_row_id", "booking_ref", "customer_email", "route", "travel_date", "gross_amount", "party", "booking_channel", "product_bundle", "vehicle_added", "pet_added", "source_received_at"],
      rows: [
        { "booking_export_row_id": "RAW-20260728-0002", "booking_ref": "BK-26-00024", "customer_email": "sasha.port0073@example.test", route: "DVR-CALAIS", "travel_date": "20/02/2026", "gross_amount": "EUR 113,15", party: "5 traveller(s)", "booking_channel": "direct web", "product_bundle": "Deck seat", "vehicle_added": "yes", "pet_added": "no", "source_received_at": "2026-07-28 08:14 UTC" },
        { "booking_export_row_id": "RAW-20260728-0003", "booking_ref": "BK-26-00036", "customer_email": "sam.example0109@example.test", route: "Dover / Calais", "travel_date": "2026-03-16", "gross_amount": "EUR 317,59", party: "2 traveller(s)", "booking_channel": "direct web", "product_bundle": "Deck seat", "vehicle_added": "yes", "pet_added": "no", "source_received_at": "2026-07-28 08:21 UTC" }
      ]
    },
    {
      source: "Booking and payment",
      sheet: "Payments",
      rowCount: 48,
      columns: ["payment_export_row_id", "booking_ref", "customer_email", "route", "travel_date", "gross_amount", "booking_channel", "product_bundle", "payment_event", "source_received_at"],
      rows: [
        { "payment_export_row_id": "RAW-20260728-0001", "booking_ref": "BK-26-00012", "customer_email": "casey.signal0037@example.test", route: "Dover -> Calais", "travel_date": "2026-01-27", "gross_amount": "EUR 289,24", "booking_channel": "direct web", "product_bundle": "Deck seat", "payment_event": "payment_captured", "source_received_at": "2026-07-28 08:07 UTC" },
        { "payment_export_row_id": "RAW-20260728-0006", "booking_ref": "BK-26-00072", "customer_email": "casey.harbour0217@example.test", route: "DVR-CALAIS", "travel_date": "27/05/2026", "gross_amount": "EUR 169,01", "booking_channel": "direct web", "product_bundle": "Deck seat", "payment_event": "payment_captured", "source_received_at": "2026-07-28 08:42 UTC" }
      ]
    },
    {
      source: "Booking and payment",
      sheet: "Service cases",
      rowCount: 100,
      columns: ["service_export_row_id", "case_or_partner_ref", "customer_ref", "route_text", "note_type", "note", "partner_name", "amount_text", "source_received_at"],
      rows: [
        { "service_export_row_id": "RAW-20260728-0901", "case_or_partner_ref": "BK-26-00022", "customer_ref": "hash-427090410233", "route_text": "Dover / Calais", "note_type": "change_request", note: "Passenger asked to update sailing details after a change in travel plans.", "partner_name": "", "amount_text": "GBP 459.61", "source_received_at": "2026-08-01 17:07 UTC" },
        { "service_export_row_id": "RAW-20260728-0902", "case_or_partner_ref": "CASE-00001", "customer_ref": "CRM-000103", "route_text": "DK-Dover", "note_type": "refund", note: "Passenger asked to update sailing details after a change in travel plans.", "partner_name": "North Sea Travel Partner", "amount_text": "GBP 283.27", "source_received_at": "2026-08-01 17:14 UTC" }
      ]
    },
    {
      source: "CRM and loyalty",
      sheet: "Customers",
      rowCount: 140,
      columns: ["customer_snapshot_row_id", "crm_contact", "loyalty_no", "email_hash", "age_value", "birth_year", "country", "nationality", "preferred_language", "source_received_at"],
      rows: [
        { "customer_snapshot_row_id": "RAW-20260728-0241", "crm_contact": "CRM-000217", "loyalty_no": "DFDS-100217", "email_hash": "hash-137088233824", "age_value": "30-39", "birth_year": "1995", country: "Denmark", nationality: "Denmark", "preferred_language": "da", "source_received_at": "2026-07-29 12:07 UTC" },
        { "customer_snapshot_row_id": "RAW-20260728-0242", "crm_contact": "CRM-000253", "loyalty_no": "DFDS-100253", "email_hash": "hash-281890626137", "age_value": "51", "birth_year": "1975", country: "Denmark", nationality: "Denmark", "preferred_language": "da", "source_received_at": "2026-07-29 12:14 UTC" }
      ]
    },
    {
      source: "CRM and loyalty",
      sheet: "Consent",
      rowCount: 140,
      columns: ["consent_extract_row_id", "crm_contact", "marketing_consent", "retention", "consent_source_timestamp"],
      rows: [
        { "consent_extract_row_id": "RAW-20260728-0241", "crm_contact": "CRM-000217", "marketing_consent": "Y", retention: "active", "consent_source_timestamp": "2026-07-29 12:07 UTC" },
        { "consent_extract_row_id": "RAW-20260728-0242", "crm_contact": "CRM-000253", "marketing_consent": "Y", retention: "active", "consent_source_timestamp": "2026-07-29 12:14 UTC" }
      ]
    },
    {
      source: "CRM and loyalty",
      sheet: "Identity aliases",
      rowCount: 140,
      columns: ["identity_extract_row_id", "crm_contact", "alias_type", "alias_value", "match_key_version", "source_received_at"],
      rows: [
        { "identity_extract_row_id": "RAW-20260728-0241", "crm_contact": "CRM-000217", "alias_type": "loyalty_no", "alias_value": "DFDS-100217", "match_key_version": "identity-v2", "source_received_at": "2026-07-29 12:07 UTC" },
        { "identity_extract_row_id": "RAW-20260728-0242", "crm_contact": "CRM-000253", "alias_type": "email_hash", "alias_value": "hash-281890626137", "match_key_version": "identity-v2", "source_received_at": "2026-07-29 12:14 UTC" }
      ]
    },
    {
      source: "Voice and operations",
      sheet: "Trip legs",
      rowCount: 150,
      columns: ["trip_leg_export_row_id", "leg_ref", "booking_ref", "from_port", "to_port", "scheduled_departure", "leg_direction", "ops_status", "correction_sequence", "source_received_at"],
      rows: [
        { "trip_leg_export_row_id": "RAW-20260728-0381", "leg_ref": "LEG-26-00364", "booking_ref": "BK-26-00399", "from_port": "Calais", "to_port": "Dover", "scheduled_departure": "2026-07-21T12:00Z", "leg_direction": "return", "ops_status": "arrived", "correction_sequence": "2", "source_received_at": "2026-07-30 04:27 UTC" },
        { "trip_leg_export_row_id": "RAW-20260728-0382", "leg_ref": "LEG-26-00378", "booking_ref": "BK-26-00067", "from_port": "Calais", "to_port": "Dover", "scheduled_departure": "2026-05-18T16:00Z", "leg_direction": "return", "ops_status": "departed", "correction_sequence": "1", "source_received_at": "2026-07-30 04:34 UTC" }
      ]
    },
    {
      source: "Voice and operations",
      sheet: "App events",
      rowCount: 160,
      columns: ["app_event_export_row_id", "device_hash", "account_hash", "event", "route_query", "campaign", "platform", "event_time", "source_received_at"],
      rows: [
        { "app_event_export_row_id": "RAW-20260728-0531", "device_hash": "device-0137-00", "account_hash": "hash-890141548787", event: "search_route", "route_query": "DVR-CALAIS", campaign: "summer_family", platform: "android", "event_time": "14-07-2026 09:00", "source_received_at": "2026-07-30 21:57 UTC" },
        { "app_event_export_row_id": "RAW-20260728-0532", "device_hash": "device-0173-01", "account_hash": "hash-676469768980", event: "view_cabin", "route_query": "Dover / Calais", campaign: "weekend_offer", platform: "ios", "event_time": "26-07-2026 09:00", "source_received_at": "2026-07-30 22:04 UTC" }
      ]
    },
    {
      source: "Voice and operations",
      sheet: "Survey responses",
      rowCount: 110,
      columns: ["survey_export_row_id", "response_id", "email_or_loyalty", "crossing", "age_band", "travel_reason", "rating", "free_text", "utm_source", "source_received_at"],
      rows: [
        { "survey_export_row_id": "RAW-20260728-0691", "response_id": "SUR-00000", "email_or_loyalty": "DFDS-100257", crossing: "Dover-Calais", "age_band": "20-29", "travel_reason": "mini-cruise", rating: "3/5", "free_text": "The route suited our plans, but I would like clearer port updates.", "utm_source": "agency", "source_received_at": "2026-07-31 16:37 UTC" },
        { "survey_export_row_id": "RAW-20260728-0692", "response_id": "SUR-00001", "email_or_loyalty": "sasha.anchor0293@example.test", crossing: "Dover-Calais", "age_band": "40-49", "travel_reason": "mini-cruise", rating: "4/5", "free_text": "The route suited our plans, but I would like clearer port updates.", "utm_source": "agency", "source_received_at": "2026-07-31 16:44 UTC" }
      ]
    },
    {
      source: "Voice and operations",
      sheet: "Reviews",
      rowCount: 100,
      columns: ["review_export_row_id", "review_ref", "route_mentioned", "score", "language_hint", "review_text", "published", "source_received_at"],
      rows: [
        { "review_export_row_id": "RAW-20260728-0801", "review_ref": "REV-00000", "route_mentioned": "Dover -> Calais", score: "5/5", "language_hint": "en", "review_text": "Boarding was quick and the cabin was comfortable.", published: "07.05.2026", "source_received_at": "2026-08-01 05:27 UTC" },
        { "review_export_row_id": "RAW-20260728-0802", "review_ref": "REV-00001", "route_mentioned": "DVR-CALAIS", score: "4,0", "language_hint": "da", "review_text": "Kabinen var fin, men informationen kom sent.", published: "31.05.2026", "source_received_at": "2026-08-01 05:34 UTC" }
      ]
    }
  ],
  batchPreview: [
    "New uploads keep original text, detected language, and version metadata.",
    "Rows can be sliced into source, route, and processing dimensions before they reach Mia.",
    "The preview should sit close to the upload form so the operator can sanity-check the batch."
  ]
};

export const memoryArchitectureSummary = {
  title: "Platform memory architecture",
  status: "Shared across the whole product",
  sharedSurfaces: [
    "Overview",
    "Passenger Profile",
    "Survey CSV",
    "Data Basis",
    "IT Data Flow",
    "Review Console",
    "Mia"
  ],
  layers: [
    {
      layer: "Short-term memory",
      storage: "chat_messages + current page state",
      scope: "Recent turns, active route, selected files, open filters, and temporary UI state.",
      purpose: "Keep the current conversation and page context in view."
    },
    {
      layer: "Medium-term memory",
      storage: "session state + batch metadata + feedback queue",
      scope: "Open upload batches, current dataset versions, active passenger-profile slices, and validation notes.",
      purpose: "Keep the active workstream coherent while the operator is still working."
    },
    {
      layer: "Long-term memory",
      storage: "project_memories + insight KB + approved policies",
      scope: "Durable product rules, reusable analysis patterns, validated insights, and shared platform conventions.",
      purpose: "Reuse stable knowledge across sessions and product surfaces."
    }
  ],
  rules: [
    "Only long-term memory should store durable decisions.",
    "Short-term memory should stay local to the current session or page.",
    "Medium-term memory should decay once a batch or project slice closes.",
    "Mia should cite evidence and memory separately when she answers a question.",
    "Platform memory should support overview, passenger profile, survey, data basis, IT flow, and chatbot answers together."
  ]
};
