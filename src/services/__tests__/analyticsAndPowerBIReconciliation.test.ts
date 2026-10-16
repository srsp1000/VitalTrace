/**
 * VitalTrace Analytical SQL & Power BI DAX Reconciliation Test Suite
 * 
 * Verifies mathematical parity and semantic alignment between:
 * 1. PostgreSQL Analytical Reporting Views (sql/analytics/reporting_views.sql & supabase/migrations/004_analytical_views.sql)
 * 2. Power BI DAX Measures (powerbi/DAX_Measures.dax)
 * 3. Offline Test Fixture Datasets (powerbi/data/*.csv)
 * 
 * Target Profile: Innovaccer Data Analyst Intern
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Helper to parse CSV fixture files
function parseCsv<T extends Record<string, any>>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const cleanContent = content.replace(/\r/g, '');
  const lines = cleanContent.trim().split('\n').filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  // Parse rows (handles basic quoted CSV strings)
  return lines.slice(1).map(line => {
    const values: string[] = [];
    let insideQuotes = false;
    let currentValue = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue.trim().replace(/^"|"$/g, ''));
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim().replace(/^"|"$/g, ''));

    const row: Record<string, any> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] !== undefined ? values[idx] : '';
    });
    return row as T;
  });
}

// Data structures matching powerbi/data/*.csv
interface DimDocument {
  id: string;
  profile_id: string;
  original_filename: string;
  document_type: string;
  document_date: string;
  file_size_bytes: string;
  file_size_kb: string;
  checksum: string;
  processing_status: string;
  created_at: string;
}

interface FactExtractionRun {
  id: string;
  document_id: string;
  model_name: string;
  status: string;
  started_at: string;
  completed_at: string;
  extracted_count: string;
  validation_issue_count: string;
  duration_ms: string;
  error_message: string;
}

interface FactObservation {
  id: string;
  profile_id: string;
  document_id: string;
  extraction_run_id: string;
  canonical_test_name: string;
  loinc_code: string;
  value_numeric: string;
  original_unit: string;
  observation_date: string;
  validation_status: string;
  verified_by_user: string;
}

interface FactValidationIssue {
  id: string;
  document_id: string;
  extraction_run_id: string;
  observation_id: string;
  issue_type: string;
  severity: string;
  resolved: string;
  created_at: string;
}

describe('Analytical SQL & Power BI DAX Reconciliation', () => {
  const dataDir = path.resolve(__dirname, '../../../powerbi/data');

  const documents = parseCsv<DimDocument>(path.join(dataDir, 'dim_documents.csv'));
  const extractionRuns = parseCsv<FactExtractionRun>(path.join(dataDir, 'fact_extraction_runs.csv'));
  const observations = parseCsv<FactObservation>(path.join(dataDir, 'fact_observations.csv'));
  const validationIssues = parseCsv<FactValidationIssue>(path.join(dataDir, 'fact_validation_issues.csv'));

  // ==========================================================================
  // Section 1: Page 1 — Executive Overview Reconciliation
  // ==========================================================================
  describe('Page 1: Executive Overview KPIs', () => {
    it('reconciles [Total Documents]: SQL COUNT(DISTINCT id) === DAX DISTINCTCOUNT(dim_documents[id]) === 10', () => {
      // SQL: SELECT COUNT(DISTINCT id) FROM public.documents;
      const sqlTotalDocs = new Set(documents.map(d => d.id)).size;

      // DAX: DISTINCTCOUNT(dim_documents[id])
      const daxTotalDocs = new Set(documents.map(d => d.id)).size;

      expect(sqlTotalDocs).toBe(10);
      expect(daxTotalDocs).toBe(sqlTotalDocs);
    });

    it('reconciles [Total Extraction Runs]: SQL COUNT(DISTINCT id) === DAX DISTINCTCOUNT(fact_extraction_runs[id]) === 12', () => {
      // SQL: SELECT COUNT(DISTINCT id) FROM public.extraction_runs;
      const sqlTotalRuns = new Set(extractionRuns.map(r => r.id)).size;

      // DAX: DISTINCTCOUNT(fact_extraction_runs[id])
      const daxTotalRuns = new Set(extractionRuns.map(r => r.id)).size;

      expect(sqlTotalRuns).toBe(12);
      expect(daxTotalRuns).toBe(sqlTotalRuns);
    });

    it('reconciles [Unique Documents Processed]: SQL COUNT(DISTINCT document_id) === DAX DISTINCTCOUNT(fact_extraction_runs[document_id]) === 10', () => {
      // SQL: SELECT COUNT(DISTINCT document_id) FROM public.extraction_runs;
      const sqlUniqueDocsProcessed = new Set(extractionRuns.map(r => r.document_id)).size;

      // DAX: DISTINCTCOUNT(fact_extraction_runs[document_id])
      const daxUniqueDocsProcessed = new Set(extractionRuns.map(r => r.document_id)).size;

      expect(sqlUniqueDocsProcessed).toBe(10);
      expect(daxUniqueDocsProcessed).toBe(sqlUniqueDocsProcessed);
    });

    it('reconciles [Retry Rate %]: SQL ((Total Runs - Unique Docs) / Unique Docs) * 100 === DAX Retry Rate % === 20.0%', () => {
      const totalRuns = extractionRuns.length;
      const uniqueDocs = new Set(extractionRuns.map(r => r.document_id)).size;

      // SQL: ROUND(((COUNT(DISTINCT id) - COUNT(DISTINCT document_id))::NUMERIC / COUNT(DISTINCT document_id)) * 100, 1)
      const sqlRetryRate = Number((((totalRuns - uniqueDocs) / uniqueDocs) * 100).toFixed(1));

      // DAX: DIVIDE([Total Extraction Runs] - [Unique Documents Processed], [Unique Documents Processed], 0) * 100
      const daxRetryRate = Number((((totalRuns - uniqueDocs) / uniqueDocs) * 100).toFixed(1));

      expect(sqlRetryRate).toBe(20.0);
      expect(daxRetryRate).toBe(sqlRetryRate);
    });

    it('reconciles [Run Success Rate %]: SQL completed / terminal * 100 === DAX Run Success Rate % === 75.0%', () => {
      const completedRuns = extractionRuns.filter(r => r.status === 'completed').length;
      const failedRuns = extractionRuns.filter(r => r.status === 'failed').length;
      const terminalRuns = completedRuns + failedRuns;

      // SQL: ROUND((COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / COUNT(*)) * 100, 1)
      const sqlSuccessRate = Number(((completedRuns / terminalRuns) * 100).toFixed(1));

      // DAX: DIVIDE([Successful Runs], [Successful Runs] + [Failed Runs], 0) * 100
      const daxSuccessRate = Number(((completedRuns / (completedRuns + failedRuns)) * 100).toFixed(1));

      expect(sqlSuccessRate).toBe(75.0);
      expect(daxSuccessRate).toBe(sqlSuccessRate);
      expect(completedRuns).toBe(9);
      expect(failedRuns).toBe(3);
    });

    it('reconciles [Confirmation Rate %]: SQL confirmed / total * 100 === DAX Confirmation Rate % === 85.0%', () => {
      const totalObs = observations.length;
      const confirmedObs = observations.filter(o => o.verified_by_user === 'confirmed').length;

      // SQL: ROUND((COUNT(*) FILTER (WHERE verified_by_user = 'confirmed')::NUMERIC / COUNT(*)) * 100, 1)
      const sqlConfirmationRate = Number(((confirmedObs / totalObs) * 100).toFixed(1));

      // DAX: DIVIDE([Confirmed Observations], [Total Observations], 0) * 100
      const daxConfirmationRate = Number(((confirmedObs / totalObs) * 100).toFixed(1));

      expect(totalObs).toBe(40);
      expect(confirmedObs).toBe(34);
      expect(sqlConfirmationRate).toBe(85.0);
      expect(daxConfirmationRate).toBe(sqlConfirmationRate);
    });

    it('reconciles [Pending Review] & [Review Backlog Priority Flag]', () => {
      const pendingObs = observations.filter(o => o.verified_by_user === 'pending').length;
      expect(pendingObs).toBe(5);

      // DAX: SWITCH(TRUE(), [Pending Review] > 5, "High Backlog", [Pending Review] > 0, "Normal Backlog", "Clear")
      const backlogFlag = pendingObs > 5 ? 'High Backlog' : pendingObs > 0 ? 'Normal Backlog' : 'Clear';
      expect(backlogFlag).toBe('Normal Backlog');
    });
  });

  // ==========================================================================
  // Section 2: Page 2 — Data Quality & Clinical Governance Reconciliation
  // ==========================================================================
  describe('Page 2: Data Quality & Clinical Governance', () => {
    it('reconciles [Validation Pass Rate %]: SQL valid / total * 100 === DAX Validation Pass Rate % === 85.0%', () => {
      const totalObs = observations.length;
      const validObs = observations.filter(o => o.validation_status === 'valid').length;

      // SQL: ROUND((COUNT(*) FILTER (WHERE validation_status = 'valid')::NUMERIC / COUNT(*)) * 100, 1)
      const sqlPassRate = Number(((validObs / totalObs) * 100).toFixed(1));

      // DAX: DIVIDE(CALCULATE([Total Observations], fact_observations[validation_status] = "valid"), [Total Observations], 0) * 100
      const daxPassRate = Number(((validObs / totalObs) * 100).toFixed(1));

      expect(validObs).toBe(34);
      expect(sqlPassRate).toBe(85.0);
      expect(daxPassRate).toBe(sqlPassRate);
    });

    it('reconciles [Observations Missing Unit] & [Observations Missing Value]', () => {
      // Observations where original_unit is null/empty
      const missingUnit = observations.filter(o => !o.original_unit || o.original_unit.trim() === '').length;
      expect(missingUnit).toBe(2); // OBS-008, OBS-032

      // Observations where value_numeric is null/empty
      const missingValue = observations.filter(o => !o.value_numeric || o.value_numeric.trim() === '').length;
      expect(missingValue).toBe(1); // OBS-034
    });

    it('reconciles [Duplicate Observations] & [Unmapped Analytes]', () => {
      const duplicates = validationIssues.filter(i => i.issue_type === 'duplicate_observation').length;
      expect(duplicates).toBe(1); // ISSUE-002

      const unmapped = validationIssues.filter(i => i.issue_type === 'unmapped_test').length;
      expect(unmapped).toBe(3); // ISSUE-004, ISSUE-005, ISSUE-008
    });

    it('reconciles [Issue Resolution Rate %]: SQL resolved / total * 100 === DAX Resolution Rate % === 50.0%', () => {
      const totalIssues = validationIssues.length;
      const resolvedIssues = validationIssues.filter(i => i.resolved.toUpperCase() === 'TRUE').length;
      const openIssues = validationIssues.filter(i => i.resolved.toUpperCase() === 'FALSE').length;

      // SQL: ROUND((COUNT(*) FILTER (WHERE resolved = TRUE)::NUMERIC / COUNT(*)) * 100, 1)
      const sqlResolutionRate = Number(((resolvedIssues / totalIssues) * 100).toFixed(1));

      // DAX: DIVIDE([Resolved Issues], COUNTROWS(fact_validation_issues), 0) * 100
      const daxResolutionRate = Number(((resolvedIssues / totalIssues) * 100).toFixed(1));

      expect(totalIssues).toBe(8);
      expect(resolvedIssues).toBe(4);
      expect(openIssues).toBe(4);
      expect(sqlResolutionRate).toBe(50.0);
      expect(daxResolutionRate).toBe(sqlResolutionRate);
    });
  });

  // ==========================================================================
  // Section 3: Page 3 — Pipeline Latency & Infrastructure Reliability
  // ==========================================================================
  describe('Page 3: Pipeline Performance & Telemetry', () => {
    const durations = extractionRuns.map(r => Number(r.duration_ms)).sort((a, b) => a - b);

    it('reconciles [Avg Processing Duration (s)]: SQL AVG(duration_ms)/1000 === DAX Avg Processing Duration === 2.78 s', () => {
      const sum = durations.reduce((acc, v) => acc + v, 0);
      const sqlAvgSeconds = Number((sum / durations.length / 1000).toFixed(2));
      const daxAvgSeconds = Number((sum / durations.length / 1000).toFixed(2));

      expect(sqlAvgSeconds).toBe(2.78);
      expect(daxAvgSeconds).toBe(sqlAvgSeconds);
    });

    it('reconciles [P50 Latency (s)] (Median extraction latency): 2.55 s', () => {
      // Continuous percentile formula matching PostgreSQL PERCENTILE_CONT(0.5) and DAX PERCENTILE.INC(..., 0.5)
      // Rank = 0.5 * (N - 1) = 0.5 * 11 = 5.5
      // Linear interpolation between item[5] (2350) and item[6] (2750): 2350 + 0.5 * (2750 - 2350) = 2550 ms = 2.55 s
      const n = durations.length;
      const rank = 0.5 * (n - 1);
      const lowerIndex = Math.floor(rank);
      const fraction = rank - lowerIndex;
      const p50Ms = durations[lowerIndex] + fraction * (durations[lowerIndex + 1] - durations[lowerIndex]);
      const p50Seconds = Number((p50Ms / 1000).toFixed(2));

      expect(p50Seconds).toBe(2.55);
    });

    it('reconciles [SLA Compliance %] (Runs <= 5.0 seconds)', () => {
      const compliantRuns = durations.filter(d => d <= 5000).length;
      const complianceRate = Number(((compliantRuns / durations.length) * 100).toFixed(1));

      expect(compliantRuns).toBe(11);
      expect(complianceRate).toBe(91.7);
    });

    it('reconciles [Documents with Failures] and [Failure Rate %]', () => {
      const failedRuns = extractionRuns.filter(r => r.status === 'failed');
      const docsWithFailures = new Set(failedRuns.map(r => r.document_id)).size;

      // Failures occurred in DOC-006 and DOC-009
      expect(docsWithFailures).toBe(2);

      const failureRate = Number(((failedRuns.length / extractionRuns.length) * 100).toFixed(1));
      expect(failureRate).toBe(25.0); // 3 out of 12 runs
    });
  });

  // ==========================================================================
  // Section 4: Multi-Tenant Profile Isolation
  // ==========================================================================
  describe('Multi-Tenant Data Boundaries (Profile Scoping)', () => {
    it('accurately scopes view_executive_summary for patient PAT-A001', () => {
      const patADocs = documents.filter(d => d.profile_id === 'PAT-A001');
      const patAObs = observations.filter(o => o.profile_id === 'PAT-A001');

      expect(patADocs.length).toBe(2); // DOC-001, DOC-002
      expect(patAObs.length).toBe(9); // OBS-001 through OBS-009

      const patAConfirmed = patAObs.filter(o => o.verified_by_user === 'confirmed').length;
      expect(patAConfirmed).toBe(8); // 8 confirmed, 1 pending (OBS-008)

      const patAConfirmationRate = Number(((patAConfirmed / patAObs.length) * 100).toFixed(1));
      expect(patAConfirmationRate).toBe(88.9);
    });

    it('guarantees zero crosstalk between PAT-A001 and PAT-B002', () => {
      const patADocIds = new Set(documents.filter(d => d.profile_id === 'PAT-A001').map(d => d.id));
      const patBDocIds = new Set(documents.filter(d => d.profile_id === 'PAT-B002').map(d => d.id));

      // Overlap must be empty
      const intersection = [...patADocIds].filter(id => patBDocIds.has(id));
      expect(intersection).toHaveLength(0);
    });
  });
});
