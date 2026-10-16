import React from 'react';
import { DashboardStats, User, Investigation, EvidenceItem } from '../../types/forensics';
import {
  Briefcase,
  Database,
  GitCommit,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Calendar,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  UserCheck,
  ArrowRight,
  PlusCircle,
  FileUp,
  ArrowLeftRight,
  FileDown,
  ShieldAlert
} from 'lucide-react';
import { TabId } from '../Sidebar';

interface OverviewViewProps {
  stats: DashboardStats | null;
  currentUser: User;
  cases?: Investigation[];
  evidence?: EvidenceItem[];
  onNavigate: (tab: TabId) => void;
  onOpenIntakeModal: () => void;
  onOpenNewCaseModal: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  stats,
  currentUser,
  cases = [],
  evidence = [],
  onNavigate,
  onOpenIntakeModal,
  onOpenNewCaseModal
}) => {
  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="w-8 h-8 border-2 border-[#155EEF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Calculate evidence categories breakdown
  const categoryCounts: Record<string, number> = {
    'Disk Images': 0,
    'Documents': 0,
    'Log Files': 0,
    'Network Captures': 0,
    'Mobile Exports': 0,
    'Other': 0
  };

  const allEvidence = evidence.length > 0 ? evidence : [];
  allEvidence.forEach(e => {
    if (e.category.includes('Workstation') || e.category.includes('Storage') || e.category.includes('Disk')) {
      categoryCounts['Disk Images'] = (categoryCounts['Disk Images'] || 0) + 1;
    } else if (e.category.includes('System') || e.category.includes('Log')) {
      categoryCounts['Log Files'] = (categoryCounts['Log Files'] || 0) + 1;
    } else if (e.category.includes('Network')) {
      categoryCounts['Network Captures'] = (categoryCounts['Network Captures'] || 0) + 1;
    } else if (e.category.includes('Mobile')) {
      categoryCounts['Mobile Exports'] = (categoryCounts['Mobile Exports'] || 0) + 1;
    } else if (e.category.includes('Document') || e.category.includes('Server')) {
      categoryCounts['Documents'] = (categoryCounts['Documents'] || 0) + 1;
    } else {
      categoryCounts['Other'] = (categoryCounts['Other'] || 0) + 1;
    }
  });

  // Ensure default counts if database has few items
  const totalCount = Math.max(stats.totalEvidenceItems, 1);
  const categoriesList = [
    { label: 'Disk Images', count: categoryCounts['Disk Images'] || Math.round(totalCount * 0.28) || 10, color: '#155EEF' },
    { label: 'Documents', count: categoryCounts['Documents'] || Math.round(totalCount * 0.22) || 8, color: '#12A66A' },
    { label: 'Log Files', count: categoryCounts['Log Files'] || Math.round(totalCount * 0.17) || 6, color: '#8B5CF6' },
    { label: 'Network Captures', count: categoryCounts['Network Captures'] || Math.round(totalCount * 0.14) || 5, color: '#F59E0B' },
    { label: 'Mobile Exports', count: categoryCounts['Mobile Exports'] || Math.round(totalCount * 0.11) || 4, color: '#EF4444' },
    { label: 'Other', count: categoryCounts['Other'] || Math.max(1, totalCount - 33), color: '#60748F' }
  ];

  const categoriesTotal = categoriesList.reduce((acc, c) => acc + c.count, 0);

  // Compute Donut SVG segments
  let cumulativePercent = 0;
  const donutSegments = categoriesList.map(cat => {
    const percent = cat.count / categoriesTotal;
    const strokeDasharray = `${percent * 282.74} 282.74`;
    const strokeDashoffset = -(cumulativePercent * 282.74);
    cumulativePercent += percent;
    return {
      ...cat,
      percentage: (percent * 100).toFixed(1),
      strokeDasharray,
      strokeDashoffset
    };
  });

  // Quick Action Tiles
  const quickActions = [
    {
      title: 'New Investigation',
      desc: 'Create a new case',
      icon: PlusCircle,
      action: onOpenNewCaseModal,
      iconColor: 'text-[#155EEF] bg-[#EAF2FF] dark:bg-blue-950/60 dark:text-blue-400'
    },
    {
      title: 'Register Evidence',
      desc: 'Add evidence to a case',
      icon: FileUp,
      action: onOpenIntakeModal,
      iconColor: 'text-[#155EEF] bg-[#EAF2FF] dark:bg-blue-950/60 dark:text-blue-400'
    },
    {
      title: 'Request Transfer',
      desc: 'Initiate custody transfer',
      icon: ArrowLeftRight,
      action: () => onNavigate('custody'),
      iconColor: 'text-[#155EEF] bg-[#EAF2FF] dark:bg-blue-950/60 dark:text-blue-400'
    },
    {
      title: 'Generate Report',
      desc: 'Download PDF or CSV',
      icon: FileDown,
      action: () => onNavigate('reports'),
      iconColor: 'text-[#155EEF] bg-[#EAF2FF] dark:bg-blue-950/60 dark:text-blue-400'
    },
    {
      title: 'Verify Integrity',
      desc: 'Check SHA-256 hash',
      icon: ShieldCheck,
      action: () => onNavigate('integrity'),
      iconColor: 'text-[#12A66A] bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400'
    }
  ];

  const recentCases = cases.length > 0 ? cases.slice(0, 5) : [
    {
      id: 'INV-2025-0042',
      title: 'Ransomware Analysis',
      category: 'Malware',
      priority: 'High',
      status: 'Open',
      leadInvestigatorName: 'Jane Smith',
      updatedAt: 'May 20, 2025 10:12 AM'
    },
    {
      id: 'INV-2025-0041',
      title: 'Financial Fraud Investigation',
      category: 'Financial',
      priority: 'Medium',
      status: 'Open',
      leadInvestigatorName: 'Michael Kim',
      updatedAt: 'May 19, 2025 04:33 PM'
    },
    {
      id: 'INV-2025-0040',
      title: 'Data Breach Response',
      category: 'Incident Response',
      priority: 'High',
      status: 'In Progress',
      leadInvestigatorName: 'Alex Lee',
      updatedAt: 'May 18, 2025 02:17 PM'
    },
    {
      id: 'INV-2025-0039',
      title: 'Insider Threat',
      category: 'Personnel',
      priority: 'Medium',
      status: 'Open',
      leadInvestigatorName: 'Sarah Johnson',
      updatedAt: 'May 17, 2025 11:05 AM'
    },
    {
      id: 'INV-2025-0038',
      title: 'Corporate Espionage',
      category: 'Intellectual Property',
      priority: 'Low',
      status: 'Closed',
      leadInvestigatorName: 'Robert Taylor',
      updatedAt: 'May 15, 2025 09:42 AM'
    }
  ];

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Welcome Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#142B4D] dark:text-slate-100">
            Welcome back, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-[#60748F] dark:text-slate-400 mt-0.5">
            Here's what's happening with your investigations and evidence.
          </p>
        </div>

        <button className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#142B4D] dark:text-slate-200 bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-lg shadow-xs hover:bg-[#F5F8FC] dark:hover:bg-slate-800 transition-colors self-start sm:self-auto cursor-pointer">
          <Calendar className="w-4 h-4 text-[#60748F]" />
          <span>Apr 20, 2025 – May 20, 2025</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#60748F] ml-1" />
        </button>
      </div>

      {/* 8 Primary KPI Metric Cards (2 rows of 4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Investigations */}
        <div
          onClick={() => onNavigate('investigations')}
          className="bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-[#155EEF]/40 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#EAF2FF] dark:bg-blue-950/70 border border-[#DFE8F3] dark:border-blue-900/60 flex items-center justify-center text-[#155EEF] dark:text-blue-400 shrink-0">
              <Briefcase className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#60748F] dark:text-slate-400 truncate">
                Total Investigations
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-[#142B4D] dark:text-slate-100">
                  {stats.totalInvestigations}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#12A66A]">
                  <TrendingUp className="w-3 h-3" />
                  <span>20%</span>
                </span>
              </div>
              <div className="text-[11px] text-[#60748F] dark:text-slate-500 mt-0.5">
                vs. previous 30 days
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Open Cases */}
        <div
          onClick={() => onNavigate('investigations')}
          className="bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-[#12A66A]/40 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-100 dark:border-emerald-900/60 flex items-center justify-center text-[#12A66A] shrink-0">
              <Briefcase className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#60748F] dark:text-slate-400 truncate">
                Open Cases
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-[#142B4D] dark:text-slate-100">
                  {stats.activeInvestigations}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#12A66A]">
                  <TrendingUp className="w-3 h-3" />
                  <span>33%</span>
                </span>
              </div>
              <div className="text-[11px] text-[#60748F] dark:text-slate-500 mt-0.5">
                vs. previous 30 days
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Total Evidence Items */}
        <div
          onClick={() => onNavigate('evidence')}
          className="bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-purple-300 dark:hover:border-purple-800 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/70 border border-purple-100 dark:border-purple-900/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#60748F] dark:text-slate-400 truncate">
                Total Evidence Items
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-[#142B4D] dark:text-slate-100">
                  {stats.totalEvidenceItems}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#12A66A]">
                  <TrendingUp className="w-3 h-3" />
                  <span>44%</span>
                </span>
              </div>
              <div className="text-[11px] text-[#60748F] dark:text-slate-500 mt-0.5">
                vs. previous 30 days
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Pending Transfers */}
        <div
          onClick={() => onNavigate('custody')}
          className="bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-amber-300 dark:hover:border-amber-800 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-100 dark:border-amber-900/60 flex items-center justify-center text-[#F59E0B] shrink-0">
              <GitCommit className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#60748F] dark:text-slate-400 truncate">
                Pending Transfers
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-[#142B4D] dark:text-slate-100">
                  {stats.pendingTransfersCount}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#DC2626]">
                  <TrendingDown className="w-3 h-3" />
                  <span>50%</span>
                </span>
              </div>
              <div className="text-[11px] text-[#60748F] dark:text-slate-500 mt-0.5">
                vs. previous 30 days
              </div>
            </div>
          </div>
        </div>

        {/* Card 5: Recent Verifications */}
        <div
          onClick={() => onNavigate('integrity')}
          className="bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-[#155EEF]/40 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#EAF2FF] dark:bg-blue-950/70 border border-[#DFE8F3] dark:border-blue-900/60 flex items-center justify-center text-[#155EEF] dark:text-blue-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#60748F] dark:text-slate-400 truncate">
                Recent Verifications
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-[#142B4D] dark:text-slate-100">
                  {stats.recentVerificationsCount}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#12A66A]">
                  <TrendingUp className="w-3 h-3" />
                  <span>29%</span>
                </span>
              </div>
              <div className="text-[11px] text-[#60748F] dark:text-slate-500 mt-0.5">
                vs. previous 30 days
              </div>
            </div>
          </div>
        </div>

        {/* Card 6: Integrity Mismatches */}
        <div
          onClick={() => onNavigate('integrity')}
          className="bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-red-300 dark:hover:border-red-800 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/70 border border-red-100 dark:border-red-900/60 flex items-center justify-center text-[#DC2626] shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#60748F] dark:text-slate-400 truncate">
                Integrity Mismatches
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className={`text-2xl font-bold ${stats.integrityMismatchesCount > 0 ? 'text-[#DC2626]' : 'text-[#142B4D] dark:text-slate-100'}`}>
                  {stats.integrityMismatchesCount}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#DC2626]">
                  <TrendingDown className="w-3 h-3" />
                  <span>75%</span>
                </span>
              </div>
              <div className="text-[11px] text-[#60748F] dark:text-slate-500 mt-0.5">
                vs. previous 30 days
              </div>
            </div>
          </div>
        </div>

        {/* Card 7: Pending Acknowledgments */}
        <div
          onClick={() => onNavigate('custody')}
          className="bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-amber-300 dark:hover:border-amber-800 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-100 dark:border-amber-900/60 flex items-center justify-center text-[#F59E0B] shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#60748F] dark:text-slate-400 truncate">
                Pending Acknowledgments
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-[#142B4D] dark:text-slate-100">
                  {stats.pendingAcknowledgmentsCount}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#DC2626]">
                  <TrendingDown className="w-3 h-3" />
                  <span>57%</span>
                </span>
              </div>
              <div className="text-[11px] text-[#60748F] dark:text-slate-500 mt-0.5">
                vs. previous 30 days
              </div>
            </div>
          </div>
        </div>

        {/* Card 8: Recent Audit Events */}
        <div
          onClick={() => onNavigate('audit')}
          className="bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-[#155EEF]/40 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#EAF2FF] dark:bg-blue-950/70 border border-[#DFE8F3] dark:border-blue-900/60 flex items-center justify-center text-[#155EEF] dark:text-blue-400 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#60748F] dark:text-slate-400 truncate">
                Recent Audit Events
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-[#142B4D] dark:text-slate-100">
                  {stats.recentAuditEvents.length > 0 ? stats.recentAuditEvents.length : 124}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#12A66A]">
                  <TrendingUp className="w-3 h-3" />
                  <span>62%</span>
                </span>
              </div>
              <div className="text-[11px] text-[#60748F] dark:text-slate-500 mt-0.5">
                vs. previous 30 days
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row (3 Cards): Evidence by Category, Investigation Activity, Recent Audit Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Card 1: Evidence by Category (Donut Chart) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#142B4D] dark:text-slate-100">
              Evidence by Category
            </h2>
          </div>

          <div className="flex items-center gap-6 my-auto">
            {/* Donut SVG */}
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className="stroke-[#F5F8FC] dark:stroke-slate-800"
                  strokeWidth="10"
                  fill="transparent"
                />
                {donutSegments.map((segment, idx) => (
                  <circle
                    key={idx}
                    cx="50"
                    cy="50"
                    r="45"
                    stroke={segment.color}
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={segment.strokeDasharray}
                    strokeDashoffset={segment.strokeDashoffset}
                    className="transition-all duration-500"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold text-[#142B4D] dark:text-slate-100">
                  {stats.totalEvidenceItems}
                </span>
                <span className="text-[10px] text-[#60748F] dark:text-slate-400 font-medium">
                  Total Evidence
                </span>
              </div>
            </div>

            {/* Legend List */}
            <div className="flex-1 space-y-2">
              {donutSegments.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-[#60748F] dark:text-slate-300 truncate">{cat.label}</span>
                  </div>
                  <div className="text-right pl-2">
                    <span className="font-semibold text-[#142B4D] dark:text-slate-100">{cat.count}</span>
                    <span className="text-[11px] text-[#60748F] dark:text-slate-400 ml-1">({cat.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Investigation Activity (Line / Area Chart) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-[#142B4D] dark:text-slate-100">
              Investigation Activity
            </h2>
            <div className="flex items-center gap-4 text-xs font-medium text-[#60748F] dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#155EEF]" />
                <span>Created</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#12A66A]" />
                <span>Closed</span>
              </div>
            </div>
          </div>

          {/* Activity Line Chart SVG */}
          <div className="relative h-44 w-full pt-4">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 400 120" preserveAspectRatio="none">
              <defs>
                <linearGradient id="createdGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#155EEF" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#155EEF" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="closedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#12A66A" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#12A66A" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              <line x1="0" y1="0" x2="400" y2="0" stroke="#DFE8F3" strokeDasharray="3 3" className="dark:stroke-slate-800" />
              <line x1="0" y1="40" x2="400" y2="40" stroke="#DFE8F3" strokeDasharray="3 3" className="dark:stroke-slate-800" />
              <line x1="0" y1="80" x2="400" y2="80" stroke="#DFE8F3" strokeDasharray="3 3" className="dark:stroke-slate-800" />
              <line x1="0" y1="120" x2="400" y2="120" stroke="#DFE8F3" className="dark:stroke-slate-800" />

              {/* Created Line & Area (Blue) */}
              <path
                d="M 0,85 Q 40,70 80,75 T 160,82 T 240,42 T 320,68 T 400,78 L 400,120 L 0,120 Z"
                fill="url(#createdGradient)"
              />
              <path
                d="M 0,85 Q 40,70 80,75 T 160,82 T 240,42 T 320,68 T 400,78"
                fill="none"
                stroke="#155EEF"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Closed Line & Area (Green) */}
              <path
                d="M 0,105 Q 40,102 80,100 T 160,98 T 240,88 T 320,95 T 400,92 L 400,120 L 0,120 Z"
                fill="url(#closedGradient)"
              />
              <path
                d="M 0,105 Q 40,102 80,100 T 160,98 T 240,88 T 320,95 T 400,92"
                fill="none"
                stroke="#12A66A"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Interactive Data points */}
              <circle cx="80" cy="75" r="3.5" fill="#155EEF" className="stroke-white stroke-2" />
              <circle cx="240" cy="42" r="3.5" fill="#155EEF" className="stroke-white stroke-2" />
              <circle cx="320" cy="68" r="3.5" fill="#155EEF" className="stroke-white stroke-2" />
              <circle cx="400" cy="78" r="3.5" fill="#155EEF" className="stroke-white stroke-2" />

              <circle cx="160" cy="98" r="3" fill="#12A66A" className="stroke-white stroke-2" />
              <circle cx="240" cy="88" r="3" fill="#12A66A" className="stroke-white stroke-2" />
              <circle cx="400" cy="92" r="3" fill="#12A66A" className="stroke-white stroke-2" />
            </svg>

            {/* X-Axis Dates */}
            <div className="flex justify-between text-[11px] text-[#60748F] dark:text-slate-400 mt-2 font-medium">
              <span>Apr 20</span>
              <span>Apr 27</span>
              <span>May 4</span>
              <span>May 11</span>
              <span>May 18</span>
            </div>
          </div>
        </div>

        {/* Card 3: Recent Audit Events */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#142B4D] dark:text-slate-100">
              Recent Audit Events
            </h2>
            <button
              onClick={() => onNavigate('audit')}
              className="text-xs font-semibold text-[#155EEF] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3.5">
            {stats.recentAuditEvents.slice(0, 5).map(event => {
              const isLogin = event.action === 'USER_AUTHENTICATED';
              const isEvidence = event.action.includes('EVIDENCE');
              const isTransfer = event.action.includes('TRANSFER');
              const isIntegrity = event.action.includes('INTEGRITY');

              const iconBg = isLogin
                ? 'bg-emerald-50 text-[#12A66A]'
                : isEvidence
                ? 'bg-[#EAF2FF] text-[#155EEF]'
                : isTransfer
                ? 'bg-purple-50 text-purple-600'
                : isIntegrity
                ? 'bg-emerald-50 text-[#12A66A]'
                : 'bg-amber-50 text-[#F59E0B]';

              return (
                <div key={event.id} className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${iconBg}`}>
                    {isLogin && <UserCheck className="w-3.5 h-3.5" />}
                    {isEvidence && <FileText className="w-3.5 h-3.5" />}
                    {isTransfer && <GitCommit className="w-3.5 h-3.5" />}
                    {isIntegrity && <ShieldCheck className="w-3.5 h-3.5" />}
                    {!isLogin && !isEvidence && !isTransfer && !isIntegrity && <ShieldAlert className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-xs font-semibold text-[#142B4D] dark:text-slate-200 truncate">
                        {event.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className="text-[10px] text-[#60748F] dark:text-slate-400 shrink-0">
                        {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#60748F] dark:text-slate-400 truncate mt-0.5">
                      {event.targetId || event.details}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row (2 Cards): Recent Investigations & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent Investigations Table */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#142B4D] dark:text-slate-100">
              Recent Investigations
            </h2>
            <button
              onClick={() => onNavigate('investigations')}
              className="text-xs font-semibold text-[#155EEF] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#DFE8F3] dark:border-slate-800 text-[#60748F] dark:text-slate-400 font-semibold">
                  <th className="pb-3 font-semibold">Case Reference</th>
                  <th className="pb-3 font-semibold">Title</th>
                  <th className="pb-3 font-semibold">Category</th>
                  <th className="pb-3 font-semibold">Priority</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Assigned To</th>
                  <th className="pb-3 font-semibold">Last Updated</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE8F3] dark:divide-slate-800/60">
                {recentCases.map((c: any) => {
                  const priorityColor =
                    c.priority === 'High' || c.priority === 'Critical'
                      ? 'bg-red-50 text-[#DC2626] border-red-200'
                      : c.priority === 'Medium'
                      ? 'bg-amber-50 text-[#F59E0B] border-amber-200'
                      : 'bg-emerald-50 text-[#12A66A] border-emerald-200';

                  const statusColor =
                    c.status === 'Open' || c.status === 'Active'
                      ? 'bg-[#EAF2FF] text-[#155EEF] border-[#DFE8F3]'
                      : c.status === 'In Progress' || c.status === 'Under Review'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-slate-100 text-[#60748F] border-slate-200';

                  const assignedName = c.leadInvestigatorName || 'Agent Sarah Vance';
                  const initials = assignedName.split(' ').map((n: string) => n[0]).join('').slice(0, 2);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => onNavigate('investigations')}
                      className="hover:bg-[#F5F8FC] dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 font-semibold text-[#155EEF] hover:underline">
                        {c.id}
                      </td>
                      <td className="py-3.5 font-medium text-[#142B4D] dark:text-slate-200">
                        {c.title}
                      </td>
                      <td className="py-3.5 text-[#60748F] dark:text-slate-400">
                        {c.category}
                      </td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${priorityColor}`}>
                          {c.priority}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColor}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-[#142B4D] dark:text-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            {initials}
                          </div>
                          <span>{assignedName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 text-[#60748F] dark:text-slate-400">
                        {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'May 20, 2025'}
                      </td>
                      <td className="py-3.5 text-right">
                        <ChevronRight className="w-4 h-4 text-[#60748F] group-hover:text-[#155EEF] transition-colors inline-block" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-base font-bold text-[#142B4D] dark:text-slate-100">
              Quick Actions
            </h2>
          </div>

          <div className="space-y-3">
            {quickActions.map((qa, idx) => {
              const Icon = qa.icon;
              return (
                <button
                  key={idx}
                  onClick={qa.action}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-[#DFE8F3] dark:border-slate-800 hover:border-[#155EEF]/50 hover:bg-[#F5F8FC] dark:hover:bg-slate-800/60 transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${qa.iconColor} transition-transform group-hover:scale-105`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#142B4D] dark:text-slate-100 group-hover:text-[#155EEF] transition-colors">
                        {qa.title}
                      </div>
                      <div className="text-[11px] text-[#60748F] dark:text-slate-400">
                        {qa.desc}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#60748F] group-hover:text-[#155EEF] group-hover:translate-x-0.5 transition-all" />
                </button>
              );
            })}
          </div>

          <div className="pt-4 text-center">
            <button
              onClick={() => onNavigate('evidence')}
              className="text-xs font-semibold text-[#155EEF] hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
            >
              <span>View all actions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
