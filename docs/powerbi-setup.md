# VitalTrace Power BI Setup, Architecture & Operational Runbook

> **Platform:** VitalTrace Clinical Analytics & Health Data Platform  
> **Target Audience:** Innovaccer Data Analyst Intern, BI Engineers, DevOps, Clinical Informaticists  
> **Document Status:** Production Approved  
> **Last Updated:** October 2026  

---

## 1. Prerequisites & Environment Setup

To deploy, edit, or refresh the **VitalTrace Power BI Analytics** suite, the host workstation and service environment must fulfill the following prerequisites:

### 1.1 Client Workstation Requirements
1. **Power BI Desktop:**
   - 64-bit edition (Version: May 2024 / 2.129 or higher).
   - Available via Microsoft Store or standalone MSI from the Microsoft Download Center.
2. **Npgsql .NET Data Provider for PostgreSQL:**
   - **Version:** Npgsql 4.0.10 or 4.1.8 (64-bit MSI installer).
   - *Crucial Installation Step:* During MSI setup, you **must enable the "Npgsql GAC Installation" feature** (Global Assembly Cache). Power BI Desktop cannot locate the provider without GAC registration.
   - Alternatively, install the 64-bit PostgreSQL ODBC Driver (psqlODBC 13.x+).
3. **Network & Firewall Access:**
   - Outbound TCP egress on **Port 5432** (direct PostgreSQL session) and **Port 6543** (PgBouncer transaction pooler).
   - Host whitelist: `*.pooler.supabase.com` and `*.supabase.co`.
   - TLS 1.3 / TLS 1.2 cryptographic handshake support.

---

## 2. Dual Data Source Strategy: PostgreSQL Live vs. CSV Offline

VitalTrace supports a dual-mode ingestion pattern controlled by the Power Query parameter `DataSourceMode`:

```mermaid
flowchart TD
    P[DataSourceMode Parameter] -->|PostgreSQL| PG[Supabase PostgreSQL Live Views]
    P -->|CSV| CSV[powerbi/data/ Synthetic Fixtures]
    
    subgraph Live Mode
        PG --> V1[public.view_run_quality_telemetry]
        PG --> V2[public.view_extraction_run_health]
        PG --> T1[public.documents]
        PG --> T2[public.observations]
        PG --> T3[public.validation_issues]
    end

    subgraph Offline / Demo Mode
        CSV --> D1[dim_documents.csv]
        CSV --> D2[fact_extraction_runs.csv]
        CSV --> D3[fact_observations.csv]
        CSV --> D4[fact_validation_issues.csv]
        CSV --> D5[dim_analytes.csv]
        CSV --> D6[dim_calendar.csv]
    end

    Live Mode --> VM[Power BI VertiPaq Semantic Engine]
    Offline Mode --> VM
```

### 2.1 Mode Comparison

| Characteristic | Mode A: Live PostgreSQL (`PostgreSQL`) | Mode B: Offline Safe Fixtures (`CSV`) |
|---|---|---|
| **Data Recency** | Near real-time / hourly scheduled refresh | Static frozen test fixture |
| **Network Dependency** | Active internet + Supabase cloud access | Zero network dependency (Air-gapped) |
| **Security Classification** | Real/Staging EHR tenant records | 100% de-identified synthetic test patients |
| **Performance** | Network latency + database query time | Instant sub-second loading |
| **Driver Required** | Npgsql 4.x GAC | Built-in standard CSV reader |
| **Target Use Case** | Production operational reporting | Development, CI/CD testing, Intern demo |

---

## 3. PostgreSQL Live Connection Configuration

When connecting Power BI Desktop or the Power BI Service to Supabase:

### 3.1 Connection String Parameters
- **Server:** `aws-0-ap-southeast-2.pooler.supabase.com:5432` (Use port `5432` for Session Mode; use `6543` for Transaction Mode).
  > [!IMPORTANT]
  > **Power BI Requires Session Mode (Port 5432)**: Power BI Desktop issues session-level statements (`SET client_encoding`, `SET extra_float_digits`, prepared queries). PgBouncer in transaction mode (`6543`) rejects these and throws `Internal connection fatal error. Error state: 18`. Always use port `5432` with the pooler.
- **Database:** `postgres`
- **Data Connectivity Mode:** **Import** (See Section 5 for DirectQuery evaluation).
- **Advanced Options ➔ SQL Statement:** Leave blank to preserve query folding, or specify curated view references.

### 3.2 Credentials & Authentication
- **Authentication Type:** Select **Database** (Username / Password).
- **Username:** `postgres.mmvdgusfpfdgkzrxueox` (Must include the `.mmvdgusfpfdgkzrxueox` project ref suffix).
- **Password:** Production read-replica database password.
- **Encrypt Connection:** Check **Enable Encrypted Connection (SSL)**.

---

## 4. Data Source Security & Access Control

> [!CAUTION]
> **Zero Service-Role Key Exposure Policy:**  
> Power BI Desktop files, dataset definitions, and M scripts must **never contain the Supabase `service_role` secret JWT** or master administrative database passwords.

### 4.1 Principle of Least Privilege
1. **Dedicated Read-Only Reporting User:**
   Create a dedicated PostgreSQL role with read-only permissions scoped specifically to curated analytical views:
   ```sql
   -- Create dedicated analytics user
   CREATE ROLE powerbi_reader WITH LOGIN PASSWORD 'ComplexSecurePassword#2026';
   GRANT CONNECT ON DATABASE postgres TO powerbi_reader;
   GRANT USAGE ON SCHEMA public TO powerbi_reader;

   -- Grant SELECT only on curated analytical views and dimensions
   GRANT SELECT ON public.view_run_quality_telemetry TO powerbi_reader;
   GRANT SELECT ON public.view_extraction_run_health TO powerbi_reader;
   GRANT SELECT ON public.view_documents_processed_daily TO powerbi_reader;
   GRANT SELECT ON public.documents TO powerbi_reader;
   GRANT SELECT ON public.extraction_runs TO powerbi_reader;
   GRANT SELECT ON public.observations TO powerbi_reader;
   GRANT SELECT ON public.validation_issues TO powerbi_reader;
   ```

2. **Row-Level Security (RLS) & Multi-Tenancy:**
   - In Migration 004, all analytical views are defined with `WITH (security_invoker = true)`.
   - If reporting is published to external clinic tenants, apply Power BI **Row-Level Security (RLS)** roles within Power BI Desktop:
     ```dax
     // RLS Role: ClinicTenantFilter on dim_documents
     [profile_id] = USERNAME()
     ```

---

## 5. Storage Mode Decision Matrix: Import Mode vs. DirectQuery

For VitalTrace, **Import Mode is strongly recommended** over DirectQuery. The technical reasons are detailed below:

| Feature / Consideration | Import Mode (Selected) | DirectQuery Mode | Decision Factor |
|---|---|---|---|
| **P50 / P95 Percentile Latency** | Supported (`PERCENTILE.INC`) | **UNSUPPORTED** by relational translation | **Critical:** Pipeline SLA metrics require `PERCENTILE.INC`. |
| **Query Performance** | Sub-second (in-memory VertiPaq) | Depends on database load & network latency | VertiPaq delivers 10x-50x faster dashboard interactions. |
| **Database Load** | 1 query batch per scheduled refresh | 1 SQL query per visual per user click | DirectQuery floods Supabase connection poolers. |
| **DAX Function Support** | 100% full DAX standard library | Restricted DAX subset | Time intelligence and complex string operations work natively. |
| **Data Freshness** | Refreshed every 1 to 4 hours | Live on visual load | Healthcare batch extractions do not require sub-minute telemetry. |

---

## 6. Power BI Service Publishing & Refresh Automation

### 6.1 Publishing Workflow
1. In Power BI Desktop, navigate to **File ➔ Publish ➔ Publish to Power BI**.
2. Select target workspace: `VitalTrace Production Analytics`.
3. Verify report rendering across desktop and mobile layout views.

### 6.2 Gateway & Cloud Credentials Configuration
Since Supabase is a cloud-hosted PostgreSQL endpoint accessible over SSL:
1. In Power BI Service, navigate to **Settings ➔ Manage connections and gateways**.
2. Under **Cloud Connections**, create a new connection for `aws-0-us-east-1.pooler.supabase.com:6543`.
3. Set **Authentication method** to `Basic`, input username `postgres.[PROJECT-REF]` and password.
4. Set **Privacy Level** to `Organizational`.
5. *Note:* Because Supabase is a publicly reachable cloud database with a verified SSL certificate, an **On-premises Data Gateway is NOT required**. The native Power BI Cloud Refresh engine connects directly.

### 6.3 Scheduled Refresh Frequency
- **Power BI Pro:** Configured for **8 daily refreshes** (e.g. 06:00, 09:00, 12:00, 14:00, 17:00, 20:00, 22:00, 00:00 UTC).
- **Power BI Premium / Fabric Capacity:** Up to **48 scheduled refreshes per day** (every 30 minutes) if intraday SLA monitoring is demanded.

---

## 7. Licensing Requirements

| Deployment Tier | License Required | Capabilities Supported |
|---|---|---|
| **Local Development & Review** | **Power BI Desktop (Free)** | Local report design, CSV ingestion, DAX authoring, testing. |
| **Internal Team Sharing** | **Power BI Pro** ($10/user/month) | Publishing to workspaces, sharing dashboards, 8x daily refresh, standard RLS. |
| **Enterprise Multi-Tenant** | **Power BI Premium Per User (PPU)** or **Fabric F64+ Capacity** | Unlimited refresh (48x/day), deployment pipelines, XMLA endpoint management, large models (>1 GB). |

---

## 8. Known Limitations & Mitigations

1. **No Live PBIX Binary in Git:**
   - *Limitation:* Git cannot diff binary `.pbix` blobs; checking in binaries leads to repository bloat and merge conflicts.
   - *Mitigation:* The entire model is version-controlled via code: `DAX_Measures.dax`, `PowerQuery_M.pq`, `vitaltrace_theme.json`, and CSV schemas. Any analyst can reproduce the exact `.pbix` in under 5 minutes using the instructions in `powerbi/VitalTrace_Analytics_README.md`.
2. **PERCENTILE.INC DirectQuery Limitation:**
   - *Limitation:* DAX functions `PERCENTILE.INC` and `PERCENTILE.EXC` fail in DirectQuery mode.
   - *Mitigation:* Model is configured in Import mode. If DirectQuery is mandatory in future phases, P50/P95 latencies must be pre-calculated inside PostgreSQL SQL views using `PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms)` and imported as a scalar column.
3. **Admin-Only Database Port Access:**
   - *Limitation:* Production hospital VPC firewalls often block outbound port 5432/6543.
   - *Mitigation:* Provide the offline CSV fixtures in `powerbi/data/` for local presentations and offline analysis.

---

## 9. Measure Reconciliation Guide: DAX vs. SQL

Before presenting deliverables to stakeholders, validate that all DAX scorecard metrics match PostgreSQL database truth using this reconciliation protocol:

### 9.1 Verification SQL Suite

```sql
-- ====================================================================
-- VitalTrace Metric Verification SQL Suite
-- Execute in Supabase SQL Editor to verify against Power BI Scorecards
-- ====================================================================

-- 1. Total Documents & Processing Status Breakdown
SELECT 
  COUNT(DISTINCT id) AS total_documents,
  COUNT(*) FILTER (WHERE processing_status = 'completed') AS completed_docs,
  COUNT(*) FILTER (WHERE processing_status = 'review_required') AS review_required_docs,
  COUNT(*) FILTER (WHERE processing_status = 'failed') AS failed_docs
FROM public.documents;

-- 2. Extraction Runs, Retry Rate & Success Rate
SELECT 
  COUNT(DISTINCT id) AS total_extraction_runs,
  COUNT(DISTINCT document_id) AS unique_documents_processed,
  ROUND(((COUNT(DISTINCT id) - COUNT(DISTINCT document_id))::NUMERIC / NULLIF(COUNT(DISTINCT document_id), 0)) * 100, 1) AS retry_rate_pct,
  COUNT(*) FILTER (WHERE status = 'completed') AS successful_runs,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_runs,
  ROUND((COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 1) AS run_success_rate_pct
FROM public.extraction_runs;

-- 3. Observations Volume & Verification Funnel
SELECT 
  COUNT(*) AS total_observations,
  COUNT(*) FILTER (WHERE verified_by_user = 'confirmed') AS confirmed_observations,
  COUNT(*) FILTER (WHERE verified_by_user = 'pending') AS pending_review,
  COUNT(*) FILTER (WHERE verified_by_user = 'rejected') AS rejected_observations,
  ROUND((COUNT(*) FILTER (WHERE verified_by_user = 'confirmed')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 1) AS confirmation_rate_pct,
  COUNT(*) FILTER (WHERE validation_status = 'valid') AS valid_observations,
  ROUND((COUNT(*) FILTER (WHERE validation_status = 'valid')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 1) AS validation_pass_rate_pct
FROM public.observations;

-- 4. Data Quality & Validation Issue Metrics
SELECT 
  COUNT(*) AS total_validation_issues,
  COUNT(*) FILTER (WHERE issue_type = 'missing_unit') AS missing_unit_issues,
  COUNT(*) FILTER (WHERE issue_type = 'duplicate_observation') AS duplicate_issues,
  COUNT(*) FILTER (WHERE issue_type = 'unmapped_test') AS unmapped_test_issues,
  COUNT(*) FILTER (WHERE resolved = FALSE) AS open_issues,
  COUNT(*) FILTER (WHERE resolved = TRUE) AS resolved_issues,
  ROUND((COUNT(*) FILTER (WHERE resolved = TRUE)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 1) AS issue_resolution_rate_pct
FROM public.validation_issues;

-- 5. Ingestion Engine Latency & Percentiles
SELECT 
  ROUND(AVG(duration_ms)::NUMERIC / 1000, 2) AS avg_duration_seconds,
  ROUND(MIN(duration_ms)::NUMERIC / 1000, 2) AS min_duration_seconds,
  ROUND(MAX(duration_ms)::NUMERIC / 1000, 2) AS max_duration_seconds,
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms)::NUMERIC / 1000, 2) AS p50_median_latency_seconds,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::NUMERIC / 1000, 2) AS p95_tail_latency_seconds
FROM public.extraction_runs
WHERE duration_ms IS NOT NULL;
```

### 9.2 Discrepancy Tolerance Limits
- **Cardinality Metrics (`Total Documents`, `Total Observations`):** Strict 0 variance (Exact match).
- **Percentages (`Success Rate`, `Confirmation Rate`):** Allowable variance of $\pm 0.1\%$ due to floating-point rounding between PostgreSQL `NUMERIC` and DAX `IEEE 754 Double`.
- **Percentiles (`P50 Latency`, `P95 Latency`):** Allowable variance of $\pm 0.05\text{s}$ due to `PERCENTILE.INC` (linear interpolation between discrete rank values) vs PostgreSQL `PERCENTILE_CONT`.
