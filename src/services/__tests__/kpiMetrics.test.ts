import { describe, it, expect } from 'vitest';
import { 
  calculatePipelineKPIs, 
  calculatePercentile, 
  filterByTimeRange 
} from '../kpiMetrics';
import type { LabDocument } from '../../types';
import { 
  INITIAL_DOCUMENTS, 
  INITIAL_EXTRACTION_RUNS, 
  INITIAL_OBSERVATIONS, 
  INITIAL_VALIDATION_ISSUES 
} from '../../test/fixtures/benchmarkFixtures';

describe('KPI Metrics Telemetry & Deterministic Mathematical Formulas', () => {
  describe('calculatePercentile', () => {
    it('returns null for an empty array', () => {
      expect(calculatePercentile([], 50)).toBeNull();
      expect(calculatePercentile([], 95)).toBeNull();
    });

    it('returns the single element for a 1-item array', () => {
      expect(calculatePercentile([1500], 50)).toBe(1500);
      expect(calculatePercentile([1500], 95)).toBe(1500);
    });

    it('calculates accurate median (p50) and 95th percentile (p95)', () => {
      // 5 ordered latencies in ms: [1000, 1200, 1500, 2000, 3000]
      const latencies = [1000, 1200, 1500, 2000, 3000];
      const p50 = calculatePercentile(latencies, 50);
      expect(p50).toBe(1500);

      const p95 = calculatePercentile(latencies, 95);
      expect(p95).toBeGreaterThanOrEqual(2000);
      expect(p95).toBeLessThanOrEqual(3000);
    });
  });

  describe('filterByTimeRange', () => {
    const nowMs = new Date('2026-03-20T12:00:00Z').getTime();

    const sampleItems = [
      { id: '1', date: '2026-03-20T10:00:00Z' }, // 2h ago
      { id: '2', date: '2026-03-18T12:00:00Z' }, // 2d ago
      { id: '3', date: '2026-03-01T12:00:00Z' }, // 19d ago
      { id: '4', date: '2025-12-01T12:00:00Z' }, // ~110d ago
    ];

    it('returns all items when range is "all"', () => {
      const result = filterByTimeRange(sampleItems, 'all', item => item.date, nowMs);
      expect(result).toHaveLength(4);
    });

    it('filters correctly for 24h window', () => {
      const result = filterByTimeRange(sampleItems, '24h', item => item.date, nowMs);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('filters correctly for 7d window', () => {
      const result = filterByTimeRange(sampleItems, '7d', item => item.date, nowMs);
      expect(result).toHaveLength(2);
      expect(result.map(r => r.id)).toEqual(['1', '2']);
    });

    it('filters correctly for 30d window', () => {
      const result = filterByTimeRange(sampleItems, '30d', item => item.date, nowMs);
      expect(result).toHaveLength(3);
      expect(result.map(r => r.id)).toEqual(['1', '2', '3']);
    });

    it('ignores items with missing or invalid date strings', () => {
      const mixedItems = [
        { id: 'valid', date: '2026-03-20T10:00:00Z' },
        { id: 'empty', date: '' },
        { id: 'invalid', date: 'not-a-date' },
        { id: 'null', date: null },
      ];
      const result = filterByTimeRange(mixedItems, '24h', item => item.date as any, nowMs);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid');
    });
  });

  describe('Zero-Denominator Safety & Null Handling', () => {
    it('returns null rates instead of NaN, Infinity, or 0% when sets are empty', () => {
      const kpis = calculatePipelineKPIs([], [], [], []);

      expect(kpis.totalDocuments).toBe(0);
      expect(kpis.documentSuccessRate).toBeNull();

      expect(kpis.totalRuns).toBe(0);
      expect(kpis.extractionSuccessRate).toBeNull();

      expect(kpis.totalObservations).toBe(0);
      expect(kpis.validationPassRate).toBeNull();
      expect(kpis.verifiedObservationRate).toBeNull();
      expect(kpis.fieldCompletenessRate).toBeNull();
      expect(kpis.missingFieldRate).toBeNull();

      expect(kpis.avgDurationMs).toBeNull();
      expect(kpis.p50DurationMs).toBeNull();
      expect(kpis.p95DurationMs).toBeNull();

      expect(kpis.duplicateCount).toBe(0);
      expect(kpis.openIssuesCount).toBe(0);
    });

    it('returns null documentSuccessRate when documents exist but none are terminal', () => {
      const inFlightDocs: LabDocument[] = [
        {
          id: '00000000-0000-0000-0000-000000000001',
          profileId: '00000000-0000-0000-0000-000000000001',
          originalFilename: 'test.pdf',
          storagePath: 'vault/test.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 1024,
          checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          documentType: 'lab_report',
          documentDate: '2026-03-01',
          processingStatus: 'review_required', // non-terminal
          processingError: null,
          createdAt: '2026-03-01T00:00:00Z',
          updatedAt: '2026-03-01T00:00:00Z',
        }
      ];

      const kpis = calculatePipelineKPIs(inFlightDocs, [], [], []);
      expect(kpis.totalDocuments).toBe(1);
      expect(kpis.reviewRequiredDocuments).toBe(1);
      expect(kpis.terminalDocuments).toBe(0);
      expect(kpis.documentSuccessRate).toBeNull();
    });
  });

  describe('Deterministic Metrics on Synthetic Benchmark Data', () => {
    it('verifies exact benchmark calculations matching analytical SQL definitions', () => {
      const kpis = calculatePipelineKPIs(
        INITIAL_DOCUMENTS,
        INITIAL_EXTRACTION_RUNS,
        INITIAL_OBSERVATIONS,
        INITIAL_VALIDATION_ISSUES
      );

      // 1. Documents: 5 total, 3 completed, 1 review_required, 1 failed
      expect(kpis.totalDocuments).toBe(5);
      expect(kpis.completedDocuments).toBe(3);
      expect(kpis.reviewRequiredDocuments).toBe(1);
      expect(kpis.failedDocuments).toBe(1);
      expect(kpis.terminalDocuments).toBe(4);
      // Terminal success rate: (3 / 4) * 100 = 75.0%
      expect(kpis.documentSuccessRate).toBe(75.0);

      // 2. Extraction Runs: 5 total, 4 completed, 1 failed
      expect(kpis.totalRuns).toBe(5);
      expect(kpis.completedRuns).toBe(4);
      expect(kpis.failedRuns).toBe(1);
      expect(kpis.terminalRuns).toBe(5);
      // Run success rate: (4 / 5) * 100 = 80.0%
      expect(kpis.extractionSuccessRate).toBe(80.0);

      // 3. Observations: 19 total
      expect(kpis.totalObservations).toBe(19);
      // 16 valid, 3 warning (obs-009 missing unit, obs-010 out of bounds, obs-011 duplicate)
      expect(kpis.validObservations).toBe(16);
      expect(kpis.warningObservations).toBe(3);
      expect(kpis.errorObservations).toBe(0);
      // Pass rate: (16 / 19) * 100 = 84.2%
      expect(kpis.validationPassRate).toBe(84.2);

      // 4. Human Verification: 15 confirmed, 4 pending
      expect(kpis.confirmedObservations).toBe(15);
      expect(kpis.pendingObservations).toBe(4);
      // Human verification rate: (15 / 19) * 100 = 78.9%
      expect(kpis.verifiedObservationRate).toBe(78.9);

      // 5. Duplicate Collisions: 1 duplicate entry flagged
      expect(kpis.duplicateCount).toBe(1);

      // 6. Latency Percentiles on completed runs (durations: 1820, 1980, 2450, 3100)
      expect(kpis.avgDurationMs).toBe(2338);
      expect(kpis.p50DurationMs).toBe(2215);
      expect(kpis.p95DurationMs).toBe(3003);

      // 7. Validation Issues breakdown
      expect(kpis.openIssuesCount).toBe(4);
      expect(kpis.criticalIssuesCount).toBe(1);
      expect(kpis.warningIssuesCount).toBe(3);
      expect(kpis.issuesByCategory['missing_unit']).toBe(1);
      expect(kpis.issuesByCategory['duplicate_observation']).toBe(1);
      expect(kpis.issuesByCategory['implausible_bounds']).toBe(1);
      expect(kpis.issuesByCategory['unmapped_test']).toBe(1);
    });
  });
});
