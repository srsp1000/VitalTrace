import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowLeft, ShieldCheck, Lock, FileText } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-xs font-semibold">
            <ArrowLeft className="w-4 h-4" />
            <span>Return to VitalTrace Home</span>
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center text-white">
              <Activity className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 text-sm">VitalTrace</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="space-y-8 bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 shadow-subtle">
          <div className="space-y-2 border-b border-slate-200 pb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-teal-50 text-teal-700 text-[11px] font-mono font-semibold border border-teal-200">
              <Lock className="w-3.5 h-3.5" />
              <span>HIPAA-ALIGNED PRIVACY ARCHITECTURE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              VitalTrace Privacy Policy
            </h1>
            <p className="text-xs text-slate-500 font-mono">
              Effective Date: January 1, 2026 • Version 5.0
            </p>
          </div>

          {/* Core Commitments */}
          <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200/80 space-y-2 text-xs text-teal-950">
            <div className="flex items-center gap-2 font-bold text-teal-900">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Our Foundational Patient Privacy Guarantees</span>
            </div>
            <p className="leading-relaxed">
              VitalTrace was built specifically to protect sensitive diagnostic information. We do not sell your health records, we do not monetize patient telemetry, and we never train public foundational models on your uploaded clinical documents.
            </p>
          </div>

          <section className="space-y-3 text-xs leading-relaxed text-slate-700">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-teal-800">
              1. Information We Collect
            </h2>
            <p>
              When you interact with the VitalTrace platform, we process only the data necessary to provide structured laboratory intelligence:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li><strong>Account Credentials:</strong> Email address, encrypted authentication tokens, and user display name.</li>
              <li><strong>Medical Documents:</strong> Laboratory PDFs, diagnostic imaging scans, and specimen reports explicitly uploaded by you.</li>
              <li><strong>Biomarker Observations:</strong> Numerical lab values, LOINC standard codes, biological units, and test collection dates extracted from your documents.</li>
              <li><strong>System Audit Logs:</strong> Cryptographic file checksums (SHA-256), pipeline execution runtimes, and user verification decisions.</li>
            </ul>
          </section>

          <section className="space-y-3 text-xs leading-relaxed text-slate-700">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-teal-800">
              2. Technical Security & Row-Level Isolation
            </h2>
            <p>
              VitalTrace enforces defense-in-depth healthcare security safeguards:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li><strong>PostgreSQL Row-Level Security (RLS):</strong> Every database table (<code className="font-mono text-slate-800">documents</code>, <code className="font-mono text-slate-800">observations</code>, <code className="font-mono text-slate-800">validation_issues</code>) strictly restricts data access to your authenticated identity (<code className="font-mono text-slate-800">auth.uid() = profile_id</code>).</li>
              <li><strong>Zero Client Secrets:</strong> AI provider API keys are executed server-side via authenticated Edge Functions. Browser clients never receive or store third-party API credentials.</li>
              <li><strong>Ephemeral Storage Access:</strong> Private medical documents are encrypted at rest (AES-256) and accessed strictly via short-lived, cryptographically signed URLs.</li>
            </ul>
          </section>

          <section className="space-y-3 text-xs leading-relaxed text-slate-700">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-teal-800">
              3. Patient Rights & Data Portability
            </h2>
            <p>
              You maintain uncompromised sovereignty over your healthcare information:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li><strong>Right to Portability:</strong> You can export a comprehensive machine-readable JSON archive of all observations and source document references at any time via Patient Settings.</li>
              <li><strong>Right to Rectification:</strong> You can edit and correct any extracted biomarker value in the Observation Review screen.</li>
              <li><strong>Right to Erasure:</strong> You can delete any uploaded document or observation from the workspace with immediate cascade purging across database rows.</li>
            </ul>
          </section>

          <section className="space-y-3 text-xs leading-relaxed text-slate-700 border-t border-slate-100 pt-6">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-teal-800">
              4. Contact Our Privacy Officer
            </h2>
            <p>
              For privacy inquiries, audit logs, or compliance questions, contact: <code className="font-mono text-teal-800">privacy@vitaltrace.internal</code>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export const TermsOfUsePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-xs font-semibold">
            <ArrowLeft className="w-4 h-4" />
            <span>Return to VitalTrace Home</span>
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center text-white">
              <Activity className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 text-sm">VitalTrace</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="space-y-8 bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 shadow-subtle">
          <div className="space-y-2 border-b border-slate-200 pb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-800 text-[11px] font-mono font-semibold border border-slate-200">
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              <span>TERMS OF CLINICAL PLATFORM USE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              VitalTrace Terms of Use
            </h1>
            <p className="text-xs text-slate-500 font-mono">
              Last Updated: January 1, 2026 • Version 5.0
            </p>
          </div>

          {/* Mandatory Medical Disclaimer */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs text-amber-950">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>MANDATORY MEDICAL DISCLAIMER — NOT MEDICAL ADVICE</span>
            </div>
            <p className="leading-relaxed">
              VitalTrace is strictly an informational record-keeping, parsing, and data validation tool. It does <strong>NOT</strong> constitute medical advice, clinical diagnosis, patient management, or clinical decision support. If you believe you are experiencing a medical emergency, immediately contact emergency services or a qualified physician.
            </p>
          </div>

          <section className="space-y-3 text-xs leading-relaxed text-slate-700">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-teal-800">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or creating an account on VitalTrace, you agree to these Terms of Use and our Privacy Policy. If you do not agree to these terms, do not upload medical documents or use the software services.
            </p>
          </section>

          <section className="space-y-3 text-xs leading-relaxed text-slate-700">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-teal-800">
              2. User Obligations & Document Ownership
            </h2>
            <p>
              You represent and warrant that:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>You have the legal right, consent, or power of attorney to upload and analyze any medical documents submitted to the platform.</li>
              <li>You understand that extracted biomarker values should always be cross-referenced with your original laboratory paper reports before being shared with healthcare practitioners.</li>
              <li>You will not attempt to bypass Row-Level Security, scrape endpoints, or execute unauthorized security penetration tests against production infrastructure.</li>
            </ul>
          </section>

          <section className="space-y-3 text-xs leading-relaxed text-slate-700">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-teal-800">
              3. Deterministic Extraction Limitations
            </h2>
            <p>
              While VitalTrace employs rigorous deterministic validation rules, optical character recognition and multimodal LLM extraction can encounter corrupted files, non-standard laboratory layouts, or unmapped biomarker aliases. The user retains responsibility for utilizing the human-in-the-loop review interface to verify accuracy.
            </p>
          </section>

          <section className="space-y-3 text-xs leading-relaxed text-slate-700 border-t border-slate-100 pt-6">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-teal-800">
              4. Governing Law & Contact
            </h2>
            <p>
              These terms are governed by standard software licensing and healthcare data governance regulations. For legal questions, contact: <code className="font-mono text-teal-800">legal@vitaltrace.internal</code>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};
