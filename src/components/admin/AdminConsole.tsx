import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Activity, 
  LayoutDashboard, 
  Cpu, 
  ShieldAlert, 
  Database, 
  BarChart3, 
  BookOpen, 
  Shield, 
  ShieldCheck,
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  LogOut,
  RefreshCw,
  Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHealthData } from '../../context/HealthDataContext';
import { SqlStudio } from './SqlStudio';
import { PowerBIReportHub } from './PowerBIReportHub';

type AdminTab = 'overview' | 'runs' | 'issues' | 'sql' | 'powerbi' | 'docs';

export const AdminConsole: React.FC = () => {
  const { currentUser, signOut } = useAuth();
  const { 
    documents, 
    runs, 
    observations, 
    validationIssues, 
    kpis, 
    isRefreshing, 
    refreshData,
    resolveIssue 
  } = useHealthData();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [issueFilter, setIssueFilter] = useState<'all' | 'open' | 'resolved'>('open');
  const [searchQuery, setSearchQuery] = useState('');

  const unresolvedIssues = validationIssues.filter(i => !i.resolved);

  const filteredIssues = validationIssues
    .filter(i => {
      if (issueFilter === 'open') return !i.resolved;
      if (issueFilter === 'resolved') return i.resolved;
      return true;
    })
    .filter(i => {
      if (!searchQuery.trim()) return true;
      const term = searchQuery.toLowerCase();
      return i.message.toLowerCase().includes(term) || i.issueType.toLowerCase().includes(term);
    });

  const navTabs: { id: AdminTab; label: string; icon: React.ElementType; badge?: string | number }[] = [
    { id: 'overview', label: 'Cross-User Telemetry', icon: LayoutDashboard },
    { id: 'runs', label: 'Extraction Runs', icon: Cpu, badge: runs.length },
    { id: 'issues', label: 'Validation Issues', icon: ShieldAlert, badge: unresolvedIssues.length > 0 ? unresolvedIssues.length : undefined },
    { id: 'sql', label: 'SQL Studio', icon: Database },
    { id: 'powerbi', label: 'Power BI Hub', icon: BarChart3 },
    { id: 'docs', label: 'Architecture & Runbooks', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Admin Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/app/overview"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Return to Patient Workspace"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-sm shadow-teal-500/20">
              <Activity className="w-5 h-5 text-teal-50" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white text-base">
                  VitalTrace Admin Console
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30 font-semibold uppercase">
                  Admin RBAC Active
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Multi-tenant telemetry, parameterized analytical views & Power BI pipelines
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshData()}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-teal-400' : ''}`} />
          </button>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
            <Shield className="w-3.5 h-3.5 text-teal-400" />
            <span className="font-medium text-slate-200">{currentUser?.displayName}</span>
            <span className="text-[10px] font-mono text-slate-400">({currentUser?.email})</span>
          </div>

          <button
            onClick={() => signOut()}
            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Admin Shell Body */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Admin Console Sidebar */}
        <aside className="w-full lg:w-64 bg-slate-950/60 border-b lg:border-b-0 lg:border-r border-slate-800 p-3 sm:p-4 space-y-1 shrink-0">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Administrative Modules
          </div>

          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-teal-600/20 text-teal-400 border border-teal-500/30'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                </div>
                {tab.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-6 px-3">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5 text-teal-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Cross-User Telemetry</span>
              </div>
              <p className="leading-relaxed text-[10px]">
                RLS policy <code className="text-teal-300 font-mono">is_admin()</code> active. Admin view aggregates all clinical pipeline rows.
              </p>
            </div>
          </div>
        </aside>

        {/* Admin Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-slate-900 overflow-y-auto">
          {/* TAB 1: OVERVIEW TELEMETRY */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Cross-User Operational Telemetry
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time pipeline ingestion volume, pass rate %, extraction health, and active error counts.
                </p>
              </div>

              {/* KPI Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Total Ingested Documents</span>
                    <FileText className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">
                    {documents.length}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                    <span className="text-emerald-400">{kpis.processedSuccess} completed</span>
                    <span>•</span>
                    <span className="text-rose-400">{kpis.processingFailures} failed</span>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Multimodal Extraction Runs</span>
                    <Cpu className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">
                    {runs.length}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Avg latency: {kpis.avgDurationMs ? Math.round(kpis.avgDurationMs) : 0} ms
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Persisted Observations</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">
                    {observations.length}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Human confirmed: {kpis.confirmedCount} ({observations.length > 0 ? Math.round((kpis.confirmedCount / observations.length) * 100) : 0}%)
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Open Validation Issues</span>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-rose-400">
                    {unresolvedIssues.length}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Pass rate: {kpis.validationPassRate !== null ? `${kpis.validationPassRate}%` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Status Breakdown & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Document Processing Distribution
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Completed (Clean Extractions)</span>
                        <span className="font-mono">{kpis.processedSuccess}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${documents.length > 0 ? (kpis.processedSuccess / documents.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Review Required (Audit Discrepancies)</span>
                        <span className="font-mono">{kpis.reviewRequiredCount || 0}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${documents.length > 0 ? ((kpis.reviewRequiredCount || 0) / documents.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Processing Failures</span>
                        <span className="font-mono">{kpis.processingFailures}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full bg-rose-500 rounded-full"
                          style={{ width: `${documents.length > 0 ? (kpis.processingFailures / documents.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Recent Cross-User Pipeline Activity
                  </h3>
                  {runs.length === 0 ? (
                    <div className="text-xs text-slate-400 py-6 text-center">
                      No extraction runs executed yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-56 overflow-y-auto font-mono text-xs">
                      {runs.slice(0, 5).map(r => (
                        <div key={r.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-200">Run: {r.id.slice(0, 8)}...</div>
                            <div className="text-[11px] text-slate-400">{r.modelName} • {r.extractedCount} obs</div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            r.status === 'completed' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800' : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                          }`}>
                            {r.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXTRACTION RUNS */}
          {activeTab === 'runs' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    All Cross-User Extraction Runs ({runs.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Audit log of LLM model invocations, extraction latencies, and output counts.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Run ID</th>
                      <th className="py-3 px-3">Model</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Started</th>
                      <th className="py-3 px-3">Duration</th>
                      <th className="py-3 px-3">Extracted Obs</th>
                      <th className="py-3 px-4">Flagged Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {runs.map(r => (
                      <tr key={r.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-teal-400">{r.id.slice(0, 8)}...</td>
                        <td className="py-2.5 px-3 text-slate-300">{r.modelName}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.status === 'completed' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{r.startedAt.split('T')[0]}</td>
                        <td className="py-2.5 px-3 text-slate-300">{r.durationMs || 0} ms</td>
                        <td className="py-2.5 px-3 text-emerald-400">{r.extractedCount}</td>
                        <td className="py-2.5 px-4 text-amber-400">{r.validationIssueCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: VALIDATION ISSUES */}
          {activeTab === 'issues' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Cross-User Validation Issues ({validationIssues.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Discrepancies flagged by deterministic clinical bounds rules.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search issues..."
                      className="pl-8 pr-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 w-44"
                    />
                  </div>

                  <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs">
                    {(['open', 'resolved', 'all'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setIssueFilter(f)}
                        className={`px-3 py-1 rounded text-xs font-semibold capitalize ${
                          issueFilter === f ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-3">Issue Type</th>
                      <th className="py-3 px-4">Message</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredIssues.map(issue => (
                      <tr key={issue.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            issue.severity === 'error' ? 'bg-rose-950 text-rose-400' :
                            issue.severity === 'warning' ? 'bg-amber-950 text-amber-400' :
                            'bg-sky-950 text-sky-400'
                          }`}>
                            {issue.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{issue.issueType}</td>
                        <td className="py-2.5 px-4 text-slate-300 font-sans text-xs">{issue.message}</td>
                        <td className="py-2.5 px-3">
                          {issue.resolved ? (
                            <span className="text-emerald-400 font-semibold">Resolved</span>
                          ) : (
                            <span className="text-amber-400 font-semibold">Active</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {!issue.resolved && (
                            <button
                              onClick={() => resolveIssue(issue.id)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-400 hover:text-teal-300 text-[11px] transition-colors"
                            >
                              Resolve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SQL STUDIO */}
          {activeTab === 'sql' && (
            <div className="bg-white text-slate-900 rounded-2xl p-6 shadow-xl">
              <SqlStudio />
            </div>
          )}

          {/* TAB 5: POWER BI HUB */}
          {activeTab === 'powerbi' && (
            <div className="bg-white text-slate-900 rounded-2xl p-6 shadow-xl">
              <PowerBIReportHub />
            </div>
          )}

          {/* TAB 6: DOCUMENTATION & RUNBOOKS */}
          {activeTab === 'docs' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Architecture Documentation & Operational Runbooks
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Standard operating procedures for RBAC, database migrations, and Edge Functions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-teal-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Runbook 1: Administrator Provisioning</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Administrators are NEVER created via registration. To grant admin access to a user in PostgreSQL:
                  </p>
                  <pre className="p-3 rounded bg-slate-900 text-teal-300 font-mono text-[11px] overflow-x-auto">
                    <code>UPDATE public.profiles{'\n'}SET role = 'admin'{'\n'}WHERE id = '&lt;user-uuid&gt;';</code>
                  </pre>
                </div>

                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-teal-400">
                    <Database className="w-4 h-4" />
                    <span>Runbook 2: SQL Migration Sequence</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Five version-controlled migrations in <code className="text-teal-300">supabase/migrations/</code>:
                  </p>
                  <ul className="space-y-1 font-mono text-[11px] text-slate-300">
                    <li>001_core_schema.sql (5 tables)</li>
                    <li>002_row_level_security.sql (RLS policies)</li>
                    <li>003_storage_policies.sql (Bucket security)</li>
                    <li>004_analytical_views.sql (10 SQL views)</li>
                    <li>005_admin_rbac.sql (Server RBAC)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
