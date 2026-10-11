import { describe, it, expect } from 'vitest';
import { generateUUID, isValidUUID } from '../../lib/uuid';
import { canonicalizeTestName, normalizeUnit } from '../aliasDictionary';
import { validateExtractedReport } from '../validationRules';
import { type ExtractedReport, tryRepairTruncatedJson } from '../schema';

describe('Extraction Pipeline Lifecycle & Deterministic Validation Rules', () => {
  describe('RFC-4122 UUID v4 Compliance', () => {
    it('generates valid RFC-4122 v4 UUIDs', () => {
      const id1 = generateUUID();
      const id2 = generateUUID();

      expect(id1).not.toBe(id2);
      expect(isValidUUID(id1)).toBe(true);
      expect(isValidUUID(id2)).toBe(true);

      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id1).toMatch(uuidV4Regex);
      expect(id2).toMatch(uuidV4Regex);
    });

    it('rejects legacy non-UUID identifiers', () => {
      expect(isValidUUID('doc-1710928392019')).toBe(false);
      expect(isValidUUID('run-1710928392019')).toBe(false);
      expect(isValidUUID('obs-001')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('12345')).toBe(false);
      expect(isValidUUID('not-a-uuid')).toBe(false);
    });
  });

  describe('Alias Dictionary & Unit Normalization', () => {
    it('maps diverse raw lab test names to canonical standards', () => {
      expect(canonicalizeTestName('glucose, fasting, plasma').canonicalName).toBe('Fasting Glucose');
      expect(canonicalizeTestName('Blood Sugar Fasting').canonicalName).toBe('Fasting Glucose');
      expect(canonicalizeTestName('FBS').canonicalName).toBe('Fasting Glucose');
      expect(canonicalizeTestName('FBS').isMapped).toBe(true);
      expect(canonicalizeTestName('Glycated Hemoglobin').canonicalName).toBe('HbA1c');
      expect(canonicalizeTestName('A1C').canonicalName).toBe('HbA1c');
      expect(canonicalizeTestName('Serum Cholesterol').canonicalName).toBe('Total Cholesterol');
      expect(canonicalizeTestName('HDL-C').canonicalName).toBe('HDL Cholesterol');
      expect(canonicalizeTestName('LDL-C, Calculated').canonicalName).toBe('LDL Cholesterol');
    });

    it('preserves unmapped tests cleanly for human review', () => {
      const rawName = 'Novel Experimental Biomarker XYZ';
      const result = canonicalizeTestName(rawName);
      expect(result.canonicalName).toBe(rawName);
      expect(result.isMapped).toBe(false);
      expect(result.loincCode).toBeNull();
    });

    it('normalizes common clinical unit casing variations', () => {
      expect(normalizeUnit('MG/DL')).toBe('mg/dL');
      expect(normalizeUnit('mg/dl')).toBe('mg/dL');
      expect(normalizeUnit('MMOL/L')).toBe('mmol/L');
      expect(normalizeUnit('mmol/l')).toBe('mmol/L');
      expect(normalizeUnit('G/DL')).toBe('g/dL');
      expect(normalizeUnit('percent')).toBe('%');
      expect(normalizeUnit('k/ul')).toBe('x10^3/uL');
      expect(normalizeUnit('')).toBeNull();
      expect(normalizeUnit(null)).toBeNull();
    });
  });

  describe('Document Status Lifecycle derived from Validation', () => {
    const docId = generateUUID();
    const runId = generateUUID();
    const profileId = generateUUID();

    it('sets document status to "completed" when all observations are valid without issues', () => {
      const report: ExtractedReport = {
        document_type: 'lab_report',
        document_date: '2026-03-15',
        patient_name: 'Alex Morgan',
        provider_name: 'Quest Diagnostics',
        observations: [
          {
            test_name: 'Fasting Glucose',
            value: 92,
            unit: 'mg/dL',
            reference_low: 70,
            reference_high: 99,
            observation_date: '2026-03-15',
            page_number: 1,
          },
          {
            test_name: 'Hemoglobin A1c',
            value: 5.4,
            unit: '%',
            reference_low: 4.0,
            reference_high: 5.6,
            observation_date: '2026-03-15',
            page_number: 1,
          }
        ],
      };

      const result = validateExtractedReport(report, docId, runId, profileId, 'clean_panel.pdf', '2026-03-15');
      expect(result.overallStatus).toBe('completed');
      expect(result.validationIssues).toHaveLength(0);
      expect(result.validatedObservations).toHaveLength(2);
      expect(result.validatedObservations.every(o => o.validationStatus === 'valid')).toBe(true);
    });

    it('sets document status to "review_required" when warnings or anomalies exist', () => {
      const reportWithWarnings: ExtractedReport = {
        document_type: 'lab_report',
        document_date: '2026-03-15',
        patient_name: 'Alex Morgan',
        provider_name: 'Quest Diagnostics',
        observations: [
          {
            test_name: 'Fasting Glucose',
            value: 92,
            unit: '', // Missing unit triggers warning
            reference_low: 70,
            reference_high: 99,
            observation_date: '2026-03-15',
            page_number: 1,
          },
          {
            test_name: 'Total Cholesterol',
            value: 750, // Implausible bounds trigger warning
            unit: 'mg/dL',
            reference_low: 100,
            reference_high: 200,
            observation_date: '2026-03-15',
            page_number: 1,
          }
        ],
      };

      const result = validateExtractedReport(reportWithWarnings, docId, runId, profileId, 'anomalous_panel.pdf', '2026-03-15');
      expect(result.overallStatus).toBe('review_required');
      expect(result.validationIssues.length).toBeGreaterThan(0);
      expect(result.validatedObservations.some(o => o.validationStatus === 'warning')).toBe(true);
    });
  });

  describe('Truncated AI JSON Recovery', () => {
    it('gracefully recovers all completed observations when output is cut off mid-stream', () => {
      const truncatedRawOutput = `{
  "document_type": "Laboratory Report",
  "observations": [
    {
      "test_name": "Creatinine",
      "observation_date": "2023-11-07",
      "page_number": 1,
      "reference_high": 1.3,
      "reference_low": 0.7,
      "reported_flag": "NORMAL",
      "unit": "mg/dL",
      "value": 1.0,
      "value_text": "1.00"
    },
    {
      "test_name": "GFR Estimated",
      "observation_date": "2023-11-07",
      "page_number": 1,
      "reference_high": 999.0,
      "reference_low": 59.0,
      "reported_flag": "NORMAL",
      "unit": "mL/min/1.73m2",
      "value": 107.0,
      "value_text": "107"
    },
    {
      "test_name": "TSH",
      "observation_date": "2023-11-07",
      "page_number": 4,
      "reference_high": 4.78,
      "reference_low": 0.55,
      "reported_flag": "NORMAL",
      "unit": "µIU/mL",
      "value": 3.0,
      "value_text": "3.00"
    },
    {
      "test_name": "HbA1c",
      "observation_date": "2023-11-07",
      "page_number": 5,
      "reference_high": 5.6,
      "reference_low": 4.0,
      "reported`;

      // Direct JSON.parse fails as expected
      expect(() => JSON.parse(truncatedRawOutput)).toThrow();

      // Truncation repair rescues the completed observations
      const repaired = tryRepairTruncatedJson(truncatedRawOutput);
      expect(repaired).not.toBeNull();
      expect(repaired?.observations).toHaveLength(3);
      expect(repaired?.observations[0].test_name).toBe('Creatinine');
      expect(repaired?.observations[1].test_name).toBe('GFR Estimated');
      expect(repaired?.observations[2].test_name).toBe('TSH');
    });

    it('returns null if no observations can be salvaged', () => {
      expect(tryRepairTruncatedJson('not a json string')).toBeNull();
      expect(tryRepairTruncatedJson('{"document_type": "lab_report"}')).toBeNull();
    });
  });
});
