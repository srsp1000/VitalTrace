-- ====================================================================
-- VitalTrace Phase 3: Curated Reporting Views for Power BI Import Mode
-- File: sql/analytics/reporting_views.sql
-- 
-- Description:
--   High-performance, curated reporting views engineered for direct ingestion
--   into Power BI (Import mode) and downstream BI semantic models.
--   These views sit on top of the foundation defined in 004_analytical_views.sql.
--
-- Security & Multi-Tenancy:
--   All views are declared with WITH (security_invoker = true) to strictly
--   respect PostgreSQL Row-Level Security (RLS) policies scoped to the caller.
--
-- Views Created:
--   1. public.view_executive_summary
--   2. public.view_review_backlog_aging
--   3. public.view_analyte_loinc_coverage
-- ====================================================================

-- --------------------------------------------------------------------
-- View 1: view_executive_summary
-- --------------------------------------------------------------------
-- Business Purpose:
--   Single row per profile_id aggregating high-level pipeline health KPIs,
--   ingestion lifecycle totals, verification funnel volumes, and open
--   validation issues. Serves as the primary source for executive KPI cards
--   and multi-tenant scorecards in Power BI.
--
-- Architecture Note:
--   Uses pre-aggregated Common Table Expressions (CTEs) on documents,
--   extraction runs, observations, and validation issues to completely avoid
--   Cartesian join fan-out across 1:N relational child tables.
-- --------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_executive_summary CASCADE;

CREATE OR REPLACE VIEW public.view_executive_summary
WITH (security_invoker = true) AS
WITH doc_metrics AS (
  SELECT
    d.profile_id,
    COUNT(*) AS total_documents,
    COUNT(*) FILTER (WHERE d.processing_status = 'completed') AS completed_documents,
    COUNT(*) FILTER (WHERE d.processing_status = 'review_required') AS review_required_documents,
    COUNT(*) FILTER (WHERE d.processing_status = 'failed') AS failed_documents,
    COUNT(*) FILTER (WHERE d.processing_status = 'uploaded') AS uploaded_documents,
    COUNT(*) FILTER (WHERE d.processing_status = 'processing') AS processing_documents,
    SUM(d.file_size_bytes) AS total_file_bytes
  FROM public.documents d
  GROUP BY d.profile_id
),
run_metrics AS (
  SELECT
    d.profile_id,
    COUNT(er.id) AS total_extraction_runs,
    COUNT(er.id) FILTER (WHERE er.status = 'completed') AS successful_runs,
    COUNT(er.id) FILTER (WHERE er.status = 'failed') AS failed_runs,
    COUNT(er.id) FILTER (WHERE er.status = 'running') AS running_runs,
    ROUND(
      COALESCE(
        (COUNT(er.id) FILTER (WHERE er.status = 'completed')::NUMERIC /
         NULLIF(COUNT(er.id) FILTER (WHERE er.status IN ('completed', 'failed')), 0)) * 100,
        0
      ),
      1
    ) AS run_success_rate_percentage,
    ROUND(AVG(er.duration_ms) FILTER (WHERE er.status = 'completed'), 0) AS avg_run_duration_ms
  FROM public.documents d
  JOIN public.extraction_runs er ON er.document_id = d.id
  GROUP BY d.profile_id
),
obs_metrics AS (
  SELECT
    o.profile_id,
    COUNT(*) AS total_observations,
    COUNT(*) FILTER (WHERE o.verified_by_user = 'confirmed') AS confirmed_observations,
    COUNT(*) FILTER (WHERE o.verified_by_user = 'pending') AS pending_observations,
    COUNT(*) FILTER (WHERE o.verified_by_user = 'rejected') AS rejected_observations,
    COUNT(*) FILTER (WHERE o.user_corrected = TRUE) AS user_corrected_observations,
    COUNT(*) FILTER (WHERE o.validation_status = 'valid') AS valid_observations,
    COUNT(*) FILTER (WHERE o.validation_status = 'warning') AS warning_observations,
    COUNT(*) FILTER (WHERE o.validation_status = 'error') AS error_observations,
    ROUND(
      COALESCE(
        (COUNT(*) FILTER (WHERE o.verified_by_user = 'confirmed')::NUMERIC /
         NULLIF(COUNT(*), 0)) * 100,
        0
      ),
      1
    ) AS confirmation_rate_percentage
  FROM public.observations o
  GROUP BY o.profile_id
),
issue_metrics AS (
  SELECT
    d.profile_id,
    COUNT(vi.id) AS total_issues,
    COUNT(vi.id) FILTER (WHERE vi.resolved = FALSE) AS open_issues_count,
    COUNT(vi.id) FILTER (WHERE vi.resolved = TRUE) AS resolved_issues_count,
    COUNT(vi.id) FILTER (WHERE vi.resolved = FALSE AND vi.severity = 'error') AS open_critical_issues_count,
    COUNT(vi.id) FILTER (WHERE vi.resolved = FALSE AND vi.severity = 'warning') AS open_warning_issues_count
  FROM public.documents d
  JOIN public.validation_issues vi ON vi.document_id = d.id
  GROUP BY d.profile_id
)
SELECT
  p.id AS profile_id,
  p.display_name,
  p.role,
  p.created_at AS profile_created_at,

  -- Document Volume & Status Breakdown
  COALESCE(dm.total_documents, 0) AS total_documents,
  COALESCE(dm.completed_documents, 0) AS completed_documents,
  COALESCE(dm.review_required_documents, 0) AS review_required_documents,
  COALESCE(dm.failed_documents, 0) AS failed_documents,
  COALESCE(dm.uploaded_documents, 0) AS uploaded_documents,
  COALESCE(dm.processing_documents, 0) AS processing_documents,
  COALESCE(dm.total_file_bytes, 0) AS total_file_bytes,

  -- Extraction Engine Performance & Health
  COALESCE(rm.total_extraction_runs, 0) AS total_extraction_runs,
  COALESCE(rm.successful_runs, 0) AS successful_runs,
  COALESCE(rm.failed_runs, 0) AS failed_runs,
  COALESCE(rm.running_runs, 0) AS running_runs,
  COALESCE(rm.run_success_rate_percentage, 0.0) AS run_success_rate_percentage,
  COALESCE(rm.avg_run_duration_ms, 0) AS avg_run_duration_ms,

  -- Observation Extraction & Verification Funnel
  COALESCE(om.total_observations, 0) AS total_observations,
  COALESCE(om.confirmed_observations, 0) AS confirmed_observations,
  COALESCE(om.pending_observations, 0) AS pending_observations,
  COALESCE(om.rejected_observations, 0) AS rejected_observations,
  COALESCE(om.user_corrected_observations, 0) AS user_corrected_observations,
  COALESCE(om.valid_observations, 0) AS valid_observations,
  COALESCE(om.warning_observations, 0) AS warning_observations,
  COALESCE(om.error_observations, 0) AS error_observations,
  COALESCE(om.confirmation_rate_percentage, 0.0) AS confirmation_rate_percentage,

  -- Quality & Validation Issue Backlog
  COALESCE(im.total_issues, 0) AS total_issues_count,
  COALESCE(im.open_issues_count, 0) AS open_issues_count,
  COALESCE(im.resolved_issues_count, 0) AS resolved_issues_count,
  COALESCE(im.open_critical_issues_count, 0) AS open_critical_issues_count,
  COALESCE(im.open_warning_issues_count, 0) AS open_warning_issues_count
FROM public.profiles p
LEFT JOIN doc_metrics dm ON dm.profile_id = p.id
LEFT JOIN run_metrics rm ON rm.profile_id = p.id
LEFT JOIN obs_metrics om ON om.profile_id = p.id
LEFT JOIN issue_metrics im ON im.profile_id = p.id;

COMMENT ON VIEW public.view_executive_summary IS
  'Curated executive KPI card dataset providing single-row profile aggregations of document statuses, run success rates, verification progress, and open validation issues.';


-- --------------------------------------------------------------------
-- View 2: view_review_backlog_aging
-- --------------------------------------------------------------------
-- Business Purpose:
--   Tracks human-in-the-loop review debt by categorizing pending observations
--   into aging intervals (< 24 hours, 1-7 days, > 7 days) based on the observation
--   record creation timestamp (created_at).
--
-- Logic:
--   Uses EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600 to measure elapsed
--   hours since ingestion and buckets pending items into operational SLAs:
--     - lt_24h: Age < 24 hours (Within standard same-day SLA)
--     - one_to_seven_days: Age between 24 and 168 hours (Approaching overdue)
--     - over_seven_days: Age > 168 hours (Critical review debt / SLA breach)
-- --------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_review_backlog_aging CASCADE;

CREATE OR REPLACE VIEW public.view_review_backlog_aging
WITH (security_invoker = true) AS
SELECT
  p.id AS profile_id,
  p.display_name,
  COUNT(o.id) FILTER (WHERE o.verified_by_user = 'pending') AS total_pending_observations,
  COALESCE(
    SUM(
      CASE
        WHEN o.verified_by_user = 'pending'
             AND (EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600) < 24
        THEN 1
        ELSE 0
      END
    ),
    0
  ) AS pending_lt_24h,
  COALESCE(
    SUM(
      CASE
        WHEN o.verified_by_user = 'pending'
             AND (EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600) >= 24
             AND (EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600) <= 168
        THEN 1
        ELSE 0
      END
    ),
    0
  ) AS pending_one_to_seven_days,
  COALESCE(
    SUM(
      CASE
        WHEN o.verified_by_user = 'pending'
             AND (EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600) > 168
        THEN 1
        ELSE 0
      END
    ),
    0
  ) AS pending_over_seven_days,
  MIN(o.created_at) FILTER (WHERE o.verified_by_user = 'pending') AS oldest_pending_created_at,
  MAX(o.created_at) FILTER (WHERE o.verified_by_user = 'pending') AS newest_pending_created_at
FROM public.profiles p
LEFT JOIN public.observations o ON o.profile_id = p.id
GROUP BY p.id, p.display_name;

COMMENT ON VIEW public.view_review_backlog_aging IS
  'Monitors observation review queue aging segmented into <24h, 1-7d, and >7d cohorts for operational SLA tracking.';


-- --------------------------------------------------------------------
-- View 3: view_analyte_loinc_coverage
-- --------------------------------------------------------------------
-- Business Purpose:
--   Measures clinical semantic standardization across distinct canonical
--   analytes, showing total observations, mapped counts with LOINC codes,
--   unmapped observations, and coverage percentage.
--
-- Optimization:
--   Ordered by total observations descending to prioritize high-volume
--   laboratory tests requiring mapping attention.
-- --------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_analyte_loinc_coverage CASCADE;

CREATE OR REPLACE VIEW public.view_analyte_loinc_coverage
WITH (security_invoker = true) AS
SELECT
  o.canonical_test_name,
  COUNT(*) AS total_observations,
  COUNT(*) FILTER (WHERE o.loinc_code IS NOT NULL AND TRIM(o.loinc_code) != '') AS mapped_observations,
  COUNT(*) FILTER (WHERE o.loinc_code IS NULL OR TRIM(o.loinc_code) = '') AS unmapped_observations,
  ROUND(
    COALESCE(
      (COUNT(*) FILTER (WHERE o.loinc_code IS NOT NULL AND TRIM(o.loinc_code) != '')::NUMERIC /
       NULLIF(COUNT(*), 0)) * 100,
      0
    ),
    1
  ) AS coverage_percentage
FROM public.observations o
GROUP BY o.canonical_test_name
ORDER BY total_observations DESC;

COMMENT ON VIEW public.view_analyte_loinc_coverage IS
  'Aggregates observation volume and LOINC mapping completeness by canonical biomarker for clinical semantic interoperability reporting.';
