import React from 'react';
import { 
  LayoutDashboard, 
  UploadCloud, 
  CheckSquare, 
  Clock, 
  TrendingUp, 
  ShieldAlert, 
  Files, 
  Settings,
  Activity,
  LogOut,
  ChevronRight,
  Database
} from 'lucide-react';
import { useHealthData } from '../../context/HealthDataContext';
import { useAuth } from '../../context/AuthContext';
import type { ActiveScreen } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { 
    activeScreen, 
    setActiveScreen, 
    observations, 
    validationIssues 
  } = useHealthData();

  // Compute pending review counts
  const pendingReviewCount = observations.filter(o => o.verifiedByUser === 'pending').length;
  const unresolvedIssuesCount = validationIssues.filter(i => !i.resolved).length;

  const navItems: {
    id: ActiveScreen;
    label: string;
    icon: React.ElementType;
    badge?: number | string;
    badgeColor?: string;
  }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'upload',
      label: 'Upload Reports',
      icon: UploadCloud,
    },
    {
      id: 'review',
      label: 'Review Extraction',
      icon: CheckSquare,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: 'timeline',
      label: 'Health Timeline',
      icon: Clock,
    },
    {
      id: 'trends',
      label: 'Trends',
      icon: TrendingUp,
    },
    {
      id: 'data-quality',
      label: 'Data Quality',
      icon: ShieldAlert,
      badge: unresolvedIssuesCount > 0 ? `${unresolvedIssuesCount} issues` : undefined,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: Files,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  const { currentUser, isConfigured, signOut, setShowAuthModal } = useAuth();
  const displayName = currentUser?.displayName || 'Signed Out';
  const email = currentUser?.email || 'No active session';
  const initials = currentUser
    ? currentUser.displayName
        .split(' ')
        .map(p => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'VT';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-sm shadow-teal-500/20">
              <Activity className="w-5 h-5 text-teal-50" />
            </div>
            <div>
              <div className="font-bold tracking-tight text-white flex items-center gap-1.5 text-base">
                VitalTrace
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-teal-400 border border-slate-700">
                  PROD
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                Clinical Health Intelligence
              </div>
            </div>
          </div>
        </div>

        {/* Storage Mode Status */}
        <div className="px-4 py-2 bg-slate-800/60 border-b border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-teal-400">
            <Database className="w-3.5 h-3.5" />
            <span className="font-medium">{isConfigured ? 'PostgreSQL Cloud' : 'Isolated Local'}</span>
          </div>
          <span className="text-[10px] text-emerald-400 uppercase font-mono font-medium">Ready</span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Core Modules
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeScreen === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveScreen(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-600/15 text-teal-400 border border-teal-500/20'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-teal-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded font-mono font-medium border ${
                        item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-teal-400" />}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Account and Sign-out Footer */}
        <div className="p-3 border-t border-slate-800/90 bg-slate-950/40">
          {currentUser ? (
            <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-between">
              <div 
                onClick={() => setActiveScreen('settings')}
                className="min-w-0 flex items-center gap-2.5 cursor-pointer hover:opacity-90"
              >
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate font-mono">
                    {email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => signOut()}
                title="Sign Out"
                className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full py-2.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Activity className="w-4 h-4" />
              <span>Sign In to VitalTrace</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
