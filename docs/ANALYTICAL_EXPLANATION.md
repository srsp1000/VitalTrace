# VitalTrace Analytical Layer Documentation: Architecture, Metrics, and Clinical Data Governance

**Document Version:** 1.0.0  
**Phase:** 3 — Analytical Data Engineering & Reporting  
**Engine:** PostgreSQL 15+ / Supabase Relational Engine  
**Target BI Architecture:** Power BI Import Mode Semantic Layer  

---

## 1. Executive Summary

VitalTrace is an enterprise-grade healthcare data platform engineered to solve the "last mile" problem in clinical record interoperability. Millions of clinical encounters produce unstructured and semi-structured diagnostic artifacts—such as scanned PDF lab reports, faxed panel results, and multi-page health system summaries. VitalTrace ingests these documents, executes optical and multimodal LLM extraction, applies deterministic data quality validation rules, and presents verified biomarker time-series data to patients and clinicians.

The analytical data layer serves five core business objectives:
1. **Pipeline Reliability & Operational Throughput:** Quantify document ingestion velocity, optical character recognition (OCR) / multimodal extraction execution latency, terminal success rates, and retry overhead across AI models.
2. **Clinical Data Quality & Syntactic Integrity:** Audit field-level completeness (numeric values, clinical units, physiological reference bounds), detect duplicate readings, and measure deterministic validation error rates.
3. **Human-in-the-Loop (HITL) Governance & Review Debt:** Monitor clinician and patient audit queues, tracking confirmation rates and aging velocity across operational service-level agreement (SLA) tiers (<24 hours, 1–7 days, >7 days).
4. **Semantic Normalization & Terminology Interoperability:** Measure coverage of standardized clinical ontologies, specifically Logical Observation Identifiers Names and Codes (LOINC), mapping raw hospital test strings into universally queryable canonical biomarkers.
5. **Longitudinal Clinical Trajectories:** Enable longitudinal trend monitoring for chronic biomarkers (such as Fasting Glucose, HbA1c, and Lipid Panels) with calculated inter-reading deltas and reference range contextualization.

---

## 2. Relational Data Model Architecture

The VitalTrace relational database operates under strict multi-tenant Row-Level Security (RLS) within PostgreSQL. The schema enforces foreign key integrity, cascade deletions, and explicit status check constraints.

### 2.1 Entity-Relationship Diagram (ASCII)

```
+-------------------------------------------------------------------------------+
|                                  auth.users                                   |
|  (Supabase Authentication Engine: user authentication, sessions, credentials) |
+-------------------------------------------------------------------------------+
                                      | 1:1
                                      v
+-------------------------------------------------------------------------------+
|                               public.profiles                                 |
+-------------------------------------------------------------------------------+
| PK  id                  UUID        REFERENCES auth.users(id) ON DELETE CASCADE
|     user_id             UUID        REFERENCES auth.users(id) ON DELETE CASCADE
|     display_name        TEXT        NOT NULL DEFAULT 'User'
|     role                TEXT        NOT NULL DEFAULT 'patient' ('patient','admin')
|     created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
|     updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
+-------------------------------------------------------------------------------+
           | 1                                               | 1
           |                                                 |
           | N (CASCADE)                                     | N (CASCADE)
           v                                                 v
+-------------------------------------+   +-------------------------------------+
|          public.documents           |   |         public.observations         |
+-------------------------------------+   +-------------------------------------+
| PK  id                UUID (gen)    |   | PK  id                 UUID (gen)   |
| FK  profile_id        UUID -> prof  |<--| FK  profile_id         UUID -> prof |
|     original_filename TEXT          |   | FK  document_id        UUID -> docs |
|     storage_path      TEXT          |   | FK  extraction_run_id  UUID -> runs |
|     mime_type         TEXT          |   |     raw_test_name      TEXT         |
|     file_size_bytes   BIGINT        |   |     canonical_test_name TEXT        |
|     checksum          TEXT          |   |     loinc_code         TEXT (opt)   |
|     document_type     TEXT          |   |     value_numeric      DOUBLE PREC  |
|     document_date     DATE          |   |     value_text         TEXT         |
|     processing_status TEXT          |   |     original_unit      TEXT         |
|     processing_error  TEXT          |   |     normalized_unit    TEXT         |
|     created_at        TIMESTAMPTZ   |   |     reference_low      DOUBLE PREC  |
|     updated_at        TIMESTAMPTZ   |   |     reference_high     DOUBLE PREC  |
+-------------------------------------+   |     observation_date   DATE         |
           | 1                            |     validation_status  TEXT         |
           |                              |     verified_by_user   TEXT         |
           | N (CASCADE)                  |     user_corrected     BOOLEAN      |
           v                              |     page_number        INT          |
+-------------------------------------+   |     notes              TEXT         |
|       public.extraction_runs        |   |     created_at         TIMESTAMPTZ  |
+-------------------------------------+   |     updated_at         TIMESTAMPTZ  |
| PK  id                     UUID     |   +-------------------------------------+
| FK  document_id            UUID     |          | 1                 ^
|     model_name             TEXT     |          |                   | 0..1 (CASCADE)
|     status                 TEXT     |          | N (CASCADE)       |
|     started_at             TIMESTAMPTZ         v                   |
|     completed_at           TIMESTAMPTZ+-------------------------------------+
|     extracted_count        INT      | |      public.validation_issues       |
|     validation_issue_count INT      | +-------------------------------------+
|     error_message          TEXT     | | PK  id                UUID (gen)    |
|     duration_ms            INT      | | FK  document_id       UUID -> docs  |
+-------------------------------------+ | FK  extraction_run_id UUID -> runs  |
           | 1                            | FK  observation_id    UUID -> obs   |
           |                              |     issue_type        TEXT          |
           | N (CASCADE)                  |     severity          TEXT          |
           +----------------------------->|     message           TEXT          |
                                          |     resolved          BOOLEAN       |
                                          |     created_at        TIMESTAMPTZ   |
                                          |     resolved_at       TIMESTAMPTZ   |
                                          +-------------------------------------+
```

### 2.2 Relational Integrity & Cascade Rules
- **Profile Scoping:** Deleting a user profile cascades directly to all associated documents and observations.
- **Run Isolation:** If an extraction run is deleted, associated observations have their `extraction_run_id` set to `NULL` (`ON DELETE SET NULL`), preserving verified patient clinical history while removing orphaned run metadata.
- **Deterministic Issue Audit:** Validation issues are linked to both the parent `document_id` and `extraction_run_id` (mandatory cascades) and optionally to a specific `observation_id` (e.g., cell-level plausibility bound alerts or missing units).

---

## 3. Seven Core Analytical Metric Definitions

The following table formalizes the operational and clinical metrics computed in `sql/analytics/analytical_queries.sql` and `sql/analytics/reporting_views.sql`.

| Metric Name | Numerator | Denominator | Time Window | Exclusions | Business Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Data Completeness Rate** | Count of observations meeting field criterion (`has_value`, `has_unit`, `has_reference_range`, or all three) | Total observations evaluated (`COUNT(*)`) | All ingested observations to date | None | Assesses whether extracted clinical records meet the threshold for downstream graphing, CDS alerts, and trend analytics. |
| **2. Duplicate Observation Rate** | Redundant observation rows flagged by window partition (`row_num > 1`) | Total observations evaluated (`COUNT(*)`) | Historical document ingestion history | None | Measures ingestion redundancy caused by overlapping panel pages, fax re-transmissions, or multi-page table overlap. |
| **3. Extraction Success Rate & Retry Rate** | **Success Rate:** Runs with `status = 'completed'`<br>**Retry Rate:** (`total_terminal_runs - unique_documents`) | **Success Rate:** Total terminal runs (`completed + failed`)<br>**Retry Rate:** Unique documents (`COUNT(DISTINCT document_id)`) | Complete ingestion lifecycle | In-flight active runs (`status = 'running'`) | Evaluates optical extraction infrastructure stability and quantifies pipeline re-execution overhead. |
| **4. Review Backlog Aging & Verification Completion** | **Backlog Aging:** Pending observations segmented into `<24h`, `1-7d`, `>7d`<br>**Completion:** Observations with `verified_by_user IN ('confirmed', 'rejected')` | Total observations persisted (`COUNT(*)`) | Trailing queue relative to `NOW()` | None | Measures human audit throughput and identifies operational review debt exceeding SLA thresholds. |
| **5. Analyte Mapping / LOINC Coverage Rate** | Observations with non-null, non-blank `loinc_code` per canonical analyte | Total observations for that canonical analyte | Complete observation repository | None | Monitors clinical semantic normalization progress across diverse hospital laboratory formats. |
| **6. Extraction Latency Percentiles (p50 / p95)** | Continuous distribution of run elapsed time (`duration_ms`) | Total completed extraction runs with non-null duration | All recorded execution batches | Failed runs (`status = 'failed'`) and null durations | Quantifies typical (median) and tail (p95) execution performance across multimodal LLM backends. |
| **7. Longitudinal Trajectory Value Delta** | Algebraic difference between consecutive confirmed readings: `value_numeric - LAG(value_numeric)` | Preceding confirmed reading (`LAG(value_numeric)`) for percentage shifts | Sequential observations ordered chronologically | Unconfirmed observations (`!= 'confirmed'`), null numeric values, non-target analytes | Enables patient and physician tracking of disease progression or treatment response over time. |

---

## 4. Comprehensive Data Dictionary

### 4.1 Table: `public.profiles`
| Table | Column | Type | Description | Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `profiles` | `id` | `UUID` | Primary identifier, 1:1 with Supabase auth account | `PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` |
| `profiles` | `user_id` | `UUID` | Foreign reference to auth.users | `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `profiles` | `display_name` | `TEXT` | User's full name or demographic handle | `NOT NULL DEFAULT 'User'` |
| `profiles` | `role` | `TEXT` | Server-controlled role for authorization | `NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'admin'))` |
| `profiles` | `created_at` | `TIMESTAMPTZ` | Timestamp when profile was provisioned | `NOT NULL DEFAULT NOW()` |
| `profiles` | `updated_at` | `TIMESTAMPTZ` | Timestamp when profile record was last modified | `NOT NULL DEFAULT NOW()` |

### 4.2 Table: `public.documents`
| Table | Column | Type | Description | Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `documents` | `id` | `UUID` | Primary key for uploaded document record | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `documents` | `profile_id` | `UUID` | Foreign reference to profile owning document | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` |
| `documents` | `original_filename` | `TEXT` | File name as uploaded by user | `NOT NULL` |
| `documents` | `storage_path` | `TEXT` | Object storage path within Supabase Storage | `NOT NULL` |
| `documents` | `mime_type` | `TEXT` | MIME format (e.g., application/pdf, image/png) | `NOT NULL` |
| `documents` | `file_size_bytes` | `BIGINT` | File size in bytes | `NOT NULL` |
| `documents` | `checksum` | `TEXT` | SHA-256 content checksum for idempotency | `NOT NULL DEFAULT ''` |
| `documents` | `document_type` | `TEXT` | Document taxonomy classification | `NOT NULL DEFAULT 'lab_report'` |
| `documents` | `document_date` | `DATE` | Stated date of the report or collection | `NULLABLE` |
| `documents` | `processing_status` | `TEXT` | Document pipeline lifecycle state | `NOT NULL DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'processing', 'review_required', 'completed', 'failed'))` |
| `documents` | `processing_error` | `TEXT` | Failure message if parsing failed | `NULLABLE` |
| `documents` | `created_at` | `TIMESTAMPTZ` | Timestamp of upload | `NOT NULL DEFAULT NOW()` |
| `documents` | `updated_at` | `TIMESTAMPTZ` | Timestamp of last metadata update | `NOT NULL DEFAULT NOW()` |

### 4.3 Table: `public.extraction_runs`
| Table | Column | Type | Description | Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `extraction_runs` | `id` | `UUID` | Primary key for extraction execution run | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `extraction_runs` | `document_id` | `UUID` | Foreign reference to source document | `NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE` |
| `extraction_runs` | `model_name` | `TEXT` | LLM or OCR engine model descriptor | `NOT NULL` |
| `extraction_runs` | `status` | `TEXT` | Execution run state | `NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))` |
| `extraction_runs` | `started_at` | `TIMESTAMPTZ` | Timestamp when inference engine started | `NOT NULL DEFAULT NOW()` |
| `extraction_runs` | `completed_at` | `TIMESTAMPTZ` | Timestamp when inference engine terminated | `NULLABLE` |
| `extraction_runs` | `extracted_count` | `INTEGER` | Raw count of observations extracted | `NOT NULL DEFAULT 0` |
| `extraction_runs` | `validation_issue_count`| `INTEGER` | Count of data quality issues flagged | `NOT NULL DEFAULT 0` |
| `extraction_runs` | `error_message` | `TEXT` | Exception stack or parser error details | `NULLABLE` |
| `extraction_runs` | `duration_ms` | `INTEGER` | Wall-clock execution time in milliseconds | `NULLABLE` |

### 4.4 Table: `public.observations`
| Table | Column | Type | Description | Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `observations` | `id` | `UUID` | Primary key for discrete lab observation | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `observations` | `profile_id` | `UUID` | Foreign reference to owning profile | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` |
| `observations` | `document_id` | `UUID` | Foreign reference to source document | `NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE` |
| `observations` | `extraction_run_id` | `UUID` | Foreign reference to extraction execution | `NULLABLE REFERENCES public.extraction_runs(id) ON DELETE SET NULL` |
| `observations` | `raw_test_name` | `TEXT` | Unmodified analyte string verbatim from report | `NOT NULL` |
| `observations` | `canonical_test_name` | `TEXT` | Standardized internal analyte name | `NOT NULL` |
| `observations` | `loinc_code` | `TEXT` | Standard LOINC identifier | `NULLABLE` |
| `observations` | `value_numeric` | `DOUBLE PREC`| Quantitative measurement value | `NULLABLE` |
| `observations` | `value_text` | `TEXT` | Qualitative or textual measurement string | `NULLABLE` |
| `observations` | `original_unit` | `TEXT` | Unit string as printed on report | `NOT NULL DEFAULT ''` |
| `observations` | `normalized_unit` | `TEXT` | UCUM-standardized clinical unit | `NULLABLE` |
| `observations` | `reference_low` | `DOUBLE PREC`| Lower physiological reference threshold | `NULLABLE` |
| `observations` | `reference_high` | `DOUBLE PREC`| Upper physiological reference threshold | `NULLABLE` |
| `observations` | `observation_date` | `DATE` | Specimen collection or test date | `NOT NULL` |
| `observations` | `validation_status` | `TEXT` | Deterministic pipeline validation flag | `NOT NULL DEFAULT 'valid' CHECK (validation_status IN ('valid', 'warning', 'error'))` |
| `observations` | `verified_by_user` | `TEXT` | Human-in-the-loop audit review status | `NOT NULL DEFAULT 'pending' CHECK (verified_by_user IN ('pending', 'confirmed', 'rejected'))` |
| `observations` | `user_corrected` | `BOOLEAN` | Indicates whether human edited extracted data | `NOT NULL DEFAULT FALSE` |
| `observations` | `page_number` | `INTEGER` | Source document page number | `NULLABLE` |
| `observations` | `notes` | `TEXT` | Clinical or user-entered notes | `NULLABLE` |
| `observations` | `created_at` | `TIMESTAMPTZ` | Record ingestion timestamp | `NOT NULL DEFAULT NOW()` |
| `observations` | `updated_at` | `TIMESTAMPTZ` | Record modification timestamp | `NOT NULL DEFAULT NOW()` |
| `observations` | `chk_observation_value` | `CHECK` | Enforces that value_numeric OR value_text exists | `CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL)` |

### 4.5 Table: `public.validation_issues`
| Table | Column | Type | Description | Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `validation_issues`| `id` | `UUID` | Primary key for flagged discrepancy | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `validation_issues`| `document_id` | `UUID` | Foreign reference to document | `NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE` |
| `validation_issues`| `extraction_run_id`| `UUID` | Foreign reference to extraction run | `NOT NULL REFERENCES public.extraction_runs(id) ON DELETE CASCADE` |
| `validation_issues`| `observation_id` | `UUID` | Optional reference to specific observation | `NULLABLE REFERENCES public.observations(id) ON DELETE CASCADE` |
| `validation_issues`| `issue_type` | `TEXT` | Categorical classification of quality issue | `NOT NULL CHECK (issue_type IN ('missing_test_name','missing_value','missing_unit','invalid_date','duplicate_observation','implausible_bounds','unsupported_unit','unmapped_test'))` |
| `validation_issues`| `severity` | `TEXT` | Impact level of the issue | `NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error'))` |
| `validation_issues`| `message` | `TEXT` | Human-readable explanation of discrepancy | `NOT NULL` |
| `validation_issues`| `resolved` | `BOOLEAN` | Whether issue was addressed or waived | `NOT NULL DEFAULT FALSE` |
| `validation_issues`| `created_at` | `TIMESTAMPTZ` | Timestamp when issue was flagged | `NOT NULL DEFAULT NOW()` |
| `validation_issues`| `resolved_at` | `TIMESTAMPTZ` | Timestamp when issue was resolved | `NULLABLE` |

---

## 5. Key Findings: Baseline Synthetic Seed Dataset Analysis

Evaluating the ground-truth synthetic data seeded in `supabase/seed.sql` provides empirical baselines for validating SQL queries, reporting views, and Power BI dashboards.

### 5.1 Pipeline Reliability & Ingestion Volume
- **Total Ingested Documents:** 5 files
  - `3 completed` (60.0%):
    - `Doc 1`: Quest Comprehensive Metabolic Panel (`245.8 KB`, PDF)
    - `Doc 3`: BioReference CBC & Differential (`189.2 KB`, PDF)
    - `Doc 4`: Endocrine Specialists TSH / Thyroid (`1,048.6 KB`, PNG raster image)
  - `1 review_required` (20.0%):
    - `Doc 2`: LabCorp Lipid & Metabolic Panel (`312.4 KB`, PDF) — halted for clinician audit due to validation warnings.
  - `1 failed` (20.0%):
    - `Doc 5`: Corrupted Fax Scan Electrolytes (`98.1 KB`, PDF) — terminated with syntax error.
- **Extraction Run Reliability:** 5 total terminal runs (`gemini-1.5-flash`)
  - **Terminal Success Rate:** 80.0% (4 completed, 1 failed).
  - **Retry Rate:** 0.0% (5 runs on 5 unique documents; no retries executed).
  - **Failure Root Cause:** Doc 5 failed due to `Document parser syntax error: truncated PDF stream or illegible raster scan.` (failed run execution time: 1,250 ms).

### 5.2 Latency Distribution Profile (`gemini-1.5-flash`)
- **Completed Run Sample Size:** 4 runs
- **Mean Processing Latency:** 2,337.5 ms (~2.34 seconds)
- **Minimum Latency:** 1,820 ms (Doc 4, 1-page PNG)
- **Maximum Latency:** 3,100 ms (Doc 2, multi-panel PDF)
- **Median (p50):** 2,215.0 ms
- **95th Percentile (p95):** 3,002.5 ms
- **Insight:** Large multi-panel PDF documents exhibit higher inference latency than single-page focused scans, but overall latency remains within standard interactive web application thresholds (< 5 seconds).

### 5.3 Observation Volume, Quality & Completeness
- **Total Persisted Observations:** 19 records
- **Field Completeness Breakdown:**
  - **Value Completeness:** 19/19 (100.0%) — All records contain numeric measurements.
  - **Unit Completeness:** 18/19 (94.74%) — 1 observation (Triglycerides in Doc 2) had a blank unit (`original_unit = ''`).
  - **Reference Range Completeness:** 19/19 (100.0%) — All observations possess at least one physiological bound (16 have both low and high bounds; 3 lipid tests have single-sided upper limits).
  - **Full Completeness:** 18/19 (94.74%).
- **Deduplication Rate:**
  - Partitioning by `(profile_id, canonical_test_name, observation_date)` detects 1 duplicate row: "Total Cholesterol" recorded twice on `2024-06-20` in Doc 2.
  - **Duplicate Observation Rate:** 1 / 19 = 5.26%.

### 5.4 Human-in-the-Loop Review Queue & Backlog
- **Verification Breakdown:**
  - `Confirmed`: 15 observations (78.95%) across Doc 1, Doc 2, Doc 3, and Doc 4.
  - `Pending Review`: 4 observations (21.05%) — all located in Doc 2 (Fasting Glucose, Duplicate Total Cholesterol, Missing Unit Triglycerides, and Implausible Platelet Count).
  - `Rejected`: 0 observations (0.0%).
- **Verification Completion Rate:** 78.95%.
- **Backlog Debt:** All 4 pending observations were ingested historically (> 7 days elapsed), representing 100% SLA review debt in the aging queue.

### 5.5 Semantic Interoperability (LOINC Harmonization)
- **LOINC Coverage:** 100.0% (19/19 observations mapped across 8 distinct canonical analytes):
  - Fasting Glucose: `1558-6` (4 observations)
  - Total Cholesterol: `2093-3` (4 observations)
  - LDL Cholesterol: `13457-7` (3 observations)
  - Platelet Count: `777-3` (2 observations)
  - HbA1c: `4548-4` (1 observation)
  - Creatinine: `2160-0` (1 observation)
  - HDL Cholesterol: `2085-9` (1 observation)
  - Hemoglobin: `718-7` (1 observation)
  - TSH: `3016-3` (1 observation)

### 5.6 Longitudinal Fasting Glucose Trajectory
Filtering confirmed Fasting Glucose observations reveals a multi-quarter clinical trajectory:
1. `2024-03-15` (Doc 1): `92 mg/dL` | Within normal reference interval (70–99 mg/dL) | **Baseline**
2. `2024-06-20` (Doc 2): `98 mg/dL` | Excluded from confirmed-only trajectory (pending review audit)
3. `2024-09-10` (Doc 3): `106 mg/dL` | **Above Normal** (> 99 mg/dL) | **Delta from Baseline:** `+14 mg/dL` (+15.22%), +179 days elapsed
4. `2024-11-04` (Doc 4): `95 mg/dL` | Returned to Normal range (70–99 mg/dL) | **Delta from Preceding:** `-11 mg/dL` (-10.38%), +55 days elapsed

### 5.7 Active Validation Discrepancies
- **Total Flagged Issues:** 4 issues (all currently active, 0% resolution rate):
  1. `duplicate_observation` (Warning, Doc 2): Total Cholesterol recorded twice on 2024-06-20.
  2. `missing_unit` (Warning, Doc 2): Triglycerides unit missing.
  3. `implausible_bounds` (Warning, Doc 2): Platelet count `850 x10^3/uL` exceeds normal physiological ceiling (150–450).
  4. `unmapped_test` (Error, Doc 5): OCR raster decoding failure on corrupted scan.

---

## 6. Analytical Limitations

While the VitalTrace analytical layer provides precise data governance and ingestion telemetry, consumers of this data must account for foundational clinical and statistical limitations:

1. **Statistical Outlier vs. Medical Significance:**
   Reference intervals reflect empirical 95% confidence intervals derived from healthy reference populations. A value falling outside reference bounds (e.g., Fasting Glucose at 106 mg/dL) denotes statistical non-conformity, not a definitive medical diagnosis. Clinical determination requires professional interpretation of symptoms, patient history, and diagnostic protocols.
2. **Absence of Contextual and Pre-Analytical Covariates:**
   The extraction pipeline records discrete numeric outputs but cannot independently verify pre-analytical variables, including:
   - Patient fasting compliance prior to blood draw
   - Time of venipuncture relative to medication intake (e.g., peak vs. trough levels)
   - Acute physiological stressors, dehydration, or transient infections
3. **Ascertainment and Retention Bias:**
   In healthcare data platforms, testing frequency is correlated with morbidity. Patients undergoing frequent laboratory panels often have active chronic conditions, while healthy individuals test infrequently. Aggregated cross-profile averages reflect high-utilizer health states rather than general population norms.
4. **Inter-Laboratory Instrument and Assay Discordance:**
   Reference intervals and testing methods differ across hospital laboratories and commercial diagnostic vendors (e.g., Quest Diagnostics vs. LabCorp). For instance, immunoassay methodologies for TSH or enzymatic assays for Creatinine can yield slight baseline shifts. Comparing raw numeric readings across different laboratory chains introduces systematic measurement error unless assay-level normalization is performed.
5. **LLM Hallucination vs. Source Document Errors:**
   A high validation pass rate confirms that extracted text adheres to structural schemas and plausibility bounds. It does not prove ground-truth equivalence to the physical paper document. Human verification remains essential to catch subtle OCR misreadings (e.g., misplacing a decimal point from 1.05 to 10.5).

---

## 7. Important Distinctions in Data Quality vs. Health State

Conflating engineering pipeline performance with biological health status is a common pitfall in healthcare data engineering. VitalTrace strictly delineates three orthogonal concepts:

```
+-----------------------------------------------------------------------------------------+
|                                1. Extraction Success Rate                               |
|        Definition: Infrastructure reliability of the document processing engine         |
|        Question: "Did the OCR / LLM parse the PDF file without crashing?"               |
|        Status: Technical Pipeline (completed vs failed)                                 |
+-----------------------------------------------------------------------------------------+
                                            |
                                            v
+-----------------------------------------------------------------------------------------+
|                                 2. Validation Pass Rate                                 |
|        Definition: Structural, syntactic, and plausibility integrity of extracted data  |
|        Question: "Does the output have valid units, numeric values, and believable bounds?"|
|        Status: Data Governance (valid vs warning vs error)                              |
+-----------------------------------------------------------------------------------------+
                                            |
                                            v
+-----------------------------------------------------------------------------------------+
|                               3. Clinical Abnormality Rate                              |
|        Definition: Patient physiological status relative to reference boundaries        |
|        Question: "Is the patient's biological biomarker outside the normal range?"      |
|        Status: Clinical Domain (below normal vs normal vs above normal)                 |
+-----------------------------------------------------------------------------------------+
```

### 7.1 Cross-Metric Comparison Matrix

| Evaluation Dimension | Extraction Success Rate | Validation Pass Rate | Clinical Abnormality Rate |
| :--- | :--- | :--- | :--- |
| **System Layer** | Infrastructure & Execution Engine | Data Governance & Pipeline Rules | Human Biological Physiology |
| **Primary Actors** | DevOps, Data Engineers | Quality Auditors, Data Stewards | Clinicians, Patients, Care Teams |
| **Target Entities** | `extraction_runs`, `documents` | `validation_issues`, `observations` | `observations` (`value_numeric`) |
| **Success Condition** | Job completed with exit status 0 | Zero warnings or schema violations | Value is within normal reference bounds |
| **Seed Dataset Example** | `Doc 2`: 100% extraction success (run completed in 3.1s) | `Doc 2`: 50% validation pass rate (3 warnings flagged) | `Doc 2`: 33% abnormal (Platelets 850 high, Total Chol 202 high) |

Conflating these metrics causes operational confusion. A dashboard indicating a "100% Success Rate" could lead an operator to assume clean data, when in reality 30% of extracted rows might carry data quality warnings or critical clinical abnormalities.

---

## 8. Power BI Measure Reconciliation: SQL vs. DAX

For Power BI developers building semantic models over the VitalTrace analytical views in Import Mode, the following reconciliation table provides direct translations between PostgreSQL analytical queries and DAX measure implementations.

### 8.1 Top 5 Core Measures Comparison

| Measure Name | Business Concept | PostgreSQL Implementation | Power BI DAX Expression | Reconciliation & Context Considerations |
| :--- | :--- | :--- | :--- | :--- |
| **1. Extraction Success Rate** | Percentage of finalized extraction jobs that completed successfully | `ROUND((COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'failed')), 0)) * 100, 1)` | `Extraction Success Rate = `<br>`VAR CompletedRuns = CALCULATE(COUNTROWS('extraction_runs'), 'extraction_runs'[status] = "completed")`<br>`VAR TerminalRuns = CALCULATE(COUNTROWS('extraction_runs'), 'extraction_runs'[status] IN {"completed", "failed"})`<br>`RETURN DIVIDE(CompletedRuns, TerminalRuns, 0) * 100` | In DAX, `DIVIDE()` inherently guards against division by zero. Use `KEEPFILTERS()` if filtering by model type to preserve filter context across visual slices. |
| **2. Verification Confirmation Rate** | Proportion of extracted observations confirmed through human audit | `ROUND((COUNT(*) FILTER (WHERE verified_by_user = 'confirmed')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 1)` | `Confirmation Rate = `<br>`VAR ConfirmedObs = CALCULATE(COUNTROWS('observations'), 'observations'[verified_by_user] = "confirmed")`<br>`VAR TotalObs = COUNTROWS('observations')`<br>`RETURN DIVIDE(ConfirmedObs, TotalObs, 0) * 100` | Evaluated against the `observations` fact table. Respects active relationships to `profiles` and `documents` dimensions. |
| **3. LOINC Coverage Rate** | Proportion of observations successfully mapped to a standardized LOINC code | `ROUND((COUNT(*) FILTER (WHERE loinc_code IS NOT NULL AND TRIM(loinc_code) != '')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 1)` | `LOINC Coverage Pct = `<br>`VAR MappedObs = CALCULATE(COUNTROWS('observations'), NOT(ISBLANK('observations'[loinc_code])), 'observations'[loinc_code] <> "")`<br>`VAR TotalObs = COUNTROWS('observations')`<br>`RETURN DIVIDE(MappedObs, TotalObs, 0) * 100` | In Power BI, empty strings imported from PostgreSQL must be checked with both `ISBLANK()` and `<> ""` to handle blank coalescing. |
| **4. Critical Review Backlog (> 7 Days)** | Volume of unreviewed observations exceeding the 7-day operational SLA | `COUNT(*) FILTER (WHERE verified_by_user = 'pending' AND (EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) > 168)` | `Critical Review Debt (>7d) = `<br>`CALCULATE(`<br>`    COUNTROWS('observations'),`<br>`    'observations'[verified_by_user] = "pending",`<br>`    DATEDIFF('observations'[created_at], NOW(), DAY) > 7`<br>`)` | `NOW()` in DAX evaluates to the Power BI service data refresh timestamp in Import mode. To dynamically measure against client system time, consider DirectQuery or a dedicated Date dimension. |
| **5. Longitudinal Delta from Previous Verified Reading** | Difference between current verified test value and preceding verified result | `value_numeric - LAG(value_numeric) OVER (PARTITION BY profile_id ORDER BY observation_date ASC, id ASC)` | `Glucose Delta From Prev = `<br>`VAR CurrentDate = MAX('observations'[observation_date])`<br>`VAR CurrentProfile = MAX('observations'[profile_id])`<br>`VAR PrevDate = CALCULATE(`<br>`    MAX('observations'[observation_date]),`<br>`    FILTER(`<br>`        ALL('observations'),`<br>`        'observations'[profile_id] = CurrentProfile &&`<br>`        'observations'[canonical_test_name] = "Fasting Glucose" &&`<br>`        'observations'[verified_by_user] = "confirmed" &&`<br>`        'observations'[observation_date] < CurrentDate`<br>`    )`<br>`)`<br>`VAR PrevValue = CALCULATE(`<br>`    MAX('observations'[value_numeric]),`<br>`    FILTER(`<br>`        ALL('observations'),`<br>`        'observations'[profile_id] = CurrentProfile &&`<br>`        'observations'[canonical_test_name] = "Fasting Glucose" &&`<br>`        'observations'[verified_by_user] = "confirmed" &&`<br>`        'observations'[observation_date] = PrevDate`<br>`    )`<br>`)`<br>`RETURN IF(ISBLANK(PrevValue), BLANK(), MAX('observations'[value_numeric]) - PrevValue)` | PostgreSQL `LAG()` computes window state linearly over partitions during query execution. In DAX, calculating window shifts requires explicit filter removal with `ALL()` and recalculation of preceding scalar dates and values. |

---

## 9. Deployment & Execution Instructions

### 9.1 Applying Reporting Views
To deploy the curated reporting views to your PostgreSQL / Supabase database instance:

```bash
# Execute reporting views migration via psql
psql -h <host> -U <user> -d <database> -f sql/analytics/reporting_views.sql
```

### 9.2 Running Analytical Auditing Queries
The queries in `sql/analytics/analytical_queries.sql` are written as standalone `SELECT` statements. They can be executed in pgAdmin, DBeaver, VS Code SQLTools, or the Supabase SQL Editor to audit pipeline health and verify data quality.
