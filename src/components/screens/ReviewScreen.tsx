import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Edit2, 
  AlertTriangle, 
  Filter, 
  Save, 
  CheckCheck,
  FileText,
  Search,
  ExternalLink
} from 'lucide-react';
import { useHealthData } from '../../context/HealthDataContext';
import type { Observation } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

export const ReviewScreen: React.FC = () => {
  const { 
    observations, 
    documents, 
    validationIssues, 
    confirmObservation, 
    rejectObservation, 
    updateObservation,
    batchConfirmValid,
    selectedDocumentIdFilter,
    setSelectedDocumentIdFilter,
    setActiveScreen
  } = useHealthData();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('all');
  const [editingObsId, setEditingObsId] = useState<string | null>(null);

  // Edit buffer
  const [editForm, setEditForm] = useState<Partial<Observation>>({});

  // Filter observations
  const filteredObservations = observations.filter(obs => {
    const matchesDoc = !selectedDocumentIdFilter || obs.documentId === selectedDocumentIdFilter;
    const matchesStatus = statusFilter === 'all' || obs.verifiedByUser === statusFilter;
    const matchesSearch = !searchQuery || 
      obs.rawTestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obs.canonicalTestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obs.originalUnit.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDoc && matchesStatus && matchesSearch;
  });

  const pendingCount = observations.filter(o => 
    (!selectedDocumentIdFilter || o.documentId === selectedDocumentIdFilter) &&
    o.verifiedByUser === 'pending'
  ).length;

  const startEditing = (obs: Observation) => {
    setEditingObsId(obs.id);
    setEditForm({
      canonicalTestName: obs.canonicalTestName,
      valueNumeric: obs.valueNumeric,
      valueText: obs.valueText,
      originalUnit: obs.originalUnit,
      referenceLow: obs.referenceLow,
      referenceHigh: obs.referenceHigh,
      observationDate: obs.observationDate,
    });
  };

  const saveEdit = (obsId: string) => {
    updateObservation(obsId, editForm);
    setEditingObsId(null);
  };

  const cancelEdit = () => {
    setEditingObsId(null);
    setEditForm({});
  };

  return (
    <div className="space-y-6">
      {/* Header and Banner */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Observation Extraction Review
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-800 border border-amber-200">
              {pendingCount} Awaiting Confirmation
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review parsed biomarkers, correct OCR discrepancies, and audit deterministic validation warnings before approving to health timeline.
          </p>
        </div>

        {/* Batch actions */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {pendingCount > 0 && (
            <button
              onClick={() => batchConfirmValid(selectedDocumentIdFilter || undefined)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-subtle transition-colors shrink-0"
            >
              <CheckCheck className="w-4 h-4" />
              Batch Confirm Valid
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-subtle flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search biomarker, unit, or LOINC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Document filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDocumentIdFilter || ''}
              onChange={(e) => setSelectedDocumentIdFilter(e.target.value || null)}
              className="text-xs rounded border border-slate-300 px-2 py-1 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">All Documents ({documents.length})</option>
              {documents.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.originalFilename.length > 30 ? doc.originalFilename.slice(0, 30) + '...' : doc.originalFilename}
                </option>
              ))}
            </select>
          </div>

          {/* Verification Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'confirmed' | 'rejected')}
              className="text-xs rounded border border-slate-300 px-2 py-1 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Awaiting Review</option>
              <option value="confirmed">Confirmed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Review Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Biomarker / Test Name</th>
                <th className="px-3 py-3">Value</th>
                <th className="px-3 py-3">Unit</th>
                <th className="px-3 py-3">Reference Range</th>
                <th className="px-3 py-3">Obs. Date</th>
                <th className="px-3 py-3">Validation</th>
                <th className="px-3 py-3">Source Doc</th>
                <th className="px-3 py-3">User Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredObservations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    No observations found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredObservations.map((obs) => {
                  const isEditing = editingObsId === obs.id;
                  const issue = validationIssues.find(i => i.observationId === obs.id && !i.resolved);

                  return (
                    <tr 
                      key={obs.id} 
                      className={`hover:bg-slate-50/70 transition-colors ${
                        obs.verifiedByUser === 'pending' ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Biomarker */}
                      <td className="px-4 py-3.5">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.canonicalTestName ?? obs.canonicalTestName}
                            onChange={(e) => setEditForm(prev => ({ ...prev, canonicalTestName: e.target.value }))}
                            className="w-full px-2 py-1 text-xs border border-teal-500 rounded font-medium"
                          />
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              {obs.canonicalTestName}
                              {obs.userCorrected && (
                                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-sky-100 text-sky-800 border border-sky-200">
                                  edited
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate max-w-xs">
                              Raw: "{obs.rawTestName}" {obs.loincCode && `• LOINC: ${obs.loincCode}`}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Value */}
                      <td className="px-3 py-3.5 font-mono whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            step="any"
                            value={editForm.valueNumeric ?? (obs.valueNumeric ?? '')}
                            onChange={(e) => setEditForm(prev => ({ 
                              ...prev, 
                              valueNumeric: e.target.value ? parseFloat(e.target.value) : null 
                            }))}
                            className="w-20 px-2 py-1 text-xs border border-teal-500 rounded font-mono"
                          />
                        ) : (
                          <span className="font-bold text-slate-900">
                            {obs.valueNumeric !== null ? obs.valueNumeric : (obs.valueText || 'N/A')}
                          </span>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.originalUnit ?? obs.originalUnit}
                            onChange={(e) => setEditForm(prev => ({ ...prev, originalUnit: e.target.value }))}
                            className="w-20 px-2 py-1 text-xs border border-teal-500 rounded font-mono"
                          />
                        ) : (
                          <span className={obs.originalUnit ? 'text-slate-700 font-mono text-xs' : 'text-amber-600 font-semibold italic'}>
                            {obs.originalUnit || 'Missing Unit'}
                          </span>
                        )}
                      </td>

                      {/* Reference Range */}
                      <td className="px-3 py-3.5 whitespace-nowrap font-mono text-slate-600 text-xs">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="any"
                              placeholder="Low"
                              value={editForm.referenceLow ?? (obs.referenceLow ?? '')}
                              onChange={(e) => setEditForm(prev => ({ ...prev, referenceLow: e.target.value ? parseFloat(e.target.value) : null }))}
                              className="w-14 px-1.5 py-1 text-xs border border-teal-500 rounded"
                            />
                            <span>-</span>
                            <input
                              type="number"
                              step="any"
                              placeholder="High"
                              value={editForm.referenceHigh ?? (obs.referenceHigh ?? '')}
                              onChange={(e) => setEditForm(prev => ({ ...prev, referenceHigh: e.target.value ? parseFloat(e.target.value) : null }))}
                              className="w-14 px-1.5 py-1 text-xs border border-teal-500 rounded"
                            />
                          </div>
                        ) : (
                          obs.referenceLow !== null || obs.referenceHigh !== null ? (
                            <span>
                              {obs.referenceLow !== null ? obs.referenceLow : '<'} - {obs.referenceHigh !== null ? obs.referenceHigh : '>'}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">None reported</span>
                          )
                        )}
                      </td>

                      {/* Observation Date */}
                      <td className="px-3 py-3.5 whitespace-nowrap font-mono text-slate-600 text-xs">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editForm.observationDate ?? obs.observationDate}
                            onChange={(e) => setEditForm(prev => ({ ...prev, observationDate: e.target.value }))}
                            className="px-1.5 py-1 text-xs border border-teal-500 rounded font-mono"
                          />
                        ) : (
                          obs.observationDate
                        )}
                      </td>

                      {/* Validation Status & Warning Note */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <div className="space-y-1">
                          <StatusBadge type="validation" value={obs.validationStatus} />
                          {issue && (
                            <div 
                              title={issue.message} 
                              className="flex items-center gap-1 text-[11px] text-amber-700 font-medium cursor-help"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate max-w-[120px]">{issue.issueType.replace('_', ' ')}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Source Document */}
                      <td className="px-3 py-3.5">
                        <div 
                          onClick={() => {
                            setSelectedDocumentIdFilter(obs.documentId);
                            setActiveScreen('documents');
                          }}
                          className="text-[11px] text-teal-700 hover:text-teal-900 cursor-pointer font-medium flex items-center gap-1 truncate max-w-[130px]"
                          title={obs.sourceDocumentName || obs.documentId}
                        >
                          <span className="truncate">{obs.sourceDocumentName || obs.documentId}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </div>
                      </td>

                      {/* Verification Status */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <StatusBadge type="verification" value={obs.verifiedByUser} />
                      </td>

                      {/* Row Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => saveEdit(obs.id)}
                              className="p-1 rounded text-teal-700 hover:bg-teal-50 font-medium flex items-center gap-0.5"
                              title="Save Changes"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 rounded text-slate-500 hover:bg-slate-100"
                              title="Cancel"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => startEditing(obs)}
                              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                              title="Edit Observation"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {obs.verifiedByUser !== 'confirmed' && (
                              <button
                                onClick={() => confirmObservation(obs.id)}
                                className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded"
                                title="Confirm Observation"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}

                            {obs.verifiedByUser !== 'rejected' && (
                              <button
                                onClick={() => rejectObservation(obs.id)}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                                title="Reject Observation"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
