import React from 'react';
import { 
  Shield, 
  Database, 
  Key, 
  LogOut, 
  Lock,
  Server,
  LogIn,
  Check,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const SettingsScreen: React.FC = () => {
  const { currentUser, isConfigured, signOut, setShowAuthModal } = useAuth();

  const initials = (currentUser?.displayName || 'User')
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-4xl space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Account & Security Infrastructure
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Row-Level Security configurations, database migrations, and active user session state.
          </p>
        </div>

        {!currentUser ? (
          <button
            onClick={() => setShowAuthModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-subtle transition-colors shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In / Create Account</span>
          </button>
        ) : (
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        )}
      </div>

      {/* User Profile Card */}
      {currentUser && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-subtle p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-900 text-teal-400 font-bold flex items-center justify-center text-base">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {currentUser.displayName}
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    AUTHENTICATED
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  User ID: {currentUser.id}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-[11px] font-semibold uppercase text-slate-500 block mb-1">
                Registered Email
              </label>
              <input
                type="text"
                readOnly
                value={currentUser.email}
                className="w-full rounded-md border border-slate-200 px-3 py-2 bg-slate-50 text-slate-700 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase text-slate-500 block mb-1">
                Data Ownership Boundary
              </label>
              <input
                type="text"
                readOnly
                value="Private Row-Level Protected User Scope"
                className="w-full rounded-md border border-slate-200 px-3 py-2 bg-slate-50 text-slate-700 font-medium"
              />
            </div>
          </div>
        </div>
      )}

      {/* Supabase Connection & Backend Status */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-subtle p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Backend Extraction & Storage Architecture
            </h3>
          </div>
          <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded font-semibold flex items-center gap-1 ${
            isConfigured 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}>
            {isConfigured ? <Check className="w-3 h-3 text-emerald-600" /> : <AlertTriangle className="w-3 h-3 text-amber-500" />}
            {isConfigured ? 'Live PostgreSQL Backend Active' : 'Isolated Local Workspace'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
          <div className="p-3 rounded-md bg-slate-50 border border-slate-200 space-y-1 font-mono">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-sans font-semibold">
              PostgreSQL Schema
            </div>
            <div className="text-slate-900 font-bold">5 Core Tables</div>
            <div className="text-[11px] text-slate-500">
              profiles, documents, runs, observations, issues
            </div>
          </div>

          <div className="p-3 rounded-md bg-slate-50 border border-slate-200 space-y-1 font-mono">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-sans font-semibold">
              Storage Bucket
            </div>
            <div className="text-slate-900 font-bold">medical-documents</div>
            <div className="text-[11px] text-teal-700">
              private: true (10MB limit)
            </div>
          </div>

          <div className="p-3 rounded-md bg-slate-50 border border-slate-200 space-y-1 font-mono">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-sans font-semibold">
              SQL Analytics
            </div>
            <div className="text-slate-900 font-bold">10 Reusable Views</div>
            <div className="text-[11px] text-slate-500">
              Pass rate, latencies, deltas
            </div>
          </div>
        </div>

        {!isConfigured && (
          <div className="p-3.5 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="font-semibold text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Live AI Extraction Setup Required</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              VitalTrace is operating in local storage mode. Synthetic fallback simulators have been eliminated to ensure clinical data integrity; attempting extraction without a reachable backend intentionally records a failed status. To enable live extraction:
            </p>
            <div className="bg-amber-100/70 p-2.5 rounded font-mono text-[10px] space-y-1 text-amber-950">
              <div>1. Set <code>VITE_SUPABASE_URL=https://&lt;project&gt;.supabase.co</code> in <code>.env</code></div>
              <div>2. Set <code>VITE_SUPABASE_ANON_KEY=&lt;anon-key&gt;</code> in <code>.env</code></div>
              <div>3. Deploy Edge Function: <code>supabase functions deploy extract-report</code></div>
              <div>4. Configure secret: <code>supabase secrets set GEMINI_API_KEY=&lt;key&gt;</code></div>
            </div>
          </div>
        )}

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Version-controlled SQL migrations located in <code>supabase/migrations/</code> (001 schema, 002 RLS, 003 storage, 004 analytical views). All clinical extraction executed server-side via authenticated Supabase Edge Functions with secret API configuration.
        </p>
      </div>

      {/* Security & RLS Compliance Grid */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-subtle p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Healthcare Security Policies & Access Controls
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
            RLS ENFORCED
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Lock className="w-3.5 h-3.5 text-teal-600" />
              <span>Row-Level Security</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Every query to <code>documents</code>, <code>observations</code>, and <code>validation_issues</code> filters by <code>auth.uid()</code> at the database layer.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Database className="w-3.5 h-3.5 text-teal-600" />
              <span>Private Object Storage</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Medical documents reside in a non-public bucket. Access requires cryptographic time-limited signed URLs generated server-side.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Key className="w-3.5 h-3.5 text-teal-600" />
              <span>Zero Client Secrets</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              AI provider secrets are maintained strictly in server-side Edge Functions. The browser never accesses or stores LLM provider keys.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
