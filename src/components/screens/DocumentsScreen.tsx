import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  ExternalLink, 
  RefreshCw, 
  Lock, 
  Upload
} from 'lucide-react';
import { useHealthData } from '../../context/HealthDataContext';
import { StatusBadge } from '../common/StatusBadge';

export const DocumentsScreen: React.FC = () => {
  const { 
    documents, 
    retryProcessing, 
    setSelectedDocumentIdFilter, 
    setActiveScreen 
  } = useHealthData();

  const [search, setSearch] = useState('');

  const filteredDocs = documents.filter(doc => 
    doc.originalFilename.toLowerCase().includes(search.toLowerCase()) ||
    (doc.documentDate && doc.documentDate.includes(search))
  );

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            Source Document Repository
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200">
              {documents.length} Managed Files
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Original immutable laboratory records stored in encrypted Supabase storage with cryptographic checksum traceability.
          </p>
        </div>

        <button
          onClick={() => setActiveScreen('upload')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-subtle transition-colors shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-subtle flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search documents by filename or date..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>Access Restricted via Storage RLS Policies</span>
        </div>
      </div>

      {/* Documents Grid / Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-subtle overflow-hidden">
        {filteredDocs.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {documents.length === 0 ? 'No documents ingested yet' : 'No matching documents'}
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {documents.length === 0 
                ? 'Upload your medical laboratory report (PDF, PNG, or JPEG) to begin automated extraction and clinical validation.' 
                : `No document records match "${search}". Try searching by another keyword.`}
            </p>
            {documents.length === 0 && (
              <button
                onClick={() => setActiveScreen('upload')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-subtle transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload First Document</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Original Filename</th>
                  <th className="px-4 py-3">Report Date</th>
                  <th className="px-4 py-3">File Size & Format</th>
                  <th className="px-4 py-3">Processing Status</th>
                  <th className="px-4 py-3">Extracted Count</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded bg-slate-100 text-slate-600">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate max-w-xs">
                            {doc.originalFilename}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate max-w-xs">
                            Path: {doc.storagePath}
                          </div>
                          {doc.processingError && (
                            <div className="text-[11px] text-rose-600 font-medium truncate max-w-xs mt-0.5" title={doc.processingError}>
                              Reason: {doc.processingError}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap font-mono text-slate-600">
                      {doc.documentDate || 'Unspecified'}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap font-mono text-slate-500">
                      {(doc.fileSizeBytes / 1024).toFixed(1)} KB • {doc.mimeType}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <StatusBadge type="processing" value={doc.processingStatus} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap font-medium text-slate-900">
                      {doc.extractedCount || 0} observations
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {doc.processingStatus === 'failed' ? (
                          <button
                            onClick={() => retryProcessing(doc.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 px-2.5 py-1 rounded border border-rose-200"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Retry
                          </button>
                        ) : doc.processingStatus === 'review_required' ? (
                          <button
                            onClick={() => {
                              setSelectedDocumentIdFilter(doc.id);
                              setActiveScreen('review');
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200"
                          >
                            Review Obs
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedDocumentIdFilter(doc.id);
                              setActiveScreen('timeline');
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline"
                          >
                            <span>View Timeline</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
