import React, { useState } from 'react';
import { CustodyTransfer, EvidenceItem, User } from '../../types/forensics';
import {
  GitCommit,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldCheck,
  Plus,
  Search,
  FileSignature
} from 'lucide-react';
import { api } from '../../services/api';

interface ChainOfCustodyViewProps {
  transfers: CustodyTransfer[];
  evidence: EvidenceItem[];
  currentUser: User;
  onInitiateTransfer: () => void;
  onOpenAcknowledgeModal: (transfer: CustodyTransfer) => void;
  onRefresh: () => void;
}

export const ChainOfCustodyView: React.FC<ChainOfCustodyViewProps> = ({
  transfers,
  currentUser,
  onInitiateTransfer,
  onOpenAcknowledgeModal,
  onRefresh
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const pendingTransfers = transfers.filter(
    t => t.status === 'Requested' || t.status === 'Awaiting Acknowledgment'
  );

  const filteredTransfers = transfers.filter(t => {
    const matchesSearch =
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.evidenceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.caseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.fromCustodianName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.toCustodianName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCancel = async (transferId: string) => {
    const reason = window.prompt('Enter reason for cancelling transfer request:');
    if (!reason) return;
    try {
      setIsProcessing(transferId);
      await api.cancelCustodyTransfer(transferId, reason);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (transferId: string) => {
    const reason = window.prompt('Enter mandatory rejection reason:');
    if (!reason) return;
    try {
      setIsProcessing(transferId);
      await api.rejectCustodyTransfer(transferId, reason);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#DFE8F3] dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#142B4D] dark:text-slate-100 flex items-center gap-2.5">
            <GitCommit className="w-6 h-6 text-[#155EEF]" />
            Chain of Custody Ledger & State Machine
          </h1>
          <p className="text-sm text-[#60748F] dark:text-slate-400 mt-1">
            Deterministic transfer state machine, dual-party handovers, digital acknowledgments, and concurrency locks.
          </p>
        </div>

        <button
          onClick={onInitiateTransfer}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#155EEF] hover:bg-[#124bbf] rounded-lg shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Initiate Transfer</span>
        </button>
      </div>

      {/* Pending Transfers Attention Banner */}
      {pendingTransfers.length > 0 && (
        <div className="p-5 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/20 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-sm">
              <Clock className="w-4 h-4 animate-pulse text-[#F59E0B]" />
              <span>Pending Custody Handover Sign-Offs ({pendingTransfers.length})</span>
            </div>
            <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400">
              Evidence locked in transit until acknowledged
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingTransfers.map(pt => {
              const isIntendedRecipient =
                currentUser.id === pt.toCustodianId || currentUser.role === 'Administrator';

              return (
                <div
                  key={pt.id}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 shadow-xs flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#155EEF]">{pt.id}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        {pt.status}
                      </span>
                    </div>
                    <div className="text-[#142B4D] dark:text-slate-200 font-medium">
                      Artifact: <span className="font-mono text-[#155EEF]">{pt.evidenceId}</span> ({pt.caseId})
                    </div>
                    <div className="text-[#60748F] flex items-center gap-1.5 pt-1">
                      <span>{pt.fromCustodianName}</span>
                      <ArrowRight className="w-3 h-3 text-[#60748F]" />
                      <span className="text-[#142B4D] dark:text-slate-200 font-semibold">{pt.toCustodianName}</span>
                    </div>
                    <div className="text-[11px] text-[#60748F] truncate">
                      Destination: {pt.destinationLocation}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#DFE8F3] dark:border-slate-800/80">
                    <span className="text-[10px] text-[#60748F]">
                      Req: {new Date(pt.requestedAt).toISOString().slice(11, 16)} UTC
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReject(pt.id)}
                        disabled={isProcessing === pt.id}
                        className="px-2.5 py-1 text-[11px] text-[#DC2626] hover:bg-red-50 dark:hover:bg-rose-950/80 rounded border border-red-200 cursor-pointer"
                      >
                        Reject
                      </button>

                      {isIntendedRecipient ? (
                        <button
                          onClick={() => onOpenAcknowledgeModal(pt)}
                          className="px-3 py-1 text-[11px] font-semibold text-white bg-[#155EEF] hover:bg-[#124bbf] rounded shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <FileSignature className="w-3.5 h-3.5" />
                          <span>Sign & Acknowledge</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-[#60748F] italic">
                          Awaiting {pt.toCustodianName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Row */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#60748F] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Transfer ID, Artifact ID, Custodian, or Case Reference..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-lg text-[#142B4D] dark:text-slate-200 placeholder-[#60748F] focus:outline-none focus:ring-2 focus:ring-[#155EEF]/20 focus:border-[#155EEF]"
          />
        </div>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-lg text-[#142B4D] dark:text-slate-300 focus:outline-none focus:border-[#155EEF] cursor-pointer"
        >
          <option value="all">All Transfer States</option>
          <option value="Awaiting Acknowledgment">Awaiting Acknowledgment</option>
          <option value="Completed">Completed</option>
          <option value="Rejected">Rejected</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Chronological Transfer Timeline */}
      <div className="rounded-xl border border-[#DFE8F3] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#DFE8F3] dark:border-slate-800 bg-[#F5F8FC] dark:bg-slate-950/60 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[#142B4D] dark:text-slate-300 uppercase tracking-wider">
            Chronological Custody Timeline ({filteredTransfers.length} Events)
          </h3>
          <span className="text-[11px] text-[#60748F] font-mono">
            Immutable Sequence
          </span>
        </div>

        <div className="divide-y divide-[#DFE8F3] dark:divide-slate-800/60">
          {filteredTransfers.map(item => {
            const isCompleted = item.status === 'Completed';
            const isPending = item.status === 'Requested' || item.status === 'Awaiting Acknowledgment';

            return (
              <div key={item.id} className="p-5 hover:bg-[#F5F8FC] dark:hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row gap-5">
                {/* Status Column */}
                <div className="w-36 shrink-0 flex flex-col justify-start">
                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-[#12A66A] shrink-0" />
                    ) : isPending ? (
                      <Clock className="w-4 h-4 text-[#F59E0B] shrink-0 animate-pulse" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
                    )}
                    <span
                      className={`text-xs font-mono font-bold ${
                        isCompleted
                          ? 'text-[#12A66A]'
                          : isPending
                          ? 'text-[#F59E0B]'
                          : 'text-[#DC2626]'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#60748F] font-mono mt-1">
                    {new Date(item.requestedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC
                  </span>
                  <span className="text-[10px] text-[#60748F] mt-1 font-mono">{item.transferMethod}</span>
                </div>

                {/* Details Column */}
                <div className="flex-1 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-[#155EEF]">{item.id}</span>
                    <span className="text-[#60748F]">·</span>
                    <span className="text-[#60748F] font-medium">Artifact:</span>
                    <span className="font-mono text-[#142B4D] dark:text-slate-200 font-semibold">{item.evidenceId}</span>
                    <span className="text-[#60748F]">·</span>
                    <span className="text-[#60748F] font-mono">Case: {item.caseId}</span>
                  </div>

                  <div className="p-3.5 bg-[#F5F8FC] dark:bg-slate-950 rounded-xl border border-[#DFE8F3] dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-[10px] text-[#60748F] block">From Custodian</span>
                        <span className="text-[#142B4D] dark:text-slate-200 font-medium">{item.fromCustodianName}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#60748F] shrink-0" />
                      <div>
                        <span className="text-[10px] text-[#60748F] block">Intended Recipient</span>
                        <span className="text-[#155EEF] font-medium">{item.toCustodianName}</span>
                      </div>
                    </div>

                    <div className="text-right sm:border-l sm:border-[#DFE8F3] dark:border-slate-800 sm:pl-4">
                      <span className="text-[10px] text-[#60748F] block">Handover Location</span>
                      <span className="text-[#142B4D] dark:text-slate-300 font-medium">{item.destinationLocation}</span>
                    </div>
                  </div>

                  <div className="text-[#60748F] text-xs">
                    <span className="font-medium text-[#142B4D] dark:text-slate-300">Justification:</span> {item.transferReason}
                  </div>

                  {/* Digital Signature Hash if Completed */}
                  {item.recipientAcknowledgment && (
                    <div className="mt-2 p-3 bg-emerald-50 dark:bg-slate-950 rounded-xl border border-emerald-200 dark:border-emerald-900/60 font-mono text-[11px] text-[#12A66A] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 truncate">
                        <ShieldCheck className="w-4 h-4 text-[#12A66A] shrink-0" />
                        <span className="truncate">
                          Digital Signature: {item.recipientAcknowledgment.digitalSignatureHash}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#60748F] shrink-0">
                        Signed: {new Date(item.recipientAcknowledgment.timestamp).toISOString().slice(11, 16)} UTC
                      </span>
                    </div>
                  )}

                  {/* Rejection / Cancellation Notes */}
                  {item.rejectedReason && (
                    <div className="mt-1 text-xs text-[#DC2626] font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
                      Rejection Reason: {item.rejectedReason}
                    </div>
                  )}
                  {item.cancelledReason && (
                    <div className="mt-1 text-xs text-[#60748F] bg-[#F5F8FC] p-2.5 rounded-lg border border-[#DFE8F3]">
                      Cancellation Reason: {item.cancelledReason}
                    </div>
                  )}
                </div>

                {/* Actions Column */}
                {isPending && (
                  <div className="shrink-0 flex sm:flex-col justify-end gap-2">
                    {(currentUser.id === item.toCustodianId || currentUser.role === 'Administrator') && (
                      <button
                        onClick={() => onOpenAcknowledgeModal(item)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#155EEF] hover:bg-[#124bbf] rounded-lg shadow-xs cursor-pointer"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => handleCancel(item.id)}
                      className="px-3 py-1.5 text-xs text-[#60748F] hover:text-[#142B4D] bg-[#F5F8FC] hover:bg-[#DFE8F3] rounded-lg border border-[#DFE8F3] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
