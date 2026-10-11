-- ====================================================================
-- VitalTrace Migration 004: Clinical Analytics & Data Quality Views
-- Reusable SQL Views for Data Engineering & Intern Portfolio KPIs
-- Fixed: Multi-tenant RLS invocation (security_invoker = true)
-- Fixed: Eliminated Cartesian join fan-out on extraction telemetry
-- ====================================================================

-- 1. View: Documents processed per day
-- Tracks ingestion velocity over time
CREATE OR REPLACE VIEW public.view_documents_processed_daily
WITH (security_invoker = true) AS
SELECT
  d.profile_id,
  DATE(d.created_at) AS processing_date,
  COUNT(*) AS total_documents_uploaded,
  COUNT(*) FILTER (WHERE d.processing_status = 'completed') AS completed_count,
  COUNT(*) FILTER (WHERE d.processing_status = 'review_required') AS review_required_count,
  COUNT(*) FILTER (WHERE d.processing_status = 'failed') AS failed_count,
  SUM(d.file_size_bytes) AS total_bytes_ingested
FROM public.documents d
GROUP BY d.profile_id, DATE(d.created_at)
ORDER BY processing_date DESC;

-- 2. View: Successful and failed processing runs
-- Monitors ingestion engine health and error breakdowns with profile scoping
CREATE OR REPLACE VIEW public.view_extraction_run_health
WITH (security_invoker = true) AS
SELECT
  d.profile_id,
  er.model_name,
  COUNT(*) AS total_runs,
  COUNT(*) FILTER (WHERE er.status = 'completed') AS successful_runs,
  COUNT(*) FILTER (WHERE er.status = 'failed') AS failed_runs,
  COUNT(*) FILTER (WHERE er.status = 'running') AS running_runs,
  ROUND(
    COALESCE(
      (COUNT(*) FILTER (WHERE er.status = 'completed')::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE er.status IN ('completed', 'failed')), 0)) * 100,
      NULL
    ),
    1
  ) AS success_rate_percentage,
  ROUND(AVG(er.duration_ms) FILTER (WHERE er.status = 'completed'), 0) AS avg_duration_ms
FROM public.extraction_runs er
JOIN public.documents d ON d.id = er.document_id
GROUP BY d.profile_id, er.model_name;

-- 3. View: Observation counts by test
-- Measures biomarker extraction volume across canonical aliases
CREATE OR REPLACE VIEW public.view_observation_counts_by_test
WITH (security_invoker = true) AS
SELECT
  o.profile_id,
  o.canonical_test_name,
  COUNT(*) AS total_observations,
  COUNT(*) FILTER (WHERE o.verified_by_user = 'confirmed') AS confirmed_count,
  COUNT(*) FILTER (WHERE o.verified_by_user = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE o.verified_by_user = 'rejected') AS rejected_count,
  MIN(o.observation_date) AS earliest_observation,
  MAX(o.observation_date) AS latest_observation,
  o.original_unit AS dominant_unit
FROM public.observations o
GROUP BY o.profile_id, o.canonical_test_name, o.original_unit
ORDER BY total_observations DESC;

-- 4. View: Validation issues by type and severity
-- Summarizes data quality discrepancies flagged by deterministic rules
CREATE OR REPLACE VIEW public.view_validation_issues_summary
WITH (security_invoker = true) AS
SELECT
  d.profile_id,
  vi.issue_type,
  vi.severity,
  COUNT(*) AS total_occurrences,
  COUNT(*) FILTER (WHERE vi.resolved = TRUE) AS resolved_count,
  COUNT(*) FILTER (WHERE vi.resolved = FALSE) AS active_count,
  ROUND(
    COALESCE(
      (COUNT(*) FILTER (WHERE vi.resolved = TRUE)::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      0
    ),
    1
  ) AS resolution_rate_percentage
FROM public.validation_issues vi
JOIN public.documents d ON d.id = vi.document_id
GROUP BY d.profile_id, vi.issue_type, vi.severity
ORDER BY active_count DESC, total_occurrences DESC;

-- 5. View: Missing values by field
-- Identifies field completeness rates across extracted observations
CREATE OR REPLACE VIEW public.view_missing_field_analysis
WITH (security_invoker = true) AS
SELECT
  o.profile_id,
  COUNT(*) AS total_observations_evaluated,
  COUNT(*) FILTER (WHERE o.value_numeric IS NULL AND (o.value_text IS NULL OR o.value_text = '')) AS missing_value_count,
  COUNT(*) FILTER (WHERE o.original_unit IS NULL OR TRIM(o.original_unit) = '') AS missing_unit_count,
  COUNT(*) FILTER (WHERE o.reference_low IS NULL AND o.reference_high IS NULL) AS missing_reference_range_count,
  ROUND(
    COALESCE(
      (COUNT(*) FILTER (WHERE o.original_unit IS NULL OR TRIM(o.original_unit) = '')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      0
    ),
    2
  ) AS missing_unit_percentage
FROM public.observations o
GROUP BY o.profile_id;

-- 6. View: Duplicate observations analysis
-- Identifies duplicate test entries on identical specimen dates
CREATE OR REPLACE VIEW public.view_duplicate_observations
WITH (security_invoker = true) AS
SELECT
  o.profile_id,
  o.document_id,
  o.canonical_test_name,
  o.observation_date,
  COUNT(*) AS duplicate_count,
  ARRAY_AGG(o.id) AS observation_ids
FROM public.observations o
GROUP BY o.profile_id, o.document_id, o.canonical_test_name, o.observation_date
HAVING COUNT(*) > 1;

-- 7. View: Confirmed versus unverified observations ratio
-- Evaluates human-in-the-loop audit completion
CREATE OR REPLACE VIEW public.view_verification_funnel
WITH (security_invoker = true) AS
SELECT
  o.profile_id,
  COUNT(*) AS total_extracted,
  COUNT(*) FILTER (WHERE o.verified_by_user = 'confirmed') AS confirmed_count,
  COUNT(*) FILTER (WHERE o.verified_by_user = 'pending') AS pending_review_count,
  COUNT(*) FILTER (WHERE o.verified_by_user = 'rejected') AS rejected_count,
  COUNT(*) FILTER (WHERE o.user_corrected = TRUE) AS user_corrected_count,
  ROUND(
    COALESCE(
      (COUNT(*) FILTER (WHERE o.verified_by_user = 'confirmed')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      0
    ),
    1
  ) AS confirmation_rate_percentage
FROM public.observations o
GROUP BY o.profile_id;

-- 8. View: Quality metrics by processing run
-- Corrected: Uses CTEs to pre-aggregate observations and issues, avoiding Cartesian product join fan-out
CREATE OR REPLACE VIEW public.view_run_quality_telemetry
WITH (security_invoker = true) AS
WITH obs_summary AS (
  SELECT
    extraction_run_id,
    COUNT(*) AS observations_persisted,
    COUNT(*) FILTER (WHERE validation_status = 'valid') AS valid_observations_count,
    COUNT(*) FILTER (WHERE validation_status = 'warning') AS warning_observations_count,
    COUNT(*) FILTER (WHERE validation_status = 'error') AS error_observations_count
  FROM public.observations
  GROUP BY extraction_run_id
),
issue_summary AS (
  SELECT
    extraction_run_id,
    COUNT(*) AS issues_flagged,
    COUNT(*) FILTER (WHERE severity = 'error') AS critical_issues_count,
    COUNT(*) FILTER (WHERE severity = 'warning') AS warning_issues_count
  FROM public.validation_issues
  GROUP BY extraction_run_id
)
SELECT
  er.id AS run_id,
  er.document_id,
  d.profile_id,
  d.original_filename,
  er.model_name,
  er.status AS run_status,
  er.started_at,
  er.completed_at,
  er.duration_ms,
  er.extracted_count,
  COALESCE(os.observations_persisted, 0) AS observations_persisted,
  COALESCE(os.valid_observations_count, 0) AS valid_observations_count,
  COALESCE(os.warning_observations_count, 0) AS warning_observations_count,
  COALESCE(os.error_observations_count, 0) AS error_observations_count,
  COALESCE(isum.issues_flagged, 0) AS issues_flagged,
  COALESCE(isum.critical_issues_count, 0) AS critical_issues_count,
  COALESCE(isum.warning_issues_count, 0) AS warning_issues_count,
  CASE
    WHEN COALESCE(os.observations_persisted, 0) = 0 THEN NULL
    ELSE ROUND(
      (os.valid_observations_count::NUMERIC / os.observations_persisted::NUMERIC) * 100,
      1
    )
  END AS pass_rate_percentage
FROM public.extraction_runs er
JOIN public.documents d ON d.id = er.document_id
LEFT JOIN obs_summary os ON os.extraction_run_id = er.id
LEFT JOIN issue_summary isum ON isum.extraction_run_id = er.id
ORDER BY er.started_at DESC;

-- 9. Function / Query: Longitudinal readings for a selected test
-- Returns ordered trajectory with delta calculations from previous reading
CREATE OR REPLACE FUNCTION public.get_longitudinal_trajectory(
  p_profile_id UUID,
  p_test_name TEXT
)
RETURNS TABLE (
  observation_id UUID,
  observation_date DATE,
  value_numeric DOUBLE PRECISION,
  unit TEXT,
  reference_low DOUBLE PRECISION,
  reference_high DOUBLE PRECISION,
  document_filename TEXT,
  delta_from_previous DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  WITH trajectory AS (
    SELECT
      o.id,
      o.observation_date,
      o.value_numeric,
      o.original_unit,
      o.reference_low,
      o.reference_high,
      d.original_filename,
      LAG(o.value_numeric) OVER (ORDER BY o.observation_date ASC) AS prev_val
    FROM public.observations o
    JOIN public.documents d ON d.id = o.document_id
    WHERE o.profile_id = p_profile_id
      AND o.canonical_test_name = p_test_name
      AND o.verified_by_user = 'confirmed'
      AND o.value_numeric IS NOT NULL
  )
  SELECT
    t.id,
    t.observation_date,
    t.value_numeric,
    t.original_unit,
    t.reference_low,
    t.reference_high,
    t.original_filename,
    (t.value_numeric - t.prev_val) AS delta_from_previous
  FROM trajectory t
  ORDER BY t.observation_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. View: Processing time by document
-- Measures document size vs extraction duration
CREATE OR REPLACE VIEW public.view_document_processing_latency
WITH (security_invoker = true) AS
SELECT
  d.id AS document_id,
  d.profile_id,
  d.original_filename,
  d.file_size_bytes,
  ROUND(d.file_size_bytes::NUMERIC / 1024, 1) AS file_size_kb,
  d.mime_type,
  er.model_name,
  er.duration_ms,
  ROUND(er.duration_ms::NUMERIC / 1000, 2) AS duration_seconds,
  er.extracted_count,
  d.processing_status
FROM public.documents d
JOIN public.extraction_runs er ON er.document_id = d.id
ORDER BY d.created_at DESC;
