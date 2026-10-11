export type ProcessingStatus = 
  | 'uploaded' 
  | 'processing' 
  | 'review_required' 
  | 'completed' 
  | 'failed';

export type VerificationStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'rejected';

export type ValidationStatus = 
  | 'valid' 
  | 'warning' 
  | 'error';

export type IssueSeverity = 
  | 'info' 
  | 'warning' 
  | 'error';

export type IssueType = 
  | 'missing_test_name' 
  | 'missing_value' 
  | 'missing_unit' 
  | 'invalid_date' 
  | 'duplicate_observation' 
  | 'implausible_bounds' 
  | 'unsupported_unit' 
  | 'unmapped_test';

export interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  createdAt: string;
}

export interface LabDocument {
  id: string;
  profileId: string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  checksum: string;
  documentType: 'lab_report';
  documentDate: string | null;
  processingStatus: ProcessingStatus;
  processingError: string | null;
  extractedCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionRun {
  id: string;
  documentId: string;
  modelName: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  extractedCount: number;
  validationIssueCount: number;
  errorMessage: string | null;
  durationMs?: number;
}

export interface Observation {
  id: string;
  profileId: string;
  documentId: string;
  extractionRunId: string;
  rawTestName: string;
  canonicalTestName: string;
  loincCode: string | null;
  valueNumeric: number | null;
  valueText: string | null;
  originalUnit: string;
  normalizedUnit: string | null;
  referenceLow: number | null;
  referenceHigh: number | null;
  observationDate: string;
  validationStatus: ValidationStatus;
  verifiedByUser: VerificationStatus;
  userCorrected?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Denormalized helper for UI traceability
  sourceDocumentName?: string;
  pageNumber?: number | null;
}

export interface ValidationIssue {
  id: string;
  documentId: string;
  extractionRunId: string;
  observationId: string | null;
  issueType: IssueType;
  severity: IssueSeverity;
  message: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt: string | null;
  observationTestName?: string;
}

export interface DataQualityKPIs {
  totalDocuments: number;
  processedSuccess: number;
  processingFailures: number;
  reviewRequiredCount?: number;
  documentSuccessRate: number | null; // percentage or null if 0 terminal docs
  totalRuns?: number;
  completedRuns?: number;
  failedRuns?: number;
  runningRuns?: number;
  extractionSuccessRate: number | null; // percentage or null if 0 terminal runs
  totalObservations: number;
  validObservations?: number;
  warningObservations?: number;
  errorObservations?: number;
  confirmedCount: number;
  unverifiedCount: number;
  rejectedCount: number;
  validationPassRate: number | null; // percentage or null if 0 obs
  verifiedObservationRate?: number | null; // percentage or null if 0 obs
  missingFieldRate: number | null; // percentage
  fieldCompletenessRate?: number | null; // percentage
  duplicateCount: number;
  avgDurationMs: number | null;
  p50DurationMs?: number | null;
  p95DurationMs?: number | null;
  openIssuesCount?: number;
  criticalIssuesCount?: number;
  warningIssuesCount?: number;
  infoIssuesCount?: number;
  issuesByCategory: Record<string, number>;
}

export type ActiveScreen = 
  | 'overview' 
  | 'upload' 
  | 'review' 
  | 'timeline' 
  | 'trends' 
  | 'data-quality' 
  | 'documents' 
  | 'settings';
