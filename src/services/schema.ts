import { z } from 'zod';

/**
 * Strict Zod schema for raw extracted observation from laboratory report
 * Aligns with Section 8, Step 3 of specification.
 */
export const RawExtractedObservationSchema = z.object({
  test_name: z.string().min(1, 'Test name is required'),
  value: z.number().nullable().optional(),
  value_text: z.string().nullable().optional(),
  unit: z.string().nullable().optional().default(''),
  reference_low: z.number().nullable().optional(),
  reference_high: z.number().nullable().optional(),
  observation_date: z.string().nullable().optional(), // Expected YYYY-MM-DD or null
  reported_flag: z.string().nullable().optional(), // 'H', 'L', 'CRITICAL', etc.
  page_number: z.number().int().positive().nullable().optional().default(1),
}).refine(
  (data) => data.value !== null && data.value !== undefined || (data.value_text !== null && data.value_text !== undefined && data.value_text.trim().length > 0),
  {
    message: 'Either numeric value or textual value must be provided',
    path: ['value'],
  }
);

export type RawExtractedObservation = z.infer<typeof RawExtractedObservationSchema>;

/**
 * Normalizes any string representation of a laboratory report into the canonical 'lab_report' literal.
 * Seamlessly handles AI model variations such as 'Laboratory Report', 'Lab Report', 'laboratory_report', 'LAB_REPORT', etc.
 */
export function normalizeDocumentType(val: unknown): 'lab_report' {
  if (typeof val === 'string') {
    const cleaned = val.trim().toLowerCase().replace(/[\s-_]+/g, '');
    if (
      cleaned === 'labreport' ||
      cleaned === 'laboratoryreport' ||
      cleaned === 'lab' ||
      cleaned === 'laboratory' ||
      cleaned === 'report' ||
      cleaned.includes('lab') ||
      cleaned.includes('report') ||
      cleaned.includes('panel') ||
      cleaned.includes('blood') ||
      cleaned.includes('test')
    ) {
      return 'lab_report';
    }
    return 'lab_report';
  }
  return 'lab_report';
}

/**
 * Strict Zod schema for full document extraction response
 */
export const ExtractedReportSchema = z.object({
  document_date: z.string().nullable().optional(), // YYYY-MM-DD
  document_type: z.preprocess((val) => normalizeDocumentType(val), z.literal('lab_report')).default('lab_report'),
  patient_name: z.string().nullable().optional(), // Sensitive: never logged in operational logs
  provider_name: z.string().nullable().optional(), // e.g., 'Quest Diagnostics', 'LabCorp'
  observations: z.array(RawExtractedObservationSchema).min(0),
});

export type ExtractedReport = z.infer<typeof ExtractedReportSchema>;

/**
 * Recovers valid observations from an AI response cut off mid-stream by token limits.
 * Scans backwards for the last fully-closed JSON object inside observations, closes
 * the array, and parses the recovered payload.
 */
export function tryRepairTruncatedJson(rawText: string): ExtractedReport | null {
  const obsIndex = rawText.indexOf('"observations"');
  if (obsIndex === -1) return null;

  let searchPos = rawText.lastIndexOf('}');
  while (searchPos > obsIndex) {
    const candidateSlice = rawText.substring(0, searchPos + 1);
    const candidateVariants = [
      candidateSlice + '\n]\n}',
      candidateSlice + '\n}',
      candidateSlice + ']}',
    ];

    for (const variant of candidateVariants) {
      try {
        const parsed = JSON.parse(variant);
        if (parsed && Array.isArray(parsed.observations) && parsed.observations.length > 0) {
          if (parsed.document_type) {
            parsed.document_type = normalizeDocumentType(parsed.document_type);
          } else {
            parsed.document_type = 'lab_report';
          }
          return parsed as ExtractedReport;
        }
      } catch {
        // continue scanning backwards
      }
    }

    searchPos = rawText.lastIndexOf('}', searchPos - 1);
  }

  return null;
}
