import { describe, it, expect } from 'vitest';
import { 
  RawExtractedObservationSchema, 
  ExtractedReportSchema
} from '../schema';
import { 
  canonicalizeTestName, 
  normalizeUnit 
} from '../aliasDictionary';
import { 
  validateExtractedReport, 
  isValidDateFormat 
} from '../validationRules';

describe('1. Zod Schema Validation', () => {
  it('should accept a valid observation with numeric value', () => {
    const validObs = {
      test_name: 'Fasting Glucose',
      value: 95.5,
      unit: 'mg/dL',
      reference_low: 70,
      reference_high: 99,
      observation_date: '2026-03-15',
      reported_flag: 'NORMAL',
      page_number: 1,
    };

    const parsed = RawExtractedObservationSchema.parse(validObs);
    expect(parsed.test_name).toBe('Fasting Glucose');
    expect(parsed.value).toBe(95.5);
    expect(parsed.unit).toBe('mg/dL');
  });

  it('should accept a valid observation with textual value when numeric is null', () => {
    const textualObs = {
      test_name: 'Occult Blood, Stool',
      value: null,
      value_text: 'Negative',
      unit: '',
      observation_date: '2026-03-15',
    };

    const parsed = RawExtractedObservationSchema.parse(textualObs);
    expect(parsed.value).toBeNull();
    expect(parsed.value_text).toBe('Negative');
  });

  it('should reject an observation where both numeric value and textual value are missing', () => {
    const invalidObs = {
      test_name: 'Total Cholesterol',
      value: null,
      value_text: null,
      unit: 'mg/dL',
    };

    expect(() => RawExtractedObservationSchema.parse(invalidObs)).toThrow(
      'Either numeric value or textual value must be provided'
    );
  });

  it('should reject an observation with empty or missing test name', () => {
    const invalidObs = {
      test_name: '',
      value: 120,
      unit: 'mg/dL',
    };

    expect(() => RawExtractedObservationSchema.parse(invalidObs)).toThrow();
  });

  it('should parse an entire lab report payload schema successfully', () => {
    const validReport = {
      document_date: '2026-03-15',
      document_type: 'lab_report',
      patient_name: 'Jane Doe',
      provider_name: 'Quest Diagnostics',
      observations: [
        {
          test_name: 'Fasting Glucose',
          value: 92,
          unit: 'mg/dL',
          reference_low: 70,
          reference_high: 99,
        },
        {
          test_name: 'HbA1c',
          value: 5.4,
          unit: '%',
          reference_low: 4.0,
          reference_high: 5.6,
        },
      ],
    };

    const parsed = ExtractedReportSchema.parse(validReport);
    expect(parsed.observations.length).toBe(2);
    expect(parsed.provider_name).toBe('Quest Diagnostics');
    expect(parsed.observations[0].page_number).toBe(1); // Default applied
  });

  it('should seamlessly normalize document_type variations (e.g., "Laboratory Report", "Lab Report", "laboratory_report")', () => {
    const variations = [
      'Laboratory Report',
      'Lab Report',
      'laboratory_report',
      'LAB_REPORT',
      'lab-report',
      'Clinical Laboratory Report',
    ];

    for (const docType of variations) {
      const parsed = ExtractedReportSchema.parse({
        document_date: '2026-03-15',
        document_type: docType,
        observations: [
          { test_name: 'Fasting Glucose', value: 92, unit: 'mg/dL' },
        ],
      });
      expect(parsed.document_type).toBe('lab_report');
    }

    // Default when omitted or undefined
    const defaulted = ExtractedReportSchema.parse({
      observations: [
        { test_name: 'HbA1c', value: 5.4, unit: '%' },
      ],
    });
    expect(defaulted.document_type).toBe('lab_report');
  });
});

describe('2. Date Format Validation', () => {
  it('should validate standard ISO YYYY-MM-DD date strings', () => {
    expect(isValidDateFormat('2026-03-15')).toBe(true);
    expect(isValidDateFormat('2025-12-31')).toBe(true);
    expect(isValidDateFormat('2024-02-29')).toBe(true); // Leap year
  });

  it('should reject invalid or non-ISO date formats', () => {
    expect(isValidDateFormat('15/03/2026')).toBe(false);
    expect(isValidDateFormat('03-15-2026')).toBe(false);
    expect(isValidDateFormat('March 15, 2026')).toBe(false);
    expect(isValidDateFormat('2026-13-01')).toBe(false); // Invalid month
    expect(isValidDateFormat('')).toBe(false);
    expect(isValidDateFormat(null)).toBe(false);
    expect(isValidDateFormat(undefined)).toBe(false);
  });

  it('should flag malformed dates and fallback to document date during validation', () => {
    const rawReport = ExtractedReportSchema.parse({
      document_date: '2026-03-15',
      document_type: 'lab_report',
      observations: [
        {
          test_name: 'Creatinine',
          value: 0.9,
          unit: 'mg/dL',
          observation_date: '03/15/2026', // Non-standard format
          page_number: 1,
        },
      ],
    });

    const result = validateExtractedReport(
      rawReport,
      'doc-test-1',
      'run-test-1',
      'prof-test-1',
      'test_report.pdf',
      '2026-03-15'
    );

    const dateIssue = result.validationIssues.find(i => i.issueType === 'invalid_date');
    expect(dateIssue).toBeDefined();
    expect(dateIssue?.severity).toBe('error');
    expect(result.validatedObservations[0].observationDate).toBe('2026-03-15');
  });
});

describe('3. Clinical Alias Dictionary & LOINC Mapping', () => {
  it('should canonicalize synonyms to standardized clinical names and LOINC codes', () => {
    // Fasting Glucose
    const glucoseMapping = canonicalizeTestName('FBS');
    expect(glucoseMapping.canonicalName).toBe('Fasting Glucose');
    expect(glucoseMapping.loincCode).toBe('1558-6');
    expect(glucoseMapping.isMapped).toBe(true);

    const glucoseAlias2 = canonicalizeTestName('glucose, fasting (serum)');
    expect(glucoseAlias2.canonicalName).toBe('Fasting Glucose');

    // HbA1c
    const a1cMapping = canonicalizeTestName('Hemoglobin A1c');
    expect(a1cMapping.canonicalName).toBe('HbA1c');
    expect(a1cMapping.loincCode).toBe('4548-4');
    expect(a1cMapping.isMapped).toBe(true);

    // WBC
    const wbcMapping = canonicalizeTestName('wbc count');
    expect(wbcMapping.canonicalName).toBe('White Blood Cell Count');
    expect(wbcMapping.loincCode).toBe('6690-2');

    // Platelets
    const pltMapping = canonicalizeTestName('plt');
    expect(pltMapping.canonicalName).toBe('Platelet Count');
    expect(pltMapping.loincCode).toBe('777-3');

    // Creatinine
    const creatMapping = canonicalizeTestName('serum creatinine');
    expect(creatMapping.canonicalName).toBe('Creatinine');
    expect(creatMapping.loincCode).toBe('2160-0');

    // TSH
    const tshMapping = canonicalizeTestName('thyrotropin');
    expect(tshMapping.canonicalName).toBe('TSH');
    expect(tshMapping.loincCode).toBe('3016-3');
  });

  it('should safely retain unmapped tests without hallucinating false LOINC codes', () => {
    const unmapped = canonicalizeTestName('Novel Biomarker XYZ-99');
    expect(unmapped.canonicalName).toBe('Novel Biomarker XYZ-99');
    expect(unmapped.loincCode).toBeNull();
    expect(unmapped.standardUnit).toBeNull();
    expect(unmapped.isMapped).toBe(false);
  });
});

describe('4. Unit Normalization', () => {
  it('should normalize casing and spelling variations of standard units', () => {
    expect(normalizeUnit('mg/dl')).toBe('mg/dL');
    expect(normalizeUnit('MG/DL')).toBe('mg/dL');
    expect(normalizeUnit('g/dl')).toBe('g/dL');
    expect(normalizeUnit('miu/l')).toBe('mIU/L');
    expect(normalizeUnit('uiu/ml')).toBe('uIU/mL');
    expect(normalizeUnit('k/ul')).toBe('x10^3/uL');
    expect(normalizeUnit('K/uL')).toBe('x10^3/uL');
    expect(normalizeUnit('percent')).toBe('%');
    expect(normalizeUnit('mmol/l')).toBe('mmol/L');
  });

  it('should return null for empty or undefined units and preserve unrecognized units safely', () => {
    expect(normalizeUnit(null)).toBeNull();
    expect(normalizeUnit('')).toBeNull();
    expect(normalizeUnit('   ')).toBeNull();
    expect(normalizeUnit('copies/mL')).toBe('copies/mL');
  });
});

describe('5. Missing Unit Detection', () => {
  it('should flag a warning when a test with standard expected unit has missing unit', () => {
    const rawReport = ExtractedReportSchema.parse({
      document_date: '2026-03-15',
      document_type: 'lab_report',
      observations: [
        {
          test_name: 'Fasting Glucose',
          value: 95,
          unit: '', // Missing unit
          observation_date: '2026-03-15',
        },
      ],
    });

    const result = validateExtractedReport(
      rawReport,
      'doc-test-2',
      'run-test-2',
      'prof-test-1',
      'test_report.pdf',
      '2026-03-15'
    );

    const unitIssue = result.validationIssues.find(i => i.issueType === 'missing_unit');
    expect(unitIssue).toBeDefined();
    expect(unitIssue?.severity).toBe('warning');
    expect(unitIssue?.message).toContain('Expected standard unit is "mg/dL"');
    expect(result.overallStatus).toBe('review_required');
  });
});

describe('6. Duplicate Observation Detection', () => {
  it('should detect duplicate observations on the same specimen date', () => {
    const rawReport = ExtractedReportSchema.parse({
      document_date: '2026-03-15',
      document_type: 'lab_report',
      observations: [
        {
          test_name: 'Total Cholesterol',
          value: 195,
          unit: 'mg/dL',
          observation_date: '2026-03-15',
        },
        {
          test_name: 'Total Cholesterol', // Duplicate on same date
          value: 198,
          unit: 'mg/dL',
          observation_date: '2026-03-15',
        },
      ],
    });

    const result = validateExtractedReport(
      rawReport,
      'doc-test-3',
      'run-test-3',
      'prof-test-1',
      'test_report.pdf',
      '2026-03-15'
    );

    const dupIssue = result.validationIssues.find(i => i.issueType === 'duplicate_observation');
    expect(dupIssue).toBeDefined();
    expect(dupIssue?.severity).toBe('warning');
    expect(dupIssue?.message).toContain('Duplicate entry detected: "Total Cholesterol"');
    expect(result.overallStatus).toBe('review_required');
  });

  it('should not flag duplicates when tests are distinct or recorded on different dates', () => {
    const rawReport = ExtractedReportSchema.parse({
      document_date: '2026-03-15',
      document_type: 'lab_report',
      observations: [
        {
          test_name: 'Total Cholesterol',
          value: 195,
          unit: 'mg/dL',
          observation_date: '2026-03-15',
        },
        {
          test_name: 'HDL Cholesterol',
          value: 52,
          unit: 'mg/dL',
          observation_date: '2026-03-15',
        },
      ],
    });

    const result = validateExtractedReport(
      rawReport,
      'doc-test-4',
      'run-test-4',
      'prof-test-1',
      'test_report.pdf',
      '2026-03-15'
    );

    const dupIssue = result.validationIssues.find(i => i.issueType === 'duplicate_observation');
    expect(dupIssue).toBeUndefined();
  });
});

describe('7. Physiological Plausibility Bounds Warnings', () => {
  it('should flag an implausible bound warning for extreme values', () => {
    // Platelet count 850 K/uL (review max is 750)
    const rawReport = ExtractedReportSchema.parse({
      document_date: '2026-03-15',
      document_type: 'lab_report',
      observations: [
        {
          test_name: 'Platelet Count',
          value: 850,
          unit: 'x10^3/uL',
          observation_date: '2026-03-15',
        },
      ],
    });

    const result = validateExtractedReport(
      rawReport,
      'doc-test-5',
      'run-test-5',
      'prof-test-1',
      'test_report.pdf',
      '2026-03-15'
    );

    const boundsIssue = result.validationIssues.find(i => i.issueType === 'implausible_bounds');
    expect(boundsIssue).toBeDefined();
    expect(boundsIssue?.severity).toBe('warning');
    expect(boundsIssue?.message).toContain('Platelet Count reading 850');
    expect(boundsIssue?.message).toContain('outside broad normal expectation');
  });

  it('should flag an implausible bound warning for extreme low values', () => {
    // Fasting Glucose 28 mg/dL (review min is 40)
    const rawReport = ExtractedReportSchema.parse({
      document_date: '2026-03-15',
      document_type: 'lab_report',
      observations: [
        {
          test_name: 'Fasting Glucose',
          value: 28,
          unit: 'mg/dL',
          observation_date: '2026-03-15',
        },
      ],
    });

    const result = validateExtractedReport(
      rawReport,
      'doc-test-6',
      'run-test-6',
      'prof-test-1',
      'test_report.pdf',
      '2026-03-15'
    );

    const boundsIssue = result.validationIssues.find(i => i.issueType === 'implausible_bounds');
    expect(boundsIssue).toBeDefined();
    expect(boundsIssue?.severity).toBe('warning');
  });

  it('should pass cleanly without bounds warning for physiologically plausible values', () => {
    const rawReport = ExtractedReportSchema.parse({
      document_date: '2026-03-15',
      document_type: 'lab_report',
      observations: [
        {
          test_name: 'Fasting Glucose',
          value: 92,
          unit: 'mg/dL',
          observation_date: '2026-03-15',
        },
        {
          test_name: 'HbA1c',
          value: 5.4,
          unit: '%',
          observation_date: '2026-03-15',
        },
      ],
    });

    const result = validateExtractedReport(
      rawReport,
      'doc-test-7',
      'run-test-7',
      'prof-test-1',
      'test_report.pdf',
      '2026-03-15'
    );

    const boundsIssue = result.validationIssues.find(i => i.issueType === 'implausible_bounds');
    expect(boundsIssue).toBeUndefined();
    expect(result.validationIssues.length).toBe(0);
    expect(result.overallStatus).toBe('completed');
  });
});

describe('8. Traceability and Human-in-the-Loop Safeguards', () => {
  it('should initialize verifiedByUser as pending and preserve source traceability', () => {
    const rawReport = ExtractedReportSchema.parse({
      document_date: '2026-03-15',
      document_type: 'lab_report',
      observations: [
        {
          test_name: 'Creatinine',
          value: 1.1,
          unit: 'mg/dL',
          observation_date: '2026-03-15',
        },
      ],
    });

    const result = validateExtractedReport(
      rawReport,
      'doc-trace-1',
      'run-trace-1',
      'prof-trace-1',
      'LabCorp_CMP_March2026.pdf',
      '2026-03-15'
    );

    const obs = result.validatedObservations[0];
    // Safeguard: AI output is NEVER auto-verified
    expect(obs.verifiedByUser).toBe('pending');
    expect(obs.userCorrected).toBe(false);
    expect(obs.sourceDocumentName).toBe('LabCorp_CMP_March2026.pdf');
    expect(obs.extractionRunId).toBe('run-trace-1');
    expect(obs.documentId).toBe('doc-trace-1');
  });

  it('should flag an error issue when an observation is missing test name', () => {
    // When bypassed directly into validator engine
    const rawReport = {
      document_date: '2026-03-15',
      document_type: 'lab_report' as const,
      observations: [
        {
          test_name: '',
          value: 5.5,
          value_text: null,
          unit: 'mmol/L',
          reference_low: null,
          reference_high: null,
          observation_date: '2026-03-15',
          reported_flag: null,
          page_number: 1,
        },
      ],
    };

    const result = validateExtractedReport(
      rawReport,
      'doc-trace-2',
      'run-trace-2',
      'prof-trace-1',
      'LabCorp_CMP_March2026.pdf',
      '2026-03-15'
    );

    const nameIssue = result.validationIssues.find(i => i.issueType === 'missing_test_name');
    expect(nameIssue).toBeDefined();
    expect(nameIssue?.severity).toBe('error');
    expect(result.overallStatus).toBe('review_required');
  });

  it('should flag an error issue when an observation has missing value', () => {
    // When bypassed directly into validator engine
    const rawReport = {
      document_date: '2026-03-15',
      document_type: 'lab_report' as const,
      observations: [
        {
          test_name: 'Serum Sodium',
          value: null,
          value_text: '',
          unit: 'mEq/L',
          reference_low: null,
          reference_high: null,
          observation_date: '2026-03-15',
          reported_flag: null,
          page_number: 1,
        },
      ],
    };

    const result = validateExtractedReport(
      rawReport,
      'doc-trace-3',
      'run-trace-3',
      'prof-trace-1',
      'LabCorp_CMP_March2026.pdf',
      '2026-03-15'
    );

    const valIssue = result.validationIssues.find(i => i.issueType === 'missing_value');
    expect(valIssue).toBeDefined();
    expect(valIssue?.severity).toBe('error');
  });

  it('should flag multiple issues when an observation has both missing unit and extreme bounds', () => {
    const rawReport = ExtractedReportSchema.parse({
      document_date: '2026-03-15',
      document_type: 'lab_report',
      observations: [
        {
          test_name: 'Fasting Glucose',
          value: 550, // Out of bounds (> 400)
          unit: '', // Missing unit
          observation_date: '2026-03-15',
        },
      ],
    });

    const result = validateExtractedReport(
      rawReport,
      'doc-trace-4',
      'run-trace-4',
      'prof-trace-1',
      'LabCorp_CMP_March2026.pdf',
      '2026-03-15'
    );

    expect(result.validationIssues.length).toBe(2);
    expect(result.validationIssues.some(i => i.issueType === 'missing_unit')).toBe(true);
    expect(result.validationIssues.some(i => i.issueType === 'implausible_bounds')).toBe(true);
    expect(result.overallStatus).toBe('review_required');
  });
});
