import React from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Database,
  GitCommit,
  ShieldCheck,
  FileText,
  Download,
  Users,
  Settings,
  Shield
} from 'lucide-react';
import { UserRole } from '../types/forensics';

export type TabId =
  | 'overview'
  | 'investigations'
  | 'evidence'
  | 'custody'
  | 'integrity'
  | 'audit'
  | 'reports'
  | 'users'
  | 'settings';

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  userRole: UserRole;
  pendingTransfersCount: number;
  integrityMismatchesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  pendingTransfersCount,
  integrityMismatchesCount
}) => {
  const navItems: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number; alert?: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'investigations', label: 'Investigations', icon: Briefcase },
    { id: 'evidence', label: 'Evidence Vault', icon: Database },
    { id: 'custody', label: 'Chain of Custody', icon: GitCommit, badge: pendingTransfersCount },
    { id: 'integrity', label: 'Integrity Verification', icon: ShieldCheck, alert: integrityMismatchesCount > 0 },
    { id: 'audit', label: 'Audit Center', icon: FileText },
    { id: 'reports', label: 'Reports', icon: Download },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'settings', label: 'Security Settings', icon: Settings }
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-[#DFE8F3] dark:border-slate-800 flex flex-col shrink-0 select-none transition-colors">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-[#DFE8F3] dark:border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-[#155EEF] flex items-center justify-center text-white shadow-xs">
          <Shield className="w-5 h-5 fill-current" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-base tracking-tight text-[#142B4D] dark:text-white flex items-center gap-1.5 leading-tight">
            CyberTrace
          </div>
          <div className="text-[10px] text-[#60748F] dark:text-slate-400 truncate leading-tight">
            Digital Evidence & Custody
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer text-left ${
                isActive
                  ? 'bg-[#EAF2FF] text-[#155EEF] font-semibold dark:bg-[#155EEF]/20 dark:text-[#38BDF8] shadow-xs'
                  : 'text-[#60748F] hover:text-[#142B4D] hover:bg-[#F5F8FC] dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-[#155EEF] dark:text-[#38BDF8]' : 'text-[#60748F] dark:text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge !== undefined && item.badge > 0 && (
                <span className="px-1.5 py-0.5 text-[11px] font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {item.badge}
                </span>
              )}

              {item.alert && (
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" title="Integrity mismatch detected" />
              )}
            </button>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-3 border-t border-[#DFE8F3] dark:border-slate-800">
        <div className="bg-[#F5F8FC] dark:bg-slate-950/60 rounded-xl p-3 border border-[#DFE8F3] dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-[#142B4D] dark:text-slate-200">CyberTrace</span>
            <span className="text-[10px] text-[#60748F] dark:text-slate-400 font-mono">v1.0.0</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#12A66A]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#12A66A] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#12A66A]"></span>
            </span>
            <span>System Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
