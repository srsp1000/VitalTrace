import React, { useState } from 'react';
import { 
  BarChart3, 
  Download, 
  ExternalLink, 
  Copy, 
  Check, 
  Layers, 
  FileCode, 
  Database, 
  Server, 
  Sparkles,
  Info
} from 'lucide-react';
import { useHealthData } from '../../context/HealthDataContext';

export const PowerBIReportHub: React.FC = () => {
  const { observations } = useHealthData();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const embedUrl = import.meta.env.VITE_POWERBI_EMBED_URL;

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Helper to trigger downloadable assets
  const downloadAsset = (filename: string, content: string, mime: string = 'text/plain') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadDax = () => {
    const daxContent = `// ====================================================================
// VitalTrace Enterprise Power BI Semantic Model Measures (DAX)
// Version 5.0-PROD • LOINC-Standardized Clinical Data Model
// ====================================================================

// --- Page 1: Executive Data Quality & Ingestion ---
Total_Documents = COUNTROWS('Documents')

Completed_Documents = 
CALCULATE(
    COUNTROWS('Documents'),
    'Documents'[processing_status] = "completed"
)

Document_Success_Rate = 
DIVIDE(
    [Completed_Documents],
    [Total_Documents],
    0
)

Total_Observations = COUNTROWS('Observations')

Valid_Observations = 
CALCULATE(
    COUNTROWS('Observations'),
    'Observations'[validation_status] = "valid"
)

Overall_Pass_Rate = 
DIVIDE(
    [Valid_Observations],
    [Total_Observations],
    0
)

// --- Page 2: Extraction Telemetry & Latency ---
Total_Extraction_Runs = COUNTROWS('ExtractionRuns')

Avg_Duration_Seconds = 
AVERAGEX(
    FILTER('ExtractionRuns', 'ExtractionRuns'[status] = "completed"),
    'ExtractionRuns'[duration_ms] / 1000
)

P95_Duration_Seconds = 
PERCENTILEX.INC(
    FILTER('ExtractionRuns', 'ExtractionRuns'[status] = "completed"),
    'ExtractionRuns'[duration_ms] / 1000,
    0.95
)

Extraction_Failure_Rate = 
DIVIDE(
    CALCULATE(COUNTROWS('ExtractionRuns'), 'ExtractionRuns'[status] = "failed"),
    [Total_Extraction_Runs],
    0
)

// --- Page 3: Biomarker Longitudinal Trends ---
Confirmed_Observations = 
CALCULATE(
    COUNTROWS('Observations'),
    'Observations'[verified_by_user] = "confirmed"
)

Human_Audit_Rate = 
DIVIDE(
    [Confirmed_Observations],
    [Total_Observations],
    0
)

Out_Of_Bounds_Count = 
CALCULATE(
    COUNTROWS('Observations'),
    'Observations'[value_numeric] < 'Observations'[reference_low] ||
    'Observations'[value_numeric] > 'Observations'[reference_high]
)

// --- Page 4: Validation & Issue Funnel ---
Active_Validation_Issues = 
CALCULATE(
    COUNTROWS('ValidationIssues'),
    'ValidationIssues'[resolved] = FALSE()
)

Critical_Issue_Count = 
CALCULATE(
    COUNTROWS('ValidationIssues'),
    'ValidationIssues'[severity] = "error" && 'ValidationIssues'[resolved] = FALSE()
)

Issue_Resolution_Rate = 
DIVIDE(
    CALCULATE(COUNTROWS('ValidationIssues'), 'ValidationIssues'[resolved] = TRUE()),
    COUNTROWS('ValidationIssues'),
    0
)
`;
    downloadAsset('VitalTrace_DAX_Measures.dax', daxContent);
  };

  const handleDownloadPowerQuery = () => {
    const mContent = `// ====================================================================
// VitalTrace Power Query (M) Direct Ingestion Scripts
// Connects to PostgreSQL Analytical Views via DirectQuery or Import
// ====================================================================

let
    Source = PostgreSQL.Database(
        "db.vitaltrace.internal", 
        "postgres", 
        [CreateNavigationProperties=false]
    ),
    public_Schema = Source{[Schema="public"]}[Data],
    
    // 1. Ingestion Throughput View
    view_documents_daily = public_Schema{[Name="view_documents_processed_daily"]}[Data],
    
    // 2. Model Latency & Telemetry View
    view_extraction_runs = public_Schema{[Name="view_extraction_run_health"]}[Data],
    
    // 3. Clinical Observation Frequency View
    view_observations = public_Schema{[Name="view_observation_counts_by_test"]}[Data],
    
    // 4. Data Quality Issues View
    view_validation_issues = public_Schema{[Name="view_validation_issues_summary"]}[Data]
in
    view_documents_daily
`;
    downloadAsset('VitalTrace_PowerQuery_M.pq', mContent);
  };

  const handleDownloadTheme = () => {
    const themeContent = {
      name: "VitalTrace Healthcare",
      dataColors: [
        "#0D9488", // Primary Teal
        "#0F766E", // Deep Teal
        "#0F172A", // Dark Slate
        "#10B981", // Emerald Valid
        "#F59E0B", // Amber Warning
        "#F43F5E", // Rose Danger
        "#0284C7", // Sky Info
        "#64748B"  // Slate Neutral
      ],
      background: "#FFFFFF",
      foreground: "#0F172A",
      tableAccent: "#0D9488",
      visualStyles: {
        "*": {
          "*": {
            fontFamily: [{ fontFamily: "Inter" }],
            fontSize: [{ fontSize: 10 }]
          }
        }
      }
    };
    downloadAsset('vitaltrace_powerbi_theme.json', JSON.stringify(themeContent, null, 2), 'application/json');
  };

  const handleDownloadCsv = () => {
    const headers = ['id', 'document_name', 'canonical_test_name', 'value_numeric', 'unit', 'ref_low', 'ref_high', 'status', 'verified', 'date'];
    const rows = observations.map(o => [
      `"${o.id}"`,
      `"${o.sourceDocumentName || 'document.pdf'}"`,
      `"${o.canonicalTestName}"`,
      o.valueNumeric !== null ? o.valueNumeric : '""',
      `"${o.originalUnit}"`,
      o.referenceLow !== null ? o.referenceLow : '""',
      o.referenceHigh !== null ? o.referenceHigh : '""',
      `"${o.validationStatus}"`,
      `"${o.verifiedByUser}"`,
      `"${o.observationDate}"`,
    ].join(','));
    const content = [headers.join(','), ...rows].join('\n');
    downloadAsset(`vitaltrace_powerbi_dataset_${new Date().toISOString().split('T')[0]}.csv`, content, 'text/csv');
  };

  const powerBiPages = [
    {
      page: 'Page 1',
      title: 'Executive Data Quality Overview',
      focus: 'High-level operational health and throughput',
      measures: ['Overall_Pass_Rate', 'Document_Success_Rate', 'Total_Observations', 'Total_Documents'],
      description: 'Card visualizations for clinical pass rates, time-series area charts of document ingestion velocity, and donut charts for validation status distribution.',
    },
    {
      page: 'Page 2',
      title: 'Extraction Engine Telemetry & Latency',
      focus: 'LLM pipeline reliability, durations, and error monitoring',
      measures: ['Avg_Duration_Seconds', 'P95_Duration_Seconds', 'Extraction_Failure_Rate', 'Total_Extraction_Runs'],
      description: 'Latency percentiles (P50 vs P95) segmented by multimodal model name, run completion statuses, and document payload sizes.',
    },
    {
      page: 'Page 3',
      title: 'Biomarker Longitudinal Trends',
      focus: 'Longitudinal clinical trajectories and reference bounds',
      measures: ['Confirmed_Observations', 'Human_Audit_Rate', 'Out_Of_Bounds_Count'],
      description: 'Multi-line trajectory charts plotting canonical biomarker readings against physiological reference ranges with human confirmation filters.',
    },
    {
      page: 'Page 4',
      title: 'Validation & Issue Discrepancy Funnel',
      focus: 'Deterministic rule discrepancies and resolution tracking',
      measures: ['Active_Validation_Issues', 'Critical_Issue_Count', 'Issue_Resolution_Rate'],
      description: 'Bar chart matrix classifying errors by severity (Info, Warning, Critical Error) and LOINC unit discrepancy frequency.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Power BI Resources & Integration Hub
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              BI CONNECTIVITY
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Connect Power BI Desktop or Service directly to PostgreSQL analytical views or import semantic model templates.
          </p>
        </div>
      </div>

      {/* End-to-End Architecture Diagram */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Data Pipeline & Power BI Architecture
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">DirectQuery / Import Pipeline</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1 text-center">
            <div className="w-7 h-7 mx-auto rounded-md bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <div className="font-bold text-slate-900 mt-1">PostgreSQL DB</div>
            <p className="text-[11px] text-slate-500">Documents, Runs, Observations, Issues</p>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1 text-center">
            <div className="w-7 h-7 mx-auto rounded-md bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <div className="font-bold text-slate-900 mt-1">SQL Views (10)</div>
            <p className="text-[11px] text-slate-500">Pre-aggregated KPIs & Telemetry views</p>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1 text-center">
            <div className="w-7 h-7 mx-auto rounded-md bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
              3
            </div>
            <div className="font-bold text-slate-900 mt-1">Power Query (M)</div>
            <p className="text-[11px] text-slate-500">M-code schema ingestion & type casting</p>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1 text-center">
            <div className="w-7 h-7 mx-auto rounded-md bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
              4
            </div>
            <div className="font-bold text-slate-900 mt-1">Semantic Model</div>
            <p className="text-[11px] text-slate-500">Star schema relationships & DAX measures</p>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-teal-50/70 border-teal-200 space-y-1 text-center">
            <div className="w-7 h-7 mx-auto rounded-md bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
              5
            </div>
            <div className="font-bold text-teal-900 mt-1">Power BI Report</div>
            <p className="text-[11px] text-teal-700">4 Clinical & telemetry dashboards</p>
          </div>
        </div>
      </div>

      {/* Database Connection Card for Power BI DirectQuery */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Power BI PostgreSQL Connection Parameters
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
            READ-ONLY REPLICA
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          In Power BI Desktop, select <strong>Get Data → PostgreSQL database</strong> and provide the connection details below:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {[
            { label: 'Server / Host', value: 'db.vitaltrace.internal' },
            { label: 'Port', value: '5432' },
            { label: 'Database', value: 'postgres' },
            { label: 'Schema', value: 'public' },
          ].map(f => (
            <div key={f.label} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
              <div className="text-[10px] font-semibold uppercase text-slate-400">{f.label}</div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-slate-800 font-semibold text-xs">{f.value}</span>
                <button
                  onClick={() => handleCopy(f.label, f.value)}
                  className="p-1 rounded hover:bg-slate-200 text-slate-500"
                  title="Copy"
                >
                  {copiedField === f.label ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Downloadable Assets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-subtle p-5 flex flex-col justify-between space-y-4 hover:shadow-card transition-all">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
              <FileCode className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">DAX_Measures.dax</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Complete DAX calculations for Pass Rates, P95 Latencies, Verification %, and Outlier Counts.
            </p>
          </div>
          <button
            onClick={handleDownloadDax}
            className="w-full py-2 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-subtle flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download DAX</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-subtle p-5 flex flex-col justify-between space-y-4 hover:shadow-card transition-all">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">PowerQuery_M.pq</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              M-code scripts for importing and transforming the 10 PostgreSQL analytical views into Power BI.
            </p>
          </div>
          <button
            onClick={handleDownloadPowerQuery}
            className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-subtle flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download M-Code</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-subtle p-5 flex flex-col justify-between space-y-4 hover:shadow-card transition-all">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">vitaltrace_theme.json</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Power BI palette theme file matching the VitalTrace healthcare design system (Inter font, teal & slate).
            </p>
          </div>
          <button
            onClick={handleDownloadTheme}
            className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-subtle flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Theme</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-subtle p-5 flex flex-col justify-between space-y-4 hover:shadow-card transition-all">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">Analytical CSV Dataset</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Export current cross-user observation observations and document telemetry for offline Power BI testing.
            </p>
          </div>
          <button
            onClick={handleDownloadCsv}
            className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-subtle flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Power BI Report Pages Detail */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Four Standard Power BI Clinical Dashboard Pages
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">Semantic Model Pages</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {powerBiPages.map(page => (
            <div key={page.page} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs">{page.page}: {page.title}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                  {page.focus}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {page.description}
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                <span className="text-slate-400">Measures:</span>
                {page.measures.map(m => (
                  <span key={m} className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Power BI Embed or Template Card */}
      {embedUrl ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold">
              <BarChart3 className="w-4 h-4 text-teal-400" />
              <span>Live Power BI Embedded Report</span>
            </div>
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 font-mono"
            >
              <span>Open Fullscreen</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="aspect-video w-full bg-slate-100">
            <iframe
              title="VitalTrace Power BI Embedded Report"
              src={embedUrl}
              className="w-full h-full border-0"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-xl border border-dashed border-teal-300 bg-teal-50/40 text-xs text-teal-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-teal-900 text-sm">
              <Info className="w-4 h-4 text-teal-600" />
              <span>Power BI Service Embed URL Not Configured</span>
            </div>
            <p className="text-[11px] text-teal-800 leading-relaxed">
              To embed interactive Power BI dashboards directly into this console, publish your report to the Power BI Service and set <code className="bg-teal-100 px-1 py-0.5 rounded font-mono text-teal-950">VITE_POWERBI_EMBED_URL</code> in your environment. Alternatively, import the DAX measures and M scripts above into Power BI Desktop.
            </p>
          </div>
          <button
            onClick={handleDownloadDax}
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-subtle shrink-0 transition-colors"
          >
            Download Power BI Bundle
          </button>
        </div>
      )}
    </div>
  );
};
