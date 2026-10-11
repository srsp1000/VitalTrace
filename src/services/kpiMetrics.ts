import type { 
  LabDocument, 
  ExtractionRun, 
  Observation, 
  ValidationIssue 
} from '../types';

export type TimeRangeFilter = 'all' | '24h' | '7d' | '30d' | '90d';

export interface CalculatedKPIs {
  // 1. Documents
  totalDocuments: number;
  completedDocuments: number;
  reviewRequiredDocuments: number;
  failedDocuments: number;
  terminalDocuments: number;
  documentSuccessRate: number | null; // null if no terminal documents

  // 2. Extraction Runs
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  runningRuns: number;
  terminalRuns: number;
  extractionSuccessRate: number | null; // null if no terminal runs

  // 3. Observations
  totalObservations: number;
  validObservations: number;
  warningObservations: number;
  errorObservations: number;
  validationPassRate: number | null; // null if 0 observations

  confirmedObservations: number;
  pendingObservations: number;
  rejectedObservations: number;
  verifiedObservationRate: number | null; // null if 0 observations

  // 4. Quality & Fields
  missingFieldObservations: number;
  fieldCompletenessRate: number | null; // null if 0 observations
  missingFieldRate: number | null;
  duplicateCount: number;

  // 5. Latency Telemetry
  avgDurationMs: number | null;
  p50DurationMs: number | null;
  p95DurationMs: number | null;

  // 6. Issues breakdown
  openIssuesCount: number;
  criticalIssuesCount: number;
  warningIssuesCount: number;
  infoIssuesCount: number;
  issuesByCategory: Record<string, number>;
}

/**
 * Calculates percentile from an array of numbers.
 * Assumes numbers array is sorted in ascending order.
 */
export function calculatePercentile(sortedValues: number[], percentile: number): number | null {
  if (sortedValues.length === 0) return null;
  if (sortedValues.length === 1) return sortedValues[0];

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sortedValues[lower];
  return Math.round(sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight);
}

/**
 * Filters items by a specified time range relative to reference date.
 */
export function filterByTimeRange<T>(
  items: T[],
  range: TimeRangeFilter,
  dateGetter: (item: T) => string | null | undefined,
  nowMs: number = Date.now()
): T[] {
  if (range === 'all') return items;

  const hoursMap: Record<TimeRangeFilter, number> = {
    all: 0,
    '24h': 24,
    '7d': 24 * 7,
    '30d': 24 * 30,
    '90d': 24 * 90,
  };

  const cutoffMs = nowMs - hoursMap[range] * 60 * 60 * 1000;

  return items.filter(item => {
    const dateStr = dateGetter(item);
    if (!dateStr) return false;
    const time = new Date(dateStr).getTime();
    return !isNaN(time) && time >= cutoffMs;
  });
}

/**
 * Computes deterministic Data Quality and Pipeline Analytics KPIs.
 * Handles zero-denominators by returning null instead of invented percentages.
 */
export function calculatePipelineKPIs(
  documents: LabDocument[],
  runs: ExtractionRun[],
  observations: Observation[],
  validationIssues: ValidationIssue[]
): CalculatedKPIs {
  // 1. Documents Breakdown
  const totalDocuments = documents.length;
  const completedDocuments = documents.filter(d => d.processingStatus === 'completed').length;
  const reviewRequiredDocuments = documents.filter(d => d.processingStatus === 'review_required').length;
  const failedDocuments = documents.filter(d => d.processingStatus === 'failed').length;
  const terminalDocuments = completedDocuments + failedDocuments;
  const documentSuccessRate = terminalDocuments > 0
    ? Math.round((completedDocuments / terminalDocuments) * 1000) / 10
    : null;

  // 2. Extraction Runs Breakdown
  const totalRuns = runs.length;
  const completedRuns = runs.filter(r => r.status === 'completed').length;
  const failedRuns = runs.filter(r => r.status === 'failed').length;
  const runningRuns = runs.filter(r => r.status === 'running').length;
  const terminalRuns = completedRuns + failedRuns;
  const extractionSuccessRate = terminalRuns > 0
    ? Math.round((completedRuns / terminalRuns) * 1000) / 10
    : null;

  // 3. Observations Breakdown
  const totalObservations = observations.length;
  const validObservations = observations.filter(o => o.validationStatus === 'valid').length;
  const warningObservations = observations.filter(o => o.validationStatus === 'warning').length;
  const errorObservations = observations.filter(o => o.validationStatus === 'error').length;
  const validationPassRate = totalObservations > 0
    ? Math.round((validObservations / totalObservations) * 1000) / 10
    : null;

  const confirmedObservations = observations.filter(o => o.verifiedByUser === 'confirmed').length;
  const pendingObservations = observations.filter(o => o.verifiedByUser === 'pending').length;
  const rejectedObservations = observations.filter(o => o.verifiedByUser === 'rejected').length;
  const verifiedObservationRate = totalObservations > 0
    ? Math.round((confirmedObservations / totalObservations) * 1000) / 10
    : null;

  // 4. Missing Fields & Duplicates
  const missingFieldObservations = observations.filter(o => {
    const missingUnit = !o.originalUnit || o.originalUnit.trim() === '';
    const missingValue = o.valueNumeric === null && (!o.valueText || o.valueText.trim() === '');
    return missingUnit || missingValue;
  }).length;

  const missingFieldRate = totalObservations > 0
    ? Math.round((missingFieldObservations / totalObservations) * 1000) / 10
    : null;

  const fieldCompletenessRate = totalObservations > 0
    ? Math.round(((totalObservations - missingFieldObservations) / totalObservations) * 1000) / 10
    : null;

  const duplicateCount = validationIssues.filter(i => i.issueType === 'duplicate_observation').length;

  // 5. Latency Telemetry
  const durations = runs
    .filter(r => r.status === 'completed' && typeof r.durationMs === 'number' && r.durationMs > 0)
    .map(r => r.durationMs as number)
    .sort((a, b) => a - b);

  const avgDurationMs = durations.length > 0
    ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
    : null;

  const p50DurationMs = calculatePercentile(durations, 50);
  const p95DurationMs = calculatePercentile(durations, 95);

  // 6. Issues Breakdown
  const openIssues = validationIssues.filter(i => !i.resolved);
  const openIssuesCount = openIssues.length;
  const criticalIssuesCount = openIssues.filter(i => i.severity === 'error').length;
  const warningIssuesCount = openIssues.filter(i => i.severity === 'warning').length;
  const infoIssuesCount = openIssues.filter(i => i.severity === 'info').length;

  const issuesByCategory: Record<string, number> = {};
  validationIssues.forEach(issue => {
    issuesByCategory[issue.issueType] = (issuesByCategory[issue.issueType] || 0) + 1;
  });

  return {
    totalDocuments,
    completedDocuments,
    reviewRequiredDocuments,
    failedDocuments,
    terminalDocuments,
    documentSuccessRate,
    totalRuns,
    completedRuns,
    failedRuns,
    runningRuns,
    terminalRuns,
    extractionSuccessRate,
    totalObservations,
    validObservations,
    warningObservations,
    errorObservations,
    validationPassRate,
    confirmedObservations,
    pendingObservations,
    rejectedObservations,
    verifiedObservationRate,
    missingFieldObservations,
    fieldCompletenessRate,
    missingFieldRate,
    duplicateCount,
    avgDurationMs,
    p50DurationMs,
    p95DurationMs,
    openIssuesCount,
    criticalIssuesCount,
    warningIssuesCount,
    infoIssuesCount,
    issuesByCategory,
  };
}
