import React, { useState, useEffect } from 'react';
import { Sidebar, TabId } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './components/views/OverviewView';
import { InvestigationsView } from './components/views/InvestigationsView';
import { EvidenceVaultView } from './components/views/EvidenceVaultView';
import { ChainOfCustodyView } from './components/views/ChainOfCustodyView';
import { IntegrityVerificationView } from './components/views/IntegrityVerificationView';
import { AuditCenterView } from './components/views/AuditCenterView';
import { ReportsView } from './components/views/ReportsView';
import { UserManagementView } from './components/views/UserManagementView';
import { SecuritySettingsView } from './components/views/SecuritySettingsView';

import { EvidenceIntakeModal } from './components/modals/EvidenceIntakeModal';
import { NewCaseModal } from './components/modals/NewCaseModal';
import { TransferRequestModal } from './components/modals/TransferRequestModal';
import { AcknowledgeTransferModal } from './components/modals/AcknowledgeTransferModal';

import {
  User,
  Investigation,
  EvidenceItem,
  CustodyTransfer,
  AuditEvent,
  DashboardStats,
  SecuritySettings
} from './types/forensics';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [cases, setCases] = useState<Investigation[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [transfers, setTransfers] = useState<CustodyTransfer[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Modals
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [preselectedEvidenceId, setPreselectedEvidenceId] = useState<string | undefined>(undefined);
  const [transferToAcknowledge, setTransferToAcknowledge] = useState<CustodyTransfer | null>(null);

  const loadAllData = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      // 1. Establish authenticated session and bearer token first
      const sessionData = await api.getSession();
      setCurrentUser(sessionData.user);

      // 2. Query application records with guaranteed verified token
      const [
        usersData,
        casesData,
        evidenceData,
        transfersData,
        auditData,
        statsData,
        settingsData
      ] = await Promise.all([
        api.getUsers(),
        api.getCases(),
        api.getEvidence(),
        api.getCustodyTransfers(),
        api.getAuditEvents(),
        api.getDashboardStats(),
        api.getSettings()
      ]);

      setUsers(usersData);
      setCases(casesData);
      setEvidence(evidenceData);
      setTransfers(transfersData);
      setAuditEvents(auditData);
      setStats(statsData);
      setSettings(settingsData);
    } catch (err: any) {
      console.error('Error fetching application state:', err);
      setLoadError(err?.message || 'Unable to establish authenticated session with CyberTrace engine.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleSwitchUser = async (userId: string) => {
    try {
      const res = await api.switchRole(userId);
      setCurrentUser(res.user);
      await loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetDemoData = async () => {
    await api.resetDemoData();
    await loadAllData();
  };

  const handleOpenTransferModal = (evidenceId?: string) => {
    setPreselectedEvidenceId(evidenceId);
    setShowTransferModal(true);
  };

  if (isLoading && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-mono text-cyan-400">Initializing CyberTrace Forensics Platform...</span>
      </div>
    );
  }

  if (loadError && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-200">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-3 text-red-400">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center font-bold">!</div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">CyberTrace Security Gateway</h2>
              <p className="text-xs text-slate-400">Connection or Authentication Notice</p>
            </div>
          </div>
          <p className="text-sm text-slate-300 font-mono bg-slate-950/60 p-3 rounded border border-slate-800">
            {loadError}
          </p>
          <div className="pt-2">
            <button
              onClick={() => loadAllData()}
              className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              Reconnect & Authenticate
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const pendingTransfersCount = transfers.filter(
    t => t.status === 'Requested' || t.status === 'Awaiting Acknowledgment'
  ).length;

  const integrityMismatchesCount = evidence.filter(
    e => e.lastVerificationResult === 'MISMATCH'
  ).length;

  return (
    <div className={`min-h-screen flex bg-[#F5F8FC] dark:bg-slate-950 text-[#142B4D] dark:text-slate-100 ${isDark ? 'dark' : ''}`}>
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        userRole={currentUser.role}
        pendingTransfersCount={pendingTransfersCount}
        integrityMismatchesCount={integrityMismatchesCount}
      />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F5F8FC] dark:bg-slate-950">
        {/* Top Navigation Bar */}
        <Header
          currentTab={activeTab}
          currentUser={currentUser}
          allUsers={users}
          onSwitchUser={handleSwitchUser}
          onOpenIntakeModal={() => setShowIntakeModal(true)}
          onResetDemoData={handleResetDemoData}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
          onNavigate={setActiveTab}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'overview' && (
            <OverviewView
              stats={stats}
              currentUser={currentUser}
              cases={cases}
              evidence={evidence}
              onNavigate={setActiveTab}
              onOpenIntakeModal={() => setShowIntakeModal(true)}
              onOpenNewCaseModal={() => setShowNewCaseModal(true)}
            />
          )}

          {activeTab === 'investigations' && (
            <InvestigationsView
              cases={cases}
              evidence={evidence}
              transfers={transfers}
              currentUser={currentUser}
              onOpenNewCaseModal={() => setShowNewCaseModal(true)}
              onSelectEvidence={id => {
                setActiveTab('evidence');
              }}
              onCaseUpdated={loadAllData}
            />
          )}

          {activeTab === 'evidence' && (
            <EvidenceVaultView
              evidence={evidence}
              currentUser={currentUser}
              onOpenIntakeModal={() => setShowIntakeModal(true)}
              onInitiateTransfer={handleOpenTransferModal}
              onRefresh={loadAllData}
            />
          )}

          {activeTab === 'custody' && (
            <ChainOfCustodyView
              transfers={transfers}
              evidence={evidence}
              currentUser={currentUser}
              onInitiateTransfer={() => handleOpenTransferModal()}
              onOpenAcknowledgeModal={t => setTransferToAcknowledge(t)}
              onRefresh={loadAllData}
            />
          )}

          {activeTab === 'integrity' && (
            <IntegrityVerificationView
              evidence={evidence}
              currentUser={currentUser}
              onRefresh={loadAllData}
            />
          )}

          {activeTab === 'audit' && (
            <AuditCenterView
              auditEvents={auditEvents}
              currentUser={currentUser}
              onRefresh={loadAllData}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              cases={cases}
              evidence={evidence}
              transfers={transfers}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'users' && (
            <UserManagementView
              users={users}
              currentUser={currentUser}
              onRefresh={loadAllData}
            />
          )}

          {activeTab === 'settings' && (
            <SecuritySettingsView
              settings={settings}
              currentUser={currentUser}
              onRefresh={loadAllData}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {showIntakeModal && (
        <EvidenceIntakeModal
          cases={cases}
          currentUser={currentUser}
          onClose={() => setShowIntakeModal(false)}
          onSuccess={loadAllData}
        />
      )}

      {showNewCaseModal && (
        <NewCaseModal
          currentUser={currentUser}
          onClose={() => setShowNewCaseModal(false)}
          onSuccess={loadAllData}
        />
      )}

      {showTransferModal && (
        <TransferRequestModal
          evidence={evidence}
          users={users}
          currentUser={currentUser}
          preselectedEvidenceId={preselectedEvidenceId}
          onClose={() => setShowTransferModal(false)}
          onSuccess={loadAllData}
        />
      )}

      {transferToAcknowledge && (
        <AcknowledgeTransferModal
          transfer={transferToAcknowledge}
          currentUser={currentUser}
          onClose={() => setTransferToAcknowledge(null)}
          onSuccess={loadAllData}
        />
      )}
    </div>
  );
}
