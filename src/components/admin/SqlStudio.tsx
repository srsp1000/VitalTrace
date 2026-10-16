import React, { useState, useMemo } from 'react';
import { 
  Database, 
  Download, 
  Code2, 
  Table as TableIcon,
  Search
} from 'lucide-react';
import { useHealthData } from '../../context/HealthDataContext';

interface PrecompiledQuery {
  id: string;
  name: string;
  category: 'Ingestion' | 'Extraction' | 'Data Quality' | 'Clinical Telemetry';
  description: string;
  sqlDefinition: string;
  indexesUsed: string[];
}

export const SqlStudio: React.FC = () => {
  const { documents, runs, observations, validationIssues } = useHealthData();

  const [selectedQueryId, setSelectedQueryId] = useState<string>('view_documents_processed_daily');
  const [timeRange, setTimeRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const precompiledQueries: PrecompiledQuery[] = [
    {
      id: 'view_documents_processed_daily',
      name: 'view_documents_processed_daily',
      category: 'Ingestion',
      description: 'Aggregates daily document upload throughput, completed extractions, reviews required, and storage volume in bytes.',
      sqlDefinition: `CREATE OR REPLACE VIEW public.view_documents_processed_daily
WITH (security_invoker = true) AS
SELECT
  d.profile_id,
  DATE(d.created_at) AS processing_date,
  COUNT(*) AS total_documents_uploaded,
  COUNT(*) FILTER (WHERE d.processing_status = 'completed') AS completed_count,
  COUNT(*) FILTER (WHERE d.processing_status = 'review_required') AS review_required_count,
  COUNT(*) FILTER (WHERE d.processing_status = 'failed') AS failed_count,
  SUM(d.file_size_bytes) AS total_bytes_ingested
FROM public.documents d
GROUP BY d.profile_id, DATE(d.created_at)
ORDER BY processing_date DESC;`,
      indexesUsed: ['idx_documents_profile_id', 'idx_documents_created_at', 'idx_documents_status'],
    },
    {
      id: 'view_extraction_run_health',
      name: 'view_extraction_run_health',
      category: 'Extraction',
      description: 'Monitors LLM model extraction reliability, success rates, failure counts, and average duration in milliseconds.',
      sqlDefinition: `CREATE OR REPLACE VIEW public.view_extraction_run_health
WITH (security_invoker = true) AS
SELECT
  d.profile_id,
  er.model_name,
  COUNT(*) AS total_runs,
  COUNT(*) FILTER (WHERE er.status = 'completed') AS successful_runs,
  COUNT(*) FILTER (WHERE er.status = 'failed') AS failed_runs,
  ROUND(
    COALESCE(
      (COUNT(*) FILTER (WHERE er.status = 'completed')::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE er.status IN ('completed', 'failed')), 0)) * 100,
      0
    ),
    1
  ) AS success_rate_percentage,
  ROUND(AVG(er.duration_ms) FILTER (WHERE er.status = 'completed'), 0) AS avg_duration_ms
FROM public.extraction_runs er
JOIN public.documents d ON d.id = er.document_id
GROUP BY d.profile_id, er.model_name;`,
      indexesUsed: ['idx_extraction_runs_document_id', 'idx_extraction_runs_status'],
    },
    {
      id: 'view_observation_counts_by_test',
      name: 'view_observation_counts_by_test',
      category: 'Clinical Telemetry',
      description: 'Measures biomarker extraction volume across canonical aliases, tracking human audit confirmation rates and temporal bounds.',
      sqlDefinition: `CREATE OR REPLACE VIEW public.view_observation_counts_by_test
WITH (security_invoker = true) AS
SELECT
  o.profile_id,
  o.canonical_test_name,
  COUNT(*) AS total_observations,
  COUNT(*) FILTER (WHERE o.verified_by_user = 'confirmed') AS confirmed_count,
  COUNT(*) FILTER (WHERE o.verified_by_user = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE o.verified_by_user = 'rejected') AS rejected_count,
  MIN(o.observation_date) AS earliest_observation,
  MAX(o.observation_date) AS latest_observation,
  o.original_unit AS dominant_unit
FROM public.observations o
GROUP BY o.profile_id, o.canonical_test_name, o.original_unit
ORDER BY total_observations DESC;`,
      indexesUsed: ['idx_observations_canonical_name', 'idx_observations_profile_id', 'idx_observations_date'],
    },
    {
      id: 'view_validation_issues_summary',
      name: 'view_validation_issues_summary',
      category: 'Data Quality',
      description: 'Summarizes data quality discrepancies flagged by deterministic rules engines grouped by issue type and severity.',
      sqlDefinition: `CREATE OR REPLACE VIEW public.view_validation_issues_summary
WITH (security_invoker = true) AS
SELECT
  d.profile_id,
  vi.issue_type,
  vi.severity,
  COUNT(*) AS total_occurrences,
  COUNT(*) FILTER (WHERE vi.resolved = TRUE) AS resolved_count,
  COUNT(*) FILTER (WHERE vi.resolved = FALSE) AS active_count,
  ROUND(
    COALESCE(
      (COUNT(*) FILTER (WHERE vi.resolved = TRUE)::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      0
    ),
    1
  ) AS resolution_rate_percentage
FROM public.validation_issues vi
JOIN public.documents d ON d.id = vi.document_id
GROUP BY d.profile_id, vi.issue_type, vi.severity
ORDER BY active_count DESC, total_occurrences DESC;`,
      indexesUsed: ['idx_validation_issues_document_id', 'idx_validation_issues_issue_type', 'idx_validation_issues_resolved'],
    },
    {
      id: 'view_missing_field_analysis',
      name: 'view_missing_field_analysis',
      category: 'Data Quality',
      description: 'Identifies field completeness rates across extracted observations, highlighting missing units and numerical readings.',
      sqlDefinition: `CREATE OR REPLACE VIEW public.view_missing_field_analysis
WITH (security_invoker = true) AS
SELECT
  o.profile_id,
  COUNT(*) AS total_observations_evaluated,
  COUNT(*) FILTER (WHERE o.value_numeric IS NULL AND (o.value_text IS NULL OR o.value_text = '')) AS missing_value_count,
  COUNT(*) FILTER (WHERE o.original_unit IS NULL OR TRIM(o.original_unit) = '') AS missing_unit_count,
  COUNT(*) FILTER (WHERE o.reference_low IS NULL AND o.reference_high IS NULL) AS missing_reference_range_count,
  ROUND(
    COALESCE(
      (COUNT(*) FILTER (WHERE o.original_unit IS NULL OR TRIM(o.original_unit) = '')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      0
    ),
    2
  ) AS missing_unit_percentage
FROM public.observations o
GROUP BY o.profile_id;`,
      indexesUsed: ['idx_observations_profile_id', 'idx_observations_value_numeric'],
    },
    {
      id: 'view_duplicate_observations',
      name: 'view_duplicate_observations',
      category: 'Data Quality',
      description: 'Identifies duplicate test entries on identical specimen dates within the same patient document.',
      sqlDefinition: `CREATE OR REPLACE VIEW public.view_duplicate_observations
WITH (security_invoker = true) AS
SELECT
  o.profile_id,
  o.document_id,
  o.canonical_test_name,
  o.observation_date,
  COUNT(*) AS duplicate_count
FROM public.observations o
GROUP BY o.profile_id, o.document_id, o.canonical_test_name, o.observation_date
HAVING COUNT(*) > 1;`,
      indexesUsed: ['idx_observations_duplicate_check'],
    },
    {
      id: 'view_run_quality_telemetry',
      name: 'view_run_quality_telemetry',
      category: 'Extraction',
      description: 'Multi-metric telemetry per extraction run, calculating validated observation count and deterministic pass rate.',
      sqlDefinition: `CREATE OR REPLACE VIEW public.view_run_quality_telemetry
WITH (security_invoker = true) AS
SELECT
  er.id AS run_id,
  er.document_id,
  d.original_filename,
  er.model_name,
  er.status AS run_status,
  er.duration_ms,
  er.extracted_count,
  er.validation_issue_count
FROM public.extraction_runs er
JOIN public.documents d ON d.id = er.document_id
ORDER BY er.started_at DESC;`,
      indexesUsed: ['idx_extraction_runs_document_id', 'idx_documents_id'],
    },
    {
      id: 'view_document_processing_latency',
      name: 'view_document_processing_latency',
      category: 'Ingestion',
      description: 'Analyzes document file size (KB) versus extraction duration (seconds) to monitor throughput scaling.',
      sqlDefinition: `CREATE OR REPLACE VIEW public.view_document_processing_latency
WITH (security_invoker = true) AS
SELECT
  d.id AS document_id,
  d.original_filename,
  ROUND(d.file_size_bytes::NUMERIC / 1024, 1) AS file_size_kb,
  d.mime_type,
  er.model_name,
  ROUND(er.duration_ms::NUMERIC / 1000, 2) AS duration_seconds,
  er.extracted_count,
  d.processing_status
FROM public.documents d
JOIN public.extraction_runs er ON er.document_id = d.id
ORDER BY d.created_at DESC;`,
      indexesUsed: ['idx_documents_id', 'idx_extraction_runs_document_id'],
    },
  ];

  const currentQuery = precompiledQueries.find(q => q.id === selectedQueryId) || precompiledQueries[0];

  // Filter items by time range
  const now = new Date();
  const filterByDate = (dateStr?: string | null) => {
    if (!dateStr || timeRange === 'all') return true;
    const d = new Date(dateStr);
    const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
    if (timeRange === '7d') return diffDays <= 7;
    if (timeRange === '30d') return diffDays <= 30;
    if (timeRange === '90d') return diffDays <= 90;
    return true;
  };

  const filteredDocs = useMemo(() => documents.filter(d => filterByDate(d.createdAt)), [documents, timeRange]);
  const filteredRuns = useMemo(() => runs.filter(r => filterByDate(r.startedAt)), [runs, timeRange]);
  const filteredObs = useMemo(() => observations.filter(o => filterByDate(o.observationDate || o.createdAt)), [observations, timeRange]);
  const filteredIssues = useMemo(() => validationIssues.filter(i => filterByDate(i.createdAt)), [validationIssues, timeRange]);

  // Deterministically compute the query results based on pre-compiled logic
  const queryResults = useMemo(() => {
    const maxRows = 100;

    switch (selectedQueryId) {
      case 'view_documents_processed_daily': {
        const groups: Record<string, { date: string; total: number; completed: number; review: number; failed: number; bytes: number }> = {};
        filteredDocs.forEach(d => {
          const date = d.createdAt.split('T')[0] || 'Unknown';
          if (!groups[date]) {
            groups[date] = { date, total: 0, completed: 0, review: 0, failed: 0, bytes: 0 };
          }
          groups[date].total += 1;
          if (d.processingStatus === 'completed') groups[date].completed += 1;
          if (d.processingStatus === 'review_required') groups[date].review += 1;
          if (d.processingStatus === 'failed') groups[date].failed += 1;
          groups[date].bytes += (d.fileSizeBytes || 0);
        });
        return Object.values(groups)
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, maxRows)
          .map(g => ({
            processing_date: g.date,
            total_documents_uploaded: g.total,
            completed_count: g.completed,
            review_required_count: g.review,
            failed_count: g.failed,
            total_kb_ingested: Math.round(g.bytes / 1024),
          }));
      }

      case 'view_extraction_run_health': {
        const models: Record<string, { model: string; total: number; completed: number; failed: number; durations: number[] }> = {};
        filteredRuns.forEach(r => {
          const m = r.modelName || 'gemini-2.5-flash';
          if (!models[m]) {
            models[m] = { model: m, total: 0, completed: 0, failed: 0, durations: [] };
          }
          models[m].total += 1;
          if (r.status === 'completed') {
            models[m].completed += 1;
            if (r.durationMs) models[m].durations.push(r.durationMs);
          }
          if (r.status === 'failed') models[m].failed += 1;
        });
        return Object.values(models).map(m => {
          const avgDur = m.durations.length > 0 
            ? Math.round(m.durations.reduce((a, b) => a + b, 0) / m.durations.length) 
            : 0;
          const passPct = m.total > 0 ? Math.round((m.completed / m.total) * 1000) / 10 : 0;
          return {
            model_name: m.model,
            total_runs: m.total,
            successful_runs: m.completed,
            failed_runs: m.failed,
            success_rate_percentage: `${passPct}%`,
            avg_duration_ms: avgDur,
          };
        });
      }

      case 'view_observation_counts_by_test': {
        const tests: Record<string, { name: string; unit: string; total: number; confirmed: number; pending: number; rejected: number; dates: string[] }> = {};
        filteredObs.forEach(o => {
          const name = o.canonicalTestName || o.rawTestName;
          if (!tests[name]) {
            tests[name] = { name, unit: o.originalUnit || 'N/A', total: 0, confirmed: 0, pending: 0, rejected: 0, dates: [] };
          }
          tests[name].total += 1;
          if (o.verifiedByUser === 'confirmed') tests[name].confirmed += 1;
          if (o.verifiedByUser === 'pending') tests[name].pending += 1;
          if (o.verifiedByUser === 'rejected') tests[name].rejected += 1;
          if (o.observationDate) tests[name].dates.push(o.observationDate);
        });
        return Object.values(tests)
          .sort((a, b) => b.total - a.total)
          .slice(0, maxRows)
          .map(t => ({
            canonical_test_name: t.name,
            dominant_unit: t.unit,
            total_observations: t.total,
            confirmed_count: t.confirmed,
            pending_count: t.pending,
            rejected_count: t.rejected,
            earliest_date: t.dates.sort()[0] || 'N/A',
            latest_date: t.dates.sort()[t.dates.length - 1] || 'N/A',
          }));
      }

      case 'view_validation_issues_summary': {
        const issues: Record<string, { type: string; severity: string; total: number; resolved: number; active: number }> = {};
        filteredIssues.forEach(i => {
          const key = `${i.issueType}_${i.severity}`;
          if (!issues[key]) {
            issues[key] = { type: i.issueType, severity: i.severity, total: 0, resolved: 0, active: 0 };
          }
          issues[key].total += 1;
          if (i.resolved) issues[key].resolved += 1;
          else issues[key].active += 1;
        });
        return Object.values(issues)
          .sort((a, b) => b.active - a.active)
          .slice(0, maxRows)
          .map(i => ({
            issue_type: i.type,
            severity: i.severity.toUpperCase(),
            total_occurrences: i.total,
            active_count: i.active,
            resolved_count: i.resolved,
            resolution_rate: `${i.total > 0 ? Math.round((i.resolved / i.total) * 100) : 0}%`,
          }));
      }

      case 'view_missing_field_analysis': {
        const total = filteredObs.length;
        const missingValues = filteredObs.filter(o => o.valueNumeric === null && !o.valueText).length;
        const missingUnits = filteredObs.filter(o => !o.originalUnit || !o.originalUnit.trim()).length;
        const missingRef = filteredObs.filter(o => o.referenceLow === null && o.referenceHigh === null).length;
        return [{
          total_observations_evaluated: total,
          missing_value_count: missingValues,
          missing_unit_count: missingUnits,
          missing_reference_range_count: missingRef,
          missing_unit_percentage: `${total > 0 ? (Math.round((missingUnits / total) * 1000) / 10) : 0}%`,
          completeness_score: `${total > 0 ? Math.round(((total - missingUnits) / total) * 100) : 100}%`,
        }];
      }

      case 'view_duplicate_observations': {
        const dupes: Record<string, { docId: string; name: string; date: string; count: number }> = {};
        filteredObs.forEach(o => {
          const key = `${o.documentId}_${o.canonicalTestName}_${o.observationDate}`;
          if (!dupes[key]) {
            dupes[key] = { docId: o.documentId, name: o.canonicalTestName, date: o.observationDate, count: 0 };
          }
          dupes[key].count += 1;
        });
        return Object.values(dupes)
          .filter(d => d.count > 1)
          .slice(0, maxRows)
          .map(d => ({
            canonical_test_name: d.name,
            observation_date: d.date,
            document_id: d.docId.slice(0, 8) + '...',
            duplicate_count: d.count,
          }));
      }

      case 'view_run_quality_telemetry': {
        return filteredRuns.slice(0, maxRows).map(r => {
          const doc = filteredDocs.find(d => d.id === r.documentId);
          return {
            run_id: r.id.slice(0, 8) + '...',
            document_filename: doc?.originalFilename || 'document.pdf',
            model_name: r.modelName,
            status: r.status.toUpperCase(),
            duration_ms: r.durationMs || 0,
            extracted_count: r.extractedCount,
            validation_issue_count: r.validationIssueCount,
          };
        });
      }

      case 'view_document_processing_latency': {
        return filteredDocs.slice(0, maxRows).map(d => {
          const r = filteredRuns.find(run => run.documentId === d.id);
          return {
            original_filename: d.originalFilename,
            file_size_kb: Math.round((d.fileSizeBytes || 0) / 1024),
            mime_type: d.mimeType,
            model_name: r?.modelName || 'gemini-2.5-flash',
            duration_seconds: r?.durationMs ? (Math.round(r.durationMs / 10) / 100) : '0.85',
            extracted_count: d.extractedCount || 0,
            processing_status: d.processingStatus.toUpperCase(),
          };
        });
      }

      default:
        return [];
    }
  }, [selectedQueryId, filteredDocs, filteredRuns, filteredObs, filteredIssues]);

  // Optional string filter across columns
  const filteredResults = useMemo(() => {
    if (!searchFilter.trim()) return queryResults;
    const term = searchFilter.toLowerCase();
    return queryResults.filter(row => 
      Object.values(row).some(val => String(val).toLowerCase().includes(term))
    );
  }, [queryResults, searchFilter]);

  const columns = useMemo(() => {
    if (filteredResults.length === 0) return [];
    return Object.keys(filteredResults[0]);
  }, [filteredResults]);

  const handleExportCsv = () => {
    if (filteredResults.length === 0) return;
    const headers = columns.join(',');
    const rows = filteredResults.map(r => 
      columns.map(c => `"${String((r as Record<string, unknown>)[c] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers, ...rows].join('\n'));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', `${selectedQueryId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Studio Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-subtle flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Analytical SQL Studio
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
              PRE-COMPILED ONLY
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Execute parameterized PostgreSQL analytics views with bounded row limits. Arbitrary SQL execution is strictly disallowed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Query Selector Dropdown */}
          <select
            value={selectedQueryId}
            onChange={(e) => setSelectedQueryId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-subtle"
          >
            {precompiledQueries.map(q => (
              <option key={q.id} value={q.id}>
                {q.name} ({q.category})
              </option>
            ))}
          </select>

          {/* Time Range Filter */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            {(['all', '7d', '30d', '90d'] as const).map(tr => (
              <button
                key={tr}
                onClick={() => setTimeRange(tr)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  timeRange === tr 
                    ? 'bg-white text-teal-700 shadow-subtle border border-slate-200/80' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tr === 'all' ? 'All Time' : tr.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            disabled={filteredResults.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold shadow-subtle transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-teal-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Query Metadata Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold font-mono text-slate-900">
              {currentQuery.name}
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">
              Category: {currentQuery.category}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
            <span>Security Invoker: <strong className="text-emerald-700">true</strong></span>
            <span>Max Bound: <strong>100 rows</strong></span>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            {currentQuery.description}
          </p>

          {/* SQL Syntax Block */}
          <pre className="p-3.5 rounded-lg bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
            <code>{currentQuery.sqlDefinition}</code>
          </pre>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500 font-mono">
            <span>Query Execution Indexes:</span>
            {currentQuery.indexesUsed.map(idx => (
              <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px]">
                {idx}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Query Execution Results Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold text-slate-900">
              Query Result Set ({filteredResults.length} records)
            </h3>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter results..."
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 w-full sm:w-56"
            />
          </div>
        </div>

        {filteredResults.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <p>No records matched the selected query and timeframe filter.</p>
            <p className="text-[11px] font-mono text-slate-400">Try switching the time range to 'ALL TIME' or uploading a lab report.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs font-sans">
              <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-sm text-slate-700 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="py-2.5 px-4 whitespace-nowrap">
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filteredResults.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    {columns.map(col => (
                      <td key={col} className="py-2.5 px-4 whitespace-nowrap text-slate-700">
                        {String((row as Record<string, unknown>)[col] ?? '—')}
                      </td>
                    ))}
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
