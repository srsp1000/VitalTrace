import React from 'react';
import { 
  Menu, 
  Upload, 
  ShieldCheck, 
  LogIn, 
  UserCheck, 
  Server 
} from 'lucide-react';
import { useHealthData } from '../../context/HealthDataContext';
import { useAuth } from '../../context/AuthContext';
import type { ActiveScreen } from '../../types';

interface HeaderProps {
  onOpenSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSidebar }) => {
  const { activeScreen, setActiveScreen, documents, observations } = useHealthData();
  const { currentUser, isConfigured, setShowAuthModal } = useAuth();

  const getScreenTitle = (screen: ActiveScreen): { title: string; subtitle: string } => {
    switch (screen) {
      case 'overview':
        return {
          title: 'Executive Clinical Overview',
          subtitle: 'Holistic summary of document processing, observations, and pipeline integrity.',
        };
      case 'upload':
        return {
          title: 'Upload Laboratory Report',
          subtitle: 'Ingest laboratory PDFs and scans into structured observation schemas.',
        };
      case 'review':
        return {
          title: 'Observation Extraction Review',
          subtitle: 'Deterministic validation review, unit auditing, and clinician/user verification.',
        };
      case 'timeline':
        return {
          title: 'Chronological Health Timeline',
          subtitle: 'Filterable longitudinal record of confirmed biometric observations.',
        };
      case 'trends':
        return {
          title: 'Biomarker Longitudinal Trends',
          subtitle: 'Analytical trajectory graphs with reference ranges and traceability links.',
        };
      case 'data-quality':
        return {
          title: 'Data Quality & Pipeline Monitor',
          subtitle: 'Deterministic telemetry for ingestion throughput, pass rates, and schema discrepancies.',
        };
      case 'documents':
        return {
          title: 'Source Document Repository',
          subtitle: 'Complete provenance tracking and private medical document records.',
        };
      case 'settings':
        return {
          title: 'Settings & Security',
          subtitle: 'Database configuration, storage access control, encryption, and account info.',
        };
      default:
        return {
          title: 'VitalTrace Intelligence',
          subtitle: 'Healthcare Clinical Records & Validation Platform',
        };
    }
  };

  const { title, subtitle } = getScreenTitle(activeScreen);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      {/* Top Clinical Safety Disclaimer Strip */}
      <div className="bg-slate-100 border-b border-slate-200/80 px-4 py-1 flex items-center justify-between text-[11px] text-slate-600">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
          <span>
            <strong>Data Integrity Notice:</strong> VitalTrace organizes and audits laboratory records. It does not provide medical diagnoses or clinical advice.
          </span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-slate-500 font-mono">
          <Server className="w-3 h-3 text-slate-400" />
          <span>Storage: {isConfigured ? 'Supabase PostgreSQL (Cloud Sync)' : 'Isolated Local Workspace'}</span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden border border-slate-200"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg lg:text-xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="hidden sm:block text-xs text-slate-500">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Sign In / User Status */}
          {!currentUser ? (
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5 text-slate-600" />
              <span>Sign In / Register</span>
            </button>
          ) : (
            <div 
              onClick={() => setActiveScreen('settings')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-xs font-medium cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-teal-600" />
              <span className="truncate max-w-[120px]">{currentUser.displayName}</span>
            </div>
          )}

          {activeScreen !== 'upload' && (
            <button
              onClick={() => setActiveScreen('upload')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-subtle"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Report</span>
            </button>
          )}

          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-[11px] font-mono text-slate-700 border border-slate-200"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            <span>Records: {documents.length} Docs, {observations.length} Obs</span>
          </div>
        </div>
      </div>
    </header>
  );
};
