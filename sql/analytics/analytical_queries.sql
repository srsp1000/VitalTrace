-- ====================================================================
-- VitalTrace Phase 3: Analytical SQL Queries
-- File: sql/analytics/analytical_queries.sql
--
-- Description:
--   7 demonstrable, standalone analytical SQL queries engineered for data
--   auditing, pipeline health monitoring, clinical data governance, and
--   longitudinal biomarker analysis.
--
-- Formatting Standard:
--   Each query is structured as a standalone, runnable query accompanied
--   by a standardized clinical data governance header containing:
--     - Business Question
--     - Metric Definition
--     - Numerator
--     - Denominator
--     - Time Window
--     - Exclusions
-- ====================================================================


-- ====================================================================
-- QUERY 1: Data Completeness Analysis
-- ====================================================================
-- Business Question:
--   What proportion of extracted laboratory biomarker records contain complete
--   clinical metadata (measurement value, original unit of measure, and
--   reference range intervals)?
--
-- Metric Definition:
--   Field-level completeness percentage across key clinical attributes:
--     1. Value Completeness: Observations containing either a numeric or text value.
--     2. Unit Completeness: Observations containing a populated original unit string.
--     3. Reference Range Completeness: Observations with at least one boundary (low or high).
--     4. Full Completeness: Observations satisfying all three completeness criteria.
--
-- Numerator:
--   - Value: COUNT of observations where (value_numeric IS NOT NULL OR value_text != '')
--   - Unit: COUNT of observations where (original_unit IS NOT NULL AND original_unit != '')
--   - Range: COUNT of observations where (reference_low IS NOT NULL OR reference_high IS NOT NULL)
--   - Full: COUNT of observations where (has_value = 1 AND has_unit = 1 AND has_reference_range = 1)
--
-- Denominator:
--   Total observations evaluated across all ingested documents (COUNT(*)).
--
-- Time Window:
--   Unbounded historical extraction batches (all active observations).
--
-- Exclusions:
--   None. Evaluates 100% of persisted observation records.
-- ====================================================================

WITH observation_completeness AS (
  SELECT
    id,
    profile_id,
    canonical_test_name,
    -- Condition A: Presence of quantitative or qualitative measurement value
    CASE
      WHEN value_numeric IS NOT NULL OR (value_text IS NOT NULL AND TRIM(value_text) != '')
      THEN 1
      ELSE 0
    END AS has_value,
    -- Condition B: Presence of original clinical unit of measure
    CASE
      WHEN original_unit IS NOT NULL AND TRIM(original_unit) != ''
      THEN 1
      ELSE 0
    END AS has_unit,
    -- Condition C: Presence of physiological reference interval bounds
    CASE
      WHEN reference_low IS NOT NULL OR reference_high IS NOT NULL
      THEN 1
      ELSE 0
    END AS has_reference_range
  FROM public.observations
)
SELECT
  COUNT(*) AS total_observations_evaluated,
  SUM(has_value) AS observations_with_value,
  SUM(has_unit) AS observations_with_unit,
  SUM(has_reference_range) AS observations_with_reference_range,
  SUM(CASE WHEN has_value = 1 AND has_unit = 1 AND has_reference_range = 1 THEN 1 ELSE 0 END) AS fully_complete_observations,
  ROUND((SUM(has_value)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2) AS value_completeness_rate_pct,
  ROUND((SUM(has_unit)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2) AS unit_completeness_rate_pct,
  ROUND((SUM(has_reference_range)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2) AS reference_range_completeness_rate_pct,
  ROUND((SUM(CASE WHEN has_value = 1 AND has_unit = 1 AND has_reference_range = 1 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2) AS fully_complete_rate_pct
FROM observation_completeness;


-- ====================================================================
-- QUERY 2: Duplicate Rate & Deduplication
-- ====================================================================
-- Business Question:
--   How frequently do redundant observations appear for the same patient,
--   analyte, and collection date, and what is the pipeline duplication rate?
--
-- Metric Definition:
--   Duplicate Observation Rate: The percentage of observations flagged as
--   redundant repetitions for an identical (profile_id, canonical_test_name,
--   observation_date) partition, sorted chronologically by created_at.
--
-- Numerator:
--   Total duplicate observations (COUNT(*) FILTER (WHERE row_num > 1)),
--   equivalent to (total_observations - distinct_logical_observations).
--
-- Denominator:
--   Total observations evaluated (COUNT(*)).
--
-- Time Window:
--   All ingested documents across the patient history.
--
-- Exclusions:
--   None. Evaluates full dataset before downstream filtering.
-- ====================================================================

WITH ranked_observations AS (
  SELECT
    id,
    profile_id,
    document_id,
    canonical_test_name,
    observation_date,
    value_numeric,
    original_unit,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY profile_id, canonical_test_name, observation_date
      ORDER BY created_at ASC, id ASC
    ) AS row_num
  FROM public.observations
),
duplicate_metrics AS (
  SELECT
    COUNT(*) AS total_observations,
    COUNT(*) FILTER (WHERE row_num = 1) AS distinct_observations,
    COUNT(*) FILTER (WHERE row_num > 1) AS duplicate_observations,
    ROUND(
      ((COUNT(*) - COUNT(*) FILTER (WHERE row_num = 1))::NUMERIC /
       NULLIF(COUNT(*), 0)) * 100,
      2
    ) AS duplicate_rate_percentage
  FROM ranked_observations
)
SELECT
  total_observations,
  distinct_observations,
  duplicate_observations,
  duplicate_rate_percentage
FROM duplicate_metrics;


-- ====================================================================
-- QUERY 3: Extraction Success vs Failed Runs
-- ====================================================================
-- Business Question:
--   What is the terminal reliability of the optical extraction engine across
--   ingested documents, and what retry overhead exists across unique documents?
--
-- Metric Definition:
--   1. Extraction Success Rate: Proportion of terminal runs that completed
--      successfully without unrecoverable parser or OCR failure.
--   2. Retry Rate: Percentage of additional extraction runs executed over
--      and above unique document counts ((total_runs - unique_docs) / unique_docs * 100).
--
-- Numerator:
--   - Success Rate: Completed runs (COUNT(*) FILTER (WHERE status = 'completed'))
--   - Retry Rate: Additional runs (total_terminal_runs - unique_documents)
--
-- Denominator:
--   - Success Rate: Total terminal runs (completed + failed)
--   - Retry Rate: Unique documents processed (COUNT(DISTINCT document_id))
--
-- Time Window:
--   All terminal extraction runs recorded in telemetry.
--
-- Exclusions:
--   In-flight extraction runs (status = 'running') are excluded to avoid
--   evaluating intermediate pipeline states.
-- ====================================================================

WITH terminal_runs AS (
  SELECT
    id AS run_id,
    document_id,
    model_name,
    status,
    started_at,
    completed_at,
    duration_ms,
    extracted_count,
    validation_issue_count
  FROM public.extraction_runs
  WHERE status IN ('completed', 'failed')
),
run_aggregates AS (
  SELECT
    COUNT(*) AS total_runs,
    COUNT(DISTINCT document_id) AS unique_documents,
    COUNT(*) FILTER (WHERE status = 'completed') AS successful_runs,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_runs
  FROM terminal_runs
)
SELECT
  total_runs,
  unique_documents,
  successful_runs,
  failed_runs,
  ROUND(
    COALESCE(
      ((total_runs - unique_documents)::NUMERIC / NULLIF(unique_documents, 0)) * 100,
      0
    ),
    2
  ) AS retry_rate_percentage,
  ROUND(
    COALESCE(
      (successful_runs::NUMERIC / NULLIF(total_runs, 0)) * 100,
      0
    ),
    2
  ) AS success_rate_percentage
FROM run_aggregates;


-- ====================================================================
-- QUERY 4: Review Backlog & Verification Throughput
-- ====================================================================
-- Business Question:
--   What is the volume and aging distribution of the human review queue, and
--   what is the overall verification completion rate?
--
-- Metric Definition:
--   1. Review Backlog Aging: Pending observations grouped into operational age
--      intervals (< 24 hours, 1-7 days, > 7 days) based on elapsed time from created_at.
--   2. Verification Completion Rate: Percentage of extracted observations that have
--      undergone human audit (confirmed or rejected) vs remaining pending.
--
-- Numerator:
--   - Backlog Aging: Pending observations matching age thresholds.
--   - Completion Rate: Observations with verified_by_user IN ('confirmed', 'rejected').
--
-- Denominator:
--   Total observations extracted and persisted (COUNT(*)).
--
-- Time Window:
--   Current state of the verification queue relative to NOW().
--
-- Exclusions:
--   None.
-- ====================================================================

WITH observation_aging AS (
  SELECT
    id,
    profile_id,
    verified_by_user,
    created_at,
    (EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) AS age_in_hours,
    CASE
      WHEN (EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) < 24 THEN 'lt_24h'
      WHEN (EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) <= 168 THEN 'one_to_seven_days'
      ELSE 'over_seven_days'
    END AS age_cohort
  FROM public.observations
)
SELECT
  COUNT(*) AS total_observations,
  COUNT(*) FILTER (WHERE verified_by_user = 'confirmed') AS confirmed_observations,
  COUNT(*) FILTER (WHERE verified_by_user = 'rejected') AS rejected_observations,
  COUNT(*) FILTER (WHERE verified_by_user = 'pending') AS total_pending_backlog,
  COUNT(*) FILTER (WHERE verified_by_user = 'pending' AND age_cohort = 'lt_24h') AS backlog_lt_24h,
  COUNT(*) FILTER (WHERE verified_by_user = 'pending' AND age_cohort = 'one_to_seven_days') AS backlog_1_to_7d,
  COUNT(*) FILTER (WHERE verified_by_user = 'pending' AND age_cohort = 'over_seven_days') AS backlog_over_7d,
  ROUND(
    (COUNT(*) FILTER (WHERE verified_by_user IN ('confirmed', 'rejected'))::NUMERIC /
     NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS verification_completion_rate_pct,
  ROUND(
    (COUNT(*) FILTER (WHERE verified_by_user = 'confirmed')::NUMERIC /
     NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS confirmation_rate_pct
FROM observation_aging;


-- ====================================================================
-- QUERY 5: Analyte Mapping & LOINC Coverage
-- ====================================================================
-- Business Question:
--   What is the semantic normalization coverage of extracted analytes to
--   Logical Observation Identifiers Names and Codes (LOINC) across biomarkers?
--
-- Metric Definition:
--   Analyte LOINC Coverage: Percentage of observations per canonical_test_name
--   that have been successfully linked to an official LOINC code.
--
-- Numerator:
--   Observations with non-null, non-empty loinc_code per canonical analyte.
--
-- Denominator:
--   Total observations for that canonical analyte (COUNT(*)).
--
-- Time Window:
--   All extracted observations in the platform.
--
-- Exclusions:
--   None.
-- ====================================================================

SELECT
  canonical_test_name,
  COUNT(*) AS total_observations,
  COUNT(*) FILTER (WHERE loinc_code IS NOT NULL AND TRIM(loinc_code) != '') AS mapped_observations,
  COUNT(*) FILTER (WHERE loinc_code IS NULL OR TRIM(loinc_code) = '') AS unmapped_observations,
  ROUND(
    COALESCE(
      (COUNT(*) FILTER (WHERE loinc_code IS NOT NULL AND TRIM(loinc_code) != '')::NUMERIC /
       NULLIF(COUNT(*), 0)) * 100,
      0
    ),
    2
  ) AS coverage_percentage
FROM public.observations
GROUP BY canonical_test_name
ORDER BY total_observations DESC, canonical_test_name ASC;


-- ====================================================================
-- QUERY 6: Processing Time & Latency Percentiles
-- ====================================================================
-- Business Question:
--   What are the average, median (p50), and tail (p95) latency profiles
--   of extraction model runs across processed lab reports?
--
-- Metric Definition:
--   - Mean Latency: Arithmetic average elapsed milliseconds (AVG(duration_ms)).
--   - Median Latency (p50): 50th percentile continuous duration.
--   - Tail Latency (p95): 95th percentile continuous duration.
--
-- Numerator:
--   Continuous cumulative distribution of duration_ms in completed runs.
--
-- Denominator:
--   Total completed runs with non-null duration telemetry.
--
-- Time Window:
--   All recorded extraction executions to date.
--
-- Exclusions:
--   Failed runs (status = 'failed'), in-flight executions (status = 'running'),
--   and runs where duration_ms IS NULL.
-- ====================================================================

SELECT
  model_name,
  COUNT(*) AS completed_runs_count,
  ROUND(AVG(duration_ms), 1) AS avg_duration_ms,
  ROUND(AVG(duration_ms) / 1000.0, 3) AS avg_duration_seconds,
  ROUND(
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms)::NUMERIC,
    1
  ) AS p50_median_duration_ms,
  ROUND(
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::NUMERIC,
    1
  ) AS p95_tail_duration_ms,
  MIN(duration_ms) AS min_duration_ms,
  MAX(duration_ms) AS max_duration_ms
FROM public.extraction_runs
WHERE status = 'completed'
  AND duration_ms IS NOT NULL
GROUP BY model_name;


-- ====================================================================
-- QUERY 7: Longitudinal Trajectory & Value Deltas
-- ====================================================================
-- Business Question:
--   For a patient tracking Fasting Glucose over time, what is the chronological
--   trajectory, numeric change, and percentage shift from their previous verified test?
--
-- Metric Definition:
--   Longitudinal Delta: Difference between the current observation value and
--   the immediately preceding confirmed reading for analyte 'Fasting Glucose'
--   (value_numeric - LAG(value_numeric)).
--
-- Numerator:
--   (value_numeric - LAG(value_numeric) OVER (PARTITION BY profile_id ORDER BY observation_date ASC, id ASC))
--
-- Denominator:
--   Previous confirmed reading (LAG(value_numeric)) for percentage change calculation.
--
-- Time Window:
--   Complete chronological history of confirmed observations.
--
-- Exclusions:
--   - Observations where verified_by_user != 'confirmed' (unverified or rejected results).
--   - Observations where value_numeric IS NULL.
--   - Analytes other than 'Fasting Glucose'.
-- ====================================================================

WITH confirmed_glucose_readings AS (
  SELECT
    o.id AS observation_id,
    o.profile_id,
    p.display_name AS patient_name,
    o.document_id,
    d.original_filename,
    o.canonical_test_name,
    o.observation_date,
    o.value_numeric,
    o.original_unit,
    o.reference_low,
    o.reference_high,
    LAG(o.value_numeric) OVER (
      PARTITION BY o.profile_id
      ORDER BY o.observation_date ASC, o.id ASC
    ) AS prev_value_numeric,
    LAG(o.observation_date) OVER (
      PARTITION BY o.profile_id
      ORDER BY o.observation_date ASC, o.id ASC
    ) AS prev_observation_date
  FROM public.observations o
  JOIN public.profiles p ON p.id = o.profile_id
  JOIN public.documents d ON d.id = o.document_id
  WHERE o.canonical_test_name = 'Fasting Glucose'
    AND o.verified_by_user = 'confirmed'
    AND o.value_numeric IS NOT NULL
)
SELECT
  observation_id,
  profile_id,
  patient_name,
  original_filename,
  canonical_test_name,
  observation_date,
  value_numeric,
  original_unit,
  reference_low,
  reference_high,
  prev_value_numeric,
  prev_observation_date,
  ROUND((value_numeric - prev_value_numeric)::NUMERIC, 2) AS delta_from_previous,
  (observation_date - prev_observation_date) AS days_since_previous,
  ROUND(
    (((value_numeric - prev_value_numeric) / NULLIF(prev_value_numeric, 0)) * 100)::NUMERIC,
    2
  ) AS pct_change_from_previous,
  CASE
    WHEN prev_value_numeric IS NULL THEN 'Baseline'
    WHEN value_numeric > prev_value_numeric THEN 'Increased'
    WHEN value_numeric < prev_value_numeric THEN 'Decreased'
    ELSE 'Unchanged'
  END AS trajectory_direction,
  CASE
    WHEN reference_low IS NOT NULL AND value_numeric < reference_low THEN 'Below Normal'
    WHEN reference_high IS NOT NULL AND value_numeric > reference_high THEN 'Above Normal'
    ELSE 'Within Normal Range'
  END AS clinical_range_status
FROM confirmed_glucose_readings
ORDER BY profile_id, observation_date ASC;
