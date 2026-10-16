import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Activity, Mail, KeyRound, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, role, signIn, isLoading, isConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (currentUser) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else if (role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/app/overview', { replace: true });
      }
    }
  }, [currentUser, role, navigate, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signIn(email.trim(), password);
      if (res.error) {
        setErrorMessage(res.error);
        setIsSubmitting(false);
      } else {
        // Redirection handled by useEffect once currentUser updates
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Authentication failed.');
      setIsSubmitting(false);
    }
  };

  // Demo helpers for quick evaluation in local mode
  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* VitalTrace Branding */}
        <Link to="/" className="inline-flex items-center gap-2.5 group mb-4">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-card group-hover:bg-teal-700 transition-colors">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            VitalTrace
          </span>
        </Link>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Sign In to Clinical Workspace
        </h2>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          Access your row-level protected health records, extraction telemetry, and biomarker trajectories.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl border border-slate-200 shadow-card space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="patient@example.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-subtle hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials in Local Mode */}
          {!isConfigured && (
            <div className="pt-3 border-t border-slate-100 text-[11px] space-y-2">
              <span className="text-slate-500 font-medium block">
                Local Storage Mode — Quick autofill:
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('patient@vitaltrace.internal', 'password123')}
                  className="flex-1 py-1 px-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-mono text-[10px]"
                >
                  Patient Demo
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin@vitaltrace.internal', 'password123')}
                  className="flex-1 py-1 px-2 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-mono text-[10px]"
                >
                  Admin Demo
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100">
            Don't have an account yet?{' '}
            <Link to="/register" className="font-semibold text-teal-700 hover:text-teal-800">
              Create a free patient account
            </Link>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>PostgreSQL Row-Level Security Enforced</span>
        </div>
      </div>
    </div>
  );
};
