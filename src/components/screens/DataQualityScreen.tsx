import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Activity, 
  Clock, 
  Filter, 
  Database, 
  Check, 
  Terminal, 
  BarChart3, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  ArrowRight, 
  HelpCircle, 
  Layers, 
  RotateCcw
} from 'lucide-react';
import { useHealthData } from '../../context/HealthDataContext';
import { StatusBadge } from '../common/StatusBadge';
import { 
  calculatePipelineKPIs, 
  filterByTimeRange, 
  type TimeRangeFilter 
} from '../../services/kpiMetrics';
import type { ExtractionRun } from '../../types';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Cell,
  LineChart,
  Line,
  ReferenceLine
} from 'recharts';

export const DataQualityScreen: React.FC = () => {
  const { 
    documents, 
    runs, 
    observations, 
    validationIssues, 
    resolveIssue, 
    retryProcessing,
    setSelectedDocumentIdFilter,
    setActiveScreen,
    isDemoMode,
    isRefreshing,
    lastRefreshedAt,
    refreshData
  } = useHealthData();

  // ==========================================
  // Global Filtering Controls State
  // ==========================================
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('all');
  const [selectedDocFilter, setSelectedDocFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'runs' | 'issues'>('runs');

  // Extraction Runs Ledger State
  const [runSearchQuery, setRunSearchQuery] = useState('');
  const [runStatusFilter, setRunStatusFilter] = useState<string>('all');
  const [runSortBy, setRunSortBy] = useState<'date' | 'duration' | 'extracted' | 'issues'>('date');
  const [runSortOrder, setRunSortOrder] = useState<'asc' | 'desc'>('desc');
  const [runPage, setRunPage] = useState(1);
  const runsPerPage = 6;
  const [selectedRunDetail, setSelectedRunDetail] = useState<ExtractionRun | null>(null);
  const [retryingDocId, setRetryingDocId] = useState<string | null>(null);

  // Validation Issues Ledger State
  const [issueSearchQuery, setIssueSearchQuery] = useState('');
  const [issueCategoryFilter, setIssueCategoryFilter] = useState<string>('all');
  const [issueSeverityFilter, setIssueSeverityFilter] = useState<string>('all');
  const [issueResolutionFilter, setIssueResolutionFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [issuePage, setIssuePage] = useState(1);
  const issuesPerPage = 6;

  // ==========================================
  // Deterministic Filtering & Recalculation
  // ==========================================
  const timeFilteredData = useMemo(() => {
    // 1. Time range filtering
    const fDocs = filterByTimeRange(documents, timeRange, d => d.createdAt || d.documentDate);
    const fRuns = filterByTimeRange(runs, timeRange, r => r.startedAt);
    const fObs = filterByTimeRange(observations, timeRange, o => o.observationDate || o.createdAt);
    const fIssues = filterByTimeRange(validationIssues, timeRange, i => i.createdAt);

    // 2. Document scoping filter
    const docScopeFilter = (items: any[], getDocId: (item: any) => string) => {
      if (selectedDocFilter === 'all') return items;
      return items.filter(i => getDocId(i) === selectedDocFilter);
    };

    const finalDocs = selectedDocFilter === 'all' ? fDocs : fDocs.filter(d => d.id === selectedDocFilter);
    const finalRuns = docScopeFilter(fRuns, r => r.documentId);
    const finalObs = docScopeFilter(fObs, o => o.documentId);
    const finalIssues = docScopeFilter(fIssues, i => i.documentId);

    return {
      docs: finalDocs,
      runs: finalRuns,
      obs: finalObs,
      issues: finalIssues,
      kpis: calculatePipelineKPIs(finalDocs, finalRuns, finalObs, finalIssues),
    };
  }, [documents, runs, observations, validationIssues, timeRange, selectedDocFilter]);

  const { docs: filteredDocs, runs: filteredRuns, obs: filteredObs, issues: filteredIssues, kpis: activeKpis } = timeFilteredData;

  // ==========================================
  // Pipeline Funnel Stage Telemetry
  // ==========================================
  const funnelStages = useMemo(() => {
    const totalDocs = filteredDocs.length;
    const storedDocs = filteredDocs.filter(d => Boolean(d.storagePath)).length;
    const totalRuns = filteredRuns.length;
    const successfulRuns = filteredRuns.filter(r => r.status === 'completed').length;
    const totalObs = filteredObs.length;
    const validObs = filteredObs.filter(o => o.validationStatus === 'valid').length;
    const confirmedObs = filteredObs.filter(o => o.verifiedByUser === 'confirmed').length;

    return [
      {
        id: 'stage-1',
        name: '1. Ingested Docs',
        count: totalDocs,
        total: totalDocs,
        pct: 100,
        subtext: `${filteredDocs.filter(d => d.processingStatus === 'completed').length} completed`,
        status: 'ok',
      },
      {
        id: 'stage-2',
        name: '2. Private Vault',
        count: storedDocs,
        total: totalDocs,
        pct: totalDocs > 0 ? Math.round((storedDocs / totalDocs) * 100) : 100,
        subtext: 'Encrypted with RLS',
        status: 'ok',
      },
      {
        id: 'stage-3',
        name: '3. Extraction Runs',
        count: totalRuns,
        total: totalRuns,
        pct: 100,
        subtext: `${totalRuns - successfulRuns} failed / retryable`,
        status: totalRuns === successfulRuns ? 'ok' : 'warning',
      },
      {
        id: 'stage-4',
        name: '4. Schema Parsed',
        count: successfulRuns,
        total: totalRuns,
        pct: totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 100,
        subtext: 'Strict Zod Clinical JSON',
        status: 'ok',
      },
      {
        id: 'stage-5',
        name: '5. Rule Evaluated',
        count: totalObs,
        total: totalObs,
        pct: 100,
        subtext: 'Bounds, units, duplicates',
        status: 'ok',
      },
      {
        id: 'stage-6',
        name: '6. Validated Obs',
        count: validObs,
        total: totalObs,
        pct: totalObs > 0 ? Math.round((validObs / totalObs) * 100) : 100,
        subtext: `${totalObs - validObs} discrepancies flagged`,
        status: (totalObs - validObs) === 0 ? 'ok' : 'warning',
      },
      {
        id: 'stage-7',
        name: '7. Clinician Verified',
        count: confirmedObs,
        total: totalObs,
        pct: totalObs > 0 ? Math.round((confirmedObs / totalObs) * 100) : 0,
        subtext: `${filteredObs.filter(o => o.verifiedByUser === 'pending').length} pending review`,
        status: 'info',
      },
    ];
  }, [filteredDocs, filteredRuns, filteredObs]);

  // ==========================================
  // Chart Data Preparations
  // ==========================================
  // 1. Quality Issues by Category
  const categoryChartData = useMemo(() => {
    const categories = [
      { key: 'missing_unit', label: 'Missing Unit', color: '#F59E0B' },
      { key: 'duplicate_observation', label: 'Duplicate Entry', color: '#E11D48' },
      { key: 'implausible_bounds', label: 'Bounds Warning', color: '#D97706' },
      { key: 'unmapped_test', label: 'Unmapped / OCR Fail', color: '#DC2626' },
      { key: 'missing_value', label: 'Missing Value', color: '#EA580C' },
      { key: 'invalid_date', label: 'Invalid Date', color: '#8B5CF6' },
    ];

    return categories.map(cat => ({
      name: cat.label,
      count: activeKpis.issuesByCategory[cat.key] || 0,
      color: cat.color,
    }));
  }, [activeKpis.issuesByCategory]);

  // 2. Latency per Extraction Run
  const latencyChartData = useMemo(() => {
    return filteredRuns
      .filter(r => r.durationMs && r.durationMs > 0)
      .slice(0, 10)
      .map(r => {
        const doc = documents.find(d => d.id === r.documentId);
        return {
          name: (doc?.originalFilename || r.documentId).slice(0, 14),
          durationSec: Number(((r.durationMs || 0) / 1000).toFixed(2)),
          status: r.status,
          model: r.modelName,
        };
      })
      .reverse();
  }, [filteredRuns, documents]);

  // ==========================================
  // Search, Filter & Paginate: Extraction Runs
  // ==========================================
  const displayedRuns = useMemo(() => {
    let list = [...filteredRuns];

    if (runSearchQuery.trim()) {
      const q = runSearchQuery.toLowerCase();
      list = list.filter(r => {
        const doc = documents.find(d => d.id === r.documentId);
        return (
          r.id.toLowerCase().includes(q) ||
          r.modelName.toLowerCase().includes(q) ||
          (doc?.originalFilename.toLowerCase().includes(q) ?? false) ||
          (r.errorMessage?.toLowerCase().includes(q) ?? false)
        );
      });
    }

    if (runStatusFilter !== 'all') {
      list = list.filter(r => r.status === runStatusFilter);
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (runSortBy === 'date') cmp = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
      else if (runSortBy === 'duration') cmp = (a.durationMs || 0) - (b.durationMs || 0);
      else if (runSortBy === 'extracted') cmp = a.extractedCount - b.extractedCount;
      else if (runSortBy === 'issues') cmp = a.validationIssueCount - b.validationIssueCount;
      return runSortOrder === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [filteredRuns, runSearchQuery, runStatusFilter, runSortBy, runSortOrder, documents]);

  const totalRunPages = Math.max(1, Math.ceil(displayedRuns.length / runsPerPage));
  const paginatedRuns = displayedRuns.slice((runPage - 1) * runsPerPage, runPage * runsPerPage);

  // ==========================================
  // Search, Filter & Paginate: Validation Issues
  // ==========================================
  const displayedIssues = useMemo(() => {
    let list = [...filteredIssues];

    if (issueSearchQuery.trim()) {
      const q = issueSearchQuery.toLowerCase();
      list = list.filter(i => 
        i.message.toLowerCase().includes(q) ||
        i.issueType.toLowerCase().includes(q) ||
        (i.observationTestName?.toLowerCase().includes(q) ?? false)
      );
    }

    if (issueCategoryFilter !== 'all') {
      list = list.filter(i => i.issueType === issueCategoryFilter);
    }

    if (issueSeverityFilter !== 'all') {
      list = list.filter(i => i.severity === issueSeverityFilter);
    }

    if (issueResolutionFilter === 'active') {
      list = list.filter(i => !i.resolved);
    } else if (issueResolutionFilter === 'resolved') {
      list = list.filter(i => i.resolved);
    }

    return list;
  }, [filteredIssues, issueSearchQuery, issueCategoryFilter, issueSeverityFilter, issueResolutionFilter]);

  const totalIssuePages = Math.max(1, Math.ceil(displayedIssues.length / issuesPerPage));
  const paginatedIssues = displayedIssues.slice((issuePage - 1) * issuesPerPage, issuePage * issuesPerPage);

  const handleRetry = async (documentId: string) => {
    setRetryingDocId(documentId);
    try {
      await retryProcessing(documentId);
    } finally {
      setRetryingDocId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* 1. Global Controls & Telemetry Header Bar                            */}
      {/* ==================================================================== */}
      <div className="bg-slate-900 text-white rounded-lg p-5 border border-slate-800 shadow-elevation">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30">
                <Database className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold tracking-tight">
                Data Quality Telemetry & Pipeline Analytics
              </h2>
              <span className={`text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full border ${
                isDemoMode 
                  ? 'bg-slate-800 text-slate-300 border-slate-700' 
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              }`}>
                {isDemoMode ? 'Local Workspace Scope' : 'Live PostgreSQL (RLS)'}
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Real-time audit engine for laboratory data ingestion. Deterministic mathematical formulas calculate pass rates, completeness, and execution latencies directly from normalized records.
            </p>
          </div>

          {/* Quick Refresh & Timestamp */}
          <div className="flex items-center gap-3 shrink-0">
            {lastRefreshedAt && (
              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                Synced: {new Date(lastRefreshedAt).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={refreshData}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-teal-400' : 'text-slate-400'}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Global Multi-dimensional Filter Bar */}
        <div className="mt-4 pt-3.5 border-t border-slate-800 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300 font-medium">
            <Filter className="w-3.5 h-3.5 text-teal-400" />
            <span>Telemetry Scope:</span>
          </div>

          {/* Time Range Filter */}
          <select
            value={timeRange}
            onChange={(e) => {
              setTimeRange(e.target.value as TimeRangeFilter);
              setRunPage(1);
              setIssuePage(1);
            }}
            className="rounded bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
          >
            <option value="all">Time: All Time (Full History)</option>
            <option value="24h">Time: Past 24 Hours</option>
            <option value="7d">Time: Past 7 Days</option>
            <option value="30d">Time: Past 30 Days</option>
            <option value="90d">Time: Past 90 Days</option>
          </select>

          {/* Document Scope Filter */}
          <select
            value={selectedDocFilter}
            onChange={(e) => {
              setSelectedDocFilter(e.target.value);
              setRunPage(1);
              setIssuePage(1);
            }}
            className="rounded bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans max-w-[220px] truncate"
          >
            <option value="all">Document: All Lab Reports ({documents.length})</option>
            {documents.map(d => (
              <option key={d.id} value={d.id}>
                {d.originalFilename}
              </option>
            ))}
          </select>

          {(timeRange !== 'all' || selectedDocFilter !== 'all') && (
            <button
              onClick={() => {
                setTimeRange('all');
                setSelectedDocFilter('all');
              }}
              className="text-[11px] text-teal-400 hover:text-teal-300 underline font-mono ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. Executive 8-Card KPI Matrix (Formula-Verified)                   */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Ingestion Success Rate */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-subtle hover:border-slate-300 transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Document Success
            </span>
            <div className="p-1.5 rounded bg-slate-50 border border-slate-100 text-teal-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
              {activeKpis.documentSuccessRate !== null ? `${activeKpis.documentSuccessRate}%` : 'N/A'}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
              activeKpis.documentSuccessRate === null ? 'bg-slate-100 text-slate-600 border-slate-200' :
              activeKpis.documentSuccessRate >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {activeKpis.completedDocuments} / {activeKpis.terminalDocuments} terminal
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">
            {activeKpis.reviewRequiredDocuments} review required, {activeKpis.failedDocuments} failed
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">Formula: (Completed / Terminal Docs) × 100</span>
          </div>
        </div>

        {/* KPI 2: Extraction Run Success */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-subtle hover:border-slate-300 transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Pipeline Run Success
            </span>
            <div className="p-1.5 rounded bg-slate-50 border border-slate-100 text-sky-600">
              <Terminal className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
              {activeKpis.extractionSuccessRate !== null ? `${activeKpis.extractionSuccessRate}%` : 'N/A'}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
              activeKpis.extractionSuccessRate === null ? 'bg-slate-100 text-slate-600 border-slate-200' :
              activeKpis.extractionSuccessRate >= 85 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {activeKpis.completedRuns} / {activeKpis.terminalRuns} runs
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">
            {activeKpis.failedRuns} failed runs, {activeKpis.runningRuns} active
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">Formula: (Completed / Terminal Runs) × 100</span>
          </div>
        </div>

        {/* KPI 3: Validation Pass Rate */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-subtle hover:border-slate-300 transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Validation Pass Rate
            </span>
            <div className="p-1.5 rounded bg-slate-50 border border-slate-100 text-teal-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
              {activeKpis.validationPassRate !== null ? `${activeKpis.validationPassRate}%` : 'N/A'}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
              activeKpis.validationPassRate === null ? 'bg-slate-100 text-slate-600 border-slate-200' :
              activeKpis.validationPassRate >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {activeKpis.validObservations} / {activeKpis.totalObservations} valid
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">
            {activeKpis.warningObservations} warnings, {activeKpis.errorObservations} errors
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">Formula: (Valid Obs / Total Obs) × 100</span>
          </div>
        </div>

        {/* KPI 4: Human Verification Rate */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-subtle hover:border-slate-300 transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Human Verification
            </span>
            <div className="p-1.5 rounded bg-slate-50 border border-slate-100 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
              {activeKpis.verifiedObservationRate !== null ? `${activeKpis.verifiedObservationRate}%` : 'N/A'}
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-sky-50 text-sky-700 border-sky-200">
              {activeKpis.confirmedObservations} confirmed
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">
            {activeKpis.pendingObservations} pending review, {activeKpis.rejectedObservations} rejected
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">Formula: (Confirmed / Total Obs) × 100</span>
          </div>
        </div>

        {/* KPI 5: Field Completeness Rate */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-subtle hover:border-slate-300 transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Field Completeness
            </span>
            <div className="p-1.5 rounded bg-slate-50 border border-slate-100 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
              {activeKpis.fieldCompletenessRate !== null ? `${activeKpis.fieldCompletenessRate}%` : 'N/A'}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
              activeKpis.missingFieldRate === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {activeKpis.missingFieldRate ?? 0}% missing
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">
            {activeKpis.missingFieldObservations} blank units or numeric values
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">Formula: ((Total - Missing) / Total) × 100</span>
          </div>
        </div>

        {/* KPI 6: Duplicate Collisions */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-subtle hover:border-slate-300 transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Duplicate Collisions
            </span>
            <div className="p-1.5 rounded bg-slate-50 border border-slate-100 text-rose-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
              {activeKpis.duplicateCount}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
              activeKpis.duplicateCount === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {activeKpis.duplicateCount === 0 ? 'Zero collisions' : 'Collision alert'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">
            Identical analyte + observation date matches
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">Rule: SHA/Compound key collision count</span>
          </div>
        </div>

        {/* KPI 7: Latency Percentiles */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-subtle hover:border-slate-300 transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Pipeline Latency
            </span>
            <div className="p-1.5 rounded bg-slate-50 border border-slate-100 text-sky-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
              {activeKpis.p50DurationMs !== null ? `${(activeKpis.p50DurationMs / 1000).toFixed(2)}s` : 'N/A'}
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium border bg-slate-100 text-slate-700 border-slate-200">
              p50 median
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate font-mono">
            p95: {activeKpis.p95DurationMs !== null ? `${(activeKpis.p95DurationMs / 1000).toFixed(2)}s` : 'N/A'} | avg: {activeKpis.avgDurationMs !== null ? `${(activeKpis.avgDurationMs / 1000).toFixed(2)}s` : 'N/A'}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">Percentiles calculated on completed runs</span>
          </div>
        </div>

        {/* KPI 8: Open Validation Issues */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-subtle hover:border-slate-300 transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Active Issue Ledger
            </span>
            <div className="p-1.5 rounded bg-slate-50 border border-slate-100 text-rose-600">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
              {activeKpis.openIssuesCount}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
              activeKpis.criticalIssuesCount === 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {activeKpis.criticalIssuesCount} critical
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">
            {activeKpis.warningIssuesCount} warnings, {activeKpis.infoIssuesCount} informational
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">Audit log: Unresolved validation flags</span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. Ingestion Pipeline Stage Funnel Visualizer                       */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-subtle space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" />
              Ingestion Pipeline Funnel Telemetry
            </h3>
            <p className="text-xs text-slate-500">
              Lifecycle traceability from raw document arrival to clinician-verified structured observation
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Conversion: {activeKpis.totalDocuments} docs → {activeKpis.confirmedObservations} confirmed obs
          </span>
        </div>

        {/* Funnel Step Cards Horizontal Trail */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-1">
          {funnelStages.map((stage, idx) => (
            <div 
              key={stage.id}
              className={`p-3 rounded-lg border text-xs space-y-1 relative transition-all ${
                stage.status === 'warning'
                  ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                  : stage.status === 'info'
                  ? 'bg-sky-50/40 border-sky-200 text-sky-900'
                  : 'bg-slate-50/80 border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
                  {stage.name}
                </span>
                {idx < funnelStages.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-slate-300 hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10" />
                )}
              </div>
              <div className="text-lg font-bold font-mono">
                {stage.count}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {stage.subtext}
              </div>
              <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-1.5">
                <div 
                  className={`h-full rounded-full ${
                    stage.status === 'warning' ? 'bg-amber-500' :
                    stage.status === 'info' ? 'bg-sky-500' : 'bg-teal-500'
                  }`}
                  style={{ width: `${stage.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. Telemetry Trends Visualizations (Recharts)                       */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart A: Quality Issues by Category */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-subtle space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-600" />
                Validation Discrepancies by Category
              </h3>
              <p className="text-xs text-slate-500">
                Frequency count of discrepancies identified by deterministic rules
              </p>
            </div>
            <span className="text-xs font-mono font-medium text-slate-500">
              Total: {filteredIssues.length}
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ top: 10, right: 15, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748B" 
                  fontSize={11} 
                  tickLine={false} 
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis 
                  stroke="#64748B" 
                  fontSize={11} 
                  tickLine={false} 
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded shadow text-xs">
                          <div className="font-semibold">{data.name}</div>
                          <div className="text-teal-400 font-mono mt-0.5">{data.count} occurrence(s)</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart B: Extraction Execution Latency */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-subtle space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-600" />
                Pipeline Latency per Document (Seconds)
              </h3>
              <p className="text-xs text-slate-500">
                Server-side extraction & deterministic validation duration
              </p>
            </div>
            <span className="text-xs font-mono font-medium text-emerald-600">
              Target: &lt; 3.0s
            </span>
          </div>

          <div className="h-64 w-full">
            {latencyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No completed extraction run latency data available for current filter.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyChartData} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#64748B" 
                    fontSize={11} 
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis 
                    stroke="#64748B" 
                    fontSize={11} 
                    tickLine={false} 
                    unit="s"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded shadow text-xs">
                            <div className="font-semibold">{data.name}</div>
                            <div className="text-teal-400 font-mono mt-0.5">{data.durationSec}s runtime</div>
                            <div className="text-slate-400 font-mono text-[10px]">Model: {data.model}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={3.0} stroke="#EF4444" strokeDasharray="4 4" label={{ value: '3.0s SLA', fill: '#EF4444', fontSize: 10 }} />
                  <Line 
                    type="monotone" 
                    dataKey="durationSec" 
                    stroke="#0D9488" 
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#0D9488' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 5. Searchable & Sortable Ledgers: Extraction Runs & Validation Issues */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-subtle overflow-hidden">
        {/* Ledger Tabs Header */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('runs')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === 'runs'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              Extraction Runs Ledger ({filteredRuns.length})
            </button>
            <button
              onClick={() => setActiveTab('issues')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === 'issues'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              Validation Issues Ledger ({filteredIssues.length})
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-500">
            {activeTab === 'runs' ? `${displayedRuns.length} runs matched` : `${displayedIssues.length} issues matched`}
          </span>
        </div>

        {/* TAB 1: EXTRACTION RUNS LEDGER */}
        {activeTab === 'runs' && (
          <div>
            {/* Filter & Search Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={runSearchQuery}
                    onChange={(e) => {
                      setRunSearchQuery(e.target.value);
                      setRunPage(1);
                    }}
                    placeholder="Search by filename, run ID, model, or error..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={runStatusFilter}
                  onChange={(e) => {
                    setRunStatusFilter(e.target.value);
                    setRunPage(1);
                  }}
                  className="text-xs rounded border border-slate-300 px-2 py-1.5 bg-white text-slate-800"
                >
                  <option value="all">Status: All</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="running">Running</option>
                </select>

                <select
                  value={runSortBy}
                  onChange={(e) => setRunSortBy(e.target.value as any)}
                  className="text-xs rounded border border-slate-300 px-2 py-1.5 bg-white text-slate-800"
                >
                  <option value="date">Sort by Date</option>
                  <option value="duration">Sort by Latency</option>
                  <option value="extracted">Sort by Extracted Count</option>
                  <option value="issues">Sort by Issue Count</option>
                </select>

                <button
                  onClick={() => setRunSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="text-xs px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-700 font-mono hover:bg-slate-100"
                >
                  {runSortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Document & Run ID</th>
                    <th className="px-4 py-3">Model</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Extracted</th>
                    <th className="px-4 py-3">Issues</th>
                    <th className="px-4 py-3">Latency</th>
                    <th className="px-4 py-3">Started At</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedRuns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                        No extraction runs match the filter parameters.
                      </td>
                    </tr>
                  ) : (
                    paginatedRuns.map(run => {
                      const doc = documents.find(d => d.id === run.documentId);
                      const isRetrying = retryingDocId === run.documentId;
                      return (
                        <tr key={run.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-slate-900 truncate max-w-[200px]" title={doc?.originalFilename || run.documentId}>
                              {doc?.originalFilename || 'Unknown Document'}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 truncate max-w-[180px]">
                              {run.id}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600">
                            {run.modelName}
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge type="processing" value={run.status === 'running' ? 'processing' : run.status} />
                          </td>
                          <td className="px-4 py-3.5 font-mono font-medium text-slate-900">
                            {run.extractedCount} obs
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
                              run.validationIssueCount === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {run.validationIssueCount} issues
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600">
                            {run.durationMs ? `${(run.durationMs / 1000).toFixed(2)}s` : 'N/A'}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">
                            {new Date(run.startedAt).toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-right space-x-2">
                            <button
                              onClick={() => setSelectedRunDetail(run)}
                              className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline"
                            >
                              Inspect
                            </button>
                            {(run.status === 'failed' || run.errorMessage) && (
                              <button
                                onClick={() => handleRetry(run.documentId)}
                                disabled={isRetrying}
                                className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline disabled:opacity-50"
                              >
                                {isRetrying ? 'Retrying...' : 'Retry'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalRunPages > 1 && (
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Page {runPage} of {totalRunPages}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setRunPage(p => Math.max(1, p - 1))}
                    disabled={runPage === 1}
                    className="p-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setRunPage(p => Math.min(totalRunPages, p + 1))}
                    disabled={runPage === totalRunPages}
                    className="p-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: VALIDATION ISSUES LEDGER */}
        {activeTab === 'issues' && (
          <div>
            {/* Filter & Search Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={issueSearchQuery}
                    onChange={(e) => {
                      setIssueSearchQuery(e.target.value);
                      setIssuePage(1);
                    }}
                    placeholder="Search issues by message or test name..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={issueCategoryFilter}
                  onChange={(e) => {
                    setIssueCategoryFilter(e.target.value);
                    setIssuePage(1);
                  }}
                  className="text-xs rounded border border-slate-300 px-2 py-1.5 bg-white text-slate-800"
                >
                  <option value="all">Category: All</option>
                  <option value="missing_unit">Missing Unit</option>
                  <option value="duplicate_observation">Duplicate Observation</option>
                  <option value="implausible_bounds">Implausible Bounds</option>
                  <option value="unmapped_test">Unmapped Test</option>
                  <option value="missing_value">Missing Value</option>
                  <option value="invalid_date">Invalid Date</option>
                </select>

                <select
                  value={issueSeverityFilter}
                  onChange={(e) => {
                    setIssueSeverityFilter(e.target.value);
                    setIssuePage(1);
                  }}
                  className="text-xs rounded border border-slate-300 px-2 py-1.5 bg-white text-slate-800"
                >
                  <option value="all">Severity: All</option>
                  <option value="error">Critical Error</option>
                  <option value="warning">Warning</option>
                  <option value="info">Informational</option>
                </select>

                <select
                  value={issueResolutionFilter}
                  onChange={(e) => {
                    setIssueResolutionFilter(e.target.value as any);
                    setIssuePage(1);
                  }}
                  className="text-xs rounded border border-slate-300 px-2 py-1.5 bg-white text-slate-800"
                >
                  <option value="all">Resolution: All</option>
                  <option value="active">Active Only</option>
                  <option value="resolved">Resolved Only</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Severity</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Affected Test</th>
                    <th className="px-4 py-3">Audit Message</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedIssues.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                        No validation issues match the selected parameters.
                      </td>
                    </tr>
                  ) : (
                    paginatedIssues.map(issue => (
                      <tr key={issue.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <StatusBadge type="severity" value={issue.severity} />
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          {issue.issueType.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                          {issue.observationTestName || 'Document Pipeline'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 max-w-md">
                          {issue.message}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {issue.resolved ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Check className="w-3 h-3" /> Resolved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <AlertTriangle className="w-3 h-3" /> Active
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-2">
                          {issue.resolved ? (
                            <span className="text-[11px] text-slate-400 font-mono">Audited</span>
                          ) : issue.observationId ? (
                            <button
                              onClick={() => {
                                setSelectedDocumentIdFilter(issue.documentId);
                                setActiveScreen('review');
                              }}
                              className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline"
                            >
                              Review in Workbench
                            </button>
                          ) : (
                            <button
                              onClick={() => resolveIssue(issue.id)}
                              className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
                            >
                              Resolve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalIssuePages > 1 && (
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Page {issuePage} of {totalIssuePages}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIssuePage(p => Math.max(1, p - 1))}
                    disabled={issuePage === 1}
                    className="p-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIssuePage(p => Math.min(totalIssuePages, p + 1))}
                    disabled={issuePage === totalIssuePages}
                    className="p-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 6. Run Inspection Modal Dialog                                       */}
      {/* ==================================================================== */}
      {selectedRunDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-lg shadow-elevation border border-slate-200 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Extraction Run Inspection
                </h3>
              </div>
              <button
                onClick={() => setSelectedRunDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Run ID:</span>
                  <span className="font-semibold text-slate-800">{selectedRunDetail.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Document ID:</span>
                  <span className="text-slate-700">{selectedRunDetail.documentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Model Name:</span>
                  <span className="text-slate-700">{selectedRunDetail.modelName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Execution Status:</span>
                  <StatusBadge type="processing" value={selectedRunDetail.status === 'running' ? 'processing' : selectedRunDetail.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Started At:</span>
                  <span className="text-slate-700">{new Date(selectedRunDetail.startedAt).toLocaleString()}</span>
                </div>
                {selectedRunDetail.completedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Completed At:</span>
                    <span className="text-slate-700">{new Date(selectedRunDetail.completedAt).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Duration (Latency):</span>
                  <span className="font-bold text-teal-700">
                    {selectedRunDetail.durationMs ? `${(selectedRunDetail.durationMs / 1000).toFixed(3)} seconds` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Extracted Observations:</span>
                  <span className="text-slate-800">{selectedRunDetail.extractedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Flagged Issues:</span>
                  <span className="text-amber-700">{selectedRunDetail.validationIssueCount}</span>
                </div>
              </div>

              {selectedRunDetail.errorMessage && (
                <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-[11px] uppercase">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    Server Execution Error Trace
                  </div>
                  <p className="font-mono text-xs">{selectedRunDetail.errorMessage}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedRunDetail(null)}
                className="px-4 py-2 rounded border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              {(selectedRunDetail.status === 'failed' || selectedRunDetail.errorMessage) && (
                <button
                  onClick={async () => {
                    const docId = selectedRunDetail.documentId;
                    setSelectedRunDetail(null);
                    await handleRetry(docId);
                  }}
                  className="px-4 py-2 rounded bg-teal-600 hover:bg-teal-700 text-xs font-semibold text-white shadow-subtle inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Ingestion Pipeline
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
