import type { 
  RawExtractedObservation, 
  ExtractedReport 
} from './schema';
import { 
  canonicalizeTestName, 
  normalizeUnit, 
  CANONICAL_TEST_DEFINITIONS 
} from './aliasDictionary';
import type { 
  Observation, 
  ValidationIssue, 
  ValidationStatus
} from '../types';
import { generateUUID } from '../lib/uuid';

/**
 * Broad physiological plausibility bounds.
 * Values outside these thresholds trigger warnings for manual clinician/user review.
 * They represent biological extremes, not proof of error.
 */
export interface PlausibilityBound {
  minReview: number;
  maxReview: number;
  absoluteMin: number;
  absoluteMax: number;
  unit: string;
}

export const PLAUSIBILITY_BOUNDS: Record<string, PlausibilityBound> = {
  'Fasting Glucose': { minReview: 40, maxReview: 400, absoluteMin: 10, absoluteMax: 1500, unit: 'mg/dL' },
  'HbA1c': { minReview: 3.5, maxReview: 15.0, absoluteMin: 2.0, absoluteMax: 25.0, unit: '%' },
  'Hemoglobin': { minReview: 6.0, maxReview: 20.0, absoluteMin: 2.0, absoluteMax: 30.0, unit: 'g/dL' },
  'White Blood Cell Count': { minReview: 1.0, maxReview: 50.0, absoluteMin: 0.1, absoluteMax: 250.0, unit: 'x10^3/uL' },
  'Platelet Count': { minReview: 50, maxReview: 750, absoluteMin: 5, absoluteMax: 3000, unit: 'x10^3/uL' },
  'Creatinine': { minReview: 0.2, maxReview: 6.0, absoluteMin: 0.05, absoluteMax: 30.0, unit: 'mg/dL' },
  'Total Cholesterol': { minReview: 70, maxReview: 450, absoluteMin: 30, absoluteMax: 1000, unit: 'mg/dL' },
  'LDL Cholesterol': { minReview: 20, maxReview: 350, absoluteMin: 5, absoluteMax: 800, unit: 'mg/dL' },
  'HDL Cholesterol': { minReview: 15, maxReview: 120, absoluteMin: 2, absoluteMax: 250, unit: 'mg/dL' },
  'Triglycerides': { minReview: 25, maxReview: 800, absoluteMin: 10, absoluteMax: 5000, unit: 'mg/dL' },
  'TSH': { minReview: 0.05, maxReview: 20.0, absoluteMin: 0.001, absoluteMax: 300.0, unit: 'mIU/L' },
};

/**
 * Validates date string conforms to YYYY-MM-DD
 */
export function isValidDateFormat(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const regex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (!regex.test(dateStr)) return false;
  const d = new Date(dateStr + 'T00:00:00');
  return !isNaN(d.getTime());
}

export interface ValidationOutput {
  validatedObservations: Observation[];
  validationIssues: ValidationIssue[];
  overallStatus: 'completed' | 'review_required' | 'failed';
}

/**
 * Deterministic Clinical Validation Engine
 * Evaluates an extracted report against clinical rules, unit checks, duplicate scans, and plausibility bounds.
 */
export function validateExtractedReport(
  rawReport: ExtractedReport,
  documentId: string,
  extractionRunId: string,
  profileId: string,
  sourceDocumentName: string,
  fallbackDate: string
): ValidationOutput {
  const issues: ValidationIssue[] = [];
  const validatedObservations: Observation[] = [];

  const defaultDate = isValidDateFormat(rawReport.document_date)
    ? (rawReport.document_date as string)
    : fallbackDate;

  // Track occurrences within this document to flag duplicate measurements on the same date
  const testDateMap = new Map<string, number>();

  rawReport.observations.forEach((rawObs: RawExtractedObservation, index: number) => {
    const obsId = generateUUID();
    let obsValidationStatus: ValidationStatus = 'valid';

    // 1. Check Missing Test Name
    if (!rawObs.test_name || rawObs.test_name.trim().length === 0) {
      issues.push({
        id: generateUUID(),
        documentId,
        extractionRunId,
        observationId: obsId,
        issueType: 'missing_test_name',
        severity: 'error',
        message: `Row ${index + 1}: Observation is missing a test or analyte name.`,
        resolved: false,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      });
      obsValidationStatus = 'error';
    }

    // 2. Canonicalization
    const canonicalInfo = canonicalizeTestName(rawObs.test_name);
    const normalizedUnitValue = normalizeUnit(rawObs.unit);

    // 3. Check Observation Date
    let obsDate = rawObs.observation_date;
    if (!isValidDateFormat(obsDate)) {
      if (rawObs.observation_date) {
        // Provided date was malformed
        issues.push({
          id: generateUUID(),
          documentId,
          extractionRunId,
          observationId: obsId,
          issueType: 'invalid_date',
          severity: 'error',
          message: `Observation "${rawObs.test_name}" has unparseable date format ("${rawObs.observation_date}"). Falling back to document date (${defaultDate}).`,
          resolved: false,
          createdAt: new Date().toISOString(),
          resolvedAt: null,
          observationTestName: canonicalInfo.canonicalName,
        });
        obsValidationStatus = obsValidationStatus === 'error' ? 'error' : 'warning';
      }
      obsDate = defaultDate;
    }

    // 4. Check Missing Value
    if (rawObs.value === null && (!rawObs.value_text || rawObs.value_text.trim() === '')) {
      issues.push({
        id: generateUUID(),
        documentId,
        extractionRunId,
        observationId: obsId,
        issueType: 'missing_value',
        severity: 'error',
        message: `Missing result value for "${rawObs.test_name}". No numeric or textual measurement transcribed.`,
        resolved: false,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        observationTestName: canonicalInfo.canonicalName,
      });
      obsValidationStatus = 'error';
    }

    // 5. Check Missing Unit when expected
    const canonicalDef = CANONICAL_TEST_DEFINITIONS.find(d => d.canonicalName === canonicalInfo.canonicalName);
    if (canonicalDef && canonicalDef.standardUnit && (!rawObs.unit || rawObs.unit.trim() === '')) {
      issues.push({
        id: generateUUID(),
        documentId,
        extractionRunId,
        observationId: obsId,
        issueType: 'missing_unit',
        severity: 'warning',
        message: `Missing unit for "${canonicalInfo.canonicalName}". Expected standard unit is "${canonicalDef.standardUnit}".`,
        resolved: false,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        observationTestName: canonicalInfo.canonicalName,
      });
      obsValidationStatus = obsValidationStatus === 'error' ? 'error' : 'warning';
    }

    // 6. Check Duplicate Observation within this document on the same date
    const duplicateKey = `${canonicalInfo.canonicalName.toLowerCase()}_${obsDate}`;
    const previousOccurrences = testDateMap.get(duplicateKey) || 0;
    testDateMap.set(duplicateKey, previousOccurrences + 1);

    if (previousOccurrences > 0) {
      issues.push({
        id: generateUUID(),
        documentId,
        extractionRunId,
        observationId: obsId,
        issueType: 'duplicate_observation',
        severity: 'warning',
        message: `Duplicate entry detected: "${canonicalInfo.canonicalName}" was extracted multiple times on specimen date ${obsDate}.`,
        resolved: false,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        observationTestName: canonicalInfo.canonicalName,
      });
      obsValidationStatus = obsValidationStatus === 'error' ? 'error' : 'warning';
    }

    // 7. Check Plausibility Bounds
    if (rawObs.value !== null && rawObs.value !== undefined) {
      const bounds = PLAUSIBILITY_BOUNDS[canonicalInfo.canonicalName];
      if (bounds) {
        if (rawObs.value < bounds.minReview || rawObs.value > bounds.maxReview) {
          issues.push({
            id: generateUUID(),
            documentId,
            extractionRunId,
            observationId: obsId,
            issueType: 'implausible_bounds',
            severity: 'warning',
            message: `Plausibility bound review: ${canonicalInfo.canonicalName} reading ${rawObs.value} ${rawObs.unit || bounds.unit} is outside broad normal expectation (${bounds.minReview} - ${bounds.maxReview} ${bounds.unit}). Please verify transcription.`,
            resolved: false,
            createdAt: new Date().toISOString(),
            resolvedAt: null,
            observationTestName: canonicalInfo.canonicalName,
          });
          obsValidationStatus = obsValidationStatus === 'error' ? 'error' : 'warning';
        }
      }
    }

    // Create normalized Observation record
    validatedObservations.push({
      id: obsId,
      profileId,
      documentId,
      extractionRunId,
      rawTestName: rawObs.test_name,
      canonicalTestName: canonicalInfo.canonicalName,
      loincCode: canonicalInfo.loincCode,
      valueNumeric: rawObs.value !== undefined ? rawObs.value : null,
      valueText: rawObs.value_text || null,
      originalUnit: rawObs.unit || '',
      normalizedUnit: normalizedUnitValue,
      referenceLow: rawObs.reference_low !== undefined ? rawObs.reference_low : null,
      referenceHigh: rawObs.reference_high !== undefined ? rawObs.reference_high : null,
      observationDate: obsDate as string,
      validationStatus: obsValidationStatus,
      verifiedByUser: 'pending', // Never automatically mark uncertain extractions as verified
      userCorrected: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceDocumentName,
      pageNumber: rawObs.page_number ?? 1,
    });
  });

  // Determine overall document status
  const hasErrors = issues.some(i => i.severity === 'error');
  const hasWarnings = issues.some(i => i.severity === 'warning');

  let overallStatus: 'completed' | 'review_required' | 'failed' = 'completed';
  if (hasErrors || hasWarnings || validatedObservations.length === 0) {
    overallStatus = 'review_required';
  }

  return {
    validatedObservations,
    validationIssues: issues,
    overallStatus,
  };
}
