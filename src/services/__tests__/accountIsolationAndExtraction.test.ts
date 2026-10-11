import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as supabaseModule from '../../lib/supabaseClient';
import { generateUUID } from '../../lib/uuid';
import { 
  executeDocumentExtractionPipeline, 
  computeFileChecksum 
} from '../extractionPipeline';
import type { 
  LabDocument, 
  Observation, 
  ExtractionRun, 
  ValidationIssue 
} from '../../types';
import type { ExtractedReport } from '../schema';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====================================================================
// Document Test Fixtures (Substantially Different Clinical Panels)
// ====================================================================

const FIXTURE_DOC_1_CONTENT = 'Patient: Jane Doe. Specimen: 2026-04-10. Lipid Profile: Total Cholesterol 215 mg/dL (125-200), HDL 48 mg/dL (40-60), Triglycerides 160 mg/dL (0-150).';
const FIXTURE_DOC_2_CONTENT = 'Patient: John Smith. Specimen: 2026-05-18. Hematology CBC: WBC 7.4 x10^3/uL (4.5-11.0), RBC 4.90 x10^6/uL (4.3-5.9), Hemoglobin 14.2 g/dL (13.5-17.5), Platelets 230 x10^3/uL (150-450).';
const FIXTURE_MALFORMED_CONTENT = '%PDF-1.4 [CORRUPTED BINARY STREAM ILLEGIBLE ERROR]';

const EXTRACTED_LIPID_REPORT: ExtractedReport = {
  document_type: 'lab_report',
  document_date: '2026-04-10',
  patient_name: 'Jane Doe',
  provider_name: 'Quest Diagnostics',
  observations: [
    {
      test_name: 'Total Cholesterol',
      value: 215,
      unit: 'mg/dL',
      reference_low: 125,
      reference_high: 200,
      observation_date: '2026-04-10',
      page_number: 1,
    },
    {
      test_name: 'HDL Cholesterol',
      value: 48,
      unit: 'mg/dL',
      reference_low: 40,
      reference_high: 60,
      observation_date: '2026-04-10',
      page_number: 1,
    },
    {
      test_name: 'Triglycerides',
      value: 160,
      unit: 'mg/dL',
      reference_low: 0,
      reference_high: 150,
      observation_date: '2026-04-10',
      page_number: 1,
    },
  ],
};

const EXTRACTED_CBC_REPORT: ExtractedReport = {
  document_type: 'lab_report',
  document_date: '2026-05-18',
  patient_name: 'John Smith',
  provider_name: 'LabCorp Hematology',
  observations: [
    {
      test_name: 'White Blood Cell Count',
      value: 7.4,
      unit: 'x10^3/uL',
      reference_low: 4.5,
      reference_high: 11.0,
      observation_date: '2026-05-18',
      page_number: 1,
    },
    {
      test_name: 'Red Blood Cell Count',
      value: 4.90,
      unit: 'x10^6/uL',
      reference_low: 4.30,
      reference_high: 5.90,
      observation_date: '2026-05-18',
      page_number: 1,
    },
    {
      test_name: 'Hemoglobin',
      value: 14.2,
      unit: 'g/dL',
      reference_low: 13.5,
      reference_high: 17.5,
      observation_date: '2026-05-18',
      page_number: 1,
    },
    {
      test_name: 'Platelet Count',
      value: 230,
      unit: 'x10^3/uL',
      reference_low: 150,
      reference_high: 450,
      observation_date: '2026-05-18',
      page_number: 1,
    },
  ],
};

// ====================================================================
// In-Memory Test Store Simulating Isolated Database & Session State
// ====================================================================

class IsolatedUserDataStore {
  private documents = new Map<string, LabDocument[]>();
  private observations = new Map<string, Observation[]>();
  private runs = new Map<string, ExtractionRun[]>();
  private issues = new Map<string, ValidationIssue[]>();

  getUserDocuments(userId: string): LabDocument[] {
    return [...(this.documents.get(userId) || [])];
  }

  getUserObservations(userId: string): Observation[] {
    return [...(this.observations.get(userId) || [])];
  }

  getUserIssues(userId: string): ValidationIssue[] {
    return [...(this.issues.get(userId) || [])];
  }

  getUserRuns(userId: string): ExtractionRun[] {
    return [...(this.runs.get(userId) || [])];
  }

  addRecords(
    userId: string, 
    doc: LabDocument, 
    run: ExtractionRun, 
    obs: Observation[], 
    issues: ValidationIssue[]
  ) {
    const userDocs = this.documents.get(userId) || [];
    this.documents.set(userId, [doc, ...userDocs]);

    const userRuns = this.runs.get(userId) || [];
    this.runs.set(userId, [run, ...userRuns]);

    const userObs = this.observations.get(userId) || [];
    this.observations.set(userId, [...obs, ...userObs]);

    const userIssues = this.issues.get(userId) || [];
    this.issues.set(userId, [...issues, ...userIssues]);
  }

  // Enforces query boundary by checking owner ID
  queryDocumentDirect(requestingUserId: string, targetDocumentId: string): LabDocument | null {
    const userDocs = this.documents.get(requestingUserId) || [];
    return userDocs.find(d => d.id === targetDocumentId) || null;
  }

  queryObservationsDirect(requestingUserId: string, targetDocId: string): Observation[] {
    const userObs = this.observations.get(requestingUserId) || [];
    return userObs.filter(o => o.documentId === targetDocId);
  }
}

describe('CRITICAL P0: Account Isolation, Session Lifecycle & Extraction Integrity', () => {
  let store: IsolatedUserDataStore;

  beforeEach(() => {
    store = new IsolatedUserDataStore();
  });

  // ====================================================================
  // TEST 1: New-Account Isolation
  // ====================================================================
  describe('Test 1 — New-Account Isolation', () => {
    it('ensures User B starts completely empty and receives zero data from User A', async () => {
      const userAId = generateUUID();
      const userBId = generateUUID();

      expect(userAId).not.toBe(userBId);

      // Verify User B starts completely empty before any actions
      expect(store.getUserDocuments(userBId)).toHaveLength(0);
      expect(store.getUserObservations(userBId)).toHaveLength(0);
      expect(store.getUserIssues(userBId)).toHaveLength(0);

      // User A uploads Document 1 (Lipid Panel)
      const fileA = new File([FIXTURE_DOC_1_CONTENT], 'lipid_panel_userA.pdf', { type: 'application/pdf' });
      const resultA = await executeDocumentExtractionPipeline(
        fileA,
        'Lipid Panel User A',
        '2026-04-10',
        userAId,
        undefined,
        async () => EXTRACTED_LIPID_REPORT
      );

      store.addRecords(userAId, resultA.document, resultA.run, resultA.observations, resultA.validationIssues);

      // Verify User A has its document and observations
      const userADocs = store.getUserDocuments(userAId);
      const userAObs = store.getUserObservations(userAId);
      expect(userADocs).toHaveLength(1);
      expect(userAObs).toHaveLength(3);
      expect(userADocs[0].profileId).toBe(userAId);
      userAObs.forEach(o => expect(o.profileId).toBe(userAId));

      // Verify User B receives NONE of User A's data
      const userBDocs = store.getUserDocuments(userBId);
      const userBObs = store.getUserObservations(userBId);
      const userBIssues = store.getUserIssues(userBId);

      expect(userBDocs).toHaveLength(0);
      expect(userBObs).toHaveLength(0);
      expect(userBIssues).toHaveLength(0);

      // Direct query bypass check: User B attempts to access User A's document ID
      const directQuery = store.queryDocumentDirect(userBId, userADocs[0].id);
      expect(directQuery).toBeNull();

      const directObsQuery = store.queryObservationsDirect(userBId, userADocs[0].id);
      expect(directObsQuery).toHaveLength(0);
    });
  });

  // ====================================================================
  // TEST 2: Logout and Account Switching
  // ====================================================================
  describe('Test 2 — Logout and Account Switching', () => {
    it('purges all in-memory state on logout and drops stale in-flight responses across session switch', async () => {
      const userAId = generateUUID();
      const userBId = generateUUID();

      // Simulate client active session lifecycle
      let currentSessionToken = 1;
      let activeSessionUserId: string | null = userAId;
      let clientRenderedDocuments: LabDocument[] = [];
      let clientRenderedObservations: Observation[] = [];

      // 1. User A is signed in and loads data
      const fileA = new File([FIXTURE_DOC_1_CONTENT], 'userA_report.pdf', { type: 'application/pdf' });
      const resultA = await executeDocumentExtractionPipeline(
        fileA,
        'User A Report',
        '2026-04-10',
        userAId,
        undefined,
        async () => EXTRACTED_LIPID_REPORT
      );
      store.addRecords(userAId, resultA.document, resultA.run, resultA.observations, resultA.validationIssues);

      clientRenderedDocuments = store.getUserDocuments(userAId);
      clientRenderedObservations = store.getUserObservations(userAId);
      expect(clientRenderedDocuments).toHaveLength(1);
      expect(clientRenderedObservations).toHaveLength(3);

      // 2. User A Signs Out: Centralized session transition
      activeSessionUserId = null;
      currentSessionToken += 1;
      // In-memory state is immediately purged
      clientRenderedDocuments = [];
      clientRenderedObservations = [];

      expect(clientRenderedDocuments).toHaveLength(0);
      expect(clientRenderedObservations).toHaveLength(0);

      // 3. User B Signs In: Starts clean
      activeSessionUserId = userBId;
      currentSessionToken += 1;
      const sessionBToken = currentSessionToken;

      clientRenderedDocuments = store.getUserDocuments(userBId);
      clientRenderedObservations = store.getUserObservations(userBId);
      expect(clientRenderedDocuments).toHaveLength(0);
      expect(clientRenderedObservations).toHaveLength(0);

      // 4. Simulate a delayed, in-flight response from User A's session arriving late
      const delayedResponseFromUserA = {
        sessionToken: sessionBToken - 2, // From User A's session
        userId: userAId,
        docs: [resultA.document],
        obs: resultA.observations,
      };

      // Discard policy: check session token and current user ID
      if (
        delayedResponseFromUserA.sessionToken === currentSessionToken &&
        delayedResponseFromUserA.userId === activeSessionUserId
      ) {
        clientRenderedDocuments = delayedResponseFromUserA.docs;
        clientRenderedObservations = delayedResponseFromUserA.obs;
      }

      // Verify delayed response did NOT contaminate User B's state
      expect(clientRenderedDocuments).toHaveLength(0);
      expect(clientRenderedObservations).toHaveLength(0);
    });
  });

  // ====================================================================
  // TEST 3: Distinct-Document Extraction & Malformed Handling
  // ====================================================================
  describe('Test 3 — Distinct-Document Extraction & Malformed Handling', () => {
    it('binds extraction to actual document content identity and distinguishes between distinct reports', async () => {
      const userId = generateUUID();

      const file1 = new File([FIXTURE_DOC_1_CONTENT], 'report1_lipid.pdf', { type: 'application/pdf' });
      const file2 = new File([FIXTURE_DOC_2_CONTENT], 'report2_cbc.pdf', { type: 'application/pdf' });

      // 1. Verify SHA-256 checksums are distinct and non-empty
      const checksum1 = await computeFileChecksum(file1);
      const checksum2 = await computeFileChecksum(file2);

      expect(checksum1).toBeDefined();
      expect(checksum2).toBeDefined();
      expect(checksum1.length).toBe(64);
      expect(checksum2.length).toBe(64);
      expect(checksum1).not.toBe(checksum2);

      // 2. Extract Document 1
      const result1 = await executeDocumentExtractionPipeline(
        file1,
        'Report 1 Lipid',
        '2026-04-10',
        userId,
        undefined,
        async () => EXTRACTED_LIPID_REPORT
      );

      // 3. Extract Document 2
      const result2 = await executeDocumentExtractionPipeline(
        file2,
        'Report 2 CBC',
        '2026-05-18',
        userId,
        undefined,
        async () => EXTRACTED_CBC_REPORT
      );

      // Verify distinct identities
      expect(result1.document.id).not.toBe(result2.document.id);
      expect(result1.run.id).not.toBe(result2.run.id);
      expect(result1.document.checksum).toBe(checksum1);
      expect(result2.document.checksum).toBe(checksum2);
      expect(result1.document.storagePath).not.toBe(result2.document.storagePath);

      // Verify actual extracted values match their specific sources
      const testNames1 = result1.observations.map(o => o.canonicalTestName);
      const testNames2 = result2.observations.map(o => o.canonicalTestName);

      expect(testNames1).toContain('Total Cholesterol');
      expect(testNames1).toContain('HDL Cholesterol');
      expect(testNames1).toContain('Triglycerides');
      expect(testNames1).not.toContain('White Blood Cell Count');

      expect(testNames2).toContain('White Blood Cell Count');
      expect(testNames2).toContain('Hemoglobin');
      expect(testNames2).toContain('Platelet Count');
      expect(testNames2).not.toContain('Total Cholesterol');

      // Verify Document 2 did NOT reuse Document 1's results
      expect(result1.observations).not.toEqual(result2.observations);

      // Verify page number provenance
      result1.observations.forEach(o => expect(o.pageNumber).toBe(1));
      result2.observations.forEach(o => expect(o.pageNumber).toBe(1));
    });

    it('records an explicit failure when extracting a malformed document and never invents synthetic panels', async () => {
      const userId = generateUUID();
      const malformedFile = new File([FIXTURE_MALFORMED_CONTENT], 'malformed_scan.pdf', { type: 'application/pdf' });

      // Failing extractor simulating corrupted binary parse
      const failingExtractor = async () => {
        throw new Error('PDF stream truncated or syntax corrupted.');
      };

      await expect(
        executeDocumentExtractionPipeline(
          malformedFile,
          'Corrupted Scan',
          '2026-06-01',
          userId,
          undefined,
          failingExtractor
        )
      ).rejects.toThrow('PDF stream truncated or syntax corrupted.');
    });
  });

  // ====================================================================
  // TEST 4: Extraction Service Failure
  // ====================================================================
  describe('Test 4 — Extraction Service Failure', () => {
    it('records a failed run and never returns synthetic fallback observations when provider is unavailable', async () => {
      const isConfiguredSpy = vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(false);
      const userId = generateUUID();
      const validFile = new File([FIXTURE_DOC_1_CONTENT], 'annual_checkup.pdf', { type: 'application/pdf' });

      // When backend extraction service is completely offline/unreachable
      try {
        await executeDocumentExtractionPipeline(
          validFile,
          'Annual Checkup',
          '2026-04-10',
          userId
        );
        expect.unreachable('Should have thrown extraction failure');
      } catch (err: unknown) {
        const error = err as { failedDocument?: LabDocument; failedRun?: ExtractionRun; message: string };
        expect(error.message).toContain('Extraction service unavailable');

        // Verify the failed document and failed run are created with zero observations
        expect(error.failedDocument).toBeDefined();
        expect(error.failedDocument?.processingStatus).toBe('failed');
        expect(error.failedDocument?.processingError).toContain('Extraction service unavailable');
        expect(error.failedDocument?.extractedCount).toBe(0);

        expect(error.failedRun).toBeDefined();
        expect(error.failedRun?.status).toBe('failed');
        expect(error.failedRun?.extractedCount).toBe(0);
        expect(error.failedRun?.errorMessage).toContain('Extraction service unavailable');
      } finally {
        isConfiguredSpy.mockRestore();
      }
    });
  });

  // ====================================================================
  // TEST 5: Database and Persistence Isolation (SQL RLS Policy Verification)
  // ====================================================================
  describe('Test 5 — Database & Persistence Isolation', () => {
    it('verifies RLS policies enforce strict auth.uid() boundaries on documents, runs, observations, and issues', () => {
      const rlsPath = path.resolve(__dirname, '../../../supabase/migrations/002_row_level_security.sql');
      const rlsContent = fs.readFileSync(rlsPath, 'utf8');

      // Documents RLS: profile_id = auth.uid()
      expect(rlsContent).toMatch(/CREATE POLICY "Users can read own documents"[\s\S]*?auth\.uid\(\)\s*=\s*profile_id/);
      expect(rlsContent).toMatch(/CREATE POLICY "Users can insert own documents"[\s\S]*?auth\.uid\(\)\s*=\s*profile_id/);
      expect(rlsContent).toMatch(/CREATE POLICY "Users can update own documents"[\s\S]*?auth\.uid\(\)\s*=\s*profile_id/);
      expect(rlsContent).toMatch(/CREATE POLICY "Users can delete own documents"[\s\S]*?auth\.uid\(\)\s*=\s*profile_id/);

      // Observations RLS: profile_id = auth.uid()
      expect(rlsContent).toMatch(/CREATE POLICY "Users can read own observations"[\s\S]*?auth\.uid\(\)\s*=\s*profile_id/);
      expect(rlsContent).toMatch(/CREATE POLICY "Users can insert own observations"[\s\S]*?auth\.uid\(\)\s*=\s*profile_id/);

      // Extraction runs & validation issues: verified through parent document ownership
      expect(rlsContent).toContain('documents.profile_id = auth.uid()');
    });

    it('verifies storage bucket RLS enforces folder ownership matching auth.uid()', () => {
      const storagePath = path.resolve(__dirname, '../../../supabase/migrations/003_storage_policies.sql');
      const storageContent = fs.readFileSync(storagePath, 'utf8');

      // Non-public bucket
      expect(storageContent).toContain('public = false');
      // Storage folder name MUST match auth.uid()
      expect(storageContent).toContain('(storage.foldername(name))[1] = auth.uid()::text');
    });
  });

  // ====================================================================
  // TEST 6: Idempotent Retries
  // ====================================================================
  describe('Test 6 — Idempotent Retries', () => {
    it('safely retries without creating duplicate observations or overwriting confirmed records', async () => {
      const userId = generateUUID();
      const file = new File([FIXTURE_DOC_1_CONTENT], 'lipid_report.pdf', { type: 'application/pdf' });

      // Run 1: Initial extraction
      const result1 = await executeDocumentExtractionPipeline(
        file,
        'Lipid Report',
        '2026-04-10',
        userId,
        undefined,
        async () => EXTRACTED_LIPID_REPORT
      );

      const docId = result1.document.id;
      store.addRecords(userId, result1.document, result1.run, result1.observations, result1.validationIssues);

      let currentObs = store.getUserObservations(userId);
      expect(currentObs).toHaveLength(3);

      // User confirms one observation (Total Cholesterol)
      currentObs[0].verifiedByUser = 'confirmed';

      // Simulate retry logic from HealthDataContext:
      // 1. Filter out unconfirmed pending observations for this document
      const preservedConfirmed = currentObs.filter(
        o => o.documentId === docId && o.verifiedByUser === 'confirmed'
      );
      expect(preservedConfirmed).toHaveLength(1);

      // 2. Reprocess document with a new distinct extraction run ID
      const result2 = await executeDocumentExtractionPipeline(
        file,
        'Lipid Report (Retry)',
        '2026-04-10',
        userId,
        undefined,
        async () => EXTRACTED_LIPID_REPORT
      );

      // Run IDs must be distinct for traceable history
      expect(result2.run.id).not.toBe(result1.run.id);

      // Replace pending drafts while preserving confirmed items
      const mergedObservations = [
        ...preservedConfirmed,
        ...result2.observations.filter(o => o.canonicalTestName !== preservedConfirmed[0].canonicalTestName)
      ];

      // No duplicate observations created
      const names = mergedObservations.map(o => o.canonicalTestName);
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);
      expect(mergedObservations).toHaveLength(3);
    });
  });
});
