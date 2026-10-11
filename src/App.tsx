import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HealthDataProvider, useHealthData } from './context/HealthDataContext';
import { Shell } from './components/layout/Shell';
import { AuthModal } from './components/auth/AuthModal';
import { OverviewScreen } from './components/screens/OverviewScreen';
import { UploadScreen } from './components/screens/UploadScreen';
import { ReviewScreen } from './components/screens/ReviewScreen';
import { TimelineScreen } from './components/screens/TimelineScreen';
import { TrendsScreen } from './components/screens/TrendsScreen';
import { DataQualityScreen } from './components/screens/DataQualityScreen';
import { DocumentsScreen } from './components/screens/DocumentsScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { Lock, LogIn, ShieldCheck, Database, Activity } from 'lucide-react';

const MainRouter: React.FC = () => {
  const { activeScreen, isRefreshing } = useHealthData();
  const { currentUser, isLoading, setShowAuthModal } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-mono">Authenticating secure session...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 mx-auto flex items-center justify-center shadow-subtle">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            VitalTrace Secure Clinical Workspace
          </h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            All medical records and observation metrics are strictly isolated behind cryptographic user boundaries. Sign in or create an account to access your private laboratory workspace.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={() => setShowAuthModal(true)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-subtle transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In / Create Account</span>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 text-left">
          <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Zero Shared Data</span>
            </div>
            <p className="text-[11px] text-slate-500">Every account starts clean with strict row-level isolation.</p>
          </div>
          <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Database className="w-4 h-4 text-teal-600" />
              <span>Private Storage</span>
            </div>
            <p className="text-[11px] text-slate-500">Documents encrypted at rest with content checksum verification.</p>
          </div>
          <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Activity className="w-4 h-4 text-teal-600" />
              <span>Real Extraction</span>
            </div>
            <p className="text-[11px] text-slate-500">Zero invented results. Strict error reporting on pipeline failures.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isRefreshing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-mono">Synchronizing account records...</p>
      </div>
    );
  }

  switch (activeScreen) {
    case 'overview':
      return <OverviewScreen />;
    case 'upload':
      return <UploadScreen />;
    case 'review':
      return <ReviewScreen />;
    case 'timeline':
      return <TimelineScreen />;
    case 'trends':
      return <TrendsScreen />;
    case 'data-quality':
      return <DataQualityScreen />;
    case 'documents':
      return <DocumentsScreen />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return <OverviewScreen />;
  }
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <HealthDataProvider>
        <Shell>
          <MainRouter />
        </Shell>
        <AuthModal />
      </HealthDataProvider>
    </AuthProvider>
  );
};

export default App;
