import React, { useState } from 'react';
import { User, UserRole } from '../types/forensics';
import {
  Shield,
  ChevronDown,
  Plus,
  RefreshCw,
  Sun,
  Moon,
  Search,
  Bell
} from 'lucide-react';
import { TabId } from './Sidebar';

interface HeaderProps {
  currentTab: string;
  currentUser: User;
  allUsers: User[];
  onSwitchUser: (userId: string) => Promise<void>;
  onOpenIntakeModal: () => void;
  onResetDemoData: () => Promise<void>;
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigate?: (tab: TabId) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers,
  onSwitchUser,
  onOpenIntakeModal,
  onResetDemoData,
  isDark,
  onToggleTheme,
  onNavigate
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'Administrator':
        return 'text-[#155EEF] bg-[#EAF2FF] border-[#DFE8F3] dark:text-cyan-400 dark:bg-cyan-950/70 dark:border-cyan-800/80';
      case 'Lead Investigator':
        return 'text-[#155EEF] bg-[#EAF2FF] border-[#DFE8F3] dark:text-blue-400 dark:bg-blue-950/70 dark:border-blue-800/80';
      case 'Investigator':
        return 'text-[#142B4D] bg-[#F5F8FC] border-[#DFE8F3] dark:text-indigo-400 dark:bg-indigo-950/70 dark:border-indigo-800/80';
      case 'Evidence Custodian':
        return 'text-[#F59E0B] bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/70 dark:border-amber-800/80';
      case 'Read-Only Auditor':
        return 'text-[#12A66A] bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/70 dark:border-emerald-800/80';
      default:
        return 'text-[#60748F] bg-[#F5F8FC] border-[#DFE8F3] dark:text-slate-400 dark:bg-slate-900 dark:border-slate-700';
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset database to pristine forensics demonstration state?')) return;
    try {
      setIsResetting(true);
      await onResetDemoData();
    } finally {
      setIsResetting(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && onNavigate) {
      onNavigate('evidence');
    }
  };

  return (
    <header className="h-16 px-6 bg-white dark:bg-slate-900 border-b border-[#DFE8F3] dark:border-slate-800 flex items-center justify-between gap-4 shrink-0 transition-colors">
      {/* Zone 1: Global Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="w-4 h-4 text-[#60748F] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search cases, evidence, custodians, or transfer IDs..."
            className="w-full bg-[#F5F8FC] dark:bg-slate-950 border border-[#DFE8F3] dark:border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-[#142B4D] dark:text-slate-100 placeholder-[#60748F] dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#155EEF]/20 focus:border-[#155EEF] transition-all"
          />
        </div>
      </form>

      {/* Zone 2: Actions, Notifications, Theme & Operator Switcher */}
      <div className="flex items-center gap-3">
        {/* Reset Demo Data */}
        <button
          onClick={handleReset}
          disabled={isResetting}
          title="Reset sample evidence & audit events"
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#60748F] hover:text-[#142B4D] dark:text-slate-400 dark:hover:text-slate-200 bg-[#F5F8FC] dark:bg-slate-800 hover:bg-[#EAF2FF] dark:hover:bg-slate-700/80 rounded-lg border border-[#DFE8F3] dark:border-slate-700 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-[#155EEF]' : ''}`} />
          <span>Reset Demo</span>
        </button>

        {/* Notifications Icon with Badge */}
        <button
          title="Forensic Notifications"
          className="relative p-2 text-[#60748F] hover:text-[#142B4D] dark:text-slate-400 dark:hover:text-slate-200 hover:bg-[#F5F8FC] dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#DC2626]" />
        </button>

        {/* Theme Toggle (Light / Dark) */}
        <button
          onClick={onToggleTheme}
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className="p-2 text-[#60748F] hover:text-[#142B4D] dark:text-slate-400 dark:hover:text-slate-200 hover:bg-[#F5F8FC] dark:hover:bg-slate-800 rounded-lg border border-[#DFE8F3] dark:border-slate-800 transition-colors cursor-pointer"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#155EEF]" />}
        </button>

        {/* User Profile & Operator Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 bg-[#F5F8FC] dark:bg-slate-950/70 hover:bg-[#EAF2FF]/60 dark:hover:bg-slate-900 rounded-lg border border-[#DFE8F3] dark:border-slate-800 text-left transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-[#EAF2FF] dark:bg-cyan-950 border border-[#DFE8F3] dark:border-cyan-800/80 flex items-center justify-center text-[#155EEF] dark:text-cyan-400 font-bold text-xs">
              {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-[#142B4D] dark:text-slate-200 leading-tight">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-[#60748F] dark:text-slate-400 leading-tight">
                {currentUser.role}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#60748F] ml-0.5" />
          </button>

          {/* Operator Switcher Dropdown */}
          {showUserDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-xl shadow-xl py-2 z-50">
                <div className="px-4 py-2 border-b border-[#DFE8F3] dark:border-slate-800 text-[11px] font-semibold text-[#60748F] dark:text-slate-400 uppercase tracking-wider">
                  Switch Operator Role (RBAC Testing)
                </div>
                <div className="py-1 max-h-72 overflow-y-auto">
                  {allUsers.map(user => {
                    const isSelected = user.id === currentUser.id;
                    return (
                      <button
                        key={user.id}
                        onClick={async () => {
                          setShowUserDropdown(false);
                          if (!isSelected) {
                            await onSwitchUser(user.id);
                          }
                        }}
                        className={`w-full px-4 py-2.5 text-left flex items-start gap-3 hover:bg-[#F5F8FC] dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#EAF2FF] dark:bg-cyan-950/40 text-[#155EEF] dark:text-cyan-300 font-medium' : 'text-[#142B4D] dark:text-slate-300'
                        }`}
                      >
                        <Shield className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-[#155EEF] dark:text-cyan-400 fill-current' : 'text-[#60748F] dark:text-slate-500'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate flex items-center justify-between">
                            <span>{user.name}</span>
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${getRoleColor(user.role)}`}>
                              {user.role}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#60748F] dark:text-slate-400 truncate mt-0.5">
                            {user.department} · #{user.badgeNumber}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onOpenIntakeModal}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#155EEF] hover:bg-[#124bbf] rounded-lg shadow-xs transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Intake Evidence</span>
        </button>
      </div>
    </header>
  );
};
