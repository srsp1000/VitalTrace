import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, User, Mail, KeyRound, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, signUp, isLoading } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // If already authenticated, redirect to /app/overview
  useEffect(() => {
    if (currentUser) {
      navigate('/app/overview', { replace: true });
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    if (!displayName.trim() || !email.trim() || !password) {
      setErrorMessage('Please fill in all registration fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signUp(email.trim(), password, displayName.trim());
      if (res.error) {
        if (res.error.includes('check your email') || res.error.includes('Account created!')) {
          setSuccessNotice(res.error);
        } else {
          setErrorMessage(res.error);
        }
        setIsSubmitting(false);
      } else {
        // Redirection will occur via useEffect as currentUser updates
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed.');
      setIsSubmitting(false);
    }
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
          Create Patient Account
        </h2>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          Sign up for a private, row-level isolated workspace. All newly registered accounts are strictly provisioned as patients.
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

          {successNotice && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 animate-fade-in">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successNotice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Full Legal Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

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
                  placeholder="jane.doe@example.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Create Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Role indicator notice */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
              <span>Account Provisioning Role:</span>
              <span className="font-mono font-semibold text-teal-700 px-2 py-0.5 rounded bg-teal-50 border border-teal-200">
                Patient (Default)
              </span>
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
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-teal-700 hover:text-teal-800">
              Sign In
            </Link>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Strict Zero-Escalation RBAC Enforced</span>
        </div>
      </div>
    </div>
  );
};
