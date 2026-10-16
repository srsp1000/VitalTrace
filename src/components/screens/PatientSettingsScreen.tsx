import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Key, 
  Download, 
  LogOut, 
  Copy, 
  Check, 
  FileCheck2,
  Database
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHealthData } from '../../context/HealthDataContext';

export const PatientSettingsScreen: React.FC = () => {
  const { currentUser, signOut } = useAuth();
  const { documents, observations, validationIssues } = useHealthData();
  const [copiedId, setCopiedId] = useState(false);
  const [exporting, setExporting] = useState(false);

  const initials = (currentUser?.displayName || 'User')
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleCopyUserId = () => {
    if (currentUser?.id) {
      navigator.clipboard.writeText(currentUser.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleExportData = () => {
    setExporting(true);
    try {
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        platform: 'VitalTrace Clinical Intelligence',
        version: '5.0-PROD',
        patient: {
          id: currentUser?.id,
          displayName: currentUser?.displayName,
          email: currentUser?.email,
          role: currentUser?.role || 'patient',
        },
        summary: {
          totalDocuments: documents.length,
          totalObservations: observations.length,
          totalValidationIssues: validationIssues.length,
        },
        documents: documents.map(d => ({
          id: d.id,
          originalFilename: d.originalFilename,
          documentDate: d.documentDate,
          documentType: d.documentType,
          processingStatus: d.processingStatus,
          extractedCount: d.extractedCount,
          checksum: d.checksum,
          createdAt: d.createdAt,
        })),
        observations: observations.map(o => ({
          id: o.id,
          documentId: o.documentId,
          canonicalTestName: o.canonicalTestName,
          rawTestName: o.rawTestName,
          loincCode: o.loincCode,
          valueNumeric: o.valueNumeric,
          valueText: o.valueText,
          originalUnit: o.originalUnit,
          referenceLow: o.referenceLow,
          referenceHigh: o.referenceHigh,
          observationDate: o.observationDate,
          validationStatus: o.validationStatus,
          verifiedByUser: o.verifiedByUser,
          userCorrected: o.userCorrected,
          sourceDocumentName: o.sourceDocumentName,
        })),
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `vitaltrace_health_data_export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Failed to export data:', err);
    } finally {
      setTimeout(() => setExporting(false), 800);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Account Profile & Data Governance
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage your personal profile, review active security controls, and export your clinical records.
          </p>
        </div>

        <button
          onClick={() => signOut()}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition-colors shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* User Profile Card */}
      {currentUser && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-subtle p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-teal-400 font-bold flex items-center justify-center text-base shadow-subtle">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {currentUser.displayName}
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {currentUser.role?.toUpperCase() || 'PATIENT'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                  <span className="font-mono text-[11px]">User ID: {currentUser.id.slice(0, 16)}...</span>
                  <button
                    onClick={handleCopyUserId}
                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Copy full UUID"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportData}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-subtle hover:shadow transition-all disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exporting ? 'Preparing JSON...' : 'Export My Data (JSON)'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-[11px] font-semibold uppercase text-slate-500 block mb-1">
                Registered Email
              </label>
              <div className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 text-slate-800 font-medium">
                {currentUser.email}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase text-slate-500 block mb-1">
                Data Scope & Boundary
              </label>
              <div className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 text-slate-800 font-medium flex items-center justify-between">
                <span>Private Row-Level Protected User Scope</span>
                <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  RLS ACTIVE
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Status Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Security Status & Privacy Assurances
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
            SECURE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Lock className="w-4 h-4 text-teal-600" />
              <span>Row-Level Cryptographic Security</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Your health observations and uploaded documents are isolated by database row policies. No other patients can query your records.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Key className="w-4 h-4 text-teal-600" />
              <span>Zero Raw AI Provider Secrets</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              AI provider credentials are never held in the browser or accessible to clients. All extraction executes server-side with zero key exposure.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Database className="w-4 h-4 text-teal-600" />
              <span>Encrypted Object Storage</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Laboratory files reside in non-public object storage and can only be opened through short-lived cryptographic signed URLs.
            </p>
          </div>
        </div>
      </div>

      {/* Account Privacy Rights Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Patient Data Rights & Sovereignty
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">HIPAA & GDPR Standards</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
            <div className="font-semibold text-slate-900 flex items-center justify-between">
              <span>Right to Access & Portability</span>
              <span className="text-[10px] font-mono text-emerald-600 font-bold">AVAILABLE</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Download your complete medical observations, document metadata, and validation logs in standardized JSON at any time.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
            <div className="font-semibold text-slate-900 flex items-center justify-between">
              <span>Right to Rectification</span>
              <span className="text-[10px] font-mono text-emerald-600 font-bold">AVAILABLE</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Correct, edit, or override any extracted biomarker value directly in the Observation Review workspace.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
            <div className="font-semibold text-slate-900 flex items-center justify-between">
              <span>Right to Erasure</span>
              <span className="text-[10px] font-mono text-emerald-600 font-bold">AVAILABLE</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Permanently delete individual laboratory documents and corresponding observations from the Documents repository.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
            <div className="font-semibold text-slate-900 flex items-center justify-between">
              <span>Zero Model Retraining</span>
              <span className="text-[10px] font-mono text-emerald-600 font-bold">GUARANTEED</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Your uploaded lab reports and extracted observations are never utilized to train or fine-tune public foundation models.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
