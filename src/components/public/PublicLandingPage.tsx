import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Activity, 
  ArrowRight, 
  ShieldCheck, 
  Lock, 
  Database, 
  UploadCloud, 
  Cpu, 
  CheckCircle2, 
  FileCheck2, 
  Sparkles, 
  TrendingUp, 
  UserCheck, 
  ChevronDown, 
  AlertTriangle,
  Server,
  FileText,
  Key,
  Download
} from 'lucide-react';
import { PublicNavbar } from './PublicNavbar';
import { FictionalReportPreview } from './FictionalReportPreview';

export const PublicLandingPage: React.FC = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const workflowSteps = [
    {
      step: '01',
      title: 'Secure Upload',
      description: 'Ingest laboratory reports across PDF, image, and scanned formats. SHA-256 cryptographic checksums guarantee provenance before processing.',
      icon: UploadCloud,
    },
    {
      step: '02',
      title: 'Encrypted Storage',
      description: 'Documents are isolated in private cloud object buckets with zero public access. Files are only accessible via ephemeral signed URLs.',
      icon: Database,
    },
    {
      step: '03',
      title: 'Structured Extraction',
      description: 'Server-side LLM extraction maps raw laboratory tables into structured LOINC-aligned biomarker schemas with zero client credential exposure.',
      icon: Cpu,
    },
    {
      step: '04',
      title: 'Deterministic Validation',
      description: 'Rules engines verify physiological bounds, audit unit consistency, flag implausible outliers, and detect duplicate specimen dates.',
      icon: FileCheck2,
    },
    {
      step: '05',
      title: 'Human-in-the-Loop Review',
      description: 'Patients and clinicians audit extracted findings, confirm high-confidence records, and review discrepancies with complete source traceability.',
      icon: UserCheck,
    },
  ];

  const features = [
    {
      title: 'Deterministic Range & Bounds Auditing',
      description: 'Biomarkers are validated against physiological reference boundaries. Zero reliance on generative guesswork for clinical numeric values.',
      icon: ShieldCheck,
      badge: 'Zero Hallucination',
    },
    {
      title: 'Longitudinal Biomarker Trajectories',
      description: 'Track HbA1c, lipid profiles, renal panels, and metabolic markers over time with automated delta calculations and historical trendlines.',
      icon: TrendingUp,
      badge: 'Longitudinal',
    },
    {
      title: 'Row-Level Cryptographic Isolation',
      description: 'Strict database Row-Level Security (RLS) ensures medical records are accessible only by the authenticated owner at the PostgreSQL kernel level.',
      icon: Lock,
      badge: 'RLS Enforced',
    },
    {
      title: 'Human-in-the-Loop Clinical Audit',
      description: 'Clear triage interface allows users to review, edit, confirm, or reject observations before they populate longitudinal charts.',
      icon: UserCheck,
      badge: 'Audit Trail',
    },
    {
      title: 'Complete Source Provenance',
      description: 'Every extracted observation preserves its exact origin: document filename, specimen timestamp, extraction model, and page provenance.',
      icon: FileText,
      badge: 'Provenance',
    },
    {
      title: 'Enterprise Analytics & Export',
      description: 'Export all personal health data in machine-readable JSON anytime. Ready for Power BI semantic models and clinical consultations.',
      icon: Download,
      badge: 'Data Portability',
    },
  ];

  const faqs = [
    {
      q: 'How does VitalTrace prevent AI hallucinations in lab values?',
      a: 'Unlike generic chatbots that summarize text loosely, VitalTrace utilizes structured JSON schema constraints (Zod) combined with deterministic validation rules. Extracted numbers are strictly checked against unit definitions, plausible biological ranges, and source documents. If extraction is uncertain, it is flagged for manual review rather than guessed.',
    },
    {
      q: 'Can other patients or platform administrators view my health records?',
      a: 'No. VitalTrace enforces database-level Row-Level Security (RLS) in PostgreSQL. Every select, insert, and update query is cryptographically filtered by your authenticated user ID (auth.uid()). User data is partitioned and private.',
    },
    {
      q: 'Are my original laboratory PDF documents preserved?',
      a: 'Yes. Your uploaded files are stored in a private, encrypted storage bucket. Each document is indexed with a SHA-256 checksum, allowing you to view and download your original source records alongside extracted data at any time.',
    },
    {
      q: 'Can I export or delete all my personal health data?',
      a: 'Absolutely. You retain full ownership of your clinical information. You can download a complete JSON export of all your documents, observations, and validation logs directly from your Patient Settings screen at any time.',
    },
    {
      q: 'What types of laboratory reports and biomarkers are supported?',
      a: 'VitalTrace supports Comprehensive Metabolic Panels (CMP), Complete Blood Count (CBC), Lipid Panels, Thyroid Panels (TSH, Free T4), Glycemic Markers (HbA1c, Fasting Glucose), Renal Function (eGFR, Creatinine), Liver Panels (ALT, AST), and many more standard outpatient lab diagnostics.',
    },
    {
      q: 'Does VitalTrace provide medical diagnoses or replace my physician?',
      a: 'No. VitalTrace is strictly an informational record organization, longitudinal tracking, and data auditing platform. It does not provide clinical diagnoses, medical interpretations, or treatment plans. Always consult a qualified licensed healthcare provider for medical decisions.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-teal-100 selection:text-teal-900">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32 bg-gradient-to-b from-teal-50/60 via-white to-slate-50">
        {/* Decorative background glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-teal-200/20 via-sky-200/20 to-transparent blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-semibold shadow-subtle animate-fade-in">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Next-Generation Healthcare Intelligence</span>
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              <span className="font-mono text-[11px] text-teal-700">Deterministic Engine</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
              Clinical Health Intelligence Built for{' '}
              <span className="bg-gradient-to-r from-teal-600 to-teal-800 bg-clip-text text-transparent">
                Precision & Provenance
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Transform unstructured diagnostic laboratory PDFs into clean, validated longitudinal biomarker records with zero data hallucination, deterministic bounds checking, and ironclad privacy.
            </p>

            {/* CTA Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-card hover:shadow-elevation transition-all group"
              >
                <span>Get Started — Patient Workspace</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-sm font-semibold border border-slate-300 shadow-subtle transition-all"
              >
                <span>Sign In to Account</span>
              </Link>
            </div>

            {/* Trust Metrics Strip */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-slate-500 font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>Deterministic Bounds Checking</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>Row-Level Security (RLS)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-teal-600" />
                <span>Zero Client-Side API Keys</span>
              </div>
            </div>
          </div>

          {/* Hero Visual Card: Fictional Report Preview */}
          <div className="mt-12 sm:mt-16 max-w-4xl mx-auto">
            <FictionalReportPreview />
          </div>
        </div>
      </section>

      {/* 5-Step Clinical Workflow Section */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <h2 className="text-xs uppercase font-bold tracking-widest text-teal-700 font-mono">
              Deterministic Processing Pipeline
            </h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              From Raw PDF to Audited Longitudinal Insights
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Every specimen follows an automated, transparent 5-stage pipeline designed to eliminate errors and maintain strict medical provenance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
            {workflowSteps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.step}
                  className="bg-slate-50/80 rounded-xl p-5 border border-slate-200/90 shadow-subtle relative hover:shadow-card hover:border-teal-300 transition-all group flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xl font-black text-teal-600/40 group-hover:text-teal-600 transition-colors">
                        {step.step}
                      </span>
                      <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1.5">
                        {step.title}
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200/60 text-[10px] font-mono text-slate-500">
                    Step {idx + 1} of 5
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <h2 className="text-xs uppercase font-bold tracking-widest text-teal-700 font-mono">
              Core Platform Capabilities
            </h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Engineered for Medical Rigor & Data Integrity
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Why leading patients and clinicians trust VitalTrace over generic unstructured AI tools.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="bg-white rounded-xl p-6 border border-slate-200 shadow-subtle hover:shadow-card hover:border-slate-300 transition-all space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shadow-subtle">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                      {feat.badge}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-base font-bold text-slate-900">
                      {feat.title}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Data Quality & User Control Section: Comparison */}
      <section id="data-quality" className="py-20 lg:py-28 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-3 mb-12">
            <h2 className="text-xs uppercase font-bold tracking-widest text-teal-700 font-mono">
              Data Quality & User Control
            </h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Deterministic Pipeline vs Generic Generative AI
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              In clinical medicine, plausible-sounding approximations are dangerous. Here is how VitalTrace guarantees exactness:
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-slate-50 rounded-2xl border border-slate-200 shadow-subtle overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {/* Traditional Generative AI */}
              <div className="p-6 sm:p-8 space-y-5 bg-rose-50/20">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                    ✕
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Generic Chatbot Summaries
                  </h4>
                </div>
                <ul className="space-y-3 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>Prone to numerical hallucinations and swapped lab decimals.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>No cryptographic checksum verification of the underlying file.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>Lacks standardized LOINC codes and reference range boundaries.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>No interactive review screen to dispute or correct extracted values.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>Conversations often fed back into public model training datasets.</span>
                  </li>
                </ul>
              </div>

              {/* VitalTrace Clinical Architecture */}
              <div className="p-6 sm:p-8 space-y-5 bg-teal-50/30">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                    ✓
                  </div>
                  <h4 className="text-sm font-bold text-teal-900">
                    VitalTrace Intelligence Platform
                  </h4>
                </div>
                <ul className="space-y-3 text-xs text-slate-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Deterministic Range Rules:</strong> Enforced by strict Zod schema parsing.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Audit Verification:</strong> SHA-256 fingerprinting on original laboratory files.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Canonical Standardization:</strong> Automatic mapping to LOINC biomarker terms.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Human-in-the-Loop Audit:</strong> Patient verification before data is charted.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Zero Training Guarantee:</strong> Data is never sold, shared, or used for model training.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy & Security Architecture Section */}
      <section id="privacy-security" className="py-20 lg:py-28 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-3 mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-teal-400 text-xs font-mono">
              <Lock className="w-3.5 h-3.5" />
              <span>DEFENSE-IN-DEPTH PRIVACY</span>
            </div>
            <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              Enterprise Healthcare Security Controls
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              Constructed following the stringent standards of HIPAA technical safeguards and zero-trust access control.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="p-6 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
                <Database className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">PostgreSQL Row-Level Security</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Database queries enforce <code className="text-teal-300 font-mono">auth.uid() = profile_id</code> at the engine kernel. Ordinary users are isolated from cross-tenant record leakage.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
                <Key className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Zero Client-Side Secrets</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Raw LLM provider tokens and service-role database keys exist solely within protected server-side Edge Functions. The browser client never touches private keys.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
                <Server className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Encrypted Private Object Storage</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Medical scans and PDF documents reside in private object storage. Read access requires short-lived cryptographic signed tokens generated per authorized session.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 lg:py-28 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-12">
            <h2 className="text-xs uppercase font-bold tracking-widest text-teal-700 font-mono">
              Frequently Asked Questions
            </h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Everything You Need to Know About VitalTrace
            </h3>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={faq.q}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full py-4 px-5 text-left flex items-center justify-between gap-4 font-semibold text-sm text-slate-900 hover:text-teal-700 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-teal-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-200/60 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Medical Safety Disclaimer Strip */}
      <section className="py-8 bg-amber-50/80 border-b border-amber-200/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-start sm:items-center gap-3.5 text-xs text-amber-900">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px]">
                Medical Safety & Clinical Practice Notice
              </h4>
              <p className="text-[11px] leading-relaxed text-amber-900">
                VitalTrace is an informational laboratory record management, extraction auditing, and longitudinal data analytics software tool. It is <strong>NOT a medical device</strong> and does NOT provide medical advice, diagnosis, treatment plans, or clinical decision support. Always consult a licensed healthcare professional for any medical concerns or diagnostic evaluations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white">
                <Activity className="w-4 h-4" />
              </div>
              <span className="font-bold tracking-tight text-white text-base">
                VitalTrace
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-teal-400 border border-slate-700">
                v5.0-PROD
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs">
              <Link to="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-white transition-colors">
                Terms of Use
              </Link>
              <Link to="/login" className="hover:text-white transition-colors">
                Sign In
              </Link>
              <Link to="/register" className="hover:text-white transition-colors text-teal-400 font-semibold">
                Register Account
              </Link>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
            <p>© {new Date().getFullYear()} VitalTrace Clinical Intelligence. All rights reserved.</p>
            <p className="font-mono text-[10px] text-slate-400">
              Deterministic Ingestion • LOINC Standardization • RLS Enforced
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
