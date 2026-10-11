import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight,
  Shield,
  FileCheck,
  Calendar,
  Lock
} from 'lucide-react';
import { useHealthData } from '../../context/HealthDataContext';

export const UploadScreen: React.FC = () => {
  const { uploadDocument, setActiveScreen, setSelectedDocumentIdFilter, documents } = useHealthData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docDate, setDocDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Pipeline status during upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>('');
  const [completedDocId, setCompletedDocId] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    setErrorMsg(null);

    // Validate type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Unsupported file format. Please upload a PDF, PNG, or JPEG laboratory document.');
      return;
    }

    // Validate size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorMsg('File size exceeds the 10 MB limit. Please optimize or compress your document.');
      return;
    }

    setSelectedFile(file);
    if (!docTitle) {
      // Auto populate clean title from filename
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setDocTitle(cleanName);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Please select a file to ingest.');
      return;
    }

    try {
      setIsUploading(true);
      setErrorMsg(null);
      setUploadStep('Encrypting and storing document in private storage bucket...');

      setTimeout(() => {
        setUploadStep('Extracting biomarkers & values via Gemini Structured JSON output...');
      }, 800);

      const docId = await uploadDocument(selectedFile, docTitle || selectedFile.name, docDate);
      
      setUploadStep('Applying deterministic clinical validation rules...');
      setTimeout(() => {
        setIsUploading(false);
        setCompletedDocId(docId);
      }, 500);

    } catch (err: unknown) {
      setIsUploading(false);
      let message = 'Upload failed. Please retry.';
      if (err instanceof Error) {
        message = err.message;
        try {
          const parsed = JSON.parse(message);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.message) {
            message = parsed
              .map((p: { path?: string[]; message?: string }) => 
                `${p.path && p.path.length > 0 ? p.path.join('.') + ': ' : ''}${p.message || 'Validation error'}`
              )
              .join('; ');
          }
        } catch {
          // Message is standard text, keep as-is
        }
      }
      setErrorMsg(message);
    }
  };

  const handleResetForm = () => {
    setSelectedFile(null);
    setDocTitle('');
    setCompletedDocId(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Scope and Security Notice */}
      <div className="bg-slate-900 text-slate-100 rounded-lg p-4 border border-slate-800 shadow-card flex items-start gap-3">
        <div className="p-2 rounded bg-slate-800 text-teal-400 shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div className="text-xs space-y-1">
          <div className="font-semibold text-white flex items-center gap-2">
            Private Medical Storage & Scope Boundary
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800">
              HIPAA Design Principles
            </span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Uploaded laboratory documents are encrypted at rest using Supabase Private Storage with strict user-level Row-Level Security (RLS). Only laboratory reports are supported (CBC, metabolic panels, lipid profiles, thyroid panels).
          </p>
        </div>
      </div>

      {completedDocId ? (
        (() => {
          const completedDoc = documents.find(d => d.id === completedDocId);
          const obsCount = completedDoc?.extractedCount ?? 0;

          if (obsCount === 0) {
            return (
              <div className="bg-white rounded-lg border border-amber-200 p-8 shadow-card text-center space-y-5">
                <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    No Clinical Observations Detected
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                    The extraction service processed your document, but zero laboratory test observations were detected. Under VitalTrace integrity rules, zero invented values are generated.
                  </p>
                </div>

                <div className="p-4 bg-amber-50/60 rounded-lg border border-amber-200/80 max-w-md mx-auto text-left text-xs text-slate-700 space-y-2">
                  <span className="font-semibold text-amber-900 block text-[11px] uppercase tracking-wider">
                    Common Causes & Solutions:
                  </span>
                  <ul className="space-y-1.5 list-disc list-inside text-[11px] text-slate-600">
                    <li>
                      <strong className="text-slate-800">Password-Protected PDF:</strong> Many pathology labs lock files with your DOB or phone number. Please unlock/decrypt the PDF before uploading.
                    </li>
                    <li>
                      <strong className="text-slate-800">Non-Laboratory Document:</strong> Invoices, prescriptions, and clinical notes contain no test rows (CBC, metabolic panels, lipids are supported).
                    </li>
                    <li>
                      <strong className="text-slate-800">Scanned Image Resolution:</strong> If uploading a photo or low-resolution scan, ensure test tables and numbers are legible.
                    </li>
                  </ul>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleResetForm}
                    className="px-4 py-2 rounded-md text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-subtle"
                  >
                    Upload Another Report
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDocumentIdFilter(completedDocId);
                      setActiveScreen('documents');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 transition-colors shadow-subtle"
                  >
                    <span>View in Repository</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div className="bg-white rounded-lg border border-emerald-200 p-8 shadow-card text-center space-y-5">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Extraction Pipeline Succeeded
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                  Observations have been extracted and evaluated against clinical validation rules. Please review the records before committing to your permanent history.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 max-w-sm mx-auto text-left text-xs space-y-1 font-mono">
                <div className="flex justify-between text-slate-500">
                  <span>Document ID:</span>
                  <span className="text-slate-900 font-semibold truncate max-w-[180px]">{completedDocId}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Status:</span>
                  <span className={completedDoc?.processingStatus === 'completed' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                    {completedDoc?.processingStatus === 'completed' ? 'Completed' : 'Review Required'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Extracted Count:</span>
                  <span className="text-teal-700 font-semibold">
                    {obsCount} Observations
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleResetForm}
                  className="px-4 py-2 rounded-md text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-subtle"
                >
                  Upload Another Report
                </button>
                <button
                  onClick={() => {
                    setSelectedDocumentIdFilter(completedDocId);
                    setActiveScreen('review');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-subtle"
                >
                  <span>Review Extracted Values</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })()
      ) : (
        /* Upload Form */
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 shadow-card p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-rose-900 block">{errorMsg}</span>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    Under VitalTrace clinical data integrity rules, synthetic fallback engines have been permanently disabled. When the backend extraction service is offline or unreachable, zero invented observations are generated. The document has been recorded with a failed processing state in your private repository.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1 border-t border-rose-200/60 pl-6">
                <button
                  type="button"
                  onClick={() => setActiveScreen('documents')}
                  className="text-[11px] font-semibold text-rose-800 hover:text-rose-950 underline"
                >
                  View in Document Repository
                </button>
                <span className="text-rose-300">•</span>
                <button
                  type="button"
                  onClick={() => setActiveScreen('settings')}
                  className="text-[11px] font-semibold text-rose-800 hover:text-rose-950 underline"
                >
                  Review Backend Architecture & Settings
                </button>
              </div>
            </div>
          )}

          {/* Drag & Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragActive 
                ? 'border-teal-500 bg-teal-50/50' 
                : selectedFile 
                ? 'border-teal-400 bg-slate-50' 
                : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 mx-auto flex items-center justify-center mb-3">
              {selectedFile ? (
                <FileCheck className="w-6 h-6 text-teal-600" />
              ) : (
                <UploadCloud className="w-6 h-6 text-slate-500" />
              )}
            </div>

            {selectedFile ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 truncate max-w-md mx-auto">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Document'}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetForm();
                  }}
                  className="text-xs font-semibold text-rose-600 hover:underline pt-1 inline-block"
                >
                  Remove & Choose Another
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">
                  Click to select or drag and drop your laboratory report
                </p>
                <p className="text-xs text-slate-500">
                  Supported formats: PDF, JPG, JPEG, PNG (maximum size: 10 MB)
                </p>
              </div>
            )}
          </div>

          {/* Form Fields: Title and Observation Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Report Title / Lab Provider
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g., LabCorp Comprehensive Metabolic"
                  className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Optional custom label for source document repository
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Report / Specimen Date
              </label>
              <input
                type="date"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Used if observation date cannot be parsed from the document
              </p>
            </div>
          </div>

          {/* Progress Indicator during upload */}
          {isUploading && (
            <div className="p-4 rounded-lg bg-teal-50/70 border border-teal-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-teal-900">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-teal-600 animate-spin" />
                  <span>Processing Extraction Pipeline...</span>
                </div>
                <span className="text-[11px] font-mono text-teal-700">In Progress</span>
              </div>
              <div className="w-full bg-teal-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-teal-600 h-1.5 rounded-full animate-pulse w-3/4"></div>
              </div>
              <p className="text-[11px] text-teal-800 font-mono">
                {uploadStep}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Shield className="w-3.5 h-3.5 text-teal-600" />
              <span>Deterministic validation enabled</span>
            </div>

            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-md text-xs font-semibold text-white shadow-subtle transition-colors ${
                !selectedFile || isUploading
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Ingesting Document...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  Start Ingestion Pipeline
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
