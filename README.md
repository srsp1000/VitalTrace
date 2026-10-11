# VitalTrace — Personal Health Record Intelligence & Data Quality Analytics

> **Institutional-Grade Clinical Data Extraction, Deterministic Validation, Relational Modeling, and Data-Quality Governance**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.x-cyan.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-45%20Passed-green.svg)](https://vitest.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%7C%20RLS-emerald.svg)](https://supabase.com/)

---

## 1. Executive Summary & Core Platform Capabilities

**VitalTrace** is a full-stack healthcare data intelligence application designed to ingest unstructured laboratory reports (PDFs, multi-page scans, images), normalize them into structured clinical observations via an LLM extraction pipeline, execute deterministic data-quality validations, and present health trends through longitudinal trajectories.

Built to showcase core competencies for a **Healthcare Full-Stack Engineer / Clinical Data Platform Engineer**, VitalTrace delivers:

1. **Deterministic Data Quality & Pipeline Telemetry Control Plane**:
   - 8 mathematical Executive KPI cards with zero-denominator safety (`null` on empty data sets rather than invented 0% or 100%).
   - Ingestion Pipeline Funnel tracking records from document ingestion through encrypted storage, extraction, parsing, validation, and clinician sign-off.
   - Recharts trend analytics for validation pass rates, issue distribution by taxonomy, and execution latency percentiles (p50 median, p95).
   - Searchable, sortable, paginated Extraction Runs Ledger with modal execution inspection and idempotent retries.
   - Validation Issues Ledger with direct drill-down links to the Human-in-the-Loop review workbench.
2. **Robust Multi-Modal Clinical Ingestion**:
   - Structured schema extraction leveraging Gemini via secure server-side Supabase Edge Functions with strict Zod parsing.
   - Zero hallucination tolerance: unmapped tests retain their raw names with null LOINC codes rather than fabricating false codes.
3. **Deterministic Clinical Validator Engine**:
   - Biological plausibility bounds (`PLAUSIBILITY_BOUNDS`) flagging physiologically extreme values.
   - Comprehensive LOINC mapping (`1558-6`, `4548-4`, `2160-0`, etc.) and alias normalization dictionary.
   - Duplicate collision detection (same analyte + date in an extraction run).
   - Unit standardization (`mg/dL`, `x10^3/uL`, `mmol/L`, etc.) and missing unit audit.
4. **Relational Database Design & Multi-Tenant Isolation**:
   - Normalized 3NF PostgreSQL schema with foreign keys, cascading constraints, and automated `updated_at` triggers.
   - PostgreSQL 15+ caller-based RLS on all analytical views using `WITH (security_invoker = true)`.
   - CTE pre-aggregations eliminating Cartesian product join fan-out in execution telemetry.
   - Complete Row-Level Security (RLS) policies including `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on all tables.
   - User-scoped private storage paths (`<profileId>/<documentId>.<ext>`) with short-lived cryptographic signed URLs.
5. **Human-in-the-Loop Governance & Auditability**:
   - Newly extracted observations start in a `pending` state—no AI output silently becomes a confirmed health record.
   - Every observation maintains full provenance to its source document filename, extraction run ID, and modification timestamp.
   - Cross-account cache purge on authentication changes preventing state leakage.

---

## 2. Ingestion Pipeline & Architecture Flow

```
+-----------------------------------------------------------------------------------+
|                                  USER INTERFACE                                   |
|   Upload Report  -->  Human Review Workbench  -->  Longitudinal Trends & Timeline |
|                                       ^                                           |
|                                       | Live Reactive Synchronization             |
+---------------------------------------+-------------------------------------------+
                                        |
+-----------------------------------------------------------------------------------+
|                            INGESTION PIPELINE LIFECYCLE                           |
|                                                                                   |
|  1. Document Upload  -->  Encrypted Storage Bucket ('medical-documents')          |
|  2. Server-side Supabase Edge Function ('extract-report') via Gemini 1.5/2.5      |
|  3. Strict Zod Schema Parsing (ExtractedReportSchema in schema.ts)                 |
|  4. Deterministic Validator Engine (validationRules.ts)                           |
|       * Physiological Plausibility Limits Check                                   |
|       * LOINC Code & Synonym Standardization (aliasDictionary.ts)                 |
|       * Unit Standardization & Missing Value Audit                                |
|       * Specimen Date Collision & Deduplication Verification                      |
|  5. Extraction Run Stored ('review_required' or 'completed')                       |
|  6. Human Review / Correction Gate (zero unverified AI records)                   |
|  7. Idempotent Retry Engine (cleans unconfirmed drafts before retry)              |
+-----------------------------------------------------------------------------------+
                                        |
+-----------------------------------------------------------------------------------+
|                             POSTGRESQL & ANALYTICS                                |
|                                                                                   |
|   Tables: profiles, documents, extraction_runs, observations, validation_issues   |
|   Security: RLS on auth.uid() = profile_id, security_invoker views, private vaults|
|   Analytics: 10 Analytical SQL Views & Pl/pgSQL Trajectory Functions              |
+-----------------------------------------------------------------------------------+
```

---

## 3. Mathematical Metric Definitions & KPI Formulas

All metrics displayed on the Data Quality dashboard are computed deterministically via `src/services/kpiMetrics.ts` and mirrored in PostgreSQL analytical views:

| Metric | Mathematical Formula | Handling of Zero / Empty Sets |
| :--- | :--- | :--- |
| **Document Success Rate** | `(Completed Docs / Terminal Docs) × 100`<br>*where Terminal = Completed + Failed* | Returns `null` ("N/A") if terminal docs = 0 |
| **Extraction Run Success Rate** | `(Completed Runs / Terminal Runs) × 100`<br>*where Terminal = Completed + Failed* | Returns `null` ("N/A") if terminal runs = 0 |
| **Validation Pass Rate** | `(Valid Observations / Total Evaluated) × 100` | Returns `null` ("N/A") if observations = 0 |
| **Human Verification Rate** | `(Confirmed Observations / Total Observations) × 100` | Returns `null` ("N/A") if observations = 0 |
| **Field Completeness Rate** | `((Total Obs - Missing Field Obs) / Total Obs) × 100` | Returns `null` ("N/A") if observations = 0 |
| **Missing Field Rate** | `(Missing Unit or Value Obs / Total Obs) × 100` | Returns `null` ("N/A") if observations = 0 |
| **Duplicate Collision Count** | Exact count of identical analyte + specimen date pairs | Returns `0` ("Zero collisions") |
| **p50 Latency (Median)** | 50th-percentile runtime across completed extraction runs | Returns `null` ("N/A") if 0 completed runs |
| **p95 Latency** | 95th-percentile runtime across completed extraction runs | Returns `null` ("N/A") if 0 completed runs |

### Synthetic Benchmark Verification
On the initial synthetic demo dataset (`Alex Morgan`):
- **19** Total Observations
- **16** Valid Observations (**84.2%** Validation Pass Rate)
- **15** Confirmed Observations (**78.9%** Human Verification Rate)
- **4** Terminal Documents (**75.0%** Document Success Rate; 3 completed, 1 failed, 1 review required)
- **5** Extraction Runs (**80.0%** Extraction Run Success Rate; 4 completed, 1 failed)
- **1** Duplicate Collision Flagged
- **4** Active Validation Issues (1 Critical error, 3 Warnings)

---

## 4. Relational Schema & Production SQL Views

All database migrations are located in `supabase/migrations/`:

### Core Relational Schema (`001_initial_schema.sql` & `002_row_level_security.sql`)
- `profiles`: 1:1 patient profile linked to `auth.users(id)`.
- `documents`: Uploaded lab reports with file metadata, private storage paths, and processing status (`uploaded`, `processing`, `review_required`, `completed`, `failed`).
- `extraction_runs`: Immutable server execution telemetry recording duration, model name, status, extracted count, and error messages.
- `observations`: 3NF normalized clinical lab measurements with raw test name, canonical test name, LOINC code, numeric/text values, normalized units, reference intervals, and verification status (`pending`, `confirmed`, `rejected`).
- `validation_issues`: Audit trail of deterministic rule discrepancies linked to parent documents and observations.

### Production SQL Views & Functions (`004_analytical_views.sql`)
All views enforce PostgreSQL 15+ caller-based RLS via `WITH (security_invoker = true)`:

1. `view_overview_kpis`: High-level aggregated counts and human confirmation ratios.
2. `view_document_status_breakdown`: Document processing status distributions scoped to user profiles.
3. `view_analyte_frequencies`: Frequency of canonical clinical tests extracted per patient.
4. `view_validation_issues_summary`: Discrepancy counts, active vs. resolved breakdowns, and resolution velocity.
5. `view_missing_field_analysis`: Field-level completeness auditing (blank units, null values, missing reference intervals).
6. `view_duplicate_observations`: Detection of analyte and date collisions within reports.
7. `view_verification_funnel`: Human-in-the-loop sign-off ratios (confirmed vs. pending vs. rejected).
8. `view_run_quality_telemetry`: Server run performance telemetry utilizing CTE pre-aggregations (`obs_summary`, `issue_summary`) to eliminate Cartesian product join fan-out.
9. `get_longitudinal_trajectory(profile_id, test_name)`: Pl/pgSQL window function computing chronological readings and delta shifts (`LAG()`) from previous readings.
10. `view_document_processing_latency`: Document file size vs extraction duration and throughput metrics.

---

## 5. Technology Stack

- **Frontend Core**: React 19, TypeScript ~6.0, Vite 8, Tailwind CSS 3.4
- **State & Ingestion**: Zod v3 (strict clinical parsing schemas), React Context Architecture
- **Data Visualization**: Recharts 3.10 (Bar charts, Line charts, Reference thresholds), Lucide React
- **Backend & Relational DB**: Supabase (PostgreSQL 15+, Row-Level Security, Edge Functions, Private Storage)
- **Automated Test Suite**: Vitest 5.0 (45 automated tests across 4 suites)
- **Linter & Static Analysis**: Oxlint (0 errors, strict React and TypeScript verification)

---

## 6. Local Setup & Quick Start

### Prerequisites
- Node.js 18.x or 20.x
- npm 9.x or higher

### Installation

```bash
# 1. Clone repository
git clone https://github.com/your-username/vitaltrace.git
cd vitaltrace

# 2. Install dependencies
npm install

# 3. Setup environment variables (optional for local demo mode)
cp .env.example .env

# 4. Start local development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

> **Offline Demo Mode**: VitalTrace includes a pre-loaded synthetic clinical dataset. You can explore all 8 screens, inspect 5 laboratory reports, audit 19 observations, and test the full extraction, review, and retry workflow without connecting live Supabase credentials.

---

## 7. Automated Test Suite

VitalTrace features a 45-test automated test suite:

```bash
# Run full Vitest test suite
npm test

# Run Vitest in watch mode
npx vitest

# Run linter
npm run lint

# Build production bundle
npm run build
```

### Test Suite Structure:
- `src/services/__tests__/validation.test.ts` (22 tests): Strict Zod schema validation, ISO 8601 date auditing, alias dictionary canonicalization, unit normalization, plausible bounds checks, duplicate detection.
- `src/services/__tests__/kpiMetrics.test.ts` (11 tests): Zero-denominator null safety, p50/p95 percentile interpolation, time range filtering (24h/7d/30d/90d), exact synthetic benchmark verification.
- `src/services/__tests__/pipelineAndLifecycle.test.ts` (7 tests): RFC-4122 UUID v4 generation and validation, document status lifecycle transitions (`completed` vs `review_required`), alias synonym resolution.
- `src/services/__tests__/securityAndIsolation.test.ts` (5 tests): User-scoped storage path isolation, private signed URL TTL safeguards, PostgreSQL RLS policies (`DELETE` audit support), `WITH (security_invoker = true)` view auditing, CTE Cartesian product avoidance.

---

## 8. Supabase Production Deployment

To connect VitalTrace to a live Supabase project:

1. **Create Supabase Project**: Initialize a project at [supabase.com](https://supabase.com).
2. **Execute Database Migrations**: Run the SQL files in the Supabase SQL Editor in numerical order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_row_level_security.sql`
   - `supabase/migrations/003_storage_policies.sql`
   - `supabase/migrations/004_analytical_views.sql`
   - `supabase/seed.sql` *(optional initial seed)*
3. **Deploy Extraction Edge Function**:
   ```bash
   supabase secrets set GEMINI_API_KEY="your-gemini-api-key"
   supabase functions deploy extract-report
   ```
4. **Update Frontend Environment Variables**:
   Update `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

---

## 9. Clinical & Regulatory Safety Notice

> **IMPORTANT CLINICAL DISCLAIMER**: VitalTrace is an analytical data management, data-quality monitoring, and personal health record inspection tool. It does **not** provide medical diagnoses, treatment plans, clinical interpretations, or prescriptive guidance. All physiological bounds and deterministic validation rules serve solely as technical data-quality checks to assist users in auditing digitized laboratory records. Always consult licensed healthcare providers for clinical diagnosis and medical decision-making.
