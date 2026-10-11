import React, { createContext, useContext, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { 
  LabDocument, 
  Observation, 
  ExtractionRun, 
  ValidationIssue, 
  UserProfile,
  DataQualityKPIs,
  ActiveScreen
} from '../types';
import { executeDocumentExtractionPipeline } from '../services/extractionPipeline';
import { ExtractedReportSchema } from '../services/schema';
import { validateExtractedReport } from '../services/validationRules';
import { calculatePipelineKPIs } from '../services/kpiMetrics';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { generateUUID } from '../lib/uuid';

interface StoredUserState {
  documents: LabDocument[];
  runs: ExtractionRun[];
  observations: Observation[];
  validationIssues: ValidationIssue[];
}

function getUserStorageKey(userId: string): string {
  return `vitaltrace_user_data_v3_${userId}`;
}

function loadStoredUserState(userId: string): StoredUserState | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(getUserStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed?.documents) &&
      Array.isArray(parsed?.runs) &&
      Array.isArray(parsed?.observations) &&
      Array.isArray(parsed?.validationIssues)
    ) {
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse cached local vitaltrace state for user:', userId, e);
  }
  return null;
}

function saveStoredUserState(userId: string, state: StoredUserState) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(getUserStorageKey(userId), JSON.stringify(state));
    }
  } catch (e) {
    console.warn('Failed to save vitaltrace state to localStorage for user:', userId, e);
  }
}

interface HealthDataContextType {
  profile: UserProfile | null;
  activeScreen: ActiveScreen;
  setActiveScreen: (screen: ActiveScreen) => void;
  documents: LabDocument[];
  runs: ExtractionRun[];
  observations: Observation[];
  validationIssues: ValidationIssue[];
  kpis: DataQualityKPIs;
  isDemoMode: boolean;
  selectedDocumentIdFilter: string | null;
  setSelectedDocumentIdFilter: (id: string | null) => void;
  isRefreshing: boolean;
  lastRefreshedAt: string | null;
  refreshData: () => Promise<void>;
  // Actions
  updateObservation: (id: string, updates: Partial<Observation>) => Promise<void> | void;
  confirmObservation: (id: string) => Promise<void> | void;
  rejectObservation: (id: string) => Promise<void> | void;
  batchConfirmValid: (documentId?: string) => Promise<void> | void;
  uploadDocument: (file: File, title: string, docDate?: string) => Promise<string>;
  retryProcessing: (documentId: string) => Promise<void> | void;
  resolveIssue: (issueId: string) => Promise<void> | void;
}

const HealthDataContext = createContext<HealthDataContextType | undefined>(undefined);

export const HealthDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isConfigured, sessionToken } = useAuth();

  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('overview');
  const [documents, setDocuments] = useState<LabDocument[]>([]);
  const [runs, setRuns] = useState<ExtractionRun[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [selectedDocumentIdFilter, setSelectedDocumentIdFilter] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const activeUserIdRef = useRef<string | null>(null);
  const activeSessionTokenRef = useRef<number>(sessionToken);

  const isDemoMode = !isConfigured;

  // Sync state to user-scoped localStorage whenever modified in local mode
  useEffect(() => {
    if (!isConfigured && currentUser) {
      saveStoredUserState(currentUser.id, { documents, runs, observations, validationIssues });
    }
  }, [isConfigured, currentUser, documents, runs, observations, validationIssues]);

  // Derive active profile from AuthContext
  const profile: UserProfile | null = useMemo(() => {
    if (currentUser) {
      return {
        id: currentUser.id,
        userId: currentUser.id,
        displayName: currentUser.displayName,
        email: currentUser.email,
        createdAt: '2024-01-10T08:00:00Z',
      };
    }
    return null;
  }, [currentUser]);

  // Load live user data from Supabase backend
  const loadLiveUserData = useCallback(async (userId: string, expectedSessionToken: number) => {
    if (!supabase) return;
    setIsRefreshing(true);

    try {
      // 1. Documents
      const { data: dbDocs, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('profile_id', userId)
        .order('created_at', { ascending: false });

      if (docError) {
        console.error('Failed to fetch live documents:', docError.message);
      }

      // 2. Extraction runs
      const { data: dbRuns, error: runError } = await supabase
        .from('extraction_runs')
        .select('*')
        .order('started_at', { ascending: false });

      if (runError) {
        console.error('Failed to fetch live extraction runs:', runError.message);
      }

      // 3. Observations
      const { data: dbObs, error: obsError } = await supabase
        .from('observations')
        .select('*')
        .eq('profile_id', userId)
        .order('observation_date', { ascending: false });

      if (obsError) {
        console.error('Failed to fetch live observations:', obsError.message);
      }

      // 4. Validation Issues
      const { data: dbIssues, error: issueError } = await supabase
        .from('validation_issues')
        .select('*')
        .order('created_at', { ascending: false });

      if (issueError) {
        console.error('Failed to fetch live validation issues:', issueError.message);
      }

      // Check for stale response from previous session or switched user
      if (
        activeSessionTokenRef.current !== expectedSessionToken ||
        activeUserIdRef.current !== userId
      ) {
        // Discard stale response
        return;
      }

      // Map snake_case to domain models
      const mappedDocs: LabDocument[] = (dbDocs || []).map(d => ({
        id: d.id,
        profileId: d.profile_id,
        originalFilename: d.original_filename,
        storagePath: d.storage_path,
        mimeType: d.mime_type,
        fileSizeBytes: d.file_size_bytes,
        checksum: d.checksum || '',
        documentType: d.document_type || 'lab_report',
        documentDate: d.document_date,
        processingStatus: d.processing_status,
        processingError: d.processing_error,
        extractedCount: 0,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));

      const docIdSet = new Set(mappedDocs.map(d => d.id));

      const mappedRuns: ExtractionRun[] = (dbRuns || [])
        .filter(r => docIdSet.has(r.document_id))
        .map(r => ({
          id: r.id,
          documentId: r.document_id,
          modelName: r.model_name,
          status: r.status,
          startedAt: r.started_at,
          completedAt: r.completed_at,
          extractedCount: r.extracted_count,
          validationIssueCount: r.validation_issue_count,
          errorMessage: r.error_message,
          durationMs: r.duration_ms,
        }));

      const mappedObs: Observation[] = (dbObs || []).map(o => {
        const parentDoc = mappedDocs.find(d => d.id === o.document_id);
        return {
          id: o.id,
          profileId: o.profile_id,
          documentId: o.document_id,
          extractionRunId: o.extraction_run_id,
          rawTestName: o.raw_test_name,
          canonicalTestName: o.canonical_test_name,
          loincCode: o.loinc_code,
          valueNumeric: o.value_numeric,
          valueText: o.value_text,
          originalUnit: o.original_unit,
          normalizedUnit: o.normalized_unit,
          referenceLow: o.reference_low,
          referenceHigh: o.reference_high,
          observationDate: o.observation_date,
          validationStatus: o.validation_status,
          verifiedByUser: o.verified_by_user,
          userCorrected: o.user_corrected,
          notes: o.notes,
          createdAt: o.created_at,
          updatedAt: o.updated_at,
          sourceDocumentName: parentDoc?.originalFilename,
        };
      });

      const obsMap = new Map(mappedObs.map(o => [o.id, o.canonicalTestName]));

      const mappedIssues: ValidationIssue[] = (dbIssues || [])
        .filter(i => docIdSet.has(i.document_id))
        .map(i => ({
          id: i.id,
          documentId: i.document_id,
          extractionRunId: i.extraction_run_id,
          observationId: i.observation_id,
          issueType: i.issue_type,
          severity: i.severity,
          message: i.message,
          resolved: i.resolved,
          createdAt: i.created_at,
          resolvedAt: i.resolved_at,
          observationTestName: i.observation_id ? obsMap.get(i.observation_id) : undefined,
        }));

      // Update extracted counts on documents
      mappedDocs.forEach(d => {
        d.extractedCount = mappedObs.filter(o => o.documentId === d.id).length;
      });

      setDocuments(mappedDocs);
      setRuns(mappedRuns);
      setObservations(mappedObs);
      setValidationIssues(mappedIssues);
      setLastRefreshedAt(new Date().toISOString());
    } catch (err) {
      console.error('Error synchronizing live Supabase state:', err);
    } finally {
      if (
        activeSessionTokenRef.current === expectedSessionToken &&
        activeUserIdRef.current === userId
      ) {
        setIsRefreshing(false);
      }
    }
  }, []);

  // Centralized session transition lifecycle:
  // On logout or account switching: immediately purge all in-memory private account data
  useEffect(() => {
    activeSessionTokenRef.current = sessionToken;
    const currentToken = sessionToken;

    if (!currentUser) {
      // User is logged out: IMMEDIATELY purge in-memory state
      activeUserIdRef.current = null;
      setDocuments([]);
      setRuns([]);
      setObservations([]);
      setValidationIssues([]);
      setSelectedDocumentIdFilter(null);
      setIsRefreshing(false);
      setLastRefreshedAt(null);
      return;
    }

    // User is signed in:
    const userId = currentUser.id;
    activeUserIdRef.current = userId;

    // Immediately purge in-memory state from previous user to prevent flash of stale data
    setDocuments([]);
    setRuns([]);
    setObservations([]);
    setValidationIssues([]);
    setSelectedDocumentIdFilter(null);

    if (isSupabaseConfigured() && supabase) {
      loadLiveUserData(userId, currentToken);
    } else {
      // Local mode: Load only this specific user's isolated local records
      setIsRefreshing(true);
      const saved = loadStoredUserState(userId);
      setDocuments(saved?.documents || []);
      setRuns(saved?.runs || []);
      setObservations(saved?.observations || []);
      setValidationIssues(saved?.validationIssues || []);
      setLastRefreshedAt(new Date().toISOString());
      setIsRefreshing(false);
    }
  }, [currentUser, sessionToken, loadLiveUserData, isConfigured]);

  // Refresh handler
  const refreshData = async () => {
    if (!currentUser) return;
    if (isSupabaseConfigured() && supabase) {
      await loadLiveUserData(currentUser.id, activeSessionTokenRef.current);
    } else {
      setIsRefreshing(true);
      const saved = loadStoredUserState(currentUser.id);
      setDocuments(saved?.documents || []);
      setRuns(saved?.runs || []);
      setObservations(saved?.observations || []);
      setValidationIssues(saved?.validationIssues || []);
      setLastRefreshedAt(new Date().toISOString());
      setIsRefreshing(false);
    }
  };

  // Data Quality KPIs calculated deterministically via kpiMetrics service
  const kpis: DataQualityKPIs = useMemo(() => {
    const calculated = calculatePipelineKPIs(documents, runs, observations, validationIssues);
    return {
      totalDocuments: calculated.totalDocuments,
      processedSuccess: calculated.completedDocuments,
      processingFailures: calculated.failedDocuments,
      reviewRequiredCount: calculated.reviewRequiredDocuments,
      documentSuccessRate: calculated.documentSuccessRate,
      totalRuns: calculated.totalRuns,
      completedRuns: calculated.completedRuns,
      failedRuns: calculated.failedRuns,
      runningRuns: calculated.runningRuns,
      extractionSuccessRate: calculated.extractionSuccessRate,
      totalObservations: calculated.totalObservations,
      validObservations: calculated.validObservations,
      warningObservations: calculated.warningObservations,
      errorObservations: calculated.errorObservations,
      confirmedCount: calculated.confirmedObservations,
      unverifiedCount: calculated.pendingObservations,
      rejectedCount: calculated.rejectedObservations,
      validationPassRate: calculated.validationPassRate ?? 0,
      verifiedObservationRate: calculated.verifiedObservationRate,
      missingFieldRate: calculated.missingFieldRate ?? 0,
      fieldCompletenessRate: calculated.fieldCompletenessRate,
      duplicateCount: calculated.duplicateCount,
      avgDurationMs: calculated.avgDurationMs ?? 0,
      p50DurationMs: calculated.p50DurationMs,
      p95DurationMs: calculated.p95DurationMs,
      openIssuesCount: calculated.openIssuesCount,
      criticalIssuesCount: calculated.criticalIssuesCount,
      warningIssuesCount: calculated.warningIssuesCount,
      infoIssuesCount: calculated.infoIssuesCount,
      issuesByCategory: calculated.issuesByCategory,
    };
  }, [documents, runs, observations, validationIssues]);

  const updateObservation = async (id: string, updates: Partial<Observation>) => {
    if (!currentUser) return;
    const nowIso = new Date().toISOString();
    setObservations(prev => prev.map(obs => {
      if (obs.id === id) {
        return {
          ...obs,
          ...updates,
          userCorrected: true,
          updatedAt: nowIso,
        };
      }
      return obs;
    }));

    if (isSupabaseConfigured() && supabase) {
      const dbUpdates: Record<string, unknown> = {
        user_corrected: true,
        updated_at: nowIso,
      };
      if (updates.canonicalTestName !== undefined) dbUpdates.canonical_test_name = updates.canonicalTestName;
      if (updates.valueNumeric !== undefined) dbUpdates.value_numeric = updates.valueNumeric;
      if (updates.valueText !== undefined) dbUpdates.value_text = updates.valueText;
      if (updates.originalUnit !== undefined) dbUpdates.original_unit = updates.originalUnit;
      if (updates.referenceLow !== undefined) dbUpdates.reference_low = updates.referenceLow;
      if (updates.referenceHigh !== undefined) dbUpdates.reference_high = updates.referenceHigh;
      if (updates.validationStatus !== undefined) dbUpdates.validation_status = updates.validationStatus;
      if (updates.verifiedByUser !== undefined) dbUpdates.verified_by_user = updates.verifiedByUser;

      const { error } = await supabase.from('observations').update(dbUpdates).eq('id', id);
      if (error) console.error('Failed to persist observation update:', error.message);
    }
  };

  const confirmObservation = async (id: string) => {
    if (!currentUser) return;
    const nowIso = new Date().toISOString();
    setObservations(prev => prev.map(obs => {
      if (obs.id === id) {
        return {
          ...obs,
          verifiedByUser: 'confirmed',
          validationStatus: obs.validationStatus === 'error' ? 'warning' : obs.validationStatus,
          updatedAt: nowIso,
        };
      }
      return obs;
    }));

    setValidationIssues(prev => prev.map(issue => {
      if (issue.observationId === id) {
        return { ...issue, resolved: true, resolvedAt: nowIso };
      }
      return issue;
    }));

    if (isSupabaseConfigured() && supabase) {
      await Promise.all([
        supabase.from('observations').update({
          verified_by_user: 'confirmed',
          updated_at: nowIso,
        }).eq('id', id),
        supabase.from('validation_issues').update({
          resolved: true,
          resolved_at: nowIso,
        }).eq('observation_id', id),
      ]);
    }
  };

  const rejectObservation = async (id: string) => {
    if (!currentUser) return;
    const nowIso = new Date().toISOString();
    setObservations(prev => prev.map(obs => {
      if (obs.id === id) {
        return {
          ...obs,
          verifiedByUser: 'rejected',
          updatedAt: nowIso,
        };
      }
      return obs;
    }));

    if (isSupabaseConfigured() && supabase) {
      await supabase.from('observations').update({
        verified_by_user: 'rejected',
        updated_at: nowIso,
      }).eq('id', id);
    }
  };

  const batchConfirmValid = async (documentId?: string) => {
    if (!currentUser) return;
    const nowIso = new Date().toISOString();
    setObservations(prev => prev.map(obs => {
      const matchDoc = !documentId || obs.documentId === documentId;
      if (matchDoc && obs.validationStatus === 'valid' && obs.verifiedByUser === 'pending') {
        return {
          ...obs,
          verifiedByUser: 'confirmed',
          updatedAt: nowIso,
        };
      }
      return obs;
    }));

    if (isSupabaseConfigured() && supabase) {
      let query = supabase
        .from('observations')
        .update({ verified_by_user: 'confirmed', updated_at: nowIso })
        .eq('validation_status', 'valid')
        .eq('verified_by_user', 'pending');

      if (documentId) {
        query = query.eq('document_id', documentId);
      }
      await query;
    }
  };

  const resolveIssue = async (issueId: string) => {
    if (!currentUser) return;
    const nowIso = new Date().toISOString();
    setValidationIssues(prev => prev.map(issue => {
      if (issue.id === issueId) {
        return { ...issue, resolved: true, resolvedAt: nowIso };
      }
      return issue;
    }));

    if (isSupabaseConfigured() && supabase) {
      await supabase.from('validation_issues').update({
        resolved: true,
        resolved_at: nowIso,
      }).eq('id', issueId);
    }
  };

  /**
   * Idempotent retry processing:
   * Cleans up unconfirmed observations and open issues for this document before running retry,
   * avoiding duplicate records on consecutive retries.
   * If extraction fails, records an explicit failure state without inventing data.
   */
  const retryProcessing = async (documentId: string) => {
    if (!currentUser) return;
    const doc = documents.find(d => d.id === documentId);
    if (!doc) return;

    const nowIso = new Date().toISOString();

    // 1. Transition document to 'processing'
    setDocuments(prev => prev.map(d => d.id === documentId ? {
      ...d,
      processingStatus: 'processing',
      processingError: null,
      updatedAt: nowIso,
    } : d));

    // Clean up unconfirmed observations and open issues for this doc
    setObservations(prev => prev.filter(o => !(o.documentId === documentId && o.verifiedByUser === 'pending')));
    setValidationIssues(prev => prev.filter(i => !(i.documentId === documentId && !i.resolved)));

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('observations')
          .delete()
          .eq('document_id', documentId)
          .eq('verified_by_user', 'pending');

        await supabase
          .from('validation_issues')
          .delete()
          .eq('document_id', documentId)
          .eq('resolved', false);

        await supabase
          .from('documents')
          .update({ processing_status: 'processing', processing_error: null, updated_at: nowIso })
          .eq('id', documentId);

        // Trigger Edge Function extraction
        const { data: edgeData, error: invokeErr } = await supabase.functions.invoke('extract-report', {
          body: { documentId },
        });

        if (invokeErr || !edgeData?.success) {
          throw new Error(invokeErr?.message || edgeData?.error || 'Retry extraction failed');
        }

        // If extraction payload is returned by Edge function, validate and persist observations
        if (edgeData.extraction) {
          const rawExtraction = edgeData.extraction as Record<string, unknown>;
          if (rawExtraction.document_type && rawExtraction.document_type !== 'lab_report') {
            rawExtraction.document_type = 'lab_report';
          }
          const extractedReport = ExtractedReportSchema.parse(edgeData.extraction);
          const runId = edgeData.runId || generateUUID();
          const docDate = extractedReport.document_date || doc.documentDate || new Date().toISOString().split('T')[0];

          const validationOutput = validateExtractedReport(
            extractedReport,
            documentId,
            runId,
            currentUser.id,
            doc.originalFilename,
            docDate
          );

          if (validationOutput.validatedObservations.length > 0) {
            const obsToInsert = validationOutput.validatedObservations.map(o => ({
              id: o.id,
              profile_id: o.profileId,
              document_id: o.documentId,
              extraction_run_id: o.extractionRunId,
              raw_test_name: o.rawTestName,
              canonical_test_name: o.canonicalTestName,
              loinc_code: o.loincCode,
              value_numeric: o.valueNumeric,
              value_text: o.valueText,
              original_unit: o.originalUnit,
              normalized_unit: o.normalizedUnit,
              reference_low: o.referenceLow,
              reference_high: o.referenceHigh,
              observation_date: o.observationDate,
              validation_status: o.validationStatus,
              verified_by_user: o.verifiedByUser,
              user_corrected: o.userCorrected || false,
            }));
            await supabase.from('observations').insert(obsToInsert);
          }

          if (validationOutput.validationIssues.length > 0) {
            const issuesToInsert = validationOutput.validationIssues.map(i => ({
              id: i.id,
              document_id: i.documentId,
              extraction_run_id: i.extractionRunId,
              observation_id: i.observationId,
              issue_type: i.issueType,
              severity: i.severity,
              message: i.message,
              resolved: i.resolved,
            }));
            await supabase.from('validation_issues').insert(issuesToInsert);
          }

          await supabase.from('extraction_runs').update({
            validation_issue_count: validationOutput.validationIssues.length,
          }).eq('id', runId);

          await supabase.from('documents').update({
            processing_status: validationOutput.overallStatus,
            document_date: docDate,
            extracted_count: validationOutput.validatedObservations.length,
            processing_error: null,
            updated_at: new Date().toISOString(),
          }).eq('id', documentId);
        }

        await loadLiveUserData(currentUser.id, activeSessionTokenRef.current);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Retry extraction failed';
        await supabase
          .from('documents')
          .update({ processing_status: 'failed', processing_error: errorMsg, updated_at: new Date().toISOString() })
          .eq('id', documentId);

        setDocuments(prev => prev.map(d => d.id === documentId ? {
          ...d,
          processingStatus: 'failed',
          processingError: errorMsg,
          updatedAt: new Date().toISOString(),
        } : d));
      }
    } else {
      // Local mode retry without backend: Record failure explicitly. Never invent synthetic data.
      const errorMsg = 'Extraction service unavailable. Cannot retry extraction without active backend service.';
      const runId = generateUUID();

      const failedRun: ExtractionRun = {
        id: runId,
        documentId,
        modelName: 'none',
        status: 'failed',
        startedAt: nowIso,
        completedAt: new Date().toISOString(),
        extractedCount: 0,
        validationIssueCount: 0,
        errorMessage: errorMsg,
        durationMs: 50,
      };

      setRuns(prev => [failedRun, ...prev]);
      setDocuments(prev => prev.map(d => d.id === documentId ? {
        ...d,
        processingStatus: 'failed',
        processingError: errorMsg,
        updatedAt: new Date().toISOString(),
      } : d));
    }
  };

  const uploadDocument = async (file: File, title: string, docDate?: string): Promise<string> => {
    if (!currentUser) {
      throw new Error('User must be authenticated to upload documents.');
    }

    const filename = title || file.name;
    const dateStr = docDate || new Date().toISOString().split('T')[0];

    try {
      const result = await executeDocumentExtractionPipeline(
        file,
        filename,
        dateStr,
        currentUser.id
      );

      setDocuments(prev => [result.document, ...prev]);
      setRuns(prev => [result.run, ...prev]);
      setObservations(prev => [...result.observations, ...prev]);
      setValidationIssues(prev => [...result.validationIssues, ...prev]);

      return result.document.id;
    } catch (err: unknown) {
      // If error contains failedDocument and failedRun, register failure into state
      const customErr = err as { failedDocument?: LabDocument; failedRun?: ExtractionRun; message?: string };
      if (customErr.failedDocument && customErr.failedRun) {
        setDocuments(prev => [customErr.failedDocument!, ...prev]);
        setRuns(prev => [customErr.failedRun!, ...prev]);
      }
      throw err;
    }
  };

  return (
    <HealthDataContext.Provider
      value={{
        profile,
        activeScreen,
        setActiveScreen,
        documents,
        runs,
        observations,
        validationIssues,
        kpis,
        isDemoMode,
        selectedDocumentIdFilter,
        setSelectedDocumentIdFilter,
        isRefreshing,
        lastRefreshedAt,
        refreshData,
        updateObservation,
        confirmObservation,
        rejectObservation,
        batchConfirmValid,
        uploadDocument,
        retryProcessing,
        resolveIssue,
      }}
    >
      {children}
    </HealthDataContext.Provider>
  );
};

export const useHealthData = () => {
  const context = useContext(HealthDataContext);
  if (!context) {
    throw new Error('useHealthData must be used within a HealthDataProvider');
  }
  return context;
};
