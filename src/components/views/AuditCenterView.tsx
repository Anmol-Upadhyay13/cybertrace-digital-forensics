import React, { useState } from 'react';
import { AuditEvent, AuditVerificationResult, User } from '../../types/forensics';
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Download,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Search,
  Terminal,
  X
} from 'lucide-react';
import { api } from '../../services/api';

interface AuditCenterViewProps {
  auditEvents: AuditEvent[];
  currentUser: User;
  onRefresh: () => void;
}

export const AuditCenterView: React.FC<AuditCenterViewProps> = ({
  auditEvents,
  currentUser,
  onRefresh
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<AuditVerificationResult | null>(null);
  const [isTampering, setIsTampering] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const handleVerifyChain = async () => {
    try {
      setIsVerifying(true);
      const res = await api.verifyAuditChain();
      setVerificationResult(res);
    } catch (err: any) {
      alert('Chain verification error: ' + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSimulateTamper = async () => {
    if (!window.confirm('Simulate unauthorized modification of a past audit event in the database?')) {
      return;
    }
    try {
      setIsTampering(true);
      await api.simulateAuditTamper();
      const res = await api.verifyAuditChain();
      setVerificationResult(res);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsTampering(false);
    }
  };

  const handleRestoreChain = async () => {
    try {
      setIsTampering(true);
      await api.restoreAuditChain();
      const res = await api.verifyAuditChain();
      setVerificationResult(res);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsTampering(false);
    }
  };

  const filteredEvents = auditEvents.filter(e => {
    const matchesSearch =
      e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.targetId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.hash.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = actionFilter === 'all' || e.action === actionFilter;
    const matchesOutcome = outcomeFilter === 'all' || e.outcome === outcomeFilter;

    return matchesSearch && matchesAction && matchesOutcome;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#DFE8F3] dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#142B4D] dark:text-slate-100 flex items-center gap-2.5">
            <Lock className="w-6 h-6 text-[#155EEF]" />
            Tamper-Evident Audit Center
          </h1>
          <p className="text-sm text-[#60748F] dark:text-slate-400 mt-1">
            RFC 8785 canonical serialization, SHA-256 hash chains, and mathematical non-repudiation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={api.getCsvExportUrl('audit')}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#142B4D] dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-[#EAF2FF] rounded-lg border border-[#DFE8F3] dark:border-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#155EEF]" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={handleVerifyChain}
            disabled={isVerifying}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#155EEF] hover:bg-[#124bbf] rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <ShieldCheck className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isVerifying ? 'Validating Chain...' : 'Verify Cryptographic Chain'}</span>
          </button>
        </div>
      </div>

      {/* Verification Result Banner */}
      {verificationResult && (
        <div
          className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-xs ${
            verificationResult.verified
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950 dark:bg-emerald-950/70 dark:border-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 border-red-200 text-red-950 dark:bg-rose-950/80 dark:border-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            {verificationResult.verified ? (
              <CheckCircle2 className="w-6 h-6 text-[#12A66A] shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-[#DC2626] shrink-0 mt-0.5 sm:mt-0 animate-pulse" />
            )}
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                <span>{verificationResult.verified ? 'CRYPTOGRAPHIC INTEGRITY CONFIRMED' : 'TAMPERING DETECTED IN LEDGER'}</span>
                <span className="text-xs font-mono font-normal opacity-80">
                  ({verificationResult.totalEvents} blocks audited)
                </span>
              </div>
              <p className="text-xs mt-1 opacity-90 leading-relaxed font-mono">
                {verificationResult.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!verificationResult.verified && (
              <button
                onClick={handleRestoreChain}
                disabled={isTampering}
                className="px-3 py-1.5 text-xs font-semibold bg-[#12A66A] hover:bg-emerald-600 text-white rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Valid Chain</span>
              </button>
            )}
            <button
              onClick={() => setVerificationResult(null)}
              className="text-xs opacity-75 hover:opacity-100 cursor-pointer px-2 py-1 text-[#60748F]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Adversarial Verification Controls */}
      <div className="p-4 rounded-xl border border-[#DFE8F3] dark:border-slate-800 bg-white dark:bg-slate-900/90 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="space-y-0.5">
          <span className="font-semibold text-[#142B4D] dark:text-slate-200 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#155EEF]" />
            Audit Chain Non-Repudiation Testbed
          </span>
          <p className="text-[#60748F] dark:text-slate-400">
            Prove tamper-resistance by injecting an unauthorized modification into the database, then observing the cryptographic hash mismatch.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSimulateTamper}
            disabled={isTampering}
            className="px-3 py-1.5 text-xs font-semibold text-[#DC2626] bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Simulate Log Tamper</span>
          </button>
          <button
            onClick={handleRestoreChain}
            disabled={isTampering}
            className="px-3 py-1.5 text-xs font-semibold text-[#60748F] dark:text-slate-300 bg-[#F5F8FC] dark:bg-slate-800 hover:bg-[#EAF2FF] rounded-lg border border-[#DFE8F3] dark:border-slate-700 transition-colors cursor-pointer"
          >
            Reset Chain
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#60748F] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Event ID, Actor, Action, Target, or SHA-256 Block Hash..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-lg text-[#142B4D] dark:text-slate-200 placeholder-[#60748F] focus:outline-none focus:ring-2 focus:ring-[#155EEF]/20 focus:border-[#155EEF]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-lg text-[#142B4D] dark:text-slate-300 focus:outline-none focus:border-[#155EEF] cursor-pointer"
          >
            <option value="all">All Audit Actions</option>
            <option value="USER_AUTHENTICATED">User Authentication</option>
            <option value="CASE_CREATED">Case Created</option>
            <option value="EVIDENCE_REGISTERED">Evidence Registered</option>
            <option value="EVIDENCE_INTEGRITY_VERIFIED">Integrity Verified</option>
            <option value="CUSTODY_TRANSFER_INITIATED">Transfer Initiated</option>
            <option value="CUSTODY_TRANSFER_ACKNOWLEDGED">Transfer Signed</option>
            <option value="USER_ROLE_CHANGED">User Role Changed</option>
            <option value="AUTHORIZATION_DENIED">Access Denied</option>
          </select>

          <select
            value={outcomeFilter}
            onChange={e => setOutcomeFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-lg text-[#142B4D] dark:text-slate-300 focus:outline-none focus:border-[#155EEF] cursor-pointer"
          >
            <option value="all">All Outcomes</option>
            <option value="SUCCESS">Success</option>
            <option value="DENIED">Denied</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Audit Log Ledger Table */}
      <div className="rounded-xl border border-[#DFE8F3] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#DFE8F3] dark:border-slate-800 bg-[#F5F8FC] dark:bg-slate-950/60 text-[#60748F] dark:text-slate-400 font-semibold">
                <th className="py-3 px-4">Seq #</th>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Outcome</th>
                <th className="py-3 px-4 font-mono">Previous Hash</th>
                <th className="py-3 px-4 font-mono">Block Hash (SHA-256)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE8F3] dark:divide-slate-800/60 font-mono">
              {filteredEvents.map(event => (
                <tr
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="hover:bg-[#F5F8FC] dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <td className="py-3.5 px-4 text-[#155EEF] font-bold tabular-nums">
                    #{event.sequenceNumber}
                  </td>

                  <td className="py-3.5 px-4 font-sans text-[#142B4D] dark:text-slate-300 text-[11px]">
                    {new Date(event.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                  </td>

                  <td className="py-3.5 px-4 font-sans">
                    <div className="text-[#142B4D] dark:text-slate-200 font-medium">{event.actorName}</div>
                    <div className="text-[10px] text-[#60748F] dark:text-slate-500">{event.actorRole}</div>
                  </td>

                  <td className="py-3.5 px-4 font-sans text-[#142B4D] dark:text-slate-300 font-semibold">
                    {event.action}
                  </td>

                  <td className="py-3.5 px-4 text-[#60748F] dark:text-slate-400">
                    <span className="text-[10px] text-[#60748F] font-sans block">{event.targetType}</span>
                    <span className="text-[#142B4D] dark:text-slate-300 font-medium">{event.targetId}</span>
                  </td>

                  <td className="py-3.5 px-4 font-sans">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        event.outcome === 'SUCCESS'
                          ? 'bg-emerald-50 text-[#12A66A] border-emerald-200'
                          : event.outcome === 'DENIED'
                          ? 'bg-amber-50 text-[#F59E0B] border-amber-200'
                          : 'bg-red-50 text-[#DC2626] border-red-200'
                      }`}
                    >
                      {event.outcome}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-[11px] text-[#60748F]" title={event.prevHash}>
                    {event.prevHash.slice(0, 8)}...
                  </td>

                  <td className="py-3.5 px-4 text-[11px] text-[#155EEF] font-semibold" title={event.hash}>
                    {event.hash.slice(0, 12)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Details Drawer/Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 text-xs font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-[#DFE8F3] dark:border-slate-800">
              <span className="text-sm font-bold text-[#155EEF]">
                AUDIT BLOCK #{selectedEvent.sequenceNumber} [{selectedEvent.id}]
              </span>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-[#60748F] hover:text-[#142B4D] dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 font-sans">
              <div>
                <span className="text-[#60748F] block text-[11px]">Audit Narrative</span>
                <p className="text-[#142B4D] dark:text-slate-200 bg-[#F5F8FC] dark:bg-slate-950 p-3.5 rounded-xl border border-[#DFE8F3] dark:border-slate-800 leading-relaxed font-sans text-xs">
                  {selectedEvent.details}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#F5F8FC] dark:bg-slate-950 p-3.5 rounded-xl border border-[#DFE8F3] dark:border-slate-800 font-mono text-[11px]">
                <div>
                  <span className="text-[#60748F] block">Operator ID</span>
                  <span className="text-[#142B4D] dark:text-slate-200 font-medium">{selectedEvent.actorId}</span>
                </div>
                <div>
                  <span className="text-[#60748F] block">Client Origin IP</span>
                  <span className="text-[#142B4D] dark:text-slate-200 font-medium">{selectedEvent.clientIp || '127.0.0.1'}</span>
                </div>
                <div>
                  <span className="text-[#60748F] block">Target Entity</span>
                  <span className="text-[#155EEF] font-medium">{selectedEvent.targetType} ({selectedEvent.targetId})</span>
                </div>
                <div>
                  <span className="text-[#60748F] block">Timestamp</span>
                  <span className="text-[#142B4D] dark:text-slate-300">{selectedEvent.timestamp}</span>
                </div>
              </div>

              <div className="space-y-1.5 font-mono text-[10px]">
                <div>
                  <span className="text-[#60748F] block">Previous Chained Hash:</span>
                  <div className="p-2.5 bg-[#F5F8FC] dark:bg-slate-950 rounded-lg border border-[#DFE8F3] dark:border-slate-800 break-all text-[#60748F] select-all">
                    {selectedEvent.prevHash}
                  </div>
                </div>
                <div>
                  <span className="text-[#60748F] block">Canonical Block SHA-256 Hash:</span>
                  <div className="p-2.5 bg-[#EAF2FF] dark:bg-slate-950 rounded-lg border border-[#DFE8F3] dark:border-cyan-900/60 break-all text-[#155EEF] font-semibold select-all">
                    {selectedEvent.hash}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#DFE8F3] dark:border-slate-800 font-sans">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 text-xs font-semibold text-[#60748F] dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 rounded-lg border border-[#DFE8F3] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
