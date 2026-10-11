import React from 'react';
import type { 
  ProcessingStatus, 
  VerificationStatus, 
  ValidationStatus,
  IssueSeverity 
} from '../../types';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  FileText, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';

interface StatusBadgeProps {
  type: 'processing' | 'verification' | 'validation' | 'severity';
  value: ProcessingStatus | VerificationStatus | ValidationStatus | IssueSeverity;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, value, size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  if (type === 'processing') {
    switch (value) {
      case 'completed':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Completed
          </span>
        );
      case 'review_required':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200 ${sizeClasses}`}>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Review Required
          </span>
        );
      case 'processing':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-sky-50 text-sky-700 border border-sky-200 ${sizeClasses}`}>
            <Clock className="w-3.5 h-3.5 text-sky-600 animate-spin" />
            Processing
          </span>
        );
      case 'failed':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-rose-50 text-rose-700 border border-rose-200 ${sizeClasses}`}>
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Failed
          </span>
        );
      case 'uploaded':
      default:
        return (
          <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}>
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Uploaded
          </span>
        );
    }
  }

  if (type === 'verification') {
    switch (value) {
      case 'confirmed':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Confirmed
          </span>
        );
      case 'pending':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200 ${sizeClasses}`}>
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            Awaiting Review
          </span>
        );
      case 'rejected':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-rose-50 text-rose-700 border border-rose-200 ${sizeClasses}`}>
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Rejected
          </span>
        );
    }
  }

  if (type === 'validation') {
    switch (value) {
      case 'valid':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-teal-50 text-teal-700 border border-teal-200 ${sizeClasses}`}>
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            Valid
          </span>
        );
      case 'warning':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200 ${sizeClasses}`}>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Warning
          </span>
        );
      case 'error':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-rose-50 text-rose-700 border border-rose-200 ${sizeClasses}`}>
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            Error
          </span>
        );
    }
  }

  if (type === 'severity') {
    switch (value) {
      case 'info':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-sky-50 text-sky-700 border border-sky-200 ${sizeClasses}`}>
            Info
          </span>
        );
      case 'warning':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200 ${sizeClasses}`}>
            Warning
          </span>
        );
      case 'error':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-rose-50 text-rose-700 border border-rose-200 ${sizeClasses}`}>
            Critical
          </span>
        );
    }
  }

  return null;
};
