import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, ArrowLeft, Shield } from 'lucide-react';

export const AdminForbiddenScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-center">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-card p-8 sm:p-10 space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 mx-auto flex items-center justify-center shadow-subtle">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-mono font-bold uppercase tracking-wider">
            <Shield className="w-3 h-3 text-rose-500" />
            <span>403 Forbidden</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Access Restricted
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
            You do not have administrator access to this area. Administrative telemetry and cross-user pipelines require privileged server-enforced credentials.
          </p>
        </div>

        <div className="pt-2">
          <Link
            to="/app/overview"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-subtle hover:shadow transition-all w-full"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Patient Workspace</span>
          </Link>
        </div>

        <p className="text-[10px] text-slate-400 font-mono">
          Security audit event recorded • Role-based access control
        </p>
      </div>
    </div>
  );
};
