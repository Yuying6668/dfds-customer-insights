# Enterprise Data Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform uploaded customer, booking, CRM, operational, survey, finance, and review workbooks into traceable Bronze and Silver datasets with a usable data-quality report for BI and Mia.

**Architecture:** Keep the immutable uploaded file as Bronze. Generate a Silver manifest containing standardized records, raw-to-standardized field mappings, transformation events, per-sheet quality metrics, and typed metadata. The existing React IT Data Flow page consumes only summaries and masked Silver rows; exports carry both raw and standardized fields where privacy policy permits.

**Tech Stack:** Python 3.14, openpyxl, CSV, JSON manifests, existing `ThreadingHTTPServer`, React 19, Vite, unittest, Node assert.

---

## Delivery Boundary

Phase 1 implements the required real outputs for each upload: standardized dataset, data quality report, data dictionary, and transformation summary. It covers the ten current demo tables: Bookings, Payments, Service cases, Customers, Consent, Identity aliases, Trip legs, App events, Survey responses, and Reviews.

Phase 2 is a separate delivery: persisted data contracts, master-data tables, Silver-to-Gold star schema, and semantic metric definitions. Phase 3 is operational monitoring, freshness SLAs, streaming, and production observability. Do not label those later capabilities as complete until their storage, APIs, and UI are implemented.

## Current Gaps

The current cleaner normalizes headers, empty/sentinel values, exact duplicate rows, selected routes, dates, amounts, ratings, consent/platform/channel values, and exposes a small self-check. It does not yet preserve raw and standardized columns side-by-side, derive ISO country/language fields, split currency, create `Rating_5`, resolve a surrogate `Customer_ID`, derive route ports, derive ages, emit a true quality score, validate contracts, or record field-level lineage. Current date output is a presentation format and must be changed in the canonical Silver output to ISO-8601 UTC.

### Task 1: Define the Enterprise Field Registry

**Files:**
- Create: `backend/enterprise_standardization.py`
- Create: `backend/data_contracts.py`
- Test: `work/test_enterprise_standardization.py`

- [ ] **Step 1: Write failing field-registry tests**

```python
def test_registry_maps_known_source_columns_to_standard_fields(self):
    fields = standardization.field_definitions_for("Bookings")
    self.assertEqual(fields["route"]["standardField"], "Route_Name")
    self.assertEqual(fields["gross_amount"]["standardField"], "Amount")
    self.assertEqual(fields["gross_amount"]["rawField"], "gross_amount_raw")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m unittest work.test_enterprise_standardization.EnterpriseStandardizationTests.test_registry_maps_known_source_columns_to_standard_fields`

Expected: FAIL because `enterprise_standardization` does not exist.

- [ ] **Step 3: Implement the registry**

```python
FIELD_REGISTRY = {
    "route": {"standardField": "Route_Name", "dataType": "Text", "nullable": True},
    "gross_amount": {"standardField": "Amount", "dataType": "Decimal Number", "nullable": True},
    "country": {"standardField": "Country_Code", "dataType": "Text", "nullable": True},
}

def field_definitions_for(table_name):
    return {source: {"rawField": f"{source}_raw", **definition} for source, definition in FIELD_REGISTRY.items()}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `.venv/bin/python -m unittest work.test_enterprise_standardization.EnterpriseStandardizationTests.test_registry_maps_known_source_columns_to_standard_fields`

Expected: PASS.

### Task 2: Generate Raw-Preserving Silver Rows

**Files:**
- Modify: `backend/upload_ingest.py`
- Modify: `backend/enterprise_standardization.py`
- Test: `work/test_enterprise_standardization.py`

- [ ] **Step 1: Write a failing raw/standardized preservation test**

```python
def test_silver_rows_keep_raw_value_and_create_standard_field(self):
    result = standardization.standardize_row("Bookings", {"route": "Dover / Calais"})
    self.assertEqual(result["route_raw"], "Dover / Calais")
    self.assertEqual(result["Route_Name"], "Dover-Calais")
    self.assertEqual(result["Origin_Port"], "Dover")
    self.assertEqual(result["Destination_Port"], "Calais")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m unittest work.test_enterprise_standardization.EnterpriseStandardizationTests.test_silver_rows_keep_raw_value_and_create_standard_field`

Expected: FAIL because Silver rows are not generated.

- [ ] **Step 3: Implement the Silver record contract**

```python
def standardize_row(table_name, raw_row, context):
    silver = {f"{key}_raw": value for key, value in raw_row.items()}
    silver.update({"Source_Table": table_name, "Processing_Version": context["version"], "Processed_At": context["processedAt"]})
    return silver
```

Add deterministic standardized fields without deleting raw values. Store `standardizedRows` separately in the batch manifest and export them from the cleaned workbook.

- [ ] **Step 4: Run focused and upload tests**

Run: `.venv/bin/python -m unittest work.test_enterprise_standardization work.test_upload_ingest`

Expected: PASS.

### Task 3: Implement Reference-Data Normalizers and Typed Fields

**Files:**
- Modify: `backend/enterprise_standardization.py`
- Test: `work/test_enterprise_standardization.py`

- [ ] **Step 1: Write failing normalizer tests**

```python
def test_reference_normalizers_emit_canonical_values(self):
    self.assertEqual(standardization.country_code("Denmark"), "DK")
    self.assertEqual(standardization.language_code("ENG"), "en")
    self.assertEqual(standardization.booking_channel("Mia's Cruises App"), "Mobile App")
    self.assertEqual(standardization.rating_5("8/10"), 4.0)
    self.assertEqual(standardization.parse_datetime("29/07/2026"), "2026-07-29T00:00:00Z")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m unittest work.test_enterprise_standardization.EnterpriseStandardizationTests.test_reference_normalizers_emit_canonical_values`

Expected: FAIL because country, language, channel, scale conversion, and UTC date functions do not exist.

- [ ] **Step 3: Implement canonical values**

Implement ISO-3166 Alpha-2 countries, ISO-639-1 languages, ISO-4217 currency codes, `Amount` and `Amount_DKK` only when a supplied exchange rate is valid, `Rating_5`, `Boolean`, `Booking_Channel`, `Platform`, `Travel_Purpose`, `Origin_Port`, `Destination_Port`, `Route_Name`, and typed ISO-8601 UTC timestamps. Use `None` for every missing value, including categorical fields; do not use a string `Unknown` as a missing-value placeholder.

- [ ] **Step 4: Run normalizer tests**

Run: `.venv/bin/python -m unittest work.test_enterprise_standardization.EnterpriseStandardizationTests.test_reference_normalizers_emit_canonical_values`

Expected: PASS.

### Task 4: Identity Resolution, Age, Product, and Duplicate Rules

**Files:**
- Modify: `backend/enterprise_standardization.py`
- Modify: `backend/upload_ingest.py`
- Test: `work/test_enterprise_standardization.py`

- [ ] **Step 1: Write failing deterministic identity and duplicate tests**

```python
def test_identity_resolution_is_deterministic_and_masks_sensitive_inputs(self):
    first = standardization.customer_id({"crm_contact": "CRM-8", "email_hash": "abc"})
    second = standardization.customer_id({"crm_contact": "CRM-8", "email_hash": "abc"})
    self.assertEqual(first, second)
    self.assertTrue(first.startswith("CUS-"))

def test_duplicate_business_keys_are_flagged_but_not_removed(self):
    report = standardization.quality_report("Bookings", [{"booking_ref": "B-1"}, {"booking_ref": "B-1"}])
    self.assertEqual(report["duplicateKeyRecords"], 1)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/bin/python -m unittest work.test_enterprise_standardization -k identity -k duplicate`

Expected: FAIL because no surrogate identity or business-key quality rule exists.

- [ ] **Step 3: Implement deterministic rules**

Derive `Customer_ID` from the highest-priority available non-PII identifier using a salted SHA-256 digest; never expose the input identifier in UI/API output. Derive `Age` from `birth_year` against the batch processing year and map it to `Age_Group`. Keep legitimate repeated business keys, flag them, and remove only exact duplicate records with an explicit deterministic signature.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.venv/bin/python -m unittest work.test_enterprise_standardization work.test_upload_ingest`

Expected: PASS.

### Task 5: Produce Quality Report, Data Dictionary, and Transformation Lineage

**Files:**
- Modify: `backend/enterprise_standardization.py`
- Modify: `backend/upload_ingest.py`
- Modify: `server.py`
- Test: `work/test_enterprise_standardization.py`

- [ ] **Step 1: Write failing output-artifact tests**

```python
def test_batch_contains_quality_dictionary_and_lineage_outputs(self):
    batch = make_standardized_batch()
    self.assertIn("dataQualityReport", batch["batch"])
    self.assertIn("dataDictionary", batch["batch"])
    self.assertIn("transformationSummary", batch["batch"])
    self.assertIn("lineage", batch["files"][0]["sheets"][0])
    self.assertIn("qualityScore", batch["batch"]["dataQualityReport"])
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m unittest work.test_enterprise_standardization.EnterpriseStandardizationTests.test_batch_contains_quality_dictionary_and_lineage_outputs`

Expected: FAIL because the manifest has no enterprise artifacts.

- [ ] **Step 3: Implement artifacts**

Generate missing, invalid, duplicate, standardization, manual-review counts and rates; compute a documented 0-100 quality score from completeness, validity, uniqueness, consistency, and timeliness. For every standardized field record source table/column, transformation rule, standardized field, processing timestamp, and processing version. Expose metadata table name, business definition, source system, owner, update frequency, data type, nullable, primary key, and foreign key.

- [ ] **Step 4: Run the test to verify it passes**

Run: `.venv/bin/python -m unittest work.test_enterprise_standardization work.test_upload_http work.test_uploaded_batch_access`

Expected: PASS.

### Task 6: Render Enterprise Outputs and Gate Mia Access

**Files:**
- Modify: `app/routes/ITDataFlowRoute.jsx`
- Modify: `app/styles.css`
- Modify: `server.py`
- Test: `work/test_it_data_flow_state.mjs`
- Test: `work/test_mia_response_structure.py`

- [ ] **Step 1: Write failing UI and Mia-context tests**

```javascript
assert.match(routeSource, /Data Quality Report/);
assert.match(routeSource, /Data Dictionary/);
assert.match(routeSource, /Transformation Summary/);
```

```python
self.assertIn("qualityScore", context["qualitySummary"])
self.assertIn("dataContract", context)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `/path/to/node work/test_it_data_flow_state.mjs && .venv/bin/python -m unittest work.test_mia_response_structure`

Expected: FAIL because the page and Mia context do not expose enterprise artifacts.

- [ ] **Step 3: Implement UI and AI boundary**

Show standardization coverage, quality score, exceptions, manual-review reasons, generated fields, data types, and field lineage in expandable IT Data Flow sections. Let Mia receive only masked aggregate quality metrics, standardized non-sensitive field metadata, contract state, and approved Silver rows. Do not send raw PII or records with unresolved security classification.

- [ ] **Step 4: Run UI and Mia tests**

Run: `/path/to/node work/test_it_data_flow_state.mjs && .venv/bin/python -m unittest work.test_mia_response_structure`

Expected: PASS.

### Task 7: Add Versioned Data Contracts and Gold-Model Handoff

**Files:**
- Create: `backend/data_contracts.py`
- Create: `data/contracts/*.json`
- Create: `docs/data-model.md`
- Test: `work/test_data_contracts.py`

- [ ] **Step 1: Write failing contract validation tests**

```python
def test_bookings_contract_requires_booking_ref_and_valid_amount(self):
    result = contracts.validate("Bookings", {"booking_ref": "", "Amount": -1, "Currency_Code": "ZZZ"})
    self.assertEqual(result["state"], "needs_review")
    self.assertIn("booking_ref", result["missingRequired"])
    self.assertIn("Amount", result["businessRuleFailures"])
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m unittest work.test_data_contracts.DataContractTests.test_bookings_contract_requires_booking_ref_and_valid_amount`

Expected: FAIL because contracts are not versioned or validated.

- [ ] **Step 3: Implement versioned contracts and handoff metadata**

Store per-table JSON contracts with schema, nullable, data type, primary/foreign keys, business rules, freshness SLA, version, effective date, and compatibility. Document the Silver-to-Gold star-schema handoff for Customer, Product, Route, Calendar, Country, Currency dimensions and Booking, Sales, Feedback, Voice of Customer, Campaign, Journey facts.

- [ ] **Step 4: Run contract tests**

Run: `.venv/bin/python -m unittest work.test_data_contracts work.test_enterprise_standardization`

Expected: PASS.

## Verification

Run the complete targeted suite after every completed task:

```bash
.venv/bin/python -m unittest \
  work.test_upload_ingest \
  work.test_upload_http \
  work.test_uploaded_batch_access \
  work.test_upload_schema \
  work.test_enterprise_standardization \
  work.test_data_contracts \
  work.test_mia_response_structure
/Users/irene/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node work/test_it_data_flow_state.mjs
/Users/irene/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node work/test_it_data_flow_upload.mjs
PATH=/Users/irene/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH /Users/irene/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm run build
```

Expected: all unit tests pass and Vite produces `app/dist` without errors.

## PRD Coverage and Intentional Deferrals

Phase 1 satisfies the PRD outputs, Bronze/Silver separation, standardization rules, enterprise validation, metadata, lineage, privacy handling, and AI-ready masked context for file uploads. Phase 2 adds persisted master data, full contracts, Gold star schema, and the semantic layer. Phase 3 adds scheduled freshness monitoring, operational dashboards, streaming, and future predictive/agent capabilities. These later phases are deferred because the current repository has no durable warehouse schema or scheduler for them.
