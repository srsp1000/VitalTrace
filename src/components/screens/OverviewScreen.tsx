import React from 'react';
import { 
  FileText, 
  Activity, 
  Clock, 
  AlertTriangle, 
  Upload, 
  ArrowRight, 
  ChevronRight,
  ShieldAlert,
  Database
} from 'lucide-react';
import { useHealthData } from '../../context/HealthDataContext';
import { MetricCard } from '../common/MetricCard';
import { StatusBadge } from '../common/StatusBadge';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip 
} from 'recharts';

export const OverviewScreen: React.FC = () => {
  const { 
    documents, 
    observations, 
    validationIssues, 
    kpis, 
    setActiveScreen, 
    setSelectedDocumentIdFilter 
  } = useHealthData();

  const recentDocs = [...documents]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Glucose recent trajectory data
  const glucoseData = observations
    .filter(o => o.canonicalTestName === 'Fasting Glucose' && o.valueNumeric !== null)
    .sort((a, b) => new Date(a.observationDate).getTime() - new Date(b.observationDate).getTime())
    .map(o => ({
      date: o.observationDate.slice(5),
      value: o.valueNumeric,
      unit: o.originalUnit,
    }));

  // Cholesterol recent trajectory data
  const cholesterolData = observations
    .filter(o => o.canonicalTestName === 'Total Cholesterol' && o.valueNumeric !== null)
    .sort((a, b) => new Date(a.observationDate).getTime() - new Date(b.observationDate).getTime())
    .map(o => ({
      date: o.observationDate.slice(5),
      value: o.valueNumeric,
      unit: o.originalUnit,
    }));

  const pendingObservations = observations.filter(o => o.verifiedByUser === 'pending');
  const unresolvedIssues = validationIssues.filter(i => !i.resolved);

  return (
    <div className="space-y-6">
      {/* Portfolio & Context Notice */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-100">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              Clinical Health Intelligence Platform
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Deterministic Validation Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive laboratory ingestion, structured LOINC mapping, physiological bounds validation, and longitudinal health trajectories.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveScreen('upload')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-subtle transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload New Report
          </button>
        </div>
      </div>

      {/* 4 Core Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Uploaded Documents"
          value={documents.length}
          subtitle={`${kpis.processedSuccess} completed, ${kpis.processingFailures} failed`}
          icon={FileText}
          iconColor="text-slate-700"
          badge={{
            text: `${kpis.processedSuccess} verified`,
            type: 'neutral',
          }}
          onClick={() => setActiveScreen('documents')}
        />

        <MetricCard
          title="Total Observations"
          value={observations.length}
          subtitle={`${kpis.confirmedCount} confirmed by user`}
          icon={Activity}
          iconColor="text-teal-600"
          badge={{
            text: `${kpis.confirmedCount} confirmed`,
            type: 'success',
          }}
          onClick={() => setActiveScreen('timeline')}
        />

        <MetricCard
          title="Awaiting Review"
          value={pendingObservations.length}
          subtitle="Extractions requiring user confirmation"
          icon={Clock}
          iconColor="text-amber-600"
          badge={{
            text: pendingObservations.length > 0 ? 'Action Needed' : 'All Clear',
            type: pendingObservations.length > 0 ? 'warning' : 'success',
          }}
          onClick={() => setActiveScreen('review')}
        />

        <MetricCard
          title="Validation Issues"
          value={unresolvedIssues.length}
          subtitle={`${kpis.validationPassRate !== null ? `${kpis.validationPassRate}%` : 'N/A'} validation pass rate`}
          icon={AlertTriangle}
          iconColor="text-rose-600"
          badge={{
            text: `${kpis.validationPassRate !== null ? `${kpis.validationPassRate}%` : 'N/A'} pass`,
            type: (kpis.validationPassRate ?? 0) >= 80 ? 'success' : 'danger',
          }}
          onClick={() => setActiveScreen('data-quality')}
        />
      </div>

      {/* Action Banner if items need review */}
      {pendingObservations.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-amber-100 text-amber-800">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                Human-in-the-Loop Review Needed ({pendingObservations.length} Observations)
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                New observations were parsed from recent uploads. Review units, values, and flags before confirming to permanent history.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveScreen('review')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white transition-colors shadow-subtle shrink-0"
          >
            Review Now
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Split Section: Recent Documents & Biomarker Previews */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Documents */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-subtle overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Recently Processed Documents
              </h3>
              <p className="text-xs text-slate-500">
                Latest lab reports ingested into the private storage bucket
              </p>
            </div>
            <button
              onClick={() => setActiveScreen('documents')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              View all
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentDocs.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-xs font-semibold text-slate-800">No laboratory records uploaded yet</div>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Upload your laboratory reports (PDF, PNG, or JPEG) to begin structured clinical data extraction and longitudinal tracking.
              </p>
              <button
                onClick={() => setActiveScreen('upload')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-subtle transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload First Report</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Document Title</th>
                    <th className="px-4 py-3">Obs. Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Extracted</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {recentDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-900 truncate max-w-xs">
                          {doc.originalFilename}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {(doc.fileSizeBytes / 1024).toFixed(0)} KB • {doc.mimeType}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                        {doc.documentDate || 'Unspecified'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge type="processing" value={doc.processingStatus} />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-medium text-slate-900">
                        {doc.extractedCount || 0} observations
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {doc.processingStatus === 'review_required' ? (
                          <button
                            onClick={() => {
                              setSelectedDocumentIdFilter(doc.id);
                              setActiveScreen('review');
                            }}
                            className="text-xs font-semibold text-amber-700 hover:text-amber-800 underline"
                          >
                            Review
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedDocumentIdFilter(doc.id);
                              setActiveScreen('timeline');
                            }}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900"
                          >
                            View Obs
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Col: Quick Longitudinal Sparklines */}
        <div className="space-y-4">
          {/* Card 1: Fasting Glucose Trajectory */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-subtle">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-bold text-slate-900">Fasting Glucose</span>
                <span className="ml-1 text-[11px] text-slate-500 font-mono">(mg/dL)</span>
              </div>
              <button
                onClick={() => setActiveScreen('trends')}
                className="text-[11px] text-teal-700 hover:text-teal-800 font-medium flex items-center"
              >
                Deep Dive <ChevronRight className="w-3 h-3 ml-0.5" />
              </button>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {glucoseData.length > 0 ? `${glucoseData[glucoseData.length - 1].value} mg/dL` : 'No data'}
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Normal range: 70 - 99 mg/dL
            </p>
            <div className="h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={glucoseData}>
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      color: '#FFF',
                      fontSize: '11px',
                      borderRadius: '6px'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#0D9488"
                    strokeWidth={2}
                    dot={{ fill: '#0D9488', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 2: Total Cholesterol Trajectory */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-subtle">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-bold text-slate-900">Total Cholesterol</span>
                <span className="ml-1 text-[11px] text-slate-500 font-mono">(mg/dL)</span>
              </div>
              <button
                onClick={() => setActiveScreen('trends')}
                className="text-[11px] text-teal-700 hover:text-teal-800 font-medium flex items-center"
              >
                Deep Dive <ChevronRight className="w-3 h-3 ml-0.5" />
              </button>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {cholesterolData.length > 0 ? `${cholesterolData[cholesterolData.length - 1].value} mg/dL` : 'No data'}
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Desirable range: 125 - 200 mg/dL
            </p>
            <div className="h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cholesterolData}>
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      color: '#FFF',
                      fontSize: '11px',
                      borderRadius: '6px'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={{ fill: '#2563EB', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
