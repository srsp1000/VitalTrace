import React from 'react';
import { 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Sparkles, 
  Hash, 
  User, 
  Calendar,
  Lock
} from 'lucide-react';

interface FictionalBiomarker {
  canonicalName: string;
  loincCode: string;
  value: string | number;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  status: 'valid' | 'warning';
  statusLabel: string;
  category: string;
}

export const FictionalReportPreview: React.FC = () => {
  const fictionalObservations: FictionalBiomarker[] = [
    {
      canonicalName: 'Hemoglobin A1c (HbA1c)',
      loincCode: '4548-4',
      value: '5.4',
      unit: '%',
      refLow: 4.0,
      refHigh: 5.6,
      status: 'valid',
      statusLabel: 'In Range',
      category: 'Glycemic Control',
    },
    {
      canonicalName: 'Fasting Plasma Glucose',
      loincCode: '1558-6',
      value: '92',
      unit: 'mg/dL',
      refLow: 70,
      refHigh: 99,
      status: 'valid',
      statusLabel: 'Optimal',
      category: 'Metabolic',
    },
    {
      canonicalName: 'Total Serum Cholesterol',
      loincCode: '2093-3',
      value: '210',
      unit: 'mg/dL',
      refLow: 125,
      refHigh: 200,
      status: 'warning',
      statusLabel: 'Borderline High',
      category: 'Lipid Panel',
    },
    {
      canonicalName: 'Serum Creatinine',
      loincCode: '2160-0',
      value: '0.9',
      unit: 'mg/dL',
      refLow: 0.6,
      refHigh: 1.2,
      status: 'valid',
      statusLabel: 'Normal',
      category: 'Renal Function',
    },
    {
      canonicalName: 'Thyroid Stimulating Hormone (TSH)',
      loincCode: '3016-3',
      value: '2.1',
      unit: 'mIU/L',
      refLow: 0.4,
      refHigh: 4.0,
      status: 'valid',
      statusLabel: 'Euthyroid',
      category: 'Endocrine',
    },
  ];

  return (
    <div className="relative rounded-2xl bg-white border border-slate-200/90 shadow-2xl overflow-hidden text-left">
      {/* Synthetic Data Watermark Banner */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-slate-800 text-white px-4 py-2 flex items-center justify-between text-[11px] font-medium tracking-wide">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-teal-200" />
          <span className="font-semibold uppercase tracking-wider text-[10px] bg-teal-800/80 px-2 py-0.5 rounded border border-teal-500/40">
            Synthetic Demo
          </span>
          <span className="text-teal-100 hidden sm:inline">
            Fictional Demonstration Specimen — Illustrative Data Only
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-teal-200 font-mono text-[10px]">
          <Lock className="w-3 h-3" />
          <span>RLS Isolated</span>
        </div>
      </div>

      {/* Card Header: Patient Demographics & Provenance */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-teal-100 text-teal-700">
                <FileText className="w-4 h-4" />
              </span>
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                Comprehensive Diagnostic Panel
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                Audit Verified
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <span className="flex items-center gap-1 font-medium">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Patient: <strong className="text-slate-800">Jane Doe</strong>
              </span>
              <span className="text-slate-400">•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                DOB: 01/15/1988 (Age 38)
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-mono text-[11px] text-slate-500">
                Specimen ID: SYN-8492-Q
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] uppercase font-bold text-slate-500">Extraction Model</div>
              <div className="text-xs font-mono text-teal-800 font-semibold">Gemini 2.5 Flash</div>
            </div>
            <div className="h-8 w-px bg-slate-200 hidden sm:block" />
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-500">Validation Pass</div>
              <div className="text-xs font-mono text-emerald-800 font-bold">100% Deterministic</div>
            </div>
          </div>
        </div>
      </div>

      {/* Extracted Biomarker Values Table */}
      <div className="divide-y divide-slate-100 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-100/60 text-slate-500 text-[10px] font-semibold uppercase tracking-wider">
              <th className="py-2.5 px-4">Biomarker / LOINC</th>
              <th className="py-2.5 px-3">Extracted Result</th>
              <th className="py-2.5 px-3">Reference Range</th>
              <th className="py-2.5 px-4 text-right">Integrity Audit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {fictionalObservations.map((obs) => (
              <tr key={obs.canonicalName} className="hover:bg-teal-50/30 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-900">{obs.canonicalName}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono mt-0.5">
                    <Hash className="w-3 h-3 text-slate-400" />
                    <span>LOINC: {obs.loincCode}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-tight">{obs.category}</span>
                  </div>
                </td>
                <td className="py-3 px-3 whitespace-nowrap">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-base font-bold font-mono ${
                      obs.status === 'warning' ? 'text-amber-700 font-extrabold' : 'text-slate-900'
                    }`}>
                      {obs.value}
                    </span>
                    <span className="text-xs text-slate-600 font-medium">{obs.unit}</span>
                  </div>
                </td>
                <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-mono text-xs">
                  {obs.refLow !== null && obs.refHigh !== null
                    ? `${obs.refLow} – ${obs.refHigh} ${obs.unit}`
                    : `< ${obs.refHigh} ${obs.unit}`}
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  {obs.status === 'valid' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{obs.statusLabel}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>{obs.statusLabel}</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Provenance & Cryptographic Audit Footer */}
      <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
          <span>
            Source PDF Checksum: <code className="font-mono text-slate-700 bg-white px-1 py-0.5 rounded border border-slate-200 text-[10px]">SHA-256 e8f3a9b1...</code>
          </span>
        </div>
        <div className="text-[10px] font-mono text-slate-500">
          Strict Zero-Hallucination Enforced • Human Verification Pending (0)
        </div>
      </div>
    </div>
  );
};
